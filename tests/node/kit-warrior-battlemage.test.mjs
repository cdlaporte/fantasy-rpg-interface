// Battlemage (docs/CLASSES.md): Runic Edge elements, Rune Slash III/IV with Elemental Waves, Rune Shift, Runestorm, boons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DT } from '../../src/contracts.js';
import { mk, dummy, run600 } from './kit-warrior.test.mjs';

const M = { spec: 'battlemage', r: 1.25 };
const FIRE = '#ff7a2f', FROST = '#7fd6ff', STORM = '#ffe14d';
const swingOnce = (g, dir = 1, wait = 0.5) => { g.step(1, { attackDir: dir }); g.step(Math.round(wait / DT), { attackDir: -1 }); };

for (const level of [3, 5, 8, 11, 12]) {
  test(`battlemage L${level}: basic, Rune Shift and Runestorm run 600 steps, damage, fx, Rage`, () => {
    let g = mk({ ...M, level });
    g.swing(600);
    assert.ok(g.dealt > 0 && g.fx.types.slash > 10);
    assert.equal(g.game.hudState().basic.name, level >= 12 ? 'Rune Tide' : level >= 8 ? 'Rune Slash' : level >= 4 ? 'Heavy Hand' : 'Sword Arc');
    if (level < 8) return;
    assert.ok(g.hits.some((h) => h.element === 'fire'), 'fire blade');
    g = mk({ ...M, level });
    run600(g, (i) => { if (i % 60 === 59) g.regroup(); g.step(1, { attackDir: i % 4, pressed: { f: i % 30 === 0 } }); });
    const shifts = g.casts.filter((c) => c === 'f:rune_shift').length;
    assert.ok(shifts >= 6 && shifts <= 8, 'cd 1.5 s: ' + shifts);
    for (const col of [FIRE, FROST, STORM]) assert.ok(g.fxOf('ring').some((e) => e.color === col && e.r === 2.2), 'nova ' + col);
    assert.ok(g.hits.some((h) => h.element === 'frost') && g.hits.some((h) => h.element === 'storm'));
    if (level >= 11) {
      g = mk({ ...M, level, r: 2 });
      g.setRage(100);
      g.press('shift');
      assert.ok(Math.abs(g.rage() - 60) < 0.5, 'costs 40 Rage');
      run600(g, () => g.step(1));
      const pw = g.p.stats.power;
      assert.ok(g.fxOf('pillar').filter((e) => e.color === FIRE).length >= 6, 'fire pillar ring');
      assert.ok(g.fxOf('ring').some((e) => e.color === FROST && e.r >= 5), 'frost ring');
      assert.ok(g.fxOf('bolt').filter((e) => e.color === STORM && e.x2 == null).length >= 6, 'six storm bolts');
      assert.ok(g.fx.types.screenFlash >= 2);
      assert.ok(g.hits.filter((h) => h.amount === Math.round(2 * pw)).length >= 8 * 2, 'pulses at coef 2');
    }
  });
}

test('Rune Shift cycles Fire -> Frost -> Storm: nova of the new element, blade recolors (lookRev), fxTag + stance', () => {
  const g = mk({ ...M, level: 8, ring: 0 });
  assert.equal(g.p.look.held.style, 'runeblade');
  assert.equal(g.p.look.held.glow, FIRE);
  assert.ok(g.p.fxTags.includes('rune_fire'));
  assert.equal(g.game.hudState().kitHud.stance, 'Fire');
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const rev = g.p.lookRev;
    g.press('f'); g.step(Math.round(1.6 / DT));
    assert.ok(g.p.lookRev > rev);
    seen.push([g.p.look.held.glow, g.p.fxTags.filter((t) => t.startsWith('rune_')).join(), g.game.hudState().kitHud.stance]);
  }
  assert.deepEqual(seen, [[FROST, 'rune_frost', 'Frost'], [STORM, 'rune_storm', 'Storm'], [FIRE, 'rune_fire', 'Fire']]);
});

test('Runic Edge effects: fire burns, frost slows and the third stack freezes, storm chains to 2 enemies for 50%', () => {
  // fire
  let g = mk({ ...M, level: 8, ring: 1, r: 1.1, hp: 1e6 });
  swingOnce(g);
  assert.ok(g.foes[0].status.burn > 2 && g.foes[0].fxTags.includes('burn'));
  g.step(Math.round(1 / DT));
  assert.ok(g.hits.some((h) => h.element === 'fire' && h.amount > 0 && h.type === 'true'), 'burn ticks credited to you');
  // frost
  g = mk({ ...M, level: 8, ring: 1, r: 1.1, hp: 1e6 });
  g.press('f'); g.step(100);
  const f = g.foes[0];
  let froze = 0;
  g.game.bus.on('status', (e) => { if (e.id === 'freeze' && e.ent === f) froze++; });
  for (let i = 0; i < 2; i++) { g.game.physics.teleport(f, g.p.x + 1.1, g.p.y); swingOnce(g); }
  assert.ok(f.status.frost > 0 || f.status.stun > 0);
  for (let i = 0; i < 3 && !froze; i++) { g.game.physics.teleport(f, g.p.x + 1.1, g.p.y); swingOnce(g); }
  assert.ok(froze >= 1, 'third frost stack freezes');
  assert.ok(g.fxOf('burst').some((e) => e.color === '#bfefff'), 'ice burst');
  // storm
  g = mk({ ...M, level: 8, ring: 0, hp: 1e6 });
  const a = dummy(g.game, g.p.x + 1.1, g.p.y, 1e6), b = dummy(g.game, g.p.x + 3, g.p.y + 1.5, 1e6), c = dummy(g.game, g.p.x + 3, g.p.y - 1.5, 1e6),
    far = dummy(g.game, g.p.x + 9, g.p.y, 1e6);
  g.press('f'); g.step(100); g.press('f'); g.step(100);
  for (const [e, x, y] of [[a, 1.1, 0], [b, 3, 1.5], [c, 3, -1.5]]) { g.game.physics.teleport(e, g.p.x + x, g.p.y + y); e.kx = e.ky = 0; }
  g.resetCounters();
  swingOnce(g);
  const main = g.hits.find((h) => h.t === a);
  const chained = g.hits.filter((h) => (h.t === b || h.t === c) && h.element === 'storm');
  assert.equal(chained.length, 2);
  for (const h of chained) assert.ok(Math.abs(h.amount - main.amount * 0.5) <= 1);
  assert.ok(!g.hits.some((h) => h.t === far));
  assert.ok(g.fxOf('bolt').filter((e) => e.x2 != null).length >= 2, 'bolt between them');
});

test('Rune Slash: Elemental Wave every third swing (rank III), every second and piercing with element ground (rank IV)', () => {
  const waves = (level, el) => {
    const g = mk({ ...M, level, ring: 0, hp: 1e6 });
    for (let i = 0; i < el; i++) { g.game.abilities.reset(g.p, 'f'); g.press('f'); }
    const n1 = dummy(g.game, g.p.x + 3, g.p.y, 1e6), n2 = dummy(g.game, g.p.x + 4.5, g.p.y, 1e6);
    const shots = [];
    for (let s = 0; s < 6; s++) {
      swingOnce(g);
      shots.push(g.game.ents.all.filter((e) => e.type === 'projectile' && e.look.model === 'wave').length > 0 ? 1 : 0);
      g.step(40);
    }
    const direct = (t) => g.hits.filter((h) => h.t === t && !h.dot && h.type === 'magic' && !(h.tags && h.tags.includes('rune_chain'))).length;
    return { g, n: g.fxOf('sparkle').length, n1: direct(n1), n2: direct(n2),
      fireGround: g.game.ents.all.filter((e) => e.look && e.look.model === 'ground_fire').length,
      frostGround: g.game.ents.all.filter((e) => e.look && e.look.model === 'ground_frost').length };
  };
  const r3 = waves(8, 0);
  assert.equal(r3.n1, 2, 'two waves in six swings at rank III (first target stops them)');
  assert.equal(r3.n2, 0, 'no pierce');
  assert.equal(r3.fireGround, 0);
  const r4 = waves(12, 0);
  assert.ok(r4.n1 >= 3 && r4.n2 >= 3, 'three piercing waves in six swings at rank IV');
  assert.ok(r4.fireGround >= 1, 'fire ground');
  assert.ok(waves(12, 1).frostGround >= 1, 'frost ground');
  const st = waves(12, 2);
  assert.ok(st.g.hits.filter((h) => h.element === 'storm').length > st.n1 + st.n2, 'storm chain');
});

test('Runic Edge: level-10 aura follows the element (flame / frost / storm style)', () => {
  const g = mk({ ...M, level: 10, ring: 0 });
  assert.deepEqual(g.p.look.aura, { style: 'flame', color: FIRE });
  g.press('f');
  assert.deepEqual(g.p.look.aura, { style: 'frost', color: FROST });
  g.game.sys.player.refreshLook();
  assert.deepEqual(g.p.look.aura, { style: 'frost', color: FROST }, 'survives a look refresh');
  g.step(100); g.press('f');
  assert.deepEqual(g.p.look.aura, { style: 'storm', color: STORM });
  const low = mk({ ...M, level: 9, ring: 0 });
  assert.equal(low.p.look.aura, null);
});

test('boon Elemental Overlap: hitting an enemy that carries a different element detonates it', () => {
  const run = (boons) => {
    const g = mk({ ...M, level: 8, ring: 1, r: 1.1, hp: 1e6, boons });
    let overlaps = [];
    g.game.bus.on('rune:overlap', (e) => overlaps.push(e.a + '+' + e.b));
    swingOnce(g);                       // fire mark
    g.press('f');                        // frost nova: steam
    g.step(100); g.game.physics.teleport(g.foes[0], g.p.x + 1.1, g.p.y);
    g.press('f');                        // storm nova: shatter (frost + storm)
    g.step(100); g.game.physics.teleport(g.foes[0], g.p.x + 1.1, g.p.y);
    g.press('f');                        // fire nova: plasma
    g.step(10);
    return { overlaps, texts: g.fxOf('text').filter((e) => /Steam|Shatter|Plasma/.test(e.text)).map((e) => e.text), dealt: g.dealt };
  };
  const a = run([]), b = run(['elemental_overlap']);
  assert.deepEqual(a.overlaps, []);
  assert.deepEqual(b.overlaps, ['fire+frost', 'frost+storm', 'storm+fire']);
  assert.deepEqual(b.texts, ['Steam!', 'Shatter!', 'Plasma!']);
  assert.ok(b.dealt > a.dealt);
});

test('boon Twin Runes: waves fire in pairs (current and previous element)', () => {
  const run = (boons) => {
    const g = mk({ ...M, level: 8, ring: 0, boons });
    g.press('f');                         // frost; previous = fire
    let spawned = [];
    for (let s = 0; s < 3; s++) {
      g.step(1, { attackDir: 1 });
      for (const e of g.game.ents.all) if (e.type === 'projectile' && e.look.model === 'wave' && !spawned.includes(e)) spawned.push(e);
      g.step(Math.round(0.5 / DT), { attackDir: -1 });
    }
    return spawned.map((e) => e.look.color).sort();
  };
  assert.deepEqual(run([]), [FROST]);
  assert.deepEqual(run(['twin_runes']), [FIRE, FROST].sort());
});

test('boon Rune Trail: Shield Bash leaves a trail of the current element', () => {
  const run = (boons, el) => {
    const g = mk({ ...M, level: 8, ring: 0, boons });
    for (let i = 0; i < el; i++) { g.game.abilities.reset(g.p, 'f'); g.press('f'); }
    g.press('space', { moveX: 1 }); g.step(15, { moveX: 0 });
    return g.game.ents.all.filter((e) => e.look && e.data && e.data.zone && e.data.zone.id === 'rune_trail').map((e) => e.look.model);
  };
  assert.deepEqual(run([], 0), []);
  const fire = run(['rune_trail'], 0), frost = run(['rune_trail'], 1), storm = run(['rune_trail'], 2);
  assert.ok(fire.length >= 3 && fire.every((m) => m === 'ground_fire'));
  assert.ok(frost.length >= 3 && frost.every((m) => m === 'ground_frost'));
  assert.ok(storm.length >= 3 && storm.every((m) => m === 'zone_ring'));
});

test('boon Encore: Runestorm adds a fourth, random pulse', () => {
  const run = (boons) => {
    const g = mk({ ...M, level: 11, ring: 4, r: 2, hp: 1e6, boons });
    g.setRage(100); g.press('shift'); g.step(Math.round(4 / DT));
    return { texts: g.fxOf('text').filter((e) => e.text === 'Encore!').length, shakes: g.dealt };
  };
  const a = run([]), b = run(['encore']);
  assert.equal(a.texts, 0);
  assert.equal(b.texts, 1);
  assert.ok(b.shakes > a.shakes);
});

test('battlemage look: robe, runeblade with glow', () => {
  const g = mk({ ...M, level: 8, ring: 0 });
  assert.equal(g.p.look.outfit.style, 'robe');
  assert.equal(g.p.look.held.style, 'runeblade');
});
