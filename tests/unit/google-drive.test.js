import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGoogleDriveFeature } from "../../src/features/google-drive/google-drive.js";

function createPickerApi() {
  function DocsView() {
    return {
      setMimeTypes() {
        return this;
      },
    };
  }

  function PickerBuilder() {
    return {
      addView() {
        return this;
      },
      setOAuthToken(value) {
        this.oauthToken = value;
        return this;
      },
      setDeveloperKey(value) {
        this.developerKey = value;
        return this;
      },
      setAppId(value) {
        this.appId = value;
        return this;
      },
      setCallback(callback) {
        this.callback = callback;
        return this;
      },
      setTitle(value) {
        this.title = value;
        return this;
      },
      build() {
        return {
          setVisible: vi.fn(),
          config: {
            oauthToken: this.oauthToken,
            developerKey: this.developerKey,
            appId: this.appId,
            callback: this.callback,
            title: this.title,
          },
        };
      },
    };
  }

  return {
    DocsView,
    PickerBuilder,
    ViewId: {
      DOCS: "DOCS",
    },
    Action: {
      PICKED: "picked",
    },
  };
}

describe("google-drive feature", () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="drive-upload-btn">Drive</button>';
  });

  it("disables the drive button and shows a config warning when drive config is missing", () => {
    const alerts = [];
    const feature = createGoogleDriveFeature({
      getRuntimeConfig() {
        return {
          driveClientId: "",
          driveApiKey: "",
          driveAppId: "",
        };
      },
      hasDriveConfig() {
        return false;
      },
      isDesktopRuntime() {
        return false;
      },
      alertRef(message) {
        alerts.push(message);
      },
      documentRef: document,
    });

    feature.syncDriveButtonState();
    feature.authGoogleDrive();

    expect(document.getElementById("drive-upload-btn").disabled).toBe(true);
    expect(alerts).toEqual([
      "Google Drive entegrasyonu bu yapıda etkin değil. Runtime config gerekli.",
    ]);
  });

  it("downloads a selected drive file and forwards it to set-manager callbacks", async () => {
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn(({ callback }) => ({
      requestAccessToken() {
        requestAccessToken();
        callback({ access_token: "token-123" });
      },
    }));
    const fetchRef = vi.fn().mockResolvedValue({
      ok: true,
      statusText: "OK",
      text: vi.fn().mockResolvedValue('{"setName":"Drive Demo","questions":[]}'),
    });
    const loadSetFromText = vi.fn().mockResolvedValue("drive-demo");
    const selectSet = vi.fn();
    const renderSetList = vi.fn();
    const showUndoToast = vi.fn();
    const gapiRef = {
      load(_name, callback) {
        callback();
      },
    };
    const googleRef = {
      accounts: {
        oauth2: {
          initTokenClient,
        },
      },
      picker: createPickerApi(),
    };

    const feature = createGoogleDriveFeature({
      getRuntimeConfig() {
        return {
          driveClientId: "client-id",
          driveApiKey: "api-key",
          driveAppId: "app-id",
        };
      },
      hasDriveConfig() {
        return true;
      },
      isDesktopRuntime() {
        return false;
      },
      loadSetFromText,
      selectSet,
      renderSetList,
      showUndoToast,
      fetchRef,
      gapiRef,
      googleRef,
      documentRef: document,
    });

    feature.initGoogleDrive();
    feature.authGoogleDrive();
    await feature.downloadAndLoadDriveFile("file-42", "demo.json");

    expect(initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-id",
        scope: "https://www.googleapis.com/auth/drive.readonly",
      }),
    );
    expect(requestAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchRef).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/file-42?alt=media&key=api-key",
      {
        headers: {
          Authorization: "Bearer token-123",
        },
      },
    );
    expect(loadSetFromText).toHaveBeenCalledWith(
      '{"setName":"Drive Demo","questions":[]}',
      "demo.json",
    );
    expect(selectSet).toHaveBeenCalledWith("drive-demo");
    expect(renderSetList).toHaveBeenCalledTimes(1);
    expect(showUndoToast).toHaveBeenCalledWith('"demo.json" yüklendi!');
  });
});
