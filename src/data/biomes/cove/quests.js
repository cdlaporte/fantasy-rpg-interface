// Gullwing Cove quests. Round 3 QA: xp rewards were scaled so a run lands on the level targets (tests/node/r3qa-progression.test.mjs, docs/notes/qa-r3.md): about 4200 xp per biome in total, 6500 in Aether.
export default {
  cove_lighthouse_dark: {
    id: 'cove_lighthouse_dark', name: 'The Dark Lighthouse', giver: 'marlo', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Collect glow jelly from the bubble jellies in the coral shallows. (3)', goal: { type: 'collect', item: 'glow_jelly', n: 3 } },
      { text: 'Take back the lighthouse lens from the pirate imps at their camp.', goal: { type: 'collect', item: 'brass_lens', n: 1 } },
      { text: 'Walk out to the lighthouse on its point.', goal: { type: 'reach', zone: 'cove', marker: 'lighthouse_door', r: 4 } },
      { text: 'Climb up and relight the lamp.', goal: { type: 'flag', key: 'lighthouse_lit' } },
      { text: 'Unseal the tide gate on the sand causeway.', goal: { type: 'flag', key: 'gate_tide_seal' } },
      { text: 'Defeat Captain Clawsworth on the sandbar.', goal: { type: 'boss', kind: 'captain_clawsworth' } },
      { text: 'Tell Marlo the light is on and the Captain is hat-sized.', goal: { type: 'talk', npc: 'marlo' } },
    ],
    rewards: { xp: 2230, gold: 200, items: [{ id: 'potion_big', n: 2 }, { id: 'sea_chowder', n: 2 }] },
    onDone: [['rel', 'marlo', 3]],
  },
  cove_lost_shells: {
    id: 'cove_lost_shells', name: 'Shell Game', giver: 'skipper', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Ask the hermit crab in the tide pool for Skipper\'s lucky shell.', goal: { type: 'flag', key: 'cove_lucky_shell' } },
      { text: 'Get Skipper\'s conch shells back from the snippy crabs. (5 in all)', goal: { type: 'collect', item: 'conch_shell', n: 5 } },
      { text: 'Bring the shells to Skipper at the pier.', goal: { type: 'talk', npc: 'skipper' } },
    ],
    rewards: { xp: 1070, gold: 90, items: [{ id: 'bubble_bomb', n: 2 }] },
    onDone: [['take', 'conch_shell', 5], ['rel', 'skipper', 3]],
  },
  cove_gull_gold: {
    id: 'cove_gull_gold', name: 'Gulls Gone Wild', giver: 'pearl', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Shoo the pilfering gulls away from the village. (6)', goal: { type: 'kill', kind: 'gull', n: 6 } },
      { text: 'Tell Pearl the till is safe.', goal: { type: 'talk', npc: 'pearl' } },
    ],
    rewards: { xp: 890, gold: 80, items: [{ id: 'sea_chowder', n: 3 }] },
    onDone: [['rel', 'pearl', 2]],
  },
};
