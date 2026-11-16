// PLACEHOLDER zone by the lead's prep (round 3). Package for this biome replaces this whole file with the real
// 96x96 macro-grid map (see docs/BIOMES.md and src/data/zones/forest.js). Keep the zone id, `entry`, the required
// markers and the exit back to town (gate_aether).
export default {
  aether: {
    id: 'aether', name: 'Aether Gardens', palette: 'aether', music: 'aether', levelRange: [15, 20], seed: 1462,
    entry: 'entry_town',
    scaleToPlayer: true,            // enemy spawns: level = clamp(player level + spawn.levelOffset, levelRange)
    required: ['entry_town', 'respawn', 'camp', 'boss_arena', 'boss_spawn'],
    tiles: {
      rows: [
        "########################",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "#......................#",
        "###########...##########"
      ],
      legend: { '#': 'cliff', '.': 'starfloor' },
    },
    markers: {"exit_town": [12, 17], "entry_town": [12, 13], "camp": [7, 4], "respawn": [6, 13], "boss_arena": [18, 8], "boss_spawn": [19, 6]},
    exits: [{ at: 'exit_town', w: 3, h: 1, to: 'town', marker: 'gate_aether' }],
    props: [], spawns: [], gates: [], chests: [], triggers: [], npcs: [],
  },
};
