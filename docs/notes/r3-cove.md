# Round 3, package D: Gullwing Cove

Branch `wp/r3cove`. Owns `src/data/biomes/cove/**` only (zone, enemies, npcs, dialogues, quests, cutscenes, loot, items).
No renderer, shared data or test files changed.

## Files

- `zone.js`: `cove`, 96 x 96 from a 24 x 24 macro grid (cell 4), palette `cove`, levelRange [11, 17], `scaleToPlayer`.
  Journey: `entry_town` (north edge, exit `exit_town` 3x1 -> town `gate_cove`) -> dunes -> **fishing village** (houses,
  plaza with well, Pearl's chowder stand, cafe umbrellas, boats) with a 25-tile **pier** (planks painted over the sea,
  lamps, boats) -> **tide pools** (west beach, 7 `tidepool` props, shells) -> **coral shallows** (walkable `shallows`
  with solid coral; sunken boat) -> **pirate-imp camp** (SW: tents, fire, barrels, two wrecks) -> **reef** (S: rocks,
  coral) -> **lighthouse point** (SE: `lighthouse`, cottage, bench, lamps, signs) -> sand **causeway** north with the rune
  **tide gate** (`tide_seal`, 3x1, difficulty 2, seals `sandbar` and `boss_arena`) -> **sandbar arena** (NE, wreck deck of
  planks, two boats, ring of rocks/coral open to the south). Sea is solid `water`; shallows and coral shallows walk.
  `boss: {kind: 'captain_clawsworth', flag: 'clawsworth_defeated', intro: 'cove_boss_intro', gate: 'tide_seal'}`.
  4 chests (`cove_small` x2, `cove_rune` x2 with `rune: true`; the last is on the sandbar behind the gate). Spawns:
  gulls (dunes, beach, point), snippy crabs (tide pools, point), bubble jellies (coral shallows), pirate imps (camp),
  coral golems (reef; `levelOffset` -2..+1 so the entry is gentler), boss spawn `boss: true`, `respawn: 0`, flag-gated;
  `once` trigger `boss_intro` at the arena mouth. Validator: 19 enemies in the worst 30-tile bubble (cap 24).
  Required markers present (`entry_town respawn camp boss_arena boss_spawn`) plus village, NPC, quest and chest markers.
- `enemies.js`: `snippy_crab` L12 (skirmisher: pinch cone, telegraphed scuttle dash, `claws_up` buff below 50%, flees at
  20%), `gull` L12 (swarmer: circle + straight swoop, `gift_from_above` slowing splat), `bubble_jelly` L13 (flying chaser:
  zap beam, ring of 8 slow bubbles, shock ring), `pirate_imp` L14 (skirmisher, keep 5: arcing bottle, 3-bottle spread,
  cutlass, flees), `coral_golem` L15 (charger: long tide-rush, slam, spiky slowing patches). Numbers from the sheet at the
  def's level: hp 6 L^1.4 x0.6 (gull x0.8, golem x1.1), power 2 + 1.5 L, xp 5 + 3 L (no +30%: the later levels are
  bigger, and BIOMES asks 1.5-2 levels per biome). **Captain Clawsworth** (`captain_clawsworth`, L17, hero `crab_king`,
  hp 6500, power 23, xp 600): P1 cannon shot (ground target), claw snap, bubble volley; P2 + call crew (summons
  `pirate_imp`) + tidal sweep beam + shell stomp; P3 + side rush dash + captain's orders buff. Shields at 66% / 33%,
  `shieldDifficulty` 2, `onDeath` -> `cove_boss_outro`.
- `npcs.js`: `marlo` (keeper; village post by day, plaza in the evening), `skipper` (fisher kid; pier by day, tide pools
  late afternoon), `pearl` (chowder cook, stall by day), `clawsworth_tiny` (outro helper). Routines cover 24 h.
- `dialogues.js`: `marlo`, `skipper`, `pearl` (hub trees, quest offers with real choices, state-aware "active" lines, gifts),
  `cove_lamp` (the lighthouse lamp room, opened by the `lighthouse` prop), `cove_lucky_pool` (tide pool prop),
  `clawsworth_tiny`.
- `quests.js`: `cove_lighthouse_dark` (main, Marlo: glow jelly x3 from jellies -> brass lens from imps -> reach the
  lighthouse -> relight the lamp (dialogue option sets flag `lighthouse_lit`, takes lens and jelly) -> `gate_tide_seal` ->
  boss -> talk to Marlo; 250 xp, 200 gold, 2 big potions, 2 chowders), `cove_lost_shells` (Skipper: ask the hermit crab
  in the lucky pool (flag `cove_lucky_shell`) -> 5 conch shells total from snippy crabs -> talk; 120 xp, 90 gold),
  `cove_gull_gold` (optional third, Pearl: shoo 6 gulls -> talk; 100 xp, 80 gold, 3 chowders). All start from dialogue.
- `cutscenes.js`: `cove_boss_intro` (camera, smoke, shockwave, Clawsworth demands "hats", toast about shields; `onSkip`
  spawns him), `cove_boss_outro` (poof, hat-sized Captain, `clawsworth_defeated`, `boss_clawsworth` chest, Laporte:
  "Two congruent claws, by the way. I checked." ... "Twelve."). Both `zone: 'cove'`.
- `loot.js`: `cove_small`, `cove_rune`, `boss_clawsworth`. `items.js`: `sea_chowder` (hot 120 over 12 s), `bubble_bomb`,
  `hat_captain` (boss chest, feather-style tricorn), key items `conch_shell`, `glow_jelly`, `brass_lens`.

## Balance and measurements (Node, `tests/node/r2c-sim.mjs` scripted fighter, companions, 4 small + 2 big potions)

Boss at player level 16 (boss level 17), student profile, shields answered at once (`questions: auto`):
warrior knight 113 s (first shield 31 s), berserker 104, battlemage 95-110, mage conjurer 87-132, sorcerer 144,
monk 98, archer 113, thief 97, ninja 138; expert profile knight 93, sorcerer 128. Level 13: 89 s, level 17: 103 s,
level 20: 89 s (knight). One down in about ten runs (a conjurer, 713 hp). Knob: `captain_clawsworth.stats.hp`
(6500 -> ~110 s; each +1000 is about +15 s). Single enemies die in 3-5 s at level 13 (warrior with classmates).
XP: main + shells + gulls = 470, boss 600 (scales with level), 12-15 kills on the main path ~600: about 2 levels at 14-16.

## Playthrough check (Node, bot)

`game.debug.scenario('biome', {zone: 'cove', level: 14})`: all three quests started from dialogue and completed; every
enemy kind spawned, fought and drops (glow jelly, lens, conch) collected; the lamp option lit the lighthouse; the tide
gate opened through its question (auto mode); the intro trigger played; both shield questions fired; the outro set
`clawsworth_defeated`, gave the hat and loot; Marlo's turn-in completed the main quest. No story warnings. A 3D browser
smoke (scenario `biome`, teleports to village, coral, lighthouse, arena) showed no console errors.

## Notes and requests

- **Gull gold stealing** is only flavour (gulls drop plenty of gold and the quest is about their loot): there is no ability
  block that takes gold. Request for a later round: an attack field `stealGold: n` handled in `combat`.
- Props used from the closed vocabulary: `palm palm_tall shell coral coral_blue boat tidepool lighthouse` plus existing
  `bridge`-free pier (painted `planks`), barrels, crates, tents, stalls, `table_umbrella(_teal)`, lamps, benches, signs.
  They render as labelled placeholders until package B lands.
- The pier and the tide gate causeway are paint ops (`planks` over `water`, a 3-wide `sand` line between two painted water
  rectangles), so `mapgen` treats them as ordinary walkable tiles.
- Marlo stands in the village (looking at the dark lighthouse) rather than at the lighthouse, so the quest starts near the
  entrance; the lamp itself is the `lighthouse` prop's interact ("Climb").
- Known gaps: no town quest-board entry for the cove quests; the lighthouse model does not visibly light up after the lamp is
  lit (an `fx` pillar and sparkles play, the flag `lighthouse_lit` is set for a future art hook).
- Tests: `node --test tests/node` passes except package A's two expected failures (`meta-progression` level up cap,
  `r2a-progression` level down). `node tools/validate-data.mjs cove` is clean.
