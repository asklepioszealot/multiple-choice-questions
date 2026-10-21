import { describe, expect, it, vi } from "vitest";
import { createAuthHandlers } from "../../src/features/auth/auth-handlers.js";

function createHandlers(authFeature) {
  const deps = {
    authFeature,
    captureWorkspaceSeed: vi.fn(() => ({ seed: true })),
    buildCurrentStudyStateSnapshot: vi.fn(() => ({ snapshot: true })),
    loadSyncedWorkspace: vi.fn().mockResolvedValue(undefined),
    renderSetList: vi.fn(),
  };
  return { deps, handlers: createAuthHandlers(deps) };
}

describe("auth handlers googleAuth", () => {
  it("oturum dönerse (Android) çalışma alanını yükler", async () => {
    const session = { mode: "supabase", userId: "u1" };
    const { deps, handlers } = createHandlers({
      attemptGoogleAuth: vi.fn().mockResolvedValue(session),
    });

    await expect(handlers.googleAuth()).resolves.toBe(session);

    expect(deps.loadSyncedWorkspace).toHaveBeenCalledWith({
      fallbackWorkspace: { seed: true },
      fallbackStudySnapshot: { snapshot: true },
    });
    expect(deps.renderSetList).toHaveBeenCalled();
  });

  it("oturum dönmezse (masaüstü deep link akışı) yükleme yapmaz", async () => {
    const { deps, handlers } = createHandlers({
      attemptGoogleAuth: vi.fn().mockResolvedValue(null),
    });

    await expect(handlers.googleAuth()).resolves.toBeNull();

    expect(deps.loadSyncedWorkspace).not.toHaveBeenCalled();
    expect(deps.renderSetList).not.toHaveBeenCalled();
  });
});
