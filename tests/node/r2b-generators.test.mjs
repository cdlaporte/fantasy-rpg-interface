// Round 2, package B: every Unit 4 generator, 500 seeds x 3 difficulties. Checks that problems never throw, answers
// are finite and clean, choices are unique with exactly one right answer, worked solutions exist, figures are
// well-formed SVG with every coordinate inside the viewBox and no label on top of a line, and that the math is right
// (recomputed here independently from each problem's data and its figure labels). Also the teacher's exclusions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS } from '../../src/questions/unit4/index.js';
import { GENERATORS, generate } from '../../src/questions/unit4/generators.js';
import { CHOICES } from '../../src/questions/unit4/similarity_proof.js';

const SEEDS = 500;
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const clean = (v) => Number.isFinite(v) && near(v * 2, Math.round(v * 2));
const MINUS = '−';

/** "3x − 9" at x -> number ("x", "12", "x + 6", "15.4") */
function evalLabel(text, x) {
  const s = text.replace(new RegExp(MINUS, 'g'), '-').replace(/\s+/g, '');
  const m = /^(-?\d*\.?\d*)x([+-]\d+(?:\.\d+)?)?$/.exec(s);
  if (m) {
    const k = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
    return k * x + (m[2] ? Number(m[2]) : 0);
  }
  const m2 = /^(\d+(?:\.\d+)?)-(\d*)x$/.exec(s);        // "40 − x"
  if (m2) return Number(m2[1]) - (m2[2] === '' ? 1 : Number(m2[2])) * x;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return NaN;
}
const len = (seg) => Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]);
/** value / drawn length is the same for every label in the list (one drawing scale). */
function sameScale(labels, x, msg) {
  const r = labels.map((l) => evalLabel(l.text, x) / len(l.own));
  for (const v of r) assert.ok(Math.abs(v / r[0] - 1) < 0.02, `${msg}: labels not to scale ${labels.map((l) => l.text)} ${r}`);
}

function checkSvg(q) {
  const svg = q.figure;
  assert.ok(/^<svg [^>]*viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.test(svg), 'svg root with viewBox');
  const [, W, H] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  assert.ok(W <= 440 && H <= 270, `figure fits ${W}x${H}`);
  // tag balance: every opened tag is closed (self-closing allowed)
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-z]+)([^>]*?)(\/?)>/g)) {
    if (m[1]) assert.equal(stack.pop(), m[2], 'closing tag matches');
    else if (!m[4]) stack.push(m[2]);
  }
  assert.equal(stack.length, 0, 'all tags closed');
  assert.ok(!/NaN|undefined|Infinity/.test(svg), 'no NaN in the svg');
  const inside = (x, y) => x >= -0.01 && x <= W + 0.01 && y >= -0.01 && y <= H + 0.01;
  for (const m of svg.matchAll(/<(line|text)\b([^>]*)>/g)) {
    const a = Object.fromEntries([...m[2].matchAll(/([a-z0-9]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    if (m[1] === 'line') {
      assert.ok(inside(+a.x1, +a.y1) && inside(+a.x2, +a.y2), `line inside viewBox ${m[0]}`);
    } else {
      assert.ok(inside(+a.x, +a.y), `text inside viewBox ${m[0]}`);
    }
  }
  for (const m of svg.matchAll(/ d="([^"]*)"/g)) {
    const tok = m[1].trim().split(/\s+/);
    for (let i = 0; i < tok.length;) {
      const c = tok[i];
      if (c === 'M' || c === 'L') { assert.ok(inside(+tok[i + 1], +tok[i + 2]), `path point inside ${m[1]}`); i += 3; }
      else if (c === 'A') { assert.ok(inside(+tok[i + 6], +tok[i + 7]), `arc end inside ${m[1]}`); i += 8; }
      else if (c === 'Z') i += 1;
      else assert.fail('unknown path command ' + c);
    }
  }
  const meta = q.figureMeta;
  if (meta) {
    for (const l of meta.labels) {
      assert.ok(l.bad < 10, `label "${l.text}" overlaps a line or label (${q.id})`);
      assert.ok(l.x - l.w / 2 >= -0.5 && l.x + l.w / 2 <= W + 0.5 && l.y - l.h / 2 >= -0.5 && l.y + l.h / 2 <= H + 0.5, 'label box inside');
    }
  }
}
const svgTexts = (q) => [...q.figure.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].replace(/&amp;/g, '&'));

function checkCommon(q, topic, d) {
  assert.equal(q.topic, topic);
  assert.equal(q.difficulty, d);
  assert.ok(typeof q.id === 'string' && q.id.startsWith(topic));
  assert.ok(typeof q.prompt === 'string' && q.prompt.length > 10);
  assert.ok(Array.isArray(q.solution) && q.solution.length >= 2 && q.solution.every((s) => typeof s === 'string' && s.length > 0));
  assert.ok(!q.solution.some((s) => /NaN|undefined|Infinity/.test(s)), 'solution text is clean');
  if (q.type === 'number') {
    assert.ok(clean(q.answer), `clean answer ${q.answer}`);
    assert.ok(q.accept && q.accept.tolerance === 0.01);
    assert.ok(typeof q.answerText === 'string' && q.answerText.length > 0);
  } else {
    assert.equal(q.type, 'choice');
    assert.ok(Array.isArray(q.choices) && q.choices.length >= 2 && q.choices.length <= 4);
    assert.equal(new Set(q.choices).size, q.choices.length, 'unique choices');
    assert.ok(Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < q.choices.length);
  }
  // the teacher's exclusions
  const all = [q.prompt, ...(q.choices || []), ...q.solution].join(' | ');
  assert.ok(!/scale factor/i.test(all), 'never "scale factor"');
  assert.ok(!/perimeters/i.test(all) && !/ratio of the perimeter/i.test(all), 'no perimeter ratios');
  if (topic !== 'extended_ratio') assert.ok(!/perimeter/i.test(all), 'no perimeter outside extended ratios');
  assert.ok(!/~\s*(_|\?|$|\.|,)/.test(q.prompt) && !/~\s*_/.test(all), 'never a blank similarity statement');
  assert.ok(!/complete the similarity|similarity statement/i.test(all), 'never asks for a similarity statement');
  if (q.figure) checkSvg(q);
}

// ---------------------------------------------------------------- per-topic math, recomputed here
const CHECK = {
  ratio_simplest(q) {
    const { x, y } = q.data;
    let ex, ey;
    if (q.data.kind === 'games') {
      assert.equal(q.data.wins + q.data.losses, q.data.games);
      assert.ok(q.prompt.includes(`played ${q.data.games} games`) && q.prompt.includes(`won ${q.data.wins}`));
      [ex, ey] = q.data.lossesFirst ? [q.data.losses, q.data.wins] : [q.data.wins, q.data.losses];
    } else if (q.data.kind === 'word') {
      const w = q.data.word;
      const v = [...w].filter((c) => 'AEIOU'.includes(c)).length;
      assert.ok(q.prompt.includes(w));
      [ex, ey] = q.data.mode === 'total' ? [v, w.length] : [v, w.length - v];
    } else if (q.data.kind === 'store') {
      const { counts, i, j } = q.data;
      ex = counts[i]; ey = j < 0 ? counts.reduce((s, c) => s + c, 0) : counts[j];
      for (const c of counts) assert.ok(q.prompt.includes(String(c)));
    } else {
      ex = q.data.first; ey = q.data.second;
      assert.ok(q.prompt.includes(String(ex)) && q.prompt.includes(String(ey)));
    }
    assert.deepEqual([x, y], [ex, ey]);
    const g = gcd(x, y);
    const right = `${x / g}:${y / g}`;
    assert.equal(q.choices[q.answerIndex], right);
    for (const c of q.choices) assert.match(c, /^\d+:\d+$/);
  },
  extended_ratio(q) {
    const d = q.data;
    if (d.kind === 'complementary' || d.kind === 'supplementary') {
      const total = d.kind === 'complementary' ? 90 : 180;
      const k = total / (d.ratio[0] + d.ratio[1]);
      assert.ok(Number.isInteger(k));
      const angs = d.ratio.map((r) => r * k);
      assert.equal(q.answer, d.ask === 'smaller' ? Math.min(...angs) : Math.max(...angs));
      assert.ok(q.prompt.includes(`${d.ratio[0]}:${d.ratio[1]}`) && q.prompt.includes(d.kind));
    } else if (d.kind === 'triangle_angles') {
      const k = 180 / d.ratio.reduce((s, v) => s + v, 0);
      assert.deepEqual(d.angles, d.ratio.map((r) => r * k));
      assert.equal(d.angles.reduce((s, v) => s + v, 0), 180);
      if (d.ask === 'largest angle') assert.equal(q.answer, Math.max(...d.angles));
      else if (d.ask === 'smallest angle') assert.equal(q.answer, Math.min(...d.angles));
      else {
        const letter = d.ask.slice(1);
        const order = [...q.prompt.matchAll(/∠([A-Z])/g)].map((m) => m[1]);
        assert.equal(q.answer, d.angles[order.indexOf(letter)], 'named angle');
      }
      assert.ok(q.prompt.includes(d.ratio.join(':')));
    } else {
      assert.equal(d.kind, 'triangle_sides');
      const [a, b, c] = d.sides;
      assert.ok(a + b > c && a + c > b && b + c > a, 'triangle inequality');
      assert.equal(a + b + c, d.perimeter);
      const k = a / d.ratio[0];
      assert.deepEqual(d.sides, d.ratio.map((r) => r * k));
      if (d.ask === 'longest') assert.equal(q.answer, Math.max(...d.sides));
      else if (d.ask === 'shortest') assert.equal(q.answer, Math.min(...d.sides));
      else {
        const names = [...q.prompt.matchAll(/the sides ([A-Z]{2}), ([A-Z]{2}) and ([A-Z]{2})/g)][0].slice(1);
        assert.equal(q.answer, d.sides[names.indexOf(d.ask)]);
      }
      assert.ok(q.prompt.includes(`perimeter of the triangle is ${d.perimeter}`));
    }
  },
  proportion(q) {
    const v = (t, x) => t[0] * x + t[1];
    const [n1, d1] = q.data.left, [n2, d2] = q.data.right;
    const x = q.answer;
    assert.ok(v(d1, x) !== 0 && v(d2, x) !== 0, 'no zero denominator');
    assert.ok(near(v(n1, x) * v(d2, x), v(d1, x) * v(n2, x)), 'the proportion holds');
    // unique solution: n1 d2 - d1 n2 is linear with a nonzero x coefficient
    const coef = n1[0] * d2[1] + n1[1] * d2[0] - (d1[0] * n2[1] + d1[1] * n2[0]);
    assert.ok(n1[0] * d2[0] === 0 && d1[0] * n2[0] === 0 && coef !== 0, 'one linear solution');
    const texts = svgTexts(q);
    assert.equal(texts.length, 5, 'four terms and the equals sign');
    assert.ok(texts.some((t) => /x/.test(t)), 'x appears');
    for (const t of texts.filter((s) => s !== '=')) {
      const val = evalLabel(t, x);
      assert.ok(Number.isFinite(val));
    }
  },
  similar_missing_side(q) {
    const d = q.data;
    const x = q.answer;
    const labels = q.figureMeta.labels.filter((l) => l.kind === 'side');
    const m = /^If (Δ[A-Z]{3}) ~ (Δ[A-Z]{3}), find the value of x\.$/.exec(q.prompt);
    assert.ok(m, 'prompt gives the similarity statement');
    if (d.config === 'nested') {
      const { rf, fq, rg, gp, fg, qp } = d;
      const rq = rf + fq, rp = rg + gp;
      assert.ok(near(rf * qp, rq * fg) && near(rg * qp, rp * fg) && near(rf * rp, rq * rg), 'small and big triangle similar');
      const vals = { RF: rf, FQ: fq, RG: rg, GP: gp, FG: fg, QP: qp };
      for (const [k, t] of Object.entries(d.labels)) assert.ok(near(t[0] * x + t[1], vals[k]), `label ${k} at x`);
      sameScale(labels, x, q.id);
    } else {
      const { sides1: s1, sides2: s2 } = d;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(near(s1[i] * s2[j], s1[j] * s2[i]), 'similar sides');
      const [a, b, c] = s1;
      assert.ok(a + b > c && a + c > b && b + c > a);
      assert.ok(near(d.expr[0] * x + d.expr[1], d.sideValue), 'x gives the missing side');
      assert.equal(d.sideValue, d.unknownIn === 1 ? s1[d.unknownPair] : s2[d.unknownPair]);
      // labels: T1 and T2 alternate; each triangle drawn to its own scale
      sameScale([labels[0], labels[2]], x, q.id);
      sameScale([labels[1], labels[3]], x, q.id);
      // read the drawing like a student: name each labeled side by its nearest vertex letters, then every pair of
      // corresponding sides (from the statement) that is labeled must have the same ratio
      const vtx = q.figureMeta.labels.filter((l) => l.kind === 'vertex');
      const nearest = (p) => vtx.reduce((b, v) => (Math.hypot(v.x - p[0], v.y - p[1]) < Math.hypot(b.x - p[0], b.y - p[1]) ? v : b)).text;
      const named = {};
      for (const l of labels) named[[nearest(l.own[0]), nearest(l.own[1])].sort().join('')] = evalLabel(l.text, x);
      const [L1, L2] = [m[1].slice(1), m[2].slice(1)];
      const ratios = [];
      for (const [i, j] of [[0, 1], [1, 2], [0, 2]]) {
        const a = named[[L1[i], L1[j]].sort().join('')], b = named[[L2[i], L2[j]].sort().join('')];
        if (a !== undefined && b !== undefined) ratios.push(a / b);
      }
      assert.ok(ratios.length >= 2, `two corresponding pairs labeled ${JSON.stringify(named)}`);
      for (const r of ratios) assert.ok(near(r, ratios[0], 1e-9), `corresponding sides proportional ${JSON.stringify(named)} ${q.prompt}`);
      const want = [s1[d.known], s2[d.known]].map(String);
      for (const w of want) assert.ok(labels.some((l) => l.text === w), 'known pair labeled');
    }
    assert.ok(labels.some((l) => /x/.test(l.text)), 'x labeled');
  },
  similarity_proof(q) {
    assert.deepEqual(q.choices, CHOICES);
    const d = q.data;
    const sortedEq = (u, v) => {
      const a = u.slice().sort((p, r) => p - r), b = v.slice().sort((p, r) => p - r);
      return a.every((_, i) => near(a[i] * b[0], b[i] * a[0]));
    };
    let want;
    if (d.config === 'aa_angles') {
      assert.equal(d.angles1.reduce((s, v) => s + v, 0), 180);
      assert.equal(d.angles2.reduce((s, v) => s + v, 0), 180);
      const a = d.angles1.slice().sort((p, r) => p - r), b = d.angles2.slice().sort((p, r) => p - r);
      want = a.every((v, i) => v === b[i]) ? 0 : 3;
      const texts = svgTexts(q).filter((t) => /°$/.test(t)).map((t) => Number(t.slice(0, -1)));
      assert.equal(texts.length, 4, 'two angle measures per triangle');
      for (const i of d.shown1) assert.ok(texts.includes(d.angles1[i]));
      for (const i of d.shown2) assert.ok(texts.includes(d.angles2[i]));
    } else if (d.config === 'sss') {
      const [a, b, c] = d.sides2;
      assert.ok(a + b > c && a + c > b && b + c > a);
      want = sortedEq(d.sides1, d.sides2) ? 1 : 3;
      const texts = svgTexts(q);
      for (const v of [...d.sides1, ...d.sides2]) assert.ok(texts.includes(String(v)));
    } else if (d.config === 'sas' || d.config === 'bowtie_sas') {
      want = sortedEq(d.sides1, d.sides2) ? 2 : 3;
    } else if (d.config === 'nested_sas') {
      const p = d.pieces;
      want = sortedEq([p.lx, p.ly], [p.lx + p.xg, p.ly + p.yb]) ? 2 : 3;
      sameScale(q.figureMeta.labels.filter((l) => l.kind === 'side'), 0, q.id);
    } else {
      assert.ok(['bowtie_par', 'bowtie_right', 'bowtie_arcs', 'nested_par'].includes(d.config), d.config);
      want = 0;
    }
    assert.equal(q.answerIndex, want, `${d.config}: right rule`);
  },
  triangle_proportionality(q) {
    const d = q.data;
    if (d.kind === 'is_parallel') {
      const { KM, MJ, KN, NL } = d.pieces;
      const yes = Math.abs(KM * NL - KN * MJ) < 1e-6;
      assert.equal(d.parallel, yes);
      assert.equal(q.answerIndex, yes ? 0 : 1);
      assert.equal(q.choices.length, 2);
      if (!yes) assert.ok(Math.abs(KM / MJ - KN / NL) / Math.max(KM / MJ, KN / NL) >= 0.04, 'not a coin flip');
      const texts = svgTexts(q);
      for (const v of [KM, MJ, KN, NL]) assert.ok(texts.includes(String(v)), `${v} labeled`);
      assert.ok(!/class="f-mark"/.test(q.figure), 'no parallel arrows in the converse question');
      sameScale(q.figureMeta.labels.filter((l) => l.kind === 'side'), 0, q.id);
    } else {
      const { AD, DB, AE, EC } = d.pieces;
      assert.ok(near(AD * EC, AE * DB), 'pieces proportional');
      assert.ok(near(d.expr[0] * q.answer + d.expr[1], d.sideValue));
      assert.equal(d.sideValue, d.pieces[d.unknown]);
      assert.ok((q.figure.match(/class="f-mark"/g) || []).length >= 2, 'parallel arrows drawn');
      sameScale(q.figureMeta.labels.filter((l) => l.kind === 'side'), q.answer, q.id);
    }
  },
  parallel_proportional(q) {
    const { a, b, c, d } = q.data.pieces;
    assert.ok(near(a * d, b * c), 'pieces proportional');
    for (const [k, t] of Object.entries(q.data.labels)) assert.ok(near(t[0] * q.answer + t[1], q.data.pieces[k]), `label ${k}`);
    assert.ok(Object.values(q.data.labels).some((t) => t[0] !== 0), 'an x somewhere');
    assert.equal((q.figure.match(/class="f-mark"/g) || []).length, 3, 'one arrow on each parallel line');
    // pieces on one transversal are drawn in the ratio of their labels
    const side = q.figureMeta.labels.filter((l) => l.kind === 'side');
    if (!q.data.whole || q.data.whole === 2) sameScale([side[0], side[1]], q.answer, q.id);
  },
  angle_bisector(q) {
    const s = q.data.sides;
    assert.ok(near(s.AD * s.BC, s.DC * s.BA), 'AD/DC = BA/BC');
    const ac = s.AD + s.DC;
    assert.ok(s.BA + s.BC > ac && s.BA + ac > s.BC && s.BC + ac > s.BA, 'triangle inequality');
    if (q.data.unknown === 'AC') assert.equal(q.answer, ac);
    else assert.ok(near(q.data.labels[q.data.unknown][0] * q.answer + q.data.labels[q.data.unknown][1], s[q.data.unknown]));
    for (const [k, t] of Object.entries(q.data.labels)) if (t[0] === 0) assert.equal(t[1], s[k]);
    assert.ok((q.figure.match(/class="f-arc"/g) || []).length >= 2, 'bisected angle marked');
    sameScale(q.figureMeta.labels.filter((l) => l.kind === 'side'), q.answer, q.id);
  },
};

test('TOPICS and generators line up', () => {
  assert.deepEqual(Object.keys(GENERATORS).sort(), TOPICS.map((t) => t.id).sort());
  const a = generate('proportion', 2, 77), b = generate('proportion', 2, 77);
  assert.deepEqual(a, b, 'same seed, same problem');
  assert.throws(() => generate('nope', 1, 1));
});

for (const t of TOPICS) {
  test(`${t.id}: ${SEEDS} seeds x 3 difficulties`, () => {
    const seen = new Set();
    for (const d of [1, 2, 3]) {
      for (let s = 1; s <= SEEDS; s++) {
        let q;
        try { q = generate(t.id, d, s * 7 + d * 100003); } catch (e) { assert.fail(`${t.id} d${d} seed ${s}: ${e.stack}`); }
        try {
          checkCommon(q, t.id, d);
          CHECK[t.id](q);
        } catch (e) {
          e.message = `${t.id} d${d} seed ${s * 7 + d * 100003}: ${e.message}`;
          throw e;
        }
        seen.add(q.id);
      }
    }
    assert.ok(seen.size > SEEDS, `plenty of different problems (${seen.size})`);
  });
}
