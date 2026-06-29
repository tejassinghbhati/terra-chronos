class Renderer {
  constructor() {
    this.globe = null;
    this.dotPool = [];
    this.activeDots = [];
    this.currentRegions = [];
    this.targetRegions = [];
    this.transitionProgress = 0;
    this.isTransitioning = false;
    this._transitionStartTime = 0;
  }

  init(containerEl) {
    this.globe = Globe()(containerEl)
      .globeImageUrl(CONFIG.GLOBE_TEXTURE)
      .bumpImageUrl(CONFIG.GLOBE_BUMP)
      .backgroundImageUrl(CONFIG.STAR_TEXTURE)
      .backgroundColor('#000008')
      .showAtmosphere(true)
      .atmosphereColor(CONFIG.ATMOSPHERE_COLOR)
      .atmosphereAltitude(CONFIG.ATMOSPHERE_ALT)
      .showGraticules(false)
      .pointsData([])
      .pointLat('lat')
      .pointLng('lng')
      .pointColor('color')
      .pointAltitude(0.01)
      .pointRadius('r')
      .pointResolution(6)
      .pointsMerge(false);

    this.globe.controls().autoRotate = true;
    this.globe.controls().autoRotateSpeed = CONFIG.AUTO_ROTATE_SPEED;
    this.globe.pointOfView({ lat: 20, lng: 10, altitude: 2.4 });

    const resize = () => {
      this.globe.width(containerEl.clientWidth).height(containerEl.clientHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    this._initDotPool();
    this._initAtmospherePulse();

    window.Bus.on('FRAME_TICK',      (data) => this.updateTransition(data.deltaMs));
    window.Bus.on('MILLENNIUM_DATA', (data) => this.transitionToRegions(data.regions));
    window.Bus.on('COLLAPSE_EVENT',  (data) => this._triggerCollapseEffect(data.regionId));
    window.Bus.on('FOCUS_REGION',    (data) => this._focusCamera(data.lat, data.lng));
  }

  _initDotPool() {
    for (let i = 0; i < CONFIG.MAX_DOTS; i++) {
      this.dotPool.push({
        lat: 0, lng: 0, color: '#000', r: 0,
        active: false, region_id: null,
        targetLat: 0, targetLng: 0, targetR: 0, targetColor: '#000',
        startLat: 0, startLng: 0, startR: 0, startColor: '#000',
        opacity: 0, _origColor: '#000',
      });
    }
  }

  _initAtmospherePulse() {
    setInterval(() => {
      if (!this.globe) return;
      const newVal = Math.sin(Date.now() / 8000) * 0.02 + 0.15;
      this.globe.atmosphereAltitude(newVal);
    }, 50);
  }

  _gaussianRandom() {
    return ((Math.random() - 0.5) + (Math.random() - 0.5) + (Math.random() - 0.5)) / 3 * 2;
  }

  generateDots(regions) {
    const worldTotalPop = regions.reduce((sum, r) => sum + r.pop, 0) || 1;
    const maxRegionPop = Math.max(...regions.map(r => r.pop), 1);
    const dots = [];

    for (const region of regions) {
      const dotCount = Math.max(1, Math.round(
        region.pop * (CONFIG.MAX_DOTS / worldTotalPop) * 0.9
      ));
      const spread = CONFIG.SPREAD_BASE + Math.log1p(region.pop) * 1.2;
      const r = CONFIG.DOT_BASE_RADIUS +
        (region.pop / maxRegionPop) * (CONFIG.DOT_MAX_RADIUS - CONFIG.DOT_BASE_RADIUS);
      const color = CIV_COLORS[region.civ_type] || '#94a3b8';

      for (let i = 0; i < dotCount && dots.length < CONFIG.MAX_DOTS; i++) {
        dots.push({
          lat: region.lat + this._gaussianRandom() * spread,
          lng: region.lng + this._gaussianRandom() * spread,
          color, r, region_id: region.id,
          active: true, opacity: 1, _origColor: color,
          targetLat: 0, targetLng: 0, targetR: 0, targetColor: '#000',
          startLat: 0, startLng: 0, startR: 0, startColor: '#000',
        });
      }
    }

    return dots;
  }

  transitionToRegions(newRegions) {
    this.targetRegions = newRegions;
    const newDots = this.generateDots(newRegions);

    const prevActive = [...this.activeDots];
    const nextCount = newDots.length;
    const prevCount = prevActive.length;
    const totalSlots = Math.min(Math.max(prevCount, nextCount), CONFIG.MAX_DOTS);

    this.activeDots = [];

    for (let i = 0; i < totalSlots; i++) {
      const dot = this.dotPool[i];
      const hasPrev = i < prevCount;
      const hasNext = i < nextCount;

      if (hasPrev) {
        dot.startLat = prevActive[i].lat;
        dot.startLng = prevActive[i].lng;
        dot.startR   = prevActive[i].r;
        dot.startColor = prevActive[i].color;
      } else {
        // New dot: materialise at its target position, scale up from 0
        dot.startLat = newDots[i].lat;
        dot.startLng = newDots[i].lng;
        dot.startR   = 0;
        dot.startColor = newDots[i].color;
      }

      if (hasNext) {
        dot.targetLat   = newDots[i].lat;
        dot.targetLng   = newDots[i].lng;
        dot.targetR     = newDots[i].r;
        dot.targetColor = newDots[i].color;
        dot.region_id   = newDots[i].region_id;
        dot._origColor  = newDots[i].color;
      } else {
        // Surplus dot: stay in place and shrink away
        dot.targetLat   = dot.startLat;
        dot.targetLng   = dot.startLng;
        dot.targetR     = 0;
        dot.targetColor = dot.startColor;
        dot.region_id   = null;
      }

      dot.lat   = dot.startLat;
      dot.lng   = dot.startLng;
      dot.r     = dot.startR;
      dot.color = dot.startColor;
      dot.active = true;

      this.activeDots.push(dot);
    }

    this.isTransitioning = true;
    this.transitionProgress = 0;
    this._transitionStartTime = performance.now();

    // Push immediately so dots appear on the first frame
    if (this.globe) this.globe.pointsData(this.activeDots);
  }

  updateTransition(deltaMs) {
    if (!this.isTransitioning || !this.globe) return;

    this.transitionProgress = Math.min(
      this.transitionProgress + deltaMs,
      CONFIG.TRANSITION_DURATION_MS
    );

    const t = this.transitionProgress / CONFIG.TRANSITION_DURATION_MS;
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    for (const dot of this.activeDots) {
      dot.lat = dot.startLat + (dot.targetLat - dot.startLat) * eased;
      dot.lng = dot.startLng + (dot.targetLng - dot.startLng) * eased;
      dot.r   = dot.startR   + (dot.targetR   - dot.startR)   * eased;
      // Snap colour at the midpoint — avoids per-frame hex interpolation
      if (t >= 0.5) dot.color = dot.targetColor;
    }

    this.globe.pointsData(this.activeDots);

    if (this.transitionProgress >= CONFIG.TRANSITION_DURATION_MS) {
      this.isTransitioning = false;
      this.currentRegions = this.targetRegions;
      // Drop fully-shrunk surplus dots from the active set
      this.activeDots = this.activeDots.filter(d => d.r > 0.001);
    }
  }

  _triggerCollapseEffect(regionId) {
    const affected = this.activeDots.filter(d => d.region_id === regionId);
    const saved = affected.map(d => ({ dot: d, color: d._origColor }));

    affected.forEach(d => { d.color = CIV_COLORS.collapse; });
    if (this.globe) this.globe.pointsData(this.activeDots);

    window.Bus.emit('SCREEN_SHAKE', { intensity: 0.3 });

    setTimeout(() => {
      saved.forEach(({ dot, color }) => {
        dot.color = color;
        dot._origColor = color;
      });
      if (this.globe) this.globe.pointsData(this.activeDots);
    }, 800);
  }

  _focusCamera(lat, lng) {
    if (!this.globe) return;
    this.globe.pointOfView({ lat, lng, altitude: CONFIG.CAMERA_FOCUS_ALT }, 1200);
    setTimeout(() => {
      if (this.globe) this.globe.pointOfView({ altitude: CONFIG.CAMERA_OVERVIEW_ALT }, 1500);
    }, 4000);
  }

  update(deltaMs) {
    this.updateTransition(deltaMs);
  }
}

window.Renderer = Renderer;
