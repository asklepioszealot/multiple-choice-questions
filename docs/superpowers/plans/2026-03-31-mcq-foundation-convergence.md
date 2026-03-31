# MCQ Foundation Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Multiple Choice Questions onto the same foundation layer as `flashcards-app` without changing MCQ semantics or breaking the current smoke-tested study flow.

**Architecture:** Introduce Vite/Vitest, generated build/runtime metadata, a richer storage contract, and a dedicated `set-codec` module first. Then split the monolithic app entry into a minimal app shell that delegates parsing and state responsibilities to focused modules while keeping the current UI behavior intact.

**Tech Stack:** Vite, Vitest, Playwright, Tauri, plain ES modules, local/session storage

---

### Task 0: Prepare Isolated Workspace

**Files:**
- Modify: `D:\Git Projelerim\multiple-choices-test\.gitignore`

- [ ] **Step 1: Add a hidden worktree directory to gitignore**

```gitignore
# Local worktrees
.worktrees/
```

- [ ] **Step 2: Verify the ignore rule is active**

Run: `git check-ignore .worktrees`  
Expected: `.worktrees` is reported as ignored

- [ ] **Step 3: Create the worktree for this slice**

Run: `git worktree add .worktrees/mcq-foundation-convergence -b codex/mcq-foundation-convergence`  
Expected: New worktree is created on branch `codex/mcq-foundation-convergence`

- [ ] **Step 4: Install dependencies inside the worktree**

Run: `npm install`  
Expected: lockfile and modules are in sync with the worktree checkout

- [ ] **Step 5: Verify the current baseline before edits**

Run: `npm run test:smoke`  
Expected: existing smoke suite passes before any refactor starts

- [ ] **Step 6: Commit the workspace-prep change**

```bash
git add .gitignore
git commit -m "chore: ignore local worktrees"
```

### Task 1: Replace the Static Build with Vite + Vitest

**Files:**
- Create: `D:\Git Projelerim\multiple-choices-test\vite.config.mjs`
- Create: `D:\Git Projelerim\multiple-choices-test\vitest.config.js`
- Create: `D:\Git Projelerim\multiple-choices-test\tools\run-smoke.js`
- Create: `D:\Git Projelerim\multiple-choices-test\src\generated\build-info.js`
- Create: `D:\Git Projelerim\multiple-choices-test\src\generated\runtime-config.js`
- Modify: `D:\Git Projelerim\multiple-choices-test\package.json`
- Modify: `D:\Git Projelerim\multiple-choices-test\playwright.config.js`
- Test: `D:\Git Projelerim\multiple-choices-test\tests\smoke\app-smoke.spec.js`

- [ ] **Step 1: Write the failing unit-test harness expectation**

```javascript
// tests/unit/build-info.test.js
import { describe, expect, it } from "vitest";
import { BUILD_INFO } from "../../src/generated/build-info.js";

describe("BUILD_INFO", () => {
  it("provides safe development defaults", () => {
    expect(BUILD_INFO.version).toBeTypeOf("string");
    expect(BUILD_INFO.commit).toBeTypeOf("string");
    expect(BUILD_INFO.source).toBe("vite");
  });
});
```

- [ ] **Step 2: Run the test and verify the harness fails because Vitest/config files do not exist yet**

Run: `npx vitest run tests/unit/build-info.test.js`  
Expected: FAIL with a config or module resolution error

- [ ] **Step 3: Add the Vite/Vitest toolchain and scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dist": "npm run build",
    "preview": "vite preview",
    "serve:dist": "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    "test:smoke": "node ./tools/run-smoke.js",
    "test:smoke:headed": "node ./tools/run-smoke.js --headed",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test": "npm run test:smoke && npm run test:unit"
  },
  "devDependencies": {
    "jsdom": "^29.0.1",
    "vite": "^8.0.3",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 4: Add the generated module fallbacks and smoke runner**

```javascript
// src/generated/build-info.js
const DEFAULT_BUILD_INFO = Object.freeze({
  version: "unknown",
  commit: "nogit",
  builtAt: "",
  buildId: "dev",
  source: "vite",
});

export const BUILD_INFO = Object.freeze(
  typeof __BUILD_INFO__ !== "undefined" && __BUILD_INFO__ && typeof __BUILD_INFO__ === "object"
    ? __BUILD_INFO__
    : DEFAULT_BUILD_INFO,
);
```

```javascript
// src/generated/runtime-config.js
export const APP_CONFIG = Object.freeze(
  typeof __APP_CONFIG__ !== "undefined" && __APP_CONFIG__ && typeof __APP_CONFIG__ === "object"
    ? __APP_CONFIG__
    : {},
);
```

```javascript
// tools/run-smoke.js
const { spawnSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, FORCE_MOCK_AUTH: "1", ...env },
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npmCommand, ["run", "build:dist"]);
run(npxCommand, ["playwright", "test", ...process.argv.slice(2)]);
```

- [ ] **Step 5: Add Vite/Vitest configuration**

```javascript
// vitest.config.js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.{test,spec}.js"],
  },
});
```

```javascript
// vite.config.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

function makeBuildInfo() {
  return {
    version: "unknown",
    commit: "nogit",
    builtAt: new Date().toISOString(),
    buildId: `dev-${Date.now()}`,
    source: "vite",
  };
}

function makeRuntimeConfig(env = process.env) {
  return {
    supabaseUrl: env.SUPABASE_URL || "",
    supabaseAnonKey: env.SUPABASE_ANON_KEY || "",
    enableDemoAuth: env.ENABLE_DEMO_AUTH !== "0",
    driveClientId: env.DRIVE_CLIENT_ID || "",
    driveApiKey: env.DRIVE_API_KEY || "",
    driveAppId: env.DRIVE_APP_ID || "",
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, repoRoot, "") };
  return {
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    define: {
      __BUILD_INFO__: JSON.stringify(makeBuildInfo()),
      __APP_CONFIG__: JSON.stringify(makeRuntimeConfig(env)),
    },
  };
});
```

- [ ] **Step 6: Re-run the focused unit test**

Run: `npx vitest run tests/unit/build-info.test.js`  
Expected: PASS

- [ ] **Step 7: Run smoke on the Vite-backed output**

Run: `npm run test:smoke`  
Expected: smoke suite still passes against the Vite build

- [ ] **Step 8: Commit the toolchain convergence**

```bash
git add package.json package-lock.json vite.config.mjs vitest.config.js tools/run-smoke.js src/generated/build-info.js src/generated/runtime-config.js tests/unit/build-info.test.js
git commit -m "build: adopt vite and vitest foundations"
```

### Task 2: Add Runtime Config as a First-Class Core Module

**Files:**
- Create: `D:\Git Projelerim\multiple-choices-test\src\core\runtime-config.js`
- Create: `D:\Git Projelerim\multiple-choices-test\tests\unit\runtime-config.test.js`
- Modify: `D:\Git Projelerim\multiple-choices-test\vite.config.mjs`

- [ ] **Step 1: Write the failing runtime-config tests**

```javascript
import { describe, expect, it } from "vitest";
import { getRuntimeConfig, hasDriveConfig, hasSupabaseConfig } from "../../src/core/runtime-config.js";

describe("runtime config", () => {
  it("falls back to demo auth defaults", () => {
    const config = getRuntimeConfig();
    expect(config.enableDemoAuth).toBe(true);
    expect(hasSupabaseConfig()).toBe(false);
    expect(hasDriveConfig()).toBe(false);
  });
});
```

- [ ] **Step 2: Verify the test fails because the module does not exist**

Run: `npx vitest run tests/unit/runtime-config.test.js`  
Expected: FAIL with module not found

- [ ] **Step 3: Implement the runtime-config module**

```javascript
import { APP_CONFIG } from "../generated/runtime-config.js";

const DEFAULT_CONFIG = Object.freeze({
  supabaseUrl: "",
  supabaseAnonKey: "",
  authMode: "mock",
  enableDemoAuth: true,
  driveClientId: "",
  driveApiKey: "",
  driveAppId: "",
});

export function getRuntimeConfig() {
  const config = {
    ...DEFAULT_CONFIG,
    ...APP_CONFIG,
  };

  return Object.freeze({
    ...config,
    authMode: config.supabaseUrl && config.supabaseAnonKey ? "supabase" : "mock",
  });
}

export function hasSupabaseConfig() {
  const config = getRuntimeConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function hasDriveConfig() {
  const config = getRuntimeConfig();
  return Boolean(config.driveClientId && config.driveApiKey && config.driveAppId);
}
```

- [ ] **Step 4: Extend Vite config to read `runtime-config.local.json` safely**

```javascript
function readLocalRuntimeConfig() {
  const configPath = path.join(repoRoot, "runtime-config.local.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}
```

- [ ] **Step 5: Re-run the focused runtime-config test**

Run: `npx vitest run tests/unit/runtime-config.test.js`  
Expected: PASS

- [ ] **Step 6: Commit the runtime-config slice**

```bash
git add src/core/runtime-config.js vite.config.mjs tests/unit/runtime-config.test.js
git commit -m "feat: add runtime config contract"
```

### Task 3: Upgrade Storage to Local + Session Semantics

**Files:**
- Modify: `D:\Git Projelerim\multiple-choices-test\src\core\storage.js`
- Create: `D:\Git Projelerim\multiple-choices-test\tests\unit\storage.test.js`

- [ ] **Step 1: Write the failing storage tests**

```javascript
import { describe, expect, it, beforeEach } from "vitest";
import { AppStorage } from "../../src/core/storage.js";

describe("AppStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores persistent values in localStorage", () => {
    AppStorage.setLocalItem("mc_user", "alice");
    expect(AppStorage.getLocalItem("mc_user")).toBe("alice");
  });

  it("stores temporary values in sessionStorage", () => {
    AppStorage.setSessionItem("mc_session_user", "bob");
    expect(AppStorage.getSessionItem("mc_session_user")).toBe("bob");
    expect(AppStorage.getLocalItem("mc_session_user")).toBeNull();
  });
});
```

- [ ] **Step 2: Verify the test fails against the current local-only API**

Run: `npx vitest run tests/unit/storage.test.js`  
Expected: FAIL with missing method errors

- [ ] **Step 3: Implement the expanded storage adapter**

```javascript
const EMPTY_STORAGE = Object.freeze({
  getItem() { return null; },
  setItem() {},
  removeItem() {},
});

const localStorageRef = globalThis.localStorage ?? EMPTY_STORAGE;
const sessionStorageRef = globalThis.sessionStorage ?? EMPTY_STORAGE;

function getItem(key) { return localStorageRef.getItem(key); }
function setItem(key, value) { localStorageRef.setItem(key, value); }
function removeItem(key) { localStorageRef.removeItem(key); }
function getLocalItem(key) { return localStorageRef.getItem(key); }
function setLocalItem(key, value) { localStorageRef.setItem(key, value); }
function removeLocalItem(key) { localStorageRef.removeItem(key); }
function getSessionItem(key) { return sessionStorageRef.getItem(key); }
function setSessionItem(key, value) { sessionStorageRef.setItem(key, value); }
function removeSessionItem(key) { sessionStorageRef.removeItem(key); }

export const AppStorage = Object.freeze({
  getItem,
  setItem,
  removeItem,
  getLocalItem,
  setLocalItem,
  removeLocalItem,
  getSessionItem,
  setSessionItem,
  removeSessionItem,
});
```

- [ ] **Step 4: Re-run the focused storage test**

Run: `npx vitest run tests/unit/storage.test.js`  
Expected: PASS

- [ ] **Step 5: Commit the storage abstraction change**

```bash
git add src/core/storage.js tests/unit/storage.test.js
git commit -m "feat: add session-aware storage adapter"
```

### Task 4: Extract Parsing and Normalization into `set-codec`

**Files:**
- Create: `D:\Git Projelerim\multiple-choices-test\src\core\set-codec.js`
- Create: `D:\Git Projelerim\multiple-choices-test\tests\unit\set-codec.test.js`
- Modify: `D:\Git Projelerim\multiple-choices-test\src\app\main.js`

- [ ] **Step 1: Write the failing set-codec tests**

```javascript
import { describe, expect, it } from "vitest";
import { normalizeQuestions, parseMarkdownToJSON } from "../../src/core/set-codec.js";

describe("set-codec", () => {
  it("normalizes questions into canonical MCQ shape", () => {
    const questions = normalizeQuestions({
      questions: [{ q: "Soru", options: ["A"], correct: 0, explanation: "", subject: "" }],
    });

    expect(questions[0]).toEqual({
      q: "Soru",
      options: ["A"],
      correct: 0,
      explanation: "",
      subject: "Genel",
      id: null,
    });
  });

  it("parses markdown into a set payload", () => {
    const parsed = parseMarkdownToJSON("## Demo\n\nSoru: Ornek?\nA) Evet\nB) Hayir\nDoğru Cevap: A\nAçıklama: Aciklama", "demo.md");
    expect(parsed.setName).toBe("demo");
    expect(parsed.questions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verify the test fails because `set-codec.js` does not exist**

Run: `npx vitest run tests/unit/set-codec.test.js`  
Expected: FAIL with module not found

- [ ] **Step 3: Extract the parser and normalizer into the codec module**

```javascript
// src/core/set-codec.js
function processFormatting(text) {
  return text
    .replace(/==([^=]+)==/g, '<strong class="highlight-critical">$1</strong>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^(?:> )?⚠️(.*)$/gm, '<span class="highlight-important">⚠️$1</span>');
}

export function parseMarkdownToJSON(content, fileName) {
  // copy the current markdown parser body from src/app/main.js exactly,
  // keeping heading, option, answer, and explanation parsing behavior unchanged
}

export function normalizeQuestions(data) {
  return Array.isArray(data.questions)
    ? data.questions
        .filter((question) => question && typeof question === "object" && !Array.isArray(question))
        .map((question) => ({
          q: typeof question.q === "string" ? question.q : "",
          options: Array.isArray(question.options) ? question.options.filter((option) => typeof option === "string") : [],
          correct: Number.isInteger(question.correct) ? question.correct : -1,
          explanation: typeof question.explanation === "string" ? question.explanation : "",
          subject: typeof question.subject === "string" && question.subject.trim() ? question.subject : "Genel",
          id: typeof question.id === "string" || typeof question.id === "number" ? question.id : null,
        }))
    : [];
}
```

- [ ] **Step 4: Update the monolith entry to import the new helpers**

```javascript
import { normalizeQuestions, parseMarkdownToJSON } from "../core/set-codec.js";
```

- [ ] **Step 5: Re-run the focused codec tests**

Run: `npx vitest run tests/unit/set-codec.test.js`  
Expected: PASS

- [ ] **Step 6: Run smoke to confirm no parsing regressions**

Run: `npm run test:smoke`  
Expected: PASS

- [ ] **Step 7: Commit the codec extraction**

```bash
git add src/core/set-codec.js src/app/main.js tests/unit/set-codec.test.js
git commit -m "refactor: extract mcq set codec"
```

### Task 5: Introduce Minimal App Shell Modules

**Files:**
- Create: `D:\Git Projelerim\multiple-choices-test\src\app\bootstrap.js`
- Create: `D:\Git Projelerim\multiple-choices-test\src\app\screen.js`
- Create: `D:\Git Projelerim\multiple-choices-test\src\app\state.js`
- Create: `D:\Git Projelerim\multiple-choices-test\tests\unit\screen.test.js`
- Modify: `D:\Git Projelerim\multiple-choices-test\src\app\main.js`
- Test: `D:\Git Projelerim\multiple-choices-test\tests\smoke\app-smoke.spec.js`

- [ ] **Step 1: Write a failing unit test for the new screen helper**

```javascript
import { describe, expect, it } from "vitest";
import { showScreen } from "../../src/app/screen.js";

describe("showScreen", () => {
  it("shows the manager and hides the app container when requested", () => {
    document.body.innerHTML = `
      <section id="set-manager" class="hidden"></section>
      <section id="auth-screen" class="hidden"></section>
      <section id="editor-screen" class="hidden"></section>
      <main id="app-container" style="display:block"></main>
    `;

    showScreen("manager");

    expect(document.getElementById("set-manager").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("app-container").style.display).toBe("none");
  });
});
```

- [ ] **Step 2: Verify the screen test fails because the helper does not exist**

Run: `npx vitest run tests/unit/screen.test.js`  
Expected: FAIL with module not found

- [ ] **Step 3: Add a minimal shared app-state module**

```javascript
export let storage = null;
export let currentScreen = "manager";

export function setStorage(value) {
  storage = value;
}

export function setCurrentScreen(value) {
  currentScreen = value;
}
```

- [ ] **Step 4: Add the screen helper and bootstrap wrapper**

```javascript
// src/app/screen.js
import { setCurrentScreen } from "./state.js";

export function showScreen(name) {
  setCurrentScreen(name);
  document.getElementById("auth-screen")?.classList.add("hidden");
  document.getElementById("set-manager")?.classList.add("hidden");
  document.getElementById("editor-screen")?.classList.add("hidden");
  const appContainer = document.getElementById("app-container");
  if (appContainer) appContainer.style.display = "none";
  if (name === "auth") document.getElementById("auth-screen")?.classList.remove("hidden");
  if (name === "manager") document.getElementById("set-manager")?.classList.remove("hidden");
  if (name === "editor") document.getElementById("editor-screen")?.classList.remove("hidden");
  if (name === "study" && appContainer) appContainer.style.display = "block";
}
```

```javascript
// src/app/bootstrap.js
import { AppStorage } from "../core/storage.js";
import { setStorage } from "./state.js";

export function bootstrap() {
  setStorage(AppStorage);
  return AppStorage;
}
```

- [ ] **Step 5: Shrink the entrypoint into a real bootstrap entry**

```javascript
// src/app/main.js
import { bootstrap } from "./bootstrap.js";
import { showScreen } from "./screen.js";

const storage = bootstrap();
showScreen("manager");

// keep the existing study and set-manager behavior in this file for now,
// but switch direct screen toggles to showScreen(...) and use `storage`
// instead of reaching for window.AppStorage.
```

- [ ] **Step 6: Re-run the focused screen unit test**

Run: `npx vitest run tests/unit/screen.test.js`  
Expected: PASS

- [ ] **Step 7: Run the full phase verification**

Run: `npm run test:smoke`  
Expected: PASS  

Run: `npm run test:unit`  
Expected: PASS

- [ ] **Step 8: Commit the shell split**

```bash
git add src/app/main.js src/app/bootstrap.js src/app/screen.js src/app/state.js tests/unit/screen.test.js
git commit -m "refactor: add app shell modules"
```

### Task 6: Final Verification and Handoff

**Files:**
- Modify: `D:\Git Projelerim\multiple-choices-test\README.md`
- Modify: `D:\Git Projelerim\multiple-choices-test\docs\MODULARIZATION_PLAN.md`
- Modify: `D:\Git Projelerim\multiple-choices-test\CHANGELOG.md`

- [ ] **Step 1: Update docs to describe the new toolchain and module boundaries**

```markdown
- Build pipeline now uses Vite (`npm run build`)
- Smoke tests build via `tools/run-smoke.js`
- Unit tests live under `tests/unit/`
- Parsing moved into `src/core/set-codec.js`
```

- [ ] **Step 2: Run the required repo verification gate**

Run: `npm run test:smoke`  
Expected: PASS

- [ ] **Step 3: Run the stronger slice-specific verification**

Run: `npm run test:unit`  
Expected: PASS

- [ ] **Step 4: Commit the documentation refresh**

```bash
git add README.md docs/MODULARIZATION_PLAN.md CHANGELOG.md
git commit -m "docs: record foundation convergence"
```

- [ ] **Step 5: Summarize the phase exit criteria**

```text
- Vite/Vitest active
- Smoke and unit tests green
- Runtime config module present
- Session-aware storage present
- Set codec extracted
- Minimal app shell established
```
