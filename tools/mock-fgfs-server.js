#!/usr/bin/env node
/**
 * Minimal stand-in for FlightGear's built-in HTTP server, for testing the
 * panel's polling path without the simulator:
 *
 *   node tools/mock-fgfs-server.js [port]        (default 5400)
 *
 * Serves GET /json/<property-path> -> { path, name, value, type } with CORS
 * enabled, like fgfs --httpd=PORT. Values swing around slowly so every
 * instrument moves. Properties not in the table return 404 (like a property
 * the aircraft does not have), which exercises the "property missing" chip.
 */
const http = require('http');
const port = parseInt(process.argv[2], 10) || 5400;
const t0 = Date.now();

const props = {
  '/velocities/airspeed-kt': (t) => 90 + 35 * Math.sin(t / 4),
  '/position/altitude-ft': (t) => 3500 + 600 * Math.sin(t / 7),
  '/accelerations/pilot-g': (t) => 1 + 3.5 * Math.sin(t / 3) * Math.abs(Math.sin(t / 9)),
  '/orientation/pitch-deg': (t) => 40 * Math.sin(t / 3),
  '/orientation/roll-deg': (t) => ((t * 40) % 360) - 180,
  '/orientation/heading-deg': (t) => (90 + t * 8) % 360,
  '/instrumentation/slip-skid-ball/indicated-slip-skid': (t) => 0.4 * Math.sin(t),
  '/velocities/vertical-speed-fps': (t) => 25 * Math.cos(t / 3),
  // '/environment/pressure-sea-level-inhg' intentionally omitted -> 404
};

http
  .createServer((req, res) => {
    const m = /^\/json(\/.*?)(\?.*)?$/.exec(req.url);
    const fn = m && props[m[1]];
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (!fn) {
      res.statusCode = 404;
      return res.end('{}');
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ path: m[1], name: m[1].split('/').pop(), type: 'double', value: fn((Date.now() - t0) / 1000) }));
  })
  .listen(port, () => console.log(`mock FlightGear httpd on :${port}`));
