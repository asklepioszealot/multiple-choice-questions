import { escapeMarkup } from "../../shared/utils.js";
import { parseApkgToSetRecord as parseApkgToSetRecordFromModule } from "../importers/apkg-import.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function createSetId(fileName) {
    return String(fileName || "").replace(/\.[^/.]+$/, "");
  }

  function createStorageKey(prefix, key) {
    return prefix ? `${prefix}::${key}` : key;
  }

  function createSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "set";
  }

  function detectSourceFormat(fileName) {
    return /\.(md|txt)$/i.test(String(fileName || "")) ? "markdown" : "json";
  }

  function isApkgFile(fileName) {
    return /\.apkg$/i.test(String(fileName || ""));
  }

  function toArrayBuffer(value) {
    if (value instanceof ArrayBuffer) {
      return value;
    }

    if (ArrayBuffer.isView(value)) {
      return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    }

    return null;
  }

  function createSetManager({
    storage,
    buildSetRecord,
    normalizeQuestions,
    parseSetText,
    parseApkgToSetRecord,
    getSelectedAnswers,
    resolveQuestionKey,
    getStorageKeyPrefix,
    onSetImported,
    onRender,
    onSetsRemoved,
    onSelectionChanged,
    documentRef = globalScope.document,
    setTimeoutRef = globalScope.setTimeout?.bind(globalScope),
    clearTimeoutRef = globalScope.clearTimeout?.bind(globalScope),
    alertRef = globalScope.alert?.bind(globalScope),
    consoleRef = globalScope.console,
  }) {
    const runtimeStorage =
      storage ||
      {
        getItem() {
          return null;
        },
        setItem() {},
        removeItem() {},
      };
    const normalizeQuestionsRef =
      typeof normalizeQuestions === "function"
        ? normalizeQuestions
        : function fallbackNormalizeQuestions(data) {
            return Array.isArray(data?.questions) ? data.questions : [];
          };
    const buildSetRecordRef =
      typeof buildSetRecord === "function"
        ? buildSetRecord
        : function fallbackBuildSetRecord(record) {
            return record;
          };
    const parseSetTextRef =
      typeof parseSetText === "function"
        ? parseSetText
        : function fallbackParseSetText(text, fileName) {
          if (fileName.endsWith(".md") || fileName.endsWith(".txt")) {
            throw new Error("Markdown parser is not available.");
          }

          const cleanText = String(text || "").replace(/,\s*([\]}])/g, "$1");
          const parsed = JSON.parse(cleanText);
          return {
            setName:
              typeof parsed?.setName === "string" && parsed.setName.trim()
                ? parsed.setName.trim()
                : fileName,
            questions: parsed?.questions || [],
            fileName,
            sourceFormat: "json",
            rawSource: String(text || ""),
          };
          };
    const parseApkgToSetRecordRef =
      typeof parseApkgToSetRecord === "function"
        ? parseApkgToSetRecord
        : typeof parseApkgToSetRecordFromModule === "function"
          ? parseApkgToSetRecordFromModule
          : null;
    const getSelectedAnswersRef =
      typeof getSelectedAnswers === "function"
        ? getSelectedAnswers
        : function fallbackGetSelectedAnswers() {
            return {};
          };
    const resolveQuestionKeyRef =
      typeof resolveQuestionKey === "function"
        ? resolveQuestionKey
        : function fallbackResolveQuestionKey(question, setId, index) {
            return `${setId}:${index}:${question?.q || ""}`;
          };
    const getStorageKeyPrefixRef =
      typeof getStorageKeyPrefix === "function"
        ? getStorageKeyPrefix
        : function fallbackGetStorageKeyPrefix() {
            return "";
          };
    const onSetImportedRef =
      typeof onSetImported === "function"
        ? onSetImported
        : null;
    const onRenderRef =
      typeof onRender === "function"
        ? onRender
        : function fallbackOnRender() {};
    const onSetsRemovedRef =
      typeof onSetsRemoved === "function"
        ? onSetsRemoved
        : null;
    const onSelectionChangedRef =
      typeof onSelectionChanged === "function"
        ? onSelectionChanged
        : null;
    const setTimer =
      typeof setTimeoutRef === "function"
        ? setTimeoutRef
        : function fallbackSetTimeout() {
            return null;
          };
    const clearTimer =
      typeof clearTimeoutRef === "function"
        ? clearTimeoutRef
        : function fallbackClearTimeout() {};
    const showAlert =
      typeof alertRef === "function"
        ? alertRef
        : function fallbackAlert() {};
    const logger = consoleRef || console;

    let loadedSets = {};
    let selectedSets = new Set();
    let removeCandidateSets = new Set();
    let deleteMode = false;
    let lastRemovedSets = [];
    let undoTimeoutId = null;

    function resolvePrefix(prefixOverride = null) {
      if (typeof prefixOverride === "string") {
        return prefixOverride;
      }

      return String(getStorageKeyPrefixRef() || "");
    }

    function getStorageValue(key, prefixOverride = null) {
      return runtimeStorage.getItem(createStorageKey(resolvePrefix(prefixOverride), key));
    }

    function setStorageValue(key, value, prefixOverride = null) {
      runtimeStorage.setItem(
        createStorageKey(resolvePrefix(prefixOverride), key),
        value,
      );
    }

    function removeStorageValue(key, prefixOverride = null) {
      runtimeStorage.removeItem(
        createStorageKey(resolvePrefix(prefixOverride), key),
      );
    }

    function notifySelectionChanged() {
      if (!onSelectionChangedRef) {
        return;
      }

      Promise.resolve(onSelectionChangedRef([...selectedSets])).catch((error) => {
        logger.error("Set selection sync error", error);
      });
    }

    function normalizeLoadedSet(setId, rawRecord) {
      const fileName =
        typeof rawRecord?.fileName === "string" && rawRecord.fileName.trim()
          ? rawRecord.fileName.trim()
          : `${setId}.json`;
      const setName =
        typeof rawRecord?.setName === "string" && rawRecord.setName.trim()
          ? rawRecord.setName.trim()
          : fileName;

      return {
        id:
          typeof rawRecord?.id === "string" && rawRecord.id.trim()
            ? rawRecord.id.trim()
            : setId,
        slug:
          typeof rawRecord?.slug === "string" && rawRecord.slug.trim()
            ? rawRecord.slug.trim()
            : createSlug(setName),
        setName,
        fileName,
        sourceFormat:
          typeof rawRecord?.sourceFormat === "string" && rawRecord.sourceFormat.trim()
            ? rawRecord.sourceFormat.trim()
            : detectSourceFormat(fileName),
        sourcePath:
          typeof rawRecord?.sourcePath === "string" && rawRecord.sourcePath.trim()
            ? rawRecord.sourcePath.trim()
            : "",
        rawSource: typeof rawRecord?.rawSource === "string" ? rawRecord.rawSource : "",
        updatedAt:
          typeof rawRecord?.updatedAt === "string" && rawRecord.updatedAt.trim()
            ? rawRecord.updatedAt.trim()
            : "",
        questions: normalizeQuestionsRef({
          ...rawRecord,
          questions: toSafeArray(rawRecord?.questions),
        }),
      };
    }

    function saveSetsList(prefixOverride = null) {
      setStorageValue(
        "mc_loaded_sets",
        JSON.stringify(Object.keys(loadedSets)),
        prefixOverride,
      );
      setStorageValue(
        "mc_selected_sets",
        JSON.stringify([...selectedSets]),
        prefixOverride,
      );
    }

    function buildSetProgress(setId, setObj) {
      const selectedAnswers = getSelectedAnswersRef() || {};
      const questions = toSafeArray(setObj?.questions);
      let solvedCount = 0;
      let correctCount = 0;
      let wrongCount = 0;

      questions.forEach((question, index) => {
        const questionKey = resolveQuestionKeyRef(question, setId, index);
        if (selectedAnswers[questionKey] !== undefined) {
          solvedCount += 1;
          if (selectedAnswers[questionKey] === question.correct) {
            correctCount += 1;
          } else {
            wrongCount += 1;
          }
        }
      });

      const totalQuestions = questions.length;
      const progressPercent =
        totalQuestions > 0
          ? Math.round((solvedCount / totalQuestions) * 100)
          : 0;

      return {
        totalQuestions,
        solvedCount,
        correctCount,
        wrongCount,
        progressPercent,
      };
    }

    function renderSetList() {
      const setListEl = documentRef?.getElementById("set-list");
      const startBtn = documentRef?.getElementById("start-btn");
      const editBtn = documentRef?.getElementById("edit-btn");
      const setToolsEl = documentRef?.getElementById("set-list-tools");
      const removeSelectedBtn = documentRef?.getElementById("remove-selected-btn");
      const deleteModeBtn = documentRef?.getElementById("delete-mode-btn");
      const selectAllBtn = documentRef?.getElementById("select-all-btn");
      const clearSelectionBtn = documentRef?.getElementById("clear-selection-btn");
      const modeHint = documentRef?.getElementById("mode-hint");

      if (!setListEl) {
        return;
      }

      if (Object.keys(loadedSets).length === 0) {
        setListEl.innerHTML =
          '<div class="set-empty">Henüz test seti yüklenmedi.<br>Aşağıdaki butondan JSON dosyası yükleyin.</div>';
        if (startBtn) {
          startBtn.disabled = true;
        }
        if (editBtn) {
          editBtn.disabled = true;
        }
        if (setToolsEl) {
          setToolsEl.style.display = "none";
        }
        if (removeSelectedBtn) {
          removeSelectedBtn.disabled = true;
        }
        onRenderRef();
        return;
      }

      if (startBtn) {
        startBtn.disabled = selectedSets.size === 0;
      }
      if (editBtn) {
        editBtn.disabled = deleteMode || selectedSets.size !== 1;
      }
      if (setToolsEl) {
        setToolsEl.style.display = "flex";
      }
      if (deleteModeBtn) {
        deleteModeBtn.textContent = deleteMode
          ? "Silme Modu: Açık"
          : "Silme Modu: Kapalı";
        deleteModeBtn.className = deleteMode
          ? "btn btn-small btn-danger"
          : "btn btn-small btn-secondary";
      }
      if (selectAllBtn) {
        selectAllBtn.textContent = deleteMode
          ? "Silineceklerin Tümünü Seç"
          : "Tümünü Derse Dahil Et";
      }
      if (clearSelectionBtn) {
        clearSelectionBtn.textContent = deleteMode
          ? "Silme Seçimini Temizle"
          : "Ders Seçimini Temizle";
      }
      if (modeHint) {
        modeHint.textContent = deleteMode
          ? "Mod: Sileceğin setleri işaretliyorsun."
          : "Mod: Derse dahil edilecek setleri seçiyorsun.";
      }
      if (removeSelectedBtn) {
        removeSelectedBtn.disabled = !deleteMode || removeCandidateSets.size === 0;
        removeSelectedBtn.textContent = `Seçilileri Kaldır (${removeCandidateSets.size})`;
      }

      setListEl.innerHTML = "";

      Object.entries(loadedSets).forEach(([setId, setObj]) => {
        const isSelected = deleteMode
          ? removeCandidateSets.has(setId)
          : selectedSets.has(setId);
        const progress = buildSetProgress(setId, setObj);
        const escapedSetId = escapeMarkup(setId);
        const escapedSetName = escapeMarkup(setObj.setName);
        const escapedStats = escapeMarkup(
          `📚 ${progress.totalQuestions} Soru | 📊 İlerleme: ${progress.solvedCount}/${progress.totalQuestions} (%${progress.progressPercent}) | ✅ ${progress.correctCount} ❌ ${progress.wrongCount}`,
        );

        setListEl.innerHTML += `
          <div class="set-item">
            <div class="set-item-left" data-set-toggle-id="${escapedSetId}" role="button" tabindex="0">
              <input type="checkbox" ${isSelected ? "checked" : ""} data-set-checkbox-id="${escapedSetId}">
              <div class="set-info">
                <div class="set-name">${escapedSetName}</div>
                <div class="set-stats">${escapedStats}</div>
              </div>
            </div>
            <button class="delete-btn-circle" title="Seti kaldır" data-set-delete-id="${escapedSetId}" type="button">-</button>
          </div>
        `;
      });

      onRenderRef();
    }

    function buildImportedRecord(parsedRecord, fileName, importOptions = {}) {
      const setId =
        typeof parsedRecord?.id === "string" && parsedRecord.id.trim()
          ? parsedRecord.id.trim()
          : createSetId(fileName);

      return normalizeLoadedSet(setId, {
        ...parsedRecord,
        sourcePath:
          typeof importOptions?.sourcePath === "string"
            ? importOptions.sourcePath
            : parsedRecord?.sourcePath,
      });
    }

    function persistLoadedRecord(record, prefixOverride = null) {
      const setId = record.id || createSetId(record.fileName);
      const normalizedRecord = normalizeLoadedSet(setId, record);
      loadedSets[setId] = normalizedRecord;

      saveSetsList(prefixOverride);
      setStorageValue("mc_set_" + setId, JSON.stringify(normalizedRecord), prefixOverride);
      return setId;
    }

    async function loadSetFromText(text, fileName, importOptions = {}) {
      const importedRecord = buildImportedRecord(
        parseSetTextRef(text, fileName),
        fileName,
        importOptions,
      );
      const persistedRecord = onSetImportedRef
        ? normalizeLoadedSet(
            importedRecord.id,
            (await onSetImportedRef(importedRecord)) || importedRecord,
          )
        : importedRecord;

      return persistLoadedRecord(persistedRecord);
    }

    async function loadSetFromBinary(arrayBuffer, fileName, importOptions = {}) {
      if (typeof parseApkgToSetRecordRef !== "function") {
        throw new Error("APKG importer is not available.");
      }

      const importedRecord = buildImportedRecord(
        await parseApkgToSetRecordRef(arrayBuffer, fileName),
        fileName,
        importOptions,
      );
      const persistedRecord = onSetImportedRef
        ? normalizeLoadedSet(
            importedRecord.id,
            (await onSetImportedRef(importedRecord)) || importedRecord,
          )
        : importedRecord;

      return persistLoadedRecord(persistedRecord);
    }

    async function importFiles(files = [], options = {}) {
      const list = Array.isArray(files) ? files : [];
      const resolveImportOptions =
        typeof options.resolveImportOptions === "function"
          ? options.resolveImportOptions
          : function fallbackResolveImportOptions() {
              return {};
            };

      for (const file of list) {
        try {
          const fileName =
            typeof file?.name === "string" && file.name.trim()
              ? file.name.trim()
              : "set.json";
          const importOptions = resolveImportOptions(file) || {};
          let setId = null;

          if (isApkgFile(fileName)) {
            const arrayBuffer =
              typeof file?.arrayBuffer === "function"
                ? await file.arrayBuffer()
                : toArrayBuffer(file?.contents);
            if (!arrayBuffer) {
              throw new Error("APKG binary data is not available.");
            }
            setId = await loadSetFromBinary(arrayBuffer, fileName, importOptions);
          } else {
            const text =
              typeof file?.text === "function"
                ? await file.text()
                : typeof file?.contents === "string"
                  ? file.contents
                  : "";
            setId = await loadSetFromText(
              text,
              fileName,
              importOptions,
            );
          }
          selectedSets.add(setId);
        } catch (error) {
          logger.error("Set okuma hatası:", error);
          showAlert(`${file?.name || "Dosya"} okunamadı. Dosya formatı uyumlu değil.`);
        }
      }

      if (list.length > 0) {
        saveSetsList();
        notifySelectionChanged();
      }

      renderSetList();
    }

    async function importNativeFiles(files = []) {
      return importFiles(files, {
        resolveImportOptions(file) {
          return {
            sourcePath:
              typeof file?.path === "string" && file.path.trim()
                ? file.path.trim()
                : "",
          };
        },
      });
    }

    async function handleFileSelect(event) {
      const files = Array.from(event?.target?.files || []);
      await importFiles(files);

      if (event?.target) {
        event.target.value = "";
      }
    }

    function toggleSetSelection(setId) {
      if (selectedSets.has(setId)) {
        selectedSets.delete(setId);
      } else {
        selectedSets.add(setId);
      }
      saveSetsList();
      renderSetList();
      notifySelectionChanged();
    }

    function selectSet(setId) {
      if (!loadedSets[setId]) {
        return false;
      }

      selectedSets.add(setId);
      saveSetsList();
      notifySelectionChanged();
      return true;
    }

    function setSelectedSetIds(nextSetIds, options = {}) {
      const nextSelection = Array.isArray(nextSetIds) ? nextSetIds : [];
      selectedSets = new Set(nextSelection.filter((setId) => loadedSets[setId]));
      saveSetsList(options.storageKeyPrefix ?? null);
      renderSetList();
      if (options.notify === true) {
        notifySelectionChanged();
      }
    }

    function toggleSetCheck(setId) {
      if (deleteMode) {
        if (removeCandidateSets.has(setId)) {
          removeCandidateSets.delete(setId);
        } else {
          removeCandidateSets.add(setId);
        }
        renderSetList();
        return;
      }

      toggleSetSelection(setId);
    }

    function showUndoToast(message) {
      const toast = documentRef?.getElementById("undo-toast");
      const messageEl = documentRef?.getElementById("undo-message");

      if (!toast || !messageEl) {
        return;
      }

      messageEl.textContent = message;
      toast.style.display = "flex";

      if (undoTimeoutId) {
        clearTimer(undoTimeoutId);
      }

      undoTimeoutId = setTimer(() => {
        toast.style.display = "none";
        lastRemovedSets = [];
      }, 7000);
    }

    async function removeSets(idsToRemove) {
      const existingIds = idsToRemove.filter((setId) => loadedSets[setId]);
      if (existingIds.length === 0) {
        return;
      }

      if (onSetsRemovedRef) {
        await onSetsRemovedRef(existingIds);
      }

      const removed = [];

      existingIds.forEach((setId) => {
        removed.push({
          setId,
          setData: loadedSets[setId],
          wasSelected: selectedSets.has(setId),
        });

        delete loadedSets[setId];
        selectedSets.delete(setId);
        removeCandidateSets.delete(setId);
        removeStorageValue("mc_set_" + setId);
      });

      lastRemovedSets = removed;
      showUndoToast(
        removed.length === 1 ? "Set kaldırıldı." : `${removed.length} set kaldırıldı.`,
      );
      saveSetsList();
      renderSetList();
      notifySelectionChanged();
    }

    async function deleteSet(setId) {
      await removeSets([setId]);
    }

    async function saveSetRecord(record, options = {}) {
      const setId =
        typeof record?.id === "string" && record.id.trim()
          ? record.id.trim()
          : createSetId(record?.fileName || record?.setName || "set");
      const baseRecord = loadedSets[setId] || {};
      const nextRecord = normalizeLoadedSet(setId, buildSetRecordRef({
        ...baseRecord,
        ...record,
        id: setId,
        updatedAt:
          typeof record?.updatedAt === "string" && record.updatedAt.trim()
            ? record.updatedAt.trim()
            : new Date().toISOString(),
      }, {
        previousRecord: baseRecord,
      }));
      const persistedRecord = onSetImportedRef
        ? normalizeLoadedSet(
            setId,
            (await onSetImportedRef(nextRecord)) || nextRecord,
          )
        : nextRecord;

      loadedSets[setId] = persistedRecord;
      if (options.select !== false || selectedSets.has(setId)) {
        selectedSets.add(setId);
      }

      saveSetsList(options.storageKeyPrefix ?? null);
      setStorageValue(
        "mc_set_" + setId,
        JSON.stringify(persistedRecord),
        options.storageKeyPrefix ?? null,
      );
      renderSetList();
      if (options.notify !== false) {
        notifySelectionChanged();
      }

      return persistedRecord;
    }

    function selectAllSets() {
      if (deleteMode) {
        removeCandidateSets = new Set(Object.keys(loadedSets));
        renderSetList();
        return;
      }

      selectedSets = new Set(Object.keys(loadedSets));
      saveSetsList();
      renderSetList();
      notifySelectionChanged();
    }

    function clearSetSelection() {
      if (deleteMode) {
        removeCandidateSets.clear();
        renderSetList();
        return;
      }

      selectedSets.clear();
      saveSetsList();
      renderSetList();
      notifySelectionChanged();
    }

    async function removeSelectedSets() {
      if (!deleteMode || removeCandidateSets.size === 0) {
        return;
      }

      await removeSets([...removeCandidateSets]);
    }

    function toggleDeleteMode() {
      deleteMode = !deleteMode;
      if (!deleteMode) {
        removeCandidateSets.clear();
      }
      renderSetList();
    }

    async function undoLastRemoval() {
      if (!lastRemovedSets || lastRemovedSets.length === 0) {
        return;
      }

      for (const entry of lastRemovedSets) {
        const restoredRecord = onSetImportedRef
          ? normalizeLoadedSet(
              entry.setId,
              (await onSetImportedRef(entry.setData)) || entry.setData,
            )
          : normalizeLoadedSet(entry.setId, entry.setData);

        loadedSets[entry.setId] = restoredRecord;
        setStorageValue("mc_set_" + entry.setId, JSON.stringify(restoredRecord));
        if (entry.wasSelected) {
          selectedSets.add(entry.setId);
        }
      }

      const toast = documentRef?.getElementById("undo-toast");
      if (toast) {
        toast.style.display = "none";
      }
      if (undoTimeoutId) {
        clearTimer(undoTimeoutId);
        undoTimeoutId = null;
      }

      removeCandidateSets.clear();
      lastRemovedSets = [];
      saveSetsList();
      renderSetList();
      notifySelectionChanged();
    }

    function replaceLoadedSets(records, options = {}) {
      const previousIds = Object.keys(loadedSets);
      const nextLoadedSets = {};

      toSafeArray(records).forEach((record) => {
        const setId =
          typeof record?.id === "string" && record.id.trim()
            ? record.id.trim()
            : createSetId(record?.fileName || record?.setName || "set");
        nextLoadedSets[setId] = normalizeLoadedSet(setId, record);
      });

      previousIds.forEach((setId) => {
        if (!nextLoadedSets[setId]) {
          removeStorageValue("mc_set_" + setId, options.storageKeyPrefix ?? null);
        }
      });

      loadedSets = nextLoadedSets;
      selectedSets = Array.isArray(options.selectedSetIds)
        ? new Set(options.selectedSetIds.filter((setId) => loadedSets[setId]))
        : new Set([...selectedSets].filter((setId) => loadedSets[setId]));
      removeCandidateSets.clear();
      deleteMode = false;
      lastRemovedSets = [];

      Object.entries(loadedSets).forEach(([setId, record]) => {
        setStorageValue(
          "mc_set_" + setId,
          JSON.stringify(record),
          options.storageKeyPrefix ?? null,
        );
      });

      saveSetsList(options.storageKeyPrefix ?? null);
      renderSetList();
    }

    function loadStoredSets(prefixOverride = null) {
      loadedSets = {};
      selectedSets = new Set();
      removeCandidateSets = new Set();
      deleteMode = false;
      lastRemovedSets = [];

      try {
        const storedSets = getStorageValue("mc_loaded_sets", prefixOverride);
        const storedSelected = getStorageValue("mc_selected_sets", prefixOverride);

        if (storedSets) {
          JSON.parse(storedSets).forEach((id) => {
            const setData = getStorageValue("mc_set_" + id, prefixOverride);
            if (setData) {
              loadedSets[id] = normalizeLoadedSet(id, JSON.parse(setData));
            }
          });
        }

        if (storedSelected) {
          const selectedIds = JSON.parse(storedSelected);
          selectedSets = new Set(selectedIds.filter((id) => loadedSets[id]));
        }
      } catch (error) {
        logger.error("Cache load error", error);
      }
    }

    function getLoadedSets() {
      return loadedSets;
    }

    function getSelectedSetIds() {
      return [...selectedSets];
    }

    return Object.freeze({
      clearSetSelection,
      deleteSet,
      getLoadedSets,
      importNativeFiles,
      getSelectedSetIds,
      handleFileSelect,
      loadSetFromBinary,
      loadSetFromText,
      loadStoredSets,
      removeSelectedSets,
      renderSetList,
      replaceLoadedSets,
      saveSetRecord,
      selectSet,
      selectAllSets,
      setSelectedSetIds,
      showUndoToast,
      toggleDeleteMode,
      toggleSetCheck,
      undoLastRemoval,
    });
  }

  const AppSetManager = Object.freeze({
  createSetManager
});

export {
  createSetManager,
  AppSetManager
};
