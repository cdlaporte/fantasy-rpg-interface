// Round 3 QA: the four biomes played by the bot (questions 'auto'): town gates locked before `biomes_open` (with the
// toast), each exit leads to `entry_town` of its biome and back, one of every regular enemy kind killed, one rune chest
// opened through its question, the boss through both shield questions to its outro flag, and (Aether) the finale to the
// end with free play afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, createBot } from './bot-helpers.mjs';

const IDS = ['dunes', 'cove', 'peaks', 'aether'];
const alive = (game, ids) => ids.filter((i) => { const e = game.ents.get(i); return e && !e.removed && e.alive; });

test('town gates: locked with a toast before biomes_open, then each exit reaches its biome at entry_town and back', async () => {
  const game = newGame({ questions: 'auto' });
  const bot = createBot(game);
  const toasts = [];
  game.bus.on('toast', (t) => toasts.push(t.text));
  game.debug.scenario('forest', { level: 9 });
  assert.ok(!game.flags.biomes_open);
  for (const id of IDS) {
    toasts.length = 0;
    game.debug.teleport('town', 'gate_' + id);
    await bot.step(10);
    await bot.walkTo('exit_' + id, { r: 0.4, timeout: 30 });
    await bot.step(30);
    assert.equal(game.zone.id, 'town', id + ' gate locked');
    assert.ok(toasts.some((t) => /Sealed for now/.test(t)), id + ' locked toast ' + JSON.stringify(toasts));
  }
  game.setFlag('biomes_open', true);
  for (const id of IDS) {
    game.debug.teleport('town', 'gate_' + id);
    await bot.step(10);
    await bot.travelVia('exit_' + id, id);
    const m = game.world.marker('entry_town');
    assert.ok(Math.hypot(m.x - game.player.x, m.y - game.player.y) < 5, id + ' arrival at entry_town');
    await bot.travelVia('exit_town', 'town');
  }
  assert.deepEqual(game.debug.errors(), []);
});

for (const id of IDS) {
  test(`biome ${id}: each enemy kind dies, a rune chest opens, the boss falls through both shields to the outro`, async () => {
    const game = newGame({ questions: 'auto' });
    const bot = createBot(game);
    const z = game.data.zones[id];
    const B = z.boss;
    const kinds = [...new Set(z.spawns.map((s) => s.kind))].filter((k) => k !== B.kind);
    const lvl = z.levelRange[1] - 1;
    game.debug.scenario('biome', { zone: id, level: lvl, classId: 'warrior' });
    game.debug.god(true);
    // every regular kind, once
    const ids = kinds.map((k) => game.debug.spawn(k, 1)[0]);
    assert.ok(ids.every((x) => x != null), 'spawned ' + kinds);
    await bot.step(30);
    await bot.fight({ kind: kinds, timeout: 200, until: () => !alive(game, ids).length });
    assert.deepEqual(alive(game, ids), [], 'all kinds dead');
    // a rune chest: the question is asked, answered (auto), the chest opens
    const rc = z.chests.find((c) => c.rune);
    const m = game.world.marker(rc.at);
    game.debug.teleport(id, [m.x, m.y + 2.2]);
    await bot.step(10);
    const chest = game.ents.all.find((e) => e.data && e.data.chest === rc.id);
    await bot.walkTo(chest, { r: 1.1 });
    await bot.until(() => game.player.data.target === chest, { timeout: 3, what: 'target the chest', each: async () => bot.steer(chest.x, chest.y, 0.5) });
    bot.idle();
    await bot.interact();       // questions 'auto': the rune question is answered at once, no card
    await bot.until(() => game.flags['chest_' + id + '_' + rc.id], { timeout: 20, what: 'rune chest opened', modal: false });
    // the boss
    game.debug.scenario('biome_boss', { zone: id, level: lvl, classId: 'warrior' });
    game.debug.god(true);
    await bot.until(() => !game.cutscene.active && !game.modal, { timeout: 120 });
    let shields = 0;
    game.bus.on('boss:shield', (e) => { if (e.on && !e.retry) shields++; });
    await bot.fight({ kind: B.kind, until: () => game.flags[B.flag], timeout: 900 });
    assert.ok(game.flags[B.flag], 'defeat flag ' + B.flag);
    assert.ok(shields >= 2, 'two shields: ' + shields);
    if (id === 'aether') {
      await bot.until(() => game.zone.id === 'town' && !game.cutscene.active && !game.inputLock, { timeout: 180 });
      assert.ok(game.flags.end_of_term && game.flags.chest_aether_malgrim);
      assert.equal(game.player.data.leash, null);
      // free play: walk, and the Aether is open again without Malgrim
      const x0 = game.player.x, y0 = game.player.y;
      await bot.walkTo([x0, y0 + 3], { r: 0.6, timeout: 20 });
      assert.ok(Math.hypot(game.player.x - x0, game.player.y - y0) > 1);
      await bot.travelVia('exit_aether', 'aether');
      assert.ok(!game.ents.all.find((e) => e.kind === B.kind && !e.removed));
    } else {
      await bot.until(() => !game.cutscene.active && !game.inputLock, { timeout: 180 });
    }
    assert.deepEqual(game.debug.errors(), []);
  });
}
