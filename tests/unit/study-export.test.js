import { describe, expect, it } from "vitest";
import {
  buildPrintableStudyHtml,
  generateCsv,
  generateJson,
  generateMarkdown,
} from "../../src/features/study/study-export.js";

describe("study-export helpers", () => {
  it("builds printable html for all study questions", () => {
    const html = buildPrintableStudyHtml({
      title: "Çoktan Seçmeli Test",
      questions: [
        {
          q: "Soru 1",
          subject: "Kardiyoloji",
          options: ["Aort", "Ven", "Kapak"],
          correct: 2,
          explanation: "Aciklama 1<br>Detay",
        },
        {
          q: "Soru 2",
          subject: "Nöroloji",
          options: ["Korteks", "Omurilik"],
          correct: 0,
          explanation: "Aciklama 2",
        },
      ],
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Çoktan Seçmeli Test - Test Çıktısı</title>");
    expect(html).toContain("<h1>Çoktan Seçmeli Test</h1>");
    expect(html).toContain("Soru 1 - Kardiyoloji");
    expect(html).toContain("Soru 2 - Nöroloji");
    expect(html).toContain("C) Kapak ✓");
    expect(html).toContain('<div class="explanation">Aciklama 1<br>Detay</div>');
  });

  it("generates downloadable json, markdown, and csv payloads", async () => {
    const questions = [
      {
        q: "Soru 1",
        subject: "Kardiyoloji",
        options: ["Aort", "Ven", "Kapak"],
        correct: 2,
        explanation: "Açıklama",
      },
    ];

    await expect(generateJson(questions, "Demo").text()).resolves.toContain('"setName": "Demo"');
    await expect(generateMarkdown(questions, "Demo").text()).resolves.toContain("# Demo");
    await expect(generateCsv(questions).text()).resolves.toContain("Doğru Cevap");
  });
});
