// Frostwhistle Peaks items. Consumables use the effects documented in src/data/items.js (heal_over_time, bomb).
// Health amounts are written as readable base numbers; the inventory multiplies them by config.numberScale.
import { config } from '../../../config.js';

const NS = config.numberScale || 1;
const consumable = (id, name, desc, icon, price, stack, use, cd = 1) =>
  ({ id, type: 'consumable', name, desc, icon, price, stack, use, cd, look: null });
const key = (id, name, desc, icon = 'key') =>
  ({ id, type: 'key', name, desc, icon, price: 0, stack: 99, use: null, cd: 0, look: null });

const list = [
  // Nana Frost's recipe: a slow, cozy heal that keeps ticking while you fight.
  consumable('frost_cocoa', 'Frostwhistle Cocoa', `Thick, sweet, with a marshmallow hat. Heals ${220 * NS} over 12 seconds.`,
    'tonic', 24, 5, { effect: 'heal_over_time', amount: 220, dur: 12 }, 5),
  consumable('icicle_bomb', 'Icicle Bomb', 'Throw it ahead. It goes CRACK, then tinkle. A bigger blast than a Fizzbomb.', 'bomb', 32, 5,
    { effect: 'bomb', dmg: 4, r: 2.6, range: 4, delay: 0.7 }, 2),
  key('lost_mitten', 'Lost Mitten', 'Hand-knitted, lopsided, slightly chewed. The bunnies call it a nest.', 'star'),
  { id: 'cape_snowflake', type: 'cosmetic', name: 'Snowflake Cape', desc: 'Every flake is different. Grumbleflake checked.',
    icon: 'cloak', price: 160, stack: 1, use: null, cd: 0, slot: 'cape', look: { cape: { color: '#dff3ff' } } },
];

const items = {};
for (const it of list) items[it.id] = it;
export default items;
