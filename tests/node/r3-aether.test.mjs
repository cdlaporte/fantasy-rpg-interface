// tests/node/r3-aether.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { newGame, createBot } from './bot-helpers.mjs';
test('aether: boss, outro, homecoming, free play', async () => {
  const game = newGame({ questions: 'auto' }); const bot = createBot(game);
  game.debug.scenario('biome_boss', { zone: 'aether', level: 20, classId: 'warrior' });
  game.debug.god(true);
  await bot.until(() => !game.cutscene.active, { timeout: 120 });
  await bot.fight({ kind: 'malgrim_ascended', until: () => game.flags.malgrim_defeated, timeout: 600 });
  await bot.until(() => game.zone.id === 'town' && !game.cutscene.active && !game.inputLock, { timeout: 120 });
  assert.ok(game.flags.end_of_term && game.flags.chest_aether_malgrim);
  assert.equal(game.player.data.leash, null);
  await bot.travelVia('exit_aether', 'aether');
  assert.deepEqual(game.debug.errors(), []);
});
