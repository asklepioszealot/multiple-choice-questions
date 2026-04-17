// src/core/platform-adapter.js
const globalScope = typeof window !== "undefined" ? window : globalThis;

export const AUTH_REMEMBER_ME_KEY = "mc_auth_remember_me";

  function createAuthSessionStorage(storage) {
    const localApi = {
      getItem:
        typeof storage?.getLocalItem === "function"
          ? storage.getLocalItem.bind(storage)
          : storage?.getItem?.bind(storage) || (() => null),
      setItem:
        typeof storage?.setLocalItem === "function"
          ? storage.setLocalItem.bind(storage)
          : storage?.setItem?.bind(storage) || (() => {}),
      removeItem:
        typeof storage?.removeLocalItem === "function"
          ? storage.removeLocalItem.bind(storage)
          : storage?.removeItem?.bind(storage) || (() => {}),
    };
    const sessionApi = {
      getItem:
        typeof storage?.getSessionItem === "function"
          ? storage.getSessionItem.bind(storage)
          : localApi.getItem,
      setItem:
        typeof storage?.setSessionItem === "function"
          ? storage.setSessionItem.bind(storage)
          : localApi.setItem,
      removeItem:
        typeof storage?.removeSessionItem === "function"
          ? storage.removeSessionItem.bind(storage)
          : localApi.removeItem,
    };

    function readRememberMePreference() {
      const storedValue = localApi.getItem(AUTH_REMEMBER_ME_KEY);
      if (storedValue === "0") return false;
      if (storedValue === "1") return true;
      return true;
    }

    let rememberMePreference = readRememberMePreference();

    return Object.freeze({
      getRememberMePreference() {
        return rememberMePreference;
      },

      setRememberMePreference(nextValue) {
        rememberMePreference = nextValue !== false;
        localApi.setItem(AUTH_REMEMBER_ME_KEY, rememberMePreference ? "1" : "0");
        return rememberMePreference;
      },

      getItem(key) {
        const sessionValue = sessionApi.getItem(key);
        return sessionValue != null ? sessionValue : localApi.getItem(key);
      },

      setItem(key, value, rememberMeOverride = rememberMePreference) {
        if (rememberMeOverride) {
          localApi.setItem(key, value);
          sessionApi.removeItem(key);
          return;
        }

        sessionApi.setItem(key, value);
        localApi.removeItem(key);
      },

      removeItem(key) {
        sessionApi.removeItem(key);
        localApi.removeItem(key);
      },
    });
  }

  function normalizeUserEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function normalizeSetSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "set";
  }

  function normalizeSetRecord(record) {
    const normalized = record && typeof record === "object" ? record : {};
    const fileName =
      typeof normalized.fileName === "string" && normalized.fileName.trim()
        ? normalized.fileName.trim()
        : `${normalized.id || normalized.slug || "set"}.json`;
    const setName =
      typeof normalized.setName === "string" && normalized.setName.trim()
        ? normalized.setName.trim()
        : fileName;
    const setId =
      typeof normalized.id === "string" && normalized.id.trim()
        ? normalized.id.trim()
        : String(fileName || "set").replace(/\.[^/.]+$/, "");
    const hasExplicitSourcePath = Object.prototype.hasOwnProperty.call(
      normalized,
      "sourcePath",
    );

    return {
      id: setId,
      slug:
        typeof normalized.slug === "string" && normalized.slug.trim()
          ? normalized.slug.trim()
          : normalizeSetSlug(setName),
      setName,
      fileName,
      sourceFormat:
        typeof normalized.sourceFormat === "string" && normalized.sourceFormat.trim()
          ? normalized.sourceFormat.trim()
          : /\.(md|txt)$/i.test(fileName)
            ? "markdown"
            : "json",
      sourcePath: hasExplicitSourcePath
        ? String(normalized.sourcePath || "").trim()
        : "",
      rawSource: typeof normalized.rawSource === "string" ? normalized.rawSource : "",
      questions: Array.isArray(normalized.questions) ? normalized.questions : [],
      updatedAt:
        typeof normalized.updatedAt === "string" && normalized.updatedAt.trim()
          ? normalized.updatedAt.trim()
          : new Date().toISOString(),
    };
  }

  function createNativeFileBridge() {
    const invoke = globalScope.__TAURI__?.core?.invoke;
    if (typeof invoke !== "function") {
      return Object.freeze({
        async pickNativeSetFiles() {
          return [];
        },
        async writeSetSourceFile() {
          throw new Error("Bu özellik sadece masaüstünde kullanılabilir.");
        },
      });
    }

    return Object.freeze({
      async pickNativeSetFiles() {
        const files = await invoke("pick_native_set_files", {});
        return Array.isArray(files) ? files : [];
      },
      async writeSetSourceFile(sourcePath, rawSource) {
        return invoke("write_set_source_file", {
          sourcePath,
          rawSource,
        });
      },
    });
  }

  function normalizeStudyStateSnapshot(snapshot) {
    const normalized = snapshot && typeof snapshot === "object" ? snapshot : {};
    const DEFAULT_TYPOGRAPHY_FONT_SIZES = {
      questionFontSize: 25,
      optionFontSize: 17,
      fullscreenQuestionFontSize: 22,
      fullscreenOptionFontSize: 15,
    };
    const FONT_SIZE_MIN = 12;
    const FONT_SIZE_MAX = 40;

    function clampFontSize(value, fallback) {
      const numericValue = Number(value);
      const resolvedValue = Number.isFinite(numericValue)
        ? Math.round(numericValue)
        : fallback;

      return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, resolvedValue));
    }

    return {
      selectedSetIds: Array.isArray(normalized.selectedSetIds)
        ? normalized.selectedSetIds.filter(
            (setId) => typeof setId === "string" && setId.trim(),
          )
        : [],
      selectedAnswers:
        normalized.selectedAnswers &&
        typeof normalized.selectedAnswers === "object" &&
        !Array.isArray(normalized.selectedAnswers)
          ? normalized.selectedAnswers
          : {},
      solutionVisible:
        normalized.solutionVisible &&
        typeof normalized.solutionVisible === "object" &&
        !Array.isArray(normalized.solutionVisible)
          ? normalized.solutionVisible
          : {},
      session:
        normalized.session &&
        typeof normalized.session === "object" &&
        !Array.isArray(normalized.session)
          ? {
              currentQuestionIndex: Number.isInteger(
                normalized.session.currentQuestionIndex,
              )
                ? normalized.session.currentQuestionIndex
                : 0,
              currentQuestionKey:
                typeof normalized.session.currentQuestionKey === "string" &&
                normalized.session.currentQuestionKey.trim()
                  ? normalized.session.currentQuestionKey
                  : null,
              selectedTopic:
                typeof normalized.session.selectedTopic === "string" &&
                normalized.session.selectedTopic.trim()
                  ? normalized.session.selectedTopic
                  : "hepsi",
            }
          : null,
      questionFontSize: clampFontSize(
        normalized.questionFontSize,
        DEFAULT_TYPOGRAPHY_FONT_SIZES.questionFontSize,
      ),
      optionFontSize: clampFontSize(
        normalized.optionFontSize,
        DEFAULT_TYPOGRAPHY_FONT_SIZES.optionFontSize,
      ),
      fullscreenQuestionFontSize: clampFontSize(
        normalized.fullscreenQuestionFontSize,
        DEFAULT_TYPOGRAPHY_FONT_SIZES.fullscreenQuestionFontSize,
      ),
      fullscreenOptionFontSize: clampFontSize(
        normalized.fullscreenOptionFontSize,
        DEFAULT_TYPOGRAPHY_FONT_SIZES.fullscreenOptionFontSize,
      ),
      autoAdvanceEnabled: normalized.autoAdvanceEnabled !== false,
      updatedAt:
        typeof normalized.updatedAt === "string" && normalized.updatedAt.trim()
          ? normalized.updatedAt.trim()
          : new Date().toISOString(),
    };
  }

  function isMissingRelationError(error, relationName = "") {
    const message = String(error?.message || "").toLowerCase();
    const normalizedRelation = String(relationName || "").trim().toLowerCase();
    const mentionsRelation =
      !normalizedRelation || message.includes(`'${normalizedRelation}'`) || message.includes(normalizedRelation);
    return (
      error?.code === "42P01" ||
      error?.code === "PGRST205" ||
      error?.status === 404 ||
      (mentionsRelation &&
        message.includes("does not exist") &&
        (message.includes("relation") || message.includes("table"))) ||
      (mentionsRelation && message.includes("could not find the table"))
    );
  }

  function isMissingColumnInSchemaCacheError(error, relationName, columnName) {
    const message = String(error?.message || "").toLowerCase();
    return (
      error?.code === "PGRST204" &&
      message.includes("schema cache") &&
      message.includes(String(relationName || "").trim().toLowerCase()) &&
      message.includes(String(columnName || "").trim().toLowerCase())
    );
  }

  function isNoRowsError(error) {
    return error?.code === "PGRST116";
  }

  function createMissingMcqSetsTableError() {
    const error = new Error(
      "mcq_sets tablosu bulunamadı. docs/SUPABASE_MCQ_SETS_SETUP.sql dosyasını çalıştırmalısın.",
    );
    error.code = "MISSING_MCQ_SETS_TABLE";
    return error;
  }

  function createMissingMcqSetsSourcePathColumnError() {
    const error = new Error(
      "mcq_sets.source_path kolonu bulunamadı. Mevcut Supabase kurulumunu docs/SUPABASE_MCQ_SETS_SETUP.sql dosyasını yeniden çalıştırarak güncellemelisin.",
    );
    error.code = "MISSING_MCQ_SETS_SOURCE_PATH_COLUMN";
    return error;
  }

  function createMissingMcqUserStateTableError() {
    const error = new Error(
      "mcq_user_state tablosu bulunamadı. docs/SUPABASE_SYNC_SETUP.sql dosyasını çalıştırmalısın.",
    );
    error.code = "MISSING_MCQ_USER_STATE_TABLE";
    return error;
  }

  function createLocalDemoAdapter(
    storage,
    nativeFileBridge = createNativeFileBridge(),
  ) {
    const authSessionStorage = createAuthSessionStorage(storage);

    return Object.freeze({
      type: "local-demo",
      supportsPasswordAuth: false,
      supportsDemoAuth: true,
      supportsRemoteSync: false,
      supportsStudyStateSync: false,
      getRememberMePreference() {
        return authSessionStorage.getRememberMePreference();
      },
      setRememberMePreference(nextValue) {
        return authSessionStorage.setRememberMePreference(nextValue);
      },
      async getCurrentUser() {
        return null;
      },
      subscribeAuthState(listener) {
        if (typeof listener === "function") {
          listener(null, "initial");
        }
        return function unsubscribe() {};
      },
      async signIn() {
        throw new Error("Şifre ile giriş bu yapılandırmada kullanılamaz.");
      },
      async signUp() {
        throw new Error("Kayıt oluşturma bu yapılandırmada kullanılamaz.");
      },
      async signOut() {
        return null;
      },
      async loadSets() {
        return [];
      },
      async saveSet(record) {
        return normalizeSetRecord(record);
      },
      async deleteSets() {
        return null;
      },
      async loadUserState() {
        return null;
      },
      async saveUserState(snapshot) {
        return normalizeStudyStateSnapshot(snapshot);
      },
      async pickNativeSetFiles() {
        return nativeFileBridge.pickNativeSetFiles();
      },
      async writeSetSourceFile(sourcePath, rawSource) {
        return nativeFileBridge.writeSetSourceFile(sourcePath, rawSource);
      },
    });
  }

  function createSupabaseAdapter(
    config,
    storage,
    createClientRef,
    nativeFileBridge = createNativeFileBridge(),
  ) {
    if (typeof createClientRef !== "function") {
      throw new Error("Supabase istemcisi hazır değil.");
    }

    const authSessionStorage = createAuthSessionStorage(storage);
    const client = createClientRef(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: {
          getItem(key) {
            return authSessionStorage.getItem(key);
          },
          setItem(key, value) {
            authSessionStorage.setItem(key, value);
          },
          removeItem(key) {
            authSessionStorage.removeItem(key);
          },
        },
      },
    });

    let currentUser = null;

    function mapRowToRecord(row) {
      return normalizeSetRecord({
        id: row.id,
        slug: row.slug,
        setName: row.set_name,
        fileName: row.file_name,
        sourceFormat: row.source_format,
        sourcePath: row.source_path || "",
        rawSource: row.raw_source || "",
        questions: Array.isArray(row.questions_json) ? row.questions_json : [],
        updatedAt: row.updated_at,
      });
    }

    function mapRecordToRow(record, userId) {
      const normalizedRecord = normalizeSetRecord(record);
      return {
        id: normalizedRecord.id,
        user_id: userId,
        slug: normalizedRecord.slug,
        set_name: normalizedRecord.setName,
        file_name: normalizedRecord.fileName,
        source_format: normalizedRecord.sourceFormat,
        source_path: normalizedRecord.sourcePath,
        raw_source: normalizedRecord.rawSource,
        questions_json: normalizedRecord.questions,
        updated_at: normalizedRecord.updatedAt,
      };
    }

    function mapSnapshotToRow(userId, snapshot) {
      const normalizedSnapshot = normalizeStudyStateSnapshot(snapshot);
      return {
        user_id: userId,
        state_json: {
          selectedSetIds: normalizedSnapshot.selectedSetIds,
          selectedAnswers: normalizedSnapshot.selectedAnswers,
          solutionVisible: normalizedSnapshot.solutionVisible,
          session: normalizedSnapshot.session,
          questionFontSize: normalizedSnapshot.questionFontSize,
          optionFontSize: normalizedSnapshot.optionFontSize,
          fullscreenQuestionFontSize: normalizedSnapshot.fullscreenQuestionFontSize,
          fullscreenOptionFontSize: normalizedSnapshot.fullscreenOptionFontSize,
          autoAdvanceEnabled: normalizedSnapshot.autoAdvanceEnabled,
          updatedAt: normalizedSnapshot.updatedAt,
        },
        updated_at: normalizedSnapshot.updatedAt,
      };
    }

    function mapRowToSnapshot(row) {
      return normalizeStudyStateSnapshot({
        ...(row?.state_json || {}),
        updatedAt: row?.updated_at || row?.state_json?.updatedAt || "",
      });
    }

    async function refreshCurrentUser() {
      const {
        data: { session },
        error,
      } = await client.auth.getSession();

      if (error) {
        throw error;
      }

      currentUser = session?.user || null;
      return currentUser;
    }

    async function getUserOrThrow() {
      const user = currentUser || (await refreshCurrentUser());
      if (!user) {
        throw new Error("Devam etmeden önce giriş yapmalısın.");
      }
      return user;
    }

    return Object.freeze({
      type: "supabase-web",
      supportsPasswordAuth: true,
      supportsDemoAuth: false,
      supportsRemoteSync: true,
      supportsStudyStateSync: true,
      getRememberMePreference() {
        return authSessionStorage.getRememberMePreference();
      },
      setRememberMePreference(nextValue) {
        return authSessionStorage.setRememberMePreference(nextValue);
      },
      async getCurrentUser() {
        return refreshCurrentUser();
      },
      subscribeAuthState(listener) {
        const authListener =
          typeof client.auth.onAuthStateChange === "function"
            ? client.auth.onAuthStateChange((event, session) => {
                currentUser = session?.user || null;
                if (typeof listener === "function") {
                  listener(currentUser, event);
                }
              })
            : null;

        void Promise.resolve()
          .then(() => this.getCurrentUser())
          .then((user) => {
            if (typeof listener === "function") {
              listener(user, "initial");
            }
          });

        return function unsubscribe() {
          authListener?.data?.subscription?.unsubscribe?.();
        };
      },
      async signIn(email, password, options = {}) {
        authSessionStorage.setRememberMePreference(options.rememberMe);
        const { data, error } = await client.auth.signInWithPassword({
          email: normalizeUserEmail(email),
          password,
        });

        if (error) {
          throw error;
        }

        currentUser = data?.user || null;
        return currentUser;
      },
      async signUp(email, password, options = {}) {
        authSessionStorage.setRememberMePreference(options.rememberMe);
        const { data, error } = await client.auth.signUp({
          email: normalizeUserEmail(email),
          password,
        });

        if (error) {
          throw error;
        }

        currentUser = data?.user || null;
        return {
          user: currentUser,
          needsConfirmation: !data?.session,
        };
      },
      async signOut() {
        const { error } = await client.auth.signOut();
        if (error) {
          throw error;
        }
        currentUser = null;
        return null;
      },
      async loadSets() {
        const user = await getUserOrThrow();
        const { data, error } = await client
          .from("mcq_sets")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (error) {
          if (isMissingRelationError(error, "mcq_sets")) {
            throw createMissingMcqSetsTableError();
          }
          throw error;
        }

        return Array.isArray(data) ? data.map(mapRowToRecord) : [];
      },
      async saveSet(record) {
        const user = await getUserOrThrow();
        const normalizedRecord = normalizeSetRecord(record);
        const row = mapRecordToRow(normalizedRecord, user.id);
        const { data, error } = await client
          .from("mcq_sets")
          .upsert(row, { onConflict: "id" })
          .select("*")
          .single();

        if (error) {
          if (isMissingColumnInSchemaCacheError(error, "mcq_sets", "source_path")) {
            throw createMissingMcqSetsSourcePathColumnError();
          }
          if (isMissingRelationError(error, "mcq_sets")) {
            throw createMissingMcqSetsTableError();
          }
          throw error;
        }

        return normalizeSetRecord({
          ...mapRowToRecord(data),
          sourcePath: normalizedRecord.sourcePath,
        });
      },
      async deleteSets(setIds) {
        const user = await getUserOrThrow();
        if (!Array.isArray(setIds) || setIds.length === 0) {
          return;
        }

        const { error } = await client
          .from("mcq_sets")
          .delete()
          .eq("user_id", user.id)
          .in("id", setIds);

        if (error) {
          if (isMissingRelationError(error, "mcq_sets")) {
            throw createMissingMcqSetsTableError();
          }
          throw error;
        }
      },
      async loadUserState() {
        const user = await getUserOrThrow();
        const { data, error } = await client
          .from("mcq_user_state")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          if (isMissingRelationError(error, "mcq_user_state")) {
            throw createMissingMcqUserStateTableError();
          }
          if (isNoRowsError(error)) {
            return null;
          }
          throw error;
        }

        return data ? mapRowToSnapshot(data) : null;
      },
      async saveUserState(snapshot) {
        const user = await getUserOrThrow();
        const row = mapSnapshotToRow(user.id, snapshot);
        const { data, error } = await client
          .from("mcq_user_state")
          .upsert(row, { onConflict: "user_id" })
          .select("*")
          .single();

        if (error) {
          if (isMissingRelationError(error, "mcq_user_state")) {
            throw createMissingMcqUserStateTableError();
          }
          throw error;
        }

        return mapRowToSnapshot(data);
      },
      async pickNativeSetFiles() {
        return nativeFileBridge.pickNativeSetFiles();
      },
      async writeSetSourceFile(sourcePath, rawSource) {
        return nativeFileBridge.writeSetSourceFile(sourcePath, rawSource);
      },
    });
  }

  function createPlatformAdapter({
    storage,
    getRuntimeConfig,
    createClientRef,
  } = {}) {
    const runtimeConfig =
      typeof getRuntimeConfig === "function" ? getRuntimeConfig() : {};
    const supabaseUrl =
      typeof runtimeConfig?.supabaseUrl === "string"
        ? runtimeConfig.supabaseUrl.trim()
        : "";
    const supabaseAnonKey =
      typeof runtimeConfig?.supabaseAnonKey === "string"
        ? runtimeConfig.supabaseAnonKey.trim()
        : "";
    const nativeFileBridge = createNativeFileBridge();

    if (supabaseUrl && supabaseAnonKey) {
      const resolvedCreateClient =
        typeof createClientRef === "function"
          ? createClientRef
          : globalScope.__APP_SUPABASE__?.createClient;

      if (typeof resolvedCreateClient === "function") {
        return createSupabaseAdapter(
          { supabaseUrl, supabaseAnonKey },
          storage,
          resolvedCreateClient,
          nativeFileBridge,
        );
      }
    }

    return createLocalDemoAdapter(storage, nativeFileBridge);
  }

  const AppPlatformAdapter = Object.freeze({
    AUTH_REMEMBER_ME_KEY,
    createAuthSessionStorage,
    createLocalDemoAdapter,
    createPlatformAdapter,
    createSupabaseAdapter,
  });

  export {
    createAuthSessionStorage,
    createLocalDemoAdapter,
    createPlatformAdapter,
    createSupabaseAdapter,
  };
