// Sunscorch Dunes items: desert consumables (sold by Ziva through dialogue, dropped by enemies) and two cosmetics
// (quest and boss rewards; they need no outfitter entry). Same shape as src/data/items.js.
import { config } from '../../../config.js';

const NS = config.numberScale || 1;

export default {
  cactus_water: {
    id: 'cactus_water', type: 'consumable', name: 'Cactus Water',
    desc: `Cool, slightly prickly, weirdly refreshing. Heals ${70 * NS} over 6 seconds.`,
    icon: 'potion', price: 12, stack: 9, use: { effect: 'heal_over_time', amount: 70, dur: 6 }, cd: 3, look: null,
  },
  sand_veil: {
    id: 'sand_veil', type: 'consumable', name: 'Sand Veil',
    desc: 'A bottled dust storm. Uncork it and enemies lose track of you for a few seconds. Cough politely.',
    icon: 'smoke', price: 25, stack: 5, use: { effect: 'smoke', r: 3, dur: 5, stealth: 4 }, cd: 9, look: null,
  },
  hat_sun_explorer: {
    id: 'hat_sun_explorer', type: 'cosmetic', name: 'Explorer\'s Sun Hat',
    desc: 'Wide brim, many stains, one tiny 3,000-year-old beetle. Professor Dusty\'s second-best hat.',
    icon: 'hat', price: 0, stack: 1, use: null, cd: 0, slot: 'hat', look: { hat: { style: 'straw', color: '#c8a064' } },
  },
  hat_sphinx_circlet: {
    id: 'hat_sphinx_circlet', type: 'cosmetic', name: 'Sphinx Circlet',
    desc: 'Sultana Sandsnout\'s golden circlet. It slips off her ears anyway. Looks great on yours.',
    icon: 'hat', price: 0, stack: 1, use: null, cd: 0, slot: 'hat', look: { hat: { style: 'circlet', color: '#e8b84a' } },
  },
};
