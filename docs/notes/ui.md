# UI package notes

Owner files: `src/ui/**`, `css/**` (incl. `css/fonts/`), `src/platform/audio.js`, `tests/node/ui*.test.mjs`, `tests/e2e/ui*.cjs`.

## Modules

| file | what |
| --- | --- |
| `index.js` | `createUI(rootEl, {params, storage, config})` -> `{title(), mount(game, renderer), update(game), setRenderer(r), onFx(fx), toggleMap(), dispose()}` |
| `title.js` | title screen (name, 2D Pixel / 3D Toy Box, New Game / Continue, controls card) |
| `panel.js` | left panel (280 px) |
| `minimap.js` | minimap (168 px, top-right) + big map (M) |
| `worldOverlay.js` | `#overlay` canvas: floating numbers, bubbles, nameplates, enemy HP bars, "E Talk" prompt |
| `feedback.js` | banners, boss bar, tutorial, prompt fallback, letterbox, zone fade + title card, low-HP vignette |
| `toast.js` | toasts (top-left of the view; identical toasts merge into "x2") |
| `modalHost.js` + `dialogueBox.js shopUI.js inventoryUI.js pickers.js questionModal.js pauseMenu.js` | modals |
| `portraits.js` / `laportePortrait.js` / `backdrops.js` / `pixelart.js` | 32x32 procedural portraits (pure, Node-safe builders) |
| `icons.js` | closed icon set, 16x16 procedural pixel icons (pure builder + cached canvases) |
| `format.js`, `dom.js`, `modalKit.js` | helpers |

Fonts: Press Start 2P (headings, numbers) and Pixelify Sans 400/600 (body), latin woff2 only, SIL OFL licenses in
`css/fonts/`. Fallback `ui-monospace, monospace`. No runtime network requests.

## What the UI consumes (check other packages against this)

### HudState (polled every 100 ms with `game.hudState()`)

- `zoneName`, `hour` (number, shown as a clock under the minimap), `daypart`
- `player.{name, level, xp, xpNext, hp, hpMax, gold, className, specName, look, cloaked, power, defense, speed, wanted}`
- `player.resource` `{name|id, value, max, color}` or null
- `basic.{name, rank (1-5 pips + roman numeral), icon}`
- `abilities[0..3].{slot, key, id, name, icon, desc, unlocked, unlockLevel, cdFrac, ready, active, cost}`
  (`id` or `name` empty = slot unknown: just a lock; `unlocked: false` with a name = dimmed icon + "Lv N")
- `items[0..5]` `null | {id, name, icon, count, cdFrac}`
- `quest` `null | {id, name, step, progress}`: `step` may be a string (shown as is) or a step index (text from
  `data.quests[id].steps[step].text`); `progress` may be `'4/6'`, a number 0..1, or `{n, of}`.
- `companions[].{id, name, hpFrac, down, look}`
- `boss` `null | {name, hpFrac, shield}`
- `prompt` `null | {text, key, entId}` — anchored above the entity `entId` in the current FrameState; when that
  entity is not in the frame the prompt is shown in `#prompt` instead.
- `tutorial` `null | {text, keys}` (keys may be `'W'`, `'Space'`, `'ArrowUp'`, or arrow glyphs)
- `pendingBoons` (number), `pendingSpec` (bool)
- `kitHud` `null | {pips, pipsMax, stance, label}`: pips drawn inside the resource bar (as the bar itself when
  `player.resource` is null, labelled `label`); `stance` appended to the ATTACK title.
- `minimap.{px, py, blips[0..blipCount-1].{x, y, type}}` (all 8 blip types; off-map `quest` blips become edge markers;
  the player arrow direction is derived from movement between polls).

### FrameState (each rendered frame)

`mount` wraps `game.frame` (`game.frame = (a) => { f = orig(a); ...; return f; }`), so the UI sees the same
FrameState the renderer got. Read: `alpha`, `entCount`, `ents[i].{id, type, team, name, x, y, px, py, z, look.rig,
look.size, scale, hpFrac}`, `fxCount`, `fx[i]` of `type: 'text'`: `{x, y, z, text, style, ent, dur, color}`.
Styles `dmg crit heal xp gold miss info` float up; `bubble` is a speech bubble attached to entity `ent` (id) for
`dur` seconds (default 2.2 s + 0.045 s per character). Numbers get prefixes: heal `+8`, xp `+25 XP`, gold `+7g`, crit `37!`.
Alternative feed (if the integrator prefers not to wrap `frame`): `ui.onFx(fxEvent)`; a bus event `'fx:text'`
(payload = FxEvent) is also accepted if a system ever emits one (do not use both or numbers double).
Nameplates: NPCs (and hurt companions) within 4.5 tiles of the player; enemies with `0 < hpFrac < 1` get name + HP bar.

### Modal payloads (exactly section 9) and the commands each modal calls

| modal | fields read | commands |
| --- | --- | --- |
| `dialogue` | `speaker, speakerLook, portrait ('laporte' or null), mood, text, options[].{text, disabled, hint}` | `dialogueAdvance()`, `dialogueChoose(i)` |
| `shop` | `id, name, keeper, stock[].{id, name, desc, icon, price, canBuy}, gold, haggled` | `shopBuy(itemId)`, `shopHaggle()`, `closeModal()` |
| `lookPicker` | `name, looks[0..1]` | `pickLook(i)` |
| `classPicker` | `classes[].{id, name, blurb, look, basic, abilities}` | `pickClass(id)` |
| `specPicker` | `options[].{id, name, blurb, look, basic, abilities}` | `pickSpec(id)` |
| `boonPicker` | `options[].{id, name, desc, icon}` | `pickBoon(id)` |
| `question` | `req.{context, optional}`, `mount(el)` (called once with the UI's element) | none (provider + gates resolve) |
| `pause` | — | `closeModal()`, `setRenderer(id)`, `setQuality(q)`, `saveNow()`, `quitToTitle()` |
| `inventory` | `items, cosmetics, equipped` | `assignSlot(itemId, i)`, `equipCosmetic(id)`, `closeModal()` |
| `lesson` | `teacher, title, total, done, correct` | `closeModal()` |

Accepted shapes: picker `basic` = `{name, icon, desc}` or a string (or `{ranks: [{name}]}`); picker `abilities` =
`[{slot, name, icon, desc, unlock|unlockLevel}]` or an object keyed by slot. Inventory `items` = `{id: n}` or
`[{id, count|n, name?, icon?, desc?, type?}]`; `cosmetics` = `[id]` or `[{id, name?, icon?, slot?, equipped?}]`;
`equipped` = `{hat, cape, outfitColor}` ids. Missing names/icons come from `game.data.items[id]`; `keeper` / `teacher`
are looked up in `game.data.npcs[id].{name, look}` (for the portrait).
A modal replaced by a new object of the same type (next dialogue line, shop after a purchase) is refreshed in place
(selection kept). In-place mutation of `game.modal` fields is also picked up within 100 ms.

### Bus events consumed

`toast`, `modal:open`, `modal:close`, `levelup {level, gained}`, `ability:unlocked {slot, id}` (name/icon/desc read from
`hudState().abilities` by slot), `rank:up {rank}` (old name = last polled `basic.name`, new name read 60 ms later; an
optional `from` field wins), `quest:started|quest:step|quest:done {id, step}` (names from `data.quests[id]`),
`letterbox {on}`, `zone:transition {phase}`, `zone:load {zone}` (title card shows `zone.name` and
`zone.def.levelRange`), `tile:changed {tx, ty}` (minimap), optional `fx:text`.
Audio (`audio.js`, attached by main.js) listens to `sfx {id}`, `hit` (`hurt` when `target.type === 'player'`),
`levelup`, `item:gained`, `gold`, `modal:open`, `death`.

### Bus events emitted

Only `'sfx' {id}` with ids `ui_move`, `ui_ok`, `ui_bad`, `coin` (menu sounds).

### Other reads

`game.world.zoneView()` (minimap layer: `w, h, tiles, variant, tileDefs, props[].{kind, def.solid, def.footprint,
def.model, look.roof|wall, x, y, w, h}, palette.patterns`), `game.zone.{id, name, def.levelRange}`, `game.name`,
`game.flags.spec_ceremony_done` (spec nudge text), `game.data.{quests, npcs, items}`.
Fallbacks only (when the owning system did not open the modal): `game.inventory.{items, cosmetics, equipped}`.

## Keyboard ownership

- The UI listens on `window` keydown in the **capture** phase. While a modal other than `question` is open it calls
  `stopPropagation()` on every keydown, so `input.js` (window, bubble phase) never sees keys that drive a modal —
  including the key that closes it. Keyups are never stopped.
- `question` modal: keys are left alone (the provider owns them).
- No modal: `Escape` / `P` open the pause menu (`commands.openPause()`, then `game.openModal({type: 'pause'})` if
  that did not open anything) and are swallowed, so `InputState.pressed.pause` never fires from the keyboard.
  `B` opens the inventory (`commands.openInventory()`, fallback payload from `game.inventory`), swallowed.
  `M` toggles the big map (not swallowed; `pressed.map` still reaches the game). Tab is untouched (`pressed.boon`).
- Modal keys: arrows / WASD move, `Enter` / `Space` / `E` confirm, digits pick (dialogue 1-4, pickers 1-3,
  inventory 1-6 = assign to hotbar), `Esc` closes shop / inventory / pause, `H` haggles, Left/Right switch inventory
  tabs and cycle pause options.

## Additions to the contract

- `createUI(rootEl, opts)` returns also `onFx(fx)` and `toggleMap()`.
- `audio.js`: `createAudio()` -> `{attach, play, music, setVolume, setMuted(b), toggleMute() -> muted, isMuted(), dispose}`;
  `getAudio()` returns the last instance (pause menu Sound toggle). Extra recipe id `talk` (typewriter blip, played
  directly, never put on the bus). Unlocks on the first keydown / pointerdown.
- localStorage keys besides saves: `flinkerton.audio.muted` ('1'/'0'), `flinkerton.ui.renderer` (last title choice).
- Pure builders usable anywhere (Node too): `buildPortrait(look, {mood, t, bg})`, `buildLaporteFace({expr|mood, t,
  hairFrac, bg})`, `buildIcon(name)`; backdrops `academy` (default), `sky`, `forest`, `town`, `parchment`, `cafeteria`.
- `perf=1`: main.js's `#perf` shows renderer stats; the UI adds `.ui-perf` (fps, ms/frame, UI poll ms).

## Requests to other packages

- **Sim / input**: a key that answers the `question` modal (e.g. `Digit1` with the stub provider) is recorded by
  `input.js` after the modal has already closed (the provider resolves in a capture listener, gates close the modal
  in a microtask), so it can also use hotbar item 1. Suggest `createInput` ignore the press edge of any key whose
  keydown happened while `isBlocked()` was true at dispatch time (check `isBlocked()` once at the start of `onDown`
  and record a "swallowed" flag until its keyup).
- **Meta**: `commands.openInventory()` should open the inventory modal; `commands.openPause()` may stay a no-op.
  While `pendingSpec` and `flags.spec_ceremony_done`, Tab (`pressed.boon`) should open the spec picker (the panel
  nudge says "Tab"); otherwise the nudge says "See Mr. Laporte!".
- **Story**: for `who: 'player'` lines pass `speakerLook: player.look`. For `rank:up` please include `{from, to}` basic
  attack names if handy.
- **Sim**: `HudState.prompt.entId` must be the id of an entity that is in the FrameState for the prompt to float
  above it. Speech bubbles: `game.fx({type: 'text', style: 'bubble', ent: id, text, dur})`.
- **Integrator**: nothing in frozen files is required. If wrapping `game.frame` is unwanted, call `ui.onFx(fx)` for
  each `text` FxEvent and drop the wrapper in `index.js mount` (the overlay also needs the FrameState: then pass it
  via a future `ui.update(game, frame)`).

## Tests and tools

- `node --test tests/node` — `ui-laporte.test.mjs` (golden: the original studyHallSim `buildFace` copied verbatim
  into the test with stubbed globals; the port matches every figure pixel for calm + full hair, and the whole grid
  with the original cafeteria backdrop for calm / happy / shocked and thinning hair), `ui.test.mjs` (helpers,
  every look value / mood / creature rig, icon set, minimap layer, overlay helpers, audio recipes).
- `node tests/e2e/ui.cjs` — title by keyboard, every modal walked by keyboard with the exact commands asserted, modal
  key isolation, pause from gameplay, big map, panel fit at 1366x657 and 1024x600, no console errors / UI warnings.
- `node tests/e2e/ui-harness.cjs [--small]` — screenshots of every screen and modal into `tests/e2e/out/ui-*.png`
  (fake HudState via a wrapped `hudState`, payloads in `tests/e2e/ui-fixtures.cjs`).

## Known gaps

- Music: none (no music files by design); `music()` is a no-op.
- The boon nudge is not clickable into a picker (there is no command to request boon offers; Tab is handled by Meta).
- The big map is a HUD overlay, not a modal: the game keeps running while it is open.
