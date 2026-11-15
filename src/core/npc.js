// Story package: NPC schedules, routines, friendship, barks and the crime rule (CONTRACTS section 11).
// Authoring reference: docs/notes/story.md.
//
// - populate(zone) spawns every NPC in data.npcs whose current routine entry (by clock hour) is in the loaded
//   zone (entry.zone, else def.zone, else a zone whose def.npcs lists it) at its scheduled marker. It is
//   idempotent (an NPC already present is not spawned twice) and also runs from this system's onZoneLoad, so
//   it works whether or not world calls it.
// - When the schedule changes NPCs walk (physics.moveTo, or the built-in fallback mover while physics lacks
//   moveTo) to the new marker, or walk to an exit / their home door and vanish, or appear at an exit.
import { ANIM, DIR } from '../contracts.js';
import { dirFromVec } from './math.js';
import { hourIn } from './ops.js';

const SCHED_CHECK = 0.5;       // seconds between schedule checks
const WANTED_CLEAR = 45;       // seconds unseen by guards
const GUARD_SIGHT = 9;         // tiles
const KO_TIME = 10;            // seconds a KO'd town NPC sits out
const FLEE_TIME = 6;
const RETALIATE_TIME = 12;
const BARK_RANGE = 4;
const WALK_TIMEOUT = 40;

function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
function isHomeMarker(m) { return typeof m === 'string' && /^home/.test(m); }
const DIR_BY_NAME = { up: DIR.UP, north: DIR.UP, n: DIR.UP, right: DIR.RIGHT, east: DIR.RIGHT, e: DIR.RIGHT,
  down: DIR.DOWN, south: DIR.DOWN, s: DIR.DOWN, left: DIR.LEFT, west: DIR.LEFT, w: DIR.LEFT };
export function parseDir(d) {
  if (typeof d === 'number') return d & 3;
  if (typeof d === 'string' && d.toLowerCase() in DIR_BY_NAME) return DIR_BY_NAME[d.toLowerCase()];
  return null;
}
const DIR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

export function faceToward(e, x, y) {
  const dx = x - e.x, dy = y - e.y;
  if (dx === 0 && dy === 0) return;
  e.dir = dirFromVec(dx, dy);
  e.angle = Math.atan2(dy, dx);
}
export function faceDir(e, d) { e.dir = d; e.angle = DIR_ANGLE[d]; }
function setAnim(e, a) { if (e.anim !== a) { e.anim = a; e.animT = 0; } }
function addTag(e, t) { if (e.fxTags.indexOf(t) < 0) e.fxTags.push(t); }
function delTag(e, t) { const i = e.fxTags.indexOf(t); if (i >= 0) e.fxTags.splice(i, 1); }

export default {
  id: 'npc',
  init(game) {
    const rel = {};
    const live = [];            // NPC entities spawned by this system
    const movers = [];          // entities driven by the fallback mover
    const sched = {};           // npcId -> routine index last applied (-1 none, -2 static)
    const st = { schedT: 0, wantedT: 0, lastGuardHitT: -99, barkCd: 0, dirty: false };

    const defs = () => game.data.npcs || {};

    function routineIndex(def, h) {
      const r = def.routine;
      if (!Array.isArray(r) || !r.length) return -2;
      for (let i = 0; i < r.length; i++) if (hourIn(h, r[i].from, r[i].to)) return i;
      return -1;
    }
    function homeZoneOf(def) {
      if (def.zone) return def.zone;
      const zs = game.data.zones || {};
      for (const k in zs) if (zs[k] && Array.isArray(zs[k].npcs) && zs[k].npcs.indexOf(def.id) >= 0) return k;
      return null;
    }
    /** {zone, at, do, entry} for an index, or null when the NPC is nowhere. */
    function placeOf(def, idx) {
      if (idx === -1) return null;
      if (idx === -2) return { zone: homeZoneOf(def), at: def.at || def.marker || null, do: def.do || 'idle', entry: def };
      const en = def.routine[idx];
      return { zone: en.zone || homeZoneOf(def), at: en.at || def.at || null, do: en.do || 'idle', entry: en };
    }
    function hiddenAt(place) {
      return place.do === 'sleep' && place.entry.inside !== false && (place.entry.inside === true || isHomeMarker(place.at));
    }
    function presentHere(place) {
      return !!place && !!game.zone && place.zone === game.zone.id && !hiddenAt(place);
    }
    function liveOf(id) {
      for (let i = 0; i < live.length; i++) if (live[i].data.npcId === id && !live[i].removed) return live[i];
      return null;
    }
    function markerPos(name) { return name && game.world.marker ? game.world.marker(name) : null; }
    function exitToward(zoneId) {
      const ex = (game.zone && game.zone.def && game.zone.def.exits) || [];
      let any = null;
      for (const x of ex) {
        const p = markerPos(x.at);
        if (!p) continue;
        if (x.to === zoneId) return p;
        if (!any) any = p;
      }
      return any;
    }

    function makeInteract(def) {
      if (def.interact) return clone(def.interact);
      if (def.dialogue) return { prompt: 'Talk', range: 1.3, do: [['dialogue', def.dialogue]] };
      if (def.shop) return { prompt: 'Shop', range: 1.3, do: [['shop', def.shop]] };
      return null;
    }
    function isGuard(e) {
      const d = e.def || {};
      return d.onAttacked === 'guard' || d.guard === true || (e.tags && e.tags.indexOf('guard') >= 0);
    }

    function spawnNpc(def, x, y, place) {
      const s = def.stats || {};
      const hp = s.hp || 10;
      const e = game.ents.spawn(def.id, x, y, {
        type: 'npc', team: def.team || 'town', def, name: def.name || '', look: clone(def.look) || { rig: 'humanoid' },
        hp, hpMax: hp, stats: Object.assign({ power: 1, defense: 0, speed: 2 }, s),
        tags: Array.isArray(def.tags) ? def.tags.slice() : [], interact: makeInteract(def),
        dir: DIR.DOWN, angle: Math.PI / 2,
        data: { npcId: def.id, minHp: (def.team || 'town') === 'town' ? 1 : undefined },
      });
      if (!e) return null;
      if (e.data.minHp === undefined) delete e.data.minHp;
      e.data.npc = {
        place, mode: 'here', act: place ? place.do : 'idle', home: { x, y }, tmr: game.rng.range(2, 6),
        lookT: 0, barkT: game.rng.range(4, 15), patrolI: 0, walkT: 0, arrived: false, ko: 0, flee: 0,
        chase: 0, atkCd: 0, savedInteract: null, resume: false, target: null, onArrive: null,
      };
      live.push(e);
      return e;
    }

    // ---- movement (physics.moveTo when Sim provides it, else a straight-line fallback) ----
    function moveTo(e, x, y, opts = {}) {
      const ph = game.sys.physics;
      if (ph && typeof ph.moveTo === 'function') return ph.moveTo(e, x, y, opts);
      const sp = opts.speed || (e.stats && e.stats.speed) || 2.2;
      e.data.moveTo = { x, y, speed: opts.run ? sp * 1.7 : sp, stopAt: opts.stopAt || 0 };
      if (movers.indexOf(e) < 0) movers.push(e);
      return true;
    }
    function stop(e) {
      const ph = game.sys.physics;
      if (ph && typeof ph.stop === 'function') ph.stop(e);
      if (e.data) delete e.data.moveTo;
      const i = movers.indexOf(e);
      if (i >= 0) movers.splice(i, 1);
      if (e.anim === ANIM.WALK) setAnim(e, ANIM.IDLE);
      e.vx = 0; e.vy = 0;
    }
    function integrateMovers(dt) {
      for (let i = movers.length - 1; i >= 0; i--) {
        const e = movers[i];
        const m = e.data && e.data.moveTo;
        if (e.removed || !m) { movers.splice(i, 1); continue; }
        const dx = m.x - e.x, dy = m.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
        const stepLen = m.speed * dt;
        if (d <= Math.max(m.stopAt, 0.05) || d <= stepLen) {
          if (d > m.stopAt) { e.x = m.x - (m.stopAt ? dx / d * m.stopAt : 0); e.y = m.y - (m.stopAt ? dy / d * m.stopAt : 0); }
          movers.splice(i, 1);
          delete e.data.moveTo;
          e.vx = 0; e.vy = 0;
          setAnim(e, ANIM.IDLE);
          game.bus.emit('ent:arrived', { ent: e });
          continue;
        }
        e.vx = dx / d * m.speed; e.vy = dy / d * m.speed;
        e.x += dx / d * stepLen; e.y += dy / d * stepLen;
        e.dir = dirFromVec(dx, dy); e.angle = Math.atan2(dy, dx);
        setAnim(e, ANIM.WALK);
      }
    }

    function bubble(e, text, dur = 3) {
      if (!e || !text) return;
      const t = game.ops.text(text, {});
      game.fx({ type: 'text', style: 'bubble', x: e.x, y: e.y, z: 2, ent: e.id, text: t, dur });
      game.bus.emit('bubble', { ent: e, text: t, dur });
    }

    function walkTo(e, pos, mode, onArrive) {
      const n = e.data.npc;
      n.mode = mode; n.target = pos; n.walkT = 0; n.arrived = false; n.onArrive = onArrive || null;
      moveTo(e, pos.x, pos.y, { speed: (e.stats.speed || 2) * 0.8 });
    }
    function settle(e) {
      const n = e.data.npc;
      n.mode = 'here'; n.target = null; n.tmr = game.rng.range(1, 4);
      n.home.x = e.x; n.home.y = e.y;
      n.act = n.place ? n.place.do : 'idle';
      if (n.act === 'sleep') addTag(e, 'sleep'); else delTag(e, 'sleep');
    }
    function despawn(e) {
      stop(e);
      game.ents.remove(e);
    }

    /** Apply a schedule change for one def. */
    function transition(def, oldIdx, newIdx) {
      const oldPlace = placeOf(def, oldIdx), place = placeOf(def, newIdx);
      const e = liveOf(def.id);
      const here = presentHere(place);
      if (e) {
        const n = e.data.npc;
        n.place = place;
        if (here) {
          const p = markerPos(place.at);
          if (p) walkTo(e, p, 'walk', settle);
          else settle(e);
        } else {
          delTag(e, 'sleep');
          let p = null;
          if (place && place.zone === game.zone.id) p = markerPos(place.at);   // going home to sleep
          if (!p) p = exitToward(place ? place.zone : null);
          if (p) walkTo(e, p, 'leave', despawn);
          else despawn(e);
        }
        return;
      }
      if (!here) return;
      const dest = markerPos(place.at);
      if (!dest) { game.ops.warnOnce('npc:marker:' + def.id + ':' + place.at, 'npc: ' + def.id + ' marker "' + place.at + '" not in zone ' + game.zone.id); return; }
      let from = null;
      if (oldPlace && oldPlace.zone === game.zone.id) from = markerPos(oldPlace.at);   // waking up at home
      if (!from) from = exitToward(oldPlace ? oldPlace.zone : null);
      if (!from) { spawnNpc(def, dest.x, dest.y, place); return; }
      const ne = spawnNpc(def, from.x, from.y, place);
      if (ne) walkTo(ne, dest, 'arrive', settle);
    }

    function populate(zone) {
      const z = typeof zone === 'string' ? zone : zone && zone.id;
      if (!game.zone || (z && z !== game.zone.id)) return [];
      const h = game.clock ? game.clock.hour : 12;
      const out = [];
      const all = defs();
      for (const id in all) {
        const def = all[id];
        if (!def || typeof def !== 'object') continue;
        if (!def.id) def.id = id;
        const idx = routineIndex(def, h);
        sched[id] = idx;
        const place = placeOf(def, idx);
        if (!presentHere(place) || liveOf(id)) continue;
        let p = markerPos(place.at);
        if (!p) {
          game.ops.warnOnce('npc:marker:' + id + ':' + place.at, 'npc: ' + id + ' marker "' + place.at + '" not in zone ' + game.zone.id + ' (not spawned)');
          continue;
        }
        const e = spawnNpc(def, p.x, p.y, place);
        if (e) { settle(e); out.push(e); }
      }
      return out;
    }

    // ---- crime ----
    function setWanted(on, why) {
      on = !!on;
      if (on === !!game.flags.wanted) return;
      game.setFlag('wanted', on);
      st.wantedT = 0;
      const p = game.player;
      if (p) { if (on) addTag(p, 'wanted'); else delTag(p, 'wanted'); }
      game.bus.emit('wanted', { on });
      if (on) game.toast('The town guard is after you!', 'bad');
      else if (why === 'lost') game.toast('The guards lost track of you.', 'info');
      if (!on) {
        for (const e of live) {
          const n = e.data.npc;
          if (n.chase > 0 || isGuard(e)) { n.chase = 0; if (!e.removed && n.mode === 'here') returnToPost(e); }
        }
      }
    }
    function returnToPost(e) {
      const n = e.data.npc;
      const p = n.place ? markerPos(n.place.at) : null;
      stop(e);
      if (p) walkTo(e, p, 'walk', settle); else settle(e);
    }
    function ownerOf(src) {
      let s = src, guard = 0;
      while (s && s.type !== 'player' && s.owner != null && guard++ < 4) s = game.ents.get(s.owner) || null;
      return s;
    }
    function knockOut(e) {
      const n = e.data.npc;
      if (!n || n.ko > 0) return;
      n.ko = KO_TIME; n.chase = 0; n.flee = 0;
      stop(e);
      n.savedInteract = e.interact; e.interact = null;
      setAnim(e, ANIM.KO);
      game.fx({ type: 'burst', x: e.x, y: e.y, n: 8, color: '#ffffff', r: 0.6 });
    }
    function recover(e) {
      const n = e.data.npc;
      n.ko = 0;
      e.hp = e.hpMax; e.alive = true;
      e.interact = n.savedInteract || makeInteract(e.def || {}); n.savedInteract = null;
      setAnim(e, ANIM.IDLE);
      if (game.flags.wanted && isGuard(e)) n.chase = 1;
      else returnToPost(e);
    }
    function react(e) {
      const n = e.data.npc;
      if (!n || n.ko > 0) return;
      const how = isGuard(e) ? 'guard' : (e.def && e.def.onAttacked) || 'flee';
      if (how === 'flee') {
        n.flee = FLEE_TIME; n.chase = 0;
        const p = game.player;
        let dx = e.x - p.x, dy = e.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= d; dy /= d;
        let tx = e.x + dx * 7, ty = e.y + dy * 7;
        for (let k = 0; k < 6 && game.world.solidAt && game.world.solidAt(tx, ty); k++) {
          const a = Math.atan2(dy, dx) + (k % 2 ? 1 : -1) * (0.6 + k * 0.3);
          tx = e.x + Math.cos(a) * 6; ty = e.y + Math.sin(a) * 6;
        }
        moveTo(e, tx, ty, { run: true });
        n.mode = 'here';
        bubble(e, (e.def && e.def.fleeLine) || 'Help! Guards!', 2);
      } else {
        n.chase = how === 'guard' ? 1 : RETALIATE_TIME; n.flee = 0;
        bubble(e, (e.def && e.def.angryLine) || (how === 'guard' ? 'Halt!' : 'Hey! Cut that out!'), 2);
      }
    }

    game.bus.on('hit', (h) => {
      const t = h && h.target;
      const p = game.player;
      if (!t || !p) return;
      if (t === p) {
        const s = h.source;
        if (s && s.type === 'npc' && isGuard(s)) st.lastGuardHitT = game.t;
        return;
      }
      if (t.team !== 'town' || !t.data || !t.data.npc) return;
      if (ownerOf(h.source) !== p) return;
      game.bus.emit('crime', { victim: t });
      setWanted(true);
      if (t.hp <= (t.data.minHp || 1) || h.killed) knockOut(t);
      else react(t);
      for (const g of live) if (g !== t && isGuard(g) && g.data.npc.ko <= 0) g.data.npc.chase = 1;
    });
    game.bus.on('death', (d) => {
      const e = d && d.ent;
      if (!e || !e.data || !e.data.npc || e.team !== 'town') return;
      // Town NPCs never die: undo the death, sit out, recover.
      e.alive = true; e.hp = Math.max(1, e.hp);
      if (!e.removed) knockOut(e);
    });
    game.bus.on('player:revived', () => setWanted(false));
    game.bus.on('player:down', () => {
      if (!game.flags.wanted || game.t - st.lastGuardHitT > 1.5) return;
      const inv = game.sys.inventory;
      const gold = inv ? inv.gold || 0 : 0;
      const fine = Math.floor(gold * 0.1);
      if (fine > 0) {
        if (game.ops.has('gold')) game.ops.exec(['gold', -fine]);
        else if (inv && inv.addGold) inv.addGold(-fine);
      }
      api.arrested = true;
      game.toast(fine > 0 ? 'The guards haul you to the infirmary. Fine: ' + fine + ' gold.' : 'The guards haul you to the infirmary.', 'bad');
      game.bus.emit('arrested', { fine });
      setWanted(false);
    });
    game.bus.on('ent:arrived', (a) => { const e = a && a.ent; if (e && e.data && e.data.npc) e.data.npc.arrived = true; });
    game.bus.on('ent:removed', (a) => {
      const e = a && a.ent;
      const i = live.indexOf(e);
      if (i >= 0) live.splice(i, 1);
      const j = movers.indexOf(e);
      if (j >= 0) movers.splice(j, 1);
    });
    game.bus.on('hour', () => { st.dirty = true; });

    const api = {
      /** Live NPC entities spawned by this system (do not mutate). */
      live,
      arrested: false,
      rel(id) { return rel[id] || 0; },
      /** Copy of every friendship value {npcId: n}. */
      relAll() { return Object.assign({}, rel); },
      _setRel(obj) { for (const k in rel) delete rel[k]; for (const k in obj) rel[k] = Number(obj[k]) || 0; },
      addRel(id, n = 1) {
        const v = Math.max(-100, Math.min(100, (rel[id] || 0) + (Number(n) || 0)));
        rel[id] = v;
        game.bus.emit('rel', { npc: id, value: v, delta: n });
        return v;
      },
      populate,
      /** Spawn an NPC by id at (x, y) (used by cutscenes for spawn-on-demand). */
      spawn(id, x, y) {
        const def = defs()[id];
        if (!def) return null;
        if (!def.id) def.id = id;
        const e = spawnNpc(def, x, y, placeOf(def, routineIndex(def, game.clock ? game.clock.hour : 12)));
        if (e) { settle(e); e.data.npc.place = null; }
        return e;
      },
      moveTo, stop, bubble, isGuard,
      routineIndex, placeOf,
      /** Where an NPC is scheduled now: {zone, at, do} or null. */
      whereIs(id) {
        const def = defs()[id];
        if (!def) return null;
        return placeOf(def, routineIndex(def, game.clock ? game.clock.hour : 12));
      },
      setWanted,
      get wanted() { return !!game.flags.wanted; },
      get wantedUnseen() { return st.wantedT; },
      /** Re-check schedules now (normally every 0.5 s and on each 'hour'). */
      reschedule() { st.dirty = true; checkSchedules(); },
      _st: st,
    };

    function checkSchedules() {
      st.dirty = false;
      if (!game.zone) return;
      const h = game.clock ? game.clock.hour : 12;
      const all = defs();
      for (const id in all) {
        const def = all[id];
        if (!def || typeof def !== 'object') continue;
        if (!def.id) def.id = id;
        const idx = routineIndex(def, h);
        const old = id in sched ? sched[id] : idx;
        if (old === idx) { sched[id] = idx; continue; }
        const e = liveOf(id);
        if (e && (e.data.talking || e.data.scripted || e.data.npc.ko > 0)) continue;   // apply later
        sched[id] = idx;
        transition(def, old, idx);
      }
    }
    api._checkSchedules = checkSchedules;

    game.ops.register('rel', (g, a, ctx) => {
      let id = a[1];
      if (id && typeof id === 'object') id = id.data && id.data.npcId || id.kind;
      if (id === 'self' && ctx && ctx.self) id = ctx.self.data && ctx.self.data.npcId || ctx.self.kind;
      api.addRel(id, a.length > 2 ? a[2] : 1);
    });
    game.ops.registerCond('rel', (g, c) => {
      const v = api.rel(c[1]);
      if (c.length === 2) return v > 0;
      const op = c[2], n = c[3];
      switch (op) { case '>=': return v >= n; case '>': return v > n; case '<=': return v <= n; case '<': return v < n;
        case '==': case '=': return v === n; case '!=': return v !== n; default: return false; }
    });

    api._update = function update(dt) {
      integrateMovers(dt);
      st.schedT += dt;
      if (st.dirty || st.schedT >= SCHED_CHECK) { st.schedT = 0; checkSchedules(); }
      const p = game.player;
      if (st.barkCd > 0) st.barkCd -= dt;
      const wanted = !!game.flags.wanted;
      let seen = false;
      for (let i = 0; i < live.length; i++) {
        const e = live[i];
        if (e.removed) continue;
        const n = e.data.npc;
        if (n.atkCd > 0) n.atkCd -= dt;
        if (n.ko > 0) {
          n.ko -= dt;
          if (e.anim !== ANIM.KO) setAnim(e, ANIM.KO);
          if (n.ko <= 0) recover(e);
          continue;
        }
        if (wanted && p && isGuard(e)) {
          const dx = p.x - e.x, dy = p.y - e.y;
          if (dx * dx + dy * dy <= GUARD_SIGHT * GUARD_SIGHT && (!game.world.los || game.world.los(e.x, e.y, p.x, p.y))) {
            seen = true;
            if (n.chase <= 0) n.chase = 1;
          }
        }
        if (e.data.talking) {
          n.resume = true;
          continue;
        }
        if (e.data.scripted) continue;
        if (n.resume) {
          n.resume = false;
          if ((n.mode === 'walk' || n.mode === 'arrive' || n.mode === 'leave') && n.target) moveTo(e, n.target.x, n.target.y, { speed: (e.stats.speed || 2) * 0.8 });
        }
        // Crime reactions
        if (n.flee > 0) { n.flee -= dt; if (n.flee <= 0) returnToPost(e); continue; }
        if (n.chase > 0 && p) {
          const guard = isGuard(e);
          if (!guard) { n.chase -= dt; if (n.chase <= 0) { returnToPost(e); continue; } }
          else if (!wanted) { n.chase = 0; returnToPost(e); continue; }
          if (e.ai) continue;   // Sim's AI brain drives it (combat.hostile reads flags.wanted)
          const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
          n.tmr -= dt;
          if (n.tmr <= 0) { n.tmr = 0.4; moveTo(e, p.x, p.y, { run: true, stopAt: 0.9 }); }
          if (d2 <= 1.3 * 1.3 && n.atkCd <= 0 && game.combat && game.combat.damage) {
            n.atkCd = 1.2;
            faceToward(e, p.x, p.y);
            setAnim(e, ANIM.ATTACK);
            game.combat.damage(p, (e.stats.power || 1), { source: e, type: 'melee', angle: Math.atan2(dy, dx), knockback: 3 });
          }
          continue;
        }
        if (n.mode !== 'here') {
          n.walkT += dt;
          if (n.arrived || n.walkT > WALK_TIMEOUT) {
            if (!n.arrived && n.target) { e.x = n.target.x; e.y = n.target.y; stop(e); }
            n.arrived = false;
            const cb = n.onArrive; n.onArrive = null;
            if (cb) cb(e); else settle(e);
          }
          continue;
        }
        routine(e, n, dt);
        // ambient barks
        if (p && e.def && Array.isArray(e.def.barks) && e.def.barks.length && n.act !== 'sleep') {
          n.barkT -= dt;
          if (n.barkT <= 0) {
            const dx = p.x - e.x, dy = p.y - e.y;
            if (dx * dx + dy * dy <= BARK_RANGE * BARK_RANGE && st.barkCd <= 0 && !game.modal) {
              bubble(e, game.rng.pick(e.def.barks), 3);
              st.barkCd = 6;
              n.barkT = game.rng.range(15, 30);
            } else n.barkT = game.rng.range(1, 3);
          }
        }
      }
      if (wanted) {
        if (seen) st.wantedT = 0;
        else { st.wantedT += dt; if (st.wantedT >= WANTED_CLEAR) setWanted(false, 'lost'); }
      }
    };

    function routine(e, n, dt) {
      const en = n.place ? n.place.entry : {};
      const moving = !!(e.data.moveTo);
      switch (n.act) {
        case 'sit':
          if (!moving) { setAnim(e, ANIM.SIT); const d = parseDir(en.dir); faceDir(e, d == null ? DIR.DOWN : d); }
          break;
        case 'sleep':
          if (!moving) { setAnim(e, ANIM.SLEEP); addTag(e, 'sleep'); }
          break;
        case 'wander': {
          if (moving) break;
          n.tmr -= dt;
          if (n.tmr > 0) { setAnim(e, ANIM.IDLE); break; }
          n.tmr = game.rng.range(2.5, 6);
          const r = en.r || en.radius || 3;
          for (let k = 0; k < 4; k++) {
            const a = game.rng.range(0, Math.PI * 2), d = game.rng.range(0.5, r);
            const tx = n.home.x + Math.cos(a) * d, ty = n.home.y + Math.sin(a) * d;
            if (!game.world.solidAt || !game.world.solidAt(tx, ty)) { moveTo(e, tx, ty, { speed: (e.stats.speed || 2) * 0.6 }); break; }
          }
          break;
        }
        case 'patrol': {
          const list = en.markers || en.route || en.path;
          if (!Array.isArray(list) || !list.length) { n.act = 'wander'; break; }
          if (moving) break;
          n.tmr -= dt;
          if (n.tmr > 0) { setAnim(e, ANIM.IDLE); break; }
          n.tmr = game.rng.range(1, 2.5);
          n.patrolI = (n.patrolI + 1) % list.length;
          const p = markerPos(list[n.patrolI]);
          if (p) moveTo(e, p.x, p.y, { speed: (e.stats.speed || 2) * 0.7 });
          break;
        }
        default: {   // idle, shopkeep, guard, unknown
          if (moving) break;
          setAnim(e, ANIM.IDLE);
          n.tmr -= dt;
          if (n.lookT > 0) {
            n.lookT -= dt;
            if (n.lookT <= 0) { const d = parseDir(en.dir); faceDir(e, d == null ? DIR.DOWN : d); }
          } else if (n.tmr <= 0) {
            n.tmr = game.rng.range(4, 8);
            n.lookT = 1.2;
            faceDir(e, game.rng.pick(LOOK_DIRS));
          } else if (e.dir !== DIR.DOWN && parseDir(en.dir) == null) faceDir(e, DIR.DOWN);
        }
      }
    }
    return api;
  },
  update(game, dt) { game.npc._update(dt); },
  onZoneLoad(game, zone) { game.npc.populate(zone); },
  save(game) { return { rel: game.npc.relAll() }; },
  load(game, json) {
    if (!json || !json.rel) return;
    game.npc._setRel(json.rel);
  },
  hud(game, hud) { hud.player.wanted = !!game.flags.wanted; },
};

const LOOK_DIRS = [DIR.LEFT, DIR.RIGHT, DIR.UP];
