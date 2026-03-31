import { describe, expect, it } from "vitest";
import {
  getRuntimeConfig,
  hasDriveConfig,
  hasSupabaseConfig,
} from "../../src/core/runtime-config.js";

describe("runtime config", () => {
  it("falls back to demo auth defaults", () => {
    const config = getRuntimeConfig();

    expect(config.enableDemoAuth).toBe(true);
    expect(hasSupabaseConfig()).toBe(false);
    expect(hasDriveConfig()).toBe(false);
  });
});
