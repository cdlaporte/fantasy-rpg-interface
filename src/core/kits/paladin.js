// Paladin mastery (tier 3, layered over knight; docs/MASTERY.md). Holy protector.
// Passive Dawnward: Perfect Blocks heal you and classmates nearby; every other cleave leaves a patch of sunlight
// (a gold zone that heals friends and burns foes). Shift Sanctuary (unlock 15): a huge holy dome that heals and
// protects friends inside (80% less damage) while pillars of light smite enemies inside; it ends in a blinding burst.
// Also exports `MW`, the helpers the six warrior masteries share (data, look patch, aura, balance multiplier).
import { W, TAG_SKILL } from './warrior.js';
import SPECDEFS from '../../data/specs/warrior.js';
import KNIGHT from './knight.js';

const AURAS = {};

/** Shared by the six warrior masteries (paladin, sentinel, warlord, juggernaut, spellblade, runeguard). */
export const MW = {
  def(game, id) { return W.sdef(game, id); },
  nums(game, id) { return W.sdef(game, id).nums; },
  colors(game, id) { return W.sdef(game, id).colors; },
  ability(id, slotId, behavior) { return W.ability(SPECDEFS[id].abilities, slotId, behavior); },
  /** Copy the mastery outfit / hat / cape / held into the kit look patch (the core may compose it too: idempotent). */
  equipLook(game, p, id) {
    const k = p.data.kit;
    const look = MW.def(game, id).look || {};
    const lp = k.lookPatch || (k.lookPatch = {});
    for (const key of ['outfit', 'hat', 'cape']) if (key in look) lp[key] = look[key] ? Object.assign({}, look[key]) : null;
    if (look.held) MW.patchHeld(game, p, id);
  },
  /** Merge the mastery `held` fields that are set (a null glow keeps the subclass glow, e.g. the Battlemage element). */
  patchHeld(game, p, id) {
    const h = MW.def(game, id).look && MW.def(game, id).look.held;
    const lp = p.data.kit.lookPatch;
    if (!h || !lp) return;
    const cur = lp.held || (lp.held = {});
    for (const f in h) if (h[f] != null) cur[f] = h[f];
  },
  /** The mastery's level-10 aura (frozen, cached), or null below level 10. */
  aura(game, p, id) {
    if (game.kits.level(p) < 10) return null;
    const a = MW.def(game, id).look && MW.def(game, id).look.aura;
    if (!a) return null;
    const key = id + '|' + a.style + '|' + a.color;
    return AURAS[key] || (AURAS[key] = Object.freeze({ style: a.style, color: a.color }));
  },
  /** Mastery damage multiplier (data `balance.dmgMul`, linear between points), on top of the subclass table. */
  mul(game, p, id) {
    const b = MW.def(game, id).balance;
    const tab = b && b.dmgMul;
    if (!tab || !tab.length) return 1;
    const lv = game.kits.level(p);
    if (lv <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) {
      const a = tab[i - 1], c = tab[i];
      if (lv <= c[0]) return a[1] + (c[1] - a[1]) * (lv - a[0]) / (c[0] - a[0]);
    }
    return tab[tab.length - 1][1];
  },
  /** The subclass ultimate's boons carry over to the upgraded ultimate: Meteor Heart's burning crater at (x, y). */
  crater(game, p, x, y) {
    if (!W.has(game, p, 'meteor_heart')) return false;
    const b = W.bnums(game, 'meteor_heart');
    game.combat.zone(p, { x, y, r: b.r, dur: b.dur, tick: 0.5, dmg: b.dmg, element: 'fire',
      status: { id: 'burn', t: 2, p: b.burn * game.combat.powerOf(p) }, color: '#ff5a1f', id: 'meteor_heart' });
    game.fx({ type: 'pillar', x, y, r: 1.2, color: '#ff7a2f', dur: 0.7 });
    return true;
  },
  /** Oathkeeper (Aegis boon) also lengthens the knight masteries' ultimates: extra seconds (0 without the boon). */
  oath(game, p) { return W.has(game, p, 'oathkeeper') ? W.bnums(game, 'oathkeeper').extra || 0 : 0; },
  /** Awake, living companions within r of (x, y) (fills `out`). */
  allies(game, x, y, r, out) {
    out.length = 0;
    const comps = game.companions ? game.companions.active : null;
    if (!comps) return out;
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      if (c.removed || c.data.down) continue;
      const dx = c.x - x, dy = c.y - y;
      if (dx * dx + dy * dy <= r * r) out.push(c);
    }
    return out;
  },
  /** Hostile, targetable entities within r of (x, y) (fills `out`; does not reuse the ents scratch). */
  foes(game, p, x, y, r, out) {
    out.length = 0;
    const list = game.ents.inRadius(x, y, r + 1, null);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!game.combat.canHit(p, e) || e.type === 'npc') continue;
      const dx = e.x - x, dy = e.y - y;
      if (Math.sqrt(dx * dx + dy * dy) - (e.radius || 0) <= r) out.push(e);
    }
    return out;
  },
};

const ID = 'paladin';
const N = (game) => MW.nums(game, ID);
const C = (game) => MW.colors(game, ID);
const near = [];
const foes = [];

function sunlit(game, p, angle) {
  const n = N(game).sunlit, col = C(game), pal = p.data.kit.pal;
  const x = p.x + Math.cos(angle) * n.dist, y = p.y + Math.sin(angle) * n.dist;
  if (!game.world.walkable || game.world.walkable(p.x, p.y, x, y, 0.1, true) !== false) {
    // keep at most `max` patches (the oldest fades first)
    while (pal.patches.length >= n.max) { const old = pal.patches.shift(); if (old && !old.removed) game.ents.remove(old); }
    const z = game.combat.zone(p, { x, y, r: n.r, dur: n.dur, tick: n.tick, dmg: n.dmg, element: 'holy', color: col.sun, id: 'sunlit',
      healAmount: Math.max(1, Math.round(p.hpMax * n.healPct)), silentHeal: true, type: 'magic', tags: TAG_SKILL });
    pal.patches.push(z);
    game.fx({ type: 'sparkle', x, y, n: 10, r: n.r, color: col.sun });
    game.fx({ type: 'ring', x, y, r: n.r, color: col.light, dur: 0.4 });
    pal.sunlit++;
  }
}

function sanctuaryEnd(game, p, st) {
  const n = N(game).sanctuary, col = C(game);
  game.fx({ type: 'pillar', x: st.x, y: st.y, r: 2.6, color: col.white, dur: 1.2 });
  game.combat.aoe(p, { x: st.x, y: st.y, r: n.endR, dmg: n.endDmg, knockback: 12, type: 'magic', element: 'holy', tags: TAG_SKILL,
    fx: 'shockwave', color: col.sun, shake: 0.7 });
  game.fx({ type: 'ring', x: st.x, y: st.y, r: n.endR + 1.2, color: col.white, dur: 0.9 });
  game.fx({ type: 'ring', x: st.x, y: st.y, r: n.endR * 0.6, color: col.sky, dur: 0.7 });
  game.fx({ type: 'sparkle', x: st.x, y: st.y, n: 40, r: n.endR, color: col.gold });
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    game.fx({ type: 'pillar', x: st.x + Math.cos(a) * n.endR * 0.75, y: st.y + Math.sin(a) * n.endR * 0.75, r: 0.6, color: col.light, dur: 0.8 });
  }
  game.fx({ type: 'screenFlash', x: st.x, y: st.y, color: '#fffbe6', dur: 0.35 });
  game.bus.emit('sfx', { id: 'spell' });
}

function smite(game, p, st) {
  const n = N(game).sanctuary, col = C(game);
  MW.foes(game, p, st.x, st.y, n.r, foes);
  for (let i = 0; i < n.smites; i++) {
    let x, y;
    if (foes.length) { const t = foes[(st.smiteN + i) % foes.length]; x = t.x; y = t.y; } else {
      const a = game.rng.next() * Math.PI * 2, r = game.rng.next() * n.r * 0.8;
      x = st.x + Math.cos(a) * r; y = st.y + Math.sin(a) * r;
    }
    game.fx({ type: 'pillar', x, y, r: n.smiteR * 0.6, color: col.light, dur: 0.6 });
    game.fx({ type: 'bolt', x, y, color: col.sun });
    if (foes.length) {
      game.combat.aoe(p, { x, y, r: n.smiteR, dmg: n.smiteDmg, knockback: 2, status: { stun: n.smiteStun }, type: 'magic', element: 'holy',
        tags: TAG_SKILL, fx: { type: 'ring', r: n.smiteR, color: col.sun, dur: 0.35 }, shake: 0.15 });
      st.smitten++;
    }
  }
  st.smiteN += n.smites;
}

export default {
  id: ID,
  parent: 'knight',
  tier: 3,
  interval: KNIGHT.interval,
  basicInfo: KNIGHT.basicInfo,

  onEquip(game, p) {
    p.data.kit.pal = { swings: 0, sunlit: 0, heals: 0, patches: [], sanct: null };
    MW.equipLook(game, p, ID);
    W.refresh(game, p);
  },
  onUnequip(game, p) {
    const pal = p.data.kit.pal;
    if (!pal) return;
    if (pal.sanct && pal.sanct.ent && !pal.sanct.ent.removed) game.ents.remove(pal.sanct.ent);
    pal.sanct = null;
  },
  aura(game, p) { return MW.aura(game, p, ID); },

  update(game, p) {
    const pal = p.data.kit.pal;
    if (!pal || !pal.sanct) return;
    const st = pal.sanct;
    if (game.t >= st.nextSmite) { st.nextSmite += N(game).sanctuary.smiteEvery; smite(game, p, st); }
    if (game.t >= st.end) { pal.sanct = null; sanctuaryEnd(game, p, st); }
  },

  hud(game, p, hud) {
    const pal = p.data.kit.pal;
    if (pal && pal.sanct) { const kh = game.kits.kitHud; kh.stance = 'Sanctuary'; hud.kitHud = kh; }
  },

  basic(game, p, ctx) {
    const r = KNIGHT.basic(game, p, ctx);
    const pal = p.data.kit.pal;
    if (pal && ctx.rank >= 3 && ++pal.swings % N(game).sunlit.every === 0) sunlit(game, p, ctx.angle);
    return r;
  },

  abilities: {
    shift: MW.ability(ID, 'sanctuary', {
      cast(game, p) {
        const pal = p.data.kit.pal;
        const n = N(game).sanctuary, col = C(game);
        if (pal.sanct && pal.sanct.ent && !pal.sanct.ent.removed) game.ents.remove(pal.sanct.ent);
        const extra = MW.oath(game, p), dur = n.dur + extra;
        const ent = game.combat.zone(p, { x: p.x, y: p.y, r: n.r, dur, tick: n.tick, bubble: true, allyMod: { dmgTaken: n.dmgTaken },
          push: n.push, healAmount: Math.max(1, Math.round(p.hpMax * n.healPct * (extra ? 2 : 1))), silentHeal: true, color: col.sun, id: 'sanctuary' });
        pal.sanct = { x: p.x, y: p.y, end: game.t + dur, nextSmite: game.t + 0.35, smiteN: 0, smitten: 0, ent };
        game.combat.addMod(p, 'zone:sanctuary', { dmgTaken: n.dmgTaken }, 0.6);
        game.fx({ type: 'pillar', x: p.x, y: p.y, r: 2.2, color: col.white, dur: 1.1 });
        game.fx({ type: 'shockwave', x: p.x, y: p.y, r: n.r, color: col.sun });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: n.r, color: col.sky, dur: 0.8 });
        game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 40, r: n.r, color: col.gold });
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + 0.5;
          game.fx({ type: 'pillar', x: p.x + Math.cos(a) * n.r, y: p.y + Math.sin(a) * n.r, r: 0.5, color: col.sun, dur: 1.4 });
        }
        game.fx({ type: 'heal', x: p.x, y: p.y });
        game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: '#fff3c4', dur: 0.25 });
        game.camera.shake = Math.max(game.camera.shake, 0.4);
        game.ents.setAnim(p, 'cast', 0.45);
        game.bus.emit('sfx', { id: 'spell' });
        return undefined;
      },
      isActive(game, p) { return !!(p.data.kit.pal && p.data.kit.pal.sanct); },
    }),
  },

  hooks: {
    onOutgoing(game, p, info) { const m = MW.mul(game, p, ID); if (m !== 1) info.amount *= m; },
    onBlock(game, p, e) {
      const pal = p.data.kit.pal;
      if (!pal || !e.perfect || e.target !== p) return;
      const n = N(game).dawnward, col = C(game);
      game.combat.heal(p, Math.max(1, Math.round(p.hpMax * n.selfPct)), { source: p });
      MW.allies(game, p.x, p.y, n.r, near);
      for (let i = 0; i < near.length; i++) {
        const c = near[i];
        game.combat.heal(c, Math.max(1, Math.round(c.hpMax * n.healPct)), { source: p });
        game.fx({ type: 'beam', x: p.x, y: p.y, x2: c.x, y2: c.y, w: 0.25, color: col.sun });
        game.fx({ type: 'sparkle', x: c.x, y: c.y, n: 10, r: 0.6, color: col.light });
      }
      game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.9, color: col.light, dur: 0.6 });
      game.fx({ type: 'ring', x: p.x, y: p.y, r: n.r, color: col.sun, dur: 0.5 });
      pal.heals++;
    },
  },
};
