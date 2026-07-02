import { afterEach, describe, expect, it } from "vitest";
import {
  AVAILABLE_THEMES,
  ThemeManager,
  getThemeLabel,
} from "../../src/ui/theme.js";

describe("theme manager", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-color-scheme");
    document.body.innerHTML = "";
  });

  it("registers the flashcards-style preset collection", () => {
    expect(AVAILABLE_THEMES).toHaveLength(13);
    expect(getThemeLabel("light")).toBe("AYDINLIK");
    expect(getThemeLabel("midnight")).toBe("KARANLIK");
    expect(getThemeLabel("ember")).toBe("AMBER");
    expect(getThemeLabel("dark")).toBe("MAVI");
    // midnight-galaxy kaldırıldı; bilinmeyen tema adları light'a düşer.
    expect(getThemeLabel("midnight-galaxy")).toBe("AYDINLIK");
  });

  it("syncs select controls and applies preset attributes", () => {
    document.body.innerHTML = `
      <select id="theme-select-auth"></select>
      <select id="theme-select-manager"></select>
    `;

    ThemeManager.renderThemeOptions(["theme-select-auth", "theme-select-manager"]);

    expect(document.querySelectorAll("#theme-select-auth option")).toHaveLength(13);

    const appliedTheme = ThemeManager.setTheme({
      themeName: "ember",
      controlIds: ["theme-select-auth", "theme-select-manager"],
    });

    expect(appliedTheme).toBe("ember");
    expect(document.getElementById("theme-select-auth").value).toBe("ember");
    expect(document.getElementById("theme-select-manager").value).toBe("ember");
    expect(document.documentElement.getAttribute("data-theme")).toBe("ember");
  });
});
