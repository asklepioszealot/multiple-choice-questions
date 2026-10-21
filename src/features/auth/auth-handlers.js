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

  async function runSignInAttempt(attempt) {
    const fallbackWorkspace = captureWorkspaceSeed();
    const fallbackStudySnapshot = buildCurrentStudyStateSnapshot();
    const session = await attempt();
    if (session) {
      await loadSyncedWorkspace({
        fallbackWorkspace,
        fallbackStudySnapshot,
      });
      renderSetList();
    }
    return session;
  }

  async function signInAuth() {
    return runSignInAttempt(() => authFeature.attemptPasswordAuth("signin"));
  }

  async function signUpAuth() {
    return runSignInAttempt(() => authFeature.attemptPasswordAuth("signup"));
  }

  async function googleAuth() {
    // Masaüstünde null döner (oturum deep link ile gelir); Android'de oturum hemen açılır.
    return runSignInAttempt(() => authFeature.attemptGoogleAuth());
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
