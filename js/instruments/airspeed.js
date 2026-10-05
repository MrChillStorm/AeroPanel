/**
 * Airspeed Indicator – 270 degree dial with an EXPANDED, non-linear scale.
 *
 * The scale is defined in knots by `profile.asi.stops` ([kt, fraction]) so the
 * band where figures are flown (roughly 50-110 kt) gets the most dial angle.
 * Ticks and labels are generated in the DISPLAY unit (km/h, kt or mph) and
 * mapped back through knots, so unit switching just rebuilds the dial.
 *
 * Colour arcs (aerobatic convention): green Vs..Va (manoeuvring range),
 * amber Va..Vne (smooth air / gentle only), red radial at Vne.
 *
 * API: airspeed(host, { settings }) -> { configure(), update(state, dt) }
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const { svg, util } = AP;

  const C = 200;
  const START = -135;
  const SWEEP = 270;

  // tick spacing per display unit: minor / major spacing, first tick, first label
  const TICKS = {
    'km/h': { minor: 10, major: 20, tickFrom: 60, labelFrom: 80 },
    kt: { minor: 5, major: 10, tickFrom: 30, labelFrom: 40 },
    mph: { minor: 5, major: 10, tickFrom: 35, labelFrom: 40 },
  };

  AP.instruments.airspeed = function airspeed(host, ctx) {
    let needle, tValue, frac, f, asi, lastText = '';
    const spd = new util.Smooth(0.03, 0);

    const ang = (kt) => START + util.clamp(frac(kt), -0.05, 1.06) * SWEEP;

    function configure() {
      const s = ctx.settings.get();
      const u = AP.units(s.units).speed;
      f = u.fromKt;
      asi = AP.getProfile(s.profile).asi;
      frac = util.piecewise(asi.stops);
      lastText = '';
      build(u);
    }

    function build(u) {
      const root = svg.root(host);
      root.setAttribute('class', 'ap-svg ap-asi');
      svg.dialFace(root, C, C, 190);

      const maxKt = asi.stops[asi.stops.length - 1][0];

      // coloured arcs
      const arc = (a, b, cls) => svg.el('path', { d: svg.arc(C, C, 178, ang(a), ang(b)), class: 'ap-band ' + cls }, root);
      arc(asi.vs, asi.va, 'ap-band-ok');
      arc(asi.va, asi.vne, 'ap-band-caution');
      arc(asi.vne, maxKt, 'ap-band-warn');

      // ticks + labels in display units
      const t = TICKS[u.label] || TICKS.kt;
      for (let v = 0; v <= maxKt * f + 1e-6; v += t.minor) {
        const kt = v / f;
        const major = v % t.major === 0;
        if (v < t.tickFrom) continue;
        svg.tick(root, C, C, major ? 148 : 158, 168, ang(kt), major ? 'ap-tick ap-tick-major' : 'ap-tick');
        // above ~110 kt the scale is compressed: label every other major tick
        const crowded = kt > 110 && (v / t.major) % 2 === 1;
        if (major && v >= t.labelFrom && !crowded) {
          const [x, y] = svg.polar(C, C, 126, ang(kt));
          svg.text(root, x, y, String(v), 'ap-num ap-num-md', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        }
      }
      svg.tick(root, C, C, 138, 180, ang(asi.vne), 'ap-tick ap-tick-limit');

      svg.text(root, C, 124, 'AIRSPEED', 'ap-label', { 'text-anchor': 'middle' });
      svg.text(root, C, 146, u.label.toUpperCase(), 'ap-label ap-label-dim', { 'text-anchor': 'middle' });

      // digital window
      svg.el('rect', { x: C - 56, y: 262, width: 112, height: 50, rx: 6, class: 'ap-window' }, root);
      tValue = svg.text(root, C, 288, '0', 'ap-digital ap-digital-lg', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });

      needle = svg.el('g', { class: 'ap-needle-g' }, root);
      svg.el('polygon', { points: `${C - 5},${C + 34} ${C - 3},${C - 120} ${C},${C - 168} ${C + 3},${C - 120} ${C + 5},${C + 34}`, class: 'ap-needle' }, needle);
      svg.el('circle', { cx: C, cy: C, r: 13, class: 'ap-hub' }, root);
      svg.el('circle', { cx: C, cy: C, r: 4, class: 'ap-hub-dot' }, root);
    }

    function update(state, dt) {
      const have = util.isNum(state.ias);
      host.classList.toggle('nodata', !have);
      if (!have) return;
      spd.set(state.ias);
      spd.step(dt);
      needle.setAttribute('transform', `rotate(${ang(Math.max(0, spd.value)).toFixed(2)} ${C} ${C})`);
      const txt = String(Math.round(state.ias * f));
      if (txt !== lastText) {
        tValue.textContent = txt;
        lastText = txt;
      }
    }

    configure();
    return { configure, update };
  };
})(window);
