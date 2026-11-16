// SUMMONER mastery (tier 3, layered over the Conjurer; docs/MASTERY.md). The bigger army.
// Passive Legion: up to five familiars, Summon Familiar (F) calls two at a time, and the order adds a Phoenix familiar
// (fire-colored `flyer` with `wings_bird` + `glow`, throws small fireballs) that bursts into flame when it falls and is
// reborn from its ashes a few seconds later. Shift = Guardian Dragon (replaces Grand Conjuration): a giant emerald `flyer`
// (`wings_bat` + `glow`, size 2.4) drops out of the sky with a shockwave, flies to the biggest crowds and breathes fire
// cones that leave burning ground, while the familiars grow and gain haste; it ends with a fiery dive.
// Numbers: data/specs/mage.js `summoner.kit`. State keys: `sm_*` in p.data.kit.
import SPECS from '../../data/specs/mage.js';
import { boon, defer, enemiesNear, sdata, setPatch } from './mage.js';
import { tintAt, tintAmountAt } from '../clock.js';

const DEF = SPECS.summoner;
const D = (game) => sdata(game, 'summoner') || DEF;
const K = (game) => D(game).kit || DEF.kit;
const CJ = (game) => (sdata(game, 'conjurer') || SPECS.conjurer).kit;
const FAMILIAR_KEY = 'familiar';
const DRAGON_KEY = 'guardian_dragon';
const BRAINS = { fox: 'ally_melee', owl: 'ally_ranged', stoneling: 'ally_tank', phoenix: 'ally_ranged' };

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
const lateMul = (game, p) => interp(D(game).balance && D(game).balance.dmgMul, game.kits.level(p));

/** Presentation mood while the ultimate runs: tint the scene light (the clock rewrites game.ambience every step, before
 *  the kits; moodEnd puts the clock's tint back at once). tintAmount stays within the contract's 0.25. */
function mood(game, color, amount) { const a = game.ambience; if (a) { a.tint = color; a.tintAmount = Math.min(0.25, amount); } }
function moodEnd(game) {
  const a = game.ambience, c = game.clock;
  if (a && c && typeof c.hour === 'number') { a.tint = tintAt(c.hour); a.tintAmount = tintAmountAt(c.hour); }
}

function maxFamiliars(game) { return K(game).max + (boon(game, 'pack_leader') ? 1 : 0); }
function familiars(game, p) { const k = p.data.kit; return game.combat.summonsOf(p, FAMILIAR_KEY, k.sm_list || (k.sm_list = [])); }

// ---------------------------------------------------------------------------------------------- familiars
function famData(game, kind) { return kind === 'phoenix' ? K(game).phoenix : CJ(game).familiars[kind]; }
function famDef(game, kind) {
  const f = famData(game, kind);
  return { id: 'familiar_' + kind, name: f.name, look: f.look, flying: !!f.flying, stats: { radius: f.radius, defense: f.defense || 0 }, attacks: [f.attack] };
}
/** Soul Link (conjurer boon) burst when a familiar ends; the Phoenix also bursts into flame and is reborn. */
function familiarGone(game, p, f, died) {
  if (p.removed || !p.data.kit) return;
  const x = f.x, y = f.y, kind = f.data.cjKind;
  if (boon(game, 'soul_link')) {
    const sl = CJ(game).soul_link, c = CJ(game).color;
    defer(p, () => {
      game.combat.aoe(p, { x, y, r: sl.burstR, dmg: sl.burstDmg, knockback: 4, type: 'magic', fx: 'burst', color: c, tags: ['soul_link'] });
      game.abilities.use('heal', p, { pct: sl.heal });
    });
  }
  if (kind !== 'phoenix' || !died) return;
  const ph = K(game).phoenix, s = K(game);
  defer(p, () => {
    game.combat.aoe(p, { x, y, r: ph.burstR, dmg: ph.burstDmg, knockback: 5, type: 'magic', element: 'fire', fx: 'burst', color: s.fire,
      tags: ['phoenix_burst'] });
    game.fx({ type: 'pillar', x, y, r: 0.8, color: s.fire, dur: 0.7 });
    game.fx({ type: 'sparkle', x, y, n: 16, color: '#ffd84a', r: 1 });
  });
  const k = p.data.kit;
  (k.sm_rebirth || (k.sm_rebirth = [])).push({ at: game.t + ph.rebirth, x, y });
  k.sm_phoenixDeaths = (k.sm_phoenixDeaths || 0) + 1;
}
function growFamiliar(game, p, f) {
  const d = K(game).dragon, left = p.data.kit.sm_dragonUntil - game.t;
  if (!(left > 0)) return;
  f.scale = d.petScale;
  f.data.smGrown = true;
  game.combat.status(f, 'haste', left, d.petHaste);
}
function summonOne(game, p, kind, x, y) {
  const s = K(game), cj = CJ(game), f = famData(game, kind);
  const color = kind === 'phoenix' ? s.fire : cj.color;
  const o = {
    def: famDef(game, kind), key: FAMILIAR_KEY, max: maxFamiliars(game), brain: BRAINS[kind] || 'ally_melee',
    powerMul: f.powerMul, hpMul: f.hpMul, speed: (p.stats.speed || 3.3) * f.speedMul, defense: f.defense || 0,
    ai: f.keepRange ? { keepRange: f.keepRange } : null, color, tags: ['familiar', kind], dist: 1.3,
    onReplace(g, old) {
      g.abilities.use('heal', p, { pct: cj.summon.replaceHeal });
      g.fx({ type: 'ring', x: old.x, y: old.y, r: 1.2, color: '#7cf07c', dur: 0.4 });
    },
    onExpire(g, ent) { familiarGone(g, p, ent, false); },
    onDeath(g, ent) { familiarGone(g, p, ent, true); },
  };
  if (x != null) { o.x = x; o.y = y; }
  const out = game.abilities.use('summon', p, o);
  const e = out && out[0];
  if (!e) return null;
  e.data.cjKind = kind;
  e.data.alwaysAwake = true;
  if (kind === 'phoenix') {
    e.glow = s.fire;
    game.fx({ type: 'pillar', x: e.x, y: e.y, r: 0.9, color: s.fire, dur: 0.7 });
    game.fx({ type: 'burst', x: e.x, y: e.y, n: 16, color: '#ffd84a', r: 0.8 });
  } else {
    game.fx({ type: 'pillar', x: e.x, y: e.y, r: 0.8, color: s.color, dur: 0.6 });
  }
  game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 10, color: s.gold, r: 0.7 });
  growFamiliar(game, p, e);
  return e;
}
function castLegion(game, p) {
  const s = K(game), k = p.data.kit, order = s.order;
  let n = 0;
  for (let i = 0; i < s.perCast; i++) {
    const kind = order[k.sm_next % order.length];
    if (!summonOne(game, p, kind)) break;
    k.sm_next++;
    n++;
  }
  if (!n) return false;
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.6, color: s.color, dur: 0.45 });
  game.ents.setAnim(p, 'cast', 0.3);
  game.bus.emit('sfx', { id: 'spell' });
  k.sm_calls = (k.sm_calls || 0) + 1;
  return undefined;
}
function updateRebirth(game, p) {
  const k = p.data.kit, q = k.sm_rebirth;
  if (!q || !q.length) return;
  for (let i = q.length - 1; i >= 0; i--) {
    if (game.t < q[i].at) continue;
    const r = q[i];
    q.splice(i, 1);
    let x = r.x, y = r.y;
    if (game.world.solidAt(x, y, true) || Math.hypot(x - p.x, y - p.y) > 12) { x = p.x; y = p.y; }
    const e = summonOne(game, p, 'phoenix', x, y);
    if (e) {
      game.fx({ type: 'text', x: e.x, y: e.y, z: 1.4, text: 'Reborn!', style: 'info' });
      game.fx({ type: 'ring', x: e.x, y: e.y, r: 1.4, color: K(game).fire, dur: 0.5 });
      k.sm_reborn = (k.sm_reborn || 0) + 1;
    }
  }
}

// ---------------------------------------------------------------------------------------------- guardian dragon
const PICK = { range: 9, mode: 'nearest', los: false };
function dragonEnt(game, p) {
  const id = p.data.kit.sm_dragon;
  const e = id ? game.ents.get(id) : null;
  return e && !e.removed && e.alive ? e : null;
}
function castDragon(game, p) {
  const s = K(game), d = s.dragon, k = p.data.kit;
  const old = dragonEnt(game, p);
  if (old) game.combat.expireSummon(old, 'replace');
  PICK.range = d.range;
  const foe = game.abilities.pickTarget(p, PICK);
  let x = p.x + Math.cos(p.angle) * 2, y = p.y + Math.sin(p.angle) * 2;
  if (foe) { const a = Math.atan2(p.y - foe.y, p.x - foe.x); x = foe.x + Math.cos(a) * 2; y = foe.y + Math.sin(a) * 2; }
  if (game.world.solidAt(x, y, true)) { x = p.x; y = p.y; }
  const out = game.abilities.use('summon', p, {
    def: { id: DRAGON_KEY, name: 'Guardian Dragon', look: d.look, flying: true, stats: { radius: 0.9, defense: 8 }, attacks: [] },
    key: DRAGON_KEY, max: 1, brain: 'none', power: p.stats.power, hp: Math.round(p.hpMax * d.hpMul), color: s.color, fx: false,
    tags: ['guardian', 'dragon'], x, y,
  });
  const e = out && out[0];
  if (!e) return false;
  e.glow = s.color;
  e.data.alwaysAwake = true; e.data.noPhysics = true; e.data.untargetable = true;
  e.solid = false; e.pushable = false;
  e.z = d.dropFrom;
  e.angle = foe ? Math.atan2(foe.y - y, foe.x - x) : p.angle;
  k.sm_dragon = e.id;
  k.sm_dragonUntil = game.t + d.dur;
  k.sm_dragonT0 = game.t;
  k.sm_landed = false;
  k.sm_breathT = d.dropT + 0.4;
  k.sm_dragonX = x; k.sm_dragonY = y;
  game.fx({ type: 'ring', x, y, r: d.landR, color: s.color, dur: d.dropT });
  game.fx({ type: 'screenFlash', color: s.color, dur: 0.3 });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.2, color: s.gold, dur: 0.8 });
  game.camera.shake = Math.max(game.camera.shake, 0.3);
  const list = familiars(game, p);
  for (let i = 0; i < list.length; i++) { growFamiliar(game, p, list[i]); game.fx({ type: 'sparkle', x: list[i].x, y: list[i].y, n: 10, color: s.gold, r: 0.6 }); }
  game.ents.setAnim(p, 'cast', 0.6);
  setPatch(game, p, 'sm_dragon', { held: { glow: '#ffffff' } });
  game.bus.emit('sfx', { id: 'spell' });
  k.sm_dragons = (k.sm_dragons || 0) + 1;
  return undefined;
}
function densest(game, p, cx, cy, range, out) {
  const k = p.data.kit;
  const list = enemiesNear(game, p, cx, cy, range, k.sm_cand || (k.sm_cand = []));
  let best = null, bn = -1;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    let n = 0;
    for (let j = 0; j < list.length; j++) { const b = list[j]; if ((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) <= 6.25) n++; }
    if (n > bn || (n === bn && best && (a.x - cx) ** 2 + (a.y - cy) ** 2 < (best.x - cx) ** 2 + (best.y - cy) ** 2)) { bn = n; best = a; }
  }
  if (!best) return null;
  out.x = best.x; out.y = best.y; out.id = best.id;
  return out;
}
function landDragon(game, p, e) {
  const s = K(game), d = s.dragon;
  game.combat.aoe(e, { x: e.x, y: e.y, r: d.landR, dmg: d.landDmg, knockback: 9, type: 'magic', fx: 'shockwave', color: s.color, shake: 0.6,
    tags: ['dragon_land'] });
  game.fx({ type: 'burst', x: e.x, y: e.y, n: 30, color: s.gold, r: d.landR });
  game.fx({ type: 'ring', x: e.x, y: e.y, r: d.landR + 1, color: s.gold, dur: 0.6 });
  game.fx({ type: 'screenFlash', color: s.gold, dur: 0.12 });
  game.camera.shake = Math.max(game.camera.shake, 0.6);
}
function breathe(game, p, e, tx, ty) {
  const s = K(game), d = s.dragon, k = p.data.kit;
  const a = Math.atan2(ty - e.y, tx - e.x);
  e.angle = a;
  const pw = game.combat.powerOf(e);
  game.combat.aoe(e, { x: e.x, y: e.y, shape: 'cone', angle: a, arc: d.breathArc, r: d.breathR, dmg: d.breathDmg, knockback: 3, type: 'magic',
    element: 'fire', status: { id: 'burn', t: d.burnT, p: d.burn * pw }, fx: false, color: s.fire, shake: 0.2, tags: ['dragon_breath'] });
  const ex = e.x + Math.cos(a) * d.breathR, ey = e.y + Math.sin(a) * d.breathR;
  game.fx({ type: 'beam', x: e.x, y: e.y, x2: ex, y2: ey, w: 1.1, color: s.fire });
  for (let i = -1; i <= 1; i++) {
    const b = a + i * (d.breathArc * Math.PI / 180) * 0.35;
    game.fx({ type: 'trail', x: e.x, y: e.y, x2: e.x + Math.cos(b) * d.breathR, y2: e.y + Math.sin(b) * d.breathR, color: i ? '#ffd84a' : s.fire });
  }
  for (let i = 1; i <= 3; i++) {
    const f = i / 3;
    game.fx({ type: 'burst', x: e.x + Math.cos(a) * d.breathR * f, y: e.y + Math.sin(a) * d.breathR * f, n: 8 + i * 3, color: i % 2 ? s.fire : '#ffd84a', r: 0.4 + f });
  }
  game.combat.zone(p, { x: tx, y: ty, r: d.fireR, dur: d.fireDur, dmg: d.fireDmg, element: 'fire', color: s.fire, tags: ['dragon_fire'] });
  game.ents.setAnim(e, 'attack', 0.4);
  k.sm_breaths = (k.sm_breaths || 0) + 1;
}
function endDragon(game, p, e) {
  const s = K(game), d = s.dragon, k = p.data.kit;
  if (e) {
    game.combat.aoe(e, { x: e.x, y: e.y, r: d.diveR, dmg: d.diveDmg, knockback: 8, type: 'magic', element: 'fire', fx: 'meteor', color: s.fire,
      shake: 0.5, tags: ['dragon_dive'] });
    game.fx({ type: 'pillar', x: e.x, y: e.y, r: 1.4, color: s.color, dur: 0.8 });
    game.fx({ type: 'burst', x: e.x, y: e.y, n: 28, color: s.gold, r: d.diveR });
    game.fx({ type: 'poof', x: e.x, y: e.y, color: s.color });
    game.combat.expireSummon(e, 'end');
  }
  k.sm_dragon = 0; k.sm_dragonUntil = 0;
  setPatch(game, p, 'sm_dragon', null);
  moodEnd(game);
  const list = familiars(game, p);
  for (let i = 0; i < list.length; i++) if (list[i].data.smGrown) { list[i].scale = 1; list[i].data.smGrown = false; }
}
function updateDragon(game, p, dt) {
  const k = p.data.kit;
  if (!k.sm_dragonUntil) return;
  const e = dragonEnt(game, p);
  if (!e || game.t >= k.sm_dragonUntil || p.data.down) { endDragon(game, p, e); return; }
  const s = K(game), d = s.dragon;
  mood(game, s.gold, 0.15);                          // warm dragon light
  const age = game.t - k.sm_dragonT0;
  if (!k.sm_landed) {
    const f = Math.min(1, age / d.dropT);
    e.z = d.dropFrom + (d.hover - d.dropFrom) * f * f;
    if (f >= 1) { k.sm_landed = true; landDragon(game, p, e); }
    return;
  }
  e.z = d.hover + Math.sin(age * 3) * 0.15;
  // fly toward the biggest crowd near the summoner (else hover beside them)
  const pt = densest(game, p, p.x, p.y, d.range, k.sm_pt || (k.sm_pt = { x: 0, y: 0, id: 0 }));
  let gx, gy;
  if (pt) {
    const a = Math.atan2(e.y - pt.y, e.x - pt.x);
    gx = pt.x + Math.cos(a) * 2.6; gy = pt.y + Math.sin(a) * 2.6;
  } else { gx = p.x - Math.cos(p.angle) * 1.6 + 1.2; gy = p.y - Math.sin(p.angle) * 1.6 - 0.6; }
  const dx = gx - e.x, dy = gy - e.y, dd = Math.sqrt(dx * dx + dy * dy);
  const step = d.speed * dt;
  if (dd > 0.05) {
    const m = Math.min(1, step / dd);
    const nx = e.x + dx * m, ny = e.y + dy * m;
    if (!game.world.solidAt(nx, ny, true)) { e.x = nx; e.y = ny; game.ents.touch(); }
    if (!pt) e.angle = Math.atan2(dy, dx);
    if (e.anim !== 'attack') game.ents.setAnim(e, 'walk', 0.2);
  }
  if (pt) e.angle = Math.atan2(pt.y - e.y, pt.x - e.x);
  k.sm_breathT -= dt;
  if (k.sm_breathT <= 0 && pt && Math.hypot(pt.x - e.x, pt.y - e.y) <= d.breathR + 0.5) {
    k.sm_breathT = d.breathEvery;
    breathe(game, p, e, pt.x, pt.y);
  }
}

// ---------------------------------------------------------------------------------------------- the kit
const summoner = {
  id: 'summoner',
  parent: 'conjurer',
  tier: 3,
  onEquip(game, p) {
    const k = p.data.kit;
    k.sm_next = 0; k.sm_list = []; k.sm_rebirth = []; k.sm_dragon = 0; k.sm_dragonUntil = 0;
    setPatch(game, p, 'ms_look', D(game).look);
  },
  onUnequip(game, p) {
    const e = dragonEnt(game, p);
    if (e) game.combat.expireSummon(e, 'unequip');
  },
  update(game, p, dt) {
    updateRebirth(game, p);
    updateDragon(game, p, dt);
  },
  hud(game, p, hud) {
    if (!hud.kitHud) return;
    hud.kitHud.pips = familiars(game, p).length;
    hud.kitHud.pipsMax = maxFamiliars(game);
    hud.kitHud.label = 'Legion';
    hud.kitHud.stance = p.data.kit.sm_dragonUntil > game.t ? 'Dragon' : hud.kitHud.stance;
  },
  abilities: {
    f: {
      id: 'legion_call', name: 'Legion Call', icon: 'summon', unlock: 8,
      get cd() { return SPECS.conjurer.kit.summon.cd; }, get cost() { return SPECS.conjurer.kit.summon.cost; },
      desc: 'Call two familiars at once (Fox, Owl, Phoenix, Stoneling). Up to five stay with you.',
      cast: castLegion,
    },
    shift: {
      id: 'guardian_dragon', name: 'Guardian Dragon', icon: 'summon', unlock: 15,
      get cd() { return DEF.kit.dragon.cd; }, get cost() { return DEF.kit.dragon.cost; },
      desc: DEF.ultimate.desc,
      isActive(game, p) { return p.data.kit.sm_dragonUntil > game.t; },
      cast: castDragon,
    },
  },
  hooks: {
    onOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
  },
};

export default summoner;
