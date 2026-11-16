# Round 2, package A: controls, settings, teacher mode

Run: `node --test tests/node` (r2a-bindings, r2a-input, r2a-progression + the fixed meta-progression tests) and
`node tests/e2e/r2a-menus.cjs [--2d]` (real title screen, screenshots in `tests/e2e/out/r2a-*.png`).

## What changed, file by file

- `src/platform/bindings.js`: the fixed API is unchanged. Added `ACTION_INFO` (display names), `FIXED_ACTIONS`
  (`map pause inventory`: `ui/index.js` handles their keys itself, so they are shown but not rebindable),
  `RESERVED_CODES` (Esc, P, B, M, Meta, CapsLock: never given to another action), `rebind(action, code, slot, storage)`
  (slot 0 = primary key, 1 = extra keys; the new binding wins and the code, plus its left/right twin, is removed from
  every other action; returns `{ok, reason, took: [{action, empty}]}`), `clearAlt`, `altLabels`, `actionsUsing`,
  `unboundActions`, `pairOf`, `MOVE_ACTIONS`, `ATTACK_ACTIONS`, and live tutorial helpers `tutorialStep`, `keyText`,
  `liveKeyLabels`, `expandActions`.
- `src/platform/input.js`: rebuilt on bindings (code -> action map, rebuilt on `onBindingsChange`; per-key down
  counting so e.g. either Shift keeps the slot held). Attack keys combine into `attackAngle` (see below).
  `scriptedInput().set({attackAngle})` holds the 1-2 keys of that angle and reports the exact angle; new
  `scriptedInput().attack(dir, down)` and exported `dirsForAngle(angle)`. The modal "swallow" rule is kept.
- `src/core/progression.js`: proper level-down (see below), `boonLevels`, `boonSlots(level)`, `setLevel` resets xp
  to 0 of the new level (full at the cap) when the level changes, `'level:set' {level, prev}` on every level change,
  "You are now an Archer" grammar.
- `src/core/debug.js`: `goTo(place)` / `places()` and `game.sys.debug.teacher` (the teacher tools API, every call
  refused unless `game.teacher === true`): `addXp levelUp levelDown setLevel setClass setSpec god isGod gold goTo places`.
- `src/data/cutscenes/{intro,ambush,rescue,academy}.js`: tutorial prompts use `tutorialStep` (text and key caps from
  the bindings). The rest of each file is unchanged.
- `src/main.js`: `loadBindings(storage)` first; renderer = `?renderer=` || `config.defaultRenderer`; graphics quality
  from storage; teacher question settings applied after the title; teacher game setup (below).
- `src/render/index.js`: an unknown renderer id falls back to `config.defaultRenderer` (3D); 2D stays the automatic
  fallback when WebGL fails and a hidden `?renderer=2d` override.
- `src/ui/title.js`: no look choice; buttons NEW GAME / CONTINUE / OPTIONS; Options -> Settings, Teacher options
  (PIN). Resolves `{name, renderer, continueSave, teacher}`. Teacher saves are hidden from the student Continue list.
- `src/ui/pauseMenu.js`: no look choice; rows Resume, Settings, Graphics, Sound, Save game, Controls, Teacher tools
  (teacher games only), Quit. Settings and Teacher tools open in place of the pause box (Esc returns).
- `src/ui/settings.js` (new): the settings screen (title and pause).
- `src/ui/teacher.js` (new): PIN pad, teacher options, teacher tools, badge, pure helpers (Node-safe).
- `src/ui/modalKit.js`: controls card only (`controlRows()` from bindings; the card re-renders on binding changes;
  `CONTROLS` kept as a load-time snapshot).
- `css/menus.css`: everything above.

## For other packages

- **C (kits/index.js):** `inp.attackAngle` = radians of the combined held attack keys (0 = east, y down; NaN when
  none). Opposite keys cancel; a full cancel uses the most recent key. `attackDir` = nearest DIR (on a diagonal, the
  more recently pressed of the two). The attack is ONE gesture: `attackPressed` fires only when the first attack key
  goes down (nothing held before), `attackReleased` only when the last goes up (value: the direction just before),
  and `attackHeldT` keeps counting while any attack key is down, so I -> I+L -> L keeps a charge going. Your own
  `st.heldT` (reset on `attackPressed`) therefore also continues. A straight switch with no overlap (or
  `scriptedInput.set({attackDir})` to a new dir) is release + press in the same step, as before.
  Companions: listen to `'level:set' {level, prev}` (every level change, also downward); `'levelup'` is only emitted
  for upward moves. Also `'rank:down' {rank, prev}` and `'boons:removed' {ids}` exist. `data/classdefs/mage.js`
  basic desc says "Hold an arrow key": consider "Hold an attack key".
- **E (panel.js, feedback.js, worldOverlay.js):** ability key caps: `keyLabel(slot)` (`space q f shift`), items
  `keyLabel('item' + n)`, boon/spec nudges `keyLabel('boon')`, prompt `keyLabel('interact')` (player.js still fills
  `prompt.key = 'E'`); re-render on `onBindingsChange`. The tutorial HudState is unchanged `{text, keys: [labels]}`:
  labels are already resolved from the bindings when the step runs (no change needed in feedback.js; attack keys
  come as `I J K L` by default, arrows only when bound as primary). `tests/e2e/ui.cjs` "title screen" presses
  Down/Right/Down/Enter for the old look row: it should now be Down, Enter. The pause rows are Resume, Settings,
  Graphics, Sound, Save, Controls, (Teacher tools), Quit (Graphics kept at index 2 so the ui.cjs pause check passes).
  Keycaps in `ui.css` are 8 px; menus.css raises them to 10-11 px inside A's screens, the title and the pause menu.
- **B:** `Questions.teacher` is true in a teacher game; `Questions.topics` = enabled topic ids or null (all), loaded
  from storage `flinkerton.settings.topics` at boot and updated live by the options screen. The teacher's
  "Questions: off" switch (`flinkerton.settings.questions` = 'off') sets `Questions.mode = 'off'` at boot unless a
  `?questions=` parameter is given.
- **Everyone:** `game.teacher === true` only in a teacher game. Teacher games save as `"<name> (teacher)"` with flag
  `teacher_game` (students cannot type brackets, so a student never overwrites one); continuing a student save in
  teacher mode copies it under the teacher name. `player.name` / `player.data.name` hold the name without the tag.

## Teacher mode

Title -> Options -> Teacher options -> PIN (`config.teacherPin`, typed or clicked; wrong = shake + clear). The unlock
is remembered in sessionStorage (`flinkerton.teacher.unlocked`) for this browser session only. Teacher options:
New teacher game / Continue a save (any save), Questions on/off, the 8 Unit 4 topics (at least one stays on).
In game: TEACHER badge (top centre of the view), pause -> Teacher tools: +100 / +1000 XP, Level up / down, set level
1-12 (level jumps are quiet: no toast or burst per click), Class (plain class, drops the subclass), any of the 9
subclasses (sets the parent class), God mode, +500 gold, Go to: country road, ambush, town, academy, forest, forest
boss. Go to keeps level/class/spec/boons; road and ambush reset the story flags to that point (keeping
`look_choice` and `teacher_game`); town and later only ADD flags (intro done, cloak off, plus class_chosen /
forest_open / spec_ceremony_done when the player has a class / subclass). Town without a class plays the arrival
(leads to the class pick); academy without a class plays the class pick; the forest needs a class (Warrior if none).

## Level down (progression)

Stats, hp (full), attack rank and ability unlocks follow the level (kit re-equipped so holds above the level end);
xp = 0 of the new level; boons remember the level they were taken at (`boonLevels`, saved; older saves assume slot
order 4/6/8/...); boons taken above the new level are removed and pending boons = min(slots still earned - kept,
old pending + removed); the offer is cleared; `pendingSpec` cleared below 8 when there is no subclass; the subclass
itself is kept; look refreshed (aura below 10 goes). Emits `'level:set'`, `'rank:down'`, `'boons:removed'`.

## Known gaps

- Esc/P (pause), B (bag) and M (map) are fixed: `ui/index.js` (no owner this round) hard-codes them.
- A tutorial prompt already on screen keeps its key names if the player rebinds mid-prompt (the next prompt is right).
- In this worktree the panel still shows Space/Q/F/Shift (E's panel.js); `r2a-menus.cjs` prints a WARN until merged.
- Test failures left for others: `kit-mage-dps` conjurer L12 (C), `meta-inventory` "lesson op" (B).
