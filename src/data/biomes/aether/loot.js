// Aether Gardens loot tables (CONTRACTS 13a): {id, gold: [a, b], items: [{id, n, p}], runeBonus: {gold, items}}.
// Sized for levels 15-20 (about 2-3x the forest tables).
export default {
  aether_small: {
    id: 'aether_small', gold: [25, 45],
    items: [
      { id: 'potion_big', n: 1, p: 0.5 },
      { id: 'potion_small', n: 2, p: 0.5 },
      { id: 'moon_tea', n: 1, p: 0.4 },
      { id: 'comet_candy', n: 1, p: 0.25 },
    ],
    runeBonus: { gold: [20, 35], items: [{ id: 'shield_charm', n: 1, p: 0.5 }, { id: 'focus_scroll', n: 1, p: 0.3 }] },
  },
  aether_rune: {
    id: 'aether_rune', gold: [45, 75],
    items: [
      { id: 'potion_big', n: 1, p: 0.7 },
      { id: 'star_chart', n: 1, p: 0.6 },
      { id: 'moon_tea', n: 2, p: 0.5 },
      { id: 'focus_scroll', n: 1, p: 0.35 },
    ],
    runeBonus: {
      gold: [40, 70],
      items: [{ id: 'study_notes', n: 1, p: 0.5 }, { id: 'shield_charm', n: 1, p: 0.5 }, { id: 'cape_midnight', n: 1, p: 0.2 }],
    },
  },
  boss_malgrim: {
    id: 'boss_malgrim', gold: [220, 320],
    items: [
      { id: 'hat_sealweaver', n: 1, p: 1 },
      { id: 'potion_big', n: 3, p: 1 },
      { id: 'comet_candy', n: 2, p: 1 },
      { id: 'focus_scroll', n: 1, p: 0.6 },
      { id: 'cape_gold', n: 1, p: 0.35 },
    ],
    runeBonus: { gold: [60, 90], items: [{ id: 'hat_moon_circlet', n: 1, p: 0.3 }] },
  },
};
