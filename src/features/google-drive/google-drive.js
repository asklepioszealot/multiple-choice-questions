const globalScope = typeof window !== "undefined" ? window : globalThis;

const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.readonly";
  const DRIVE_MIME_TYPES =
    "application/json,text/markdown,text/plain,application/octet-stream,application/zip";
  const DRIVE_DISABLED_MESSAGE =
    "Google Drive entegrasyonu bu yapıda etkin değil. Runtime config gerekli.";
  const DRIVE_NOT_READY_MESSAGE =
    "Google hesap servisleri henüz yüklenmedi veya bağlantı hatası var.";
  const DRIVE_DESKTOP_MESSAGE =
    "Tauri (masaüstü) versiyonunda Google Picker penceresi desteklenmiyor.";

  function createGoogleDriveFeature({
    getRuntimeConfig,
    hasDriveConfig,
    isDesktopRuntime,
    loadSetFromText,
    loadSetFromBinary,
    selectSet,
    renderSetList,
    showUndoToast,
    documentRef = globalScope.document,
    alertRef = globalScope.alert?.bind(globalScope),
    consoleRef = globalScope.console,
    fetchRef = globalScope.fetch?.bind(globalScope),
    googleRef,
    gapiRef,
    setTimeoutRef = globalScope.setTimeout?.bind(globalScope),
    clearTimeoutRef = globalScope.clearTimeout?.bind(globalScope),
  }) {
    const getRuntimeConfigRef =
      typeof getRuntimeConfig === "function"
        ? getRuntimeConfig
        : function fallbackGetRuntimeConfig() {
            return {};
          };
    const hasDriveConfigRef =
      typeof hasDriveConfig === "function"
        ? hasDriveConfig
        : function fallbackHasDriveConfig() {
            const config = getRuntimeConfigRef();
            return Boolean(
              config?.driveClientId && config?.driveApiKey && config?.driveAppId,
            );
          };
    const isDesktopRuntimeRef =
      typeof isDesktopRuntime === "function"
        ? isDesktopRuntime
        : function fallbackIsDesktopRuntime() {
            return Boolean(globalScope.__TAURI__?.core?.invoke);
          };
    const loadSetFromTextRef =
      typeof loadSetFromText === "function"
        ? loadSetFromText
        : async function fallbackLoadSetFromText() {
            throw new Error("Set loader is not available.");
          };
    const loadSetFromBinaryRef =
      typeof loadSetFromBinary === "function"
        ? loadSetFromBinary
        : async function fallbackLoadSetFromBinary() {
            throw new Error("Binary set loader is not available.");
          };
    const selectSetRef =
      typeof selectSet === "function"
        ? selectSet
        : function fallbackSelectSet() {
            return false;
          };
    const renderSetListRef =
      typeof renderSetList === "function"
        ? renderSetList
        : function fallbackRenderSetList() {};
    const showUndoToastRef =
      typeof showUndoToast === "function"
        ? showUndoToast
        : function fallbackShowUndoToast() {};
    const showAlert =
      typeof alertRef === "function"
        ? alertRef
        : function fallbackAlert() {};
    const logger = consoleRef || console;
    const fetchRuntime =
      typeof fetchRef === "function"
        ? fetchRef
        : async function fallbackFetch() {
            throw new Error("Fetch API kullanılamıyor.");
          };
    const setTimer =
      typeof setTimeoutRef === "function"
        ? setTimeoutRef
        : function fallbackSetTimeout() {
            return null;
          };
    const clearTimer =
      typeof clearTimeoutRef === "function"
        ? clearTimeoutRef
        : function fallbackClearTimeout() {};
    const getGoogleRef =
      typeof googleRef === "function"
        ? googleRef
        : function resolveGoogleRef() {
            return googleRef || globalScope.google;
          };
    const getGapiRef =
      typeof gapiRef === "function"
        ? gapiRef
        : function resolveGapiRef() {
            return gapiRef || globalScope.gapi;
          };

    let driveTokenClient = null;
    let driveAccessToken = null;
    let drivePickerApiLoaded = false;
    let initRetryTimeoutId = null;

    function readDriveConfig() {
      const runtimeConfig = getRuntimeConfigRef() || {};
      return {
        driveClientId: runtimeConfig.driveClientId || "",
        driveApiKey: runtimeConfig.driveApiKey || "",
        driveAppId: runtimeConfig.driveAppId || "",
        driveScopes: runtimeConfig.driveScopes || DRIVE_SCOPES,
      };
    }

    function syncDriveButtonState() {
      const driveButton = documentRef?.getElementById("drive-upload-btn");
      if (!driveButton) {
        return;
      }

      const enabled = hasDriveConfigRef();
      driveButton.disabled = !enabled;
      driveButton.title = enabled ? "" : DRIVE_DISABLED_MESSAGE;
      driveButton.setAttribute("aria-disabled", enabled ? "false" : "true");
    }

    function scheduleInitRetry() {
      if (initRetryTimeoutId) {
        clearTimer(initRetryTimeoutId);
      }

      initRetryTimeoutId = setTimer(() => {
        initRetryTimeoutId = null;
        initGoogleDrive();
      }, 500);
    }

    function initGoogleDrive() {
      syncDriveButtonState();

      if (!hasDriveConfigRef()) {
        driveTokenClient = null;
        driveAccessToken = null;
        drivePickerApiLoaded = false;
        return false;
      }

      const googleRuntime = getGoogleRef();
      const gapiRuntime = getGapiRef();
      if (!googleRuntime?.accounts?.oauth2 || !gapiRuntime?.load) {
        scheduleInitRetry();
        return false;
      }

      gapiRuntime.load("picker", () => {
        drivePickerApiLoaded = true;
      });

      const driveConfig = readDriveConfig();
      driveTokenClient = googleRuntime.accounts.oauth2.initTokenClient({
        client_id: driveConfig.driveClientId,
        scope: driveConfig.driveScopes,
        callback: (tokenResponse) => {
          if (tokenResponse?.access_token) {
            driveAccessToken = tokenResponse.access_token;
            launchDrivePicker();
          }
        },
      });

      return true;
    }

    function authGoogleDrive() {
      syncDriveButtonState();

      if (!hasDriveConfigRef()) {
        showAlert(DRIVE_DISABLED_MESSAGE);
        return false;
      }

      if (!driveTokenClient || !drivePickerApiLoaded) {
        showAlert(DRIVE_NOT_READY_MESSAGE);
        return false;
      }

      driveTokenClient.requestAccessToken({ prompt: "" });
      return true;
    }

    function launchDrivePicker() {
      if (isDesktopRuntimeRef()) {
        showAlert(DRIVE_DESKTOP_MESSAGE);
        return false;
      }

      const googleRuntime = getGoogleRef();
      if (!googleRuntime?.picker) {
        showAlert(DRIVE_NOT_READY_MESSAGE);
        return false;
      }

      const driveConfig = readDriveConfig();
      const view = new googleRuntime.picker.DocsView(googleRuntime.picker.ViewId.DOCS)
        .setMimeTypes(DRIVE_MIME_TYPES);
      const picker = new googleRuntime.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(driveAccessToken)
        .setDeveloperKey(driveConfig.driveApiKey)
        .setAppId(driveConfig.driveAppId)
        .setCallback(pickerCallback)
        .setTitle("Uygulamaya eklenecek soru setini seçin (.json, .md, .txt, .apkg)")
        .build();

      picker.setVisible(true);
      return true;
    }

    async function pickerCallback(data) {
      const googleRuntime = getGoogleRef();
      if (data?.action === googleRuntime?.picker?.Action?.PICKED) {
        const file = data.docs[0];
        return downloadAndLoadDriveFile(file.id, file.name);
      }

      return null;
    }

    async function downloadAndLoadDriveFile(fileId, fileName) {
      const driveConfig = readDriveConfig();

      try {
        const response = await fetchRuntime(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveConfig.driveApiKey}`,
          {
            headers: {
              Authorization: `Bearer ${driveAccessToken}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error("İndirme hatası: " + response.statusText);
        }

        const setId = /\.apkg$/i.test(String(fileName || ""))
          ? await loadSetFromBinaryRef(await response.arrayBuffer(), fileName)
          : await loadSetFromTextRef(await response.text(), fileName);
        selectSetRef(setId);
        renderSetListRef();
        showUndoToastRef(`"${fileName}" yüklendi!`);
        return setId;
      } catch (error) {
        logger.error("Drive set indirme hatası:", error);
        showAlert("Drive indirme hatası: " + error.message);
        return null;
      }
    }

    return Object.freeze({
      authGoogleDrive,
      downloadAndLoadDriveFile,
      initGoogleDrive,
      launchDrivePicker,
      pickerCallback,
      syncDriveButtonState,
    });
  }

  const AppGoogleDrive = Object.freeze({
  createGoogleDriveFeature
});

export {
  createGoogleDriveFeature,
  AppGoogleDrive
};
