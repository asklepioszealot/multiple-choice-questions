import { describe, expect, it } from "vitest";
import {
  buildStudyQuestions,
  collectStudySubjects,
  createFilteredStudyView,
  getBoundedQuestionIndex,
  selectStudyAnswer,
  toggleStudySolution,
} from "../../src/features/study/study-session.js";

describe("study-session helpers", () => {
  it("builds cloned study questions with set metadata for selected sets", () => {
    const originalQuestion = {
      q: "Soru 1",
      subject: "Kardiyoloji",
      options: ["A", "B", "C", "D"],
      correct: 1,
    };

    const questions = buildStudyQuestions({
      loadedSets: {
        cardio: {
          questions: [originalQuestion],
        },
        neuro: {
          questions: [{ q: "Soru 2", subject: "Nöroloji", options: [], correct: 0 }],
        },
      },
      selectedSetIds: new Set(["cardio"]),
      buildQuestionKey(setId, question, index) {
        return `${setId}:${index}:${question.q}`;
      },
    });

    expect(questions).toHaveLength(1);
    expect(questions[0]).toEqual({
      ...originalQuestion,
      __setId: "cardio",
      __setIndex: 0,
      __questionKey: "cardio:0:Soru 1",
    });
    expect(questions[0]).not.toBe(originalQuestion);
  });

  it("collects unique study subjects in first-seen order", () => {
    expect(
      collectStudySubjects([
        { subject: "Kardiyoloji" },
        { subject: "Nöroloji" },
        { subject: "Kardiyoloji" },
      ]),
    ).toEqual(["Kardiyoloji", "Nöroloji"]);
  });

  it("filters questions by topic and restores the preferred question when present", () => {
    const allQuestions = [
      { subject: "Kardiyoloji", __questionKey: "set:a::idx:0" },
      { subject: "Nöroloji", __questionKey: "set:a::idx:1" },
      { subject: "Nöroloji", __questionKey: "set:b::idx:0" },
    ];

    const filtered = createFilteredStudyView({
      allQuestions,
      selectedTopic: "Nöroloji",
      preferredQuestionKey: "set:b::idx:0",
      fallbackIndex: 0,
      resolveQuestionKey(question) {
        return question.__questionKey;
      },
    });

    expect(filtered.filteredQuestions).toEqual(allQuestions.slice(1));
    expect(filtered.questionOrder).toEqual([0, 1]);
    expect(filtered.currentQuestionIndex).toBe(1);
  });

  it("falls back to a bounded index when the preferred question is absent", () => {
    const filtered = createFilteredStudyView({
      allQuestions: [
        { subject: "Genel", __questionKey: "set:a::idx:0" },
        { subject: "Genel", __questionKey: "set:a::idx:1" },
      ],
      selectedTopic: "hepsi",
      preferredQuestionKey: "missing",
      fallbackIndex: 9,
      resolveQuestionKey(question) {
        return question.__questionKey;
      },
    });

    expect(filtered.currentQuestionIndex).toBe(1);
  });

  it("toggles answers off, selects new answers, and respects answer lock", () => {
    const question = { __questionKey: "set:a::idx:0" };

    expect(
      selectStudyAnswer({
        question,
        selectedAnswers: {},
        answerIndex: 2,
        answerLockEnabled: false,
        resolveQuestionKey(item) {
          return item.__questionKey;
        },
      }),
    ).toEqual({
      selectedAnswers: { "set:a::idx:0": 2 },
      answeredNow: true,
      blocked: false,
    });

    expect(
      selectStudyAnswer({
        question,
        selectedAnswers: { "set:a::idx:0": 2 },
        answerIndex: 2,
        answerLockEnabled: false,
        resolveQuestionKey(item) {
          return item.__questionKey;
        },
      }),
    ).toEqual({
      selectedAnswers: {},
      answeredNow: false,
      blocked: false,
    });

    expect(
      selectStudyAnswer({
        question,
        selectedAnswers: { "set:a::idx:0": 1 },
        answerIndex: 3,
        answerLockEnabled: true,
        resolveQuestionKey(item) {
          return item.__questionKey;
        },
      }),
    ).toEqual({
      selectedAnswers: { "set:a::idx:0": 1 },
      answeredNow: false,
      blocked: true,
    });
  });

  it("toggles solution visibility per question", () => {
    const question = { __questionKey: "set:a::idx:0" };

    expect(
      toggleStudySolution({
        question,
        solutionVisible: {},
        resolveQuestionKey(item) {
          return item.__questionKey;
        },
      }),
    ).toEqual({
      solutionVisible: { "set:a::idx:0": true },
      isVisible: true,
    });
  });

  it("bounds navigation indexes to the available question count", () => {
    expect(getBoundedQuestionIndex(-1, 5)).toBe(0);
    expect(getBoundedQuestionIndex(7, 5)).toBe(4);
    expect(getBoundedQuestionIndex(3, 0)).toBe(0);
  });
});
