import { describe, expect, it, vi } from "vitest";
import {
  ANDROID_RELEASES_URL,
  createAndroidUpdateFeature,
  isNewerVersion,
  selectLatestAndroidRelease,
} from "../../src/features/android-update/android-update.js";

function release(tag, { draft = false, prerelease = false, apk = true, body = "" } = {}) {
  return {
    tag_name: tag,
    draft,
    prerelease,
    body,
    assets: apk
      ? [{ name: "app-universal-release.apk", browser_download_url: `https://dl/${tag}.apk` }]
      : [{ name: "notes.txt", browser_download_url: "https://dl/notes.txt" }],
  };
}

function renderButtons() {
  document.body.innerHTML = `
    <button id="check-updates-btn" hidden>x</button>
    <button id="auth-check-updates-btn" hidden>x</button>
  `;
}

function createFeature({ releases = [], ok = true, confirm = true, version = "0.1.1" } = {}) {
  const invoke = vi.fn().mockResolvedValue({ status: "installer_launched" });
  const fetchRef = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 503,
    json: async () => releases,
  });
  const alertRef = vi.fn();
  const confirmRef = vi.fn(() => confirm);
  const feature = createAndroidUpdateFeature({
    getCurrentVersion: () => version,
    documentRef: document,
    windowRef: { __TAURI__: { core: { invoke } } },
    fetchRef,
    alertRef,
    confirmRef,
    consoleRef: { error: vi.fn() },
  });
  return { feature, invoke, fetchRef, alertRef, confirmRef };
}

describe("isNewerVersion", () => {
  it.each([
    ["0.1.2", "0.1.1", true],
    ["0.2.0", "0.1.9", true],
    ["1.0.0", "0.9.9", true],
    ["0.1.1", "0.1.1", false],
    ["0.1.0", "0.1.1", false],
    ["bozuk", "0.1.1", false],
    ["0.1.1", "", true],
  ])("%s > %s → %s", (remote, current, expected) => {
    expect(isNewerVersion(remote, current)).toBe(expected);
  });
});

describe("selectLatestAndroidRelease", () => {
  it("masaüstü, taslak ve ön sürümleri atlayıp en yüksek android-v* sürümünü seçer", () => {
    const latest = selectLatestAndroidRelease([
      release("desktop-v9.9.9"),
      release("android-v0.1.1"),
      release("android-v0.3.0", { draft: true }),
      release("android-v0.2.5", { prerelease: true }),
      release("android-v0.1.10"),
      release("android-v0.1.2"),
    ]);
    expect(latest).toMatchObject({
      version: "0.1.10",
      tagName: "android-v0.1.10",
      downloadUrl: "https://dl/android-v0.1.10.apk",
    });
  });

  it("Android sürümü yoksa null, dizi değilse hata", () => {
    expect(selectLatestAndroidRelease([release("desktop-v0.1.0")])).toBeNull();
    expect(() => selectLatestAndroidRelease({})).toThrow("beklenen formatta");
  });
});

describe("createAndroidUpdateFeature", () => {
  it("iki güncelleme düğmesini de görünür ve etkin yapar", () => {
    renderButtons();
    createFeature();
    ["check-updates-btn", "auth-check-updates-btn"].forEach((id) => {
      const button = document.getElementById(id);
      expect(button.hidden).toBe(false);
      expect(button.disabled).toBe(false);
      expect(button.textContent).toBe("Güncellemeleri Kontrol Et");
    });
  });

  it("güncel sürümde bilgi verir, kurulum başlatmaz", async () => {
    renderButtons();
    const { feature, invoke, fetchRef, alertRef } = createFeature({
      releases: [release("android-v0.1.1")],
    });

    await expect(feature.checkForUpdates("manual")).resolves.toBe(false);

    expect(fetchRef).toHaveBeenCalledWith(ANDROID_RELEASES_URL, expect.any(Object));
    expect(alertRef).toHaveBeenCalledWith("Zaten en güncel sürümdesin (v0.1.1).");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("yeni sürüm onaylanırsa APK indirme komutunu çağırır", async () => {
    renderButtons();
    const { feature, invoke, confirmRef } = createFeature({
      releases: [release("android-v0.1.2", { body: "Yenilikler" })],
    });

    await expect(feature.checkForUpdates("manual")).resolves.toBe(true);

    expect(confirmRef.mock.calls[0][0]).toContain("v0.1.2");
    expect(confirmRef.mock.calls[0][0]).toContain("Yenilikler");
    expect(invoke).toHaveBeenCalledWith("download_and_install_apk", {
      url: "https://dl/android-v0.1.2.apk",
      version: "0.1.2",
    });
    expect(document.getElementById("check-updates-btn").disabled).toBe(false);
  });

  it("onay verilmezse kurulum başlatmaz", async () => {
    renderButtons();
    const { feature, invoke } = createFeature({
      releases: [release("android-v0.1.2")],
      confirm: false,
    });

    await expect(feature.checkForUpdates("manual")).resolves.toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("ağ hatasını ve APK'sız sürümü kullanıcıya bildirir", async () => {
    renderButtons();
    const failing = createFeature({ ok: false });
    await failing.feature.checkForUpdates("manual");
    expect(failing.alertRef).toHaveBeenCalledWith(
      "GitHub Releases erişimi başarısız: HTTP 503",
    );

    const noApk = createFeature({ releases: [release("android-v0.1.2", { apk: false })] });
    await noApk.feature.checkForUpdates("manual");
    expect(noApk.alertRef).toHaveBeenCalledWith("Sürüm için APK dosyası bulunamadı.");
    expect(noApk.invoke).not.toHaveBeenCalled();
  });

  it("Kotlin tarafının string hatasını olduğu gibi gösterir", async () => {
    renderButtons();
    const { feature, invoke, alertRef } = createFeature({
      releases: [release("android-v0.1.2")],
    });
    invoke.mockRejectedValueOnce("APK indirilemedi veya boş geldi.");

    await expect(feature.checkForUpdates("manual")).resolves.toBe(false);
    expect(alertRef).toHaveBeenCalledWith("APK indirilemedi veya boş geldi.");
  });
});
