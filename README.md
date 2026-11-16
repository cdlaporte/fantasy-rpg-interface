# Flinkerton Academy

A bright, light-hearted fantasy action-RPG for reviewing statistics and geometry, built to run on school
Chromebooks in Chrome. The same game runs in two looks, chosen on the title screen (and switchable from the
pause menu): **2D Pixel** (Canvas 2D pixel art) and **3D Toy Box** (three.js, cel-shaded). All art is
generated in code; there are no image files and no build step.

## What is in this build (the "vertical slice")

- Title screen (name, look), a cloaked tutorial on the country road, Malgrim's ambush, Headmaster Laporte's
  rescue and the "remind me who you are" look picker, the escort into Flinkerton.
- Flinkerton town: shops (potions, outfitter, general store, bakery), NPCs with daily routines and dialogue,
  side quests, guards and a light "wanted" system.
- Flinkerton Academy: class pick (Warrior, Mage, Rogue), lessons, infirmary, training yard, and the
  specialization ceremony at level 8 (Knight, Berserker, Battlemage, Conjurer, Sorcerer, Monk, Archer, Thief,
  Ninja). Every class and subclass has its own resource, attack ranks, abilities and boons
  (`docs/CLASSES.md`). The two classes you do not pick join you as classmates.
- Whisperwood forest: eight enemy types, rune chests, the sealed grove and the boss, Old Mossback.
- The other four town gates are sealed "until next term".

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Arrow keys (or I J K L) | Attack in that direction (hold to keep attacking) |
| E | Talk, open, pick up |
| Space, Q, F, Shift | Class abilities, unlocked as you level |
| 1 - 6 | Use items |
| Tab | Choose a boon when one is ready |
| M | Map |
| Esc or P | Pause (save, switch 2D/3D, quality, controls) |

## Math questions

Questions are not written yet. The game already calls a question "gate" at level-up boons, the
specialization, rune gates and rune chests, boss shield phases, the Focus scroll, Academy lessons, quest
turn-ins and shop haggling. For now a clearly labeled placeholder card appears instead. How to plug in a
question bank: `docs/QUESTIONS.md`. URL option `questions=off|auto|stub` controls the placeholder.

## Play it locally

The game must be opened from a web address, not by double-clicking `index.html`.

```sh
node tools/serve.mjs
```

Then open `http://127.0.0.1:8080/`.

## Put it online for students (GitHub Pages)

1. On GitHub, open this repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick the branch that holds this code and
   the `/ (root)` folder, then **Save**.
3. After a minute the page shows the address, `https://<your-user>.github.io/fantasy-rpg-interface/`.
   That link is what students open.

Saves live in each browser's local storage (per device and per Chrome profile).

## Useful URL options

`renderer=2d|3d`, `questions=off|auto|stub`, `perf=1` (frame stats), `quality=0|1|2`, and for development
`debug=1` (exposes `window.__game`), `test=1` (manual stepping), `skipintro=1`, `zone=<id>`, `seed=N`.
Renderer art gallery: `/tools/gallery.html?renderer=2d&page=0` (pages 0-4).

## Tests

```sh
node --test tests/node           # unit tests, data validation, and a bot that plays the story to the boss
node tests/e2e/smoke.cjs         # headless Chromium: both looks, scenarios, a real new game, every menu
node tests/e2e/showcase.cjs      # screenshots of every class and subclass ability (tests/e2e/out/showcase/)
node tools/validate-data.mjs     # map and content checks
node tools/map-preview.mjs town  # PNG overview of a map
```

## Where things are

- `docs/CONTRACTS.md`: how the pieces fit (authoritative). `docs/STORY.md`: story and ids.
  `docs/CLASSES.md`: class design. `docs/notes/`: notes from each part of the build.
- `src/core/`: game rules (runs in Node too). `src/data/`: maps, enemies, NPCs, dialogue, quests, classes.
- `src/ui/`: panel, minimap, menus. `src/render/r2d/` and `src/render/r3d/`: the two looks.
- `src/questions/custom.js`: the file to fill in with a question provider.
