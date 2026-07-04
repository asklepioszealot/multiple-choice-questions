import { describe, expect, it } from "vitest";
import { createStudyChrome } from "../../src/features/study/study-chrome.js";

function buildStudyChrome({ isFullscreen = false } = {}) {
  document.body.innerHTML = `
    <div id="question-card"></div>
    <button id="fullscreen-toggle-btn"></button>
  `;

  let context = {
    currentQuestionIndex: 0,
    filteredQuestions: [],
    questionOrder: [],
    isFullscreen,
  };

  return createStudyChrome({
    storage: null,
    documentRef: document,
    windowRef: window,
    createStudyChromeState: () => ({
      counterText: "Soru 0 / 0",
      subjectText: "Konu",
      disablePrev: true,
      disableNext: true,
    }),
    getFullscreenToggleState: (nextIsFullscreen) => ({
      buttonText: nextIsFullscreen ? "✕" : "⛶",
      buttonTitle: nextIsFullscreen
        ? "Tam ekrandan çık (ESC / F)"
        : "Tam ekran (F)",
      bodyOverflow: nextIsFullscreen ? "hidden" : "",
    }),
    getContext: () => context,
    setContext: (partial) => {
      context = { ...context, ...partial };
    },
  });
}

describe("study-chrome toggleFullscreen desktop chrome coordination", () => {
  it("adds body.study-fullscreen when entering study fullscreen", () => {
    const studyChrome = buildStudyChrome({ isFullscreen: false });

    const result = studyChrome.toggleFullscreen();

    expect(result).toBe(true);
    expect(document.body.classList.contains("study-fullscreen")).toBe(true);
    expect(
      document
        .getElementById("question-card")
        .classList.contains("fullscreen-active"),
    ).toBe(true);
  });

  it("removes body.study-fullscreen when exiting study fullscreen", () => {
    const studyChrome = buildStudyChrome({ isFullscreen: true });
    document.body.classList.add("study-fullscreen");
    document.getElementById("question-card").classList.add("fullscreen-active");

    const result = studyChrome.toggleFullscreen();

    expect(result).toBe(false);
    expect(document.body.classList.contains("study-fullscreen")).toBe(false);
    expect(
      document
        .getElementById("question-card")
        .classList.contains("fullscreen-active"),
    ).toBe(false);
  });
});
