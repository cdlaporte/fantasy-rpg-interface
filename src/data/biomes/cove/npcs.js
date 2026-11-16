// Gullwing Cove folk: Marlo the lighthouse keeper, Skipper the fisher kid, Pearl the chowder cook, plus the tiny Captain
// who appears after the boss fight. Routines cover 24 hours on this zone's markers.
import { humanoid } from '../../looks.js';

const r = (from, to, at, d) => ({ from, to, at, do: d });
const folk = { hp: 80, power: 0, defense: 0, speed: 2.6 };
const npc = (o) => Object.assign({ team: 'town', zone: 'cove', shop: null, onAttacked: 'flee', stats: folk, tags: [] }, o);

const fit = (style, primary, secondary, accent) => ({ style, primary, secondary, accent });

const LOOKS = {
  marlo: humanoid({ build: 'a', size: 1.05, skin: '#b9825a', hair: { style: 'bald', color: '#e8e8ec' }, facial: 'beard',
    outfit: fit('uniform', '#2f5a8a', '#f4ecd8', '#ffd24a'), hat: { style: 'cap', color: '#2f5a8a' },
    held: { style: 'lantern', color: '#6b4423', glow: '#ffe680' } }),
  skipper: humanoid({ build: 'b', size: 0.78, skin: '#e2ae88', hair: { style: 'curly', color: '#b5602d' },
    outfit: fit('tunic', '#2a9d8f', '#f4ecd8', '#ffd24a'), hat: { style: 'straw', color: '#e8c870' },
    held: { style: 'stick', color: '#a8743d', glow: null } }),
  pearl: humanoid({ build: 'b', size: 0.95, skin: '#6f4630', hair: { style: 'braids', color: '#d8d8e0' },
    outfit: fit('apron', '#e8a0b0', '#ffffff', '#2a9d8f'), hat: { style: 'bandana', color: '#ffffff' } }),
};

export default {
  marlo: npc({
    id: 'marlo', name: 'Marlo the Keeper', look: LOOKS.marlo, dialogue: 'marlo',
    personality: 'Gruff, kind lighthouse keeper. Hates that his lamp is dark. Talks to the lighthouse when he thinks nobody is listening.',
    routine: [r(0, 6, 'home_marlo', 'sleep'), r(6, 18, 'marlo_post', 'idle'), r(18, 22, 'camp', 'sit'), r(22, 24, 'home_marlo', 'sleep')],
    barks: ['Not a flicker. Not one.', 'Look at that. Dark as a sock.', 'Mind the imps, student.'],
  }),
  skipper: npc({
    id: 'skipper', name: 'Skipper', look: LOOKS.skipper, dialogue: 'skipper',
    personality: 'A fisher kid, nine and three-quarters. Has caught two boots and a hat. Loves shells more than fish.',
    routine: [r(0, 7, 'home_skipper', 'sleep'), r(7, 17, 'pier_end', 'idle'), r(17, 20, 'tide_pools', 'wander'),
      r(20, 22, 'camp', 'sit'), r(22, 24, 'home_skipper', 'sleep')],
    barks: ['I got a bite! ...It was a boot.', 'Shh, the fish are shy.', 'Crabs have my shells!'],
  }),
  pearl: npc({
    id: 'pearl', name: 'Pearl', look: LOOKS.pearl, dialogue: 'pearl',
    personality: 'Cheerful chowder cook who runs the dockside stand. Calls everyone "dear". Furious at gulls, lovingly.',
    routine: [r(0, 7, 'home_pearl', 'sleep'), r(7, 20, 'pearl_stall', 'idle'), r(20, 22, 'camp', 'sit'), r(22, 24, 'home_pearl', 'sleep')],
    barks: ['Chowder! Hot chowder, dear!', 'Shoo! Not the bread!', 'Mind the gulls. They bite.'],
  }),
  // appears in cove_boss_outro: what is left of Captain Clawsworth (hat-sized, still in the hat)
  clawsworth_tiny: npc({
    id: 'clawsworth_tiny', name: 'Captain Clawsworth (tiny)', dialogue: 'clawsworth_tiny', routine: [], onAttacked: 'flee',
    look: { rig: 'quadruped', size: 0.45, colors: { body: '#e8503c', belly: '#ffd0a0', accent: '#ffcf4a', eye: '#1d1d2a' },
      features: ['claws', 'shell_back'], hero: null },
    personality: 'The Captain, hat-sized. Still very dramatic. Still wearing the hat.',
    barks: ['Arr.', 'Mind the hat.'],
  }),
};
