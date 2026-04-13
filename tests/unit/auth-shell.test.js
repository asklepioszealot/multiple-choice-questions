import { describe, expect, it, vi } from "vitest";
import { createAuthFeature } from "../../src/features/auth/auth-shell.js";

function createMemoryStorage(seed = {}) {
  const localStore = new Map(Object.entries(seed.local || {}));
  const sessionStore = new Map(Object.entries(seed.session || {}));

  return {
    getItem(key) {
      return localStore.has(key) ? localStore.get(key) : null;
    },
    setItem(key, value) {
      localStore.set(key, String(value));
    },
    removeItem(key) {
      localStore.delete(key);
    },
    getLocalItem(key) {
      return localStore.has(key) ? localStore.get(key) : null;
    },
    setLocalItem(key, value) {
      localStore.set(key, String(value));
    },
    removeLocalItem(key) {
      localStore.delete(key);
    },
    getSessionItem(key) {
      return sessionStore.has(key) ? sessionStore.get(key) : null;
    },
    setSessionItem(key, value) {
      sessionStore.set(key, String(value));
    },
    removeSessionItem(key) {
      sessionStore.delete(key);
    },
  };
}

function renderAuthDom() {
  document.body.innerHTML = `
    <section id="auth-screen" style="display:none">
      <input id="auth-email" />
      <input id="auth-password" />
      <input id="auth-remember-me" type="checkbox" />
      <button id="auth-signin-btn">Giris yap</button>
      <button id="auth-signup-btn">Kayit ol</button>
      <button id="demo-auth-btn">Demo ile devam et</button>
      <p id="auth-screen-message"></p>
      <p id="auth-status"></p>
    </section>
    <section id="set-manager" style="display:none"></section>
    <main id="main-app" style="display:none"></main>
    <span id="auth-status-badge" style="display:none"></span>
    <button id="auth-logout-btn" style="display:none">Çıkış yap</button>
  `;
}

describe("auth shell feature", () => {
  it("requires auth when demo mode is enabled and no saved session exists", () => {
    renderAuthDom();
    const showScreen = vi.fn();
    const auth = createAuthFeature({
      storage: createMemoryStorage(),
      getRuntimeConfig() {
        return { enableDemoAuth: true };
      },
      hasSupabaseConfig() {
        return false;
      },
      showScreen,
      documentRef: document,
    });

    auth.loadAuthSession();
    auth.syncAuthUi();

    expect(auth.getAuthSession()).toBeNull();
    expect(auth.resolveInitialScreen()).toBe("auth");
    expect(document.getElementById("auth-status-badge").style.display).toBe("none");
    expect(document.getElementById("auth-logout-btn").style.display).toBe("none");
  });

  it("persists a demo session, restores it after reload, and signs out cleanly", () => {
    renderAuthDom();
    const storage = createMemoryStorage();
    const showScreen = vi.fn();
    const auth = createAuthFeature({
      storage,
      getRuntimeConfig() {
        return { enableDemoAuth: true };
      },
      hasSupabaseConfig() {
        return false;
      },
      showScreen,
      documentRef: document,
    });

    const session = auth.continueAsDemo();

    expect(session.mode).toBe("demo");
    expect(showScreen).toHaveBeenCalledWith("manager");
    expect(JSON.parse(storage.getLocalItem("mc_auth_session"))).toMatchObject({
      mode: "demo",
      displayName: "Demo Modu",
    });

    renderAuthDom();
    const restoredShowScreen = vi.fn();
    const restoredAuth = createAuthFeature({
      storage,
      getRuntimeConfig() {
        return { enableDemoAuth: true };
      },
      hasSupabaseConfig() {
        return false;
      },
      showScreen: restoredShowScreen,
      documentRef: document,
    });

    restoredAuth.loadAuthSession();
    restoredAuth.syncAuthUi();

    expect(restoredAuth.resolveInitialScreen()).toBe("manager");
    expect(document.getElementById("auth-status-badge").textContent).toContain(
      "Demo Modu",
    );
    expect(document.getElementById("auth-logout-btn").style.display).toBe(
      "inline-flex",
    );

    restoredAuth.signOut();

    expect(storage.getLocalItem("mc_auth_session")).toBeNull();
    expect(restoredShowScreen).toHaveBeenCalledWith("auth");
    expect(restoredAuth.getAuthSession()).toBeNull();
  });

  it("shows password auth controls when Supabase config is available", () => {
    renderAuthDom();
    const auth = createAuthFeature({
      storage: createMemoryStorage(),
      platformAdapter: {
        type: "supabase-web",
        supportsPasswordAuth: true,
        supportsDemoAuth: false,
        supportsRemoteSync: true,
        getRememberMePreference() {
          return true;
        },
      },
      getRuntimeConfig() {
        return { enableDemoAuth: false };
      },
      hasSupabaseConfig() {
        return true;
      },
      showScreen() {},
      documentRef: document,
    });

    auth.syncAuthUi();

    expect(document.getElementById("auth-signin-btn").style.display).toBe(
      "inline-flex",
    );
    expect(document.getElementById("auth-signup-btn").style.display).toBe(
      "inline-flex",
    );
    expect(document.getElementById("demo-auth-btn").style.display).toBe("none");
    expect(document.getElementById("auth-remember-me").checked).toBe(true);
  });

  it("signs in with Supabase adapter and transitions to the manager screen", async () => {
    renderAuthDom();
    const showScreen = vi.fn();
    const signIn = vi.fn(async () => ({
      id: "user-1",
      email: "doctor@example.com",
    }));
    const auth = createAuthFeature({
      storage: createMemoryStorage(),
      platformAdapter: {
        type: "supabase-web",
        supportsPasswordAuth: true,
        supportsDemoAuth: false,
        supportsRemoteSync: true,
        getRememberMePreference() {
          return false;
        },
        setRememberMePreference: vi.fn(),
        signIn,
      },
      getRuntimeConfig() {
        return { enableDemoAuth: false };
      },
      hasSupabaseConfig() {
        return true;
      },
      showScreen,
      documentRef: document,
    });

    document.getElementById("auth-email").value = "doctor@example.com";
    document.getElementById("auth-password").value = "secret";
    document.getElementById("auth-remember-me").checked = false;

    const session = await auth.attemptPasswordAuth("signin");

    expect(signIn).toHaveBeenCalledWith("doctor@example.com", "secret", {
      rememberMe: false,
    });
    expect(session).toMatchObject({
      mode: "supabase",
      userId: "user-1",
      displayName: "doctor@example.com",
    });
    expect(showScreen).toHaveBeenCalledWith("manager");
    expect(document.getElementById("auth-status-badge").textContent).toContain(
      "doctor@example.com",
    );
  });
});
