# Round 3, package C: Sunscorch Dunes

Owned: `src/data/biomes/dunes/**` (zone, enemies, npcs, dialogues, quests, cutscenes, loot, items), this file.
Data only; no engine, renderer or shared data file was touched.

## What is there

- **zone.js**: 96x96 macro map (24x24, cell 4), palette `dunes`, `filler: 'cliff'`, `boss: {kind: 'sultana_sandsnout',
  flag: 'sandsnout_defeated', intro: 'dunes_boss_intro', gate: 'sphinx_gate'}`. Journey from the WEST edge
  (`entry_town [6,50]`, exit `exit_town [0,50]`): caravan camp (Ziva's stall, tents, campfire, cart) -> road east. North:
  scarab dunes and the old quarry (`chest_1`). Center: dust flats. South-west: cactus garden (`chest_3`). South: oasis (pond,
  palms, well). South-east: scorpion canyon between sandstone mesas (`chest_4` rune). East: the ruins (cobbled plaza, pillar
  avenue, three obelisks, Professor Dusty's dig, golems, `chest_2` rune). North of the plaza the rune gate
  `sphinx_gate` (marker `rune_gate`, seals `sphinx_court` + `boss_arena`) leads through the court of statues to the arena.
  Spawns: scarab x6 + x4, dust_devil x4, cactling x5, sand_scorpion x4, sandstone_golem x3 (ruins), the boss. Worst bubble 19 enemies.
  Triggers: `welcome` toast at the entry, `boss_intro` (once, arena mouth). Quest props: `lost_crate_1..3` (flags `dunes_crate_N`),
  `oasis_spring` (`dunes_spring_filled`), `obelisk_sun|moon|star` (`dunes_rubbing_*`), signs.
- **enemies.js**: `scarab` L10 swarmer, `dust_devil` L11 skirmisher flyer, `cactling` L12 turret, `sand_scorpion` L13 charger
  (poison zone), `sandstone_golem` L14 ambusher (slow slams); each authored at its own level, rescaled by the zone.
  Boss `sultana_sandsnout` L16 (hero `sphinx`), 3 phases, shields 66%/33% (her riddles = the boss_shield questions).
- **npcs.js / dialogues.js**: `ziva` (camp, sells cactus water, sand veil, potion, tonic through dialogue; hub for both main
  quests; lore menu; gift at rel 2), `professor_dusty` (ruins; glyph quest; sphinx lore; a real riddle answer choice for 40 xp;
  heals), `sandsnout_kit` (post-boss, spawned by the outro; riddle exchange). Routines cover 24 h on camp/ruins markers.
- **quests.js**: `dunes_lost_caravan` (main, Ziva, 8 steps: three carts, turn-in, ruins, gate, boss, turn-in; 300 xp),
  `dunes_oasis_water` (Ziva, 150 xp), `dunes_obelisk_rubbings` (Dusty, 110 xp, rewards `hat_sun_explorer`). Flag goals, so the
  carts/obelisks can be visited in any order, even before the quest is accepted.
- **loot.js**: `dunes_small`, `dunes_rune`, `boss_sandsnout`. **items.js**: `cactus_water`, `sand_veil`, `hat_sun_explorer`,
  `hat_sphinx_circlet` (boss drop; cosmetics are quest/boss drops, no outfitter entry needed).
- **cutscenes.js**: `dunes_boss_intro` (explains the riddle shields), `dunes_boss_outro` (Sandsnout shrinks to `sandsnout_kit`,
  loot chest, Laporte's dry remark, sets `sandsnout_defeated`, saves). Both have `zone: 'dunes'` and `onSkip`.

## Verification (Node, `tests/node/bot-helpers.mjs`, `r2c-sim.mjs`)

- `node tools/validate-data.mjs dunes`: clean (a mapgen-time warning of 30-35 ms appears only when the machine is loaded; 20-26 ms
  normally). `node --test tests/node`: green except the two package-A failures (level cap tests, "level up ... cap" and "level down").
- `scenario('biome', {zone: 'dunes', level: 12})`: all five kinds spawn and are killed; no story warnings. The rune gate asks a
  `gate` question (difficulty 2) and opens. `biome_boss` spawns Sandsnout at player level + 1 (clamped) and the intro plays.
- All three quests were played through with the bot (talks, props, scorpion kills, gate, boss `combat.kill`, turn-ins) and complete;
  level 12 ends at 14 after the whole biome.
- **Boss time** (level 15 + both classmates, boss L16, hp 6600 = 39,600 shown, power 19, 4 small + 2 big potions, shields answered at once,
  student bot of `r2c-sim.mjs`): knight 111 s, conjurer 92 s, sorcerer 144 s (6 potions), earlier hp 6200: berserker 101, battlemage
  106, monk 91, archer 102, thief 94, ninja 123; expert bot knight 88 s / sorcerer 110 s (hp 6200). No downs at 6600 on the sample;
  at power 26 the melee specs were downed, hence power 19 (Mossback ratio 0.88 -> 0.73 of the sheet). Knobs:
  `enemies.js sultana_sandsnout.stats.hp` (+-10% = +-10 s) and `.power`. Package A's kits for levels 13-20 are not in this branch:
  re-measure after the merge (`node` script pattern: `setup({zone: 'dunes', ...})`, then `world.loadZone` again so the boss spawns at the
  right level, flag `trig_dunes_boss_intro`).

## For other packages / requests

- Package B: props used are `palm palm_tall cactus cactus_round ruin_pillar(_broken) obelisk pottery dune`; creatures use features
  `shell_back claws stinger cactus sandy` and hero `sphinx` (boss size 2.3, `sandsnout_kit` size 0.6). The dust devil is a flyer with
  `orb glow` (a whirlwind look keyed on the id `dust_devil` would be ideal).
- Request (engine, optional): boss shield questions could show a per-boss title ("Sandsnout's riddle"); today the modal says "Boss
  shield", so the riddle framing lives in the intro cutscene, the gate sign and the NPC lines.

## Known gaps

- Boss `barks` are not displayed by the engine (no consumer), only stored like Mossback's.
- The caravan quest mentions carts, not camels (no camel art).
