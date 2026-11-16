// CONJURER spec kit (docs/CLASSES.md "Conjurer — the one-student army"). The pet-army commander.
// Spirit Bolt (rank III) marks targets; the familiars (Fox / Owl / Stoneling, persistent summons with their own looks and
// ally brains) swarm marked targets and deal +50% to them. Rank IV: a marked enemy that falls releases a homing spirit
// that seeks (and marks) the next enemy. F = Summon Familiar (cycles Fox -> Owl -> Stoneling, max 3, replacing the oldest
// heals you), Shift = Grand Conjuration (a giant spirit guardian stomps shockwaves for 8 s; familiars grow and gain haste).
// Numbers: data/specs/mage.js `conjurer.kit`. State keys: `cj_*` in p.data.kit.
import SPECS from '../../data/specs/mage.js';
import mage, { boon, defer, enemiesNear, nova, projLook, sdata, setPatch, splitFor, tryManaSurge, N as classN } from './mage.js';

const DEF = SPECS.conjurer;
const S = (game) => (sdata(game, 'conjurer') || DEF).kit || DEF.kit;
const FAMILIAR_KEY = 'familiar';
const GUARDIAN_KEY = 'spirit_guardian';
const BRAINS = { fox: 'ally_melee', owl: 'ally_ranged', stoneling: 'ally_tank' };

function maxFamiliars(game) { const s = S(game); return boon(game, 'pack_leader') ? s.pack_leader.max : s.summon.max; }
function familiars(game, p) { const k = p.data.kit; return game.combat.summonsOf(p, FAMILIAR_KEY, k.cj_list || (k.cj_list = [])); }

// ---------------------------------------------------------------------------------------------- marking
function onMarked(game, p, t) {
  if (!t || t.removed || !t.alive) return;
  const s = S(game);
  t.data.cjMarkBy = p.id;
  // Swarm: every familiar drops what it is doing and goes for the marked target.
  const list = familiars(game, p);
  const pack = boon(game, 'pack_leader');
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    if (f.ai) f.ai.target = t.id;
    if (pack) game.combat.status(f, 'haste', s.pack_leader.hasteT, s.pack_leader.haste);
  }
  if (boon(game, 'wild_hunt') && game.t >= (p.data.kit.cj_huntT || 0)) {
    p.data.kit.cj_huntT = game.t + s.wild_hunt.icd;
    const tid = t.id;
    defer(p, () => ghostWolf(game, p, tid));
  }
}

// ---------------------------------------------------------------------------------------------- round 3
const WOLF_LOOK = { rig: 'quadruped', size: 0.6, colors: { body: '#e8fffb', belly: '#ffffff', accent: '#3fe0c5', eye: '#3fe0c5' },
  features: ['tail_bushy', 'ears_pointy', 'mane'], hero: null };
/** Wild Hunt: a short-lived ghost wolf leaps out next to the marked enemy and goes for it. */
function ghostWolf(game, p, tid) {
  const t = game.ents.get(tid);
  if (!t || t.removed || !t.alive || p.removed) return;
  const s = S(game), w = s.wild_hunt, fox = s.familiars.fox;
  const a = game.rng.next() * Math.PI * 2;
  let x = t.x + Math.cos(a) * 1.1, y = t.y + Math.sin(a) * 1.1;
  if (game.world.solidAt(x, y)) { x = p.x; y = p.y; }
  const out = game.abilities.use('summon', p, {
    def: { id: 'ghost_wolf', name: 'Ghost Wolf', look: WOLF_LOOK, stats: { radius: 0.3 }, attacks: [fox.attack] }, key: 'ghost_wolf',
    max: w.max, ttl: w.ttl, brain: 'ally_melee', powerMul: w.powerMul, hpMul: w.hpMul, speed: (p.stats.speed || 3.3) * 1.6, x, y,
    color: s.color, tags: ['familiar', 'ghost_wolf'],
  });
  const e = out && out[0];
  if (!e) return;
  e.alpha = 0.8;
  e.glow = s.color;
  if (e.ai) e.ai.target = tid;
  game.fx({ type: 'poof', x, y, color: s.light });
  game.fx({ type: 'trail', x, y, x2: t.x, y2: t.y, color: s.color });
  const k = p.data.kit;
  k.cj_wolves = (k.cj_wolves || 0) + 1;
}
/** Spirit Totem: a healing totem where you summon (effect entity + a healing zone for you and your pets). */
function plantTotem(game, p) {
  const s = S(game), st = s.spirit_totem, k = p.data.kit;
  if (k.cj_totem && !k.cj_totem.removed) game.ents.remove(k.cj_totem);
  k.cj_totem = game.ents.create({ kind: 'spirit_totem', type: 'effect', team: p.team, owner: p.id, x: p.x, y: p.y, solid: false,
    look: { rig: 'effect', model: 'totem', color: s.color, r: 0.5 }, ttl: st.dur });
  game.combat.zone(p, { x: p.x, y: p.y, r: st.r, dur: st.dur, tick: st.tick, healAmount: Math.max(1, Math.round(p.hpMax * st.healPct)),
    color: s.color, id: 'spirit_totem' });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.7, color: s.light, dur: 0.8 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: st.r, color: s.color, dur: 0.6 });
  k.cj_totems = (k.cj_totems || 0) + 1;
}
/** Rank V Spirit Chain: the bolt's hit chains to `jumps` more enemies, marking each (deferred). */
function spiritChain(game, p, t) {
  const s = S(game), c = s.chain;
  const x = t.x, y = t.y, tid = t.id;
  defer(p, () => {
    if (p.removed) return;
    const k = p.data.kit;
    k.m_chaining = true;
    const hits = game.abilities.use('chain', p, { x, y, jumps: c.jumps, range: c.range, dmg: c.dmg, exclude: [tid], color: s.color,
      element: 'spirit', fx: 'bolt', status: { id: 'mark', t: s.spiritBolt.markT, p: s.spiritBolt.markPower },
      onHit(g, e2) { onMarked(g, p, e2); g.fx({ type: 'sparkle', x: e2.x, y: e2.y, n: 6, color: s.light, r: 0.4 }); } });
    k.m_chaining = false;
    if (hits && hits.length) k.cj_chains = (k.cj_chains || 0) + 1;
  });
}

function fireSpiritBolt(game, p, angle, rank) {
  const s = S(game), sb = s.spiritBolt, k = p.data.kit;
  if (tryManaSurge(game, p, angle, s.color, '#ffffff', 'orb')) return;
  const status = { id: 'mark', t: sb.markT, p: sb.markPower };
  game.abilities.use('projectile', p, {
    angle, speed: sb.speed, range: sb.range, dmg: sb.dmg, radius: sb.radius, type: 'magic', knockback: 1, status,
    look: projLook('orb', s.color, rank >= 5 ? '#ffffff' : s.light, rank >= 5 ? sb.size * 1.25 : sb.size), color: s.color,
    split: splitFor(game, s.color, s.light, 'orb'),
    onHit: rank >= 5 ? (g, t) => { onMarked(g, p, t); spiritChain(g, p, t); } : (g, t) => { onMarked(g, p, t); },
    tags: ['spirit_bolt'],
  });
  game.fx({ type: 'sparkle', x: p.x + Math.cos(angle) * 0.5, y: p.y + Math.sin(angle) * 0.5, n: rank >= 4 ? 7 : 5, color: s.color, r: 0.4 });
  // Echo: every familiar copies the bolt with a mini-bolt aimed at the same spot.
  if (boon(game, 'echo')) {
    const e = s.echo;
    const tx = p.x + Math.cos(angle) * 5, ty = p.y + Math.sin(angle) * 5;
    const list = familiars(game, p);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const a = Math.atan2(ty - f.y, tx - f.x);
      game.combat.projectile(f, { angle: a, speed: e.speed, range: e.range, amount: e.dmg * game.combat.powerOf(p), radius: 0.12,
        type: 'magic', knockback: 0.5, status, look: projLook('orb', s.color, '#ffffff', e.size), tags: ['echo'],
        onHit(g, t) { onMarked(g, p, t); } });
      game.fx({ type: 'sparkle', x: f.x, y: f.y, n: 4, color: s.light, r: 0.3 });
    }
    k.cj_echoes = (k.cj_echoes || 0) + list.length;
  }
}

/** Rank IV: a marked enemy fell -> a homing spirit leaves its body and seeks the next enemy. */
function releaseSpirit(game, p, dead) {
  const s = S(game), sp = s.spirit;
  const x = dead.x, y = dead.y;
  defer(p, () => {
    if (p.removed) return;
    const k = p.data.kit;
    const near = enemiesNear(game, p, x, y, sp.homingRange, k.cj_near || (k.cj_near = []));
    let best = null, bd = Infinity;
    for (let i = 0; i < near.length; i++) {
      const e = near[i];
      if (e === dead) continue;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    const a = best ? Math.atan2(best.y - y, best.x - x) : game.rng.next() * Math.PI * 2;
    game.abilities.use('projectile', p, {
      x, y, angle: a, speed: sp.speed, range: sp.range, dmg: sp.dmg, radius: 0.22, homing: sp.homing, homingRange: sp.homingRange,
      homingTarget: best ? best.id : undefined, type: 'magic', knockback: 2, anim: 'idle', sfx: 'spell',
      status: { id: 'mark', t: s.spiritBolt.markT, p: s.spiritBolt.markPower },
      look: projLook('orb', '#ffffff', s.color, sp.size), color: s.color, tags: ['soul_chase'],
      onHit(g, t) { onMarked(g, p, t); },
    });
    game.fx({ type: 'pillar', x, y, r: 0.5, color: s.color, dur: 0.5 });
    game.fx({ type: 'sparkle', x, y, n: 12, color: s.light, r: 0.7 });
    k.cj_spirits = (k.cj_spirits || 0) + 1;
  });
}
function checkSpirit(game, p, e) {
  const dead = e.ent;
  if (!dead || dead.type !== 'enemy' || game.kits.rank(p) < 4) return;
  if (!(dead.status.mark > 0)) return;
  releaseSpirit(game, p, dead);
}

// ---------------------------------------------------------------------------------------------- familiars
function soulBurst(game, p, f) {
  if (!boon(game, 'soul_link')) return;
  const sl = S(game).soul_link, s = S(game);
  const x = f.x, y = f.y;
  defer(p, () => {
    game.combat.aoe(p, { x, y, r: sl.burstR, dmg: sl.burstDmg, knockback: 4, type: 'magic', fx: 'burst', color: s.color, tags: ['soul_link'] });
    game.fx({ type: 'ring', x, y, r: sl.burstR, color: s.light, dur: 0.4 });
    game.abilities.use('heal', p, { pct: sl.heal });
    game.fx({ type: 'trail', x, y, x2: p.x, y2: p.y, color: s.color });
  });
}

function famDef(game, kind) {
  const f = S(game).familiars[kind];
  return { id: 'familiar_' + kind, name: f.name, look: f.look, flying: !!f.flying,
    stats: { radius: f.radius, defense: f.defense || 0 }, attacks: [f.attack] };
}

function summonFamiliar(game, p, kind) {
  const s = S(game), f = s.familiars[kind];
  const max = maxFamiliars(game);
  const out = game.abilities.use('summon', p, {
    def: famDef(game, kind), key: FAMILIAR_KEY, max, brain: BRAINS[kind] || 'ally_melee',
    powerMul: f.powerMul, hpMul: f.hpMul, speed: (p.stats.speed || 3.3) * f.speedMul, defense: f.defense || 0,
    ai: f.keepRange ? { keepRange: f.keepRange } : null, color: s.color, tags: ['familiar', kind], dist: 1.2,
    onReplace(g, old) {
      g.abilities.use('heal', p, { pct: s.summon.replaceHeal });
      g.fx({ type: 'ring', x: old.x, y: old.y, r: 1.2, color: '#7cf07c', dur: 0.4 });
      g.fx({ type: 'sparkle', x: old.x, y: old.y, n: 10, color: s.light, r: 0.6 });
    },
    onExpire(g, ent) { soulBurst(g, p, ent); },
    onDeath(g, ent) { soulBurst(g, p, ent); },
  });
  const e = out && out[0];
  if (e) {
    e.data.cjKind = kind;
    e.data.alwaysAwake = true;
    game.fx({ type: 'pillar', x: e.x, y: e.y, r: 0.8, color: s.color, dur: 0.6 });
    game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 12, color: s.light, r: 0.7 });
    const k = p.data.kit;
    if (k.cj_grandUntil > game.t) growFamiliar(game, p, e);
  }
  return e;
}

function growFamiliar(game, p, f) {
  const g = S(game).grand;
  f.scale = g.petScale;
  f.data.cjGrown = true;
  const left = p.data.kit.cj_grandUntil - game.t;
  game.combat.status(f, 'haste', left, g.petHaste);
  game.combat.addMod(f, 'cj_grand', { power: g.petPower }, left);
}

// ---------------------------------------------------------------------------------------------- spirit swap (Blink override)
function spiritSwap(game, p) {
  if (!boon(game, 'spirit_swap')) return false;
  const s = S(game), sw = s.spirit_swap;
  const list = familiars(game, p);
  let best = null, bd = sw.range * sw.range;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const d = (f.x - p.x) * (f.x - p.x) + (f.y - p.y) * (f.y - p.y);
    if (d < bd) { bd = d; best = f; }
  }
  if (!best) return false;
  const px = p.x, py = p.y, fx = best.x, fy = best.y;
  game.fx({ type: 'afterimage', x: px, y: py, ent: p.id, color: s.color });
  game.fx({ type: 'poof', x: px, y: py, color: s.color });
  game.fx({ type: 'poof', x: fx, y: fy, color: s.color });
  game.physics.teleport(p, fx, fy); game.physics.resolve(p);
  game.physics.teleport(best, px, py); game.physics.resolve(best);
  game.combat.status(p, 'invuln', classN(game).blink.invuln);
  game.fx({ type: 'trail', x: px, y: py, x2: fx, y2: fy, color: s.color });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 10, color: s.light, r: 0.7 });
  game.fx({ type: 'sparkle', x: best.x, y: best.y, n: 10, color: s.light, r: 0.7 });
  const scale = sw.r / classN(game).nova.r;
  nova(game, p, p.x, p.y, { scale, dmgMul: sw.dmgMul, color: s.color });
  nova(game, p, best.x, best.y, { scale, dmgMul: sw.dmgMul, color: s.color });
  game.bus.emit('sfx', { id: 'blink' });
  p.data.kit.cj_swaps = (p.data.kit.cj_swaps || 0) + 1;
  return true;
}

// ---------------------------------------------------------------------------------------------- grand conjuration
const GRAND_PICK = { range: 8, mode: 'nearest', los: true };
function castGrand(game, p) {
  const s = S(game), g = s.grand, k = p.data.kit;
  const a = p.angle;
  // round 2: the guardian appears right next to the nearest enemy (on the side facing you), else in front of you.
  let gx = p.x + Math.cos(a) * 1.4, gy = p.y + Math.sin(a) * 1.4;
  GRAND_PICK.range = g.range || 8;
  const foe = game.abilities.pickTarget(p, GRAND_PICK);
  if (foe) {
    const back = Math.atan2(p.y - foe.y, p.x - foe.x), off = (foe.radius || 0.4) + 1.0;
    const x = foe.x + Math.cos(back) * off, y = foe.y + Math.sin(back) * off;
    if (!game.world.solidAt(x, y)) { gx = x; gy = y; }
  }
  const out = game.abilities.use('summon', p, {
    def: { id: GUARDIAN_KEY, name: 'Spirit Guardian', look: g.look, stats: { radius: 0.75, defense: 6 }, attacks: [] },
    key: GUARDIAN_KEY, max: 1, ttl: g.dur, brain: 'ally_tank', attacks: [], power: p.stats.power,
    hp: Math.round(p.hpMax * g.hpMul), speed: (p.stats.speed || 3.3) * g.speedMul, color: s.color, tags: ['guardian'],
    x: gx, y: gy,
  });
  const e = out && out[0];
  if (!e) return false;
  e.glow = s.color;
  e.data.alwaysAwake = true;
  k.cj_guardian = e.id;
  k.cj_grandUntil = game.t + g.dur;
  k.cj_stompT = 0.5;
  game.fx({ type: 'pillar', x: e.x, y: e.y, r: 1.6, color: s.color, dur: 1 });
  game.fx({ type: 'shockwave', x: e.x, y: e.y, r: 3, color: s.color });
  game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 30, color: s.light, r: 2 });
  game.fx({ type: 'screenFlash', color: s.color, dur: 0.35 });
  game.camera.shake = Math.max(game.camera.shake, 0.5);
  const list = familiars(game, p);
  for (let i = 0; i < list.length; i++) {
    growFamiliar(game, p, list[i]);
    game.fx({ type: 'sparkle', x: list[i].x, y: list[i].y, n: 10, color: s.color, r: 0.6 });
  }
  game.ents.setAnim(p, 'cast', 0.5);
  setPatch(game, p, 'cj_grand', { held: { glow: '#ffffff' } });   // the orb blazes white while the guardian is out
  game.bus.emit('sfx', { id: 'spell' });
  return undefined;
}
function updateGrand(game, p, dt) {
  const k = p.data.kit, s = S(game), g = s.grand;
  const active = k.cj_grandUntil > game.t;
  const list = familiars(game, p);
  if (!active) {
    if (k.cj_grandUntil) {
      k.cj_grandUntil = 0;
      setPatch(game, p, 'cj_grand', null);
      for (let i = 0; i < list.length; i++) if (list[i].data.cjGrown) { list[i].scale = 1; list[i].data.cjGrown = false; }
    }
    return;
  }
  const gd = k.cj_guardian ? game.ents.get(k.cj_guardian) : null;
  if (!gd || gd.removed || !gd.alive) return;
  k.cj_stompT -= dt;
  if (k.cj_stompT <= 0) {
    k.cj_stompT = g.stompEvery;
    game.abilities.use('aoe_ring', gd, { r: g.stompR, dmg: g.stompDmg, knockback: 6, fx: 'shockwave', color: s.color, shake: 0.25,
      type: 'magic', tags: ['grand_stomp'] });
    game.fx({ type: 'burst', x: gd.x, y: gd.y, n: 16, color: s.light, r: g.stompR });
    game.ents.setAnim(gd, 'attack', 0.3);
    k.cj_stomps = (k.cj_stomps || 0) + 1;
  }
}

// ---------------------------------------------------------------------------------------------- the kit
const conjurer = {
  id: 'conjurer',
  parent: 'mage',
  basicMode: 'auto',
  aimRange(game, p, rank) { return rank >= 3 ? S(game).spiritBolt.range : classN(game).bolt.range; },
  interval(game, p, rank) { return rank >= 3 ? S(game).spiritBolt.interval : classN(game).bolt.interval; },
  basicInfo(game, p, rank) {
    const r = (sdata(game, 'conjurer') || DEF).ranks || DEF.ranks;
    if (rank >= 5 && r[5]) return r[5];
    if (rank >= 4) return r[4];
    if (rank >= 3) return r[3];
    return mage.basicInfo(game, p, rank);
  },
  onEquip(game, p) {
    const k = p.data.kit;
    k.cj_next = 0; k.cj_list = []; k.cj_near = []; k.cj_grandUntil = 0; k.cj_guardian = 0;
    k.blinkOverride = spiritSwap;
  },
  onUnequip(game, p) {
    const k = p.data.kit;
    k.blinkOverride = null;
    const list = game.combat.summonsOf(p, FAMILIAR_KEY, []);
    for (const f of list) game.combat.expireSummon(f, 'unequip');
    const gd = k.cj_guardian ? game.ents.get(k.cj_guardian) : null;
    if (gd && !gd.removed) game.combat.expireSummon(gd, 'unequip');
    for (const w of game.combat.summonsOf(p, 'ghost_wolf', [])) game.combat.expireSummon(w, 'unequip');
    if (k.cj_totem && !k.cj_totem.removed) game.ents.remove(k.cj_totem);
  },
  update(game, p, dt) { updateGrand(game, p, dt); },
  hud(game, p, hud) {
    const k = p.data.kit;
    hud.kitHud = game.kits.kitHud;
    hud.kitHud.pips = familiars(game, p).length;
    hud.kitHud.pipsMax = maxFamiliars(game);
    hud.kitHud.label = 'Familiars';
    hud.kitHud.stance = k.cj_grandUntil > game.t ? 'Guardian' : null;
  },
  basic(game, p, ctx) {
    if (ctx.rank < 3) return mage.basic(game, p, ctx);
    fireSpiritBolt(game, p, ctx.angle, ctx.rank);
    return undefined;
  },
  abilities: {
    f: {
      id: 'summon_familiar', name: 'Summon Familiar', icon: 'summon', unlock: 8,
      get cd() { return DEF.kit.summon.cd; }, get cost() { return DEF.kit.summon.cost; },
      desc: 'Call a Fox, then an Owl, then a Stoneling. Up to three stay with you.',
      cast(game, p) {
        const k = p.data.kit, order = S(game).order;
        const kind = order[k.cj_next % order.length];
        const e = summonFamiliar(game, p, kind);
        if (!e) return false;
        k.cj_next++;
        if (boon(game, 'spirit_totem')) plantTotem(game, p);
        game.bus.emit('sfx', { id: 'spell' });
        return undefined;
      },
    },
    shift: {
      id: 'grand_conjuration', name: 'Grand Conjuration', icon: 'summon', unlock: 11,
      get cd() { return DEF.kit.grand.cd; }, get cost() { return DEF.kit.grand.cost; },
      desc: 'A giant spirit guardian stomps the battlefield while your pets grow huge.',
      isActive(game, p) { return p.data.kit.cj_grandUntil > game.t; },
      cast: castGrand,
    },
  },
  hooks: {
    onMinionOutgoing(game, p, info) {
      // familiars (not the guardian) deal +50% to marked targets
      const src = info.source;
      if (src && src.data.summonKey === FAMILIAR_KEY && info.target && info.target.status.mark > 0) info.amount *= 1 + S(game).markBonus;
    },
    onMinionHit(game, p, e) {
      if (!boon(game, 'soul_link') || e.amount <= 0 || !isFamiliar(e.source)) return;
      if (p.data.resource && p.data.resource.id === 'mana') game.kits.gain(p, S(game).soul_link.mana);
    },
    onKill(game, p, e) { checkSpirit(game, p, e); },
    onMinionKill(game, p, e) { checkSpirit(game, p, e); },
  },
};
function isFamiliar(e) { return !!e && e.type === 'summon' && e.data.summonKey === FAMILIAR_KEY; }

export default conjurer;
