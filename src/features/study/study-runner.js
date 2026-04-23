import { sanitizeHtml } from "../../core/security.js";
import { ThemeManager } from "../../ui/theme.js";
import { THEME_CONTROL_IDS, THEME_KEY } from "../../shared/constants.js";
import {
  buildScoreSummary,
  createResetStudyState,
  createRetryWrongAnswersState,
  formatScoreSummaryHtml,
  shuffleQuestionOrder,
} from "./study-actions.js";
import { buildPrintableStudyHtml } from "./study-export.js";
import {
  buildStudyQuestions,
  collectStudySubjects,
  createFilteredStudyView,
  getAdjacentQuestionIndex,
  getBoundedQuestionIndex,
  selectStudyAnswer,
  toggleStudySolution,
} from "./study-session.js";
import {
  createStudyChromeState,
  runWithQuestionInstantReset,
} from "./study-ui.js";
import {
  buildQuestionKey,
  readSavedSession,
  resolveQuestionKey as cardId,
} from "../study-state/study-state.js";

export function createStudyRunner({
  documentRef,
  windowRef,
  storage,
  showScreen,
  authFeature,
  setManager,
  desktopUpdateFeature,
  studyChrome,
  studyPersistence,
  activityTracker,
  getStorageKeyPrefix,
  hasPendingSyncConflict,
  confirmEditorNavigation,
  renderSetList,
  getContext,
  setContext,
  alertRef = windowRef?.alert?.bind(windowRef),
  confirmRef = windowRef?.confirm?.bind(windowRef),
}) {
  const setTimeoutRef =
    typeof windowRef?.setTimeout === "function"
      ? windowRef.setTimeout.bind(windowRef)
      : setTimeout;

  function getExplanationHtml(question) {
    if (
      question &&
      typeof question.explanation === "string" &&
      question.explanation.trim()
    ) {
      return question.explanation;
    }
    return '<span class="highlight-important">⚠️ Açıklama bulunamadı.</span>';
  }

  function updateScoreDisplay() {
    const { allQuestions, selectedAnswers } = getContext();
    const scoreHtml = formatScoreSummaryHtml(
      buildScoreSummary({
        allQuestions,
        selectedAnswers,
        resolveQuestionKey: cardId,
      }),
    );
    ["score-display", "fullscreen-score-display"].forEach((elementId) => {
      const scoreEl = documentRef?.getElementById(elementId);
      if (scoreEl) {
        scoreEl.innerHTML = scoreHtml;
      }
    });
  }

  function displayQuestion() {
    const {
      currentQuestionIndex,
      filteredQuestions,
      questionOrder,
      selectedAnswers,
      solutionVisible,
    } = getContext();
    const question = filteredQuestions[questionOrder[currentQuestionIndex]];
    if (!question) {
      return;
    }

    const questionKey = cardId(question);
    const chromeState = createStudyChromeState({
      currentQuestionIndex,
      totalQuestions: filteredQuestions.length,
      subject: question.subject,
    });

    const questionText = documentRef?.getElementById("question-text");
    if (questionText) {
      questionText.innerHTML = sanitizeHtml(question.q);
    }
    const questionCounter = documentRef?.getElementById("question-counter");
    if (questionCounter) {
      questionCounter.textContent = chromeState.counterText;
    }
    const subjectBadge = documentRef?.getElementById("subject-badge");
    if (subjectBadge) {
      subjectBadge.textContent = chromeState.subjectText;
    }
    const solutionContent = documentRef?.getElementById("solution-content");
    if (solutionContent) {
      solutionContent.innerHTML = sanitizeHtml(getExplanationHtml(question));
    }

    const optionsContainer = documentRef?.getElementById("options-container");
    if (optionsContainer) {
      optionsContainer.innerHTML = "";
      question.options.forEach((option, index) => {
        const optionDiv = documentRef.createElement("div");
        optionDiv.className = "option";
        optionDiv.innerHTML = sanitizeHtml(
          `<span class="option-label">${String.fromCharCode(
            65 + index,
          )}</span><span>${option}</span>`,
        );

        if (
          selectedAnswers[questionKey] !== undefined &&
          selectedAnswers[questionKey] !== null
        ) {
          if (index === question.correct) {
            optionDiv.classList.add("correct");
          } else if (index === selectedAnswers[questionKey]) {
            optionDiv.classList.add("wrong");
          }
        } else if (selectedAnswers[questionKey] === index) {
          optionDiv.classList.add("selected");
        }

        optionDiv.onclick = () => selectOption(index);
        optionsContainer.appendChild(optionDiv);
      });
    }

    const solution = documentRef?.getElementById("solution");
    const showSolutionBtn = documentRef?.getElementById("show-solution-btn");
    if (solutionVisible[questionKey]) {
      solution?.classList.add("visible");
      if (showSolutionBtn) {
        showSolutionBtn.textContent = "Çözümü Gizle";
      }
    } else {
      solution?.classList.remove("visible");
      if (showSolutionBtn) {
        showSolutionBtn.textContent = "Çözümü Göster";
      }
    }

    const prevBtn = documentRef?.getElementById("prev-btn");
    if (prevBtn) {
      prevBtn.disabled = chromeState.disablePrev;
    }
    const nextBtn = documentRef?.getElementById("next-btn");
    if (nextBtn) {
      nextBtn.disabled = chromeState.disableNext;
    }
    studyChrome.updateFullscreenInfo(question);
    studyPersistence.saveState();
  }

  function filterByTopic(resetIndex = true, options = {}) {
    const topicSelect = documentRef?.getElementById("topic-select");
    if (!topicSelect) {
      return;
    }

    const { allQuestions } = getContext();
    const selectedTopic = topicSelect.value;
    const nextView = createFilteredStudyView({
      allQuestions,
      selectedTopic,
      preferredQuestionKey: resetIndex ? null : options.preferredQuestionKey,
      fallbackIndex: resetIndex
        ? 0
        : Number.isInteger(options.fallbackIndex)
          ? options.fallbackIndex
          : null,
      resolveQuestionKey: cardId,
    });

    setContext({
      filteredQuestions: nextView.filteredQuestions,
      questionOrder: nextView.questionOrder,
      currentQuestionIndex: nextView.currentQuestionIndex,
    });

    const jumpInput = documentRef?.getElementById("jump-input");
    jumpInput?.setAttribute("max", nextView.filteredQuestions.length);

    if (nextView.filteredQuestions.length > 0) {
      displayQuestion();
      return;
    }

    const questionText = documentRef?.getElementById("question-text");
    if (questionText) {
      questionText.innerHTML = "Bu filtrede gösterilecek soru bulunamadı.";
    }
    const questionCounter = documentRef?.getElementById("question-counter");
    if (questionCounter) {
      questionCounter.textContent = "Soru 0 / 0";
    }
    const subjectBadge = documentRef?.getElementById("subject-badge");
    if (subjectBadge) {
      subjectBadge.textContent = selectedTopic;
    }
    const solutionContent = documentRef?.getElementById("solution-content");
    if (solutionContent) {
      solutionContent.innerHTML = "";
    }
    const optionsContainer = documentRef?.getElementById("options-container");
    if (optionsContainer) {
      optionsContainer.innerHTML = "";
    }
    documentRef?.getElementById("solution")?.classList.remove("visible");
    const showSolutionBtn = documentRef?.getElementById("show-solution-btn");
    if (showSolutionBtn) {
      showSolutionBtn.textContent = "Çözümü Göster";
    }
    const prevBtn = documentRef?.getElementById("prev-btn");
    if (prevBtn) {
      prevBtn.disabled = true;
    }
    const nextBtn = documentRef?.getElementById("next-btn");
    if (nextBtn) {
      nextBtn.disabled = true;
    }
    studyChrome.updateFullscreenInfo(null);
    studyPersistence.saveState();
  }

  function populateTopicFilter() {
    const { allQuestions } = getContext();
    const select = documentRef?.getElementById("topic-select");
    if (!select) {
      return;
    }

    const subjects = collectStudySubjects(allQuestions);
    select.innerHTML = '<option value="hepsi">Tüm Başlıklar</option>';
    subjects.forEach((subject) => {
      const option = documentRef.createElement("option");
      option.value = subject;
      option.textContent = subject;
      select.appendChild(option);
    });
  }

  function startStudy() {
    if (!authFeature.requireAuth()) {
      return;
    }
    if (hasPendingSyncConflict()) {
      return;
    }

    const loadedSets = setManager.getLoadedSets();
    const selectedSetIds = setManager.getSelectedSetIds();
    if (selectedSetIds.length === 0) {
      return;
    }
    studyChrome.clearAutoAdvanceTimer();

    const allQuestions = buildStudyQuestions({
      loadedSets,
      selectedSetIds,
      buildQuestionKey,
    });

    if (allQuestions.length === 0) {
      alertRef?.("Seçili setlerde soru bulunamadı.");
      return;
    }

    setContext({
      allQuestions,
      filteredQuestions: [...allQuestions],
      questionOrder: [...Array(allQuestions.length).keys()],
      currentQuestionIndex: 0,
    });

    showScreen("study");
    populateTopicFilter();
    updateScoreDisplay();

    const { pendingSession } = getContext();
    const session =
      readSavedSession(storage, pendingSession, getStorageKeyPrefix()) ||
      pendingSession ||
      {};
    const topicSelect = documentRef?.getElementById("topic-select");
    if (
      topicSelect &&
      typeof session.selectedTopic === "string" &&
      [...topicSelect.options].some((option) => option.value === session.selectedTopic)
    ) {
      topicSelect.value = session.selectedTopic;
    }

    filterByTopic(false, {
      preferredQuestionKey:
        session && typeof session.currentQuestionKey === "string"
          ? session.currentQuestionKey
          : null,
      fallbackIndex:
        session && Number.isInteger(session.currentQuestionIndex)
          ? session.currentQuestionIndex
          : null,
    });
  }

  function showSetManager() {
    if (!authFeature.requireAuth()) {
      return;
    }
    if (
      !confirmEditorNavigation(
        "Kaydedilmemis degisiklikler var. Yoneticiye donersen editor kapanacak. Devam etmek istiyor musun?",
        "Kaydedilmemis degisiklikler korunuyor.",
      )
    ) {
      return false;
    }

    studyChrome.clearAutoAdvanceTimer();
    if (getContext().isFullscreen) {
      studyChrome.toggleFullscreen();
    }
    showScreen("manager");
    renderSetList();
    desktopUpdateFeature.syncButtonState();
    return true;
  }

  function checkDesktopUpdates() {
    return desktopUpdateFeature.checkForUpdates("manual");
  }

  function selectOption(index) {
    const {
      autoAdvanceEnabled,
      currentQuestionIndex,
      filteredQuestions,
      questionOrder,
      selectedAnswers,
      answerLockEnabled,
    } = getContext();
    const question = filteredQuestions[questionOrder[currentQuestionIndex]];
    const questionKey = question ? cardId(question) : "";
    const previousAnswer =
      questionKey && selectedAnswers[questionKey] !== undefined
        ? selectedAnswers[questionKey]
        : undefined;
    const answerSelection = selectStudyAnswer({
      question,
      selectedAnswers,
      answerIndex: index,
      answerLockEnabled,
      resolveQuestionKey: cardId,
    });

    if (answerSelection.blocked) {
      return;
    }

    setContext({
      selectedAnswers: answerSelection.selectedAnswers,
    });
    activityTracker.recordAnswerSelectionActivity(
      question,
      previousAnswer,
      questionKey ? answerSelection.selectedAnswers[questionKey] : undefined,
    );

    displayQuestion();
    updateScoreDisplay();

    if (autoAdvanceEnabled && answerSelection.answeredNow) {
      studyChrome.clearAutoAdvanceTimer();
      const timeoutId = setTimeoutRef(() => {
        setContext({
          autoAdvanceTimeoutId: null,
        });
        if (getContext().currentQuestionIndex < getContext().filteredQuestions.length - 1) {
          nextQuestion();
        }
      }, 400);
      setContext({
        autoAdvanceTimeoutId: timeoutId,
      });
    }
  }

  function toggleSolution() {
    const { currentQuestionIndex, filteredQuestions, questionOrder, solutionVisible } =
      getContext();
    const question = filteredQuestions[questionOrder[currentQuestionIndex]];
    const toggled = toggleStudySolution({
      question,
      solutionVisible,
      resolveQuestionKey: cardId,
    });

    setContext({
      solutionVisible: toggled.solutionVisible,
    });

    const solution = documentRef?.getElementById("solution");
    const button = documentRef?.getElementById("show-solution-btn");

    if (toggled.isVisible) {
      solution?.classList.add("visible");
      if (button) {
        button.textContent = "Çözümü Gizle";
      }
    } else {
      solution?.classList.remove("visible");
      if (button) {
        button.textContent = "Çözümü Göster";
      }
    }
    studyPersistence.saveState();
  }

  function previousQuestion() {
    studyChrome.clearAutoAdvanceTimer();
    const { currentQuestionIndex, filteredQuestions } = getContext();
    const nextIndex = getAdjacentQuestionIndex(
      currentQuestionIndex,
      filteredQuestions.length,
      -1,
    );
    if (nextIndex !== currentQuestionIndex) {
      setContext({
        currentQuestionIndex: nextIndex,
      });
      runWithQuestionInstantReset(() => displayQuestion(), documentRef);
    }
  }

  function nextQuestion() {
    studyChrome.clearAutoAdvanceTimer();
    const { currentQuestionIndex, filteredQuestions } = getContext();
    const nextIndex = getAdjacentQuestionIndex(
      currentQuestionIndex,
      filteredQuestions.length,
      1,
    );
    if (nextIndex !== currentQuestionIndex) {
      setContext({
        currentQuestionIndex: nextIndex,
      });
      runWithQuestionInstantReset(() => displayQuestion(), documentRef);
    }
  }

  function jumpToQuestion() {
    studyChrome.clearAutoAdvanceTimer();
    const input = documentRef?.getElementById("jump-input");
    if (!input) {
      return;
    }

    const questionNum = Number.parseInt(input.value, 10);
    const { filteredQuestions } = getContext();

    if (questionNum >= 1 && questionNum <= filteredQuestions.length) {
      setContext({
        currentQuestionIndex: getBoundedQuestionIndex(
          questionNum - 1,
          filteredQuestions.length,
        ),
      });
      runWithQuestionInstantReset(() => displayQuestion(), documentRef);
      input.value = "";
    } else {
      alertRef?.(`Lütfen 1 ile ${filteredQuestions.length} arasında bir sayı girin.`);
    }
  }

  function syncThemeControlsUI() {
    const themeName = ThemeManager.getCurrentTheme();
    THEME_CONTROL_IDS.forEach((controlId) => {
      const control = documentRef?.getElementById(controlId);
      if (control) {
        control.value = themeName;
      }
    });
  }

  function setTheme(themeName) {
    ThemeManager.setTheme({
      themeName,
      controlIds: THEME_CONTROL_IDS,
      storageApi: storage,
      storageKey: THEME_KEY,
    });
    syncThemeControlsUI();
  }

  function syncManagerSettingsPanelState() {
    const toggleButton = documentRef?.getElementById("manager-settings-toggle-btn");
    const panel = documentRef?.getElementById("manager-settings-panel");
    if (!toggleButton || !panel) {
      return;
    }

    const isOpen = !panel.hidden;
    toggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggleButton.classList.toggle("is-active", isOpen);
    toggleButton.title = isOpen
      ? "Yazi boyutu ayarlarini kapat"
      : "Yazi boyutu ayarlarini ac";
  }

  function toggleManagerSettingsPanel(forceState = null) {
    const panel = documentRef?.getElementById("manager-settings-panel");
    if (!panel) {
      return false;
    }

    const nextOpen = typeof forceState === "boolean" ? forceState : panel.hidden;
    panel.hidden = !nextOpen;
    syncManagerSettingsPanelState();
    return nextOpen;
  }

  function shuffleQuestions() {
    const { filteredQuestions, questionOrder } = getContext();
    if (filteredQuestions.length === 0) {
      return;
    }

    const shuffled = shuffleQuestionOrder({
      questionOrder,
    });
    setContext({
      questionOrder: shuffled.questionOrder,
      currentQuestionIndex: shuffled.currentQuestionIndex,
    });
    displayQuestion();
  }

  function exportPrintable() {
    const { allQuestions } = getContext();
    const printWindow = windowRef?.open?.("", "_blank");
    if (!printWindow) {
      return null;
    }

    const html = buildPrintableStudyHtml({
      title: "Çoktan Seçmeli Test",
      questions: allQuestions,
      getExplanationHtml,
    });
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
    return printWindow;
  }

  function retryWrongAnswers() {
    const { allQuestions, selectedAnswers, solutionVisible } = getContext();
    const retriedState = createRetryWrongAnswersState({
      allQuestions,
      selectedAnswers,
      solutionVisible,
      resolveQuestionKey: cardId,
    });

    if (!retriedState.hasWrongQuestions) {
      alertRef?.("Yanlış cevaplanan soru bulunamadı. Önce soruları cevaplayın.");
      return;
    }

    const clearedAnswerCount = activityTracker.countRemovedAnswers(
      selectedAnswers,
      retriedState.selectedAnswers,
    );
    if (clearedAnswerCount > 0) {
      activityTracker.appendStudyActivity({
        cleared: clearedAnswerCount,
      });
    }

    setContext({
      filteredQuestions: retriedState.filteredQuestions,
      selectedAnswers: retriedState.selectedAnswers,
      solutionVisible: retriedState.solutionVisible,
      questionOrder: retriedState.questionOrder,
      currentQuestionIndex: retriedState.currentQuestionIndex,
    });
    const topicSelect = documentRef?.getElementById("topic-select");
    if (topicSelect) {
      topicSelect.value = "hepsi";
    }
    documentRef
      ?.getElementById("jump-input")
      ?.setAttribute("max", retriedState.filteredQuestions.length);
    studyPersistence.saveState();
    updateScoreDisplay();
    displayQuestion();
  }

  function resetQuiz() {
    if (
      !confirmRef?.(
        "Seçili/aktif setlerdeki cevaplarınız ve ilerlemeniz sıfırlanacak. Emin misiniz?",
      )
    ) {
      return;
    }

    const { allQuestions, selectedAnswers, solutionVisible } = getContext();
    const resetState = createResetStudyState({
      allQuestions,
      selectedAnswers,
      solutionVisible,
      resolveQuestionKey: cardId,
    });

    const clearedAnswerCount = activityTracker.countRemovedAnswers(
      selectedAnswers,
      resetState.selectedAnswers,
    );
    if (clearedAnswerCount > 0) {
      activityTracker.appendStudyActivity({
        cleared: clearedAnswerCount,
      });
    }

    setContext({
      selectedAnswers: resetState.selectedAnswers,
      solutionVisible: resetState.solutionVisible,
      currentQuestionIndex: resetState.currentQuestionIndex,
      filteredQuestions: resetState.filteredQuestions,
      questionOrder: resetState.questionOrder,
    });
    const topicSelect = documentRef?.getElementById("topic-select");
    if (topicSelect) {
      topicSelect.value = "hepsi";
    }

    const jumpInput = documentRef?.getElementById("jump-input");
    if (jumpInput) {
      jumpInput.setAttribute("max", resetState.filteredQuestions.length);
    }

    studyPersistence.saveState();
    updateScoreDisplay();
    displayQuestion();
  }

  return Object.freeze({
    checkDesktopUpdates,
    displayQuestion,
    exportPrintable,
    filterByTopic,
    jumpToQuestion,
    nextQuestion,
    populateTopicFilter,
    previousQuestion,
    resetQuiz,
    retryWrongAnswers,
    selectOption,
    setTheme,
    showSetManager,
    shuffleQuestions,
    startStudy,
    syncManagerSettingsPanelState,
    syncThemeControlsUI,
    toggleManagerSettingsPanel,
    toggleSolution,
    updateScoreDisplay,
  });
}
