// Juggernaut mastery (tier 3, layered over berserker; docs/MASTERY.md). Unstoppable.
// Passive Unstoppable Force: Rage makes you bigger (entity scale up to +30%) and tougher (up to 30% less damage);
// above 50 Rage (or in Frenzy) you cannot be knocked back and you trample enemies you walk into (dust, small hits,
// shoved aside). Shift Stampede (unlock 15): a rolling, invulnerable charge of four legs; each leg plows through
// everything and bounces toward the next enemy, kicking up dust and afterimages, and it ends in a huge quake.
import { W, TAG_SKILL } from './warrior.js';
import { MW } from './paladin.js';

const ID = 'juggernaut';
const N = (game) => MW.nums(game, ID);
const C = (game) => MW.colors(game, ID);
const foes = [];

function frenzyOn(game, p) { const bz = p.data.kit.bz; return !!bz && bz.frenzyEnd > game.t; }

function stHit(game, t, dealt, c) {
  const jg = c.data.kit && c.data.kit.jg;
  if (!jg || !jg.st) return;
  jg.st.hits++;
  jg.st.last = t.id;
  const col = C(game);
  game.fx({ type: 'burst', x: t.x, y: t.y, n: 12, r: 0.8, color: col.ember });
  game.fx({ type: 'hit', x: t.x, y: t.y, color: col.magma });
  game.camera.shake = Math.max(game.camera.shake, 0.3);
}
function stEnd(game, c) {
  const jg = c.data.kit && c.data.kit.jg;
  if (!jg || !jg.st) return;
  const st = jg.st, col = C(game);
  st.seg++;
  st.next = game.t + N(game).stampede.gap;
  st.dashing = false;
  game.fx({ type: 'shockwave', x: c.x, y: c.y, r: 1.6, color: col.dust });
}

function nextLeg(game, p, jg) {
  const n = N(game).stampede, col = C(game), st = jg.st;
  // the nearest enemy ahead (140 degrees) that the last leg did not just hit, else any nearby, else straight on
  MW.foes(game, p, p.x, p.y, n.seek, foes);
  let best = null, bs = 1e9;
  for (let pass = 0; pass < 2 && !best; pass++) {
    for (let i = 0; i < foes.length; i++) {
      const e = foes[i];
      if (e.id === st.last && foes.length > 1) continue;
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      let da = a - st.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (pass === 0 && Math.abs(da) > 1.22) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bs) { bs = d; best = e; }
    }
  }
  let dist = n.dist;
  if (best) { st.angle = Math.atan2(best.y - p.y, best.x - p.x); dist = Math.min(n.dist * 1.6, Math.max(n.dist, bs + 1.6)); }
  st.dashing = true;
  game.abilities.use('dash', p, { angle: st.angle, dist, speed: n.speed, dmg: n.dmg, through: true, stopOnHit: false, hitRadius: n.hitRadius,
    knockback: n.knockback, status: { stun: n.stun }, invuln: true, tags: TAG_SKILL, color: col.ember, onHit: stHit, onEnd: stEnd });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.2, color: col.ember, dur: 0.3 });
  game.bus.emit('sfx', { id: 'swing' });
}

function finale(game, p, jg) {
  const n = N(game).stampede, col = C(game);
  jg.st = null;
  jg.stampedes++;
  game.combat.status(p, 'invuln', 0);
  game.combat.aoe(p, { x: p.x, y: p.y, r: n.endR, dmg: n.endDmg, knockback: 12, status: { stun: n.endStun }, type: 'melee', tags: TAG_SKILL,
    fx: 'shockwave', color: col.ember, shake: 0.8 });
  game.fx({ type: 'meteor', x: p.x, y: p.y, r: n.endR * 0.8, color: col.ember });
  MW.crater(game, p, p.x, p.y);
  game.fx({ type: 'ring', x: p.x, y: p.y, r: n.endR + 1.4, color: col.dust, dur: 0.8 });
  game.fx({ type: 'burst', x: p.x, y: p.y, n: 40, r: n.endR, color: col.dust });
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + 0.25;
    game.fx({ type: 'meteor', x: p.x + Math.cos(a) * n.endR * 0.75, y: p.y + Math.sin(a) * n.endR * 0.75, r: 0.9, color: col.iron });
  }
  game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: '#ffb38a', dur: 0.3 });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 2, text: 'STAMPEDE!', style: 'info', ent: p.id });
  game.ents.setAnim(p, 'attack', 0.3);
  game.bus.emit('sfx', { id: 'boss' });
}

export default {
  id: ID,
  parent: 'berserker',
  tier: 3,

  onEquip(game, p) {
    const jg = p.data.kit.jg = { mods: { dmgTaken: 0, kbImmune: 0, kbResist: 0 }, size: 0, trampleT: 0, tramples: 0, st: null, stampedes: 0, dustT: 0, big: false };
    game.combat.addMod(p, 'juggernaut_force', jg.mods, Infinity);
    MW.equipLook(game, p, ID);
    W.refresh(game, p);
  },
  onUnequip(game, p) {
    game.combat.removeMod(p, 'juggernaut_force');
    p.scale = 1;
    const jg = p.data.kit.jg;
    if (jg) jg.st = null;
  },
  aura(game, p) { return MW.aura(game, p, ID); },

  update(game, p, dt) {
    const jg = p.data.kit.jg;
    if (!jg) return;
    const n = N(game), F = n.force, col = C(game);
    const fr = frenzyOn(game, p);
    const rage = W.rage(game, p);
    const f = fr ? 1 : Math.min(1, rage / 100);
    // size follows Rage smoothly; armor and knockback immunity follow it at once
    jg.size += (f - jg.size) * Math.min(1, dt * 4);
    p.scale = 1 + F.maxSize * jg.size;
    jg.mods.dmgTaken = -F.maxArmor * f;
    const big = fr || rage > F.kbAt;
    jg.mods.kbImmune = big ? 1 : 0;
    jg.mods.kbResist = big ? 1 : 0;
    if (big !== jg.big) {
      jg.big = big;
      if (big) { W.fx(game, 'shockwave', p.x, p.y, 1.4, col.ember); W.fx(game, 'burst', p.x, p.y, 1, col.dust, 14); }
    }
    // Trample: walking into enemies while big shoves them aside with a small hit
    jg.trampleT -= dt;
    if (big && jg.trampleT <= 0 && !jg.st && (p.vx * p.vx + p.vy * p.vy) > 0.5) {
      jg.trampleT = F.trampleEvery;
      const a = Math.atan2(p.vy, p.vx), reach = p.radius * p.scale + 0.15;
      const x = p.x + Math.cos(a) * reach, y = p.y + Math.sin(a) * reach;
      const hits = game.combat.aoe(p, { x, y, r: F.trampleR + 0.1 * p.scale, dmg: F.trampleDmg, knockback: F.trampleKb, type: 'melee', tags: TAG_SKILL, fx: false });
      if (hits.length) {
        jg.tramples++;
        W.fx(game, 'burst', x, y, 0.6, col.dust, 10);
        W.fx(game, 'ring', x, y, 0.8, col.ember, 0, 0.25);
      }
    }
    // Stampede legs
    const st = jg.st;
    if (st) {
      if (st.dashing) {
        jg.dustT -= dt;
        if (jg.dustT <= 0) {
          jg.dustT = n.stampede.dustEvery;
          W.fx(game, 'burst', p.x, p.y, 0.7, col.dust, 6);
          const ai = W.prep('afterimage', p.x, p.y, 0, col.ember);
          ai.ent = p.id;
          game.fx(ai);
        }
        if (!game.abilities.busy(p) && game.t > st.legT + 1) stEnd(game, p);   // safety: a dash that never reported its end
      } else if (game.t >= st.next) {
        if (st.seg >= n.stampede.segs) finale(game, p, jg);
        else { st.legT = game.t; nextLeg(game, p, jg); }
      }
    }
  },

  hud(game, p, hud) {
    const jg = p.data.kit.jg;
    if (jg && jg.st) { const kh = game.kits.kitHud; kh.stance = 'STAMPEDE'; hud.kitHud = kh; }
  },

  abilities: {
    shift: MW.ability(ID, 'stampede', {
      cast(game, p, ctx) {
        const jg = p.data.kit.jg;
        const n = N(game).stampede, col = C(game);
        jg.st = { seg: 0, next: game.t, legT: game.t, angle: ctx.moveAngle, last: 0, hits: 0, dashing: false };
        game.combat.status(p, 'invuln', n.segs * 0.5 + 0.4);
        game.fx({ type: 'shockwave', x: p.x, y: p.y, r: 2.2, color: col.ember });
        game.fx({ type: 'burst', x: p.x, y: p.y, n: 26, r: 1.4, color: col.dust });
        game.fx({ type: 'text', x: p.x, y: p.y, z: 1.8, text: 'CHARGE!', style: 'info', ent: p.id });
        game.camera.shake = Math.max(game.camera.shake, 0.4);
        game.bus.emit('sfx', { id: 'boss' });
        return undefined;
      },
      isActive(game, p) { return !!(p.data.kit.jg && p.data.kit.jg.st); },
    }),
  },

  hooks: {
    onOutgoing(game, p, info) { const m = MW.mul(game, p, ID); if (m !== 1) info.amount *= m; },
  },
};
