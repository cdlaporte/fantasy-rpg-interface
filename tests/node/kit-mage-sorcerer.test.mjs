// Sorcerer: Overcharge tiers by hold time (Ember / Fireball / Arc Lance), rank IV fork + bigger fire, Meteor (telegraph +
// falling z), Cataclysm (five meteors, screenFlash per impact), and the 4 Sorcerer boons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mk, ring, press, attack, refill, sweep, FX_TYPES } from './kit-mage-lib.test.mjs';
import data from '../../src/data/index.js';

const projs = (c) => c.game.ents.all.filter((e) => e.type === 'projectile' && e.owner === c.p.id && !e.removed);
/** Hold the attack key `steps` steps (east) and release; returns what fired. */
function charge(c, steps) {
  c.input.set({ attackDir: 1 });
  c.step(steps);
  const charging = c.p.fxTags.includes('charge');
  const glow = c.p.glow;
  c.input.set({ attackDir: -1 });
  c.step(1);
  return { charging, glow, last: c.p.data.kit.so_last, projs: projs(c) };
}

for (const level of [3, 5, 8, 11, 12]) {
  test(`sorcerer L${level}: every rank and ability runs 600+ steps, deals damage, fires fx, spends Mana`, () => {
    const { phases, steps } = sweep('sorcerer', level);
    assert.ok(steps >= 600);
    const by = Object.fromEntries(phases.map((x) => [x.name, x]));
    assert.ok(by.basic.dmg > 0);
    for (const ph of phases) for (const t of ph.fx) assert.ok(FX_TYPES.has(t), t);
    if (level >= 8) {
      for (const tag of ['ember', 'fireball', 'arc_lance']) assert.ok(by.basic.hits.some((h) => h.tags && h.tags.includes(tag)), tag);
      assert.ok(by.basic.fx.has('beam') && by.basic.fx.has('burst'));
      assert.ok(by.f.casts.includes('f:meteor') && by.f.fx.has('meteor') && by.f.dmg > 0);
    }
    if (level >= 11) {
      assert.ok(by.shift.casts.includes('shift:cataclysm'));
      assert.ok(by.shift.fx.has('screenFlash') && by.shift.fx.has('meteor'));
      assert.ok(by.shift.hits.some((h) => h.tags && h.tags.includes('cataclysm')));
    }
  });
}

test('Overcharge tiers by hold time: tap = Ember (free), 0.3-1.0 s = Fireball (10 Mana), >= 1 s = Arc Lance (25 Mana)', () => {
  const ctx = mk('sorcerer', 8);
  const { game, p, step } = ctx;
  ring(game, 4, 3);
  let r = charge(ctx, 4);
  assert.equal(r.last, 'ember'); assert.ok(r.charging, 'fxTag charge while held');
  assert.equal(r.projs[0].look.model, 'spark');
  assert.equal(game.kits.resource(p).value, 100, 'ember is free');
  step(30);
  game.kits.setResource(p, 100);
  r = charge(ctx, 30);
  assert.equal(r.last, 'fireball');
  assert.equal(r.glow, '#ffb347');
  assert.ok(r.projs.some((e) => e.look.model === 'fireball'));
  assert.ok(Math.abs(game.kits.resource(p).value - 90) < 0.5, 'fireball costs 10');
  step(60);
  assert.ok(ctx.rec.tagged('fireball').length > 0, 'fireball explodes');
  assert.ok(game.ents.all.some((e) => e.look && e.look.model === 'ground_fire'), 'ground_fire');
  step(30);
  game.kits.setResource(p, 100);
  ctx.rec.reset();
  const shake0 = game.camera.shake;
  r = charge(ctx, 62);
  assert.equal(r.last, 'lance');
  assert.equal(r.glow, '#b48cff');
  assert.ok(ctx.rec.has('beam'));
  assert.ok(game.camera.shake > shake0);
  assert.ok(Math.abs(game.kits.resource(p).value - 75) < 0.5, 'lance costs 25');
  assert.ok(ctx.rec.tagged('arc_lance').length >= 1);
  assert.ok(!p.fxTags.includes('charge'), 'charge tag cleared');
  // Not enough Mana: falls back to the tier you can afford.
  step(20);
  game.kits.setResource(p, 12);
  r = charge(ctx, 62);
  assert.equal(r.last, 'fireball');
});

test('charging slows you 30%; the lance pierces every enemy in the line', () => {
  const ctx = mk('sorcerer', 8, [], { marker: 'start' });
  const { game, p, step, input } = ctx;
  input.set({ moveY: 1 }); step(30);
  const y0 = p.y; step(30); const free = p.y - y0;
  input.set({ attackDir: 1 }); step(2);
  const y1 = p.y; step(30); const slowed = p.y - y1;
  input.set({ attackDir: -1, moveY: 0 }); step(20);
  assert.ok(Math.abs(slowed / free - 0.7) < 0.05, `speed x${(slowed / free).toFixed(2)}`);
  const line = [];
  for (let i = 0; i < 4; i++) line.push(game.ents.spawn('rat', p.x + 1.5 + i * 1.4, p.y, { noAi: true, hp: 999 }));
  ctx.rec.reset();
  charge(ctx, 62);
  for (const r of line) assert.ok(ctx.rec.hits.some((h) => h.target === r && h.tags && h.tags.includes('arc_lance')), 'pierced');
});

test('rank IV: Arc Lance forks a bolt from every pierced enemy to a neighbor; Fireball fire is larger and lasts longer', () => {
  const res = {};
  for (const lvl of [8, 12]) {
    const ctx = mk('sorcerer', lvl, [], { marker: 'start' });
    const { game, p, step } = ctx;
    game.ents.spawn('rat', p.x + 2, p.y, { noAi: true, hp: 999 });
    game.ents.spawn('rat', p.x + 2, p.y + 2, { noAi: true, hp: 999 });
    charge(ctx, 62);
    step(3);
    const forks = ctx.rec.fxList.filter((f) => f.type === 'bolt' && f.color === '#b48cff').length;
    step(30);
    charge(ctx, 30);
    step(40);
    const fire = game.ents.all.find((e) => e.look && e.look.model === 'ground_fire' && !e.removed);
    res[lvl] = { forks, fireR: fire ? fire.look.r : 0, fireTtl: fire ? fire.ttl : 0 };
  }
  assert.equal(res[8].forks, 0);
  assert.ok(res[12].forks >= 1, 'forked bolt');
  assert.ok(res[12].fireR > res[8].fireR, 'larger fire');
  assert.ok(res[12].fireTtl > res[8].fireTtl, 'longer fire');
});

test('Meteor: telegraph_circle on the target 4 tiles ahead while a meteor falls (z), then impact r (data, 2.5 x 1.25), burning ground, shake', () => {
  const ctx = mk('sorcerer', 8, [], { marker: 'start' });
  const { game, p, step, input } = ctx;
  input.set({ attackDir: 1 }); step(1); input.set({ attackDir: -1 }); step(2);
  const target = game.ents.spawn('rat', p.x + 4, p.y, { noAi: true, hp: 9999 });
  refill(ctx);
  ctx.input.set({ held: { f: true } }); ctx.step(1);
  const tele = game.ents.all.find((e) => e.look && e.look.model === 'telegraph_circle');
  const met = game.ents.all.find((e) => e.kind === 'meteor');
  assert.ok(tele && Math.abs(tele.x - (p.x + 4)) < 0.6, 'telegraph ahead');
  assert.equal(tele.look.r, data.specs.sorcerer.kit.meteor.r);
  assert.ok(met && met.z > 6);
  ctx.step(25);
  assert.ok(met.z < 6 && met.z > 0, 'falling: ' + met.z);
  ctx.input.set({ held: { f: false } });
  step(40);
  assert.ok(ctx.rec.has('meteor'));
  assert.ok(ctx.rec.hits.some((h) => h.target === target && h.tags && h.tags.includes('meteor')));
  assert.ok(game.ents.all.some((e) => e.look && e.look.model === 'ground_fire'), 'burning ground');
  assert.ok(Math.abs(game.kits.resource(p).value - 60 - 9 * 66 / 60) < 3, 'cost 40');
});

test('Cataclysm: five meteors over ~3 s on the densest enemies, a screenFlash on each impact', () => {
  const ctx = mk('sorcerer', 11, [], { marker: 'start' });
  const { game, p, step } = ctx;
  const pack = [];
  for (let i = 0; i < 5; i++) pack.push(game.ents.spawn('rat', p.x + 6 + (i % 2) * 0.6, p.y + 2 + i * 0.3, { noAi: true, hp: 9999 }));
  const lone = game.ents.spawn('rat', p.x - 5, p.y - 3, { noAi: true, hp: 9999 });
  refill(ctx);
  press(ctx, 'shift');
  step(240);
  const k = p.data.kit;
  assert.equal(k.so_cataImpacts, 5);
  assert.ok(ctx.rec.count('screenFlash') >= 5);
  const packHits = ctx.rec.tagged('cataclysm').filter((h) => pack.includes(h.target)).length;
  const loneHits = ctx.rec.tagged('cataclysm').filter((h) => h.target === lone).length;
  assert.ok(packHits >= 10 && loneHits * 4 < packHits, `pack ${packHits} lone ${loneHits}`);
});

// ---------------------------------------------------------------------------------------------- boons
test('boon Wildfire: burning enemies explode when defeated and the fire spreads', () => {
  const out = [];
  for (const owned of [false, true]) {
    const ctx = mk('sorcerer', 8, owned ? ['wildfire'] : [], { marker: 'start' });
    const { game, p, step } = ctx;
    const a = game.ents.spawn('rat', p.x + 3, p.y, { noAi: true, hp: 3 });
    const b = game.ents.spawn('rat', p.x + 3.8, p.y + 0.6, { noAi: true, hp: 999 });
    game.combat.status(a, 'burn', 3, 10, p);
    step(150);
    out.push({ dead: a.removed, wf: ctx.rec.tagged('wildfire').length, spread: b.status.burn > 0 });
  }
  assert.ok(out[0].dead && out[1].dead);
  assert.equal(out[0].wf, 0); assert.ok(out[1].wf > 0);
  assert.equal(out[0].spread, false); assert.equal(out[1].spread, true);
});

test('boon Storm Lance: the beam leaves a crackling line for 2 s', () => {
  const out = [];
  for (const owned of [false, true]) {
    const ctx = mk('sorcerer', 8, owned ? ['storm_lance'] : [], { marker: 'start' });
    const { game, p, step } = ctx;
    const r = game.ents.spawn('rat', p.x + 3, p.y, { noAi: true, hp: 999 });
    charge(ctx, 62);
    ctx.rec.reset();
    step(100);
    out.push(ctx.rec.tagged('storm_lance').filter((h) => h.target === r).length);
  }
  assert.equal(out[0], 0);
  assert.ok(out[1] >= 5, 'crackles: ' + out[1]);
});

test('boon Meteor Echo: three smaller meteors follow in a line', () => {
  const out = [];
  for (const owned of [false, true]) {
    const ctx = mk('sorcerer', 8, owned ? ['meteor_echo'] : [], { marker: 'start' });
    ctx.input.set({ attackDir: 1 }); ctx.step(1); ctx.input.set({ attackDir: -1 }); ctx.step(2);
    refill(ctx);
    press(ctx, 'f');
    out.push(ctx.game.ents.all.filter((e) => e.kind === 'meteor').length);
    ctx.step(120);
  }
  assert.equal(out[0], 1);
  assert.equal(out[1], 4);
});

test('boon Quick Study: charges 30% faster and no longer slows you', () => {
  const out = [];
  for (const owned of [false, true]) {
    const ctx = mk('sorcerer', 8, owned ? ['quick_study'] : [], { marker: 'start' });
    ctx.input.set({ attackDir: 1 });
    let fullAt = -1;
    for (let i = 0; i < 80 && fullAt < 0; i++) { ctx.step(1); if (ctx.p.data.kit.so_tier === 2) fullAt = i; }
    out.push({ fullAt, speedMul: ctx.p.data.kit.speedMul });
  }
  assert.ok(out[1].fullAt < out[0].fullAt * 0.8, `${out[1].fullAt} vs ${out[0].fullAt}`);
  assert.equal(out[0].speedMul, 0.7);
  assert.equal(out[1].speedMul, 1);
});
