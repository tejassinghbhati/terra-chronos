class GameClock {
  constructor() {
    this.lastTimestamp = 0;
    this.accumulatedMs = 0;
    this.millenniumDurationMs = CONFIG.MILLENNIUM_DURATION_MS;
    this.isRunning = false;
    this.speed = 1;
    this.currentIndex = 0;
    this.rafHandle = null;
  }

  init() {
    window.Bus.on('PLAY_REQUESTED',      ()     => this.play());
    window.Bus.on('PAUSE_REQUESTED',     ()     => this.pause());
    window.Bus.on('SPEED_CHANGED',       (data) => this.setSpeed(data.speed));
    window.Bus.on('JUMP_TO_INDEX',       (data) => this.jumpTo(data.index));
    window.Bus.on('CONTINUE_AFTER_PAUSE',()     => this.play());
  }

  play() {
    this.isRunning = true;
    // Reset so the first tick doesn't produce a giant stale delta
    this.lastTimestamp = 0;
    this.rafHandle = requestAnimationFrame(this._tick.bind(this));
    window.State.dispatch('SET_PHASE', { phase: 'PLAYING' });
    window.Bus.emit('PLAYBACK_STARTED');
  }

  pause() {
    this.isRunning = false;
    cancelAnimationFrame(this.rafHandle);
    window.State.dispatch('SET_PHASE', { phase: 'PAUSED' });
    window.Bus.emit('PLAYBACK_PAUSED');
  }

  setSpeed(speed) {
    this.speed = speed;
    this.millenniumDurationMs = CONFIG.MILLENNIUM_DURATION_MS / speed;
  }

  jumpTo(index) {
    this.currentIndex = index;
    this.accumulatedMs = 0;
    window.Bus.emit('MILLENNIUM_CHANGED', {
      index,
      snapshot: HISTORY_DATA[index],
      immediate: true,
    });
    window.State.dispatch('SET_MILLENNIUM', {
      index,
      year: HISTORY_DATA[index].year,
    });
  }

  _tick(timestamp) {
    if (!this.isRunning) return;

    // Seed lastTimestamp on the very first tick so delta starts at 0
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      this.rafHandle = requestAnimationFrame(this._tick.bind(this));
      return;
    }

    let delta = timestamp - this.lastTimestamp;
    if (delta > 100) delta = 100; // guard against huge jumps after tab switch
    this.lastTimestamp = timestamp;

    this.accumulatedMs += delta;

    window.Bus.emit('FRAME_TICK', {
      deltaMs: delta,
      progress: this.accumulatedMs / this.millenniumDurationMs,
    });

    if (this.accumulatedMs >= this.millenniumDurationMs) {
      this._advanceMillennium();
    }

    // Only reschedule if still running (_advanceMillennium may have paused)
    if (this.isRunning) {
      this.rafHandle = requestAnimationFrame(this._tick.bind(this));
    }
  }

  _advanceMillennium() {
    this.accumulatedMs = 0;
    this.currentIndex++;

    if (this.currentIndex >= HISTORY_DATA.length) {
      this._handleSimulationEnd();
      return;
    }

    const snapshot = HISTORY_DATA[this.currentIndex];

    window.Bus.emit('MILLENNIUM_CHANGED', {
      index: this.currentIndex,
      snapshot,
      immediate: false,
    });
    window.State.dispatch('SET_MILLENNIUM', {
      index: this.currentIndex,
      year: snapshot.year,
    });

    this.pause();
    window.State.dispatch('SET_PHASE', { phase: 'WAITING_FOR_INPUT' });
    window.Bus.emit('MILLENNIUM_PAUSED', { snapshot });
  }

  _handleSimulationEnd() {
    this.pause();
    window.State.dispatch('SET_PHASE', { phase: 'PAUSED' });
    window.Bus.emit('SIMULATION_ENDED');
  }

  getEstimatedTimeToNext() {
    const remainingMs = (this.millenniumDurationMs - this.accumulatedMs) / this.speed;
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `Est. ${minutes}m ${seconds}s`;
  }
}

window.GameClock = GameClock;
