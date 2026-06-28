class EventBus {
  constructor() { this._listeners = {}; }

  on(event, callback, context = null) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ callback, context });
    return this;
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event]
      .filter(l => l.callback !== callback);
  }

  emit(event, data = {}) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(({ callback, context }) => {
      callback.call(context, data);
    });
  }

  once(event, callback) {
    const wrapper = (data) => { callback(data); this.off(event, wrapper); };
    this.on(event, wrapper);
  }
}

window.Bus = new EventBus();
