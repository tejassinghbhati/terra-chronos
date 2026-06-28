class StatusBox {
  constructor() {
    this.speedEl      = document.getElementById('simSpeed');
    this.travelEl     = document.getElementById('travelProgress');
    this.travelLabel  = document.getElementById('travelLabel');
    this.progressFill = document.getElementById('progressFill');
  }

  init() {
    window.Bus.on('FRAME_TICK',          (data) => this._onTick(data));
    window.Bus.on('SPEED_CHANGED',       (data) => this._onSpeedChanged(data));
    window.Bus.on('PLAYBACK_STARTED',    ()     => {
      if (this.travelEl) this.travelEl.style.display = 'block';
    });
    window.Bus.on('PLAYBACK_PAUSED',     ()     => {
      if (this.travelEl) this.travelEl.style.display = 'none';
    });
    window.Bus.on('MILLENNIUM_CHANGED', (data) => this._updateTarget(data));
  }

  _onTick({ progress }) {
    if (this.progressFill) {
      this.progressFill.style.width = Math.min(progress * 100, 100).toFixed(1) + '%';
    }
  }

  _onSpeedChanged({ speed }) {
    const labels = { 0.5: '500 YRS/MIN', 1: '1000 YRS/MIN', 2: '2000 YRS/MIN' };
    if (this.speedEl) this.speedEl.textContent = labels[speed] || '1000 YRS/MIN';
  }

  _updateTarget({ snapshot }) {
    if (this.travelLabel && snapshot) {
      const y     = snapshot.year;
      const label = y < 0
        ? `${Math.abs(y).toLocaleString()} BCE`
        : y === 0 ? '1 CE' : `${y} CE`;
      this.travelLabel.textContent = `TRAVELING TO ${label}…`;
    }
  }
}

window.StatusBox = StatusBox;
