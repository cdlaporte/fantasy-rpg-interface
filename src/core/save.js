// Meta package. save (CONTRACTS 12): localStorage through platform/storage.js (in-memory under Node),
// key `flinkerton.v1.<name>`, JSON {v: 1, name, zone, x, y, flags, systems: {systemId: json}, meta}.
// Autosave on zone load, level-up, quest step / quest done and every config.autosaveSeconds (deferred while a
// cutscene, transition, question or player-down is in progress). The title screen can list saves without a game
// through the exported listSaves(storage) / loadSave(storage, name).

export const SAVE_VERSION = 1;
const DEFAULT_PREFIX = 'flinkerton.v1.';

/**
 * Migration hook: MIGRATIONS[v] upgrades a save of version v to v + 1. Add entries when SAVE_VERSION grows.
 * A save with no `v` is treated as version 0 (pre-release shape: same fields).
 */
export const MIGRATIONS = {
  0: (s) => Object.assign({}, s, { v: 1, flags: s.flags || {}, systems: s.systems || {} }),
};

/** Upgrade a save object to SAVE_VERSION. Returns null if it cannot be used. */
export function migrate(json) {
  if (!json || typeof json !== 'object') return null;
  let s = json;
  let v = typeof s.v === 'number' ? s.v : 0;
  let guard = 0;
  while (v < SAVE_VERSION && guard++ < 32) {
    const fn = MIGRATIONS[v];
    if (!fn) return null;
    s = fn(s);
    v = typeof s.v === 'number' ? s.v : v + 1;
  }
  if (v > SAVE_VERSION) return null;   // from a newer build
  if (!s.zone || !s.systems || typeof s.systems !== 'object') return null;
  if (!s.flags || typeof s.flags !== 'object') s.flags = {};
  return s;
}

/** Names that have a save (for the title screen). Sorted by most recent `meta.savedAt` first when present. */
export function listSaves(storage, prefix = DEFAULT_PREFIX) {
  if (!storage || !storage.keys) return [];
  const out = [];
  for (const k of storage.keys(prefix)) {
    const name = k.slice(prefix.length);
    if (!name) continue;
    const j = storage.getJSON ? storage.getJSON(k) : null;
    out.push({ name, at: (j && j.meta && j.meta.savedAt) || 0 });
  }
  out.sort((a, b) => b.at - a.at || (a.name < b.name ? -1 : 1));
  return out.map((o) => o.name);
}

/** Saved summaries for the title screen: [{name, level, classId, zone, zoneName}] */
export function saveSummaries(storage, prefix = DEFAULT_PREFIX) {
  return listSaves(storage, prefix).map((name) => {
    const j = loadSave(storage, name, prefix);
    const m = (j && j.meta) || {};
    return { name, level: m.level || 1, classId: m.classId || null, zone: j ? j.zone : null, zoneName: m.zoneName || '' };
  });
}

/** Read + migrate one save without a game. */
export function loadSave(storage, name, prefix = DEFAULT_PREFIX) {
  if (!storage || !name) return null;
  let raw = null;
  try { raw = storage.get(prefix + name); } catch { raw = null; }
  if (raw == null) return null;
  let j;
  try { j = JSON.parse(raw); } catch { return null; }
  return migrate(j);
}

export default {
  id: 'save',
  always: true,
  init(game) {
    const prefix = () => game.config.saveKeyPrefix || DEFAULT_PREFIX;
    const key = (name) => prefix() + (name || game.name);
    let timer = 0;
    let wanted = false;     // an autosave was requested and is waiting for a calm moment

    function snapshot() {
      const p = game.player;
      const prog = game.sys.progression || {};
      return {
        v: SAVE_VERSION,
        name: game.name,
        zone: game.zone && game.zone.id,
        x: p ? Math.round(p.x * 100) / 100 : 0,
        y: p ? Math.round(p.y * 100) / 100 : 0,
        flags: JSON.parse(JSON.stringify(game.flags || {})),
        systems: JSON.parse(JSON.stringify(game.saveSystems())),
        meta: {
          savedAt: game.t, tick: game.tick, level: prog.level || 1, classId: prog.classId || null,
          specId: prog.specId || null, zoneName: (game.zone && game.zone.name) || '',
        },
      };
    }

    function calm() {
      if (!game.zone || !game.player) return false;
      const cs = game.sys.cutscene;
      if (cs && cs.active) return false;
      if (game.freeze.has('transition') || game.freeze.has('question')) return false;
      const prog = game.sys.progression;
      if (prog && prog.downed) return false;
      if (game.player.hp <= 0) return false;
      return true;
    }

    const api = {
      version: SAVE_VERSION,
      autosave: true,
      /** Write now. Returns the saved JSON. */
      now(name) {
        const json = snapshot();
        if (name) json.name = name;
        game.storage.set(key(json.name), JSON.stringify(json));
        timer = 0;
        wanted = false;
        game.bus.emit('save', {});
        return json;
      },
      load(name) { return loadSave(game.storage, name || game.name, prefix()); },
      exists(name) { return game.storage.get(key(name)) != null; },
      clear(name) { game.storage.remove(key(name)); },
      list() { return listSaves(game.storage, prefix()); },
      summaries() { return saveSummaries(game.storage, prefix()); },
      migrate,
      /** Restore a save into the running game (debug load / continue without reboot). */
      restore(json) {
        const s = migrate(json);
        if (!s) return false;
        if (game.modal) game.closeModal(undefined);
        game.flags = Object.assign({}, s.flags);
        game.loadSystems(s.systems);
        const zones = game.data.zones || {};
        const zone = zones[s.zone] && zones[s.zone].id ? s.zone : game.config.fallbackZone;
        game.world.loadZone(zone, zone === s.zone ? [s.x, s.y] : 'start');
        wanted = false;
        timer = 0;
        return true;
      },
      /** Ask for an autosave at the next calm moment. */
      request() { if (api.autosave) wanted = true; },
      pendingAutosave() { return wanted; },
    };

    const req = () => { if (game.ready) api.request(); };
    game.bus.on('zone:load', req);
    game.bus.on('levelup', req);
    game.bus.on('quest:step', req);
    game.bus.on('quest:done', req);

    if (game.ops && game.ops.register) game.ops.register('save', () => { api.now(); game.toast('Game saved.', 'info'); });
    game.commands.saveNow = () => { api.now(); game.toast('Game saved.', 'info'); return true; };

    api._update = (dt) => {
      if (!api.autosave || !game.ready) return;
      timer += dt;
      if (timer >= (game.config.autosaveSeconds || 60)) wanted = true;
      if (wanted && calm()) api.now();
    };
    return api;
  },
  update(game, dt) { game.sys.save._update(dt); },
};
