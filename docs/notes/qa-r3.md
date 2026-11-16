# Round 3 QA

## What I ran (merged tree, 3D = headless Chromium + SwiftShader)

| Script | Result |
| --- | --- |
| `node --test tests/node` | 504/504 (494 + `r3qa-progression` 5, `r3qa-biomes` 5) |
| `node tools/validate-data.mjs` | ok, 0 warnings |
| `tests/e2e/smoke.cjs 3d` (new biome checks + the old base checks) | all passed (about 3.5 min biomes, 40 s base) |
| `ui.cjs`, `r3g-questlog.cjs`, `r2a-menus.cjs`, `r2b-questions.cjs`, `r3d-gallery.cjs`, `r2d-gallery.cjs --quick`, `skeleton.cjs` | all passed |
| `showcase.cjs 3d archer 16` | ok (rank V level now in the showcase) |

## 1. XP progression (`tests/node/r3qa-progression.test.mjs`, helpers `r3qa-lib.mjs`)

Model: start at level 11.25 (after Mossback), per biome all its quests' xp + one full clear of every spawn in the zone def
(n per spawn, level = clamp(player level + levelOffset), boss +1) with the real `xpNext` and the ents.js xp rescale, in
four orders (dunes>cove>peaks>aether, cove>dunes>peaks>aether, peaks>cove>dunes>aether, dunes>peaks>cove>aether).
Before: quests 560 / 470 / 760 / 950 xp per biome and the run ended at 16.1 (targets 14-15 / 16.5-17.5 / 18.5-19 / 20).
Kills are only ~1,300-1,500 xp plus the boss ~400-600 per biome, so the quests have to carry about 4k a biome.
Change: every quest reward xp in `src/data/biomes/{dunes,cove,peaks,aether}/quests.js` scaled uniformly per biome to a
total of **4,200** (dunes x7.5, cove x8.9, peaks x5.5) and **6,500** for Aether (x6.8), rounded to 10 (e.g. dunes main 300 ->
2250). Result (no turn-in bonus / all turn-in questions right, x1.25): after biome 1: 14.8 / 15.2, after 2: 16.8 / 17.4,
after 3: 18.3 / 19.0, after 4: 20.0 / 20.0 (any order, since biome xp is equal for the first three). Extra kills (respawns,
quest-count kills) push real play into the band. The test asserts the floor (x1.0) and the ceiling (x1.25) per step.
Note: a quest is now 30-55% of a level, not the 40% of A's note for ~300-450 xp rewards; that note's numbers were too low
because the sheet's kill xp (5 + 3L, x1.3 only in the round 2 forest) gives only ~0.8 level per clear.
Aether first or second is allowed by the game; its 6,500 xp then comes early (about +2 levels at 16), not a problem.

## 2. Boss times (`scratchpad/qa3/boss.mjs`, `tests/node/r2c-sim.mjs` student fighter, both classmates, 4 small + 2 big potions, shields answered at once, kits as merged, 3 boons, seeds 7 and 11)

Recommended level = top of range minus 1 (dunes 15, cove 16, peaks 18, aether 19), seconds to kill, two seeds:

| spec | dunes | cove | peaks | aether (before: hp 7000) | aether (hp 9100) |
| --- | --- | --- | --- | --- | --- |
| knight | 103 103 | 97 92 | 103 101 | 98 113 | 138 164 |
| berserker | 98 100 | 95 87 | 106 97 | 104 125 | 147 152 |
| battlemage | 110 108 | 99 97 | 110 109 | 113 108 | 142 151 (1 down) |
| conjurer | 87 82 | 86 98 | 91 87 | 86 104 | 111 120 |
| sorcerer | 151 140 | 131 (1 down) 120 | 132 128 | 149 140 | 186 176 |
| monk | 112 97 | 79 92 | 92 95 | 106 99 | 123 132 |
| archer | 130 143 | 95 105 | 117 100 | 107 104 | 131 138 |
| thief | 104 93 | 78 101 | 97 95 | 110 111 | 140 159 |
| ninja | 142 148 | 136 124 | 159 149 | 147 139 | 219 215 |

Dunes, cove, peaks: median ~100 s (1.7 min), range 78-159: inside 1.5-2.5 min, left alone. Aether was ~107 s median, under its
2-3 min target: `malgrim_ascended.stats.hp` 7000 -> 9100 (+30%), median now ~140 s (2.3 min), ninja 3.6 min is the long tail.

## 3. E2E

- `tests/e2e/smoke.cjs` (3D, run `node tests/e2e/smoke.cjs 3d [biomes|base]`, env `SMOKE_SHOTS=<dir>` for the biome
  screenshots, `SMOKE_ONLY=<biome|gates>` to run one): new checks (1) the four town gates locked with the "Sealed for now"
  toast before `biomes_open`, then each exit leads to its biome at `entry_town` and `exit_town` leads back; (2) per biome:
  camp (NPCs present), every regular kind spawned with `__game.spawn` and killed, a rune chest opened with its real question
  card, the quest log (dunes: Q, Down + Enter track, Tab to Done, Left back, Q close), `biome_boss` through intro, both
  shield cards and the outro flag, for Aether the finale to town, free play (walk, travel back, no Malgrim); after each biome
  `__game.errors()`, `renderStats().unknown` and console are asserted empty; (3) teacher tools box inside the view at
  1366x657 and 1024x600; (4) the 10-look picker (card count 10, last look by keyboard, `look_choice === 9`).
- `tests/node/r3qa-biomes.test.mjs`: the same flow in Node with the bot (gates, kinds, rune chest, boss shields, outro flag,
  Aether finale + free play).
- `tests/e2e/kitdriver.cjs`: `LEVELS` gains 16 (rank V) so `showcase.cjs` shoots it.

## 4. Game fixes

- `css/menus.css`, `src/ui/teacher.js`: the Teacher tools box was 860 px wide and centred in the area right of the 296 px HUD
  panel, so at 1024 px it ran 66 px off the right edge (the 14 Go-to buttons were in one 11-wide row). Now `max-width:
  calc(100vw - var(--panel-w) - 16px)`, the Go-to buttons in rows of 5, `min-width: 0` on the buttons and smaller label/button
  fonts under 1250 px. Fits 1366x657, 1024x600, 1000x600 (and 800x600 with scrolling). Asserted in smoke.cjs.
- `css/ui.css`: Pixelify Sans draws "fi" and "fl" ligatures as odd glyphs: the quest log read "Find the Arst lost cart",
  rewards "SnowAake Cape". `* { font-variant-ligatures: none !important; font-feature-settings: 'liga' 0, 'clig' 0 !important }`
  (a `font:` shorthand elsewhere resets the longhand, hence `!important`). Checked in the quest log and toasts.
- Biome balance edits above (quest xp, Aether boss hp).

## 5. Screenshots (`scratchpad/qa3/shots/`)

Per biome `biome-<id>-1-camp`, `-2-fight` (3 kinds), `-3-boss-intro`, `-4-boss-fight` (boss below 45% hp), `-5-question-card`
(rune chest), `-6-outro`; Aether `biome-aether-6-finale-01..17` (last lines: Elowen and Pip's toast, Laporte "Right. Home. The
bakery is staying open late."), `-7-after-finale`, `biome-quest-log-dunes`, `biome-look-picker-10`, `biome-town-gate-locked`.
Looked at: camps, fights, boss fights, outros, the finale's last line, quest log, a question card, the 10 looks. Art is
clean: no missing models, no overlap of cards. Cosmetic leftovers below.

## Remaining / not changed

- Cutscene letterbox: the dialogue box covers the "Esc Skip" hint (bottom right, shows "c Skip") in every boss intro/outro.
- Peaks and dunes boss intros: the boss sits at the top edge behind the boss bar / letterbox (the camera frames the player), same
  as Mossback in round 2; the boss is fully visible once the fight starts.
- Enemy name plates and attack names overlap when 3 enemies stand together ("Clockwork Owl / Clockwork Fling", "Snippy Crab /
  Bubble Jelly").
- Debug scenarios that jump levels still show the "+14 levels" banner (artefact; the smoke shots remove banners and the zone card).
- Sorcerer is the slowest non-ninja spec on all four bosses (130-190 s) and went down once in cove; ninja is slowest on Aether (3.6 min).
- Boss `barks` are still not shown by the engine (noted by package C).
- A quest's bonus (x1.25 on a right turn-in answer) is not shown in the quest log's reward line.
