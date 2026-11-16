// Day 4: three parallel lines cut by two transversals divide them proportionally. Find x (numbers, one expression
// such as x + 5, or one expression on each transversal such as (2x + 2)/21 = (x + 3)/12; at difficulty 3 a whole
// transversal length may be given on a dimension line).
import { numberQuestion, attempt, figOk, term, termText, fracText, crossSolve } from './common.js';
import { createFigure, rot, deg } from './svg.js';
import { exprFor, gcd, num } from './util.js';

const TOPIC = 'parallel_proportional';

export function generate(rng, difficulty = 1) {
  const q = attempt(() => build(rng, difficulty), () => null, 120);
  if (!q) throw new Error('parallel_proportional: no problem found');
  return q;
}

function build(rng, difficulty) {
  const p = rng.int(1, 7), qq = rng.int(1, 7);
  if (gcd(p, qq) !== 1 || Math.max(p, qq) > 2.5 * Math.min(p, qq)) return null;
  const m = rng.int(2, 9), n = rng.int(2, 9);
  if (m === n) return null;
  const a = p * m, b = qq * m, c = p * n, d = qq * n;     // transversal 1: a then b; transversal 2: c then d
  if (Math.max(a + b, c + d) > 80) return null;
  const vals = { a, b, c, d };

  // labels: plain numbers, x, or expressions
  const lab = { a: term(0, a), b: term(0, b), c: term(0, c), d: term(0, d) };
  const mode = difficulty <= 1 ? 'x' : difficulty === 2 ? rng.pick(['x', 'expr', 'expr']) : rng.pick(['expr', 'two', 'two', 'whole']);
  let x, unknown;
  if (mode === 'two') {
    // same x on one piece of each transversal, in the same position (a and c, or b and d)
    const top = rng.chance(0.5);
    const k1 = rng.pick([1, 2, 3]), k2 = rng.pick([1, 2, 3]);
    const v1 = top ? a : b, v2 = top ? c : d;
    const opts = [];
    for (let xx = 2; xx <= 20; xx++) {
      const h1 = v1 - k1 * xx, h2 = v2 - k2 * xx;
      if (h1 === 0 || h2 === 0 || Math.abs(h1) > 15 || Math.abs(h2) > 15) continue;
      opts.push([xx, h1, h2]);
    }
    if (!opts.length) return null;
    const [xx, h1, h2] = rng.pick(opts);
    x = xx;
    lab[top ? 'a' : 'b'] = term(k1, h1);
    lab[top ? 'c' : 'd'] = term(k2, h2);
    unknown = top ? 'a+c' : 'b+d';
  } else {
    unknown = rng.pick(['a', 'b', 'c', 'd']);
    if (mode === 'expr') {
      const e = exprFor(rng, vals[unknown], { ks: [1, 1, 2, 3], minX: 2, maxAbsH: 15 });
      if (!e) return null;
      lab[unknown] = term(e.k, e.h); x = e.x;
    } else {
      lab[unknown] = term(1, 0); x = vals[unknown];
    }
  }
  // whole-length variant: the transversal without the unknown shows its total instead of its second piece
  let dimOn = null;
  if (mode === 'whole') {
    dimOn = unknown === 'a' || unknown === 'b' ? 2 : 1;
  }

  // geometry: parallel lines y = 0, -h1, -(h1 + h2) in a local frame, then rotated
  const h1 = 3 * p / (p + qq) * 2.2, h2 = 3 * qq / (p + qq) * 2.2;
  const ys = [0, -h1, -(h1 + h2)];
  const H = h1 + h2;
  // transversal angles (to the parallel lines): drawn lengths roughly in the ratio m : n
  const th1 = deg(rng.range(55, 85));
  let s2 = Math.sin(th1) * m / n;
  s2 = Math.min(1, Math.max(Math.sin(deg(38)), s2));
  let th2 = Math.asin(s2);
  const lean1 = rng.sign(), lean2 = rng.chance(0.6) ? -lean1 : lean1;
  if (lean2 === lean1 && Math.abs(th1 - th2) < deg(8)) th2 = Math.max(deg(38), th2 - deg(10));
  const x1 = (y) => lean1 * (-y) / Math.tan(th1);                 // transversal 1 crosses y at x1(y)
  const gap = 3.2 + rng.range(0, 1.5);
  const x2 = (y) => gap + lean2 * (-y) / Math.tan(th2);
  // keep the transversals apart inside the band
  for (const y of ys) if (x2(y) - x1(y) < 2.2) return null;
  for (const y of [ys[0] + H * 0.2, ys[2] - H * 0.2]) if (x2(y) - x1(y) < 1.2) return null;   // not even past the lines
  const left = Math.min(...ys.map(x1)) - 1.6, right = Math.max(...ys.map(x2)) + 1.6;
  const spin = deg(rng.range(-16, 16));   // near-horizontal lines leave room for the labels
  const R = (pt) => rot(pt, spin);
  const fig = createFigure();
  for (const y of ys) {
    fig.seg(R([left, y]), R([right, y]), { ends: 'both', ext: 6 });
    // parallel arrow between the transversals
    const t = ((x1(y) + x2(y)) / 2 - left) / (right - left);
    fig.parallel(R([left, y]), R([right, y]), 1, t);
  }
  const yTop = ys[0] + H * 0.16, yBot = ys[2] - H * 0.16;      // transversals stick out past the outer lines
  const tPts = (fx) => [R([fx(yTop), yTop]), R([fx(yBot), yBot])];
  const [t1a, t1b] = tPts(x1), [t2a, t2b] = tPts(x2);
  fig.seg(t1a, t1b, { ends: 'both', ext: 4 }).seg(t2a, t2b, { ends: 'both', ext: 4 });
  const P1 = ys.map((y) => R([x1(y), y])), P2 = ys.map((y) => R([x2(y), y]));
  const mid = R([(x1(ys[1]) + x2(ys[1])) / 2, ys[1]]);
  fig.side(P1[0], P1[1], termText(lab.a), mid);
  if (dimOn === 1) fig.dim(P1[0], P1[2], String(a + b), mid);
  else fig.side(P1[1], P1[2], termText(lab.b), mid);
  fig.side(P2[0], P2[1], termText(lab.c), mid);
  if (dimOn === 2) fig.dim(P2[0], P2[2], String(c + d), mid);
  else fig.side(P2[1], P2[2], termText(lab.d), mid);

  // proportion a/b = c/d with the unknown first
  const steps = ['The parallel lines cut the transversals proportionally.'];
  const show = { ...lab };
  if (dimOn === 2) { steps.push(`Bottom piece on the second transversal: ${c + d} − ${c} = ${d}`); show.d = term(0, d); }
  if (dimOn === 1) { steps.push(`Bottom piece on the first transversal: ${a + b} − ${a} = ${b}`); show.b = term(0, b); }
  const firstOn1 = unknown === 'a' || unknown === 'b' || unknown === 'a+c' || unknown === 'b+d';
  const [n1, d1, n2, d2] = firstOn1 ? [show.a, show.b, show.c, show.d] : [show.c, show.d, show.a, show.b];
  const res = crossSolve(n1, d1, n2, d2);
  if (!res || Math.abs(res.x - x) > 1e-9) return null;
  steps.push(`${fracText(n1, d1)} = ${fracText(n2, d2)}`);
  steps.push(...res.steps);
  for (const key of ['a', 'b', 'c', 'd']) {
    const t = lab[key];
    if (t.k !== 0 && (t.k !== 1 || t.h !== 0)) steps.push(`Check: ${termText(t)} = ${num(vals[key])} when x = ${num(x)}.`);
  }
  const r = fig.render({ title: 'Three parallel lines cut by two transversals', maxW: 420, maxH: 262, pad: 28 });
  if (!figOk(r)) return null;
  return numberQuestion({
    topic: TOPIC, difficulty, prompt: 'Find the value of x.', figure: r.svg, figureMeta: r.meta, answer: x, solution: steps,
    data: { pieces: vals, unknown, mode, whole: dimOn, labels: Object.fromEntries(Object.entries(lab).map(([k, t]) => [k, [t.k, t.h]])) },
  });
}

export default { id: TOPIC, generate };
