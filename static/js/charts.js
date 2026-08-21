/* ==========================================================================
   Atechabad Testing System (ATS) - Charts Visualization Handler (Chart.js)
   ========================================================================== */

function renderAttemptCharts(attemptData, perfSummaryData) {
  if (typeof Chart === 'undefined') return;

  const isDarkMode = document.body.classList.contains('dark-mode');
  const textColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const fontFamily = "'Plus Jakarta Sans', sans-serif";

  // Global Chart defaults
  Chart.defaults.color = textColor;
  Chart.defaults.font.family = fontFamily;

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
          backgroundColor: ['#10b981', '#f43f5e', '#64748b'],
          borderWidth: 2,
          borderColor: isDarkMode ? '#0f172a' : '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { 
            position: 'bottom',
            labels: { font: { weight: 700 }, boxWidth: 12, padding: 16 }
          },
          tooltip: {
            padding: 10,
            cornerRadius: 8
          }
        },
        cutout: '72%'
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
          label: 'Accuracy (%)',
          data: secPcts,
          backgroundColor: '#2563eb',
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { 
            beginAtZero: true, 
            max: 100,
            grid: { color: gridColor },
            ticks: { callback: v => v + '%' }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: ctx => `Accuracy: ${ctx.raw}%`
            }
          }
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
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { 
            beginAtZero: true, 
            max: 100,
            grid: { color: gridColor },
            ticks: { callback: v => v + '%' }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          tooltip: {
            padding: 10,
            cornerRadius: 8
          }
        }
      }
    });
  }
}
