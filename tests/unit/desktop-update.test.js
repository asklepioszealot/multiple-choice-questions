import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDesktopUpdateFeature,
  formatDesktopUpdatePrompt,
  isWindowsDesktopClient,
} from "../../src/features/desktop-update/desktop-update.js";

describe("desktop update feature", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("detects only Windows desktop runtimes", () => {
    expect(
      isWindowsDesktopClient({
        isDesktopRuntimeRef: () => true,
        navigatorRef: { userAgent: "Windows NT 10.0", platform: "Win32" },
        scope: { __TAURI__: { core: { invoke() {} } } },
      }),
    ).toBe(true);

    expect(
      isWindowsDesktopClient({
        isDesktopRuntimeRef: () => false,
        navigatorRef: { userAgent: "Windows NT 10.0", platform: "Win32" },
        scope: { __TAURI__: { core: { invoke() {} } } },
      }),
    ).toBe(false);
  });

  it("hides the manager button outside desktop runtime", () => {
    document.body.innerHTML = '<button id="check-updates-btn"></button>';

    const feature = createDesktopUpdateFeature({
      stateRef: {
        desktopUpdateState: {
          startupCheckScheduled: false,
          startupCheckCompleted: false,
          isChecking: false,
          isInstalling: false,
          buttonLabel: "Guncellemeleri Kontrol Et",
        },
      },
      isDesktopRuntimeRef: () => false,
      documentRef: document,
      windowRef: { navigator: { userAgent: "Mozilla/5.0", platform: "Linux" }, setTimeout },
    });

    feature.syncButtonState();

    const button = document.getElementById("check-updates-btn");
    expect(button.hidden).toBe(true);
    expect(button.disabled).toBe(true);
  });

  it("formats the update prompt with notes", () => {
    expect(
      formatDesktopUpdatePrompt({
        version: "1.0.1",
        currentVersion: "1.0.0",
        body: "Yeni desktop updater ve sync iyilestirmeleri.",
      }),
    ).toContain("Yeni masaustu surumu hazir: v1.0.1");
  });

  it("checks for updates manually on supported desktop runtime", async () => {
    document.body.innerHTML = '<button id="check-updates-btn"></button>';
    const confirmRef = vi.fn(() => false);
    const invoke = vi.fn(async (command) => {
      if (command === "plugin:updater|check") {
        return {
          version: "1.0.1",
          currentVersion: "1.0.0",
          rid: 41,
        };
      }

      if (command === "plugin:resources|close") {
        return null;
      }

      throw new Error(`unexpected command: ${command}`);
    });

    const feature = createDesktopUpdateFeature({
      stateRef: {
        desktopUpdateState: {
          startupCheckScheduled: false,
          startupCheckCompleted: false,
          isChecking: false,
          isInstalling: false,
          buttonLabel: "Guncellemeleri Kontrol Et",
        },
      },
      isDesktopRuntimeRef: () => true,
      documentRef: document,
      windowRef: {
        navigator: { userAgent: "Windows NT 10.0", platform: "Win32" },
        setTimeout,
        __TAURI__: { core: { invoke } },
      },
      confirmRef,
      alertRef: vi.fn(),
      consoleRef: { error: vi.fn() },
    });

    const installed = await feature.checkForUpdates("manual");
    expect(installed).toBe(false);
    expect(invoke).toHaveBeenCalledWith("plugin:updater|check");
    expect(confirmRef).toHaveBeenCalledTimes(1);
  });
});
