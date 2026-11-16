// Geometry choices shared by the triangle generators (math coordinates, pure).
import { gcd } from './util.js';
import { triFromSides, minAngle, angleAt } from './svg.js';

export const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWYZ'.split('');   // no I, O or X (x is the unknown)

/** n distinct vertex letters. Sometimes consecutive (ABC / DEF) like the packet, sometimes scattered. */
export function pickLetters(rng, n) {
  if (rng.chance(0.3) && n <= 6) {
    const start = rng.int(0, LETTERS.length - n);
    return LETTERS.slice(start, start + n);
  }
  return rng.shuffle(LETTERS).slice(0, n);
}

/**
 * A scalene integer triangle with sides in [lo, hi], gcd 1, every angle in [minA, maxA] degrees.
 * Returns {sides: [a, b, c], pts: [A, B, C]} with a = BC, b = CA, c = AB.
 */
export function niceTriangle(rng, { lo = 3, hi = 12, minA = 30, maxA = 112, scalene = true } = {}) {
  for (let t = 0; t < 500; t++) {
    const a = rng.int(lo, hi), b = rng.int(lo, hi), c = rng.int(lo, hi);
    if (scalene && (a === b || b === c || a === c)) continue;
    if (gcd(gcd(a, b), c) !== 1) continue;
    if (a + b <= c || b + c <= a || a + c <= b) continue;
    const pts = triFromSides(a, b, c);
    const angs = [angleAt(pts[0], pts[1], pts[2]), angleAt(pts[1], pts[2], pts[0]), angleAt(pts[2], pts[0], pts[1])];
    if (minAngle(pts) < minA || Math.max(...angs) > maxA) continue;
    return { sides: [a, b, c], pts };
  }
  return { sides: [4, 5, 6], pts: triFromSides(4, 5, 6) };
}

/** Drawn size ratio for two similar figures: keeps bigger bigger but never tiny (roughly to scale). */
export function drawnRatio(k) {
  const big = k >= 1 ? k : 1 / k;
  const d = Math.min(1.75, Math.max(1.2, Math.pow(big, 0.6)));
  return k >= 1 ? d : 1 / d;
}

import { place, bbox } from './svg.js';

/**
 * Two triangles (base point lists) drawn in different orientations, the second scaled by k, laid out side by side
 * or stacked (whichever fits the card better). Returns [T1, T2] in math coordinates.
 */
export function layoutPair(rng, base1, base2, k = 1, { turn = true } = {}) {
  const a1 = (rng.range(-30, 30) * Math.PI) / 180;
  const a2 = turn ? a1 + (rng.sign() * rng.range(70, 190) * Math.PI) / 180 : a1 + (rng.range(-25, 25) * Math.PI) / 180;
  const T1 = place(base1, { angle: a1, mirror: rng.chance(0.25) });
  let T2 = place(base2, { angle: a2, mirror: turn && rng.chance(0.5), scale: k });
  const b1 = bbox(T1), b2 = bbox(T2);
  const fit = (w, h) => Math.min(332 / w, 162 / h);
  const gap = 0.3 * Math.max(b1.w, b1.h, b2.w, b2.h);
  const side = fit(b1.w + gap + b2.w, Math.max(b1.h, b2.h));
  const stack = fit(Math.max(b1.w, b2.w), b1.h + gap + b2.h);
  let dx, dy;
  if (side >= stack * 0.9) { dx = b1.x1 + gap - b2.x0; dy = (b1.y0 + b1.y1) / 2 - (b2.y0 + b2.y1) / 2; }
  else { dy = b1.y0 - gap - b2.y1; dx = (b1.x0 + b1.x1) / 2 - (b2.x0 + b2.x1) / 2 + rng.range(-0.2, 0.2) * b1.w; }
  T2 = T2.map((p) => [p[0] + dx, p[1] + dy]);
  return [T1, T2];
}

/** The three angles (degrees) of a triangle, at vertices 0, 1, 2. */
export function anglesOf(t) {
  const { angleAt: A } = SVG;
  return [A(t[0], t[1], t[2]), A(t[1], t[2], t[0]), A(t[2], t[0], t[1])];
}
import * as SVG from './svg.js';

/** true when the two drawn triangles have the same angles (within tol degrees), i.e. really are similar. */
export function shapesSimilar(t1, t2, tol = 0.5) {
  const a = anglesOf(t1).sort((x, y) => x - y), b = anglesOf(t2).sort((x, y) => x - y);
  return a.every((v, i) => Math.abs(v - b[i]) <= tol);
}
/** Largest difference between the sorted angle lists. */
export function shapeGap(t1, t2) {
  const a = anglesOf(t1).sort((x, y) => x - y), b = anglesOf(t2).sort((x, y) => x - y);
  return Math.max(...a.map((v, i) => Math.abs(v - b[i])));
}
