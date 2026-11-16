// Day 1: solve a proportion with the Cross Product Property (typed number). The proportion is drawn as stacked
// fractions (figure). Difficulty 1: 4/x = 2/7, 9/16 = x/12. 2: (x − 3)/18 = 12/9, 7/11 = 18/(x + 1), (3x − 4)/14 = 9/10.
// 3: (x − 16)/(x + 6) = 3/5, 6/(x + 16) = 7/(3x + 3), (x − 9)/15 = (2x − 9)/10. Answers are integers or halves.
import { numberQuestion, attempt, crossSolve } from './common.js';
import { lin, num, isClean, gcd } from './util.js';
import { equationSvg } from './svg.js';

const TOPIC = 'proportion';

// A term is {k, h}: k x + h (k = 0 for a number).
const T = (k, h) => ({ k, h });
const txt = (t) => lin(t.k, t.h);
const val = (t, x) => t.k * x + t.h;

function build(rng, left, right, x) {
  // left = [n1, d1], right = [n2, d2]
  const [n1, d1] = left, [n2, d2] = right;
  // sanity: no zero denominators at the answer, and the proportion really holds
  if (val(d1, x) === 0 || val(d2, x) === 0) return null;
  if (Math.abs(val(n1, x) * val(d2, x) - val(d1, x) * val(n2, x)) > 1e-9) return null;
  const res = crossSolve(n1, d1, n2, d2);
  if (!res || Math.abs(res.x - x) > 1e-9) return null;
  const steps = res.steps.slice();
  steps[0] = steps[0].replace('Cross multiply', 'Cross Product Property');
  const fig = equationSvg([txt(n1), txt(d1)], [txt(n2), txt(d2)]);
  return { fig, steps, left, right, x };
}

function easy(rng) {
  return attempt(() => {
    // the known fraction is (p m)/(q m); the unknown one is x/(q t) or (p t)/x, so x = p t or q t
    const p = rng.int(1, 9), q = rng.int(1, 12);
    if (p === q || gcd(p, q) !== 1) return null;
    const m = rng.pick([1, 1, 2, 3]), t = rng.int(1, 9);
    if (m === t || p * m > 60 || q * m > 60) return null;
    const known = [T(0, p * m), T(0, q * m)];
    let unk, x;
    if (rng.chance(0.5)) { unk = [T(1, 0), T(0, q * t)]; x = p * t; }
    else { unk = [T(0, p * t), T(1, 0)]; x = q * t; }
    if (x > 120) return null;
    const [L, R] = rng.chance(0.5) ? [unk, known] : [known, unk];
    return build(rng, L, R, x);
  }, () => build(rng, [T(0, 4), T(1, 0)], [T(0, 2), T(0, 7)], 14));
}

function medium(rng) {
  return attempt(() => {
    const x = rng.int(2, 30);
    const k = rng.pick([1, 1, 1, 2, 3]);
    const h = rng.int(-15, 15);
    if (h === 0) return null;
    const v = k * x + h;                     // value of the x term
    if (v <= 0 || v > 90) return null;
    // the x term sits over (or under) a number c; the other fraction equals v / c, shown unsimplified sometimes
    const c = rng.int(2, 24);
    if (c === v) return null;
    const g = gcd(v, c);
    const p = v / g, q = c / g;
    const m = rng.pick([1, 1, 1, 2, 3]);
    if (p * m > 40 || q * m > 40) return null;
    if (p * m === v && q * m === c) return null;    // would show the same fraction twice
    const xt = T(k, h);
    const xFrac = rng.chance(0.6) ? [xt, T(0, c)] : [T(0, c), xt];
    const known = xFrac[0] === xt ? [T(0, p * m), T(0, q * m)] : [T(0, q * m), T(0, p * m)];
    const sides = rng.chance(0.5) ? [xFrac, known] : [known, xFrac];
    return build(rng, sides[0], sides[1], x);
  }, () => build(rng, [T(1, -3), T(0, 18)], [T(0, 12), T(0, 9)], 27));
}

function hard(rng) {
  return attempt(() => {
    const x = rng.int(1, 30);
    const form = rng.pick(['xx_over', 'num_over_x', 'x_over_num']);
    const t1 = T(rng.pick([1, 1, 2, 3]), rng.int(-18, 18));
    const t2 = T(rng.pick([1, 1, 2, 3]), rng.int(-18, 18));
    const v1 = val(t1, x), v2 = val(t2, x);
    if (v1 <= 0 || v2 <= 0 || v1 === v2 || t1.h === 0 || t2.h === 0) return null;
    if (v1 > 120 || v2 > 120) return null;
    const g = gcd(v1, v2);
    const a = v1 / g, b = v2 / g;
    if (a > 15 || b > 15) return null;
    let left, right;
    if (form === 'xx_over') { left = [t1, t2]; right = [T(0, a), T(0, b)]; }        // (x − 16)/(x + 6) = 3/5
    else if (form === 'num_over_x') { left = [T(0, a), t1]; right = [T(0, b), t2]; } // 6/(x + 16) = 7/(3x + 3)
    else { left = [t1, T(0, a)]; right = [t2, T(0, b)]; }                             // (x − 9)/15 = (2x − 9)/10
    // the x coefficients must not cancel
    const r = build(rng, left, right, x);
    return r;
  }, () => build(rng, [T(1, -16), T(1, 6)], [T(0, 3), T(0, 5)], 49));
}

export function generate(rng, difficulty = 1) {
  const r = difficulty <= 1 ? easy(rng) : difficulty === 2 ? medium(rng) : hard(rng);
  const { fig, steps, x, left, right } = r;
  if (!isClean(x)) throw new Error('proportion: unclean answer');
  return numberQuestion({
    topic: TOPIC, difficulty, prompt: 'Solve the proportion using the Cross Product Property. Find x.',
    figure: fig.svg, answer: x, solution: steps, figureMeta: fig.meta,
    data: { left: left.map((t) => [t.k, t.h]), right: right.map((t) => [t.k, t.h]) },
  });
}

export const text = { txt, num };
export default { id: TOPIC, generate };
