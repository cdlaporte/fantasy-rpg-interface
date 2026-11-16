// Frostwhistle Peaks quests. Round 3 QA: xp rewards were scaled so a run lands on the level targets (tests/node/r3qa-progression.test.mjs, docs/notes/qa-r3.md): about 4200 xp per biome in total, 6500 in Aether.
export default {
  peaks_summit: {
    id: 'peaks_summit', name: 'The Grumpy Summit', giver: 'nana_frost', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Cross the snowfields to the ice-crystal spires.', goal: { type: 'reach', zone: 'peaks', marker: 'spires', r: 6 } },
      { text: 'Climb the switchback path up the cliffs.', goal: { type: 'reach', zone: 'peaks', marker: 'switchback', r: 5 } },
      { text: 'Find the summit rune gate.', goal: { type: 'reach', zone: 'peaks', marker: 'rune_gate', r: 4 } },
      { text: 'Unseal the summit gate.', goal: { type: 'flag', key: 'gate_summit_seal' } },
      { text: 'Enter the summit arena.', goal: { type: 'reach', zone: 'peaks', marker: 'boss_arena', r: 5 } },
      { text: 'Calm Grumbleflake.', goal: { type: 'boss', kind: 'grumbleflake' } },
      { text: 'Tell Nana Frost the summit is quiet.', goal: { type: 'talk', npc: 'nana_frost' } },
    ],
    rewards: { xp: 1990, gold: 240, items: [{ id: 'potion_big', n: 2 }, { id: 'frost_cocoa', n: 3 }] },
    onDone: [['rel', 'nana_frost', 2], ['toast', 'Frostwhistle Peaks is calm. The snow is sparkling again.', 'quest']],
  },
  peaks_lost_mittens: {
    id: 'peaks_lost_mittens', name: 'Mitten Mystery', giver: 'nana_frost', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Find lost mittens in the snow bunny burrows. (5)', goal: { type: 'collect', item: 'lost_mitten', n: 5 } },
      { text: 'Bring the mittens to Nana Frost.', goal: { type: 'talk', npc: 'nana_frost' } },
    ],
    rewards: { xp: 1050, gold: 110, items: [{ id: 'frost_cocoa', n: 3 }, { id: 'icicle_bomb', n: 2 }] },
    onDone: [['take', 'lost_mitten', 5], ['rel', 'nana_frost', 2], ['flag.set', 'nana_mittens_done', true]],
  },
  peaks_ice_survey: {
    id: 'peaks_ice_survey', name: 'Spires, Shadows and Similar Triangles', giver: 'dr_flurry', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Measure the first ice spire (press E beside it).', goal: { type: 'interact', id: 'spire_a' } },
      { text: 'Measure the second ice spire.', goal: { type: 'interact', id: 'spire_b' } },
      { text: 'Measure the third ice spire.', goal: { type: 'interact', id: 'spire_c' } },
      { text: 'Pop the frost sprites fogging the lens. (4)', goal: { type: 'kill', kind: 'frost_sprite', n: 4 } },
      { text: 'Bring Dr. Flurry the measurements.', goal: { type: 'talk', npc: 'dr_flurry' } },
    ],
    rewards: { xp: 1160, gold: 120, items: [{ id: 'potion_big', n: 2 }, { id: 'focus_scroll', n: 1 }] },
    onDone: [['rel', 'dr_flurry', 2]],
  },
};
