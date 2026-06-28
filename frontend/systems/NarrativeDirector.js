class NarrativeDirector {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.narrationEl = document.getElementById('narrationText');
    this.typewriterTimer = null;
  }

  init() {
    window.Bus.on('MILLENNIUM_DATA', (data) => this._onMillenniumData(data));
    window.Bus.on('FORK_APPLIED',    (data) => this._onForkApplied(data));
    window.Bus.on('SIMULATION_ENDED', ()    => this._onSimulationEnd());
  }

  _onMillenniumData({ snapshot, regions, prevRegions }) {
    this._enqueue({
      priority: 1,
      type: 'NARRATE',
      payload: { snapshot, regions, prevRegions },
    });
  }

  _onForkApplied({ prompt, snapshot }) {
    this._enqueue({
      priority: 0,
      type: 'FORK_NARRATE',
      payload: { prompt, snapshot },
    });
  }

  _onSimulationEnd() {
    this._typewrite(
      "In 15,000 years, a species that once numbered in the thousands " +
      "now numbers in the billions. What happens next is not in the data.",
      45
    );
  }

  _enqueue(item) {
    this.queue.push(item);
    this.queue.sort((a, b) => a.priority - b.priority);
    if (!this.isProcessing) this._processNext();
  }

  async _processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }
    this.isProcessing = true;
    const item = this.queue.shift();
    await this._process(item);
    this._processNext();
  }

  async _process(item) {
    if (item.type === 'NARRATE') {
      const { snapshot, regions, prevRegions } = item.payload;
      const year = snapshot.year;
      const prevYear = year - 1000;
      try {
        const resp = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year,
            prev_year: prevYear,
            regions,
            prev_regions: prevRegions || [],
          }),
        });
        const data = await resp.json();
        this._typewrite(data.narration, 35);
      } catch {
        this._typewrite(snapshot.key_event || '—', 25);
      }
    }

    if (item.type === 'FORK_NARRATE') {
      const { prompt } = item.payload;
      this._typewrite(`Counterfactual applied: "${prompt}"`, 30);
    }
  }

  _typewrite(text, delay = 35) {
    if (this.typewriterTimer) clearInterval(this.typewriterTimer);
    if (!this.narrationEl) return;
    this.narrationEl.textContent = '';
    let i = 0;
    this.typewriterTimer = setInterval(() => {
      this.narrationEl.textContent += text[i] || '';
      i++;
      if (i >= text.length) clearInterval(this.typewriterTimer);
    }, delay);
  }
}

window.NarrativeDirector = NarrativeDirector;
