# Çoktan Seçmeli Test Şablonu

Sınav odaklı, tek dosyalı (single-file) çoktan seçmeli test uygulaması. Soruları interaktif biçimde çözmenizi, açıklamalarıyla birlikte incelemenizi ve ilerlemenizi takip etmenizi sağlar.

## Ekran Görünümü

Uygulama açık ve koyu tema desteği sunar. Her soru kartında 5 şık, doğru/yanlış geri bildirimi ve detaylı açıklama bölümü yer alır.

## Özellikler

- **5 şıklı sorular** — Her soruda A–E arası seçenekler ve detaylı açıklama
- **Açık / Koyu tema** — Tek tuşla geçiş, tercih `localStorage`'da saklanır
- **Konu filtresi** — Dropdown ile belirli bir konuya ait soruları filtreleme
- **Soru karıştırma** — Soruları rastgele sıraya dizme
- **Yanlışları tekrar çözme** — Yalnızca yanlış cevaplanmış soruları yeniden çözme
- **Soru numarasına atlama** — İstenen soru numarasına doğrudan gitme
- **Skor takibi** — Doğru, yanlış ve yüzde başarı oranı anlık gösterim
- **İlerleme kaydetme** — Cevaplar ve mevcut konum `localStorage` ile otomatik kaydedilir
- **JSON export** — Tüm soru verilerini `.json` olarak dışa aktarma
- **Yazdırma** — Cevap anahtarı ve açıklamalarıyla birlikte yazıcı dostu çıktı
- **Klavye kısayolları** — `A`–`E` şık seçimi, `S` çözüm göster/gizle, `←` `→` önceki/sonraki soru
- **Responsive tasarım** — Mobil ve masaüstü uyumlu

## Kullanım

1. `Çoktan Seçmeli Test Şablon.html` dosyasını herhangi bir tarayıcıda açın.
2. Soruları cevaplayın; doğru/yanlış anında görüntülenir.
3. **Çözümü Göster** butonuyla açıklamayı inceleyin.
4. Üst menüden konu filtresi, karıştırma ve diğer araçlara erişin.

## Yeni Soru Ekleme

Dosyadaki `const questions` dizisine aşağıdaki formatta yeni soru nesneleri ekleyin:

```javascript
{
    q: "Soru metni (<strong> kullanılabilir)",
    options: [
        "A şıkkı",
        "B şıkkı",
        "C şıkkı",
        "D şıkkı",
        "E şıkkı"
    ],
    correct: 0,  // 0=A, 1=B, 2=C, 3=D, 4=E
    explanation: "Detaylı açıklama metni",
    subject: "Konu Adı"
}
```

### Açıklama Vurgu Hiyerarşisi

| Seviye    | Kullanım                           | HTML                                              |
| --------- | ---------------------------------- | ------------------------------------------------- |
| 🔴 Kritik | Dozlar, sayılar, kesin kriterler   | `<strong class='highlight-critical'>...</strong>` |
| 🟡 Dikkat | Tuzaklar, uyarılar, ayırıcı tanı   | `<span class='highlight-important'>⚠️ ...</span>` |
| ⚪ Normal | Bölüm başlıkları, liste başlıkları | `<strong>...</strong>`                            |

## Teknolojiler

- **HTML5** + **CSS3** + **Vanilla JavaScript**
- Harici bağımlılık yok — tek dosya, sıfır kurulum
- `localStorage` ile veri kalıcılığı
