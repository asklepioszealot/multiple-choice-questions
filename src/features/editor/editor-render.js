import { escapeMarkup } from "../../shared/utils.js";
import { createEmptyQuestion, toSafeArray } from "./editor-state.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;

export function renderQuestionList({
  documentRef,
  draft,
  validationIssues = [],
} = {}) {
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
      return `<button class="${activeClass.trim()}" type="button" data-editor-question-index="${index}">${escapeMarkup(issueMarker + label)}</button>`;
    })
    .join("");
}

export function renderValidationSummary({
  documentRef,
  draft,
  validationIssues = [],
} = {}) {
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
    summaryEl.textContent = "Kaydetmeye hazır.";
    summaryEl.className = "auth-status success editor-validation-summary";
    return;
  }

  summaryEl.className = "auth-status error editor-validation-summary";
  summaryEl.innerHTML = [
    `<strong>${validationIssues.length} sorun çözülmeli.</strong>`,
    '<ul class="editor-validation-list">',
    ...validationIssues.map((issue) => {
      const jumpTarget =
        Number.isInteger(issue.questionIndex) && issue.questionIndex >= 0
          ? `<button class="btn btn-small btn-secondary" type="button" data-editor-jump-question-index="${issue.questionIndex}">Soru ${issue.questionIndex + 1}</button>`
          : '<span class="auth-meta">Genel</span>';
      return `<li class="editor-validation-item">${jumpTarget}<span>${escapeMarkup(issue.message)}</span></li>`;
    }),
    "</ul>",
  ].join("");
}

export function renderOptions({ documentRef, question } = {}) {
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
            value="${escapeMarkup(option)}"
            data-editor-option-index="${index}"
          />
          <button class="btn btn-small btn-secondary" data-editor-remove-option-index="${index}" type="button">Sil</button>
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

export function syncRawEditorHeight(rawInputEl) {
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

export function bindRawEditorAutoResize(rawInputEl) {
  if (!rawInputEl) {
    return;
  }

  rawInputEl.oninput = () => {
    syncRawEditorHeight(rawInputEl);
  };
}
