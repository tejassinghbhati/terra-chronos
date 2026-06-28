class Timeline {
  constructor() {
    this.scrubber    = document.getElementById('timelineScrubber');
    this.markerPill  = document.getElementById('markerPill');
    this.eraNameEl   = document.getElementById('eraName');
    this.tlTop       = document.getElementById('tlTop');
    this.tlBottom    = document.getElementById('tlBottom');
    this.yearDisplay = document.getElementById('yearDisplay');
    this.analyticsY  = document.getElementById('analyticsYear');
    this.marker      = document.getElementById('timelineMarker');
  }

  init() {
    if (this.tlTop)    this.tlTop.textContent    = '2024 CE';
    if (this.tlBottom) this.tlBottom.textContent = '13,000 BCE';
    if (this.scrubber) {
      this.scrubber.max = HISTORY_DATA.length - 1;
      this.scrubber.addEventListener('input', (e) => {
        window.Bus.emit('JUMP_TO_INDEX', { index: parseInt(e.target.value) });
      });
    }
    window.Bus.on('MILLENNIUM_CHANGED', (data) => this._update(data));
    window.Bus.on('FRAME_TICK',         ()     => this._updateMarkerPosition());
  }

  _update({ index, snapshot }) {
    if (this.scrubber) this.scrubber.value = index;
    this._updatePill(snapshot.year);
    this._updateEra(snapshot.year);
    this._updateMarkerPosition();
  }

  _updatePill(year) {
    const label = year < 0
      ? `${Math.abs(year).toLocaleString()} BCE`
      : year === 0 ? '1 CE' : `${year} CE`;
    if (this.markerPill)  this.markerPill.textContent  = label;
    if (this.yearDisplay) this.yearDisplay.textContent  = label;
    if (this.analyticsY)  this.analyticsY.textContent  = `(${label})`;
  }

  _updateEra(year) {
    const era = ERA_NAMES.find(e => year >= e.year_start && year < e.year_end);
    if (era && this.eraNameEl) this.eraNameEl.textContent = era.name;
  }

  _updateMarkerPosition() {
    if (!this.scrubber || !this.marker) return;
    const pct    = parseInt(this.scrubber.value) / parseInt(this.scrubber.max || 1);
    const trackH = this.scrubber.offsetHeight || 200;
    // pct=0 → oldest (bottom), pct=1 → newest (top)
    const markerY = trackH - pct * trackH;
    this.marker.style.top = markerY + 'px';
  }
}

window.Timeline = Timeline;
