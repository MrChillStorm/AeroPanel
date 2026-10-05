/**
 * Simple Variometer for energy awareness between figures.
 *
 * Zero sits at 9 o'clock; climb sweeps clockwise over the top, sink
 * counter-clockwise under the bottom. The scale is non-linear (fine near
 * zero, coarse at the ends) because aerobatic vertical speeds range from
 * +-1 m/s in a transition to 20+ m/s in a vertical line.
 *
 * API: variometer(host, { settings }) -> { configure(), update(state, dt) }
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const { svg, util } = AP;

  const C = 200;
  const ZERO = -90; // 9 o'clock
  const SPAN = 150; // degrees each way

  // per display unit: [value, fraction] stops, label values, minor tick values, label divisor
  const SCALES = {
    'm/s': {
      stops: [[0, 0], [1, 0.15], [2, 0.3], [5, 0.55], [10, 0.8], [20, 1]],
      labels: [0, 1, 2, 5, 10, 20],
      minor: [0.5, 1.5, 3, 4, 7.5, 15],
      div: 1,
      digits: 1,
    },
    fpm: {
      stops: [[0, 0], [200, 0.15], [400, 0.3], [1000, 0.55], [2000, 0.8], [4000, 1]],
      labels: [0, 200, 400, 1000, 2000, 4000],
      minor: [100, 300, 600, 800, 1500, 3000],
      div: 100,
      digits: 0,
    },
  };

  AP.instruments.variometer = function variometer(host, ctx) {
    let needle, tValue, sc, frac, u, lastText = '';
    const vs = new util.Smooth(0.08, 0); // vario is intentionally a little damped

    // value (display unit, signed) -> angle
    const ang = (v) => ZERO + Math.sign(v) * util.clamp(frac(Math.abs(v)), 0, 1.04) * SPAN;

    function configure() {
      u = AP.units(ctx.settings.get().units).vs;
      sc = SCALES[u.label];
      frac = util.piecewise(sc.stops);
      lastText = '';
      build();
    }

    function build() {
      const root = svg.root(host);
      root.setAttribute('class', 'ap-svg ap-vario');
      svg.dialFace(root, C, C, 190);

      [1, -1].forEach((sign) => {
        sc.labels.forEach((v) => {
          const a = ang(sign * v);
          svg.tick(root, C, C, 146, 170, a, 'ap-tick ap-tick-major');
          if (v !== 0 || sign > 0) {
            const [x, y] = svg.polar(C, C, 124, a);
            svg.text(root, x, y, String(v / sc.div), 'ap-num ap-num-md', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
          }
        });
        sc.minor.forEach((v) => svg.tick(root, C, C, 158, 170, ang(sign * v), 'ap-tick'));
      });
      svg.text(root, C + 40, 150, 'VARIO', 'ap-label', { 'text-anchor': 'middle' });
      svg.text(root, C + 40, 172, sc.div > 1 ? `×${sc.div} ${u.label.toUpperCase()}` : u.label.toUpperCase(), 'ap-label ap-label-dim', { 'text-anchor': 'middle' });

      svg.el('rect', { x: C - 62, y: 232, width: 140, height: 46, rx: 6, class: 'ap-window' }, root);
      tValue = svg.text(root, C + 8, 256, '0', 'ap-digital ap-digital-lg', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });

      needle = svg.el('g', { class: 'ap-needle-g' }, root);
      svg.el('polygon', { points: `${C - 5},${C + 30} ${C - 3},${C - 120} ${C},${C - 168} ${C + 3},${C - 120} ${C + 5},${C + 30}`, class: 'ap-needle' }, needle);
      svg.el('circle', { cx: C, cy: C, r: 13, class: 'ap-hub' }, root);
      svg.el('circle', { cx: C, cy: C, r: 4, class: 'ap-hub-dot' }, root);
    }

    function update(state, dt) {
      const have = util.isNum(state.vs);
      host.classList.toggle('nodata', !have);
      if (!have) return;
      vs.set(state.vs * u.fromFpm);
      vs.step(dt);
      // needle polygon points "up" (0 deg = 12 o'clock) so rotate by absolute angle
      needle.setAttribute('transform', `rotate(${ang(vs.value).toFixed(2)} ${C} ${C})`);
      const val = state.vs * u.fromFpm;
      const txt = (val > 0 ? '+' : val < 0 ? '−' : '') + Math.abs(val).toFixed(sc.digits);
      if (txt !== lastText) {
        tValue.textContent = txt;
        lastText = txt;
      }
    }

    configure();
    return { configure, update };
  };
})(window);
