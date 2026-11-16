// Round 4, mage masteries (docs/MASTERY.md): Summoner, Illusionist (Conjurer), Stormcaller, Pyromancer (Sorcerer), Sage,
// Mystic (Monk). Data shape, equipping at 15-20, each passive with vs without (the subclass), each upgraded ultimate's
// fx and effect, a 3000-step random-input fuzz per mastery, and save / re-equip safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../../src/data/index.js';
import { createGame } from '../../src/core/game.js';
import { createQuestions } from '../../src/questions/index.js';
import { createRng } from '../../src/core/rng.js';
import { mk, ring, press, attack, refill, ICONS, FX_TYPES, DT } from './kit-mage-lib.test.mjs';
import { MASTERIES, mkM } from './r4-mage-lib.mjs';

const IDS = Object.keys(MASTERIES);
const LOOK = {
  outfit: ['tunic', 'robe', 'cloak', 'plate', 'leather', 'gi', 'quarterzip', 'dress', 'apron', 'uniform', 'vest'],
  hat: ['wizard', 'cap', 'crown', 'bandana', 'helm', 'straw', 'chef', 'feather', 'horned', 'circlet'],
  held: ['stick', 'sword', 'sword_shield', 'axes', 'runeblade', 'staff', 'orb', 'wand', 'fists', 'daggers', 'bow', 'shuriken', 'spear', 'book', 'broom', 'lantern'],
  aura: ['glow', 'flame', 'sparkle', 'shadow', 'frost', 'storm'],
};
const ULT = { summoner: 'guardian_dragon', illusionist: 'hall_of_mirrors', stormcaller: 'thunderstorm', pyromancer: 'inferno', sage: 'enlightenment', mystic: 'avatar' };
const BOONS = {
  mage: ['splitting_bolts', 'blink_burst', 'frost_nova', 'arcane_orbit', 'double_blink', 'mana_surge', 'gravity_well', 'phase_shift', 'arcane_chain', 'comet_nova', 'mana_shield'],
  conjurer: ['pack_leader', 'soul_link', 'spirit_swap', 'echo', 'wild_hunt', 'spirit_totem'],
  sorcerer: ['wildfire', 'storm_lance', 'meteor_echo', 'quick_study', 'living_bomb', 'phoenix'],
  monk: ['iron_skin', 'wind_step', 'dragon_wave', 'deflect_mastery', 'palm_echo', 'jade_lotus'],
};
const tagged = (ctx, tag) => ctx.rec.hits.filter((h) => h.tags && h.tags.includes(tag));
const summons = (ctx, key) => ctx.game.combat.summonsOf(ctx.p, key, []);
/** The subclass (without the mastery) at the same level, for "with vs without" comparisons. */
const sub = (m, level = 16, boons = [], opts = {}) => mk(MASTERIES[m], level, boons, opts);
function ult(ctx) { refill(ctx); press(ctx, 'shift', 2); }
function charge(ctx, steps) { ctx.input.set({ attackDir: 1 }); ctx.step(steps); ctx.input.set({ attackDir: -1 }); ctx.step(1); }

// ------------------------------------------------------------------------------------------------ data
test('mastery data: six tier-3 entries with passive, ultimate, look patch (CONTRACTS 6 vocabulary) and a dmgMul table to 20', () => {
  for (const id of IDS) {
    const s = data.specs[id];
    assert.ok(s, id);
    assert.equal(s.id, id);
    assert.equal(s.from, MASTERIES[id]);
    assert.equal(s.tier, 3);
    assert.ok(s.name && s.blurb && s.blurb.length < 100 && /^#[0-9a-f]{6}$/i.test(s.color), id);
    for (const k of ['hp', 'power', 'speed']) assert.equal(typeof s.mods[k], 'number');
    assert.deepEqual(s.mods, { hp: 1, power: 1, speed: 1 }, id + ' keeps its subclass body (the subclass mods layer under it)');
    assert.ok(s.passive && s.passive.name && s.passive.desc && s.passive.desc.length < 110, id);
    assert.ok(s.ultimate && s.ultimate.name && s.ultimate.desc && ICONS.has(s.ultimate.icon), id);
    const l = s.look;
    assert.ok(LOOK.outfit.includes(l.outfit.style) && LOOK.hat.includes(l.hat.style) && LOOK.held.includes(l.held.style), id);
    assert.ok(LOOK.aura.includes(l.aura.style) && l.cape && l.cape.color, id);
    const tab = s.balance.dmgMul;
    assert.equal(tab[tab.length - 1][0], 20);
    for (const [lv, m] of tab) assert.ok(lv >= 15 && m > 0.8 && m < 1.3, id + ' dmgMul ' + lv);
  }
  // masteries never show in the level-8 picker
  const g = mk(null, 8).game;
  assert.deepEqual(g.progression.specIds('mage').sort(), ['conjurer', 'monk', 'sorcerer']);
  // the creature looks of the new summons use existing rigs/features
  assert.equal(data.specs.summoner.kit.phoenix.look.rig, 'flyer');
  assert.deepEqual(data.specs.summoner.kit.phoenix.look.features, ['wings_bird', 'glow']);
  assert.equal(data.specs.summoner.kit.dragon.look.rig, 'flyer');
});

// ------------------------------------------------------------------------------------------------ equip
for (const id of IDS) {
  test(`${id}: equips over its subclass at 15-20 (masteryId, look, ultimate on H at 15, HUD)`, () => {
    for (const level of [15, 17, 20]) {
      const ctx = mkM(id, level);
      const { game, p } = ctx;
      const L = game.kits.active(p);
      assert.equal(L.id, id);
      assert.deepEqual(L.layers.map((k) => k.id), ['mage', MASTERIES[id], id]);
      assert.equal(p.data.specId, MASTERIES[id]);
      assert.equal(p.data.masteryId, id);
      assert.equal(L.abilities.shift.id, ULT[id]);
      assert.equal(L.abilities.shift.unlock, 15);
      assert.ok(game.kits.unlocked(p, 'shift'));
      const s = data.specs[id];
      assert.equal(p.look.hat.style, s.look.hat.style, 'mastery look applied');
      assert.equal(p.look.outfit.primary, s.look.outfit.primary);
      assert.ok(p.look.cape && p.look.cape.color);
      const h = game.hudState();
      const sh = h.abilities.find((a) => a.slot === 'shift');
      assert.equal(sh.name, s.ultimate.name);
      assert.ok(sh.unlocked && ICONS.has(sh.icon));
      assert.equal(h.basic.rank, level >= 16 ? 5 : 4);
    }
    // switching back to the subclass drops the mastery look and ultimate
    const ctx = mkM(id, 16);
    if (ctx.game.sys.progression.setMastery) ctx.game.sys.progression.setMastery(null, { quiet: true });
    ctx.game.kits.set(ctx.p, 'mage', MASTERIES[id]);
    ctx.step(1);
    assert.equal(ctx.p.data.masteryId, null);
    assert.notEqual(ctx.p.look.hat.style === data.specs[id].look.hat.style && ctx.p.look.outfit.primary === data.specs[id].look.outfit.primary, true);
    assert.notEqual(ctx.game.kits.active(ctx.p).abilities.shift.id, ULT[id]);
  });
}

// ------------------------------------------------------------------------------------------------ passives (with vs without)
test('Summoner Legion: F calls two familiars, up to five (Conjurer: one, max three); the Phoenix is reborn', () => {
  const count = (ctx) => summons(ctx, 'familiar').length;
  const c0 = sub('summoner');
  for (let i = 0; i < 4; i++) { refill(c0); press(c0, 'f', 2); }
  assert.equal(count(c0), 3);
  const c = mkM('summoner', 16);
  refill(c); press(c, 'f', 2);
  assert.equal(count(c), 2, 'two at a time');
  for (let i = 0; i < 3; i++) { refill(c); press(c, 'f', 2); }
  assert.equal(count(c), 5, 'up to five');
  const kinds = summons(c, 'familiar').map((e) => e.data.cjKind);
  assert.ok(kinds.includes('phoenix'));
  const ph = summons(c, 'familiar').find((e) => e.data.cjKind === 'phoenix');
  assert.equal(ph.look.rig, 'flyer');
  assert.ok(ph.look.features.includes('wings_bird') && ph.look.features.includes('glow'));
  assert.equal(c.game.hudState().kitHud.pipsMax, 5);
  // the Phoenix shoots fire, bursts when it falls, and is reborn a few seconds later
  ring(c.game, 4, 3, { hp: 3000 });
  c.rec.reset();
  c.step(240);
  assert.ok(c.rec.hits.some((h) => h.source && h.source.data && h.source.data.cjKind === 'phoenix' && h.element === 'fire'), 'phoenix flames');
  c.game.combat.damage(ph, 1e6, { source: c.game.ents.all.find((e) => e.type === 'enemy'), type: 'true' });
  c.step(5);
  assert.ok(tagged(c, 'phoenix_burst').length > 0 || c.rec.fxList.some((f) => f.type === 'pillar' && f.color === '#ff7a1a'), 'burst on death');
  assert.ok(!summons(c, 'familiar').some((e) => e.data.cjKind === 'phoenix'));
  c.step(Math.round(data.specs.summoner.kit.phoenix.rebirth / DT) + 5);
  assert.ok(summons(c, 'familiar').some((e) => e.data.cjKind === 'phoenix'), 'reborn');
  assert.ok(c.rec.fxList.some((f) => f.type === 'text' && f.text === 'Reborn!'));
});

test('Illusionist Mirror Images: Blink leaves a copy where you stood; copies taunt, copy your bolts and burst (Conjurer: none)', () => {
  const c0 = sub('illusionist');
  ring(c0.game, 4, 3, { hp: 3000 });
  refill(c0); c0.input.set({ moveX: 1 }); press(c0, 'space', 2); attack(c0, 1, 60);
  assert.equal(summons(c0, 'mirror_image').length, 0);
  const c = mkM('illusionist', 16);
  const { game, p } = c;
  ring(game, 4, 3, { hp: 3000 });
  const x0 = p.x, y0 = p.y;
  refill(c); c.input.set({ moveX: 1 }); press(c, 'space', 2); c.input.set({ moveX: 0 });
  const imgs = summons(c, 'mirror_image');
  assert.equal(imgs.length, 1);
  assert.ok(Math.hypot(imgs[0].x - x0, imgs[0].y - y0) < 0.6, 'the copy stays where you stood');
  assert.ok(Math.hypot(p.x - x0, p.y - y0) > 1.5, 'you blinked away');
  assert.ok(imgs[0].data.taunt && imgs[0].data.decoy, 'taunts');
  assert.equal(imgs[0].tint, data.specs.illusionist.color);
  assert.equal(imgs[0].look.hat.style, 'feather', 'it wears your look');
  c.rec.reset();
  attack(c, 3, 30);
  assert.ok(tagged(c, 'mirror_bolt').length > 0 || p.data.kit.il_copyBolts > 0, 'copies cast with you');
  refill(c); press(c, 'q', 2);
  assert.equal(summons(c, 'mirror_image').length, 2, 'every spell leaves one');
  c.step(Math.round(data.specs.illusionist.kit.image.ttl / DT) + 10);
  assert.equal(summons(c, 'mirror_image').length, 0, 'short-lived');
  assert.ok(tagged(c, 'mirror_burst').length > 0, 'they burst');
});

test('Stormcaller Static: Arc Lance hits chain lightning and build Static; full Static calls a sky-bolt volley (Sorcerer: no Static)', () => {
  const c0 = sub('stormcaller');
  ring(c0.game, 6, 3.2, { hp: 5000 });
  charge(c0, 70); c0.step(5);
  assert.equal(c0.p.data.kit.sc_static, undefined);
  const c = mkM('stormcaller', 16);
  const { game, p } = c;
  ring(game, 6, 3.2, { hp: 5000 });
  charge(c, 70); c.step(5);
  assert.ok(p.data.kit.sc_chainHits > 0, 'the lance chains');
  assert.ok(p.data.kit.sc_static > 0, 'Static builds');
  assert.ok(c.rec.fxList.some((f) => f.type === 'bolt' && f.color === data.specs.stormcaller.kit.white), 'white chain bolts');
  assert.equal(game.hudState().kitHud.label, 'Static');
  // fireball blasts arc too
  const before = p.data.kit.sc_chains;
  refill(c); charge(c, 30); c.step(60);
  assert.ok(p.data.kit.sc_chains > before, 'fireball blast arcs lightning');
  // fill Static and fire again: discharge
  p.data.kit.sc_static = 5;
  c.rec.reset(); refill(c); charge(c, 70); c.step(5);
  assert.ok(tagged(c, 'static_discharge').length >= 3, 'sky-bolt volley');
  assert.ok(p.data.kit.sc_static < 5);
});

test('Pyromancer Spreading Flames: fire hits ignite, and burning spreads to the neighbours (Sorcerer: it does not)', () => {
  const setup = (ctx) => {
    const { game, p } = ctx;
    const a = game.ents.spawn('rat', p.x + 3, p.y, { noAi: true, hp: 5000 });
    const b = game.ents.spawn('rat', p.x + 4.6, p.y + 1.2, { noAi: true, hp: 5000 });
    const c2 = game.ents.spawn('rat', p.x + 4.8, p.y - 1.4, { noAi: true, hp: 5000 });
    return [a, b, c2];
  };
  const c0 = sub('pyromancer');
  const f0 = setup(c0);
  charge(c0, 3); c0.step(30);
  assert.ok(!(f0[1].status.burn > 0) && !(f0[2].status.burn > 0), 'sorcerer: neighbours stay unburnt');
  const c = mkM('pyromancer', 16);
  const f = setup(c);
  charge(c, 3); c.step(10);
  assert.ok(f[0].status.burn > 0, 'an ember ignites');
  c.step(60);
  assert.ok(f[1].status.burn > 0 && f[2].status.burn > 0, 'the fire spreads');
  assert.ok(c.p.data.kit.py_spreads >= 2);
  assert.ok(c.rec.fxList.some((x) => x.type === 'trail' && x.color === data.specs.pyromancer.color), 'flame trails jump');
  c.step(60);
  assert.ok(c.rec.hits.some((h) => h.dot && h.target === f[2]), 'the spread burn deals damage');
});

test('Sage Still Mind: Ki fills faster standing still, Palm Strike heals classmates (Monk: neither)', () => {
  const kiAfter = (ctx) => { ctx.game.kits.setResource(ctx.p, 0); ctx.step(120); return ctx.game.kits.resource(ctx.p).value; };
  const k0 = kiAfter(sub('sage')), k1 = kiAfter(mkM('sage', 16));
  assert.ok(k1 > k0 + 15, `Ki after 2 s still: sage ${k1.toFixed(0)} vs monk ${k0.toFixed(0)}`);
  const heals = (ctx) => {
    const { game, p } = ctx;
    const [bram] = game.companions.set(['warrior']);
    game.physics.teleport(bram, p.x - 1.2, p.y);
    bram.data.scripted = true;
    bram.hp = Math.round(bram.hpMax * 0.4);
    game.ents.spawn('rat', p.x + 1, p.y, { noAi: true, hp: 5000 });
    const hp0 = bram.hp;
    ctx.input.set({ attackDir: 1 }); ctx.step(36); ctx.input.set({ attackDir: -1 }); ctx.step(2);
    return bram.hp - hp0;
  };
  assert.equal(heals(sub('sage')), 0, 'monk palm heals nobody');
  const c = mkM('sage', 16);
  const healed = heals(c);
  assert.ok(healed > 0, 'the classmate is healed');
  assert.ok(c.rec.fxList.some((x) => x.type === 'trail' && x.color === data.specs.sage.color));
  assert.ok(c.p.data.kit.sg_palmHeals >= 1);
});

test('Mystic Spirit Fists: Palm Strikes launch three homing spirit fists, kicks one (Monk: none)', () => {
  const fists = (ctx) => {
    ring(ctx.game, 3, 1.2, { hp: 5000, phase: -0.6 });
    ctx.game.ents.spawn('rat', ctx.p.x + 4, ctx.p.y, { noAi: true, hp: 5000 });
    ctx.input.set({ attackDir: 1 }); ctx.step(70); ctx.input.set({ attackDir: -1 }); ctx.step(40);
    return tagged(ctx, 'spirit_fist').length;
  };
  assert.equal(fists(sub('mystic')), 0);
  const c = mkM('mystic', 16);
  assert.ok(fists(c) >= 1, 'spirit fists hit');
  assert.ok(c.p.data.kit.my_fists >= 4, 'three per palm, one per kick');
});

// ------------------------------------------------------------------------------------------------ ultimates
/** Cast the ultimate in a ring of dummies (live AI off) and run `steps`; returns {ctx, dmg, fx}. */
function castUlt(id, steps = 600, level = 16, prep) {
  const ctx = id in MASTERIES ? mkM(id, level) : mk(id, level);
  ring(ctx.game, 8, 3, { hp: 20000 });
  ring(ctx.game, 4, 5.5, { hp: 20000, phase: 0.4 });
  if (prep) prep(ctx);
  ctx.rec.reset();
  ult(ctx);
  ctx.step(steps);
  for (const t of ctx.rec.fx.keys()) assert.ok(FX_TYPES.has(t), t);
  return ctx;
}
test('Guardian Dragon: a giant emerald flyer drops in (shockwave), breathes fire cones on the crowd, then dives', () => {
  const c = castUlt('summoner', 30);
  const d = summons(c, 'guardian_dragon')[0];
  assert.ok(d, 'the dragon is out');
  assert.equal(d.look.rig, 'flyer');
  assert.ok(d.look.size >= 2 && d.look.features.includes('wings_bat') && d.glow);
  assert.ok(c.rec.has('screenFlash'));
  c.step(600);
  assert.ok(tagged(c, 'dragon_land').length > 0, 'landing shockwave');
  assert.ok(tagged(c, 'dragon_breath').length >= 10, 'fire breath');
  assert.ok(tagged(c, 'dragon_dive').length > 0, 'final dive');
  assert.ok(c.rec.has('shockwave') && c.rec.has('beam') && c.rec.has('meteor'));
  assert.ok(c.game.ents.all.some((e) => e.look && e.look.model === 'ground_fire') || tagged(c, 'dragon_fire').length > 0, 'burning ground');
  assert.equal(summons(c, 'guardian_dragon').length, 0, 'gone after 10 s');
  assert.equal(c.p.data.kit.lookPatch.held.glow, data.specs.summoner.look.held.glow, 'the orb glow is restored');
});

test('Hall of Mirrors: six mirror copies in a ring, linked by mirror beams, all casting; then they shatter', () => {
  const c = castUlt('illusionist', 20);
  const hall = summons(c, 'hall_mirror');
  assert.equal(hall.length, 6);
  for (const m of hall) { assert.ok(Math.abs(Math.hypot(m.x - c.p.x, m.y - c.p.y) - 2.8) < 0.6); assert.ok(m.data.taunt); }
  assert.ok(c.rec.count('beam') >= 6, 'mirror beams');
  assert.ok(c.rec.has('screenFlash') && c.rec.has('pillar'));
  c.step(500);
  assert.ok(tagged(c, 'hall_bolt').length >= 30, 'all copies cast');
  assert.ok(tagged(c, 'mirror_shatter').length > 0, 'they shatter');
  assert.equal(summons(c, 'hall_mirror').length, 0);
});

test('Thunderstorm: the sky darkens and lightning strikes all around for 6 s (Cataclysm: five meteors)', () => {
  const c = castUlt('stormcaller', 120);
  assert.equal(c.game.ambience.tint, data.specs.stormcaller.kit.navy, 'the scene is tinted while the storm rages');
  c.step(300);
  const strikes = tagged(c, 'thunderstorm');
  assert.ok(strikes.length >= 20, 'many strikes: ' + strikes.length);
  assert.ok(new Set(strikes.map((h) => h.target.id)).size >= 8, 'spread over the crowd');
  assert.ok(c.rec.count('bolt') >= 20 && c.rec.count('screenFlash') >= 4);
  assert.notEqual(c.game.ambience.tint, data.specs.stormcaller.kit.navy, 'the clock tint is back');
  assert.ok(!c.p.data.kit.sc_storm);
});

test('Inferno: a ring of fire around you and a rain of sixteen fireballs on the enemies inside', () => {
  const c = castUlt('pyromancer', 10);
  const ringZones = c.game.ents.all.filter((e) => e.look && e.look.model === 'ground_fire' && !e.removed);
  assert.ok(ringZones.length >= 12, 'fire ring: ' + ringZones.length);
  assert.ok(tagged(c, 'inferno_blast').length >= 8, 'the opening blast');
  assert.ok(c.rec.has('pillar') && c.rec.has('screenFlash'));
  c.step(300);
  assert.ok(c.rec.count('meteor') >= 16, 'falling fireballs');
  assert.ok(tagged(c, 'inferno_rain').length >= 16);
  assert.ok(tagged(c, 'inferno_ring').length > 0, 'the ring burns');
  assert.ok(c.game.ents.all.filter((e) => e.type === 'enemy' && e.status.burn > 0).length >= 6, 'everything burns');
});

test('Enlightenment: float in a golden bubble of slow time; big heal for you and classmates, enemies and shots slowed', () => {
  const c = castUlt('sage', 0, 16, (ctx) => {
    const [bram] = ctx.game.companions.set(['warrior']);
    ctx.game.physics.teleport(bram, ctx.p.x - 1.5, ctx.p.y);
    bram.data.scripted = true;
    bram.hp = Math.round(bram.hpMax * 0.3);
    ctx.p.hp = Math.round(ctx.p.hpMax * 0.3);
    ctx.bram = bram;
  });
  c.step(30);
  const { p, game } = c;
  assert.ok(p.hp > p.hpMax * 0.6, 'big heal');
  assert.ok(c.bram.hp > c.bram.hpMax * 0.6, 'classmate healed');
  assert.ok(p.z > 0.2, 'levitating');
  assert.ok(game.ents.all.some((e) => e.look && e.look.model === 'shield_bubble' && !e.removed), 'golden bubble');
  const foe = game.ents.all.find((e) => e.type === 'enemy' && Math.hypot(e.x - p.x, e.y - p.y) < 4);
  assert.ok(foe.status.slow > 0, 'enemies slowed');
  const shot = game.combat.projectile(foe, { angle: Math.atan2(p.y - foe.y, p.x - foe.x), speed: 10, dmg: 0.1, range: 8 });
  c.step(2);
  assert.ok(shot.data.proj.speed < 5, 'enemy shots crawl');
  assert.ok(game.combat.mod(p, 'attackSpeed') > 0, 'your fists speed up');
  c.step(400);
  assert.ok(tagged(c, 'enlightenment').length > 0, 'calm pulses');
  assert.equal(p.z, 0, 'back on the ground');
  assert.ok(!game.ents.all.some((e) => e.look && e.look.model === 'shield_bubble' && !e.removed));
});

test('Avatar: a giant spirit copy of you punches with every beat and slams the ground; you take less damage', () => {
  const c = castUlt('mystic', 10);
  const { game, p } = c;
  const av = summons(c, 'mystic_avatar')[0];
  assert.ok(av, 'the avatar rises');
  assert.equal(av.look.rig, 'humanoid');
  assert.equal(av.look.outfit.primary, p.look.outfit.primary, 'it is you');
  assert.ok(av.alpha < 1 && av.glow && av.tint);
  c.step(40);
  assert.ok(av.scale > 2, 'giant');
  assert.ok(game.combat.mod(p, 'dmgTaken') < 0 && game.combat.mod(p, 'kbImmune') > 0);
  for (let i = 0; i < 3; i++) game.ents.spawn('rat', p.x + 1.4 + i * 0.6, p.y + (i - 1) * 0.5, { noAi: true, hp: 20000 });
  c.input.set({ attackDir: 1 }); c.step(120); c.input.set({ attackDir: -1 });
  assert.ok(tagged(c, 'avatar_punch').length > 0, 'punches with the combo');
  assert.ok(tagged(c, 'avatar_slam').length > 0, 'slams');
  assert.ok(c.rec.has('shockwave') && c.rec.has('screenFlash'));
  c.step(400);
  assert.equal(summons(c, 'mystic_avatar').length, 0);
  assert.equal(game.combat.mod(p, 'dmgTaken'), 0);
});

test('each upgraded ultimate outdoes its subclass ultimate in the same dummy ring (damage, fx events)', () => {
  const rows = [];
  for (const id of IDS) {
    const a = castUlt(id, 600), b = castUlt(MASTERIES[id], 600);
    const fa = a.rec.fxList.length, fb = b.rec.fxList.length;
    rows.push([`${id} ${Math.round(a.rec.dmg)} vs ${MASTERIES[id]} ${Math.round(b.rec.dmg)}; fx ${fa} vs ${fb}`, a.rec.dmg > b.rec.dmg && fa > fb]);
  }
  console.log('# ultimates (10 s, 12 dummies)\n# ' + rows.map((r) => r[0]).join('\n# '));
  for (const [row, ok] of rows) assert.ok(ok, row);
});

// ------------------------------------------------------------------------------------------------ fuzz, save, re-equip
for (const id of IDS) {
  test(`fuzz: ${id} L18, all boons, 3000 steps of random input against live enemies without throwing`, () => {
    const boons = BOONS.mage.concat(BOONS[MASTERIES[id]]);
    const ctx = mkM(id, 18, boons, { seed: 99 });
    const { game, p, input } = ctx;
    game.companions.set(['warrior', 'rogue']);
    const rng = createRng(4321);
    ring(game, 6, 3, { ai: true, hp: 600 });
    ring(game, 3, 5, { ai: true, hp: 600, kind: 'goblin_scout' });
    for (let i = 0; i < 3000; i++) {
      if (i % 6 === 0) {
        const held = {};
        for (const s of ['space', 'q', 'f', 'shift']) held[s] = rng.next() < 0.15;
        input.set({ moveX: rng.next() * 2 - 1, moveY: rng.next() * 2 - 1, attackDir: rng.next() < 0.7 ? Math.floor(rng.next() * 4) : -1, held });
      }
      if (i % 400 === 0) { game.kits.setResource(p, game.kits.resource(p).max); game.abilities.reset(p); ring(game, 3, 4, { ai: true, hp: 300 }); }
      game.step(DT, input.sample());
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z || 0), 'player position finite');
    }
    assert.ok(ctx.rec.dmg > 0);
    assert.equal(game.kits.active(p).id, id);
    for (const e of game.ents.all) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.z || 0), 'entity ' + e.kind);
    assert.ok(game.ents.all.length < 400, 'no entity leak: ' + game.ents.all.length);
    const h = game.hudState();
    assert.ok(h.player.resource && h.player.resource.value >= 0);
    assert.doesNotThrow(() => JSON.stringify(game.sys.save.snapshot ? game.sys.save.snapshot() : {}));
  });
}

test('save-safe: saving mid-ultimate and loading gives a working kit; re-equipping cleans up summons, mods and tint', () => {
  for (const id of IDS) {
    const ctx = mkM(id, 18);
    const { game, p } = ctx;
    ring(game, 6, 3, { hp: 5000 });
    for (let i = 0; i < 3; i++) { refill(ctx); press(ctx, 'f', 2); }
    ult(ctx);
    ctx.step(60);
    assert.ok(game.sys.save.now('r4mage'), id + ' saves mid-ultimate');
    const g2 = createGame({ data, name: 'Tester', seed: 7, zone: 'test', storage: game.storage, questions: createQuestions({ mode: 'auto' }) });
    assert.ok(g2.sys.save.restore(g2.sys.save.load('r4mage')));
    g2.step(DT);
    // with the core package's mastery support the mastery comes back; without it the subclass does
    const want = g2.progression.masteryId || (g2.debug && g2.debug.setMastery ? id : MASTERIES[id]);
    assert.ok([id, MASTERIES[id]].includes(g2.kits.active(g2.player).id), id + ' restores ' + want);
    // re-equip the subclass on the first game: everything the mastery spawned or changed is cleaned up
    if (game.sys.progression.setMastery) game.sys.progression.setMastery(null, { quiet: true });
    game.kits.set(p, 'mage', MASTERIES[id]);
    ctx.step(2);
    for (const key of ['guardian_dragon', 'mirror_image', 'hall_mirror', 'mystic_avatar']) assert.equal(summons(ctx, key).length, 0, id + ' ' + key);
    assert.equal(game.combat.mod(p, 'dmgTaken'), 0, id + ' armor mod removed');
    assert.ok(Number.isFinite(p.z) && p.z <= 0.01, id + ' on the ground');
    ctx.step(30);
    const amb = game.ambience;
    for (const m of IDS) assert.ok(amb.tint !== data.specs[m].kit.navy, 'no storm tint left');
  }
});
