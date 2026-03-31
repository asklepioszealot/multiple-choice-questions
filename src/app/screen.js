(function attachAppScreen(globalScope) {
  "use strict";

  function resolveStudyContainer() {
    return (
      globalScope.document?.getElementById("app-container")
      || globalScope.document?.getElementById("main-app")
    );
  }

  function showScreen(name) {
    globalScope.AppState?.setCurrentScreen?.(name);

    const managerScreen = globalScope.document?.getElementById("set-manager");
    const authScreen = globalScope.document?.getElementById("auth-screen");
    const editorScreen = globalScope.document?.getElementById("editor-screen");
    const studyContainer = resolveStudyContainer();

    if (authScreen) authScreen.style.display = "none";
    if (managerScreen) managerScreen.style.display = "none";
    if (editorScreen) editorScreen.style.display = "none";
    if (studyContainer) studyContainer.style.display = "none";

    if (name === "auth" && authScreen) authScreen.style.display = "block";
    if (name === "manager" && managerScreen) managerScreen.style.display = "block";
    if (name === "editor" && editorScreen) editorScreen.style.display = "block";
    if (name === "study" && studyContainer) studyContainer.style.display = "block";
  }

  const AppScreen = Object.freeze({
    showScreen,
  });

  globalScope.AppScreen = AppScreen;

  if (typeof exports !== "undefined") {
    exports.AppScreen = AppScreen;
    exports.showScreen = showScreen;
    exports.default = AppScreen;
  }
})(typeof window !== "undefined" ? window : globalThis);
