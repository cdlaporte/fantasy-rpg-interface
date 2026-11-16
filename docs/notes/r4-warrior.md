# Round 4, Warrior package: the six warrior masteries

Branch `wp/r4war`. Tests: `node --test tests/node` (all pass here). New: `tests/node/r4-warrior.test.mjs`,
`tests/node/r4-warrior-dps.test.mjs`, helper `tests/node/r4-warrior-lib.mjs` (`KIT_DPS_TABLE=1` prints the DPS table).

## What changed, file by file

- `src/data/specs/warrior.js`: six entries after the subclasses, `{id, from, tier: 3, name, blurb, color, mods, look,
  passive, ultimate, abilities: [shift entry, unlock 15], colors, nums, balance: {dmgMul}}`. `mods.power` is always 1 and
  `mods.speed` 1 (hp only: 1.0-1.2), so damage does not depend on how the core composes stats; damage is tuned by the
  mastery's own `balance.dmgMul` table (levels 15/16/18/20, linear between), applied on top of the subclass table.
- `src/core/kits/paladin.js` also exports `MW`, the helpers the six share (data, look patch, aura, balance multiplier,
  allies/foes lists, Meteor Heart crater, Oathkeeper extra).
- `src/core/kits/{paladin,sentinel,warlord,juggernaut,spellblade,runeguard}.js`: the kits (state in `p.data.kit.pal /
  snt / wl / jg / sb / rg`). No subclass kit was touched.

| mastery | passive | upgraded ultimate (H) |
| --- | --- | --- |
| Paladin `#ffe08a` | **Dawnward**: Perfect Blocks heal you 6% and classmates within 5 by 8% (gold `beam`s, `pillar`); every other cleave leaves a sunlit patch (`zone_ring`, heals friends, burns foes, max 4) | **Sanctuary** (32 s, 50 Rage): `shield_bubble` r 5.5 for 6 s, 80% less damage + heal inside, two light pillars + `bolt`s smite enemies inside every 0.5 s (stun), ends in a radiant burst (8 pillars, `screenFlash`) |
| Sentinel `#5aa0ff` | **Bastion**: blocks (+14, perfect +30) and hits taken (+5) fill a meter (kit HUD label and stance "Bastion 70%" in the attack box, blue glow from 70); full = counter `shockwave` r 3.4 + 40% of the damage blocked (capped), stun | **Bulwark Fortress** (30 s, 50 Rage): a blue bubble that follows you for 6 s, steel towers (`pillar`s) every second, taunt within 8 (`data.taunt` + AI target), half damage, every hostile projectile within 3.2 reflected, rampart spin each second; ends in a crash (`meteor`, `shockwave`) that grows with what you soaked |
| Warlord `#f0a43a` | **Rally**: each defeat gives you and classmates within 8 +15% power / attack speed and haste for 4 s ("Rally!"); Rage gives classmates up to +25% power / +20% attack speed (frenzy tag shared in Frenzy) | **War Banner** (26 s): leap at the strongest enemy ahead, gold landing, plant a banner (kind `warlord_banner`, model `totem`, plus a crimson/gold standard of `pillar`s) for 8 s: +25% power and attack speed and regen near it, enemies near the landing pushed back, slowed and marked ("shaken"), war-drum shockwave every 1.2 s |
| Juggernaut `#ff6a2a` | **Unstoppable Force**: Rage scales `p.scale` up to 1.3 and armor up to 30% less damage; above 50 Rage (or in Frenzy) knockback immunity and trample (walking into enemies hits and shoves them) | **Stampede** (26 s): four invulnerable dash legs (through everything), each re-aimed at the next enemy, dust + afterimages, then a quake (`meteor` ring, `screenFlash`) |
| Spellblade `#ff6be0` | **Spellweave**: each Rune Shift charges 3 swings (kit pips, hero glows): fire exploding cone, frost 5 ice shards, storm sky bolt + chain of 3; swings 20% quicker; the third ends with a "Combo!" shockwave | **Prismatic Edge** (28 s, 40 Rage): nine dash-through slashes from enemy to enemy cycling fire/frost/storm (invulnerable), then a tri-colour X-slash blast ("PRISMATIC!") |
| Runeguard `#8f7dff` | **Rune Wards**: every other swing drops a ward (kind `rune_ward`, model `rune_seal` in the element colour, max 4, 6 s) that zaps the nearest enemy within 3.2 every 0.9 s with its element; near a ward you take 15% less | **Rune Citadel** (28 s, 40 Rage): eight wards (fire/frost/storm) in a ring r 3.6 for 6 s, shield + 40% less inside, lightning walls between wards, fast zaps, all detonate at the end |

The subclass ultimate boons carry over: Oathkeeper (+2 s Sanctuary / Fortress), Meteor Heart (crater under the War
Banner landing and the Stampede quake), Encore (Prismatic Edge +3 strikes; the Citadel detonates twice).
Looks: Paladin white plate + `circlet` + `glow` aura; Sentinel steel/blue plate, `helm`, navy cape, `storm` aura;
Warlord crimson/gold plate, gold `horned`, crimson cape; Juggernaut iron plate, `helm`, ember axes, no cape; Spellblade
`leather` + `feather` hat + violet cape (keeps the Battlemage element aura); Runeguard dark plate + violet `circlet`,
`sparkle` aura. Each is put into `p.data.kit.lookPatch` in `onEquip` (idempotent with a core composition of `look`);
the mastery aura comes through the warrior `aura` layer hook.

## Balance (measured DPS, `r4-warrior-dps.test.mjs`; in brackets the ratio to the mastery target = round 3 band x 1.15)

Target `1.15 x 62 x (L/12)^1.4`: L15 97.5, L16 106.6, L18 125.5, L20 146.2 (MASTERY.md's 89 / 107 / 125 / 146 are the
14 / 16 / 18 / 20 points; 15 sits between). The rig is kit-warrior's mixed fight with one change: the hero follows
the A* path when a wall blocks the straight line (leaps / fear left the hero stuck behind the test zone's wall blocks).

| | L15 | L16 | L18 | L20 |
| --- | --- | --- | --- | --- |
| **target** (MASTERY.md ~89 / 107 / 125 / 146) | 97.5 | 106.6 | 125.5 | 146.2 |
| Paladin | 96 (0.98) | 101 (0.95) | 120 (0.96) | 142 (0.97) |
| Sentinel | 92 (0.94) | 99 (0.93) | 120 (0.95) | 137 (0.93) |
| Warlord | 97 (0.99) | 103 (0.96) | 129 (1.03) | 149 (1.02) |
| Juggernaut | 90 (0.92) | 98 (0.92) | 115 (0.92) | 138 (0.94) |
| Spellblade | 97 (1.00) | 107 (1.00) | 129 (1.03) | 156 (1.06) |
| Runeguard | 98 (1.00) | 102 (0.96) | 123 (0.98) | 146 (1.00) |
| (subclasses in the same rig, ratio) | 0.73-0.86 | 0.80-0.90 | 0.84-0.89 | 0.85-0.91 |

Tanks (Paladin, Sentinel, Juggernaut) sit ~5% under. The rig has no classmates, so Rally / Rage share / Dawnward heals
are not counted; Warlord and Juggernaut need `dmgMul` 1.1-1.25 at 15-16 (their passives add little solo damage there).

## For other packages

- **Core**: please compose `specs[masteryId].look` (and the title "Warrior · Paladin") — the HUD still says the
  subclass. The kits already put the mastery look into `kit.lookPatch`, so it shows either way. `setMastery` /
  `masteryIds` were absent here; tests use `kits.set(p, 'warrior', '<mastery>')` and feature-detect `setMastery`.
  A save/load restores only the subclass until the core saves `masteryId` (tested: the re-equipped kit works).
  `progression.applyKit()` (level down, setClass, setSpec, load) re-runs `kits.set(p, classId, specId)` and drops the mastery unless the core passes the mastery id.
- **Renderers**: the 3D `totem` model is only a ground ring + glow; a real banner pole for kind `warlord_banner`
  would help (the kit adds a light column meanwhile). `rune_seal` is used small (`w: 1, h: 1, r: 0.6`) for wards; in 3D
  it reads as a pale stone ring, 2D draws it in the element colour. `p.scale` up to 1.3 for the Juggernaut.
- The UI shows `kitHud.pips` only when they match the resource, so not for warriors (Rage): Spellblade charges also show as the stance ("Frost x3"), Sentinel's meter as "Bastion 60%"; Runeguard ward count only in `kitHud.pips`.

## Checks

- `node --test tests/node`: all pass (528 pass, 1 skipped, 0 fail). The test asserts the band (0.85-1.15 of the target),
  pairs and all six within +-15%, and that each mastery out-damages its subclass at 16 and 20.
- Kit HUD stance texts (Bastion meter, Spellweave "Frost x3") are asserted in `r4-warrior.test.mjs`.
- 3D screenshots (Sentinel Bulwark Fortress, Spellblade Prismatic Edge, Spellweave swing) re-checked after the HUD
  change: no console errors, ultimates read clearly. The side panel refreshes on its own cadence, so a screenshot
  taken right after a Rune Shift can still show the previous element title for a moment.

## Known gaps

- Sentinel taunt sets `ai.target` each second; bosses with scripted patterns may ignore it.
- Sunlit patches and wards are capped (4 each) but a Paladin and classmates in one spot can stack heals (silent).
- Juggernaut `p.scale` is not saved (recomputed from Rage on the next step).
