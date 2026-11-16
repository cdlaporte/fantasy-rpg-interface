// Day 4: Triangle Proportionality Theorem. A segment parallel to one side (parallel arrows) cuts the other two
// sides proportionally: find x (pieces; expressions like 3x + 2; a whole side on a dimension line at difficulty 3),
// or the converse: "Is MN parallel to JL?" from four segment lengths (yes / no, no arrows drawn).
import { numberQuestion, choiceQuestion, attempt, figOk, term, termText, fracText, crossSolve } from './common.js';
import { createFigure, rot, deg, lerp, centroid, minAngle } from './svg.js';
import { pickLetters } from './geom.js';
import { exprFor, gcd, num } from './util.js';
import { ratioStr } from './similarity_proof.js';

const TOPIC = 'triangle_proportionality';

/** Triangle with apex A, AB = lenAB, AC = lenAC (drawn lengths), apex angle theta; random orientation. */
function apexTriangle(rng, lenAB, lenAC, theta) {
  const spin = deg(rng.range(0, 360));
  const A = [0, 0];
  const B = rot([lenAB, 0], spin), C = rot([lenAC * Math.cos(deg(theta)), lenAC * Math.sin(deg(theta))], spin);
  return rng.chance(0.5) ? [A, B, C] : [A, B, C].map((p) => [p[0], -p[1]]);   // sometimes mirrored
}

function findX(rng, difficulty) {
  return attempt(() => {
    const p = rng.int(1, 6), q = rng.int(1, 6);
    if (gcd(p, q) !== 1 || Math.max(p, q) > 2.6 * Math.min(p, q)) return null;   // pieces big enough to see
    const m = rng.int(2, 8), n = rng.int(2, 8);
    if (m === n) return null;
    const ad = p * m, db = q * m, ae = p * n, ec = q * n;
    if (Math.max(ad + db, ae + ec) > 90) return null;
    const theta = rng.int(35, 80);
    const [A, B, C] = apexTriangle(rng, ad + db, ae + ec, theta);
    if (minAngle([A, B, C]) < 25) return null;
    const D = lerp(A, B, p / (p + q)), E = lerp(A, C, p / (p + q));
    const L = pickLetters(rng, 5);
    const nm = { A: L[0], B: L[1], C: L[2], D: L[3], E: L[4] };
    const vals = { AD: ad, DB: db, AE: ae, EC: ec };
    const segs = { AD: [A, D], DB: [D, B], AE: [A, E], EC: [E, C] };
    const names = { AD: nm.A + nm.D, DB: nm.D + nm.B, AE: nm.A + nm.E, EC: nm.E + nm.C };
    const whole = difficulty >= 3 && rng.chance(0.5);
    const keys = ['AD', 'DB', 'AE', 'EC'];
    const unk = rng.pick(keys);
    const lab = {};
    for (const k of keys) lab[k] = term(0, vals[k]);
    let x = vals[unk];
    if (difficulty >= 2 && !whole && rng.chance(0.75)) {
      const e = exprFor(rng, vals[unk], { ks: [1, 2, 3, 4], minX: 2, maxAbsH: 15 });
      if (e) { lab[unk] = term(e.k, e.h); x = e.x; } else lab[unk] = term(1, 0);
    } else lab[unk] = term(1, 0);
    // whole-side variant: the side with the known pieces shows its whole length on a dimension line instead of
    // its far piece (so the student subtracts first)
    let dimKey = null;
    const fig = createFigure();
    fig.seg(A, B).seg(A, C).seg(B, C).seg(D, E);
    const nPar = rng.pick([1, 1, 2]);
    fig.parallel(D, E, nPar).parallel(B, C, nPar);
    const ctr = centroid([A, B, C]);
    const steps = [];
    if (whole) {
      // hide one known far piece and show the whole side instead
      const sideKeys = unk === 'AD' || unk === 'DB' ? ['AE', 'EC'] : ['AD', 'DB'];
      dimKey = sideKeys[1];
      const total = vals[sideKeys[0]] + vals[sideKeys[1]];
      const [P0, P1] = dimKey === 'DB' ? [A, B] : [A, C];
      fig.dim(P0, P1, String(total), ctr);
      const wholeName = dimKey === 'DB' ? nm.A + nm.B : nm.A + nm.C;
      steps.push(`${names[dimKey]} = ${wholeName} − ${names[sideKeys[0]]} = ${total} − ${vals[sideKeys[0]]} = ${vals[dimKey]}`);
    }
    for (const k of keys) if (k !== dimKey) fig.side(segs[k][0], segs[k][1], termText(lab[k]), ctr);
    fig.vertex(A, nm.A).vertex(B, nm.B).vertex(C, nm.C).vertex(D, nm.D).vertex(E, nm.E);
    // proportion with the unknown in the first fraction
    const first = unk === 'AD' || unk === 'DB' ? ['AD', 'DB'] : ['AE', 'EC'];
    const second = first[0] === 'AD' ? ['AE', 'EC'] : ['AD', 'DB'];
    const t = (k) => (k === dimKey ? term(0, vals[k]) : lab[k]);
    const res = crossSolve(t(first[0]), t(first[1]), t(second[0]), t(second[1]));
    if (!res || Math.abs(res.x - x) > 1e-9) return null;
    steps.unshift(`${nm.D}${nm.E} ∥ ${nm.B}${nm.C}, so it divides the sides proportionally.`);
    steps.push(`${names[first[0]]}/${names[first[1]]} = ${names[second[0]]}/${names[second[1]]}`);
    steps.push(`${fracText(t(first[0]), t(first[1]))} = ${fracText(t(second[0]), t(second[1]))}`);
    steps.push(...res.steps);
    const ut = lab[unk];
    if (ut.k !== 1 || ut.h !== 0) steps.push(`Check: ${termText(ut)} = ${num(vals[unk])} when x = ${num(x)}.`);
    const r = fig.render({ title: 'A triangle with a segment parallel to one side' });
    if (!figOk(r)) return null;
    return numberQuestion({ topic: TOPIC, difficulty, prompt: 'Find the value of x.', figure: r.svg, figureMeta: r.meta,
      answer: x, solution: steps,
      data: { kind: 'find_x', pieces: vals, unknown: unk, expr: [ut.k, ut.h], whole: dimKey, sideValue: vals[unk] } });
  }, () => null);
}

function isParallel(rng, difficulty) {
  return attempt(() => {
    const yes = rng.chance(0.5);
    const p = rng.int(1, 7), q = rng.int(2, 9);
    if (gcd(p, q) !== 1 || p === q || q > 2.6 * p) return null;
    // values in tenths so decimals like 15.4 stay exact
    const tenths = difficulty >= 3 && rng.chance(0.5);
    const m = tenths ? rng.int(12, 40) : rng.int(2, 8) * 10, n = tenths ? rng.int(12, 40) : rng.int(2, 8) * 10;
    if (m === n) return null;
    let km = p * m, mj = q * m, kn = p * n, nl = q * n;
    if (!yes) {
      const d = (rng.int(1, 3) * (tenths ? 2 : 10)) * rng.sign();
      if (rng.chance(0.5)) mj += d; else nl += d;
      if (mj <= 0 || nl <= 0) return null;
      // really not proportional, and not too close to call
      const r1 = km / mj, r2 = kn / nl;
      if (Math.abs(r1 - r2) / Math.max(r1, r2) < 0.04) return null;
    }
    const v = (t) => t / 10;
    if (Math.max(v(km + mj), v(kn + nl)) > 60 || Math.min(v(km), v(mj), v(kn), v(nl)) < 2) return null;
    const theta = rng.int(35, 80);
    const [K, J, Lp] = apexTriangle(rng, v(km + mj), v(kn + nl), theta);
    if (minAngle([K, J, Lp]) < 25) return null;
    const M = lerp(K, J, km / (km + mj)), N = lerp(K, Lp, kn / (kn + nl));
    const Ls = pickLetters(rng, 5);
    const nm = { K: Ls[0], J: Ls[1], L: Ls[2], M: Ls[3], N: Ls[4] };
    const fig = createFigure();
    fig.seg(K, J).seg(K, Lp).seg(J, Lp).seg(M, N);
    const ctr = centroid([K, J, Lp]);
    fig.side(K, M, num(v(km)), ctr).side(M, J, num(v(mj)), ctr).side(K, N, num(v(kn)), ctr).side(N, Lp, num(v(nl)), ctr);
    fig.vertex(K, nm.K).vertex(J, nm.J).vertex(Lp, nm.L).vertex(M, nm.M).vertex(N, nm.N);
    const r = fig.render({ title: 'A triangle with a segment across it' });
    if (!figOk(r)) return null;
    const seg1 = nm.M + nm.N, seg2 = nm.J + nm.L;
    const choices = [`Yes, ${seg1} ∥ ${seg2}`, `No, ${seg1} is not parallel to ${seg2}`];
    const steps = [
      `Compare the pieces of each side: ${nm.K}${nm.M}/${nm.M}${nm.J} and ${nm.K}${nm.N}/${nm.N}${nm.L}.`,
      `${nm.K}${nm.M}/${nm.M}${nm.J} = ${ratioStr(v(km), v(mj))}`,
      `${nm.K}${nm.N}/${nm.N}${nm.L} = ${ratioStr(v(kn), v(nl))}`,
      yes ? `The ratios are equal, so ${seg1} ∥ ${seg2} (Converse of the Triangle Proportionality Theorem).`
        : `The ratios are not equal, so ${seg1} is not parallel to ${seg2}.`,
    ];
    return choiceQuestion({ topic: TOPIC, difficulty, prompt: `Is ${seg1} parallel to ${seg2}?`, figure: r.svg, figureMeta: r.meta,
      choices, answerIndex: yes ? 0 : 1, solution: steps,
      data: { kind: 'is_parallel', pieces: { KM: v(km), MJ: v(mj), KN: v(kn), NL: v(nl) }, parallel: yes } });
  }, () => null);
}

export function generate(rng, difficulty = 1) {
  let q = null;
  for (let t = 0; t < 6 && !q; t++) q = rng.chance(difficulty === 1 ? 0.15 : 0.3) ? isParallel(rng, difficulty) : findX(rng, difficulty);
  if (!q) throw new Error('triangle_proportionality: no problem found');
  return q;
}

export default { id: TOPIC, generate };
