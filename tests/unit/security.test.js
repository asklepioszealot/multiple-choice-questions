import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../../src/core/security.js";

describe("security core module", () => {
  it("removes script tags and inline handlers while keeping allowed markup", () => {
    const output = sanitizeHtml(
      `<script>alert(1)</script><strong onclick="alert(2)">Test</strong><br><em>Safe</em>`,
    );

    expect(output).toBe("<strong>Test</strong><br><em>Safe</em>");
  });

  it("adds noopener noreferrer to blank-target links", () => {
    const output = sanitizeHtml('<a href="https://example.com" target="_blank">örnek</a>', {
      ALLOWED_TAGS: ["a"],
      ALLOWED_ATTR: ["href", "target", "rel"],
    });

    expect(output).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">örnek</a>',
    );
  });

  it("keeps safe image and audio sources while stripping unsafe media attributes", () => {
    const output = sanitizeHtml(
      [
        '<img src="https://cdn.example.com/brain.png" alt="Beyin" onclick="alert(1)" />',
        '<audio src="data:audio/mpeg;base64,QUJD" autoplay></audio>',
        '<audio src="javascript:alert(2)"></audio>',
      ].join(""),
    );

    expect(output).toContain(
      '<img src="https://cdn.example.com/brain.png" alt="Beyin" loading="lazy">',
    );
    expect(output).toContain(
      '<audio src="data:audio/mpeg;base64,QUJD" controls="" preload="metadata"></audio>',
    );
    expect(output).not.toContain("onclick");
    expect(output).not.toContain("autoplay");
    expect(output).not.toContain("javascript:");
  });
});
