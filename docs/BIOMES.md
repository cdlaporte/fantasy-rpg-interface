# Round 3: the four biomes, the quest log, levels 13-20

Mr. Laporte (the teacher) asked for the remaining biomes, a quest log, and two more light-skinned looks. His
decisions: **level cap 20** (no new subclass tier); **all four biome gates open together after Old Mossback**
(players choose the order); **Q opens the quest log**.

## What the lead's prep commit already did (do not redo)

- `config.levelCap = 20`.
- Per-biome data folders `src/data/biomes/<id>/{zone,enemies,npcs,dialogues,quests,cutscenes,loot,items}.js`,
  already merged by `src/data/index.js`. Each zone file is a small PLACEHOLDER (24x18) with the required markers and
  the exit back to town; the biome package replaces it.
- Town exits `exit_dunes`, `exit_cove`, `exit_peaks`, `exit_aether` now lead to `<id>` at marker `entry_town`, gated by
  flag **`biomes_open`**, which the forest boss outro (and its onSkip) sets; Laporte announces it.
- **Player-level scaling** (`src/core/world.js` spawnFrom): a zone with `scaleToPlayer: true` and `levelRange: [lo, hi]`
  spawns each enemy at `clamp(playerLevel + (spawn.levelOffset || 0), lo, hi)`; spawns with `boss: true` get one level
  more. `ents.spawn` rescales hp/power/xp from the def's own level along the balance curves, so author each def at the
  level where its numbers are designed (normally the biome's middle level) and use `levelOffset` (-2..+2) to make some
  spawns weaker or tougher.
- Tooling reads ids from data: `tools/validate-data.mjs` validates every zone in `data.zones`, accepts any enemy kind
  and loot table that exists in the data, and checks a zone's own `required: [...]` markers. The narrative test
  accepts any zone's markers, and a cutscene may declare `zone: '<id>'` for its marker checks.
- Debug: scenarios `biome` and `biome_boss` (`__game.scenario('biome_boss', {zone: 'cove', level: 17})`), teacher
  "Go to" places `<id>` and `<id>_boss`. Both rely on the zone def field **`boss: {kind, flag, intro, gate}`**
  (enemy id of the boss, its defeat flag, its intro cutscene id, and the id of the rune gate in front of its arena).
- New closed vocabulary (names fixed in `src/contracts.js`; base prop defs with the same ids in `src/data/props.js`;
  package B draws them):
  - prop models / prop ids: `palm` (+`palm_tall`), `cactus` (+`cactus_round`), `ruin_pillar` (+`ruin_pillar_broken`),
    `obelisk`, `pottery`, `dune` (flat, walkable), `shell` (flat), `coral` (+`coral_blue`), `boat` (3x2),
    `tidepool` (2x2, walkable), `lighthouse` (3x3 building, door 1), `snowman`, `igloo` (3x2, door 1), `snow_pine`,
    `ice_spire`, `cloud_puff` (flat), `floating_rock` (2x2), `star_lamp`, `orrery` (3x3), `moon_flower` (flat).
    Existing props remain available (tents, crates, barrels, rocks, crystals, flowerbeds, lamps, campfires, bridge,
    fences, statues, banners, signs, tree_blossom, pine, bush_flower, gate_arch, rune_gate, table_umbrella, ...).
  - creature features: quadruped `claws stinger shell_back long_ears horns`; blob `tentacles bubbles`;
    flyer `wings_insect`; plant `cactus seaweed`; golem `sandy icy coral starry` (plus all existing features).
  - boss heroes (creature `look.hero`): `sphinx` (quadruped base), `crab_king` (quadruped base), `yeti` (golem
    base). Malgrim Ascended reuses the humanoid hero `malgrim` with `size: 1.6` and `aura: {style: 'storm'}`.
  - palettes `dunes`, `cove`, `peaks`, `aether` exist as stubs (package B makes them real).

## The four biomes

| Zone id | Name | levelRange | Town gate | Map edge to town | Boss (kind / defeat flag) |
| --- | --- | --- | --- | --- | --- |
| `dunes` | Sunscorch Dunes | [10, 16] | east (`gate_dunes`) | exit on the WEST edge | `sultana_sandsnout` / `sandsnout_defeated` |
| `cove` | Gullwing Cove | [11, 17] | south-west (`gate_cove`) | exit on the NORTH edge | `captain_clawsworth` / `clawsworth_defeated` |
| `peaks` | Frostwhistle Peaks | [13, 19] | north (`gate_peaks`) | exit on the SOUTH edge | `grumbleflake` / `grumbleflake_defeated` |
| `aether` | Aether Gardens | [15, 20] | north portal (`gate_aether`) | exit on the SOUTH edge | `malgrim_ascended` / `malgrim_defeated` |

Tone everywhere: bright, friendly, funny, never dark or scary; defeated enemies "poof". Mr. Laporte is the calm,
dry-witted headmaster (short deadpan lines). Dialogue lines <= 110 characters.

### Sunscorch Dunes (desert)
Golden dunes, a palm oasis, sandstone ruins with obelisks, a merchant caravan camp. Enemies (ids fixed):
`scarab` (small swarming beetle, quadruped `shell_back` `claws`), `dust_devil` (flyer whirlwind that dashes),
`cactling` (plant `cactus`, turret that shoots needles), `sand_scorpion` (quadruped `stinger` `claws`, charger with a
poison sting zone), `sandstone_golem` (golem `sandy`, slow, ground slams). Boss **Sultana Sandsnout**, a riddling
sphinx (`hero: 'sphinx'`): she loves riddles, so her shield phases are framed as her riddles (the Unit 4 questions).
NPCs: caravan merchant `ziva` (sells desert goods via dialogue), archaeologist `professor_dusty`. Quests:
`dunes_lost_caravan` (main: find the caravan's camels/crates, then the ruins and the boss), `dunes_oasis_water`.

### Gullwing Cove (beach)
Sandy beach, tide pools, a wooden pier and boats, a red-and-white lighthouse, coral shallows, a small fishing village.
Enemies: `snippy_crab` (quadruped `claws` `shell_back`, skirmisher), `gull` (flyer `wings_bird`, swooping swarmer that
steals gold), `bubble_jelly` (blob `tentacles` `bubbles`, floats, zaps), `pirate_imp` (humanoid with bandana and
cutlass-like `sword`, skirmisher that throws bottles), `coral_golem` (golem `coral`). Boss **Captain Clawsworth**,
a giant crab captain with a hat (`hero: 'crab_king'`). NPCs: lighthouse keeper `marlo`, fisher kid `skipper`.
Quests: `cove_lighthouse_dark` (main: relight the lighthouse, then the boss), `cove_lost_shells`.

### Frostwhistle Peaks (snow; bright and sparkly, not grim)
Snowfields, frozen pond, ice crystal spires, an igloo village, snow pines, a summit arena. Enemies: `snow_bunny`
(quadruped `long_ears`, fast swarmer), `frost_sprite` (flyer `wings_fairy` + `glow`, ranged ice shards),
`yeti_cub` (quadruped `mane`, charger that rolls snowballs), `ice_golem` (golem `icy`), `penguin_knight` (humanoid
in plate with a spear, guard-like skirmisher). Boss **Grumbleflake**, the grumpy yeti (`hero: 'yeti'`).
NPCs: igloo innkeeper `nana_frost`, snow scientist `dr_flurry`. Quests: `peaks_lost_mittens`, `peaks_summit`
(main: climb to the summit and the boss).

### Aether Gardens (sky garden; the finale)
Floating islands joined by cloud paths and bridges, star lamps, moon flowers, a giant orrery, a starry rune floor.
Use the `cloud` and `starfloor` tiles; the space between islands is unwalkable (package B adds a sky void tile or the
zone uses solid tiles drawn as open sky; coordinate through the notes). Enemies: `star_sprite` (flyer `glow`),
`cloud_puff` enemy id `cloud_puffling` (blob, floats, bumps), `clockwork_owl` (flyer `wings_bird`, turret that fires
gears), `astral_golem` (golem `starry` `crystal`), `moon_moth` (flyer `wings_insect`, sleep-dust zone). Boss
**Malgrim Ascended**: Malgrim the Sealweaver from the opening ambush turns out to be behind all the seals; a 3-phase
duel (barriers, summons, star beams) with two shield questions. NPC: astronomer `celeste`. Quests:
`aether_star_charts`, `aether_finale` (main). The outro is the "end of term" finale: Laporte arrives, a short, warm
send-off (the classmates appear), flag `malgrim_defeated`, a celebratory toast, and the player is returned to town.
The finale must not lock the game: after it, free play continues.

## Zone checklist (each biome package)

- Replace the placeholder zone with a ~96x96 macro-grid map (`src/data/zones/forest.js` and `mapgen.js` are the
  model; read `docs/notes/world.md`): a readable journey from `entry_town` past the NPC camp, through 4-5 enemy
  regions, a rune gate (zone `gates` entry with a `question: {context: 'gate', difficulty: 2}` and `seals`) in front
  of the boss arena. Keep `id`, `entry: 'entry_town'`, `scaleToPlayer: true`, `levelRange`, `palette: '<id>'`, the
  exit back to town on the specified edge, and `required: ['entry_town', 'respawn', 'camp', 'boss_arena',
  'boss_spawn', ...your own]`. Set `filler` and `shore` sensibly for the biome (deserts and snow should not fill gaps
  with trees). Set `boss: {kind, flag, intro: '<id>_boss_intro', gate: '<rune gate id>'}`.
- 3-4 chests (`<id>_small`, `<id>_rune` loot, 1-2 `rune: true`), 4-6 spawn regions (respect the 24-awake-enemy cap:
  `node tools/validate-data.mjs <id>` prints the bubble budget), the boss as a spawn with `boss: true`,
  `respawn: 0`, `if: [['not', ['flag', '<defeat flag>']]]`, and a `once` trigger at the arena playing the intro.
- Enemies: 5 regular kinds + the boss, each with a distinct behaviour from the existing brains
  (`wander chaser skirmisher charger turret swarmer summoner ambusher flee guard boss`) and attack blocks
  (`melee_arc projectile multishot beam dash aoe_ring ground_target summon buff_self heal zone blink`), telegraphed.
  Numbers from the balance sheet in `docs/CLASSES.md` at the def's level (mid-biome), round 2 adjustments in
  `docs/notes/r2c.md` (enemy hp x0.6 vs the sheet, xp +30%). Boss: `boss: {name, phases: [3], shieldAt: [0.66,
  0.33], shieldDifficulty: 2, barks}`, hp tuned so a player at the biome's top-of-range minus 1 with companions
  wins in ~1.5-2.5 minutes (`docs/notes/r2c.md` has how Mossback was measured), `onDeath: {do: [['cutscene',
  '<id>_boss_outro']]}`.
- 2-3 NPCs (`zone: '<id>'`, looks built with the helpers in `src/data/looks.js` NPC_LOOKS style, routines covering 24h
  on your markers, barks), dialogues with real choices that start the side quests, 2-3 quests with rewards sized for
  levels 10-20, loot tables, 2-4 new items (consumables or cosmetics; cosmetics need an outfitter entry, which is not
  yours, so prefer drops), cutscenes `<id>_boss_intro` / `<id>_boss_outro` (with `zone: '<id>'` and `onSkip`).
- XP: keep each biome worth about 1.5-2 levels for a player who clears its quests and kills what is on the way, so
  level 20 is reached around the end of the fourth biome.

## Ownership

| Package | Owns |
| --- | --- |
| A. Levels 13-20 | `src/core/progression.js`, `src/core/kits/**`, `src/data/classdefs/**`, `src/data/specs/**`, `src/data/boondefs/**`, `tests/node/kit-*.test.mjs`, `tests/node/r2c-*.test.mjs`, `tests/node/meta-progression.test.mjs`, `tests/node/r2a-progression.test.mjs`, `docs/CLASSES.md`, `docs/notes/r3a.md` |
| B. Biome art | `src/render/r3d/**`, `src/render/r2d/**`, `src/data/palettes.js`, `src/data/tiles.js` (append only), `src/data/props.js`, `src/contracts.js` (vocabulary lists only), `src/ui/portraits.js` (creature portraits), `tools/gallery-fixture.js`, `tools/gallery.js`, `tools/map-preview.mjs`, `tests/e2e/r3d*`, `tests/e2e/r2d*`, `docs/notes/r3b.md` |
| C. Dunes | `src/data/biomes/dunes/**`, `docs/notes/r3-dunes.md` |
| D. Cove | `src/data/biomes/cove/**`, `docs/notes/r3-cove.md` |
| E. Peaks | `src/data/biomes/peaks/**`, `docs/notes/r3-peaks.md` |
| F. Aether + finale | `src/data/biomes/aether/**`, `docs/notes/r3-aether.md` |
| G. Quest log + looks | new `src/ui/questLog.js`, `src/ui/modalHost.js`, `src/ui/index.js`, `src/ui/pauseMenu.js`, `src/ui/panel.js`, `src/platform/bindings.js`, `src/ui/pickers.js`, `css/ui.css`, `src/data/looks.js`, `src/ui/modalKit.js` (controls card rows), look-count assertions in tests, `tests/e2e/ui*.cjs`, `docs/notes/r3g.md` |

Tests the prep commit broke and their owner: `meta-progression` "level up ... cap" and `r2a-progression` "level
down" (A: the cap is now 20).
