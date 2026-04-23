import { buildAnalyticsSnapshot } from "./analytics-snapshot.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;

const MANAGER_DASHBOARD_ID = "analytics-dashboard-manager";
const MANAGER_TOGGLE_ID = "analytics-toggle-btn";
const MANAGER_CLOSE_ID = "analytics-close-btn";
const MANAGER_SUMMARY_ID = "analytics-summary-manager";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function formatAnalyticsHeadline(summary = {}) {
  const loadedSetCount = Number(summary.loadedSetCount) || 0;
  const selectedSetCount = Number(summary.selectedSetCount) || 0;
  const solvedQuestions = Number(summary.solvedQuestions) || 0;
  const totalQuestions = Number(summary.totalQuestions) || 0;
  const completionRate = Number(summary.completionRate) || 0;

  return `${loadedSetCount} yuklu set • ${selectedSetCount} secili • ${solvedQuestions}/${totalQuestions} soru cozuldu • Tamamlanma %${completionRate}`;
}

function buildAnalyticsSummary(options = {}) {
  const snapshot = buildAnalyticsSnapshot(options);
  const subjectBreakdown = [...snapshot.subjectBreakdown]
    .sort(
      (left, right) =>
        (left.encounterOrder || 0) - (right.encounterOrder || 0) ||
        String(left.subject || "").localeCompare(String(right.subject || ""), "tr"),
    )
    .map((item) => ({
      subject: item.subject,
      correct: item.correct,
      total: item.totalQuestions,
      wrong: item.wrong,
    }));

  return {
    loadedSetCount: snapshot.loadedSetCount,
    selectedSetCount: snapshot.selectedSetCount,
    scopedSetCount: snapshot.scopedSetCount,
    totalQuestions: snapshot.totalQuestions,
    solvedQuestions: snapshot.solvedQuestions,
    correctAnswers: snapshot.correctAnswers,
    wrongAnswers: snapshot.wrongAnswers,
    completionRate: snapshot.completionRate,
    lastStudyText: snapshot.lastStudyText,
    subjectBreakdown,
  };
}

function resolveElements(documentRef) {
  return {
    activityMeta: documentRef?.getElementById("analytics-activity-meta") || null,
    activityTrend: documentRef?.getElementById("analytics-activity-trend") || null,
    closeButton: documentRef?.getElementById(MANAGER_CLOSE_ID) || null,
    completionValue: documentRef?.getElementById("analytics-completion-value") || null,
    dashboard: documentRef?.getElementById(MANAGER_DASHBOARD_ID) || null,
    distributionMeta:
      documentRef?.getElementById("analytics-distribution-meta") || null,
    distributionView:
      documentRef?.getElementById("analytics-result-distribution") || null,
    focusAction: documentRef?.getElementById("analytics-focus-action") || null,
    focusCopy: documentRef?.getElementById("analytics-focus-copy") || null,
    focusTitle: documentRef?.getElementById("analytics-focus-title") || null,
    lastStudy: documentRef?.getElementById("analytics-last-study") || null,
    questionsValue: documentRef?.getElementById("analytics-questions-value") || null,
    resultsValue: documentRef?.getElementById("analytics-results-value") || null,
    subjectBreakdownBody:
      documentRef?.getElementById("analytics-subject-breakdown") || null,
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

function renderAnalyticsCard(title, meta, bodyMarkup) {
  return `
    <article class="analytics-card">
      <div class="analytics-card-head">
        <div>
          <div class="analytics-card-title">${title}</div>
          <div class="analytics-card-meta">${meta}</div>
        </div>
      </div>
      <div class="analytics-card-body">${bodyMarkup}</div>
    </article>
  `;
}

function renderEmptyCard(message) {
  return `<div class="analytics-empty-state">${message}</div>`;
}

function renderResultDistribution(distribution = {}) {
  const segments = [
    {
      label: "Dogru",
      value: Number(distribution.correct) || 0,
      className: "is-correct",
    },
    {
      label: "Yanlis",
      value: Number(distribution.wrong) || 0,
      className: "is-wrong",
    },
    {
      label: "Bos",
      value: Number(distribution.unanswered) || 0,
      className: "is-unanswered",
    },
  ];
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + segment.value, 0),
  );

  return `
    <div class="analytics-stacked-bar" role="img" aria-label="Sonuc dagilimi">
      ${segments
        .map(
          (segment) =>
            `<span class="analytics-stacked-segment ${segment.className}" style="width:${(segment.value / total) * 100}%"></span>`,
        )
        .join("")}
    </div>
    <div class="analytics-legend">
      ${segments
        .map(
          (segment) =>
            `<div class="analytics-legend-item"><span class="analytics-legend-dot ${segment.className}"></span><span>${segment.label}</span><strong>${segment.value}</strong></div>`,
        )
        .join("")}
    </div>
  `;
}

function renderActivityChart(points = []) {
  const safePoints = toSafeArray(points);
  if (safePoints.length === 0) {
    return renderEmptyCard("Son 7 gun aktivitesi henuz olusmadi.");
  }

  const width = 280;
  const height = 120;
  const padding = 18;
  const maxValue = Math.max(1, ...safePoints.map((point) => Number(point.total) || 0));
  const stepX =
    safePoints.length > 1 ? (width - padding * 2) / (safePoints.length - 1) : 0;
  const coordinates = safePoints.map((point, index) => {
    const value = Number(point.total) || 0;
    const x = padding + stepX * index;
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return {
      ...point,
      value,
      x,
      y,
    };
  });
  const linePoints = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = [
    `${padding},${height - padding}`,
    ...coordinates.map((point) => `${point.x},${point.y}`),
    `${width - padding},${height - padding}`,
  ].join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="analytics-chart analytics-chart-line" role="img" aria-label="Son 7 gun aktivite trendi">
      <polygon points="${areaPoints}" class="analytics-line-fill"></polygon>
      <polyline points="${linePoints}" class="analytics-line-stroke"></polyline>
      ${coordinates
        .map(
          (point) =>
            `<circle cx="${point.x}" cy="${point.y}" r="3.5" class="analytics-line-point"></circle>`,
        )
        .join("")}
      ${coordinates
        .map(
          (point) =>
            `<text x="${point.x}" y="${height - 4}" text-anchor="middle" class="analytics-axis-label">${point.label}</text>`,
        )
        .join("")}
    </svg>
    <div class="analytics-legend analytics-legend-compact">
      <div class="analytics-legend-item"><span class="analytics-legend-dot is-correct"></span><span>Dogru</span><strong>${safePoints.reduce((sum, point) => sum + (Number(point.correct) || 0), 0)}</strong></div>
      <div class="analytics-legend-item"><span class="analytics-legend-dot is-wrong"></span><span>Yanlis</span><strong>${safePoints.reduce((sum, point) => sum + (Number(point.wrong) || 0), 0)}</strong></div>
      <div class="analytics-legend-item"><span class="analytics-legend-dot is-unanswered"></span><span>Temizlenen</span><strong>${safePoints.reduce((sum, point) => sum + (Number(point.cleared) || 0), 0)}</strong></div>
    </div>
  `;
}

function normalizeRenderSnapshot(summary = {}) {
  const subjectBreakdown = toSafeArray(summary.subjectBreakdown).map((item, index) => {
    const totalQuestions = Number(item?.totalQuestions ?? item?.total) || 0;
    const solvedQuestions = Number(item?.solvedQuestions ?? item?.total) || 0;
    const correct = Number(item?.correct) || 0;
    const wrong = Number(item?.wrong) || 0;
    const remaining = Number(item?.remaining) || Math.max(totalQuestions - solvedQuestions, 0);

    return {
      subject: item?.subject || "Genel",
      totalQuestions,
      solvedQuestions,
      correct,
      wrong,
      remaining,
      accuracy:
        Number(item?.accuracy) ||
        (solvedQuestions > 0 ? Math.round((correct / solvedQuestions) * 100) : 0),
      encounterOrder: Number(item?.encounterOrder) || index,
    };
  });
  const totalQuestions = Number(summary.totalQuestions) || 0;
  const solvedQuestions = Number(summary.solvedQuestions) || 0;
  const correctAnswers = Number(summary.correctAnswers) || 0;
  const wrongAnswers = Number(summary.wrongAnswers) || 0;

  return {
    loadedSetCount: Number(summary.loadedSetCount) || 0,
    selectedSetCount: Number(summary.selectedSetCount) || 0,
    scopedSetCount: Number(summary.scopedSetCount) || 0,
    totalQuestions,
    solvedQuestions,
    correctAnswers,
    wrongAnswers,
    completionRate: Number(summary.completionRate) || 0,
    lastStudyText: summary.lastStudyText || "Son calisma: Henuz baslanmadi",
    resultDistribution: summary.resultDistribution || {
      correct: correctAnswers,
      wrong: wrongAnswers,
      unanswered: Math.max(totalQuestions - solvedQuestions, 0),
    },
    subjectBreakdown,
    activityTrend: toSafeArray(summary.activityTrend),
    focusRecommendation:
      summary.focusRecommendation ||
      (subjectBreakdown[0]
        ? {
            kind: "subject",
            title: `${subjectBreakdown[0].subject} ile devam et`,
            message: `${subjectBreakdown[0].remaining} soru bu konuda seni bekliyor.`,
            actionLabel: `${subjectBreakdown[0].subject} odagina gec`,
            subject: subjectBreakdown[0].subject,
          }
        : {
            kind: "empty",
            title: "Henüz veri yok",
            message: "Setlerde ilerleme olustukca odak onerisi burada gorunecek.",
            actionLabel: "",
            subject: null,
          }),
  };
}

function renderSubjectBreakdownTable({
  body,
  documentRef,
  onSubjectSelect,
  subjectBreakdown,
}) {
  if (!body) {
    return;
  }

  body.replaceChildren();
  if (subjectBreakdown.length === 0) {
    const row = documentRef?.createElement("tr");
    const cell = documentRef?.createElement("td");
    if (!row || !cell) {
      return;
    }

    cell.colSpan = 4;
    cell.className = "analytics-subject-breakdown-empty";
    cell.textContent = "Konu bazli veri yok";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  subjectBreakdown.forEach((item) => {
    const row = documentRef?.createElement("tr");
    if (!row) {
      return;
    }

    const subjectCell = documentRef?.createElement("th");
    const progressCell = documentRef?.createElement("td");
    const accuracyCell = documentRef?.createElement("td");
    const remainingCell = documentRef?.createElement("td");
    if (!subjectCell || !progressCell || !accuracyCell || !remainingCell) {
      return;
    }

    subjectCell.scope = "row";
    if (typeof onSubjectSelect === "function" && item.remaining > 0) {
      const button = documentRef?.createElement("button");
      if (button) {
        button.type = "button";
        button.className = "analytics-subject-button";
        button.textContent = item.subject;
        button.addEventListener("click", () => {
          onSubjectSelect(item.subject);
        });
        subjectCell.appendChild(button);
      } else {
        subjectCell.textContent = item.subject;
      }
    } else {
      subjectCell.textContent = item.subject;
    }

    progressCell.textContent = `${item.solvedQuestions} / ${item.totalQuestions}`;
    accuracyCell.textContent = `%${item.accuracy}`;
    remainingCell.textContent = String(item.remaining);

    row.appendChild(subjectCell);
    row.appendChild(progressCell);
    row.appendChild(accuracyCell);
    row.appendChild(remainingCell);
    body.appendChild(row);
  });
}

function renderFocusRecommendation({ elements, recommendation, onSubjectSelect }) {
  if (elements.focusTitle) {
    elements.focusTitle.textContent = recommendation?.title || "Henüz öneri yok";
  }
  if (elements.focusCopy) {
    elements.focusCopy.textContent =
      recommendation?.message || "Setlerde ilerleme olustukca odak onerisi burada gorunecek.";
  }
  if (!elements.focusAction) {
    return;
  }

  elements.focusAction.hidden = !(
    recommendation?.kind === "subject" &&
    typeof recommendation?.subject === "string" &&
    recommendation.subject.trim()
  );
  elements.focusAction.textContent =
    recommendation?.actionLabel || "Bu konuya odaklan";
  elements.focusAction.onclick = null;

  if (!elements.focusAction.hidden && typeof onSubjectSelect === "function") {
    elements.focusAction.onclick = () => {
      onSubjectSelect(recommendation.subject);
    };
  }
}

function createAnalyticsPanelController({
  documentRef = globalScope.document,
  stateRef = globalScope.AppState,
  onSubjectSelect = null,
  onVisibilityChange = null,
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
    const state = resolvePanelState();
    const visible = Boolean(nextVisible);
    state.isVisible = visible;
    const syncedVisible = syncVisibility();
    if (typeof onVisibilityChange === "function") {
      onVisibilityChange(syncedVisible);
    }
    return syncedVisible;
  }

  function renderSummary(summary = {}) {
    const snapshot = normalizeRenderSnapshot(summary);
    const elements = resolveElements(documentRef);

    if (elements.summary) {
      elements.summary.textContent = formatAnalyticsHeadline(snapshot);
    }
    if (elements.setsValue) {
      elements.setsValue.textContent = `${snapshot.loadedSetCount} / ${snapshot.selectedSetCount}`;
    }
    if (elements.setsMeta) {
      elements.setsMeta.textContent = "Yuklu / secili set";
    }
    if (elements.questionsValue) {
      elements.questionsValue.textContent = `${snapshot.totalQuestions} / ${snapshot.solvedQuestions}`;
    }
    if (elements.resultsValue) {
      elements.resultsValue.textContent = `${snapshot.correctAnswers} / ${snapshot.wrongAnswers}`;
    }
    if (elements.completionValue) {
      elements.completionValue.textContent = `%${snapshot.completionRate}`;
    }
    if (elements.lastStudy) {
      elements.lastStudy.textContent = snapshot.lastStudyText;
    }
    if (elements.distributionMeta) {
      elements.distributionMeta.textContent = `Dogru ${snapshot.resultDistribution.correct} • Yanlis ${snapshot.resultDistribution.wrong} • Bos ${snapshot.resultDistribution.unanswered}`;
    }
    if (elements.distributionView) {
      elements.distributionView.innerHTML = snapshot.totalQuestions
        ? renderResultDistribution(snapshot.resultDistribution)
        : renderEmptyCard("Sonuc dagilimi, cevaplar olustukca burada gosterilecek.");
    }
    if (elements.activityMeta) {
      const totalActivity = snapshot.activityTrend.reduce(
        (sum, point) => sum + (Number(point.total) || 0),
        0,
      );
      elements.activityMeta.textContent = `Son 7 gun • ${totalActivity} hareket`;
    }
    if (elements.activityTrend) {
      elements.activityTrend.innerHTML = renderActivityChart(snapshot.activityTrend);
    }

    renderFocusRecommendation({
      elements,
      recommendation: snapshot.focusRecommendation,
      onSubjectSelect,
    });
    renderSubjectBreakdownTable({
      body: elements.subjectBreakdownBody,
      documentRef,
      onSubjectSelect,
      subjectBreakdown: snapshot.subjectBreakdown,
    });
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
  buildAnalyticsSnapshot,
  buildAnalyticsSummary,
  createAnalyticsPanelController,
  formatAnalyticsHeadline,
});

export {
  buildAnalyticsSnapshot,
  buildAnalyticsSummary,
  createAnalyticsPanelController,
  formatAnalyticsHeadline,
  AppAnalytics,
};
