import {
  createRemoteWorkspaceSeed,
  detectSyncConflict,
} from "./conflict-resolution.js";
import { renderSyncConflictPanel } from "./sync-conflict-ui.js";
import {
  persistStudyStateSnapshot,
  pickNewerStudyStateSnapshot,
} from "../study-state/study-state.js";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSyncErrorMessage(error) {
  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : "Bilinmeyen hata";
  return message.replace(/\.$/, "");
}

export function createSyncOrchestration(deps) {
  const {
    storage,
    platformAdapter,
    authFeature,
    syncStatus,
    setManager,
    desktopUpdateFeature,
    documentRef = document,
    setTimeoutRef = window.setTimeout.bind(window),
    clearTimeoutRef = window.clearTimeout.bind(window),
    consoleRef = console,
    // Callbacks to bootstrap-owned state
    getCurrentStudyStateSnapshot,
    applyStudyStateSnapshot,
    resetStudyState,
    renderSetList,
    hasMeaningfulStudyStateSnapshot,
    loadLocalStudyState,
  } = deps;

  let lastSyncRetryDescriptor = null;
  let allowTestSyncStatusPreview = false;
  let pendingSyncConflict = null;
  let remoteStudyStateSyncTimeoutId = null;
  let pendingRemoteStudyStateSnapshot = null;

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

  function isSyncStatusActive() {
    return isRemoteWorkspaceActive() || allowTestSyncStatusPreview;
  }

  function renderSyncStatus(snapshot = syncStatus.getSnapshot()) {
    const syncStatusEl = documentRef.getElementById("sync-status");
    const retryButton = documentRef.getElementById("sync-retry-btn");

    if (!syncStatusEl || !retryButton) {
      return;
    }

    if (!isSyncStatusActive() || !snapshot?.visible) {
      syncStatusEl.textContent = "";
      syncStatusEl.className = "sync-status";
      syncStatusEl.style.display = "none";
      retryButton.style.display = "none";
      retryButton.disabled = true;
      desktopUpdateFeature.syncButtonState();
      return;
    }

    syncStatusEl.textContent = snapshot.message;
    syncStatusEl.className = `sync-status ${snapshot.state}`;
    syncStatusEl.style.display = "inline-flex";
    retryButton.style.display = snapshot.canRetry ? "inline-flex" : "none";
    retryButton.disabled = snapshot.canRetry !== true;
    const retryLabel = snapshot.retryLabel || "Sync";
    retryButton.textContent = snapshot.isRetrying
      ? `${retryLabel} yeniden deneniyor...`
      : `${retryLabel} tekrar dene`;
    retryButton.setAttribute(
      "aria-label",
      snapshot.isRetrying
        ? `${retryLabel} yeniden deneniyor`
        : `${retryLabel} tekrar dene`,
    );
    desktopUpdateFeature.syncButtonState();
  }

  function markSyncing(detail = "") {
    if (!isSyncStatusActive()) {
      renderSyncStatus(syncStatus.reset());
      return;
    }

    renderSyncStatus(
      syncStatus.markSyncing(detail, {
        retryLabel:
          lastSyncRetryDescriptor?.isRetrying === true
            ? lastSyncRetryDescriptor.label
            : "",
        isRetrying: lastSyncRetryDescriptor?.isRetrying === true,
      }),
    );
  }

  function markSynced(detail = "") {
    if (!isSyncStatusActive()) {
      renderSyncStatus(syncStatus.reset());
      return;
    }

    lastSyncRetryDescriptor = null;
    renderSyncStatus(syncStatus.markSynced(detail));
  }

  function createRetryDescriptor(kind, label, run) {
    if (typeof run !== "function") {
      return null;
    }

    return {
      kind: typeof kind === "string" && kind.trim() ? kind.trim() : "workspace",
      label: typeof label === "string" && label.trim() ? label.trim() : "Sync",
      run,
      isRetrying: false,
    };
  }

  function markSyncError(error, retryDescriptor = null) {
    if (!isSyncStatusActive()) {
      renderSyncStatus(syncStatus.reset());
      return;
    }

    lastSyncRetryDescriptor =
      retryDescriptor && typeof retryDescriptor.run === "function"
        ? retryDescriptor
        : null;
    renderSyncStatus(
      syncStatus.markError(normalizeSyncErrorMessage(error), {
        retryLabel: lastSyncRetryDescriptor?.label || "",
      }),
    );
  }

  async function retryCloudSync() {
    if (!isSyncStatusActive()) {
      renderSyncStatus(syncStatus.reset());
      return null;
    }

    if (lastSyncRetryDescriptor && typeof lastSyncRetryDescriptor.run === "function") {
      if (lastSyncRetryDescriptor.isRetrying) {
        return null;
      }

      lastSyncRetryDescriptor.isRetrying = true;
      renderSyncStatus(
        syncStatus.markSyncing(lastSyncRetryDescriptor.kind, {
          retryLabel: lastSyncRetryDescriptor.label,
          isRetrying: true,
        }),
      );

      try {
        return await lastSyncRetryDescriptor.run();
      } finally {
        if (lastSyncRetryDescriptor) {
          lastSyncRetryDescriptor.isRetrying = false;
        }
      }
    }

    return loadSyncedWorkspace({
      fallbackWorkspace: captureWorkspaceSeed(),
      fallbackStudySnapshot: getCurrentStudyStateSnapshot(),
    });
  }

  function captureWorkspaceSeed() {
    return {
      loadedSets: cloneJson(setManager.getLoadedSets()),
      selectedSetIds: [...setManager.getSelectedSetIds()],
    };
  }

  function hasWorkspaceSeed(seed) {
    return Boolean(seed && Object.keys(seed.loadedSets || {}).length > 0);
  }

  function hasPendingSyncConflict() {
    return Boolean(pendingSyncConflict);
  }

  function renderConflictPanel() {
    renderSyncConflictPanel(pendingSyncConflict, documentRef);
  }

  function clearSyncConflictState() {
    pendingSyncConflict = null;
    renderConflictPanel();
  }

  function applyWorkspaceSeed(seed, options = {}) {
    setManager.replaceLoadedSets(Object.values(seed?.loadedSets || {}), {
      selectedSetIds: seed?.selectedSetIds || [],
      storageKeyPrefix: options.storageKeyPrefix ?? null,
    });
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
      markSyncError(
        error,
        createRetryDescriptor("sets", "Setler", () => saveRemoteSetRecord(setRecord)),
      );
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
      markSyncError(
        error,
        createRetryDescriptor("sets", "Setler", () => deleteRemoteSetRecords(setIds)),
      );
      throw error;
    }
  }

  function clearRemoteStudyStateSyncTimer() {
    if (remoteStudyStateSyncTimeoutId) {
      clearTimeoutRef(remoteStudyStateSyncTimeoutId);
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
      consoleRef.error("Remote study-state sync error", error);
      pendingRemoteStudyStateSnapshot = snapshotToSync;
      markSyncError(
        error,
        createRetryDescriptor(
          "study-state",
          "Ilerleme",
          async function retryPendingStudyStateSync() {
            pendingRemoteStudyStateSnapshot = snapshotToSync;
            return flushRemoteStudyStateSync();
          },
        ),
      );
    }
  }

  function scheduleRemoteStudyStateSync(snapshot = getCurrentStudyStateSnapshot()) {
    if (
      !isRemoteWorkspaceActive() ||
      typeof platformAdapter.saveUserState !== "function"
    ) {
      return;
    }

    pendingRemoteStudyStateSnapshot = snapshot;
    clearRemoteStudyStateSyncTimer();
    remoteStudyStateSyncTimeoutId = setTimeoutRef(() => {
      remoteStudyStateSyncTimeoutId = null;
      void flushRemoteStudyStateSync();
    }, 600);
  }

  function handleSelectionChanged() {
    scheduleRemoteStudyStateSync(getCurrentStudyStateSnapshot());
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
    loadLocalStudyState(userPrefix);

    const userScopedWorkspace = captureWorkspaceSeed();
    const userScopedSnapshot = hasMeaningfulStudyStateSnapshot(
      getCurrentStudyStateSnapshot(),
    )
      ? getCurrentStudyStateSnapshot()
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
      consoleRef.error("Remote set load error", error);
      syncLoadFailed = true;
      markSyncError(
        error,
        createRetryDescriptor("workspace", "Calisma alani", () =>
          loadSyncedWorkspace(options),
        ),
      );
    }

    if (remoteRecords.length === 0 && hasWorkspaceSeed(localWorkspaceSeed)) {
      try {
        remoteRecords = await seedRemoteWorkspaceFromSeed(localWorkspaceSeed);
      } catch (error) {
        consoleRef.error("Remote set seed error", error);
        syncLoadFailed = true;
        markSyncError(
          error,
          createRetryDescriptor("workspace", "Calisma alani", () =>
            loadSyncedWorkspace(options),
          ),
        );
      }
    }

    let remoteSnapshot = null;

    try {
      remoteSnapshot =
        typeof platformAdapter.loadUserState === "function"
          ? await platformAdapter.loadUserState()
          : null;
    } catch (error) {
      consoleRef.error("Remote study-state load error", error);
      syncLoadFailed = true;
      markSyncError(
        error,
        createRetryDescriptor("workspace", "Calisma alani", () =>
          loadSyncedWorkspace(options),
        ),
      );
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
          consoleRef.error("Remote reconciliation upload error", error);
          syncLoadFailed = true;
          markSyncError(
            error,
            createRetryDescriptor("workspace", "Calisma alani", () =>
              loadSyncedWorkspace(options),
            ),
          );
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
        renderConflictPanel();
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
      markSyncError(
        error,
        createRetryDescriptor(
          "workspace",
          "Calisma alani",
          useLocalConflictResolution,
        ),
      );
      renderConflictPanel();
      throw error;
    }
  }

  function resetRetryStateOnAuthChange() {
    lastSyncRetryDescriptor = null;
  }

  function resetPendingStudyStateOnSignOut() {
    pendingRemoteStudyStateSnapshot = null;
    lastSyncRetryDescriptor = null;
  }

  // Test hooks
  const testHooks = Object.freeze({
    clearSyncConflictPreview() {
      clearSyncConflictState();
    },
    getSyncStatusSnapshot() {
      return syncStatus.getSnapshot();
    },
    setSyncRetryPreview({ detail = "", label = "Sync", run, delayMs = 60 } = {}) {
      allowTestSyncStatusPreview = true;
      const retryRun =
        typeof run === "function"
          ? run
          : async () => {
              window.__MCQ_SYNC_RETRY_RUNS__ =
                Number(window.__MCQ_SYNC_RETRY_RUNS__ || 0) + 1;
              await new Promise((resolve) => setTimeoutRef(resolve, delayMs));
              markSynced("calisma alani");
              return true;
            };
      lastSyncRetryDescriptor = createRetryDescriptor("workspace", label, retryRun);
      markSyncError(new Error(detail || "Test retry"), lastSyncRetryDescriptor);
    },
    showSyncConflictPreview(conflictState) {
      pendingSyncConflict = conflictState;
      renderConflictPanel();
    },
  });

  return {
    // Storage scoping
    getStorageKeyPrefix,
    buildScopedStorageKey,
    getScopedStorageItem,
    setScopedStorageItem,

    // Status
    isRemoteWorkspaceActive,
    isSyncStatusActive,
    renderSyncStatus,
    markSyncing,
    markSynced,
    markSyncError,
    createRetryDescriptor,
    retryCloudSync,

    // Workspace
    captureWorkspaceSeed,
    hasWorkspaceSeed,
    applyWorkspaceSeed,

    // Conflict
    hasPendingSyncConflict,
    renderSyncConflictPanel: renderConflictPanel,
    clearSyncConflictState,

    // Remote operations
    saveRemoteSetRecord,
    deleteRemoteSetRecords,
    scheduleRemoteStudyStateSync,
    clearRemoteStudyStateSyncTimer,
    handleSelectionChanged,
    loadSyncedWorkspace,
    useCloudConflictResolution,
    useLocalConflictResolution,

    // Lifecycle
    resetRetryStateOnAuthChange,
    resetPendingStudyStateOnSignOut,

    // Test hooks
    testHooks,
  };
}
