(function attachAnalyticsFeature(globalScope) {
  "use strict";

  const MANAGER_DASHBOARD_ID = "analytics-dashboard-manager";
  const MANAGER_TOGGLE_ID = "analytics-toggle-btn";
  const MANAGER_CLOSE_ID = "analytics-close-btn";
  const MANAGER_SUMMARY_ID = "analytics-summary-manager";

  function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function toSafeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function buildAnalyticsSummary({
    loadedSets,
    pendingSession,
    resolveQuestionKey,
    selectedAnswers,
    selectedSetIds,
  } = {}) {
    const loadedSetsMap = toSafeObject(loadedSets);
    const allSetIds = Object.keys(loadedSetsMap);
    const chosenSetIds = toSafeArray(selectedSetIds).filter(
      (setId) => typeof setId === "string" && loadedSetsMap[setId],
    );
    const scopedSetIds = chosenSetIds.length > 0 ? chosenSetIds : allSetIds;
    const selectedAnswersMap = toSafeObject(selectedAnswers);
    const resolveQuestionKeyRef =
      typeof resolveQuestionKey === "function"
        ? resolveQuestionKey
        : function fallbackResolveQuestionKey(question, setId, index) {
            return `${setId}:${index}:${question?.q || ""}`;
          };

    let totalQuestions = 0;
    let solvedQuestions = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;

    scopedSetIds.forEach((setId) => {
      const setRecord = loadedSetsMap[setId];
      const questions = toSafeArray(setRecord?.questions);
      totalQuestions += questions.length;

      questions.forEach((question, index) => {
        const questionKey = resolveQuestionKeyRef(question, setId, index);
        if (selectedAnswersMap[questionKey] === undefined) {
          return;
        }

        solvedQuestions += 1;
        if (selectedAnswersMap[questionKey] === question.correct) {
          correctAnswers += 1;
        } else {
          wrongAnswers += 1;
        }
      });
    });

    const completionRate =
      totalQuestions > 0 ? Math.round((solvedQuestions / totalQuestions) * 100) : 0;
    const session = pendingSession && typeof pendingSession === "object" ? pendingSession : null;
    const hasSessionProgress = Boolean(
      session &&
        ((Number.isInteger(session.currentQuestionIndex) &&
          session.currentQuestionIndex >= 0) ||
          (typeof session.currentQuestionKey === "string" &&
            session.currentQuestionKey.trim())),
    );
    const lastStudyText = hasSessionProgress
      ? `Son calisma: ${Number.isInteger(session.currentQuestionIndex) ? session.currentQuestionIndex + 1 : 1}. soru${session?.selectedTopic && session.selectedTopic !== "hepsi" ? ` • ${session.selectedTopic}` : ""}`
      : "Son calisma: Henuz baslanmadi";

    return {
      completionRate,
      correctAnswers,
      loadedSetCount: allSetIds.length,
      lastStudyText,
      scopedSetCount: scopedSetIds.length,
      selectedSetCount: chosenSetIds.length,
      solvedQuestions,
      totalQuestions,
      wrongAnswers,
    };
  }

  function formatAnalyticsHeadline(summary = {}) {
    const loadedSetCount = Number(summary.loadedSetCount) || 0;
    const selectedSetCount = Number(summary.selectedSetCount) || 0;
    const solvedQuestions = Number(summary.solvedQuestions) || 0;
    const totalQuestions = Number(summary.totalQuestions) || 0;
    const completionRate = Number(summary.completionRate) || 0;

    return `${loadedSetCount} yuklu set • ${selectedSetCount} secili • ${solvedQuestions}/${totalQuestions} soru cozuldu • Tamamlanma %${completionRate}`;
  }

  function resolveElements(documentRef) {
    return {
      closeButton: documentRef?.getElementById(MANAGER_CLOSE_ID) || null,
      completionValue: documentRef?.getElementById("analytics-completion-value") || null,
      dashboard: documentRef?.getElementById(MANAGER_DASHBOARD_ID) || null,
      lastStudy: documentRef?.getElementById("analytics-last-study") || null,
      questionsValue: documentRef?.getElementById("analytics-questions-value") || null,
      resultsValue: documentRef?.getElementById("analytics-results-value") || null,
      setsMeta: documentRef?.getElementById("analytics-sets-meta") || null,
      setsValue: documentRef?.getElementById("analytics-sets-value") || null,
      summary: documentRef?.getElementById(MANAGER_SUMMARY_ID) || null,
      toggleButton: documentRef?.getElementById(MANAGER_TOGGLE_ID) || null,
    };
  }

  function syncAnalyticsToggleUi(toggleButton, visible) {
    if (!toggleButton) {
      return;
    }

    toggleButton.setAttribute("aria-expanded", visible ? "true" : "false");
    toggleButton.setAttribute(
      "title",
      visible ? "Istatistikler panelini gizle" : "Istatistikler panelini goster",
    );
    toggleButton.classList.toggle("is-active", visible);
  }

  function createAnalyticsPanelController({
    documentRef = globalScope.document,
    stateRef = globalScope.AppState,
  } = {}) {
    const fallbackState = {
      isVisible: false,
    };

    function resolvePanelState() {
      const candidate = stateRef?.analyticsPanelState;
      if (candidate && typeof candidate === "object") {
        if (typeof candidate.isVisible !== "boolean") {
          candidate.isVisible = false;
        }
        return candidate;
      }

      return fallbackState;
    }

    function syncVisibility() {
      const elements = resolveElements(documentRef);
      const visible = resolvePanelState().isVisible === true;

      if (elements.dashboard) {
        elements.dashboard.hidden = !visible;
      }
      if (elements.closeButton) {
        elements.closeButton.hidden = !visible;
      }
      syncAnalyticsToggleUi(elements.toggleButton, visible);
      return visible;
    }

    function setVisible(nextVisible) {
      resolvePanelState().isVisible = Boolean(nextVisible);
      return syncVisibility();
    }

    function renderSummary(summary = {}) {
      const elements = resolveElements(documentRef);

      if (elements.summary) {
        elements.summary.textContent = formatAnalyticsHeadline(summary);
      }
      if (elements.setsValue) {
        elements.setsValue.textContent = `${Number(summary.loadedSetCount) || 0} / ${Number(summary.selectedSetCount) || 0}`;
      }
      if (elements.setsMeta) {
        elements.setsMeta.textContent = "Yuklu / secili set";
      }
      if (elements.questionsValue) {
        elements.questionsValue.textContent = `${Number(summary.totalQuestions) || 0} / ${Number(summary.solvedQuestions) || 0}`;
      }
      if (elements.resultsValue) {
        elements.resultsValue.textContent = `${Number(summary.correctAnswers) || 0} / ${Number(summary.wrongAnswers) || 0}`;
      }
      if (elements.completionValue) {
        elements.completionValue.textContent = `%${Number(summary.completionRate) || 0}`;
      }
      if (elements.lastStudy) {
        elements.lastStudy.textContent = summary.lastStudyText || "Son calisma: Henuz baslanmadi";
      }
    }

    return Object.freeze({
      closePanel() {
        return setVisible(false);
      },
      openPanel() {
        return setVisible(true);
      },
      renderSummary,
      syncVisibility,
      togglePanel() {
        return setVisible(!resolvePanelState().isVisible);
      },
    });
  }

  const AppAnalytics = Object.freeze({
    buildAnalyticsSummary,
    createAnalyticsPanelController,
    formatAnalyticsHeadline,
  });

  globalScope.AppAnalytics = AppAnalytics;

  if (typeof exports !== "undefined") {
    exports.buildAnalyticsSummary = buildAnalyticsSummary;
    exports.createAnalyticsPanelController = createAnalyticsPanelController;
    exports.formatAnalyticsHeadline = formatAnalyticsHeadline;
    exports.AppAnalytics = AppAnalytics;
    exports.default = AppAnalytics;
  }
})(typeof window !== "undefined" ? window : globalThis);
