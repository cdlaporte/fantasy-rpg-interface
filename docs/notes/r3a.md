# Round 3, package A: levels 13-20

Branch `wp/r3a`. Cap 20 everywhere, boons at 4..20, rank V at 16 for all nine subclasses, an "empowered" aura at 14,
27 new boons, the balance continued to level 20. Tests: `node --test tests/node` (all 484 pass here). New:
`r3a-progression`, `r3a-ranks`, `r3a-boons` (+ helper `r3a-lib.mjs`); extended: `kit-*-dps`, `r2c-balance` (e)/(f).

## What changed, file by file

- `src/core/progression.js`: `BOON_LEVELS` 4..20, `EMPOWER_LEVEL` 14, `LEVEL_CAP` 20 fallback (config wins; saves
  clamp to it), `XP_LATE` (xp multiplier from level 11, below), `LATE_TOUGHNESS` (+0.3 defense per level above 12),
  `brighten()`. Crossing 14 refreshes the look, fires `pillar` + `shockwave` + `sparkle`, toast "Your aura blazes
  brighter! (Empowered)" and emits `'aura:empowered' {level}`. A `'look:changed'` listener makes the player's aura
  `tier: 2`, `empowered: true`, 35% brighter and gives a glow-less weapon the aura color (works on the Sim's
  `refreshLook` and the local fallback; idempotent). `update` emits a small `sparkle` in the aura color every 1.1 s at 14+.
- `src/core/kits/*`: rank V for every subclass (below), the new boons, `Math.min(4, r)` clamps removed (rank names
  come from data `ranks[5]`), balance hooks: warrior `lateMul` (spec `balance.dmgMul`, applied in `onOutgoing`), rogue
  `dmgScale` x spec `kit.lateScale`, mage spec `balance.dmgMul` tables extended to 20. `rogue.js` `afterBasic` calls a
  per-layer `onBasic(game, p, angle, n)` (Thief Coin Storm); `spendPips` triggers Adrenaline Rush at 5 pips.
- `src/data/specs/*.js`: `ranks[5]` names/descs, rank V numbers (`twinWave`, `splitAxe`, `wave5`, `chain`, `triple`,
  `dragon`, `burnTrail`, `coinStorm`, `shurikenV`), spec boon numbers, the balance tables.
- `src/data/boondefs/*.js` (+ `classdefs/mage.js` numbers): 27 boons, one line each.
- `docs/CLASSES.md`: timeline to 20, rank V per subclass, the new boons, the balance sheet past 12.
- Tests: the prep-broken `meta-progression` "level up ... cap" and `r2a-progression` "level down" fixed (cap 20, rank 5);
  `meta-progression` xp-curve and boon-offer tests follow the late curve and the 6-boon spec pools; kit data tests count
  11 + 6 boons; DPS loadouts extended to 9 boons (mage DPS keeps its "no boons" rig, as in round 1/2).

## Rank V (level 16)

| subclass | name | what changes (fx) |
| --- | --- | --- |
| Knight | Twin Dawn | 3rd cleave: two size-1.9 `crescent`s side by side + a gold ground `wave`, 150-deg `slash`, `ring` |
| Berserker | Splitting Axes | axe every 3rd chop (size 1.6); first hit splits into 3 small `axe`s (`burst`, `slash` axe) |
| Battlemage | Rune Tempest | size-1.9 waves carry current + previous element (color + glow), both applied; 2nd-color `slash` |
| Conjurer | Spirit Chain | bigger white-cored spirit bolt; its hit chains teal `bolt`s to 2 more enemies and marks them |
| Sorcerer | Triple Lance | full charge: 3 Arc Lances in a 28-deg fan (sides 60%), storm `shockwave`, more shake |
| Monk | Dragon Fist | uppercut launches a size-2.4 ki `wave` head + a zigzag tail of 4 gold/jade `orb`s |
| Archer | Burning Shot | full Power Shot: bigger orange arrow, `ground_fire` zones every 1.3 tiles along its flight |
| Thief | Coin Storm | every 3rd attack flings 5 returning `coin`s; Jackpot throws twice the coins |
| Ninja | Shuriken Halo | every 3rd throw: a ring of 10 returning shuriken (`slash` spin, red `ring`); clones copy it |

## New boons (desc in data; behaviour + fx in CLASSES.md)

Warrior: Thunder Clap, Juggernaut, War Banner. Knight: Hallowed Ground, Judgement. Berserker: Rampage, Whirling Axes.
Battlemage: Trinity Slash, Elemental Crown. Mage: Arcane Chain, Comet Nova, Mana Shield. Conjurer: Wild Hunt, Spirit
Totem. Sorcerer: Living Bomb, Phoenix. Monk: Palm Echo, Jade Lotus. Rogue: Toxic Fan, Backflip Knives, Adrenaline
Rush. Archer: Ricochet Arrows (bounce at half damage), Explosive Arrow. Thief: Golden Touch, Sleight of Hand. Ninja:
Kunai Fan, Smoke Screen. Pools: 11 per class, 6 per subclass, so every pick through 20 offers 3 (tested for all nine
subclasses and an unspecialized hero).

## Balance (measured, x1 numbers; tests use x6)

Targets continue the round 2 band at a constant time to kill, `62 x (L/12)^1.4`: **L14 77, L16 93, L18 109, L20 127**.
Mean of 8 seeds in each family's mixed-fight rig (ratio to target):

| | L12 | L14 | L16 | L18 | L20 |
| --- | --- | --- | --- | --- | --- |
| Knight | 63.2 | 77.1 (1.00) | 90.3 (0.97) | 104.7 (0.96) | 123.1 (0.97) |
| Berserker | 57.0 | 73.9 (0.96) | 85.3 (0.92) | 111.4 (1.02) | 123.2 (0.97) |
| Battlemage | 65.7 | 78.6 (1.02) | 91.9 (0.99) | 107.0 (0.98) | 124.5 (0.98) |
| Conjurer | 64.9 | 79.6 (1.03) | 95.1 (1.02) | 112.1 (1.03) | 126.8 (1.00) |
| Sorcerer | 62.5 | 72.6 (0.94) | 91.6 (0.99) | 106.1 (0.97) | 122.3 (0.96) |
| Monk | 68.4 | 77.0 (1.00) | 91.2 (0.98) | 109.1 (1.00) | 124.7 (0.98) |
| Archer | 64.0 | 73.9 (0.96) | 91.3 (0.98) | 111.3 (1.02) | 127.9 (1.01) |
| Thief | 67.0 | 76.8 (1.00) | 89.7 (0.96) | 103.5 (0.95) | 135.1 (1.06) |
| Ninja | 66.3 | 75.6 (0.98) | 91.0 (0.98) | 104.6 (0.96) | 125.8 (0.99) |

Knobs (linear between points, 1 at 12): warrior `balance.dmgMul` knight 1.05/1.02/1.04/1.12, berserker
1.15/1.12/1.12/1.03, battlemage 0.97/0.94/0.92/0.95; mage `balance.dmgMul` conjurer .52/.58/.60/.676, sorcerer
.285/.32/.335/.355, monk .33/.277/.306/.317; rogue `lateScale` archer .77/.79/.86/.855, thief 1/.9/.89/.925, ninja
.93/1/1/.97. DPS rises every level in between (checked 13-20).

**Level 18 vs level 18 feels like the forest at level 8** (`r2c-balance` (e), expert fighter, goblin scout of the
level): time to kill knight 6.1 -> 7.4 s, sorcerer 2.7 -> 4.1 s, archer 1.9 -> 1.9 s. Hits to down were 15% lower at 18
(enemy hits grow `2 + 1.5L`, class hp a fixed amount per level), so the hero now gains **+0.3 defense per level above
12** (shown in the HUD shield stat): knight 11.5 / 11.6, sorcerer 5.1 / 5.1, archer 6.8 / 6.8 hits at L8 / L18.
Enemy curves untouched.

## XP: the curve changed past level 10 (biome packages, please read)

Kill xp scales with the player in the biomes (`scaleToPlayer`), so with the round 2 curve one biome gave ~5 levels.
`xpNext(l) = round(15 l^1.5 x m)`, `m = 1` up to 10, `m = 2 + 0.3 (l - 11)` from 11 (`XP_LATE` in progression.js;
a `config.xpCurve.late` would override it). Levels 1-10 and every round 2 milestone are unchanged.

| level | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| xpNext | 474 | 1094 | 1434 | 1828 | 2279 | 2789 | 3360 | 3995 | 4697 | 5466 |
| kill xp (5+3L)x1.3 | 46 | 49 | 53 | 57 | 61 | 65 | 69 | 73 | 77 | 81 |

Expected levels (`r2c-balance` (f): per biome 30 kills at the player's level, 2 elites x3, the boss x20 at +1 level,
2.5 quests at 40% of a level; start after Mossback): **11.5 -> dunes 14.5 -> cove 16.7 -> peaks 18.7 -> aether 20**
(order-independent, since biomes scale to the player). **Quest rewards in the biomes should be ~40% of the xpNext above
at the player's expected level** (e.g. ~900 xp around 14, ~1300 at 16, ~1900 at 18); with the old curve's sizes
(~300-450) the hero ends near 18.5 instead of 20.

## For other packages

- **B (renderers)**: `look.aura.tier === 2` (also `empowered: true`) from level 14: please draw it larger/stronger
  (e.g. 1.3x size, a second ring); today only the brighter color, the weapon glow and kit sparks show it. New effect
  entities: kind `war_banner` and `spirit_totem` (`{rig:'effect', model:'totem', color, r: 0.5}`, ~6 s); summon
  `ghost_wolf` (quadruped, `tail_bushy ears_pointy mane`, white/teal, `alpha 0.8`, `glow`). Projectile sizes now reach
  2.4 (`wave`), 1.9 (`crescent`), 1.6 (`axe`); `kunai` and `coin` models are used by the Ninja/Thief boons.
- **Biomes (C-F)**: boss timing at "top-of-range minus 1" should be measured on this branch's hero (rank V, boons,
  toughness). Quest xp: see the table above.
- **G / lead**: the pause menu's Teacher tools box overflows a 1000 px-wide window on the right (20 level buttons fit;
  the 14 "Go to" places push the width) — `src/ui/teacher.js` / `css/menus.css` are not mine.
- The HUD (rank pips, xp bar, level), saves and the teacher tools needed no code change for 20 (they read
  `config.levelCap` / `rank()`); verified in tests and a 3D screenshot.

## Known gaps

- The mage DPS rig plays without boons (as before), so mage boons are balanced only by the per-boon tests, not by DPS.
- `progression.DEFAULT_BOONS` (the built-in fallback pool) does not list the 27 new boons; data is the source.
- Visuals checked in 3D screenshots (rank V of all nine subclasses, the level 13 vs 14 aura); the empowered aura is
  subtle until B draws `tier: 2`. 2D renderer not checked.
