# Çoktan Seçmeli Sorular

Bu proje, doktorlar ve tıp öğrencileri için (başta TUS ve USMLE olmak üzere) çoktan seçmeli sorularla pratik yapmayı sağlayan, **local-first ama online-ready** bir MCQ uygulamasıdır. Uygulama kimligi MCQ olarak korunur; flashcards klonu degildir. Vite/Vitest tabani, moduler feature yapisi, runtime config, Supabase auth/sync temeli, editor, analytics ve desktop release/updater iskeleti ile uzun vadeli hibrit urun kabuguna yaklastirilmistir.

## Özellikler

1. **Dinamik Soru Seti Yukleme (`Set Yonetimi`)**:
   - Dışarıdan indirdiğiniz veya kendiniz hazırladığınız `.json`, `.md` ve `.txt` uzantılı soru setlerini tek tıkla uygulamaya yükleyebilirsiniz.
   - Manager ekranindan `Yeni set` ile sifirdan, markdown-first bir taslak acip yeni bir soru seti de olusturabilirsiniz.
   - Web sürümünde Google Drive Picker ile Drive'dan doğrudan soru dosyası seçebilirsiniz. Tauri/masaüstü sürümünde ise bu sınır net bir uyarıyla belirtilir.
   - Birden fazla seti aynı anda seçip harmanlayarak veya ayrı ayrı filtreleyerek çözme imkanı sağlar.
2. **Auth, Senkronizasyon ve Catismayi Guvenli Cozme**:
   - Demo auth ile hizli baslangic yapabilir veya Supabase runtime config verilince email/sifre ile giris yapabilirsiniz.
   - Yuklu setler ve study-state cloud'a senkronize olabilir; sync durumu manager ustunde gorunur.
   - Sync reconciliation ayni kaynagi `sourcePath -> fileName -> record id` sirasi ile eslestirir; yalnizca ayni sette iki taraf da degismisse conflict acilir.
   - Disjoint setler, local-only eklemeler, remote-only eklemeler ve tek-taraf-guncel ayni setler guvenli sekilde otomatik birlestirilir; gerekiyorsa eski remote `id` temizlenir.
   - Manual panel iki aksiyonlu kalir (`Bulutu kullan`, `Yereli buluta yaz`) ve artik set adi, hangi tarafin daha yeni oldugu, son degisim zamani ile soru/cevap farkini gosterir.
3. **Kişiselleştirilmiş Öğrenme ve İlerleme Takibi**:
   - Girdiğiniz cevaplar (doğru, yanlış, seçilmemiş) tarayıcı önbelleğinde veya kullaniciya bagli storage alaninda tutulur.
   - Soru setini silseniz dahi, aynı seti tekrar yüklediğinizde uygulamadaki ilerlemeniz kaldığı yerden devam eder (soru kimliği set-bazlı tutulur; aynı soru farklı setlerde birbirini ezmez).
   - Uygulama, kaldığınız soru ve konu filtresini doğru şekilde geri yükler; `Setlere Dön -> Başla` akışında ve uygulamayı kapatıp açtıktan sonra da aynı soruya dönebilir.
   - İsterseniz `Cevapları kilitle` ile cevaplandıktan sonra şıkları değiştirilemez hale getirebilir, `Otomatik sonraki soru` ile cevap sonrası kısa gecikmeyle bir sonraki soruya otomatik geçebilirsiniz.
   - `Sıfırla` artık yalnızca o anda çalışılan aktif/setilmiş setlerin ilerlemesini temizler.
   - Eski `mc_...` anahtarlar otomatik migrate edilerek mevcut veriler korunur.
   - "Yanlışları Çöz" butonuyla sadece hata yaptığınız soruları ayıklayıp tekrar çözebilirsiniz.
4. **Editor ve Analytics Yuzeyi**:
   - `editor-screen` ile tek secili seti gorsel form veya raw kaynak gorunumu uzerinden duzenleyebilirsiniz.
   - Yeni set olusturma akisi varsayilan olarak `Markdown/TXT` kaynak formatiyla baslar; kaydedince normal set listesine ve sync hattina baglanir.
   - Editor artik toplu validation ozeti, sorunlu soruya atlama, save gating, soru kopyalama/tasima ve daha genis dirty-state korumalari ile authoring kapanisina hazirdir.
   - Markdown/JSON kaynaklar roundtrip-safe codec uzerinden korunur; kaynak formatta disa aktar desteklenir.
   - Manager ustunde yuklu/secili set, soru havuzu, dogru/yanlis, tamamlanma ve son oturum ozeti gorulur.
5. **Kapsamlı Konu Filtresi & Karıştırma**:
   - Yüklediğiniz setlerdeki sorular "Konu" başlıklarına göre otomatik olarak filtre seçeneklerine dahil olur.
   - İstediğiniz an soruları karıştırarak (`Karıştır` butonu) ezberi kırabilirsiniz.
6. **Hızlı Kısayollar, Tam Ekran ve Yazdırma Desteği**:
   - Başlangıç ekranında görünen kısayollarla `A-E` ile şık işaretleyin, `S` ile açıklamayı açın, yön tuşlarıyla sorular arasında gezinin.
   - `F` ile tam ekrana geçin, `ESC` ile çıkın. Tam ekranda soru, şık ve açıklama blokları daha kompakt boyutta gösterilir ve içerik kaydırılabilir.
   - Testleri temiz bir A4 formatında PDF olarak kaydedin veya doğrudan yazdırın.
7. **Modern Arayüz, Karanlık Tema ve Desktop Update Hazırlığı**:
   - Göz yormayan, animasyonlu arayüz ve başlangıç ekranından da erişilebilen kalıcı Karanlık/Aydınlık mod seçeneği.
   - Windows desktop runtime’da `Guncellemeleri Kontrol Et` butonu gorunur ve updater/plugin hazirligi vardir.

## Gelistirme

```powershell
npm install
npm run dev
```

Preview:

```powershell
npm run preview
```

## Test ve Build

Smoke:

```powershell
npm run test:smoke
```

Unit:

```powershell
npm run test:unit
```

Tum temel dogrulama:

```powershell
npm test
```

Vite web build:

```powershell
npm run build
```

Desktop build:

```powershell
npm run build:desktop
```

Release plan sanity:

```powershell
npm run release:dry-run
```

## Windows Desktop Release

Yerel timestamped release klasoru uretmek icin:

```powershell
npm run release
```

Gercek artefakt olusturmadan once release planini ve updater durumunu gormek icin:

```powershell
npm run release:dry-run
```

Varsayilan davranis legacy kok EXE kopyalamaz. Eski davranis gerekiyorsa:

```powershell
npm run release:with-legacy
```

Bu komut sirasiyla:

1. `vite build` ile web çıktısını `dist/` altında üretir; legacy runtime için `src/` ve varsa `data/` klasörü de korunur.
2. Updater private key yoksa local release’i updater artefakti olmadan almaya devam eder. Varsayilan lokal anahtar yolu MCQ repo'su icin `~/.tauri/multiple-choice-questions-updater.key` dosyasidir.
3. `npm run release:dry-run` ayni isimlendirme ve pointer planini hesaplar, ama release klasoru veya artefakt yazmaz.
4. `release/` altinda timestamped klasor, `release-info.txt`, `OPEN_THIS_PORTABLE.txt` ve repo kokunde `LATEST_RELEASE_POINTER.txt` uretir.
5. Desktop updater yayin akisi icin GitHub Actions tarafinda ayri `Release Desktop` workflow'u kullanilir.

## GitHub Pages ve Desktop Updater

- Web deploy: `.github/workflows/pages.yml`
- Desktop release/updater: `.github/workflows/release-desktop.yml`
- Ayrintili adimlar: `docs/RELEASE_CHECKLIST.md`

---

## Veri Seti Oluşturma (AI ile Hızlı Soru Üretme)

Yapay zeka asistanlarını (ChatGPT, Claude vb.) kullanarak kendi `.json` test setlerinizi çok hızlı bir şekilde üretebilirsiniz. Hızlı ve tutarlı bir JSON paketi hazırlamak için aşağıdaki iki yöntemden birini seçin:

### Yöntem 1: AI'dan Doğrudan JSON Çıktısı Almak

Aşağıdaki komutu yapay zekaya kopyalayıp, doğrudan test verisini talep edebilirsiniz:

> Aşağıdaki konuya ilişkin zorlayıcı çoktan seçmeli sorular yaz (1 doğru, 4 güçlü çeldirici). Çıktıyı tam olarak aşağıdaki JSON formatında ver, lütfen formatın dışına çıkma. Her soruya ait detaylı ve öğretici bir Türkçe açıklama yaz. 
> 
> **Persona ve Kaynaklar:**
> - Yazarken pediatri uzmanı bir hoca gibi düşün ve bir tıp öğrencisine bu konudan neleri sorardın, hangi cevapları beklerdin bunları kurgula.
> - Soruları hazırlarken kaynak olarak **Nelson Pediatrics 22th Ed**, **PubMed**, **AAP**, **Cochrane** gibi güncel kılavuz ve textbook'ları esas alabilirsin.
> - Soru sayısı tüm detayları kapsayacak kadar çok olmalı. Açıklamalar doyurucu ve öğretici olmalı.
> 
> Vurgu Hiyerarşisi (Açıklama kısmında kullan):
> - Seviye 1 (Kritik): ==metin== (Çift eşittir)
> - Seviye 2 (Önemli): > ⚠️ metin (Satır başı uyarı)
> - Seviye 3 (Normal): **metin** (Kalın)
> 
> Konu: [ÇALIŞMAK İSTEDİĞİNİZ KONU]
> 
> ```json
> {
>   "setName": "Konu Adı Testi",
>   "questions": [
>     {
>       "q": "Konuya ilişkin detaylı soru metni burada yer alacak?",
>       "options": [
>         "A şıkkı formunda metin",
>         "B şıkkı formunda metin",
>         "C",
>         "D",
>         "E"
>       ],
>       "correct": 0,
>       "explanation": "<strong>Doğru cevap A'dır.</strong> Çünkü kritik detay budur.<br>B şıkkı şundan dolayı yanlıştır.",
>       "subject": "Spesifik Alt Konu Başlığı"
>     }
>   ]
> }
> ```
> *Not: "correct" anahtarı için 0=A, 1=B, 2=C, 3=D, 4=E'dir.*

Yapay zekanın verdiği JSON blok kodunu kopyalayıp örneğin `yenitest.json` dosyası olarak kaydedin ve uygulamadaki `Soru Dosyası Yükle` butonundan uygulamaya tanıtın.

### Yöntem 2: Düz Metin (Markdown) Yüklemek

Uygulama artık `.md` veya `.txt` uzantılı düz metin dosyalarını da doğrudan destekliyor! Aşağıdaki şablonu kullanarak yapay zekadan düz metin olarak soru isteyebilir ve bunu bir `.md` dosyasına kaydederek doğrudan uygulamaya yükleyebilirsiniz.

**Beklenen Metin Şablonu:**
```text
## Test Seti Adı

### Konu: Alt Konu Adı

Soru: Örnek soru **burada kalın bir vurgu** içerebilir. Hangi seçenek doğrudur?
A) Yanlış seçenek 1
B) Doğru seçenek
C) Yanlış seçenek 2
D) Yanlış seçenek 3
E) Yanlış seçenek 4
Doğru Cevap: B
Açıklama: Açıklama metni **vurgu** içeriyor. İkinci satır.
```

Not: Elinizdeki `.txt` veya `.md` dosyalarını JSON'a çevirmek için terminalden isterseniz script de kullanabilirsiniz: 
`node tools/text2json.js input.txt cikti.json`

---

## Kurulum ve Kullanim

1. `npm install`
2. `npm run dev` veya sadece statik calisma icin `index.html` ac
3. Karşınıza çıkan **Set Yöneticisi** ekranından kendi ürettiğiniz `.json`, `.md` ya da `.txt` dosyasını seçin veya web sürümünde Drive'dan içe aktarın.
4. Listeden çalışmak istediğiniz testleri seçip `Başla` butonuna basın.

Ilk kurulumda tarayici binary'si lazimsa:

```powershell
npm run test:smoke:install
```

## Buyume Icin Klasor Standarti

- `src/app/`: bootstrap, ekran gecisi ve uygulama state kabugu
- `src/core/`: storage, set-codec ve runtime odakli cekirdek moduller
- `src/generated/`: build/runtime fallback modulleri
- `src/`: modulerlesme icin hedef kaynak klasoru
- `tests/smoke/`: kritik akis smoke testleri
- `tests/unit/`: saf mantik ve altyapi testleri
- `docs/RELEASE_CHECKLIST.md`: release adimlari
- `docs/MODULARIZATION_PLAN.md`: index.html -> moduler yapi gecis plani
- `docs/superpowers/specs/`: onayli tasarim dokumanlari
- `docs/superpowers/plans/`: gorev seviyesinde uygulama planlari
- `CHANGELOG.md`: degisiklik kaydi
