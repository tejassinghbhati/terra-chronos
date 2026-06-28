class ResilienceManager {
  constructor() {
    this.SAVE_KEY = 'terrachronos_session';
  }

  init() {
    window.Bus.on('MILLENNIUM_CHANGED', (data) => this._autoSave(data));

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => window.Bus.emit('EXPORT_REQUESTED'));
    }
  }

  _autoSave({ index, snapshot }) {
    try {
      const session = {
        index,
        year:         snapshot.year,
        timestamp:    Date.now(),
        forkHistory:  window.State ? window.State.get('forkHistory') : [],
      };
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(session));
    } catch {
      // localStorage may be unavailable in private browsing
    }
  }

  getSavedSession() {
    try {
      return JSON.parse(localStorage.getItem(this.SAVE_KEY));
    } catch {
      return null;
    }
  }

  clearSession() {
    try { localStorage.removeItem(this.SAVE_KEY); } catch {}
  }
}

window.ResilienceManager = ResilienceManager;
