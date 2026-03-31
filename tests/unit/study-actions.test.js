import { describe, expect, it } from "vitest";
import {
  buildScoreSummary,
  createResetStudyState,
  createRetryWrongAnswersState,
  formatScoreSummaryHtml,
  shuffleQuestionOrder,
} from "../../src/features/study/study-actions.js";

function resolveQuestionKey(question) {
  return question.__questionKey;
}

describe("study-actions helpers", () => {
  it("builds score totals and formatted score html", () => {
    const questions = [
      { __questionKey: "set:a::idx:0", correct: 1 },
      { __questionKey: "set:a::idx:1", correct: 2 },
      { __questionKey: "set:b::idx:0", correct: 0 },
    ];

    const summary = buildScoreSummary({
      allQuestions: questions,
      selectedAnswers: {
        "set:a::idx:0": 1,
        "set:a::idx:1": 0,
      },
      resolveQuestionKey,
    });

    expect(summary).toEqual({
      correct: 1,
      wrong: 1,
      answered: 2,
      totalQuestions: 3,
      progressPct: 67,
      accuracyPct: 50,
    });
    expect(formatScoreSummaryHtml(summary)).toBe(
      "✅ 1 &nbsp; ❌ 1 &nbsp; 📊 2/3 (%67) &nbsp; 🎯 %50",
    );
  });

  it("creates retry state for wrong answers and clears their stored progress", () => {
    const allQuestions = [
      { __questionKey: "set:a::idx:0", correct: 1 },
      { __questionKey: "set:a::idx:1", correct: 2 },
      { __questionKey: "set:b::idx:0", correct: 0 },
    ];

    const retried = createRetryWrongAnswersState({
      allQuestions,
      selectedAnswers: {
        "set:a::idx:0": 1,
        "set:a::idx:1": 0,
        "set:b::idx:0": 0,
      },
      solutionVisible: {
        "set:a::idx:1": true,
        "set:b::idx:0": true,
      },
      resolveQuestionKey,
    });

    expect(retried.hasWrongQuestions).toBe(true);
    expect(retried.filteredQuestions).toEqual([allQuestions[1]]);
    expect(retried.questionOrder).toEqual([0]);
    expect(retried.currentQuestionIndex).toBe(0);
    expect(retried.selectedTopic).toBe("hepsi");
    expect(retried.selectedAnswers).toEqual({
      "set:a::idx:0": 1,
      "set:b::idx:0": 0,
    });
    expect(retried.solutionVisible).toEqual({
      "set:b::idx:0": true,
    });
  });

  it("resets only active question progress and preserves unrelated entries", () => {
    const allQuestions = [
      { __questionKey: "set:a::idx:0" },
      { __questionKey: "set:a::idx:1" },
    ];

    const reset = createResetStudyState({
      allQuestions,
      selectedAnswers: {
        "set:a::idx:0": 1,
        "set:other::idx:9": 2,
      },
      solutionVisible: {
        "set:a::idx:1": true,
        "set:other::idx:9": true,
      },
      resolveQuestionKey,
    });

    expect(reset.filteredQuestions).toEqual(allQuestions);
    expect(reset.questionOrder).toEqual([0, 1]);
    expect(reset.currentQuestionIndex).toBe(0);
    expect(reset.selectedTopic).toBe("hepsi");
    expect(reset.selectedAnswers).toEqual({
      "set:other::idx:9": 2,
    });
    expect(reset.solutionVisible).toEqual({
      "set:other::idx:9": true,
    });
  });

  it("shuffles question order with an injectable random source and resets index", () => {
    const shuffled = shuffleQuestionOrder({
      questionOrder: [0, 1, 2, 3],
      random: () => 0,
    });

    expect(shuffled).toEqual({
      questionOrder: [1, 2, 3, 0],
      currentQuestionIndex: 0,
    });
  });
});
