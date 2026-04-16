(function attachStudyState(globalScope) {
  "use strict";

  function createStorageKey(prefix, key) {
    return prefix ? `${prefix}::${key}` : key;
  }

  const STUDY_TYPOGRAPHY_STORAGE_KEY = "mc_study_typography";
  const DEFAULT_TYPOGRAPHY_FONT_SIZES = Object.freeze({
    questionFontSize: 25,
    optionFontSize: 17,
    fullscreenQuestionFontSize: 22,
    fullscreenOptionFontSize: 15,
  });
  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 40;

  function clampFontSize(value, fallback) {
    const numericValue = Number(value);
    const resolvedValue = Number.isFinite(numericValue)
      ? Math.round(numericValue)
      : fallback;

    return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, resolvedValue));
  }

  function normalizeStudyTypographyPreferences(value) {
    const normalized = normalizePlainObject(value);

    return {
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
    };
  }

  function buildQuestionKey(setId, question, index) {
    const normalizedSetId = String(setId ?? "unknown");
    const questionIdValue =
      question && question.id !== undefined && question.id !== null
        ? String(question.id).trim()
        : "";

    if (questionIdValue.length > 0) {
      return `set:${normalizedSetId}::id:${questionIdValue}`;
    }

    return `set:${normalizedSetId}::idx:${index}`;
  }

  function legacyQuestionId(question) {
    let hash = 0;
    const questionText = question && typeof question.q === "string" ? question.q : "";
    const questionSubject =
      question && typeof question.subject === "string" ? question.subject : "";
    const text = questionText + questionSubject;

    for (let index = 0; index < text.length; index += 1) {
      const char = text.charCodeAt(index);
      hash = (hash << 5) - hash + char;
      hash &= hash;
    }

    return `mc_${hash}`;
  }

  function resolveQuestionKey(question, fallbackSetId, fallbackIndex) {
    if (
      question &&
      typeof question.__questionKey === "string" &&
      question.__questionKey.length > 0
    ) {
      return question.__questionKey;
    }

    if (typeof fallbackSetId === "string" && Number.isInteger(fallbackIndex)) {
      return buildQuestionKey(fallbackSetId, question, fallbackIndex);
    }

    if (
      question &&
      typeof question.__setId === "string" &&
      Number.isInteger(question.__setIndex)
    ) {
      return buildQuestionKey(question.__setId, question, question.__setIndex);
    }

    return legacyQuestionId(question);
  }

  function normalizePlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function normalizeSelectedSetIds(value) {
    return Array.isArray(value)
      ? value.filter((setId) => typeof setId === "string" && setId.trim())
      : [];
  }

  function normalizeSessionState(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return {
      currentQuestionIndex: Number.isInteger(value.currentQuestionIndex)
        ? value.currentQuestionIndex
        : 0,
      currentQuestionKey:
        typeof value.currentQuestionKey === "string" && value.currentQuestionKey.trim()
          ? value.currentQuestionKey
          : null,
      selectedTopic:
        typeof value.selectedTopic === "string" && value.selectedTopic.trim()
          ? value.selectedTopic
          : "hepsi",
    };
  }

  function normalizeStudyStateSnapshot(snapshot) {
    const normalized = snapshot && typeof snapshot === "object" ? snapshot : {};

    return {
      selectedSetIds: normalizeSelectedSetIds(normalized.selectedSetIds),
      selectedAnswers: normalizePlainObject(normalized.selectedAnswers),
      solutionVisible: normalizePlainObject(normalized.solutionVisible),
      session: normalizeSessionState(normalized.session),
      ...normalizeStudyTypographyPreferences(normalized),
      autoAdvanceEnabled: normalized.autoAdvanceEnabled !== false,
      updatedAt:
        typeof normalized.updatedAt === "string" && normalized.updatedAt.trim()
          ? normalized.updatedAt
          : "",
    };
  }

  function migrateLegacyAssessmentState({
    loadedSets,
    selectedAnswers,
    solutionVisible,
  }) {
    const legacyToModernMap = new Map();

    Object.entries(loadedSets || {}).forEach(([setId, setObj]) => {
      if (!setObj || !Array.isArray(setObj.questions)) return;

      setObj.questions.forEach((question, index) => {
        const legacyKey = legacyQuestionId(question);
        const modernKey = buildQuestionKey(setId, question, index);

        if (!legacyToModernMap.has(legacyKey)) {
          legacyToModernMap.set(legacyKey, new Set());
        }

        legacyToModernMap.get(legacyKey).add(modernKey);
      });
    });

    function migrateMap(sourceMap) {
      const normalizedMap =
        sourceMap && typeof sourceMap === "object" && !Array.isArray(sourceMap)
          ? sourceMap
          : {};
      const migratedMap = { ...normalizedMap };
      let changed = false;

      Object.entries(normalizedMap).forEach(([key, value]) => {
        if (typeof key !== "string" || key.startsWith("set:")) return;
        const matches = legacyToModernMap.get(key);
        if (!matches || matches.size === 0) return;

        changed = true;
        matches.forEach((modernKey) => {
          if (!(modernKey in migratedMap)) {
            migratedMap[modernKey] = value;
          }
        });
      });

      return { migratedMap, changed };
    }

    const selectedAnswersMigration = migrateMap(selectedAnswers);
    const solutionVisibleMigration = migrateMap(solutionVisible);

    return {
      selectedAnswers: selectedAnswersMigration.migratedMap,
      solutionVisible: solutionVisibleMigration.migratedMap,
      changed:
        selectedAnswersMigration.changed || solutionVisibleMigration.changed,
    };
  }

  function readSavedSession(storage, fallbackSession = null, storageKeyPrefix = "") {
    try {
      const savedSession = storage?.getItem?.(
        createStorageKey(storageKeyPrefix, "mc_session"),
      );
      if (!savedSession) return null;
      const parsedSession = JSON.parse(savedSession);
      return parsedSession && typeof parsedSession === "object"
        ? parsedSession
        : null;
    } catch {
      return fallbackSession;
    }
  }

  function readSavedTypographyPreferences(
    storage,
    fallbackPreferences = null,
    storageKeyPrefix = "",
  ) {
    try {
      const savedTypography = storage?.getItem?.(
        createStorageKey(storageKeyPrefix, STUDY_TYPOGRAPHY_STORAGE_KEY),
      );
      if (!savedTypography) {
        return normalizeStudyTypographyPreferences(fallbackPreferences);
      }

      const parsedTypography = JSON.parse(savedTypography);
      return normalizeStudyTypographyPreferences(parsedTypography);
    } catch {
      return normalizeStudyTypographyPreferences(fallbackPreferences);
    }
  }

  function loadPersistedStudyState({
    storage,
    loadedSets,
    fallbackSession = null,
    fallbackTypography = null,
    storageKeyPrefix = "",
  }) {
    let selectedAnswers = {};
    let solutionVisible = {};

    try {
      const savedAssessments = storage?.getItem?.(
        createStorageKey(storageKeyPrefix, "mc_assessments"),
      );
      if (savedAssessments) {
        const state = JSON.parse(savedAssessments);
        selectedAnswers =
          state && typeof state.selectedAnswers === "object"
            ? state.selectedAnswers
            : {};
        solutionVisible =
          state && typeof state.solutionVisible === "object"
            ? state.solutionVisible
            : {};
      }
    } catch {
      selectedAnswers = {};
      solutionVisible = {};
    }

    const pendingSession = readSavedSession(
      storage,
      fallbackSession,
      storageKeyPrefix,
    );
    const typographyPreferences = readSavedTypographyPreferences(
      storage,
      fallbackTypography,
      storageKeyPrefix,
    );
    const migrated = migrateLegacyAssessmentState({
      loadedSets,
      selectedAnswers,
      solutionVisible,
    });

    if (migrated.changed) {
      storage?.setItem?.(
        createStorageKey(storageKeyPrefix, "mc_assessments"),
        JSON.stringify({
          selectedAnswers: migrated.selectedAnswers,
          solutionVisible: migrated.solutionVisible,
        }),
      );
    }

    return {
      selectedAnswers: migrated.selectedAnswers,
      solutionVisible: migrated.solutionVisible,
      pendingSession,
      ...typographyPreferences,
      changed: migrated.changed,
    };
  }

  function persistStudyState({
    storage,
    activeQuestion,
    currentQuestionIndex,
    selectedTopic,
    selectedAnswers,
    solutionVisible,
    storageKeyPrefix = "",
  }) {
    const sessionState = {
      currentQuestionIndex,
      currentQuestionKey: activeQuestion ? resolveQuestionKey(activeQuestion) : null,
      selectedTopic: selectedTopic || "hepsi",
    };

    storage?.setItem?.(
      createStorageKey(storageKeyPrefix, "mc_session"),
      JSON.stringify(sessionState),
    );
    storage?.setItem?.(
      createStorageKey(storageKeyPrefix, "mc_assessments"),
      JSON.stringify({
        selectedAnswers,
        solutionVisible,
      }),
    );

    return sessionState;
  }

  function persistStudyTypographyPreferences({
    storage,
    questionFontSize,
    optionFontSize,
    fullscreenQuestionFontSize,
    fullscreenOptionFontSize,
    storageKeyPrefix = "",
  }) {
    const normalizedPreferences = normalizeStudyTypographyPreferences({
      questionFontSize,
      optionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
    });

    storage?.setItem?.(
      createStorageKey(storageKeyPrefix, STUDY_TYPOGRAPHY_STORAGE_KEY),
      JSON.stringify(normalizedPreferences),
    );

    return normalizedPreferences;
  }

  function buildStudyStateSnapshot({
    activeQuestion,
    currentQuestionIndex,
    selectedTopic,
    selectedSetIds,
    selectedAnswers,
    solutionVisible,
    fullscreenQuestionFontSize,
    fullscreenOptionFontSize,
    autoAdvanceEnabled,
    updatedAt,
  }) {
    return normalizeStudyStateSnapshot({
      selectedSetIds,
      selectedAnswers,
      solutionVisible,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
      session: {
        currentQuestionIndex: Number.isInteger(currentQuestionIndex)
          ? currentQuestionIndex
          : 0,
        currentQuestionKey: activeQuestion ? resolveQuestionKey(activeQuestion) : null,
        selectedTopic: selectedTopic || "hepsi",
      },
      autoAdvanceEnabled,
      updatedAt: updatedAt || new Date().toISOString(),
    });
  }

  function pickNewerStudyStateSnapshot(localSnapshot, remoteSnapshot) {
    const normalizedLocal = localSnapshot
      ? normalizeStudyStateSnapshot(localSnapshot)
      : null;
    const normalizedRemote = remoteSnapshot
      ? normalizeStudyStateSnapshot(remoteSnapshot)
      : null;

    if (!normalizedLocal) return normalizedRemote;
    if (!normalizedRemote) return normalizedLocal;

    const localTime = Date.parse(normalizedLocal.updatedAt || "");
    const remoteTime = Date.parse(normalizedRemote.updatedAt || "");

    if (Number.isFinite(localTime) && Number.isFinite(remoteTime)) {
      return remoteTime > localTime ? normalizedRemote : normalizedLocal;
    }

    if (Number.isFinite(remoteTime)) {
      return normalizedRemote;
    }

    return normalizedLocal;
  }

  function persistStudyStateSnapshot({
    storage,
    snapshot,
    storageKeyPrefix = "",
  }) {
    const normalizedSnapshot = normalizeStudyStateSnapshot(snapshot);

    storage?.setItem?.(
      createStorageKey(storageKeyPrefix, "mc_session"),
      JSON.stringify(normalizedSnapshot.session),
    );
    storage?.setItem?.(
      createStorageKey(storageKeyPrefix, "mc_assessments"),
      JSON.stringify({
        selectedAnswers: normalizedSnapshot.selectedAnswers,
        solutionVisible: normalizedSnapshot.solutionVisible,
      }),
    );
    storage?.setItem?.(
      createStorageKey(storageKeyPrefix, "mc_selected_sets"),
      JSON.stringify(normalizedSnapshot.selectedSetIds),
    );
    storage?.setItem?.(
      createStorageKey(storageKeyPrefix, "mc_auto_advance"),
      normalizedSnapshot.autoAdvanceEnabled ? "1" : "0",
    );
    storage?.setItem?.(
      createStorageKey(storageKeyPrefix, STUDY_TYPOGRAPHY_STORAGE_KEY),
      JSON.stringify({
        questionFontSize: normalizedSnapshot.questionFontSize,
        optionFontSize: normalizedSnapshot.optionFontSize,
        fullscreenQuestionFontSize: normalizedSnapshot.fullscreenQuestionFontSize,
        fullscreenOptionFontSize: normalizedSnapshot.fullscreenOptionFontSize,
      }),
    );

    return normalizedSnapshot;
  }

  const AppStudyState = Object.freeze({
    buildQuestionKey,
    legacyQuestionId,
    resolveQuestionKey,
    normalizeStudyStateSnapshot,
    normalizeStudyTypographyPreferences,
    clampFontSize,
    migrateLegacyAssessmentState,
    readSavedSession,
    readSavedTypographyPreferences,
    loadPersistedStudyState,
    persistStudyState,
    persistStudyTypographyPreferences,
    buildStudyStateSnapshot,
    pickNewerStudyStateSnapshot,
    persistStudyStateSnapshot,
  });

  globalScope.AppStudyState = AppStudyState;

  if (typeof exports !== "undefined") {
    exports.buildQuestionKey = buildQuestionKey;
    exports.legacyQuestionId = legacyQuestionId;
    exports.resolveQuestionKey = resolveQuestionKey;
    exports.normalizeStudyStateSnapshot = normalizeStudyStateSnapshot;
    exports.normalizeStudyTypographyPreferences = normalizeStudyTypographyPreferences;
    exports.clampFontSize = clampFontSize;
    exports.migrateLegacyAssessmentState = migrateLegacyAssessmentState;
    exports.readSavedSession = readSavedSession;
    exports.readSavedTypographyPreferences = readSavedTypographyPreferences;
    exports.loadPersistedStudyState = loadPersistedStudyState;
    exports.persistStudyState = persistStudyState;
    exports.persistStudyTypographyPreferences = persistStudyTypographyPreferences;
    exports.buildStudyStateSnapshot = buildStudyStateSnapshot;
    exports.pickNewerStudyStateSnapshot = pickNewerStudyStateSnapshot;
    exports.persistStudyStateSnapshot = persistStudyStateSnapshot;
    exports.AppStudyState = AppStudyState;
    exports.default = AppStudyState;
  }
})(typeof window !== "undefined" ? window : globalThis);
