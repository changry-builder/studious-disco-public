(function (root) {
  const WTE = (root.WTE = root.WTE || {});

  /** Seeded PRNG: returns () => float in [0, 1). */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Fisher-Yates; returns a new array, input untouched. */
  function shuffle(array, seed) {
    const out = Array.prototype.slice.call(array);
    const rnd = mulberry32(seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function pick(array, seed) {
    if (!array || array.length === 0) return undefined;
    return array[Math.floor(mulberry32(seed)() * array.length)];
  }

  /** FNV-1a 32-bit over UTF-16 code units. */
  function hashSeed(str) {
    const s = String(str);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  WTE.Rng = { mulberry32, shuffle, pick, hashSeed };

  if (typeof module !== "undefined") module.exports = WTE.Rng;
})(typeof window !== "undefined" ? window : globalThis);
