/**
 * Slip/Skid ball in a curved tube. state.slip is already normalised to
 * -1..1 (full deflection) by the DataManager (scale + invert are settings).
 * Positive = ball to the right of centre.
 *
 * API: slipSkid(host) -> { configure(), update(state, dt) }
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const { svg, util } = AP;

  AP.instruments.slipSkid = function slipSkid(host) {
    let ball;
    const pos = new util.Smooth(0.04, 0);

    // tube is a shallow arc: ball x in [-130,130] follows y = sag(x)
    const X = 130;
    const sag = (x) => 10 * (x / X) * (x / X);

    function build() {
      const root = svg.root(host, '0 0 400 64');
      root.setAttribute('class', 'ap-svg ap-slip');
      svg.el('path', { d: `M30 ${22} Q200 ${34} 370 ${22} L370 ${48} Q200 ${60} 30 ${48} Z`, class: 'ap-tube' }, root);
      // fixed reference lines either side of the centred ball
      [-22, 22].forEach((dx) => {
        svg.el('line', { x1: 200 + dx, y1: 24, x2: 200 + dx, y2: 56, class: 'ap-slip-mark' }, root);
      });
      ball = svg.el('circle', { cx: 200, cy: 38, r: 15, class: 'ap-ball' }, root);
    }

    function update(state, dt) {
      const have = util.isNum(state.slip);
      host.classList.toggle('nodata', !have);
      if (!have) return;
      pos.set(state.slip);
      pos.step(dt);
      const x = util.clamp(pos.value, -1, 1) * X;
      ball.setAttribute('cx', (200 + x).toFixed(1));
      ball.setAttribute('cy', (37 + sag(x) * 0.8).toFixed(1));
    }

    build();
    return { configure() {}, update };
  };
})(window);
