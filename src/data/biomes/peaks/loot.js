// Frostwhistle Peaks loot tables (CONTRACTS 13a): {id, gold: [a, b], items: [{id, n, p}], runeBonus: {gold, items}}.
// Gold and potions are sized for levels 13-19 (forest tables were written for levels 3-10).
export default {
  peaks_small: {
    id: 'peaks_small', gold: [30, 55],
    items: [
      { id: 'potion_big', n: 1, p: 0.6 },
      { id: 'frost_cocoa', n: 1, p: 0.45 },
      { id: 'bomb', n: 2, p: 0.3 },
      { id: 'speed_tonic', n: 1, p: 0.25 },
    ],
    runeBonus: { gold: [25, 45], items: [{ id: 'shield_charm', n: 1, p: 0.55 }, { id: 'icicle_bomb', n: 1, p: 0.4 }] },
  },
  peaks_rune: {
    id: 'peaks_rune', gold: [60, 95],
    items: [
      { id: 'potion_big', n: 2, p: 0.7 },
      { id: 'icicle_bomb', n: 2, p: 0.5 },
      { id: 'focus_scroll', n: 1, p: 0.4 },
      { id: 'frost_cocoa', n: 2, p: 0.5 },
    ],
    runeBonus: {
      gold: [50, 80],
      items: [{ id: 'study_notes', n: 1, p: 0.7 }, { id: 'cape_snowflake', n: 1, p: 0.2 }, { id: 'shield_charm', n: 1, p: 0.5 }],
    },
  },
  boss_grumbleflake: {
    id: 'boss_grumbleflake', gold: [220, 300],
    items: [
      { id: 'potion_big', n: 3, p: 1 },
      { id: 'frost_cocoa', n: 2, p: 1 },
      { id: 'cape_snowflake', n: 1, p: 0.6 },
      { id: 'focus_scroll', n: 1, p: 0.6 },
    ],
    runeBonus: { gold: [80, 120], items: [{ id: 'icicle_bomb', n: 2, p: 0.7 }, { id: 'hat_moon_circlet', n: 1, p: 0.25 }] },
  },
};
