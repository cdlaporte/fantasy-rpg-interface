// Sim: every AI brain acts and telegraphs; boss shield flow; allies, decoys, companions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import baseData from '../../src/data/index.js';
// integration: fixtures go into a private copy, never into the shared data module (other test files, such as the
// content validators and the bot, run in the same process and must see only real content)
const data = Object.assign({}, baseData, { zones: Object.assign({}, baseData.zones), enemies: Object.assign({}, baseData.enemies),
  npcs: Object.assign({}, baseData.npcs) });
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

const rows = [];
for (let y = 0; y < 30; y++) {
  let r = '';
  for (let x = 0; x < 40; x++) r += x === 0 || y === 0 || x === 39 || y === 29 ? '#' : '.';
  rows.push(r);
}
data.zones.simopen = data.zones.simopen || {
  id: 'simopen', name: 'Open Field', palette: 'default', seed: 3, tiles: { rows, legend: { '#': 'hedge', '.': 'grass' } },
  markers: { start: [20, 15] }, exits: [], props: [], spawns: [], npcs: [], gates: [], chests: [], triggers: [],
};

const look = { rig: 'blob', size: 0.6, colors: { body: '#88cc66', belly: '#ffffff', accent: '#335522', eye: '#111111' }, features: [] };
const melee = { use: 'melee_arc', range: 0.8, dmg: 1, cd: 1, windup: 0.3, arc: 90 };
function def(id, brain, attacks, extra = {}) {
  return Object.assign({ id, name: id, level: 3, tags: [], stats: { hp: 60, power: 1, defense: 0, speed: 2.6, radius: 0.32, xp: 1 },
    ai: Object.assign({ brain, aggro: 8, leash: 25 }, extra.ai), attacks, look, drops: null, boss: null }, extra.def);
}
Object.assign(data.enemies, {
  t_wander: def('t_wander', 'wander', [melee]),
  t_chaser: def('t_chaser', 'chaser', [melee]),
  t_skirm: def('t_skirm', 'skirmisher', [{ use: 'projectile', range: 6, dmg: 1, cd: 1.2, windup: 0.4, telegraph: 'line', speed: 9, model: 'rock' }], { ai: { keepRange: 4 } }),
  t_charger: def('t_charger', 'charger', [{ use: 'dash', range: 6, minRange: 1.2, dmg: 1.5, cd: 2, windup: 0.6, telegraph: 'line', speed: 12 }]),
  t_turret: def('t_turret', 'turret', [{ use: 'ground_target', range: 7, r: 1.2, delay: 0.6, dmg: 1, cd: 2, windup: 0.4 }]),
  t_swarmer: def('t_swarmer', 'swarmer', [melee], { ai: { swarm: true }, def: { flying: true } }),
  t_summoner: def('t_summoner', 'summoner', [{ use: 'projectile', range: 7, dmg: 1, cd: 2, windup: 0.4 }], { ai: { summon: { kind: 'rat', n: 2, max: 3, cd: 3 } } }),
  t_ambusher: def('t_ambusher', 'ambusher', [melee], { ai: { aggro: 3 } }),
  t_flee: def('t_flee', 'flee', [melee], { ai: { aggro: 6 } }),
  t_boss: def('t_boss', 'boss', [
    { use: 'aoe_ring', name: 'stomp', range: 2.5, r: 2.2, dmg: 1, cd: 1.5, windup: 0.5 },
    { use: 'multishot', name: 'volley', range: 8, n: 5, spread: 60, dmg: 1, cd: 2, windup: 0.5, telegraph: 'cone' },
  ], { def: { name: 'Big Test', stats: { hp: 300, power: 1, defense: 0, speed: 2, radius: 0.6, xp: 50 },
    boss: { phases: [{ untilHp: 0.5, pattern: ['stomp'] }, { untilHp: 0, pattern: ['volley', 'stomp'] }], shieldAt: [0.66, 0.33], difficulty: 3 } } }),
});
data.npcs.t_guard = data.npcs.t_guard || { id: 't_guard', name: 'Guard', team: 'town', look: { rig: 'humanoid' }, stats: { hp: 40, power: 1, speed: 3 },
  ai: { brain: 'guard', aggro: 10 }, attacks: [melee], routine: [] };

function mk(seed = 2) {
  const game = createGame({ data, name: 'Tester', seed, zone: 'simopen', marker: 'start' });
  const input = scriptedInput();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  game.player.data.minHp = 1;
  return { game, input, step, p: game.player };
}
const tick = () => new Promise((r) => setImmediate(r));

function watch(game, e) {
  const w = { windups: [], attacks: 0, teles: new Set(), chargeSeen: false, bad: 0 };
  game.bus.on('ai:windup', (ev) => {
    if (ev.ent !== e) return;
    w.windups.push(ev.windup);
    if (ev.windup < 0.3) w.bad++;
    if (e.anim === 'charge') w.chargeSeen = true;
  });
  game.bus.on('ai:attack', (ev) => { if (ev.ent === e) w.attacks++; });
  game.bus.on('ent:spawned', ({ ent }) => { if (ent.kind === 'telegraph' && ent.owner === e.id) w.teles.add(ent.look.model); });
  return w;
}

for (const [kind, dx, extraCheck] of [
  ['t_chaser', 3], ['t_skirm', 3, (w) => assert.ok(w.teles.has('telegraph_line'), 'line telegraph')],
  ['t_charger', 4, (w) => assert.ok(w.teles.has('telegraph_line'))], ['t_turret', 4, (w) => assert.ok(w.teles.has('telegraph_circle'))],
  ['t_swarmer', 3], ['t_summoner', 4], ['t_ambusher', 2],
]) {
  test(`brain ${kind} acts and telegraphs every attack`, () => {
    const { game, step, p } = mk();
    const e = game.ents.spawn(kind, p.x + dx, p.y);
    const w = watch(game, e);
    let hurt = 0;
    game.bus.on('hit', (ev) => { if (ev.target === p) hurt++; });
    step(600);
    assert.ok(w.attacks >= 1, `${kind} attacked (${w.attacks})`);
    assert.equal(w.bad, 0, 'every windup >= 0.3 s');
    assert.ok(w.windups.length >= w.attacks, 'every attack had a windup');
    assert.ok(w.chargeSeen, "anim 'charge' during windup");
    if (extraCheck) extraCheck(w);
    if (kind === 't_summoner') assert.ok(game.ents.all.some((o) => o.kind === 'rat' && o.owner === e.id), 'summoned rats');
    if (kind !== 't_summoner' && kind !== 't_turret') assert.ok(hurt >= 1, 'hurt the player');
  });
}

test('brain wander idles until provoked, then fights', () => {
  const { game, step, p } = mk();
  const e = game.ents.spawn('t_wander', p.x + 2, p.y);
  const w = watch(game, e);
  const x0 = e.x, y0 = e.y;
  step(400);
  assert.equal(w.attacks, 0, 'passive');
  assert.ok(Math.hypot(e.x - x0, e.y - y0) > 0.1 || e.anim === 'idle', 'wanders');
  game.combat.damage(e, 1, { source: p });
  step(300);
  assert.ok(w.attacks >= 1 && w.bad === 0);
});

test('brain flee runs away', () => {
  const { game, step, p } = mk();
  const e = game.ents.spawn('t_flee', p.x + 2, p.y);
  step(120);
  assert.ok(Math.hypot(e.x - p.x, e.y - p.y) > 4, 'kept its distance');
});

test('brain guard hits the player only while wanted', () => {
  const { game, step, p } = mk();
  const g = game.ents.spawn('t_guard', p.x + 2, p.y);
  assert.equal(g.type, 'npc');
  assert.equal(g.ai.brain, 'guard');
  const w = watch(game, g);
  step(300);
  assert.equal(w.attacks, 0, 'peaceful');
  game.setFlag('wanted', true);
  step(300);
  assert.ok(w.attacks >= 1, 'arrests the wanted player');
  assert.equal(w.bad, 0);
  game.setFlag('wanted', false);
  const n = w.attacks;
  step(300);
  assert.ok(w.attacks <= n + 1, 'stops when no longer wanted');
});

test('boss: phases, shields at thresholds with a fake gates (wrong, retry after 8 s, right)', async () => {
  const { game, step, p } = mk();
  const asks = [];
  const answers = [false, true, true];
  game.sys.gates.ask = (req) => { asks.push(req); return Promise.resolve({ correct: answers.shift(), skipped: false }); };
  const b = game.ents.spawn('t_boss', p.x + 3, p.y);
  const w = watch(game, b);
  step(200);
  assert.ok(w.attacks >= 1 && w.bad === 0, 'boss attacks with windups');
  const hud = game.hudState();
  assert.equal(hud.boss.name, 'Big Test');
  game.combat.damage(b, 9999, { source: p, type: 'true' });
  assert.equal(b.hp, Math.floor(0.66 * b.hpMax), 'hp floors at the first threshold');
  step(1);
  assert.equal(asks.length, 1);
  assert.equal(asks[0].context, 'boss_shield');
  assert.equal(asks[0].difficulty, 3);
  assert.ok(b.data.shielded && b.fxTags.includes('shield'));
  assert.equal(game.hudState().boss.shield, true);
  assert.equal(game.combat.damage(b, 50, { source: p }), 0, 'invulnerable while shielded');
  await tick();
  step(60);
  assert.ok(b.data.shielded, 'wrong answer: shield stays');
  assert.equal(asks.length, 1);
  step(8 * 60);
  assert.equal(asks.length, 2, 'asks again after 8 s');
  await tick();
  step(1);
  assert.ok(!b.data.shielded && !b.fxTags.includes('shield'), 'correct answer shatters the shield');
  assert.ok(b.status.stun > 0, 'stunned after the shatter');
  game.combat.damage(b, 9999, { source: p, type: 'true' });
  assert.equal(b.hp, Math.floor(0.33 * b.hpMax));
  step(1);
  assert.equal(asks.length, 3);
  await tick();
  step(1);
  assert.ok(!b.data.shielded);
  let died = false;
  game.bus.on('death', (ev) => { if (ev.ent === b) died = true; });
  game.combat.damage(b, 9999, { source: p, type: 'true' });
  assert.ok(died, 'defeated after the last shield');
});

test('allies: summons fight enemies, prefer marked targets; decoys taunt', () => {
  const { game, step, p } = mk();
  const a = game.ents.spawn('rat', p.x + 4, p.y, { noAi: true, hp: 500, hpMax: 500 });
  const marked = game.ents.spawn('rat', p.x - 4, p.y, { noAi: true, hp: 500, hpMax: 500 });
  game.combat.status(marked, 'mark', 30);
  const pet = game.abilities.use('summon', p, { def: { id: 'fox', name: 'Fox', look, stats: { speed: 4, radius: 0.3 } },
    attacks: [{ use: 'melee_arc', range: 0.8, dmg: 1, cd: 0.5, windup: 0.1 }], max: 2, ttl: 30 })[0];
  assert.equal(pet.type, 'summon');
  assert.equal(pet.team, 'player');
  assert.equal(pet.owner, p.id);
  assert.ok(pet.fxTags.includes('summoned'));
  const hitBy = { a: 0, m: 0 };
  game.bus.on('hit', (ev) => { if (ev.source === pet) { if (ev.target === a) hitBy.a++; if (ev.target === marked) hitBy.m++; } });
  step(300);
  assert.ok(hitBy.m > 0 && hitBy.a === 0, 'went for the marked enemy: ' + JSON.stringify(hitBy));
  // max: a second and third summon replace the oldest
  game.abilities.use('summon', p, { def: { id: 'fox', look }, key: 'fox', max: 2 });
  game.abilities.use('summon', p, { def: { id: 'fox', look }, key: 'fox', max: 2 });
  step(1);
  assert.equal(game.combat.summonsOf(p, 'fox').length, 2);
  // decoy taunt
  const { game: g2, step: s2, p: p2 } = mk();
  const c = g2.ents.spawn('t_chaser', p2.x + 3, p2.y);
  s2(30);
  assert.equal(c.ai.target, p2.id);
  const d = g2.combat.decoy(p2, { ttl: 3 });
  g2.physics.teleport(p2, p2.x - 5, p2.y);
  s2(12);
  assert.equal(c.ai.target, d.id, 'enemies prefer the decoy');
  assert.ok(d.fxTags.includes('shadow'));
  s2(200);
  assert.ok(d.removed, 'decoy expired');
});

test('companions: follow, fight, never die, HUD list', () => {
  const { game, step, p } = mk();
  const list = game.companions.set(['warrior', 'mage']);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((e) => e.name), ['Bram', 'Elowen']);
  assert.ok(list.every((e) => e.type === 'companion' && e.team === 'player'));
  const hud = game.hudState();
  assert.equal(hud.companions.length, 2);
  assert.equal(hud.companions[1].classId, 'mage');
  const foe = game.ents.spawn('rat', p.x + 3, p.y, { noAi: true, hp: 999, hpMax: 999 });
  let compHits = 0;
  game.bus.on('hit', (ev) => { if (ev.source && ev.source.type === 'companion' && ev.target === foe) compHits++; });
  step(400);
  assert.ok(compHits > 3, 'companions attack: ' + compHits);
  const bram = list[0];
  game.combat.damage(bram, 9999, { source: foe, type: 'true' });
  assert.ok(bram.data.down && bram.alive && !bram.removed, 'down, not dead');
  step(10.2 * 60);
  assert.ok(!bram.data.down && bram.hp > 0, 'back up after 10 s');
  game.physics.teleport(p, 3, 3);
  step(2);
  assert.ok(Math.hypot(bram.x - p.x, bram.y - p.y) < 3, 'teleported back to the player');
  assert.deepEqual(game.saveSystems().companions, { list: ['warrior', 'mage'] });
});
