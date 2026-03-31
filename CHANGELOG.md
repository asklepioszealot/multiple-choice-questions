# Changelog

Bu dosya [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) formatina gore tutulur.

## [Unreleased]

### Added
- Playwright smoke test altyapisi (`playwright.config.js`, `tests/smoke`).
- Buyume icin moduler klasor iskeleti (`src/core`, `src/features`, `src/ui`, `src/shared`).
- Dokumantasyon: `docs/RELEASE_CHECKLIST.md`, `docs/MODULARIZATION_PLAN.md`.
- Vite/Vitest tabani (`vite.config.mjs`, `vitest.config.js`, `tools/run-smoke.js`, `tests/unit`).
- Build/runtime fallback modulleri (`src/generated/build-info.js`, `src/generated/runtime-config.js`).
- Yeni app shell dosyalari (`src/app/bootstrap.js`, `src/app/screen.js`, `src/app/state.js`).
- Tasarim ve uygulama planlari (`docs/superpowers/specs`, `docs/superpowers/plans`).

### Changed
- `package.json` scriptleri Vite build, smoke + unit test ve preview akislarini kapsayacak sekilde guncellendi.
- `.gitignore` Playwright ciktilarini ignore edecek sekilde guncellendi.
- `src/core/storage.js` local/session aware hale getirildi.
- `src/app/main.js` ekran gecisi ve set parsing icin yeni cekirdek modullere baglandi.
- Markdown/JSON set parsing mantigi `src/core/set-codec.js` altina tasindi.
