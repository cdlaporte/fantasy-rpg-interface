// THIEF spec kit (docs/CLASSES.md "Thief"): the stealth-and-treasure trickster. Passive Sticky Fingers (hits shake
// out coins that fly to you, defeats drop +50% gold), Backstab (from behind or from stealth: crit x3), pickpocketing
// town NPCs while stealthed (E; 25% noticed -> crime), Cutpurse Daggers (rank III: the class daggers with the spec
// coef) and Jackpot (rank IV: a backstab bursts damaging coins that fly back to you), Smoke Vanish (F: smoke +
// caltrops + 5 s stealth, first strike +2 pips), Grand Heist (Shift finisher: zigzag robbery of up to 6 enemies, back
// to the start) and the boons Coin Toss, Vanishing Act, Loaded Dice, Caltrop Trail (the roll part is in rogue.js).
// Numbers: data.specs.thief.kit + data.boons. State: p.data.kit.th.
import specdefs from '../../data/specs/rogue.js';
import { hasBoon, boonData, addPips, spendPips, angleTo, enemyZone } from './rogue.js';
import { angleDiff } from '../math.js';

const DEF = specdefs.thief;
const META = {};
for (const a of DEF.abilities) META[a.id] = a;
const tk = (game) => game.data.specs.thief.kit;
const isEnemy = (e) => e.type === 'enemy';
const isTownNpc = (e) => e.type === 'npc' && e.team === 'town';
const TAG_JACKPOT = Object.freeze(['thief_jackpot']);
const TAG_HEIST = Object.freeze(['thief_heist']);
const TAG_COIN = Object.freeze(['thief_coin']);
const COIN_LOOK = { rig: 'projectile', model: 'coin', color: '#f2c94c', glow: '#fff1a8', size: 1, trail: true };
/** Shared interact used while a town NPC can be pickpocketed (the original is restored afterwards). */
export const PICK_INTERACT = Object.freeze({ prompt: 'Pickpocket', range: 1.6, do: Object.freeze([]), noQuest: true });
const SUBS = new WeakMap();   // p -> [unsubscribe fns] (kept out of p.data.kit so kit state stays plain data)
const LABEL_STEALTH = 'Stealth: Backstab ready';
const LABEL_HEIST = 'Grand Heist!';

/** Is `t` facing away from `from`? (Backstab rule, docs/notes/sim.md section 8.) */
export function facingAway(game, t, from) {
  const arc = tk(game).backstab.arc;
  return Math.abs(angleDiff(t.angle || 0, angleTo(t.x, t.y, from.x, from.y))) > arc;
}
const lootable = (t) => t.type === 'enemy' && !t.data.summoned && !(t.tags && (t.tags.includes('dummy') || t.tags.includes('training')));

function shakeGold(game, p, t, n) {
  for (let i = 0; i < n; i++) game.combat.dropPickup('gold', t.x, t.y, 1);
  game.fx({ type: 'sparkle', x: t.x, y: t.y, n: 4 + n * 2, r: 0.5, color: tk(game).colors.gold });
  game.bus.emit('sfx', { id: 'coin' });
}

// ---------- pickpocketing ----------
function restoreNpc(e) {
  if (e && e.data.thiefPick) { if (e.interact === PICK_INTERACT) e.interact = e.data.thiefPick.orig; e.data.thiefPick = null; }
}
function pickpocket(game, p, e) {
  const P = tk(game).pickpocket, th = p.data.kit.th, C = tk(game).colors;
  restoreNpc(e);
  e.data.thiefPickedT = game.t;
  const inv = game.sys.inventory;
  const items = P.items || [];
  if (items.length && game.rng.next() < P.itemChance) {
    const id = items[Math.floor(game.rng.next() * items.length)];
    if (inv && inv.give) inv.give(id, 1);
    const def = game.data.items && game.data.items[id];
    game.fx({ type: 'text', x: p.x, y: p.y, z: 1.4, text: 'Swiped ' + ((def && def.name) || id) + '!', style: 'info', ent: p.id });
  } else {
    const n = P.gold[0] + Math.floor(game.rng.next() * (P.gold[1] - P.gold[0] + 1));
    if (inv && inv.addGold) inv.addGold(n);
    game.fx({ type: 'text', x: p.x, y: p.y, z: 1.4, text: '+' + n, style: 'gold', ent: p.id });
  }
  th.picks++;
  game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 10, r: 0.5, color: C.gold });
  game.bus.emit('sfx', { id: 'coin' });
  game.bus.emit('pickpocket', { victim: e, noticed: false });
  if (game.rng.next() < P.noticeChance) {
    th.noticed++;
    game.fx({ type: 'text', x: e.x, y: e.y, z: 1.8, text: 'Hey! Thief!', style: 'bubble', ent: e.id, dur: 2 });
    game.combat.breakStealth(p);
    game.bus.emit('crime', { victim: e, why: 'pickpocket' });
    const npc = game.sys.npc;
    if (npc && typeof npc.setWanted === 'function') npc.setWanted(true, 'pickpocket');
    game.bus.emit('pickpocket', { victim: e, noticed: true });
  }
}
function updatePickpocket(game, p) {
  const th = p.data.kit.th, P = tk(game).pickpocket;
  const stealthed = p.status.stealth > 0;
  // Restore NPCs that are out of range or when stealth ends.
  for (let i = th.swapped.length - 1; i >= 0; i--) {
    const e = game.ents.get(th.swapped[i]);
    const far = !e || e.removed || Math.hypot(e.x - p.x, e.y - p.y) > 3.5;
    if (!stealthed || far) { if (e) restoreNpc(e); th.swapped[i] = th.swapped[th.swapped.length - 1]; th.swapped.pop(); }
  }
  if (!stealthed) return;
  const list = game.ents.inRadius(p.x, p.y, 3, isTownNpc, th.scratch);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.interact || e.interact === PICK_INTERACT || e.data.thiefPick || e.data.down) continue;
    if (game.t - (e.data.thiefPickedT != null ? e.data.thiefPickedT : -1e9) < P.cooldown) continue;
    e.data.thiefPick = { orig: e.interact };
    e.interact = PICK_INTERACT;
    th.swapped.push(e.id);
  }
}

// ---------- Jackpot (rank IV) ----------
function jackpot(game, p, t) {
  const J = tk(game).jackpot, th = p.data.kit.th;
  if (game.t - th.jackpotT < J.icd) return;
  th.jackpotT = game.t;
  const coins = J.coins * (game.kits.rank(p) >= 5 ? tk(game).coinStorm.jackpotMul : 1);
  // Coins fly at the nearby enemies first (one each), the rest burst outward in a ring.
  const near = game.ents.inRadius(t.x, t.y, J.range + 0.5, isEnemy, th.scratch);
  let k = 0;
  for (let i = 0; i < coins; i++) {
    let a = (i / coins) * Math.PI * 2 + game.rng.next() * 0.3;
    while (k < near.length && (near[k] === t || !game.combat.canHit(p, near[k]))) k++;
    if (k < near.length) { a = angleTo(t.x, t.y, near[k].x, near[k].y); k++; }
    const c = game.combat.projectile(p, { x: t.x, y: t.y, angle: a, speed: J.speed, range: J.range, dmg: J.coef, look: COIN_LOOK, radius: 0.18,
      returns: true, maxHits: 2, knockback: 1, tags: TAG_JACKPOT });
    c.data.proj.hits.push(t.id);
  }
  game.fx({ type: 'burst', x: t.x, y: t.y, n: 18, r: 1.2, color: tk(game).colors.gold });
  game.fx({ type: 'ring', x: t.x, y: t.y, r: J.range, color: tk(game).colors.gold, dur: 0.35 });
  game.fx({ type: 'text', x: t.x, y: t.y, z: 1.9, text: 'JACKPOT!', style: 'crit' });
}

// ---------- round 3 ----------
/** Rank V Coin Storm: every third attack flings a fan of returning coins forward. */
function coinStorm(game, p, angle, n) {
  if (game.kits.rank(p) < 5) return;
  const CS = tk(game).coinStorm, th = p.data.kit.th;
  if (!th || n % CS.every !== 0) return;
  game.abilities.use('multishot', p, { angle, n: CS.n, spread: CS.spread, look: COIN_LOOK, speed: CS.speed, range: CS.range, dmg: CS.coef,
    radius: 0.18, returns: true, maxHits: 2, knockback: 0, tags: TAG_COIN, anim: 'attack' });
  game.fx({ type: 'sparkle', x: p.x + Math.cos(angle) * 0.6, y: p.y + Math.sin(angle) * 0.6, n: 10, r: 0.6, color: tk(game).colors.gold });
  game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: CS.spread, r: 1.1, color: tk(game).colors.gold, style: 'crescent' });
  th.storms = (th.storms || 0) + 1;
}

// ---------- abilities ----------
function smokeVanish(game, p) {
  const S = tk(game).smokeVanish, C = tk(game).colors;
  game.abilities.use('stealth', p, { dur: S.stealthDur, speed: S.speedBonus, smoke: { r: S.r, dur: S.smokeDur, status: { slow: [0.6, S.slow] } } });
  const Ca = S.caltrops;
  enemyZone(game, p, { x: p.x, y: p.y, r: Ca.r, dur: Ca.dur, tick: Ca.tick, caltrops: true, dmg: Ca.coef, type: 'melee', silent: true,
    status: { slow: [0.6, Ca.slow] }, color: '#9aa4ad', keepStealth: true });
  const ai = game.sys.ai;
  const list = game.ents.inRadius(p.x, p.y, S.r + 0.5, isEnemy, p.data.kit.th.scratch);
  for (let i = 0; i < list.length; i++) if (ai && ai.blind) ai.blind(list[i], 1.5);
  game.fx({ type: 'burst', x: p.x, y: p.y, n: 14, r: S.r, color: C.main });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: S.r, color: C.smoke, dur: 0.5 });
  game.ents.setAnim(p, 'cast', 0.2);
}

function grandHeist(game, p) {
  const H = tk(game).heist, th = p.data.kit.th;
  const cand = game.ents.inRadius(p.x, p.y, H.range, isEnemy, th.scratch);
  const pool = [];
  for (let i = 0; i < cand.length; i++) if (game.combat.canHit(p, cand[i])) pool.push(cand[i]);
  if (!pool.length) {
    game.fx({ type: 'text', x: p.x, y: p.y, z: 1.4, text: 'Nobody to rob!', style: 'info', ent: p.id });
    return false;
  }
  // Zigzag: nearest-neighbor chain from the thief.
  const order = [];
  let cx = p.x, cy = p.y;
  while (order.length < H.targets && pool.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < pool.length; i++) { const d = (pool[i].x - cx) ** 2 + (pool[i].y - cy) ** 2; if (d < bd) { bd = d; bi = i; } }
    const t = pool.splice(bi, 1)[0];
    order.push(t.id); cx = t.x; cy = t.y;
  }
  const pips = spendPips(game, p);
  th.heist = { ids: order, i: 0, t: 0, sx: p.x, sy: p.y, coef: H.coef + H.coefPerPip * pips, pips };
  game.combat.status(p, 'invuln', order.length * H.step + 0.4);
  game.fx({ type: 'screenFlash', color: tk(game).colors.main, dur: 0.15 });
  game.fx({ type: 'poof', x: p.x, y: p.y, color: tk(game).colors.main });
  game.camera.shake = Math.max(game.camera.shake, 0.35);
  return undefined;
}
function heistStep(game, p, dt) {
  const th = p.data.kit.th, h = th.heist, H = tk(game).heist, C = tk(game).colors;
  p.data.kit.speedMul = 0;
  h.t -= dt;
  if (h.t > 0) return;
  h.t = H.step;
  if (h.i >= h.ids.length) {
    // Back to where it all started.
    game.fx({ type: 'afterimage', x: p.x, y: p.y, ent: p.id, color: C.main });
    game.fx({ type: 'trail', x: p.x, y: p.y, x2: h.sx, y2: h.sy, color: C.gold });
    game.physics.teleport(p, h.sx, h.sy);
    game.physics.resolve(p);
    game.fx({ type: 'poof', x: p.x, y: p.y, color: C.main });
    game.fx({ type: 'ring', x: p.x, y: p.y, r: 2, color: C.gold, dur: 0.5 });
    game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 20, r: 1.2, color: C.gold });
    th.heist = null;
    return;
  }
  const t = game.ents.get(h.ids[h.i++]);
  if (!t || t.removed || !game.combat.targetable(t)) { h.t = 0; return; }
  const a = (t.angle || 0) + Math.PI;               // behind the victim
  const d = t.radius + p.radius + 0.35;
  let bx = t.x + Math.cos(a) * d, by = t.y + Math.sin(a) * d;
  if (game.world.solidAt(bx, by)) { bx = t.x; by = t.y; }
  game.fx({ type: 'afterimage', x: p.x, y: p.y, ent: p.id, color: C.main });
  game.fx({ type: 'trail', x: p.x, y: p.y, x2: bx, y2: by, color: C.main });
  game.physics.teleport(p, bx, by);
  p.angle = angleTo(p.x, p.y, t.x, t.y);
  game.ents.setAnim(p, 'attack', 0.12);
  game.combat.damage(t, h.coef * game.combat.powerOf(p), { source: p, type: 'melee', knockback: 2, tags: TAG_HEIST, hitStop: 0.03, color: C.gold });
  if (t.alive && !t.removed) game.combat.status(t, 'mark', H.mark, 0.3, p);
  game.fx({ type: 'slash', x: t.x, y: t.y, angle: p.angle, arc: 120, r: 0.9, color: C.main, style: 'dagger' });
  game.fx({ type: 'burst', x: t.x, y: t.y, n: 16, r: 1, color: C.gold });
  if (lootable(t) || !t.alive) shakeGold(game, p, t, H.coinsPerVictim);
}

export default {
  id: 'thief', parent: 'rogue',
  /** rogue.js afterBasic extension hook (round 3). */
  onBasic(game, p, angle, n) { coinStorm(game, p, angle, n); },

  onEquip(game, p) {
    p.data.kit.th = { swapped: [], scratch: [], jackpotT: -99, bsT: -1, bsTarget: 0, bsStealth: false, heist: null, picks: 0, noticed: 0,
      prevGoldMul: p.data.goldMul != null ? p.data.goldMul : null, coinTosses: 0 };
    p.data.goldMul = tk(game).stickyFingers.goldMul;
    const th = p.data.kit.th;
    const offs = [];
    SUBS.set(p, offs);
    offs.push(game.bus.on('pickup', (e) => {
      if (e && e.kind === 'gold' && hasBoon(game, 'golden_touch')) {
        // round 3 boon Golden Touch: every `per` gold picked up heals you
        const b = boonData(game, 'golden_touch');
        th.goldAcc = (th.goldAcc || 0) + (e.n || 1);
        while (th.goldAcc >= (b.per || 10)) {
          th.goldAcc -= b.per || 10;
          game.combat.heal(p, Math.max(1, Math.round(p.hpMax * (b.healPct || 0.04))), { source: p });
          game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 12, r: 0.8, color: tk(game).colors.gold });
          th.goldHeals = (th.goldHeals || 0) + 1;
        }
      }
      if (!e || e.kind !== 'gold' || !hasBoon(game, 'coin_toss')) return;
      const b = boonData(game, 'coin_toss');
      if (game.rng.next() >= (b.chance || 0.6)) return;
      const t = game.ents.nearest(p.x, p.y, b.range || 7, (x) => x.type === 'enemy' && game.combat.canHit(p, x));
      if (!t) return;
      game.combat.projectile(p, { angle: angleTo(p.x, p.y, t.x, t.y), speed: 13, range: (b.range || 7) + 1, dmg: b.coef || 0.9, look: COIN_LOOK,
        homing: 6, homingTarget: t, knockback: 1, tags: TAG_COIN });
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 4, r: 0.3, color: tk(game).colors.gold });
      th.coinTosses++;
    }));
    offs.push(game.bus.on('interact', (e) => {
      const ent = e && e.ent;
      if (ent && ent.interact === PICK_INTERACT && p.status.stealth > 0) pickpocket(game, p, ent);
    }));
  },
  onUnequip(game, p) {
    const th = p.data.kit.th;
    if (!th) return;
    const offs = SUBS.get(p);
    if (offs) { for (const off of offs) off(); SUBS.delete(p); }
    for (const id of th.swapped) restoreNpc(game.ents.get(id));
    th.swapped.length = 0;
    if (th.prevGoldMul != null) p.data.goldMul = th.prevGoldMul; else delete p.data.goldMul;
  },

  update(game, p, dt) {
    const th = p.data.kit.th;
    if (!th) return;
    if (th.heist) heistStep(game, p, dt);
    if ((game.tick + p.id) % 6 === 0 || th.swapped.length) updatePickpocket(game, p);
  },

  hud(game, p, hud) {
    const th = p.data.kit.th, kh = game.kits.kitHud;
    hud.kitHud = kh;
    if (!th) return;
    if (th.heist) kh.label = LABEL_HEIST;
    else if (p.status.stealth > 0) kh.label = LABEL_STEALTH;
  },

  abilities: {
    f: { id: 'smoke_vanish', name: META.smoke_vanish.name, icon: META.smoke_vanish.icon, desc: META.smoke_vanish.desc,
      unlock: META.smoke_vanish.unlock, cd: META.smoke_vanish.cd, cast: smokeVanish,
      isActive(game, p) { return p.status.stealth > 0; } },
    shift: { id: 'grand_heist', name: META.grand_heist.name, icon: META.grand_heist.icon, desc: META.grand_heist.desc,
      unlock: META.grand_heist.unlock, cd: META.grand_heist.cd, cast: grandHeist,
      isActive(game, p) { return !!(p.data.kit.th && p.data.kit.th.heist); } },
  },

  hooks: {
    onOutgoing(game, p, info) {
      const t = info.target;
      if (info.source !== p || !t || (info.opts && info.opts.dot) || info.type === 'true') return;
      const tags = info.tags;
      if (tags === TAG_JACKPOT || tags === TAG_COIN) return;
      if (info.fromStealth || facingAway(game, t, p)) {
        const th = p.data.kit.th;
        info.crit = true;
        info.critMult = hasBoon(game, 'loaded_dice') ? boonData(game, 'loaded_dice').critMult || 4 : tk(game).backstab.critMult;
        th.bsT = game.tick; th.bsTarget = t.id; th.bsStealth = !!info.fromStealth;
      }
    },
    onHit(game, p, e) {
      const th = p.data.kit.th, t = e.target;
      if (!th || e.source !== p || e.dot || !t || t === p) return;
      const C = tk(game).colors;
      // Backstab follow-ups.
      if (th.bsT === game.tick && th.bsTarget === t.id) {
        th.bsT = -1;
        th.backstabs = (th.backstabs || 0) + 1;
        game.fx({ type: 'text', x: t.x, y: t.y, z: 1.6, text: 'Backstab!', style: 'crit' });
        game.fx({ type: 'burst', x: t.x, y: t.y, n: 10, r: 0.7, color: C.main });
        if (th.bsStealth) addPips(game, p, tk(game).backstab.stealthPips);
        if (hasBoon(game, 'sleight_of_hand') && t.alive && !t.removed) {
          // round 3 boon Sleight of Hand: steal the victim's speed
          const b = boonData(game, 'sleight_of_hand');
          game.combat.status(t, 'slow', b.dur || 2.5, b.slow || 0.45, p);
          game.combat.status(p, 'haste', b.dur || 2.5, b.haste || 0.3);
          game.fx({ type: 'trail', x: t.x, y: t.y, x2: p.x, y2: p.y, color: C.main });
          th.steals = (th.steals || 0) + 1;
        }
        if (game.kits.rank(p) >= 4 && e.tags !== TAG_HEIST) jackpot(game, p, t);
        if (hasBoon(game, 'loaded_dice') && lootable(t)) {
          const b = boonData(game, 'loaded_dice');
          const items = b.items || [];
          if (items.length && game.rng.next() < (b.itemChance || 0.15)) {
            game.combat.dropPickup('item', t.x, t.y, 1, items[Math.floor(game.rng.next() * items.length)]);
            game.fx({ type: 'sparkle', x: t.x, y: t.y, n: 10, r: 0.6, color: '#ffffff' });
          }
        }
        if (th.bsStealth && e.killed && hasBoon(game, 'vanishing_act')) {
          game.abilities.reset(p, 'f');
          game.fx({ type: 'smoke', x: p.x, y: p.y, r: 1, dur: 0.8 });
          game.fx({ type: 'text', x: p.x, y: p.y, z: 1.5, text: 'Vanishing Act!', style: 'info', ent: p.id });
        }
      }
      // Sticky Fingers.
      if (e.amount > 0 && e.tags !== TAG_HEIST && lootable(t)) {
        const S = tk(game).stickyFingers;
        const n0 = t.data.thiefShaken || 0;
        if (n0 < S.maxPerEnemy && game.rng.next() < S.chance) {
          t.data.thiefShaken = n0 + 1;
          shakeGold(game, p, t, S.min + Math.floor(game.rng.next() * (S.max - S.min + 1)));
        }
      }
    },
  },
};
