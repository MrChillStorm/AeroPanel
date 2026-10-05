/**
 * The FlightGear properties the panel reads.
 *
 * `key`  – internal name used throughout the app
 * `path` – property-tree path (override per key in Settings -> Advanced)
 * `rate` – 'fast' = every poll cycle, 'slow' = every ~25th cycle
 *
 * Native FlightGear units are kept in state:
 *   ias kt | alt ft | g load factor | pitch/roll/hdg deg | slip (ball) -1..1
 *   vsfps ft/s | qnh inHg
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;

  AP.data.PROPS = [
    { key: 'ias',   path: '/velocities/airspeed-kt',                               rate: 'fast' },
    { key: 'alt',   path: '/position/altitude-ft',                                 rate: 'fast' },
    { key: 'g',     path: '/accelerations/pilot-g',                                rate: 'fast' },
    { key: 'pitch', path: '/orientation/pitch-deg',                                rate: 'fast' },
    { key: 'roll',  path: '/orientation/roll-deg',                                 rate: 'fast' },
    { key: 'hdg',   path: '/orientation/heading-deg',                              rate: 'fast' },
    { key: 'slip',  path: '/instrumentation/slip-skid-ball/indicated-slip-skid',   rate: 'fast' },
    { key: 'vsfps', path: '/velocities/vertical-speed-fps',                        rate: 'fast' },
    { key: 'qnh',   path: '/environment/pressure-sea-level-inhg',                  rate: 'slow' },
  ];

  /** Effective property list after applying user overrides. */
  AP.data.resolveProps = (overrides) =>
    AP.data.PROPS.map((p) => ({
      key: p.key,
      path: (overrides && overrides[p.key]) || p.path,
      rate: p.rate,
    }));
})(window);
