# Narrative and creature content notes

Owner files: `src/data/{looks,items,shops,loot,lessons}.js`, `src/data/{enemies,npcs,dialogues,quests,cutscenes}/**`,
`tests/node/data-narrative.test.mjs`. Data only. `node --test tests/node` runs the structural validation.

## Cast

| id | name | one line |
| --- | --- | --- |
| `laporte` | Mr. Laporte | Headmaster. Absurdly powerful, calm, deadpan, a little tired, kind underneath. Short lines only. |
| `malgrim` | Malgrim the Sealweaver | Pompous purple villain. Failed Barriers 101 twice. Poofs away saying "Toodle-oo!". |
| `hexguard` | Hexguard | Malgrim's lavender armored minions. |
| `bram` | Bram | Warrior classmate. LOUD, cheerful, hugs too hard. Every problem is a sword problem. |
| `elowen` | Elowen | Mage classmate. Bookish, bone-dry, part elf (pointed ears), secretly delighted to have friends. |
| `pip` | Pip | Rogue classmate. Small, quick, "borrows" things and gives them back. |
| `mira` | Granny Mira | Potion keeper (The Bubbling Cauldron). Calls you "dearie". Out-stared a dragon. |
| `fenwick` | Fenwick Threadwell | Tailor (Stitch & Sparkle). Every outfit is a statement. Would add a cape to anything. |
| `gus` | Big Gus | General store (Odds & Ends). Huge, gentle. Hides a cat named Biscuit. |
| `rosa` | Rosa Bunwright | Baker (Rise & Shine). Up at four, flour everywhere. |
| `tilly` | Tilly | Rosa's nine-year-old. Practicing to be Headmaster (has the sigh down). |
| `juniper` | Juniper | Owner of The Cozy Cup cafe. Invents terrible drinks with total confidence. |
| `opal` | Madam Opal | Librarian. Whispers everything. Goblins stole her textbooks. |
| `hilda` | Guard Hilda | By-the-book captain. The book mostly says "no running". (guard) |
| `bo` | Guard Bo | Huge, soft-spoken night guard who knits sweaters for the park ducks. (guard) |
| `ines` | Guard Ines | Eager recruit at the forest gate, desperate for something exciting. (guard) |
| `pumble` | Mayor Pumbleton | Pompous, lovable. Wears a crown nobody gave him. |
| `sol` | Old Sol | Retired adventurer turned gardener. Listens to flowers. |
| `lyle` | Lyle the Bard | Three songs, all about himself. No instrument ("acoustic"). |
| `nia` | Nia | Second-year star student. Terrified of pigeons. |
| `ravi` | Ravi | Second-year, great at spells, terrible at aiming. Good sport. |
| `quill` | Professor Quill | Arithmancy (`lesson_1`, `teach_1`). Counts everything. |
| `rook` | Professor Rook | Runes & Ratios (`lesson_2`, `teach_2`). Booming laugh, singed eyebrows. |
| `marigold` | Nurse Marigold | Infirmary. Unflappable. Free heals and stickers. |
| `ranger_tam` | Ranger Tam | Laid-back forest ranger, names every tree (that one is Gerald). Quest hub. |
| `mo` | Mo the Forager | Mushroom expert, sneezes constantly. Gives `forest_mushroom_mischief`. |
| `kai` | Kai | Fisher at the brook. Eleven years, zero fish, totally content. |
| `wren` | Wren | Birdwatcher; logs every creature in her book (you are on page 88). |
| `old_mossback` | Old Mossback | 200-year-old treant woken from his nap. Grumpy, slow-talking. Becomes `mossback_sprout`. |

Look presets live in `looks.js` `NPC_LOOKS` (plus `MALGRIM_LOOK`, `humanoid()` helper). The test asserts at least 12
skin tones, 8 hair styles, 7 outfit styles and 7 hat styles across the NPCs.

## Markers needed (beyond STORY.md)

- `intro.walk_1`: a few tiles north of `start` on the road (the wordless opening walk).
- `intro.laporte_stand`: just outside the barrier ring (r 4) between `laporte_arrive` and `clearing`, where Laporte
  stops and taps the barrier.

Zone triggers needed (World):
- `intro`: area around `clearing` (radius ~5), `once`, `if: [['flag','tutorial_done'], ['not',['flag','ambush_done']]]`,
  `do: [['cutscene','ambush']]`. It should fire while the player stands inside once `if` passes, not only on entry.
- `forest`: area around `boss_arena`, `if: [['quest','forest_sealed_grove','active'], ['not',['flag','mossback_defeated']]]`,
  `do: [['cutscene','forest_boss_intro']]` (not `once`, so a player who leaves and comes back gets the boss again).
- `town` prop interacts: `quest_board` prop `do: [['dialogue','quest_board']]`; cafe and library doors
  `[['dialogue','cafe_door']]`, `[['dialogue','library_door']]`; shop doors may open the shop directly or the keeper's
  dialogue (the keeper stands at the door during the day).
- World should NOT place the stick: `intro_wake` spawns `stick_pickup` at marker `stick`. World should not place
  Malgrim, hexguards, the giant rat or the tutorial rats either (all spawned by cutscenes). Old Mossback is spawned by
  `forest_boss_intro`. Training dummies at `dummy_1..4` are World's (`spawns` of `training_dummy`).
- Suggested chest loot: `chest_1..3` `forest_small`, `chest_4` `forest_rune` with `rune: true` (Pip and Kai hint at
  "a rune chest by the brook").

## Contract additions (fields the content uses)

- **Enemy defs**: `attacks[].id` (unique per enemy; boss `phases[].pattern` lists these ids); `boss.phases[].cdMul`,
  `boss.name`, `boss.shieldDifficulty` (2), `boss.barks`; `onDeath.do: [ops]` (run when the enemy is defeated; used by
  `old_mossback` to play `forest_boss_outro`); `stats.regen` (hp/s), `immortal`, `anchored` (training dummy: never
  dies, never moves or gets knocked back); attack `ifHpBelow` (boar `huff`: only usable below that hp fraction);
  beam `sweep` (degrees), `dur`, `tick` (Mossback's sweeping pollen beam); `homing` is a turn strength 0..1;
  `gravityZ: 1` means "lobbed / arcing" projectile. `ai.swarm` = pack size. `flying` on the def root.
- **NPC defs**: `personality`, `barks` (strings <= 60 chars), `tags`, `portrait` ('laporte'), `classId` (classmates),
  `lesson` (teachers), `attacks` (guards, Tam; same schema as enemies), `hideIf: [conds]` (do not populate while all pass:
  the two classmates who became companions).
- **Helper entity defs** in `npcs/forest.js` with `type` != 'npc': `stick_pickup` (type `effect`, look `stick`, an
  `interact` that sets `has_stick`, despawns itself and toasts), `ambush_barrier` (type `effect`, look `barrier` r 4,
  `barrier: {r: 4}` = leash the player inside while it exists), `pet_fox` (type `summon`, team `player`, for the
  `fox_whistle` item). `mossback_sprout` is a normal NPC without routine.
- **Items**: cosmetics carry `slot: 'hat'|'cape'|'outfitColor'` and a partial `look` patch. Effect params: `heal
  {amount, frac}` = amount + frac*hpMax; `heal_over_time {amount, dur}`; `bomb {dmg, r, range, delay}`; `haste {mult, dur}`;
  `shield {frac, dur}`; `smoke {r, dur, stealth}`; `xp {amount}`; `summon_pet {kind, dur}`; `cure {}`; `resource {}`.
  Key items (`slime_jelly`, `glowcap`, `stolen_textbook`, `warm_pie`, `mossback_acorn`) have `type: 'key'`, price 0.
- **Quests**: goals are written `{type: 'reach'|'kill'|..., ...params}`; `rewards.items = [{id, n}]`.
- **Lessons**: `room`, `blurb`, `hours`.
- **Cutscenes**: `onSkip: [ops]` (run instead of the remaining steps when skipped). `camera` step may carry `shake`
  (0..1). `move` opts may carry `stopAt` (passed to `physics.moveTo`). `spawn` opts may carry `offset: [dx, dy]` tiles.
- **fx op** `['fx', {..., at}]`: `at` is a marker name, `'player'`, an npc/enemy kind or `'@tag'`; Story resolves x/y
  from it (for `'@tag'`: one event per tagged entity). Positionless fx (`screenFlash`) omit it.
- **Dialogue speakers**: `who` is an npc id, an enemy kind (`malgrim`, `old_mossback`), `'player'`, or `'narrator'`
  (no name, no portrait: notice boards, doors).

## Engine behavior this content assumes (please check)

1. **Story / quests**: `['quest', id, 'step', n]` is true while the quest is active and its current step index
   (0-based) is n (>= n also works: every waited-on step needs a player action to complete). `kill` goals count kills
   made while that step is current. `quest.start` on an already active/done quest is a no-op. A `talk` goal completes
   when the player opens that NPC's dialogue (dialogue options for "done" states use `['quest', id, 'done']`).
2. **Story / dialogue**: options whose `if` fails are hidden (or disabled). A node with no options and no `goto` ends
   the dialogue after its lines. An option with `end: true` and a `do` that opens another modal (`shop`, `lesson`,
   `cutscene`) closes the dialogue first, then runs the op. Inside a cutscene, `['dialogue', id]` blocks until it closes.
3. **Story / cutscene**: `['cutscene', id]` as the last step of a cutscene chains (starts right after the current one
   ends). `move`/`face`/`anim` mark their entity `data.scripted` until the cutscene ends (the ambushers stop attacking
   during `rescue`). The `minHp: 1` floor set by the ambush `control` step must stay on the player until `rescue`'s
   `['heal']` (otherwise a hexguard can down the player between ambush and rescue). `who` resolves npc ids, enemy kinds
   (first entity of that kind) and `'@tag'`. `face` takes a DIR number. `despawn` accepts a spawn tag or an npc id.
   `escort` hands control to the player while it runs. A `tutorial` left set is cleared by the next `['tutorial', null]`.
4. **Condition `hp`** (`['hp','player','<=',1]`, from STORY.md) is not in the COMMON ownership list: Story or Sim
   must register it.
5. **Meta**: `lookPicker` records the choice in `flags.look_choice`; the cutscene sets `look_chosen` and calls
   `['setLook','player','$chosen']` (Sim: `'$chosen'` = refreshLook()). `give` puts consumables on the first free hotbar
   slot (rescue asks the player to press 1 for `potion_small`). `['chest', lootId, {id}]` works without a chest entity
   (outro reward; sets `chest_forest_mossback`). `['gold', -3]` spends gold (cafe cocoa, gated by `['gold','>=',3]`).
6. **Sim**: `hexguard` brain `guard` stays within `ai.leash` of its spawn point. `training_dummy` has no attacks and
   aggro 0. Malgrim's `theatrics` (`buff_self` power x1.4, 30 s, cd 7) should stack or refresh so the ambush always
   ends; expected time to floor the level-3 novice (35 hp): ~10-15 s.
7. **Companions**: `class_pick_team` calls `['companions', [the other two]]` from class-gated dialogue options and
   despawns those two NPCs; companions should use the classmate looks/names (`bram` warrior, `elowen` mage, `pip` rogue).
8. Laporte's dialogue offers `spec_ceremony` when level >= 8, class chosen and `spec_ceremony_done` unset. Whoever
   sets `spec_ready` at level 8 should toast "Mr. Laporte wants to see you in his office."

## Enemy behaviors

| id | L | brain | pattern |
| --- | --- | --- | --- |
| `rat` | 1 | chaser | slow bite (1.8 s) |
| `giant_rat` | 2 elite | charger | bite, telegraphed lunge (line), tail swipe ring |
| `hexguard` | 4 | guard | slow cone slash, shield rush |
| `malgrim` | 6 | skirmisher | homing hex bolt, big seal burst (circle, 1.0 s windup), grand hex ring (1.6 s), blink, power ramp |
| `training_dummy` | 1 | turret | nothing; regenerates 25 hp/s; immortal |
| `slime` | 3 | wander | short hop dash; splits into 2 `slime_small` (chasers) |
| `sporecap` | 4 | turret | lobs slowing spore clouds (ground_target + zone), puff knockback when close |
| `thornling` | 5 | ambusher | 3-thorn cone spray, rooting snare circle |
| `bat` | 5 | swarmer (packs of 3) | swoop dash (line), nip; flying |
| `boar` | 6 | charger | long telegraphed charge, tusk toss, angry buff below 50% |
| `goblin_scout` | 7 | skirmisher (keepRange 4, flees at 20%) | lobbed rocks, 3-rock scatter, stab |
| `wisp` | 8 | flee (keepRange 5, blink) | zap beam (line), blink away, spark ring |
| `treant_sapling` | 9 | summoner | grows thornlings (max 2), root slam ring, seed flick |
| `old_mossback` | 10 boss | boss | P1 root slam / stomp / thorn volley; P2 + thornlings + sweeping pollen beam; P3 + charge + grumpy buff; shields 66% / 33% |

## Cutscene walkthroughs

- **intro_wake** (intro, not skippable): letterbox, the stick spawns at `stick`, camera low on `start`; the hooded
  traveler walks to `walk_1` with the camera; a "..." bubble; quest `main_enroll` starts; control returns. Prompts:
  WASD (wait for quest step 1 = reached the stick) → "press E" (wait `has_stick`) → 3 rats at `rats_1` + arrow-key
  prompt (wait step 3) → 4 rats at `rats_2` + "hold to keep swinging" (wait step 4) → `giant_rat` at `big_rat` +
  "step aside when it crouches" (wait step 5 = giant rat defeated) → "Well done! continues north", 2.5 s, prompt
  cleared, then `tutorial_done` + save as the very last step (so the `clearing` trigger, which requires it, can never
  start `ambush` while intro_wake is still running). Quest step 5 ("keep walking") completes on reaching `clearing`.
  XP: 7 rats x 8 + giant rat 33 = 89 >= 81, level 3 reached.
- **ambush** (intro): barrier ring at `clearing`, Malgrim poofs in at `malgrim_spot`, hexguards at `hex_1/hex_2`,
  three short taunts, control back with "Trapped! Fight back!", `control` until hp <= 1 (minHp 1), `ambush_done`,
  chains `rescue`.
- **rescue** (intro): ambushers frozen (anim), purple flash, camera on the player (hurt), Malgrim charges up: "Any last
  words?" / Laporte off-screen: "Excuse me." Laporte spawns at `laporte_arrive`, walks to `laporte_stand`. "Is this your
  barrier?" ... taps it: barrier despawns with a burst. "It was a nice barrier." Malgrim: "GET HIM!" Laporte: "Okay. Eyes
  up here, please." Pillar on Laporte, screen flash, bolts on hexguards and Malgrim, shockwave r 8, camera shake,
  hexguards `kill`ed (poof). Malgrim: "My good robe!" / "Toodle-oo!" poofs (despawned, he escapes). Laporte walks up:
  "You look terrible. Here." `give potion_small`, tutorial "Press 1", control until the potion is gone, heal.
  "Remind me who you are again?" → look picker → `look_chosen`, setLook `$chosen`, poof + sparkle (hood off).
  "Ah, yes. {name}. You must be the new student." "You are late..." "This road is dangerous. Follow me." Escort to
  `exit_town`, `intro_done`, save, travel `town:gate_south`, chains `town_arrival`.
- **town_arrival** (town, skippable; onSkip travels on): Laporte spawns by `gate_south`, camera pans to `square`,
  one-liner about the town; escort to `square`; bubble about the fountain; two lines about shops/bread; escort to
  `academy_door`; "In we go. Wipe your feet."; travel `academy:entrance`; chains `class_pick`.
- **class_pick** (academy): Laporte to `hall_laporte`, player to `hall`; "do not feed the portraits"; "Which discipline?"
  → class picker → pillar + sparkle + ring, `class_chosen`; classmates intro (Bram, Elowen, Pip one line each);
  dialogue `class_pick_team` (one class-gated option: companions = the other two, they poof; the third declares the
  friendly rivalry); Laporte points to the Whisperwood, Mira, lessons; `main_first_steps` starts, `forest_open`;
  "Be back before dark. That was a joke."; save.
- **spec_ceremony** (academy, from Laporte's dialogue): office camera, three short lines, spec picker, flash + pillar +
  ring + sparkle + light shake, `spec_ceremony_done`, "I am pretending not to be impressed", points to the grove.
- **forest_boss_intro** (forest trigger at `boss_arena`): camera to the arena, rumbling shakes, smoke, shockwave,
  Mossback spawns and roars, three slow grumpy lines (the player bubbles "Um. Hi?"), shield hint toast, fight.
- **forest_boss_outro** (Mossback onDeath): sparkles and a poof where he stood, `mossback_sprout` spawns ("You win. I am
  going back to bed."), `mossback_defeated`, `chest boss_mossback`, Laporte appears with a pillar ("I was watching.
  Supervising. Same thing." / other gates sealed until next term / "tell Ranger Tam"), poofs out; save.

## Quests

`main_enroll` (tutorial pacing, 8 steps, done at `class_chosen`), `main_first_steps` (Mira → forest camp → Tam → 5 slimes →
Laporte; 80 xp), `forest_mushroom_mischief` (Mo: 6 sporecaps, 4 glowcaps; 100 xp), `forest_goblin_trouble` (Opal, level 6:
goblin camp, 3 textbooks; 180 xp), `forest_sealed_grove` (Tam, level 8: gate, 3 saplings, arena, Mossback, Tam; 280 xp),
town: `town_pie_delivery` (Rosa → Opal), `town_jelly_latte` (Juniper: 3 slime jelly), `town_bard_ballad` (Lyle: talk to
Hilda, Pumbleton, Sol; rewards the feather cap). Side quests start from dialogues and the quest board.

## Known gaps

- Enemy/NPC behavior and every op/step are only validated structurally (no engine here); the assumptions above are the
  contract I wrote against.
- Barks are flat strings (no conditions). Dialogue greetings vary through option visibility, not conditional lines.
