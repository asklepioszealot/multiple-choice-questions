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

  const AppStudyUI = Object.freeze({
    createStudyChromeState,
    getFullscreenToggleState,
    getAnswerLockStatusText,
    getAutoAdvanceStatusText,
  });

  globalScope.AppStudyUI = AppStudyUI;

  if (typeof exports !== "undefined") {
    exports.createStudyChromeState = createStudyChromeState;
    exports.getFullscreenToggleState = getFullscreenToggleState;
    exports.getAnswerLockStatusText = getAnswerLockStatusText;
    exports.getAutoAdvanceStatusText = getAutoAdvanceStatusText;
    exports.AppStudyUI = AppStudyUI;
    exports.default = AppStudyUI;
  }
})(typeof window !== "undefined" ? window : globalThis);
