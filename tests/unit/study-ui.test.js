import { describe, expect, it } from "vitest";
import {
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
});
