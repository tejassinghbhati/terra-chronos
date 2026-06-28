class CivRankings {
  constructor() {
    this.listEl    = document.getElementById('civRankings');
    this.prevRanks = {};
  }

  init() {
    window.Bus.on('MILLENNIUM_DATA', (data) => this._update(data.regions));
  }

  _update(regions) {
    if (!regions || !this.listEl) return;

    const sorted = [...regions]
      .sort((a, b) => b.pop - a.pop)
      .slice(0, 6);

    this.listEl.innerHTML = sorted.map((r, i) => `
      <li class="civ-item">
        <span class="rank-num">${i + 1}.</span>
        <span class="civ-dot" style="background:${CIV_COLORS[r.civ_type] || '#888'}"></span>
        <span class="civ-name">${r.name}</span>
        <span class="civ-pop">${r.pop.toFixed(1)}M</span>
      </li>
    `).join('');
  }
}

window.CivRankings = CivRankings;
