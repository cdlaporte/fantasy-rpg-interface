// Sunscorch Dunes folk: Ziva the caravan merchant (camp), Professor Dusty the archaeologist (ruins dig), and the
// sleepy kitten-sized Sandsnout who appears after the boss fight. Same shape as src/data/npcs/forest.js.
import { humanoid } from '../../looks.js';

const r = (from, to, at, d) => ({ from, to, at, do: d });
const folk = { hp: 80, power: 0, defense: 0, speed: 2.6 };
const npc = (o) => Object.assign({ team: 'town', zone: 'dunes', shop: null, onAttacked: 'flee', stats: folk, tags: [] }, o);

export default {
  ziva: npc({
    id: 'ziva', name: 'Ziva', dialogue: 'ziva',
    look: humanoid({ build: 'b', skin: '#9b6240', hair: { style: 'braids', color: '#1a1410' },
      outfit: { style: 'dress', primary: '#d8603c', secondary: '#f0c050', accent: '#3fa0c0' },
      hat: { style: 'bandana', color: '#3fa0c0' }, held: { style: 'lantern', color: '#8a5a33', glow: '#ffd070' } }),
    personality: 'Brisk, warm caravan merchant. Haggles for sport. Lost half her caravan to a sandstorm and counts it daily.',
    routine: [r(0, 6, 'tent_ziva', 'sleep'), r(6, 8, 'camp_fire', 'sit'), r(8, 19, 'ziva_stall', 'idle'),
      r(19, 22, 'camp_fire', 'sit'), r(22, 24, 'tent_ziva', 'sleep')],
    barks: ['Fair prices! Mostly fair!', 'Water is gold out here.', 'Hats. Buy a hat.'],
  }),
  professor_dusty: npc({
    id: 'professor_dusty', name: 'Professor Dusty', dialogue: 'professor_dusty',
    look: humanoid({ build: 'a', skin: '#e8a888', hair: { style: 'curly', color: '#d8d0c0' }, facial: 'mustache',
      outfit: { style: 'vest', primary: '#c8a064', secondary: '#f4ecd8', accent: '#8a5a33' },
      hat: { style: 'straw', color: '#c8a064' }, held: { style: 'book', color: '#8a5a33', glow: null } }),
    personality: 'Excitable archaeologist covered in dust. Talks to artifacts. Forgets to eat. Has never once been right about a date.',
    routine: [r(0, 6, 'tent_dusty', 'sleep'), r(6, 9, 'dig_site', 'idle'), r(9, 13, 'ruins', 'wander'),
      r(13, 15, 'dig_site', 'sit'), r(15, 19, 'ruins', 'wander'), r(19, 22, 'dig_site', 'sit'), r(22, 24, 'tent_dusty', 'sleep')],
    barks: ['Fascinating! Also dusty.', 'Do not touch that. I am touching it.', 'Three thousand years old! Maybe.'],
  }),
  // appears in dunes_boss_outro: Sandsnout, shrunk to nap size
  sandsnout_kit: npc({
    id: 'sandsnout_kit', name: 'Sandsnout (sleepy)', dialogue: 'sandsnout_kit', routine: [], onAttacked: 'flee',
    look: { rig: 'quadruped', size: 0.6, colors: { body: '#e8c070', belly: '#f6dfa0', accent: '#3fa0c0', eye: '#2a1840' },
      features: ['mane'], hero: 'sphinx' },
    personality: 'What is left of Sultana Sandsnout: a very small, very smug sphinx who wants a nap and a rematch of riddles.',
    barks: ['Riddle me this... zzz.', 'Warm. Napping.'],
  }),
};
