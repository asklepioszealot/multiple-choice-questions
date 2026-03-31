import { beforeEach, describe, expect, it } from "vitest";
import { AppStorage } from "../../src/core/storage.js";

describe("AppStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores persistent values in localStorage", () => {
    AppStorage.setLocalItem("mc_user", "alice");
    expect(AppStorage.getLocalItem("mc_user")).toBe("alice");
  });

  it("stores temporary values in sessionStorage", () => {
    AppStorage.setSessionItem("mc_session_user", "bob");

    expect(AppStorage.getSessionItem("mc_session_user")).toBe("bob");
    expect(AppStorage.getLocalItem("mc_session_user")).toBeNull();
  });
});
