class PopulationDisplay {
  constructor() {
    this.popCountEl = document.getElementById('popCount');
    this.popCompEl  = document.getElementById('popComparison');
    this.canvas     = document.getElementById('popSparkline');
    this.ctx        = this.canvas ? this.canvas.getContext('2d') : null;
    this.history    = [];
    this.currentPop = 0;
    this.animFrame  = null;
  }

  init() {
    window.Bus.on('MILLENNIUM_DATA', (data) => this._update(data));
  }

  _update({ worldPop }) {
    const prev = this.currentPop;
    this._animateCount(prev, worldPop);

    this.history.push(worldPop);
    if (this.history.length > 10) this.history.shift();
    this._drawSparkline();

    const delta = worldPop - prev;
    const sign  = delta >= 0 ? '+' : '';
    const cls   = delta >= 0 ? 'up' : 'down';
    if (this.popCompEl) {
      this.popCompEl.textContent = `${sign}${delta.toFixed(1)}M this millennium`;
      this.popCompEl.className   = cls;
    }
  }

  _animateCount(from, to) {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    const duration = 2000;
    const start    = performance.now();
    const step = (now) => {
      const t     = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const val   = from + (to - from) * eased;
      if (this.popCountEl) this.popCountEl.textContent = this._format(val);
      this.currentPop = val;
      if (t < 1) this.animFrame = requestAnimationFrame(step);
      else this.currentPop = to;
    };
    this.animFrame = requestAnimationFrame(step);
  }

  _format(n) {
    if (n >= 1000) return (n / 1000).toFixed(2) + 'B';
    return Math.round(n).toLocaleString() + 'M';
  }

  _drawSparkline() {
    if (!this.ctx || this.history.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const w   = this.canvas.clientWidth  || 200;
    const h   = 40;
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);

    const max = Math.max(...this.history);
    const min = Math.min(...this.history);
    const X   = i => (i / (this.history.length - 1)) * w;
    const Y   = v => h - 4 - ((v - min) / (max - min || 1)) * (h - 8);

    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth   = 1.5;
    this.ctx.lineJoin    = 'round';
    this.ctx.beginPath();
    this.history.forEach((v, i) => {
      i === 0 ? this.ctx.moveTo(X(i), Y(v)) : this.ctx.lineTo(X(i), Y(v));
    });
    this.ctx.stroke();
  }
}

window.PopulationDisplay = PopulationDisplay;
