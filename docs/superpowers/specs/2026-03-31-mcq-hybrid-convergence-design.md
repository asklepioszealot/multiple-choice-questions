# Multiple Choice Questions Hybrid Convergence Design

**Status:** Proposed baseline derived from the user's convergence brief and current repo audit  
**Date:** 2026-03-31  
**Primary reference:** `flashcards-app` change wave from 2026-03-26 through 2026-03-31, adapted to MCQ semantics

## Goal

Keep the repo slug and visible product name as **Multiple Choice Questions**, but converge the product toward the same architectural maturity as `flashcards-app`: modular screen-based app shell, Vite/Vitest toolchain, runtime config, richer editor workflow, online-capable auth/sync, GitHub Pages web delivery, and a cleaner desktop release pipeline.

This is not a flashcard clone. The MCQ identity stays intact:

- Question-first study flow remains the primary learning model.
- Existing `.json`, `.md`, and `.txt` set formats remain backward compatible.
- Google Drive import and offline/local-first usage remain supported.
- New auth, sync, analytics, and editor flows become first-class platform capabilities around the MCQ experience.

## Current State Snapshot

Repository inspection shows a useful but still transitional baseline:

- [`package.json`](D:\Git Projelerim\multiple-choices-test\package.json) is still pre-Vite and smoke-test only.
- [`build.mjs`](D:\Git Projelerim\multiple-choices-test\build.mjs) copies static files into `dist/` instead of producing a Vite bundle.
- [`src/app/main.js`](D:\Git Projelerim\multiple-choices-test\src\app\main.js) is a large monolith containing parsing, storage, study flow, fullscreen, and Google Drive behavior.
- [`src/core/storage.js`](D:\Git Projelerim\multiple-choices-test\src\core\storage.js) exposes localStorage only; there is no session-aware abstraction yet.
- Tests are smoke-only under [`tests/smoke/app-smoke.spec.js`](D:\Git Projelerim\multiple-choices-test\tests\smoke\app-smoke.spec.js); unit coverage is absent.
- The repo already has Tauri packaging and a release script, but not the richer runtime/build metadata and web deployment contract used by `flashcards-app`.

The reference repo already has the target shape:

- Vite/Vitest toolchain and generated build/runtime metadata.
- Modular app shell under `src/app`, `src/core`, `src/features`, `src/shared`, and `src/ui`.
- Runtime-config driven Supabase and Google Drive setup.
- Editor, analytics, auth, desktop update, and study-state modules separated by responsibility.

## Recommended Delivery Approach

### Option A: Big-bang parity rewrite

Replace the MCQ app structure with the `flashcards-app` layout in one pass, then patch semantics afterward.

- Pros: Fastest path to visual similarity.
- Cons: Highest regression risk, weakest data-migration story, and poor fit for TDD.

### Option B: UI-first convergence

Build auth/set-manager/editor screens first and backfill the tooling, storage, and parser contracts later.

- Pros: Early visible progress.
- Cons: Locks UI to unstable foundations and creates rework in tests, runtime config, and save flows.

### Option C: Foundation-first convergence (recommended)

First align build/test/runtime/storage contracts, then extract the monolith into stable modules, then add hybrid auth/sync/editor capabilities on top.

- Pros: Best regression control, cleanest migration story, strongest TDD fit, and easiest way to keep smoke coverage green throughout.
- Cons: The first milestone is more architectural than flashy.

This design chooses **Option C**.

## Product Experience Target

The future-state user journey is:

1. User lands on `auth-screen` and either signs in, enters demo mode, or resumes a remembered session.
2. User arrives at `set-manager`, sees account state, set inventory, analytics summary, import/sync state, and bulk actions.
3. User opens `study-screen` to solve questions with strong fullscreen support, progress continuity, answer lock, auto-advance, and duplicate-question isolation.
4. User opens `editor-screen` to visually edit questions, switch to raw code, manage subjects/media, and export or save back to the current source.

This is a **future-state journey map** for a hybrid medical study app:

- **Onboarding:** authenticate or enter demo mode without losing offline access.
- **Regular use:** select/import sets, continue from last question, switch between manager and study without drift.
- **Advanced use:** edit or relink sources, sync progress, reimport uploaded sets without erasing history.

## UX Direction

UI guidance is adapted from the requested UI/UX skills and should inform implementation, not block it:

- Visual style: accessible, ethical, high-contrast, keyboard-friendly.
- Palette direction: medical teal with green CTAs rather than generic purple gradients.
- Suggested primary pair: `#0891B2` and `#22D3EE`; CTA accent: `#22C55E`.
- Typography direction: `Figtree` for headings and `Noto Sans` for body text.
- Interaction rules: visible focus rings, reduced-motion respect, 44x44 touch targets, semantic icons, no motion-heavy decoration.

These should become CSS variables/tokens under `src/ui/theme.js` and related theme helpers rather than one-off inline styling.

## Target Architecture

The target file map for MCQ should mirror the reference architecture while preserving MCQ-specific naming and behavior:

```text
src/
  app/
    main.js
    bootstrap.js
    screen.js
    state.js
  core/
    storage.js
    platform-adapter.js
    runtime-config.js
    set-codec.js
    security.js
  features/
    analytics/
    auth/
    desktop-update/
    editor/
    google-drive/
    set-manager/
    study/
    study-state/
  generated/
    build-info.js
    runtime-config.js
  shared/
    constants.js
    utils.js
  ui/
    icons.js
    theme.js
```

Key adaptation rule: structure should converge to `flashcards-app`, but MCQ-specific logic must not be renamed into flashcard-centric concepts.

Examples:

- `questions`, `options`, `correct`, and `explanation` stay canonical.
- Study modules may internally schedule or persist progress, but the user-facing model remains question solving, not card flipping.
- Editor modules must support MCQ option arrays and answer indices instead of flashcard front/back pairs.

## Runtime Configuration Contract

The app must read runtime config from generated build-time definitions plus optional local overrides.

Required public contract:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ENABLE_DEMO_AUTH`
- `DRIVE_CLIENT_ID`
- `DRIVE_API_KEY`
- `DRIVE_APP_ID`

Behavior rules:

- `runtime-config.local.json` may override missing env values for local development.
- If Supabase config is absent, auth mode falls back to demo/mock.
- Demo auth remains available unless explicitly disabled.
- Drive integration is enabled only when all required Drive fields exist.

## Data and Parsing Contract

The canonical MCQ set shape remains:

```json
{
  "setName": "Set name",
  "questions": [
    {
      "q": "Question text",
      "options": ["A", "B", "C", "D", "E"],
      "correct": 0,
      "explanation": "Explanation",
      "subject": "Topic"
    }
  ]
}
```

`src/core/set-codec.js` becomes the only source of truth for:

- JSON parsing and normalization
- Markdown/text parsing
- serialize/export helpers
- roundtrip guarantees for editor save/export flows
- legacy field normalization and stable question identity helpers

## Storage, Session, and Migration Model

Storage behavior must become explicit instead of incidental:

- `localStorage` continues to hold long-lived local data.
- `sessionStorage` is introduced for remember-me off flows and temporary auth/session state.
- The storage API should expose `getLocalItem`, `setLocalItem`, `getSessionItem`, and related helpers.
- Legacy local keys must migrate forward without data loss.
- Existing progress keyed with old `mc_...` identifiers must still restore into the new canonical study-state contract.

## Delivery Breakdown

The original brief spans several semi-independent subsystems, so implementation should be broken into these subprojects:

1. **Foundation convergence**
   - Vite/Vitest/build metadata/runtime config
   - storage abstraction
   - set-codec extraction
   - first shell split from the monolith
2. **Core study modularization**
   - study, study-state, fullscreen, answer lock, auto-advance, duplicate isolation, resume/reset migration
3. **Hybrid shell**
   - auth-screen, set-manager, analytics surface, theme controls, offline demo flow
4. **Online v1**
   - Supabase auth, user-linked set/progress sync, browser save/relink, local fallback
5. **Rich editor**
   - visual/raw editor, toolbar/media, export/save-back, source-aware persistence
6. **Delivery maturity**
   - Pages workflow, desktop release parity, artifact naming, docs and migration notes

Only the first subproject should be planned for immediate execution in this repo pass.

## Testing Strategy

Convergence should remain test-led:

- Every new behavior starts with a failing unit or smoke test.
- Smoke remains the repo-wide gate before publish, push, or release.
- Unit coverage is mandatory for extracted pure logic and tooling modules.

Required smoke coverage to preserve or extend:

- import/upload -> set selection -> start
- resume same question after reload
- manager return -> start -> same question
- answer lock
- auto-advance
- fullscreen transitions
- bulk set selection
- duplicate-question isolation

Required unit coverage to add early:

- runtime config fallback and override
- local/session storage behavior
- set-codec parse/serialize roundtrip
- legacy progress migration helpers
- release artifact naming helpers

## Non-Goals

These are intentionally out of scope unless explicitly requested later:

- Renaming the repository slug
- Renaming the visible product away from **Multiple Choice Questions**
- Automatic version bumps
- Automatic release publishing
- Blindly copying flashcard-specific domain concepts into MCQ modules

## First Execution Slice

The first implementation slice should stop at “foundation convergence” and must be considered successful when:

- `npm run build` and `npm run build:dist` are Vite-backed.
- `npm run test` becomes `npm run test:smoke && npm run test:unit`.
- `src/core/storage.js` supports both local and session storage semantics.
- `src/core/set-codec.js` owns parsing/normalization helpers extracted from the monolith.
- `src/app/{main,bootstrap,screen,state}.js` exists and runs the current app without user-visible regressions.
- Existing smoke tests still pass, and new unit tests cover the extracted contracts.

This slice creates the floor that all later auth, sync, editor, and deployment work depends on.
