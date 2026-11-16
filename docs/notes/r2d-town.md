# Round 2, package D: town and buildings (notes)

Owner files: `src/data/zones/town.js`, `src/data/props.js`, `src/render/r3d/props.js`, `src/render/r2d/props.js`, this file.
`src/data/npcs/town.js` and `tools/validate-data.mjs` are unchanged (no required marker was renamed).

## What changed

- **`src/data/zones/town.js`**: Flinkerton redrawn at **60 x 48** (was 84 x 68), organic instead of a grid. Drafted with
  a scratch painter (discs, thick polylines with stair-stepped diagonals); the ASCII rows are the source of truth, edit
  them directly. Props are grouped with `//` section comments.
- **`src/data/props.js`**: new building defs with `look.style` and their own footprints; `shop_*` defs re-shaped;
  a few new furniture ids (all on existing models, no new model names):
  - houses: `house_cottage`, `house_cottage_rose` (3x3, cottage), `house_townhouse`, `house_townhouse_mint` (4x3,
    townhouse), `house_tower`, `house_tower_teal` (3x3, tower_house), `house_mushroom`, `house_mushroom_blue` (3x3,
    mushroom), `windmill` (3x3), `greenhouse` (5x3).
  - shops: `shop_bakery` 4x4 bakery, `shop_library` 6x5 library, `shop_potions` 3x4 potion, `shop_outfitter` 4x4
    outfitter, `shop_cafe` 5x4 cafe, `shop_general` 5x4 general, `shop_guard` 4x3 guardhouse. `door` columns changed
    accordingly (interacts carry `at` = the `*_door` markers).
  - `tower_clock` (tower model, `style: 'clock'`), `bridge_arch` (bridge 3x4, `style: 'arch'`, stone), `table_umbrella`,
    `table_umbrella_teal` (table + `look.umbrella/umbrella2`), `bench_seat` (bench, **not solid**, so a routine marker can
    sit on it).
  - Untouched: the generic `house`, `house_blue|green|plum|wide`, `shop`, `tower`, `tower_watch`, everything else.
- **`src/render/r3d/props.js`**:
  - One toy-box builder per style (`STYLES`, `STYLE_FNS`; `STYLE_HEIGHT` documents top heights): cottage (whitewash,
    set-back rounded thatch, eyebrow dormer, roses), townhouse (stone ground floor, jettied timber-frame upper floor,
    braces, steep gable, dormer, lantern), tower_house (round, balcony ring, bent cone roof, pennant, pantry annex),
    mushroom (bulging stem, spotted cap, round door/windows, stovepipe, baby mushrooms), windmill (tapered tower, cap,
    four angled sails, flour sacks; static: there is no rotating-part mechanism in the chunk renderer), greenhouse
    (brick base, tinted glass box + barrel vault, white ribs, plants against the glass), bakery (striped awning, bread
    window, round brick oven with a tall round chimney), library (columned portico, pediment, drum + ribbed dome, gold
    lantern), potion (three crooked stacked drums, bent witch-hat roof, porch, bottles, cauldron chimney with bubbles +
    lilac smoke), outfitter (mansard, dormers, bay window with a dress form, big wizard-hat sign on the roof), cafe
    (awning, menu board, plank terrace with planters and two umbrella tables), general (clapboard false front, porch,
    lean-to with crates/barrels/sacks, broom), guardhouse (crenellations, corner turret + flag, slits, shield, spear
    rack), clock (square tower, three clock faces, belfry with bell, pyramid roof), arch (humped stone bridge, parapets,
    lantern posts). Doors sit at the def's `door` column on the south face (builders get `dx`).
  - `buildProp` dispatches on `look.style` for `house | shop | tower | bridge`; an unknown style falls back to the generic
    model and is reported in `stats().unknown` as `style:<name>`.
  - **`gate_arch` now honours the long-axis rule** (the 1x5 `gate_arch_v_*` were drawn as a thin 1-wide sliver); the
    aether arch (variant 5) gets a shimmering membrane + rune/crystal emitters.
  - The quest board (`sign` variant 1, 2 wide) is a roofed notice board with pinned notes; tables can carry an umbrella.
  - Triangle trims that also help the forest: flowerbeds (lineless low-poly heads), trees (one ico main blob + cheap
    round side blobs, no root disc), bushes, benches/chairs/tables/signs (boxes instead of rounded boxes), barrels,
    stalls, statues; windows, doors, hanging signs and flower boxes are lineless details.
- **`src/render/r2d/props.js`**: a simple, distinct 2D painter for every style (`styled()`, per-style headroom), the
  arch bridge, umbrella tables; buildings draw their door at the def's `door` column; `propUnknown` reports
  `prop.style:<name>`.

## The map (tile coords; markers are tile centers)

North: the Academy (`academy` 18x9 at [21,2]) on its stone terrace (rows 1-12) behind a cliff edge (rows 13-14), a
broad 9-wide stair (x 26-34) down into the plaza. `academy_enter [30,11]` (exit 3x1), `stair_top [30,13]`,
`academy_door [30,16]` (foot of the stair). Terrace: flower gardens, founder statues, banners, gold lamps, the
**greenhouse** (NE, [40,3]) and the **Aether portal** (NW: rune floor, `gate_arch_aether` at [14,1] on crystal pillars,
`gate_aether [16,3]`, `exit_aether [16,0]`).

Plaza (round, cobbled, centre ~[30,21]): fountain [29,20], quest board [33,23] (`quest_board [33,24]`), market
stalls (`stall_1 [23,25]`, `stall_2 [26,28]`, `stall_3 [35,30]`), clock tower [35,15], benches, planters, lamps.
Around it: bakery [20,15] (`bakery_door [21,19]`), potion tower [15,15] (`potion_door [16,19]`), library [38,15]
(`library_door [41,20]`), cafe [38,22] (`cafe_door [39,26]`) with an umbrella terrace on the plaza
(`cafe_seat_1..4` on chairs at [35,22] [37,22] [35,24] [37,24]). `square [30,25]`, `guard_post_3 [27,17]`.

West road (jogs north at the general store) to the forest gate: general store [3,16] (`general_door [5,20]`),
`gate_arch_v_forest` at [1,20], `gate_forest [4,22]`, `exit_forest [0,22]` (1x3), `guard_post_2 [6,23]`.
NW cottage quarter on a winding lane: `home_1 [10,14]` (cottage), `home_2 [10,8]` (tower house), `home_3 [3,13]`
(mushroom), orchard. Well Lane along the canal: `home_11 [4,27]`, `home_12 [13,27]`, a little well square
(`well [16,27]`).

East road to the dunes gate: outfitter [45,23] (`outfitter_door [46,27]`), `home_9 [46,20]` (tower house),
`gate_arch_v_dunes` at [58,26], `gate_dunes [55,28]`, `exit_dunes [59,28]`. NE hill: the Peaks road winds up past
the **windmill** ([54,7], `windmill [55,10]`) and a hill cottage (`home_14 [56,19]`), pines, a cart:
`gate_peaks [53,3]`, `exit_peaks [53,0]`.

The canal runs from the west edge (rows 29-32) east along row 33-34 between stone quays into the park pond; two
humped stone bridges: `bridge_west` [18,32] (x 18-20, `canal_w [18,30]`) and `bridge_high` [31,32] on the high
street (`canal_e [32,30]`).

South of the canal: the high street bends south-west to the south gate (`gate_south [26,44]`, arch on brick stubs at
[24,46], `exit_south [26,47]`), guardhouse [29,42], `guard_post_1 [28,44]`; lanes to the cove gate (SW,
`gate_cove [8,44]`, `exit_cove [8,47]`) past `home_5 [14,39]`, `home_4 [23,39]`, `home_13 [27,39]`, the allotment
(`allotment [6,41]`) and a fisher's cottage (`home_15 [3,45]`); SE lane to the park: `home_8 [35,39]`,
`home_7 [35,45]`, `home_10 [43,32]`, `home_6 [54,33]`. Park: pond with shallows, path loop, benches with
`bench_1 [47,33]` (N), `bench_2 [40,38]` (W), `bench_3 [56,39]` (E), `bench_4 [44,45]` (S) **on** non-solid
`bench_seat` props, `park [42,41]`.

Border: a one-tile ring (cliff banks with tree clumps; trees along the north) - the 3D renderer already draws a
forest canopy beyond the map edge. Every home door has a short path stub to its lane.

Removed old extra markers that nothing referenced (`fountain_n/e/w`, `square_w/e`, `terrace_w/e`, `main_street`,
`market_lane_w/e`, `west_road`, `east_road`, `orchard`, `pond_n/s`, `watchtower`, `guardhouse`, `cove_road`,
`north_lane`, `south_lane`).

## Checks

- `node tools/validate-data.mjs`: ok, 0 warnings (town 169 props + ~20 deco).
- NPC routines: unchanged; every consecutive routine pair is found by the game's A* (400 nodes) directly except one
  long one (cafe_door -> home_2) that needs a single replan.
- Bot test: town_arrival escort gate_south -> square -> academy_door takes ~14 s of sim time; academy -> Mira ->
  west gate ~12 s.
- `node --test tests/node`: all pass except the 5 failures ROUND2.md assigns to A (3 progression), B (lesson op) and
  C (kit-mage-dps).
- 3D, 1086x657, play zoom (`stats().tris` incl. NPCs): plaza/cafe/market views 110-128k depending on how many NPCs
  stand in view (8:00, up to ~14); without NPCs 88-108k everywhere; south gate ~90k, park ~84k, cottages ~72k.
  Draws 25-46. Zone chunk tris ~98k (was ~213k for the old town).

## For other packages

- **E (3D renderer)**: (1) chunk culling draws every chunk north of the camera (three's bounding-sphere test against
  the frustum's upper part, which reaches far behind the visible top edge): in this 4x3-chunk town a central view draws
  8-9 of 12 chunks. Culling chunks by `viewRect()` against the chunk's ground rect (+ ~3 tiles for tall props) would
  roughly halve town triangles. (2) In this worktree (base commit) all water (canal, pond, forest brook) renders as the
  dark bed with no surface; I assume that is the water bug on your list - the canal and pond will look right with your
  fix. (3) A rotating-part emitter would let the windmill sails turn (they are static now).
- **Lead**: `docs/notes/world.md` "town" section describes the old 84x68 map; this file has the new one.
  Final shots (gitignored): `tests/e2e/out/r2d-town-{overview,square,steps,bridge,cafe,cottages,gate-south,2d-styles}.png`,
  map preview `tests/e2e/out/map-town.png` (`node tools/map-preview.mjs town`).

## Known gaps

- The broad stair is cobble tiles between the cliff walls (reads as a ramp, no step lines).
- Windmill sails do not turn (see E request).
- Busiest plaza views can exceed 120k triangles by a few k when more than ~11 NPCs are on screen.
