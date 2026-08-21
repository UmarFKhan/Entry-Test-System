/* ==========================================================================
   Atechabad Testing System (ATS) - Enterprise CBT Client Engine
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.EXAM_QUESTIONS || window.EXAM_QUESTIONS.length === 0) return;

  // Clear any leftover stored state - fresh non-resumable exam session
  CBTStorage.clearExamState();

  const allQuestions = window.EXAM_QUESTIONS;
  let activeFilterSection = 'all';
  let filteredIndices = allQuestions.map((_, i) => i);
  let currentIndex = 0; // index in allQuestions
  
  let userAnswers = {}; // q_id -> option text
  let reviewedQuestions = new Set(); // q_id set for "Marked for Review"
  let visitedQuestions = new Set([0]); // indices visited
  let timerInstance = null;
  let isSubmitted = false;

  let candidateName = sessionStorage.getItem('ats_candidate_name') || sessionStorage.getItem('bu_candidate_name') || 'Candidate Name';
  const candidateNameInput = document.getElementById('candidateNameInput');
  if (candidateNameInput && candidateNameInput.value) {
    candidateName = candidateNameInput.value.trim();
  }

  // Audio Synthesizer for feedback
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playSound(type) {
    if (window.CBT_SOUND_MUTED) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'select') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.06);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'review') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'nav') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch (e) {}
  }

  // DOM References
  const qSectionBadge = document.getElementById('qSectionBadge');
  const qSeqNum = document.getElementById('qSeqNum');
  const qSeqNumHeader = document.getElementById('qSeqNumHeader');
  const qTotalCount = document.getElementById('qTotalCount');
  const qDiffBadge = document.getElementById('qDiffBadge');
  const qText = document.getElementById('qText');
  const optionsList = document.getElementById('optionsList');
  const paletteGrid = document.getElementById('paletteGrid');
  const timerDisplay = document.getElementById('timerDisplay');
  const progressFillBar = document.getElementById('progressFillBar');
  const answeredCounterBadge = document.getElementById('answeredCounterBadge');
  const paletteSummaryText = document.getElementById('paletteSummaryText');

  const statAns = document.getElementById('statAns');
  const statReview = document.getElementById('statReview');
  const statUnans = document.getElementById('statUnans');
  const statNotVisited = document.getElementById('statNotVisited');

  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnMarkReview = document.getElementById('btnMarkReview');
  const markReviewText = document.getElementById('markReviewText');
  const btnClearResponse = document.getElementById('btnClearResponse');
  const btnSubmit = document.getElementById('btnSubmit');

  const sectionTabsContainer = document.getElementById('sectionTabsContainer');

  // Count sections for tabs
  function updateSectionCounts() {
    const counts = { all: allQuestions.length, english: 0, maths: 0, physics: 0, computer: 0, analytical: 0 };
    allQuestions.forEach(q => {
      const s = (q.subject || q.section || '').toLowerCase();
      if (s.includes('eng')) counts.english++;
      else if (s.includes('math')) counts.maths++;
      else if (s.includes('phys')) counts.physics++;
      else if (s.includes('comp') || s.includes('cs')) counts.computer++;
      else if (s.includes('ana') || s.includes('intel') || s.includes('logic')) counts.analytical++;
    });

    const setTabCount = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    };
    setTabCount('countTabAll', counts.all);
    setTabCount('countTabEnglish', counts.english);
    setTabCount('countTabMaths', counts.maths);
    setTabCount('countTabPhysics', counts.physics);
    setTabCount('countTabComputer', counts.computer);
    setTabCount('countTabAnalytical', counts.analytical);
  }
  updateSectionCounts();

  // Initialize Countdown Timer
  const examDurationMinutes = window.EXAM_DURATION_MINUTES || 120;
  timerInstance = new CBTTimer(
    examDurationMinutes,
    (remaining, formatted) => {
      if (timerDisplay) {
        timerDisplay.textContent = formatted;
        if (remaining <= 600) {
          timerDisplay.classList.add('timer-low-alert');
        } else {
          timerDisplay.classList.remove('timer-low-alert');
        }
      }
    },
    () => {
      alert("Time is up! Your responses will now be automatically submitted for evaluation.");
      submitExam();
    }
  );
  timerInstance.start(examDurationMinutes * 60);

  // Render Current Question
  function renderQuestion(index) {
    currentIndex = index;
    visitedQuestions.add(currentIndex);
    const q = allQuestions[currentIndex];
    const qId = String(q.id);

    if (qSectionBadge) qSectionBadge.textContent = q.subject || q.section || 'General';
    if (qSeqNum) qSeqNum.textContent = currentIndex + 1;
    if (qSeqNumHeader) qSeqNumHeader.textContent = currentIndex + 1;
    if (qTotalCount) qTotalCount.textContent = allQuestions.length;

    if (qDiffBadge) {
      const diff = q.difficulty || 'Medium';
      qDiffBadge.textContent = diff;
      qDiffBadge.className = `q-diff-badge q-diff-${diff}`;
    }

    if (qText) qText.textContent = q.question;

    // Render Radio Option Selectors
    if (optionsList) {
      optionsList.innerHTML = '';
      const selectedOpt = userAnswers[qId];
      const optLetters = ['A', 'B', 'C', 'D', 'E'];

      q.options.forEach((optText, optIdx) => {
        const isSelected = selectedOpt === optText;
        const letter = optLetters[optIdx] || String(optIdx + 1);

        const row = document.createElement('div');
        row.className = `cbt-option-row ${isSelected ? 'selected' : ''}`;
        row.dataset.optionText = optText;

        row.innerHTML = `
          <div class="cbt-opt-left">
            <div class="cbt-opt-letter">${letter}</div>
            <div class="cbt-opt-text">${optText}</div>
          </div>
          <div>
            <kbd class="kbd">Key ${optIdx + 1}</kbd>
          </div>
        `;

        row.addEventListener('click', () => {
          selectOption(qId, optText);
        });

        optionsList.appendChild(row);
      });
    }

    // Update Mark for Review button state
    if (btnMarkReview) {
      const isReview = reviewedQuestions.has(qId);
      if (isReview) {
        btnMarkReview.classList.add('active-review');
        if (markReviewText) markReviewText.textContent = 'Marked for Review';
      } else {
        btnMarkReview.classList.remove('active-review');
        if (markReviewText) markReviewText.textContent = 'Mark for Review';
      }
    }

    // Navigation buttons state
    if (btnPrev) btnPrev.disabled = currentIndex === 0;
    if (btnNext) {
      if (currentIndex === allQuestions.length - 1) {
        btnNext.innerHTML = `<span>Review End</span>`;
      } else {
        btnNext.innerHTML = `<span>Save & Next</span> <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      }
    }

    renderPalette();
  }

  function selectOption(qId, optText) {
    playSound('select');
    if (userAnswers[qId] === optText) {
      delete userAnswers[qId];
    } else {
      userAnswers[qId] = optText;
    }
    renderQuestion(currentIndex);
  }

  // Render Status Matrix Palette
  function renderPalette() {
    if (!paletteGrid) return;
    paletteGrid.innerHTML = '';

    const answeredCount = Object.keys(userAnswers).length;
    const reviewCount = reviewedQuestions.size;
    const totalCount = allQuestions.length;
    const unansweredCount = totalCount - answeredCount;
    const notVisitedCount = totalCount - visitedQuestions.size;
    const pct = Math.round((answeredCount / totalCount) * 100);

    if (progressFillBar) progressFillBar.style.width = `${pct}%`;
    if (answeredCounterBadge) {
      answeredCounterBadge.innerHTML = `<span class="badge-dot"></span> ${answeredCount} / ${totalCount} Answered (${pct}%)`;
    }
    if (paletteSummaryText) paletteSummaryText.textContent = `${answeredCount}/${totalCount} Answered`;

    if (statAns) statAns.textContent = answeredCount;
    if (statReview) statReview.textContent = reviewCount;
    if (statUnans) statUnans.textContent = unansweredCount;
    if (statNotVisited) statNotVisited.textContent = notVisitedCount;

    allQuestions.forEach((q, idx) => {
      // Check if filtered by section tab
      if (activeFilterSection !== 'all') {
        const s = (q.subject || q.section || '').toLowerCase();
        let match = false;
        if (activeFilterSection === 'english' && s.includes('eng')) match = true;
        else if (activeFilterSection === 'maths' && s.includes('math')) match = true;
        else if (activeFilterSection === 'physics' && s.includes('phys')) match = true;
        else if (activeFilterSection === 'computer' && (s.includes('comp') || s.includes('cs'))) match = true;
        else if (activeFilterSection === 'analytical' && (s.includes('ana') || s.includes('logic') || s.includes('intel'))) match = true;
        if (!match) return;
      }

      const qId = String(q.id);
      const isCurrent = idx === currentIndex;
      const isAnswered = !!userAnswers[qId];
      const isReview = reviewedQuestions.has(qId);
      const isVisited = visitedQuestions.has(idx);

      const node = document.createElement('button');
      node.className = 'cbt-q-node';
      node.textContent = idx + 1;
      node.setAttribute('aria-label', `Question ${idx + 1}`);

      if (isReview) {
        node.classList.add('marked-review');
      } else if (isAnswered) {
        node.classList.add('answered');
      } else if (isVisited) {
        node.classList.add('unanswered');
      }

      if (isCurrent) {
        node.classList.add('current');
      }

      node.addEventListener('click', () => {
        playSound('nav');
        renderQuestion(idx);
      });

      paletteGrid.appendChild(node);
    });
  }

  // Section Tabs Switching
  if (sectionTabsContainer) {
    const tabBtns = sectionTabsContainer.querySelectorAll('.cbt-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilterSection = btn.dataset.section || 'all';

        // If current question is outside active tab, jump to first matching question
        if (activeFilterSection !== 'all') {
          const matchIdx = allQuestions.findIndex(q => {
            const s = (q.subject || q.section || '').toLowerCase();
            if (activeFilterSection === 'english' && s.includes('eng')) return true;
            if (activeFilterSection === 'maths' && s.includes('math')) return true;
            if (activeFilterSection === 'physics' && s.includes('phys')) return true;
            if (activeFilterSection === 'computer' && (s.includes('comp') || s.includes('cs'))) return true;
            if (activeFilterSection === 'analytical' && (s.includes('ana') || s.includes('logic') || s.includes('intel'))) return true;
            return false;
          });
          if (matchIdx !== -1) {
            renderQuestion(matchIdx);
            return;
          }
        }
        renderPalette();
      });
    });
  }

  // Mark for Review action
  if (btnMarkReview) {
    btnMarkReview.addEventListener('click', () => {
      playSound('review');
      const qId = String(allQuestions[currentIndex].id);
      if (reviewedQuestions.has(qId)) {
        reviewedQuestions.delete(qId);
      } else {
        reviewedQuestions.add(qId);
      }
      renderQuestion(currentIndex);
    });
  }

  // Clear Response action
  if (btnClearResponse) {
    btnClearResponse.addEventListener('click', () => {
      const qId = String(allQuestions[currentIndex].id);
      if (userAnswers[qId]) {
        delete userAnswers[qId];
        renderQuestion(currentIndex);
      }
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
      if (currentIndex < allQuestions.length - 1) {
        renderQuestion(currentIndex + 1);
      } else {
        openSubmitModal();
      }
    });
  }

  // Modal Actions
  const submitModal = document.getElementById('submitModal');
  const modalAnsCount = document.getElementById('modalAnsCount');
  const modalTotalCount = document.getElementById('modalTotalCount');
  const modalReviewCount = document.getElementById('modalReviewCount');
  const modalUnansCount = document.getElementById('modalUnansCount');
  const modalTimeLeft = document.getElementById('modalTimeLeft');
  const btnCancelSubmit = document.getElementById('btnCancelSubmit');
  const btnConfirmSubmit = document.getElementById('btnConfirmSubmit');

  function openSubmitModal() {
    const answeredCount = Object.keys(userAnswers).length;
    const totalCount = allQuestions.length;
    const unansweredCount = totalCount - answeredCount;
    const reviewCount = reviewedQuestions.size;

    if (modalAnsCount) modalAnsCount.textContent = answeredCount;
    if (modalTotalCount) modalTotalCount.textContent = totalCount;
    if (modalReviewCount) modalReviewCount.textContent = reviewCount;
    if (modalUnansCount) modalUnansCount.textContent = unansweredCount;
    if (modalTimeLeft) modalTimeLeft.textContent = timerDisplay ? timerDisplay.textContent : '00:00';

    if (submitModal) submitModal.style.display = 'flex';
  }

  function closeSubmitModal() {
    if (submitModal) submitModal.style.display = 'none';
  }

  // Submit test handler
  function submitExam() {
    if (isSubmitted) return;
    isSubmitted = true;

    if (timerInstance) timerInstance.stop();
    const finalCandidateName = (candidateNameInput && candidateNameInput.value) ? candidateNameInput.value.trim() : (candidateName || 'Candidate Name');
    const timeTaken = timerInstance ? timerInstance.getTimeTakenSeconds() : 0;

    const payload = {
      candidate_name: finalCandidateName,
      candidate_roll: 'ATS-' + Math.floor(100000 + Math.random() * 900000),
      time_taken_seconds: timeTaken,
      answers: userAnswers,
      questions: allQuestions
    };

    if (btnConfirmSubmit) {
      btnConfirmSubmit.disabled = true;
      btnConfirmSubmit.innerHTML = `
        <svg class="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle></svg>
        <span>Submitting...</span>
      `;
    }

    const submitEndpoint = window.SUBMIT_URL || '/submit';
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
        alert('Submission failed: ' + (data.message || data.error || 'Unknown error'));
        if (btnConfirmSubmit) {
          btnConfirmSubmit.disabled = false;
          btnConfirmSubmit.textContent = 'Confirm Submit';
          isSubmitted = false;
        }
      }
    })
    .catch(err => {
      console.error('Submission error:', err);
      alert('Error submitting exam: ' + err.message);
      if (btnConfirmSubmit) {
        btnConfirmSubmit.disabled = false;
        btnConfirmSubmit.textContent = 'Confirm Submit';
        isSubmitted = false;
      }
    });
  }

  // Reliable Auto-Submit on exit / screen close
  function handleAutoSubmitOnExit() {
    if (isSubmitted) return;
    isSubmitted = true;

    if (timerInstance) timerInstance.stop();
    const finalCandidateName = (candidateNameInput && candidateNameInput.value) ? candidateNameInput.value.trim() : (candidateName || 'Candidate Name');
    const timeTaken = timerInstance ? timerInstance.getTimeTakenSeconds() : 0;

    const payload = {
      candidate_name: finalCandidateName,
      candidate_roll: 'ATS-' + Math.floor(100000 + Math.random() * 900000),
      time_taken_seconds: timeTaken,
      answers: userAnswers,
      questions: allQuestions
    };

    const submitEndpoint = window.SUBMIT_URL || '/submit';

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(submitEndpoint, blob);
      } else {
        fetch(submitEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Auto-submit error:', e);
    }

    CBTStorage.clearExamState();
  }

  window.addEventListener('pagehide', handleAutoSubmitOnExit);
  window.addEventListener('beforeunload', handleAutoSubmitOnExit);

  if (btnSubmit) {
    btnSubmit.addEventListener('click', openSubmitModal);
  }

  if (btnCancelSubmit) {
    btnCancelSubmit.addEventListener('click', closeSubmitModal);
  }

  if (btnConfirmSubmit) {
    btnConfirmSubmit.addEventListener('click', submitExam);
  }

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    const key = e.key.toUpperCase();
    const q = allQuestions[currentIndex];
    const qId = String(q.id);

    if (['1', '2', '3', '4'].includes(key)) {
      const optIdx = parseInt(key) - 1;
      if (q.options[optIdx]) {
        selectOption(qId, q.options[optIdx]);
      }
    } else if (key === 'N' || e.key === 'ArrowRight') {
      playSound('nav');
      if (currentIndex < allQuestions.length - 1) renderQuestion(currentIndex + 1);
    } else if (key === 'P' || e.key === 'ArrowLeft') {
      playSound('nav');
      if (currentIndex > 0) renderQuestion(currentIndex - 1);
    } else if (key === 'F') {
      if (btnMarkReview) btnMarkReview.click();
    } else if (key === 'S') {
      if (btnSubmit) btnSubmit.click();
    }
  });

  // Initial render
  renderQuestion(0);
});
