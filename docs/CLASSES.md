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

## Progression timeline (slice: level cap 12)

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

Later phase: third tier at level 16 (two options per spec), rank V, new ultimates.

Level-up moment (every level): full heal, fx `levelup` + `ring` that knocks nearby
enemies back, sfx, toast "Level N!". If an ability unlocks: `'ability:unlocked'`
→ the UI shows a banner with the key and a one-line how-to. If the rank goes up:
`'rank:up'` → banner "Arcane Bolt → Twin Bolts". Boons and the pending
specialization show a nudge in the left panel; **Tab** opens the boon picker
(InputState `pressed.boon`).

Boons: at levels 4, 6, 8, 10, 12 the player picks 1 of 3 boons drawn (seeded,
no repeats) from the class pool plus, after specializing, the spec pool (at
least one spec boon is offered when any remain). Every boon changes behavior
and visuals. The level-up question hook: opening the picker calls
`gates.ask({context: 'boon'})`; correct → 3 options, wrong → 2 options (or
retry, if the context is configured as blocking).

## Balance sheet (shared by class and content authors)

- Damage = `round(coef * power)`, crit x2 unless stated. `power`, `hpMax`, `speed`
  come from `progression.recalc()` using class/spec data.
- Player base stats: novice hp `20 + 5/level`, power `2`, speed `3.2`.
  Warrior hp `44 + 9/lvl`, power `5 + 1.3/lvl`, speed `3.4`.
  Mage hp `28 + 5/lvl`, power `6 + 1.6/lvl`, speed `3.3`.
  Rogue hp `34 + 6.5/lvl`, power `4.5 + 1.25/lvl`, speed `4.0`.
  Specs apply multipliers (`mods: {hp, power, speed}`).
- Target sustained single-target damage per second using everything sensibly:
  level 3 ≈ 10, level 5 ≈ 17, level 8 ≈ 30, level 10 ≈ 40, level 12 ≈ 52.
  Burst abilities can spike 3-6x that briefly. All nine specs should land within
  ±15% of each other on a mixed fight (one tough enemy + four weak ones).
- Normal enemy of level L: hp ≈ `6 * L^1.4` (L1 6, L3 28, L5 57, L8 110, L10 150,
  L12 195), hit damage ≈ `2 + 1.5 * L`, xp `5 + 3 * L`, gold `1..(2 + L)`.
  Elites x2.5 hp and x3 xp. Bosses x25 hp, x20 xp. A level 1 rat has hp 6: three
  stick hits at the start, one hit for any class by level 5.
- XP: `xpNext(l) = round(20 * l^1.6)`. Quests give about 40% of a level.
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

Class boons (8): **Blazing Bash** (Shield Bash leaves `ground_fire` along its
path, 3 s) · **Aftershock** (War Cry fires a second, larger shockwave 0.6 s
later) · **Cleaving Wind** (every fourth basic throws a `crescent` projectile,
range 4) · **Unstoppable** (above 50 Rage: immune to knockback and slows, steady
glow) · **Ricochet Bash** (a Bash that hits chains into a second enemy) ·
**Battle Hymn** (War Cry heals you and classmates 15% and hastes them) ·
**Rage Spikes** (being hit releases a spike `ring` r 1.5, 2 s internal cooldown) ·
**Second Wind** (once per 60 s, dropping below 25% hp heals 30% and knocks
everything back).

### Knight — timing and protection (gold `#f2c94c`, steel)

Look: `plate`, `sword_shield`, `helm`. Mods: hp x1.25, speed x0.95.
- **Passive — Bulwark Aura.** Classmates within 4 tiles take 30% less damage
  (faint gold ring under them).
- **Basic III — Knight's Cleave.** 120 degree arc, range 1.35, coef 1.1, 0.44 s;
  every fourth swing is followed by a free shield punch (stun 0.5 s).
- **Basic IV (level 12).** Every third swing launches a `crescent` of light
  (range 5, pierces).
- **F — Shield Wall** (hold; no cooldown; speed -40% while held; `anim: block`).
  Hits from the front 120 degrees are reduced 85%. A hit blocked within 0.25 s
  of raising the shield is a **Perfect Block**: projectiles are reflected,
  melee attackers are stunned 1 s, +20 Rage, fx `ring` gold + `sparkle`.
  Releasing F after blocking anything does a **Shield Slam** cone (coef 1.0 +
  40% of the damage blocked, capped).
- **Shift — Aegis of Flinkerton** (level 11, cd 30 s, 50 Rage). Golden dome
  (`shield_bubble`, r 3.5, 5 s): you and classmates inside take 80% less,
  enemies are pushed out; it ends in a radiant `pillar` + `shockwave` (coef 3).

Boons (4): **Mirror Shield** (Perfect Block fires a `beam` back at the
attacker) · **Phalanx** (while Shield Wall is up, classmates get a shield too) ·
**Earthsplitter** (Shield Slam travels 5 tiles as a ground `wave`) ·
**Oathkeeper** (Aegis lasts 2 s longer and heals inside).

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
- **F — Whirlwind** (hold; needs 20 Rage, drains 20/s; 80% move speed;
  `anim: spin`). Ticks coef 0.6 to everything within 1.6 every 0.2 s. fx
  `slash` `spin` + wind `ring`.
- **Shift — Skyfall Leap** (level 11, cd 25 s). Leap up to 5 tiles (real `z`
  arc, invulnerable in the air), land with `shockwave` r 3 + `meteor` debris:
  coef 4, stun 1 s. Larger during Frenzy.

Boons (4): **Cyclone** (Whirlwind pulls enemies in and widens the longer it
spins) · **Axe Storm** (thrown axes bounce between 3 enemies) · **Meteor
Heart** (Skyfall leaves a burning crater) · **Undying** (hp cannot drop below 1
during Frenzy).

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
- **F — Rune Shift** (cd 1.5 s). Cycle Fire → Frost → Storm. Shifting releases
  a nova of the NEW element (r 2.2, coef 0.8 + the element effect) and
  recolors the blade (bump `lookRev`).
- **Shift — Runestorm** (level 11, cd 28 s, 40 Rage). Plant the blade for 3 s:
  a fire `pillar` ring, then a frost `ring`, then six storm `bolt`s on enemies
  within 5. Each pulse coef 2.

Boons (4): **Elemental Overlap** (hitting an enemy that carries a different
element detonates it: steam burst, shatter, or plasma) · **Twin Runes** (waves
fire in pairs: current and previous element) · **Rune Trail** (Shield Bash
leaves a trail of the current element) · **Encore** (Runestorm adds a fourth,
random pulse).

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

Class boons (8): **Splitting Bolts** (bolts split into two smaller bolts on
impact) · **Blink Burst** (Blink leaves a half-strength Nova behind) · **Frost
Nova** (Nova freezes and leaves `ground_frost`) · **Arcane Orbit** (three orbs
circle you, damaging what they touch; Nova fires them outward) · **Double
Blink** (two Blink charges) · **Mana Surge** (at full Mana the next basic is a
giant piercing bolt) · **Gravity Well** (Nova pulls enemies in before blasting
them out) · **Phase Shift** (blinking through an enemy damages and marks it).

### Conjurer — the one-student army (spirit teal `#3fe0c5`)

Look: `robe` teal, `orb`, `circlet`. Mods: hp x1.1, power x0.9 (pets do the rest).
- **Passive — Familiars.** Spirit pets persist until defeated or a zone change,
  show fxTag `summoned`, and count in the HUD (`kitHud.pips`).
- **Basic III — Spirit Bolt.** `orb` projectile, coef 0.9; the target is marked
  (`mark`, 4 s): familiars swarm marked targets and deal +50% to them.
- **Basic IV.** A marked enemy that is defeated releases a homing spirit that
  seeks the next enemy (coef 1.5).
- **F — Summon Familiar** (cd 6 s, 30 Mana). Summons the next of: **Fox**
  (quadruped, fast biter), **Owl** (flyer, ranged `spark`), **Stoneling**
  (small golem, taunts, tough). Max 3; casting at max replaces the oldest with
  a small heal burst. fx `pillar` teal + `poof`.
- **Shift — Grand Conjuration** (level 11, cd 35 s, 60 Mana). For 8 s a giant
  spirit guardian (golem, size 1.8, glowing) stomps `shockwave`s (coef 2.5)
  and all familiars grow and gain haste.

Boons (4): **Pack Leader** (a fourth familiar slot; marking hastes the pack) ·
**Soul Link** (familiar hits restore Mana; an expiring familiar bursts and
heals you) · **Spirit Swap** (Blink swaps places with the nearest familiar and
both release a Nova) · **Echo** (each familiar echoes your bolt with a mini-bolt).

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
- **F — Meteor** (cd 10 s, 40 Mana). Targets 4 tiles ahead: `telegraph_circle`
  0.9 s while a `meteor` effect falls (`z`), then fx `meteor` r 2.5, coef 4.5,
  burning ground, camera shake.
- **Shift — Cataclysm** (level 11, cd 40 s, 80 Mana). Five meteors over 3 s on
  the densest enemies in view, `screenFlash` on each impact.

Boons (4): **Wildfire** (burning enemies explode when defeated; fire spreads) ·
**Storm Lance** (the beam leaves a crackling line for 2 s) · **Meteor Echo**
(three smaller meteors follow in a line) · **Quick Study** (charges 30% faster
and no longer slows you).

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
- **F — Flying Kick** (cd 5 s, 20 Ki). Dash-kick 4 tiles (invulnerable); on a
  hit, chain to the nearest other enemy within 4 tiles, up to 3 chains, each
  +20% damage. `afterimage` + `trail`.
- **Shift — Thousand Palms** (level 11, cd 30 s, 60 Ki). 2.5 s as a blur: 12
  teleport-strikes spread over every enemy within 4 (`afterimage` + `hit` at
  each), ending in a gold `ring` (coef 3) and healing 15%.

Boons (4): **Iron Skin** (Palm Strike grants a 2 s `shield_bubble`) · **Wind
Step** (Flying Kick chains 2 more times and hastes you) · **Dragon Wave** (at
100 Ki the next Palm Strike is a giant piercing wave beam) · **Deflect
Mastery** (deflected projectiles split into two homing ki blasts).

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

Class boons (8): **Ricochet Knives** (knives bounce to another enemy) ·
**Shadow Roll** (the roll leaves `smoke`; enemies inside lose track of you) ·
**Venom Edge** (hits stack venom: green tint, damage over time, bursts at 5
stacks) · **Roll Strike** (rolling through enemies slashes them, +1 combo
each) · **Blade Flurry** (at 5 pips basic attacks hit in a full circle) ·
**Quick Hands** (Fan of Knives refunds a pip and 2 s of cooldown per defeat) ·
**Lucky Streak** (crits reset Dodge Roll and `sparkle`) · **Boomerang Blade**
(every fifth basic throws a returning dagger).

### Archer — spacing and the perfect shot (forest green `#3fa34d`, gold fletching)

Look: `leather` green, `bow`, `feather` hat. Mods: power x1.1.
- **Passive — Eagle Eye.** Damage +0..60% with distance (max at 7+ tiles); hits
  from 5+ tiles grant an extra pip.
- **Basic III — Longbow.** Tap: quick `arrow` (speed 16, range 9, coef 0.9,
  0.35 s). Hold to draw up to 0.8 s (-40% speed, fxTag `charge`): **Power
  Shot** pierces everything, coef up to 3.0, knockback, `sparkle` when fully drawn.
- **Basic IV.** Quick arrows fire in pairs; a full Power Shot bursts into
  splinters behind its first target.
- **F — Arrow Rain** (cd 9 s, finisher). Zone 5 tiles ahead, r `2 + 0.25 * combo`,
  2.5 s, ticks coef 0.5 and slows. Arrows visibly fall (`z`).
- **Shift — Starfall Arrow** (level 11, cd 30 s). 0.6 s draw, then a giant
  glowing arrow crosses the whole view: pierces, coef 5, drags small enemies
  along, explodes (`meteor`) on the first wall.

Boons (4): **Split Arrow** (Power Shot splits in three after its first hit) ·
**Pinning Shot** (a full draw roots for 2 s) · **Rain of Fire** (Arrow Rain
burns) · **Hawk** (a hawk dives on your last target every 4 s).

### Thief — stealth and treasure (dusk teal `#2a9d8f`, coin gold)

Look: `cloak` dusk teal with `hood`, `daggers`. Mods: speed x1.1.
- **Passive — Sticky Fingers.** Hits have a 35% chance to shake out 1-3 gold
  (coins pop out and fly to you); defeats drop +50% gold. **Backstab:** hits on
  an enemy facing away, or from stealth, crit x3. While stealthed, E on an NPC
  pickpockets (small gold or item; 25% chance of being noticed → crime).
- **Basic III — Cutpurse Daggers.** As Twin Daggers, coef 0.6 x2, with the above.
- **Basic IV — Jackpot.** A backstab bursts coins outward that damage nearby
  enemies (coef 1.0) before flying back to you.
- **F — Smoke Vanish** (cd 10 s). `smoke` r 2 (enemies inside are slowed and
  lose their target) and `caltrops` under it; you are stealthed 5 s (alpha 0.4,
  fxTag `stealth`, +25% speed). The first attack from stealth is a Backstab,
  grants +2 pips, and ends stealth.
- **Shift — Grand Heist** (level 11, cd 30 s, finisher). Zigzag through up to 6
  enemies (`afterimage` + `trail` between each): coef `1.5 + 0.4 * combo` each,
  a fountain of coins from every victim, each is marked (+30% damage taken,
  5 s); you return to where you started.

Boons (4): **Coin Toss** (picking up gold may fling a `coin` at the nearest
enemy) · **Vanishing Act** (a defeat from stealth resets Smoke Vanish) ·
**Loaded Dice** (Backstab crits x4 and may drop an item) · **Caltrop Trail**
(Dodge Roll scatters caltrops).

### Ninja — mobility and misdirection (indigo `#3d348b`, red sash `#e63946`)

Look: `gi` indigo with red accent, `shuriken`, `bandana`. Mods: speed x1.12.
- **Passive — Afterimage.** Moving leaves faint `afterimage`s; the first attack
  within 1 s of any dash, roll or step crits.
- **Basic III — Shuriken.** Three `shuriken` in a 30 degree spread, range 6,
  coef 0.5 each, 0.3 s; at max range they **return** to you, hitting again;
  each one caught cuts 0.3 s off Shadow Step.
- **Basic IV.** Five shuriken, and each bounces to a second target.
- **F — Shadow Step** (cd 6 s). Appear behind the nearest enemy within 7 tiles
  (or 4 tiles ahead), leaving a **decoy** (your look with fxTag `shadow`) that
  enemies attack for 2.5 s before it bursts (`smoke` + coef 2.0, r 1.8). +2 pips.
- **Shift — Shadow Clones** (level 11, cd 30 s, finisher). Two shadow clones
  (three at 5 pips) fight beside you for 8 s, mirroring your basic attacks at 60%.

Boons (4): **Explosive Tags** (the decoy's burst is larger and burns) · **Blade
Storm** (returning shuriken orbit you for 2 s before being caught) ·
**Substitution** (every 12 s the next hit is negated: you `poof` and reappear
2 tiles away) · **Clone Mastery** (clones also copy Shadow Step).

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
- A node test per kit: at levels 3 / 5 / 8 / 11 / 12 with scripted input, every
  ability and attack rank runs 600 steps against a ring of dummies without
  throwing, deals damage, fires fx, and the mixed-fight DPS lands in the target band.
