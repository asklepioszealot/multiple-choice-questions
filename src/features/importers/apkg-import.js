import { unzipSync } from "fflate";
import initSqlJs from "sql.js/dist/sql-wasm.js";

import { buildSetRecord } from "../../core/set-codec.js";
import { sanitizeHtml, sanitizeMediaSource } from "../../core/security.js";
import { resolveSqlWasmUrl } from "../../shared/sql-wasm.js";

const FIELD_SEPARATOR = "\u001f";

function fileStem(fileName) {
  return String(fileName || "anki-import").replace(/\.[^/.]+$/, "").trim() || "anki-import";
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "set";
}

function stripHtml(value) {
  const rawValue = String(value || "");

  if (typeof DOMParser === "function") {
    try {
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(`<div>${rawValue}</div>`, "text/html");
      return documentNode.body.textContent || "";
    } catch {
      // Fall through to the regex-based fallback below.
    }
  }

  return rawValue
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeComparisonText(value) {
  return stripHtml(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function guessMimeType(fileName) {
  const extension = String(fileName || "").split(".").pop()?.toLowerCase() || "";
  const mimeTypes = {
    avif: "image/avif",
    gif: "image/gif",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    mp4: "audio/mp4",
    ogg: "audio/ogg",
    png: "image/png",
    wav: "audio/wav",
    webm: "audio/webm",
    webp: "image/webp",
  };
  return mimeTypes[extension] || "application/octet-stream";
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function bytesToDataUri(bytes, fileName) {
  return `data:${guessMimeType(fileName)};base64,${bytesToBase64(bytes)}`;
}

function decodeText(bytes) {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("utf8");
  }

  let text = "";
  bytes.forEach((byte) => {
    text += String.fromCharCode(byte);
  });
  return text;
}

function parseMediaManifest(entry) {
  if (!entry) return {};
  try {
    return JSON.parse(decodeText(entry));
  } catch {
    return {};
  }
}

function buildMediaLookup(zipEntries) {
  const manifest = parseMediaManifest(zipEntries.media);
  const lookup = new Map();

  Object.entries(manifest).forEach(([index, mediaFileName]) => {
    const entry = zipEntries[index];
    if (!entry || typeof mediaFileName !== "string" || !mediaFileName.trim()) {
      return;
    }
    lookup.set(mediaFileName, bytesToDataUri(entry, mediaFileName));
  });

  return lookup;
}

function resolveAnkiMediaSource(source, mediaLookup, mediaType) {
  const trimmedSource = String(source || "").trim();
  if (!trimmedSource) return "";
  if (mediaLookup.has(trimmedSource)) {
    return mediaLookup.get(trimmedSource);
  }
  return sanitizeMediaSource(trimmedSource, mediaType);
}

function replaceSoundTokens(html, mediaLookup) {
  return String(html || "").replace(/\[sound:([^\]]+)\]/gi, (_, fileName) => {
    const safeSource = resolveAnkiMediaSource(fileName, mediaLookup, "audio");
    if (!safeSource) return "";
    return `<audio controls preload="metadata" src="${safeSource}" aria-label="${fileName}"></audio>`;
  });
}

function hydrateAnkiHtml(html, mediaLookup) {
  const withSound = replaceSoundTokens(html, mediaLookup);
  if (typeof DOMParser !== "function") {
    return sanitizeHtml(withSound);
  }

  try {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(`<div>${withSound}</div>`, "text/html");
    const root = documentNode.body.firstElementChild;
    if (!root) return sanitizeHtml(withSound);

    root.querySelectorAll("img").forEach((image) => {
      const safeSource = resolveAnkiMediaSource(
        image.getAttribute("src"),
        mediaLookup,
        "image",
      );
      if (!safeSource) {
        image.remove();
        return;
      }
      image.setAttribute("src", safeSource);
    });

    root.querySelectorAll("audio").forEach((audio) => {
      const safeSource = resolveAnkiMediaSource(
        audio.getAttribute("src"),
        mediaLookup,
        "audio",
      );
      if (!safeSource) {
        audio.remove();
        return;
      }
      audio.setAttribute("src", safeSource);
      audio.setAttribute("controls", "");
      audio.setAttribute("preload", "metadata");
    });

    root.querySelectorAll("source").forEach((source) => {
      const safeSource = resolveAnkiMediaSource(
        source.getAttribute("src"),
        mediaLookup,
        "audio",
      );
      if (!safeSource) {
        source.remove();
        return;
      }
      source.setAttribute("src", safeSource);
    });

    return sanitizeHtml(root.innerHTML);
  } catch {
    return sanitizeHtml(withSound);
  }
}

function sanitizeFieldHtml(value, mediaLookup) {
  return hydrateAnkiHtml(String(value || ""), mediaLookup).trim();
}

function resolveCorrectIndex(correctField, options) {
  const normalizedToken = normalizeComparisonText(correctField);
  if (!normalizedToken) {
    return -1;
  }

  if (/^[a-z]$/.test(normalizedToken)) {
    const optionIndex = normalizedToken.charCodeAt(0) - 97;
    return optionIndex >= 0 && optionIndex < options.length ? optionIndex : -1;
  }

  if (/^\d+$/.test(normalizedToken)) {
    const optionIndex = Number(normalizedToken) - 1;
    return optionIndex >= 0 && optionIndex < options.length ? optionIndex : -1;
  }

  return options.findIndex((option) => normalizeComparisonText(option) === normalizedToken);
}

function parseMcqFields(fields, mediaLookup) {
  if (!Array.isArray(fields) || fields.length < 4) {
    return null;
  }

  const questionHtml = sanitizeFieldHtml(fields[0], mediaLookup);
  if (!normalizeComparisonText(questionHtml)) {
    return null;
  }

  const attempts = [
    {
      optionFields: fields.slice(1, -1),
      correctField: fields.at(-1),
      explanationField: "",
    },
    {
      optionFields: fields.slice(1, -2),
      correctField: fields.at(-2),
      explanationField: fields.at(-1),
    },
  ];

  for (const attempt of attempts) {
    const options = attempt.optionFields
      .map((option) => sanitizeFieldHtml(option, mediaLookup))
      .filter((option) => normalizeComparisonText(option));

    if (options.length < 2) {
      continue;
    }

    const correctIndex = resolveCorrectIndex(attempt.correctField, options);
    if (correctIndex < 0) {
      continue;
    }

    return {
      q: questionHtml,
      options,
      correct: correctIndex,
      explanation: sanitizeFieldHtml(attempt.explanationField, mediaLookup),
    };
  }

  return null;
}

function parseDeckMap(database) {
  const result = database.exec("SELECT decks FROM col LIMIT 1");
  const decksJson = result?.[0]?.values?.[0]?.[0];
  if (!decksJson) {
    return {};
  }

  try {
    return JSON.parse(decksJson);
  } catch {
    return {};
  }
}

function pickSubject(deckName, tags) {
  const normalizedDeckName = String(deckName || "").trim();
  if (normalizedDeckName) {
    const parts = normalizedDeckName.split("::").filter(Boolean);
    return parts[parts.length - 1] || normalizedDeckName;
  }

  const firstTag = String(tags || "")
    .split(/\s+/)
    .map((value) => value.trim())
    .find(Boolean);

  return firstTag || "Genel";
}

export async function parseApkgToSetRecord(arrayBuffer, fileName, previousRecord = null) {
  const archiveBytes =
    arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const zipEntries = unzipSync(archiveBytes);
  const mediaLookup = buildMediaLookup(zipEntries);
  const collectionBytes = zipEntries["collection.anki2"] || zipEntries["collection.anki21"];
  if (!collectionBytes) {
    throw new Error("APKG içinde collection.anki2 veritabanı bulunamadı.");
  }

  const SQL = await initSqlJs({
    locateFile: () => resolveSqlWasmUrl(),
  });
  const database = new SQL.Database(collectionBytes);

  try {
    const decks = parseDeckMap(database);
    const notesQuery = database.exec(`
      SELECT notes.id, notes.flds, notes.tags, MIN(cards.did) AS did
      FROM notes
      LEFT JOIN cards ON cards.nid = notes.id
      GROUP BY notes.id, notes.flds, notes.tags
      ORDER BY notes.id ASC
    `);

    const rows = notesQuery?.[0]?.values || [];
    const questions = rows
      .map((row) => {
        const [, rawFields, rawTags, deckId] = row;
        const mappedQuestion = parseMcqFields(
          String(rawFields || "").split(FIELD_SEPARATOR),
          mediaLookup,
        );
        if (!mappedQuestion) {
          return null;
        }

        return {
          ...mappedQuestion,
          subject: pickSubject(decks?.[String(deckId)]?.name, rawTags),
        };
      })
      .filter(Boolean);

    if (!questions.length) {
      throw new Error("APKG içindeki notlar MCQ formatına dönüştürülemedi.");
    }

    const setName = fileStem(fileName);
    return buildSetRecord(
      {
        ...previousRecord,
        setName,
        fileName: `${slugify(setName)}.json`,
        sourceFormat: "json",
        rawSource: "",
        questions,
      },
      { previousRecord },
    );
  } finally {
    database.close();
  }
}

export default Object.freeze({
  parseApkgToSetRecord,
});
