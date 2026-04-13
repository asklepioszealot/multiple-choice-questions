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
- Set manager, Google Drive, auth shell ve Supabase sync feature modulleri.
- Cloud sync durumunu gosteren status/retry UX katmani.
- Sync conflict/reconciliation diff paneli.
- `editor-screen` tabanli source-aware set editor deneyimi.
- Set manager icinde toggle ile acilan analytics paneli.
- Desktop updater feature modulu (`src/features/desktop-update`).
- Release artifact naming helper, PowerShell wrapper ve `LATEST_RELEASE_POINTER.txt`.
- GitHub Pages ve `Release Desktop` workflow parity dosyalari.
- Desktop runtime icin native set import ve source write-back smoke kapsami.
- Editor icin validation summary, save gating, soru tasima ve logout/unload dahil daha genis dirty-state korumasi.
- Sync conflict tespiti artik ayni kaynagi `sourcePath -> fileName -> record id` ile eslestirip guvenli merge karar-zarfi uretir; study-state set-id remap ve stale remote `id` temizligi korunur.
- Supabase `mcq_sets` setup dokumani artik `source_path` kolonunu da ekleyip mevcut kurulumlar icin migration fallback'i tarif eder.
- MCQ repo'suna ozel updater key release plan helper'i ve `release:dry-run` komutu.
- Manager icinde sifirdan set acmak icin markdown-first `Yeni set` akisi.

### Changed
- `package.json` scriptleri Vite build, smoke + unit test ve preview akislarini kapsayacak sekilde guncellendi.
- `.gitignore` Playwright ciktilarini ignore edecek sekilde guncellendi.
- `src/core/storage.js` local/session aware hale getirildi.
- `src/app/main.js` ekran gecisi ve set parsing icin yeni cekirdek modullere baglandi.
- Markdown/JSON set parsing mantigi `src/core/set-codec.js` altina tasindi.
- `tools/run-smoke.js` artik shell acmadan process spawn kullaniyor; `[DEP0190]` uyarisi temizlendi.
- Auth sonrasi remote workspace yukleme artik sessiz overwrite yerine conflict karari verebiliyor.
- Editor save akisi artik validation summary ile bloklayici hatalari gosterir, sadece gecerli draftta acilir, `sourcePath` metadatasini korur ve desktop runtime'da kaynak dosyaya geri yazabilir.
- `tools/build-release.ps1` artik Vite build, updater fallback, artifact pointer dosyalari ve flashcards-app seviyesinde naming davranisi ile calisiyor.
- `tools/build-release.ps1` artik `-DryRun` modunda release klasoru yazmadan planlanan isimleri ve updater durumunu raporlayabiliyor.
- `src-tauri/tauri.conf.json`, `Cargo.toml` ve `src-tauri/src/lib.rs` updater/process/dialog plugin zincirine gore guncellendi.
- `ci.yml` build + smoke + unit kalite kapisi olarak guclendirildi.
- Analytics yuzeyi study ekranindan uzak tutulup set manager icinde varsayilan olarak gizli, flashcards-app benzeri panel davranisina cekildi.
- Editor artik yeni set olusturma akisinda bos markdown draft aciyor; kaydedilen yeni setler mevcut local/sync hattina normal kayit gibi dusuyor.
- Sync conflict paneli artik blocking setler icin hangi tarafin daha yeni oldugu, son degisim zamani ve soru/cevap farkini set-bazli gosteriyor.
