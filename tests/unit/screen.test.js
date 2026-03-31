import { describe, expect, it } from "vitest";
import { showScreen } from "../../src/app/screen.js";

describe("showScreen", () => {
  it("shows the manager and hides the study container when requested", () => {
    document.body.innerHTML = `
      <section id="set-manager" style="display:none"></section>
      <main id="main-app" style="display:block"></main>
    `;

    showScreen("manager");

    expect(document.getElementById("set-manager").style.display).toBe("block");
    expect(document.getElementById("main-app").style.display).toBe("none");
  });
});
