# Round 3, package E: Frostwhistle Peaks

Branch `wp/r3peaks`. Owned: `src/data/biomes/peaks/**`, this file. Data only; nothing else touched.

## Files (all in `src/data/biomes/peaks/`)

- `zone.js`: 96x96 macro map (cell 4), journey south to north. Entry `entry_town` [48,90], exit [48,95] (3x1, south edge) to town
  `gate_peaks`. Snowfields (bunnies) -> hub: west the frozen pond (penguin knights; rune chest `chest_4` on the ice), east the igloo
  village (`camp` [74,79], `respawn` [71,79], `camp_fire`, `igloo_door`, `flurry_lab`) -> north through snow pine woods
  (yeti cubs, `chest_1` west, `chest_3` east) to the ice-crystal spire field (`spires` [48,60]: frost sprites, ice golems, three
  measurable spires `spire_a/b/c`) -> three cliff terraces (switchbacks, `switchback` [66,41], rune `chest_2` [15,42] in a west
  alcove, lookout pockets with benches/signs) -> approach terrace -> rune gate `summit_seal` (`rune_gate` [48,26], 3x1, difficulty 2,
  seals `boss_arena`/`boss_spawn`) -> summit arena (disc r 10 with an ice slab and a ring of spires; `boss_arena` [48,15],
  `boss_spawn` [48,8]; `once` trigger `boss_intro` at the arena mouth). `boss: {kind: 'grumbleflake', flag: 'grumbleflake_defeated',
  intro: 'peaks_boss_intro', gate: 'summit_seal'}`. 124 authored props + ~230 deco. Awake-enemy budget: 23 (cap 24).
- `enemies.js`: `snow_bunny` (swarmer: hop dash + thump; drops `lost_mitten`), `frost_sprite` (flying skirmisher: ice shard, shard fan,
  frost patch, blink), `yeti_cub` (charger: rolled snowball, tumble dash, swat, grumble buff <50%), `penguin_knight` (skirmisher at
  spear range: thrust, belly slide, shield-up buff; humanoid look in plate), `ice_golem` (ambusher that waits as a ghostly pillar:
  ice slam, frost stomp, shard burst), boss `grumbleflake` (hero `yeti`, 3 phases, shields at 66%/33%, difficulty 2).
- `npcs.js`, `dialogues.js`: `nana_frost` (igloo innkeeper; buys cocoa for 24 gold, rest, quest hub for summit and mittens, rel gift),
  `dr_flurry` (spire survey quest, similar-triangle toasts), `grumbleflake_cub` (spawned by the outro; extra dialogue and a reward
  when `nana_mittens_done`). 24 h routines on `igloo_door`, `home_nana`, `camp_fire`, `flurry_lab`, `spires`, `home_flurry`.
- `quests.js`: `peaks_summit` (main, 7 steps: spires, switchback, rune gate, unseal, arena, boss, talk to Nana), `peaks_lost_mittens`
  (5 mittens from bunnies), `peaks_ice_survey` (optional: measure 3 spires, pop 4 sprites).
- `cutscenes.js`: `peaks_boss_intro`, `peaks_boss_outro` (both `zone: 'peaks'`, `onSkip`). Outro: Grumbleflake shrinks into a cozy yeti,
  it was only cold paws, loot chest `boss_grumbleflake`, flag `grumbleflake_defeated`, Laporte: "a very large animal with cold paws
  is not a villain. It is a customer."
- `loot.js`: `peaks_small`, `peaks_rune`, `boss_grumbleflake`. `items.js`: `frost_cocoa` (heal over time 220 over 12 s), `icicle_bomb`,
  `lost_mitten` (key), `cape_snowflake` (cosmetic, drop only).

## For package B / the lead (reconcile at merge)

- Ground tiles: B's snow/ice tiles were not in my worktree. `zone.js` has constants at the top: `SNOW = 'cloud'` (ground, white),
  `ICE = 'stone'` (walkable frozen pond, the summit slab, the gate flagstones), `WALL = 'cliff'`, `GLINT = 'crystal'` (blue ice
  glints mixed into the cliffs). Paths use `path` over snow. To use real tiles change only those constants.
  Frozen pond: painted disc at [18,80] r 8 (tile ICE), `chest_4` [19,81] on it.
- Props used from the vocabulary: `igloo` (5), `snowman`, `snow_pine` (woods deco), `ice_spire` (many, 3 with `interact`), plus
  crystal, rocks, lamps, tents, fences, banners, signs, benches, crates, barrels, cart, tables.
- Creature looks: yeti_cub quadruped `mane`; bunny `long_ears`; sprite flyer `wings_fairy` + `glow`; golem `icy` + `crystal`;
  boss `hero: 'yeti'` (golem rig, size 2.4); `grumbleflake_cub` is the same hero at size 0.7.

## Balance and measurements

Enemies follow the sheet at each def level (snow_bunny 13, sprite 14, cub 15, penguin 16, golem 17; hp x0.6, power 2+1.5L, xp
5+3L, no +30%) with role multipliers on hp (0.55 / 0.75 / 1 / 1.1 / 1.5). Level offsets: bunnies -2, sprites -1, golems +1. Kill xp
is the plain sheet value (about 50 at level 15) on purpose: biome total is about two levels (15 kills ~ 750 xp, quests 360+190+210
x1.25 turn-in, boss 520).

Boss: `hp 6400, power 17` at def level 16 (spawns at player level + 1, 19 for a level 18 player: 48,846 hp shown). Power is below the
sheet (26) on purpose: at 26 the scripted student sorcerer was downed (like Mossback, the squishy specs suffer from leaps and the
stampede). Measured with `tests/node/r2c-sim.mjs` setup/fighter, level 18, both classmates, 4 small + 2 big potions, shields
answered at once, boss at level 19 (script: scratchpad `boss.mjs`):

| spec | student: shield 1 / shield 2 / kill | expert |
| --- | --- | --- |
| knight | 34.7 / 73 / 110 s | 34.8 / 70 / 103 s |
| sorcerer | 51 / 101 / 150 s (5 potions) | 40 / 73 / 125 s (3 potions) |
| monk | 30 / 62 / 95 s | 33 / 80 / 106 s |
| thief | 34 / 66 / 96 s | 31 / 62 / 86 s |

Target 1.5-2.5 min: met (knob: `grumbleflake.stats.hp`, about 6400 -> 100 s for a knight, +10% hp = +10 s).

## Playthrough check (Node, bot helpers, scenario `biome` level 15)

All five kinds spawn and die (single kill 1.6-6 s). Nana (buy cocoa, both quests), Dr. Flurry (survey), 5 mittens from bunnies
(~230 s of farming), three spires measured by E, 4 sprites, switchback reach, rune gate asked its question and opened
(`gate_summit_seal`), intro played once, boss killed (two shield questions in `auto` mode), outro set `grumbleflake_defeated`,
chest spawned, all three quests `done`, no errors. One 3D browser run of `biome` showed no errors (placeholder art).

## Known gaps / notes

- Grumbleflake's cub is spawned by the outro only (like Mossback's sprout); it is gone after leaving the zone.
- The `flee` brain only attacks when cornered (code in `ai.js`), so the ranged frost sprite uses `skirmisher`.
- Ambusher golems render as a ghostly (alpha 0.35, sleeping) golem until woken; B may want an `icy` look that reads as a spire.
- `node --test tests/node`: only the two failures BIOMES.md assigns to package A (`meta-progression` level cap,
  `r2a-progression` level down) remain.
