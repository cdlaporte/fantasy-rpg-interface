# Round 4, package Mage: the six mage masteries

Summoner and Illusionist (Conjurer), Stormcaller and Pyromancer (Sorcerer), Sage and Mystic (Monk). Each one is a kit
layered over its subclass (`kits.set(p, 'mage', '<mastery>')`, docs/MASTERY.md), with a look patch, a passive and an
upgraded ultimate on H (unlock 15). Tests: `tests/node/r4-mage.test.mjs`, `tests/node/r4-mage-dps.test.mjs`
(helpers in `tests/node/r4-mage-lib.mjs`). `node --test tests/node`: 537/537 green in this worktree.

## Files

- `src/core/kits/{summoner,illusionist,stormcaller,pyromancer,sage,mystic}.js`: the kits (the header comment of each
  file describes it in full). Each applies its `look` as kit look patch `ms_look` on equip, and multiplies its own
  `balance.dmgMul` on outgoing and minion damage (`onOutgoing` / `onMinionOutgoing`). That multiplier comes ON TOP of
  the subclass table in `mage.js` `dmgMul`, because `p.data.specId` stays the subclass.
- `src/data/specs/mage.js`: six tier-3 entries (`from`, `tier: 3`, name, blurb, color, `mods` = the subclass's, look,
  passive, ultimate, `kit` numbers, `balance.dmgMul` 15-20). Nothing existing changed.
- No subclass kit or shared file was touched.

## The masteries

| Mastery | Look / color | Passive | Ultimate (H) |
| --- | --- | --- | --- |
| Summoner | emerald robe, crown, orb | **Legion**: F calls two familiars, up to 5 (6 with Pack Leader). A Phoenix familiar (fire `flyer`) comes first whenever you have none. At the cap, the oldest non-Phoenix familiar makes room. The Phoenix bursts when it falls and is reborn 5 s later | **Guardian Dragon** (cd 38): a giant emerald flyer drops in with a shockwave, flies to the densest crowd and breathes fire cones that leave burning ground (every 1 s, or 0.6 s with 6+ enemies around), familiars grow and gain haste, final dive. 10 s |
| Illusionist | rose robe, feather, wand | **Mirror Images**: every spell (and every 6th bolt) leaves a taunting see-through copy (max 3, 3.5 s). Copies mirror your Spirit Bolts and burst when they fade. Blink leaves the copy where you stood | **Hall of Mirrors** (cd 35): 6 copies in a ring, linked by mirror beams, all cast homing piercing bolts for 7 s (two each with 6+ enemies in range), then shatter |
| Stormcaller | sky-blue robe, wizard hat, staff | **Static**: Arc Lance and Fireball blasts chain white lightning, and every chain hit is a Static pip (max 5). A full meter makes the next charged shot call a sky-bolt volley | **Thunderstorm** (cd 40): the scene is tinted navy for 6 s. Every 0.24 s lightning strikes, one bolt per 3 enemies around (max 4), on the least recently struck enemies, with stun and chain |
| Pyromancer | orange robe, horned hat, staff | **Spreading Flames**: fire hits ignite, and burning jumps to the nearest unburnt enemy about twice a second | **Inferno** (cd 40): pillar + blast, a ring of 14 fire patches, 16 telegraphed fireballs on the enemies inside |
| Sage | mint gi, circlet | **Still Mind**: Ki fills fast and you regenerate while standing still. Palm Strike sends a lotus ring that heals classmates and summons | **Enlightenment** (cd 32): you float in a golden slow-time bubble for 6 s. Big heal for you and your friends, enemies and their shots crawl, calm pulses, faster fists |
| Mystic | violet gi, bandana | **Spirit Fists**: Palm Strike launches 3 homing spirit fists, sweeping kicks 1 | **Avatar** (cd 30): a giant see-through spirit copy of you (8 s) punches with every beat and slams on Palm Strikes. -30% damage taken, no knockback |

The ultimates were changed this session to scale with crowd size (Thunderstorm, the Hall copies, the dragon's
breath), so in a big fight they clearly beat the subclass ultimate (10 s, 12 dummies, damage: Dragon 7344 vs Grand
Conjuration 5960; Hall 6947 vs 5960; Thunderstorm 8037 vs Cataclysm 5586; Inferno 12714 vs 5586; Enlightenment 3072
vs Thousand Palms 1662 (+ the heal); Avatar 5104 vs 1662). Fx counts are 1.4 to 14 times higher. Small fights (the DPS
rig's 5 enemies) stay on budget.

## Balance (mixed fight, x1 numbers, mean of 12 seeds)

Target = round-3 curve x 1.15 = 62 x (L/12)^1.4 x 1.15: L15 97, L16 107, L18 126, L20 146. MASTERY.md's "89" for
15+ is the L14 figure (77 x 1.15), and every mastery is inside +-15% of both numbers.

| | L15 | L16 | L18 | L20 |
| --- | --- | --- | --- | --- |
| Summoner | 94.0 | 106.7 | 127.7 | 145.5 |
| Illusionist | 96.8 | 109.3 | 126.8 | 148.5 |
| Stormcaller | 98.1 | 105.1 | 125.1 | 147.2 |
| Pyromancer | 99.9 | 105.8 | 124.7 | 143.5 |
| Sage | 92.0 | 100.0 | 116.9 | 136.3 |
| Mystic | 99.1 | 106.7 | 124.9 | 146.1 |

Sage sits 6% under the target (allowed up to 10%: it heals). DPS rises at every level from 15 to 20 (17 and 19 were
checked too). The masteries use the MEAN of 12 seeds, not the median of 8 that the subclass rig uses: the ultimates
that taunt or follow crowds make the per-seed results bimodal. The ultimate is 40-50% of the damage in this ~18 s fight.
The knobs are the `balance.dmgMul` tables in `mage.js`, which are linear between levels.

## For the other packages

- **Core**: the panel title still reads "Mage · <Subclass>" with a mastery on; `p.data.masteryId` should drive it.
  The kits already apply their look patch themselves (`ms_look`). If `player.js` look composition also applies
  `spec.look` for the mastery, the result is the same patch twice, which is harmless. Save/restore of the mastery is
  core's job: the save test accepts either the mastery or (without core's support) the subclass after a load. These
  tests do not use `__game.setMastery` or `masteryIds`.
- **Renderer/look**: the Guardian Dragon (`flyer` size 2.4, `wings_bat`) and the Phoenix (`flyer`, `wings_bird`)
  use only the existing rigs and features. Ultimates set `game.ambience.tint` (amount at most 0.25) while they run,
  and restore the clock tint at the end.
- 3D screenshots were checked (Dragon, Thunderstorm, Avatar, Hall of Mirrors at L16): they render, with no console
  errors. The 2D renderer was not checked.

## Known gaps

- The DPS rig plays without boons (as in rounds 1 to 3), so mastery-and-boon combinations are covered only by the
  fuzz runs (all boons, L18, 3000 steps), not balanced.
- Sage healing is not measured in the DPS rig (it has no classmates). The heal is checked in the behaviour tests.
