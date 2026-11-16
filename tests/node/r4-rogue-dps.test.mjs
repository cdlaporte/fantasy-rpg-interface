// Round 4 rogue masteries: mixed-fight DPS (the round-3 rig of kit-rogue-dps.test.mjs: one elite rat x2.5 hp + four
// normal rats of the level, fighting back, scripted sensible play, 8 seeds, the subclass boon picks) against the mastery
// target: +15% over the round-3 band (docs/MASTERY.md: ~97 / 107 / 125 / 146 at 15 / 16 / 18 / 20, x number scale).
// The table prints as test diagnostics and is recorded in docs/notes/r4-rogue.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTERIES, meanDps, masteryTarget, band } from './r4-rogue-lib.mjs';

const LEVELS = [15, 16, 18, 20];
const BAND = 0.15;

test('rogue masteries: DPS at 15 / 16 / 18 / 20 is ~+15% over the round-3 band, pairs and all six within +-15%', (t) => {
  const bad = [];
  const subs = {};
  for (const sub of ['archer', 'thief', 'ninja']) subs[sub] = LEVELS.map((L) => meanDps(sub, null, L));
  const table = {};
  t.diagnostic('mastery       ' + LEVELS.map((L) => ('L' + L).padStart(15)).join(''));
  for (const [id, sub] of MASTERIES) {
    const row = LEVELS.map((L) => meanDps(sub, id, L));
    table[id] = row;
    t.diagnostic(id.padEnd(14) + row.map((v, i) => `${(v / 6).toFixed(1)} (${Math.round(v / masteryTarget(LEVELS[i]) * 100)}%)`.padStart(15)).join(''));
    row.forEach((v, i) => {
      const L = LEVELS[i];
      if (Math.abs(v / masteryTarget(L) - 1) > BAND) bad.push(`${id} L${L}: ${v.toFixed(0)} vs target ${masteryTarget(L).toFixed(0)}`);
      if (!(v > subs[sub][i] * 1.05)) bad.push(`${id} L${L} is not stronger than the ${sub}: ${v.toFixed(0)} vs ${subs[sub][i].toFixed(0)}`);
    });
  }
  t.diagnostic('target        ' + LEVELS.map((L) => (masteryTarget(L) / 6).toFixed(1).padStart(15)).join(''));
  for (const sub of ['archer', 'thief', 'ninja']) t.diagnostic(`(${sub})`.padEnd(14) + subs[sub].map((v, i) => `${(v / 6).toFixed(1)} (${Math.round(v / band(LEVELS[i]) * 100)}% r3)`.padStart(15)).join(''));
  LEVELS.forEach((L, i) => {
    // the two masteries of each subclass within +-15% of each other
    for (let k = 0; k < MASTERIES.length; k += 2) {
      const a = table[MASTERIES[k][0]][i], b = table[MASTERIES[k + 1][0]][i];
      if (Math.abs(a / b - 1) > BAND) bad.push(`L${L} ${MASTERIES[k][0]} ${a.toFixed(0)} vs ${MASTERIES[k + 1][0]} ${b.toFixed(0)}`);
    }
    const v = MASTERIES.map(([id]) => table[id][i]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    for (const x of v) if (Math.abs(x / mean - 1) > BAND) bad.push(`L${L} spread ${v.map((y) => y.toFixed(0))}`);
  });
  assert.deepEqual(bad, []);
});
