# AeroPanel – aerobatic WebPanel for FlightGear

A browser-based digital instrument panel for aerobatic gliders (MDM-1 Fox, Swift S-1 style),
meant to run on a second computer or tablet on your LAN. Pure HTML/CSS/JS + SVG, no build step,
no dependencies.

Instruments: **G-meter** (current + latched peak +/−, limit bands, over-G flash, reset), **attitude
indicator** (360° bank ring, full ±90° ladder, no tumbling over the top), **airspeed** (expanded
non-linear scale), **altimeter** (QNH setting), **slip/skid ball**, **variometer**, **heading rose**
(with reference bug), **energy widget** (ΔE since reference, total-energy rate).
Also: day/night, metric/imperial, aircraft profiles, connection status, built-in demo flight.

## Quick start

1. Start FlightGear with its HTTP server enabled:

   ```
   fgfs --aircraft=MDM-1 --httpd=5400
   ```
   (Any free port works. Open TCP 5400 in the firewall of the FlightGear machine.
   Check it works from the second machine: `http://FG_IP:5400/json/velocities/airspeed-kt`.)

2. On the panel machine open `index.html` directly (double-click) — it works from `file://`.
   Or serve the folder: `python3 -m http.server 8000` and browse to it.

3. Click ⚙ (or press `S`), enter the FlightGear machine's IP and port, **Save & reconnect**.
   Or use URL parameters: `index.html?host=192.168.1.20&port=5400&units=imperial&profile=mdm1`.

No FlightGear handy? Press **DEMO** (or `?demo=1`) for a scripted aerobatic flight, or run
`node tools/mock-fgfs-server.js` to emulate the HTTP server.

## Properties used

| Key | Property | Used for |
|---|---|---|
| ias | `/velocities/airspeed-kt` | airspeed, energy |
| alt | `/position/altitude-ft` | altimeter, energy |
| g | `/accelerations/pilot-g` | G-meter |
| pitch | `/orientation/pitch-deg` | attitude, compass hold |
| roll | `/orientation/roll-deg` | attitude |
| hdg | `/orientation/heading-deg` | compass |
| slip | `/instrumentation/slip-skid-ball/indicated-slip-skid` | ball (−1..1) |
| vsfps | `/velocities/vertical-speed-fps` | variometer, ×60 → fpm |
| qnh | `/environment/pressure-sea-level-inhg` | altimeter "SIM" QNH (polled slowly) |

Not every aircraft provides every property. Missing ones show as a ⚠ chip in the status bar
(hover for the list). Remap any of them in **Settings → Advanced → Property map**, e.g.
`{"slip": "/orientation/side-slip-deg", "g": "/accelerations/pilot-gdamped"}` (and set
*Slip full-scale* to ~10 for side-slip degrees). If level flight reads −1 G, tick *Invert G*.
The defaults live in `js/data/properties.js`.

## Controls

`R` reset peak G · `E` set energy reference · `H` heading bug · `↑/↓` QNH · `T` day/night ·
`U` units · `D` demo · `F` fullscreen · `S` settings. QNH buttons auto-repeat when held.
QNH is a panel-side setting (nothing is written to FlightGear): setting the sim's QNH
(**SIM**) reads true MSL altitude.

## Layout

```
index.html
css/panel.css             theme tokens (day/night) + all instrument styling
js/core/                  util (math, SVG, smoothing), settings, aircraft profiles
js/data/                  properties, http-source (polling), ws-source (experimental),
                          demo-source, manager (state + status)
js/instruments/           g-meter, attitude, airspeed, altimeter, slip-skid,
                          variometer, energy, compass   (one factory per file)
js/main.js                wiring, controls, render loop
tools/mock-fgfs-server.js fake FlightGear HTTP server for testing
```

Each instrument is `AeroPanel.instruments.name(host, ctx) → { configure(), update(state, dt) }`,
so any one can be replaced independently. Data sources share a tiny interface
(`start/stop`, `onValues`, `onStatus`), so a UDP→WebSocket bridge can be added as another source.

## Notes and limits

- **Update rate**: HTTP polling targets 20 Hz (5–60 in settings); the status bar shows the
  achieved rate. Needles are smoothed to display refresh between samples. Peak G is latched
  from raw samples, so a spike shorter than the sample interval can be missed — true for any
  polled panel. For best peak capture use a higher rate or the WebSocket transport.
- **WebSocket** (`/PropertyListener`) is experimental and untested against all FlightGear
  versions; HTTP polling is the reliable default.
- **Profiles** (`js/core/profiles.js`) hold G limits and speed arcs. Values are approximate
  (the Swift entry is a placeholder) — set them from your AFM/FDM.
- Energy uses indicated airspeed as a proxy for TAS; it is for comparing figures, not navigation.
- Heading is held while the nose is within ~10° of vertical, where FDM heading flips by 180°.
- Developed and verified against a mock server and the demo flight, not a live FlightGear session.
