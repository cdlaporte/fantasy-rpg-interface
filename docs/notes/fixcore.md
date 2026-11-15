# fixcore notes (bug fixes and the number scale)

Branch `wp/fixcore`. New tests: `tests/node/fixcore.test.mjs` (one per fix, plus the scale). API docs added to `docs/notes/sim.md`.

## Fixes

1. **`'ability:unlocked'` twice**: already single in the merged tree (Meta's `progression.emitUnlocks` emits; the Sim's
   `kits/index.js` only emits when no `progression.abilityList` exists). Documented as "never both" in sim.md; regression test added.
2. **Nameless slots in `abilityList` / `class_demo`**: already fixed by integration (`normAbilities` in `progression.js` skips null
   slots). Regression test added.
3. **Kit aura vs level-10 aura**: `player.js` `refreshLook` (and Meta's fallback in `progression.js`) applies `p.data.kit.lookPatch.aura`
   after the default aura, so the kit wins. Removed the dead `fixAura` / `look:changed` listener (`kits/warrior.js`); all warrior and
   battlemage tests pass without it.
4. **Dash in hit-stop**: `abilities.js` `updateDash` does not count stall steps while `data.hitStop > 0` and extends `maxT` by the frozen
   time. Kit guards (Ricochet Bash delay) left in place, they are harmless.
5. **dash tags / beam anim**: `dash` passes `tags` to `combat.damage`; `beam` takes `anim` (default `'cast'`, `false` = leave the animation).
6. **chain / dash exclude**: `chain` has `exclude` (ids or entities, also applied to `target`); `dash` has `exclude` (ids). The dash contact
   loop now uses its own scratch array.
7. **Town NPCs**: `combat.js` `canHitTeam`: a `town` entity is hit only by the player's direct attacks (`meleeArc` and projectiles fired by
   the player itself). Zones, aoe, chain, dash contact, summons, companions, clones never damage them, wanted or not (so a wanted player's
   Whirlwind no longer hits guards; direct hits still do). `combat.canHit(src, t, direct)` takes the new flag. Exactly one `'crime'` per hit
   (single emitter in `npc.js`; the "twice" report was already gone), regression test added.
8. **Re-entrancy**: `combat.js` keeps `candPool` / `outPool` indexed by a nesting `depth` (bumped in `meleeArc`, `resolveAoe`, `tickZone`,
   `reflectInArc` and `damage`, so hooks run one level deeper). No allocation in the common case. `tickZone` also re-points the shared
   hostility filter per target.
9. **Meta merge**: `progression.js` `classIds` / `specIds` / `boonDefs` merge data over the built-in pools per id (defaults first, data-only
   ids appended; boon fields merge). `meta-progression.test.mjs` updated (it asserted the old replace rule).
10. **Pickpocket as talk**: `PICK_INTERACT` (thief.js) carries `noQuest: true`; `player.interact` puts it on the `'interact'` event and
    `quests.js` ignores such events.
11. **Second Wind**: new kit hook **`onLethal(game, ent, info)`** in the damage pipeline (after defense/crit/shield, before hp is written, only
    when the hit would take hp to 0 and no `minHp` floor protects it; `info.dealt` is mutable). Documented in sim.md 4.1. Second Wind (warrior.js)
    heals and knocks back from it and cuts the hit to leave 1 hp; the old below-25% trigger in `onHurt` stays for non-lethal hits.

## Number scale (`config.numberScale = 6`)

Data keeps readable base numbers; the scale is applied where a number is consumed, never in `combat.damage` / `heal`.

| site | what |
| --- | --- |
| `src/config.js` | `numberScale: 6` |
| `core/ents.js` `spawn` | `stats.hp` and `stats.power` of every enemy / boss / NPC def (after the level rescale); default hp 6 / 30 too |
| `core/npc.js` `spawnNpc` | passes scaled hp and power (it overrides the spawn stats) |
| `core/player.js` | initial player hp 25 and power 2 |
| `core/progression.js` `recalc` | class/spec base hp and power (the player) |
| `core/companions.js` `statsFor` | companion hp and power |
| `core/inventory.js` | `heal` and `heal_over_time` `amount` (and the 10 fallback), `shield` `amount`, `summon_pet` hp; `frac` parts use `hpMax` (already scaled) |
| `core/ai.js` | `regen` (hp/s, `stats.regen` and `ai.regen`) |
| `core/kits/archer.js` | Starfall `dragMaxHp` compared with enemy `hpMax` |
| `core/combat.js` op `['heal', n]` | numeric script amounts (data uses only the full-heal form) |
| `data/items.js` | descriptions print the scaled heal numbers |

Audited and deliberately not scaled (already derive from scaled `power` / `hpMax` / dealt damage, or are percentages or coefficients):
all `dmg`/`coef` blocks, burn/venom power (coef x power), lifesteal (fraction of dealt), `pct` heals, shield `frac`, Second Wind, Monk
meditation, Berserker lifesteal, Knight shields (frac of hpMax), summons / decoys / familiars / clones / Guardian (hp from owner `hpMax`,
power from owner power), Hawk (hp 999 sentinel), heart pickups (20% hpMax), `minHp` floors (1), defense (a ratio), cutscene `hp` compares
against 1. XP, gold, prices, cooldowns, speeds and resources are untouched.

"At least 1" hacks: the hit floor `max(1, round)` in `damage` is kept as chip damage (at scale it only matters for pathological hits); the
DoT tick floor became "1 only when the dot has power" (was a forced minimum). `decoy`'s `max(5, ...)` never binds any more.

Tests updated through `config.numberScale` (no hard-coded 6): DPS targets in `kit-{mage,rogue,warrior}-dps`, enemy hp in the mage and rogue
fight rigs, ring hp in `kit-rogue`, Smoke Vanish dummy hp, Knight block numbers, `meta-progression` stats, `meta-inventory` heal/bread/shield.

Balance retune forced by the scale: the Rogue kits were calibrated against the old rounding (`max(1, round)` inflated their tiny
hits), so exact numbers lowered their DPS: Ninja `dmgScale` 0.095 -> 0.14 (was 61-75% of target), Rogue class `dmgScale` 0.21 -> 0.23 (was
exactly 85%). All class tables are inside the +-15% band again (Rogue/Archer/Thief/Ninja L10 sit at 87-89%). Warrior and Mage untouched.

## Not done / caveats

- The UI and renderers were not touched or checked: damage numbers now have 3-4 digits (fx text, HUD bars `hp/hpMax`).
- Pre-existing Sim fallback emitter for `'ability:unlocked'` remains (only when no progression system exists).
- Hot-path allocation was not measured; the new code allocates nothing per step.
