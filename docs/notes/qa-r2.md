# Round 2 QA

## What I ran (all on the merged tree, headless Chromium, 3D via SwiftShader)

| Script / command | Result |
| --- | --- |
| `node --test tests/node` | 431/431 |
| `tests/e2e/skeleton.cjs` | pass (2d + 3d) |
| `tests/e2e/ui.cjs` | pass after the fix below |
| `tests/e2e/showcase.cjs` | pass, 246 shots before the change; now 3D by default (`2d`/`all` opt in) |
| `tests/e2e/r2a-menus.cjs` | pass (teacher flow, 9 subclasses, level up/down, settings) |
| `tests/e2e/r2b-questions.cjs` | pass |
| `tests/e2e/r3d-gallery.cjs` | pass |
| `tests/e2e/r2d-gallery.cjs` | pass (2D fallback) |
| `tests/e2e/smoke.cjs` (3d, and `2d`) | pass both |
| `tests/e2e/r2qa-teacher.cjs` (new) | pass: 12 kits at level 12, 5/5 casts fired each |

## Test changes (scripts only)

- `ui.cjs`: title test no longer presses the removed look row (name, Down, Enter).
- `smoke.cjs`: default 3D (`2d` / `all` as argument). Question cards met on the way (gates, boss shield, lessons, boon
  trial) are answered with `__game.answerQuestion(true)`. New keyboard section: `Questions.preview()` makes the next
  problem known, then a multiple-choice card is answered by its number key (must not drink hotbar item 1) and a typed
  card by typing the answer. Look picker: key 6 = look index 5 (asserted `look_choice === 5`). Pause: the 2D/3D switch
  is gone; it now opens Settings from the pause menu, checks the card fits the view, Esc back, Esc closes.
- `showcase.cjs`: 3D by default.
- `r2qa-teacher.cjs` (new): teacher flag set, teacher API level 12, plain classes + all 9 subclasses, every ability cast
  once in the `class_demo` arena; asserts `renderStats().unknown`, `__game.errors()` and console stay empty.

## Full 3D new game (smoke.cjs, bot + keyboard)

Intro tutorial, stick, rats, giant rat, ambush (Malgrim), rescue, look picker (index 5), town arrival, class pick,
free play, inventory, shop, Unit 4 card by keyboard, pause/settings, boon by Tab. Console errors: none.
`__game.errors()` empty. `renderStats().unknown` empty. The forest is covered by the `forest` / `forest_boss`
scenarios (and the rest of the full run is covered by the node bot tests).

## Game fixes

1. `src/core/kits/archer.js` (`spawnFalling`): TypeError `Cannot read properties of undefined (reading 'rainLook')`
   when the player changes kit (teacher subclass switch, respec) while an Arrow Rain zone is still ticking: the zone's
   `onTick` outlived `p.data.kit.ar`. Now returns when the archer state is gone. Found by the teacher tour.
2. `css/menus.css`: Settings footer hints overlapped the card's bottom edge at 1366x657. Tightened rows for
   `max-height: 700px` (keys 30 px, margin 1 px, shorter message line); the old 640 px rule keeps only the hint hiding.
   Also `font-variant-ligatures: none` on `.set-fixed` ("fixed" rendered as "Axed" through the font's fi ligature).
3. `css/ui.css`: during a boss fight the centred boss bar covered the toast stack ("Elowen and Pip grow stronger" was cut
   off). `#hud.has-boss #toasts` now sits at top 74 px.

## Screenshots reviewed

Title, Settings (before/after), teacher tools, 8-look picker, rescue/town/forest/forest-brook, rune gate card (typed),
boss-shield card, HUD at gameplay zoom, Mossback fight. All readable and not overlapping after the fixes.

## Still open / notes

- A scenario that jumps levels shows a "Level 3 +2 levels!" banner at load (debug scenario artefact, not a play path).
- In the Mossback arena at the default camera the boss sits at the top edge under the boss bar when the player stands
  4 tiles south of it; it is fully visible in the normal fight (not changed).
- The 2D fallback remains only through `?renderer=2d` or when WebGL is missing.
