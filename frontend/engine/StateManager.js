const PHASES = {
  INIT:              'INIT',
  LOADING:           'LOADING',
  PLAYING:           'PLAYING',
  TRAVELING:         'TRAVELING',
  PAUSED:            'PAUSED',
  WAITING_FOR_INPUT: 'WAITING_FOR_INPUT',
  FORKING:           'FORKING',
};

const MODES = {
  HISTORICAL:       'HISTORICAL',
  COUNTERFACTUAL:   'COUNTERFACTUAL',
};

class StateManager {
  constructor() {
    this._state = {
      phase:          PHASES.INIT,
      mode:           MODES.HISTORICAL,
      currentYear:    -13000,
      targetYear:     -13000,
      speed:          1,
      millenniumIndex: 0,
      forkHistory:    [],
      annotations:    [],
      isLLMOnline:    false,
    };
  }

  get(key) { return this._state[key]; }

  dispatch(action, payload = {}) {
    const prev = { ...this._state };
    switch (action) {
      case 'SET_PHASE':
        this._state.phase = payload.phase; break;
      case 'SET_MODE':
        this._state.mode = payload.mode; break;
      case 'SET_YEAR':
        this._state.currentYear = payload.year; break;
      case 'SET_SPEED':
        this._state.speed = payload.speed; break;
      case 'SET_MILLENNIUM':
        this._state.millenniumIndex = payload.index;
        this._state.currentYear = payload.year; break;
      case 'PUSH_FORK':
        this._state.forkHistory.push(payload); break;
      case 'POP_FORK':
        this._state.forkHistory.pop(); break;
      case 'SET_LLM':
        this._state.isLLMOnline = payload.online; break;
      case 'ADD_ANNOTATION':
        this._state.annotations.push(payload); break;
    }
    window.Bus.emit('STATE_CHANGED', { prev, next: this._state, action });
  }

  snapshot() { return JSON.parse(JSON.stringify(this._state)); }
}

window.State = new StateManager();
