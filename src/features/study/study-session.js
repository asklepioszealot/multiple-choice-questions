(function attachStudy(globalScope) {
  "use strict";

  function buildQuestionOrder(questionCount) {
    return [...Array(Math.max(questionCount, 0)).keys()];
  }

  function getBoundedQuestionIndex(requestedIndex, totalQuestions) {
    if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
      return 0;
    }

    if (!Number.isInteger(requestedIndex)) {
      return 0;
    }

    return Math.min(Math.max(requestedIndex, 0), totalQuestions - 1);
  }

  function buildStudyQuestions({
    loadedSets,
    selectedSetIds,
    buildQuestionKey,
  }) {
    const studyQuestions = [];
    const setIds = selectedSetIds instanceof Set
      ? [...selectedSetIds]
      : Array.isArray(selectedSetIds)
        ? selectedSetIds
        : [];

    setIds.forEach((setId) => {
      const setData = loadedSets?.[setId];
      if (!setData || !Array.isArray(setData.questions)) return;

      setData.questions.forEach((question, index) => {
        const clonedQuestion = { ...question };
        clonedQuestion.__setId = setId;
        clonedQuestion.__setIndex = index;
        clonedQuestion.__questionKey =
          typeof buildQuestionKey === "function"
            ? buildQuestionKey(setId, question, index)
            : `set:${String(setId ?? "unknown")}::idx:${index}`;
        studyQuestions.push(clonedQuestion);
      });
    });

    return studyQuestions;
  }

  function collectStudySubjects(allQuestions) {
    return [
      ...new Set(
        (Array.isArray(allQuestions) ? allQuestions : [])
          .map((question) => question?.subject)
          .filter(
            (subject) => typeof subject === "string" && subject.trim().length > 0,
          ),
      ),
    ];
  }

  function createFilteredStudyView({
    allQuestions,
    selectedTopic,
    preferredQuestionKey = null,
    fallbackIndex = null,
    resolveQuestionKey,
  }) {
    const sourceQuestions = Array.isArray(allQuestions) ? allQuestions : [];
    const filteredQuestions =
      selectedTopic === "hepsi"
        ? [...sourceQuestions]
        : sourceQuestions.filter((question) => question?.subject === selectedTopic);
    const questionOrder = buildQuestionOrder(filteredQuestions.length);
    let currentQuestionIndex = 0;

    if (
      typeof preferredQuestionKey === "string" &&
      preferredQuestionKey.length > 0 &&
      typeof resolveQuestionKey === "function"
    ) {
      const matchedIndex = questionOrder.findIndex((questionIndex) => {
        const question = filteredQuestions[questionIndex];
        return resolveQuestionKey(question) === preferredQuestionKey;
      });

      if (matchedIndex >= 0) {
        currentQuestionIndex = matchedIndex;
      } else if (Number.isInteger(fallbackIndex)) {
        currentQuestionIndex = getBoundedQuestionIndex(
          fallbackIndex,
          filteredQuestions.length,
        );
      }
    } else if (Number.isInteger(fallbackIndex)) {
      currentQuestionIndex = getBoundedQuestionIndex(
        fallbackIndex,
        filteredQuestions.length,
      );
    }

    return {
      filteredQuestions,
      questionOrder,
      currentQuestionIndex,
    };
  }

  function getQuestionKey(question, resolveQuestionKey) {
    if (typeof resolveQuestionKey === "function") {
      return resolveQuestionKey(question);
    }

    return question?.__questionKey || "";
  }

  function selectStudyAnswer({
    question,
    selectedAnswers,
    answerIndex,
    answerLockEnabled,
    resolveQuestionKey,
  }) {
    const questionKey = getQuestionKey(question, resolveQuestionKey);
    const nextSelectedAnswers =
      selectedAnswers &&
      typeof selectedAnswers === "object" &&
      !Array.isArray(selectedAnswers)
        ? { ...selectedAnswers }
        : {};
    const currentAnswer = nextSelectedAnswers[questionKey];

    if (answerLockEnabled && currentAnswer !== undefined) {
      return {
        selectedAnswers: nextSelectedAnswers,
        answeredNow: false,
        blocked: true,
      };
    }

    if (currentAnswer === answerIndex) {
      delete nextSelectedAnswers[questionKey];
      return {
        selectedAnswers: nextSelectedAnswers,
        answeredNow: false,
        blocked: false,
      };
    }

    nextSelectedAnswers[questionKey] = answerIndex;
    return {
      selectedAnswers: nextSelectedAnswers,
      answeredNow: true,
      blocked: false,
    };
  }

  function toggleStudySolution({
    question,
    solutionVisible,
    resolveQuestionKey,
  }) {
    const questionKey = getQuestionKey(question, resolveQuestionKey);
    const nextSolutionVisible =
      solutionVisible &&
      typeof solutionVisible === "object" &&
      !Array.isArray(solutionVisible)
        ? { ...solutionVisible }
        : {};

    nextSolutionVisible[questionKey] = !nextSolutionVisible[questionKey];

    return {
      solutionVisible: nextSolutionVisible,
      isVisible: nextSolutionVisible[questionKey],
    };
  }

  const AppStudy = Object.freeze({
    buildQuestionOrder,
    getBoundedQuestionIndex,
    buildStudyQuestions,
    collectStudySubjects,
    createFilteredStudyView,
    selectStudyAnswer,
    toggleStudySolution,
  });

  globalScope.AppStudy = AppStudy;

  if (typeof exports !== "undefined") {
    exports.buildQuestionOrder = buildQuestionOrder;
    exports.getBoundedQuestionIndex = getBoundedQuestionIndex;
    exports.buildStudyQuestions = buildStudyQuestions;
    exports.collectStudySubjects = collectStudySubjects;
    exports.createFilteredStudyView = createFilteredStudyView;
    exports.selectStudyAnswer = selectStudyAnswer;
    exports.toggleStudySolution = toggleStudySolution;
    exports.AppStudy = AppStudy;
    exports.default = AppStudy;
  }
})(typeof window !== "undefined" ? window : globalThis);
