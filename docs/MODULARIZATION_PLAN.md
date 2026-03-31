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
2. Soru akisini `src/features/study-flow/` altina tasi.
3. Ortak yardimcilari `src/shared/` altinda topla.
4. `src/app/{bootstrap,screen,state}.js` ile uygulama kabugunu guclendir.

## Mevcut Durum

- Vite tabanli `build` ve `build:dist` aktif.
- `test` artik smoke + unit birlesimi olarak calisiyor.
- `src/generated/build-info.js` ve `src/generated/runtime-config.js` eklendi.
- `src/core/storage.js` local/session API'si kazandi.
- `src/core/set-codec.js` monolitten ayrildi.
- `src/app/bootstrap.js`, `src/app/screen.js`, `src/app/state.js` olusturuldu.
- Ayrintili tasarim ve uygulama planlari `docs/superpowers/` altina yazildi.

## Hazir olma kriterleri

- Her tasimadan sonra smoke testler gecmeli.
- Temel extraction adimlarinda ilgili unit testler de gecmeli.
- `release` komutu davranis degistirmeden calismali.
- README ve changelog guncel kalmali.
