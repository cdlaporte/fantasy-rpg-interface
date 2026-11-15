// Color helpers for the 2D renderer: hex parsing, mixing, SNES-style hue-shifted shading.
// Results are memoized (string keys), so calling these while building sprites is cheap.

const rgbCache = new Map();

/** '#rrggbb' (or '#rgb') -> [r, g, b]; invalid -> magenta-ish fallback. */
export function rgb(hex) {
  let v = rgbCache.get(hex);
  if (v) return v;
  let s = typeof hex === 'string' ? hex.trim() : '';
  if (s[0] === '#') s = s.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length === 8) s = s.slice(0, 6);
  const n = /^[0-9a-fA-F]{6}$/.test(s) ? parseInt(s, 16) : 0xff00ff;
  v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  rgbCache.set(hex, v);
  return v;
}

const h2 = (n) => (n < 16 ? '0' : '') + n.toString(16);
export function hex(r, g, b) {
  return '#' + h2(Math.max(0, Math.min(255, Math.round(r)))) + h2(Math.max(0, Math.min(255, Math.round(g)))) +
    h2(Math.max(0, Math.min(255, Math.round(b))));
}

const mixCache = new Map();
/** Linear mix of two hex colors, t in 0..1. */
export function mix(a, b, t) {
  const k = a + b + t;
  let v = mixCache.get(k);
  if (v) return v;
  const x = rgb(a), y = rgb(b);
  v = hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  mixCache.set(k, v);
  return v;
}

// Shadows lean cool/purple, highlights lean warm/cream: the classic SNES ramp look.
const SHADOW = '#2a1c46';
const LIGHT = '#fff7dc';
/** Darker tone (t ~0.2 .. 0.6). */
export const dark = (c, t = 0.3) => mix(c, SHADOW, t);
/** Lighter tone (t ~0.2 .. 0.6). */
export const light = (c, t = 0.3) => mix(c, LIGHT, t);

/** Perceived luminance 0..1. */
export function lum(c) {
  const v = rgb(c);
  return (v[0] * 0.299 + v[1] * 0.587 + v[2] * 0.114) / 255;
}

/** 'rgba(r,g,b,a)' string (for canvas fills; memoized). */
const rgbaCache = new Map();
export function rgba(c, a) {
  const k = c + a;
  let v = rgbaCache.get(k);
  if (v) return v;
  const x = rgb(c);
  v = `rgba(${x[0]},${x[1]},${x[2]},${a})`;
  rgbaCache.set(k, v);
  return v;
}

/** Is this a valid '#rrggbb' string? */
export const isHex = (c) => typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c);

/** Pick a valid color or the fallback. */
export const col = (c, fb) => (isHex(c) ? c : fb);

export const OUTLINE = '#1e1a22';
