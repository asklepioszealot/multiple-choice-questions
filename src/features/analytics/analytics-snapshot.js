const DEFAULT_ACTIVITY_WINDOW_DAYS = 7;

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function resolveQuestionSubject(question) {
  return typeof question?.subject === "string" && question.subject.trim()
    ? question.subject.trim()
    : "Genel";
}

function normalizeActivityCount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return Math.round(numericValue);
}

function normalizeActivityByDay(activityByDay) {
  const normalized = {};
  Object.entries(toSafeObject(activityByDay)).forEach(([dayKey, entry]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
      return;
    }

    normalized[dayKey] = {
      correct: normalizeActivityCount(entry?.correct),
      wrong: normalizeActivityCount(entry?.wrong),
      cleared: normalizeActivityCount(entry?.cleared),
    };
  });
  return normalized;
}

function formatDayLabel(date) {
  return date.toLocaleDateString("tr-TR", { weekday: "short" });
}

function formatDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildActivityTrend(activityByDay, now = new Date()) {
  const normalizedActivity = normalizeActivityByDay(activityByDay);
  const safeNow = now instanceof Date ? now : new Date(now);
  const today = new Date(safeNow);
  today.setHours(0, 0, 0, 0);

  const trend = [];
  for (let offset = DEFAULT_ACTIVITY_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const dayKey = formatDayKey(day);
    const entry = normalizedActivity[dayKey] || { correct: 0, wrong: 0, cleared: 0 };

    trend.push({
      key: dayKey,
      label: formatDayLabel(day),
      correct: entry.correct,
      wrong: entry.wrong,
      cleared: entry.cleared,
      total: entry.correct + entry.wrong + entry.cleared,
    });
  }

  return trend;
}

function buildLastStudyText(pendingSession) {
  const session =
    pendingSession && typeof pendingSession === "object" ? pendingSession : null;
  const hasSessionProgress = Boolean(
    session &&
      ((Number.isInteger(session.currentQuestionIndex) &&
        session.currentQuestionIndex >= 0) ||
        (typeof session.currentQuestionKey === "string" &&
          session.currentQuestionKey.trim())),
  );

  if (!hasSessionProgress) {
    return "Son çalışma: Henüz başlanmadı";
  }

  return `Son çalışma: ${
    Number.isInteger(session.currentQuestionIndex)
      ? session.currentQuestionIndex + 1
      : 1
  }. soru${
    session?.selectedTopic && session.selectedTopic !== "hepsi"
      ? ` • ${session.selectedTopic}`
      : ""
  }`;
}

function sortSubjectBreakdown(subjectBreakdown) {
  return [...subjectBreakdown].sort((left, right) => {
    return (
      (right.remaining || 0) - (left.remaining || 0) ||
      (left.accuracy || 0) - (right.accuracy || 0) ||
      (left.solvedQuestions || 0) - (right.solvedQuestions || 0) ||
      (right.totalQuestions || 0) - (left.totalQuestions || 0) ||
      (left.encounterOrder || 0) - (right.encounterOrder || 0) ||
      String(left.subject || "").localeCompare(String(right.subject || ""), "tr")
    );
  });
}

function buildFocusRecommendation({
  totalQuestions,
  solvedQuestions,
  subjectBreakdown,
}) {
  if (!totalQuestions) {
    return {
      kind: "empty",
      title: "Henüz veri yok",
      message: "Set yüklendiğinde ve sorular çözüldükçe odak önerisi burada görünecek.",
      actionLabel: "",
      subject: null,
    };
  }

  const remainingSubject = subjectBreakdown.find((item) => (item.remaining || 0) > 0);
  if (remainingSubject) {
    return {
      kind: "subject",
      title: `${remainingSubject.subject} ile devam et`,
      message:
        remainingSubject.solvedQuestions === 0
          ? `${remainingSubject.subject} tarafında ${remainingSubject.remaining} soru seni bekliyor.`
          : `${remainingSubject.subject} tarafında ${remainingSubject.remaining} soru kaldı. Mevcut doğruluk %${remainingSubject.accuracy}.`,
      actionLabel: `${remainingSubject.subject} odağına geç`,
      subject: remainingSubject.subject,
    };
  }

  const weakestSolvedSubject = subjectBreakdown.find((item) => (item.wrong || 0) > 0);
  if (weakestSolvedSubject) {
    return {
      kind: "subject",
      title: `${weakestSolvedSubject.subject} tarafını toparla`,
      message: `${weakestSolvedSubject.subject} içinde ${weakestSolvedSubject.wrong} yanlış cevap var. Kısa bir tekrar iyi sonraki adım olur.`,
      actionLabel: `${weakestSolvedSubject.subject} sorularına dön`,
      subject: weakestSolvedSubject.subject,
    };
  }

  if (solvedQuestions < totalQuestions) {
    return {
      kind: "progress",
      title: "Mevcut seti bitirmeye yakınsın",
      message: `${totalQuestions - solvedQuestions} soru daha çözüldüğünde seçili havuz tamamlanmış olacak.`,
      actionLabel: "",
      subject: null,
    };
  }

  return {
    kind: "complete",
    title: "Tüm seçili sorular çözüldü",
    message: "Yeni bir set seçerek veya mevcut setleri sıfırlayarak yeni oturum başlatabilirsin.",
    actionLabel: "",
    subject: null,
  };
}

function buildAnalyticsSnapshot({
  loadedSets,
  pendingSession,
  resolveQuestionKey,
  selectedAnswers,
  selectedSetIds,
  activityByDay,
  now = new Date(),
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
  const subjectBreakdownMap = new Map();

  scopedSetIds.forEach((setId) => {
    const setRecord = loadedSetsMap[setId];
    const questions = toSafeArray(setRecord?.questions);
    totalQuestions += questions.length;

    questions.forEach((question, index) => {
      const subject = resolveQuestionSubject(question);
      const subjectStats =
        subjectBreakdownMap.get(subject) || {
          subject,
          totalQuestions: 0,
          solvedQuestions: 0,
          correct: 0,
          wrong: 0,
          remaining: 0,
          accuracy: 0,
          completionRate: 0,
          encounterOrder: subjectBreakdownMap.size,
        };

      subjectStats.totalQuestions += 1;
      const questionKey = resolveQuestionKeyRef(question, setId, index);
      if (selectedAnswersMap[questionKey] === undefined) {
        subjectStats.remaining += 1;
        subjectBreakdownMap.set(subject, subjectStats);
        return;
      }

      solvedQuestions += 1;
      subjectStats.solvedQuestions += 1;
      if (selectedAnswersMap[questionKey] === question.correct) {
        correctAnswers += 1;
        subjectStats.correct += 1;
      } else {
        wrongAnswers += 1;
        subjectStats.wrong += 1;
      }

      subjectBreakdownMap.set(subject, subjectStats);
    });
  });

  const subjectBreakdown = sortSubjectBreakdown(
    Array.from(subjectBreakdownMap.values()).map((subjectStats) => {
      const solvedCount = subjectStats.solvedQuestions || 0;
      const totalCount = subjectStats.totalQuestions || 0;
      return {
        ...subjectStats,
        accuracy: solvedCount > 0 ? Math.round((subjectStats.correct / solvedCount) * 100) : 0,
        completionRate:
          totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0,
      };
    }),
  );
  const completionRate =
    totalQuestions > 0 ? Math.round((solvedQuestions / totalQuestions) * 100) : 0;
  const resultDistribution = {
    correct: correctAnswers,
    wrong: wrongAnswers,
    unanswered: Math.max(totalQuestions - solvedQuestions, 0),
  };
  const activityTrend = buildActivityTrend(activityByDay, now);

  return {
    loadedSetCount: allSetIds.length,
    selectedSetCount: chosenSetIds.length,
    scopedSetCount: scopedSetIds.length,
    totalQuestions,
    solvedQuestions,
    correctAnswers,
    wrongAnswers,
    completionRate,
    lastStudyText: buildLastStudyText(pendingSession),
    resultDistribution,
    subjectBreakdown,
    activityTrend,
    focusRecommendation: buildFocusRecommendation({
      totalQuestions,
      solvedQuestions,
      subjectBreakdown,
    }),
  };
}

const AppAnalyticsSnapshot = Object.freeze({
  buildAnalyticsSnapshot,
  buildActivityTrend,
  normalizeActivityByDay,
  resolveQuestionSubject,
});

export {
  buildAnalyticsSnapshot,
  buildActivityTrend,
  normalizeActivityByDay,
  resolveQuestionSubject,
  AppAnalyticsSnapshot,
};
