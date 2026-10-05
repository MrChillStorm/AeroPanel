/**
 * Aircraft profiles: G limits and airspeed markings.
 *
 * All speeds are knots. G limits are load factors (positive / negative).
 *
 * IMPORTANT: these numbers are sensible approximations for a panel, NOT
 * flight-manual data. Check them against the AFM / the FlightGear FDM you fly
 * and edit them here. `asi.stops` defines the expanded (non-linear) airspeed
 * scale: [knots, fraction of the 270 deg sweep]. Slope is steepest in the
 * speed band where you actually fly figures.
 */
(function (global) {
  'use strict';
  const AP = global.AeroPanel;

  const stopsDefault = [
    [0, 0.0],
    [30, 0.06],
    [50, 0.2],
    [110, 0.8],
    [150, 1.0],
  ];

  AP.profiles = {
    'generic-unl': {
      name: 'Generic Unlimited (+9 / −6 G)',
      gPos: 9,
      gNeg: -6,
      asi: { vs: 48, va: 110, vne: 145, stops: stopsDefault },
    },
    'generic-adv': {
      name: 'Generic Advanced (+7 / −5 G)',
      gPos: 7,
      gNeg: -5,
      asi: { vs: 45, va: 100, vne: 140, stops: stopsDefault },
    },
    'mdm1': {
      name: 'MDM-1 Fox (approx.)',
      gPos: 7,
      gNeg: -5,
      asi: { vs: 44, va: 97, vne: 135, stops: stopsDefault },
    },
    'swift': {
      name: 'Swift S-1 (placeholder values)',
      gPos: 7,
      gNeg: -5,
      asi: { vs: 45, va: 100, vne: 140, stops: stopsDefault },
    },
  };

  AP.getProfile = (id) => AP.profiles[id] || AP.profiles['generic-unl'];
})(window);
