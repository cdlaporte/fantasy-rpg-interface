// Day 1: extended ratios for angle and side measures (typed number).
//  - two complementary / supplementary angles in the ratio a:b (find the smaller or the larger)
//  - the angles of a triangle in the ratio a:b:c (find one of them)
//  - the sides of a triangle in the ratio a:b:c with a given perimeter (find one side)
import { numberQuestion } from './common.js';
import { gcd, lin, DEG, ANG } from './util.js';

const TOPIC = 'extended_ratio';

function pairRatio(rng, total) {
  const opts = [];
  for (let a = 1; a < 20; a++) for (let b = a + 1; b < 20; b++) {
    if (gcd(a, b) === 1 && total % (a + b) === 0 && total / (a + b) >= 2) opts.push([a, b]);
  }
  return rng.pick(opts);
}

function twoAngles(rng) {
  const supp = rng.chance(0.45);
  const total = supp ? 180 : 90;
  let [a, b] = pairRatio(rng, total);
  if (rng.chance(0.5)) [a, b] = [b, a];
  const k = total / (a + b);
  const askSmall = rng.chance(0.55);
  const ans = askSmall ? Math.min(a, b) * k : Math.max(a, b) * k;
  const kind = supp ? 'supplementary' : 'complementary';
  const prompt = `The ratio of the measures of two ${kind} angles is ${a}:${b}. What is the measure of the ${askSmall ? 'smaller' : 'larger'} angle?`;
  const solution = [
    `${kind[0].toUpperCase() + kind.slice(1)} angles add up to ${total}${DEG}.`,
    `Let the angles be ${lin(a, 0)} and ${lin(b, 0)}: ${lin(a, 0)} + ${lin(b, 0)} = ${total}`,
    `${a + b}x = ${total}, so x = ${k}`,
    `The angles are ${a * k}${DEG} and ${b * k}${DEG}.`,
    `The ${askSmall ? 'smaller' : 'larger'} angle is ${ans}${DEG}.`,
  ];
  return numberQuestion({ topic: TOPIC, difficulty: 0, prompt, answer: ans, answerText: `${ans}${DEG}`, unknown: null,
    solution, data: { kind, ratio: [a, b], total, ask: askSmall ? 'smaller' : 'larger' } });
}

function triAngles(rng, hard) {
  const opts = [];
  for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) for (let c = 1; c <= 12; c++) {
    const s = a + b + c;
    if (180 % s !== 0) continue;
    if (gcd(gcd(a, b), c) !== 1) continue;
    if (a === b && b === c) continue;
    const k = 180 / s;
    if (Math.min(a, b, c) * k < 10) continue;
    if (hard !== (s >= 12)) continue;
    opts.push([a, b, c]);
  }
  const [a, b, c] = rng.pick(opts);
  const k = 180 / (a + b + c);
  const angles = [a * k, b * k, c * k];
  const letters = rng.pick([['A', 'B', 'C'], ['P', 'Q', 'R'], ['J', 'K', 'L'], ['X', 'Y', 'Z']]);
  const mode = rng.pick(['largest', 'smallest', 'named', 'named']);
  let ans, ask, prompt;
  const base = `The ratio of the measures of the three angles in a triangle is ${a}:${b}:${c}.`;
  if (mode === 'named' || new Set(angles).size < 3) {
    const i = rng.int(0, 2);
    ans = angles[i];
    ask = `${ANG}${letters[i]}`;
    prompt = `In Δ${letters.join('')}, the measures of ${ANG}${letters[0]}, ${ANG}${letters[1]} and ${ANG}${letters[2]} are in the ratio ${a}:${b}:${c}. Find m${ANG}${letters[i]}.`;
  } else {
    ans = mode === 'largest' ? Math.max(...angles) : Math.min(...angles);
    ask = `${mode} angle`;
    prompt = `${base} Find the measure of the ${mode} angle.`;
  }
  const solution = [
    `The angles of a triangle add up to 180${DEG}.`,
    `${lin(a, 0)} + ${lin(b, 0)} + ${lin(c, 0)} = 180`,
    `${a + b + c}x = 180, so x = ${k}`,
    `The angles are ${angles.map((v) => v + DEG).join(', ')}.`,
    mode === 'named' || new Set(angles).size < 3 ? `m${ask} = ${ans}${DEG}` : `The ${mode} angle is ${ans}${DEG}.`,
  ];
  return numberQuestion({ topic: TOPIC, difficulty: 0, prompt, answer: ans, answerText: `${ans}${DEG}`, unknown: null,
    solution, data: { kind: 'triangle_angles', ratio: [a, b, c], angles, ask } });
}

function triSides(rng) {
  for (let t = 0; t < 400; t++) {
    const a = rng.int(2, 24), b = rng.int(2, 24), c = rng.int(2, 24);
    if (gcd(gcd(a, b), c) !== 1) continue;
    if (a + b <= c || a + c <= b || b + c <= a) continue;
    if (a === b && b === c) continue;
    const k = rng.int(2, 9);
    const sides = [a * k, b * k, c * k];
    const P = sides[0] + sides[1] + sides[2];
    if (P > 400) continue;
    const unit = rng.pick(['feet', 'inches', 'centimeters', 'meters', 'yards']);
    const mode = rng.pick(['longest', 'shortest', 'named', 'named']);
    if (new Set(sides).size < 3 && mode !== 'named') continue;
    const L = rng.pick([['A', 'B', 'C'], ['D', 'E', 'F'], ['R', 'S', 'T'], ['L', 'M', 'N']]);
    const names = [L[0] + L[1], L[1] + L[2], L[2] + L[0]];
    let ans, ask, prompt;
    if (mode === 'named') {
      const i = rng.int(0, 2);
      ans = sides[i]; ask = names[i];
      prompt = `In \u0394${L.join('')}, the sides ${names[0]}, ${names[1]} and ${names[2]} are in the ratio ${a}:${b}:${c}. The perimeter of the triangle is ${P} ${unit}. Find ${names[i]}.`;
    } else {
      ans = mode === 'longest' ? Math.max(...sides) : Math.min(...sides);
      ask = mode;
      prompt = `The ratio of the measures of the sides of a triangle is ${a}:${b}:${c}. If the perimeter of the triangle is ${P} ${unit}, find the length of the ${mode} side.`;
    }
    const solution = [
      `The three sides add up to the perimeter.`,
      `${lin(a, 0)} + ${lin(b, 0)} + ${lin(c, 0)} = ${P}`,
      `${a + b + c}x = ${P}, so x = ${k}`,
      mode === 'named' ? `${names[0]} = ${sides[0]}, ${names[1]} = ${sides[1]}, ${names[2]} = ${sides[2]}` : `The sides are ${sides.join(', ')} ${unit}.`,
      `Answer: ${ans} ${unit}`,
    ];
    return numberQuestion({ topic: TOPIC, difficulty: 0, prompt, answer: ans, answerText: `${ans} ${unit}`, unknown: null,
      solution, data: { kind: 'triangle_sides', ratio: [a, b, c], perimeter: P, sides, ask } });
  }
  return triAngles(rng, false);
}

export function generate(rng, difficulty = 1) {
  let q;
  if (difficulty <= 1) q = rng.chance(0.75) ? twoAngles(rng) : triAngles(rng, false);
  else if (difficulty === 2) q = rng.pick([twoAngles, (g) => triAngles(g, false), (g) => triAngles(g, true), triSides])(rng);
  else q = rng.pick([(g) => triAngles(g, true), triSides, triSides])(rng);
  q.difficulty = difficulty;
  q.id = q.id.replace('-d0-', `-d${difficulty}-`);
  return q;
}

export default { id: TOPIC, generate };
