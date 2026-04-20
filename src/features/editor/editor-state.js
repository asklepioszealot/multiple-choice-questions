const globalScope = typeof window !== "undefined" ? window : globalThis;

function fallbackHtmlToEditableText(value) {
  return String(value ?? "")
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
    .replace(/<[^>]+>/g, "")
    .trim();
}

function fallbackFormatEditableText(value) {
  return String(value ?? "")
    .trim()
    .split("\n")
    .filter((line, index, lines) => line.trim() || index < lines.length - 1)
    .join("<br>");
}

function fallbackSerializeJson(record) {
  return JSON.stringify(
    {
      setName: record.setName,
      questions: record.questions,
    },
    null,
    2,
  );
}

function fallbackBuildSetRecord(record, options = {}) {
  const previousRecord =
    options.previousRecord && typeof options.previousRecord === "object"
      ? options.previousRecord
      : {};
  const sourceFormat =
    typeof record?.sourceFormat === "string" && record.sourceFormat.trim()
      ? record.sourceFormat.trim()
      : typeof previousRecord.sourceFormat === "string" &&
          previousRecord.sourceFormat.trim()
        ? previousRecord.sourceFormat.trim()
        : "json";
  const fileName =
    typeof record?.fileName === "string" && record.fileName.trim()
      ? record.fileName.trim()
      : typeof previousRecord.fileName === "string" && previousRecord.fileName.trim()
        ? previousRecord.fileName.trim()
        : `set.${sourceFormat === "markdown" ? "md" : "json"}`;

  const builtRecord = {
    ...previousRecord,
    ...record,
    fileName,
    sourceFormat,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...builtRecord,
    rawSource:
      sourceFormat === "markdown"
        ? String(builtRecord.rawSource || "").trim()
        : fallbackSerializeJson(builtRecord),
  };
}

function fallbackParseSetText(rawText, fileName, existingRecord, sourceFormatOverride) {
  const sourceFormat =
    sourceFormatOverride === "markdown" ||
    /\.(md|txt)$/i.test(String(fileName || existingRecord?.fileName || ""))
      ? "markdown"
      : "json";

  if (sourceFormat === "markdown") {
    throw new Error("Markdown codec is not available.");
  }

  const parsed = JSON.parse(String(rawText || ""));
  return fallbackBuildSetRecord(
    {
      ...existingRecord,
      ...parsed,
      fileName: fileName || existingRecord?.fileName || "set.json",
      sourceFormat,
      rawSource: String(rawText || ""),
    },
    { previousRecord: existingRecord },
  );
}

export function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function resolveEditorCodecHelpers(overrides = {}) {
  const codec = overrides.codec || globalScope.AppSetCodec || {};

  return {
    buildSetRecord:
      typeof overrides.buildSetRecord === "function"
        ? overrides.buildSetRecord
        : typeof codec.buildSetRecord === "function"
          ? codec.buildSetRecord
          : fallbackBuildSetRecord,
    formatEditableText:
      typeof overrides.formatEditableText === "function"
        ? overrides.formatEditableText
        : typeof codec.formatEditableText === "function"
          ? codec.formatEditableText
          : fallbackFormatEditableText,
    htmlToEditableText:
      typeof overrides.htmlToEditableText === "function"
        ? overrides.htmlToEditableText
        : typeof codec.htmlToEditableText === "function"
          ? codec.htmlToEditableText
          : fallbackHtmlToEditableText,
    parseSetText:
      typeof overrides.parseSetText === "function"
        ? overrides.parseSetText
        : typeof codec.parseSetText === "function"
          ? codec.parseSetText
          : fallbackParseSetText,
    serializeSetRecord:
      typeof overrides.serializeSetRecord === "function"
        ? overrides.serializeSetRecord
        : typeof codec.serializeSetRecord === "function"
          ? codec.serializeSetRecord
          : function fallbackSerializeSetRecord(record, sourceFormatOverride = null) {
              const sourceFormat =
                sourceFormatOverride ||
                (record?.sourceFormat === "markdown" ? "markdown" : "json");
              return sourceFormat === "markdown"
                ? String(record?.rawSource || "")
                : fallbackSerializeJson(record || {});
            },
  };
}

function normalizeEditableQuestion(question, helpers) {
  const normalized = question && typeof question === "object" ? question : {};
  const options = toSafeArray(normalized.options).map((option) =>
    helpers.htmlToEditableText(option),
  );
  while (options.length < 2) {
    options.push("");
  }

  const correctIndex = Number.isInteger(normalized.correct) ? normalized.correct : 0;

  return {
    id:
      typeof normalized.id === "string" || typeof normalized.id === "number"
        ? normalized.id
        : null,
    q: helpers.htmlToEditableText(normalized.q),
    options,
    correct:
      correctIndex >= 0 && correctIndex < options.length ? correctIndex : 0,
    explanation: helpers.htmlToEditableText(normalized.explanation),
    subject:
      typeof normalized.subject === "string" && normalized.subject.trim()
        ? normalized.subject.trim()
        : "Genel",
  };
}

export function createEmptyQuestion() {
  return {
    id: null,
    q: "",
    options: ["", ""],
    correct: 0,
    explanation: "",
    subject: "Genel",
  };
}

export function createEditorDraft(record = {}, helpers = {}) {
  const codec = resolveEditorCodecHelpers(helpers);
  const questions = toSafeArray(record.questions).map((question) =>
    normalizeEditableQuestion(question, codec),
  );
  const sourceFormat =
    typeof record.sourceFormat === "string" && record.sourceFormat.trim()
      ? record.sourceFormat.trim()
      : "json";
  const fileName = Object.prototype.hasOwnProperty.call(record, "fileName")
    ? typeof record.fileName === "string"
      ? record.fileName.trim()
      : ""
    : typeof record.fileName === "string" && record.fileName.trim()
      ? record.fileName.trim()
      : `set.${sourceFormat === "markdown" ? "md" : "json"}`;

  return {
    meta: {
      id: typeof record.id === "string" ? record.id : "",
      slug: typeof record.slug === "string" ? record.slug : "",
      setName: typeof record.setName === "string" ? record.setName : "",
      fileName,
      sourceFormat,
      sourcePath:
        typeof record.sourcePath === "string" ? record.sourcePath : "",
      rawSource:
        typeof record.rawSource === "string" && record.rawSource.trim()
          ? record.rawSource
          : codec.serializeSetRecord(
              {
                ...record,
                fileName,
                sourceFormat,
                questions: toSafeArray(record.questions),
              },
              sourceFormat,
            ),
    },
    questions,
    activeQuestionIndex: questions.length > 0 ? 0 : -1,
    mode: "visual",
  };
}

export function createNewEditorDraft(options = {}, helpers = {}) {
  const sourceFormat = options?.sourceFormat === "json" ? "json" : "markdown";
  return createEditorDraft(
    {
      fileName: "",
      questions: [createEmptyQuestion()],
      rawSource: "",
      setName: "",
      sourceFormat,
      sourcePath: "",
    },
    helpers,
  );
}

export function updateDraftQuestionField(draft, questionIndex, field, value) {
  const nextDraft = {
    ...draft,
    questions: draft.questions.map((question, index) => {
      if (index !== questionIndex) {
        return question;
      }

      const nextQuestion = {
        ...question,
        [field]:
          field === "correct"
            ? Number.isInteger(Number(value))
              ? Number(value)
              : 0
            : String(value ?? ""),
      };

      const options = toSafeArray(nextQuestion.options);
      return {
        ...nextQuestion,
        correct:
          nextQuestion.correct >= 0 && nextQuestion.correct < options.length
            ? nextQuestion.correct
            : 0,
      };
    }),
  };

  return nextDraft;
}

export function addDraftQuestion(draft) {
  const nextQuestions = [...draft.questions, createEmptyQuestion()];
  return {
    ...draft,
    questions: nextQuestions,
    activeQuestionIndex: nextQuestions.length - 1,
  };
}

export function duplicateDraftQuestion(draft, questionIndex) {
  const sourceQuestion = toSafeArray(draft?.questions)[questionIndex];
  if (!sourceQuestion) {
    return draft;
  }

  const duplicatedQuestion = {
    ...sourceQuestion,
    id: null,
    options: toSafeArray(sourceQuestion.options).map((option) => String(option ?? "")),
  };
  const nextQuestions = [...draft.questions];
  nextQuestions.splice(questionIndex + 1, 0, duplicatedQuestion);

  return {
    ...draft,
    questions: nextQuestions,
    activeQuestionIndex: questionIndex + 1,
  };
}

export function moveDraftQuestion(draft, questionIndex, direction) {
  const questions = toSafeArray(draft?.questions);
  const targetIndex = questionIndex + Number(direction || 0);
  if (
    !questions[questionIndex] ||
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= questions.length
  ) {
    return draft;
  }

  const nextQuestions = [...questions];
  const [movedQuestion] = nextQuestions.splice(questionIndex, 1);
  nextQuestions.splice(targetIndex, 0, movedQuestion);

  return {
    ...draft,
    questions: nextQuestions,
    activeQuestionIndex: targetIndex,
  };
}

export function addDraftOption(draft, questionIndex) {
  return {
    ...draft,
    questions: draft.questions.map((question, index) =>
      index === questionIndex
        ? {
            ...question,
            options: [...question.options, ""],
          }
        : question,
    ),
  };
}

export function removeDraftOption(draft, questionIndex, optionIndex) {
  return {
    ...draft,
    questions: draft.questions.map((question, index) => {
      if (index !== questionIndex) {
        return question;
      }

      const nextOptions = question.options.filter(
        (_, currentIndex) => currentIndex !== optionIndex,
      );
      return {
        ...question,
        options: nextOptions.length >= 2 ? nextOptions : ["", ""],
        correct: question.correct >= nextOptions.length ? 0 : question.correct,
      };
    }),
  };
}

export function updateDraftOptionValue(draft, questionIndex, optionIndex, value) {
  return {
    ...draft,
    questions: draft.questions.map((question, index) => {
      if (index !== questionIndex) {
        return question;
      }

      return {
        ...question,
        options: question.options.map((option, currentIndex) =>
          currentIndex === optionIndex ? String(value ?? "") : option,
        ),
      };
    }),
  };
}

export function removeDraftQuestion(draft, questionIndex) {
  const nextQuestions = draft.questions.filter((_, index) => index !== questionIndex);
  return {
    ...draft,
    questions: nextQuestions,
    activeQuestionIndex:
      nextQuestions.length === 0
        ? -1
        : Math.min(draft.activeQuestionIndex, nextQuestions.length - 1),
  };
}
