// ROGUE class kit (docs/CLASSES.md "ROGUE"): Combo pips (0-5, +1 per basic attack that connects, finishers spend
// all, reset after 6 s without a hit), Twin Daggers (rank I) with the Lunge (rank II), Dodge Roll (Space, the next
// basic within 1.5 s is a sure crit), Fan of Knives (Q finisher) and the 8 class boons. Numbers live in
// data.classes.rogue.kit and data.boons; this module is structure only. The spec kits (archer, thief, ninja)
// layer on top and reuse the helpers exported here. All kit state lives in p.data.kit.rg (plain values).
import classdefs from '../../data/classdefs/rogue.js';
import { DEG, angleTo } from '../math.js';

const DEF = classdefs.rogue;
const META = {};
for (const a of DEF.abilities) META[a.id] = a;

/** Tags carried by every basic attack (melee or projectile) of the rogue family; hooks key off them. */
export const TAG_BASIC = Object.freeze(['rogue_basic']);
export const TAG_FAN = Object.freeze(['rogue_fan']);
export const TAG_VENOM = Object.freeze(['rogue_venom']);
export const TAG_BOOMERANG = Object.freeze(['rogue_basic', 'rogue_boomerang']);

const LABEL_COMBO = 'Combo';
const LABEL_CRIT = 'Crit ready!';
const LABEL_FLURRY = 'Blade Flurry!';
const isEnemy = (e) => e.type === 'enemy';

// ---------- shared helpers (used by the spec kits) ----------
export const classKit = (game) => game.data.classes.rogue.kit;
export function specKit(game, p) {
  const s = p.data.specId && game.data.specs ? game.data.specs[p.data.specId] : null;
  return (s && s.kit) || null;
}
export function hasBoon(game, id) {
  const pr = game.sys.progression;
  return !!(pr && typeof pr.hasBoon === 'function' && pr.hasBoon(id));
}
export const boonData = (game, id) => (game.data.boons && game.data.boons[id]) || {};
export const rg = (p) => p.data.kit.rg;
function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    const a = tab[i - 1], b = tab[i];
    if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]);
  }
  return tab[tab.length - 1][1];
}
export function dmgScale(game, p) {
  const sk = specKit(game, p);
  const v = sk && sk.dmgScale != null ? sk.dmgScale : classKit(game).dmgScale;
  // round 3: levels 13-20 balance table (`lateScale`, 1 up to level 12; docs/notes/r3a.md)
  const late = (sk && sk.lateScale) || classKit(game).lateScale;
  return (v != null ? v : 1) * (late ? interp(late, game.kits.level(p)) : 1);
}
export function addPips(game, p, n) {
  if (!(n > 0)) return;
  game.kits.gain(p, n);
  p.data.kit.rg.lastHitT = game.t;
}
/** Spend every pip (finishers); returns how many were spent. */
export function spendPips(game, p) {
  const r = game.kits.resource(p);
  const v = Math.floor(r.value);
  game.kits.setResource(p, 0);
  if (v >= r.max && r.max > 0 && hasBoon(game, 'adrenaline_rush')) adrenaline(game, p);
  return v;
}
const ADRENALINE_MODS = { attackSpeed: 0 };
/** round 3 boon Adrenaline Rush: a 5-pip finisher makes you a blur (attack speed + haste, afterimages). */
function adrenaline(game, p) {
  const b = boonData(game, 'adrenaline_rush'), C = classKit(game).colors;
  ADRENALINE_MODS.attackSpeed = b.attackSpeed || 0.3;
  game.combat.addMod(p, 'adrenaline_rush', ADRENALINE_MODS, b.dur || 4);
  game.combat.status(p, 'haste', b.dur || 4, b.haste || 0.25);
  const s = rg(p);
  s.rushUntil = game.t + (b.dur || 4);
  s.rushes = (s.rushes || 0) + 1;
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.4, color: C.main, dur: 0.4 });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 16, r: 1, color: C.crit });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.6, text: 'Adrenaline!', style: 'info', ent: p.id });
}
export const pipsFull = (game, p) => { const r = game.kits.resource(p); return r.max > 0 && r.value >= r.max; };

/** Apply a status param ({stun: s} | {slow: [s, p]} | {id, t, p} | array of those) to one target. */
export function applyStatus(game, t, st, src) {
  if (!st) return;
  if (Array.isArray(st)) { for (let i = 0; i < st.length; i++) applyStatus(game, t, st[i], src); return; }
  if (st.id) { game.combat.status(t, st.id, st.t, st.p, src); return; }
  for (const k in st) { const v = st[k]; if (Array.isArray(v)) game.combat.status(t, k, v[0], v[1], src); else game.combat.status(t, k, v, undefined, src); }
}
/** A lingering zone whose damage and statuses only touch enemies (never town NPCs: no accidental crimes in town). */
export function enemyZone(game, src, o) {
  const amount = (o.dmg || 0) * game.combat.powerOf(src);
  const status = o.status || null, userTick = o.onTick || null;
  const dopts = { source: src, type: o.type || 'magic', dot: true, silent: !!o.silent, knockback: 0, tags: o.tags || null, element: o.element || null, color: o.color || null };
  return game.combat.zone(src, Object.assign({}, o, { dmg: 0, status: null, onTick(g, ze, list) {
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.type !== 'enemy') continue;
      if (amount > 0) g.combat.damage(t, amount, dopts);
      if (status && t.alive && !t.removed) applyStatus(g, t, status, src);
    }
    if (userTick) userTick(g, ze, list);
  } }));
}

/** Glow on the held weapon from kit state (crit ready, bow drawing, ...): only re-composes the look on change. */
export function setHeldGlow(game, p, color) {
  const k = p.data.kit;
  if (k.rgGlow === color) return;
  k.rgGlow = color;
  k.lookPatch = color ? { held: { glow: color } } : null;
  if (game.sys.player && game.sys.player.refreshLook) game.sys.player.refreshLook();
}
/** The next basic attack within `window` seconds is a guaranteed critical (roll, Shadow Step, Afterimage). */
export function grantCrit(game, p, window) {
  const s = rg(p);
  s.critUntil = Math.max(s.critUntil, game.t + window);
  setHeldGlow(game, p, classKit(game).colors.crit);
}
export function consumeCrit(game, p) {
  const s = rg(p);
  if (game.t > s.critUntil) return false;
  s.critUntil = 0;
  setHeldGlow(game, p, null);
  return true;
}
/** Volley ids: a projectile basic pays its combo pip on the first hit of its volley only. */
export function newVolley(p) { const s = rg(p); s.volley++; return s.volley; }
export function tagVolley(shots, id) {
  if (!shots) return;
  if (Array.isArray(shots)) { for (let i = 0; i < shots.length; i++) if (shots[i]) shots[i].data.rgVolley = id; }
  else shots.data.rgVolley = id;
}
/** Blade Flurry active (boon + full pips). */
export const flurryOn = (game, p) => hasBoon(game, 'blade_flurry') && pipsFull(game, p);

/** Common bookkeeping after every basic attack of the family: count, Boomerang Blade. */
export function afterBasic(game, p, angle) {
  const s = rg(p);
  s.basicCount++;
  // round 3: per-layer extension (Thief rank V Coin Storm)
  const L = game.kits.active(p);
  for (let i = 0; i < L.layers.length; i++) { const f = L.layers[i].onBasic; if (typeof f === 'function') f(game, p, angle, s.basicCount); }
  if (hasBoon(game, 'boomerang_blade')) {
    const b = boonData(game, 'boomerang_blade');
    if (s.basicCount % (b.every || 5) === 0) {
      const C = classKit(game).colors;
      const pr = game.abilities.use('projectile', p, {
        angle, model: 'knife', color: C.main, glow: C.steel, size: 1.6, speed: b.speed || 11, range: b.range || 5,
        dmg: b.coef || 0.9, returns: true, pierce: true, knockback: 1, tags: TAG_BOOMERANG, anim: 'attack',
      });
      pr.data.rgVolley = -1;
      game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: 40, r: 0.9, color: C.main, style: 'crescent' });
    }
  }
}

// ---------- rank names (HUD + rank banner) ----------
const infoCache = {};   // specId -> rank -> frozen {name, icon} (the HUD polls this at 10 Hz: no allocation after the first call)
function rankInfo(game, p, rank) {
  const sid = p.data.specId || '';
  const byRank = infoCache[sid] || (infoCache[sid] = []);
  let o = byRank[rank];
  if (o) return o;
  const sd = sid && game.data.specs ? game.data.specs[sid] : null;
  const names = Object.assign({}, DEF.ranks, game.data.classes.rogue.ranks, sd && sd.ranks);
  let best = 1;
  for (const k in names) if (+k <= rank && +k > best) best = +k;
  o = Object.freeze({ name: names[best] || names[1] || 'Twin Daggers', icon: (sd && sd.basic && sd.basic.icon) || 'dagger' });
  byRank[rank] = o;
  return o;
}

// ---------- abilities ----------
function dodgeRoll(game, p, ctx) {
  const K = classKit(game), R = K.dodgeRoll, C = K.colors;
  const a = ctx.moveAngle;
  const sx = p.x, sy = p.y;
  const strike = hasBoon(game, 'roll_strike');
  const sb = strike ? boonData(game, 'roll_strike') : null;
  const trail = hasBoon(game, 'caltrop_trail');
  game.fx({ type: 'afterimage', x: sx, y: sy, ent: p.id, color: C.main });
  game.fx({ type: 'burst', x: sx, y: sy, n: 8, r: 0.5, color: '#cfd8dc' });
  game.abilities.use('dash', p, {
    angle: a, dist: R.dist, speed: R.speed, invuln: R.invuln, through: true, color: C.main,
    dmg: strike ? sb.coef : 0, knockback: strike ? 2 : 0, hitRadius: 0.45,
    onHit: strike ? (g, t) => {
      addPips(g, p, 1);
      g.fx({ type: 'slash', x: t.x, y: t.y, angle: a, arc: 120, r: 0.8, color: C.main, style: 'dagger' });
    } : null,
    onEnd: trail ? (g, c) => {
      const b = boonData(g, 'caltrop_trail');
      const n = b.n || 3;
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0.5 : i / (n - 1);
        enemyZone(g, c, { x: sx + (c.x - sx) * f, y: sy + (c.y - sy) * f, r: b.r || 0.9, dur: b.dur || 4, tick: 0.5, caltrops: true,
          dmg: b.coef || 0.12, type: 'melee', silent: true, status: { slow: [0.6, b.slow || 0.35] }, color: '#9aa4ad' });
      }
      g.fx({ type: 'burst', x: c.x, y: c.y, n: 10, r: 0.8, color: '#9aa4ad' });
    } : null,
  });
  grantCrit(game, p, R.critWindow);
  if (hasBoon(game, 'backflip_knives')) {
    // round 3 boon: knives flung back toward where you rolled from
    const b = boonData(game, 'backflip_knives');
    game.abilities.use('multishot', p, { x: sx, y: sy, angle: a + Math.PI, n: b.n || 3, spread: b.spread || 40, model: 'knife', color: C.main,
      glow: C.steel, size: 1.1, speed: b.speed || 13, range: b.range || 5, dmg: b.coef || 0.6, knockback: 1, tags: TAG_FAN, anim: 'dash' });
    game.fx({ type: 'slash', x: sx, y: sy, angle: a + Math.PI, arc: b.spread || 40, r: 1, color: C.main, style: 'dagger' });
    rg(p).backflips = (rg(p).backflips || 0) + 1;
  }
  if (hasBoon(game, 'shadow_roll')) {
    const b = boonData(game, 'shadow_roll');
    const r = b.r || 1.8;
    enemyZone(game, p, { x: sx, y: sy, r, dur: b.dur || 3, smoke: true, tick: 0.25, status: { slow: [0.4, 0.3] } });
    game.fx({ type: 'smoke', x: sx, y: sy, r, dur: b.dur || 3 });
    game.fx({ type: 'poof', x: sx, y: sy, color: C.shadow });
    const ai = game.sys.ai;
    if (ai && ai.blind) {
      const list = game.ents.inRadius(sx, sy, r + 0.5, isEnemy, rg(p).scratch);
      for (let i = 0; i < list.length; i++) ai.blind(list[i], 1.2);
    }
  }
}

const FAN_PICK = { range: 6, mode: 'nearest', cone: 120, angle: 0, los: true };
function fanOfKnives(game, p, ctx) {
  const K = classKit(game), F = K.fan, C = K.colors;
  const pips = spendPips(game, p);
  const max = K.combo.max;
  const n = F.base + F.perPip * pips;
  const ring = pips >= max;
  const spread = Math.min(360, F.spreadMin + F.spreadPerPip * pips);
  const rico = hasBoon(game, 'ricochet_knives') ? boonData(game, 'ricochet_knives') : null;
  const quick = hasBoon(game, 'quick_hands') ? boonData(game, 'quick_hands') : null;
  // round 2: a narrow fan centers itself on the nearest enemy within 60 degrees of the facing.
  let angle = ctx.angle;
  if (!ring) {
    FAN_PICK.range = F.range; FAN_PICK.angle = angle;
    const t = game.abilities.pickTarget(p, FAN_PICK);
    if (t) { angle = Math.atan2(t.y - p.y, t.x - p.x); p.angle = angle; p.data.faceT = Math.max(p.data.faceT || 0, 0.2); }
  }
  game.abilities.use('multishot', p, {
    angle, n, spread, ring, model: 'knife', color: C.main, glow: C.steel, size: 1.1, speed: F.speed, range: F.range,
    dmg: F.coef, knockback: F.knockback, tags: TAG_FAN, anim: 'attack',
    bounce: rico ? rico.bounce || 1 : 0, bounceRange: rico ? rico.bounceRange || 4 : 4,
    onHit: quick ? (g, t) => {
      if (t.alive && !t.removed) return;
      addPips(g, p, quick.pips || 1);
      g.abilities.reduce(p, 'q', quick.cdr || 2);
      g.fx({ type: 'sparkle', x: p.x, y: p.y, n: 6, r: 0.5, color: C.main });
    } : null,
  });
  if (hasBoon(game, 'toxic_fan')) {
    // round 3 boon: a poison cloud around you (venom stacks), bigger with more pips
    const b = boonData(game, 'toxic_fan');
    const r = (b.r || 1.8) + (b.rPerPip || 0.25) * pips;
    enemyZone(game, p, { x: p.x, y: p.y, r, dur: b.dur || 3, tick: b.tick || 0.5, type: 'magic', silent: true, color: C.venom, tags: TAG_VENOM,
      status: { id: 'venom', t: 2, p: (b.dps || 0.15) * game.combat.powerOf(p) } });
    game.fx({ type: 'burst', x: p.x, y: p.y, n: 14, r, color: C.venom });
    game.fx({ type: 'ring', x: p.x, y: p.y, r, color: C.venom, dur: 0.5 });
    rg(p).clouds = (rg(p).clouds || 0) + 1;
  }
  // Bigger finisher, bigger effect.
  game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: spread, r: 1.2, color: C.main, style: ring ? 'spin' : 'dagger' });
  game.fx({ type: 'burst', x: p.x, y: p.y, n: 6 + pips * 3, r: 0.6 + pips * 0.2, color: C.main });
  if (pips >= 3) game.fx({ type: 'ring', x: p.x, y: p.y, r: 1 + pips * 0.3, color: C.teal, dur: 0.4 });
  if (ring) {
    game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 18, r: 1.6, color: C.crit });
    game.camera.shake = Math.max(game.camera.shake, 0.3);
  }
}

// ---------- the basic (Twin Daggers / Lunge; the Thief's Cutpurse Daggers use the same code) ----------
function daggers(game, p, ctx) {
  const K = classKit(game), s = rg(p), C = K.colors;
  const sk = specKit(game, p);
  const D = sk && sk.daggers ? Object.assign({}, K.daggers, sk.daggers) : K.daggers;
  const color = (sk && sk.colors && sk.colors.main) || C.main;
  if (game.t - s.lastBasicT > K.daggers.chainGap) s.chain = 0;
  s.chain++;
  s.lastBasicT = game.t;
  const crit = consumeCrit(game, p);
  const flurry = flurryOn(game, p);
  const fb = flurry ? boonData(game, 'blade_flurry') : null;
  let hits, next = D.interval;
  if (ctx.rank >= 2 && s.chain % K.lunge.every === 0) {
    const L = K.lunge;
    hits = game.abilities.use('melee_arc', p, {
      angle: ctx.angle, arc: flurry ? 360 : L.arc, range: flurry ? fb.range || 1.3 : L.range, dmg: L.coef, lunge: L.dist,
      knockback: L.knockback, crit, critChance: D.critChance, style: flurry ? 'spin' : 'dagger', color, tags: TAG_BASIC, hitStop: 0.04,
    });
    game.fx({ type: 'trail', x: p.x, y: p.y, x2: p.x + Math.cos(ctx.angle) * L.dist * 1.6, y2: p.y + Math.sin(ctx.angle) * L.dist * 1.6, color });
    game.fx({ type: 'slash', x: p.x, y: p.y, angle: ctx.angle, arc: 30, r: L.range + 0.3, color: C.steel, style: 'dagger' });
    next = L.interval;
  } else {
    // Two crossing slashes (left then right, +-0.25 rad); they land as one combined hit per target (coef x hits) so
    // small numbers do not get lost to rounding. Two slash fx, one number.
    const arc = flurry ? 360 : D.arc + 28;
    hits = game.abilities.use('melee_arc', p, {
      angle: ctx.angle, arc, range: flurry ? fb.range || 1.3 : D.range, dmg: D.coef * D.hits, fx: false,
      knockback: D.knockback, crit, critChance: D.critChance, color, tags: TAG_BASIC,
    });
    const r = flurry ? fb.range || 1.3 : D.range;
    if (flurry) game.fx({ type: 'slash', x: p.x, y: p.y, angle: ctx.angle, arc: 360, r, color, style: 'spin' });
    for (let i = 0; i < D.hits; i++) {
      game.fx({ type: 'slash', x: p.x, y: p.y, angle: ctx.angle + (i % 2 ? 0.25 : -0.25), arc: D.arc, r, color: i % 2 ? C.steel : color, style: 'dagger' });
    }
  }
  if (crit) game.fx({ type: 'sparkle', x: p.x + Math.cos(ctx.angle) * 0.6, y: p.y + Math.sin(ctx.angle) * 0.6, n: 8, r: 0.5, color: C.crit });
  if (hits.length > 0) addPips(game, p, 1);
  afterBasic(game, p, ctx.angle);
  return next;
}

export default {
  id: 'rogue', parent: null,
  resource: { id: 'combo', name: 'Combo', max: 5, color: '#58d68d', start: 0, pips: true },
  basicMode: 'auto',
  interval(game) { return classKit(game).daggers.interval; },
  basicInfo(game, p, rank) { return rankInfo(game, p, rank); },

  onEquip(game, p) {
    const K = classKit(game);
    p.data.kit.rg = { lastHitT: -99, lastBasicT: -99, chain: 0, basicCount: 0, critUntil: 0, volley: 0, paidVolley: 0, luckyT: -99, rushUntil: 0, scratch: [] };
    p.data.kit.rgGlow = null;
    const r = p.data.resource;
    if (r && r.id === 'combo') { r.max = K.combo.max; r.color = K.colors.main; r.value = Math.min(r.value, r.max); }
  },
  onUnequip(game, p) { p.data.kit.lookPatch = null; game.combat.removeMod(p, 'adrenaline_rush'); },

  update(game, p) {
    const k = p.data.kit, s = k.rg;
    k.speedMul = 1;                                   // specs multiply into this after the class layer
    if (!s) return;
    const r = p.data.resource;
    if (r && r.value > 0 && game.t - s.lastHitT > classKit(game).combo.resetAfter) {
      r.value = 0;
      game.fx({ type: 'poof', x: p.x, y: p.y, color: classKit(game).colors.shadow });
    }
    if (s.critUntil > 0 && game.t > s.critUntil) { s.critUntil = 0; setHeldGlow(game, p, null); }
    if (s.rushUntil > game.t && (game.tick % 6) === 0) game.fx({ type: 'afterimage', x: p.x, y: p.y, ent: p.id, color: classKit(game).colors.main });
  },

  hud(game, p, hud) {
    const kh = game.kits.kitHud;
    hud.kitHud = kh;
    const s = rg(p);
    kh.label = s && game.t <= s.critUntil ? LABEL_CRIT : flurryOn(game, p) ? LABEL_FLURRY : LABEL_COMBO;
  },

  basic: daggers,

  abilities: {
    space: { id: 'dodge_roll', name: META.dodge_roll.name, icon: META.dodge_roll.icon, desc: META.dodge_roll.desc,
      unlock: META.dodge_roll.unlock, cd: META.dodge_roll.cd, cast: dodgeRoll },
    q: { id: 'fan_of_knives', name: META.fan_of_knives.name, icon: META.fan_of_knives.icon, desc: META.fan_of_knives.desc,
      unlock: META.fan_of_knives.unlock, cd: META.fan_of_knives.cd, cast: fanOfKnives },
  },

  hooks: {
    // Balance: every coefficient in data is the CLASSES number; `dmgScale` (class, or the spec's) maps them onto the
    // balance-sheet DPS band. Applies to everything the rogue (and its hawk / clones / decoys) deals.
    onOutgoing(game, p, info) { if (info.source === p) info.amount *= dmgScale(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= dmgScale(game, p); },
    onHit(game, p, e) {
      const s = p.data.kit.rg;
      if (!s || e.source !== p || e.dot || !e.target || e.target === p) return;
      if (e.amount > 0) s.lastHitT = game.t;
      // Projectile basics pay one pip per volley, on its first hit.
      const pr = e.proj;
      if (pr && pr.data.rgVolley > 0 && pr.data.rgVolley !== s.paidVolley) { s.paidVolley = pr.data.rgVolley; addPips(game, p, 1); }
      const C = classKit(game).colors;
      const t = e.target;
      const basicHit = !!(e.tags && e.tags[0] === 'rogue_basic');
      if (basicHit && hasBoon(game, 'venom_edge') && t.alive && !t.removed && game.t - (t.data.rgVenomT || -9) >= (boonData(game, 'venom_edge').icd || 0.25)) {
        const b = boonData(game, 'venom_edge');
        t.data.rgVenomT = game.t;
        game.combat.status(t, 'venom', b.dur || 4, (b.dps || 0.25) * game.combat.powerOf(p), p);
        if (game.combat.stacks(t, 'venom') >= (b.burstAt || 5)) {
          game.combat.clearStatus(t, 'venom');
          game.combat.aoe(p, { x: t.x, y: t.y, r: b.burstR || 1.3, dmg: b.burstCoef || 1.6, knockback: 2, type: 'magic',
            fx: 'burst', color: C.venom, tags: TAG_VENOM });
          game.fx({ type: 'ring', x: t.x, y: t.y, r: b.burstR || 1.3, color: C.venom, dur: 0.4 });
        }
      }
      if (e.crit && hasBoon(game, 'lucky_streak') && game.t - s.luckyT >= (boonData(game, 'lucky_streak').icd || 0.8)) {
        s.luckyT = game.t;
        if (!game.abilities.ready(p, 'space')) {
          game.abilities.reset(p, 'space');
          game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 12, r: 0.8, color: '#ffe680' });
          game.fx({ type: 'text', x: p.x, y: p.y, z: 1.5, text: 'Lucky!', style: 'info', ent: p.id });
        }
      }
    },
  },
};

export { DEG, angleTo };
