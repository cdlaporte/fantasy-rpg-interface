// Whisperwood quests. Reward sizes: about 40% of a level at the zone level band (CLASSES balance sheet).
export default {
  forest_mushroom_mischief: {
    id: 'forest_mushroom_mischief', name: 'Mushroom Mischief', giver: 'mo', req: [['flag', 'forest_open']], companions: null,
    steps: [
      { text: 'Calm the sporecaps in the glade. (6)', goal: { type: 'kill', kind: 'sporecap', n: 6 } },
      { text: 'Collect glowcaps for Mo. (4)', goal: { type: 'collect', item: 'glowcap', n: 4 } },
      { text: 'Bring the glowcaps to Mo.', goal: { type: 'talk', npc: 'mo' } },
    ],
    rewards: { xp: 100, gold: 40, items: [{ id: 'speed_tonic', n: 2 }] },
    onDone: [['take', 'glowcap', 4], ['rel', 'mo', 2]],
  },
  forest_goblin_trouble: {
    id: 'forest_goblin_trouble', name: 'Overdue and Under Siege', giver: 'opal', req: [['level', '>=', 6]], companions: null,
    steps: [
      { text: 'Find the goblin camp in the Whisperwood.', goal: { type: 'reach', zone: 'forest', marker: 'goblin_camp', r: 5 } },
      { text: 'Recover the stolen textbooks. (3)', goal: { type: 'collect', item: 'stolen_textbook', n: 3 } },
      { text: 'Return the textbooks to Madam Opal.', goal: { type: 'talk', npc: 'opal' } },
    ],
    rewards: { xp: 180, gold: 60, items: [{ id: 'focus_scroll', n: 1 }] },
    onDone: [['take', 'stolen_textbook', 3], ['rel', 'opal', 2]],
  },
  forest_sealed_grove: {
    id: 'forest_sealed_grove', name: 'The Sealed Grove', giver: 'ranger_tam', req: [['level', '>=', 8]], companions: null,
    steps: [
      { text: 'Find the rune gate deep in the Whisperwood.', goal: { type: 'reach', zone: 'forest', marker: 'grove_gate', r: 4 } },
      { text: 'Unseal the grove gate.', goal: { type: 'flag', key: 'gate_grove_seal' } },
      { text: 'Calm the treant saplings. (3)', goal: { type: 'kill', kind: 'treant_sapling', n: 3 } },
      { text: 'Enter the heart of the grove.', goal: { type: 'reach', zone: 'forest', marker: 'boss_arena', r: 5 } },
      { text: 'Defeat Old Mossback.', goal: { type: 'boss', kind: 'old_mossback' } },
      { text: 'Tell Ranger Tam the grove is safe.', goal: { type: 'talk', npc: 'ranger_tam' } },
    ],
    rewards: { xp: 280, gold: 120, items: [{ id: 'potion_big', n: 2 }, { id: 'hat_moon_circlet', n: 1 }] },
    onDone: [['rel', 'ranger_tam', 2], ['toast', 'The other gates stay sealed until next term.', 'info']],
  },
};
