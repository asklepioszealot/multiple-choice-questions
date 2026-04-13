import { describe, expect, it, vi } from "vitest";
import {
  buildSetRecord,
  formatEditableText,
  htmlToEditableText,
  parseSetText,
  serializeSetRecord,
} from "../../src/core/set-codec.js";
import {
  addDraftQuestion,
  createEditorDraft,
  createEditorFeature,
  createNewEditorDraft,
  getEditorValidationIssues,
  parseRawEditorDraft,
  serializeEditorDraft,
  updateDraftQuestionField,
  validateEditorDraft,
} from "../../src/features/editor/editor.js";

describe("editor helpers", () => {
  const codecHelpers = {
    buildSetRecord,
    formatEditableText,
    htmlToEditableText,
    parseSetText,
    serializeSetRecord,
  };

  function mountEditorDom() {
    document.body.innerHTML = `
      <div id="editor-screen"></div>
      <div id="editor-status"></div>
      <div id="editor-validation-summary"></div>
      <input id="editor-set-name" />
      <textarea id="editor-question-text"></textarea>
      <input id="editor-subject" />
      <textarea id="editor-explanation"></textarea>
      <textarea id="editor-raw-input"></textarea>
      <div id="editor-visual-panel"></div>
      <div id="editor-raw-panel"></div>
      <button id="editor-remove-question-btn" type="button"></button>
      <button id="editor-raw-tab-btn" type="button"></button>
      <label id="editor-raw-label"></label>
      <div id="editor-source-format-label"></div>
      <button id="editor-export-source-btn" type="button"></button>
      <button id="editor-duplicate-question-btn" type="button"></button>
      <button id="editor-move-question-up-btn" type="button"></button>
      <button id="editor-move-question-down-btn" type="button"></button>
      <div id="editor-dirty-pill"></div>
      <div id="editor-question-list"></div>
      <div id="editor-options"></div>
      <select id="editor-correct"></select>
      <button id="editor-save-btn" type="button"></button>
    `;
  }

  it("creates a draft from a loaded set record", () => {
    const draft = createEditorDraft({
      id: "demo",
      setName: "Demo Set",
      fileName: "demo.md",
      sourceFormat: "markdown",
      questions: [
        {
          q: "Soru?",
          options: ["A", "B"],
          correct: 1,
          explanation: "<strong>Aciklama</strong>",
          subject: "Genel",
        },
      ],
    }, codecHelpers);

    expect(draft.meta).toMatchObject({
      id: "demo",
      setName: "Demo Set",
      fileName: "demo.md",
      sourceFormat: "markdown",
    });
    expect(draft.questions).toHaveLength(1);
    expect(draft.activeQuestionIndex).toBe(0);
    expect(draft.questions[0].explanation).toBe("**Aciklama**");
  });

  it("updates question fields immutably and serializes back to a source-aware set record", () => {
    const initialDraft = createEditorDraft({
      id: "demo",
      setName: "Demo Set",
      fileName: "demo.md",
      sourceFormat: "markdown",
      questions: [
        {
          q: "Eski soru?",
          options: ["A", "B"],
          correct: 0,
          explanation: "Aciklama",
          subject: "Genel",
        },
      ],
    }, codecHelpers);

    const updatedDraft = updateDraftQuestionField(initialDraft, 0, "q", "Yeni soru?");
    const savedRecord = serializeEditorDraft(updatedDraft, {
      id: "demo",
      fileName: "demo.md",
      sourceFormat: "markdown",
    }, codecHelpers);

    expect(initialDraft.questions[0].q).toBe("Eski soru?");
    expect(updatedDraft.questions[0].q).toBe("Yeni soru?");
    expect(savedRecord.questions[0].q).toBe("Yeni soru?");
    expect(savedRecord.rawSource).toContain("Soru 1: Yeni soru?");
  });

  it("parses raw markdown into a normalized editor draft", () => {
    const rawDraft = parseRawEditorDraft(
      "# Raw Demo\n\nSoru 1: **Raw** soru?\nKonu: Genel\nA) A\nB) B\nDoğru Cevap: A\nAçıklama: Aciklama",
      {
        id: "raw-demo",
        fileName: "raw-demo.md",
        sourceFormat: "markdown",
      },
      codecHelpers,
    );

    expect(rawDraft.meta.setName).toBe("Raw Demo");
    expect(rawDraft.questions[0].q).toBe("**Raw** soru?");
  });

  it("adds a new empty question draft", () => {
    const draft = addDraftQuestion(
      createEditorDraft({
        id: "demo",
        setName: "Demo",
        fileName: "demo.json",
        questions: [],
      }, codecHelpers),
    );

    expect(draft.questions).toHaveLength(1);
    expect(draft.questions[0]).toMatchObject({
      q: "",
      options: ["", ""],
      correct: 0,
      explanation: "",
      subject: "Genel",
    });
  });

  it("creates a markdown-first draft for a brand new set", () => {
    const draft = createNewEditorDraft();

    expect(draft.meta).toMatchObject({
      setName: "",
      fileName: "",
      sourceFormat: "markdown",
      sourcePath: "",
    });
    expect(draft.mode).toBe("visual");
    expect(draft.activeQuestionIndex).toBe(0);
    expect(draft.questions).toHaveLength(1);
    expect(draft.questions[0]).toMatchObject({
      q: "",
      options: ["", ""],
      correct: 0,
      explanation: "",
      subject: "Genel",
    });
  });

  it("validates missing set name and underfilled options", () => {
    expect(
      validateEditorDraft({
        meta: {
          setName: "",
        },
        questions: [],
      }),
    ).toBe("Set adi bos olamaz.");

    expect(
      validateEditorDraft({
        meta: {
          setName: "Demo",
        },
        questions: [
          {
            q: "Soru var",
            options: ["Tek secenek", ""],
            correct: 0,
            explanation: "",
            subject: "Genel",
          },
        ],
      }),
    ).toBe("Soru 1: En az iki dolu secenek gerekli.");
  });

  it("collects question-specific validation issues for authoring polish", () => {
    expect(
      getEditorValidationIssues({
        meta: {
          setName: "Demo",
        },
        questions: [
          {
            q: "",
            options: ["Birinci", ""],
            correct: 1,
            explanation: "",
            subject: "Genel",
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        questionIndex: 0,
        message: "Soru 1: Soru metni gerekli.",
      }),
      expect.objectContaining({
        questionIndex: 0,
        message: "Soru 1: En az iki dolu secenek gerekli.",
      }),
      expect.objectContaining({
        questionIndex: 0,
        message: "Soru 1: Dogru cevap gecerli bir secenegi gostermeli.",
      }),
    ]);
  });

  it("disables save until the draft is valid and renders a jumpable summary", () => {
    mountEditorDom();
    const feature = createEditorFeature({
      ...codecHelpers,
      documentRef: document,
    });

    feature.openNewDraft({
      sourceFormat: "markdown",
    });

    expect(document.getElementById("editor-save-btn").disabled).toBe(true);
    expect(document.getElementById("editor-validation-summary").textContent).toContain(
      "Set adi bos olamaz.",
    );

    feature.updateMetaField("setName", "Demo");
    feature.updateCurrentQuestionField("q", "Soru?");
    feature.updateCurrentOption(0, "A");
    feature.updateCurrentOption(1, "B");
    feature.render();

    expect(document.getElementById("editor-save-btn").disabled).toBe(false);
    expect(document.getElementById("editor-validation-summary").textContent).toContain(
      "Kaydetmeye hazir",
    );
  });

  it("writes back to the source file after saving an editor draft", async () => {
    const saveSetRecord = vi.fn(async (record) => ({
      ...record,
      sourcePath: "C:\\sets\\demo.md",
    }));
    const writeSourceFile = vi.fn(async () => true);
    const showScreen = vi.fn();

    const feature = createEditorFeature({
      ...codecHelpers,
      saveSetRecord,
      showScreen,
      writeSourceFile,
    });

    feature.openEditor({
      id: "demo",
      setName: "Demo Set",
      fileName: "demo.md",
      sourceFormat: "markdown",
      sourcePath: "C:\\sets\\demo.md",
      questions: [
        {
          q: "Eski soru?",
          options: ["A", "B"],
          correct: 0,
          explanation: "",
          subject: "Genel",
        },
      ],
    });

    feature.updateCurrentQuestionField("q", "Yeni soru?");
    const savedRecord = await feature.save();

    expect(saveSetRecord).toHaveBeenCalledTimes(1);
    expect(writeSourceFile).toHaveBeenCalledWith(
      "C:\\sets\\demo.md",
      expect.stringContaining("Soru 1: Yeni soru?"),
    );
    expect(savedRecord?.sourcePath).toBe("C:\\sets\\demo.md");
    expect(showScreen).toHaveBeenLastCalledWith("manager");
  });

  it("blocks leaving the editor when there are unsaved changes and confirm is declined", () => {
    const showScreen = vi.fn();
    const confirmRef = vi.fn(() => false);

    const feature = createEditorFeature({
      ...codecHelpers,
      showScreen,
      confirmRef,
    });

    feature.openEditor({
      id: "demo",
      setName: "Demo Set",
      fileName: "demo.md",
      sourceFormat: "markdown",
      questions: [
        {
          q: "Eski soru?",
          options: ["A", "B"],
          correct: 0,
          explanation: "",
          subject: "Genel",
        },
      ],
    });

    expect(feature.isDirty()).toBe(false);
    feature.updateCurrentQuestionField("q", "Kirli soru?");
    expect(feature.isDirty()).toBe(true);

    feature.closeEditor();

    expect(confirmRef).toHaveBeenCalledTimes(1);
    expect(showScreen).toHaveBeenCalledTimes(1);
    expect(showScreen).toHaveBeenCalledWith("editor");
  });

  it("duplicates the active question as an authoring shortcut", () => {
    const feature = createEditorFeature({
      ...codecHelpers,
    });

    feature.openEditor({
      id: "demo",
      setName: "Demo Set",
      fileName: "demo.md",
      sourceFormat: "markdown",
      questions: [
        {
          id: "q-1",
          q: "Eski soru?",
          options: ["A", "B"],
          correct: 0,
          explanation: "Aciklama",
          subject: "Genel",
        },
      ],
    });

    feature.duplicateQuestion();

    const draft = feature.getDraft();
    expect(draft.questions).toHaveLength(2);
    expect(draft.activeQuestionIndex).toBe(1);
    expect(draft.questions[1]).toMatchObject({
      q: "Eski soru?",
      options: ["A", "B"],
      correct: 0,
      explanation: "Aciklama",
      subject: "Genel",
      id: null,
    });
  });

  it("moves the active question up and down for ordering polish", () => {
    const feature = createEditorFeature({
      ...codecHelpers,
    });

    feature.openEditor({
      id: "demo",
      setName: "Demo Set",
      fileName: "demo.md",
      sourceFormat: "markdown",
      questions: [
        {
          id: "q-1",
          q: "Ilk soru?",
          options: ["A", "B"],
          correct: 0,
          explanation: "",
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
    });

    feature.selectQuestion(1);
    feature.moveQuestion(-1);

    expect(feature.getDraft().activeQuestionIndex).toBe(0);
    expect(feature.getDraft().questions.map((question) => question.q)).toEqual([
      "Ikinci soru?",
      "Ilk soru?",
    ]);

    feature.moveQuestion(1);

    expect(feature.getDraft().activeQuestionIndex).toBe(1);
    expect(feature.getDraft().questions.map((question) => question.q)).toEqual([
      "Ilk soru?",
      "Ikinci soru?",
    ]);
  });

  it("exposes dirty-navigation guards for logout and unload flows", () => {
    const confirmRef = vi.fn(() => false);
    const feature = createEditorFeature({
      ...codecHelpers,
      confirmRef,
    });

    feature.openEditor({
      id: "demo",
      setName: "Demo Set",
      fileName: "demo.md",
      sourceFormat: "markdown",
      questions: [
        {
          q: "Eski soru?",
          options: ["A", "B"],
          correct: 0,
          explanation: "",
          subject: "Genel",
        },
      ],
    });

    feature.updateCurrentQuestionField("q", "Kirli soru?");

    expect(feature.shouldPreventUnload()).toBe(true);
    expect(
      feature.confirmNavigateAway("Kaydedilmemis degisiklikler var. Cikmak istiyor musun?"),
    ).toBe(false);
    expect(confirmRef).toHaveBeenCalledTimes(1);
  });
});
