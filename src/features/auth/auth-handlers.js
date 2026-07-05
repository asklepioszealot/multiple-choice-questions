export function createAuthHandlers({
  authFeature,
  syncStatus,
  resetRetryStateOnAuthChange,
  clearSyncConflictState,
  renderSyncStatus,
  captureWorkspaceSeed,
  loadSyncedWorkspace,
  clearRemoteStudyStateSyncTimer,
  clearAutoAdvanceTimer,
  resetPendingStudyStateOnSignOut,
  setManager,
  googleDrive,
  loadState,
  renderSetList,
  buildCurrentStudyStateSnapshot,
  confirmEditorNavigation,
  getIsFullscreen,
  toggleFullscreen,
}) {
  function continueAsDemoAuth() {
    resetRetryStateOnAuthChange();
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

  async function googleAuth() {
    return authFeature.attemptGoogleAuth();
  }

  async function signOutAuth() {
    if (
      !confirmEditorNavigation(
        "Kaydedilmemiş değişiklikler var. Çıkış yaparsan editör değişiklikleri kaybolacak. Devam etmek istiyor musun?",
        "Kaydedilmemiş değişiklikler korunuyor.",
      )
    ) {
      return false;
    }

    clearAutoAdvanceTimer();
    clearRemoteStudyStateSyncTimer();
    resetPendingStudyStateOnSignOut();
    clearSyncConflictState();
    if (getIsFullscreen()) {
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

  return Object.freeze({
    continueAsDemoAuth,
    googleAuth,
    signInAuth,
    signOutAuth,
    signUpAuth,
  });
}
