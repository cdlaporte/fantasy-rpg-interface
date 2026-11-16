// Day 2: finding side lengths of similar triangles with proportions (typed number).
// The prompt gives the similarity statement (the student reads it, never writes it); the figure shows two similar
// triangles in different sizes and orientations, or overlapping ones (bow-tie at a vertical angle, nested with a
// parallel side). One side is unknown: x, or an expression such as x + 9, 3x − 9, 14x + 14.
import { numberQuestion, attempt, figOk, term, termText, termVal, fracText, crossSolve } from './common.js';
import { createFigure, place, centroid, bbox, rot, deg } from './svg.js';
import { pickLetters, niceTriangle, drawnRatio } from './geom.js';
import { exprFor, num, isClean } from './util.js';

const TOPIC = 'similar_missing_side';
const add = (a, b) => term(a.k + b.k, a.h + b.h);

/** Similarity statement with a random (but consistent) vertex order. */
function statement(rng, L1, L2) {
  const p = rng.shuffle([0, 1, 2]);
  const text = `Δ${p.map((i) => L1[i]).join('')} ~ Δ${p.map((i) => L2[i]).join('')}`;
  // side names follow the order of the letters in the statement (so "AB matches DE")
  const name = (Lt, a, b) => (p.indexOf(a) < p.indexOf(b) ? Lt[a] + Lt[b] : Lt[b] + Lt[a]);
  return { text, name };
}

/** Unknown side value -> its label term (x or an expression) and x. */
function unknownTerm(rng, value, useExpr) {
  if (useExpr) {
    const e = exprFor(rng, value, { ks: [1, 1, 2, 3, 4], minX: 2, maxAbsH: 18 });
    if (e) return { t: term(e.k, e.h), x: e.x };
  }
  return { t: term(1, 0), x: value };
}

function solutionFor(stmt, names, terms, x) {
  // names/terms: [[n1j, n2j], [n1i, n2i]]; proportion n1j/n2j = n1i/n2i
  const [[a, b], [c, d]] = terms;
  const res = crossSolve(a, b, c, d);
  if (!res || Math.abs(res.x - x) > 1e-9) return null;
  const steps = [
    `${stmt}, so ${names[0][0]} matches ${names[0][1]} and ${names[1][0]} matches ${names[1][1]}.`,
    `${names[0][0]}/${names[0][1]} = ${names[1][0]}/${names[1][1]}`,
    `${fracText(a, b)} = ${fracText(c, d)}`,
    ...res.steps,
  ];
  return steps;
}

// ---------------------------------------------------------------- two separate triangles
function separate(rng, difficulty) {
  return attempt(() => {
    const base = niceTriangle(rng, { lo: 3, hi: 12 });
    const u = rng.int(1, 6), v = rng.int(1, 6);
    if (u === v || Math.max(u, v) / Math.min(u, v) > 4) return null;
    const s1 = base.sides.map((s) => s * u), s2 = base.sides.map((s) => s * v);
    if (Math.max(...s1, ...s2) > 99 || Math.min(...s1, ...s2) < 3) return null;

    // drawing: different orientation, roughly to scale
    const k = drawnRatio(v / u);
    const a1 = deg(rng.range(-30, 30));
    const a2 = a1 + deg(rng.sign() * rng.range(70, 190));
    const T1 = place(base.pts, { angle: a1, mirror: rng.chance(0.25) });
    let T2 = place(base.pts, { angle: a2, mirror: rng.chance(0.5), scale: k });
    const b1 = bbox(T1), b2 = bbox(T2);
    const fit = (w, h) => Math.min(332 / w, 162 / h);
    const gap = 0.3 * Math.max(b1.w, b1.h, b2.w, b2.h);
    const side = fit(b1.w + gap + b2.w, Math.max(b1.h, b2.h));
    const stack = fit(Math.max(b1.w, b2.w), b1.h + gap + b2.h);
    let dx, dy;
    if (side >= stack * 0.9) { dx = b1.x1 + gap - b2.x0; dy = (b1.y0 + b1.y1) / 2 - (b2.y0 + b2.y1) / 2; }
    else { dy = b1.y0 - gap - b2.y1; dx = (b1.x0 + b1.x1) / 2 - (b2.x0 + b2.x1) / 2 + rng.range(-0.2, 0.2) * b1.w; }
    T2 = T2.map((p) => [p[0] + dx, p[1] + dy]);

    const L = pickLetters(rng, 6);
    const L1 = L.slice(0, 3), L2 = L.slice(3);
    const st = statement(rng, L1, L2);
    const stmt = st.text;
    const sideName = (Lt, i) => st.name(Lt, (i + 1) % 3, (i + 2) % 3);

    const [i, j, m] = rng.shuffle([0, 1, 2]);       // i: known pair, j: pair with the unknown, m: unused (or extra)
    const unkIn = rng.chance(0.5) ? 1 : 2;
    const unkVal = unkIn === 1 ? s1[j] : s2[j];
    const { t: ut, x } = unknownTerm(rng, unkVal, difficulty >= 2 && rng.chance(0.8));
    const t1 = [term(0, s1[0]), term(0, s1[1]), term(0, s1[2])];
    const t2 = [term(0, s2[0]), term(0, s2[1]), term(0, s2[2])];
    if (unkIn === 1) t1[j] = ut; else t2[j] = ut;

    const steps = solutionFor(stmt,
      [[sideName(L1, j), sideName(L2, j)], [sideName(L1, i), sideName(L2, i)]],
      [[t1[j], t2[j]], [t1[i], t2[i]]], x);
    if (!steps) return null;
    if (ut.k !== 1 || ut.h !== 0) steps.push(`Check: ${termText(ut)} = ${num(unkVal)} when x = ${num(x)}.`);

    const fig = createFigure();
    fig.poly(T1).poly(T2);
    const c1 = centroid(T1), c2 = centroid(T2);
    const lbl = (T, c, idx, t) => fig.side(T[(idx + 1) % 3], T[(idx + 2) % 3], termText(t), c);
    lbl(T1, c1, i, t1[i]); lbl(T2, c2, i, t2[i]);
    lbl(T1, c1, j, t1[j]); lbl(T2, c2, j, t2[j]);
    // sometimes one extra (unused) side, like the worksheets
    const extra = difficulty >= 2 && rng.chance(0.4) ? (rng.chance(0.5) ? 1 : 2) : 0;
    if (extra === 1) lbl(T1, c1, m, t1[m]);
    if (extra === 2) lbl(T2, c2, m, t2[m]);
    for (let n = 0; n < 3; n++) { fig.vertex(T1[n], L1[n]); fig.vertex(T2[n], L2[n]); }
    const r = fig.render({ title: 'Two similar triangles' });
    if (!figOk(r)) return null;
    return {
      stmt, x, steps, fig: r, unkVal,
      data: { config: 'separate', sides1: s1, sides2: s2, known: i, unknownPair: j, unknownIn: unkIn, expr: [ut.k, ut.h], extra },
    };
  }, () => null);
}

// ---------------------------------------------------------------- bow-tie (vertical angles at the shared vertex)
function bowtie(rng, difficulty) {
  return attempt(() => {
    const base = niceTriangle(rng, { lo: 4, hi: 14, minA: 32, maxA: 105 });
    const u = rng.int(1, 6), v = rng.int(1, 6);
    if (u === v || Math.max(u, v) / Math.min(u, v) > 3.5) return null;
    const s1 = base.sides.map((s) => s * u), s2 = base.sides.map((s) => s * v);
    if (Math.max(...s1, ...s2) > 99 || Math.min(...s1, ...s2) < 3) return null;
    // put the shared vertex (index 0) at the origin with its angle bisector along +x
    const [C0, P0, Q0] = base.pts;
    const d1 = Math.atan2(P0[1] - C0[1], P0[0] - C0[0]), d2 = Math.atan2(Q0[1] - C0[1], Q0[0] - C0[0]);
    let bis = (d1 + d2) / 2;
    if (Math.abs(d1 - d2) > Math.PI) bis += Math.PI;
    const toLocal = (p) => rot([p[0] - C0[0], p[1] - C0[1]], -bis);
    const B = [toLocal(C0), toLocal(P0), toLocal(Q0)];
    const k = drawnRatio(v / u);
    const parallel = rng.chance(0.5);
    const map2 = parallel ? (p) => [-k * p[0], -k * p[1]] : (p) => [-k * p[0], k * p[1]];
    const spin = deg(rng.range(-60, 60)) + (rng.chance(0.5) ? Math.PI : 0);
    const T1 = B.map((p) => rot(p, spin));
    const T2 = B.map((p) => rot(map2(p), spin));

    const L = pickLetters(rng, 5);
    const L1 = [L[0], L[1], L[2]], L2 = [L[0], L[3], L[4]];
    const st = statement(rng, L1, L2);
    const stmt = st.text;
    const sideName = (Lt, i) => st.name(Lt, (i + 1) % 3, (i + 2) % 3);
    // sides 1 and 2 lie on the crossing lines (they touch the shared vertex); side 0 is the far side
    const pairs = rng.chance(0.75) ? rng.shuffle([1, 2]).concat([0]) : rng.shuffle([0, 1, 2]);
    const [i, j] = pairs;
    const unkIn = rng.chance(0.5) ? 1 : 2;
    const unkVal = unkIn === 1 ? s1[j] : s2[j];
    const { t: ut, x } = unknownTerm(rng, unkVal, difficulty >= 3 ? rng.chance(0.75) : difficulty === 2 && rng.chance(0.4));
    const t1 = s1.map((s) => term(0, s)), t2 = s2.map((s) => term(0, s));
    if (unkIn === 1) t1[j] = ut; else t2[j] = ut;
    const steps = solutionFor(stmt,
      [[sideName(L1, j), sideName(L2, j)], [sideName(L1, i), sideName(L2, i)]],
      [[t1[j], t2[j]], [t1[i], t2[i]]], x);
    if (!steps) return null;
    if (ut.k !== 1 || ut.h !== 0) steps.push(`Check: ${termText(ut)} = ${num(unkVal)} when x = ${num(x)}.`);

    const fig = createFigure();
    fig.poly(T1);
    fig.seg(T2[0], T2[1]).seg(T2[0], T2[2]).seg(T2[1], T2[2]);
    const c1 = centroid(T1), c2 = centroid(T2);
    const lbl = (T, c, idx, t) => fig.side(T[(idx + 1) % 3], T[(idx + 2) % 3], termText(t), c);
    lbl(T1, c1, i, t1[i]); lbl(T2, c2, i, t2[i]);
    lbl(T1, c1, j, t1[j]); lbl(T2, c2, j, t2[j]);
    fig.vertex(T1[0], L1[0]);
    fig.vertex(T1[1], L1[1]); fig.vertex(T1[2], L1[2]);
    fig.vertex(T2[1], L2[1]); fig.vertex(T2[2], L2[2]);
    const r = fig.render({ title: 'Two similar triangles that meet at a vertex' });
    if (!figOk(r)) return null;
    return {
      stmt, x, steps, fig: r, unkVal,
      data: { config: parallel ? 'bowtie_parallel' : 'bowtie_cross', sides1: s1, sides2: s2, known: i, unknownPair: j, unknownIn: unkIn, expr: [ut.k, ut.h] },
    };
  }, () => null);
}

// ---------------------------------------------------------------- nested (shared angle, parallel sides)
function nested(rng, difficulty) {
  return attempt(() => {
    const base = niceTriangle(rng, { lo: 3, hi: 12, minA: 34, maxA: 100 });
    const [u, v] = rng.pick([[1, 2], [1, 3], [2, 3], [2, 5], [3, 5], [3, 4], [1, 4], [2, 4]]);
    // base pts: [R, F0, G0]; small = u * base, big = v * base, both anchored at R
    const [R0, F0, G0] = base.pts;
    const rel = (p, s) => [(p[0] - R0[0]) * s, (p[1] - R0[1]) * s];
    const spin = deg(rng.range(0, 360));
    const R = [0, 0];
    const F = rot(rel(F0, u), spin), G = rot(rel(G0, u), spin), Q = rot(rel(F0, v), spin), Pp = rot(rel(G0, v), spin);
    const rf = base.sides[2] * u, rq = base.sides[2] * v;        // |R F0| = c
    const rg = base.sides[1] * u, rp = base.sides[1] * v;        // |R G0| = b
    const fg = base.sides[0] * u, qp = base.sides[0] * v;        // |F0 G0| = a
    const fq = rq - rf, gp = rp - rg;
    if (Math.max(rq, rp, qp) > 99) return null;

    const L = pickLetters(rng, 5);
    const [nR, nF, nG, nQ, nP] = L;
    const st = statement(rng, [nR, nF, nG], [nR, nQ, nP]);
    const stmt = st.text;
    const n1 = (a, b) => st.name([nR, nF, nG], a, b), n2 = (a, b) => st.name([nR, nQ, nP], a, b);
    const option = rng.pick(['A', 'B', 'C', 'D', 'E']);
    const T = (v0) => term(0, v0);
    let lab = {}, steps, x, unkVal, names, terms;
    // lab: segment key -> term; proportion from the statement written with whole sides
    if (option === 'A' || option === 'B') {
      // pieces on R-Q known; one parallel side unknown
      const unk = option === 'A' ? 'QP' : 'FG';
      unkVal = unk === 'QP' ? qp : fg;
      const { t: ut, x: xx } = unknownTerm(rng, unkVal, difficulty >= 3 && rng.chance(0.5));
      x = xx;
      lab = { RF: T(rf), FQ: T(fq), FG: unk === 'FG' ? ut : T(fg), QP: unk === 'QP' ? ut : T(qp) };
      names = [[n1(1, 2), n2(1, 2)], [n1(0, 1), n2(0, 1)]];
      terms = [[lab.FG, lab.QP], [T(rf), T(rq)]];
    } else if (option === 'C') {
      unkVal = fq; x = fq;
      lab = { RF: T(rf), FQ: term(1, 0), FG: T(fg), QP: T(qp) };
      names = [[n1(0, 1), n2(0, 1)], [n1(1, 2), n2(1, 2)]];
      terms = [[T(rf), term(1, rf)], [T(fg), T(qp)]];
    } else if (option === 'D') {
      unkVal = fq; x = fq;
      lab = { RG: T(rg), GP: T(gp), RF: T(rf), FQ: term(1, 0) };
      names = [[n1(0, 1), n2(0, 1)], [n1(0, 2), n2(0, 2)]];
      terms = [[T(rf), term(1, rf)], [T(rg), T(rp)]];
    } else {
      unkVal = gp; x = gp;
      lab = { RF: T(rf), FQ: T(fq), RG: T(rg), GP: term(1, 0) };
      names = [[n1(0, 2), n2(0, 2)], [n1(0, 1), n2(0, 1)]];
      terms = [[T(rg), term(1, rg)], [T(rf), T(rq)]];
    }
    const res = crossSolve(terms[0][0], terms[0][1], terms[1][0], terms[1][1]);
    if (!res || Math.abs(res.x - x) > 1e-9 || !isClean(x)) return null;
    steps = [`${stmt}, so ${names[0][0]} matches ${names[0][1]} and ${names[1][0]} matches ${names[1][1]}.`];
    const whole = [];
    if (lab.FQ && lab.RF) whole.push(`${nR}${nQ} = ${nR}${nF} + ${nF}${nQ} = ${termText(lab.RF)} + ${termText(lab.FQ)}${lab.FQ.k ? '' : ' = ' + termText(add(lab.RF, lab.FQ))}`);
    if (lab.GP && lab.RG) whole.push(`${nR}${nP} = ${nR}${nG} + ${nG}${nP} = ${termText(lab.RG)} + ${termText(lab.GP)}${lab.GP.k ? '' : ' = ' + termText(add(lab.RG, lab.GP))}`);
    steps.push(...whole);
    steps.push(`${names[0][0]}/${names[0][1]} = ${names[1][0]}/${names[1][1]}`);
    steps.push(`${fracText(terms[0][0], terms[0][1])} = ${fracText(terms[1][0], terms[1][1])}`);
    steps.push(...res.steps);
    const ut = Object.values(lab).find((t) => t.k !== 0);
    if (ut && (ut.k !== 1 || ut.h !== 0)) steps.push(`Check: ${termText(ut)} = ${num(unkVal)} when x = ${num(x)}.`);

    const fig = createFigure();
    fig.seg(R, F).seg(F, Q).seg(R, G).seg(G, Pp).seg(F, G).seg(Q, Pp);
    fig.parallel(F, G, 1).parallel(Q, Pp, 1);
    const cBig = centroid([R, Q, Pp]);
    const seg = { RF: [R, F], FQ: [F, Q], RG: [R, G], GP: [G, Pp], FG: [F, G], QP: [Q, Pp] };
    for (const key of Object.keys(lab)) {
      const [a, b] = seg[key];
      const ref = key === 'FG' ? [(Q[0] + Pp[0]) / 2, (Q[1] + Pp[1]) / 2] : key === 'QP' ? [(F[0] + G[0]) / 2, (F[1] + G[1]) / 2] : cBig;
      fig.side(a, b, termText(lab[key]), ref);
    }
    fig.vertex(R, nR).vertex(F, nF).vertex(G, nG).vertex(Q, nQ).vertex(Pp, nP);
    const r = fig.render({ title: 'A triangle with a segment parallel to one side' });
    if (!figOk(r)) return null;
    return {
      stmt, x, steps, fig: r, unkVal,
      data: { config: 'nested', option, rf, fq, rg, gp, fg, qp, labels: Object.fromEntries(Object.entries(lab).map(([kk, t]) => [kk, [t.k, t.h]])) },
    };
  }, () => null);
}

export function generate(rng, difficulty = 1) {
  let r = null;
  for (let t = 0; t < 5 && !r; t++) {
    if (difficulty <= 1) r = rng.chance(0.8) ? separate(rng, 1) : bowtie(rng, 1);
    else if (difficulty === 2) r = rng.chance(0.55) ? separate(rng, 2) : bowtie(rng, 2);
    else r = rng.pick([bowtie, nested, nested, separate])(rng, 3);
  }
  if (!r) throw new Error('similar_missing_side: no problem found');
  const prompt = `If ${r.stmt}, find the value of x.`;
  return numberQuestion({
    topic: TOPIC, difficulty, prompt, figure: r.fig.svg, figureMeta: r.fig.meta,
    answer: r.x, solution: r.steps, data: { ...r.data, statement: r.stmt, sideValue: r.unkVal },
  });
}

export default { id: TOPIC, generate };
