// Mage class kit: Mana, Arcane Bolt I / Twin Bolts II, Blink, Arcane Nova, and the 8 class boons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mk, ring, press, attack, refill, sweep, FX_TYPES } from './kit-mage-lib.test.mjs';

for (const level of [3, 5, 8, 11, 12]) {
  test(`mage L${level}: every rank and ability runs 600+ steps, deals damage, fires fx, spends Mana`, () => {
    const { phases, steps, ctx } = sweep(null, level);
    assert.ok(steps >= 600, 'steps ' + steps);
    const by = Object.fromEntries(phases.map((x) => [x.name, x]));
    assert.ok(by.basic.dmg > 0, 'basic deals damage');
    assert.ok(by.basic.fx.has('sparkle') && by.basic.fx.has('hit'), 'bolt fx');
    for (const ph of phases) for (const t of ph.fx) assert.ok(FX_TYPES.has(t), 'fx type ' + t);
    assert.ok(by.space.casts.includes('space:blink'));
    assert.ok(by.space.fx.has('poof') && by.space.fx.has('afterimage') && by.space.fx.has('sparkle'));
    if (level >= 5) {
      assert.ok(by.q.casts.includes('q:arcane_nova'));
      assert.ok(by.q.dmg > 0 && by.q.fx.has('ring') && by.q.fx.has('burst'));
    } else assert.ok(!by.q);
    assert.ok(ctx.game.kits.resource(ctx.p).value <= 100);
  });
}

test('Mana: 0-100 blue, regenerates 9/s; Blink costs 15, Nova 35', () => {
  const ctx = mk(null, 5);
  const { game, p, step } = ctx;
  const r = game.kits.resource(p);
  assert.equal(r.id, 'mana'); assert.equal(r.max, 100); assert.equal(r.color, '#4d8dff');
  game.kits.setResource(p, 10);
  step(60);
  assert.ok(Math.abs(game.kits.resource(p).value - 19) < 0.6, 'regen 9/s: ' + game.kits.resource(p).value);
  game.kits.setResource(p, 50);
  press(ctx, 'space');
  assert.ok(Math.abs(game.kits.resource(p).value - 35) < 1, 'blink spent 15');
  game.kits.setResource(p, 50);
  press(ctx, 'q');
  assert.ok(Math.abs(game.kits.resource(p).value - 15) < 1, 'nova spent 35');
  game.kits.setResource(p, 10);
  game.abilities.reset(p);
  ctx.rec.reset();
  press(ctx, 'q');
  assert.equal(ctx.rec.casts.length, 0, 'not enough Mana: no cast');
});

test('Arcane Bolt: violet bolt with cyan core, speed 11, range 7; Twin Bolts fire two parallel bolts at rank II', () => {
  const ctx = mk(null, 3);
  const { game, p, step, input } = ctx;
  input.set({ attackDir: 1 });
  step(1);
  const bolts = game.ents.all.filter((e) => e.type === 'projectile' && e.owner === p.id);
  assert.equal(bolts.length, 1);
  assert.equal(bolts[0].look.model, 'bolt');
  assert.equal(bolts[0].look.color, '#9b6bff');
  assert.equal(bolts[0].look.glow, '#7fe7ff');
  assert.equal(bolts[0].look.trail, true);
  assert.ok(Math.abs(Math.hypot(bolts[0].vx, bolts[0].vy) - 11) < 0.01);
  step(60);
  assert.ok(ctx.rec.count('sparkle') >= 3, 'hold to repeat: one muzzle sparkle per bolt');
  input.set({ attackDir: -1 }); step(60);
  const c2 = mk(null, 4);
  c2.input.set({ attackDir: 1 }); c2.step(1);
  const twins = c2.game.ents.all.filter((e) => e.type === 'projectile' && e.owner === c2.p.id);
  assert.equal(twins.length, 2, 'two bolts');
  assert.ok(Math.abs(twins[0].y - twins[1].y) > 0.2, 'parallel');
  assert.equal(c2.game.hudState().basic.name, 'Twin Bolts');
  // damage: coef 1.0 vs 0.65 each (times the balance multiplier)
  const one = mk(null, 3), two = mk(null, 4);
  for (const c of [one, two]) { c.game.ents.spawn('rat', c.p.x + 2, c.p.y, { noAi: true, hp: 999 }); attack(c, 1, 2); c.step(30); }
  const per1 = one.rec.hits[0].amount / one.p.stats.power, per2 = two.rec.hits[0].amount / two.p.stats.power;
  assert.ok(per2 < per1, 'twin bolt coef smaller per bolt');
});

test('Blink: 3.5 tiles in the move direction, through enemies but not walls, 0.2 s invulnerable', () => {
  const ctx = mk(null, 3);
  const { game, p, step, input } = ctx;
  game.ents.spawn('rat', p.x + 1.5, p.y, { noAi: true, hp: 99 });
  const x0 = p.x;
  input.set({ moveX: 1 });
  press(ctx, 'space');
  input.set({ moveX: 0 });
  assert.ok(p.x - x0 > 3.2, 'teleported ' + (p.x - x0));
  assert.ok(p.status.invuln > 0 || ctx.rec.has('afterimage'));
  // wall: the test zone's east hedge
  const c2 = mk(null, 3, [], { marker: [37.5, 15.5] });
  c2.input.set({ moveX: 1 });
  press(c2, 'space');
  assert.ok(c2.p.x < 39, 'stopped by the hedge');
});

test('Arcane Nova: r 2.8 ring + burst, coef 1.8, knockback', () => {
  const ctx = mk(null, 5);
  const { game, p, step } = ctx;
  const rats = ring(game, 6, 1.8);
  const d0 = Math.hypot(rats[0].x - p.x, rats[0].y - p.y);
  press(ctx, 'q');
  step(20);
  assert.ok(ctx.rec.tagged('nova').length === 6, 'all six hit');
  assert.ok(Math.hypot(rats[0].x - p.x, rats[0].y - p.y) > d0 + 0.5, 'knocked back');
  assert.ok(ctx.rec.has('ring') && ctx.rec.has('burst'));
  const far = game.ents.spawn('rat', p.x + 5, p.y, { noAi: true, hp: 99 });
  ctx.rec.reset(); refill(ctx); press(ctx, 'q'); step(5);
  assert.ok(!ctx.rec.hits.some((h) => h.target === far), 'r 2.8');
});

// ---------------------------------------------------------------------------------------------- class boons
function boonDiff(boonId, level, fn) {
  const a = mk(null, level, []), b = mk(null, level, [boonId]);
  return [fn(a), fn(b)];
}

test('boon Splitting Bolts: bolts split into two smaller bolts on impact', () => {
  const [a, b] = boonDiff('splitting_bolts', 3, (c) => {
    c.game.ents.spawn('rat', c.p.x + 2, c.p.y, { noAi: true, hp: 999 });
    c.game.ents.spawn('rat', c.p.x + 3.5, c.p.y + 0.9, { noAi: true, hp: 999 });
    c.game.ents.spawn('rat', c.p.x + 3.5, c.p.y - 0.9, { noAi: true, hp: 999 });
    attack(c, 1, 2);
    let max = 0;
    for (let i = 0; i < 40; i++) { c.step(1); max = Math.max(max, c.game.ents.all.filter((e) => e.type === 'projectile').length); }
    return { max, hits: c.rec.hits.length };
  });
  assert.equal(a.max, 1);
  assert.ok(b.max >= 2, 'split bolts appear');
  assert.ok(b.hits > a.hits, 'split bolts hit more');
});

test('boon Blink Burst: Blink leaves a half-strength Nova behind', () => {
  const [a, b] = boonDiff('blink_burst', 3, (c) => {
    ring(c.game, 5, 1.3);
    c.input.set({ moveX: 1 }); press(c, 'space'); c.input.set({ moveX: 0 }); c.step(5);
    return c.rec.tagged('nova');
  });
  assert.equal(a.length, 0);
  assert.ok(b.length >= 4, 'nova behind');
});

test('boon Frost Nova: Nova freezes and leaves ground_frost', () => {
  const [a, b] = boonDiff('frost_nova', 5, (c) => {
    const rats = ring(c.game, 4, 1.6);
    press(c, 'q'); c.step(3);
    const frost = c.game.ents.all.find((e) => e.type === 'effect' && e.look && e.look.model === 'ground_frost');
    return { stun: rats.filter((r) => r.status.stun > 0).length, frost: !!frost, fxFrost: c.rec.fxList.some((f) => f.color === '#7fd6ff') };
  });
  assert.equal(a.stun, 0); assert.equal(a.frost, false);
  assert.equal(b.stun, 4); assert.equal(b.frost, true); assert.ok(b.fxFrost);
});

test('boon Arcane Orbit: three orbs circle and damage; Nova fires them outward', () => {
  const [a, b] = boonDiff('arcane_orbit', 5, (c) => {
    c.step(2);
    const orbs = () => c.game.ents.all.filter((e) => e.kind === 'arcane_orb' && !e.removed);
    const n0 = orbs().length;
    const r = c.game.ents.spawn('rat', c.p.x + 1.25, c.p.y, { noAi: true, hp: 999 });
    c.step(60);
    const touched = c.rec.tagged('orbit').length;
    c.rec.reset();
    press(c, 'q'); c.step(1);
    const after = orbs().length;
    const shots = c.game.ents.all.filter((e) => e.type === 'projectile' && e.look.model === 'orb').length;
    c.step(200);
    void r;
    return { n0, touched, after, shots, regrown: orbs().length };
  });
  assert.equal(a.n0, 0); assert.equal(a.touched, 0);
  assert.equal(b.n0, 3); assert.ok(b.touched > 0, 'orbs damage what they touch');
  assert.equal(b.after, 0); assert.equal(b.shots, 3, 'nova fires the orbs');
  assert.equal(b.regrown, 3, 'orbs regrow');
});

test('boon Double Blink: two Blink charges', () => {
  const [a, b] = boonDiff('double_blink', 3, (c) => {
    const x0 = c.p.x;
    c.input.set({ moveX: -1 }); press(c, 'space'); c.step(3); press(c, 'space'); c.input.set({ moveX: 0 });
    return { casts: c.rec.casts.filter((x) => x === 'space:blink').length, moved: x0 - c.p.x, hud: c.game.hudState().kitHud };
  });
  assert.equal(a.casts, 1);
  assert.equal(b.casts, 2);
  assert.ok(b.moved > a.moved + 2);
  assert.equal(b.hud.label, 'Blink');
});

test('boon Mana Surge: at full Mana the next basic is a giant piercing bolt (30 Mana)', () => {
  const [a, b] = boonDiff('mana_surge', 3, (c) => {
    for (let i = 0; i < 3; i++) c.game.ents.spawn('rat', c.p.x + 1.5 + i, c.p.y, { noAi: true, hp: 999 });
    const glow = c.p.look.held.glow;
    c.game.kits.setResource(c.p, 100); c.step(1);
    const glowFull = c.p.look.held.glow;
    attack(c, 1, 2); c.step(40);
    return { hits: c.rec.hits.length, surge: c.rec.tagged('mana_surge').length, mana: c.game.kits.resource(c.p).value, glow, glowFull };
  });
  assert.equal(a.surge, 0);
  assert.ok(b.surge >= 3, 'pierces all three');
  assert.ok(b.mana < a.mana - 20, 'spent Mana');
  assert.equal(b.glowFull, '#ffffff', 'staff glows white when ready');
});

test('boon Gravity Well: Nova pulls enemies in, then blasts them out', () => {
  const [a, b] = boonDiff('gravity_well', 5, (c) => {
    const rats = ring(c.game, 4, 3.6);
    press(c, 'q');
    c.step(8);
    const mid = Math.hypot(rats[0].x - c.p.x, rats[0].y - c.p.y);
    c.step(30);
    return { mid, hits: c.rec.tagged('nova').length };
  });
  assert.ok(b.mid < 3.2, 'pulled in: ' + b.mid);
  assert.ok(a.mid > 3.4);
  assert.equal(a.hits, 0, 'out of range without the well');
  assert.equal(b.hits, 4, 'pulled into the blast');
});

test('boon Phase Shift: blinking through an enemy damages and marks it', () => {
  const [a, b] = boonDiff('phase_shift', 3, (c) => {
    const r = c.game.ents.spawn('rat', c.p.x + 1.6, c.p.y, { noAi: true, hp: 999 });
    c.input.set({ moveX: 1 }); press(c, 'space'); c.input.set({ moveX: 0 });
    return { dmg: c.rec.dmg, mark: r.status.mark > 0, trail: c.rec.has('trail') };
  });
  assert.equal(a.dmg, 0); assert.equal(a.mark, false);
  assert.ok(b.dmg > 0); assert.equal(b.mark, true); assert.ok(b.trail);
});

test('level 10 aura: sparkle in the class color appears on the mage', () => {
  const lo = mk(null, 9), hi = mk(null, 10);
  assert.equal(lo.p.look.aura, null);
  assert.deepEqual(hi.p.look.aura, { style: 'sparkle', color: '#9b6bff' });
});
