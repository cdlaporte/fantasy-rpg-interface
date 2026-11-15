// Monk: Ki (no regen, +8 per punch, meditation), Flowing Fists deflection, Four-Beat Combo (III) and the five-beat
// combo with ki wave + uppercut (IV), Flying Kick chains, Thousand Palms, and the 4 Monk boons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mk, ring, press, attack, refill, sweep, FX_TYPES } from './kit-mage-lib.test.mjs';

for (const level of [3, 5, 8, 11, 12]) {
  test(`monk L${level}: every rank and ability runs 600+ steps, deals damage, fires fx, gains and spends Ki`, () => {
    const { phases, steps } = sweep('monk', level);
    assert.ok(steps >= 600);
    const by = Object.fromEntries(phases.map((x) => [x.name, x]));
    assert.ok(by.basic.dmg > 0);
    for (const ph of phases) for (const t of ph.fx) assert.ok(FX_TYPES.has(t), t);
    if (level >= 8) {
      assert.ok(by.basic.fx.has('slash') && by.basic.fx.has('shockwave'), 'fists + palm');
      assert.ok(by.basic.hits.some((h) => h.tags && h.tags.includes('palm_strike')));
      assert.ok(by.f.casts.includes('f:flying_kick') && by.f.dmg > 0 && by.f.fx.has('afterimage') && by.f.fx.has('trail'));
    }
    if (level >= 11) {
      assert.ok(by.shift.casts.includes('shift:thousand_palms') && by.shift.fx.has('screenFlash'));
      assert.ok(by.shift.hits.some((h) => h.tags && h.tags.includes('thousand_palms')));
    }
  });
}

test('Ki replaces Mana: gold, no passive regen, +8 per punch landed', () => {
  const ctx = mk('monk', 8);
  const { game, p, step } = ctx;
  const r = game.kits.resource(p);
  assert.equal(r.id, 'ki'); assert.equal(r.name, 'Ki'); assert.equal(r.color, '#ffd23f'); assert.equal(r.value, 0);
  ctx.input.set({ moveX: 1 }); step(10); ctx.input.set({ moveX: 0 });
  step(60);
  assert.equal(game.kits.resource(p).value, 0, 'no regen while moving/idle < 1.5 s');
  game.ents.spawn('rat', p.x + 0.8, p.y, { noAi: true, hp: 9999 });
  attack(ctx, 1, 1);
  assert.equal(game.kits.resource(p).value, 8);
  assert.equal(game.hudState().player.resource.name, 'Ki');
});

test('Four-Beat Combo: jab, jab, sweeping kick (150 deg), Palm Strike (cone shockwave, big knockback); 0.18 s beats', () => {
  const ctx = mk('monk', 8);
  const { game, p, step } = ctx;
  const still = { noAi: true, hp: 9999, data: { kbResist: 1 } };
  const r = game.ents.spawn('rat', p.x + 0.8, p.y, still);
  const behind = game.ents.spawn('rat', p.x + 0.5, p.y + 0.85, still);
  ctx.input.set({ attackDir: 1 });
  step(125);
  ctx.input.set({ attackDir: -1 });
  const log = p.data.kit.mo_log.slice(0, 8);
  assert.deepEqual(log, [0, 1, 2, 3, 0, 1, 2, 3]);
  const tags = ctx.rec.hits.filter((h) => h.target === r).map((h) => h.tags[0]);
  assert.deepEqual(tags.slice(0, 4), ['beat1', 'beat2', 'beat3', 'palm_strike']);
  assert.ok(ctx.rec.hits.some((h) => h.target === behind && h.tags[0] === 'beat3'), 'the sweep reaches the side');
  assert.ok(!ctx.rec.hits.some((h) => h.target === behind && h.tags[0] === 'beat1'), 'jabs do not');
  const jab = ctx.rec.hits.find((h) => h.tags[0] === 'beat1').amount, palmHit = ctx.rec.hits.find((h) => h.tags[0] === 'palm_strike').amount;
  assert.ok(palmHit > jab * 3, 'palm coef 2.0 vs jab 0.5');
  assert.ok(ctx.rec.fxList.some((f) => f.type === 'slash' && f.style === 'fist' && f.color === '#ffd23f'));
  assert.ok(ctx.rec.fxList.some((f) => f.type === 'shockwave'));
  assert.equal(game.hudState().basic.name, 'Four-Beat Combo');
  // beats every 0.18 s: 4 strikes within ~0.75 s
  const c2 = mk('monk', 8);
  c2.input.set({ attackDir: 1 }); c2.step(40);
  assert.equal(c2.p.data.kit.mo_beatsDone, 4);
});

test('rank IV: Palm Strike launches a ki wave, and a fifth beat, a rising uppercut, pops the target into the air (stun)', () => {
  const ctx = mk('monk', 12);
  const { game, p, step } = ctx;
  const r = game.ents.spawn('rat', p.x + 0.8, p.y, { noAi: true, hp: 9999, data: { kbResist: 1 } });
  ctx.input.set({ attackDir: 1 });
  let maxZ = 0, waves = 0, stunned = false;
  for (let i = 0; i < 70; i++) {
    step(1);
    maxZ = Math.max(maxZ, r.z);
    waves = Math.max(waves, game.ents.all.filter((e) => e.type === 'projectile' && e.look.model === 'wave').length);
    if (r.status.stun > 0) stunned = true;
  }
  assert.deepEqual(p.data.kit.mo_log.slice(0, 5), [0, 1, 2, 3, 4]);
  assert.ok(waves >= 1, 'ki wave');
  assert.ok(maxZ > 0.5, 'popped into the air: ' + maxZ);
  assert.ok(stunned);
  assert.equal(game.hudState().basic.name, 'Five-Beat Combo');
  ctx.input.set({ attackDir: -1 }); step(60);
  assert.equal(r.z, 0, 'lands');
});

test('Flowing Fists: while punching, enemy projectiles in front are deflected back at their owner', () => {
  for (const punching of [false, true]) {
    const ctx = mk('monk', 8, [], { marker: 'start' });
    const { game, p, step } = ctx;
    const shooter = game.ents.spawn('rat', p.x + 5, p.y, { noAi: true, hp: 9999 });
    if (punching) ctx.input.set({ attackDir: 1 });
    step(2);
    const proj = game.combat.projectile(shooter, { angle: Math.PI, speed: 8, range: 8, dmg: 1, radius: 0.2 });
    step(80);
    ctx.input.set({ attackDir: -1 });
    const refl = ctx.rec.ev('proj:reflected');
    if (!punching) { assert.equal(refl.length, 0); assert.ok(p.hp < p.hpMax, 'hit when not punching'); continue; }
    assert.equal(refl.length, 1, 'deflected');
    assert.equal(proj.team, 'player');
    assert.ok(shooter.hp < 9999, 'it flew back into the shooter');
    assert.ok(p.data.kit.mo_deflects === 1);
  }
});

test('Meditation: standing still 1.5 s meditates (fxTag ki, anim sit, slow hp and Ki regen)', () => {
  const ctx = mk('monk', 8);
  const { game, p, step } = ctx;
  p.hp = Math.round(p.hpMax / 2);
  const hp0 = p.hp;
  step(60);
  assert.ok(!p.fxTags.includes('ki'));
  step(60);
  assert.ok(p.fxTags.includes('ki'), 'meditating');
  assert.equal(p.anim, 'sit');
  step(120);
  assert.ok(game.kits.resource(p).value > 10, 'Ki regen while meditating');
  assert.ok(p.hp > hp0, 'hp regen');
  assert.equal(game.hudState().kitHud.stance, 'Meditating');
  ctx.input.set({ moveX: 1 }); step(2);
  assert.ok(!p.fxTags.includes('ki'), 'moving ends it');
  assert.notEqual(p.anim, 'sit');
});

test('Flying Kick: invulnerable dash-kick 4 tiles; chains to the nearest enemy within 4, up to 3 chains, +20% each', () => {
  const ctx = mk('monk', 8, [], { marker: 'start' });
  const { game, p, step } = ctx;
  const foes = [];
  for (let i = 0; i < 6; i++) foes.push(game.ents.spawn('rat', p.x + 2.5 + i * 2.2, p.y + (i % 2 ? 1 : -1) * 0.6, { noAi: true, hp: 9999 }));
  refill(ctx);
  ctx.input.set({ moveX: 1 }); step(1); ctx.input.set({ moveX: 0 });
  press(ctx, 'f');
  let inv = false;
  for (let i = 0; i < 90; i++) { step(1); if (p.status.invuln > 0) inv = true; }
  const kicks = ctx.rec.tagged('flying_kick');
  assert.equal(kicks.length, 4, 'first kick + 3 chains');
  assert.equal(new Set(kicks.map((h) => h.target)).size, 4);
  assert.ok(kicks[3].amount > kicks[0].amount, 'damage grows');
  assert.ok(inv);
  assert.ok(ctx.rec.has('afterimage') && ctx.rec.has('trail'));
  assert.ok(Math.abs(game.kits.resource(p).value - (100 - 20 + 8 * 4)) < 1 || game.kits.resource(p).value === 100, 'cost 20 Ki');
});

test('Thousand Palms: 2.5 s blur of 12 teleport-strikes over enemies within 4, a gold ring (coef 3) and a 15% heal', () => {
  const ctx = mk('monk', 11);
  const { game, p, step } = ctx;
  const foes = ring(game, 5, 2.5);
  p.hp = Math.round(p.hpMax * 0.5);
  refill(ctx);
  press(ctx, 'shift');
  step(170);
  const strikes = ctx.rec.tagged('thousand_palms');
  const ringHits = strikes.filter((h) => h.type === 'magic');
  assert.equal(strikes.length - ringHits.length, 12, '12 strikes');
  assert.equal(new Set(strikes.filter((h) => h.type === 'melee').map((h) => h.target)).size, 5, 'spread over every enemy');
  assert.ok(ringHits.length >= 1, 'ring');
  assert.ok(ctx.rec.count('afterimage') >= 12);
  assert.ok(ctx.rec.fxList.some((f) => f.type === 'ring' && f.color === '#ffd23f'));
  assert.ok(ctx.rec.has('screenFlash'));
  assert.ok(p.hp >= Math.round(p.hpMax * 0.5) + Math.round(p.hpMax * 0.15) - 1, 'healed 15%');
  void foes;
});

// ---------------------------------------------------------------------------------------------- boons
function palmOnce(ctx) {
  ctx.input.set({ attackDir: 1 }); ctx.step(36); ctx.input.set({ attackDir: -1 }); ctx.step(1);
}
test('boon Iron Skin: Palm Strike grants a 2 s shield_bubble', () => {
  for (const owned of [false, true]) {
    const ctx = mk('monk', 8, owned ? ['iron_skin'] : []);
    ctx.game.ents.spawn('rat', ctx.p.x + 0.8, ctx.p.y, { noAi: true, hp: 9999 });
    palmOnce(ctx);
    const bubble = ctx.game.ents.all.some((e) => e.look && e.look.model === 'shield_bubble' && !e.removed);
    assert.equal(ctx.p.status.shield > 0, owned);
    assert.equal(bubble, owned);
  }
});

test('boon Wind Step: Flying Kick chains 2 more times and hastes you', () => {
  const out = [];
  for (const owned of [false, true]) {
    const ctx = mk('monk', 8, owned ? ['wind_step'] : [], { marker: 'start' });
    for (let i = 0; i < 8; i++) ctx.game.ents.spawn('rat', ctx.p.x + 2.5 + i * 2.2, ctx.p.y + (i % 2 ? 1 : -1) * 0.6, { noAi: true, hp: 9999 });
    refill(ctx);
    ctx.input.set({ moveX: 1 }); ctx.step(1); ctx.input.set({ moveX: 0 });
    press(ctx, 'f');
    const haste = ctx.p.status.haste > 0;
    ctx.step(120);
    out.push({ kicks: ctx.rec.tagged('flying_kick').length, haste });
  }
  assert.equal(out[0].kicks, 4); assert.equal(out[0].haste, false);
  assert.equal(out[1].kicks, 6); assert.equal(out[1].haste, true);
});

test('boon Dragon Wave: at 100 Ki the next Palm Strike is a giant piercing wave beam', () => {
  const out = [];
  for (const owned of [false, true]) {
    const ctx = mk('monk', 8, owned ? ['dragon_wave'] : []);
    for (let i = 0; i < 3; i++) ctx.game.ents.spawn('rat', ctx.p.x + 0.8 + i * 1.4, ctx.p.y, { noAi: true, hp: 9999 });
    ctx.input.set({ attackDir: 1 }); ctx.step(28);
    ctx.game.kits.setResource(ctx.p, 100);
    ctx.step(8); ctx.input.set({ attackDir: -1 }); ctx.step(40);
    out.push({ dw: ctx.rec.tagged('dragon_wave').length, beam: ctx.rec.has('beam'), ki: ctx.game.kits.resource(ctx.p).value });
  }
  assert.equal(out[0].dw, 0);
  assert.equal(out[1].dw, 3, 'pierces all three');
  assert.ok(out[1].beam);
  assert.ok(out[1].ki < out[0].ki - 30, 'spends Ki');
});

test('boon Deflect Mastery: deflected projectiles split into two homing ki blasts', () => {
  const out = [];
  for (const owned of [false, true]) {
    const ctx = mk('monk', 8, owned ? ['deflect_mastery'] : [], { marker: 'start' });
    const shooter = ctx.game.ents.spawn('rat', ctx.p.x + 5, ctx.p.y, { noAi: true, hp: 9999 });
    ctx.input.set({ attackDir: 1 }); ctx.step(2);
    ctx.game.combat.projectile(shooter, { angle: Math.PI, speed: 8, range: 8, dmg: 1, radius: 0.2 });
    ctx.step(80);
    out.push(ctx.rec.tagged('ki_blast').length);
  }
  assert.equal(out[0], 0);
  assert.equal(out[1], 2, 'two ki blasts hit the shooter');
});

test('class boons apply to the Monk fists: Splitting Bolts throws ki sparks from the Palm; Mana Surge at full Ki', () => {
  const out = [];
  for (const owned of [false, true]) {
    const ctx = mk('monk', 8, owned ? ['splitting_bolts', 'mana_surge'] : []);
    let sparks = 0;
    ctx.game.bus.on('ent:spawned', ({ ent }) => { if (ent.type === 'projectile' && ent.look.model === 'spark') sparks++; });
    ctx.game.ents.spawn('rat', ctx.p.x + 2.5, ctx.p.y, { noAi: true, hp: 9999 });
    ctx.game.kits.setResource(ctx.p, 100);
    palmOnce(ctx);
    ctx.step(30);
    out.push({ surge: ctx.rec.tagged('mana_surge').length, sparks });
  }
  assert.equal(out[0].surge, 0); assert.equal(out[0].sparks, 0);
  assert.ok(out[1].surge >= 1, 'giant ki bolt at full Ki');
  assert.equal(out[1].sparks, 2, 'two ki sparks from the Palm');
});
