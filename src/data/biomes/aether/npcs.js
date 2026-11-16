// Aether Gardens folk, plus the finale's helper entities.
//   celeste: the astronomer (quest giver: aether_star_charts; the main quest's guide). Works at night, naps by day.
//   nimbus: a cloud shepherd kid who herds cloud pufflings (quest aether_puff_roundup).
//   aether_barrier: Malgrim's arena barrier (spawned by aether_boss_intro; leashes the player like the ambush barrier).
//   malgrim_cloud: what is left of Malgrim after the finale: a small, grumpy, drizzling cloud (aether_boss_outro).
import { humanoid } from '../../looks.js';

const r = (from, to, at, d, extra) => Object.assign({ from, to, at, do: d }, extra || null);
const folk = { hp: 80, power: 0, defense: 0, speed: 2.6 };
const npc = (o) => Object.assign({ team: 'town', zone: 'aether', shop: null, onAttacked: 'flee', stats: folk, tags: [] }, o);

export default {
  celeste: npc({
    id: 'celeste', name: 'Celeste the Astronomer', dialogue: 'celeste',
    look: humanoid({ build: 'b', size: 0.98, skin: '#7a4a2e', hair: { style: 'long', color: '#e8e4f6' },
      outfit: { style: 'robe', primary: '#2a2f6e', secondary: '#c9a6ff', accent: '#ffe680' },
      hat: { style: 'circlet', color: '#ffe680' }, cape: { color: '#3d3a8c' },
      held: { style: 'orb', color: '#9fe6ff', glow: '#ffe680' } }),
    personality: 'Night-owl astronomer. Dreamy, precise, mildly scandalised that someone sealed her sky.',
    // stargazing at the orrery at night, a nap by her tent in the morning, the observatory in the afternoon
    routine: [r(0, 3, 'orrery_view', 'idle'), r(3, 10, 'celeste_bed', 'sleep', { inside: false }), r(10, 20, 'celeste_post', 'idle'),
      r(20, 24, 'orrery_view', 'idle')],
    barks: ['Mars is in a mood today.', 'Do not step on the moon flowers!', 'Seven stars. No, eight.'],
  }),
  nimbus: npc({
    id: 'nimbus', name: 'Nimbus', dialogue: 'nimbus',
    look: humanoid({ build: 'a', size: 0.8, skin: '#d9a27a', hair: { style: 'curly', color: '#ffffff' },
      outfit: { style: 'tunic', primary: '#7fc8f0', secondary: '#ffffff', accent: '#ffd24a' },
      hat: { style: 'straw', color: '#f4ecd8' }, held: { style: 'staff', color: '#c98c50', glow: null } }),
    personality: 'Cloud shepherd, ten years old. Knows every puffling by name. Most are named Kevin.',
    routine: [r(0, 7, 'nimbus_bed', 'sleep', { inside: false }), r(7, 19, 'nimbus_post', 'wander', { r: 3 }), r(19, 24, 'camp_fire', 'sit')],
    barks: ['Easy, Kevin. EASY.', 'Clouds are just shy rain.', 'Have you seen a fluffy one? That one.'],
  }),

  // ---- finale helpers (no routine: spawned by cutscenes) ----
  aether_barrier: {
    id: 'aether_barrier', name: '', type: 'effect', team: 'neutral', zone: 'aether', routine: [], dialogue: null,
    look: { rig: 'effect', model: 'barrier', color: '#c86bff', r: 10 }, barrier: { r: 10 },
  },
  malgrim_cloud: npc({
    id: 'malgrim_cloud', name: 'Malgrim (a small cloud)', dialogue: 'malgrim_cloud', routine: [], team: 'neutral',
    look: { rig: 'blob', size: 0.55, colors: { body: '#9a8ac4', belly: '#c9b6ff', accent: '#ffcf4a', eye: '#2a1840' },
      features: ['drips', 'crown'], hero: null },
    personality: 'Malgrim, temporarily a rain cloud. Drizzles when upset, which is always.',
    barks: ['Hmph.', 'This is NOT a defeat.', '*drizzles angrily*'],
  }),
};
