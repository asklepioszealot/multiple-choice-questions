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
      <button id="editor-question-list-toggle-btn" type="button"></button>
      <div id="editor-question-toolbar"></div>
      <textarea id="editor-question-text"></textarea>
      <input id="editor-subject" />
      <div id="editor-explanation-toolbar"></div>
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

  function openExistingMarkdownEditor(feature, record = {}) {
    feature.openEditor({
      id: "demo",
      setName: "Demo Set",
      fileName: "demo.md",
      sourceFormat: "markdown",
      questions: [
        {
          q: "",
          options: ["", ""],
          correct: 0,
          explanation: "",
          subject: "Genel",
        },
      ],
      ...record,
    });
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

  it("preserves safe image and audio markup through the visual editor roundtrip", () => {
    const draft = createEditorDraft({
      id: "media-demo",
      setName: "Media Demo",
      fileName: "media-demo.json",
      sourceFormat: "json",
      questions: [
        {
          q: '<p>Bu yapi nedir? <img src="data:image/png;base64,QUJD" alt="Beyin sapi" /></p>',
          options: ["Omurilik", "Beyin sapi"],
          correct: 1,
          explanation:
            '<audio controls src="data:audio/mpeg;base64,SUQz"></audio><p>Dogru cevap budur.</p>',
          subject: "Noroloji",
        },
      ],
    }, codecHelpers);

    expect(draft.questions[0].q).toContain("![Beyin sapi](data:image/png;base64,QUJD)");
    expect(draft.questions[0].explanation).toContain(
      "![audio: Ses kaydi](data:audio/mpeg;base64,SUQz)",
    );

    const savedRecord = serializeEditorDraft(draft, {
      id: "media-demo",
      fileName: "media-demo.json",
      sourceFormat: "json",
    }, codecHelpers);

    expect(savedRecord.questions[0].q).toContain("<img");
    expect(savedRecord.questions[0].q).toContain("data:image/png;base64,QUJD");
    expect(savedRecord.questions[0].explanation).toContain("<audio");
    expect(savedRecord.questions[0].explanation).toContain("data:audio/mpeg;base64,SUQz");
  });

  it("exports safe media to json and markdown while dropping unsafe tokens", () => {
    mountEditorDom();

    const createObjectUrl = vi.fn(() => "blob:editor-export");
    const revokeObjectUrl = vi.fn();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const previousCreateObjectUrl = URL.createObjectURL;
    const previousRevokeObjectUrl = URL.revokeObjectURL;
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;

    try {
      const feature = createEditorFeature({
        ...codecHelpers,
        documentRef: document,
      });

      openExistingMarkdownEditor(feature);
      feature.updateMetaField("setName", "Media Export");
      feature.updateCurrentQuestionField(
        "q",
        "Guvenli gorsel ![Beyin sapi](data:image/png;base64,QUJD) guvensiz gorsel ![XSS](javascript:alert('x'))",
      );
      feature.updateCurrentOption(0, "A");
      feature.updateCurrentOption(1, "B");
      feature.updateCurrentQuestionField(
        "explanation",
        "Guvenli ses ![audio: Ses kaydi](data:audio/mpeg;base64,SUQz) guvensiz ses ![audio: Kotu](file:///tmp/evil.mp3)",
      );

      const jsonPayload = feature.exportJson();
      const markdownPayload = feature.exportSource();

      expect(jsonPayload).toContain("<img");
      expect(jsonPayload).toContain("data:image/png;base64,QUJD");
      expect(jsonPayload).toContain("<audio");
      expect(jsonPayload).toContain("data:audio/mpeg;base64,SUQz");
      expect(jsonPayload).not.toContain("javascript:");
      expect(jsonPayload).not.toContain("file:///");

      expect(markdownPayload).toContain("![Beyin sapi](data:image/png;base64,QUJD)");
      expect(markdownPayload).toContain("![audio: Ses kaydi](data:audio/mpeg;base64,SUQz)");
      expect(markdownPayload).not.toContain("javascript:");
      expect(markdownPayload).not.toContain("file:///");

      expect(createObjectUrl).toHaveBeenCalledTimes(2);
      expect(anchorClick).toHaveBeenCalledTimes(2);
    } finally {
      anchorClick.mockRestore();
      URL.createObjectURL = previousCreateObjectUrl;
      URL.revokeObjectURL = previousRevokeObjectUrl;
    }
  });

  it("inserts lightweight media tokens into question and explanation fields", () => {
    mountEditorDom();

    const feature = createEditorFeature({
      ...codecHelpers,
      documentRef: document,
    });

    openExistingMarkdownEditor(feature);

    const questionInput = document.getElementById("editor-question-text");
    const explanationInput = document.getElementById("editor-explanation");
    questionInput.value = "Bu yapi nedir?";
    questionInput.setSelectionRange(questionInput.value.length, questionInput.value.length);

    const nextQuestionValue = feature.insertMediaToken("question", "image");
    expect(nextQuestionValue).toContain("![Gorsel aciklamasi](https://example.com/gorsel.png)");
    expect(feature.getDraft().questions[0].q).toContain(
      "![Gorsel aciklamasi](https://example.com/gorsel.png)",
    );
    expect(document.getElementById("editor-question-text").value).toContain(
      "![Gorsel aciklamasi](https://example.com/gorsel.png)",
    );

    explanationInput.value = "Aciklama";
    explanationInput.setSelectionRange(explanationInput.value.length, explanationInput.value.length);

    const nextExplanationValue = feature.insertMediaToken("explanation", "audio");
    expect(nextExplanationValue).toContain("![audio: Ses kaydi](https://example.com/ses.mp3)");
    expect(feature.getDraft().questions[0].explanation).toContain(
      "![audio: Ses kaydi](https://example.com/ses.mp3)",
    );
    expect(document.getElementById("editor-explanation").value).toContain(
      "![audio: Ses kaydi](https://example.com/ses.mp3)",
    );
  });

  it("inserts lightweight formatting tokens into question and explanation fields", () => {
    mountEditorDom();

    const feature = createEditorFeature({
      ...codecHelpers,
      documentRef: document,
    });

    openExistingMarkdownEditor(feature);

    const questionInput = document.getElementById("editor-question-text");
    const explanationInput = document.getElementById("editor-explanation");

    questionInput.value = "Kalin soru";
    questionInput.setSelectionRange(0, 5);

    const nextQuestionValue = feature.insertFormattingToken("question", "bold");
    expect(nextQuestionValue).toContain("**Kalin** soru");
    expect(feature.getDraft().questions[0].q).toContain("**Kalin** soru");
    expect(document.getElementById("editor-question-text").value).toContain("**Kalin** soru");

    explanationInput.value = "Aciklama";
    explanationInput.setSelectionRange(explanationInput.value.length, explanationInput.value.length);

    const nextExplanationValue = feature.insertFormattingToken("explanation", "warning");
    expect(nextExplanationValue).toContain("> ⚠️ Dikkat notu");
    expect(feature.getDraft().questions[0].explanation).toContain("> ⚠️ Dikkat notu");
    expect(document.getElementById("editor-explanation").value).toContain("> ⚠️ Dikkat notu");
    expect(document.getElementById("editor-question-toolbar").innerHTML).toContain(
      'data-editor-toolbar-action="table"',
    );
    expect(document.getElementById("editor-explanation-toolbar").innerHTML).toContain(
      'data-editor-toolbar-action="attachment-audio"',
    );
  });

  it("applies rendered toolbar button clicks to the active editor fields", () => {
    mountEditorDom();

    const feature = createEditorFeature({
      ...codecHelpers,
      documentRef: document,
    });

    openExistingMarkdownEditor(feature);

    const questionInput = document.getElementById("editor-question-text");
    questionInput.value = "Kalin soru";
    questionInput.setSelectionRange(0, 5);
    document
      .querySelector('#editor-question-toolbar [data-editor-toolbar-action="bold"]')
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    expect(document.getElementById("editor-question-text").value).toContain(
      "**Kalin** soru",
    );

    const explanationInput = document.getElementById("editor-explanation");
    explanationInput.value = "Aciklama";
    explanationInput.setSelectionRange(
      explanationInput.value.length,
      explanationInput.value.length,
    );
    document
      .querySelector(
        '#editor-explanation-toolbar [data-editor-toolbar-action="attachment-audio"]',
      )
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    expect(document.getElementById("editor-explanation").value).toContain(
      "![audio: Ses kaydi](https://example.com/ses.mp3)",
    );
  });

  it("supports undo redo history and preserves question list UI state", () => {
    mountEditorDom();

    const feature = createEditorFeature({
      ...codecHelpers,
      documentRef: document,
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
          explanation: "Eski aciklama",
          subject: "Genel",
        },
      ],
    });

    feature.selectQuestion(1);
    feature.updateCurrentQuestionField("q", "Ikinci soru guncel?");
    feature.applyHistoryAction("question", "undo");
    expect(document.getElementById("editor-question-text").value).toBe("Ikinci soru?");
    feature.applyHistoryAction("question", "redo");
    expect(document.getElementById("editor-question-text").value).toBe(
      "Ikinci soru guncel?",
    );

    const listEl = document.getElementById("editor-question-list");
    listEl.scrollTop = 48;
    listEl.dispatchEvent(new Event("scroll"));

    document.getElementById("editor-question-list-toggle-btn").click();
    expect(document.getElementById("editor-question-list").style.display).toBe("none");

    document.getElementById("editor-question-list-toggle-btn").click();
    expect(document.getElementById("editor-question-list").style.display).toBe("");
    expect(document.querySelectorAll("#editor-question-list .active")).toHaveLength(1);
    expect(document.querySelector("#editor-question-list .active").textContent).toContain(
      "Ikinci soru guncel?",
    );
    expect(document.getElementById("editor-question-list").scrollTop).toBe(48);
  });

  it("updates non-text editor fields without overwriting question text", () => {
    const feature = createEditorFeature({
      ...codecHelpers,
    });

    openExistingMarkdownEditor(feature);
    feature.updateCurrentQuestionField("q", "Soru?");
    feature.updateCurrentOption(0, "A");
    feature.updateCurrentOption(1, "B");
    feature.updateCurrentQuestionField("correct", "1");
    feature.updateCurrentQuestionField("subject", "Noroloji");

    expect(feature.getDraft().questions[0].q).toBe("Soru?");
    expect(feature.getDraft().questions[0].correct).toBe(1);
    expect(feature.getDraft().questions[0].subject).toBe("Noroloji");
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

  it("opens an existing markdown set in visual edit mode", () => {
    const feature = createEditorFeature({
      ...codecHelpers,
    });

    openExistingMarkdownEditor(feature, {
      id: "existing",
      setName: "Var olan set",
    });

    const draft = feature.getDraft();
    expect(draft.meta).toMatchObject({
      id: "existing",
      setName: "Var olan set",
      fileName: "demo.md",
      sourceFormat: "markdown",
    });
    expect(draft.mode).toBe("visual");
    expect(draft.activeQuestionIndex).toBe(0);
    expect(draft.questions).toHaveLength(1);
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

    openExistingMarkdownEditor(feature, {
      setName: "",
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
