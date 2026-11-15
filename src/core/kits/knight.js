// Knight spec kit (docs/CLASSES.md "Knight — timing and protection"). Passive Bulwark Aura (classmates within 4
// take 30% less, gold ring under them), Knight's Cleave (rank III: free shield punch every fourth swing; rank IV:
// piercing crescent of light every third swing), F Shield Wall (hold: guard, Perfect Block reflects / stuns /
// +20 Rage, release = Shield Slam scaled by damage blocked), Shift Aegis of Flinkerton (golden dome, radiant end).
// Boons: Mirror Shield, Phalanx, Earthsplitter, Oathkeeper.
import { W, TAG_BASIC, TAG_SKILL } from './warrior.js';
import SPECDEFS from '../../data/specs/warrior.js';

const S = SPECDEFS.knight;
const N = (game) => W.snums(game, 'knight');
const C = (game) => W.sdef(game, 'knight').colors;

function shieldSlam(game, p, blocked) {
  const n = N(game).shield_slam, col = C(game);
  const pw = game.combat.powerOf(p);
  const amount = n.dmg * pw + Math.min(blocked * n.blockedFrac, n.capCoef * pw);
  const a = p.angle;
  game.combat.aoe(p, { x: p.x, y: p.y, shape: 'cone', angle: a, arc: n.arc, r: n.r, amount, knockback: n.knockback,
    type: 'melee', tags: TAG_SKILL, shake: 0.3, fx: { type: 'shockwave', r: n.r, angle: a, arc: n.arc, color: col.gold } });
  game.fx({ type: 'slash', x: p.x, y: p.y, angle: a, arc: n.arc, r: n.r, color: col.light, style: 'fist', w: 2 });
  game.fx({ type: 'burst', x: p.x + Math.cos(a) * 1.2, y: p.y + Math.sin(a) * 1.2, n: 18, r: 1.2, color: col.gold });
  game.ents.setAnim(p, 'attack', 0.25);
  if (W.has(game, p, 'earthsplitter')) {
    const b = W.bnums(game, 'earthsplitter');
    game.combat.projectile(p, { angle: a, model: 'wave', color: col.gold, glow: col.light, size: 1.6, speed: b.speed, range: b.range,
      amount, radius: b.radius, pierce: true, knockback: 6, type: 'melee', tags: TAG_SKILL, ghost: false });
    game.fx({ type: 'shockwave', x: p.x + Math.cos(a) * b.range, y: p.y + Math.sin(a) * b.range, r: 1.2, color: col.gold });
  }
  game.bus.emit('sfx', { id: 'hit' });
  return amount;
}

function aegisEnd(game, p, kn) {
  const n = N(game).aegis, col = C(game);
  kn.aegis = false;
  game.fx({ type: 'pillar', x: kn.ax, y: kn.ay, r: 2, color: col.light, dur: 1 });
  game.combat.aoe(p, { x: kn.ax, y: kn.ay, r: n.endR, dmg: n.endDmg, knockback: 10, type: 'magic', element: 'holy', tags: TAG_SKILL,
    fx: 'shockwave', color: col.gold, shake: 0.55 });
  game.fx({ type: 'ring', x: kn.ax, y: kn.ay, r: n.endR + 1, color: col.light, dur: 0.7 });
  game.fx({ type: 'sparkle', x: kn.ax, y: kn.ay, n: 30, r: n.endR, color: col.gold });
  game.fx({ type: 'screenFlash', x: kn.ax, y: kn.ay, color: '#fff3c4', dur: 0.25 });
}

export default {
  id: 'knight',
  parent: 'warrior',
  interval(game, p, r) { return r >= 3 ? N(game).cleave.interval : W.nums(game).sword_arc.interval; },
  basicInfo(game, p, r) {
    if (r < 3) return W.cdef(game).ranks[Math.max(1, r)];
    const ranks = W.sdef(game, 'knight').ranks;
    return ranks[Math.min(4, r)] || ranks[3];
  },

  onEquip(game, p) {
    const n = N(game);
    p.data.kit.kn = { cleaves: 0, punchAt: -1, punchAngle: 0, pulseT: 0, aegis: false, aegisEnd: 0, ax: 0, ay: 0,
      phalanxT: 0, bulwarkMods: { dmgTaken: n.bulwark.dmgTaken } };
  },
  onUnequip(game, p) {
    if (p.data.guard) game.abilities.unguard(p);
  },

  update(game, p, dt) {
    const kn = p.data.kit.kn;
    if (!kn) return;
    const n = N(game), col = C(game);
    // Bulwark Aura: classmates within r take less damage; a faint gold ring pulses under them.
    const comps = game.companions ? game.companions.active : null;
    kn.pulseT -= dt;
    const pulse = kn.pulseT <= 0;
    if (pulse) kn.pulseT = n.bulwark.pulse;
    if (comps) {
      const r2 = n.bulwark.r * n.bulwark.r;
      for (let i = 0; i < comps.length; i++) {
        const c = comps[i];
        if (c.removed || c.data.down) continue;
        const dx = c.x - p.x, dy = c.y - p.y;
        if (dx * dx + dy * dy > r2) continue;
        game.combat.addMod(c, 'bulwark', kn.bulwarkMods, 0.25);
        if (pulse) W.fx(game, 'ring', c.x, c.y, 0.7, col.gold, 0, 0.8);
      }
    }
    // Free shield punch after every fourth cleave.
    if (kn.punchAt > 0 && game.t >= kn.punchAt) {
      kn.punchAt = -1;
      const pn = n.punch;
      game.abilities.use('melee_arc', p, { angle: kn.punchAngle, arc: pn.arc, range: pn.range, dmg: pn.dmg, knockback: pn.knockback,
        status: { stun: pn.stun }, tags: TAG_BASIC, style: 'fist', color: col.gold, hitStop: 0.05,
        fx: { type: 'slash', arc: pn.arc, r: pn.range, color: col.gold, style: 'fist' } });
      W.fx(game, 'burst', p.x + Math.cos(kn.punchAngle) * 0.7, p.y + Math.sin(kn.punchAngle) * 0.7, 0.5, col.steel, 8);
    }
    // Aegis ends with a radiant pillar + shockwave.
    if (kn.aegis && game.t >= kn.aegisEnd) aegisEnd(game, p, kn);
  },

  hud(game, p, hud) {
    const kn = p.data.kit.kn;
    if (!kn) return;
    const kh = game.kits.kitHud;
    if (p.data.guard) { kh.stance = 'Shield Wall'; hud.kitHud = kh; } else if (kn.aegis) { kh.stance = 'Aegis'; hud.kitHud = kh; }
  },

  basic(game, p, ctx) {
    if (ctx.rank < 3) return W.classBasic(game, p, ctx);
    const kn = p.data.kit.kn;
    const n = N(game), col = C(game);
    kn.cleaves++;
    game.abilities.use('melee_arc', p, { angle: ctx.angle, arc: n.cleave.arc, range: n.cleave.range, dmg: n.cleave.dmg,
      knockback: n.cleave.knockback, tags: TAG_BASIC, style: 'sword', color: col.light });
    if (kn.cleaves % n.punch.every === 0) { kn.punchAt = game.t + n.punch.delay; kn.punchAngle = ctx.angle; }
    if (ctx.rank >= 4 && kn.cleaves % n.crescent.every === 0) {
      game.abilities.use('projectile', p, { angle: ctx.angle, model: 'crescent', color: col.light, glow: col.gold, size: 1.4,
        speed: n.crescent.speed, range: n.crescent.range, dmg: n.crescent.dmg, radius: n.crescent.radius, pierce: true,
        knockback: 3, type: 'magic', element: 'holy', tags: TAG_SKILL, anim: 'attack', sfx: 'spell' });
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 10, r: 0.8, color: col.gold });
    }
    W.afterBasic(game, p, ctx.angle);
    return undefined;
  },

  abilities: {
    f: W.ability(S.abilities, 'shield_wall', {
      cast(game, p) {
        const n = N(game).shield_wall, col = C(game);
        game.abilities.use('guard', p, { arc: n.arc, reduce: n.reduce, perfect: n.perfect, reflect: true, stunAttacker: n.stunAttacker,
          speedMul: n.speedMul, color: col.gold, anim: 'block' });
        p.data.kit.kn.phalanxT = 0;
        game.fx({ type: 'ring', x: p.x, y: p.y, r: 0.8, color: col.steel, dur: 0.25 });
        return undefined;
      },
      hold(game, p, ctx, dt) {
        const kn = p.data.kit.kn;
        if (!p.data.guard) return false;
        if (p.anim !== 'block' && p.anim !== 'attack') game.ents.setAnim(p, 'block');
        if (W.has(game, p, 'phalanx')) {
          kn.phalanxT -= dt;
          if (kn.phalanxT <= 0) {
            const b = W.bnums(game, 'phalanx');
            kn.phalanxT = b.refresh;
            const comps = game.companions ? game.companions.active : null;
            if (comps) for (let i = 0; i < comps.length; i++) {
              const c = comps[i];
              if (c.removed || c.data.down) continue;
              const dx = c.x - p.x, dy = c.y - p.y;
              if (dx * dx + dy * dy > b.r * b.r) continue;
              if (!(c.status.shield > 0)) W.fx(game, 'ring', c.x, c.y, 0.8, C(game).gold, 0, 0.4);
              game.combat.status(c, 'shield', b.refresh + 0.3, Math.max(1, Math.round(c.hpMax * b.frac)));
            }
          }
        }
        return undefined;
      },
      release(game, p) {
        const r = game.abilities.unguard(p);
        if (r && r.blocks > 0) shieldSlam(game, p, r.blocked);
      },
      isActive(game, p) { return !!p.data.guard; },
    }),
    shift: W.ability(S.abilities, 'aegis', {
      cast(game, p) {
        const kn = p.data.kit.kn;
        const n = N(game).aegis, col = C(game);
        const oath = W.has(game, p, 'oathkeeper');
        const ob = W.bnums(game, 'oathkeeper');
        const dur = n.dur + (oath ? ob.extra : 0);
        game.combat.zone(p, { x: p.x, y: p.y, r: n.r, dur, tick: 0.25, bubble: true, allyMod: { dmgTaken: n.dmgTaken },
          push: n.push, heal: oath ? ob.healCoef * 0.25 : 0, color: col.gold, id: 'aegis' });
        kn.aegis = true; kn.aegisEnd = game.t + dur; kn.ax = p.x; kn.ay = p.y;
        game.combat.addMod(p, 'zone:aegis', { dmgTaken: n.dmgTaken }, 0.3);
        game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.3, color: col.gold, dur: 0.8 });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: n.r, color: col.light, dur: 0.6 });
        game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 24, r: n.r, color: col.gold });
        game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: col.gold, dur: 0.18 });
        game.camera.shake = Math.max(game.camera.shake, 0.3);
        game.ents.setAnim(p, 'cast', 0.4);
        game.bus.emit('sfx', { id: 'spell' });
        return undefined;
      },
      isActive(game, p) { return !!(p.data.kit.kn && p.data.kit.kn.aegis); },
    }),
  },

  hooks: {
    onBlock(game, p, e) {
      const n = N(game), col = C(game);
      if (!e.perfect) return;
      W.gainRage(game, p, n.shield_wall.perfectRage);
      game.fx({ type: 'ring', x: p.x, y: p.y, r: 2, color: col.gold, dur: 0.45 });
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 18, r: 1.1, color: col.light });
      game.camera.shake = Math.max(game.camera.shake, 0.2);
      const src = e.source;
      if (W.has(game, p, 'mirror_shield') && src && src !== p && game.combat.targetable(src)) {
        const b = W.bnums(game, 'mirror_shield');
        const a = Math.atan2(src.y - p.y, src.x - p.x);
        const len = game.world.raycast(p.x, p.y, a, b.range, true);
        game.combat.aoe(p, { x: p.x, y: p.y, shape: 'line', angle: a, len, w: b.w, dmg: b.dmg, knockback: 4, type: 'magic',
          element: 'holy', tags: TAG_SKILL, fx: 'beam', color: col.light });
      }
    },
  },
};
