// RANGER mastery (tier 3 over the Archer; docs/MASTERY.md). The wild companion.
// Passive Wild Companion: a wolf fights beside you for good (it comes back 8 s after it falls or after a zone change)
// and pounces on whatever you hit from 4.5+ tiles away (it bites and taunts the target, so the archer keeps her
// distance); Dodge Roll leaves a snare trap where you stood (snaps on the first enemy: root + damage).
// Ultimate Wild Hunt (Shift, level 15): a howl (shockwave + screen flash), three hawks circle and dive on enemies for
// 6 s, and a pack of four wolves charges in a line through everything ahead, then fights on for the rest of the hunt.
// Numbers: data.specs.ranger.kit. State: p.data.kit.rn (plain values + entity ids).
import rogue from './rogue.js';
import specdefs from '../../data/specs/rogue.js';
import { angleTo } from '../math.js';

const ID = 'ranger';
const U = specdefs[ID].ultimate;
const RK = (game) => game.data.specs[ID].kit;
const isEnemy = (e) => e.type === 'enemy';
const TAG_WOLF = Object.freeze(['ranger_wolf']);
const TAG_TRAP = Object.freeze(['ranger_trap']);
const TAG_HUNT = Object.freeze(['ranger_hunt']);
const LABEL_HUNT = 'Wild Hunt!';
const LABEL_WOLF = 'Wolf ready';
const LABEL_WOLF_DOWN = 'Wolf returning...';

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
/** Mastery damage scale (on top of the subclass scaling in rogue.js). */
export function masteryScale(game, p) { const k = RK(game); return (k.dmgScale != null ? k.dmgScale : 1) * interp(k.lateScale, game.kits.level(p)); }

function wolfLook(game, spirit) {
  const C = RK(game).colors, W = RK(game).wolf;
  return { rig: 'quadruped', size: spirit ? W.size * 1.1 : W.size,
    colors: { body: spirit ? '#dff7c8' : C.fur, belly: spirit ? '#ffffff' : C.cream, accent: spirit ? C.spirit : C.main, eye: spirit ? C.main : C.gold },
    features: ['ears_pointy', 'tail_bushy', 'mane'], hero: null };
}
function biteAttack(game) {
  const W = RK(game).wolf, C = RK(game).colors;
  return { use: 'melee_arc', name: 'Bite', arc: 90, range: 0.85, dmg: W.bite, knockback: 1.5, cd: W.biteCd, windup: 0.08, style: 'claw', color: C.cream, tags: TAG_WOLF };
}

// ---------- the companion wolf ----------
function spawnWolf(game, p) {
  const rn = p.data.kit.rn, W = RK(game).wolf, C = RK(game).colors;
  const a = p.angle + Math.PI * 0.75;
  let x = p.x + Math.cos(a) * 1.2, y = p.y + Math.sin(a) * 1.2;
  if (game.world.solidAt(x, y)) { x = p.x; y = p.y; }
  const w = game.combat.summon(p, { id: 'ranger_wolf', name: 'Wolf', look: wolfLook(game, false), stats: { radius: 0.32 } }, {
    x, y, brain: 'ally_melee', attacks: [biteAttack(game)], power: game.combat.powerOf(p) * W.powerMul,
    hp: Math.max(5, Math.round(p.hpMax * W.hpMul)), key: 'ranger_wolf', speed: (p.stats.speed || 4) * W.speedMul, color: C.main,
    tags: ['ranger_wolf'], fxTag: false, fx: false,
  });
  rn.wolfId = w.id;
  rn.wolves = (rn.wolves || 0) + 1;
  game.fx({ type: 'poof', x, y, color: C.cream });
  game.fx({ type: 'ring', x, y, r: 1.1, color: C.main, dur: 0.4 });
  game.fx({ type: 'text', x, y, z: 1.2, text: 'Awoo!', style: 'bubble', ent: w.id, dur: 1.2 });
  return w;
}
function wolfOf(game, p) {
  const rn = p.data.kit.rn;
  const w = rn && rn.wolfId ? game.ents.get(rn.wolfId) : null;
  return w && !w.removed && w.alive ? w : null;
}
/** The wolf leaps at `t` (something you hit from far away): bite + taunt, so it holds the front line for you. */
function pounce(game, p, t) {
  const rn = p.data.kit.rn, W = RK(game).wolf, P = W.pounce, C = RK(game).colors;
  const w = wolfOf(game, p);
  if (!w || game.t < rn.pounceT || !t.alive || t.removed) return;
  rn.pounceT = game.t + P.every;
  const a = angleTo(t.x, t.y, w.x, w.y);
  const d = t.radius + w.radius + 0.2;
  let x = t.x + Math.cos(a) * d, y = t.y + Math.sin(a) * d;
  if (game.world.solidAt(x, y)) { x = t.x; y = t.y; }
  game.fx({ type: 'trail', x: w.x, y: w.y, x2: x, y2: y, color: C.main });
  game.fx({ type: 'afterimage', x: w.x, y: w.y, ent: w.id, color: C.main });
  game.physics.teleport(w, x, y);
  w.angle = angleTo(x, y, t.x, t.y);
  game.ents.setAnim(w, 'attack', 0.2);
  game.combat.damage(t, P.coef * game.combat.powerOf(w), { source: w, type: 'melee', knockback: 2, tags: TAG_WOLF, hitStop: 0.04, color: C.cream });
  game.fx({ type: 'slash', x: t.x, y: t.y, angle: w.angle, arc: 120, r: 0.8, color: C.cream, style: 'claw' });
  game.fx({ type: 'burst', x: t.x, y: t.y, n: 10, r: 0.6, color: C.main });
  if (t.ai && t.alive && !t.removed) { t.ai.target = w.id; t.ai.provoked = true; }
  if (w.ai) w.ai.target = t.id;
  rn.pounces++;
}

// ---------- snare traps (Dodge Roll) ----------
function dropTrap(game, p, x, y) {
  const rn = p.data.kit.rn, T = RK(game).trap, C = RK(game).colors;
  while (rn.traps.length >= T.max) { const old = game.ents.get(rn.traps.shift()); if (old && !old.removed) game.ents.remove(old); }
  const z = game.combat.zone(p, { x, y, r: T.r, dur: T.dur, tick: 0.1, dmg: 0, caltrops: true, color: C.main, kind: 'ranger_trap',
    onTick(g, ze, list) {
      let t = null;
      for (let i = 0; i < list.length; i++) if (list[i].type === 'enemy') { t = list[i]; break; }
      if (t) snap(g, p, ze, t);
    } });
  rn.traps.push(z.id);
  game.fx({ type: 'burst', x, y, n: 6, r: 0.5, color: C.bark });
  game.fx({ type: 'ring', x, y, r: T.r, color: C.main, dur: 0.4 });
}
function snap(game, p, ze, t) {
  const T = RK(game).trap, C = RK(game).colors;
  const x = ze.x, y = ze.y;
  game.ents.remove(ze);
  const rn = p.data.kit && p.data.kit.rn;
  if (!rn) return;   // the kit changed while the trap was still out
  game.combat.aoe(p, { x, y, r: T.snapR, dmg: T.coef, knockback: 0, type: 'ranged', fx: false, status: { root: T.root }, tags: TAG_TRAP });
  game.fx({ type: 'slash', x: t.x, y: t.y, angle: -Math.PI / 2, arc: 160, r: 0.9, color: C.cream, style: 'claw' });
  game.fx({ type: 'slash', x: t.x, y: t.y, angle: Math.PI / 2, arc: 160, r: 0.9, color: C.cream, style: 'claw' });
  game.fx({ type: 'ring', x, y, r: T.snapR, color: C.main, dur: 0.4 });
  game.fx({ type: 'burst', x, y, n: 14, r: T.snapR, color: C.bark });
  game.fx({ type: 'text', x: t.x, y: t.y, z: 1.5, text: 'Snap!', style: 'crit' });
  rn.snaps++;
}

// ---------- Wild Hunt ----------
const HAWK_LOOK = { rig: 'flyer', size: 0.6, colors: { body: '#7b4a2a', belly: '#f1e9da', accent: '#8fbf4a', eye: '#1b1b1b' }, features: ['wings_bird'], hero: null };
const HAWK_DEF = { id: 'ranger_hawk', name: 'Hawk', look: HAWK_LOOK, stats: { radius: 0.25, speed: 8 }, flying: true };
const HUNT_PICK = { range: 10, mode: 'densest', r: 2.5, out: { x: 0, y: 0 } };

function wildHunt(game, p, ctx) {
  const K = RK(game), H = K.hunt, C = K.colors, rn = p.data.kit.rn;
  endHunt(game, p);
  // Aim the charge at the densest pack of enemies in reach (else the facing).
  let a = ctx.angle;
  HUNT_PICK.range = H.charge.dist + 1;
  if (game.abilities.pickTarget(p, HUNT_PICK)) a = angleTo(p.x, p.y, HUNT_PICK.out.x, HUNT_PICK.out.y);
  p.angle = a; p.data.faceT = 0.3;
  const hunt = { t: H.dur, a, wolves: [], hawks: [], dives: 0, charged: 0 };
  rn.hunt = hunt;
  // Howl.
  game.combat.aoe(p, { r: H.howlR, dmg: 0, knockback: 6, fx: false, status: { slow: [1.5, 0.4] } });
  game.fx({ type: 'shockwave', x: p.x, y: p.y, r: H.howlR, color: C.main });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1, color: C.spirit, dur: 0.6 });
  game.fx({ type: 'screenFlash', color: C.main, dur: 0.2 });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.8, text: 'Wild Hunt!', style: 'crit' });
  game.camera.shake = Math.max(game.camera.shake, 0.5);
  game.ents.setAnim(p, 'cast', 0.35);
  game.bus.emit('sfx', { id: 'roar' });
  // The pack: a line of wolves behind you that charges along `a`.
  const pw = game.combat.powerOf(p);
  const ca = Math.cos(a), sa = Math.sin(a);
  for (let i = 0; i < H.wolves; i++) {
    const side = (i - (H.wolves - 1) / 2) * H.spread;
    let x = p.x - ca * 0.8 - sa * side, y = p.y - sa * 0.8 + ca * side;
    if (game.world.solidAt(x, y)) { x = p.x; y = p.y; }
    const w = game.combat.summon(p, { id: 'hunt_wolf', name: 'Spirit Wolf', look: wolfLook(game, true), stats: { radius: 0.3 } }, {
      x, y, brain: 'none', power: pw * H.packPowerMul, hp: Math.max(5, Math.round(p.hpMax * H.packHpMul)), key: 'hunt_wolf', ttl: H.dur + 0.5,
      speed: (p.stats.speed || 4) * 1.4, color: C.spirit, tags: ['hunt_wolf'], fxTag: false });
    w.alpha = 0.85; w.glow = C.spirit; w.angle = a;
    w.data.ghost = true;
    w.data.rnCharge = H.charge.dist / H.charge.speed;
    w.data.rnHits = [];
    hunt.wolves.push(w.id);
  }
  // Hawks.
  for (let i = 0; i < H.hawks; i++) {
    const h = game.combat.summon(p, HAWK_DEF, { x: p.x, y: p.y, brain: 'none', fxTag: false, fx: false, hp: 999, power: pw, key: 'ranger_hawk',
      ttl: H.dur, color: C.main, tags: ['ranger_hawk'] });
    h.data.untargetable = true; h.data.noPhysics = true; h.data.flying = true; h.z = 1.8;
    h.data.rnA = (i / H.hawks) * Math.PI * 2; h.data.rnT = 0.35 + i * (H.hawkEvery / H.hawks); h.data.rnDive = 0;
    hunt.hawks.push(h.id);
    game.fx({ type: 'poof', x: p.x, y: p.y, color: C.cream });
  }
  // The companion wolf joins in, hasted.
  const cw = wolfOf(game, p);
  if (cw) { game.combat.status(cw, 'haste', H.dur, 0.4); game.fx({ type: 'ring', x: cw.x, y: cw.y, r: 1, color: C.main, dur: 0.4 }); }
  rn.hunts++;
  return undefined;
}
function endHunt(game, p) {
  const rn = p.data.kit.rn;
  const h = rn && rn.hunt;
  if (!h) return;
  for (const id of h.wolves) { const e = game.ents.get(id); if (e && !e.removed) game.combat.expireSummon(e, 'hunt'); }
  for (const id of h.hawks) { const e = game.ents.get(id); if (e && !e.removed) game.combat.expireSummon(e, 'hunt'); }
  rn.hunt = null;
}
function updateHunt(game, p, dt) {
  const rn = p.data.kit.rn, h = rn.hunt, K = RK(game), H = K.hunt, C = K.colors;
  h.t -= dt;
  if (h.t <= 0) { endHunt(game, p); return; }
  // Wolves: charge, then hunt with the ally brain.
  for (let i = 0; i < h.wolves.length; i++) {
    const w = game.ents.get(h.wolves[i]);
    if (!w || w.removed || !w.alive) continue;
    if (w.data.rnCharge > 0) {
      w.data.rnCharge -= dt;
      const sp = H.charge.speed;
      w.vx = Math.cos(h.a) * sp; w.vy = Math.sin(h.a) * sp; w.angle = h.a; w.data.faceT = 0.1;
      if (w.anim !== 'walk') game.ents.setAnim(w, 'walk');
      const near = game.ents.inRadius(w.x, w.y, H.charge.r + 0.5, isEnemy, rn.scratch);
      for (let k = 0; k < near.length; k++) {
        const t = near[k];
        if (w.data.rnHits.indexOf(t.id) >= 0 || !game.combat.canHit(w, t)) continue;
        if (Math.hypot(t.x - w.x, t.y - w.y) - t.radius > H.charge.r) continue;
        w.data.rnHits.push(t.id);
        game.combat.damage(t, H.charge.coef * game.combat.powerOf(w), { source: w, type: 'melee', knockback: H.charge.knockback, kbAngle: h.a,
          tags: TAG_HUNT, hitStop: 0.03, color: C.spirit });
        game.fx({ type: 'slash', x: t.x, y: t.y, angle: h.a, arc: 110, r: 0.8, color: C.spirit, style: 'claw' });
        h.charged++;
      }
      if (((game.tick + i) & 3) === 0) game.fx({ type: 'trail', x: w.x - Math.cos(h.a) * 0.9, y: w.y - Math.sin(h.a) * 0.9, x2: w.x, y2: w.y, color: C.spirit });
      if (w.data.rnCharge <= 0) {
        w.vx = 0; w.vy = 0; w.data.ghost = false;
        game.fx({ type: 'burst', x: w.x, y: w.y, n: 8, r: 0.6, color: C.spirit });
        if (game.sys.ai && game.sys.ai.attach) game.sys.ai.attach(w, { brain: 'ally_melee' }, [biteAttack(game)]);
      }
    }
  }
  // Hawks: circle above you, dive on enemies in turn.
  for (let i = 0; i < h.hawks.length; i++) {
    const hk = game.ents.get(h.hawks[i]);
    if (!hk || hk.removed) continue;
    const d0 = hk.data;
    if (d0.rnDive) {
      const t = game.ents.get(d0.rnDive);
      if (!t || t.removed || !game.combat.targetable(t)) { d0.rnDive = 0; continue; }
      const dx = t.x - hk.x, dy = t.y - hk.y, d = Math.sqrt(dx * dx + dy * dy);
      const sp = H.diveSpeed * dt;
      hk.angle = Math.atan2(dy, dx);
      hk.z = Math.max(0.4, hk.z - 4 * dt);
      if (d <= sp + 0.3) {
        game.combat.damage(t, H.hawkCoef * hk.stats.power, { source: hk, type: 'ranged', knockback: 2, tags: TAG_HUNT, color: C.cream });
        game.fx({ type: 'slash', x: t.x, y: t.y, angle: hk.angle, arc: 90, r: 0.7, color: C.cream, style: 'claw' });
        game.fx({ type: 'burst', x: t.x, y: t.y, n: 8, r: 0.5, color: C.bark });
        d0.rnDive = 0; d0.rnT = H.hawkEvery;
        h.dives++;
      } else { hk.x += (dx / d) * sp; hk.y += (dy / d) * sp; }
      continue;
    }
    d0.rnA += dt * 2.4;
    const tx = p.x + Math.cos(d0.rnA) * 1.6, ty = p.y + Math.sin(d0.rnA) * 1.1 - 0.6;
    hk.x += (tx - hk.x) * Math.min(1, dt * 6); hk.y += (ty - hk.y) * Math.min(1, dt * 6);
    hk.z += (1.8 - hk.z) * Math.min(1, dt * 3);
    hk.angle = d0.rnA + Math.PI / 2;
    d0.rnT -= dt;
    if (d0.rnT <= 0) {
      const list = game.ents.inRadius(p.x, p.y, H.hawkRange, isEnemy, rn.scratch);
      let best = null, bd = Infinity;
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        if (!game.combat.canHit(p, e)) continue;
        // spread the dives: each hawk prefers a different enemy (by index), then the nearest
        const sc = Math.hypot(e.x - hk.x, e.y - hk.y) + (((e.id + i) % h.hawks.length) === 0 ? 0 : 3);
        if (sc < bd) { bd = sc; best = e; }
      }
      if (best) { d0.rnDive = best.id; game.fx({ type: 'trail', x: hk.x, y: hk.y, x2: best.x, y2: best.y, color: C.cream }); }
      else d0.rnT = 0.4;
    }
  }
}

// ---------- Dodge Roll + trap ----------
const ROLL = rogue.abilities.space;
const space = Object.assign({}, ROLL, {
  desc: 'Roll away, untouchable, and leave a snare trap where you stood. Your next attack is a sure critical.',
  cast(game, p, ctx) {
    const x0 = p.x, y0 = p.y;
    const r = ROLL.cast(game, p, ctx);
    if (p.data.kit.rn) dropTrap(game, p, x0, y0);
    return r;
  },
});

export default {
  id: ID, parent: 'archer', tier: 3,

  onEquip(game, p) {
    p.data.kit.rn = { wolfId: 0, wolfT: 0.4, pounceT: 0, traps: [], hunt: null, scratch: [], wolves: 0, pounces: 0, snaps: 0, hunts: 0 };
  },
  onUnequip(game, p) {
    const rn = p.data.kit.rn;
    if (!rn) return;
    endHunt(game, p);
    const w = wolfOf(game, p);
    if (w) game.combat.expireSummon(w, 'unequip');
    for (const id of rn.traps) { const z = game.ents.get(id); if (z && !z.removed) game.ents.remove(z); }
    rn.traps.length = 0;
  },

  update(game, p, dt) {
    const rn = p.data.kit.rn;
    if (!rn) return;
    // The companion: respawn after a fall (or a zone change, which clears summons).
    const w = wolfOf(game, p);
    if (!w) {
      if (rn.wolfId) { rn.wolfId = 0; rn.wolfT = RK(game).wolf.respawn; }
      rn.wolfT -= dt;
      if (rn.wolfT <= 0 && !p.data.down && game.player === p) spawnWolf(game, p);
    } else {
      w.stats.power = game.combat.powerOf(p) * RK(game).wolf.powerMul;
      // never wander off: catch up when far behind (zone edges, teleports)
      if (Math.hypot(w.x - p.x, w.y - p.y) > 14) { game.physics.teleport(w, p.x, p.y); game.fx({ type: 'poof', x: w.x, y: w.y, color: RK(game).colors.cream }); }
    }
    for (let i = rn.traps.length - 1; i >= 0; i--) { const z = game.ents.get(rn.traps[i]); if (!z || z.removed) rn.traps.splice(i, 1); }
    if (rn.hunt) updateHunt(game, p, dt);
  },

  hud(game, p, hud) {
    const rn = p.data.kit.rn, kh = game.kits.kitHud;
    hud.kitHud = kh;
    if (!rn) return;
    if (rn.hunt) kh.label = LABEL_HUNT;
    else if (!rn.wolfId) kh.label = LABEL_WOLF_DOWN;
    else if (kh.label === 'Combo' || !kh.label) kh.label = LABEL_WOLF;
  },

  abilities: {
    space,
    shift: { id: U.id, name: U.name, icon: U.icon, unlock: U.unlock, cd: U.cd, desc: U.desc,
      cast: wildHunt, isActive(game, p) { return !!(p.data.kit.rn && p.data.kit.rn.hunt); } },
  },

  hooks: {
    onOutgoing(game, p, info) { if (info.source === p) info.amount *= masteryScale(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= masteryScale(game, p); },
    onHit(game, p, e) {
      const rn = p.data.kit.rn, t = e.target;
      if (!rn || e.source !== p || e.dot || !t || t === p || !isEnemy(t)) return;
      if (!(e.tags && e.tags[0] === 'rogue_basic')) return;
      if (Math.hypot(t.x - p.x, t.y - p.y) >= RK(game).wolf.pounce.minDist) pounce(game, p, t);
    },
  },
};
