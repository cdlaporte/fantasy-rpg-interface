// Sunscorch Dunes enemies and the boss. Each has its own brain + attack pattern (docs/notes/narrative.md).
// Numbers: CLASSES balance sheet at the def's level, round 2 trims (hp x0.6, xp +30%): hp ~ 3.6 * L^1.4,
// power 2 + 1.5L, xp (5 + 3L) * 1.3, gold 1..(2 + L). The zone scales every spawn to the player (levelRange [10, 16]),
// so each def is authored at its own level and rescaled along the same curves.
//   scarab L10 swarmer (packs, skitter dash + shell bump)      dust_devil L11 skirmisher (flyer, dash / gust / slowing dust)
//   cactling L12 turret (needle fans, snipe, prickle burst)    sand_scorpion L13 charger (pounce, claws, poison sting zone)
//   sandstone_golem L14 ambusher (rubble that rises, slow ground slams)    sultana_sandsnout L16 boss
const proj = (model, color, glow, size = 0.6) => ({ rig: 'projectile', model, color, glow, size, trail: true });
const zoneLook = (model, color, r) => ({ rig: 'effect', model, color, r });

export default {
  // L10. Small shiny beetles that scuttle in packs of four: a short telegraphed skitter, a shell bump when you are close.
  scarab: {
    id: 'scarab', name: 'Dune Scarab', level: 10, tags: ['beast', 'insect'],
    stats: { hp: 68, power: 15.5, defense: 0, speed: 3.3, radius: 0.3, xp: 40 },
    flying: false,
    ai: { brain: 'swarmer', aggro: 7, leash: 12, swarm: 4 },
    attacks: [
      { id: 'skitter', use: 'dash', dist: 2.8, speed: 8.5, dmg: 0.9, knockback: 1, cd: 2.4, windup: 0.4, range: 3.6, minRange: 1,
        telegraph: 'line', weight: 3 },
      { id: 'shell_bump', use: 'aoe_ring', r: 1.2, dmg: 0.6, knockback: 3, cd: 3.5, windup: 0.45, range: 1.2,
        telegraph: 'circle', weight: 2 },
    ],
    onDeath: null,
    look: { rig: 'quadruped', size: 0.55, colors: { body: '#2f8f86', belly: '#f0c050', accent: '#ffd24a', eye: '#1d2a3a' },
      features: ['shell_back', 'claws'], hero: null },
    drops: { gold: [1, 10], goldChance: 0.5, items: [{ id: 'cactus_water', p: 0.1 }, { id: 'bread', p: 0.06 }] },
    boss: null,
  },

  // L11. Flying whirlwind. Keeps its distance, then whips straight through you (long line telegraph); a gust ring if you
  // crowd it and slowing dust clouds on the ground.
  dust_devil: {
    id: 'dust_devil', name: 'Dust Devil', level: 11, tags: ['spirit', 'flying', 'wind'],
    stats: { hp: 83, power: 17, defense: 0, speed: 3.6, radius: 0.4, xp: 49 },
    flying: true,
    ai: { brain: 'skirmisher', aggro: 8, leash: 14, keepRange: 3.5 },
    attacks: [
      { id: 'whirl_dash', use: 'dash', dist: 5.5, speed: 10, dmg: 1, knockback: 4, cd: 3.5, windup: 0.6, range: 6.5, minRange: 1.5,
        telegraph: 'line', weight: 3 },
      { id: 'gust', use: 'aoe_ring', r: 2, dmg: 0.8, knockback: 5, cd: 5, windup: 0.6, range: 1.8, telegraph: 'circle', weight: 2 },
      { id: 'dust_cloud', use: 'ground_target', range: 6, r: 1.4, dmg: 0.4, delay: 0.9,
        zone: { dur: 3, tick: 0.5, dmg: 0.2, status: 'slow', look: zoneLook('smoke', '#e8c070', 1.4) },
        cd: 6, windup: 0.6, minRange: 2, telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'flyer', size: 0.75, colors: { body: '#e8c98a', belly: '#fff0c8', accent: '#c89850', eye: '#5a3a1a' },
      features: ['orb', 'glow'], hero: null },
    drops: { gold: [2, 11], goldChance: 0.6, items: [{ id: 'sand_veil', p: 0.1 }, { id: 'speed_tonic', p: 0.05 }] },
    boss: null,
  },

  // L12. Rooted turret: a fan of needles, a single sniping needle, and a prickly burst if you get close. Never moves.
  cactling: {
    id: 'cactling', name: 'Cactling', level: 12, tags: ['plant', 'cactus'],
    stats: { hp: 105, power: 20, defense: 2, speed: 0.9, radius: 0.4, xp: 53 },
    flying: false,
    ai: { brain: 'turret', aggro: 8, leash: 9, keepRange: 5 },
    attacks: [
      { id: 'needle_volley', use: 'multishot', n: 5, spread: 50, speed: 8, range: 7, dmg: 0.6, radius: 0.2, pierce: false,
        look: proj('arrow', '#7fd16a', '#e8ffa0', 0.45), cd: 3, windup: 0.6, telegraph: 'cone', weight: 3 },
      { id: 'needle_snipe', use: 'projectile', speed: 11, range: 9, dmg: 1, radius: 0.2, pierce: false,
        look: proj('arrow', '#5fb548', '#fff2a0', 0.55), cd: 4.5, windup: 0.9, minRange: 2.5, telegraph: 'line', weight: 2 },
      { id: 'prickle_burst', use: 'aoe_ring', r: 1.7, dmg: 0.9, knockback: 4, cd: 4, windup: 0.5, range: 1.6,
        telegraph: 'circle', weight: 2 },
    ],
    onDeath: null,
    look: { rig: 'plant', size: 0.75, colors: { body: '#4caf5a', belly: '#9bdc7a', accent: '#ff7aa8', eye: '#2a1a30' },
      features: ['cactus', 'bark_face'], hero: null },
    drops: { gold: [2, 12], goldChance: 0.6, items: [{ id: 'cactus_water', p: 0.3 }, { id: 'potion_small', p: 0.08 }] },
    boss: null,
  },

  // L13. Charger: raises its tail, then barrels through in a straight line. Claws up close, and its sting lands a lingering
  // poison puddle under your feet.
  sand_scorpion: {
    id: 'sand_scorpion', name: 'Sand Scorpion', level: 13, tags: ['beast', 'scorpion'],
    stats: { hp: 131, power: 22, defense: 2, speed: 3.0, radius: 0.55, xp: 57 },
    flying: false,
    ai: { brain: 'charger', aggro: 7, leash: 12 },
    attacks: [
      { id: 'pounce', use: 'dash', dist: 5.5, speed: 11, dmg: 1.3, knockback: 4, cd: 4.5, windup: 0.9, range: 7, minRange: 2,
        telegraph: 'line', weight: 3 },
      { id: 'claw_snap', use: 'melee_arc', arc: 100, range: 1.1, dmg: 1, knockback: 2, cd: 1.6, windup: 0.45, telegraph: 'cone', weight: 2 },
      { id: 'venom_sting', use: 'ground_target', range: 5, r: 1.2, dmg: 0.5, delay: 0.9,
        zone: { dur: 4, tick: 0.5, dmg: 0.25, status: 'venom', look: zoneLook('smoke', '#9acd32', 1.2) },
        cd: 7, windup: 0.7, minRange: 1.5, telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'quadruped', size: 0.95, colors: { body: '#c8793a', belly: '#f0c98a', accent: '#8a3a1a', eye: '#2a1010' },
      features: ['stinger', 'claws'], hero: null },
    drops: { gold: [2, 13], goldChance: 0.65, items: [{ id: 'herbal_tea', p: 0.15 }, { id: 'bomb', p: 0.06 }] },
    boss: null,
  },

  // L14. Ambusher: a pile of rubble until you walk close, then it hauls itself up. Slow, with big telegraphed slams,
  // lobbed boulders at range and a shuddering ground quake.
  sandstone_golem: {
    id: 'sandstone_golem', name: 'Sandstone Golem', level: 14, tags: ['golem', 'stone'],
    stats: { hp: 160, power: 23, defense: 4, speed: 1.3, radius: 0.65, xp: 66 },
    flying: false,
    ai: { brain: 'ambusher', aggro: 4, leash: 10, keepRange: 2 },
    attacks: [
      { id: 'slam', use: 'aoe_ring', r: 2.4, dmg: 1.4, knockback: 5, cd: 4, windup: 1.1, range: 2.2, telegraph: 'circle', weight: 3 },
      { id: 'boulder_toss', use: 'projectile', speed: 7, range: 7, dmg: 1, radius: 0.35, gravityZ: 1, pierce: false,
        look: proj('rock', '#c9a26a', null, 0.8), cd: 4, windup: 0.8, minRange: 2.5, telegraph: 'line', weight: 2 },
      { id: 'quake', use: 'ground_target', range: 6, r: 1.8, dmg: 1.1, delay: 1.2, zone: null,
        cd: 8, windup: 1, minRange: 2, telegraph: 'circle', weight: 1 },
    ],
    onDeath: null,
    look: { rig: 'golem', size: 1.05, colors: { body: '#d8b078', belly: '#ecd2a0', accent: '#3fa0c0', eye: '#3fd0e0' },
      features: ['sandy', 'rocky'], hero: null },
    drops: { gold: [3, 14], goldChance: 0.75, items: [{ id: 'potion_big', p: 0.1 }, { id: 'focus_scroll', p: 0.05 }, { id: 'honey_bun', p: 0.08 }] },
    boss: null,
  },

  // ---- boss: Sultana Sandsnout, a riddling sphinx. P1 paws, sand spit and sun glare; P2 adds a tail sweep, dust devils
  // and a sweeping sand beam; P3 pounces, sinks the floor into quicksand, calls scarabs and gets sunny and loud.
  // Shields at 66% and 33% are her riddles (the boss_shield question gate).
  sultana_sandsnout: {
    id: 'sultana_sandsnout', name: 'Sultana Sandsnout', level: 16, tags: ['boss', 'beast', 'sphinx'],
    stats: { hp: 6600, power: 19, defense: 4, speed: 2.2, radius: 1.3, xp: 450 },
    flying: false,
    ai: { brain: 'boss', aggro: 14, leash: 22, keepRange: 2.5, summon: { kind: 'dust_devil', n: 2, max: 3, cd: 14 } },
    attacks: [
      { id: 'paw_swipe', use: 'melee_arc', arc: 120, range: 2.4, dmg: 1.3, knockback: 4, cd: 3, windup: 0.8, telegraph: 'cone', weight: 3 },
      { id: 'sand_spit', use: 'multishot', n: 5, spread: 55, speed: 7.5, range: 8, dmg: 0.7, radius: 0.28, pierce: false,
        look: proj('spore', '#e8c070', '#fff0b0', 0.55), cd: 4, windup: 0.7, telegraph: 'cone', weight: 2 },
      { id: 'sun_glare', use: 'ground_target', range: 9, r: 1.6, dmg: 1.1, delay: 1.1,
        zone: { dur: 2.5, tick: 0.5, dmg: 0.15, status: 'burn', look: zoneLook('zone_ring', '#ffc040', 1.6) },
        cd: 4.5, windup: 0.9, telegraph: 'circle', weight: 3 },
      { id: 'tail_sweep', use: 'aoe_ring', r: 3.4, dmg: 1.2, knockback: 6, cd: 5, windup: 1, range: 3.2, telegraph: 'circle', weight: 2 },
      { id: 'summon_devils', use: 'summon', kind: 'dust_devil', n: 2, max: 3, cd: 14, windup: 1.2, telegraph: 'circle', weight: 2 },
      { id: 'sand_beam', use: 'beam', range: 9, w: 0.8, dmg: 0.5, sweep: 100, dur: 2, tick: 0.25, cd: 10, windup: 1.2,
        telegraph: 'line', weight: 2 },
      { id: 'pounce', use: 'dash', dist: 8.5, speed: 9.5, dmg: 1.6, knockback: 7, cd: 8, windup: 1.2, range: 10, minRange: 3,
        telegraph: 'line', weight: 3 },
      { id: 'quicksand', use: 'ground_target', range: 8, r: 2.4, dmg: 0.7, delay: 1.0,
        zone: { dur: 4, tick: 0.5, dmg: 0.15, status: 'slow', look: zoneLook('smoke', '#d8b070', 2.4) },
        cd: 9, windup: 0.9, telegraph: 'circle', weight: 2 },
      { id: 'scarab_call', use: 'summon', kind: 'scarab', n: 3, max: 5, cd: 20, windup: 1.1, telegraph: 'circle', weight: 1 },
      { id: 'sun_roar', use: 'buff_self', mods: { speed: 1.25, power: 1.1 }, dur: 20, cd: 25, windup: 0.8, telegraph: null, weight: 1 },
    ],
    onDeath: { spawn: null, n: 0, do: [['cutscene', 'dunes_boss_outro']] },
    look: { rig: 'quadruped', size: 2.3, colors: { body: '#e8c070', belly: '#f6dfa0', accent: '#3fa0c0', eye: '#2a1840' },
      features: ['mane'], hero: 'sphinx' },
    drops: { gold: [50, 70], goldChance: 1, items: [] },
    boss: {
      name: 'Sultana Sandsnout',
      phases: [
        { untilHp: 0.66, pattern: ['paw_swipe', 'sand_spit', 'sun_glare'], cdMul: 1 },
        { untilHp: 0.33, pattern: ['paw_swipe', 'sun_glare', 'tail_sweep', 'summon_devils', 'sand_beam'], cdMul: 0.9 },
        { untilHp: 0, pattern: ['pounce', 'sun_glare', 'quicksand', 'sand_beam', 'scarab_call', 'sand_spit', 'sun_roar'], cdMul: 0.8 },
      ],
      shieldAt: [0.66, 0.33],
      shieldDifficulty: 2,
      barks: ['Riddle me THIS.', 'Mm. Warm. Not correct, but warm.', 'I adore a good gloat.'],
    },
  },
};
