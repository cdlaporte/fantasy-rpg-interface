// STUB: replaced by the Sim package
export default {
  id: 'companions',
  init() {
    const api = { active: [], set(classIds) { api.active = []; void classIds; } };
    return api;
  },
  update() {},
  hud(game, hud) { hud.companions.length = 0; },
};
