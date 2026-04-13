import { describe, expect, it } from "vitest";
import {
  buildSetRecord,
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
