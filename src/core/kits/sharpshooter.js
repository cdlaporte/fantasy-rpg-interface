// SHARPSHOOTER mastery (tier 3 over the Archer; docs/MASTERY.md). Precision.
// Passive Deadeye: while you draw, a laser sight (a thin `beam`) shows the line of the shot, red while drawing and cyan
// at full draw; a full-draw Power Shot always crits (x2.4), flies 1.8x as far and 1.35x as fast, as a bigger cyan
// arrow with a tracer line. The Longbow itself is the Archer's (wrapped, not copied).
// Ultimate Rail Shot (Shift, level 15): a 0.45 s charge (pillar, sparks), then an instant piercing beam that ricochets
// four times, off walls or onto the next enemy, with a `meteor` + `ring` at every bounce, a screen flash and a big
// camera shake, and a shockwave where it ends.
// Numbers: data.specs.sharpshooter.kit. State: p.data.kit.ss.
import archer from './archer.js';
import { TAG_BASIC } from './rogue.js';
import specdefs from '../../data/specs/rogue.js';
import { angleTo } from '../math.js';

const ID = 'sharpshooter';
const U = specdefs[ID].ultimate;
const SK = (game) => game.data.specs[ID].kit;
const isEnemy = (e) => e.type === 'enemy';
const TAG_RAIL = Object.freeze(['sharpshooter_rail']);
const LABEL_RAIL = 'Rail Shot!';
const LABEL_DEADEYE = 'Deadeye!';

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
function masteryScale(game, p) { const k = SK(game); return (k.dmgScale != null ? k.dmgScale : 1) * interp(k.lateScale, game.kits.level(p)); }

// ---------- Deadeye (wraps the Archer's Longbow) ----------
let deadeyeLook = null;
function longbow(game, p, ctx) {
  const ar = p.data.kit.ar, ss = p.data.kit.ss;
  const B = game.data.specs.archer.kit.longbow;
  const full = !!(ar && ss && ctx.released && !ctx.cancelled && ar.drawing && ctx.heldT >= B.draw.full && game.t >= ar.readyT);
  const n0 = game.ents.all.length;
  archer.basic(game, p, ctx);
  if (full) deadeye(game, p, n0);
}
function deadeye(game, p, n0) {
  const K = SK(game), D = K.deadeye, C = K.colors, ss = p.data.kit.ss;
  const all = game.ents.all;
  for (let i = n0; i < all.length; i++) {
    const e = all[i];
    const pd = e.type === 'projectile' && e.owner === p.id && e.data.proj;
    // the Power Shot itself (splinters and splits only appear on hit, and carry no hit-stop)
    if (!pd || pd.tags !== TAG_BASIC || !(pd.hitStop > 0)) continue;
    pd.crit = true; pd.critMult = D.critMult;
    pd.range *= D.rangeMul; pd.speed *= D.speedMul;
    e.vx *= D.speedMul; e.vy *= D.speedMul;
    if (!deadeyeLook || deadeyeLook.color !== C.main) deadeyeLook = { rig: 'projectile', model: 'arrow', color: C.main, glow: C.core, size: D.size, trail: true };
    e.look = deadeyeLook; e.lookRev = (e.lookRev || 0) + 1;
    e.data.ssDeadeye = true;
    const len = game.world.raycast(p.x, p.y, e.angle, pd.range, true);
    game.fx({ type: 'beam', x: p.x, y: p.y, x2: p.x + Math.cos(e.angle) * len, y2: p.y + Math.sin(e.angle) * len, w: 0.25, color: C.main });
    game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.3, color: C.main, dur: 0.3 });
    game.fx({ type: 'text', x: p.x, y: p.y, z: 1.6, text: 'Deadeye!', style: 'info', ent: p.id });
    ss.deadeyes++;
    break;
  }
}

// ---------- Rail Shot ----------
const RAIL_PICK = { range: 12, mode: 'strongest', los: true, out: { x: 0, y: 0 } };
function railCast(game, p, ctx) {
  const K = SK(game), R = K.rail, C = K.colors, ss = p.data.kit.ss;
  ss.railT = R.charge; ss.railA = ctx.angle;
  game.ents.setFxTag(p, 'charge', true);
  game.ents.setAnim(p, 'charge', R.charge);
  p.glow = C.main;
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.9, color: C.main, dur: R.charge + 0.1 });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 24, r: 1.4, color: C.core });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.8, color: C.gold, dur: R.charge });
  return undefined;
}
/** Wall normal at a ray end point: which axis the ray ran into (flips that component of the direction). */
function reflect(game, x, y, a) {
  const cx = Math.cos(a), cy = Math.sin(a);
  const sx = game.world.solidAt(x + cx * 0.12, y, true), sy = game.world.solidAt(x, y + cy * 0.12, true);
  if (sx && !sy) return Math.atan2(cy, -cx);
  if (sy && !sx) return Math.atan2(-cy, cx);
  return a + Math.PI;
}
function railFire(game, p) {
  const K = SK(game), R = K.rail, C = K.colors, ss = p.data.kit.ss;
  game.ents.setFxTag(p, 'charge', false);
  p.glow = null;
  let a = ss.railA != null ? ss.railA : p.angle;
  RAIL_PICK.range = R.aimRange;
  if (game.abilities.pickTarget(p, RAIL_PICK)) a = angleTo(p.x, p.y, RAIL_PICK.out.x, RAIL_PICK.out.y);
  p.angle = a; p.data.faceT = 0.3;
  let x = p.x, y = p.y;
  const prev = ss.railHit; prev.length = 0;
  let total = 0;
  for (let seg = 0; seg <= R.bounces; seg++) {
    const len = Math.max(0.5, game.world.raycast(x, y, a, R.range, true));
    const hits = game.combat.aoe(p, { x, y, shape: 'line', angle: a, len, w: R.w, dmg: R.coef, knockback: R.knockback, type: 'ranged',
      fx: false, tags: TAG_RAIL, exclude: seg ? prev : null, hitStop: 0.02, color: C.core });
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    game.fx({ type: 'beam', x, y, x2: ex, y2: ey, w: R.w, color: C.main });
    game.fx({ type: 'beam', x, y, x2: ex, y2: ey, w: R.w * 0.35, color: C.core });
    prev.length = 0;
    for (let i = 0; i < hits.length; i++) {
      prev.push(hits[i].id);
      game.fx({ type: 'burst', x: hits[i].x, y: hits[i].y, n: 8, r: 0.6, color: C.main });
    }
    total += hits.length;
    if (seg === R.bounces) {
      game.combat.aoe(p, { x: ex, y: ey, r: R.endR, dmg: R.endCoef, knockback: 6, type: 'ranged', fx: false, tags: TAG_RAIL });
      game.fx({ type: 'shockwave', x: ex, y: ey, r: R.endR, color: C.main });
      game.fx({ type: 'meteor', x: ex, y: ey, r: R.endR * 0.7, color: C.gold });
      break;
    }
    // Ricochet: onto the nearest enemy the beam has not just pierced (in sight), else off the wall.
    let next = null, bd = Infinity;
    const near = game.ents.inRadius(ex, ey, R.seek, isEnemy, ss.scratch);
    for (let i = 0; i < near.length; i++) {
      const e = near[i];
      if (prev.indexOf(e.id) >= 0 || !game.combat.canHit(p, e)) continue;
      const d = Math.hypot(e.x - ex, e.y - ey);
      if (d < 0.6 || d >= bd) continue;
      if (game.world.raycast(ex, ey, angleTo(ex, ey, e.x, e.y), d, true) < d - e.radius - 0.05) continue;
      bd = d; next = e;
    }
    const na = next ? angleTo(ex, ey, next.x, next.y) : reflect(game, ex, ey, a);
    // step back off the wall so the next segment starts in open air
    x = ex - Math.cos(a) * 0.15; y = ey - Math.sin(a) * 0.15;
    a = na;
    game.fx({ type: 'meteor', x: ex, y: ey, r: 0.9, color: C.main });
    game.fx({ type: 'ring', x: ex, y: ey, r: 1.2, color: C.gold, dur: 0.35 });
    game.fx({ type: 'sparkle', x: ex, y: ey, n: 10, r: 0.7, color: C.core });
    ss.bounces++;
  }
  ss.rails++; ss.railHits += total;
  game.ents.setAnim(p, 'attack', 0.3);
  game.fx({ type: 'screenFlash', color: C.core, dur: 0.2 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 2.2, color: C.main, dur: 0.4 });
  game.fx({ type: 'burst', x: p.x + Math.cos(p.angle) * 0.6, y: p.y + Math.sin(p.angle) * 0.6, n: 18, r: 0.9, color: C.core });
  game.camera.shake = Math.max(game.camera.shake, R.shake);
  game.bus.emit('sfx', { id: 'spell' });
}

export default {
  id: ID, parent: 'archer', tier: 3,
  // The Longbow stays raw (charge-up); the mastery wraps it, so it restates the basic's dispatch fields.
  basicMode: 'raw',
  interval: archer.interval,
  aimRange: archer.aimRange,
  basicInfo: archer.basicInfo,
  basic: longbow,

  onEquip(game, p) {
    p.data.kit.ss = { railT: 0, railA: null, railHit: [], scratch: [], sightT: 0, deadeyes: 0, rails: 0, railHits: 0, bounces: 0, sights: 0 };
  },
  onUnequip(game, p) {
    const ss = p.data.kit.ss;
    if (ss && ss.railT > 0) { game.ents.setFxTag(p, 'charge', false); p.glow = null; }
  },

  update(game, p, dt) {
    const ss = p.data.kit.ss, ar = p.data.kit.ar;
    if (!ss) return;
    const K = SK(game), C = K.colors;
    if (ss.railT > 0) {
      p.data.kit.speedMul *= K.rail.chargeSpeedMul;
      ss.railT -= dt;
      if ((game.tick & 3) === 0) game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 6, r: 0.9, color: C.main });
      if (ss.railT <= 0) { ss.railT = 0; railFire(game, p); }
    }
    // Laser sight while drawing.
    if (ar && ar.drawing) {
      if (--ss.sightT <= 0) {
        ss.sightT = K.deadeye.sightEvery;
        const B = game.data.specs.archer.kit.longbow;
        const f = Math.min(1, ar.drawT / B.draw.full);
        const len = game.world.raycast(p.x, p.y, p.angle, B.draw.range * (f >= 1 ? K.deadeye.rangeMul : 1), true);
        game.fx({ type: 'beam', x: p.x, y: p.y, x2: p.x + Math.cos(p.angle) * len, y2: p.y + Math.sin(p.angle) * len,
          w: 0.05 + 0.1 * f, color: f >= 1 ? C.main : C.laser });
        ss.sights++;
      }
    } else ss.sightT = 0;
  },

  hud(game, p, hud) {
    const ss = p.data.kit.ss, ar = p.data.kit.ar, kh = game.kits.kitHud;
    hud.kitHud = kh;
    if (!ss) return;
    if (ss.railT > 0) kh.label = LABEL_RAIL;
    else if (ar && ar.drawing && ar.fullFx) kh.label = LABEL_DEADEYE;
  },

  abilities: {
    shift: { id: U.id, name: U.name, icon: U.icon, unlock: U.unlock, cd: U.cd, desc: U.desc, cast: railCast,
      isActive(game, p) { return !!(p.data.kit.ss && p.data.kit.ss.railT > 0); } },
  },

  hooks: {
    onOutgoing(game, p, info) { if (info.source === p) info.amount *= masteryScale(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= masteryScale(game, p); },
    onHit(game, p, e) {
      if (e.source !== p || !e.proj || !e.proj.data.ssDeadeye || !e.target) return;
      const C = SK(game).colors;
      game.fx({ type: 'sparkle', x: e.target.x, y: e.target.y, n: 10, r: 0.6, color: C.core });
      game.fx({ type: 'ring', x: e.target.x, y: e.target.y, r: 0.8, color: C.main, dur: 0.3 });
    },
  },
};
