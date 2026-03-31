(function attachAppStorage(globalScope) {
  "use strict";

  const EMPTY_STORAGE = Object.freeze({
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
  });

  const localStorageRef = globalScope.localStorage ?? EMPTY_STORAGE;
  const sessionStorageRef = globalScope.sessionStorage ?? EMPTY_STORAGE;

  function getItem(key) {
    return localStorageRef.getItem(key);
  }

  function setItem(key, value) {
    localStorageRef.setItem(key, value);
  }

  function removeItem(key) {
    localStorageRef.removeItem(key);
  }

  function getLocalItem(key) {
    return localStorageRef.getItem(key);
  }

  function setLocalItem(key, value) {
    localStorageRef.setItem(key, value);
  }

  function removeLocalItem(key) {
    localStorageRef.removeItem(key);
  }

  function getSessionItem(key) {
    return sessionStorageRef.getItem(key);
  }

  function setSessionItem(key, value) {
    sessionStorageRef.setItem(key, value);
  }

  function removeSessionItem(key) {
    sessionStorageRef.removeItem(key);
  }

  const AppStorage = Object.freeze({
    getItem,
    setItem,
    removeItem,
    getLocalItem,
    setLocalItem,
    removeLocalItem,
    getSessionItem,
    setSessionItem,
    removeSessionItem,
  });

  globalScope.AppStorage = AppStorage;

  if (typeof exports !== "undefined") {
    exports.AppStorage = AppStorage;
    exports.default = AppStorage;
  }
})(typeof window !== "undefined" ? window : globalThis);
