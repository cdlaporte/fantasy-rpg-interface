// Ability building blocks (CONTRACTS 8): 16 parameterized blocks usable by player kits, enemies (ai `attacks`),
// companions and summons, plus per-entity cooldown bookkeeping. Every `dmg` is a coefficient x caster power.
// Blocks never mutate the params object they are given (it is often shared data).
import { ANIM } from '../contracts.js';
import { DEG, angleTo } from './math.js';

export default {
  id: 'abilities',
  init(game) {
    const ents = game.ents;
    const warned = new Set();
    const scratch = [], dashScratch = [];
    const C = () => game.combat;

    function cdRec(ent, slot) {
      const cd = ent.data.cd || (ent.data.cd = {});
      return cd[slot] || (cd[slot] = { until: 0, dur: 0 });
    }
    function kitCd(ent, slot) {
      const k = game.sys.kits;
      const ab = k && k.ability ? k.ability(ent, slot) : null;
      return ab && ab.cd ? ab.cd : 0;
    }
    function setCast(c, anim, dur) {
      if (c.type === 'effect') return;
      ents.setAnim(c, anim, dur);
      c.data.faceT = Math.max(c.data.faceT || 0, dur);
    }
    function aheadPoint(c, p, defDist) {
      if (p.x != null && p.y != null) return { x: p.x, y: p.y };
      const a = p.angle != null ? p.angle : c.angle;
      const want = p.dist != null ? p.dist : defDist;
      const free = game.world.raycast ? game.world.raycast(c.x, c.y, a, want, true) : want;
      return { x: c.x + Math.cos(a) * free, y: c.y + Math.sin(a) * free };
    }
    function landable(x, y, flying) { return !game.world.solidAt(x, y, flying); }

    const blocks = {
      /** Melee cone. {angle, arc=90, range=1, dmg=1, knockback=3, style, color, maxTargets, lunge, repeat, offset,
       *  status, crit, critChance, hitStop, deflect, element, type, fx, onHit} -> hits[] (reused array) */
      melee_arc(c, p) {
        const a = p.angle != null ? p.angle : c.angle;
        if (p.lunge) game.physics.push(c, a, p.lunge * 8);
        let hits = C().meleeArc(c, p);
        const rep = p.repeat || 1;
        for (let i = 1; i < rep; i++) {
          const o = Object.assign({}, p, { angle: a + (i % 2 ? 0.25 : -0.25), silent: true, noAnim: true });
          hits = C().meleeArc(c, o);
        }
        return hits;
      },
      /** One projectile; all combat.projectile params. -> projectile ent */
      projectile(c, p) {
        setCast(c, p.anim || ANIM.CAST, 0.2);
        game.bus.emit('sfx', { id: p.sfx || (p.type === 'magic' ? 'spell' : 'swing') });
        return C().projectile(c, p);
      },
      /** Fan / ring / parallel volley. {n=3, spread=30 (deg, total), ring:false, parallel: spacing tiles, ...projectile}
       *  -> projectile ents (new array) */
      multishot(c, p) {
        const n = p.n || 3;
        const base = p.angle != null ? p.angle : c.angle;
        const out = [];
        setCast(c, p.anim || ANIM.CAST, 0.2);
        for (let i = 0; i < n; i++) {
          let a = base, side = 0;
          if (p.ring) a = base + (i / n) * Math.PI * 2;
          else if (p.parallel) side = (i - (n - 1) / 2) * p.parallel;
          else if (n > 1) { const sp = (p.spread != null ? p.spread : 30) * DEG; a = base - sp / 2 + sp * i / (n - 1); }
          out.push(C().projectile(c, Object.assign({}, p, { angle: a, side })));
        }
        game.bus.emit('sfx', { id: p.sfx || 'swing' });
        return out;
      },
      /** Instant line. {angle, range=7, w=0.5, dmg, pierce=true (false: first target only), stopAtWall=true, color,
       *  knockback=2, status, element, onHit, anim ('cast'; a name, or false = leave the caster's animation alone)} -> hits[] */
      beam(c, p) {
        // integration: Narrative's sweeping beam {sweep (deg), dur (s), tick (s)}: one beam every `tick` seconds,
        // rotating across `sweep` degrees centred on the aim, advanced in abilities.update.
        if (p.sweep > 0 && p.dur > 0 && !p._sweepTick) {
          const a0 = p.angle != null ? p.angle : c.angle, half = (p.sweep * Math.PI / 180) / 2;
          const dirn = game.rng.chance(0.5) ? 1 : -1;
          c.data.sweep = { from: a0 - half * dirn, to: a0 + half * dirn, t: 0, dur: p.dur, tick: p.tick || 0.25, next: 0,
            p: Object.assign({}, p, { _sweepTick: true }) };
          return [];
        }
        const a = p.angle != null ? p.angle : c.angle;
        const range = p.range || 7;
        const len = p.stopAtWall === false ? range : game.world.raycast(c.x, c.y, a, range, true);
        if (p.anim !== false) setCast(c, p.anim || ANIM.CAST, 0.25);
        game.bus.emit('sfx', { id: 'spell' });
        return C().aoe(c, Object.assign({ fx: 'beam', knockback: 2, type: 'magic' }, p, {
          shape: 'line', x: c.x, y: c.y, angle: a, len, w: p.w || 0.5, maxTargets: p.pierce === false ? 1 : p.maxTargets, delay: 0,
        }));
      },
      /** Dash. {angle, dist=2.5, speed=14, invuln (s, or true = whole dash), dmg (contact, 0 = none), hitRadius=0.5,
       *  stopOnHit, maxHits, knockback=6, status, tags, exclude (entity ids not to hit), through (pass through bodies),
       *  trail=true, color, onHit, onEnd} -> true */
      dash(c, p) {
        const a = p.angle != null ? p.angle : c.angle;
        const dist = p.dist != null ? p.dist : 2.5, speed = p.speed || 14;
        const dur = dist / speed;
        if (p.invuln) C().status(c, 'invuln', p.invuln === true ? dur + 0.05 : p.invuln);
        c.data.dash = { angle: a, speed, remain: dist, t: 0, maxT: dur + 0.25, sx: c.x, sy: c.y, lx: c.x, ly: c.y, hits: [], p, stall: 0 };
        c.data.dashing = true;
        if (p.through) c.data.ghost = true;
        c.vx = Math.cos(a) * speed; c.vy = Math.sin(a) * speed;
        c.angle = a;
        ents.setAnim(c, ANIM.DASH, dur + 0.1);
        c.data.faceT = dur + 0.1;
        game.bus.emit('sfx', { id: 'dash' });
        return true;
      },
      /** Ring around the caster (or x,y). {r=2, dmg, knockback=6, pull, delay, telegraph, fx='shockwave', color, status,
       *  shake, zone} -> hits[] or the pending effect ent when delayed */
      aoe_ring(c, p) {
        setCast(c, p.anim || ANIM.CAST, 0.25);
        return C().aoe(c, Object.assign({ r: 2, knockback: 6, fx: 'shockwave' }, p));
      },
      /** Delayed strike at a point. {x,y | dist=4 ahead (angle), r=1.5, dmg, delay=0.8, telegraph='circle', meteor,
       *  fx ('meteor' when meteor), zone (lingering after impact), shake} -> pending effect ent */
      ground_target(c, p) {
        const pt = aheadPoint(c, p, 4);
        setCast(c, p.anim || ANIM.CAST, 0.3);
        return C().aoe(c, Object.assign({ r: 1.5, delay: 0.8, telegraph: 'circle', knockback: 3, fx: p.meteor ? 'meteor' : 'burst' }, p,
          { x: pt.x, y: pt.y, shape: 'circle' }));
      },
      /** Summon. {kind | def, n=1, max, key, ttl, brain='ally_melee', powerMul=0.6, hpMul=0.4, taunt, replace=true,
       *  onReplace(game, old), attacks, look, scale, dist, ...combat.summon opts}. Enemy casters spawn data enemies
       *  (owner-linked, data.summoned). -> new ents (array; empty when refused at max) */
      summon(c, p) {
        const out = [];
        const n = p.n || 1;
        const key = p.key || p.kind || (p.def && p.def.id) || 'summon';
        setCast(c, ANIM.CAST, 0.35);
        if (c.team === 'enemy' || c.type === 'enemy') {
          let alive = 0;
          for (const e of ents.all) if (!e.removed && e.alive && e.owner === c.id && e.data.summoned) alive++;
          for (let i = 0; i < n; i++) {
            if (p.max && alive >= p.max) break;
            const a = game.rng.next() * Math.PI * 2, d = p.dist || 1.2;
            let x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
            if (!landable(x, y, false)) { x = c.x; y = c.y; }
            const e = ents.spawn(p.kind, x, y, Object.assign({ owner: c.id }, p.opts || null));
            e.data.summoned = true;
            if (c.ai && c.ai.target != null && e.ai) e.ai.target = c.ai.target;
            game.fx({ type: 'pillar', x, y, r: 0.6, color: p.color || '#b48cff', dur: 0.5 });
            game.fx({ type: 'poof', x, y, color: p.color || '#b48cff' });
            out.push(e);
            alive++;
          }
          return out;
        }
        for (let i = 0; i < n; i++) {
          if (p.max) {
            const list = C().summonsOf(c, key, scratch);
            if (list.length >= p.max) {
              if (p.replace === false) break;
              let oldest = list[0];
              for (const e of list) if (e.data.summonedAt < oldest.data.summonedAt) oldest = e;
              if (p.onReplace) p.onReplace(game, oldest);
              C().expireSummon(oldest, 'replaced');
            }
          }
          out.push(C().summon(c, p.def || p.kind, Object.assign({}, p, { key, angle: p.angle != null ? p.angle + i * 0.9 : undefined })));
        }
        return out;
      },
      /** Timed self buff. {id='buff', dur=5, mods: {power, speed, dmgTaken, attackSpeed, cdr, kbImmune, ccImmune,
       *  slowImmune, critChance, kbResist, goldFind} (or those keys directly), status (id or {id,t,p}), fxTag, allies (r),
       *  fx='sparkle', color} -> the modifier record */
      buff_self(c, p) {
        const dur = p.dur != null ? p.dur : 5;
        const mods = p.mods || pickMods(p);
        const apply = (t) => {
          const m = C().addMod(t, p.id || 'buff', mods, dur);
          if (p.status) { if (typeof p.status === 'string') C().status(t, p.status, dur, p.statusPower); else C().status(t, p.status.id, p.status.t || dur, p.status.p); }
          if (p.fxTag) api.tagFor(t, p.fxTag, dur);
          return m;
        };
        const rec = apply(c);
        if (p.allies) {
          const list = ents.inRadius(c.x, c.y, p.allies, null, scratch);
          for (const t of list) if (t !== c && t.team === c.team && C().targetable(t)) apply(t);
        }
        if (p.fx !== false) game.fx(typeof p.fx === 'object' ? Object.assign({ x: c.x, y: c.y }, p.fx)
          : { type: p.fx || 'sparkle', x: c.x, y: c.y, n: 16, r: 1, color: p.color || '#ffd24a' });
        return rec;
      },
      /** Raise a guard (facing arc). {arc=120, reduce=0.85, perfect=0.25 (s window), perfectFull=true, reflect=true,
       *  stunAttacker=1, speedMul=0.6, dur=Infinity (end with abilities.unguard), color, onBlock(game, ent, ev), anim='block'}
       *  -> guard state {active, t0, blocked, blocks, perfects, ...} */
      guard(c, p) {
        const g = {
          active: true, t0: game.t, arc: p.arc != null ? p.arc : 120, reduce: p.reduce != null ? p.reduce : 0.85,
          perfect: p.perfect != null ? p.perfect : 0.25, perfectFull: p.perfectFull !== false, reflect: p.reflect !== false,
          stunAttacker: p.stunAttacker != null ? p.stunAttacker : 1, speedMul: p.speedMul != null ? p.speedMul : 0.6,
          until: p.dur != null ? game.t + p.dur : Infinity, color: p.color || '#f2c94c', onBlock: p.onBlock || null,
          blocked: 0, blocks: 0, perfects: 0,
        };
        c.data.guard = g;
        ents.setAnim(c, p.anim || ANIM.BLOCK);
        return g;
      },
      /** Heal. {n (flat) | pct (of hpMax) | coef (x power), target=caster, allies (r: also heal same-team allies), fx}
       *  -> total healed */
      heal(c, p) {
        const target = p.target || c;
        const amt = (t) => p.pct ? t.hpMax * p.pct : p.coef ? p.coef * C().powerOf(c) : p.n || 0;
        let total = C().heal(target, amt(target), { source: c });
        if (p.allies) {
          const list = ents.inRadius(target.x, target.y, p.allies, null, scratch);
          for (const t of list) if (t !== target && t.team === c.team && C().targetable(t)) total += C().heal(t, amt(t), { source: c });
          game.fx({ type: 'ring', x: target.x, y: target.y, r: p.allies, color: '#7cf07c', dur: 0.6 });
        }
        return total;
      },
      /** Lingering zone. {x,y | dist ahead | at caster, follow (true = caster), r, dur, tick, dmg, heal, status, element,
       *  smoke, caltrops, bubble, allyMod, allyStatus, push, pull, model, look, onTick} -> effect ent */
      zone(c, p) {
        let x = c.x, y = c.y;
        if (p.x != null) { x = p.x; y = p.y; } else if (p.dist) { const pt = aheadPoint(c, p, p.dist); x = pt.x; y = pt.y; }
        return C().zone(c, Object.assign({}, p, { x, y, follow: p.follow === true ? c.id : p.follow }));
      },
      /** Stealth. {dur=5, speed=0.25 (bonus while hidden), smoke (true | zone params: leaves a smoke zone), fx} -> true */
      stealth(c, p) {
        const dur = p.dur || 5;
        C().status(c, 'stealth', dur, p.speed != null ? p.speed : 0.25);
        if (p.smoke) C().zone(c, Object.assign({ r: 2, dur: 3, smoke: true, status: { slow: [0.6, 0.4] } }, typeof p.smoke === 'object' ? p.smoke : null, { x: c.x, y: c.y }));
        if (p.fx !== false) { game.fx({ type: 'smoke', x: c.x, y: c.y, r: 2, dur: 1.5 }); game.fx({ type: 'poof', x: c.x, y: c.y, color: '#6a6a8a' }); }
        return true;
      },
      /** Chain lightning. {target | x,y, range=4 (first pick and each jump), jumps=3 (targets total), dmg, falloff=0.8,
       *  color, status, element='storm', exclude (entity ids or entities never hit, e.g. the starting target), onHit,
       *  fx='bolt'} -> hits (new array) */
      chain(c, p) {
        const hits = [];
        const range = p.range || 4;
        let fromX = p.x != null ? p.x : c.x, fromY = p.y != null ? p.y : c.y;
        let t = p.target || null;
        let mult = 1;
        const total = p.jumps != null ? p.jumps : 3;
        const amount0 = (p.dmg != null ? p.dmg : 1) * C().powerOf(c);
        const color = p.color || '#ffe14d';
        const ex = p.exclude || null;
        for (let i = 0; i < total; i++) {
          if (t && ex && (ex.indexOf(t.id) >= 0 || ex.indexOf(t) >= 0)) t = null;
          if (!t || !C().targetable(t) || hits.indexOf(t) >= 0) {
            t = null;
            let bd = range * range;
            const list = ents.inRadius(fromX, fromY, range, null, scratch);
            for (const e of list) {
              if (hits.indexOf(e) >= 0 || (ex && (ex.indexOf(e.id) >= 0 || ex.indexOf(e) >= 0)) || !C().canHit(c, e)) continue;
              const d = (e.x - fromX) * (e.x - fromX) + (e.y - fromY) * (e.y - fromY);
              if (d < bd) { bd = d; t = e; }
            }
          }
          if (!t) break;
          game.fx({ type: p.fx || 'bolt', x: fromX, y: fromY, x2: t.x, y2: t.y, color });
          const dealt = C().damage(t, amount0 * mult, { source: c, type: p.type || 'magic', element: p.element || 'storm', status: p.status, knockback: p.knockback || 0, color, crit: p.crit });
          if (p.onHit) p.onHit(game, t, dealt, c, i);
          hits.push(t);
          fromX = t.x; fromY = t.y;
          mult *= p.falloff != null ? p.falloff : 0.8;
          t = null;
        }
        if (hits.length) game.bus.emit('sfx', { id: 'spell' });
        return hits;
      },
      /** Leap with a real z arc. {x,y | dist=5 ahead, dur=0.6, height=2, invuln=true, land: {r=2.5, dmg, knockback=7,
       *  fx='shockwave', status, shake=0.3, zone}, onLand(game, c)} -> true */
      leap(c, p) {
        const pt = aheadPoint(c, p, 5);
        let tx = pt.x, ty = pt.y;
        for (let i = 0; i < 20 && !landable(tx, ty, !!c.data.flying); i++) { tx += (c.x - tx) * 0.15; ty += (c.y - ty) * 0.15; }
        if (!landable(tx, ty, !!c.data.flying)) { tx = c.x; ty = c.y; }
        const dur = p.dur || 0.6;
        c.data.leap = { sx: c.x, sy: c.y, tx, ty, t: 0, dur, h: p.height || 2, p };
        c.data.noPhysics = true;
        if (p.invuln !== false) C().status(c, 'invuln', dur + 0.05);
        c.angle = angleTo(c.x, c.y, tx, ty);
        ents.setAnim(c, ANIM.DASH, dur);
        game.bus.emit('sfx', { id: 'dash' });
        return true;
      },
      /** Teleport. {angle, dist=3.5, away (reverse angle), invuln=0.2, color, fx} -> {x0, y0, x, y} | false */
      blink(c, p) {
        let a = p.angle != null ? p.angle : c.angle;
        if (p.away) a += Math.PI;
        const want = p.dist != null ? p.dist : 3.5;
        let d = game.world.raycast(c.x, c.y, a, want, true);
        let x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
        while (d > 0 && game.world.solidAt(x, y, !!c.data.flying)) { d -= 0.1; x = c.x + Math.cos(a) * d; y = c.y + Math.sin(a) * d; }
        if (d <= 0.2) return false;
        const x0 = c.x, y0 = c.y, color = p.color || '#b48cff';
        if (p.fx !== false) {
          game.fx({ type: 'afterimage', x: x0, y: y0, ent: c.id, color });
          game.fx({ type: 'poof', x: x0, y: y0, color });
          game.fx({ type: 'sparkle', x: x0, y: y0, n: 8, color, r: 0.6 });
        }
        game.physics.teleport(c, x, y);
        game.physics.resolve(c);
        if (p.fx !== false) { game.fx({ type: 'poof', x: c.x, y: c.y, color }); game.fx({ type: 'sparkle', x: c.x, y: c.y, n: 8, color, r: 0.6 }); }
        const inv = p.invuln != null ? p.invuln : 0.2;
        if (inv > 0) C().status(c, 'invuln', inv);
        game.bus.emit('sfx', { id: 'blink' });
        return { x0, y0, x: c.x, y: c.y };
      },
    };
    const MOD_KEYS = ['power', 'speed', 'dmgTaken', 'attackSpeed', 'cdr', 'kbImmune', 'ccImmune', 'slowImmune', 'critChance', 'kbResist', 'goldFind'];
    function pickMods(p) { const m = {}; for (const k of MOD_KEYS) if (p[k] != null) m[k] = p[k]; return m; }

    function endDash(c) {
      const d = c.data.dash;
      c.data.dash = null; c.data.dashing = false; c.data.ghost = false;
      c.vx = 0; c.vy = 0;
      if (c.anim === ANIM.DASH) { c.anim = ANIM.IDLE; c.animT = 0; c.data.animUntil = undefined; }
      if (d.p.trail !== false) game.fx({ type: 'trail', x: d.sx, y: d.sy, x2: c.x, y2: c.y, color: d.p.color || '#ffffff' });
      if (d.p.onEnd) d.p.onEnd(game, c, d.hits);
    }
    function updateDash(c, dt) {
      const d = c.data.dash, p = d.p;
      const mx = c.x - d.lx, my = c.y - d.ly;
      const moved = Math.sqrt(mx * mx + my * my);
      d.lx = c.x; d.ly = c.y;
      d.t += dt;
      // Hit-stop freezes the dasher in physics: that is not a stall, and it must not eat the dash's time budget.
      if (c.data.hitStop > 0) { d.stall = 0; d.maxT += dt; }
      else if (d.t > dt * 1.5) { d.remain -= moved; if (moved < d.speed * dt * 0.2) d.stall++; else d.stall = 0; }
      if (p.dmg) {
        const list = ents.inRadius(c.x, c.y, c.radius + (p.hitRadius || 0.5) + 0.5, null, dashScratch);
        for (const t of list) {
          if (d.hits.indexOf(t) >= 0 || (p.exclude && p.exclude.indexOf(t.id) >= 0) || !C().canHit(c, t)) continue;
          const dx = t.x - c.x, dy = t.y - c.y, rr = c.radius + t.radius + (p.hitRadius || 0.5) - 0.3;
          if (dx * dx + dy * dy > rr * rr) continue;
          d.hits.push(t);
          const dealt = C().damage(t, p.dmg * C().powerOf(c), { source: c, type: p.type || 'melee', knockback: p.knockback != null ? p.knockback : 6,
            kbAngle: d.angle, status: p.status, element: p.element, crit: p.crit, critChance: p.critChance, hitStop: p.hitStop, shake: p.shake, color: p.color, tags: p.tags || null });
          if (p.onHit) p.onHit(game, t, dealt, c);
          if (p.stopOnHit || (p.maxHits && d.hits.length >= p.maxHits)) { endDash(c); return; }
        }
      }
      if (d.remain <= 0 || d.t >= d.maxT || d.stall >= 2) { endDash(c); return; }
      const sp = Math.min(d.speed, d.remain / dt + 0.001);
      c.vx = Math.cos(d.angle) * sp; c.vy = Math.sin(d.angle) * sp;
    }
    function updateLeap(c, dt) {
      const L = c.data.leap;
      L.t += dt;
      const f = Math.min(1, L.t / L.dur);
      c.x = L.sx + (L.tx - L.sx) * f; c.y = L.sy + (L.ty - L.sy) * f;
      c.z = 4 * L.h * f * (1 - f) + (c.data.flying ? 0.5 : 0);
      if (f < 1) return;
      c.data.leap = null; c.data.noPhysics = false; c.z = c.data.flying ? 0.5 : 0;
      game.physics.resolve(c);
      ents.touch();
      const land = L.p.land || {};
      C().aoe(c, Object.assign({ r: 2.5, knockback: 7, fx: 'shockwave', shake: 0.3 }, land, { x: c.x, y: c.y, delay: 0 }));
      if (L.p.onLand) L.p.onLand(game, c);
    }

    const api = {
      blocks,
      /** Run a block: abilities.use(name, caster, params) -> block result (false for an unknown block). */
      use(name, caster, params) {
        const fn = blocks[name];
        if (!fn) { if (!warned.has(name)) { warned.add(name); if (typeof console !== 'undefined') console.warn('abilities.use: unknown block ' + name); } return false; }
        if (!caster || caster.removed) return false;
        return fn(caster, params || {});
      },
      /** added: register a custom block (same signature: fn(caster, params)). */
      register(name, fn) { blocks[name] = fn; },
      ready(ent, slot) { const r = ent && ent.data.cd && ent.data.cd[slot]; return !r || game.t >= r.until; },
      /** Start a cooldown. cd defaults to the active kit's ability cd; scaled by (1 - mod cdr). */
      start(ent, slot, cd) {
        if (!ent) return;
        let dur = cd != null ? cd : kitCd(ent, slot);
        const cdr = game.combat.mod ? game.combat.mod(ent, 'cdr') : 0;
        if (cdr) dur *= Math.max(0.2, 1 - cdr);
        const r = cdRec(ent, slot);
        r.dur = dur; r.until = game.t + dur;
      },
      cdFrac(ent, slot) {
        const r = ent && ent.data.cd && ent.data.cd[slot];
        if (!r || r.dur <= 0 || game.t >= r.until) return 0;
        return Math.min(1, (r.until - game.t) / r.dur);
      },
      /** added: seconds left. */
      cdLeft(ent, slot) { const r = ent && ent.data.cd && ent.data.cd[slot]; return r ? Math.max(0, r.until - game.t) : 0; },
      /** added: cut s seconds off a running cooldown. */
      reduce(ent, slot, s) { const r = ent && ent.data.cd && ent.data.cd[slot]; if (r) r.until = Math.max(game.t, r.until - s); },
      /** added: clear one slot's cooldown, or all when slot is omitted. */
      reset(ent, slot) {
        const cd = ent && ent.data.cd;
        if (!cd) return;
        if (slot) { if (cd[slot]) cd[slot].until = 0; } else for (const k in cd) cd[k].until = 0;
      },
      /** integration (Meta request): alias of reset(ent) for the focus scroll. */
      resetCooldowns(ent) { api.reset(ent); },
      /** added: lower a guard raised with the `guard` block; returns {blocked, blocks, perfects, heldT} or null. */
      unguard(ent) {
        const g = ent && ent.data.guard;
        if (!g) return null;
        ent.data.guard = null;
        g.active = false;
        if (ent.anim === ANIM.BLOCK) { ent.anim = ANIM.IDLE; ent.animT = 0; ent.data.animUntil = undefined; }
        return { blocked: g.blocked, blocks: g.blocks, perfects: g.perfects, heldT: game.t - g.t0 };
      },
      /** added: show fxTag `tag` on ent for dur seconds (no gameplay effect). */
      tagFor(ent, tag, dur) {
        const u = ent.data.fxUntil || (ent.data.fxUntil = {});
        u[tag] = Math.max(u[tag] || 0, game.t + dur);
        ents.setFxTag(ent, tag, true);
      },
      /** added: is the entity mid-dash / mid-leap? */
      busy(ent) { return !!(ent && (ent.data.dash || ent.data.leap)); },
      pickTarget,
    };

    // ---- smart targeting (round 2: auto-aimed ground abilities, aim assist) ----
    const pickScratch = [];
    const PICK_DEF = {};
    const strength = (e) => (e.tags.includes('boss') ? 2e9 : 0) + (e.tags.includes('elite') ? 1e9 : 0) + (e.hpMax || 0);
    /**
     * Best hostile target for `caster` (no allocation). o: {range=8, mode 'nearest'|'strongest'|'densest', cone (full
     * width in degrees around `angle`; omitted = all around), angle (default caster.angle), r (densest: cluster radius,
     * default 2.5), los (true: the line from the caster must be clear of walls), x, y (search center, default the
     * caster), exclude (entity to skip), out ({x, y}: filled with the target position, or the cluster centroid for
     * 'densest')}. Strongest = bosses, then elites, then the highest max hp (ties: nearest). Returns the entity or null.
     */
    function pickTarget(c, o) {
      o = o || PICK_DEF;
      if (!c) return null;
      const cx = o.x != null ? o.x : c.x, cy = o.y != null ? o.y : c.y;
      const range = o.range != null ? o.range : 8;
      const mode = o.mode || 'nearest';
      const ang = o.angle != null ? o.angle : c.angle;
      const half = o.cone > 0 && o.cone < 360 ? (o.cone * DEG) / 2 : -1;
      const list = ents.inRadius(cx, cy, range + 1.5, null, pickScratch);
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e === c || e === o.exclude || !C().canHit(c, e)) continue;
        const dx = e.x - cx, dy = e.y - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d - (e.radius || 0) > range) continue;
        if (half >= 0 && d > 0.05) {
          let da = Math.atan2(dy, dx) - ang;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) > half) continue;
        }
        if (o.los && game.world.raycast && game.world.raycast(cx, cy, Math.atan2(dy, dx), d, true) < d - (e.radius || 0) - 0.05) continue;
        list[n++] = e;
      }
      list.length = n;
      let best = null, bs = -Infinity, bd = Infinity;
      const rr = (o.r || 2.5) * (o.r || 2.5);
      for (let i = 0; i < n; i++) {
        const e = list[i];
        const dx = e.x - cx, dy = e.y - cy, d = dx * dx + dy * dy;
        let s = 0;
        if (mode === 'strongest') s = strength(e);
        else if (mode === 'densest') {
          for (let j = 0; j < n; j++) { const b = list[j]; const ex = b.x - e.x, ey = b.y - e.y; if (ex * ex + ey * ey <= rr) s += 1e6 + strength(b) * 1e-9; }
        }
        if (s > bs || (s === bs && d < bd)) { bs = s; bd = d; best = e; }
      }
      if (best && o.out) {
        if (mode === 'densest') {
          let sx = 0, sy = 0, k = 0;
          for (let j = 0; j < n; j++) { const b = list[j]; const ex = b.x - best.x, ey = b.y - best.y; if (ex * ex + ey * ey <= rr) { sx += b.x; sy += b.y; k++; } }
          o.out.x = sx / k; o.out.y = sy / k;
        } else { o.out.x = best.x; o.out.y = best.y; }
      }
      return best;
    }

    api._update = (dt) => {
      const all = ents.all;
      for (let i = 0; i < all.length; i++) {
        const c = all[i];
        if (c.removed || c.asleep) continue;
        const d = c.data;
        if (d.dash) updateDash(c, dt);
        if (d.leap) updateLeap(c, dt);
        if (d.sweep) {
          const sw = d.sweep;
          if (c.status.stun > 0 || c.data.scripted) { d.sweep = null; continue; }
          sw.t += dt;
          if (sw.t >= sw.next) {
            sw.next += sw.tick;
            sw.p.angle = sw.from + (sw.to - sw.from) * Math.min(1, sw.t / sw.dur);
            c.angle = sw.p.angle;
            api.use('beam', c, sw.p);
          }
          if (sw.t >= sw.dur) d.sweep = null;
        }
        if (d.guard && d.guard.until <= game.t) api.unguard(c);
        if (d.fxUntil) {
          for (const k in d.fxUntil) if (d.fxUntil[k] && game.t >= d.fxUntil[k]) { d.fxUntil[k] = 0; ents.setFxTag(c, k, false); }
        }
      }
    };
    return api;
  },
  update(game, dt) { game.abilities._update(dt); },
};
