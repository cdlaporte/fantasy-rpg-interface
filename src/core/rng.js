// Frozen. Seeded deterministic RNG (mulberry32). Never use Math.random in core/data.

export function createRng(seed = 1) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const rng = {
    seed: seed >>> 0,
    /** @returns {number} [0, 1) */
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** float in [a, b) */
    range(a, b) { return a + (b - a) * rng.next(); },
    /** integer in [a, b] inclusive */
    int(a, b) { return a + Math.floor(rng.next() * (b - a + 1)); },
    pick(arr) { return arr.length ? arr[Math.floor(rng.next() * arr.length)] : undefined; },
    chance(p) { return rng.next() < p; },
    /** independent child stream (e.g. per zone) */
    fork(salt = 0) { return createRng((Math.floor(rng.next() * 4294967296) ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0); },
    getState() { return s; },
    setState(v) { s = v >>> 0; },
  };
  return rng;
}

/** Stateless 2D integer hash -> 0..255 (deterministic decoration noise). */
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h & 255;
}

export default createRng;
