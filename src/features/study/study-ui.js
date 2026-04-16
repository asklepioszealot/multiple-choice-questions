(function attachStudyUI(globalScope) {
  "use strict";

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

  function applyStudyTypographyPreferences(preferences = {}, documentRef = globalScope.document) {
    const root = documentRef?.documentElement;
    if (!root || !root.style || typeof root.style.setProperty !== "function") {
      return null;
    }

    const fullscreenQuestionFontSize =
      Number.isFinite(Number(preferences.fullscreenQuestionFontSize))
        ? `${Math.round(Number(preferences.fullscreenQuestionFontSize))}px`
        : "";
    const fullscreenOptionFontSize =
      Number.isFinite(Number(preferences.fullscreenOptionFontSize))
        ? `${Math.round(Number(preferences.fullscreenOptionFontSize))}px`
        : "";

    root.style.setProperty(
      "--mcq-font-question-fullscreen",
      fullscreenQuestionFontSize,
    );
    root.style.setProperty("--mcq-font-option-fullscreen", fullscreenOptionFontSize);

    return {
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
    };
  }

  const AppStudyUI = Object.freeze({
    createStudyChromeState,
    getFullscreenToggleState,
    getAnswerLockStatusText,
    getAutoAdvanceStatusText,
    applyStudyTypographyPreferences,
  });

  globalScope.AppStudyUI = AppStudyUI;

  if (typeof exports !== "undefined") {
    exports.createStudyChromeState = createStudyChromeState;
    exports.getFullscreenToggleState = getFullscreenToggleState;
    exports.getAnswerLockStatusText = getAnswerLockStatusText;
    exports.getAutoAdvanceStatusText = getAutoAdvanceStatusText;
    exports.applyStudyTypographyPreferences = applyStudyTypographyPreferences;
    exports.AppStudyUI = AppStudyUI;
    exports.default = AppStudyUI;
  }
})(typeof window !== "undefined" ? window : globalThis);
