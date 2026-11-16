// Round 4 mage masteries: mixed-fight DPS band (docs/MASTERY.md "Balance"). A mastery hits about +15% over the round-3
// target curve 62 x (L/12)^1.4 (L16 93 -> 107, L18 109 -> 125, L20 127 -> 146; L15 ~97), +-15%; Sage may trade up
// to 10% of it for healing. The two masteries of a subclass, and all six, stay within +-15% of each other, and every
// mastery out-damages its own subclass at the same level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../src/config.js';
import { mixedFight } from './kit-mage-lib.test.mjs';
import { MASTERIES, SEEDS, meanDpsM as runDps } from './r4-mage-lib.mjs';

const IDS = Object.keys(MASTERIES);
export const TARGET_M = (L) => 62 * Math.pow(L / 12, 1.4) * 1.15 * config.numberScale;
const LOW = { sage: 0.9 };                      // Sage: up to 10% less damage (it heals)
const LEVELS = [15, 16, 18, 20];
const memo = new Map();
const meanDpsM = (id, L) => { const k = id + L; if (!memo.has(k)) memo.set(k, runDps(id, L)); return memo.get(k); };

test('mastery DPS: each mage mastery at 15 / 16 / 18 / 20 inside the +15% band, pairs and all six within +-15%', () => {
  const table = [];
  const at = {};
  for (const L of LEVELS) {
    at[L] = {};
    for (const id of IDS) {
      const r = meanDpsM(id, L);
      at[L][id] = r.dps;
      const t = TARGET_M(L), lo = t * 0.85 * (LOW[id] || 1), hi = t * 1.15;
      table.push(`${id.padEnd(12)} L${L} ${(r.dps / config.numberScale).toFixed(1).padStart(6)} (target ${(t / config.numberScale).toFixed(0)}, x${(r.dps / t).toFixed(2)}, fight ${r.secs.toFixed(1)} s)`);
      assert.ok(r.cleared >= 0.75, `${id} L${L} clears the fight`);
      assert.ok(r.dps >= lo && r.dps <= hi, `${id} L${L} DPS ${(r.dps / config.numberScale).toFixed(1)} outside ${(lo / config.numberScale).toFixed(1)}..${(hi / config.numberScale).toFixed(1)}`);
    }
    const v = IDS.map((id) => at[L][id]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    for (const x of v) assert.ok(Math.abs(x - mean) / mean <= 0.15, `L${L} spread ${v.map((n) => (n / config.numberScale).toFixed(1))}`);
    for (const sub of ['conjurer', 'sorcerer', 'monk']) {
      const [a, b] = IDS.filter((id) => MASTERIES[id] === sub).map((id) => at[L][id]);
      assert.ok(Math.abs(a - b) / ((a + b) / 2) <= 0.15, `L${L} ${sub} pair ${(a / config.numberScale).toFixed(1)} vs ${(b / config.numberScale).toFixed(1)}`);
    }
  }
  console.log('# mage mastery DPS (x1, mean of ' + SEEDS.length + ' seeds)\n# ' + table.join('\n# '));
});

test('mastery DPS: every mastery out-damages its own subclass at 16 and 20', () => {
  for (const L of [16, 20]) {
    for (const sub of ['conjurer', 'sorcerer', 'monk']) {
      const base = SEEDS.reduce((a, sd) => a + mixedFight(sub, L, [], 45, sd).dps, 0) / SEEDS.length;
      for (const id of IDS.filter((m) => MASTERIES[m] === sub)) {
        const m = meanDpsM(id, L).dps;
        assert.ok(m > base, `${id} L${L} ${(m / config.numberScale).toFixed(1)} vs ${sub} ${(base / config.numberScale).toFixed(1)}`);
      }
    }
  }
});
