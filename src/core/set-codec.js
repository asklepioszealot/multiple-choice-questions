(function attachSetCodec(globalScope) {
  "use strict";

  function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function decodeHtmlEntities(value) {
    return String(value ?? "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  function normalizeEditableText(value) {
    return String(value ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function processFormatting(text) {
    return String(text ?? "")
      .replace(/==([^=]+)==/g, '<strong class="highlight-critical">$1</strong>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/^(?:> )?⚠️(.*)$/gm, '<span class="highlight-important">⚠️$1</span>');
  }

  function formatEditableText(value) {
    const normalized = normalizeEditableText(value);
    if (!normalized) {
      return "";
    }

    return normalized
      .split("\n")
      .map((line) => processFormatting(line))
      .join("<br>");
  }

  function htmlToEditableText(value) {
    return decodeHtmlEntities(
      String(value ?? "")
        .replace(
          /<strong\s+class=['"]highlight-critical['"]>(.*?)<\/strong>/gi,
          "==$1==",
        )
        .replace(
          /<span\s+class=['"]highlight-important['"]>\s*⚠️(.*?)<\/span>/gi,
          "> ⚠️$1",
        )
        .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
        .replace(/<em>(.*?)<\/em>/gi, "*$1*")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<p>/gi, "")
        .replace(/<[^>]+>/g, ""),
    )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function slugify(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "set";
  }

  function detectSourceFormat(fileName = "", override = "") {
    if (typeof override === "string" && override.trim()) {
      return override.trim().toLowerCase() === "markdown" ? "markdown" : "json";
    }

    return /\.(md|txt)$/i.test(String(fileName || "").trim()) ? "markdown" : "json";
  }

  function buildDefaultFileName(setName, sourceFormat) {
    return `${slugify(setName || "set")}.${sourceFormat === "markdown" ? "md" : "json"}`;
  }

  function resolveQuestionId(question, previousQuestions, index) {
    if (
      question &&
      (typeof question.id === "string" || typeof question.id === "number") &&
      String(question.id).trim()
    ) {
      return question.id;
    }

    const previousQuestion = previousQuestions[index];
    if (
      previousQuestion &&
      (typeof previousQuestion.id === "string" || typeof previousQuestion.id === "number") &&
      String(previousQuestion.id).trim()
    ) {
      return previousQuestion.id;
    }

    return null;
  }

  function normalizeQuestion(question, previousQuestions = [], index = 0) {
    const normalized = question && typeof question === "object" ? question : {};
    const options = toSafeArray(normalized.options).map((option) =>
      typeof option === "string" ? option : String(option ?? ""),
    );

    return {
      q: typeof normalized.q === "string" ? normalized.q : "",
      options,
      correct: Number.isInteger(normalized.correct) ? normalized.correct : -1,
      explanation:
        typeof normalized.explanation === "string" ? normalized.explanation : "",
      subject:
        typeof normalized.subject === "string" && normalized.subject.trim()
          ? normalized.subject.trim()
          : "Genel",
      id: resolveQuestionId(normalized, previousQuestions, index),
    };
  }

  function normalizeQuestions(data, previousQuestions = []) {
    return toSafeArray(data?.questions)
      .filter(
        (question) =>
          question && typeof question === "object" && !Array.isArray(question),
      )
      .map((question, index) => normalizeQuestion(question, previousQuestions, index));
  }

  function normalizeSetRecord(record, options = {}) {
    const previousRecord =
      options.previousRecord && typeof options.previousRecord === "object"
        ? options.previousRecord
        : {};
    const normalizedRecord = record && typeof record === "object" ? record : {};
    const setName =
      typeof normalizedRecord.setName === "string" && normalizedRecord.setName.trim()
        ? normalizedRecord.setName.trim()
        : typeof previousRecord.setName === "string" && previousRecord.setName.trim()
          ? previousRecord.setName.trim()
          : "Set";
    const sourceFormat = detectSourceFormat(
      normalizedRecord.fileName || previousRecord.fileName || "",
      normalizedRecord.sourceFormat || previousRecord.sourceFormat || "",
    );
    const fileName =
      typeof normalizedRecord.fileName === "string" && normalizedRecord.fileName.trim()
        ? normalizedRecord.fileName.trim()
        : typeof previousRecord.fileName === "string" && previousRecord.fileName.trim()
          ? previousRecord.fileName.trim()
          : buildDefaultFileName(setName, sourceFormat);
    const setId =
      typeof normalizedRecord.id === "string" && normalizedRecord.id.trim()
        ? normalizedRecord.id.trim()
        : typeof previousRecord.id === "string" && previousRecord.id.trim()
          ? previousRecord.id.trim()
          : fileName.replace(/\.[^/.]+$/, "");
    const hasExplicitSourcePath = Object.prototype.hasOwnProperty.call(
      normalizedRecord,
      "sourcePath",
    );
    const sourcePath = hasExplicitSourcePath
      ? String(normalizedRecord.sourcePath || "").trim()
      : typeof previousRecord.sourcePath === "string" && previousRecord.sourcePath.trim()
        ? previousRecord.sourcePath.trim()
        : "";

    return {
      id: setId,
      slug:
        typeof normalizedRecord.slug === "string" && normalizedRecord.slug.trim()
          ? normalizedRecord.slug.trim()
          : typeof previousRecord.slug === "string" && previousRecord.slug.trim()
            ? previousRecord.slug.trim()
            : slugify(setName),
      setName,
      fileName,
      sourceFormat,
      rawSource:
        typeof normalizedRecord.rawSource === "string"
          ? normalizedRecord.rawSource
          : typeof previousRecord.rawSource === "string"
            ? previousRecord.rawSource
            : "",
      sourcePath,
      updatedAt:
        typeof normalizedRecord.updatedAt === "string" &&
        normalizedRecord.updatedAt.trim()
          ? normalizedRecord.updatedAt.trim()
          : typeof previousRecord.updatedAt === "string" &&
              previousRecord.updatedAt.trim()
            ? previousRecord.updatedAt.trim()
            : new Date().toISOString(),
      questions: normalizeQuestions(
        { questions: normalizedRecord.questions },
        toSafeArray(previousRecord.questions),
      ),
    };
  }

  function finalizeMarkdownQuestion(currentQuestion, explanationLines) {
    if (!currentQuestion) {
      return null;
    }

    if (explanationLines.length > 0) {
      currentQuestion.explanation = explanationLines.join("<br>").trim();
    }

    return currentQuestion;
  }

  function parseMarkdownToJSON(content, fileName, options = {}) {
    const lines = String(content ?? "").replace(/\r/g, "").split("\n");
    const fileStem = (fileName || "set").replace(/\.[^/.]+$/, "");
    const previousQuestions = toSafeArray(options.previousRecord?.questions);
    const result = {
      setName: fileStem,
      questions: [],
    };

    let currentQuestion = null;
    let currentQuestionIndex = -1;
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
      const soruNumberedMatch = normalizedLine.match(
        /^Soru\s+\d+[.)]?\s*(?::\s*(.*))?$/i,
      );
      if (soruInlineMatch || soruNumberedMatch) {
        const finalizedQuestion = finalizeMarkdownQuestion(
          currentQuestion,
          explanationLines,
        );
        if (finalizedQuestion) {
          result.questions.push(
            normalizeQuestion(
              finalizedQuestion,
              previousQuestions,
              currentQuestionIndex,
            ),
          );
        }

        currentQuestionIndex += 1;
        const qText = (
          soruInlineMatch ? soruInlineMatch[1] : soruNumberedMatch[1] || ""
        ).trim();
        currentQuestion = {
          q: processFormatting(qText),
          options: [],
          correct: -1,
          explanation: "",
          subject: canonicalSubject,
          id: resolveQuestionId({}, previousQuestions, currentQuestionIndex),
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

      const explanationStartMatch = normalizedLine.match(
        /^(?:Açıklama|Aciklama):\s*(.*)$/i,
      );
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

    const finalizedQuestion = finalizeMarkdownQuestion(currentQuestion, explanationLines);
    if (finalizedQuestion) {
      result.questions.push(
        normalizeQuestion(finalizedQuestion, previousQuestions, currentQuestionIndex),
      );
    }

    return result;
  }

  function parseJsonToPayload(content) {
    const cleanText = String(content || "").replace(/,\s*([\]}])/g, "$1");
    const parsed = JSON.parse(cleanText);
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  function parseSetText(text, fileName, existingRecord = null, sourceFormatOverride = null) {
    const sourceFormat = detectSourceFormat(
      fileName || existingRecord?.fileName || "",
      sourceFormatOverride || existingRecord?.sourceFormat || "",
    );
    const parsedPayload =
      sourceFormat === "markdown"
        ? parseMarkdownToJSON(text, fileName, { previousRecord: existingRecord })
        : parseJsonToPayload(text);

    const normalized = normalizeSetRecord(
      {
        ...existingRecord,
        ...parsedPayload,
        fileName:
          typeof fileName === "string" && fileName.trim()
            ? fileName.trim()
            : existingRecord?.fileName,
        sourceFormat,
        rawSource: String(text ?? ""),
        updatedAt: new Date().toISOString(),
      },
      { previousRecord: existingRecord },
    );

    return normalized;
  }

  function serializeQuestionToJson(question) {
    const serialized = {
      q: question.q,
      options: question.options,
      correct: question.correct,
      explanation: question.explanation,
      subject: question.subject,
    };

    if (
      question.id !== null &&
      question.id !== undefined &&
      String(question.id).trim()
    ) {
      serialized.id = question.id;
    }

    return serialized;
  }

  function serializeSetToJson(setRecord) {
    const normalized = normalizeSetRecord(setRecord, { previousRecord: setRecord });
    return JSON.stringify(
      {
        setName: normalized.setName,
        questions: normalized.questions.map(serializeQuestionToJson),
      },
      null,
      2,
    );
  }

  function serializeSetToMarkdown(setRecord) {
    const normalized = normalizeSetRecord(setRecord, { previousRecord: setRecord });
    const lines = [`# ${normalizeEditableText(normalized.setName) || "Set"}`, ""];

    normalized.questions.forEach((question, index) => {
      const questionText = htmlToEditableText(question.q);
      lines.push(`Soru ${index + 1}: ${questionText}`);
      if (question.subject) {
        lines.push(`Konu: ${question.subject}`);
      }

      question.options.forEach((option, optionIndex) => {
        lines.push(
          `${String.fromCharCode(65 + optionIndex)}) ${htmlToEditableText(option)}`,
        );
      });

      if (question.correct >= 0 && question.correct < question.options.length) {
        lines.push(`Doğru Cevap: ${String.fromCharCode(65 + question.correct)}`);
      }

      const explanation = htmlToEditableText(question.explanation);
      if (explanation) {
        const explanationLines = explanation.split("\n");
        lines.push(`Açıklama: ${explanationLines[0] || ""}`);
        explanationLines.slice(1).forEach((line) => {
          lines.push(line);
        });
      }

      if (index < normalized.questions.length - 1) {
        lines.push("");
      }
    });

    return lines.join("\n").trim();
  }

  function serializeSetRecord(setRecord, sourceFormatOverride = null) {
    const normalized = normalizeSetRecord(setRecord, { previousRecord: setRecord });
    const sourceFormat = detectSourceFormat(
      normalized.fileName,
      sourceFormatOverride || normalized.sourceFormat,
    );

    return sourceFormat === "markdown"
      ? serializeSetToMarkdown(normalized)
      : serializeSetToJson(normalized);
  }

  function buildSetRecord(record, options = {}) {
    const normalized = normalizeSetRecord(record, {
      previousRecord: options.previousRecord || null,
    });
    return {
      ...normalized,
      rawSource: serializeSetRecord(normalized, normalized.sourceFormat),
      updatedAt: new Date().toISOString(),
    };
  }

  const AppSetCodec = Object.freeze({
    buildSetRecord,
    detectSourceFormat,
    formatEditableText,
    htmlToEditableText,
    normalizeQuestions,
    normalizeSetRecord,
    parseMarkdownToJSON,
    parseSetText,
    serializeSetRecord,
    serializeSetToJson,
    serializeSetToMarkdown,
  });

  globalScope.AppSetCodec = AppSetCodec;

  if (typeof exports !== "undefined") {
    exports.buildSetRecord = buildSetRecord;
    exports.detectSourceFormat = detectSourceFormat;
    exports.formatEditableText = formatEditableText;
    exports.htmlToEditableText = htmlToEditableText;
    exports.normalizeQuestions = normalizeQuestions;
    exports.normalizeSetRecord = normalizeSetRecord;
    exports.parseMarkdownToJSON = parseMarkdownToJSON;
    exports.parseSetText = parseSetText;
    exports.serializeSetRecord = serializeSetRecord;
    exports.serializeSetToJson = serializeSetToJson;
    exports.serializeSetToMarkdown = serializeSetToMarkdown;
    exports.AppSetCodec = AppSetCodec;
    exports.default = AppSetCodec;
  }
})(typeof window !== "undefined" ? window : globalThis);
