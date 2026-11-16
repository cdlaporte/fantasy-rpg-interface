// Zone 'cove': Gullwing Cove (96 x 96 from a 24 x 24 macro grid, cell 4). Journey: entry_town (north edge) -> dunes ->
// fishing village with its pier -> tide pools -> pirate-imp camp (SW) -> coral reef -> lighthouse point (SE) ->
// the tide gate (rune seal on a sand causeway) -> the sandbar and wreck where Captain Clawsworth waits (NE).
// Macro legend: # cliff, ~ sea, f shallows, p path, d dunes, v village, b beach, t tide pools, c coral shallows,
// k imp camp, r reef, L lighthouse point, z causeway, A sandbar arena.
// Decoration ring around a centre: [propKind, ...] cycled over n points of radius r, skipping an angular gap (degrees).
function ring(cx, cy, r, n, kinds, gapAt = 90, gapHalf = 26) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const deg = (360 / n) * i + 7;
    let d = Math.abs(((deg - gapAt + 540) % 360) - 180); d = 180 - d;
    if (d < gapHalf) continue;
    const a = (deg * Math.PI) / 180;
    out.push({ kind: kinds[i % kinds.length], x: Math.round(cx + Math.cos(a) * r), y: Math.round(cy + Math.sin(a) * r) });
  }
  return out;
}

export default {
  cove: {
    id: 'cove', name: 'Gullwing Cove', palette: 'cove', music: 'cove', levelRange: [11, 17], seed: 1308,
    entry: 'entry_town',
    scaleToPlayer: true,            // enemy spawns: level = clamp(player level + spawn.levelOffset, levelRange)
    required: ['entry_town', 'respawn', 'camp', 'boss_arena', 'boss_spawn'],
    macro: {
      cell: 4,
      rows: [
        '######p#####~~~~~~~~~~~~',
        '###dddpddd#~~~~~~~AAAA~~',
        '#dddddpddd#~~~~~~~AAAAA~',
        '#dddddpdddd~~##~~AAAAAA~',
        '#dddddpdddd~~~#~~AAAAA~~',
        '#vvvvvpvvv#~~~~~~~AAAA~~',
        '#vvvvvpvvvvff~~~~~~z~~~~',
        '#vvvvvpvvvv~~~~~~~~z~~~~',
        '#vvvvvpvvv~~~~~~~~~z~~#~',
        '#vvvvvpvvv~~~~##~~~z~#~~',
        '#bbbbbppp~~~~~~#~~~z~~~~',
        '##ttttttpcccc~~~~~~z~~~~',
        '##ttttttpccccc~~~~~z~~~~',
        '##ttttttpccccc~#~~LpL~~~',
        '#bttttttpccccc~~~LLpL#~~',
        '#bttttttpccccc~~LLLpL#~~',
        '#bbbbbbbpcccc~~~LLLpLL~~',
        '#kkkkkkkprrrrrrrLLLpLL~~',
        '#kkkkkkkppppppppppppL#~~',
        '#kkkkkkkrrrrrrrrLLLLL#~~',
        '#kkkkkkkrrrrrrr~~#LL#~~~',
        '##kkkkk~~rrrrr~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~',
      ],
      legend: {
        '#': 'cliff', '~': 'water', f: 'shallows',
        p: { tile: 'path', path: true, under: 'sand', width: 3 },
        d: { tile: 'grass', mix: [['sand', 0.3, 6], ['tallgrass', 0.2, 5]],
          deco: { palm: 0.05, bush_flower: 0.02, flowers_wild: 0.035, rock: 0.01, shell: 0.015 },
          fringe: { palm: 0.2, bush_plain: 0.1, rock: 0.1 } },
        v: { tile: 'sand', mix: [['path', 0.25, 5], ['cobble', 0.08, 3]], deco: { shell: 0.012, rock: 0.006, bush_flower: 0.004 }, fringe: { rock: 0.15, palm: 0.1 } },
        b: { tile: 'sand', mix: [['wet_sand', 0.12, 6]], deco: { shell: 0.022, palm: 0.02, rock: 0.012, dune: 0.02 },
          fringe: { rock: 0.2, palm: 0.1 } },
        t: { tile: 'wet_sand', mix: [['sand', 0.25, 5]], deco: { shell: 0.035, rock: 0.018, coral: 0.012 }, fringe: { rock: 0.2 } },
        c: { tile: 'shallows', deco: { coral: 0.05, coral_blue: 0.04, shell: 0.01 }, fringe: { coral: 0.2, rock: 0.1 } },
        k: { tile: 'sand', mix: [['dirt', 0.3, 4], ['wet_sand', 0.1, 5]], deco: { rock: 0.016, shell: 0.01, palm: 0.006 }, fringe: { rock: 0.2, palm: 0.08 } },
        r: { tile: 'sand', mix: [['wet_sand', 0.3, 4], ['dirt', 0.12, 3]], deco: { coral: 0.03, coral_blue: 0.015, rock_grey: 0.03, rock: 0.015 },
          fringe: { rock_grey: 0.3, coral: 0.15 } },
        L: { tile: 'sand', mix: [['grass', 0.3, 5], ['stone', 0.1, 3]], deco: { rock: 0.015, shell: 0.015, flowers_wild: 0.025, palm: 0.014 },
          fringe: { rock: 0.25, palm: 0.1 } },
        z: { tile: 'sand', mix: [['wet_sand', 0.2, 4]] },
        A: { tile: 'sand', mix: [['wet_sand', 0.15, 4]], deco: { shell: 0.01 } },
      },
      filler: 'cliff',
      shore: { shallows: 'shallows', beach: 'wet_sand', beachChance: 0.5 },
      decoClear: 2.5,
      paint: [
        // village: cobbled plaza at the crossroads, a harbour road to the pier
        { disc: [26, 31, 5.5], tile: 'cobble', reserve: true },
        { rect: [30, 26, 11, 3], tile: 'path', path: true },
        // the pier: planks over the water, 3 wide, with a wider head
        { rect: [40, 25, 25, 3], tile: 'planks', reserve: true },
        { rect: [61, 23, 5, 7], tile: 'planks', reserve: true },
        // pirate camp clearing
        { at: [16, 77], r: 7, ragged: 2.5, tile: 'dirt', reserve: true },
        // lighthouse yard
        { at: [75, 62], r: 6.5, ragged: 2, tile: 'cobble', reserve: true },
        // the tide gate: a 3-wide sand causeway between two stretches of open sea
        { rect: [72, 31, 5, 9], tile: 'water' },
        { rect: [80, 31, 5, 9], tile: 'water' },
        { line: [78, 30, 78, 41], width: 3, tile: 'sand', reserve: true },
        // the sandbar: clear sand disc, a wreck deck in the middle
        { disc: [80, 13, 8.5], tile: 'sand', reserve: true },
        { disc: [80, 13, 4.6], tile: 'planks', reserve: true },
        { line: [78, 20, 78, 30], width: 3, tile: 'sand', reserve: true },
      ],
    },
    markers: {
      exit_town: [26, 0], entry_town: [26, 4], respawn: [22, 31], camp: [26, 32],
      village_gate: [26, 10], marlo_post: [38, 31], pearl_stall: [33, 33], pier: [47, 26], pier_end: [62, 26],
      home_marlo: [9, 24], home_skipper: [15, 24], home_pearl: [38, 24],
      tide_pools: [18, 54], pool_lucky: [17, 54], chest_1: [12, 66], coral_shallows: [47, 56], chest_2: [52, 62],
      imp_camp: [16, 77], chest_3: [8, 77], reef: [47, 78], lighthouse: [76, 63], lighthouse_door: [73, 60],
      tide_gate: [78, 36], sandbar: [78, 28], boss_arena: [80, 13], boss_spawn: [80, 8], chest_4: [86, 10],
    },
    exits: [{ at: 'exit_town', w: 3, h: 1, to: 'town', marker: 'gate_cove' }],
    props: [
      // entrance
      { kind: 'sign', x: 30, y: 5, id: 'sign_cove', interact: { prompt: 'Read', do: [['toast', 'Gullwing Cove. Please mind the gulls. The gulls mind your gold.', 'info']] } },
      { kind: 'lamp_gold', x: 23, y: 7 }, { kind: 'lamp_gold', x: 28, y: 7 },
      { kind: 'palm_tall', x: 22, y: 9 }, { kind: 'palm_tall', x: 30, y: 9 },
      { kind: 'banner', x: 23, y: 12 }, { kind: 'banner', x: 28, y: 12 },
      { kind: 'rock_ring', x: 16, y: 8 }, { kind: 'rock_ring', x: 37, y: 14 }, { kind: 'bush_flower', x: 19, y: 15 }, { kind: 'bush_flower', x: 34, y: 17 },
      // village houses (doors face the lanes)
      { kind: 'house_cottage', x: 8, y: 21 }, { kind: 'house_cottage_rose', x: 14, y: 21 },
      { kind: 'house_blue', x: 31, y: 21 }, { kind: 'house_green', x: 37, y: 21 },
      { kind: 'house_wide', x: 8, y: 34 }, { kind: 'house_plum', x: 15, y: 34 },
      { kind: 'flowers_red', x: 11, y: 25 }, { kind: 'flowers_wild', x: 16, y: 25 }, { kind: 'flowers_blue', x: 34, y: 25 },
      // the plaza: well, lamps, benches, flowerbeds
      { kind: 'well', x: 21, y: 27 },
      { kind: 'lamp_gold', x: 21, y: 32 }, { kind: 'lamp_gold', x: 29, y: 33 }, { kind: 'lamp_gold', x: 26, y: 26 },
      { kind: 'bench', x: 22, y: 35 }, { kind: 'bench', x: 27, y: 35 },
      { kind: 'flowers_wild', x: 24, y: 29 }, { kind: 'flowers_blue', x: 29, y: 29 },
      { kind: 'sign', x: 28, y: 24, id: 'sign_village', interact: { prompt: 'Read', do: [['toast', 'Gullwing Village. Population: 41 people, 300 gulls, one very loud bell.', 'info']] } },
      // Pearl's chowder stand and cafe tables
      { kind: 'stall_green', x: 30, y: 31 },
      { kind: 'table_umbrella', x: 35, y: 33 }, { kind: 'table_umbrella_teal', x: 37, y: 34 }, { kind: 'table_umbrella', x: 35, y: 36 },
      { kind: 'chair', x: 34, y: 33 }, { kind: 'chair', x: 36, y: 34 },
      { kind: 'bench_seat', x: 36, y: 31 },
      { kind: 'barrel', x: 40, y: 31 }, { kind: 'crate', x: 41, y: 31 }, { kind: 'crate', x: 41, y: 30 },
      // beached boats and nets south of the village
      { kind: 'boat', x: 11, y: 40 }, { kind: 'boat', x: 21, y: 41 }, { kind: 'barrel', x: 16, y: 41 }, { kind: 'crate', x: 17, y: 41 },
      { kind: 'fence_white', x: 5, y: 28 }, { kind: 'fence_white', x: 5, y: 29 }, { kind: 'fence_white', x: 5, y: 30 },
      // the pier: posts, cargo, boats
      { kind: 'barrel', x: 41, y: 24 }, { kind: 'barrel', x: 42, y: 24 }, { kind: 'crate', x: 41, y: 28 }, { kind: 'crate', x: 42, y: 28 },
      { kind: 'lamp_gold', x: 45, y: 24 }, { kind: 'lamp_gold', x: 53, y: 24 }, { kind: 'lamp_gold', x: 59, y: 24 },
      { kind: 'lamp_gold', x: 45, y: 28 }, { kind: 'lamp_gold', x: 53, y: 28 },
      { kind: 'boat', x: 48, y: 29 }, { kind: 'boat', x: 56, y: 21 }, { kind: 'boat', x: 68, y: 25 }, { kind: 'boat', x: 55, y: 29 },
      { kind: 'crate', x: 62, y: 23 }, { kind: 'barrel', x: 64, y: 23 }, { kind: 'barrel', x: 64, y: 29 },
      { kind: 'sign', x: 61, y: 28, id: 'sign_pier', interact: { prompt: 'Read', do: [['toast', 'Skipper\'s Fishing Spot. No fish yet. Fish are on a break.', 'info']] } },
      // tide pools
      { kind: 'tidepool', x: 12, y: 48 }, { kind: 'tidepool', x: 22, y: 46 }, { kind: 'tidepool', x: 17, y: 52, id: 'tidepool_lucky',
        interact: { prompt: 'Peek', at: [17, 54], do: [['dialogue', 'cove_lucky_pool']] } },
      { kind: 'tidepool', x: 26, y: 56 }, { kind: 'tidepool', x: 10, y: 58 }, { kind: 'tidepool', x: 21, y: 61 }, { kind: 'tidepool', x: 28, y: 50 },
      { kind: 'shell', x: 14, y: 50 }, { kind: 'shell', x: 24, y: 52 }, { kind: 'shell', x: 19, y: 57 }, { kind: 'shell', x: 8, y: 54 },
      { kind: 'shell', x: 27, y: 60 }, { kind: 'shell', x: 13, y: 63 }, { kind: 'shell', x: 30, y: 45 },
      { kind: 'rock_grey', x: 15, y: 46 }, { kind: 'rock', x: 24, y: 59 }, { kind: 'rock_grey', x: 9, y: 51 },
      { kind: 'sign', x: 30, y: 47, id: 'sign_pools', interact: { prompt: 'Read', do: [['toast', 'Tide pools. Look, do not lick. The crabs are watching.', 'info']] } },
      // coral shallows: a sunken boat and reef rocks
      { kind: 'boat', x: 42, y: 57 }, { kind: 'rock_grey', x: 53, y: 50 }, { kind: 'rock_grey', x: 40, y: 48 }, { kind: 'rock', x: 56, y: 60 },
      { kind: 'sign', x: 36, y: 44, id: 'sign_coral', interact: { prompt: 'Read', do: [['toast', 'Coral shallows. Wading is fine. Jellyfish are not fine.', 'info']] } },
      // pirate-imp camp
      { kind: 'tent', x: 9, y: 71, look: { cloth: '#c8503c', trim: '#f4ecd8' } }, { kind: 'tent', x: 20, y: 70, look: { cloth: '#3d5aa8', trim: '#f4ecd8' } },
      { kind: 'tent', x: 25, y: 79, look: { cloth: '#c8503c', trim: '#f4ecd8' } },
      { kind: 'campfire', x: 16, y: 76 }, { kind: 'log', x: 13, y: 78 }, { kind: 'log', x: 18, y: 79 },
      { kind: 'barrel', x: 12, y: 73 }, { kind: 'barrel', x: 13, y: 73 }, { kind: 'crate', x: 14, y: 73 }, { kind: 'barrel', x: 26, y: 74 }, { kind: 'crate', x: 5, y: 82 },
      { kind: 'boat', x: 5, y: 84 }, { kind: 'boat', x: 22, y: 84 },
      { kind: 'banner_red', x: 11, y: 70 }, { kind: 'banner_red', x: 29, y: 77 },
      { kind: 'sign', x: 30, y: 73, id: 'sign_imps', interact: { prompt: 'Read', do: [['toast', 'IMP CAMP. KEEP OWT. (crabs are fine. crabs are friends. crabs know too much.)', 'info']] } },
      // reef
      { kind: 'rock_grey', x: 38, y: 82 }, { kind: 'rock_grey', x: 44, y: 70 }, { kind: 'rock_grey', x: 52, y: 84 }, { kind: 'rock', x: 58, y: 79 },
      { kind: 'coral', x: 41, y: 77 }, { kind: 'coral_blue', x: 49, y: 81 }, { kind: 'coral', x: 55, y: 74 }, { kind: 'coral_blue', x: 61, y: 83 },
      { kind: 'shell', x: 45, y: 79 }, { kind: 'shell', x: 56, y: 82 },
      { kind: 'sign', x: 33, y: 76, id: 'sign_reef', interact: { prompt: 'Read', do: [['toast', 'The Reef. Coral golems nap here. Do not tell them it is Monday.', 'info']] } },
      // lighthouse point
      { kind: 'lighthouse', x: 72, y: 57, id: 'lighthouse', interact: { prompt: 'Climb', at: [73, 60], do: [['dialogue', 'cove_lamp']] } },
      { kind: 'house_cottage_rose', x: 82, y: 58 }, { kind: 'bench', x: 69, y: 61 }, { kind: 'lamp_gold', x: 70, y: 63 }, { kind: 'lamp_gold', x: 76, y: 60 },
      { kind: 'flowers_red', x: 70, y: 59 }, { kind: 'flowers_wild', x: 76, y: 57 }, { kind: 'barrel', x: 80, y: 62 }, { kind: 'crate', x: 81, y: 62 },
      { kind: 'boat', x: 66, y: 72 }, { kind: 'palm', x: 83, y: 66 }, { kind: 'palm_tall', x: 68, y: 66 }, { kind: 'palm', x: 84, y: 72 },
      { kind: 'sign', x: 77, y: 67, id: 'sign_lighthouse', interact: { prompt: 'Read', do: [['toast', 'Gullwing Light. Status: dark. Thank you for noticing.', 'info']] } },
      // the sandbar: wreck, cargo, a ring of rocks and coral (open to the south)
      { kind: 'boat', x: 69, y: 7 }, { kind: 'boat', x: 87, y: 15 }, { kind: 'barrel', x: 74, y: 19 }, { kind: 'crate', x: 75, y: 19 }, { kind: 'barrel', x: 85, y: 8 },
      { kind: 'palm_tall', x: 72, y: 6 }, { kind: 'palm', x: 88, y: 6 },
      ...ring(80, 13, 9.4, 18, ['rock_ring', 'coral', 'coral_blue', 'rock_grey']),
    ],
    spawns: [
      // dunes and village outskirts: gulls (they steal, politely)
      { kind: 'gull', area: [8, 8, 32, 12], n: 3, respawn: 50, levelOffset: -2 },
      { kind: 'gull', area: [8, 38, 28, 6], n: 2, respawn: 50, levelOffset: -1 },
      // tide pools: crabs
      { kind: 'snippy_crab', area: [8, 44, 24, 20], n: 5, respawn: 60, levelOffset: -1 },
      // coral shallows: jellies
      { kind: 'bubble_jelly', area: [38, 46, 20, 20], n: 4, respawn: 70, levelOffset: 0 },
      // pirate camp
      { kind: 'pirate_imp', area: [6, 70, 24, 16], n: 4, respawn: 80, levelOffset: 0 },
      // reef: golems
      { kind: 'coral_golem', area: [36, 72, 26, 12], n: 3, respawn: 110, levelOffset: 1 },
      // lighthouse point: crabs and gulls again, tougher
      { kind: 'snippy_crab', area: [66, 66, 16, 14], n: 3, respawn: 60, levelOffset: 1 },
      { kind: 'gull', area: [66, 52, 20, 12], n: 2, respawn: 50, levelOffset: 1 },
      // Captain Clawsworth waits on the sandbar whenever he is not defeated; the arena trigger plays his intro.
      { kind: 'captain_clawsworth', at: 'boss_spawn', w: 3, h: 3, n: 1, respawn: 0, level: 17, boss: true, if: [['not', ['flag', 'clawsworth_defeated']]] },
    ],
    npcs: [],
    gates: [
      { id: 'tide_seal', at: 'tide_gate', w: 3, h: 1, question: { context: 'gate', difficulty: 2 }, seals: ['sandbar', 'boss_arena'] },
    ],
    chests: [
      { id: 'chest_1', at: 'chest_1', loot: 'cove_small' },
      { id: 'chest_2', at: 'chest_2', loot: 'cove_rune', rune: true },
      { id: 'chest_3', at: 'chest_3', loot: 'cove_small' },
      { id: 'chest_4', at: 'chest_4', loot: 'cove_rune', rune: true },
    ],
    triggers: [
      { id: 'boss_intro', area: [72, 19, 16, 3], once: true, if: [['not', ['flag', 'clawsworth_defeated']]], do: [['cutscene', 'cove_boss_intro']] },
    ],
    boss: { kind: 'captain_clawsworth', flag: 'clawsworth_defeated', intro: 'cove_boss_intro', gate: 'tide_seal' },
  },
};
