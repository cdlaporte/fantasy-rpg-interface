// Round 4 warrior masteries (docs/MASTERY.md): Paladin, Sentinel (knight), Warlord, Juggernaut (berserker), Spellblade,
// Runeguard (battlemage). Data, equipping at 15-20 (kits.set; the core's setMastery when present), each passive with vs
// without the mastery, each upgraded ultimate's fx / damage / effects, a 3000-step random-input fuzz, save safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import data from '../../src/data/index.js';
import { DT, makeInputState } from '../../src/contracts.js';
import { mk, dummy } from './kit-warrior.test.mjs';
import { PARENT, MASTERIES, mkM } from './r4-warrior-lib.mjs';

const ICONS = 'sword axe shield dash roar bolt blink nova fire frost storm meteor summon fist kick orb bow rain dagger knives roll smoke shadow shuriken coin potion bread bomb tonic charm star heart book hat cloak key rune lock up'.split(' ');
const OUTFITS = ['tunic', 'robe', 'cloak', 'plate', 'leather', 'gi', 'quarterzip', 'dress', 'apron', 'uniform', 'vest'];
const HATS = ['wizard', 'cap', 'crown', 'bandana', 'helm', 'straw', 'chef', 'feather', 'horned', 'circlet'];
const HELD = ['stick', 'sword', 'sword_shield', 'axes', 'runeblade', 'staff', 'orb', 'wand', 'fists', 'daggers', 'bow', 'shuriken', 'spear', 'book', 'broom', 'lantern'];
const AURAS = ['glow', 'flame', 'sparkle', 'shadow', 'frost', 'storm'];
const ULT = { paladin: 'sanctuary', sentinel: 'bulwark_fortress', warlord: 'war_banner_leap', juggernaut: 'stampede', spellblade: 'prismatic_edge', runeguard: 'rune_citadel' };
const zonesOf = (g, id) => g.game.ents.all.filter((e) => !e.removed && e.data && e.data.zone && e.data.zone.id === id);
const kindOf = (g, kind) => g.game.ents.all.filter((e) => !e.removed && e.kind === kind);
/** A melee hit on p from `src` (in front of p when p faces it). */
const hitP = (g, src, n = 10) => g.game.combat.damage(g.p, n, { source: src, type: 'melee' });

test('mastery data: six warrior masteries, tier 3 over their subclass, look vocabulary, passive, ultimate, numbers', () => {
  for (const m of MASTERIES) {
    const d = data.specs[m];
    assert.ok(d, m);
    assert.equal(d.id, m);
    assert.equal(d.from, PARENT[m]);
    assert.equal(d.tier, 3);
    assert.ok(d.name && d.blurb.length > 20 && d.blurb.length < 140, m + ' blurb');
    assert.match(d.color, /^#[0-9a-f]{6}$/);
    assert.equal(d.mods.power, 1, 'damage is tuned by balance.dmgMul');
    assert.ok(d.mods.hp >= 1 && d.mods.speed === 1);
    assert.ok(OUTFITS.includes(d.look.outfit.style) && HELD.includes(d.look.held.style), m + ' look');
    if (d.look.hat) assert.ok(HATS.includes(d.look.hat.style));
    if (d.look.aura) assert.ok(AURAS.includes(d.look.aura.style));
    assert.ok(d.passive.name && d.passive.desc.length > 20);
    assert.ok(d.ultimate.name && d.ultimate.desc.length > 20 && ICONS.includes(d.ultimate.icon), m + ' ultimate');
    assert.deepEqual(d.abilities.map((a) => [a.slot, a.id, a.unlock]), [['shift', ULT[m], 15]]);
    assert.equal(d.abilities[0].name, d.ultimate.name);
    assert.ok(ICONS.includes(d.abilities[0].icon));
    assert.ok(d.nums && d.balance.dmgMul.length === 4);
  }
  // masteries never show in the level-8 picker
  const g = mk({ ring: 0 });
  assert.deepEqual(g.pr.specIds('warrior').slice().sort(), ['battlemage', 'berserker', 'knight']);
});

test('each mastery equips at levels 15-20: class > subclass > mastery layers, masteryId, look patch, the ultimate on shift', () => {
  for (const m of MASTERIES) {
    for (const level of [15, 17, 20]) {
      const g = mkM(m, { level, ring: 4 });
      const L = g.game.kits.active(g.p);
      assert.deepEqual(L.layers.map((l) => l.id), ['warrior', PARENT[m], m]);
      assert.equal(g.p.data.masteryId, m);
      assert.equal(g.p.data.specId, PARENT[m]);
      assert.equal(L.abilities.shift.id, ULT[m]);
      assert.equal(L.abilities.shift.unlock, 15);
      assert.ok(g.game.kits.unlocked(g.p, 'shift'));
      const hud = g.game.hudState();
      assert.equal(hud.abilities[3].id, ULT[m]);
      assert.equal(hud.abilities[3].name, data.specs[m].ultimate.name);
      const look = g.p.look;
      assert.equal(look.outfit.primary, data.specs[m].look.outfit.primary, m + ' outfit');
      assert.equal(look.held.style, data.specs[m].look.held.style);
      if (data.specs[m].look.hat) assert.equal(look.hat.style, data.specs[m].look.hat.style);
      if (m !== 'spellblade') assert.equal(look.aura.style, data.specs[m].look.aura.style, m + ' aura');
      g.swing(60);
      assert.ok(g.dealt > 0, m + ' attacks');
    }
  }
  // below 15 the upgraded ultimate stays locked (teacher mode can equip early)
  const g = mkM('paladin', { level: 12, ring: 0 });
  assert.equal(g.game.kits.unlocked(g.p, 'shift'), false);
});

test('core setMastery (feature-detected): equips the mastery kit when the core package provides it', (t) => {
  const g = mk({ spec: 'knight', level: 16, ring: 0 });
  const set = g.pr.setMastery || (g.game.debug && g.game.debug.setMastery);
  if (typeof set !== 'function') { t.skip('no setMastery on this branch'); return; }
  set.call(g.pr.setMastery ? g.pr : g.game.debug, 'paladin', { quiet: true });
  g.step(2);
  assert.equal(g.game.kits.active(g.p).id, 'paladin');
});

// ---------------------------------------------------------------------------------------------------------------
// passives: with vs without the mastery

test('Paladin Dawnward: Perfect Blocks heal you and classmates; every other cleave leaves sunlight (heals, burns)', () => {
  for (const m of ['paladin', 'knight']) {
    const g = m === 'paladin' ? mkM(m, { level: 16, ring: 1, r: 1.3 }) : mk({ spec: m, level: 16, ring: 1, r: 1.3 });
    g.game.companions.set(['mage']);
    const c = g.game.companions.active[0];
    g.game.physics.teleport(c, g.p.x - 1, g.p.y);
    c.hp = Math.round(c.hpMax * 0.5);
    g.p.hp = Math.round(g.p.hpMax * 0.5);
    const c0 = c.hp, p0 = g.p.hp;
    g.p.angle = 0; g.p.dir = 1;
    g.step(1, { held: { f: true } });
    hitP(g, g.foes[0]);
    g.step(1, { held: { f: true } });
    g.step(1, { held: { f: false } });
    if (m === 'paladin') {
      assert.ok(c.hp > c0 && g.p.hp > p0, 'perfect block healed classmate and self');
      assert.equal(g.p.data.kit.pal.heals, 1);
      assert.ok(g.fxOf('beam').length >= 1 && g.fxOf('pillar').length >= 1);
    } else assert.equal(c.hp, c0, 'knight: no heal');
    g.resetCounters();
    g.swing(240);
    const patches = g.fx.list.filter((e) => e.type === 'ring' && e.color === data.specs.paladin.colors.light).length;
    if (m === 'paladin') {
      assert.ok(g.p.data.kit.pal.sunlit >= 4, 'sunlit patches: ' + g.p.data.kit.pal.sunlit);
      assert.ok(zonesOf(g, 'sunlit').length >= 1 && zonesOf(g, 'sunlit').length <= data.specs.paladin.nums.sunlit.max);
      assert.ok(patches >= 4);
      const before = g.p.hp;
      const z = zonesOf(g, 'sunlit')[0];
      g.game.physics.teleport(g.p, z.x, z.y);
      g.step(40, { attackDir: -1 });
      assert.ok(g.p.hp > before, 'standing in sunlight heals');
    } else assert.equal(zonesOf(g, 'sunlit').length, 0);
  }
});

test('Sentinel Bastion: blocks fill the meter; a full meter releases a counter shockwave (knight: nothing)', () => {
  for (const m of ['sentinel', 'knight']) {
    const g = m === 'sentinel' ? mkM(m, { level: 16, ring: 3, r: 1.4 }) : mk({ spec: m, level: 16, ring: 3, r: 1.4 });
    g.p.angle = 0; g.p.dir = 1;
    const front = g.foes[0];
    g.resetCounters();
    for (let i = 0; i < 12; i++) {
      g.step(1, { held: { f: true } });
      hitP(g, front, 40);
      g.step(20, { held: { f: true } });
      hitP(g, front, 40);
      g.step(1, { held: { f: false } });
      g.step(5);
    }
    const blue = data.specs.sentinel.colors.blue;
    const waves = g.fx.list.filter((e) => e.type === 'shockwave' && e.color === blue && e.r === data.specs.sentinel.nums.bastion.r);
    if (m === 'sentinel') {
      const sn = g.p.data.kit.snt;
      assert.ok(sn.bursts >= 2, 'bursts: ' + sn.bursts);
      assert.ok(waves.length >= 2);
      assert.ok(g.fx.list.some((e) => e.type === 'text' && e.text === 'BASTION!'));
      assert.ok(g.foes.some((f) => f.status.stun > 0 || f.hp < 5000));
      assert.match(g.game.hudState().kitHud.label, /^Bastion \d+%$/);
      g.p.data.kit.snt.bastion = 60;
      assert.equal(g.game.hudState().kitHud.stance, 'Bastion 60%', 'the attack box shows the meter');
    } else assert.equal(waves.length, 0);
  }
});

test('Warlord Rally: defeats rally you and classmates; your Rage powers up classmates (berserker: nothing)', () => {
  for (const m of ['warlord', 'berserker']) {
    const g = m === 'warlord' ? mkM(m, { level: 16, ring: 0 }) : mk({ spec: m, level: 16, ring: 0 });
    g.game.companions.set(['mage']);
    const c = g.game.companions.active[0];
    g.game.physics.teleport(c, g.p.x - 1.5, g.p.y);
    g.setRage(80);
    g.step(40, { attackDir: -1 });
    const share = g.game.combat.mod(c, 'power');
    const weak = dummy(g.game, g.p.x + 1, g.p.y, 1);
    g.step(30, { attackDir: 1 });
    assert.ok(!weak.alive || weak.removed, 'killed');
    if (m === 'warlord') {
      assert.ok(share > 0.15, 'Rage share: +' + share);
      assert.equal(g.p.data.kit.wl.rallies, 1);
      assert.ok(g.p.data.mods.some((x) => x.id === 'rally') && c.data.mods.some((x) => x.id === 'rally'), 'rallied');
      assert.ok(g.p.status.haste > 0 && c.status.haste > 0);
      assert.ok(g.fx.list.some((e) => e.type === 'text' && e.text === 'Rally!'));
    } else {
      assert.equal(share, 0);
      assert.ok(!(g.p.data.mods || []).some((x) => x.id === 'rally'));
    }
  }
});

test('Juggernaut Unstoppable Force: Rage grows size and armor; no knockback above 50 Rage; trample (berserker: none)', () => {
  for (const m of ['juggernaut', 'berserker']) {
    const g = m === 'juggernaut' ? mkM(m, { level: 16, ring: 0 }) : mk({ spec: m, level: 16, ring: 0 });
    g.setRage(10);
    g.step(30);
    const s10 = g.p.scale;
    g.setRage(90);
    g.step(60);
    const x0 = g.p.x;
    g.game.physics.push(g.p, 0, 20);
    g.step(20);
    const moved = g.p.x - x0;
    const taken = g.game.combat.mod(g.p, 'dmgTaken');
    if (m === 'juggernaut') {
      assert.ok(s10 < 1.06 && g.p.scale > 1.22, `size ${s10} -> ${g.p.scale}`);
      assert.ok(taken < -0.25, 'armor ' + taken);
      assert.ok(Math.abs(moved) < 0.05, 'no knockback: ' + moved);
      // trample: walking into an enemy hits and shoves it
      const e = dummy(g.game, g.p.x + 1.2, g.p.y, 5000);
      g.resetCounters();
      g.step(40, { moveX: 1, attackDir: -1 });
      assert.ok(g.p.data.kit.jg.tramples >= 1 && e.hp < 5000, 'trampled');
    } else {
      assert.equal(g.p.scale, 1);
      assert.ok(moved > 0.5, 'berserker is knocked back');
    }
  }
});

test('Spellblade Spellweave: Rune Shift charges three swings with the new element, then a Combo! finisher', () => {
  for (const m of ['spellblade', 'battlemage']) {
    const g = m === 'spellblade' ? mkM(m, { level: 16, ring: 6, r: 1.6 }) : mk({ spec: m, level: 16, ring: 6, r: 1.6 });
    // fire -> frost: frost charges throw ice shards
    g.press('f');
    if (m === 'spellblade') {
      assert.equal(g.p.data.kit.sb.charges, 3);
      assert.equal(g.game.hudState().kitHud.pips, 3);
      assert.equal(g.game.hudState().kitHud.stance, 'Frost x3', 'the attack box shows the charges');
      assert.ok(g.p.glow);
    }
    g.resetCounters();
    g.step(60, { attackDir: 1 });
    g.step(1, { attackDir: -1 });
    const ice = g.game.ents.all.filter((e) => e.type === 'projectile' && e.look && e.look.model === 'ice').length + g.fx.list.filter((e) => e.type === 'sparkle').length;
    if (m === 'spellblade') {
      const sb = g.p.data.kit.sb;
      assert.equal(sb.charges, 0);
      assert.equal(sb.used, 3);
      assert.equal(sb.combos, 1);
      assert.ok(g.fx.list.some((e) => e.type === 'text' && e.text === 'Combo!'));
      assert.ok(ice > 0);
      // storm next (frost -> storm): charged swings call lightning (chains)
      g.step(Math.round(1.6 / DT));
      g.press('f');
      g.resetCounters();
      g.step(40, { attackDir: 1 });
      assert.ok(g.fxOf('bolt').filter((e) => e.x2 != null).length >= 2, 'storm charges chain');
    } else {
      assert.ok(!g.fx.list.some((e) => e.type === 'text' && e.text === 'Combo!'));
    }
  }
});

test('Runeguard Rune Wards: swings drop wards that zap and protect; at most four (battlemage: none)', () => {
  for (const m of ['runeguard', 'battlemage']) {
    const g = m === 'runeguard' ? mkM(m, { level: 16, ring: 4, r: 2.2 }) : mk({ spec: m, level: 16, ring: 4, r: 2.2 });
    g.swing(300);
    g.step(60, { attackDir: -1 });
    const wards = kindOf(g, 'rune_ward');
    if (m === 'runeguard') {
      const rg = g.p.data.kit.rg;
      assert.ok(rg.dropped >= 5, 'dropped ' + rg.dropped);
      assert.ok(wards.length >= 1 && wards.length <= 4, 'wards: ' + wards.length);
      assert.ok(rg.zaps >= 3, 'zaps ' + rg.zaps);
      assert.ok(g.hits.some((h) => h.type === 'magic' && h.tags && h.tags.includes('wskill')));
      // near a ward: 15% less damage taken
      g.game.physics.teleport(g.p, wards[0].x, wards[0].y);
      g.step(2);
      assert.ok(g.game.combat.mod(g.p, 'dmgTaken') <= -0.15);
      assert.equal(g.game.hudState().kitHud.pipsMax, 4);
    } else assert.equal(wards.length, 0);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// ultimates

function ult(m, o = {}) {
  const g = mkM(m, Object.assign({ level: 16, ring: 6, r: 2.5, hp: 20000 }, o));
  g.setRage(100);
  g.resetCounters();
  g.press('shift');
  return g;
}

test('Sanctuary: a big dome (bubble), 80% less damage inside, heals, light pillars smite enemies, blinding end', () => {
  const g = ult('paladin');
  assert.deepEqual(g.casts, ['shift:sanctuary']);
  assert.ok(Math.abs(g.rage() - 50) < 0.5, 'costs 50 Rage');
  const dome = zonesOf(g, 'sanctuary')[0];
  assert.ok(dome && dome.look.model === 'shield_bubble' && dome.look.r === data.specs.paladin.nums.sanctuary.r);
  assert.ok(g.fx.types.screenFlash >= 1 && g.fx.types.pillar >= 6);
  g.p.hp = Math.round(g.p.hpMax * 0.4);
  const h0 = g.p.hp;
  g.step(30, { attackDir: -1 });
  assert.ok(g.p.hp > h0, 'heals inside');
  assert.ok(g.game.combat.mod(g.p, 'dmgTaken') <= -0.79);
  g.step(Math.round(6 / DT), { attackDir: -1 });
  const st = g.p.data.kit.pal;
  assert.equal(st.sanct, null, 'ended');
  assert.ok(g.fxOf('bolt').length >= 10 && g.dealt > 0, 'smites');
  assert.ok(g.fx.types.screenFlash >= 2 && g.fx.types.shockwave >= 2, 'end burst');
  assert.ok(g.foes.every((f) => f.hp < 20000), 'every enemy was smitten');
});

test('Bulwark Fortress: taunt, half damage, reflect every projectile, ramparts, a crash that grows with what you soaked', () => {
  const g = ult('sentinel', { ai: true, r: 3 });
  assert.deepEqual(g.casts, ['shift:bulwark_fortress']);
  const sn = g.p.data.kit.snt;
  assert.ok(sn.fort && g.p.data.taunt === true && g.p.fxTags.includes('shield'));
  assert.ok(zonesOf(g, 'fortress').length === 1);
  g.step(20);
  assert.ok(g.foes.filter((f) => f.ai && f.ai.target === g.p.id).length >= 4, 'taunted');
  const hp0 = g.p.hp;
  const dealt = hitP(g, g.foes[0], 100);
  assert.ok(dealt > 0 && dealt <= 0.55 * 100 * 10 / (10 + g.p.stats.defense) + 1, 'half damage: ' + dealt);
  assert.ok(g.p.hp < hp0);
  const shooter = dummy(g.game, g.p.x + 5, g.p.y, 5000);
  const proj = g.game.combat.projectile(shooter, { angle: Math.PI, speed: 10, range: 8, dmg: 1 });
  g.step(40);
  assert.ok(sn.fort.reflected >= 1 && proj.team === g.p.team, 'reflected');
  g.step(Math.round(6 / DT));
  assert.equal(sn.fort, null);
  assert.equal(g.p.data.taunt, false);
  assert.ok(!g.p.fxTags.includes('shield'));
  assert.equal(sn.fortEnds, 1);
  assert.ok(g.fx.types.screenFlash >= 2 && g.fx.types.meteor >= 1 && g.fxOf('pillar').length >= 8, 'towers and crash');
  assert.ok(g.dealt > 0);
});

test('War Banner: leap, gold landing, a banner that buffs friends and drums; enemies flee shaken', () => {
  const g = ult('warlord', { ring: 6, r: 3 });
  g.game.companions.set(['mage']);
  assert.deepEqual(g.casts, ['shift:war_banner_leap']);
  assert.ok(g.p.data.leap, 'leaping');
  g.step(50, { attackDir: -1 });
  const wl = g.p.data.kit.wl;
  assert.ok(wl.banner, 'planted');
  assert.equal(kindOf(g, 'warlord_banner').length, 1);
  assert.equal(kindOf(g, 'warlord_banner')[0].look.model, 'totem');
  assert.ok(wl.feared >= 1, 'feared ' + wl.feared);
  assert.ok(g.foes.some((f) => f.status.mark > 0), 'shaken (marked)');
  assert.ok(g.fx.types.screenFlash >= 1 && g.fx.list.some((e) => e.type === 'text' && e.text === 'FOR FLINKERTON!'));
  g.game.physics.teleport(g.p, wl.banner.x, wl.banner.y);
  g.step(5);
  assert.ok(g.game.combat.mod(g.p, 'power') >= 0.25 && g.game.combat.mod(g.p, 'attackSpeed') >= 0.25, 'banner buff');
  const c = g.game.companions.active[0];
  g.game.physics.teleport(c, wl.banner.x + 1, wl.banner.y);
  g.step(5);
  assert.ok(g.game.combat.mod(c, 'power') >= 0.25, 'classmate buffed');
  g.step(Math.round(8 / DT), { attackDir: -1 });
  assert.equal(wl.banner, null);
  assert.equal(kindOf(g, 'warlord_banner').length, 0);
  assert.ok(g.fxOf('shockwave').length >= 6, 'war drums');
  assert.ok(g.fxOf('pillar').filter((e) => e.color === data.specs.warlord.colors.crimson).length >= 8, 'the standard (a column of light over the banner)');
  assert.ok(g.dealt > 0);
});

test('Stampede: four invulnerable legs that bounce between enemies, plowing through everything, then a quake', () => {
  const g = ult('juggernaut', { ring: 6, r: 4 });
  assert.deepEqual(g.casts, ['shift:stampede']);
  const x0 = g.p.x, y0 = g.p.y;
  let travel = 0, px = g.p.x, py = g.p.y, invuln = true;
  for (let i = 0; i < 150; i++) {
    g.step(1, { attackDir: -1 });
    travel += Math.hypot(g.p.x - px, g.p.y - py); px = g.p.x; py = g.p.y;
    if (g.p.data.kit.jg.st && !(g.p.status.invuln > 0)) invuln = false;
  }
  const jg = g.p.data.kit.jg;
  assert.equal(jg.st, null);
  assert.equal(jg.stampedes, 1);
  assert.ok(invuln, 'invulnerable while charging');
  assert.ok(travel > 12, 'travelled ' + travel.toFixed(1));
  const struck = new Set(g.hits.map((h) => h.t.id));
  assert.ok(struck.size >= 4, 'hit ' + struck.size + ' enemies');
  assert.ok(g.fx.types.afterimage >= 8 && g.fx.types.meteor >= 6 && g.fx.types.screenFlash >= 1);
  assert.ok(g.fx.list.some((e) => e.type === 'text' && e.text === 'STAMPEDE!'));
  void x0; void y0;
});

test('Prismatic Edge: nine teleport-slashes cycling fire / frost / storm, invulnerable, then a prismatic blast', () => {
  const g = ult('spellblade', { ring: 5, r: 3.5 });
  assert.deepEqual(g.casts, ['shift:prismatic_edge']);
  assert.ok(Math.abs(g.rage() - 60) < 0.5, 'costs 40 Rage');
  const tps = [];
  let lx = g.p.x, ly = g.p.y;
  for (let i = 0; i < 120; i++) {
    g.step(1, { attackDir: -1 });
    if (Math.hypot(g.p.x - lx, g.p.y - ly) > 1) tps.push(i);
    lx = g.p.x; ly = g.p.y;
    if (g.p.data.kit.sb.edge) assert.ok(g.p.status.invuln > 0);
  }
  assert.equal(g.p.data.kit.sb.edge, null);
  assert.equal(g.p.data.kit.sb.edges, 1);
  assert.ok(tps.length >= 7, 'teleports ' + tps.length);
  const C = data.specs.battlemage.colors;
  const trails = g.fxOf('trail');
  assert.ok(trails.length >= 9);
  for (const col of [C.fire, C.frost, C.storm]) assert.ok(trails.some((e) => e.color === col), 'element ' + col);
  assert.ok(g.foes.every((f) => f.hp < 20000), 'struck everything');
  assert.ok(g.foes.some((f) => f.status.burn > 0) && g.foes.some((f) => f.status.frost > 0 || f.status.stun > 0));
  assert.ok(g.fx.list.some((e) => e.type === 'text' && e.text === 'PRISMATIC!') && g.fx.types.screenFlash >= 2);
});

test('Rune Citadel: eight wards in three elements, shield and 40% less inside, lightning walls, all detonate', () => {
  const g = ult('runeguard', { ring: 6, r: 4.5 });
  assert.deepEqual(g.casts, ['shift:rune_citadel']);
  const rg = g.p.data.kit.rg;
  assert.equal(rg.cit.wards.length, 8);
  assert.equal(kindOf(g, 'rune_ward').length, 8);
  assert.ok(g.p.status.shield > 0);
  g.step(10);
  assert.ok(g.game.combat.mod(g.p, 'dmgTaken') <= -0.4);
  g.step(Math.round(6.2 / DT), { attackDir: -1 });
  assert.equal(rg.cit, null);
  assert.equal(kindOf(g, 'rune_ward').length, 0);
  assert.equal(rg.citadels, 1);
  const walls = g.fxOf('bolt').filter((e) => e.x2 != null);
  assert.ok(walls.length >= 40, 'walls + zaps: ' + walls.length);
  assert.ok(rg.zaps >= 10 && g.dealt > 0);
  assert.ok(g.fx.types.screenFlash >= 2 && g.fxOf('pillar').length >= 16, 'cast pillars + detonation');
  const els = new Set(g.hits.map((h) => h.element));
  assert.ok(els.has('fire') && els.has('frost') && els.has('storm'), 'every element');
});

test('upgraded ultimates carry over the subclass ultimate boons (Oathkeeper, Meteor Heart, Encore)', () => {
  let g = mkM('paladin', { level: 16, ring: 0, boons: ['oathkeeper'] });
  g.setRage(100); g.press('shift');
  assert.ok(Math.abs(g.p.data.kit.pal.sanct.end - g.game.t - 8) < 0.1, 'Sanctuary +2 s');
  g = mkM('warlord', { level: 16, ring: 2, r: 3, boons: ['meteor_heart'] });
  g.press('shift'); g.step(60);
  assert.equal(zonesOf(g, 'meteor_heart').length, 1);
  g = mkM('spellblade', { level: 16, ring: 3, r: 3, boons: ['encore'] });
  g.setRage(100); g.press('shift');
  assert.equal(g.p.data.kit.sb.edge.strikes, 12);
  g = mkM('runeguard', { level: 16, ring: 3, r: 3, boons: ['encore'] });
  g.setRage(100); g.press('shift'); g.step(Math.round(7 / DT));
  assert.ok(g.fx.list.some((e) => e.type === 'text' && e.text === 'Encore!'));
});

test('ultimates differ from the subclass ultimates (distinct fx signatures)', () => {
  const sig = {};
  for (const m of MASTERIES) {
    const g = ult(m, { ring: 6, r: 3 });
    g.step(Math.round(9 / DT), { attackDir: -1 });
    sig[m] = g.fx.types;
    assert.ok(g.fx.types.screenFlash >= 1, m + ' flashes');
    assert.ok(g.dealt > 0, m + ' damages');
  }
  assert.ok(sig.paladin.bolt > 5 && sig.paladin.heal >= 1);
  assert.ok(sig.sentinel.meteor >= 1 && sig.sentinel.slash >= 4);
  assert.ok(sig.warlord.pillar >= 8 && sig.warlord.poof >= 1);
  assert.ok(sig.juggernaut.afterimage >= 8 && sig.juggernaut.trail >= 4);
  assert.ok(sig.spellblade.trail >= 9 && sig.spellblade.afterimage >= 5);
  assert.ok(sig.runeguard.bolt >= 30);
});

// ---------------------------------------------------------------------------------------------------------------

test('fuzz: 3000 steps of random input for each mastery with every warrior boon (no throw, finite state)', () => {
  const all = Object.values(data.boons).filter((b) => b.class === 'warrior' || ['knight', 'berserker', 'battlemage'].includes(b.spec)).map((b) => b.id);
  for (const m of MASTERIES) {
    const g = mkM(m, { level: 18, boons: all, ring: 6, r: 2, ai: true, hp: 400, seed: 23 });
    g.game.companions.set(['mage', 'rogue']);
    const rng = g.game.rng;
    const errs = [];
    let casts = 0, holdF = false;
    g.game.bus.on('ability:cast', (e) => { if (e.ent === g.p) casts++; });
    for (let i = 0; i < 3000; i++) {
      const r = () => rng.next();
      const inp = {
        moveX: r() < 0.3 ? 0 : r() * 2 - 1, moveY: r() < 0.3 ? 0 : r() * 2 - 1,
        attackDir: r() < 0.35 ? -1 : Math.floor(r() * 4),
        pressed: { space: r() < 0.03, q: r() < 0.03, f: r() < 0.05, shift: r() < 0.02 },
        held: { f: (holdF = r() < 0.06 ? !holdF : holdF) },
      };
      if (i % 400 === 0) { g.setRage(100); g.game.abilities.reset(g.p); }
      if (i % 500 === 250) for (let k = 0; k < 3; k++) g.game.ents.spawn('rat', g.p.x + 2 * Math.cos(k * 2), g.p.y + 2 * Math.sin(k * 2), { level: 16 });
      if (i % 700 === 350) g.game.combat.projectile(g.foes[0].removed ? g.p : g.foes[0], { angle: 0, speed: 10, range: 8, dmg: 1 });
      if (i === 1500) { const pr = g.game.sys.progression; if (pr.setMastery) pr.setMastery(null, { quiet: true }); g.game.kits.set(g.p, 'warrior', m); if (pr.setMastery) pr.setMastery(m, { quiet: true }); }   // re-equip mid-fight (ceremony / load)
      try { g.step(1, inp); } catch (e) { errs.push(e); break; }
      const p = g.p;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.hp) || !Number.isFinite(g.rage()) || !Number.isFinite(p.scale)) { errs.push(new Error('NaN at ' + i)); break; }
      if (i % 600 === 0) { g.game.frame(0.5); g.game.hudState(); }
    }
    assert.deepEqual(errs.map((e) => e.stack || String(e)), [], m);
    assert.ok(casts > 20, m + ' casts ' + casts);
    assert.ok(g.dealt > 0);
    // unequip back to the subclass cleans up
    { const pr = g.game.sys.progression; if (pr.setMastery) pr.setMastery(null, { quiet: true }); g.game.kits.set(g.p, 'warrior', PARENT[m]); }
    g.step(30);
    assert.equal(g.p.scale, 1);
    assert.ok(!kindOf(g, 'rune_ward').length && !kindOf(g, 'warlord_banner').length, m + ' cleaned up');
  }
});

test('save-safe: saving mid-ultimate and loading gives a working kit (mastery re-equipped or restored by the core)', () => {
  for (const m of MASTERIES) {
    const g = ult(m, { ring: 4, r: 2.5, hp: 5000 });
    g.step(30, { attackDir: 1 });
    const json = g.game.save.now();
    assert.ok(json && JSON.stringify(json).length > 100);
    const again = createGame({ data, name: 'Tester', seed: 7, zone: 'test', storage: g.game.storage, save: g.game.save.load('Tester') });
    const p = again.player;
    assert.equal(again.progression.specId, PARENT[m]);
    // the core package restores masteryId when it saves it; otherwise re-equip as the mastery ceremony would
    if (again.kits.active(p).id !== m) again.kits.set(p, 'warrior', m);
    assert.equal(again.kits.active(p).id, m);
    const e = again.ents.spawn('rat', p.x + 1, p.y, { noAi: true, hp: 99999 });
    let dealt = 0;
    again.bus.on('hit', (h) => { if (h.source === p) dealt += h.amount; });
    const inp = makeInputState();
    inp.attackDir = 1;
    for (let i = 0; i < 400; i++) { inp.attackPressed = i === 0 ? 1 : -1; inp.pressed.shift = i === 10; again.step(DT, inp); }
    assert.ok(dealt > 0 && e.hp < 99999, m + ' attacks after load');
    assert.ok(again.hudState().abilities[3].id === ULT[m]);
    JSON.stringify(again.save.now());
  }
});
