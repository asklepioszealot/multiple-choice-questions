import { describe, expect, it } from "vitest";
import "../../src/core/runtime-config.js";

describe("runtime config globals", () => {
  it("attaches the runtime config helpers to the browser/global scope", () => {
    expect(globalThis.AppRuntimeConfig).toBeDefined();
    expect(typeof globalThis.AppRuntimeConfig.getRuntimeConfig).toBe("function");
    expect(typeof globalThis.AppRuntimeConfig.hasDriveConfig).toBe("function");
  });
});
