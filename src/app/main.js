// src/app/main.js
import { startApp } from "./bootstrap.js";

document.addEventListener("DOMContentLoaded", () => {
  startApp().catch((error) => {
    console.error("Uygulama başlatılırken kritik hata:", error);
    const splashEl = document.getElementById("splash-screen");
    if (splashEl) {
      splashEl.innerHTML = `<div style="color:var(--danger, red); text-align:center; padding:2rem;">
        Opps! Uygulama başlatılamadı.<br>${error.message}
      </div>`;
    }
    document.body.classList.remove("app-booting");
    const splash = document.getElementById("app-splash");
    if (splash) {
      const finalize = () => splash.classList.add("is-removed");
      splash.addEventListener("transitionend", finalize, { once: true });
      setTimeout(finalize, 800);
    }
  });
});
