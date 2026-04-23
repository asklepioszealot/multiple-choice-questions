import {
  ANSWER_LOCK_KEY,
  THEME_CONTROL_IDS,
  THEME_KEY,
  TOPIC_SOURCE_KEY,
  AUTO_ADVANCE_KEY,
} from "../../shared/constants.js";
import { ThemeManager } from "../../ui/theme.js";
import {
  loadPersistedStudyState,
  persistStudyStateSnapshot,
} from "../study-state/study-state.js";

export function createStudyPersistence({
  storage,
  getScopedStorageItem,
  getLoadedSets,
  getStorageKeyPrefix,
  getStudyStateSnapshot,
  scheduleRemoteStudyStateSync,
  setStudyContext,
  getStudyTypographyState,
  applyTypographyState,
  syncThemeControlsUI,
  syncAnswerLockToggleUI,
  syncAutoAdvanceToggleUI,
  syncTopicSourceToggleUI,
  syncTypographyControls,
  syncManagerSettingsPanelState,
  consoleRef = console,
}) {
  function saveState() {
    try {
      const normalizedSnapshot = persistStudyStateSnapshot({
        storage,
        snapshot: getStudyStateSnapshot(),
        storageKeyPrefix: getStorageKeyPrefix(),
      });

      setStudyContext({
        pendingSession: normalizedSnapshot.session,
      });
      if (typeof scheduleRemoteStudyStateSync === "function") {
        scheduleRemoteStudyStateSync(normalizedSnapshot);
      }
      return normalizedSnapshot;
    } catch (error) {
      consoleRef.error("State saving error", error);
      return null;
    }
  }

  function loadState(storageKeyPrefix = null) {
    try {
      ThemeManager.initThemeFromStorage({
        controlIds: THEME_CONTROL_IDS,
        storageApi: storage,
        storageKey: THEME_KEY,
      });
      syncThemeControlsUI();

      const nextContext = {};
      const storedAnswerLock = storage?.getItem?.(ANSWER_LOCK_KEY);
      if (storedAnswerLock === "0" || storedAnswerLock === "1") {
        nextContext.answerLockEnabled = storedAnswerLock === "1";
      }
      const storedTopicSource = storage?.getItem?.(TOPIC_SOURCE_KEY);
      if (storedTopicSource === "0" || storedTopicSource === "1") {
        nextContext.topicSourceVisible = storedTopicSource === "1";
      }
      const storedAutoAdvance = getScopedStorageItem(
        AUTO_ADVANCE_KEY,
        storageKeyPrefix,
      );
      if (storedAutoAdvance === "0" || storedAutoAdvance === "1") {
        nextContext.autoAdvanceEnabled = storedAutoAdvance === "1";
      }

      const loadedState = loadPersistedStudyState({
        storage,
        loadedSets: getLoadedSets(),
        fallbackSession: null,
        fallbackTypography: getStudyTypographyState(),
        storageKeyPrefix:
          typeof storageKeyPrefix === "string"
            ? storageKeyPrefix
            : getStorageKeyPrefix(),
      });

      setStudyContext({
        ...nextContext,
        selectedAnswers: loadedState.selectedAnswers,
        solutionVisible: loadedState.solutionVisible,
        activityByDay: loadedState.activityByDay || {},
        pendingSession: loadedState.pendingSession,
        isAnalyticsVisible: loadedState.isAnalyticsVisible === true,
      });
      applyTypographyState(loadedState);
    } catch (error) {
      consoleRef.error("State loading error", error);
    }

    syncAnswerLockToggleUI();
    syncAutoAdvanceToggleUI();
    syncTopicSourceToggleUI();
    syncTypographyControls();
    syncManagerSettingsPanelState();
  }

  return Object.freeze({
    loadState,
    saveState,
  });
}
