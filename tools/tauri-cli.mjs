import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { detectUpdaterSigningPlan, joinTargetPath } from "./release-plan.mjs";

export function buildTauriCliExecutionPlan({
  cliArgs,
  env = process.env,
  homeDir = os.homedir(),
  tempDir = os.tmpdir(),
  existsSyncRef = fs.existsSync,
  readFileSyncRef = fs.readFileSync,
} = {}) {
  const normalizedArgs = Array.isArray(cliArgs) ? [...cliArgs] : [];
  const nextEnv = { ...env };
  let overrideConfigPath = null;

  if (normalizedArgs[0] !== "build") {
    return {
      args: normalizedArgs,
      env: nextEnv,
      overrideConfigPath,
      shouldLoadDefaultKey: false,
      disableUpdaterArtifacts: false,
    };
  }

  const updaterSigningPlan = detectUpdaterSigningPlan({
    env,
    homeDir,
    existsSyncRef,
  });

  if (updaterSigningPlan.shouldLoadDefaultKey) {
    nextEnv.TAURI_SIGNING_PRIVATE_KEY = readFileSyncRef(
      updaterSigningPlan.defaultKeyPath,
      "utf8",
    );
    if (!("TAURI_SIGNING_PRIVATE_KEY_PASSWORD" in nextEnv)) {
      nextEnv.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "";
    }
  }

  const disableUpdaterArtifacts = !updaterSigningPlan.updaterArtifactsEnabled;
  const hasExplicitConfig = normalizedArgs.includes("--config");

  if (disableUpdaterArtifacts && !hasExplicitConfig) {
    overrideConfigPath = joinTargetPath(tempDir, `mcq-tauri-no-updater-${Date.now()}.json`);
    normalizedArgs.push("--config", overrideConfigPath);
  }

  return {
    args: normalizedArgs,
    env: nextEnv,
    overrideConfigPath,
    shouldLoadDefaultKey: updaterSigningPlan.shouldLoadDefaultKey,
    disableUpdaterArtifacts,
    defaultKeyPath: updaterSigningPlan.defaultKeyPath,
  };
}

function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const cliPath = path.join(repoRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
  const cliArgs = process.argv.slice(2);
  const plan = buildTauriCliExecutionPlan({ cliArgs });

  try {
    if (plan.shouldLoadDefaultKey) {
      console.log(`[tauri] Using local updater key: ${plan.defaultKeyPath}`);
    }

    if (plan.disableUpdaterArtifacts && plan.overrideConfigPath) {
      fs.writeFileSync(
        plan.overrideConfigPath,
        `${JSON.stringify({ bundle: { createUpdaterArtifacts: false } }, null, 2)}\n`,
      );
      console.warn(
        "[tauri] Updater signing key not found. Running build without updater artifacts.",
      );
    }

    const result = spawnSync(process.execPath, [cliPath, ...plan.args], {
      cwd: repoRoot,
      env: plan.env,
      stdio: "inherit",
      shell: false,
    });

    if (result.error) {
      throw result.error;
    }

    process.exit(result.status ?? 1);
  } finally {
    if (plan.overrideConfigPath && fs.existsSync(plan.overrideConfigPath)) {
      fs.rmSync(plan.overrideConfigPath, { force: true });
    }
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const currentModulePath = fileURLToPath(import.meta.url);

if (invokedPath === currentModulePath) {
  main();
}
