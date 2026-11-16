// Gullwing Cove loot tables (CONTRACTS 13a). `runeBonus` is ADDED on a correct rune-chest answer.
export default {
  cove_small: {
    id: 'cove_small', gold: [20, 38],
    items: [
      { id: 'potion_small', n: 2, p: 0.7 },
      { id: 'sea_chowder', n: 1, p: 0.4 },
      { id: 'bubble_bomb', n: 1, p: 0.3 },
      { id: 'speed_tonic', n: 1, p: 0.2 },
    ],
    runeBonus: { gold: [20, 35], items: [{ id: 'shield_charm', n: 1, p: 0.5 }, { id: 'focus_scroll', n: 1, p: 0.3 }] },
  },
  cove_rune: {
    id: 'cove_rune', gold: [45, 75],
    items: [
      { id: 'potion_big', n: 2, p: 0.6 },
      { id: 'sea_chowder', n: 2, p: 0.5 },
      { id: 'smoke_pellet', n: 1, p: 0.35 },
      { id: 'focus_scroll', n: 1, p: 0.35 },
    ],
    runeBonus: {
      gold: [50, 80],
      items: [{ id: 'study_notes', n: 1, p: 0.6 }, { id: 'dye_ocean', n: 1, p: 0.3 }, { id: 'shield_charm', n: 1, p: 0.5 }],
    },
  },
  boss_clawsworth: {
    id: 'boss_clawsworth', gold: [180, 260],
    items: [
      { id: 'hat_captain', n: 1, p: 1 },
      { id: 'potion_big', n: 3, p: 1 },
      { id: 'sea_chowder', n: 2, p: 1 },
      { id: 'focus_scroll', n: 1, p: 0.7 },
      { id: 'cape_midnight', n: 1, p: 0.3 },
    ],
    runeBonus: { gold: [80, 120], items: [{ id: 'bubble_bomb', n: 2, p: 0.8 }, { id: 'dye_ocean', n: 1, p: 0.4 }] },
  },
};
