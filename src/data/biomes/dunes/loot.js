// Sunscorch Dunes loot tables (same shape as src/data/loot.js; sized for levels 10-16, forest tables x ~1.6).
export default {
  dunes_small: {
    id: 'dunes_small', gold: [14, 28],
    items: [
      { id: 'potion_small', n: 1, p: 0.7 },
      { id: 'cactus_water', n: 2, p: 0.5 },
      { id: 'bomb', n: 1, p: 0.25 },
      { id: 'speed_tonic', n: 1, p: 0.2 },
      { id: 'sand_veil', n: 1, p: 0.15 },
    ],
    runeBonus: { gold: [15, 30], items: [{ id: 'shield_charm', n: 1, p: 0.5 }, { id: 'focus_scroll', n: 1, p: 0.3 }] },
  },
  dunes_rune: {
    id: 'dunes_rune', gold: [32, 55],
    items: [
      { id: 'potion_big', n: 1, p: 0.6 },
      { id: 'cactus_water', n: 2, p: 0.5 },
      { id: 'honey_bun', n: 1, p: 0.4 },
      { id: 'focus_scroll', n: 1, p: 0.3 },
      { id: 'sand_veil', n: 1, p: 0.35 },
    ],
    runeBonus: {
      gold: [30, 55],
      items: [{ id: 'study_notes', n: 1, p: 0.6 }, { id: 'dye_sunset', n: 1, p: 0.25 }, { id: 'shield_charm', n: 1, p: 0.5 }],
    },
  },
  boss_sandsnout: {
    id: 'boss_sandsnout', gold: [150, 210],
    items: [
      { id: 'hat_sphinx_circlet', n: 1, p: 1 },
      { id: 'potion_big', n: 2, p: 1 },
      { id: 'cactus_water', n: 3, p: 1 },
      { id: 'focus_scroll', n: 1, p: 0.6 },
      { id: 'cape_gold', n: 1, p: 0.2 },
    ],
    runeBonus: { gold: [60, 90], items: [{ id: 'dye_sunset', n: 1, p: 0.4 }, { id: 'sand_veil', n: 2, p: 0.5 }] },
  },
};
