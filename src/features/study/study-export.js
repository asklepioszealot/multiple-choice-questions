(function attachStudyExport(globalScope) {
  "use strict";

  function buildPrintableStudyHtml({
    title = "Çoktan Seçmeli Test",
    questions,
    getExplanationHtml,
  }) {
    const printableQuestions = Array.isArray(questions) ? questions : [];
    const resolveExplanation =
      typeof getExplanationHtml === "function"
        ? getExplanationHtml
        : (question) => question?.explanation || "";
    const labels = ["A", "B", "C", "D", "E"];

    let html =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' +
      title +
      " - Test Çıktısı</title>";
    html += "<style>";
    html +=
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #21302a; line-height: 1.6; }';
    html +=
      ".question { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; page-break-inside: avoid; }";
    html +=
      ".q-num { font-weight: 700; color: #2f7a56; margin-bottom: 8px; }";
    html += ".q-text { font-size: 16px; margin-bottom: 12px; }";
    html += ".option { padding: 4px 0; }";
    html += ".option.correct { color: #059669; font-weight: 600; }";
    html +=
      ".explanation { margin-top: 12px; padding: 12px; background: #f0fdf4; border-radius: 6px; font-size: 14px; border-left: 3px solid #2f7a56; }";
    html += "h1 { text-align: center; color: #2f7a56; }";
    html += "@media print { .question { border: 1px solid #ccc; } }";
    html += "</style></head><body><h1>" + title + "</h1>";

    printableQuestions.forEach((question, index) => {
      html += '<div class="question">';
      html +=
        '<div class="q-num">Soru ' +
        (index + 1) +
        " - " +
        (question?.subject || "") +
        "</div>";
      html += '<div class="q-text">' + (question?.q || "") + "</div>";

      (Array.isArray(question?.options) ? question.options : []).forEach(
        (option, optionIndex) => {
          const isCorrect = optionIndex === question?.correct;
          html +=
            '<div class="option' +
            (isCorrect ? " correct" : "") +
            '">' +
            (labels[optionIndex] || String(optionIndex + 1)) +
            ") " +
            option +
            (isCorrect ? " ✓" : "") +
            "</div>";
        },
      );

      html +=
        '<div class="explanation">' +
        resolveExplanation(question).replace(/<br>/g, "<br>") +
        "</div>";
      html += "</div>";
    });

    html += "</body></html>";
    return html;
  }

  const AppStudyExport = Object.freeze({
    buildPrintableStudyHtml,
  });

  globalScope.AppStudyExport = AppStudyExport;

  if (typeof exports !== "undefined") {
    exports.buildPrintableStudyHtml = buildPrintableStudyHtml;
    exports.AppStudyExport = AppStudyExport;
    exports.default = AppStudyExport;
  }
})(typeof window !== "undefined" ? window : globalThis);
