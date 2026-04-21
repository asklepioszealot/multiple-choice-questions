import {
  addDraftOption,
  addDraftQuestion,
  createEditorDraft,
  createEmptyQuestion,
  createNewEditorDraft,
  duplicateDraftQuestion,
  moveDraftQuestion,
  removeDraftOption,
  removeDraftQuestion,
  resolveEditorCodecHelpers,
  setDraftQuestionListExpanded,
  setDraftQuestionListScrollTop,
  toSafeArray,
  updateDraftFieldHistory,
  updateDraftOptionValue,
  updateDraftQuestionField,
} from "./editor-state.js";
import {
  applyEditorHistoryAction,
  createEditorFieldHistoryState,
  recordEditorFieldHistory,
} from "./editor-history.js";
import {
  bindRawEditorAutoResize,
  renderOptions,
  renderQuestionList,
  renderValidationSummary,
  syncRawEditorHeight,
} from "./editor-render.js";
import {
  createDownload,
  parseRawEditorDraft,
  serializeEditorDraft,
} from "./editor-save.js";
import {
  applyEditorToolbarAction,
  buildEditorToolbarActions,
  renderEditorToolbarMarkup,
} from "./editor-toolbar.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;

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
    const codecHelpers = resolveEditorCodecHelpers({
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
    const toolbarActions = buildEditorToolbarActions();

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

    function resolveDraftFieldName(field) {
      if (field === "correct") {
        return "correct";
      }
      if (field === "subject") {
        return "subject";
      }
      return field === "explanation" ? "explanation" : "q";
    }

    function resolveFieldTextareaId(field) {
      return field === "explanation" ? "editor-explanation" : "editor-question-text";
    }

    function getCurrentFieldValue(field) {
      const currentQuestion = getCurrentQuestion() || createEmptyQuestion();
      const fieldName = resolveDraftFieldName(field);
      return String(currentQuestion?.[fieldName] || "");
    }

    function getCurrentFieldHistory(field) {
      if (!draft || draft.activeQuestionIndex < 0) {
        return createEditorFieldHistoryState("");
      }

      const fieldName = resolveDraftFieldName(field);
      const questionHistory = toSafeArray(draft?.ui?.fieldHistory)[draft.activeQuestionIndex];
      return (
        questionHistory?.[fieldName] ||
        createEditorFieldHistoryState(getCurrentFieldValue(field))
      );
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

    function syncFieldSelection(field, selectionStart, selectionEnd) {
      const nextTextareaEl = documentRef?.getElementById(resolveFieldTextareaId(field));
      if (
        !nextTextareaEl ||
        typeof nextTextareaEl.focus !== "function" ||
        typeof nextTextareaEl.setSelectionRange !== "function"
      ) {
        return;
      }

      nextTextareaEl.focus();
      nextTextareaEl.setSelectionRange(selectionStart, selectionEnd);
    }

    function applyFieldValue(field, value, options = {}) {
      if (!draft || draft.activeQuestionIndex < 0) {
        return "";
      }

      const fieldName = resolveDraftFieldName(field);
      const shouldRecordHistory =
        options.recordHistory !== false &&
        (fieldName === "q" || fieldName === "explanation");
      draft = updateDraftQuestionField(
        draft,
        draft.activeQuestionIndex,
        fieldName,
        value,
      );
      if (shouldRecordHistory) {
        const nextHistory = recordEditorFieldHistory(
          getCurrentFieldHistory(field),
          value,
        );
        draft = updateDraftFieldHistory(
          draft,
          draft.activeQuestionIndex,
          fieldName,
          nextHistory,
        );
      }
      render();

      if (
        Number.isInteger(options.selectionStart) &&
        Number.isInteger(options.selectionEnd)
      ) {
        syncFieldSelection(field, options.selectionStart, options.selectionEnd);
      }

      return String(value ?? "");
    }

    function applyHistoryAction(field, action) {
      if (!draft || draft.activeQuestionIndex < 0) {
        return "";
      }

      const fieldName = resolveDraftFieldName(field);
      if (fieldName !== "q" && fieldName !== "explanation") {
        return getCurrentFieldValue(field);
      }
      const historyResult = applyEditorHistoryAction(
        getCurrentFieldHistory(field),
        action,
      );

      draft = updateDraftQuestionField(
        draft,
        draft.activeQuestionIndex,
        fieldName,
        historyResult.value,
      );
      draft = updateDraftFieldHistory(
        draft,
        draft.activeQuestionIndex,
        fieldName,
        historyResult.history,
      );
      render();
      syncFieldSelection(field, historyResult.value.length, historyResult.value.length);
      return historyResult.value;
    }

    function buildToolbarDisabledActionIds(field) {
      const disabledActionIds = [];
      const historyState = getCurrentFieldHistory(field);
      if (historyState.index <= 0) {
        disabledActionIds.push("undo");
      }
      if (historyState.index >= historyState.entries.length - 1) {
        disabledActionIds.push("redo");
      }
      return disabledActionIds;
    }

    function bindToolbarButtons(toolbarEl, field) {
      if (!toolbarEl) {
        return;
      }

      toolbarEl
        .querySelectorAll("[data-editor-toolbar-action]")
        .forEach((buttonEl) => {
          buttonEl.onmousedown = (event) => {
            event.preventDefault();
            const action = buttonEl.getAttribute("data-editor-toolbar-action");
            if (!action) {
              return;
            }

            if (action === "undo" || action === "redo") {
              applyHistoryAction(field, action);
              return;
            }

            applyToolbarAction(field, action);
          };
          buttonEl.onclick = (event) => {
            event.preventDefault();
          };
        });
    }

    function render() {
      const screenEl = documentRef?.getElementById("editor-screen");
      const setNameEl = documentRef?.getElementById("editor-set-name");
      const questionTextEl = documentRef?.getElementById("editor-question-text");
      const questionToolbarEl = documentRef?.getElementById("editor-question-toolbar");
      const questionListEl = documentRef?.getElementById("editor-question-list");
      const questionListToggleBtn = documentRef?.getElementById(
        "editor-question-list-toggle-btn",
      );
      const subjectEl = documentRef?.getElementById("editor-subject");
      const explanationEl = documentRef?.getElementById("editor-explanation");
      const explanationToolbarEl = documentRef?.getElementById("editor-explanation-toolbar");
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
      if (questionToolbarEl) {
        questionToolbarEl.innerHTML = renderEditorToolbarMarkup({
          actions: toolbarActions,
          disabled: draft.activeQuestionIndex < 0,
          disabledActionIds: buildToolbarDisabledActionIds("question"),
          field: "question",
        });
        bindToolbarButtons(questionToolbarEl, "question");
      }
      if (subjectEl) {
        subjectEl.value = currentQuestion.subject;
      }
      if (explanationEl) {
        explanationEl.value = currentQuestion.explanation;
      }
      if (explanationToolbarEl) {
        explanationToolbarEl.innerHTML = renderEditorToolbarMarkup({
          actions: toolbarActions,
          disabled: draft.activeQuestionIndex < 0,
          disabledActionIds: buildToolbarDisabledActionIds("explanation"),
          field: "explanation",
        });
        bindToolbarButtons(explanationToolbarEl, "explanation");
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
        bindRawEditorAutoResize(rawInputEl);
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
      if (questionListToggleBtn) {
        const isExpanded = draft?.ui?.isQuestionListExpanded !== false;
        questionListToggleBtn.textContent = isExpanded
          ? "Listeyi daralt"
          : "Listeyi ac";
        questionListToggleBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
        questionListToggleBtn.onclick = () => {
          draft = setDraftQuestionListExpanded(draft, !isExpanded);
          render();
        };
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

      renderQuestionList({
        documentRef,
        draft,
        validationIssues,
      });
      if (questionListEl) {
        questionListEl.style.display =
          draft?.ui?.isQuestionListExpanded === false ? "none" : "";
        questionListEl.scrollTop = Number.isFinite(draft?.ui?.questionListScrollTop)
          ? Math.max(0, Number(draft.ui.questionListScrollTop))
          : 0;
        questionListEl.onscroll = () => {
          draft = setDraftQuestionListScrollTop(draft, questionListEl.scrollTop);
        };
      }
      renderOptions({
        documentRef,
        question: currentQuestion,
      });
      renderValidationSummary({
        documentRef,
        draft,
        validationIssues,
      });
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

      applyFieldValue(field, value);
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

    function applyToolbarAction(field, action = "bold") {
      if (!draft || draft.activeQuestionIndex < 0) {
        return "";
      }

      const targetField = field === "explanation" ? "explanation" : "q";
      const textareaId = resolveFieldTextareaId(targetField);
      const textareaEl = documentRef?.getElementById(textareaId);
      const currentValue = getCurrentFieldValue(targetField);
      const insertion = applyEditorToolbarAction(
        textareaEl?.value ?? currentValue,
        action,
        {
          selectionEnd: textareaEl?.selectionEnd,
          selectionStart: textareaEl?.selectionStart,
        },
      );

      return applyFieldValue(targetField, insertion.value, {
        selectionEnd: insertion.selectionEnd,
        selectionStart: insertion.selectionStart,
      });
    }

    function insertMediaToken(field, kind = "image") {
      return applyToolbarAction(
        field,
        kind === "audio" ? "attachment-audio" : "attachment-image",
      );
    }

    function insertFormattingToken(field, action = "bold") {
      return applyToolbarAction(field, action);
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
      applyToolbarAction,
      applyHistoryAction,
      insertFormattingToken,
      insertMediaToken,
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
  validateEditorDraft
});

export {
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
  AppEditor
};
