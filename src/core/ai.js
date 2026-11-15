// AI (CONTRACTS 4, 12a): brains for enemies, guards, bosses and allies (companions, summons, clones).
// Brains think at 10 Hz, staggered by entity id; between thinks the stored steering vector is applied. Steering
// is direct; A* is used only when an entity is stuck. Every enemy attack has a windup >= 0.3 s with
// anim 'charge' and (per attack `telegraph`) an effect telegraph entity. Boss shields per 12a.
import { ANIM } from '../contracts.js';
import { angleTo, angleDiff, dirFromVec } from './math.js';

const THINK_EVERY = 6;            // steps (60 Hz / 6 = 10 Hz)
const MIN_ENEMY_WINDUP = 0.3;
const DEFAULT_TELEGRAPH = { aoe_ring: 'circle', ground_target: 'circle', dash: 'line', beam: 'line', leap: 'circle', chain: null,
  melee_arc: null, projectile: null, multishot: 'cone', summon: 'circle', zone: 'circle', blink: null, buff_self: null, heal: null, guard: null, stealth: null };
const GUARD_ATTACK = [{ use: 'melee_arc', range: 0.9, arc: 100, dmg: 1, cd: 1, windup: 0.4, knockback: 4, style: 'sword' }];
const ALLY = { ally_melee: 1, ally_ranged: 1, ally_tank: 1 };

export default {
  id: 'ai',
  init(game) {
    const ents = game.ents;
    const rng = game.rng;
    const scratch = [];
    const C = () => game.combat;
    const bossHud = { name: '', hpFrac: 1, shield: false };
    let fSelf = null;
    const enemyOfSelf = (t) => validTarget(fSelf, t);

    function validTarget(e, t) {
      if (!t || t === e || !C().targetable(t)) return false;
      if (!C().hostile(e, t)) return false;
      if (ALLY[e.ai.brain] === 1 && t.team !== 'enemy') return false;
      if (t.status.stealth > 0 && e.team !== 'player') return false;
      if (e.ai.brain === 'guard' && t.type === 'npc') return false;
      return true;
    }
    function dist(a, b) { const dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }

    function attach(e, aiDef, attacksOverride) {
      const cfg = aiDef || {};
      let list = attacksOverride || (e.def && e.def.attacks) || [];
      if (!list.length && (cfg.brain === 'guard')) list = GUARD_ATTACK;
      const attacks = [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        attacks.push({ def: a, params: Object.assign({}, a), cdUntil: game.t + rng.next() * (a.cd || 1) * 0.5, i, name: a.name || a.use });
      }
      const home = e.data.home || { x: e.x, y: e.y };
      e.data.home = home;
      e.ai = {
        brain: cfg.brain || 'chaser', cfg,
        aggro: cfg.aggro != null ? cfg.aggro : 6, leash: cfg.leash != null ? cfg.leash : 12,
        keepRange: cfg.keepRange != null ? cfg.keepRange : (cfg.brain === 'ally_ranged' ? 3.5 : 4),
        fleeHp: cfg.fleeHp || 0, blinkCd: cfg.blinkCd || 0, swarm: !!cfg.swarm, summon: cfg.summon || null,
        target: null, home, attacks, atk: null, windT: 0, windTotal: 0, recoverT: 0, aimA: 0, aimX: 0, aimY: 0, tele: null,
        mx: 0, my: 0, speedMul: 1, strafe: (e.id & 1) ? 1 : -1, strafeT: 0, wanderT: 0, wx: home.x, wy: home.y,
        lastX: e.x, lastY: e.y, stuckT: 0, path: [], pathI: 0, pathT: -9, blinkT: game.t + (cfg.blinkCd || 0), summonT: game.t + 1.5,
        blindT: 0, provoked: false, hidden: cfg.brain === 'ambusher', returning: false, fleeT: 0, orbitA: (e.id * 2.39996) % (Math.PI * 2),
        phase: 0, patternI: 0, waitT: 0, shieldIdx: 0, shielded: false, asking: false, retryT: 0, engaged: false, formation: 0,
      };
      if (e.ai.hidden) { e.alpha = 0.35; ents.setAnim(e, ANIM.SLEEP); ents.setFxTag(e, 'sleep', true); }
      if (cfg.taunt || e.ai.brain === 'ally_tank') e.data.taunt = true;
      const boss = e.def && e.def.boss;
      if (boss) {
        if (!e.tags.includes('boss')) e.tags.push('boss');
        const th = (boss.shieldAt || []).slice().sort((a, b) => b - a);
        e.ai.thresholds = th;
        if (th.length) e.data.minHp = Math.max(1, Math.floor(th[0] * e.hpMax));
      }
      return e.ai;
    }

    function removeTele(ai) { if (ai.tele) { ents.remove(ai.tele); ai.tele = null; } }
    function interrupt(e) {
      const ai = e.ai;
      if (!ai || !(ai.windT > 0)) return;
      ai.windT = 0; ai.atk = null; ai.recoverT = 0.25;
      removeTele(ai);
      if (e.anim === ANIM.CHARGE) { e.anim = ANIM.IDLE; e.animT = 0; e.data.animUntil = undefined; }
    }

    function acquire(e, ai, radius) {
      if (ai.blindT > game.t) { ai.target = null; return null; }
      let cur = ai.target != null ? ents.get(ai.target) : null;
      if (cur && !validTarget(e, cur)) { cur = null; ai.target = null; }
      fSelf = e;
      const cand = ents.inRadius(e.x, e.y, radius, enemyOfSelf, scratch);
      let best = null, bs = Infinity;
      const ally = ALLY[ai.brain] === 1;
      const owner = ally && e.owner != null ? ents.get(e.owner) : null;
      for (let i = 0; i < cand.length; i++) {
        const t = cand[i];
        let s = dist(e, t);
        if (t.data.taunt) s -= 6;
        if (ally) {
          if (t.status.mark > 0) s -= 4;
          if (owner && owner.data.lastTarget === t.id) s -= 2;
          if (owner) s += dist(owner, t) * 0.5;
        }
        if (t === cur) s -= 1.5;           // stickiness
        if (s < bs) {
          if (!ally && t !== cur && !game.world.los(e.x, e.y, t.x, t.y)) continue;
          bs = s; best = t;
        }
      }
      if (best && best !== cur) game.bus.emit('ai:aggro', { ent: e, target: best });
      ai.target = best ? best.id : null;
      if (best) ai.engaged = true;
      return best;
    }

    function phasePattern(e, ai) {
      const boss = e.def && e.def.boss;
      if (!boss || !boss.phases || !boss.phases.length) return null;
      const f = e.hp / e.hpMax;
      let idx = boss.phases.length - 1;
      for (let i = 0; i < boss.phases.length; i++) if (f > (boss.phases[i].untilHp || 0)) { idx = i; break; }
      if (idx !== ai.phase) {
        ai.phase = idx; ai.patternI = 0;
        game.fx({ type: 'shockwave', x: e.x, y: e.y, r: 3, color: '#ffd24a' });
        game.bus.emit('boss:phase', { ent: e, phase: idx });
      }
      return boss.phases[idx].pattern || null;
    }
    function attackByRef(ai, ref) {
      if (typeof ref === 'number') return ai.attacks[ref] || null;
      for (const a of ai.attacks) if (a.name === ref || a.def.use === ref) return a;
      return null;
    }
    function inRange(a, d, t) {
      const r = (a.def.range != null ? a.def.range : 1) + (t ? t.radius : 0);
      return d <= r && d >= (a.def.minRange || 0);
    }
    function chooseAttack(e, ai, t, d) {
      const pat = ai.thresholds || (e.def && e.def.boss) ? phasePattern(e, ai) : null;
      if (pat && pat.length) {
        const a = attackByRef(ai, pat[ai.patternI % pat.length]);
        if (!a) { ai.patternI++; return null; }
        if (game.t >= a.cdUntil && inRange(a, d, t)) { ai.patternI++; ai.waitT = 0; return a; }
        ai.waitT += 0.1;
        if (ai.waitT > 3) { ai.patternI++; ai.waitT = 0; }
        return null;
      }
      let total = 0;
      for (const a of ai.attacks) if (game.t >= a.cdUntil && inRange(a, d, t)) total += a.def.weight != null ? a.def.weight : 1;
      if (total <= 0) return null;
      let r = rng.next() * total;
      for (const a of ai.attacks) {
        if (!(game.t >= a.cdUntil && inRange(a, d, t))) continue;
        r -= a.def.weight != null ? a.def.weight : 1;
        if (r <= 0) return a;
      }
      return null;
    }
    function bestRange(ai) {
      let r = 0;
      for (const a of ai.attacks) { const ar = a.def.range != null ? a.def.range : 1; if (ar > r) r = ar; }
      return r || 1;
    }
    function shortRange(ai) {
      let r = Infinity;
      for (const a of ai.attacks) { const ar = a.def.range != null ? a.def.range : 1; if (ar < r) r = ar; }
      return r === Infinity ? 1 : r;
    }

    function startAttack(e, ai, a, t) {
      const isEnemy = e.team === 'enemy' || e.team === 'town';
      const w = a.def.windup != null ? a.def.windup : isEnemy ? 0.45 : 0.12;
      ai.atk = a;
      ai.windT = isEnemy ? Math.max(MIN_ENEMY_WINDUP, w) : w;
      ai.windTotal = ai.windT;
      ai.aimA = t ? angleTo(e.x, e.y, t.x, t.y) : e.angle;
      ai.aimX = t ? t.x : e.x; ai.aimY = t ? t.y : e.y;
      e.angle = ai.aimA; e.dir = dirFromVec(Math.cos(ai.aimA), Math.sin(ai.aimA));
      e.vx = 0; e.vy = 0; ai.mx = 0; ai.my = 0;
      ents.setAnim(e, ANIM.CHARGE, ai.windT + 0.05);
      e.data.faceT = ai.windT;
      const use = a.def.use;
      const shape = a.def.telegraph !== undefined ? a.def.telegraph : DEFAULT_TELEGRAPH[use];
      if (shape && isEnemy) {
        const atTarget = use === 'ground_target' || a.def.atTarget;
        const r = a.def.r || (use === 'summon' ? 1 : 1.5);
        const len = use === 'dash' ? (a.def.dist || 3) : a.def.range || 3;
        ai.tele = ents.create({
          kind: 'telegraph', type: 'effect', team: e.team, owner: e.id, solid: false,
          x: atTarget ? ai.aimX : e.x, y: atTarget ? ai.aimY : e.y, angle: ai.aimA, ttl: ai.windT + 0.1,
          look: { rig: 'effect', model: 'telegraph_' + shape, color: a.def.telegraphColor || '#ff5050', r, len, w: a.def.w || (use === 'dash' ? e.radius * 2 + 0.3 : 0.8), arc: a.def.arc || 60 },
          data: { follow: atTarget ? null : e.id },
        });
      }
      game.bus.emit('ai:windup', { ent: e, attack: a.def, windup: ai.windT, telegraph: shape || 'charge' });
    }
    function fire(e, ai) {
      const a = ai.atk;
      ai.atk = null;
      removeTele(ai);
      if (!a) return;
      const p = a.params;
      p.angle = ai.aimA;
      const use = a.def.use;
      if (use === 'ground_target' || a.def.atTarget) { p.x = ai.aimX; p.y = ai.aimY; }
      if (use === 'dash' && a.def.dist == null) {
        const t = ai.target != null ? ents.get(ai.target) : null;
        p.dist = t ? Math.min(8, dist(e, t) + 1.2) : 3;
      }
      if (use === 'projectile' || use === 'multishot') p.target = { x: ai.aimX, y: ai.aimY };
      if (ai.shielded) p.mult = 0.5; else if (a.def.mult == null) p.mult = 0;
      if (e.anim === ANIM.CHARGE) { e.anim = ANIM.IDLE; e.data.animUntil = undefined; }
      game.abilities.use(use, e, p);
      a.cdUntil = game.t + (a.def.cd != null ? a.def.cd : 1.5) * (ai.shielded ? 2 : 1);
      ai.recoverT = a.def.recover != null ? a.def.recover : use === 'dash' ? 0.7 : 0.3;
      game.bus.emit('ai:attack', { ent: e, attack: a.def });
    }

    function steerTo(e, ai, tx, ty, mul = 1) {
      const dx = tx - e.x, dy = ty - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.05) { ai.mx = 0; ai.my = 0; return; }
      if (ai.path.length && ai.pathI * 2 < ai.path.length && game.t - ai.pathT < 3) {
        let wx = ai.path[ai.pathI * 2], wy = ai.path[ai.pathI * 2 + 1];
        if ((wx - e.x) * (wx - e.x) + (wy - e.y) * (wy - e.y) < 0.16) {
          ai.pathI++;
          if (ai.pathI * 2 < ai.path.length) { wx = ai.path[ai.pathI * 2]; wy = ai.path[ai.pathI * 2 + 1]; } else { wx = tx; wy = ty; }
        }
        const ddx = wx - e.x, ddy = wy - e.y, dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        ai.mx = ddx / dd * mul; ai.my = ddy / dd * mul;
        return;
      }
      ai.mx = dx / d * mul; ai.my = dy / d * mul;
      if (ai.stuckT > 0.5 && game.t - ai.pathT > 1.5) {
        ai.pathT = game.t; ai.pathI = 0; ai.stuckT = 0;
        game.world.findPath(e.x, e.y, tx, ty, ai.path, { flying: !!e.data.flying });
      }
    }
    function stopMove(ai) { ai.mx = 0; ai.my = 0; }
    function away(e, ai, t, mul) {
      const dx = e.x - t.x, dy = e.y - t.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      ai.mx = dx / d * mul; ai.my = dy / d * mul;
      if (ai.stuckT > 0.4) { ai.mx = -dy / d * ai.strafe * mul; ai.my = dx / d * ai.strafe * mul; }
    }
    function strafe(e, ai, t, mul) {
      const dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (game.t > ai.strafeT) { ai.strafeT = game.t + 1.2 + rng.next() * 1.5; if (rng.chance(0.4)) ai.strafe = -ai.strafe; }
      ai.mx = -dy / d * ai.strafe * mul; ai.my = dx / d * ai.strafe * mul;
    }
    function goHome(e, ai) {
      const d = Math.hypot(ai.home.x - e.x, ai.home.y - e.y);
      if (d < 0.8) {
        stopMove(ai);
        if (ai.returning) { ai.returning = false; if (e.team === 'enemy') e.hp = e.hpMax; }
        return true;
      }
      steerTo(e, ai, ai.home.x, ai.home.y, ai.returning ? 1.2 : 0.8);
      return false;
    }
    function wanderStep(e, ai, radius = 3, mul = 0.45) {
      if (game.t > ai.wanderT) {
        ai.wanderT = game.t + 1.5 + rng.next() * 2.5;
        if (rng.chance(0.35)) { ai.wx = e.x; ai.wy = e.y; }
        else {
          const a = rng.next() * Math.PI * 2, r = rng.next() * radius;
          const x = ai.home.x + Math.cos(a) * r, y = ai.home.y + Math.sin(a) * r;
          if (!game.world.solidAt(x, y, !!e.data.flying)) { ai.wx = x; ai.wy = y; }
        }
      }
      const dx = ai.wx - e.x, dy = ai.wy - e.y;
      if (dx * dx + dy * dy < 0.09) stopMove(ai); else steerTo(e, ai, ai.wx, ai.wy, mul);
    }
    function leashed(e, ai) {
      if (ai.leash <= 0) return false;
      const d = Math.hypot(ai.home.x - e.x, ai.home.y - e.y);
      if (d > ai.leash) { ai.target = null; ai.returning = true; }
      return ai.returning;
    }
    function maybeBlink(e, ai, t) {
      if (!ai.blinkCd || game.t < ai.blinkT || !t) return false;
      ai.blinkT = game.t + ai.blinkCd;
      const a = angleTo(t.x, t.y, e.x, e.y) + (rng.next() - 0.5) * 2.2;
      const r = 2.5 + rng.next() * 1.5;
      game.abilities.use('blink', e, { angle: angleTo(e.x, e.y, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r), dist: 3.5, invuln: 0, color: (e.look && e.look.colors && e.look.colors.accent) || '#b48cff' });
      return true;
    }
    function fight(e, ai, t, d, approachTo) {
      const a = chooseAttack(e, ai, t, d);
      if (a) { startAttack(e, ai, a, t); return true; }
      if (d > approachTo) steerTo(e, ai, t.x, t.y, 1); else stopMove(ai);
      return false;
    }

    const brains = {
      idle(e, ai) { stopMove(ai); },
      wander(e, ai) {
        if (ai.provoked) {
          const t = acquire(e, ai, Math.max(ai.aggro, 8));
          if (t) { fight(e, ai, t, dist(e, t), shortRange(ai) * 0.85); return; }
          ai.provoked = false;
        }
        wanderStep(e, ai);
      },
      chaser(e, ai) {
        if (leashed(e, ai)) { goHome(e, ai); return; }
        const t = acquire(e, ai, ai.target != null ? ai.aggro * 1.6 : ai.aggro);
        if (!t) { if (!goHome(e, ai)) return; wanderStep(e, ai, 2, 0.35); return; }
        maybeBlink(e, ai, t);
        fight(e, ai, t, dist(e, t), shortRange(ai) * 0.85);
      },
      skirmisher(e, ai) {
        if (leashed(e, ai)) { goHome(e, ai); return; }
        const t = acquire(e, ai, ai.target != null ? ai.aggro * 1.6 : ai.aggro);
        if (!t) { if (goHome(e, ai)) wanderStep(e, ai, 2, 0.35); return; }
        const d = dist(e, t);
        maybeBlink(e, ai, t);
        const a = chooseAttack(e, ai, t, d);
        if (a) { startAttack(e, ai, a, t); return; }
        const k = ai.keepRange;
        if (d < k - 0.8) away(e, ai, t, 1);
        else if (d > k + 0.8) steerTo(e, ai, t.x, t.y, 1);
        else strafe(e, ai, t, 0.7);
      },
      charger(e, ai) {
        if (leashed(e, ai)) { goHome(e, ai); return; }
        const t = acquire(e, ai, ai.target != null ? ai.aggro * 1.6 : ai.aggro);
        if (!t) { if (goHome(e, ai)) wanderStep(e, ai, 2, 0.35); return; }
        const d = dist(e, t);
        const a = chooseAttack(e, ai, t, d);
        if (a) { startAttack(e, ai, a, t); return; }
        if (d > bestRange(ai) * 0.8) steerTo(e, ai, t.x, t.y, 0.9);
        else if (d < 1.5) away(e, ai, t, 0.6);
        else strafe(e, ai, t, 0.4);
      },
      turret(e, ai) {
        stopMove(ai);
        const t = acquire(e, ai, ai.aggro);
        if (!t) return;
        e.angle = angleTo(e.x, e.y, t.x, t.y); e.dir = dirFromVec(t.x - e.x, t.y - e.y);
        const a = chooseAttack(e, ai, t, dist(e, t));
        if (a) startAttack(e, ai, a, t);
      },
      swarmer(e, ai) {
        if (leashed(e, ai)) { goHome(e, ai); return; }
        const t = acquire(e, ai, ai.target != null ? ai.aggro * 1.6 : ai.aggro);
        if (!t) { if (goHome(e, ai)) wanderStep(e, ai, 3, 0.5); return; }
        const d = dist(e, t);
        const a = chooseAttack(e, ai, t, d);
        if (a && (d < 2.8 || a.def.use !== 'melee_arc')) { startAttack(e, ai, a, t); return; }
        ai.orbitA += 0.25 * ai.strafe;
        const R = Math.max(1.4, Math.min(2.6, shortRange(ai) + 1.4));
        const ox = t.x + Math.cos(ai.orbitA) * R, oy = t.y + Math.sin(ai.orbitA) * R;
        steerTo(e, ai, ox, oy, 1);
        if (ai.swarm) {
          // light flocking: separate from same-kind neighbours
          const near = ents.inRadius(e.x, e.y, 1.2, null, scratch);
          for (const o of near) {
            if (o === e || o.kind !== e.kind) continue;
            const dx = e.x - o.x, dy = e.y - o.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
            ai.mx += dx / dd * 0.4; ai.my += dy / dd * 0.4;
          }
          const l = Math.hypot(ai.mx, ai.my);
          if (l > 1) { ai.mx /= l; ai.my /= l; }
        }
      },
      summoner(e, ai) {
        if (leashed(e, ai)) { goHome(e, ai); return; }
        const t = acquire(e, ai, ai.target != null ? ai.aggro * 1.6 : ai.aggro);
        if (!t) { if (goHome(e, ai)) wanderStep(e, ai, 2, 0.35); return; }
        const s = ai.summon;
        if (s && s.kind && game.t >= ai.summonT) {
          let alive = 0;
          for (const o of ents.all) if (!o.removed && o.alive && o.owner === e.id && o.data.summoned) alive++;
          if (alive < (s.max || 3)) {
            ai.summonT = game.t + (s.cd || 8);
            const syn = ai.summonAtk || (ai.summonAtk = { def: { use: 'summon', kind: s.kind, n: s.n || 1, max: s.max || 3, windup: s.windup || 0.7, telegraph: 'circle', r: 1.2, cd: 0, recover: 0.4, color: s.color }, params: null, cdUntil: 0, i: -1, name: 'summon' });
            syn.params = Object.assign({}, syn.def);
            startAttack(e, ai, syn, t);
            return;
          }
          ai.summonT = game.t + 1;
        }
        brains.skirmisher(e, ai);
      },
      ambusher(e, ai) {
        if (ai.hidden) {
          stopMove(ai);
          const t = acquire(e, ai, ai.aggro);
          if (!t && !ai.provoked) { ai.target = null; return; }
          ai.hidden = false;
          e.alpha = 1;
          ents.setFxTag(e, 'sleep', false);
          ents.setAnim(e, ANIM.IDLE);
          e.data.animUntil = undefined;
          game.fx({ type: 'poof', x: e.x, y: e.y, color: '#ffffff' });
          game.fx({ type: 'burst', x: e.x, y: e.y, n: 10, r: 0.8, color: '#c8a070' });
          game.bus.emit('ai:reveal', { ent: e });
          ai.recoverT = 0.35;
          return;
        }
        brains.chaser(e, ai);
      },
      flee(e, ai) {
        const t = acquire(e, ai, ai.aggro);
        if (!t) { wanderStep(e, ai, 3, 0.45); return; }
        const d = dist(e, t);
        if ((d < 1.4 || ai.stuckT > 0.8) && fight(e, ai, t, d, 0)) return;
        away(e, ai, t, 1.1);
      },
      guard(e, ai) {
        if (!game.flags.wanted) {
          ai.target = null;
          if (e.data.moveTo) return;            // Story routines drive patrols
          goHome(e, ai);
          return;
        }
        const t = acquire(e, ai, Math.max(ai.aggro, 10));
        if (!t) { if (!e.data.moveTo) goHome(e, ai); return; }
        if (e.data.moveTo && game.physics.stop) game.physics.stop(e);
        fight(e, ai, t, dist(e, t), shortRange(ai) * 0.85);
      },
      boss(e, ai) {
        const t = acquire(e, ai, Math.max(ai.aggro, 10));
        if (!t) { goHome(e, ai); return; }
        const d = dist(e, t);
        maybeBlink(e, ai, t);
        const a = chooseAttack(e, ai, t, d);
        if (a) { startAttack(e, ai, a, t); return; }
        if (ai.cfg.keepRange) {
          const k = ai.keepRange;
          if (d < k - 1) away(e, ai, t, 0.9); else if (d > k + 1) steerTo(e, ai, t.x, t.y, 1); else strafe(e, ai, t, 0.5);
        } else if (d > shortRange(ai) * 0.85) steerTo(e, ai, t.x, t.y, 1);
        else stopMove(ai);
      },
      ally_melee(e, ai) { ally(e, ai, false); },
      ally_ranged(e, ai) { ally(e, ai, true); },
      ally_tank(e, ai) { e.data.taunt = true; ally(e, ai, false); },
    };
    function ally(e, ai, ranged) {
      const owner = e.owner != null ? ents.get(e.owner) : null;
      const anchor = owner && !owner.removed ? owner : null;
      const t = acquire(e, ai, anchor && dist(e, anchor) > 8 ? 4 : 7);
      if (t && (!anchor || dist(anchor, t) < 9)) {
        const d = dist(e, t);
        const a = chooseAttack(e, ai, t, d);
        if (a) { startAttack(e, ai, a, t); return; }
        if (ranged) {
          const k = ai.keepRange;
          if (d < k - 1) away(e, ai, t, 1); else if (d > Math.min(k + 0.5, bestRange(ai))) steerTo(e, ai, t.x, t.y, 1); else strafe(e, ai, t, 0.5);
        } else if (d > shortRange(ai) * 0.8) steerTo(e, ai, t.x, t.y, 1.05);
        else stopMove(ai);
        return;
      }
      if (!anchor) { stopMove(ai); return; }
      const fa = anchor.angle + Math.PI + (ai.formation || 0);
      const fx = anchor.x + Math.cos(fa) * 1.6, fy = anchor.y + Math.sin(fa) * 1.6;
      const d = Math.hypot(fx - e.x, fy - e.y);
      if (d > 0.6) steerTo(e, ai, fx, fy, d > 4 ? 1.3 : 1); else stopMove(ai);
    }

    // ---- boss shields (12a) ----
    function bossStep(e, ai) {
      const th = ai.thresholds;
      if (!th) return;
      if (!ai.shielded && ai.shieldIdx < th.length && e.hp <= th[ai.shieldIdx] * e.hpMax + 0.5) raiseShield(e, ai);
      if (ai.shielded && !ai.asking && ai.retryT > 0 && game.t >= ai.retryT) ask(e, ai);
    }
    function raiseShield(e, ai) {
      ai.shielded = true;
      e.data.shielded = true;
      ents.setFxTag(e, 'shield', true);
      game.fx({ type: 'ring', x: e.x, y: e.y, r: 2.5, color: '#9fe6ff', dur: 0.6 });
      game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 20, color: '#9fe6ff', r: 1.5 });
      game.bus.emit('boss:shield', { ent: e, on: true, index: ai.shieldIdx });
      game.bus.emit('sfx', { id: 'boss' });
      ask(e, ai);
    }
    function ask(e, ai) {
      const gates = game.sys.gates;
      const boss = e.def.boss || {};
      const diffs = boss.shieldDifficulty;
      const difficulty = Array.isArray(diffs) ? diffs[Math.min(ai.shieldIdx, diffs.length - 1)] : diffs || boss.difficulty || 2;
      ai.retryT = 0;
      if (!gates || typeof gates.ask !== 'function') { shatter(e, ai); return; }
      ai.asking = true;
      let res;
      try { res = gates.ask({ context: 'boss_shield', difficulty, tags: boss.tags || [] }); } catch (err) { res = null; }
      Promise.resolve(res).then((r) => {
        ai.asking = false;
        if (e.removed || !e.alive || !ai.shielded) return;
        if (r && r.correct) shatter(e, ai);
        else { ai.retryT = game.t + 8; game.bus.emit('boss:shield', { ent: e, on: true, index: ai.shieldIdx, retry: true }); }
      }, () => { ai.asking = false; ai.retryT = game.t + 8; });
    }
    function shatter(e, ai) {
      ai.shielded = false;
      e.data.shielded = false;
      ents.setFxTag(e, 'shield', false);
      ai.shieldIdx++;
      const th = ai.thresholds;
      e.data.minHp = ai.shieldIdx < th.length ? Math.max(1, Math.floor(th[ai.shieldIdx] * e.hpMax)) : 0;
      interrupt(e);
      e.status.stun = 2; ents.syncFxTags(e);
      game.fx({ type: 'burst', x: e.x, y: e.y, n: 30, r: 2.5, color: '#9fe6ff' });
      game.fx({ type: 'ring', x: e.x, y: e.y, r: 3.5, color: '#ffffff', dur: 0.5 });
      game.fx({ type: 'screenFlash', color: '#9fe6ff', dur: 0.2 });
      game.camera.shake = Math.max(game.camera.shake, 0.5);
      game.bus.emit('boss:shield', { ent: e, on: false, index: ai.shieldIdx - 1 });
    }

    // ---- bus ----
    game.bus.on('hit', (ev) => {
      const t = ev.target, s = ev.source;
      if (!t.ai || !s || t.removed) return;
      if (!C().hostile(t, s) && !(t.team === 'town' && s.team === 'player')) return;
      const ai = t.ai;
      ai.provoked = true; ai.engaged = true;
      if (ai.returning) ai.returning = false;
      if (ai.target == null && validTarget(t, s)) ai.target = s.id;
    });

    const api = {
      brains,
      attach,
      interrupt,
      /** Every brain targeting `target` forgets it (stealth). */
      forgetTarget(target) {
        const all = ents.all;
        for (let i = 0; i < all.length; i++) { const e = all[i]; if (e.ai && e.ai.target === target.id) { e.ai.target = null; interrupt(e); } }
      },
      /** The entity loses and cannot acquire targets for dur seconds (smoke). */
      blind(e, dur) { if (!e.ai) return; e.ai.blindT = Math.max(e.ai.blindT, game.t + dur); e.ai.target = null; },
      /** added: register a custom brain fn(e, ai) called at 10 Hz. */
      register(name, fn) { brains[name] = fn; },
      target(e) { return e && e.ai && e.ai.target != null ? ents.get(e.ai.target) || null : null; },
    };

    api._update = (dt) => {
      const all = ents.all;
      for (let i = 0; i < all.length; i++) {
        const e = all[i];
        const ai = e.ai;
        if (!ai || e.removed || e.asleep || !e.alive) continue;
        if (ai.tele && !ai.tele.removed && ai.tele.data.follow != null) { ai.tele.x = e.x; ai.tele.y = e.y; }
        if (e.data.scripted || e.data.down || e.data.koT > 0) { if (ai.windT > 0) interrupt(e); if (!e.data.moveTo) { e.vx = 0; e.vy = 0; } continue; }
        if (ai.thresholds) bossStep(e, ai);
        if (e.data.hitStop > 0) continue;
        if (e.status.stun > 0) { e.vx = 0; e.vy = 0; continue; }
        if (ai.cfg.regen && game.t - (e.data.lastHurtT || -9) > 2 && e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + ai.cfg.regen * dt);
        if (ai.windT > 0) {
          ai.windT -= dt;
          e.vx = 0; e.vy = 0;
          if (ai.atk && ai.atk.def.track && ai.windT > ai.windTotal * 0.4) {
            const t = ai.target != null ? ents.get(ai.target) : null;
            if (t && !t.removed) {
              ai.aimA = angleTo(e.x, e.y, t.x, t.y); ai.aimX = t.x; ai.aimY = t.y; e.angle = ai.aimA;
              if (ai.tele && ai.tele.data.follow == null) { ai.tele.x = t.x; ai.tele.y = t.y; }
              if (ai.tele) ai.tele.angle = ai.aimA;
            }
          }
          if (ai.windT <= 0) fire(e, ai);
          continue;
        }
        if (ai.recoverT > 0) { ai.recoverT -= dt; if (!e.data.dashing) { e.vx = 0; e.vy = 0; } continue; }
        if (game.abilities.busy(e)) continue;
        if ((game.tick + e.id) % THINK_EVERY === 0) {
          const mx = e.x - ai.lastX, my = e.y - ai.lastY;
          const want = ai.mx * ai.mx + ai.my * ai.my > 0.01;
          if (want && mx * mx + my * my < 0.0016) ai.stuckT += THINK_EVERY * dt; else ai.stuckT = 0;
          ai.lastX = e.x; ai.lastY = e.y;
          if (ai.fleeHp > 0 && e.hp / e.hpMax < ai.fleeHp && ai.brain !== 'flee' && ai.brain !== 'boss') {
            if (game.t > ai.fleeT) ai.fleeT = game.t + 3;
          }
          const fn = ai.fleeT > game.t ? brains.flee : brains[ai.brain] || brains.chaser;
          fn(e, ai);
          if (ai.windT > 0) continue;
        }
        if (e.data.moveTo) continue;
        const sp = (e.stats.speed || 2) * ai.speedMul;
        e.vx = ai.mx * sp; e.vy = ai.my * sp;
        if (ai.mx !== 0 || ai.my !== 0) {
          const t = ai.target != null ? ents.get(ai.target) : null;
          if (t && ai.brain !== 'flee' && ai.fleeT <= game.t && angleDiff(Math.atan2(ai.my, ai.mx), angleTo(e.x, e.y, t.x, t.y)) > 2) {
            e.data.faceT = 0.12; e.angle = angleTo(e.x, e.y, t.x, t.y); e.dir = dirFromVec(t.x - e.x, t.y - e.y);
          }
        }
      }
    };

    api._hud = (hud) => {
      const p = game.player;
      let best = null, bd = 25 * 25;
      if (p) {
        const all = ents.all;
        for (let i = 0; i < all.length; i++) {
          const e = all[i];
          if (e.removed || e.asleep || !e.alive || !e.ai || !e.ai.thresholds && !(e.tags.includes('boss'))) continue;
          if (!e.ai.engaged && e.hp >= e.hpMax) continue;
          const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
          if (d < bd) { bd = d; best = e; }
        }
      }
      if (best) {
        bossHud.name = best.name; bossHud.hpFrac = Math.max(0, Math.min(1, best.hp / best.hpMax)); bossHud.shield = !!best.data.shielded;
        hud.boss = bossHud;
      } else hud.boss = null;
    };
    return api;
  },
  update(game, dt) { game.ai._update(dt); },
  hud(game, hud) { game.ai._hud(hud); },
};
