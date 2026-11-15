// Sim: combat core, projectiles, physics, statuses, drops. Run: node --test tests/node
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

// A walled arena: border hedges, a vertical wall at x=20 with a 2-tile doorway at y=11..12, a pond on the right.
const rows = [];
for (let y = 0; y < 24; y++) {
  let r = '';
  for (let x = 0; x < 40; x++) {
    if (x === 0 || y === 0 || x === 39 || y === 23) r += '#';
    else if (x === 20 && y !== 11 && y !== 12) r += '#';
    else if (x >= 30 && x <= 33 && y >= 3 && y <= 6) r += '~';
    else r += '.';
  }
  rows.push(r);
}
data.zones.simarena = data.zones.simarena || {
  id: 'simarena', name: 'Sim Arena', palette: 'default', seed: 9, tiles: { rows, legend: { '#': 'hedge', '.': 'grass', '~': 'water' } },
  markers: { start: [6, 12], east: [30, 12] }, exits: [], props: [], spawns: [], npcs: [], gates: [], chests: [], triggers: [],
};

function mk(seed = 1) {
  const game = createGame({ data, name: 'Tester', seed, zone: 'simarena', marker: 'start' });
  const input = scriptedInput();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  return { game, input, step, p: game.player };
}
const dummy = (game, x, y, hp = 200, extra = {}) => game.ents.spawn('rat', x, y, Object.assign({ noAi: true, hp, hpMax: hp }, extra));

test('stick kills three rats and XP is requested; no attacks before the stick', () => {
  const { game, input, step, p } = mk(3);
  let xp = 0;
  game.progression.addXp = (n) => { xp += n; };
  const rats = [0, 1, 2].map((i) => game.ents.spawn('rat', p.x + 2 + i * 0.5, p.y + (i - 1) * 0.6));
  let playerHits = 0;
  game.bus.on('hit', (e) => { if (e.source === p) playerHits++; });
  input.set({ attackDir: 1 });
  step(60);
  assert.equal(playerHits, 0, 'cannot attack before flags.has_stick');
  input.set({ attackDir: -1 });
  game.setFlag('has_stick', true);
  assert.equal(p.look.held.style, 'stick', 'stick is held once picked up');
  for (let i = 0; i < 1500 && rats.some((r) => !r.removed); i++) {
    const r = rats.find((q) => !q.removed);
    const dx = r.x - p.x, dy = r.y - p.y, d = Math.hypot(dx, dy);
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    input.set({ moveX: d > 0.8 ? dx / d : 0, moveY: d > 0.8 ? dy / d : 0, attackDir: d < 1.3 ? dir : -1 });
    step();
  }
  assert.ok(rats.every((r) => r.removed), 'all three rats poofed');
  assert.equal(xp, 3 * game.data.enemies.rat.stats.xp, 'xp from def.stats.xp requested through progression.addXp');
  assert.ok(playerHits >= 9, 'about three stick hits per rat (2 dmg vs 6 hp)');
});

test('projectiles: pierce, bounce, return, split, homing, reflect', () => {
  const { game, step, p } = mk();
  const hitsOn = new Map();
  game.bus.on('hit', (e) => { hitsOn.set(e.target.id, (hitsOn.get(e.target.id) || 0) + 1); });
  const clear = () => { hitsOn.clear(); for (const e of game.ents.all) if (e.type === 'enemy' || e.type === 'projectile') game.ents.remove(e); game.ents.flush(); };

  // pierce
  let row = [0, 1, 2].map((i) => dummy(game, p.x + 2 + i * 1.2, p.y));
  game.combat.projectile(p, { angle: 0, speed: 12, range: 8, dmg: 1, pierce: 2 });
  step(60);
  assert.deepEqual(row.map((e) => hitsOn.get(e.id) || 0), [1, 1, 1], 'pierce 2 hits three in a row');
  clear();
  // no pierce: only the first
  row = [0, 1].map((i) => dummy(game, p.x + 2 + i * 1.2, p.y));
  game.combat.projectile(p, { angle: 0, speed: 12, range: 8, dmg: 1 });
  step(60);
  assert.deepEqual(row.map((e) => hitsOn.get(e.id) || 0), [1, 0]);
  clear();
  // bounce
  const b = [dummy(game, p.x + 2, p.y), dummy(game, p.x + 3, p.y + 2.5), dummy(game, p.x + 5, p.y + 3.5)];
  game.combat.projectile(p, { angle: 0, speed: 12, range: 8, dmg: 1, bounce: 2, bounceRange: 4 });
  step(90);
  assert.deepEqual(b.map((e) => hitsOn.get(e.id) || 0), [1, 1, 1], 'bounce 2 chains to the next targets');
  clear();
  // return
  const r = dummy(game, p.x + 2, p.y);
  let caught = 0;
  game.bus.on('proj:caught', (e) => { if (e.owner === p) caught++; });
  game.combat.projectile(p, { angle: 0, speed: 10, range: 4, dmg: 1, pierce: true, returns: true });
  step(120);
  assert.equal(hitsOn.get(r.id), 2, 'returning projectile hits on the way out and back');
  assert.equal(caught, 1, 'caught by its owner');
  clear();
  // split
  const s1 = dummy(game, p.x + 2, p.y), s2 = dummy(game, p.x + 3.5, p.y - 0.5), s3 = dummy(game, p.x + 3.5, p.y + 0.5);
  game.combat.projectile(p, { angle: 0, speed: 12, range: 8, dmg: 1, split: { n: 2, arc: 40, range: 3 } });
  step(60);
  assert.equal(hitsOn.get(s1.id), 1);
  assert.equal((hitsOn.get(s2.id) || 0) + (hitsOn.get(s3.id) || 0), 2, 'split children hit the two behind');
  clear();
  // homing: fired straight up, target to the right
  const h = dummy(game, p.x + 3, p.y);
  game.combat.projectile(p, { angle: -Math.PI / 2, speed: 8, range: 10, dmg: 1, homing: 8, homingRange: 6 });
  step(120);
  assert.equal(hitsOn.get(h.id), 1, 'homing projectile curves into the target');
  clear();
  // reflect: an enemy bolt reflected by the player hits the enemy
  const shooter = dummy(game, p.x + 4, p.y);
  const bolt = game.combat.projectile(shooter, { angle: Math.PI, speed: 8, range: 8, dmg: 1 });
  step(10);
  assert.equal(bolt.team, 'enemy');
  game.combat.reflect(bolt, p);
  assert.equal(bolt.team, 'player');
  step(90);
  assert.equal(hitsOn.get(shooter.id), 1, 'reflected bolt hits its old owner');
  assert.equal(hitsOn.get(p.id) || 0, 0);
  // gravity lob lands at its target and explodes
  clear();
  const lobT = dummy(game, p.x + 4, p.y);
  game.combat.projectile(p, { angle: 0, speed: 6, range: 8, dmg: 1, gravityZ: 12, target: { x: lobT.x, y: lobT.y }, explode: { r: 1.2 } });
  let maxZ = 0;
  for (let i = 0; i < 80; i++) { step(); for (const e of game.ents.all) if (e.type === 'projectile') maxZ = Math.max(maxZ, e.z); }
  assert.ok(maxZ > 0.8, 'lob arcs through z');
  assert.ok((hitsOn.get(lobT.id) || 0) >= 1, 'lob explodes on landing');
});

test('knockback decays; walls slide; leash circle', () => {
  const { game, input, step, p } = mk();
  // wall sliding: push diagonally into the x=20 wall, away from the doorway
  game.physics.teleport(p, 18.5, 5.5);
  input.set({ moveX: 1, moveY: 1 });
  step(60);
  assert.ok(p.x <= 20 - p.radius + 1e-3, 'stopped by the wall');
  assert.ok(p.y > 7, 'slid along it: ' + p.y);
  input.set({ moveX: 0, moveY: 0 });
  // knockback
  game.physics.teleport(p, 8, 12);
  const e = dummy(game, 9, 12);
  game.combat.damage(e, 1, { source: p, knockback: 10 });
  step(5);
  assert.ok(e.x > 9.3, 'knocked back');
  step(120);
  assert.equal(e.kx, 0, 'knockback decayed');
  const xRest = e.x;
  step(30);
  assert.equal(e.x, xRest, 'and stays put');
  // leash
  game.physics.teleport(p, 10, 12);
  p.data.leash = { x: 10, y: 12, r: 3 };
  input.set({ moveX: 1 });
  step(120);
  assert.ok(Math.hypot(p.x - 10, p.y - 12) <= 3 + 1e-6, 'held inside the barrier');
  p.data.leash = null;
  input.set({ moveX: 0 });
});

test('flyers cross water, walkers do not', () => {
  const { game, step } = mk();
  const w = dummy(game, 28.5, 4.5, 50);
  const f = dummy(game, 28.5, 5.5, 50, { data: { flying: true } });
  w.vx = 3; f.vx = 3;
  for (let i = 0; i < 60; i++) { w.vx = 3; f.vx = 3; step(); }
  assert.ok(w.x < 30, 'walker stopped at the water');
  assert.ok(f.x > 31, 'flyer passed over it');
});

test('statuses, stacking, fxTags, shields, marks, stealth', () => {
  const { game, step, p } = mk();
  const e = dummy(game, p.x + 3, p.y, 500);
  const C = game.combat;
  C.status(e, 'stun', 1);
  assert.ok(e.fxTags.includes('stun'));
  assert.equal(C.speedMul(e), 0);
  step(70);
  assert.ok(!e.fxTags.includes('stun'), 'fxTag removed when the status ends');
  // burn ticks
  const hp0 = e.hp;
  C.status(e, 'burn', 2, 4, p);
  assert.ok(e.fxTags.includes('burn'));
  step(130);
  assert.ok(e.hp < hp0 - 4, 'burn dealt damage over time');
  // venom stacks
  for (let i = 0; i < 4; i++) C.status(e, 'venom', 3, 1, p);
  assert.equal(C.stacks(e, 'venom'), 4);
  assert.ok(e.fxTags.includes('venom'));
  // frost: third stack freezes
  C.status(e, 'frost', 2, 0.4); C.status(e, 'frost', 2, 0.4);
  assert.ok(C.speedMul(e) < 1 && C.speedMul(e) > 0);
  C.status(e, 'frost', 2, 0.4);
  assert.ok(e.status.stun > 0, 'frozen at three frost stacks');
  // mark amplifies damage
  const plain = dummy(game, p.x + 3, p.y + 2, 500);
  const d0 = C.damage(plain, 10, { source: p });
  C.status(plain, 'mark', 3, 0.5);
  assert.ok(plain.fxTags.includes('mark'));
  const d1 = C.damage(plain, 10, { source: p });
  assert.ok(d1 > d0, 'marked targets take more');
  // shield absorbs
  C.status(p, 'shield', 5, 6);
  const hpP = p.hp;
  C.damage(p, 4, { source: plain });
  assert.equal(p.hp, hpP, 'absorbed by shield');
  assert.ok(p.fxTags.includes('shield'));
  C.damage(p, 4, { source: plain });
  assert.equal(p.hp, hpP - 2, 'remaining 2 got through');
  assert.ok(!p.fxTags.includes('shield'));
  // invuln
  C.status(p, 'invuln', 1);
  assert.equal(C.damage(p, 5, { source: plain }), 0);
  // power mod
  C.addMod(p, 'test', { power: 1 }, 1);
  assert.equal(C.damage(plain, 10, { source: p, type: 'true' }), 20, '+100% power; true damage ignores the mark');
  assert.equal(C.damage(plain, 10, { source: p }), 30, '+100% power and +50% from the mark');
  // stealth: an aggroed chaser drops a stealthed target
  const chaser = game.ents.spawn('rat', p.x + 2, p.y);
  step(30);
  assert.equal(chaser.ai.target, p.id);
  game.abilities.use('stealth', p, { dur: 2 });
  assert.ok(p.fxTags.includes('stealth'));
  assert.ok(p.alpha < 1);
  step(6);
  assert.equal(chaser.ai.target, null, 'enemies ignore stealthed targets');
  step(130);
  assert.ok(!p.fxTags.includes('stealth') && p.alpha === 1, 'stealth wears off');
  // manual fxTags
  game.ents.setFxTag(p, 'charge', true);
  assert.ok(p.fxTags.includes('charge'));
  game.abilities.tagFor(p, 'haste', 0.5);
  step(40);
  assert.ok(!p.fxTags.includes('haste') && p.fxTags.includes('charge'));
});

test('minHp floor, player:down, revive, guard arc', () => {
  const { game, step, p } = mk();
  const foe = dummy(game, p.x + 1, p.y);
  let downs = 0;
  game.bus.on('player:down', () => downs++);
  p.data.minHp = 1;
  game.combat.damage(p, 999, { source: foe, type: 'true' });
  assert.equal(p.hp, 1);
  assert.equal(downs, 0, 'no player:down while minHp is set');
  p.data.minHp = 0;
  game.combat.damage(p, 999, { source: foe, type: 'true' });
  assert.equal(p.hp, 0);
  assert.equal(downs, 1);
  assert.ok(p.alive && p.data.down, 'the player never dies');
  game.combat.damage(p, 5, { source: foe });
  assert.equal(downs, 1, 'once');
  game.combat.heal(p, p.hpMax);
  step();
  assert.ok(!p.data.down);
  // guard: frontal hits reduced, from behind not
  p.angle = 0; p.dir = 1;
  game.abilities.use('guard', p, { arc: 120, reduce: 0.8, perfect: 0 });
  const hp1 = p.hp;
  game.combat.damage(p, 10, { source: foe, type: 'melee' });
  assert.equal(hp1 - p.hp, 2, '80% blocked from the front');
  const back = dummy(game, p.x - 1, p.y);
  const hp2 = p.hp;
  game.combat.damage(p, 10, { source: back, type: 'melee' });
  assert.equal(hp2 - p.hp, 10, 'not from behind');
  const g = game.abilities.unguard(p);
  assert.equal(g.blocks, 1);
});

test('drops spawn pickups that fly to the player and are collected', () => {
  const { game, step, p } = mk(5);
  let gold = 0, items = 0;
  game.inventory.addGold = (n) => { gold += n; };
  game.inventory.give = () => { items++; };
  data.enemies.sim_piggy = data.enemies.sim_piggy || { id: 'sim_piggy', name: 'Piggy Bank', level: 1, tags: [],
    stats: { hp: 3, power: 1, defense: 0, speed: 0, radius: 0.3, xp: 2 }, ai: { brain: 'idle' }, attacks: [],
    look: { rig: 'blob', size: 0.5, colors: { body: '#ffb0c0' } }, drops: { gold: [5, 5], goldChance: 1, items: [{ id: 'potion_small', p: 1 }], heart: 0 } };
  const pig = game.ents.spawn('sim_piggy', p.x + 1.5, p.y);
  game.combat.damage(pig, 99, { source: p });
  step();
  const pickups = game.ents.all.filter((e) => e.type === 'pickup');
  assert.ok(pickups.some((e) => e.kind === 'gold') && pickups.some((e) => e.kind === 'item'));
  step(120);
  assert.equal(gold, 5, 'gold collected through inventory.addGold');
  assert.equal(items, 1, 'item collected through inventory.give');
  assert.equal(game.ents.all.filter((e) => e.type === 'pickup').length, 0);
});

test('melee arc respects arc, range, maxTargets; aoe delay telegraphs; zones tick', () => {
  const { game, step, p } = mk();
  p.angle = 0;
  const front = dummy(game, p.x + 0.9, p.y), behind = dummy(game, p.x - 0.9, p.y), far = dummy(game, p.x + 3, p.y);
  const hits = game.combat.meleeArc(p, { angle: 0, arc: 90, range: 1, dmg: 1 }).slice();
  assert.deepEqual(hits.map((e) => e.id), [front.id]);
  void behind; void far;
  // delayed telegraphed aoe
  const t = dummy(game, 10, 18);
  const tele = game.combat.aoe(p, { x: 10, y: 18, r: 1.5, dmg: 3, delay: 0.5, telegraph: 'circle' });
  assert.equal(tele.look.model, 'telegraph_circle');
  const hp0 = t.hp;
  step(20);
  assert.equal(t.hp, hp0, 'not yet');
  step(20);
  assert.ok(t.hp < hp0, 'resolved after the delay');
  assert.ok(tele.removed);
  // delayed without a telegraph: no entity, still resolves
  const t2 = dummy(game, 14, 18);
  const h2 = t2.hp;
  const n0 = game.ents.all.length;
  game.combat.aoe(p, { x: 14, y: 18, r: 1, dmg: 2, delay: 0.3, telegraph: false });
  assert.equal(game.ents.all.length, n0);
  step(25);
  assert.ok(t2.hp < h2);
  // lingering zone
  const z = dummy(game, 12, 18);
  const hz = z.hp;
  game.combat.zone(p, { x: 12, y: 18, r: 1.5, dur: 2, tick: 0.5, dmg: 1, element: 'fire' });
  step(130);
  assert.ok(hz - z.hp >= 6, 'ticked about four times');
});

test('all 16 building blocks run for players and deal their effects', () => {
  const { game, step, p } = mk();
  const A = game.abilities;
  p.angle = 0;
  const foes = [0, 1, 2, 3].map((i) => dummy(game, p.x + 1.5 + i * 1.1, p.y + (i % 2) * 0.4, 300));
  const hp = () => foes.reduce((s, e) => s + e.hp, 0);
  let before = hp();
  const fxTypes = new Set();
  const origFx = game.fx;
  game.fx = (e) => { fxTypes.add(e.type); origFx(e); };
  const check = (name, fn) => { before = hp(); fn(); assert.ok(hp() < before, name + ' dealt damage'); };
  check('melee_arc', () => A.use('melee_arc', p, { angle: 0, range: 2, dmg: 1, repeat: 2 }));
  check('projectile', () => { A.use('projectile', p, { angle: 0, dmg: 1 }); step(30); });
  check('multishot', () => { A.use('multishot', p, { angle: 0, n: 3, spread: 20, dmg: 1 }); step(30); });
  check('beam', () => A.use('beam', p, { angle: 0, range: 7, dmg: 1 }));
  check('aoe_ring', () => A.use('aoe_ring', p, { r: 3, dmg: 1 }));
  check('ground_target', () => { A.use('ground_target', p, { angle: 0, dist: 3, r: 2, dmg: 1, meteor: true }); step(60); });
  check('chain', () => { const h = A.use('chain', p, { range: 4, jumps: 3, dmg: 1 }); assert.equal(h.length, 3); });
  check('zone', () => { A.use('zone', p, { dist: 3, r: 2, dmg: 1, dur: 1 }); step(40); });
  const x0 = p.x;
  game.physics.teleport(foes[0], p.x + 1.5, p.y);
  check('dash', () => { A.use('dash', p, { angle: 0, dist: 3, dmg: 1, through: true }); step(30); });
  assert.ok(p.x > x0 + 2, 'dashed forward');
  game.physics.teleport(p, 6.5, 12.5);
  const sx = p.x;
  A.use('leap', p, { angle: 0, dist: 4, land: { r: 2, dmg: 1 } });
  let maxZ = 0;
  for (let i = 0; i < 40; i++) { step(); maxZ = Math.max(maxZ, p.z); }
  assert.ok(maxZ > 1 && p.z === 0 && p.x > sx + 3, 'leapt with a z arc');
  const r = A.use('blink', p, { angle: Math.PI, dist: 3 });
  assert.ok(r && p.x < r.x0 - 2.5, 'blinked');
  assert.equal(A.use('blink', p, { angle: Math.PI, dist: 3, x: 0 }) && p.x >= 1, true, 'never into walls');
  p.hp = 5;
  assert.ok(A.use('heal', p, { pct: 0.5 }) > 0);
  A.use('buff_self', p, { id: 'cry', dur: 2, power: 0.3, fxTag: 'haste' });
  assert.ok(game.combat.mod(p, 'power') === 0.3 && p.fxTags.includes('haste'));
  A.use('guard', p, {}); assert.ok(p.data.guard); A.unguard(p);
  A.use('stealth', p, { dur: 1, smoke: true }); assert.ok(p.status.stealth > 0);
  const pets = A.use('summon', p, { def: { id: 'imp', look: { rig: 'blob' } }, n: 2 });
  assert.equal(pets.length, 2);
  for (const t of ['slash', 'beam', 'shockwave', 'meteor', 'bolt', 'trail', 'afterimage', 'heal', 'sparkle', 'smoke', 'pillar']) assert.ok(fxTypes.has(t), 'fx ' + t);
  assert.equal(A.use('nope', p, {}), false);
});
