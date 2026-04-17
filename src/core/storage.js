// src/core/storage.js
const EMPTY_STORAGE = Object.freeze({
  getItem() { return null; },
  setItem() {},
  removeItem() {},
});

const globalScope = typeof window !== "undefined" ? window : globalThis;
const localStorageRef = globalScope.localStorage ?? EMPTY_STORAGE;
const sessionStorageRef = globalScope.sessionStorage ?? EMPTY_STORAGE;

export function getItem(key) { return localStorageRef.getItem(key); }
export function setItem(key, value) { localStorageRef.setItem(key, value); }
export function removeItem(key) { localStorageRef.removeItem(key); }
export function getLocalItem(key) { return localStorageRef.getItem(key); }
export function setLocalItem(key, value) { localStorageRef.setItem(key, value); }
export function removeLocalItem(key) { localStorageRef.removeItem(key); }
export function getSessionItem(key) { return sessionStorageRef.getItem(key); }
export function setSessionItem(key, value) { sessionStorageRef.setItem(key, value); }
export function removeSessionItem(key) { sessionStorageRef.removeItem(key); }

const AppStorage = Object.freeze({
  getItem, setItem, removeItem,
  getLocalItem, setLocalItem, removeLocalItem,
  getSessionItem, setSessionItem, removeSessionItem,
});
