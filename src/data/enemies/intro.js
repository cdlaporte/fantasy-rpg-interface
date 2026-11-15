// Intro road + Academy enemies. Schema: docs/CONTRACTS.md 13a plus the Sim AI schema (docs/notes/narrative.md).
// `dmg` is a coefficient of stats.power. Each attack has an `id` (boss phase patterns and debugging refer to it).
import { NPC_LOOKS, MALGRIM_LOOK } from '../looks.js';

const proj = (model, color, glow, size = 0.6) => ({ rig: 'projectile', model, color, glow, size, trail: true });

export default {
  // L1. Tutorial chaser: three stick hits. Slow bite so a fresh novice survives a pack of three.
  rat: {
    id: 'rat', name: 'Pantry Rat', level: 1, tags: ['beast', 'rat'],
    stats: { hp: 6, power: 3, defense: 0, speed: 2.4, radius: 0.3, xp: 8 },
    flying: false,
    ai: { brain: 'chaser', aggro: 5, leash: 10 },
    attacks: [
      { id: 'bite', use: 'melee_arc', arc: 80, range: 0.7, dmg: 1, cd: 1.8, windup: 0.4, telegraph: null, weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'quadruped', size: 0.5, colors: { body: '#9a8a7a', belly: '#e0d0c0', accent: '#ff9aa8', eye: '#222222' },
      features: ['tail_thin', 'ears_round'], hero: null },
    drops: { gold: [1, 3], goldChance: 0.6, items: [{ id: 'cheese', p: 0.15 }] },
    boss: null,
  },

  // L2 elite. The tutorial's first "boss": telegraphed lunge, tail swipe when crowded.
  giant_rat: {
    id: 'giant_rat', name: 'Sir Squeaks-a-Lot', level: 2, tags: ['beast', 'rat', 'elite'],
    // integration feel pass: was hp 40 / power 5 with bite 1.0 + lunge 1.2 (downed an L2 novice every time);
    // now within the balance sheet's 25% band with softer attack coefficients.
    stats: { hp: 32, power: 4, defense: 0, speed: 2.6, radius: 0.45, xp: 33 },
    flying: false,
    ai: { brain: 'charger', aggro: 6, leash: 12 },
    attacks: [
      { id: 'bite', use: 'melee_arc', arc: 90, range: 0.9, dmg: 0.75, cd: 1.5, windup: 0.4, telegraph: null, weight: 2 },
      { id: 'lunge', use: 'dash', dist: 3, speed: 9, dmg: 0.9, knockback: 4, cd: 4, windup: 0.8, range: 4, minRange: 1.5,
        telegraph: 'line', weight: 2 },
      { id: 'tail_swipe', use: 'aoe_ring', r: 1.4, dmg: 0.6, knockback: 3, cd: 6, windup: 0.6, range: 1.3,
        telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'quadruped', size: 0.95, colors: { body: '#7a6a6a', belly: '#d8c8b8', accent: '#ff8a9a', eye: '#ffdd55' },
      features: ['tail_thin', 'ears_round', 'mane'], hero: null },
    drops: { gold: [4, 8], goldChance: 1, items: [{ id: 'potion_small', p: 0.5 }, { id: 'cheese', p: 0.5 }] },
    boss: null,
  },

  // integration feel pass: the ambush ended in ~6 s against the bot (an L3 novice standing and swinging), so the
  // hexguard and Malgrim attack coefficients were scaled by ~0.6 and theatrics lowered (+140% -> +60% power).
  // Ambush minion. Guards the clearing (barrier r 4). Tuned with Malgrim so a level 3 novice (35 hp, floor 1)
  // goes down in roughly 10-20 s: ~3 damage per hit, slow swings, a telegraphed shield rush.
  hexguard: {
    id: 'hexguard', name: 'Hexguard', level: 4, tags: ['ambush', 'construct', 'story'],
    stats: { hp: 40, power: 3, defense: 1, speed: 2.9, radius: 0.38, xp: 12 },
    flying: false,
    ai: { brain: 'guard', aggro: 8, leash: 4.5 },
    attacks: [
      { id: 'hex_slash', use: 'melee_arc', arc: 100, range: 1.1, dmg: 0.6, cd: 2.0, windup: 0.5, telegraph: 'cone', weight: 3 },
      { id: 'shield_rush', use: 'dash', dist: 2.5, speed: 8, dmg: 0.5, knockback: 3, cd: 5, windup: 0.7, range: 3,
        minRange: 1.2, telegraph: 'line', weight: 1 },
    ],
    onDeath: null,
    look: NPC_LOOKS.hexguard,
    drops: { gold: [0, 0], goldChance: 0, items: [] },
    boss: null,
  },

  // The villain. Cannot really be beaten here (hp 600). Keeps distance, blinks away, and every spell is a big,
  // slow telegraph. `theatrics` ramps his power so the fight always ends inside 20 s.
  malgrim: {
    id: 'malgrim', name: 'Malgrim the Sealweaver', level: 6, tags: ['ambush', 'villain', 'story'],
    stats: { hp: 600, power: 5, defense: 2, speed: 2.6, radius: 0.4, xp: 30 },
    flying: false,
    ai: { brain: 'skirmisher', aggro: 12, leash: 5, keepRange: 3.5, blinkCd: 5 },
    attacks: [
      { id: 'hex_bolt', use: 'projectile', speed: 7, range: 8, dmg: 0.5, radius: 0.3, homing: 0.6, pierce: false,
        look: proj('orb', '#c86bff', '#ffffff'), cd: 2.4, windup: 0.5, telegraph: 'line', weight: 3 },
      { id: 'seal_burst', use: 'ground_target', range: 7, r: 1.6, dmg: 1.0, delay: 1.2, zone: null,
        cd: 5, windup: 1.0, telegraph: 'circle', weight: 2 },
      { id: 'grand_hex', use: 'aoe_ring', r: 3.5, dmg: 1.4, knockback: 5, cd: 9, windup: 1.6, range: 3,
        telegraph: 'circle', weight: 2 },
      { id: 'flourish', use: 'blink', dist: 4, cd: 5, windup: 0.3, range: 2, telegraph: null, weight: 1 },
      { id: 'theatrics', use: 'buff_self', mods: { power: 0.6 }, dur: 30, cd: 7, windup: 0.6, telegraph: null, weight: 1 },
    ],
    onDeath: null,
    look: MALGRIM_LOOK,
    drops: { gold: [0, 0], goldChance: 0, items: [] },
    boss: null,
  },

  // Academy yard. Never attacks, never moves, regenerates `stats.regen` hp/s, never dies (`immortal`).
  training_dummy: {
    id: 'training_dummy', name: 'Training Dummy', level: 1, tags: ['dummy', 'training'],
    stats: { hp: 300, power: 0, defense: 0, speed: 0, radius: 0.4, xp: 0, regen: 25 },
    flying: false, immortal: true, anchored: true,
    ai: { brain: 'turret', aggro: 0, leash: 0 },
    attacks: [],
    onDeath: null,
    look: { rig: 'golem', size: 0.9, colors: { body: '#e0c070', belly: '#c98c50', accent: '#e8503c', eye: '#3a2618' },
      features: ['wood'], hero: null },
    drops: { gold: [0, 0], goldChance: 0, items: [] },
    boss: null,
  },
};
