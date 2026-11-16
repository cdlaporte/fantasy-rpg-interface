// Round 2 (package C): 8-way aim for every kit (InputState.attackAngle), the diagonal release grace for charge kits,
// light aim assist for ranged basics (not melee), and abilities.pickTarget (nearest / strongest / densest, cone, out).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, DT } from './r2c-sim.mjs';

const UP_RIGHT = -Math.PI / 4;
const KITS = [
  // [label, class, spec, level, ring radius]
  ['novice', null, null, 2, 1.0], ['warrior', 'warrior', null, 3, 1.3], ['mage', 'mage', null, 3, 4], ['rogue', 'rogue', null, 3, 1.1],
  ['knight', 'warrior', 'knight', 8, 1.4], ['berserker', 'warrior', 'berserker', 8, 1.2], ['battlemage', 'warrior', 'battlemage', 8, 1.3],
  ['conjurer', 'mage', 'conjurer', 8, 4], ['sorcerer', 'mage', 'sorcerer', 8, 4], ['monk', 'mage', 'monk', 8, 1.0],
  ['archer', 'rogue', 'archer', 8, 4.5], ['thief', 'rogue', 'thief', 8, 1.1], ['ninja', 'rogue', 'ninja', 8, 4],
];
const RAW = new Set(['sorcerer', 'archer']);

function inputState() {
  return { moveX: 0, moveY: 0, attackDir: -1, attackPressed: -1, attackReleased: -1, attackHeldT: 0, attackAngle: NaN,
    pressed: { space: false, q: false, f: false, shift: false }, held: { space: false, q: false, f: false, shift: false }, released: {} };
}
function rig(label, cls, spec, level, r) {
  let game;
  if (cls) game = setup({ cls, spec, level, zone: 'test', marker: 'start', companions: false, boons: false });
  else {
    game = setup({ cls: 'warrior', level, zone: 'test', marker: 'start', companions: false, boons: false });
    game.progression.reset(); game.setFlag('has_stick', true); game.setFlag('look_chosen', true);
  }
  const p = game.player;
  p.data.minHp = 1;
  p.status.invuln = 1e9;
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4;   // i = 0 up, 1 up-right, 2 right, ... 5 down-left
    const e = game.ents.spawn('rat', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, { noAi: true, hp: 1e6 });
    e.data.kbResist = 1; e.data.mass = 1e6;
    ring.push(e);
  }
  const hits = new Map(ring.map((e) => [e, 0]));
  game.bus.on('hit', (e) => { if (hits.has(e.target) && e.source === p) hits.set(e.target, hits.get(e.target) + 1); });
  return { game, p, ring, hits };
}
/** Hold the attack at `angle` (DIR `dir`) for `steps`, then release; `stagger` releases to `dir` alone for 2 steps first. */
function swing(game, angle, dir, steps, stagger = false) {
  const inp = inputState();
  for (let i = 0; i < steps; i++) {
    inp.attackDir = dir; inp.attackAngle = angle; inp.attackPressed = i === 0 ? dir : -1;
    game.step(DT, inp);
  }
  if (stagger) for (let i = 0; i < 2; i++) { inp.attackPressed = -1; inp.attackAngle = dir === 0 ? -Math.PI / 2 : 0; game.step(DT, inp); }
  inp.attackDir = -1; inp.attackAngle = NaN; inp.attackPressed = -1; inp.attackReleased = dir;
  game.step(DT, inp);
  inp.attackReleased = -1;
  for (let i = 0; i < 50; i++) game.step(DT, inp);
}

for (const [label, cls, spec, level, r] of KITS) {
  test(`8-way aim: ${label} attacks up-right (attackAngle -45 deg) hit the diagonal target, never the opposite one`, () => {
    const { game, p, ring, hits } = rig(label, cls, spec, level, r);
    assert.equal(game.kits.active(p).id, label);
    swing(game, UP_RIGHT, 0, RAW.has(label) ? 12 : 60);
    assert.ok(hits.get(ring[1]) > 0, `${label}: the up-right target is hit (${[...hits.values()]})`);
    assert.equal(hits.get(ring[5]), 0, `${label}: the down-left target is not`);
    assert.ok(Math.abs(p.angle - UP_RIGHT) < 0.01 || RAW.has(label), `${label} faces the aim (${p.angle.toFixed(2)})`);
    assert.equal(p.dir, 0, 'p.dir stays the nearest DIR (up)');
  });
}

test('without attackAngle (old input) a ranged basic still flies straight up: the diagonal comes only from attackAngle', () => {
  const { game, ring, hits } = rig('mage', 'mage', null, 3, 4);
  swing(game, NaN, 0, 60);
  assert.ok(hits.get(ring[0]) > 0);
  assert.equal(hits.get(ring[1]), 0);
});

for (const label of ['sorcerer', 'archer']) {
  test(`charge kit ${label}: a diagonal survives the staggered release of its two keys`, () => {
    const { game, ring, hits } = rig(label, 'mage', null, 8, 4.5);
    game.progression.setClass(label === 'sorcerer' ? 'mage' : 'rogue', { quiet: true });
    game.progression.setSpec(label, { quiet: true });
    game.step(DT, inputState());
    swing(game, UP_RIGHT, 1, 12, true);   // up-right held, then only "right" for 2 steps, then released
    assert.ok(hits.get(ring[1]) > 0, 'fired up-right: ' + [...hits.values()]);
    assert.equal(hits.get(ring[2]), 0, 'not right');
  });
}

test('aim assist: a ranged basic snaps onto an enemy within 18 degrees of the aim, not beyond; melee never snaps', () => {
  const at = (label, cls, offDeg, dist) => {
    const game = setup({ cls, level: 3, zone: 'test', marker: 'start', companions: false, boons: false });
    const p = game.player;
    p.data.minHp = 1;
    const a = (offDeg * Math.PI) / 180;
    const e = game.ents.spawn('rat', p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist, { noAi: true, hp: 1e6 });
    let hit = 0;
    game.bus.on('hit', (h) => { if (h.target === e && h.source === p) hit++; });
    swing(game, 0, 1, 40);
    return hit;
  };
  assert.ok(at('mage', 'mage', 14, 5) > 0, 'mage bolt at 14 degrees off: snapped and hit');
  assert.equal(at('mage', 'mage', 30, 5), 0, '30 degrees off: no snap');
  assert.equal(at('mage', 'mage', 14, 9), 0, 'out of range: no snap');
  // melee: a 100-degree arc reaches ~65 degrees off counting the target's radius; one at 80 degrees off stays unhit (no snapping)
  assert.equal(at('warrior', 'warrior', 80, 1.3), 0, 'warrior swing does not turn toward the target');
});

test('abilities.pickTarget: nearest / strongest (bosses, elites first) / densest (+centroid), cone, range, los; no allocation of results', () => {
  const game = setup({ cls: 'mage', level: 8, zone: 'test', marker: 'start', companions: false, boons: false });
  const p = game.player;
  const sp = (kind, dx, dy, o = {}) => game.ents.spawn(kind, p.x + dx, p.y + dy, Object.assign({ noAi: true }, o));
  const near = sp('rat', 2, 0);
  const big = sp('boar', -5, 0, { hp: 5000 });
  const elite = sp('giant_rat', 0, 6);
  const pack = [sp('rat', 5, 5), sp('rat', 5.6, 5.3), sp('rat', 5.2, 5.8)];
  const pt = game.abilities.pickTarget;
  assert.equal(pt(p, { range: 9, mode: 'nearest' }), near);
  assert.equal(pt(p, { range: 9, mode: 'strongest' }), elite, 'an elite beats a tougher normal enemy');
  big.tags.push('boss');
  assert.equal(pt(p, { range: 9, mode: 'strongest' }), big, 'a boss beats everything');
  const out = { x: 0, y: 0 };
  const o = { range: 9, mode: 'densest', r: 1.5, out };
  const d = pt(p, o);
  assert.ok(pack.includes(d), 'densest picks a pack member');
  assert.ok(Math.abs(out.x - (p.x + 5.27)) < 0.3 && Math.abs(out.y - (p.y + 5.37)) < 0.3, 'out = the cluster centroid');
  assert.equal(o.out, out, 'the out object is reused');
  assert.equal(pt(p, { range: 9, mode: 'nearest', cone: 60, angle: Math.PI }), big, 'cone: only what is behind');
  assert.equal(pt(p, { range: 9, mode: 'nearest', cone: 30, angle: Math.PI / 2 + 0.6 }), null, 'empty cone');
  assert.equal(pt(p, { range: 1.5, mode: 'strongest' }), null, 'range');
  for (const e of [near, big, elite, ...pack]) game.ents.remove(e);
  game.ents.flush();
  assert.equal(pt(p, { range: 9 }), null, 'nothing left');
});

test('Meteor lands on the strongest enemy in range (not ahead); Meteor Echo continues along that line', () => {
  const game = setup({ cls: 'mage', spec: 'sorcerer', level: 8, zone: 'test', marker: 'start', companions: false, boons: false });
  const p = game.player;
  p.angle = 0;
  game.ents.spawn('rat', p.x + 4, p.y, { noAi: true, hp: 1e5 });
  const elite = game.ents.spawn('giant_rat', p.x - 1, p.y - 5, { noAi: true, hp: 1e5 });
  game.progression.boons.push('meteor_echo');
  game.kits.setResource(p, 100);
  const inp = inputState(); inp.pressed.f = true; inp.held.f = true;
  game.step(DT, inp);
  const teles = game.ents.all.filter((e) => e.look && e.look.model === 'telegraph_circle');
  assert.ok(teles.length >= 1);
  const t0 = teles.reduce((a, b) => (Math.hypot(a.x - elite.x, a.y - elite.y) < Math.hypot(b.x - elite.x, b.y - elite.y) ? a : b));
  assert.ok(Math.hypot(t0.x - elite.x, t0.y - elite.y) < 0.3, 'telegraph on the elite');
  const a = Math.atan2(elite.y - p.y, elite.x - p.x);
  for (const t of teles) {
    if (t === t0) continue;
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    assert.ok(Math.abs(ang - a) < 0.05 || Math.hypot(t.x - p.x, t.y - p.y) < 1, 'echoes on the same line');
  }
});
