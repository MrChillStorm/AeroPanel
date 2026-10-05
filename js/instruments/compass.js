/**
 * Heading / compass rose with a reference-heading bug.
 *
 * The bug is a panel-side marker for the box axis / a figure's line: press
 * "SET REF" to drop it on the current heading (and a second time to clear).
 * The digital window shows the signed deviation from the bug.
 *
 * Like a real gyro compass the heading is HELD while the nose is within ~10
 * deg of vertical, where FDM heading flips by 180 degrees.
 *
 * API: compass(host) -> { configure(), update(state, dt), toggleRef(), hasRef() }
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const { svg, util } = AP;

  const C = 200;

  AP.instruments.compass = function compass(host) {
    let rose, bug, tHdg, tDev, lastText = '';
    const hdg = new util.SmoothAngle(0.05, 0);
    let ref = null;
    let held = 0;
    let curHdg = 0;

    function build() {
      const root = svg.root(host);
      root.setAttribute('class', 'ap-svg ap-compass');
      svg.dialFace(root, C, C, 190);

      rose = svg.el('g', { class: 'ap-rose' }, root);
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      for (let a = 0; a < 360; a += 5) {
        const big = a % 10 === 0;
        svg.tick(rose, C, C, big ? 156 : 164, 176, a, big ? 'ap-tick ap-tick-major' : 'ap-tick');
        if (a % 30 === 0) {
          const [x, y] = svg.polar(C, C, 132, a);
          const label = names[a] !== undefined ? names[a] : String(a / 10);
          svg.text(rose, x, y, label, 'ap-num ap-num-md' + (a === 0 ? ' ap-num-accent' : ''), {
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            transform: `rotate(${a} ${x} ${y})`,
          });
        }
      }
      bug = svg.el('polygon', { points: `${C - 11},${C - 188} ${C + 11},${C - 188} ${C + 11},${C - 174} ${C},${C - 160} ${C - 11},${C - 174}`, class: 'ap-bug', visibility: 'hidden' }, rose);

      // fixed: lubber line, aircraft symbol, readout
      svg.el('polygon', { points: `${C - 11},${C - 196} ${C + 11},${C - 196} ${C},${C - 172}`, class: 'ap-index' }, root);
      svg.el('path', { d: `M${C} ${C - 52}V${C + 46}M${C - 46} ${C + 6}H${C + 46}M${C - 16} ${C + 40}H${C + 16}`, class: 'ap-acft-sym' }, root);
      svg.el('rect', { x: C - 52, y: 262, width: 104, height: 48, rx: 6, class: 'ap-window' }, root);
      tHdg = svg.text(root, C, 286, '000', 'ap-digital ap-digital-lg', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      tDev = svg.text(root, C, 336, '', 'ap-digital ap-digital-sm ap-peak-pos', { 'text-anchor': 'middle' });
    }

    function update(state, dt) {
      const have = util.isNum(state.hdg);
      host.classList.toggle('nodata', !have);
      if (!have) return;

      if (util.isNum(state.pitch) && Math.abs(state.pitch) > 80) held = 1;
      else if (!util.isNum(state.pitch) || Math.abs(state.pitch) < 70) held = 0;
      if (!held) {
        hdg.set(state.hdg);
        curHdg = state.hdg;
      }
      hdg.step(dt);
      rose.setAttribute('transform', `rotate(${(-hdg.value).toFixed(2)} ${C} ${C})`);

      const txt = String(Math.round(util.wrap360(curHdg)) % 360).padStart(3, '0');
      if (txt !== lastText) {
        tHdg.textContent = txt;
        lastText = txt;
      }
      if (ref !== null) {
        const dev = Math.round(util.wrap180(curHdg - ref));
        tDev.textContent = `REF ${String(Math.round(ref) % 360).padStart(3, '0')}  ${dev > 0 ? '+' : dev < 0 ? '−' : ''}${Math.abs(dev)}°`;
      } else if (tDev.textContent) {
        tDev.textContent = '';
      }
    }

    function toggleRef() {
      if (ref === null) {
        ref = util.wrap360(curHdg);
        bug.setAttribute('transform', `rotate(${ref} ${C} ${C})`);
        bug.setAttribute('visibility', 'visible');
      } else {
        ref = null;
        bug.setAttribute('visibility', 'hidden');
      }
      return ref !== null;
    }

    build();
    return { configure() {}, update, toggleRef, hasRef: () => ref !== null };
  };
})(window);
