// NINJA spec kit (docs/CLASSES.md "Ninja"): the teleporting misdirection artist. Passive Afterimage (moving leaves
// afterimages; the first attack within 1 s of a dash, roll or step crits), Shuriken (rank III: three returning
// shuriken, each catch cuts 0.3 s off Shadow Step; rank IV: five, each bounces to a second target), Shadow Step (F:
// appear behind the nearest enemy, a decoy of you taunts and then bursts, +2 pips), Shadow Clones (Shift finisher:
// two clones, three at full pips, mirror your throws at 60%) and the boons Explosive Tags, Blade Storm,
// Substitution, Clone Mastery. Numbers: data.specs.ninja.kit + data.boons. State: p.data.kit.nj.
import specdefs from '../../data/specs/rogue.js';
import { TAG_BASIC, hasBoon, boonData, addPips, spendPips, consumeCrit, grantCrit, newVolley, tagVolley, afterBasic, flurryOn, angleTo, enemyZone }
  from './rogue.js';
import { clone } from '../ents.js';

const DEF = specdefs.ninja;
const META = {};
for (const a of DEF.abilities) META[a.id] = a;
const nk = (game) => game.data.specs.ninja.kit;
const isEnemy = (e) => e.type === 'enemy';
const TAG_DECOY = Object.freeze(['ninja_decoy']);
const TAG_CLONE = Object.freeze(['rogue_basic', 'ninja_clone']);
const LABEL_SUB = 'Substitution ready';
const LABEL_CLONES = 'Shadow Clones';
const LABEL_STEP = 'Shuriken';

function nearestEnemy(game, p, x, y, r, excludeId) {
  const list = game.ents.inRadius(x, y, r, isEnemy, p.data.kit.nj.scratch);
  let best = null, bd = Infinity;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.id === excludeId || !game.combat.canHit(p, e)) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
/** Where "behind" `t` is for a stepper at (fx, fy): opposite the target's facing, else the far side. */
function behindPoint(game, t, fx, fy, gap, out) {
  const d = t.radius + gap;
  let a = (t.angle || 0) + Math.PI;
  let x = t.x + Math.cos(a) * d, y = t.y + Math.sin(a) * d;
  if (game.world.solidAt(x, y)) { a = angleTo(fx, fy, t.x, t.y); x = t.x + Math.cos(a) * d; y = t.y + Math.sin(a) * d; }
  if (game.world.solidAt(x, y)) { x = t.x; y = t.y; }
  out.x = x; out.y = y;
  return out;
}

// ---------- Shuriken ----------
function throwVolley(game, src, owner, angle, rank, mult, crit, tags) {
  const N = nk(game), S = N.shuriken, S4 = N.shurikenIV;
  const four = rank >= 4;
  const ring = flurryOn(game, owner);
  const shots = game.abilities.use('multishot', src, {
    angle, n: ring ? 8 : four ? S4.n : S.n, spread: four ? S4.spread : S.spread, ring, model: 'shuriken', color: N.colors.steel,
    glow: src === owner ? N.colors.sash : N.colors.shadow, speed: S.speed, range: S.range, dmg: S.coef, mult, crit,
    returns: true, pierce: four ? 0 : true, bounce: four ? S4.bounce : 0, bounceRange: S4.bounceRange, knockback: 0.8, tags, anim: 'attack',
  });
  // One volley = one fan: the shuriken share their hit list, so each target is cut once on the way out and once on
  // the way back (and Rank IV bounces pick targets the rest of the fan has not hit yet).
  const shared = [];
  for (let i = 0; i < shots.length; i++) shots[i].data.proj.hits = shared;
  return shots;
}
function shuriken(game, p, ctx) {
  const N = nk(game), nj = p.data.kit.nj;
  const crit = consumeCrit(game, p);
  const vol = newVolley(p);
  const shots = throwVolley(game, p, p, ctx.angle, ctx.rank, 0, crit, TAG_BASIC);
  tagVolley(shots, vol);
  game.fx({ type: 'slash', x: p.x, y: p.y, angle: ctx.angle, arc: 50, r: 0.7, color: N.colors.sash, style: 'crescent' });
  if (crit) game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 8, r: 0.5, color: N.colors.sash });
  // Shadow Clones mirror the throw at 60%.
  for (let i = 0; i < nj.clones.length; i++) {
    const c = game.ents.get(nj.clones[i]);
    if (!c || c.removed || !c.alive) continue;
    c.angle = ctx.angle;
    throwVolley(game, c, p, ctx.angle, ctx.rank, N.clones.mult, false, TAG_CLONE);
    game.ents.setAnim(c, 'attack', 0.2);
  }
  afterBasic(game, p, ctx.angle);
  return N.shuriken.interval;
}

// ---------- Blade Storm orbiters ----------
function startOrbit(game, p, proj) {
  const b = boonData(game, 'blade_storm'), N = nk(game), nj = p.data.kit.nj;
  if (nj.orbit.length >= 10) return false;
  const o = game.combat.projectile(p, { x: p.x, y: p.y, angle: 0, speed: 0, range: 1e9, ghost: true, pierce: true, radius: 0.2,
    amount: proj.data.proj.dmg * (b.coefMul || 0.6), knockback: 0.5, look: proj.look, tags: TAG_BASIC });
  o.data.rgVolley = -1;
  nj.orbit.push({ id: o.id, t: b.dur || 2, a: nj.orbitA + nj.orbit.length * 1.3, rehit: b.rehit || 0.4 });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 4, r: 0.4, color: N.colors.sash });
  return true;
}
function updateOrbit(game, p, dt) {
  const nj = p.data.kit.nj;
  if (!nj.orbit.length) return;
  const b = boonData(game, 'blade_storm');
  const r = b.r || 1.2, spin = b.spin || 7;
  nj.orbitA += spin * dt;
  for (let i = nj.orbit.length - 1; i >= 0; i--) {
    const o = nj.orbit[i];
    const e = game.ents.get(o.id);
    o.t -= dt;
    if (!e || e.removed || o.t <= 0) {
      if (e && !e.removed) { game.ents.remove(e); game.abilities.reduce(p, 'f', nk(game).shuriken.catchCdr); nj.caught++; }
      nj.orbit[i] = nj.orbit[nj.orbit.length - 1]; nj.orbit.pop();
      continue;
    }
    o.a += spin * dt;
    e.x = p.x + Math.cos(o.a) * r; e.y = p.y + Math.sin(o.a) * r; e.vx = 0; e.vy = 0;
    e.angle = o.a;
    o.rehit -= dt;
    if (o.rehit <= 0) { o.rehit = b.rehit || 0.4; e.data.proj.hits.length = 0; }
  }
}

// ---------- Shadow Step ----------
function decoyBurst(game, p, d) {
  if (d.data.njBurst) return;
  d.data.njBurst = true;
  const N = nk(game), D = N.shadowStep.decoy;
  const tags = hasBoon(game, 'explosive_tags') ? boonData(game, 'explosive_tags') : null;
  const r = tags ? tags.r || 2.7 : D.r;
  const coef = D.coef * (tags ? tags.coefMul || 1.4 : 1);
  const status = tags ? { id: 'burn', t: tags.burnDur || 3, p: (tags.burnDps || 0.4) * game.combat.powerOf(p) } : null;
  game.combat.aoe(p, { x: d.x, y: d.y, r, dmg: coef, knockback: 5, type: 'magic', status, tags: TAG_DECOY,
    fx: { type: 'smoke', r, dur: 1.2 }, color: N.colors.shadow, shake: tags ? 0.4 : 0.2 });
  game.fx({ type: 'burst', x: d.x, y: d.y, n: tags ? 24 : 14, r, color: tags ? '#ff7a2f' : N.colors.shadow });
  game.fx({ type: 'poof', x: d.x, y: d.y, color: N.colors.shadow });
  if (tags) {
    game.fx({ type: 'ring', x: d.x, y: d.y, r, color: N.colors.sash, dur: 0.45 });
    enemyZone(game, p, { x: d.x, y: d.y, r: r * 0.8, dur: tags.fireDur || 3, element: 'fire', tick: 0.5, dmg: 0.15, silent: true });
  }
  p.data.kit.nj.bursts++;
}
function shadowStep(game, p, ctx) {
  const N = nk(game), S = N.shadowStep, nj = p.data.kit.nj, C = N.colors;
  const t = nearestEnemy(game, p, p.x, p.y, S.range, 0);
  const x0 = p.x, y0 = p.y;
  const d = game.combat.decoy(p, { ttl: S.decoy.ttl, hp: Math.max(5, Math.round(p.hpMax * S.decoy.hpMul)), power: game.combat.powerOf(p),
    onExpire: (g, e) => decoyBurst(g, p, e), onDeath: (g, e) => decoyBurst(g, p, e) });
  d.alpha = 0.85;
  nj.decoyId = d.id;
  // Enemies switch to the decoy right away.
  const list = game.ents.inRadius(x0, y0, 8, isEnemy, nj.scratch);
  for (let i = 0; i < list.length; i++) { const e = list[i]; if (e.ai && e.ai.target === p.id) e.ai.target = d.id; }
  game.fx({ type: 'afterimage', x: x0, y: y0, ent: p.id, color: C.shadow });
  game.fx({ type: 'smoke', x: x0, y: y0, r: 0.8, dur: 0.6 });
  if (t) {
    behindPoint(game, t, x0, y0, p.radius + 0.45, nj.pt);
    game.physics.teleport(p, nj.pt.x, nj.pt.y);
    game.physics.resolve(p);
    p.angle = angleTo(p.x, p.y, t.x, t.y);
    p.data.faceT = 0.3;
  } else {
    game.abilities.use('blink', p, { angle: ctx.moveAngle, dist: S.ahead, invuln: 0.2, color: C.shadow, fx: false });
  }
  game.combat.status(p, 'invuln', 0.2);
  game.ents.setAnim(p, 'dash', 0.15);
  game.fx({ type: 'trail', x: x0, y: y0, x2: p.x, y2: p.y, color: C.shadow });
  game.fx({ type: 'poof', x: p.x, y: p.y, color: C.shadow });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 8, r: 0.5, color: C.sash });
  addPips(game, p, S.pips);
  grantCrit(game, p, N.afterimage.critWindow);
  nj.steps++;
  // Clone Mastery: every clone steps too, leaving a smoke burst behind.
  if (hasBoon(game, 'clone_mastery') && nj.clones.length) {
    const cm = boonData(game, 'clone_mastery');
    for (let i = 0; i < nj.clones.length; i++) {
      const c = game.ents.get(nj.clones[i]);
      if (!c || c.removed) continue;
      const ct = nearestEnemy(game, p, c.x, c.y, S.range, t ? t.id : 0) || t;
      game.combat.aoe(p, { x: c.x, y: c.y, r: 1.4, dmg: cm.decoyCoef || 1, knockback: 4, type: 'magic', tags: TAG_DECOY, fx: { type: 'smoke', r: 1.4, dur: 0.8 }, color: C.shadow });
      if (ct) {
        game.fx({ type: 'afterimage', x: c.x, y: c.y, ent: c.id, color: C.shadow });
        behindPoint(game, ct, c.x, c.y, c.radius + 0.45, nj.pt);
        game.physics.teleport(c, nj.pt.x, nj.pt.y);
        c.angle = angleTo(c.x, c.y, ct.x, ct.y);
        game.fx({ type: 'poof', x: c.x, y: c.y, color: C.shadow });
      }
      nj.cloneSteps++;
    }
  }
}

// ---------- Shadow Clones ----------
function shadowClones(game, p) {
  const N = nk(game), K = N.clones, nj = p.data.kit.nj, C = N.colors;
  const pips = spendPips(game, p);
  const n = pips >= game.kits.resource(p).max ? K.nFull : K.n;
  dismissClones(game, p);
  for (let i = 0; i < n; i++) {
    const a = p.angle + Math.PI / 2 + (i - (n - 1) / 2) * (Math.PI / Math.max(1, n)) + Math.PI;
    const look = clone(p.look);
    look.aura = { style: 'shadow', color: C.shadow };
    const c = game.combat.summon(p, { id: 'shadow_clone', name: 'Shadow Clone', look, stats: { radius: p.radius } }, {
      x: p.x + Math.cos(a) * K.dist, y: p.y + Math.sin(a) * K.dist, brain: 'none', fxTag: 'shadow', ttl: K.dur, power: game.combat.powerOf(p),
      hp: Math.max(5, Math.round(p.hpMax * K.hpMul)), key: 'shadow_clone', color: C.shadow, speed: p.stats.speed * 1.2, tags: ['clone'] });
    c.alpha = 0.6;
    c.data.njSlot = i - (n - 1) / 2;
    nj.clones.push(c.id);
    game.fx({ type: 'pillar', x: c.x, y: c.y, r: 0.6, color: C.shadow, dur: 0.5 });
  }
  game.fx({ type: 'screenFlash', color: C.main, dur: 0.18 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 2.2, color: C.sash, dur: 0.5 });
  game.fx({ type: 'smoke', x: p.x, y: p.y, r: 1.6, dur: 1 });
  game.camera.shake = Math.max(game.camera.shake, 0.4);
  game.ents.setAnim(p, 'cast', 0.3);
}
function dismissClones(game, p) {
  const nj = p.data.kit.nj;
  for (const id of nj.clones) { const c = game.ents.get(id); if (c && !c.removed) game.combat.expireSummon(c, 'dismiss'); }
  nj.clones.length = 0;
}
function updateClones(game, p, dt) {
  const nj = p.data.kit.nj, K = nk(game).clones;
  for (let i = nj.clones.length - 1; i >= 0; i--) {
    const c = game.ents.get(nj.clones[i]);
    if (!c || c.removed || !c.alive) { nj.clones[i] = nj.clones[nj.clones.length - 1]; nj.clones.pop(); continue; }
    // Formation beside and slightly behind the ninja.
    const slot = c.data.njSlot || 0;
    const a = p.angle + Math.PI + slot * 1.4;
    const tx = p.x + Math.cos(a) * K.dist, ty = p.y + Math.sin(a) * K.dist;
    const dx = tx - c.x, dy = ty - c.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 6) { game.physics.teleport(c, tx, ty); continue; }
    const sp = d > 0.15 ? Math.min(c.stats.speed * 1.5, d * 8) : 0;
    c.vx = d > 0 ? (dx / d) * sp : 0; c.vy = d > 0 ? (dy / d) * sp : 0;
    c.data.faceT = 0.1;
    c.angle = p.angle;
  }
  void dt;
}

export default {
  id: 'ninja', parent: 'rogue',
  basicMode: 'auto',
  interval(game) { return nk(game).shuriken.interval; },
  basicInfo(game, p, rank) { return game.kits.registry.rogue.basicInfo(game, p, rank); },

  onEquip(game, p) {
    p.data.kit.nj = { scratch: [], pt: { x: 0, y: 0 }, aiT: 0, orbit: [], orbitA: 0, clones: [], decoyId: 0, subReadyT: 0, subs: 0,
      caught: 0, steps: 0, cloneSteps: 0, bursts: 0, subTag: false };
  },
  onUnequip(game, p) {
    const nj = p.data.kit.nj;
    if (!nj) return;
    dismissClones(game, p);
    for (const o of nj.orbit) { const e = game.ents.get(o.id); if (e && !e.removed) game.ents.remove(e); }
    nj.orbit.length = 0;
    game.ents.setFxTag(p, 'shadow', false);
  },

  update(game, p, dt) {
    const nj = p.data.kit.nj, N = nk(game);
    if (!nj) return;
    // Afterimage trail while moving.
    if ((p.vx !== 0 || p.vy !== 0) && !p.data.down) {
      nj.aiT -= dt;
      if (nj.aiT <= 0) { nj.aiT = N.afterimage.every; game.fx({ type: 'afterimage', x: p.x, y: p.y, ent: p.id, color: N.colors.main }); }
    } else nj.aiT = 0;
    updateOrbit(game, p, dt);
    updateClones(game, p, dt);
    // Substitution readiness is shown as the shadow fxTag on the ninja.
    const subReady = hasBoon(game, 'substitution') && game.t >= nj.subReadyT;
    if (subReady !== nj.subTag) { nj.subTag = subReady; game.ents.setFxTag(p, 'shadow', subReady); }
  },

  hud(game, p, hud) {
    const nj = p.data.kit.nj, kh = game.kits.kitHud;
    hud.kitHud = kh;
    if (!nj) return;
    if (nj.clones.length) kh.label = LABEL_CLONES;
    else if (nj.subTag) kh.label = LABEL_SUB;
    else if (kh.label === 'Combo') kh.label = LABEL_STEP;
  },

  basic: shuriken,

  abilities: {
    f: { id: 'shadow_step', name: META.shadow_step.name, icon: META.shadow_step.icon, desc: META.shadow_step.desc,
      unlock: META.shadow_step.unlock, cd: META.shadow_step.cd, cast: shadowStep },
    shift: { id: 'shadow_clones', name: META.shadow_clones.name, icon: META.shadow_clones.icon, desc: META.shadow_clones.desc,
      unlock: META.shadow_clones.unlock, cd: META.shadow_clones.cd, cast: shadowClones,
      isActive(game, p) { return !!(p.data.kit.nj && p.data.kit.nj.clones.length); } },
  },

  hooks: {
    onCatch(game, p, e) {
      const proj = e.proj, nj = p.data.kit.nj;
      if (!nj || !proj || !proj.data.proj || proj.data.proj.tags !== TAG_BASIC || proj.data.proj.speed === 0) return;
      if (hasBoon(game, 'blade_storm') && startOrbit(game, p, proj)) return;
      game.abilities.reduce(p, 'f', nk(game).shuriken.catchCdr);
      nj.caught++;
    },
    onIncoming(game, p, info) {
      const nj = p.data.kit.nj;
      if (!nj || info.target !== p || !hasBoon(game, 'substitution') || game.t < nj.subReadyT) return;
      if (!(info.amount > 0) || (info.opts && info.opts.dot) || info.type === 'true' || !info.source) return;
      const b = boonData(game, 'substitution');
      info.cancel = true;
      nj.subReadyT = game.t + (b.cd || 12);
      nj.subs++;
      const x0 = p.x, y0 = p.y;
      game.fx({ type: 'poof', x: x0, y: y0, color: '#c8a26a' });
      game.fx({ type: 'text', x: x0, y: y0, z: 1.5, text: 'Substitution!', style: 'miss' });
      game.ents.create({ kind: 'decoy_puff', type: 'effect', team: 'neutral', x: x0, y: y0, solid: false, ttl: 0.8,
        look: { rig: 'effect', model: 'decoy_puff', color: '#c8a26a', r: 0.5 } });
      const away = info.source ? angleTo(info.source.x, info.source.y, x0, y0) : p.angle + Math.PI;
      const a = away + (game.rng.next() - 0.5) * 1.6;
      if (!game.abilities.use('blink', p, { angle: a, dist: b.dist || 2, invuln: 0.4, color: nk(game).colors.shadow })) {
        game.combat.status(p, 'invuln', 0.4);
      }
      grantCrit(game, p, nk(game).afterimage.critWindow);
    },
  },
};
