// Android uygulama içi güncelleyici (fc paritesi: fc src/features/android-update).
// Tauri'nin updater eklentisi Android'de yok; GitHub Releases'tan en yeni
// `android-v*` sürümünü bulur, BUILD_INFO sürümüyle karşılaştırır ve onay
// alınırsa APK'yı Rust `download_and_install_apk` komutuna (Kotlin
// DownloadManager + paket yükleyici) verir. createDesktopUpdateFeature ile aynı
// arayüzü sunar; bootstrap Android'de bunu seçer.
const globalScope = typeof window !== "undefined" ? window : globalThis;

const ANDROID_RELEASES_URL =
  "https://api.github.com/repos/asklepioszealot/multiple-choice-questions/releases?per_page=100";
const ANDROID_TAG_PREFIX = "android-v";
const ANDROID_BUTTON_LABEL = "Güncellemeleri Kontrol Et";
const UPDATE_BUTTON_IDS = Object.freeze(["check-updates-btn", "auth-check-updates-btn"]);

function parseSemver(value) {
  const match = String(value || "").trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewerVersion(remote, current) {
  const remoteParts = parseSemver(remote);
  const currentParts = parseSemver(current);
  if (!remoteParts) {
    return false;
  }
  if (!currentParts) {
    return true;
  }
  for (let index = 0; index < 3; index += 1) {
    if (remoteParts[index] !== currentParts[index]) {
      return remoteParts[index] > currentParts[index];
    }
  }
  return false;
}

function releaseToAndroidUpdate(release) {
  const tagName = String(release?.tag_name || "").trim();
  if (!tagName.startsWith(ANDROID_TAG_PREFIX)) {
    return null;
  }

  const version = tagName.slice(ANDROID_TAG_PREFIX.length);
  if (!parseSemver(version)) {
    return null;
  }

  const apkAsset = (Array.isArray(release?.assets) ? release.assets : []).find((asset) =>
    String(asset?.name || "").toLowerCase().endsWith(".apk"),
  );

  return {
    version,
    tagName,
    downloadUrl: apkAsset?.browser_download_url || "",
    notes: String(release?.body || "").trim(),
  };
}

function selectLatestAndroidRelease(releases) {
  if (!Array.isArray(releases)) {
    throw new Error("GitHub Releases yanıtı beklenen formatta değil.");
  }

  const candidates = releases
    .filter((release) => !release?.draft && !release?.prerelease)
    .map(releaseToAndroidUpdate)
    .filter(Boolean);

  return candidates.reduce(
    (latest, candidate) =>
      !latest || isNewerVersion(candidate.version, latest.version) ? candidate : latest,
    null,
  );
}

function formatAndroidUpdatePrompt(updateInfo, currentVersion) {
  const notes =
    updateInfo.notes.length > 400
      ? `${updateInfo.notes.slice(0, 400).trim()}...`
      : updateInfo.notes;
  const parts = [
    `Yeni Android sürümü hazır: v${updateInfo.version}`,
    `Mevcut sürüm: v${currentVersion || "?"}`,
  ];
  if (notes) {
    parts.push(`Sürüm notları:\n${notes}`);
  }
  parts.push("Şimdi indirip kurmak ister misin?");
  return parts.join("\n\n");
}

function createAndroidUpdateFeature({
  getCurrentVersion = () => "",
  documentRef = globalScope.document,
  windowRef = globalScope,
  fetchRef = globalScope.fetch?.bind(globalScope),
  alertRef = globalScope.alert?.bind(globalScope),
  confirmRef = globalScope.confirm?.bind(globalScope),
  consoleRef = globalScope.console,
} = {}) {
  const state = {
    isChecking: false,
    isInstalling: false,
    buttonLabel: ANDROID_BUTTON_LABEL,
  };

  function notify(message) {
    if (typeof alertRef === "function") {
      alertRef(message);
    }
  }

  function syncButtonState() {
    UPDATE_BUTTON_IDS.forEach((id) => {
      const button = documentRef?.getElementById?.(id);
      if (!button) {
        return;
      }
      button.hidden = false;
      button.disabled = state.isChecking || state.isInstalling;
      button.textContent = state.buttonLabel || ANDROID_BUTTON_LABEL;
    });
  }

  function setButtonLabel(label = ANDROID_BUTTON_LABEL) {
    state.buttonLabel = label || ANDROID_BUTTON_LABEL;
    syncButtonState();
  }

  async function fetchLatestAndroidRelease() {
    if (typeof fetchRef !== "function") {
      throw new Error("Ağ erişimi kullanılamıyor.");
    }
    const response = await fetchRef(ANDROID_RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response?.ok) {
      throw new Error(`GitHub Releases erişimi başarısız: HTTP ${response?.status}`);
    }
    const latest = selectLatestAndroidRelease(await response.json());
    if (latest && !latest.downloadUrl) {
      throw new Error("Sürüm için APK dosyası bulunamadı.");
    }
    return latest;
  }

  async function checkForUpdates(source = "manual") {
    const isManualCheck = source === "manual";
    if (state.isChecking || state.isInstalling) {
      if (isManualCheck) {
        notify("Güncelleme kontrolü zaten sürüyor.");
      }
      return false;
    }

    const currentVersion = String(getCurrentVersion() || "").trim();
    state.isChecking = true;
    setButtonLabel("Kontrol ediliyor...");

    try {
      const updateInfo = await fetchLatestAndroidRelease();
      if (!updateInfo || !isNewerVersion(updateInfo.version, currentVersion)) {
        if (isManualCheck) {
          notify(
            currentVersion
              ? `Zaten en güncel sürümdesin (v${currentVersion}).`
              : "Yeni bir Android sürümü bulunamadı.",
          );
        }
        return false;
      }

      const shouldInstall =
        typeof confirmRef === "function"
          ? confirmRef(formatAndroidUpdatePrompt(updateInfo, currentVersion))
          : false;
      if (!shouldInstall) {
        return false;
      }

      const invoke = windowRef?.__TAURI__?.core?.invoke;
      if (typeof invoke !== "function") {
        throw new Error("Tauri çekirdeği bulunamadı.");
      }

      state.isInstalling = true;
      setButtonLabel("İndiriliyor...");
      await invoke("download_and_install_apk", {
        url: updateInfo.downloadUrl,
        version: updateInfo.version,
      });
      return true;
    } catch (error) {
      consoleRef?.error?.("[android-update]", error);
      if (isManualCheck) {
        notify(
          typeof error === "string"
            ? error
            : error?.message || "Güncelleme kontrolü başarısız oldu.",
        );
      }
      return false;
    } finally {
      state.isChecking = false;
      state.isInstalling = false;
      setButtonLabel();
    }
  }

  // fc paritesi: Android'de açılışta otomatik kontrol yok, yalnız düğme.
  function scheduleStartupCheck() {
    syncButtonState();
  }

  syncButtonState();

  return {
    checkForUpdates,
    scheduleStartupCheck,
    syncButtonState,
    setButtonLabel,
  };
}

export {
  ANDROID_RELEASES_URL,
  UPDATE_BUTTON_IDS,
  createAndroidUpdateFeature,
  formatAndroidUpdatePrompt,
  isNewerVersion,
  selectLatestAndroidRelease,
};
