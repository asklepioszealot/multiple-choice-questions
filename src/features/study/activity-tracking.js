import { recordStudyActivity as defaultRecordStudyActivity } from "../study-state/study-state.js";

export function createActivityTracker({
  recordStudyActivity = defaultRecordStudyActivity,
  getActivityByDay,
  setActivityByDay,
}) {
  function countRemovedAnswers(previousAnswers, nextAnswers) {
    const previousAnswersMap =
      previousAnswers &&
      typeof previousAnswers === "object" &&
      !Array.isArray(previousAnswers)
        ? previousAnswers
        : {};
    const nextAnswersMap =
      nextAnswers &&
      typeof nextAnswers === "object" &&
      !Array.isArray(nextAnswers)
        ? nextAnswers
        : {};

    return Object.keys(previousAnswersMap).reduce((removedCount, key) => {
      return previousAnswersMap[key] !== undefined &&
        nextAnswersMap[key] === undefined
        ? removedCount + 1
        : removedCount;
    }, 0);
  }

  function appendStudyActivity(delta) {
    const nextActivityByDay = recordStudyActivity(getActivityByDay(), delta);
    setActivityByDay(nextActivityByDay);
    return nextActivityByDay;
  }

  function recordAnswerSelectionActivity(question, previousAnswer, nextAnswer) {
    if (!question) {
      return;
    }

    const delta = {};
    if (previousAnswer !== undefined && previousAnswer !== nextAnswer) {
      delta.cleared = 1;
    }

    if (nextAnswer !== undefined) {
      if (nextAnswer === question.correct) {
        delta.correct = 1;
      } else {
        delta.wrong = 1;
      }
    }

    if (delta.correct || delta.wrong || delta.cleared) {
      appendStudyActivity(delta);
    }
  }

  return Object.freeze({
    countRemovedAnswers,
    appendStudyActivity,
    recordAnswerSelectionActivity,
  });
}
