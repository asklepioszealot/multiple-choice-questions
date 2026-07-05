import { beforeEach, describe, expect, it } from "vitest";
import { renderAppVersionChip } from "../../src/app/version-chip.js";

describe("renderAppVersionChip", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="app-version-chip"></span>
      <span id="statusbar-version-chip"></span>`;
  });

  it("versiyonu vX.Y.Z formatında her iki chip'e yazar", () => {
    renderAppVersionChip({ version: "0.1.0" });
    expect(document.getElementById("app-version-chip").textContent).toBe("v0.1.0");
    expect(document.getElementById("statusbar-version-chip").textContent).toBe("v0.1.0");
  });

  it("versiyon yok/unknown ise dev yazar", () => {
    renderAppVersionChip({ version: "unknown" });
    expect(document.getElementById("app-version-chip").textContent).toBe("dev");
    renderAppVersionChip(null);
    expect(document.getElementById("app-version-chip").textContent).toBe("dev");
  });

  it("chip elementi yoksa hata fırlatmaz", () => {
    document.body.innerHTML = "";
    expect(() => renderAppVersionChip({ version: "0.1.0" })).not.toThrow();
  });
});
