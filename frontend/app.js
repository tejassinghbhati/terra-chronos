/* ─── Terra Chronos — Application Entry Point ─────────────────────── */
(function () {

  /* ── System instances ────────────────────────────────────────────── */
  const assetLoader       = new AssetLoader();
  const dataManager       = new DataManager();
  const renderer          = new Renderer();
  const gameClock         = new GameClock();
  const narrativeDirector = new NarrativeDirector();
  const resilienceManager = new ResilienceManager();
  const sceneManager      = new SceneManager();
  const audioDirector     = new AudioDirector();
  const hud               = new HUD();

  /* ── Init sequence ───────────────────────────────────────────────── */
  async function bootstrap() {
    // 1 — Core event infrastructure
    gameClock.init();
    dataManager.init();
    resilienceManager.init();
    sceneManager.init();
    audioDirector.init();

    // 2 — Load visual assets (globe textures) and fade loading overlay
    await assetLoader.loadAll();

    // 3 — Init globe (globe.gl attaches to the DOM element)
    const container = document.getElementById('globe-container');
    renderer.init(container);

    // 4 — Resize globe to fill container after it attaches
    setTimeout(() => {
      renderer.globe.width(container.clientWidth);
      renderer.globe.height(container.clientHeight);
    }, 100);

    // 5 — Init HUD (needs DOM elements, which now exist)
    hud.init();

    // 6 — Narrative director
    narrativeDirector.init();

    // 7 — Check LLM health
    checkLLMHealth();

    // 8 — Wire all controls
    wirePlayback();
    wireSpeedButtons();
    wireModeToggle();
    wirePromptInput();
    wireEventsLog();
    wireJumpToIndex();
    wireContinueAfterPause();

    // 9 — Build civ legend
    buildCivLegend();

    // 10 — Seed first millennium then start the clock
    gameClock.jumpTo(0);
    gameClock.play();
  }

  /* ── LLM health check ────────────────────────────────────────────── */
  async function checkLLMHealth() {
    const dot  = document.getElementById('llm-dot');
    const text = document.getElementById('llm-text');
    try {
      const resp = await fetch('/api/health');
      const data = await resp.json();
      const online = data && data.llm_online;
      window.State.dispatch('SET_LLM_ONLINE', { value: online });
      if (dot)  dot.className    = online ? 'online' : 'offline';
      if (text) text.textContent = online ? 'LLM online' : 'LLM offline';
    } catch {
      if (dot)  dot.className    = 'offline';
      if (text) text.textContent = 'LLM offline';
    }
  }

  /* ── Playback controls ───────────────────────────────────────────── */
  function wirePlayback() {
    const speedControls = document.getElementById('speed-controls');
    if (speedControls) {
      const btn = document.createElement('button');
      btn.id = 'playBtn';
      btn.textContent = '▶ Play';
      speedControls.before(btn);
      btn.addEventListener('click', () => {
        const phase = window.State.get('phase');
        if (phase === 'PLAYING') {
          gameClock.pause();
          btn.textContent = '▶ Play';
          window.Bus.emit('PLAYBACK_PAUSED');
        } else if (phase === 'PAUSED' || phase === 'WAITING_FOR_INPUT') {
          gameClock.play();
          btn.textContent = '⏸ Pause';
          window.Bus.emit('PLAYBACK_STARTED');
        }
      });
    }

    window.Bus.on('STATE_CHANGED', ({ next }) => {
      const btn = document.getElementById('playBtn');
      if (!btn) return;
      if (next.phase === 'PLAYING') {
        btn.textContent = '⏸ Pause';
        window.Bus.emit('PLAYBACK_STARTED');
      } else {
        btn.textContent = '▶ Play';
        window.Bus.emit('PLAYBACK_PAUSED');
      }
    });
  }

  /* ── Speed buttons ───────────────────────────────────────────────── */
  function wireSpeedButtons() {
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        gameClock.setSpeed(speed);
        window.State.dispatch('SET_SPEED', { speed });
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.Bus.emit('SPEED_CHANGED', { speed });
      });
    });
  }

  /* ── Mode toggle ─────────────────────────────────────────────────── */
  function wireModeToggle() {
    const histBtn = document.getElementById('modeHistorical');
    const cfBtn   = document.getElementById('modeCounterfactual');
    if (!histBtn || !cfBtn) return;

    histBtn.addEventListener('click', () => {
      window.State.dispatch('SET_MODE', { mode: 'HISTORICAL' });
      histBtn.classList.add('active');
      cfBtn.classList.remove('active');
    });

    cfBtn.addEventListener('click', () => {
      window.State.dispatch('SET_MODE', { mode: 'COUNTERFACTUAL' });
      cfBtn.classList.add('active');
      histBtn.classList.remove('active');
    });
  }

  /* ── Prompt / counterfactual input ──────────────────────────────── */
  function wirePromptInput() {
    const submitBtn = document.getElementById('promptSubmit');
    const input     = document.getElementById('promptInput');
    if (!submitBtn || !input) return;

    submitBtn.addEventListener('click', async () => {
      const prompt = input.value.trim();
      if (!prompt) return;
      submitBtn.disabled    = true;
      submitBtn.textContent = 'Applying…';

      const idx      = window.State.get('millenniumIndex');
      const snapshot = HISTORY_DATA[idx];

      try {
        const resp = await fetch('/api/fork', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            current_year: snapshot.year,
            regions:      dataManager.getActiveRegions(idx),
          }),
        });
        const data = await resp.json();
        window.Bus.emit('FORK_APPLIED', {
          index:    idx,
          regions:  data.regions,
          prompt,
          snapshot,
        });
        _appendEvent(snapshot.year, `[FORK] ${prompt}`);
      } catch (err) {
        console.error('Fork failed:', err);
      } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Apply to Simulation';
        input.value           = '';
        gameClock.play();
      }
    });
  }

  /* ── Events log ──────────────────────────────────────────────────── */
  function wireEventsLog() {
    const closeBtn  = document.getElementById('eventsClose');
    const eventsLog = document.getElementById('events-log');
    if (closeBtn) closeBtn.addEventListener('click', () => eventsLog.classList.remove('open'));

    document.addEventListener('keydown', (e) => {
      if ((e.key === 'e' || e.key === 'E') &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        eventsLog.classList.toggle('open');
      }
    });

    window.Bus.on('MILLENNIUM_CHANGED', ({ snapshot }) => {
      if (snapshot && snapshot.key_event) {
        _appendEvent(snapshot.year, snapshot.key_event);
      }
    });
  }

  function _appendEvent(year, text) {
    const list = document.getElementById('eventsList');
    if (!list) return;
    const yearLabel = year < 0
      ? `${Math.abs(year).toLocaleString()} BCE`
      : year === 0 ? '1 CE' : `${year} CE`;
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML =
      `<div class="event-year">${yearLabel}</div><div class="event-text">${text}</div>`;
    list.prepend(item);
  }

  /* ── Timeline scrubber jump ──────────────────────────────────────── */
  function wireJumpToIndex() {
    window.Bus.on('JUMP_TO_INDEX', ({ index }) => {
      gameClock.jumpTo(index);
    });
  }

  /* ── Continue button after millennium pause ───────────────────────── */
  function wireContinueAfterPause() {
    window.Bus.on('MILLENNIUM_PAUSED', () => {
      const submitBtn = document.getElementById('promptSubmit');
      if (!submitBtn) return;
      const mode = window.State.get('mode');

      if (mode !== 'COUNTERFACTUAL') {
        submitBtn.disabled    = false;
        submitBtn.textContent = '▶ Continue';

        const handler = () => {
          submitBtn.removeEventListener('click', handler);
          submitBtn.disabled    = true;
          submitBtn.textContent = 'Apply to Simulation';
          gameClock.play();
          window.Bus.emit('CONTINUE_AFTER_PAUSE');
        };
        submitBtn.addEventListener('click', handler);
      }
    });
  }

  /* ── Civilization legend ─────────────────────────────────────────── */
  function buildCivLegend() {
    const legend = document.createElement('div');
    legend.id = 'civ-legend';
    Object.entries(CIV_LABELS).forEach(([key, label]) => {
      const row = document.createElement('div');
      row.className = 'legend-row';
      row.innerHTML =
        `<div class="legend-dot" style="background:${CIV_COLORS[key]}"></div><span>${label}</span>`;
      legend.appendChild(row);
    });
    document.body.appendChild(legend);
  }

  /* ── Window resize ───────────────────────────────────────────────── */
  window.addEventListener('resize', () => {
    const container = document.getElementById('globe-container');
    if (container && renderer.globe) {
      renderer.globe.width(container.clientWidth);
      renderer.globe.height(container.clientHeight);
    }
  });

  /* ── Collapse alert ──────────────────────────────────────────────── */
  window.Bus.on('COLLAPSE_EVENT', ({ region }) => {
    const alertEl = document.getElementById('collapse-alert');
    if (!alertEl) return;
    alertEl.textContent = `⚠ COLLAPSE: ${region || 'Unknown region'}`;
    alertEl.classList.add('visible');
    setTimeout(() => alertEl.classList.remove('visible'), 4000);
  });

  /* ── Simulation end ──────────────────────────────────────────────── */
  window.Bus.on('SIMULATION_ENDED', () => {
    const btn = document.getElementById('playBtn');
    if (btn) { btn.disabled = true; btn.textContent = '■ Ended'; }
  });

  /* ── Go ──────────────────────────────────────────────────────────── */
  bootstrap().catch(console.error);

})();
