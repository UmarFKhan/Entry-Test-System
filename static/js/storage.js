/* ==========================================================================
   Atechabad Testing System (ATS) - Storage Manager
   ========================================================================== */

const CBTStorage = {
  KEY_EXAM_STATE: 'ats_cbt_exam_state',
  KEY_SETTINGS: 'ats_cbt_settings',
  
  saveExamState(state) {
    try {
      localStorage.setItem(this.KEY_EXAM_STATE, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save exam state to LocalStorage:', e);
    }
  },

  getExamState() {
    try {
      let data = localStorage.getItem(this.KEY_EXAM_STATE);
      if (!data) {
        data = localStorage.getItem('bu_cbt_exam_state');
      }
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load exam state:', e);
      return null;
    }
  },

  clearExamState() {
    localStorage.removeItem(this.KEY_EXAM_STATE);
    localStorage.removeItem('bu_cbt_exam_state');
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
    localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(settings));
  }
};
