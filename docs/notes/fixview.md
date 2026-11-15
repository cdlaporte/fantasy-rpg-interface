# fixview: browser polish and end-to-end tests

Branch `wp/fixview`. Touched only `src/ui`, `css`, `src/render`, `tests/e2e`, this note.

## Fixed

1. **Announcements overlapped.** `src/ui/feedback.js` now has one queue for every centered announcement (zone card,
   level up, new ability, attack rank, quest banners). Order by priority: zone card, level up, ability, rank, quest.
   Only one shows at a time; each lasts 1.5 to 3 s and shortens when more are waiting. A newer zone card replaces a
   queued older one.
2. **Stuck letterbox bars.** `feedback.reconcileLetterbox(game)` runs on every UI poll and sets the bars from the truth
   (`game.cutscene.letterbox && game.cutscene.active`), in addition to the `'letterbox'` event.
3. **Void beyond the map.**
   - 3D (`terrain.js buildBorder`, mounted in `r3d/index.js`): one big ground plane plus a ring of canopy blobs in the
     zone's tree/hedge colors (outdoors); a dark wall ring with skirting for the academy interior.
   - 2D (`tiles.js buildBorderPattern`, drawn in `r2d/index.js`): a world-aligned seamless canopy pattern outdoors, dark
     brickwork for the academy. The partial chunks at the east/south edge no longer paint a flat blue-grey filler.
4. **Class kits.** Every class and spec at levels 3, 8 and 12, in both renderers, casting the basic attack and every
   unlocked ability: `renderStats().unknown` stays empty, no console errors, every ability fires
   (`node tests/e2e/matrix.cjs`). Visual fixes found by looking at the showcase: the `shadow` aura (archer, thief,
   ninja, clones) was a black smoke ball that hid the character; now a soft wisp in the aura color (2D `live.js`
   and 3D `fx.js`).
5. **Requests.** `r3d:contextlost` on `#view` now switches to 2D with a toast (`src/ui/index.js`). Renderer hot swap
   (`src/render/index.js swapRenderer`) kept calling the disposed old renderer during the async init of the new one
   (`TypeError ... imageSmoothingEnabled` in `__game.errors()`); the old renderer is now disposed only after the new
   one is ready. Lead request: the rune circle / barrier / seal in 3D drew a five-pointed star; replaced by a hexagon
   lattice inside the double ring with rune ticks (`fxgeo.js runeCircle`). 2D never drew a star (squares and a keyhole).
   Not mine and still open: input.js swallowing the answer key of the question modal (smoke asserts it does not drink
   the potion and passes, so it works as is), the gallery fixture notes, and content notes (`color` on effect looks).

## Found in core/data (not fixed)

- **Cooldowns survive scenario reloads.** `debug.js` `class_demo` (and other scenarios) reuse `player.data.cd`.
  Reproduction: `__game.scenario('class_demo', {classId:'ninja', specId:'ninja', level:12}); __game.step(1, {held:{space:true}})`,
  then run the same scenario for another class and press the same slot a few frames later: the ability does not fire
  (`game.abilities.ready(p, 'space')` is false) because `until` is still ahead of `game.t`. Fix: call
  `game.abilities.reset(game.player)` in `setupPlayer`. The e2e driver works around it.
- **Resources start at 0 in `class_demo`** (rage, mana, ki): most abilities are not castable until `game.kits.gain(p, 999)`.
  The driver does that; a demo that fills the resource would be friendlier.
- `class_demo` and the other scenarios set the level with `setLevel`, which shows a "Level up! +11 levels" banner;
  harmless for tests (the showcase hides banners with CSS).
- Real new game: input is locked by the intro cutscene for the first seconds, so a test that just presses D never
  moves; `tests/e2e/skeleton.cjs` now walks in `class_demo`.

## Scripts

- `node tests/e2e/smoke.cjs [2d|3d]` (about 6 to 8 minutes for both, mostly the scripted fight; screenshots in
  `tests/e2e/out/smoke-*.png`): all scenarios, a real new game played with keyboard for its first minutes (tutorial,
  stick, rat, XP, ambush, rescue, look picker, town, class picker), inventory, shop purchase, question card answer
  with key 1, pause with live 2D/3D switch and back, boon trial question + picker; WebGL checked in 3D;
  `__game.errors()`, console and `renderStats().unknown` empty.
- `node tests/e2e/matrix.cjs [2d|3d] [kitId]` (about 1.5 min 2D, 3.5 min 3D): the class/spec matrix assertions.
- `node tests/e2e/showcase.cjs [2d|3d] [kitId] [level]` (about 5 min for everything, 246 images): writes
  `tests/e2e/out/showcase/<renderer>-<kit>-L<level>-<ability>.png` (`basic` or the ability id), 900x500, camera
  zoomed to 1.35, banners and minimap hidden. Same assertions as the matrix. Shared driver: `tests/e2e/kitdriver.cjs`
  (per-ability frame offsets in `PEAK`; hold abilities are photographed after the release).

## Unfinished / caveats

- Kit visuals were judged from the showcase contact sheets, not frame by frame; the effects of every ability are
  visible in both renderers but some are generous (Runestorm, Aegis, Skyfall fill the screen; familiars are small in
  3D). The conjurer's Arcane Nova flashes a red disc in 2D.
- Timing in the sandbox depends on machine load; the smoke test uses long screenshot timeouts with a retry.
