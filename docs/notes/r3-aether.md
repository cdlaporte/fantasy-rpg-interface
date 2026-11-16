# Round 3, package F: Aether Gardens and the finale

Branch `wp/r3aether`. Files: `src/data/biomes/aether/{zone,enemies,npcs,dialogues,quests,cutscenes,loot,items}.js` and
this file. Nothing outside the folder was touched.

## What changed, file by file

- `zone.js`: the real 96 x 96 map (macro 24 x 24, cell 4, `warp: 1.7`), `scaleToPlayer`, `levelRange [15, 20]`,
  `palette: 'aether'`, exit `exit_town` on the SOUTH edge (3x1 -> town `gate_aether`),
  `boss: {kind: 'malgrim_ascended', flag: 'malgrim_defeated', intro: 'aether_boss_intro', gate: 'summit_seal'}`.
  Floating islands over open sky, joined by 3-wide cloud paths and plank bridges (`bridge_wide`, `bridge_long`):
  - portal pier `entry_town [50,89]` (gate arch, star lamps, sign) -> landing isle -> **observatory camp** `camp [48,74]`
    (observatory `tower` with a door note, tents, campfire, table, tea cauldron, benches), `respawn [50,78]`.
  - west cloud path -> **Moon Meadow** (SW, crescent; moon moths) `moon_meadow [14,72]`, `chest_1 [6,80]`
    -> north cloud path -> **Star Garden** (W; star sprites, star lamps, statue) `star_garden [12,40]`
    -> NW islet `chest_2 [13,11]` (rune).
  - east bridge -> **Cloud Banks** (SE; puffy lobes of cloud, Nimbus's fenced cloud pen; cloud pufflings)
    `cloud_banks [80,72]`, `chest_4 [88,82]` -> north bridge -> **Crystal Terraces** (E; astral golems)
    `crystal_terraces [82,40]` -> NE islet `chest_3 [82,11]` (rune).
  - north cloud path -> **Orrery Plaza** (round starry plaza with two orbit rings; clockwork owls) `orrery_plaza [50,49]`,
    the **Great Orrery** (3x3 prop id `orrery`, interact "Align" sets `orrery_aligned`).
  - the Summit Stair (3-wide rune path, arch) with the rune gate `summit_seal` at `summit_gate [50,28]`
    (`question: {context: 'gate', difficulty: 2}`, `req: [['flag', 'orrery_aligned']]` with a `locked` hint,
    seals `summit, boss_arena, boss_spawn`) -> **Malgrim's arena** on the highest island: a round rune floor with a
    starry duel circle, star lamps, crystals, purple banners; `summit [50,23]`, `boss_arena [50,13]`, `boss_spawn [50,8]`.
  - spawns: moon_moth x4 (offset -2), cloud_puffling x5 (-1), clockwork_owl x4 (0, respawn 60), star_sprite x5 (0),
    astral_golem x3 (+1), the boss (`boss: true`, `respawn: 0`, `if: not malgrim_defeated`). Max 13 enemies in a
    30-tile bubble (validator) plus at most 6 boss summons.
  - triggers: `arrive` (landing, once, if `aether_finale` none: starts it), `boss_intro` (arena mouth, once, if not
    defeated: `aether_boss_intro`).
- `enemies.js` (defs at their design level, sheet numbers x0.6 hp, xp +30%):
  `star_sprite` L17 swarmer (packs of 3, twinkle dive dash, star darts), `cloud_puffling` L17 **wander** (peaceful
  until hit; knockback bump dash, push ring), `clockwork_owl` L17 turret (gear shot, gear fan, hoot ring; drops star
  charts), `astral_golem` L18 charger (comet charge, star slam ring, starfall circle; x1.8 hp), `moon_moth` L16
  skirmisher (blink flutter, sleep-dust slow zone, lullaby ring with a 0.8 s stun), `star_hexguard` L17 chaser (only
  summoned by the boss). **`malgrim_ascended`** L20 boss: humanoid hero `malgrim`, `size: 1.6`, `aura: {style: 'storm'}`,
  3 phases, shields at 66% / 33% (difficulty 2): P1 homing hex bolts, seal bursts, **star barrier** (a `zone` bubble
  that follows him, pushes you out and halves his damage taken), flourish blink; P2 + summoned star hexguards, a
  sweeping **star beam**; P3 + summoned star sprites, grand hex ring, starfall ring of sparks, theatrics buff.
  Summons carry tag `malgrim_minion` (the outro poofs them) and spawn at level 15. `onDeath: cutscene aether_boss_outro`.
- `npcs.js`: `celeste` (astronomer; stargazing at the orrery at night, naps by her tent, observatory by day),
  `nimbus` (cloud shepherd kid; cloud pen by day, campfire at dusk), helpers `aether_barrier` (barrier r 10, leashes
  the player like the ambush barrier) and `malgrim_cloud` (Malgrim as a small drizzling cloud, team neutral).
- `dialogues.js`: `celeste` (main-quest guide, starts `aether_star_charts`; can also start `aether_finale`),
  `nimbus` (starts `aether_puff_roundup`), `malgrim_cloud`, and the two outro beats `aether_classmates` /
  `aether_toast` (lines gated by `['not', ['class', X]]`, so only the player's two companions speak).
- `quests.js`: `aether_finale` "End of Term" (main: reach camp, talk to Celeste, align the orrery (flag), unseal the
  gate (flag), defeat Malgrim (flag), celebrate (flag `end_of_term`, set by the outro), 400 xp, 250 gold, 2 big
  potions, Midnight Cape), `aether_star_charts` (4 star charts, turn-in at Celeste), `aether_puff_roundup` (calm 6
  pufflings, turn-in at Nimbus). Every finale step after the talk is a flag, so out-of-order play still completes it.
- `loot.js`: `aether_small`, `aether_rune` (one star chart guaranteed), `boss_malgrim` (Sealweaver's Spare Hat, 3 big
  potions, 2 comet candy, maybe focus scroll / Golden Cape).
- `items.js`: `star_chart` (key), `moon_tea` (heal over time), `comet_candy` (haste), `hat_sealweaver` (cosmetic hat,
  boss chest only; no outfitter entry needed).
- `cutscenes.js` (all `zone: 'aether'`):
  - `aether_boss_intro` (skippable; onSkip spawns boss + barrier, both `unique`): "The nobody from the road. We meet
    again!" / player: "...Who?" / Malgrim reveals he made every seal (grove, dunes, cove, peaks) and wants to seal the
    Academy, weaves the arena barrier ("Forty-one layers. I took NOTES this time."), ascends (pillar, flash, shake).
  - `aether_boss_outro` (skippable; onSkip sets the same flags, chest, save, chains the homecoming): summons poof,
    Malgrim poofs into `malgrim_cloud` ("A cloud? I am a CLOUD now?"), `malgrim_defeated`, Laporte appears: "Is this
    your barrier?" -> taps it -> "It was a nice barrier." -> detention -> "Toodle-oo." (he steals Malgrim's line), the
    classmates react, **"Remind me who you are again?" -> "Ah yes. {name}. I remember now."**, "Every seal broken.
    Every gate open. That is what I call the end of term.", the toast (screen flash, levelup fx, classmates' cheers,
    flag `end_of_term` -> "Quest complete: End of Term" banner, toast "END OF TERM!"), reward chest `boss_malgrim`,
    save. 19 short lines. Chains into
  - `aether_homecoming` (not skippable, ~2 s): Laporte poofs, travel to town `gate_aether`, toast "Free play! Every gate
    stays open...", save, unlock. Nothing is locked afterwards; the Aether stays open (boss gone, quests continue).

## The sky between the islands (for the lead and package B)

B's sky-void tile was not in this worktree. `zone.js` feature-detects it: `SKY = first solid tile whose id is one of
['sky', 'sky_void', 'void', 'open_sky', 'skyvoid', 'aether_void']`, else **`water`** (same collision class as a
`pit`: blocks walkers, not flyers or projectiles; shorelines are off: `shore: {shallows: false}`). `SKY` is used by the
legend char **`' '` (space)**, `filler`, and the coastline `paint` ops. If B's tile has another id, add it to
`SKY_IDS` (one line) or replace `SKY` by hand. If B's tile is a `block` (blocks flyers too), flying enemies (sprites,
owls, moths) can no longer drift over the gaps; nothing else changes.

## Boss tuning (Malgrim Ascended: hp 7000 = 42,000 shown at L20, power 26)

`tests/node/r2c-sim.mjs` scripted fighter ("student" profile, both classmates, 4 small + 2 big potions, shields answered
at once), in the arena with the barrier, boss at player level + 1 (as the zone spawns him). Seconds to kill:

| spec (level 20) | seed 7 | seed 11 | seed 13 | downs |
| --- | --- | --- | --- | --- |
| knight | 167 | 170 | 173 | 0 |
| berserker | 141 | 127 | 148 | 0 |
| sorcerer | 164 | 146 | 158 | 0 |
| conjurer | 124 | 98 | 107 | 0 |
| archer | 109 | 114 | 109 | 0 |

Level 19 (boss L20): knight 134 / 155, sorcerer 172 / 142, archer 91 / 115. Expert profile at 20: knight 153,
sorcerer 117. First shield at 30-58 s, second at 54-121 s. Before the power cut (32 -> 26, softer bolts/barrier,
summons at L15) the student sorcerer and berserker were downed near the end. Knobs: `stats.hp` (linear in time),
`stats.power`. A down resets the boss (zone respawn), so the fight leans forgiving.

## XP budget

Kills on the way (sheet xp: ~70 per regular kill, golem 120, summons 20) plus a full quest clear: roughly 1,700 kill xp +
boss 500 + quests 950 = ~3,100 xp, i.e. ~1.5 levels at 19-20 and ~2.5 at 17 (the cap 20 absorbs the rest). Boss xp is
well under the sheet's x20 on purpose.

## Verification

- `node tools/validate-data.mjs aether`: ok, 0 warnings (96x96, 92 props + 322 deco, build 12-25 ms).
- `node tools/map-preview.mjs aether`: looked at full map and crops; one 3D smoke run (camp, plaza, boss intro) showed
  no errors.
- `node --test tests/node`: 429/431; the two failures are package A's (`meta-progression` cap, `r2a-progression` level
  down), as BIOMES.md says.
- Node playthroughs (bot-helpers, questions `auto`): every enemy kind spawns at the scaled level and dies; the summit
  seal refuses before the orrery is aligned, asks a `gate` question after, opens and lets the player up; the full main
  quest from `scenario('biome')` (camp, Celeste, orrery, gate, intro + barrier leash, boss with two `boss_shield`
  questions, outro, homecoming) ends in town with `malgrim_defeated`, `end_of_term`, `chest_aether_malgrim`, the hat,
  no leash, input unlocked; the player then walks and travels back into the Aether (no Malgrim); all three quests
  complete; skipping the intro and the outro (`biome_boss`) gives the same end state; a down in the duel with a correct revive
  answer revives in place inside the barrier (leash kept); any zone change removes the barrier and clears the leash
  (ents are removed on unload; seen after the homecoming). No story warnings, no errors. The test below passes as written
  (215 sim seconds, under 1 s wall).

A test the lead may add (not mine to add):

```js
// tests/node/r3-aether.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { newGame, createBot } from './bot-helpers.mjs';
test('aether: boss, outro, homecoming, free play', async () => {
  const game = newGame({ questions: 'auto' }); const bot = createBot(game);
  game.debug.scenario('biome_boss', { zone: 'aether', level: 20, classId: 'warrior' });
  game.debug.god(true);
  await bot.until(() => !game.cutscene.active, { timeout: 120 });
  await bot.fight({ kind: 'malgrim_ascended', until: () => game.flags.malgrim_defeated, timeout: 600 });
  await bot.until(() => game.zone.id === 'town' && !game.cutscene.active && !game.inputLock, { timeout: 120 });
  assert.ok(game.flags.end_of_term && game.flags.chest_aether_malgrim);
  assert.equal(game.player.data.leash, null);
  await bot.travelVia('exit_aether', 'aether');
  assert.deepEqual(game.debug.errors(), []);
});
```

## For other packages

- **B (art)**: the sky tile (above). Looks used: `malgrim` hero with `size: 1.6` and `aura: {style: 'storm'}`; flyer
  `wings_fairy glow`, `wings_bird orb`, `wings_insect glow`; blob `bubbles core_glow` and `drips crown` (the small
  cloud); golem `starry crystal`; the boss's `star_barrier` is a `zone` with look `shield_bubble` (r 2.4) that follows
  him; props `star_lamp`, `orrery`, `moon_flower`, `cloud_puff`, `floating_rock` (placed over sky tiles as drifting
  rocks), `tower` with a lilac/indigo `look` override as the observatory, `fence_white` cloud pen.
- **Lead / whoever owns `dialogues/academy.js`**: optional: a Laporte line once `malgrim_defeated` is set ("Detention
  is going well. He brought a pencil.").
- **Town**: the finale drops the player at `gate_aether`.

## Known gaps

- The intro trigger is `once`: a player who loses the duel (sent to the infirmary) and comes back fights Malgrim again
  without the intro and without the arena barrier (as in the forest).
- Skipping the outro after its chest step shows one "It's empty." toast (the forest outro does the same).
- If the player never talks to Celeste, `aether_finale` waits on its talk step after the finale; talking to her later
  completes the remaining flag steps at once (no banner during the outro in that case).
- Celeste naps 3-10 h by her tent; she can still be talked to while asleep.
