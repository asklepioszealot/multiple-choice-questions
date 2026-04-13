import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildReleasePlan,
  detectUpdaterSigningPlan,
  resolveMcqUpdaterKeyPath,
} from "../../tools/release-plan.mjs";

describe("release plan", () => {
  it("resolves the MCQ-specific local updater key path", () => {
    expect(resolveMcqUpdaterKeyPath("C:\\Users\\Ahmet")).toBe(
      "C:\\Users\\Ahmet\\.tauri\\multiple-choice-questions-updater.key",
    );
  });

  it("detects when updater artifacts should be disabled because no key exists", () => {
    const plan = detectUpdaterSigningPlan({
      env: {},
      homeDir: "C:\\Users\\Ahmet",
      existsSyncRef() {
        return false;
      },
    });

    expect(plan).toEqual({
      defaultKeyPath: "C:\\Users\\Ahmet\\.tauri\\multiple-choice-questions-updater.key",
      keySource: "missing",
      shouldLoadDefaultKey: false,
      updaterArtifactsEnabled: false,
    });
  });

  it("prefers inline env keys over local defaults", () => {
    const plan = detectUpdaterSigningPlan({
      env: {
        TAURI_SIGNING_PRIVATE_KEY: "inline-secret",
      },
      homeDir: "C:\\Users\\Ahmet",
      existsSyncRef() {
        return true;
      },
    });

    expect(plan.keySource).toBe("env-inline");
    expect(plan.shouldLoadDefaultKey).toBe(false);
    expect(plan.updaterArtifactsEnabled).toBe(true);
  });

  it("builds a dry-run friendly release plan without mutating disk", () => {
    const releasePlan = buildReleasePlan({
      repoRoot: "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence",
      productName: "Coktan Secmeli Sorular",
      version: "0.1.0",
      commit: "abc1234",
      timestamp: "20260404-190000",
      buildId: "build-99",
      noLegacyCopy: true,
      updaterSigningPlan: {
        defaultKeyPath: "C:\\Users\\Ahmet\\.tauri\\multiple-choice-questions-updater.key",
        keySource: "missing",
        shouldLoadDefaultKey: false,
        updaterArtifactsEnabled: false,
      },
    });

    expect(releasePlan.releaseDir).toBe(
      "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence\\release\\20260404-190000_v0.1.0_abc1234",
    );
    expect(releasePlan.latestPointerPath).toBe(
      "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence\\LATEST_RELEASE_POINTER.txt",
    );
    expect(releasePlan.openPortableInfoPath).toBe(
      path.join(releasePlan.releaseDir, "OPEN_THIS_PORTABLE.txt"),
    );
    expect(releasePlan.pointerEntries).toEqual([
      `latest_release_dir=${releasePlan.releaseDir}`,
      `portable_exe=${releasePlan.portableTarget}`,
      `setup_exe=${releasePlan.setupTarget}`,
      "build_id=build-99",
      "legacy_copy=False",
    ]);
    expect(releasePlan.dryRunSummary.updaterKeySource).toBe("missing");
    expect(releasePlan.dryRunSummary.updaterArtifacts).toBe("disabled");
    expect(releasePlan.dryRunSummary.legacyCopy).toBe("disabled");
  });
});
