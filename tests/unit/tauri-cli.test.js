import { describe, expect, it } from "vitest";
import { buildTauriCliExecutionPlan } from "../../tools/tauri-cli.mjs";

describe("tauri-cli", () => {
  it("leaves non-build commands untouched", () => {
    const plan = buildTauriCliExecutionPlan({
      cliArgs: ["dev"],
      env: {},
      homeDir: "C:\\Users\\Ahmet",
      tempDir: "C:\\Temp",
      existsSyncRef() {
        return false;
      },
    });

    expect(plan.args).toEqual(["dev"]);
    expect(plan.disableUpdaterArtifacts).toBe(false);
    expect(plan.shouldLoadDefaultKey).toBe(false);
    expect(plan.overrideConfigPath).toBeNull();
  });

  it("loads the default updater key for build commands and sets an empty password by default", () => {
    const plan = buildTauriCliExecutionPlan({
      cliArgs: ["build", "--bundles", "nsis"],
      env: {},
      homeDir: "C:\\Users\\Ahmet",
      tempDir: "C:\\Temp",
      readFileSyncRef() {
        return "inline-secret";
      },
      existsSyncRef(candidatePath) {
        return candidatePath.endsWith("multiple-choice-questions-updater.key");
      },
    });

    expect(plan.args).toEqual(["build", "--bundles", "nsis"]);
    expect(plan.shouldLoadDefaultKey).toBe(true);
    expect(plan.disableUpdaterArtifacts).toBe(false);
    expect(plan.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD).toBe("");
  });

  it("adds an override config when a build runs without any signing key", () => {
    const plan = buildTauriCliExecutionPlan({
      cliArgs: ["build", "--bundles", "nsis"],
      env: {},
      homeDir: "C:\\Users\\Ahmet",
      tempDir: "C:\\Temp",
      existsSyncRef() {
        return false;
      },
    });

    expect(plan.disableUpdaterArtifacts).toBe(true);
    expect(plan.args).toEqual(["build", "--bundles", "nsis", "--config", plan.overrideConfigPath]);
  });

  it("respects an explicit config path instead of appending another override", () => {
    const plan = buildTauriCliExecutionPlan({
      cliArgs: ["build", "--config", "custom.json"],
      env: {},
      homeDir: "C:\\Users\\Ahmet",
      tempDir: "C:\\Temp",
      existsSyncRef() {
        return false;
      },
    });

    expect(plan.disableUpdaterArtifacts).toBe(true);
    expect(plan.args).toEqual(["build", "--config", "custom.json"]);
    expect(plan.overrideConfigPath).toBeNull();
  });
});
