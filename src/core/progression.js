// STUB: replaced by the Meta package
export default {
  id: 'progression',
  init() {
    const api = {
      level: 1, xp: 0, xpNext: 20, classId: null, specId: null, boons: [],
      addXp(n) { api.xp += n; }, setLevel(n) { api.level = n; }, setClass(id) { api.classId = id; },
      setSpec(id) { api.specId = id; }, rank() { return 1; }, hasBoon() { return false; },
      offerBoons() { return []; }, chooseBoon() {}, recalc() {},
    };
    return api;
  },
  hud(game, hud) {
    const p = game.progression;
    hud.player.level = p.level; hud.player.xp = p.xp; hud.player.xpNext = p.xpNext;
    hud.player.classId = p.classId; hud.player.specId = p.specId;
    hud.pendingBoons = 0; hud.pendingSpec = false;
  },
};
