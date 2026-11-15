// STUB: replaced by the Meta package
export default {
  id: 'inventory',
  init() {
    const api = {
      items: {}, hotbar: [null, null, null, null, null, null], gold: 0, cosmetics: [], equipped: { hat: null, cape: null, outfitColor: null },
      give(id, n = 1) { api.items[id] = (api.items[id] || 0) + n; },
      take(id, n = 1) { if ((api.items[id] || 0) < n) return false; api.items[id] -= n; return true; },
      count(id) { return api.items[id] || 0; },
      useSlot() { return false; }, assignSlot() {}, addGold(n) { api.gold += n; }, equipCosmetic() {},
      openShop() {}, buy() { return false; },
    };
    return api;
  },
  hud(game, hud) { hud.player.gold = game.inventory.gold; },
};
