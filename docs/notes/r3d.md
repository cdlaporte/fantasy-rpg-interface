# Render 3D (`src/render/r3d/**`) — notes

The 3D look is a "toy box": a tilted diorama of cel-shaded, outlined, chunky toys built from primitives in code.
Everything follows CONTRACTS section 7 (Renderer interface, FrameState, fx, fxTags, budgets, camera) and sections 5/6
(tiles, props, looks). No model or texture files; the only texture is the 3-texel toon ramp.

## Files

| File | What |
| --- | --- |
| `index.js` | `create()` → the Renderer. WebGLRenderer, camera (skeleton note 17 framing, unchanged from the debug renderer, so `project` / `viewRect` are identical), lights + ambience, render loop, entity state, afterimage ghosts, prop emitters, stats, quality. |
| `toon.js` | The material set (one object per role, `customProgramCacheKey` per role) and the shared uniforms `U`. |
| `kit.js` | `Kit`: merges primitive templates (cached three geometries → arrays with smooth normals) into one vertex-colored geometry; `T.*` template factories; color helpers `C mul mix lighten darken`. |
| `terrain.js` | `prepareZone`, `buildChunk`: 16x16-tile chunks (terrain + props merged), water meshes, pattern accents. |
| `props.js` | One builder per prop model (closed list), `buildProp`, emitters, prop blob-shadow radii. |
| `models.js` | Entity model cache (key = look JSON) and per-model instanced batches (body + outline sharing instance buffers). |
| `rigs/humanoid.js` | Humanoid builder incl. hero overrides `laporte`, `malgrim`; `humanoidSpec` normalizes a look and records unknown values. |
| `rigs/creatures.js` | quadruped, blob, flyer, plant, golem, hero `mossback`. |
| `rigs/items.js` | Solid parts of projectile and effect looks (the glowing / translucent parts are fx). |
| `rigs/pose.js` | `pose(out, rig, anim, animT, dir, moving, t, seed)`: transform-only animation for every ANIM value and rig. |
| `fx.js` / `fxgeo.js` | Instanced fx batches, one-shot FxEvent records, persistent visuals (fxTags, auras, effect/projectile looks, shadows). |
| `tests/e2e/r3d-gallery.cjs` | Gallery pages 0-4 + close-ups, busy-scene budgets, the test zone in the real game, hot swap. Screens → `tests/e2e/out/r3d-*.png`. |
| `tests/e2e/r3d-harness.{html,js}` | Busy-scene harness: `?scene=town` (square, 12 NPCs + player + 2 companions) and `?scene=enemies` (24 enemies, projectiles, fx). `window.__r3d`. |

## How it draws (per frame)

1. Camera: fixed yaw (north up), pitch 55°, FOV 32°, distance from the 2D framing; `camera.shake` jitters the focus.
2. Static world: one toon mesh + one outline mesh + one water mesh per chunk (three's frustum culling per chunk).
   Props are first in each chunk's index buffer, so the outline mesh is the same buffers with `drawRange = props`.
3. Entities: every entity instance goes into its model's InstancedMesh (identical looks share a model, e.g. 24 rats = 2 draws).
   Posing happens in the vertex shader: each vertex carries `pivot = (x, y, z, partId)`; per instance `iPose0/iPose1` hold
   part angles, `iFx = (flash, alpha, glow, legBias)`, `iGlow` the glow color, `instanceColor` the tint.
   Alpha < 1 (stealth, afterimages) is screen-door dithering, so everything stays in the opaque pass with one program.
4. FX: ~45 instanced batches (rings, discs, puffs, flames, ribbons, bolts, arcs, fans, icons...), refilled every frame; a batch
   with no instances is invisible (no draw). One-shot fx are pooled records (160) whose particles are pure functions of
   (seed, index, age): no per-frame allocation.
5. Cutaway: the chunk materials dither away fragments that are above ground, south of (in front of) the player and inside a
   screen circle around the player, so buildings/trees/walls never hide the player. Only when a `type: 'player'` entity is in the frame.

Programs (≤ 8): `r3d-chunk` (toon), `r3d-chunkline`, `r3d-water` (toon), `r3d-char` (toon, instanced), `r3d-charline`,
`r3d-fx` (normal and additive share it; `forceSinglePass` so transparent double-sided fx are one pass). Measured: 6.

## Adding things

- **A rig feature / look value**: add the value to the builder (`rigs/*.js`) and to its accepted list at the top of the file
  (unknown values fall back and are reported in `stats().unknown` as `kind:value`). Put tiny details inside
  `k.lineless = true ... false` so they get no outline (cheaper, cleaner). Parts: 0 body, 1 head, 2/3 legs, 4 left arm (+X, off-hand,
  shield), 5 right arm (-X, weapon), 6 cape (rot X), 7 tail (rot Y). Call `k.part(id, pivotX, pivotY, pivotZ)` before adding.
- **An animation**: `rigs/pose.js`, one switch per rig. Root transform via `o.x/y/z, yaw/pitch/roll, sx/sy/sz`; parts via `o.p0/o.p1/o.legB`.
- **A prop model**: a builder in `props.js` `BUILDERS` (kit matrix is at the footprint center, south = +Z = facing the camera);
  return emitters for animated bits (`lamp fire fountain bubbles crystal chimney rune`), add a blob-shadow radius to `SHADOW`.
- **An fx**: add a `DRAW.<type>(rec, age, k)` in `fx.js` (and a default duration in `DUR`); push instances with
  `ground / bill / ball / push`. New shapes: a factory in `fxgeo.js` + an entry in `batchDefs()` (geometry, additive, capacity, renderOrder).
- **A tile pattern accent**: `accents()` in `terrain.js`.

## Measured (headless SwiftShader; draws / triangles from `renderer.info`)

Gallery at 800x450, fitted camera (all items in view; page 0 is a stress page, ~80 unique humanoid looks):

| Page | draws | tris |
| --- | --- | --- |
| 0 humanoids (81 ents, 81 unique models) | ~142 | ~199k |
| 1 creatures (43) | ~94 | ~83k |
| 2 projectiles & effects (38) | ~93 | ~32k |
| 3 fx & fxTags | ~38-60 | ~70-78k |
| 4 tiles & props | ~31 | ~54k |

Busy scenes at 1086x657 (the Chromebook play view), quality 2 / 1 / 0:

| Scene | draws | tris |
| --- | --- | --- |
| town square, 12 NPCs + player + 2 companions, fx | 55 / 51 / 33 | ~106k / ~100k / ~62k |
| forest clearing, 24 enemies (4 kinds), 6 projectiles, fx | 43 / 38 / 28 | ~103k / ~97k / ~70k |
| test zone in the real game | ~11-17 | ~28-33k |

Model sizes (triangles, body + outline): humanoid ~1230 + 750, wizard ~1570 + 940, Laporte ~2050 + 1520, quadruped 890 + 670,
blob 570 + 340, flyer 840 + 680, plant 760 + 540, golem 1170 + 1100, Mossback 1900 + 1760.

Gallery page 0 exceeds the budget on purpose (it shows every look value at once); the budget is asserted on the busy scenes.

## Interpretations (art vocabulary)

- Head tilted back 0.36 rad so faces read from the 55° camera; eyes are big dark ovals with a highlight, blush cheeks.
- `build a` = broader shoulders/torso, `b` = slighter. `size` scales the whole instance. `ears: pointed` = elf cones.
- `hood: true`: the head is shadowed, two soft glowing eyes, a hood shell with a pointed tip; hair is hidden.
- Outfits: tunic (belt + skirt flare), robe (long flared + sash + wide cuffs), cloak (shorter flare + clasp), plate (lighter
  breastplate, pauldrons, knee caps), leather (strap, pouch), gi (crossed lapels, sash), quarterzip (horizontal navy/gray
  stripes, collar, zipper), dress, apron (bib over shirt), uniform (shirt + tie + lapels + buttons), vest (open vest, bare arms).
- Hats: wizard (bent 3-segment cone + band + star), cap, crown, bandana (band + knot tails), helm (dome + cheek guards + crest),
  straw, chef, feather (bycocket + feather), horned (steel helm + bone horns), circlet (band + gem).
- Held: weapons sit in the right hand (part 5), shield / second axe / second dagger in the left. `glow` colors the business end
  emissive and adds a soft glow sprite. `fists` = big gloves with glowing wraps.
- Auras (`glow flame sparkle shadow frost storm`) are fx around the feet/body, drawn every frame.
- Heroes: `laporte` adds a maroon headmaster cape with gold hem, a wooden staff with a glowing gold crystal and goatee stubble
  (exact `LAPORTE` palette for hair, skin, stubble, navy/gray stripes, collar, undershirt, pants, shoes; M hairline = receding
  cap + central widow's peak). `malgrim` adds a tall crooked wizard hat with gold band, a high standing collar, spiky pauldrons,
  curled mustache + pointed goatee, villain brows, a dark staff with claw prongs and a glowing orb. `mossback` is a bark treant
  with mossy shoulders, a leafy flowered canopy, antler branches, glowing eyes and a glowing knot heart.
- `anim: sleep` lies on its back and shows Zzz even without the `sleep` fxTag. `ko` falls over sideways. `sit` lowers the body
  and swings both legs forward (`legB`).
- Tile heights: grass-like patterns are raised 0.06 (crisp lips at path edges), water surface -0.2 over a dark bed, shallows
  -0.07, pits -1.2, blocks at `h`. `trees` tiles render as a dense canopy of blobs over a dark floor (trunks on the south edge).
  Zone edges get a dark earth "tabletop" skirt.
- Buildings are front-gabled (the gable faces the camera) so door, windows and the hanging sign icon read from above.
- `trail` fx: `(x, y)` is the head and `(x2, y2)` the tail (matches the gallery fixture).
- `afterimage` fx: a dithered, tinted, glowing copy of entity `ent` at `(x, y)` (its last pose), fading over `dur` (0.45 s).
- `screenFlash`: a quad just in front of the near plane.
- `text` is ignored (overlay).

## Contract additions (renderer object)

- `renderer.canvas` (the `<canvas class="r3d">`), `renderer.quality`, and for tests/debug `renderer.scene`, `renderer.camera`,
  `renderer.webgl` (the three WebGLRenderer).
- `stats()` adds `programs, models, fxInstances, chunks, chunkTris`; `unknown` lists unknown look/fx values as `kind:value`.
- WebGL context loss: `init` throws when no context can be created (the loader falls back to 2D). A context lost later is
  reported with `console.warn`, a bubbling `r3d:contextlost` DOM event on the host element, and rendering pauses until restored.

## Requests

- **Integrator (main.js, frozen)**: listen for `r3d:contextlost` on `#view` and call `game.commands.setRenderer('2d')`.
- **Gallery fixture (skeleton)**: an item with a `type: 'player'` entity on page 4 would show the cutaway; fx cells could pass
  realistic colors (smoke grey, slash styles in class colors) so the gallery shows the intended palette; a page with a forest
  zone using the `trees` pattern at scale would help judge canopy density.
- **Content**: effect looks should pass `color` (the renderer defaults are generic); `smoke` looks read best grey (`#b8b4c4`).
