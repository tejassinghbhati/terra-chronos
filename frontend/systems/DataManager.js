class DataManager {
  constructor() {
    this.baseline = HISTORY_DATA;
    this.forkLayer = {};
    this.exportLog = [];
  }

  init() {
    window.Bus.on('MILLENNIUM_CHANGED', (data) => this._onMillenniumChanged(data));
    window.Bus.on('FORK_APPLIED',       (data) => this._onForkApplied(data));
    window.Bus.on('UNDO_FORK',          ()     => this._onUndoFork());
    window.Bus.on('EXPORT_REQUESTED',   ()     => this._onExport());
    window.Bus.on('RESET_TO_HISTORY',   ()     => this.resetForks());
  }

  getSnapshot(index) {
    if (index < 0 || index >= this.baseline.length) {
      throw new RangeError(`DataManager: index ${index} out of range`);
    }
    return this.forkLayer[index] ?? this.baseline[index];
  }

  getActiveRegions(index) {
    return this.getSnapshot(index).regions;
  }

  getPreviousRegions(index) {
    if (index === 0) return [];
    return this.getActiveRegions(index - 1);
  }

  getWorldPop(index) {
    const total = this.getActiveRegions(index).reduce((s, r) => s + r.pop, 0);
    return Math.round(total * 10) / 10;
  }

  hasFork(index) {
    return Boolean(this.forkLayer[index]);
  }

  resetForks() {
    this.forkLayer = {};
    window.Bus.emit('FORKS_RESET');
  }

  _onMillenniumChanged({ index, snapshot }) {
    this.exportLog.push({
      index,
      year: snapshot.year,
      regions: this.getActiveRegions(index),
    });

    window.Bus.emit('MILLENNIUM_DATA', {
      regions:     this.getActiveRegions(index),
      prevRegions: this.getPreviousRegions(index),
      snapshot:    this.getSnapshot(index),
      worldPop:    this.getWorldPop(index),
      hasFork:     this.hasFork(index),
    });
  }

  _onForkApplied({ index, regions, prompt }) {
    if (!Array.isArray(regions)) return;

    const validated = regions
      .filter(r => r && r.id)
      .map(r => {
        // Restore coordinates if missing
        if (r.lat === undefined || r.lng === undefined) {
          const coords = this._findBaselineCoords(r.id, index);
          r = { ...r, lat: r.lat ?? coords.lat, lng: r.lng ?? coords.lng };
        }
        // Sanity-cap wildly large populations
        if (r.pop > 2000) r = { ...r, pop: 2000 };
        // Fallback unknown civ types
        if (!CIV_COLORS[r.civ_type]) r = { ...r, civ_type: 'developing' };
        return r;
      });

    this.forkLayer[index] = {
      ...this.baseline[Math.min(index, this.baseline.length - 1)],
      regions: validated,
      key_event: prompt,
      is_fork: true,
    };

    window.Bus.emit('FORK_STORED', { index });
    window.Bus.emit('MILLENNIUM_DATA', {
      regions:     this.getActiveRegions(index),
      prevRegions: this.getPreviousRegions(index),
      snapshot:    this.getSnapshot(index),
      worldPop:    this.getWorldPop(index),
      hasFork:     true,
    });
  }

  _onUndoFork() {
    const indices = Object.keys(this.forkLayer).map(Number);
    if (indices.length === 0) return;
    const highest = Math.max(...indices);
    delete this.forkLayer[highest];

    window.Bus.emit('FORK_UNDONE', { index: highest });
    window.Bus.emit('MILLENNIUM_DATA', {
      regions:     this.getActiveRegions(highest),
      prevRegions: this.getPreviousRegions(highest),
      snapshot:    this.getSnapshot(highest),
      worldPop:    this.getWorldPop(highest),
      hasFork:     false,
    });
  }

  _onExport() {
    const header = 'year,year_label,region_id,region_name,lat,lng,population_millions,civ_type,is_fork';
    const rows = [];

    for (const entry of this.exportLog) {
      const yearLabel = entry.year < 0
        ? `${Math.abs(entry.year)} BCE`
        : entry.year === 0 ? '1 CE' : `${entry.year} CE`;
      const isFork = this.hasFork(entry.index);

      for (const r of entry.regions) {
        rows.push([
          entry.year,
          yearLabel,
          r.id,
          `"${(r.name || '').replace(/"/g, '""')}"`,
          r.lat ?? '',
          r.lng ?? '',
          r.pop ?? '',
          r.civ_type ?? '',
          isFork ? 'true' : 'false',
        ].join(','));
      }
    }

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terrachronos_export_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _findBaselineCoords(regionId, nearestIndex) {
    for (let delta = 0; delta < this.baseline.length; delta++) {
      for (const sign of [0, 1]) {
        const idx = nearestIndex + (sign === 0 ? -delta : delta);
        if (idx >= 0 && idx < this.baseline.length) {
          const found = this.baseline[idx].regions.find(r => r.id === regionId);
          if (found && found.lat !== undefined) {
            return { lat: found.lat, lng: found.lng };
          }
        }
      }
    }
    return { lat: 0, lng: 0 };
  }
}

window.DataManager = DataManager;
