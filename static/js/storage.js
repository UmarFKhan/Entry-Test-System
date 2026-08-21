/* ==========================================================================
   Atechabad Testing System (ATS) - Storage Manager
   ========================================================================== */

const CBTStorage = {
  KEY_EXAM_STATE: 'ats_cbt_exam_state',
  KEY_SETTINGS: 'ats_cbt_settings',
  
  saveExamState(state) {
    // Deprecated: Exams must not be resumable once closed
    try {
      localStorage.removeItem(this.KEY_EXAM_STATE);
      localStorage.removeItem('bu_cbt_exam_state');
    } catch (e) {}
  },

  getExamState() {
    // Tests are non-resumable once closed
    return null;
  },

  clearExamState() {
    try {
      localStorage.removeItem(this.KEY_EXAM_STATE);
      localStorage.removeItem('bu_cbt_exam_state');
      sessionStorage.removeItem('ats_cbt_exam_state');
    } catch (e) {}
  },

  getSettings() {
    try {
      const data = localStorage.getItem(this.KEY_SETTINGS) || localStorage.getItem('bu_cbt_settings');
      return data ? JSON.parse(data) : { theme: 'light', font_size: 'medium', timer_sound: true };
    } catch (e) {
      return { theme: 'light', font_size: 'medium', timer_sound: true };
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {}
  }
};
