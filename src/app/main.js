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
  });
});
