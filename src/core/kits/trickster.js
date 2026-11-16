// TRICKSTER mastery (tier 3 over the Thief; docs/MASTERY.md). Pranks.
// Passive Prank Chest: Smoke Vanish also leaves a fake treasure chest (a taunting decoy with the `chest` effect look).
// Nearby enemies drop you and rush it; when it is broken or after 3 s it bursts in confetti (five colors of `burst`,
// `sparkle`, a ring of coins): damage, a 1.2 s stun ("SURPRISE!") and knockback.
// Ultimate Magic Trick (Shift finisher, level 15): "Ta-da!" You swap places with up to six enemies in turn (poof at
// both ends, a two-color `trail`), each one dazed (stun), marked and showered in coins; it ends with a ring of twelve
// returning coins and a confetti blast where you stand. Unlike Grand Heist you do not go back: the enemies end up
// scrambled. Numbers: data.specs.trickster.kit. State: p.data.kit.tr.
import thief from './thief.js';
import { spendPips } from './rogue.js';
import specdefs from '../../data/specs/rogue.js';
import { angleTo } from '../math.js';

const ID = 'trickster';
const U = specdefs[ID].ultimate;
const TK = (game) => game.data.specs[ID].kit;
const isEnemy = (e) => e.type === 'enemy';
const TAG_CHEST = Object.freeze(['trickster_chest']);
const TAG_TRICK = Object.freeze(['trickster_trick']);
const COIN_LOOK = { rig: 'projectile', model: 'coin', color: '#f2c94c', glow: '#fff1a8', size: 1, trail: true };
const CHEST_LOOK = { rig: 'effect', model: 'chest', color: '#c9a227', r: 0.5 };
const WORDS = ['Ta-da!', 'Presto!', 'Abracadabra!', 'Poof!', 'Hey presto!', 'Voila!'];
const LABEL_TRICK = 'Magic Trick!';
const LABEL_CHEST = 'Prank chest out';

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
function masteryScale(game, p) { const k = TK(game); return (k.dmgScale != null ? k.dmgScale : 1) * interp(k.lateScale, game.kits.level(p)); }

function confetti(game, x, y, r) {
  const C = TK(game).colors;
  for (let i = 0; i < C.confetti.length; i++) {
    const a = (i / C.confetti.length) * Math.PI * 2;
    game.fx({ type: 'burst', x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3, n: 12, r, color: C.confetti[i] });
  }
  game.fx({ type: 'sparkle', x, y, n: 24, r: r * 0.9, color: C.gold });
}
function coinRing(game, p, x, y, n, coef, range, returns, tags) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + game.rng.next() * 0.4;
    game.combat.projectile(p, { x, y, angle: a, speed: 9, range, dmg: coef, look: COIN_LOOK, radius: 0.18, returns: !!returns, maxHits: 2,
      knockback: 1, tags: tags || TAG_CHEST });
  }
}

// ---------- the prank chest (Smoke Vanish) ----------
function spawnChest(game, p, x, y) {
  const K = TK(game), Ch = K.chest, tr = p.data.kit.tr;
  const old = tr.chestId ? game.ents.get(tr.chestId) : null;
  if (old && !old.removed) burstChest(game, p, old);
  const c = game.combat.decoy(p, { kind: 'prank_chest', name: 'Treasure?', look: CHEST_LOOK, x, y, ttl: Ch.ttl,
    hp: Math.max(5, Math.round(p.hpMax * Ch.hpMul)), defense: Ch.defense, scale: Ch.scale, power: game.combat.powerOf(p), fxTag: false,
    onExpire: (g, e) => burstChest(g, p, e), onDeath: (g, e) => burstChest(g, p, e) });
  c.angle = Math.PI / 2; c.dir = 2;
  tr.chestId = c.id;
  // Everything nearby wants the treasure.
  const list = game.ents.inRadius(x, y, Ch.lure, isEnemy, tr.scratch);
  // (the smoke blinds them to you, not to the treasure: it re-blinds whoever still stands inside it)
  for (let i = 0; i < list.length; i++) { const e = list[i]; if (e.ai) { e.ai.blindT = 0; e.ai.target = c.id; e.ai.provoked = true; } }
  game.fx({ type: 'sparkle', x, y, n: 14, r: 0.7, color: K.colors.gold });
  game.fx({ type: 'text', x, y, z: 1.3, text: 'Ooh, treasure!', style: 'bubble', ent: c.id, dur: 1.4 });
  tr.chests++;
}
function burstChest(game, p, c) {
  if (c.data.trBurst) return;
  c.data.trBurst = true;
  const K = TK(game), Ch = K.chest, C = K.colors, tr = p.data.kit && p.data.kit.tr;
  game.combat.aoe(p, { x: c.x, y: c.y, r: Ch.r, dmg: Ch.coef, knockback: Ch.knockback, type: 'magic', fx: false, status: { stun: Ch.stun },
    tags: TAG_CHEST, shake: 0.35 });
  confetti(game, c.x, c.y, Ch.r);
  coinRing(game, p, c.x, c.y, Ch.coins, Ch.coinCoef, Ch.coinRange, false);
  game.fx({ type: 'ring', x: c.x, y: c.y, r: Ch.r, color: C.pink, dur: 0.45 });
  game.fx({ type: 'poof', x: c.x, y: c.y, color: C.main });
  game.fx({ type: 'text', x: c.x, y: c.y, z: 1.6, text: 'SURPRISE!', style: 'crit' });
  game.bus.emit('sfx', { id: 'coin' });
  if (tr) { tr.bursts++; if (tr.chestId === c.id) tr.chestId = 0; }
}
const VANISH = thief.abilities.f;
const f = Object.assign({}, VANISH, {
  desc: specdefs[ID].descs.f,
  cast(game, p, ctx) {
    const n0 = game.ents.all.length;
    const r = VANISH.cast(game, p, ctx);
    if (r !== false && p.data.kit.tr) {
      // The smoke still hides you (stealth) and slows, but no longer blinds: everyone can see the treasure.
      const all = game.ents.all;
      for (let i = n0; i < all.length; i++) {
        const zd = all[i].owner === p.id && all[i].data.zone;
        if (zd && zd.o && zd.o.smoke) zd.o = Object.assign({}, zd.o, { smoke: false });
      }
      // just outside the smoke, toward the nearest enemy (else ahead): the pack runs out of the smoke to it
      const D = TK(game).chest.dist;
      const t = game.ents.nearest(p.x, p.y, 8, isEnemy);
      const a = t ? angleTo(p.x, p.y, t.x, t.y) : ctx.angle;
      const d = Math.max(0.5, game.world.raycast(p.x, p.y, a, D, false) - 0.4);
      spawnChest(game, p, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
    }
    return r;
  },
});

// ---------- Magic Trick ----------
function magicTrick(game, p) {
  const K = TK(game), M = K.trick, C = K.colors, tr = p.data.kit.tr;
  const cand = game.ents.inRadius(p.x, p.y, M.range, isEnemy, tr.scratch);
  const pool = [];
  for (let i = 0; i < cand.length; i++) if (game.combat.canHit(p, cand[i])) pool.push(cand[i]);
  if (!pool.length) {
    game.fx({ type: 'text', x: p.x, y: p.y, z: 1.4, text: 'No audience!', style: 'info', ent: p.id });
    return false;
  }
  // Nearest first, hopping from victim to victim.
  const order = [];
  let cx = p.x, cy = p.y;
  while (order.length < M.targets && pool.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < pool.length; i++) { const d = (pool[i].x - cx) ** 2 + (pool[i].y - cy) ** 2; if (d < bd) { bd = d; bi = i; } }
    const t = pool.splice(bi, 1)[0];
    order.push(t.id); cx = t.x; cy = t.y;
  }
  const pips = spendPips(game, p);
  tr.trick = { ids: order, i: 0, t: 0.12, coef: M.coef + M.coefPerPip * pips, pips };
  game.combat.status(p, 'invuln', order.length * M.step + 0.5);
  game.fx({ type: 'screenFlash', color: C.main, dur: 0.18 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 2, color: C.gold, dur: 0.4 });
  game.fx({ type: 'poof', x: p.x, y: p.y, color: C.main });
  confetti(game, p.x, p.y, 1.2);
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.8, text: 'Ta-da!', style: 'crit' });
  game.camera.shake = Math.max(game.camera.shake, 0.35);
  game.ents.setAnim(p, 'cast', 0.25);
  tr.tricks++;
  return undefined;
}
function trickStep(game, p, dt) {
  const tr = p.data.kit.tr, h = tr.trick, K = TK(game), M = K.trick, C = K.colors;
  p.data.kit.speedMul = 0;
  h.t -= dt;
  if (h.t > 0) return;
  h.t = M.step;
  if (h.i >= h.ids.length) {
    // The finale: a ring of coins and a confetti blast where you ended up.
    game.combat.aoe(p, { r: M.finalR, dmg: M.finalCoef, knockback: 6, type: 'magic', fx: false, tags: TAG_TRICK });
    coinRing(game, p, p.x, p.y, M.finalCoins, M.finalCoinCoef, M.finalR + 1.5, true, TAG_TRICK);
    confetti(game, p.x, p.y, M.finalR);
    game.fx({ type: 'shockwave', x: p.x, y: p.y, r: M.finalR, color: C.main });
    game.fx({ type: 'screenFlash', color: C.gold, dur: 0.16 });
    game.fx({ type: 'text', x: p.x, y: p.y, z: 1.9, text: 'And for my final trick...!', style: 'info', ent: p.id });
    game.camera.shake = Math.max(game.camera.shake, 0.45);
    game.bus.emit('sfx', { id: 'coin' });
    tr.trick = null;
    return;
  }
  const t = game.ents.get(h.ids[h.i++]);
  if (!t || t.removed || !game.combat.targetable(t)) { h.t = 0; return; }
  // Swap!
  const px = p.x, py = p.y, tx = t.x, ty = t.y;
  game.fx({ type: 'afterimage', x: px, y: py, ent: p.id, color: C.main });
  game.fx({ type: 'trail', x: px, y: py, x2: tx, y2: ty, color: C.main });
  game.fx({ type: 'trail', x: tx, y: ty, x2: px, y2: py, color: C.gold });
  game.physics.teleport(p, tx, ty);
  game.physics.teleport(t, px, py);
  game.physics.resolve(t);
  game.physics.resolve(p);
  p.angle = angleTo(p.x, p.y, t.x, t.y);
  t.angle = angleTo(p.x, p.y, t.x, t.y);   // the dazed victim is spun around, its back to you: the swap strike is a Backstab
  game.ents.setAnim(p, 'attack', 0.12);
  game.combat.damage(t, h.coef * game.combat.powerOf(p), { source: p, type: 'magic', knockback: 0, tags: TAG_TRICK, hitStop: 0.03, color: C.pink,
    status: { stun: M.stun } });
  if (t.alive && !t.removed) game.combat.status(t, 'mark', M.mark, 0.3, p);
  coinRing(game, p, t.x, t.y, M.coins, M.coinCoef, M.coinRange, false, TAG_TRICK);
  game.fx({ type: 'poof', x: px, y: py, color: C.pink });
  game.fx({ type: 'poof', x: tx, y: ty, color: C.main });
  game.fx({ type: 'sparkle', x: t.x, y: t.y, n: 12, r: 0.7, color: C.gold });
  game.fx({ type: 'text', x: t.x, y: t.y, z: 1.6, text: WORDS[(h.i - 1) % WORDS.length], style: 'info' });
  tr.swaps++;
}

export default {
  id: ID, parent: 'thief', tier: 3,

  onEquip(game, p) {
    p.data.kit.tr = { chestId: 0, trick: null, scratch: [], chests: 0, bursts: 0, tricks: 0, swaps: 0 };
  },
  onUnequip(game, p) {
    const tr = p.data.kit.tr;
    if (!tr) return;
    const c = tr.chestId ? game.ents.get(tr.chestId) : null;
    if (c && !c.removed) { c.data.trBurst = true; game.combat.expireSummon(c, 'unequip'); }
    tr.trick = null;
  },

  update(game, p, dt) {
    const tr = p.data.kit.tr;
    if (!tr) return;
    if (tr.trick) trickStep(game, p, dt);
    if (tr.chestId) { const c = game.ents.get(tr.chestId); if (!c || c.removed) tr.chestId = 0; }
  },

  hud(game, p, hud) {
    const tr = p.data.kit.tr, kh = game.kits.kitHud;
    hud.kitHud = kh;
    if (!tr) return;
    if (tr.trick) kh.label = LABEL_TRICK;
    else if (tr.chestId) kh.label = LABEL_CHEST;
  },

  abilities: {
    f,
    shift: { id: U.id, name: U.name, icon: U.icon, unlock: U.unlock, cd: U.cd, desc: U.desc, cast: magicTrick,
      isActive(game, p) { return !!(p.data.kit.tr && p.data.kit.tr.trick); } },
  },

  hooks: {
    onOutgoing(game, p, info) { if (info.source === p) info.amount *= masteryScale(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= masteryScale(game, p); },
  },
};
