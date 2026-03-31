      // --- YENİ SET YÖNETİMİ DEĞİŞKENLERİ ---
      let loadedSets = {};
      let selectedSets = new Set();
      let removeCandidateSets = new Set();
      let deleteMode = false;
      let lastRemovedSets = [];
      let undoTimeoutId = null;
      const DRIVE_CLIENT_ID =
        "102976125468-1mq0m7ptikns377eso8gmnaaioac17fv.apps.googleusercontent.com";
      const DRIVE_API_KEY = "AIzaSyCUvy3PvFNpAVL9FYvLF22lzUPJ9xZHWrw";
      const DRIVE_APP_ID = "102976125468";
      const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.readonly";
      const ANSWER_LOCK_KEY = "mc_answer_lock";
      const AUTO_ADVANCE_KEY = "mc_auto_advance";
      let driveTokenClient = null;
      let driveAccessToken = null;
      let drivePickerApiLoaded = false;

      // --- ESKİ DEĞİŞKENLER ---
      let currentQuestionIndex = 0;
      let allQuestions = [];
      let filteredQuestions = [];
      let questionOrder = [];
      let selectedAnswers = {};
      let solutionVisible = {};
      let pendingSession = null;
      let isFullscreen = false;
      let answerLockEnabled = false;
      let autoAdvanceEnabled = false;
      let autoAdvanceTimeoutId = null;
      const { bootstrap } = window.AppBootstrap;
      const { showScreen } = window.AppScreen;
      const { storage } = bootstrap();
      const { normalizeQuestions, parseMarkdownToJSON } = window.AppSetCodec;
      const {
        buildScoreSummary,
        formatScoreSummaryHtml,
        createRetryWrongAnswersState,
        createResetStudyState,
        shuffleQuestionOrder,
      } = window.AppStudyActions;
      const {
        buildStudyQuestions,
        collectStudySubjects,
        createFilteredStudyView,
        getBoundedQuestionIndex,
        selectStudyAnswer,
        toggleStudySolution,
      } = window.AppStudy;
      const {
        createStudyChromeState,
        getFullscreenToggleState,
        getAnswerLockStatusText,
        getAutoAdvanceStatusText,
      } = window.AppStudyUI;
      const {
        buildQuestionKey,
        resolveQuestionKey: cardId,
        loadPersistedStudyState,
        persistStudyState,
        readSavedSession,
      } = window.AppStudyState;

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

      function persistLoadedSet(fileName, data) {
        const setId = fileName.replace(/\.[^/.]+$/, "");
        loadedSets[setId] = {
          setName: data.setName || fileName,
          questions: normalizeQuestions(data),
          fileName: fileName,
        };

        saveSetsList();
        storage.setItem("mc_set_" + setId, JSON.stringify(loadedSets[setId]));
        return setId;
      }

      function parseSetText(text, fileName) {
        if (fileName.endsWith(".md") || fileName.endsWith(".txt")) {
          return parseMarkdownToJSON(text, fileName);
        }

        // JSON'daki sondaki virgülleri (trailing commas) temizle
        const cleanText = text.replace(/,\s*([\]}])/g, "$1");
        return JSON.parse(cleanText);
      }

      async function loadSetFromText(text, fileName) {
        const data = parseSetText(text, fileName);
        return persistLoadedSet(fileName, data);
      }

      async function handleFileSelect(event) {
        const files = event.target.files;
        for (const file of files) {
          try {
            const text = await file.text();
            const setId = await loadSetFromText(text, file.name);
            selectedSets.add(setId);
          } catch (e) {
            console.error("Set okuma hatası:", e);
            alert(file.name + " okunamadı. Dosya formatı uyumlu değil.");
          }
        }

        event.target.value = "";
        renderSetList();
      }

      function saveSetsList() {
        storage.setItem(
          "mc_loaded_sets",
          JSON.stringify(Object.keys(loadedSets)),
        );
        storage.setItem(
          "mc_selected_sets",
          JSON.stringify([...selectedSets]),
        );
      }

      function renderSetList() {
        const setListEl = document.getElementById("set-list");
        const startBtn = document.getElementById("start-btn");
        const setToolsEl = document.getElementById("set-list-tools");
        const removeSelectedBtn = document.getElementById("remove-selected-btn");
        const deleteModeBtn = document.getElementById("delete-mode-btn");
        const selectAllBtn = document.getElementById("select-all-btn");
        const clearSelectionBtn = document.getElementById("clear-selection-btn");
        const modeHint = document.getElementById("mode-hint");

        if (Object.keys(loadedSets).length === 0) {
          setListEl.innerHTML =
            '<div class="set-empty">Henüz test seti yüklenmedi.<br>Aşağıdaki butondan JSON dosyası yükleyin.</div>';
          startBtn.disabled = true;
          setToolsEl.style.display = "none";
          if (removeSelectedBtn) removeSelectedBtn.disabled = true;
          return;
        }

        startBtn.disabled = selectedSets.size === 0;
        setToolsEl.style.display = "flex";
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

        for (const [setId, setObj] of Object.entries(loadedSets)) {
          const isSelected = deleteMode
            ? removeCandidateSets.has(setId)
            : selectedSets.has(setId);

          let solvedCount = 0;
          let correctCount = 0;
          let wrongCount = 0;
          const totalQuestions = Array.isArray(setObj.questions)
            ? setObj.questions.length
            : 0;

          setObj.questions.forEach((q, index) => {
            const questionKey = cardId(q, setId, index);
            if (selectedAnswers[questionKey] !== undefined) {
              solvedCount++;
              if (selectedAnswers[questionKey] === q.correct) {
                correctCount++;
              } else {
                wrongCount++;
              }
            }
          });

          const progressPercent =
            totalQuestions > 0
              ? Math.round((solvedCount / totalQuestions) * 100)
              : 0;

          const markup = `
            <div class="set-item">
              <div class="set-item-left" onclick="toggleSetCheck('${setId}')">
                <input type="checkbox" ${isSelected ? "checked" : ""} onclick="event.stopPropagation(); toggleSetCheck('${setId}')">
                <div class="set-info">
                  <div class="set-name">${setObj.setName}</div>
                  <div class="set-stats">📚 ${totalQuestions} Soru | 📊 İlerleme: ${solvedCount}/${totalQuestions} (%${progressPercent}) | ✅ ${correctCount} ❌ ${wrongCount}</div>
                </div>
              </div>
              <button class="delete-btn-circle" title="Seti kaldır" onclick="deleteSet('${setId}')">-</button>
            </div>
          `;
          setListEl.innerHTML += markup;
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

      function toggleSetSelection(setId) {
        if (selectedSets.has(setId)) {
          selectedSets.delete(setId);
        } else {
          selectedSets.add(setId);
        }
        saveSetsList();
        renderSetList();
      }

      function deleteSet(setId) {
        removeSets([setId]);
      }

      function removeSets(idsToRemove) {
        const removed = [];
        idsToRemove.forEach((setId) => {
          if (!loadedSets[setId]) return;
          removed.push({
            setId: setId,
            setData: loadedSets[setId],
            wasSelected: selectedSets.has(setId),
          });
          delete loadedSets[setId];
          selectedSets.delete(setId);
          removeCandidateSets.delete(setId);
          storage.removeItem("mc_set_" + setId);
        });
        if (removed.length === 0) return;
        lastRemovedSets = removed;
        showUndoToast(
          removed.length === 1
            ? "Set kaldırıldı."
            : `${removed.length} set kaldırıldı.`,
        );
        saveSetsList();
        renderSetList();
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
      }

      function removeSelectedSets() {
        if (!deleteMode || removeCandidateSets.size === 0) return;
        removeSets([...removeCandidateSets]);
      }

      function toggleDeleteMode() {
        deleteMode = !deleteMode;
        if (!deleteMode) {
          removeCandidateSets.clear();
        }
        renderSetList();
      }

      function showUndoToast(message) {
        const toast = document.getElementById("undo-toast");
        const msgEl = document.getElementById("undo-message");
        if (!toast || !msgEl) return;
        msgEl.textContent = message;
        toast.style.display = "flex";
        if (undoTimeoutId) {
          clearTimeout(undoTimeoutId);
        }
        undoTimeoutId = setTimeout(() => {
          toast.style.display = "none";
          lastRemovedSets = [];
        }, 7000);
      }

      function undoLastRemoval() {
        if (!lastRemovedSets || lastRemovedSets.length === 0) return;
        lastRemovedSets.forEach((entry) => {
          loadedSets[entry.setId] = entry.setData;
          storage.setItem("mc_set_" + entry.setId, JSON.stringify(entry.setData));
          if (entry.wasSelected) {
            selectedSets.add(entry.setId);
          }
        });
        const toast = document.getElementById("undo-toast");
        if (toast) toast.style.display = "none";
        if (undoTimeoutId) {
          clearTimeout(undoTimeoutId);
          undoTimeoutId = null;
        }
        removeCandidateSets.clear();
        lastRemovedSets = [];
        saveSetsList();
        renderSetList();
      }

      function initGoogleDrive() {
        if (!window.google || !window.google.accounts || !window.gapi) {
          setTimeout(initGoogleDrive, 500);
          return;
        }

        gapi.load("picker", () => {
          drivePickerApiLoaded = true;
        });

        driveTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: DRIVE_CLIENT_ID,
          scope: DRIVE_SCOPES,
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              driveAccessToken = tokenResponse.access_token;
              launchDrivePicker();
            }
          },
        });
      }

      function authGoogleDrive() {
        if (!driveTokenClient || !drivePickerApiLoaded) {
          alert("Google hesap servisleri henüz yüklenmedi veya bağlantı hatası var.");
          return;
        }

        driveTokenClient.requestAccessToken({ prompt: "" });
      }

      function launchDrivePicker() {
        if (window.__TAURI__) {
          alert("Tauri (masaüstü) versiyonunda Google Picker penceresi desteklenmiyor.");
          return;
        }

        const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setMimeTypes("application/json,text/markdown,text/plain");
        const picker = new google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(driveAccessToken)
          .setDeveloperKey(DRIVE_API_KEY)
          .setAppId(DRIVE_APP_ID)
          .setCallback(pickerCallback)
          .setTitle("Uygulamaya eklenecek soru setini seçin (.json, .md, .txt)")
          .build();

        picker.setVisible(true);
      }

      function pickerCallback(data) {
        if (data.action === google.picker.Action.PICKED) {
          const file = data.docs[0];
          downloadAndLoadDriveFile(file.id, file.name);
        }
      }

      async function downloadAndLoadDriveFile(fileId, fileName) {
        try {
          const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${DRIVE_API_KEY}`,
            {
              headers: {
                Authorization: `Bearer ${driveAccessToken}`,
              },
            },
          );

          if (!response.ok) {
            throw new Error("İndirme hatası: " + response.statusText);
          }

          const text = await response.text();
          const setId = await loadSetFromText(text, fileName);
          selectedSets.add(setId);
          renderSetList();
          showUndoToast(`"${fileName}" yüklendi!`);
        } catch (e) {
          console.error("Drive set indirme hatası:", e);
          alert("Drive indirme hatası: " + e.message);
        }
      }

      function updateFullscreenInfo(question) {
        const counterEl = document.getElementById("fullscreen-question-counter");
        const subjectEl = document.getElementById("fullscreen-subject-badge");
        const prevBtn = document.getElementById("fullscreen-prev-btn");
        const nextBtn = document.getElementById("fullscreen-next-btn");
        const chromeState = createStudyChromeState({
          currentQuestionIndex,
          totalQuestions: filteredQuestions.length,
          subject: question ? question.subject : "",
        });

        if (counterEl) {
          counterEl.textContent = chromeState.counterText;
        }
        if (subjectEl) {
          subjectEl.textContent = chromeState.subjectText;
        }
        if (prevBtn) {
          prevBtn.disabled = chromeState.disablePrev;
        }
        if (nextBtn) {
          nextBtn.disabled = chromeState.disableNext;
        }
      }

      function syncAnswerLockToggleUI() {
        const toggle = document.getElementById("answer-lock-toggle-manager");
        if (toggle) {
          toggle.checked = answerLockEnabled;
        }
        const status = document.getElementById("answer-lock-status");
        if (status) {
          status.textContent = getAnswerLockStatusText(answerLockEnabled);
        }
      }

      function setAnswerLock(isEnabled) {
        answerLockEnabled = Boolean(isEnabled);
        storage.setItem(ANSWER_LOCK_KEY, answerLockEnabled ? "1" : "0");
        syncAnswerLockToggleUI();
      }

      function syncAutoAdvanceToggleUI() {
        const toggle = document.getElementById("auto-advance-toggle-manager");
        if (toggle) {
          toggle.checked = autoAdvanceEnabled;
        }
        const status = document.getElementById("auto-advance-status");
        if (status) {
          status.textContent = getAutoAdvanceStatusText(autoAdvanceEnabled);
        }
      }

      function setAutoAdvance(isEnabled) {
        autoAdvanceEnabled = Boolean(isEnabled);
        storage.setItem(AUTO_ADVANCE_KEY, autoAdvanceEnabled ? "1" : "0");
        syncAutoAdvanceToggleUI();
      }

      function clearAutoAdvanceTimer() {
        if (autoAdvanceTimeoutId) {
          clearTimeout(autoAdvanceTimeoutId);
          autoAdvanceTimeoutId = null;
        }
      }

      function toggleFullscreen() {
        const questionCard = document.getElementById("question-card");
        const toggleBtn = document.getElementById("fullscreen-toggle-btn");
        if (!questionCard || !toggleBtn) return;

        isFullscreen = !isFullscreen;
        const fullscreenState = getFullscreenToggleState(isFullscreen);

        questionCard.classList.toggle("fullscreen-active", isFullscreen);
        document.body.style.overflow = fullscreenState.bodyOverflow;
        toggleBtn.textContent = fullscreenState.buttonText;
        toggleBtn.title = fullscreenState.buttonTitle;

        updateFullscreenInfo(
          filteredQuestions.length > 0
            ? filteredQuestions[questionOrder[currentQuestionIndex]]
            : null,
        );

        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
      }

      function startStudy() {
        if (selectedSets.size === 0) return;
        clearAutoAdvanceTimer();

        allQuestions = buildStudyQuestions({
          loadedSets,
          selectedSetIds: selectedSets,
          buildQuestionKey,
        });

        if (allQuestions.length === 0) {
          alert("Seçili setlerde soru bulunamadı.");
          return;
        }

        filteredQuestions = [...allQuestions];
        questionOrder = [...Array(filteredQuestions.length).keys()];
        currentQuestionIndex = 0;

        showScreen("study");

        populateTopicFilter();
        updateScoreDisplay();

        const session = readSavedSession(storage, pendingSession) || pendingSession || {};
        const topicSelect = document.getElementById("topic-select");
        if (
          topicSelect &&
          typeof session.selectedTopic === "string" &&
          [...topicSelect.options].some(
            (option) => option.value === session.selectedTopic,
          )
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
        clearAutoAdvanceTimer();
        if (isFullscreen) {
          toggleFullscreen();
        }
        showScreen("manager");
        renderSetList();
      }

      function filterByTopic(resetIndex = true, options = {}) {
        const selectedTopic = document.getElementById("topic-select").value;
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

        filteredQuestions = nextView.filteredQuestions;
        questionOrder = nextView.questionOrder;
        currentQuestionIndex = nextView.currentQuestionIndex;

        document
          .getElementById("jump-input")
          .setAttribute("max", filteredQuestions.length);

        if (filteredQuestions.length > 0) {
          displayQuestion();
          return;
        }

        document.getElementById("question-text").innerHTML =
          "Bu filtrede gösterilecek soru bulunamadı.";
        document.getElementById("question-counter").textContent = "Soru 0 / 0";
        document.getElementById("subject-badge").textContent = selectedTopic;
        document.getElementById("solution-content").innerHTML = "";
        document.getElementById("options-container").innerHTML = "";
        document.getElementById("solution").classList.remove("visible");
        document.getElementById("show-solution-btn").textContent = "Çözümü Göster";
        document.getElementById("prev-btn").disabled = true;
        document.getElementById("next-btn").disabled = true;
        updateFullscreenInfo(null);
        saveState();
      }

      function displayQuestion() {
        const q = filteredQuestions[questionOrder[currentQuestionIndex]];
        const cid = cardId(q);
        const chromeState = createStudyChromeState({
          currentQuestionIndex,
          totalQuestions: filteredQuestions.length,
          subject: q.subject,
        });

        document.getElementById("question-text").innerHTML = q.q;
        document.getElementById("question-counter").textContent =
          chromeState.counterText;
        document.getElementById("subject-badge").textContent =
          chromeState.subjectText;
        document.getElementById("solution-content").innerHTML =
          getExplanationHtml(q).replace(/<br>/g, "<br>");

        const optionsContainer = document.getElementById("options-container");
        optionsContainer.innerHTML = "";

        q.options.forEach((option, index) => {
          const optionDiv = document.createElement("div");
          optionDiv.className = "option";
          optionDiv.innerHTML = `<span class="option-label">${String.fromCharCode(65 + index)}</span><span>${option}</span>`;

          if (
            selectedAnswers[cid] !== undefined &&
            selectedAnswers[cid] !== null
          ) {
            if (index === q.correct) {
              optionDiv.classList.add("correct");
            } else if (index === selectedAnswers[cid]) {
              optionDiv.classList.add("wrong");
            }
          } else if (selectedAnswers[cid] === index) {
            optionDiv.classList.add("selected");
          }

          optionDiv.onclick = () => selectOption(index);
          optionsContainer.appendChild(optionDiv);
        });

        const solution = document.getElementById("solution");
        if (solutionVisible[cid]) {
          solution.classList.add("visible");
          document.getElementById("show-solution-btn").textContent =
            "Çözümü Gizle";
        } else {
          solution.classList.remove("visible");
          document.getElementById("show-solution-btn").textContent =
            "Çözümü Göster";
        }

        document.getElementById("prev-btn").disabled = chromeState.disablePrev;
        document.getElementById("next-btn").disabled = chromeState.disableNext;
        updateFullscreenInfo(q);
        saveState();
      }

      function selectOption(index) {
        const q = filteredQuestions[questionOrder[currentQuestionIndex]];
        const answerSelection = selectStudyAnswer({
          question: q,
          selectedAnswers,
          answerIndex: index,
          answerLockEnabled,
          resolveQuestionKey: cardId,
        });

        if (answerSelection.blocked) {
          return;
        }

        selectedAnswers = answerSelection.selectedAnswers;

        displayQuestion();
        updateScoreDisplay();

        if (autoAdvanceEnabled && answerSelection.answeredNow) {
          clearAutoAdvanceTimer();
          autoAdvanceTimeoutId = setTimeout(() => {
            autoAdvanceTimeoutId = null;
            if (currentQuestionIndex < filteredQuestions.length - 1) {
              nextQuestion();
            }
          }, 400);
        }
      }

      function toggleSolution() {
        const q = filteredQuestions[questionOrder[currentQuestionIndex]];
        const toggled = toggleStudySolution({
          question: q,
          solutionVisible,
          resolveQuestionKey: cardId,
        });
        solutionVisible = toggled.solutionVisible;

        const solution = document.getElementById("solution");
        const btn = document.getElementById("show-solution-btn");

        if (toggled.isVisible) {
          solution.classList.add("visible");
          btn.textContent = "Çözümü Gizle";
        } else {
          solution.classList.remove("visible");
          btn.textContent = "Çözümü Göster";
        }
        saveState();
      }

      function previousQuestion() {
        clearAutoAdvanceTimer();
        const nextIndex = getBoundedQuestionIndex(
          currentQuestionIndex - 1,
          filteredQuestions.length,
        );
        if (nextIndex !== currentQuestionIndex) {
          currentQuestionIndex = nextIndex;
          displayQuestion();
        }
      }

      function nextQuestion() {
        clearAutoAdvanceTimer();
        const nextIndex = getBoundedQuestionIndex(
          currentQuestionIndex + 1,
          filteredQuestions.length,
        );
        if (nextIndex !== currentQuestionIndex) {
          currentQuestionIndex = nextIndex;
          displayQuestion();
        }
      }

      function jumpToQuestion() {
        clearAutoAdvanceTimer();
        const input = document.getElementById("jump-input");
        const questionNum = parseInt(input.value);

        if (questionNum >= 1 && questionNum <= filteredQuestions.length) {
          currentQuestionIndex = getBoundedQuestionIndex(
            questionNum - 1,
            filteredQuestions.length,
          );
          displayQuestion();
          input.value = "";
        } else {
          alert(
            `Lütfen 1 ile ${filteredQuestions.length} arasında bir sayı girin.`,
          );
        }
      }

      document
        .getElementById("jump-input")
        .addEventListener("keypress", function (e) {
          if (e.key === "Enter") {
            jumpToQuestion();
          }
        });

      document
        .getElementById("jump-input")
        .setAttribute("max", filteredQuestions.length);

      function toggleTheme(isChecked) {
        window.ThemeManager.toggleTheme({
          isChecked: isChecked,
          primaryToggleId: "theme-toggle",
          managerToggleId: "theme-toggle-manager",
          storageApi: storage,
          storageKey: "quiz-theme",
        });
      }

      function shuffleQuestions() {
        if (filteredQuestions.length === 0) return;
        const shuffled = shuffleQuestionOrder({ questionOrder });
        questionOrder = shuffled.questionOrder;
        currentQuestionIndex = shuffled.currentQuestionIndex;
        displayQuestion();
      }

      function exportPrintable() {
        const printWindow = window.open("", "_blank");
        let html =
          '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Çoktan Seçmeli Test - Test Çıktısı</title>';
        html += "<style>";
        html +=
          'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #21302a; line-height: 1.6; }';
        html +=
          ".question { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; page-break-inside: avoid; }";
        html +=
          ".q-num { font-weight: 700; color: #2f7a56; margin-bottom: 8px; }";
        html += ".q-text { font-size: 16px; margin-bottom: 12px; }";
        html += ".option { padding: 4px 0; }";
        html += ".option.correct { color: #059669; font-weight: 600; }";
        html +=
          ".explanation { margin-top: 12px; padding: 12px; background: #f0fdf4; border-radius: 6px; font-size: 14px; border-left: 3px solid #2f7a56; }";
        html += "h1 { text-align: center; color: #2f7a56; }";
        html += "@media print { .question { border: 1px solid #ccc; } }";
        html += "</style></head><body><h1>Çoktan Seçmeli Test</h1>";

        allQuestions.forEach((q, i) => {
          const labels = ["A", "B", "C", "D", "E"];
          html += '<div class="question">';
          html +=
            '<div class="q-num">Soru ' + (i + 1) + " - " + q.subject + "</div>";
          html += '<div class="q-text">' + q.q + "</div>";
          q.options.forEach((opt, j) => {
            const isCorrect = j === q.correct;
            html +=
              '<div class="option' +
              (isCorrect ? " correct" : "") +
              '">' +
              labels[j] +
              ") " +
              opt +
              (isCorrect ? " ✓" : "") +
              "</div>";
          });
          html +=
            '<div class="explanation">' +
            getExplanationHtml(q).replace(/<br>/g, "<br>") +
            "</div>";
          html += "</div>";
        });

        html += "</body></html>";
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }

      function retryWrongAnswers() {
        const retriedState = createRetryWrongAnswersState({
          allQuestions,
          selectedAnswers,
          solutionVisible,
          resolveQuestionKey: cardId,
        });

        if (!retriedState.hasWrongQuestions) {
          alert("Yanlış cevaplanan soru bulunamadı. Önce soruları cevaplayın.");
          return;
        }

        filteredQuestions = retriedState.filteredQuestions;
        selectedAnswers = retriedState.selectedAnswers;
        solutionVisible = retriedState.solutionVisible;
        questionOrder = retriedState.questionOrder;
        currentQuestionIndex = retriedState.currentQuestionIndex;
        document.getElementById("topic-select").value = "hepsi";
        document
          .getElementById("jump-input")
          .setAttribute("max", filteredQuestions.length);
        saveState();
        updateScoreDisplay();
        displayQuestion();
      }

      function resetQuiz() {
        if (
          !confirm(
            "Seçili/aktif setlerdeki cevaplarınız ve ilerlemeniz sıfırlanacak. Emin misiniz?",
          )
        )
          return;
        const resetState = createResetStudyState({
          allQuestions,
          selectedAnswers,
          solutionVisible,
          resolveQuestionKey: cardId,
        });

        selectedAnswers = resetState.selectedAnswers;
        solutionVisible = resetState.solutionVisible;
        currentQuestionIndex = resetState.currentQuestionIndex;
        filteredQuestions = resetState.filteredQuestions;
        questionOrder = resetState.questionOrder;
        document.getElementById("topic-select").value = "hepsi";

        const jumpInput = document.getElementById("jump-input");
        if (jumpInput) jumpInput.setAttribute("max", filteredQuestions.length);

        saveState();
        updateScoreDisplay();
        displayQuestion();
      }

      function updateScoreDisplay() {
        const scoreHtml = formatScoreSummaryHtml(
          buildScoreSummary({
            allQuestions,
            selectedAnswers,
            resolveQuestionKey: cardId,
          }),
        );
        ["score-display", "fullscreen-score-display"].forEach((elementId) => {
          const scoreEl = document.getElementById(elementId);
          if (scoreEl) {
            scoreEl.innerHTML = scoreHtml;
          }
        });
      }

      function saveState() {
        try {
          const activeQuestion =
            filteredQuestions.length > 0
              ? filteredQuestions[questionOrder[currentQuestionIndex]]
              : null;
          const topicSelect = document.getElementById("topic-select");
          const sessionState = persistStudyState({
            storage,
            activeQuestion,
            currentQuestionIndex,
            selectedTopic: topicSelect ? topicSelect.value : "hepsi",
            selectedAnswers,
            solutionVisible,
          });
          pendingSession = sessionState;
        } catch (e) {
          console.error("State saving error", e);
        }
      }

      function loadState() {
        try {
          window.ThemeManager.initThemeFromStorage({
            primaryToggleId: "theme-toggle",
            managerToggleId: "theme-toggle-manager",
            storageApi: storage,
            storageKey: "quiz-theme",
          });

          const storedAnswerLock = storage.getItem(ANSWER_LOCK_KEY);
          if (storedAnswerLock === "0" || storedAnswerLock === "1") {
            answerLockEnabled = storedAnswerLock === "1";
          }
          const storedAutoAdvance = storage.getItem(AUTO_ADVANCE_KEY);
          if (storedAutoAdvance === "0" || storedAutoAdvance === "1") {
            autoAdvanceEnabled = storedAutoAdvance === "1";
          }

          const loadedState = loadPersistedStudyState({
            storage,
            loadedSets,
            fallbackSession: null,
          });
          selectedAnswers = loadedState.selectedAnswers;
          solutionVisible = loadedState.solutionVisible;
          pendingSession = loadedState.pendingSession;
        } catch (e) {
          console.error("State loading error", e);
        }
        syncAnswerLockToggleUI();
        syncAutoAdvanceToggleUI();
      }

      function populateTopicFilter() {
        const select = document.getElementById("topic-select");
        if (!select) return;
        const subjects = collectStudySubjects(allQuestions);
        select.innerHTML = '<option value="hepsi">Tüm Başlıklar</option>';
        subjects.forEach((subject) => {
          const option = document.createElement("option");
          option.value = subject;
          option.textContent = subject;
          select.appendChild(option);
        });
      }

      // -- BAŞLATMA MANTIĞI --
      document.addEventListener("keydown", function (e) {
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")
          return;

        const isMainAppVisible =
          document.getElementById("main-app").style.display !== "none";

        if ((e.key === "f" || e.key === "F") && isMainAppVisible) {
          e.preventDefault();
          toggleFullscreen();
          return;
        }

        if (e.key === "Escape" && isFullscreen) {
          e.preventDefault();
          toggleFullscreen();
          return;
        }

        // Yalnızca main-app görünürse tuşlara izin ver
        if (!isMainAppVisible)
          return;

        if (e.key === "ArrowLeft") {
          previousQuestion();
        } else if (e.key === "ArrowRight") {
          nextQuestion();
        } else if (e.key === "s" || e.key === "S") {
          toggleSolution();
        } else if (e.key >= "a" && e.key <= "e") {
          selectOption(e.key.charCodeAt(0) - 97);
        } else if (e.key >= "A" && e.key <= "E") {
          selectOption(e.key.charCodeAt(0) - 65);
        }
      });

      // İlk yüklendiğinde set listesini localStorage'dan getir
      function initApp() {
        try {
          const storedSets = storage.getItem("mc_loaded_sets");
          const storedSelected = storage.getItem("mc_selected_sets");

          if (storedSets) {
            const setIds = JSON.parse(storedSets);
            setIds.forEach((id) => {
              const setData = storage.getItem("mc_set_" + id);
              if (setData) {
                loadedSets[id] = JSON.parse(setData);
              }
            });
          }

          if (storedSelected) {
            const selArray = JSON.parse(storedSelected);
            selectedSets = new Set(selArray.filter((id) => loadedSets[id]));
          }
        } catch (e) {
          console.error("Cache load error", e);
        }

        loadState();
        showScreen("manager");
        renderSetList();
        initGoogleDrive();
      }

      Object.assign(window, {
        toggleDeleteMode,
        selectAllSets,
        clearSetSelection,
        removeSelectedSets,
        authGoogleDrive,
        handleFileSelect,
        startStudy,
        toggleTheme,
        setAnswerLock,
        setAutoAdvance,
        undoLastRemoval,
        filterByTopic,
        jumpToQuestion,
        showSetManager,
        shuffleQuestions,
        retryWrongAnswers,
        exportPrintable,
        resetQuiz,
        previousQuestion,
        nextQuestion,
        toggleFullscreen,
        toggleSolution,
      });

      initApp();
