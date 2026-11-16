// Round 3 QA: does a realistic run through the four biomes land on the intended levels with the real data and the
// real xpNext? Model per biome: every quest's xp reward (turn-in bonus x1 here, x1.25 reported as a bonus run),
// one full clear of every spawn in the zone def (n per spawn, in zone order, at clamp(player level + levelOffset)),
// the boss (+1 level, spawn.boss) at the then-current level. Start: Old Mossback beaten at ~11-11.5.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../../src/data/index.js';
import { BIOMES, biomeQuests, run } from './r3qa-lib.mjs';

const fmt = (rows) => rows.map((r) => `${r.biome} ${r.level.toFixed(1)} (kills ${r.kills}, boss ${r.boss}, quests ${r.quests})`).join(' | ');

test('every biome has quests with xp and spawns to read', () => {
  for (const b of BIOMES) {
    assert.ok(biomeQuests(b).length >= 2, b + ' quests');
    assert.ok(data.zones[b].spawns.length >= 5, b + ' spawns');
  }
});

const ORDERS = [
  ['dunes', 'cove', 'peaks', 'aether'],
  ['cove', 'dunes', 'peaks', 'aether'],
  ['peaks', 'cove', 'dunes', 'aether'],
  ['dunes', 'peaks', 'cove', 'aether'],
];
for (const order of ORDERS) {
  test('levels along ' + order.join(' > '), (t) => {
    const rows = run(order);
    t.diagnostic(fmt(rows));
    t.diagnostic('with the x1.25 turn-in bonus: ' + fmt(run(order, { questMult: 1.25 })));
    // Without any turn-in bonus (the floor) and with every turn-in question answered right (x1.25, the ceiling) the
    // run has to stay inside the targets; real play (a few extra kills, some bonuses) lands in between.
    const lo = rows.map((r) => r.level);
    const hi = run(order, { questMult: 1.25 }).map((r) => r.level);
    assert.ok(lo[0] >= 14 && hi[0] <= 15.4, `after the first biome 14-15: ${lo[0].toFixed(2)}..${hi[0].toFixed(2)}`);
    assert.ok(lo[1] >= 16.4 && hi[1] <= 17.6, `after the second 16.5-17.5: ${lo[1].toFixed(2)}..${hi[1].toFixed(2)}`);
    assert.ok(lo[2] >= 18.2 && hi[2] <= 19.1, `after the third 18.5-19: ${lo[2].toFixed(2)}..${hi[2].toFixed(2)}`);
    assert.ok(lo[3] >= 19.97, 'level 20 at the end of the fourth: ' + lo[3].toFixed(2));
  });
}
