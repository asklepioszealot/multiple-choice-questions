# MCQ <-> Flashcards Convergence Status

Date: 2026-04-19

## Current Position

- Phase 0 is complete.
- Phase 1 is effectively complete for the current convergence target.
- Phase 2 is in progress and now has working APKG parity foundations on both repos.
- Phase 3 has not started as a dedicated pass yet.

## Stable Operational Defaults

- `flashcards-app` default preview/smoke port: `4173`
- `multiple-choices-test` default preview/smoke port: `4174`

This split is now intentional so both repos can be open and smoke-tested side by side without Playwright reusing the wrong preview server.

## Completed So Far

- MCQ smoke baseline was repaired and brought back to green.
- MCQ preset-based theme contract, shared constants/utils split, packaged security core, CSP hardening, and delegated event wiring were completed.
- MCQ local `.apkg` import was implemented.
- MCQ Google Drive binary `.apkg` import path was implemented.
- Flashcards CSP/WASM path was hardened for browser APKG import.
- Flashcards runtime config handling was fixed so runtime overrides can win over build-time config when needed in smoke/test flows.
- Flashcards auth bootstrap was hardened so auth actions are bound eagerly instead of depending on a lazy race.
- MCQ APKG import now preserves safe image/audio media through sanitized hydration.
- MCQ APKG media hydration now has both unit coverage and browser smoke coverage.

## Verification Snapshot

- `flashcards-app`: `npm run test:smoke` passed after recovery fixes.
- `multiple-choices-test`: `npm test` passed after APKG media hydration work.

## Remaining Work

### Phase 2

- Decide whether MCQ needs a real product equivalent for Flashcards editor media upload depth, or whether current APKG hydration coverage is sufficient for convergence.
- Review whether MCQ needs richer sanitize/export handling beyond current safe image/audio hydration.
- Re-check editor/history/toolbar parity and identify only the parts that have a meaningful MCQ equivalent.

### Phase 3

- Run a fresh contract-based comparison across both repos:
  - theme API
  - shared constant/util naming
  - runtime-config conventions
  - security surface
  - smoke helper patterns
  - release/test discipline
- Apply small back-alignment patches to `flashcards-app` only where the contract should truly be shared.

## Suggested Next Slice

The highest-signal next slice is a targeted Phase 2 review of editor/media parity:

- what Flashcards editor media flow uniquely provides
- what the MCQ equivalent should be
- which parts should be ported
- which parts should remain intentionally product-specific
