// Battlemage spec kit (docs/CLASSES.md "Battlemage — stance and combos"). Passive Runic Edge (the blade carries
// Fire / Frost / Storm: held.glow, level-10 aura and fxTag follow it; fire burns, frost slows and freezes on the third
// stack, storm chains to 2 enemies for 50%), Rune Slash (rank III: Elemental Wave every third swing; rank IV: every
// second, piercing, leaving element ground or a storm chain of 4), F Rune Shift (cycle + nova of the new element),
// Shift Runestorm (planted blade: fire pillar ring, frost ring, six storm bolts). Boons: Elemental Overlap,
// Twin Runes, Rune Trail, Encore; round 3: Trinity Slash, Elemental Crown; rank V Rune Tempest (dual-element waves).
import { W, TAG_BASIC, TAG_SKILL } from './warrior.js';
import SPECDEFS from '../../data/specs/warrior.js';

const S = SPECDEFS.battlemage;
const N = (game) => W.snums(game, 'battlemage');
const C = (game) => W.sdef(game, 'battlemage').colors;
export const ELEMENTS = Object.freeze(['fire', 'frost', 'storm']);
const TAGS = Object.freeze(['rune_fire', 'rune_frost', 'rune_storm']);
const STANCE = Object.freeze(['Fire', 'Frost', 'Storm']);
const AURA_STYLE = Object.freeze(['flame', 'frost', 'storm']);
const TAG_CHAIN = Object.freeze(['wskill', 'rune_chain']);
const AURAS = {};
const chainHit = [];

const colorOf = (game, i) => C(game)[ELEMENTS[i]];
function elIndex(name) { const i = ELEMENTS.indexOf(name); return i < 0 ? 0 : i; }

function setElement(game, p, i) {
  const k = p.data.kit, bm = k.bm;
  if (bm.el !== i) bm.prev = bm.el;
  bm.el = i;
  for (let j = 0; j < 3; j++) game.ents.setFxTag(p, TAGS[j], j === i);
  const lp = k.lookPatch || (k.lookPatch = {});
  const held = W.sdef(game, 'battlemage').look.held;
  lp.held = { style: 'runeblade', color: held.color, glow: colorOf(game, i) };
  W.refresh(game, p);
}

/** Storm: arc from `from` to up to n other enemies within range for `amount` each (bolt fx between them).
 *  hop: each arc starts from the previous target (a chain); otherwise all arcs fan out from `from`. */
function stormChain(game, p, from, amount, n, range, hop) {
  chainHit.length = 0;
  chainHit.push(from);
  let fx = from.x, fy = from.y;
  const col = colorOf(game, 2);
  for (let j = 0; j < n; j++) {
    let best = null, bd = range * range;
    const list = game.ents.inRadius(fx, fy, range, null);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (chainHit.indexOf(e) >= 0 || !game.combat.canHit(p, e)) continue;
      const d = (e.x - fx) * (e.x - fx) + (e.y - fy) * (e.y - fy);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) break;
    chainHit.push(best);
    game.fx({ type: 'bolt', x: fx, y: fy, x2: best.x, y2: best.y, color: col });
    game.combat.damage(best, amount, { source: p, type: 'magic', element: 'storm', color: col, tags: TAG_CHAIN, knockback: 0.5 });
    if (hop) { fx = best.x; fy = best.y; }
  }
  return chainHit.length - 1;
}

function detonate(game, p, t, a, b) {
  const ov = W.bnums(game, 'elemental_overlap'), col = C(game);
  const has = (x) => a === x || b === x;
  if (has(0) && has(1)) {          // fire + frost: steam burst
    game.combat.aoe(p, { x: t.x, y: t.y, r: ov.steam.r, dmg: ov.steam.dmg, knockback: 6, type: 'magic', element: 'fire', tags: TAG_CHAIN,
      fx: 'burst', color: col.steam });
    game.fx({ type: 'smoke', x: t.x, y: t.y, r: ov.steam.r, dur: 1.2 });
    game.fx({ type: 'text', x: t.x, y: t.y, z: 1.5, text: 'Steam!', style: 'info', ent: t.id });
  } else if (has(1) && has(2)) {   // frost + storm: shatter
    game.combat.damage(t, ov.shatter.dmg * game.combat.powerOf(p), { source: p, type: 'magic', element: 'frost', tags: TAG_CHAIN,
      status: { stun: ov.shatter.stun }, color: col.frost, knockback: 4 });
    game.fx({ type: 'burst', x: t.x, y: t.y, n: 22, r: ov.shatter.r, color: col.frost });
    game.fx({ type: 'sparkle', x: t.x, y: t.y, n: 14, r: ov.shatter.r, color: '#ffffff' });
    game.fx({ type: 'text', x: t.x, y: t.y, z: 1.5, text: 'Shatter!', style: 'info', ent: t.id });
  } else {                         // fire + storm: plasma
    game.combat.aoe(p, { x: t.x, y: t.y, r: ov.plasma.r, dmg: ov.plasma.dmg, knockback: 5, type: 'magic', element: 'storm', tags: TAG_CHAIN,
      fx: 'ring', color: col.plasma });
    game.fx({ type: 'bolt', x: t.x, y: t.y, color: col.plasma });
    game.fx({ type: 'burst', x: t.x, y: t.y, n: 18, r: ov.plasma.r, color: col.plasma });
    game.fx({ type: 'text', x: t.x, y: t.y, z: 1.5, text: 'Plasma!', style: 'info', ent: t.id });
  }
  game.camera.shake = Math.max(game.camera.shake, 0.25);
  game.bus.emit('rune:overlap', { ent: p, target: t, a: ELEMENTS[a], b: ELEMENTS[b] });
}

/** Apply element i's effect to target t (hit for `dealt`). */
function applyElement(game, p, t, i, dealt) {
  if (!t || t.removed || !t.alive) return;
  const n = N(game);
  if (W.has(game, p, 'elemental_overlap')) {
    const ov = W.bnums(game, 'elemental_overlap');
    const m = t.data.bmEl;
    if (m && m.el !== i && game.t - m.t <= ov.window && game.t >= m.cd) {
      const was = m.el;
      m.el = i; m.t = game.t; m.cd = game.t + (ov.icd || 0);   // the new element now rides the target: keep dancing
      detonate(game, p, t, was, i);
      if (!t.alive || t.removed) return;
    } else if (m) { m.el = i; m.t = game.t; } else t.data.bmEl = { el: i, t: game.t, cd: 0 };
  }
  if (i === 0) game.combat.status(t, 'burn', n.fire.burnDur, n.fire.burnCoef * game.combat.powerOf(p), p);
  else if (i === 1) game.combat.status(t, 'frost', n.frost.slowDur, n.frost.slow, p);
  else if (dealt > 0) stormChain(game, p, t, dealt * n.storm.frac, n.storm.chain, n.storm.range);
}

// ---- callbacks (module level) ----
function slashHit(game, t, dealt, src) { const bm = src.data.kit && src.data.kit.bm; if (bm) applyElement(game, src, t, bm.el, dealt); }
function novaHit(game, t, dealt, src) { const bm = src.data.kit && src.data.kit.bm; if (bm) applyElement(game, src, t, bm.el, dealt); }
function waveHit(game, t, dealt, proj) {
  const p = game.ents.get(proj.owner);
  if (!p || !p.data.kit || !p.data.kit.bm) return;
  const i = elIndex(proj.data.proj.element);
  applyElement(game, p, t, i, dealt);
  // round 3, rank V: the wave carries a second element (the previous one) as well
  const d = proj.data.bmDual;
  if (d != null && d >= 0 && d !== i && t.alive && !t.removed) applyElement(game, p, t, d, dealt * 0.5);
  if (!proj.data.bmRank4) return;
  const g = N(game).ground;
  if (i === 2) {
    if (!proj.data.bmChained) { proj.data.bmChained = true; stormChain(game, p, t, dealt * N(game).storm.frac, g.stormChain, 4, true); }
  } else if ((proj.data.bmZones || 0) < 2) {
    proj.data.bmZones = (proj.data.bmZones || 0) + 1;
    groundZone(game, p, t.x, t.y, i);
  }
}
function waveEnd(game, proj) {
  if (!proj.data.bmRank4) return;
  const p = game.ents.get(proj.owner);
  if (!p) return;
  const i = elIndex(proj.data.proj.element);
  if (i !== 2) groundZone(game, p, proj.x, proj.y, i);
  else game.fx({ type: 'bolt', x: proj.x, y: proj.y, color: C(game).storm });
}
function groundZone(game, p, x, y, i) {
  const g = N(game).ground, n = N(game);
  if (i === 0) game.combat.zone(p, { x, y, r: g.r, dur: g.dur, dmg: g.dmg, element: 'fire', color: colorOf(game, 0), id: 'rune_ground',
    status: { id: 'burn', t: 1.5, p: n.fire.burnCoef * game.combat.powerOf(p) } });
  else if (i === 1) game.combat.zone(p, { x, y, r: g.r, dur: g.dur, dmg: g.dmg * 0.6, element: 'frost', color: colorOf(game, 1), id: 'rune_ground',
    status: { slow: [0.8, n.frost.slow] } });
}

function fireWave(game, p, angle, i, side, rank4, dual) {
  const w = N(game).wave;
  const col = colorOf(game, i);
  const two = dual != null && dual >= 0 && dual !== i;
  const w5 = N(game).wave5;
  const e = game.abilities.use('projectile', p, { angle, side, model: 'wave', color: col, glow: two ? colorOf(game, dual) : col,
    size: two ? w5.size : rank4 ? 1.5 : 1.2,
    speed: w.speed, range: w.range, dmg: rank4 && w.dmg4 != null ? w.dmg4 : w.dmg, radius: two ? w5.radius : w.radius, pierce: rank4 ? true : 0,
    knockback: 2.5, type: 'magic', element: ELEMENTS[i], tags: TAG_SKILL, onHit: waveHit, onExpire: waveEnd, anim: 'attack', sfx: 'spell' });
  if (e && e.data) { e.data.bmRank4 = !!rank4; e.data.bmZones = 0; e.data.bmChained = false; e.data.bmDual = two ? dual : -1; }
  if (two) {
    game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: 70, r: 1.6, color: colorOf(game, dual), style: 'crescent' });
    p.data.kit.bm.duals = (p.data.kit.bm.duals || 0) + 1;
  }
  return e;
}

/** round 3 boon Trinity Slash: a burst of all three elements around you. */
function trinityHit(game, t, dealt, src) {
  if (!src.data.kit || !src.data.kit.bm) return;
  for (let j = 0; j < 3; j++) { if (!t.alive || t.removed) return; applyElement(game, src, t, j, dealt); }
}
function trinity(game, p) {
  const b = W.bnums(game, 'trinity_slash'), col = C(game);
  game.combat.aoe(p, { x: p.x, y: p.y, r: b.r, dmg: b.dmg, knockback: 4, type: 'magic', tags: TAG_SKILL, onHit: trinityHit,
    fx: { type: 'ring', r: b.r, color: col.storm, dur: 0.4 } });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.8, color: col.fire, dur: 0.5 });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 18, r: b.r, color: col.frost });
  game.fx({ type: 'bolt', x: p.x, y: p.y, color: col.storm });
  game.fx({ type: 'shockwave', x: p.x, y: p.y, r: b.r, color: col.plasma });
  p.data.kit.bm.trinities = (p.data.kit.bm.trinities || 0) + 1;
}
/** round 3 boon Elemental Crown: the current element strikes the nearest enemy every `every` s. */
function crownStrike(game, p, bm) {
  const b = W.bnums(game, 'elemental_crown');
  let best = null, bd = b.range * b.range;
  const list = game.ents.inRadius(p.x, p.y, b.range, null);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!game.combat.canHit(p, e) || e.type !== 'enemy') continue;
    const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return false;
  const col = colorOf(game, bm.el);
  if (bm.el === 2) game.fx({ type: 'bolt', x: p.x, y: p.y, x2: best.x, y2: best.y, color: col });
  else game.fx({ type: 'trail', x: p.x, y: p.y, x2: best.x, y2: best.y, color: col });
  game.fx({ type: bm.el === 1 ? 'sparkle' : 'burst', x: best.x, y: best.y, n: 10, r: 0.6, color: col });
  const dealt = game.combat.damage(best, b.dmg * game.combat.powerOf(p), { source: p, type: 'magic', element: ELEMENTS[bm.el], color: col,
    tags: TAG_SKILL, knockback: 1 });
  applyElement(game, p, best, bm.el, dealt);
  bm.crowns = (bm.crowns || 0) + 1;
  return true;
}

function pulse(game, p, st, kind) {
  const rs = N(game).runestorm, col = C(game);
  const x = st.x, y = st.y;
  if (kind === 0) {
    for (let i = 0; i < rs.pillars; i++) {
      const a = i * Math.PI * 2 / rs.pillars + 0.3;
      game.fx({ type: 'pillar', x: x + Math.cos(a) * rs.pillarR, y: y + Math.sin(a) * rs.pillarR, r: 0.7, color: col.fire, dur: 0.9 });
    }
    game.combat.aoe(p, { x, y, r: rs.r * 0.8, dmg: rs.dmg, knockback: 5, type: 'magic', element: 'fire', tags: TAG_SKILL,
      fx: 'shockwave', color: col.fire, onHit: pulseHit0 });
  } else if (kind === 1) {
    game.combat.aoe(p, { x, y, r: rs.r, dmg: rs.dmg, knockback: 3, type: 'magic', element: 'frost', tags: TAG_SKILL,
      fx: { type: 'ring', r: rs.r, color: col.frost, dur: 0.8 }, onHit: pulseHit1 });
    game.fx({ type: 'burst', x, y, n: 30, r: rs.r * 0.7, color: col.frost });
  } else {
    let n = 0;
    const list = game.ents.inRadius(x, y, rs.r, null).slice();
    const foes = list.filter((e) => game.combat.canHit(p, e));
    for (let b = 0; b < rs.bolts; b++) {
      const t = foes.length ? foes[b % foes.length] : null;
      if (t && t.alive && !t.removed) {
        game.fx({ type: 'bolt', x: t.x, y: t.y, color: col.storm });
        const d = game.combat.damage(t, rs.dmg * game.combat.powerOf(p), { source: p, type: 'magic', element: 'storm', color: col.storm,
          tags: TAG_SKILL, knockback: 1 });
        if (d > 0) n++;
      } else {
        const a = game.rng.next() * Math.PI * 2, r = game.rng.next() * rs.r;
        game.fx({ type: 'bolt', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, color: col.storm });
      }
    }
    game.fx({ type: 'screenFlash', x, y, color: col.storm, dur: 0.15 });
  }
  game.camera.shake = Math.max(game.camera.shake, 0.35);
  game.bus.emit('sfx', { id: 'spell' });
}
function pulseHit0(game, t, dealt, src) { if (src.data.kit && src.data.kit.bm) applyElement(game, src, t, 0, dealt); }
function pulseHit1(game, t, dealt, src) { if (src.data.kit && src.data.kit.bm) applyElement(game, src, t, 1, dealt); }

export default {
  id: 'battlemage',
  parent: 'warrior',
  interval(game, p, r) { return r >= 3 ? N(game).slash.interval : W.nums(game).sword_arc.interval; },
  basicInfo(game, p, r) {
    if (r < 3) return W.cdef(game).ranks[Math.max(1, r)];
    const ranks = W.sdef(game, 'battlemage').ranks;
    return ranks[r] || ranks[4] || ranks[3];
  },

  onEquip(game, p) {
    const k = p.data.kit;
    k.bm = { el: 0, prev: 2, slashes: 0, storm: null, crownT: 0 };
    k.offFreeze = game.bus.on('status', (e) => {
      if (e.id !== 'freeze' || !e.ent || p.data.kit !== k) return;
      const t = e.ent;
      game.fx({ type: 'sparkle', x: t.x, y: t.y, n: 12, r: 0.7, color: C(game).frost });
      game.fx({ type: 'ring', x: t.x, y: t.y, r: 0.9, color: '#ffffff', dur: 0.3 });
    });
    setElement(game, p, 0);
  },
  onUnequip(game, p) {
    const k = p.data.kit;
    if (k.offFreeze) { k.offFreeze(); k.offFreeze = null; }
    for (let j = 0; j < 3; j++) game.ents.setFxTag(p, TAGS[j], false);
  },
  /** Level-10 aura follows the element (warrior W.refresh extension hook). */
  aura(game, p) {
    const bm = p.data.kit && p.data.kit.bm;
    if (!bm || game.kits.level(p) < 10) return null;
    const key = bm.el + '|' + colorOf(game, bm.el);
    return AURAS[key] || (AURAS[key] = Object.freeze({ style: AURA_STYLE[bm.el], color: colorOf(game, bm.el) }));
  },
  /** Rune Trail: Shield Bash leaves a trail of the current element (warrior extension hook). */
  onBashEnd(game, p, x0, y0, x1, y1) {
    const bm = p.data.kit && p.data.kit.bm;
    if (!bm || !W.has(game, p, 'rune_trail')) return;
    const b = W.bnums(game, 'rune_trail');
    const n = N(game);
    const dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.round(len / b.step));
    const col = colorOf(game, bm.el);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + dx * i / steps, y = y0 + dy * i / steps;
      const o = { x, y, r: b.r, dur: b.dur, dmg: b.dmg, color: col, id: 'rune_trail', tick: 0.5 };
      if (bm.el === 0) { o.element = 'fire'; o.status = { id: 'burn', t: 1.5, p: n.fire.burnCoef * game.combat.powerOf(p) }; }
      else if (bm.el === 1) { o.element = 'frost'; o.status = { slow: [0.8, n.frost.slow] }; }
      else { o.element = 'storm'; o.onTick = trailTick; }
      game.combat.zone(p, o);
    }
    game.fx({ type: 'trail', x: x0, y: y0, x2: x1, y2: y1, color: col });
  },

  update(game, p, dt) {
    const bm = p.data.kit.bm;
    if (!bm) return;
    if (W.has(game, p, 'elemental_crown')) {
      bm.crownT -= dt;
      if (bm.crownT <= 0) bm.crownT = crownStrike(game, p, bm) ? W.bnums(game, 'elemental_crown').every : 0.25;
    }
    if (!bm.storm) return;
    const st = bm.storm;
    const rs = N(game).runestorm;
    const el = game.t - st.t0;
    while (st.stage < 3 && el >= rs.times[st.stage]) { pulse(game, p, st, st.stage); st.stage++; }
    if (st.stage === 3 && st.encore && el >= rs.encoreAt) {
      st.stage = 4;
      pulse(game, p, st, Math.floor(game.rng.next() * 3));
      game.fx({ type: 'text', x: st.x, y: st.y, z: 1.8, text: 'Encore!', style: 'info', ent: p.id });
    }
    if (el >= (st.encore ? rs.encoreAt + 0.2 : rs.dur)) {
      game.fx({ type: 'poof', x: st.x, y: st.y, color: colorOf(game, bm.el) });
      if (st.ent && !st.ent.removed) game.ents.remove(st.ent);
      bm.storm = null;
    }
  },

  hud(game, p, hud) {
    const bm = p.data.kit.bm;
    if (!bm) return;
    const kh = game.kits.kitHud;
    kh.stance = STANCE[bm.el];
    hud.kitHud = kh;
  },

  basic(game, p, ctx) {
    if (ctx.rank < 3) return W.classBasic(game, p, ctx);
    const bm = p.data.kit.bm;
    const n = N(game);
    bm.slashes++;
    const col = colorOf(game, bm.el);
    game.abilities.use('melee_arc', p, { angle: ctx.angle, arc: n.slash.arc, range: n.slash.range, dmg: n.slash.dmg,
      knockback: n.slash.knockback, tags: TAG_BASIC, style: 'sword', color: col, element: ELEMENTS[bm.el], onHit: slashHit });
    const r4 = ctx.rank >= 4, r5 = ctx.rank >= 5;
    if (bm.slashes % (r4 ? n.wave.every4 : n.wave.every) === 0) {
      if (W.has(game, p, 'twin_runes')) {
        const sp = W.bnums(game, 'twin_runes').spread || 0.08;
        fireWave(game, p, ctx.angle - sp, bm.el, -n.wave.twinSide, r4, r5 ? bm.prev : -1);
        fireWave(game, p, ctx.angle + sp, bm.prev, n.wave.twinSide, r4, r5 ? bm.el : -1);
      } else fireWave(game, p, ctx.angle, bm.el, 0, r4, r5 ? bm.prev : -1);
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 8, r: 0.6, color: col });
    }
    if (W.has(game, p, 'trinity_slash') && bm.slashes % (W.bnums(game, 'trinity_slash').every || 5) === 0) trinity(game, p);
    W.afterBasic(game, p, ctx.angle);
    return undefined;
  },

  abilities: {
    f: W.ability(S.abilities, 'rune_shift', {
      cast(game, p) {
        const bm = p.data.kit.bm;
        const n = N(game).rune_shift;
        const next = (bm.el + 1) % 3;
        setElement(game, p, next);
        const col = colorOf(game, next);
        game.combat.aoe(p, { x: p.x, y: p.y, r: n.r, dmg: n.dmg, knockback: n.knockback, type: 'magic', element: ELEMENTS[next],
          tags: TAG_SKILL, fx: { type: 'ring', r: n.r, color: col, dur: 0.45 }, onHit: novaHit });
        game.fx({ type: 'burst', x: p.x, y: p.y, n: 20, r: n.r * 0.8, color: col });
        if (next === 0) game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.8, color: col, dur: 0.5 });
        else if (next === 1) game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 18, r: n.r, color: '#ffffff' });
        else game.fx({ type: 'bolt', x: p.x, y: p.y, color: col });
        game.ents.setAnim(p, 'cast', 0.25);
        game.bus.emit('sfx', { id: 'spell' });
        game.bus.emit('rune:shift', { ent: p, element: ELEMENTS[next] });
        return undefined;
      },
    }),
    shift: W.ability(S.abilities, 'runestorm', {
      cast(game, p) {
        const bm = p.data.kit.bm;
        const rs = N(game).runestorm, col = C(game);
        if (bm.storm && bm.storm.ent && !bm.storm.ent.removed) game.ents.remove(bm.storm.ent);
        const ent = game.ents.create({ kind: 'runestorm', type: 'effect', team: p.team, owner: p.id, x: p.x, y: p.y, solid: false,
          look: { rig: 'effect', model: 'zone_ring', color: colorOf(game, bm.el), r: rs.r }, ttl: rs.encoreAt + 0.5 });
        bm.storm = { x: p.x, y: p.y, t0: game.t, stage: 0, encore: W.has(game, p, 'encore'), ent };
        game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.6, color: '#ffffff', dur: rs.dur });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: rs.r, color: col.storm, dur: 0.6 });
        game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: '#fff1d6', dur: 0.2 });
        game.camera.shake = Math.max(game.camera.shake, 0.3);
        game.ents.setAnim(p, 'cast', 0.4);
        return undefined;
      },
      isActive(game, p) { return !!(p.data.kit.bm && p.data.kit.bm.storm); },
    }),
  },

  hooks: {},
};

function trailTick(game, z, inside) {
  const p = game.ents.get(z.owner);
  if (!p || !inside.length) return;
  const t = inside[0];
  game.fx({ type: 'bolt', x: z.x, y: z.y, x2: t.x, y2: t.y, color: '#ffe14d' });
  game.combat.damage(t, W.bnums(game, 'rune_trail').dmg * game.combat.powerOf(p), { source: p, type: 'magic', element: 'storm',
    color: '#ffe14d', tags: TAG_CHAIN, knockback: 0 });
}
