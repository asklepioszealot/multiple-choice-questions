import { AUTO_ADVANCE_KEY } from "../../shared/constants.js";
import {
  buildStudyStateSnapshot,
  persistStudyStateSnapshot,
} from "../study-state/study-state.js";

export function createStudyStateBridge({
  storage,
  documentRef,
  setManager,
  getStudyContext,
  setStudyContext,
  getStorageKeyPrefix,
  buildScopedStorageKey,
  renderSetList,
  syncAutoAdvanceToggleUI,
  syncTypographyControls,
  applyTypographyState,
  defaults,
}) {
  function buildCurrentStudyStateSnapshot(options = {}) {
    const {
      activityByDay,
      autoAdvanceEnabled,
      currentQuestionIndex,
      filteredQuestions,
      fullscreenOptionFontSize,
      fullscreenQuestionFontSize,
      isAnalyticsVisible,
      optionFontSize,
      pendingSession,
      questionFontSize,
      questionOrder,
      selectedAnswers,
      solutionVisible,
    } = getStudyContext();

    return buildStudyStateSnapshot({
      activeQuestion:
        filteredQuestions.length > 0
          ? filteredQuestions[questionOrder[currentQuestionIndex]]
          : null,
      currentQuestionIndex,
      selectedTopic:
        options.selectedTopic ??
        documentRef?.getElementById("topic-select")?.value ??
        pendingSession?.selectedTopic ??
        "hepsi",
      selectedSetIds: setManager.getSelectedSetIds(),
      selectedAnswers,
      solutionVisible,
      activityByDay,
      questionFontSize,
      optionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
      autoAdvanceEnabled,
      isAnalyticsVisible,
      updatedAt: options.updatedAt,
    });
  }

  function hasCustomTypographyState(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    const questionSize = Number(snapshot.questionFontSize);
    const optionSize = Number(snapshot.optionFontSize);
    const fullscreenQuestionSize = Number(snapshot.fullscreenQuestionFontSize);
    const fullscreenOptionSize = Number(snapshot.fullscreenOptionFontSize);

    return Boolean(
      (Number.isFinite(questionSize) &&
        questionSize !== defaults.DEFAULT_QUESTION_FONT_SIZE) ||
        (Number.isFinite(optionSize) &&
          optionSize !== defaults.DEFAULT_OPTION_FONT_SIZE) ||
        (Number.isFinite(fullscreenQuestionSize) &&
          fullscreenQuestionSize !==
            defaults.DEFAULT_FULLSCREEN_QUESTION_FONT_SIZE) ||
        (Number.isFinite(fullscreenOptionSize) &&
          fullscreenOptionSize !== defaults.DEFAULT_FULLSCREEN_OPTION_FONT_SIZE),
    );
  }

  function hasMeaningfulStudyStateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    const session = snapshot.session;
    const hasMeaningfulSession = Boolean(
      session &&
        ((typeof session.currentQuestionKey === "string" &&
          session.currentQuestionKey.trim()) ||
          (Number.isInteger(session.currentQuestionIndex) &&
            session.currentQuestionIndex > 0)),
    );

    return Boolean(
      (Array.isArray(snapshot.selectedSetIds) && snapshot.selectedSetIds.length > 0) ||
        Object.keys(snapshot.selectedAnswers || {}).length > 0 ||
        Object.keys(snapshot.solutionVisible || {}).length > 0 ||
        Object.keys(snapshot.activityByDay || {}).length > 0 ||
        snapshot.isAnalyticsVisible === true ||
        hasMeaningfulSession ||
        hasCustomTypographyState(snapshot),
    );
  }

  function applyStudyStateSnapshot(snapshot, options = {}) {
    const normalizedSnapshot = persistStudyStateSnapshot({
      storage,
      snapshot,
      storageKeyPrefix: options.storageKeyPrefix ?? getStorageKeyPrefix(),
    });
    const typographyState =
      typeof applyTypographyState === "function"
        ? applyTypographyState(normalizedSnapshot)
        : normalizedSnapshot;

    setStudyContext({
      selectedAnswers: normalizedSnapshot.selectedAnswers,
      solutionVisible: normalizedSnapshot.solutionVisible,
      activityByDay: normalizedSnapshot.activityByDay || {},
      pendingSession: normalizedSnapshot.session,
      autoAdvanceEnabled: normalizedSnapshot.autoAdvanceEnabled !== false,
      isAnalyticsVisible: normalizedSnapshot.isAnalyticsVisible === true,
      questionFontSize: typographyState.questionFontSize,
      optionFontSize: typographyState.optionFontSize,
      fullscreenQuestionFontSize: typographyState.fullscreenQuestionFontSize,
      fullscreenOptionFontSize: typographyState.fullscreenOptionFontSize,
    });

    if (Array.isArray(normalizedSnapshot.selectedSetIds)) {
      setManager.setSelectedSetIds(normalizedSnapshot.selectedSetIds, {
        storageKeyPrefix: options.storageKeyPrefix ?? getStorageKeyPrefix(),
        notify: false,
      });
    }

    syncAutoAdvanceToggleUI();
    syncTypographyControls();
    renderSetList();
    return normalizedSnapshot;
  }

  function resetStudyState(storageKeyPrefix = null) {
    setStudyContext({
      selectedAnswers: {},
      solutionVisible: {},
      activityByDay: {},
      pendingSession: null,
      autoAdvanceEnabled: false,
      isAnalyticsVisible: false,
    });
    storage?.removeItem?.(buildScopedStorageKey("mc_session", storageKeyPrefix));
    storage?.removeItem?.(
      buildScopedStorageKey("mc_assessments", storageKeyPrefix),
    );
    storage?.removeItem?.(
      buildScopedStorageKey(AUTO_ADVANCE_KEY, storageKeyPrefix),
    );
    storage?.removeItem?.(
      buildScopedStorageKey("mc_analytics_visible", storageKeyPrefix),
    );
    syncAutoAdvanceToggleUI();
    renderSetList();
  }

  return Object.freeze({
    applyStudyStateSnapshot,
    buildCurrentStudyStateSnapshot,
    hasCustomTypographyState,
    hasMeaningfulStudyStateSnapshot,
    resetStudyState,
  });
}
