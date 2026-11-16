// Aether Gardens items: one quest item, two consumables, and Malgrim's spare hat (a cosmetic boss drop; it is not sold
// by the outfitter, so it only comes from the boss chest). Same shapes as src/data/items.js.
import { config } from '../../../config.js';

const NS = config.numberScale || 1;

export default {
  star_chart: {
    id: 'star_chart', type: 'key', name: 'Star Chart', icon: 'book', price: 0, stack: 99, use: null, cd: 0, look: null,
    desc: 'One of Celeste\'s hand-inked star charts. Slightly chewed. The owls were "filing" it.',
  },
  moon_tea: {
    id: 'moon_tea', type: 'consumable', name: 'Moon Flower Tea', icon: 'tonic', price: 30, stack: 5, cd: 4, look: null,
    desc: `Brewed from moon flowers. Tastes like a nap. Heals ${140 * NS} over 8 seconds.`,
    use: { effect: 'heal_over_time', amount: 140, dur: 8 },
  },
  comet_candy: {
    id: 'comet_candy', type: 'consumable', name: 'Comet Candy', icon: 'star', price: 25, stack: 5, cd: 10, look: null,
    desc: 'Fizzes on the tongue and leaves a little tail. 50% faster for 8 seconds.',
    use: { effect: 'haste', mult: 1.5, dur: 8 },
  },
  hat_sealweaver: {
    id: 'hat_sealweaver', type: 'cosmetic', name: 'Sealweaver\'s Spare Hat', icon: 'hat', price: 0, stack: 1, use: null, cd: 0,
    desc: 'Malgrim\'s spare hat. Very pointy. Smells faintly of ego and thunderstorms.',
    slot: 'hat', look: { hat: { style: 'wizard', color: '#3d1f5c' } },
  },
};
