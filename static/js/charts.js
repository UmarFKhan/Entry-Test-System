/* ==========================================================================
   Bahria University CBT System - Charts Visualization Handler (Chart.js)
   ========================================================================== */

function renderAttemptCharts(attemptData, perfSummaryData) {
  if (typeof Chart === 'undefined') return;

  // 1. Doughnut Chart: Correct vs Wrong vs Skipped
  const accuracyCtx = document.getElementById('accuracyChart');
  if (accuracyCtx) {
    new Chart(accuracyCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Correct', 'Wrong', 'Skipped'],
        datasets: [{
          data: [
            attemptData.correct_count,
            attemptData.wrong_count,
            attemptData.skipped_count
          ],
          backgroundColor: ['#10b981', '#ef4444', '#94a3b8'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { enabled: true }
        },
        cutout: '68%'
      }
    });
  }

  // 2. Bar Chart: Performance by Subject Section
  const sectionCtx = document.getElementById('sectionChart');
  if (sectionCtx && attemptData.section_scores) {
    const secLabels = Object.keys(attemptData.section_scores);
    const secPcts = secLabels.map(s => attemptData.section_scores[s].percentage);

    new Chart(sectionCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: secLabels,
        datasets: [{
          label: 'Score Percentage (%)',
          data: secPcts,
          backgroundColor: '#0ea5e9',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, max: 100 }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // 3. Line Chart: Performance Across Attempts Trend
  const trendCtx = document.getElementById('trendChart');
  if (trendCtx && perfSummaryData && perfSummaryData.attempts_trend) {
    const attemptsTrend = perfSummaryData.attempts_trend;
    const labels = attemptsTrend.map(a => `Attempt #${a.attempt_number}`);
    const scores = attemptsTrend.map(a => a.percentage);

    new Chart(trendCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Score Percentage (%)',
          data: scores,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });
  }
}
