import {
  createEditorDraft,
  resolveEditorCodecHelpers,
  toSafeArray,
} from "./editor-state.js";

export function buildRecordFromDraft(draft, baseRecord = {}, helpers = {}) {
  const codec = resolveEditorCodecHelpers(helpers);
  const draftQuestions = toSafeArray(draft.questions).filter(
    (question) =>
      String(question?.q || "").trim() ||
      toSafeArray(question?.options).some((option) => String(option || "").trim()),
  );

  return codec.buildSetRecord(
    {
      ...baseRecord,
      id: draft.meta.id || baseRecord.id || "",
      slug: draft.meta.slug || baseRecord.slug || "",
      setName: draft.meta.setName || baseRecord.setName || "",
      fileName:
        typeof draft?.meta?.fileName === "string"
          ? draft.meta.fileName
          : typeof baseRecord?.fileName === "string"
            ? baseRecord.fileName
            : "",
      sourceFormat:
        draft.meta.sourceFormat || baseRecord.sourceFormat || "json",
      questions: draftQuestions.map((question) => ({
        id: question.id,
        q: codec.formatEditableText(question.q),
        options: toSafeArray(question.options).map((option) =>
          codec.formatEditableText(option),
        ),
        correct: Number.isInteger(question.correct) ? question.correct : 0,
        explanation: codec.formatEditableText(question.explanation),
        subject:
          typeof question.subject === "string" && question.subject.trim()
            ? question.subject.trim()
            : "Genel",
      })),
    },
    { previousRecord: baseRecord },
  );
}

export function parseRawEditorDraft(rawText, baseRecord = {}, helpers = {}) {
  const codec = resolveEditorCodecHelpers(helpers);
  const parsedRecord = codec.parseSetText(
    rawText,
    baseRecord.fileName,
    baseRecord,
    baseRecord.sourceFormat,
  );

  return createEditorDraft(parsedRecord, codec);
}

export function serializeEditorDraft(draft, baseRecord = {}, helpers = {}) {
  return buildRecordFromDraft(draft, baseRecord, helpers);
}

export function createDownload(documentRef, payload, fileName, mimeType) {
  const blob = new Blob([payload], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return payload;
}
