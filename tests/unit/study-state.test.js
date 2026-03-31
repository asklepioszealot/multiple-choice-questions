import { describe, expect, it } from "vitest";
import {
  buildQuestionKey,
  legacyQuestionId,
  migrateLegacyAssessmentState,
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
});
