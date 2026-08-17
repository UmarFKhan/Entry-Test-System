/* ==========================================================================
   Bahria University CBT System - Review Page Filter Handler
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const filterBtns = document.querySelectorAll('.review-filter-btn');
  const reviewCards = document.querySelectorAll('.review-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active', 'btn-primary'));
      filterBtns.forEach(b => b.classList.add('btn-secondary'));
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-secondary');

      const filter = btn.dataset.filter;

      reviewCards.forEach(card => {
        const isCorrect = card.dataset.isCorrect === 'true';
        const isSkipped = card.dataset.isSkipped === 'true';
        const isIncorrect = !isCorrect && !isSkipped;

        if (filter === 'all') {
          card.style.display = 'block';
        } else if (filter === 'correct' && isCorrect) {
          card.style.display = 'block';
        } else if (filter === 'incorrect' && isIncorrect) {
          card.style.display = 'block';
        } else if (filter === 'skipped' && isSkipped) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
});
