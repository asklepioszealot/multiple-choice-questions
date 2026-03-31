import { describe, expect, it } from "vitest";
import { BUILD_INFO } from "../../src/generated/build-info.js";

describe("BUILD_INFO", () => {
  it("provides safe development defaults", () => {
    expect(BUILD_INFO.version).toBeTypeOf("string");
    expect(BUILD_INFO.commit).toBeTypeOf("string");
    expect(BUILD_INFO.source).toBe("vite");
  });
});
