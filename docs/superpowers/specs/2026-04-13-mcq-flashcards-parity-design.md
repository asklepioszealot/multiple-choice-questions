# MCQ Flashcards Parity Design

## Goal

`multiple-choice-test` uygulamasının görsel ve etkileşimsel yüzeyini `flashcards-app` son commit'indeki tasarım sistemiyle aynı aileye açık biçimde taşımak. Bu parity çalışmasının hedefi yalnızca kozmetik bir makyaj değildir; tema preset sistemi, SVG ikon dili, header yerleşimi, kontrol grupları ve metin kalitesi birlikte hizalanacaktır.

MCQ uygulaması veri modeli, sync reconciliation, source-aware editor ve manager-only analytics gibi alanlarda kendi ürün kimliğini koruyacaktır. Görsel sistem `flashcards-app`e yaklaşırken ürün anlamı MCQ olarak kalacaktır.

## Scope

Bu slice şunları kapsar:

- `flashcards-app`teki 10 tema preset sisteminin MCQ'ya taşınması
- Auth, manager, study ve editor ekranlarında ekran-bazlı tema select kontrolleri
- Tema seçiminin global state olarak saklanması ve tüm ekranlarda senkron görünmesi
- `flashcards-app`teki SVG sprite ve ikon yardımcı yaklaşımının MCQ'ya uyarlanması
- Manager, study ve editor yüzeylerinde ikonlu butonlara ve daha sade aksiyon diline geçilmesi
- Study ekranındaki `header-left` ve `header-controls` çakışmasının layout düzeyinde çözülmesi
- `header-controls` grubunun taşma durumunda kontrollü olarak iki satıra kırılması
- Yeni set oluşturma akışının korunması ama metin ve ikon dilinin parity çizgisine alınması
- Türkçe görünen yüzeylerde ASCII kaçaklarının düzeltilmesi
- `flashcards-app`teki sadeleşmiş ikon ve kontrol yaklaşımının MCQ bileşenlerine uyarlanması

Bu slice şunları kapsamaz:

- MCQ veri modelini flashcard veri modeline dönüştürmek
- Sync karar mantığını veya conflict resolution kurallarını yeniden tasarlamak
- Yeni analytics raporlama yüzeyleri eklemek
- Yeni auth provider veya yeni backend kabiliyeti eklemek
- Desktop release akışını veya Pages deploy sürecini yeniden tasarlamak

## Reference Source of Truth

Parity için ana referans `D:\Git Projelerim\flashcards-app` içindeki son commit olacaktır. Özellikle şu alanlar kılavuz kabul edilir:

- `src/ui/theme-presets.js`
- `src/ui/theme.js`
- `src/ui/icons.js`
- `index.html` içindeki SVG sprite, theme control, header ve toolbar düzeni
- `src/features/set-manager/set-manager.js`
- `src/features/editor/*`

Parite hedefi "aynı görsel aile"dir. Birebir DOM kopyası zorunlu değildir; fakat kullanıcıya görünen sonuç, `flashcards-app` ile aynı tasarım sisteminden çıkmış gibi hissettirmelidir.

## Recommended Approach

Önerilen yaklaşım tam parity transplant yaklaşımıdır:

1. Önce tema ve ikon altyapısı taşınır.
2. Sonra manager, study ve editor ekranlarının chrome ve action yüzeyleri parity çizgisine alınır.
3. Son olarak ASCII düzeltmeleri, metin polisajı ve taşma/yerleşim sorunları kapatılır.

Bu sıralama şu nedenle önerilir:

- Tema ve ikon altyapısı ortak CSS/markup kararlarını erken sabitler.
- Study header gibi kırılgan alanlar, yeni tasarım token'ları yerleştikten sonra daha güvenli onarılır.
- Metin düzeltmeleri en sonda yapılınca son UI üstünden karar verilir ve tekrar iş çıkmaz.

## Architecture

### 1. Theme System

MCQ mevcut dark/light toggle yaklaşımından çıkıp preset tabanlı tema sistemine geçer.

- `flashcards-app`teki preset mantığı MCQ'ya taşınır.
- Tema state tek kaynaktan yönetilir.
- Auth, manager, study ve editor ekranlarında ayrı `<select>` kontrolleri bulunur.
- Kullanıcı bir ekrandan tema değiştirince diğer ekranlardaki select değeri ve CSS değişkenleri birlikte güncellenir.
- Tema storage anahtarı uygulama özelinde korunur; mevcut dark/light kullanıcıları için makul bir fallback gerekir.

Beklenen davranış:

- Tema seçimi ekranlar arası hatırlanır.
- Tema sadece study ekranını değil tüm yüzeyi etkiler.
- Bilinmeyen veya bozuk tema değeri gelirse güvenli fallback tema yüklenir.

### 2. Icon System

MCQ içindeki dağınık emoji ve inline SVG kullanımı sade bir SVG sprite sistemine çekilir.

- `flashcards-app`teki gibi ortak sprite tanımı `index.html` içinde tutulur.
- Yardımcı bir ikon render katmanı kullanılır.
- Buton, label ve tool action yüzeyleri ortak ikon sınıflarıyla hizalanır.

Uygulanacak ilke:

- Görsel ağırlık düşük tutulur.
- Emoji yalnızca ürünce anlamlıysa kalır; aksi halde ikon sprite ile değiştirilir.
- İkon boyutları `sm/md/lg` sınıflarıyla tutarlı hale gelir.

### 3. Screen Layout Parity

Manager, study ve editor ekranları parity odaklı olarak yeniden hizalanır.

#### Auth

- `flashcards-app`teki theme select ve daha düzenli giriş kabuğu MCQ auth ekranına uyarlanır.
- Demo / şifreli giriş davranışı korunur.

#### Manager

- Aksiyon butonları ikonlu ve sade hale gelir.
- `Yeni set` akışı korunur.
- Analytics toggle ve edit aksiyonu parity çizgisine çekilir.
- Tema seçimi manager yüzeyinde görünür olur.

#### Study

- `header-left` ve `header-controls` yerleşimi `flashcards-app` mantığına yaklaştırılır.
- Mevcut çakışma kapatılır.
- `header-controls` tek satıra sığmadığında kontrollü şekilde iki satıra kırılabilir.
- Skor, filtre, reset, fullscreen, export benzeri kontrol grupları daha net hizalanır.

#### Editor

- Editor feature davranışları korunur.
- Üst chrome, geri dön, kaydet, raw/source, move ve validation yüzeyleri parity çizgisine çekilir.
- Toolbar ve ikon dili `flashcards-app` ile uyumlu hale gelir.

## Content and Copy Rules

Türkçe görünen kullanıcı yüzeyinde doğal yazım kullanılacaktır.

Örnek düzeltme türleri:

- `Hazirla` -> `Hazırla`
- `Guncelle` -> `Güncelle`
- `Istatistikler` -> `İstatistikler`
- `Kaydedilmemis` -> `Kaydedilmemiş`

Kural:

- Kullanıcıya görünen Türkçe metinlerde ASCII transliterasyon bırakılmayacak.
- Kod içi identifier, storage key ve teknik sabitler gerektiğinde ASCII kalabilir.

## Data Flow

Parity çalışması mevcut ürün davranışını bozmayacak şekilde ilerlemelidir.

- Theme state: UI control -> theme manager -> CSS variables + storage -> diğer select'lere sync
- Icon rendering: component helper -> shared sprite reference
- Screen chrome updates: manager/study/editor render katmanları üzerinden uygulanır
- MCQ-specific state akışları aynı kalır:
  - selected set state
  - sync state
  - study-state persistence
  - editor validation and dirty-state guards

## Error Handling

- Bilinmeyen tema adı gelirse default tema kullanılır.
- İkon adı bulunamazsa güvenli fallback ikon döner.
- Header responsive düzeni küçük ekranlarda butonları gizlemek yerine sarmalamayı tercih eder.
- Theme select senkronizasyonu başarısız olsa bile ekran işlevselliği bozulmaz; en kötü durumda aktif tema korunur.

## Testing Strategy

### Unit

- Tema preset yükleme ve fallback davranışı
- Ekranlar arası theme select senkronizasyonu
- SVG ikon render helper'ı
- Türkçe yüzey metinleri için kritik render beklentileri
- Study header layout için DOM sınıf/state bazlı kontrol

### Smoke

- Manager ekranında tema seçimi değişir, tekrar açınca korunur
- Auth -> manager -> study -> editor arasında tema uyumu bozulmaz
- `Yeni set` akışı parity sonrası hâlâ çalışır
- Study header küçük genişlikte üst üste binmez
- Manager/study/editor ana aksiyonları ikonlu yeni yüzeyde çalışmaya devam eder

### Manual Review

- `flashcards-app` ile yan yana görsel karşılaştırma
- İkon dili, spacing, control weight ve header davranışı gözle kontrol edilir
- Türkçe görünen yüzeylerde ASCII kaçak taraması yapılır

## Risks

En büyük riskler:

- `index.html` içindeki büyük CSS/markup yüzeyinde parity taşırken istemeden regressions üretmek
- Study header'ın yeni wrap davranışı sırasında masaüstü ve dar ekran dengesi bozmak
- Theme preset taşımasında eski dark/light storage değerlerini yanlış yorumlamak
- Emoji ve inline SVG karışık alanlarda eksik ikon eşlemesi bırakmak

Azaltım planı:

- Altyapı -> manager -> study -> editor sıralaması ile ilerlemek
- Her slice sonrası smoke doğrulaması yapmak
- `flashcards-app`teki ikon ve tema kaynaklarını referans alıp ad-hoc tasarım icat etmemek

## Verification

- `npm run test:smoke`
- `npm test`
- Parity odaklı ek smoke senaryoları
- `flashcards-app` ile görsel diff walkthrough
