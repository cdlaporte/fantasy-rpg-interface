// Sim: zone furniture (spawns, exits, triggers, gates, chests, prop anchors), moveTo, pathfinding,
// activation bubble + caps, determinism, performance.
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
  for (let x = 0; x < 60; x++) {
    if (x === 0 || y === 0 || x === 59 || y === 29) r += '#';
    else if (x === 20 && y !== 11 && y !== 12) r += '#';
    else r += '.';
  }
  rows.push(r);
}
data.zones.simworld = {
  id: 'simworld', name: 'Furniture Yard', palette: 'default', seed: 21, tiles: { rows, legend: { '#': 'hedge', '.': 'grass' } },
  markers: { start: [6, 12], gate_a: [10, 6], chest_a: [6, 4], chest_b: [8, 4], exit_e: [58, 15], exit_lock: [40, 1], far: [55, 25] },
  exits: [{ at: 'exit_e', w: 1, h: 3, to: 'simfield', marker: 'start' },
    { at: 'exit_lock', w: 3, h: 1, to: 'simfield', marker: 'start', if: [['flag', 'never']], locked: 'Sealed until next term' }],
  props: [{ kind: 'shop', x: 30, y: 20, id: 'p_shop', interact: { prompt: 'Enter', do: [['flag.set', 'entered', true]] } }],
  spawns: [{ kind: 'rat', area: [44, 20, 6, 4], n: 2, respawn: 5, level: 2 }],
  npcs: [],
  gates: [{ id: 'g1', at: 'gate_a', w: 3, h: 1, req: [['flag', 'gate_ok']], question: { context: 'gate', difficulty: 1 } }],
  chests: [{ id: 'c1', at: 'chest_a', loot: 'forest_small', rune: true }, { id: 'c2', at: 'chest_b', loot: 'forest_small' }],
  triggers: [{ id: 't1', area: [10, 20, 3, 3], once: true, do: [['flag.set', 'trig_ran', true], ['sim.count']] }],
};
const frows = [];
for (let y = 0; y < 40; y++) { let r = ''; for (let x = 0; x < 40; x++) r += x === 0 || y === 0 || x === 39 || y === 39 ? '#' : '.'; frows.push(r); }
data.zones.simfield = { id: 'simfield', name: 'Field', palette: 'default', seed: 5, tiles: { rows: frows, legend: { '#': 'hedge', '.': 'grass' } },
  markers: { start: [20, 20] }, exits: [], props: [], spawns: [], npcs: [], gates: [], chests: [], triggers: [] };

function mk(seed = 4, zone = 'simworld') {
  const game = createGame({ data, name: 'Tester', seed, zone, marker: 'start' });
  const input = scriptedInput();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  return { game, input, step, p: game.player };
}

test('gates: solid rune seal, requirement toast, gate.open frees tiles and sets the flag', () => {
  const { game, step, p } = mk();
  const seal = game.ents.all.find((e) => e.kind === 'rune_seal');
  assert.ok(seal && seal.data.gateId === 'g1');
  assert.equal(seal.look.model, 'rune_seal');
  for (const x of [9, 10, 11]) assert.ok(game.world.solidAt(x + 0.5, 6.5), 'seal tiles are solid');
  assert.deepEqual(seal.interact.do, [['gate', { context: 'gate', difficulty: 1 }, { pass: [['gate.open', 'g1']] }]]);
  assert.equal(seal.interact.prompt, 'Unseal');
  const toasts = [];
  game.bus.on('toast', (t) => toasts.push(t.text));
  game.physics.teleport(p, 10.5, 7.6);
  step(4);
  assert.equal(p.data.target, seal);
  assert.equal(game.hudState().prompt.text, 'Unseal');
  game.commands.interact();
  assert.equal(toasts.length, 1, 'requirement fails: toast instead of the question');
  game.ops.run([['gate.open', 'g1']]);
  step(1);
  assert.ok(seal.removed);
  assert.ok(!game.world.solidAt(10.5, 6.5));
  assert.equal(game.flags.gate_g1, true);
  game.world.loadZone('simworld', 'start');
  assert.ok(!game.ents.all.some((e) => e.kind === 'rune_seal'), 'stays open after reload');
});

test('chests: entities with the chest op; opened chests from flags', () => {
  const { game, step } = mk();
  const rune = game.ents.all.find((e) => e.data.chest === 'c1');
  const plain = game.ents.all.find((e) => e.data.chest === 'c2');
  assert.equal(rune.look.model, 'rune_chest');
  assert.equal(plain.look.model, 'chest');
  assert.deepEqual(rune.interact.do, [['chest', 'forest_small', { id: 'c1', rune: true }]]);
  assert.ok(game.world.solidAt(6.5, 4.5), 'chest blocks its tile');
  game.setFlag('chest_simworld_c2', true);
  assert.equal(plain.look.model, 'chest_open');
  assert.equal(plain.interact, null);
  const hud = game.hudState();
  const chestBlips = hud.minimap.blips.slice(0, hud.minimap.blipCount).filter((b) => b.type === 'chest');
  assert.equal(chestBlips.length, 1);
  game.world.loadZone('simworld', 'start');
  step(1);
  const again = game.ents.all.find((e) => e.data.chest === 'c2');
  assert.equal(again.look.model, 'chest_open');
  assert.equal(again.interact, null);
});

test('prop interact anchor on the door step of a building (World: x + def.door, y + h)', () => {
  const { game, input, step, p } = mk();
  const a = game.zone.anchors[0];
  const door = game.data.props.shop.door;
  assert.equal(a.x, 30 + door + 0.5); assert.equal(a.y, 20 + game.data.props.shop.footprint[1] + 0.5);
  assert.ok(a.asleep, 'anchors are invisible (never in FrameState)');
  game.physics.teleport(p, a.x, a.y + 0.3);
  step(4);
  assert.equal(game.hudState().prompt.text, 'Enter');
  input.set({ pressed: { interact: true } });
  step(1);
  assert.equal(game.flags.entered, true);
  game.setViewRect({ x0: 0, y0: 0, x1: 60, y1: 30 });
  const f = game.frame(1);
  for (let i = 0; i < f.entCount; i++) assert.notEqual(f.ents[i].id, a.id);
});

test('triggers run once; exits travel with a fade; locked exits toast', () => {
  const { game, step, p } = mk();
  let count = 0;
  game.ops.register('sim.count', () => { count++; });
  game.physics.teleport(p, 11, 21);
  step(2);
  assert.equal(game.flags.trig_ran, true);
  assert.equal(game.flags.trig_simworld_t1, true);
  game.physics.teleport(p, 5, 5); step(2);
  game.physics.teleport(p, 11, 21); step(2);
  assert.equal(count, 1, 'once');
  // locked exit
  const toasts = [];
  game.bus.on('toast', (t) => toasts.push(t.text));
  game.physics.teleport(p, 40.5, 1.5);
  step(2);
  assert.deepEqual(toasts, ['Sealed until next term']);
  step(60);
  assert.equal(toasts.length, 1, 'at most once per 3 s');
  // exit east with fade
  const phases = [];
  game.bus.on('zone:transition', (e) => phases.push(e.phase + ':' + e.to + ':' + game.freeze.has('transition')));
  game.physics.teleport(p, 58.4, 15.5);
  step(1);
  assert.ok(game.freeze.has('transition'));
  assert.equal(game.zone.id, 'simworld', 'still fading out');
  step(30);
  assert.equal(game.zone.id, 'simfield');
  assert.ok(!game.freeze.has('transition'));
  assert.deepEqual(phases, ['out:simfield:true', 'in:simfield:true']);
  assert.equal(p.x, 20.5);
});

test('spawner: populated with level, respawns after the timer but never within 10 tiles of the player', () => {
  const { game, step, p } = mk();
  const rats = () => game.ents.all.filter((e) => e.kind === 'rat' && !e.removed);
  assert.equal(rats().length, 2);
  assert.equal(rats()[0].level, 2);
  assert.ok(rats()[0].hpMax > 6, 'hp scaled to level 2');
  for (const r of rats()) game.combat.kill(r, p);
  step(1);
  assert.equal(rats().length, 0);
  step(4 * 60);
  assert.equal(rats().length, 0, 'not before the timer');
  step(70);
  assert.equal(rats().length, 2, 'respawned');
  // now stand in the area: no respawn
  game.physics.teleport(p, 47, 22);
  for (const r of rats()) game.combat.kill(r, p);
  step(7 * 60);
  assert.equal(rats().length, 0, 'not near the player');
  game.physics.teleport(p, 6.5, 12.5);
  step(3 * 60);
  assert.equal(rats().length, 2);
});

test('moveTo walks through the doorway and emits ent:arrived; findPath is bounded', async () => {
  const { game, step } = mk();
  const out = [];
  assert.equal(game.world.findPath(15.5, 5.5, 25.5, 5.5, out), true);
  const crosses = [];
  for (let i = 0; i < out.length; i += 2) if (Math.floor(out[i]) === 20) crosses.push(Math.floor(out[i + 1]));
  assert.ok(crosses.length && crosses.every((y) => y === 11 || y === 12), 'path uses the doorway');
  assert.equal(game.world.findPath(2, 2, 2.5, 2.5, out), true);
  // integration: with an octile heuristic the doorway route is found well within 400 nodes, so the bound is
  // checked with the doorway blocked (the search must give up and still return a partial path).
  game.world.block(20, 11, 1, 2, +1);
  assert.equal(game.world.findPath(5, 5, 55, 25, out), false, 'unreachable: gives up after 400 nodes');
  assert.ok(out.length > 0, 'partial path toward the goal');
  game.world.block(20, 11, 1, 2, -1);
  const npc = game.ents.spawn('rat', 15.5, 5.5, { noAi: true });
  let arrived = 0;
  game.bus.on('ent:arrived', (e) => { if (e.ent === npc) arrived++; });
  const done = game.physics.moveTo(npc, 25.5, 5.5, { speed: 3 });
  let anims = new Set();
  for (let i = 0; i < 15 * 60 && !arrived; i++) { step(); anims.add(npc.anim); }
  assert.equal(arrived, 1);
  assert.ok(Math.hypot(npc.x - 25.5, npc.y - 5.5) < 0.15);
  assert.ok(anims.has('walk'));
  assert.equal(npc.anim, 'idle');
  assert.equal(await done, true);
  // scripted flag: player control is skipped
  const p = game.player;
  p.data.scripted = true;
  const x = p.x;
  const inp = scriptedInput({ moveX: 1 });
  for (let i = 0; i < 30; i++) game.step(DT, inp.sample());
  assert.equal(p.x, x);
  p.data.scripted = false;
  // stop cancels
  const pr = game.physics.moveTo(npc, 10, 20);
  game.physics.stop(npc);
  assert.equal(await pr, false);
  assert.equal(npc.data.moveTo, null);
});

test('activation bubble and caps', () => {
  const { game, step, p } = mk();
  const far = game.ents.spawn('rat', 55.5, 25.5);
  step(1);
  assert.ok(far.asleep, 'asleep beyond 30 tiles');
  game.setViewRect({ x0: 0, y0: 0, x1: 60, y1: 30 });
  let f = game.frame(1);
  let seen = false;
  for (let i = 0; i < f.entCount; i++) if (f.ents[i].id === far.id) seen = true;
  assert.ok(!seen, 'asleep entities are not rendered');
  const x = far.x;
  step(60);
  assert.equal(far.x, x, 'not updated');
  game.physics.teleport(p, 40, 22);
  step(1);
  assert.ok(!far.asleep);
  for (let i = 0; i < 30; i++) game.ents.spawn('rat', 40 + (i % 6), 15 + Math.floor(i / 6), { noAi: true });
  step(1);
  assert.ok(game.ents.countAwake('enemy') <= 24, 'enemy cap');
});

function stateHash(game) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h = Math.imul(h ^ (Math.round(v * 1000) | 0), 16777619) >>> 0; };
  for (const e of game.ents.all) { mix(e.id); mix(e.x); mix(e.y); mix(e.hp); mix(e.vx); mix(e.vy); }
  mix(game.rng.getState());
  return h;
}
function runScripted(seed) {
  const { game, input, step, p } = mk(seed, 'simfield');
  game.setFlag('has_stick', true);
  p.data.minHp = 1;
  for (let i = 0; i < 8; i++) game.ents.spawn('rat', 14 + (i % 4) * 3, 14 + Math.floor(i / 4) * 10);
  game.companions.set(['warrior', 'mage']);
  for (let i = 0; i < 3000; i++) {
    const ph = Math.floor(i / 90) % 4;
    input.set({ moveX: [1, 0, -1, 0][ph], moveY: [0, 1, 0, -1][ph], attackDir: i % 40 < 25 ? (ph + 1) % 4 : -1 });
    if (i % 700 === 0) game.ents.spawn('rat', 20 + (i % 7), 10);
    step();
  }
  return stateHash(game);
}

test('determinism: same seed and inputs give the same state hash after 3000 steps', () => {
  const a = runScripted(77), b = runScripted(77), c = runScripted(78);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('performance: 60 awake entities fighting, average step under 2 ms', () => {
  const { game, step, p } = mk(9, 'simfield');
  p.data.minHp = 1;
  game.ents.caps.enemies = 100;
  for (let i = 0; i < 30; i++) game.ents.spawn('rat', 13 + (i % 6) * 1.2, 11 + Math.floor(i / 6) * 1.2, { hp: 400, hpMax: 400 });
  for (let i = 0; i < 30; i++) {
    game.combat.summon(p, { id: 'imp', name: 'Imp', look: { rig: 'blob', size: 0.5, colors: { body: '#ff8a5a' } }, stats: { speed: 3 } },
      { x: 13 + (i % 6) * 1.2, y: 19 + Math.floor(i / 6) * 1.2, hp: 400, fx: false, brain: i % 2 ? 'ally_ranged' : 'ally_melee',
        attacks: i % 2 ? [{ use: 'projectile', range: 6, dmg: 0.2, cd: 0.8, windup: 0.1, speed: 9 }] : [{ use: 'melee_arc', range: 0.9, dmg: 0.2, cd: 0.6, windup: 0.1 }] });
  }
  game.physics.teleport(p, 16, 16);
  let hits = 0;
  game.bus.on('hit', () => hits++);
  step(120);
  const awake = game.ents.all.filter((e) => !e.asleep && (e.type === 'enemy' || e.type === 'summon')).length;
  assert.ok(awake >= 60, 'awake fighters: ' + awake);
  const N = 600;
  const t0 = process.hrtime.bigint();
  step(N);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  console.log(`# sim perf: ${ms.toFixed(3)} ms/step, ${game.ents.all.length} ents, ${hits} hits`);
  assert.ok(hits > 300, 'they really fight');
  assert.ok(ms < 2, 'average step ' + ms.toFixed(3) + ' ms');
});
