// Runeguard mastery (tier 3, layered over battlemage; docs/MASTERY.md). Warding runes.
// Passive Rune Wards: every other swing drops a rune ward of the current element in front of you (effect kind
// `rune_ward`, a floating rune glyph (effect model rune_seal); at most 4, 6 s each). A ward zaps the nearest enemy within 3.2 every 0.9 s with
// a bolt of its element (burn / frost / an extra-strong storm zap). Within 2.6 tiles of a ward you take 15% less damage.
// Shift Rune Citadel (unlock 15): a ring of eight wards (fire / frost / storm in turn) around you for 6 s: you and
// classmates inside are shielded and take 40% less damage, lightning walls crackle between the wards, every ward
// zaps twice a second, and at the end all eight detonate at once.
import { W, TAG_SKILL } from './warrior.js';
import BM, { ELEMENTS } from './battlemage.js';
import { MW } from './paladin.js';

const ID = 'runeguard';
const N = (game) => MW.nums(game, ID);
const C = (game) => MW.colors(game, ID);
const BC = (game) => W.sdef(game, 'battlemage').colors;
const BN = (game) => W.snums(game, 'battlemage');
const elColor = (game, i) => BC(game)[ELEMENTS[i]];
const foes = [];
const near = [];

function makeWard(game, p, x, y, el, r, ttl) {
  return game.ents.create({ kind: 'rune_ward', type: 'effect', team: p.team, owner: p.id, x, y, solid: false,
    look: { rig: 'effect', model: 'rune_seal', color: elColor(game, el), r, w: 1, h: 1 }, ttl });
}

/** One zap from a ward at (x, y): the nearest enemy within r takes a bolt of element el. */
function zap(game, p, x, y, el, r, coef) {
  MW.foes(game, p, x, y, r, foes);
  let t = null, bd = 1e9;
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i], d = (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y);
    if (d < bd) { bd = d; t = f; }
  }
  if (!t) return false;
  const col = elColor(game, el), n = BN(game);
  game.fx({ type: 'bolt', x, y, x2: t.x, y2: t.y, color: col });
  game.fx({ type: 'hit', x: t.x, y: t.y, color: col });
  const amount = coef * game.combat.powerOf(p) * (el === 2 ? 1.25 : 1);
  game.combat.damage(t, amount, { source: p, type: 'magic', element: ELEMENTS[el], color: col, tags: TAG_SKILL, knockback: 0.5 });
  if (t.alive && !t.removed) {
    if (el === 0) game.combat.status(t, 'burn', 1.5, n.fire.burnCoef * game.combat.powerOf(p), p);
    else if (el === 1) game.combat.status(t, 'frost', n.frost.slowDur, n.frost.slow, p);
  }
  return true;
}

function dropWard(game, p, rg, angle, el) {
  const n = N(game).wards;
  let x = p.x + Math.cos(angle) * n.dist, y = p.y + Math.sin(angle) * n.dist;
  if (game.world.solidAt && game.world.solidAt(x, y)) { x = p.x; y = p.y; }
  while (rg.wards.length >= n.max) {
    const old = rg.wards.shift();
    if (old.ent && !old.ent.removed) game.ents.remove(old.ent);
    W.fx(game, 'poof', old.x, old.y, 0, elColor(game, old.el));
  }
  const col = elColor(game, el);
  rg.wards.push({ x, y, el, end: game.t + n.life, next: game.t + 0.3, ent: makeWard(game, p, x, y, el, n.r, n.life) });
  game.fx({ type: 'pillar', x, y, r: 0.35, color: col, dur: 0.5 });
  game.fx({ type: 'ring', x, y, r: n.r + 0.4, color: C(game).rune, dur: 0.35 });
  rg.dropped++;
}

function citadelEnd(game, p, rg) {
  const c = rg.cit;
  rg.cit = null;
  rg.citadels++;
  if (c.zone && !c.zone.removed) game.ents.remove(c.zone);
  // Encore (Runestorm boon) carries over: the wards detonate a second time half a second later
  if (!c.encore && W.has(game, p, 'encore')) { rg.encore = { t: game.t + 0.5, x: c.x, y: c.y, wards: c.wards, encore: true }; }
  detonate(game, p, rg, c);
}
function detonate(game, p, rg, c) {
  const n = N(game).citadel, col = C(game);
  for (let i = 0; i < c.wards.length; i++) {
    const w = c.wards[i], ec = elColor(game, w.el);
    if (w.ent && !w.ent.removed) game.ents.remove(w.ent);
    game.combat.aoe(p, { x: w.x, y: w.y, r: n.burstR, dmg: n.burstDmg, knockback: 6, type: 'magic', element: ELEMENTS[w.el], tags: TAG_SKILL,
      fx: { type: 'ring', r: n.burstR, color: ec, dur: 0.4 } });
    game.fx({ type: 'pillar', x: w.x, y: w.y, r: 0.6, color: ec, dur: 0.7 });
    game.fx({ type: 'burst', x: w.x, y: w.y, n: 12, r: n.burstR, color: ec });
  }
  game.fx({ type: 'shockwave', x: c.x, y: c.y, r: n.ringR + 1.5, color: col.rune });
  game.fx({ type: 'ring', x: c.x, y: c.y, r: n.ringR + 2.2, color: col.light, dur: 0.8 });
  game.fx({ type: 'screenFlash', x: c.x, y: c.y, color: '#d9d2ff', dur: 0.3 });
  game.camera.shake = Math.max(game.camera.shake, 0.7);
  game.bus.emit('sfx', { id: 'spell' });
}

export default {
  id: ID,
  parent: 'battlemage',
  tier: 3,
  interval: BM.interval,
  basicInfo: BM.basicInfo,

  onEquip(game, p) {
    p.data.kit.rg = { swings: 0, wards: [], dropped: 0, zaps: 0, cit: null, encore: null, citadels: 0, mods: { dmgTaken: N(game).wards.dmgTaken } };
    MW.equipLook(game, p, ID);
    W.refresh(game, p);
  },
  onUnequip(game, p) {
    const rg = p.data.kit.rg;
    if (!rg) return;
    for (const w of rg.wards) if (w.ent && !w.ent.removed) game.ents.remove(w.ent);
    rg.wards.length = 0;
    if (rg.cit) {
      if (rg.cit.zone && !rg.cit.zone.removed) game.ents.remove(rg.cit.zone);
      for (const w of rg.cit.wards) if (w.ent && !w.ent.removed) game.ents.remove(w.ent);
      rg.cit = null;
    }
    game.combat.removeMod(p, 'rune_ward');
  },
  /** Runeguard wears a violet rune aura (not the element aura); also re-applies the mastery blade color. */
  aura(game, p) { MW.patchHeld(game, p, ID); return MW.aura(game, p, ID); },

  update(game, p) {
    const rg = p.data.kit.rg;
    if (!rg) return;
    const n = N(game);
    // passive wards: expire, zap, and protect you while you stand near one
    let nearWard = false;
    for (let i = rg.wards.length - 1; i >= 0; i--) {
      const w = rg.wards[i];
      if (game.t >= w.end || !w.ent || w.ent.removed) {
        if (w.ent && !w.ent.removed) game.ents.remove(w.ent);
        rg.wards.splice(i, 1);
        continue;
      }
      if (game.t >= w.next) {
        if (zap(game, p, w.x, w.y, w.el, n.wards.zapR, n.wards.dmg)) { w.next = game.t + n.wards.zapEvery; rg.zaps++; } else w.next = game.t + 0.25;
      }
      const dx = p.x - w.x, dy = p.y - w.y;
      if (dx * dx + dy * dy <= n.wards.nearR * n.wards.nearR) nearWard = true;
    }
    if (nearWard) game.combat.addMod(p, 'rune_ward', rg.mods, 0.25);
    if (rg.encore && game.t >= rg.encore.t) {
      const e = rg.encore;
      rg.encore = null;
      game.fx({ type: 'text', x: e.x, y: e.y, z: 1.8, text: 'Encore!', style: 'info', ent: p.id });
      detonate(game, p, rg, e);
    }
    // the citadel
    const c = rg.cit;
    if (!c) return;
    const ci = n.citadel, col = C(game);
    for (let i = 0; i < c.wards.length; i++) {
      const w = c.wards[i];
      if (game.t >= w.next) {
        if (zap(game, p, w.x, w.y, w.el, ci.zapR, ci.dmg)) { w.next = game.t + ci.zapEvery; rg.zaps++; } else w.next = game.t + 0.2;
      }
    }
    if (game.t >= c.nextWall) {
      c.nextWall += ci.wallEvery;
      for (let i = 0; i < c.wards.length; i++) {
        const a = c.wards[i], b = c.wards[(i + 1) % c.wards.length];
        const fx = W.prep('bolt', a.x, a.y, 0, (c.walls + i) % 2 ? col.rune : col.light);
        fx.x2 = b.x; fx.y2 = b.y;
        game.fx(fx);
      }
      c.walls++;
      // you and classmates inside are warded
      const dx = p.x - c.x, dy = p.y - c.y;
      if (dx * dx + dy * dy <= ci.insideR * ci.insideR) W.fx(game, 'sparkle', p.x, p.y, 0.7, col.rune, 6);
    }
    if (game.t >= c.end) citadelEnd(game, p, rg);
  },

  hud(game, p, hud) {
    const rg = p.data.kit.rg;
    if (!rg) return;
    const kh = game.kits.kitHud;
    kh.pips = rg.wards.length; kh.pipsMax = N(game).wards.max;
    if (rg.cit) kh.stance = 'Rune Citadel';
    hud.kitHud = kh;
  },

  basic(game, p, ctx) {
    const r = BM.basic(game, p, ctx);
    const rg = p.data.kit.rg, bm = p.data.kit.bm;
    if (rg && bm && ctx.rank >= 3 && ++rg.swings % N(game).wards.every === 0) dropWard(game, p, rg, ctx.angle, bm.el);
    return r;
  },

  abilities: {
    shift: MW.ability(ID, 'rune_citadel', {
      cast(game, p) {
        const rg = p.data.kit.rg;
        const n = N(game).citadel, col = C(game);
        if (rg.cit) citadelEnd(game, p, rg);
        const wards = [];
        for (let i = 0; i < n.n; i++) {
          const a = i * Math.PI * 2 / n.n;
          let x = p.x + Math.cos(a) * n.ringR, y = p.y + Math.sin(a) * n.ringR;
          if (game.world.solidAt && game.world.solidAt(x, y)) { x = p.x + Math.cos(a) * n.ringR * 0.5; y = p.y + Math.sin(a) * n.ringR * 0.5; }
          const el = i % 3;
          wards.push({ x, y, el, next: game.t + 0.3 + i * n.zapEvery / n.n, ent: makeWard(game, p, x, y, el, 0.75, n.dur + 0.2) });
          game.fx({ type: 'pillar', x, y, r: 0.55, color: elColor(game, el), dur: 1.2 });
        }
        const zone = game.combat.zone(p, { x: p.x, y: p.y, r: n.insideR, dur: n.dur, tick: 0.25, allyMod: { dmgTaken: n.dmgTaken }, color: col.rune,
          id: 'citadel' });
        rg.cit = { x: p.x, y: p.y, end: game.t + n.dur, nextWall: game.t + 0.15, walls: 0, wards, zone };
        game.combat.addMod(p, 'zone:citadel', { dmgTaken: n.dmgTaken }, 0.5);
        game.combat.status(p, 'shield', n.dur, Math.max(1, Math.round(p.hpMax * n.shieldPct)));
        MW.allies(game, p.x, p.y, n.insideR, near);
        for (let i = 0; i < near.length; i++) game.combat.status(near[i], 'shield', n.dur, Math.max(1, Math.round(near[i].hpMax * n.shieldPct)));
        game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.6, color: col.rune, dur: 1 });
        game.fx({ type: 'shockwave', x: p.x, y: p.y, r: n.ringR, color: col.rune });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: n.insideR, color: col.light, dur: 0.7 });
        game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 30, r: n.ringR, color: col.light });
        game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: '#d9d2ff', dur: 0.2 });
        game.camera.shake = Math.max(game.camera.shake, 0.4);
        game.ents.setAnim(p, 'cast', 0.45);
        game.bus.emit('sfx', { id: 'spell' });
        return undefined;
      },
      isActive(game, p) { return !!(p.data.kit.rg && p.data.kit.rg.cit); },
    }),
  },

  hooks: {
    onOutgoing(game, p, info) { const m = MW.mul(game, p, ID); if (m !== 1) info.amount *= m; },
  },
};
