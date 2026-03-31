import { describe, expect, it } from "vitest";
import {
  normalizeQuestions,
  parseMarkdownToJSON,
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
      "## Demo\n\nSoru: Ornek?\nA) Evet\nB) Hayir\nDoğru Cevap: A\nAçıklama: Aciklama",
      "demo.md",
    );

    expect(parsed.setName).toBe("demo");
    expect(parsed.questions).toHaveLength(1);
  });
});
