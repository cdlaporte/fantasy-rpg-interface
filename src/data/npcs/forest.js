// Whisperwood folk, plus story helper entities spawned by cutscenes and items.
// Helper defs carry `type` (the entity type to spawn), optional `interact` ({prompt, range, do}), and:
//   ambush_barrier.barrier = {r}: while it exists the player is leashed inside that circle (player.data.leash).
//   pet_fox: a player-team summon for the fox_whistle item (summon_pet), uses `attacks` like an enemy.
import { NPC_LOOKS } from '../looks.js';

const r = (from, to, at, d, zone) => (zone ? { from, to, at, do: d, zone } : { from, to, at, do: d });
const folk = { hp: 80, power: 0, defense: 0, speed: 2.6 };
const npc = (o) => Object.assign({ team: 'town', zone: 'forest', shop: null, onAttacked: 'flee', stats: folk, tags: [] }, o);

export default {
  ranger_tam: npc({
    id: 'ranger_tam', name: 'Ranger Tam', look: NPC_LOOKS.ranger_tam, dialogue: 'ranger_tam', onAttacked: 'retaliate',
    stats: { hp: 200, power: 10, defense: 3, speed: 3.4 },
    attacks: [{ id: 'arrow', use: 'projectile', speed: 14, range: 8, dmg: 1, radius: 0.2,
      look: { rig: 'projectile', model: 'arrow', color: '#c98c50', glow: null, size: 0.6, trail: true },
      cd: 1.2, windup: 0.4, telegraph: 'line', weight: 1 }],
    personality: 'Laid-back forest ranger; has named every tree; is quietly worried about the old grove.',
    routine: [r(0, 6, 'ranger_camp', 'sleep'), r(6, 20, 'ranger_camp', 'idle'), r(20, 24, 'ranger_camp', 'sleep')],
    barks: ['Watch the mushrooms. They watch back.', 'Nice day for it.', 'That tree is called Gerald.'],
  }),
  mo: npc({
    id: 'mo', name: 'Mo the Forager', look: NPC_LOOKS.mo, dialogue: 'mo',
    personality: 'Tiny, cheerful mushroom expert who has tasted everything once.',
    routine: [r(0, 7, 'ranger_camp', 'sleep'), r(7, 18, 'glade', 'wander'), r(18, 22, 'ranger_camp', 'sit'),
      r(22, 24, 'ranger_camp', 'sleep')],
    barks: ['Edible! Probably!', 'Achoo! Spores.', 'Ooh, a new one!'],
  }),
  kai: npc({
    id: 'kai', name: 'Kai', look: NPC_LOOKS.kai, dialogue: 'kai',
    personality: 'Patient fisher at the brook; has never caught a fish; does not mind at all.',
    routine: [r(0, 6, 'ranger_camp', 'sleep'), r(6, 19, 'brook', 'idle'), r(19, 23, 'ranger_camp', 'sit'),
      r(23, 24, 'ranger_camp', 'sleep')],
    barks: ['Shh. The fish are thinking.', 'Any day now.', 'Nice ripples.'],
  }),
  wren: npc({
    id: 'wren', name: 'Wren', look: NPC_LOOKS.wren, dialogue: 'wren',
    personality: 'Birdwatcher with a notebook; logs every creature, including you.',
    routine: [r(0, 7, 'ranger_camp', 'sleep'), r(7, 12, 'meadow', 'wander'), r(12, 18, 'wisp_pond', 'idle'),
      r(18, 21, 'ranger_camp', 'sit'), r(21, 24, 'ranger_camp', 'sleep')],
    barks: ['Spotted: one student. Rare!', 'Look, a wisp! Do not look at it.', 'Tweet. That was me.'],
  }),

  // ---- story helpers (no routine: spawned by cutscenes) ----
  stick_pickup: {
    id: 'stick_pickup', name: 'A Stick', type: 'effect', team: 'neutral', zone: 'intro', routine: [], dialogue: null,
    look: { rig: 'effect', model: 'stick', color: '#a8743d' },
    interact: { prompt: 'Pick up', range: 1.4, do: [
      ['flag.set', 'has_stick', true], ['sfx', 'pickup'], ['despawn', 'stick_pickup'],
      ['toast', 'You found a stick. It is extremely stick-shaped.', 'loot'],
    ] },
  },
  ambush_barrier: {
    id: 'ambush_barrier', name: '', type: 'effect', team: 'neutral', zone: 'intro', routine: [], dialogue: null,
    look: { rig: 'effect', model: 'barrier', color: '#b48cff', r: 4 }, barrier: { r: 4 },
  },
  mossback_sprout: npc({
    id: 'mossback_sprout', name: 'Mossback (sleepy)', dialogue: 'mossback_sprout', routine: [], onAttacked: 'flee',
    look: { rig: 'plant', size: 0.6, colors: { body: '#7a5a3a', belly: '#a8743d', accent: '#5fb548', eye: '#ffe14d' },
      features: ['bark_face', 'leaves', 'flower'], hero: null },
    personality: 'What is left of Old Mossback: a small, very sleepy sapling. Grumpy. Adorable.',
    barks: ['Zzz...', 'Five... more... minutes...'],
  }),
  pet_fox: {
    id: 'pet_fox', name: 'Fox', type: 'summon', team: 'player', zone: null, routine: [], dialogue: null,
    stats: { hp: 40, power: 6, defense: 0, speed: 4.2, radius: 0.3 },
    ai: { brain: 'chaser', aggro: 6, leash: 6 },
    attacks: [{ id: 'ankle_bite', use: 'melee_arc', arc: 80, range: 0.7, dmg: 1, cd: 0.8, windup: 0.3, telegraph: null, weight: 1 }],
    look: { rig: 'quadruped', size: 0.5, colors: { body: '#ff8a3c', belly: '#fff2e0', accent: '#3a2618', eye: '#222222' },
      features: ['tail_bushy', 'ears_pointy'], hero: null },
  },
};
