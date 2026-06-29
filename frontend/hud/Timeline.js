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
    // Globe status bar
    this.gsbEra      = document.getElementById('gsb-era');
    this.gsbIdx      = document.getElementById('gsb-idx');
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
    if (this.gsbIdx) this.gsbIdx.textContent = `${String(index + 1).padStart(2,'0')} / 19`;
  }

  _updatePill(year) {
    const bp    = year < 0
      ? `−${Math.abs(year).toLocaleString()} BP`
      : year === 0 ? '1 CE' : `${year} CE`;
    const label = year < 0
      ? `${Math.abs(year).toLocaleString()} BCE`
      : year === 0 ? '1 CE' : `${year} CE`;
    if (this.markerPill)  this.markerPill.textContent  = bp;
    if (this.yearDisplay) this.yearDisplay.textContent  = bp;
    if (this.analyticsY)  this.analyticsY.textContent  = bp;
  }

  _updateEra(year) {
    const era = ERA_NAMES.find(e => year >= e.year_start && year < e.year_end);
    if (era) {
      if (this.eraNameEl) this.eraNameEl.textContent = era.name;
      if (this.gsbEra)    this.gsbEra.textContent    = era.name.toUpperCase();
    }
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
