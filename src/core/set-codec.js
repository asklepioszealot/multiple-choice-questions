(function attachSetCodec(globalScope) {
  "use strict";

  function processFormatting(text) {
    return String(text ?? "")
      .replace(/==([^=]+)==/g, '<strong class="highlight-critical">$1</strong>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/^(?:> )?⚠️(.*)$/gm, '<span class="highlight-important">⚠️$1</span>');
  }

  function parseMarkdownToJSON(content, fileName) {
    const lines = String(content ?? "").split("\n");
    const fileStem = (fileName || "set").replace(/\.[^/.]+$/, "");
    const result = {
      setName: fileStem,
      questions: [],
    };

    let currentQuestion = null;
    let canonicalSubject = fileStem;
    let capturingExplanation = false;
    let explanationLines = [];
    let awaitingQuestionText = false;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;

      const normalizedLine = line.replace(/^\*\*(.*?)\*\*$/, "$1").trim();
      const h1Match = normalizedLine.match(/^#\s+(.+)$/);
      if (h1Match) {
        const h1Title = h1Match[1].trim();
        if (canonicalSubject === fileStem) {
          result.setName = h1Title;
          canonicalSubject = h1Title;
        }
        continue;
      }

      const h2Match = normalizedLine.match(/^##\s+(.+)$/);
      if (h2Match) {
        continue;
      }

      if (/^[-*_]{3,}$/.test(normalizedLine)) {
        continue;
      }

      const konuMatch = normalizedLine.match(/^#{0,3}\s*Konu:\s*(.+)$/i);
      if (konuMatch) {
        if (currentQuestion) currentQuestion.subject = konuMatch[1].trim();
        continue;
      }

      const soruInlineMatch = normalizedLine.match(/^Soru:\s*(.+)$/i);
      const soruNumberedMatch = normalizedLine.match(/^Soru\s+\d+[.)]?\s*(?::\s*(.*))?$/i);
      if (soruInlineMatch || soruNumberedMatch) {
        if (currentQuestion) {
          if (capturingExplanation) {
            currentQuestion.explanation = explanationLines.join("<br>").trim();
          }
          result.questions.push(currentQuestion);
        }

        const qText = (soruInlineMatch ? soruInlineMatch[1] : soruNumberedMatch[1] || "").trim();
        currentQuestion = {
          q: processFormatting(qText),
          options: [],
          correct: -1,
          explanation: "",
          subject: canonicalSubject,
        };
        capturingExplanation = false;
        explanationLines = [];
        awaitingQuestionText = qText.length === 0;
        continue;
      }

      if (awaitingQuestionText && currentQuestion) {
        currentQuestion.q = processFormatting(normalizedLine);
        awaitingQuestionText = false;
        continue;
      }

      const optionMatch = normalizedLine.match(/^([A-Ea-e])[).]\s+(.+)$/);
      if (optionMatch && currentQuestion && !capturingExplanation) {
        currentQuestion.options.push(processFormatting(optionMatch[2].trim()));
        continue;
      }

      const correctMatch = normalizedLine.match(/^Do(?:ğ|g)ru\s*Cevap:\s*([A-Ea-e])\b/i);
      if (correctMatch) {
        const correctChar = correctMatch[1].toUpperCase();
        if (currentQuestion) {
          currentQuestion.correct = correctChar.charCodeAt(0) - 65;
        }
        continue;
      }

      const explanationStartMatch = normalizedLine.match(/^(?:Açıklama|Aciklama):\s*(.*)$/i);
      if (explanationStartMatch) {
        capturingExplanation = true;
        explanationLines.push(processFormatting(explanationStartMatch[1].trim()));
        continue;
      }

      const blockquoteMatch = line.match(/^>\s?(.*)$/);
      if (blockquoteMatch && currentQuestion) {
        capturingExplanation = true;
        explanationLines.push(processFormatting(blockquoteMatch[1].trim()));
        continue;
      }

      if (capturingExplanation) {
        explanationLines.push(processFormatting(normalizedLine));
      }
    }

    if (currentQuestion) {
      if (capturingExplanation) {
        currentQuestion.explanation = explanationLines.join("<br>").trim();
      }
      result.questions.push(currentQuestion);
    }

    return result;
  }

  function normalizeQuestions(data) {
    return Array.isArray(data?.questions)
      ? data.questions
          .filter((question) => question && typeof question === "object" && !Array.isArray(question))
          .map((question) => ({
            q: typeof question.q === "string" ? question.q : "",
            options: Array.isArray(question.options)
              ? question.options.filter((option) => typeof option === "string")
              : [],
            correct: Number.isInteger(question.correct) ? question.correct : -1,
            explanation: typeof question.explanation === "string" ? question.explanation : "",
            subject:
              typeof question.subject === "string" && question.subject.trim()
                ? question.subject
                : "Genel",
            id:
              typeof question.id === "string" || typeof question.id === "number"
                ? question.id
                : null,
          }))
      : [];
  }

  const AppSetCodec = Object.freeze({
    parseMarkdownToJSON,
    normalizeQuestions,
  });

  globalScope.AppSetCodec = AppSetCodec;

  if (typeof exports !== "undefined") {
    exports.parseMarkdownToJSON = parseMarkdownToJSON;
    exports.normalizeQuestions = normalizeQuestions;
    exports.AppSetCodec = AppSetCodec;
    exports.default = AppSetCodec;
  }
})(typeof window !== "undefined" ? window : globalThis);
