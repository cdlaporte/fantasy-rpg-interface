// Entity store (CONTRACTS section 4): one flat array ordered by id, a spatial hash with 4-tile cells, deferred
// removal (flush), ttl / animT / flash bookkeeping, the activation bubble, caps, spawning from data, and the
// minimap blips HUD hook. Runs under Node; no allocation in per-step paths after warm-up.
import { ANIM, DIR, EFFECT_MODELS, FX_TAGS } from '../contracts.js';

const CELL = 4;          // spatial hash cell size, tiles
const PAD = 1;           // query padding: entities may have moved since the hash was built
const MAX_BLIPS = 96;
const EFFECT_SET = new Set(EFFECT_MODELS);
const FX_TAG_SET = new Set(FX_TAGS);

/** Fresh entity with every contract field (plus `removed`). */
export function entityDefaults() {
  return {
    id: 0, kind: '', type: 'effect', team: 'neutral', def: null, name: '',
    x: 0, y: 0, px: 0, py: 0, z: 0, vx: 0, vy: 0, kx: 0, ky: 0,
    radius: 0.3, solid: true, pushable: false, dir: DIR.DOWN, angle: Math.PI / 2,
    look: null, lookRev: 0, anim: ANIM.IDLE, animT: 0, scale: 1, alpha: 1, flash: 0, tint: null, glow: null,
    fxTags: [], hp: 1, hpMax: 1, alive: true, stats: {}, status: {}, statusPower: {}, tags: [],
    ai: null, interact: null, owner: null, ttl: Infinity, level: 1, asleep: false, removed: false, data: {},
  };
}

/** Deep clone of plain JSON-like data (objects, arrays, primitives). */
export function clone(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) { const a = new Array(v.length); for (let i = 0; i < v.length; i++) a[i] = clone(v[i]); return a; }
  const o = {};
  for (const k in v) o[k] = clone(v[k]);
  return o;
}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Merge `patch` into `dst` in place, recursing into plain objects; other values (incl. null, arrays) replace. */
export function deepMerge(dst, patch) {
  if (!isPlain(patch)) return dst;
  for (const k in patch) {
    const v = patch[k];
    if (v === undefined) continue;
    if (isPlain(v) && isPlain(dst[k])) deepMerge(dst[k], v);
    else dst[k] = clone(v);
  }
  return dst;
}

/** Enemy level scaling (CLASSES balance sheet): used when a spawn overrides the def's level. */
const hpCurve = (l) => 6 * Math.pow(Math.max(1, l), 1.4);
const dmgCurve = (l) => 2 + 1.5 * Math.max(1, l);
const xpCurve = (l) => 5 + 3 * Math.max(1, l);

export default {
  id: 'ents',
  init(game) {
    let nextId = 1;
    const byId = new Map();
    const pending = [];
    const warned = new Set();

    // ---- spatial hash ----
    let gw = 1, gh = 1;
    let cells = [[]];
    const used = [];           // indexes of non-empty cells
    let dirty = true;
    let hashTick = -1;

    function resizeHash() {
      const z = game.zone;
      const w = z ? z.w : 64, h = z ? z.h : 64;
      gw = Math.max(1, Math.ceil(w / CELL)); gh = Math.max(1, Math.ceil(h / CELL));
      cells = new Array(gw * gh);
      for (let i = 0; i < cells.length; i++) cells[i] = [];
      used.length = 0;
      dirty = true;
    }
    function cellOf(x, y) {
      let cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      if (cx < 0) cx = 0; else if (cx >= gw) cx = gw - 1;
      if (cy < 0) cy = 0; else if (cy >= gh) cy = gh - 1;
      return cy * gw + cx;
    }
    function rebuild() {
      for (let i = 0; i < used.length; i++) cells[used[i]].length = 0;
      used.length = 0;
      const all = api.all;
      for (let i = 0; i < all.length; i++) {
        const e = all[i];
        if (e.asleep || e.removed) continue;
        const c = cellOf(e.x, e.y);
        const cell = cells[c];
        if (cell.length === 0) used.push(c);
        cell.push(e);
      }
      dirty = false;
      hashTick = game.tick;
    }
    function ensure() { if (dirty || hashTick !== game.tick) rebuild(); }


    const api = {
      all: [],
      /** Caps (CONTRACTS 4). Read from config; tests or debug may override fields here. */
      caps: Object.assign({}, game.config.caps),

      create(fields = {}) {
        const e = entityDefaults();
        for (const k in fields) if (fields[k] !== undefined) e[k] = fields[k];
        e.id = nextId++;
        e.px = e.x; e.py = e.y;
        e.removed = false;
        api.all.push(e);
        byId.set(e.id, e);
        dirty = true;
        game.bus.emit('ent:spawned', { ent: e });
        return e;
      },

      /**
       * Spawn from data: enemies, npcs, or an effect model id ('stick', 'chest', 'portal', ...).
       * opts: any entity field overrides, plus level (rescales stats), sid|id (string id -> data.sid), tag|tags (added),
       * look (patch merged into the def look), stats (merged), data (merged), ai (merged over def.ai),
       * noAi (no brain attached).
       */
      spawn(kindId, x, y, opts = {}) {
        const d = game.data;
        const enemyDef = d.enemies && d.enemies[kindId];
        const npcDef = !enemyDef && d.npcs && d.npcs[kindId];
        const def = enemyDef || npcDef || null;
        let fields;
        if (def) {
          const s = def.stats || {};
          const lvl0 = def.level || 1;
          const lvl = opts.level || lvl0;
          let hp = s.hp || (enemyDef ? 6 : 30), power = s.power != null ? s.power : 1, xp = s.xp || 0;
          if (lvl !== lvl0 && enemyDef) {
            hp = Math.max(1, Math.round(hp * hpCurve(lvl) / hpCurve(lvl0)));
            power = power * dmgCurve(lvl) / dmgCurve(lvl0);
            xp = Math.round(xp * xpCurve(lvl) / xpCurve(lvl0));
          }
          const stats = Object.assign({}, s, { hp, power, defense: s.defense || 0, speed: s.speed != null ? s.speed : 2.2, xp });
          const flying = !!def.flying;
          fields = {
            kind: kindId, def, type: enemyDef ? 'enemy' : 'npc',
            team: def.team || (enemyDef ? 'enemy' : 'town'),
            name: def.name || '', x, y, z: flying ? 0.5 : 0,
            look: clone(def.look || { rig: 'humanoid' }),
            radius: s.radius || (enemyDef ? 0.35 : 0.32), solid: true, pushable: !def.immovable,
            hp, hpMax: hp, level: lvl, tags: def.tags ? def.tags.slice() : [], stats,
            data: { flying, home: { x, y } },
          };
        } else if (EFFECT_SET.has(kindId)) {
          fields = { kind: kindId, type: 'effect', team: 'neutral', x, y, solid: false, pushable: false,
            look: { rig: 'effect', model: kindId }, radius: 0.4, data: {} };
        } else {
          if (!warned.has(kindId)) { warned.add(kindId); if (typeof console !== 'undefined') console.warn('ents.spawn: unknown kind ' + kindId); }
          fields = { kind: kindId, type: 'effect', team: 'neutral', x, y, solid: false, look: { rig: 'effect', model: 'decoy_puff' }, data: {} };
        }
        for (const k in opts) {
          const v = opts[k];
          if (v === undefined) continue;
          switch (k) {
            case 'level': case 'n': case 'spread': case 'noAi': case 'ai': case 'poof': break;
            case 'id': case 'sid': fields.data.sid = v; break;
            case 'tag': fields.tags = (fields.tags || []).concat(v); break;
            case 'tags': fields.tags = (fields.tags || []).concat(v); break;
            case 'look': if (typeof v === 'object' && v) fields.look = deepMerge(fields.look || {}, v); break;
            case 'stats': fields.stats = Object.assign(fields.stats || {}, v); break;
            case 'data': Object.assign(fields.data, v); break;
            default: fields[k] = v;
          }
        }
        if (fields.hp !== undefined && opts.hpMax === undefined && opts.hp !== undefined) fields.hpMax = Math.max(fields.hpMax || 0, opts.hp);
        const e = api.create(fields);
        if (def && !opts.noAi) {
          const aiDef = opts.ai ? Object.assign({}, def.ai, opts.ai) : def.ai;
          const brainy = aiDef || (npcDef && npcDef.onAttacked === 'guard' ? { brain: 'guard' } : null);
          if (brainy && game.sys.ai && game.sys.ai.attach) game.sys.ai.attach(e, brainy);
        }
        return e;
      },

      /** Deferred removal (end of step, or flush()). Emits 'ent:removed' on flush. */
      remove(e) {
        if (!e || e.removed) return;
        e.removed = true;
        e.alive = e.type === 'player' ? e.alive : false;
        pending.push(e);
        dirty = true;
      },
      flush() {
        if (!pending.length) return;
        for (let i = 0; i < pending.length; i++) byId.delete(pending[i].id);
        const all = api.all;
        let j = 0;
        for (let i = 0; i < all.length; i++) { const e = all[i]; if (!e.removed) all[j++] = e; }
        all.length = j;
        // Emit after compaction; listeners may spawn (onDeath) safely.
        const n = pending.length;
        for (let i = 0; i < n; i++) game.bus.emit('ent:removed', { ent: pending[i] });
        pending.splice(0, n);
        dirty = true;
      },
      get(id) { return id == null ? undefined : byId.get(id); },
      forType(type, fn) { const all = api.all; for (let i = 0; i < all.length; i++) { const e = all[i]; if (e.type === type && !e.removed) fn(e); } },
      withTag(tag, out = []) {
        out.length = 0;
        const all = api.all;
        for (let i = 0; i < all.length; i++) { const e = all[i]; if (!e.removed && e.tags.includes(tag)) out.push(e); }
        return out;
      },
      /**
       * added: resolve a "who" string: 'player', '@tag' (first with tag), a number (entity id),
       * or a string matching data.sid, then kind. Returns the first match or null.
       */
      find(who) {
        if (who == null) return null;
        if (typeof who === 'object') return who;
        if (typeof who === 'number') return byId.get(who) || null;
        if (who === 'player') return game.player;
        const all = api.all;
        if (who[0] === '@') { const t = who.slice(1); for (const e of all) if (!e.removed && e.tags.includes(t)) return e; return null; }
        for (const e of all) if (!e.removed && e.data.sid === who) return e;
        for (const e of all) if (!e.removed && e.kind === who) return e;
        return null;
      },
      /** added: every match of who (tag with or without '@', sid, kind, numeric id). */
      findAll(who, out = []) {
        out.length = 0;
        if (who == null) return out;
        if (typeof who === 'number') { const e = byId.get(who); if (e) out.push(e); return out; }
        if (typeof who === 'object') { if (who.tag) return api.findAll('@' + who.tag, out); if (who.id) return api.findAll(who.id, out); out.push(who); return out; }
        if (who === 'player') { out.push(game.player); return out; }
        const tag = who[0] === '@' ? who.slice(1) : who;
        for (const e of api.all) {
          if (e.removed || e === game.player) continue;
          if (e.tags.includes(tag) || e.data.sid === tag || e.kind === tag) out.push(e);
        }
        return out;
      },
      /** Awake entities whose center is within r of (x, y). Spatial hash; `out` is reused. */
      inRadius(x, y, r, filterFn, out = []) {
        out.length = 0;
        ensure();
        const rr = r * r, q = r + PAD;
        let cx0 = Math.floor((x - q) / CELL), cx1 = Math.floor((x + q) / CELL);
        let cy0 = Math.floor((y - q) / CELL), cy1 = Math.floor((y + q) / CELL);
        if (cx0 < 0) cx0 = 0; if (cy0 < 0) cy0 = 0; if (cx1 >= gw) cx1 = gw - 1; if (cy1 >= gh) cy1 = gh - 1;
        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const cell = cells[cy * gw + cx];
            for (let i = 0; i < cell.length; i++) {
              const e = cell[i];
              if (e.removed || e.asleep) continue;
              const dx = e.x - x, dy = e.y - y;
              if (dx * dx + dy * dy <= rr && (!filterFn || filterFn(e))) out.push(e);
            }
          }
        }
        return out;
      },
      nearest(x, y, maxR, filterFn) {
        ensure();
        let best = null, bd = maxR * maxR;
        const q = maxR + PAD;
        let cx0 = Math.floor((x - q) / CELL), cx1 = Math.floor((x + q) / CELL);
        let cy0 = Math.floor((y - q) / CELL), cy1 = Math.floor((y + q) / CELL);
        if (cx0 < 0) cx0 = 0; if (cy0 < 0) cy0 = 0; if (cx1 >= gw) cx1 = gw - 1; if (cy1 >= gh) cy1 = gh - 1;
        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const cell = cells[cy * gw + cx];
            for (let i = 0; i < cell.length; i++) {
              const e = cell[i];
              if (e.removed || e.asleep) continue;
              const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
              if (d <= bd && (!filterFn || filterFn(e))) { bd = d; best = e; }
            }
          }
        }
        return best;
      },
      /** added: mark the hash stale (after teleports / blinks within a step). */
      touch() { dirty = true; },
      /** added: set an animation; after `dur` seconds (default: until changed) it reverts to idle. */
      setAnim(e, anim, dur = Infinity) {
        if (e.anim !== anim) e.animT = 0;
        e.anim = anim;
        e.data.animUntil = dur === Infinity ? Infinity : game.t + dur;
      },
      /** added: count of awake entities of a type (used for caps). */
      countAwake(type) {
        let n = 0;
        const all = api.all;
        for (let i = 0; i < all.length; i++) { const e = all[i]; if (e.type === type && !e.asleep && !e.removed) n++; }
        return n;
      },
      /** added: rebuild fxTags in place from ent.data.fxOn (manual tags) and active statuses with an fxTag name. */
      syncFxTags(e) {
        const tags = e.fxTags;
        tags.length = 0;
        const on = e.data.fxOn;
        if (on) for (const k in on) if (on[k]) tags.push(k);
        const st = e.status;
        for (const k in st) if (st[k] > 0 && FX_TAG_SET.has(k) && !(on && on[k])) tags.push(k);
      },
      /** added: turn a manual fxTag on/off (kits: 'charge', 'rune_fire', 'frenzy', ...). */
      setFxTag(e, tag, on) {
        const m = e.data.fxOn || (e.data.fxOn = {});
        if (!!m[tag] === !!on) return;
        m[tag] = !!on;
        api.syncFxTags(e);
      },
      _resizeHash: resizeHash,
    };
    resizeHash();
    game.bus.on('zone:load', () => resizeHash());
    return api;
  },

  update(game, dt) {
    const ents = game.ents;
    const p = game.player;
    const R = game.config.activationRadius;
    const R2 = R * R;
    const all = ents.all;
    const t = game.t;
    let awakeEnemies = 0, awakeNpcs = 0;
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      if (e.removed) continue;
      if (e.data.anchor) { e.asleep = true; continue; }
      if (p && e !== p && e.type !== 'companion' && !e.data.alwaysAwake) {
        const dx = e.x - p.x, dy = e.y - p.y;
        e.asleep = dx * dx + dy * dy > R2;
      }
      if (e.asleep) continue;
      e.animT += dt;
      if (e.flash > 0) { e.flash -= dt * 5; if (e.flash < 0) e.flash = 0; }
      if (e.data.animUntil !== undefined && t >= e.data.animUntil) {
        e.data.animUntil = undefined;
        if (e.anim !== ANIM.KO || e.hp > 0) { e.anim = ANIM.IDLE; e.animT = 0; }
      }
      if (e.ttl !== Infinity) { e.ttl -= dt; if (e.ttl <= 0) ents.remove(e); }
      if (e.type === 'enemy') awakeEnemies++;
      else if (e.type === 'npc') awakeNpcs++;
    }
    if (p) {
      if (awakeEnemies > ents.caps.enemies) capType(game, 'enemy', awakeEnemies - ents.caps.enemies);
      if (awakeNpcs > ents.caps.npcs) capType(game, 'npc', awakeNpcs - ents.caps.npcs);
    }
    ents.flush();
  },

  onZoneUnload(game) {
    for (const e of game.ents.all) if (e.type !== 'player' && e.type !== 'companion') game.ents.remove(e);
    game.ents.flush();
  },

  hud(game, hud) {
    const mm = hud.minimap;
    const p = game.player;
    if (p) { mm.px = p.x; mm.py = p.y; }
    const blips = mm.blips;
    let pool = blipPools.get(hud);
    if (!pool) { pool = []; blipPools.set(hud, pool); }
    let n = 0;
    const all = game.ents.all;
    for (let i = 0; i < all.length && n < MAX_BLIPS; i++) {
      const e = all[i];
      if (e.removed || (e.asleep && !e.data.anchor)) continue;
      if (e.type === 'enemy') { if (e.alive) n = putBlip(pool, blips, n, e.x, e.y, e.tags.includes('boss') ? 'boss' : 'enemy'); }
      else if (e.type === 'npc') n = putBlip(pool, blips, n, e.x, e.y, e.def && e.def.shop ? 'shop' : 'npc');
      else if (e.type === 'companion') n = putBlip(pool, blips, n, e.x, e.y, 'companion');
      else if (e.data.chest && e.interact) n = putBlip(pool, blips, n, e.x, e.y, 'chest');
      else if (e.data.shop && e.data.anchor) n = putBlip(pool, blips, n, e.x, e.y, 'shop');
    }
    const ex = game.zone && game.zone.exitRects;
    if (ex) for (let i = 0; i < ex.length && n < MAX_BLIPS; i++) n = putBlip(pool, blips, n, ex[i].x + ex[i].w / 2, ex[i].y + ex[i].h / 2, 'exit');
    mm.blipCount = n;
    // Keep any array slots beyond n untouched (Story appends quest blips after us and bumps blipCount).
  },
};

const blipPools = new WeakMap();
function putBlip(pool, blips, n, x, y, type) {
  if (n >= MAX_BLIPS) return n;
  let b = pool[n];
  if (!b) { b = { x: 0, y: 0, type: 'enemy' }; pool[n] = b; }
  b.x = x; b.y = y; b.type = type;
  blips[n] = b;
  return n + 1;
}

// Put the `extra` farthest awake entities of `type` to sleep this step (caps).
const capScratch = [];
function capType(game, type, extra) {
  const p = game.player;
  capScratch.length = 0;
  const all = game.ents.all;
  for (let i = 0; i < all.length; i++) {
    const e = all[i];
    if (e.type === type && !e.asleep && !e.removed && !e.tags.includes('boss')) capScratch.push(e);
  }
  for (let k = 0; k < extra && capScratch.length; k++) {
    let bi = 0, bd = -1;
    for (let i = 0; i < capScratch.length; i++) {
      const e = capScratch[i];
      const dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
      if (d > bd) { bd = d; bi = i; }
    }
    capScratch[bi].asleep = true;
    capScratch[bi] = capScratch[capScratch.length - 1];
    capScratch.length--;
  }
}
