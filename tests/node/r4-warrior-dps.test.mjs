// Round 4: the six warrior masteries in the kit-warrior mixed fight (r4-warrior-lib.mjs fightM) at levels 15 / 16 / 18
// / 20: inside the mastery band (round 3 band x 1.15, docs/MASTERY.md) +-15%, the two masteries of each subclass within
// +-15% of each other, all six within +-15% of their mean, and every mastery above its own subclass in the same rig.
// KIT_DPS_TABLE=1 prints the table (ratios to the target).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PARENT, MASTERIES, MTARGET, avgDpsM } from './r4-warrior-lib.mjs';

const LEVELS = [15, 16, 18, 20];

test('round 4: warrior masteries at 15 / 16 / 18 / 20 inside the mastery band, pairs and all six within +-15%', () => {
  const rows = {};
  for (const m of MASTERIES) for (const lv of LEVELS) rows[m + '@' + lv] = avgDpsM(m, lv);
  if (process.env.KIT_DPS_TABLE) {
    for (const m of MASTERIES) console.log(m.padEnd(11), LEVELS.map((lv) => (rows[m + '@' + lv] / MTARGET(lv)).toFixed(3)).join('  '));
  }
  for (const k in rows) {
    const lv = +k.split('@')[1];
    const r = rows[k] / MTARGET(lv);
    assert.ok(r > 0.85 && r < 1.15, `${k}: ${rows[k].toFixed(1)} vs target ${MTARGET(lv).toFixed(1)} (${r.toFixed(3)})`);
  }
  for (const lv of LEVELS) {
    const v = MASTERIES.map((m) => rows[m + '@' + lv]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    for (const x of v) assert.ok(Math.abs(x / mean - 1) < 0.15, `L${lv} masteries within 15%: ${v.map((y) => y.toFixed(1))}`);
    for (const sub of ['knight', 'berserker', 'battlemage']) {
      const [a, b] = MASTERIES.filter((m) => PARENT[m] === sub).map((m) => rows[m + '@' + lv]);
      assert.ok(Math.abs(a / b - 1) < 0.15, `L${lv} ${sub} masteries within 15%: ${a.toFixed(1)} / ${b.toFixed(1)}`);
    }
  }
});

test('round 4: a mastery out-damages its own subclass at 16 and 20 (the tier-3 power spike)', () => {
  for (const lv of [16, 20]) {
    for (const sub of ['knight', 'berserker', 'battlemage']) {
      const base = avgDpsM(sub, lv, 4);
      for (const m of MASTERIES.filter((x) => PARENT[x] === sub)) {
        const v = avgDpsM(m, lv, 4);
        assert.ok(v > base * 1.03, `L${lv} ${m} ${v.toFixed(1)} > ${sub} ${base.toFixed(1)}`);
      }
    }
  }
});
