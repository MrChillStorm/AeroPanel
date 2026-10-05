/**
 * G-Meter – the primary aerobatic instrument.
 *
 *  - Large current-G needle (smoothed between samples for a fluid sweep)
 *  - Two tell-tale markers on the rim: peak positive (amber ▼) and peak
 *    negative (cyan ▲), latched until reset
 *  - Digital readout of current G and both peaks inside the dial
 *  - Limit marks from the aircraft profile (default +9 / -6) with amber
 *    "approaching" and red "beyond limit" bands; the readout flashes red and
 *    the offending peak stays red until reset
 *
 * Peaks are taken from RAW samples (not the smoothed needle), so a short
 * spike that the poll caught is never smoothed away. Sampling rate bounds
 * what can be caught – very brief spikes between samples are invisible to any
 * polled instrument (see README).
 *
 * API: gMeter(host, { settings }) -> { configure(), update(state, dt), resetPeaks() }
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const { svg, util } = AP;

  const C = 200; // dial centre (viewBox 400x400)
  const SWEEP_START = -130;
  const SWEEP = 260;

  AP.instruments.gMeter = function gMeter(host, ctx) {
    let gmin, gmax, limPos, limNeg;
    let needle, peakPosMark, peakNegMark, tReadout, tPeakPos, tPeakNeg, root;

    const needleG = new util.Smooth(0.03, 1);
    let peakMax = null;
    let peakMin = null;
    let lastShown = {};

    const ang = (g) => SWEEP_START + ((g - gmin) / (gmax - gmin)) * SWEEP;

    function configure() {
      const s = ctx.settings.get();
      const prof = AP.getProfile(s.profile);
      limPos = s.gLimitPos != null ? s.gLimitPos : prof.gPos;
      limNeg = s.gLimitNeg != null ? s.gLimitNeg : prof.gNeg;
      gmin = Math.floor(limNeg) - 1;
      gmax = Math.ceil(limPos) + 1;
      lastShown = {};
      build();
    }

    function build() {
      root = svg.root(host);
      root.setAttribute('class', 'ap-svg ap-gmeter');
      svg.dialFace(root, C, C, 190);

      // --- limit bands on the rim (positive and negative side)
      const band = (g0, g1, cls) =>
        svg.el('path', { d: svg.arc(C, C, 178, ang(g0), ang(g1)), class: 'ap-band ' + cls }, root);
      band(0, limPos * 0.8, 'ap-band-ok');
      band(limPos * 0.8, limPos, 'ap-band-caution');
      band(limPos, gmax, 'ap-band-warn');
      band(limNeg * 0.8, 0, 'ap-band-ok');
      band(limNeg, limNeg * 0.8, 'ap-band-caution');
      band(gmin, limNeg, 'ap-band-warn');

      // --- ticks and labels
      for (let g = gmin; g <= gmax + 1e-6; g += 0.5) {
        const major = Math.abs(g - Math.round(g)) < 1e-6;
        svg.tick(root, C, C, major ? 150 : 160, 168, ang(g), major ? 'ap-tick ap-tick-major' : 'ap-tick');
        if (major) {
          const [x, y] = svg.polar(C, C, 134, ang(g));
          const cls = g === limPos || g === limNeg ? 'ap-num-warn' : g === 1 ? 'ap-num-accent' : '';
          svg.text(root, x, y, g < 0 ? '\u2212' + Math.abs(g) : String(g), 'ap-num ap-num-md ' + cls, { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        }
      }
      // 1 G reference index
      svg.tick(root, C, C, 142, 170, ang(1), 'ap-tick ap-tick-ref');

      // --- limit radials + labels
      [limPos, limNeg].forEach((g) => {
        svg.tick(root, C, C, 138, 178, ang(g), 'ap-tick ap-tick-limit');
      });

      svg.text(root, C, 112, 'G', 'ap-label ap-label-lg', { 'text-anchor': 'middle' });

      // --- digital readouts: current G in a window, peaks beneath
      svg.el('rect', { x: C - 74, y: 232, width: 148, height: 58, rx: 8, class: 'ap-window' }, root);
      tReadout = svg.text(root, C, 262, '1.0', 'ap-digital ap-digital-xl', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      // left = lowest G seen (cyan), right = highest G seen (amber)
      tPeakNeg = svg.text(root, C - 8, 330, '\u25BC --', 'ap-digital ap-digital-sm ap-peak-neg', { 'text-anchor': 'end' });
      tPeakPos = svg.text(root, C + 8, 330, '\u25B2 --', 'ap-digital ap-digital-sm ap-peak-pos', { 'text-anchor': 'start' });

      // --- peak markers (rim)
      peakPosMark = marker('ap-peak-pos-mark');
      peakNegMark = marker('ap-peak-neg-mark');

      // --- needle (drawn last so it sits over scale and digits)
      needle = svg.el('g', { class: 'ap-needle-g' }, root);
      svg.el('polygon', { points: `${C - 5},${C + 38} ${C - 3},${C - 150} ${C},${C - 168} ${C + 3},${C - 150} ${C + 5},${C + 38}`, class: 'ap-needle' }, needle);
      svg.el('circle', { cx: C, cy: C, r: 13, class: 'ap-hub' }, root);
      svg.el('circle', { cx: C, cy: C, r: 4, class: 'ap-hub-dot' }, root);

      /** Tell-tale: small triangle on the outer rim pointing at the scale. */
      function marker(cls) {
        const g = svg.el('g', { class: 'ap-peak-mark ' + cls }, root);
        svg.el('polygon', { points: '-10,-199 10,-199 0,-180', transform: `translate(${C} ${C})` }, g);
        return g;
      }
      render();
    }

    function fmt(v) {
      return v == null ? '--' : util.signed(v, 1);
    }

    function render() {
      needle.setAttribute('transform', `rotate(${ang(util.clamp(needleG.value, gmin - 0.5, gmax + 0.5)).toFixed(2)} ${C} ${C})`);
    }

    function setText(el, key, str) {
      if (lastShown[key] !== str) {
        el.textContent = str;
        lastShown[key] = str;
      }
    }

    function setClass(el, key, cls) {
      if (lastShown[key] !== cls) {
        el.setAttribute('class', cls);
        lastShown[key] = cls;
      }
    }

    function resetPeaks() {
      peakMax = peakMin = null;
    }

    function update(state, dt) {
      const have = util.isNum(state.g);
      host.classList.toggle('nodata', !have);
      if (!have) return;

      needleG.set(state.g);
      needleG.step(dt);

      if (peakMax === null || state.g > peakMax) peakMax = state.g;
      if (peakMin === null || state.g < peakMin) peakMin = state.g;

      render();

      const g = state.g;
      const over = g > limPos || g < limNeg;
      setText(tReadout, 'g', util.signed(g, 1));
      setClass(tReadout, 'gc', 'ap-digital ap-digital-xl' + (over ? ' ap-flash' : ''));

      setText(tPeakPos, 'pp', '\u25B2 ' + fmt(peakMax));
      setText(tPeakNeg, 'pn', '\u25BC ' + fmt(peakMin));
      setClass(tPeakPos, 'ppc', 'ap-digital ap-digital-sm ap-peak-pos' + (peakMax > limPos ? ' ap-over' : ''));
      setClass(tPeakNeg, 'pnc', 'ap-digital ap-digital-sm ap-peak-neg' + (peakMin < limNeg ? ' ap-over' : ''));

      peakPosMark.setAttribute('transform', `rotate(${ang(util.clamp(peakMax, gmin, gmax)).toFixed(2)} ${C} ${C})`);
      peakNegMark.setAttribute('transform', `rotate(${ang(util.clamp(peakMin, gmin, gmax)).toFixed(2)} ${C} ${C})`);
    }

    configure();
    return { configure, update, resetPeaks };
  };
})(window);
