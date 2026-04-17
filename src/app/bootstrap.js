// src/app/bootstrap.js
import { showScreen } from "./screen.js";
import * as storage from "../core/storage.js";
import { createPlatformAdapter } from "../core/platform-adapter.js";
import { getRuntimeConfig, hasDriveConfig, hasSupabaseConfig, isDesktopRuntime } from "../core/runtime-config.js";
import { createAuthFeature } from "../features/auth/auth-shell.js";
import { createSyncStatusController } from "./sync-status.js";
import {
createRemoteWorkspaceSeed,
detectSyncConflict,
} from "../features/sync/conflict-resolution.js";
import { buildAnalyticsSummary, createAnalyticsPanelController } from "../features/analytics/analytics.js";
import { createDesktopUpdateFeature } from "../features/desktop-update/desktop-update.js";
import { buildSetRecord, formatEditableText, htmlToEditableText, normalizeQuestions, parseSetText, serializeSetRecord } from "../core/set-codec.js";
import { createSetManager } from "../features/set-manager/set-manager.js";
import { createEditorFeature } from "../features/editor/editor.js";
import { createGoogleDriveFeature } from "../features/google-drive/google-drive.js";
import { buildScoreSummary, formatScoreSummaryHtml, createRetryWrongAnswersState, createResetStudyState, shuffleQuestionOrder } from "../features/study/study-actions.js";
import { buildPrintableStudyHtml } from "../features/study/study-export.js";
import { buildStudyQuestions, collectStudySubjects, createFilteredStudyView, getAdjacentQuestionIndex, getBoundedQuestionIndex, selectStudyAnswer, toggleStudySolution } from "../features/study/study-session.js";
import { createStudyChromeState, getFullscreenToggleState, getAnswerLockStatusText, getAutoAdvanceStatusText, applyStudyTypographyPreferences, runWithQuestionInstantReset } from "../features/study/study-ui.js";
import { buildQuestionKey, buildStudyStateSnapshot, resolveQuestionKey as cardId, loadPersistedStudyState, pickNewerStudyStateSnapshot, persistStudyState, persistStudyStateSnapshot, persistStudyTypographyPreferences, readSavedSession } from "../features/study-state/study-state.js";
import * as state from './state.js';


export async function startApp() {
        const ANSWER_LOCK_KEY = "mc_answer_lock";
        const AUTO_ADVANCE_KEY = "mc_auto_advance";
        const DEFAULT_QUESTION_FONT_SIZE = 25;
        const DEFAULT_OPTION_FONT_SIZE = 17;
        const DEFAULT_FULLSCREEN_QUESTION_FONT_SIZE = 22;
        const DEFAULT_FULLSCREEN_OPTION_FONT_SIZE = 15;
  
        // --- ESKİ DEĞİŞKENLER ---
        let currentQuestionIndex = 0;
        let allQuestions = [];
        let filteredQuestions = [];
        let questionOrder = [];
        let selectedAnswers = {};
        let solutionVisible = {};
        let pendingSession = null;
        let questionFontSize = DEFAULT_QUESTION_FONT_SIZE;
        let optionFontSize = DEFAULT_OPTION_FONT_SIZE;
        let fullscreenQuestionFontSize = DEFAULT_FULLSCREEN_QUESTION_FONT_SIZE;
        let fullscreenOptionFontSize = DEFAULT_FULLSCREEN_OPTION_FONT_SIZE;
        let isFullscreen = false;
        let answerLockEnabled = false;
        let autoAdvanceEnabled = false;
        let autoAdvanceTimeoutId = null;
        let remoteStudyStateSyncTimeoutId = null;
        let pendingRemoteStudyStateSnapshot = null;
        let lastSyncRetryAction = null;
        let pendingSyncConflict = null;
        // AppBootstrap no longer needed, using standard imports.
        const setManager = createSetManager({
          storage,
          buildSetRecord,
          normalizeQuestions,
          parseSetText,
          getSelectedAnswers() {
            return selectedAnswers;
          },
          resolveQuestionKey: cardId,
          getStorageKeyPrefix,
          onSetImported: saveRemoteSetRecord,
          onRender: renderAnalyticsSummary,
          onSetsRemoved: deleteRemoteSetRecords,
          onSelectionChanged: handleSelectionChanged,
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
          loadSetFromText,
          selectSet,
          renderSetList,
          showUndoToast,
          documentRef: document,
          alertRef: window.alert?.bind(window),
          consoleRef: window.console,
          fetchRef: window.fetch?.bind(window),
          setTimeoutRef: window.setTimeout.bind(window),
          clearTimeoutRef: window.clearTimeout.bind(window),
        });
        const syncStatus = createSyncStatusController({
          onChange: renderSyncStatus,
        });
        const analyticsPanel = createAnalyticsPanelController({
          documentRef: document,
          stateRef: window.AppState,
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
  
        function getAuthSession() {
          return authFeature.getAuthSession();
        }
  
        function getStorageKeyPrefix() {
          const authSession = getAuthSession();
          if (
            authSession &&
            authSession.mode === "supabase" &&
            typeof authSession.userId === "string" &&
            authSession.userId.trim()
          ) {
            return `mc_user::${authSession.userId.trim()}`;
          }
  
          return "";
        }
  
        function buildScopedStorageKey(key, prefixOverride = null) {
          const prefix =
            typeof prefixOverride === "string" ? prefixOverride : getStorageKeyPrefix();
          return prefix ? `${prefix}::${key}` : key;
        }
  
        function getScopedStorageItem(key, prefixOverride = null) {
          return storage.getItem(buildScopedStorageKey(key, prefixOverride));
        }
  
        function setScopedStorageItem(key, value, prefixOverride = null) {
          storage.setItem(buildScopedStorageKey(key, prefixOverride), value);
        }
  
        function isRemoteWorkspaceActive() {
          return (
            getAuthSession()?.mode === "supabase" &&
            platformAdapter.supportsRemoteSync === true
          );
        }
  
        function normalizeSyncErrorMessage(error) {
          const message =
            typeof error?.message === "string" && error.message.trim()
              ? error.message.trim()
              : "Bilinmeyen hata";
          return message.replace(/\.$/, "");
        }
  
        function renderSyncStatus(snapshot = syncStatus.getSnapshot()) {
          const syncStatusEl = document.getElementById("sync-status");
          const retryButton = document.getElementById("sync-retry-btn");
  
          if (!syncStatusEl || !retryButton) {
            return;
          }
  
          if (!isRemoteWorkspaceActive() || !snapshot?.visible) {
            syncStatusEl.textContent = "";
            syncStatusEl.className = "sync-status";
            syncStatusEl.style.display = "none";
            retryButton.style.display = "none";
            desktopUpdateFeature.syncButtonState();
            return;
          }
  
          syncStatusEl.textContent = snapshot.message;
          syncStatusEl.className = `sync-status ${snapshot.state}`;
          syncStatusEl.style.display = "inline-flex";
          retryButton.style.display = snapshot.canRetry ? "inline-flex" : "none";
          desktopUpdateFeature.syncButtonState();
        }
  
        function markSyncing(detail = "") {
          if (!isRemoteWorkspaceActive()) {
            renderSyncStatus(syncStatus.reset());
            return;
          }
  
          renderSyncStatus(syncStatus.markSyncing(detail));
        }
  
        function markSynced(detail = "") {
          if (!isRemoteWorkspaceActive()) {
            renderSyncStatus(syncStatus.reset());
            return;
          }
  
          lastSyncRetryAction = null;
          renderSyncStatus(syncStatus.markSynced(detail));
        }
  
        function markSyncError(error, retryAction = null) {
          if (!isRemoteWorkspaceActive()) {
            renderSyncStatus(syncStatus.reset());
            return;
          }
  
          lastSyncRetryAction = typeof retryAction === "function" ? retryAction : null;
          renderSyncStatus(syncStatus.markError(normalizeSyncErrorMessage(error)));
        }
  
        async function retryCloudSync() {
          if (!isRemoteWorkspaceActive()) {
            renderSyncStatus(syncStatus.reset());
            return null;
          }
  
          if (typeof lastSyncRetryAction === "function") {
            return lastSyncRetryAction();
          }
  
          return loadSyncedWorkspace({
            fallbackWorkspace: captureWorkspaceSeed(),
            fallbackStudySnapshot: buildCurrentStudyStateSnapshot(),
          });
        }
  
        function cloneJson(value) {
          return JSON.parse(JSON.stringify(value));
        }
  
        function captureWorkspaceSeed() {
          return {
            loadedSets: cloneJson(getLoadedSets()),
            selectedSetIds: [...getSelectedSetIds()],
          };
        }
  
        function hasWorkspaceSeed(seed) {
          return Boolean(seed && Object.keys(seed.loadedSets || {}).length > 0);
        }
  
        function hasPendingSyncConflict() {
          return Boolean(pendingSyncConflict);
        }
  
        function formatSyncConflictSummary(summary = {}) {
          return `${summary.setCount || 0} set, ${summary.questionCount || 0} soru, ${summary.answeredCount || 0} cevap`;
        }
  
        function formatConflictTimestamp(value) {
          const parsed = Date.parse(value || "");
          if (!Number.isFinite(parsed)) {
            return "";
          }
  
          return new Date(parsed).toLocaleString("tr-TR", {
            hour12: false,
          });
        }
  
        function renderSyncConflictDetailList(elementId, lines) {
          const listEl = document.getElementById(elementId);
          if (!listEl) {
            return;
          }
  
          listEl.innerHTML = "";
          lines.forEach((line) => {
            const item = document.createElement("li");
            item.textContent = line;
            listEl.appendChild(item);
          });
        }
  
        function formatConflictFreshness(newerSide) {
          if (newerSide === "local") {
            return "Yerel daha yeni";
          }
  
          if (newerSide === "remote") {
            return "Bulut daha yeni";
          }
  
          return "Iki taraf da degismis";
        }
  
        function buildSyncConflictDetailLines(conflict, side) {
          const lines = [];
          const decisionEnvelope = conflict?.decisionEnvelope || {};
          const studySummary = decisionEnvelope.studyStateSummary || {};
  
          (decisionEnvelope.blockingConflicts || []).forEach((entry) => {
            const timestamp =
              side === "local"
                ? formatConflictTimestamp(entry.localUpdatedAt)
                : formatConflictTimestamp(entry.remoteUpdatedAt);
            lines.push(
              `${entry.setName}: ${formatConflictFreshness(entry.newerSide)}${timestamp ? ` | Son degisim: ${timestamp}` : ""} | Soru farki: ${entry.questionDelta || 0} | Cevap farki: ${entry.answerDelta || 0}`,
            );
          });
  
          if (conflict?.studyConflict) {
            const answeredCount =
              side === "local"
                ? studySummary.localAnsweredCount
                : studySummary.remoteAnsweredCount;
            lines.push(`İlerleme: ${answeredCount || 0} cevap`);
            if ((studySummary.blockingAnswerCount || 0) > 0) {
              lines.push(
                `Cakisan cevap sayisi: ${studySummary.blockingAnswerCount || 0}`,
              );
            }
          }
  
          if (lines.length === 0) {
            lines.push("Ek fark bilgisi yok.");
          }
  
          return lines;
        }
  
        function renderSyncConflictPanel() {
          const panel = document.getElementById("sync-conflict-panel");
          const localSummaryEl = document.getElementById("sync-conflict-local-summary");
          const remoteSummaryEl = document.getElementById("sync-conflict-remote-summary");
          const messageEl = document.getElementById("sync-conflict-message");
          const localDetailList = document.getElementById("sync-conflict-local-details");
          const remoteDetailList = document.getElementById("sync-conflict-remote-details");
  
          if (
            !panel ||
            !localSummaryEl ||
            !remoteSummaryEl ||
            !messageEl ||
            !localDetailList ||
            !remoteDetailList
          ) {
            return;
          }
  
          if (!pendingSyncConflict) {
            panel.style.display = "none";
            messageEl.textContent = "";
            localSummaryEl.textContent = "";
            remoteSummaryEl.textContent = "";
            localDetailList.innerHTML = "";
            remoteDetailList.innerHTML = "";
            return;
          }
  
          panel.style.display = "flex";
          const blockingSetCount =
            pendingSyncConflict.conflict?.decisionEnvelope?.blockingConflicts?.length || 0;
          messageEl.textContent =
            blockingSetCount > 0
              ? `${blockingSetCount} sette iki taraf da degismis. Hangisi esas alinsin?`
              : "Yerel calisma alani ile bulut verisi farkli. Hangisi esas alinsin?";
          localSummaryEl.textContent = formatSyncConflictSummary(
            pendingSyncConflict.conflict.localSummary,
          );
          remoteSummaryEl.textContent = formatSyncConflictSummary(
            pendingSyncConflict.conflict.remoteSummary,
          );
          renderSyncConflictDetailList(
            "sync-conflict-local-details",
            buildSyncConflictDetailLines(pendingSyncConflict.conflict, "local"),
          );
          renderSyncConflictDetailList(
            "sync-conflict-remote-details",
            buildSyncConflictDetailLines(pendingSyncConflict.conflict, "remote"),
          );
        }
  
        function clearSyncConflictState() {
          pendingSyncConflict = null;
          renderSyncConflictPanel();
        }
  
        function applyWorkspaceSeed(seed, options = {}) {
          setManager.replaceLoadedSets(Object.values(seed?.loadedSets || {}), {
            selectedSetIds: seed?.selectedSetIds || [],
            storageKeyPrefix: options.storageKeyPrefix ?? null,
          });
        }
  
        function resetStudyState(storageKeyPrefix = null) {
          selectedAnswers = {};
          solutionVisible = {};
          pendingSession = null;
          autoAdvanceEnabled = false;
          storage.removeItem(buildScopedStorageKey("mc_session", storageKeyPrefix));
          storage.removeItem(buildScopedStorageKey("mc_assessments", storageKeyPrefix));
          storage.removeItem(buildScopedStorageKey(AUTO_ADVANCE_KEY, storageKeyPrefix));
          syncAutoAdvanceToggleUI();
          renderSetList();
        }
  
        function buildCurrentStudyStateSnapshot(options = {}) {
          return buildStudyStateSnapshot({
            activeQuestion:
              filteredQuestions.length > 0
                ? filteredQuestions[questionOrder[currentQuestionIndex]]
                : null,
            currentQuestionIndex,
            selectedTopic:
              options.selectedTopic ??
              document.getElementById("topic-select")?.value ??
              pendingSession?.selectedTopic ??
              "hepsi",
            selectedSetIds: getSelectedSetIds(),
            selectedAnswers,
            solutionVisible,
            questionFontSize,
            optionFontSize,
            fullscreenQuestionFontSize,
            fullscreenOptionFontSize,
            autoAdvanceEnabled,
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
              questionSize !== DEFAULT_QUESTION_FONT_SIZE) ||
              (Number.isFinite(optionSize) &&
                optionSize !== DEFAULT_OPTION_FONT_SIZE) ||
              (Number.isFinite(fullscreenQuestionSize) &&
                fullscreenQuestionSize !== DEFAULT_FULLSCREEN_QUESTION_FONT_SIZE) ||
              (Number.isFinite(fullscreenOptionSize) &&
                fullscreenOptionSize !== DEFAULT_FULLSCREEN_OPTION_FONT_SIZE),
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
          const typographyState = applyTypographyState(normalizedSnapshot);
  
          selectedAnswers = normalizedSnapshot.selectedAnswers;
          solutionVisible = normalizedSnapshot.solutionVisible;
          pendingSession = normalizedSnapshot.session;
          autoAdvanceEnabled = normalizedSnapshot.autoAdvanceEnabled !== false;
          questionFontSize = typographyState.questionFontSize;
          optionFontSize = typographyState.optionFontSize;
          fullscreenQuestionFontSize = typographyState.fullscreenQuestionFontSize;
          fullscreenOptionFontSize = typographyState.fullscreenOptionFontSize;
  
          if (Array.isArray(normalizedSnapshot.selectedSetIds)) {
            setManager.setSelectedSetIds(normalizedSnapshot.selectedSetIds, {
              storageKeyPrefix: options.storageKeyPrefix ?? getStorageKeyPrefix(),
              notify: false,
            });
          }
  
          syncAutoAdvanceToggleUI();
          syncTypographyControls();
          renderSetList();
        }
  
        async function saveRemoteSetRecord(setRecord) {
          if (!isRemoteWorkspaceActive() || typeof platformAdapter.saveSet !== "function") {
            return setRecord;
          }
  
          markSyncing("setler");
  
          try {
            const savedRecord = await platformAdapter.saveSet(setRecord);
            markSynced("setler");
            return savedRecord;
          } catch (error) {
            markSyncError(error, () => saveRemoteSetRecord(setRecord));
            throw error;
          }
        }
  
        async function deleteRemoteSetRecords(setIds) {
          if (!isRemoteWorkspaceActive() || typeof platformAdapter.deleteSets !== "function") {
            return null;
          }
  
          markSyncing("setler");
  
          try {
            const result = await platformAdapter.deleteSets(setIds);
            markSynced("setler");
            return result;
          } catch (error) {
            markSyncError(error, () => deleteRemoteSetRecords(setIds));
            throw error;
          }
        }
  
        function clearRemoteStudyStateSyncTimer() {
          if (remoteStudyStateSyncTimeoutId) {
            clearTimeout(remoteStudyStateSyncTimeoutId);
            remoteStudyStateSyncTimeoutId = null;
          }
        }
  
        async function flushRemoteStudyStateSync() {
          if (
            !isRemoteWorkspaceActive() ||
            typeof platformAdapter.saveUserState !== "function" ||
            !pendingRemoteStudyStateSnapshot
          ) {
            return;
          }
  
          const snapshotToSync = pendingRemoteStudyStateSnapshot;
          pendingRemoteStudyStateSnapshot = null;
          markSyncing("ilerleme");
  
          try {
            const savedSnapshot = await platformAdapter.saveUserState(snapshotToSync);
            if (savedSnapshot) {
              persistStudyStateSnapshot({
                storage,
                snapshot: savedSnapshot,
                storageKeyPrefix: getStorageKeyPrefix(),
              });
            }
            markSynced("ilerleme");
          } catch (error) {
            console.error("Remote study-state sync error", error);
            pendingRemoteStudyStateSnapshot = snapshotToSync;
            markSyncError(error, async function retryPendingStudyStateSync() {
              pendingRemoteStudyStateSnapshot = snapshotToSync;
              return flushRemoteStudyStateSync();
            });
          }
        }
  
        function scheduleRemoteStudyStateSync(snapshot = buildCurrentStudyStateSnapshot()) {
          if (
            !isRemoteWorkspaceActive() ||
            typeof platformAdapter.saveUserState !== "function"
          ) {
            return;
          }
  
          pendingRemoteStudyStateSnapshot = snapshot;
          clearRemoteStudyStateSyncTimer();
          remoteStudyStateSyncTimeoutId = setTimeout(() => {
            remoteStudyStateSyncTimeoutId = null;
            void flushRemoteStudyStateSync();
          }, 600);
        }
  
        function handleSelectionChanged() {
          scheduleRemoteStudyStateSync(buildCurrentStudyStateSnapshot());
        }
  
        async function seedRemoteWorkspaceFromSeed(seed) {
          if (
            !isRemoteWorkspaceActive() ||
            !hasWorkspaceSeed(seed) ||
            typeof platformAdapter.saveSet !== "function"
          ) {
            return [];
          }
  
          const savedRecords = [];
          for (const [setId, setRecord] of Object.entries(seed.loadedSets || {})) {
            const savedRecord = await platformAdapter.saveSet({
              id: setRecord.id || setId,
              slug: setRecord.slug || setId,
              setName: setRecord.setName,
              fileName: setRecord.fileName,
              sourceFormat: setRecord.sourceFormat,
              rawSource: setRecord.rawSource,
              questions: setRecord.questions,
              updatedAt: setRecord.updatedAt || new Date().toISOString(),
            });
            savedRecords.push(savedRecord);
          }
  
          return savedRecords;
        }
  
        async function uploadReconciledLocalRecords(records = [], remoteIdsToDelete = []) {
          if (
            !isRemoteWorkspaceActive() ||
            ((typeof platformAdapter.saveSet !== "function" ||
              !Array.isArray(records) ||
              records.length === 0) &&
              (typeof platformAdapter.deleteSets !== "function" ||
                !Array.isArray(remoteIdsToDelete) ||
                remoteIdsToDelete.length === 0))
          ) {
            return [];
          }
  
          const savedRecords = [];
          if (
            Array.isArray(remoteIdsToDelete) &&
            remoteIdsToDelete.length > 0 &&
            typeof platformAdapter.deleteSets === "function"
          ) {
            await platformAdapter.deleteSets(remoteIdsToDelete);
          }
  
          for (const record of records) {
            savedRecords.push(
              await platformAdapter.saveSet({
                ...record,
                updatedAt: record.updatedAt || new Date().toISOString(),
              }),
            );
          }
          return savedRecords;
        }
  
        async function loadSyncedWorkspace(options = {}) {
          if (!isRemoteWorkspaceActive()) {
            renderSyncStatus(syncStatus.reset());
            clearSyncConflictState();
            return;
          }
  
          markSyncing("calisma alani");
  
          const userPrefix = getStorageKeyPrefix();
          const fallbackWorkspace = hasWorkspaceSeed(options.fallbackWorkspace)
            ? options.fallbackWorkspace
            : null;
          const fallbackSnapshot = hasMeaningfulStudyStateSnapshot(
            options.fallbackStudySnapshot,
          )
            ? options.fallbackStudySnapshot
            : null;
  
          setManager.loadStoredSets(userPrefix);
          loadState(userPrefix);
  
          const userScopedWorkspace = captureWorkspaceSeed();
          const userScopedSnapshot = hasMeaningfulStudyStateSnapshot(
            buildCurrentStudyStateSnapshot(),
          )
            ? buildCurrentStudyStateSnapshot()
            : null;
          const localWorkspaceSeed = hasWorkspaceSeed(userScopedWorkspace)
            ? userScopedWorkspace
            : fallbackWorkspace;
          const localWorkspacePrefix = hasWorkspaceSeed(userScopedWorkspace)
            ? userPrefix
            : "";
          const localSnapshotSeed = userScopedSnapshot || fallbackSnapshot;
          const localSnapshotPrefix = userScopedSnapshot ? userPrefix : "";
  
          let remoteRecords = [];
          let syncLoadFailed = false;
          try {
            remoteRecords = await platformAdapter.loadSets();
          } catch (error) {
            console.error("Remote set load error", error);
            syncLoadFailed = true;
            markSyncError(error, () => loadSyncedWorkspace(options));
          }
  
          if (remoteRecords.length === 0 && hasWorkspaceSeed(localWorkspaceSeed)) {
            try {
              remoteRecords = await seedRemoteWorkspaceFromSeed(localWorkspaceSeed);
            } catch (error) {
              console.error("Remote set seed error", error);
              syncLoadFailed = true;
              markSyncError(error, () => loadSyncedWorkspace(options));
            }
          }
  
          let remoteSnapshot = null;
  
          try {
            remoteSnapshot =
              typeof platformAdapter.loadUserState === "function"
                ? await platformAdapter.loadUserState()
                : null;
            if (remoteSnapshot) {
            }
          } catch (error) {
            console.error("Remote study-state load error", error);
            syncLoadFailed = true;
            markSyncError(error, () => loadSyncedWorkspace(options));
          }
  
          if (!syncLoadFailed) {
            let conflict = detectSyncConflict({
              localWorkspace: localWorkspaceSeed,
              remoteRecords,
              localSnapshot: localSnapshotSeed,
              remoteSnapshot,
            });
  
            if (
              !conflict.hasConflict &&
              (conflict.recordsToUpload.length > 0 ||
                (conflict.remoteIdsToDelete || []).length > 0)
            ) {
              try {
                const uploadedRecords = await uploadReconciledLocalRecords(
                  conflict.recordsToUpload,
                  conflict.remoteIdsToDelete,
                );
                if (uploadedRecords.length > 0) {
                  const nextRemoteMap = new Map(
                    remoteRecords
                      .filter(
                        (record) =>
                          record &&
                          record.id &&
                          !(conflict.remoteIdsToDelete || []).includes(record.id),
                      )
                      .map((record) => [record.id, record]),
                  );
                  uploadedRecords.forEach((record) => {
                    if (record?.id) {
                      nextRemoteMap.set(record.id, record);
                    }
                  });
                  remoteRecords = [...nextRemoteMap.values()];
                  conflict = detectSyncConflict({
                    localWorkspace: localWorkspaceSeed,
                    remoteRecords,
                    localSnapshot: localSnapshotSeed,
                    remoteSnapshot,
                  });
                }
              } catch (error) {
                console.error("Remote reconciliation upload error", error);
                syncLoadFailed = true;
                markSyncError(error, () => loadSyncedWorkspace(options));
              }
            }
  
            if (conflict.hasConflict) {
              pendingSyncConflict = {
                conflict,
                userPrefix,
                localWorkspaceSeed,
                localWorkspacePrefix,
                localSnapshotSeed,
                localSnapshotPrefix,
                remoteRecords,
                remoteSnapshot,
              };
              renderSyncConflictPanel();
              renderSyncStatus(syncStatus.reset());
  
              if (hasWorkspaceSeed(localWorkspaceSeed)) {
                applyWorkspaceSeed(localWorkspaceSeed, {
                  storageKeyPrefix: localWorkspacePrefix,
                });
              } else {
                applyWorkspaceSeed({ loadedSets: {}, selectedSetIds: [] }, {
                  storageKeyPrefix: localWorkspacePrefix,
                });
              }
  
              if (hasMeaningfulStudyStateSnapshot(localSnapshotSeed)) {
                applyStudyStateSnapshot(localSnapshotSeed, {
                  storageKeyPrefix: localSnapshotPrefix,
                });
              } else {
                resetStudyState(localSnapshotPrefix);
              }
              return;
            }
          }
  
          clearSyncConflictState();
  
          const resolvedConflict = detectSyncConflict({
            localWorkspace: localWorkspaceSeed,
            remoteRecords,
            localSnapshot: localSnapshotSeed,
            remoteSnapshot,
          });
  
          applyWorkspaceSeed(resolvedConflict.mergedWorkspace, {
            storageKeyPrefix: userPrefix,
          });
  
          let finalSnapshot = resolvedConflict.mergedSnapshot;
          if (hasMeaningfulStudyStateSnapshot(finalSnapshot)) {
            if (resolvedConflict.shouldPersistMergedSnapshot) {
              scheduleRemoteStudyStateSync(finalSnapshot);
            }
          } else if (remoteSnapshot) {
            finalSnapshot = pickNewerStudyStateSnapshot(
              localSnapshotSeed,
              remoteSnapshot,
            );
            if (
              finalSnapshot === localSnapshotSeed &&
              hasMeaningfulStudyStateSnapshot(localSnapshotSeed)
            ) {
              scheduleRemoteStudyStateSync(localSnapshotSeed);
            }
          } else if (hasMeaningfulStudyStateSnapshot(localSnapshotSeed)) {
            finalSnapshot = localSnapshotSeed;
            scheduleRemoteStudyStateSync(localSnapshotSeed);
          }
  
          if (hasMeaningfulStudyStateSnapshot(finalSnapshot)) {
            applyStudyStateSnapshot(finalSnapshot, {
              storageKeyPrefix: userPrefix,
            });
          } else {
            renderSetList();
          }
  
          if (!syncLoadFailed) {
            markSynced("calisma alani");
          }
        }
  
        async function useCloudConflictResolution() {
          if (!pendingSyncConflict) {
            return null;
          }
  
          const conflictState = pendingSyncConflict;
          clearSyncConflictState();
          markSyncing("calisma alani");
  
          const remoteSelectedSetIds = Array.isArray(
            conflictState.remoteSnapshot?.selectedSetIds,
          )
            ? conflictState.remoteSnapshot.selectedSetIds
            : conflictState.remoteRecords.map((record) => record.id).filter(Boolean);
  
          applyWorkspaceSeed(
            createRemoteWorkspaceSeed(conflictState.remoteRecords, remoteSelectedSetIds),
            {
              storageKeyPrefix: conflictState.userPrefix,
            },
          );
  
          if (hasMeaningfulStudyStateSnapshot(conflictState.remoteSnapshot)) {
            applyStudyStateSnapshot(conflictState.remoteSnapshot, {
              storageKeyPrefix: conflictState.userPrefix,
            });
          } else {
            resetStudyState(conflictState.userPrefix);
          }
  
          markSynced("calisma alani");
          return true;
        }
  
        async function useLocalConflictResolution() {
          if (!pendingSyncConflict) {
            return null;
          }
  
          const conflictState = pendingSyncConflict;
          clearSyncConflictState();
          markSyncing("calisma alani");
  
          try {
            const remoteIds = conflictState.remoteRecords
              .map((record) => record.id)
              .filter(Boolean);
            const localRecords = Object.values(
              conflictState.localWorkspaceSeed?.loadedSets || {},
            );
            const localIds = localRecords.map((record) => record.id).filter(Boolean);
            const removeIds = remoteIds.filter((setId) => !localIds.includes(setId));
  
            if (
              removeIds.length > 0 &&
              typeof platformAdapter.deleteSets === "function"
            ) {
              await platformAdapter.deleteSets(removeIds);
            }
  
            for (const record of localRecords) {
              await platformAdapter.saveSet({
                ...record,
                updatedAt: record.updatedAt || new Date().toISOString(),
              });
            }
  
            if (
              hasMeaningfulStudyStateSnapshot(conflictState.localSnapshotSeed) &&
              typeof platformAdapter.saveUserState === "function"
            ) {
              await platformAdapter.saveUserState(conflictState.localSnapshotSeed);
            }
  
            applyWorkspaceSeed(conflictState.localWorkspaceSeed, {
              storageKeyPrefix: conflictState.userPrefix,
            });
  
            if (hasMeaningfulStudyStateSnapshot(conflictState.localSnapshotSeed)) {
              applyStudyStateSnapshot(conflictState.localSnapshotSeed, {
                storageKeyPrefix: conflictState.userPrefix,
              });
            } else {
              resetStudyState(conflictState.userPrefix);
            }
  
            markSynced("calisma alani");
            return true;
          } catch (error) {
            pendingSyncConflict = conflictState;
            markSyncError(error, useLocalConflictResolution);
            renderSyncConflictPanel();
            throw error;
          }
        }
  
        function getExplanationHtml(question) {
          if (
            question &&
            typeof question.explanation === "string" &&
            question.explanation.trim()
          ) {
            return question.explanation;
          }
          return '<span class="highlight-important">⚠️ Açıklama bulunamadı.</span>';
        }
  
        function getLoadedSets() {
          return setManager.getLoadedSets();
        }
  
        function getSelectedSetIds() {
          return setManager.getSelectedSetIds();
        }
  
        function loadSetFromText(text, fileName, importOptions = {}) {
          return setManager.loadSetFromText(text, fileName, importOptions);
        }
  
        function handleFileSelect(event) {
          return setManager.handleFileSelect(event);
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
              console.error("Native set import error", error);
              window.alert?.(
                error?.message || "Yerel dosya secilirken bir hata olustu.",
              );
              return null;
            }
          }
  
          document.getElementById("file-picker")?.click();
          return null;
        }
  
        function renderAnalyticsSummary() {
          const summary = buildAnalyticsSummary({
            loadedSets: getLoadedSets(),
            pendingSession,
            resolveQuestionKey: cardId,
            selectedAnswers,
            selectedSetIds: getSelectedSetIds(),
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
  
        function toggleAnalyticsPanel() {
          const visible = analyticsPanel.togglePanel();
          if (visible) {
            renderAnalyticsSummary();
          }
          return visible;
        }
  
        function closeAnalyticsPanel() {
          return analyticsPanel.closePanel();
        }
  
        function toggleSetCheck(setId) {
          return setManager.toggleSetCheck(setId);
        }
  
        function deleteSet(setId) {
          return setManager.deleteSet(setId);
        }
  
        function toggleDeleteMode() {
          return setManager.toggleDeleteMode();
        }
  
        function selectAllSets() {
          return setManager.selectAllSets();
        }
  
        function clearSetSelection() {
          return setManager.clearSetSelection();
        }
  
        function removeSelectedSets() {
          return setManager.removeSelectedSets();
        }
  
        function undoLastRemoval() {
          return setManager.undoLastRemoval();
        }
  
        function selectSet(setId) {
          return setManager.selectSet(setId);
        }
  
        function showUndoToast(message) {
          return setManager.showUndoToast(message);
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
              "Kaydedilmemis degisiklikler var. Baska bir sete gecersen editor kapanacak. Devam etmek istiyor musun?",
              "Kaydedilmemis degisiklikler korunuyor.",
            )
          ) {
            return false;
          }
  
          const selectedSetIds = getSelectedSetIds();
          if (selectedSetIds.length !== 1) {
            return;
          }
  
          const record = getLoadedSets()[selectedSetIds[0]];
          if (!record) {
            return;
          }
  
          editorFeature.openEditor(record);
        }
  
        function openNewSetEditor() {
          if (hasPendingSyncConflict()) {
            return;
          }
  
          if (
            !confirmEditorNavigation(
              "Kaydedilmemis degisiklikler var. Yeni taslak acarsan editor kapanacak. Devam etmek istiyor musun?",
              "Kaydedilmemis degisiklikler korunuyor.",
            )
          ) {
            return false;
          }
  
          editorFeature.openNewDraft({
            sourceFormat: "markdown",
          });
        }
  
        function closeEditor() {
          const closed = editorFeature.closeEditor();
          if (closed !== false) {
            renderSetList();
          }
          return closed;
        }
  
        function saveEditor() {
          return editorFeature.save();
        }
  
        function exportEditorJson() {
          return editorFeature.exportJson();
        }
  
        function exportEditorSource() {
          return editorFeature.exportSource();
        }
  
        function selectEditorQuestion(index) {
          return editorFeature.selectQuestion(index);
        }
  
        function showEditorVisual() {
          return editorFeature.setMode("visual");
        }
  
        function showEditorRaw() {
          return editorFeature.setMode("raw");
        }
  
        function updateEditorSetName(value) {
          return editorFeature.updateMetaField("setName", value);
        }
  
        function updateEditorQuestionText(value) {
          return editorFeature.updateCurrentQuestionField("q", value);
        }
  
        function updateEditorQuestionSubject(value) {
          return editorFeature.updateCurrentQuestionField("subject", value);
        }
  
        function updateEditorQuestionExplanation(value) {
          return editorFeature.updateCurrentQuestionField("explanation", value);
        }
  
        function updateEditorCorrectIndex(value) {
          return editorFeature.updateCurrentQuestionField("correct", value);
        }
  
        function updateEditorOption(index, value) {
          return editorFeature.updateCurrentOption(index, value);
        }
  
        function addEditorQuestion() {
          return editorFeature.addQuestion();
        }
  
        function duplicateCurrentEditorQuestion() {
          return editorFeature.duplicateQuestion();
        }
  
        function moveCurrentEditorQuestion(direction) {
          return editorFeature.moveQuestion(direction);
        }
  
        function removeCurrentEditorQuestion() {
          return editorFeature.removeQuestion();
        }
  
        function addEditorOption() {
          return editorFeature.addOption();
        }
  
        function removeEditorOption(index) {
          return editorFeature.removeOption(index);
        }
  
        function applyEditorRaw() {
          return editorFeature.applyRaw();
        }
  
        function continueAsDemoAuth() {
          lastSyncRetryAction = null;
          clearSyncConflictState();
          renderSyncStatus(syncStatus.reset());
          renderSetList();
          googleDrive.syncDriveButtonState();
          return authFeature.continueAsDemo();
        }
  
        async function signInAuth() {
          const fallbackWorkspace = captureWorkspaceSeed();
          const fallbackStudySnapshot = buildCurrentStudyStateSnapshot();
          const session = await authFeature.attemptPasswordAuth("signin");
          if (session) {
            await loadSyncedWorkspace({
              fallbackWorkspace,
              fallbackStudySnapshot,
            });
            renderSetList();
          }
          return session;
        }
  
        async function signUpAuth() {
          const fallbackWorkspace = captureWorkspaceSeed();
          const fallbackStudySnapshot = buildCurrentStudyStateSnapshot();
          const session = await authFeature.attemptPasswordAuth("signup");
          if (session) {
            await loadSyncedWorkspace({
              fallbackWorkspace,
              fallbackStudySnapshot,
            });
            renderSetList();
          }
          return session;
        }
  
        async function signOutAuth() {
          if (
            !confirmEditorNavigation(
              "Kaydedilmemis degisiklikler var. Cikis yaparsan editor degisiklikleri kaybolacak. Devam etmek istiyor musun?",
              "Kaydedilmemis degisiklikler korunuyor.",
            )
          ) {
            return false;
          }
  
          clearAutoAdvanceTimer();
          clearRemoteStudyStateSyncTimer();
          pendingRemoteStudyStateSnapshot = null;
          lastSyncRetryAction = null;
          clearSyncConflictState();
          if (isFullscreen) {
            toggleFullscreen();
          }
          const result = await authFeature.signOut();
          renderSyncStatus(syncStatus.reset());
          setManager.loadStoredSets("");
          loadState("");
          renderSetList();
          googleDrive.syncDriveButtonState();
          return result;
        }
  
        function initGoogleDrive() {
          return googleDrive.initGoogleDrive();
        }
  
        function authGoogleDrive() {
          return googleDrive.authGoogleDrive();
        }
  
        function updateFullscreenInfo(question) {
          const counterEl = document.getElementById("fullscreen-question-counter");
          const subjectEl = document.getElementById("fullscreen-subject-badge");
          const prevBtn = document.getElementById("fullscreen-prev-btn");
          const nextBtn = document.getElementById("fullscreen-next-btn");
          const chromeState = createStudyChromeState({
            currentQuestionIndex,
            totalQuestions: filteredQuestions.length,
            subject: question ? question.subject : "",
          });
  
          if (counterEl) {
            counterEl.textContent = chromeState.counterText;
          }
          if (subjectEl) {
            subjectEl.textContent = chromeState.subjectText;
          }
          if (prevBtn) {
            prevBtn.disabled = chromeState.disablePrev;
          }
          if (nextBtn) {
            nextBtn.disabled = chromeState.disableNext;
          }
        }
  
        function syncAnswerLockToggleUI() {
          const toggle = document.getElementById("answer-lock-toggle-manager");
          if (toggle) {
            toggle.checked = answerLockEnabled;
          }
          const status = document.getElementById("answer-lock-status");
          if (status) {
            status.textContent = getAnswerLockStatusText(answerLockEnabled);
          }
        }
  
        function setAnswerLock(isEnabled) {
          answerLockEnabled = Boolean(isEnabled);
          storage.setItem(ANSWER_LOCK_KEY, answerLockEnabled ? "1" : "0");
          syncAnswerLockToggleUI();
        }
  
        function syncAutoAdvanceToggleUI() {
          const toggle = document.getElementById("auto-advance-toggle-manager");
          if (toggle) {
            toggle.checked = autoAdvanceEnabled;
          }
          const status = document.getElementById("auto-advance-status");
          if (status) {
            status.textContent = getAutoAdvanceStatusText(autoAdvanceEnabled);
          }
        }
  
        function getStudyTypographyState() {
          return {
            questionFontSize,
            optionFontSize,
            fullscreenQuestionFontSize,
            fullscreenOptionFontSize,
          };
        }
  
        function syncTypographyControls() {
          const questionInput = document.getElementById("question-font-size");
          const optionInput = document.getElementById("option-font-size");
          const fullscreenQuestionInput = document.getElementById(
            "fullscreen-question-font-size",
          );
          const fullscreenOptionInput = document.getElementById(
            "fullscreen-option-font-size",
          );
  
          if (questionInput) {
            questionInput.value = String(questionFontSize);
          }
          if (optionInput) {
            optionInput.value = String(optionFontSize);
          }
          if (fullscreenQuestionInput) {
            fullscreenQuestionInput.value = String(fullscreenQuestionFontSize);
          }
          if (fullscreenOptionInput) {
            fullscreenOptionInput.value = String(fullscreenOptionFontSize);
          }
        }
  
        function applyTypographyState(nextState) {
          const normalizedState = applyStudyTypographyPreferences(nextState, document);
  
          questionFontSize = normalizedState.questionFontSize;
          optionFontSize = normalizedState.optionFontSize;
          fullscreenQuestionFontSize = normalizedState.fullscreenQuestionFontSize;
          fullscreenOptionFontSize = normalizedState.fullscreenOptionFontSize;
          syncTypographyControls();
          return normalizedState;
        }
  
        function setQuestionFontSize(value) {
          applyTypographyState({
            questionFontSize: value,
            optionFontSize,
            fullscreenQuestionFontSize,
            fullscreenOptionFontSize,
          });
          saveState();
        }
  
        function setOptionFontSize(value) {
          applyTypographyState({
            questionFontSize,
            optionFontSize: value,
            fullscreenQuestionFontSize,
            fullscreenOptionFontSize,
          });
          saveState();
        }
  
        function setFullscreenQuestionFontSize(value) {
          applyTypographyState({
            questionFontSize,
            optionFontSize,
            fullscreenQuestionFontSize: value,
            fullscreenOptionFontSize,
          });
          saveState();
        }
  
        function setFullscreenOptionFontSize(value) {
          applyTypographyState({
            questionFontSize,
            optionFontSize,
            fullscreenQuestionFontSize,
            fullscreenOptionFontSize: value,
          });
          saveState();
        }
  
        function resetTypographyPreferences() {
          applyTypographyState({
            questionFontSize: DEFAULT_QUESTION_FONT_SIZE,
            optionFontSize: DEFAULT_OPTION_FONT_SIZE,
            fullscreenQuestionFontSize: DEFAULT_FULLSCREEN_QUESTION_FONT_SIZE,
            fullscreenOptionFontSize: DEFAULT_FULLSCREEN_OPTION_FONT_SIZE,
          });
          saveState();
        }
  
        function setAutoAdvance(isEnabled) {
          autoAdvanceEnabled = Boolean(isEnabled);
          setScopedStorageItem(
            AUTO_ADVANCE_KEY,
            autoAdvanceEnabled ? "1" : "0",
          );
          syncAutoAdvanceToggleUI();
          scheduleRemoteStudyStateSync(buildCurrentStudyStateSnapshot());
        }
  
        function clearAutoAdvanceTimer() {
          if (autoAdvanceTimeoutId) {
            clearTimeout(autoAdvanceTimeoutId);
            autoAdvanceTimeoutId = null;
          }
        }
  
        function toggleFullscreen() {
          const questionCard = document.getElementById("question-card");
          const toggleBtn = document.getElementById("fullscreen-toggle-btn");
          if (!questionCard || !toggleBtn) return;
  
          isFullscreen = !isFullscreen;
          const fullscreenState = getFullscreenToggleState(isFullscreen);
  
          questionCard.classList.toggle("fullscreen-active", isFullscreen);
          document.body.style.overflow = fullscreenState.bodyOverflow;
          toggleBtn.textContent = fullscreenState.buttonText;
          toggleBtn.title = fullscreenState.buttonTitle;
  
          updateFullscreenInfo(
            filteredQuestions.length > 0
              ? filteredQuestions[questionOrder[currentQuestionIndex]]
              : null,
          );
  
          if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
          }
        }
  
        function startStudy() {
          if (!authFeature.requireAuth()) {
            return;
          }
          if (hasPendingSyncConflict()) {
            return;
          }
          const loadedSets = getLoadedSets();
          const selectedSetIds = getSelectedSetIds();
          if (selectedSetIds.length === 0) return;
          clearAutoAdvanceTimer();
  
          allQuestions = buildStudyQuestions({
            loadedSets,
            selectedSetIds,
            buildQuestionKey,
          });
  
          if (allQuestions.length === 0) {
            alert("Seçili setlerde soru bulunamadı.");
            return;
          }
  
          filteredQuestions = [...allQuestions];
          questionOrder = [...Array(filteredQuestions.length).keys()];
          currentQuestionIndex = 0;
  
          showScreen("study");
  
          populateTopicFilter();
          updateScoreDisplay();
  
          const session =
            readSavedSession(storage, pendingSession, getStorageKeyPrefix()) ||
            pendingSession ||
            {};
          const topicSelect = document.getElementById("topic-select");
          if (
            topicSelect &&
            typeof session.selectedTopic === "string" &&
            [...topicSelect.options].some(
              (option) => option.value === session.selectedTopic,
            )
          ) {
            topicSelect.value = session.selectedTopic;
          }
  
          filterByTopic(false, {
            preferredQuestionKey:
              session && typeof session.currentQuestionKey === "string"
                ? session.currentQuestionKey
                : null,
            fallbackIndex:
              session && Number.isInteger(session.currentQuestionIndex)
                ? session.currentQuestionIndex
                : null,
          });
        }
  
        function showSetManager() {
          if (!authFeature.requireAuth()) {
            return;
          }
          if (
            !confirmEditorNavigation(
              "Kaydedilmemis degisiklikler var. Yoneticiye donersen editor kapanacak. Devam etmek istiyor musun?",
              "Kaydedilmemis degisiklikler korunuyor.",
            )
          ) {
            return false;
          }
          clearAutoAdvanceTimer();
          if (isFullscreen) {
            toggleFullscreen();
          }
          showScreen("manager");
          renderSetList();
          desktopUpdateFeature.syncButtonState();
        }
  
        function checkDesktopUpdates() {
          return desktopUpdateFeature.checkForUpdates("manual");
        }
  
        function filterByTopic(resetIndex = true, options = {}) {
          const selectedTopic = document.getElementById("topic-select").value;
          const nextView = createFilteredStudyView({
            allQuestions,
            selectedTopic,
            preferredQuestionKey: resetIndex ? null : options.preferredQuestionKey,
            fallbackIndex: resetIndex
              ? 0
              : Number.isInteger(options.fallbackIndex)
                ? options.fallbackIndex
                : null,
            resolveQuestionKey: cardId,
          });
  
          filteredQuestions = nextView.filteredQuestions;
          questionOrder = nextView.questionOrder;
          currentQuestionIndex = nextView.currentQuestionIndex;
  
          document
            .getElementById("jump-input")
            .setAttribute("max", filteredQuestions.length);
  
          if (filteredQuestions.length > 0) {
            displayQuestion();
            return;
          }
  
          document.getElementById("question-text").innerHTML =
            "Bu filtrede gösterilecek soru bulunamadı.";
          document.getElementById("question-counter").textContent = "Soru 0 / 0";
          document.getElementById("subject-badge").textContent = selectedTopic;
          document.getElementById("solution-content").innerHTML = "";
          document.getElementById("options-container").innerHTML = "";
          document.getElementById("solution").classList.remove("visible");
          document.getElementById("show-solution-btn").textContent = "Çözümü Göster";
          document.getElementById("prev-btn").disabled = true;
          document.getElementById("next-btn").disabled = true;
          updateFullscreenInfo(null);
          saveState();
        }
  
        function displayQuestion() {
          const q = filteredQuestions[questionOrder[currentQuestionIndex]];
          const cid = cardId(q);
          const chromeState = createStudyChromeState({
            currentQuestionIndex,
            totalQuestions: filteredQuestions.length,
            subject: q.subject,
          });
  
          document.getElementById("question-text").innerHTML = window.DOMPurify.sanitize(q.q);
          document.getElementById("question-counter").textContent =
            chromeState.counterText;
          document.getElementById("subject-badge").textContent =
            chromeState.subjectText;
          document.getElementById("solution-content").innerHTML =
            window.DOMPurify.sanitize(getExplanationHtml(q).replace(/<br>/g, "<br>"));
  
          const optionsContainer = document.getElementById("options-container");
          optionsContainer.innerHTML = "";
  
          q.options.forEach((option, index) => {
            const optionDiv = document.createElement("div");
            optionDiv.className = "option";
            optionDiv.innerHTML = window.DOMPurify.sanitize(`<span class="option-label">${String.fromCharCode(65 + index)}</span><span>${option}</span>`);
  
            if (
              selectedAnswers[cid] !== undefined &&
              selectedAnswers[cid] !== null
            ) {
              if (index === q.correct) {
                optionDiv.classList.add("correct");
              } else if (index === selectedAnswers[cid]) {
                optionDiv.classList.add("wrong");
              }
            } else if (selectedAnswers[cid] === index) {
              optionDiv.classList.add("selected");
            }
  
            optionDiv.onclick = () => selectOption(index);
            optionsContainer.appendChild(optionDiv);
          });
  
          const solution = document.getElementById("solution");
          if (solutionVisible[cid]) {
            solution.classList.add("visible");
            document.getElementById("show-solution-btn").textContent =
              "Çözümü Gizle";
          } else {
            solution.classList.remove("visible");
            document.getElementById("show-solution-btn").textContent =
              "Çözümü Göster";
          }
  
          document.getElementById("prev-btn").disabled = chromeState.disablePrev;
          document.getElementById("next-btn").disabled = chromeState.disableNext;
          updateFullscreenInfo(q);
          saveState();
        }
  
        function selectOption(index) {
          const q = filteredQuestions[questionOrder[currentQuestionIndex]];
          const answerSelection = selectStudyAnswer({
            question: q,
            selectedAnswers,
            answerIndex: index,
            answerLockEnabled,
            resolveQuestionKey: cardId,
          });
  
          if (answerSelection.blocked) {
            return;
          }
  
          selectedAnswers = answerSelection.selectedAnswers;
  
          displayQuestion();
          updateScoreDisplay();
  
          if (autoAdvanceEnabled && answerSelection.answeredNow) {
            clearAutoAdvanceTimer();
            autoAdvanceTimeoutId = setTimeout(() => {
              autoAdvanceTimeoutId = null;
              if (currentQuestionIndex < filteredQuestions.length - 1) {
                nextQuestion();
              }
            }, 400);
          }
        }
  
        function toggleSolution() {
          const q = filteredQuestions[questionOrder[currentQuestionIndex]];
          const toggled = toggleStudySolution({
            question: q,
            solutionVisible,
            resolveQuestionKey: cardId,
          });
          solutionVisible = toggled.solutionVisible;
  
          const solution = document.getElementById("solution");
          const btn = document.getElementById("show-solution-btn");
  
          if (toggled.isVisible) {
            solution.classList.add("visible");
            btn.textContent = "Çözümü Gizle";
          } else {
            solution.classList.remove("visible");
            btn.textContent = "Çözümü Göster";
          }
          saveState();
        }
  
        function previousQuestion() {
          clearAutoAdvanceTimer();
          const nextIndex = getAdjacentQuestionIndex(
            currentQuestionIndex,
            filteredQuestions.length,
            -1,
          );
          if (nextIndex !== currentQuestionIndex) {
            currentQuestionIndex = nextIndex;
            runWithQuestionInstantReset(() => displayQuestion());
          }
        }
  
        function nextQuestion() {
          clearAutoAdvanceTimer();
          const nextIndex = getAdjacentQuestionIndex(
            currentQuestionIndex,
            filteredQuestions.length,
            1,
          );
          if (nextIndex !== currentQuestionIndex) {
            currentQuestionIndex = nextIndex;
            runWithQuestionInstantReset(() => displayQuestion());
          }
        }
  
        function jumpToQuestion() {
          clearAutoAdvanceTimer();
          const input = document.getElementById("jump-input");
          const questionNum = parseInt(input.value);
  
          if (questionNum >= 1 && questionNum <= filteredQuestions.length) {
            currentQuestionIndex = getBoundedQuestionIndex(
              questionNum - 1,
              filteredQuestions.length,
            );
            runWithQuestionInstantReset(() => displayQuestion());
            input.value = "";
          } else {
            alert(
              `Lütfen 1 ile ${filteredQuestions.length} arasında bir sayı girin.`,
            );
          }
        }
  
        document
          .getElementById("jump-input")
          .addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
              jumpToQuestion();
            }
          });
  
        document
          .getElementById("jump-input")
          .setAttribute("max", filteredQuestions.length);
  
        function toggleTheme(isChecked) {
          window.ThemeManager.toggleTheme({
            isChecked: isChecked,
            primaryToggleId: "theme-toggle",
            managerToggleId: "theme-toggle-manager",
            storageApi: storage,
            storageKey: "quiz-theme",
          });
        }
  
        function shuffleQuestions() {
          if (filteredQuestions.length === 0) return;
          const shuffled = shuffleQuestionOrder({ questionOrder });
          questionOrder = shuffled.questionOrder;
          currentQuestionIndex = shuffled.currentQuestionIndex;
          displayQuestion();
        }
  
        function exportPrintable() {
          const printWindow = window.open("", "_blank");
          const html = buildPrintableStudyHtml({
            title: "Çoktan Seçmeli Test",
            questions: allQuestions,
            getExplanationHtml,
          });
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
  
        function retryWrongAnswers() {
          const retriedState = createRetryWrongAnswersState({
            allQuestions,
            selectedAnswers,
            solutionVisible,
            resolveQuestionKey: cardId,
          });
  
          if (!retriedState.hasWrongQuestions) {
            alert("Yanlış cevaplanan soru bulunamadı. Önce soruları cevaplayın.");
            return;
          }
  
          filteredQuestions = retriedState.filteredQuestions;
          selectedAnswers = retriedState.selectedAnswers;
          solutionVisible = retriedState.solutionVisible;
          questionOrder = retriedState.questionOrder;
          currentQuestionIndex = retriedState.currentQuestionIndex;
          document.getElementById("topic-select").value = "hepsi";
          document
            .getElementById("jump-input")
            .setAttribute("max", filteredQuestions.length);
          saveState();
          updateScoreDisplay();
          displayQuestion();
        }
  
        function resetQuiz() {
          if (
            !confirm(
              "Seçili/aktif setlerdeki cevaplarınız ve ilerlemeniz sıfırlanacak. Emin misiniz?",
            )
          )
            return;
          const resetState = createResetStudyState({
            allQuestions,
            selectedAnswers,
            solutionVisible,
            resolveQuestionKey: cardId,
          });
  
          selectedAnswers = resetState.selectedAnswers;
          solutionVisible = resetState.solutionVisible;
          currentQuestionIndex = resetState.currentQuestionIndex;
          filteredQuestions = resetState.filteredQuestions;
          questionOrder = resetState.questionOrder;
          document.getElementById("topic-select").value = "hepsi";
  
          const jumpInput = document.getElementById("jump-input");
          if (jumpInput) jumpInput.setAttribute("max", filteredQuestions.length);
  
          saveState();
          updateScoreDisplay();
          displayQuestion();
        }
  
        function updateScoreDisplay() {
          const scoreHtml = formatScoreSummaryHtml(
            buildScoreSummary({
              allQuestions,
              selectedAnswers,
              resolveQuestionKey: cardId,
            }),
          );
          ["score-display", "fullscreen-score-display"].forEach((elementId) => {
            const scoreEl = document.getElementById(elementId);
            if (scoreEl) {
              scoreEl.innerHTML = scoreHtml;
            }
          });
        }
  
        function saveState() {
          try {
            const activeQuestion =
              filteredQuestions.length > 0
                ? filteredQuestions[questionOrder[currentQuestionIndex]]
                : null;
            const topicSelect = document.getElementById("topic-select");
            const sessionState = persistStudyState({
              storage,
              activeQuestion,
              currentQuestionIndex,
              selectedTopic: topicSelect ? topicSelect.value : "hepsi",
              selectedAnswers,
              solutionVisible,
              storageKeyPrefix: getStorageKeyPrefix(),
            });
            persistStudyTypographyPreferences({
              storage,
              questionFontSize,
              optionFontSize,
              fullscreenQuestionFontSize,
              fullscreenOptionFontSize,
              storageKeyPrefix: getStorageKeyPrefix(),
            });
            pendingSession = sessionState;
            scheduleRemoteStudyStateSync(buildCurrentStudyStateSnapshot());
          } catch (e) {
            console.error("State saving error", e);
          }
        }
  
        function loadState(storageKeyPrefix = null) {
          try {
            window.ThemeManager.initThemeFromStorage({
              primaryToggleId: "theme-toggle",
              managerToggleId: "theme-toggle-manager",
              storageApi: storage,
              storageKey: "quiz-theme",
            });
  
            const storedAnswerLock = storage.getItem(ANSWER_LOCK_KEY);
            if (storedAnswerLock === "0" || storedAnswerLock === "1") {
              answerLockEnabled = storedAnswerLock === "1";
            }
            const storedAutoAdvance = getScopedStorageItem(
              AUTO_ADVANCE_KEY,
              storageKeyPrefix,
            );
            if (storedAutoAdvance === "0" || storedAutoAdvance === "1") {
              autoAdvanceEnabled = storedAutoAdvance === "1";
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
            selectedAnswers = loadedState.selectedAnswers;
            solutionVisible = loadedState.solutionVisible;
            pendingSession = loadedState.pendingSession;
            applyTypographyState(loadedState);
          } catch (e) {
            console.error("State loading error", e);
          }
          syncAnswerLockToggleUI();
          syncAutoAdvanceToggleUI();
          syncTypographyControls();
        }
  
        function populateTopicFilter() {
          const select = document.getElementById("topic-select");
          if (!select) return;
          const subjects = collectStudySubjects(allQuestions);
          select.innerHTML = '<option value="hepsi">Tüm Başlıklar</option>';
          subjects.forEach((subject) => {
            const option = document.createElement("option");
            option.value = subject;
            option.textContent = subject;
            select.appendChild(option);
          });
        }
  
        // -- BAŞLATMA MANTIĞI --
        document.addEventListener("keydown", function (e) {
          if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")
            return;
  
          const isMainAppVisible =
            document.getElementById("main-app").style.display !== "none";
  
          if ((e.key === "f" || e.key === "F") && isMainAppVisible) {
            e.preventDefault();
            toggleFullscreen();
            return;
          }
  
          if (e.key === "Escape" && isFullscreen) {
            e.preventDefault();
            toggleFullscreen();
            return;
          }
  
          // Yalnızca main-app görünürse tuşlara izin ver
          if (!isMainAppVisible)
            return;
  
          if (e.key === "ArrowLeft") {
            previousQuestion();
          } else if (e.key === "ArrowRight") {
            nextQuestion();
          } else if (e.key === "s" || e.key === "S") {
            toggleSolution();
          } else if (e.key >= "a" && e.key <= "e") {
            selectOption(e.key.charCodeAt(0) - 97);
          } else if (e.key >= "A" && e.key <= "E") {
            selectOption(e.key.charCodeAt(0) - 65);
          }
        });
  
        window.addEventListener("beforeunload", function (event) {
          if (!editorFeature.shouldPreventUnload()) {
            return;
          }
  
          event.preventDefault();
          event.returnValue = "";
        });
  
        // İlk yüklendiğinde set listesini localStorage'dan getir
        async function initApp() {
          setManager.loadStoredSets("");
          loadState("");
          const fallbackWorkspace = captureWorkspaceSeed();
          const fallbackStudySnapshot = buildCurrentStudyStateSnapshot();
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
          renderSetList();
          desktopUpdateFeature.syncButtonState();
          desktopUpdateFeature.scheduleStartupCheck();
          googleDrive.syncDriveButtonState();
          initGoogleDrive();
        }
  
        Object.assign(window, {
          toggleSetCheck,
          deleteSet,
          toggleDeleteMode,
          selectAllSets,
          clearSetSelection,
          removeSelectedSets,
          openNewSetEditor,
          openSelectedSetEditor,
          authGoogleDrive,
          continueAsDemoAuth,
          openSetImport,
          handleFileSelect,
          signInAuth,
          signUpAuth,
          signOutAuth,
          useCloudConflictResolution,
          useLocalConflictResolution,
          startStudy,
          toggleTheme,
          setAnswerLock,
          setAutoAdvance,
          setQuestionFontSize,
          setOptionFontSize,
          setFullscreenQuestionFontSize,
          setFullscreenOptionFontSize,
          resetTypographyPreferences,
          undoLastRemoval,
          closeEditor,
          saveEditor,
          exportEditorJson,
          exportEditorSource,
          selectEditorQuestion,
          showEditorVisual,
          showEditorRaw,
          updateEditorSetName,
          updateEditorQuestionText,
          updateEditorQuestionSubject,
          updateEditorQuestionExplanation,
          updateEditorCorrectIndex,
          updateEditorOption,
          addEditorQuestion,
          duplicateCurrentEditorQuestion,
          moveCurrentEditorQuestion,
          removeCurrentEditorQuestion,
          addEditorOption,
          removeEditorOption,
          applyEditorRaw,
          filterByTopic,
          jumpToQuestion,
          showSetManager,
          shuffleQuestions,
          retryWrongAnswers,
          exportPrintable,
          resetQuiz,
          toggleAnalyticsPanel,
          closeAnalyticsPanel,
          checkDesktopUpdates,
          retryCloudSync,
          previousQuestion,
          nextQuestion,
          toggleFullscreen,
          toggleSolution,
        });
  
        window.__MCQ_TEST_HOOKS__ = Object.freeze({
          clearSyncConflictPreview() {
            clearSyncConflictState();
          },
          showSyncConflictPreview(conflictState) {
            pendingSyncConflict = conflictState;
            renderSyncConflictPanel();
          },
        });
  
        
  
  return initApp();
}

