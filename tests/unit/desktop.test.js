import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initDesktopIntegrations, updateSyncIndicator } from "../../src/ui/desktop.js";

function buildChromeDom() {
  document.body.innerHTML = `
    <div id="desktop-titlebar" class="desktop-titlebar">
      <div class="titlebar-drag-region"><span class="titlebar-title">Çoktan Seçmeli Sorular</span></div>
      <div class="titlebar-controls">
        <button id="titlebar-minimize" type="button"></button>
        <button id="titlebar-maximize" type="button"></button>
        <button id="titlebar-close" type="button"></button>
      </div>
    </div>
    <div id="desktop-statusbar">
      <span id="sync-indicator-led" class="statusbar-indicator"></span>
      <span id="sync-status-text"></span>
      <span id="statusbar-version-chip"></span>
      <button id="sync-now-btn" type="button">Şimdi Senkronize Et</button>
    </div>
    <div id="desktop-dragdrop-zone"></div>`;
}

function buildFakeWindow() {
  return {
    minimize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    toggleMaximize: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockResolvedValue(false),
    isFullscreen: vi.fn().mockResolvedValue(false),
    setFullscreen: vi.fn().mockResolvedValue(undefined),
    startDragging: vi.fn().mockResolvedValue(undefined),
    onResized: vi.fn().mockResolvedValue(() => {}),
    setFocus: vi.fn().mockResolvedValue(undefined),
  };
}

function installFakeTauri(fakeWindow) {
  window.__TAURI__ = {
    core: { invoke: vi.fn().mockResolvedValue([]) },
    window: { getCurrentWindow: () => fakeWindow },
    event: { listen: vi.fn().mockResolvedValue(() => {}) },
  };
}

describe("initDesktopIntegrations", () => {
  beforeEach(() => {
    buildChromeDom();
    document.documentElement.className = "";
    document.body.className = "";
  });

  afterEach(() => {
    delete window.__TAURI__;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("Tauri yokken hiçbir class eklemez", () => {
    initDesktopIntegrations();
    expect(document.body.classList.contains("tauri-desktop")).toBe(false);
  });

  it("masaüstü Tauri'de chrome class'larını ekler ve butonları bağlar", async () => {
    const fakeWindow = buildFakeWindow();
    installFakeTauri(fakeWindow);
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0" });

    initDesktopIntegrations();

    expect(document.documentElement.classList.contains("tauri-desktop-html")).toBe(true);
    expect(document.body.classList.contains("tauri-desktop")).toBe(true);

    document.getElementById("titlebar-minimize").click();
    expect(fakeWindow.minimize).toHaveBeenCalled();

    document.getElementById("titlebar-close").click();
    expect(fakeWindow.close).toHaveBeenCalled();

    document.getElementById("titlebar-maximize").click();
    await Promise.resolve();
    expect(fakeWindow.toggleMaximize).toHaveBeenCalled();
  });

  it("F11 fullscreen toggle'ı setFullscreen çağırır", async () => {
    const fakeWindow = buildFakeWindow();
    installFakeTauri(fakeWindow);
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0" });

    initDesktopIntegrations();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F11" }));
    await Promise.resolve();
    await Promise.resolve();
    expect(fakeWindow.setFullscreen).toHaveBeenCalledWith(true);
  });

  it("drag region dblclick maximize tetikler", async () => {
    const fakeWindow = buildFakeWindow();
    installFakeTauri(fakeWindow);
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0" });

    initDesktopIntegrations();
    document.querySelector(".titlebar-drag-region")
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await Promise.resolve();
    expect(fakeWindow.toggleMaximize).toHaveBeenCalled();
  });

  it("Android UA'da pencere kontrolleri bağlanmaz", () => {
    const fakeWindow = buildFakeWindow();
    installFakeTauri(fakeWindow);
    vi.stubGlobal("navigator", { userAgent: "Linux; Android 14" });

    initDesktopIntegrations();
    expect(document.body.classList.contains("tauri-desktop")).toBe(true);
    document.getElementById("titlebar-minimize").click();
    expect(fakeWindow.minimize).not.toHaveBeenCalled();
  });
});

describe("updateSyncIndicator", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="sync-indicator-led" class="statusbar-indicator"></span>
      <span id="sync-status-text"></span>`;
  });

  it("synced/offline/error durum class'larını uygular", () => {
    updateSyncIndicator("synced", "Eşitlendi.");
    expect(document.getElementById("sync-indicator-led").className)
      .toBe("statusbar-indicator status-synced");
    expect(document.getElementById("sync-status-text").textContent).toBe("Eşitlendi.");

    updateSyncIndicator("offline");
    expect(document.getElementById("sync-indicator-led").className)
      .toBe("statusbar-indicator status-offline");

    updateSyncIndicator("error", "Hata");
    expect(document.getElementById("sync-indicator-led").className)
      .toBe("statusbar-indicator status-error");
  });
});

describe("setupSyncIndicators (sync-now butonu)", () => {
  afterEach(() => {
    delete window.__TAURI__;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("onSyncNow deps ile çağrılır, buton busy durumuna girer-çıkar", async () => {
    buildChromeDom();
    const fakeWindow = buildFakeWindow();
    installFakeTauri(fakeWindow);
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0" });
    let resolveSync;
    const onSyncNow = vi.fn(() => new Promise((resolve) => { resolveSync = resolve; }));

    initDesktopIntegrations({ onSyncNow });
    const syncBtn = document.getElementById("sync-now-btn");
    syncBtn.click();
    await Promise.resolve();
    expect(onSyncNow).toHaveBeenCalled();
    expect(syncBtn.disabled).toBe(true);
    resolveSync();
    await Promise.resolve();
    await Promise.resolve();
    expect(syncBtn.disabled).toBe(false);
  });
});
