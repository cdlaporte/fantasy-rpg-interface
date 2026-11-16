// Spellblade mastery (tier 3, layered over battlemage; docs/MASTERY.md). Combo duelist.
// Passive Spellweave: each Rune Shift charges the next 3 swings with the new element (kit HUD pips, the hero glows
// in the element color). Charged swings are 25% quicker and add: Fire -> an exploding flame cone (burn), Frost -> a fan
// of five ice shards (frost), Storm -> lightning from the sky that chains to 3 enemies. The third charged swing ends the
// combo with a shockwave of the element ("Combo!"). Shift Prismatic Edge (unlock 15): nine teleport-slashes from enemy
// to enemy cycling fire / frost / storm (invulnerable), then a prismatic X-slash blast.
import { W, TAG_SKILL } from './warrior.js';
import BM, { ELEMENTS } from './battlemage.js';
import { MW } from './paladin.js';

const ID = 'spellblade';
const N = (game) => MW.nums(game, ID);
const C = (game) => MW.colors(game, ID);
const BC = (game) => W.sdef(game, 'battlemage').colors;
const BN = (game) => W.snums(game, 'battlemage');
const elColor = (game, i) => BC(game)[ELEMENTS[i]];
const foes = [];
const FROST_SHARD = { id: 'frost', t: 2, p: 0.4 };

/** The element's effect on t (burn / frost; storm is the chain itself). */
function applyEl(game, p, t, i) {
  if (!t || t.removed || !t.alive) return;
  const n = BN(game);
  if (i === 0) game.combat.status(t, 'burn', n.fire.burnDur, n.fire.burnCoef * game.combat.powerOf(p), p);
  else if (i === 1) game.combat.status(t, 'frost', n.frost.slowDur, n.frost.slow, p);
}
function fireHit(game, t, dealt, src) { applyEl(game, src, t, 0); }
function edgeHit(game, t, dealt, src) { const sb = src.data.kit && src.data.kit.sb; if (sb && sb.edge) applyEl(game, src, t, sb.edge.el); }

function empowered(game, p, sb, angle) {
  const n = N(game).spellweave, i = sb.el, col = elColor(game, i);
  const fx = p.x + Math.cos(angle) * 1.4, fy = p.y + Math.sin(angle) * 1.4;
  if (i === 0) {
    game.combat.aoe(p, { x: p.x, y: p.y, shape: 'cone', angle, arc: n.fireArc, r: n.fireR, dmg: n.fireDmg, knockback: 5, type: 'magic',
      element: 'fire', tags: TAG_SKILL, onHit: fireHit, fx: false });
    game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: n.fireArc, r: n.fireR, color: col, style: 'crescent', w: 2 });
    game.fx({ type: 'meteor', x: fx, y: fy, r: 1, color: col });
    game.fx({ type: 'burst', x: fx, y: fy, n: 16, r: 1.2, color: '#ffd27a' });
  } else if (i === 1) {
    game.abilities.use('multishot', p, { angle, n: n.frostN, spread: n.frostSpread, model: 'ice', color: col, glow: '#ffffff', size: 1.2,
      speed: 13, range: n.frostRange, dmg: n.frostDmg, radius: 0.25, pierce: 1, knockback: 1.5, type: 'magic', element: 'frost',
      status: FROST_SHARD, tags: TAG_SKILL, anim: 'attack' });
    game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: n.frostSpread + 30, r: 1.6, color: col, style: 'crescent', w: 2 });
    game.fx({ type: 'sparkle', x: fx, y: fy, n: 16, r: 1, color: '#ffffff' });
  } else {
    game.fx({ type: 'bolt', x: fx, y: fy, color: col });
    game.fx({ type: 'bolt', x: fx + 0.3, y: fy - 0.2, color: '#ffffff' });
    game.abilities.use('chain', p, { x: fx, y: fy, range: n.stormRange, jumps: n.stormJumps, dmg: n.stormDmg, falloff: 1, color: col,
      element: 'storm', knockback: 1 });
    game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: 120, r: 1.6, color: col, style: 'crescent', w: 2 });
  }
  sb.charges--;
  sb.used++;
  if (sb.charges === 0) {
    // the third charged swing finishes the combo
    game.combat.aoe(p, { x: p.x, y: p.y, r: n.finR, dmg: n.finDmg, knockback: 6, type: 'magic', element: ELEMENTS[i], tags: TAG_SKILL,
      onHit: i === 0 ? fireHit : i === 1 ? frostFin : null, fx: 'shockwave', color: col, shake: 0.3 });
    game.fx({ type: 'ring', x: p.x, y: p.y, r: n.finR + 0.6, color: C(game).prism, dur: 0.5 });
    game.fx({ type: 'text', x: p.x, y: p.y, z: 1.7, text: 'Combo!', style: 'info', ent: p.id });
    sb.combos++;
    p.glow = null;
  }
}
function frostFin(game, t, dealt, src) { applyEl(game, src, t, 1); }

function strike(game, p, sb) {
  const e = sb.edge, n = N(game).edge;
  const i = e.i % 3, col = elColor(game, i);
  e.el = i;
  game.combat.status(p, 'invuln', n.every + 0.25);
  MW.foes(game, p, e.x0, e.y0, n.range, foes);
  // the nearest enemy to where you are now, not the one you just struck (unless it is the only one)
  let t = null, bd = 1e9;
  for (let k = 0; k < foes.length; k++) {
    const f = foes[k];
    if (f.id === e.last && foes.length > 1) continue;
    const d = (f.x - p.x) * (f.x - p.x) + (f.y - p.y) * (f.y - p.y);
    if (d < bd) { bd = d; t = f; }
  }
  const x0 = p.x, y0 = p.y;
  let tx = p.x + Math.cos(p.angle) * 1.2, ty = p.y + Math.sin(p.angle) * 1.2;
  if (t) {
    e.last = t.id;
    const a = Math.atan2(t.y - p.y, t.x - p.x);
    // land just past the target (a dash-through); fall back to this side if that spot is a wall
    let lx = t.x + Math.cos(a) * n.behind, ly = t.y + Math.sin(a) * n.behind;
    if (game.world.solidAt && game.world.solidAt(lx, ly)) { lx = t.x - Math.cos(a) * n.behind; ly = t.y - Math.sin(a) * n.behind; }
    if (!(game.world.solidAt && game.world.solidAt(lx, ly))) {
      const ai = W.prep('afterimage', x0, y0, 0, col);
      ai.ent = p.id;
      game.fx(ai);
      // move without physics.teleport: that snaps the camera, nine snaps in a second are hard to follow; the camera
      // glides after the hero instead (the one-frame interpolation streak reads as a dash)
      p.x = lx; p.y = ly; p.kx = p.ky = 0;
      game.ents.touch();
      game.physics.resolve(p);
    }
    tx = t.x; ty = t.y;
    p.angle = Math.atan2(t.y - p.y, t.x - p.x);
  }
  game.fx({ type: 'trail', x: x0, y: y0, x2: p.x, y2: p.y, color: col });
  game.combat.aoe(p, { x: tx, y: ty, r: n.r, dmg: n.dmg, knockback: 2, type: 'magic', element: ELEMENTS[i], tags: TAG_SKILL, onHit: edgeHit,
    fx: false });
  game.fx({ type: 'slash', x: tx, y: ty, angle: p.angle + (e.i % 2 ? 0.6 : -0.6), arc: 200, r: n.r + 0.2, color: col, style: 'crescent', w: 2 });
  game.fx({ type: 'burst', x: tx, y: ty, n: 10, r: 0.8, color: col });
  if (i === 0) game.fx({ type: 'pillar', x: tx, y: ty, r: 0.6, color: col, dur: 0.4 });
  else if (i === 1) game.fx({ type: 'sparkle', x: tx, y: ty, n: 10, r: 0.8, color: '#ffffff' });
  else game.fx({ type: 'bolt', x: tx, y: ty, color: col });
  game.ents.setAnim(p, 'attack', 0.12);
  game.camera.shake = Math.max(game.camera.shake, 0.18);
  game.bus.emit('sfx', { id: 'swing' });
  e.i++;
}

function finale(game, p, sb) {
  const n = N(game).edge, col = C(game), bc = BC(game);
  sb.edge = null;
  sb.edges++;
  game.combat.aoe(p, { x: p.x, y: p.y, r: n.finR, dmg: n.finDmg, knockback: 10, type: 'magic', element: 'storm', tags: TAG_SKILL,
    fx: 'shockwave', color: col.prism, shake: 0.65 });
  game.fx({ type: 'slash', x: p.x, y: p.y, angle: Math.PI / 4, arc: 160, r: n.finR, color: bc.fire, style: 'crescent', w: 3 });
  game.fx({ type: 'slash', x: p.x, y: p.y, angle: -Math.PI / 4, arc: 160, r: n.finR, color: bc.frost, style: 'crescent', w: 3 });
  game.fx({ type: 'slash', x: p.x, y: p.y, angle: Math.PI * 0.75, arc: 160, r: n.finR, color: bc.storm, style: 'crescent', w: 3 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: n.finR + 1, color: col.white, dur: 0.7 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: n.finR * 0.6, color: col.violet, dur: 0.5 });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.2, color: col.prism, dur: 0.8 });
  game.fx({ type: 'bolt', x: p.x, y: p.y, color: bc.storm });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 36, r: n.finR, color: col.prism });
  game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: '#ffc4f4', dur: 0.3 });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 2, text: 'PRISMATIC!', style: 'info', ent: p.id });
  game.ents.setAnim(p, 'attack', 0.3);
  game.bus.emit('sfx', { id: 'spell' });
}

export default {
  id: ID,
  parent: 'battlemage',
  tier: 3,
  interval: BM.interval,
  basicInfo: BM.basicInfo,

  onEquip(game, p) {
    p.data.kit.sb = { charges: 0, el: 0, used: 0, combos: 0, edge: null, edges: 0 };
    MW.equipLook(game, p, ID);
    W.refresh(game, p);
  },
  onUnequip(game, p) {
    const sb = p.data.kit.sb;
    if (sb && sb.charges > 0) p.glow = null;
    if (sb) sb.edge = null;
  },
  /** Spellblade keeps the Battlemage element aura; this hook (run by W.refresh) re-applies the mastery blade color. */
  aura(game, p) { MW.patchHeld(game, p, ID); return null; },

  update(game, p) {
    const sb = p.data.kit.sb;
    if (!sb || !sb.edge) return;
    const e = sb.edge;
    if (game.t < e.next) return;
    if (e.i >= e.strikes) { finale(game, p, sb); return; }
    e.next += N(game).edge.every;
    strike(game, p, sb);
  },

  hud(game, p, hud) {
    const sb = p.data.kit.sb;
    if (!sb) return;
    const kh = game.kits.kitHud;
    kh.pips = sb.charges; kh.pipsMax = N(game).spellweave.charges;
    if (sb.edge) kh.stance = 'Prismatic Edge';
    hud.kitHud = kh;
  },

  basic(game, p, ctx) {
    const r = BM.basic(game, p, ctx);
    const sb = p.data.kit.sb;
    if (!sb || ctx.rank < 3 || sb.charges <= 0) return r;
    empowered(game, p, sb, ctx.angle);
    return BN(game).slash.interval * N(game).spellweave.interval;
  },

  abilities: {
    f: Object.assign({}, BM.abilities.f, {
      cast(game, p, ctx) {
        const res = BM.abilities.f.cast(game, p, ctx);
        const sb = p.data.kit.sb, bm = p.data.kit.bm;
        if (res === false || !sb || !bm) return res;
        sb.el = bm.el;
        sb.charges = N(game).spellweave.charges;
        const col = elColor(game, sb.el);
        p.glow = col;
        game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.3, color: C(game).prism, dur: 0.35 });
        game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 12, r: 0.9, color: col });
        return res;
      },
    }),
    shift: MW.ability(ID, 'prismatic_edge', {
      cast(game, p) {
        const sb = p.data.kit.sb;
        const n = N(game).edge, col = C(game);
        // Encore (Runestorm boon) carries over: three more strikes
        const strikes = n.strikes + (W.has(game, p, 'encore') ? 3 : 0);
        sb.edge = { i: 0, el: 0, next: game.t + 0.12, last: 0, x0: p.x, y0: p.y, strikes };
        game.combat.status(p, 'invuln', 0.4);   // renewed by every strike (never cleared: teacher god mode uses invuln too)
        game.fx({ type: 'ring', x: p.x, y: p.y, r: n.range, color: col.prism, dur: 0.5 });
        game.fx({ type: 'burst', x: p.x, y: p.y, n: 24, r: 1.2, color: col.white });
        game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: '#ffd8f6', dur: 0.15 });
        game.camera.shake = Math.max(game.camera.shake, 0.3);
        game.ents.setAnim(p, 'cast', 0.12);
        return undefined;
      },
      isActive(game, p) { return !!(p.data.kit.sb && p.data.kit.sb.edge); },
    }),
  },

  hooks: {
    onOutgoing(game, p, info) { const m = MW.mul(game, p, ID); if (m !== 1) info.amount *= m; },
  },
};
