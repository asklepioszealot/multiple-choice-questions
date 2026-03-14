# Çoktan Seçmeli Test Şablonu (Dinamik Set Yönetimli)

Bu proje, doktorlar ve tıp öğrencileri için (başta TUS ve USMLE olmak üzere) çoktan seçmeli sorularla pratik yapmayı sağlayan, **tamamen lokal**, tarayıcı üzerinde çalışan ve JSON dosyalarıyla dinamik olarak genişletilebilen bir test uygulamasıdır.

## Özellikler

1. **Dinamik Soru Seti Yükleme (`Set Yönetimi`)**:
   - `data/` klasöründeki veya dışarıdan indirdiğiniz `.json` uzantılı soru setlerini tek tıkla uygulamaya yükleyebilirsiniz.
   - Birden fazla seti aynı anda seçip harmanlayarak veya ayrı ayrı filtreleyerek çözme imkanı sağlar.
2. **Kişiselleştirilmiş Öğrenme ve İlerleme Takibi**:
   - Girdiğiniz cevaplar (doğru, yanlış, seçilmemiş) tarayıcı önbelleğinde (`localStorage`) güvende tutulur.
   - Soru setini silseniz dahi, aynı seti tekrar yüklediğinizde uygulamadaki ilerlemeniz kaldığı yerden devam eder (Sorular metin tabanlı hash'lenerek akıllıca tanınır).
   - "Yanlışları Çöz" butonuyla sadece hata yaptığınız soruları ayıklayıp tekrar çözebilirsiniz.
3. **Kapsamlı Konu Filtresi & Karıştırma**:
   - Yüklediğiniz setlerdeki sorular "Konu" başlıklarına göre otomatik olarak filtre seçeneklerine dahil olur.
   - İstediğiniz an soruları karıştırarak (`Karıştır` butonu) ezberi kırabilirsiniz.
4. **Hızlı Kısayollar ve Yazdırma Desteği**:
   - `Klavyedeki A, B, C, D, E` tuşlarıyla şıkları güvenle işaretleyin.
   - `S` tuşuyla açıklamaları görün, Yön tuşlarıyla sorular arasında gezinin.
   - Testleri temiz bir A4 formatında PDF olarak kaydedin veya doğrudan yazdırın.
5. **Modern Arayüz ve Karanlık Tema**:
   - Göz yormayan, animasyonlu arayüz ve kalıcı Karanlık/Aydınlık mod seçeneği.

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

Yapay zekanın verdiği JSON blok kodunu kopyalayıp örneğin `yenitest.json` dosyası olarak kaydedin ve uygulamadaki `JSON Dosyası Yükle` butonundan uygulamaya tanıtın.

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
`node tools/text2json.js data/input.txt data/cikti.json`

---

## Kurulum ve Kullanım

Uygulamanın çalışması için herhangi bir sunucuya, kurulu bir programa ya da veritabanına ihtiyacınız yoktur.
1. `index.html` dosyasını tarayıcınızda (Chrome, Safari, Firefox vb.) açın.
2. Karşınıza çıkan **Set Yöneticisi** ekranından `data/akut_bronsiolit.json` gibi bir örneği veya kendi ürettiğiniz `.json` ya da `.md` dosyasını seçin.
3. Listeden çalışmak istediğiniz testleri seçip `Başla` butonuna basın!
