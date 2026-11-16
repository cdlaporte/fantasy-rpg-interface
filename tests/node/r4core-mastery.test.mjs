// Round 4, core package: the tier-3 mastery flow (docs/MASTERY.md). Level 15 marks it ready, the Laporte dialogue and
// the mastery ceremony open the tier-3 spec picker after a 'mastery' question, the kit registry layers class ->
// subclass -> mastery, recalc applies the mastery's mods, save/load keeps it, a level-down below 15 removes it, and the
// teacher tools equip any mastery from level 8. The class packages write the real mastery data and kits; here two
// stub data entries (and, for layering, a stub kit) are injected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import baseData from '../../src/data/index.js';
import { createQuestions } from '../../src/questions/index.js';
import { createMemoryStorage } from '../../src/platform/storage.js';
import { MASTERY_LEVEL, MASTERY_TRIAL_BONUS } from '../../src/core/progression.js';
import { KITS } from '../../src/core/kits/index.js';
import { config } from '../../src/config.js';
import { CONTEXT_INFO } from '../../src/questions/unit4/provider.js';
import { createBot } from './bot-helpers.mjs';

const STUB = {
  paladin: {
    id: 'paladin', from: 'knight', tier: 3, name: 'Paladin', color: '#fff2a8', blurb: 'Holy protector.',
    mods: { hp: 1.2, power: 1.1, speed: 1 },
    look: { outfit: { primary: '#fffbe6' }, cape: { color: '#ffd24a' } },
    passive: { name: 'Sunlit Ground', desc: 'Perfect blocks heal you and your classmates.' },
    ultimate: { name: 'Sanctuary', desc: 'A dome that heals inside and smites enemies.', icon: 'shield' },
  },
  sentinel: {
    id: 'sentinel', from: 'knight', tier: 3, name: 'Sentinel', color: '#8fb8ff', blurb: 'Counter fortress.',
    mods: { hp: 1.3, power: 1, speed: 0.95 },
    passive: { name: 'Bastion', desc: 'Blocking builds a meter that releases as a shockwave.' },
    ultimate: { name: 'Bulwark Fortress', desc: 'Taunts everything nearby and reflects projectiles.', icon: 'shield' },
  },
};
const data = Object.assign({}, baseData, { specs: Object.assign({}, baseData.specs, STUB) });

function make(o = {}) {
  const game = createGame({ data: o.data || data, name: 'T', seed: 5, zone: o.zone || 'test', marker: o.marker, test: true,
    storage: o.storage || createMemoryStorage(), questions: createQuestions({ mode: 'auto' }) });
  game.quiet = true;
  game.teacher = !!o.teacher;
  const log = [];
  for (const e of ['mastery:set', 'gate:ask', 'toast']) game.bus.on(e, (p) => log.push([e, p]));
  return { game, pr: game.progression, of: (e) => log.filter((x) => x[0] === e).map((x) => x[1]) };
}
const flush = () => new Promise((r) => setImmediate(r));
async function steps(game, n) { for (let i = 0; i < n; i++) { game.debug.step(1); await flush(); } }

test('config and question label for the mastery context', () => {
  assert.deepEqual(config.questions.contexts.mastery, { enabled: true, blocking: false });
  assert.deepEqual(CONTEXT_INFO.mastery, ['Mastery trial', 'Answer, then choose your mastery.']);
  assert.equal(MASTERY_LEVEL, 15);
});

test('masteryIds / masteryDef: data entries and kit-stub fallbacks; never in the level-8 picker', () => {
  const { pr } = make();
  assert.deepEqual(pr.masteryIds('knight'), ['paladin', 'sentinel']);
  assert.equal(pr.masteryIds().length, 18, 'all 18 kit stubs');
  for (const s of ['knight', 'berserker', 'battlemage', 'conjurer', 'sorcerer', 'monk', 'archer', 'thief', 'ninja']) {
    assert.equal(pr.masteryIds(s).length, 2, s);
  }
  assert.deepEqual(pr.specIds('warrior').sort(), ['battlemage', 'berserker', 'knight']);
  assert.ok(!pr.specIds().includes('paladin'), 'masteries are not subclasses');
  assert.equal(pr.masteryDef('paladin').name, 'Paladin');
  assert.equal(pr.masteryDef('paladin').mods.power, 1.1);
  // no data entry: the kit stub alone, named after its id
  const w = pr.masteryDef('windwalker');
  assert.equal(w.name, 'Windwalker'); assert.equal(w.from, 'ninja'); assert.equal(w.mods.hp, 1);
  assert.equal(pr.masteryDef('swashbuckler').name, 'Swashbuckler');
  assert.equal(pr.masteryDef('knight'), null);
});

test('level 15 with a subclass marks the mastery ready (flag + toast); not without a subclass', () => {
  const { game, pr, of } = make();
  pr.setClass('warrior', { quiet: true });
  pr.setLevel(14, { quiet: true });
  pr.setSpec('knight', { quiet: true });
  assert.equal(pr.pendingMastery, false);
  pr.addXp(pr.xpNext);
  assert.equal(pr.level, 15);
  assert.equal(pr.pendingMastery, true);
  assert.equal(game.flags.mastery_ready, true);
  assert.ok(of('toast').some((t) => /Laporte wants to see you/.test(t.text || t.msg || JSON.stringify(t))));
  assert.equal(game.hudState().player.pendingMastery, true);
  // a plain class at 15: no mastery yet (the subclass comes first)
  const b = make();
  b.pr.setClass('mage', { quiet: true });
  b.pr.setLevel(16, { quiet: true });
  assert.equal(b.pr.pendingMastery, false);
  b.pr.setSpec('monk', { quiet: true });
  assert.equal(b.pr.pendingMastery, true, 'the subclass at 15+ makes it pending');
});

test('ceremony: Laporte option, mastery question, tier-3 picker, pickMastery equips (questions auto)', async () => {
  const { game, pr, of } = make({ zone: 'academy', marker: 'headmaster' });
  for (const f of ['has_stick', 'tutorial_done', 'ambush_done', 'look_chosen', 'intro_done', 'town_seen', 'class_chosen', 'forest_open', 'spec_ready', 'spec_ceremony_done']) game.setFlag(f, true);
  pr.setClass('warrior', { quiet: true });
  pr.setLevel(8, { quiet: true });
  pr.setSpec('knight', { quiet: true });
  const opt = data.dialogues.laporte.nodes.hub.options.find((o) => (o.do || []).some((a) => a[0] === 'cutscene' && a[1] === 'mastery_ceremony'));
  assert.ok(opt, 'Laporte has a mastery option');
  assert.equal(game.ops.test(opt.if), false, 'not before 15');
  pr.setLevel(15, { quiet: true });
  assert.equal(game.ops.test(opt.if), true, 'level 15 with a subclass');
  // Tab before the ceremony only says where to go
  game.commands.masteryNudge();
  assert.equal(game.modal, null);
  // talk to Laporte for real (dialogue -> cutscene -> picker)
  const bot = createBot(game);
  bot.onModal = () => false;
  await bot.talkTo('laporte');
  await bot.choose(/wanted to see me/);
  const m = await bot.waitModal('specPicker', { timeout: 60 });
  assert.ok(of('gate:ask').some((g) => g.req.context === 'mastery'), 'the mastery question first');
  assert.equal(m.tier, 3);
  assert.deepEqual(m.options.map((o) => o.id), ['paladin', 'sentinel']);
  const card = m.options[0];
  assert.equal(card.name, 'Paladin'); assert.equal(card.passive.name, 'Sunlit Ground');
  assert.equal(card.ultimate.name, 'Sanctuary'); assert.equal(card.ultimate.unlock, MASTERY_LEVEL);
  assert.deepEqual(card.abilities.map((a) => a.slot), ['shift']);
  assert.equal(card.look.outfit.primary, '#fffbe6', 'preview look carries the mastery patch');
  assert.equal(card.look.held.style, 'sword_shield', '... over the subclass patch');
  assert.equal(pr.masteryBonus, MASTERY_TRIAL_BONUS, 'a right answer: +5% power');
  assert.equal(game.commands.pickMastery('windwalker'), false, 'not a knight mastery');
  game.commands.pickMastery('paladin');
  await bot.until(() => !game.cutscene.active && !game.modal, { timeout: 60, what: 'mastery_ceremony ends' });
  assert.equal(pr.masteryId, 'paladin');
  assert.equal(pr.specId, 'knight', 'the subclass stays');
  assert.equal(game.player.data.specId, 'knight');
  assert.equal(game.player.data.masteryId, 'paladin');
  assert.equal(pr.pendingMastery, false);
  assert.equal(game.flags.mastery_ceremony_done, true);
  assert.equal(game.ops.test(opt.if), false, 'the option is gone');
  assert.deepEqual(of('mastery:set').at(-1), { masteryId: 'paladin', specId: 'knight' });
  assert.equal(game.player.look.outfit.primary, '#fffbe6', 'the player wears the mastery look');
  assert.equal(game.player.look.aura.color.length, 7);
  const hud = game.hudState();
  assert.equal(hud.player.masteryName, 'Paladin');
  assert.equal(hud.player.specName, 'Knight');
});

test('a wrong answer still lets you choose (no bonus); the question is asked once', async () => {
  const { game, pr, of } = make();
  pr.setClass('warrior', { quiet: true }); pr.setLevel(15, { quiet: true }); pr.setSpec('knight', { quiet: true });
  game.sys.gates.ask = (req) => { game.bus.emit('gate:ask', { req }); return Promise.resolve({ correct: false, skipped: false }); };
  const p1 = game.ops.run([['specPicker', 'mastery']]);
  await flush(); await flush();
  assert.equal(game.modal && game.modal.type, 'specPicker');
  assert.equal(game.modal.tier, 3);
  assert.equal(pr.masteryBonus, 0);
  game.commands.closeModal();
  await p1;
  assert.equal(pr.masteryId, null, 'closed without a choice');
  game.setFlag('mastery_ceremony_done', true);
  game.commands.openMasteryPicker();
  await flush(); await flush();
  assert.equal(game.modal && game.modal.type, 'specPicker');
  assert.equal(of('gate:ask').filter((g) => g.req.context === 'mastery').length, 1, 'asked once');
  game.commands.pickMastery('sentinel');
  assert.equal(pr.masteryId, 'sentinel');
});

test('Tab: the mastery picker after the ceremony; the masteryPicker op is the same', async () => {
  const { game, pr } = make();
  pr.setClass('warrior', { quiet: true }); pr.setLevel(15, { quiet: true, boons: false }); pr.setSpec('knight', { quiet: true });
  game.setFlag('mastery_ceremony_done', true);
  assert.equal(pr.pendingBoons, 0, 'boons come first on Tab');
  assert.equal(pr.pendingMastery, true);
  game.debug.step(1, { pressed: { boon: true } });
  await flush(); await flush();
  game.debug.step(1, { pressed: { boon: false } });
  assert.equal(game.modal && game.modal.type, 'specPicker');
  assert.equal(game.modal.tier, 3);
  game.commands.pickMastery('paladin');
  assert.equal(pr.masteryId, 'paladin');
  const b = make();
  b.pr.setClass('rogue', { quiet: true }); b.pr.setLevel(15, { quiet: true }); b.pr.setSpec('ninja', { quiet: true });
  b.game.ops.run([['masteryPicker']]);
  await flush(); await flush();
  assert.deepEqual(b.game.modal.options.map((o) => o.id), ['windwalker', 'smokestep']);
  assert.equal(b.game.modal.options[0].name, 'Windwalker', 'fallback name');
});

test("layering: the mastery's shift ability overrides the subclass's; masteryId sync and abilityList", async () => {
  const { game, pr } = make();
  const saved = KITS.paladin;
  const sanctuary = { id: 'sanctuary', name: 'Sanctuary', icon: 'shield', unlock: 15, cd: 30, cast() {} };
  game.kits.register({ id: 'paladin', parent: 'knight', tier: 3, abilities: { shift: sanctuary }, hooks: {} });
  try {
    pr.setClass('warrior', { quiet: true }); pr.setLevel(16, { quiet: true }); pr.setSpec('knight', { quiet: true });
    assert.equal(game.kits.ability(game.player, 'shift').id, 'aegis');
    pr.setMastery('paladin', { quiet: true });
    const L = game.kits.active(game.player);
    assert.deepEqual(L.layers.map((k) => k.id), ['warrior', 'knight', 'paladin']);
    assert.equal(game.kits.ability(game.player, 'shift'), sanctuary);
    assert.equal(game.kits.ability(game.player, 'f').id, 'shield_wall', 'the subclass F stays');
    assert.equal(pr.abilityList().find((a) => a.slot === 'shift').id, 'sanctuary');
    const hudShift = game.hudState().abilities.find((a) => a.slot === 'shift');
    assert.equal(hudShift.name, 'Sanctuary');
    // the kits' sync follows progression's mastery (e.g. after a load)
    game.kits.set(game.player, 'warrior', 'knight');
    pr.masteryId = null; game.debug.step(1);
    pr.masteryId = 'paladin'; game.debug.step(1);
    assert.equal(game.player.data.masteryId, 'paladin');
    assert.equal(game.kits.ability(game.player, 'shift'), sanctuary);
    // class:set / spec:set handlers keep the mastery on top
    game.bus.emit('spec:set', { specId: 'knight' });
    assert.equal(game.player.data.masteryId, 'paladin');
    game.bus.emit('class:set', { classId: 'warrior' });
    assert.equal(game.player.data.masteryId, 'paladin');
    // abilityList for the data path: the mastery's ultimate replaces the subclass's
    const dl = pr.abilityList('warrior', 'knight', false, 'paladin');
    assert.equal(dl.find((a) => a.slot === 'shift').name, 'Sanctuary');
    assert.equal(dl.find((a) => a.slot === 'f').id, 'shield_wall');
  } finally { game.kits.register(saved); }
});

test('recalc applies the mastery mods (and the trial bonus)', () => {
  const { game, pr } = make();
  pr.setClass('warrior', { quiet: true }); pr.setLevel(15, { quiet: true }); pr.setSpec('knight', { quiet: true });
  const base = { hp: game.player.hpMax, power: game.player.stats.power, speed: game.player.stats.speed };
  pr.setMastery('paladin', { quiet: true });
  assert.ok(Math.abs(game.player.hpMax / base.hp - 1.2) < 0.01, 'hp x1.2');
  assert.ok(Math.abs(game.player.stats.power / base.power - 1.1) < 0.01, 'power x1.1');
  assert.equal(game.player.stats.speed, base.speed);
  pr.masteryBonus = MASTERY_TRIAL_BONUS; pr.recalc();
  assert.ok(Math.abs(game.player.stats.power / base.power - 1.1 * 1.05) < 0.01, 'trial bonus');
  pr.setMastery('sentinel', { quiet: true });
  assert.ok(Math.abs(game.player.hpMax / base.hp - 1.3) < 0.01, 'switching masteries swaps the mods');
});

test('save/load keeps the mastery, the bonus and the pending flag', () => {
  const storage = createMemoryStorage();
  const a = make({ storage });
  a.pr.setClass('warrior', { quiet: true }); a.pr.setLevel(17, { quiet: true }); a.pr.setSpec('knight', { quiet: true });
  a.pr.setMastery('paladin', { quiet: true });
  a.pr.masteryBonus = MASTERY_TRIAL_BONUS; a.pr.masteryTrial = true; a.pr.recalc();
  const stats = Object.assign({}, a.game.player.stats);
  const json = a.game.save.now();
  assert.equal(json.meta.masteryId, 'paladin');
  const b = make({ storage });
  b.game.save.restore(json);
  assert.equal(b.pr.masteryId, 'paladin');
  assert.equal(b.pr.specId, 'knight');
  assert.equal(b.pr.masteryBonus, MASTERY_TRIAL_BONUS);
  assert.equal(b.pr.masteryTrial, true);
  assert.equal(b.game.player.data.masteryId, 'paladin');
  assert.deepEqual(b.game.kits.active(b.game.player).layers.map((k) => k.id), ['warrior', 'knight', 'paladin']);
  assert.equal(b.game.player.stats.power, stats.power);
  b.game.debug.step(2);
  assert.equal(b.game.player.data.masteryId, 'paladin', 'the kits sync does not drop it');
  // a pending mastery survives too
  const c = make({ storage });
  c.pr.setClass('mage', { quiet: true }); c.pr.setLevel(15, { quiet: true }); c.pr.setSpec('sorcerer', { quiet: true });
  const d = make({ storage });
  d.game.save.restore(c.game.save.now());
  assert.equal(d.pr.pendingMastery, true); assert.equal(d.pr.masteryId, null);
});

test('level down below 15 removes the mastery (the subclass stays); reset clears it', () => {
  const { game, pr, of } = make();
  pr.setClass('warrior', { quiet: true }); pr.setLevel(20, { quiet: true }); pr.setSpec('knight', { quiet: true });
  pr.setMastery('paladin', { quiet: true });
  pr.setLevel(15);
  assert.equal(pr.masteryId, 'paladin', '15 keeps it');
  pr.setLevel(14);
  assert.equal(pr.masteryId, null);
  assert.equal(pr.pendingMastery, false);
  assert.equal(pr.specId, 'knight');
  assert.equal(game.player.data.masteryId, null);
  assert.deepEqual(game.kits.active(game.player).layers.map((k) => k.id), ['warrior', 'knight']);
  assert.deepEqual(of('mastery:set').at(-1), { masteryId: null, specId: 'knight', prev: 'paladin' });
  pr.setLevel(15, { quiet: true });
  assert.equal(pr.pendingMastery, true, 'pending again at 15');
  pr.setMastery('sentinel', { quiet: true });
  pr.reset();
  assert.equal(pr.masteryId, null); assert.equal(pr.pendingMastery, false); assert.equal(pr.masteryBonus, 0);
});

test('teacher: setMastery at any level from 8 (sets the subclass and class); None removes; refused below 8 / when not a teacher', () => {
  const { game, pr } = make({ teacher: true });
  const T = game.debug.teacher;
  T.setLevel(5);
  assert.equal(T.setMastery('paladin'), false, 'below 8');
  for (const L of [8, 11, 14, 15, 20]) {
    T.setLevel(L);
    assert.equal(T.setClass('mage'), true);
    assert.ok(T.setMastery('paladin'), 'level ' + L);
    assert.equal(pr.level, L); assert.equal(pr.classId, 'warrior'); assert.equal(pr.specId, 'knight'); assert.equal(pr.masteryId, 'paladin');
    assert.deepEqual(game.kits.active(game.player).layers.map((k) => k.id), ['warrior', 'knight', 'paladin']);
  }
  assert.ok(T.setMastery('smokestep'), 'any of the 18 (fallback data)');
  assert.equal(pr.classId, 'rogue'); assert.equal(pr.specId, 'ninja'); assert.equal(pr.masteryId, 'smokestep');
  assert.ok(T.setMastery(null));
  assert.equal(pr.masteryId, null); assert.equal(pr.specId, 'ninja');
  assert.equal(pr.pendingMastery, true, 'at 20 the plain subclass has a mastery pending again');
  // picking the current subclass again drops the mastery; the plain class drops both
  T.setMastery('windwalker'); T.setSpec('ninja');
  assert.equal(pr.masteryId, null); assert.equal(pr.specId, 'ninja');
  T.setMastery('windwalker'); T.setClass('rogue');
  assert.equal(pr.masteryId, null); assert.equal(pr.specId, null);
  game.teacher = false;
  assert.equal(T.setMastery('paladin'), false, 'teacher mode only');
});

test('debug: __game.setMastery and class_demo with masteryId', () => {
  const { game, pr } = make();
  const r = game.debug.scenario('class_demo', { masteryId: 'pyromancer' });
  assert.equal(r.ok, true, JSON.stringify(r.missing));
  assert.equal(r.masteryId, 'pyromancer'); assert.equal(r.classId, 'mage'); assert.equal(r.specId, 'sorcerer'); assert.equal(r.level, 15);
  assert.equal(pr.masteryId, 'pyromancer');
  assert.equal(game.flags.mastery_ceremony_done, true);
  const r2 = game.debug.class_demo('warrior', null, 18, 'paladin');
  assert.equal(r2.masteryId, 'paladin'); assert.equal(r2.level, 18);
  assert.equal(game.debug.state().masteryId, 'paladin');
  assert.ok(game.debug.setMastery('sage'));
  assert.equal(pr.specId, 'monk'); assert.equal(pr.masteryId, 'sage');
  const r3 = game.debug.scenario('class_demo', { masteryId: 'nope' });
  assert.ok(r3.missing.includes('mastery:nope'));
});
