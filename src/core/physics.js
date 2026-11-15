// Physics (CONTRACTS 4 + 12a): velocity integration with status multipliers, circle-vs-tile collision with wall
// sliding, separation of pushable entities, knockback decay, leash circles, flyers, and the scripted mover
// (moveTo / stop with A* fallback and 'ent:arrived').
import { ANIM } from '../contracts.js';
import { dirFromVec } from './math.js';

const MOVERS = { player: 1, enemy: 1, npc: 1, companion: 1, summon: 1, pickup: 1 };
const KB_DECAY = 8;          // knockback exponential decay rate (1/s)
const SUBSTEP = 0.3;         // max tiles moved per collision sub-step
const STUCK_SNAP_T = 6;      // a scripted mover that makes no progress for this long snaps to its target

export default {
  id: 'physics',
  init(game) {
    const sepOut = [];
    let sepSelf = null;
    const sepFilter = (o) => o !== sepSelf && o.pushable && !o.removed && o.id > sepSelf.id && MOVERS[o.type] === 1 && o.type !== 'pickup';

    function blockedTile(z, grid, tx, ty) {
      if (tx < 0 || ty < 0 || tx >= z.w || ty >= z.h) return true;
      return grid[ty * z.w + tx] === 1;
    }
    /** Push a circle out of solid tiles (2 passes for corners). */
    function resolveTiles(e) {
      const z = game.zone;
      if (!z) return;
      const grid = e.data.flying ? z.wall : z.solid;
      const r = e.radius;
      for (let pass = 0; pass < 2; pass++) {
        let moved = false;
        const tx0 = Math.floor(e.x - r), tx1 = Math.floor(e.x + r);
        const ty0 = Math.floor(e.y - r), ty1 = Math.floor(e.y + r);
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            if (!blockedTile(z, grid, tx, ty)) continue;
            const cx = e.x < tx ? tx : e.x > tx + 1 ? tx + 1 : e.x;
            const cy = e.y < ty ? ty : e.y > ty + 1 ? ty + 1 : e.y;
            const dx = e.x - cx, dy = e.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            if (d2 > 1e-10) {
              const d = Math.sqrt(d2), push = r - d + 1e-4;
              e.x += dx / d * push; e.y += dy / d * push;
            } else {
              // Center inside the tile: leave through the nearest free edge.
              const l = e.x - tx, rr = tx + 1 - e.x, u = e.y - ty, dd = ty + 1 - e.y;
              let best = Infinity, bx = 0, by = 0;
              if (l < best && !blockedTile(z, grid, tx - 1, ty)) { best = l; bx = -(l + r); by = 0; }
              if (rr < best && !blockedTile(z, grid, tx + 1, ty)) { best = rr; bx = rr + r; by = 0; }
              if (u < best && !blockedTile(z, grid, tx, ty - 1)) { best = u; bx = 0; by = -(u + r); }
              if (dd < best && !blockedTile(z, grid, tx, ty + 1)) { best = dd; bx = 0; by = dd + r; }
              if (best === Infinity) continue;
              e.x += bx; e.y += by;
            }
            moved = true;
          }
        }
        if (!moved) break;
      }
    }

    function arrive(e, mt) {
      e.data.moveTo = null;
      e.vx = 0; e.vy = 0;
      if (e.anim === ANIM.WALK) { e.anim = ANIM.IDLE; e.animT = 0; }
      if (mt.face != null) { e.dir = mt.face; e.angle = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][mt.face & 3]; }
      game.bus.emit('ent:arrived', { ent: e });
      if (mt.resolve) mt.resolve(true);
    }

    function planPath(e, mt) {
      const w = game.world;
      mt.pi = 0;
      if (w.walkable && w.walkable(e.x, e.y, mt.x, mt.y, e.radius * 0.9, !!e.data.flying)) { mt.path.length = 0; return; }
      if (w.findPath) w.findPath(e.x, e.y, mt.x, mt.y, mt.path, { flying: !!e.data.flying });
    }

    function steer(e, mt, dt) {
      // integration: a data.moveTo written by someone else (Story's fallback mover, tests) lacks the
      // physics bookkeeping; leave such movers alone instead of crashing.
      if (!mt.path) { e.vx = 0; e.vy = 0; return; }
      const dxT = mt.x - e.x, dyT = mt.y - e.y;
      const distT = Math.sqrt(dxT * dxT + dyT * dyT);
      if (distT <= mt.stopAt) {
        if (mt.stopAt <= 0.15 && !game.world.solidAt(mt.x, mt.y, !!e.data.flying)) { e.x = mt.x; e.y = mt.y; }
        arrive(e, mt);
        return;
      }
      mt.t += dt;
      // Stuck detection every 0.5 s.
      if (mt.t - mt.checkT >= 0.5) {
        const mdx = e.x - mt.lastX, mdy = e.y - mt.lastY;
        if (mdx * mdx + mdy * mdy < 0.01) { mt.stuckT += mt.t - mt.checkT; planPath(e, mt); } else mt.stuckT = 0;
        mt.lastX = e.x; mt.lastY = e.y; mt.checkT = mt.t;
        if (mt.stuckT >= STUCK_SNAP_T) { e.x = mt.x; e.y = mt.y; arrive(e, mt); return; }
      }
      let tx = mt.x, ty = mt.y;
      const path = mt.path;
      while (mt.pi * 2 < path.length) {
        const wx = path[mt.pi * 2], wy = path[mt.pi * 2 + 1];
        const ddx = wx - e.x, ddy = wy - e.y;
        if (ddx * ddx + ddy * ddy < 0.09) { mt.pi++; continue; }
        // Skip ahead when the next waypoint is directly reachable.
        if ((game.tick + e.id) % 8 === 0 && (mt.pi + 1) * 2 < path.length &&
          game.world.walkable(e.x, e.y, path[mt.pi * 2 + 2], path[mt.pi * 2 + 3], e.radius * 0.9, !!e.data.flying)) { mt.pi++; continue; }
        tx = wx; ty = wy;
        break;
      }
      if (mt.pi * 2 >= path.length && path.length) { tx = mt.x; ty = mt.y; }
      const dx = tx - e.x, dy = ty - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      let sp = mt.speed;
      const remain = tx === mt.x && ty === mt.y ? distT : d;
      if (sp * dt > remain) sp = remain / dt;
      e.vx = dx / d * sp; e.vy = dy / d * sp;
      if (e.anim === ANIM.IDLE || e.anim === ANIM.WALK) { if (e.anim !== ANIM.WALK) { e.anim = ANIM.WALK; e.animT = 0; } }
    }

    const api = {
      /**
       * Scripted mover (12a). Sets ent.data.moveTo; physics steers there (A* when the straight line is blocked),
       * sets anim walk/idle and dir, and on arrival emits 'ent:arrived' {ent}. Returns a Promise<boolean>
       * (true on arrival, false when cancelled by stop() or a newer moveTo).
       * opts {speed (default stats.speed or 2.5), run (x1.6), stopAt (default 0.1), face (DIR on arrival)}
       */
      moveTo(ent, x, y, opts = {}) {
        if (!ent) return Promise.resolve(false);
        const old = ent.data.moveTo;
        if (old && old.resolve) old.resolve(false);
        let resolve;
        const promise = new Promise((r) => { resolve = r; });
        const base = opts.speed || (ent.stats && ent.stats.speed) || 2.5;
        const mt = {
          x, y, speed: base * (opts.run ? 1.6 : 1), stopAt: opts.stopAt != null ? opts.stopAt : 0.1, face: opts.face != null ? opts.face : null,
          path: old ? old.path : [], pi: 0, t: 0, checkT: 0, stuckT: 0, lastX: ent.x, lastY: ent.y, resolve, promise,
        };
        mt.path.length = 0;
        ent.data.moveTo = mt;
        planPath(ent, mt);
        return promise;
      },
      /** Cancel a scripted move. */
      stop(ent) {
        if (!ent) return;
        const mt = ent.data.moveTo;
        ent.data.moveTo = null;
        ent.vx = 0; ent.vy = 0;
        if (ent.anim === ANIM.WALK) { ent.anim = ANIM.IDLE; ent.animT = 0; }
        if (mt && mt.resolve) mt.resolve(false);
      },
      /** added: add a knockback impulse (tiles/s) along angle; honours kbImmune / kbResist. */
      push(ent, angle, force) {
        if (!ent || !force) return;
        let f = force;
        const c = game.sys.combat;
        if (c && c.mod) { if (c.mod(ent, 'kbImmune') > 0) return; f *= Math.max(0, 1 - c.mod(ent, 'kbResist')); }
        if (ent.data.kbResist) f *= Math.max(0, 1 - ent.data.kbResist);
        ent.kx += Math.cos(angle) * f; ent.ky += Math.sin(angle) * f;
      },
      /** added: move an entity instantly (no interpolation). */
      teleport(ent, x, y) {
        ent.x = ent.px = x; ent.y = ent.py = y; ent.kx = ent.ky = 0;
        game.ents.touch();
        if (ent === game.player) game.snapCamera();
      },
      /** added: push the entity out of solid tiles now. */
      resolve(ent) { resolveTiles(ent); },
    };

    api._update = (dt) => {
      const all = game.ents.all;
      const combat = game.sys.combat;
      const decay = Math.exp(-KB_DECAY * dt);
      for (let i = 0; i < all.length; i++) {
        const e = all[i];
        if (e.removed || e.asleep || MOVERS[e.type] !== 1) continue;
        const d = e.data;
        if (d.faceT > 0) d.faceT -= dt;
        if (d.noPhysics) continue;
        if (d.hitStop > 0) { d.hitStop -= dt; continue; }
        const mt = d.moveTo;
        let mul = 1;
        if (mt) steer(e, mt, dt);
        else if (!d.dashing) {
          mul = combat && combat.speedMul ? combat.speedMul(e) : 1;
          if (d.down) mul = 0;
        }
        let vx = e.vx * mul + e.kx, vy = e.vy * mul + e.ky;
        e.kx *= decay; e.ky *= decay;
        if (e.kx * e.kx + e.ky * e.ky < 0.0025) { e.kx = 0; e.ky = 0; }
        if (vx !== 0 || vy !== 0) {
          let mx = vx * dt, my = vy * dt;
          if (e.solid) {
            const n = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / SUBSTEP));
            mx /= n; my /= n;
            for (let k = 0; k < n; k++) { e.x += mx; resolveTiles(e); e.y += my; resolveTiles(e); }
          } else { e.x += mx; e.y += my; }
        }
        const lz = d.leash;
        if (lz) {
          const dx = e.x - lz.x, dy = e.y - lz.y, dd = Math.sqrt(dx * dx + dy * dy), lim = Math.max(0, lz.r - e.radius);
          if (dd > lim && dd > 0) { e.x = lz.x + dx / dd * lim; e.y = lz.y + dy / dd * lim; }
        }
        const sp2 = e.vx * e.vx + e.vy * e.vy;
        const movingIntent = sp2 * mul * mul > 0.0025;
        if (movingIntent && !(d.faceT > 0) && !d.dashing && e.type !== 'pickup') {
          e.dir = dirFromVec(e.vx, e.vy);
          e.angle = Math.atan2(e.vy, e.vx);
        }
        if ((e.anim === ANIM.IDLE || e.anim === ANIM.WALK) && e.type !== 'pickup' && d.animUntil === undefined && !d.down) {
          const want = movingIntent ? ANIM.WALK : ANIM.IDLE;
          if (e.anim !== want) { e.anim = want; e.animT = 0; }
        }
      }
      // Separation of pushable entities.
      for (let i = 0; i < all.length; i++) {
        const e = all[i];
        if (e.removed || e.asleep || !e.pushable || MOVERS[e.type] !== 1 || e.type === 'pickup' || e.data.ghost || e.data.noPhysics) continue;
        sepSelf = e;
        const list = game.ents.inRadius(e.x, e.y, e.radius + 0.7, sepFilter, sepOut);
        for (let k = 0; k < list.length; k++) {
          const o = list[k];
          if (o.data.ghost || o.data.noPhysics || !!o.data.flying !== !!e.data.flying) continue;
          if ((o.data.down && o.type !== 'player') || (e.data.down && e.type !== 'player')) continue;
          const dx = o.x - e.x, dy = o.y - e.y;
          const min = e.radius + o.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          let d = Math.sqrt(d2), nx, ny;
          if (d < 1e-6) { nx = (e.id & 1) ? 1 : -1; ny = 0; d = 0; } else { nx = dx / d; ny = dy / d; }
          const overlap = (min - d);
          const me = e.data.mass || e.radius * e.radius * (e.tags.includes('boss') ? 20 : 1);
          const mo = o.data.mass || o.radius * o.radius * (o.tags.includes('boss') ? 20 : 1);
          const fe = mo / (me + mo), fo = me / (me + mo);
          if (!(e.data.moveTo && e.type === 'npc')) { e.x -= nx * overlap * fe; e.y -= ny * overlap * fe; if (e.solid) resolveTiles(e); }
          o.x += nx * overlap * fo; o.y += ny * overlap * fo; if (o.solid) resolveTiles(o);
        }
      }
      sepSelf = null;
      game.ents.touch();
    };
    return api;
  },
  update(game, dt) { game.physics._update(dt); },
};
