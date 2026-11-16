// Day 4: Triangle Angle Bisector Theorem. BD bisects angle B (two congruent arcs), so AD/DC = BA/BC.
// Find the missing segment or side: x, an expression (difficulty 2-3), or a whole side on a dimension line (3).
import { numberQuestion, attempt, figOk, term, termText, fracText, crossSolve } from './common.js';
import { createFigure, triFromSides, place, deg, lerp, minAngle, angleAt } from './svg.js';
import { pickLetters } from './geom.js';
import { exprFor, gcd, num, ANG } from './util.js';

const TOPIC = 'angle_bisector';

export function generate(rng, difficulty = 1) {
  const q = attempt(() => build(rng, difficulty), () => null, 150);
  if (!q) throw new Error('angle_bisector: no problem found');
  return q;
}

function build(rng, difficulty) {
  const p = rng.int(1, 7), q = rng.int(1, 7);
  if (p === q || gcd(p, q) !== 1 || Math.max(p, q) > 2.5 * Math.min(p, q)) return null;
  const m = rng.int(2, 12), n = rng.int(2, 12);
  // BA = p m, BC = q m, AD = p n, DC = q n; triangle inequality: m > n and |p - q| m < (p + q) n
  if (!(m > n) || !(Math.abs(p - q) * m < (p + q) * n)) return null;
  const ba = p * m, bc = q * m, ad = p * n, dc = q * n, ac = ad + dc;
  if (Math.max(ba, bc, ac) > 90) return null;
  const pts = triFromSides(bc, ac, ba);           // [A, B, C]: BC = a, CA = b, AB = c
  if (minAngle(pts) < 24 || angleAt(pts[1], pts[0], pts[2]) < 44) return null;   // halves of B big enough to mark
  const [A0, B0, C0] = place(pts, { angle: deg(rng.range(0, 360)), mirror: rng.chance(0.5) });
  const D0 = lerp(A0, C0, ad / ac);
  // the drawn D really is where the bisector meets AC
  if (Math.abs(angleAt(B0, A0, D0) - angleAt(B0, D0, C0)) > 0.01) return null;
  const L = pickLetters(rng, 4);
  const nm = { A: L[0], B: L[1], C: L[2], D: L[3] };
  const vals = { BA: ba, BC: bc, AD: ad, DC: dc };
  const names = { BA: nm.B + nm.A, BC: nm.B + nm.C, AD: nm.A + nm.D, DC: nm.D + nm.C };
  const lab = { BA: term(0, ba), BC: term(0, bc), AD: term(0, ad), DC: term(0, dc) };
  const whole = difficulty >= 3 && rng.chance(0.45);
  let unk, x, steps = [];
  let dimText = null;
  if (whole) {
    // packet style: the whole side is the unknown (or given) on a dimension line
    if (rng.chance(0.5)) {
      // unknown whole side AC: labels BA, BC, AD; x = AC
      unk = 'AC'; x = ac;
      delete lab.DC;
      dimText = 'x';
      const r = crossSolve(term(0, ad), term(1, 0), term(0, ba), term(0, bc));
      if (!r || Math.abs(r.x - dc) > 1e-9) return null;
      steps = [
        `${nm.B}${nm.D} bisects ${ANG}${nm.B}, so ${names.AD}/${names.DC} = ${names.BA}/${names.BC}.`,
        `Let ${names.DC} = y: ${ad}/y = ${ba}/${bc}`,
        ...r.steps.map((s) => s.replace(/x/g, 'y')),
        `x = ${names.AD} + ${names.DC} = ${ad} + ${dc} = ${ac}`,
      ];
    } else {
      // whole side AC given, find a piece
      unk = rng.pick(['AD', 'DC']);
      x = vals[unk];
      const other = unk === 'AD' ? 'DC' : 'AD';
      delete lab[other];
      lab[unk] = term(1, 0);
      dimText = String(ac);
      // AD/DC = BA/BC with DC = AC - AD:   unknown AD: x/(ac - x) = ba/bc
      const n1 = unk === 'AD' ? term(1, 0) : term(-1, ac), d1 = unk === 'AD' ? term(-1, ac) : term(1, 0);
      const r = crossSolve(n1, d1, term(0, ba), term(0, bc));
      if (!r || Math.abs(r.x - x) > 1e-9) return null;
      steps = [
        `${nm.B}${nm.D} bisects ${ANG}${nm.B}, so ${names.AD}/${names.DC} = ${names.BA}/${names.BC}.`,
        `${names[other]} = ${nm.A}${nm.C} − ${names[unk]} = ${ac} − x`,
        `${fracText(n1, d1)} = ${ba}/${bc}`,
        ...r.steps,
      ];
    }
  } else {
    unk = rng.pick(['BA', 'BC', 'AD', 'DC']);
    x = vals[unk];
    if (difficulty >= 2 && rng.chance(0.65)) {
      const e = exprFor(rng, vals[unk], { ks: [1, 1, 2, 3], minX: 2, maxAbsH: 14 });
      if (!e) return null;
      lab[unk] = term(e.k, e.h); x = e.x;
    } else lab[unk] = term(1, 0);
    // write the proportion with the unknown's pair first: segments over segments = sides over sides
    const segFirst = unk === 'AD' || unk === 'DC';
    const [n1, d1, n2, d2] = segFirst ? [lab.AD, lab.DC, lab.BA, lab.BC] : [lab.BA, lab.BC, lab.AD, lab.DC];
    const r = crossSolve(n1, d1, n2, d2);
    if (!r || Math.abs(r.x - x) > 1e-9) return null;
    steps = [
      `${nm.B}${nm.D} bisects ${ANG}${nm.B}, so ${names.AD}/${names.DC} = ${names.BA}/${names.BC}.`,
      `${fracText(lab.AD, lab.DC)} = ${fracText(lab.BA, lab.BC)}`,
      ...r.steps.slice(),
    ];
    if (!segFirst) {
      steps[0] = `${nm.B}${nm.D} bisects ${ANG}${nm.B}, so ${names.BA}/${names.BC} = ${names.AD}/${names.DC}.`;
      steps[1] = `${fracText(lab.BA, lab.BC)} = ${fracText(lab.AD, lab.DC)}`;
    }
    const ut = lab[unk];
    if (ut.k !== 1 || ut.h !== 0) steps.push(`Check: ${termText(ut)} = ${num(vals[unk])} when x = ${num(x)}.`);
  }

  const fig = createFigure();
  fig.seg(A0, B0).seg(B0, C0).seg(A0, D0).seg(D0, C0).seg(B0, D0);
  const nArc = rng.pick([1, 1, 2]);
  fig.arc(B0, A0, D0, nArc, 22).arc(B0, D0, C0, nArc, 26);
  const ctr = [(A0[0] + B0[0] + C0[0]) / 3, (A0[1] + B0[1] + C0[1]) / 3];
  if (lab.BA) fig.side(B0, A0, termText(lab.BA), ctr);
  if (lab.BC) fig.side(B0, C0, termText(lab.BC), ctr);
  if (lab.AD) fig.side(A0, D0, termText(lab.AD), B0);
  if (lab.DC) fig.side(D0, C0, termText(lab.DC), B0);
  if (dimText) fig.dim(A0, C0, dimText, B0);
  fig.vertex(A0, nm.A).vertex(B0, nm.B).vertex(C0, nm.C).vertex(D0, nm.D);
  const r = fig.render({ title: 'A triangle with an angle bisector' });
  if (!figOk(r)) return null;
  return numberQuestion({
    topic: TOPIC, difficulty, prompt: `${nm.B}${nm.D} bisects ${ANG}${nm.A}${nm.B}${nm.C}. Find the value of x.`,
    figure: r.svg, figureMeta: r.meta, answer: x, solution: steps,
    data: { sides: vals, unknown: unk, whole: !!whole, labels: Object.fromEntries(Object.entries(lab).map(([k, t]) => [k, [t.k, t.h]])) },
  });
}

export default { id: TOPIC, generate };
