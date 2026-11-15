// Conjurer: Spirit Bolt marks (III), Soul Chase homing spirit (IV), familiars (Fox / Owl / Stoneling, cap 3, swarm
// marked targets, +50% vs marked), Summon Familiar, Grand Conjuration, and the 4 Conjurer boons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mk, ring, press, attack, refill, sweep, FX_TYPES } from './kit-mage-lib.test.mjs';

const fams = (c) => c.game.combat.summonsOf(c.p, 'familiar', []);

for (const level of [3, 5, 8, 11, 12]) {
  test(`conjurer L${level}: every rank and ability runs 600+ steps, deals damage, fires fx, spends Mana`, () => {
    const { phases, steps } = sweep('conjurer', level);
    assert.ok(steps >= 600);
    const by = Object.fromEntries(phases.map((x) => [x.name, x]));
    assert.ok(by.basic.dmg > 0);
    for (const ph of phases) for (const t of ph.fx) assert.ok(FX_TYPES.has(t), t);
    if (level >= 8) {
      assert.ok(by.basic.hits.some((h) => h.tags && h.tags.includes('spirit_bolt')), 'spirit bolt at rank III');
      assert.ok(by.f.casts.includes('f:summon_familiar'));
      assert.ok(by.f.fx.has('pillar') && by.f.fx.has('poof'));
      assert.ok(by.f.dmg > 0, 'familiars fight');
      assert.ok(by.f.resAfter < by.f.resBefore + 1, 'Mana spent');
    }
    if (level >= 11) {
      assert.ok(by.shift.casts.includes('shift:grand_conjuration'));
      assert.ok(by.shift.fx.has('shockwave') && by.shift.fx.has('screenFlash'));
      assert.ok(by.shift.hits.some((h) => h.tags && h.tags.includes('grand_stomp')), 'guardian stomps');
    }
  });
}

test('Spirit Bolt marks for 4 s; familiars swarm the marked target and deal +50% to it', () => {
  const ctx = mk('conjurer', 8);
  const { game, p, step } = ctx;
  press(ctx, 'f'); refill(ctx); press(ctx, 'f'); refill(ctx); press(ctx, 'f');
  const list = fams(ctx);
  assert.equal(list.length, 3);
  const a = game.ents.spawn('rat', p.x - 3, p.y, { noAi: true, hp: 999 });
  const b = game.ents.spawn('rat', p.x + 3, p.y, { noAi: true, hp: 999 });
  step(30);
  attack(ctx, 1, 2);
  step(20);
  assert.ok(b.status.mark > 2.5, 'marked ' + b.status.mark);
  assert.ok(b.fxTags.includes('mark'));
  for (const f of list) assert.equal(f.ai.target, b.id, f.data.cjKind + ' swarms the mark');
  // +50%: same familiar hit on marked vs unmarked (projectile-free: direct damage from the fox)
  const fox = list.find((f) => f.data.cjKind === 'fox');
  a.status.mark = 0;
  const d1 = game.combat.damage(a, 10, { source: fox, type: 'melee' });
  const d2 = game.combat.damage(b, 10, { source: fox, type: 'melee' });
  assert.ok(d2 > d1 * 1.45, `marked ${d2} vs ${d1}`);
});

test('Summon Familiar: Fox (quadruped melee) -> Owl (flyer, ranged spark) -> Stoneling (golem, taunts); max 3, replacing the oldest heals', () => {
  const ctx = mk('conjurer', 8);
  const { game, p } = ctx;
  for (let i = 0; i < 3; i++) { refill(ctx); press(ctx, 'f'); }
  const list = fams(ctx);
  const kinds = list.map((f) => f.data.cjKind);
  assert.deepEqual(kinds, ['fox', 'owl', 'stoneling']);
  const fox = list[0], owl = list[1], st = list[2];
  assert.equal(fox.look.rig, 'quadruped'); assert.equal(fox.ai.brain, 'ally_melee');
  assert.equal(owl.look.rig, 'flyer'); assert.equal(owl.ai.brain, 'ally_ranged'); assert.ok(owl.data.flying);
  assert.equal(st.look.rig, 'golem'); assert.equal(st.ai.brain, 'ally_tank'); assert.equal(st.data.taunt, true);
  for (const f of list) { assert.ok(f.fxTags.includes('summoned')); assert.equal(f.ttl, Infinity); }
  assert.ok(fox.stats.speed > p.stats.speed * 1.3, 'fast biter');
  assert.ok(st.hpMax > fox.hpMax * 2, 'tough stoneling');
  assert.equal(game.hudState().kitHud.pips, 3);
  assert.equal(game.hudState().kitHud.pipsMax, 3);
  p.hp = Math.round(p.hpMax * 0.5);
  const hp0 = p.hp;
  refill(ctx); press(ctx, 'f');
  const after = fams(ctx);
  assert.equal(after.length, 3, 'cap 3');
  assert.ok(!after.includes(fox), 'oldest replaced');
  assert.equal(after[after.length - 1].data.cjKind, 'fox', 'cycle back to fox');
  assert.ok(p.hp > hp0, 'replace heals');
  // persistent: still there after 20 s, gone after a zone change
  ctx.step(1200);
  assert.equal(fams(ctx).length, 3);
  game.world.loadZone('test', 'start');
  game.ents.flush();
  assert.equal(fams(ctx).length, 0);
});

test('rank IV: a marked enemy that falls releases a homing spirit that seeks the next enemy', () => {
  for (const [lvl, want] of [[8, false], [12, true]]) {
    const ctx = mk('conjurer', lvl);
    const { game, p, step } = ctx;
    const weak = game.ents.spawn('rat', p.x + 2, p.y, { noAi: true, hp: 1 });
    const next = game.ents.spawn('rat', p.x + 2, p.y + 3, { noAi: true, hp: 999 });
    weak.status.mark = 4;
    attack(ctx, 1, 2);
    step(90);
    assert.ok(weak.removed);
    const chased = ctx.rec.tagged('soul_chase');
    assert.equal(chased.length > 0, want, 'L' + lvl);
    if (want) { assert.equal(chased[0].target, next); assert.ok(next.status.mark > 0, 'the spirit marks too'); }
  }
});

test('Grand Conjuration: a giant glowing guardian (size 1.8) stomps shockwaves for 8 s; familiars grow and gain haste', () => {
  const ctx = mk('conjurer', 11);
  const { game, p, step } = ctx;
  press(ctx, 'f'); refill(ctx); press(ctx, 'f');
  ring(game, 6, 2.5);
  refill(ctx);
  press(ctx, 'shift');
  const g = game.combat.summonsOf(p, 'spirit_guardian', [])[0];
  assert.ok(g, 'guardian');
  assert.equal(g.look.rig, 'golem'); assert.equal(g.look.size, 1.8); assert.equal(g.glow, '#3fe0c5');
  assert.ok(ctx.rec.has('screenFlash'));
  for (const f of fams(ctx)) { assert.ok(f.scale > 1.2, 'grown'); assert.ok(f.status.haste > 0, 'haste'); }
  step(240);
  assert.ok(ctx.rec.tagged('grand_stomp').length > 0);
  assert.ok(game.hudState().kitHud.stance === 'Guardian');
  step(300);
  assert.equal(game.combat.summonsOf(p, 'spirit_guardian', []).length, 0, 'gone after 8 s');
  for (const f of fams(ctx)) assert.equal(f.scale, 1, 'back to normal size');
});

// ---------------------------------------------------------------------------------------------- boons
test('boon Pack Leader: a fourth familiar slot; marking hastes the pack', () => {
  for (const owned of [false, true]) {
    const ctx = mk('conjurer', 8, owned ? ['pack_leader'] : []);
    for (let i = 0; i < 4; i++) { refill(ctx); press(ctx, 'f'); }
    assert.equal(fams(ctx).length, owned ? 4 : 3);
    ctx.game.ents.spawn('rat', ctx.p.x + 2.5, ctx.p.y, { noAi: true, hp: 999 });
    attack(ctx, 1, 2); ctx.step(15);
    assert.equal(fams(ctx).every((f) => f.status.haste > 0), owned);
  }
});

test('boon Soul Link: familiar hits restore Mana; a fallen familiar bursts and heals you', () => {
  const res = [];
  for (const owned of [false, true]) {
    const ctx = mk('conjurer', 8, owned ? ['soul_link'] : []);
    const { game, p } = ctx;
    press(ctx, 'f');
    const fox = fams(ctx)[0];
    const r = game.ents.spawn('rat', fox.x + 0.6, fox.y, { noAi: true, hp: 999 });
    game.kits.setResource(p, 0);
    const before = game.kits.resource(p).value;
    game.combat.damage(r, 5, { source: fox, type: 'melee' });
    const gained = game.kits.resource(p).value - before;
    p.hp = Math.round(p.hpMax / 2);
    const hp0 = p.hp;
    game.combat.damage(fox, 9999, { source: r, type: 'melee' });
    ctx.step(2);
    res.push({ gained, healed: p.hp - hp0, burst: ctx.rec.tagged('soul_link').length });
  }
  assert.equal(res[0].gained, 0); assert.ok(res[1].gained >= 2);
  assert.equal(res[0].healed, 0); assert.ok(res[1].healed > 0);
  assert.ok(res[1].burst > 0, 'burst damages the attacker');
});

test('boon Spirit Swap: Blink swaps places with the nearest familiar and both release a Nova', () => {
  const ctx = mk('conjurer', 8, ['spirit_swap']);
  const { game, p, step } = ctx;
  press(ctx, 'f');
  const fox = fams(ctx)[0];
  game.physics.teleport(fox, p.x - 4, p.y);
  step(1);
  ring(game, 4, 1.2);
  const px = p.x, py = p.y, fx = fox.x, fy = fox.y;
  refill(ctx);
  press(ctx, 'space');
  assert.ok(Math.hypot(p.x - fx, p.y - fy) < 0.8, 'player at the familiar');
  assert.ok(Math.hypot(fox.x - px, fox.y - py) < 0.8, 'familiar at the player');
  step(3);
  assert.ok(ctx.rec.tagged('nova').length > 0, 'nova released');
  assert.ok(ctx.rec.casts.includes('space:blink'));
});

test('boon Echo: each familiar echoes your bolt with a mini-bolt', () => {
  const out = [];
  for (const owned of [false, true]) {
    const ctx = mk('conjurer', 8, owned ? ['echo'] : []);
    for (let i = 0; i < 2; i++) { refill(ctx); press(ctx, 'f'); }
    ctx.game.ents.spawn('rat', ctx.p.x + 4, ctx.p.y, { noAi: true, hp: 999 });
    attack(ctx, 1, 2);
    ctx.step(60);
    out.push(ctx.rec.tagged('echo').length);
  }
  assert.equal(out[0], 0);
  assert.ok(out[1] >= 1, 'mini-bolts hit: ' + out[1]);
});
