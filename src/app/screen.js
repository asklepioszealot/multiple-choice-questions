// src/app/screen.js
import * as state from "./state.js";

function resolveStudyContainer() {
    return (
      globalScope.document?.getElementById("app-container")
      || globalScope.document?.getElementById("main-app")
    );
  }

  function showScreen(name) {
    state.setCurrentScreen(name);

    const managerScreen = document.getElementById("set-manager");
    const authScreen = document.getElementById("auth-screen");
    const editorScreen = document.getElementById("editor-screen");
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

  export {
    showScreen,
  };
