# Render 2D notes (`src/render/r2d/**`)

Procedural SNES-style pixel art for the `2d` look. No image files: every tile, prop, character and effect is painted in
code at startup or lazily, then cached.

## Structure

| File | Role |
| --- | --- |
| `index.js` | `create()` → the Renderer (CONTRACTS 7). Camera, chunk cache, y-sort, occluders, entity drawing, stats. |
| `pix.js` | `Pix`: a tiny software pixel buffer (art resolution, `Uint32Array`). Crisp rects/ellipses/polys/lines, 3-tone `shaded()` ellipses, `outline()` (the studyHallSim `#1e1a22` 1-px outline), `flipped()`, `rot90()`, `toCanvas()`. Also `hash(x, y, seed)` noise and `makeCanvas`. |
| `color.js` | Hex helpers: `mix`, `dark` (toward a cool purple shadow), `light` (toward warm cream), `rgba`, `col(c, fallback)`. Memoized. |
| `tiles.js` | 16×16-tile chunk painter (256×256 art px): patterns, transitions, shorelines, block tiles, baked prop shadows + flat props. |
| `props.js` | One painter per prop model (closed list), buildings included. Returns sprite, footprint offset, baked shadow and emitters. |
| `humanoid.js` | The humanoid rig: layered painter (cape, back hair, legs, outfit, arms, head, face, hair, hat, held item) for 3 views × 12 anims, hero overrides (`laporte`, `malgrim`). |
| `creatures.js` | `quadruped, blob, flyer, plant, golem` + hero `mossback`. Geometry scales with `look.size` so pixels stay uniform. |
| `models.js` | Projectile sprites (drawn pointing east, rotated at draw time) and static effect sprites (chests, pickups, totem, stick, meteor rock, caltrops). |
| `spriteFactory.js` | Sprite cache. `WeakMap(look) → {rev, bank}`; a bank is shared by every look with identical JSON, indexed by `(anim, dir, frame)` with no allocation on hits. Flash (white) and tint silhouettes cached per sprite. |
| `fx.js` | Pooled particles (900) and shaped effects (140): every FX type, slash styles, `glow()` (cached radial sprite per color). |
| `live.js` | Things drawn live each frame: effect-rig models (telegraphs, barrier, ground fire/frost, zone ring, portal, smoke, shield bubble, rune seal), persistent fxTags, auras, prop emitters (chimney smoke, campfire, fountain spray, lamp glow, cauldron bubbles, crystal twinkles). |

### Frame pipeline

1. The world is drawn **1:1 into an "art" canvas** (1 px = 1 art pixel; `3 * zoom` CSS px each). The camera's
   top-left is floored to whole art pixels; the fractional rest becomes a sub-art-pixel offset in the final blit, so
   scrolling is smooth while sprites stay on the art grid. One nearest-neighbor `drawImage` scales the art canvas to the
   screen canvas (`{alpha: false}`, `image-rendering: pixelated`; smoothing only when the scale is below 1.5, i.e. the
   zoomed-out gallery).
2. Tile chunks (`drawImage` each). Chunks with water have two frames (2.2 Hz).
3. Ground layer: blob shadows, ground effect models, under-tags (rune circles, summoned ring...), aura halos, ground fx
   shapes (rings, cracks, scorch).
4. Y-sorted list (insertion sort, nearly sorted frame to frame): entities (key = interpolated feet y), props (key =
   footprint bottom; footless decor = tile center + 0.45), and **block occluders**.
5. Top layer: translucent volumes (barrier, shield bubble, smoke), emitters, fx shapes, particles.
6. Ambience: `multiply` fill of `ambience.tint` (alpha `min(0.55, tintAmount * 2.2)`), then light-source glows on top
   (lamps glow additively in the evening), then `screenFlash`.

### Blocks and occlusion (3/4 view)

A `block` tile draws its top face raised by `h` tiles; when the tile to its south is open (or lower) it also draws a
south face `h` tiles tall ending at its own south edge. So a 1-row hedge covers the walkable row north of it (things
standing there are "behind" it), and big regions (forest) show canopy everywhere plus trunks along their south edge.
Blocks are baked in the chunk under everything; when an entity/prop sprite overlaps a block whose base is south of the
entity's feet, that block's pixels are copied back from the chunk canvas over it (one `drawImage` per marked tile,
y-sorted at `ty + 1`). Tall props (trees, lamps, buildings) occlude through the y-sort.

### Budgets (this machine, headless Chromium, software GL off)

Test zone with 60 enemies: median 0.8 ms, ≤ 71 drawImage. Harness `stress` (60 mixed humanoids + fx): ~1.7 ms median,
~140 draws. Zone load (all visible chunks + props): ~70 ms. A lazily built chunk costs a few ms (at most one per frame
while moving, prefetched 4 tiles ahead). `stats()` = `{ms, draws (drawImage calls), tris: 0, unknown, fills (rect/path
fills), chunks (built so far), particles (alive), sprites (built so far)}`.

No `shadowBlur`, no `ctx.filter`, no per-frame gradients or canvases (glow sprites are created once per color, sprites
and chunks once per content). Quality 0: 220 particles, no auras, no sprite glows, no tag tints; 1: 600; 2: 900.

## How to add things

- **A humanoid feature** (hair/hat/outfit/held style): add the name to `KNOWN` in `humanoid.js`, then a branch in the
  matching painter (`hair()` + `backHair()`/`hairOverBack()` for hair, `drawHat()`, `torso()` + `sideTorso()` for
  outfits, `drawHeld()` for held items; held items get `hand` + `wdir`, an 8-way direction, and use `seg/dot`). Coordinates
  are offsets from the feet anchor (row -1 = soles, head rows -24..-14). Push `[x, y, color, r]` into `glow` for parts
  that should glow. Paint 3 views: `dir` 0 up, 1 right (left is mirrored), 2 down.
- **A creature feature**: add it to `CREATURE_FEATURES` in `creatures.js` and draw it in the rig painter (use `k` for
  every size).
- **A prop model**: add a painter to `PAINTERS` in `props.js` (coordinates relative to the footprint's top-left, `ctx.W/H`
  footprint px), its headroom in `UP` (and `SIDE` if it is wider than its footprint), `shadow(ctx, ...)` for the baked
  ground shadow, `ctx.emit.push({kind, x, y, color, r})` for live emitters (`glow smoke flame twinkle fountain ripple
  bubbles`). Flat walk-on models go in `FLAT_MODELS` (baked into chunks).
- **A tile pattern**: a case in `ground()` (flat) or in `blockTile()`/`blockDecor()` (block); set its transition
  priority in `PRIO` (and `SOFT_SOURCE`/`SOFT_RECEIVER` for fringes).
- **An FX type**: a case in `fx.spawn()` (emit particles via `emit(kind, ...)`, add shapes via `shape(type, dur)`) and,
  for a new shape, a case in `drawShapes()`. Add it to `FX_KNOWN`.
- **An fxTag / aura / effect model**: `live.js` (`tagsUnder`, `tagsOver`, `aura`, `effectGround`/`effectTop`), plus the
  tag list `FXTAGS` (and `TAG_TINT`) in `index.js`.

## Interpretations of the art vocabulary

- `build 'a'` = 10 px torso, `'b'` = 8 px torso with slimmer legs. `size` scales the humanoid sprite at draw time
  (0.91–1.09 snaps to 1 to keep pixels square); creature geometry is painted at its size (small creatures shrink less
  than their size so rats stay readable: `k = 0.35 + 0.65 * size` below 1).
- Weapon hand: viewer-left facing down, viewer-right facing up, the near hand in profile. Long weapons (staff, spear,
  broom) stand upright beside the body; attacks show 3 swing frames, `cast` raises the hand, `charge` pulls back.
- `hood: true` hides hair/hat and shades the face with two glinting eyes. `cape` flares behind the arms (front),
  covers the back (up) and trails while walking. Capes accept extra `trim`/`lining` colors (hero overrides use them).
- `laporte`: `m_hairline` brown hair, stubble goatee (`LAPORTE.stubble`), navy/gray striped quarter-zip with gray
  collar and white undershirt peek, `#3b3b58` pants, a purple headmaster cape with gold trim, and a staff with a cyan
  crystal (unless the look sets `cape`/`held`). `malgrim`: slicked hair, curled villain mustache + pointed goatee, a
  high red-lined collar, robe, crooked wizard hat with a star, dark cape, staff with a glowing orb in the outfit accent.
- `mossback`: bark trunk body, moss carpet with a mushroom and flowers, antler branches, branch arms with twig fingers,
  root legs, glowing `colors.eye` eyes.
- `slash` styles: sword (white crescent band), axe (thick orange arc + rock chips), dagger (two quick crossing cuts),
  claw (three parallel rakes), fist (speed lines + impact burst), stick (thin cream arc + leaves), crescent (wide glowing
  moon), spin (full circle, two arms). `bolt` without `x2` falls from 8 tiles up.
- `ring`/`shockwave`/fx circles are squashed to 0.8 for depth; gameplay circles (telegraphs, zones, bubbles) are drawn
  round so they match hit areas. Telegraph fill grows over 0.8 s of `animT` (a windup progress hint).
- `bridge`: walked north-south (rails west/east, boards east-west) when the footprint is at least as wide as tall,
  otherwise east-west. Building doors sit at footprint column `floor(w / 2)` (the academy has double doors centered).
- Unknown values fall back (tunic, short hair, stick, grass, crate prop, burst fx) and are listed in `stats().unknown`
  as `humanoid.hat:xyz`, `prop.model:xyz`, `fx:xyz`, `fxTag:xyz`, `tile.pattern:xyz`, ...

## Added (beyond the contract)

- Renderer: `canvas` getter (the screen canvas); `stats()` extra fields listed above.
- Looks (optional, ignored by 3D): `cape.trim`, `cape.lining`.

## Tests and tools

- `tests/e2e/r2d-gallery.cjs` (`--quick` = one zoomed crop per page, `--pages=0,3`): all gallery pages + zoomed crops at
  zoom 2 (1.5 for tiles), the extra harness scenes, and the test zone with 60 spawned enemies; asserts no console
  errors, empty `unknown`, ≤ 300 draws, median frame < 4 ms. Screenshots: `tests/e2e/out/r2d-*.png`.
- `tests/e2e/r2d-harness.html?scene=` (`town`, `town_evening`, `forest`, `academy`, `road`, `occlusion`, `stress`,
  `fx@<seconds>`, `one:<fxType>[:<style>]@<seconds>`): storybook scenes the gallery lacks. `window.__harness =
  {ready, scenes, show(name), setTime(t), setCamera(x, y, zoom), stats()}`. FX scenes fire every event at once and
  advance exactly to the given phase, so effects can be inspected frame by frame.

## Requests

- Gallery fixture (skeleton): page 4 packs props by footprint only, so tall props overlap the row above (academy,
  tower); spacing rows by sprite headroom would help. A pinned-time mode that still advances fx (`setTime` freezes
  them) would make fx screenshots deterministic; the harness does this for now.
- Content: `docs/STORY.md` markers for building doors are assumed to be the tile just south of footprint column
  `floor(w / 2)`.
- Sim: entity `look` objects shared between entities should be cloned when one of them is mutated (the cache keys on
  look content + `lookRev`, so in-place edits must bump `lookRev`).
