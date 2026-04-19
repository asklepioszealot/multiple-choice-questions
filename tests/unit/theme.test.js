import { afterEach, describe, expect, it } from "vitest";
import {
  AVAILABLE_THEMES,
  ThemeManager,
  getThemeLabel,
} from "../../src/ui/theme.js";

describe("theme manager", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.body.innerHTML = "";
  });

  it("registers the flashcards-style preset collection", () => {
    expect(AVAILABLE_THEMES).toHaveLength(14);
    expect(getThemeLabel("light")).toBe("Aydınlık");
    expect(getThemeLabel("midnight")).toBe("Karanlık");
    expect(getThemeLabel("ember")).toBe("Amber");
    expect(getThemeLabel("dark")).toBe("Mavi");
    expect(getThemeLabel("midnight-galaxy")).toBe("Midnight Galaxy");
  });

  it("syncs select controls and applies preset attributes", () => {
    document.body.innerHTML = `
      <select id="theme-select-auth"></select>
      <select id="theme-select-manager"></select>
    `;

    ThemeManager.renderThemeOptions(["theme-select-auth", "theme-select-manager"]);

    expect(document.querySelectorAll("#theme-select-auth option")).toHaveLength(14);

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
