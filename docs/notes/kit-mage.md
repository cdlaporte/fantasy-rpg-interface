# Mage class package notes (Mage, Conjurer, Sorcerer, Monk)

Files: `src/core/kits/{mage,conjurer,sorcerer,monk}.js`, `src/data/classdefs/mage.js`, `src/data/specs/mage.js`,
`src/data/boondefs/mage.js`, `tests/node/kit-mage*.test.mjs` (79 tests, `kit-mage-lib.test.mjs` is the shared harness).
Run: `node --test tests/node`.

## What each kit does

- **Mage** (class): Mana 0-100 (blue `#4d8dff`) regenerates 9/s. Hold an attack key to repeat Arcane Bolt (violet
  `#9b6bff` bolt, cyan `#7fe7ff` core, trail) / Twin Bolts at rank II; Space Blink (3.5 tiles, through bodies, not walls);
  Q Arcane Nova (ring + burst r 2.8). Also holds the 8 class boons and the shared helpers the specs import.
- **Conjurer** (pet-army commander, teal `#3fe0c5`): Spirit Bolt `orb` marks targets; Fox / Owl / Stoneling familiars
  (persistent summons) swarm marks for +50%; rank IV soul chase spirits; F summons the next familiar (max 3);
  Shift Grand Conjuration: a size-1.8 glowing golem guardian stomps shockwaves for 8 s while familiars grow and haste.
- **Sorcerer** (charge-up artillery, ember `#ff5a36` / storm `#b48cff`): raw basic. Hold to charge (fxTag `charge`, -30%
  speed, glow ember -> gold -> storm), release for Ember / Fireball / Arc Lance; rank IV forks + bigger fire;
  F Meteor (telegraph + falling `z`), Shift Cataclysm (5 meteors on the densest packs, screenFlash per impact).
- **Monk** (melee combo brawler, gold `#ffd23f`, jade `#3fbf7f`): Ki replaces Mana (no regen, +8 per strike that lands,
  meditation after 1.5 s still). Four-Beat Combo (0.18 s beats: jab, jab, 150 degree kick, Palm Strike cone
  shockwave), rank IV adds a ki `wave` and a fifth beat uppercut that pops the target up (z) and stuns. Punching deflects
  projectiles in front. F Flying Kick chains, Shift Thousand Palms.

Classmate Elowen: `data.classes.mage.companion` (ally_ranged, Arcane Bolt cd 0.65, Blink away, mage barks, 70%).

## Balance: measured mixed-fight DPS

Fight: one elite boar (6 L^1.4 x 2.5 hp) + four rats (6 L^1.4 hp) at level L, live AI, scripted sensible play
(`bot()` in `kit-mage-lib.test.mjs`: aim, kite / close in, every ability when sensible). DPS = enemy hp removed /
fight time, median of 8 seeds. Asserted inside target +-15% and specs within +-15% of each other.

| kit | L3 | L5 | L8 | L10 | L12 |
| --- | --- | --- | --- | --- | --- |
| target | 10 | 17 | 30 | 40 | 52 |
| Mage | 10.4 | 15.8 | (29.9) | | |
| Conjurer | | | 26.9 | 39.3 | 48.7 |
| Sorcerer | | | 28.8 | 41.3 | 50.5 |
| Monk | | | 30.2 | 39.7 | 52.6 |

**Tuning method.** Every coefficient is exactly the CLASSES number. The CLASSES coefficients x power land at roughly 2-3x
the target band (e.g. Arcane Bolt at L3 is 24 DPS on paper), so each kit has a data table `balance.dmgMul`
(`[[level, mult], ...]`, linear in between; class table until the spec table starts) applied by the class layer's
`onOutgoing` and `onMinionOutgoing` hooks to everything the player and their summons deal. Tables: mage
`[1 .5, 3 .5, 5 .46, 8 .55]`, conjurer `[8 .66, 10 .72, 12 .48]`, sorcerer `[8 .32, 10 .34, 12 .28]`, monk
`[8 .33, 10 .37, 12 .345]`. The AoE-heavy Sorcerer and the Monk (cone + kicks + palms) get the smallest multipliers.
If the integrator prefers lower coefficients instead, fold the multiplier into the data numbers; behavior is unchanged.

## Requests / bugs for Sim and Meta (with reproductions)

1. **`'ability:unlocked'` is emitted twice (Sim and Meta).** Sim notes say Meta should not emit it.
   ```js
   const g = createGame({ data, zone: 'test' }); const ev = []; g.bus.on('ability:unlocked', (e) => ev.push(e.slot));
   g.progression.setLevel(3, { quiet: true }); g.progression.setClass('mage');   // ev = ['space', 'space']
   ```
   This is why `meta-progression: ability unlocks and spec readiness` fails (expects `['space']`). Not guarded (UI only).
2. **`progression.abilityList()` lists empty layered-kit slots** as nameless abilities: with the class-only mage kit it
   returns `space:Blink, q:Arcane Nova, f:'', shift:''` (`normAbilities` maps `Object.assign({slot}, null)`). Fix: skip
   null slots in `normAbilities`. Same root cause in `debug.class_demo(...).abilities` (meta-debug test).
3. **Partial data replaces Meta defaults.** In this worktree only the mage files are filled, so `classIds()` returns only
   `mage` and the non-empty `data.boons` replaces the default pool (warrior/rogue boons vanish). Five Meta tests fail
   here for that reason (boon offers, boon picker, pickers, progression save/load, save round trip). With the warrior and
   rogue data filled (simulated in a scratch copy from Meta's DEFAULT_* tables) the full suite shows exactly the 13
   pre-existing failures and nothing new.
4. Sim request: a `dash` option `exclude` (ids not to hit) or `onContact` filter. Chained dashes start in contact with
   the enemy they just hit; Flying Kick therefore runs its own contact check in `update` (dash `dmg: 0`, then sets
   `data.dash.remain = 0` on a hit). Also `hitStop` on a dashing source stalls the dash (counts as `stall`) and ends it.
5. Sim request: kit hooks fire inside `combat.aoe` / `meleeArc` loops that share scratch arrays (`aoeOut`, `scratchA`).
   A kill hook that runs another AoE would clobber the outer loop. All mage kill/hit reactions (Wildfire, soul chase,
   Soul Link burst, lance forks, Deflect Mastery) are deferred to the next kit update (`defer()` in mage.js).

## Custom entities, looks, fx and fxTags (for renderers)

- `arcane_orb` (Arcane Orbit boon): type `effect`, look `{rig:'projectile', model:'orb', color:'#9b6bff', glow:'#7fe7ff',
  size: 0.9, trail: true}`, z 0.7, positioned by the kit every step (circle r 1.25 around the player). Removed on
  unequip / boon loss; recreated after zone loads.
- Familiars: type `summon`, kinds `familiar_fox` (quadruped, size 0.55, teal, `tail_bushy ears_pointy`), `familiar_owl`
  (flyer, size 0.5, `wings_bird glow`, z 0.5), `familiar_stoneling` (golem 0.7, `rocky crystal`); fxTag `summoned`
  (and `mark`/`haste` from statuses). During Grand Conjuration their `scale` is 1.4.
- `spirit_guardian`: summon, golem size 1.8 `crystal antlers mossy`, `ent.glow = '#3fe0c5'`, ttl 8 s.
- Projectile models used: `bolt`, `orb` (spirit bolt, soul chase in white/teal, echo mini-bolts size 0.6, ki blasts),
  `spark` (ember, owl, monk split sparks), `fireball`, `wave` (ki wave 1.4, Dragon Wave 2.6). Mana Surge = size 2.2.
- Zones: `ground_fire` (fireball, meteor, wildfire), `ground_frost` (Frost Nova), `shield_bubble` (Iron Skin, follows
  the player, gold). Telegraph `telegraph_circle` + `meteor` effect entity with falling `z` (Meteor, Cataclysm, echoes).
- Player `ent.glow` while charging (Sorcerer): `#ff8a5a` / `#ffb347` / `#b48cff`; look patches: held glow per tier,
  white staff glow when Mana Surge is ready, white orb during Grand Conjuration, jade fists while meditating.
- fxTags set: `charge` (Sorcerer charging), `ki` (meditation), `haste` (Thousand Palms via tagFor, Wind Step/Pack Leader
  via status), statuses `mark`, `frost`, `stun`, `burn`, `shield`, `invuln`.
- Uppercut pops: enemy `z` animated by the kit (parabola, 0.6 s, h 1.2), restored after.
- Anims: `cast` (bolts, novas, meteors), `attack` (fists), `dash` (Blink, Flying Kick), `sit` (meditation).
- Kit HUD: Conjurer pips = familiars / max, label `Familiars`, stance `Guardian`; Sorcerer stance = charge tier name,
  label `Charge`; Monk pips = combo beat, label `Combo`, stance `Meditating`; base Mage with Double Blink: pips = charges.

## Known gaps / judgment calls

- Mana Surge and Splitting Bolts also apply to the specs' basics (spirit bolt, ember/fireball; Monk: Palm throws two ki
  sparks, Mana Surge fires at full Ki for 30 Ki). Mana Surge costs 30 so it is not every shot.
- Monk keeps the class Blink and Nova; they cost Ki (Ki replaces Mana everywhere). Dragon Wave spends 40 Ki.
- Fireball's direct hit deals 0 (the explosion deals the 1.8, so the target is not hit twice); the hit event has amount 0.
- Familiars are not saved (summons are transient); save/load restores class, spec, boons, level and a working kit.
- Before rank III (only reachable through debug spec set below level 8) spec kits fall back to Arcane Bolt.
- Sorcerer tap rate is limited to one Ember per 0.22 s; Fireball/Lance recover 0.12 s.
