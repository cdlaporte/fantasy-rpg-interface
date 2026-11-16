// Zone 'aether': Aether Gardens (96 x 96 from a 24 x 24 macro grid, cell 4), the finale biome. Floating garden
// islands over open sky, joined by cloud paths and plank bridges. Journey (south to north):
//   portal pier (entry_town, south edge) -> landing isle -> Celeste's observatory camp -> branches:
//   west cloud path -> Moon Meadow (SW, moon moths) -> north cloud path -> Star Garden (W, star sprites) -> NW islet (rune chest)
//   east bridge -> Cloud Banks (SE, cloud pufflings, Nimbus) -> north bridge -> Crystal Terraces (E, astral golems) -> NE islet
//   north cloud path -> the Orrery Plaza (center, clockwork owls, the Great Orrery) -> east/west to the terraces / garden
//   -> the Summit Stair with the rune gate `summit_seal` -> Malgrim's arena on the highest island (N).
// Macro legend: ' ' open sky (solid, see SKY below), L landing, c camp, m moon meadow, k cloud banks, p orrery plaza,
// s star garden, g crystal terraces, i islets, A summit arena. Cloud paths, bridges, the summit stair, the arena and the
// plaza rings are `paint` ops on top of the macro grid.
import TILES from '../../tiles.js';

// Open sky between the islands: package B adds a solid "sky void" tile drawn as open sky. Until it exists the zone uses
// `water` (same collision class: blocks walkers, not flyers or projectiles), with shorelines turned off. The lead can
// also swap it by hand at merge: legend char ' ' (space), plus `filler` and the `paint` ops that use SKY.
const SKY_IDS = ['sky', 'sky_void', 'void', 'open_sky', 'skyvoid', 'aether_void'];
const SKY = (TILES.find((t) => SKY_IDS.includes(t.id) && t.solid) || { id: 'water' }).id;

const lamp = (x, y) => ({ kind: 'star_lamp', x, y });

export default {
  aether: {
    id: 'aether', name: 'Aether Gardens', palette: 'aether', music: 'aether', levelRange: [15, 20], seed: 1462,
    entry: 'entry_town',
    scaleToPlayer: true,            // enemy spawns: level = clamp(player level + spawn.levelOffset, levelRange)
    required: ['entry_town', 'respawn', 'camp', 'boss_arena', 'boss_spawn', 'summit_gate', 'orrery_plaza', 'moon_meadow',
      'star_garden', 'cloud_banks', 'crystal_terraces', 'celeste_post', 'nimbus_post'],
    boss: { kind: 'malgrim_ascended', flag: 'malgrim_defeated', intro: 'aether_boss_intro', gate: 'summit_seal' },
    macro: {
      cell: 4,
      warp: 1.7,             // rounder island coasts (every island is 3+ cells wide, every sky gap 2+ cells)
      rows: [
        '           AAA          ',
        '          AAAAA         ',
        '  iii    AAAAAAA    iii ',
        '  iii    AAAAAAA    iii ',
        '  iii    AAAAAAA    iii ',
        '          AAAAA         ',
        '                        ',
        ' sss               ggg  ',
        ' sssss    ppppp   ggggg ',
        ' sssss   ppppppp  ggggg ',
        ' sssss   ppppppp  ggggg ',
        ' sssss   ppppppp  ggggg ',
        '  ssss   ppppppp  gggg  ',
        '  sss     ppppp    ggg  ',
        '                        ',
        '  mmm              kkk  ',
        ' mmmmm    ccccc   kkkkk ',
        ' mmmmmm  ccccccc  kkkkk ',
        ' mmmmmm  ccccccc  kkkkk ',
        ' mmmmmm  ccccccc  kkkkk ',
        ' mmmmm    LLLLL   kkkk  ',
        '  mmm     LLLLL    kkk  ',
        '           LLL          ',
        '           LLL          ',
      ],
      legend: {
        ' ': SKY,
        L: { tile: 'grass', mix: [['cloud', 0.3, 4], ['flowers', 0.1, 3]],
          deco: { moon_flower: 0.03, flowers_blue: 0.02, bush_flower: 0.01 },
          fringe: { cloud_puff: 0.35, moon_flower: 0.1 } },
        c: { tile: 'grass', mix: [['cloud', 0.2, 5], ['flowers', 0.12, 3]],
          deco: { moon_flower: 0.015, flowers_blue: 0.01 },
          fringe: { cloud_puff: 0.3, tree_blossom: 0.06, moon_flower: 0.08 } },
        m: { tile: 'tallgrass', mix: [['grass', 0.35, 5], ['flowers', 0.15, 3]],
          deco: { moon_flower: 0.09, flowers_blue: 0.03, tree_blossom: 0.012, crystal_pink: 0.004 },
          fringe: { cloud_puff: 0.25, moon_flower: 0.2, tree_blossom: 0.06 } },
        k: { tile: 'cloud', mix: [['grass', 0.12, 4]],
          deco: { cloud_puff: 0.06, moon_flower: 0.008 },
          fringe: { cloud_puff: 0.5 } },
        p: { tile: 'starfloor', mix: [['rune_floor', 0.2, 5]],
          deco: { moon_flower: 0.01 },
          fringe: { cloud_puff: 0.3 } },
        s: { tile: 'grass', mix: [['flowers', 0.3, 3], ['cloud', 0.1, 5]],
          deco: { star_lamp: 0.012, tree_blossom: 0.025, flowers_blue: 0.03, bush_flower: 0.01, moon_flower: 0.02 },
          fringe: { cloud_puff: 0.25, tree_blossom: 0.1 } },
        g: { tile: 'stone', mix: [['rune_floor', 0.3, 4], ['cloud', 0.1, 5]],
          deco: { crystal: 0.035, crystal_pink: 0.02, rock_grey: 0.008 },
          fringe: { crystal: 0.18, cloud_puff: 0.25, crystal_pink: 0.06 } },
        i: { tile: 'grass', mix: [['flowers', 0.4, 2]], deco: { moon_flower: 0.05 }, fringe: { cloud_puff: 0.4 } },
        A: { tile: 'rune_floor', mix: [['cloud', 0.15, 4]], fringe: { cloud_puff: 0.4 } },
      },
      shore: { shallows: false },
      filler: SKY,
      decoClear: 2.2,
      paint: [
        // ---- coastlines first (later ops draw floors, paths and bridges over them). The summit and the plaza are
        // perfect circles (built places); the garden islands get ragged bites so they read as drifting land.
        { disc: [50, 13, 17], r0: 12.2, tile: SKY },
        { disc: [50, 44, 17], r0: 11.6, tile: SKY },
        { at: [22, 65], r: 6.5, ragged: 3, tile: SKY },      // Moon Meadow: a crescent, open to the north-east
        { at: [3, 88], r: 5, ragged: 3, tile: SKY },
        { at: [3, 61], r: 4, ragged: 3, tile: SKY },
        { at: [3, 29], r: 5, ragged: 3, tile: SKY },         // Star Garden
        { at: [24, 30], r: 5, ragged: 3, tile: SKY },
        { at: [3, 55], r: 5, ragged: 3, tile: SKY },
        { at: [24, 54], r: 4, ragged: 2, tile: SKY },
        { at: [72, 30], r: 4.5, ragged: 3, tile: SKY },      // Crystal Terraces
        { at: [92, 31], r: 4.5, ragged: 3, tile: SKY },
        { at: [72, 52], r: 4.5, ragged: 3, tile: SKY },
        { at: [92, 52], r: 4.5, ragged: 3, tile: SKY },
        { at: [36, 67], r: 3, ragged: 2, tile: SKY },        // camp isle
        { at: [64, 66], r: 3, ragged: 2, tile: SKY },
        { at: [37, 80], r: 4, ragged: 3, tile: SKY },
        { at: [63, 80], r: 4, ragged: 3, tile: SKY },
        { at: [7, 7], r: 3.5, ragged: 2, tile: SKY },        // islets
        { at: [88, 7], r: 3.5, ragged: 2, tile: SKY },
        // Cloud Banks: a puffy cloud made of round lobes
        { at: [80, 65], r: 5.5, ragged: 2, tile: 'cloud' },
        { at: [88, 70], r: 5.5, ragged: 2, tile: 'cloud' },
        { at: [76, 78], r: 6, ragged: 2, tile: 'cloud' },
        { at: [87, 81], r: 5.5, ragged: 2, tile: 'cloud' },
        { at: [93, 63], r: 4, ragged: 3, tile: SKY },
        { at: [70, 86], r: 3.5, ragged: 2, tile: SKY },
        // ---- the summit: a round rune floor around the boss arena, a starry duel circle, open to the stair
        { disc: [50, 13, 10.6], tile: 'rune_floor', reserve: true },
        { disc: [50, 13, 4.6], tile: 'starfloor', reserve: true },
        { disc: [50, 13, 4.6], r0: 3.6, tile: 'rune_floor', reserve: true },
        // ---- the Summit Stair: a 3-wide rune path over the sky, sealed at summit_gate [50, 28]
        { line: [50, 21, 50, 34], width: 3, tile: 'rune_floor', reserve: true },
        // ---- the Orrery Plaza: a starry disc with a rune ring around the Great Orrery
        { disc: [50, 44, 9.6], tile: 'starfloor', reserve: true },
        { disc: [50, 44, 7.2], r0: 6.2, tile: 'rune_floor', reserve: true },
        // ---- cloud paths (3 wide)
        { line: [50, 54, 50, 66], width: 3, tile: 'cloud', reserve: true },     // camp -> plaza
        { line: [24, 74, 38, 74], width: 3, tile: 'cloud', reserve: true },     // camp -> moon meadow
        { line: [14, 52, 14, 62], width: 3, tile: 'cloud', reserve: true },     // moon meadow -> star garden
        { line: [62, 44, 74, 44], width: 3, tile: 'cloud', reserve: true },     // plaza -> crystal terraces
        { line: [14, 18, 14, 30], width: 3, tile: 'cloud', reserve: true },     // star garden -> NW islet
        // ---- plank bridges (decks under the bridge props)
        { rect: [62, 73, 12, 3], tile: 'planks', reserve: true },               // camp -> cloud banks
        { rect: [22, 43, 16, 3], tile: 'planks', reserve: true },               // star garden -> plaza
        { rect: [81, 54, 3, 8], tile: 'planks', reserve: true },                // crystal terraces -> cloud banks
        { rect: [81, 18, 3, 10], tile: 'planks', reserve: true },               // crystal terraces -> NE islet
        // ---- the portal pier: a narrow cloud neck to the portal on the south edge
        { rect: [38, 88, 24, 8], tile: SKY },
        { line: [50, 84, 50, 96], width: 3, tile: 'cloud', reserve: true },
        { disc: [50, 85, 3.2], tile: 'cloud', reserve: true },
        // ---- camp ground and plaza approach
        { at: [49, 72], r: 5.5, ragged: 2, tile: 'grass', reserve: true },
        { rect: [52, 64, 5, 5], reserve: true },
      ],
    },
    markers: {
      entry_town: [50, 89],
      exit_town: [50, 95],
      portal: [50, 85],
      respawn: [50, 78],
      camp: [48, 74],
      camp_fire: [46, 71],
      celeste_post: [54, 69],
      celeste_bed: [41, 70],
      nimbus_bed: [45, 70],
      orrery_plaza: [50, 49],
      orrery_view: [55, 48],
      moon_meadow: [14, 72],
      star_garden: [12, 40],
      cloud_banks: [80, 72],
      nimbus_post: [78, 76],
      crystal_terraces: [82, 40],
      summit_gate: [50, 28],
      summit: [50, 23],
      boss_arena: [50, 13],
      boss_spawn: [50, 8],
      chest_1: [6, 80],
      chest_2: [13, 11],
      chest_3: [82, 11],
      chest_4: [88, 82],
    },
    exits: [
      { at: 'exit_town', w: 3, h: 1, to: 'town', marker: 'gate_aether' },
    ],
    props: [
      // the portal home
      { kind: 'gate_arch_aether', x: 48, y: 92 },
      lamp(47, 87), lamp(53, 87),
      { kind: 'sign', x: 52, y: 83, id: 'sign_portal', interact: { prompt: 'Read', do: [['toast', 'Aether Gardens. Mind the edges. The sky has no handrail.', 'info']] } },
      // Celeste's observatory camp
      { kind: 'tower', x: 53, y: 65, id: 'observatory', look: { wall: '#ece6f6', roof: '#4b3fa8', trim: '#ffd24a', door: '#5a3a8a', sign: 'book' },
        interact: { prompt: 'Knock', do: [['toast', 'A note on the door: "Stargazing. Back at dusk. Do NOT touch the big telescope." - C.', 'info']] } },
      { kind: 'tent', x: 39, y: 66, look: { cloth: '#c9b6ff', trim: '#ffd24a' } },
      { kind: 'tent', x: 43, y: 66, look: { cloth: '#9fd8ff', trim: '#ffffff' } },
      { kind: 'campfire', x: 46, y: 69 },
      { kind: 'log', x: 43, y: 72 },
      { kind: 'crate', x: 58, y: 70 },
      { kind: 'crate', x: 58, y: 71 },
      { kind: 'barrel', x: 57, y: 72 },
      { kind: 'bench', x: 51, y: 75 },
      { kind: 'banner', x: 40, y: 75, look: { cloth: '#4b3fa8', emblem: '#ffe680' } },
      lamp(38, 72), lamp(61, 74), lamp(48, 64),
      { kind: 'sign', x: 47, y: 64, id: 'sign_camp', interact: { prompt: 'Read', do: [['toast', 'North: the Orrery Plaza. West: Moon Meadow. East: the Cloud Banks.', 'info']] } },
      // Orrery Plaza: the Great Orrery and its ring of star lamps
      { kind: 'orrery', x: 49, y: 43, id: 'orrery',
        interact: { prompt: 'Align', do: [['flag.set', 'orrery_aligned', true], ['sfx', 'spell'],
          ['fx', { type: 'ring', at: 'orrery_plaza', r: 6, color: '#ffe680', dur: 1.2 }],
          ['fx', { type: 'sparkle', at: 'orrery_plaza', n: 40, r: 5, color: '#c9a6ff' }],
          ['toast', 'The planets click into line. Far to the north, the Summit Gate begins to glow.', 'good']] } },
      lamp(43, 38), lamp(57, 38), lamp(43, 50), lamp(57, 50), lamp(41, 44), lamp(59, 44),
      { kind: 'bench', x: 53, y: 51 },
      { kind: 'statue', x: 46, y: 36, look: { stone: '#e8e4f6', base: '#8f88b8' } },
      { kind: 'sign', x: 47, y: 52, id: 'sign_plaza', interact: { prompt: 'Read', do: [['toast', 'The Great Orrery. Please align gently. It is older than the Academy.', 'info']] } },
      // the Summit Stair and its gate
      { kind: 'gate_arch_aether', x: 48, y: 31 },
      lamp(48, 26), lamp(52, 26),
      // Malgrim's arena: star lamps and crystals around the duel circle
      lamp(41, 9), lamp(59, 9), lamp(41, 17), lamp(59, 17), lamp(50, 3),
      { kind: 'crystal', x: 44, y: 5 }, { kind: 'crystal_pink', x: 56, y: 5 },
      { kind: 'crystal', x: 40, y: 13 }, { kind: 'crystal_pink', x: 60, y: 13 },
      { kind: 'banner', x: 45, y: 4, look: { cloth: '#5b2a86', emblem: '#ffcf4a' } },
      { kind: 'banner', x: 55, y: 4, look: { cloth: '#5b2a86', emblem: '#ffcf4a' } },
      // bridges
      { kind: 'bridge_wide', x: 63, y: 73 }, { kind: 'bridge_wide', x: 68, y: 73 },
      { kind: 'bridge_wide', x: 25, y: 43 }, { kind: 'bridge_wide', x: 30, y: 43 },
      { kind: 'bridge_long', x: 81, y: 56 },
      { kind: 'bridge_long', x: 81, y: 20 }, { kind: 'bridge_long', x: 81, y: 24 },
      // Moon Meadow, Star Garden, Cloud Banks, Crystal Terraces: landmarks
      { kind: 'sign', x: 17, y: 70, id: 'sign_moon', interact: { prompt: 'Read', do: [['toast', 'Moon Meadow. Moths asleep. Please keep it that way. Shh.', 'info']] } },
      { kind: 'statue', x: 12, y: 38, look: { stone: '#fff6d0', base: '#c9a6ff' } },
      lamp(8, 34), lamp(18, 34), lamp(8, 46), lamp(18, 46),
      { kind: 'sign', x: 76, y: 70, id: 'sign_clouds', interact: { prompt: 'Read', do: [['toast', 'Cloud Banks. Do not hug the clouds. They hug back. Hard.', 'info']] } },
      { kind: 'ruin_pillar', x: 78, y: 36 }, { kind: 'ruin_pillar', x: 86, y: 36 }, { kind: 'ruin_pillar_broken', x: 86, y: 44 },
      // floating rocks drifting in the open sky
      { kind: 'floating_rock', x: 28, y: 58 }, { kind: 'floating_rock', x: 66, y: 58 }, { kind: 'floating_rock', x: 30, y: 16 },
      { kind: 'floating_rock', x: 68, y: 22 }, { kind: 'floating_rock', x: 6, y: 92 }, { kind: 'floating_rock', x: 88, y: 92 },
      { kind: 'floating_rock', x: 26, y: 86 }, { kind: 'floating_rock', x: 72, y: 88 },
    ],
    spawns: [
      { kind: 'moon_moth', area: [5, 64, 20, 18], n: 4, respawn: 70, levelOffset: -2 },
      { kind: 'cloud_puffling', area: [73, 63, 17, 20], n: 5, respawn: 60, levelOffset: -1 },
      { kind: 'clockwork_owl', area: [38, 34, 24, 18], n: 4, respawn: 60, levelOffset: 0 },
      { kind: 'star_sprite', area: [5, 30, 18, 22], n: 5, respawn: 60, levelOffset: 0 },
      { kind: 'astral_golem', area: [74, 30, 16, 20], n: 3, respawn: 120, levelOffset: 1 },
      // Malgrim Ascended waits on the summit whenever he is undefeated; the arena trigger plays aether_boss_intro.
      { kind: 'malgrim_ascended', at: 'boss_spawn', w: 3, h: 3, n: 1, respawn: 0, boss: true, if: [['not', ['flag', 'malgrim_defeated']]] },
    ],
    npcs: [],
    gates: [
      { id: 'summit_seal', at: 'summit_gate', w: 3, h: 1, question: { context: 'gate', difficulty: 2 },
        req: [['flag', 'orrery_aligned']], locked: 'The seal is dark and cold. Align the Great Orrery in the plaza to wake it.',
        seals: ['summit', 'boss_arena', 'boss_spawn'] },
    ],
    chests: [
      { id: 'chest_1', at: 'chest_1', loot: 'aether_small' },
      { id: 'chest_2', at: 'chest_2', loot: 'aether_rune', rune: true },
      { id: 'chest_3', at: 'chest_3', loot: 'aether_rune', rune: true },
      { id: 'chest_4', at: 'chest_4', loot: 'aether_small' },
    ],
    triggers: [
      // arriving: the main quest starts (no-op once started)
      { id: 'arrive', area: [46, 80, 9, 8], once: true, if: [['quest', 'aether_finale', 'none']],
        do: [['quest.start', 'aether_finale']] },
      { id: 'boss_intro', area: [44, 17, 13, 3], once: true, if: [['not', ['flag', 'malgrim_defeated']]],
        do: [['cutscene', 'aether_boss_intro']] },
    ],
  },
};
