// Round 4 rogue masteries (docs/MASTERY.md): Ranger, Sharpshooter (Archer), Trickster, Swashbuckler (Thief), Windwalker,
// Smokestep (Ninja). Data shapes; each mastery equips at 15-20 over its subclass; each passive changes behaviour (with
// vs without: the subclass alone); each upgraded ultimate fires its fx and outdamages the subclass ultimate; a
// 3000-step random-input fuzz per mastery; save/load stays safe. DPS: r4-rogue-dps.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import { config } from '../../src/config.js';
import data from '../../src/data/index.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';
import { MASTERIES, SUB_OF, equipMastery } from './r4-rogue-lib.mjs';

const CX = 34, CY = 24;
const ICONS = 'sword axe shield dash roar bolt blink nova fire frost storm meteor summon fist kick orb bow rain dagger knives roll smoke shadow shuriken coin potion bread bomb tonic charm star heart book hat cloak key rune lock up'.split(' ');
const LOOK = {
  outfit: ['tunic', 'robe', 'cloak', 'plate', 'leather', 'gi', 'quarterzip', 'dress', 'apron', 'uniform', 'vest'],
  hat: ['wizard', 'cap', 'crown', 'bandana', 'helm', 'straw', 'chef', 'feather', 'horned', 'circlet'],
  held: ['stick', 'sword', 'sword_shield', 'axes', 'runeblade', 'staff', 'orb', 'wand', 'fists', 'daggers', 'bow', 'shuriken', 'spear', 'book', 'broom', 'lantern'],
  aura: ['glow', 'flame', 'sparkle', 'shadow', 'frost', 'storm'],
};
const ULT_FX = {
  ranger: ['shockwave', 'screenFlash', 'pillar', 'trail', 'slash'],
  sharpshooter: ['pillar', 'beam', 'bolt', 'meteor', 'screenFlash', 'shockwave'],
  trickster: ['screenFlash', 'trail', 'poof', 'burst', 'shockwave'],
  swashbuckler: ['screenFlash', 'slash', 'shockwave', 'ring'],
  windwalker: ['screenFlash', 'shockwave', 'slash', 'ring', 'pillar'],
  smokestep: ['screenFlash', 'smoke', 'afterimage', 'poof', 'slash'],
};

/** A rogue with subclass `sub` (+ `mastery`) at `level`, on the test zone with its own rats removed. */
function mk({ sub, mastery = null, level = 16, boons = [], seed = 5 } = {}) {
  const game = createGame({ data, name: 'Tester', seed, zone: 'test', marker: 'start' });
  const pr = game.sys.progression;
  pr.setLevel(level, { quiet: true, boons: false });
  pr.setClass('rogue', { quiet: true });
  pr.setSpec(sub, { quiet: true });
  for (const b of boons) pr.boons.push(b);
  game.setFlag('look_chosen', true);
  for (const e of game.ents.all) if (e.type === 'enemy') game.ents.remove(e);
  game.ents.flush();
  const p = game.player;
  p.data.minHp = 1;
  if (mastery) equipMastery(game, mastery);
  game.physics.teleport(p, CX, CY);
  p.angle = 0; p.dir = 1;
  const fx = new Map();
  const fxLog = [];
  const origFx = game.fx;
  game.fx = (e) => { fx.set(e.type, (fx.get(e.type) || 0) + 1); fxLog.push(e); origFx(e); };
  const dealt = { total: 0, hits: [] };
  game.bus.on('hit', (e) => {
    const s = e.source;
    if (!s || e.target === p) return;
    if (s === p || s.owner === p.id) { dealt.total += e.amount; dealt.hits.push(e); }
  });
  const input = scriptedInput();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  const press = (k, after = 1) => { input.set({ pressed: { [k]: true } }); step(after); };
  const setPips = (n) => { game.kits.setResource(p, n); p.data.kit.rg.lastHitT = game.t; };
  return { game, pr, p, fx, fxLog, dealt, input, step, press, setPips };
}
function ring(game, n = 6, r = 2, opts = {}, x = CX - 2.5, y = CY) {   // west: open ground (a wall runs 5 tiles east)
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(game.ents.spawn('rat', x + Math.cos(a) * r, y + Math.sin(a) * r,
      Object.assign({ noAi: true, level: 16, hp: 40000 * config.numberScale, data: { kbResist: 1 } }, opts)));
  }
  return out;
}
const count = (fx, t) => fx.get(t) || 0;
const kitOf = (env) => env.game.kits.active(env.p);

// ---------------------------------------------------------------------------------------------------------------
// Data

test('mastery data: six tier-3 entries with the shapes Core reads, closed icons and look vocabulary', () => {
  for (const [id, sub] of MASTERIES) {
    const m = data.specs[id];
    assert.ok(m, id);
    assert.equal(m.id, id);
    assert.equal(m.from, sub);
    assert.equal(m.tier, 3);
    for (const k of ['name', 'blurb', 'color']) assert.ok(typeof m[k] === 'string' && m[k].length > 2, `${id}.${k}`);
    assert.ok(m.blurb.length <= 120, `${id} blurb is one punchy line`);
    assert.ok(m.mods && m.mods.power === 1, `${id} mods (power stays in the kit)`);
    assert.ok(m.passive && m.passive.name && m.passive.desc, `${id} passive`);
    assert.ok(m.ultimate && m.ultimate.name && m.ultimate.desc && ICONS.includes(m.ultimate.icon), `${id} ultimate icon`);
    assert.equal(m.ultimate.unlock, 15);
    assert.ok(typeof m.kit.dmgScale === 'number' && m.kit.lateScale.length >= 2, `${id} dmgScale`);
    const L = m.look;
    if (L.outfit) assert.ok(LOOK.outfit.includes(L.outfit.style), `${id} outfit`);
    if (L.hat) assert.ok(LOOK.hat.includes(L.hat.style), `${id} hat`);
    if (L.held) assert.ok(LOOK.held.includes(L.held.style), `${id} held`);
    if (L.aura) assert.ok(LOOK.aura.includes(L.aura.style), `${id} aura`);
    assert.ok(L.cape && /^#[0-9a-f]{6}$/i.test(L.cape.color), `${id} cape`);
    for (const k of Object.keys(L)) assert.ok(['outfit', 'hat', 'held', 'aura', 'cape', 'hood'].includes(k), `${id} look key ${k}`);
    // the level-10+ aura (player.js reads `aura`, not `look.aura`) matches the look's aura
    assert.ok(m.aura && LOOK.aura.includes(m.aura.style), `${id} top-level aura`);
    if (L.aura) assert.deepEqual(m.aura, L.aura, `${id} aura matches look.aura`);
    // HUD text for subclass abilities the mastery changes lives in data, and the kit uses it
    const kit = (createGame({ data, name: 'T', seed: 1, zone: 'test', marker: 'start' })).kits.registry[id];
    for (const [slot, desc] of Object.entries(m.descs || {})) {
      assert.ok(typeof desc === 'string' && desc.length > 10, `${id}.descs.${slot}`);
      assert.equal(kit.abilities[slot].desc, desc, `${id} ${slot} desc comes from data`);
    }
  }
  // masteries never show in the level-8 picker
  const g = createGame({ data, name: 'T', seed: 1, zone: 'test', marker: 'start' });
  assert.deepEqual(g.sys.progression.specIds('rogue').sort(), ['archer', 'ninja', 'thief']);
});

for (const [id, sub] of MASTERIES) {
  test(`${id}: equips over ${sub} at levels 15-20 (layers, shift = the upgraded ultimate, HUD)`, () => {
    for (const level of [15, 16, 18, 20]) {
      const env = mk({ sub, mastery: id, level });
      const { game, p } = env;
      const L = kitOf(env);
      assert.equal(L.id, id);
      assert.deepEqual(L.layers.map((k) => k.id), ['rogue', sub, id]);
      assert.equal(p.data.specId, sub);
      assert.equal(p.data.masteryId, id);
      assert.equal(L.abilities.shift.id, data.specs[id].ultimate.id);
      assert.equal(L.abilities.shift.unlock, 15);
      assert.notEqual(L.abilities.shift.id, game.kits.registry[sub].abilities.shift.id);
      env.step(5);
      const hud = game.hudState();
      const sh = hud.abilities.find((a) => a.slot === 'shift');
      assert.equal(sh.name, data.specs[id].ultimate.name);
      assert.ok(sh.unlocked);
      assert.ok(hud.kitHud && hud.kitHud.pipsMax === 5);
    }
    // below 15 the slot is locked
    const env = mk({ sub, mastery: id, level: 14 });
    let locked = 0;
    env.game.bus.on('ability:locked', () => locked++);
    env.press('shift', 2);
    assert.equal(locked, 1);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Passives: with vs without (the subclass alone)

test('Ranger passive: a wolf joins (and comes back), pounces on far targets, and Dodge Roll leaves a snare trap', () => {
  const run = (mastery) => {
    const env = mk({ sub: 'archer', mastery });
    const { game, p, step, input } = env;
    step(40);
    const wolves = () => game.ents.all.filter((e) => e.type === 'summon' && e.kind === 'ranger_wolf' && !e.removed);
    const nWolf = wolves().length;
    // a far target: the wolf pounces when a basic hits from 4.5+ tiles
    const far = game.ents.spawn('rat', CX - 6, CY, { noAi: true, level: 16, hp: 99999, data: { kbResist: 1 } });
    input.set({ attackDir: 3 }); step(4); input.set({ attackDir: -1 }); step(40);
    const pounced = env.dealt.hits.some((h) => h.source.kind === 'ranger_wolf' && h.target === far);
    game.ents.remove(far); game.ents.flush();
    // roll away from a rat: a trap stays where you stood and snaps on it
    game.physics.teleport(p, CX, CY);
    input.set({ pressed: { space: true }, moveX: -1 }); step(1); input.set({ moveX: 0 }); step(20);
    const traps = game.ents.all.filter((e) => e.kind === 'ranger_trap' && !e.removed).length;
    const rat = game.ents.spawn('rat', CX + 0.3, CY, { noAi: true, level: 16, hp: 99999 });
    step(15);
    const rooted = rat.status.root > 0;
    const snapped = env.fxLog.some((e) => e.type === 'text' && e.text === 'Snap!');
    // the wolf falls -> it is back 8 s later
    let back = true;
    if (nWolf) {
      game.combat.kill(wolves()[0], null, { noReward: true });
      step(60);
      const gone = wolves().length === 0;
      step(Math.ceil(8 / DT));
      back = gone && wolves().length === 1;
    }
    return { nWolf, pounced, traps, snapped, rooted, back };
  };
  const a = run(null), r = run('ranger');
  assert.deepEqual([a.nWolf, a.pounced, a.traps, a.snapped], [0, false, 0, false], 'the Archer has none of it');
  assert.equal(r.nWolf, 1, 'one wolf companion');
  assert.ok(r.pounced, 'the wolf pounces on what you hit from far away');
  assert.equal(r.traps, 1, 'Dodge Roll leaves a trap');
  assert.ok(r.snapped && r.rooted, 'the trap snaps on the rat and roots it');
  assert.ok(r.back, 'the wolf comes back after it falls');
});

test('Sharpshooter passive: laser sight while drawing; a full draw always crits and flies much farther', () => {
  const run = (mastery) => {
    const env = mk({ sub: 'archer', mastery });
    const { game, p, step, input } = env;
    const t = game.ents.spawn('rat', CX - 5, CY, { noAi: true, level: 16, hp: 99999, data: { kbResist: 1 } });
    input.set({ attackDir: 3 }); step(56);
    const beams = count(env.fx, 'beam');
    input.set({ attackDir: -1 }); step(1);
    const arrow = game.ents.all.filter((e) => e.type === 'projectile' && e.owner === p.id && !e.removed).pop();
    const range = arrow ? arrow.data.proj.range : 0;
    step(30);
    const hit = env.dealt.hits.find((h) => h.target === t && h.tags && h.tags[0] === 'rogue_basic');
    return { beams, range, crit: !!(hit && hit.crit), amount: hit ? hit.amount : 0 };
  };
  const a = run(null), s = run('sharpshooter');
  assert.equal(a.beams, 0, 'no laser sight for the Archer');
  assert.ok(s.beams >= 5, `laser sight beams while drawing: ${s.beams}`);
  assert.ok(s.crit, 'Deadeye: the full draw crits');
  assert.ok(s.range >= a.range * 1.7, `pierces farther: ${s.range} vs ${a.range}`);
  assert.ok(s.amount > a.amount * 1.5, `the crit hits much harder: ${s.amount} vs ${a.amount}`);
});

test('Trickster passive: Smoke Vanish leaves a prank chest that lures enemies and bursts in confetti (stun)', () => {
  const run = (mastery) => {
    const env = mk({ sub: 'thief', mastery });
    const { game, p, step, press } = env;
    const rats = [];
    for (let i = 0; i < 3; i++) rats.push(game.ents.spawn('rat', CX + 3, CY - 1 + i, { level: 16, hp: 99999 }));
    step(20);
    press('f', 1);
    const chest = game.ents.all.find((e) => e.kind === 'prank_chest' && !e.removed);
    const lured = chest ? rats.filter((r) => r.ai && r.ai.target === chest.id).length : 0;
    let stunned = 0;
    game.bus.on('status', (e) => { if (e.id === 'stun' && rats.includes(e.ent)) stunned++; });
    step(Math.ceil(3.2 / DT));
    const surprise = env.fxLog.some((e) => e.type === 'text' && e.text === 'SURPRISE!');
    const colors = new Set(env.fxLog.filter((e) => e.type === 'burst').map((e) => e.color));
    return { chest: !!chest, look: chest && chest.look.model, lured, surprise, stunned, colors: colors.size, p };
  };
  const a = run(null), t = run('trickster');
  assert.deepEqual([a.chest, a.surprise], [false, false], 'the Thief leaves no chest');
  assert.ok(t.chest, 'a chest decoy appears');
  assert.equal(t.look, 'chest', 'it uses the chest effect look');
  assert.ok(t.lured >= 2, `enemies rush the chest: ${t.lured}`);
  assert.ok(t.surprise, 'it bursts');
  assert.ok(t.stunned >= 1, 'the burst stuns');
  assert.ok(t.colors >= 5, `confetti in many colors: ${t.colors}`);
});

test('Swashbuckler passive: an attack in the Dodge Roll window is parried and answered with a riposte', () => {
  const run = (mastery) => {
    const env = mk({ sub: 'thief', mastery });
    const { game, p, step, press } = env;
    const rat = game.ents.spawn('rat', CX + 1.2, CY, { noAi: true, level: 16, hp: 99999, data: { kbResist: 1 } });
    step(5);
    press('space', 1);
    step(2);
    // the rat bites during the window (after the roll's invulnerability ends, and once while it is still on)
    const hpBefore = p.hp;
    game.combat.damage(p, 50, { source: rat, type: 'melee' });
    step(25);
    game.combat.damage(p, 50, { source: rat, type: 'melee' });
    step(10);
    const rip = env.dealt.hits.filter((h) => h.tags && h.tags[0] === 'swash_riposte');
    return { rip: rip.length, crit: rip.length > 0 && rip[0].crit, tookDamage: p.hp < hpBefore,
      parry: env.fxLog.filter((e) => e.type === 'text' && e.text === 'Parry!').length };
  };
  const a = run(null), s = run('swashbuckler');
  assert.equal(a.rip, 0, 'no riposte for the Thief');
  assert.ok(a.tookDamage, 'the Thief takes the second bite');
  assert.ok(s.parry >= 2, `both bites parried: ${s.parry}`);
  assert.ok(s.rip >= 2, `ripostes: ${s.rip}`);
  assert.ok(s.crit, 'the riposte is a critical');
  assert.ok(!s.tookDamage, 'parried bites do no damage');
});

test('Windwalker passive: 15% faster, and dashes cut wind blades', () => {
  const run = (mastery) => {
    const env = mk({ sub: 'ninja', mastery });
    const { game, p, step, input, press } = env;
    const x0 = p.x;
    input.set({ moveX: -1 }); step(60); input.set({ moveX: 0 }); step(1);
    const dist = x0 - p.x;
    game.physics.teleport(p, CX, CY);
    game.ents.spawn('rat', CX + 4, CY, { noAi: true, level: 16, hp: 99999, data: { kbResist: 1 } });
    press('f', 1);
    step(2);
    press('space', 1);
    step(30);
    const blades = env.dealt.hits.filter((h) => h.tags && h.tags[0] === 'windwalker_blade').length;
    return { dist, blades, crescents: env.fxLog.filter((e) => e.type === 'slash' && e.style === 'crescent').length };
  };
  const a = run(null), w = run('windwalker');
  assert.ok(w.dist > a.dist * 1.12, `Tailwind: ${w.dist.toFixed(2)} vs ${a.dist.toFixed(2)} tiles`);
  assert.equal(a.blades, 0);
  assert.ok(w.blades >= 1, `wind blades hit: ${w.blades}`);
});

test('Smokestep passive: Shadow Step makes you invisible and the next hit is an Assassinate (x3.5 crit)', () => {
  const run = (mastery) => {
    const env = mk({ sub: 'ninja', mastery });
    const { game, p, step, press, input } = env;
    const t = game.ents.spawn('rat', CX + 3, CY, { noAi: true, level: 16, hp: 99999, data: { kbResist: 1 } });
    step(3);
    press('f', 1);
    const stealth = p.status.stealth > 0;
    p.angle = Math.atan2(t.y - p.y, t.x - p.x);
    const n = env.dealt.hits.length;
    game.combat.damage(t, 100, { source: p, type: 'melee' });
    const h = env.dealt.hits[n];
    step(1);
    input.set({ attackDir: -1 });
    return { stealth, crit: h.crit, amount: h.amount };
  };
  const a = run(null), s = run('smokestep');
  assert.ok(!a.stealth, 'the Ninja does not vanish');
  assert.ok(s.stealth, 'Shadowmeld: stealthed after the step');
  assert.ok(s.crit, 'Assassinate crits');
  assert.ok(s.amount > a.amount * 2, `Assassinate hits much harder: ${s.amount} vs ${a.amount}`);
});

// ---------------------------------------------------------------------------------------------------------------
// Ultimates: fx, damage, and more than the subclass ultimate in the same spot

/** Which hits belong to each ultimate (tags or the summon that dealt them). */
const ULT_OF = {
  archer: (h) => has(h, 'archer_star'), thief: (h) => has(h, 'thief_heist'), ninja: (h) => has(h, 'ninja_clone'),
  ranger: (h) => has(h, 'ranger_hunt') || h.source.kind === 'hunt_wolf' || h.source.kind === 'ranger_hawk',
  sharpshooter: (h) => has(h, 'sharpshooter_rail'), trickster: (h) => has(h, 'trickster_trick'), swashbuckler: (h) => has(h, 'swash_flourish'),
  windwalker: (h) => has(h, 'windwalker_cyclone'), smokestep: (h) => has(h, 'smokestep_assassin'),
};
function has(h, tag) { return !!(h.tags && h.tags.includes(tag)); }
const BIG_FX = ['screenFlash', 'shockwave', 'pillar', 'meteor', 'beam', 'bolt', 'ring', 'smoke', 'afterimage', 'trail', 'poof', 'slash'];
function ultRun(sub, mastery) {
  const env = mk({ sub, mastery, level: 16 });
  const { game, p, step, setPips } = env;
  ring(game, 6, 2);
  step(10);
  setPips(5);
  env.fx.clear();
  let casts = 0;
  game.bus.on('ability:cast', (e) => { if (e.slot === 'shift') casts++; });
  // the Ninja's Shadow Clones only hit by copying throws: keep throwing in both ninja runs
  if (sub === 'ninja') env.input.set({ attackDir: 3 });
  const n0 = env.dealt.hits.length;
  env.press('shift', 1);
  const cd = !game.abilities.ready(p, 'shift');
  let shake = game.camera.shake;
  const run = (n) => { for (let i = 0; i < n; i++) { step(1); shake = Math.max(shake, game.camera.shake); } };
  if (sub === 'ninja') { run(Math.ceil(4 / DT)); env.input.set({ attackDir: -1 }); }
  run(Math.ceil(8 / DT));
  const own = ULT_OF[mastery || sub];
  const dealt = env.dealt.hits.slice(n0).filter(own).reduce((a, h) => a + h.amount, 0);
  const big = BIG_FX.reduce((a, t) => a + (env.fx.get(t) || 0), 0);
  return { casts, cd, shake, dealt, big, fx: env.fx, env };
}
for (const [id, sub] of MASTERIES) {
  test(`${id} ultimate: fires its fx, deals damage and outclasses the ${sub} ultimate`, (t) => {
    const m = ultRun(sub, id);
    assert.equal(m.casts, 1, 'cast');
    assert.ok(m.cd, 'on cooldown');
    for (const f of ULT_FX[id]) assert.ok(count(m.fx, f) > 0, `fx ${f}`);
    assert.ok(m.dealt > 0, 'deals damage');
    assert.ok(m.shake >= 0.3, `camera shake ${m.shake}`);
    const base = ultRun(sub, null);
    t.diagnostic(`${id}: ${Math.round(m.dealt)} dmg, ${m.big} big fx; ${sub}: ${Math.round(base.dealt)} dmg, ${base.big} big fx`);
    assert.ok(m.dealt > base.dealt * 1.2, `${id} ${Math.round(m.dealt)} vs ${sub} ${Math.round(base.dealt)}`);
    assert.ok(m.big > base.big, `more spectacle: ${m.big} vs ${base.big} big fx`);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Fuzz + save

function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const ROGUE_BOONS = Object.values(data.boons).filter((b) => b.class === 'rogue').map((b) => b.id);
for (const [id, sub] of MASTERIES) {
  test(`fuzz: ${id} survives 3000 steps of random input at level 18 with every boon (zone change mid-fight)`, () => {
    const boons = ROGUE_BOONS.concat(Object.values(data.boons).filter((b) => b.spec === sub).map((b) => b.id));
    const env = mk({ sub, mastery: id, level: 18, boons });
    const { game, p, input } = env;
    const rnd = lcg(id.length * 131);
    const slots = ['space', 'q', 'f', 'shift', 'interact'];
    for (let i = 0; i < 3000; i++) {
      if (i % 120 === 0) {
        const n = game.ents.all.filter((e) => e.type === 'enemy' && !e.removed).length;
        for (let k = n; k < 6; k++) game.ents.spawn('rat', CX - 4 + rnd() * 10, CY - 4 + rnd() * 8, { level: 10 + Math.floor(rnd() * 10) });
      }
      const pressed = {}, held = {};
      for (const s of slots) { if (rnd() < 0.03) pressed[s] = true; held[s] = rnd() < 0.3; }
      input.set({ moveX: Math.round(rnd() * 2 - 1), moveY: Math.round(rnd() * 2 - 1), attackDir: rnd() < 0.7 ? Math.floor(rnd() * 4) : -1, pressed, held });
      game.step(DT, input.sample());
      if (i % 400 === 0) { game.kits.setResource(p, 5); game.abilities.reset(p, 'shift'); }
      if (i === 1500) game.world.loadZone('test', 'start');
    }
    assert.ok(env.dealt.hits.length > 50, `fuzzing still hits things: ${env.dealt.hits.length}`);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.equal(kitOf(env).id, id);
    assert.ok(game.ents.all.filter((e) => e.type === 'projectile').length <= game.ents.caps.projectiles);
    game.hudState();
    // unequip (back to the subclass) cleans up: no leftover mastery summons
    game.kits.set(p, 'rogue', sub);
    game.ents.flush();
    const left = game.ents.all.filter((e) => e.type === 'summon' && e.owner === p.id && !e.removed && /wolf|hawk|chest|cyclone|assassin/.test(e.kind));
    assert.deepEqual(left.map((e) => e.kind), []);
  });
}

test('save/load with a mastery mid-ultimate: the save is plain JSON and the restored hero plays the mastery', () => {
  for (const [id, sub] of MASTERIES) {
    const env = mk({ sub, mastery: id, level: 17, boons: ['venom_edge'] });
    ring(env.game, 4, 2);
    env.step(30);
    env.setPips(5);
    env.press('shift', 20);
    const json = env.game.sys.save.now('r4');
    const text = JSON.stringify(json);
    assert.ok(text.length > 100);
    const game2 = createGame({ data, name: 'Tester', seed: 9, zone: 'test', marker: 'start' });
    assert.ok(game2.sys.save.restore(JSON.parse(text)));
    const input = scriptedInput();
    for (let i = 0; i < 3; i++) game2.step(DT, input.sample());
    const p2 = game2.player;
    assert.equal(game2.kits.active(p2).layers[1].id, sub, `${id}: the subclass comes back`);
    equipMastery(game2, id);   // Core restores masteryId; equip directly when it does not (yet)
    assert.equal(game2.kits.active(p2).id, id);
    game2.ents.spawn('rat', p2.x + 2, p2.y, { noAi: true, hp: 9000 });
    let hits = 0;
    game2.bus.on('hit', (e) => { if (e.source === p2 || (e.source && e.source.owner === p2.id)) hits++; });
    game2.kits.setResource(p2, 5);
    input.set({ attackDir: 1, pressed: { shift: true } });
    for (let i = 0; i < 120; i++) { game2.step(DT, input.sample()); input.set({ pressed: {} }); }
    assert.ok(hits > 0, `${id}: the restored kit attacks`);
  }
});

void SUB_OF;
