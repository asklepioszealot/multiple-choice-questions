// src/core/runtime-config.js
const globalScope = typeof window !== "undefined" ? window : globalThis;

const buildTimeAppConfig =
  typeof __APP_CONFIG__ !== "undefined" &&
  __APP_CONFIG__ &&
  typeof __APP_CONFIG__ === "object"
    ? __APP_CONFIG__
    : {};

const DEFAULT_CONFIG = Object.freeze({
  supabaseUrl: "",
  supabaseAnonKey: "",
  authMode: "mock",
  enableDemoAuth: true,
  driveClientId: "",
  driveApiKey: "",
  driveAppId: "",
});

export function getRuntimeConfig() {
  const runtimeOverride =
    globalScope.APP_CONFIG && typeof globalScope.APP_CONFIG === "object"
      ? globalScope.APP_CONFIG
      : {};
  return resolveRuntimeConfig(buildTimeAppConfig, runtimeOverride);
}

export function resolveRuntimeConfig(buildTimeConfig = {}, runtimeOverride = {}) {
  const safeBuildTimeConfig =
    buildTimeConfig && typeof buildTimeConfig === "object" ? buildTimeConfig : {};
  const safeRuntimeOverride =
    runtimeOverride && typeof runtimeOverride === "object" ? runtimeOverride : {};
  const config = {
    ...DEFAULT_CONFIG,
    ...safeBuildTimeConfig,
    ...safeRuntimeOverride,
  };

  return Object.freeze({
    ...config,
    authMode: config.supabaseUrl && config.supabaseAnonKey ? "supabase" : "mock",
  });
}

export function getDriveConfig() {
  const config = getRuntimeConfig();
  return Object.freeze({
    driveClientId: config.driveClientId,
    driveApiKey: config.driveApiKey,
    driveAppId: config.driveAppId,
  });
}

export function hasSupabaseConfig() {
  const config = getRuntimeConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function hasDriveConfig() {
  const config = getDriveConfig();
  return Boolean(config.driveClientId && config.driveApiKey && config.driveAppId);
}

export function isDesktopRuntime() {
  return Boolean(globalScope.__TAURI__?.core?.invoke);
}

export const AppRuntimeConfig = Object.freeze({
  getDriveConfig,
  getRuntimeConfig,
  hasDriveConfig,
  hasSupabaseConfig,
  isDesktopRuntime,
  resolveRuntimeConfig,
});

globalScope.AppRuntimeConfig = AppRuntimeConfig;

export default AppRuntimeConfig;
