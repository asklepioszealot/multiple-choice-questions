import { describe, expect, it, vi } from "vitest";
import { createSyncStatusController } from "../../src/app/sync-status.js";
import { createSyncOrchestration } from "../../src/features/sync/sync-orchestration.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function createOrchestration(platformAdapterOverrides = {}) {
  const timers = [];
  const platformAdapter = {
    supportsRemoteSync: true,
    saveUserState: vi.fn(async (snapshot) => snapshot),
    loadSets: vi.fn(() => new Promise(() => {})),
    ...platformAdapterOverrides,
  };
  const deps = {
    storage: createMemoryStorage(),
    platformAdapter,
    authFeature: { getAuthSession: () => ({ mode: "supabase", userId: "user-1" }) },
    syncStatus: createSyncStatusController(),
    setManager: {
      loadStoredSets: vi.fn(),
      getLoadedSets: () => ({}),
      getSelectedSetIds: () => [],
    },
    desktopUpdateFeature: { syncButtonState: vi.fn() },
    documentRef: document,
    setTimeoutRef: vi.fn((callback) => {
      timers.push(callback);
      return timers.length;
    }),
    clearTimeoutRef: vi.fn(),
    consoleRef: { error: vi.fn() },
    getCurrentStudyStateSnapshot: () => ({ selectedSetIds: ["a"] }),
    applyStudyStateSnapshot: vi.fn(),
    resetStudyState: vi.fn(),
    renderSetList: vi.fn(),
    hasMeaningfulStudyStateSnapshot: () => false,
    loadLocalStudyState: vi.fn(),
  };
  return { orchestration: createSyncOrchestration(deps), deps, platformAdapter };
}

describe("sync orchestration", () => {
  it("bekleyen ilerlemeyi debounce'u beklemeden gönderir ve zamanlayıcıyı iptal eder", async () => {
    const { orchestration, deps, platformAdapter } = createOrchestration();
    const snapshot = { selectedSetIds: ["set-1"] };

    orchestration.scheduleRemoteStudyStateSync(snapshot);
    expect(platformAdapter.saveUserState).not.toHaveBeenCalled();

    await orchestration.flushPendingRemoteStudyStateSync();

    expect(deps.clearTimeoutRef).toHaveBeenCalled();
    expect(platformAdapter.saveUserState).toHaveBeenCalledTimes(1);
    expect(platformAdapter.saveUserState).toHaveBeenCalledWith(snapshot);

    await orchestration.flushPendingRemoteStudyStateSync();
    expect(platformAdapter.saveUserState).toHaveBeenCalledTimes(1);
  });

  it("bulut yanıtını beklemeden kullanıcının yerel setlerini çizer", () => {
    const { orchestration, deps } = createOrchestration();

    void orchestration.loadSyncedWorkspace();

    expect(deps.setManager.loadStoredSets).toHaveBeenCalledWith("mc_user::user-1");
    expect(deps.renderSetList).toHaveBeenCalledTimes(1);
  });
});
