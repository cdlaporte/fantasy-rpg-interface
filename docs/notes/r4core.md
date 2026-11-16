# Round 4, core package: tier-3 masteries around the class kits

Branch `wp/r4core`. Everything is data-driven and works with the kit stubs alone: a mastery with no data entry uses
its kit id title-cased as its name, the subclass color and no mods. Tests: `tests/node/r4core-mastery.test.mjs` (12,
two stub data entries + a stub shift kit injected); `node --test tests/node` passes (520).

## What changed, file by file

- `src/core/progression.js`: `MASTERY_LEVEL = 15`, `MASTERY_TRIAL_BONUS = 0.05`. API: `masteryId`, `pendingMastery`,
  `masteryBonus`, `masteryTrial`, `masteryDef(id)`, `masteryIds(specId?)` (kit-registry order, then data-only ids;
  no argument = all 18), `masteryEntry(id)` (picker card), `setMastery(id | null, {quiet})`, `openMasteryPicker()`,
  `pickMastery(id)`, `masteryNudge()`, `masteryName()`, `markMasteryReady()`. `setMastery` sets the parent subclass
  and class quietly when they differ (teacher/debug), keeps `specId` = the subclass, calls
  `kits.set(p, classId, masteryId)`, recalc, look, fx (celebrate + screenFlash + shockwave + ring + camera shake),
  toast "Mastery unlocked: X!", emits `'mastery:set' {masteryId, specId}` (`{masteryId: null, specId, prev}` when
  removed). Level 15 (or a subclass picked at 15+) with no mastery: `pendingMastery`, flag `mastery_ready`, toast
  "Mr. Laporte wants to see you in his office." `recalc` multiplies the mastery `mods` after the subclass's, then
  `power *= 1 + masteryBonus`. `abilityList(c, s, useKit, masteryId)`: a mastery id passed as `s` is split; the
  mastery's `abilities`, else `ultimate` (shift, unlock 15), else its kit's, replace by slot. `previewLook(c, s, m)`
  and the local look fallback add the mastery look (and its color for the aura). `setSpec(masteryId)` and
  `pickSpec(masteryId)` delegate; `specIds()` never lists tier-3 entries. Save/load: `masteryId` (only with its own
  subclass), `pendingMastery`, `masteryBonus`, `masteryTrial`. Level-down below 15 removes the mastery (and the
  pending flag); `reset()` clears all of it. HUD: `hud.player.{masteryId, masteryName, pendingMastery}` (the top-level
  HudState keys are frozen by the skeleton test). Tab: boons, else the subclass picker, else `masteryNudge()`.
- Picker: `openMasteryPicker` asks `gates.ask({context: 'mastery', difficulty: 3})` once per hero (right: +5% power
  for good, toast; wrong: "Not quite. The choice is still yours."), then opens the existing `specPicker` modal with
  `{tier: 3, from, title, subtitle, options: [{id, tier, from, fromName, name, blurb, color, look, passive, ultimate,
  abilities}]}`. Choice = command `pickMastery(id)` (chosen over reusing `pickSpec`: explicit, and `pickSpec` still
  forwards a mastery id). Ops: `masteryPicker`, and `['specPicker', 'mastery']` (same); condition `['mastery', id |
  'none']`. Commands: `pickMastery`, `openMasteryPicker` (after the ceremony), `masteryNudge`.
- `src/core/kits/index.js` (fixes): `class:set` / `spec:set` handlers and the `_update` sync follow
  `progression.masteryId` (the top layer is the mastery when there is one).
- `src/core/player.js`: `refreshLook` adds the mastery look over the subclass's; aura from the mastery (`aura` or
  `color`); refreshes on `'mastery:set'`.
- `src/core/debug.js`: `__game.setMastery(id)` (sets the ceremony flags), `class_demo` accepts `masteryId` (object
  opts, or 4th positional; class/subclass follow the mastery, level defaults to 15; unknown id -> `missing:
  ['mastery:<id>']`), `state()` adds `masteryId, pendingMastery`; teacher `setMastery(id)` (level >= 8, any of the 18;
  `null` removes), teacher `setSpec` on the current subclass drops the mastery, `setClass` drops both; Go to adds
  `mastery_ready` + `mastery_ceremony_done` when the hero has a mastery. No new scenario.
- `src/core/save.js`: `meta.masteryId`.
- `src/data/cutscenes/academy.js`: `mastery_ceremony` (zone academy, office, 3 + 2 Laporte lines, calls back to the
  level-8 one, picker, big fx, flag `mastery_ceremony_done`, save).
- `src/data/dialogues/academy.js`: Laporte "You wanted to see me?" at level >= 15 with a subclass, `mastery_ready`,
  `spec_ceremony_done`, not yet `mastery_ceremony_done`.
- `src/config.js`: context `mastery` (non-blocking). `src/questions/unit4/provider.js`: its label.
- `src/ui/pickers.js` + `css/ui.css`: tier-3 spec picker = "CHOOSE YOUR MASTERY", two wider cards (descriptions stay
  visible at 1024), "KNIGHT MASTERY" line, PASSIVE row (purple tag), the ultimate row (H, Lv 15).
- `src/ui/panel.js` + css: mastery nudge ("See Mr. Laporte!" / "Mastery ready!" + Tab; click = `masteryNudge`),
  title "Subclass · Mastery" (one line; the tooltip lists class, subclass, mastery).
- `src/ui/teacher.js` + `css/menus.css`: MASTERY row = the current subclass's two masteries + None (labels and colors
  follow the subclass); status line shows the mastery; rows compacted at heights <= 700 (fits 1366x657 and 1024x600,
  checked in 3D screenshots).

## Deviations (please read)

- **Cutscene step**: the data uses `['specPicker', 'mastery']`, not `['masteryPicker']`: `data-narrative.test.mjs`
  (not mine) rejects unknown step names. Both ops work; once that test's vocabulary lists `masteryPicker`, the step
  can be renamed. Likewise the dialogue uses flags (`mastery_ready`) instead of the new `mastery` condition.
- **Level down below 8 keeps the subclass**: `r2a-progression.test.mjs` asserts it (teacher: any subclass at any
  level). Below 15 the mastery is removed.

## For the class packages

- Data entry fields read: `name, blurb, color, mods {hp, power, speed, defense}, look, aura (optional), passive {name,
  desc, icon}, ultimate {name, desc, icon, id?, unlock? (15)}` or a full `abilities` list. Kit `abilities.shift` wins
  in play and the HUD; the picker shows the data `ultimate`.
- Tests/showcase: `game.debug.scenario('class_demo', {masteryId: 'paladin', level: 18})`, `__game.setMastery(id)`,
  `progression.setMastery(id, {quiet: true})`. `p.data.masteryId` is set; `'mastery:set'` fires.

## Known gaps

- Only the stub data was seen in the picker (screenshots in 3D at both sizes); real names/looks arrive with the class data.
- The trial bonus is a flat +5% power, granted once per hero even if the mastery is later removed.
