// Day 1: write a ratio in simplest form (word problems, multiple choice "7:4").
// Distractors are the usual mistakes: not simplified, half simplified, reversed, part-to-whole instead of part-to-part.
import { choiceQuestion, mixChoices } from './common.js';
import { gcd } from './util.js';

const TOPIC = 'ratio_simplest';

const PAIRS = [
  ['elementary schools', 'middle schools', 'A school district has {a} elementary schools and {b} middle schools.'],
  ['treadmills', 'ellipticals', 'A gym has {a} treadmills and {b} ellipticals.'],
  ['spell books', 'history books', 'The Academy library has {a} spell books and {b} history books.'],
  ['red potions', 'blue potions', 'The potion shop has {a} red potions and {b} blue potions on its shelves.'],
  ['oak trees', 'pine trees', 'The Whispering Woods have {a} oak trees and {b} pine trees along the trail.'],
  ['girls', 'boys', 'A geometry class has {a} girls and {b} boys.'],
  ['dogs', 'cats', 'An animal shelter has {a} dogs and {b} cats.'],
];

const TEAMS = ['hockey team', 'soccer team', 'basketball team', 'Academy dueling club', 'volleyball team'];

const WORDS = ['FLASHLIGHT', 'PROPORTION', 'CONGRUENT', 'DIAGONAL', 'POTION', 'MOUNTAIN', 'TREASURE', 'SPELLBOOK',
  'CHECKERBOARD', 'WIZARD', 'DRAGON', 'TRIANGLE', 'PENTAGON', 'BISECTOR', 'QUADRILATERAL', 'TRANSVERSAL',
  'PARALLELOGRAM', 'SIMILAR', 'FLINKERTON', 'LANTERN', 'HEDGEHOG', 'PROTRACTOR', 'EQUATION', 'AUDITORIUM'];

const INSTRUMENTS = ['trumpets', 'clarinets', 'violins', 'flutes', 'trombones', 'drums', 'guitars'];

const r = (a, b) => `${a}:${b}`;
function simp(a, b) { const g = gcd(a, b) || 1; return [a / g, b / g]; }

/** distractor list for the ratio a:b (not yet simplified). */
function mistakes(a, b, extra = []) {
  const [p, q] = simp(a, b);
  const g = gcd(a, b);
  const out = [r(a, b), r(q, p)];
  // half simplified: divided by a proper factor of the gcd only
  for (let f = 2; f < g; f++) if (g % f === 0) { out.push(r(a / f, b / f)); break; }
  out.push(...extra);
  out.push(r(b, a));
  return out;
}

function fillWith(rng, p, q) {
  return () => {
    const a = Math.max(1, p + rng.int(-2, 2)), b = Math.max(1, q + rng.int(-2, 2));
    return gcd(a, b) === 1 && !(a === p && b === q) ? r(a, b) : null;
  };
}

function twoThings(rng) {
  const [n1, n2, text] = rng.pick(PAIRS);
  let p, q;
  do { p = rng.int(1, 9); q = rng.int(1, 9); } while (p === q || gcd(p, q) !== 1);
  const k = rng.int(2, Math.max(2, Math.floor(60 / Math.max(p, q))));
  const a = p * k, b = q * k;
  const flip = rng.chance(0.35);
  const [x, y, nx, ny] = flip ? [b, a, n2, n1] : [a, b, n1, n2];
  const [sp, sq] = simp(x, y);
  const prompt = `${text.replace('{a}', a).replace('{b}', b)} Write the ratio of ${nx} to ${ny} in simplest form.`;
  const solution = [
    `${nx} to ${ny} = ${x}:${y}`,
    `The greatest common factor of ${x} and ${y} is ${gcd(x, y)}.`,
    `${x} ÷ ${gcd(x, y)} = ${sp} and ${y} ÷ ${gcd(x, y)} = ${sq}`,
    `Simplest form: ${sp}:${sq}`,
  ];
  return { prompt, x, y, extra: [], solution, data: { kind: 'pair', first: x, second: y } };
}

function winsLosses(rng) {
  const team = rng.pick(TEAMS);
  let p, q;
  do { p = rng.int(1, 9); q = rng.int(1, 9); } while (p === q || gcd(p, q) !== 1);
  const kMax = Math.max(2, Math.floor(90 / (p + q)));
  const k = rng.int(2, kMax);
  const W = p * k, L = q * k, G = W + L;
  const lossesFirst = rng.chance(0.25);
  const [x, y] = lossesFirst ? [L, W] : [W, L];
  const [sp, sq] = simp(x, y);
  const what = lossesFirst ? 'losses to wins' : 'wins to losses';
  const prompt = `The ${team} played ${G} games last season and won ${W} of them. They lost every other game (no ties). What is their ratio of ${what} in simplest form?`;
  const solution = [
    `Losses = games played ${'−'} wins = ${G} ${'−'} ${W} = ${L}`,
    `${what} = ${x}:${y}`,
    `Divide both by ${gcd(x, y)}: ${sp}:${sq}`,
  ];
  const wt = simp(lossesFirst ? L : W, G);
  const extra = [r(wt[0], wt[1]), r(lossesFirst ? L : W, G)];
  return { prompt, x, y, extra, solution, data: { kind: 'games', games: G, wins: W, losses: L, lossesFirst } };
}

function vowels(rng) {
  const word = rng.pick(WORDS);
  const v = [...word].filter((c) => 'AEIOU'.includes(c)).length;
  const n = word.length, c = n - v;
  const mode = rng.pick(['total', 'total', 'consonants']);
  const [x, y] = mode === 'total' ? [v, n] : [v, c];
  const [sp, sq] = simp(x, y);
  const what = mode === 'total' ? 'vowels to total letters' : 'vowels to consonants';
  const prompt = `In the word ${word}, what is the ratio of ${what}? Write it in simplest form.`;
  const solution = [
    `${word} has ${n} letters: ${v} vowels and ${c} consonants (A, E, I, O, U are vowels).`,
    `${what} = ${x}:${y}`,
    gcd(x, y) > 1 ? `Divide both by ${gcd(x, y)}: ${sp}:${sq}` : `${x} and ${y} have no common factor, so ${sp}:${sq} is already simplest.`,
  ];
  const other = mode === 'total' ? simp(v, c) : simp(v, n);
  const extra = [r(other[0], other[1]), r(c, v), r(c, n)];
  return { prompt, x, y, extra, solution, data: { kind: 'word', word, vowels: v, letters: n, mode } };
}

function store(rng, wantTotal) {
  for (let tries = 0; tries < 200; tries++) {
    const names = rng.shuffle(INSTRUMENTS).slice(0, rng.int(4, 5));
    const counts = names.map(() => rng.int(4, 30) * 2);
    const total = counts.reduce((s, x) => s + x, 0);
    const i = rng.int(0, names.length - 1);
    let j = rng.int(0, names.length - 2); if (j >= i) j++;
    const x = counts[i];
    const y = wantTotal ? total : counts[j];
    if (x === y) continue;
    const g = gcd(x, y);
    if (g < 2) continue;
    if (wantTotal && y / g > 60) continue;
    const list = names.map((nm, k) => `${counts[k]} ${nm}`);
    const listText = list.slice(0, -1).join(', ') + ', and ' + list[list.length - 1];
    const what = wantTotal ? `${names[i]} to total instruments` : `${names[i]} to ${names[j]}`;
    const prompt = `A music store has ${listText} in stock. Write the ratio of ${what} in simplest form.`;
    const [sp, sq] = simp(x, y);
    const solution = wantTotal
      ? [`Total instruments = ${counts.join(' + ')} = ${total}`, `${what} = ${x}:${total}`, `Divide both by ${g}: ${sp}:${sq}`]
      : [`${what} = ${x}:${y}`, `Divide both by ${g}: ${sp}:${sq}`];
    const extra = [];
    if (wantTotal) { const pp = simp(x, total - x); extra.push(r(pp[0], pp[1])); }
    else { const t = simp(x, total); extra.push(r(t[0], t[1])); }
    return { prompt, x, y, extra, solution, data: { kind: 'store', counts, names, i, j: wantTotal ? -1 : j, total } };
  }
  return twoThings(rng);
}

export function generate(rng, difficulty = 1) {
  let p;
  if (difficulty <= 1) p = rng.chance(0.8) ? twoThings(rng) : vowels(rng);
  else if (difficulty === 2) p = rng.pick([winsLosses, vowels, (g) => store(g, false), twoThings])(rng);
  else p = rng.pick([winsLosses, (g) => store(g, true), (g) => store(g, true), vowels])(rng);
  const [sp, sq] = simp(p.x, p.y);
  const right = r(sp, sq);
  const { choices, answerIndex } = mixChoices(rng, right, mistakes(p.x, p.y, p.extra), 4, fillWith(rng, sp, sq));
  return choiceQuestion({
    topic: TOPIC, difficulty, prompt: p.prompt, choices, answerIndex, solution: p.solution,
    data: { ...p.data, x: p.x, y: p.y, simplest: [sp, sq] },
  });
}

export default { id: TOPIC, generate };
