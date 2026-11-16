// Meta: progression (levels, stats, boons, class/spec/look pickers, player down).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import baseData from '../../src/data/index.js';
import { config } from '../../src/config.js';
import { createQuestions } from '../../src/questions/index.js';
import { xpNext, rankAt, DEFAULT_BOONS } from '../../src/core/progression.js';
import { DT, makeInputState } from '../../src/contracts.js';

const flush = () => new Promise((r) => setImmediate(r));
async function steps(game, n, input) {
  for (let i = 0; i < n; i++) { game.step(DT, input); if (i % 4 === 0) await flush(); }
  await flush();
}
function make(opts = {}) {
  const data = Object.assign({}, baseData, opts.data || {});
  const game = createGame({ data, name: 'Tester', seed: opts.seed ?? 11, zone: 'test', questions: createQuestions({ mode: opts.mode || 'auto' }) });
  const log = [];
  for (const e of ['levelup', 'rank:up', 'ability:unlocked', 'class:set', 'spec:set', 'boon', 'toast', 'xp', 'player:revived', 'gate:ask'])
    game.bus.on(e, (p) => log.push([e, p]));
  return { game, log, of: (e) => log.filter((x) => x[0] === e).map((x) => x[1]) };
}
const NS = config.numberScale;   // health and power are base numbers x the number scale
const SPD = config.playerSpeedMul || 1;   // round 2: the player walks faster than the class numbers
const r2 = (v) => Math.round(v * 100) / 100;
const quietWarn = () => { const w = console.warn; console.warn = () => {}; return () => { console.warn = w; }; };

test('xp curve and rank thresholds', () => {
  // round 2: the curve comes from config.xpCurve
  const { base, exp } = config.xpCurve;
  assert.equal(xpNext(1), Math.round(base));
  assert.equal(xpNext(2), Math.round(base * 2 ** exp));
  assert.equal(xpNext(11), Math.round(base * 11 ** exp));
  assert.deepEqual([1, 3, 4, 7, 8, 11, 12, 16].map(rankAt), [1, 1, 2, 2, 3, 3, 4, 5]);
});

test('level up: full heal, fx, knockback ring, toast, events, boons, cap', () => {
  const { game, of } = make();
  const pr = game.progression;
  const aoe = [];
  game.combat.aoe = (src, o) => { aoe.push(o); return []; };
  game.player.hp = 3;
  assert.equal(pr.level, 1);
  assert.equal(pr.addXp(xpNext(1) - 1), 0);
  assert.equal(pr.level, 1);
  pr.addXp(1);
  assert.equal(pr.level, 2);
  assert.equal(pr.xp, 0);
  assert.equal(pr.xpNext, xpNext(2));
  assert.equal(game.player.hp, game.player.hpMax, 'full heal');
  assert.equal(of('levelup').at(-1).level, 2);
  assert.ok(of('toast').some((t) => t.text === 'Level 2!'));
  assert.equal(aoe.length, 1);
  assert.ok(aoe[0].knockback > 0 && aoe[0].dmg === 0);
  game.setViewRect({ x0: 0, y0: 0, x1: 40, y1: 30 });
  const f = game.frame(1);
  const types = []; for (let i = 0; i < f.fxCount; i++) types.push(f.fx[i].type);
  assert.ok(types.includes('levelup') && types.includes('ring'));
  // two levels at once: carry-over xp
  pr.addXp(xpNext(2) + xpNext(3) + 5);
  assert.equal(pr.level, 4);
  assert.equal(pr.xp, 5);
  assert.equal(of('rank:up').length, 1);
  assert.deepEqual(of('rank:up')[0], { rank: 2, prev: 1 });
  assert.equal(pr.pendingBoons, 1, 'boon queued at 4');
  pr.addXp(1e6);
  assert.equal(pr.level, 12, 'cap from config');
  assert.equal(pr.pendingBoons, 5, 'boons at 4/6/8/10/12');
  assert.equal(pr.rank(), 4);
  assert.equal(pr.addXp(50), 0);
  assert.equal(pr.level, 12);
  const hud = game.hudState();
  assert.equal(hud.player.level, 12);
  assert.equal(hud.pendingBoons, 5);
});

test('stats from the balance sheet, spec mods, data overrides', () => {
  let { game } = make();
  const p = game.player, pr = game.progression;
  assert.equal(p.hpMax, 25 * NS); assert.equal(p.stats.power, 2 * NS); assert.equal(p.stats.speed, r2(3.2 * SPD));   // number scale: hp and power x NS; speed x playerSpeedMul
  pr.setLevel(3, { quiet: true });
  pr.setClass('warrior', { quiet: true });
  assert.equal(p.hpMax, (44 + 9 * 3) * NS);
  assert.equal(p.stats.power, Math.round(8.9 * NS * 100) / 100);
  assert.equal(p.stats.speed, r2(3.4 * SPD));
  pr.setLevel(8, { quiet: true });
  pr.setSpec('knight', { quiet: true });
  assert.equal(p.hpMax, Math.round((44 + 72) * 1.25 * NS));
  assert.equal(p.stats.speed, r2(3.4 * 0.95 * SPD));
  const hud = game.hudState();
  assert.equal(hud.player.className, 'Warrior');
  assert.equal(hud.player.specName, 'Knight');
  assert.equal(hud.player.power, p.stats.power);
  // statMods hook (kits / items)
  p.data.statMods = { test: { power: 2 } };
  pr.recalc();
  assert.equal(p.stats.power, Math.round((5 + 1.3 * 8) * 2 * NS * 100) / 100);
  // data overrides the defaults field by field
  ({ game } = make({ data: {
    classes: { warrior: { id: 'warrior', name: 'Brawler', base: { hp: 100, hpPerLevel: 0, power: 10, powerPerLevel: 0, speed: 5, defense: 2 } } },
    specs: { knight: { id: 'knight', from: 'warrior', name: 'Paladin', mods: { hp: 2 } } },
  } }));
  game.progression.setClass('warrior', { quiet: true });
  assert.equal(game.player.hpMax, 100 * NS);
  assert.equal(game.player.stats.defense, 2);
  assert.equal(game.progression.className(), 'Brawler');
  game.progression.setSpec('knight', { quiet: true });
  assert.equal(game.player.hpMax, 200 * NS);
  assert.equal(game.player.stats.speed, r2(5 * 0.95 * SPD), 'mods not given in data keep the CLASSES default (knight speed x0.95)');
});

test('ability unlocks and spec readiness', () => {
  const { game, of } = make();
  const pr = game.progression;
  pr.setLevel(3, { quiet: true });
  pr.setClass('mage');
  assert.deepEqual(of('ability:unlocked').map((a) => a.slot), ['space']);
  pr.addXp(xpNext(3) + xpNext(4));
  assert.equal(pr.level, 5);
  assert.deepEqual(of('ability:unlocked').map((a) => a.slot), ['space', 'q']);
  pr.setLevel(8);
  assert.equal(game.flags.spec_ready, true);
  assert.equal(pr.pendingSpec, true);
  assert.ok(of('toast').some((t) => /Laporte/.test(t.text)));
  assert.equal(game.hudState().pendingSpec, true);
  pr.setSpec('sorcerer');
  assert.equal(pr.pendingSpec, false);
  assert.ok(of('ability:unlocked').some((a) => a.slot === 'f'));
  pr.setLevel(11);
  assert.ok(of('ability:unlocked').some((a) => a.slot === 'shift'));
  // the active kit's abilities win when the kit lists any
  const { game: g2, of: of2 } = make();
  g2.sys.kits.active = () => ({ abilities: { space: { id: 'zap', name: 'Zap', unlock: 2 }, q: { id: 'boom', unlock: 3 } } });
  g2.progression.setLevel(3);
  assert.deepEqual(of2('ability:unlocked').map((a) => a.id), ['zap', 'boom']);
});

test('boon offers: class pool, spec pool, no repeats, deterministic', () => {
  const mk = (seed) => {
    const { game } = make({ seed });
    game.progression.setLevel(4, { quiet: true });
    game.progression.setClass('warrior', { quiet: true });
    return game;
  };
  const a = mk(5), b = mk(5);
  const oa = a.progression.offerBoons(3), ob = b.progression.offerBoons(3);
  assert.equal(oa.length, 3);
  assert.deepEqual(oa, ob, 'same seed and state -> same offer');
  assert.equal(new Set(oa.map((o) => o.id)).size, 3);
  const warriorIds = DEFAULT_BOONS.filter((x) => x.class === 'warrior').map((x) => x.id);
  assert.ok(oa.every((o) => warriorIds.includes(o.id)));
  for (const o of oa) assert.ok(o.name && o.desc && o.icon);
  // owned boons are excluded
  a.progression.chooseBoon(oa[0].id);
  for (let i = 0; i < 5; i++) assert.ok(!a.progression.offerBoons(3).some((o) => o.id === oa[0].id));
  // after specializing at least one spec boon is offered while any remain
  a.progression.setLevel(8, { quiet: true });
  a.progression.setSpec('knight', { quiet: true });
  const knightIds = DEFAULT_BOONS.filter((x) => x.spec === 'knight').map((x) => x.id);
  for (let i = 0; i < 4; i++) {
    const offer = a.progression.offerBoons(3);
    assert.ok(offer.some((o) => knightIds.includes(o.id)), 'spec boon offered');
    assert.ok(offer.every((o) => knightIds.includes(o.id) || warriorIds.includes(o.id)));
    a.progression.chooseBoon(offer.find((o) => knightIds.includes(o.id)).id);
  }
  assert.ok(!a.progression.offerBoons(3).some((o) => knightIds.includes(o.id)), 'spec pool exhausted');
  // data/boons.js merges per id over the default pool: new ids are added, known ids override fields only
  const { game: g } = make({ data: { boons: { b1: { id: 'b1', class: 'rogue', name: 'One', desc: 'd', icon: 'star' }, venom_edge: { name: 'Renamed' } } } });
  const ids = g.progression.boonDefs().map((x) => x.id);
  assert.ok(ids.includes('b1') && ids.includes('boomerang_blade') && ids.includes('second_wind'), 'defaults stay');
  const ve = g.progression.boonDefs().find((x) => x.id === 'venom_edge');
  assert.equal(ve.name, 'Renamed');
  assert.equal(ve.class, 'rogue');
  assert.ok(ve.desc, 'default desc kept');
  g.progression.setClass('rogue', { quiet: true });
  const rogueIds = g.progression.boonDefs().filter((x) => x.class === 'rogue' && !x.spec).map((x) => x.id);
  assert.ok(rogueIds.includes('b1') && rogueIds.includes('boomerang_blade'));
  assert.ok(g.progression.offerBoons(3).every((o) => rogueIds.includes(o.id)));
});

test('classes and specs merge per id: partial data adds or overrides, never hides the built-in ones', () => {
  const { game } = make({ data: { classes: { mage: { name: 'Wizard' }, bard: { id: 'bard', name: 'Bard', color: '#fff', blurb: 'x', base: { hp: 30, hpPerLevel: 5, power: 4, powerPerLevel: 1, speed: 3.3 } } }, specs: { skald: { id: 'skald', from: 'bard', name: 'Skald' } } } });
  const pr = game.progression;
  assert.deepEqual(pr.classIds(), ['warrior', 'mage', 'rogue', 'bard']);
  assert.equal(pr.classDef('mage').name, 'Wizard');
  assert.ok(pr.classDef('mage').base.hp > 0 && pr.classDef('mage').look, 'default fields kept');
  assert.ok(pr.specIds('warrior').includes('knight'), 'default specs stay');
  assert.deepEqual(pr.specIds('bard'), ['skald']);
});

test('boon picker: Tab opens it through the boon gate; pickBoon; wrong answer -> 2 options', async () => {
  const { game, of } = make();
  const pr = game.progression;
  pr.setLevel(4, { quiet: true });
  pr.setClass('rogue', { quiet: true });
  pr.pendingBoons = 1;
  const input = makeInputState();
  input.pressed.boon = true;
  game.step(DT, input);
  await flush();
  assert.equal(game.modal && game.modal.type, 'boonPicker');
  assert.equal(game.modal.options.length, 3);
  assert.equal(of('gate:ask')[0].req.context, 'boon');
  const pick = game.modal.options[1].id;
  assert.equal(game.commands.pickBoon('nope'), false);
  assert.equal(game.commands.pickBoon(pick), true);
  assert.equal(game.modal, null);
  assert.ok(pr.hasBoon(pick));
  assert.equal(pr.pendingBoons, 0);
  assert.deepEqual(of('boon')[0], { id: pick });
  // no pending -> Tab does nothing
  game.step(DT, input);
  await flush();
  assert.equal(game.modal, null);

  // stub mode, non-blocking boon context, wrong answer -> 2 options; closing keeps the offer (no re-roll)
  const ctx = game.config.questions.contexts.boon;
  const saved = Object.assign({}, ctx);
  ctx.blocking = false;
  try {
    const { game: g } = make({ mode: 'stub' });
    g.progression.setClass('mage', { quiet: true });
    g.progression.setLevel(4, { quiet: true, boons: true });
    assert.equal(g.progression.pendingBoons, 1);
    const p = g.progression.openBoonPicker();
    assert.equal(g.modal.type, 'question');
    g.debug.answerQuestion(false);
    await flush();
    assert.equal(g.modal.type, 'boonPicker');
    assert.equal(g.modal.options.length, 2);
    const first = g.modal.options.map((o) => o.id);
    g.closeModal();
    assert.equal(await p, null);
    assert.equal(g.progression.pendingBoons, 1);
    g.progression.openBoonPicker();
    await flush();
    assert.equal(g.modal.type, 'boonPicker', 'reopened without a new question');
    assert.deepEqual(g.modal.options.map((o) => o.id), first);
  } finally { Object.assign(ctx, saved); }
});

test('class, spec and look pickers through ops and commands', async () => {
  const { game, of } = make();
  const pr = game.progression;
  const kitCalls = [];
  const realSet = game.sys.kits.set;
  game.sys.kits.set = (ent, c, s) => { kitCalls.push([c, s]); return realSet(ent, c, s); };
  let refreshed = 0;
  game.sys.player.refreshLook = () => { refreshed++; };
  pr.setLevel(3, { quiet: true });

  // look picker
  const lp = game.ops.run([['lookPicker']]);
  assert.equal(game.modal.type, 'lookPicker');
  assert.equal(game.modal.name, 'Tester');
  assert.equal(game.modal.looks.length, 2);
  game.commands.pickLook(1);
  assert.equal(await lp, undefined);
  assert.equal(game.flags.look_choice, 1);
  assert.equal(game.flags.look_chosen, true);
  assert.ok(refreshed >= 1);

  // class picker
  let resolved = null;
  const cp = pr.openClassPicker().then((v) => { resolved = v; });
  const m = game.modal;
  assert.equal(m.type, 'classPicker');
  assert.deepEqual(m.classes.map((c) => c.id), ['warrior', 'mage', 'rogue']);
  for (const c of m.classes) {
    assert.ok(c.name && c.blurb && c.look && c.look.rig === 'humanoid' && c.basic.name);
    assert.ok(c.abilities.length >= 2 && c.abilities.every((a) => a.slot && a.name && a.icon && a.unlock));
  }
  assert.equal(m.classes[1].look.outfit.style, 'robe', 'preview look carries the class patch');
  assert.equal(game.commands.pickClass('bard'), false);
  game.commands.pickClass('mage');
  await cp;
  assert.equal(resolved, 'mage');
  assert.equal(pr.classId, 'mage');
  assert.equal(game.player.data.classId, 'mage');
  assert.deepEqual(of('class:set'), [{ classId: 'mage' }]);
  assert.deepEqual(kitCalls.at(-1), ['mage', null]);
  assert.ok(game.ops.test([['class', 'mage']]) && !game.ops.test([['class', 'warrior']]));

  // spec picker asks the spec gate first, then offers the class's specs
  pr.setLevel(8, { quiet: true });
  const sp = game.ops.run([['specPicker']]);
  await flush();
  assert.ok(of('gate:ask').some((g) => g.req.context === 'spec'));
  assert.equal(game.modal.type, 'specPicker');
  assert.deepEqual(game.modal.options.map((o) => o.id).sort(), ['conjurer', 'monk', 'sorcerer']);
  assert.ok(game.modal.options.every((o) => o.abilities.some((a) => a.slot === 'f')));
  assert.equal(game.commands.pickSpec('knight'), false, 'not a mage spec');
  game.commands.pickSpec('monk');
  await sp;
  assert.equal(pr.specId, 'monk');
  assert.deepEqual(of('spec:set'), [{ specId: 'monk' }]);
  assert.deepEqual(kitCalls.at(-1), ['mage', 'monk']);
  assert.ok(game.ops.test([['spec', 'monk'], ['level', '>=', 8], ['level', 8]]));
  assert.ok(!game.ops.test([['level', '<', 8]]));
  // celebration fx
  game.setViewRect({ x0: 0, y0: 0, x1: 40, y1: 30 });
  const f = game.frame(1);
  const types = []; for (let i = 0; i < f.fxCount; i++) types.push(f.fx[i].type);
  for (const t of ['pillar', 'sparkle', 'levelup']) assert.ok(types.includes(t), t);
});

test('player down: respawn marker, infirmary, wanted fine, revive gate cooldown, invulnerability', async () => {
  const restore = quietWarn();
  try {
    // before intro_done: current zone's respawn/start marker; questions off -> no revive question
    let { game, of } = make({ mode: 'off' });
    const start = game.world.marker('start');
    game.player.x = 30; game.player.y = 20; game.player.hp = 0;
    game.bus.emit('player:down', {});
    game.bus.emit('player:down', {});   // repeated emits are ignored while handling
    game.step(DT);
    await flush();
    assert.equal(of('player:revived').length, 1);
    assert.equal(of('player:revived')[0].where, 'respawn');
    assert.equal(game.player.x, start.x);
    assert.equal(game.player.hp, game.player.hpMax);
    assert.ok(game.player.status.invuln > 0 && game.player.status.invuln <= 2.5, 'brief invulnerability');
    assert.ok(of('toast').some((t) => /Laporte/.test(t.text)));

    // after intro_done: academy infirmary; wanted -> 10% fine and wanted cleared
    const academy = Object.assign({}, baseData.zones.test, { id: 'academy', name: 'Academy', markers: Object.assign({}, baseData.zones.test.markers, { infirmary: [30, 25] }) });
    ({ game, of } = make({ mode: 'off', data: { zones: Object.assign({}, baseData.zones, { academy }) } }));
    game.setFlag('intro_done', true);
    game.setFlag('wanted', true);
    game.inventory.addGold(105);
    game.player.hp = 0;
    game.bus.emit('player:down', {});
    await steps(game, 30);   // the real world.travel fades over 24 steps
    assert.equal(game.zone.id, 'academy');
    assert.ok(Math.abs(game.player.x - 30.5) < 0.6, 'at the infirmary marker (physics may nudge it out of a wall)');
    assert.equal(game.inventory.gold, 95);
    assert.equal(game.flags.wanted, false);
    assert.equal(of('player:revived')[0].where, 'infirmary');
    assert.ok(of('toast').some((t) => /Nurse/.test(t.text) && /10 gold/.test(t.text)));

    // auto mode: the revive question is answered correctly -> back on your feet where you fell; then 5 min cooldown
    ({ game, of } = make({ mode: 'auto' }));
    game.player.x = 30; game.player.hp = 0;
    game.bus.emit('player:down', {});
    await steps(game, 2);
    assert.equal(of('player:revived')[0].where, 'here');
    assert.equal(game.player.x, 30);
    assert.equal(of('gate:ask').filter((g) => g.req.context === 'revive').length, 1);
    game.player.hp = 0;
    game.bus.emit('player:down', {});
    await steps(game, 2);
    assert.equal(of('player:revived')[1].where, 'respawn');
    assert.equal(of('gate:ask').filter((g) => g.req.context === 'revive').length, 1, 'no second question within 5 minutes');

    // stub mode, wrong answer -> respawn (the revive question does not block)
    ({ game, of } = make({ mode: 'stub' }));
    game.player.hp = 0;
    game.bus.emit('player:down', {});
    game.step(DT);
    assert.equal(game.modal && game.modal.type, 'question');
    assert.equal(game.modal.req.context, 'revive');
    game.debug.answerQuestion(false);
    await flush();
    assert.equal(of('player:revived')[0].where, 'respawn');
    assert.equal(game.modal, null);
    assert.equal(game.freeze.size, 0);

    // minHp floor (ambush): no down handling
    ({ game, of } = make({ mode: 'off' }));
    game.player.data.minHp = 1;
    game.bus.emit('player:down', {});
    await steps(game, 2);
    assert.equal(of('player:revived').length, 0);
  } finally { restore(); }
});

test('progression save/load keeps class, spec, boons and pending state', () => {
  const { game } = make();
  const pr = game.progression;
  pr.setLevel(9, { quiet: true });
  pr.setClass('warrior', { quiet: true });
  pr.setSpec('berserker', { quiet: true });
  pr.chooseBoon('cyclone');
  pr.pendingBoons = 2;
  pr.addXp(7);
  const json = JSON.parse(JSON.stringify(game.saveSystems()));
  const { game: g2 } = make();
  g2.loadSystems(json);
  const p2 = g2.progression;
  assert.equal(p2.level, 9); assert.equal(p2.xp, 7);
  assert.equal(p2.classId, 'warrior'); assert.equal(p2.specId, 'berserker');
  assert.deepEqual(p2.boons, ['cyclone']);
  assert.equal(p2.pendingBoons, 2);
  assert.equal(g2.player.hpMax, game.player.hpMax);
  assert.equal(g2.player.hp, g2.player.hpMax);
  assert.equal(g2.hudState().player.specName, 'Berserker');
});
