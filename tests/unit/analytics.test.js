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
    expect(summary.lastStudyText).toBe("Son çalışma: Henüz başlanmadı");
  });

  it("groups solved answers by subject with correct and wrong counts", () => {
    const summary = buildAnalyticsSummary({
      loadedSets: {
        demo: {
          questions: [
            { q: "Soru 1?", options: ["A", "B"], correct: 0, subject: "Genel" },
            { q: "Soru 2?", options: ["A", "B"], correct: 1, subject: "Genel" },
            { q: "Soru 3?", options: ["A", "B"], correct: 1, subject: "Matematik" },
            { q: "Soru 4?", options: ["A", "B"], correct: 0, subject: "Matematik" },
            { q: "Soru 5?", options: ["A", "B"], correct: 0 },
          ],
        },
      },
      selectedAnswers: {
        "demo:0": 0,
        "demo:1": 0,
        "demo:2": 1,
        "demo:3": 1,
        "demo:4": 0,
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}`;
      },
    });

    expect(summary.subjectBreakdown).toEqual([
      { subject: "Genel", correct: 2, total: 3, wrong: 1 },
      { subject: "Matematik", correct: 1, total: 2, wrong: 1 },
    ]);
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
      <div id="analytics-distribution-meta"></div>
      <div id="analytics-result-distribution"></div>
      <div id="analytics-activity-meta"></div>
      <div id="analytics-activity-trend"></div>
      <div id="analytics-focus-title"></div>
      <div id="analytics-focus-copy"></div>
      <button id="analytics-focus-action" type="button" hidden></button>
      <table>
        <tbody id="analytics-subject-breakdown"></tbody>
      </table>
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
      lastStudyText: "Son çalışma: 4. soru",
      resultDistribution: {
        correct: 8,
        wrong: 3,
        unanswered: 9,
      },
      activityTrend: [
        { key: "2026-04-19", label: "Paz", correct: 1, wrong: 0, cleared: 0, total: 1 },
        { key: "2026-04-20", label: "Pts", correct: 0, wrong: 2, cleared: 1, total: 3 },
      ],
      focusRecommendation: {
        kind: "subject",
        title: "Matematik ile devam et",
        message: "1 soru bu konuda seni bekliyor.",
        actionLabel: "Matematik odagina gec",
        subject: "Matematik",
      },
      subjectBreakdown: [
        {
          subject: "Genel",
          correct: 2,
          wrong: 1,
          totalQuestions: 3,
          solvedQuestions: 3,
          remaining: 0,
          accuracy: 67,
        },
        {
          subject: "Matematik",
          correct: 1,
          wrong: 1,
          totalQuestions: 3,
          solvedQuestions: 2,
          remaining: 1,
          accuracy: 50,
        },
      ],
    });

    expect(document.getElementById("analytics-summary-manager").textContent).toContain(
      "3 yüklü set",
    );
    expect(document.getElementById("analytics-sets-value").textContent).toBe("3 / 2");
    expect(document.getElementById("analytics-questions-value").textContent).toBe("20 / 11");
    expect(document.getElementById("analytics-results-value").textContent).toBe("8 / 3");
    expect(document.getElementById("analytics-completion-value").textContent).toBe("%55");
    expect(document.getElementById("analytics-last-study").textContent).toBe(
      "Son çalışma: 4. soru",
    );
    expect(document.getElementById("analytics-distribution-meta").textContent).toContain(
      "Doğru 8",
    );
    expect(document.getElementById("analytics-activity-meta").textContent).toContain(
      "4 hareket",
    );
    expect(document.getElementById("analytics-focus-title").textContent).toBe(
      "Matematik ile devam et",
    );
    expect(document.getElementById("analytics-focus-action").hidden).toBe(false);
    expect(document.getElementById("analytics-subject-breakdown").children).toHaveLength(2);
    expect(document.getElementById("analytics-subject-breakdown").textContent).toContain(
      "Genel",
    );
    expect(document.getElementById("analytics-subject-breakdown").textContent).toContain(
      "3 / 3",
    );
    expect(document.getElementById("analytics-subject-breakdown").textContent).toContain(
      "2 / 3",
    );
  });

  it("wires the focus action to a subject callback", () => {
    document.body.innerHTML = `
      <button id="analytics-toggle-btn" type="button"></button>
      <section id="analytics-dashboard-manager" hidden></section>
      <p id="analytics-summary-manager"></p>
      <div id="analytics-focus-title"></div>
      <div id="analytics-focus-copy"></div>
      <button id="analytics-focus-action" type="button" hidden></button>
      <tbody id="analytics-subject-breakdown"></tbody>
    `;

    const focusedSubjects = [];
    const controller = createAnalyticsPanelController({
      documentRef: document,
      onSubjectSelect(subject) {
        focusedSubjects.push(subject);
      },
    });

    controller.renderSummary({
      loadedSetCount: 1,
      selectedSetCount: 1,
      totalQuestions: 3,
      solvedQuestions: 1,
      correctAnswers: 1,
      wrongAnswers: 0,
      completionRate: 33,
      subjectBreakdown: [
        {
          subject: "Noroloji",
          totalQuestions: 2,
          solvedQuestions: 1,
          correct: 1,
          wrong: 0,
          remaining: 1,
          accuracy: 100,
        },
      ],
      focusRecommendation: {
        kind: "subject",
        title: "Noroloji ile devam et",
        message: "1 soru bu konuda seni bekliyor.",
        actionLabel: "Noroloji odagina gec",
        subject: "Noroloji",
      },
    });

    document.getElementById("analytics-focus-action").click();
    expect(focusedSubjects).toEqual(["Noroloji"]);
  });
});
