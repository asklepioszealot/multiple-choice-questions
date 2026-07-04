import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRuntimeConfig,
  hasDriveConfig,
  hasSupabaseConfig,
  isAndroidRuntime,
  isDesktopRuntime,
  isTauriRuntime,
  resolveRuntimeConfig,
} from "../../src/core/runtime-config.js";

describe("runtime config", () => {
  it("falls back to demo auth defaults", () => {
    const config = getRuntimeConfig();

    expect(config.enableDemoAuth).toBe(true);
    expect(hasSupabaseConfig()).toBe(false);
    expect(hasDriveConfig()).toBe(false);
  });

  it("prefers runtime overrides while preserving build-time defaults", () => {
    const config = resolveRuntimeConfig(
      {
        supabaseUrl: "https://build.supabase.co",
        supabaseAnonKey: "build-anon",
        driveClientId: "build-client",
        driveApiKey: "build-key",
        driveAppId: "build-app",
        enableDemoAuth: false,
      },
      {
        driveApiKey: "runtime-key",
        enableDemoAuth: true,
      },
    );

    expect(config.supabaseUrl).toBe("https://build.supabase.co");
    expect(config.supabaseAnonKey).toBe("build-anon");
    expect(config.driveClientId).toBe("build-client");
    expect(config.driveApiKey).toBe("runtime-key");
    expect(config.driveAppId).toBe("build-app");
    expect(config.enableDemoAuth).toBe(true);
    expect(config.authMode).toBe("supabase");
  });
});

describe("runtime ayrımı (desktop/android)", () => {
  afterEach(() => {
    delete window.__TAURI__;
    vi.unstubAllGlobals();
  });

  it("Tauri yokken üçü de false", () => {
    expect(isTauriRuntime()).toBe(false);
    expect(isAndroidRuntime()).toBe(false);
    expect(isDesktopRuntime()).toBe(false);
  });

  it("masaüstü Tauri'de desktop=true android=false", () => {
    window.__TAURI__ = { core: { invoke: () => {} } };
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
    expect(isTauriRuntime()).toBe(true);
    expect(isAndroidRuntime()).toBe(false);
    expect(isDesktopRuntime()).toBe(true);
  });

  it("Android Tauri'de android=true desktop=false", () => {
    window.__TAURI__ = { core: { invoke: () => {} } };
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14) WebView" });
    expect(isAndroidRuntime()).toBe(true);
    expect(isDesktopRuntime()).toBe(false);
  });

  it("Android UA ama Tauri yoksa android=false", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14)" });
    expect(isAndroidRuntime()).toBe(false);
  });
});
