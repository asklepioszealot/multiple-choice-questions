import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGoogleDriveFeature } from "../../src/features/google-drive/google-drive.js";

function createPickerApi() {
  const state = {
    lastBuiltPicker: null,
  };

  function DocsView() {
    return {
      setMimeTypes() {
        this.mimeTypes = arguments[0];
        return this;
      },
    };
  }

  function PickerBuilder() {
    return {
      addView() {
        this.view = arguments[0];
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
        state.lastBuiltPicker = {
          setVisible: vi.fn(),
          config: {
            view: this.view,
            oauthToken: this.oauthToken,
            developerKey: this.developerKey,
            appId: this.appId,
            callback: this.callback,
            title: this.title,
          },
        };
        return state.lastBuiltPicker;
      },
    };
  }

  return {
    _state: state,
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

  it("downloads apkg files as binary and forwards them to the binary importer", async () => {
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn(({ callback }) => ({
      requestAccessToken() {
        requestAccessToken();
        callback({ access_token: "token-123" });
      },
    }));
    const binary = new Uint8Array([1, 2, 3]).buffer;
    const fetchRef = vi.fn().mockResolvedValue({
      ok: true,
      statusText: "OK",
      arrayBuffer: vi.fn().mockResolvedValue(binary),
      text: vi.fn(),
    });
    const loadSetFromText = vi.fn();
    const loadSetFromBinary = vi.fn().mockResolvedValue("drive-apkg");
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
      loadSetFromBinary,
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
    await feature.downloadAndLoadDriveFile("file-99", "anki-demo.apkg");

    expect(requestAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchRef).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/file-99?alt=media&key=api-key",
      {
        headers: {
          Authorization: "Bearer token-123",
        },
      },
    );
    expect(loadSetFromBinary).toHaveBeenCalledWith(binary, "anki-demo.apkg");
    expect(loadSetFromText).not.toHaveBeenCalled();
    expect(selectSet).toHaveBeenCalledWith("drive-apkg");
    expect(renderSetList).toHaveBeenCalledTimes(1);
    expect(showUndoToast).toHaveBeenCalledWith('"anki-demo.apkg" yüklendi!');
  });

  it("configures the picker to surface apkg-compatible mime types", () => {
    const pickerApi = createPickerApi();
    const googleRef = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn(() => ({
            requestAccessToken() {},
          })),
        },
      },
      picker: pickerApi,
    };
    const gapiRef = {
      load(_name, callback) {
        callback();
      },
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
      loadSetFromText: vi.fn(),
      loadSetFromBinary: vi.fn(),
      fetchRef: vi.fn(),
      gapiRef,
      googleRef,
      documentRef: document,
    });

    feature.initGoogleDrive();
    feature.authGoogleDrive();
    const picker = feature.launchDrivePicker();

    expect(picker).toBe(true);
    expect(pickerApi._state.lastBuiltPicker.config.view.mimeTypes).toContain(
      "application/octet-stream",
    );
    expect(pickerApi._state.lastBuiltPicker.config.view.mimeTypes).toContain(
      "application/zip",
    );
    expect(pickerApi._state.lastBuiltPicker.config.title).toContain(".apkg");
  });
});
