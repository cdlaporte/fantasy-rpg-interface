// Frostwhistle Peaks folk: Nana Frost (igloo innkeeper, cocoa, mittens) and Dr. Flurry (snow scientist), plus the small
// yeti that Grumbleflake turns into after the fight (spawned by peaks_boss_outro).
import { humanoid } from '../../looks.js';

const fit = (style, primary, secondary, accent) => ({ style, primary, secondary, accent });
const r = (from, to, at, d, zone) => (zone ? { from, to, at, do: d, zone } : { from, to, at, do: d });
const folk = { hp: 80, power: 0, defense: 0, speed: 2.6 };
const npc = (o) => Object.assign({ team: 'town', zone: 'peaks', shop: null, onAttacked: 'flee', stats: folk, tags: [] }, o);

const LOOKS = {
  nana_frost: humanoid({ build: 'b', size: 0.92, skin: '#e8b894', hair: { style: 'bun', color: '#f2f4f8' },
    outfit: fit('dress', '#7fc4e8', '#ffffff', '#ff8aa8'), hat: { style: 'cap', color: '#ff8aa8' },
    held: { style: 'lantern', color: '#c98c50', glow: '#ffd890' } }),
  dr_flurry: humanoid({ build: 'a', size: 1.02, skin: '#8d5a3b', hair: { style: 'spiky', color: '#3a5a8c' }, facial: 'goatee',
    outfit: fit('vest', '#f4f8ff', '#3d5aa8', '#7fd6ff'), hat: { style: 'cap', color: '#7fd6ff' },
    held: { style: 'book', color: '#3d5aa8', glow: null } }),
};

export default {
  nana_frost: npc({
    id: 'nana_frost', name: 'Nana Frost', look: LOOKS.nana_frost, dialogue: 'nana_frost',
    personality: 'Warm igloo innkeeper. Knits for the whole mountain. Believes every problem is a cocoa problem.',
    routine: [r(0, 6, 'home_nana', 'sleep'), r(6, 20, 'igloo_door', 'shopkeep'), r(20, 22, 'camp_fire', 'sit'), r(22, 24, 'home_nana', 'sleep')],
    barks: ['Cocoa is a hug you can drink.', 'Mind the ice, pet.', 'Another mitten gone. Honestly.'],
  }),
  dr_flurry: npc({
    id: 'dr_flurry', name: 'Dr. Flurry', look: LOOKS.dr_flurry, dialogue: 'dr_flurry',
    personality: 'Snow scientist with a clipboard. Measures everything twice. The spires hum and she hums back.',
    routine: [r(0, 6, 'home_flurry', 'sleep'), r(6, 10, 'flurry_lab', 'idle'), r(10, 16, 'spires', 'wander'),
      r(16, 21, 'flurry_lab', 'idle'), r(21, 23, 'camp_fire', 'sit'), r(23, 24, 'home_flurry', 'sleep')],
    barks: ['Fascinating. Cold, but fascinating.', 'Do not lick the spires. I did. Once.', 'Hmm. 4.2 meters. Or 4.3.'],
  }),
  // What is left of Grumbleflake once the grumpiness (and the cold) is gone. Spawned by peaks_boss_outro.
  grumbleflake_cub: npc({
    id: 'grumbleflake_cub', name: 'Grumbleflake (cozy)', dialogue: 'grumbleflake_cub', routine: [], onAttacked: 'flee',
    look: { rig: 'golem', size: 0.7, colors: { body: '#f4f8ff', belly: '#ffffff', accent: '#ff8aa8', eye: '#ffe14d' },
      features: ['icy'], hero: 'yeti' },
    personality: 'A small, fluffy, very embarrassed yeti in a scarf. Still grumpy. Slightly warmer.',
    barks: ['I am NOT fluffy.', 'Mittens. Mittens. Mittens.', 'Hrmph. Thank you.'],
  }),
};
