(function attachRuntimeConfig(globalScope) {
  "use strict";

  const rawAppConfig =
    (typeof __APP_CONFIG__ !== "undefined" &&
      __APP_CONFIG__ &&
      typeof __APP_CONFIG__ === "object" &&
      __APP_CONFIG__) ||
    globalScope.APP_CONFIG ||
    {};

  const DEFAULT_CONFIG = Object.freeze({
    supabaseUrl: "",
    supabaseAnonKey: "",
    authMode: "mock",
    enableDemoAuth: true,
    driveClientId: "",
    driveApiKey: "",
    driveAppId: "",
  });

  function getRuntimeConfig() {
    const config = {
      ...DEFAULT_CONFIG,
      ...rawAppConfig,
    };

    return Object.freeze({
      ...config,
      authMode: config.supabaseUrl && config.supabaseAnonKey ? "supabase" : "mock",
    });
  }

  function getDriveConfig() {
    const config = getRuntimeConfig();
    return Object.freeze({
      driveClientId: config.driveClientId,
      driveApiKey: config.driveApiKey,
      driveAppId: config.driveAppId,
    });
  }

  function hasSupabaseConfig() {
    const config = getRuntimeConfig();
    return Boolean(config.supabaseUrl && config.supabaseAnonKey);
  }

  function hasDriveConfig() {
    const config = getDriveConfig();
    return Boolean(config.driveClientId && config.driveApiKey && config.driveAppId);
  }

  function isDesktopRuntime() {
    return Boolean(globalScope.__TAURI__?.core?.invoke);
  }

  const AppRuntimeConfig = Object.freeze({
    getDriveConfig,
    getRuntimeConfig,
    hasDriveConfig,
    hasSupabaseConfig,
    isDesktopRuntime,
  });

  globalScope.AppRuntimeConfig = AppRuntimeConfig;

  if (typeof exports !== "undefined") {
    exports.getDriveConfig = getDriveConfig;
    exports.getRuntimeConfig = getRuntimeConfig;
    exports.hasDriveConfig = hasDriveConfig;
    exports.hasSupabaseConfig = hasSupabaseConfig;
    exports.isDesktopRuntime = isDesktopRuntime;
    exports.AppRuntimeConfig = AppRuntimeConfig;
    exports.default = getRuntimeConfig;
  }
})(typeof window !== "undefined" ? window : globalThis);
