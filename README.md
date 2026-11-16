# Flinkerton Academy

A bright, light-hearted fantasy action-RPG for reviewing statistics and geometry, built to run on school
Chromebooks in Chrome. It runs in a cel-shaded 3D "toy box" look (three.js); a 2D pixel-art renderer is kept
only as an automatic fallback for computers without WebGL (or `?renderer=2d`). All art is generated in code;
there are no image files and no build step.

## What is in this build (the "vertical slice")

- Title screen (name, options), a cloaked tutorial on the country road, Malgrim's ambush, Headmaster Laporte's
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
| I J K L (or arrow keys) | Attack in that direction; hold two (e.g. I + L) to attack diagonally |
| E | Talk, open, pick up |
| Space, U, O, H | Class abilities, unlocked as you level (Q, F, Shift also work) |
| 1 - 6 | Use items |
| Tab | Choose a boon when one is ready |
| M | Map |
| Esc or P | Pause (save, settings, controls) |

Every key can be changed in **Options → Settings** on the title screen or from the pause menu.

## Teacher mode

On the title screen choose **Options → Teacher options** and enter the PIN (**9631**). From there you can start or
continue a game in teacher mode, turn questions on or off, and switch individual Unit 4 topics on or off. In a
teacher game, the pause menu has **Teacher tools**: add XP, level up or down (1-12), pick any class or subclass
instantly, god mode, extra gold, and jump to any part of the story. Questions show their answer and worked
solution. The PIN is a classroom lock, not real security: anyone who reads the code can find it.

## Math questions

The game asks generated **Geometry C Unit 4: Similar Figures** problems (ratios, extended ratios, proportions,
missing sides of similar triangles, AA/SSS/SAS, the Triangle Proportionality Theorem, parallel lines and
proportional parts, the Triangle Angle Bisector Theorem) with drawn diagrams, at level-up boons, the
specialization, rune gates and rune chests, boss shield phases, the Focus scroll, Academy lessons, quest turn-ins
and shop haggling. Rune gates and boss shields need a correct answer (a wrong answer shows the worked solution and
then a new problem); elsewhere a wrong answer only gives a smaller reward. Details and how to add a future unit:
`docs/QUESTIONS.md`.

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
