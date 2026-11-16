# Round 3, package B: biome art (notes)

Owner files only (BIOMES.md "Ownership"). Everything here is drawn in both renderers; `renderStats().unknown` stays
empty for every value below.

## For the biome engineers (C dunes, D cove, E peaks, F aether)

### New tiles (`src/data/tiles.js`, appended; new patterns `snow`, `ice`, `sky` in `contracts.js` TILE_PATTERNS)

| tile id | shape | walk | use |
| --- | --- | --- | --- |
| `snow` | flat | yes | snowfields (raised 0.08 like grass, sparkles, drifts). Peaks: prefer this over `sand`. |
| `ice` | flat | yes | frozen ponds (glassy streaks, cracks). Not slippery (no game rule). |
| `snow_bank` | block h1 | no | snow walls / ledges (pattern `snow`). |
| `sky_void` | pit, **solid** | no | **Aether**: the open sky between floating islands. Draws no floor: the island edges next to it show a craggy rock underside dropping into the sky, hanging rocks, clouds far below (and soft drifting clouds in 3D). Use it for every gap between islands; join islands with `cloud` tiles (walkable) or `bridge` props. In 2D it is painted as sky with clouds and a rock rim under the island to the north. |

Palettes also recolor existing patterns (sand, cliff, water, grass, path, ...), see `src/data/palettes.js`. In
`peaks`, `sand` reads as packed snow and `cliff` as snowy rock (white top, blue-grey face); in `dunes`, `cliff` is
terracotta sandstone; in `aether`, `cliff` is lavender rock, `trees` lilac canopy. Note that a palette recolors every
tile of a pattern (one cliff color per zone).

### Map edges (`palette.edge`)

Beyond the map both renderers draw biome scenery instead of the tree canopy: `dunes` rolling dune ridges, sandstone
mesas, cacti/palm tufts; `cove` open animated sea (3D water material) with sea stacks and buoys, foam along the shore,
and a 2-tile strip of the edge tile's ground beyond any land edge tile (so a road leaving the map does not end in the
sea); `peaks` snow drifts and pines near the map, big snow-capped peaks further out (low scenery to the south so the
bottom rows stay visible); `aether` no ground at all: island undersides with hanging rocks, a cloud sea far below,
little far-off islets, drifting clouds. Keyed on the palette's `edge` field (palettes `dunes`, `cove`, `peaks`,
`aether` set it), so it works for any zone using those palettes.

### Prop ids (all in `src/data/props.js`; base ids from the prep kept)

- Dunes: `palm`, `palm_tall`, `palm_bent`, `cactus` (saguaro), `cactus_round`, `cactus_pear`, `ruin_pillar`,
  `ruin_pillar_broken`, `ruin_pillar_bleached`, `ruin_pillar_bleached_broken`, `ruin_wall` (2x1), `ruin_wall_bleached`
  (2x1), `obelisk`, `obelisk_bleached`, `pottery`, `pottery_tall` (amphora), `pottery_stack`, `dune`, `dune_ripple`
  (flat, walkable), `rock_sandstone`, `tent_caravan` (3x2), `bush_desert`.
- Cove: `shell`, `shell_conch`, `starfish` (flat), `coral` (branching), `coral_blue` (tubes), `coral_yellow` (brain),
  `coral_fan`, `boat` (3x2, sail), `boat_red`, `rowboat` (2x1), `tidepool` (2x2, walkable), `lighthouse` and
  `lighthouse_blue` (3x3 buildings, door column 1, glowing beacon), `rock_sea`, `fence_driftwood`, `banner_sea`.
- Peaks: `snowman` (top hat), `snowman_small` (bobble hat), `igloo` (3x2, door 1), `igloo_big` (4x3, door 2),
  `snow_pine`, `snow_pine_small`, `snow_pine_frosted`, `ice_spire`, `ice_spire_cluster`, `ice_spire_aurora`,
  `rock_snowy`, `crystal_ice`, `bush_snowy`.
- Aether: `cloud_puff`, `cloud_puff_pink` (flat), `floating_rock` (2x2, hovers over its shadow), `floating_rock_small`
  (1x1), `floating_rock_crystal` (2x2), `star_lamp`, `star_lamp_gold`, `orrery` (3x3; planets orbit slowly),
  `moon_flower`, `moon_flower_blue` (flat, soft glow), `obelisk_star`, `ruin_pillar_sky`, `crystal_sky`, `tree_lilac`,
  `bush_sky`.
- Doors: lighthouse / igloo doors sit on the south face at the def's `door` column, like houses (door step at
  `(x + door, y + h)`). Boats are solid: place them on water/shallows next to a pier (`planks`).

### Creature features and heroes (look values)

quadruped `claws` (pincers on the head; they lunge with attacks), `stinger` (scorpion tail arching over the back,
replaces the tail), `shell_back` (domed shell; shelled critters get antennae instead of default ears), `long_ears`,
`horns`; blob `tentacles` (the body floats over dangling tentacles), `bubbles`; flyer `wings_insect` (moth wings in
the accent color, eye spots); plant `cactus` (a walking cactus: ribbed body, cactus arms, flower crown), `seaweed`
(kelp fronds); golem `sandy` (strata, a glowing accent glyph), `icy` (ice shards, snow caps, icicles), `coral` (accent
coral branches, barnacles, starfish), `starry` (star specks, constellation lines, accent crescent, halo ring).

Colors that work (see the gallery fixture, `tools/gallery-fixture.js` BIOMES): `colors.body/belly/accent/eye`.
Heroes:
- `sphinx` (rig `quadruped`): body = fur, belly = muzzle/chest, **accent = headdress stripes** (blue looks regal),
  eye. Design size 1, use `size` ~2.
- `crab_king` (rig `quadruped`): body = shell (red), belly = underside, **accent = captain's hat** (navy). Size ~2.2.
- `yeti` (rig `golem`): body = fur (white-blue), belly = lighter fur, **accent = face/hands/feet skin** (blue-grey).
  Size ~2.
- Malgrim Ascended: humanoid hero `malgrim`, `size: 1.6`, `aura: {style: 'storm', color: '#c9a6ff'}`. Auras now scale
  with the size: for size > 1 the 3D storm becomes a rune circle + glowing ring on the ground, forked bolts, orbiting
  sparks and a crown of lilac storm clouds behind the head (kept off the face).

Dialogue portraits (`src/ui/portraits.js`) know all features and the three heroes (sphinx headdress, crab captain,
grumpy yeti).

## Files

- `src/data/palettes.js`: real `dunes`, `cove`, `peaks`, `aether` palettes (+ `edge`). `src/data/tiles.js`: 4 tiles
  appended. `src/data/props.js`: ~45 variant defs. `src/contracts.js`: TILE_PATTERNS + `snow ice sky`.
- 3D: `render/r3d/biomeProps.js` (new: 20 prop builders), `rigs/biomeCreatures.js` (new: features + sphinx,
  crab_king, yeti), `rigs/creatures.js` (feature hooks, hero dispatch), `props.js` (registration, door offset for
  lighthouse/igloo), `terrain.js` (snow/ice/sky patterns, sky drop sides, biome borders; border geometries may use the
  water material, border emitters), `index.js` (border water meshes, emitters `beacon bloom glint orrery cloud`, aura
  size), `fx.js` (big auras, `orb` batch for planets), `fxgeo.js` (sphere solid).
- 2D: `render/r2d/biomeProps.js` (new: 20 painters), `biomeCreatures.js` (new), `creatures.js`, `props.js` (`dune` has
  no outline), `tiles.js` (snow/ice/sky, snow block, sky underside rim, `BORDERS` per edge), `index.js` (two-frame sea
  border), `live.js` (`orbit` emitter for the orrery).
- `tools/gallery-fixture.js`: pages 5-8, one per biome (tiles, every biome prop, features, heroes; the Aether page has
  a sky-void channel, the Cove page a sea strip). Page 4 no longer lists biome props and is 64 tiles wide (at 40 wide
  it had grown to 95 rows and the fitted 3D camera ended up beyond the far plane: an empty page).
- `tests/e2e/r3d-gallery.cjs`: pages 0-8, biome close-ups (`r3d-z-b<page>-*`, `r3d-z-hero-*`), and the four biome
  zones in the real game at 1086x657 with budgets (`R3D_ONLY=biomes`). `r2d-gallery.cjs`: pages 0-8 and the four
  biome zones in the real game (unknown empty, draw budget). Both pass; busy scenes unchanged (town 51 draws / 91k,
  enemies 47 / 105k).
- `tools/map-preview.mjs`: glyphs/colors for the new models, sky-void streaks.

## Measured (headless SwiftShader)

Gallery biome pages (900x560, fitted): 35-64 draws, 54-84k tris. Play-zoom close-ups: 21-40 draws, 37-62k tris.
Placeholder biome zones in the game (1086x657, player + 2 companions): 20-24 draws, 19-39k tris. Model sizes: sphinx
~2.6k tris, crab_king ~2.4k, yeti ~2k (body + outline about double), lighthouse ~3k, orrery ~2.5k.

## Known gaps / requests

- The real biome maps did not exist yet; budgets were measured on the placeholders and the gallery. The biome e2e
  check (`R3D_ONLY=biomes node tests/e2e/r3d-gallery.cjs`) re-measures after the merge.
- Floating rocks and the orrery's rings are static geometry (chunk meshes cannot move); only the planets (fx) turn and
  drifting clouds/beacon flare are fx.
- `tidepool`, `dune`, `shell` are flat/walkable; in 2D they are baked into the ground, so the tide pool's sparkle is
  3D only (flat 2D props have no emitters).
- Lead: `docs/notes/r3d.md` "Adding things" still applies; the biome builders live in the new files listed above.
