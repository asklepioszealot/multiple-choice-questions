// src/ui/desktop.js
// Windows masaüstü çalışma zamanı: özel titlebar, statusbar, drag&drop ve OS entegrasyonları.
import { isDesktopRuntime, isTauriRuntime } from "../core/runtime-config.js";

// MCQ-only: fc modül-seviyesi platformAdapter import eder; MCQ bağımlılıkları
// startApp'ten DI ile alır (test edilebilirlik + modüler yapı).
let desktopDeps = {};

// MCQ-only: fc şeması flashcards-app; MCQ şeması mcq-app (spec karar 1).
const DEEP_LINK_SCHEME = "mcq-app://";

function getTauri() {
  return window.__TAURI__ || null;
}

export function parseOAuthDeepLink(url) {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith(DEEP_LINK_SCHEME)) return null;
  if (!url.includes("oauth-callback")) return null;

  let paramStr = "";
  if (url.includes("#")) {
    paramStr = url.split("#")[1];
  } else if (url.includes("?")) {
    paramStr = url.split("?")[1];
  }
  if (!paramStr) return null;

  const params = new URLSearchParams(paramStr);
  const code = params.get("code");
  if (code) {
    return { kind: "pkce", code };
  }
  const accessToken = params.get("access_token");
  if (accessToken) {
    return {
      kind: "implicit",
      accessToken,
      refreshToken: params.get("refresh_token") || "",
    };
  }
  return null;
}

async function handleDesktopDeepLink(url) {
  const parsed = parseOAuthDeepLink(url);
  if (!parsed) return false;

  const adapter = typeof desktopDeps.getPlatformAdapter === "function"
    ? desktopDeps.getPlatformAdapter()
    : null;

  try {
    if (parsed.kind === "pkce" && typeof adapter?.exchangeCodeForSession === "function") {
      updateSyncIndicator("synced", "Google ile giriş yapılıyor...");
      await adapter.exchangeCodeForSession(parsed.code);
    } else if (parsed.kind === "implicit" && typeof adapter?.setSession === "function") {
      updateSyncIndicator("synced", "Google ile giriş yapılıyor...");
      await adapter.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
    } else {
      return false;
    }

    updateSyncIndicator("synced", "Giriş başarılı! Veriler yükleniyor...");
    window.location.reload();
    return true;
  } catch (err) {
    console.error("Deep link auth session restore failed:", err);
    updateSyncIndicator("error", `Giriş başarısız: ${err?.message || err}`);
    return false;
  }
}

// MCQ-only: fc native dosyaları File-like mock'lara eşler (fc:393-468); MCQ'da
// setManager.importNativeFiles native kayıtları ({path,name,contents}) doğrudan
// kabul ettiği için ek bir eşleme katmanına gerek yok.
async function importLocalFilesByPaths(paths) {
  const adapter = typeof desktopDeps.getPlatformAdapter === "function"
    ? desktopDeps.getPlatformAdapter()
    : null;
  if (
    typeof adapter?.readNativeFilesByPaths !== "function" ||
    typeof desktopDeps.importNativeFiles !== "function"
  ) {
    return;
  }

  try {
    updateSyncIndicator("synced", `${paths.length} yerel dosya okunuyor...`);
    const files = await adapter.readNativeFilesByPaths(paths);
    if (files.length > 0) {
      // MCQ-only: fc okunan dosya sayısını koşulsuz "içe aktarıldı" diye raporlar;
      // burada mesaj gerçek import sonucuna (dönen set id listesi) bağlanır.
      const importedSetIds = await desktopDeps.importNativeFiles(files);
      const importedCount = Array.isArray(importedSetIds) ? importedSetIds.length : 0;
      if (importedCount >= files.length) {
        updateSyncIndicator("synced", `${importedCount} dosya içe aktarıldı.`);
      } else {
        updateSyncIndicator(
          "error",
          `${files.length} dosyadan ${importedCount} tanesi içe aktarıldı.`,
        );
      }
    }
  } catch (err) {
    console.error("Local file import failed:", err);
    updateSyncIndicator("error", `Dosya okuma hatası: ${err?.message || err}`);
  }
}

function setupDragAndDrop(tauri) {
  const overlay = document.getElementById("desktop-dragdrop-zone");
  if (!overlay) return;

  const { listen } = tauri.event;
  listen("tauri://drag-over", () => overlay.classList.add("active")).catch(console.error);
  listen("tauri://drag-leave", () => overlay.classList.remove("active")).catch(console.error);
  listen("tauri://drag-drop", async (event) => {
    overlay.classList.remove("active");
    const paths = event.payload?.paths;
    if (Array.isArray(paths) && paths.length > 0) {
      await importLocalFilesByPaths(paths);
    }
  }).catch(console.error);
}

// MCQ-only: fc arg-parsing mantığını single-instance-args ve get_startup_args
// dinleyicilerinde iki kez tekrarlar; burada tek bir yardımcıda DRY tutulur.
function extractLaunchPayload(args) {
  const candidates = (Array.isArray(args) ? args : [])
    .slice(1)
    .filter((arg) => typeof arg === "string" && !arg.startsWith("-"));
  return {
    deepLinkUrl: candidates.find((arg) => arg.startsWith(DEEP_LINK_SCHEME)) || null,
    filePaths: candidates.filter((arg) => !arg.startsWith(DEEP_LINK_SCHEME)),
  };
}

function setupSingleInstanceArgs(tauri) {
  const { listen } = tauri.event;

  listen("single-instance-args", async (event) => {
    const { deepLinkUrl, filePaths } = extractLaunchPayload(event.payload);
    if (!deepLinkUrl && filePaths.length === 0) return;

    // MCQ-only: fc bu noktada yalnız setFocus çağırır ve ACL'de izin olmadığı
    // için sessizce düşer (pencere öne gelmez). Burada ACL izinleri verildi;
    // simge durumundaki pencere için setFocus tek başına yetmediğinden önce
    // unminimize gerekir.
    const appWindow = tauri.window.getCurrentWindow();
    await appWindow.unminimize().catch(console.error);
    await appWindow.setFocus().catch(console.error);

    if (deepLinkUrl && (await handleDesktopDeepLink(deepLinkUrl))) return;
    if (filePaths.length > 0) {
      await importLocalFilesByPaths(filePaths);
    }
  }).catch(console.error);

  // Boot argümanları: splash geçişi bitene kadar bekle (fc:366-389 kalıbı).
  setTimeout(async () => {
    try {
      const core = tauri.core;
      if (!core || typeof core.invoke !== "function") return;
      const args = await core.invoke("get_startup_args");
      const { deepLinkUrl, filePaths } = extractLaunchPayload(args);
      if (deepLinkUrl && (await handleDesktopDeepLink(deepLinkUrl))) return;
      if (filePaths.length > 0) {
        await importLocalFilesByPaths(filePaths);
      }
    } catch (err) {
      console.warn("Could not read startup arguments:", err);
    }
  }, 1500);
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
  setupDragAndDrop(tauri);
  setupSingleInstanceArgs(tauri);
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
