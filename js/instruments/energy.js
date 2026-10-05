/**
 * Energy state widget – speed/height trade awareness.
 *
 * Specific energy height:   E = h + V^2 / (2 g)
 * (V from indicated airspeed – a good-enough proxy for a figure-to-figure
 * comparison; it is not true TAS.)
 *
 *  - dE   : energy change since the reference was set ("SET" button / key E).
 *           Set it at figure entry; at the end it shows what the figure cost.
 *  - TE   : total-energy rate (smoothed dE/dt), like a TE vario. Strongly
 *           negative means drag/over-G is bleeding energy.
 *  - bar  : dE graphically, red left = lost, green right = gained.
 *
 * API: energy(host, { settings }) -> { configure(), update(state, dt), setReference() }
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const { svg, util } = AP;

  AP.instruments.energy = function energy(host, ctx) {
    let u, barPos, barNeg, tDelta, tTe, tTot, scaleM, lastShown = {};
    let refE = null;
    let lastSeq = -1;
    let lastT = 0;
    let lastE = null;
    let teRate = 0; // m/s, smoothed
    let curE = null;

    function configure() {
      u = AP.units(ctx.settings.get().units);
      scaleM = u.system === 'metric' ? 150 : 500 * util.FT_TO_M; // full-scale bar, metres
      lastShown = {};
      build();
    }

    function build() {
      const root = svg.root(host, '0 0 400 96');
      root.setAttribute('class', 'ap-svg ap-energy');
      svg.text(root, 8, 16, 'ENERGY', 'ap-label ap-label-xs', { 'text-anchor': 'start' });

      // centre-zero bar
      svg.el('rect', { x: 20, y: 28, width: 360, height: 20, rx: 4, class: 'ap-energy-track' }, root);
      barNeg = svg.el('rect', { x: 200, y: 28, width: 0, height: 20, class: 'ap-energy-neg' }, root);
      barPos = svg.el('rect', { x: 200, y: 28, width: 0, height: 20, class: 'ap-energy-pos' }, root);
      svg.el('line', { x1: 200, y1: 24, x2: 200, y2: 52, class: 'ap-energy-zero' }, root);

      tDelta = svg.text(root, 20, 80, 'ΔE --', 'ap-digital ap-digital-sm', { 'text-anchor': 'start' });
      tTe = svg.text(root, 380, 80, 'TE --', 'ap-digital ap-digital-sm', { 'text-anchor': 'end' });
      tTot = svg.text(root, 392, 16, '', 'ap-label ap-label-xs', { 'text-anchor': 'end' });
    }

    function setText(el, key, str) {
      if (lastShown[key] !== str) {
        el.textContent = str;
        lastShown[key] = str;
      }
    }

    function setReference() {
      refE = curE;
    }

    function update(state) {
      const have = util.isNum(state.ias) && util.isNum(state.alt);
      host.classList.toggle('nodata', !have);
      if (!have) return;

      // Energy bookkeeping only on NEW samples (state.seq), using sample time.
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        const v = state.ias * util.KT_TO_MS;
        curE = state.alt * util.FT_TO_M + (v * v) / (2 * util.G0);
        if (lastE !== null && state.t > lastT) {
          const dtS = (state.t - lastT) / 1000;
          const inst = (curE - lastE) / dtS;
          teRate += (inst - teRate) * (1 - Math.exp(-dtS / 0.6));
        }
        lastE = curE;
        lastT = state.t;
        if (refE === null) refE = curE;
      }

      const dE = curE - refE; // metres
      const w = util.clamp(dE / scaleM, -1, 1) * 180;
      barPos.setAttribute('width', Math.max(0, w).toFixed(1));
      barNeg.setAttribute('x', (200 + Math.min(0, w)).toFixed(1));
      barNeg.setAttribute('width', Math.max(0, -w).toFixed(1));

      const altU = u.alt.fromFt / util.FT_TO_M; // metres -> display alt unit
      const teU = u.system === 'metric' ? teRate : (teRate / util.FT_TO_M) * 60; // m/s or fpm
      setText(tDelta, 'd', `ΔE ${util.signed(dE * altU, 0)} ${u.alt.label}`);
      setText(tTe, 'te', u.system === 'metric' ? `TE ${util.signed(teU, 1)} m/s` : `TE ${util.signed(teU, 0)} fpm`);
      setText(tTot, 't', `E ${Math.round(curE * altU)} ${u.alt.label}`);
    }

    configure();
    return { configure, update, setReference };
  };
})(window);
