// Warrior class kit (docs/CLASSES.md "WARRIOR"). Rage (+per basic hit, +per hit taken, decays out of combat),
// Sword Arc (rank I) / Heavy Hand (rank II, every third swing a 180-degree gold smash), Space Shield Bash, Q War Cry,
// and the eight class boons. Also the shared helpers the three warrior specs build on (`W`): data access, Rage gain,
// look/aura refresh, fx scratch, the post-basic hook (Cleaving Wind) and per-layer extension hooks
// (`onBashEnd(game, p, x0, y0, x1, y1, hits)`, `aura(game, p)`).
// All numbers come from data: data.classes.warrior.nums, data.specs.<spec>.nums, data.boons.<id>.nums.
import CLASSDEFS from '../../data/classdefs/warrior.js';
import SPECDEFS from '../../data/specs/warrior.js';
import BOONDEFS from '../../data/boondefs/warrior.js';
import { makeFxEvent, assignFxEvent } from '../../contracts.js';

const EMPTY = Object.freeze({});
export const TAG_BASIC = Object.freeze(['wbasic']);
export const TAG_SKILL = Object.freeze(['wskill']);
const UNSTOPPABLE_MODS = Object.freeze({ kbImmune: 1, slowImmune: 1 });
const FLARE_AURA = Object.freeze({ style: 'flame', color: '#ff3b2a' });
const BASH_PICK = { range: 3, mode: 'nearest', cone: 50, angle: 0, los: true };   // round 2: Shield Bash homing

// ---------------------------------------------------------------------------------------------------------------
// shared helpers (exported for the spec kits)

const FX = makeFxEvent();
// game.data may override the warrior files partially (tests, mods): merge over the built-in files, one level deep
// for nums / colors / ranks / look, cached per override object (no per-call allocation).
const merged = new WeakMap();
function over(base, d) {
  if (!d || d === base || !base) return d || base;
  let m = merged.get(d);
  if (m) return m;
  m = Object.assign({}, base, d);
  for (const k of ['nums', 'colors', 'ranks', 'look']) if (base[k] || d[k]) m[k] = Object.assign({}, base[k], d[k]);
  merged.set(d, m);
  return m;
}
export const W = {
  cdef(game) { return over(CLASSDEFS.warrior, game.data.classes && game.data.classes.warrior); },
  nums(game) { return W.cdef(game).nums; },
  sdef(game, id) { return over(SPECDEFS[id], game.data.specs && game.data.specs[id]); },
  snums(game, id) { return W.sdef(game, id).nums; },
  bdef(game, id) { return over(BOONDEFS[id], game.data.boons && game.data.boons[id]) || null; },
  bnums(game, id) { const b = W.bdef(game, id); return (b && b.nums) || EMPTY; },
  colors(game) { return W.cdef(game).colors; },
  /** Does the player own boon `id`? (only the player has boons; companions do not run kits) */
  has(game, p, id) { const pr = game.sys.progression; return p === game.player && !!pr && typeof pr.hasBoon === 'function' && pr.hasBoon(id); },
  level(game, p) { return game.kits.level(p); },
  /** Ability descriptor for the kit from the data ability list (+ behavior fields). */
  ability(list, id, behavior) {
    const a = list.find((x) => x.id === id) || { id };
    const out = { id, name: a.name || id, icon: a.icon || 'star', desc: a.desc || '', unlock: a.unlock || 1, cd: a.cd || 0, cost: a.cost || 0 };
    if (a.need != null) out.need = a.need;
    return Object.assign(out, behavior);
  },
  /** Rage gain (ignored while a spec locks Rage, e.g. Berserker Frenzy drains it). */
  gainRage(game, p, n) {
    const k = p.data.kit;
    if (!k || k.rageLock) return;
    game.kits.gain(p, n);
  },
  rage(game, p) { return game.kits.resource(p).value; },
  /** One fx event without allocating (copied by game.fx). */
  fx(game, type, x, y, r, color, n, dur) {
    game.fx(W.prep(type, x, y, r, color, n, dur));
  },
  /** Fill the shared scratch fx event (not emitted): set extra fields, then game.fx(it). */
  prep(type, x, y, r, color, n, dur) {
    assignFxEvent(FX, null);
    FX.type = type; FX.x = x; FX.y = y; FX.r = r || 0; FX.color = color || null; FX.n = n || 0; FX.dur = dur || 0;
    return FX;
  },
  /** Recompute the kit look patch (aura flare etc.) and refresh the player look (bumps lookRev). */
  refresh(game, p) {
    const k = p.data.kit;
    if (!k) return;
    const lp = k.lookPatch || (k.lookPatch = {});
    const aura = desiredAura(game, p);
    if (aura) lp.aura = aura; else delete lp.aura;
    if (p === game.player && game.sys.player && game.sys.player.refreshLook) game.sys.player.refreshLook();
    else p.lookRev = (p.lookRev || 0) + 1;
  },
  /** Run the per-layer extension hook `name` on every layer of p's kit. */
  layers(game, p, name, a, b, c, d, e) {
    const L = game.kits.active(p);
    for (let i = 0; i < L.layers.length; i++) { const f = L.layers[i][name]; if (typeof f === 'function') f(game, p, a, b, c, d, e); }
  },
  /** Called by every warrior-family basic after its swing (Cleaving Wind). */
  afterBasic(game, p, angle) {
    const k = p.data.kit;
    k.wBasics = (k.wBasics || 0) + 1;
    if (W.has(game, p, 'thunder_clap')) thunderClap(game, p, angle, k);
    if (!W.has(game, p, 'cleaving_wind')) return;
    const b = W.bnums(game, 'cleaving_wind');
    if (k.wBasics % (b.every || 4) !== 0) return;
    const c = W.colors(game);
    game.abilities.use('projectile', p, {
      angle, model: 'crescent', color: c.steel, glow: '#bfe8ff', size: 1.2, speed: b.speed, range: b.range, dmg: b.dmg,
      radius: b.radius, pierce: true, knockback: 3, type: 'melee', tags: TAG_SKILL, anim: 'attack', sfx: 'swing',
    });
    game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: 60, r: 1.4, color: '#bfe8ff', style: 'crescent' });
  },
  /** Fallback for spec layers at ranks I-II (spec equipped below level 8 via debug / tests). */
  classBasic(game, p, ctx) { return KIT.basic(game, p, ctx); },
};

/** round 3: the balance multiplier for levels past 12 (spec `balance.dmgMul`, linear between points; 1 when absent). */
function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    const a = tab[i - 1], b = tab[i];
    if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]);
  }
  return tab[tab.length - 1][1];
}
export function lateMul(game, p) {
  const sid = p.data.specId;
  const d = sid ? W.sdef(game, sid) : W.cdef(game);
  const tab = d && d.balance && d.balance.dmgMul;
  return tab ? interp(tab, game.kits.level(p)) : 1;
}

/** round 3 boon Thunder Clap: every fifth swing, lightning strikes the nearest enemy in front. */
const CLAP_PICK = { range: 3.5, mode: 'nearest', cone: 120, angle: 0, los: true, out: { x: 0, y: 0 } };
function thunderClap(game, p, angle, k) {
  const b = W.bnums(game, 'thunder_clap');
  if (k.wBasics % (b.every || 5) !== 0) return;
  CLAP_PICK.range = b.range; CLAP_PICK.angle = angle;
  const t = game.abilities.pickTarget(p, CLAP_PICK);
  const x = t ? t.x : p.x + Math.cos(angle) * 1.6, y = t ? t.y : p.y + Math.sin(angle) * 1.6;
  game.fx({ type: 'bolt', x, y, color: b.color });
  game.fx({ type: 'bolt', x: x + 0.3, y: y - 0.2, color: '#ffffff' });
  game.combat.aoe(p, { x, y, r: b.r, dmg: b.dmg, knockback: 3, status: { stun: b.stun }, type: 'magic', element: 'storm', tags: TAG_SKILL,
    fx: { type: 'ring', r: b.r, color: b.color, dur: 0.3 }, color: b.color, shake: 0.2 });
  game.fx({ type: 'burst', x, y, n: 14, r: b.r, color: b.color });
  k.claps = (k.claps || 0) + 1;
}

/** round 3 boon War Banner: a flaming banner planted by War Cry (an effect entity + an enemy-burning zone). */
function plantBanner(game, p, k) {
  const b = W.bnums(game, 'war_banner'), col = W.colors(game);
  if (k.bannerEnt && !k.bannerEnt.removed) game.ents.remove(k.bannerEnt);
  k.bannerEnt = game.ents.create({ kind: 'war_banner', type: 'effect', team: p.team, owner: p.id, x: p.x, y: p.y, solid: false,
    look: { rig: 'effect', model: 'totem', color: col.rage, r: 0.5 }, ttl: b.dur });
  k.bannerX = p.x; k.bannerY = p.y; k.bannerUntil = game.t + b.dur; k.bannerT = 0;
  game.combat.zone(p, { x: p.x, y: p.y, r: b.r, dur: b.dur, tick: b.tick, dmg: 0, element: 'fire', color: col.ember, id: 'war_banner',
    status: { id: 'burn', t: 1.5, p: b.burn * game.combat.powerOf(p) } });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.9, color: col.ember, dur: 0.8 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: b.r, color: col.gold, dur: 0.6 });
  k.banners = (k.banners || 0) + 1;
}
function updateBanner(game, p, k, dt) {
  if (!(k.bannerUntil > game.t)) { if (k.bannerOn) { k.bannerOn = false; game.combat.removeMod(p, 'war_banner'); } return; }
  const b = W.bnums(game, 'war_banner');
  const dx = p.x - k.bannerX, dy = p.y - k.bannerY;
  const inside = dx * dx + dy * dy <= b.r * b.r;
  if (inside) { k.bannerMods.power = b.power; game.combat.addMod(p, 'war_banner', k.bannerMods, 0.3); }
  k.bannerOn = inside;
  k.bannerT -= dt;
  if (k.bannerT <= 0) {
    k.bannerT = 1;
    W.fx(game, 'sparkle', k.bannerX, k.bannerY, b.r * 0.7, W.colors(game).ember, 8);
  }
}

function desiredAura(game, p) {
  const k = p.data.kit;
  if (k.cryUntil > game.t) return FLARE_AURA;
  const L = game.kits.active(p);
  for (let i = L.layers.length - 1; i >= 0; i--) {
    const f = L.layers[i].aura;
    if (typeof f === 'function') { const a = f(game, p); if (a) return a; }
  }
  return null;
}

function secondWind(game, p, k, b) {
  const col = W.colors(game);
  k.swT = game.t + b.icd;
  game.combat.heal(p, Math.round(p.hpMax * b.heal), { source: p });
  game.combat.aoe(p, { x: p.x, y: p.y, r: b.r, dmg: 0, knockback: b.knockback, fx: 'shockwave', color: col.gold });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.1, color: col.rage, dur: 0.8 });
  game.fx({ type: 'burst', x: p.x, y: p.y, n: 24, r: 1.5, color: col.gold });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.6, text: 'Second Wind!', style: 'info', ent: p.id });
  game.camera.shake = Math.max(game.camera.shake, 0.35);
}

// ---------------------------------------------------------------------------------------------------------------
// Shield Bash callbacks (module-level: no per-cast closures)

function bashHit(game, t, dealt, c) {
  const k = c.data.kit;
  if (!k) return;
  const N = W.nums(game).shield_bash;
  const col = W.colors(game);
  if (!k.bashRaged) { k.bashRaged = true; W.gainRage(game, c, N.rage); }
  game.fx({ type: 'burst', x: t.x, y: t.y, n: 16, r: 0.8, color: col.gold });
  game.fx({ type: 'hit', x: t.x, y: t.y, color: col.rage });
  game.camera.shake = Math.max(game.camera.shake, 0.22);
}
function bashEnd(game, c, hits) {
  const k = c.data.kit;
  if (!k) return;
  const x0 = k.bashX0, y0 = k.bashY0;
  if (W.has(game, c, 'blazing_bash')) {
    const b = W.bnums(game, 'blazing_bash');
    const dx = c.x - x0, dy = c.y - y0, len = Math.sqrt(dx * dx + dy * dy);
    const n = Math.max(1, Math.round(len / (b.step || 0.8)));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      game.combat.zone(c, { x: x0 + dx * f, y: y0 + dy * f, r: b.r, dur: b.dur, tick: 0.5, dmg: b.dmg, element: 'fire',
        status: { id: 'burn', t: 2, p: b.burn * game.combat.powerOf(c) }, color: '#ff7a2f', id: 'blazing_bash' });
    }
    game.fx({ type: 'burst', x: c.x, y: c.y, n: 12, r: 0.8, color: '#ff7a2f' });
  }
  if (k.jugg) {
    const b = W.bnums(game, 'juggernaut'), col = W.colors(game);
    k.jugg = false;
    game.fx({ type: 'shockwave', x: c.x, y: c.y, r: b.endR, color: col.gold });
    game.fx({ type: 'trail', x: x0, y: y0, x2: c.x, y2: c.y, color: col.gold });
    game.camera.shake = Math.max(game.camera.shake, 0.3);
  }
  W.layers(game, c, 'onBashEnd', x0, y0, c.x, c.y, hits);
  if (hits && hits.length && !k.bashChained && W.has(game, c, 'ricochet_bash')) {
    const b = W.bnums(game, 'ricochet_bash');
    let best = null, bd = b.range * b.range;
    const list = game.ents.inRadius(c.x, c.y, b.range, null);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (hits.indexOf(e) >= 0 || !game.combat.canHit(c, e)) continue;
      const d = (e.x - c.x) * (e.x - c.x) + (e.y - c.y) * (e.y - c.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      // Start after the hit-stop of the first impact (a frozen dasher would stall).
      k.bashChained = true;
      k.ricoT = best.id;
      k.ricoAt = game.t + 0.09;
    }
  }
}
function ricochetStart(game, c) {
  const k = c.data.kit;
  k.ricoAt = 0;
  const t = game.ents.get(k.ricoT);
  if (!t || !game.combat.targetable(t)) { k.ricoT = null; return; }
  const N = W.nums(game).shield_bash;
  const dx = t.x - c.x, dy = t.y - c.y;
  game.fx({ type: 'ring', x: c.x, y: c.y, r: 0.9, color: W.colors(game).gold, dur: 0.3 });
  game.abilities.use('dash', c, { angle: Math.atan2(dy, dx), dist: Math.max(0.3, Math.sqrt(dx * dx + dy * dy) - t.radius - c.radius - 0.1),
    speed: N.speed * 1.2, dmg: 0, through: true, color: W.colors(game).gold, onEnd: ricochetEnd });
}
function ricochetEnd(game, c) {
  const k = c.data.kit;
  if (!k) return;
  const t = game.ents.get(k.ricoT);
  k.ricoT = null;
  if (!t || !game.combat.targetable(t) || Math.hypot(t.x - c.x, t.y - c.y) > t.radius + c.radius + 1.2) return;
  const N = W.nums(game).shield_bash;
  const b = W.bnums(game, 'ricochet_bash');
  const dealt = game.combat.damage(t, N.dmg * (b.dmgMul || 0.8) * game.combat.powerOf(c), { source: c, type: 'melee', knockback: N.knockback,
    kbAngle: Math.atan2(t.y - c.y, t.x - c.x), status: { stun: N.stun }, hitStop: 0.05, color: W.colors(game).gold, tags: TAG_SKILL });
  bashHit(game, t, dealt, c);
}

function rank(game, p) { return game.kits.rank(p); }

// ---------------------------------------------------------------------------------------------------------------
// the kit

const D = CLASSDEFS.warrior;
const KIT = {
  id: 'warrior',
  parent: null,
  resource: { id: 'rage', name: 'Rage', max: D.nums.rage.max, color: D.colors.rage, start: 0 },
  basicMode: 'auto',
  interval(game) { return W.nums(game).sword_arc.interval; },
  basicInfo(game, p, r) {
    const ranks = W.cdef(game).ranks;
    return ranks[Math.min(2, Math.max(1, r))] || ranks[1];
  },

  onEquip(game, p) {
    const k = p.data.kit;
    const N = W.nums(game).rage;
    k.ragePerHit = N.perBasicHit;
    k.noDecay = false;
    k.rageLock = false;
    k.combatT = -1e9;
    k.swings = 0; k.wBasics = 0;
    k.cryUntil = 0; k.cryOn = false;
    k.spikeT = 0; k.swT = -1e9;
    k.unst = false;
    k.bashX0 = p.x; k.bashY0 = p.y; k.bashRaged = false; k.bashChained = false; k.ricoAt = 0; k.ricoT = null;
    k.bannerEnt = null; k.bannerUntil = 0; k.bannerOn = false; k.bannerMods = { power: 0 };
    W.refresh(game, p);
  },
  onUnequip(game, p) {
    const k = p.data.kit;
    game.combat.removeMod(p, 'unstoppable');
    game.combat.removeMod(p, 'war_banner');
    if (k.bannerEnt && !k.bannerEnt.removed) game.ents.remove(k.bannerEnt);
    if (k.unst) p.glow = null;
  },

  update(game, p, dt) {
    const k = p.data.kit;
    const N = W.nums(game).rage;
    // Rage decay out of combat
    if (!k.noDecay && !k.rageLock && game.t - k.combatT > N.decayAfter) {
      const r = p.data.resource;
      if (r && r.value > 0) r.value = Math.max(0, r.value - N.decay * dt);
    }
    if (k.ricoAt > 0 && game.t >= k.ricoAt) ricochetStart(game, p);
    if (k.bannerUntil) updateBanner(game, p, k, dt);
    // War Cry aura flare ends
    if (k.cryOn && game.t >= k.cryUntil) { k.cryOn = false; W.refresh(game, p); }
    // Unstoppable: above 50 Rage, immune to knockback and slows, steady glow
    if (W.has(game, p, 'unstoppable')) {
      const on = W.rage(game, p) > (W.bnums(game, 'unstoppable').at || 50);
      if (on) {
        game.combat.addMod(p, 'unstoppable', UNSTOPPABLE_MODS, 0.25);
        if (!k.unst) {
          k.unst = true; p.glow = W.colors(game).ember;
          W.fx(game, 'ring', p.x, p.y, 1.1, W.colors(game).ember, 0, 0.4);
        }
      } else if (k.unst) { k.unst = false; p.glow = null; game.combat.removeMod(p, 'unstoppable'); }
    }
  },

  hud() {},

  basic(game, p, ctx) {
    const k = p.data.kit;
    const N = W.nums(game);
    const col = W.colors(game);
    k.swings++;
    const H = N.heavy_hand;
    const heavy = ctx.rank >= 2 && k.swings % H.every === 0;
    if (heavy) {
      game.abilities.use('melee_arc', p, {
        angle: ctx.angle, arc: H.arc, range: H.range, dmg: H.dmg, knockback: H.knockback, hitStop: H.hitStop, shake: H.shake,
        tags: TAG_BASIC, color: col.gold, style: 'sword', animDur: 0.3,
        fx: { type: 'slash', arc: H.arc, r: H.range + 0.2, w: 2, color: col.gold, style: 'sword' },
      });
      game.fx({ type: 'burst', x: p.x + Math.cos(ctx.angle) * 0.8, y: p.y + Math.sin(ctx.angle) * 0.8, n: 14, r: 1, color: col.gold });
    } else {
      const S = N.sword_arc;
      game.abilities.use('melee_arc', p, {
        angle: ctx.angle, arc: S.arc, range: S.range, dmg: S.dmg, knockback: S.knockback, tags: TAG_BASIC,
        color: col.steel, style: 'sword',
      });
    }
    W.afterBasic(game, p, ctx.angle);
    return heavy ? N.sword_arc.interval * 1.25 : undefined;
  },

  abilities: {
    space: W.ability(D.abilities, 'shield_bash', {
      cast(game, p, ctx) {
        const k = p.data.kit;
        const N = W.nums(game).shield_bash;
        const col = W.colors(game);
        k.bashX0 = p.x; k.bashY0 = p.y; k.bashRaged = false; k.bashChained = false;
        game.fx({ type: 'burst', x: p.x, y: p.y, n: 10, r: 0.6, color: col.steel });
        // round 2: a light homing on the nearest enemy within 50 degrees of the move direction and the bash's reach.
        BASH_PICK.range = N.dist + 0.6; BASH_PICK.angle = ctx.moveAngle;
        const t = game.abilities.pickTarget(p, BASH_PICK);
        const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : ctx.moveAngle;
        if (W.has(game, p, 'juggernaut')) {
          // round 3 boon Juggernaut: a longer charge that plows through everything (no stop on the first hit).
          const b = W.bnums(game, 'juggernaut');
          k.jugg = true;
          game.abilities.use('dash', p, {
            angle: a, dist: N.dist * b.distMul, speed: N.speed * 1.15, dmg: N.dmg * b.dmgMul, stopOnHit: false, through: true,
            status: { stun: N.stun }, knockback: N.knockback, hitRadius: N.hitRadius + 0.15, color: col.gold, onHit: bashHit, onEnd: bashEnd,
          });
          game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.1, color: col.gold, dur: 0.3 });
          return undefined;
        }
        k.jugg = false;
        game.abilities.use('dash', p, {
          angle: a, dist: N.dist, speed: N.speed, dmg: N.dmg, stopOnHit: true, status: { stun: N.stun },
          knockback: N.knockback, hitRadius: N.hitRadius, color: col.rage, hitStop: 0.06, onHit: bashHit, onEnd: bashEnd,
        });
        return undefined;
      },
    }),
    q: W.ability(D.abilities, 'war_cry', {
      cast(game, p) {
        const k = p.data.kit;
        const N = W.nums(game).war_cry;
        const col = W.colors(game);
        game.abilities.use('aoe_ring', p, {
          r: N.r, dmg: N.dmg, knockback: N.knockback, status: { slow: [N.slowDur, N.slow] }, fx: 'shockwave', color: col.rage,
          shake: 0.3, type: 'melee', tags: TAG_SKILL,
        });
        game.abilities.use('buff_self', p, { id: 'war_cry', dur: N.dur, power: N.power, fxTag: 'haste',
          fx: { type: 'burst', n: 26, r: 1.3, color: FLARE_AURA.color } });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.3, color: col.gold, dur: 0.5 });
        game.bus.emit('sfx', { id: 'boss' });
        k.cryUntil = game.t + N.dur; k.cryOn = true;
        W.refresh(game, p);
        if (W.has(game, p, 'aftershock')) {
          const b = W.bnums(game, 'aftershock');
          game.combat.aoe(p, { x: p.x, y: p.y, r: b.r, dmg: b.dmg, knockback: b.knockback, delay: b.delay, telegraph: false,
            fx: 'shockwave', color: col.gold, shake: 0.4, type: 'melee', tags: TAG_SKILL });
        }
        if (W.has(game, p, 'war_banner')) plantBanner(game, p, k);
        if (W.has(game, p, 'battle_hymn')) {
          const b = W.bnums(game, 'battle_hymn');
          game.abilities.use('heal', p, { pct: b.heal, allies: b.r });
          game.combat.status(p, 'haste', b.hasteDur, b.haste);
          const comps = game.companions ? game.companions.active : [];
          for (let i = 0; i < comps.length; i++) {
            const c = comps[i];
            if (c.removed || c.data.down) continue;
            const dx = c.x - p.x, dy = c.y - p.y;
            if (dx * dx + dy * dy > b.r * b.r) continue;
            game.combat.status(c, 'haste', b.hasteDur, b.haste);
            game.fx({ type: 'sparkle', x: c.x, y: c.y, n: 10, r: 0.6, color: col.gold });
          }
          game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.9, color: '#ffd24a', dur: 0.6 });
        }
        return undefined;
      },
    }),
  },

  hooks: {
    // round 3: levels 13-20 balance (data `balance.dmgMul`, 1 up to level 12).
    onOutgoing(game, p, info) { const m = lateMul(game, p); if (m !== 1) info.amount *= m; },
    onHit(game, p, e) {
      const k = p.data.kit;
      if (!k || e.target === p) return;
      k.combatT = game.t;
      if (e.tags === TAG_BASIC && e.amount > 0) W.gainRage(game, p, k.ragePerHit);
    },
    /** The hit would down the player: Second Wind fires first, and the player survives it on at least 1 hp. */
    onLethal(game, p, info) {
      const k = p.data.kit;
      if (!k || !W.has(game, p, 'second_wind') || p.data.down || game.t < k.swT) return;
      secondWind(game, p, k, W.bnums(game, 'second_wind'));
      if (p.hp - info.dealt < 1) info.dealt = Math.max(0, p.hp - 1);
    },
    onHurt(game, p, e) {
      const k = p.data.kit;
      if (!k) return;
      if (e.dot && !(e.amount > 0)) return;
      k.combatT = game.t;
      if (!e.dot && (e.amount > 0 || e.blocked > 0)) W.gainRage(game, p, W.nums(game).rage.perHitTaken);
      const col = W.colors(game);
      if (!e.dot && W.has(game, p, 'rage_spikes') && game.t >= k.spikeT && p.hp > 0) {
        const b = W.bnums(game, 'rage_spikes');
        k.spikeT = game.t + b.icd;
        game.combat.aoe(p, { x: p.x, y: p.y, r: b.r, dmg: b.dmg, knockback: b.knockback, type: 'melee', tags: TAG_SKILL,
          fx: { type: 'ring', r: b.r, color: col.rage, dur: 0.3 } });
        game.fx({ type: 'burst', x: p.x, y: p.y, n: 18, r: b.r, color: col.steel });
      }
      if (W.has(game, p, 'second_wind') && p.hp > 0 && !p.data.down && game.t >= k.swT) {
        const b = W.bnums(game, 'second_wind');
        if (p.hp < p.hpMax * b.below) secondWind(game, p, k, b);
      }
    },
  },
};

export default KIT;
