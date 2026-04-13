# MCQ Sync Polish Design

## Goal

Supabase destekli cloud sync davranisini kullaniciya daha gorunur ve daha guven veren bir UX ile sunmak; ayni dilimde `tools/run-smoke.js` kaynakli `[DEP0190]` uyarısını kaldirmak; mevcut plan/TODO belgelerini gelinen mimari durum ile hizalamak.

## Scope

Bu slice sunlari kapsar:

- Smoke runner icindeki `shell: true` kaynakli `DEP0190` uyarısını kaldirmak
- Sync icin hafif ama anlamli bir status UX eklemek
- Sync hatasi durumunda kullanicinin durumu gorebilmesini ve tekrar deneyebilmesini saglamak
- Modulerlesme/TODO belgelerini mevcut tamamlanan slice’lar ile guncellemek

Bu slice sunlari kapsamaz:

- Coklu cihaz conflict resolution ekrani
- Gecmis sync log viewer
- Editor veya analytics feature implementasyonu
- Yeni auth provider’lari

## Recommended Approach

Kucuk ve guvenli bir polish katmani eklenir:

1. `tools/run-smoke.js` dogrudan process spawn kullanir; Windows icin `npm.cmd` ve `npx.cmd`, diger ortamlar icin `npm` ve `npx` komutlari shell acmadan calistirilir.
2. `main.js` icindeki mevcut remote load/save akisi etrafina minimal bir sync durum modeli eklenir.
3. Sync durumu auth/session bar yakininda gorunur bir badge + kisa mesaj olarak sunulur.
4. Hata durumunda `Tekrar Dene` butonu ile son remote sync denemesi yeniden tetiklenir.
5. Demo modunda cloud sync alanı gizlenir veya etkisiz hale getirilir; Supabase oturumu varken gorunur.

## UX Contract

Durumlar:

- `idle`: ilk durum, gorunmez veya notr
- `syncing`: "Bulut ile esitleniyor..."
- `synced`: "Bulut ile esitlendi"
- `error`: "Sync hatasi" + kisa mesaj + `Tekrar Dene`

Tetikleyiciler:

- Auth sonrasi remote workspace yukleme
- Set import / restore / remove
- Study-state save debounce flush
- Manuel retry

## Architecture

- Yeni bir hafif sync status modulu eklemek yerine bu slice’ta mevcut orkestrasyonun merkezi oldugu `src/app/main.js` icinde state tutulur.
- UI elemanlari `index.html` icine eklenir.
- Testler agirlikla unit seviyesinde `sync-status` davranisina ve smoke runner davranisina odaklanir.

## Error Handling

- Remote save/load hatalari mevcut console log davranisini korur.
- Kullaniciya yalnizca kisa ve okunabilir bir sync mesaji gosterilir.
- Retry en son bekleyen snapshot veya remote workspace reload akisini tekrar dener.

## Verification

- `npm run test:unit`
- `npm run test:smoke`
- `npm test`

