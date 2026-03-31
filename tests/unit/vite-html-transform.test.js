import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { transformLegacyIndexHtml } from "../../vite.config.mjs";

describe("transformLegacyIndexHtml", () => {
  it("replaces legacy local scripts with a single Vite module entry", () => {
    const html = readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");

    const transformed = transformLegacyIndexHtml(html);

    expect(transformed).toContain('<script type="module" src="./src/app/vite-entry.js"></script>');
    expect(transformed).not.toContain('<script src="./src/app/main.js"></script>');
    expect(transformed).not.toContain('<script src="./src/core/storage.js"></script>');
  });
});
