/**
 * Demo source: a small scripted aerobatic flight, so the panel can be tried
 * (and every instrument exercised) without FlightGear.
 *
 * It is a point-mass + rigid-body-rotation toy, not a flight model:
 *   - attitude is a quaternion integrated from body rates p/q/r, so Euler
 *     pitch/roll/heading flip at the vertical exactly like a real FDM does
 *     (a good stress test for the attitude indicator),
 *   - speed follows energy (gravity along the nose + drag),
 *   - pilot G = V*q/g + cos(pitch)cos(roll).
 * A little "thrust" keeps the demo from running out of altitude.
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;
  const { wrap180, clamp } = AP.util;
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const G = 9.80665;

  class DemoSource {
    constructor(o) {
      this.o = o;
      this.timer = null;
      this.stamps = [];
    }

    start() {
      // state
      const psi = 90 * D2R;
      this.q = { w: Math.cos(psi / 2), x: 0, y: 0, z: Math.sin(psi / 2) };
      this.V = 52; // m/s
      this.h = 1100; // m
      this.t = 0;
      this.step = 0;
      this.stepT = 0;
      this.acc = 0; // accumulated rotation within the current step
      this.last = performance.now();
      this.nz = 1;
      this.rates = { p: 0, q: 0, r: 0 };
      this.script = this.buildScript();
      this.timer = setInterval(() => this.tick(), 1000 / 30);
      this.o.onStatus({ mode: 'demo', message: 'Built-in demo flight', hz: 30 });
    }

    stop() {
      clearInterval(this.timer);
    }

    /* --- maneuver script ------------------------------------------------ */

    /** Simple attitude hold for the "flat" parts. */
    hold(S, pitchTarget, rollTarget) {
      const inv = Math.cos(S.roll * D2R) < 0 ? -1 : 1; // elevator sense flips inverted
      return {
        p: clamp(-2.5 * wrap180(S.roll - rollTarget) * D2R, -1.6, 1.6),
        q: clamp(-2.5 * (S.pitch - pitchTarget) * D2R * inv, -0.35, 0.35),
        r: 0,
      };
    }

    buildScript() {
      const pull = (nAdd) => (S) => ({ p: 0, q: (nAdd * G) / S.V, r: 0 });
      const level = (dur) => ({
        cmd: (S) => this.hold(S, 0, 0),
        done: (S) => S.stepT > dur,
      });
      const dive = (v) => ({
        cmd: (S) => this.hold(S, -22, 0),
        done: (S) => S.V >= v,
      });
      return [
        { // climb back up with a bit of "thrust" if we are low
          boost: (S) => (S.h < 1000 ? 1.6 : 0.35),
          cmd: (S) => this.hold(S, S.h < 1000 ? 6 : 0, 0),
          done: (S) => S.stepT > 3 && S.h > 1050,
        },
        dive(66),
        { name: 'loop', cmd: pull(4.5), done: (S) => S.acc >= 2 * Math.PI, acc: 'q' },
        level(2),
        dive(64),
        { name: 'roll', cmd: () => ({ p: 2.2, q: 0, r: 0 }), done: (S) => S.acc >= 2 * Math.PI, acc: 'p' },
        level(1.5),
        { // roll inverted, fly inverted a while (steady -1 G)
          name: 'to-inverted',
          cmd: (S) => ({ p: clamp(1.5 * wrap180(180 - S.roll) * D2R * 2, -1.8, 1.8), q: 0, r: 0 }),
          done: (S) => Math.abs(wrap180(S.roll - 180)) < 4,
        },
        {
          name: 'inverted',
          cmd: (S) => this.hold(S, 0, 180),
          done: (S) => S.stepT > 3.5,
        },
        {
          name: 'from-inverted',
          cmd: (S) => ({ p: clamp(-1.5 * wrap180(S.roll) * D2R * 2, -1.8, 1.8), q: 0, r: 0 }),
          done: (S) => Math.abs(wrap180(S.roll)) < 4,
        },
        level(2),
        { // push through to negative G, then recover
          name: 'push',
          cmd: () => ({ p: 0, q: -0.65, r: 0 }),
          done: (S) => S.pitch < -32,
        },
        { name: 'recover', cmd: pull(4), done: (S) => S.pitch > -3 },
        level(2),
        dive(66),
        // Hammerhead: pull to vertical, climb, pivot, dive, pull out
        { name: 'vertical-pull', cmd: pull(6), done: (S) => S.pitch >= 85 || S.acc >= 1.55, acc: 'q' },
        { name: 'vertical-up', cmd: () => ({ p: 0, q: 0, r: 0 }), done: (S) => S.V < 20 },
        { name: 'pivot', cmd: () => ({ p: 0, q: 0, r: 1.5 }), done: (S) => S.acc >= Math.PI, acc: 'r' },
        { name: 'vertical-down', cmd: () => ({ p: 0, q: 0, r: 0 }), done: (S) => S.V > 52 },
        { name: 'pullout', cmd: pull(4.5), done: (S) => S.pitch > -3 && S.stepT > 1 },
        level(2.5),
      ];
    }

    /* --- integration ---------------------------------------------------- */

    tick() {
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.stepT += dt;

      // sub-step the integration so fast rotations stay accurate
      const sub = 4;
      for (let i = 0; i < sub; i++) this.integrate(dt / sub);

      const e = this.euler();
      const slip = 0.04 * Math.sin(this.t * 1.7) + this.rates.r * 0.12;

      this.o.onValues({
        ias: this.V / 0.514444,
        alt: this.h / 0.3048,
        g: this.nz,
        pitch: e.pitch,
        roll: e.roll,
        hdg: (e.yaw + 360) % 360,
        slip: clamp(slip, -1, 1),
        vsfps: this.vz / 0.3048,
        qnh: 29.92,
      });

      const t = performance.now();
      this.stamps.push(t);
      while (this.stamps.length && t - this.stamps[0] > 1000) this.stamps.shift();
      this.o.onStatus({ mode: 'demo', hz: this.stamps.length, message: 'Built-in demo flight' });
    }

    integrate(dt) {
      const e = this.euler();
      const S = { pitch: e.pitch, roll: e.roll, V: this.V, h: this.h, stepT: this.stepT, acc: this.acc };
      const step = this.script[this.step];

      if (step.done(S)) {
        this.step = (this.step + 1) % this.script.length;
        this.stepT = 0;
        this.acc = 0;
        return;
      }

      const c = step.cmd(S);
      this.rates = c;
      if (step.acc) this.acc += Math.abs(c[step.acc]) * dt;

      // quaternion integration: q' = 0.5 * q (x) (0, p, q, r)
      const { w, x, y, z } = this.q;
      const p = c.p, qq = c.q, r = c.r;
      const dw = 0.5 * (-x * p - y * qq - z * r);
      const dx = 0.5 * (w * p + y * r - z * qq);
      const dy = 0.5 * (w * qq - x * r + z * p);
      const dz = 0.5 * (w * r + x * qq - y * p);
      let nw = w + dw * dt, nx = x + dx * dt, ny = y + dy * dt, nz = z + dz * dt;
      const n = Math.hypot(nw, nx, ny, nz);
      this.q = { w: nw / n, x: nx / n, y: ny / n, z: nz / n };

      // speed from energy: gravity along the nose, drag, demo thrust
      const sinTheta = Math.sin(e.pitch * D2R);
      const load = (this.V * qq) / G + Math.cos(e.pitch * D2R) * Math.cos(e.roll * D2R);
      const boost = step.boost ? step.boost(S) : 0.35;
      const drag = 1.1e-4 * this.V * this.V * (1 + 0.04 * (load - 1) * (load - 1));
      this.V = clamp(this.V + (-G * sinTheta - drag + boost) * dt, 9, 95);
      this.vz = this.V * sinTheta;
      this.h = Math.max(150, this.h + this.vz * dt);
      this.nz = load;
    }

    euler() {
      const { w, x, y, z } = this.q;
      return {
        roll: Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * R2D,
        pitch: Math.asin(clamp(2 * (w * y - z * x), -1, 1)) * R2D,
        yaw: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * R2D,
      };
    }
  }

  AP.data.DemoSource = DemoSource;
})(window);
