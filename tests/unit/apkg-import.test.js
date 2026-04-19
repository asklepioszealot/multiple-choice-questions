import { describe, expect, it } from "vitest";
import path from "node:path";
import initSqlJs from "sql.js/dist/sql-wasm.js";
import { zipSync } from "fflate";

import { parseApkgToSetRecord } from "../../src/features/importers/apkg-import.js";

const FIELD_SEPARATOR = "\u001f";

function resolveTestSqlWasmUrl() {
  return path.resolve(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm");
}

async function createApkgBuffer(options = {}) {
  const {
    decks = {
      "1001": {
        name: "Tıp::Nöroloji",
      },
    },
    notes = [],
    mediaManifest = {},
    mediaEntries = {},
  } = options;

  const SQL = await initSqlJs({
    locateFile: () => resolveTestSqlWasmUrl(),
  });
  const database = new SQL.Database();

  database.run("CREATE TABLE col (decks TEXT)");
  database.run("CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT, tags TEXT)");
  database.run("CREATE TABLE cards (nid INTEGER, did INTEGER)");
  database.run("INSERT INTO col (decks) VALUES (?)", [JSON.stringify(decks)]);

  notes.forEach((note) => {
    database.run("INSERT INTO notes (id, flds, tags) VALUES (?, ?, ?)", [
      note.id,
      note.fields.join(FIELD_SEPARATOR),
      note.tags || "",
    ]);
    if (note.deckId !== undefined && note.deckId !== null) {
      database.run("INSERT INTO cards (nid, did) VALUES (?, ?)", [note.id, note.deckId]);
    }
  });

  const collectionBytes = database.export();
  database.close();

  const archiveBytes = zipSync({
    "collection.anki2": collectionBytes,
    media:
      typeof Buffer !== "undefined"
        ? Uint8Array.from(Buffer.from(JSON.stringify(mediaManifest), "utf8"))
        : Uint8Array.from(new TextEncoder().encode(JSON.stringify(mediaManifest))),
    ...mediaEntries,
  });

  return archiveBytes.buffer.slice(
    archiveBytes.byteOffset,
    archiveBytes.byteOffset + archiveBytes.byteLength,
  );
}

describe("parseApkgToSetRecord", () => {
  it("converts supported Anki notes into the MCQ set shape", async () => {
    const apkgBuffer = await createApkgBuffer({
      notes: [
        {
          id: 11,
          deckId: 1001,
          fields: [
            "<p><strong>Beyin sapı</strong> hangi sistemin parçasıdır?</p>",
            "Endokrin sistem",
            "Merkezi sinir sistemi",
            "Periferik sinir sistemi",
            "Sindirim sistemi",
            "B",
            "<script>alert('x')</script><p>Medulla, pons ve mezensefalonu içerir.</p>",
          ],
        },
        {
          id: 12,
          tags: "biyokimya metabolizma",
          fields: [
            "Glikolizin temel yakıtı hangisidir?",
            "Laktat",
            "Glukoz",
            "Üre",
            "Glukoz",
          ],
        },
      ],
    });

    const parsed = await parseApkgToSetRecord(apkgBuffer, "noroloji.apkg");

    expect(parsed.sourceFormat).toBe("json");
    expect(parsed.fileName).toBe("noroloji.json");
    expect(parsed.setName).toBe("noroloji");
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0]).toMatchObject({
      correct: 1,
      subject: "Nöroloji",
    });
    expect(parsed.questions[0].q).toContain("Beyin sapı");
    expect(parsed.questions[0].explanation).toContain("Medulla");
    expect(parsed.questions[0].explanation).not.toContain("<script");
    expect(parsed.questions[1]).toMatchObject({
      correct: 1,
      subject: "biyokimya",
      options: ["Laktat", "Glukoz", "Üre"],
    });
  });

  it("throws when the APKG does not contain any convertible MCQ notes", async () => {
    const apkgBuffer = await createApkgBuffer({
      notes: [
        {
          id: 21,
          deckId: 1001,
          fields: ["Ön yüz", "Arka yüz"],
        },
      ],
    });

    await expect(parseApkgToSetRecord(apkgBuffer, "unsupported.apkg")).rejects.toThrow(
      "MCQ formatına",
    );
  });

  it("hydrates Anki media references into safe HTML for MCQ fields", async () => {
    const apkgBuffer = await createApkgBuffer({
      notes: [
        {
          id: 31,
          deckId: 1001,
          fields: [
            '<p>Hangi yapı?<img src="brain.png" alt="Beyin sapı" /></p>',
            "Omurilik",
            "Beyin sapı",
            "B",
            '[sound:stem.mp3]<p>Doğru cevap budur.</p>',
          ],
        },
      ],
      mediaManifest: {
        "0": "brain.png",
        "1": "stem.mp3",
      },
      mediaEntries: {
        0: Uint8Array.from([137, 80, 78, 71]),
        1: Uint8Array.from([73, 68, 51]),
      },
    });
    const parsed = await parseApkgToSetRecord(apkgBuffer, "media.apkg");

    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].q).toContain(
      '<img src="data:image/png;base64,iVBORw==" alt="Beyin sapı" loading="lazy">',
    );
    expect(parsed.questions[0].explanation).toContain(
      '<audio controls="" preload="metadata" src="data:audio/mpeg;base64,SUQz"',
    );
    expect(parsed.questions[0].explanation).toContain("Doğru cevap budur.");
  });
});
