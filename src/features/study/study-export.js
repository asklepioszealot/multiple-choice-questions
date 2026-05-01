import { zipSync } from "fflate";
import initSqlJs from "sql.js/dist/sql-wasm.js";

import { sanitizeHtml } from "../../core/security.js";
import { htmlToEditableText, serializeSetRecord } from "../../core/set-codec.js";
import { resolveSqlWasmUrl } from "../../shared/sql-wasm.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;
const OPTION_LABELS = ["A", "B", "C", "D", "E"];

function escapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(value) {
  return htmlToEditableText(value).replace(/\s+/g, " ").trim();
}

function normalizeExportQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).map((question, index) => ({
    ...question,
    id: question?.id || `export-${index + 1}`,
    q: sanitizeHtml(question?.q || ""),
    options: (Array.isArray(question?.options) ? question.options : []).map((option) =>
      sanitizeHtml(option || ""),
    ),
    correct: Number.isInteger(question?.correct) ? question.correct : -1,
    explanation: sanitizeHtml(question?.explanation || ""),
    subject: String(question?.subject || "Genel").trim() || "Genel",
  }));
}

function buildExportRecord({ questions, title = "Çoktan Seçmeli Test" } = {}) {
  return {
    setName: title,
    fileName: "mcq-export.md",
    sourceFormat: "markdown",
    questions: normalizeExportQuestions(questions),
  };
}

function buildPrintableStudyHtml({
  title = "Çoktan Seçmeli Test",
  questions,
  getExplanationHtml,
}) {
  const printableQuestions = normalizeExportQuestions(questions);
  const resolveExplanation =
    typeof getExplanationHtml === "function"
      ? getExplanationHtml
      : (question) => question?.explanation || "";

  let html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' +
    escapeHtml(title) +
    " - Test Çıktısı</title>";
  html += "<style>";
  html +=
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #21302a; line-height: 1.6; }';
  html +=
    ".question { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; page-break-inside: avoid; }";
  html += ".q-num { font-weight: 700; color: #2f7a56; margin-bottom: 8px; }";
  html += ".q-text { font-size: 16px; margin-bottom: 12px; }";
  html += ".option { padding: 4px 0; }";
  html += ".option.correct { color: #059669; font-weight: 600; }";
  html +=
    ".explanation { margin-top: 12px; padding: 12px; background: #f0fdf4; border-radius: 6px; font-size: 14px; border-left: 3px solid #2f7a56; }";
  html += "h1 { text-align: center; color: #2f7a56; }";
  html += "@media print { .question { border: 1px solid #ccc; } }";
  html += "</style></head><body><h1>" + escapeHtml(title) + "</h1>";

  printableQuestions.forEach((question, index) => {
    html += '<div class="question">';
    html +=
      '<div class="q-num">Soru ' +
      (index + 1) +
      " - " +
      escapeHtml(question?.subject || "") +
      "</div>";
    html += '<div class="q-text">' + question.q + "</div>";

    question.options.forEach((option, optionIndex) => {
      const isCorrect = optionIndex === question.correct;
      html +=
        '<div class="option' +
        (isCorrect ? " correct" : "") +
        '">' +
        (OPTION_LABELS[optionIndex] || String(optionIndex + 1)) +
        ") " +
        option +
        (isCorrect ? " ✓" : "") +
        "</div>";
    });

    html +=
      '<div class="explanation">' +
      sanitizeHtml(resolveExplanation(question)).replace(/<br>/g, "<br>") +
      "</div>";
    html += "</div>";
  });

  html += "</body></html>";
  return html;
}

function generateJson(questions, title = "Çoktan Seçmeli Test") {
  return new Blob(
    [
      JSON.stringify(
        {
          setName: title,
          questions: normalizeExportQuestions(questions),
        },
        null,
        2,
      ),
    ],
    { type: "application/json;charset=utf-8" },
  );
}

function generateMarkdown(questions, title = "Çoktan Seçmeli Test") {
  return new Blob(
    [serializeSetRecord(buildExportRecord({ questions, title }), "markdown")],
    { type: "text/markdown;charset=utf-8" },
  );
}

function generateCsv(questions) {
  const rows = ["Soru,Konu,Seçenekler,Doğru Cevap,Açıklama"];
  normalizeExportQuestions(questions).forEach((question) => {
    const correctLabel =
      question.correct >= 0 && question.correct < question.options.length
        ? `${OPTION_LABELS[question.correct] || question.correct + 1}) ${stripHtml(
            question.options[question.correct],
          )}`
        : "";
    rows.push(
      [
        stripHtml(question.q),
        question.subject,
        question.options
          .map((option, index) => `${OPTION_LABELS[index] || index + 1}) ${stripHtml(option)}`)
          .join(" | "),
        correctLabel,
        stripHtml(question.explanation),
      ]
        .map(escapeCsv)
        .join(","),
    );
  });

  return new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), rows.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
}

function generateHtml(questions, title = "Çoktan Seçmeli Test") {
  return new Blob([buildPrintableStudyHtml({ title, questions })], {
    type: "text/html;charset=utf-8",
  });
}

function generateAnkiGuid(seed) {
  let hash = 2166136261;
  const text = String(seed || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return String(hash >>> 0);
}

async function generateApkg(questions, title = "Çoktan Seçmeli Test") {
  const exportQuestions = normalizeExportQuestions(questions);
  const SQL = await initSqlJs({
    locateFile: () => resolveSqlWasmUrl(),
  });
  const db = new SQL.Database();
  const nowMs = Date.now();
  const todayUnix = Math.floor(nowMs / 1000);
  const deckId = todayUnix;
  const modelId = todayUnix + 1;

  db.run(`
    CREATE TABLE col (
      id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null,
      dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null,
      dconf text not null, tags text not null
    );
    CREATE TABLE notes (
      id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null,
      flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null
    );
    CREATE TABLE cards (
      id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null,
      type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null,
      lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null
    );
    CREATE TABLE revlog (
      id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null,
      factor integer not null, time integer not null, type integer not null
    );
  `);

  const model = {
    [modelId]: {
      id: modelId,
      name: "MCQ Basic",
      type: 0,
      mod: todayUnix,
      usn: -1,
      sortf: 0,
      did: deckId,
      tmpls: [
        {
          name: "Card 1",
          ord: 0,
          qfmt: "{{Question}}",
          afmt: "{{FrontSide}}<hr id=answer>{{Answer}}",
        },
      ],
      flds: [
        { name: "Question", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20 },
        { name: "Answer", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20 },
      ],
      css: ".card { font-family: arial; font-size: 20px; text-align: left; color: black; background-color: white; }",
      req: [[0, "all", [0]]],
    },
  };
  const decks = {
    1: { id: 1, mod: todayUnix, name: "Default", usn: -1, collapsed: false, browserCollapsed: false, desc: "", dyn: 0, conf: 1 },
    [deckId]: { id: deckId, mod: todayUnix, name: title, usn: -1, collapsed: false, browserCollapsed: false, desc: "", dyn: 0, conf: 1 },
  };
  const conf = { 1: { id: 1, mod: todayUnix, name: "Default", usn: -1 } };
  db.run(
    "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [1, todayUnix, todayUnix, todayUnix, 11, 0, 0, 0, JSON.stringify(conf), JSON.stringify(model), JSON.stringify(decks), "{}", "{}"],
  );

  const insertNote = db.prepare("INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertCard = db.prepare("INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  exportQuestions.forEach((question, index) => {
    const noteId = todayUnix * 1000 + index;
    const cardId = todayUnix * 1000 + index + 100000;
    const optionHtml = question.options
      .map((option, optionIndex) => `<div>${OPTION_LABELS[optionIndex] || optionIndex + 1}) ${option}</div>`)
      .join("");
    const correctOption = question.options[question.correct] || "";
    const front = `${question.q}<br>${optionHtml}`;
    const back = `<strong>Doğru cevap: ${OPTION_LABELS[question.correct] || ""}</strong><br>${correctOption}<br>${question.explanation || ""}`;
    insertNote.run([
      noteId,
      generateAnkiGuid(`${question.id}-${index}`),
      modelId,
      todayUnix,
      -1,
      ` ${question.subject.replace(/\s+/g, "_")} `,
      `${front}\x1f${back}`,
      0,
      0,
      0,
      "",
    ]);
    insertCard.run([cardId, noteId, deckId, 0, todayUnix, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ""]);
  });
  insertNote.free();
  insertCard.free();

  const sqliteBytes = db.export();
  db.close();
  return new Blob(
    [
      zipSync({
        "collection.anki2": sqliteBytes,
        media: new TextEncoder().encode("{}"),
      }),
    ],
    { type: "application/apkg" },
  );
}

function downloadBlob(blob, filename, documentRef = globalScope.document) {
  const url = globalScope.URL.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  documentRef.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    anchor.remove();
    globalScope.URL.revokeObjectURL(url);
  }, 100);
}

const AppStudyExport = Object.freeze({
  buildPrintableStudyHtml,
  downloadBlob,
  generateApkg,
  generateCsv,
  generateHtml,
  generateJson,
  generateMarkdown,
});

export {
  buildPrintableStudyHtml,
  downloadBlob,
  generateApkg,
  generateCsv,
  generateHtml,
  generateJson,
  generateMarkdown,
  AppStudyExport,
};
