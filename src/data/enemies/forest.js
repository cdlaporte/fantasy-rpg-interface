// Whisperwood enemies. Each has its own brain + attack pattern (see docs/notes/narrative.md, "Enemy behaviors").
// Numbers follow the CLASSES.md balance sheet: hp ~ 6 * L^1.4, power ~ 2 + 1.5L, xp 5 + 3L, gold 1..(2 + L).
// Round 2 (playtest: enemies felt spongy, leveling slow): hp x0.6 (rounded), xp +30%, slow chasers (slime, slimelet,
// thornling, boar) +10% speed so they still threaten the faster player. Bats and goblin scouts keep their speed.
import { NPC_LOOKS } from '../looks.js';

const proj = (model, color, glow, size = 0.6) => ({ rig: 'projectile', model, color, glow, size, trail: true });
const zoneLook = (model, color, r) => ({ rig: 'effect', model, color, r });

export default {
  // L3. Wanders lazily; once it notices you it hops in with a short telegraphed bounce. Splits in two on defeat.
  slime: {
    id: 'slime', name: 'Mint Slime', level: 3, tags: ['slime', 'blob'],
    stats: { hp: 17, power: 6.5, defense: 0, speed: 1.98, radius: 0.4, xp: 18 },
    flying: false,
    ai: { brain: 'wander', aggro: 5, leash: 10 },
    attacks: [
      { id: 'hop', use: 'dash', dist: 1.8, speed: 6, dmg: 1, knockback: 2, cd: 1.8, windup: 0.5, range: 2.5, minRange: 0,
        telegraph: 'line', weight: 1 },
    ],
    onDeath: { spawn: 'slime_small', n: 2 },
    look: { rig: 'blob', size: 0.7, colors: { body: '#6fdc8c', belly: '#b6f5c6', accent: '#3fae5f', eye: '#1d3b2a' },
      features: ['drips', 'core_glow'], hero: null },
    drops: { gold: [1, 5], goldChance: 0.6, items: [{ id: 'slime_jelly', p: 0.35 }, { id: 'potion_small', p: 0.05 }] },
    boss: null,
  },
  // Helper kind spawned by `slime`. Small and quick: a nibbling chaser.
  slime_small: {
    id: 'slime_small', name: 'Slimelet', level: 2, tags: ['slime', 'blob', 'helper'],
    stats: { hp: 6, power: 4, defense: 0, speed: 2.86, radius: 0.25, xp: 5 },
    flying: false,
    ai: { brain: 'chaser', aggro: 7, leash: 12 },
    attacks: [
      { id: 'nibble', use: 'melee_arc', arc: 90, range: 0.6, dmg: 1, cd: 1.2, windup: 0.35, telegraph: null, weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'blob', size: 0.4, colors: { body: '#8ef0a8', belly: '#d0ffe0', accent: '#3fae5f', eye: '#1d3b2a' },
      features: ['drips'], hero: null },
    drops: { gold: [0, 1], goldChance: 0.3, items: [{ id: 'slime_jelly', p: 0.1 }] },
    boss: null,
  },

  // L4. Rooted turret: lobs spore clouds (slowing ground zones) at range; puffs you away if you get close.
  sporecap: {
    id: 'sporecap', name: 'Sporecap', level: 4, tags: ['plant', 'mushroom'],
    stats: { hp: 25, power: 8, defense: 1, speed: 0.8, radius: 0.4, xp: 22 },
    flying: false,
    ai: { brain: 'turret', aggro: 7, leash: 9, keepRange: 5 },
    attacks: [
      { id: 'spore_lob', use: 'ground_target', range: 6, r: 1.3, dmg: 0.6, delay: 1.0,
        zone: { dur: 3, tick: 0.5, dmg: 0.25, status: 'slow', look: zoneLook('smoke', '#d9b3ff', 1.3) },
        cd: 3, windup: 0.6, minRange: 1.5, telegraph: 'circle', weight: 3 },
      { id: 'puff', use: 'aoe_ring', r: 1.6, dmg: 0.8, knockback: 4, cd: 4, windup: 0.5, range: 1.5,
        telegraph: 'circle', weight: 2 },
    ],
    onDeath: null,
    look: { rig: 'plant', size: 0.7, colors: { body: '#f4e3c4', belly: '#fff6e0', accent: '#b05ad9', eye: '#2a1840' },
      features: ['cap_mushroom'], hero: null },
    drops: { gold: [1, 6], goldChance: 0.6, items: [{ id: 'glowcap', p: 0.45 }, { id: 'herbal_tea', p: 0.05 }] },
    boss: null,
  },

  // L5. Ambusher: hides as a bush until you are close, then pops up, roots you in place and sprays thorns.
  thornling: {
    id: 'thornling', name: 'Thornling', level: 5, tags: ['plant', 'thorn'],
    stats: { hp: 34, power: 9.5, defense: 1, speed: 2.2, radius: 0.35, xp: 26 },
    flying: false,
    ai: { brain: 'ambusher', aggro: 4, leash: 10, keepRange: 3 },
    attacks: [
      { id: 'thorn_spray', use: 'multishot', n: 3, spread: 30, speed: 7, range: 6, dmg: 0.8, radius: 0.2, pierce: false,
        look: proj('arrow', '#5fb548', '#d8ff9a', 0.45), cd: 2.2, windup: 0.5, telegraph: 'cone', weight: 3 },
      { id: 'root_snare', use: 'ground_target', range: 5, r: 1, dmg: 0.5, delay: 0.9,
        zone: { dur: 1.5, tick: 0.5, dmg: 0.1, status: 'root', look: zoneLook('zone_ring', '#5fb548', 1) },
        cd: 6, windup: 0.6, telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'plant', size: 0.6, colors: { body: '#4fa53c', belly: '#8ad86a', accent: '#ff6b8a', eye: '#ffe14d' },
      features: ['thorns', 'leaves', 'bark_face'], hero: null },
    drops: { gold: [1, 7], goldChance: 0.6, items: [{ id: 'potion_small', p: 0.08 }] },
    boss: null,
  },

  // L5. Swarmer: flies in packs, circles, then swoops in a straight telegraphed line. Fragile.
  bat: {
    id: 'bat', name: 'Hollow Bat', level: 5, tags: ['beast', 'flying'],
    stats: { hp: 27, power: 8.5, defense: 0, speed: 4.2, radius: 0.3, xp: 26 },
    flying: true,
    ai: { brain: 'swarmer', aggro: 7, leash: 14, swarm: 3 },
    attacks: [
      { id: 'swoop', use: 'dash', dist: 3.5, speed: 10, dmg: 1, knockback: 1, cd: 2.6, windup: 0.45, range: 4, minRange: 1.5,
        telegraph: 'line', weight: 3 },
      { id: 'nip', use: 'melee_arc', arc: 60, range: 0.7, dmg: 0.7, cd: 1, windup: 0.3, telegraph: null, weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'flyer', size: 0.55, colors: { body: '#7a5ad9', belly: '#c9b6ff', accent: '#ff9aa8', eye: '#ffe14d' },
      features: ['wings_bat'], hero: null },
    drops: { gold: [1, 7], goldChance: 0.5, items: [{ id: 'cheese', p: 0.05 }] },
    boss: null,
  },

  // L6. Charger: paws the ground (long line telegraph), then barrels through. Gets angry when hurt.
  boar: {
    id: 'boar', name: 'Bristleboar', level: 6, tags: ['beast'],
    stats: { hp: 44, power: 11, defense: 2, speed: 2.86, radius: 0.5, xp: 30 },
    flying: false,
    ai: { brain: 'charger', aggro: 6, leash: 12 },
    attacks: [
      { id: 'gore_charge', use: 'dash', dist: 6, speed: 11, dmg: 1.4, knockback: 6, cd: 4, windup: 1.0, range: 7, minRange: 2,
        telegraph: 'line', weight: 3 },
      { id: 'tusk_toss', use: 'melee_arc', arc: 100, range: 1, dmg: 1, knockback: 3, cd: 1.6, windup: 0.45,
        telegraph: 'cone', weight: 2 },
      { id: 'huff', use: 'buff_self', mods: { speed: 1.3, power: 1.2 }, dur: 6, cd: 15, windup: 0.5, telegraph: null,
        weight: 1, ifHpBelow: 0.5 },
    ],
    onDeath: null,
    look: { rig: 'quadruped', size: 0.95, colors: { body: '#8a5a33', belly: '#c98c50', accent: '#f4ecd8', eye: '#ffdd55' },
      features: ['tusks', 'ears_pointy', 'mane'], hero: null },
    drops: { gold: [2, 8], goldChance: 0.65, items: [{ id: 'bread', p: 0.12 }] },
    boss: null,
  },

  // L7. Skirmisher: keeps 4 tiles away, lobs rocks (arcing), stabs if cornered, runs off when low.
  goblin_scout: {
    id: 'goblin_scout', name: 'Goblin Scout', level: 7, tags: ['goblin', 'humanoid'],
    stats: { hp: 55, power: 12.5, defense: 2, speed: 3.4, radius: 0.35, xp: 34 },
    flying: false,
    ai: { brain: 'skirmisher', aggro: 8, leash: 14, keepRange: 4, fleeHp: 0.2 },
    attacks: [
      { id: 'rock_lob', use: 'projectile', speed: 8, range: 7, dmg: 0.9, radius: 0.25, gravityZ: 1, pierce: false,
        look: proj('rock', '#a6a6b0', null, 0.5), cd: 1.8, windup: 0.5, minRange: 2, telegraph: 'line', weight: 3 },
      { id: 'rock_scatter', use: 'multishot', n: 3, spread: 40, speed: 8, range: 6, dmg: 0.7, radius: 0.22, gravityZ: 1,
        look: proj('rock', '#a6a6b0', null, 0.45), cd: 5, windup: 0.7, minRange: 2, telegraph: 'cone', weight: 1 },
      { id: 'stab', use: 'melee_arc', arc: 70, range: 0.9, dmg: 1.1, cd: 1.2, windup: 0.35, telegraph: null, weight: 2 },
    ],
    onDeath: null,
    look: NPC_LOOKS.goblin,
    drops: { gold: [2, 9], goldChance: 0.7, items: [{ id: 'stolen_textbook', p: 0.35 }, { id: 'smoke_pellet', p: 0.05 }] },
    boss: null,
  },

  // L8. Flee brain: hovers at 5 tiles, blinks away when approached, zaps a telegraphed beam, sometimes a spark ring.
  wisp: {
    id: 'wisp', name: 'Pond Wisp', level: 8, tags: ['spirit', 'flying'],
    stats: { hp: 66, power: 14, defense: 1, speed: 3.0, radius: 0.3, xp: 38 },
    flying: true,
    ai: { brain: 'flee', aggro: 8, leash: 14, keepRange: 5, blinkCd: 3.5 },
    attacks: [
      { id: 'zap', use: 'beam', range: 6, w: 0.3, dmg: 1.2, cd: 3, windup: 0.8, telegraph: 'line', weight: 3 },
      { id: 'skip', use: 'blink', dist: 4, cd: 3.5, windup: 0.3, range: 2.5, telegraph: null, weight: 2 },
      { id: 'spark_ring', use: 'multishot', n: 6, spread: 360, speed: 5, range: 5, dmg: 0.6, radius: 0.2,
        look: proj('spark', '#9fe6ff', '#ffffff', 0.45), cd: 6, windup: 0.7, telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'flyer', size: 0.5, colors: { body: '#9fe6ff', belly: '#ffffff', accent: '#c9a6ff', eye: '#2a3a6a' },
      features: ['wings_fairy', 'glow', 'orb'], hero: null },
    drops: { gold: [3, 10], goldChance: 0.7, items: [{ id: 'potion_small', p: 0.1 }, { id: 'focus_scroll', p: 0.04 }] },
    boss: null,
  },

  // L9. Summoner: slow walking tree. Grows thornlings (max 2), slams roots around itself, flicks seeds.
  treant_sapling: {
    id: 'treant_sapling', name: 'Treant Sapling', level: 9, tags: ['plant', 'treant'],
    stats: { hp: 78, power: 15.5, defense: 3, speed: 1.4, radius: 0.5, xp: 42 },
    flying: false,
    ai: { brain: 'summoner', aggro: 7, leash: 9, keepRange: 3, summon: { kind: 'thornling', n: 1, max: 2, cd: 9 } },
    attacks: [
      { id: 'grow_thornling', use: 'summon', kind: 'thornling', n: 1, max: 2, cd: 9, windup: 1.0, telegraph: 'circle', weight: 2 },
      { id: 'root_slam', use: 'aoe_ring', r: 2, dmg: 1.1, knockback: 4, cd: 3.5, windup: 0.8, range: 1.8,
        telegraph: 'circle', weight: 3 },
      { id: 'seed_flick', use: 'projectile', speed: 7, range: 6, dmg: 0.8, radius: 0.25, pierce: false,
        look: proj('spore', '#c98c50', '#ffe680', 0.5), cd: 2.5, windup: 0.5, minRange: 2, telegraph: 'line', weight: 2 },
    ],
    onDeath: null,
    look: { rig: 'golem', size: 0.9, colors: { body: '#8a5a33', belly: '#c98c50', accent: '#5fb548', eye: '#ffe14d' },
      features: ['wood', 'mossy'], hero: null },
    drops: { gold: [3, 11], goldChance: 0.75, items: [{ id: 'potion_small', p: 0.15 }, { id: 'honey_bun', p: 0.05 }] },
    boss: null,
  },
};
