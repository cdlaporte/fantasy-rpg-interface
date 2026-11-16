// Bosses. Old Mossback: a grumpy two-hundred-year-old tree who just wants his nap back.
// Three phases (boss.phases[i].pattern lists attack ids usable in that phase; cdMul scales their cooldowns).
// Shields at 66% and 33% call the boss_shield question gate (Sim boss brain, CONTRACTS 12a).
// onDeath.do runs ops when he is defeated (here: the outro cutscene).

const proj = (model, color, glow, size = 0.6) => ({ rig: 'projectile', model, color, glow, size, trail: true });

export default {
  old_mossback: {
    id: 'old_mossback', name: 'Old Mossback', level: 10, tags: ['boss', 'plant', 'treant'],
    stats: { hp: 1500, power: 17, defense: 3, speed: 1.8, radius: 1.3, xp: 700 },   // round 2: hp 3750 -> 1500 (9,000 effective)
    flying: false,
    ai: { brain: 'boss', aggro: 14, leash: 22, keepRange: 2.5, summon: { kind: 'thornling', n: 2, max: 4, cd: 14 } },
    attacks: [
      // Phase 1+: roots burst under the player (circle telegraph), several in a row as phases advance.
      { id: 'root_slam', use: 'ground_target', range: 9, r: 1.6, dmg: 1.3, delay: 1.1, zone: null,
        cd: 3, windup: 0.9, telegraph: 'circle', weight: 3 },
      { id: 'stomp', use: 'aoe_ring', r: 3, dmg: 1.2, knockback: 6, cd: 5, windup: 1.0, range: 3,
        telegraph: 'circle', weight: 2 },
      { id: 'thorn_volley', use: 'multishot', n: 7, spread: 70, speed: 7, range: 8, dmg: 0.7, radius: 0.25, pierce: false,
        look: proj('arrow', '#5fb548', '#d8ff9a', 0.5), cd: 4, windup: 0.7, telegraph: 'cone', weight: 2 },
      // Phase 2+: grows thornlings and sweeps a beam of pollen across the arena (sweep degrees over dur seconds).
      { id: 'summon_thornlings', use: 'summon', kind: 'thornling', n: 2, max: 4, cd: 14, windup: 1.2,
        telegraph: 'circle', weight: 2 },
      { id: 'pollen_beam', use: 'beam', range: 9, w: 0.8, dmg: 0.5, sweep: 100, dur: 2, tick: 0.25,
        cd: 10, windup: 1.2, telegraph: 'line', weight: 2 },
      // Phase 3: wakes up properly. Telegraphed charge across the arena and a grumpy speed buff.
      { id: 'charge', use: 'dash', dist: 8, speed: 9, dmg: 1.6, knockback: 7, cd: 8, windup: 1.2, range: 10, minRange: 3,
        telegraph: 'line', weight: 3 },
      { id: 'grumpy', use: 'buff_self', mods: { speed: 1.25, power: 1.1 }, dur: 20, cd: 25, windup: 0.8,
        telegraph: null, weight: 1 },
    ],
    onDeath: { spawn: null, n: 0, do: [['cutscene', 'forest_boss_outro']] },
    look: { rig: 'golem', size: 2.2, colors: { body: '#7a5a3a', belly: '#a8743d', accent: '#5fb548', eye: '#ffe14d' },
      features: ['wood', 'mossy', 'antlers'], hero: 'mossback' },
    drops: { gold: [40, 60], goldChance: 1, items: [] },
    boss: {
      name: 'Old Mossback',
      phases: [
        { untilHp: 0.66, pattern: ['root_slam', 'stomp', 'thorn_volley'], cdMul: 1 },
        { untilHp: 0.33, pattern: ['root_slam', 'stomp', 'summon_thornlings', 'pollen_beam'], cdMul: 0.9 },
        { untilHp: 0, pattern: ['charge', 'root_slam', 'pollen_beam', 'summon_thornlings', 'thorn_volley', 'grumpy'], cdMul: 0.8 },
      ],
      shieldAt: [0.66, 0.33],
      shieldDifficulty: 2,
      barks: ['HRRRM. STOP... TICKLING.', 'I WAS... NAPPING.', 'FIVE... MORE... MINUTES.'],
    },
  },
};
