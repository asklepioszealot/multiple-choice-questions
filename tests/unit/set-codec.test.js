import { describe, expect, it } from "vitest";
import {
  buildSetRecord,
  collectRelativeMediaReferences,
  hydrateSetRecordMedia,
  htmlToEditableText,
  normalizeQuestions,
  normalizeSetRecord,
  parseMarkdownToJSON,
  parseSetText,
  serializeSetRecord,
} from "../../src/core/set-codec.js";

describe("set-codec", () => {
  it("normalizes questions into canonical MCQ shape", () => {
    const questions = normalizeQuestions({
      questions: [{ q: "Soru", options: ["A"], correct: 0, explanation: "", subject: "" }],
    });

    expect(questions[0]).toEqual({
      q: "Soru",
      options: ["A"],
      correct: 0,
      explanation: "",
      subject: "Genel",
      id: null,
    });
  });

  it("parses markdown into a set payload", () => {
    const parsed = parseMarkdownToJSON(
      "# Demo Set\n\nSoru: Ornek?\nA) Evet\nB) Hayir\nDoğru Cevap: A\nAçıklama: Aciklama",
      "demo.md",
    );

    expect(parsed.setName).toBe("Demo Set");
    expect(parsed.questions).toHaveLength(1);
  });

  it("parses heading subjects, heading questions, and inline correct option markers", () => {
    const parsed = parseSetText(
      [
        "# Klinik Set",
        "",
        "## Kardiyoloji",
        "### Mitral stenozda en tipik bulgu nedir?",
        "A) Sistolik ufurum",
        "B+) Diyastolik rulman",
        "C) Hipertansiyon",
        "Açıklama: Diyastolik rulman klasik bulgudur.",
        "",
        "## Noroloji",
        "[2]",
        "Optik sinir hangisidir?",
        "A) II",
        "B+) VIII",
        "Açıklama: Optik sinir ikinci kraniyal sinirdir.",
      ].join("\n"),
      "klinik.md",
    );

    expect(parsed.setName).toBe("Klinik Set");
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0]).toMatchObject({
      q: "Mitral stenozda en tipik bulgu nedir?",
      options: ["Sistolik ufurum", "Diyastolik rulman", "Hipertansiyon"],
      correct: 1,
      subject: "Kardiyoloji",
      explanation: "Diyastolik rulman klasik bulgudur.",
    });
    expect(parsed.questions[1]).toMatchObject({
      q: "Optik sinir hangisidir?",
      options: ["II", "VIII"],
      correct: 1,
      subject: "Noroloji",
    });

    const serialized = serializeSetRecord(parsed, "markdown");
    expect(serialized).toContain("Soru 1: Mitral stenozda en tipik bulgu nedir?");
    expect(serialized).toContain("Konu: Kardiyoloji");
    expect(serialized).toContain("B) Diyastolik rulman");
    expect(serialized).toContain("Doğru Cevap: B");
    expect(serialized).not.toContain("###");
    expect(serialized).not.toContain("[2]");
    expect(serialized).not.toContain("B+)");
  });

  it("parses highlighted Obsidian mark options as the correct answer", () => {
    const parsed = parseSetText(
      [
        "[1] En uygun sonraki adim nedir?",
        "",
        "a) Beta bloker eklenmesi",
        '<mark style="background:rgba(240, 200, 0, 0.2)">b) Aldosteron/renin orani ile tarama</mark>',
        "c) Spironolakton baslanmasi",
        "d) Renal denervasyon",
        "e) Mevcut tedavi",
      ].join("\n"),
      "final.md",
    );

    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0]).toMatchObject({
      options: [
        "Beta bloker eklenmesi",
        "Aldosteron/renin orani ile tarama",
        "Spironolakton baslanmasi",
        "Renal denervasyon",
        "Mevcut tedavi",
      ],
      correct: 1,
    });
  });

  it("captures freeform explanation after the final option until the next question", () => {
    const parsed = parseSetText(
      [
        "[1] En uygun sonraki adim nedir?",
        "a) Beta bloker eklenmesi",
        '<mark style="background:rgba(240, 200, 0, 0.2)">b) Aldosteron/renin orani ile tarama</mark>',
        "c) Spironolakton baslanmasi",
        "d) Renal denervasyon",
        "e) Mevcut tedavi",
        "",
        "**Direncli hipertansiyon tanimi**",
        "|Parametre|Deger|",
        "|---|---|",
        "|ABPM|Yuksek|",
        "---",
        "[2] Sonraki soru nedir?",
        "a) Ilk secenek",
        "b) Ikinci secenek",
        '<mark style="background:rgba(240, 200, 0, 0.2)">c) Ucuncu secenek</mark>',
      ].join("\n"),
      "final.md",
    );

    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0].explanation).toContain("Direncli hipertansiyon tanimi");
    expect(parsed.questions[0].explanation).toContain("<td>ABPM</td><td>Yuksek</td>");
    expect(parsed.questions[0].explanation).not.toContain("Sonraki soru nedir?");
    expect(parsed.questions[1]).toMatchObject({
      q: "Sonraki soru nedir?",
      correct: 2,
      explanation: "",
    });
  });

  it("renders markdown tables and lists inside captured explanations", () => {
    const parsed = parseSetText(
      [
        "[1] Klinik karar nedir?",
        "a) Ilk",
        '<mark style="background:rgba(240, 200, 0, 0.2)">b) Ikinci</mark>',
        "c) Ucuncu",
        "d) Dorduncu",
        "e) Besinci",
        "|Parametre|Deger|Yorum|",
        "|---|---|---|",
        "|ABPM|138/88|**Esigin uzerinde**|",
        "* direncli hipertansiyon",
        "* sinirda dusuk potasyum",
      ].join("\n"),
      "final.md",
    );

    expect(parsed.questions[0].explanation).toContain("<table>");
    expect(parsed.questions[0].explanation).toContain("<th>Parametre</th>");
    expect(parsed.questions[0].explanation).toContain("<td><strong>Esigin uzerinde</strong></td>");
    expect(parsed.questions[0].explanation).toContain("<ul>");
    expect(parsed.questions[0].explanation).toContain("<li>direncli hipertansiyon</li>");
    expect(parsed.questions[0].explanation).not.toContain("|Parametre|Deger|Yorum|");
  });

  it("renders markdown blocks after an explicit explanation label", () => {
    const parsed = parseSetText(
      [
        "Soru 1: Klinik karar nedir?",
        "A) Ilk",
        "B) Ikinci",
        "Doğru Cevap: B",
        "Açıklama: **Baslik**",
        "|Parametre|Deger|",
        "|---|---|",
        "|ABPM|**Yuksek**|",
        "* direncli hipertansiyon",
      ].join("\n"),
      "explicit.md",
    );

    expect(parsed.questions[0].explanation).toContain("<strong>Baslik</strong>");
    expect(parsed.questions[0].explanation).toContain("<table>");
    expect(parsed.questions[0].explanation).toContain("<td><strong>Yuksek</strong></td>");
    expect(parsed.questions[0].explanation).toContain("<li>direncli hipertansiyon</li>");
    expect(parsed.questions[0].explanation).not.toContain("|Parametre|Deger|");
  });

  it("roundtrips markdown source through parse and serialize", () => {
    const source = [
      "# Kardiyoloji",
      "",
      "Soru 1: **Murmur** en sık nerede duyulur?",
      "Konu: Kalp",
      "A) Apeks",
      "B) Sternum",
      "Doğru Cevap: A",
      "Açıklama: ==Apeks== klasik odaktır.",
      "> ⚠️ Os̈kültasyon önemlidir.",
    ].join("\n");

    const parsed = parseSetText(source, "cardio.md");
    const serialized = serializeSetRecord(parsed, "markdown");
    const reparsed = parseSetText(serialized, "cardio.md", parsed, "markdown");

    expect(serialized).toContain("# Kardiyoloji");
    expect(serialized).toContain("Doğru Cevap: A");
    expect(reparsed.questions[0].q).toContain("<strong>Murmur</strong>");
    expect(reparsed.questions[0].explanation).toContain("highlight-critical");
  });

  it("roundtrips safe image and audio tokens through markdown source", () => {
    const source = [
      "# Noroloji",
      "",
      "Soru 1: Bu yapı nedir? ![Beyin sapi](data:image/png;base64,QUJD)",
      "Konu: Beyin",
      "A) Omurilik",
      "B) Beyin sapi",
      "Doğru Cevap: B",
      "Açıklama: ![audio: Ses kaydı](data:audio/mpeg;base64,SUQz)",
    ].join("\n");

    const parsed = parseSetText(source, "media.md");
    const serialized = serializeSetRecord(parsed, "markdown");

    expect(parsed.questions[0].q).toContain("<img");
    expect(parsed.questions[0].q).toContain("data:image/png;base64,QUJD");
    expect(parsed.questions[0].explanation).toContain("<audio");
    expect(parsed.questions[0].explanation).toContain("data:audio/mpeg;base64,SUQz");
    expect(serialized).toContain("![Beyin sapi](data:image/png;base64,QUJD)");
    expect(serialized).toContain("![audio: Ses kaydı](data:audio/mpeg;base64,SUQz)");
  });

  it("adds Obsidian image links before options to the question text", () => {
    const parsed = parseSetText(
      [
        "[11] Bu PA akciger grafisinde hangi bulgu mevcuttur?",
        "![[plörezi.webp]]",
        "a) Abse",
        "b) Pnomoni",
        '<mark style="background:rgba(240, 200, 0, 0.2)">c) Plorezi</mark>',
        "d) Pnomotoraks",
        "e) Normal PA grafi",
      ].join("\n"),
      "final.md",
    );

    expect(parsed.questions[0].q).toContain("Bu PA akciger grafisinde");
    expect(parsed.questions[0].q).toContain("<img");
    expect(parsed.questions[0].q).toContain("pl%C3%B6rezi.webp");
    expect(parsed.questions[0].q).toContain('alt="plörezi"');
    expect(parsed.questions[0].options).toHaveLength(5);
    expect(parsed.questions[0].correct).toBe(2);
  });

  it("hydrates unresolved Obsidian media references from a selected media lookup", () => {
    const parsed = parseSetText(
      [
        "[11] Bu PA akciger grafisinde hangi bulgu mevcuttur?",
        "![[plörezi.webp]]",
        "a) Abse",
        "b) Pnomoni",
        "c) Plorezi",
        "d) Pnomotoraks",
        "e) Normal PA grafi",
      ].join("\n"),
      "final.md",
    );
    const references = collectRelativeMediaReferences(parsed);
    const hydrated = hydrateSetRecordMedia(
      parsed,
      new Map([["plörezi.webp", "data:image/webp;base64,QUJD"]]),
    );

    expect(references).toEqual(["pl%C3%B6rezi.webp"]);
    expect(hydrated.changed).toBe(true);
    expect(hydrated.record.questions[0].q).toContain("data:image/webp;base64,QUJD");
    expect(collectRelativeMediaReferences(hydrated.record)).toEqual([]);
  });

  it("drops unsafe media tokens from markdown parse and export surfaces", () => {
    const source = [
      "# Guvensiz Medya",
      "",
      "Soru 1: Bu token korunmamalı ![XSS](javascript:alert('x'))",
      "Konu: Guvenlik",
      "A) A",
      "B) B",
      "Doğru Cevap: A",
      "Açıklama: ![audio: Kotu](file:///tmp/evil.mp3)",
    ].join("\n");

    const parsed = parseSetText(source, "unsafe.md");
    const markdownExport = serializeSetRecord(parsed, "markdown");
    const jsonExport = serializeSetRecord(parsed, "json");

    expect(parsed.questions[0].q).not.toContain("<img");
    expect(parsed.questions[0].q).not.toContain("javascript:");
    expect(parsed.questions[0].explanation).not.toContain("<audio");
    expect(parsed.questions[0].explanation).not.toContain("file:///");
    expect(markdownExport).not.toContain("javascript:");
    expect(markdownExport).not.toContain("file:///");
    expect(jsonExport).not.toContain("javascript:");
    expect(jsonExport).not.toContain("file:///");
  });

  it("builds source-aware records and keeps question ids on save", () => {
    const previousRecord = {
      id: "demo",
      fileName: "demo.md",
      sourceFormat: "markdown",
      setName: "Demo",
      questions: [
        {
          id: "q-1",
          q: "Eski soru?",
          options: ["A", "B"],
          correct: 0,
          explanation: "Eski aciklama",
          subject: "Genel",
        },
      ],
    };

    const nextRecord = buildSetRecord(
      {
        ...previousRecord,
        questions: [
          {
            q: "**Yeni** soru?",
            options: ["A", "B"],
            correct: 1,
            explanation: "Yeni aciklama",
            subject: "Genel",
          },
        ],
      },
      { previousRecord },
    );

    expect(nextRecord.questions[0].id).toBe("q-1");
    expect(nextRecord.rawSource).toContain("Soru 1:");
    expect(htmlToEditableText(nextRecord.questions[0].q)).toBe("**Yeni** soru?");
  });

  it("preserves sourcePath through normalization and source-aware saves", () => {
    const normalized = normalizeSetRecord({
      id: "demo",
      setName: "Demo",
      fileName: "demo.md",
      sourceFormat: "markdown",
      sourcePath: "C:\\sets\\demo.md",
      questions: [],
    });

    const savedRecord = buildSetRecord(
      {
        ...normalized,
        questions: [
          {
            q: "Yeni soru?",
            options: ["A", "B"],
            correct: 0,
            explanation: "",
            subject: "Genel",
          },
        ],
      },
      { previousRecord: normalized },
    );

    expect(normalized.sourcePath).toBe("C:\\sets\\demo.md");
    expect(savedRecord.sourcePath).toBe("C:\\sets\\demo.md");
  });
});
