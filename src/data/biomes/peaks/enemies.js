// Frostwhistle Peaks enemies + the boss Grumbleflake. Numbers follow the CLASSES.md sheet at the level each def is
// designed for (hp 6 L^1.4 x 0.6 per round 2, power 2 + 1.5 L, xp 5 + 3 L); spawns rescale them to the player
// (zone scaleToPlayer, levelRange [13, 19]). Roles scale the hp: bunny 0.55x, sprite 0.75x, cub 1x, penguin 1.1x, golem 1.5x.
// Behaviours (one brain each): snow_bunny swarmer, frost_sprite flee (ranged), yeti_cub charger,
// penguin_knight skirmisher (spear), ice_golem ambusher (pretends to be an ice spire), grumbleflake boss.
import { humanoid } from '../../looks.js';

const proj = (model, color, glow, size = 0.6) => ({ rig: 'projectile', model, color, glow, size, trail: true });
const zoneLook = (model, color, r) => ({ rig: 'effect', model, color, r });
const fit = (style, primary, secondary, accent) => ({ style, primary, secondary, accent });

const PENGUIN_LOOK = humanoid({
  build: 'a', size: 0.9, skin: '#2b3550', hair: { style: 'bald', color: '#2b3550' },
  outfit: fit('plate', '#dfe9f5', '#2b3550', '#ffb347'), hat: { style: 'helm', color: '#c0c4cc' },
  held: { style: 'spear', color: '#8fb8d8', glow: '#bfeaff' },
});

export default {
  // L13. Swarmer: packs of four circle you, then hop in on a telegraphed line and thump the ground. Fragile and quick.
  // They line their burrows with lost mittens (quest item).
  snow_bunny: {
    id: 'snow_bunny', name: 'Snow Bunny', level: 13, tags: ['beast'],
    stats: { hp: 72, power: 21.5, defense: 0, speed: 4.4, radius: 0.3, xp: 44 },
    flying: false,
    ai: { brain: 'swarmer', aggro: 8, leash: 14, swarm: 4 },
    attacks: [
      { id: 'hop', use: 'dash', dist: 3, speed: 11, dmg: 0.9, knockback: 1, cd: 2.4, windup: 0.4, range: 4, minRange: 1.2,
        telegraph: 'line', weight: 3 },
      { id: 'thump', use: 'aoe_ring', r: 1.3, dmg: 0.7, knockback: 3, cd: 3.5, windup: 0.45, range: 1.3,
        telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'quadruped', size: 0.55, colors: { body: '#ffffff', belly: '#eaf4ff', accent: '#ffb3c6', eye: '#2a3a6a' },
      features: ['long_ears', 'tail_bushy'], hero: null },
    drops: { gold: [2, 10], goldChance: 0.55, items: [{ id: 'lost_mitten', p: 0.45 }, { id: 'frost_cocoa', p: 0.04 }] },
    boss: null,
  },

  // L14. Flee brain: hovers at 5-6 tiles, blinks away when approached, fires ice shards and a shard fan, drops frost patches.
  frost_sprite: {
    id: 'frost_sprite', name: 'Frost Sprite', level: 14, tags: ['spirit', 'flying'],
    stats: { hp: 108, power: 23, defense: 0, speed: 3.2, radius: 0.3, xp: 47 },
    flying: true,
    ai: { brain: 'flee', aggro: 9, leash: 14, keepRange: 5.5, blinkCd: 4 },
    attacks: [
      { id: 'ice_shard', use: 'projectile', speed: 9, range: 8, dmg: 1.0, radius: 0.22, pierce: false,
        look: proj('ice', '#bfeaff', '#ffffff', 0.55), cd: 2.4, windup: 0.5, minRange: 2, telegraph: 'line', weight: 3 },
      { id: 'shard_fan', use: 'multishot', n: 5, spread: 50, speed: 8, range: 7, dmg: 0.6, radius: 0.2, pierce: false,
        look: proj('ice', '#9fe6ff', '#ffffff', 0.45), cd: 6, windup: 0.7, minRange: 2, telegraph: 'cone', weight: 1 },
      { id: 'frost_patch', use: 'ground_target', range: 6, r: 1.5, dmg: 0.5, delay: 0.9,
        zone: { dur: 3, tick: 0.5, dmg: 0.2, status: 'slow', look: zoneLook('ground_frost', '#9fe6ff', 1.5) },
        cd: 7, windup: 0.7, minRange: 2, telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'flyer', size: 0.5, colors: { body: '#bfeaff', belly: '#ffffff', accent: '#7fd6ff', eye: '#2a3a6a' },
      features: ['wings_fairy', 'glow'], hero: null },
    drops: { gold: [3, 14], goldChance: 0.65, items: [{ id: 'potion_small', p: 0.1 }, { id: 'icicle_bomb', p: 0.06 }] },
    boss: null,
  },

  // L15. Charger: rolls a big snowball at you from range, then tumbles in on a telegraphed line. Gets grumpy when hurt.
  yeti_cub: {
    id: 'yeti_cub', name: 'Yeti Cub', level: 15, tags: ['beast', 'yeti'],
    stats: { hp: 160, power: 24.5, defense: 1, speed: 2.7, radius: 0.5, xp: 50 },
    flying: false,
    ai: { brain: 'charger', aggro: 7, leash: 12 },
    attacks: [
      { id: 'snowball', use: 'projectile', speed: 5.5, range: 9, dmg: 1.0, radius: 0.45, pierce: false,
        look: proj('orb', '#ffffff', '#dff3ff', 0.95), cd: 3.5, windup: 0.8, minRange: 2.5, telegraph: 'line', weight: 3 },
      { id: 'tumble', use: 'dash', dist: 5.5, speed: 10, dmg: 1.3, knockback: 5, cd: 5.5, windup: 1.0, range: 6.5, minRange: 2,
        telegraph: 'line', weight: 2 },
      { id: 'swat', use: 'melee_arc', arc: 100, range: 1.1, dmg: 1.0, knockback: 3, cd: 1.7, windup: 0.5, telegraph: 'cone', weight: 2 },
      { id: 'grumble', use: 'buff_self', mods: { speed: 1.25, power: 1.15 }, dur: 6, cd: 14, windup: 0.6, telegraph: null,
        weight: 1, ifHpBelow: 0.5 },
    ],
    onDeath: null,
    look: { rig: 'quadruped', size: 0.85, colors: { body: '#f4f8ff', belly: '#ffffff', accent: '#9fc8ff', eye: '#2a3a6a' },
      features: ['mane', 'tail_bushy', 'ears_round'], hero: null },
    drops: { gold: [4, 16], goldChance: 0.7, items: [{ id: 'bread', p: 0.1 }, { id: 'frost_cocoa', p: 0.08 }] },
    boss: null,
  },

  // L16. Skirmisher in plate: keeps a spear's length away, jabs, belly-slides in on a line, and braces behind its shield.
  penguin_knight: {
    id: 'penguin_knight', name: 'Penguin Knight', level: 16, tags: ['humanoid', 'knight'],
    stats: { hp: 192, power: 26, defense: 4, speed: 3.0, radius: 0.4, xp: 53 },
    flying: false,
    ai: { brain: 'skirmisher', aggro: 8, leash: 13, keepRange: 2.6 },
    attacks: [
      { id: 'spear_thrust', use: 'melee_arc', arc: 40, range: 2.2, dmg: 1.1, knockback: 2, cd: 1.6, windup: 0.5, telegraph: 'cone', weight: 3 },
      { id: 'belly_slide', use: 'dash', dist: 4.5, speed: 9, dmg: 1.0, knockback: 4, cd: 6, windup: 0.7, range: 5.5, minRange: 2.4,
        telegraph: 'line', weight: 2 },
      { id: 'shield_up', use: 'buff_self', mods: { dmgTaken: -0.5 }, dur: 3, cd: 10, windup: 0.5, telegraph: null, weight: 1, fx: 'sparkle', color: '#bfeaff' },
    ],
    onDeath: null,
    look: PENGUIN_LOOK,
    drops: { gold: [5, 18], goldChance: 0.75, items: [{ id: 'potion_small', p: 0.15 }, { id: 'shield_charm', p: 0.05 }] },
    boss: null,
  },

  // L17. Ambusher: stands very still among the ice spires (a ghostly ice pillar) until you come close, then wakes up,
  // slams rings of ice, freezes the ground and bursts shards in all directions. Slow, tough.
  ice_golem: {
    id: 'ice_golem', name: 'Ice Golem', level: 17, tags: ['golem', 'ice'],
    stats: { hp: 270, power: 27.5, defense: 6, speed: 1.6, radius: 0.6, xp: 56 },
    flying: false,
    ai: { brain: 'ambusher', aggro: 4, leash: 10, keepRange: 2.5 },
    attacks: [
      { id: 'ice_slam', use: 'aoe_ring', r: 2.2, dmg: 1.2, knockback: 5, cd: 3.5, windup: 0.9, range: 2, telegraph: 'circle', weight: 3 },
      { id: 'frost_stomp', use: 'ground_target', range: 6, r: 1.5, dmg: 0.9, delay: 1.0,
        zone: { dur: 3, tick: 0.5, dmg: 0.2, status: 'slow', look: zoneLook('ground_frost', '#9fe6ff', 1.5) },
        cd: 6, windup: 0.8, minRange: 2, telegraph: 'circle', weight: 2 },
      { id: 'shard_burst', use: 'multishot', n: 8, spread: 360, speed: 6, range: 5, dmg: 0.5, radius: 0.22,
        look: proj('ice', '#9fe6ff', '#ffffff', 0.5), cd: 7, windup: 0.8, telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'golem', size: 1.0, colors: { body: '#bfe4ff', belly: '#e6f6ff', accent: '#7fd6ff', eye: '#2a5a9a' },
      features: ['icy', 'crystal'], hero: null },
    drops: { gold: [6, 20], goldChance: 0.8, items: [{ id: 'icicle_bomb', p: 0.15 }, { id: 'potion_small', p: 0.15 }, { id: 'frost_cocoa', p: 0.08 }] },
    boss: null,
  },
  // Boss L16 (spawns at player level + 1). The grumpy yeti of the summit: his paws are cold and nobody knits for yetis.
  // P1 icicle rain / ground pound / snowball volley; P2 + stampede of snow bunnies + sweeping blizzard; P3 + charge,
  // leap and a grumpy speed buff. Shields (the Unit 4 questions) at 66% and 33%.
  grumbleflake: {
    id: 'grumbleflake', name: 'Grumbleflake', level: 16, tags: ['boss', 'beast', 'yeti'],
    stats: { hp: 5800, power: 26, defense: 4, speed: 2.2, radius: 1.4, xp: 520 },
    flying: false,
    ai: { brain: 'boss', aggro: 14, leash: 22, keepRange: 2.5, summon: { kind: 'snow_bunny', n: 2, max: 4, cd: 14 } },
    attacks: [
      { id: 'icicle_rain', use: 'ground_target', range: 9, r: 1.6, dmg: 1.2, delay: 1.1,
        zone: { dur: 3, tick: 0.5, dmg: 0.2, status: 'slow', look: zoneLook('ground_frost', '#9fe6ff', 1.6) },
        cd: 3, windup: 0.9, telegraph: 'circle', weight: 3 },
      { id: 'ground_pound', use: 'aoe_ring', r: 3.4, dmg: 1.3, knockback: 6, cd: 5, windup: 1.1, range: 3.2, telegraph: 'circle', weight: 2 },
      { id: 'snowball_volley', use: 'multishot', n: 5, spread: 60, speed: 7, range: 9, dmg: 0.8, radius: 0.35, pierce: false,
        look: proj('orb', '#ffffff', '#dff3ff', 0.9), cd: 4, windup: 0.8, telegraph: 'cone', weight: 2 },
      { id: 'bunny_stampede', use: 'summon', kind: 'snow_bunny', n: 2, max: 4, cd: 14, windup: 1.2, telegraph: 'circle', color: '#ffffff', weight: 2 },
      { id: 'blizzard', use: 'beam', range: 9, w: 0.9, dmg: 0.5, sweep: 110, dur: 2.2, tick: 0.25, cd: 10, windup: 1.2,
        telegraph: 'line', weight: 2 },
      { id: 'avalanche_charge', use: 'dash', dist: 8, speed: 9, dmg: 1.5, knockback: 7, cd: 8, windup: 1.2, range: 10, minRange: 3,
        telegraph: 'line', weight: 3 },
      { id: 'yeti_leap', use: 'leap', dist: 6, dur: 0.7, height: 2.2, land: { r: 3, dmg: 1.4, knockback: 7, shake: 0.4 },
        cd: 9, windup: 1.0, range: 8, minRange: 3, telegraph: 'line', weight: 2 },
      { id: 'grumpy', use: 'buff_self', mods: { speed: 1.25, power: 1.1 }, dur: 20, cd: 25, windup: 0.8, telegraph: null, weight: 1 },
    ],
    onDeath: { spawn: null, n: 0, do: [['cutscene', 'peaks_boss_outro']] },
    look: { rig: 'golem', size: 2.4, colors: { body: '#f4f8ff', belly: '#ffffff', accent: '#7fd6ff', eye: '#ffe14d' },
      features: ['icy'], hero: 'yeti' },
    drops: { gold: [100, 140], goldChance: 1, items: [] },
    boss: {
      name: 'Grumbleflake',
      phases: [
        { untilHp: 0.66, pattern: ['icicle_rain', 'ground_pound', 'snowball_volley'], cdMul: 1 },
        { untilHp: 0.33, pattern: ['icicle_rain', 'ground_pound', 'bunny_stampede', 'blizzard'], cdMul: 0.9 },
        { untilHp: 0, pattern: ['avalanche_charge', 'icicle_rain', 'blizzard', 'yeti_leap', 'snowball_volley', 'grumpy'], cdMul: 0.8 },
      ],
      shieldAt: [0.66, 0.33],
      shieldDifficulty: 2,
      barks: ['MY FLUFF! YOU RUINED MY FLUFF!', 'I AM NOT GRUMPY. I AM... SEASONAL.', 'IT IS SO COLD... IN MY PAWS.'],
    },
  },
};
