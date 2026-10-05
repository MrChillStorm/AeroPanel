/**
 * AeroPanel bootstrap: builds the instruments, wires the buttons / keyboard /
 * settings dialog, and runs one requestAnimationFrame loop that feeds every
 * instrument the latest state each frame. Instruments smooth between the
 * 15-30 Hz data samples themselves, so needles move at display refresh rate.
 */
(function () {
  'use strict';
  const AP = window.AeroPanel;
  const $ = (id) => document.getElementById(id);

  AP.settings.load();
  const settings = AP.settings;
  const ctx = { settings };

  /* ------------------------------------------------------------ instruments */
  const inst = {
    asi: AP.instruments.airspeed($('inst-asi'), ctx),
    att: AP.instruments.attitude($('inst-att'), ctx),
    slip: AP.instruments.slipSkid($('inst-slip'), ctx),
    alt: AP.instruments.altimeter($('inst-alt'), ctx),
    hdg: AP.instruments.compass($('inst-hdg'), ctx),
    g: AP.instruments.gMeter($('inst-g'), ctx),
    vario: AP.instruments.variometer($('inst-vario'), ctx),
    energy: AP.instruments.energy($('inst-energy'), ctx),
  };

  /* ------------------------------------------------------------------- data */
  const dm = new AP.data.DataManager(settings);

  /* ----------------------------------------------------------------- status */
  const statusEl = $('status');
  const statusText = $('status-text');
  const statusRate = $('status-rate');
  const statusWarn = $('status-warn');

  dm.onStatus((st) => {
    statusEl.dataset.mode = st.mode;
    const label = { live: 'LIVE', demo: 'DEMO', connecting: 'CONNECTING', error: 'NO LINK', idle: 'IDLE' }[st.mode] || st.mode;
    statusText.textContent = `${label}${st.message ? ' · ' + st.message : ''}`;
    statusRate.textContent = st.hz ? `${st.hz} ${st.unit || 'Hz'}` : '';
    const miss = st.missing || [];
    statusWarn.hidden = miss.length === 0;
    if (miss.length) {
      statusWarn.textContent = `⚠ ${miss.length} property missing`;
      const paths = AP.data.resolveProps(settings.get().propOverrides)
        .filter((p) => miss.indexOf(p.key) >= 0)
        .map((p) => p.path);
      statusWarn.title = 'Not provided by this aircraft/FDM:\n' + paths.join('\n') + '\n\nOverride in Settings → Advanced.';
    }
  });

  /* -------------------------------------------------------------- render loop */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const state = dm.getState();
    // If data stops flowing, show "no data" rather than freezing on stale values.
    const live = state.age < 2500;
    const view = live ? state : { seq: state.seq, t: state.t };
    for (const k in inst) inst[k].update(view, dt);
    requestAnimationFrame(frame);
  }

  /* -------------------------------------------------------------------- UI */
  const profileSel = $('profile');
  Object.keys(AP.profiles).forEach((id) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = AP.profiles[id].name;
    profileSel.appendChild(o);
  });

  function applyTheme() {
    const s = settings.get();
    document.documentElement.dataset.theme = s.theme;
    $('btn-theme').textContent = s.theme === 'night' ? 'NIGHT' : 'DAY';
    $('btn-units').textContent = s.units === 'imperial' ? 'IMPERIAL' : 'METRIC';
    $('btn-demo').classList.toggle('on', s.transport === 'demo');
    profileSel.value = s.profile;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = s.theme === 'night' ? '#000000' : '#04060a';
  }

  settings.onChange((s, changed) => {
    applyTheme();
    if (changed.some((k) => ['units', 'profile', 'gLimitPos', 'gLimitNeg'].indexOf(k) >= 0)) {
      for (const k in inst) inst[k].configure();
    }
    if (changed.some((k) => ['host', 'port', 'transport', 'hz', 'propOverrides'].indexOf(k) >= 0)) dm.connect();
  });

  const toggleTheme = () => settings.set({ theme: settings.get().theme === 'night' ? 'day' : 'night' });
  const toggleUnits = () => settings.set({ units: settings.get().units === 'metric' ? 'imperial' : 'metric' });
  const toggleDemo = () => {
    const s = settings.get();
    // remember the real transport so DEMO is a true toggle
    if (s.transport === 'demo') settings.set({ transport: window.__lastRealTransport || 'poll' });
    else {
      window.__lastRealTransport = s.transport;
      settings.set({ transport: 'demo' });
    }
  };
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  };

  $('btn-theme').onclick = toggleTheme;
  $('btn-units').onclick = toggleUnits;
  $('btn-demo').onclick = toggleDemo;
  $('btn-full').onclick = toggleFull;
  profileSel.onchange = () => settings.set({ profile: profileSel.value, gLimitPos: null, gLimitNeg: null });

  $('g-reset').onclick = () => inst.g.resetPeaks();
  $('energy-set').onclick = () => inst.energy.setReference();
  $('hdg-ref').onclick = () => {
    $('hdg-ref').textContent = inst.hdg.toggleRef() ? 'CLEAR REF' : 'SET REF';
  };
  $('qnh-sim').onclick = () => inst.alt.qnhFromSim();
  $('qnh-std').onclick = () => inst.alt.qnhStd();

  // QNH +/- with press-and-hold auto-repeat
  function holdRepeat(btn, step) {
    let delay, rep;
    const stop = () => { clearTimeout(delay); clearInterval(rep); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      inst.alt.adjustQnh(step);
      delay = setTimeout(() => { rep = setInterval(() => inst.alt.adjustQnh(step), 90); }, 400);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
  }
  holdRepeat($('qnh-up'), +1);
  holdRepeat($('qnh-down'), -1);

  /* --------------------------------------------------------------- settings */
  const dlg = $('settings');
  const form = $('settings-form');

  function openSettings() {
    const s = settings.get();
    form.host.value = s.host;
    form.port.value = s.port;
    form.transport.value = s.transport;
    form.hz.value = s.hz;
    form.gLimitPos.value = s.gLimitPos == null ? '' : s.gLimitPos;
    form.gLimitNeg.value = s.gLimitNeg == null ? '' : s.gLimitNeg;
    form.invertG.checked = s.invertG;
    form.invertSlip.checked = s.invertSlip;
    form.slipFull.value = s.slipFull;
    form.propOverrides.value = Object.keys(s.propOverrides || {}).length ? JSON.stringify(s.propOverrides, null, 1) : '';
    dlg.showModal();
  }
  $('btn-settings').onclick = openSettings;

  form.addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    let overrides = {};
    const raw = form.propOverrides.value.trim();
    if (raw) {
      try { overrides = JSON.parse(raw); } catch (e) { alert('Property map is not valid JSON – override ignored.'); }
    }
    const num = (el, fallback) => (el.value === '' ? fallback : Number(el.value));
    settings.set({
      host: form.host.value.trim() || '127.0.0.1',
      port: Math.round(num(form.port, 5400)),
      transport: form.transport.value,
      hz: Math.min(60, Math.max(5, Math.round(num(form.hz, 20)))),
      gLimitPos: form.gLimitPos.value === '' ? null : Number(form.gLimitPos.value),
      gLimitNeg: form.gLimitNeg.value === '' ? null : Number(form.gLimitNeg.value),
      invertG: form.invertG.checked,
      invertSlip: form.invertSlip.checked,
      slipFull: num(form.slipFull, 1),
      propOverrides: overrides,
    });
  });

  /* --------------------------------------------------------------- keyboard */
  document.addEventListener('keydown', (e) => {
    if (dlg.open || e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key.toLowerCase()) {
      case 'r': inst.g.resetPeaks(); break;
      case 't': toggleTheme(); break;
      case 'u': toggleUnits(); break;
      case 'd': toggleDemo(); break;
      case 'f': toggleFull(); break;
      case 's': e.preventDefault(); openSettings(); break;
      case 'h': $('hdg-ref').click(); break;
      case 'e': inst.energy.setReference(); break;
      case 'arrowup': inst.alt.adjustQnh(+1); break;
      case 'arrowdown': inst.alt.adjustQnh(-1); break;
    }
  });

  /* ------------------------------------------------------------------ start */
  applyTheme();
  dm.connect();
  requestAnimationFrame(frame);

  AP.app = { settings, dm, inst }; // handy for the browser console
})();
