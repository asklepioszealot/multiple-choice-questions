import { describe, expect, it } from "vitest";
import {
  applyEditorHistoryAction,
  recordEditorFieldHistory,
} from "../../src/features/editor/editor-history.js";

describe("editor-history", () => {
  it("records field snapshots and supports undo redo", () => {
    const first = recordEditorFieldHistory(null, "Ilk");
    const second = recordEditorFieldHistory(first, "Ikinci");
    const undone = applyEditorHistoryAction(second, "undo");
    const redone = applyEditorHistoryAction(undone.history, "redo");

    expect(undone.value).toBe("Ilk");
    expect(redone.value).toBe("Ikinci");
  });
});
