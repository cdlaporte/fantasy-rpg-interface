import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatZone, LOOK, seconds, steps, collect } from './story_fixtures.test.mjs';
import { DIR } from '../../src/contracts.js';

const fx = {
  zones: {
    nz: flatZone('nz', { start: [5, 5], home_1: [4, 20], bakery: [10, 5], square: [20, 15], park: [30, 20], gate_e: [38, 15],
      guard_post: [20, 25], p1: [15, 25], p2: [25, 25] }, { exits: [{ at: 'gate_e', to: 'nz2', marker: 'west' }] }),
    nz2: flatZone('nz2', { west: [1, 15], spot: [10, 10] }),
  },
  npcs: {
    baker: { id: 'baker', name: 'Bun', look: LOOK, zone: 'nz', dialogue: 'x', onAttacked: 'flee', barks: ['Fresh rolls!'],
      stats: { speed: 3 },
      routine: [{ from: 6, to: 12, at: 'bakery', do: 'shopkeep' }, { from: 12, to: 18, at: 'square', do: 'wander', r: 2 },
        { from: 18, to: 22, zone: 'nz2', at: 'spot', do: 'idle' }, { from: 22, to: 6, at: 'home_1', do: 'sleep' }] },
    visitor: { id: 'visitor', name: 'Vi', look: LOOK, zone: 'nz', stats: { speed: 3 },
      routine: [{ from: 0, to: 10, zone: 'nz2', at: 'spot' }, { from: 10, to: 24, at: 'square', do: 'idle' }] },
    guard: { id: 'guard', name: 'Guard Gus', look: LOOK, zone: 'nz', onAttacked: 'guard', stats: { power: 2, speed: 3 },
      routine: [{ from: 0, to: 24, at: 'guard_post', do: 'patrol', markers: ['p1', 'p2'] }] },
    sitter: { id: 'sitter', name: 'Sid', look: LOOK, zone: 'nz', onAttacked: 'retaliate', shop: 'general',
      routine: [{ from: 0, to: 24, at: 'park', do: 'sit' }] },
    dozer: { id: 'dozer', name: 'Doz', look: LOOK, zone: 'nz', routine: [{ from: 0, to: 24, at: 'park', do: 'sleep' }] },
  },
};

const at = (g, id) => g.ops.resolveWho(id);
const near = (e, m, r = 0.6) => Math.hypot(e.x - m.x, e.y - m.y) <= r;

test('npc: placement by hour (shop, wander, other zone, asleep at home, outdoor sleep, sit)', () => {
  const g = makeGame(fx, { zone: 'nz' });
  const M = (n) => g.world.marker(n);
  for (const [h, expect] of [[8, 'bakery'], [13, 'square'], [19, null], [23, null], [3, null]]) {
    g.clock.set(h);
    g.world.loadZone('nz', 'start');
    const b = at(g, 'baker');
    if (expect) assert.ok(b && near(b, M(expect)), 'baker at ' + expect + ' at ' + h);
    else assert.equal(b, null, 'baker absent at ' + h);
  }
  g.clock.set(19);
  g.world.loadZone('nz2', 'west');
  assert.ok(near(at(g, 'baker'), g.world.marker('spot')), 'baker in nz2 in the evening');
  g.clock.set(9);
  g.world.loadZone('nz', 'start');
  assert.ok(at(g, 'guard') && at(g, 'sitter'));
  steps(g, 2);
  assert.equal(at(g, 'sitter').anim, 'sit');
  assert.equal(at(g, 'dozer').anim, 'sleep', 'outdoor sleeper is present');
  assert.ok(at(g, 'dozer').fxTags.includes('sleep'));
  assert.deepEqual(at(g, 'sitter').interact.do, [['shop', 'general']]);
  assert.equal(at(g, 'baker').interact.prompt, 'Talk');
  assert.equal(g.npc.populate(g.zone).length, 0, 'populate is idempotent');
  assert.equal(g.ents.all.filter((e) => e.kind === 'baker').length, 1);
});

test('npc: schedule changes walk to markers, leave via exits, appear at exits / from home', () => {
  const g = makeGame(fx, { zone: 'nz' });
  const M = (n) => g.world.marker(n);
  g.clock.set(9.5);
  g.world.loadZone('nz', 'start');
  assert.equal(at(g, 'visitor'), null);
  g.clock.set(10);
  steps(g, 1);
  const v = at(g, 'visitor');
  assert.ok(v && near(v, M('gate_e')), 'visitor appears at the exit toward its previous zone');
  assert.ok(v.data.moveTo, 'and walks');
  seconds(g, 10);
  assert.ok(near(v, M('square')), 'visitor reached the square');
  const b = at(g, 'baker');
  // idle/shopkeep faces south, looks around now and then
  const dirs = new Set();
  for (let i = 0; i < 60 * 12; i++) { g.step(); dirs.add(b.dir); }
  assert.ok(dirs.has(DIR.DOWN) && dirs.size > 1, 'looks around');
  g.clock.set(12);
  steps(g, 1);
  assert.ok(b.data.moveTo, 'baker walks to the square at noon');
  seconds(g, 10);
  assert.ok(Math.hypot(b.x - M('square').x, b.y - M('square').y) < 2.6, 'arrived (wandering nearby)');
  // wander moves within its radius; talking freezes the routine
  const wx = b.x, wy = b.y;
  seconds(g, 8);
  assert.ok(Math.hypot(b.x - wx, b.y - wy) > 0.05, 'wanders');
  assert.ok(Math.hypot(b.x - M('square').x, b.y - M('square').y) <= 2.6);
  b.data.talking = 1; g.npc.stop(b);
  const tx = b.x, ty = b.y;
  seconds(g, 8);
  assert.deepEqual([b.x, b.y], [tx, ty], 'routine paused while talking');
  delete b.data.talking;
  // guard patrols between its markers
  const gd = at(g, 'guard');
  const seen = new Set();
  for (let i = 0; i < 60 * 20; i++) { g.step(); if (near(gd, M('p1'), 0.3)) seen.add('p1'); if (near(gd, M('p2'), 0.3)) seen.add('p2'); }
  assert.deepEqual([...seen].sort(), ['p1', 'p2']);
  // evening: baker leaves through the exit toward nz2
  g.clock.set(18);
  steps(g, 1);
  seconds(g, 15);
  assert.equal(at(g, 'baker'), null, 'left the zone');
  // morning after sleeping at home: appears at home_1 and walks to the bakery
  g.clock.set(23);
  steps(g, 2);
  g.clock.set(6);
  steps(g, 1);
  const b2 = at(g, 'baker');
  assert.ok(b2 && near(b2, M('home_1'), 0.3), 'wakes up at home');
  seconds(g, 10);
  assert.ok(near(b2, M('bakery')));
});

test('npc: crime -> wanted -> guards chase -> clears after 45 s unseen and on revive; KO and recover', () => {
  const g = makeGame(fx, { zone: 'nz' });
  const crimes = collect(g, 'crime');
  const wanted = collect(g, 'wanted');
  const dmg = [];
  g.combat.damage = (t, n, o) => { dmg.push([t, n, o.source]); return n; };
  const b = at(g, 'baker'), gd = at(g, 'guard'), sid = at(g, 'sitter');
  // hits by someone else do not count
  g.bus.emit('hit', { target: b, source: gd, amount: 1 });
  assert.equal(crimes.length, 0);
  // a projectile owned by the player counts
  const arrow = g.ents.create({ type: 'projectile', owner: g.player.id });
  g.bus.emit('hit', { target: b, source: arrow, amount: 1 });
  assert.equal(crimes.length, 1);
  assert.equal(crimes[0].victim, b);
  assert.equal(g.flags.wanted, true);
  assert.deepEqual(wanted, [{ on: true }]);
  assert.equal(g.hudState().player.wanted, true);
  assert.ok(g.player.fxTags.includes('wanted'));
  assert.ok(b.data.moveTo, 'victim flees');
  const p = g.player;
  const d0 = Math.hypot(b.x - p.x, b.y - p.y);
  seconds(g, 1);
  assert.ok(Math.hypot(b.x - p.x, b.y - p.y) > d0, 'flees away from the player');
  // guard chases and hits
  p.x = gd.x + 4; p.y = gd.y;
  seconds(g, 3);
  assert.ok(dmg.some((d) => d[0] === p && d[2] === gd), 'guard attacks the wanted player');
  // retaliate
  g.bus.emit('hit', { target: sid, source: p, amount: 1 });
  p.x = sid.x + 3; p.y = sid.y;
  seconds(g, 2);
  assert.ok(dmg.some((d) => d[2] === sid), 'retaliating NPC hits back');
  // guard out of the picture => 45 s unseen clears wanted
  g.ents.remove(gd);
  seconds(g, 44);
  assert.equal(g.flags.wanted, true);
  seconds(g, 1.5);
  assert.equal(g.flags.wanted, false);
  assert.deepEqual(wanted.at(-1), { on: false });
  assert.equal(g.player.fxTags.includes('wanted'), false);
  // revive clears
  g.npc.setWanted(true);
  g.bus.emit('player:revived', { where: 'infirmary' });
  assert.equal(g.flags.wanted, false);
  // KO: town NPCs never die
  assert.equal(sid.data.minHp, 1, 'HP floor for combat');
  sid.hp = 1;
  g.bus.emit('hit', { target: sid, source: p, amount: 5 });
  assert.equal(sid.anim, 'ko');
  assert.equal(sid.interact, null);
  g.bus.emit('death', { ent: sid, killer: p });
  assert.equal(sid.alive, true);
  seconds(g, 10.1);
  assert.equal(sid.anim === 'ko', false);
  assert.equal(sid.hp, sid.hpMax);
  assert.deepEqual(sid.interact.do, [['shop', 'general']]);
});

test('npc: a guard downing a wanted player fines 10% gold; barks; rel save/load', () => {
  const g = makeGame(fx, { zone: 'nz' });
  const gd = at(g, 'guard');
  g.inventory.gold = 100;
  g.npc.setWanted(true);
  g.bus.emit('hit', { target: g.player, source: gd, amount: 3 });
  g.bus.emit('player:down', {});
  assert.equal(g.inventory.gold, 90);
  assert.equal(g.flags.wanted, false);
  // barks
  const bubbles = collect(g, 'bubble');
  const b = at(g, 'baker');
  g.player.x = b.x + 1; g.player.y = b.y;
  seconds(g, 20);
  assert.ok(bubbles.some((x) => x.ent === b && x.text === 'Fresh rolls!'));
  // friendship
  g.ops.run([['rel', 'baker', 2], ['rel', 'baker', 1]]);
  assert.equal(g.npc.rel('baker'), 3);
  const json = g.saveSystems();
  const g2 = makeGame(fx);
  g2.loadSystems(json);
  assert.equal(g2.npc.rel('baker'), 3);
  assert.equal(g2.ops.test([['rel', 'baker', '>=', 3]]), true);
});
