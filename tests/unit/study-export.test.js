import { describe, expect, it } from "vitest";
import { buildPrintableStudyHtml } from "../../src/features/study/study-export.js";

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
});
