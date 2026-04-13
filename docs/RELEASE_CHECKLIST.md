# Release Checklist

## Pre-flight

- `git status` temiz ya da beklenen degisiklikler net.
- Dogru branch ve dogru committe oldugundan emin ol.
- Gerekliyse `git pull --rebase` ile guncelle.
- Desktop release oncesi `src-tauri/tauri.conf.json` icindeki `version` degerini bump et.
- GitHub Actions `vars` tarafinda `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ENABLE_DEMO_AUTH`, `DRIVE_CLIENT_ID`, `DRIVE_API_KEY`, `DRIVE_APP_ID` degerlerinin guncel oldugunu dogrula.

## Local Secrets Hygiene

- `.env.local` ve `runtime-config.local.json` commitlenmez; yalnizca local setup icin kullanilir.
- Updater private key repo icinde tutulmaz; MCQ repo'su icin varsayilan local yol `~/.tauri/multiple-choice-questions-updater.key` dosyasidir.
- Dokumanda sadece local yol ve fallback mantigi anlatilir; secret icerigi veya makineye ozel pathler changelog/README icine yazilmaz.

## Quality Gates

- Kapanis sirasi korunur:
  - `npm run test:smoke`
  - `npm test`
  - `npm run build`
  - `npm run build:desktop`
  - `npm run release:dry-run`
- Bu komutlar temiz gecmeden push/release/PR acma.

## Manual Closure Matrix

- Web preview: auth + sync giris akisi.
- Markdown set olusturma/düzenleme: validation summary, save gating, tekrar acinca icerik korunumu.
- Sync conflict karari: ayni sette iki taraf da degisince panel aciliyor, `Bulutu kullan` ve `Yereli buluta yaz` iki aksiyonla calisiyor.
- Manager analytics paneli manager-only kaliyor; secili set/son calisma ozeti guncel.
- Desktop: native import + source write-back akisi.
- Gerekiyorsa canlı Supabase sanity: login, set sync, study-state sync, en az bir conflict senaryosu.
- Canlı sanity oncesi `docs/SUPABASE_MCQ_SETS_SETUP.sql` scriptinin guncel haliyle uygulanmis oldugunu ve `mcq_sets.source_path` kolonunun mevcut oldugunu dogrula.

## Updater Keys

- Updater public key repo icinde `src-tauri/tauri.conf.json` altinda tanimli.
- Private key'i bir kez uretmek icin:

```powershell
npx tauri signer generate -w ~/.tauri/multiple-choice-questions-updater.key
```

- GitHub Secrets:
  - `TAURI_SIGNING_PRIVATE_KEY`: private key icerigi veya dosya yolu
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: yalnizca key parola korumaliysa gerekli
- Local `npm run release` akisi `~/.tauri/multiple-choice-questions-updater.key` dosyasini bulursa updater artefaktlarini da uretebilir.
- Local key yoksa `tools/build-release.ps1` updater artefaktlarini kapatip normal NSIS release almaya devam eder.
- Ayni script `-DryRun` ile hicbir artefakt yazmadan planlanan release klasoru, isimler ve updater durumunu raporlar.

## Build

- Gercek release oncesi `npm run release:dry-run` ile planlanan klasor/isimler ve updater durumunu kontrol et.
- `npm run release` (varsayilan: legacy kok EXE kopyalamaz) calistir.
- `release/` altindaki yeni klasorun olustugunu dogrula.
- `LATEST_RELEASE_POINTER.txt` ve `release/.../OPEN_THIS_PORTABLE.txt` dosyalarindaki portable yolunun ayni oldugunu kontrol et.
- Test icin her zaman pointer dosyasinda yazan portable EXE'yi ac.
- SHA256 hash degerlerini not et.

## GitHub Pages

- `Deploy Pages` workflow'unu tetikle veya `main` push ile otomatik calistigini dogrula.
- Pages build'i `dist/` klasorunu deploy eder; desktop updater akisi ile karistirma.

## GitHub Desktop Release

- GitHub Actions icinden `Release Desktop` workflow'unu manuel tetikle.
- Workflow, `desktop-v{version}` tag'i ile Windows NSIS installer + `latest.json` updater manifest'i olusturur.
- Workflow "tag already exists" hatasi verirse once `src-tauri/tauri.conf.json` icindeki `version` degerini artir.
- Desktop auto-updater yalnizca bu workflow ile yayinlanan GitHub Release'leri yakalar.
- `Deploy Pages` workflow'u sadece web build'ini gunceller; tek basina desktop istemciyi guncellemez.

## Signing

- Imzalama gerekiyorsa `SIGN_*` env degiskenlerini ayarla.
- Loglarda `[5/6] Signing artifacts...` adimini dogrula.
- `Get-AuthenticodeSignature <exe>` ile imza durumunu kontrol et.

## Distribution

- Dogru `Portable` ve `Kurulum` dosyasini paylastigindan emin ol.
- Defender/SmartScreen testini temiz bir makinede dogrula.
- `CHANGELOG.md` icin surum notunu guncelle.
