(function attachDesktopUpdateFeature(globalScope) {
  "use strict";

  const DEFAULT_BUTTON_LABEL = "Guncellemeleri Kontrol Et";

  function getSharedDesktopUpdateState(stateRef = globalScope.AppState) {
    const state = stateRef?.desktopUpdateState;
    if (state && typeof state === "object") {
      return state;
    }

    return {
      startupCheckScheduled: false,
      startupCheckCompleted: false,
      isChecking: false,
      isInstalling: false,
      buttonLabel: DEFAULT_BUTTON_LABEL,
    };
  }

  function getTauriCoreApi(scope = globalScope) {
    return scope?.__TAURI__?.core || null;
  }

  function isWindowsDesktopClient({
    isDesktopRuntimeRef = globalScope.AppRuntimeConfig?.isDesktopRuntime,
    navigatorRef = globalScope.navigator,
    scope = globalScope,
  } = {}) {
    const desktopRuntime =
      typeof isDesktopRuntimeRef === "function"
        ? isDesktopRuntimeRef()
        : Boolean(getTauriCoreApi(scope)?.invoke);

    if (!desktopRuntime || typeof getTauriCoreApi(scope)?.invoke !== "function") {
      return false;
    }

    const userAgent = String(navigatorRef?.userAgent || "");
    const platform = String(navigatorRef?.platform || "");
    return `${userAgent} ${platform}`.toLowerCase().includes("win");
  }

  function getDesktopUpdateNotes(updateMetadata) {
    const rawNotes =
      typeof updateMetadata?.body === "string" && updateMetadata.body.trim()
        ? updateMetadata.body.trim()
        : typeof updateMetadata?.rawJson?.notes === "string" &&
            updateMetadata.rawJson.notes.trim()
          ? updateMetadata.rawJson.notes.trim()
          : "";

    if (!rawNotes) {
      return "";
    }

    return rawNotes.length > 600 ? `${rawNotes.slice(0, 600).trim()}...` : rawNotes;
  }

  function formatDesktopUpdatePrompt(updateMetadata = {}) {
    const version = updateMetadata.version || "?";
    const currentVersion = updateMetadata.currentVersion || "?";
    const notes = getDesktopUpdateNotes(updateMetadata);
    const parts = [
      `Yeni masaustu surumu hazir: v${version}`,
      `Mevcut surum: v${currentVersion}`,
    ];

    if (notes) {
      parts.push(`Surum notlari:\n${notes}`);
    }

    parts.push("Simdi indirip kurmak ister misin?");
    return parts.join("\n\n");
  }

  function createDesktopUpdateFeature({
    stateRef = globalScope.AppState,
    isDesktopRuntimeRef = globalScope.AppRuntimeConfig?.isDesktopRuntime,
    documentRef = globalScope.document,
    windowRef = globalScope,
    alertRef = globalScope.alert?.bind(globalScope),
    confirmRef = globalScope.confirm?.bind(globalScope),
    consoleRef = globalScope.console,
  } = {}) {
    const desktopUpdateState = getSharedDesktopUpdateState(stateRef);

    function getButton() {
      return documentRef?.getElementById?.("check-updates-btn") ?? null;
    }

    function syncButtonState() {
      const button = getButton();
      if (!button) {
        return;
      }

      if (
        !isWindowsDesktopClient({
          isDesktopRuntimeRef,
          navigatorRef: windowRef?.navigator,
          scope: windowRef,
        })
      ) {
        button.hidden = true;
        button.disabled = true;
        return;
      }

      button.hidden = false;
      button.disabled = desktopUpdateState.isChecking || desktopUpdateState.isInstalling;
      button.textContent = desktopUpdateState.buttonLabel || DEFAULT_BUTTON_LABEL;
    }

    function setButtonLabel(label = DEFAULT_BUTTON_LABEL) {
      desktopUpdateState.buttonLabel = label || DEFAULT_BUTTON_LABEL;
      syncButtonState();
    }

    async function closeDesktopUpdateResource(rid) {
      const core = getTauriCoreApi(windowRef);
      if (!core || !Number.isInteger(rid)) {
        return;
      }

      try {
        await core.invoke("plugin:resources|close", { rid });
      } catch {
        // Best effort cleanup.
      }
    }

    function createDesktopUpdateChannel(onEvent) {
      const Channel = getTauriCoreApi(windowRef)?.Channel;
      if (typeof Channel !== "function") {
        return null;
      }

      const channel = new Channel();
      channel.onmessage = onEvent;
      return channel;
    }

    async function installUpdate(updateMetadata) {
      const core = getTauriCoreApi(windowRef);
      if (!core) {
        throw new Error("Tauri cekirdegi bulunamadi.");
      }

      let downloadedBytes = 0;
      let contentLength = 0;
      desktopUpdateState.isInstalling = true;
      setButtonLabel("Indiriliyor...");

      try {
        const channel = createDesktopUpdateChannel((event) => {
          if (!event || typeof event !== "object") {
            return;
          }

          switch (event.event) {
            case "Started":
              contentLength = Number(event.data?.contentLength || 0);
              setButtonLabel("Indiriliyor...");
              break;
            case "Progress": {
              downloadedBytes += Number(event.data?.chunkLength || 0);
              if (contentLength > 0) {
                const progress = Math.min(
                  99,
                  Math.max(1, Math.round((downloadedBytes / contentLength) * 100)),
                );
                setButtonLabel(`Indiriliyor %${progress}`);
              } else {
                setButtonLabel("Indiriliyor...");
              }
              break;
            }
            case "Finished":
              setButtonLabel("Kuruluyor...");
              break;
            default:
              break;
          }
        });

        const args = { rid: updateMetadata.rid };
        if (channel) {
          args.onEvent = channel;
        }

        await core.invoke("plugin:updater|download_and_install", args);
        setButtonLabel("Yeniden baslatiliyor...");
        await core.invoke("plugin:process|restart");
      } catch (error) {
        await closeDesktopUpdateResource(updateMetadata.rid);
        throw error;
      } finally {
        desktopUpdateState.isInstalling = false;
        setButtonLabel();
      }
    }

    async function checkForUpdates(source = "manual") {
      const isManualCheck = source === "manual";

      if (
        !isWindowsDesktopClient({
          isDesktopRuntimeRef,
          navigatorRef: windowRef?.navigator,
          scope: windowRef,
        })
      ) {
        if (isManualCheck && typeof alertRef === "function") {
          alertRef("Masaustu guncellemesi yalnizca Windows desktop surumunde kullanilabilir.");
        }
        return false;
      }

      if (desktopUpdateState.isChecking || desktopUpdateState.isInstalling) {
        if (isManualCheck && typeof alertRef === "function") {
          alertRef("Guncelleme kontrolu zaten suruyor.");
        }
        return false;
      }

      const core = getTauriCoreApi(windowRef);
      if (!core) {
        return false;
      }

      desktopUpdateState.isChecking = true;
      if (isManualCheck) {
        setButtonLabel("Kontrol ediliyor...");
      }

      try {
        const updateMetadata = await core.invoke("plugin:updater|check");
        if (!updateMetadata) {
          if (isManualCheck && typeof alertRef === "function") {
            alertRef("Yeni bir masaustu surumu bulunamadi.");
          }
          return false;
        }

        const shouldInstall =
          typeof confirmRef === "function"
            ? confirmRef(formatDesktopUpdatePrompt(updateMetadata))
            : false;

        if (!shouldInstall) {
          await closeDesktopUpdateResource(updateMetadata.rid);
          return false;
        }

        await installUpdate(updateMetadata);
        return true;
      } catch (error) {
        consoleRef?.error?.(error);
        if (isManualCheck && typeof alertRef === "function") {
          alertRef(error?.message || "Guncelleme kontrolu basarisiz oldu.");
        }
        return false;
      } finally {
        desktopUpdateState.isChecking = false;
        if (!desktopUpdateState.isInstalling) {
          setButtonLabel();
        }
        if (source === "startup") {
          desktopUpdateState.startupCheckCompleted = true;
        }
      }
    }

    function scheduleStartupCheck() {
      if (
        !isWindowsDesktopClient({
          isDesktopRuntimeRef,
          navigatorRef: windowRef?.navigator,
          scope: windowRef,
        }) ||
        desktopUpdateState.startupCheckScheduled ||
        desktopUpdateState.startupCheckCompleted
      ) {
        syncButtonState();
        return;
      }

      desktopUpdateState.startupCheckScheduled = true;
      syncButtonState();
      windowRef.setTimeout(() => {
        void checkForUpdates("startup");
      }, 0);
    }

    syncButtonState();

    return {
      checkForUpdates,
      scheduleStartupCheck,
      syncButtonState,
      setButtonLabel,
    };
  }

  const AppDesktopUpdate = Object.freeze({
    createDesktopUpdateFeature,
    DEFAULT_BUTTON_LABEL,
    formatDesktopUpdatePrompt,
    getDesktopUpdateNotes,
    getTauriCoreApi,
    isWindowsDesktopClient,
  });

  globalScope.AppDesktopUpdate = AppDesktopUpdate;

  if (typeof exports !== "undefined") {
    exports.createDesktopUpdateFeature = createDesktopUpdateFeature;
    exports.DEFAULT_BUTTON_LABEL = DEFAULT_BUTTON_LABEL;
    exports.formatDesktopUpdatePrompt = formatDesktopUpdatePrompt;
    exports.getDesktopUpdateNotes = getDesktopUpdateNotes;
    exports.getTauriCoreApi = getTauriCoreApi;
    exports.isWindowsDesktopClient = isWindowsDesktopClient;
    exports.AppDesktopUpdate = AppDesktopUpdate;
    exports.default = AppDesktopUpdate;
  }
})(typeof window !== "undefined" ? window : globalThis);
