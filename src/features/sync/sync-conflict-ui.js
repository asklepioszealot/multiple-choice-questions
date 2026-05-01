export function formatSyncConflictSummary(summary = {}) {
  return `${summary.setCount || 0} set, ${summary.questionCount || 0} soru, ${summary.answeredCount || 0} cevap`;
}

export function formatConflictTimestamp(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return new Date(parsed).toLocaleString("tr-TR", {
    hour12: false,
  });
}

export function formatConflictFreshness(newerSide) {
  if (newerSide === "local") {
    return "Yerel daha yeni";
  }

  if (newerSide === "remote") {
    return "Bulut daha yeni";
  }

  return "Iki taraf da degismis";
}

export function hasRenderableStudyDiff(conflict, studySummary = {}) {
  const studyDiff = conflict?.studyDiff || {};

  return Boolean(
    conflict?.studyConflict ||
      studyDiff.activeQuestionChanged ||
      studyDiff.activityChanged ||
      studyDiff.analyticsVisibilityChanged ||
      studyDiff.topicChanged ||
      (studySummary.localAnsweredCount || 0) > 0 ||
      (studySummary.remoteAnsweredCount || 0) > 0 ||
      (studySummary.localActivityCount || 0) > 0 ||
      (studySummary.remoteActivityCount || 0) > 0 ||
      studySummary.localAnalyticsVisible === true ||
      studySummary.remoteAnalyticsVisible === true ||
      (studySummary.localTopic || "hepsi") !== "hepsi" ||
      (studySummary.remoteTopic || "hepsi") !== "hepsi",
  );
}

export function buildSyncConflictDetailLines(conflict, side) {
  const lines = [];
  const decisionEnvelope = conflict?.decisionEnvelope || {};
  const studySummary = decisionEnvelope.studyStateSummary || {};

  (decisionEnvelope.blockingConflicts || []).forEach((entry) => {
    const timestamp =
      side === "local"
        ? formatConflictTimestamp(entry.localUpdatedAt)
        : formatConflictTimestamp(entry.remoteUpdatedAt);
    lines.push(
      `${entry.setName}: ${formatConflictFreshness(entry.newerSide)}${timestamp ? ` | Son degisim: ${timestamp}` : ""} | Soru farki: ${entry.questionDelta || 0} | Cevap farki: ${entry.answerDelta || 0}`,
    );
  });

  if (hasRenderableStudyDiff(conflict, studySummary)) {
    const answeredCount =
      side === "local"
        ? studySummary.localAnsweredCount
        : studySummary.remoteAnsweredCount;
    const topic =
      side === "local" ? studySummary.localTopic : studySummary.remoteTopic;
    const activityCount =
      side === "local"
        ? studySummary.localActivityCount
        : studySummary.remoteActivityCount;
    const analyticsVisible =
      side === "local"
        ? studySummary.localAnalyticsVisible
        : studySummary.remoteAnalyticsVisible;
    lines.push(`İlerleme: ${answeredCount || 0} cevap`);
    lines.push(`Konu filtresi: ${topic || "hepsi"}`);
    lines.push(`Aktivite: ${activityCount || 0} hareket`);
    lines.push(`Analytics paneli: ${analyticsVisible ? "Acik" : "Kapali"}`);
    if ((studySummary.blockingAnswerCount || 0) > 0) {
      lines.push(
        `Cakisan cevap sayisi: ${studySummary.blockingAnswerCount || 0}`,
      );
    }
  }

  if (lines.length === 0) {
    lines.push("Ek fark bilgisi yok.");
  }

  return lines;
}

export function renderSyncConflictDetailList(elementId, lines, documentRef = document) {
  const listEl = documentRef.getElementById(elementId);
  if (!listEl) {
    return;
  }

  listEl.innerHTML = "";
  lines.forEach((line) => {
    const item = documentRef.createElement("li");
    item.textContent = line;
    listEl.appendChild(item);
  });
}

export function renderSyncConflictPanel(pendingSyncConflict, documentRef = document) {
  const panel = documentRef.getElementById("sync-conflict-panel");
  const localSummaryEl = documentRef.getElementById("sync-conflict-local-summary");
  const remoteSummaryEl = documentRef.getElementById("sync-conflict-remote-summary");
  const messageEl = documentRef.getElementById("sync-conflict-message");
  const localDetailList = documentRef.getElementById("sync-conflict-local-details");
  const remoteDetailList = documentRef.getElementById("sync-conflict-remote-details");

  if (
    !panel ||
    !localSummaryEl ||
    !remoteSummaryEl ||
    !messageEl ||
    !localDetailList ||
    !remoteDetailList
  ) {
    return;
  }

  if (!pendingSyncConflict) {
    panel.style.display = "none";
    messageEl.textContent = "";
    localSummaryEl.textContent = "";
    remoteSummaryEl.textContent = "";
    localDetailList.innerHTML = "";
    remoteDetailList.innerHTML = "";
    return;
  }

  panel.style.display = "flex";
  const blockingSetCount =
    pendingSyncConflict.conflict?.decisionEnvelope?.blockingConflicts?.length || 0;
  messageEl.textContent =
    blockingSetCount > 0
      ? `${blockingSetCount} sette iki taraf da degismis. Hangisi esas alinsin?`
      : "Yerel çalışma alanı ile bulut verisi farklı. Hangisi esas alınsın?";
  localSummaryEl.textContent = formatSyncConflictSummary(
    pendingSyncConflict.conflict.localSummary,
  );
  remoteSummaryEl.textContent = formatSyncConflictSummary(
    pendingSyncConflict.conflict.remoteSummary,
  );
  renderSyncConflictDetailList(
    "sync-conflict-local-details",
    buildSyncConflictDetailLines(pendingSyncConflict.conflict, "local"),
    documentRef,
  );
  renderSyncConflictDetailList(
    "sync-conflict-remote-details",
    buildSyncConflictDetailLines(pendingSyncConflict.conflict, "remote"),
    documentRef,
  );
}
