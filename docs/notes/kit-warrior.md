# Warrior kits (class `warrior`, specs `knight`, `berserker`, `battlemage`)

Owner files: `src/core/kits/{warrior,knight,berserker,battlemage}.js`, `src/data/classdefs/warrior.js`,
`src/data/specs/warrior.js`, `src/data/boondefs/warrior.js`, `tests/node/kit-warrior*.test.mjs`, this file.
Tests: `node --test tests/node` (the five `kit-warrior*` files, 70+ tests). `KIT_DPS_TABLE=1 node --test
tests/node/kit-warrior-dps.test.mjs` prints the DPS table.

## What each kit does

- **warrior** (class layer, always present). Rage (+6 per basic hit, +10 per hit taken, -5/s after 4 s out of
  combat). Sword Arc (rank I) and Heavy Hand (rank II: every third swing is a 180-degree gold smash with double
  knockback and hit-stop), Space Shield Bash (dash, first enemy stunned, +15 Rage), Q War Cry (shockwave, slow, +30%
  power, red aura flare), the 8 class boons. It also exports `W`, the helpers the specs share.
- **knight**: timing and protection. Bulwark Aura (classmates within 4 take 30% less), Knight's Cleave (a free
  shield punch after every fourth swing; at rank IV every third swing throws a piercing crescent of light), F
  Shield Wall (hold to guard; a Perfect Block reflects projectiles, stuns melee attackers and gives Rage; release
  for a Shield Slam that grows with damage blocked), Shift Aegis (golden dome, 80% less damage, ends in a radiant blast).
- **berserker**: risk and momentum. Wild Heart (up to +60% attack speed as hp falls), Rage never decays, Frenzy at
  100 Rage (6 s, Rage drains to 0, +40% attack speed, 8% lifesteal, afterimages), Twin Axes (alternating chops,
  +8 Rage per hit; rank IV throws a returning axe every fourth chop), F Whirlwind (hold, drains Rage, or Frenzy time
  while frenzied), Shift Skyfall Leap (real z arc, meteor landing, bigger during Frenzy).
- **battlemage**: stance dancing. The rune blade carries Fire (burn) / Frost (slow, third stack freezes) / Storm
  (arcs to 2 nearby enemies for 50%); Rune Slash fires Elemental Waves (every third swing; at rank IV every second,
  piercing, leaving fire/frost ground or a 4-target storm chain); F Rune Shift cycles the element with a nova; Shift
  Runestorm plants the blade for fire pillars, a frost ring and six storm bolts.

Per-layer extension hooks the class calls on every layer (a spec may implement them): `onBashEnd(game, p, x0, y0,
x1, y1, hits)` (Rune Trail uses it) and `aura(game, p)` (the Battlemage level-10 aura follows the element).
Kit state: `p.data.kit` (class keys flat, specs under `kn`, `bz`, `bm`). Transient state (cooldowns, Frenzy,
the current element) resets on load; class, spec, level and boons restore a working kit (tested).

## Mixed-fight DPS (measured, `tests/node/kit-warrior-dps.test.mjs`)

Fight: one tough enemy (elite giant rat at level L with 8x hp, so it lasts) plus four level-L rats, all with AI, in
the `test` zone. Scripted sensible play: chase the nearest enemy and hold the attack at it, Bash at mid range, War Cry
with Rage, Shield Wall timed on enemy windups (Knight), Whirlwind when crowded (Berserker), Rune Shift on cooldown
(Battlemage), the ultimate when ready, and a sensible boon pick per level (see `LOADOUT`). The player gets 20% hp
back every 4 s (potions, classmates) and has an hp floor of 1. DPS = effective damage (capped at remaining hp) per
second, until everything is dead or 45 s; mean of 8 seeds. The test asserts +-15% of the target and +-15% between specs.

| level | target | Warrior | Knight | Berserker | Battlemage |
| --- | --- | --- | --- | --- | --- |
| 3 | 10 | 10.4 (+4%) | - | - | - |
| 5 | 17 | 19.1 (+12%) | - | - | - |
| 8 | 30 | (28.8 unspecialized) | 32.6 (+9%) | 33.3 (+11%) | 33.4 (+11%) |
| 10 | 40 | (33.3 unspecialized) | 38.8 (-3%) | 39.7 (-1%) | 41.7 (+4%) |
| 12 | 52 | (40.0 unspecialized) | 55.2 (+6%) | 55.8 (+7%) | 57.5 (+11%) |

An unspecialized warrior past level 8 falls below the band on purpose (the spec ceremony is the level-8 spike; the
player is nudged to it). It is reported, not asserted.

**Tuning deviations from the CLASSES coefficients.** With the coefficients as written (Sword Arc 1.0 at 0.42 s,
Twin Axes 0.7 at 0.26 s, ...) a level-3 warrior already does 21-25 DPS against the 10 target and specs at 12 did
88-190 against 52, because power (`5 + 1.3/lvl`) is high relative to the band, and AoE plus boons multiply it. Every
damage coefficient lives in data and was scaled (structure, rates, radii, arcs, statuses, unlock levels and all
fixed fractions such as War Cry +30%, Bulwark 30%, Frenzy +40% / 8%, storm 50%, Shield Slam 40% of blocked are as
written). Current coefs: Sword Arc 0.46, Heavy Hand 0.58, Shield Bash 0.7, War Cry 0.4; Knight's Cleave 0.4, shield
punch 0.3, crescent 0.35, Shield Slam 0.4 (+40% blocked, bonus capped at 3x power), Aegis end 1.4; Twin Axes 0.125,
thrown axe 0.12, Whirlwind 0.085 per 0.2 s tick, Skyfall 0.75; Rune Slash 0.25, wave 0.26 (rank IV 0.15), burn
0.09/s, element ground 0.03, Rune Shift nova 0.2, Runestorm 0.45 per pulse; boons scaled likewise (boondefs `nums`).
If the balance sheet changes (power curve, enemy hp), retune these and rerun the DPS test.

Other judgment calls: Knight's fourth cleave uses low knockback and the shield punch lunges 0.4 tiles so the punch
connects (with full knockback it always missed); Whirlwind has no knockback (it pushed targets out of its own
radius); while frenzied, Whirlwind burns Frenzy time instead of Rage (Rage is locked during Frenzy); Elemental
Overlap has a 2 s per-target cooldown and the new element stays on the target (so dancing keeps detonating);
Shield Bash +15 Rage is granted when it connects; Skyfall aims at the nearest enemy within 5 tiles in a 100-degree
cone of the move direction, else 5 tiles ahead; Runestorm is planted where you cast it (you keep moving).

## Requests and bugs for the integrator (with reproductions)

- **R1 (Sim, request) Kit aura vs level-10 aura.** `player.refreshLook()` applies the default level-10 aura after
  `p.data.kit.lookPatch`, so a kit cannot choose its aura (Battlemage element aura, War Cry flare). Repro: level 10
  battlemage, `p.data.kit.lookPatch = {aura: {style: 'frost', color: '#7fd6ff'}}; game.sys.player.refreshLook()` ->
  `p.look.aura.color === '#ff7a2f'`. Guard in the kit: a `'look:changed'` listener re-applies the wanted aura
  (`fixAura` in warrior.js) and bumps `lookRev`. Fix: let a kit patch's `aura` win over the default.
- **R2 (Sim, request) `chain` cannot exclude the first target.** `abilities.use('chain', p, {x: t.x, y: t.y, jumps: 2})`
  always picks `t` itself first (distance 0). The Battlemage storm arc is implemented in the kit (`stormChain`).
  Fix: an `exclude` param (or `from` entity).
- **R3 (Sim, bug) A dash started while the dasher is in hit-stop stalls.** Repro: `dash {stopOnHit: true, hitStop:
  0.06, onEnd: (g, c) => g.abilities.use('dash', c, {angle: 0, dist: 3})}` against a dummy: the second dash ends after
  2 steps without moving (`updateDash` stall counter while `data.hitStop` freezes physics). Guard: Ricochet Bash
  starts its second dash 0.09 s later. Fix: do not count stall steps while `data.hitStop > 0`.
- **R4 (Sim, request)** `dash` does not forward `tags` to `combat.damage` (Bash hits arrive untagged); `beam` forces
  anim `cast`, which breaks a held `block` anim (Mirror Shield uses `combat.aoe` shape `line` instead).
- **R5 (Meta, bug) Bogus ability entries.** `progression.abilityList()` normalizes the layered kit's `abilities`
  object, which always has all four slots, `null` when empty: a warrior at level 3 gets `['space:shield_bash:3',
  'q:war_cry:5', 'f:f:1', 'shift:shift:1']` (`f`/`shift` with empty names, unlock 1; `class_demo` then lists them).
  Fix: skip null slots in `normAbilities`. Also `'ability:unlocked'` is emitted twice on class set (Sim without
  name, Meta with name).
- **R6 (Meta, request) Data replaces defaults wholesale.** A non-empty `data.boons` / `data.classes` / `data.specs`
  replaces Meta's built-in pools. In this worktree only the warrior files are filled, so 4 Meta tests that use mage
  or rogue data fail here (`stats ... data overrides` was fixed on my side; still failing: `boon picker`, `class,
  spec and look pickers`, `save round trip` (rogue `venom_edge`)). Verified: with the mage/rogue files filled (from
  Meta's defaults, temporarily, reverted) they pass. They resolve when the other class packages land; merging data
  per id over the defaults would make it order-independent.
- The pre-existing failing tests from other packages (13 at the base commit) are unchanged.

## For the renderers (entities, looks, fx)

- Projectiles: `crescent` (Cleaving Wind, steel `#e8eef5` glow `#bfe8ff`, size 1.2; Knight rank IV light `#fff3c4`
  glow gold, size 1.4, pierces), `wave` (Knight Earthsplitter gold size 1.6; Battlemage element color, size 1.2 /
  1.5 at rank IV), `axe` (bone `#f1e9da` glow crimson, size 1.3, returns to the thrower; bounces with Axe Storm).
- Zones: `ground_fire` (Blazing Bash path, Meteor Heart crater, fire Rune ground, fire Rune Trail), `ground_frost`,
  `zone_ring` storm color (storm Rune Trail), `shield_bubble` gold r 3.5 (Aegis). Effect entity kind `runestorm`
  (look `{rig:'effect', model:'zone_ring', color: element, r: 5}`, ~3.5 s): the planted blade's rune circle.
- fxTags: `haste` (War Cry), `frenzy`, `rune_fire` / `rune_frost` / `rune_storm` (one at a time), `shield` on
  classmates (Phalanx), plus status tags `burn`, `frost`, `stun`.
- Looks: class tunic + `sword`; Knight `plate`, `sword_shield`, `helm`, red cape; Berserker `vest`, `axes`, `horned`;
  Battlemage `robe`, `runeblade` with `glow` = element color. Kit patch aura `{flame, #ff3b2a}` for 5 s after War
  Cry (any level); level-10 aura: flame in the spec color (Battlemage: `flame` / `frost` / `storm` style in the element
  color). `ent.glow = '#ff8a3c'` while Unstoppable is active.
- fx `slash` styles: `sword` (steel; Heavy Hand gold with `arc: 180, w: 2`), `fist` (shield punch, Shield Slam with
  `w: 2`), `axe` (alternating `angle` +-0.35 rad), `spin` (Whirlwind, `arc: 360`), `crescent` (Cleaving Wind).
  Big moments: Aegis start/end, Skyfall landing and every Runestorm storm pulse fire `screenFlash`; Skyfall in Frenzy
  adds a ring and six extra `meteor` debris impacts.
- Bus events added by the kits (informational): `'frenzy' {ent, on}`, `'rune:shift' {ent, element}`,
  `'rune:overlap' {ent, target, a, b}`.

## Known gaps

- Visuals unverified (placeholder renderers); only the fx events and parameters are tested.
- Companion Bram uses the generic ai attacks from `data.classes.warrior.companion` (Sim design), so warrior boons
  do not affect him.
- Second Wind triggers from `onHurt` (after the hit); a single hit that takes you from above 25% straight to 0
  downs you before it can trigger.
- Undying uses `p.data.minHp` during Frenzy and restores the previous value afterwards; a cutscene that sets
  `minHp` during a Frenzy would be restored to its value from before the Frenzy.
