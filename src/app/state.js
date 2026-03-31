(function attachAppState(globalScope) {
  "use strict";

  const internalState = {
    storage: null,
    currentScreen: "manager",
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
    setStorage,
    setCurrentScreen,
  };

  globalScope.AppState = AppState;

  if (typeof exports !== "undefined") {
    exports.AppState = AppState;
    exports.setStorage = setStorage;
    exports.setCurrentScreen = setCurrentScreen;
    exports.default = AppState;
  }
})(typeof window !== "undefined" ? window : globalThis);
