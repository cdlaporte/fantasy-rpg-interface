# Classes, specializations and progression — design bible

The teacher's brief, in his words: "a distinct sense of uniqueness to the classes
and a noticeable progression of power as you level up and specialize. Really
unique abilities and noticeably unique effects, not just stat boosts. I want
progression to be a very satisfying experience."

So the rules for everyone implementing this:

1. **Every kit is its own way to play.** If two kits could be swapped by changing
   numbers, one of them is wrong. Each has a resource with its own rhythm, a basic
   attack with its own input feel, and one signature mechanic nobody else has.
2. **Every milestone changes what the player sees and does.** New levels unlock
   attack ranks, abilities and boons that visibly alter attacks. Stat growth is
   there too, but it is never the headline.
3. **Effects sell it.** Every ability names the fx it fires (types from
   CONTRACTS section 7). Bigger milestone = bigger effect. Use color identity:
   Warrior red/gold/steel, Mage violet/cyan, Rogue green/teal/shadow, plus the
   spec colors below.
4. Mechanics follow CONTRACTS section 8 (kits). Numbers live in data
   (`src/data/classes.js`, `src/data/specs/*.js`, `src/data/boons.js`); behavior
   lives in `src/core/kits/<id>.js`.

## Progression timeline (level cap 20; round 3)

| Level | What happens |
| --- | --- |
| 1-2 | Cloaked novice with a stick (tutorial). Rats take 3 hits. |
| 3 | Reached during the tutorial. At the Academy: **choose class** → class outfit and weapon, class basic attack (rank I), **Space** ability, resource bar appears. |
| 4 | **Attack rank II** (basic visibly changes). First **boon** choice. |
| 5 | **Q** ability. |
| 6 | Boon. |
| 8 | **Specialization** ceremony with Laporte → new outfit and weapon, new basic attack (rank III), passive signature mechanic, **F** ability. Boon. |
| 10 | Boon. Class **aura** appears on the character (warrior `flame`, mage `sparkle`, rogue `shadow`, in the spec color). |
| 11 | **Shift** ultimate (spec). |
| 12 | **Attack rank IV**. Boon. |
| 13 | The four biomes open after Old Mossback (players arrive around 11-12). From here every level also adds a little **toughness** (+0.3 defense). |
| 14 | **Empowered aura**: the level-10 aura turns brighter (`aura.tier: 2`), the weapon glows in its color and the hero throws off sparks; banner "Your aura blazes brighter!". Boon. |
| 15 | Stats. |
| 16 | **Attack rank V** (a new, bigger form of every subclass's basic, below). Boon. |
| 17 | Stats. |
| 18 | Boon. |
| 19 | Stats. |
| 20 | Boon. The cap: the xp bar stays full. |

Round 3 decision (the teacher): no third subclass tier. Levels 13-20 grow the hero through rank V, four more boons
(27 new ones in the pools, below), the empowered aura and the stat curves. Levels 15, 17 and 19 are "stat" levels
(full heal, the level-up burst, +hp/+power/+toughness); every even level from 12 changes what you see or do.

Level-up moment (every level): full heal, fx `levelup` + `ring` that knocks nearby
enemies back, sfx, toast "Level N!". If an ability unlocks: `'ability:unlocked'`
→ the UI shows a banner with the key and a one-line how-to. If the rank goes up:
`'rank:up'` → banner "Arcane Bolt → Twin Bolts". Boons and the pending
specialization show a nudge in the left panel; **Tab** opens the boon picker
(InputState `pressed.boon`).

Boons: at levels 4, 6, 8, 10, 12, 14, 16, 18, 20 the player picks 1 of 3 boons drawn (seeded,
no repeats) from the class pool (11 per class) plus, after specializing, the spec pool (6 per subclass; at
least one spec boon is offered when any remain). Every boon changes behavior
and visuals. The level-up question hook: opening the picker calls
`gates.ask({context: 'boon'})`; correct → 3 options, wrong → 2 options (or
retry, if the context is configured as blocking).

## Balance sheet (shared by class and content authors)

- Damage = `round(coef * power)`, crit x2 unless stated. `power`, `hpMax`, `speed`
  come from `progression.recalc()` using class/spec data.
- Player base stats: novice hp `20 + 5/level`, power `2`, speed `3.2`.
  Warrior hp `44 + 9/lvl`, power `5 + 1.625/lvl`, speed `3.4`.
  Mage hp `28 + 5/lvl`, power `6 + 2.0/lvl`, speed `3.3`.
  Rogue hp `34 + 6.5/lvl`, power `4.5 + 1.5625/lvl` (round 2: power per level x1.25 for every class), speed `4.0`.
  Specs apply multipliers (`mods: {hp, power, speed}`).
- Target sustained single-target damage per second using everything sensibly:
  level 3 ≈ 10, level 5 ≈ 17, level 8 ≈ 30, level 10 ≈ 40, level 12 ≈ 52 (round 2 band: 11 / 19.5 / 35 / 47 / 62).
  Round 3 continues the round 2 band at a constant time to kill (`62 x (L/12)^1.4`): **level 14 ≈ 77, 16 ≈ 93,
  18 ≈ 109, 20 ≈ 127**; the nine subclasses within ±15% of each other at 14, 16, 18 and 20 (measured in
  `tests/node/kit-*-dps.test.mjs`, tables in `docs/notes/r3a.md`). Past level 12 each subclass has one balance table
  (warrior specs `balance.dmgMul`, mage specs `balance.dmgMul`, rogue specs `kit.lateScale`).
  Burst abilities can spike 3-6x that briefly. All nine specs should land within
  ±15% of each other on a mixed fight (one tough enemy + four weak ones).
- Normal enemy of level L: hp ≈ `6 * L^1.4` (L1 6, L3 28, L5 57, L8 110, L10 150,
  L12 195), hit damage ≈ `2 + 1.5 * L`, xp `5 + 3 * L`, gold `1..(2 + L)`.
  Elites x2.5 hp and x3 xp. Bosses x25 hp, x20 xp. A level 1 rat has hp 6: three
  stick hits at the start, one hit for any class by level 5.
- XP: `xpNext(l) = round(15 * l^1.5)` (round 2), and from level 11 x `(2 + 0.3 (l - 11))` (round 3: the biomes
  scale their enemies to the player, so kill xp grows with you; about two levels per biome, level 20 at the end of the
  fourth). Quests give about 40% of a level.
- Round 3 toughness: from level 13 the hero gets +0.3 defense per level, so a level-18 hero survives as many hits from
  level-18 enemies (`2 + 1.5L`) as a level-8 hero did in the forest.
- Enemies in a zone have fixed levels (no scaling to the player), so power is felt.

## Novice (before the Academy)

Stick: `melee_arc` 90 degrees, range 0.9, coef 1.0, 0.45 s, fx `slash` style `stick`.
No resource, no abilities. Cannot attack before `flag has_stick`.

---

## WARRIOR — the wall and the hammer

Resource **Rage** (0-100, red `#e2503c`): +6 per basic hit dealt, +10 per hit
taken, decays 5/s after 4 s out of combat. Feel: heavy, short reach, everything
he hits moves. Look: tunic in red with steel trim, `sword`.

- **Basic I — Sword Arc.** 100 degree arc, range 1.2, coef 1.0, 0.42 s, strong
  knockback. fx `slash` `sword`, steel white.
- **Basic II (level 4) — Heavy Hand.** Every third swing is a 180 degree heavy
  swing (coef 1.6, double knockback, brief hit-stop) with a thicker gold slash.
- **Space — Shield Bash** (cd 5 s). Dash 2.5 tiles in the move direction (or
  facing); the first enemy hit takes coef 1.5, stun 0.8 s, heavy knockback;
  +15 Rage. fx `trail` + `hit` + `burst`.
- **Q — War Cry** (level 5, cd 12 s, 30 Rage). `shockwave` r 3: coef 1.2,
  knockback, enemies slowed 40% for 3 s; you gain +30% power for 5 s (fxTag
  `haste`, red aura flare).

Class boons (8 + 3 in round 3): **Blazing Bash** (Shield Bash leaves `ground_fire` along its
path, 3 s) · **Aftershock** (War Cry fires a second, larger shockwave 0.6 s
later) · **Cleaving Wind** (every fourth basic throws a `crescent` projectile,
range 4) · **Unstoppable** (above 50 Rage: immune to knockback and slows, steady
glow) · **Ricochet Bash** (a Bash that hits chains into a second enemy) ·
**Battle Hymn** (War Cry heals you and classmates 15% and hastes them) ·
**Rage Spikes** (being hit releases a spike `ring` r 1.5, 2 s internal cooldown) ·
**Second Wind** (once per 60 s, dropping below 25% hp heals 30% and knocks
everything back). Round 3 (+3): **Thunder Clap** (every fifth swing calls a lightning `bolt` down on the enemy in
front: small `ring`, stun) · **Juggernaut** (Shield Bash goes 1.6x as far and plows through every enemy in the way,
gold `trail` + `shockwave` at the end) · **War Banner** (War Cry plants a flaming banner, effect model `totem`: enemies
near it burn, you hit +20% harder beside it).

### Knight — timing and protection (gold `#f2c94c`, steel)

Look: `plate`, `sword_shield`, `helm`. Mods: hp x1.25, speed x0.95.
- **Passive — Bulwark Aura.** Classmates within 4 tiles take 30% less damage
  (faint gold ring under them).
- **Basic III — Knight's Cleave.** 120 degree arc, range 1.35, coef 1.1, 0.44 s;
  every fourth swing is followed by a free shield punch (stun 0.5 s).
- **Basic IV (level 12).** Every third swing launches a `crescent` of light
  (range 5, pierces).
- **Basic V — Twin Dawn (level 16).** The third swing sends a wide twin wave instead: two big `crescent`s side by
  side (size 1.9) with a gold ground `wave` between them, range 6.5, a 150-degree `slash`, `sparkle` and `ring`.
- **F — Shield Wall** (hold; no cooldown; speed -40% while held; `anim: block`).
  Hits from the front 120 degrees are reduced 85%. A hit blocked within 0.25 s
  of raising the shield is a **Perfect Block**: projectiles are reflected,
  melee attackers are stunned 1 s, +20 Rage, fx `ring` gold + `sparkle`.
  Releasing F after blocking anything does a **Shield Slam** cone (coef 1.0 +
  40% of the damage blocked, capped).
- **Shift — Aegis of Flinkerton** (level 11, cd 30 s, 50 Rage). Golden dome
  (`shield_bubble`, r 3.5, 5 s): you and classmates inside take 80% less,
  enemies are pushed out; it ends in a radiant `pillar` + `shockwave` (coef 3).

Boons (4 + 2 in round 3): **Mirror Shield** (Perfect Block fires a `beam` back at the
attacker) · **Phalanx** (while Shield Wall is up, classmates get a shield too) ·
**Earthsplitter** (Shield Slam travels 5 tiles as a ground `wave`) ·
**Oathkeeper** (Aegis lasts 2 s longer and heals inside). Round 3: **Hallowed Ground** (Shield Slam blesses the
ground in front: a gold zone that heals you and burns enemies, `pillar` + `sparkle`) · **Judgement** (every 6 s the
next cleave calls a `pillar` of light on what it hits: holy `shockwave`, stun).

### Berserker — risk and momentum (crimson `#d7263d`, bone white)

Look: `vest`, `axes`, `horned` hat. Mods: hp x1.1, speed x1.08.
- **Passive — Wild Heart.** Attack speed +0..60% as hp falls from 100% to 30%.
  Rage never decays. At 100 Rage **Frenzy** triggers for 6 s (drains Rage to
  0): fxTag `frenzy`, `afterimage` trail, +40% attack speed, 8% of damage dealt
  returns as health.
- **Basic III — Twin Axes.** Alternating left/right chops, 90 degree arcs, range
  1.15, coef 0.7, 0.26 s; +8 Rage per hit. fx `slash` `axe`.
- **Basic IV.** Every fourth chop throws a spinning `axe` that returns
  (hits on the way out and back).
- **Basic V — Splitting Axes (level 16).** An axe every third chop (bigger), and on its first hit it splits into a
  fan of three small axes (`burst` + `slash` `axe` at the split).
- **F — Whirlwind** (hold; needs 20 Rage, drains 20/s; 80% move speed;
  `anim: spin`). Ticks coef 0.6 to everything within 1.6 every 0.2 s. fx
  `slash` `spin` + wind `ring`.
- **Shift — Skyfall Leap** (level 11, cd 25 s). Leap up to 5 tiles (real `z`
  arc, invulnerable in the air), land with `shockwave` r 3 + `meteor` debris:
  coef 4, stun 1 s. Larger during Frenzy.

Boons (4 + 2 in round 3): **Cyclone** (Whirlwind pulls enemies in and widens the longer it
spins) · **Axe Storm** (thrown axes bounce between 3 enemies) · **Meteor
Heart** (Skyfall leaves a burning crater) · **Undying** (hp cannot drop below 1
during Frenzy). Round 3: **Rampage** (a defeat during Frenzy adds 1 s to it, up to +6 s, and bursts bone shards around
the victim) · **Whirling Axes** (while you Whirlwind, axes fly out of the spin every 0.5 s and boomerang back).

### Battlemage — stance and combos (element colors)

Look: `robe` with steel accents, `runeblade` with `glow`. Mods: hp x1.0, power x1.05.
- **Passive — Runic Edge.** The blade carries one element; `held.glow`, the
  aura and fxTag (`rune_fire` / `rune_frost` / `rune_storm`) follow it.
  Fire `#ff7a2f`: burn (coef 0.3/s for 3 s). Frost `#7fd6ff`: slow 40% 2 s, the
  third stack freezes (stun 1 s, `ice` burst). Storm `#ffe14d`: the hit chains
  to 2 nearby enemies for 50% (fx `bolt` between them).
- **Basic III — Rune Slash.** 110 degree arc, range 1.3, coef 1.0, 0.42 s; every
  third swing launches an **Elemental Wave** (`wave` projectile in the element
  color, range 6, coef 1.2, applies the element).
- **Basic IV.** Waves every second swing; they pierce and leave element ground
  (`ground_fire`, `ground_frost`, or a storm chain of 4).
- **Basic V — Rune Tempest (level 16).** Waves grow (size 1.9) and carry two elements: the current one (color) and
  the previous one (glow), applying both; a crescent `slash` in the second color marks the cast.
- **F — Rune Shift** (cd 1.5 s). Cycle Fire → Frost → Storm. Shifting releases
  a nova of the NEW element (r 2.2, coef 0.8 + the element effect) and
  recolors the blade (bump `lookRev`).
- **Shift — Runestorm** (level 11, cd 28 s, 40 Rage). Plant the blade for 3 s:
  a fire `pillar` ring, then a frost `ring`, then six storm `bolt`s on enemies
  within 5. Each pulse coef 2.

Boons (4 + 2 in round 3): **Elemental Overlap** (hitting an enemy that carries a different
element detonates it: steam burst, shatter, or plasma) · **Twin Runes** (waves
fire in pairs: current and previous element) · **Rune Trail** (Shield Bash
leaves a trail of the current element) · **Encore** (Runestorm adds a fourth,
random pulse). Round 3: **Trinity Slash** (every fifth slash bursts with all three elements at once: fire `pillar`,
frost `sparkle`, storm `bolt`, plasma `shockwave`) · **Elemental Crown** (the current element strikes the nearest
enemy within 4.5 every 1.5 s: a `bolt` or `trail` from you, burn / chill / zap).

---

## MAGE — the glass cannon who controls space

Resource **Mana** (0-100, blue `#4d8dff`): regenerates 9/s. Feel: fragile,
ranged, always repositioning. Look: `robe` violet and cyan, `staff`, `wizard` hat.

- **Basic I — Arcane Bolt.** Projectile `bolt`, speed 11, range 7, coef 1.0,
  0.45 s, free. Violet with a cyan core and `trail`.
- **Basic II (level 4) — Twin Bolts.** Two parallel bolts (coef 0.65 each).
- **Space — Blink** (cd 4 s, 15 Mana). Teleport 3.5 tiles in the move direction
  (through enemies, not walls), 0.2 s invulnerable. fx `poof` + `sparkle` at
  both ends, `afterimage` at the start.
- **Q — Arcane Nova** (level 5, cd 9 s, 35 Mana). `ring` + `burst` r 2.8, coef
  1.8, knockback.

Class boons (8 + 3 in round 3): **Splitting Bolts** (bolts split into two smaller bolts on
impact) · **Blink Burst** (Blink leaves a half-strength Nova behind) · **Frost
Nova** (Nova freezes and leaves `ground_frost`) · **Arcane Orbit** (three orbs
circle you, damaging what they touch; Nova fires them outward) · **Double
Blink** (two Blink charges) · **Mana Surge** (at full Mana the next basic is a
giant piercing bolt) · **Gravity Well** (Nova pulls enemies in before blasting
them out) · **Phase Shift** (blinking through an enemy damages and marks it). Round 3 (+3): **Arcane Chain** (every third hit you
land arcs lightning `bolt`s to two more enemies; Monk punches count too) · **Comet Nova** (Arcane Nova also calls five
little telegraphed comets, `meteor`, down around you) · **Mana Shield** (above half Mana / Ki, a hit spends 10 Mana
and a third of its damage is soaked; fxTag `shield` while it is up, a blue `ring` on each soak).

### Conjurer — the one-student army (spirit teal `#3fe0c5`)

Look: `robe` teal, `orb`, `circlet`. Mods: hp x1.1, power x0.9 (pets do the rest).
- **Passive — Familiars.** Spirit pets persist until defeated or a zone change,
  show fxTag `summoned`, and count in the HUD (`kitHud.pips`).
- **Basic III — Spirit Bolt.** `orb` projectile, coef 0.9; the target is marked
  (`mark`, 4 s): familiars swarm marked targets and deal +50% to them.
- **Basic IV.** A marked enemy that is defeated releases a homing spirit that
  seeks the next enemy (coef 1.5).
- **Basic V — Spirit Chain (level 16).** A bigger, white-glowing Spirit Bolt whose hit chains (teal `bolt`s) to two
  more enemies, marking each, so the pack swarms them all.
- **F — Summon Familiar** (cd 6 s, 30 Mana). Summons the next of: **Fox**
  (quadruped, fast biter), **Owl** (flyer, ranged `spark`), **Stoneling**
  (small golem, taunts, tough). Max 3; casting at max replaces the oldest with
  a small heal burst. fx `pillar` teal + `poof`.
- **Shift — Grand Conjuration** (level 11, cd 35 s, 60 Mana). For 8 s a giant
  spirit guardian (golem, size 1.8, glowing) stomps `shockwave`s (coef 2.5)
  and all familiars grow and gain haste.

Boons (4 + 2 in round 3): **Pack Leader** (a fourth familiar slot; marking hastes the pack) ·
**Soul Link** (familiar hits restore Mana; an expiring familiar bursts and
heals you) · **Spirit Swap** (Blink swaps places with the nearest familiar and
both release a Nova) · **Echo** (each familiar echoes your bolt with a mini-bolt). Round 3: **Wild Hunt** (marking an enemy, at most every
4 s, calls a ghost wolf for 5 s that pounces on it: `poof` + `trail`) · **Spirit Totem** (Summon Familiar also plants a
`totem` with a healing zone for you and your pets, 6 s).

### Sorcerer — charge-up artillery (ember `#ff5a36`, storm `#b48cff`)

Look: `robe` crimson and gold, `staff` with `glow`, tall `wizard` hat. Mods: power x1.15, hp x0.95.
- **Passive — Overcharge.** The basic attack charges while the attack key is
  held (fxTag `charge`, -30% speed, growing glow) and fires on release:
  tap (< 0.3 s) **Ember** (`spark`, coef 0.6, free) · mid (0.3-1.0 s)
  **Fireball** (`fireball`, explodes r 1.5, coef 1.8, leaves `ground_fire` 3 s,
  10 Mana) · full (>= 1.0 s) **Arc Lance** (instant piercing `beam` the whole
  range, coef 2.8 to everything in the line, 25 Mana, small camera shake).
- **Basic III** is the above. **Basic IV:** Arc Lance forks a `bolt` from every
  enemy it pierces to a neighbor; Fireball's fire is larger and lasts longer.
- **Basic V — Triple Lance (level 16).** A full charge fires three Arc Lances in a 28-degree fan (side lances 60%),
  with a storm `shockwave` and a bigger camera shake.
- **F — Meteor** (cd 10 s, 40 Mana). Targets 4 tiles ahead: `telegraph_circle`
  0.9 s while a `meteor` effect falls (`z`), then fx `meteor` r 2.5, coef 4.5,
  burning ground, camera shake.
- **Shift — Cataclysm** (level 11, cd 40 s, 80 Mana). Five meteors over 3 s on
  the densest enemies in view, `screenFlash` on each impact.

Boons (4 + 2 in round 3): **Wildfire** (burning enemies explode when defeated; fire spreads) ·
**Storm Lance** (the beam leaves a crackling line for 2 s) · **Meteor Echo**
(three smaller meteors follow in a line) · **Quick Study** (charges 30% faster and no longer slows you). Round 3: **Living Bomb** (a fireball sticks to what it hits,
pulses a `ring`, and blows up again 0.9 s later: `meteor` fx) · **Phoenix** (once every 90 s a knockout hit is survived:
heal 40%, then a fiery blast with `pillar`, `burst`, `screenFlash`).

### Monk — the mage who punches (ki gold `#ffd23f`, jade)

Look: `gi` saffron, `fists` with `glow`, `bandana`. Mods: hp x1.3, speed x1.15.
Resource is renamed **Ki** (0-100, gold): no passive regen; +8 per punch
landed; standing still 1.5 s meditates (slow hp and Ki regen, fxTag `ki`).
- **Passive — Flowing Fists.** Melee replaces bolts. While punching, enemy
  projectiles in front are **deflected** back at their owner.
- **Basic III — Four-Beat Combo.** 0.18 s per strike, range 0.9: jab, jab,
  sweeping kick (150 degree arc), **Palm Strike** (cone `shockwave`, coef 2.0,
  big knockback). Coefs 0.5 / 0.5 / 0.8 / 2.0. fx `slash` `fist`, gold.
- **Basic IV.** Palm Strike also launches a ki `wave` (range 5), and a fifth
  beat, a rising uppercut, pops the target into the air (stun).
- **Basic V — Dragon Fist (level 16).** The uppercut unleashes a ki dragon: a big piercing `wave` head (size 2.4) and
  a zigzag tail of four gold / jade `orb`s that snake after it; `shockwave` + `burst` at the fist.
- **F — Flying Kick** (cd 5 s, 20 Ki). Dash-kick 4 tiles (invulnerable); on a
  hit, chain to the nearest other enemy within 4 tiles, up to 3 chains, each
  +20% damage. `afterimage` + `trail`.
- **Shift — Thousand Palms** (level 11, cd 30 s, 60 Ki). 2.5 s as a blur: 12
  teleport-strikes spread over every enemy within 4 (`afterimage` + `hit` at
  each), ending in a gold `ring` (coef 3) and healing 15%.

Boons (4 + 2 in round 3): **Iron Skin** (Palm Strike grants a 2 s `shield_bubble`) · **Wind
Step** (Flying Kick chains 2 more times and hastes you) · **Dragon Wave** (at
100 Ki the next Palm Strike is a giant piercing wave beam) · **Deflect
Mastery** (deflected projectiles split into two homing ki blasts). Round 3: **Palm Echo** (a bigger jade `shockwave`
booms 0.3 s after every Palm Strike, just ahead of it) · **Jade Lotus** (Thousand Palms ends by blooming a jade lotus
zone that heals you and slows enemies, `pillar` + `sparkle`).

---

## ROGUE — fast, slippery, bursty

Resource **Combo** (0-5 pips, green `#58d68d`, shown as `kitHud.pips`): +1 per
basic hit; finishers spend all of it; resets after 6 s without landing a hit.
Feel: quickest mover, in and out. Look: `leather` green and dark, `daggers`, `bandana`.

- **Basic I — Twin Daggers.** Double slash, 70 degree arc, range 0.95, coef
  0.55 x2, 0.24 s, 15% crit. fx `slash` `dagger`.
- **Basic II (level 4) — Lunge.** The third attack in a chain lunges 0.6 tiles
  forward for coef 1.2.
- **Space — Dodge Roll** (cd 3 s). Roll 3 tiles in the move direction, 0.35 s
  invulnerable (`anim: dash`); the next basic within 1.5 s is a guaranteed crit.
- **Q — Fan of Knives** (level 5, cd 7 s, finisher). Throws `3 + 2 * combo`
  `knife` projectiles (coef 0.7 each) in a fan that widens from 60 degrees to a
  full circle at 5 pips.

Class boons (8 + 3 in round 3): **Ricochet Knives** (knives bounce to another enemy) ·
**Shadow Roll** (the roll leaves `smoke`; enemies inside lose track of you) ·
**Venom Edge** (hits stack venom: green tint, damage over time, bursts at 5
stacks) · **Roll Strike** (rolling through enemies slashes them, +1 combo
each) · **Blade Flurry** (at 5 pips basic attacks hit in a full circle) ·
**Quick Hands** (Fan of Knives refunds a pip and 2 s of cooldown per defeat) ·
**Lucky Streak** (crits reset Dodge Roll and `sparkle`) · **Boomerang Blade**
(every fifth basic throws a returning dagger). Round 3 (+3): **Toxic Fan** (Fan of Knives leaves a green poison cloud
around you that stacks venom; bigger with more pips) · **Backflip Knives** (Dodge Roll flings three knives back at
where you came from) · **Adrenaline Rush** (cashing in five pips on any finisher: +30% attack speed and haste for 4 s,
`afterimage` trail).

### Archer — spacing and the perfect shot (forest green `#3fa34d`, gold fletching)

Look: `leather` green, `bow`, `feather` hat. Mods: power x1.1.
- **Passive — Eagle Eye.** Damage +0..60% with distance (max at 7+ tiles); hits
  from 5+ tiles grant an extra pip.
- **Basic III — Longbow.** Tap: quick `arrow` (speed 16, range 9, coef 0.9,
  0.35 s). Hold to draw up to 0.8 s (-40% speed, fxTag `charge`): **Power
  Shot** pierces everything, coef up to 3.0, knockback, `sparkle` when fully drawn.
- **Basic IV.** Quick arrows fire in pairs; a full Power Shot bursts into
  splinters behind its first target.
- **Basic V — Burning Shot (level 16).** A full Power Shot is a bigger fire-orange arrow that leaves a trail of burning
  ground (`ground_fire` zones every 1.3 tiles) along its whole flight.
- **F — Arrow Rain** (cd 9 s, finisher). Zone 5 tiles ahead, r `2 + 0.25 * combo`,
  2.5 s, ticks coef 0.5 and slows. Arrows visibly fall (`z`).
- **Shift — Starfall Arrow** (level 11, cd 30 s). 0.6 s draw, then a giant
  glowing arrow crosses the whole view: pierces, coef 5, drags small enemies
  along, explodes (`meteor`) on the first wall.

Boons (4 + 2 in round 3): **Split Arrow** (Power Shot splits in three after its first hit) ·
**Pinning Shot** (a full draw roots for 2 s) · **Rain of Fire** (Arrow Rain burns) · **Hawk** (a hawk dives on your last target every 4 s). Round 3:
**Ricochet Arrows** (quick arrows bounce into a second enemy for half damage, `sparkle`) · **Explosive Arrow** (a full
Power Shot explodes in a golden blast on the first enemy it hits: `meteor` + `shockwave`).

### Thief — stealth and treasure (dusk teal `#2a9d8f`, coin gold)

Look: `cloak` dusk teal with `hood`, `daggers`. Mods: speed x1.1.
- **Passive — Sticky Fingers.** Hits have a 35% chance to shake out 1-3 gold
  (coins pop out and fly to you); defeats drop +50% gold. **Backstab:** hits on
  an enemy facing away, or from stealth, crit x3. While stealthed, E on an NPC
  pickpockets (small gold or item; 25% chance of being noticed → crime).
- **Basic III — Cutpurse Daggers.** As Twin Daggers, coef 0.6 x2, with the above.
- **Basic IV — Jackpot.** A backstab bursts coins outward that damage nearby
  enemies (coef 1.0) before flying back to you.
- **Basic V — Coin Storm (level 16).** Every third attack also flings a fan of five returning `coin`s forward, and
  Jackpot throws twice the coins.
- **F — Smoke Vanish** (cd 10 s). `smoke` r 2 (enemies inside are slowed and
  lose their target) and `caltrops` under it; you are stealthed 5 s (alpha 0.4,
  fxTag `stealth`, +25% speed). The first attack from stealth is a Backstab,
  grants +2 pips, and ends stealth.
- **Shift — Grand Heist** (level 11, cd 30 s, finisher). Zigzag through up to 6
  enemies (`afterimage` + `trail` between each): coef `1.5 + 0.4 * combo` each,
  a fountain of coins from every victim, each is marked (+30% damage taken,
  5 s); you return to where you started.

Boons (4 + 2 in round 3): **Coin Toss** (picking up gold may fling a `coin` at the nearest
enemy) · **Vanishing Act** (a defeat from stealth resets Smoke Vanish) ·
**Loaded Dice** (Backstab crits x4 and may drop an item) · **Caltrop Trail**
(Dodge Roll scatters caltrops). Round 3: **Golden Touch** (every 10 gold picked up heals 4%, in a gold `sparkle`) ·
**Sleight of Hand** (a Backstab steals speed: the victim is slowed, you are hasted, a `trail` from it to you).

### Ninja — mobility and misdirection (indigo `#3d348b`, red sash `#e63946`)

Look: `gi` indigo with red accent, `shuriken`, `bandana`. Mods: speed x1.12.
- **Passive — Afterimage.** Moving leaves faint `afterimage`s; the first attack
  within 1 s of any dash, roll or step crits.
- **Basic III — Shuriken.** Three `shuriken` in a 30 degree spread, range 6,
  coef 0.5 each, 0.3 s; at max range they **return** to you, hitting again;
  each one caught cuts 0.3 s off Shadow Step.
- **Basic IV.** Five shuriken, and each bounces to a second target.
- **Basic V — Shuriken Halo (level 16).** Every third throw is a full ring of ten returning shuriken (a 360-degree
  `slash` `spin` and a red `ring`); clones copy it.
- **F — Shadow Step** (cd 6 s). Appear behind the nearest enemy within 7 tiles
  (or 4 tiles ahead), leaving a **decoy** (your look with fxTag `shadow`) that
  enemies attack for 2.5 s before it bursts (`smoke` + coef 2.0, r 1.8). +2 pips.
- **Shift — Shadow Clones** (level 11, cd 30 s, finisher). Two shadow clones
  (three at 5 pips) fight beside you for 8 s, mirroring your basic attacks at 60%.

Boons (4 + 2 in round 3): **Explosive Tags** (the decoy's burst is larger and burns) · **Blade
Storm** (returning shuriken orbit you for 2 s before being caught) ·
**Substitution** (every 12 s the next hit is negated: you `poof` and reappear
2 tiles away) · **Clone Mastery** (clones also copy Shadow Step). Round 3: **Kunai Fan** (Shadow Step throws a fan of
five `kunai` from the spot you vanished) · **Smoke Screen** (Shadow Step leaves a big `smoke` cloud where you were:
enemies inside are slowed and lose you).

---

## Classmates (companions)

The two classes the player did not choose become classmates: **Bram** (warrior,
build a, cheerful and loud), **Elowen** (mage, build b, bookish and dry),
**Pip** (rogue, small, mischievous). They use the base class basic attack and
the Space ability on a timer, at the player's level with 100% of the numbers
(`data.classes[id].companion`; round 2). They gain their second ability at the player's level 5, and when the
player specializes they get an upgraded attack and outfit (see docs/notes/r2c.md). They show their class outfit and react with
speech bubbles to the player's big moments (ultimates, level-ups, boss shields).

## Implementation checklist per kit

- Reads all numbers from data; nothing hard-coded except structure.
- Uses `abilities.use` building blocks where they fit and custom logic where
  the mechanic needs it; all state in `p.data.kit`.
- Fires the named fx with the kit's colors; sets `anim`, `fxTags`, look patches
  (and bumps `lookRev`).
- Emits `'ability:cast'`; respects cooldown/cost through the abilities API.
- Fills `kitHud` (pips, stance label) where the kit has something to show.
- Round 3: rank V and every new boon are tested with vs without (`tests/node/r3a-ranks.test.mjs`,
  `r3a-boons.test.mjs`); a level-20 fuzz runs every subclass with all its boons.
- A node test per kit: at levels 3 / 5 / 8 / 11 / 12 with scripted input, every
  ability and attack rank runs 600 steps against a ring of dummies without
  throwing, deals damage, fires fx, and the mixed-fight DPS lands in the target band.
