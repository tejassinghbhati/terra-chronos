class AudioDirector {
  constructor() {
    this.ctx       = null;
    this.droneOsc  = null;
    this.droneGain = null;
    this.enabled   = false;
  }

  init() {
    // Web Audio requires a user gesture before starting
    document.addEventListener('click', () => this._start(), { once: true });
    window.Bus.on('MILLENNIUM_CHANGED', (d)  => this._onMillennium(d));
    window.Bus.on('COLLAPSE_EVENT',     ()   => this._playCollapse());
    window.Bus.on('SIMULATION_ENDED',   ()   => this._fadeOut());
  }

  _start() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.droneGain.connect(this.ctx.destination);

      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'sine';
      this.droneOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
      this.droneOsc.connect(this.droneGain);
      this.droneOsc.start();

      this.droneGain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 2);
      this.enabled = true;
    } catch {
      // Web Audio not available
    }
  }

  _onMillennium({ snapshot }) {
    if (!this.enabled || !this.droneOsc) return;
    const t    = this.ctx.currentTime;
    const freq = 40 + ((snapshot.year + 13000) / 15000) * 80;
    this.droneOsc.frequency.linearRampToValueAtTime(freq, t + 3);
    this._playChime();
  }

  _playChime() {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }

  _playCollapse() {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = 80;
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.2);
  }

  _fadeOut() {
    if (!this.droneGain || !this.ctx) return;
    this.droneGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 4);
  }
}

window.AudioDirector = AudioDirector;
