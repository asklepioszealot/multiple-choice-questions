import {
  DEFAULT_STUDY_TYPOGRAPHY,
  MAX_STUDY_FONT_SIZE,
  MIN_STUDY_FONT_SIZE,
} from "./constants.js";

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

export function escapeMarkup(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeStudyTypographyPreferences(preferences = {}) {
  return {
    questionFontSize: clampNumber(
      preferences.questionFontSize,
      MIN_STUDY_FONT_SIZE,
      MAX_STUDY_FONT_SIZE,
      DEFAULT_STUDY_TYPOGRAPHY.questionFontSize,
    ),
    optionFontSize: clampNumber(
      preferences.optionFontSize,
      MIN_STUDY_FONT_SIZE,
      MAX_STUDY_FONT_SIZE,
      DEFAULT_STUDY_TYPOGRAPHY.optionFontSize,
    ),
    fullscreenQuestionFontSize: clampNumber(
      preferences.fullscreenQuestionFontSize,
      MIN_STUDY_FONT_SIZE,
      MAX_STUDY_FONT_SIZE,
      DEFAULT_STUDY_TYPOGRAPHY.fullscreenQuestionFontSize,
    ),
    fullscreenOptionFontSize: clampNumber(
      preferences.fullscreenOptionFontSize,
      MIN_STUDY_FONT_SIZE,
      MAX_STUDY_FONT_SIZE,
      DEFAULT_STUDY_TYPOGRAPHY.fullscreenOptionFontSize,
    ),
  };
}
