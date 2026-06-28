class AssetLoader {
  constructor() {
    this.progress = 0;
  }

  async loadAll() {
    const overlay  = document.getElementById('app-loading');
    const subtitle = overlay ? overlay.querySelector('.loading-subtitle') : null;
    const fill     = overlay ? overlay.querySelector('.loading-fill') : null;

    const steps = [
      { label: 'Loading globe texture…',   fn: () => this._loadImage(CONFIG.GLOBE_TEXTURE) },
      { label: 'Loading bump map…',         fn: () => this._loadImage(CONFIG.GLOBE_BUMP) },
      { label: 'Loading star field…',       fn: () => this._loadImage(CONFIG.STAR_TEXTURE) },
      { label: 'Initialising simulation…',  fn: () => new Promise(r => setTimeout(r, 300)) },
    ];

    for (let i = 0; i < steps.length; i++) {
      if (subtitle) subtitle.textContent = steps[i].label;
      await steps[i].fn();
      this.progress = ((i + 1) / steps.length) * 100;
      if (fill) fill.style.width = this.progress + '%';
    }

    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.8s ease';
      setTimeout(() => { overlay.style.display = 'none'; }, 800);
    }
  }

  _loadImage(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = resolve;
      img.onerror = resolve; // resolve even on failure to unblock startup
      img.src = url;
    });
  }
}

window.AssetLoader = AssetLoader;
