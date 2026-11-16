// Day 3: are the triangles similar? If so, by which rule? (multiple choice, the four choices in a fixed order)
// Configurations from the packet: two angles given in each triangle (AA, the third angle may need computing),
// three side pairs (SSS), two sides with a marked congruent included angle (SAS), bow-ties at vertical angles with
// parallel sides / right angles / marked angles (AA) or with the four side lengths (SAS), a triangle with a segment
// across it (shared angle: parallel arrows = AA, side pieces = SAS), and near-miss "Not similar" versions.
// Every figure is drawn from real coordinates; a "Not similar" figure really is not similar (checked).
import { choiceQuestion, attempt, figOk } from './common.js';
import { createFigure, centroid, rot, deg, triFromAngles, triFromSides, angleAt } from './svg.js';
import { pickLetters, niceTriangle, drawnRatio, layoutPair, shapesSimilar, shapeGap } from './geom.js';
import { gcd, DEG, ANG } from './util.js';

const TOPIC = 'similarity_proof';
export const CHOICES = Object.freeze(['Similar by AA', 'Similar by SSS', 'Similar by SAS', 'Not similar']);
const AA = 0, SSS = 1, SAS = 2, NOT = 3;
const PROMPT = 'Are the triangles similar? If so, by which rule?';

/** "30/24 = 1.25" or "11/15.4 ≈ 0.714" */
export function ratioStr(a, b) {
  const v = a / b;
  const exact = Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-9;
  const g = Number.isInteger(a) && Number.isInteger(b) ? gcd(a, b) : 1;
  const red = g > 1 && b / g !== 1 ? ` = ${a / g}/${b / g}` : '';
  return exact ? `${a}/${b}${red} = ${Math.round(v * 1000) / 1000}` : `${a}/${b}${red} ≈ ${v.toFixed(3)}`;
}
const sameRatio = (a, b, c, d) => Math.abs(a * d - b * c) < 1e-9;    // a/b = c/d
const scaleTo = (pts, size) => {
  let m = 0;
  for (let i = 0; i < 3; i++) m = Math.max(m, Math.hypot(pts[i][0] - pts[(i + 1) % 3][0], pts[i][1] - pts[(i + 1) % 3][1]));
  return pts.map((p) => [(p[0] * size) / m, (p[1] * size) / m]);
};
const tri = (L) => `Δ${L.join('')}`;

// ---------------------------------------------------------------- AA with angle measures
function aaAngles(rng, similar, difficulty) {
  return attempt(() => {
    const al = rng.int(28, 95), be = rng.int(28, 95), ga = 180 - al - be;
    if (ga < 28 || ga > 110) return null;
    const A1 = [al, be, ga];
    if (Math.min(Math.abs(al - be), Math.abs(be - ga), Math.abs(al - ga)) < 7) return null;
    let A2 = A1.slice(), keep = -1;
    if (!similar) {
      keep = rng.int(0, 2);
      const o = [0, 1, 2].filter((i) => i !== keep);
      const d = rng.sign() * rng.int(difficulty >= 2 ? 4 : 8, 16);
      A2[o[0]] = A1[o[0]] + d; A2[o[1]] = A1[o[1]] - d;
      if (Math.min(...A2) < 25 || Math.max(...A2) > 115) return null;
      const s1 = A1.slice().sort((x, y) => x - y), s2 = A2.slice().sort((x, y) => x - y);
      if (s1.every((v, i) => v === s2[i])) return null;
    }
    const B1 = triFromAngles(A1[1], A1[2]);
    const B2 = triFromAngles(A2[1], A2[2]);
    const [T1, T2] = layoutPair(rng, B1, B2, drawnRatio(rng.pick([0.6, 0.7, 1.4, 1.6, 1.8])));
    if (similar !== shapesSimilar(T1, T2, 0.01) || (!similar && shapeGap(T1, T2) < 3)) return null;
    // which angles are shown: two per triangle; the second triangle may show the "third" angle
    const S1 = rng.shuffle([0, 1, 2]).slice(0, 2);
    let S2;
    if (similar) S2 = difficulty >= 2 || rng.chance(0.4) ? rng.shuffle([0, 1, 2]).slice(0, 2) : S1.slice();
    else S2 = [keep, rng.pick([0, 1, 2].filter((i) => i !== keep))];
    if (!similar && !S1.includes(keep)) S1[1] = keep;
    const L = pickLetters(rng, 6), L1 = L.slice(0, 3), L2 = L.slice(3);
    const fig = createFigure();
    fig.poly(T1).poly(T2);
    const mark = (T, i, val, n) => {
      const p = T[(i + 1) % 3], q = T[(i + 2) % 3];
      fig.arc(T[i], p, q, n, 15);
      fig.angle(T[i], p, q, `${val}${DEG}`, 15 + (n - 1) * 4.5);
    };
    for (const i of S1) mark(T1, i, A1[i], 1);
    for (const i of S2) mark(T2, i, A2[i], 1);
    for (let i = 0; i < 3; i++) { fig.vertex(T1[i], L1[i]); fig.vertex(T2[i], L2[i]); }
    const third = (A, S, Lt) => {
      const m = [0, 1, 2].find((i) => !S.includes(i));
      return `${tri(Lt)}: m${ANG}${Lt[m]} = 180${DEG} − ${A[S[0]]}${DEG} − ${A[S[1]]}${DEG} = ${A[m]}${DEG}`;
    };
    const list = (A) => A.slice().sort((x, y) => x - y).map((v) => v + DEG).join(', ');
    const steps = [third(A1, S1, L1), third(A2, S2, L2)];
    if (similar) {
      steps.push(`Both triangles have angles ${list(A1)}.`);
      steps.push('Two angles of one triangle are congruent to two angles of the other, so the triangles are similar by AA.');
    } else {
      steps.push(`${tri(L1)} has angles ${list(A1)}; ${tri(L2)} has angles ${list(A2)}.`);
      steps.push('Only one pair of angles is congruent, so the triangles are not similar.');
    }
    const rf = fig.render({ title: 'Two triangles with angle measures' });
    if (!figOk(rf)) return null;
    return { fig: rf, answer: similar ? AA : NOT, steps,
      data: { config: 'aa_angles', angles1: A1, angles2: A2, shown1: S1, shown2: S2 } };
  }, () => null);
}

// ---------------------------------------------------------------- SSS
function sss(rng, similar, near) {
  return attempt(() => {
    const base = niceTriangle(rng, { lo: 3, hi: 12, minA: 28 });
    const u = rng.int(1, 6), v = rng.int(1, 6);
    if (u === v) return null;
    const s1 = base.sides.map((s) => s * u);
    let s2 = base.sides.map((s) => s * v);
    if (!similar) {
      const i = rng.int(0, 2);
      const d = rng.sign() * (near ? rng.int(1, 3) : rng.int(3, 8));
      s2 = s2.slice(); s2[i] += d;
      const [a, b, c] = s2;
      if (Math.min(a, b, c) < 3 || a + b <= c || a + c <= b || b + c <= a) return null;
      const r1 = s1.slice().sort((x, y) => x - y), r2 = s2.slice().sort((x, y) => x - y);
      if (sameRatio(r2[0], r1[0], r2[1], r1[1]) && sameRatio(r2[1], r1[1], r2[2], r1[2])) return null;
    }
    if (Math.max(...s1, ...s2) > 99) return null;
    const B1 = scaleTo(triFromSides(...s1), 10), B2 = scaleTo(triFromSides(...s2), 10);
    const [T1, T2] = layoutPair(rng, B1, B2, drawnRatio(Math.max(...s2) / Math.max(...s1)));
    if (similar !== shapesSimilar(T1, T2, 0.01) || (!similar && shapeGap(T1, T2) < 1)) return null;
    const L = pickLetters(rng, 6), L1 = L.slice(0, 3), L2 = L.slice(3);
    const fig = createFigure();
    fig.poly(T1).poly(T2);
    const c1 = centroid(T1), c2 = centroid(T2);
    for (let i = 0; i < 3; i++) {
      fig.side(T1[(i + 1) % 3], T1[(i + 2) % 3], String(s1[i]), c1);
      fig.side(T2[(i + 1) % 3], T2[(i + 2) % 3], String(s2[i]), c2);
    }
    for (let i = 0; i < 3; i++) { fig.vertex(T1[i], L1[i]); fig.vertex(T2[i], L2[i]); }
    const r1 = s1.slice().sort((x, y) => x - y), r2 = s2.slice().sort((x, y) => x - y);
    const big = r2[2] > r1[2];
    const [top, bot] = big ? [r2, r1] : [r1, r2];
    const steps = [
      `Match the sides from shortest to longest: ${r1.join(', ')} and ${r2.join(', ')}.`,
      ...[0, 1, 2].map((i) => ratioStr(top[i], bot[i])),
      similar ? 'All three ratios are equal, so the triangles are similar by SSS.'
        : 'The ratios are not all equal, so the triangles are not similar.',
    ];
    const rf = fig.render({ title: 'Two triangles with side lengths' });
    if (!figOk(rf)) return null;
    return { fig: rf, answer: similar ? SSS : NOT, steps,
      data: { config: 'sss', sides1: s1, sides2: s2 } };
  }, () => null);
}

// ---------------------------------------------------------------- SAS (marked included angle)
function sasPair(rng, similar) {
  return attempt(() => {
    const theta = rng.int(35, 110);
    const a0 = rng.int(2, 9), b0 = rng.int(2, 9);
    if (a0 === b0 || gcd(a0, b0) !== 1) return null;
    const u = rng.int(1, 6), v = rng.int(1, 6);
    if (u === v) return null;
    const s1 = [a0 * u, b0 * u];
    let s2 = [a0 * v, b0 * v];
    if (!similar) {
      const i = rng.int(0, 1);
      s2 = s2.slice(); s2[i] += rng.sign() * rng.int(1, 4);
      if (Math.min(...s2) < 3 || s2[0] === s2[1]) return null;
    }
    if (Math.max(...s1, ...s2) > 60) return null;
    const mk = (s) => { const V = [0, 0], P1 = [s[0], 0], P2 = [s[1] * Math.cos(deg(theta)), s[1] * Math.sin(deg(theta))]; return [V, P1, P2]; };
    const B1 = scaleTo(mk(s1), 10), B2 = scaleTo(mk(s2), 10);
    if (Math.min(angleAt(B1[1], B1[0], B1[2]), angleAt(B1[2], B1[0], B1[1])) < 22) return null;
    if (Math.min(angleAt(B2[1], B2[0], B2[2]), angleAt(B2[2], B2[0], B2[1])) < 22) return null;
    const [T1, T2] = layoutPair(rng, B1, B2, drawnRatio(Math.max(...s2) / Math.max(...s1)));
    if (similar !== shapesSimilar(T1, T2, 0.01) || (!similar && shapeGap(T1, T2) < 2)) return null;
    const L = pickLetters(rng, 6), L1 = L.slice(0, 3), L2 = L.slice(3);
    const fig = createFigure();
    fig.poly(T1).poly(T2);
    const n = rng.pick([1, 1, 2]);
    fig.arc(T1[0], T1[1], T1[2], n, 15).arc(T2[0], T2[1], T2[2], n, 15);
    const c1 = centroid(T1), c2 = centroid(T2);
    fig.side(T1[0], T1[1], String(s1[0]), c1).side(T1[0], T1[2], String(s1[1]), c1);
    fig.side(T2[0], T2[1], String(s2[0]), c2).side(T2[0], T2[2], String(s2[1]), c2);
    for (let i = 0; i < 3; i++) { fig.vertex(T1[i], L1[i]); fig.vertex(T2[i], L2[i]); }
    const steps = sasSteps(`${ANG}${L1[0]} ≅ ${ANG}${L2[0]} (marked congruent).`,
      [[s1[0], `${L1[0]}${L1[1]}`], [s1[1], `${L1[0]}${L1[2]}`]], [[s2[0], `${L2[0]}${L2[1]}`], [s2[1], `${L2[0]}${L2[2]}`]], similar);
    const rf = fig.render({ title: 'Two triangles with a marked angle' });
    if (!figOk(rf)) return null;
    return { fig: rf, answer: similar ? SAS : NOT, steps,
      data: { config: 'sas', theta, sides1: s1, sides2: s2 } };
  }, () => null);
}

/** Steps for an SAS check: sides around the congruent angle, shorter with shorter, longer with longer. */
function sasSteps(angleLine, sides1, sides2, similar, extra = []) {
  const a = sides1.slice().sort((x, y) => x[0] - y[0]), b = sides2.slice().sort((x, y) => x[0] - y[0]);
  const big = b[1][0] > a[1][0];
  const [top, bot] = big ? [b, a] : [a, b];
  return [
    angleLine,
    ...extra,
    `Shorter sides: ${top[0][1]}/${bot[0][1]} = ${ratioStr(top[0][0], bot[0][0])}`,
    `Longer sides: ${top[1][1]}/${bot[1][1]} = ${ratioStr(top[1][0], bot[1][0])}`,
    similar ? 'The sides that form the congruent angles are proportional, so the triangles are similar by SAS.'
      : 'The ratios are not equal, so the triangles are not similar.',
  ];
}

// ---------------------------------------------------------------- bow-ties
/** Shared vertex C at the origin; rays u1 (to P) and u2 (to Q) with angle theta; second triangle on the opposite rays. */
function bowtiePoints(rng, theta, a, b, c, d) {
  const spin = deg(rng.range(-50, 50)) + (rng.chance(0.5) ? Math.PI : 0);
  const u1 = [Math.cos(spin + deg(theta) / 2), Math.sin(spin + deg(theta) / 2)];
  const u2 = [Math.cos(spin - deg(theta) / 2), Math.sin(spin - deg(theta) / 2)];
  const C = [0, 0];
  return { C, P: [u1[0] * a, u1[1] * a], Q: [u2[0] * b, u2[1] * b], X: [-u1[0] * c, -u1[1] * c], Y: [-u2[0] * d, -u2[1] * d] };
}

function bowtieAA(rng, kind) {
  return attempt(() => {
    // triangle C P Q; the other triangle is C X Y on the opposite rays (X on line CP, Y on line CQ)
    let theta, a, b;
    if (kind === 'right') {
      theta = rng.int(30, 60); a = 10; b = a / Math.cos(deg(theta));      // right angle at P
    } else {
      const base = niceTriangle(rng, { lo: 4, hi: 12, minA: 35, maxA: 100 });
      theta = angleAt(base.pts[0], base.pts[1], base.pts[2]); a = base.sides[2]; b = base.sides[1];
    }
    const k = drawnRatio(rng.pick([0.6, 0.7, 1.4, 1.6]));
    // parallel: X = -k P direction (PQ ∥ XY); for right / arcs the other triangle may also be the "crossed" copy
    const cross = kind !== 'par' && rng.chance(0.5);
    const pts = cross ? bowtiePoints(rng, theta, a, b, k * b, k * a) : bowtiePoints(rng, theta, a, b, k * a, k * b);
    const { C, P, Q, X, Y } = pts;
    // corresponding vertices: parallel P<->X, Q<->Y; crossed P<->Y, Q<->X
    const Pm = cross ? Y : X, Qm = cross ? X : Y;
    const T1 = [C, P, Q], T2 = [C, Pm, Qm];
    if (!shapesSimilar(T1, T2, 0.01)) return null;
    const L = pickLetters(rng, 5);
    const fig = createFigure();
    fig.seg(C, P).seg(C, Q).seg(P, Q).seg(C, X).seg(C, Y).seg(X, Y);
    const nm = { C: L[0], P: L[1], Q: L[2], X: L[3], Y: L[4] };
    const why = [];
    if (kind === 'par') {
      fig.parallel(P, Q, 1).parallel(X, Y, 1);
      why.push(`${nm.P}${nm.Q} ∥ ${nm.X}${nm.Y}, so ${ANG}${nm.P} ≅ ${ANG}${nm.X} (alternate interior angles).`);
    } else if (kind === 'right') {
      fig.right(P, C, Q).right(Pm, C, Qm);
      why.push(`${ANG}${nm.P} and ${ANG}${cross ? nm.Y : nm.X} are both right angles, so they are congruent.`);
    } else {
      const n = rng.pick([1, 2]);
      fig.arc(P, C, Q, n, 15).arc(Pm, C, Qm, n, 15);
      why.push(`${ANG}${nm.P} ≅ ${ANG}${cross ? nm.Y : nm.X} (marked congruent).`);
    }
    fig.vertex(C, nm.C).vertex(P, nm.P).vertex(Q, nm.Q).vertex(X, nm.X).vertex(Y, nm.Y);
    const steps = [
      `${ANG}${nm.P}${nm.C}${nm.Q} ≅ ${ANG}${nm.X}${nm.C}${nm.Y} (vertical angles).`,
      ...why,
      'Two pairs of congruent angles, so the triangles are similar by AA.',
    ];
    const rf = fig.render({ title: 'Two triangles meeting at vertical angles' });
    if (!figOk(rf)) return null;
    return { fig: rf, answer: AA, steps,
      data: { config: 'bowtie_' + kind, cross, theta } };
  }, () => null);
}

function bowtieSAS(rng, similar, near) {
  return attempt(() => {
    const theta = rng.int(40, 115);
    const a0 = rng.int(2, 9), b0 = rng.int(2, 9);
    if (a0 === b0 || gcd(a0, b0) !== 1) return null;
    const u = rng.int(1, 8), v = rng.int(1, 12);
    if (u === v) return null;
    const a = a0 * u, b = b0 * u;
    const cross = rng.chance(0.5);
    let c = (cross ? b0 : a0) * v, d = (cross ? a0 : b0) * v;   // c on ray opposite P, d opposite Q
    if (!similar) {
      if (rng.chance(0.5)) c += rng.sign() * rng.int(1, near ? 3 : 6); else d += rng.sign() * rng.int(1, near ? 3 : 6);
      if (Math.min(c, d) < 3 || c === d) return null;
      const s1 = [a, b].sort((x, y) => x - y), s2 = [c, d].sort((x, y) => x - y);
      if (sameRatio(s1[0], s2[0], s1[1], s2[1])) return null;
    }
    if (Math.max(a, b, c, d) > 120 || Math.min(a, b, c, d) < 3) return null;
    // drawn: second triangle scaled toward the first (shape kept)
    const k = drawnRatio(Math.max(c, d) / Math.max(a, b)) * Math.max(a, b) / Math.max(c, d);
    const { C, P, Q, X, Y } = bowtiePoints(rng, theta, a, b, c * k, d * k);
    const T1 = [C, P, Q], T2 = [C, X, Y];
    if (similar !== shapesSimilar(T1, T2, 0.01) || (!similar && shapeGap(T1, T2) < 1.5)) return null;
    for (const T of [T1, T2]) if (Math.min(angleAt(T[1], T[0], T[2]), angleAt(T[2], T[0], T[1])) < 18) return null;
    const L = pickLetters(rng, 5);
    const nm = { C: L[0], P: L[1], Q: L[2], X: L[3], Y: L[4] };
    const fig = createFigure();
    fig.seg(C, P).seg(C, Q).seg(P, Q).seg(C, X).seg(C, Y).seg(X, Y);
    const c1 = centroid(T1), c2 = centroid(T2);
    fig.side(C, P, String(a), c1).side(C, Q, String(b), c1).side(C, X, String(c), c2).side(C, Y, String(d), c2);
    fig.vertex(C, nm.C).vertex(P, nm.P).vertex(Q, nm.Q).vertex(X, nm.X).vertex(Y, nm.Y);
    const steps = sasSteps(`${ANG}${nm.P}${nm.C}${nm.Q} ≅ ${ANG}${nm.X}${nm.C}${nm.Y} (vertical angles).`,
      [[a, nm.C + nm.P], [b, nm.C + nm.Q]], [[c, nm.C + nm.X], [d, nm.C + nm.Y]], similar);
    const rf = fig.render({ title: 'Two triangles meeting at vertical angles' });
    if (!figOk(rf)) return null;
    return { fig: rf, answer: similar ? SAS : NOT, steps,
      data: { config: 'bowtie_sas', theta, sides1: [a, b], sides2: [c, d] } };
  }, () => null);
}

// ---------------------------------------------------------------- nested (shared angle)
function nested(rng, mode, similar) {
  return attempt(() => {
    const theta = rng.int(30, 70);
    const a0 = rng.int(2, 9), b0 = rng.int(2, 9);
    if (a0 === b0 || gcd(a0, b0) !== 1) return null;
    const [u, v] = rng.pick([[1, 2], [1, 3], [2, 3], [2, 5], [3, 5], [3, 4], [3, 7], [4, 7]]);
    let lx = a0 * u, ly = b0 * u, xg = a0 * (v - u), yb = b0 * (v - u);
    if (mode === 'sas' && !similar) {
      if (rng.chance(0.5)) xg += rng.sign() * rng.int(1, 3); else yb += rng.sign() * rng.int(1, 3);
      if (Math.min(xg, yb) < 2) return null;
      const s1 = [lx, ly].sort((x, y) => x - y), s2 = [lx + xg, ly + yb].sort((x, y) => x - y);
      if (sameRatio(s1[0], s2[0], s1[1], s2[1])) return null;
    }
    if (Math.max(lx + xg, ly + yb) > 99 || Math.min(lx, ly, xg, yb) < 2) return null;
    const spin = deg(rng.range(0, 360));
    const u1 = [Math.cos(spin), Math.sin(spin)], u2 = [Math.cos(spin + deg(theta)), Math.sin(spin + deg(theta))];
    const Lp = [0, 0];
    const X = [u1[0] * lx, u1[1] * lx], G = [u1[0] * (lx + xg), u1[1] * (lx + xg)];
    const Y = [u2[0] * ly, u2[1] * ly], B = [u2[0] * (ly + yb), u2[1] * (ly + yb)];
    const T1 = [Lp, X, Y], T2 = [Lp, G, B];
    if (similar !== shapesSimilar(T1, T2, 0.01) || (!similar && shapeGap(T1, T2) < 1.5)) return null;
    if (Math.min(angleAt(X, Lp, Y), angleAt(Y, Lp, X), angleAt(G, Lp, B), angleAt(B, Lp, G)) < 20) return null;
    const Ls = pickLetters(rng, 5);
    const nm = { L: Ls[0], X: Ls[1], Y: Ls[2], G: Ls[3], B: Ls[4] };
    const fig = createFigure();
    fig.seg(Lp, X).seg(X, G).seg(Lp, Y).seg(Y, B).seg(X, Y).seg(G, B);
    const cb = centroid(T2);
    let steps, answer;
    if (mode === 'par') {
      fig.parallel(X, Y, 1).parallel(G, B, 1);
      steps = [
        `${ANG}${nm.L} is in both triangles (shared angle).`,
        `${nm.X}${nm.Y} ∥ ${nm.G}${nm.B}, so ${ANG}${nm.L}${nm.X}${nm.Y} ≅ ${ANG}${nm.L}${nm.G}${nm.B} (corresponding angles).`,
        'Two pairs of congruent angles, so the triangles are similar by AA.',
      ];
      answer = AA;
    } else {
      fig.side(Lp, X, String(lx), cb).side(X, G, String(xg), cb).side(Lp, Y, String(ly), cb).side(Y, B, String(yb), cb);
      steps = sasSteps(`${ANG}${nm.L} is in both ${tri([nm.L, nm.X, nm.Y])} and ${tri([nm.L, nm.G, nm.B])} (shared angle).`,
        [[lx, nm.L + nm.X], [ly, nm.L + nm.Y]], [[lx + xg, nm.L + nm.G], [ly + yb, nm.L + nm.B]], similar, [
          `${nm.L}${nm.G} = ${lx} + ${xg} = ${lx + xg} and ${nm.L}${nm.B} = ${ly} + ${yb} = ${ly + yb}`,
        ]);
      answer = similar ? SAS : NOT;
    }
    fig.vertex(Lp, nm.L).vertex(X, nm.X).vertex(Y, nm.Y).vertex(G, nm.G).vertex(B, nm.B);
    const rf = fig.render({ title: 'A triangle with a segment across it' });
    if (!figOk(rf)) return null;
    return { fig: rf, answer, steps,
      data: { config: 'nested_' + mode, theta, pieces: { lx, xg, ly, yb } } };
  }, () => null);
}

// ---------------------------------------------------------------- choose
function pickConfig(rng, difficulty, target) {
  const d = difficulty;
  const opts = {
    [AA]: d <= 1 ? [() => aaAngles(rng, true, d)]
      : d === 2 ? [() => aaAngles(rng, true, d), () => bowtieAA(rng, 'par'), () => bowtieAA(rng, 'right'), () => bowtieAA(rng, 'arcs')]
        : [() => bowtieAA(rng, rng.pick(['par', 'right', 'arcs'])), () => nested(rng, 'par', true), () => aaAngles(rng, true, d)],
    [SSS]: [() => sss(rng, true, false)],
    [SAS]: d <= 1 ? [() => sasPair(rng, true)]
      : d === 2 ? [() => sasPair(rng, true), () => bowtieSAS(rng, true, false)]
        : [() => bowtieSAS(rng, true, true), () => nested(rng, 'sas', true), () => sasPair(rng, true)],
    [NOT]: d <= 1 ? [() => aaAngles(rng, false, d), () => sss(rng, false, false)]
      : d === 2 ? [() => aaAngles(rng, false, d), () => sasPair(rng, false), () => bowtieSAS(rng, false, false), () => sss(rng, false, false)]
        : [() => sss(rng, false, true), () => nested(rng, 'sas', false), () => bowtieSAS(rng, false, true), () => aaAngles(rng, false, d)],
  };
  return rng.pick(opts[target])();
}

export function generate(rng, difficulty = 1) {
  let r = null;
  for (let t = 0; t < 8 && !r; t++) r = pickConfig(rng, difficulty, rng.pick([AA, AA, SSS, SAS, SAS, NOT, NOT]));
  if (!r) r = aaAngles(rng, true, 1);
  return choiceQuestion({
    topic: TOPIC, difficulty, prompt: PROMPT, figure: r.fig.svg, figureMeta: r.fig.meta,
    choices: CHOICES.slice(), answerIndex: r.answer, solution: r.steps, data: r.data,
  });
}

export default { id: TOPIC, generate };
