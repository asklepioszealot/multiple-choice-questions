const MAX_EDITOR_HISTORY_ENTRIES = 120;

function toHistoryText(value = "") {
  return String(value ?? "");
}

export function createEditorFieldHistoryState(value = "") {
  return {
    entries: [toHistoryText(value)],
    index: 0,
  };
}

export function createEditorQuestionHistoryState(question = {}) {
  return {
    explanation: createEditorFieldHistoryState(question?.explanation || ""),
    q: createEditorFieldHistoryState(question?.q || ""),
  };
}

export function createEditorDraftUiState(questions = []) {
  const normalizedQuestions = Array.isArray(questions) ? questions : [];

  return {
    fieldHistory: normalizedQuestions.map((question) =>
      createEditorQuestionHistoryState(question),
    ),
    isQuestionListExpanded: true,
    questionListScrollTop: 0,
  };
}

export function recordEditorFieldHistory(historyState, value = "") {
  const history =
    historyState && typeof historyState === "object"
      ? historyState
      : createEditorFieldHistoryState(value);
  const nextValue = toHistoryText(value);
  const currentValue = history.entries?.[history.index] || "";
  if (currentValue === nextValue) {
    return history;
  }

  const nextEntries = [
    ...(Array.isArray(history.entries)
      ? history.entries.slice(0, history.index + 1)
      : []),
    nextValue,
  ].slice(-MAX_EDITOR_HISTORY_ENTRIES);

  return {
    entries: nextEntries,
    index: nextEntries.length - 1,
  };
}

export function applyEditorHistoryAction(historyState, action) {
  const history =
    historyState && typeof historyState === "object"
      ? historyState
      : createEditorFieldHistoryState("");
  const delta = action === "undo" ? -1 : 1;
  const nextIndex = history.index + delta;

  if (
    !Number.isInteger(nextIndex) ||
    nextIndex < 0 ||
    nextIndex >= (Array.isArray(history.entries) ? history.entries.length : 0)
  ) {
    return {
      history,
      value: history.entries?.[history.index] || "",
    };
  }

  return {
    history: {
      ...history,
      index: nextIndex,
    },
    value: history.entries[nextIndex] || "",
  };
}
