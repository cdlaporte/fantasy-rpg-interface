# World notes (tiles, props, palettes, zones, mapgen, tools)

Owner: World. Files: `src/data/{tiles,props,palettes}.js`, `src/data/zones/**`, `tools/validate-data.mjs`,
`tools/map-preview.mjs`, `tests/node/data-world.test.mjs`, this file.

## Tools

```sh
node tools/validate-data.mjs [zoneId...]        # exit 1 on errors; prints size, prop/deco counts, build ms, enemy budget
node tools/map-preview.mjs <zoneId> [out.png] [scale] [--crop=x,y,w,h] [--no-labels] [--no-deco]
                                                # default out: tests/e2e/out/map-<zone>.png, scale 8
```

The preview draws tiles in their palette colors (block tiles darker), prop footprints (round glyphs for plants and
rocks, buildings with wall band and door), deco as dots, markers as yellow labeled dots, spawn areas red
(`kind xN lL`), triggers orange dashed, exits blue (`> zone`, `?` when conditional), gates magenta, chests gold
(rune chests light blue), prop interact points as white squares, a grid every 10 tiles with coordinates.

The validator checks, per zone: rectangular rows, complete legend, known tiles/props/models, palette id, every
marker required by `docs/STORY.md` present, in bounds, on a walkable tile and not under a solid prop (except
`freeMarkers`), flood-fill reachability from the entry marker (gates open) to every marker, exit, spawn area,
trigger area, chest and prop interact point; exits target existing zones and markers; arrival markers are not
inside or next to an exit area (under both readings of `{at, w, h}`); spawn kinds are in the STORY enemy list;
chest loot ids are STORY loot tables, a solid chest never cuts anything off; each gate area is walkable when open and,
when closed, cuts off at least one marker and every marker in its `seals`; building door steps are free and reachable;
op and condition names are known; shop/lesson ids are STORY ids; awake-enemy budget (sum of spawn `n` whose area
center is inside a 30-tile bubble around any reachable spot; warns above 24). Exports `buildZone, validateZone,
validateAll, flood, REQUIRED_MARKERS, ...` for tests.

## Contract additions (all additive)

### Zone definition

- `entry: 'marker'` default arrival/entry marker (validator; also a sensible default for `loadZone` without a marker).
- `freeMarkers: [names]` markers allowed on solid tiles (test zone `pond`: fx target in the water).
- **Rectangles of furniture**: exits, gates, spawns and triggers accept either `area: [x, y, w, h]` or
  `at: marker` + `w, h`. `{at, w, h}` is **centered on the marker tile**: `x0 = mx - floor((w-1)/2)`,
  `y0 = my - floor((h-1)/2)`. `furnitureRect(entry, markers) -> [x, y, w, h]` is exported from
  `src/data/zones/mapgen.js`; Sim should use it. All exits sit on dedicated `exit_*` markers on the map edge, 3+
  tiles from any arrival marker, so either reading is safe.
- `spawns[]`: `{kind, area | at+w+h, n, respawn (s; 0 = never), level, if?: [conds], boss?: true}`.
  `if` should be evaluated when the zone loads (and, ideally, again on `'flag'` events: despawn/skip when false).
  Intro rats use `if: [['not', ['flag', 'tutorial_done']]]`; the boss uses `if: not mossback_defeated`.
- `gates[]`: `{id, at, w, h, question, seals?}`; `w, h` give the rune seal's footprint (solid while sealed). `seals`
  is validator metadata (markers that must be unreachable while closed).
- Props: `interact: {prompt, at?: [tx, ty], do}`. `at` is the tile the player stands on (door step). Without `at`:
  buildings use their door step `(x + def.door, y + h)`, other props any walkable tile touching the footprint.
  All town building interacts carry `at` explicitly (equal to the `*_door` markers).
- Exits with an "always false" condition use the flag `next_term` (never set; setting it opens the four sealed gates).

### Tiles (`tiles.js`, appended only; indices 0..20 unchanged)

`palisade` (21, planks pattern, block h 1.5), `rune_floor` (22, starfloor pattern, lilac), `mossy_stone` (23, stone
pattern, greenish flat).

### Props (`props.js`)

- Default export keyed by **prop id**; `model` is from the closed list (named export `PROP_MODELS`). Many ids share a
  model with other looks (`tree_blossom`, `tree_forest`, `tree_sunny`, `pine_blue`, `bush_plain`, `bush_flower`,
  `rock_grey`, `rock_ring`, `flowers_wild|blue|red` (flowerbed), `mushroom_blue|gold`, `crystal_pink`, `fence_white`,
  `lamp_gold`, `quest_board` (sign 2x1), `statue_founder`, `stall_blue|green`, `tent_ranger|goblin`,
  `house_blue|green|plum|wide`, `shop_potions|outfitter|general|bakery|cafe|library|guard`, `tower_watch`,
  `gate_arch_forest|dunes|cove|peaks|aether|south`, `gate_arch_v_forest|dunes`, `bridge_long|wide`,
  `banner_red|green`, `bookshelf_tall`, `desk_headmaster`, `table_cafe|long`, `bed_infirmary`, `rug_blue|green`).
  Each variant also sets `look.variant` (0..7) so renderers can vary shapes.
- New def fields: `door` (column offset of the door in the bottom row of a building; door step `(x+door, y+h)`),
  `tall` (rough height in tiles, a hint).
- Footprint changes: `shop` 5x4 (library 6x4, guard 4x3), `academy` 18x9 (door column 9), `gate_arch` 5x1 (the two
  end columns are the pillars and stand on wall tiles; the 3 middle tiles are the opening).
- **Orientation**: `gate_arch`, `bridge`, `rune_gate` span their **longer footprint axis**: `gate_arch_v_*` are 1x5
  (east/west gates), `bridge_long` 3x4 spans north-south, `bridge_wide` 5x3 spans east-west. Bridges are non-solid;
  the tiles under them are walkable `planks`.

### Palettes

Resolved objects `{id, bg, sky, fog, light, patterns}` for `default, intro, town, academy, forest`. No palette overrides
`stone` (the `wall` tile uses that pattern). `LAPORTE` untouched.

### mapgen (`src/data/zones/mapgen.js`)

`buildZoneGrid(zoneDef, tileIndexById) -> {w, h, tiles, variant, props}`; generated props are
`{kind, x, y, deco: true}` (1x1 solid plants/rocks, or footless flowerbeds). Also exports `furnitureRect`, `vnoise`.
Legend values: a tile id, or `{tile, mix: [[tileId, frac, scale]], deco: {propId: p}, fringe: {propId: p},
path: true, under, width}` (both forms). Source options: `paint: [{rect|disc|at+r|line+width, tile?, reserve?,
path?, ragged?}]`, `decoClear` (radius kept free around markers, default 2.2). Macro only: `cell`, `warp`,
`warpBig`, `shore: {shallows, beach, beachChance, chance}`, `filler`.
Guarantees (macro): every walkable cell keeps its 2x2 core; 4-adjacent walkable cells get a carved 2-wide corridor;
solid cells and 1-cell water streams keep a 2-thick band (no leaks, diagonal checkerboard junctions pinned); walkable
pockets that contain no cell center or marker are filled; marker tile + 4-neighbours forced walkable; decoration
never disconnects walkable tiles (simple-point test), never lands on paths, reserved paint, markers (+decoClear),
exits/gates/chests (+1) or within 1 tile of an authored prop (buildings: 2 more rows in front of the door).
A property test (`tests/node/data-world.test.mjs`) checks macro 4-connectivity == tile connectivity on random grids.
Forest: ~4 ms warm, ~15-25 ms cold.

Hand-authored ASCII rows are the source of truth for `intro`, `town`, `academy` (they were drafted with a scratch
painter; edit the rows directly).

## Maps (marker coordinates are tile coords; tile centers are used)

### intro: Country Road (26 x 120), palette `intro`, entry `start`

A path winds north between tree walls and hedges. Beats, about one screen apart, south to north:
wake meadow (cart, signpost) `start [13,113]`, `respawn [12,106]`, trigger `wake` [4,106,18,13] → `intro_wake`
(if not `tutorial_done`) · `stick [13,101]` (hedged farm stretch north of it) · `rats_1 [12,88]` meadow with a well
(3 `rat`, area [8,85,9,6]) · Whistle Brook, a stream west→east, crossed by the road on a plank bridge
(`bridge [12,77]`, `bridge_long` prop; the stream blocks elsewhere) · `rats_2 [14,64]` meadow (4 `rat`,
[9,61,10,7]) · the giant rat's dirt dell `big_rat [11,50]` (1 `giant_rat` L2, [9,48,5,4]) · signpost "Shortcut!" ·
the **clearing**: a clear disc of radius 7 centred `clearing [13,30]` (flowers, no decoration), ring of standing
stones/flowers/mushrooms at r ~8 open north and south, tree wall beyond; `malgrim_spot [13,26]`, `hex_1 [10,28]`,
`hex_2 [16,28]`; trigger `ambush` [5,27,17,6] → `ambush` (if not `ambush_done`); `laporte_arrive [13,18]` on the
road north of the clearing · hedged lane with lamps and a welcome sign, `exit_town [13,4]` (escort target) and the
exit `exit_north [13,0]` (7x1) → town `gate_south`, `if intro_done` (locked text otherwise).
All rat spawns: `respawn: 0`, `if: not tutorial_done`.

### town: Flinkerton (84 x 68), palette `town`, entry `gate_south`

- North center: the **Academy** (`academy` prop 18x9 at [33,4]) on a stone terrace bounded by a cliff edge (y 16-17)
  with gardens, founder statues, lamps; broad cobble stair x 38..46 down to the square. Door step/exit
  `academy_enter [42,13]` (3x1) → academy `entrance`; `stair_top [42,14]`; `academy_door [42,20]` (arrival from the
  academy, foot of the stair). Behind the Academy: the Aether portal (rune floor, `gate_arch_aether`),
  `gate_aether [42,3]`, exit `exit_aether [42,0]` (sealed).
- **Shop row** in front of the cliff (doors face the square): bakery (`bakery_door [29,22]`, shop `bakery`),
  library (`library_door [35,22]`, dialogue `library_door`), potions (`potion_door [49,22]`, shop `potions`),
  cafe (`cafe_door [54,22]`, dialogue `cafe_door`) with a fenced **terrace** (tables, chairs) in the square's NE
  corner: `cafe_seat_1..4` [54,24] [55,24] [54,26] [52,26] (on chairs).
- **Square** (cobble, x 27..57, y 22..37): fountain (3x3 at [41,28]), statue, flowerbeds, lamps, benches, trees;
  `square [42,33]`, `fountain_n [42,26]`, `fountain_w [39,29]`, `fountain_e [45,29]`, `square_w [30,29]`,
  `square_e [54,30]`; **quest board** (2x1 at [46,25], interact `['dialogue','quest_board']` at `quest_board [46,26]`);
  market stalls along the south side, keepers stand at `stall_1 [30,35]`, `stall_2 [34,35]`, `stall_3 [51,35]`.
- **West Road** (y 28..30) to the forest gate: general store (`general_door [21,28]`), houses, orchard to the NW
  (`orchard [8,9]`, homes 1-2 on the north lane `north_lane [12,17]`). Gate arch (vertical) at x 1;
  `gate_forest [5,29]`; exit `exit_forest [0,29]` (1x3) → forest `entry_town`, `if forest_open`,
  locked "Mr. Laporte said to enroll first."; `guard_post_2 [5,31]`.
- **East Road** (y 28..30): outfitter (`outfitter_door [60,28]`), bridge over the river (x 66..68), `east_road
  [72,29]`, Peaks Road north to `gate_peaks [77,5]` / `exit_peaks [77,0]` (sealed) past a watchtower
  (`watchtower [73,11]`) and pines; `gate_dunes [78,29]` / `exit_dunes [83,29]` (sealed).
- **River** from the north edge (x 66..68) into the **park pond** in the east (pond center ~[74,47]); park with a
  path loop, hedge arch entrance, statue, lamps, blossom trees: `park [74,37]`, benches `bench_1 [74,38]` (north),
  `bench_2 [63,41]` (west bank), `bench_3 [80,46]` (east), `bench_4 [78,52]` (south), `pond_n [74,41]`,
  `pond_s [75,53]`; footbridges from Market Lane (y 46..48) and South Lane (y 56..57); allotments SE
  (`allotment [77,59]`).
- **Main Street** (cobble x 40..44, tree- and lamp-lined) south to the closed south gate: `main_street [42,50]`,
  `gate_south [42,62]`, exit `exit_south [42,67]` → intro `exit_town`, sealed ("The road south is closed...");
  guardhouse (`guardhouse [48,62]`), `guard_post_1 [39,60]`, `guard_post_3 [37,22]` (foot of the stair).
- **Residential lanes** (doors face south onto them): Well Lane y 37..38 (`home_11 [16,37]`, `home_12 [24,37]`,
  `well [36,41]`), Market Lane y 46..48 (`home_3 [15,46]`, `home_4 [28,46]`, `home_5 [51,46]`, `home_6 [58,46]`,
  `market_lane_w [20,47]`, `market_lane_e [60,47]`), South Lane y 56..57 (`home_7 [17,56]`, `home_8 [28,56]`,
  `home_9 [52,56]`, `home_10 [57,56]`, `south_lane [36,57]`), Wall Lane y 63..64 (more houses), Cove Road
  (`cove_road [8,54]`) to `gate_cove [8,62]` / `exit_cove [8,67]` (sealed; fishers' crates and barrels).
  `home_1 [7,16]`, `home_2 [16,16]`. `home_*` markers are the door steps.
- Sealed gates (`if: [['flag','next_term']]`), each with its own toast: dunes (sneezing sand), cove (gatekeeper gone
  fishing), peaks (bring a scarf), aether (portal hums politely), south (road closed). Signposts with `['toast']`
  texts by every gate and in the square.

### academy: Flinkerton Academy (46 x 36), palette `academy`, entry `entrance`

Walls are `wall` tiles; doorways are 2-4 tile gaps.
Foyer (stone, carpet runner, founder statues, signpost): `entrance [22,31]`, `foyer [22,29]`; front door exit
`academy_exit [22,35]` (3x1) → town `academy_door`. Grand hall (x 14..31, y 10..26; stone, carpet runner, dais
y 10..12 with banners, pillars, two long tables each side): `hall [22,19]`, `hall_laporte [22,11]` (on the dais),
`hall_player [22,14]` (in front of him), classmates `classmate_1 [18,13]`, `classmate_2 [26,13]`,
`classmate_3 [24,15]`. Headmaster's office north (planks, rug, desk, shelves): `headmaster [22,2]` (behind his
desk), `office_visitor [22,5]`. West wing: infirmary (5 beds along the north wall) `infirmary [6,9]`,
`infirmary_bed [2,4]` (beside the first bed); library nook (shelves, reading tables) `library_nook [6,21]`; common
room `lounge_1 [5,32]`, `lounge_2 [10,30]`, `lounge_3 [7,34]`. East wing: classroom 1 (chalkboard, teacher desk with
interact `['lesson','lesson_1']` at [41,3], 4 desks) `classroom_1 [37,10]`, `teach_1 [38,3]`; classroom 2 the same
with `lesson_2` (desk [41,15]) `classroom_2 [37,22]`, `teach_2 [38,15]`; open-air training yard (grass, sand ring,
hedges) via the foyer's east door: `yard [37,29]`, `dummy_1 [35,27]`, `dummy_2 [41,27]`, `dummy_3 [35,31]`,
`dummy_4 [41,31]`, one `training_dummy` spawn on each (`n: 1, respawn: 3`).

### forest: Whisperwood (96 x 96, macro 24 x 24, cell 4), palette `forest`, entry `entry_town`

Path from the east edge (`exit_east [95,50]`, 1x3 → town `gate_forest`; `entry_town [90,50]`, `ranger_post
[86,50]`) to the **ranger camp** (tents, campfire, logs, sign): `ranger_camp [76,50]`, `camp_fire [75,48]`,
`respawn [79,50]`. Babble Brook runs north-south through the middle (x ~52..55) and blocks except at three fords
(y ~16-19, 48-51, 76-79). From the camp: north path to the **glade** (NE, sporecaps, giant mushrooms) `glade [70,16]`,
`glade_edge [60,22]`; west path over the middle ford `brook [53,50]` into the west-bank woods (thornlings),
`chest_1 [40,62]`; across the north ford to the **hollow** (N, dirt and rocks, bats) `hollow [42,18]`,
`chest_2 [43,11]` (rune), `brook_north [55,17]`; south through slime woods to the **meadow** (S, boars)
`meadow [66,76]`, `meadow_south [70,83]`; over the south ford west to the **goblin camp** (SW, tents, campfire,
"KEEP OWT" sign) `goblin_camp [18,75]`, `chest_3 [6,74]`; north to the **wisp pond** (W) `wisp_pond [22,54]`,
`pond_north [14,46]`, `chest_4 [6,50]` (rune). North of the pond a cliff wall with one 3-wide cut: `grove_gate
[16,41]` (gate `grove_seal`, 3x1, question difficulty 2; seals `grove`, `boss_arena`) → the **grove** (blossoms,
pink crystals, saplings) `grove [16,33]` → the **boss arena** (clear disc r ~10 with mossy flagstone center and a
ring of standing stones/crystals, open to the south) `boss_arena [16,15]`, `boss_spawn [16,10]`.
Spawns: slime L3 x5 [70,58,20,8], sporecap L4 x4 [62,9,18,13], thornling L5 x4 [37,36,14,26], bat L5 x5
[37,8,13,20], boar L6 x3 [57,70,22,16], goblin_scout L7 x4 [7,69,22,14], wisp L8 x3 [5,45,22,16],
treant_sapling L9 x3 [6,29,22,8] (if not defeated), old_mossback L10 x1 at `boss_spawn` 3x3. Worst case 18 spawned
enemies inside one 30-tile bubble.
**Boss mechanism**: Old Mossback is an ordinary `spawns` entry (`n: 1, respawn: 0, boss: true,
if: not mossback_defeated`), present whenever the zone loads undefeated, asleep until the player is near. The
trigger `boss_intro` [8,22,17,3] (arena mouth, `once`, if not `mossback_defeated`) runs cutscene
`forest_boss_intro`, which should address him as `'@boss'` (enemy def tag) and hand control back.
Chests: `chest_1` forest_small, `chest_2` forest_rune (rune), `chest_3` forest_small, `chest_4` forest_rune (rune).

### test (40 x 30)

Unchanged rows. Added `dummy_ring [34,24]` (open center for a ring of dummies, radius <= 3) and `gallery_row [21,13]`
(west end of a clear east-west row x 21..38 at y 13). `pond [31,6]` is a free marker (in the water).

## Requests to other packages

- **Sim (world)**: use `furnitureRect` for exits/gates/spawns/triggers (centered `{at, w, h}`, or `area`); evaluate
  spawn `if` on load (and on `'flag'`); spawn `at` + `w, h`; gate seal footprint from `w, h`; prop interacts: create
  an interact point at `interact.at` (else door step / adjacent tile), `range` ~1.3; use
  `resolvePalette(def.palette)`; merge generated deco props (`g.props`) as the stub does. Exits toast `locked`
  at most once per 3 s (the player can bump sealed gates).
- **Render 2D/3D**: footprint orientation rule (long axis) for `gate_arch`, `bridge`, `rune_gate`; `door` offset for
  buildings; `look.variant` per variant; new footprints (shop 5x4, library 6x4, academy 18x9, gate_arch 5x1 with
  pillars on the end columns). Forest has ~570 deco props (mostly 1x1 trees/bushes/flowers); intro ~110, town ~90.
- **Narrative/Story**: dialogue ids referenced by the town: `quest_board`, `cafe_door`, `library_door`; cutscene ids
  in triggers: `intro_wake`, `ambush`, `forest_boss_intro`; lesson ids `lesson_1`, `lesson_2` on the classroom
  desks. Zone `npcs` lists are left empty (NPC home zones come from each npc's `zone`); extra markers above are free
  to use for routines.
- **Meta**: respawn markers: intro `respawn`, forest `respawn` (camp), academy `infirmary`/`infirmary_bed`.

## Known gaps

- Spawns and NPC `if` re-evaluation, prop interact points and exit rect semantics depend on Sim adopting the notes
  above; the stub world ignores exits/spawns/triggers.
- The validator only warns (does not fail) when an enemy id is missing from `data.enemies` or a dialogue id is not
  defined yet (Narrative is filling those in parallel).
- Region borders in the forest still show the 4-tile cell grid at full-map scale (organic within about +-1 tile
  plus fringe trees); at play zoom they read as natural.
