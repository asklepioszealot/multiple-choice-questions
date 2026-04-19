import { describe, expect, it } from "vitest";
import {
  buildPwshInvocation,
  normalizeWindowsWorkingDirectory,
  resolvePowerShellScriptPath,
} from "../../tools/run-pwsh-script.mjs";

describe("run-pwsh-script", () => {
  it("removes the Windows extended path prefix from the working directory", () => {
    expect(
      normalizeWindowsWorkingDirectory(
        "\\\\?\\D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence",
      ),
    ).toBe(
      "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence",
    );
  });

  it("keeps a normal working directory unchanged", () => {
    expect(
      normalizeWindowsWorkingDirectory(
        "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence",
      ),
    ).toBe(
      "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence",
    );
  });

  it("builds a pwsh invocation with a normalized cwd and absolute script path", () => {
    const invocation = buildPwshInvocation({
      cwd: "\\\\?\\D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence",
      scriptPath: "./tools/build-release.ps1",
      scriptArgs: ["-NoLegacyCopy"],
    });

    expect(invocation.command).toBe("pwsh");
    expect(invocation.cwd).toBe(
      "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence",
    );
    expect(invocation.args).toEqual([
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence\\tools\\build-release.ps1",
      "-NoLegacyCopy",
    ]);
  });

  it("resolves Windows-style relative script paths without host OS separators leaking in", () => {
    expect(
      resolvePowerShellScriptPath({
        cwd: "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence",
        scriptPath: "./tools/build-release.ps1",
      }),
    ).toBe(
      "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence\\tools\\build-release.ps1",
    );
  });

  it("preserves Windows absolute script paths on non-Windows hosts", () => {
    expect(
      resolvePowerShellScriptPath({
        cwd: "/home/runner/work/mcq",
        scriptPath: "D:\\Git Projelerim\\multiple-choices-test\\tools\\build-release.ps1",
      }),
    ).toBe("D:\\Git Projelerim\\multiple-choices-test\\tools\\build-release.ps1");
  });

  it("passes through dry-run flags for release planning", () => {
    const invocation = buildPwshInvocation({
      cwd: "D:\\Git Projelerim\\multiple-choices-test\\.worktrees\\mcq-foundation-convergence",
      scriptPath: "./tools/build-release.ps1",
      scriptArgs: ["-NoLegacyCopy", "-DryRun"],
    });

    expect(invocation.args.slice(-2)).toEqual(["-NoLegacyCopy", "-DryRun"]);
  });
});
