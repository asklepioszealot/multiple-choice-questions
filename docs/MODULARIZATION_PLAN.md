# Modularization Plan

Bu plan, uygulamayi tek dosya yapisindan adim adim moduler yapiya tasimak icindir.

## Faz 1: Guvenli taban

1. `src/` klasor yapisini olustur.
2. Smoke testleri ekle (`tests/smoke`).
3. Release checklist ve changelog disiplinini aktif et.
4. Vite/Vitest tabanini kur (`vite.config.mjs`, `vitest.config.js`, `tools/run-smoke.js`).
5. Build/runtime fallback modullerini ekle (`src/generated`).

## Faz 2: Dusuk riskli tasima

1. Tema ile ilgili kodu `src/ui/theme.js` altina tasi.
2. Local + session aware storage kabugunu `src/core/storage.js` altina tasi.
3. Markdown/JSON parse ve normalize mantigini `src/core/set-codec.js` altina tasi.
4. Kod tasirken global degisken sayisini azalt.

## Faz 3: Feature bazli ayrim

1. Set manager akisini `src/features/set-manager/` altina tasi.
2. Google Drive akisini `src/features/google-drive/` altina tasi.
3. Auth shell ve Supabase baglantisini moduler hale getir.
4. `src/app/{bootstrap,screen,state}.js` ile uygulama kabugunu guclendir.

## Faz 4: Cloud ve shell olgunlastirma

1. Supabase destekli set/progress sync temelini tamamla.
2. Sync UX/polish katmani ekle.
3. Editor ekranini ve ilgili feature sinirlarini olustur.
4. Analytics surface ve release/docs parity islerini tamamla.
5. Desktop updater ve release parity zincirini flashcards-app seviyesine getir.

## Mevcut Durum

- Vite tabanli `build` ve `build:dist` aktif.
- `test` artik smoke + unit birlesimi olarak calisiyor.
- `src/generated/build-info.js` ve `src/generated/runtime-config.js` eklendi.
- `src/core/storage.js` local/session API'si kazandi.
- `src/core/set-codec.js` monolitten ayrildi.
- `src/app/bootstrap.js`, `src/app/screen.js`, `src/app/state.js` olusturuldu.
- `src/features/set-manager/` extraction tamamladi.
- `src/features/google-drive/` extraction tamamladi.
- `src/features/auth/` demo auth shell ve Supabase-ready auth davranisi kazandi.
- Supabase destekli `mcq_sets` ve `mcq_user_state` sync temeli eklendi.
- Cloud sync durumunu gosteren hafif UX/status katmani eklendi.
- Sync conflict/reconciliation v2 diff ozeti eklendi.
- `editor-screen` artik source-aware codec, validation ve markdown/json roundtrip destegi kazandi.
- Manager artik `Yeni set` ile markdown-first bos draft acip sifirdan set olusturabiliyor.
- Desktop runtime icin native set import ve source-file write-back akisi eklendi.
- Editor icin unsaved-change korumasi, dirty durum rozeti ve hizli soru kopyalama yardimcilari eklendi.
- Sync reconciliation artik flashcards-app'e benzer sekilde once `sourcePath`, sonra `fileName` kimligiyle set eslestirip gereksiz conflictleri azaltir.
- Manager icinde flashcards-app benzeri, varsayilan olarak gizli analytics paneli eklendi.
- Desktop update feature, updater-ready Tauri config ve release artifact tooling eklendi.
- GitHub Pages ve desktop release workflow parity zemini kuruldu.
- MCQ repo'suna ozel updater key yolu ve `release:dry-run` release plan disiplini eklendi.
- Ayrintili tasarim ve uygulama planlari `docs/superpowers/` altina yazildi.

## Siradaki oncelikler

1. Editor v2 ustune daha zengin authoring yardimlari ve gerekirse unsaved-change korumalari ekle.
2. Sync conflict cozumunu gerekirse merge/diff iyilestirmeleriyle derinlestir.
3. Analytics panelini gerekirse konu bazli detaylarla zenginlestir; study ekranina tasima.

## Hazir olma kriterleri

- Her tasimadan sonra smoke testler gecmeli.
- Temel extraction adimlarinda ilgili unit testler de gecmeli.
- `release` komutu pointer dosyalari ve updater fallback davranisiyla calismali.
- README ve changelog guncel kalmali.
