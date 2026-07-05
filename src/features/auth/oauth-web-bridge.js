// src/features/auth/oauth-web-bridge.js
// Web'e düşen Supabase OAuth callback'ini masaüstü deep link'ine köprüler.
// MCQ-only: fc bu mantığı bootstrap içinde tutar; MCQ test için ayrı modüle alır.
const DEEP_LINK_TARGET = "mcq-app://oauth-callback";

// Varsayım: bu origin'de görülen bir "?code=" query parametresi yalnızca Supabase
// PKCE OAuth callback'inden gelir. OAuth dışı bir "?code=" (ör. başka bir özellik)
// bu sayfayı yanlışlıkla tetikleyebilir; kabul edilmiş bir risk, fc ile aynı.
export function detectOAuthCallbackSuffix({ hash = "", search = "" } = {}) {
  const hasImplicitTokens =
    hash.includes("access_token=") || hash.includes("refresh_token=");
  const hasPkceCode = /[?&]code=/.test(search);
  if (!hasImplicitTokens && !hasPkceCode) {
    return null;
  }
  return hasImplicitTokens ? hash : search;
}

export function maybeRedirectOAuthCallback({ windowRef = window, documentRef = document } = {}) {
  if (!windowRef || windowRef.__TAURI__) {
    return false;
  }

  const suffix = detectOAuthCallbackSuffix({
    hash: windowRef.location?.hash || "",
    search: windowRef.location?.search || "",
  });
  if (!suffix) {
    return false;
  }

  // Bu sayfa tema sistemi dışında, bağımsız bir ekran: index.html'in app-booting
  // sınıfı ve gövde kenar boşlukları burada anlamsız kalır, kaldırılır/sıfırlanır.
  documentRef.body.classList.remove("app-booting");
  documentRef.body.style.margin = "0";
  documentRef.body.style.padding = "0";
  documentRef.body.innerHTML = buildRedirectMarkup();
  const redirect = () => {
    windowRef.location.href = DEEP_LINK_TARGET + suffix;
  };
  documentRef.getElementById("open-app-btn")?.addEventListener("click", redirect);
  redirect();
  return true;
}

// MCQ-only: fc'nin taşınabilir (portable) sürüm uyarısı burada yok; MCQ yalnızca
// NSIS kurulum paketi olarak dağıtılıyor, bu yüzden yardım metni sadeleştirildi.
function buildRedirectMarkup() {
  return `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #0f172a;
          color: #f8fafc;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          margin: 0;
          padding: 20px;
          text-align: center;
        ">
          <div style="
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            padding: 40px;
            max-width: 450px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          ">
            <!-- Glassy glowing gradient ball behind logo -->
            <div style="
              width: 72px;
              height: 72px;
              border-radius: 50%;
              background: linear-gradient(135deg, #3b82f6, #8b5cf6);
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px auto;
              box-shadow: 0 0 30px rgba(139, 92, 246, 0.4);
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: white;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>

            <h2 style="font-size: 24px; font-weight: 700; margin: 0 0 12px 0; background: linear-gradient(to right, #3b82f6, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              Giriş Başarılı!
            </h2>
            <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 28px 0;">
              Oturumunuz başarıyla doğrulandı. Masaüstü uygulamanıza güvenli bir şekilde yönlendiriliyorsunuz...
            </p>

            <button id="open-app-btn" style="
              width: 100%;
              padding: 14px 24px;
              border-radius: 12px;
              border: none;
              background: linear-gradient(135deg, #3b82f6, #2563eb);
              color: white;
              font-weight: 600;
              font-size: 15px;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
              transition: all 0.2s ease;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(37, 99, 235, 0.4)';"
               onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(37, 99, 235, 0.3)';">
              Uygulamayı Aç
            </button>

            <div style="
              margin-top: 24px;
              padding-top: 20px;
              border-top: 1px solid rgba(255, 255, 255, 0.06);
              font-size: 12px;
              color: #64748b;
              text-align: left;
              line-height: 1.6;
            ">
              <span style="font-weight: 600; color: #94a3b8; display: block; margin-bottom: 6px;">Uygulama otomatik açılmadı mı?</span>
              Tarayıcınızın üst kısmında çıkabilecek <strong>"Çoktan Seçmeli Sorular uygulamasını aç"</strong> iznine veya açılır pencere (popup) uyarısına izin verdiğinizden emin olun.
            </div>
          </div>
        </div>
      `;
}
