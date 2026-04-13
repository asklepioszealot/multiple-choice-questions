import { describe, expect, it } from "vitest";
import { transformLegacyIndexHtml } from "../../vite.config.mjs";

describe("vite runtime config bridge", () => {
  it("injects window.APP_CONFIG into transformed HTML", () => {
    const html = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <script src="./src/core/runtime-config.js"></script>
  </body>
</html>`;

    const transformed = transformLegacyIndexHtml(html, {
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      enableDemoAuth: true,
    });

    expect(transformed).toContain("window.APP_CONFIG = Object.freeze(");
    expect(transformed).toContain('"supabaseUrl":"https://example.supabase.co"');
    expect(transformed).toContain('"supabaseAnonKey":"anon-key"');
    expect(transformed).toContain('./src/app/vite-entry.js');
  });
});
