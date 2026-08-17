/* ==========================================================================
   Atechabad Testing System (ATS) - Main Client App Logic (Enhanced UI & Audio)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.EXAM_QUESTIONS || window.EXAM_QUESTIONS.length === 0) return;

  let questions = window.EXAM_QUESTIONS;
  let currentIndex = 0;
  let userAnswers = {}; // q_id -> selected option text
  let flaggedQuestions = new Set(); // q_id set
  let timerInstance = null;
  let candidateName = sessionStorage.getItem('ats_candidate_name') || sessionStorage.getItem('bu_candidate_name') || 'Candidate Name';

  // Sound Synthesizer (Web Audio API - No external files needed!)
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playSound(type) {
    if (window.CBT_SOUND_MUTED) return;
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'select') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'flag') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.06); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'nav') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (e) {
      console.log('Audio playback error:', e);
    }
  }

  // DOM Elements
  const qSectionBadge = document.getElementById('qSectionBadge');
  const qSeqNum = document.getElementById('qSeqNum');
  const qSeqNumHeader = document.getElementById('qSeqNumHeader');
  const qTotalCount = document.getElementById('qTotalCount');
  const qDiffBadge = document.getElementById('qDiffBadge');
  const qText = document.getElementById('qText');
  const optionsList = document.getElementById('optionsList');
  const paletteGrid = document.getElementById('paletteGrid');
  const timerDisplay = document.getElementById('timerDisplay');
  const candidateNameInput = document.getElementById('candidateNameInput');
  const progressFillBar = document.getElementById('progressFillBar');
  const answeredCounterBadge = document.getElementById('answeredCounterBadge');
  const paletteSummaryText = document.getElementById('paletteSummaryText');
  const statAns = document.getElementById('statAns');
  const statFlag = document.getElementById('statFlag');
  const statUnans = document.getElementById('statUnans');

  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnFlag = document.getElementById('btnFlag');
  const btnSubmit = document.getElementById('btnSubmit');

  // ── Session Key Logic ─────────────────────────────────────────────────────
  // The server stamps each new exam start with a unique session_key.
  // Same key   → mid-exam REFRESH   → restore everything from LocalStorage.
  // New/missing key → NEW exam start → discard old state, use server questions.
  const serverSessionKey = window.EXAM_SESSION_KEY || '';
  const savedState = CBTStorage.getExamState();
  const isResume = savedState && savedState.sessionKey && savedState.sessionKey === serverSessionKey;

  const examDurationMinutes = window.EXAM_DURATION_MINUTES || 120;
  let initialRemaining = examDurationMinutes * 60;

  if (isResume) {
    // Restore the mid-exam state exactly as it was
    questions = savedState.questions || window.EXAM_QUESTIONS || [];
    userAnswers = savedState.userAnswers || {};
    flaggedQuestions = new Set(savedState.flaggedQuestions || []);
    currentIndex = savedState.currentIndex || 0;
    if (savedState.candidateName) candidateName = savedState.candidateName;

    if (typeof savedState.remainingSeconds === 'number' && savedState.lastTimestamp) {
      const elapsedSeconds = Math.floor((Date.now() - savedState.lastTimestamp) / 1000);
      initialRemaining = savedState.remainingSeconds - elapsedSeconds;
    }

    if (initialRemaining <= 0) {
      CBTStorage.clearExamState();
      initialRemaining = examDurationMinutes * 60;
      userAnswers = {};
      flaggedQuestions.clear();
      currentIndex = 0;
    }
  } else {
    // Fresh start — clear any old session and use the server-provided questions
    CBTStorage.clearExamState();
  }

  if (candidateNameInput) {
    candidateNameInput.value = candidateName;
  }

  function saveState(remainingSecs = null) {
    const currentRemaining = (remainingSecs !== null && !isNaN(remainingSecs)) 
      ? remainingSecs 
      : (timerInstance ? timerInstance.remainingSeconds : initialRemaining);

    const state = {
      sessionKey: serverSessionKey,          // ← ties this save to the current exam
      questions: questions,
      userAnswers: userAnswers,
      flaggedQuestions: Array.from(flaggedQuestions),
      currentIndex: currentIndex,
      candidateName: candidateName,
      remainingSeconds: currentRemaining,
      lastTimestamp: Date.now(),
      questionsLength: questions.length
    };
    CBTStorage.saveExamState(state);
  }

  // Initialize Timer
  timerInstance = new CBTTimer(
    examDurationMinutes,
    (remaining, formatted) => {
      if (timerDisplay) {
        timerDisplay.textContent = formatted;
        if (remaining <= 600) { // Under 10 minutes warning glow
          timerDisplay.classList.add('timer-low-alert');
        } else {
          timerDisplay.classList.remove('timer-low-alert');
        }
      }
      saveState(remaining);
    },
    () => {
      alert("⏰ Time is up! Your exam will now be automatically submitted.");
      submitExam();
    }
  );
  timerInstance.start(initialRemaining);

  function renderQuestion(index) {
    currentIndex = index;
    const q = questions[currentIndex];
    const qId = String(q.id);

    // Update Header Text & Sequence Numbers
    if (qSectionBadge) qSectionBadge.textContent = q.section || 'General';
    if (qSeqNum) qSeqNum.textContent = currentIndex + 1;
    if (qSeqNumHeader) qSeqNumHeader.textContent = currentIndex + 1;
    if (qTotalCount) qTotalCount.textContent = questions.length;

    // Difficulty Badge
    if (qDiffBadge) {
      qDiffBadge.textContent = q.difficulty || 'Medium';
      qDiffBadge.className = `q-diff-badge q-diff-${q.difficulty || 'Medium'}`;
    }

    // Question Text
    if (qText) qText.textContent = q.question;

    // Options List
    if (optionsList) {
      optionsList.innerHTML = '';
      const selectedOpt = userAnswers[qId];
      const optPrefixes = ['A', 'B', 'C', 'D', 'E'];

      q.options.forEach((optText, idx) => {
        const isSelected = selectedOpt === optText;
        const prefix = optPrefixes[idx] || String(idx + 1);

        const optDiv = document.createElement('div');
        optDiv.className = `option-item ${isSelected ? 'selected' : ''}`;
        optDiv.dataset.optionText = optText;

        optDiv.innerHTML = `
          <div class="opt-left">
            <div class="opt-prefix">${prefix}</div>
            <div class="opt-text">${optText}</div>
          </div>
          <div class="opt-key-hint">[Key ${idx + 1}]</div>
        `;

        optDiv.addEventListener('click', () => {
          selectOption(qId, optText);
        });

        optionsList.appendChild(optDiv);
      });
    }

    // Update Flag Button State
    if (btnFlag) {
      if (flaggedQuestions.has(qId)) {
        btnFlag.innerHTML = `🚩 Flagged`;
        btnFlag.className = 'btn btn-warning';
      } else {
        btnFlag.innerHTML = `🏳️ Flag Question`;
        btnFlag.className = 'btn btn-secondary';
      }
    }

    // Prev/Next disable logic
    if (btnPrev) btnPrev.disabled = currentIndex === 0;
    if (btnNext) btnNext.disabled = currentIndex === questions.length - 1;

    renderPalette();
    saveState();
  }

  function selectOption(qId, optionText) {
    playSound('select');
    if (userAnswers[qId] === optionText) {
      delete userAnswers[qId];
    } else {
      userAnswers[qId] = optionText;
    }
    renderQuestion(currentIndex);
  }

  function renderPalette() {
    if (!paletteGrid) return;
    paletteGrid.innerHTML = '';

    const answeredCount = Object.keys(userAnswers).length;
    const flaggedCount = flaggedQuestions.size;
    const totalCount = questions.length;
    const unansweredCount = totalCount - answeredCount;
    const percent = Math.round((answeredCount / totalCount) * 100);

    // Update Live Counters
    if (progressFillBar) progressFillBar.style.width = `${percent}%`;
    if (answeredCounterBadge) answeredCounterBadge.textContent = `${answeredCount} / ${totalCount} Answered (${percent}%)`;
    if (paletteSummaryText) paletteSummaryText.textContent = `${answeredCount}/${totalCount} Done`;
    if (statAns) statAns.textContent = answeredCount;
    if (statFlag) statFlag.textContent = flaggedCount;
    if (statUnans) statUnans.textContent = unansweredCount;

    questions.forEach((q, idx) => {
      const qId = String(q.id);
      const isCurrent = idx === currentIndex;
      const isAnswered = !!userAnswers[qId];
      const isFlagged = flaggedQuestions.has(qId);

      const pBtn = document.createElement('button');
      pBtn.className = 'p-btn';
      pBtn.textContent = idx + 1;

      if (isCurrent) {
        pBtn.classList.add('current');
      } else if (isFlagged) {
        pBtn.classList.add('flagged');
      } else if (isAnswered) {
        pBtn.classList.add('answered');
      }

      pBtn.addEventListener('click', () => {
        playSound('nav');
        renderQuestion(idx);
      });

      paletteGrid.appendChild(pBtn);
    });
  }

  // Flag button handler
  if (btnFlag) {
    btnFlag.addEventListener('click', () => {
      playSound('flag');
      const qId = String(questions[currentIndex].id);
      if (flaggedQuestions.has(qId)) {
        flaggedQuestions.delete(qId);
      } else {
        flaggedQuestions.add(qId);
      }
      renderQuestion(currentIndex);
    });
  }

  // Navigation handlers
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      playSound('nav');
      if (currentIndex > 0) renderQuestion(currentIndex - 1);
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      playSound('nav');
      if (currentIndex < questions.length - 1) renderQuestion(currentIndex + 1);
    });
  }

  // Submit modal elements
  const submitModal = document.getElementById('submitModal');
  const modalAnsCount = document.getElementById('modalAnsCount');
  const modalTotalCount = document.getElementById('modalTotalCount');
  const modalUnansCount = document.getElementById('modalUnansCount');
  const modalFlagCount = document.getElementById('modalFlagCount');
  const modalTimeLeft = document.getElementById('modalTimeLeft');
  const btnCancelSubmit = document.getElementById('btnCancelSubmit');
  const btnConfirmSubmit = document.getElementById('btnConfirmSubmit');

  function openSubmitModal() {
    const answeredCount = Object.keys(userAnswers).length;
    const totalCount = questions.length;
    const unansweredCount = totalCount - answeredCount;
    const flaggedCount = flaggedQuestions.size;

    if (modalAnsCount) modalAnsCount.textContent = answeredCount;
    if (modalTotalCount) modalTotalCount.textContent = totalCount;
    if (modalUnansCount) modalUnansCount.textContent = unansweredCount;
    if (modalFlagCount) modalFlagCount.textContent = flaggedCount;
    if (modalTimeLeft) modalTimeLeft.textContent = timerDisplay ? timerDisplay.textContent : '00:00';

    if (submitModal) submitModal.style.display = 'flex';
  }

  function closeSubmitModal() {
    if (submitModal) submitModal.style.display = 'none';
  }

  // Submit test handler
  function submitExam() {
    if (timerInstance) timerInstance.stop();
    const finalCandidateName = (candidateNameInput && candidateNameInput.value) ? candidateNameInput.value.trim() : (candidateName || 'Candidate Name');
    const timeTaken = timerInstance ? timerInstance.getTimeTakenSeconds() : 0;

    const payload = {
      candidate_name: finalCandidateName,
      candidate_roll: 'ATS-' + Math.floor(100000 + Math.random() * 900000),
      time_taken_seconds: timeTaken,
      answers: userAnswers,
      questions: questions
    };

    if (btnConfirmSubmit) {
      btnConfirmSubmit.disabled = true;
      btnConfirmSubmit.textContent = '⏳ Submitting...';
    }

    const submitEndpoint = window.SUBMIT_URL || 'submit';
    fetch(submitEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      const isSuccess = data.status === 'success' || data.success === true;
      const targetUrl = data.redirect || data.redirect_url;
      if (isSuccess && targetUrl) {
        CBTStorage.clearExamState();
        window.location.href = targetUrl;
      } else {
        alert('Failed to submit exam: ' + (data.message || data.error || 'Unknown error'));
        if (btnConfirmSubmit) {
          btnConfirmSubmit.disabled = false;
          btnConfirmSubmit.textContent = '🚀 Confirm Submit';
        }
      }
    })
    .catch(err => {
      console.error('Submission error:', err);
      alert('Error submitting exam: ' + err.message);
      if (btnConfirmSubmit) {
        btnConfirmSubmit.disabled = false;
        btnConfirmSubmit.textContent = '🚀 Confirm Submit';
      }
    });
  }

  if (btnSubmit) {
    btnSubmit.addEventListener('click', () => {
      openSubmitModal();
    });
  }

  if (btnCancelSubmit) {
    btnCancelSubmit.addEventListener('click', () => {
      closeSubmitModal();
    });
  }

  if (btnConfirmSubmit) {
    btnConfirmSubmit.addEventListener('click', () => {
      submitExam();
    });
  }

  // Keyboard Shortcuts (1, 2, 3, 4, N, P, F, S, Arrows)
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    const key = e.key.toUpperCase();
    const q = questions[currentIndex];
    const qId = String(q.id);

    if (['1', '2', '3', '4'].includes(key)) {
      const optIdx = parseInt(key) - 1;
      if (q.options[optIdx]) {
        selectOption(qId, q.options[optIdx]);
      }
    } else if (key === 'N' || e.key === 'ArrowRight') {
      playSound('nav');
      if (currentIndex < questions.length - 1) renderQuestion(currentIndex + 1);
    } else if (key === 'P' || e.key === 'ArrowLeft') {
      playSound('nav');
      if (currentIndex > 0) renderQuestion(currentIndex - 1);
    } else if (key === 'F') {
      if (btnFlag) btnFlag.click();
    } else if (key === 'S') {
      if (btnSubmit) btnSubmit.click();
    }
  });

  window.addEventListener('beforeunload', () => {
    saveState();
  });

  // Initial Render
  renderQuestion(currentIndex);
});
