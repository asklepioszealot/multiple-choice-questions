const path = require("path");
const { test, expect } = require("playwright/test");
const { zipSync } = require("fflate");
const initSqlJs = require("sql.js/dist/sql-wasm.js");

const FIELD_SEPARATOR = "\u001f";

function appUrl() {
  const appPort = Number(process.env.MCQ_TEST_PORT || 4174);
  return `http://127.0.0.1:${appPort}/`;
}

function resolveSqlWasmPath() {
  return path.resolve(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
}

async function createApkgUpload(options = {}) {
  const {
    fileName = "smoke-import.apkg",
    notes = [
      {
        id: 11,
        deckId: 1001,
        fields: [
          "Beyin sapı hangi sistemin parçasıdır?",
          "Endokrin sistem",
          "Merkezi sinir sistemi",
          "Periferik sinir sistemi",
          "Sindirim sistemi",
          "B",
          "Medulla, pons ve mezensefalonu içerir.",
        ],
        tags: "noroloji",
      },
    ],
    decks = { "1001": { name: "Tıp::Nöroloji" } },
    mediaManifest = {},
    mediaEntries = {},
  } = options;

  const SQL = await initSqlJs({
    locateFile: () => resolveSqlWasmPath(),
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
  return {
    name: fileName,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(archiveBytes),
  };
}

function legacyQuestionId(questionText, subject = "Genel") {
  let hash = 0;
  const text = `${questionText}${subject}`;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `mc_${hash}`;
}

async function clearStorage(page) {
  await page.goto(appUrl());
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

async function seedLocalSets(page, { sets, selectedSetIds, assessments, session }) {
  await page.goto(appUrl());
  await page.evaluate(
    ({ sets, selectedSetIds, assessments, session }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(
        "mc_auth_session",
        JSON.stringify({
          mode: "demo",
          userId: "demo-user",
          displayName: "Demo Modu",
        }),
      );
      Object.entries(sets).forEach(([setId, setData]) => {
        localStorage.setItem(`mc_set_${setId}`, JSON.stringify(setData));
      });
      const loadedSetIds = Object.keys(sets);
      localStorage.setItem("mc_loaded_sets", JSON.stringify(loadedSetIds));
      localStorage.setItem(
        "mc_selected_sets",
        JSON.stringify(selectedSetIds || loadedSetIds),
      );
      if (assessments) {
        localStorage.setItem("mc_assessments", JSON.stringify(assessments));
      }
      if (session) {
        localStorage.setItem("mc_session", JSON.stringify(session));
      }
    },
    {
      sets,
      selectedSetIds,
      assessments,
      session,
    },
  );
  await page.reload();
}

async function jumpToQuestion(page, questionNumber) {
  await page.fill("#jump-input", String(questionNumber));
  await page.press("#jump-input", "Enter");
  await expect(page.locator("#question-counter")).toContainText(
    `Soru ${questionNumber} /`,
  );
}

async function selectOption(page, optionIndex) {
  await page.locator("#options-container .option").nth(optionIndex).click();
  await page.waitForTimeout(200);
}

async function setHiddenToggle(page, inputSelector, checked) {
  const input = page.locator(inputSelector);
  if ((await input.isChecked()) !== checked) {
    await page.locator(`${inputSelector} + .toggle-slider`).click();
  }
}

async function continueAsDemo(page) {
  await page.locator("#demo-auth-btn").click();
  await expect(page.locator("#set-manager")).toBeVisible();
}

test.describe("MCQ smoke", () => {
  test("demo auth persists across reload and logout returns to auth screen", async ({
    page,
  }) => {
    await clearStorage(page);

    await expect(page.locator("#auth-screen")).toBeVisible();
    await expect(page.locator("#set-manager")).toBeHidden();

    await continueAsDemo(page);
    await expect(page.locator("#auth-status-badge")).toContainText("Demo Modu");
    await expect(page.locator("#auth-logout-btn")).toBeVisible();

    await page.reload();
    await expect(page.locator("#set-manager")).toBeVisible();
    await expect(page.locator("#auth-screen")).toBeHidden();

    await page.locator("#auth-logout-btn").click();
    await expect(page.locator("#auth-screen")).toBeVisible();
    await expect(page.locator("#set-manager")).toBeHidden();
  });

  test("set manager flow works from upload to start", async ({ page }) => {
    const fixturePath = path.resolve(
      process.cwd(),
      "tests",
      "fixtures",
      "smoke-set.json",
    );

    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());

    const authScreen = page.locator("#auth-screen");
    const setManager = page.locator("#set-manager");
    const mainApp = page.locator("#main-app");
    const startButton = page.locator("#start-btn");
    const setManagerHint = setManager.locator(".kbd-hint");
    const driveButton = page.locator("#drive-upload-btn");
    const managerPreferences = setManager.locator(".manager-preferences");
    const answerLockStatus = page.locator("#answer-lock-status");
    const autoAdvanceStatus = page.locator("#auto-advance-status");

    await expect(authScreen).toBeVisible();
    await continueAsDemo(page);
    await expect(setManager).toBeVisible();
    await expect(managerPreferences).toBeVisible();
    await expect(answerLockStatus).toHaveText("Cevapları kilitle: Kapalı");
    await expect(autoAdvanceStatus).toHaveText("Otomatik sonraki soru: Kapalı");
    await expect(setManagerHint).toBeVisible();
    await expect(setManagerHint).toContainText("A-E");
    await expect(setManagerHint).toContainText("F");
    await expect(page.locator("#import-set-btn")).toBeVisible();
    await expect(driveButton).toBeVisible();
    await expect(driveButton).toHaveClass(/btn-secondary/);
    await expect(page.locator("#check-updates-btn")).toBeHidden();
    await expect(page.locator("#manager-settings-panel")).toBeHidden();
    await page.click("#manager-settings-toggle-btn");
    await expect(page.locator("#manager-settings-panel")).toBeVisible();
    await page.click("#manager-settings-toggle-btn");
    await expect(page.locator("#manager-settings-panel")).toBeHidden();

    const themeSelect = page.locator("#theme-select-manager");
    await expect(themeSelect).toBeVisible();
    await themeSelect.selectOption("dark");
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute("data-theme")))
      .toBe("dark");

    await themeSelect.selectOption("light");
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute("data-theme")))
      .toBeNull();

    await page.setInputFiles("#file-picker", fixturePath);
    await expect(page.locator("#set-list .set-name", { hasText: "Smoke Test Set" })).toBeVisible();
    await expect(startButton).toBeEnabled();

    await startButton.click();
    await expect(mainApp).toBeVisible();
    await expect(setManager).toBeHidden();
    await expect(mainApp.locator(".kbd-hint")).toHaveCount(0);
  });

  test("set manager imports a supported apkg file and starts study", async ({ page }) => {
    const fixture = await createApkgUpload();

    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());
    await continueAsDemo(page);

    await page.setInputFiles("#file-picker", fixture);
    await expect(page.locator("#set-list .set-name", { hasText: "smoke-import" })).toBeVisible();
    await expect(page.locator("#start-btn")).toBeEnabled();

    await page.click("#start-btn");
    await expect(page.locator("#main-app")).toBeVisible();
    await expect(page.locator("#question-text")).toContainText("Beyin sapı");
    await expect(page.locator("#options-container .option").nth(1)).toContainText(
      "Merkezi sinir sistemi",
    );

    await page.click("#show-solution-btn");
    await expect(page.locator("#solution")).toContainText("Medulla");
  });

  test("apkg import preserves safe image and audio media in study mode", async ({ page }) => {
    const fixture = await createApkgUpload({
      fileName: "media-import.apkg",
      notes: [
        {
          id: 21,
          deckId: 1001,
          fields: [
            '<p>Bu yapı nedir?<img src="brain.png" alt="Beyin sapı" /></p>',
            "Omurilik",
            "Beyin sapı",
            "B",
            '[sound:stem.mp3]<p>Doğru cevap budur.</p>',
          ],
          tags: "noroloji",
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

    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());
    await continueAsDemo(page);

    await page.setInputFiles("#file-picker", fixture);
    await expect(page.locator("#set-list .set-name", { hasText: "media-import" })).toBeVisible();
    await page.click("#start-btn");

    const questionImage = page.locator("#question-text img");
    await expect(questionImage).toBeVisible();
    await expect(questionImage).toHaveAttribute("src", /data:image\/png;base64,/);

    await page.click("#show-solution-btn");
    const solutionAudio = page.locator("#solution audio");
    await expect(solutionAudio).toBeVisible();
    await expect(solutionAudio).toHaveAttribute("src", /data:audio\/mpeg;base64,/);
  });

  test("editor updates a selected set and returns to manager", async ({ page }) => {
    const fixturePath = path.resolve(
      process.cwd(),
      "tests",
      "fixtures",
      "smoke-set.json",
    );

    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());
    await continueAsDemo(page);

    await page.setInputFiles("#file-picker", fixturePath);
    await expect(page.locator("#edit-btn")).toBeEnabled();

    await page.locator("#edit-btn").click();
    await expect(page.locator("#editor-screen")).toBeVisible();

    await page.fill("#editor-set-name", "Edited Smoke Set");
    await page.fill("#editor-question-text", "Duzenlenmis soru?");
    await page.click("#editor-save-btn");

    await expect(page.locator("#set-manager")).toBeVisible();
    await expect(page.locator("#set-list .set-name", { hasText: "Edited Smoke Set" })).toBeVisible();

    await page.click("#start-btn");
    await expect(page.locator("#question-text")).toContainText("Duzenlenmis soru?");
  });

  test("manager can create a brand new markdown-first set from scratch", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());
    await continueAsDemo(page);

    await expect(page.locator("#set-list .set-empty")).toBeVisible();
    await page.click("#new-set-btn");
    await expect(page.locator("#editor-screen")).toBeVisible();
    await expect(page.locator("#editor-source-format-label")).toContainText("Markdown/TXT");
    await expect(page.locator("#editor-question-list .editor-question-item")).toHaveCount(1);
    await expect(page.locator("#editor-save-btn")).toBeDisabled();
    await expect(page.locator("#editor-validation-summary")).toContainText(
      "Set adi bos olamaz.",
    );

    await page.fill("#editor-set-name", "Sifirdan Set");
    await page.fill("#editor-question-text", "Yeni markdown soru?");
    await expect(page.locator("#editor-save-btn")).toBeDisabled();
    await expect(page.locator("#editor-validation-summary")).toContainText(
      "En az iki dolu secenek gerekli.",
    );
    await page.evaluate(() => {
      const updateOption = (index, value) => {
        const input = document.querySelector(`[data-editor-option-index="${index}"]`);
        if (!input) {
          throw new Error(`Option input ${index} not found`);
        }
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };

      updateOption(0, "Birinci");
      updateOption(1, "Ikinci");
    });
    await page.locator("#editor-correct").selectOption("1");
    await page.fill("#editor-explanation", "Yeni aciklama");
    await expect(page.locator("#editor-save-btn")).toBeEnabled();
    await page.click("#editor-save-btn");

    await expect(page.locator("#set-manager")).toBeVisible();
    await expect(page.locator("#set-list .set-name", { hasText: "Sifirdan Set" })).toBeVisible();
    await expect(page.locator("#edit-btn")).toBeEnabled();
    await expect(page.locator("#start-btn")).toBeEnabled();
    await page.click("#edit-btn");
    await expect(page.locator("#editor-screen")).toBeVisible();
    await expect(page.locator("#editor-set-name")).toHaveValue("Sifirdan Set");
    await expect(page.locator("#editor-question-text")).toHaveValue("Yeni markdown soru?");
    await expect(page.locator("#editor-source-format-label")).toContainText("Markdown/TXT");
    await page.click('button:has-text("Yoneticiye don")');

    await page.click("#start-btn");
    await expect(page.locator("#question-text")).toContainText("Yeni markdown soru?");
  });

  test("editor protects unsaved changes and can duplicate the active question", async ({
    page,
  }) => {
    const fixturePath = path.resolve(
      process.cwd(),
      "tests",
      "fixtures",
      "smoke-set.md",
    );

    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());
    await continueAsDemo(page);

    await page.setInputFiles("#file-picker", fixturePath);
    await page.locator("#edit-btn").click();
    await expect(page.locator("#editor-screen")).toBeVisible();
    await expect(page.locator("#editor-dirty-pill")).toHaveText("Durum: Kaydedildi");

    await page.fill("#editor-question-text", "Kirli soru?");
    await expect(page.locator("#editor-dirty-pill")).toHaveText("Durum: Kaydedilmedi");

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.click('button:has-text("Yoneticiye don")');
    await expect(page.locator("#editor-screen")).toBeVisible();
    await expect(page.locator("#editor-question-text")).toHaveValue("Kirli soru?");

    await page.click("#editor-duplicate-question-btn");
    await expect(page.locator("#editor-question-list .editor-question-item")).toHaveCount(2);
  });

  test("markdown set survives visual edit and raw roundtrip", async ({ page }) => {
    const fixturePath = path.resolve(
      process.cwd(),
      "tests",
      "fixtures",
      "smoke-set.md",
    );

    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());
    await continueAsDemo(page);

    await page.setInputFiles("#file-picker", fixturePath);
    await expect(
      page.locator("#set-list .set-name", { hasText: "Smoke Markdown Set" }),
    ).toBeVisible();

    await page.locator("#edit-btn").click();
    await expect(page.locator("#editor-screen")).toBeVisible();

    await page.fill("#editor-question-text", "Duzenlenmis **Markdown** soru?");
    await page.fill("#editor-explanation", "Aciklama satiri 1\n> ⚠️ satir 2");
    await page.locator("#editor-raw-tab-btn").click();

    await expect(page.locator("#editor-raw-input")).toHaveValue(
      /Soru 1: Duzenlenmis \*\*Markdown\*\* soru\?/,
    );
    await expect(page.locator("#editor-raw-input")).toHaveValue(
      /Açıklama: Aciklama satiri 1/,
    );

    await page.click("#editor-save-btn");
    await expect(page.locator("#set-manager")).toBeVisible();

    await page.click("#start-btn");
    await expect(page.locator("#question-text")).toContainText("Duzenlenmis");
    await expect(page.locator("#question-text")).toContainText("Markdown");
  });

  test("raw code view expands to content height", async ({ page }) => {
    const fixturePath = path.resolve(
      process.cwd(),
      "tests",
      "fixtures",
      "smoke-set.md",
    );

    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());
    await continueAsDemo(page);

    await page.setInputFiles("#file-picker", fixturePath);
    await page.locator("#edit-btn").click();
    await page.locator("#editor-raw-tab-btn").click();

    const rawInput = page.locator("#editor-raw-input");
    const initialClientHeight = await rawInput.evaluate((el) => el.clientHeight);
    await rawInput.evaluate((el) => {
      el.value = `${el.value}\n\nSoru 99: Ek satir testi?\nA) Bir\nB) Iki\nDoğru Cevap: A\nAçıklama: Uzayan içerik`;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await expect(rawInput).toHaveCSS("resize", "none");
    await expect(rawInput).toHaveCSS("overflow-y", "auto");
    const { clientHeight, scrollHeight } = await rawInput.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }));
    expect(clientHeight).toBe(scrollHeight);
    expect(clientHeight).toBeGreaterThan(initialClientHeight);
  });

  test("manager analytics summary updates after answering and returning", async ({
    page,
  }) => {
    const fixturePath = path.resolve(
      process.cwd(),
      "tests",
      "fixtures",
      "smoke-set.json",
    );

    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());
    await continueAsDemo(page);

    await page.setInputFiles("#file-picker", fixturePath);
    await expect(page.locator("#analytics-dashboard-manager")).toBeHidden();
    await page.click("#analytics-toggle-btn");
    await expect(page.locator("#analytics-dashboard-manager")).toBeVisible();
    await expect(page.locator("#analytics-sets-value")).toHaveText("1 / 1");
    await expect(page.locator("#analytics-questions-value")).toHaveText("1 / 0");
    await page.click("#analytics-close-btn");
    await expect(page.locator("#analytics-dashboard-manager")).toBeHidden();

    await page.click("#start-btn");
    await selectOption(page, 1);
    await page.locator("#show-set-manager-btn").click();

    await expect(page.locator("#analytics-dashboard-manager")).toBeHidden();
    await page.click("#analytics-toggle-btn");
    await expect(page.locator("#analytics-questions-value")).toHaveText("1 / 1");
    await expect(page.locator("#analytics-results-value")).toHaveText("1 / 0");
    await expect(page.locator("#analytics-completion-value")).toHaveText("%100");
  });

  test("sync conflict panel shows diff details and cloud resolution applies remote workspace", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl());
    await continueAsDemo(page);

    await page.evaluate(() => {
      const localWorkspace = {
        loadedSets: {
          local: {
            id: "local",
            setName: "Kardiyoloji",
            fileName: "cardio.md",
            sourcePath: "C:/sets/cardio.md",
            sourceFormat: "markdown",
            updatedAt: "2026-04-04T10:00:00.000Z",
            questions: [
              {
                id: "q-1",
                q: "Yerel soru?",
                options: ["A", "B"],
                correct: 0,
                explanation: "Aciklama",
                subject: "Genel",
              },
            ],
          },
        },
        selectedSetIds: ["local"],
      };
      const remoteRecords = [
        {
          id: "cloud",
          setName: "Kardiyoloji",
          fileName: "cardio.md",
          sourcePath: "C:/sets/cardio.md",
          sourceFormat: "markdown",
          updatedAt: "2026-04-04T10:00:00.000Z",
          questions: [
            {
              id: "q-1",
              q: "Bulut soru?",
              options: ["A", "B"],
              correct: 1,
              explanation: "Aciklama",
              subject: "Genel",
            },
          ],
        },
      ];
      const remoteSnapshot = {
        selectedSetIds: ["cloud"],
        selectedAnswers: {
          "set:cloud::id:q-1": 1,
        },
        solutionVisible: {},
        session: {
          currentQuestionIndex: 0,
          currentQuestionKey: "set:cloud::id:q-1",
          selectedTopic: "Genel",
        },
        autoAdvanceEnabled: false,
      };
      const conflict = window.AppSyncConflict.detectSyncConflict({
        localWorkspace,
        remoteRecords,
        localSnapshot: {
          selectedSetIds: ["local"],
          selectedAnswers: {
            "set:local::id:q-1": 0,
          },
          solutionVisible: {},
          session: {
            currentQuestionIndex: 0,
            currentQuestionKey: "set:local::id:q-1",
            selectedTopic: "Genel",
          },
          autoAdvanceEnabled: false,
        },
        remoteSnapshot,
      });

      window.__MCQ_TEST_HOOKS__.showSyncConflictPreview({
        conflict,
        userPrefix: "",
        localWorkspaceSeed: localWorkspace,
        localWorkspacePrefix: "",
        localSnapshotSeed: null,
        localSnapshotPrefix: "",
        remoteRecords,
        remoteSnapshot,
      });
    });

    await expect(page.locator("#sync-conflict-panel")).toBeVisible();
    await expect(page.locator("#sync-conflict-local-details")).toContainText(
      "Kardiyoloji: Iki taraf da degismis",
    );
    await expect(page.locator("#sync-conflict-remote-details")).toContainText(
      "Soru farki: 1",
    );

    await page.click('button:has-text("Bulutu kullan")');
    await expect(page.locator("#sync-conflict-panel")).toBeHidden();
    await expect(page.locator("#set-list .set-name")).toContainText("Kardiyoloji");
  });

  test("desktop import writes edited markdown back to its source file", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.__MCQ_TAURI_CALLS__ = [];
      window.__TAURI__ = {
        core: {
          invoke: async (command, args = {}) => {
            if (command === "plugin:updater|check") {
              return null;
            }

            if (
              command === "plugin:resources|close" ||
              command === "plugin:updater|download_and_install" ||
              command === "plugin:process|restart"
            ) {
              return null;
            }

            if (command === "pick_native_set_files") {
              return [
                {
                  path: "C:\\sets\\native-demo.md",
                  name: "native-demo.md",
                  contents: [
                    "# Native Demo",
                    "",
                    "Soru 1: Ilk soru?",
                    "Konu: Genel",
                    "A) A",
                    "B) B",
                    "Doğru Cevap: A",
                    "Açıklama: Aciklama",
                  ].join("\n"),
                },
              ];
            }

            if (command === "write_set_source_file") {
              window.__MCQ_TAURI_CALLS__.push({
                command,
                args,
              });
              return null;
            }

            throw new Error(`unexpected tauri command: ${command}`);
          },
        },
      };
    });

    await page.goto(appUrl());
    await continueAsDemo(page);

    await page.locator("#import-set-btn").click();
    await expect(page.locator("#set-list .set-name")).toContainText("Native Demo");

    await page.locator("#edit-btn").click();
    await page.fill("#editor-question-text", "Native duzenlenmis soru?");
    await page.click("#editor-save-btn");

    await expect(page.locator("#set-manager")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => window.__MCQ_TAURI_CALLS__),
      )
      .toEqual([
        {
          command: "write_set_source_file",
          args: {
            sourcePath: "C:\\sets\\native-demo.md",
            rawSource: expect.stringContaining("Soru 1: Native duzenlenmis soru?"),
          },
        },
      ]);
  });

  test("resume exact question after reload", async ({ page }) => {
    await seedLocalSets(page, {
      sets: {
        demo: {
          setName: "Resume Demo",
          fileName: "resume-demo.json",
          questions: [
            {
              q: "Kart A?",
              options: ["A1", "A2", "A3", "A4"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
            {
              q: "Kart B?",
              options: ["B1", "B2", "B3", "B4"],
              correct: 1,
              subject: "Genel",
              explanation: "B",
            },
            {
              q: "Kart C?",
              options: ["C1", "C2", "C3", "C4"],
              correct: 2,
              subject: "Genel",
              explanation: "C",
            },
          ],
        },
      },
      selectedSetIds: ["demo"],
    });

    await page.locator("#start-btn").click();
    await page.locator("#next-btn").click();
    await page.locator("#next-btn").click();

    await expect(page.locator("#question-counter")).toHaveText("Soru 3 / 3");
    await expect(page.locator("#question-text")).toContainText("Kart C?");

    await page.reload();
    await page.locator("#start-btn").click();

    await expect(page.locator("#question-counter")).toHaveText("Soru 3 / 3");
    await expect(page.locator("#question-text")).toContainText("Kart C?");
  });

  test("resume exact question after returning to set manager", async ({ page }) => {
    await seedLocalSets(page, {
      sets: {
        demo: {
          setName: "Manager Resume Demo",
          fileName: "manager-resume-demo.json",
          questions: [
            {
              q: "Soru A?",
              options: ["A1", "A2", "A3", "A4"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
            {
              q: "Soru B?",
              options: ["B1", "B2", "B3", "B4"],
              correct: 1,
              subject: "Genel",
              explanation: "B",
            },
            {
              q: "Soru C?",
              options: ["C1", "C2", "C3", "C4"],
              correct: 2,
              subject: "Genel",
              explanation: "C",
            },
          ],
        },
      },
      selectedSetIds: ["demo"],
    });

    await page.locator("#start-btn").click();
    await page.locator("#next-btn").click();
    await page.locator("#next-btn").click();

    await expect(page.locator("#question-counter")).toHaveText("Soru 3 / 3");
    await page.locator("#show-set-manager-btn").click();
    await page.locator("#start-btn").click();

    await expect(page.locator("#question-counter")).toHaveText("Soru 3 / 3");
    await expect(page.locator("#question-text")).toContainText("Soru C?");
  });

  test("next navigation updates immediately and suppresses carried-over transitions", async ({
    page,
  }) => {
    await seedLocalSets(page, {
      sets: {
        demo: {
          setName: "Instant Next Demo",
          fileName: "instant-next-demo.json",
          questions: [
            {
              q: "Birinci soru?",
              options: ["A1", "A2", "A3", "A4"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
            {
              q: "Ikinci soru?",
              options: ["B1", "B2", "B3", "B4"],
              correct: 1,
              subject: "Genel",
              explanation: "B",
            },
          ],
        },
      },
      selectedSetIds: ["demo"],
    });

    await page.locator("#start-btn").click();
    await selectOption(page, 0);

    await page.locator("#next-btn").click();

    const immediateState = await page.evaluate(() => {
      const questionText = document.getElementById("question-text")?.textContent || "";
      const firstOption = document.querySelector("#options-container .option");
      const optionClasses = Array.from(
        document.querySelectorAll("#options-container .option"),
      ).map((option) => option.className);

      return {
        questionText,
        transitionProperty: firstOption
          ? window.getComputedStyle(firstOption).transitionProperty
          : null,
        optionClasses,
      };
    });

    expect(immediateState.questionText).toContain("Ikinci soru?");
    expect(immediateState.transitionProperty).toBe("none");
    expect(immediateState.optionClasses.every((className) => className === "option")).toBe(
      true,
    );
  });

  test("jump navigation updates immediately and suppresses carried-over transitions", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const pendingFrames = [];
      window.__mcqPendingFrames = pendingFrames;
      window.requestAnimationFrame = (callback) => {
        pendingFrames.push(callback);
        return pendingFrames.length;
      };
      window.cancelAnimationFrame = (frameId) => {
        pendingFrames[frameId - 1] = null;
      };
    });

    await seedLocalSets(page, {
      sets: {
        demo: {
          setName: "Instant Jump Demo",
          fileName: "instant-jump-demo.json",
          questions: [
            {
              q: "Birinci soru?",
              options: ["A1", "A2", "A3", "A4"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
            {
              q: "Ikinci soru?",
              options: ["B1", "B2", "B3", "B4"],
              correct: 1,
              subject: "Genel",
              explanation: "B",
            },
          ],
        },
      },
      selectedSetIds: ["demo"],
    });

    await page.locator("#start-btn").click();
    await selectOption(page, 0);

    await jumpToQuestion(page, 2);

    const immediateState = await page.evaluate(() => {
      const questionCard = document.getElementById("question-card");
      const questionText = document.getElementById("question-text")?.textContent || "";
      const optionClasses = Array.from(
        document.querySelectorAll("#options-container .option"),
      ).map((option) => option.className);

      return {
        questionText,
        hasResetClass: questionCard?.classList.contains("mcq--instant-reset") || false,
        optionClasses,
        pendingFrameCount: window.__mcqPendingFrames?.length || 0,
      };
    });

    expect(immediateState.questionText).toContain("Ikinci soru?");
    expect(immediateState.hasResetClass).toBe(true);
    expect(immediateState.pendingFrameCount).toBeGreaterThan(0);
    expect(immediateState.optionClasses.every((className) => className === "option")).toBe(
      true,
    );

    await page.evaluate(() => {
      const pendingFrames = window.__mcqPendingFrames || [];
      const firstFrame = pendingFrames.shift();
      if (typeof firstFrame === "function") {
        firstFrame(performance.now());
      }
    });

    await page.evaluate(() => {
      const pendingFrames = window.__mcqPendingFrames || [];
      const secondFrame = pendingFrames.shift();
      if (typeof secondFrame === "function") {
        secondFrame(performance.now());
      }
    });

    await expect
      .poll(async () =>
        page.evaluate(() =>
          document
            .getElementById("question-card")
            .classList.contains("mcq--instant-reset"),
        ),
      )
      .toBe(false);
  });

  test("clicking the same answer twice clears the question", async ({ page }) => {
    await seedLocalSets(page, {
      sets: {
        demo: {
          setName: "Toggle Answer Demo",
          fileName: "toggle-answer-demo.json",
          questions: [
            {
              q: "Doğru cevap A mı?",
              options: ["Evet", "Hayır", "Belki", "Bilmiyorum"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
          ],
        },
      },
      selectedSetIds: ["demo"],
    });

    await page.locator("#start-btn").click();
    await selectOption(page, 0);

    await expect(page.locator("#options-container .option").nth(0)).toHaveClass(
      /correct/,
    );

    await selectOption(page, 0);

    await expect(page.locator("#options-container .option").nth(0)).not.toHaveClass(
      /correct/,
    );

    const assessments = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mc_assessments") || "{}"),
    );
    expect(Object.keys(assessments.selectedAnswers || {})).toHaveLength(0);
  });

  test("score display stays visible before any question is answered", async ({
    page,
  }) => {
    await seedLocalSets(page, {
      sets: {
        demo: {
          setName: "Score Demo",
          fileName: "score-demo.json",
          questions: [
            {
              q: "Henüz çözülmedi mi?",
              options: ["Evet", "Hayır", "Belki", "Sonra"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
          ],
        },
      },
      selectedSetIds: ["demo"],
    });

    await page.locator("#start-btn").click();
    await expect(page.locator("#score-display")).toHaveText(
      "✅ 0 ❌ 0 📊 0/1 (%0) 🎯 %0",
    );
  });

  test("fullscreen mode toggles with keyboard shortcuts", async ({ page }) => {
    await seedLocalSets(page, {
      sets: {
        demo: {
          setName: "Fullscreen Demo",
          fileName: "fullscreen-demo.json",
          questions: [
            {
              q: "Tam ekran testi?",
              options: ["A", "B", "C", "D"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
          ],
        },
      },
      selectedSetIds: ["demo"],
    });

    await page.locator("#start-btn").click();
    await page.press("body", "F");

    await expect
      .poll(async () =>
        page.evaluate(() =>
          document
            .getElementById("question-card")
            .classList.contains("fullscreen-active"),
        ),
      )
      .toBe(true);
    await expect(page.locator("#fullscreen-question-counter")).toHaveText(
      "Soru 1 / 1",
    );
    await expect(page.locator("#fullscreen-score-display")).toHaveText(
      "✅ 0 ❌ 0 📊 0/1 (%0) 🎯 %0",
    );

    await page.press("body", "Escape");

    await expect
      .poll(async () =>
        page.evaluate(() =>
          document
            .getElementById("question-card")
            .classList.contains("fullscreen-active"),
        ),
      )
      .toBe(false);
  });

  test("reset only clears progress for active sets", async ({ page }) => {
    await seedLocalSets(page, {
      sets: {
        "set-a": {
          setName: "Aktif Set",
          fileName: "active-set.json",
          questions: [
            {
              q: "Aktif soru?",
              options: ["A", "B", "C", "D"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
          ],
        },
        "set-b": {
          setName: "Pasif Set",
          fileName: "inactive-set.json",
          questions: [
            {
              q: "Pasif soru?",
              options: ["A", "B", "C", "D"],
              correct: 1,
              subject: "Genel",
              explanation: "B",
            },
          ],
        },
      },
      selectedSetIds: ["set-a"],
      assessments: {
        selectedAnswers: {
          "set:set-a::idx:0": 2,
          "set:set-b::idx:0": 3,
        },
        solutionVisible: {
          "set:set-a::idx:0": true,
          "set:set-b::idx:0": true,
        },
      },
    });

    await page.locator("#start-btn").click();
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Seçili/aktif setlerdeki");
      await dialog.accept();
    });
    await page.locator("#reset-quiz-btn").click();

    const assessments = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mc_assessments") || "{}"),
    );

    expect(assessments.selectedAnswers["set:set-a::idx:0"]).toBeUndefined();
    expect(assessments.solutionVisible["set:set-a::idx:0"]).toBeUndefined();
    expect(assessments.selectedAnswers["set:set-b::idx:0"]).toBe(3);
    expect(assessments.solutionVisible["set:set-b::idx:0"]).toBe(true);
  });

  test("answer lock prevents changing or clearing an answered question", async ({
    page,
  }) => {
    await seedLocalSets(page, {
      sets: {
        demo: {
          setName: "Answer Lock Demo",
          fileName: "answer-lock-demo.json",
          questions: [
            {
              q: "Kilidi test edelim mi?",
              options: ["Evet", "Hayır", "Belki", "Sonra"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
          ],
        },
      },
      selectedSetIds: ["demo"],
    });

    await setHiddenToggle(page, "#answer-lock-toggle-manager", true);
    await expect(page.locator("#answer-lock-status")).toHaveText(
      "Cevapları kilitle: Açık",
    );

    await page.locator("#start-btn").click();
    await selectOption(page, 0);
    await selectOption(page, 0);
    await selectOption(page, 1);

    await expect(page.locator("#options-container .option").nth(0)).toHaveClass(
      /correct/,
    );
    await expect(page.locator("#options-container .option").nth(1)).not.toHaveClass(
      /wrong/,
    );

    await page.locator("#show-set-manager-btn").click();
    await setHiddenToggle(page, "#answer-lock-toggle-manager", false);
    await page.locator("#start-btn").click();
    await selectOption(page, 0);

    const assessments = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mc_assessments") || "{}"),
    );
    expect(Object.keys(assessments.selectedAnswers || {})).toHaveLength(0);
  });

  test("auto advance persists and moves to the next question", async ({
    page,
  }) => {
    await seedLocalSets(page, {
      sets: {
        demo: {
          setName: "Auto Advance Demo",
          fileName: "auto-advance-demo.json",
          questions: [
            {
              q: "İlk soru?",
              options: ["A", "B", "C", "D"],
              correct: 0,
              subject: "Genel",
              explanation: "A",
            },
            {
              q: "İkinci soru?",
              options: ["A", "B", "C", "D"],
              correct: 1,
              subject: "Genel",
              explanation: "B",
            },
          ],
        },
      },
      selectedSetIds: ["demo"],
    });

    await setHiddenToggle(page, "#auto-advance-toggle-manager", true);
    await expect(page.locator("#auto-advance-status")).toHaveText(
      "Otomatik sonraki soru: Açık",
    );

    await page.reload();
    await expect(page.locator("#auto-advance-status")).toHaveText(
      "Otomatik sonraki soru: Açık",
    );

    await page.locator("#start-btn").click();
    await selectOption(page, 0);
    await page.waitForTimeout(450);
    await expect(page.locator("#question-counter")).toHaveText("Soru 2 / 2");
    await expect(page.locator("#solution")).not.toHaveClass(/visible/);
  });

  test("duplicate question across sets keeps answers independent", async ({
    page,
  }) => {
    await seedLocalSets(page, {
      sets: {
        "set-a": {
          setName: "Set A",
          fileName: "set-a.json",
          questions: [
            {
              q: "Aynı soru?",
              options: ["A", "B", "C", "D"],
              correct: 0,
              subject: "Genel",
              explanation: "Set A",
            },
          ],
        },
        "set-b": {
          setName: "Set B",
          fileName: "set-b.json",
          questions: [
            {
              q: "Aynı soru?",
              options: ["A", "B", "C", "D"],
              correct: 1,
              subject: "Genel",
              explanation: "Set B",
            },
          ],
        },
      },
      selectedSetIds: ["set-a", "set-b"],
    });

    await page.locator("#start-btn").click();
    await selectOption(page, 0);
    await page.locator("#next-btn").click();
    await selectOption(page, 1);

    const snapshot = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mc_assessments") || "{}"),
    );
    const selectedAnswers = snapshot.selectedAnswers || {};
    const setScopedEntries = Object.entries(selectedAnswers).filter(([key]) =>
      key.startsWith("set:"),
    );

    expect(setScopedEntries).toHaveLength(2);
    expect(setScopedEntries.map(([, value]) => value).sort()).toEqual([0, 1]);

    await page.reload();
    await page.locator("#start-btn").click();

    await jumpToQuestion(page, 1);
    await jumpToQuestion(page, 2);

    const afterReload = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mc_assessments") || "{}"),
    );
    const afterEntries = Object.entries(afterReload.selectedAnswers || {}).filter(
      ([key]) => key.startsWith("set:"),
    );
    expect(afterEntries).toHaveLength(2);
  });

  test("legacy answer keys migrate to set-based keys", async ({ page }) => {
    const questionText = "Legacy soru?";
    const subject = "Genel";
    const legacyKey = legacyQuestionId(questionText, subject);

    await seedLocalSets(page, {
      sets: {
        "set-a": {
          setName: "Set A",
          fileName: "set-a.json",
          questions: [
            {
              q: questionText,
              options: ["A", "B", "C", "D"],
              correct: 0,
              subject,
              explanation: "Set A",
            },
          ],
        },
        "set-b": {
          setName: "Set B",
          fileName: "set-b.json",
          questions: [
            {
              q: questionText,
              options: ["A", "B", "C", "D"],
              correct: 1,
              subject,
              explanation: "Set B",
            },
          ],
        },
      },
      selectedSetIds: ["set-a", "set-b"],
      assessments: {
        selectedAnswers: { [legacyKey]: 1 },
        solutionVisible: { [legacyKey]: true },
      },
    });

    await page.locator("#start-btn").click();

    const migrated = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mc_assessments") || "{}"),
    );
    const migratedAnswers = Object.entries(migrated.selectedAnswers || {}).filter(
      ([key]) => key.startsWith("set:"),
    );
    const migratedVisibility = Object.entries(migrated.solutionVisible || {}).filter(
      ([key]) => key.startsWith("set:"),
    );

    expect(migratedAnswers).toHaveLength(2);
    expect(migratedAnswers.map(([, value]) => value)).toEqual([1, 1]);
    expect(migratedVisibility).toHaveLength(2);
    expect(migratedVisibility.map(([, value]) => value)).toEqual([true, true]);
  });
});
