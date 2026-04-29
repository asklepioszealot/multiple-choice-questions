import { describe, expect, it } from "vitest";
import {
  buildRuntimeConfigFileContent,
  makeRuntimeConfig,
  transformLegacyIndexHtml,
} from "../../vite.config.mjs";

describe("vite runtime config bridge", () => {
  it("injects an external runtime-config.js script into transformed HTML", () => {
    const html = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <script src="./src/core/runtime-config.js"></script>
  </body>
</html>`;

    const transformed = transformLegacyIndexHtml(html);

    expect(transformed).toContain('<script src="./runtime-config.js"></script>');
    expect(transformed).not.toMatch(/<script>\s*window\.APP_CONFIG/);
    expect(transformed).toContain("./src/app/vite-entry.js");
  });

  it("does not duplicate the runtime-config.js tag when already present", () => {
    const html = `<!doctype html>
<html>
  <head>
    <script src="./runtime-config.js"></script>
  </head>
  <body>
    <script type="module" src="./src/app/vite-entry.js"></script>
  </body>
</html>`;

    const transformed = transformLegacyIndexHtml(html);
    const matches = transformed.match(/runtime-config\.js/g) || [];

    expect(matches).toHaveLength(1);
  });

  it("serializes runtime config into the standalone bridge file", () => {
    const content = buildRuntimeConfigFileContent({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      enableDemoAuth: true,
    });

    expect(content).toContain("window.APP_CONFIG = Object.freeze(");
    expect(content).toContain('"supabaseUrl":"https://example.supabase.co"');
    expect(content).toContain('"supabaseAnonKey":"anon-key"');
  });

  it("reads documented Vite Supabase env keys", () => {
    const config = makeRuntimeConfig({
      VITE_SUPABASE_URL: "https://vite-env.supabase.co",
      VITE_SUPABASE_ANON_KEY: "vite-anon-key",
    });

    expect(config).toMatchObject({
      supabaseUrl: "https://vite-env.supabase.co",
      supabaseAnonKey: "vite-anon-key",
      authMode: "supabase",
    });
  });
});
