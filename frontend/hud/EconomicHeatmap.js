class EconomicHeatmap {
  constructor() {
    this.gridEl      = document.getElementById('economicHeatmap');
    this.narrationEl = document.getElementById('heatmapNarration');
    this.prevRegions = null;
  }

  init() {
    window.Bus.on('MILLENNIUM_DATA', (data) => this._update(data));
  }

  _update({ regions, prevRegions, snapshot }) {
    if (!this.gridEl || !regions) return;

    const cells = regions.slice(0, 12).map(r => {
      const prev   = prevRegions ? prevRegions.find(p => p.id === r.id) : null;
      const growth = prev && prev.pop > 0 ? (r.pop - prev.pop) / prev.pop : 0;
      const color  = this._growthColor(growth);
      const sign   = growth > 0 ? '+' : '';
      return `<div class="heatmap-cell"
        style="background:${color}"
        title="${r.name}: ${sign}${(growth * 100).toFixed(0)}%">
      </div>`;
    });

    this.gridEl.innerHTML = cells.join('');

    if (this.narrationEl && snapshot) {
      this.narrationEl.textContent = snapshot.key_event || '';
    }
  }

  _growthColor(growth) {
    if (growth >  0.3) return '#1e40af';
    if (growth >  0.1) return '#3b82f6';
    if (growth >  0)   return '#93c5fd';
    if (growth > -0.1) return '#fca5a5';
    return '#dc2626';
  }
}

window.EconomicHeatmap = EconomicHeatmap;
