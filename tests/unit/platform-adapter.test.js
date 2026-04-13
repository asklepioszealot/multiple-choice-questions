import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_REMEMBER_ME_KEY,
  createAuthSessionStorage,
  createPlatformAdapter,
} from "../../src/core/platform-adapter.js";

function createMemoryStorage(seed = {}) {
  const localStore = new Map(Object.entries(seed.local || {}));
  const sessionStore = new Map(Object.entries(seed.session || {}));

  return {
    getItem(key) {
      return localStore.has(key) ? localStore.get(key) : null;
    },
    setItem(key, value) {
      localStore.set(key, String(value));
    },
    removeItem(key) {
      localStore.delete(key);
    },
    getLocalItem(key) {
      return localStore.has(key) ? localStore.get(key) : null;
    },
    setLocalItem(key, value) {
      localStore.set(key, String(value));
    },
    removeLocalItem(key) {
      localStore.delete(key);
    },
    getSessionItem(key) {
      return sessionStore.has(key) ? sessionStore.get(key) : null;
    },
    setSessionItem(key, value) {
      sessionStore.set(key, String(value));
    },
    removeSessionItem(key) {
      sessionStore.delete(key);
    },
  };
}

let originalTauri = null;

afterEach(() => {
  globalThis.__TAURI__ = originalTauri;
  originalTauri = null;
});

describe("platform adapter", () => {
  it("stores auth session in session storage when remember me is off", () => {
    const storage = createMemoryStorage();
    const authStorage = createAuthSessionStorage(storage);

    authStorage.setRememberMePreference(false);
    authStorage.setItem("sb-session", "session-token");

    expect(storage.getSessionItem("sb-session")).toBe("session-token");
    expect(storage.getLocalItem("sb-session")).toBeNull();
    expect(storage.getLocalItem(AUTH_REMEMBER_ME_KEY)).toBe("0");
  });

  it("stores auth session in local storage when remember me is on", () => {
    const storage = createMemoryStorage();
    const authStorage = createAuthSessionStorage(storage);

    authStorage.setRememberMePreference(true);
    authStorage.setItem("sb-session", "session-token");

    expect(storage.getLocalItem("sb-session")).toBe("session-token");
    expect(storage.getSessionItem("sb-session")).toBeNull();
    expect(storage.getLocalItem(AUTH_REMEMBER_ME_KEY)).toBe("1");
  });

  it("creates a supabase adapter when runtime config is present", async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: {
        user: {
          id: "user-1",
          email: "doctor@example.com",
        },
      },
      error: null,
    }));
    const createClient = vi.fn(() => ({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: null },
          error: null,
        })),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        })),
        signInWithPassword,
        signUp: vi.fn(),
        signOut: vi.fn(async () => ({ error: null })),
      },
    }));

    const platformAdapter = createPlatformAdapter({
      storage: createMemoryStorage(),
      getRuntimeConfig() {
        return {
          supabaseUrl: "https://example.supabase.co",
          supabaseAnonKey: "anon-key",
        };
      },
      createClientRef: createClient,
    });

    expect(platformAdapter.type).toBe("supabase-web");
    expect(platformAdapter.supportsPasswordAuth).toBe(true);
    expect(platformAdapter.supportsDemoAuth).toBe(false);

    await platformAdapter.signIn(" Doctor@Example.com ", "super-secret", {
      rememberMe: false,
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "doctor@example.com",
      password: "super-secret",
    });
  });

  it("loads and saves synced sets and user state through the Supabase adapter", async () => {
    let lastSavedSetRow = null;
    const from = vi.fn((tableName) => {
      if (tableName === "mcq_sets") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    id: "remote-demo",
                    user_id: "user-1",
                    slug: "remote-demo",
                    set_name: "Remote Demo",
                    file_name: "remote-demo.json",
                    source_format: "json",
                    source_path: "C:\\sets\\remote-demo.json",
                    raw_source:
                      '{"setName":"Remote Demo","questions":[{"q":"Test?","options":["A","B"],"correct":0,"explanation":"Aciklama","subject":"Genel"}]}',
                    questions_json: [
                      {
                        q: "Test?",
                        options: ["A", "B"],
                        correct: 0,
                        explanation: "Aciklama",
                        subject: "Genel",
                      },
                    ],
                    updated_at: "2026-04-04T12:00:00.000Z",
                  },
                ],
                error: null,
              })),
            })),
          })),
          upsert: vi.fn((row) => {
            lastSavedSetRow = row;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "remote-demo",
                    user_id: "user-1",
                    slug: "remote-demo",
                    set_name: "Remote Demo",
                    file_name: "remote-demo.json",
                    source_format: "json",
                    source_path: row.source_path || "",
                    raw_source:
                      '{"setName":"Remote Demo","questions":[{"q":"Test?","options":["A","B"],"correct":0,"explanation":"Aciklama","subject":"Genel"}]}',
                    questions_json: [
                      {
                        q: "Test?",
                        options: ["A", "B"],
                        correct: 0,
                        explanation: "Aciklama",
                        subject: "Genel",
                      },
                    ],
                    updated_at: "2026-04-04T12:00:00.000Z",
                  },
                  error: null,
                })),
              })),
            };
          }),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                error: null,
              })),
            })),
          })),
        };
      }

      if (tableName === "mcq_user_state") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  user_id: "user-1",
                  state_json: {
                    selectedSetIds: ["remote-demo"],
                    selectedAnswers: { "set:remote-demo::idx:0": 0 },
                    solutionVisible: {},
                    session: {
                      currentQuestionIndex: 0,
                      currentQuestionKey: "set:remote-demo::idx:0",
                      selectedTopic: "Genel",
                    },
                    autoAdvanceEnabled: true,
                    updatedAt: "2026-04-04T12:00:00.000Z",
                  },
                  updated_at: "2026-04-04T12:00:00.000Z",
                },
                error: null,
              })),
            })),
          })),
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  user_id: "user-1",
                  state_json: {
                    selectedSetIds: ["remote-demo"],
                    selectedAnswers: { "set:remote-demo::idx:0": 0 },
                    solutionVisible: {},
                    session: {
                      currentQuestionIndex: 0,
                      currentQuestionKey: "set:remote-demo::idx:0",
                      selectedTopic: "Genel",
                    },
                    autoAdvanceEnabled: true,
                    updatedAt: "2026-04-04T12:00:00.000Z",
                  },
                  updated_at: "2026-04-04T12:00:00.000Z",
                },
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`unexpected table ${tableName}`);
    });

    const createClient = vi.fn(() => ({
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: {
              user: {
                id: "user-1",
                email: "doctor@example.com",
              },
            },
          },
          error: null,
        })),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        })),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(async () => ({ error: null })),
      },
      from,
    }));

    const platformAdapter = createPlatformAdapter({
      storage: createMemoryStorage(),
      getRuntimeConfig() {
        return {
          supabaseUrl: "https://example.supabase.co",
          supabaseAnonKey: "anon-key",
        };
      },
      createClientRef: createClient,
    });

    const records = await platformAdapter.loadSets();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "remote-demo",
      setName: "Remote Demo",
      sourceFormat: "json",
      sourcePath: "C:\\sets\\remote-demo.json",
    });

    const snapshot = await platformAdapter.loadUserState();
    expect(snapshot).toMatchObject({
      selectedSetIds: ["remote-demo"],
      autoAdvanceEnabled: true,
    });

    const savedRecord = await platformAdapter.saveSet({
      id: "remote-demo",
      slug: "remote-demo",
      setName: "Remote Demo",
      fileName: "remote-demo.json",
      sourceFormat: "json",
      sourcePath: "C:\\sets\\remote-demo.json",
      rawSource:
        '{"setName":"Remote Demo","questions":[{"q":"Test?","options":["A","B"],"correct":0,"explanation":"Aciklama","subject":"Genel"}]}',
      questions: [
        {
          q: "Test?",
          options: ["A", "B"],
          correct: 0,
          explanation: "Aciklama",
          subject: "Genel",
        },
      ],
      updatedAt: "2026-04-04T12:00:00.000Z",
    });

    expect(savedRecord.id).toBe("remote-demo");
    expect(lastSavedSetRow).toMatchObject({
      source_path: "C:\\sets\\remote-demo.json",
    });
    expect(savedRecord.sourcePath).toBe("C:\\sets\\remote-demo.json");

    const savedState = await platformAdapter.saveUserState({
      selectedSetIds: ["remote-demo"],
      selectedAnswers: { "set:remote-demo::idx:0": 0 },
      solutionVisible: {},
      session: {
        currentQuestionIndex: 0,
        currentQuestionKey: "set:remote-demo::idx:0",
        selectedTopic: "Genel",
      },
      autoAdvanceEnabled: true,
      updatedAt: "2026-04-04T12:00:00.000Z",
    });

    expect(savedState.selectedSetIds).toEqual(["remote-demo"]);
    await expect(platformAdapter.deleteSets(["remote-demo"])).resolves.toBeUndefined();
  });

  it("surfaces a schema migration error when mcq_sets is missing source_path", async () => {
    const createClient = vi.fn(() => ({
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: {
              user: {
                id: "user-1",
                email: "doctor@example.com",
              },
            },
          },
          error: null,
        })),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        })),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(async () => ({ error: null })),
      },
      from: vi.fn((tableName) => {
        if (tableName !== "mcq_sets") {
          throw new Error(`unexpected table ${tableName}`);
        }

        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: null,
                error: {
                  code: "PGRST204",
                  message:
                    "Could not find the 'source_path' column of 'mcq_sets' in the schema cache",
                },
              })),
            })),
          })),
        };
      }),
    }));

    const platformAdapter = createPlatformAdapter({
      storage: createMemoryStorage(),
      getRuntimeConfig() {
        return {
          supabaseUrl: "https://example.supabase.co",
          supabaseAnonKey: "anon-key",
        };
      },
      createClientRef: createClient,
    });

    await expect(
      platformAdapter.saveSet({
        id: "remote-demo",
        slug: "remote-demo",
        setName: "Remote Demo",
        fileName: "remote-demo.md",
        sourceFormat: "markdown",
        sourcePath: "C:\\sets\\remote-demo.md",
        rawSource: "# Remote Demo",
        questions: [],
        updatedAt: "2026-04-04T12:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      code: "MISSING_MCQ_SETS_SOURCE_PATH_COLUMN",
      message: expect.stringContaining("source_path"),
    });
  });

  it("falls back to the local demo adapter when Supabase config is absent", () => {
    const platformAdapter = createPlatformAdapter({
      storage: createMemoryStorage(),
      getRuntimeConfig() {
        return {
          supabaseUrl: "",
          supabaseAnonKey: "",
        };
      },
    });

    expect(platformAdapter.type).toBe("local-demo");
    expect(platformAdapter.supportsPasswordAuth).toBe(false);
    expect(platformAdapter.supportsDemoAuth).toBe(true);
    expect(platformAdapter.supportsRemoteSync).toBe(false);
  });

  it("exposes native desktop file bridges when Tauri is available", async () => {
    originalTauri = globalThis.__TAURI__;
    const invoke = vi.fn(async (command, args) => {
      if (command === "pick_native_set_files") {
        return [
          {
            path: "C:\\sets\\demo.md",
            name: "demo.md",
            contents: "# Demo",
          },
        ];
      }

      if (command === "write_set_source_file") {
        return {
          ok: true,
          ...args,
        };
      }

      throw new Error(`unexpected command ${command}`);
    });
    globalThis.__TAURI__ = {
      core: {
        invoke,
      },
    };

    const platformAdapter = createPlatformAdapter({
      storage: createMemoryStorage(),
    });

    await expect(platformAdapter.pickNativeSetFiles()).resolves.toEqual([
      {
        path: "C:\\sets\\demo.md",
        name: "demo.md",
        contents: "# Demo",
      },
    ]);
    await expect(
      platformAdapter.writeSetSourceFile("C:\\sets\\demo.md", "# Demo"),
    ).resolves.toMatchObject({
      sourcePath: "C:\\sets\\demo.md",
      rawSource: "# Demo",
    });
    expect(invoke).toHaveBeenNthCalledWith(1, "pick_native_set_files", {});
    expect(invoke).toHaveBeenNthCalledWith(2, "write_set_source_file", {
      sourcePath: "C:\\sets\\demo.md",
      rawSource: "# Demo",
    });
  });
});
