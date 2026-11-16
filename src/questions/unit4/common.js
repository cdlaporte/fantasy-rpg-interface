// Shared helpers for the Unit 4 generators: question assembly and multiple-choice building.
import { seedFrom } from './rng.js';
import { asciiNum, num, reduce } from './util.js';

/** Build a typed-number question. answer must be finite; accept = tolerance 0.01 plus the exact fraction. */
export function numberQuestion({ topic, difficulty, prompt, figure = null, answer, answerText, solution, data = {}, figureMeta = null, unknown = 'x' }) {
  const den = [1, 2, 4, 5, 10, 3].find((d) => Math.abs(answer * d - Math.round(answer * d)) < 1e-9) || 1;
  const fr = reduce(Math.round(answer * den), den);
  const q = {
    topic, difficulty, type: 'number', prompt, figure,
    answer,
    accept: { tolerance: 0.01, fraction: fr.d === 1 ? null : [fr.n, fr.d] },
    answerText: answerText || (unknown ? `${unknown} = ${num(answer)}` : num(answer)),
    answerPlain: asciiNum(answer),
    solution, data,
  };
  if (figureMeta) Object.defineProperty(q, 'figureMeta', { value: figureMeta, enumerable: false });
  return finish(q);
}

/** Build a multiple-choice question. choices: strings, answerIndex: the right one. */
export function choiceQuestion({ topic, difficulty, prompt, figure = null, choices, answerIndex, solution, data = {}, figureMeta = null }) {
  const q = {
    topic, difficulty, type: 'choice', prompt, figure, choices, answerIndex,
    answerText: choices[answerIndex],
    solution, data,
  };
  if (figureMeta) Object.defineProperty(q, 'figureMeta', { value: figureMeta, enumerable: false });
  return finish(q);
}

function finish(q) {
  const key = `${q.prompt}|${q.answerText}|${q.figure ? q.figure.length : 0}|${JSON.stringify(q.data)}`;
  q.id = `${q.topic}-d${q.difficulty}-${seedFrom(key).toString(36)}`;
  return q;
}

/**
 * Shuffle the right answer in among distractors (unique, never equal to the answer) and return
 * {choices, answerIndex}. Distractors that duplicate the answer or each other are dropped; `fill` supplies more.
 */
export function mixChoices(rng, right, wrong, n = 4, fill = null) {
  const seen = new Set([right]);
  const picks = [];
  for (const w of wrong) {
    if (picks.length >= n - 1) break;
    if (w == null || seen.has(w)) continue;
    seen.add(w); picks.push(w);
  }
  let guard = 0;
  while (fill && picks.length < n - 1 && guard++ < 50) {
    const w = fill();
    if (w == null || seen.has(w)) continue;
    seen.add(w); picks.push(w);
  }
  const all = rng.shuffle([right, ...picks]);
  return { choices: all, answerIndex: all.indexOf(right) };
}

/** Retry a builder until it returns a value (bounded); the last resort is `fallback()`. */
export function attempt(build, fallback, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const r = build(i);
    if (r) return r;
  }
  return fallback();
}

// ---- proportions with linear terms {k, h} = k x + h (k = 0 for a plain number) ----
import { lin, times, solveLinear } from './util.js';

export const term = (k, h) => ({ k, h });
export const termText = (t) => lin(t.k, t.h);
export const termVal = (t, x) => t.k * x + t.h;
/** "12/18" or "(x + 9)/24" */
export function fracText(n, d) {
  const w = (t) => (t.k !== 0 && t.h !== 0) || (t.k !== 0 && t.k !== 1) ? `(${termText(t)})` : termText(t);
  return `${w(n)}/${w(d)}`;
}

/**
 * Solve n1/d1 = n2/d2 with the Cross Product Property: n1 * d2 = d1 * n2. Every product must stay linear.
 * Returns {x, steps} (steps start with the cross products) or null when it cannot be solved cleanly.
 */
export function crossSolve(n1, d1, n2, d2) {
  if ((n1.k && d2.k) || (d1.k && n2.k)) return null;
  const prod = (p, q) => (p.k ? { k: p.k * q.h, h: p.h * q.h, shown: times(q.h, p.k, p.h) }
    : { k: q.k * p.h, h: q.h * p.h, shown: times(p.h, q.k, q.h) });
  const L = prod(n1, d2), R = prod(d1, n2);
  const res = solveLinear(L.k, L.h, R.k, R.h);
  if (!Number.isFinite(res.x)) return null;
  const steps = [`Cross multiply: ${L.shown} = ${R.shown}`];
  steps.push(`${lin(L.k, L.h)} = ${lin(R.k, R.h)}`);
  steps.push(...res.steps);
  return { x: res.x, steps };
}

/** A rendered figure is acceptable when no label overlaps a line, a mark or another label. */
export function figOk(r) {
  return !!r && r.meta.labels.every((l) => l.bad < 10);
}
