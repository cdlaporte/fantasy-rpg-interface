// fixcore: regression tests for the bugs the class engineers reported (one test each) and the number scale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import { config } from '../../src/config.js';
import data from '../../src/data/index.js';
import { DT } from '../../src/contracts.js';
import { scriptedInput } from '../../src/platform/input.js';
import { PICK_INTERACT } from '../../src/core/kits/thief.js';
import { makeGame, flatZone, LOOK } from './story_fixtures.test.mjs';

const NS = config.numberScale;
const step = (game, n = 1) => { for (let i = 0; i < n; i++) game.step(DT); };
const quiet = () => { const w = console.warn; console.warn = () => {}; return () => { console.warn = w; }; };

/** Plain game in the test zone with no enemies, the player far from the walls. */
function arena(opts = {}) {
  const game = createGame({ data, name: 'Tester', seed: opts.seed ?? 4, zone: 'test' });
  for (const e of game.ents.all.slice()) if (e.type === 'enemy') game.ents.remove(e);
  game.ents.flush();
  game.setFlag('look_chosen', true);
  game.setFlag('has_stick', true);
  const p = game.player;
  game.physics.teleport(p, 34, 24.5);
  return { game, p };
}
/** A warrior at `level` (optional spec / boons) in the test zone, with a ring of `ring` dummies; hp floor off. */
function mk({ level = 3, spec = null, boons = [], ring = 0, r = 1.4 } = {}) {
  const game = createGame({ data, name: 'Tester', seed: 7, zone: 'test' });
  const pr = game.progression;
  pr.setLevel(level, { quiet: true, boons: false });
  pr.setClass('warrior', { quiet: true });
  if (spec) pr.setSpec(spec, { quiet: true });
  pr.boons = boons.slice();
  game.setFlag('look_chosen', true);
  for (const e of game.ents.all.slice()) if (e.type === 'enemy') game.ents.remove(e);
  game.ents.flush();
  const p = game.player;
  p.hp = p.hpMax;
  game.physics.teleport(p, 34, 24.5);
  const foes = [];
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2;
    foes.push(game.ents.spawn('rat', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, { noAi: true, hp: 1e6, data: { kbResist: 0 } }));
  }
  const input = scriptedInput();
  const stepIn = (n = 1, inp) => { if (inp) input.set(inp); for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  return { game, p, foes, step: stepIn };
}
const dummy = (game, x, y, hp = 1e6) => game.ents.spawn('rat', x, y, { noAi: true, hp, data: { kbResist: 1 } });

// ---------------------------------------------------------------------------------------------------------------
// 1-2. Meta: single 'ability:unlocked' emitter, no nameless slots

test('ability:unlocked fires exactly once per ability (class set and level up)', () => {
  const game = createGame({ data, zone: 'test' });
  const ev = [];
  game.bus.on('ability:unlocked', (e) => ev.push(e.slot + ':' + e.id));
  game.progression.setLevel(3, { quiet: true });
  game.progression.setClass('mage');
  assert.deepEqual(ev, ['space:blink']);
  game.progression.setLevel(5);
  assert.deepEqual(ev, ['space:blink', 'q:arcane_nova']);
  assert.equal(new Set(ev).size, ev.length);
});

test('progression.abilityList and debug.class_demo never list empty kit slots', () => {
  const game = createGame({ data, zone: 'test' });
  game.progression.setLevel(3, { quiet: true });
  game.progression.setClass('warrior', { quiet: true });
  const list = game.progression.abilityList();
  assert.ok(list.length >= 1);
  for (const a of list) assert.ok(a.name && a.id && a.slot, JSON.stringify(a));
  assert.deepEqual(list.map((a) => a.slot).sort(), ['q', 'space']);
  assert.deepEqual(game.debug.class_demo('mage', null, 5).abilities.slice().sort(), ['q', 'space']);
  assert.deepEqual(game.debug.class_demo('mage', 'sorcerer', 11).abilities.slice().sort(), ['f', 'q', 'shift', 'space']);
});

// ---------------------------------------------------------------------------------------------------------------
// 3. a kit's own aura wins over the default level-10 aura

test('refreshLook: the kit look patch aura wins over the level-10 class aura', () => {
  const g = mk({ level: 10, ring: 0 });
  const p = g.p;
  assert.equal(p.look.aura.style, 'flame', 'default aura without a patch');
  p.data.kit.lookPatch = { aura: { style: 'frost', color: '#7fd6ff' } };
  g.game.sys.player.refreshLook();
  assert.deepEqual(p.look.aura, { style: 'frost', color: '#7fd6ff' });
  p.data.kit.lookPatch = null;
  g.game.sys.player.refreshLook();
  assert.equal(p.look.aura.style, 'flame');
});

test('War Cry flare aura survives look refreshes (no look:changed workaround in the kit any more)', () => {
  const g = mk({ level: 10, ring: 1 });
  g.game.kits.setResource(g.p, 100);
  g.step(1, { pressed: { q: true } });
  g.step(2, { pressed: {} });
  assert.equal(g.p.look.aura.color, '#ff3b2a', 'War Cry flare');
  g.game.sys.player.refreshLook();
  g.game.sys.player.refreshLook();
  assert.equal(g.p.look.aura.color, '#ff3b2a');
  g.step(60 * 7);
  assert.equal(g.p.look.aura.color, '#e2503c', 'back to the class aura when the flare ends');
});

// ---------------------------------------------------------------------------------------------------------------
// 4-6. abilities: dash in hit-stop, dash tags / exclude, beam anim, chain exclude

test('dash started while the dasher is in hit-stop does not stall', () => {
  const g = mk({ level: 3, ring: 0 });
  const { game, p } = g;
  p.data.hitStop = 0.1;
  const x0 = p.x;
  game.abilities.use('dash', p, { angle: 0, dist: 3 });
  g.step(4);
  assert.ok(p.data.dash, 'still dashing while frozen by hit-stop');
  g.step(60);
  assert.ok(p.x - x0 > 2.4, 'travelled the full dash: ' + (p.x - x0).toFixed(2));
});

test('dash forwards tags to combat.damage and honours exclude', () => {
  const { game, p } = arena();
  const a = dummy(game, p.x + 1, p.y - 0.3), b = dummy(game, p.x + 1, p.y + 0.3);
  const hits = [];
  game.bus.on('hit', (e) => { if (e.source === p) hits.push(e); });
  game.abilities.use('dash', p, { angle: 0, dist: 2.5, dmg: 0.5, through: true, tags: ['probe'], exclude: [a.id] });
  step(game, 40);
  assert.ok(hits.length >= 1 && hits.every((h) => h.target === b), 'only b was hit');
  assert.ok(hits.every((h) => h.tags && h.tags[0] === 'probe'), 'tags arrive on the hit event');
});

test('beam: anim defaults to cast, anim:false leaves the animation alone', () => {
  const { game, p } = arena();
  game.ents.setAnim(p, 'block');
  game.abilities.use('beam', p, { angle: 0, range: 4, dmg: 0.1, anim: false });
  assert.equal(p.anim, 'block');
  game.abilities.use('beam', p, { angle: 0, range: 4, dmg: 0.1 });
  assert.equal(p.anim, 'cast');
});

test('chain: exclude keeps the starting target out of the chain', () => {
  const { game, p } = arena();
  const t = dummy(game, p.x + 2, p.y), u = dummy(game, p.x + 3, p.y), v = dummy(game, p.x + 4, p.y);
  const plain = game.abilities.use('chain', p, { x: t.x, y: t.y, jumps: 2, range: 3 });
  assert.equal(plain[0], t, 'without exclude the nearest target (t itself) comes first');
  const ex = game.abilities.use('chain', p, { x: t.x, y: t.y, jumps: 2, range: 3, exclude: [t.id] });
  assert.ok(ex.length === 2 && !ex.includes(t));
  assert.ok(ex.includes(u) && ex.includes(v));
});

// ---------------------------------------------------------------------------------------------------------------
// 7. town NPCs: only direct attacks, one crime per hit

function townNpc(game, x, y) {
  return game.ents.create({ type: 'npc', team: 'town', x, y, hp: 200 * NS, hpMax: 200 * NS, radius: 0.3, look: { rig: 'humanoid' } });
}

test('player zones, AoEs, chains, dashes and summons never hurt town NPCs or cause crimes', () => {
  const { game, p } = arena();
  const n = townNpc(game, p.x + 1, p.y);
  let crimes = 0;
  game.bus.on('crime', () => crimes++);
  game.combat.zone(p, { x: n.x, y: n.y, r: 1.5, dur: 2, dmg: 0.5 });
  game.combat.aoe(p, { x: n.x, y: n.y, r: 2, dmg: 1 });
  game.abilities.use('chain', p, { x: n.x, y: n.y, jumps: 3, dmg: 1 });
  game.abilities.use('dash', p, { angle: 0, dist: 2, dmg: 1, through: true });
  const s = game.combat.summon(p, 'rat', { x: n.x, y: n.y + 0.5, power: 50 });
  game.combat.aoe(s, { x: n.x, y: n.y, r: 2, dmg: 1 });
  step(game, 150);
  assert.equal(n.hp, n.hpMax, 'untouched');
  assert.equal(crimes, 0);
});

test('a direct player attack on a town NPC hurts it and emits exactly one crime per hit', () => {
  const { game, p } = arena();
  const n = townNpc(game, p.x + 1, p.y);
  const crimes = [];
  game.bus.on('crime', (e) => crimes.push(e));
  game.combat.meleeArc(p, { angle: 0, range: 2, dmg: 0.5 });
  assert.equal(crimes.length, 1);
  assert.ok(n.hp < n.hpMax);
  const pr = game.combat.projectile(p, { angle: 0, range: 5, dmg: 0.5 });
  assert.ok(pr);
  step(game, 30);
  assert.equal(crimes.length, 2, 'the projectile hit is one more crime, not two');
  assert.equal(crimes[0].victim, n);
});

// ---------------------------------------------------------------------------------------------------------------
// 8. kit hooks may start more combat inside combat loops

test('hooks that run combat inside meleeArc / aoe / zone loops do not corrupt the outer loop', () => {
  for (const kind of ['aoe', 'melee', 'zone']) {
    const { game, p } = arena();
    const foes = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; foes.push(dummy(game, p.x + Math.cos(a) * 1.4, p.y + Math.sin(a) * 1.4)); }
    // a kit hook that starts another AoE / arc around the victim for every outer hit
    const outer = new Map();
    p.data.kitL = Object.assign({}, game.kits.active(p), { hooks: Object.assign({}, game.kits.active(p).hooks, { onHit: [(g, ent, e) => {
      if (!e.tags || e.tags[0] !== 'outer') return;
      outer.set(e.target.id, (outer.get(e.target.id) || 0) + 1);
      g.combat.aoe(ent, { x: e.target.x, y: e.target.y, r: 1.5, dmg: 0.1, tags: ['inner'] });
      g.combat.meleeArc(ent, { x: e.target.x, y: e.target.y, arc: 360, range: 1.5, dmg: 0.1, tags: ['inner'], noAnim: true });
    }] }) });
    if (kind === 'aoe') game.combat.aoe(p, { x: p.x, y: p.y, r: 3, dmg: 0.3, tags: ['outer'] });
    else if (kind === 'melee') game.combat.meleeArc(p, { angle: 0, arc: 360, range: 3, dmg: 0.3, tags: ['outer'], noAnim: true });
    else { game.combat.zone(p, { x: p.x, y: p.y, r: 3, dur: 0.3, tick: 0.5, dmg: 0.3, tags: ['outer'] }); step(game, 40); }
    assert.equal(outer.size, 6, kind + ': every foe was hit by the outer loop');
    for (const c of outer.values()) assert.equal(c, 1, kind + ': exactly once');
  }
});

// ---------------------------------------------------------------------------------------------------------------
// 9. Meta merges data per id (the extensive tests live in meta-progression.test.mjs)

test('partial data never hides built-in classes, specs or boons', () => {
  const partial = { classes: { warrior: data.classes.warrior }, specs: { knight: data.specs.knight }, boons: { second_wind: data.boons.second_wind } };
  const game = createGame({ data: Object.assign({}, data, partial), zone: 'test' });
  assert.deepEqual(game.progression.classIds().slice(0, 3), ['warrior', 'mage', 'rogue']);
  assert.ok(game.progression.specIds('mage').includes('sorcerer'));
  assert.ok(game.progression.boonDefs().some((b) => b.id === 'venom_edge'));
});

// ---------------------------------------------------------------------------------------------------------------
// 10. a pickpocket is not a conversation

test('pickpocketing an NPC does not count as talking to it for quests', () => {
  const fx = {
    zones: { qz: flatZone('qz', { start: [5, 5], npc_spot: [6, 5] }) },
    npcs: { bob: { id: 'bob', name: 'Bob', look: LOOK, zone: 'qz', at: 'npc_spot' } },   // no dialogue: E counts as "talk"
    quests: { q_talk: { id: 'q_talk', name: 'Talk', steps: [{ text: 'Meet Bob', goal: { type: 'talk', npc: 'bob' } }, { text: 'Done' }] } },
  };
  const restore = quiet();
  try {
    const g = makeGame(fx, { zone: 'qz' });
    g.quests.start('q_talk');
    const bob = g.ents.all.find((e) => e.kind === 'bob');
    assert.ok(bob);
    bob.data.npcId = 'bob';
    const real = bob.interact;
    bob.interact = PICK_INTERACT;
    g.player.data.target = bob;
    g.sys.player.interact();
    assert.equal(g.quests.step('q_talk'), 0, 'still on step 0 after the pickpocket press');
    bob.interact = real || { prompt: 'Talk', range: 1.3, do: [] };
    g.player.data.target = bob;
    g.sys.player.interact();
    assert.equal(g.quests.step('q_talk'), 1, 'a normal E press advances it');
  } finally { restore(); }
});

// ---------------------------------------------------------------------------------------------------------------
// 11. Second Wind rescues the player from a killing blow (onLethal hook)

test('Second Wind: a single hit from above 25% straight to 0 triggers it first and the player survives', () => {
  const run = (boons) => {
    const g = mk({ level: 4, ring: 4, r: 1.2, boons });
    const p = g.p;
    p.data.minHp = 0;
    p.hp = Math.round(p.hpMax * 0.6);
    const downs = [];
    g.game.bus.on('player:down', () => downs.push(1));
    g.game.combat.damage(p, p.hpMax * 2, { source: g.foes[0], raw: true, type: 'true' });
    const first = { hp: p.hp, down: !!p.data.down, downs: downs.length };
    g.step(10);
    const pushed = g.foes.every((f) => Math.hypot(f.x - p.x, f.y - p.y) > 1.6);
    p.hp = Math.round(p.hpMax * 0.6);
    g.game.combat.damage(p, p.hpMax * 2, { source: g.foes[0], raw: true, type: 'true' });
    return { first, pushed, second: { down: !!p.data.down } };
  };
  const a = run([]), b = run(['second_wind']);
  assert.equal(a.first.down, true, 'without the boon the hit downs the player');
  assert.equal(b.first.down, false);
  assert.ok(b.first.hp >= 1);
  assert.ok(b.pushed, 'knocked everything back');
  assert.equal(b.second.down, true, 'internal cooldown: the next killing blow downs the player');
});

test('onLethal hook point: fires only for killing blows, can cut the damage', () => {
  const { game, p } = arena();
  p.data.kitL = Object.assign({}, game.kits.active(p), { hooks: Object.assign({}, game.kits.active(p).hooks, { onLethal: [(g, ent, info) => { info.dealt = ent.hp - 1; }] }) });
  const foe = dummy(game, p.x + 3, p.y);
  game.combat.damage(p, 5, { source: foe, raw: true, type: 'true' });
  assert.equal(p.hp, p.hpMax - 5, 'non-lethal hits do not call it');
  game.combat.damage(p, p.hpMax * 3, { source: foe, raw: true, type: 'true' });
  assert.equal(p.hp, 1);
  assert.ok(!p.data.down);
});

// ---------------------------------------------------------------------------------------------------------------
// Number scale

test('number scale: config value, rat 6x, stick hit 6x, heals and lifesteal are not double scaled', () => {
  assert.equal(config.numberScale, 6);
  const { game, p } = arena();
  assert.equal(p.hpMax, 25 * NS);
  assert.equal(p.stats.power, 2 * NS);
  const rat = game.ents.spawn('rat', p.x + 1, p.y, { noAi: true });
  assert.equal(rat.hpMax, data.enemies.rat.stats.hp * NS);
  assert.equal(rat.stats.power, data.enemies.rat.stats.power * NS);
  const dealt = game.combat.damage(rat, game.combat.coef(p, 1), { source: p, type: 'melee' });
  assert.equal(dealt, 2 * NS, 'a coefficient-1 stick hit');
  p.hp = 10;
  game.combat.damage(rat, 12, { source: p, raw: true, type: 'true', lifesteal: 0.5 });
  assert.equal(p.hp, 16, 'lifesteal is half of what was dealt, not multiplied again');
  game.combat.heal(p, 7);
  assert.equal(p.hp, 23, 'heal() takes absolute amounts as given');
  const boss = game.ents.spawn('old_mossback', p.x + 5, p.y, { noAi: true });
  assert.equal(boss.hpMax, data.enemies.old_mossback.stats.hp * NS);
});

test('number scale: companions, class stats at level 12 and summons scale; fight lengths are unchanged', () => {
  const g = mk({ level: 12, ring: 0 });
  const { game, p } = g;
  assert.equal(p.hpMax, Math.round(44 + 9 * 12) * NS);
  game.companions.set(['rogue']);
  const pip = game.companions.active[0];
  assert.equal(pip.hpMax, Math.round((34 + 6.5 * 12) * 0.7 * NS));
  assert.equal(pip.stats.power, (4.5 + 1.25 * 12) * 0.7 * NS);
  const s = game.combat.summon(p, 'rat', { hpMul: 0.5 });
  assert.equal(s.hpMax, Math.round(p.hpMax * 0.5), 'owner hpMax already carries the scale');
  // seconds to kill a rat with a coefficient-1 swing: the same at any scale (hp and power scale together)
  const rat = game.ents.spawn('rat', p.x + 1, p.y, { noAi: true });
  let hits = 0;
  while (rat.alive && !rat.removed && hits < 100) { game.combat.damage(rat, game.combat.coef(p, 1), { source: p }); hits++; }
  assert.equal(hits, Math.ceil(data.enemies.rat.stats.hp / (p.stats.power / NS)), 'hits to kill = base hp / base power');
});
