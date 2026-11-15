# Skeleton notes

## What exists

- **Frozen core (real):** `index.html`, `src/main.js`, `src/contracts.js`, `src/config.js`, `src/core/{game,systems,events,rng,math}.js`,
  `src/data/index.js`, `src/render/index.js`, `src/platform/loop.js`, `tools/serve.mjs`, `vendor/three/`, `tests/e2e/helpers.cjs`.
- **Fully written for Sim:** `src/platform/input.js` (createInput + scriptedInput).
- **Stubs** (top comment `// STUB: replaced by the <Package> package`): every other file in CONTRACTS 13 / 13a. Working basics:
  ents store (brute force), world (loadZone/solidAt/marker/zoneView/setTile/travel), player (WASD + per-axis tile
  collision, moves itself because physics is a no-op), ops (registry, `flag`/`not` conds, `flag.set`/`toast`/`fx` actions),
  save (round trip via storage), debug (`ready, game, state, errors, step, input, teleport, snapshot, setRenderer, renderStats,
  setFlag, closeModal, command`; the rest no-ops), gates.ask -> `{correct: true}`.
- **Starter data:** `tiles.js` (all 20 patterns + `wall`; index 0 = grass), `props.js` (every model), `palettes.js`
  (`LAPORTE`, `PALETTES`, `resolvePalette`), `looks.js` (`PLAYER_LOOKS`, `CLOAKED`, `CLASS_OUTFITS = {}`, `LAPORTE_LOOK`),
  `zones/mapgen.js`, `zones/test.js` (40x30, markers `start`, `far`, `house_door`, `pond`), `enemies/intro.js` (`rat`).
- **Debug renderers** `r2d` / `r3d` implement the full Renderer interface (flat squares / boxes + capsules).
- **Gallery** `tools/gallery.html?renderer=2d|3d&page=0..4` (+ optional `&zoom=`). Keys: `[` `]` page, WASD/arrows pan,
  `+`/`-` zoom, `F` refit, Space pause. `window.__gallery = {ready, renderer, page, setPage, setTime(t|null), setCamera(x,y,zoom), stats(), snapshot()}`.
  Fixture is `tools/gallery-fixture.js` (`buildPage(n) -> {title, zone, items}`).

## How to run

```sh
node tools/serve.mjs [port]           # default 8080; 0 = free port
node --test tests/node                # Node 22: runs tests/node/index.js, which imports every *.test.mjs here
node tests/e2e/skeleton.cjs           # screenshots -> tests/e2e/out/
```

## WebGL in headless Chromium

Every variant tried works in this container (WebGL2, `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)...), SwiftShader driver)`),
even with no flags. Baked into `helpers.cjs` (`WEBGL_ARGS`): `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
SwiftShader is a CPU rasterizer: use it to check correctness, not frame time.

## three.js

`0.187.0` from npm. That release no longer ships `.min` builds, so `vendor/three/three.module.min.js` and `three.core.min.js`
were minified from `build/three.module.js` / `build/three.core.js` with esbuild 0.24 (the module file imports `./three.core.min.js`).
See `vendor/three/VERSION`.

## Interpretations and additions (contract is otherwise unchanged)

1. **`game.player` is the player entity.** Section 2 also says every system is aliased as `game.<id>`; for `player` that would clobber
   the entity, so the player system's api lives only at `game.sys.player`.
2. **Init order:** `systems.js` exports `SYSTEMS` (update order, with `ops` first; ops has no update) and `INIT_FIRST = ['ops','ents','world']`.
   Those init first, then the rest in update order. The player entity is created in `player.init` (ents exists by then).
3. **`createGame` extra opts:** `zone`, `marker` (start override), `test`. New game loads `config.startZone` ('intro') at
   `config.startMarker` ('start'), falling back to `config.fallbackZone` ('test') while `intro` has no `id`. With `save`:
   flags, then `loadSystems(save.systems)`, then `world.loadZone(save.zone, [x, y])`.
4. **game additions:** `game.config`, `game.storage`, `game.questions` (the Questions module), `game.test`, `game.name`, `game.ready`,
   `game.ambience` `{daypart, tint, tintAmount}` (the clock system mutates it; `frame()` copies it into `FrameState.ambience`),
   `game.setViewRect(rect)`, `game.snapCamera()`, `game.saveSystems()` / `game.loadSystems(obj)` (save fan-out helpers).
5. **step():** sets `px,py = x,y` for every entity at the start of each step (so systems need not), runs systems (skipping
   non-`always` ones while `freeze` is non-empty), then the camera: mode `'follow'` snaps `camera.x/y` to `camera.target`'s entity;
   any other mode (e.g. `'free'` for cutscenes) leaves x/y to whoever set it. `camera.shake` decays at 2/s. `camera.target`
   defaults to the player id. `frame()` interpolates the camera between the previous and current step.
6. **Zone hooks:** game.js subscribes first to `'zone:unload'` / `'zone:load'` and fans out to `onZoneUnload` / `onZoneLoad`, then snaps
   the camera. main.js subscribes after, so the renderer loads the zone after systems ran their hooks.
7. **frame():** culls to the last `setViewRect` + `VIEW.CULL_MARGIN` (3) tiles (no culling until a rect is set), skips `asleep`/`removed`.
   Arrays are reused and may be longer than `entCount`/`fxCount`: **always loop to the count**. EntityView adds `name`, `team`, `radius`.
   `hpFrac` is `hp/hpMax` clamped (1 when hpMax is 0); `moving` = position changed since the previous step.
   The viewRect is one frame behind (main passes `renderer.viewRect()` before `render`).
8. **FxEvent defaults:** numbers 0, `x2`/`y2` null ("not given"), strings and `ent` null. `ent` is an **entity id**; `game.fx({ent: entObj})`
   is reduced to the id. `game.fx` copies into a pooled queue (max `config.fxQueueMax` = 256 per rendered frame, extras dropped).
9. **hudState():** calls every system's `hud` hook in update order; the core resets nothing. Each system owns its fields and must
   set nullable ones (`prompt`, `quest`, `boss`, `kitHud`, `tutorial`, `player.resource`) back to null itself, and must not allocate
   (keep your own preallocated objects and point the field at them).
10. **Modals:** `openModal` while one is open closes the old one first (`'modal:close'` with result undefined). If a modal object has
    `onClose(result)` it is called after `'modal:close'`. `game.commands` starts with a no-op for every command in section 9 plus
    `closeModal`; systems overwrite theirs in `init`. main.js sets `setRenderer`, `setQuality`, `quitToTitle`.
11. **Palettes:** `data.palettes` = `{LAPORTE, PALETTES, resolvePalette}`; `data.looks` = the looks.js named exports. A resolved palette is
    `{id, bg, sky, patterns: {pattern: {a, b, side}}}`; renderers use `palette.patterns[def.pattern]` colors over `def.colors` when present.
    `ZoneView.palette` is the resolved object.
12. **Zone/data files** all default-export objects keyed by id (zones too: `zones/test.js` exports `{test: {...}}`); `data/index.js`
    merges them. `shallows` uses `shape: 'water'` with `solid: false`.
13. **Questions:** `src/questions/index.js` default-exports (and names) `Questions`. Default mode is `stub` for players, `auto` with `test=1`;
    `questions=` overrides. Provider = `custom.js` default export if non-null, else `stubProvider`.
14. **Debug host:** `src/core/debug.js` has no DOM. main.js calls `game.debug.attachHost({renderFrame, renderer(), setRenderer, snapshot})`
    and sets `window.__game = game.debug` (when `debug=1` or `test=1`), then `ready = true` after the first rendered frame.
    `__game.step(n, input)` makes `input` sticky (scriptedInput semantics), steps n times, then renders one frame. main.js forwards
    window errors / unhandled rejections to `game.debug.logError(msg)`.
15. **test=1:** the loop renders every animation frame but never steps; only `__game.step` advances time. DOM keyboard input is ignored then.
16. **Extra URL params:** `zone=<id>`, `marker=<name>|x,y`, `quality=0..2`.
17. **3D camera:** distance chosen so the ground width at the focus point matches 2D (`viewWidth / 48` tiles at zoom 1); the trapezoid
    therefore shows more depth toward the top. `zoom` divides the distance.
18. **`tests/node/index.js`** (new, skeleton-owned) exists only because Node 22 treats `node --test tests/node` as a module path; it
    imports every `*.test.mjs` in that directory. Name your files `<package>*.test.mjs` and they run automatically.

## For the next engineers

- **UI:** `createUI(rootEl, opts)` where `rootEl` is `#app` and `opts = {params, storage, config}` (params = parsed URL flags:
  `renderer, questions, debug, test, perf, skipintro, seed, zone, marker, quality`). `title()` must resolve
  `{name, renderer: '2d'|'3d', continueSave: saveJson|null}` and must resolve immediately (name `Tester`) when `params.test || params.skipintro`.
  `mount(game, renderer)` once; `update(game)` every rendered frame (throttle hudState polling yourself, ~10 Hz);
  `setRenderer(r)` after a hot swap (re-point `worldOverlay` at the new `project`). The overlay canvas `#overlay` is sized by the UI.
  Renderer canvases are inserted as the first child of `#view`; CSS keeps `#overlay` (z 2) and `#hud` (z 3) above.
- **Renderers:** `create()` returns the object; `init` must insert its canvas into `hostEl` (first child) and may throw to trigger the
  2D fallback (use `console.warn`, not `console.error`: the e2e tests fail on console errors). `resize` is called after init and on
  every `#view` resize. `render` may be called before any game step. Develop against the gallery.
- **Sim:** `ents.flush()` (stub) applies deferred removals; keep an equivalent. The stub `ents.update` also handles `ttl`, `animT`, and
  `asleep`. `world.resolve(markerOrXY)` (added) is used by debug.teleport.
- **Everyone:** e2e helpers: `startServer, launch({webgl}), newPage(browser), collectErrors, openGame(page, {base, renderer, params}),
  openGallery(page, {base, renderer, page}), shot, webglInfo`. Viewport is 1366x657.
