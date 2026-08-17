/* ==========================================================================
   Bahria University CBT System - Timer Module (Persistence-Enabled)
   ========================================================================== */

class CBTTimer {
  constructor(durationMinutes, onTick, onExpire) {
    this.totalSeconds = durationMinutes * 60;
    this.remainingSeconds = this.totalSeconds;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.timerInterval = null;
    this.isPaused = false;
  }

  start(initialRemainingSeconds = null) {
    if (initialRemainingSeconds !== null && !isNaN(initialRemainingSeconds)) {
      this.remainingSeconds = Math.max(0, parseInt(initialRemainingSeconds));
    }
    
    this.stop();

    // Trigger initial tick immediately for smooth UI display
    if (this.onTick) this.onTick(this.remainingSeconds, this.getFormattedTime());

    if (this.remainingSeconds <= 0) {
      if (this.onExpire) this.onExpire();
      return;
    }

    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.remainingSeconds--;
        if (this.onTick) this.onTick(this.remainingSeconds, this.getFormattedTime());
        
        if (this.remainingSeconds <= 0) {
          this.stop();
          if (this.onExpire) this.onExpire();
        }
      }
    }, 1000);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getFormattedTime() {
    const mins = Math.floor(Math.max(0, this.remainingSeconds) / 60);
    const secs = Math.max(0, this.remainingSeconds) % 60;
    const padMins = String(mins).padStart(2, '0');
    const padSecs = String(secs).padStart(2, '0');
    return `${padMins}:${padSecs}`;
  }

  getTimeTakenSeconds() {
    return Math.max(0, this.totalSeconds - this.remainingSeconds);
  }
}
