const globalScope = typeof window !== "undefined" ? window : globalThis;

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function toSafeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function hasMeaningfulWorkspace(seed) {
    return Boolean(seed && Object.keys(toSafeObject(seed.loadedSets)).length > 0);
  }

  function hasMeaningfulStudySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    return Boolean(
      toSafeArray(snapshot.selectedSetIds).length > 0 ||
        Object.keys(toSafeObject(snapshot.selectedAnswers)).length > 0 ||
        Object.keys(toSafeObject(snapshot.solutionVisible)).length > 0 ||
        (snapshot.session &&
          typeof snapshot.session === "object" &&
          ((typeof snapshot.session.currentQuestionKey === "string" &&
            snapshot.session.currentQuestionKey.trim()) ||
            (Number.isInteger(snapshot.session.currentQuestionIndex) &&
              snapshot.session.currentQuestionIndex > 0))),
    );
  }

  function normalizeQuestion(question) {
    const normalized = question && typeof question === "object" ? question : {};
    return {
      id:
        typeof normalized.id === "string" || typeof normalized.id === "number"
          ? normalized.id
          : null,
      q: typeof normalized.q === "string" ? normalized.q : "",
      options: toSafeArray(normalized.options).map((option) => String(option ?? "")),
      correct: Number.isInteger(normalized.correct) ? normalized.correct : 0,
      explanation:
        typeof normalized.explanation === "string" ? normalized.explanation : "",
      subject: typeof normalized.subject === "string" ? normalized.subject : "Genel",
    };
  }

  function buildWorkspaceRecordMatchKey(record) {
    const sourcePath = String(record?.sourcePath || "").trim();
    if (sourcePath) {
      return `source:${sourcePath}`;
    }

    const fileName = String(record?.fileName || "").trim().toLowerCase();
    if (fileName) {
      return `file:${fileName}`;
    }

    const id = String(record?.id || "").trim();
    if (id) {
      return `id:${id}`;
    }

    return "";
  }

  function normalizeWorkspaceRecord(record, setIdOverride = "") {
    const normalized = record && typeof record === "object" ? record : {};
    const id =
      typeof setIdOverride === "string" && setIdOverride.trim()
        ? setIdOverride.trim()
        : typeof normalized.id === "string" && normalized.id.trim()
          ? normalized.id.trim()
          : "";

    return {
      id,
      setName: typeof normalized.setName === "string" ? normalized.setName : "",
      fileName: typeof normalized.fileName === "string" ? normalized.fileName : "",
      sourceFormat:
        typeof normalized.sourceFormat === "string" ? normalized.sourceFormat : "json",
      sourcePath:
        typeof normalized.sourcePath === "string" ? normalized.sourcePath : "",
      updatedAt:
        typeof normalized.updatedAt === "string" ? normalized.updatedAt : "",
      questions: toSafeArray(normalized.questions).map(normalizeQuestion),
    };
  }

  function normalizeWorkspaceSeed(seed) {
    const loadedSets = toSafeObject(seed?.loadedSets);
    const normalizedLoadedSets = {};

    Object.entries(loadedSets).forEach(([setId, record]) => {
      const normalizedRecord = normalizeWorkspaceRecord(record, setId);
      if (normalizedRecord.id) {
        normalizedLoadedSets[normalizedRecord.id] = normalizedRecord;
      }
    });

    return {
      loadedSets: normalizedLoadedSets,
      selectedSetIds: toSafeArray(seed?.selectedSetIds)
        .map((setId) => String(setId || "").trim())
        .filter(Boolean)
        .sort(),
    };
  }

  function createRemoteWorkspaceSeed(records, selectedSetIds = []) {
    const loadedSets = {};
    toSafeArray(records).forEach((record) => {
      const normalized = normalizeWorkspaceRecord(record);
      if (normalized.id) {
        loadedSets[normalized.id] = normalized;
      }
    });

    return normalizeWorkspaceSeed({
      loadedSets,
      selectedSetIds,
    });
  }

  function normalizeStudySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    return {
      selectedSetIds: toSafeArray(snapshot.selectedSetIds)
        .map((setId) => String(setId || "").trim())
        .filter(Boolean)
        .sort(),
      selectedAnswers: toSafeObject(snapshot.selectedAnswers),
      solutionVisible: toSafeObject(snapshot.solutionVisible),
      session:
        snapshot.session && typeof snapshot.session === "object"
          ? {
              currentQuestionIndex: Number.isInteger(snapshot.session.currentQuestionIndex)
                ? snapshot.session.currentQuestionIndex
                : 0,
              currentQuestionKey:
                typeof snapshot.session.currentQuestionKey === "string"
                  ? snapshot.session.currentQuestionKey
                  : "",
              selectedTopic:
                typeof snapshot.session.selectedTopic === "string"
                  ? snapshot.session.selectedTopic
                  : "hepsi",
            }
          : null,
      autoAdvanceEnabled: snapshot.autoAdvanceEnabled !== false,
      updatedAt:
        typeof snapshot.updatedAt === "string" && snapshot.updatedAt.trim()
          ? snapshot.updatedAt.trim()
          : "",
    };
  }

  function summarizeWorkspace(seed) {
    const normalizedSeed = normalizeWorkspaceSeed(seed);
    const records = Object.values(normalizedSeed.loadedSets);
    return {
      setCount: records.length,
      questionCount: records.reduce(
        (total, record) => total + toSafeArray(record.questions).length,
        0,
      ),
      selectedSetCount: normalizedSeed.selectedSetIds.length,
    };
  }

  function summarizeStudySnapshot(snapshot) {
    const normalized = normalizeStudySnapshot(snapshot);
    if (!normalized) {
      return {
        answeredCount: 0,
      };
    }

    return {
      answeredCount: Object.keys(normalized.selectedAnswers).length,
    };
  }

  function recordSignature(record) {
    return JSON.stringify({
      fileName: record.fileName,
      questions: record.questions,
      setName: record.setName,
      sourceFormat: record.sourceFormat,
    });
  }

  function compareTimestamps(leftValue, rightValue) {
    const leftTime = Date.parse(leftValue || "");
    const rightTime = Date.parse(rightValue || "");

    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
      if (leftTime > rightTime) return "local";
      if (rightTime > leftTime) return "remote";
    }

    return "equal";
  }

  function pickCanonicalRecord(leftRecord, rightRecord) {
    if (!leftRecord) return rightRecord || null;
    if (!rightRecord) return leftRecord || null;

    const freshness = compareTimestamps(leftRecord.updatedAt, rightRecord.updatedAt);
    const chosen =
      freshness === "remote"
        ? rightRecord
        : freshness === "local"
          ? leftRecord
          : rightRecord;
    const preservedSourcePath = String(
      chosen?.sourcePath || leftRecord.sourcePath || rightRecord.sourcePath || "",
    ).trim();

    return preservedSourcePath
      ? {
          ...chosen,
          sourcePath: preservedSourcePath,
        }
      : chosen;
  }

  function areWorkspaceSeedsEquivalent(leftSeed, rightSeed) {
    return (
      JSON.stringify(normalizeWorkspaceSeed(leftSeed)) ===
      JSON.stringify(normalizeWorkspaceSeed(rightSeed))
    );
  }

  function preserveChosenRecord(chosenRecord, fallbackRecord = null) {
    if (!chosenRecord) {
      return fallbackRecord || null;
    }

    const preservedSourcePath = String(
      chosenRecord?.sourcePath || fallbackRecord?.sourcePath || "",
    ).trim();

    return preservedSourcePath
      ? {
          ...chosenRecord,
          sourcePath: preservedSourcePath,
        }
      : chosenRecord;
  }

  function countQuestionDifferences(localRecord, remoteRecord) {
    const localQuestions = toSafeArray(localRecord?.questions).map((question) =>
      JSON.stringify(normalizeQuestion(question)),
    );
    const remoteQuestions = toSafeArray(remoteRecord?.questions).map((question) =>
      JSON.stringify(normalizeQuestion(question)),
    );
    const total = Math.max(localQuestions.length, remoteQuestions.length);
    let differenceCount = 0;

    for (let index = 0; index < total; index += 1) {
      if ((localQuestions[index] || null) !== (remoteQuestions[index] || null)) {
        differenceCount += 1;
      }
    }

    return differenceCount;
  }

  function buildSetAnswerMap(snapshot, setId) {
    const normalizedSnapshot = normalizeStudySnapshot(snapshot);
    if (!normalizedSnapshot || !setId) {
      return {};
    }

    const answers = {};
    Object.entries(normalizedSnapshot.selectedAnswers).forEach(([key, value]) => {
      const match = key.match(/^set:([^:]+)::(id|idx):(.*)$/);
      if (!match || String(match[1] || "") !== String(setId)) {
        return;
      }

      answers[`${match[2]}:${match[3]}`] = value;
    });

    return answers;
  }

  function countMapDifferences(localMap, remoteMap) {
    const allKeys = new Set([
      ...Object.keys(toSafeObject(localMap)),
      ...Object.keys(toSafeObject(remoteMap)),
    ]);
    let differenceCount = 0;

    [...allKeys].forEach((key) => {
      if (
        !Object.prototype.hasOwnProperty.call(localMap, key) ||
        !Object.prototype.hasOwnProperty.call(remoteMap, key) ||
        localMap[key] !== remoteMap[key]
      ) {
        differenceCount += 1;
      }
    });

    return differenceCount;
  }

  function buildSetDeltaSummary(
    localRecord,
    remoteRecord,
    localSnapshot,
    remoteSnapshot,
  ) {
    const localAnswers = buildSetAnswerMap(localSnapshot, localRecord?.id || "");
    const remoteAnswers = buildSetAnswerMap(remoteSnapshot, remoteRecord?.id || "");

    return {
      localQuestionCount: toSafeArray(localRecord?.questions).length,
      remoteQuestionCount: toSafeArray(remoteRecord?.questions).length,
      questionDelta: countQuestionDifferences(localRecord, remoteRecord),
      localAnswerCount: Object.keys(localAnswers).length,
      remoteAnswerCount: Object.keys(remoteAnswers).length,
      answerDelta: countMapDifferences(localAnswers, remoteAnswers),
    };
  }

  function buildMergeableSetEntry(
    matchKey,
    localRecord,
    remoteRecord,
    chosenSide,
    reason,
    localSnapshot,
    remoteSnapshot,
  ) {
    const mergedRecord = preserveChosenRecord(
      chosenSide === "local" ? localRecord : remoteRecord,
      chosenSide === "local" ? remoteRecord : localRecord,
    );

    return {
      answerDelta: buildSetDeltaSummary(
        localRecord,
        remoteRecord,
        localSnapshot,
        remoteSnapshot,
      ).answerDelta,
      chosenSide,
      localAnswerCount: buildSetDeltaSummary(
        localRecord,
        remoteRecord,
        localSnapshot,
        remoteSnapshot,
      ).localAnswerCount,
      localId: localRecord?.id || "",
      localQuestionCount: buildSetDeltaSummary(
        localRecord,
        remoteRecord,
        localSnapshot,
        remoteSnapshot,
      ).localQuestionCount,
      localUpdatedAt: localRecord?.updatedAt || "",
      matchKey,
      mergedRecord,
      newerSide: compareTimestamps(localRecord?.updatedAt, remoteRecord?.updatedAt),
      questionDelta: buildSetDeltaSummary(
        localRecord,
        remoteRecord,
        localSnapshot,
        remoteSnapshot,
      ).questionDelta,
      reason,
      remoteAnswerCount: buildSetDeltaSummary(
        localRecord,
        remoteRecord,
        localSnapshot,
        remoteSnapshot,
      ).remoteAnswerCount,
      remoteId: remoteRecord?.id || "",
      remoteQuestionCount: buildSetDeltaSummary(
        localRecord,
        remoteRecord,
        localSnapshot,
        remoteSnapshot,
      ).remoteQuestionCount,
      remoteUpdatedAt: remoteRecord?.updatedAt || "",
      setName:
        localRecord?.setName ||
        remoteRecord?.setName ||
        localRecord?.id ||
        remoteRecord?.id ||
        "Set",
    };
  }

  function buildBlockingConflictEntry(
    matchKey,
    localRecord,
    remoteRecord,
    localSnapshot,
    remoteSnapshot,
  ) {
    const deltaSummary = buildSetDeltaSummary(
      localRecord,
      remoteRecord,
      localSnapshot,
      remoteSnapshot,
    );

    return {
      ...deltaSummary,
      localId: localRecord?.id || "",
      localUpdatedAt: localRecord?.updatedAt || "",
      matchKey,
      newerSide: compareTimestamps(localRecord?.updatedAt, remoteRecord?.updatedAt),
      remoteId: remoteRecord?.id || "",
      remoteUpdatedAt: remoteRecord?.updatedAt || "",
      setName:
        localRecord?.setName ||
        remoteRecord?.setName ||
        localRecord?.id ||
        remoteRecord?.id ||
        "Set",
    };
  }

  function classifyMatchedSet(
    matchKey,
    localRecord,
    remoteRecord,
    localSnapshot,
    remoteSnapshot,
  ) {
    if (localRecord && !remoteRecord) {
      const entry = buildMergeableSetEntry(
        matchKey,
        localRecord,
        remoteRecord,
        "local",
        "local-only",
        localSnapshot,
        remoteSnapshot,
      );
      return {
        decision: entry,
        kind: "mergeable",
        mergedRecord: entry.mergedRecord,
        remoteIdToDelete: "",
        shouldUpload: true,
      };
    }

    if (!localRecord && remoteRecord) {
      const entry = buildMergeableSetEntry(
        matchKey,
        localRecord,
        remoteRecord,
        "remote",
        "remote-only",
        localSnapshot,
        remoteSnapshot,
      );
      return {
        decision: entry,
        kind: "mergeable",
        mergedRecord: entry.mergedRecord,
        remoteIdToDelete: "",
        shouldUpload: false,
      };
    }

    if (!localRecord || !remoteRecord) {
      return {
        decision: null,
        kind: "none",
        mergedRecord: null,
        remoteIdToDelete: "",
        shouldUpload: false,
      };
    }

    if (recordSignature(localRecord) === recordSignature(remoteRecord)) {
      const entry = buildMergeableSetEntry(
        matchKey,
        localRecord,
        remoteRecord,
        "remote",
        "same-content",
        localSnapshot,
        remoteSnapshot,
      );
      return {
        decision: entry,
        kind: "mergeable",
        mergedRecord: entry.mergedRecord,
        remoteIdToDelete: "",
        shouldUpload: false,
      };
    }

    const newerSide = compareTimestamps(localRecord.updatedAt, remoteRecord.updatedAt);
    if (newerSide === "local" || newerSide === "remote") {
      const entry = buildMergeableSetEntry(
        matchKey,
        localRecord,
        remoteRecord,
        newerSide,
        `${newerSide}-newer`,
        localSnapshot,
        remoteSnapshot,
      );

      return {
        decision: entry,
        kind: "mergeable",
        mergedRecord: entry.mergedRecord,
        remoteIdToDelete:
          newerSide === "local" &&
          remoteRecord?.id &&
          localRecord?.id &&
          remoteRecord.id !== localRecord.id
            ? remoteRecord.id
            : "",
        shouldUpload: newerSide === "local",
      };
    }

    return {
      decision: buildBlockingConflictEntry(
        matchKey,
        localRecord,
        remoteRecord,
        localSnapshot,
        remoteSnapshot,
      ),
      kind: "blocking",
      mergedRecord: null,
      remoteIdToDelete: "",
      shouldUpload: false,
    };
  }

  function reconcileWorkspaces(
    localWorkspace,
    remoteWorkspace,
    localSnapshot,
    remoteSnapshot,
  ) {
    const localMap = createWorkspaceMatchMap(localWorkspace);
    const remoteMap = createWorkspaceMatchMap(remoteWorkspace);
    const allMatchKeys = new Set([...localMap.keys(), ...remoteMap.keys()]);
    const mergedLoadedSets = {};
    const localToMergedSetIdMap = {};
    const remoteToMergedSetIdMap = {};
    const mergeableSets = [];
    const blockingConflicts = [];
    const recordsToUpload = [];
    const remoteIdsToDelete = [];

    [...allMatchKeys]
      .sort()
      .forEach((matchKey) => {
        const localRecord = localMap.get(matchKey) || null;
        const remoteRecord = remoteMap.get(matchKey) || null;
        const classification = classifyMatchedSet(
          matchKey,
          localRecord,
          remoteRecord,
          localSnapshot,
          remoteSnapshot,
        );

        if (classification.kind === "mergeable" && classification.decision) {
          const mergedRecord = classification.mergedRecord;
          mergeableSets.push({
            ...classification.decision,
          });

          if (mergedRecord?.id) {
            mergedLoadedSets[mergedRecord.id] = mergedRecord;
            if (localRecord?.id) {
              localToMergedSetIdMap[localRecord.id] = mergedRecord.id;
            }
            if (remoteRecord?.id) {
              remoteToMergedSetIdMap[remoteRecord.id] = mergedRecord.id;
            }
          }

          if (classification.shouldUpload && mergedRecord) {
            recordsToUpload.push(mergedRecord);
          }

          if (classification.remoteIdToDelete) {
            remoteIdsToDelete.push(classification.remoteIdToDelete);
          }
          return;
        }

        if (classification.kind === "blocking" && classification.decision) {
          blockingConflicts.push(classification.decision);
        }
      });

    return {
      blockingConflicts,
      localMap,
      localToMergedSetIdMap,
      mergeableSets,
      mergedLoadedSets,
      recordsToUpload,
      remoteIdsToDelete,
      remoteMap,
      remoteToMergedSetIdMap,
    };
  }

  function createWorkspaceMatchMap(workspace) {
    const normalizedWorkspace = normalizeWorkspaceSeed(workspace);
    const matchMap = new Map();

    Object.values(normalizedWorkspace.loadedSets).forEach((record) => {
      const matchKey = buildWorkspaceRecordMatchKey(record);
      if (!matchKey) {
        return;
      }

      const existing = matchMap.get(matchKey);
      matchMap.set(matchKey, existing ? pickCanonicalRecord(existing, record) : record);
    });

    return matchMap;
  }

  function remapStudyStateKey(key, setIdMap) {
    if (typeof key !== "string") {
      return key;
    }

    const match = key.match(/^set:([^:]+)::(id|idx):(.*)$/);
    if (!match) {
      return key;
    }

    const currentSetId = String(match[1] || "");
    const nextSetId = String(setIdMap?.[currentSetId] || currentSetId);
    return `set:${nextSetId}::${match[2]}:${match[3]}`;
  }

  function remapStudySnapshot(snapshot, setIdMap) {
    const normalized = normalizeStudySnapshot(snapshot);
    if (!normalized) {
      return null;
    }

    const selectedAnswers = {};
    Object.entries(normalized.selectedAnswers).forEach(([key, value]) => {
      selectedAnswers[remapStudyStateKey(key, setIdMap)] = value;
    });

    const solutionVisible = {};
    Object.entries(normalized.solutionVisible).forEach(([key, value]) => {
      solutionVisible[remapStudyStateKey(key, setIdMap)] = value;
    });

    const currentQuestionKey = normalized.session?.currentQuestionKey
      ? remapStudyStateKey(normalized.session.currentQuestionKey, setIdMap)
      : "";

    return {
      ...normalized,
      selectedSetIds: normalized.selectedSetIds
        .map((setId) => String(setIdMap?.[setId] || setId))
        .filter(Boolean)
        .sort(),
      selectedAnswers,
      solutionVisible,
      session: normalized.session
        ? {
            ...normalized.session,
            currentQuestionKey,
          }
        : null,
    };
  }

  function countRemappedAnswerKeys(snapshot, setIdMap) {
    const normalized = normalizeStudySnapshot(snapshot);
    if (!normalized) {
      return 0;
    }

    return Object.keys(normalized.selectedAnswers).reduce((total, key) => {
      return remapStudyStateKey(key, setIdMap) !== key ? total + 1 : total;
    }, 0);
  }

  function mergeSelectedAnswerMaps(localMap, remoteMap) {
    const merged = { ...remoteMap };
    let hasConflict = false;
    const conflictingKeys = [];

    Object.entries(localMap).forEach(([key, value]) => {
      if (Object.prototype.hasOwnProperty.call(merged, key) && merged[key] !== value) {
        hasConflict = true;
        conflictingKeys.push(key);
        return;
      }
      merged[key] = value;
    });

    return {
      conflictingKeys,
      hasConflict,
      merged,
    };
  }

  function mergeSolutionVisibleMaps(localMap, remoteMap, newerSide) {
    return newerSide === "remote"
      ? {
          ...localMap,
          ...remoteMap,
        }
      : {
          ...remoteMap,
          ...localMap,
        };
  }

  function areStudySnapshotsEquivalent(leftSnapshot, rightSnapshot) {
    return (
      JSON.stringify(normalizeStudySnapshot(leftSnapshot)) ===
      JSON.stringify(normalizeStudySnapshot(rightSnapshot))
    );
  }

  function mergeStudySnapshots(
    localSnapshot,
    remoteSnapshot,
    localToMergedSetIdMap,
    remoteToMergedSetIdMap,
  ) {
    const remappedLocal = remapStudySnapshot(localSnapshot, localToMergedSetIdMap);
    const remappedRemote = remapStudySnapshot(remoteSnapshot, remoteToMergedSetIdMap);

    if (!remappedLocal && !remappedRemote) {
      return {
        autoCarriedAnswerCount: 0,
        blockingAnswerCount: 0,
        hasConflict: false,
        local: null,
        mergedSnapshot: null,
        newerSide: "equal",
        remote: null,
        shouldPersist: false,
      };
    }

    if (!remappedLocal || !remappedRemote) {
      const mergedSnapshot = remappedLocal || remappedRemote;
      return {
        autoCarriedAnswerCount: remappedLocal
          ? countRemappedAnswerKeys(localSnapshot, localToMergedSetIdMap)
          : countRemappedAnswerKeys(remoteSnapshot, remoteToMergedSetIdMap),
        blockingAnswerCount: 0,
        hasConflict: false,
        local: remappedLocal,
        mergedSnapshot,
        newerSide: remappedLocal ? "local" : "remote",
        remote: remappedRemote,
        shouldPersist: Boolean(remappedLocal && !remappedRemote),
      };
    }

    const newerSide = compareTimestamps(remappedLocal.updatedAt, remappedRemote.updatedAt);
    const mergedAnswers = mergeSelectedAnswerMaps(
      remappedLocal.selectedAnswers,
      remappedRemote.selectedAnswers,
    );
    const mergedSnapshot = {
      selectedSetIds: [...new Set([
        ...toSafeArray(remappedLocal.selectedSetIds),
        ...toSafeArray(remappedRemote.selectedSetIds),
      ])].sort(),
      selectedAnswers: mergedAnswers.merged,
      solutionVisible: mergeSolutionVisibleMaps(
        remappedLocal.solutionVisible,
        remappedRemote.solutionVisible,
        newerSide,
      ),
      session:
        newerSide === "remote"
          ? remappedRemote.session || remappedLocal.session
          : remappedLocal.session || remappedRemote.session,
      autoAdvanceEnabled:
        newerSide === "remote"
          ? remappedRemote.autoAdvanceEnabled
          : remappedLocal.autoAdvanceEnabled,
      updatedAt:
        newerSide === "remote"
          ? remappedRemote.updatedAt || remappedLocal.updatedAt
          : remappedLocal.updatedAt || remappedRemote.updatedAt,
    };
    const primaryAnswers =
      newerSide === "remote"
        ? remappedRemote.selectedAnswers
        : remappedLocal.selectedAnswers;
    const secondaryAnswers =
      newerSide === "remote"
        ? remappedLocal.selectedAnswers
        : remappedRemote.selectedAnswers;
    const autoCarriedAnswerCount =
      newerSide === "equal"
        ? 0
        : Object.entries(secondaryAnswers).reduce((total, [key, value]) => {
            if (
              !Object.prototype.hasOwnProperty.call(primaryAnswers, key) &&
              mergedAnswers.merged[key] === value
            ) {
              return total + 1;
            }

            return total;
          }, 0);

    return {
      autoCarriedAnswerCount,
      blockingAnswerCount: mergedAnswers.conflictingKeys.length,
      hasConflict: mergedAnswers.hasConflict,
      local: remappedLocal,
      mergedSnapshot,
      newerSide,
      remote: remappedRemote,
      shouldPersist:
        !mergedAnswers.hasConflict &&
        !areStudySnapshotsEquivalent(mergedSnapshot, remappedRemote),
    };
  }

  function buildWorkspaceDiff(localMap, remoteMap) {
    const allMatchKeys = new Set([...localMap.keys(), ...remoteMap.keys()]);
    const diff = {
      changed: [],
      localOnly: [],
      remoteOnly: [],
    };

    [...allMatchKeys]
      .sort()
      .forEach((matchKey) => {
        const localRecord = localMap.get(matchKey) || null;
        const remoteRecord = remoteMap.get(matchKey) || null;

        if (localRecord && !remoteRecord) {
          diff.localOnly.push({
            id: localRecord.id,
            setName: localRecord.setName || localRecord.id,
            updatedAt: localRecord.updatedAt || "",
          });
          return;
        }

        if (!localRecord && remoteRecord) {
          diff.remoteOnly.push({
            id: remoteRecord.id,
            setName: remoteRecord.setName || remoteRecord.id,
            updatedAt: remoteRecord.updatedAt || "",
          });
          return;
        }

        if (!localRecord || !remoteRecord) {
          return;
        }

        if (recordSignature(localRecord) !== recordSignature(remoteRecord)) {
          diff.changed.push({
            id: localRecord.id || remoteRecord.id,
            localId: localRecord.id || "",
            matchKey,
            remoteId: remoteRecord.id || "",
            setName: localRecord.setName || remoteRecord.setName || localRecord.id,
            newerSide: compareTimestamps(
              localRecord.updatedAt,
              remoteRecord.updatedAt,
            ),
            localUpdatedAt: localRecord.updatedAt || "",
            remoteUpdatedAt: remoteRecord.updatedAt || "",
          });
        }
      });

    return diff;
  }

  function buildStudyDiff(localSnapshot, remoteSnapshot) {
    const local = normalizeStudySnapshot(localSnapshot);
    const remote = normalizeStudySnapshot(remoteSnapshot);

    if (!local || !remote) {
      return {
        activeQuestionChanged: false,
        localAnsweredCount: local ? Object.keys(local.selectedAnswers).length : 0,
        localTopic: local?.session?.selectedTopic || "hepsi",
        remoteAnsweredCount: remote ? Object.keys(remote.selectedAnswers).length : 0,
        remoteTopic: remote?.session?.selectedTopic || "hepsi",
        topicChanged: false,
      };
    }

    return {
      activeQuestionChanged:
        (local.session?.currentQuestionKey || "") !==
          (remote.session?.currentQuestionKey || "") ||
        (local.session?.currentQuestionIndex || 0) !==
          (remote.session?.currentQuestionIndex || 0),
      localAnsweredCount: Object.keys(local.selectedAnswers).length,
      localTopic: local.session?.selectedTopic || "hepsi",
      newerSide: compareTimestamps(local.updatedAt, remote.updatedAt),
      remoteAnsweredCount: Object.keys(remote.selectedAnswers).length,
      remoteTopic: remote.session?.selectedTopic || "hepsi",
      topicChanged:
        (local.session?.selectedTopic || "hepsi") !==
        (remote.session?.selectedTopic || "hepsi"),
    };
  }

  function detectSyncConflict({
    localWorkspace,
    remoteRecords,
    localSnapshot,
    remoteSnapshot,
  }) {
    const normalizedLocalWorkspace = normalizeWorkspaceSeed(localWorkspace);
    const normalizedRemoteWorkspace = createRemoteWorkspaceSeed(
      remoteRecords,
      remoteSnapshot?.selectedSetIds || [],
    );
    const localHasWorkspace = hasMeaningfulWorkspace(normalizedLocalWorkspace);
    const remoteHasWorkspace = hasMeaningfulWorkspace(normalizedRemoteWorkspace);
    const workspaceMerge = reconcileWorkspaces(
      normalizedLocalWorkspace,
      normalizedRemoteWorkspace,
      localSnapshot,
      remoteSnapshot,
    );
    const workspaceDiff = buildWorkspaceDiff(
      workspaceMerge.localMap,
      workspaceMerge.remoteMap,
    );
    const studyMerge = mergeStudySnapshots(
      localSnapshot,
      remoteSnapshot,
      workspaceMerge.localToMergedSetIdMap,
      workspaceMerge.remoteToMergedSetIdMap,
    );
    const remappedLocalSnapshot = studyMerge.local;
    const remappedRemoteSnapshot = studyMerge.remote;
    const localHasSnapshot = hasMeaningfulStudySnapshot(remappedLocalSnapshot);
    const remoteHasSnapshot = hasMeaningfulStudySnapshot(remappedRemoteSnapshot);
    const mergedSelectedSetIds = [...new Set([
      ...normalizedLocalWorkspace.selectedSetIds.map(
        (setId) => workspaceMerge.localToMergedSetIdMap[setId] || setId,
      ),
      ...normalizedRemoteWorkspace.selectedSetIds.map(
        (setId) => workspaceMerge.remoteToMergedSetIdMap[setId] || setId,
      ),
    ])]
      .filter(Boolean)
      .sort();
    const mergedWorkspace = normalizeWorkspaceSeed({
      loadedSets: workspaceMerge.mergedLoadedSets,
      selectedSetIds:
        studyMerge.mergedSnapshot?.selectedSetIds?.length > 0
          ? studyMerge.mergedSnapshot.selectedSetIds
          : mergedSelectedSetIds,
    });
    const setConflict =
      localHasWorkspace &&
      remoteHasWorkspace &&
      workspaceMerge.blockingConflicts.length > 0;
    const studyConflict =
      localHasSnapshot &&
      remoteHasSnapshot &&
      studyMerge.hasConflict;
    const recordsToUpload = workspaceMerge.recordsToUpload;
    const remoteIdsToDelete = [...new Set(workspaceMerge.remoteIdsToDelete)].filter(Boolean);
    const decisionEnvelope = {
      blockingConflicts: workspaceMerge.blockingConflicts,
      mergeableSets: workspaceMerge.mergeableSets.map((entry) => {
        const { mergedRecord, ...publicEntry } = entry;
        return publicEntry;
      }),
      recommendedAction:
        setConflict || studyConflict
          ? "manual-resolution"
          : recordsToUpload.length > 0 ||
              remoteIdsToDelete.length > 0 ||
              studyMerge.shouldPersist ||
              !areWorkspaceSeedsEquivalent(normalizedLocalWorkspace, mergedWorkspace) ||
              !areStudySnapshotsEquivalent(remappedLocalSnapshot, studyMerge.mergedSnapshot)
            ? "auto-merge"
            : "noop",
      studyStateSummary: {
        autoCarriedAnswerCount: studyMerge.autoCarriedAnswerCount,
        blockingAnswerCount: studyMerge.blockingAnswerCount,
        localAnsweredCount: Object.keys(
          toSafeObject(remappedLocalSnapshot?.selectedAnswers),
        ).length,
        mergedAnsweredCount: Object.keys(
          toSafeObject(studyMerge.mergedSnapshot?.selectedAnswers),
        ).length,
        newerSide: studyMerge.newerSide,
        remoteAnsweredCount: Object.keys(
          toSafeObject(remappedRemoteSnapshot?.selectedAnswers),
        ).length,
      },
    };

    return {
      hasConflict: setConflict || studyConflict,
      setConflict,
      studyConflict,
      autoResolved: !setConflict && !studyConflict,
      localWorkspace: normalizedLocalWorkspace,
      remoteWorkspace: normalizedRemoteWorkspace,
      mergedWorkspace,
      mergedSnapshot: studyMerge.mergedSnapshot,
      shouldPersistMergedSnapshot: studyMerge.shouldPersist,
      recordsToUpload,
      remoteIdsToDelete,
      decisionEnvelope,
      localSummary: {
        ...summarizeWorkspace(normalizedLocalWorkspace),
        ...summarizeStudySnapshot(remappedLocalSnapshot || localSnapshot),
      },
      remoteSummary: {
        ...summarizeWorkspace(normalizedRemoteWorkspace),
        ...summarizeStudySnapshot(remappedRemoteSnapshot || remoteSnapshot),
      },
      workspaceDiff,
      studyDiff: buildStudyDiff(remappedLocalSnapshot, remappedRemoteSnapshot),
    };
  }

  const AppSyncConflict = Object.freeze({
  buildWorkspaceRecordMatchKey,
  createRemoteWorkspaceSeed,
  detectSyncConflict
});

export {
  buildWorkspaceRecordMatchKey,
  createRemoteWorkspaceSeed,
  detectSyncConflict,
  AppSyncConflict
};
