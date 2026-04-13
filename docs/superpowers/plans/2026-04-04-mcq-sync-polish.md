# MCQ Sync Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the smoke-runner deprecation warning, add visible sync status UX for Supabase-backed sessions, and refresh plan/TODO docs to match the current convergence state.

**Architecture:** Keep the fix small and local. `tools/run-smoke.js` is corrected at the process boundary, while sync UX is layered onto the existing auth/session bar and driven by the already-centralized remote orchestration inside `src/app/main.js`.

**Tech Stack:** Node.js child process APIs, Vite, Vitest, Playwright, plain ES modules, Supabase web client

---

### Task 1: Remove `DEP0190` From The Smoke Runner

**Files:**
- Modify: `D:\Git Projelerim\multiple-choices-test\.worktrees\mcq-foundation-convergence\tools\run-smoke.js`
- Test: `D:\Git Projelerim\multiple-choices-test\.worktrees\mcq-foundation-convergence\tests\unit\run-smoke.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, expect, it } from "vitest";
import { buildSpawnOptions } from "../../tools/run-smoke.js";

describe("run-smoke spawn options", () => {
  it("does not require shell mode on Windows command shims", () => {
    expect(buildSpawnOptions({ FORCE_MOCK_AUTH: "1" }).shell).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/run-smoke.test.js`
Expected: FAIL because `buildSpawnOptions` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```javascript
function buildSpawnOptions(env = {}) {
  return {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, FORCE_MOCK_AUTH: "1", ...env },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/run-smoke.test.js`
Expected: PASS

### Task 2: Add Sync Status UX

**Files:**
- Modify: `D:\Git Projelerim\multiple-choices-test\.worktrees\mcq-foundation-convergence\index.html`
- Modify: `D:\Git Projelerim\multiple-choices-test\.worktrees\mcq-foundation-convergence\src\app\main.js`
- Test: `D:\Git Projelerim\multiple-choices-test\.worktrees\mcq-foundation-convergence\tests\unit\sync-status.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, expect, it } from "vitest";
import { createSyncStatusController } from "../../src/app/sync-status.js";

describe("sync status controller", () => {
  it("transitions from syncing to synced", () => {
    const controller = createSyncStatusController();
    controller.markSyncing("save");
    controller.markSynced("save");
    expect(controller.getSnapshot().state).toBe("synced");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/sync-status.test.js`
Expected: FAIL because the controller does not exist yet

- [ ] **Step 3: Write minimal implementation**

```javascript
function createSyncStatusController() {
  let snapshot = { state: "idle", detail: "", canRetry: false };
  return {
    markSyncing(detail = "") {
      snapshot = { state: "syncing", detail, canRetry: false };
    },
    markSynced(detail = "") {
      snapshot = { state: "synced", detail, canRetry: false };
    },
    markError(detail = "") {
      snapshot = { state: "error", detail, canRetry: true };
    },
    getSnapshot() {
      return snapshot;
    },
  };
}
```

- [ ] **Step 4: Wire the UI and orchestration**

```javascript
syncStatus.markSyncing("workspace");
// remote load/save
syncStatus.markSynced("workspace");
// on failure
syncStatus.markError(error.message);
```

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run tests/unit/sync-status.test.js`
Expected: PASS

### Task 3: Refresh The Project Plan Documents

**Files:**
- Modify: `D:\Git Projelerim\multiple-choices-test\.worktrees\mcq-foundation-convergence\docs\MODULARIZATION_PLAN.md`
- Modify: `D:\Git Projelerim\multiple-choices-test\.worktrees\mcq-foundation-convergence\CHANGELOG.md`

- [ ] **Step 1: Update the completed slices**

```markdown
- set-manager extraction complete
- google-drive extraction complete
- auth shell complete
- supabase sync foundation complete
```

- [ ] **Step 2: Update the next priorities**

```markdown
- sync UX/polish
- editor feature
- analytics surface
- release/docs parity
```

- [ ] **Step 3: Verify the docs match the codebase**

Run: `rg -n "set-manager|google-drive|supabase|sync UX" docs`
Expected: Updated docs reflect the current state

### Task 4: Full Verification

**Files:**
- Test: `D:\Git Projelerim\multiple-choices-test\.worktrees\mcq-foundation-convergence\tests\unit`
- Test: `D:\Git Projelerim\multiple-choices-test\.worktrees\mcq-foundation-convergence\tests\smoke`

- [ ] **Step 1: Run unit tests**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 2: Run smoke tests**

Run: `npm run test:smoke`
Expected: PASS without the `[DEP0190]` deprecation warning

- [ ] **Step 3: Run full suite**

Run: `npm test`
Expected: PASS

