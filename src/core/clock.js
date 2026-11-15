// STUB: replaced by the Story package
// Fixed morning. The real clock advances game hours and writes game.ambience.
export default {
  id: 'clock',
  init(game) {
    const api = { hour: game.config.startHour, daypart: 'morning', set(h) { api.hour = h; } };
    return api;
  },
  update() {},
  hud(game, hud) { hud.hour = game.clock.hour; hud.daypart = game.clock.daypart; },
};
