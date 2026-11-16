// Warlord mastery (tier 3, layered over berserker; docs/MASTERY.md). Battle commander.
// Passive Rally: every defeat rallies you and classmates within 8 (+power, +attack speed, haste for 4 s; gold ring and
// sparkles); your Rage also powers up nearby classmates (up to +25% power, +20% attack speed; during Frenzy they share
// the frenzy). Shift War Banner (unlock 15): leap at the strongest enemy ahead, land in a gold shockwave and plant a
// great banner (effect kind `warlord_banner`, model totem) for 8 s: friends near it hit harder and faster and regenerate,
// enemies near the landing flee in fear (pushed away, blinded), and war drums pound out a shockwave every 1.2 s.
import { W, TAG_SKILL } from './warrior.js';
import { MW } from './paladin.js';

const ID = 'warlord';
const N = (game) => MW.nums(game, ID);
const C = (game) => MW.colors(game, ID);
const near = [];
const foes = [];
const LEAP_PICK = { range: 7, mode: 'strongest', cone: 100, angle: 0 };

function frenzyOn(game, p) { const bz = p.data.kit.bz; return !!bz && bz.frenzyEnd > game.t; }

function rally(game, p, wl) {
  const n = N(game).rally, col = C(game);
  game.combat.addMod(p, 'rally', wl.rallyMods, n.dur);
  game.combat.status(p, 'haste', n.dur, n.haste);
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.6, color: col.gold, dur: 0.45 });
  game.fx({ type: 'burst', x: p.x, y: p.y, n: 14, r: 1, color: col.gold });
  MW.allies(game, p.x, p.y, n.r, near);
  for (let i = 0; i < near.length; i++) {
    const c = near[i];
    game.combat.addMod(c, 'rally', wl.rallyMods, n.dur);
    game.combat.status(c, 'haste', n.dur, n.haste);
    game.fx({ type: 'sparkle', x: c.x, y: c.y, n: 12, r: 0.7, color: col.gold });
    game.fx({ type: 'ring', x: c.x, y: c.y, r: 0.9, color: col.gold, dur: 0.4 });
  }
  if (game.t >= wl.textT) {
    wl.textT = game.t + n.textIcd;
    game.fx({ type: 'text', x: p.x, y: p.y, z: 1.7, text: 'Rally!', style: 'info', ent: p.id });
  }
  wl.rallies++;
}

function bannerLand(game, p) {
  const wl = p.data.kit && p.data.kit.wl;
  if (!wl) return;
  const n = N(game).banner, col = C(game);
  if (wl.banner && wl.banner.ent && !wl.banner.ent.removed) game.ents.remove(wl.banner.ent);
  const ent = game.ents.create({ kind: 'warlord_banner', type: 'effect', team: p.team, owner: p.id, x: p.x, y: p.y, solid: false,
    look: { rig: 'effect', model: 'totem', color: col.banner, r: 0.9 }, ttl: n.life });
  wl.banner = { x: p.x, y: p.y, end: game.t + n.life, nextDrum: game.t + n.drum, nextRegen: game.t + 1, ent, drums: 0 };
  // fear: everything near the landing flees
  MW.foes(game, p, p.x, p.y, n.fearR, foes);
  for (let i = 0; i < foes.length; i++) {
    const e = foes[i];
    game.physics.push(e, Math.atan2(e.y - p.y, e.x - p.x), n.fearPush);
    if (n.fear > 0 && game.sys.ai && game.sys.ai.blind && e.ai) game.sys.ai.blind(e, n.fear);
    game.combat.status(e, 'slow', n.fearSlowDur, n.fearSlow, p);
    game.combat.status(e, 'mark', n.fearMark, 0, p);   // shaken: takes 30% more damage, classmates focus it
    game.fx({ type: 'poof', x: e.x, y: e.y, color: '#3a2a2a' });
  }
  wl.feared += foes.length;
  MW.crater(game, p, p.x, p.y);
  game.fx({ type: 'meteor', x: p.x, y: p.y, r: n.landR, color: col.gold });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.4, color: col.gold, dur: 1.1 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: n.auraR, color: col.crimson, dur: 0.9 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: n.fearR + 1.5, color: col.light, dur: 0.6 });
  game.fx({ type: 'burst', x: p.x, y: p.y, n: 40, r: n.landR * 0.8, color: col.gold });
  game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: '#ffd27a', dur: 0.25 });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 2, text: 'FOR FLINKERTON!', style: 'info', ent: p.id });
  game.bus.emit('sfx', { id: 'boss' });
}

function bannerTick(game, p, wl) {
  const b = wl.banner, n = N(game).banner, col = C(game);
  if (game.t >= b.end || (b.ent && b.ent.removed)) {
    if (b.ent && !b.ent.removed) game.ents.remove(b.ent);
    game.fx({ type: 'poof', x: b.x, y: b.y, color: col.gold });
    wl.banner = null;
    game.combat.removeMod(p, 'warlord_banner');
    return;
  }
  // friends near the banner fight harder (the player and classmates)
  const dx = p.x - b.x, dy = p.y - b.y;
  if (dx * dx + dy * dy <= n.auraR * n.auraR) game.combat.addMod(p, 'warlord_banner', wl.bannerMods, 0.3);
  MW.allies(game, b.x, b.y, n.auraR, near);
  for (let i = 0; i < near.length; i++) game.combat.addMod(near[i], 'warlord_banner', wl.bannerMods, 0.3);
  if (game.t >= b.nextRegen) {
    b.nextRegen += 1;
    if (dx * dx + dy * dy <= n.auraR * n.auraR) game.combat.heal(p, Math.max(1, Math.round(p.hpMax * n.regenPct)), { silent: true, source: p });
    for (let i = 0; i < near.length; i++) game.combat.heal(near[i], Math.max(1, Math.round(near[i].hpMax * n.regenPct)), { silent: true, source: p });
    W.fx(game, 'sparkle', b.x, b.y, n.auraR * 0.6, col.gold, 10);
  }
  if (game.t >= b.nextDrum) {
    b.nextDrum += n.drum;
    b.drums++;
    game.combat.aoe(p, { x: b.x, y: b.y, r: n.drumR, dmg: n.drumDmg, knockback: 3, type: 'melee', tags: TAG_SKILL,
      fx: 'shockwave', color: col.gold, shake: 0.22 });
    W.fx(game, 'ring', b.x, b.y, n.auraR, col.crimson, 0, 0.5);
    game.bus.emit('sfx', { id: 'hit' });
  }
}

export default {
  id: ID,
  parent: 'berserker',
  tier: 3,

  onEquip(game, p) {
    const n = N(game);
    p.data.kit.wl = { rallies: 0, textT: 0, shareT: 0, ringT: 0, banner: null, feared: 0,
      rallyMods: { power: n.rally.power, attackSpeed: n.rally.attackSpeed },
      shareMods: { power: 0, attackSpeed: 0 },
      bannerMods: { power: n.banner.power, attackSpeed: n.banner.attackSpeed } };
    MW.equipLook(game, p, ID);
    W.refresh(game, p);
  },
  onUnequip(game, p) {
    const wl = p.data.kit.wl;
    if (!wl) return;
    if (wl.banner && wl.banner.ent && !wl.banner.ent.removed) game.ents.remove(wl.banner.ent);
    wl.banner = null;
    game.combat.removeMod(p, 'rally');
    game.combat.removeMod(p, 'warlord_banner');
  },
  aura(game, p) { return MW.aura(game, p, ID); },

  update(game, p, dt) {
    const wl = p.data.kit.wl;
    if (!wl) return;
    const n = N(game), col = C(game);
    // Rage powers up classmates (refreshed twice a second)
    wl.shareT -= dt;
    if (wl.shareT <= 0) {
      wl.shareT = n.rageShare.every;
      const fr = frenzyOn(game, p);
      const f = fr ? 1 : Math.min(1, W.rage(game, p) / 100);
      wl.shareMods.power = n.rageShare.power * f;
      wl.shareMods.attackSpeed = n.rageShare.attackSpeed * f;
      MW.allies(game, p.x, p.y, n.rageShare.r, near);
      wl.ringT -= n.rageShare.every;
      const ring = wl.ringT <= 0 && f > 0.25;
      if (ring) wl.ringT = 1.5;
      for (let i = 0; i < near.length; i++) {
        const c = near[i];
        if (f > 0) game.combat.addMod(c, 'warlord_rage', wl.shareMods, n.rageShare.every + 0.2);
        if (fr) game.abilities.tagFor(c, 'frenzy', n.rageShare.every + 0.2);
        if (ring) W.fx(game, 'ring', c.x, c.y, 0.8, fr ? col.crimson : col.gold, 0, 0.6);
      }
    }
    if (wl.banner) bannerTick(game, p, wl);
  },

  hud(game, p, hud) {
    const wl = p.data.kit.wl;
    if (wl && wl.banner && !frenzyOn(game, p)) { const kh = game.kits.kitHud; kh.stance = 'War Banner'; hud.kitHud = kh; }
  },

  abilities: {
    shift: MW.ability(ID, 'war_banner_leap', {
      cast(game, p, ctx) {
        const n = N(game).banner, col = C(game);
        LEAP_PICK.range = n.range; LEAP_PICK.cone = n.coneDeg; LEAP_PICK.angle = ctx.moveAngle;
        let t = game.abilities.pickTarget(p, LEAP_PICK);
        if (!t) { LEAP_PICK.cone = 0; t = game.abilities.pickTarget(p, LEAP_PICK); }
        const o = { dur: n.dur, height: n.height, invuln: true, onLand: bannerLand,
          land: { r: n.landR, dmg: n.landDmg, knockback: n.knockback, status: { stun: n.stun }, fx: 'shockwave', color: col.gold, shake: 0.65,
            type: 'melee', tags: TAG_SKILL } };
        if (t) { o.x = t.x; o.y = t.y; } else { o.angle = ctx.moveAngle; o.dist = n.dist; }
        game.abilities.use('leap', p, o);
        game.fx({ type: 'burst', x: p.x, y: p.y, n: 20, r: 1, color: col.gold });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.4, color: col.crimson, dur: 0.35 });
        const ai = W.prep('afterimage', p.x, p.y, 0, col.gold);
        ai.ent = p.id;
        game.fx(ai);
        return undefined;
      },
      isActive(game, p) { return !!(p.data.kit.wl && p.data.kit.wl.banner); },
    }),
  },

  hooks: {
    onOutgoing(game, p, info) { const m = MW.mul(game, p, ID); if (m !== 1) info.amount *= m; },
    onKill(game, p, e) {
      const wl = p.data.kit.wl;
      if (!wl || !e.ent || e.ent === p || e.ent.type !== 'enemy') return;
      rally(game, p, wl);
    },
  },
};
