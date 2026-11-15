// Berserker (docs/CLASSES.md): Wild Heart + Frenzy, Twin Axes III/IV (returning axe), Whirlwind, Skyfall Leap, boons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DT } from '../../src/contracts.js';
import { mk, dummy, run600 } from './kit-warrior.test.mjs';

const B = { spec: 'berserker', r: 1.2 };

for (const level of [3, 5, 8, 11, 12]) {
  test(`berserker L${level}: basic, Whirlwind (hold/drain/release) and Skyfall Leap run 600 steps, damage, fx, Rage`, () => {
    let g = mk({ ...B, level });
    g.swing(600);
    assert.ok(g.dealt > 0 && g.fx.types.slash > 10);
    const name = g.game.hudState().basic.name;
    assert.equal(name, level >= 12 ? 'Boomerang Axes' : level >= 8 ? 'Twin Axes' : level >= 4 ? 'Heavy Hand' : 'Sword Arc');
    if (level >= 8) {
      assert.ok(g.fxOf('slash').some((e) => e.style === 'axe'));
      assert.ok(g.fx.types.afterimage > 5, 'Frenzy reached from chopping');
    }
    if (level >= 12) assert.ok(g.game.ents.all.some((e) => e.look && e.look.model === 'axe') || g.hits.some((h) => h.type === 'melee' && h.tags && h.tags[0] === 'wskill'));
    if (level < 8) return;
    g = mk({ ...B, level, r: 1.3 });
    g.setRage(90);
    run600(g, (i) => {
      if (i === 300) g.setRage(90);
      g.step(1, { held: { f: i % 300 < 150 } });
    });
    assert.ok(g.fxOf('slash').filter((e) => e.style === 'spin').length >= 20, 'spin slashes');
    assert.ok(g.fx.types.ring >= 20, 'wind rings');
    assert.ok(g.dealt > 0);
    assert.equal(g.game.kits.holding(g.p, 'f'), false);
    if (level >= 11) {
      g = mk({ ...B, level, ring: 4, r: 3 });
      run600(g, (i) => g.step(1, { moveX: i < 300 ? 1 : -1, pressed: { shift: i % 100 === 0 } }));
      assert.equal(g.casts.filter((c) => c === 'shift:skyfall_leap').length, 1, 'cooldown 25 s');
      assert.ok(g.fx.types.meteor >= 1 && g.fx.types.shockwave >= 1 && g.fx.types.screenFlash >= 1);
      assert.ok(g.dealt > 0);
    }
  });
}

test('Frenzy triggers at 100 Rage: fxTag, afterimages, +40% attack speed, drains Rage to 0 over 6 s, 8% lifesteal', () => {
  const g = mk({ ...B, level: 8, ring: 1, r: 1.0, hp: 1e6 });
  g.setRage(99);
  g.step(2);
  assert.ok(!g.p.fxTags.includes('frenzy'));
  g.setRage(100);
  g.step(1);
  assert.ok(g.p.fxTags.includes('frenzy'), 'frenzy fxTag');
  assert.ok(g.game.combat.mod(g.p, 'attackSpeed') >= 0.4 - 1e-9);
  assert.equal(g.game.hudState().kitHud.stance, 'FRENZY');
  g.step(Math.round(3 / DT));
  assert.ok(Math.abs(g.rage() - 50) < 2, 'drains linearly: ' + g.rage());
  assert.ok(g.fx.types.afterimage >= 25);
  // lifesteal
  g.p.hp = Math.round(g.p.hpMax * 0.5);
  const hp0 = g.p.hp;
  for (let i = 0; i < 60; i++) { g.game.physics.teleport(g.foes[0], g.p.x + 1, g.p.y); g.step(1, { attackDir: 1 }); }
  const dealt = g.hits.filter((h) => h.amount > 0).reduce((a, h) => a + h.amount, 0);
  assert.ok(g.p.hp - hp0 >= Math.floor(dealt * 0.08) - 2 && g.p.hp > hp0, `healed ${g.p.hp - hp0} of ${dealt}`);
  g.step(Math.round(3.5 / DT), { attackDir: -1 });
  assert.ok(!g.p.fxTags.includes('frenzy'));
  assert.equal(g.rage(), 0);
  assert.equal(g.game.combat.mod(g.p, 'attackSpeed') <= 0.6, true);
});

test('Wild Heart: attack speed +0..60% as hp falls 100% -> 30%; Rage never decays', () => {
  const g = mk({ ...B, level: 8, ring: 1, r: 1.0, hp: 1e6 });
  g.step(1);
  assert.equal(g.game.combat.mod(g.p, 'attackSpeed'), 0);
  g.p.hp = Math.round(g.p.hpMax * 0.3); g.step(1);
  assert.ok(Math.abs(g.game.combat.mod(g.p, 'attackSpeed') - 0.6) < 0.02);
  g.p.hp = Math.round(g.p.hpMax * 0.65); g.step(1);
  assert.ok(Math.abs(g.game.combat.mod(g.p, 'attackSpeed') - 0.3) < 0.02);
  const swings = (frac) => {
    const h = mk({ ...B, level: 8, ring: 0 });
    h.p.hp = Math.round(h.p.hpMax * frac);
    let n = 0; h.game.bus.on('sfx', (e) => { if (e.id === 'swing') n++; });
    h.step(Math.round(3 / DT), { attackDir: 1 });
    return n;
  };
  const full = swings(1), low = swings(0.3);
  assert.ok(low / full > 1.45 && low / full < 1.75, `swings ${full} -> ${low}`);
  g.setRage(40); g.step(Math.round(8 / DT));
  assert.ok(Math.abs(g.rage() - 40) < 1e-6, 'no decay');
});

test('Twin Axes: alternating chops, 0.26 s, coef 0.7, +8 Rage per hit; rank IV axe returns and hits out and back', () => {
  const g = mk({ ...B, level: 8, ring: 1, r: 1.0, hp: 1e6 });
  g.step(1, { attackDir: 1 }); g.step(1, { attackDir: -1 });
  assert.equal(g.hits[0].amount, Math.round(0.7 * g.p.stats.power));
  assert.equal(g.rage(), 8);
  g.step(Math.round(1 / DT), { attackDir: 1 }); g.step(1, { attackDir: -1 });
  const sl = g.fxOf('slash').filter((e) => e.style === 'axe');
  assert.ok(sl.length >= 4 && sl.length <= 6, 'about 4 chops per second (+1): ' + sl.length);
  assert.ok(Math.abs(sl[0].angle - sl[1].angle) > 0.5, 'left/right');
  const h = mk({ ...B, level: 12, ring: 0 });
  const far = dummy(h.game, h.p.x + 3.5, h.p.y, 1e6);
  for (let s = 0; s < 4; s++) { h.step(1, { attackDir: 1 }); h.step(Math.round(0.3 / DT), { attackDir: -1 }); }
  h.step(Math.round(1.5 / DT));
  assert.equal(h.hits.filter((x) => x.t === far).length, 2, 'axe hits on the way out and back');
  assert.ok(!h.game.ents.all.some((e) => e.type === 'projectile' && !e.removed), 'caught');
});

test('Whirlwind: needs 20 Rage, drains 20/s, 80% speed, ticks coef 0.6 within 1.6 every 0.2 s', () => {
  const g = mk({ ...B, level: 8, ring: 4, r: 1.4, hp: 1e6 });
  g.setRage(10);
  g.step(1, { held: { f: true } }); g.step(3, { held: { f: true } });
  assert.equal(g.game.kits.holding(g.p, 'f'), false, 'refused below 20');
  g.step(1, { held: { f: false } });
  g.setRage(60);
  g.step(1, { held: { f: true } });
  assert.equal(g.p.anim, 'spin');
  g.step(Math.round(1 / DT) - 1, { held: { f: true } });
  assert.ok(Math.abs(g.rage() - 40) < 1.5, 'drain 20/s: ' + g.rage());
  const per = Math.round(0.6 * g.p.stats.power);
  const ticks = g.hits.filter((h) => h.t === g.foes[0] && h.amount === per).length;
  assert.ok(ticks >= 4 && ticks <= 6, 'ticks every 0.2 s: ' + ticks);
  for (const f of g.foes) g.game.physics.teleport(f, f.x + 10, f.y);
  const x0 = g.p.x; g.step(30, { held: { f: true }, moveX: -1 }); const spin = Math.abs(g.p.x - x0);
  g.step(1, { held: { f: false }, moveX: 0 }); g.step(10);
  const x1 = g.p.x; g.step(30, { moveX: -1 }); const free = Math.abs(g.p.x - x1);
  assert.ok(Math.abs(spin / free - 0.8) < 0.06, `${spin.toFixed(2)} vs ${free.toFixed(2)}`);
  g.setRage(25); g.step(1, { moveX: 0, held: { f: true } }); g.step(Math.round(1.5 / DT), { held: { f: true } });
  assert.equal(g.game.kits.holding(g.p, 'f'), false, 'ends when Rage runs out');
});

test('Skyfall Leap: real z arc, invulnerable in the air, shockwave r 3 coef 4 + stun 1; larger during Frenzy', () => {
  const leap = (frenzy) => {
    const g = mk({ ...B, level: 11, ring: 0, hp: 1e6 });
    const near = dummy(g.game, g.p.x + 5 + 2.5, g.p.y, 1e6);
    const edge = dummy(g.game, g.p.x + 5, g.p.y + 3.7, 1e6);
    if (frenzy) { g.setRage(100); g.step(1); }
    g.press('shift', { moveX: 1 });
    let zMax = 0, inv = true;
    for (let i = 0; i < 50; i++) { g.step(1, { moveX: 0 }); zMax = Math.max(zMax, g.p.z); if (i > 2 && i < 30 && g.p.z > 0.5 && !(g.p.status.invuln > 0)) inv = false; }
    return { zMax, inv, near: g.hits.filter((h) => h.t === near), edge: g.hits.some((h) => h.t === edge), stun: near.status.stun, g };
  };
  const a = leap(false);
  assert.ok(a.zMax > 2, 'z arc ' + a.zMax);
  assert.ok(a.inv);
  assert.ok(a.near.some((h) => h.amount === Math.round(4 * a.g.p.stats.power)));
  assert.ok(a.stun > 0.5);
  assert.equal(a.edge, false);
  const b = leap(true);
  assert.equal(b.edge, true, 'frenzy landing is larger');
  assert.ok(b.g.fxOf('meteor').length > a.g.fxOf('meteor').length);
});

test('boon Cyclone: Whirlwind pulls enemies in and widens the longer it spins', () => {
  const run = (boons) => {
    const g = mk({ ...B, level: 8, ring: 4, r: 2.4, hp: 1e6, boons });
    g.setRage(99);
    g.step(1, { held: { f: true } }); g.step(Math.round(3 / DT), { held: { f: true } });
    const d = g.foes.reduce((a, f) => a + Math.hypot(f.x - g.p.x, f.y - g.p.y), 0) / 4;
    return { d, r: Math.max(...g.fxOf('ring').map((e) => e.r)) };
  };
  const a = run([]), b = run(['cyclone']);
  assert.ok(a.r <= 1.61 && a.d > 2);
  assert.ok(b.r > 2.6 && b.d < 1.6, JSON.stringify(b));
});

test('boon Axe Storm: thrown axes bounce between 3 enemies', () => {
  const run = (boons) => {
    const g = mk({ ...B, level: 12, ring: 0, hp: 1e6, boons });
    const foes = [dummy(g.game, g.p.x + 2.5, g.p.y, 1e6), dummy(g.game, g.p.x + 4, g.p.y + 2, 1e6), dummy(g.game, g.p.x + 2, g.p.y + 3.5, 1e6)];
    for (let s = 0; s < 4; s++) { g.step(1, { attackDir: 1 }); g.step(Math.round(0.3 / DT), { attackDir: -1 }); }
    g.step(Math.round(2 / DT));
    return foes.filter((f) => g.hits.some((h) => h.t === f)).length;
  };
  assert.equal(run([]), 1);
  assert.equal(run(['axe_storm']), 3);
});

test('boon Meteor Heart: Skyfall leaves a burning crater', () => {
  const run = (boons) => {
    const g = mk({ ...B, level: 11, ring: 0, boons });
    g.press('shift', { moveX: 1 }); g.step(50, { moveX: 0 });
    return g.game.ents.all.filter((e) => e.look && e.look.model === 'ground_fire').length;
  };
  assert.equal(run([]), 0);
  assert.equal(run(['meteor_heart']), 1);
});

test('boon Undying: during Frenzy hp cannot drop below 1', () => {
  const run = (boons) => {
    const g = mk({ ...B, level: 8, ring: 1, boons });
    g.p.data.minHp = 0;
    g.setRage(100); g.step(1);
    g.game.combat.damage(g.p, 99999, { source: g.foes[0], raw: true, type: 'true' });
    const r = { hp: g.p.hp, down: !!g.p.data.down };
    g.p.data.minHp = 0;
    return r;
  };
  assert.deepEqual(run([]), { hp: 0, down: true });
  assert.deepEqual(run(['undying']), { hp: 1, down: false });
  // the floor is removed when Frenzy ends
  const g = mk({ ...B, level: 8, ring: 1, boons: ['undying'] });
  g.p.data.minHp = 0;
  g.setRage(100); g.step(1);
  assert.equal(g.p.data.minHp, 1);
  g.step(Math.round(6.2 / DT));
  assert.equal(g.p.data.minHp, 0);
});

test('berserker look: vest, axes, horned; level-10 crimson flame aura', () => {
  const g = mk({ ...B, level: 10, ring: 0 });
  assert.equal(g.p.look.outfit.style, 'vest');
  assert.equal(g.p.look.held.style, 'axes');
  assert.equal(g.p.look.hat.style, 'horned');
  assert.deepEqual(g.p.look.aura, { style: 'flame', color: '#d7263d' });
});
