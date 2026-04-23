import {
  ANSWER_LOCK_KEY,
  AUTO_ADVANCE_KEY,
  TOPIC_SOURCE_KEY,
} from "../../shared/constants.js";
import {
  applyStudyTypographyPreferences as defaultApplyStudyTypographyPreferences,
  createStudyChromeState as defaultCreateStudyChromeState,
  getAnswerLockStatusText as defaultGetAnswerLockStatusText,
  getAutoAdvanceStatusText as defaultGetAutoAdvanceStatusText,
  getFullscreenToggleState as defaultGetFullscreenToggleState,
} from "./study-ui.js";

export function createStudyChrome({
  storage,
  documentRef,
  windowRef,
  getFullscreenToggleState = defaultGetFullscreenToggleState,
  getAnswerLockStatusText = defaultGetAnswerLockStatusText,
  getAutoAdvanceStatusText = defaultGetAutoAdvanceStatusText,
  createStudyChromeState = defaultCreateStudyChromeState,
  applyStudyTypographyPreferences = defaultApplyStudyTypographyPreferences,
  buildScopedStorageKey,
  getStorageKeyPrefix,
  scheduleRemoteStudyStateSync,
  buildCurrentStudyStateSnapshot,
  defaults,
  getContext,
  setContext,
  onTypographyApplied = null,
  onTopicSourceVisibilityChange = null,
  onStatePersist = null,
}) {
  function updateFullscreenInfo(question) {
    const { currentQuestionIndex, filteredQuestions } = getContext();
    const counterEl = documentRef?.getElementById("fullscreen-question-counter");
    const subjectEl = documentRef?.getElementById("fullscreen-subject-badge");
    const prevBtn = documentRef?.getElementById("fullscreen-prev-btn");
    const nextBtn = documentRef?.getElementById("fullscreen-next-btn");
    const chromeState = createStudyChromeState({
      currentQuestionIndex,
      totalQuestions: filteredQuestions.length,
      subject: question ? question.subject : "",
    });

    if (counterEl) {
      counterEl.textContent = chromeState.counterText;
    }
    if (subjectEl) {
      subjectEl.textContent = chromeState.subjectText;
    }
    if (prevBtn) {
      prevBtn.disabled = chromeState.disablePrev;
    }
    if (nextBtn) {
      nextBtn.disabled = chromeState.disableNext;
    }
  }

  function syncAnswerLockToggleUI() {
    const { answerLockEnabled } = getContext();
    const toggle = documentRef?.getElementById("answer-lock-toggle-manager");
    if (toggle) {
      toggle.checked = answerLockEnabled;
    }
    const status = documentRef?.getElementById("answer-lock-status");
    if (status) {
      status.textContent = getAnswerLockStatusText(answerLockEnabled);
    }
  }

  function setAnswerLock(isEnabled) {
    const nextEnabled = Boolean(isEnabled);
    setContext({
      answerLockEnabled: nextEnabled,
    });
    storage?.setItem?.(ANSWER_LOCK_KEY, nextEnabled ? "1" : "0");
    syncAnswerLockToggleUI();
    return nextEnabled;
  }

  function syncAutoAdvanceToggleUI() {
    const { autoAdvanceEnabled } = getContext();
    const toggle = documentRef?.getElementById("auto-advance-toggle-manager");
    if (toggle) {
      toggle.checked = autoAdvanceEnabled;
    }
    const status = documentRef?.getElementById("auto-advance-status");
    if (status) {
      status.textContent = getAutoAdvanceStatusText(autoAdvanceEnabled);
    }
  }

  function syncTopicSourceToggleUI() {
    const { topicSourceVisible } = getContext();
    const toggle = documentRef?.getElementById("topic-source-visibility-toggle");
    if (toggle) {
      toggle.checked = topicSourceVisible;
    }
  }

  function setTopicSourceVisibility(isVisible) {
    const nextVisible = Boolean(isVisible);
    setContext({
      topicSourceVisible: nextVisible,
    });
    storage?.setItem?.(TOPIC_SOURCE_KEY, nextVisible ? "1" : "0");
    syncTopicSourceToggleUI();
    if (typeof onTopicSourceVisibilityChange === "function") {
      onTopicSourceVisibilityChange(nextVisible);
    }
    return nextVisible;
  }

  function getStudyTypographyState() {
    const {
      questionFontSize,
      optionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
    } = getContext();

    return {
      questionFontSize,
      optionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
    };
  }

  function syncTypographyControls() {
    const {
      questionFontSize,
      optionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
    } = getContext();
    const questionInput = documentRef?.getElementById("question-font-size");
    const optionInput = documentRef?.getElementById("option-font-size");
    const fullscreenQuestionInput = documentRef?.getElementById(
      "fullscreen-question-font-size",
    );
    const fullscreenOptionInput = documentRef?.getElementById(
      "fullscreen-option-font-size",
    );

    if (questionInput) {
      questionInput.value = String(questionFontSize);
    }
    if (optionInput) {
      optionInput.value = String(optionFontSize);
    }
    if (fullscreenQuestionInput) {
      fullscreenQuestionInput.value = String(fullscreenQuestionFontSize);
    }
    if (fullscreenOptionInput) {
      fullscreenOptionInput.value = String(fullscreenOptionFontSize);
    }
  }

  function applyTypographyState(nextState) {
    const normalizedState = applyStudyTypographyPreferences(nextState, documentRef);

    setContext({
      questionFontSize: normalizedState.questionFontSize,
      optionFontSize: normalizedState.optionFontSize,
      fullscreenQuestionFontSize: normalizedState.fullscreenQuestionFontSize,
      fullscreenOptionFontSize: normalizedState.fullscreenOptionFontSize,
    });
    syncTypographyControls();
    if (typeof onTypographyApplied === "function") {
      onTypographyApplied(normalizedState);
    }
    return normalizedState;
  }

  function persistAfterTypographyChange() {
    if (typeof onStatePersist === "function") {
      onStatePersist();
    }
  }

  function setQuestionFontSize(value) {
    const {
      optionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
    } = getContext();
    applyTypographyState({
      questionFontSize: value,
      optionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
    });
    persistAfterTypographyChange();
  }

  function setOptionFontSize(value) {
    const {
      questionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
    } = getContext();
    applyTypographyState({
      questionFontSize,
      optionFontSize: value,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
    });
    persistAfterTypographyChange();
  }

  function setFullscreenQuestionFontSize(value) {
    const {
      questionFontSize,
      optionFontSize,
      fullscreenOptionFontSize,
    } = getContext();
    applyTypographyState({
      questionFontSize,
      optionFontSize,
      fullscreenQuestionFontSize: value,
      fullscreenOptionFontSize,
    });
    persistAfterTypographyChange();
  }

  function setFullscreenOptionFontSize(value) {
    const {
      questionFontSize,
      optionFontSize,
      fullscreenQuestionFontSize,
    } = getContext();
    applyTypographyState({
      questionFontSize,
      optionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize: value,
    });
    persistAfterTypographyChange();
  }

  function resetTypographyPreferences() {
    applyTypographyState({
      questionFontSize: defaults.DEFAULT_QUESTION_FONT_SIZE,
      optionFontSize: defaults.DEFAULT_OPTION_FONT_SIZE,
      fullscreenQuestionFontSize: defaults.DEFAULT_FULLSCREEN_QUESTION_FONT_SIZE,
      fullscreenOptionFontSize: defaults.DEFAULT_FULLSCREEN_OPTION_FONT_SIZE,
    });
    persistAfterTypographyChange();
  }

  function setAutoAdvance(isEnabled) {
    const nextEnabled = Boolean(isEnabled);
    setContext({
      autoAdvanceEnabled: nextEnabled,
    });
    storage?.setItem?.(
      buildScopedStorageKey(AUTO_ADVANCE_KEY, getStorageKeyPrefix()),
      nextEnabled ? "1" : "0",
    );
    syncAutoAdvanceToggleUI();
    if (
      typeof scheduleRemoteStudyStateSync === "function" &&
      typeof buildCurrentStudyStateSnapshot === "function"
    ) {
      scheduleRemoteStudyStateSync(buildCurrentStudyStateSnapshot());
    }
    return nextEnabled;
  }

  function clearAutoAdvanceTimer() {
    const { autoAdvanceTimeoutId } = getContext();
    if (autoAdvanceTimeoutId) {
      const clearTimeoutRef =
        typeof windowRef?.clearTimeout === "function"
          ? windowRef.clearTimeout.bind(windowRef)
          : clearTimeout;
      clearTimeoutRef(autoAdvanceTimeoutId);
      setContext({
        autoAdvanceTimeoutId: null,
      });
    }
  }

  function toggleFullscreen() {
    const questionCard = documentRef?.getElementById("question-card");
    const toggleBtn = documentRef?.getElementById("fullscreen-toggle-btn");
    if (!questionCard || !toggleBtn) {
      return false;
    }

    const {
      currentQuestionIndex,
      filteredQuestions,
      isFullscreen,
      questionOrder,
    } = getContext();
    const nextIsFullscreen = !isFullscreen;
    const fullscreenState = getFullscreenToggleState(nextIsFullscreen);

    setContext({
      isFullscreen: nextIsFullscreen,
    });
    questionCard.classList.toggle("fullscreen-active", nextIsFullscreen);
    if (documentRef?.body?.style) {
      documentRef.body.style.overflow = fullscreenState.bodyOverflow;
    }
    toggleBtn.textContent = fullscreenState.buttonText;
    toggleBtn.title = fullscreenState.buttonTitle;
    updateFullscreenInfo(
      filteredQuestions.length > 0
        ? filteredQuestions[questionOrder[currentQuestionIndex]]
        : null,
    );

    if (documentRef?.activeElement && typeof documentRef.activeElement.blur === "function") {
      documentRef.activeElement.blur();
    }

    return nextIsFullscreen;
  }

  return Object.freeze({
    applyTypographyState,
    clearAutoAdvanceTimer,
    getStudyTypographyState,
    resetTypographyPreferences,
    setAnswerLock,
    setAutoAdvance,
    setFullscreenOptionFontSize,
    setFullscreenQuestionFontSize,
    setOptionFontSize,
    setQuestionFontSize,
    setTopicSourceVisibility,
    syncAnswerLockToggleUI,
    syncAutoAdvanceToggleUI,
    syncTopicSourceToggleUI,
    syncTypographyControls,
    toggleFullscreen,
    updateFullscreenInfo,
  });
}
