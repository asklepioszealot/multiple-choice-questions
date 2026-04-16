(function attachEditorFeature(globalScope) {
  "use strict";

  function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

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

  function resolveCodecHelpers(overrides = {}) {
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

  function createEmptyQuestion() {
    return {
      id: null,
      q: "",
      options: ["", ""],
      correct: 0,
      explanation: "",
      subject: "Genel",
    };
  }

  function createEditorDraft(record = {}, helpers = {}) {
    const codec = resolveCodecHelpers(helpers);
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

  function createNewEditorDraft(options = {}, helpers = {}) {
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

  function updateDraftQuestionField(draft, questionIndex, field, value) {
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

  function addDraftQuestion(draft) {
    const nextQuestions = [...draft.questions, createEmptyQuestion()];
    return {
      ...draft,
      questions: nextQuestions,
      activeQuestionIndex: nextQuestions.length - 1,
    };
  }

  function duplicateDraftQuestion(draft, questionIndex) {
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

  function moveDraftQuestion(draft, questionIndex, direction) {
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

  function buildRecordFromDraft(draft, baseRecord = {}, helpers = {}) {
    const codec = resolveCodecHelpers(helpers);
    const draftQuestions = toSafeArray(draft.questions).filter(
      (question) =>
        String(question?.q || "").trim() ||
        toSafeArray(question?.options).some((option) => String(option || "").trim()),
    );

    return codec.buildSetRecord(
      {
        ...baseRecord,
        id: draft.meta.id || baseRecord.id || "",
        slug: draft.meta.slug || baseRecord.slug || "",
        setName: draft.meta.setName || baseRecord.setName || "",
        fileName:
          typeof draft?.meta?.fileName === "string"
            ? draft.meta.fileName
            : typeof baseRecord?.fileName === "string"
              ? baseRecord.fileName
              : "",
        sourceFormat:
          draft.meta.sourceFormat || baseRecord.sourceFormat || "json",
        questions: draftQuestions.map((question) => ({
          id: question.id,
          q: codec.formatEditableText(question.q),
          options: toSafeArray(question.options).map((option) =>
            codec.formatEditableText(option),
          ),
          correct: Number.isInteger(question.correct) ? question.correct : 0,
          explanation: codec.formatEditableText(question.explanation),
          subject:
            typeof question.subject === "string" && question.subject.trim()
              ? question.subject.trim()
              : "Genel",
        })),
      },
      { previousRecord: baseRecord },
    );
  }

  function parseRawEditorDraft(rawText, baseRecord = {}, helpers = {}) {
    const codec = resolveCodecHelpers(helpers);
    const parsedRecord = codec.parseSetText(
      rawText,
      baseRecord.fileName,
      baseRecord,
      baseRecord.sourceFormat,
    );

    return createEditorDraft(parsedRecord, codec);
  }

  function serializeEditorDraft(draft, baseRecord = {}, helpers = {}) {
    return buildRecordFromDraft(draft, baseRecord, helpers);
  }

  function getEditorValidationIssues(draft) {
    const issues = [];

    if (!draft) {
      return [
        {
          code: "editor-not-ready",
          message: "Editor hazir degil.",
          questionIndex: -1,
        },
      ];
    }

    if (!String(draft?.meta?.setName || "").trim()) {
      issues.push({
        code: "missing-set-name",
        message: "Set adi bos olamaz.",
        questionIndex: -1,
      });
    }

    if (toSafeArray(draft.questions).length === 0) {
      issues.push({
        code: "missing-questions",
        message: "En az bir soru gerekli.",
        questionIndex: -1,
      });
    }

    toSafeArray(draft.questions).forEach((question, index) => {
      const optionValues = toSafeArray(question?.options).map((option) =>
        String(option || "").trim(),
      );
      const filledOptions = toSafeArray(question?.options).filter((option) =>
        String(option || "").trim(),
      );
      if (!String(question?.q || "").trim()) {
        issues.push({
          code: "missing-question-text",
          message: `Soru ${index + 1}: Soru metni gerekli.`,
          questionIndex: index,
        });
      }
      if (filledOptions.length < 2) {
        issues.push({
          code: "underfilled-options",
          message: `Soru ${index + 1}: En az iki dolu secenek gerekli.`,
          questionIndex: index,
        });
      }
      if (filledOptions.length >= 2 && optionValues.some((option) => !option)) {
        issues.push({
          code: "blank-option",
          message: `Soru ${index + 1}: Bos secenekleri doldur veya sil.`,
          questionIndex: index,
        });
      }

      const correctIndex = Number.isInteger(question?.correct) ? question.correct : -1;
      if (
        correctIndex < 0 ||
        correctIndex >= optionValues.length ||
        !String(optionValues[correctIndex] || "").trim()
      ) {
        issues.push({
          code: "invalid-correct-answer",
          message: `Soru ${index + 1}: Dogru cevap gecerli bir secenegi gostermeli.`,
          questionIndex: index,
        });
      }
    });

    return issues;
  }

  function validateEditorDraft(draft) {
    const issues = getEditorValidationIssues(draft);
    if (issues.length > 0) {
      return issues[0].message;
    }

    return "";
  }

  function addDraftOption(draft, questionIndex) {
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

  function removeDraftOption(draft, questionIndex, optionIndex) {
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

  function updateDraftOptionValue(draft, questionIndex, optionIndex, value) {
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

  function removeDraftQuestion(draft, questionIndex) {
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

  function createDownload(documentRef, payload, fileName, mimeType) {
    const blob = new Blob([payload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = documentRef.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return payload;
  }

  function createEditorFeature({
    buildSetRecord,
    documentRef = globalScope.document,
    formatEditableText,
    htmlToEditableText,
    parseSetText,
    serializeSetRecord,
    showScreen,
    saveSetRecord,
    writeSourceFile,
    confirmRef = globalScope.confirm?.bind(globalScope),
  } = {}) {
    const codecHelpers = resolveCodecHelpers({
      buildSetRecord,
      formatEditableText,
      htmlToEditableText,
      parseSetText,
      serializeSetRecord,
    });
    const showScreenRef =
      typeof showScreen === "function" ? showScreen : function noop() {};
    const saveSetRecordRef =
      typeof saveSetRecord === "function"
        ? saveSetRecord
        : async function fallbackSave(record) {
            return record;
          };
    const writeSourceFileRef =
      typeof writeSourceFile === "function" ? writeSourceFile : null;

    let draft = null;
    let statusMessage = "";
    let statusTone = "";
    let baselineSignature = "";

    function getCurrentQuestion() {
      if (!draft || draft.activeQuestionIndex < 0) {
        return null;
      }

      return draft.questions[draft.activeQuestionIndex] || null;
    }

    function getActiveFormatLabel() {
      return draft?.meta?.sourceFormat === "markdown" ? "Markdown/TXT" : "JSON";
    }

    function buildPreviewRecord() {
      if (!draft) {
        return null;
      }

      return serializeEditorDraft(draft, draft.meta, codecHelpers);
    }

    function buildDraftSignature(currentDraft) {
      if (!currentDraft) {
        return "";
      }

      return JSON.stringify({
        setName: String(currentDraft?.meta?.setName || "").trim(),
        fileName: String(currentDraft?.meta?.fileName || "").trim(),
        sourceFormat: String(currentDraft?.meta?.sourceFormat || "").trim(),
        sourcePath: String(currentDraft?.meta?.sourcePath || "").trim(),
        questions: toSafeArray(currentDraft.questions).map((question) => ({
          q: String(question?.q || ""),
          options: toSafeArray(question?.options).map((option) => String(option || "")),
          correct: Number.isInteger(question?.correct) ? question.correct : 0,
          explanation: String(question?.explanation || ""),
          subject: String(question?.subject || ""),
        })),
      });
    }

    function isDirty() {
      return Boolean(draft) && buildDraftSignature(draft) !== baselineSignature;
    }

    function shouldPreventUnload() {
      return isDirty();
    }

    function getValidationIssues() {
      return getEditorValidationIssues(draft);
    }

    function canSave() {
      return getValidationIssues().length === 0;
    }

    function setStatus(message = "", tone = "") {
      statusMessage = message;
      statusTone = tone;
      const statusEl = documentRef?.getElementById("editor-status");
      if (!statusEl) {
        return;
      }

      statusEl.textContent = statusMessage;
      statusEl.className = tone ? `auth-status ${tone}` : "auth-status";
    }

    function renderQuestionList(validationIssues = []) {
      const listEl = documentRef?.getElementById("editor-question-list");
      if (!listEl || !draft) {
        return;
      }

      const issueIndexes = new Set(
        validationIssues
          .map((issue) => issue?.questionIndex)
          .filter((questionIndex) => Number.isInteger(questionIndex) && questionIndex >= 0),
      );

      listEl.innerHTML = draft.questions
        .map((question, index) => {
          const activeClass =
            index === draft.activeQuestionIndex
              ? " editor-question-item active"
              : " editor-question-item";
          const label = question.q.trim() || `Soru ${index + 1}`;
          const issueMarker = issueIndexes.has(index) ? " ! " : "";
          return `<button class="${activeClass.trim()}" onclick="selectEditorQuestion(${index})">${issueMarker}${label}</button>`;
        })
        .join("");
    }

    function renderValidationSummary(validationIssues = []) {
      const summaryEl = documentRef?.getElementById("editor-validation-summary");
      if (!summaryEl) {
        return;
      }

      if (!draft) {
        summaryEl.textContent = "";
        summaryEl.className = "auth-status";
        return;
      }

      if (validationIssues.length === 0) {
        summaryEl.textContent = "Kaydetmeye hazir.";
        summaryEl.className = "auth-status success editor-validation-summary";
        return;
      }

      summaryEl.className = "auth-status error editor-validation-summary";
      summaryEl.innerHTML = [
        `<strong>${validationIssues.length} sorun cozulmeli.</strong>`,
        '<ul class="editor-validation-list">',
        ...validationIssues.map((issue) => {
          const jumpTarget =
            Number.isInteger(issue.questionIndex) && issue.questionIndex >= 0
              ? `<button class="btn btn-small btn-secondary" type="button" onclick="selectEditorQuestion(${issue.questionIndex})">Soru ${issue.questionIndex + 1}</button>`
              : '<span class="auth-meta">Genel</span>';
          return `<li class="editor-validation-item">${jumpTarget}<span>${issue.message}</span></li>`;
        }),
        "</ul>",
      ].join("");
    }

    function renderOptions(question) {
      const optionsEl = documentRef?.getElementById("editor-options");
      const correctSelect = documentRef?.getElementById("editor-correct");
      if (!optionsEl || !correctSelect) {
        return;
      }

      const currentQuestion = question || createEmptyQuestion();
      optionsEl.innerHTML = currentQuestion.options
        .map(
          (option, index) => `
            <div class="editor-option-row">
              <input
                class="auth-input"
                value="${option.replace(/"/g, "&quot;")}"
                onchange="updateEditorOption(${index}, this.value)"
              />
              <button class="btn btn-small btn-secondary" onclick="removeEditorOption(${index})" type="button">Sil</button>
            </div>
          `,
        )
        .join("");

      correctSelect.innerHTML = currentQuestion.options
        .map(
          (_, index) =>
            `<option value="${index}" ${index === currentQuestion.correct ? "selected" : ""}>${String.fromCharCode(65 + index)}</option>`,
        )
        .join("");
    }

    function syncRawEditorHeight(rawInputEl) {
      if (!rawInputEl) {
        return;
      }

      rawInputEl.style.height = "auto";
      const computedStyle =
        typeof globalScope.getComputedStyle === "function"
          ? globalScope.getComputedStyle(rawInputEl)
          : null;
      const borderTopWidth = Number.parseFloat(
        computedStyle?.borderTopWidth || "0",
      );
      const borderBottomWidth = Number.parseFloat(
        computedStyle?.borderBottomWidth || "0",
      );
      rawInputEl.style.height = `${
        rawInputEl.scrollHeight + borderTopWidth + borderBottomWidth
      }px`;
    }

    function render() {
      const screenEl = documentRef?.getElementById("editor-screen");
      const setNameEl = documentRef?.getElementById("editor-set-name");
      const questionTextEl = documentRef?.getElementById("editor-question-text");
      const subjectEl = documentRef?.getElementById("editor-subject");
      const explanationEl = documentRef?.getElementById("editor-explanation");
      const rawInputEl = documentRef?.getElementById("editor-raw-input");
      const visualPanel = documentRef?.getElementById("editor-visual-panel");
      const rawPanel = documentRef?.getElementById("editor-raw-panel");
      const removeQuestionBtn = documentRef?.getElementById(
        "editor-remove-question-btn",
      );
      const rawTabBtn = documentRef?.getElementById("editor-raw-tab-btn");
      const rawLabelEl = documentRef?.getElementById("editor-raw-label");
      const sourceFormatEl = documentRef?.getElementById("editor-source-format-label");
      const sourceExportBtn = documentRef?.getElementById("editor-export-source-btn");
      const duplicateQuestionBtn = documentRef?.getElementById(
        "editor-duplicate-question-btn",
      );
      const moveQuestionUpBtn = documentRef?.getElementById(
        "editor-move-question-up-btn",
      );
      const moveQuestionDownBtn = documentRef?.getElementById(
        "editor-move-question-down-btn",
      );
      const saveBtn = documentRef?.getElementById("editor-save-btn");
      const dirtyPill = documentRef?.getElementById("editor-dirty-pill");

      if (!screenEl || !draft) {
        return;
      }

      const currentQuestion = getCurrentQuestion() || createEmptyQuestion();
      const previewRecord = buildPreviewRecord();
      const formatLabel = getActiveFormatLabel();
      const validationIssues = getValidationIssues();

      if (setNameEl) {
        setNameEl.value = draft.meta.setName;
      }
      if (questionTextEl) {
        questionTextEl.value = currentQuestion.q;
      }
      if (subjectEl) {
        subjectEl.value = currentQuestion.subject;
      }
      if (explanationEl) {
        explanationEl.value = currentQuestion.explanation;
      }
      if (rawInputEl && previewRecord) {
        rawInputEl.value = codecHelpers.serializeSetRecord(
          previewRecord,
          previewRecord.sourceFormat,
        );
      }
      if (visualPanel) {
        visualPanel.style.display = draft.mode === "visual" ? "block" : "none";
      }
      if (rawPanel) {
        rawPanel.style.display = draft.mode === "raw" ? "block" : "none";
      }
      if (rawInputEl) {
        syncRawEditorHeight(rawInputEl);
      }
      if (removeQuestionBtn) {
        removeQuestionBtn.disabled = draft.activeQuestionIndex < 0;
      }
      if (rawTabBtn) {
        rawTabBtn.textContent = `Raw ${formatLabel}`;
      }
      if (rawLabelEl) {
        rawLabelEl.textContent = `Raw ${formatLabel}`;
      }
      if (sourceFormatEl) {
        sourceFormatEl.textContent = `Kaynak format: ${formatLabel}`;
      }
      if (sourceExportBtn) {
        sourceExportBtn.textContent = `${formatLabel} disa aktar`;
      }
      if (duplicateQuestionBtn) {
        duplicateQuestionBtn.disabled = draft.activeQuestionIndex < 0;
      }
      if (moveQuestionUpBtn) {
        moveQuestionUpBtn.disabled = draft.activeQuestionIndex <= 0;
      }
      if (moveQuestionDownBtn) {
        moveQuestionDownBtn.disabled =
          draft.activeQuestionIndex < 0 ||
          draft.activeQuestionIndex >= draft.questions.length - 1;
      }
      if (saveBtn) {
        saveBtn.disabled = validationIssues.length > 0;
      }
      if (dirtyPill) {
        dirtyPill.textContent = `Durum: ${isDirty() ? "Kaydedilmedi" : "Kaydedildi"}`;
      }

      renderQuestionList(validationIssues);
      renderOptions(currentQuestion);
      renderValidationSummary(validationIssues);
      setStatus(statusMessage, statusTone);
    }

    function openEditor(record) {
      draft = createEditorDraft(record, codecHelpers);
      baselineSignature = buildDraftSignature(draft);
      statusMessage = "";
      statusTone = "";
      showScreenRef("editor");
      render();
    }

    function openNewDraft(options = {}) {
      draft = createNewEditorDraft(options, codecHelpers);
      baselineSignature = buildDraftSignature(draft);
      statusMessage = "";
      statusTone = "";
      showScreenRef("editor");
      render();
    }

    function confirmNavigateAway(
      message = "Kaydedilmemis degisiklikler var. Editorden cikmak istedigine emin misin?",
      blockedMessage = "Kaydedilmemis degisiklikler korunuyor.",
    ) {
      if (!isDirty()) {
        return true;
      }

      if (typeof confirmRef === "function" && confirmRef(message) === false) {
        setStatus(blockedMessage, "error");
        render();
        return false;
      }

      return true;
    }

    function closeEditor() {
      if (!confirmNavigateAway()) {
        return false;
      }

      showScreenRef("manager");
      return true;
    }

    function selectQuestion(index) {
      if (!draft) {
        return;
      }

      draft = {
        ...draft,
        activeQuestionIndex: index,
      };
      render();
    }

    function setMode(mode) {
      if (!draft) {
        return;
      }

      draft = {
        ...draft,
        mode: mode === "raw" ? "raw" : "visual",
      };
      render();
    }

    function updateMetaField(field, value) {
      if (!draft) {
        return;
      }

      draft = {
        ...draft,
        meta: {
          ...draft.meta,
          [field]: String(value ?? ""),
        },
      };
      render();
    }

    function updateCurrentQuestionField(field, value) {
      if (!draft || draft.activeQuestionIndex < 0) {
        return;
      }

      draft = updateDraftQuestionField(
        draft,
        draft.activeQuestionIndex,
        field,
        value,
      );
      render();
    }

    function updateCurrentOption(optionIndex, value) {
      if (!draft || draft.activeQuestionIndex < 0) {
        return;
      }

      draft = updateDraftOptionValue(
        draft,
        draft.activeQuestionIndex,
        optionIndex,
        value,
      );
      render();
    }

    function addQuestion() {
      if (!draft) {
        return;
      }

      draft = addDraftQuestion(draft);
      render();
    }

    function duplicateQuestion() {
      if (!draft || draft.activeQuestionIndex < 0) {
        return;
      }

      draft = duplicateDraftQuestion(draft, draft.activeQuestionIndex);
      render();
    }

    function moveQuestion(direction) {
      if (!draft || draft.activeQuestionIndex < 0) {
        return;
      }

      draft = moveDraftQuestion(draft, draft.activeQuestionIndex, direction);
      render();
    }

    function removeQuestion() {
      if (!draft || draft.activeQuestionIndex < 0) {
        return;
      }

      draft = removeDraftQuestion(draft, draft.activeQuestionIndex);
      render();
    }

    function addOption() {
      if (!draft || draft.activeQuestionIndex < 0) {
        return;
      }

      draft = addDraftOption(draft, draft.activeQuestionIndex);
      render();
    }

    function removeOption(optionIndex) {
      if (!draft || draft.activeQuestionIndex < 0) {
        return;
      }

      draft = removeDraftOption(draft, draft.activeQuestionIndex, optionIndex);
      render();
    }

    function applyRaw() {
      if (!draft) {
        return;
      }

      const rawInputEl = documentRef?.getElementById("editor-raw-input");
      try {
        draft = parseRawEditorDraft(
          rawInputEl?.value || "",
          draft.meta,
          codecHelpers,
        );
        setStatus("", "");
        render();
      } catch (error) {
        setStatus(
          error?.message || `Raw ${getActiveFormatLabel()} okunamadi.`,
          "error",
        );
      }
    }

    async function save() {
      const validationIssues = getValidationIssues();
      if (validationIssues.length > 0) {
        setStatus(validationIssues[0].message, "error");
        render();
        return null;
      }

      const record = serializeEditorDraft(draft, draft.meta, codecHelpers);
      const savedRecord = await saveSetRecordRef(record);
      const persistedRecord = savedRecord || record;

      if (
        writeSourceFileRef &&
        typeof persistedRecord?.sourcePath === "string" &&
        persistedRecord.sourcePath.trim()
      ) {
        try {
          await writeSourceFileRef(
            persistedRecord.sourcePath.trim(),
            persistedRecord.rawSource || "",
          );
        } catch (error) {
          draft = createEditorDraft(persistedRecord, codecHelpers);
          baselineSignature = buildDraftSignature(draft);
          setStatus(
            error?.message || "Kaynak dosyaya yazilirken hata olustu.",
            "error",
          );
          render();
          return persistedRecord;
        }
      }

      draft = createEditorDraft(persistedRecord, codecHelpers);
      baselineSignature = buildDraftSignature(draft);
      setStatus("Set kaydedildi.", "success");
      showScreenRef("manager");
      return persistedRecord;
    }

    function exportJson() {
      if (!draft) {
        return null;
      }

      const record = serializeEditorDraft(draft, draft.meta, codecHelpers);
      const payload = codecHelpers.serializeSetRecord(record, "json");
      return createDownload(
        documentRef,
        payload,
        (draft.meta.fileName || "set.json").replace(/\.[^/.]+$/, ".json"),
        "application/json",
      );
    }

    function exportSource() {
      if (!draft) {
        return null;
      }

      const record = serializeEditorDraft(draft, draft.meta, codecHelpers);
      const sourceFormat =
        record.sourceFormat === "markdown" ? "markdown" : "json";
      const payload = codecHelpers.serializeSetRecord(record, sourceFormat);
      const downloadName =
        sourceFormat === "markdown"
          ? (record.fileName || "set.md").replace(/\.[^/.]+$/, ".md")
          : (record.fileName || "set.json").replace(/\.[^/.]+$/, ".json");

      return createDownload(
        documentRef,
        payload,
        downloadName,
        sourceFormat === "markdown" ? "text/markdown" : "application/json",
      );
    }

    return Object.freeze({
      addOption,
      addQuestion,
      applyRaw,
      closeEditor,
      duplicateQuestion,
      exportJson,
      exportSource,
      canSave,
      confirmNavigateAway,
      getDraft() {
        return draft;
      },
      getValidationIssues,
      isDirty,
      moveQuestion,
      openEditor,
      openNewDraft,
      removeOption,
      removeQuestion,
      render,
      save,
      selectQuestion,
      setMode,
      shouldPreventUnload,
      updateCurrentOption,
      updateCurrentQuestionField,
      updateMetaField,
    });
  }

  const AppEditor = Object.freeze({
    addDraftQuestion,
    createEditorDraft,
    createEditorFeature,
    createNewEditorDraft,
    duplicateDraftQuestion,
    getEditorValidationIssues,
    moveDraftQuestion,
    parseRawEditorDraft,
    serializeEditorDraft,
    updateDraftQuestionField,
    validateEditorDraft,
  });

  globalScope.AppEditor = AppEditor;

  if (typeof exports !== "undefined") {
    exports.addDraftQuestion = addDraftQuestion;
    exports.createEditorDraft = createEditorDraft;
    exports.createEditorFeature = createEditorFeature;
    exports.createNewEditorDraft = createNewEditorDraft;
    exports.duplicateDraftQuestion = duplicateDraftQuestion;
    exports.getEditorValidationIssues = getEditorValidationIssues;
    exports.moveDraftQuestion = moveDraftQuestion;
    exports.parseRawEditorDraft = parseRawEditorDraft;
    exports.serializeEditorDraft = serializeEditorDraft;
    exports.updateDraftQuestionField = updateDraftQuestionField;
    exports.validateEditorDraft = validateEditorDraft;
    exports.AppEditor = AppEditor;
    exports.default = AppEditor;
  }
})(typeof window !== "undefined" ? window : globalThis);
