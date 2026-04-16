(function attachStudyUI(globalScope) {
  "use strict";

  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 40;
  const DEFAULT_TYPOGRAPHY_FONT_SIZES = Object.freeze({
    questionFontSize: 25,
    optionFontSize: 17,
    fullscreenQuestionFontSize: 22,
    fullscreenOptionFontSize: 15,
  });
  let pendingQuestionResetFrameIds = new Set();

  function clampFontSize(value, fallback) {
    const numericValue = Number(value);
    const resolvedValue = Number.isFinite(numericValue)
      ? Math.round(numericValue)
      : fallback;

    return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, resolvedValue));
  }

  function normalizeStudyTypographyPreferences(preferences = {}) {
    return {
      questionFontSize: clampFontSize(
        preferences.questionFontSize,
        DEFAULT_TYPOGRAPHY_FONT_SIZES.questionFontSize,
      ),
      optionFontSize: clampFontSize(
        preferences.optionFontSize,
        DEFAULT_TYPOGRAPHY_FONT_SIZES.optionFontSize,
      ),
      fullscreenQuestionFontSize: clampFontSize(
        preferences.fullscreenQuestionFontSize,
        DEFAULT_TYPOGRAPHY_FONT_SIZES.fullscreenQuestionFontSize,
      ),
      fullscreenOptionFontSize: clampFontSize(
        preferences.fullscreenOptionFontSize,
        DEFAULT_TYPOGRAPHY_FONT_SIZES.fullscreenOptionFontSize,
      ),
    };
  }

  function createStudyChromeState({
    currentQuestionIndex,
    totalQuestions,
    subject,
  }) {
    if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
      return {
        counterText: "Soru 0 / 0",
        subjectText: "Konu",
        disablePrev: true,
        disableNext: true,
      };
    }

    const boundedIndex = Math.min(
      Math.max(Number.isInteger(currentQuestionIndex) ? currentQuestionIndex : 0, 0),
      totalQuestions - 1,
    );

    return {
      counterText: `Soru ${boundedIndex + 1} / ${totalQuestions}`,
      subjectText:
        typeof subject === "string" && subject.trim().length > 0 ? subject : "Konu",
      disablePrev: boundedIndex === 0,
      disableNext: boundedIndex === totalQuestions - 1,
    };
  }

  function getFullscreenToggleState(isFullscreen) {
    if (isFullscreen) {
      return {
        buttonText: "✕",
        buttonTitle: "Tam ekrandan çık (ESC / F)",
        bodyOverflow: "hidden",
      };
    }

    return {
      buttonText: "⛶",
      buttonTitle: "Tam ekran (F)",
      bodyOverflow: "",
    };
  }

  function getAnswerLockStatusText(isEnabled) {
    return isEnabled
      ? "Cevapları kilitle: Açık"
      : "Cevapları kilitle: Kapalı";
  }

  function getAutoAdvanceStatusText(isEnabled) {
    return isEnabled
      ? "Otomatik sonraki soru: Açık"
      : "Otomatik sonraki soru: Kapalı";
  }

  function clearPendingQuestionResetFrames(cancelAnimationFrameRef) {
    if (typeof cancelAnimationFrameRef !== "function") {
      pendingQuestionResetFrameIds = new Set();
      return;
    }

    pendingQuestionResetFrameIds.forEach((frameId) => {
      cancelAnimationFrameRef(frameId);
    });
    pendingQuestionResetFrameIds = new Set();
  }

  function runWithQuestionInstantReset(
    callback,
    documentRef = globalScope.document,
    requestAnimationFrameRef = null,
    cancelAnimationFrameRef = null,
  ) {
    if (typeof callback !== "function") {
      return undefined;
    }

    const questionCard = documentRef?.getElementById("question-card");
    if (!questionCard || !questionCard.classList) {
      return callback();
    }

    const raf =
      typeof requestAnimationFrameRef === "function"
        ? requestAnimationFrameRef
        : typeof globalScope.requestAnimationFrame === "function"
          ? globalScope.requestAnimationFrame.bind(globalScope)
          : null;
    const cancelRaf =
      typeof cancelAnimationFrameRef === "function"
        ? cancelAnimationFrameRef
        : typeof globalScope.cancelAnimationFrame === "function"
          ? globalScope.cancelAnimationFrame.bind(globalScope)
          : null;

    clearPendingQuestionResetFrames(cancelRaf);
    questionCard.classList.add("mcq--instant-reset");

    let callbackResult;
    try {
      callbackResult = callback();
    } finally {
      if (raf) {
        const outerFrameId = raf(() => {
          pendingQuestionResetFrameIds.delete(outerFrameId);
          const innerFrameId = raf(() => {
            pendingQuestionResetFrameIds.delete(innerFrameId);
            questionCard.classList.remove("mcq--instant-reset");
          });
          pendingQuestionResetFrameIds.add(innerFrameId);
        });
        pendingQuestionResetFrameIds.add(outerFrameId);
      } else {
        questionCard.classList.remove("mcq--instant-reset");
      }
    }

    return callbackResult;
  }

  function applyStudyTypographyPreferences(
    preferences = {},
    documentRef = globalScope.document,
  ) {
    const normalizedPreferences = normalizeStudyTypographyPreferences(preferences);
    const root = documentRef?.documentElement;
    if (!root || !root.style || typeof root.style.setProperty !== "function") {
      return normalizedPreferences;
    }

    root.style.setProperty("--mcq-font-question", `${normalizedPreferences.questionFontSize}px`);
    root.style.setProperty("--mcq-font-option", `${normalizedPreferences.optionFontSize}px`);
    root.style.setProperty(
      "--mcq-font-question-fullscreen",
      `${normalizedPreferences.fullscreenQuestionFontSize}px`,
    );
    root.style.setProperty(
      "--mcq-font-option-fullscreen",
      `${normalizedPreferences.fullscreenOptionFontSize}px`,
    );

    return normalizedPreferences;
  }

  const AppStudyUI = Object.freeze({
    createStudyChromeState,
    getFullscreenToggleState,
    getAnswerLockStatusText,
    getAutoAdvanceStatusText,
    runWithQuestionInstantReset,
    normalizeStudyTypographyPreferences,
    applyStudyTypographyPreferences,
  });

  globalScope.AppStudyUI = AppStudyUI;

  if (typeof exports !== "undefined") {
    exports.createStudyChromeState = createStudyChromeState;
    exports.getFullscreenToggleState = getFullscreenToggleState;
    exports.getAnswerLockStatusText = getAnswerLockStatusText;
    exports.getAutoAdvanceStatusText = getAutoAdvanceStatusText;
    exports.runWithQuestionInstantReset = runWithQuestionInstantReset;
    exports.normalizeStudyTypographyPreferences = normalizeStudyTypographyPreferences;
    exports.applyStudyTypographyPreferences = applyStudyTypographyPreferences;
    exports.AppStudyUI = AppStudyUI;
    exports.default = AppStudyUI;
  }
})(typeof window !== "undefined" ? window : globalThis);
