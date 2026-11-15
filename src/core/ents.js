// STUB: replaced by the Sim package
// Minimal entity store: brute-force queries, deferred removal, activation bubble.
import { ANIM, DIR } from '../contracts.js';

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

export default {
  id: 'ents',
  init(game) {
    let nextId = 1;
    const byId = new Map();
    const pending = [];
    const api = {
      all: [],
      create(fields = {}) {
        const e = Object.assign(entityDefaults(), fields);
        e.id = nextId++;
        e.px = e.x; e.py = e.y;
        api.all.push(e);
        byId.set(e.id, e);
        game.bus.emit('ent:spawned', { ent: e });
        return e;
      },
      spawn(kindId, x, y, opts = {}) {
        const d = game.data;
        const def = (d.enemies && d.enemies[kindId]) || (d.npcs && d.npcs[kindId]) || null;
        const s = (def && def.stats) || {};
        const type = def && d.enemies && d.enemies[kindId] ? 'enemy' : def ? 'npc' : 'effect';
        return api.create(Object.assign({
          kind: kindId, type, team: type === 'enemy' ? 'enemy' : type === 'npc' ? 'town' : 'neutral', def,
          name: (def && def.name) || '', x, y, look: def ? def.look : null,
          radius: s.radius || 0.35, hp: s.hp || 1, hpMax: s.hp || 1, level: (def && def.level) || 1,
          tags: def && def.tags ? def.tags.slice() : [], stats: Object.assign({}, s),
        }, opts));
      },
      remove(e) {
        if (!e || e.removed) return;
        e.removed = true;
        pending.push(e);
      },
      flush() {
        if (!pending.length) return;
        for (const e of pending) {
          byId.delete(e.id);
          const i = api.all.indexOf(e);
          if (i >= 0) api.all.splice(i, 1);
          game.bus.emit('ent:removed', { ent: e });
        }
        pending.length = 0;
      },
      get(id) { return byId.get(id); },
      forType(type, fn) { for (const e of api.all) if (e.type === type && !e.removed) fn(e); },
      withTag(tag) { return api.all.filter((e) => !e.removed && e.tags.includes(tag)); },
      inRadius(x, y, r, filterFn, out = []) {
        out.length = 0;
        for (const e of api.all) {
          if (e.asleep || e.removed) continue;
          const dx = e.x - x, dy = e.y - y;
          if (dx * dx + dy * dy <= r * r && (!filterFn || filterFn(e))) out.push(e);
        }
        return out;
      },
      nearest(x, y, maxR, filterFn) {
        let best = null, bd = maxR * maxR;
        for (const e of api.all) {
          if (e.asleep || e.removed) continue;
          const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
          if (d <= bd && (!filterFn || filterFn(e))) { bd = d; best = e; }
        }
        return best;
      },
    };
    return api;
  },
  update(game, dt) {
    const ents = game.ents;
    const p = game.player;
    const R = game.config.activationRadius;
    for (const e of ents.all) {
      e.animT += dt;
      if (e.ttl !== Infinity) { e.ttl -= dt; if (e.ttl <= 0) ents.remove(e); }
      if (p && e !== p) { const dx = e.x - p.x, dy = e.y - p.y; e.asleep = dx * dx + dy * dy > R * R; }
    }
    ents.flush();
  },
  onZoneUnload(game) {
    for (const e of game.ents.all) if (e.type !== 'player' && e.type !== 'companion') game.ents.remove(e);
    game.ents.flush();
  },
};
