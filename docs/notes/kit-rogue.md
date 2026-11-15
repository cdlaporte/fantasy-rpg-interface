# Rogue class kits (Rogue, Archer, Thief, Ninja)

Owner files: `src/core/kits/{rogue,archer,thief,ninja}.js`, `src/data/classdefs/rogue.js`, `src/data/specs/rogue.js`,
`src/data/boondefs/rogue.js`, `tests/node/kit-rogue*.test.mjs`, this file.

Run: `node --test tests/node/kit-rogue.test.mjs tests/node/kit-rogue-boons.test.mjs tests/node/kit-rogue-dps.test.mjs`
(62 tests, about 25 s; the DPS table prints as test diagnostics).

## What each kit does

- **Rogue** (`rogue.js`, the class layer, always active). Combo pips 0-5 (`kitHud.pips`): +1 per basic attack that
  lands, finishers spend them all, reset after 6 s without a hit. Twin Daggers (auto, 0.24 s, two crossing dagger
  slashes) with the Lunge every third attack from rank II. Dodge Roll: 3-tile invulnerable dash, then the next basic
  within 1.5 s is a sure crit (blades glow). Fan of Knives: `3 + 2 x pips` knives, 60 degrees widening to a full ring.
  All 8 class boons. It also exports the helpers the specs use (pips, crit window, volleys, enemy-only zones).
- **Archer** (`archer.js`): the sniper. Raw basic: tap = quick arrow, hold = draw (slowed, fxTag `charge`, glow,
  sparkle at full) and release a piercing Power Shot (coef 1.2 -> 3.0). Eagle Eye: +0..60% damage by distance, +1 pip
  per basic hit from 5+ tiles. Rank IV: arrows in pairs, full draws burst into splinters. Arrow Rain (F finisher): a
  zone 5 tiles ahead whose arrows visibly fall. Starfall Arrow (Shift): 0.6 s draw, a giant arrow across the view that
  drags small enemies and explodes (meteor) on the wall. Boons: Split Arrow, Pinning Shot, Rain of Fire, Hawk.
- **Thief** (`thief.js`): the trickster. Uses the class daggers (spec coef 0.6). Sticky Fingers: 35% of hits shake 1-3
  coins out (capped per enemy; dummies and summons give nothing), defeats drop x1.5 gold (`p.data.goldMul`).
  Backstab: from behind (angle rule from sim notes) or from stealth = crit x3. Pickpocket: while stealthed, town NPCs
  within 3 tiles show "Pickpocket" (E): gold or an item, 25% noticed -> `'crime'` + wanted. Jackpot (rank IV): a
  backstab bursts coins at nearby enemies that fly back. Smoke Vanish (F): smoke + caltrops + 5 s stealth (+25%
  speed), the first strike from stealth is a Backstab and +2 pips. Grand Heist (Shift finisher): teleport-strike
  behind up to 6 enemies, marking and robbing each, then back to the start. Boons: Coin Toss, Vanishing Act, Loaded
  Dice, Caltrop Trail (the roll part lives in `rogue.js`).
- **Ninja** (`ninja.js`): the misdirection artist. Afterimages while moving; the first attack within 1 s of a roll,
  step or substitution crits. Shuriken (auto, 0.3 s): 3 returning shuriken (5 with a bounce at rank IV), each catch
  cuts 0.3 s off Shadow Step. Shadow Step (F): appear behind the nearest enemy (or 4 tiles ahead), a taunting decoy
  stays behind and bursts in smoke after 2.5 s, +2 pips. Shadow Clones (Shift finisher): 2 clones (3 at full pips) for
  8 s that copy every throw at 60%. Boons: Explosive Tags, Blade Storm, Substitution, Clone Mastery.

## Measured DPS (mixed fight, `kit-rogue-dps.test.mjs`)

One elite rat (x2.5 hp) + four normal rats of the level, all fighting back; scripted play (weakest first, lines up on
an axis for the 4-way attacks, keeps the kit's range: melee 0.7, Ninja 3.5, Archer 6; steps out of telegraphed bites;
uses every ability when sensible; full draws on the tough one); boons picked per level (table in the test); mean of
8 seeds; DPS = enemy hp removed / fight time.

| kit | L3 | L5 | L8 | L10 | L12 |
| --- | --- | --- | --- | --- | --- |
| Rogue (class) | 8.9 (89%) | 16.3 (96%) | - | - | - |
| Archer | - | - | 31.5 (105%) | 35.8 (89%) | 56.7 (109%) |
| Thief | - | - | 29.9 (100%) | 37.8 (94%) | 53.2 (102%) |
| Ninja | - | - | 31.5 (105%) | 38.8 (97%) | 57.8 (111%) |
| target | 10 | 17 | 30 | 40 | 52 |

**How it is tuned.** All coefficients in data are the CLASSES numbers; one knob per kit, `kit.dmgScale` (class 0.21,
Archer 0.42, Thief 0.27, Ninja 0.095), multiplies everything the kit and its hawk / clones / decoys deal (hooks
`onOutgoing` / `onMinionOutgoing` in `rogue.js`). Without it the CLASSES coefficients give 4-5x the band (Twin
Daggers alone are 4.6 coef/s = 38 DPS at level 3 vs a target of 10); the warrior and mage numbers are about 2x over
as well (see "requests" below). Other data changes made while tuning: Venom Edge (dps 0.12/stack, one stack per
target per 0.5 s, burst 0.6), Explosive Tags (r 2.5, x1.2, burn 0.2), Blade Storm (x0.4), Clone Mastery (0.6),
Jackpot (5 coins). L10 sits lowest for every spec because the band grows 1.33x from L8 to L10 while only power and a
boon change.

Two interpretation calls made for balance and readability: the two Twin Dagger slashes land as one combined hit per
target (coef 0.55 x 2, two slash fx, one number), and the shuriken of one volley share a hit list (each target is
cut once going out and once coming back, not three times each way).

## Requests and bugs for the integrator

1. **Sim: player-side zones hurt town NPCs (crime from a DoT).** `canHitTeam` lets any player-owned source hit town
   NPCs, not only direct hits as the notes say, so caltrops, rain or fire near a townsperson make you wanted.
   Repro: `const n = game.ents.create({type:'npc', team:'town', x: p.x+1, y: p.y, hp: 20, hpMax: 20, radius: 0.3,
   look:{rig:'humanoid'}}); game.combat.zone(p, {x: n.x, y: n.y, r: 1.5, dur: 2, dmg: 0.5}); step 60` -> `'crime'`
   fires and the NPC loses hp. Guard: rogue zones go through `enemyZone()` (damage and statuses only on
   `type === 'enemy'`).
2. **Sim/Story: `'crime'` is emitted twice per hit** (combat.js line ~329 and npc.js line ~335). Same repro: 2 ticks
   -> 4 crimes.
3. **Sim: damage floor `max(1, round(a))`.** With the band numbers small hits all become 1 and calibration gets
   coarse (the Ninja's shuriken mostly show 1-2). Request: carry the fractional remainder per source/target, or let
   the band be raised; this is the main feel cost of the balance sheet as written.
4. **Design/balance: CLASSES coefficients vs the DPS band disagree by 2-5x** for every class (see the tuning note).
   Either the band or the coefficients should change; until then each kit needs a scale knob like `dmgScale`.
5. **Meta: partial data replaces the defaults wholesale.** `classIds()` uses the keys of `data.classes`, `specIds()`
   the keys of `data.specs`, and a non-empty `data.boons` replaces `DEFAULT_BOONS`. In this worktree only the rogue
   files are filled, so 4 Meta tests fail here (`boon offers`, `boon picker`, `class, spec and look pickers`,
   `progression save/load`); verified: with warrior and mage data filled in (from the progression defaults, in a scratch copy) all four pass. Request: merge per id over
   the defaults.
6. **Sim: HUD ability `desc` fallback** reads `data.classes[c].abilities[ab.id]`, but Meta's shape is an array or
   slot-keyed object, so the fallback never finds anything. The rogue kits set `desc` on each ability (copied from
   data at import).
7. **Story: pickpocketing emits `'interact'`** (that is how the kit sees E), so quests listening to `'interact'`
   (quests.js line ~233) may count a pickpocket as talking to that NPC.

## Entities, fx and looks the renderers should know about

| what | kind / type | look | notes |
| --- | --- | --- | --- |
| falling Arrow Rain arrows | `falling_arrow` / effect | `{rig:'projectile', model:'arrow', color, glow:'#ffffff', size:0.9}` | `z` drops from 5-7 to 0 at 14 tiles/s, then fx `hit`; angle ~ pi/2 (pointing down) |
| Hawk (boon) | `hawk` / summon | `{rig:'flyer', size:0.55, features:['wings_bird']}` brown/cream | `data.noPhysics`, untargetable, `z` 1.6 circling, dives to 0.4 |
| Shadow Clone | `shadow_clone` / summon | clone of the player look + `aura {style:'shadow', color:'#6a5acd'}` | `alpha 0.6`, fxTag `shadow`, faces like the player |
| decoy | `decoy` / summon (Sim decoy) | clone of the player look | `alpha 0.85`, fxTag `shadow` |
| Substitution log | `decoy_puff` / effect | `{rig:'effect', model:'decoy_puff', color:'#c8a26a', r:0.5}` | ttl 0.8 |
| Blade Storm orbiters | projectile | shuriken look | `speed 0`, moved by the kit around the ninja |
| Power Shot | projectile | `arrow`, `size` 1.3-2.5 by draw, gold + white glow when full | |
| Starfall Arrow | projectile | `arrow`, size 3, color `#fff1a8`, glow white | |
| coins (Jackpot, Coin Toss) | projectile | `{model:'coin', color:'#f2c94c', glow:'#fff1a8'}` | |
| knives / boomerang | projectile | `knife` (boomerang: size 1.6) | |

fxTags used: `charge` (Archer draw, Starfall draw), `stealth` (status), `shadow` (decoys, clones, and the Ninja while
Substitution is ready), `venom` (Venom Edge status), `mark` (Grand Heist), `burn` (Rain of Fire, Explosive Tags).
Look patch: `p.data.kit.lookPatch = {held: {glow}}`, crit-ready `#b8ffcf`, full draw `#f2c94c`; `p.glow` while drawing.
fx: `slash` styles `dagger`, `spin` (Blade Flurry, 5-pip Fan), `crescent` (shuriken throw, boomerang), `claw` (hawk);
`screenFlash` on Starfall, Grand Heist, Shadow Clones; camera shake on full draws, 5-pip fans, ultimates.
kitHud labels: `Combo`, `Crit ready!`, `Blade Flurry!`, `Eagle Eye +N%`, `Drawing...`, `Full draw!`,
`Stealth: Backstab ready`, `Grand Heist!`, `Shuriken`, `Substitution ready`, `Shadow Clones`.

## Known gaps

- Damage numbers are small (see requests 3-4); the Ninja's mostly read 1-2.
- Pip (companion) uses generic ai attacks from `data.classes.rogue.companion`; boons do not affect Pip.
- Hawk and clones do not get Eagle Eye or Backstab; clone shuriken do not shorten Shadow Step.
- A rogue above level 8 who has not specialized keeps Twin Daggers / Lunge (no DPS row for it).
- Kit state is transient: after a load the combo, crit window, clones and hawk reset (the hawk comes back by itself).
