# Round 3, package G: quest log and looks

## Changed, by file
- `src/ui/questLog.js` (new): modal `questLog`. Tabs Active / Done, list (name, giver and zone, "3/6" or "Step 2/4" hint, star on the tracked one), detail pane (giver portrait, steps: done = struck through with a check, current = highlighted with count from `progress(id)` and the goal's `n`, the next step dimmed, later ones "???" to avoid spoilers; rewards xp, gold, items with icons and tooltips; Track button / "TRACKED"). Keys: arrows pick, Enter tracks, Left/Right/Tab switch tabs, Q or Esc closes; mouse hover/click, tab clicks, Track button. Empty state "No quests yet. Talk to people around Flinkerton!". Pure helpers exported and node-tested: `goalNeed`, `normalizeRewards`, `stepViews`, `questZone`, `questEntries`. Uses only `game.quests.*`, `game.data.quests/npcs/zones/items`; opens frozen via `game.openModal`.
- `src/ui/modalHost.js`: registers `questLog`. `src/ui/index.js`: Q opens it (not during a modal or a cutscene; stops propagation), panel gets `onQuestClick`. `src/ui/panel.js`: the quest box is clickable. `src/ui/pauseMenu.js`: "Quest log (Q)" row placed after Controls (so the ArrowDown counts in `ui.cjs` and `ui-harness.cjs` stay valid).
- `src/platform/bindings.js`: new fixed action `quests` (`KeyQ`), in `FIXED_ACTIONS`, `RESERVED_CODES` (nobody can rebind to Q); `q` slot is now `['KeyU']`; `clone()` strips `KeyQ` from every other action so old saved settings do not keep Q as an ability key. `src/ui/modalKit.js`: controls card row "Quest log". `src/ui/settings.js` (one line, outside the ownership list): fixed-keys note lists the quest log.
- `src/data/looks.js`: `PLAYER_LOOKS` 8 -> 10: index 8 build a, skin `#f3d2b8`, braids `#e39a6b`, rose tunic; index 9 build b, skin `#e9c39d`, bun `#14110f`, orange tunic.
- `src/ui/pickers.js`, `css/ui.css`: look picker 5 x 2 (portraits 120 px, 104 px under 1150 px wide); quest log styles.
- Tests: new `tests/node/r3g-questlog.test.mjs`, `tests/e2e/r3g-questlog.cjs` (screenshots `tests/e2e/out/r3g-*.png`, all looked at). Updated look counts (ui-r2e, data-narrative, meta-progression, bot, ui-fixtures, ui.cjs) and the Q expectations in `r2a-bindings` and `r2a-input` (Q is no longer an ability key).

## Notes for others
- Cutscene check: `game.cutscene.active` is a truthy id string during e.g. `town_arrival`, so Q does nothing then. e2e uses `scenario('forest')`.
- A quest only appears in the log if `game.data.quests[id]` exists; biome quest files need `name`, `giver` (npc id), `steps[].text`, `rewards`.
- Zone name in the list comes from the first step goal that names a `zone`.

## Known gaps
- The Enter "Track" hint stays visible on the Done tab (Enter just buzzes).
- Remaining node failures are A's (level cap 20): meta-progression "level up", r2a-progression "level down".
