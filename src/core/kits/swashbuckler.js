// SWASHBUCKLER mastery (tier 3 over the Thief; docs/MASTERY.md). The dashing duelist.
// Passive Parry & Riposte: Dodge Roll opens a 0.65 s parry window ("En garde!"). An enemy attack that lands in the
// window (also while the roll makes you untouchable) is parried ("Parry!") and you answer with a riposte: a lunge to the
// attacker and a crossed rapier `slash` X for a big critical (x2.5), stun, +2 pips. Up to three ripostes per window.
// Ultimate Flourish (Shift finisher, level 15): for 2.2 s (+0.16 s per pip) you spin as a storm of rapier blades:
// pairs of crimson / gold `crescent`s spiral out around you, a `spin` slash cuts everything close, you move faster and
// take half damage; it ends with "Touche!": a shockwave, a ring of twelve blades and a screen flash.
// Numbers: data.specs.swashbuckler.kit. State: p.data.kit.sw.
import rogue, { addPips, spendPips } from './rogue.js';
import specdefs from '../../data/specs/rogue.js';
import { angleTo } from '../math.js';

const ID = 'swashbuckler';
const U = specdefs[ID].ultimate;
const WK = (game) => game.data.specs[ID].kit;
const TAG_RIPOSTE = Object.freeze(['swash_riposte']);
const TAG_FLOURISH = Object.freeze(['swash_flourish']);
const SUBS = new WeakMap();
const LABEL_GARDE = 'En garde!';
const LABEL_FLOURISH = 'Flourish!';
let bladeLooks = null;

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
function masteryScale(game, p) { const k = WK(game); return (k.dmgScale != null ? k.dmgScale : 1) * interp(k.lateScale, game.kits.level(p)); }
function looks(game) {
  const C = WK(game).colors;
  if (!bladeLooks || bladeLooks[0].color !== C.main) {
    bladeLooks = [{ rig: 'projectile', model: 'crescent', color: C.main, glow: C.gold, size: 1.2, trail: true },
      { rig: 'projectile', model: 'crescent', color: C.gold, glow: C.cream, size: 1.2, trail: true }];
  }
  return bladeLooks;
}

// ---------- parry + riposte ----------
function parrying(game, p) { const sw = p.data.kit.sw; return !!(sw && game.t <= sw.parryUntil && sw.parryN < WK(game).parry.maxPerWindow); }
function parry(game, p, src) {
  const sw = p.data.kit.sw, K = WK(game), P = K.parry, R = K.riposte, C = K.colors;
  if (game.t - sw.ripT < P.icd) return;
  sw.ripT = game.t;
  sw.parryN++;
  sw.parries++;
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.5, text: 'Parry!', style: 'miss' });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 0.9, color: C.gold, dur: 0.25 });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 8, r: 0.5, color: C.steel });
  if (!src || src.removed || !src.alive || src.type !== 'enemy' || !game.combat.canHit(p, src)) return;
  const d = Math.hypot(src.x - p.x, src.y - p.y);
  if (d > P.reach) return;
  // Riposte: lunge in, cross two rapier slashes.
  const a = angleTo(p.x, p.y, src.x, src.y);
  const stop = Math.max(0, d - (src.radius + p.radius + 0.25));
  const x0 = p.x, y0 = p.y;
  if (stop > 0.05) {
    let nx = p.x + Math.cos(a) * stop, ny = p.y + Math.sin(a) * stop;
    if (game.world.solidAt(nx, ny)) { nx = p.x; ny = p.y; }
    game.physics.teleport(p, nx, ny);
  }
  p.angle = a; p.data.faceT = 0.25;
  game.ents.setAnim(p, 'attack', 0.2);
  game.fx({ type: 'afterimage', x: x0, y: y0, ent: p.id, color: C.main });
  game.fx({ type: 'trail', x: x0, y: y0, x2: p.x, y2: p.y, color: C.gold });
  game.combat.damage(src, R.coef * game.combat.powerOf(p), { source: p, type: 'melee', crit: true, critMult: R.critMult, knockback: R.knockback,
    kbAngle: a, hitStop: R.hitStop, tags: TAG_RIPOSTE, color: C.gold, status: { stun: R.stun } });
  game.fx({ type: 'slash', x: src.x, y: src.y, angle: a - 0.5, arc: 50, r: 1.2, color: C.main, style: 'sword' });
  game.fx({ type: 'slash', x: src.x, y: src.y, angle: a + 0.5, arc: 50, r: 1.2, color: C.gold, style: 'sword' });
  game.fx({ type: 'sparkle', x: src.x, y: src.y, n: 14, r: 0.8, color: C.gold });
  game.fx({ type: 'text', x: src.x, y: src.y, z: 1.7, text: 'Riposte!', style: 'crit' });
  game.camera.shake = Math.max(game.camera.shake, 0.25);
  addPips(game, p, R.pips);
  sw.ripostes++;
}
const ROLL = rogue.abilities.space;
const space = Object.assign({}, ROLL, {
  desc: specdefs[ID].descs.space,
  cast(game, p, ctx) {
    const r = ROLL.cast(game, p, ctx);
    const sw = p.data.kit.sw;
    if (sw) {
      const C = WK(game).colors;
      sw.parryUntil = game.t + WK(game).parry.window; sw.parryN = 0;
      game.fx({ type: 'slash', x: p.x, y: p.y, angle: ctx.moveAngle, arc: 30, r: 1, color: C.gold, style: 'sword' });
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 6, r: 0.5, color: C.gold });
    }
    return r;
  },
});

// ---------- Flourish ----------
function flourish(game, p) {
  const K = WK(game), F = K.flourish, C = K.colors, sw = p.data.kit.sw;
  const pips = spendPips(game, p);
  const dur = F.dur + F.durPerPip * pips;
  sw.fl = { t: dur, a: p.angle, bladeT: 0, spinT: 0, n: 0 };
  game.combat.addMod(p, 'swash_flourish', { dmgTaken: F.dmgTaken }, dur);
  game.abilities.tagFor(p, 'haste', dur);
  game.ents.setAnim(p, 'spin', dur);
  game.fx({ type: 'screenFlash', color: C.main, dur: 0.15 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 2, color: C.gold, dur: 0.4 });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 20, r: 1.2, color: C.gold });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.8, text: 'Flourish!', style: 'crit' });
  game.camera.shake = Math.max(game.camera.shake, 0.45);
  sw.flourishes++;
}
function flourishStep(game, p, dt) {
  const sw = p.data.kit.sw, fl = sw.fl, K = WK(game), F = K.flourish, C = K.colors;
  p.data.kit.speedMul *= F.speedMul;
  fl.t -= dt; fl.bladeT -= dt; fl.spinT -= dt;
  const L = looks(game);
  while (fl.bladeT <= 0) {
    fl.bladeT += F.bladeEvery;
    for (let k = 0; k < 2; k++) {
      const a = fl.a + k * Math.PI;
      game.combat.projectile(p, { angle: a, speed: F.bladeSpeed, range: F.bladeRange, dmg: F.bladeCoef, look: L[(fl.n + k) & 1], radius: 0.25,
        pierce: true, knockback: 1, tags: TAG_FLOURISH });
    }
    fl.a += F.bladeTurn; fl.n++;
  }
  if (fl.spinT <= 0) {
    fl.spinT = F.spinEvery;
    game.combat.aoe(p, { r: F.spinR, dmg: F.spinCoef, critChance: F.spinCrit, knockback: 1.5, type: 'melee', fx: false, tags: TAG_FLOURISH });
    game.fx({ type: 'slash', x: p.x, y: p.y, angle: fl.a, arc: 360, r: F.spinR, color: (fl.n & 1) ? C.gold : C.main, style: 'spin' });
    game.fx({ type: 'slash', x: p.x, y: p.y, angle: fl.a + 1.2, arc: 70, r: F.spinR * 0.8, color: C.steel, style: 'sword' });
    if ((fl.n & 3) === 0) game.fx({ type: 'ring', x: p.x, y: p.y, r: F.spinR, color: C.gold, dur: 0.3 });
    if (p.anim !== 'spin') game.ents.setAnim(p, 'spin', fl.t);
  }
  if (fl.t <= 0) {
    sw.fl = null;
    game.combat.aoe(p, { r: F.finalR, dmg: F.finalCoef, knockback: 8, type: 'melee', fx: false, tags: TAG_FLOURISH, hitStop: 0.05 });
    game.abilities.use('multishot', p, { angle: fl.a, n: F.finalBlades, ring: true, look: L[0], speed: F.bladeSpeed * 1.2, range: F.bladeRange + 1,
      dmg: F.bladeCoef, pierce: true, knockback: 2, tags: TAG_FLOURISH, anim: 'attack' });
    game.fx({ type: 'shockwave', x: p.x, y: p.y, r: F.finalR, color: C.main });
    game.fx({ type: 'ring', x: p.x, y: p.y, r: F.finalR + 0.4, color: C.gold, dur: 0.5 });
    game.fx({ type: 'burst', x: p.x, y: p.y, n: 30, r: F.finalR, color: C.gold });
    game.fx({ type: 'screenFlash', color: C.gold, dur: 0.18 });
    game.fx({ type: 'text', x: p.x, y: p.y, z: 1.9, text: 'Touche!', style: 'crit' });
    game.camera.shake = Math.max(game.camera.shake, 0.5);
    game.ents.setAnim(p, 'attack', 0.3);
  }
}

export default {
  id: ID, parent: 'thief', tier: 3,

  onEquip(game, p) {
    p.data.kit.sw = { parryUntil: 0, parryN: 0, ripT: -9, fl: null, parries: 0, ripostes: 0, flourishes: 0 };
    const offs = [];
    SUBS.set(p, offs);
    // Hits that the roll's invulnerability swallows still count as parried (they never reach onIncoming).
    offs.push(game.bus.on('immune', (e) => {
      if (!e || e.target !== p || !parrying(game, p)) return;
      const s = e.source;
      if (!s || s === p || s.team === p.team) return;
      parry(game, p, s);
    }));
  },
  onUnequip(game, p) {
    const offs = SUBS.get(p);
    if (offs) { for (const off of offs) off(); SUBS.delete(p); }
    game.combat.removeMod(p, 'swash_flourish');
    if (p.data.kit.sw) p.data.kit.sw.fl = null;
  },

  update(game, p, dt) {
    const sw = p.data.kit.sw;
    if (!sw) return;
    if (sw.fl) flourishStep(game, p, dt);
    if (game.t <= sw.parryUntil && (game.tick & 7) === 0) game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 3, r: 0.4, color: WK(game).colors.gold });
  },

  hud(game, p, hud) {
    const sw = p.data.kit.sw, kh = game.kits.kitHud;
    hud.kitHud = kh;
    if (!sw) return;
    if (sw.fl) kh.label = LABEL_FLOURISH;
    else if (game.t <= sw.parryUntil) kh.label = LABEL_GARDE;
  },

  abilities: {
    space,
    shift: { id: U.id, name: U.name, icon: U.icon, unlock: U.unlock, cd: U.cd, desc: U.desc, cast: flourish,
      isActive(game, p) { return !!(p.data.kit.sw && p.data.kit.sw.fl); } },
  },

  hooks: {
    onOutgoing(game, p, info) { if (info.source === p) info.amount *= masteryScale(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= masteryScale(game, p); },
    onIncoming(game, p, info) {
      if (info.target !== p || !parrying(game, p) || !(info.amount > 0) || (info.opts && info.opts.dot) || info.type === 'true') return;
      const s = info.source;
      if (!s || s === p || s.team === p.team) return;
      info.cancel = true;
      parry(game, p, s);
    },
  },
};
