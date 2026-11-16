# Round 4, Rogue package: six tier-3 masteries

Branch `wp/r4rogue`. Only owned files changed (MASTERY.md "Ownership"); no subclass kit, no Core file was touched.

## Files

- `src/core/kits/{ranger,sharpshooter,trickster,swashbuckler,windwalker,smokestep}.js`: the six kits (passive,
  upgraded ultimate on `shift`, unlock 15). Each file's header comment documents the mechanics. Subclass abilities are
  wrapped (`Object.assign({}, PARENT, { cast(){ PARENT.cast(); ... } })`), never copied or edited. Kit state lives in
  `p.data.kit.<rn|ss|tr|sw|ww|sm>` (plain values + entity ids, so it saves as JSON).
- `src/data/specs/rogue.js`: six mastery entries `{id, from, tier: 3, name, blurb, color, mods, look, aura, passive,
  ultimate, descs?, kit}`. `kit` holds every number (`dmgScale`, `lateScale`, per-mechanic tables). `descs` holds the
  HUD text for subclass abilities the mastery changes (the kits read it). `mods.power`/`speed` stay 1: damage scaling
  is only in `kit.dmgScale x kit.lateScale` (linear by level), on top of the subclass scaling in `rogue.js`.
- `tests/node/r4-rogue.test.mjs` (data shape, equip 15-20 and lock at 14, each passive with vs without, each
  ultimate vs the subclass ultimate, 3000-step fuzz at level 18 with every boon, save/load mid-ultimate),
  `tests/node/r4-rogue-dps.test.mjs` (the DPS table), `tests/node/r4-rogue-lib.mjs` (shared rig).

## The masteries

| Mastery | Passive | Ultimate (H) |
| --- | --- | --- |
| Ranger (Archer) | Wild Companion: a wolf fights beside you (returns 8 s after it falls or a zone change), pounces on what you hit from 4.5+ tiles; Dodge Roll leaves a snare trap (root + damage). | Wild Hunt: a howl, three hawks dive for 6 s, a pack of four wolves charges in a line and fights on. |
| Sharpshooter (Archer) | Deadeye: laser sight while drawing (red, cyan at full draw); full-draw shots always crit (x2.4), fly 1.8x farther and 1.35x faster. | Rail Shot: 0.45 s charge, then a piercing lightning beam that ricochets four times (five beams) off walls/enemies. |
| Trickster (Thief) | Prank Chest: Smoke Vanish leaves a taunting fake chest; it bursts in confetti (damage, 1.2 s stun, knockback). | Magic Trick (finisher): swap places with up to six enemies, each dazed and showered in coins; ends in a coin ring and confetti. |
| Swashbuckler (Thief) | Parry & Riposte: Dodge Roll opens a 0.65 s parry window; a parried attack triggers a lunge riposte (x2.5 crit, stun, +2 pips), up to three per window. | Flourish (finisher): 2.2 s (+0.16 s/pip) rapier storm, half damage taken, ends with a "Touche!" blast. |
| Windwalker (Ninja) | Tailwind: +15% move speed; Dodge Roll and Shadow Step cut a wind blade along the path and fling three crescents. | Cyclone Clones (finisher): two tornado clones (three at full pips) roam for 7 s, pull enemies in and shred them. |
| Smokestep (Ninja) | Shadowmeld: Shadow Step adds 2 s of stealth, and the next hit within 2.5 s is an Assassinate (x3.5 crit). | Smoke Assassins (finisher): three untargetable assassins (four at full pips) teleport between enemies for 6 s. |

## DPS (`node --test tests/node/r4-rogue-dps.test.mjs`)

Mean DPS (rig units / 6) vs target; the target is the round-3 band +15%, interpolated by level (MASTERY.md's "~89"
is level 14 x 1.15; at 15 the interpolation gives ~97).

| Mastery | L15 | L16 | L18 | L20 |
| --- | --- | --- | --- | --- |
| ranger | 94.6 (97%) | 104.9 (98%) | 125.5 (100%) | 142.0 (97%) |
| sharpshooter | 103.6 (106%) | 103.4 (97%) | 127.1 (101%) | 143.9 (99%) |
| trickster | 100.6 (103%) | 113.9 (107%) | 126.1 (100%) | 145.2 (100%) |
| swashbuckler | 96.9 (99%) | 109.9 (103%) | 124.9 (99%) | 149.4 (102%) |
| windwalker | 95.7 (98%) | 107.9 (101%) | 124.7 (99%) | 142.2 (98%) |
| smokestep | 97.4 (100%) | 106.1 (100%) | 121.2 (96%) | 143.0 (98%) |
| target | 97.4 | 106.7 | 125.8 | 145.8 |

All within ±10% of target, so pairs and all six are well inside ±15%. The test fails outside ±15%.

## For Core / the lead

- **Look composition.** With a mastery, `p.data.specId` is the subclass, so `player.js` currently composes the
  subclass look only. Core should merge `specDef(masteryId).look` over it, and use `specDef(masteryId).aura` for the
  level-10+ aura (each mastery has a top-level `aura` equal to its `look.aura`, because `refreshLook` overwrites
  `look.aura` with `sd.aura`). The HUD title also still reads "Rogue · Archer"; Core may want the mastery name.
- **Equip API.** Tests equip through `progression.setMastery(id, {quiet: true})` or `debug.setMastery(id)` when present
  (feature-detected) and fall back to `game.kits.set(p, 'rogue', id)`. They do not depend on `__game.setMastery`.
- Summon kinds used: `ranger_wolf`, `ranger_hawk`, `hunt_wolf`, `cyclone_clone`, `smoke_assassin` (plus the `ranger_trap` zone and the `prank_chest` decoy); all
  render with existing look vocabulary (3D `renderStats().unknown` is empty).

## Verification

`node --test tests/node`: 535/535 pass. 3D screenshots of Rail Shot and Cyclone Clones (900x560, level 16): beams,
tornado clones and HUD render, no console or game errors.

## Known gaps

- Mastery outfits only show once Core composes them (see above); the screenshot rig previews them via `scriptLook`.
