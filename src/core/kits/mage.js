// MAGE class kit (docs/CLASSES.md "MAGE — the glass cannon who controls space").
// Mana regenerates; Arcane Bolt (rank I) / Twin Bolts (rank II) auto-repeat while an attack key is held; Space = Blink
// (3.5 tiles in the move direction, through enemies), Q = Arcane Nova (ring + burst, knockback). The 8 class boons are
// implemented here. All numbers come from data/classdefs/mage.js (`kit`, `balance`).
// Shared helpers used by the three specs (conjurer, sorcerer, monk) are exported at the bottom of this file.
// Kit state lives in p.data.kit; class keys are prefixed `m_` (specs use `cj_`, `so_`, `mo_`).
import CLASSDEFS from '../../data/classdefs/mage.js';

const DEF = CLASSDEFS.mage;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------- data helpers
/** Raw mage class data (game.data wins, the imported module is the fallback). */
export function cdata(game) { return (game && game.data.classes && game.data.classes.mage) || DEF; }
/** Kit numbers of the class. */
export function N(game) { return cdata(game).kit || DEF.kit; }
/** Spec data (data/specs/mage.js entry). */
export function sdata(game, id) { return (game.data.specs && game.data.specs[id]) || null; }
/** Does the player own boon `id`? */
export function boon(game, id) {
  const pr = game.sys.progression;
  return !!(pr && typeof pr.hasBoon === 'function' && pr.hasBoon(id));
}
function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    const a = tab[i - 1], b = tab[i];
    if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]);
  }
  return tab[tab.length - 1][1];
}
/** Balance multiplier on outgoing damage for the player's current level (spec table wins once specialized). */
export function dmgMul(game, p) {
  const lv = game.kits.level(p);
  const sid = p.data.specId;
  const sd = sid ? sdata(game, sid) : null;
  const tab = (sd && sd.balance && sd.balance.dmgMul) || (cdata(game).balance && cdata(game).balance.dmgMul);
  if (sd && sd.balance && sd.balance.dmgMul && lv < tab[0][0]) return interp(cdata(game).balance && cdata(game).balance.dmgMul, lv);
  return interp(tab, lv);
}

// ---------------------------------------------------------------------------------------------- look patches
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function mergeInto(dst, src) {
  for (const k in src) {
    const v = src[k];
    if (isObj(v)) { if (!isObj(dst[k])) dst[k] = {}; mergeInto(dst[k], v); } else dst[k] = v;
  }
  return dst;
}
/** Set (or clear with null) one named look patch; the kit lookPatch is the merge of all of them (class first). */
export function setPatch(game, p, key, patch) {
  const k = p.data.kit;
  const ps = k.m_patches || (k.m_patches = {});
  ps[key] = patch;
  let out = null;
  for (const name in ps) if (ps[name]) out = mergeInto(out || {}, ps[name]);
  k.lookPatch = out;
  if (p === game.player && game.sys.player && game.sys.player.refreshLook) game.sys.player.refreshLook();
  else p.lookRev = (p.lookRev || 0) + 1;
}

// ---------------------------------------------------------------------------------------------- misc helpers
/** Compact `out` (from ents.inRadius) in place to the entities `p` can damage. */
export function enemiesNear(game, p, x, y, r, out) {
  const list = game.ents.inRadius(x, y, r, null, out);
  let n = 0;
  for (let i = 0; i < list.length; i++) { const e = list[i]; if (game.combat.canHit(p, e)) list[n++] = e; }
  list.length = n;
  return list;
}
/** Run `fn` at the next kit update (never inside combat loops: hooks fire mid-AoE and share Sim scratch arrays). */
export function defer(p, fn) { const k = p.data.kit; (k.m_queue || (k.m_queue = [])).push(fn); }
function runQueue(p) {
  const q = p.data.kit.m_queue;
  if (!q || !q.length) return;
  for (let i = 0; i < q.length && i < 64; i++) q[i]();
  q.length = 0;
}
export function resOf(game, p) { return game.kits.resource(p); }
export function isMana(p) { return !!(p.data.resource && p.data.resource.id === 'mana'); }

const looks = new Map();
/** Shared projectile look objects (one per model + colors + size). */
export function projLook(model, color, glow, size) {
  const key = model + '|' + color + '|' + glow + '|' + size;
  let l = looks.get(key);
  if (!l) { l = { rig: 'projectile', model, color, glow: glow || color, size: size || 1, trail: true }; looks.set(key, l); }
  return l;
}

// ---------------------------------------------------------------------------------------------- basic
/** Splitting Bolts params for a basic projectile (or null). */
export function splitFor(game, color, glow, model) {
  if (!boon(game, 'splitting_bolts')) return null;
  const s = N(game).splitting_bolts;
  return { n: s.n, arc: s.arc, dmgMul: s.dmgMul, range: s.range, look: projLook(model || 'bolt', color, glow, s.size) };
}

/** Mana Surge: at full resource, spend and fire a giant piercing bolt. Returns true when it fired. */
export function tryManaSurge(game, p, angle, color, glow, model, params) {
  if (!boon(game, 'mana_surge')) return false;
  const r = resOf(game, p);
  const s = params || N(game).mana_surge;
  if (r.max <= 0 || r.value < r.max || !game.kits.spend(p, s.cost)) return false;
  const c = color || N(game).colors.violet, g = glow || '#ffffff';
  game.abilities.use('projectile', p, {
    angle, speed: s.speed, range: s.range, dmg: s.dmg, radius: s.radius, pierce: true, type: 'magic', knockback: 4,
    look: projLook(model || 'bolt', c, g, s.size), tags: ['mana_surge'],
  });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.2, color: g, dur: 0.35 });
  game.fx({ type: 'sparkle', x: p.x + Math.cos(angle) * 0.6, y: p.y + Math.sin(angle) * 0.6, n: 14, color: c, r: 0.6 });
  game.camera.shake = Math.max(game.camera.shake, 0.15);
  game.bus.emit('sfx', { id: 'spell' });
  return true;
}

/** Arcane Bolt (rank I) / Twin Bolts (rank II). */
function fireBolt(game, p, angle, rank) {
  const n = N(game), b = n.bolt, col = n.colors;
  if (isMana(p) && tryManaSurge(game, p, angle, col.violet, '#ffffff', 'bolt')) return;
  const look = projLook('bolt', col.violet, col.cyan, b.size);
  const base = {
    angle, speed: b.speed, range: b.range, radius: b.radius, type: 'magic', knockback: b.knockback, look,
    split: splitFor(game, col.violet, col.cyan, 'bolt'), color: col.violet,
  };
  if (rank >= 2) {
    base.dmg = n.twin.dmg; base.n = 2; base.parallel = n.twin.spacing;
    game.abilities.use('multishot', p, base);
  } else {
    base.dmg = b.dmg;
    game.abilities.use('projectile', p, base);
  }
  const cx = p.x + Math.cos(angle) * 0.5, cy = p.y + Math.sin(angle) * 0.5;
  game.fx({ type: 'sparkle', x: cx, y: cy, n: rank >= 2 ? 6 : 4, color: col.cyan, r: rank >= 2 ? 0.45 : 0.3 });
}

// ---------------------------------------------------------------------------------------------- nova
/**
 * Arcane Nova at (x, y). o: {scale (radius), dmgMul, orbit (fire the Arcane Orbit orbs), gravity (allow Gravity
 * Well), color}. Frost Nova / Gravity Well apply when owned.
 */
export function nova(game, p, x, y, o) {
  const n = N(game), nv = n.nova, col = n.colors;
  const scale = (o && o.scale) || 1, dm = (o && o.dmgMul) || 1;
  const frost = boon(game, 'frost_nova');
  const fn = n.frost_nova;
  const color = (o && o.color) || (frost ? col.frost : col.violet);
  const r = nv.r * scale;
  const params = {
    x, y, r, dmg: nv.dmg * dm, knockback: nv.knockback, type: 'magic', fx: 'ring', color, shake: nv.shake * scale,
    element: frost ? 'frost' : null, tags: ['nova'],
    status: frost ? [{ stun: fn.stun }, { id: 'frost', t: fn.frostT, p: fn.frostP }] : null,
    zone: frost ? { r: fn.zoneR * scale, dur: fn.zoneDur, element: 'frost', color: col.frost, status: { slow: [0.6, fn.zoneSlow] } } : null,
    onResolve(g, hits, ax, ay) {
      g.fx({ type: 'burst', x: ax, y: ay, n: Math.round(24 * scale), color: frost ? '#e8fbff' : col.cyan, r });
      if (frost) g.fx({ type: 'sparkle', x: ax, y: ay, n: 16, color: col.frost, r: r * 0.8 });
    },
  };
  const grav = o && o.gravity && boon(game, 'gravity_well');
  if (grav) {
    const gw = n.gravity_well;
    game.combat.aoe(p, { x, y, r: gw.pullR * scale, dmg: 0, pull: true, knockback: gw.pull, fx: { type: 'ring', r: gw.pullR * scale, color: '#5b35b0', dur: gw.delay }, color: '#5b35b0' });
    game.fx({ type: 'sparkle', x, y, n: 20, color: '#5b35b0', r: gw.pullR * scale });
    params.delay = gw.delay; params.telegraph = false;
  }
  game.combat.aoe(p, params);
  if (o && o.orbit) fireOrbs(game, p);
}

// ---------------------------------------------------------------------------------------------- arcane orbit
const ORB_KIND = 'arcane_orb';
function orbLook(game) { const c = N(game).colors; return projLook('orb', c.violet, c.cyan, 0.9); }
function clearOrbs(game, p) {
  const k = p.data.kit, ids = k.m_orbs;
  if (!ids) return;
  for (let i = 0; i < ids.length; i++) { const e = game.ents.get(ids[i]); if (e && !e.removed) game.ents.remove(e); ids[i] = 0; }
}
function fireOrbs(game, p) {
  const k = p.data.kit, ids = k.m_orbs;
  if (!ids || !boon(game, 'arcane_orbit')) return;
  const ao = N(game).arcane_orbit, c = N(game).colors;
  for (let i = 0; i < ids.length; i++) {
    const e = ids[i] ? game.ents.get(ids[i]) : null;
    if (!e || e.removed) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    game.abilities.use('projectile', p, { x: e.x, y: e.y, angle: a, speed: ao.shotSpeed, range: ao.shotRange, dmg: ao.shotDmg,
      radius: 0.22, pierce: 1, type: 'magic', look: projLook('orb', c.violet, c.cyan, 1.1), anim: 'cast', tags: ['orbit'] });
    game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 6, color: c.cyan, r: 0.4 });
    game.ents.remove(e);
    ids[i] = 0;
  }
  k.m_orbRegrow = game.t + ao.regrow;
}
function updateOrbs(game, p, dt) {
  const k = p.data.kit;
  if (!boon(game, 'arcane_orbit')) { if (k.m_orbs) clearOrbs(game, p); return; }
  const ao = N(game).arcane_orbit;
  if (!k.m_orbs) { k.m_orbs = new Array(ao.n).fill(0); k.m_orbA = 0; k.m_orbRegrow = 0; k.m_orbOut = []; k.m_orbOpts = null; }
  if (!k.m_orbOpts) k.m_orbOpts = { source: p, type: 'magic', knockback: 2.5, color: N(game).colors.cyan, tags: ['orbit'] };
  k.m_orbA = (k.m_orbA + ao.spin * dt) % TAU;
  const ids = k.m_orbs;
  const regrow = game.t >= k.m_orbRegrow;
  const amount = ao.dmg * game.combat.powerOf(p);
  for (let i = 0; i < ids.length; i++) {
    let e = ids[i] ? game.ents.get(ids[i]) : null;
    if (e && e.removed) e = null;
    const a = k.m_orbA + (i * TAU) / ids.length;
    const x = p.x + Math.cos(a) * ao.radius, y = p.y + Math.sin(a) * ao.radius;
    if (!e) {
      if (!regrow) continue;
      e = game.ents.create({ kind: ORB_KIND, type: 'effect', team: p.team, owner: p.id, x, y, z: 0.7, solid: false, pushable: false,
        look: orbLook(game), data: { mageOrb: true } });
      ids[i] = e.id;
      game.fx({ type: 'poof', x, y, color: N(game).colors.violet });
    }
    e.x = x; e.y = y; e.angle = a + Math.PI / 2;
    const hits = enemiesNear(game, p, x, y, ao.touchR + 0.6, k.m_orbOut);
    for (let j = 0; j < hits.length; j++) {
      const t = hits[j];
      const dx = t.x - x, dy = t.y - y, rr = t.radius + ao.touchR;
      if (dx * dx + dy * dy > rr * rr) continue;
      if ((t.data.mageOrbT || 0) > game.t) continue;
      t.data.mageOrbT = game.t + ao.hitCd;
      game.combat.damage(t, amount, k.m_orbOpts);
    }
  }
}

// ---------------------------------------------------------------------------------------------- blink
function blinkCharges(game) { return boon(game, 'double_blink') ? N(game).double_blink.charges : 1; }

function castBlink(game, p, ctx) {
  const k = p.data.kit, n = N(game), bl = n.blink, col = n.colors;
  if (typeof k.blinkOverride === 'function' && k.blinkOverride(game, p, ctx)) { spendCharge(game, p); return undefined; }
  const r = game.abilities.use('blink', p, { angle: ctx.moveAngle, dist: bl.dist, invuln: bl.invuln, color: col.violet });
  if (!r) return false;
  game.fx({ type: 'sparkle', x: r.x0, y: r.y0, n: 10, color: col.cyan, r: 0.7 });
  game.fx({ type: 'sparkle', x: r.x, y: r.y, n: 10, color: col.cyan, r: 0.7 });
  game.ents.setAnim(p, 'cast', 0.15);
  if (boon(game, 'blink_burst')) {
    const bb = n.blink_burst;
    nova(game, p, r.x0, r.y0, { scale: bb.r / n.nova.r, dmgMul: bb.dmgMul });
  }
  if (boon(game, 'phase_shift')) {
    const ps = n.phase_shift;
    const dx = r.x - r.x0, dy = r.y - r.y0, len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.2) {
      game.combat.aoe(p, { x: r.x0, y: r.y0, shape: 'line', angle: Math.atan2(dy, dx), len, w: ps.w, dmg: ps.dmg, knockback: 1, type: 'magic',
        status: { id: 'mark', t: ps.markT, p: 0.3 }, color: col.cyan, tags: ['phase_shift'],
        fx: { type: 'trail', x: r.x0, y: r.y0, x2: r.x, y2: r.y, color: col.cyan } });
    }
  }
  spendCharge(game, p);
  return undefined;
}
function spendCharge(game, p) {
  const k = p.data.kit;
  if (blinkCharges(game) <= 1) return;
  if (k.m_charges == null) k.m_charges = blinkCharges(game);
  k.m_charges = Math.max(0, k.m_charges - 1);
  if (!(k.m_recharge > 0)) k.m_recharge = N(game).blink.cd;
}
function updateCharges(game, p, dt) {
  const k = p.data.kit;
  const max = blinkCharges(game);
  if (max <= 1) { k.m_charges = null; return; }
  if (k.m_charges == null) { k.m_charges = max; k.m_recharge = 0; }
  if (k.m_charges < max) {
    k.m_recharge -= dt;
    if (k.m_recharge <= 0) {
      k.m_charges++;
      k.m_recharge = k.m_charges < max ? N(game).blink.cd : 0;
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 6, color: N(game).colors.cyan, r: 0.5 });
    }
  }
  if (k.m_charges > 0) game.abilities.reset(p, 'space');
  else {
    const rec = p.data.cd && p.data.cd.space;
    if (rec) { rec.until = game.t + k.m_recharge; rec.dur = N(game).blink.cd; }
  }
}

// ---------------------------------------------------------------------------------------------- the kit
const kit = {
  id: 'mage',
  parent: null,
  resource: DEF.kit.resource,
  basicMode: 'auto',
  aimRange(game) { return N(game).bolt.range; },     // round 2: light aim assist (kits/index.js)
  interval(game) { return N(game).bolt.interval; },
  basicInfo(game, p, rank) { const r = cdata(game).ranks || DEF.ranks; return rank >= 2 ? r[2] : r[1]; },

  onEquip(game, p) {
    const k = p.data.kit;
    k.m_queue = [];
    k.m_patches = {};
    k.m_charges = null; k.m_recharge = 0;
    k.m_surge = false;
  },
  onUnequip(game, p) {
    clearOrbs(game, p);
    const k = p.data.kit;
    k.m_orbs = null;
  },
  update(game, p, dt) {
    const k = p.data.kit;
    k.speedMul = 1;
    const n = N(game);
    if (isMana(p)) game.kits.gain(p, n.resource.regen * dt);
    runQueue(p);
    updateCharges(game, p, dt);
    updateOrbs(game, p, dt);
    // Mana Surge ready: the staff glows white (visible cue that the next bolt is giant).
    const surge = boon(game, 'mana_surge') && resOf(game, p).value >= resOf(game, p).max && resOf(game, p).max > 0;
    if (surge !== !!k.m_surge) {
      k.m_surge = surge;
      setPatch(game, p, 'm_surge', surge ? { held: { glow: '#ffffff' } } : null);
      if (surge) game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 10, color: '#ffffff', r: 0.6 });
    }
  },
  hud(game, p, hud) {
    const k = p.data.kit;
    if (k.m_charges != null && !p.data.specId) {
      hud.kitHud = game.kits.kitHud;
      hud.kitHud.pips = k.m_charges; hud.kitHud.pipsMax = blinkCharges(game); hud.kitHud.label = 'Blink';
    }
  },

  basic(game, p, ctx) { fireBolt(game, p, ctx.angle, ctx.rank); return undefined; },

  abilities: {
    space: {
      id: 'blink', name: 'Blink', icon: 'blink', unlock: 3,
      get cd() { return DEF.kit.blink.cd; }, get cost() { return DEF.kit.blink.cost; },
      desc: 'Teleport a few steps the way you are moving.',
      cast: castBlink,
    },
    q: {
      id: 'arcane_nova', name: 'Arcane Nova', icon: 'nova', unlock: 5,
      get cd() { return DEF.kit.nova.cd; }, get cost() { return DEF.kit.nova.cost; },
      desc: 'A blast of force that throws enemies away from you.',
      cast(game, p) {
        game.ents.setAnim(p, 'cast', 0.3);
        nova(game, p, p.x, p.y, { orbit: true, gravity: true });
        game.bus.emit('sfx', { id: 'spell' });
        return undefined;
      },
    },
  },

  hooks: {
    // Balance multiplier (see data `balance.dmgMul`) for the player's and the familiars' hits.
    onOutgoing(game, p, info) { info.amount *= dmgMul(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= dmgMul(game, p); },
  },
};

export const fireArcaneBolt = fireBolt;
export default kit;
