// Frozen. Small pure math helpers. Angles: radians, 0 = east, clockwise on screen.
import { DIR } from '../contracts.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
export const smoothstep = (a, b, v) => { const t = clamp01(invLerp(a, b, v)); return t * t * (3 - 2 * t); };
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const len = (x, y) => Math.sqrt(x * x + y * y);
/** Move `cur` toward `target` by at most `delta`. */
export const approach = (cur, target, delta) => (cur < target ? Math.min(cur + delta, target) : Math.max(cur - delta, target));
/** Exponential decay factor for smoothing, framerate independent: lerp(a, b, damp(rate, dt)). */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
/** Wrap to (-PI, PI]. */
export const wrapAngle = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a <= -Math.PI) a += TAU; return a; };
/** Signed smallest difference b - a. */
export const angleDiff = (a, b) => wrapAngle(b - a);
export const lerpAngle = (a, b, t) => a + angleDiff(a, b) * t;

/** Facing DIR from a vector (dominant axis; ties favor horizontal). Zero vector -> DIR.DOWN. */
export function dirFromVec(dx, dy) {
  if (dx === 0 && dy === 0) return DIR.DOWN;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? DIR.RIGHT : DIR.LEFT;
  return dy > 0 ? DIR.DOWN : DIR.UP;
}
export const dirFromAngle = (a) => dirFromVec(Math.cos(a), Math.sin(a));
/** Angle for a DIR: UP -PI/2, RIGHT 0, DOWN PI/2, LEFT PI. */
export const angleFromDir = (d) => [-Math.PI / 2, 0, Math.PI / 2, Math.PI][d & 3];

/** Normalize (x, y) into out[0], out[1]; returns length. */
export function normalize(x, y, out) {
  const l = Math.sqrt(x * x + y * y);
  if (l > 0) { out[0] = x / l; out[1] = y / l; } else { out[0] = 0; out[1] = 0; }
  return l;
}

export const inRect = (x, y, rx, ry, rw, rh) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;
/** Is (x,y) within the cone at (ox,oy) facing `angle` with full arc `arcDeg` and range r. */
export function inArc(ox, oy, angle, arcDeg, r, x, y) {
  if (dist2(ox, oy, x, y) > r * r) return false;
  return Math.abs(angleDiff(angle, angleTo(ox, oy, x, y))) <= (arcDeg * DEG) / 2;
}
