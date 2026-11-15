// Loot tables (CONTRACTS 13a): {id, gold: [a, b], items: [{id, n, p}], runeBonus: {gold, items}}.
// `items` rolls each entry independently with chance p. `runeBonus` is ADDED on a correct rune-chest answer.
export default {
  forest_small: {
    id: 'forest_small', gold: [8, 18],
    items: [
      { id: 'potion_small', n: 1, p: 0.7 },
      { id: 'bread', n: 2, p: 0.4 },
      { id: 'bomb', n: 1, p: 0.25 },
      { id: 'speed_tonic', n: 1, p: 0.15 },
    ],
    runeBonus: { gold: [10, 20], items: [{ id: 'shield_charm', n: 1, p: 0.5 }, { id: 'focus_scroll', n: 1, p: 0.25 }] },
  },
  forest_rune: {
    id: 'forest_rune', gold: [20, 35],
    items: [
      { id: 'potion_big', n: 1, p: 0.6 },
      { id: 'smoke_pellet', n: 1, p: 0.35 },
      { id: 'focus_scroll', n: 1, p: 0.3 },
      { id: 'honey_bun', n: 1, p: 0.4 },
    ],
    runeBonus: {
      gold: [25, 45],
      items: [{ id: 'study_notes', n: 1, p: 0.6 }, { id: 'dye_forest', n: 1, p: 0.25 }, { id: 'shield_charm', n: 1, p: 0.5 }],
    },
  },
  boss_mossback: {
    id: 'boss_mossback', gold: [90, 130],
    items: [
      { id: 'mossback_acorn', n: 1, p: 1 },
      { id: 'potion_big', n: 2, p: 1 },
      { id: 'focus_scroll', n: 1, p: 0.6 },
      { id: 'cape_mint', n: 1, p: 0.3 },
    ],
    runeBonus: { gold: [40, 60], items: [{ id: 'hat_moon_circlet', n: 1, p: 0.3 }] },
  },
};
