// Aether Gardens enemies and the finale boss, Malgrim Ascended. Each regular kind has its own brain + attack pattern:
//   star_sprite    swarmer   packs of three, circle, then a twinkling dive (line) and star darts
//   cloud_puffling wander    peaceful drifter; once bumped it bumps back (knockback dash) and puffs a push ring
//   clockwork_owl  turret    perched; fires gears (line), a gear fan (cone), hoots you away up close
//   astral_golem   charger   slow and heavy: comet charge (long line), star slam ring, starfall circles
//   moon_moth      skirmisher keeps 4 tiles away, flutters (blink), sleep-dust clouds (slow zone), a lullaby ring (stun)
// Numbers: the CLASSES.md balance sheet at the def's level (biome middle, 16-18), round 2 adjustments (hp x0.6,
// xp +30%; docs/notes/r2c.md). Biome spawns rescale to the player's level (world.js spawnFrom, levelRange [15, 20]).
//   L17: hp 6 * 17^1.4 * 0.6 = 190, power 2 + 1.5 * 17 = 27.5, xp (5 + 3 * 17) * 1.3 = 73, gold 1..19.
// star_hexguard is only summoned by Malgrim (a level-17 hexguard that actually chases, unlike the ambush guards).
import { NPC_LOOKS, MALGRIM_LOOK, humanoid } from '../../looks.js';

const proj = (model, color, glow, size = 0.6) => ({ rig: 'projectile', model, color, glow, size, trail: true });
const zoneLook = (model, color, r) => ({ rig: 'effect', model, color, r });

// Malgrim, ascended: the same pompous wizard, 1.6x the size, crackling with a purple star-storm.
const ASCENDED_LOOK = Object.assign({}, MALGRIM_LOOK, {
  size: 1.6,
  outfit: { style: 'robe', primary: '#4a2a96', secondary: '#1e1440', accent: '#ffe680' },
  cape: { color: '#9a3fd0' },
  held: { style: 'staff', color: '#2a1840', glow: '#ffe680' },
  aura: { style: 'storm', color: '#c86bff' },
  hero: 'malgrim',
});
// Hexguards called down from the stars: the ambush armour with gold trim and a starry glow.
const STAR_HEXGUARD_LOOK = humanoid(Object.assign({}, NPC_LOOKS.hexguard, {
  outfit: { style: 'plate', primary: '#5a4fa8', secondary: '#2a1840', accent: '#ffe680' },
  held: { style: 'sword_shield', color: '#fff2a0', glow: '#ffe680' },
}));

export default {
  // L17 swarmer. Fragile, fast, always in threes: circles you, then dives in a straight line or flicks star darts.
  star_sprite: {
    id: 'star_sprite', name: 'Star Sprite', level: 17, tags: ['spirit', 'flying', 'star'],
    stats: { hp: 150, power: 26, defense: 0, speed: 4.4, radius: 0.3, xp: 66 },
    flying: true,
    ai: { brain: 'swarmer', aggro: 8, leash: 14, swarm: 3 },
    attacks: [
      { id: 'twinkle_dive', use: 'dash', dist: 3.5, speed: 11, dmg: 0.9, knockback: 1, cd: 2.8, windup: 0.45, range: 4, minRange: 1.5,
        telegraph: 'line', weight: 3 },
      { id: 'star_dart', use: 'projectile', speed: 9, range: 6, dmg: 0.6, radius: 0.2, pierce: false,
        look: proj('spark', '#fff2a0', '#ffffff', 0.45), cd: 2.2, windup: 0.4, minRange: 1.5, telegraph: 'line', weight: 2 },
    ],
    onDeath: null,
    look: { rig: 'flyer', size: 0.5, colors: { body: '#fff2a0', belly: '#ffffff', accent: '#c9a6ff', eye: '#3d3a8c' },
      features: ['wings_fairy', 'glow'], hero: null },
    drops: { gold: [2, 14], goldChance: 0.6, items: [{ id: 'comet_candy', p: 0.06 }, { id: 'potion_small', p: 0.08 }] },
    boss: null,
  },

  // L17 wanderer. A grumpy little cloud that drifts about minding its business. Bump it and it bumps back, hard.
  cloud_puffling: {
    id: 'cloud_puffling', name: 'Cloud Puffling', level: 17, tags: ['cloud', 'blob'],
    stats: { hp: 230, power: 24, defense: 1, speed: 2.4, radius: 0.5, xp: 75 },
    flying: false,
    ai: { brain: 'wander', aggro: 5, leash: 10 },
    attacks: [
      { id: 'bump', use: 'dash', dist: 2.6, speed: 8, dmg: 0.9, knockback: 7, cd: 2.2, windup: 0.55, range: 3, minRange: 0,
        telegraph: 'line', weight: 3 },
      { id: 'puff', use: 'aoe_ring', r: 2, dmg: 0.7, knockback: 6, cd: 4.5, windup: 0.6, range: 1.8, telegraph: 'circle', weight: 2 },
    ],
    onDeath: null,
    look: { rig: 'blob', size: 0.85, colors: { body: '#ffffff', belly: '#e6f0ff', accent: '#9fd8ff', eye: '#3d5aa8' },
      features: ['bubbles', 'core_glow'], hero: null },
    drops: { gold: [2, 15], goldChance: 0.6, items: [{ id: 'moon_tea', p: 0.08 }] },
    boss: null,
  },

  // L17 turret. Brass owl on a perch: gear shots in a line, a fan of gears, and a HOOT that knocks you away.
  // Owls "file" Celeste's star charts (quest aether_star_charts).
  clockwork_owl: {
    id: 'clockwork_owl', name: 'Clockwork Owl', level: 17, tags: ['construct', 'flying', 'owl'],
    stats: { hp: 170, power: 27, defense: 2, speed: 0.8, radius: 0.35, xp: 73 },
    flying: true,
    ai: { brain: 'turret', aggro: 8, leash: 9, keepRange: 6 },
    attacks: [
      { id: 'gear_shot', use: 'projectile', speed: 9, range: 8, dmg: 0.9, radius: 0.25, pierce: false,
        look: proj('shuriken', '#e0b850', '#fff2a0', 0.55), cd: 1.8, windup: 0.5, minRange: 1.5, telegraph: 'line', weight: 3 },
      { id: 'gear_fan', use: 'multishot', n: 5, spread: 60, speed: 8, range: 7, dmg: 0.6, radius: 0.22,
        look: proj('shuriken', '#e0b850', '#fff2a0', 0.45), cd: 5, windup: 0.8, minRange: 1.5, telegraph: 'cone', weight: 2 },
      { id: 'hoot', use: 'aoe_ring', r: 1.8, dmg: 0.7, knockback: 6, cd: 4, windup: 0.5, range: 1.6, telegraph: 'circle', weight: 2 },
    ],
    onDeath: null,
    look: { rig: 'flyer', size: 0.6, colors: { body: '#c8a060', belly: '#f4e3c4', accent: '#e0b850', eye: '#7fd6ff' },
      features: ['wings_bird', 'orb'], hero: null },
    drops: { gold: [3, 16], goldChance: 0.65, items: [{ id: 'star_chart', p: 0.55 }, { id: 'potion_small', p: 0.06 }] },
    boss: null,
  },

  // L18 heavy charger (a small elite: x1.8 hp, x2 xp). Paws the starry floor before a long comet charge.
  astral_golem: {
    id: 'astral_golem', name: 'Astral Golem', level: 18, tags: ['construct', 'golem'],
    stats: { hp: 370, power: 29, defense: 4, speed: 1.9, radius: 0.6, xp: 150 },
    flying: false,
    ai: { brain: 'charger', aggro: 7, leash: 12 },
    attacks: [
      { id: 'comet_charge', use: 'dash', dist: 6, speed: 10, dmg: 1.4, knockback: 7, cd: 5, windup: 1.0, range: 7, minRange: 2.5,
        telegraph: 'line', weight: 3 },
      { id: 'star_slam', use: 'aoe_ring', r: 2.4, dmg: 1.2, knockback: 5, cd: 3.5, windup: 0.8, range: 2, telegraph: 'circle', weight: 3 },
      { id: 'starfall', use: 'ground_target', range: 7, r: 1.4, dmg: 1.0, delay: 1.0, zone: null,
        cd: 6, windup: 0.7, minRange: 2, telegraph: 'circle', weight: 2 },
    ],
    onDeath: null,
    look: { rig: 'golem', size: 1.15, colors: { body: '#5a4fa8', belly: '#8f88b8', accent: '#ffe680', eye: '#9fe6ff' },
      features: ['starry', 'crystal'], hero: null },
    drops: { gold: [5, 22], goldChance: 0.8, items: [{ id: 'potion_big', p: 0.12 }, { id: 'star_chart', p: 0.15 }] },
    boss: null,
  },

  // L16 skirmisher. Flutters 4 tiles away, blinks off when chased, sprinkles sleep dust (a slowing cloud) and hums
  // a lullaby ring that makes you nod off for a moment (stun) if you stand right under it.
  moon_moth: {
    id: 'moon_moth', name: 'Moon Moth', level: 16, tags: ['beast', 'flying', 'moth'],
    stats: { hp: 150, power: 25, defense: 1, speed: 3.2, radius: 0.35, xp: 69 },
    flying: true,
    ai: { brain: 'skirmisher', aggro: 8, leash: 13, keepRange: 4, blinkCd: 4 },
    attacks: [
      { id: 'sleep_dust', use: 'ground_target', range: 6, r: 1.5, dmg: 0.4, delay: 1.0,
        zone: { dur: 3, tick: 0.5, dmg: 0.15, status: { slow: [1, 0.6] }, look: zoneLook('smoke', '#c9b6ff', 1.5) },
        cd: 3.5, windup: 0.6, minRange: 1.5, telegraph: 'circle', weight: 3 },
      { id: 'lullaby', use: 'aoe_ring', r: 1.8, dmg: 0.5, knockback: 2, status: { stun: 0.8 }, cd: 6, windup: 0.8, range: 1.8,
        telegraph: 'circle', weight: 2 },
      { id: 'flutter', use: 'blink', dist: 3.5, cd: 4, windup: 0.3, range: 2.5, telegraph: null, weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'flyer', size: 0.6, colors: { body: '#e8e0ff', belly: '#bfa8ff', accent: '#7fd6ff', eye: '#3d3a8c' },
      features: ['wings_insect', 'glow'], hero: null },
    drops: { gold: [2, 14], goldChance: 0.6, items: [{ id: 'moon_tea', p: 0.12 }] },
    boss: null,
  },

  // Summoned by Malgrim Ascended in phase 2 (tag malgrim_minion). Chases, slashes, rushes with the shield.
  star_hexguard: {
    id: 'star_hexguard', name: 'Star Hexguard', level: 17, tags: ['construct', 'hexguard', 'minion'],
    stats: { hp: 150, power: 24, defense: 2, speed: 3.0, radius: 0.38, xp: 30 },
    flying: false,
    ai: { brain: 'chaser', aggro: 14, leash: 24 },
    attacks: [
      { id: 'hex_slash', use: 'melee_arc', arc: 100, range: 1.1, dmg: 0.8, cd: 1.8, windup: 0.5, telegraph: 'cone', weight: 3 },
      { id: 'shield_rush', use: 'dash', dist: 3, speed: 9, dmg: 0.7, knockback: 4, cd: 5, windup: 0.7, range: 3.5, minRange: 1.2,
        telegraph: 'line', weight: 1 },
    ],
    onDeath: null,
    look: STAR_HEXGUARD_LOOK,
    drops: { gold: [0, 4], goldChance: 0.3, items: [] },
    boss: null,
  },

  // The finale. Malgrim the Sealweaver was behind every seal on every gate; from the highest island he means to seal
  // the Academy itself. Three phases (hp 66% / 33%, each guarded by a question shield):
  //   1 homing hex bolts, seal bursts under you, a pushing star barrier around him (half damage inside), a flourish blink
  //   2 + hexguards from the stars, a sweeping star beam
  //   3 + star sprites, the grand hex ring, a starfall ring of sparks, and "theatrics" (a power buff)
  // hp tuned so a level-20 player with both classmates wins in about 2-3 minutes (docs/notes/r3-aether.md).
  malgrim_ascended: {
    id: 'malgrim_ascended', name: 'Malgrim Ascended', level: 20, tags: ['boss', 'villain', 'story'],
    stats: { hp: 7000, power: 26, defense: 4, speed: 2.8, radius: 0.9, xp: 1000 },
    flying: false,
    ai: { brain: 'boss', aggro: 16, leash: 24, keepRange: 4.5, blinkCd: 7 },
    attacks: [
      { id: 'hex_bolt', use: 'projectile', speed: 8, range: 10, dmg: 0.55, radius: 0.3, homing: 0.35, pierce: false,
        look: proj('orb', '#c86bff', '#ffffff', 0.7), cd: 2.2, windup: 0.5, telegraph: 'line', weight: 3 },
      { id: 'seal_burst', use: 'ground_target', range: 10, r: 1.8, dmg: 1.2, delay: 1.1, zone: null,
        cd: 4, windup: 0.8, telegraph: 'circle', weight: 3 },
      { id: 'star_barrier', use: 'zone', follow: true, bubble: true, r: 2.4, dur: 4, tick: 0.25, dmg: 0.03, push: 5,
        allyMod: { dmgTaken: -0.5 }, look: { rig: 'effect', model: 'shield_bubble', color: '#c9a6ff', r: 2.4 },
        cd: 12, windup: 0.6, range: 12, telegraph: 'circle', weight: 2 },
      { id: 'flourish', use: 'blink', dist: 4, cd: 6, windup: 0.3, range: 2.5, telegraph: null, weight: 1 },
      { id: 'summon_hexguards', use: 'summon', kind: 'star_hexguard', n: 2, max: 3, opts: { tag: 'malgrim_minion', level: 15 },
        cd: 16, windup: 1.2, range: 12, telegraph: 'circle', color: '#c86bff', weight: 2 },
      { id: 'star_beam', use: 'beam', range: 11, w: 0.8, dmg: 0.55, sweep: 110, dur: 2.2, tick: 0.25,
        cd: 9, windup: 1.2, telegraph: 'line', weight: 2 },
      { id: 'summon_sprites', use: 'summon', kind: 'star_sprite', n: 2, max: 3, opts: { tag: 'malgrim_minion', level: 15 },
        cd: 18, windup: 1.2, range: 12, telegraph: 'circle', color: '#ffe680', weight: 2 },
      { id: 'grand_hex', use: 'aoe_ring', r: 3.5, dmg: 1.2, knockback: 6, cd: 8, windup: 1.4, range: 3.5,
        telegraph: 'circle', weight: 2 },
      { id: 'starfall', use: 'multishot', n: 10, ring: true, speed: 6, range: 8, dmg: 0.6, radius: 0.25, pierce: false,
        look: proj('spark', '#ffe680', '#ffffff', 0.55), cd: 7, windup: 0.9, telegraph: 'circle', weight: 2 },
      { id: 'theatrics', use: 'buff_self', mods: { power: 0.2 }, dur: 20, cd: 25, windup: 0.6, telegraph: null, weight: 1 },
    ],
    onDeath: { spawn: null, n: 0, do: [['cutscene', 'aether_boss_outro']] },
    look: ASCENDED_LOOK,
    drops: { gold: [60, 90], goldChance: 1, items: [] },
    boss: {
      name: 'Malgrim Ascended',
      phases: [
        { untilHp: 0.66, pattern: ['hex_bolt', 'seal_burst', 'star_barrier', 'hex_bolt', 'flourish'], cdMul: 1 },
        { untilHp: 0.33, pattern: ['summon_hexguards', 'star_beam', 'hex_bolt', 'seal_burst', 'star_barrier'], cdMul: 0.9 },
        { untilHp: 0, pattern: ['summon_sprites', 'grand_hex', 'starfall', 'star_beam', 'seal_burst', 'theatrics', 'hex_bolt'],
          cdMul: 0.8 },
      ],
      shieldAt: [0.66, 0.33],
      shieldDifficulty: 2,
      barks: ['Forty-one layers! I took NOTES this time!', 'Behold my ASCENDED form!', 'Sealer of weaves! Weaver of... you know.'],
    },
  },
};
