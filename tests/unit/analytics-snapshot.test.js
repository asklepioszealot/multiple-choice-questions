import { describe, expect, it } from "vitest";
import { buildAnalyticsSnapshot } from "../../src/features/analytics/analytics-snapshot.js";

describe("analytics-snapshot", () => {
  it("builds subject breakdown, activity trend, and a deterministic focus recommendation", () => {
    const snapshot = buildAnalyticsSnapshot({
      loadedSets: {
        demo: {
          setName: "Demo",
          questions: [
            { q: "Soru 1?", options: ["A", "B"], correct: 0, subject: "Genel" },
            { q: "Soru 2?", options: ["A", "B"], correct: 1, subject: "Genel" },
            { q: "Soru 3?", options: ["A", "B"], correct: 0, subject: "Noroloji" },
          ],
        },
      },
      selectedSetIds: ["demo"],
      selectedAnswers: {
        "demo:0": 0,
        "demo:1": 0,
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}`;
      },
      activityByDay: {
        "2026-04-19": { correct: 1, wrong: 0, cleared: 0 },
        "2026-04-20": { correct: 0, wrong: 2, cleared: 1 },
      },
      now: new Date("2026-04-20T12:00:00.000Z"),
    });

    expect(snapshot.resultDistribution).toEqual({
      correct: 1,
      unanswered: 1,
      wrong: 1,
    });
    expect(snapshot.subjectBreakdown[0]).toMatchObject({
      subject: "Noroloji",
      remaining: 1,
      solvedQuestions: 0,
    });
    expect(snapshot.activityTrend.at(-1)).toMatchObject({
      correct: 0,
      wrong: 2,
      cleared: 1,
      total: 3,
    });
    expect(snapshot.focusRecommendation).toMatchObject({
      kind: "subject",
      subject: "Noroloji",
    });
  });
});
