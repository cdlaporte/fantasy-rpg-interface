# Sim package notes (API reference)

Owner files: `src/core/{world,ents,player,physics,combat,abilities,ai,companions}.js`, `src/core/kits/{index,novice}.js`,
`src/platform/input.js` (unchanged from the skeleton: it was already complete), `tests/node/sim*.test.mjs`.

This file is the reference for the people who build on the Sim: **Class kits** (sections 7-9), **Story** (section 11),
**Meta** (section 12), **UI / renderers** (section 13). Everything marked *added* is an addition to CONTRACTS; nothing
in the contract was renamed.

Tests: `node --test tests/node` (39 Sim tests + skeleton), `node tests/e2e/skeleton.cjs` (boots 2D and 3D).

---

## 0. Conventions that matter everywhere

- **`dmg` is a coefficient** (COMMON rule 9). Every block/attack computes `amount = dmg * caster.stats.power` at fire
  time. `combat.damage(target, amount, opts)` takes the absolute amount. Pass `amount:` instead of `dmg:` to any
  block to give an absolute number.
- **Angles**: radians, 0 = east, clockwise on screen. `ctx.angle` for the basic is the attack key direction.
- **Reused arrays**: `combat.meleeArc`, `combat.aoe` (immediate), `abilities.use('melee_arc'|'aoe_ring'|'beam')` and
  every `ents.inRadius(..)` without `out` return arrays that are **reused by the next call**. Copy (`.slice()`) if
  you keep them. `multishot`, `chain`, `summon` return new arrays. The combat loops (`meleeArc`, `aoe`, zone ticks,
  `damage`) keep one scratch set per nesting depth, so a kit hook that calls combat again from inside `damage()` /
  an `onHit` callback never corrupts the loop it runs in (the returned array of a *nested* call is its own).
- **Number scale** (`config.numberScale`, 6): data keeps readable base numbers for hp, power, regen and absolute heal /
  shield amounts; the Sim, Meta and Story multiply them where they are consumed (see `docs/notes/fixcore.md`).
  `combat.damage` / `heal` never scale. Anything you derive from `power`, `hpMax` or a dealt amount is already scaled.
- **Params objects are never mutated** by blocks. Kits may pass constant objects from data.
- **Allocation**: kits may allocate per cast/attack; never allocate per step in `update` (reuse `p.data.kit` fields).
- Everything uses `game.rng` and `game.t` (deterministic; the determinism test runs 3000 steps twice).
- Update order recap: `world, npc, ai, companions, player, kits, abilities, physics, combat, ents`. The player system
  calls the kit (`basic`, abilities) during `player`; `kit.update` runs during `kits`; dashes/leaps advance in
  `abilities`; positions integrate in `physics`; projectiles/zones/statuses/pickups tick in `combat`; removals flush
  in `ents`.

## 1. Entities (`game.ents`)

Contract API plus:

| call | meaning |
| --- | --- |
| `ents.spawn(kindId, x, y, opts)` | `kindId`: `data.enemies` id (type `enemy`, team `def.team` or `'enemy'`), `data.npcs` id (type `npc`, team `def.team` or `'town'`), or an effect model id (`'stick'`, `'portal'`, `'totem'`, `'chest'`... -> type `effect`, look `{rig:'effect', model}`). Fills `def, name, level, look (deep clone), tags, team, radius, hp/hpMax, stats {..def.stats, power, defense, speed, xp}`, `data.home`, `data.flying` (`def.flying`, z 0.5) and attaches the AI brain from `def.ai` (NPCs: `def.ai`, or `{brain:'guard'}` when `def.onAttacked === 'guard'`). |
| spawn `opts` | any entity field override, plus: `level` (rescales hp by `6L^1.4`, power by `2+1.5L`, xp by `5+3L` relative to `def.level`), `sid` or `id` (string id stored in `data.sid`; the numeric `ent.id` is never overridden), `tag`/`tags` (added), `look` (patch deep-merged into the def look), `stats` (merged), `data` (merged), `ai` (merged over `def.ai`), `noAi: true`, `hp` (also raises `hpMax`). |
| `ents.find(who)` *added* | `'player'`, `'@tag'`, numeric id, or a string matched against `data.sid`, then `kind`. First match or null. |
| `ents.findAll(who, out)` *added* | every match of a tag (with or without `@`), sid, kind, numeric id, or `{tag}` / `{id}`. Never includes the player unless `who === 'player'`. |
| `ents.withTag(tag, out)` | contract call; `out` optional. |
| `ents.inRadius / nearest` | spatial hash (4-tile cells, rebuilt lazily when dirty or once per tick), awake entities only, distance between centers. |
| `ents.touch()` *added* | mark the hash stale after moving something within a step (teleports do this). |
| `ents.setAnim(e, anim, dur=Infinity)` *added* | set `anim` (resets `animT` when it changes); after `dur` seconds it reverts to `idle`. Physics only switches `idle`/`walk` itself, so any other anim sticks until its timer or until you set another. |
| `ents.setFxTag(e, tag, on)` *added* | manual persistent fxTag (`charge`, `frenzy`, `rune_fire`, `ki`, ...). |
| `ents.syncFxTags(e)` *added* | rebuild `e.fxTags` in place = manual tags + every active status whose id is an fxTag. Called automatically by statuses. |
| `ents.countAwake(type)` *added* | |
| `ents.caps` *added* | `{enemies, npcs, projectiles}` copied from config; override per game (tests/debug). |

Lifecycle per step (`ents.update`): activation bubble (`config.activationRadius` 30 from the player; companions,
`data.alwaysAwake` and the player are never asleep; `data.anchor` entities are always asleep), `animT`, `flash`
decay (5/s), anim timers, `ttl`, caps (the farthest awake enemies/NPCs beyond 24/12 are put to sleep; bosses
exempt), then `flush()` (removals; `'ent:removed'` is emitted after compaction). Projectile cap 64: firing at the
cap removes the oldest projectile.

`ent.data` keys the Sim reads/writes (do not reuse for other meanings): `home, flying, sid, spawner, spawnZone,
moveTo, scripted, leash, minHp, down, downT, koT, dash, dashing, ghost, leap, noPhysics, hitStop, faceT, animUntil,
guard, mods, stacks, dotSrc, dotAcc, fxOn, fxUntil, cd, kit, kitL, kitRef, kitT, resource, classId, specId, target,
taunt, summonKey, life, onExpire, onDeath, decoy, summoned, shielded, invulnerable, untargetable, downable, canDie,
lastTarget, lastHitT, lastHitBy, lastHurtT, goldMul, kbResist, ccResist, mass, anchor, gateId, chest, loot, rune, flag,
proj, aoe, zone, follow, scriptLook, barkT, alwaysAwake`.

Minimap blips (ents `hud`): enemies (`boss` for tag boss), NPCs (`shop` when `def.shop`), companions, unopened chests,
shop prop anchors, exits. Max 96, preallocated; Story appends quest blips after `blipCount`.

## 2. World (`game.world`)

Contract API plus `wallAt(x,y)`, `walkable(x0,y0,x1,y1,r,flying)`, `raycast(x,y,angle,maxDist,flying)`,
`randomPoint(rect, minDistFromPlayer)`, `rectOf(def)`, `block(tx,ty,w,h,±1)`, `openGate(id)`, `traveling`.

- Two grids: `zone.solid` (walkers: block tiles, water/pit tiles, solid props, seals, chests) and `zone.wall`
  (flyers, projectiles, LOS: everything except water/pit). `solidAt(x, y, flying=false)`.
- `travel(zone, marker, {instant, steps})` -> Promise. Freeze `'transition'`, `'zone:transition' {to, phase:'out'}`,
  12 steps, load (or, same zone, just move the player + regroup companions), `{phase:'in'}`, 12 steps, unfreeze,
  resolve. A travel while one runs returns the running promise. `loadZone` is instant (no events besides unload/load).
- `findPath(x0,y0,x1,y1,out,{flying})`: A* (8-dir, no corner cutting), at most 400 expanded nodes, typed-array
  buffers, no allocation per call. `out` gets flat waypoints `[x1,y1,x2,y2,...]` (tile centers, start excluded).
  Returns false when the goal was not reached; `out` then holds the path to the explored node closest to the goal.
- `resolve(markerOrXY)` accepts `[x,y]`, `{x,y}`, a marker name; unknown markers warn once and give the zone center.

### Zone furniture (on `onZoneLoad`, in this order)

- **exits** `{at, w=1, h=1, to, marker, if, locked}` or `{area:[x,y,w,h], ...}`. The rect is **centered on the
  marker tile** (`x = mx - floor((w-1)/2)`). An exit only fires after the player has been outside it since arriving
  (so arriving on an exit marker never bounces you back), and never while `inputLock > 0`, `player.data.scripted` or
  down. `if` fails -> toast `locked` (default "The way is closed."), at most once per 3 s while inside.
- **spawns** `{kind, area:[x,y,w,h] | at+r, n=1, respawn (s, 0 = never), level, tag, if, opts}`. `if` is tested at each
  (re)spawn. Respawn timers start when a spawned entity is removed; a respawn point is never within 10 tiles of the
  player (retry every 2 s). Spawned entities carry `data.spawner`.
- **triggers** `{id, area | at+w+h, once, if, do}`: runs `ops.run(do, {trigger:id})` when the player enters and `if`
  passes (re-armed on leaving). `once` sets flag `trig_<zone>_<id>` and never runs again.
- **gates** `{id, at, w=3, h=1, req, question, locked, look}`: unless flag `gate_<id>`: an `effect` entity kind
  `rune_seal` (look `{rig:'effect', model:'rune_seal', color, w, h, r}`), its tiles solid, `interact {prompt:'Unseal',
  do:[['gate', question, {pass:[['gate.open', id]]}]], if: req, locked}`. Op `gate.open` (Sim) removes it, frees the
  tiles, sets the flag, fx ring+sparkle+poof, sfx door.
- **chests** `{id, at, loot, rune}`: `effect` entity, look model `chest` / `rune_chest` / `chest_open`, tile solid,
  `data {chest:id, loot, rune, flag:'chest_<zone>_<id>'}`, `interact {prompt:'Open', range 1.4, do:[['chest', loot, {id, rune}]]}`.
  When that flag becomes true the Sim also swaps the look to `chest_open` and clears `interact` (harmless if Meta's
  chest op already did).
- **props with `interact`**: an invisible anchor entity (`kind 'anchor'`, `look null`, `data.anchor`, always asleep so
  it is never rendered) at the south-center of the footprint (`x + w/2, y + h`), or the tile center for footless
  props. Player targeting includes `zone.anchors`.
- Then `game.sys.npc.populate(zone)` if it exists.

## 3. Physics (`game.physics`)

- Movers: types player, enemy, npc, companion, summon, pickup. Velocity `vx,vy` is the *intent*; physics multiplies
  it by `combat.speedMul(e)` (statuses + mods + guard), adds knockback `kx,ky` (exponential decay 8/s), moves with
  circle-vs-tile collision and sliding (sub-steps of 0.3 tiles), applies `data.leash = {x, y, r}` (circle constraint;
  the player's leash is cleared on zone load unless `leash.keep`), updates `dir/angle` from the intent unless
  `data.faceT > 0`, and switches `idle`/`walk`. Flyers (`data.flying`) collide with the wall grid only.
- Separation: pushable movers push each other apart, weighted by `data.mass` (default radius², bosses x20).
  `data.ghost` (dashes with `through`) skips it.
- `moveTo(ent, x, y, {speed, run, stopAt=0.1, face}) -> Promise<bool>`: sets `data.moveTo`; walks straight when
  `walkable`, else follows `findPath` waypoints (re-planned when stuck; snaps to the target after 6 s with no
  progress), anim `walk`, on arrival anim `idle`, optional facing, `'ent:arrived' {ent}`, promise true. `stop(ent)`
  cancels (promise false). Statuses do not slow scripted movers.
- *added*: `push(ent, angle, force)` (knockback impulse; honours mods `kbImmune`, `kbResist`, `data.kbResist`; a push of
  `k` travels about `k/8` tiles), `teleport(ent, x, y)` (no interpolation streak, snaps the camera for the player),
  `resolve(ent)` (push out of walls now).

## 4. Combat (`game.combat`)

### 4.1 Damage pipeline: `damage(target, amount, opts) -> dealt`

Only types player/enemy/npc/companion/summon can be damaged; removed, dead or down targets return 0.
Order:

1. `status.invuln`, `data.shielded` (boss shield) or `data.invulnerable` -> 0, text "Immune"/"Shielded", event `'immune'`.
2. Source power mods: `amount *= 1 + mod(source, 'power')` (skip with `opts.raw`), then `*= opts.mult`.
3. Crit decided: `opts.crit` or `opts.critChance` roll or `mod(source,'critChance')` roll. `critMult` default 2.
4. **Kit hook `onOutgoing(game, src, info)`** on the source's kit (and `onMinionOutgoing` on a summon owner's kit).
5. Mark: `status.mark` -> `amount *= 1 + statusPower.mark (0.3)` (not for type `'true'`).
6. **Kit hook `onIncoming(game, target, info)`** on the target's kit. `info.cancel = true` negates the hit.
7. Guard (`data.guard`, see the `guard` block): if the attack comes from within `arc` of the target's facing
   (projectiles: against their travel direction): perfect if within `perfect` s of raising -> 100% blocked
   (`perfectFull`), projectile reflected (`reflect`), melee attacker stunned (`stunAttacker`), fx ring+sparkle;
   else `reduce` fraction blocked, fx hit. `guard.onBlock(game, ent, ev)` and event `'block'`
   `{target, source, amount: blocked, perfect, proj, type, reflected}` -> kit `onBlock`.
8. Defense (not for `'true'`): `amount *= 10 / (10 + stats.defense)`; then `*= max(0.05, 1 + mod(target,'dmgTaken'))`.
9. Crit multiplier, then round: `max(1, round)` (0 when fully blocked).
10. `status.shield` absorbs `statusPower.shield` HP first (text "Absorbed").
10b. **Kit hook `onLethal(game, target, info)`** (the "about to be downed" point): called when the final damage
    `info.dealt` (after defense, crit and shield absorption) would take `target.hp` to 0 or less and no `data.minHp`
    floor protects it. Heal the target, raise a shield, or lower `info.dealt` (mutable; set it to `hp - 1` to survive).
    Runs for every layer of the target's kit, before the hp is written; `'player:down'` / death only follow if the hit is
    still lethal afterwards. Second Wind uses it.
11. Floor: `data.minHp` (> 0) — hp never drops below it.
12. Flash, damage `text` fx (`dmg`/`crit`, or `miss` "Blocked"/"Perfect!"), `hit` fx, sfx `hit`/`hurt`, short `hurt` anim
    for non-players that are idle/walking and not winding up.
13. Knockback `opts.knockback` along `opts.kbAngle` / projectile direction / source->target (x0.3 when blocked, x0.2 on
    bosses; mods `kbImmune`, `kbResist`).
14. `opts.hitStop` s: freezes target and source movement/AI (`data.hitStop`), emits `'hitstop' {t, target, source}`.
    `opts.shake` bumps `camera.shake`.
15. Statuses `opts.status`, lifesteal `opts.lifesteal` (fraction healed to the source).
16. Attacking from stealth breaks it (`info.fromStealth` is true in the hit event) unless `opts.keepStealth` or a DoT.
17. A player-side hit on a `town` entity emits `'crime' {victim}` (once, from Story's `'hit'` listener). Town entities can
    only be damaged by the player's **direct** attacks: `meleeArc` and projectiles fired by the player itself. Zones,
    `aoe`, `chain`, `dash` contact, summons, companions and clones never damage them (wanted or not).
18. At 0 hp: the player -> `'player:down' {source}` (once; `data.down`); companions, town NPCs (unless
    `data.canDie`) and `data.downable` entities go **down** (10 s companions, 8 s NPCs, anim `ko`, untargetable,
    `'ent:down'`, then `'ent:up'` with 50% / full hp); everything else is killed.
19. Event `'hit' {target, source, amount, crit, killed, type, element, blocked, perfect, proj, fromStealth, angle, tags, dot}`
    -> kit hooks `onHit` (source kit), `onMinionHit` (summon owner's kit), `onHurt` (target kit).

`opts`: `source` (entity, id, or projectile -> its owner), `proj`, `type 'melee'|'ranged'|'magic'|'true'`, `element`,
`angle`, `kbAngle`, `knockback`, `crit`, `critChance`, `critMult`, `mult`, `raw`, `status`, `hitStop`, `shake`,
`lifesteal`, `keepStealth`, `silent` (no text/sfx), `color` (hit spark), `tags`, `dot`.

`info` (hooks; pooled, do not keep): `{target, source, amount (mutable), type, element, crit (mutable), critMult
(mutable), angle, proj, tags, fromStealth, cancel, blocked, perfect, opts, dealt (onLethal only, mutable)}`.

`status` param forms (everywhere): `{stun: 0.8}`, `{slow: [3, 0.4]}` (seconds, power), `{id:'burn', t:3, p:2, chance:0.5}`,
or an array of those.

### 4.2 Statuses: `status(target, id, seconds, power, source)`

Duration takes the max of old/new; `seconds <= 0` clears. `clearStatus(e, id)`, `stacks(e, id)`, `setStacks(e,id,n)`.
Bosses (and `data.ccResist`, 0..1) take reduced stun/root/slow/frost durations (bosses: half).
Mods `ccImmune` (stun/root/slow/frost) and `slowImmune` (slow/frost) block them.

| id | power means | built-in behavior |
| --- | --- | --- |
| `stun` | - | no move, no act; interrupts enemy windups; player abilities released |
| `root` | - | no move, can act |
| `slow` | fraction (0.4) | speed x (1 - p) |
| `frost` | slow fraction (0.4) | slows; **stacks**: the 3rd application freezes (stun 1 s, ice burst, event `'status' {id:'freeze'}`) |
| `burn` | dmg per second | ticks every 0.5 s as true fire damage credited to `source` |
| `venom` | dmg per second per stack | **stacks** to 10 (`stacks(e,'venom')`), ticks every 0.5 s |
| `invuln` | - | no damage |
| `stealth` | speed bonus fraction | alpha 0.4 (player side), enemies drop and ignore the target |
| `mark` | extra damage taken (0.3) | allies prefer marked targets |
| `haste` | speed fraction (0.3 if unset) | speed x (1 + p) |
| `shield` | absorb HP (30% hpMax if unset) | absorbs damage first; ends when depleted |
| any other id | stored | ticks down; shows as fxTag if the id is one (`frenzy`, `ki`, `charge`, ...) |

Events `'status' {ent, id, t, power}`, `'status:end' {ent, id}`. `breakStealth(ent)`.

### 4.3 Modifiers (timed, stackable by id)

`addMod(ent, id, {key: value, ...}, dur=Infinity)` (same id replaces), `removeMod(ent, id)`, `mod(ent, key)` (sum of
active). Keys read by the Sim: `power` (+fraction outgoing damage), `speed` (+fraction), `dmgTaken` (-0.3 = 30% less),
`attackSpeed` (+fraction: basic interval timer runs faster), `cdr` (cooldowns x (1 - cdr), min 0.2), `critChance`,
`kbImmune`, `kbResist`, `ccImmune`, `slowImmune`, `goldFind` (+fraction gold from kills). `speedMul(ent)` is the
final movement multiplier physics uses.

### 4.4 Attack primitives

- `meleeArc(source, o) -> hits[]` o: `angle (source.angle), arc=90, range=1, dmg=1 | amount, offset, x, y,
  knockback=3, type, element, status, crit, critChance, critMult, hitStop, shake, lifesteal, maxTargets (nearest first),
  exclude [ids], hitsTeam, deflect (reflect hostile projectiles inside the arc), fx (false | type | object), style
  ('sword' ...), color, anim ('attack'), animDur, noAnim, silent, onHit(game, target, dealt, source), out`.
  Targets touching the attacker are hit regardless of angle; target radius counts toward range and arc.
- `projectile(source, o) -> ent` o: `angle, speed=10, range=7, dmg | amount, mult, radius=0.15, offset, side
  (perpendicular offset), x, y, z, pierce (n | true), bounce (n), bounceRange=4, homing (turn rad/s | true=5),
  homingRange=6, homingTarget, returns (flies back to its owner at range/wall, hits again on the way back, event
  'proj:caught' {proj, owner} + o.onCatch(game, proj, owner) + kit hook onCatch), returnSpeed, split ({n=2, arc=60,
  dmgMul=0.5, speed, range=3, look, radius, homing, pierce, onHit} | n), gravityZ (lob: with target {x,y} it lands
  there; no entity hits until z < 0.6; expires on landing), explode ({r, dmg|amount, knockback, status, fx, color,
  shake}: AoE on expiry/hit), landZone (zone params at the end point), ghost (passes walls), maxHits, type ('ranged'),
  element, status, knockback=1.5, crit, critChance, hitStop, lifesteal, look | model ('bolt') + color + glow + size,
  kind, hitsTeam, onHit(game, target, dealt, proj), onExpire(game, proj, why: 'range'|'wall'|'hit'|'land')`.
  Projectiles stop at the wall grid (they fly over water).
- `reflect(proj, newOwner, {mult, homing, color}) -> bool`: new team/owner, aimed back at the old owner (or reversed),
  range and hit list reset; event `'proj:reflected' {proj, by}`. `reflectInArc(owner, x, y, angle, arcDeg, range, opts) -> n`.
- `aoe(source, o)`: o: `x, y (source), r=1.5, shape 'circle'|'cone'|'line', angle, arc, len, w, dmg | amount, mult,
  knockback=4 (outward; pull: inward), type ('magic'), element, status (with dmg 0: statuses and knockback only), maxTargets,
  exclude, hitsTeam, fx (false | type | object; default 'ring', line 'beam'), color, shake, zone (lingering zone after),
  onHit, onResolve(game, hits, x, y), delay, telegraph (true/shape/'circle'|'line'|'cone' | false), telegraphColor,
  meteor (a falling 'meteor' effect entity with z from 8 to 0)`. Immediate -> hits[]; with `delay` -> the telegraph
  entity (`look.model 'telegraph_<shape>'`, `angle`) or, without a telegraph, an internal record (no entity).
- `zone(source, o) -> effect ent`: lingering area. o: `x, y, r=1.5, dur=3, tick=0.5, firstTick (true: tick at once),
  dmg | amount (hostiles, magic, no knockback), heal | healAmount (allies), status (hostiles), allyStatus, allyMod
  (mods applied to allies inside, refreshed each tick: Aegis `{dmgTaken: -0.8}`, Bulwark), smoke (enemies inside are
  blinded: lose and cannot acquire targets), push (outward impulse per tick), pull, follow (entity or id: the zone
  moves with it, ends when it is removed), model / look (default by element: ground_fire, ground_frost; smoke,
  caltrops, bubble -> shield_bubble; else zone_ring), id, onTick(game, zoneEnt, hostilesInside)`.
- `summon(owner, kindOrDef, o) -> ent`: type `'summon'`, team of the owner, `owner` link, fxTag `summoned`
  (`fxTag: false|'shadow'|...`), AI brain `o.brain` ('ally_melee'; 'idle' for statues, 'none' for no brain), attacks
  `o.attacks` or the def's. `kindOrDef`: an enemy id or an inline def `{id, name, look, stats: {radius, speed, defense},
  attacks, flying}`. o: `x, y | angle + dist=1, power | powerMul=0.6 (x owner power), hp | hpMul=0.4 (x owner hpMax),
  ttl, taunt (enemies prefer it), key (group for max), look, scale, speed, defense, radius, tags, name, ai (extra brain
  config), onExpire(game, ent, why), onDeath(game, ent, killer), fx (false), color`.
  `summonsOf(owner, key, out)`, `expireSummon(ent, why)`; events `'summon' {ent, owner}`, `'summon:expired' {ent, why}`.
- `decoy(owner, o) -> ent`: a taunting immobile summon (`brain 'idle'`), default look = clone of the owner's look,
  fxTag `shadow`, ttl 2.5, hp 50% owner hpMax, `data.decoy`. o as summon plus `onExpire` (for the burst).
- `heal(target, n, {pct, silent, source}) -> healed` (text `heal` + fx `heal`, event `'heal'`; also clears the
  player's down state). `kill(target, source, {force, noReward, noSpawn, silent})`.
- `hostile(a, b)`, `targetable(e)`, `canHit(src, t)` (hostile, or the player directly hitting a town NPC),
  `coef(source, c)`, `powerOf(e)`, `ownerOf(e)`, `setDown(e, dur)`, `dropPickup(kind, x, y, n, itemId)`.

### 4.5 Death, rewards, drops, pickups

`kill`: `'death' {ent, killer}`, `data.onDeath` callback, then for enemies killed by the player side (resolved through
summon/projectile owners): **XP** `progression.addXp(stats.xp)` (half for `data.summoned` enemies) with a `text` fx
style `xp`; **drops** from `def.drops = {gold: [a, b], goldChance=1, items: [{id, p, n}], heart (chance, default
0.05), xpOrbs (n)}` (gold x `killer.data.goldMul` x (1 + mod goldFind), split in up to 3 piles; summoned enemies drop
nothing); `def.onDeath = {spawn: kind, n, opts}` spawns children (always, they pop outward). Then fx `poof`, sfx
`poof`, removal.

Pickups: type `'pickup'`, kind `gold | heart | item | xp_orb`, look `{rig:'effect', model: kind, color, icon}`,
`data.pickup = {kind, n, id}`, ttl 60 s, pop out with knockback, after 0.4 s fly to the player within 2.5 tiles, on
touch: gold -> `inventory.addGold(n)` + text `gold`, item -> `inventory.give(id, n)` + text (item name), heart ->
`combat.heal(player, n || 20% hpMax)`, xp_orb -> `progression.addXp(n)`; event `'pickup' {kind, n, id, ent}`.

## 5. Abilities (`game.abilities`)

`use(name, caster, params)` runs a block; `register(name, fn(caster, params))` *added* adds one. Cooldowns:
`ready(ent, slot)`, `start(ent, slot, cd?)` (default: the active kit ability's `cd`; scaled by mod `cdr`),
`cdFrac(ent, slot)`, *added* `cdLeft`, `reduce(ent, slot, s)`, `reset(ent, slot?)` (all slots when omitted).
Also *added*: `unguard(ent) -> {blocked, blocks, perfects, heldT}|null`, `tagFor(ent, tag, dur)` (timed fxTag only),
`busy(ent)` (mid dash/leap). Slots are any string (kits use `space q f shift`; companions/enemies may use others).

| block | params (defaults) | returns |
| --- | --- | --- |
| `melee_arc` | all `combat.meleeArc` params + `lunge` (tiles forward impulse), `repeat` (n swings, e.g. twin daggers 2) | hits[] (reused) |
| `projectile` | all `combat.projectile` params; `anim` ('cast'), `sfx` | ent |
| `multishot` | `n=3`, `spread=30` (deg, total fan), `ring` (full circle), `parallel` (side spacing in tiles, e.g. Twin Bolts 0.3) + projectile params | ents[] |
| `beam` | `angle, range=7, w=0.5, dmg, pierce=true` (false: first target), `stopAtWall=true`, `knockback=2`, `color`, `status`, `onHit`, `fx` ('beam'), `anim` ('cast'; `false` leaves the caster's animation alone) | hits[] |
| `dash` | `angle, dist=2.5, speed=14, invuln` (s or true = whole dash), `dmg` (contact; 0 = none), `hitRadius=0.5`, `stopOnHit`, `maxHits`, `knockback=6`, `status`, `tags` (forwarded to the hit), `exclude` (entity ids never hit), `through` (no body blocking), `trail=true`, `color`, `onHit(game,t,dealt,c)`, `onEnd(game,c,hits)` | true |
| `aoe_ring` | `r=2, dmg, knockback=6, pull, delay, telegraph, fx='shockwave', color, status, shake, zone` (+ x,y) | hits[] or pending ent |
| `ground_target` | `x,y` or `dist=4` ahead along `angle` (clamped by walls), `r=1.5, dmg, delay=0.8, telegraph='circle', meteor, fx` ('meteor' with meteor, else 'burst'), `zone`, `shake` | pending ent |
| `summon` | `kind`/`def, n=1, max, key, ttl, brain, powerMul, hpMul, taunt, replace=true, onReplace(game, old), attacks, look, scale, dist` + summon opts. Enemy casters spawn data enemies owned by them (`data.summoned`, refused at `max`) | ents[] |
| `buff_self` | `id='buff', dur=5, mods {power, speed, dmgTaken, attackSpeed, cdr, kbImmune, ccImmune, slowImmune, critChance, kbResist, goldFind}` (or those keys directly), `status` (id or `{id,t,p}`), `statusPower`, `fxTag`, `allies` (r: same buff to allies), `fx='sparkle'`, `color` | mod record |
| `guard` | `arc=120, reduce=0.85, perfect=0.25` (s window, 0 = none), `perfectFull=true, reflect=true, stunAttacker=1, speedMul=0.6, dur=Infinity, color, onBlock(game, ent, ev), anim='block'` | guard state |
| `heal` | `n` / `pct` (of hpMax) / `coef` (x power), `target`, `allies` (r) | healed |
| `zone` | all `combat.zone` params; position `x,y` or `dist` ahead or the caster; `follow: true` = the caster | ent |
| `stealth` | `dur=5, speed=0.25, smoke` (true or zone params; default smoke r 2, 3 s, slow), `fx` | true |
| `chain` | `target` or nearest from `x,y`/caster, `range=4, jumps=3` (targets), `dmg, falloff=0.8` (>1 grows), `color, status, element='storm', exclude` (entity ids or entities never chosen, e.g. the starting target)`, fx='bolt', onHit(game,t,dealt,c,i)` | hits (new) |
| `leap` | `x,y` or `dist=5` ahead, `dur=0.6, height=2, invuln=true, land {r=2.5, dmg, knockback=7, fx='shockwave', status, shake=0.3, zone}, onLand(game, c)` | true |
| `blink` | `angle, dist=3.5, away` (reverse), `invuln=0.2, color, fx` | `{x0, y0, x, y}` or false |

Enemy and companion attacks are these blocks too (section 9).

## 6. Player (`game.sys.player`; `game.player` is the entity)

Created in `init` with novice stats `hp 25, power 2, defense 0, speed 3.2` (Meta's `recalc` overrides).
Per step: movement `input * stats.speed * p.data.kit.speedMul` (statuses/mods/guard applied by physics), kit
dispatch, items (`pressed.item1..6 -> inventory.useSlot(0..5)`, **0-based**), target pick every 4 steps,
`pressed.interact -> interact()`. All input is ignored while `game.inputLock > 0` or `p.data.scripted` (held
abilities are released). Attacks/abilities need `flags.has_stick` or a class, and no stun.

- `refreshLook()`: exactly COMMON rule 12: base `PLAYER_LOOKS[flags.look_choice|0]`; `CLOAKED` while
  `!flags.look_chosen`, else `classes[classId].look`, `specs[specId].look`, `p.data.kit.lookPatch`,
  `inventory.equippedLookPatch()` (if Meta provides it), and at level >= 10 an aura (`spec.aura || class.aura ||
  {style: warrior flame / mage sparkle / rogue shadow, color: spec.color || class.color}`); `held` = stick while
  `has_stick` and classless; finally `p.data.scriptLook` (setLook op). Bumps `lookRev`, emits `'look:changed'`.
  Listens to `'flag'` (look_choice, look_chosen, has_stick), `'class:set'`, `'spec:set'`, `'levelup'`,
  `'cosmetic:equipped'`, and zone load.
- `interact()` (also `game.commands.interact`): runs the target's `interact.do` with ctx `{self, npc}` and emits
  `'interact' {ent}`. *added*: `interact.if` (conds) — when it fails, `interact.else` (ops) runs, or a toast of
  `interact.locked` ('Not yet.'). Gates use this for `req`.
- `pickTarget()`, `canAttack()`. `HudState.prompt = {text: interact.prompt || 'Talk', key: 'E', entId}`.

## 7. Kits — object and lifecycle (for the Class kits engineers)

```js
export default {
  id: 'knight', parent: 'warrior',                 // a spec names its class; the class has parent null
  resource: { id, name, max, color, start, pips },  // pips: true -> HUD kitHud.pips/pipsMax filled from it
  basicMode: 'auto' | 'raw',                       // default 'auto'
  interval: 0.44 | (game, p, rank) => seconds,      // auto mode repeat interval (default 0.45)
  basicInfo: { name, icon } | (game, p, rank) => ({ name, icon }),   // HUD basic
  onEquip(game, p), onUnequip(game, p), update(game, p, dt), hud(game, p, hud),
  basic(game, p, ctx),
  abilities: { space|q|f|shift: { id, name, icon, desc, unlock, cd, cost, need, cdOnRelease, cast, hold, release, isActive } },
  hooks: { onHit, onHurt, onKill, onBlock, onOutgoing, onIncoming, onLethal, onMinionHit, onMinionKill, onMinionOutgoing, onCatch },
};
```

- **Layering**: `kits.set(ent, classId, specId)` builds (and caches) a layered kit: `layers = [class, spec]`.
  `basic`, `basicMode`, `interval`, `basicInfo` come from the top-most layer that defines `basic`; each ability slot
  from the top-most layer that has it; `resource` from the top-most layer that has one (Monk can redefine Mana as Ki);
  `onEquip`, `update`, `hud` and every hook run for **every** layer, class first. A spec that wants to extend the
  class basic calls it explicitly: `game.kits.registry.warrior.basic(game, p, ctx)`.
- `kits.active(ent)` -> the layered object `{id, classId, specId, parent, layers, resource, basic, abilities, hooks,
  basicMode, interval, basicInfo}`. `kits.registry` (= `KITS`), `kits.register(kit)` *added*, `kits.ability(ent,slot)`,
  `kits.unlocked(ent,slot)`, `kits.level(ent)`, `kits.rank(ent)`, `kits.holding(ent,slot)`, `kits.releaseAll(ent)`,
  `kits.setResource(ent, v)` *added*, `kits.resource(ent) -> {value, max, ...}`, `kits.gain(ent, n)` (clamped),
  `kits.spend(ent, n) -> bool` (false and unchanged when short; `spend(ent, 0)` is true).
- **When it is equipped**: the Sim listens to `'class:set'` / `'spec:set'` and also follows *changes* of
  `progression.classId/specId` each step (so a loaded save equips without events). A direct `kits.set()` sticks until
  progression changes. On every set: the old layers' `onUnequip` (reverse order) after releasing holds and the
  guard; fresh `p.data.kit = {speedMul: 1, lookPatch: null}` (**all kit state lives here; class and spec share it —
  namespace your keys**); `p.data.resource` (value kept when the resource id is unchanged, else `start`); new layers'
  `onEquip`; `refreshLook()`; `'ability:unlocked'` for newly available slots.
- `'ability:unlocked'`: Meta's progression is the single emitter (richer payload) whenever it provides `abilityList`; the Sim only emits `{slot, id}` as a fallback when there is no progression system (on `'levelup'` for abilities whose
  `unlock` level was just reached, and on class/spec set). Never both. `'ability:locked' {slot, id, unlock}` when a locked
  slot is pressed.

### 7.1 `ctx` (one reused object; do not keep it)

`{dir, angle, pressed, held, released, heldT, rank, level, slot, dt, moving, moveAngle, moveX, moveY, companion,
input, kit, cancelled}`. For the basic: `dir/angle` = the attack key (on release: the released key), `pressed` this
step, `held` while down, `released` on the release step, `heldT` seconds held (on release: total), `cancelled` when
the Sim force-releases (input lock, stun). For abilities: `slot`, `angle` = facing, `moveAngle` = movement
direction (or facing when standing still: use it for dashes "in the move direction, or facing"), `heldT` for holds.
`rank` = `progression.rank()`, `level` = `progression.level`.

### 7.2 Basic dispatch

- `'auto'`: while an attack key is held and the timer is ready, `basic()` is called; its return value: `false` = did
  not fire (no timer), a number = seconds until the next call, else `interval`. The timer runs `1 + mod attackSpeed`
  times faster. The player faces the attack direction.
- `'raw'`: `basic()` is called **every step** while held and once on the release step; the kit times everything
  (charge-up, hold-to-guard, combos with their own timers).

### 7.3 Ability dispatch

On `pressed[slot]` and not already holding: locked (`level < unlock`) -> `'ability:locked'`; on cooldown -> nothing;
`need` (or `cost`) > resource -> text "Not enough <Resource>" + sfx `ui_bad`; else `cast(game, p, ctx)`.
`cast` returning `false` refuses (nothing spent, no cooldown). Otherwise: `spend(cost)`, `start(cd)` (unless
`cdOnRelease`), `'ability:cast' {ent, slot, id}`, and if the ability has `hold` or `release` it enters the hold
state: `hold(game, p, ctx, dt)` every step while the key is held (return `false` to end, e.g. resource empty),
then `release(game, p, ctx)` (and the cooldown if `cdOnRelease`). An ability with only `hold`/`release` (no `cast`)
starts holding on press. `cost` = spent on cast; `need` = required but not spent (drain abilities).
HUD per slot: `id, name, icon ('lock' while locked), desc (ability.desc or data.classes[class].abilities[id].desc),
unlocked, unlockLevel, cdFrac, ready (unlocked, off cooldown, affordable), active (holding or isActive(game, p)), cost`.

### 7.4 HUD

`hud.basic`, `hud.abilities`, `hud.player.resource` are filled by the Sim. `hud.kitHud` is reset to null each poll;
with `resource.pips` the Sim sets `game.kits.kitHud = {pips, pipsMax}`. In `kit.hud(game, p, hud)` set
`hud.kitHud = game.kits.kitHud` and fill `pips, pipsMax, stance, label` (preallocated, no allocation).

### 7.5 Hooks (all `(game, p, e)`)

`onHit` (p dealt a hit: the `'hit'` payload), `onHurt` (p was hit), `onKill` (`'death'` payload, p is the killer),
`onBlock` (`'block'` payload), `onMinionHit` / `onMinionKill` (a summon owned by p), `onCatch` (`'proj:caught'`),
and the synchronous damage hooks `onOutgoing` / `onIncoming` / `onLethal` / `onMinionOutgoing` (`info`, mutable, see 4.1).
DoT ticks arrive as hits with `e.dot = true`.

## 8. Recipes for kit mechanics

- **Guard / Shield Wall (hold)**: `f: {hold..., cast(g,p){ g.abilities.use('guard', p, {arc:120, reduce:0.85,
  perfect:0.25, reflect:true, stunAttacker:1, speedMul:0.6}); }, release(g,p){ const r = g.abilities.unguard(p);
  /* r.blocked -> Shield Slam */ }, hold(){} }`. Perfect blocks arrive in `hooks.onBlock(e.perfect)`; reflections are
  automatic. For a custom rule use `onIncoming` and set `info.amount`.
- **Parry window** = the same `guard` with a short `dur` (e.g. 0.3) and `perfect` = window.
- **Deflect (Monk)**: `abilities.use('melee_arc', p, {..., deflect: true})` or `combat.reflectInArc(p, p.x, p.y,
  angle, 120, 1.5, {homing: 6})`.
- **Charge (Sorcerer, Archer)**: `basicMode: 'raw'`; on `ctx.held` set `p.data.kit.speedMul = 0.7`,
  `game.ents.setFxTag(p, 'charge', true)`, grow `p.glow`; on `ctx.released` pick the tier by `ctx.heldT`, fire, reset.
  Check `ctx.cancelled` to fizzle.
- **Combos with their own timing (Monk 0.18 s beats)**: auto mode and return the next interval from `basic()`.
- **Summon / familiars**: `abilities.use('summon', p, {def: FOX, key: 'familiar', max: 3, onReplace: (g, old) =>
  g.abilities.use('heal', p, {pct: 0.1}), brain: 'ally_melee', attacks: [...], powerMul: 0.5})`. Pets swarm marked
  targets automatically; +50% vs marked via `onMinionOutgoing(info)`. Count with `combat.summonsOf(p, 'familiar')`.
  Summons are removed on zone change.
- **Stealth (Thief)**: `abilities.use('stealth', p, {dur: 5, speed: 0.25, smoke: true})`; the first damaging hit
  breaks it and arrives with `info.fromStealth` in `onOutgoing` (set `info.crit = true; info.critMult = 3`).
  Backstab "facing away": `Math.abs(angleDiff(target.angle, angleTo(target.x, target.y, p.x, p.y))) > 1.9`.
- **Decoy (Ninja)**: `combat.decoy(p, {ttl: 2.5, onExpire: (g, d) => g.abilities.use('aoe_ring', d, {r: 1.8, dmg: 2,
  fx: 'smoke'})})` then `abilities.use('blink', ...)` / `physics.teleport`. Enemies retarget to it at their next think.
  Note the decoy's power is 60% of the owner's by default (pass `power: p.stats.power`).
- **Returning projectiles (shuriken, axes)**: `{returns: true, pierce: true, onCatch: (g, proj, owner) =>
  g.abilities.reduce(owner, 'f', 0.3)}` or `hooks.onCatch`.
- **Lunge / Shield Bash**: `dash` with `stopOnHit`, `status: {stun: 0.8}`; `melee_arc` with `lunge: 0.6`.
- **Buffs with fxTags**: `buff_self {id: 'war_cry', dur: 5, power: 0.3, fxTag: 'haste'}`; `fxTag` shows the tag
  without the haste speed effect, `status: 'haste'` gives both.
- **Speed**: `p.data.kit.speedMul` (kit-owned, multiply into it each step in `update`) or timed `addMod(p, id, {speed})`.
- **Incoming damage**: `hooks.onIncoming(g, p, info)`, `addMod(p, 'bulwark', {dmgTaken: -0.3}, 0.2)` refreshed in
  `update` for allies in range, or `status shield`.
- **Look**: set `p.data.kit.lookPatch = {held: {style: 'runeblade', glow: '#ff7a2f'}, aura: {...}}` then
  `game.sys.player.refreshLook()` (bumps lookRev). Never mutate `p.look` directly. Other entities: replace
  `e.look` and `e.lookRev++`.
- **fxTags**: statuses add their own; manual ones `game.ents.setFxTag(p, 'rune_fire', true)`; timed
  `game.abilities.tagFor(p, 'frenzy', 6)`.
- **Hit-stop / shake**: `hitStop: 0.06, shake: 0.3` on any damaging block.
- **Ultimates / big moments**: companions bark on `'ability:cast'` with slot `shift`.

## 9. AI (`game.ai`) and the enemy data schema

```js
ai: { brain, aggro=6, leash=12 (0 = none), keepRange=4, fleeHp (0..1), blinkCd (s), swarm (bool), regen (hp/s),
      taunt, summon: { kind, n=1, max=3, cd=8, windup=0.7, color } },
attacks: [ { use: <block name>, ...block params, name, cd=1.5, windup (>= 0.3 enforced for enemies; default 0.45),
             range=1, minRange=0, telegraph: 'circle'|'line'|'cone'|null, telegraphColor, weight=1, recover=0.3
             (dash 0.7), track (re-aim during the first 60% of the windup), atTarget (aim the block at the target
             point, like ground_target), r, w, arc, dist } ],
onDeath: { spawn: kind, n, opts }, flying: bool, team,
boss: { phases: [{ untilHp, pattern: [attack index or name/use] }], shieldAt: [0.66, 0.33], difficulty | shieldDifficulty: [2, 3], tags }
```

- Think at 10 Hz staggered by id; steering vector applied every step; A* only when stuck (re-planned at most every
  1.5 s). Targets need LOS to be acquired; taunting entities (`data.taunt`, decoys) are strongly preferred; stealthed
  targets are ignored; smoke blinds. Being hit provokes (wander brains fight back, returning enemies turn around).
- Attack flow: pick a ready attack in range (weighted; bosses: the phase pattern in order, skipping an entry after 3 s
  out of range), **windup**: `anim 'charge'` + (when `telegraph` resolves) an `effect` telegraph entity
  (`look.model 'telegraph_<shape>'`, `angle`, `r`, `len`, `w`, `arc`, at the target point for `ground_target`/`atTarget`,
  else following the attacker; default shapes: aoe_ring/ground_target/summon/zone/leap circle, dash/beam line,
  multishot cone, others charge-only), then the block runs with `angle` = aim (and `x,y` for ground targets, `dist`
  to the target + 1.2 for dashes), then `recover`. Stun interrupts windups. Events `'ai:windup' {ent, attack,
  windup, telegraph}`, `'ai:attack' {ent, attack}`, `'ai:aggro' {ent, target}`, `'ai:reveal' {ent}`.
- Brains: `wander` (roams around home; fights when provoked), `chaser`, `skirmisher` (keeps `keepRange`, strafes),
  `charger` (mid range, dash attacks, long recover), `turret` (never moves), `swarmer` (orbits then swoops; `swarm`
  separates from its own kind), `summoner` (skirmishes, summons `ai.summon` with a circle telegraph), `ambusher`
  (hidden: alpha 0.35, anim sleep, fxTag sleep, until a target is within `aggro` or it is hit; then poof + chaser),
  `flee` (runs, fights when cornered), `guard` (town guards: only while `flags.wanted`; otherwise goes home or lets
  Story's `moveTo` patrol; default attack when none is given), `boss`, `idle` *added* (stands; with `ai.regen` it is
  the training dummy). Any brain with `fleeHp` flees for 3 s below that hp fraction; `blinkCd` blinks around the
  target. Leash: beyond `leash` tiles from home the enemy returns home and heals to full.
- Ally brains (summons, companions, clones; team player): `ally_melee`, `ally_ranged` (keeps 3.5), `ally_tank`
  (taunts). They fight enemies within 7 tiles (and within 9 of the owner), prefer marked targets and the owner's last
  target, otherwise follow in formation behind the owner. Ally windups default to 0.12 s, no telegraph.
- Boss shields (12a): `data.minHp` holds hp at the next threshold, so the shield always triggers: invulnerable
  (`data.shielded`, fxTag `shield`, `HudState.boss.shield`), attacks at half damage and double cooldowns,
  `gates.ask({context: 'boss_shield', difficulty, tags})`; correct -> shatter (burst, ring, screenFlash, shake, stun
  2 s, next threshold); wrong/skipped -> stays, asks again after 8 s. Events `'boss:shield' {ent, on, index, retry}`,
  `'boss:phase' {ent, phase}`. `HudState.boss` shows the nearest engaged boss within 25 tiles.
- API: `attach(ent, aiDef, attacks?)`, `interrupt(ent)`, `forgetTarget(target)`, `blind(ent, s)`, `target(ent)`,
  `register(name, fn(e, ai))`, `brains`.

## 10. Companions (`game.companions`)

`set([classIds])` (op `['companions', [...]]`), `active` (entities), `classIds`, `regroup()`, `rescale()`, `bark(ent, kind)`.
Entities: type `companion`, team player, `owner` = player, kind = classmate npc id (`bram`/`elowen`/`pip`), look from
`data.npcs[npc].look` (or a built-in default) with `data.classes[id].look` merged, at the player's level with 70% of the
class numbers, never die (down 10 s, back at 50%), teleport back beyond 14 tiles, regroup on zone load, saved
(`save -> {list}`). Barks are `text` fx style `bubble` on level-up, boss shields, the player's Shift ultimate, and
going down. Data the Class kits engineers may provide (all optional):

```js
data.classes.warrior.companion = { npc: 'bram', name: 'Bram', mult: 0.7, brain: 'ally_melee', keepRange, speed,
  stats: { hp, hpPerLevel, power, powerPerLevel, speed },   // else data.classes[id].stats, else CLASSES base numbers
  look,                                                      // replaces npc look + class patch
  basic: { use: 'melee_arc', range: 1.2, arc: 100, dmg: 1, cd: 0.6, windup: 0.1, ... },   // ai attack (block params)
  ability: { use: 'dash', dist: 2.5, dmg: 1.5, status: { stun: 0.8 }, cd: 5, range: 3, minRange: 1.3, ... },
  barks: { levelup: [...], shield: [...], ultimate: [...], down: [...] } }
```

## 11. For Story

- Scripted movement: `game.physics.moveTo(ent, x, y, {speed, run, stopAt, face}) -> Promise<bool>` (+ `'ent:arrived'`),
  `game.physics.stop(ent)`, `game.physics.teleport(ent, x, y)`. `ent.data.scripted = true` makes AI and player input
  skip the entity (physics and moveTo still run). The player also ignores input while `game.inputLock > 0`.
- `game.ents.spawn(kind, x, y, opts)` (section 1) and op `['spawn', kind, markerOrXY, {n, spread, sid, tag, level,
  team, interact, look, ai, noAi, poof, ...}]`; op `['despawn', tagOrSidOrKind, {poof: false}]`; op `['kill',
  tagOrSidOrKind | {tag}]` (no rewards, no onDeath spawns, companions only go down); op `['heal']` (player full),
  `['heal', n]`, `['heal', who, n]`; op `['setLook', who, patch]` (`'player'` + `'$chosen'` sets `flags.look_chosen`
  and refreshes; another patch is kept as `player.data.scriptLook` until `['setLook','player',null]`; other entities get
  the patch merged); op `['teleport', zone, marker]` (instant); op `['travel', zone, marker]` (returns the fade promise).
  `ents.find(who)` / `ents.findAll(who)` resolve `'player'`, `'@tag'`, sid, kind.
- Barrier: `player.data.leash = {x, y, r}` (cleared on zone load unless `keep: true`); a `barrier` effect entity is
  yours to spawn (`ents.spawn('barrier', x, y, {look: {rig:'effect', model:'barrier', r: 4}})`).
- `player.data.minHp = 1` (control step): hp floors at 1 and `'player:down'` is not emitted.
- Crime: the Sim emits `'crime' {victim}` when a player-side hit damages a `town` entity. Town NPCs go down for 8 s
  instead of dying (`'ent:down'`/`'ent:up'`); set `data.canDie` to allow death. Guards use brain `guard`.
- NPC interact: set `ent.interact = {prompt, range, do, if, else, locked}`; the player picks the nearest in range.
- Exits, triggers and respawns are checked only while `game.freeze` is empty; a running fade travel keeps ticking
  through any freeze (the world system is `always: true`).

## 12. For Meta

- XP on defeat: `progression.addXp(n)` (Sim calls it; text fx style `xp` is the Sim's). Pickups call
  `inventory.addGold(n)`, `inventory.give(id, n)`, `combat.heal`, `progression.addXp(n)` (section 4.5); event `'pickup'`.
  `combat.dropPickup(kind, x, y, n, itemId)` for Meta/kits (chest coin fountains, Thief).
- `'player:down' {source}` once per down (`player.data.down = true`, anim ko, no control). Revive by healing
  (`combat.heal(p, p.hpMax)` clears down) and/or emitting `'player:revived'` (the Sim clears down, heals to full if 0).
  Use `world.travel` / `loadZone` for the infirmary.
- The Sim reads `progression.level`, `progression.rank()`, `progression.classId/specId` (follows changes),
  `progression.addXp`, `inventory.useSlot(i)` (**0-based**), `inventory.equippedLookPatch()` (optional; please add),
  `gates.ask(req) -> Promise<{correct}>` (boss shields).
- Level-up knockback ring: `game.abilities.use('aoe_ring', game.player, {r: 3, dmg: 0, knockback: 9, fx: 'ring', color: '#ffd24a'})`.
- Focus scroll: `kits.setResource(p, kits.resource(p).max)`, `abilities.reset(p)`, `combat.addMod(p, 'focus', {power: 0.5}, 6)`,
  `abilities.tagFor(p, 'haste', 6)`.
- God mode / debug: `p.status.invuln = 1e9` or `p.data.minHp = 1`; `game.ents.caps` for stress tests.
- The Sim's player stats before `recalc()`: hp 25, power 2, defense 0, speed 3.2 (novice level 1).

## 13. For UI / renderers

- HudState fields owned by the Sim: `zoneName, player.{name, hp, hpMax, look, cloaked, resource}, basic, abilities,
  companions, boss, prompt, kitHud, minimap (px, py, blips, blipCount)`; all objects are preallocated and reused.
- Effect looks the Sim creates: `telegraph_circle|line|cone` (with `ent.angle`, look `r, len, w, arc`; ttl = windup),
  `meteor` (`ent.z` falls 8 -> 0), zones (`ground_fire, ground_frost, smoke, caltrops, shield_bubble, zone_ring`, look
  `r`), `rune_seal` (`w, h, r`), `chest / rune_chest / chest_open`, pickups `gold, heart, item (icon), xp_orb`.
  Projectiles `{rig:'projectile', model, color, glow, size, trail: true}` (shared look objects per model+color).
  Anchors (`look: null`) are always asleep and never in FrameState.
- fx text styles used: `dmg, crit, heal, xp, gold, miss ('Immune', 'Shielded', 'Blocked', 'Perfect!', 'Absorbed'),
  info, bubble` (companion barks carry `ent` and `dur`).
- Extra bus events (all additions): `'block'`, `'immune'`, `'status'`, `'status:end'`, `'stealth:break'`, `'heal'`,
  `'hitstop'`, `'pickup'`, `'summon'`, `'summon:expired'`, `'proj:caught'`, `'proj:reflected'`, `'ent:down'`,
  `'ent:up'`, `'ent:arrived'`, `'ability:locked'`, `'ai:windup'`, `'ai:attack'`, `'ai:aggro'`, `'ai:reveal'`,
  `'boss:shield'`, `'boss:phase'`. `'player:down'` carries `{source}`.

## 14. Requests to other packages

- **Meta**: add `inventory.equippedLookPatch()` (cosmetics patch) and emit `'cosmetic:equipped'`; `'ability:unlocked'` is Meta's alone; call `game.sys.player.refreshLook()` is not needed after setClass/setSpec
  (events or the classId change are enough); `progression.recalc()` should keep `player.stats.{power, defense,
  speed}` and `hpMax` current (the Sim never overwrites them after init).
- **Story**: NPC defs that should fight need `ai` + `attacks` (or `onAttacked: 'guard'` for the guard brain); the Sim
  emits `'crime'` itself, please do not emit a second one from `'hit'`. `npc.populate(zone)` is called by the world
  after furniture.
- **Class kits**: read sections 7-10; put companion numbers in `data.classes[id].companion` if you want to tune them.
- **Integrator**: nothing frozen needs to change.

## 15. Known gaps / judgment calls

- Exits/gates use rects centered on their marker tile (`area: [x, y, w, h]` is accepted for exact rects).
- Enemy level scaling from spawn `level` uses the balance-sheet curves; content authored at the right level is unaffected.
- `input.js` is the skeleton's complete version (no changes needed); both Shift keys share one state.
- Pathfinding is used by scripted movers and stuck AI only; enemies that cannot reach a target simply mill about.
- No allocation-growth test (optional in the brief); hot loops avoid allocation, per-attack objects are allocated.
- Companions use generic ai attacks built from data (not the class kit code), so kit boons do not affect them.
