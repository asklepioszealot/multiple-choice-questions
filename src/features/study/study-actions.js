const globalScope = typeof window !== "undefined" ? window : globalThis;

function buildQuestionOrder(questionCount) {
    return [...Array(Math.max(questionCount, 0)).keys()];
  }

  function buildScoreSummary({
    allQuestions,
    selectedAnswers,
    resolveQuestionKey,
  }) {
    let correct = 0;
    let wrong = 0;
    let answered = 0;
    const questions = Array.isArray(allQuestions) ? allQuestions : [];
    const answers =
      selectedAnswers &&
      typeof selectedAnswers === "object" &&
      !Array.isArray(selectedAnswers)
        ? selectedAnswers
        : {};

    questions.forEach((question) => {
      const questionKey =
        typeof resolveQuestionKey === "function"
          ? resolveQuestionKey(question)
          : question?.__questionKey;
      if (questionKey === undefined || answers[questionKey] === undefined) {
        return;
      }

      answered += 1;
      if (answers[questionKey] === question.correct) {
        correct += 1;
      } else {
        wrong += 1;
      }
    });

    const totalQuestions = questions.length;
    const progressPct =
      totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;
    const accuracyPct = answered > 0 ? Math.round((correct / answered) * 100) : 0;

    return {
      correct,
      wrong,
      answered,
      totalQuestions,
      progressPct,
      accuracyPct,
    };
  }

  function formatScoreSummaryHtml(summary) {
    const normalizedSummary = summary || {};
    return (
      "✅ " +
      (normalizedSummary.correct || 0) +
      " &nbsp; ❌ " +
      (normalizedSummary.wrong || 0) +
      " &nbsp; 📊 " +
      (normalizedSummary.answered || 0) +
      "/" +
      (normalizedSummary.totalQuestions || 0) +
      " (%" +
      (normalizedSummary.progressPct || 0) +
      ")" +
      " &nbsp; 🎯 %" +
      (normalizedSummary.accuracyPct || 0)
    );
  }

  function createRetryWrongAnswersState({
    allQuestions,
    selectedAnswers,
    solutionVisible,
    resolveQuestionKey,
  }) {
    const questions = Array.isArray(allQuestions) ? allQuestions : [];
    const nextSelectedAnswers =
      selectedAnswers &&
      typeof selectedAnswers === "object" &&
      !Array.isArray(selectedAnswers)
        ? { ...selectedAnswers }
        : {};
    const nextSolutionVisible =
      solutionVisible &&
      typeof solutionVisible === "object" &&
      !Array.isArray(solutionVisible)
        ? { ...solutionVisible }
        : {};

    const wrongQuestions = questions.filter((question) => {
      const questionKey =
        typeof resolveQuestionKey === "function"
          ? resolveQuestionKey(question)
          : question?.__questionKey;
      return (
        questionKey !== undefined &&
        nextSelectedAnswers[questionKey] !== undefined &&
        nextSelectedAnswers[questionKey] !== question.correct
      );
    });

    wrongQuestions.forEach((question) => {
      const questionKey =
        typeof resolveQuestionKey === "function"
          ? resolveQuestionKey(question)
          : question?.__questionKey;
      delete nextSelectedAnswers[questionKey];
      delete nextSolutionVisible[questionKey];
    });

    return {
      hasWrongQuestions: wrongQuestions.length > 0,
      filteredQuestions: wrongQuestions,
      questionOrder: buildQuestionOrder(wrongQuestions.length),
      currentQuestionIndex: 0,
      selectedTopic: "hepsi",
      selectedAnswers: nextSelectedAnswers,
      solutionVisible: nextSolutionVisible,
    };
  }

  function createResetStudyState({
    allQuestions,
    selectedAnswers,
    solutionVisible,
    resolveQuestionKey,
  }) {
    const questions = Array.isArray(allQuestions) ? allQuestions : [];
    const activeQuestionKeys = new Set(
      questions.map((question) =>
        typeof resolveQuestionKey === "function"
          ? resolveQuestionKey(question)
          : question?.__questionKey,
      ),
    );
    const nextSelectedAnswers =
      selectedAnswers &&
      typeof selectedAnswers === "object" &&
      !Array.isArray(selectedAnswers)
        ? { ...selectedAnswers }
        : {};
    const nextSolutionVisible =
      solutionVisible &&
      typeof solutionVisible === "object" &&
      !Array.isArray(solutionVisible)
        ? { ...solutionVisible }
        : {};

    Object.keys(nextSelectedAnswers).forEach((questionKey) => {
      if (activeQuestionKeys.has(questionKey)) {
        delete nextSelectedAnswers[questionKey];
      }
    });

    Object.keys(nextSolutionVisible).forEach((questionKey) => {
      if (activeQuestionKeys.has(questionKey)) {
        delete nextSolutionVisible[questionKey];
      }
    });

    return {
      filteredQuestions: [...questions],
      questionOrder: buildQuestionOrder(questions.length),
      currentQuestionIndex: 0,
      selectedTopic: "hepsi",
      selectedAnswers: nextSelectedAnswers,
      solutionVisible: nextSolutionVisible,
    };
  }

  function shuffleQuestionOrder({ questionOrder, random = Math.random }) {
    const nextQuestionOrder = Array.isArray(questionOrder) ? [...questionOrder] : [];

    for (let index = nextQuestionOrder.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [nextQuestionOrder[index], nextQuestionOrder[swapIndex]] = [
        nextQuestionOrder[swapIndex],
        nextQuestionOrder[index],
      ];
    }

    return {
      questionOrder: nextQuestionOrder,
      currentQuestionIndex: 0,
    };
  }

  const AppStudyActions = Object.freeze({
  buildScoreSummary,
  formatScoreSummaryHtml,
  createRetryWrongAnswersState,
  createResetStudyState,
  shuffleQuestionOrder
});

export {
  buildScoreSummary,
  formatScoreSummaryHtml,
  createRetryWrongAnswersState,
  createResetStudyState,
  shuffleQuestionOrder,
  AppStudyActions
};
