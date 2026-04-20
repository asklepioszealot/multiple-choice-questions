import { describe, expect, it } from "vitest";
import {
  buildSetRecord,
  formatEditableText,
  htmlToEditableText,
  parseSetText,
  serializeSetRecord,
} from "../../src/core/set-codec.js";
import {
  createEditorDraft,
  duplicateDraftQuestion,
  moveDraftQuestion,
} from "../../src/features/editor/editor-state.js";

const codecHelpers = {
  buildSetRecord,
  formatEditableText,
  htmlToEditableText,
  parseSetText,
  serializeSetRecord,
};

describe("editor-state", () => {
  it("builds a draft and preserves question duplication and ordering helpers", () => {
    const draft = createEditorDraft(
      {
        id: "demo",
        setName: "Demo",
        fileName: "demo.md",
        sourceFormat: "markdown",
        questions: [
          {
            id: "q-1",
            q: "Ilk soru?",
            options: ["A", "B"],
            correct: 0,
            explanation: "Aciklama",
            subject: "Genel",
          },
          {
            id: "q-2",
            q: "Ikinci soru?",
            options: ["C", "D"],
            correct: 1,
            explanation: "",
            subject: "Genel",
          },
        ],
      },
      codecHelpers,
    );

    const duplicated = duplicateDraftQuestion(draft, 0);
    const moved = moveDraftQuestion(duplicated, 2, -1);

    expect(duplicated.questions).toHaveLength(3);
    expect(duplicated.questions[1].id).toBe(null);
    expect(moved.questions.map((question) => question.q)).toEqual([
      "Ilk soru?",
      "Ikinci soru?",
      "Ilk soru?",
    ]);
  });
});
