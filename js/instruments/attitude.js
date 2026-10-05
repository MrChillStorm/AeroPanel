/**
 * Attitude Indicator (SVG, 360-degree bank ring).
 *
 * Rendering model: sky, ground and the pitch ladder (to +/-90) are transformed by
 *   rotate(-roll) translate(0, pitch * K)
 * and the 360 degree bank ring by rotate(-roll) only, all behind a fixed aircraft
 * symbol and fixed bank index.
 *
 * Why it will not tumble:
 *  1. Smoothing between 20 Hz samples takes the SHORTEST angular path, so
 *     roll 179 -> -179 sweeps 2 degrees rather than spinning 358.
 *  2. Near the vertical, FDM Euler angles are singular: passing through
 *     pitch 90 the FDM reports roll/heading jumping by ~180 degrees. When we
 *     see a ~180 deg roll jump at |pitch| > 70 we SNAP instead of animating.
 *     With the nose within 20 deg of the zenith the sky fills the view, so
 *     the snap is visually the same picture – no spin, no flicker.
 *  3. Pitch ladder runs the full +/-90 and the world rectangles are huge, so
 *     no attitude can expose an edge.
 *
 * API: attitude(host, { settings }) -> { configure(), update(state, dt) }
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const { svg, util } = AP;

  const R = 190; // visible face radius (viewBox -200..200)
  const K = 5; // pixels per degree of pitch

  AP.instruments.attitude = function attitude(host) {
    let rollG, world, tRoll, tPitch;
    const lastShown = {};
    const roll = new util.SmoothAngle(0.035, 0);
    const pitch = new util.Smooth(0.035, 0);
    let rawRoll = null;
    let rawPitch = null;

    function build() {
      const root = svg.root(host, '-200 -200 400 400');
      root.setAttribute('class', 'ap-svg ap-attitude');
      const defs = svg.el('defs', null, root);
      const clip = svg.el('clipPath', { id: 'ap-att-clip' }, defs);
      svg.el('circle', { cx: 0, cy: 0, r: R }, clip);
      const gsky = svg.el('linearGradient', { id: 'ap-att-sky', gradientUnits: 'userSpaceOnUse', x1: 0, y1: -700, x2: 0, y2: 0 }, defs);
      svg.el('stop', { offset: '0', 'stop-color': 'var(--sky-hi)' }, gsky);
      svg.el('stop', { offset: '1', 'stop-color': 'var(--sky-lo)' }, gsky);
      const ggr = svg.el('linearGradient', { id: 'ap-att-gnd', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 700 }, defs);
      svg.el('stop', { offset: '0', 'stop-color': 'var(--gnd-hi)' }, ggr);
      svg.el('stop', { offset: '1', 'stop-color': 'var(--gnd-lo)' }, ggr);

      svg.el('circle', { cx: 0, cy: 0, r: R + 10, class: 'ap-bezel-outer' }, root);

      const clipped = svg.el('g', { 'clip-path': 'url(#ap-att-clip)' }, root);
      // rollG rotates everything; pitchG additionally slides along the rotated
      // vertical. The bank ring lives in rollG only (it must not slide with pitch).
      rollG = svg.el('g', { class: 'ap-roll' }, clipped);
      world = svg.el('g', { class: 'ap-world' }, rollG);

      // sky and ground: huge so no attitude can reveal an edge
      svg.el('rect', { x: -1500, y: -3000, width: 3000, height: 3000, fill: 'url(#ap-att-sky)' }, world);
      svg.el('rect', { x: -1500, y: 0, width: 3000, height: 3000, fill: 'url(#ap-att-gnd)' }, world);
      svg.el('line', { x1: -1500, y1: 0, x2: 1500, y2: 0, class: 'ap-horizon' }, world);

      // pitch ladder to the zenith/nadir
      for (let p = -90; p <= 90; p += 5) {
        if (p === 0) continue;
        const y = -p * K;
        const major = p % 10 === 0;
        const half = major ? 46 : 20;
        svg.el('line', { x1: -half, y1: y, x2: half, y2: y, class: 'ap-ladder' + (major ? ' ap-ladder-major' : '') }, world);
        if (major) {
          // short end ticks pointing toward the horizon, like a real ladder
          const d = p > 0 ? 7 : -7;
          svg.el('line', { x1: -half, y1: y, x2: -half, y2: y + d, class: 'ap-ladder' }, world);
          svg.el('line', { x1: half, y1: y, x2: half, y2: y + d, class: 'ap-ladder' }, world);
          svg.text(world, -half - 6, y, String(Math.abs(p)), 'ap-ladder-num', { 'text-anchor': 'end', 'dominant-baseline': 'central' });
          svg.text(world, half + 6, y, String(Math.abs(p)), 'ap-ladder-num', { 'text-anchor': 'start', 'dominant-baseline': 'central' });
        }
      }

      // bank ring: rotates with the world, 360 degrees, fixed index at the top
      const ring = svg.el('g', { class: 'ap-bankring' }, rollG);
      for (let a = 0; a < 360; a += 10) {
        const big = a % 30 === 0;
        svg.tick(ring, 0, 0, R - (big ? 16 : 9), R, a, 'ap-bank-tick' + (big ? ' ap-bank-tick-major' : ''));
      }
      [0, 90, 180, 270].forEach((a) => {
        const [x, y] = svg.polar(0, 0, R - 30, a);
        svg.text(ring, x, y, a === 0 ? '' : String(a > 180 ? 360 - a : a), 'ap-bank-num', {
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          transform: `rotate(${a} ${x} ${y})`,
        });
      });
      // horizon-edge fade so the ring stays legible over sky and ground
      svg.el('circle', { cx: 0, cy: 0, r: R - 0.5, class: 'ap-att-rim' }, clipped);

      // fixed overlay: aircraft symbol + roll index
      svg.el('polygon', { points: `-10,${-R} 10,${-R} 0,${-R + 22}`, class: 'ap-index' }, root);
      svg.el('path', { d: 'M-118 0H-52V13M118 0H52V13', class: 'ap-acft-wing' }, root);
      svg.el('path', { d: 'M-118 0H-52V13M118 0H52V13', class: 'ap-acft-wing-in' }, root);
      svg.el('circle', { cx: 0, cy: 0, r: 5.5, class: 'ap-acft-dot' }, root);
      svg.el('path', { d: 'M0 -5.5V-26', class: 'ap-acft-wing' }, root);
      svg.el('path', { d: 'M0 -5.5V-26', class: 'ap-acft-wing-in' }, root);

      // small digital readouts in the lower corners
      tPitch = svg.text(root, -150, 150, 'P  0°', 'ap-digital ap-digital-xs ap-att-read', { 'text-anchor': 'middle' });
      tRoll = svg.text(root, 150, 150, 'R  0°', 'ap-digital ap-digital-xs ap-att-read', { 'text-anchor': 'middle' });
      svg.el('circle', { cx: 0, cy: 0, r: R + 1, class: 'ap-bezel-inner' }, root);
    }

    function setText(el, key, str) {
      if (lastShown[key] !== str) {
        el.textContent = str;
        lastShown[key] = str;
      }
    }

    function update(state, dt) {
      const have = util.isNum(state.pitch) && util.isNum(state.roll);
      host.classList.toggle('nodata', !have);
      if (!have) return;

      // Detect the Euler flip at the vertical (see header comment, point 2).
      if (rawRoll !== null) {
        const dRoll = Math.abs(util.wrap180(state.roll - rawRoll));
        if (dRoll > 120 && Math.max(Math.abs(state.pitch), Math.abs(rawPitch)) > 70) {
          roll.snap(state.roll);
          pitch.snap(state.pitch);
        }
      }
      rawRoll = state.roll;
      rawPitch = state.pitch;

      roll.set(state.roll);
      pitch.set(state.pitch);
      roll.step(dt);
      pitch.step(dt);

      rollG.setAttribute('transform', `rotate(${(-roll.value).toFixed(2)})`);
      world.setAttribute('transform', `translate(0 ${(pitch.value * K).toFixed(2)})`);

      const p = Math.round(state.pitch);
      const r = Math.round(state.roll);
      setText(tPitch, 'p', `P ${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}°`);
      setText(tRoll, 'r', `R ${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}°`);
    }

    build();
    return { configure() {}, update };
  };
})(window);
