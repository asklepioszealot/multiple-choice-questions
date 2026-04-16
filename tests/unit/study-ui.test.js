import { describe, expect, it, vi } from "vitest";
import {
  applyStudyTypographyPreferences,
  createStudyChromeState,
  getAnswerLockStatusText,
  getAutoAdvanceStatusText,
  getFullscreenToggleState,
} from "../../src/features/study/study-ui.js";

describe("study-ui helpers", () => {
  it("creates chrome state for an active question", () => {
    expect(
      createStudyChromeState({
        currentQuestionIndex: 0,
        totalQuestions: 4,
        subject: "Nöroloji",
      }),
    ).toEqual({
      counterText: "Soru 1 / 4",
      subjectText: "Nöroloji",
      disablePrev: true,
      disableNext: false,
    });
  });

  it("creates empty chrome state when there are no questions", () => {
    expect(
      createStudyChromeState({
        currentQuestionIndex: 3,
        totalQuestions: 0,
        subject: "",
      }),
    ).toEqual({
      counterText: "Soru 0 / 0",
      subjectText: "Konu",
      disablePrev: true,
      disableNext: true,
    });
  });

  it("formats fullscreen toggle state for open and closed modes", () => {
    expect(getFullscreenToggleState(true)).toEqual({
      buttonText: "✕",
      buttonTitle: "Tam ekrandan çık (ESC / F)",
      bodyOverflow: "hidden",
    });
    expect(getFullscreenToggleState(false)).toEqual({
      buttonText: "⛶",
      buttonTitle: "Tam ekran (F)",
      bodyOverflow: "",
    });
  });

  it("formats manager toggle labels", () => {
    expect(getAnswerLockStatusText(true)).toBe("Cevapları kilitle: Açık");
    expect(getAnswerLockStatusText(false)).toBe("Cevapları kilitle: Kapalı");
    expect(getAutoAdvanceStatusText(true)).toBe(
      "Otomatik sonraki soru: Açık",
    );
    expect(getAutoAdvanceStatusText(false)).toBe(
      "Otomatik sonraki soru: Kapalı",
    );
  });

  it("applies fullscreen typography preferences to CSS variables", () => {
    const setProperty = vi.fn();
    const documentRef = {
      documentElement: {
        style: {
          setProperty,
        },
      },
    };

    expect(
      applyStudyTypographyPreferences(
        {
          fullscreenQuestionFontSize: 28,
          fullscreenOptionFontSize: 18,
        },
        documentRef,
      ),
    ).toEqual({
      fullscreenQuestionFontSize: "28px",
      fullscreenOptionFontSize: "18px",
    });

    expect(setProperty).toHaveBeenCalledWith(
      "--mcq-font-question-fullscreen",
      "28px",
    );
    expect(setProperty).toHaveBeenCalledWith(
      "--mcq-font-option-fullscreen",
      "18px",
    );
  });
});
