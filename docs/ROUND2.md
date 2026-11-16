# Round 2: playtest feedback, teacher mode, Unit 4 questions

Mr. Laporte (the teacher this game is for) played build 1 and chose the **3D toy-box look**. This round acts on
his feedback. Five packages run in parallel, each in its own git worktree. This file fixes the seams between them;
`docs/CONTRACTS.md` and `docs/notes/*.md` still describe everything else.

## His feedback, in short

1. Characters look small (3D); text is small; walking is slow.
2. Water renders wrong in the forest (3D).
3. The town is grid-like, too big, empty, and the buildings all look alike.
4. Laporte's portrait should wear his wizard attire, like his in-game character.
5. Mouse-over tooltips for items and everything else.
6. Attack with IJKL (arrows too), including diagonals by holding two keys (I+L = up-right). Abilities near
   IJKL: Space stays the dash; others default to U, O, H. A settings screen to rebind controls.
7. Players do too little damage; enemies and the boss have too much health; leveling is too slow (at level 9-10 he
   could barely get Old Mossback to 75%). Ground-targeted abilities (e.g. Meteor) should auto-target; some areas
   bigger. Companions should get stronger as you level.
8. A PIN-protected teacher mode (PIN 9631): infinite XP, level up AND down, any class or subclass at any level,
   questions shown with their answers.
9. Real Unit 4 problems (Geometry C: Similar Figures) scattered through the game. NEVER ask students to complete a
   similarity statement; NO polygon/triangle scale-factor or perimeter-ratio problems.
10. Appearance picker: 8 options = 2 builds x 4 skin tones (light, medium, dark, green), no gender labels.
11. 2D is retired: 3D is the only choice; 2D stays only as an automatic fallback when WebGL is missing.
12. Wrong answers: rune gates and boss shields must be answered correctly (show the worked solution, then a new
    problem after a few seconds); everywhere else a wrong answer just gives a smaller reward.

## Already done in the prep commit (do not redo)

- `config.js`: `cameraZoom: 1.3`, `modelScale: 1.3`, `playerSpeedMul: 1.3`, `xpCurve: {base: 15, exp: 1.5}`,
  `teacherPin: '9631'`, `defaultRenderer: '3d'`; question contexts: only `gate` and `boss_shield` are blocking.
- `progression.js`: `xpNext` reads `config.xpCurve`; `recalc` multiplies speed by `config.playerSpeedMul`.
- `InputState.attackAngle` (contracts.js `makeInputState`/`clearInputState`): radians of the combined held attack
  keys (8 directions; 0 = east, clockwise on screen, i.e. `atan2(dy, dx)` with y down), `NaN` when none held.
  `attackDir` stays (the DIR nearest to `attackAngle`) for facing and old code.
- `src/platform/bindings.js`: the fixed bindings API (`ACTIONS`, `DEFAULT_BINDINGS`, `getBindings`, `setBindings`,
  `resetBindings`, `loadBindings(storage)`, `keyLabel(action)`, `keyLabels(action)`, `codeLabel(code)`,
  `actionFor(code)`, `onBindingsChange(fn)`). Ability actions keep the slot names `space q f shift`
  (defaults Space, U, O, H; Q/F/Shift stay as secondary keys).
- `Questions.teacher` (bool) and `Questions.topics` (array of enabled topic ids, or null = all) on the shared
  Questions object; `src/questions/unit4/index.js` exports the fixed `TOPICS` list.
- `css/menus.css` (package A) and `css/questions.css` (package B) exist and are linked in `index.html`.

Tests that the prep commit broke, and who fixes them: `meta-progression.test.mjs` "xp curve", "level up",
"stats from the balance sheet" (A, owner of progression); `meta-inventory.test.mjs` "lesson op" (B: lessons are
no longer blocking); `kit-mage-dps.test.mjs` conjurer L12 (C, balance).

## Fixed seams between packages

- **Teacher mode flag:** `game.teacher === true` when a game runs in teacher mode (set by A when the game starts
  or is switched). A also sets `Questions.teacher`. Anyone may read `game.teacher`; only A writes it.
- **Key labels:** every on-screen key name comes from `keyLabel(action)` (re-render on `onBindingsChange`). A owns
  input.js, the settings screen, the controls card (`ui/modalKit.js` CONTROLS) and tutorial text; E owns the
  panel (`ui/panel.js`) and banners (`ui/feedback.js`), and must use `keyLabel` there.
- **Building styles** (package D draws them, in both `render/r3d/props.js` and `render/r2d/props.js`): props of
  model `house` or `shop` may carry `look.style`, one of
  `cottage` (thatched, rounded roof), `townhouse` (tall, timber-frame, 2 storeys), `tower_house` (round, cone
  roof), `mushroom` (mushroom-cap roof), `windmill`, `greenhouse` (glass), `bakery` (striped awning, round brick
  oven chimney), `library` (columned porch, dome), `potion` (crooked purple tower, bubbling cauldron chimney),
  `outfitter` (bay windows, hat sign), `cafe` (terrace with umbrellas), `general` (lean-to with crates),
  `guardhouse` (crenellated). No `style` = the current generic house/shop. No new prop model names.
- **Model scale:** E applies `config.modelScale` to characters and creatures in the 3D renderer and keeps the
  overlay's head heights in step; D does not scale props.
- **Laporte:** E owns his look (`data/looks.js` `LAPORTE_LOOK`: add `hat: {style: 'wizard', ...}` and a mantle) and
  the portrait (`ui/laportePortrait.js`); the 3D rig picks the hat up through the normal look path.
- **Companions:** C owns `core/companions.js`; their panel entries (E) may show `level` if HudState
  `companions[i].level` is present (C adds it).

## Ownership (edit only your own files; everything else must stay byte-identical)

| Package | Owns |
| --- | --- |
| A. Controls, settings, teacher mode | `src/platform/input.js`, `src/platform/bindings.js`, `src/main.js`, `src/ui/title.js`, `src/ui/pauseMenu.js`, `src/ui/modalKit.js` (controls card only), new `src/ui/settings.js`, new `src/ui/teacher.js`, `css/menus.css`, `src/core/progression.js`, `src/core/debug.js`, `src/render/index.js`, tutorial key text in `src/data/cutscenes/*.js`, tests `tests/node/r2a-*.test.mjs` + the progression tests listed above, `docs/notes/r2a.md` |
| B. Unit 4 questions | `src/questions/**`, `src/ui/questionModal.js`, `css/questions.css`, `src/core/gates.js`, `src/core/inventory.js` (lesson/chest/haggle question handling only), `docs/QUESTIONS.md`, tests `tests/node/r2b-*.test.mjs` + the lesson test, `docs/notes/r2b.md` |
| C. Combat feel and progression | `src/core/kits/**`, `src/core/abilities.js`, `src/core/companions.js`, `src/core/combat.js`, `src/core/ai.js`, `src/data/classdefs/**`, `src/data/specs/**`, `src/data/boondefs/**`, `src/data/enemies/**`, `src/data/quests/**` (xp rewards only), tests `tests/node/kit-*.test.mjs`, `tests/node/r2c-*.test.mjs`, `docs/notes/r2c.md` |
| D. Town and buildings | `src/data/zones/town.js`, `src/data/props.js`, `src/render/r3d/props.js`, `src/render/r2d/props.js`, `src/data/npcs/town.js` (routine markers only), `tools/validate-data.mjs` (town marker list only if a marker is renamed — avoid), `docs/notes/r2d-town.md` |
| E. 3D view and UI polish | `src/render/r3d/index.js`, `src/render/r3d/terrain.js`, `src/render/r3d/rigs/**`, `src/render/r3d/kit.js`, `css/ui.css`, `src/ui/worldOverlay.js`, `src/ui/panel.js`, `src/ui/feedback.js`, `src/ui/pickers.js`, `src/ui/portraits.js`, `src/ui/laportePortrait.js`, `src/ui/shopUI.js`, `src/ui/inventoryUI.js`, new `src/ui/tooltip.js`, `src/data/looks.js`, tests `tests/node/ui*.test.mjs`, `tests/e2e/ui*.cjs`, `docs/notes/r2e.md` |

Shared test files that assert counts you change (e.g. the number of PLAYER_LOOKS in
`tests/node/data-narrative.test.mjs`, `bot.test.mjs`): update only the specific assertion your change affects and
say so in your notes. `tests/e2e/smoke.cjs` / `showcase.cjs` are updated by a QA pass after the merge.
