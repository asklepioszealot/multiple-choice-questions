import { describe, expect, it } from "vitest";
import { createSetManager } from "../../src/features/set-manager/set-manager.js";

function createMemoryStorage(seed = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function renderManagerDom() {
  document.body.innerHTML = `
    <div id="set-list"></div>
    <button id="start-btn" disabled></button>
    <div id="set-list-tools" style="display:none"></div>
    <button id="remove-selected-btn" disabled></button>
    <button id="delete-mode-btn"></button>
    <button id="select-all-btn"></button>
    <button id="clear-selection-btn"></button>
    <div id="mode-hint"></div>
    <div id="undo-toast" style="display:none"></div>
    <span id="undo-message"></span>
  `;
}

describe("set-manager controller", () => {
  it("loads persisted sets, filters missing selections, and renders the manager list", () => {
    renderManagerDom();
    const storage = createMemoryStorage({
      mc_loaded_sets: JSON.stringify(["demo", "missing"]),
      mc_selected_sets: JSON.stringify(["demo", "missing"]),
      mc_set_demo: JSON.stringify({
        setName: "Demo Set",
        fileName: "demo.json",
        questions: [
          {
            q: "Soru 1?",
            options: ["A", "B", "C", "D"],
            correct: 1,
            explanation: "Aciklama",
            subject: "Genel",
          },
        ],
      }),
    });

    const setManager = createSetManager({
      storage,
      normalizeQuestions(data) {
        return data.questions;
      },
      parseMarkdownToJSON() {
        throw new Error("Not implemented in this test");
      },
      getSelectedAnswers() {
        return {};
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}:${question.q}`;
      },
      documentRef: document,
      setTimeoutRef() {
        return 1;
      },
      clearTimeoutRef() {},
    });

    setManager.loadStoredSets();
    setManager.renderSetList();

    expect(setManager.getSelectedSetIds()).toEqual(["demo"]);
    expect(document.getElementById("start-btn").disabled).toBe(false);
    expect(document.getElementById("set-list-tools").style.display).toBe("flex");
    expect(document.querySelector("#set-list .set-name")?.textContent).toContain(
      "Demo Set",
    );
  });

  it("removes selected sets in delete mode and restores them with undo", () => {
    renderManagerDom();
    const storage = createMemoryStorage({
      mc_loaded_sets: JSON.stringify(["demo"]),
      mc_selected_sets: JSON.stringify(["demo"]),
      mc_set_demo: JSON.stringify({
        setName: "Demo Set",
        fileName: "demo.json",
        questions: [
          {
            q: "Soru 1?",
            options: ["A", "B", "C", "D"],
            correct: 1,
            explanation: "Aciklama",
            subject: "Genel",
          },
        ],
      }),
    });
    let timeoutCallCount = 0;

    const setManager = createSetManager({
      storage,
      normalizeQuestions(data) {
        return data.questions;
      },
      parseMarkdownToJSON() {
        throw new Error("Not implemented in this test");
      },
      getSelectedAnswers() {
        return {};
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}:${question.q}`;
      },
      documentRef: document,
      setTimeoutRef(callback) {
        timeoutCallCount += 1;
        return { callback };
      },
      clearTimeoutRef() {},
    });

    setManager.loadStoredSets();
    setManager.renderSetList();
    setManager.toggleDeleteMode();
    setManager.toggleSetCheck("demo");
    setManager.removeSelectedSets();

    expect(setManager.getLoadedSets()).toEqual({});
    expect(document.getElementById("undo-toast").style.display).toBe("flex");
    expect(storage.getItem("mc_set_demo")).toBeNull();
    expect(timeoutCallCount).toBe(1);

    setManager.undoLastRemoval();

    expect(Object.keys(setManager.getLoadedSets())).toEqual(["demo"]);
    expect(setManager.getSelectedSetIds()).toEqual(["demo"]);
    expect(document.getElementById("undo-toast").style.display).toBe("none");
    expect(storage.getItem("mc_set_demo")).not.toBeNull();
  });

  it("loads json text into storage with normalized questions", async () => {
    renderManagerDom();
    const storage = createMemoryStorage();
    let normalizeInput = null;

    const setManager = createSetManager({
      storage,
      normalizeQuestions(data) {
        normalizeInput = data;
        return data.questions.map((question) => ({
          ...question,
          normalized: true,
        }));
      },
      parseMarkdownToJSON() {
        throw new Error("Not implemented in this test");
      },
      getSelectedAnswers() {
        return {};
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}:${question.q}`;
      },
      documentRef: document,
      setTimeoutRef() {
        return 1;
      },
      clearTimeoutRef() {},
    });

    const setId = await setManager.loadSetFromText(
      '{"setName":"JSON Demo","questions":[{"q":"Test?","options":["A","B"],"correct":0,"explanation":"Aciklama","subject":"Genel",}]}',
      "json-demo.json",
    );

    expect(setId).toBe("json-demo");
    expect(normalizeInput?.setName).toBe("JSON Demo");
    expect(setManager.getLoadedSets()["json-demo"]).toMatchObject({
      setName: "JSON Demo",
      fileName: "json-demo.json",
      questions: [
        {
          q: "Test?",
          options: ["A", "B"],
          correct: 0,
          explanation: "Aciklama",
          subject: "Genel",
          normalized: true,
        },
      ],
    });
    expect(JSON.parse(storage.getItem("mc_loaded_sets"))).toEqual(["json-demo"]);
  });

  it("preserves sourcePath metadata for imported source files", async () => {
    renderManagerDom();
    const storage = createMemoryStorage();

    const setManager = createSetManager({
      storage,
      normalizeQuestions(data) {
        return data.questions;
      },
      parseSetText(text, fileName) {
        const parsed = JSON.parse(text);
        return {
          ...parsed,
          fileName,
          sourceFormat: "markdown",
          rawSource: text,
        };
      },
      getSelectedAnswers() {
        return {};
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}:${question.q}`;
      },
      documentRef: document,
      setTimeoutRef() {
        return 1;
      },
      clearTimeoutRef() {},
    });

    await setManager.loadSetFromText(
      '{"setName":"Linked Demo","questions":[{"q":"Test?","options":["A","B"],"correct":0,"explanation":"Aciklama","subject":"Genel"}]}',
      "linked-demo.md",
      { sourcePath: "C:\\sets\\linked-demo.md" },
    );

    expect(setManager.getLoadedSets()["linked-demo"]).toMatchObject({
      sourcePath: "C:\\sets\\linked-demo.md",
      fileName: "linked-demo.md",
    });
  });

  it("selects a loaded set and persists the selection list", async () => {
    renderManagerDom();
    const storage = createMemoryStorage();

    const setManager = createSetManager({
      storage,
      normalizeQuestions(data) {
        return data.questions;
      },
      parseMarkdownToJSON() {
        throw new Error("Not implemented in this test");
      },
      getSelectedAnswers() {
        return {};
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}:${question.q}`;
      },
      documentRef: document,
      setTimeoutRef() {
        return 1;
      },
      clearTimeoutRef() {},
    });

    await setManager.loadSetFromText(
      '{"setName":"Selectable","questions":[{"q":"Test?","options":["A","B"],"correct":0,"explanation":"Aciklama","subject":"Genel"}]}',
      "selectable.json",
    );
    setManager.selectSet("selectable");
    setManager.renderSetList();

    expect(setManager.getSelectedSetIds()).toEqual(["selectable"]);
    expect(JSON.parse(storage.getItem("mc_selected_sets"))).toEqual([
      "selectable",
    ]);
    expect(document.getElementById("start-btn").disabled).toBe(false);
  });

  it("persists imported sets through the remote save hook before storing them locally", async () => {
    renderManagerDom();
    const storage = createMemoryStorage();
    const onSetImported = async (record) => ({
      ...record,
      updatedAt: "2026-04-04T12:00:00.000Z",
    });

    const setManager = createSetManager({
      storage,
      normalizeQuestions(data) {
        return data.questions;
      },
      parseMarkdownToJSON() {
        throw new Error("Not implemented in this test");
      },
      getSelectedAnswers() {
        return {};
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}:${question.q}`;
      },
      onSetImported,
      documentRef: document,
      setTimeoutRef() {
        return 1;
      },
      clearTimeoutRef() {},
    });

    await setManager.loadSetFromText(
      '{"setName":"Remote Demo","questions":[{"q":"Test?","options":["A","B"],"correct":0,"explanation":"Aciklama","subject":"Genel"}]}',
      "remote-demo.json",
    );

    const persisted = setManager.getLoadedSets()["remote-demo"];
    expect(persisted.updatedAt).toBe("2026-04-04T12:00:00.000Z");
    expect(persisted.sourceFormat).toBe("json");
    expect(persisted.rawSource).toContain('"setName":"Remote Demo"');
  });

  it("keeps the set when remote deletion fails", async () => {
    renderManagerDom();
    const storage = createMemoryStorage({
      mc_loaded_sets: JSON.stringify(["demo"]),
      mc_selected_sets: JSON.stringify(["demo"]),
      mc_set_demo: JSON.stringify({
        setName: "Demo Set",
        fileName: "demo.json",
        sourceFormat: "json",
        rawSource: '{"setName":"Demo Set","questions":[]}',
        updatedAt: "2026-04-04T12:00:00.000Z",
        questions: [],
      }),
    });

    const setManager = createSetManager({
      storage,
      normalizeQuestions(data) {
        return data.questions;
      },
      parseMarkdownToJSON() {
        throw new Error("Not implemented in this test");
      },
      getSelectedAnswers() {
        return {};
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}:${question.q}`;
      },
      onSetsRemoved: async () => {
        throw new Error("remote delete failed");
      },
      documentRef: document,
      setTimeoutRef() {
        return 1;
      },
      clearTimeoutRef() {},
    });

    setManager.loadStoredSets();

    await expect(setManager.deleteSet("demo")).rejects.toThrow("remote delete failed");
    expect(Object.keys(setManager.getLoadedSets())).toEqual(["demo"]);
  });

  it("saves an updated set record directly for editor flows", async () => {
    renderManagerDom();
    const storage = createMemoryStorage({
      mc_loaded_sets: JSON.stringify(["demo"]),
      mc_selected_sets: JSON.stringify(["demo"]),
      mc_set_demo: JSON.stringify({
        id: "demo",
        setName: "Demo Set",
        fileName: "demo.md",
        questions: [
          {
            q: "Eski soru?",
            options: ["A", "B"],
            correct: 0,
            explanation: "Aciklama",
            subject: "Genel",
          },
        ],
      }),
    });

    const setManager = createSetManager({
      storage,
      normalizeQuestions(data) {
        return data.questions;
      },
      parseMarkdownToJSON() {
        throw new Error("Not implemented in this test");
      },
      getSelectedAnswers() {
        return {};
      },
      resolveQuestionKey(question, setId, index) {
        return `${setId}:${index}:${question.q}`;
      },
      documentRef: document,
      setTimeoutRef() {
        return 1;
      },
      clearTimeoutRef() {},
    });

    setManager.loadStoredSets();
    await setManager.saveSetRecord({
      id: "demo",
      setName: "Guncel Demo Set",
      fileName: "demo.md",
      questions: [
        {
          q: "Yeni soru?",
          options: ["A", "B"],
          correct: 1,
          explanation: "Yeni aciklama",
          subject: "Genel",
        },
      ],
    });

    expect(setManager.getLoadedSets().demo).toMatchObject({
      setName: "Guncel Demo Set",
      questions: [
        {
          q: "Yeni soru?",
          correct: 1,
        },
      ],
    });
    expect(setManager.getSelectedSetIds()).toEqual(["demo"]);
    expect(JSON.parse(storage.getItem("mc_set_demo"))).toMatchObject({
      setName: "Guncel Demo Set",
    });
  });
});
