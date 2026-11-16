// Integration bot: plays the REAL game in Node (questions in `auto` mode) from a new game to the forest boss and
// asserts every milestone. Scripted scenes run for real (no skipCutscene); debug helpers are used only where a bot
// fight would be flaky (level jump to 8, god mode for the grove). Timing measurements are printed as diagnostics
// and recorded in docs/notes/integration.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, createBot } from './bot-helpers.mjs';
import { createMemoryStorage } from '../../src/platform/storage.js';
import data from '../../src/data/index.js';

/** JSON of every data table: the game must never mutate shared data (other tests and new games reuse it). */
function dataSnapshot() {
  const o = {};
  for (const k of Object.keys(data)) for (const id of Object.keys(data[k] || {})) {
    try { o[k + '.' + id] = JSON.stringify(data[k][id]); } catch { o[k + '.' + id] = '?'; }
  }
  return o;
}
function mutated(before) {
  const after = dataSnapshot();
  return Object.keys(before).filter((k) => before[k] !== after[k]);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function watch(game) {
  const ev = { down: 0, revived: [], used: [], asks: [], shields: [], cs: [], errors: [], quests: [] };
  game.bus.on('player:down', () => ev.down++);
  game.bus.on('player:revived', (r) => ev.revived.push(r.where));
  game.bus.on('item:used', (i) => ev.used.push(i.id));
  game.bus.on('gate:ask', (g) => ev.asks.push(g.req.context));
  game.bus.on('boss:shield', (b) => { if (b.on) ev.shields.push(b.index); });
  game.bus.on('cutscene:start', (c) => ev.cs.push(c.id));
  game.bus.on('quest:done', (q) => ev.quests.push(q.id));
  game.bus.on('story:warn', (w) => ev.errors.push(w.msg));
  return ev;
}

test('bot: new game -> intro -> ambush -> rescue -> town -> class pick -> forest -> save/reload -> grove boss', async (t) => {
  const snap0 = dataSnapshot();
  const storage = createMemoryStorage();
  let game = newGame({ name: 'Robin', storage, questions: 'auto' });
  let bot = createBot(game);
  let ev = watch(game);
  const marks = {};
  const mark = (k) => { marks[k] = +game.t.toFixed(1); };

  await t.test('intro_wake tutorial: stick, rats, giant rat, level 3', async () => {
    assert.equal(game.zone.id, 'intro');
    assert.equal(game.player.look.hood, true, 'starts cloaked');
    await bot.until(() => game.cutscene.active === 'intro_wake', { timeout: 2, what: 'intro_wake starts' });
    await bot.until(() => game.inputLock === 0 && game.cutscene.tutorial, { timeout: 20, what: 'control after the opening walk' });
    assert.deepEqual(game.cutscene.tutorial.keys, ['W', 'A', 'S', 'D']);
    assert.ok(game.hudState().tutorial, 'HudState.tutorial is filled');
    mark('control');
    // no attacks before the stick
    bot.input.set({ attackDir: 0 }); await bot.step(30); bot.idle();
    assert.equal(game.flags.has_stick, undefined);
    await bot.walkTo('stick', { r: 0.9 });
    await bot.until(() => game.player.data.target && game.player.data.target.kind === 'stick_pickup', { timeout: 3, what: 'stick is the E target' });
    assert.equal(game.hudState().prompt.key, 'E');
    await bot.interact();
    await bot.until(() => game.flags.has_stick, { timeout: 2, what: 'has_stick' });
    assert.equal(game.player.look.held.style, 'stick');
    mark('stick');
    await bot.until(() => game.ents.all.some((e) => e.kind === 'rat'), { timeout: 5, what: 'rats spawn' });
    await bot.walkTo('rats_1', { r: 3 });
    await bot.fight({ kind: 'rat', until: () => game.quests.step('main_enroll') >= 3 });
    mark('rats_1');
    await bot.walkTo('rats_2', { r: 3 });
    await bot.fight({ kind: 'rat', until: () => game.quests.step('main_enroll') >= 4 });
    mark('rats_2');
    await bot.walkTo('big_rat', { r: 3 });
    await bot.fight({ kind: 'giant_rat', kite: true, until: () => game.quests.step('main_enroll') >= 5 });
    mark('giant_rat');
    assert.equal(ev.down, 0, 'the tutorial never downs a bot that fights straight');
    assert.ok(game.progression.level >= 3, 'level 3 by the clearing (got ' + game.progression.level + ')');
    await bot.until(() => game.flags.tutorial_done, { timeout: 10, what: 'tutorial_done' });
    assert.equal(game.cutscene.tutorial, null, 'tutorial prompt cleared');
  });

  assert.deepEqual(mutated(snap0), [], 'data untouched after the tutorial');

  await t.test('ambush: real fight, floor at 1 HP, cannot leave the barrier', async () => {
    await bot.walkTo('clearing', { r: 1.5 });
    await bot.until(() => game.cutscene.active === 'ambush', { timeout: 5, what: 'ambush trigger' });
    mark('ambush');
    assert.equal(game.player.data.leash && game.player.data.leash.r > 0, true, 'barrier leash');
    await bot.until(() => game.inputLock === 0, { timeout: 30, what: 'ambush control' });
    mark('ambush_fight');
    const c = game.world.marker('clearing');
    // try to walk out of the barrier
    bot.input.set({ moveX: 0, moveY: 1 }); await bot.seconds(2); bot.idle();
    assert.ok(dist(game.player, c) <= 4.05, 'held inside the barrier (' + dist(game.player, c).toFixed(2) + ')');
    let minHp = Infinity;
    await bot.fight({ until: () => game.cutscene.active !== 'ambush', timeout: 40, each: null });
    minHp = Math.min(minHp, game.player.hp);
    mark('ambush_end');
    assert.equal(game.flags.ambush_done, true);
    assert.equal(game.player.hp, 1, 'dropped to exactly 1 HP');
    assert.equal(ev.down, 0, 'never downed during the ambush');
    const fight = marks.ambush_end - marks.ambush_fight;
    t.diagnostic(`ambush fight lasted ${fight.toFixed(1)} s`);
    assert.ok(fight >= 8 && fight <= 22, 'ambush lasts ~10-20 s, got ' + fight);
  });

  await t.test('rescue: the spell clears enemies, potion from slot 1, look picker removes the cloak', async () => {
    await bot.until(() => game.cutscene.active === 'rescue', { timeout: 3, what: 'rescue chains' });
    assert.equal(game.player.data.minHp, 1, 'HP floor carried into rescue');
    await bot.until(() => game.cutscene.tutorial && /Press 1/.test(game.cutscene.tutorial.text), { timeout: 120, what: 'potion prompt' });
    mark('potion_prompt');
    assert.equal(game.ents.all.filter((e) => e.type === 'enemy' && !e.removed).length, 0, 'Laporte cleared every enemy');
    assert.equal(game.player.data.leash, null, 'barrier gone');
    assert.equal(game.inventory.hotbar[0], 'potion_small', 'potion on hotbar slot 1');
    await bot.press('item1');
    assert.equal(ev.used[0], 'potion_small');
    const lp = await bot.waitModal('lookPicker', { timeout: 60 });
    assert.equal(lp.looks.length, 8);
    game.commands.pickLook(1);
    await bot.until(() => game.flags.look_chosen, { timeout: 5, what: 'look_chosen' });
    assert.equal(game.flags.look_choice, 1);
    assert.notEqual(game.player.look.hood, true, 'hood off');
    assert.notEqual(game.player.look.outfit.style, 'cloak', 'cloak gone');
    assert.equal(game.player.data.minHp, undefined, 'floor cleared once healed');
    await bot.until(() => game.inputLock === 0 && game.cutscene.tutorial && /Follow/.test(game.cutscene.tutorial.text), { timeout: 60, what: 'escort' });
    mark('escort');
    await bot.until(() => game.zone.id === 'town', {
      timeout: 120, what: 'escort to town',
      each: async () => { const l = game.ents.find('laporte'); if (l && game.inputLock === 0) bot.steer(l.x, l.y, 1.2); },
    });
    mark('town');
    assert.equal(game.flags.intro_done, true);
  });

  assert.deepEqual(mutated(snap0), [], 'data untouched after the rescue');

  await t.test('town_arrival -> academy -> class_pick', async () => {
    await bot.until(() => game.cutscene.active === 'town_arrival', { timeout: 5, what: 'town_arrival' });
    await bot.until(() => game.zone.id === 'academy', {
      timeout: 200, what: 'town_arrival escort',
      each: async () => { const l = game.ents.find('laporte'); if (l && game.inputLock === 0) bot.steer(l.x, l.y, 1.2); },
    });
    mark('academy');
    const cp = await bot.waitModal('classPicker', { timeout: 60 });
    mark('class_picker');
    assert.deepEqual(cp.classes.map((c) => c.id).sort(), ['mage', 'rogue', 'warrior']);
    game.commands.pickClass('warrior');
    await bot.choose(/team up/);
    await bot.until(() => !game.cutscene.active, { timeout: 60, what: 'class_pick ends' });
    mark('free_play');
    assert.equal(game.progression.classId, 'warrior');
    assert.equal(game.flags.class_chosen, true);
    assert.equal(game.flags.forest_open, true);
    assert.deepEqual(game.companions.active.map((c) => c.kind).sort(), ['elowen', 'pip']);
    assert.equal(game.quests.state('main_enroll'), 'done');
    assert.equal(game.quests.state('main_first_steps'), 'active');
    assert.equal(game.ents.find('bram') && game.ents.find('bram').type, 'npc', 'the rival stays');
    assert.equal(game.ents.all.filter((e) => e.kind === 'pip' && e.type === 'npc').length, 0, 'companions are not also NPCs');
    assert.notEqual(game.player.look.outfit.style, 'cloak');
    assert.equal(game.player.look.held && game.player.look.held.style !== 'stick', true, 'class weapon');
    assert.equal(game.player.hp, game.player.hpMax);
  });

  assert.deepEqual(mutated(snap0), [], 'data untouched after the class pick');

  await t.test('town: Mira, a shop purchase, out the west gate', async () => {
    await bot.travelVia('academy_exit', 'town');
    await bot.talkTo('mira');
    await bot.choose(/new student/);
    await bot.choose(/potions/);
    const shop = await bot.waitModal('shop');
    const gold0 = game.inventory.gold, n0 = game.inventory.count('potion_small');
    const item = shop.stock.find((s) => s.id === 'potion_small');
    assert.ok(item && item.canBuy, 'can afford a potion: ' + gold0 + ' gold');
    assert.equal(game.commands.shopBuy('potion_small'), true);
    assert.equal(game.inventory.gold, gold0 - item.price);
    assert.equal(game.inventory.count('potion_small'), n0 + 1);
    game.commands.closeModal(); await bot.step(2);
    await bot.finishDialogue();
    assert.equal(game.quests.step('main_first_steps'), 1, 'talked to Mira');
    await bot.walkTo('gate_forest', { r: 1.5, timeout: 120 });
    await bot.travelVia('exit_forest', 'forest');
    mark('forest');
  });

  await t.test('forest: Tam, five slimes, a chest, a boon at level 4', async () => {
    await bot.walkTo('ranger_camp', { r: 4 });
    assert.equal(game.quests.step('main_first_steps'), 2);
    await bot.talkTo('ranger_tam');
    await bot.choose(/Laporte sent/);
    await bot.choose(/Bye/);
    await bot.finishDialogue();
    assert.equal(game.quests.step('main_first_steps'), 3);
    const t0 = game.t;
    await bot.fight({ kind: ['slime', 'slime_small'], until: () => game.quests.step('main_first_steps') >= 4, timeout: 200, idleTo: [80, 62] });
    t.diagnostic(`five slimes took ${(game.t - t0).toFixed(1)} s`);
    mark('slimes');
    const chest = game.ents.all.find((e) => e.data.chest === 'chest_1');
    await bot.walkTo(chest, { r: 1.1 });
    await bot.until(() => game.player.data.target === chest, { timeout: 3, what: 'chest target', each: async () => bot.steer(chest.x, chest.y, 0.5) });
    const g0 = game.inventory.gold;
    await bot.interact(); await bot.step(3);
    assert.equal(game.flags.chest_forest_chest_1, true);
    assert.equal(chest.look.model, 'chest_open');
    assert.ok(game.inventory.gold > g0, 'chest gold');
    if (game.progression.level < 4) await bot.fight({ kind: ['slime', 'slime_small'], until: () => game.progression.level >= 4, timeout: 200, idleTo: [80, 62] });
    assert.ok(game.progression.pendingBoons >= 1, 'a boon is pending at level 4');
    await bot.press('boon');
    const bm = await bot.waitModal('boonPicker', { timeout: 2 });
    assert.ok(bm.options.length >= 2);
    game.commands.pickBoon(bm.options[0].id);
    await bot.step(2);
    assert.deepEqual(game.progression.boons, [bm.options[0].id]);
    mark('boon');
  });

  await t.test('save, reload into a fresh game object, continue', async () => {
    await bot.until(() => !game.save.pendingAutosave || !game.save.pendingAutosave(), { timeout: 5 });
    const json = game.save.now();
    const before = { level: game.progression.level, gold: game.inventory.gold, q: game.quests.step('main_first_steps'), boons: game.progression.boons.slice() };
    game = newGame({ name: 'Robin', storage, questions: 'auto', save: game.save.load('Robin') });
    bot = createBot(game);
    ev = watch(game);
    assert.equal(json.zone, 'forest');
    assert.equal(game.zone.id, 'forest');
    assert.equal(game.progression.level, before.level);
    assert.equal(game.progression.classId, 'warrior');
    assert.equal(game.inventory.gold, before.gold);
    assert.deepEqual(game.progression.boons, before.boons);
    assert.equal(game.quests.step('main_first_steps'), before.q);
    assert.equal(game.flags.chest_forest_chest_1, true);
    const c1 = game.ents.all.find((e) => e.data.chest === 'chest_1');
    assert.equal(c1.look.model, 'chest_open', 'opened chest stays open');
    assert.deepEqual(game.companions.active.map((c) => c.kind).sort(), ['elowen', 'pip']);
    assert.notEqual(game.player.look.outfit.style, 'cloak');
    await bot.seconds(1);
  });

  await t.test('defeat: revive question, then the infirmary', async () => {
    game.combat.damage(game.player, 9999, { type: 'true' });
    await bot.seconds(4);
    assert.deepEqual(ev.revived, ['here'], 'auto mode: the revive question is answered right');
    assert.equal(game.zone.id, 'forest');
    game.combat.damage(game.player, 9999, { type: 'true' });
    await bot.until(() => game.zone.id === 'academy' && !game.world.traveling, { timeout: 20, what: 'infirmary' });
    assert.equal(ev.revived[1], 'infirmary');
    assert.ok(dist(game.player, game.world.marker('infirmary')) < 1, 'woke in the infirmary');
    assert.equal(game.player.hp, game.player.hpMax);
  });

  await t.test('Laporte finishes First Steps; a lesson', async () => {
    await bot.talkTo('laporte');
    await bot.choose(/Thanks/);
    await bot.finishDialogue();
    assert.equal(game.quests.state('main_first_steps'), 'done');
    assert.ok(ev.asks.includes('quest_turnin'));
    const g0 = game.inventory.gold;
    await bot.useProp('lesson_desk_1');
    const les = await bot.waitModal('lesson', { timeout: 5 });
    assert.equal(les.total, 3);
    await bot.until(() => game.modal && game.modal.finished, { timeout: 30, what: 'lesson finished' });
    assert.equal(game.modal.correct, 3);
    game.commands.closeModal(); await bot.step(2);
    assert.ok(game.inventory.gold > g0, 'lesson pays gold');
    assert.equal(ev.asks.filter((a) => a === 'lesson').length, 3);
  });

  await t.test('level 8: boons by Tab, spec ceremony with Laporte', async () => {
    game.debug.setLevel(8); await bot.step(2);
    assert.equal(game.flags.spec_ready, true);
    while (game.progression.pendingBoons > 0) {
      await bot.press('boon');
      const m = await bot.waitModal('boonPicker', { timeout: 2 });
      game.commands.pickBoon(m.options[0].id); await bot.step(2);
    }
    await bot.press('boon'); await bot.step(1);
    assert.equal(game.modal, null, 'Tab does not open the spec picker before the ceremony');
    await bot.talkTo('laporte');
    await bot.choose(/wanted to see me/);
    const sp = await bot.waitModal('specPicker', { timeout: 60 });
    assert.deepEqual(sp.options.map((o) => o.id).sort(), ['battlemage', 'berserker', 'knight']);
    game.commands.pickSpec('knight');
    await bot.until(() => !game.cutscene.active && !game.modal, { timeout: 60, what: 'spec_ceremony ends' });
    assert.equal(game.progression.specId, 'knight');
    assert.equal(game.flags.spec_ceremony_done, true);
    mark('spec');
  });

  await t.test('grove: Tam quest, rune gate question, saplings, Mossback with two shield questions', async () => {
    await bot.travelVia('academy_exit', 'town');
    await bot.walkTo('gate_forest', { r: 1.5, timeout: 120 });
    await bot.travelVia('exit_forest', 'forest');
    await bot.talkTo('ranger_tam');
    await bot.choose(/Any work/); await bot.choose(/open the grove/); await bot.choose(/Bye/);
    await bot.finishDialogue();
    assert.equal(game.quests.state('forest_sealed_grove'), 'active');
    game.debug.god(true);
    await bot.walkTo('grove_gate', { r: 2.5, timeout: 200 });
    const seal = game.ents.all.find((e) => e.kind === 'rune_seal');
    assert.ok(seal, 'the grove is sealed');
    await bot.walkTo(seal, { r: 1.4 });
    await bot.until(() => game.player.data.target === seal, { timeout: 3, what: 'seal target', each: async () => bot.steer(seal.x, seal.y, 0.8) });
    await bot.interact(); await bot.step(5);
    assert.ok(ev.asks.includes('gate'), 'the gate asked a question');
    assert.equal(game.flags.gate_grove_seal, true);
    await bot.fight({ kind: 'treant_sapling', until: () => game.quests.step('forest_sealed_grove') >= 3, timeout: 200, idleTo: [16.5, 33.5] });
    await bot.walkTo('boss_arena', { r: 4, timeout: 100 });
    await bot.until(() => game.flags.cs_forest_boss_intro, { timeout: 30, what: 'boss intro played' });
    assert.ok(ev.cs.includes('forest_boss_intro'));
    assert.equal(game.ents.all.filter((e) => e.kind === 'old_mossback' && !e.removed).length, 1, 'exactly one Mossback');
    mark('boss');
    await bot.fight({ kind: 'old_mossback', until: () => game.flags.mossback_defeated || game.cutscene.active === 'forest_boss_outro', timeout: 400 });
    mark('boss_down');
    await bot.until(() => !game.cutscene.active && game.flags.mossback_defeated, { timeout: 60, what: 'outro' });
    assert.deepEqual(ev.shields, [0, 1], 'both shields went up');
    assert.equal(ev.asks.filter((a) => a === 'boss_shield').length, 2, 'two shield questions');
    assert.ok(ev.cs.includes('forest_boss_outro'));
    assert.equal(game.inventory.count('mossback_acorn'), 1);
    assert.equal(game.quests.step('forest_sealed_grove'), 5);
    game.debug.god(false);
    await bot.walkTo('ranger_camp', { r: 4, timeout: 200 });
    await bot.talkTo('ranger_tam');
    await bot.choose(/Bye/).catch(() => {});
    await bot.finishDialogue();
    assert.equal(game.quests.state('forest_sealed_grove'), 'done');
    mark('end');
  });

  assert.deepEqual(game.debug.errors(), []);
  assert.deepEqual(mutated(snap0), [], 'data untouched at the end');
  t.diagnostic('milestones (sim seconds): ' + JSON.stringify(marks));
});

test('bot: defeat before intro_done wakes at the intro respawn marker', async () => {
  const game = newGame({ questions: 'off' });
  const bot = createBot(game);
  await bot.until(() => game.inputLock === 0 && game.cutscene.tutorial, { timeout: 20 });
  await bot.walkTo('stick', { r: 0.9 });
  await bot.interact();
  const where = [];
  game.bus.on('player:revived', (r) => where.push(r.where));
  game.combat.damage(game.player, 9999, { type: 'true' });
  await bot.seconds(1);
  assert.deepEqual(where, ['respawn']);
  assert.ok(dist(game.player, game.world.marker('respawn')) < 1);
  assert.equal(game.player.hp, game.player.hpMax);
  assert.equal(game.cutscene.active, 'intro_wake', 'the tutorial keeps going');
});
