function bindEvent(target, eventName, handler) {
  target?.addEventListener(eventName, handler);
}

export function bindStaticEvents({
  documentRef,
  windowRef,
  handlers,
  constants,
}) {
  const { THEME_CONTROL_IDS = [] } = constants || {};

  THEME_CONTROL_IDS.forEach((controlId) => {
    bindEvent(documentRef.getElementById(controlId), "change", (event) => {
      handlers.setTheme(event.currentTarget?.value || "light");
    });
  });

  bindEvent(documentRef.getElementById("auth-signin-btn"), "click", () => {
    void handlers.signInAuth();
  });
  bindEvent(documentRef.getElementById("auth-signup-btn"), "click", () => {
    void handlers.signUpAuth();
  });
  bindEvent(documentRef.getElementById("demo-auth-btn"), "click", () => {
    handlers.continueAsDemoAuth();
  });
  bindEvent(documentRef.getElementById("sync-retry-btn"), "click", () => {
    void handlers.retryCloudSync();
  });
  bindEvent(documentRef.getElementById("check-updates-btn"), "click", () => {
    void handlers.checkDesktopUpdates();
  });
  bindEvent(documentRef.getElementById("auth-logout-btn"), "click", () => {
    void handlers.signOutAuth();
  });
  bindEvent(documentRef.getElementById("sync-conflict-use-cloud-btn"), "click", () => {
    void handlers.useCloudConflictResolution();
  });
  bindEvent(documentRef.getElementById("sync-conflict-use-local-btn"), "click", () => {
    void handlers.useLocalConflictResolution();
  });

  bindEvent(documentRef.getElementById("delete-mode-btn"), "click", () => {
    handlers.toggleDeleteMode();
  });
  bindEvent(documentRef.getElementById("select-all-btn"), "click", () => {
    handlers.selectAllSets();
  });
  bindEvent(documentRef.getElementById("clear-selection-btn"), "click", () => {
    handlers.clearSetSelection();
  });
  bindEvent(documentRef.getElementById("remove-selected-btn"), "click", () => {
    void handlers.removeSelectedSets();
  });
  bindEvent(documentRef.getElementById("drive-upload-btn"), "click", () => {
    void handlers.authGoogleDrive();
  });
  bindEvent(documentRef.getElementById("import-set-btn"), "click", () => {
    void handlers.openSetImport();
  });
  bindEvent(documentRef.getElementById("new-set-btn"), "click", () => {
    handlers.openNewSetEditor();
  });
  bindEvent(documentRef.getElementById("analytics-toggle-btn"), "click", () => {
    handlers.toggleAnalyticsPanel();
  });
  bindEvent(documentRef.getElementById("file-picker"), "change", (event) => {
    void handlers.handleFileSelect(event);
  });
  bindEvent(documentRef.getElementById("edit-btn"), "click", () => {
    handlers.openSelectedSetEditor();
  });
  bindEvent(documentRef.getElementById("start-btn"), "click", () => {
    handlers.startStudy();
  });
  bindEvent(documentRef.getElementById("analytics-close-btn"), "click", () => {
    handlers.closeAnalyticsPanel();
  });

  bindEvent(documentRef.getElementById("manager-settings-toggle-btn"), "click", () => {
    handlers.toggleManagerSettingsPanel();
  });
  bindEvent(documentRef.getElementById("question-font-size"), "change", (event) => {
    handlers.setQuestionFontSize(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("option-font-size"), "change", (event) => {
    handlers.setOptionFontSize(event.currentTarget?.value);
  });
  bindEvent(
    documentRef.getElementById("fullscreen-question-font-size"),
    "change",
    (event) => {
      handlers.setFullscreenQuestionFontSize(event.currentTarget?.value);
    },
  );
  bindEvent(
    documentRef.getElementById("fullscreen-option-font-size"),
    "change",
    (event) => {
      handlers.setFullscreenOptionFontSize(event.currentTarget?.value);
    },
  );
  bindEvent(documentRef.getElementById("reset-typography-btn"), "click", () => {
    handlers.resetTypographyPreferences();
  });
  bindEvent(documentRef.getElementById("answer-lock-toggle-manager"), "change", (event) => {
    handlers.setAnswerLock(event.currentTarget?.checked);
  });
  bindEvent(documentRef.getElementById("auto-advance-toggle-manager"), "change", (event) => {
    handlers.setAutoAdvance(event.currentTarget?.checked);
  });
  bindEvent(documentRef.getElementById("topic-source-visibility-toggle"), "change", (event) => {
    handlers.setTopicSourceVisibility(event.currentTarget?.checked);
  });

  const setList = documentRef.getElementById("set-list");
  bindEvent(setList, "click", (event) => {
    const source = event.target;
    if (!source || typeof source.closest !== "function") {
      return;
    }

    const deleteButton = source.closest("[data-set-delete-id]");
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      void handlers.deleteSet(deleteButton.dataset.setDeleteId);
      return;
    }

    const checkbox = source.closest("[data-set-checkbox-id]");
    if (checkbox) {
      event.stopPropagation();
      handlers.toggleSetCheck(checkbox.dataset.setCheckboxId);
      return;
    }

    const toggleTarget = source.closest("[data-set-toggle-id]");
    if (toggleTarget) {
      handlers.toggleSetCheck(toggleTarget.dataset.setToggleId);
    }
  });
  bindEvent(setList, "keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const source = event.target;
    if (!source || typeof source.closest !== "function") {
      return;
    }

    const toggleTarget = source.closest("[data-set-toggle-id]");
    if (!toggleTarget) {
      return;
    }

    event.preventDefault();
    handlers.toggleSetCheck(toggleTarget.dataset.setToggleId);
  });

  bindEvent(documentRef.getElementById("editor-back-btn"), "click", () => {
    handlers.closeEditor();
  });
  bindEvent(documentRef.getElementById("editor-export-source-btn"), "click", () => {
    handlers.exportEditorSource();
  });
  bindEvent(documentRef.getElementById("editor-json-btn"), "click", () => {
    handlers.exportEditorJson();
  });
  bindEvent(documentRef.getElementById("editor-save-btn"), "click", () => {
    void handlers.saveEditor();
  });
  bindEvent(documentRef.getElementById("editor-set-name"), "input", (event) => {
    handlers.updateEditorSetName(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("editor-set-name"), "change", (event) => {
    handlers.updateEditorSetName(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("editor-add-question-btn"), "click", () => {
    handlers.addEditorQuestion();
  });
  bindEvent(documentRef.getElementById("editor-move-question-up-btn"), "click", () => {
    handlers.moveCurrentEditorQuestion(-1);
  });
  bindEvent(documentRef.getElementById("editor-move-question-down-btn"), "click", () => {
    handlers.moveCurrentEditorQuestion(1);
  });
  bindEvent(documentRef.getElementById("editor-duplicate-question-btn"), "click", () => {
    handlers.duplicateCurrentEditorQuestion();
  });
  bindEvent(documentRef.getElementById("editor-remove-question-btn"), "click", () => {
    handlers.removeCurrentEditorQuestion();
  });
  bindEvent(documentRef.getElementById("editor-visual-tab-btn"), "click", () => {
    handlers.showEditorVisual();
  });
  bindEvent(documentRef.getElementById("editor-raw-tab-btn"), "click", () => {
    handlers.showEditorRaw();
  });
  bindEvent(documentRef.getElementById("editor-question-text"), "input", (event) => {
    handlers.updateEditorQuestionText(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("editor-question-text"), "change", (event) => {
    handlers.updateEditorQuestionText(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("editor-subject"), "input", (event) => {
    handlers.updateEditorQuestionSubject(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("editor-subject"), "change", (event) => {
    handlers.updateEditorQuestionSubject(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("editor-add-option-btn"), "click", () => {
    handlers.addEditorOption();
  });
  bindEvent(documentRef.getElementById("editor-correct"), "change", (event) => {
    handlers.updateEditorCorrectIndex(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("editor-explanation"), "input", (event) => {
    handlers.updateEditorQuestionExplanation(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("editor-explanation"), "change", (event) => {
    handlers.updateEditorQuestionExplanation(event.currentTarget?.value);
  });
  bindEvent(documentRef.getElementById("apply-editor-raw-btn"), "click", () => {
    handlers.applyEditorRaw();
  });
  bindEvent(documentRef.getElementById("undo-toast-btn"), "click", () => {
    void handlers.undoLastRemoval();
  });

  bindEvent(documentRef.getElementById("editor-question-list"), "click", (event) => {
    const source = event.target;
    if (!source || typeof source.closest !== "function") {
      return;
    }
    const target = source.closest("[data-editor-question-index]");
    if (!target) {
      return;
    }

    handlers.selectEditorQuestion(Number(target.dataset.editorQuestionIndex));
  });
  bindEvent(documentRef.getElementById("editor-validation-summary"), "click", (event) => {
    const source = event.target;
    if (!source || typeof source.closest !== "function") {
      return;
    }
    const target = source.closest("[data-editor-jump-question-index]");
    if (!target) {
      return;
    }

    handlers.selectEditorQuestion(Number(target.dataset.editorJumpQuestionIndex));
  });
  bindEvent(documentRef.getElementById("editor-options"), "change", (event) => {
    const source = event.target;
    if (!source || typeof source.closest !== "function") {
      return;
    }
    const target = source.closest("[data-editor-option-index]");
    if (!target) {
      return;
    }

    handlers.updateEditorOption(Number(target.dataset.editorOptionIndex), target.value);
  });
  bindEvent(documentRef.getElementById("editor-options"), "click", (event) => {
    const source = event.target;
    if (!source || typeof source.closest !== "function") {
      return;
    }
    const target = source.closest("[data-editor-remove-option-index]");
    if (!target) {
      return;
    }

    handlers.removeEditorOption(Number(target.dataset.editorRemoveOptionIndex));
  });

  bindEvent(documentRef.getElementById("topic-select"), "change", () => {
    handlers.filterByTopic();
  });
  bindEvent(documentRef.getElementById("jump-btn"), "click", () => {
    handlers.jumpToQuestion();
  });
  bindEvent(documentRef.getElementById("jump-input"), "keypress", (event) => {
    if (event.key === "Enter") {
      handlers.jumpToQuestion();
    }
  });
  bindEvent(documentRef.getElementById("show-set-manager-btn"), "click", () => {
    handlers.showSetManager();
  });
  bindEvent(documentRef.getElementById("shuffle-btn"), "click", () => {
    handlers.shuffleQuestions();
  });
  bindEvent(documentRef.getElementById("retry-wrong-btn"), "click", () => {
    handlers.retryWrongAnswers();
  });
  bindEvent(documentRef.getElementById("export-printable-btn"), "click", () => {
    handlers.exportPrintable();
  });
  bindEvent(documentRef.getElementById("reset-quiz-btn"), "click", () => {
    handlers.resetQuiz();
  });
  bindEvent(documentRef.getElementById("prev-btn"), "click", () => {
    handlers.previousQuestion();
  });
  bindEvent(documentRef.getElementById("next-btn"), "click", () => {
    handlers.nextQuestion();
  });
  bindEvent(documentRef.getElementById("fullscreen-toggle-btn"), "click", (event) => {
    event.stopPropagation();
    handlers.toggleFullscreen();
  });
  bindEvent(documentRef.getElementById("show-solution-btn"), "click", () => {
    handlers.toggleSolution();
  });
  bindEvent(documentRef.getElementById("fullscreen-prev-btn"), "click", () => {
    handlers.previousQuestion();
  });
  bindEvent(documentRef.getElementById("fullscreen-next-btn"), "click", () => {
    handlers.nextQuestion();
  });

  documentRef.addEventListener("keydown", (event) => {
    const tagName = event.target?.tagName;
    if (tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA") {
      return;
    }

    const isMainAppVisible =
      documentRef.getElementById("main-app")?.style.display !== "none";

    if ((event.key === "f" || event.key === "F") && isMainAppVisible) {
      event.preventDefault();
      handlers.toggleFullscreen();
      return;
    }

    if (event.key === "Escape" && handlers.getIsFullscreen()) {
      event.preventDefault();
      handlers.toggleFullscreen();
      return;
    }

    if (!isMainAppVisible) {
      return;
    }

    if (event.key === "ArrowLeft") {
      handlers.previousQuestion();
    } else if (event.key === "ArrowRight") {
      handlers.nextQuestion();
    } else if (event.key === "s" || event.key === "S") {
      handlers.toggleSolution();
    } else if (event.key >= "a" && event.key <= "e") {
      handlers.selectOption(event.key.charCodeAt(0) - 97);
    } else if (event.key >= "A" && event.key <= "E") {
      handlers.selectOption(event.key.charCodeAt(0) - 65);
    }
  });

  windowRef.addEventListener("beforeunload", (event) => {
    if (!handlers.shouldPreventUnload()) {
      return;
    }

    event.preventDefault();
    event.returnValue = "";
  });
}
