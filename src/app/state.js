// src/app/state.js
// Central mutable state module. All other modules import state from here.
// Only imports from shared/utils.js (if any) — no circular dependencies.

// ── Auth & User ──
export let currentUser = null;
export function setCurrentUser(user) { currentUser = user ?? null; }

// ── Set Data ──
export let loadedSets = {};
export function setLoadedSets(value) { loadedSets = value; }

export let selectedSets = new Set();
export function setSelectedSets(value) { selectedSets = value; }

// ── Undo ──
export let lastRemovedSets = [];
export let undoTimeoutId = null;
export function setLastRemovedSets(v) { lastRemovedSets = v; }
export function setUndoTimeoutId(v) { undoTimeoutId = v; }

// ── Study Session ──
export let currentQuestionIndex = 0;
export let allQuestions = [];
export let filteredQuestions = [];
export let questionOrder = [];
export let selectedAnswers = {};
export let solutionVisible = {};
export let pendingSession = null;
export let isFullscreen = false;
export let answerLockEnabled = false;
export let autoAdvanceEnabled = false;
export let autoAdvanceTimeoutId = null;
export let activeFilter = "all";
export let isAnalyticsVisible = false;

// Typography (MCQ Specific)
export let questionFontSize = 25;
export let optionFontSize = 17;
export let fullscreenQuestionFontSize = 22;
export let fullscreenOptionFontSize = 15;

export let authStateToken = 0;
export let currentScreen = "manager";

function clampFontSize(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue)) return fallback;
  return Math.min(Math.max(parsedValue, 12), 40);
}

export function setCurrentQuestionIndex(v) { currentQuestionIndex = v; }
export function setAllQuestions(v) { allQuestions = v; }
export function setFilteredQuestions(v) { filteredQuestions = v; }
export function setQuestionOrder(v) { questionOrder = v; }
export function setSelectedAnswers(v) { selectedAnswers = v && typeof v === "object" ? v : {}; }
export function setSolutionVisible(v) { solutionVisible = v && typeof v === "object" ? v : {}; }
export function setPendingSession(v) { pendingSession = v; }
export function setIsFullscreen(v) { isFullscreen = v; }
export function setAnswerLockEnabled(v) { answerLockEnabled = Boolean(v); }
export function setAutoAdvanceEnabled(v) { autoAdvanceEnabled = Boolean(v); }
export function setAutoAdvanceTimeoutId(v) { autoAdvanceTimeoutId = v; }
export function setActiveFilter(v) { activeFilter = String(v || "all"); }
export function setIsAnalyticsVisible(v) { isAnalyticsVisible = Boolean(v); }

export function setQuestionFontSize(v) { questionFontSize = clampFontSize(v, 25); }
export function setOptionFontSize(v) { optionFontSize = clampFontSize(v, 17); }
export function setFullscreenQuestionFontSize(v) { fullscreenQuestionFontSize = clampFontSize(v, 22); }
export function setFullscreenOptionFontSize(v) { fullscreenOptionFontSize = clampFontSize(v, 15); }

export function incrementAuthStateToken() { authStateToken += 1; return authStateToken; }
export function setCurrentScreen(v) { currentScreen = v; }

// ── Editor ──
export let editorState = {
  isOpen: false,
  activeSetId: null,
  draftOrder: [],
  drafts: {},
  focusedField: null,
  pendingScrollQuestionId: null,
};
export function setEditorState(v) { editorState = v; }
export function resetEditorState() {
  editorState = { isOpen: false, activeSetId: null, draftOrder: [], drafts: {}, focusedField: null, pendingScrollQuestionId: null };
}

// ── Desktop Update ──
export const desktopUpdateState = {
  startupCheckScheduled: false,
  startupCheckCompleted: false,
  isChecking: false,
  isInstalling: false,
  buttonLabel: "Güncellemeleri Kontrol Et",
};

// ── Google Drive ──
export let tokenClient = null;
export let driveAccessToken = null;
export let pickerApiLoaded = false;
export function setTokenClient(v) { tokenClient = v; }
export function setDriveAccessToken(v) { driveAccessToken = v; }
export function setPickerApiLoaded(v) { pickerApiLoaded = v; }

// ── Remote Sync ──
export let pendingRemoteStudyStateSnapshot = null;
export let remoteStudyStateSyncTimeoutId = null;
export let lastSyncRetryAction = null;
export let pendingSyncConflict = null;

export function setPendingRemoteStudyStateSnapshot(v) { pendingRemoteStudyStateSnapshot = v; }
export function setRemoteStudyStateSyncTimeoutId(v) { remoteStudyStateSyncTimeoutId = v; }
export function setLastSyncRetryAction(v) { lastSyncRetryAction = v; }
export function setPendingSyncConflict(v) { pendingSyncConflict = v; }

// ── Editor Split Drag ──
export let editorSplitDragState = null;
export function setEditorSplitDragState(v) { editorSplitDragState = v; }

// ── Browser File Handles (in-memory) ──
export const browserFileHandles = new Map();

// ── Storage & Platform (set during bootstrap) ──
export let storage = null;
export let platformAdapter = null;
export function setStorage(v) { storage = v; }
export function setPlatformAdapter(v) { platformAdapter = v; }
