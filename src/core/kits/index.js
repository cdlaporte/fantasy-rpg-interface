// STUB: replaced by the Sim package
// Kit registry + dispatcher. kits.active(ent) returns the layered kit (parent then spec).
import novice from './novice.js';
import warrior from './warrior.js';
import mage from './mage.js';
import rogue from './rogue.js';
import knight from './knight.js';
import berserker from './berserker.js';
import battlemage from './battlemage.js';
import conjurer from './conjurer.js';
import sorcerer from './sorcerer.js';
import monk from './monk.js';
import archer from './archer.js';
import thief from './thief.js';
import ninja from './ninja.js';

export const KITS = { novice, warrior, mage, rogue, knight, berserker, battlemage, conjurer, sorcerer, monk, archer, thief, ninja };

export default {
  id: 'kits',
  init() {
    const api = {
      registry: KITS,
      active(ent) { return (ent && ent.data && ent.data.kitRef) || novice; },
      set(ent, classId, specId) {
        if (!ent) return;
        ent.data.kitRef = KITS[specId] || KITS[classId] || novice;
        ent.data.classId = classId || null; ent.data.specId = specId || null;
      },
      resource(ent) { const r = ent && ent.data && ent.data.resource; return r || { value: 0, max: 0 }; },
      gain() {},
      spend() { return true; },
    };
    return api;
  },
  update() {},
  hud(game, hud) { hud.kitHud = null; hud.player.resource = null; },
};
