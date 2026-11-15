# Story systems: notes and authoring reference

Owner: Story package. Files: `src/core/{ops,dialogue,cutscene,quests,npc,clock}.js`, `tests/node/story*.test.mjs`
(`story_fixtures.test.mjs` holds shared test fixtures and the physics shim; it contains no tests).

Everything here is tolerant of content errors: unknown ops, conditions, steps, goal types, markers, dialogue
nodes or ids **warn once and continue**; nothing throws. Warnings go to `console.warn('[story] ...')`, to
`game.ops.warnings` (last 100 strings) and to the bus as `'story:warn'` `{msg}`. Set `game.quiet = true` to
silence the console (tests do).

---

## 1. Ops and conditions (`game.ops`)

```js
ops.run(actions, ctx) -> Promise | undefined   // in order; an op returning a Promise makes the rest wait
ops.exec(action, ctx) -> result                  // one action (never throws)
ops.test(conds, ctx) -> bool                     // AND; null / [] -> true; a single condition is accepted too
ops.register(name, fn(game, action, ctx))        // action = the array after substitution, action[0] = name
ops.registerCond(name, fn(game, cond, ctx) -> bool)
ops.has(name), ops.hasCond(name), ops.warn(msg), ops.warnOnce(key, msg)
ops.sub(value, ctx), ops.text(str, ctx), ops.playerName()
ops.resolveWho(who, ctx) -> ent|null, ops.resolveAll(who, ctx, out) -> ent[], ops.resolvePos(v, ctx) -> {x,y}|null
```

- `actions` may be a list of actions or one action (`['toast','hi']`). Unknown op: warning once, skipped.
  An op that throws or rejects: warning, the list continues.
- If a Promise returned by an op resolves to a value other than `undefined`, it is stored as `ctx.chosen`, so a
  later action in the same list (or cutscene) can use `'$chosen'` (pickers: `lookPicker`, `classPicker`...).
- **Substitution** (applied to an action's arguments right before it runs, recursively into plain objects and
  arrays, but NOT into nested op lists such as `{pass: [[...]]}` which are substituted when they run):
  - a string that is exactly `'$key'` becomes `ctx[key]` (`undefined` when absent): `'$chosen'`, `'$self'`
    (the entity the interact/dialogue is about), `'$npc'`, `'$choice'` (index of the last dialogue option);
    `'$name'` is the player's name, `'$player'` the player entity. Non-identifiers like `'$5'` are left alone.
  - `{name}` inside any string is the player's name; `{key}` is `ctx[key]` when that is a string or number.
- Unknown conditions count as **false** (warned once).

### Conditions registered by Story

| condition | meaning |
| --- | --- |
| `['flag', k]` / `['flag', k, v]` | flag truthy / strictly equal to v |
| `['not', cond]` or `['not', 'flag', 'k']` | negation |
| `['any', c1, c2, ...]` (or `['any', [c1, c2]]`) | OR (addition) |
| `['quest', id, 'none'|'active'|'done']` | quest state (`'turnin'` counts as active) |
| `['quest', id, 'step', n]` | active and on step index n (0-based) |
| `['quest', id, 'atLeast', n]` | done, or active with step >= n (addition) |
| `['quest', id]` / `['quest', id, 'started']` | active or done (addition) |
| `['rel', npcId, op, n]` / `['rel', npcId]` | friendship compare / > 0 |
| `['hour', 'between', a, b]` | `a <= hour < b`, wraps past midnight when a > b (`['hour','between',20,6]`) |
| `['hour', op, n]` | compare (addition) |
| `['hp', who, op, n]` | hp compare; n may be `'50%'` of hpMax (addition; used by the ambush `control`) |
| `['near', who, markerOrWhoOrXY, r=2]` | distance check (addition) |
| `['zone', id]`, `['daypart', 'evening']`, `['wanted']`, `['cutscene']` / `['cutscene', id]` | additions |

`op` is one of `>= > <= < == = !=`. Meta owns `level class spec hasItem gold`.

### Actions registered by Story

| action | effect |
| --- | --- |
| `['flag.set', k, v=true]`, `['flag.clear', k]`, `['flag.add', k, n=1]` | flags (`clear` / `add` are additions) |
| `['toast', text, style='info']` | toast (`{name}` substituted) |
| `['fx', fxEvent]` | `game.fx`; extras: `at: marker|who|[x,y]` (+ `dx`, `dy`) sets x/y; `ent: who` string resolves to an id |
| `['sfx', id]` | emits `'sfx'` `{id}` |
| `['quest.start', id]`, `['quest.advance', id, onlyFromStep?]`, `['quest.complete', id]`, `['quest.track', id]` | quests (last two additions) |
| `['dialogue', id, {npc}?]` | opens a dialogue; Promise until it closes. npc = `{npc: who}` or `ctx.self` |
| `['cutscene', id]` | plays a cutscene; Promise until it ends (inside a running cutscene it runs at once as an extra thread; elsewhere it queues) |
| `['rel', npcId, delta=1]` | friendship (clamped -100..100), emits `'rel'` `{npc, value, delta}`; npcId may be `'$self'` |
| `['tutorial', text, keys, {until}?]` / `['tutorial', null]` | tutorial text (also a cutscene step); `until` clears it automatically when the condition passes |
| `['bubble', who, text, seconds=2.5]` | speech bubble (also a cutscene step) |
| `['if', conds, thenOps, elseOps]` | branch (addition) |
| `['wait', s]` | Promise resolved after s sim seconds of unfrozen world (addition; in cutscenes use the step) |

Sim owns `teleport travel spawn despawn gate.open heal setLook companions kill`; Meta owns `give take gold xp
shop gate chest lesson classPicker specPicker lookPicker save`.

### who resolution (`ops.resolveWho`)

`'player'` → the player. An entity object → itself. A number → entity id. `'self'`, `'$self'`, `'npc'` →
`ctx.self`. `'@tag'` → the entity with that tag nearest to the player (`resolveAll` returns **all** tagged
entities; `face`, `anim`, `kill` use all). Any other string → the entity whose `kind`, `data.npcId` or `def.id`
equals it, nearest to the player. Removed entities never match. Cutscene steps `move`, `escort` and `bubble`
**spawn on demand** an id that is in `data.npcs` (through `npc.spawn`) or `data.enemies` (`ents.spawn`) when no
such entity exists: at `opts.from` / `opts.at` (marker, who or `[x,y]`), else marker `<id>`, else marker
`<id>_spawn`, else 6 tiles north of the player (with a `poof`). Spawned entities stay after the cutscene
(`data.cutsceneSpawned = cutsceneId`); despawn them with Sim's `despawn` if needed.

Positions (`resolvePos`): `[x, y]` world tiles (marker tile coords are NOT arrays here; write marker names),
`{x, y}`, a marker name of the current zone, or a who (that entity's position).

---

## 2. Dialogue (`data/dialogues/*.js`)

```js
baker_talk: {
  start: 'hello',                       // node id, or [{if: conds, to: 'node'}, ..., 'fallbackNode'] (first match wins)
  who: 'baker',                         // optional default speaker for every line
  nodes: {
    hello: {
      do: [['flag.set', 'met_baker']],  // runs on ENTERING the node, before its first line
      say: [ { who: 'baker', mood: 'happy', text: 'Fresh bread, {name}!' },
             { who: 'player', text: 'Smells great.' } ],      // also: one object, or plain strings
      options: [                                            // shown with the LAST line
        { text: 'Buy a loaf', do: [['shop', 'bakery']], end: true },
        { text: 'Secret menu', if: [['rel', 'baker', '>=', 3]], hint: 'Become friends first.', goto: 'secret' },
        { text: 'Bye', end: true },
      ],
      after: [['toast', 'hi']],          // optional: runs after the last line is read (no options) or after a choice, before its do
      goto: 'next' | [{if, to}, ..., 'fallback'],   // used when there are no options; missing => conversation ends
      end: true,                         // force the end
    },
  },
}
```

- Lines: `{who, mood, text, if, name, portrait}`. `if` hides a line. `name` overrides the shown speaker name.
  Default `who`: line.who, else node.who, else dialogue.who, else the NPC the conversation is with, else none
  (narrator, empty speaker).
- `who` → speaker: `'player'` → player name + `player.look`; an npc/enemy id → live entity name/look when
  present, else the def's `name`/`look`; `'@tag'`, `'self'`; unknown strings are shown as the name with no look.
  `portrait` is `'laporte'` when the id is `laporte`, the def has `portrait: 'laporte'`, or the look has
  `hero: 'laporte'`; otherwise `def.portrait` or `null`.
- Options: an option whose `if` fails is hidden, unless it has `hint`: then it is shown `disabled` with the
  hint text. Choosing: `option.do` runs (awaited), then `goto` / `end`; **neither => the conversation ends**.
  To return to a menu, `goto` the menu node.
- `{name}` is substituted in texts, option texts and hints.
- If every option is hidden the node behaves as if it had none.
- Ops in `do` may open other modals (shop, pickers, gate questions): the conversation waits and comes back when
  that modal closes. A `['dialogue', other]` inside `do` runs the other dialogue, then continues.

Engine: `dialogue.open(idOrDef, {npc, ctx}) -> Promise` (resolves with `ctx.chosen` when the conversation
closes; the Promise has `isDone()`). `npc` may be an entity or an id. Opening while another conversation shows a
line queues it. Opening with an NPC: the NPC faces the player (and the player the NPC), `physics.stop`, and
`npc.data.talking` is set (NPC routines pause) until it closes. `dialogue.line(who, text, {mood}) -> Promise`
(one line; cutscene `say`), `dialogue.cancel(promise?)`, `dialogue.active` → `{id, node, npc}|null`,
`dialogue.busy`. Commands `dialogueAdvance()`, `dialogueChoose(i)` (i indexes `modal.options`, disabled ones
included; choosing a disabled one emits `'sfx'` `ui_bad`). Escape (`closeModal()`) ends the conversation on
the next step.

Modal object (opened once per conversation, **mutated in place for each line**):
`{type: 'dialogue', speaker, speakerLook, portrait, mood, text, options: [{text, disabled, hint}] | null,
id, node, who, rev}`. `rev` increments on every line. Events: `'dialogue:open'` `{id, npc}`,
`'dialogue:line'` `{speaker, text, who, id, node, options}`, `'dialogue:choice'` `{id, node, index, text}`,
`'dialogue:close'` `{id, npc, node}` (additions except `dialogue:line`).

---

## 3. Cutscenes (`data/cutscenes/*.js`)

`{id, skippable: true, once: false, steps: [...]}`. `skippable` defaults to **true**; write
`skippable: false` for scenes that contain gameplay (`control`, tutorials). `once: true` makes `play()` a no-op
after it has finished once. Every finished cutscene sets flag `cs_<id>`.

A step is a cutscene step below or **any op action** (an op returning a Promise blocks until it resolves).
Arguments are substituted like ops (`{name}`, `$chosen`...).

| step | blocking | notes / timeout |
| --- | --- | --- |
| `['wait', s]` | yes | sim seconds, counted only while the world is not frozen |
| `['waitFor', cond, {timeout: 60}]` | yes | cond is one condition or a list |
| `['say', who, text, {mood, name, portrait, timeout: 300}]` | yes | one-line dialogue modal; waits for the player |
| `['bubble', who, text, s=2.5]` | no | speech bubble over the entity (fx `text` style `bubble`, `dur` = s) |
| `['move', who, markerOrXY, {speed, run, stopAt, from, face, wait: true, timeout}]` | yes | `physics.moveTo`; ends on `'ent:arrived'`; `from` = spawn point for spawn-on-demand; `face` = dir/who applied on arrival; `wait: false` = do not block. Timeout `max(10, dist/speed*3+5)` s then **teleports** |
| `['face', who, dirOrWhoOrMarker]` | no | dir: `'up' 'down' 'left' 'right'` (or north/south/east/west, or 0..3), or a target to face |
| `['anim', who, anim, s]` | if s > 0 | sets `anim`; with s, waits s then returns to `idle` |
| `['camera', {to, t: 1, zoom, shake, wait: true}]` | yes (t) | sets `camera.mode = 'free'`, eases x/y/zoom over t |
| `['cameraReset', {t: 0.6}]` | yes (t) | eases back to the camera target and zoom, then `mode = 'follow'` |
| `['parallel', [step, step, [stepA, stepB], ...]]` | yes | runs each entry concurrently (an entry that is a list of steps is a sequence); ends when all end |
| `['lockInput']` / `['unlockInput']` | no | balanced per cutscene; leftovers are released at the end |
| `['letterbox', bool]` | no | emits `'letterbox'` `{on}`; turned off at the end |
| `['control', {until: cond, minHp, timeout: 180}]` | yes | releases this cutscene's input locks, un-scripts every entity it scripted (so AI fights), sets `player.data.minHp`, waits for `until`, then relocks and re-scripts. Without `until` it lasts `timeout` (or `t`, default 10) seconds. `minHp` stays until the cutscene ends |
| `['escort', who, {to: marker, gap: 5, resume: 3, say: 'This way.', speed, from, timeout: 300}]` | yes | hands control to the player (like `control`); `who` walks toward `to`; if the player is more than `gap` tiles behind it stops, faces them and bubbles `say` (string, array cycled, or null; every 6 s); resumes when the player is within `resume`; ends when it has arrived and the player is within `gap`. Timeout teleports it |
| `['kill', {tag}]` / `['kill', who]` | no | Sim's `kill` op when registered, else `combat.kill` + remove for each match |
| `['tutorial', text, keys, {until}]` / `['tutorial', null]` | no | sets `HudState.tutorial = {text, keys}` (persists after the cutscene until cleared) |
| `['cutscene', id]` | yes | nested: its steps run inline here (its own `skippable` applies) |

Timeouts (`TIMEOUTS` export in cutscene.js): any op Promise 600 s, `say` 300 s (both counted while not
paused), `waitFor` 60 s, `control` 180 s, `escort` 300 s, `move` as above (counted while the world runs).
On timeout: `ops.warn(...)` and the cutscene moves on. More than 500 instant steps in one tick yields to the next
step (infinite-loop guard).

Entities touched by `move`, `face`, `anim`, `escort` (and spawn-on-demand) get `data.scripted = true` for the
cutscene's duration (cleared at the end). `say` and `bubble` do not script.

`skip()` (only when skippable): waits, waitFor, say, bubble, anim timers, camera tweens, `control` and the ops
`fx sfx dialogue bubble wait` are skipped; `move` and `escort` teleport (escort also brings the player within
1.5 tiles); flags, quests, spawns, gives, setLook etc. apply. Ops that return a Promise (pickers, gate
questions) are still awaited, then skipping continues. Reaching a nested cutscene with `skippable: false`
stops skipping.

API: `cutscene.play(idOrDef, {nested, ctx}) -> Promise` (queues while another runs), `cutscene.active` (id or
null), `.skippable`, `.skipping`, `.letterbox`, `.queued`, `.tutorial`, `.skip() -> bool`, `.stop()`,
`.setTutorial(text, keys, opts)`. Events `'cutscene:start'` / `'cutscene:end'` `{id, nested?}`, `'tutorial'`
`{text, keys}` (addition). At the end: input locks released, letterbox off, scripted cleared, minHp cleared,
camera back to follow with the saved zoom (snapped).

Example (rescue fragment):

```js
['move', 'laporte', 'clearing', { from: 'laporte_arrive' }],
['say', 'laporte', 'Remind me who you are again?', { mood: 'calm' }],
['lookPicker'], ['setLook', 'player', '$chosen'], ['fx', { type: 'poof', at: 'player' }],
['say', 'laporte', 'Ah, yes. {name}. You must be the new student.'],
['escort', 'laporte', { to: 'exit_town' }],
['flag.set', 'intro_done'], ['travel', 'town', 'gate_south'],
```

Ambush: `['control', {until: ['hp', 'player', '<=', 1], minHp: 1}]`.

---

## 4. Quests (`data/quests/*.js`)

```js
{ id, name, giver, req: [conds], companions: true | ['mage', 'rogue'],
  steps: [{ text: 'Defeat 5 slimes', goal: { type: 'kill', kind: 'slime', n: 5 } }, ...],
  rewards: { xp: 50, gold: 20, items: [['potion_small', 2]] },   // items also {id: n}, [{id, n}], ['id']
  onDone: [ops] }
```

Goal forms: `{type: 'kill', ...}`, `{kill: {...}}` or `['kill', {...}]`. Types:

| goal | completes when |
| --- | --- |
| `reach {zone, marker, r: 2.5}` | player within r of the marker in that zone (checked every 0.25 s); zone only = entering the zone |
| `kill {kind | tag, n: 1, zone}` | n `'death'` events of matching entities (any killer) |
| `boss {kind}` | that entity's `'death'` |
| `collect {item, n: 1}` | `inventory.count(item) >= n` (checked at step start and on `'item:gained'`) |
| `talk {npc, dialogue}` | a conversation with that NPC (and/or that dialogue id) **closes** while on this step; also a plain `'interact'` with an NPC that has no dialogue |
| `interact {id}` | `'interact'` `{ent}` where ent.id / kind / def.id / data.propId / a tag equals id |
| `flag {key, value}` | flag truthy / equal (checked at step start and on `'flag'`) |

A step without a goal (or with an unknown one, warned) advances only by `['quest.advance', id]`. Use the
guarded form `['quest.advance', id, stepIndex]` in dialogue options so a repeat cannot skip ahead.
Any goal may carry `zone` / `marker` hints for the minimap blip.

Turn-in: when the **last** step has a `talk` goal, completing it calls
`gates.ask({context: 'quest_turnin', optional: true, difficulty: def.difficulty || 1, tags})`; correct → rewards
x1.25 (rounded). Rewards go through ops `['xp', n]`, `['gold', n]`, `['give', id, n]` (Meta), then `onDone`.
`companions: true` on start: if `companions.active` is empty, runs `['companions', [the two base classes other
than the player's]]` (or `companions.set`), an array is used as given.

API: `start(id) -> bool` (false if unknown, already started or `req` fails), `advance(id, fromStep?)`,
`complete(id)` (no turn-in question; debug), `state(id)`, `step(id)`, `progress(id)`, `tracked`, `track(id)`,
`active()`, `done()`, `goal(id)`, `blip {on, x, y}`. Events: `'quest:started'` `{id}`, `'quest:step'` `{id, step}`,
`'quest:progress'` `{id, step, n, of}` (addition), `'quest:done'` `{id, bonus}`. Toasts (style `quest`):
`New quest: <name>`, `<name>: <step text>`, `Quest complete: <name>`. The newest started quest is tracked.
Saved: `{q: {id: {status, step, n, order}}, tracked}`.

HUD: `quest = {id, name, step: <step text>, progress: '2/5' | '', stepIndex, steps}` (reused object) or null.
Minimap: one `{x, y, type: 'quest'}` blip appended after Sim's blips for the tracked goal: reach → marker, talk →
the NPC (or its scheduled marker), kill/boss/interact → nearest match (or the prop with that id); when the goal
(or the NPC's schedule) is in another zone, the blip sits on the exit leading there.

---

## 5. NPCs (`data/npcs/*.js`)

```js
baker: { id: 'baker', name: 'Bun the Baker', look: {...}, zone: 'town', team: 'town',
  routine: [
    { from: 6, to: 12, at: 'bakery_door', do: 'shopkeep' },
    { from: 12, to: 18, at: 'square', do: 'wander', r: 3 },
    { from: 18, to: 22, at: 'cafe_seat_1', do: 'sit', dir: 'down' },
    { from: 22, to: 6, at: 'home_3', do: 'sleep' },          // home_* marker => absent at night
  ],
  dialogue: 'baker_talk', shop: 'bakery', onAttacked: 'flee', barks: ['Fresh rolls!', 'Mind the flour.'],
  stats: { hp: 10, speed: 2, power: 1 }, tags: [] }
```

- Entry fields: `from`, `to` (hours, [from, to), wraps when from > to; omitted = always), `at` (marker),
  `do`, `zone` (default `def.zone`, else the zone whose `npcs` lists the id), `r` (wander radius, 3),
  `markers` (patrol route; also `route`/`path`), `dir` (facing for idle/sit), `inside` (sleep: `true` = absent,
  `false` = sleeps visibly at the marker; default: absent if the marker starts with `home`).
- No `routine`: always at `def.at` in `def.zone`. Hours not covered by any entry: the NPC is nowhere.
- `do`: `idle`/`shopkeep` (face south or `dir`, look around every 4-8 s), `wander`, `sit` (`anim: 'sit'`),
  `sleep` (`anim: 'sleep'`, fxTag `sleep`), `patrol` (walk the markers, pause 1-2.5 s each). Unknown = idle.
- Interact: `def.interact` if given; else dialogue → `{prompt: 'Talk', range: 1.3, do: [['dialogue', id]]}`;
  else shop → `{prompt: 'Shop', do: [['shop', id]]}`. Put a shop option in the dialogue when both exist.
- Schedule changes (checked every 0.5 s and on `'hour'`): present NPCs walk to the new marker; going to another
  zone (or home to sleep) they walk to the exit toward it (or the home marker) and vanish; arriving they appear at
  the exit from their previous zone (or their home marker) and walk in. No exits: they pop in/out at the marker.
  Talking, scripted or KO'd NPCs apply the change afterwards. A stuck walk teleports after 40 s.
- `barks`: when the player is within 4 tiles, an idle NPC occasionally (15-30 s, one bark per 6 s globally,
  never while a modal is open) shows a bubble line.
- Extras: `fleeLine`, `angryLine` (bubble texts), `portrait`, `guard: true`.

Crime rule: a `'hit'` on any `team: 'town'` entity whose source is the player (or owned by the player: projectiles,
summons) emits `'crime'` `{victim}`, sets `flags.wanted` (+ `'wanted'` `{on: true}`, toast, player fxTag
`wanted`, `HudState.player.wanted`). Victims: `onAttacked: 'flee'` (default) runs ~7 tiles away for 6 s;
`'retaliate'` chases and hits back for 12 s; `'guard'` (or tag `guard`, or `guard: true`) is a guard: every
guard that sees the player (9 tiles + `world.los`) chases while wanted. Entities with a Sim AI brain (`ent.ai`)
are left to the AI; otherwise Story moves them (`moveTo`) and hits with `combat.damage(player, stats.power,
{source, type: 'melee'})` every 1.2 s. Town NPCs get `data.minHp = 1`; at the floor (or on a `'death'`) they are
KO'd (`anim: 'ko'`, no interact) for 10 s, then recover to full HP. Wanted clears after 45 s with no guard
seeing the player, and on `'player:revived'`. A `'player:down'` within 1.5 s of a guard hit while wanted
takes 10% gold (`['gold', -n]` op, else `inventory.addGold(-n)`), toasts, emits `'arrested'` `{fine}`
(addition) and clears wanted; Meta's revive flow then sends the player to the infirmary.

API: `rel(id)`, `addRel(id, n)`, `relAll()`, `populate(zone)` (idempotent; also run from `onZoneLoad`),
`spawn(id, x, y)`, `moveTo(ent, x, y, opts)` / `stop(ent)` (physics when present, else a straight-line fallback
mover that also emits `'ent:arrived'`), `bubble(ent, text, s)` (fx `text` style `bubble` + bus `'bubble'`
`{ent, text, dur}`), `whereIs(id) -> {zone, at, do}|null`, `setWanted(bool)`, `wanted`, `live` (array),
`isGuard(ent)`, `reschedule()`. Saved: `{rel}`.

---

## 6. Clock

`clock.hour` (0-24 float, starts at `config.startHour`), `clock.day`, `clock.daypart` (`morning` 5-11, `day`
11-17, `evening` otherwise), `clock.set(h)`, `clock.label()` ('08:30'), `clock.secondsPerHour` (30). Advances
only while the world is not frozen. Emits `'hour'` `{hour}` on each whole hour (and `{hour, set: true}` from
`set`). `game.ambience`: morning cool-to-warm (`#c8dcff` 0.12 at 6h → `#ffe2b8` 0.07 at 8h → none at 11h),
day none, evening warm amber up to 0.2 (18h-4.5h). `tintAmount` never exceeds 0.2. Saved `{hour, day}`.

HUD fields filled by Story: `hour, daypart` (clock), `quest` + minimap quest blip (quests), `tutorial`
(cutscene), `player.wanted` (npc).

---

## 7. Expectations from other packages

**Sim**
- `physics.moveTo(ent, x, y, {speed, run, stopAt})` must set `ent.data.moveTo` synchronously and clear it on
  arrival (or `physics.stop`), emitting `'ent:arrived'` `{ent}`. Story treats "`data.moveTo` cleared" as arrived.
- Player system and AI skip entities with `data.scripted`; the player obeys `inputLock`.
- `combat.damage` honours `data.minHp` for every target (town NPCs use 1), emits `'hit'` with `source` (the
  projectile/summon is fine: Story follows `owner`). `combat.hostile(player, town)` reads `flags.wanted`.
- `ents.spawn(id, x, y, opts)` must let `opts` override `type, team, def, name, look, hp, hpMax, stats, tags,
  interact, data`. NPC defs may contain `ai`; if Sim gives such entities `ent.ai`, Story leaves chasing to it.
- world: `npc.populate(zone)` may be called from world's zone load; Story also calls it in `onZoneLoad` (idempotent).
  `world.marker`, `world.los`, `world.solidAt` are used. Optional ops `kill` (`['kill', {tag}]` / `['kill', who]`)
  are delegated to Sim when registered.
- The `'interact'` event should carry `{ent}` for props too (with `data.propId` or `id` = the prop id) so
  `interact` quest goals can match props.

**Meta**
- Picker ops (`lookPicker`, `classPicker`, `specPicker`) should return a Promise resolving to the chosen value
  (it becomes `$chosen`). `shop`, `gate`, `chest`, `lesson` should return a Promise resolving when their modal
  closes, so dialogues/cutscenes continue after it (they also cope with sync ops).
- Ops `xp`, `gold` (negative = pay), `give` are used for quest rewards and the guard fine.
- On `'player:down'`, Story's listener runs first (Story inits before Meta); after an arrest `game.npc.arrested`
  is true (reset it if you use it) and wanted is already cleared. Please emit `'player:revived'`.
- Debug: `startCutscene(id)` → `game.cutscene.play(id)`, `skipCutscene()` → `game.cutscene.skip()`,
  `completeQuest(id)` → `game.quests.complete(id)`, `setTime(h)` → `game.clock.set(h)`.
- Inventory should emit `'item:gained'` `{id, n}` on every give (collect goals).

**UI**
- The dialogue modal is mutated in place per line: re-render on `'dialogue:line'` or when `modal.rev` changes.
  `options` null = "press to continue" (`dialogueAdvance()`); else `dialogueChoose(i)`; disabled options show
  their `hint`.
- Letterbox: `'letterbox'` `{on}` or `game.cutscene.letterbox`. Skip button/hint: `game.cutscene.active &&
  game.cutscene.skippable` → `game.cutscene.skip()` (not in `game.commands`; a `skipCutscene` command could be
  added by the integrator).
- Bubbles arrive as FxEvent `text` with `style: 'bubble'`, `ent`, `dur` (seconds) and as bus `'bubble'`.
- Toast style `quest` for quest messages; `'quest:*'` events; HUD `quest.progress` is a ready string.

## 8. Contract additions (summary)

Conditions `any hp near zone daypart wanted cutscene`, quest `started`/`atLeast`, hour compare; ops `flag.clear
flag.add if wait bubble tutorial quest.complete quest.track`; cutscene options listed above plus `once`,
flag `cs_<id>`; events `story:warn dialogue:open dialogue:choice dialogue:close quest:progress tutorial
bubble rel arrested`, `'hour'` payload `{hour}`; dialogue node `after`, conditional `start`/`goto`, line `if`/`name`/`portrait`;
modal fields `id node who rev`; HudState.quest extra `stepIndex steps`; `game.quiet`; the APIs listed per
system above; `deferred()`, `compare()`, `hourIn()` exports in ops.js; `parseDir`, `faceToward`, `faceDir`
exports in npc.js; `TIMEOUTS` in cutscene.js; `daypartAt`, `tintAt`, `tintAmountAt`, `MAX_TINT` in clock.js.

## 9. Known gaps

- NPC walking uses Sim's pathing; the fallback mover (no Sim physics) walks straight through walls.
- Story's guard chase/attack is a simple fallback for guards without a Sim AI brain.
- A quest saved during its turn-in question reloads as active on its last step (talk again to finish).
