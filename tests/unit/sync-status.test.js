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
      retryLabel: "",
      isRetrying: false,
      message: "Bulut ile eşitlendi.",
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
      retryLabel: "",
      isRetrying: false,
      message: "Sync hatası: Network",
      canRetry: true,
      visible: true,
    });

    syncStatus.reset();
    expect(syncStatus.getSnapshot()).toEqual({
      state: "idle",
      detail: "",
      retryLabel: "",
      isRetrying: false,
      message: "",
      canRetry: false,
      visible: false,
    });
  });

  it("includes retry metadata in error snapshot", () => {
    const syncStatus = createSyncStatusController();

    syncStatus.markError("Network", {
      retryLabel: "Setler",
    });

    expect(syncStatus.getSnapshot()).toEqual({
      state: "error",
      detail: "Network",
      retryLabel: "Setler",
      isRetrying: false,
      message: "Sync hatası: Network",
      canRetry: true,
      visible: true,
    });
  });

  it("shows retry-specific syncing message while retry is running", () => {
    const syncStatus = createSyncStatusController();

    syncStatus.markSyncing("sets", {
      retryLabel: "Setler",
      isRetrying: true,
    });

    expect(syncStatus.getSnapshot()).toEqual({
      state: "syncing",
      detail: "sets",
      retryLabel: "Setler",
      isRetrying: true,
      message: "Setler yeniden deneniyor...",
      canRetry: false,
      visible: true,
    });
  });
});
