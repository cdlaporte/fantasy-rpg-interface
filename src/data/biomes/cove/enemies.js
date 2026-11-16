// Gullwing Cove enemies. Same recipe as the forest (docs/BIOMES.md, docs/notes/r2c.md): numbers from the CLASSES balance
// sheet at the def's own level (hp 6 L^1.4 x0.6, power 2 + 1.5 L, xp 5 + 3 L), rescaled by the spawn to the player's level
// (zone.scaleToPlayer). Five regular kinds, each with its own brain and attack set, plus Captain Clawsworth.
//   snippy_crab (L12, skirmisher): short scuttling dashes and pinches, gets fast and cross when hurt
//   gull        (L12, swarmer):    packs that circle and swoop in a straight line; "gifts from above" slow you
//   bubble_jelly(L13, chaser):     drifts after you slowly, zaps a telegraphed beam, pops a ring of bubbles
//   pirate_imp  (L14, skirmisher): keeps 5 tiles off and lobs bottles (arcing), cutlass if cornered, runs when low
//   coral_golem (L15, charger):    slow, long telegraphed tide rush, ground slam, spiky coral patches
import { humanoid } from '../../looks.js';

const proj = (model, color, glow, size = 0.6) => ({ rig: 'projectile', model, color, glow, size, trail: true });
const zoneLook = (model, color, r) => ({ rig: 'effect', model, color, r });
const hp = (L, k = 1) => Math.round(6 * Math.pow(L, 1.4) * 0.6 * k);
const pw = (L, k = 1) => Math.round((2 + 1.5 * L) * k * 10) / 10;
const xp = (L) => 5 + 3 * L;

export default {
  // L12. Skirmisher: darts in and out, pinches in a cone, sidesteps with a short telegraphed scuttle, and goes into a
  // fast, cross "claws up" mode below half health. Runs off when nearly beaten. Hoards conch shells.
  snippy_crab: {
    id: 'snippy_crab', name: 'Snippy Crab', level: 12, tags: ['beast', 'crab'],
    stats: { hp: hp(12), power: pw(12), defense: 2, speed: 3.3, radius: 0.4, xp: xp(12) },
    flying: false,
    ai: { brain: 'skirmisher', aggro: 7, leash: 12, keepRange: 2.8, fleeHp: 0.2 },
    attacks: [
      { id: 'pinch', use: 'melee_arc', arc: 100, range: 1.1, dmg: 1, knockback: 2, cd: 1.4, windup: 0.4, telegraph: 'cone', weight: 3 },
      { id: 'scuttle', use: 'dash', dist: 3.4, speed: 9, dmg: 0.9, knockback: 2, cd: 3, windup: 0.5, range: 4.5, minRange: 1.6,
        telegraph: 'line', weight: 2 },
      { id: 'claws_up', use: 'buff_self', mods: { speed: 1.35, power: 1.15 }, dur: 6, cd: 14, windup: 0.5, telegraph: null,
        weight: 1, ifHpBelow: 0.5 },
    ],
    onDeath: null,
    look: { rig: 'quadruped', size: 0.8, colors: { body: '#f2704a', belly: '#ffd6a8', accent: '#ff9a6a', eye: '#1d1d2a' },
      features: ['claws', 'shell_back'], hero: null },
    drops: { gold: [3, 14], goldChance: 0.65, items: [{ id: 'conch_shell', p: 0.4 }, { id: 'potion_small', p: 0.06 }] },
    boss: null,
  },

  // L12. Swarmer: packs of three circle you, then swoop in a straight telegraphed line. "Gift from above" splats a
  // slowing puddle. Fragile, fast, and they carry off tourists' coins: lots of gold falls out when they pop.
  gull: {
    id: 'gull', name: 'Pilfer Gull', level: 12, tags: ['beast', 'flying', 'bird'],
    stats: { hp: hp(12, 0.8), power: pw(12), defense: 0, speed: 4.4, radius: 0.3, xp: xp(12) },
    flying: true,
    ai: { brain: 'swarmer', aggro: 8, leash: 14, swarm: 3 },
    attacks: [
      { id: 'swoop', use: 'dash', dist: 4, speed: 10.5, dmg: 0.9, knockback: 1, cd: 2.6, windup: 0.45, range: 4.5, minRange: 1.5,
        telegraph: 'line', weight: 3 },
      { id: 'peck', use: 'melee_arc', arc: 60, range: 0.7, dmg: 0.7, cd: 1, windup: 0.3, telegraph: null, weight: 1 },
      { id: 'gift_from_above', use: 'ground_target', range: 5, r: 1, dmg: 0.5, delay: 0.8,
        zone: { dur: 2.5, tick: 0.5, dmg: 0.1, status: 'slow', look: zoneLook('smoke', '#f4f6fa', 1) },
        cd: 7, windup: 0.7, minRange: 1.5, telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'flyer', size: 0.6, colors: { body: '#f4f6fa', belly: '#ffffff', accent: '#ffb347', eye: '#222233' },
      features: ['wings_bird'], hero: null },
    drops: { gold: [4, 15], goldChance: 0.85, items: [{ id: 'bread', p: 0.06 }] },
    boss: null,
  },

  // L13. Chaser that floats: drifts after you slowly, zaps a telegraphed beam from range, pops a slow ring of bubbles,
  // and shocks anything that gets next to it. Drops glow jelly (lamp oil).
  bubble_jelly: {
    id: 'bubble_jelly', name: 'Bubble Jelly', level: 13, tags: ['blob', 'jelly', 'flying'],
    stats: { hp: hp(13), power: pw(13), defense: 0, speed: 1.8, radius: 0.45, xp: xp(13) },
    flying: true,
    ai: { brain: 'chaser', aggro: 7, leash: 11 },
    attacks: [
      { id: 'zap', use: 'beam', range: 6, w: 0.35, dmg: 1.1, cd: 3.2, windup: 0.9, telegraph: 'line', weight: 3 },
      { id: 'bubble_ring', use: 'multishot', n: 8, spread: 360, speed: 3.2, range: 4.5, dmg: 0.6, radius: 0.35,
        look: proj('orb', '#bfeaff', '#ffffff', 0.55), cd: 7, windup: 0.8, telegraph: 'circle', weight: 2 },
      { id: 'shock', use: 'aoe_ring', r: 1.8, dmg: 0.9, knockback: 3, cd: 4, windup: 0.6, range: 1.5, telegraph: 'circle', weight: 2 },
    ],
    onDeath: null,
    look: { rig: 'blob', size: 0.9, colors: { body: '#8fe3ff', belly: '#d9f7ff', accent: '#ff9ad6', eye: '#2a2a5a' },
      features: ['tentacles', 'bubbles'], hero: null },
    drops: { gold: [3, 15], goldChance: 0.7, items: [{ id: 'glow_jelly', p: 0.5 }, { id: 'potion_small', p: 0.08 }, { id: 'sea_chowder', p: 0.05 }] },
    boss: null,
  },

  // L14. Skirmisher with range: stays 5 tiles away, lobs arcing bottles (single or a spread of three), slashes a cutlass
  // if cornered and bolts when nearly beaten. Sometimes carries the lighthouse's missing brass lens.
  pirate_imp: {
    id: 'pirate_imp', name: 'Pirate Imp', level: 14, tags: ['imp', 'humanoid', 'pirate'],
    stats: { hp: hp(14), power: pw(14), defense: 1, speed: 3.4, radius: 0.35, xp: xp(14) },
    flying: false,
    ai: { brain: 'skirmisher', aggro: 8, leash: 14, keepRange: 5, fleeHp: 0.2 },
    attacks: [
      { id: 'bottle_throw', use: 'projectile', speed: 8, range: 7.5, dmg: 0.9, radius: 0.25, gravityZ: 1, pierce: false,
        look: proj('orb', '#7fd6a8', '#d0ffe8', 0.5), cd: 1.9, windup: 0.5, minRange: 2, telegraph: 'line', weight: 3 },
      { id: 'bottle_barrage', use: 'multishot', n: 3, spread: 40, speed: 8, range: 6.5, dmg: 0.65, radius: 0.22, gravityZ: 1,
        look: proj('orb', '#7fd6a8', '#d0ffe8', 0.45), cd: 6, windup: 0.7, minRange: 2, telegraph: 'cone', weight: 1 },
      { id: 'cutlass', use: 'melee_arc', arc: 80, range: 0.95, dmg: 1.1, cd: 1.2, windup: 0.4, telegraph: 'cone', weight: 2 },
    ],
    onDeath: null,
    look: humanoid({ build: 'b', size: 0.8, skin: '#e8766a', hair: { style: 'spiky', color: '#2a1840' }, ears: 'pointed',
      outfit: { style: 'vest', primary: '#c8303c', secondary: '#f4ecd8', accent: '#ffd24a' },
      hat: { style: 'bandana', color: '#243a66' }, held: { style: 'sword', color: '#c0c4cc', glow: null } }),
    drops: { gold: [3, 16], goldChance: 0.75, items: [{ id: 'brass_lens', p: 0.4 }, { id: 'bubble_bomb', p: 0.06 }, { id: 'potion_small', p: 0.08 }] },
    boss: null,
  },

  // L15. Charger: slow and sturdy. Paws the sand, then a long telegraphed tide rush; a ground slam when you are close;
  // lobs patches of spiky coral that slow whoever stands in them.
  coral_golem: {
    id: 'coral_golem', name: 'Coral Golem', level: 15, tags: ['golem', 'coral'],
    stats: { hp: hp(15, 1.1), power: pw(15), defense: 4, speed: 1.9, radius: 0.55, xp: xp(15) },
    flying: false,
    ai: { brain: 'charger', aggro: 6, leash: 10 },
    attacks: [
      { id: 'tide_rush', use: 'dash', dist: 5, speed: 7.5, dmg: 1.4, knockback: 5, cd: 5, windup: 1.1, range: 6.5, minRange: 2.2,
        telegraph: 'line', weight: 3 },
      { id: 'coral_slam', use: 'aoe_ring', r: 2.1, dmg: 1.1, knockback: 4, cd: 3.5, windup: 0.8, range: 1.8, telegraph: 'circle', weight: 3 },
      { id: 'spike_patch', use: 'ground_target', range: 6, r: 1.3, dmg: 0.6, delay: 1,
        zone: { dur: 3, tick: 0.5, dmg: 0.25, status: 'slow', look: zoneLook('zone_ring', '#ff7a8a', 1.3) },
        cd: 7, windup: 0.8, minRange: 1.5, telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'golem', size: 1.1, colors: { body: '#ff8a7a', belly: '#ffc9b8', accent: '#5ad0e0', eye: '#fff2a0' },
      features: ['coral', 'rocky'], hero: null },
    drops: { gold: [4, 17], goldChance: 0.75, items: [{ id: 'potion_big', p: 0.1 }, { id: 'shield_charm', p: 0.06 }, { id: 'sea_chowder', p: 0.06 }] },
    boss: null,
  },

  // Boss. A crab captain the size of a rowboat, with a hat. Three phases, shields at 66% and 33% (the Unit 4 questions).
  captain_clawsworth: {
    id: 'captain_clawsworth', name: 'Captain Clawsworth', level: 17, tags: ['boss', 'beast', 'crab'],
    stats: { hp: 6500, power: 23, defense: 4, speed: 2.0, radius: 1.4, xp: 600 },
    flying: false,
    ai: { brain: 'boss', aggro: 14, leash: 24, keepRange: 2.6, summon: { kind: 'pirate_imp', n: 2, max: 4, cd: 14 } },
    attacks: [
      // Phase 1+: cannonballs (circle telegraph under the player), a big claw snap, a bubble volley.
      { id: 'cannon_shot', use: 'ground_target', range: 10, r: 1.7, dmg: 1.2, delay: 1.1, zone: null,
        cd: 3.5, windup: 0.9, telegraph: 'circle', weight: 3 },
      { id: 'claw_snap', use: 'melee_arc', arc: 120, range: 2.6, dmg: 1.5, knockback: 4, cd: 3, windup: 0.9, telegraph: 'cone', weight: 3 },
      { id: 'bubble_volley', use: 'multishot', n: 7, spread: 70, speed: 7, range: 9, dmg: 0.65, radius: 0.3, pierce: false,
        look: proj('orb', '#8fe3ff', '#ffffff', 0.55), cd: 4.5, windup: 0.7, telegraph: 'cone', weight: 2 },
      { id: 'shell_stomp', use: 'aoe_ring', r: 3, dmg: 1.2, knockback: 6, cd: 5.5, windup: 1.0, range: 3, telegraph: 'circle', weight: 2 },
      // Phase 2+: calls his crew and sweeps a water jet across the sandbar.
      { id: 'call_crew', use: 'summon', kind: 'pirate_imp', n: 2, max: 4, cd: 14, windup: 1.2, telegraph: 'circle', weight: 2 },
      { id: 'tidal_sweep', use: 'beam', range: 9, w: 0.9, dmg: 0.5, sweep: 100, dur: 2, tick: 0.25, cd: 10, windup: 1.2,
        telegraph: 'line', weight: 2 },
      // Phase 3: crabs go sideways, fast. Telegraphed rush and a bossy speed buff.
      { id: 'side_rush', use: 'dash', dist: 8, speed: 9, dmg: 1.6, knockback: 7, cd: 8, windup: 1.2, range: 10, minRange: 3,
        telegraph: 'line', weight: 3 },
      { id: 'captains_orders', use: 'buff_self', mods: { speed: 1.25, power: 1.1 }, dur: 20, cd: 25, windup: 0.8, telegraph: null, weight: 1 },
    ],
    onDeath: { spawn: null, n: 0, do: [['cutscene', 'cove_boss_outro']] },
    look: { rig: 'quadruped', size: 2.2, colors: { body: '#e8503c', belly: '#ffd0a0', accent: '#ffcf4a', eye: '#1d1d2a' },
      features: ['claws', 'shell_back'], hero: 'crab_king' },
    drops: { gold: [50, 70], goldChance: 1, items: [] },
    boss: {
      name: 'Captain Clawsworth',
      phases: [
        { untilHp: 0.66, pattern: ['cannon_shot', 'claw_snap', 'bubble_volley', 'claw_snap'], cdMul: 1 },
        { untilHp: 0.33, pattern: ['cannon_shot', 'claw_snap', 'call_crew', 'tidal_sweep', 'shell_stomp'], cdMul: 0.9 },
        { untilHp: 0, pattern: ['side_rush', 'cannon_shot', 'tidal_sweep', 'call_crew', 'bubble_volley', 'captains_orders', 'shell_stomp'], cdMul: 0.8 },
      ],
      shieldAt: [0.66, 0.33],
      shieldDifficulty: 2,
      barks: ['Arr! Mind the hat!', 'Nobody pinches like a Captain!', 'Shiver me shells!'],
    },
  },
};
