import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAnalyticsSummary,
  createAnalyticsPanelController,
} from "../../src/features/analytics/analytics.js";

describe("analytics summary", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("summarizes loaded and selected sets with solved outcomes", () => {
    const summary = buildAnalyticsSummary({
      loadedSets: {
        demo: {
          questions: [
            { q: "Soru 1?", options: ["A", "B"], correct: 0, subject: "Genel" },
            { q: "Soru 2?", options: ["A", "B"], correct: 1, subject: "Genel" },
          ],
        },
        second: {
          questions: [{ q: "Soru 3?", options: ["A", "B"], correct: 1, subject: "Genel" }],
        },
      },
      selectedSetIds: ["demo"],
      selectedAnswers: {
        "demo:0": 0,
        "demo:1": 0,
        "second:0": 1,
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}`;
      },
      pendingSession: {
        currentQuestionIndex: 1,
        selectedTopic: "Genel",
      },
    });

    expect(summary).toMatchObject({
      loadedSetCount: 2,
      selectedSetCount: 1,
      scopedSetCount: 1,
      totalQuestions: 2,
      solvedQuestions: 2,
      correctAnswers: 1,
      wrongAnswers: 1,
      completionRate: 100,
    });
    expect(summary.lastStudyText).toContain("2. soru");
  });

  it("falls back to all loaded sets when no selection exists", () => {
    const summary = buildAnalyticsSummary({
      loadedSets: {
        demo: {
          questions: [{ q: "Soru 1?", options: ["A", "B"], correct: 0 }],
        },
      },
      selectedSetIds: [],
      selectedAnswers: {},
    });

    expect(summary.totalQuestions).toBe(1);
    expect(summary.solvedQuestions).toBe(0);
    expect(summary.lastStudyText).toBe("Son calisma: Henuz baslanmadi");
  });

  it("keeps the manager analytics panel hidden by default and toggles it on demand", () => {
    document.body.innerHTML = `
      <button id="analytics-toggle-btn" type="button"></button>
      <section id="analytics-dashboard-manager" hidden></section>
    `;

    const controller = createAnalyticsPanelController({
      documentRef: document,
      stateRef: {
        analyticsPanelState: {
          isVisible: false,
        },
      },
    });

    controller.syncVisibility();

    const panel = document.getElementById("analytics-dashboard-manager");
    const button = document.getElementById("analytics-toggle-btn");

    expect(panel.hidden).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");

    controller.togglePanel();
    expect(panel.hidden).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    controller.closePanel();
    expect(panel.hidden).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders the manager analytics panel summary into the manager card targets", () => {
    document.body.innerHTML = `
      <button id="analytics-toggle-btn" type="button"></button>
      <section id="analytics-dashboard-manager" hidden></section>
      <p id="analytics-summary-manager"></p>
      <div id="analytics-sets-value"></div>
      <div id="analytics-sets-meta"></div>
      <div id="analytics-questions-value"></div>
      <div id="analytics-results-value"></div>
      <div id="analytics-completion-value"></div>
      <div id="analytics-last-study"></div>
    `;

    const controller = createAnalyticsPanelController({
      documentRef: document,
      stateRef: {
        analyticsPanelState: {
          isVisible: true,
        },
      },
    });

    controller.renderSummary({
      loadedSetCount: 3,
      selectedSetCount: 2,
      totalQuestions: 20,
      solvedQuestions: 11,
      correctAnswers: 8,
      wrongAnswers: 3,
      completionRate: 55,
      lastStudyText: "Son calisma: 4. soru",
    });

    expect(document.getElementById("analytics-summary-manager").textContent).toContain(
      "3 yuklu set",
    );
    expect(document.getElementById("analytics-sets-value").textContent).toBe("3 / 2");
    expect(document.getElementById("analytics-questions-value").textContent).toBe("20 / 11");
    expect(document.getElementById("analytics-results-value").textContent).toBe("8 / 3");
    expect(document.getElementById("analytics-completion-value").textContent).toBe("%55");
    expect(document.getElementById("analytics-last-study").textContent).toBe(
      "Son calisma: 4. soru",
    );
  });
});
