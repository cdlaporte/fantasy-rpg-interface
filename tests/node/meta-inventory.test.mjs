// Meta: inventory (hotbar, item effects, cosmetics, shops, chests, lessons, ops/conditions, HUD).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import baseData from '../../src/data/index.js';
import { config } from '../../src/config.js';
import { createQuestions } from '../../src/questions/index.js';
import { DT, makeInputState } from '../../src/contracts.js';

const NS = config.numberScale;   // absolute health amounts in item data are base numbers, scaled where used
const flush = () => new Promise((r) => setImmediate(r));
async function steps(game, n, input) {
  for (let i = 0; i < n; i++) { game.step(DT, input); if (i % 4 === 0) await flush(); }
  await flush();
}
const quietWarn = () => { const w = console.warn; const seen = []; console.warn = (...a) => seen.push(a.join(' ')); return { seen, restore: () => { console.warn = w; } }; };

const items = {
  potion_small: { id: 'potion_small', type: 'consumable', name: 'Small Potion', desc: 'd', icon: 'potion', price: 10, stack: 20, cd: 1, use: { effect: 'heal', amount: 10 } },
  bread: { id: 'bread', type: 'consumable', name: 'Bread', icon: 'bread', price: 3, cd: 1, use: { effect: 'heal_over_time', amount: 8, dur: 4 } },
  bomb: { id: 'bomb', type: 'consumable', name: 'Bomb', icon: 'bomb', price: 15, cd: 1, use: { effect: 'bomb', dmg: 3, r: 2, delay: 0.5, range: 2 } },
  speed_tonic: { id: 'speed_tonic', type: 'consumable', name: 'Tonic', icon: 'tonic', cd: 1, use: { effect: 'haste', mult: 1.5, dur: 2 } },
  shield_charm: { id: 'shield_charm', type: 'consumable', name: 'Charm', icon: 'charm', cd: 1, use: { effect: 'shield', amount: 12, dur: 5 } },
  antidote: { id: 'antidote', type: 'consumable', name: 'Antidote', icon: 'potion', cd: 1, use: { effect: 'cure' } },
  smoke_pellet: { id: 'smoke_pellet', type: 'consumable', name: 'Smoke', icon: 'smoke', cd: 1, use: { effect: 'smoke', r: 2, dur: 3 } },
  xp_tome: { id: 'xp_tome', type: 'consumable', name: 'Tome', icon: 'book', cd: 1, use: { effect: 'xp', amount: 30 } },
  pet_whistle: { id: 'pet_whistle', type: 'consumable', name: 'Whistle', icon: 'star', cd: 1, use: { effect: 'summon_pet', kind: 'rat', dur: 5, name: 'Squeaky' } },
  mana_drop: { id: 'mana_drop', type: 'consumable', name: 'Mana Drop', icon: 'potion', cd: 1, use: { effect: 'resource', amount: 20 } },
  focus_scroll: { id: 'focus_scroll', type: 'consumable', name: 'Focus Scroll', icon: 'book', cd: 3, use: { effect: 'resource', focus: true } },
  red_hat: { id: 'red_hat', type: 'cosmetic', name: 'Red Cap', icon: 'hat', price: 25, look: { hat: { style: 'cap', color: '#ff0000' } } },
  blue_dye: { id: 'blue_dye', type: 'cosmetic', name: 'Blue Dye', icon: 'cloak', slot: 'outfitColor', color: '#0000ff' },
  old_key: { id: 'old_key', type: 'key', name: 'Old Key', icon: 'key' },
};
const shops = {
  potions: { id: 'potions', name: 'The Bubbling Cauldron', keeper: 'mira', haggle: true,
    stock: [{ item: 'potion_small' }, { item: 'bomb', req: [['level', '>=', 5]] }, { item: 'red_hat' }, { item: 'ghost_item' }] },
  strict: { id: 'strict', name: 'No Haggle', stock: [{ item: 'bread' }], haggle: false },
};
const loot = {
  forest_small: { id: 'forest_small', gold: [5, 5], items: [{ id: 'potion_small', n: 1, p: 1 }, { id: 'bomb', n: 1, p: 0 }] },
  forest_rune: { id: 'forest_rune', gold: [5, 5], items: [], runeBonus: { gold: [20, 20], items: [{ id: 'bomb', n: [2, 2], p: 1 }] } },
};
const lessons = { lesson_1: { id: 'lesson_1', teacher: 'prof_x', title: 'Angles', questions: 3, difficulty: 1, tags: ['geometry'], reward: { xpEach: 5, goldEach: 2 } } };

function make(mode = 'auto', extra = {}) {
  const data = Object.assign({}, baseData, { items, shops, loot, lessons }, extra);
  const game = createGame({ data, name: 'Tester', seed: 3, zone: 'test', questions: createQuestions({ mode }) });
  const log = [];
  for (const e of ['item:gained', 'item:used', 'gold', 'cosmetic:equipped', 'toast', 'gate:ask', 'chest:opened', 'lesson:done'])
    game.bus.on(e, (p) => log.push([e, p]));
  return { game, inv: game.inventory, of: (e) => log.filter((x) => x[0] === e).map((x) => x[1]) };
}
function fxTypes(game) {
  game.setViewRect({ x0: -10, y0: -10, x1: 60, y1: 60 });
  const f = game.frame(1);
  const out = []; for (let i = 0; i < f.fxCount; i++) out.push(f.fx[i].type);
  return out;
}

test('give/take, hotbar auto-fill, cosmetics, keys, unknown ids', () => {
  const w = quietWarn();
  try {
    const { game, inv, of } = make();
    inv.give('potion_small', 3);
    inv.give('bread');
    inv.give('old_key');
    inv.give('red_hat');
    inv.give('mystery_thing', 2);
    assert.deepEqual(inv.hotbar, ['potion_small', 'bread', null, null, null, null]);
    assert.equal(inv.count('potion_small'), 3);
    assert.equal(inv.count('red_hat'), 1);
    assert.deepEqual(inv.cosmetics, ['red_hat']);
    assert.equal(inv.count('mystery_thing'), 2, 'unknown ids are kept');
    assert.ok(w.seen.some((s) => /mystery_thing/.test(s)), 'warned once');
    assert.deepEqual(of('item:gained')[0], { id: 'potion_small', n: 3 });
    assert.ok(of('toast').some((t) => t.style === 'loot'));
    assert.equal(inv.take('potion_small', 5), false);
    assert.equal(inv.take('potion_small', 3), true);
    assert.equal(inv.hotbar[0], null, 'emptied slot is freed');
    inv.give('bomb');
    assert.equal(inv.hotbar[0], 'bomb', 'first free slot');
    assert.equal(inv.assignSlot('bread', 0), true);
    assert.deepEqual(inv.hotbar.slice(0, 2), ['bread', 'bomb'], 'assign swaps');
    assert.equal(inv.assignSlot('red_hat', 2), false, 'cosmetics are not hotbar items');
    assert.equal(game.ops.test([['hasItem', 'bread'], ['hasItem', 'old_key', 1]]), true);
    assert.equal(game.ops.test([['hasItem', 'bread', 2]]), false);
    game.ops.run([['give', 'bread', 2], ['take', 'bread', 1], ['gold', 40], ['gold', -15]]);
    assert.equal(inv.count('bread'), 2);
    assert.equal(inv.gold, 25);
    assert.ok(game.ops.test([['gold', '>=', 25]]) && !game.ops.test([['gold', '>', 25]]));
    assert.deepEqual(of('gold').map((g) => g.amount), [40, -15]);
    const hud = game.hudState();
    assert.deepEqual({ id: hud.items[0].id, count: hud.items[0].count, icon: hud.items[0].icon }, { id: 'bread', count: 2, icon: 'bread' });
    assert.equal(hud.items[5], null);
    assert.equal(hud.player.gold, 25);
  } finally { w.restore(); }
});

test('useSlot: heal, cooldown, refuse at full; hotbar keys', async () => {
  const { game, inv, of } = make();
  const p = game.player;
  inv.give('potion_small', 3);
  assert.equal(inv.useSlot(0), false, 'full health: refused');
  assert.equal(inv.count('potion_small'), 3);
  p.hp = 5;
  assert.equal(inv.useSlot(0), true);
  assert.equal(p.hp, 5 + 10 * NS);
  assert.equal(inv.count('potion_small'), 2);
  assert.deepEqual(of('item:used'), [{ id: 'potion_small' }]);
  assert.equal(inv.useSlot(0), false, 'cooldown');
  assert.ok(game.hudState().items[0].cdFrac > 0.9);
  await steps(game, 61);
  assert.equal(game.hudState().items[0].cdFrac, 0);
  // the item1 key works even when the player system does not call useSlot
  const input = makeInputState();
  input.pressed.item1 = true;
  game.step(DT, input);
  assert.equal(inv.count('potion_small'), 1);
  assert.equal(p.hp, Math.min(p.hpMax, 5 + 20 * NS));
  assert.ok(fxTypes(game).includes('heal'));
});

test('every item effect', async () => {
  const { game, inv } = make();
  const p = game.player;
  const aoe = [], zones = [], statuses = [], gains = [];
  game.combat.aoe = (src, o) => { aoe.push([src, o]); return []; };
  game.combat.zone = (src, o) => { zones.push(o); return null; };
  game.combat.status = (t, id, s, pw) => { statuses.push([id, s, pw]); t.status[id] = s; if (pw !== undefined) t.statusPower[id] = pw; };
  game.sys.kits.resource = () => ({ value: 10, max: 100 });
  game.sys.kits.gain = (e, n) => { gains.push(n); };
  for (const id of Object.keys(items)) inv.give(id, 1, { silent: true });
  const use = (id) => inv.useItem(id);

  // heal over time
  p.hp = 1;
  assert.ok(use('bread'));
  await steps(game, 60 * 4 + 2);
  assert.ok(p.hp >= 8 * NS && p.hp <= 8 * NS + 1, 'healed about 8 x scale over 4 s: ' + p.hp);
  // bomb through combat.aoe with a telegraph
  p.angle = 0;
  assert.ok(use('bomb'));
  const [src, o] = aoe.at(-1);
  assert.equal(src, p);
  assert.equal(o.telegraph, true);
  assert.equal(o.delay, 0.5);
  assert.equal(o.dmg, 3, 'coefficient (CONTRACTS rule: dmg x power)');
  assert.ok(Math.abs(o.x - (p.x + 2)) < 1e-9);
  // haste
  const sp = p.stats.speed;
  assert.ok(use('speed_tonic'));
  assert.equal(p.stats.speed, Math.round(sp * 1.5 * 100) / 100);
  assert.ok(p.fxTags.includes('haste'));
  await steps(game, 125);
  assert.equal(p.stats.speed, sp);
  assert.ok(!p.fxTags.includes('haste'));
  // shield
  assert.ok(use('shield_charm'));
  assert.deepEqual(statuses.at(-1), ['shield', 5, 12 * NS]);
  // cure
  p.status.burn = 3; p.status.slow = 2; p.fxTags.push('burn');
  assert.ok(use('antidote'));
  assert.equal(p.status.burn, 0); assert.equal(p.status.slow, 0); assert.ok(!p.fxTags.includes('burn'));
  // smoke
  assert.ok(use('smoke_pellet'));
  assert.equal(zones.at(-1).look.model, 'smoke');
  assert.ok(statuses.some((s) => s[0] === 'stealth'));
  // xp
  const xp0 = game.progression.xpTotal;
  assert.ok(use('xp_tome'));
  assert.equal(game.progression.xpTotal, xp0 + 30);
  // summon pet
  assert.ok(use('pet_whistle'));
  const pet = game.ents.all.find((e) => e.type === 'summon');
  assert.ok(pet && pet.team === 'player' && pet.owner === p.id && pet.ttl === 5 && pet.name === 'Squeaky');
  // resource
  assert.ok(use('mana_drop'));
  assert.equal(gains.at(-1), 20);
  // focus scroll: correct (auto) -> resource to max, cooldown reset hook, +50% power for 6 s
  let resets = 0;
  game.sys.abilities.resetCooldowns = () => { resets++; };
  const pw = p.stats.power;
  assert.ok(use('focus_scroll'));
  await flush();
  assert.equal(gains.at(-1), 90);
  assert.equal(resets, 1);
  assert.equal(p.stats.power, Math.round(pw * 1.5 * 100) / 100);
  await steps(game, 6 * 60 + 2);
  assert.equal(p.stats.power, pw);
  assert.ok(fxTypes(game).includes('heal'));
});

test('focus scroll asks the focus gate; wrong answer only trickles resource back', async () => {
  const { game, inv, of } = make('stub');
  const gains = [];
  game.sys.kits.resource = () => ({ value: 0, max: 100 });
  game.sys.kits.gain = (e, n) => gains.push(n);
  inv.give('focus_scroll', 1, { silent: true });
  assert.ok(inv.useSlot(0));
  assert.equal(inv.count('focus_scroll'), 0, 'consumed on use');
  assert.equal(game.modal.type, 'question');
  assert.equal(game.modal.req.context, 'focus');
  game.debug.answerQuestion(false);
  await flush();
  assert.deepEqual(gains, [25]);
  assert.equal(game.modal, null, 'focus is not blocking');
  assert.ok(of('gate:ask').length === 1);
});

test('cosmetics: equip, toggle, look patch, event, inventory modal', () => {
  const { game, inv, of } = make();
  inv.give('red_hat'); inv.give('blue_dye'); inv.give('potion_small', 2);
  assert.equal(inv.equippedLookPatch(), null);
  game.commands.openInventory();
  const m = game.modal;
  assert.equal(m.type, 'inventory');
  assert.deepEqual(m.items.map((i) => [i.id, i.count, i.slot]), [['potion_small', 2, 0]]);
  assert.deepEqual(m.cosmetics.map((c) => [c.id, c.slot, c.equipped]), [['red_hat', 'hat', false], ['blue_dye', 'outfitColor', false]]);
  assert.equal(game.commands.equipCosmetic('red_hat'), true);
  assert.equal(inv.equipped.hat, 'red_hat');
  game.commands.equipCosmetic('blue_dye');
  assert.deepEqual(inv.equippedLookPatch(), { outfit: { primary: '#0000ff' }, hat: { style: 'cap', color: '#ff0000' } });
  assert.equal(m.cosmetics[0].equipped, true, 'open modal refreshed in place');
  assert.deepEqual(m.equipped, { hat: 'red_hat', cape: null, outfitColor: 'blue_dye' });
  assert.deepEqual(of('cosmetic:equipped')[0], { id: 'red_hat', slot: 'hat', equipped: true });
  game.commands.equipCosmetic('red_hat');
  assert.equal(inv.equipped.hat, null, 'toggle off');
  assert.equal(game.commands.equipCosmetic('not_owned'), false);
  game.commands.assignSlot('potion_small', 4);
  assert.equal(inv.hotbar[4], 'potion_small');
  assert.equal(m.items[0].slot, 4);
  // fallback composition (no Sim refreshLook yet) applies the hat
  game.commands.equipCosmetic('red_hat');
  game.setFlag('look_chosen', true);
  game.progression.refreshLook();
  assert.equal(game.player.look.hat.color, '#ff0000');
  assert.equal(game.player.look.outfit.primary, '#0000ff');
});

test('shop: stock with req, buy, haggle (auto and stub), no-haggle shop', async () => {
  const w = quietWarn();
  try {
    let { game, inv, of } = make();
    inv.addGold(30);
    const visit = game.ops.run([['shop', 'potions']]);
    let m = game.modal;
    assert.equal(m.type, 'shop');
    assert.equal(m.name, 'The Bubbling Cauldron');
    assert.deepEqual(m.stock.map((s) => s.id), ['potion_small', 'red_hat'], 'level req hides the bomb; unknown item skipped');
    assert.deepEqual(m.stock.map((s) => [s.price, s.canBuy]), [[10, true], [25, true]]);
    assert.equal(m.gold, 30); assert.equal(m.haggled, false);
    assert.equal(game.commands.shopBuy('potion_small'), true);
    assert.equal(inv.gold, 20); assert.equal(inv.count('potion_small'), 1);
    assert.equal(m.gold, 20);
    assert.equal(m.stock[1].canBuy, false, 'hat now too expensive');
    assert.equal(game.commands.shopBuy('red_hat'), false);
    assert.equal(game.commands.shopBuy('bomb'), false, 'not in visible stock');
    assert.equal(await game.commands.shopHaggle(), true);
    assert.equal(game.modal, m, 'auto: same modal refreshed');
    assert.equal(m.haggled, true);
    assert.deepEqual(m.stock.map((s) => s.price), [8, 20]);
    assert.equal(m.canHaggle, false);
    assert.equal(await game.commands.shopHaggle(), false, 'once per visit');
    assert.ok(of('gate:ask').some((g) => g.req.context === 'haggle'));
    assert.equal(game.commands.shopBuy('red_hat'), true);
    assert.equal(inv.gold, 0);
    game.closeModal();
    await visit;
    // a new visit starts at full price
    game.inventory.addGold(100);
    game.ops.run([['shop', 'potions']]);
    assert.equal(game.modal.haggled, false);
    assert.equal(game.modal.stock.find((s) => s.id === 'red_hat').owned, true);
    game.closeModal();

    // stub: the question replaces the shop, which comes back after the answer
    ({ game, inv } = make('stub'));
    inv.addGold(50);
    game.ops.run([['shop', 'potions']]);
    const h = game.commands.shopHaggle();
    assert.equal(game.modal.type, 'question');
    game.debug.answerQuestion(true);
    assert.equal(await h, true);
    assert.equal(game.modal.type, 'shop');
    assert.equal(game.modal.haggled, true);
    game.closeModal();
    game.ops.run([['shop', 'strict']]);
    assert.equal(game.modal.canHaggle, false);
    assert.equal(await game.commands.shopHaggle(), false);
  } finally { w.restore(); }
});

test('chest op: plain, rune correct, rune wrong (non-blocking), flags and look', async () => {
  let { game, inv, of } = make();
  const mkChest = (rune) => game.ents.create({ kind: 'chest', type: 'effect', x: 5, y: 5, look: { rig: 'effect', model: rune ? 'rune_chest' : 'chest' },
    interact: { prompt: 'Open', do: [] } });
  let c = mkChest(false);
  game.ops.run([['chest', 'forest_small', { id: 'c1' }]], { self: c });
  assert.equal(inv.gold, 5);
  assert.equal(inv.count('potion_small'), 1);
  assert.equal(inv.count('bomb'), 0);
  assert.equal(game.flags.chest_test_c1, true);
  assert.equal(c.look.model, 'chest_open');
  assert.equal(c.lookRev, 1);
  assert.equal(c.interact, null);
  game.ops.run([['chest', 'forest_small', { id: 'c1' }]], { self: c });
  assert.equal(inv.gold, 5, 'already opened');
  assert.ok(fxTypes(game).includes('sparkle'));
  // rune chest, correct (auto) -> runeBonus
  c = mkChest(true);
  await game.ops.run([['chest', 'forest_rune', { id: 'c2', rune: true }]], { self: c });
  assert.equal(inv.gold, 5 + 25);
  assert.equal(inv.count('bomb'), 2);
  assert.ok(of('gate:ask').some((g) => g.req.context === 'chest'));
  assert.equal(of('chest:opened').at(-1).bonus, true);
  // rune chest, wrong answer in stub mode -> basic table, no retry even though config says blocking
  ({ game, inv } = make('stub'));
  c = mkChest(true);
  const done = game.ops.run([['chest', 'forest_rune', { id: 'c3', rune: true }]], { self: c });
  assert.equal(game.modal.type, 'question');
  game.debug.answerQuestion(false);
  await done;
  assert.equal(inv.gold, 5);
  assert.equal(inv.count('bomb'), 0);
  assert.equal(game.flags.chest_test_c3, true);
  assert.equal(c.look.model, 'chest_open');
  assert.equal(game.freeze.size, 0);
  // unknown loot table: warning + small default, never throws
  const w = quietWarn();
  try { game.ops.run([['chest', 'nope', { id: 'c4' }]], {}); assert.ok(inv.gold > 5); } finally { w.restore(); }
});

test('lesson op: questions in a row, rewards per correct answer, rel +1, modal flow', async () => {
  let rels = [];
  let { game, inv, of } = make();
  game.sys.npc.addRel = (id, n) => rels.push([id, n]);
  let result = null;
  game.ops.run([['lesson', 'lesson_1']]).then(() => { result = true; });
  assert.equal(game.modal.type, 'lesson');
  assert.equal(game.modal.title, 'Angles');
  assert.equal(game.modal.total, 3);
  assert.equal(game.modal.done, 0);
  await steps(game, 60 * 4);
  assert.equal(game.modal.type, 'lesson');
  assert.equal(game.modal.done, 3);
  assert.equal(game.modal.correct, 3);
  assert.equal(game.modal.finished, true);
  assert.equal(game.progression.xpTotal, 15);
  assert.equal(inv.gold, 6);
  assert.deepEqual(rels, [['prof_x', 1]]);
  assert.equal(of('gate:ask').filter((g) => g.req.context === 'lesson').length, 3);
  assert.equal(result, null, 'waits for the player to close the lesson card');
  game.closeModal();
  await flush();
  assert.equal(result, true);

  // stub (round 2): lessons are not blocking; a wrong answer just earns nothing for that question (no retry)
  rels = [];
  ({ game, inv } = make('stub'));
  game.sys.npc.addRel = (id, n) => rels.push([id, n]);
  const p = game.ops.run([['lesson', 'lesson_1']]);
  for (const ans of [true, false, true]) {
    for (let i = 0; i < 120 && !(game.modal && game.modal.type === 'question'); i++) { game.step(DT); await flush(); }
    assert.equal(game.modal.type, 'question');
    assert.equal(game.modal.req.context, 'lesson');
    assert.equal(game.modal.req.attempt, 1, 'never a retry');
    assert.deepEqual(game.modal.req.tags, ['geometry']);
    game.debug.answerQuestion(ans);
    await flush();
  }
  for (let i = 0; i < 120 && !(game.modal && game.modal.finished); i++) { game.step(DT); await flush(); }
  assert.equal(game.modal.finished, true);
  assert.equal(game.modal.done, 3);
  assert.equal(game.modal.correct, 2, 'the wrong answer is not retried, it just pays nothing');
  assert.equal(game.progression.xpTotal, 10, 'rewards for the 2 right answers only');
  assert.equal(inv.gold, 4);
  game.closeModal();
  await p;
  assert.deepEqual(rels, [['prof_x', 1]]);
});

test('inventory save/load round trip', () => {
  const { game, inv } = make();
  inv.give('potion_small', 4); inv.give('red_hat'); inv.addGold(77); inv.equipCosmetic('red_hat');
  inv.assignSlot('potion_small', 3);
  const json = JSON.parse(JSON.stringify(game.saveSystems()));
  const { game: g2 } = make();
  g2.loadSystems(json);
  assert.deepEqual(g2.inventory.items, { potion_small: 4 });
  assert.deepEqual(g2.inventory.hotbar, [null, null, null, 'potion_small', null, null]);
  assert.equal(g2.inventory.gold, 77);
  assert.deepEqual(g2.inventory.cosmetics, ['red_hat']);
  assert.equal(g2.inventory.equipped.hat, 'red_hat');
  assert.deepEqual(g2.inventory.equippedLookPatch(), { hat: { style: 'cap', color: '#ff0000' } });
});
