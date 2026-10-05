/**
 * Altimeter – three-hand style dial (one revolution = 1000 units) plus a
 * digital window and a Kollsman (QNH) window.
 *
 *   long hand   : 1000 units per revolution  (hundreds read off the dial)
 *   short hand  : 10000 units per revolution
 *   digital     : exact value, rounded to 10
 *
 * QNH is a PANEL-side setting (settings.qnh, hPa); nothing is written to
 * FlightGear. Indicated altitude =
 *       geometric altitude + (QNH_set - QNH_sim) * 27 ft/hPa
 * so setting the same QNH FlightGear is using reads the true MSL altitude,
 * exactly like a real altimeter. `QNH_sim` comes from
 * /environment/pressure-sea-level-inhg (falls back to ISA 1013.25).
 *
 * API: altimeter(host, { settings }) -> { configure(), update(state, dt),
 *        adjustQnh(steps), setQnh(hpa), qnhFromSim(), qnhStd() }
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const { svg, util } = AP;

  const C = 200;
  const FT_PER_HPA = 27;

  AP.instruments.altimeter = function altimeter(host, ctx) {
    let long, short, tAlt, tQnh, tUnit, u, lastAlt = '', lastQnh = '';
    let simQnhHpa = 1013.25;
    const alt = new util.Smooth(0.03, 0);

    function configure() {
      u = AP.units(ctx.settings.get().units);
      lastAlt = lastQnh = '';
      build();
    }

    function build() {
      const root = svg.root(host);
      root.setAttribute('class', 'ap-svg ap-alt');
      svg.dialFace(root, C, C, 190);

      for (let i = 0; i < 50; i++) {
        const a = i * 7.2;
        const major = i % 5 === 0;
        svg.tick(root, C, C, major ? 148 : 160, 172, a, major ? 'ap-tick ap-tick-major' : 'ap-tick');
        if (major) {
          const [x, y] = svg.polar(C, C, 126, a);
          svg.text(root, x, y, String(i / 5), 'ap-num ap-num-lg', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        }
      }

      // digital window
      svg.el('rect', { x: C - 70, y: 226, width: 140, height: 44, rx: 6, class: 'ap-window' }, root);
      tAlt = svg.text(root, C - 8, 249, '0', 'ap-digital ap-digital-lg', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      tUnit = svg.text(root, C + 52, 255, u.alt.label, 'ap-label ap-label-dim', { 'text-anchor': 'middle' });

      // Kollsman window
      svg.el('rect', { x: C - 60, y: 276, width: 120, height: 30, rx: 5, class: 'ap-window ap-window-sm' }, root);
      svg.text(root, C - 52, 296, 'QNH', 'ap-label ap-label-xs', { 'text-anchor': 'start' });
      tQnh = svg.text(root, C + 54, 291, '', 'ap-digital ap-digital-sm', { 'text-anchor': 'end', 'dominant-baseline': 'central' });

      short = svg.el('g', { class: 'ap-needle-g' }, root);
      svg.el('polygon', { points: `${C - 8},${C} ${C},${C - 88} ${C + 8},${C}`, class: 'ap-needle ap-needle-short' }, short);
      long = svg.el('g', { class: 'ap-needle-g' }, root);
      svg.el('polygon', { points: `${C - 5},${C + 30} ${C - 3},${C - 120} ${C},${C - 168} ${C + 3},${C - 120} ${C + 5},${C + 30}`, class: 'ap-needle' }, long);
      svg.el('circle', { cx: C, cy: C, r: 12, class: 'ap-hub' }, root);
      svg.el('circle', { cx: C, cy: C, r: 4, class: 'ap-hub-dot' }, root);
    }

    function qnhText() {
      const q = ctx.settings.get().qnh * u.press.fromHpa;
      return q.toFixed(u.press.digits);
    }

    function update(state, dt) {
      const have = util.isNum(state.alt);
      host.classList.toggle('nodata', !have);
      if (util.isNum(state.qnh)) simQnhHpa = state.qnh * util.INHG_TO_HPA;
      if (!have) return;

      const qnhSet = ctx.settings.get().qnh;
      const indicatedFt = state.alt + (qnhSet - simQnhHpa) * FT_PER_HPA;
      alt.set(indicatedFt * u.alt.fromFt);
      alt.step(dt);

      const v = alt.value;
      long.setAttribute('transform', `rotate(${(((v % 1000) + 1000) % 1000) * 0.36} ${C} ${C})`);
      short.setAttribute('transform', `rotate(${(((v % 10000) + 10000) % 10000) * 0.036} ${C} ${C})`);

      const txt = String(Math.round(indicatedFt * u.alt.fromFt / 10) * 10);
      if (txt !== lastAlt) {
        tAlt.textContent = txt;
        lastAlt = txt;
      }
      const q = qnhText();
      if (q !== lastQnh) {
        tQnh.textContent = q;
        lastQnh = q;
      }
    }

    /** One step = 1 hPa (metric) or 0.01 inHg (imperial). */
    function adjustQnh(steps) {
      const stepHpa = u.press.step / u.press.fromHpa;
      setQnh(ctx.settings.get().qnh + steps * stepHpa);
    }
    function setQnh(hpa) {
      ctx.settings.set({ qnh: Math.round(util.clamp(hpa, 900, 1100) * 100) / 100 });
    }

    configure();
    return {
      configure,
      update,
      adjustQnh,
      setQnh,
      qnhFromSim: () => setQnh(simQnhHpa),
      qnhStd: () => setQnh(1013.25),
    };
  };
})(window);
