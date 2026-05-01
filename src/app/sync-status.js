// src/app/sync-status.js
const globalScope = typeof window !== "undefined" ? window : globalThis;

function buildStatusMessage(state, detail = "", retryLabel = "", isRetrying = false) {
    if (state === "syncing" && isRetrying && retryLabel) {
      return `${retryLabel} yeniden deneniyor...`;
    }

    if (state === "syncing") {
      return "Bulut ile eşitleniyor...";
    }

    if (state === "synced") {
      return "Bulut ile eşitlendi.";
    }

    if (state === "error") {
      return detail ? `Sync hatası: ${detail}` : "Sync hatası";
    }

    return "";
  }

  function buildSnapshot(state, detail = "", options = {}) {
    const normalizedDetail =
      typeof detail === "string" ? detail.trim() : String(detail || "").trim();
    const retryLabel =
      typeof options.retryLabel === "string" ? options.retryLabel.trim() : "";
    const isRetrying = options.isRetrying === true;

    if (state === "syncing" || state === "synced" || state === "error") {
      return Object.freeze({
        state,
        detail: normalizedDetail,
        retryLabel,
        isRetrying,
        message: buildStatusMessage(state, normalizedDetail, retryLabel, isRetrying),
        canRetry: state === "error" && !isRetrying,
        visible: true,
      });
    }

    return Object.freeze({
      state: "idle",
      detail: "",
      retryLabel: "",
      isRetrying: false,
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
      markSyncing(detail = "", options = {}) {
        return commit(buildSnapshot("syncing", detail, options));
      },
      markSynced(detail = "", options = {}) {
        return commit(buildSnapshot("synced", detail, options));
      },
      markError(detail = "", options = {}) {
        return commit(buildSnapshot("error", detail, options));
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
