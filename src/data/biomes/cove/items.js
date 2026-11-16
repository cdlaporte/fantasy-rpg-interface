// Gullwing Cove items. Drops and key items (no outfitter entries needed): quest items for Marlo and Skipper, a chowder
// and a bubble bomb for the pack, and the Captain's hat (a drop from the boss chest).
import { config } from '../../../config.js';

const NS = config.numberScale || 1;
const consumable = (id, name, desc, icon, price, stack, use, cd = 1) =>
  ({ id, type: 'consumable', name, desc, icon, price, stack, use, cd, look: null });
const key = (id, name, desc, icon = 'key') =>
  ({ id, type: 'key', name, desc, icon, price: 0, stack: 99, use: null, cd: 0, look: null });
const hat = (id, name, desc, price, style, color) =>
  ({ id, type: 'cosmetic', name, desc, icon: 'hat', price, stack: 1, use: null, cd: 0, slot: 'hat', look: { hat: { style, color } } });

const list = [
  consumable('sea_chowder', 'Sea Chowder', `Pearl's recipe. Heals ${120 * NS} over 12 seconds. Contains actual fish. Probably.`, 'bread', 18, 5,
    { effect: 'heal_over_time', amount: 120, dur: 12 }, 4),
  consumable('bubble_bomb', 'Bubble Bomb', 'A big, wobbly fizzbomb. Wider boom, same friendly feeling.', 'bomb', 28, 5,
    { effect: 'bomb', dmg: 3.2, r: 3, range: 4, delay: 0.8 }, 3),
  key('conch_shell', 'Conch Shell', 'Skipper\'s collection. Smells of sea and crab. Whispers faintly when you hold it up.', 'star'),
  key('glow_jelly', 'Glow Jelly', 'A jar of luminous goo. Marlo says it burns brighter than oil. Please do not taste it.', 'potion'),
  key('brass_lens', 'Brass Lens', 'The lighthouse\'s missing lens. It is slightly dented and very shiny. Pirates!', 'star'),
  hat('hat_captain', 'Captain\'s Tricorn', 'Plume included. Smells faintly of crab. Makes you 100% more dramatic.', 0, 'feather', '#243a66'),
];

const items = {};
for (const it of list) items[it.id] = it;
export default items;
