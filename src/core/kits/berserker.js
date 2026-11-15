// Berserker spec kit (docs/CLASSES.md "Berserker — risk and momentum"). Passive Wild Heart (attack speed +0..60% as
// hp falls 100% -> 30%; Rage never decays; at 100 Rage Frenzy: 6 s, Rage drains to 0, fxTag frenzy, afterimages,
// +40% attack speed, 8% lifesteal), Twin Axes (rank III alternating chops, +8 Rage per hit; rank IV every fourth chop
// throws a returning axe), F Whirlwind (hold: drains Rage, spins and shreds), Shift Skyfall Leap (z arc, meteor landing,
// bigger during Frenzy). Boons: Cyclone, Axe Storm, Meteor Heart, Undying.
import { W, TAG_BASIC, TAG_SKILL } from './warrior.js';
import SPECDEFS from '../../data/specs/warrior.js';

const S = SPECDEFS.berserker;
const N = (game) => W.snums(game, 'berserker');
const C = (game) => W.sdef(game, 'berserker').colors;
const FRENZY_MODS = { attackSpeed: 0 };

function frenzyOn(game, p) { const bz = p.data.kit.bz; return !!bz && bz.frenzyEnd > game.t; }

function startFrenzy(game, p) {
  const k = p.data.kit, bz = k.bz;
  const n = N(game).frenzy, col = C(game);
  bz.frenzyEnd = game.t + n.dur;
  bz.frenzyMods.attackSpeed = n.attackSpeed;
  game.combat.addMod(p, 'frenzy', bz.frenzyMods, n.dur);
  game.abilities.tagFor(p, 'frenzy', n.dur);
  k.rageLock = true;
  if (W.has(game, p, 'undying')) {
    bz.undying = true; bz.prevMinHp = p.data.minHp;
    p.data.minHp = Math.max(p.data.minHp || 0, 1);
  }
  game.fx({ type: 'shockwave', x: p.x, y: p.y, r: 2.6, color: col.crimson });
  game.fx({ type: 'burst', x: p.x, y: p.y, n: 30, r: 1.6, color: col.crimson });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.9, color: col.blood, dur: 0.6 });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.7, text: 'FRENZY!', style: 'info', ent: p.id });
  game.camera.shake = Math.max(game.camera.shake, 0.35);
  game.bus.emit('sfx', { id: 'boss' });
  game.bus.emit('frenzy', { ent: p, on: true });
}
function endFrenzy(game, p) {
  const k = p.data.kit, bz = k.bz;
  bz.frenzyEnd = 0;
  k.rageLock = false;
  game.kits.setResource(p, 0);
  game.combat.removeMod(p, 'frenzy');
  if (bz.undying) { bz.undying = false; p.data.minHp = bz.prevMinHp; bz.prevMinHp = undefined; }
  game.fx({ type: 'poof', x: p.x, y: p.y, color: C(game).bone });
  game.bus.emit('frenzy', { ent: p, on: false });
}

function skyLand(game, p) {
  const bz = p.data.kit && p.data.kit.bz;
  if (!bz) return;
  const n = N(game).skyfall, col = C(game);
  const big = bz.leapFrenzy;
  const r = big ? n.frenzyR : n.r;
  game.fx({ type: 'meteor', x: p.x, y: p.y, r, color: col.crimson });
  game.fx({ type: 'burst', x: p.x, y: p.y, n: big ? 40 : 24, r: r * 0.8, color: col.bone });
  game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: big ? col.crimson : '#ffd6c8', dur: 0.2 });
  if (big) {
    game.fx({ type: 'ring', x: p.x, y: p.y, r: r + 1.2, color: col.blood, dur: 0.7 });
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      game.fx({ type: 'meteor', x: p.x + Math.cos(a) * r * 0.7, y: p.y + Math.sin(a) * r * 0.7, r: 0.8, color: col.blood });
    }
  }
  if (W.has(game, p, 'meteor_heart')) {
    const b = W.bnums(game, 'meteor_heart');
    game.combat.zone(p, { x: p.x, y: p.y, r: b.r, dur: b.dur, tick: 0.5, dmg: b.dmg, element: 'fire',
      status: { id: 'burn', t: 2, p: b.burn * game.combat.powerOf(p) }, color: '#ff5a1f', id: 'meteor_heart' });
    game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.2, color: '#ff7a2f', dur: 0.7 });
  }
}

export default {
  id: 'berserker',
  parent: 'warrior',
  interval(game, p, r) { return r >= 3 ? N(game).axes.interval : W.nums(game).sword_arc.interval; },
  basicInfo(game, p, r) {
    if (r < 3) return W.cdef(game).ranks[Math.max(1, r)];
    const ranks = W.sdef(game, 'berserker').ranks;
    return ranks[Math.min(4, r)] || ranks[3];
  },

  onEquip(game, p) {
    const k = p.data.kit;
    const n = N(game);
    k.noDecay = true;
    k.ragePerHit = n.axes.rage;
    k.bz = { chops: 0, frenzyEnd: 0, frenzyMods: Object.assign({}, FRENZY_MODS), wild: { attackSpeed: 0 }, lsAcc: 0, aiT: 0,
      spin: false, spinT: 0, tickT: 0, undying: false, prevMinHp: undefined, leapFrenzy: false };
    game.combat.addMod(p, 'wild_heart', k.bz.wild, Infinity);
  },
  onUnequip(game, p) {
    const k = p.data.kit, bz = k.bz;
    game.combat.removeMod(p, 'wild_heart');
    game.combat.removeMod(p, 'frenzy');
    if (bz && bz.undying) p.data.minHp = bz.prevMinHp;
    if (bz && bz.spin) k.speedMul = 1;
    k.rageLock = false;
  },

  update(game, p, dt) {
    const k = p.data.kit, bz = k.bz;
    if (!bz) return;
    const n = N(game), col = C(game);
    // Wild Heart: attack speed grows as health falls.
    const wh = n.wild_heart;
    const hpf = p.hpMax > 0 ? p.hp / p.hpMax : 1;
    const f = Math.max(0, Math.min(1, (wh.hpHigh - hpf) / (wh.hpHigh - wh.hpLow)));
    bz.wild.attackSpeed = wh.maxAttackSpeed * f;
    // Frenzy
    if (bz.frenzyEnd > 0) {
      const left = bz.frenzyEnd - game.t;
      if (left <= 0) endFrenzy(game, p);
      else {
        game.kits.setResource(p, p.data.resource.max * (left / n.frenzy.dur));
        bz.aiT -= dt;
        if (bz.aiT <= 0) {
          bz.aiT = n.frenzy.afterimage;
          const fx = W.prep('afterimage', p.x, p.y, 0, col.crimson);
          fx.ent = p.id;
          game.fx(fx);
        }
      }
    } else if (W.rage(game, p) >= n.frenzy.at) startFrenzy(game, p);
  },

  hud(game, p, hud) {
    const bz = p.data.kit.bz;
    if (!bz) return;
    const kh = game.kits.kitHud;
    if (bz.frenzyEnd > game.t) { kh.stance = 'FRENZY'; hud.kitHud = kh; } else if (bz.spin) { kh.stance = 'Whirlwind'; hud.kitHud = kh; }
  },

  basic(game, p, ctx) {
    if (ctx.rank < 3) return W.classBasic(game, p, ctx);
    const bz = p.data.kit.bz;
    const n = N(game), col = C(game);
    bz.chops++;
    const side = bz.chops % 2 ? 1 : -1;
    const fr = bz.frenzyEnd > game.t;
    const a = n.axes;
    game.abilities.use('melee_arc', p, { angle: ctx.angle, arc: a.arc, range: a.range, dmg: a.dmg, knockback: a.knockback,
      tags: TAG_BASIC, style: 'axe', color: fr ? col.crimson : col.bone, animDur: a.swing,
      fx: { type: 'slash', angle: ctx.angle + side * 0.35, arc: a.arc, r: a.range, color: fr ? col.crimson : col.bone, style: 'axe' } });
    if (ctx.rank >= 4 && bz.chops % n.throw.every === 0) {
      const storm = W.has(game, p, 'axe_storm');
      const b = W.bnums(game, 'axe_storm');
      game.abilities.use('projectile', p, { angle: ctx.angle, model: 'axe', color: col.bone, glow: col.crimson, size: 1.3,
        speed: n.throw.speed, range: n.throw.range, dmg: n.throw.dmg, radius: n.throw.radius, returns: true,
        pierce: storm ? 0 : true, bounce: storm ? b.bounces : 0, bounceRange: b.bounceRange || 4,
        knockback: 2, type: 'melee', tags: TAG_SKILL, anim: 'attack', sfx: 'swing' });
    }
    W.afterBasic(game, p, ctx.angle);
    return undefined;
  },

  abilities: {
    f: W.ability(S.abilities, 'whirlwind', {
      cast(game, p) {
        const k = p.data.kit, bz = k.bz;
        bz.spin = true; bz.spinT = 0; bz.tickT = 0;
        k.speedMul = N(game).whirlwind.speedMul;
        game.ents.setAnim(p, 'spin');
        game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.2, color: C(game).bone, dur: 0.3 });
        return undefined;
      },
      hold(game, p, ctx, dt) {
        const k = p.data.kit, bz = k.bz;
        const n = N(game), w = n.whirlwind, col = C(game);
        // Outside Frenzy the spin burns Rage; inside Frenzy it burns Frenzy time instead (same rate).
        if (bz.frenzyEnd > game.t) bz.frenzyEnd -= dt * (w.drain / p.data.resource.max) * n.frenzy.dur;
        else if (!game.kits.spend(p, w.drain * dt)) return false;
        bz.spinT += dt;
        bz.tickT -= dt;
        if (p.anim !== 'spin') game.ents.setAnim(p, 'spin');
        if (bz.tickT > 0) return undefined;
        bz.tickT += w.tick;
        const cyc = W.has(game, p, 'cyclone');
        const cb = W.bnums(game, 'cyclone');
        const r = cyc ? w.r + (cb.maxR - w.r) * Math.min(1, bz.spinT / cb.growT) : w.r;
        game.combat.aoe(p, { x: p.x, y: p.y, r, dmg: w.dmg, knockback: cyc ? cb.pull : w.knockback, pull: cyc, type: 'melee',
          tags: TAG_SKILL, fx: false });
        const fx = W.prep('slash', p.x, p.y, r, bz.frenzyEnd ? col.crimson : col.bone);
        fx.style = 'spin'; fx.arc = 360; fx.angle = bz.spinT * 12;
        game.fx(fx);
        W.fx(game, 'ring', p.x, p.y, r, cyc ? '#cfd8dc' : '#e8f0f4', 0, 0.25);
        game.bus.emit('sfx', { id: 'swing' });
        return undefined;
      },
      release(game, p) {
        const k = p.data.kit, bz = k.bz;
        bz.spin = false;
        k.speedMul = 1;
        if (p.anim === 'spin') game.ents.setAnim(p, 'idle');
      },
      isActive(game, p) { return !!(p.data.kit.bz && p.data.kit.bz.spin); },
    }),
    shift: W.ability(S.abilities, 'skyfall_leap', {
      cast(game, p, ctx) {
        const bz = p.data.kit.bz;
        const n = N(game).skyfall, col = C(game);
        const big = bz.frenzyEnd > game.t;
        bz.leapFrenzy = big;
        // Aim: the nearest enemy within range in front (cone), else straight ahead in the move direction.
        const a0 = ctx.moveAngle;
        let tx = null, ty = null, bd = n.dist * n.dist;
        const half = (n.coneDeg * Math.PI / 180) / 2;
        const list = game.ents.inRadius(p.x, p.y, n.dist, null);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (!game.combat.canHit(p, e)) continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
          let da = Math.atan2(dy, dx) - a0;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) > half || d >= bd) continue;
          bd = d; tx = e.x; ty = e.y;
        }
        const o = { dur: n.dur, height: big ? n.height * 1.3 : n.height, invuln: true, onLand: skyLand,
          land: { r: big ? n.frenzyR : n.r, dmg: n.dmg, mult: big ? n.frenzyMult : 0, knockback: n.knockback, status: { stun: n.stun },
            fx: 'shockwave', color: col.crimson, shake: big ? 0.7 : 0.5, type: 'melee', tags: TAG_SKILL } };
        if (tx != null) { o.x = tx; o.y = ty; } else { o.angle = a0; o.dist = n.dist; }
        game.abilities.use('leap', p, o);
        game.fx({ type: 'burst', x: p.x, y: p.y, n: 16, r: 0.9, color: col.bone });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.2, color: col.crimson, dur: 0.3 });
        const ai = W.prep('afterimage', p.x, p.y, 0, col.crimson);
        ai.ent = p.id;
        game.fx(ai);
        return undefined;
      },
    }),
  },

  hooks: {
    onHit(game, p, e) {
      const bz = p.data.kit && p.data.kit.bz;
      if (!bz || !(e.amount > 0) || bz.frenzyEnd <= game.t || e.target === p) return;
      bz.lsAcc += e.amount * N(game).frenzy.lifesteal;
      if (bz.lsAcc >= 1) {
        const h = Math.floor(bz.lsAcc);
        bz.lsAcc -= h;
        game.combat.heal(p, h, { silent: true, source: p });
      }
    },
  },
};
