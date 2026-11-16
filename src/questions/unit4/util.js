// Number and algebra formatting shared by the Unit 4 generators. Pure (no DOM).
// Display text uses the true minus sign (U+2212) like a printed worksheet; the answer parser accepts both.

export const MINUS = '−';
export const TIMES = '·';
export const SIM = '∼';      // the "is similar to" tilde
export const TRI = 'Δ';      // the triangle symbol used in the packet (ΔABC)
export const DEG = '°';
export const ANG = '∠';      // angle symbol
export const PARALLEL = '∥';

export function gcd(a, b) {
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

/** true for integers and halves (the "clean" answers every generator aims for). */
export function isClean(v) {
  return Number.isFinite(v) && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
}

/** 12 -> "12", -3 -> "−3", 10.5 -> "10.5", 2.25 -> "2.25". */
export function num(v) {
  const r = Math.round(v * 1000) / 1000;
  const s = String(Math.abs(r));
  return (r < 0 ? MINUS : '') + s;
}

/** Plain ASCII number (for answers students would type). */
export function asciiNum(v) {
  const r = Math.round(v * 1000) / 1000;
  return String(r);
}

/** k x + h as text: lin(3, -9) -> "3x − 9", lin(1, 6) -> "x + 6", lin(0, 5) -> "5". */
export function lin(k, h = 0, v = 'x') {
  if (k < 0 && h > 0) return `${num(h)} ${MINUS} ${k === -1 ? v : num(-k) + v}`;   // 40 − x
  let s = '';
  if (k === 1) s = v;
  else if (k === -1) s = MINUS + v;
  else if (k !== 0) s = num(k) + v;
  if (h > 0) s = s ? `${s} + ${num(h)}` : num(h);
  else if (h < 0) s = s ? `${s} ${MINUS} ${num(-h)}` : num(h);
  return s || '0';
}

/** "c(kx + h)" or "c · n" for display of a cross product factor. */
export function times(c, k, h) {
  if (k === 0) return `${num(c)} ${TIMES} ${num(h)}`;
  if (h === 0) return k === 1 ? `${num(c)}x` : `${num(c)}(${lin(k, 0)})`;
  return `${num(c)}(${lin(k, h)})`;
}

/** n/d reduced (d > 0) -> {n, d}. */
export function reduce(n, d) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

/** "21/2" (ASCII slash) or "10" when whole. */
export function fracText(n, d) {
  const r = reduce(n, d);
  return r.d === 1 ? num(r.n) : `${num(r.n)}/${r.d}`;
}

/** Value of a/b as a short decimal if it terminates within 3 places, else null. */
export function decimalOf(n, d) {
  const v = n / d;
  return Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-9 ? v : null;
}

/**
 * Steps to solve  L = R  where L = a x + b and R = c x + d (already distributed). Returns {x, steps}.
 * The x terms are collected on the side where the coefficient stays positive.
 */
export function solveLinear(a, b, c, d) {
  const steps = [];
  let k, rhs;
  if (a - c > 0) { k = a - c; rhs = d - b; }
  else { k = c - a; rhs = b - d; }
  if (k === 0) return { x: NaN, steps };
  if (a !== 0 && c !== 0) {
    steps.push(`${lin(k, 0)} = ${num(rhs)}`);
  } else if (b !== 0 || d !== 0) {
    // one side has no x: just isolate it
    const xs = a !== 0 ? { k: a, h: b, other: d } : { k: c, h: d, other: b };
    if (xs.h !== 0) steps.push(`${lin(xs.k, 0)} = ${num(xs.other)} ${xs.h > 0 ? MINUS : '+'} ${num(Math.abs(xs.h))}`);
    k = xs.k; rhs = xs.other - xs.h;
    if (k < 0) { k = -k; rhs = -rhs; }
    if (xs.h !== 0) steps.push(`${lin(k, 0)} = ${num(rhs)}`);
  }
  const x = rhs / k;
  if (k !== 1) {
    const r = reduce(rhs, k);
    if (r.d === 1) steps.push(`x = ${num(rhs)} ÷ ${num(k)} = ${num(x)}`);
    else steps.push(`x = ${num(rhs)}/${num(k)} = ${num(x)}`);
  } else if (steps.length === 0 || !/^x = /.test(steps[steps.length - 1])) {
    steps.push(`x = ${num(x)}`);
  }
  return { x, steps };
}

/** Choose an expression kx + h (k in ks) equal to `value` for some clean integer x >= minX. Returns null if none. */
export function exprFor(rng, value, { ks = [1, 2, 3], minX = 2, maxAbsH = 20, allowZeroH = false } = {}) {
  const opts = [];
  for (const k of ks) {
    for (let x = minX; k * x <= value + maxAbsH; x++) {
      const h = value - k * x;
      if (!allowZeroH && h === 0) continue;
      if (Math.abs(h) > maxAbsH) continue;
      if (k === 1 && h < 0 && x + h <= 0) continue;
      opts.push({ k, h, x });
    }
  }
  if (!opts.length) return null;
  return rng.pick(opts);
}
