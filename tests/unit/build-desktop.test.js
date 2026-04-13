import { describe, expect, it } from "vitest";
import {
  buildDesktopBuildPlan,
  resolveLocalUpdaterKeyPath,
} from "../../tools/build-desktop.mjs";

describe("build-desktop", () => {
  it("resolves the conventional local updater key path", () => {
    expect(resolveLocalUpdaterKeyPath("C:\\Users\\Ahmet")).toBe(
      "C:\\Users\\Ahmet\\.tauri\\multiple-choice-questions-updater.key",
    );
  });

  it("disables updater artifacts when no signing key is available", () => {
    const plan = buildDesktopBuildPlan({
      env: {},
      homeDir: "C:\\Users\\Ahmet",
      tempDir: "C:\\Temp",
      existsSyncRef() {
        return false;
      },
    });

    expect(plan.disableUpdaterArtifacts).toBe(true);
    expect(plan.args).toEqual([
      "build",
      "--bundles",
      "nsis",
      "--config",
      plan.overrideConfigPath,
    ]);
  });

  it("keeps updater artifacts enabled when a local signing key exists", () => {
    const plan = buildDesktopBuildPlan({
      env: {},
      homeDir: "C:\\Users\\Ahmet",
      tempDir: "C:\\Temp",
      existsSyncRef(candidatePath) {
        return candidatePath.endsWith("multiple-choice-questions-updater.key");
      },
    });

    expect(plan.shouldLoadDefaultKey).toBe(true);
    expect(plan.disableUpdaterArtifacts).toBe(false);
    expect(plan.args).toEqual(["build", "--bundles", "nsis"]);
  });

  it("marks the signing source in the desktop build plan", () => {
    const plan = buildDesktopBuildPlan({
      env: {
        TAURI_SIGNING_PRIVATE_KEY_PATH: "C:\\keys\\mcq.key",
      },
      homeDir: "C:\\Users\\Ahmet",
      tempDir: "C:\\Temp",
      existsSyncRef() {
        return false;
      },
    });

    expect(plan.keySource).toBe("env-path");
    expect(plan.disableUpdaterArtifacts).toBe(false);
  });
});
