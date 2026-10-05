/**
 * DataManager – picks a source (HTTP / WebSocket / demo), merges incoming
 * values into one `state` object and publishes connection status.
 *
 * state (FlightGear-native units; undefined until first valid sample):
 *   ias kt, alt ft, g, pitch deg, roll deg, hdg deg,
 *   slip  -1..1 (ball),  vs fpm,  qnh inHg
 *   seq   increments with every applied sample
 *   t     performance.now() (ms) of the latest sample
 *   age   set by getState(): ms since the latest sample
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;

  class DataManager {
    constructor(settings) {
      this.settings = settings;
      this.state = { seq: 0, t: 0 };
      this.status = { mode: 'idle', hz: 0, message: '', missing: [] };
      this.statusListeners = [];
      this.source = null;
    }

    onStatus(fn) {
      this.statusListeners.push(fn);
    }

    /** (Re)create the source from current settings. */
    connect() {
      this.disconnect();
      const s = this.settings.get();
      this.state = { seq: 0, t: 0 };
      const opts = {
        props: AP.data.resolveProps(s.propOverrides),
        host: s.host,
        port: s.port,
        hz: s.hz,
        onValues: (v) => this.apply(v),
        onStatus: (st) => this.setStatus(st),
      };
      const Src =
        s.transport === 'demo' ? AP.data.DemoSource : s.transport === 'ws' ? AP.data.WsSource : AP.data.HttpSource;
      this.source = new Src(opts);
      this.source.start();
    }

    disconnect() {
      if (this.source) this.source.stop();
      this.source = null;
    }

    setStatus(st) {
      this.status = Object.assign({}, this.status, st);
      if (st.mode !== 'live') this.status.missing = st.missing || [];
      this.statusListeners.forEach((fn) => fn(this.status));
    }

    apply(v) {
      const s = this.settings.get();
      const st = this.state;
      if ('ias' in v) st.ias = v.ias;
      if ('alt' in v) st.alt = v.alt;
      if ('g' in v) st.g = s.invertG ? -v.g : v.g;
      if ('pitch' in v) st.pitch = v.pitch;
      if ('roll' in v) st.roll = v.roll;
      if ('hdg' in v) st.hdg = v.hdg;
      if ('slip' in v) {
        const full = Math.abs(s.slipFull) > 1e-6 ? s.slipFull : 1;
        st.slip = Math.max(-1, Math.min(1, (v.slip / full) * (s.invertSlip ? -1 : 1)));
      }
      if ('vsfps' in v) st.vs = v.vsfps * 60;
      if ('qnh' in v) st.qnh = v.qnh;
      st.seq++;
      st.t = performance.now();
    }

    getState() {
      this.state.age = this.state.t ? performance.now() - this.state.t : Infinity;
      return this.state;
    }
  }

  AP.data.DataManager = DataManager;
})(window);
