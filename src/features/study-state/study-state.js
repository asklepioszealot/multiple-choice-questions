(function attachStudyState(globalScope) {
  "use strict";

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
    const questionSubject = question && typeof question.subject === "string" ? question.subject : "";
    const text = questionText + questionSubject;

    for (let index = 0; index < text.length; index += 1) {
      const char = text.charCodeAt(index);
      hash = (hash << 5) - hash + char;
      hash &= hash;
    }

    return `mc_${hash}`;
  }

  function resolveQuestionKey(question, fallbackSetId, fallbackIndex) {
    if (question && typeof question.__questionKey === "string" && question.__questionKey.length > 0) {
      return question.__questionKey;
    }

    if (typeof fallbackSetId === "string" && Number.isInteger(fallbackIndex)) {
      return buildQuestionKey(fallbackSetId, question, fallbackIndex);
    }

    if (question && typeof question.__setId === "string" && Number.isInteger(question.__setIndex)) {
      return buildQuestionKey(question.__setId, question, question.__setIndex);
    }

    return legacyQuestionId(question);
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
      changed: selectedAnswersMigration.changed || solutionVisibleMigration.changed,
    };
  }

  function readSavedSession(storage, fallbackSession = null) {
    try {
      const savedSession = storage?.getItem?.("mc_session");
      if (!savedSession) return null;
      const parsedSession = JSON.parse(savedSession);
      return parsedSession && typeof parsedSession === "object"
        ? parsedSession
        : null;
    } catch {
      return fallbackSession;
    }
  }

  function loadPersistedStudyState({
    storage,
    loadedSets,
    fallbackSession = null,
  }) {
    let selectedAnswers = {};
    let solutionVisible = {};

    try {
      const savedAssessments = storage?.getItem?.("mc_assessments");
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

    const pendingSession = readSavedSession(storage, fallbackSession);
    const migrated = migrateLegacyAssessmentState({
      loadedSets,
      selectedAnswers,
      solutionVisible,
    });

    if (migrated.changed) {
      storage?.setItem?.(
        "mc_assessments",
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
  }) {
    const sessionState = {
      currentQuestionIndex,
      currentQuestionKey: activeQuestion ? resolveQuestionKey(activeQuestion) : null,
      selectedTopic: selectedTopic || "hepsi",
    };

    storage?.setItem?.("mc_session", JSON.stringify(sessionState));
    storage?.setItem?.(
      "mc_assessments",
      JSON.stringify({
        selectedAnswers,
        solutionVisible,
      }),
    );

    return sessionState;
  }

  const AppStudyState = Object.freeze({
    buildQuestionKey,
    legacyQuestionId,
    resolveQuestionKey,
    migrateLegacyAssessmentState,
    readSavedSession,
    loadPersistedStudyState,
    persistStudyState,
  });

  globalScope.AppStudyState = AppStudyState;

  if (typeof exports !== "undefined") {
    exports.buildQuestionKey = buildQuestionKey;
    exports.legacyQuestionId = legacyQuestionId;
    exports.resolveQuestionKey = resolveQuestionKey;
    exports.migrateLegacyAssessmentState = migrateLegacyAssessmentState;
    exports.readSavedSession = readSavedSession;
    exports.loadPersistedStudyState = loadPersistedStudyState;
    exports.persistStudyState = persistStudyState;
    exports.AppStudyState = AppStudyState;
    exports.default = AppStudyState;
  }
})(typeof window !== "undefined" ? window : globalThis);
