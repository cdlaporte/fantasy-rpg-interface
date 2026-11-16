// Sunscorch Dunes quests. Round 3 QA: xp rewards were scaled so a run lands on the level targets (tests/node/r3qa-progression.test.mjs, docs/notes/qa-r3.md): about 4200 xp per biome in total, 6500 in Aether.
// Zone props set the flags (dunes_crate_1..3, dunes_spring_filled, dunes_rubbing_*), so the steps complete in any order.
export default {
  dunes_lost_caravan: {
    id: 'dunes_lost_caravan', name: 'The Lost Caravan', giver: 'ziva', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Find the first lost cart in the northern dunes.', goal: { type: 'flag', key: 'dunes_crate_1' } },
      { text: 'Find the second cart in the cactus garden.', goal: { type: 'flag', key: 'dunes_crate_2' } },
      { text: 'Find the third cart near the oasis canyon.', goal: { type: 'flag', key: 'dunes_crate_3' } },
      { text: 'Tell Ziva the carts are safe.', goal: { type: 'talk', npc: 'ziva' } },
      { text: 'Follow the caravan trail to the ruins.', goal: { type: 'reach', zone: 'dunes', marker: 'ruins', r: 7 } },
      { text: 'Unseal the sphinx\'s rune gate.', goal: { type: 'flag', key: 'gate_sphinx_gate' } },
      { text: 'Defeat Sultana Sandsnout.', goal: { type: 'boss', kind: 'sultana_sandsnout' } },
      { text: 'Tell Ziva the road is clear.', goal: { type: 'talk', npc: 'ziva' } },
    ],
    rewards: { xp: 2250, gold: 150, items: [{ id: 'potion_big', n: 2 }, { id: 'sand_veil', n: 2 }] },
    onDone: [['rel', 'ziva', 2], ['toast', 'The caravan can cross the dunes again. Ziva is already counting the profits.', 'quest']],
  },
  dunes_oasis_water: {
    id: 'dunes_oasis_water', name: 'Water for the Camp', giver: 'ziva', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Walk to the oasis, south of the dust flats.', goal: { type: 'reach', zone: 'dunes', marker: 'oasis', r: 5 } },
      { text: 'Chase the canyon scorpions away. (4)', goal: { type: 'kill', kind: 'sand_scorpion', n: 4 } },
      { text: 'Fill the waterskins at the oasis well.', goal: { type: 'flag', key: 'dunes_spring_filled' } },
      { text: 'Bring the water back to Ziva.', goal: { type: 'talk', npc: 'ziva' } },
    ],
    rewards: { xp: 1130, gold: 70, items: [{ id: 'cactus_water', n: 3 }, { id: 'shield_charm', n: 1 }] },
    onDone: [['rel', 'ziva', 2]],
  },
  dunes_obelisk_rubbings: {
    id: 'dunes_obelisk_rubbings', name: 'Glyphs of the Sun Court', giver: 'professor_dusty', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Study the sun obelisk in the west of the ruins.', goal: { type: 'flag', key: 'dunes_rubbing_sun' } },
      { text: 'Study the moon obelisk in the east of the ruins.', goal: { type: 'flag', key: 'dunes_rubbing_moon' } },
      { text: 'Study the star obelisk by the south wall.', goal: { type: 'flag', key: 'dunes_rubbing_star' } },
      { text: 'Show your glyph copies to Professor Dusty.', goal: { type: 'talk', npc: 'professor_dusty' } },
    ],
    rewards: { xp: 830, gold: 50, items: [{ id: 'hat_sun_explorer', n: 1 }, { id: 'cactus_water', n: 2 }] },
    onDone: [['rel', 'professor_dusty', 2]],
  },
};
