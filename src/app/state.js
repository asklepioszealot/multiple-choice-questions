(function attachAppState(globalScope) {
  "use strict";

  const internalState = {
    storage: null,
    currentScreen: "manager",
    analyticsPanelState: {
      isVisible: false,
    },
    desktopUpdateState: {
      startupCheckScheduled: false,
      startupCheckCompleted: false,
      isChecking: false,
      isInstalling: false,
      buttonLabel: "Guncellemeleri Kontrol Et",
    },
  };

  function setStorage(value) {
    internalState.storage = value ?? null;
    return internalState.storage;
  }

  function setCurrentScreen(value) {
    internalState.currentScreen = value || "manager";
    return internalState.currentScreen;
  }

  const AppState = {
    get storage() {
      return internalState.storage;
    },
    get currentScreen() {
      return internalState.currentScreen;
    },
    get analyticsPanelState() {
      return internalState.analyticsPanelState;
    },
    get desktopUpdateState() {
      return internalState.desktopUpdateState;
    },
    setStorage,
    setCurrentScreen,
  };

  globalScope.AppState = AppState;

  if (typeof exports !== "undefined") {
    exports.AppState = AppState;
    exports.setStorage = setStorage;
    exports.setCurrentScreen = setCurrentScreen;
    exports.analyticsPanelState = internalState.analyticsPanelState;
    exports.desktopUpdateState = internalState.desktopUpdateState;
    exports.default = AppState;
  }
})(typeof window !== "undefined" ? window : globalThis);
