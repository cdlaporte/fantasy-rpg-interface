# Round 2, package E: 3D view and UI polish

## Changed, by file

- `src/render/r3d/index.js`: `config.cameraZoom` is a base factor in `placeCamera` and the cutaway scale (cutscene `camera.zoom` stays relative to it); `config.modelScale` multiplies size for every rig except projectile and effect (model, shadow radius, aura/tag heights, cutaway radius). `project()` and `viewRect()` follow the camera, so culling still covers the screen.
- `src/render/r3d/terrain.js`: the border ground is now a frame OUTSIDE the map only (y -0.5), no longer a plane under it, so water (-0.2), shallows (-0.07) and pits show. New water-mesh faces: map-edge skirt (surface down to the bed) and a face between shallows and deep water. Checked: forest brook, wisp pond, brook leaving the south edge, town river, intro stream and bridge.
- `src/render/r3d/rigs/humanoid.js`: Laporte's wizard hat is set back (pitched about the head), gold band; high maroon mantle collar with gold trim and clasp.
- `src/data/looks.js`: `PLAYER_LOOKS` = 8 (index 0 and 1 unchanged; 2 green b, 3 light a, 4 dark b, 5 green a, 6 light b, 7 dark a; greens `#7fbf6a`, `#8cc77a`). `LAPORTE_LOOK.hat` = navy wizard hat.
- `src/ui/laportePortrait.js`: wizard attire painted around the unchanged face (`attire: false` = original studyHallSim pixels; default on).
- `src/ui/worldOverlay.js`: damage 18 / crit 26 with a thick dark outline, nameplates 16 bold, prompts 17 bold, bubbles 16 bold; `headHeight(v, mul)` and `MODEL_SCALE_3D`, applied when the renderer id is `3d`; prompt key from `keyLabel('interact')`.
- `src/ui/panel.js`, `feedback.js`: all key names from `keyLabel(action)`, re-rendered on `onBindingsChange` (ability slots, item slots, boon/spec nudge, prompt fallback, skip hint, ability-unlocked banner and how-to line). Tutorial `{text, keys}` untouched.
- `src/ui/tooltip.js` (new): `tip(node, dataOrFn)`, `untip`, `hideTip`, pure `tipContent`, `tipPosition`. One shared element, 250 ms delay, follows the mouse, `pointer-events: none`, no focus. Used in panel (items, abilities, stats, attack box, quest, companions, HP/XP/resource bars, gold, nudges), shop rows, inventory rows and hotbar, class/spec/boon cards and their ability rows. Native `title` attributes are gone.
- `src/ui/pickers.js`: look picker is a 4 x 2 grid (144 px portraits, 128 px at <=1150 px wide), arrows and mouse, name only.
- `css/ui.css`: `--ui-scale` (1) and `--panel-w` (296 px, was 280); every font size raised (pixel font >= 10 px, body >= 16 px) through `calc(N px * var(--ui-scale))`; bolder numbers; tooltip styles; panel layout for 1366x657 (`max-height: 720px`) and 1024x600 (`max-height: 640px`).
- Tests: `tests/node/ui-r2e.test.mjs` (new), `ui-laporte.test.mjs` (goldens now pass `attire: false`; attire test), `data-narrative.test.mjs` (8 looks, Laporte hat), `meta-progression.test.mjs` and `bot.test.mjs` (look count 2 -> 8, one assertion each). `tests/e2e/ui.cjs` + `ui-fixtures.cjs`: 8-look grid by keyboard and mouse, picker fits both sizes, tooltips on hover (delay, off cursor, on screen, click and focus unaffected, shop, boon card), panel fit with quest, companions and both nudges. The fixture `merge` now deep-copies arrays (the core mutates its hud arrays in place, which blanked the fixture abilities).

## Notes for others

- The modal layer left edge uses `var(--panel-w)`; anything positioned for a 280 px panel should too.
- `src/ui/index.js` is not mine: tooltips need no setup (`tooltip.js` installs its document listeners on the first `tip()` call).
- Request (A/dialogue owners): `dialogueBox.js` and `modalKit.js` hints (E, Tab, shop H, inventory 1-6) still print fixed key names; they follow modal key handling, not the bindings.
- HudState could carry `abilities[i].cd` (seconds) and `companions[i].level`; the tooltips use them when present (cooldown otherwise shows Ready / Ready in Ns from `game.abilities.cdLeft`).

## Known gaps

- The portrait's hat crown is only two rows tall (the canvas has no room above the head), so the tip is a small flop to the right.
- Ability names in the panel are one line at 1366x657 (long names end in an ellipsis; the tooltip has the full name).
- r3d gallery/harness e2e scripts were not rerun; failing node tests left: kit-mage-dps (C), lesson op (B), xp curve / level up / stats (A).
