// Scholar's chests: question-locked chests spread over every zone (basic checks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from './bot-helpers.mjs';

const ZONES = { intro: 2, town: 4, academy: 2, forest: 8, dunes: 10, cove: 10, peaks: 10, aether: 10 };

test("scholar's chests: placed in every zone on reachable tiles, the same spots every visit", () => {
  const game = newGame({ name: 'Chesty', questions: 'auto' });
  for (const [z, n] of Object.entries(ZONES)) {
    game.debug.teleport(z, game.data.zones[z].entry || null);
    const spots = game.world.scholarSpots();
    assert.equal(spots.length, n, z);
    const ents = game.ents.all.filter((e) => e.data && e.data.scholar != null);
    assert.equal(ents.length, n, z + ' entities');
    game.debug.teleport('test', 'start');
    game.debug.teleport(z, game.data.zones[z].entry || null);
    assert.deepEqual(game.world.scholarSpots(), spots, z + ' deterministic');
  }
});

test("scholar's chests: a correct answer gives a permanent reward, a wrong one keeps the chest locked", async () => {
  const game = newGame({ name: 'Chesty2', questions: 'auto' });
  game.debug.scenario('forest', { classId: 'mage', level: 8 });
  const inv = game.sys.inventory, pr = game.sys.progression;
  const chests = game.ents.all.filter((e) => e.data && e.data.scholar != null);
  // wrong answer: stays closed
  const orig = game.sys.gates.ask;
  game.sys.gates.ask = () => Promise.resolve({ correct: false });
  assert.equal(await inv.openScholarChest(0, chests[0]), null);
  assert.ok(!game.flags.schest_forest_0);
  assert.ok(chests[0].interact, 'still openable');
  game.sys.gates.ask = orig;
  // correct answers: every chest pays out once
  const before = { power: game.player.stats.power, gold: inv.gold, boons: pr.pendingBoons };
  const kinds = [];
  for (const c of chests) kinds.push(await inv.openScholarChest(c.data.scholar, c));
  assert.ok(kinds.every((k) => ['power', 'hp', 'defense', 'gold', 'boon'].includes(k)), kinds.join());
  assert.ok(chests.every((c) => game.flags[c.data.flag] && !c.interact));
  const gotStat = kinds.some((k) => k === 'power' || k === 'hp' || k === 'defense');
  assert.ok(gotStat || inv.gold > before.gold, 'something was gained');
  if (kinds.includes('power')) assert.ok(game.player.stats.power > before.power, 'power went up');
  // opened chests stay empty
  assert.equal(await inv.openScholarChest(chests[0].data.scholar, null), undefined);
  // the bonus survives save/load
  const snap = JSON.parse(JSON.stringify(game.sys.save.snapshot ? game.sys.save.snapshot() : { systems: game.saveSystems(), flags: game.flags }));
  const g2 = newGame({ name: 'Chesty3', questions: 'auto' });
  g2.loadSystems(snap.systems);
  assert.deepEqual(g2.sys.progression.chestBonus, pr.chestBonus);
  assert.equal(g2.sys.progression.bonusBoons, pr.bonusBoons);
});
