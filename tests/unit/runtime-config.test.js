import { describe, expect, it } from "vitest";
import {
  getRuntimeConfig,
  hasDriveConfig,
  hasSupabaseConfig,
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
