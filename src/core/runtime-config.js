import { APP_CONFIG } from "../generated/runtime-config.js";

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
  const config = {
    ...DEFAULT_CONFIG,
    ...APP_CONFIG,
  };

  return Object.freeze({
    ...config,
    authMode: config.supabaseUrl && config.supabaseAnonKey ? "supabase" : "mock",
  });
}

export function hasSupabaseConfig() {
  const config = getRuntimeConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function hasDriveConfig() {
  const config = getRuntimeConfig();
  return Boolean(config.driveClientId && config.driveApiKey && config.driveAppId);
}

export function isDesktopRuntime() {
  return Boolean(globalThis.__TAURI__?.core?.invoke);
}

export default getRuntimeConfig;
