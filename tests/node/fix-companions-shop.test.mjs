// Regressions: classmates join after the class pick; buying at the potion shop completes "Stock up" (talk to Mira).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, createBot } from './bot-helpers.mjs';

test('the two classmates join (and stay) after the class pick', async () => {
  const game = newGame({ name: 'Comp', questions: 'auto' });
  const bot = createBot(game);
  bot.autoDialogue = false;
  game.debug.scenario('academy_pick');
  for (let i = 0; i < 4000; i++) {
    const m = game.modal;
    if (m && m.type === 'classPicker') game.commands.pickClass('mage');
    else if (m && m.type === 'dialogue') { if (m.options && m.options.length) game.commands.dialogueChoose(0); else game.commands.dialogueAdvance(); }
    await bot.step(1);
    if (!game.cutscene.active && game.flags.class_chosen && i > 50) break;
  }
  await bot.step(120);
  const kinds = game.ents.all.filter((e) => e.type === 'companion' && !e.removed).map((e) => e.kind).sort();
  assert.deepEqual(kinds, ['bram', 'pip']);
});

test('buying from the potion shop completes the "stock up" step', () => {
  const game = newGame({ name: 'Shop', questions: 'auto' });
  game.debug.scenario('town');
  game.debug.setClass('mage');
  game.setFlag('class_chosen', true);
  game.quests.start('main_first_steps');
  game.sys.inventory.addGold(200);
  assert.equal(game.quests.step('main_first_steps'), 0);
  game.ops.run([['shop', 'potions']], {});
  game.commands.shopBuy(game.modal.stock[0].id);
  assert.equal(game.quests.step('main_first_steps'), 1);
});
