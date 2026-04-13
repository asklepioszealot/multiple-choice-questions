import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  detectUpdaterSigningPlan,
  resolveMcqUpdaterKeyPath,
} from "./release-plan.mjs";

export function resolveLocalUpdaterKeyPath(homeDir = os.homedir()) {
  return resolveMcqUpdaterKeyPath(homeDir);
}

export function buildDesktopBuildPlan({
  env = process.env,
  homeDir = os.homedir(),
  tempDir = os.tmpdir(),
  existsSyncRef = fs.existsSync,
} = {}) {
  const updaterSigningPlan = detectUpdaterSigningPlan({
    env,
    homeDir,
    existsSyncRef,
  });
  const defaultKeyPath = updaterSigningPlan.defaultKeyPath;
  const shouldLoadDefaultKey = updaterSigningPlan.shouldLoadDefaultKey;
  const disableUpdaterArtifacts = !updaterSigningPlan.updaterArtifactsEnabled;
  const overrideConfigPath = disableUpdaterArtifacts
    ? path.join(tempDir, `mcq-tauri-no-updater-${Date.now()}.json`)
    : null;
  const args = ["build", "--bundles", "nsis"];

  if (overrideConfigPath) {
    args.push("--config", overrideConfigPath);
  }

  return {
    args,
    defaultKeyPath,
    disableUpdaterArtifacts,
    keySource: updaterSigningPlan.keySource,
    overrideConfigPath,
    shouldLoadDefaultKey,
  };
}

function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const cliPath = path.join(repoRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
  const plan = buildDesktopBuildPlan();
  const env = { ...process.env };

  try {
    if (plan.shouldLoadDefaultKey) {
      env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(plan.defaultKeyPath, "utf8");
      console.log(`[build:desktop] Using local updater key: ${plan.defaultKeyPath}`);
    }

    if (plan.disableUpdaterArtifacts && plan.overrideConfigPath) {
      fs.writeFileSync(
        plan.overrideConfigPath,
        `${JSON.stringify({ bundle: { createUpdaterArtifacts: false } }, null, 2)}\n`,
      );
      console.warn(
        "[build:desktop] Updater signing key not found. Building desktop app without updater artifacts.",
      );
    }

    const result = spawnSync(process.execPath, [cliPath, ...plan.args], {
      cwd: repoRoot,
      env,
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
