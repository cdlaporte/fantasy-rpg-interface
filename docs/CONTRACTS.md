# Flinkerton Academy — contracts

This is the single source of truth for how the pieces fit. Many people build this
game in parallel, each owning different files. If your code and this document
disagree, this document wins. You may ADD fields, events, ops, or helpers; you may
not rename or change the meaning of anything here. Record every addition or any
problem with the contract in `docs/notes/<your-package>.md` (you own that file).

Product in one paragraph: a bright, light-hearted fantasy action-RPG for students
on school Chromebooks (slow CPU, integrated GPU, ~1366x657 visible, keyboard only,
Chrome). Later, math questions are plugged in through `src/questions/`. The same
game runs in two looks: `2d` (Canvas 2D, procedural pixel art) and `3d` (Three.js,
toy-box cel shading). All art is generated in code. No build step, no bundler, no
runtime npm: plain ES modules served over http (GitHub Pages / `node tools/serve.mjs`).

## 0. Ground rules

- ES modules, `.js`, 2-space indent, semicolons, single quotes, no TypeScript, no
  dependencies. JSDoc where it helps.
- `src/core/**`, `src/data/**`, `src/questions/index.js` MUST run under Node 22
  with no DOM, no `window`, no `three`, no `performance`/`Date`/`Math.random`
  (use `game.rng`, `game.t`). `src/data/**` is pure data plus tiny pure helpers.
- Only `src/render/r3d/**` imports `three` (bare specifier, via the import map).
- Hot loops (per-frame, per-entity) must not allocate: reuse objects and arrays.
- All player-visible text that contains the player's name is inserted with
  `textContent`, never `innerHTML`.
- Tone: bright, friendly, funny. No gore, no grim areas. Defeated enemies "poof".
- Do not edit files you do not own. Frozen files (`index.html`, `src/main.js`,
  `src/contracts.js`, `src/config.js`, `src/core/game.js`, `src/core/systems.js`,
  `src/data/index.js`, `src/render/index.js`) are changed only by the integrator;
  if you need a change there, write it in your notes file and work around it.
- Do not `git commit`, `git add`, switch branches or stash. The lead commits.
- Several agents share this working tree at the same time. A failure in a file
  you do not own may just be someone mid-edit: retry later, never "fix" it.

## 1. Conventions

- **Units**: tiles. `x` grows right (east), `y` grows down (south). Tile `(tx,ty)`
  covers `[tx,tx+1) x [ty,ty+1)`. An entity's `(x,y)` is the center of its feet.
  `z` is height above ground in tiles (jumps, flyers, falling meteors), visual only.
- **Time**: seconds. Sim runs at a fixed `DT = 1/60`. `game.t` is sim seconds.
- **Directions**: `DIR = {UP:0, RIGHT:1, DOWN:2, LEFT:3}`; `DIR_VEC = [[0,-1],[1,0],[0,1],[-1,0]]`.
  `angle` is radians, 0 = east, growing clockwise on screen (`atan2(dy,dx)`).
- **Colors**: `'#rrggbb'` strings everywhere in data.
- **Ids**: lower_snake_case strings. Entity ids are integers assigned by the store.
- **View**: at zoom 1 a tile is 48 CSS px (16 art pixels x 3). The left panel is
  280 px wide; the play view fills the rest; the minimap floats top-right in it.

## 2. Boot and the game object

`src/main.js` (frozen): shows the title UI, then
`createGame({data, name, seed, storage, questions, save})`, creates the renderer
through `src/render/index.js`, mounts the UI, and runs the loop
(`src/platform/loop.js`): fixed-step `game.step(DT, input.sample())` up to 4 steps
per frame, then `renderer.render(game.frame(alpha))`, then `ui.update(game)`.

URL parameters: `renderer=2d|3d`, `questions=off|auto|stub`, `debug=1` (expose
`window.__game`), `test=1` (no automatic loop; time advances only through
`__game.step(n)`; fixed seed), `seed=N`, `perf=1` (show frame stats), `skipintro=1`.

```js
game = {
  data,                 // everything exported by src/data/index.js
  bus,                  // on(evt, fn) -> off fn ; emit(evt, payload)
  rng,                  // next() [0,1) ; range(a,b) ; int(a,b) inclusive ; pick(arr) ; chance(p)
  t, tick,              // sim seconds, step count
  input,                // InputState for the current step (section 3)
  freeze,               // Set<string>. Non-empty => world systems are skipped this step.
                        // Reasons: 'modal', 'question', 'pause', 'transition'.
  inputLock,            // number > 0 => the player ignores input (cutscenes). Use lockInput()/unlockInput().
  modal,                // null | {type, ...}  the one open modal (section 9)
  flags,                // story flags {key: value}; setFlag(k, v) emits 'flag'
  player,               // the player entity (always exists while playing)
  zone,                 // current zone runtime (section 5)
  camera,               // {x, y, zoom, shake, target, mode}  target: entity id | null
  commands,             // UI -> core calls (section 9)
  sys,                  // {world, ents, player, combat, abilities, kits, ai, companions, physics,
                        //  ops, dialogue, cutscene, quests, npc, clock,
                        //  progression, inventory, gates, save, debug}
  // each system is also aliased directly: game.world, game.ents, game.combat, ...
  step(dt, input), frame(alpha) -> FrameState, hudState() -> HudState,
  fx(evt),              // queue a one-shot FxEvent for the next rendered frame (section 7)
  toast(text, style),   // emits 'toast' {text, style: 'info'|'good'|'bad'|'loot'|'quest'}
  setFlag(k, v), lockInput(), unlockInput(),
  openModal(modal), closeModal(result),   // sets game.modal, adds/removes freeze 'modal', emits 'modal:open'/'modal:close'
}
```

### Systems

`src/core/systems.js` (frozen) lists every system module in update order. A system
module default-exports:

```js
export default {
  id: 'combat',
  init(game) { return api; },          // returned object becomes game.sys.combat and game.combat
  update(game, dt) {},                 // optional; skipped while game.freeze is non-empty unless `always: true`
  always: false,
  onZoneLoad(game, zone) {}, onZoneUnload(game, zone) {},     // optional
  save(game) { return json; }, load(game, json) {},            // optional; json stored under the system id
  hud(game, hud) {},                   // optional; fill your part of the HudState object (no allocation)
};
```

Update order: `clock, world, npc, ai, companions, player, kits, abilities, physics,
combat, ents, quests, cutscene, dialogue, progression, inventory, gates, save, debug`.
`cutscene`, `dialogue`, `gates`, `save`, `debug` are `always: true`.

Owners (see section 13): Sim owns `world, ents, player, physics, combat,
abilities, kits (registry), ai, companions`. Story owns `ops, dialogue, cutscene,
quests, npc, clock`. Meta owns `progression, inventory, gates, save, debug`.

## 3. Input

`src/platform/input.js` (Sim) turns DOM keys into an `InputState`, sampled once
per sim step. Uses `event.code`. `preventDefault` on arrows, Space, Tab.
While `game.modal` is set the UI owns the keyboard and `sample()` returns a
neutral state.

```js
InputState = {
  moveX, moveY,          // -1..1, already normalized (WASD)
  attackDir,             // -1 or DIR 0..3: attack key currently held (arrows, or IJKL)
  attackPressed,         // -1 or DIR pressed this step
  attackReleased,        // -1 or DIR released this step
  attackHeldT,           // seconds the current attack key has been held
  pressed,               // {interact, space, q, f, shift, item1..item6, pause, map, boon} true on the step pressed
  held,                  // same keys, true while down
  released,              // same keys, true on the step released
}
```

Keys: WASD move; Arrow keys or IJKL attack; E interact; Space/Q/F/Shift abilities;
Digit1-6 items; Escape or P pause; M toggle big map; Tab opens the boon picker (`boon`). Holding an attack key
auto-repeats the basic attack. `createInput(target)` and a `scriptedInput()`
helper for tests/bots (same shape, set fields by hand) both live in input.js.

## 4. Entities

One flat store (`game.ents`). Every entity is a plain object:

```js
ent = {
  id, kind,                 // kind: data id ('rat', 'pim') or a builtin ('player', 'projectile', 'effect', 'pickup')
  type,                     // 'player'|'enemy'|'npc'|'companion'|'summon'|'projectile'|'effect'|'pickup'
  team,                     // 'player'|'enemy'|'town'|'neutral'
  def,                      // the data definition it was spawned from (or null)
  name,                     // display name or ''
  x, y, px, py, z,          // px,py = position at the previous step (for interpolation)
  vx, vy,                   // intended velocity, tiles/s (physics moves and collides)
  kx, ky,                   // knockback velocity, decays
  radius,                   // collision circle radius in tiles
  solid,                    // collides with tiles
  pushable,                 // separated from other pushable entities
  dir, angle,               // facing: DIR and radians
  look, lookRev,            // section 6; bump lookRev whenever look is mutated
  anim, animT, scale, alpha, flash, tint, glow,   // presentation (section 7 EntityView)
  fxTags,                   // string[] of persistent visual statuses (section 7)
  hp, hpMax, alive,
  stats,                    // {power, defense, speed, ...} final numbers after modifiers
  status,                   // {stun, slow, burn, frost, invuln, stealth, root, mark, ...}: seconds remaining (0 = off)
  statusPower,              // parallel map of magnitudes where needed
  tags,                     // string[] e.g. ['beast','boss','ambush','guard']
  ai,                       // brain state (ai system)
  interact,                 // null | {prompt: 'Talk', range: 1.3, do: [ops]}
  owner,                    // entity id of the spawner (projectiles, summons, effects)
  ttl,                      // seconds until auto-removal, or Infinity
  level,                    // enemies/companions
  asleep,                   // true when outside the activation bubble: not updated, not rendered
  data,                     // free per-system scratch {}
}
```

`ANIM = idle | walk | attack | cast | hurt | ko | sleep | sit | charge | block | spin | dash`.
`animT` is seconds since the anim started.

### ents API (Sim)

```js
ents.all                               // array (stable order by id); do not mutate
ents.spawn(kindId, x, y, opts) -> ent  // kindId is an enemy/npc/prop-entity id in data, opts overrides fields
ents.create(fields) -> ent             // raw entity with defaults filled
ents.remove(ent)                       // deferred to end of step; emits 'ent:removed'
ents.get(id) -> ent|undefined
ents.forType(type, fn), ents.withTag(tag) -> ent[]
ents.inRadius(x, y, r, filterFn, out=[]) -> out     // spatial hash, awake entities only
ents.nearest(x, y, maxR, filterFn) -> ent|null
```

Activation bubble: entities farther than 30 tiles from the player are `asleep`.
Caps: 24 awake enemies, 12 awake NPCs, 64 projectiles.

### player (Sim, `core/player.js`)

Creates the player entity, applies movement from input, triggers the basic
attack and abilities by calling the active kit (section 8), item use
(`inventory.useSlot(i)`), and interaction: the nearest entity with `interact`
within its range becomes `player.data.target`; pressing E runs
`ops.run(target.interact.do, {self: target})` and emits `'interact'`.
`player.data` also holds `{name, classId, specId}` mirrored from progression.

### combat (Sim)

```js
combat.hostile(a, b) -> bool           // teams; 'town' is hostile to the player only while wanted
combat.damage(target, amount, opts) -> dealt
   // opts {source, type:'melee'|'ranged'|'magic'|'true', dir|angle, knockback, crit, element, silent, tags}
   // applies defense, invuln, guard hooks, floors (target.data.minHp), flash, knockback, damage text fx,
   // emits 'hit' {target, source, amount, crit, killed, type, element} and 'death' {ent, killer}
combat.heal(target, n, opts), combat.kill(target, source)
combat.status(target, id, seconds, power)          // stun slow burn frost root invuln stealth mark haste shield
combat.meleeArc(source, {angle, arc /*deg*/, range, dmg, knockback, type, element, fx, maxTargets, onHit}) -> hits[]
combat.projectile(source, {angle, speed, range, dmg, radius, pierce, bounce, homing, returns, split,
                           gravityZ, look, element, onHit, onExpire, hitsTeam}) -> ent
combat.aoe(source, {x, y, r, dmg, knockback, type, element, fx, delay, telegraph, onHit}) -> hits[] | effect ent
combat.zone(source, {x, y, r, dur, tick, dmg, status, look}) -> effect ent      // burning ground, caltrops, heal circle
```

Death: enemies emit `'death'`, drop loot/xp per their def, play fx `poof`, are
removed. The player never dies: at 0 HP emit `'player:down'` (Meta/Story decide:
revive gate, then infirmary). `ent.data.minHp` is an HP floor (ambush scene).

### physics, ai, companions (Sim)

Circle-vs-tile collision with wall sliding, entity separation, knockback decay,
optional circle constraint (`ent.data.leash = {x, y, r}`, used by the barrier).
AI brains (`def.ai.brain`): `wander, chaser, skirmisher, charger, turret, swarmer,
summoner, ambusher, flee, guard, boss`. Enemies telegraph every attack (windup
>= 0.3 s, visible as an `effect` telegraph entity or `anim: 'charge'`).
Companions follow the player, fight with their class kit's basic attack and one
ability, never die (they sit out for 10 s at 0 HP), and teleport to the player if
left behind. `companions.set([classId, ...])`, `companions.active`.

## 5. World and zones

One zone is loaded at a time. Zone definitions live in `src/data/zones/*.js`:

```js
{ id: 'forest', name: 'Whisperwood', palette: 'forest', music: 'forest', levelRange: [3, 9], seed: 1207,
  // EITHER hand-authored tiles (intro, town, academy):
  tiles: { rows: ['####....', ...], legend: {'#': 'hedge', '.': 'grass', ...} },
  // OR a coarse macro grid expanded by zones/mapgen.js (biomes): one char = `cell` x `cell` tiles
  macro: { cell: 4, rows: [...], legend: {'#': 'trees', '.': 'grass', 'p': 'path', '~': 'water'} },
  markers: { entry_town: [2, 48], hollow: [40, 22] },            // tile coords (center of that tile is used)
  exits:   [{ at: 'entry_town', w: 1, h: 3, to: 'town', marker: 'gate_west', if: [conds], locked: 'Sealed until level 10' }],
  props:   [{ kind: 'house', x: 10, y: 8, look: {...overrides}, id: 'potion_shop', interact: {...} }],
  spawns:  [{ kind: 'slime', area: [30, 15, 20, 14], n: 6, respawn: 60, level: 3 }],
  npcs:    ['ranger_tam'],                                        // NPCs whose home zone is this one
  gates:   [{ id: 'grove_seal', at: 'grove_gate', req: [conds], question: {context: 'gate', difficulty: 2} }],
  chests:  [{ id: 'c1', at: 'chest_1', loot: 'forest_small', rune: true }],
  triggers:[{ id: 't1', area: [78, 8, 6, 6], once: true, if: [conds], do: [ops] }],
}
```

The zone runtime (`game.zone`, built by `world.loadZone`):
`{id, def, name, w, h, tiles: Uint8Array, variant: Uint8Array, solid: Uint8Array,
  markers, props: [{id, kind, def, look, x, y, w, h}], palette}`.
`tiles[ty*w+tx]` indexes `game.data.tiles.list`. `variant` is 0..255 noise for
deterministic decoration. `solid` merges tile solidity and prop footprints.

```js
world.loadZone(zoneId, markerOrXY)     // async-free; emits 'zone:unload', then 'zone:load' {zone, from}
world.travel(zoneId, marker)           // fade: freeze 'transition', emit 'zone:transition', load, unfreeze
world.solidAt(x, y), world.tileDefAt(x, y), world.setTile(tx, ty, tileId)   // emits 'tile:changed' {tx, ty}
world.marker(name) -> {x, y}           // center of the marker tile
world.los(x0, y0, x1, y1) -> bool, world.findPath(x0, y0, x1, y1, out) -> bool   // A*, <= 400 nodes
world.zoneView() -> ZoneView           // for renderers and the minimap
```

### Tiles (`src/data/tiles.js`, closed vocabulary)

`{id, solid, shape, h, pattern, colors: {a, b, side}}` with
`shape`: `flat | block | water | pit`, and `pattern` one of:
`grass, flowers, tallgrass, dirt, path, cobble, sand, wet_sand, shallows, water,
planks, stone, carpet, brick, hedge, trees, cliff, crystal, cloud, starfloor`.
Renderers draw by `pattern` + `colors` + `variant`; `block` tiles have height `h`.
The `palette` of a zone may recolor patterns (e.g. forest grass vs town grass).

### Props (`src/data/props.js`, closed vocabulary of models)

A prop def: `{id, model, footprint: [w, h] | null, solid, look: {colors..., variant}}`.
Props are static (built once per zone by renderers). `(x,y)` is the top-left tile
of the footprint; footless decor uses its tile center. Models:
`tree, pine, bush, rock, stump, log, flowerbed, mushroom_big, crystal, fence, hedge_arch,
lamp, sign, bench, well, fountain, statue, barrel, crate, stall, cart, campfire, tent,
house, shop, tower, academy, gate_arch, rune_gate, bridge, banner,
bookshelf, desk, table, chair, bed, cauldron, chalkboard, rug, chest`.
Building models (`house, shop, tower, academy`) take `look: {wall, roof, trim, door, sign}`;
`sign` is one of `potion, hat, bag, bread, cup, book, sword, none`. Doors are on
the south face; put the interact on the prop.
Interactive, changing things (chests that open, rune gates that vanish) are
ENTITIES of type `effect`/`npc`, not props.

## 6. Looks (renderer-neutral art descriptors)

Content never references art files. Every entity has a `look`; each renderer has
one builder per `rig`. Both renderers must support every value listed here; an
unknown value falls back to the nearest default and is reported in
`renderer.stats().unknown`.

```js
// humanoid: player, NPCs, classmates, goblins, hexguards, Malgrim, Laporte
{ rig: 'humanoid', build: 'a' | 'b',          // two body builds (a: broader, b: slighter); never labeled
  size: 1,                                    // height multiplier (child 0.8, big 1.3)
  skin: '#c68e62',
  hair: { style: 'short'|'long'|'bun'|'ponytail'|'curly'|'spiky'|'bald'|'braids'|'m_hairline', color },
  facial: 'none'|'goatee'|'beard'|'mustache',
  outfit: { style: 'tunic'|'robe'|'cloak'|'plate'|'leather'|'gi'|'quarterzip'|'dress'|'apron'|'uniform'|'vest',
            primary, secondary, accent },
  hood: false,                                // true hides hair and shadows the face (intro)
  hat: null | { style: 'wizard'|'cap'|'crown'|'bandana'|'helm'|'straw'|'chef'|'feather'|'horned'|'circlet', color },
  cape: null | { color },
  held: null | { style: 'stick'|'sword'|'sword_shield'|'axes'|'runeblade'|'staff'|'orb'|'wand'|'fists'|'daggers'|'bow'|'shuriken'|'spear'|'book'|'broom'|'lantern',
                 color, glow: null | '#hex' },
  aura: null | { style: 'glow'|'flame'|'sparkle'|'shadow'|'frost'|'storm', color },
  ears: 'round'|'pointed',
  hero: null | 'laporte' | 'malgrim' }        // hero override hook: renderer may use a bespoke builder

// creatures
{ rig: 'quadruped'|'blob'|'flyer'|'plant'|'golem', size, colors: {body, belly, accent, eye}, features: [...] ,
  hero: null | 'mossback' }
// features: quadruped: tail_thin tail_bushy tusks ears_round ears_pointy spikes mane
//           blob: crown drips core_glow spots   flyer: wings_bat wings_bird wings_fairy orb glow
//           plant: cap_mushroom thorns leaves flower bark_face vines   golem: mossy rocky wood crystal antlers

{ rig: 'projectile', model: 'bolt'|'arrow'|'orb'|'fireball'|'shuriken'|'knife'|'wave'|'crescent'|'rock'|'spore'|'spark'|'ice'|'kunai'|'axe'|'coin',
  color, glow, size, trail: true }

{ rig: 'effect', model: 'barrier'|'telegraph_circle'|'telegraph_line'|'telegraph_cone'|'ground_fire'|'ground_frost'|
        'zone_ring'|'rune_seal'|'shield_bubble'|'caltrops'|'smoke'|'portal'|'meteor'|'chest'|'chest_open'|'rune_chest'|
        'gold'|'heart'|'item'|'xp_orb'|'stick'|'totem'|'decoy_puff',
  color, r, w, h, len, arc }                  // sizes in tiles; meteor uses ent.z for its height
```

Sim entities draw the size from the look (`r`, `len`, ...) which the sim keeps in
sync with gameplay sizes. Summons, familiars and decoys are ordinary creature or
humanoid looks.

`src/data/looks.js` exports the two player bases `PLAYER_LOOKS = [lookA, lookB]`
(ambiguous ethnicity, medium-brown skin tones, no labels), `CLOAKED` (a patch:
`{outfit:{style:'cloak',...}, hood:true, cape:null, hat:null}`), class outfits,
and `LAPORTE_LOOK`. `src/data/palettes.js` exports `LAPORTE` (exact colors from
studyHallSim: hair `#6b4423`/`#8b5a2b`/`#4a2e17`, skin `#f6cfa6`/`#e2ae88`,
stubble `#a07a5e`/`#b88f70`, quarter-zip navy `#24395e`/`#1a2a47` and gray
`#8f9399`/`#6e7277`, collar `#a3a7ad`, undershirt `#ecf0f1`, pants `#3b3b58`,
shoes `#111111`) and zone palettes.

## 7. Renderer contract

`src/render/index.js` (frozen) exports `createRenderer(id, hostEl, opts)`; it
dynamically imports `./r2d/index.js` or `./r3d/index.js` (so 2D players never
download three), falls back to 2D if 3D fails, and supports hot swap.
Each renderer module exports `create()` returning:

```js
Renderer = {
  id,                                  // '2d' | '3d'
  async init(hostEl, {quality}),       // creates and appends its own <canvas>, sized to hostEl
  loadZone(zoneView), unloadZone(),    // build / free all static visuals (tiles + props)
  tileChanged(tx, ty),
  render(frame),                       // once per animation frame
  project(wx, wy, wz, out) -> out,     // world -> CSS px in hostEl: out = {x, y, on}
  viewRect(out) -> out,                // {x0, y0, x1, y1} world tiles possibly visible (3D: bounds of the ground trapezoid)
  resize(w, h), setQuality(q),         // q: 0 low | 1 medium | 2 high
  stats() -> {ms, draws, tris, unknown: string[]},
  dispose(),
}

ZoneView  = { id, w, h, tiles, variant, tileDefs /* data.tiles.list */, props, palette /* resolved palette object */ }

FrameState = {
  t, alpha,                            // sim seconds; interpolation factor between px,py and x,y
  camera: { x, y, zoom, shake },       // focus in tiles; shake 0..1
  ambience: { daypart: 'morning'|'day'|'evening', tint: '#hex', tintAmount: 0..0.25 },   // never dark
  ents: EntityView[], entCount,        // pre-culled by the core to viewRect + 3 tiles, array is reused
  fx: FxEvent[], fxCount,              // one-shots since the last render, array is reused
}

EntityView = { id, kind, type, look, lookRev, x, y, px, py, z, dir, angle, anim, animT, scale, alpha,
               flash /*0..1 white hit flash*/, tint /*null|'#hex'*/, glow /*null|'#hex'*/,
               fxTags /*string[]*/, hpFrac, moving /*bool*/ }
```

`fxTags` (persistent, drawn every frame while present, closed list):
`burn, frost, stun, shield, stealth, mark, frenzy, charge, haste, rune_fire,
rune_frost, rune_storm, ki, shadow, summoned, wanted, sleep, levelup_ready, venom`.

`FxEvent = { type, x, y, z, x2, y2, angle, arc, r, len, w, color, color2, n, dur, style, ent, text }`.
Closed list of `type` (both renderers implement all; unknown falls back to `burst`):

| type | meaning | key params |
| --- | --- | --- |
| `hit` | small impact spark | x, y, color |
| `slash` | melee swing | x, y, angle, arc (deg), r, color, style: `sword axe dagger claw fist stick crescent spin` |
| `burst` | particle pop | x, y, n, color, r |
| `ring` | expanding ring on the ground | x, y, r, color, dur |
| `shockwave` | big ring + ground crack + dust | x, y, r, color |
| `beam` | line that flashes and fades | x, y, x2, y2, w, color |
| `bolt` | lightning: from sky to (x,y), or from (x,y) to (x2,y2) if given | color |
| `trail` | short streak behind a fast move | x, y, x2, y2, color |
| `afterimage` | fading ghost copy of entity `ent` at (x,y) | ent, color |
| `pillar` | vertical light pillar | x, y, r, color, dur |
| `meteor` | impact explosion with debris | x, y, r, color |
| `sparkle` | drifting sparkles | x, y, n, color, r |
| `heal` | green plus signs rising | x, y |
| `levelup` | golden burst + pillar + ring | x, y |
| `poof` | soft cloud puff (defeat, vanish, reveal) | x, y, color |
| `smoke` | lingering smoke cloud | x, y, r, dur |
| `screenFlash` | full-view flash | color, dur |
| `text` | floating text; drawn by the shared overlay, renderers ignore it | x, y, text, style: `dmg crit heal xp gold miss info bubble`, ent |

Both looks share: the overlay canvas (`src/ui/worldOverlay.js`: damage numbers,
nameplates, enemy HP bars, speech bubbles, "E" prompts, positioned with
`renderer.project`), all DOM UI, and the minimap. Renderers draw only the world.

Budgets. 2D: tiles cached in 16x16-tile chunk canvases; entity sprites cached per
`kind + lookRev`; <= 300 drawImage calls and < 4 ms per frame on a dev machine;
`image-rendering: pixelated`, no `shadowBlur`, no `ctx.filter`. 3D: pixel ratio 1,
`antialias: false`, no shadow maps, no post-processing, chunked vertex-colored
terrain, merged static props per chunk, instancing for repeated creatures, toon
materials with one shared 3-step gradient texture, inverted-hull outlines on
characters and props (off at quality 0), blob shadows, <= 120 draw calls and
<= 120k triangles. Camera: fixed yaw so that north is up-screen, pitch ~55 degrees,
perspective FOV ~32 degrees, framing roughly the same tiles as 2D.

## 8. Classes, kits, abilities

Design lives in `docs/CLASSES.md`. Mechanics contract:

```js
// src/core/kits/<id>.js default-exports a kit; core/kits/index.js (Sim) is the registry + dispatcher.
kit = {
  id: 'warrior', parent: null | 'warrior',          // specs name their parent; the dispatcher layers parent then spec
  resource: { id: 'rage', name: 'Rage', max: 100, color: '#e2503c', start: 0 },
  onEquip(game, p), onUnequip(game, p),              // set look patches, stats mods, reset state in p.data.kit
  update(game, p, dt),                               // every step (resource regen/decay, passive effects)
  basic(game, p, ctx),                               // called by player system when a basic attack should fire or is held
                                                     // ctx = {dir, angle, pressed, held, released, heldT, rank}
  abilities: {                                       // slots: space, q, f, shift
    space: { id: 'shield_bash', name: 'Shield Bash', icon: 'dash', unlock: 3, cd: 5, cost: 0,
             cast(game, p, ctx) { /* return false to refuse (no cooldown started) */ },
             hold(game, p, ctx, dt) {}, release(game, p, ctx) {} },   // optional, for held abilities
  },
  hooks: { onHit(game, p, e), onHurt(game, p, e), onKill(game, p, e), onBlock(game, p, e) },   // from combat events
  hud(game, p, hud) {},                              // optional extra HUD bits (stance, combo pips, familiars)
}
```

- `abilities` (Sim, `core/abilities.js`): building blocks callable by kits, enemies
  and companions: `abilities.use(name, caster, params)` for
  `melee_arc, projectile, multishot, beam, dash, aoe_ring, ground_target, summon,
  buff_self, guard, heal, zone, stealth, chain, leap, blink`; plus cooldown and
  cost bookkeeping per entity: `abilities.ready(ent, slot)`, `abilities.start(ent, slot)`,
  `abilities.cdFrac(ent, slot)`.
- `kits.active(ent)` -> layered kit; `kits.set(ent, classId, specId)`;
  `kits.resource(ent)` -> `{value, max}`; `kits.gain(ent, n)`; `kits.spend(ent, n) -> bool`.
- Data in `src/data/classes.js`, `src/data/specs/*.js`, `src/data/boons.js` holds
  names, descriptions, numbers per attack rank, unlock levels, look patches, and
  boon definitions; kits read their numbers from data (`game.data.classes[id]`).
- Boons: `{id, class | spec, name, desc, icon, tags}`; a kit checks
  `progression.hasBoon(id)`.
- A `novice` kit (Sim) is the pre-class state: basic attack is the stick
  (`melee_arc`), no abilities, no resource. Before the stick is picked up the
  player cannot attack (`flag has_stick`).

## 9. UI contract

The UI is DOM/CSS over the renderer host, shared by both looks. It never reads
entity internals; it reads `game.hudState()` (polled ~10 Hz), `game.modal`, and bus
events, and it acts only through `game.commands`.

```js
HudState = {
  zoneName, hour, daypart,
  player: { name, level, xp, xpNext, hp, hpMax, gold, classId, className, specId, specName,
            look, cloaked, power, defense, speed, wanted,
            resource: null | {id, name, value, max, color} },
  basic: { name, rank, icon },
  abilities: [ {slot: 'space'|'q'|'f'|'shift', key: 'Space'|'Q'|'F'|'Shift', id, name, icon, desc,
                unlocked, unlockLevel, cdFrac /*0 ready..1*/, ready, active, cost} x4 ],
  items: [ null | {id, name, icon, count, cdFrac} x6 ],
  quest: null | { id, name, step, progress },
  companions: [ {id, name, classId, hpFrac, down, look} ],
  boss: null | { name, hpFrac, shield },
  prompt: null | { text, key, entId },             // "E  Talk"
  tutorial: null | { text, keys: ['W','A','S','D'] },
  pendingBoons, pendingSpec,                        // counts / bool: show a "press Tab" style nudge
  kitHud: null | { pips, pipsMax, stance, label },  // filled by kits
  minimap: { px, py, blips: [ {x, y, type: 'enemy'|'npc'|'quest'|'exit'|'companion'|'shop'|'boss'|'chest'} ], blipCount },
}
```

`icon` strings come from a closed set drawn by `src/ui/icons.js`:
`sword axe shield dash roar bolt blink nova fire frost storm meteor summon fist kick orb
bow rain dagger knives roll smoke shadow shuriken coin potion bread bomb tonic charm star heart
book hat cloak key rune lock up`.

`game.modal` types and the commands that resolve them:

| modal | payload | commands |
| --- | --- | --- |
| `dialogue` | `{speaker, speakerLook, portrait, mood, text, options: [{text, disabled, hint}] or null}` | `dialogueAdvance()`, `dialogueChoose(i)` |
| `shop` | `{id, name, keeper, stock: [{id, name, desc, icon, price, canBuy}], gold, haggled}` | `shopBuy(itemId)`, `shopHaggle()`, `closeModal()` |
| `lookPicker` | `{name, looks: [lookA, lookB]}` | `pickLook(i)` |
| `classPicker` | `{classes: [{id, name, blurb, look, basic, abilities}]}` | `pickClass(id)` |
| `specPicker` | `{options: [{id, name, blurb, look, basic, abilities}]}` | `pickSpec(id)` |
| `boonPicker` | `{options: [{id, name, desc, icon}]}` | `pickBoon(id)` |
| `question` | `{req, mount(el) -> Promise}` (the provider renders into the element the UI gives it) | resolved by the provider |
| `pause` | `{}` | `closeModal()`, `setRenderer(id)`, `setQuality(q)`, `saveNow()`, `quitToTitle()` |
| `inventory` | `{items, cosmetics, equipped}` | `assignSlot(itemId, i)`, `equipCosmetic(id)`, `closeModal()` |
| `lesson` | `{teacher, title, total, done, correct}` | driven by gates; `closeModal()` |

`portrait` is `'laporte'` (use `laportePortrait.js`) or `null` (draw from
`speakerLook` with `portraits.js`). `mood`: `calm happy shocked annoyed worried proud`.

Other commands: `useSlot(i)`, `openInventory()`, `openPause()`, `interact()`.
The title screen (name entry, max 12 characters, look choice 2D/3D, Continue /
New Game) is UI-only and runs before the game exists; `main.js` calls
`ui.title() -> Promise<{name, renderer, continueSave}>`.

`src/ui/index.js` exports `createUI(rootEl) -> { title(), mount(game, renderer), update(game), setRenderer(r), dispose() }`.
DOM layout (ids are frozen, set up in index.html): `#app` > `#panel` (left, 280 px),
`#view` (renderer host; children: renderer canvas, `#overlay` canvas, `#hud` layer
with `#minimap`, `#toasts`, `#bossbar`, `#prompt`, `#tutorial`), `#modal-root`.

## 10. Bus events

`'zone:unload'` `{zone}` · `'zone:load'` `{zone, from}` · `'zone:transition'` `{to, phase: 'out'|'in'}` ·
`'tile:changed'` `{tx, ty}` · `'ent:spawned'` `{ent}` · `'ent:removed'` `{ent}` ·
`'hit'` `{target, source, amount, crit, killed, type, element}` · `'death'` `{ent, killer}` ·
`'player:down'` `{}` · `'player:revived'` `{where}` · `'interact'` `{ent}` ·
`'xp'` `{amount, total}` · `'levelup'` `{level, gained}` · `'class:set'` `{classId}` · `'spec:set'` `{specId}` ·
`'boon'` `{id}` · `'ability:cast'` `{ent, slot, id}` · `'ability:unlocked'` `{slot, id}` · `'rank:up'` `{rank}` ·
`'item:gained'` `{id, n}` · `'item:used'` `{id}` · `'gold'` `{amount, total}` · `'look:changed'` `{ent}` ·
`'quest:started'` `{id}` · `'quest:step'` `{id, step}` · `'quest:done'` `{id}` ·
`'dialogue:line'` `{speaker, text}` · `'cutscene:start'` `{id}` · `'cutscene:end'` `{id}` · `'letterbox'` `{on}` ·
`'modal:open'` `{modal}` · `'modal:close'` `{type, result}` · `'toast'` `{text, style}` · `'flag'` `{key, value}` ·
`'gate:ask'` `{req}` · `'gate:result'` `{req, correct}` · `'crime'` `{victim}` · `'wanted'` `{on}` ·
`'save'` `{}` · `'sfx'` `{id}` (audio hints: `swing hit hurt poof pickup coin levelup spell blink dash door ui_move ui_ok ui_bad boss laporte`).

## 11. Story vocabulary (ops) and Story systems

`core/ops.js` (Story): `ops.run(actions, ctx) -> Promise|undefined`,
`ops.test(conds, ctx) -> bool`, `ops.register(name, fn)`, `ops.registerCond(name, fn)`.
Each system registers the ops it owns. A condition list is AND-ed.

Conditions: `['level','>=',5]` `['flag','k']` `['flag','k',value]` `['not', cond]`
`['class','mage']` `['spec','knight']` `['hasItem','id',n]` `['gold','>=',n]`
`['quest','id','none'|'active'|'done'|'step',n]` `['rel','npc','>=',n]` `['hour','between',8,18]`.

Actions: `['flag.set',k,v]` `['give',itemId,n]` `['take',itemId,n]` `['gold',n]` `['xp',n]` `['heal']`
`['quest.start',id]` `['quest.advance',id]` `['dialogue',id]` `['cutscene',id]` `['shop',id]`
`['teleport',zone,marker]` `['travel',zone,marker]` `['spawn',kind,marker,opts]` `['despawn',tagOrId]`
`['setLook',who,lookPatch]` `['rel',npc,delta]` `['toast',text,style]` `['fx',fxEvent]` `['sfx',id]`
`['gate',{context,difficulty,tags},{pass:[ops],fail:[ops]}]` `['chest',lootId]` `['lesson',lessonId]`
`['classPicker']` `['specPicker']` `['lookPicker']` `['companions',[classIds]]` `['save']`.

- **dialogue**: `data/dialogues/*.js`: `{start, nodes: {id: {say: [{who, mood, text}], options: [{text, if, do, goto, end}], do, goto}}}`.
  `{name}` in text is replaced with the player's name; `who: 'player'` is allowed.
  `dialogue.open(id, {npc})` drives `game.modal`.
- **cutscene**: `data/cutscenes/*.js`: `{id, skippable, steps: [...]}`. Steps are op
  actions plus blocking steps: `['wait',s]` `['waitFor',cond]` `['say',who,text,{mood}]` (opens a dialogue modal line)
  `['bubble',who,text,s]` (non-blocking speech bubble) `['move',who,markerOrXY,{speed,run}]` `['face',who,dir]`
  `['anim',who,anim,s]` `['camera',{to,t,zoom}]` `['cameraReset']` `['parallel',[steps]]` `['lockInput']` `['unlockInput']`
  `['letterbox',bool]` `['control',{until:cond, minHp:n}]` (hand control back until cond) `['escort',who,{to:marker}]`
  (who walks ahead and waits for the player) `['kill',{tag}]` `['tutorial',text,keys]` `['tutorial',null]`.
  `who` is `'player'`, an npc/entity id string, or `'@tag'`. `cutscene.play(id) -> Promise`, `cutscene.active`.
- **quests**: `data/quests/*.js`: `{id, name, giver, req, companions, steps: [{text, goal}], rewards: {xp, gold, items}, onDone: [ops]}`;
  goal types `reach {zone, marker, r}`, `kill {kind|tag, n}`, `collect {item, n}`, `talk {npc}`, `interact {id}`,
  `boss {kind}`, `flag {key}`. `quests.start(id)`, `quests.state(id)`, `quests.tracked`.
- **npc**: `data/npcs/*.js`: `{id, name, look, zone, team: 'town', routine: [{from, to, at: marker, do: 'idle'|'wander'|'sit'|'shopkeep'|'sleep'|'patrol', zone}],
  dialogue, shop, onAttacked: 'flee'|'retaliate'|'guard', stats}`. NPCs exist only in the loaded zone, placed at
  their scheduled marker on load and walking when the schedule changes. `npc.rel(id)`, `npc.addRel(id, n)`.
  Crime rule: hitting a `town` entity emits `'crime'`; the victim flees or retaliates; the player becomes
  wanted (guards hostile, `'wanted'`); a guard hit that would down the player sends them to the infirmary
  minus 10% gold and clears wanted; wanted also clears after 45 s out of sight. Town NPCs cannot die (they sit
  out, `anim: 'ko'`, and recover).
- **clock**: a full day lasts 12 real minutes; `clock.hour` (0-24 float), `clock.daypart`; `clock.set(h)`.
  Presentation never gets darker than a warm evening tint.

## 12. Meta systems

- **progression**: `level, xp, xpNext, classId, specId, boons[]`; `addXp(n)`, `setLevel(n)`, `setClass(id)`,
  `setSpec(id)`, `rank()` (attack rank 1-5 from level: 1, 4, 8, 12, 16), `hasBoon(id)`, `offerBoons()`, `chooseBoon(id)`,
  `recalc()` (derive `player.stats`, `hpMax`). Level cap 12 in the slice (data-driven). Level-up: full heal, fx
  `levelup`, knockback ring on nearby enemies, emits `'levelup'`; every even level from 4 queues a boon choice;
  level 8 queues the specialization (done at the Academy with Laporte, or anywhere via the panel nudge if
  `flag spec_ceremony_done`). XP curve: `xpNext(l) = round(20 * l^1.6)`.
- **inventory**: `items {id: n}`, `hotbar[6]`, `gold`, `cosmetics[]`, `equipped {hat, cape, outfitColor}`;
  `give, take, count, useSlot(i), assignSlot(id, i), addGold(n), equipCosmetic(id)`; shops:
  `openShop(id)`, `buy(itemId)`. Item defs in `data/items.js`:
  `{id, type: 'consumable'|'cosmetic'|'key'|'weapon', name, desc, icon, price, stack, use: {effect, ...}, cd, look}`
  with effects `heal, heal_over_time, bomb, haste, shield, cure, smoke, xp, summon_pet, resource`.
- **gates** (the only caller of the question provider): `gates.ask({context, difficulty, tags, optional}) -> Promise<{correct, skipped}>`.
  Adds freeze `'question'`, opens the `question` modal, awaits the provider, removes the freeze, emits
  `'gate:result'`. Contexts: `levelup, boon, spec, gate, chest, boss_shield, focus, lesson, quest_turnin, haggle, revive`.
  `config.questions.contexts[ctx] = {enabled, blocking}`; when disabled or provider mode `off`, resolves correct at once.
- **questions** (`src/questions/index.js`): `Questions.setProvider(p)`, `Questions.mode`, `Questions.ask(req, mountEl)`.
  Provider: `{id, ask(req, el) -> Promise<{correct, skipped}>}`. `stubProvider.js` renders a clearly labeled
  placeholder card ("Question goes here": context, difficulty, tags; buttons/keys `1` Correct, `2` Wrong);
  mode `auto` resolves `{correct: true}` with no UI. `custom.js` is the empty file the teacher fills in later.
- **save**: localStorage (through `platform/storage.js`, in-memory under Node) key `flinkerton.v1.<name>`;
  `{v: 1, name, zone, x, y, flags, systems: {id: json}}`; autosave on zone load, level-up, quest step, every 60 s;
  `save.now()`, `save.load(name)`, `save.exists(name)`, `save.clear(name)`.
- **debug** (`window.__game` when `debug=1` or `test=1`): `ready`, `game`, `state()`, `errors()`,
  `step(n, input)`, `input(partialInputState)` (sticky scripted input), `scenario(id)`, `teleport(zone, markerOrXY)`,
  `setLevel(n)`, `setClass(id)`, `setSpec(id)`, `giveItem(id, n)`, `giveGold(n)`, `setFlag(k, v)`, `god(bool)`,
  `spawn(kind, n, x, y)`, `killAll()`, `find(kindOrType)`, `startCutscene(id)`, `skipCutscene()`,
  `completeQuest(id)`, `setTime(h)`, `answerQuestion(correct)`, `closeModal()`, `command(name, ...args)`,
  `setRenderer(id)`, `renderStats()`, `snapshot() -> dataURL`, `save()`, `load()`, `reset()`.
  Scenarios: `intro_start, ambush, rescued, town, academy_pick, forest, forest_boss, gallery, stress, class_demo`.

## 12a. Cross-package rules (who does what at the seams)

Story ids, flags, markers and the scene sequence are fixed in `docs/STORY.md`.

- **Scripted movement** (Sim, used by Story): `physics.moveTo(ent, x, y, {speed, run, stopAt})`
  sets `ent.data.moveTo`; physics steers the entity there (using `world.findPath` when the straight line is
  blocked), sets `anim` walk/idle and `dir`, and on arrival clears it and emits `'ent:arrived'` `{ent}`.
  `physics.stop(ent)` cancels. `ent.data.scripted = true` makes AI and player control skip the entity
  (cutscenes set and clear it). NPC routines use the same mover.
- **Zone furniture** (Sim, in `world`): on zone load, `spawns` are populated and respawned (never within
  10 tiles of the player), `npcs` are handed to `npc.populate(zone)` (Story), `exits` trigger `world.travel`
  when the player steps in (if `if` passes; otherwise toast the `locked` text, at most once per 3 s),
  `triggers` run `ops.run(do)` when the player enters the area and `if` passes (`once` uses flag
  `trig_<zone>_<id>`), `gates` whose flag `gate_<id>` is unset become solid `rune_seal` effect entities
  (their tiles are solid while they exist) with `interact: {prompt: 'Unseal', do: [['gate', question, {pass: [['gate.open', id]]}]]}`,
  and `chests` become `chest` / `rune_chest` effect entities with `interact: {prompt: 'Open', do: [['chest', loot, {id, rune}]]}`
  (already opened when flag `chest_<zone>_<id>` is set: look `chest_open`, no interact).
  Sim registers the op `gate.open` (remove the seal, clear solidity, set the flag, fx). If a gate has `req`
  and it fails, the interact toasts the requirement instead.
- **Chest op** (Meta): `['chest', lootId, {id, rune}]` asks the gate question for rune chests
  (`context: 'chest'`, non-blocking: wrong = basic table), rolls loot, gives it with pickup fx/toasts, sets
  the flag, and swaps the chest's look to `chest_open` (bump `lookRev`, clear `interact`).
- **Drops** (Sim spawns, Meta collects): on enemy death Sim rolls `def.drops`, spawns `pickup` entities
  (`gold`, `heart`, `item`, `xp_orb` looks) that fly to the player when within 2.5 tiles; on touch Sim calls
  `inventory.addGold(n)` / `inventory.give(id, n)` / `combat.heal` / `progression.addXp(n)`.
  XP for a defeat is granted directly (`progression.addXp(def.stats.xp)`), with a `text` fx style `xp`.
- **Player down** (Meta): on `'player:down'` Meta optionally asks the `revive` gate, otherwise travels to
  the respawn point from `docs/STORY.md`, heals to full, clears wanted, emits `'player:revived'`.
  While `player.data.minHp` is set, hp cannot fall below it and `'player:down'` is not emitted.
- **Boss shields** (Sim boss brain): at each `boss.shieldAt` threshold the boss becomes invulnerable
  (fxTag `shield`, `HudState.boss.shield`), keeps attacking lightly, and Sim calls
  `gates.ask({context: 'boss_shield', difficulty})`; correct → shield shatters (fx, stun 2 s);
  wrong → shield stays 8 s, then asks again.
- **Lessons** (Meta `lesson` op): opens the `lesson` modal, asks `questions` gate questions in a row
  (`context: 'lesson'`), pays `reward.xpEach` / `goldEach` per correct answer, sets `rel` +1 with the teacher.
- **Quest turn-in** (Story): the last `talk` step of a quest calls `gates.ask({context: 'quest_turnin', optional: true})`;
  correct → +25% rewards.
- **Focus attack** (Meta + Sim): the consumable `focus_scroll` (effect `resource`) calls
  `gates.ask({context: 'focus'})`; correct → resource to max, cooldowns reset, 6 s of +50% power (fxTag `haste`).
- **Tutorial text** is `HudState.tutorial`, set by the cutscene `tutorial` step (Story fills it in its `hud` hook).
- **Interact prompt** `HudState.prompt` is filled by Sim's player system from `player.data.target`.
- **Minimap blips** are filled by Sim (`ents` hud hook): enemies, NPCs, companions, exits, chests, boss,
  plus `quest` blips that Story adds for the tracked quest's goal.

## 13a. Data module conventions

Every data file default-exports a plain object keyed by id (`export default { rat: {id: 'rat', ...} }`),
except `tiles.js` (default-exports an array; index = tile number) and helper modules
(`looks.js`, `palettes.js`, `zones/mapgen.js`) which use named exports.
`src/data/index.js` (frozen) imports every planned file and exports one object:

```js
data = { tiles: {list, byId, index /* id -> number */}, props, palettes, looks,
         enemies, npcs, dialogues, quests, cutscenes, zones, items, shops, loot, lessons,
         classes, specs, boons }
```

Planned files: `tiles.js props.js palettes.js looks.js items.js shops.js loot.js lessons.js classes.js boons.js`,
`specs/{warrior,mage,rogue}.js`, `enemies/{intro,forest,bosses}.js`, `npcs/{town,academy,forest}.js`,
`dialogues/{story,town,academy,forest}.js`, `quests/{main,town,forest}.js`,
`cutscenes/{intro,ambush,rescue,academy,forest}.js`, `zones/{test,intro,town,academy,forest}.js`, `zones/mapgen.js`.

`zones/mapgen.js` exports `buildZoneGrid(zoneDef, tileIndexById) -> {w, h, tiles: Uint8Array, variant: Uint8Array, props: []}`,
deterministic from `zoneDef.seed`; it handles both the `tiles` and the `macro` form (macro expansion may also
scatter decoration props, returned in `props`). `world.loadZone` calls it.

Enemy defs (`data/enemies/*.js`):

```js
{ id: 'rat', name: 'Pantry Rat', level: 1, tags: ['beast'],
  stats: { hp: 6, power: 1, defense: 0, speed: 2.2, radius: 0.3, xp: 3 },
  ai: { brain: 'chaser', aggro: 5, leash: 9 },
  attacks: [{ use: 'melee_arc', range: 0.7, dmg: 1, cd: 0.9, windup: 0.3, arc: 90 }],
  look: { rig: 'quadruped', size: 0.5, colors: {...}, features: ['tail_thin'] },
  drops: { gold: [1, 3], goldChance: 0.6, items: [{ id: 'cheese', p: 0.15 }] },
  boss: null | { phases: [{ untilHp: 0.66, pattern: ['charge', 'volley'] }, ...], shieldAt: [0.66, 0.33] } }
```

Loot tables (`data/loot.js`): `{id, gold: [a, b], items: [{id, n, p}], runeBonus: {...}}`.
Lessons (`data/lessons.js`): `{id, teacher, title, questions: 3, difficulty, tags, reward: {xpEach, goldEach}}`.
Shops (`data/shops.js`): `{id, name, keeper, stock: [{item, req: [conds]}], haggle: true}`.

## 13. Files and owners

| Package | Owns |
| --- | --- |
| Skeleton (then frozen) | `index.html`, `src/main.js`, `src/contracts.js`, `src/config.js`, `src/core/game.js`, `src/core/systems.js`, `src/core/events.js`, `src/core/rng.js`, `src/core/math.js`, `src/data/index.js`, `src/render/index.js`, `src/platform/loop.js`, `tools/serve.mjs`, `vendor/**`, `tests/e2e/helpers.cjs` |
| Sim | `src/core/{world,ents,player,physics,combat,abilities,ai,companions}.js`, `src/core/kits/{index,novice}.js`, `src/platform/input.js`, `tests/node/sim*.test.mjs` |
| Story | `src/core/{ops,dialogue,cutscene,quests,npc,clock}.js`, `tests/node/story*.test.mjs` |
| Meta | `src/core/{progression,inventory,gates,save,debug}.js`, `src/questions/**`, `src/platform/storage.js`, `docs/QUESTIONS.md`, `tests/node/meta*.test.mjs` |
| UI | `src/ui/**`, `css/**`, `src/platform/audio.js`, `tests/node/ui*.test.mjs`, `tests/e2e/ui*.cjs` |
| Render 2D | `src/render/r2d/**`, `tests/e2e/r2d*.cjs` |
| Render 3D | `src/render/r3d/**`, `tests/e2e/r3d*.cjs` |
| Content | `src/data/**` except `index.js`, `classes.js`, `specs/**`, `boons.js`; `tools/validate-data.mjs`, `tools/map-preview.mjs`, `tests/node/data*.test.mjs` |
| Class kits (later stage) | `src/core/kits/<class and spec>.js`, `src/data/classes.js`, `src/data/specs/**`, `src/data/boons.js`, `tests/node/kit*.test.mjs` |
| QA (later stage) | `tests/e2e/smoke.cjs`, `tests/node/bot.test.mjs`, `tests/e2e/out/**` |

Everyone owns `docs/notes/<package>.md`.

## 14. Skeleton interpretations (binding)

`docs/notes/skeleton.md` lists how the skeleton resolved open points (for example: `game.player` is the
player ENTITY and the player system's API is `game.sys.player`; `hudState()` resets nothing, each system
nulls its own fields; arrays in FrameState are longer than their counts; `FxEvent.ent` is an entity id).
Those interpretations are part of this contract. Read that file after this one.

Working trees: each package works in its own git worktree on its own branch and commits there, and only
there. Never touch `/home/user/fantasy-rpg-interface` (the main tree) or another package's worktree.
