import { describe, expect, it } from "vitest";
import {
  buildQuestionKey,
  legacyQuestionId,
  loadPersistedStudyState,
  migrateLegacyAssessmentState,
  persistStudyState,
  readSavedSession,
  resolveQuestionKey,
} from "../../src/features/study-state/study-state.js";

describe("study-state helpers", () => {
  it("builds set-scoped question keys", () => {
    expect(buildQuestionKey("demo", { id: "q-1" }, 0)).toBe("set:demo::id:q-1");
    expect(buildQuestionKey("demo", { q: "Soru" }, 2)).toBe("set:demo::idx:2");
  });

  it("resolves stored question keys from runtime question metadata", () => {
    expect(resolveQuestionKey({ __questionKey: "set:demo::idx:3" })).toBe("set:demo::idx:3");
    expect(resolveQuestionKey({ q: "Soru", subject: "Genel" }, "demo", 1)).toBe("set:demo::idx:1");
  });

  it("migrates legacy answer keys into set-scoped keys", () => {
    const question = {
      q: "Legacy soru?",
      options: ["A", "B", "C", "D"],
      correct: 0,
      subject: "Genel",
      explanation: "Aciklama",
    };
    const legacyKey = legacyQuestionId(question);

    const migrated = migrateLegacyAssessmentState({
      loadedSets: {
        "set-a": { questions: [question] },
        "set-b": { questions: [{ ...question, correct: 1 }] },
      },
      selectedAnswers: { [legacyKey]: 1 },
      solutionVisible: { [legacyKey]: true },
    });

    expect(migrated.changed).toBe(true);
    expect(migrated.selectedAnswers["set:set-a::idx:0"]).toBe(1);
    expect(migrated.selectedAnswers["set:set-b::idx:0"]).toBe(1);
    expect(migrated.solutionVisible["set:set-a::idx:0"]).toBe(true);
    expect(migrated.solutionVisible["set:set-b::idx:0"]).toBe(true);
  });

  it("returns fallback session when persisted session is invalid", () => {
    const storage = {
      getItem(key) {
        return key === "mc_session" ? "{invalid" : null;
      },
    };

    expect(readSavedSession(storage, { selectedTopic: "hepsi" })).toEqual({
      selectedTopic: "hepsi",
    });
  });

  it("loads persisted state and migrates legacy assessment keys", () => {
    const question = {
      q: "Legacy soru?",
      options: ["A", "B", "C", "D"],
      correct: 0,
      subject: "Genel",
      explanation: "Aciklama",
    };
    const legacyKey = legacyQuestionId(question);
    const writes = [];
    const storage = {
      getItem(key) {
        if (key === "mc_session") {
          return JSON.stringify({
            currentQuestionIndex: 0,
            currentQuestionKey: null,
            selectedTopic: "Genel",
          });
        }
        if (key === "mc_assessments") {
          return JSON.stringify({
            selectedAnswers: { [legacyKey]: 2 },
            solutionVisible: { [legacyKey]: true },
          });
        }
        return null;
      },
      setItem(key, value) {
        writes.push([key, JSON.parse(value)]);
      },
    };

    const loaded = loadPersistedStudyState({
      storage,
      loadedSets: {
        demo: { questions: [question] },
      },
      fallbackSession: null,
    });

    expect(loaded.pendingSession?.selectedTopic).toBe("Genel");
    expect(loaded.selectedAnswers["set:demo::idx:0"]).toBe(2);
    expect(loaded.solutionVisible["set:demo::idx:0"]).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe("mc_assessments");
  });

  it("persists session and assessment snapshots", () => {
    const writes = [];
    const storage = {
      setItem(key, value) {
        writes.push([key, JSON.parse(value)]);
      },
    };

    const sessionState = persistStudyState({
      storage,
      activeQuestion: { __questionKey: "set:demo::idx:3" },
      currentQuestionIndex: 3,
      selectedTopic: "Genel",
      selectedAnswers: { "set:demo::idx:3": 1 },
      solutionVisible: { "set:demo::idx:3": true },
    });

    expect(sessionState).toEqual({
      currentQuestionIndex: 3,
      currentQuestionKey: "set:demo::idx:3",
      selectedTopic: "Genel",
    });
    expect(writes).toEqual([
      ["mc_session", sessionState],
      [
        "mc_assessments",
        {
          selectedAnswers: { "set:demo::idx:3": 1 },
          solutionVisible: { "set:demo::idx:3": true },
        },
      ],
    ]);
  });
});
