(function () {
  'use strict';
  const CP = (globalThis.CP = globalThis.CP || {});

  CP.VERSION = '1.0.0';

  CP.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  CP.lerp = (a, b, t) => a + (b - a) * t;

  // mulberry32: small, fast, deterministic.
  CP.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  CP.pick = (rng, arr) => arr[(rng() * arr.length) | 0];
  CP.fmt = (n) => Math.floor(n).toLocaleString('en-US');
  CP.esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
})();
