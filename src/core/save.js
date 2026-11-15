// STUB: replaced by the Meta package
// Minimal save/load through game.storage under key flinkerton.v1.<name>.
export default {
  id: 'save',
  always: true,
  init(game) {
    const key = (name) => game.config.saveKeyPrefix + (name || game.name);
    return {
      now() {
        const p = game.player;
        const json = { v: 1, name: game.name, zone: game.zone && game.zone.id, x: p ? p.x : 0, y: p ? p.y : 0,
          flags: game.flags, systems: game.saveSystems() };
        game.storage.set(key(), JSON.stringify(json));
        game.bus.emit('save', {});
        return json;
      },
      load(name) { try { return JSON.parse(game.storage.get(key(name))); } catch { return null; } },
      exists(name) { return game.storage.get(key(name)) != null; },
      clear(name) { game.storage.remove(key(name)); },
    };
  },
  update() {},
};
