// ARCHER spec kit (docs/CLASSES.md "Archer"): the spacing-and-timing sniper. Passive Eagle Eye (+0..60% damage
// with distance, an extra pip from 5+ tiles), Longbow (raw basic: tap = quick arrow, hold = draw a piercing Power
// Shot; rank IV: arrows in pairs, full draws burst into splinters), Arrow Rain (F finisher: arrows visibly fall from
// the sky), Starfall Arrow (Shift: a giant arrow that drags small enemies and explodes on the first wall), and the
// boons Split Arrow, Pinning Shot, Rain of Fire, Hawk. Numbers: data.specs.archer.kit + data.boons.
// State: p.data.kit.ar (plain values + entity ids; transient visuals are rebuilt).
import specdefs from '../../data/specs/rogue.js';
import { TAG_BASIC, hasBoon, boonData, addPips, spendPips, consumeCrit, newVolley, tagVolley, afterBasic, flurryOn, rg, setHeldGlow, enemyZone }
  from './rogue.js';

const DEF = specdefs.archer;
const META = {};
for (const a of DEF.abilities) META[a.id] = a;
const ak = (game) => game.data.specs.archer.kit;
const isEnemy = (e) => e.type === 'enemy';
const EE_LABELS = ['Eagle Eye +0%', 'Eagle Eye +10%', 'Eagle Eye +20%', 'Eagle Eye +30%', 'Eagle Eye +40%', 'Eagle Eye +50%', 'Eagle Eye +60%'];
const LABEL_DRAW = 'Drawing...';
const LABEL_FULL = 'Full draw!';
const TAG_RAIN = Object.freeze(['archer_rain']);
const TAG_STAR = Object.freeze(['archer_star']);
const TAG_HAWK = Object.freeze(['archer_hawk']);

const HAWK_LOOK = { rig: 'flyer', size: 0.55, colors: { body: '#8b5a2b', belly: '#f1e9da', accent: '#f2c94c', eye: '#1b1b1b' }, features: ['wings_bird'], hero: null };
const HAWK_DEF = { id: 'hawk', name: 'Hawk', look: HAWK_LOOK, stats: { radius: 0.25, speed: 8 }, flying: true };

/** Eagle Eye multiplier for a hit at distance d. */
export function eagleEyeBonus(game, d) {
  const E = ak(game).eagleEye;
  const f = (d - E.minDist) / (E.maxDist - E.minDist);
  return E.bonus * (f < 0 ? 0 : f > 1 ? 1 : f);
}

function arrowLook(color, glow, size) { return { rig: 'projectile', model: 'arrow', color, glow, size, trail: true }; }

// ---------- Longbow ----------
function quickArrow(game, p, angle, rank) {
  const A = ak(game), B = A.longbow, C = A.colors;
  const crit = consumeCrit(game, p);
  const vol = newVolley(p);
  let shots;
  if (flurryOn(game, p)) {
    shots = game.abilities.use('multishot', p, { angle, n: 8, ring: true, model: 'arrow', color: C.main, glow: C.gold, speed: B.arrow.speed,
      range: B.arrow.range * 0.6, dmg: B.arrow.coef * 0.7, knockback: B.arrow.knockback, crit, tags: TAG_BASIC, anim: 'attack' });
    game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.2, color: C.main, dur: 0.3 });
  } else if (rank >= 4) {
    shots = game.abilities.use('multishot', p, { angle, n: 2, parallel: B.pair.spacing, model: 'arrow', color: C.main, glow: C.gold,
      speed: B.arrow.speed, range: B.arrow.range, dmg: B.pair.coef, knockback: B.arrow.knockback, crit, tags: TAG_BASIC, anim: 'attack' });
  } else {
    shots = game.abilities.use('projectile', p, { angle, model: 'arrow', color: C.main, glow: C.gold, speed: B.arrow.speed,
      range: B.arrow.range, dmg: B.arrow.coef, knockback: B.arrow.knockback, crit, tags: TAG_BASIC, anim: 'attack' });
  }
  tagVolley(shots, vol);
  game.fx({ type: 'burst', x: p.x + Math.cos(angle) * 0.5, y: p.y + Math.sin(angle) * 0.5, n: 4, r: 0.3, color: C.gold });
  afterBasic(game, p, angle);
}

function powerShot(game, p, angle, heldT, rank) {
  const A = ak(game), B = A.longbow, D = B.draw, C = A.colors;
  const f = Math.max(0, Math.min(1, (heldT - B.tapMax) / (D.full - B.tapMax)));
  const full = heldT >= D.full;
  const coef = D.coefMin + (D.coefMax - D.coefMin) * f;
  const crit = consumeCrit(game, p);
  const vol = newVolley(p);
  const split = hasBoon(game, 'split_arrow') ? boonData(game, 'split_arrow') : null;
  const pin = full && hasBoon(game, 'pinning_shot') ? boonData(game, 'pinning_shot') : null;
  const splinter = full && rank >= 4 ? B.splinters : null;
  const size = 1.3 + f * 1.2;
  let first = true;
  const shot = game.abilities.use('projectile', p, {
    angle, look: arrowLook(full ? C.gold : C.main, full ? '#ffffff' : C.gold, size), speed: D.speed, range: D.range, radius: 0.22,
    dmg: coef, pierce: true, knockback: D.knockback * (0.4 + 0.6 * f), crit, tags: TAG_BASIC, anim: 'attack', hitStop: full ? 0.05 : 0,
    status: pin ? { root: pin.root || 2 } : null,
    onHit(g, t, dealt, pr) {
      if (pin) g.fx({ type: 'ring', x: t.x, y: t.y, r: 0.6, color: C.gold, dur: 0.5 });
      if (!first) return;
      first = false;
      if (splinter) {
        const shots = g.abilities.use('multishot', p, { x: t.x, y: t.y, angle: pr.angle, n: splinter.n, spread: splinter.arc, model: 'arrow',
          color: C.gold, size: 0.7, speed: D.speed * 0.8, range: splinter.range, amount: pr.data.proj.dmg * splinter.dmgMul, knockback: 1,
          tags: TAG_BASIC, anim: 'attack' });
        for (const s of shots) s.data.proj.hits.push(t.id);
        g.fx({ type: 'burst', x: t.x, y: t.y, n: 12, r: 0.9, color: C.gold });
      }
      if (split) {
        const shots = g.abilities.use('multishot', p, { x: t.x, y: t.y, angle: pr.angle, n: split.n || 3, spread: split.arc || 30, model: 'arrow',
          color: C.main, glow: C.gold, size: 1.1, speed: D.speed, range: split.range || 6, amount: pr.data.proj.dmg * (split.dmgMul || 0.6),
          pierce: true, knockback: 2, tags: TAG_BASIC, anim: 'attack' });
        for (const s of shots) s.data.proj.hits.push(t.id);
        g.fx({ type: 'sparkle', x: t.x, y: t.y, n: 8, r: 0.6, color: C.main });
      }
    },
  });
  tagVolley(shot, vol);
  game.fx({ type: 'burst', x: p.x + Math.cos(angle) * 0.6, y: p.y + Math.sin(angle) * 0.6, n: 6 + Math.round(10 * f), r: 0.5 + f * 0.5, color: C.gold });
  if (full) {
    game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 14, r: 0.9, color: C.gold });
    game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.1, color: C.gold, dur: 0.3 });
    game.camera.shake = Math.max(game.camera.shake, D.shake);
  }
  afterBasic(game, p, angle);
}

function stopDraw(game, p) {
  const ar = p.data.kit.ar;
  ar.drawing = false; ar.fullFx = false;
  game.ents.setFxTag(p, 'charge', false);
  p.glow = null;
  if (p.anim === 'charge') game.ents.setAnim(p, 'idle');
  if (!(game.t <= rg(p).critUntil)) setHeldGlow(game, p, null);
}

function longbow(game, p, ctx) {
  const A = ak(game), B = A.longbow, ar = p.data.kit.ar;
  if (ctx.held) {
    if (!ar.drawing && ctx.heldT >= B.tapMax && game.t >= ar.readyT) {
      ar.drawing = true; ar.fullFx = false;
      game.ents.setFxTag(p, 'charge', true);
      game.ents.setAnim(p, 'charge');
      p.glow = A.colors.main;
    }
    if (ar.drawing) {
      ar.drawT = ctx.heldT;
      if (!ar.fullFx && ctx.heldT >= B.draw.full) {
        ar.fullFx = true;
        p.glow = A.colors.gold;
        setHeldGlow(game, p, A.colors.gold);
        game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 10, r: 0.6, color: A.colors.gold });
      }
    }
    return;
  }
  if (!ctx.released) return;
  const wasDrawing = ar.drawing;
  if (wasDrawing) stopDraw(game, p);
  if (ctx.cancelled) return;
  if (game.t < ar.readyT) return;
  if (wasDrawing) powerShot(game, p, ctx.angle, ctx.heldT, ctx.rank);
  else quickArrow(game, p, ctx.angle, ctx.rank);
  ar.readyT = game.t + B.cooldown / (1 + game.combat.mod(p, 'attackSpeed'));
}

// ---------- Arrow Rain ----------
function spawnFalling(game, p, x, y, color) {
  const ar = p.data.kit.ar;
  const e = game.ents.create({ kind: 'falling_arrow', type: 'effect', team: 'player', owner: p.id, x, y, z: 5 + game.rng.next() * 2,
    angle: Math.PI / 2 + (game.rng.next() - 0.5) * 0.3, solid: false, ttl: 1.2, look: ar.rainLook && ar.rainLook.color === color ? ar.rainLook
      : (ar.rainLook = arrowLook(color, '#ffffff', 0.9)) });
  ar.falling.push(e.id);
}
function arrowRain(game, p, ctx) {
  const A = ak(game), R = A.arrowRain, C = A.colors;
  const pips = spendPips(game, p);
  const d = game.world.raycast(p.x, p.y, ctx.angle, R.dist, true);
  const x = p.x + Math.cos(ctx.angle) * d, y = p.y + Math.sin(ctx.angle) * d;
  const r = R.r + R.rPerPip * pips;
  const fire = hasBoon(game, 'rain_of_fire') ? boonData(game, 'rain_of_fire') : null;
  const color = fire ? C.fire : C.main;
  const status = fire ? [{ slow: [0.8, R.slow] }, { id: 'burn', t: fire.burnDur || 3, p: (fire.burnDps || 0.35) * game.combat.powerOf(p) }] : { slow: [0.8, R.slow] };
  const perTick = R.arrowsPerTick + pips;
  enemyZone(game, p, { x, y, r, dur: R.dur, tick: R.tick, dmg: R.coef, type: 'ranged', status, color, tags: TAG_RAIN, silent: false,
    model: fire ? 'ground_fire' : 'zone_ring',
    onTick(g, z) {
      for (let i = 0; i < perTick; i++) {
        const a = g.rng.next() * Math.PI * 2, rr = Math.sqrt(g.rng.next()) * r;
        spawnFalling(g, p, z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, color);
      }
    } });
  for (let i = 0; i < perTick; i++) {
    const a = game.rng.next() * Math.PI * 2, rr = Math.sqrt(game.rng.next()) * r;
    spawnFalling(game, p, x + Math.cos(a) * rr, y + Math.sin(a) * rr, color);
  }
  game.ents.setAnim(p, 'cast', 0.25);
  game.fx({ type: 'burst', x: p.x, y: p.y - 0.3, n: 10, r: 0.5, color });
  game.fx({ type: 'ring', x, y, r, color, dur: 0.6 });
  game.fx({ type: 'sparkle', x, y, n: 10 + pips * 4, r, color: C.gold });
  if (pips >= 5) { game.fx({ type: 'shockwave', x, y, r, color }); game.camera.shake = Math.max(game.camera.shake, 0.3); }
}

// ---------- Starfall Arrow ----------
function starfallCast(game, p, ctx) {
  const A = ak(game), S = A.starfall, ar = p.data.kit.ar;
  ar.starT = S.draw; ar.starAngle = ctx.angle;
  game.ents.setFxTag(p, 'charge', true);
  game.ents.setAnim(p, 'charge', S.draw);
  p.glow = A.colors.star;
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.8, color: A.colors.star, dur: S.draw });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 20, r: 1.2, color: A.colors.gold });
}
function starfallFire(game, p) {
  const A = ak(game), S = A.starfall, ar = p.data.kit.ar, C = A.colors;
  const angle = ar.starAngle != null ? ar.starAngle : p.angle;
  ar.starAngle = null;
  game.ents.setFxTag(p, 'charge', false);
  p.glow = null;
  ar.drag.length = 0;
  const shot = game.combat.projectile(p, {
    angle, look: arrowLook(C.star, '#ffffff', S.size), speed: S.speed, range: S.range, radius: 0.45, dmg: S.coef, pierce: true,
    knockback: 0, tags: TAG_STAR, hitStop: 0.04, shake: 0.2,
    onHit(g, t) {
      if (t.alive && !t.removed && !t.tags.includes('boss') && t.hpMax <= S.dragMaxHp * (game.config.numberScale || 1) && ar.drag.length < 8) ar.drag.push(t.id);
      g.fx({ type: 'burst', x: t.x, y: t.y, n: 10, r: 0.7, color: C.star });
    },
    onExpire(g, pr) {
      const E = S.explode;
      g.combat.aoe(p, { x: pr.x, y: pr.y, r: E.r, dmg: E.coef, knockback: 7, type: 'ranged', fx: 'meteor', color: C.gold, shake: E.shake, tags: TAG_STAR });
      g.fx({ type: 'shockwave', x: pr.x, y: pr.y, r: E.r, color: C.star });
      g.fx({ type: 'screenFlash', color: C.star, dur: 0.18 });
      for (let i = 0; i < ar.drag.length; i++) { const e = g.ents.get(ar.drag[i]); if (e && !e.removed) g.physics.resolve(e); }
      ar.drag.length = 0; ar.starId = 0;
    },
  });
  ar.starId = shot.id;
  game.ents.setAnim(p, 'attack', 0.3);
  game.fx({ type: 'screenFlash', color: C.star, dur: 0.15 });
  game.fx({ type: 'beam', x: p.x, y: p.y, x2: p.x + Math.cos(angle) * 6, y2: p.y + Math.sin(angle) * 6, w: 0.8, color: C.star });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 2, color: C.gold, dur: 0.4 });
  game.camera.shake = Math.max(game.camera.shake, 0.5);
  game.bus.emit('sfx', { id: 'spell' });
}

// ---------- Hawk ----------
function hawkUpdate(game, p, dt) {
  const ar = p.data.kit.ar, A = ak(game);
  let h = ar.hawkId ? game.ents.get(ar.hawkId) : null;
  if (!hasBoon(game, 'hawk')) { if (h && !h.removed) game.combat.expireSummon(h, 'boon'); ar.hawkId = 0; return; }
  const b = boonData(game, 'hawk');
  if (!h || h.removed) {
    h = game.combat.summon(p, HAWK_DEF, { x: p.x, y: p.y - 1, brain: 'none', fxTag: false, fx: false, hp: 999, power: game.combat.powerOf(p),
      key: 'hawk', color: A.colors.main, tags: ['hawk'] });
    h.data.untargetable = true; h.data.noPhysics = true; h.data.flying = true; h.z = 1.6;
    ar.hawkId = h.id; ar.hawkT = b.every || 4; ar.hawkDive = 0; ar.hawkA = 0;
    game.fx({ type: 'poof', x: h.x, y: h.y, color: '#f1e9da' });
  }
  h.stats.power = game.combat.powerOf(p);
  ar.hawkT -= dt;
  if (ar.hawkDive) {
    const t = game.ents.get(ar.hawkDive);
    if (!t || t.removed || !game.combat.targetable(t)) { ar.hawkDive = 0; return; }
    const dx = t.x - h.x, dy = t.y - h.y, d = Math.sqrt(dx * dx + dy * dy);
    const sp = (b.diveSpeed || 14) * dt;
    h.angle = Math.atan2(dy, dx);
    h.z = Math.max(0.4, h.z - 3 * dt);
    if (d <= sp + 0.3) {
      game.combat.damage(t, (b.coef || 1.4) * h.stats.power, { source: h, type: 'ranged', knockback: 2, tags: TAG_HAWK, color: '#f1e9da' });
      game.fx({ type: 'burst', x: t.x, y: t.y, n: 10, r: 0.6, color: '#c49a6c' });
      game.fx({ type: 'slash', x: t.x, y: t.y, angle: h.angle, arc: 90, r: 0.6, color: '#f1e9da', style: 'claw' });
      ar.hawkDive = 0; ar.hawkT = b.every || 4;
    } else { h.x += (dx / d) * sp; h.y += (dy / d) * sp; }
    return;
  }
  // Circle above the archer.
  ar.hawkA += dt * 2.2;
  const tx = p.x + Math.cos(ar.hawkA) * 1.1, ty = p.y + Math.sin(ar.hawkA) * 0.8 - 0.6;
  h.x += (tx - h.x) * Math.min(1, dt * 6); h.y += (ty - h.y) * Math.min(1, dt * 6);
  h.z += (1.6 - h.z) * Math.min(1, dt * 3);
  h.angle = ar.hawkA + Math.PI / 2;
  if (ar.hawkT <= 0) {
    const t = p.data.lastTarget != null ? game.ents.get(p.data.lastTarget) : null;
    if (t && t !== h && game.combat.targetable(t) && game.combat.hostile(p, t) && Math.hypot(t.x - p.x, t.y - p.y) <= (b.range || 9)) {
      ar.hawkDive = t.id;
      game.fx({ type: 'trail', x: h.x, y: h.y, x2: t.x, y2: t.y, color: '#f1e9da' });
    } else ar.hawkT = 0.5;
  }
}

export default {
  id: 'archer', parent: 'rogue',
  basicMode: 'raw',
  interval: 0.35,
  aimRange(game) { return ak(game).longbow.arrow.range; },
  basicInfo(game, p, rank) { return game.kits.registry.rogue.basicInfo(game, p, rank); },

  onEquip(game, p) {
    p.data.kit.ar = { drawing: false, drawT: 0, fullFx: false, readyT: 0, falling: [], rainLook: null, starT: 0, starAngle: null, starId: 0,
      drag: [], hawkId: 0, hawkT: 0, hawkDive: 0, hawkA: 0, eeIdx: 0, eeT: 0 };
  },
  onUnequip(game, p) {
    const ar = p.data.kit.ar;
    if (!ar) return;
    game.ents.setFxTag(p, 'charge', false);
    p.glow = null;
    const h = ar.hawkId ? game.ents.get(ar.hawkId) : null;
    if (h && !h.removed) game.combat.expireSummon(h, 'unequip');
  },

  update(game, p, dt) {
    const ar = p.data.kit.ar, A = ak(game);
    if (!ar) return;
    if (ar.drawing) p.data.kit.speedMul *= A.longbow.draw.speedMul;
    // Starfall draw, then release.
    if (ar.starT > 0) {
      p.data.kit.speedMul *= A.starfall.drawSpeedMul;
      ar.starT -= dt;
      if (ar.starT <= 0) { ar.starT = 0; starfallFire(game, p); }
    }
    // Dragged enemies ride the star arrow.
    if (ar.starId && ar.drag.length) {
      const s = game.ents.get(ar.starId);
      if (s && !s.removed) {
        const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
        for (let i = 0; i < ar.drag.length; i++) {
          const e = game.ents.get(ar.drag[i]);
          if (!e || e.removed || !e.alive) continue;
          e.x = s.x + ca * (0.3 + i * 0.15) - sa * ((i % 2 ? 1 : -1) * 0.25 * i);
          e.y = s.y + sa * (0.3 + i * 0.15) + ca * ((i % 2 ? 1 : -1) * 0.25 * i);
          e.kx = 0; e.ky = 0;
        }
        game.ents.touch();
      }
    }
    // Falling Arrow Rain arrows (visual entities with z).
    const fall = A.arrowRain.fallSpeed;
    for (let i = ar.falling.length - 1; i >= 0; i--) {
      const e = game.ents.get(ar.falling[i]);
      if (!e || e.removed) { ar.falling[i] = ar.falling[ar.falling.length - 1]; ar.falling.pop(); continue; }
      e.z -= fall * dt;
      if (e.z <= 0) {
        game.fx({ type: 'hit', x: e.x, y: e.y, color: e.look.color });
        game.ents.remove(e);
        ar.falling[i] = ar.falling[ar.falling.length - 1]; ar.falling.pop();
      }
    }
    hawkUpdate(game, p, dt);
    // HUD: Eagle Eye bonus against the nearest enemy (4 Hz).
    ar.eeT -= dt;
    if (ar.eeT <= 0) {
      ar.eeT = 0.25;
      const n = game.ents.nearest(p.x, p.y, 12, isEnemy);
      ar.eeIdx = n ? Math.round(eagleEyeBonus(game, Math.hypot(n.x - p.x, n.y - p.y)) * 10) : 0;
    }
  },

  hud(game, p, hud) {
    const ar = p.data.kit.ar, kh = game.kits.kitHud;
    hud.kitHud = kh;
    if (!ar) return;
    kh.label = ar.drawing ? (ar.fullFx ? LABEL_FULL : LABEL_DRAW) : EE_LABELS[Math.max(0, Math.min(6, ar.eeIdx))];
  },

  basic: longbow,

  abilities: {
    f: { id: 'arrow_rain', name: META.arrow_rain.name, icon: META.arrow_rain.icon, desc: META.arrow_rain.desc,
      unlock: META.arrow_rain.unlock, cd: META.arrow_rain.cd, cast: arrowRain },
    shift: { id: 'starfall_arrow', name: META.starfall_arrow.name, icon: META.starfall_arrow.icon, desc: META.starfall_arrow.desc,
      unlock: META.starfall_arrow.unlock, cd: META.starfall_arrow.cd, cast: starfallCast,
      isActive(game, p) { return !!(p.data.kit.ar && p.data.kit.ar.starT > 0); } },
  },

  hooks: {
    onOutgoing(game, p, info) {
      if (info.source !== p || (info.opts && info.opts.dot) || !info.target) return;
      const d = Math.hypot(info.target.x - p.x, info.target.y - p.y);
      const b = eagleEyeBonus(game, d);
      if (b > 0) info.amount *= 1 + b;
    },
    onHit(game, p, e) {
      if (e.source !== p || e.dot || !e.target || !(e.tags && e.tags[0] === 'rogue_basic')) return;
      const d = Math.hypot(e.target.x - p.x, e.target.y - p.y);
      const E = ak(game).eagleEye;
      if (d >= E.pipDist) {
        addPips(game, p, 1);
        game.fx({ type: 'sparkle', x: e.target.x, y: e.target.y, n: d >= E.maxDist ? 10 : 5, r: 0.5, color: ak(game).colors.gold });
      }
    },
  },
};
