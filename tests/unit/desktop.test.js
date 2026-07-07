import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initDesktopIntegrations, parseOAuthDeepLink, updateSyncIndicator } from "../../src/ui/desktop.js";

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
    unminimize: vi.fn().mockResolvedValue(undefined),
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

  it("single-instance dosya forwarding pencereyi öne getirir ve gerçek import sonucunu raporlar", async () => {
    const fakeWindow = buildFakeWindow();
    installFakeTauri(fakeWindow);
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0" });

    const readNativeFilesByPaths = vi.fn().mockResolvedValue([
      { name: "a.json", path: "C:\\f\\a.json", contents: "{}" },
      { name: "b.apkg", path: "C:\\f\\b.apkg" },
    ]);
    // Yalnız 1/2 dosya import edilebildi: mesaj error durumuna düşmeli.
    const importNativeFiles = vi.fn().mockResolvedValue(["a"]);

    initDesktopIntegrations({
      getPlatformAdapter: () => ({ readNativeFilesByPaths }),
      importNativeFiles,
    });

    const listenCalls = window.__TAURI__.event.listen.mock.calls;
    const handler = listenCalls.find(([name]) => name === "single-instance-args")?.[1];
    expect(typeof handler).toBe("function");

    await handler({ payload: ["app.exe", "C:\\f\\a.json", "C:\\f\\b.apkg"] });

    expect(fakeWindow.unminimize).toHaveBeenCalled();
    expect(fakeWindow.setFocus).toHaveBeenCalled();
    expect(importNativeFiles).toHaveBeenCalledWith([
      { name: "a.json", path: "C:\\f\\a.json", contents: "{}" },
      { name: "b.apkg", path: "C:\\f\\b.apkg" },
    ]);
    expect(document.getElementById("sync-status-text").textContent).toBe(
      "2 dosyadan 1 tanesi içe aktarıldı.",
    );

    // Tam başarı: standart mesaj korunur.
    importNativeFiles.mockResolvedValue(["a", "b"]);
    await handler({ payload: ["app.exe", "C:\\f\\a.json", "C:\\f\\b.apkg"] });
    expect(document.getElementById("sync-status-text").textContent).toBe(
      "2 dosya içe aktarıldı.",
    );
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

describe("parseOAuthDeepLink", () => {
  it("PKCE code'unu çözer", () => {
    expect(parseOAuthDeepLink("mcq-app://oauth-callback?code=abc123"))
      .toEqual({ kind: "pkce", code: "abc123" });
  });

  it("implicit token'ları çözer", () => {
    expect(parseOAuthDeepLink("mcq-app://oauth-callback#access_token=tok&refresh_token=ref"))
      .toEqual({ kind: "implicit", accessToken: "tok", refreshToken: "ref" });
  });

  it("refresh token'sız implicit çözer", () => {
    expect(parseOAuthDeepLink("mcq-app://oauth-callback#access_token=tok"))
      .toEqual({ kind: "implicit", accessToken: "tok", refreshToken: "" });
  });

  it("farklı şemayı ve oauth-callback olmayan yolu reddeder", () => {
    expect(parseOAuthDeepLink("flashcards-app://oauth-callback?code=x")).toBeNull();
    expect(parseOAuthDeepLink("mcq-app://other?code=x")).toBeNull();
    expect(parseOAuthDeepLink(null)).toBeNull();
    expect(parseOAuthDeepLink("mcq-app://oauth-callback")).toBeNull();
  });
});
