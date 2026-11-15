# Meta package notes

Owner of `src/core/{progression,inventory,gates,save,debug}.js`, `src/questions/**`, `src/platform/storage.js`,
`docs/QUESTIONS.md`, `tests/node/meta*.test.mjs`. Everything below is what the code does today; names marked
**(added)** are additions to CONTRACTS.

Run: `node --test tests/node` (41 meta tests + skeleton) and `node tests/e2e/skeleton.cjs`.

---

## 1. For kit authors (Class kits package)

### progression API (`game.sys.progression`, alias `game.progression`)

| Member | Meaning |
| --- | --- |
| `level, xp, xpNext, xpTotal`(added) | `xp` is progress inside the current level (resets on level-up); `xpTotal` is lifetime XP. At the cap `xp === xpNext`. |
| `classId, specId, boons[]` | `boons` are boon ids in pick order. |
| `pendingBoons` (number), `pendingSpec` (bool) | Also in HudState. |
| `rank()` / `rankAt(level)` | Attack rank 1-5 from level thresholds 1, 4, 8, 12, 16. |
| `hasBoon(id)` | What a kit checks. |
| `addXp(n)`, `setLevel(n, {quiet, boons})`, `setClass(id, {quiet})`, `setSpec(id, {quiet})` | `quiet` skips fx/toasts (events still fire); `boons: false` skips boon queuing. `setSpec` switches the class to the spec's `from` if needed. |
| `recalc()` | Rebuilds `player.stats.{power, speed, defense}` (same object, other keys kept), `player.hpMax` (hp raised by the increase, clamped) and `player.data.baseStats`. |
| `abilityList(classId?, specId?)` | `[{slot, id, name, icon, unlock, desc}]`: the active kit's `abilities` when it lists any, else data, else the CLASSES defaults. |
| `classDef(id)`, `specDef(id)`, `classIds()`, `specIds(classId)`, `boonDefs()` | Merged definitions (data over built-in defaults). |
| `offerBoons(n)`, `chooseBoon(id)`, `openBoonPicker()`, `openClassPicker()`, `openSpecPicker()`, `openLookPicker()` | See section 3. |
| `refreshLook()` (added) | Calls `game.sys.player.refreshLook()` when Sim provides it, otherwise composes the look itself in the COMMON-12 order. |

**Stats.** `hpMax = round((base.hp + base.hpPerLevel * level) * spec.mods.hp * statMods)`, `power = (base.power +
base.powerPerLevel * level) * mods.power * ...`, `speed = base.speed * mods.speed * ...`, `defense = (base.defense +
(base.defensePerLevel || 0) * level) * mods.defense`. "hp 44 + 9/lvl" is read as 9 per level times the level
(warrior L3 = 71, novice L1 = 25). Power and speed are rounded to 0.01.
**Temporary stat changes:** do not write `player.stats` directly (the next recalc overwrites it). Put a multiplier in
`player.data.statMods[yourKey] = {power, speed, defense, hp}` and call `progression.recalc()`; delete the key and
recalc again to end it. Items use `item_haste` and `focus`.

### Data shapes read (all optional; missing fields fall back to the CLASSES defaults built into progression.js)

```js
data.classes[id] = { id, name, blurb, color, pickable /* false hides it from the picker */,
  base: { hp, hpPerLevel, power, powerPerLevel, speed, defense, defensePerLevel },
  basic: { name, icon, desc },                               // picker card
  abilities: [{ slot, id, name, icon, unlock, desc }] | { space: {id, name, icon, unlock, desc}, ... },
  look: { ...look patch } }
data.classes.novice                                          // optional, same shape (default hp 20 + 5/lvl, power 2, speed 3.2)
data.specs[id] = { id, from, name, blurb, color, mods: { hp, power, speed, defense }, basic, abilities, look }
data.boons[id] = { id, class | spec, name, desc, icon, tags }
```

Merging is field by field, one level deep (`base`, `mods` merge per key). For boons, a non-empty `data.boons`
REPLACES the built-in default pool (ids in the defaults are snake_case of the CLASSES names, e.g. `blazing_bash`).
Picker ability lists come from data / defaults, then from `kits.registry[id].abilities` if both are empty.

### Events emitted

`'xp' {amount, total}` (total = lifetime xp) · `'levelup' {level, gained}` (one event per addXp-triggered level with
`gained: 1`; `setLevel` jumps emit one event with `gained = new - old`) · `'rank:up' {rank, prev}` ·
`'ability:unlocked' {slot, id, name, icon, unlockLevel, desc}` (on level-up, and on class/spec set for abilities
already within the level) · `'class:set' {classId}` · `'spec:set' {specId}` · `'boon' {id}` · `'look:changed'` only
from the local refreshLook fallback.

Level-up moment: full heal, fx `levelup` + `ring` (r 2.5, gold), `combat.aoe(player, {x, y, r: 2.5, dmg: 0,
knockback: 7, type: 'true', silent: true, tags: ['levelup']})`, sfx `levelup`, toast `Level N!`, boons queued at
4/6/8/10/12, at 8 (with a class and no spec) `pendingSpec`, flag `spec_ready` and the toast "Mr. Laporte wants to see
you in his office.", at 10 `refreshLook()` (aura). Class/spec set: `kits.set(p, classId, specId)`, `recalc`, full
heal, `refreshLook`, fx `pillar` + `sparkle` + `levelup` in the class/spec color, toast "You are now a Mage!".

## 2. For Narrative / Content (fields honored)

### Items (`data/items.js`)

`{id, type: 'consumable'|'cosmetic'|'key'|'weapon', name, desc, icon, price, stack (default 99, keys 1), cd (seconds,
default 1), use: {effect, ...}, look, slot, color, style}`. Consumables (or untyped items with `use`) auto-fill the first
free hotbar slot; a slot is freed when its count reaches 0. Unknown ids are kept as plain items with a one-time warning.
The STORY consumable ids have built-in fallbacks (`FALLBACK_ITEMS` in inventory.js) used only while data lacks them.

| effect | fields (defaults) |
| --- | --- |
| `heal` | `amount` + `frac` (of hpMax); refused (not consumed) at full hp |
| `heal_over_time` | `amount` + `frac` total over `dur` (8) s |
| `bomb` | `dmg` coefficient (3), `r` (1.8), `delay` (0.7), `range` ahead of facing (2.5), `knockback` (6), `element` ('fire') → `combat.aoe(player, {x, y, r, dmg, knockback, type: 'magic', element, fx: 'meteor', delay, telegraph: true, tags: ['item','bomb']})` |
| `haste` | `mult` (1.35), `dur` (10): speed via `statMods.item_haste`, fxTag `haste` |
| `shield` | `amount` + `frac`, `dur` (8): `combat.status(p, 'shield', dur, amount)` |
| `cure` | clears stun slow burn frost root mark venom (+ their fxTags) |
| `smoke` | `r` (2), `dur` (4): `combat.zone` with look `smoke` and status slow, `combat.status(p, 'stealth', dur)`, fx `smoke` |
| `xp` | `amount` (10) |
| `summon_pet` | `kind` (enemy/npc id or anything), `dur` (30), `name`, `look`, `hp`, `speed`, `brain` ('chaser'), `powerFrac` (0.5): `ents.spawn(kind, ..., {type: 'summon', team: 'player', owner, ttl, tags: ['pet','summoned'], fxTags: ['summoned']})` |
| `resource` | `amount` or `frac` (0.5) or `full`; `focus: true` (or id `focus_scroll`) = the focus gate (12a): correct → resource to max, cooldown reset, +50% power 6 s (fxTag `haste`); wrong → +25% resource. Consumed either way. |

Cosmetics: `slot` is `hat | cape | outfitColor`, inferred from `look.hat` / `look.cape` / otherwise outfitColor. The patch
is `look`, or from `color` (+ `style` for hats): outfitColor → `{outfit: {primary: color}}`.

### Shops (`data/shops.js`)

`{id, name, keeper /* npc id, its name is shown */, haggle (default true), stock: [{item, req: [conds], price, n} | 'itemId']}`.
Price = `stock.price ?? item.price ?? 1`; haggled = `round(price * 0.8)` (min 1). Cosmetics already owned cannot be bought.
Op `['shop', id]` returns a Promise that resolves when the visit ends.

### Loot (`data/loot.js`) and chests

`{id, gold: [a, b] | n, items: [{id, n: number | [a, b], p}], runeBonus: {gold, goldMult, items, table}}` (`p` default 1;
`table` = another loot id rolled in addition). Op `['chest', lootId, {id, rune, difficulty, tags}]` with `ctx.self` the
chest entity: rune chests ask `{context: 'chest', blocking: false}` (correct → runeBonus too), gold/items are given with
toasts and a sparkle fx, flag `chest_<zone>_<id>` is set, the entity gets `look.model = 'chest_open'`, `lookRev++`,
`interact = null`; emits `'chest:opened' {id, zone, loot, rune, bonus}` (added). Unknown table → `{gold: [2, 6]}` + warning.

### Lessons (`data/lessons.js`)

`{id, teacher /* npc id */, title, questions (3), difficulty (1), tags, reward: {xpEach, goldEach}}`. Op `['lesson', id]`:
lesson card, 0.9 s pause, then `questions` gate asks (`context: 'lesson'`, blocking per config, i.e. retried until right),
reward per correct answer, card updated between questions, `npc.addRel(teacher, 1)` once at the end, toast summary,
`'lesson:done' {id, total, done, correct}` (added). The op's Promise resolves when the player closes the card.

### Ops and conditions registered by Meta

Actions: `give take gold xp shop gate chest lesson classPicker specPicker lookPicker save` (`gate` lives in gates.js;
`['gate', {context, difficulty, tags}, {pass, fail}]` defaults the context to `'gate'`). The picker ops return Promises
that resolve with the chosen id / look index (`null` if the modal was closed without a choice).
Conditions: `['level', op, n]` or `['level', n]` (>=), ops `>= <= > < == !=`; `['class', id]`, `['class']` (has any),
`['class', 'none']`; same for `spec`; `['hasItem', id, n = 1]`; `['gold', op, n]` or `['gold', n]`.

Story owns `class_chosen` / `spec_ceremony_done` (Meta does not set them). Meta sets `spec_ready`, `look_choice`,
`look_chosen`, `chest_*`, and clears `wanted` on a defeat while wanted.

### Player down

On `'player:down'` (ignored while `player.data.minHp` is set, and while already handling one): invuln 30 s while deciding
(at the gates update of the same step); if questions are not off, the `revive` context is enabled and none was asked in
the last 5 minutes → `gates.ask({context: 'revive', optional: true, blocking: false})`: correct → wake where you fell.
Otherwise: before `intro_done` the current zone's `respawn` marker (else `start`); after it the `academy` zone at
`infirmary` (else `infirmary_bed`, else `entrance`) via `world.travel`. Wanted → 10% gold fine and `wanted` = false.
Wake: full hp, negative statuses cleared, 2.5 s invuln, fx heal + sparkle, toast in Laporte's (respawn / revive) or Nurse
Pemberton's (infirmary) voice, `'player:revived' {where: 'here' | 'respawn' | 'infirmary'}`.

## 3. For UI (modal payloads and commands, exactly as emitted)

Modals that change while open are mutated in place and followed by `'modal:update' {modal}` (added): shop, inventory, lesson.

| modal | payload | commands |
| --- | --- | --- |
| `question` | `{req: {context, difficulty, tags, optional, blocking, attempt, id?}, attempt, mount(el) -> Promise<{correct, skipped}>}` | call `mount(el)` once with an empty element; the provider renders into it. Closing the modal = skipped. |
| `boonPicker` | `{options: [{id, name, desc, icon}]}` (2 or 3) | `pickBoon(id)`; closing keeps the boon pending and the same offer |
| `classPicker` | `{classes: [{id, name, blurb, color, look /* full preview look */, basic: {name, icon, desc}, abilities: [{slot, id, name, icon, desc, unlock}]}]}` | `pickClass(id)` |
| `specPicker` | `{options: [same shape as classes]}` (abilities = the spec's F and Shift) | `pickSpec(id)` |
| `lookPicker` | `{name, looks: [lookA, lookB]}` | `pickLook(i)` |
| `shop` | `{id, name, keeper, keeperName, stock: [{id, name, desc, icon, price, basePrice, n, owned, canBuy}], gold, haggled, canHaggle}` | `shopBuy(itemId)` → bool, `shopHaggle()` → Promise<bool> (the shop modal is replaced by the question and reopened after), `closeModal()` |
| `inventory` | `{items: [{id, name, desc, icon, type, count, slot /* hotbar index or -1 */, usable}], cosmetics: [{id, name, desc, icon, slot, equipped}], equipped: {hat, cape, outfitColor}, hotbar, gold}` | `assignSlot(itemId, i)` (i = -1/null removes; swaps if already slotted), `equipCosmetic(id)` (toggles; `equipCosmetic(null, slot)` clears a slot), `closeModal()` |
| `lesson` | `{id, teacher, teacherName, title, total, done, correct, finished, reward: {xpEach, goldEach}}` | `closeModal()` (closing early stops the lesson) |

Pickers should not offer a close button: closing resolves the picker op with `null`.
Other commands: `useSlot(i)`, `openInventory()`, `saveNow()` (+ toast), `openBoonPicker()` (added; same as Tab),
`openSpecPicker()` (added; only when `pendingSpec && flags.spec_ceremony_done`). Tab (`pressed.boon`, no modal, no input
lock) opens the boon picker when boons are pending, else the spec picker under the same condition.

Events for banners / sounds: `'gate:ask' {req}`, `'gate:result' {req, correct, skipped}`, `'gate:retry' {req, attempt,
wait}` (added; the world stays frozen with no modal for `wait` seconds, toast "Not quite. Try again in 3 seconds."),
`'cosmetic:equipped' {id, slot, equipped}` (added), `'item:gained'`, `'item:used'`, `'gold'`, plus section 1 events.
sfx emitted: `levelup ui_ok ui_bad pickup coin spell swing`.

HudState filled by Meta: `player.{level, xp, xpNext, gold, classId, className, specId, specName, power, defense,
speed}`, `items[6]` (`null` or a reused `{id, name, icon, count, cdFrac}`), `pendingBoons`, `pendingSpec`.

Title screen (no game yet): `import { listSaves, saveSummaries, loadSave } from '../core/save.js'` with the storage
from `createUI` opts: `listSaves(storage)` → names, most recent first; `saveSummaries(storage)` → `[{name, level, classId,
zone, zoneName}]`; `loadSave(storage, name)` → migrated JSON for `continueSave` (null if unusable).

## 4. Questions, gates, save, storage

- `src/questions/index.js`: `Questions` (shared, default mode `auto`) and `createQuestions({mode, provider})` (added, used by
  tests). `mode`, `setMode(m)`, `setProvider(p)`, `register(p)`, `use(id)`, `providers`, `needsUi()`, `ask(req, el)` (never
  rejects; a throwing provider → `{correct: true, skipped: true}`). Mode `stub` means "ask the provider" (custom or stub card).
- `stubProvider.ask(req, el)`: placeholder card (`.question-stub`, `.question-stub-badge`, `.question-stub-correct`,
  `.question-stub-wrong`, `.question-stub-hint`), keys 1/2 (also numpad), clickable; with no element it resolves skipped.
- `gates.ask(req)`: see the header of gates.js. Additions: `req.blocking` (overrides the config; used by revive and rune
  chests per 12a), `req.id` (passed through), `answer(correct)`, `pending()`, `queued()`, `waiting()`, `contextConfig(ctx)`,
  `after(s, fn)` / `wait(s)` (game-time timers that run while frozen), `mountTimeout` (10 s: an unmounted question is
  skipped, so a missing UI never deadlocks). Retry wait = `config.questions.retrySeconds` if present, else 3 s.
- `save`: `now(name?)`, `load(name?)`, `exists`, `clear`, `list()`, `summaries()`, `restore(json)` (added; in-game load),
  `request()`, `pendingAutosave()`, `autosave` (bool), `version`, `migrate`. Module exports `SAVE_VERSION`, `MIGRATIONS`,
  `migrate`, `listSaves`, `loadSave`, `saveSummaries`. Saves add `meta: {savedAt, tick, level, classId, specId, zoneName}`.
  Autosave requests (zone load after boot, levelup, quest:step, quest:done, timer) are written at the next step where no
  cutscene is active, no `transition`/`question` freeze, the player is not down and hp > 0.
- `storage`: same API as the skeleton; `set` returns bool; a failing localStorage write switches to memory for the session.

## 5. Debug (`window.__game`)

All of CONTRACTS 12 plus: `scenarios()`, `class_demo(classId, specId, level)`, `load(name?)` restores the save in place,
`reset()` (fresh systems + flags, start zone), `state()` adds `level, xp, xpNext, classId, specId, rank, boons,
pendingBoons, pendingSpec, gold, items, hotbar, question, quest, hour, god, cutscene, player.stats, player.lookRev`.
`killAll(kindOrTag?)`, `find(kindOrTypeOrTag)` → summaries, `spawn(kind, n, x, y)` → ids.
`scenario(id, opts)` → `{ok, id, zone, missing: ['zone:intro', 'cutscene:ambush', 'kind:training_dummy', 'marker:..', ...], ...}`;
opts: `cutscene: false` (do not play the scene), `classId`, `specId`, `level`, `picker: false` (academy_pick),
`enemies`, `projectiles` (stress), `n`, `r` (class_demo ring). `class_demo` also accepts positional
`scenario('class_demo', classId, specId, level)`; spec defaults to knight / sorcerer / archer from level 8.
`gallery`: test zone, every enemy then every NPC in rows of 10, named `Name [id]`, `ai = null`, `data.scripted = data.noAi = true`, god on.
`stress`: 24 enemies in rings + 40 projectiles (via `combat.projectile`, else raw projectile entities), god on.

## 6. Requests to other packages

- **Sim**: provide `game.sys.player.refreshLook()` (Meta calls it on look/class/spec/cosmetic/level-10 changes). Do not
  overwrite `player.stats.power/speed/defense` or `hpMax`; use `player.data.statMods` + `progression.recalc()`. `combat.aoe`
  should accept `dmg: 0` with `knockback` and `silent` (level-up ring) and `delay` + `telegraph` (bomb). `combat.status(p,
  'invuln'|'shield'|'stealth', s, power)`. Please add `abilities.resetCooldowns(ent)` (focus scroll; Meta also accepts
  `resetAll` / `reset`, else zeroes `p.data.cd`). Emit `'player:down'` once per defeat (Meta ignores repeats anyway).
  The player system may call `inventory.useSlot(i)`; Meta's fallback handles item keys only if it was not already called
  that step. Meta does not call `combat.status(p, 'haste')` for items (speed comes from statMods), so no double speed.
  Expose `kits.registry` (the stub does) so pickers can read kit abilities if data has none.
- **Story**: `npc.addRel(id, n)` (lessons), `cutscene.active` (autosave deferral), `cutscene.skip()` (debug), optional
  `quests.complete(id)` (debug). Set `class_chosen` after `['classPicker']` and `spec_ceremony_done` after
  `['specPicker']`. Do not register Meta's ops.
- **Integrator**: `config.questions.retrySeconds` does not exist (3 s default used). Config says `chest` and `revive` are
  blocking, but 12a / STORY define a consequence for a wrong answer, so those two requests pass `blocking: false`.
  The `levelup` question context is not used by anything yet.

## 7. Known gaps

- Fallback look composition in progression is only used until Sim's `refreshLook` exists.
- No UI for the question modal exists in this worktree (UI package); verified only with Node and the debug API.
