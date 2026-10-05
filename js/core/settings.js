/**
 * Persistent settings (localStorage) with URL-parameter overrides.
 *
 *   index.html?host=192.168.1.20&port=5400&units=imperial&profile=mdm1&demo=1
 *
 * URL parameters win for the session but are not saved unless you change a
 * setting in the UI.
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const KEY = 'aeropanel.settings.v1';

  const defaults = {
    host: '127.0.0.1', // machine running FlightGear
    port: 5400, // fgfs --httpd=PORT
    transport: 'poll', // 'poll' (HTTP JSON) | 'ws' (experimental) | 'demo'
    hz: 20, // target poll rate
    units: 'metric', // 'metric' | 'imperial'
    theme: 'day', // 'day' | 'night'
    profile: 'generic-unl',
    qnh: 1013.25, // hPa, panel-side Kollsman setting
    invertG: false, // some FDMs report pilot-g with opposite sign
    invertSlip: false,
    slipFull: 1, // slip property value that equals full ball deflection
    gLimitPos: null, // null = use profile
    gLimitNeg: null,
    propOverrides: {}, // { key: '/some/other/property' }
  };

  const listeners = [];
  let data = Object.assign({}, defaults);

  function load() {
    try {
      const raw = global.localStorage.getItem(KEY);
      if (raw) Object.assign(data, JSON.parse(raw));
    } catch (e) {
      /* storage blocked – run with defaults */
    }
    const q = new URLSearchParams(global.location.search);
    if (q.get('host')) data.host = q.get('host');
    if (q.get('port')) data.port = parseInt(q.get('port'), 10) || data.port;
    if (q.get('units')) data.units = q.get('units') === 'imperial' ? 'imperial' : 'metric';
    if (q.get('theme')) data.theme = q.get('theme') === 'night' ? 'night' : 'day';
    if (q.get('profile') && AP.profiles[q.get('profile')]) data.profile = q.get('profile');
    if (q.get('hz')) data.hz = parseInt(q.get('hz'), 10) || data.hz;
    if (q.get('transport')) data.transport = q.get('transport');
    if (q.get('demo') === '1') data.transport = 'demo';
  }

  function save() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
  }

  AP.settings = {
    load,
    get: () => data,
    /** Merge a patch, persist, notify. `changed` lists the keys that differ. */
    set(patch) {
      const changed = Object.keys(patch).filter(
        (k) => JSON.stringify(data[k]) !== JSON.stringify(patch[k])
      );
      Object.assign(data, patch);
      save();
      if (changed.length) listeners.forEach((fn) => fn(data, changed));
    },
    onChange: (fn) => listeners.push(fn),
    defaults,
  };
})(window);
