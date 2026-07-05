import { afterEach, describe, expect, it } from "vitest";
import {
  detectOAuthCallbackSuffix,
  maybeRedirectOAuthCallback,
} from "../../src/features/auth/oauth-web-bridge.js";

afterEach(() => {
  document.body.className = "";
  document.body.style.margin = "";
  document.body.style.padding = "";
});

describe("detectOAuthCallbackSuffix", () => {
  it("implicit hash'i yakalar", () => {
    expect(detectOAuthCallbackSuffix({ hash: "#access_token=t&refresh_token=r", search: "" }))
      .toBe("#access_token=t&refresh_token=r");
  });

  it("PKCE query'sini yakalar", () => {
    expect(detectOAuthCallbackSuffix({ hash: "", search: "?code=abc" })).toBe("?code=abc");
  });

  it("callback yoksa null döner", () => {
    expect(detectOAuthCallbackSuffix({ hash: "#section", search: "?tab=1" })).toBeNull();
    expect(detectOAuthCallbackSuffix({ hash: "", search: "" })).toBeNull();
  });

  it("hem implicit hash hem PKCE code varken hash öncelik kazanır", () => {
    expect(
      detectOAuthCallbackSuffix({
        hash: "#access_token=t&refresh_token=r",
        search: "?code=abc",
      }),
    ).toBe("#access_token=t&refresh_token=r");
  });
});

describe("maybeRedirectOAuthCallback", () => {
  it("Tauri içinde hiçbir şey yapmaz", () => {
    const windowRef = { __TAURI__: {}, location: { hash: "#access_token=t", search: "" } };
    expect(maybeRedirectOAuthCallback({ windowRef, documentRef: document })).toBe(false);
  });

  it("web'de callback varsa redirect UI çizer ve deep link'e yönlendirir", () => {
    const assignments = [];
    const windowRef = {
      location: {
        hash: "#access_token=t",
        search: "",
        get href() { return ""; },
        set href(value) { assignments.push(value); },
      },
    };
    const handled = maybeRedirectOAuthCallback({ windowRef, documentRef: document });
    expect(handled).toBe(true);
    expect(assignments[0]).toBe("mcq-app://oauth-callback#access_token=t");
    expect(document.getElementById("open-app-btn")).toBeTruthy();
  });

  it("app-booting sınıfını kaldırır ve gövde kenar boşluklarını sıfırlar", () => {
    document.body.className = "app-booting";
    const windowRef = {
      location: {
        hash: "#access_token=t",
        search: "",
        get href() { return ""; },
        set href(_value) {},
      },
    };
    maybeRedirectOAuthCallback({ windowRef, documentRef: document });
    expect(document.body.classList.contains("app-booting")).toBe(false);
    expect(document.body.style.margin).toBe("0px");
    expect(document.body.style.padding).toBe("0px");
  });
});
