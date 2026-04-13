import { describe, expect, it } from "vitest";
import { createSyncStatusController } from "../../src/app/sync-status.js";

describe("sync status controller", () => {
  it("moves from syncing to synced", () => {
    const syncStatus = createSyncStatusController();

    syncStatus.markSyncing("workspace");
    syncStatus.markSynced("workspace");

    expect(syncStatus.getSnapshot()).toEqual({
      state: "synced",
      detail: "workspace",
      message: "Bulut ile esitlendi.",
      canRetry: false,
      visible: true,
    });
  });

  it("exposes retry state on error and can reset to idle", () => {
    const syncStatus = createSyncStatusController();

    syncStatus.markError("Network");
    expect(syncStatus.getSnapshot()).toEqual({
      state: "error",
      detail: "Network",
      message: "Sync hatasi: Network",
      canRetry: true,
      visible: true,
    });

    syncStatus.reset();
    expect(syncStatus.getSnapshot()).toEqual({
      state: "idle",
      detail: "",
      message: "",
      canRetry: false,
      visible: false,
    });
  });
});
