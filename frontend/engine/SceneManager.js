class SceneManager {
  constructor() {
    this.promptInput  = document.getElementById('promptInput');
    this.promptSubmit = document.getElementById('promptSubmit');
  }

  init() {
    window.Bus.on('STATE_CHANGED',       (data) => this._onStateChange(data));
    window.Bus.on('MILLENNIUM_PAUSED',   ()     => this._onPaused());
    window.Bus.on('CONTINUE_AFTER_PAUSE',()     => this._onContinued());
  }

  _onStateChange({ next }) {
    const waiting          = next.phase === 'WAITING_FOR_INPUT';
    const isCounterfactual = next.mode  === 'COUNTERFACTUAL';

    if (this.promptInput) {
      // Always typeable so users can pre-compose; glows on pause
      this.promptInput.disabled = false;
      this.promptInput.style.opacity = waiting ? '1' : '0.6';
      this.promptInput.style.borderColor = waiting ? 'var(--accent)' : '';
    }
    if (this.promptSubmit) {
      this.promptSubmit.disabled = !(waiting && isCounterfactual);
    }
  }

  _onPaused() {
    // Don't clear — preserve what the user typed
  }

  _onContinued() {
    if (this.promptInput) {
      this.promptInput.style.opacity = '0.6';
      this.promptInput.style.borderColor = '';
    }
  }
}

window.SceneManager = SceneManager;
