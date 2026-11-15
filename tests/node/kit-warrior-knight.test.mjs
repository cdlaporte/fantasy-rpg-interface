// Knight (docs/CLASSES.md): Bulwark Aura, Knight's Cleave III/IV, Shield Wall + Perfect Block + Shield Slam, Aegis, boons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DT } from '../../src/contracts.js';
import { config } from '../../src/config.js';
import data from '../../src/data/index.js';

const NS = config.numberScale;
import { mk, dummy, run600 } from './kit-warrior.test.mjs';

const K = { spec: 'knight' };
const shoot = (g, from, dmg = 1) => g.game.combat.projectile(from, { angle: Math.atan2(g.p.y - from.y, g.p.x - from.x), speed: 12, range: 9, dmg });

for (const level of [3, 5, 8, 11, 12]) {
  test(`knight L${level}: basic, Shield Wall (cast/hold/release) and Aegis run 600 steps, damage, fx, Rage`, () => {
    let g = mk({ ...K, level });
    g.swing(600);
    assert.ok(g.dealt > 0 && g.fx.types.slash > 10);
    assert.ok(g.rage() > 0);
    const name = g.game.hudState().basic.name;
    assert.equal(name, level >= 12 ? 'Dawn Cleave' : level >= 8 ? "Knight's Cleave" : level >= 4 ? 'Heavy Hand' : 'Sword Arc');
    if (level >= 12) assert.ok(g.fx.types.sparkle > 0, 'rank IV crescents');
    if (level < 8) {
      g.press('f');
      assert.ok(!g.p.data.guard, 'Shield Wall locked before 8');
      return;
    }
    // Shield Wall: hold 0.5 s while being hit, release -> Shield Slam, repeat
    g = mk({ ...K, level, r: 1.3 });
    g.p.angle = 0; g.p.dir = 1;
    run600(g, (i) => {
      const held = i % 60 < 30;
      g.step(1, { held: { f: held }, attackDir: -1 });
      if (held && i % 60 === 10) g.game.combat.damage(g.p, 10, { source: g.foes[0], type: 'melee' });
    });
    assert.ok(g.fxOf('shockwave').filter((e) => e.arc === 110).length >= 8, 'Shield Slam on every release after a block');
    assert.ok(g.dealt > 0);
    assert.equal(g.p.data.guard, null);
    assert.ok(g.game.hudState().abilities[2].name === 'Shield Wall');
    if (level >= 11) {
      g = mk({ ...K, level });
      g.setRage(100);
      g.press('shift');
      assert.ok(Math.abs(g.rage() - 50) < 0.5, 'Aegis costs 50 Rage');
      assert.ok(g.fx.types.pillar >= 1 && g.fx.types.screenFlash >= 1);
      assert.ok(g.game.ents.all.some((e) => e.look && e.look.model === 'shield_bubble'));
      run600(g, (i) => g.step(1, { attackDir: i % 4, pressed: { shift: i === 400 } }));
      assert.ok(g.fx.types.shockwave >= 1 && g.fx.types.screenFlash >= 2, 'radiant end');
      assert.ok(g.dealt > 0);
      assert.equal(g.casts.filter((c) => c === 'shift:aegis').length, 1, 'cooldown 30 s');
    }
  });
}

test('Perfect Block: within 0.25 s of raising the shield a projectile is reflected into its shooter; +20 Rage', () => {
  const g = mk({ ...K, level: 8, ring: 0 });
  const shooter = dummy(g.game, g.p.x + 5, g.p.y);
  g.p.angle = 0; g.p.dir = 1;
  shoot(g, shooter, 2);
  g.step(Math.round(0.22 / DT));
  g.step(1, { held: { f: true } });
  g.step(40, { held: { f: true } });
  g.step(1, { held: { f: false } });
  assert.ok(g.hits.some((h) => h.t === shooter), 'reflected projectile hit the shooter');
  assert.ok(g.rage() >= 20 + 10 - 1, 'Perfect Block Rage + hit taken: ' + g.rage());
  assert.ok(g.fxOf('ring').some((e) => e.r === 2 && e.color === '#f2c94c'), 'gold ring');
  assert.ok(g.fx.types.sparkle >= 1);
});

test('Perfect Block stuns a melee attacker 1 s; a late block only reduces 85%; Shield Slam scales with damage blocked', () => {
  const g = mk({ ...K, level: 8, ring: 0 });
  const foe = dummy(g.game, g.p.x + 1, g.p.y, 50000);
  g.p.angle = 0; g.p.dir = 1;
  g.step(1, { held: { f: true } });
  const hp0 = g.p.hp;
  g.game.combat.damage(g.p, 20 * NS, { source: foe, type: 'melee' });
  assert.equal(g.p.hp, hp0, 'perfect: no damage');
  assert.ok(foe.status.stun > 0.9);
  g.step(30, { held: { f: true } });
  g.game.combat.damage(g.p, 20 * NS, { source: foe, type: 'melee' });
  assert.equal(hp0 - g.p.hp, 3 * NS, 'late block reduces 85%');
  const slamSmall = (() => { const n = g.hits.length; g.step(1, { held: { f: false } }); return g.hits.slice(n).reduce((a, h) => a + h.amount, 0); })();
  // second round blocks much more damage -> a bigger slam
  g.game.abilities.reset(g.p);
  g.step(5);
  g.step(1, { held: { f: true } });
  g.step(30, { held: { f: true } });
  for (let i = 0; i < 6; i++) g.game.combat.damage(g.p, 30 * NS, { source: foe, type: 'melee' });
  const n2 = g.hits.length;
  g.step(1, { held: { f: false } });
  const slamBig = g.hits.slice(n2).reduce((a, h) => a + h.amount, 0);
  const pw = g.p.stats.power;
  assert.ok(slamSmall >= Math.round(pw) && slamBig > slamSmall, `slam ${slamSmall} -> ${slamBig}`);
  assert.ok(slamBig <= Math.round(pw * 4) + 1, 'capped');
  // no slam when nothing was blocked
  const n3 = g.hits.length;
  g.step(1, { held: { f: true } }); g.step(10, { held: { f: true } }); g.step(1, { held: { f: false } });
  assert.equal(g.hits.length, n3);
  // speed -40% while holding
  const x0 = g.p.x; g.step(30, { moveX: -1 }); const free = Math.abs(g.p.x - x0);
  const x1 = g.p.x; g.step(30, { moveX: -1, held: { f: true } }); const blocking = Math.abs(g.p.x - x1);
  g.step(1, { moveX: 0, held: { f: false } });
  assert.ok(Math.abs(blocking / free - 0.6) < 0.08, `speed ${free.toFixed(2)} vs ${blocking.toFixed(2)}`);
});

test("Knight's Cleave: 120 degrees, every fourth swing a shield punch stuns; rank IV crescent every third swing pierces", () => {
  const g = mk({ ...K, level: 8, ring: 1, r: 1.1 });
  const f = g.foes[0];
  let stunned = -1;
  for (let s = 1; s <= 4; s++) {
    g.game.physics.teleport(f, g.p.x + 1.1, g.p.y); f.kx = f.ky = 0;
    g.step(1, { attackDir: 1 }); g.step(Math.round(0.5 / DT), { attackDir: -1 });
    if (f.status.stun > 0 && stunned < 0) stunned = s;
  }
  assert.equal(stunned, 4, 'punch after the fourth');
  assert.ok(g.fxOf('slash').some((e) => e.style === 'fist'));
  const crescents = (lvl) => {
    const h = mk({ ...K, level: lvl, ring: 0 });
    const a = dummy(h.game, h.p.x + 3, h.p.y), b = dummy(h.game, h.p.x + 4.2, h.p.y);
    for (let s = 0; s < 3; s++) { h.step(1, { attackDir: 1 }); h.step(Math.round(0.5 / DT), { attackDir: -1 }); }
    h.step(40);
    return [h.hits.some((x) => x.t === a), h.hits.some((x) => x.t === b)];
  };
  assert.deepEqual(crescents(11), [false, false]);
  assert.deepEqual(crescents(12), [true, true], 'crescent range 5 pierces');
});

test('Bulwark Aura: classmates within 4 tiles take 30% less damage (gold ring under them)', () => {
  const g = mk({ ...K, level: 8, ring: 0 });
  g.game.companions.set(['mage']);
  const c = g.game.companions.active[0];
  c.ai = null;
  const foe = dummy(g.game, 5, 5);
  const hit = () => { c.hp = c.hpMax; g.game.combat.damage(c, 20, { source: foe, type: 'melee' }); return c.hpMax - c.hp; };
  g.game.physics.teleport(c, g.p.x + 2, g.p.y); g.step(3);
  const near = hit();
  g.game.physics.teleport(c, g.p.x - 7, g.p.y); g.step(20);
  const far = hit();
  assert.equal(far, 20);
  assert.equal(near, 14);
  g.game.physics.teleport(c, g.p.x + 2, g.p.y); g.step(80);
  assert.ok(g.fxOf('ring').some((e) => e.color === '#f2c94c' && Math.abs(e.x - c.x) < 0.5), 'gold ring under the classmate');
});

test('Aegis of Flinkerton: 80% less inside, enemies pushed out, radiant pillar + shockwave at the end', () => {
  const g = mk({ ...K, level: 11, ring: 4, r: 1.5, hp: 50000 });
  g.setRage(60);
  g.press('shift');
  g.step(10);
  const hp0 = g.p.hp;
  g.game.combat.damage(g.p, 50, { source: g.foes[0], type: 'magic' });
  assert.equal(hp0 - g.p.hp, 10, '80% less');
  g.step(Math.round(1.5 / DT));
  assert.ok(g.foes.every((f) => Math.hypot(f.x - g.p.x, f.y - g.p.y) > 2.5), 'pushed out of the dome');
  for (const f of g.foes) g.game.physics.teleport(f, g.p.x + 1, g.p.y);
  const n = g.hits.length;
  g.step(Math.round(4 / DT));
  const end = g.hits.slice(n).filter((h) => h.amount === Math.round(data.specs.knight.nums.aegis.endDmg * g.p.stats.power));
  assert.ok(end.length >= 1, 'end shockwave');
  assert.ok(g.fxOf('pillar').length >= 2 && g.fxOf('screenFlash').length >= 2);
});

test('boon Mirror Shield: a Perfect Block fires a beam back at the attacker', () => {
  const run = (boons) => {
    const g = mk({ ...K, level: 8, ring: 0, boons });
    const foe = dummy(g.game, g.p.x + 3, g.p.y);
    g.p.angle = 0;
    g.step(1, { held: { f: true } });
    g.game.combat.damage(g.p, 10, { source: foe, type: 'ranged' });
    g.step(1, { held: { f: true } });
    return { hit: g.hits.some((h) => h.t === foe), beams: g.fxOf('beam').length };
  };
  assert.deepEqual(run([]), { hit: false, beams: 0 });
  const b = run(['mirror_shield']);
  assert.ok(b.hit && b.beams === 1);
});

test('boon Phalanx: while Shield Wall is up classmates get a shield too', () => {
  const run = (boons) => {
    const g = mk({ ...K, level: 8, ring: 0, boons });
    g.game.companions.set(['rogue']);
    const c = g.game.companions.active[0];
    g.game.physics.teleport(c, g.p.x + 1.5, g.p.y);
    g.step(1, { held: { f: true } }); g.step(10, { held: { f: true } });
    return c.status.shield > 0 && c.fxTags.includes('shield');
  };
  assert.equal(run([]), false);
  assert.equal(run(['phalanx']), true);
});

test('boon Earthsplitter: Shield Slam travels 5 tiles as a ground wave', () => {
  const run = (boons) => {
    const g = mk({ ...K, level: 8, ring: 0, boons });
    const far = dummy(g.game, g.p.x + 4.5, g.p.y);
    const foe = dummy(g.game, g.p.x + 1, g.p.y + 0.0);
    g.p.angle = 0;
    g.step(1, { held: { f: true } }); g.step(20, { held: { f: true } });
    g.game.combat.damage(g.p, 10, { source: foe, type: 'melee' });
    g.step(1, { held: { f: false } }); g.step(50);
    return g.hits.some((h) => h.t === far);
  };
  assert.equal(run([]), false);
  assert.equal(run(['earthsplitter']), true);
});

test('boon Oathkeeper: Aegis lasts 2 s longer and heals inside', () => {
  const run = (boons) => {
    const g = mk({ ...K, level: 11, ring: 0, boons });
    g.setRage(100);
    g.p.hp = Math.round(g.p.hpMax * 0.5);
    g.press('shift');
    let lastActive = 0;
    for (let i = 0; i < 9 / DT; i++) { g.step(1); if (g.game.hudState().abilities[3].active) lastActive = i * DT; }
    return { dur: lastActive, healed: g.p.hp > Math.round(g.p.hpMax * 0.5) };
  };
  const a = run([]), b = run(['oathkeeper']);
  assert.ok(Math.abs(a.dur - 5) < 0.1 && !a.healed, JSON.stringify(a));
  assert.ok(Math.abs(b.dur - 7) < 0.1 && b.healed, JSON.stringify(b));
});

test('knight look: plate, sword_shield, helm; level-10 aura in gold', () => {
  const g = mk({ ...K, level: 10, ring: 0 });
  assert.equal(g.p.look.outfit.style, 'plate');
  assert.equal(g.p.look.held.style, 'sword_shield');
  assert.equal(g.p.look.hat.style, 'helm');
  assert.equal(g.p.look.aura.color, '#f2c94c');
  g.step(1, { held: { f: true } });
  assert.equal(g.p.anim, 'block');
  assert.equal(g.game.hudState().kitHud.stance, 'Shield Wall');
});
