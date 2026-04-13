import { describe, expect, it } from "vitest";
import { buildReleaseArtifactNames } from "../../tools/release-artifact-names.mjs";

describe("release artifact names", () => {
  it("uses the product name with spaces for portable and setup copies", () => {
    expect(
      buildReleaseArtifactNames({
        productName: "Coktan Secmeli Sorular",
        version: "0.1.2",
        commit: "b2bd0a4",
      }),
    ).toEqual({
      portableName: "Coktan Secmeli Sorular Portable v0.1.2_b2bd0a4.exe",
      setupName: "Coktan Secmeli Sorular Kurulum v0.1.2_b2bd0a4.exe",
      legacyPortableName: "Coktan Secmeli Sorular Portable.exe",
      legacySetupName: "Coktan Secmeli Sorular Kurulum.exe",
    });
  });

  it("trims surrounding whitespace in the product name", () => {
    expect(
      buildReleaseArtifactNames({
        productName: "  Coktan Secmeli Sorular  ",
        version: "0.1.2",
        commit: "b2bd0a4",
      }).portableName,
    ).toBe("Coktan Secmeli Sorular Portable v0.1.2_b2bd0a4.exe");
  });
});
