(function attachAuthShell(globalScope) {
  "use strict";

  const AUTH_SESSION_KEY = "mc_auth_session";
  const DEMO_SESSION = Object.freeze({
    mode: "demo",
    userId: "demo-user",
    displayName: "Demo Modu",
  });

  function createAuthFeature({
    storage,
    platformAdapter,
    getRuntimeConfig,
    hasSupabaseConfig,
    showScreen,
    documentRef = globalScope.document,
  }) {
    const storageRef =
      storage ||
      {
        getItem() {
          return null;
        },
        setItem() {},
        removeItem() {},
      };
    const platformAdapterRef =
      platformAdapter ||
      {
        type: "local-demo",
        supportsPasswordAuth: false,
        getRememberMePreference() {
          return true;
        },
        setRememberMePreference() {
          return true;
        },
        async getCurrentUser() {
          return null;
        },
        async signIn() {
          throw new Error("Şifre ile giriş kullanılamıyor.");
        },
        async signUp() {
          throw new Error("Kayıt oluşturma kullanılamıyor.");
        },
        async signOut() {
          return null;
        },
      };
    const getRuntimeConfigRef =
      typeof getRuntimeConfig === "function"
        ? getRuntimeConfig
        : function fallbackGetRuntimeConfig() {
            return { enableDemoAuth: true };
          };
    const hasSupabaseConfigRef =
      typeof hasSupabaseConfig === "function"
        ? hasSupabaseConfig
        : function fallbackHasSupabaseConfig() {
            return false;
          };
    const showScreenRef =
      typeof showScreen === "function"
        ? showScreen
        : function fallbackShowScreen() {};

    let authSession = null;
    let statusMessage = "";
    let statusTone = "";

    function readStoredValue(key) {
      if (typeof storageRef.getLocalItem === "function") {
        return storageRef.getLocalItem(key);
      }

      return storageRef.getItem(key);
    }

    function writeStoredValue(key, value) {
      if (typeof storageRef.setLocalItem === "function") {
        storageRef.setLocalItem(key, value);
        return;
      }

      storageRef.setItem(key, value);
    }

    function removeStoredValue(key) {
      if (typeof storageRef.removeLocalItem === "function") {
        storageRef.removeLocalItem(key);
        return;
      }

      storageRef.removeItem(key);
    }

    function isDemoAuthEnabled() {
      return getRuntimeConfigRef()?.enableDemoAuth !== false;
    }

    function isPasswordAuthEnabled() {
      return Boolean(
        hasSupabaseConfigRef() && platformAdapterRef.supportsPasswordAuth === true,
      );
    }

    function getRememberMePreference() {
      if (typeof platformAdapterRef.getRememberMePreference === "function") {
        return platformAdapterRef.getRememberMePreference() !== false;
      }

      return true;
    }

    function setRememberMePreference(nextValue) {
      if (typeof platformAdapterRef.setRememberMePreference === "function") {
        return platformAdapterRef.setRememberMePreference(nextValue);
      }

      return nextValue !== false;
    }

    function readAuthFieldValue(elementId) {
      return String(documentRef?.getElementById(elementId)?.value || "");
    }

    function readRememberMeFromForm() {
      return documentRef?.getElementById("auth-remember-me")?.checked !== false;
    }

    function setStatus(message, tone = "") {
      statusMessage = message || "";
      statusTone = tone || "";
      const statusEl = documentRef?.getElementById("auth-status");

      if (!statusEl) {
        return;
      }

      statusEl.textContent = statusMessage;
      statusEl.className = statusTone
        ? `auth-status ${statusTone}`
        : "auth-status";
    }

    function normalizeAuthSession(rawValue) {
      if (!rawValue) {
        return null;
      }

      try {
        const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
        if (!parsed || typeof parsed !== "object" || parsed.mode !== "demo") {
          return null;
        }

        return {
          mode: "demo",
          userId: typeof parsed.userId === "string" && parsed.userId.trim()
            ? parsed.userId
            : DEMO_SESSION.userId,
          displayName:
            typeof parsed.displayName === "string" && parsed.displayName.trim()
              ? parsed.displayName
              : DEMO_SESSION.displayName,
          signedInAt:
            typeof parsed.signedInAt === "string" && parsed.signedInAt.trim()
              ? parsed.signedInAt
              : "",
        };
      } catch {
        return null;
      }
    }

    function createSupabaseSession(user) {
      if (!user || typeof user !== "object") {
        return null;
      }

      const userId =
        typeof user.id === "string" && user.id.trim() ? user.id.trim() : "";
      if (!userId) {
        return null;
      }

      const email =
        typeof user.email === "string" && user.email.trim()
          ? user.email.trim()
          : "";
      const metadataName =
        typeof user.user_metadata?.display_name === "string" &&
        user.user_metadata.display_name.trim()
          ? user.user_metadata.display_name.trim()
          : "";

      return {
        mode: "supabase",
        userId,
        email,
        displayName: metadataName || email || "Hesap",
        signedInAt:
          typeof user.last_sign_in_at === "string" && user.last_sign_in_at.trim()
            ? user.last_sign_in_at.trim()
            : "",
      };
    }

    function getAuthSession() {
      return authSession;
    }

    function hasActiveSession() {
      return Boolean(authSession);
    }

    async function loadAuthSession() {
      const storedDemoSession = normalizeAuthSession(readStoredValue(AUTH_SESSION_KEY));
      authSession = storedDemoSession;

      if (!storedDemoSession) {
        removeStoredValue(AUTH_SESSION_KEY);
      }

      if (isPasswordAuthEnabled()) {
        const currentUser = await platformAdapterRef.getCurrentUser();
        const supabaseSession = createSupabaseSession(currentUser);
        if (supabaseSession) {
          authSession = supabaseSession;
        }
      }

      return authSession;
    }

    function buildAuthScreenMessage() {
      if (isPasswordAuthEnabled() && isDemoAuthEnabled()) {
        return "Hesabınla giriş yapabilir veya demo modu ile devam edebilirsin.";
      }

      if (isPasswordAuthEnabled()) {
        return "Cloud çalışma alanına erişmek için hesabınla giriş yap.";
      }

      if (isDemoAuthEnabled()) {
        return "Çalışmana devam etmek için demo modu ile giriş yap.";
      }

      return "Giriş gerekmiyor. Uygulama doğrudan set yöneticisine açılacak.";
    }

    function syncAuthUi() {
      const demoButton = documentRef?.getElementById("demo-auth-btn");
      const signInButton = documentRef?.getElementById("auth-signin-btn");
      const signUpButton = documentRef?.getElementById("auth-signup-btn");
      const emailInput = documentRef?.getElementById("auth-email");
      const passwordInput = documentRef?.getElementById("auth-password");
      const rememberMeInput = documentRef?.getElementById("auth-remember-me");
      const rememberMeLabel = documentRef?.getElementById("auth-remember-label");
      const messageEl = documentRef?.getElementById("auth-screen-message");
      const statusBadge = documentRef?.getElementById("auth-status-badge");
      const logoutButton = documentRef?.getElementById("auth-logout-btn");
      const authScreen = documentRef?.getElementById("auth-screen");
      const passwordAuthEnabled = isPasswordAuthEnabled();

      if (demoButton) {
        demoButton.style.display = isDemoAuthEnabled() ? "inline-flex" : "none";
      }

      [signInButton, signUpButton, emailInput, passwordInput, rememberMeInput].forEach(
        (element) => {
          if (!element) return;
          element.style.display = passwordAuthEnabled ? "inline-flex" : "none";
        },
      );

      if (rememberMeLabel) {
        rememberMeLabel.style.display = passwordAuthEnabled ? "inline-flex" : "none";
      }

      if (rememberMeInput) {
        rememberMeInput.checked = getRememberMePreference();
      }

      if (messageEl) {
        messageEl.textContent = buildAuthScreenMessage();
      }

      if (statusBadge) {
        if (authSession) {
          statusBadge.textContent = authSession.displayName;
          statusBadge.style.display = "inline-flex";
        } else {
          statusBadge.textContent = "";
          statusBadge.style.display = "none";
        }
      }

      if (logoutButton) {
        logoutButton.style.display = authSession ? "inline-flex" : "none";
      }

      if (authScreen) {
        authScreen.dataset.authMode = passwordAuthEnabled ? "supabase" : "demo";
      }

      setStatus(statusMessage, statusTone);
    }

    function persistAuthSession(nextSession) {
      authSession = nextSession;
      if (nextSession && nextSession.mode === "demo") {
        writeStoredValue(AUTH_SESSION_KEY, JSON.stringify(nextSession));
      } else {
        removeStoredValue(AUTH_SESSION_KEY);
      }
      syncAuthUi();
      return authSession;
    }

    function continueAsDemo() {
      const nextSession = {
        ...DEMO_SESSION,
        signedInAt: new Date().toISOString(),
      };

      persistAuthSession(nextSession);
      setStatus("", "");
      showScreenRef("manager");
      return nextSession;
    }

    async function attemptPasswordAuth(action) {
      if (!isPasswordAuthEnabled()) {
        setStatus("Bu yapılandırmada hesap girişi kullanılamıyor.", "error");
        return null;
      }

      const email = readAuthFieldValue("auth-email");
      const password = readAuthFieldValue("auth-password");
      const rememberMe = readRememberMeFromForm();
      setRememberMePreference(rememberMe);

      try {
        setStatus(
          action === "signup" ? "Hesap oluşturuluyor..." : "Giriş yapılıyor...",
        );

        if (action === "signup") {
          const result = await platformAdapterRef.signUp(email, password, {
            rememberMe,
          });

          if (result?.needsConfirmation) {
            setStatus(
              "Kayıt oluşturuldu. E-posta doğrulaması gerekebilir.",
              "success",
            );
            return null;
          }

          const signedUpSession = createSupabaseSession(result?.user || result);
          if (!signedUpSession) {
            setStatus("Hesap oluşturuldu.", "success");
            return null;
          }

          persistAuthSession(signedUpSession);
          setStatus("", "");
          showScreenRef("manager");
          return signedUpSession;
        }

        const user = await platformAdapterRef.signIn(email, password, {
          rememberMe,
        });
        const signedInSession = createSupabaseSession(user);
        if (!signedInSession) {
          throw new Error("Giriş oturumu başlatılamadı.");
        }

        persistAuthSession(signedInSession);
        setStatus("", "");
        showScreenRef("manager");
        return signedInSession;
      } catch (error) {
        setStatus(error?.message || "Giriş başarısız oldu.", "error");
        return null;
      }
    }

    async function signOut() {
      if (authSession?.mode === "supabase") {
        await platformAdapterRef.signOut();
      }

      persistAuthSession(null);
      setStatus("", "");
      showScreenRef(resolveInitialScreen());
      return null;
    }

    function resolveInitialScreen() {
      if (hasActiveSession()) {
        return "manager";
      }

      if (isDemoAuthEnabled() || isPasswordAuthEnabled()) {
        return "auth";
      }

      return "manager";
    }

    function requireAuth() {
      if (hasActiveSession()) {
        return true;
      }

      if (resolveInitialScreen() === "auth") {
        syncAuthUi();
        showScreenRef("auth");
        return false;
      }

      return true;
    }

    return Object.freeze({
      continueAsDemo,
      attemptPasswordAuth,
      getAuthSession,
      hasActiveSession,
      loadAuthSession,
      requireAuth,
      resolveInitialScreen,
      signOut,
      syncAuthUi,
    });
  }

  const AppAuthShell = Object.freeze({
    createAuthFeature,
  });

  globalScope.AppAuthShell = AppAuthShell;

  if (typeof exports !== "undefined") {
    exports.createAuthFeature = createAuthFeature;
    exports.AppAuthShell = AppAuthShell;
    exports.default = AppAuthShell;
  }
})(typeof window !== "undefined" ? window : globalThis);
