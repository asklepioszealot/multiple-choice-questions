import { describe, expect, it } from "vitest";
import {
  applyEditorToolbarAction,
  buildEditorToolbarActions,
} from "../../src/features/editor/editor-toolbar.js";

describe("editor-toolbar", () => {
  it("builds the MCQ toolbar action list and inserts markdown snippets", () => {
    const actions = buildEditorToolbarActions();
    const bold = applyEditorToolbarAction("Kalin soru", "bold", {
      selectionStart: 0,
      selectionEnd: 5,
    });
    const table = applyEditorToolbarAction("", "table");

    expect(actions.map((action) => action.id)).toEqual([
      "undo",
      "redo",
      "bold",
      "italic",
      "critical",
      "warning",
      "quote",
      "bulletList",
      "numberList",
      "link",
      "code",
      "divider",
      "table",
      "attachment-image",
      "attachment-audio",
    ]);
    expect(bold.value).toContain("**Kalin** soru");
    expect(table.value).toContain("| Başlık | Değer |");
  });
});
