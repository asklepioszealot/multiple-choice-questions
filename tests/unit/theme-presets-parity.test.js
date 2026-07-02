import { describe, expect, it } from "vitest";
import {
  AVAILABLE_THEMES,
  ORDERED_THEMES,
  THEME_PRESETS,
  THEME_VARIABLE_NAMES,
  getThemePreset,
} from "../../src/ui/theme-presets.js";

const EXPECTED_THEME_IDS = [
  "light", "midnight", "ember", "dark", "ocean-depths", "sunset-boulevard",
  "forest-canopy", "modern-minimalist", "golden-hour", "arctic-frost",
  "desert-rose", "tech-innovation", "botanical-garden",
];

// MCQ'ya özgü cevap-geri-bildirim değişkenleri: parite portunda korunmak zorunda.
const MCQ_ONLY_VARIABLES = [
  "--color-correct", "--color-correct-hover",
  "--color-wrong", "--color-wrong-hover",
];

describe("theme presets parity", () => {
  it("flashcards ile birebir aynı 13 temayı tanımlar", () => {
    expect([...AVAILABLE_THEMES].sort()).toEqual([...EXPECTED_THEME_IDS].sort());
  });

  it("midnight-galaxy kaldırıldı ve light'a düşüyor", () => {
    expect(AVAILABLE_THEMES).not.toContain("midnight-galaxy");
    expect(getThemePreset("midnight-galaxy")).toBe(THEME_PRESETS.light);
  });

  it("her tema tam değişken setini tanımlar (base anahtar seti)", () => {
    for (const themeName of AVAILABLE_THEMES) {
      const preset = THEME_PRESETS[themeName];
      const keys = Object.keys(preset.variables);
      for (const varName of THEME_VARIABLE_NAMES) {
        expect(keys, `${themeName} eksik: ${varName}`).toContain(varName);
      }
    }
  });

  it("MCQ'ya özgü correct/wrong değişkenleri her temada var", () => {
    for (const themeName of AVAILABLE_THEMES) {
      const keys = Object.keys(THEME_PRESETS[themeName].variables);
      for (const varName of MCQ_ONLY_VARIABLES) {
        expect(keys, `${themeName} eksik: ${varName}`).toContain(varName);
      }
    }
  });

  it("zengin token grupları base'de tanımlı", () => {
    for (const varName of [
      "--screen-glow", "--screen-wash", "--shell-shadow", "--header-shadow",
      "--card-shadow", "--auth-panel-start", "--auth-panel-end", "--auth-panel-glow",
      "--hl-yellow", "--hl-green", "--hl-red", "--hl-blue", "--hl-purple", "--hl-default",
      "--markdown-quote-bg", "--markdown-table-head-bg", "--markdown-warning-bg",
      "--editor-sidebar-base", "--color-card-front", "--color-card-back",
    ]) {
      expect(THEME_VARIABLE_NAMES).toContain(varName);
    }
  });

  it("ORDERED_THEMES sortGroup/sortIndex sırasını izler", () => {
    expect(ORDERED_THEMES[0]).toBe("light");
    expect(ORDERED_THEMES[1]).toBe("midnight");
    expect(ORDERED_THEMES).toHaveLength(EXPECTED_THEME_IDS.length);
  });
});
