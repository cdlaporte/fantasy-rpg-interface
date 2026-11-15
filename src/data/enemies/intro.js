// STUB: replaced by the Content package (starter content by the skeleton)
export default {
  rat: {
    id: 'rat', name: 'Pantry Rat', level: 1, tags: ['beast'],
    stats: { hp: 6, power: 1, defense: 0, speed: 2.2, radius: 0.3, xp: 3 },
    ai: { brain: 'chaser', aggro: 5, leash: 9 },
    attacks: [{ use: 'melee_arc', range: 0.7, dmg: 1, cd: 0.9, windup: 0.3, arc: 90 }],
    look: { rig: 'quadruped', size: 0.5, colors: { body: '#9a8a7a', belly: '#d8c8b8', accent: '#ff9aa8', eye: '#222222' }, features: ['tail_thin', 'ears_round'], hero: null },
    drops: { gold: [1, 3], goldChance: 0.6, items: [{ id: 'cheese', p: 0.15 }] },
    boss: null,
  },
};
