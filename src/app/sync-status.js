// src/app/sync-status.js
const globalScope = typeof window !== "undefined" ? window : globalThis;

function buildSnapshot(state, detail = "") {
    const normalizedDetail =
      typeof detail === "string" ? detail.trim() : String(detail || "").trim();

    if (state === "syncing") {
      return Object.freeze({
        state: "syncing",
        detail: normalizedDetail,
        message: "Bulut ile esitleniyor...",
        canRetry: false,
        visible: true,
      });
    }

    if (state === "synced") {
      return Object.freeze({
        state: "synced",
        detail: normalizedDetail,
        message: "Bulut ile esitlendi.",
        canRetry: false,
        visible: true,
      });
    }

    if (state === "error") {
      return Object.freeze({
        state: "error",
        detail: normalizedDetail,
        message: normalizedDetail
          ? `Sync hatasi: ${normalizedDetail}`
          : "Sync hatasi",
        canRetry: true,
        visible: true,
      });
    }

    return Object.freeze({
      state: "idle",
      detail: "",
      message: "",
      canRetry: false,
      visible: false,
    });
  }

  function createSyncStatusController(options = {}) {
    const onChange =
      typeof options.onChange === "function" ? options.onChange : function noop() {};

    let snapshot = buildSnapshot("idle");

    function commit(nextSnapshot) {
      snapshot = nextSnapshot;
      onChange(snapshot);
      return snapshot;
    }

    return Object.freeze({
      markSyncing(detail = "") {
        return commit(buildSnapshot("syncing", detail));
      },
      markSynced(detail = "") {
        return commit(buildSnapshot("synced", detail));
      },
      markError(detail = "") {
        return commit(buildSnapshot("error", detail));
      },
      reset() {
        return commit(buildSnapshot("idle"));
      },
      getSnapshot() {
        return snapshot;
      },
    });
  }

  const AppSyncStatus = Object.freeze({
    createSyncStatusController,
  });

  export {
    createSyncStatusController,
  };
