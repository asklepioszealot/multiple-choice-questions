// src/app/bootstrap.js
import { bindStaticEvents } from "./bootstrap-events.js";
import { showScreen } from "./screen.js";
import { createSyncStatusController } from "./sync-status.js";
import * as storage from "../core/storage.js";
import {
  buildSetRecord,
  formatEditableText,
  htmlToEditableText,
  normalizeQuestions,
  parseSetText,
  serializeSetRecord,
} from "../core/set-codec.js";
import { createPlatformAdapter } from "../core/platform-adapter.js";
import {
  getRuntimeConfig,
  hasDriveConfig,
  hasSupabaseConfig,
  isDesktopRuntime,
} from "../core/runtime-config.js";
import {
  buildAnalyticsSnapshot,
  createAnalyticsPanelController,
} from "../features/analytics/analytics.js";
import { createAuthHandlers } from "../features/auth/auth-handlers.js";
import { createAuthFeature } from "../features/auth/auth-shell.js";
import { createDesktopUpdateFeature } from "../features/desktop-update/desktop-update.js";
import { createEditorFeature } from "../features/editor/editor.js";
import { createGoogleDriveFeature } from "../features/google-drive/google-drive.js";
import { createSetManager } from "../features/set-manager/set-manager.js";
import { detectSyncConflict } from "../features/sync/conflict-resolution.js";
import { createSyncOrchestration } from "../features/sync/sync-orchestration.js";
import { createActivityTracker } from "../features/study/activity-tracking.js";
import { createStudyChrome } from "../features/study/study-chrome.js";
import { createStudyPersistence } from "../features/study/study-persistence.js";
import { createStudyRunner } from "../features/study/study-runner.js";
import { createStudyStateBridge } from "../features/study/study-state-bridge.js";
import { resolveQuestionKey as cardId } from "../features/study-state/study-state.js";
import { initDesktopIntegrations } from "../ui/desktop.js";
import { ThemeManager } from "../ui/theme.js";
import {
  DEFAULT_STUDY_TYPOGRAPHY,
  THEME_CONTROL_IDS,
} from "../shared/constants.js";
import { renderAppVersionChip } from "./version-chip.js";
import { BUILD_INFO } from "../generated/build-info.js";

export async function startApp() {
  const defaults = Object.freeze({
    DEFAULT_QUESTION_FONT_SIZE: DEFAULT_STUDY_TYPOGRAPHY.questionFontSize,
    DEFAULT_OPTION_FONT_SIZE: DEFAULT_STUDY_TYPOGRAPHY.optionFontSize,
    DEFAULT_FULLSCREEN_QUESTION_FONT_SIZE:
      DEFAULT_STUDY_TYPOGRAPHY.fullscreenQuestionFontSize,
    DEFAULT_FULLSCREEN_OPTION_FONT_SIZE:
      DEFAULT_STUDY_TYPOGRAPHY.fullscreenOptionFontSize,
  });

  let currentQuestionIndex = 0;
  let allQuestions = [];
  let filteredQuestions = [];
  let questionOrder = [];
  let selectedAnswers = {};
  let solutionVisible = {};
  let activityByDay = {};
  let pendingSession = null;
  let questionFontSize = defaults.DEFAULT_QUESTION_FONT_SIZE;
  let optionFontSize = defaults.DEFAULT_OPTION_FONT_SIZE;
  let fullscreenQuestionFontSize =
    defaults.DEFAULT_FULLSCREEN_QUESTION_FONT_SIZE;
  let fullscreenOptionFontSize =
    defaults.DEFAULT_FULLSCREEN_OPTION_FONT_SIZE;
  let isFullscreen = false;
  let answerLockEnabled = false;
  let autoAdvanceEnabled = false;
  let topicSourceVisible = false;
  let autoAdvanceTimeoutId = null;
  const analyticsUiState = {
    analyticsPanelState: {
      isVisible: false,
    },
  };

  let syncOrch;
  let studyChrome;
  let studyStateBridge;
  let studyPersistence;
  let studyRunner;
  let authHandlers;

  function getStudyContext() {
    return {
      currentQuestionIndex,
      allQuestions,
      filteredQuestions,
      questionOrder,
      selectedAnswers,
      solutionVisible,
      activityByDay,
      pendingSession,
      questionFontSize,
      optionFontSize,
      fullscreenQuestionFontSize,
      fullscreenOptionFontSize,
      isFullscreen,
      answerLockEnabled,
      autoAdvanceEnabled,
      topicSourceVisible,
      autoAdvanceTimeoutId,
      isAnalyticsVisible: analyticsUiState.analyticsPanelState.isVisible,
    };
  }

  function setStudyContext(partial = {}) {
    if ("currentQuestionIndex" in partial) {
      currentQuestionIndex = partial.currentQuestionIndex;
    }
    if ("allQuestions" in partial) {
      allQuestions = partial.allQuestions;
    }
    if ("filteredQuestions" in partial) {
      filteredQuestions = partial.filteredQuestions;
    }
    if ("questionOrder" in partial) {
      questionOrder = partial.questionOrder;
    }
    if ("selectedAnswers" in partial) {
      selectedAnswers = partial.selectedAnswers;
    }
    if ("solutionVisible" in partial) {
      solutionVisible = partial.solutionVisible;
    }
    if ("activityByDay" in partial) {
      activityByDay = partial.activityByDay;
    }
    if ("pendingSession" in partial) {
      pendingSession = partial.pendingSession;
    }
    if ("questionFontSize" in partial) {
      questionFontSize = partial.questionFontSize;
    }
    if ("optionFontSize" in partial) {
      optionFontSize = partial.optionFontSize;
    }
    if ("fullscreenQuestionFontSize" in partial) {
      fullscreenQuestionFontSize = partial.fullscreenQuestionFontSize;
    }
    if ("fullscreenOptionFontSize" in partial) {
      fullscreenOptionFontSize = partial.fullscreenOptionFontSize;
    }
    if ("isFullscreen" in partial) {
      isFullscreen = partial.isFullscreen;
    }
    if ("answerLockEnabled" in partial) {
      answerLockEnabled = partial.answerLockEnabled;
    }
    if ("autoAdvanceEnabled" in partial) {
      autoAdvanceEnabled = partial.autoAdvanceEnabled;
    }
    if ("topicSourceVisible" in partial) {
      topicSourceVisible = partial.topicSourceVisible;
    }
    if ("autoAdvanceTimeoutId" in partial) {
      autoAdvanceTimeoutId = partial.autoAdvanceTimeoutId;
    }
    if ("isAnalyticsVisible" in partial) {
      analyticsUiState.analyticsPanelState.isVisible =
        partial.isAnalyticsVisible === true;
    }

    return getStudyContext();
  }

  function openPendingMediaImport() {
    const input = document.getElementById("media-bundle-picker");
    hidePendingMediaPrompt();
    if (input) {
      input.click();
    }
  }

  function showPendingMediaPrompt(snapshot = {}) {
    const modal = document.getElementById("media-prompt-modal");
    const copy = document.getElementById("media-prompt-copy");
    const count = Array.isArray(snapshot.references) ? snapshot.references.length : 0;
    if (!modal || count === 0) {
      return;
    }

    if (copy) {
      copy.textContent =
        `Bu set ${count} yerel görsel/ses bağlantısı içeriyor. İlgili dosyaları veya bir .zip paketini seçebilirsin.`;
    }
    modal.hidden = false;
  }

  function hidePendingMediaPrompt() {
    const modal = document.getElementById("media-prompt-modal");
    if (modal) {
      modal.hidden = true;
    }
  }

  async function handleMediaBundleSelect(event) {
    const files = Array.from(event?.target?.files || []);
    if (event?.target) {
      event.target.value = "";
    }
    await setManager.hydratePendingMedia(files);
  }

  const setManager = createSetManager({
    storage,
    buildSetRecord,
    normalizeQuestions,
    parseSetText,
    getSelectedAnswers() {
      return selectedAnswers;
    },
    resolveQuestionKey: cardId,
    getStorageKeyPrefix: () => syncOrch?.getStorageKeyPrefix() ?? "",
    onSetImported: (record) =>
      syncOrch ? syncOrch.saveRemoteSetRecord(record) : Promise.resolve(record),
    onRender: renderAnalyticsSummary,
    onSetsRemoved: (ids) =>
      syncOrch ? syncOrch.deleteRemoteSetRecords(ids) : null,
    onSelectionChanged: () => syncOrch?.handleSelectionChanged(),
    onPendingMediaChange(snapshot) {
      if (snapshot?.references?.length > 0) {
        showPendingMediaPrompt(snapshot);
      } else {
        hidePendingMediaPrompt();
      }
    },
    getTopicSourceVisible() {
      return topicSourceVisible;
    },
    documentRef: document,
    setTimeoutRef: window.setTimeout.bind(window),
    clearTimeoutRef: window.clearTimeout.bind(window),
    alertRef: window.alert?.bind(window),
    consoleRef: window.console,
  });

  const platformAdapter = createPlatformAdapter({
    storage,
    getRuntimeConfig,
  });
  const authFeature = createAuthFeature({
    storage,
    platformAdapter,
    getRuntimeConfig,
    hasSupabaseConfig,
    showScreen,
    documentRef: document,
  });
  const googleDrive = createGoogleDriveFeature({
    getRuntimeConfig,
    hasDriveConfig,
    isDesktopRuntime,
    loadSetFromText: (...args) => setManager.loadSetFromText(...args),
    loadSetFromBinary: (...args) => setManager.loadSetFromBinary(...args),
    selectSet: (...args) => setManager.selectSet(...args),
    renderSetList: () => renderSetList(),
    showUndoToast: (...args) => setManager.showUndoToast(...args),
    documentRef: document,
    alertRef: window.alert?.bind(window),
    consoleRef: window.console,
    fetchRef: window.fetch?.bind(window),
    setTimeoutRef: window.setTimeout.bind(window),
    clearTimeoutRef: window.clearTimeout.bind(window),
  });
  const syncStatus = createSyncStatusController({
    onChange: (snapshot) => renderSyncStatus(snapshot),
  });
  const analyticsPanel = createAnalyticsPanelController({
    documentRef: document,
    stateRef: analyticsUiState,
    onSubjectSelect: (subject) => focusAnalyticsSubject(subject),
    onVisibilityChange() {
      studyPersistence?.saveState();
    },
  });
  const editorFeature = createEditorFeature({
    buildSetRecord,
    documentRef: document,
    formatEditableText,
    htmlToEditableText,
    parseSetText,
    serializeSetRecord,
    showScreen,
    saveSetRecord: saveEditedSetRecord,
    writeSourceFile(sourcePath, rawSource) {
      return platformAdapter.writeSetSourceFile(sourcePath, rawSource);
    },
    confirmRef: window.confirm?.bind(window),
  });
  const desktopUpdateFeature = createDesktopUpdateFeature({
    stateRef: window.AppState,
    isDesktopRuntimeRef: isDesktopRuntime,
    documentRef: document,
    windowRef: window,
    alertRef: window.alert?.bind(window),
    confirmRef: window.confirm?.bind(window),
    consoleRef: window.console,
  });

  syncOrch = createSyncOrchestration({
    storage,
    platformAdapter,
    authFeature,
    syncStatus,
    setManager,
    desktopUpdateFeature,
    documentRef: document,
    consoleRef: window.console,
    getCurrentStudyStateSnapshot: (options) =>
      studyStateBridge?.buildCurrentStudyStateSnapshot(options) ?? null,
    applyStudyStateSnapshot: (snapshot, options) =>
      studyStateBridge?.applyStudyStateSnapshot(snapshot, options),
    resetStudyState: (storageKeyPrefix) =>
      studyStateBridge?.resetStudyState(storageKeyPrefix),
    renderSetList: () => renderSetList(),
    hasMeaningfulStudyStateSnapshot: (snapshot) =>
      studyStateBridge?.hasMeaningfulStudyStateSnapshot(snapshot) ?? false,
    loadLocalStudyState: (storageKeyPrefix) =>
      studyPersistence?.loadState(storageKeyPrefix),
  });

  const {
    getStorageKeyPrefix,
    buildScopedStorageKey,
    getScopedStorageItem,
    isRemoteWorkspaceActive,
    renderSyncStatus,
    retryCloudSync,
    captureWorkspaceSeed,
    hasPendingSyncConflict,
    clearSyncConflictState,
    scheduleRemoteStudyStateSync,
    clearRemoteStudyStateSyncTimer,
    loadSyncedWorkspace,
    useCloudConflictResolution,
    useLocalConflictResolution,
    resetRetryStateOnAuthChange,
    resetPendingStudyStateOnSignOut,
  } = syncOrch;

  studyChrome = createStudyChrome({
    storage,
    documentRef: document,
    windowRef: window,
    buildScopedStorageKey,
    getStorageKeyPrefix,
    scheduleRemoteStudyStateSync,
    buildCurrentStudyStateSnapshot: (options) =>
      studyStateBridge?.buildCurrentStudyStateSnapshot(options),
    defaults,
    getContext: getStudyContext,
    setContext: setStudyContext,
    onTopicSourceVisibilityChange: () => renderSetList(),
    onStatePersist: () => studyPersistence?.saveState(),
  });

  const activityTracker = createActivityTracker({
    getActivityByDay: () => getStudyContext().activityByDay,
    setActivityByDay: (nextActivityByDay) => {
      setStudyContext({
        activityByDay: nextActivityByDay,
      });
    },
  });

  studyStateBridge = createStudyStateBridge({
    storage,
    documentRef: document,
    setManager,
    getStudyContext,
    setStudyContext,
    getStorageKeyPrefix,
    buildScopedStorageKey,
    renderSetList: () => renderSetList(),
    syncAutoAdvanceToggleUI: () => studyChrome.syncAutoAdvanceToggleUI(),
    syncTypographyControls: () => studyChrome.syncTypographyControls(),
    applyTypographyState: (snapshot) => studyChrome.applyTypographyState(snapshot),
    defaults,
  });

  studyPersistence = createStudyPersistence({
    storage,
    getScopedStorageItem,
    getLoadedSets: () => setManager.getLoadedSets(),
    getStorageKeyPrefix,
    getStudyStateSnapshot: (options) =>
      studyStateBridge.buildCurrentStudyStateSnapshot(options),
    scheduleRemoteStudyStateSync,
    setStudyContext,
    getStudyTypographyState: () => studyChrome.getStudyTypographyState(),
    applyTypographyState: (state) => studyChrome.applyTypographyState(state),
    syncThemeControlsUI: () => studyRunner?.syncThemeControlsUI(),
    syncAnswerLockToggleUI: () => studyChrome.syncAnswerLockToggleUI(),
    syncAutoAdvanceToggleUI: () => studyChrome.syncAutoAdvanceToggleUI(),
    syncTopicSourceToggleUI: () => studyChrome.syncTopicSourceToggleUI(),
    syncTypographyControls: () => studyChrome.syncTypographyControls(),
    syncManagerSettingsPanelState: () =>
      studyRunner?.syncManagerSettingsPanelState(),
    consoleRef: window.console,
  });

  studyRunner = createStudyRunner({
    documentRef: document,
    windowRef: window,
    storage,
    showScreen,
    authFeature,
    setManager,
    desktopUpdateFeature,
    studyChrome,
    studyPersistence,
    activityTracker,
    getStorageKeyPrefix,
    hasPendingSyncConflict,
    confirmEditorNavigation,
    renderSetList: () => renderSetList(),
    getContext: getStudyContext,
    setContext: setStudyContext,
    formatEditableText,
    alertRef: window.alert?.bind(window),
    confirmRef: window.confirm?.bind(window),
  });

  authHandlers = createAuthHandlers({
    authFeature,
    syncStatus,
    resetRetryStateOnAuthChange,
    clearSyncConflictState,
    renderSyncStatus: (snapshot) => renderSyncStatus(snapshot),
    captureWorkspaceSeed,
    loadSyncedWorkspace,
    clearRemoteStudyStateSyncTimer,
    clearAutoAdvanceTimer: () => studyChrome.clearAutoAdvanceTimer(),
    resetPendingStudyStateOnSignOut,
    setManager,
    googleDrive,
    loadState: (storageKeyPrefix) => studyPersistence.loadState(storageKeyPrefix),
    renderSetList: () => renderSetList(),
    buildCurrentStudyStateSnapshot: (options) =>
      studyStateBridge.buildCurrentStudyStateSnapshot(options),
    confirmEditorNavigation,
    getIsFullscreen: () => getStudyContext().isFullscreen,
    toggleFullscreen: () => studyChrome.toggleFullscreen(),
  });

  function renderAnalyticsSummary() {
    const { pendingSession, selectedAnswers, activityByDay } = getStudyContext();
    const summary = buildAnalyticsSnapshot({
      loadedSets: setManager.getLoadedSets(),
      pendingSession,
      resolveQuestionKey: cardId,
      selectedAnswers,
      selectedSetIds: setManager.getSelectedSetIds(),
      activityByDay,
    });

    analyticsPanel.renderSummary(summary);
    desktopUpdateFeature.syncButtonState();
  }

  function renderSetList() {
    const result = setManager.renderSetList();
    renderAnalyticsSummary();
    analyticsPanel.syncVisibility();
    return result;
  }

  async function saveEditedSetRecord(record) {
    const savedRecord = await setManager.saveSetRecord(record);
    renderSetList();
    return savedRecord;
  }

  function confirmEditorNavigation(message, blockedMessage) {
    if (window.AppState?.currentScreen !== "editor") {
      return true;
    }

    return editorFeature.confirmNavigateAway(message, blockedMessage);
  }

  function openSelectedSetEditor() {
    if (hasPendingSyncConflict()) {
      return;
    }

    if (
      !confirmEditorNavigation(
        "Kaydedilmemiş değişiklikler var. Başka bir sete geçersen editör kapanacak. Devam etmek istiyor musun?",
        "Kaydedilmemiş değişiklikler korunuyor.",
      )
    ) {
      return false;
    }

    const selectedSetIds = setManager.getSelectedSetIds();
    if (selectedSetIds.length !== 1) {
      return;
    }

    const record = setManager.getLoadedSets()[selectedSetIds[0]];
    if (!record) {
      return;
    }

    editorFeature.openEditor(record);
    return true;
  }

  async function openSetImport() {
    if (hasPendingSyncConflict()) {
      return null;
    }

    if (
      isDesktopRuntime() &&
      typeof platformAdapter.pickNativeSetFiles === "function"
    ) {
      try {
        const files = await platformAdapter.pickNativeSetFiles();
        await setManager.importNativeFiles(files);
        renderSetList();
        return files;
      } catch (error) {
        window.console.error("Native set import error", error);
        window.alert?.(
          error?.message || "Yerel dosya seçilirken bir hata oluştu.",
        );
        return null;
      }
    }

    document.getElementById("file-picker")?.click();
    return null;
  }

  function focusAnalyticsSubject(subject) {
    const normalizedSubject =
      typeof subject === "string" && subject.trim() ? subject.trim() : "";
    if (!normalizedSubject) {
      return false;
    }

    if (!authFeature.requireAuth() || hasPendingSyncConflict()) {
      return false;
    }

    const mainApp = document.getElementById("main-app");
    const isStudyVisible =
      mainApp && window.getComputedStyle(mainApp).display !== "none";
    if (!isStudyVisible) {
      studyRunner.startStudy();
    }

    const topicSelect = document.getElementById("topic-select");
    if (!topicSelect) {
      return false;
    }

    const hasSubjectOption = [...topicSelect.options].some(
      (option) => option.value === normalizedSubject,
    );
    if (!hasSubjectOption) {
      return false;
    }

    topicSelect.value = normalizedSubject;
    const { pendingSession } = getStudyContext();
    studyRunner.filterByTopic(false, {
      preferredQuestionKey: pendingSession?.currentQuestionKey || null,
      fallbackIndex: pendingSession?.currentQuestionIndex ?? null,
    });
    return true;
  }

  async function initApp() {
    ThemeManager.renderThemeOptions(THEME_CONTROL_IDS);
    studyRunner.syncManagerSettingsPanelState();
    initDesktopIntegrations({
      getPlatformAdapter: () => platformAdapter,
      onSyncNow: () => loadSyncedWorkspace(),
      importNativeFiles: (files) => setManager.importNativeFiles(files),
    });
    renderAppVersionChip(BUILD_INFO);
    bindStaticEvents({
      documentRef: document,
      windowRef: window,
      handlers: {
        authGoogleDrive: () => googleDrive.authGoogleDrive(),
        addEditorOption: () => editorFeature.addOption(),
        addEditorQuestion: () => editorFeature.addQuestion(),
        applyEditorRaw: () => editorFeature.applyRaw(),
        checkDesktopUpdates: () => studyRunner.checkDesktopUpdates(),
        clearSetSelection: () => setManager.clearSetSelection(),
        closeAnalyticsPanel: () => analyticsPanel.closePanel(),
        closeEditor: () => {
          const closed = editorFeature.closeEditor();
          if (closed !== false) {
            renderSetList();
          }
          return closed;
        },
        continueAsDemoAuth: () => authHandlers.continueAsDemoAuth(),
        deleteSet: (setId) => setManager.deleteSet(setId),
        duplicateCurrentEditorQuestion: () => editorFeature.duplicateQuestion(),
        exportEditorJson: () => editorFeature.exportJson(),
        exportEditorSource: () => editorFeature.exportSource(),
        closeExportModal: () => studyRunner.closeExportModal(),
        executeExport: () => studyRunner.executeExport(),
        openExportModal: () => studyRunner.openExportModal(),
        toggleExportWarning: () => studyRunner.toggleExportWarning(),
        filterByTopic: (...args) => studyRunner.filterByTopic(...args),
        getIsFullscreen: () => getStudyContext().isFullscreen,
        handleFileSelect: (event) => setManager.handleFileSelect(event),
        handleMediaBundleSelect,
        hidePendingMediaPrompt,
        jumpToQuestion: () => studyRunner.jumpToQuestion(),
        moveCurrentEditorQuestion: (direction) =>
          editorFeature.moveQuestion(direction),
        nextQuestion: () => studyRunner.nextQuestion(),
        openSelectedSetEditor,
        openPendingMediaImport,
        openSetImport,
        previousQuestion: () => studyRunner.previousQuestion(),
        removeCurrentEditorQuestion: () => editorFeature.removeQuestion(),
        removeEditorOption: (index) => editorFeature.removeOption(index),
        removeSelectedSets: () => setManager.removeSelectedSets(),
        resetQuiz: () => studyRunner.resetQuiz(),
        resetTypographyPreferences: () => studyChrome.resetTypographyPreferences(),
        retryCloudSync: () => retryCloudSync(),
        retryWrongAnswers: () => studyRunner.retryWrongAnswers(),
        saveEditor: () => editorFeature.save(),
        selectAllSets: () => setManager.selectAllSets(),
        selectEditorQuestion: (index) => editorFeature.selectQuestion(index),
        selectOption: (index) => studyRunner.selectOption(index),
        setAnswerLock: (isEnabled) => studyChrome.setAnswerLock(isEnabled),
        setAutoAdvance: (isEnabled) => studyChrome.setAutoAdvance(isEnabled),
        setFullscreenOptionFontSize: (value) =>
          studyChrome.setFullscreenOptionFontSize(value),
        setFullscreenQuestionFontSize: (value) =>
          studyChrome.setFullscreenQuestionFontSize(value),
        setOptionFontSize: (value) => studyChrome.setOptionFontSize(value),
        setQuestionFontSize: (value) => studyChrome.setQuestionFontSize(value),
        setTheme: (themeName) => studyRunner.setTheme(themeName),
        setTopicSourceVisibility: (isVisible) =>
          studyChrome.setTopicSourceVisibility(isVisible),
        shouldPreventUnload: () => editorFeature.shouldPreventUnload(),
        showEditorRaw: () => editorFeature.setMode("raw"),
        showEditorVisual: () => editorFeature.setMode("visual"),
        showSetManager: () => studyRunner.showSetManager(),
        shuffleQuestions: () => studyRunner.shuffleQuestions(),
        signInAuth: () => authHandlers.signInAuth(),
        signOutAuth: () => authHandlers.signOutAuth(),
        signUpAuth: () => authHandlers.signUpAuth(),
        startStudy: () => studyRunner.startStudy(),
        toggleAnalyticsPanel: () => {
          const visible = analyticsPanel.togglePanel();
          if (visible) {
            renderAnalyticsSummary();
          }
          return visible;
        },
        toggleDeleteMode: () => setManager.toggleDeleteMode(),
        toggleFullscreen: () => studyChrome.toggleFullscreen(),
        toggleManagerSettingsPanel: (forceState) =>
          studyRunner.toggleManagerSettingsPanel(forceState),
        toggleSetCheck: (setId) => setManager.toggleSetCheck(setId),
        toggleSolution: () => studyRunner.toggleSolution(),
        undoLastRemoval: () => setManager.undoLastRemoval(),
        updateEditorCorrectIndex: (value) =>
          editorFeature.updateCurrentQuestionField("correct", value),
        updateEditorOption: (index, value) =>
          editorFeature.updateCurrentOption(index, value),
        updateEditorQuestionExplanation: (value) =>
          editorFeature.updateCurrentQuestionField("explanation", value),
        updateEditorQuestionSubject: (value) =>
          editorFeature.updateCurrentQuestionField("subject", value),
        updateEditorQuestionText: (value) =>
          editorFeature.updateCurrentQuestionField("q", value),
        updateEditorSetName: (value) =>
          editorFeature.updateMetaField("setName", value),
        useCloudConflictResolution: () => useCloudConflictResolution(),
        useLocalConflictResolution: () => useLocalConflictResolution(),
      },
      constants: {
        THEME_CONTROL_IDS,
      },
    });
    setManager.loadStoredSets("");
    studyPersistence.loadState("");
    const fallbackWorkspace = captureWorkspaceSeed();
    const fallbackStudySnapshot =
      studyStateBridge.buildCurrentStudyStateSnapshot();
    await authFeature.loadAuthSession();
    if (isRemoteWorkspaceActive()) {
      await loadSyncedWorkspace({
        fallbackWorkspace,
        fallbackStudySnapshot,
      });
    } else {
      clearSyncConflictState();
      renderSyncStatus(syncStatus.reset());
    }
    authFeature.syncAuthUi();
    showScreen(authFeature.resolveInitialScreen());
    document.body.classList.remove("app-booting");
    const splash = document.getElementById("app-splash");
    if (splash) {
      const finalize = () => splash.classList.add("is-removed");
      splash.addEventListener("transitionend", finalize, { once: true });
      setTimeout(finalize, 800);
    }
    renderSetList();
    desktopUpdateFeature.syncButtonState();
    desktopUpdateFeature.scheduleStartupCheck();
    googleDrive.syncDriveButtonState();
    googleDrive.initGoogleDrive();
  }

  window.AppSyncConflict = Object.freeze({
    detectSyncConflict,
  });
  window.__MCQ_TEST_HOOKS__ = syncOrch.testHooks;

  return initApp();
}
