// src/ui/desktop.js
// Windows masaüstü çalışma zamanı: özel titlebar, statusbar, drag&drop ve OS entegrasyonları.
import { isDesktopRuntime, isTauriRuntime } from "../core/runtime-config.js";

// MCQ-only: fc modül-seviyesi platformAdapter import eder; MCQ bağımlılıkları
// startApp'ten DI ile alır (test edilebilirlik + modüler yapı).
let desktopDeps = {};

function getTauri() {
  return window.__TAURI__ || null;
}

export function initDesktopIntegrations(deps = {}) {
  if (!isTauriRuntime()) {
    return;
  }
  desktopDeps = deps || {};

  document.documentElement.classList.add("tauri-desktop-html");
  document.body.classList.add("tauri-desktop");

  if (!isDesktopRuntime()) {
    // Android kurulumları Faz 3'te ayrıca ele alınacak.
    return;
  }

  const tauri = getTauri();
  if (!tauri || !tauri.window || typeof tauri.window.getCurrentWindow !== "function") {
    return;
  }

  const { getCurrentWindow } = tauri.window;
  const appWindow = getCurrentWindow();
  let maximizeInFlight = false;

  async function toggleWindowMaximize() {
    if (maximizeInFlight) return;
    maximizeInFlight = true;
    try {
      await appWindow.toggleMaximize();
      await syncMaximizedClass(appWindow);
    } catch (err) {
      console.error("Window maximize toggle failed:", err);
    } finally {
      maximizeInFlight = false;
    }
  }

  // Özel titlebar pencere kontrollerini bağla
  const minBtn = document.getElementById("titlebar-minimize");
  const maxBtn = document.getElementById("titlebar-maximize");
  const closeBtn = document.getElementById("titlebar-close");

  if (minBtn) {
    minBtn.addEventListener("click", () => {
      appWindow.minimize().catch(console.error);
    });
  }

  if (maxBtn) {
    maxBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void toggleWindowMaximize();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      appWindow.close().catch(console.error);
    });
  }

  // Pencere sürükleme ve çift tıklama ile ekranı kaplama. Küçük bir işaretçi
  // hareketi beklenir, böylece düz bir çift tıklama native sürükleme
  // döngüsü tarafından yutulmaz.
  setupTitlebarDragAndMaximize(appWindow, toggleWindowMaximize);

  // F11 tam ekran geçişini bağla (özel titlebar'ı CSS class ile gizler)
  setupFullscreenToggle(appWindow);

  // Ekranı kaplama durumunu CSS kancaları için body class'ına yansıt.
  syncMaximizedClass(appWindow);
  try {
    if (typeof appWindow.onResized === "function") {
      appWindow.onResized(() => syncMaximizedClass(appWindow)).catch(console.error);
    }
  } catch (err) {
    console.error("onResized wire-up failed:", err);
  }

  setupSyncIndicators();
}

export function updateSyncIndicator(status, text) {
  const led = document.getElementById("sync-indicator-led");
  const label = document.getElementById("sync-status-text");
  if (!led || !label) return;

  led.className = "statusbar-indicator";
  if (status === "synced") {
    led.classList.add("status-synced");
  } else if (status === "offline") {
    led.classList.add("status-offline");
  } else {
    led.classList.add("status-error");
  }

  if (text) {
    label.textContent = text;
  }
}

function setupSyncIndicators() {
  const syncBtn = document.getElementById("sync-now-btn");
  if (!syncBtn) return;

  syncBtn.addEventListener("click", async () => {
    // MCQ-only: fc study-state'ten loadUserWorkspace import eder; MCQ sync
    // orkestrasyonunun loadSyncedWorkspace'i DI ile gelir.
    if (typeof desktopDeps.onSyncNow !== "function") {
      updateSyncIndicator("error", "Senkronizasyon köprüsü hazır değil.");
      return;
    }

    syncBtn.disabled = true;
    const originalText = syncBtn.textContent;
    syncBtn.textContent = "Senkronize ediliyor...";
    updateSyncIndicator("synced", "Bulut senkronizasyonu başlatıldı...");

    try {
      await desktopDeps.onSyncNow();
      updateSyncIndicator("synced", "Bulut senkronizasyonu tamamlandı.");
    } catch (err) {
      console.error("Sync failed:", err);
      updateSyncIndicator("error", `Senkronizasyon hatası: ${err?.message || "Bilinmeyen hata"}`);
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = originalText;
    }
  });

  window.addEventListener("online", () => {
    updateSyncIndicator("synced", "İnternet bağlantısı sağlandı. Eşitleniyor...");
    syncBtn.click();
  });

  window.addEventListener("offline", () => {
    updateSyncIndicator("offline", "Çevrimdışı çalışılıyor. Değişiklikler yerel olarak kaydedilecek.");
  });

  if (!navigator.onLine) {
    updateSyncIndicator("offline", "Çevrimdışı çalışılıyor. Değişiklikler yerel olarak kaydedilecek.");
  }
}

function setupTitlebarDragAndMaximize(appWindow, toggleWindowMaximize) {
  const dragRegion = document.querySelector(".titlebar-drag-region");
  if (!dragRegion) return;

  let dragCandidate = null;
  const canStartDragging = typeof appWindow.startDragging === "function";
  const dragThresholdPx = 5;
  const isInteractiveTarget = (target) =>
    Boolean(target?.closest?.("button, a, input, select, textarea, [role='button'], [contenteditable='true']"));

  dragRegion.addEventListener("pointerdown", (event) => {
    if (!canStartDragging || event.button !== 0 || isInteractiveTarget(event.target)) return;
    dragCandidate = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  });

  dragRegion.addEventListener("pointermove", (event) => {
    if (!dragCandidate || dragCandidate.pointerId !== event.pointerId) return;
    const deltaX = Math.abs(event.clientX - dragCandidate.x);
    const deltaY = Math.abs(event.clientY - dragCandidate.y);
    if (deltaX < dragThresholdPx && deltaY < dragThresholdPx) return;

    dragCandidate = null;
    appWindow.startDragging().catch((err) => {
      console.error("Window dragging failed:", err);
    });
  });

  const clearDragCandidate = (event) => {
    if (!dragCandidate || event.pointerId == null || dragCandidate.pointerId === event.pointerId) {
      dragCandidate = null;
    }
  };

  dragRegion.addEventListener("pointerup", clearDragCandidate);
  dragRegion.addEventListener("pointercancel", clearDragCandidate);
  dragRegion.addEventListener("lostpointercapture", clearDragCandidate);
  dragRegion.addEventListener("dblclick", (event) => {
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    dragCandidate = null;
    void toggleWindowMaximize();
  });
}

async function syncMaximizedClass(appWindow) {
  try {
    const isMax = await appWindow.isMaximized();
    document.body.classList.toggle("tauri-desktop-maximized", isMax);
  } catch (err) {
    console.error("Maximize state sync failed:", err);
  }
}

// F11 native tam ekranı geçiş yapar; CSS class özel titlebar'ı buna uyumlu gizler.
function setupFullscreenToggle(appWindow) {
  let toggling = false;
  async function toggleFullscreen() {
    if (toggling) return;
    toggling = true;
    try {
      const isFs = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!isFs);
      document.body.classList.toggle("tauri-desktop-fullscreen", !isFs);
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    } finally {
      toggling = false;
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      void toggleFullscreen();
    }
  });
}
