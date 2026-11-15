# Story spine and shared ids (vertical slice)

Ids in this file are fixed: systems, tests, debug scenarios and content all refer
to them. Content authors may add more ids freely (list them in your notes file).

## Cast

- **Player**: named on the title screen. Cloaked and hooded until the reveal.
- **Mr. Laporte** (`laporte`): Headmaster of Flinkerton Academy. The teacher who
  commissioned this game, as an absurdly powerful wizard who acts like a calm,
  slightly tired teacher. Voice: short, deadpan, dry humor, teacherly commands,
  kind underneath ("Phone away." energy). He never monologues. Look:
  `LAPORTE_LOOK` (brown hair with an M hairline, goatee stubble, navy and gray
  striped quarter-zip) plus a headmaster's cape and a staff. Dialogue portrait
  `'laporte'`.
- **Malgrim the Sealweaver** (`malgrim`): theatrical, pompous villain mage who
  traps travelers in barriers. Comic menace, not scary. Minions: `hexguard` x2.
- **Classmates**: `bram` (warrior, loud and cheerful), `elowen` (mage, bookish,
  dry), `pip` (rogue, small, mischievous). The two whose class the player did
  NOT choose become companions; the third is a friendly rival at the Academy.
- Town and forest NPCs: content authors' choice (12-15 in town, 3-4 in the forest).

## Sequence

1. **Title** (UI): name, look of the game (2D / 3D), New Game / Continue.
2. **Zone `intro`**, cutscene `intro_wake`: a cloaked traveler walks north on a
   country road toward Flinkerton. Tutorial prompts (`['tutorial', text, keys]`):
   move with WASD → walk to the stick (`effect` model `stick` at marker `stick`)
   and press E → `flag has_stick` → attack with the arrow keys → rats at
   `rats_1` (3 `rat`), `rats_2` (4 `rat`), then `giant_rat` at `big_rat`. The
   player reaches level 3 here. `flag tutorial_done`.
3. Trigger at marker `clearing` → cutscene `ambush`: Malgrim and two hexguards
   appear, a `barrier` effect (r 4) seals the clearing (`player.data.leash`),
   short taunt, then `['control', {until: ['hp','player','<=',1], minHp: 1}]`:
   a real fight the player cannot win. Malgrim's hits scale so it ends in
   10-20 s. `flag ambush_done`.
4. Cutscene `rescue`: at 1 HP time slows, Malgrim winds up. Laporte walks in
   from marker `laporte_arrive`. One enormous spell (`screenFlash`, a `bolt` on
   each enemy, `pillar`, `shockwave` r 8, camera shake, enemies `poof`; the
   barrier shatters). He hands over a potion (`give potion_small`, tutorial:
   press 1), waits for the player to drink it, then: "Remind me who you are
   again?" → `['lookPicker']` → `['setLook','player','$chosen']` + `poof`
   (hood and cloak come off). "Ah, yes. {name}. You must be the new student."
   → "This road is dangerous. Follow me." → `['escort','laporte',{to:'exit_town'}]`
   → `flag intro_done` → travel to `town` at `gate_south`.
5. **Zone `town`**, cutscene `town_arrival`: Laporte walks the player up the
   main street to the square (two or three one-line remarks about the town),
   then to `academy_door` → travel to `academy` at `entrance`.
6. **Zone `academy`**, cutscene `class_pick`: in the hall Laporte asks which
   discipline the player hoped to study → `['classPicker']` → class outfit and
   weapon appear with a flourish (`pillar` + `sparkle`), `flag class_chosen`,
   the classmates are introduced, `['companions', [the other two]]`, quest
   `main_first_steps` starts, `flag forest_open`. Free play from here.
7. **Free play**: town (shops, NPCs, side quests, lessons at the Academy),
   **Zone `forest`** (Whisperwood) through the town's west gate.
8. At level 8 a toast says Laporte wants to see you; talking to him in his
   office runs cutscene `spec_ceremony` → `['specPicker']` → `flag spec_ceremony_done`.
9. Forest finale: quest `forest_sealed_grove`: the rune gate `grove_seal`
   (question gate) → treant saplings → cutscene `forest_boss_intro` → boss
   `old_mossback` (shield phases at 66% and 33% call the question gate) →
   cutscene `forest_boss_outro`, `flag mossback_defeated`. The other four town
   gates stay sealed ("Sealed until next term").

## Flags

`has_stick, tutorial_done, ambush_done, look_chosen, intro_done, town_seen, class_chosen,
forest_open, spec_ready, spec_ceremony_done, mossback_defeated`, plus
`gate_<gateId>` (opened gates) and `chest_<zone>_<chestId>` (opened chests).

## Zones and required markers

- `intro` (about 26 x 120, a road running south to north between hedges, trees
  and a stream with a small bridge): `start` (south end), `stick`, `rats_1`,
  `rats_2`, `big_rat`, `clearing` (center of a round clearing, 14 tiles across),
  `malgrim_spot`, `hex_1`, `hex_2`, `laporte_arrive` (north of the clearing),
  `exit_town` (north end), `respawn`.
- `town` (about 84 x 68; Flinkerton: a small college town, think Hogsmeade):
  Academy facade on a rise at the north center (`academy` prop, door at
  `academy_door`), a main street from `gate_south` up to the `square` (fountain,
  `quest_board`, lamps, benches), shops around the square with doors
  `potion_door`, `outfitter_door`, `general_door`, `bakery_door`, `cafe_door`,
  `library_door`; houses with `home_1..home_8`; park with a pond in the east
  (`park`, `bench_1..bench_4`); cafe terrace `cafe_seat_1..cafe_seat_4`; market
  stalls `stall_1..stall_3`; `guard_post_1..guard_post_3`; gates `gate_south`
  (to `intro`, closed after arrival), `gate_forest` (west, Whisperwood),
  `gate_dunes` (east), `gate_cove` (south-west), `gate_peaks` (north-east),
  `gate_aether` (a shimmering portal behind the Academy).
- `academy` (interior, about 46 x 36): `entrance`, `hall` (grand hall, carpet),
  `hall_laporte` (where he stands for the class pick), `headmaster` (his
  office, north), `infirmary` (beds, west; `infirmary_bed`), `classroom_1`,
  `classroom_2` (desks, chalkboard; lesson teachers stand at `teach_1`,
  `teach_2`), `library_nook`, `yard` (training yard with `dummy_1..dummy_4`),
  `classmate_1..classmate_3`.
- `forest` (Whisperwood, 96 x 96 from a 24 x 24 macro grid; bright, dappled,
  flowers and giant mushrooms, never gloomy): `entry_town` (east edge),
  `ranger_camp`, `glade` (sporecaps), `meadow` (boars), `brook`, `hollow`
  (bats), `goblin_camp`, `wisp_pond`, `grove_gate`, `grove`, `boss_arena`,
  `chest_1..chest_4`, `respawn`.
- `test` (flat test zone for debug scenarios): `start`, `far`.

## Content ids

- Enemies: `rat` (L1), `giant_rat` (L2 elite), `hexguard`, `malgrim`,
  `training_dummy` (does nothing, regenerates), forest: `slime` (L3),
  `sporecap` (L4), `thornling` (L5), `bat` (L5), `boar` (L6), `goblin_scout`
  (L7), `wisp` (L8), `treant_sapling` (L9), boss `old_mossback` (L10).
  Each forest enemy needs a distinct behavior (brain + attack pattern), e.g.
  slime splits, sporecap lobs spore clouds, thornling roots and shoots thorns,
  bat swoops in swarms, boar charges with a telegraph, goblin scouts skirmish
  and throw rocks, wisps blink and zap, saplings summon thornlings.
- Items (hotbar 1-6): `potion_small`, `potion_big`, `bread`, `bomb`,
  `speed_tonic`, `shield_charm`, `smoke_pellet`, `focus_scroll`; cosmetics
  (hats, capes, outfit dyes) from the outfitter.
- Shops: `potions` (The Bubbling Cauldron), `outfitter` (Stitch & Sparkle),
  `general` (Odds & Ends), `bakery` (Rise & Shine).
- Quests: `main_enroll`, `main_first_steps`, `forest_mushroom_mischief`,
  `forest_goblin_trouble` (stolen textbooks), `forest_sealed_grove`, and 2-3
  town side quests.
- Lessons: `lesson_1` (`classroom_1`), `lesson_2` (`classroom_2`).
- Cutscenes: `intro_wake, ambush, rescue, town_arrival, class_pick, spec_ceremony,
  forest_boss_intro, forest_boss_outro`.
- Loot tables: `forest_small`, `forest_rune`, `boss_mossback`.

## Rules of the world

- Defeat: the player wakes at the zone's `respawn` marker while `intro_done` is
  not set, otherwise in the Academy `infirmary`, at full health.
- Gates and chests: zone `gates` become solid `rune_seal` entities with an
  interact; zone `chests` become `chest` / `rune_chest` entities. Rune chests
  give the better table (`runeBonus`) for a correct answer.
- Town exits to biomes that are not built show the `locked` text as a toast.
