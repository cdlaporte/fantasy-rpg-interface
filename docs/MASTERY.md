# Round 4: tier-3 masteries (level 15)

Mr. Laporte asked for the third specialization tier. His decisions:
- **Level 15.** Rank V of the basic attack stays at 16; the level cap is 20.
- **Each mastery is a transform plus a passive.** It brings a new outfit and title, a signature passive that changes how the class plays, and an upgraded version of the subclass's ultimate on H (the `shift` slot). There is no new key.
- **The names are the earlier list**, two per subclass (18 total).
- **Unlock** is a ceremony with Laporte in his office, like the level-8 subclass ceremony. A Unit 4 question comes first: a right answer gives a small bonus, and the choice is always granted. Teacher mode can pick any mastery instantly.

## Already done by the lead's prep (do not redo)

- **Kit stubs:** `src/core/kits/<mastery>.js` exist for all 18 (`{id, parent: '<subclass>', tier: 3}`) and are registered in `KITS` (`src/core/kits/index.js`).
- **Layering:** `layerOf` walks the parent chain, so `kits.set(p, classId, '<mastery>')` layers class → subclass → mastery. A mastery's `abilities.shift` overrides the subclass ultimate, its hooks run after the parent hooks, and it can define `basic`, `update`, `onEquip`/`onUnequip`, and `resource` like any kit.
- **Entity fields:** with a mastery equipped, `p.data.specId` stays the SUBCLASS id (existing kits read it), and `p.data.masteryId` is the mastery id.

## The 18 masteries (ids fixed)

Each mastery gets:
- a passive that changes play,
- an upgraded ultimate on H (unlock 15) that visibly outclasses the subclass ultimate,
- an outfit/look patch (look vocabulary only, CONTRACTS section 6),
- a color identity.

| Subclass | Mastery A | Mastery B |
| --- | --- | --- |
| Knight | **Paladin** (`paladin`): holy protector. Perfect blocks heal you and classmates; swings leave sunlit ground. Aegis becomes **Sanctuary**, a dome that heals inside and smites enemies with light pillars. | **Sentinel** (`sentinel`): counter fortress. Blocking builds a Bastion meter that releases as a counter shockwave. Aegis becomes **Bulwark Fortress**, which taunts everything nearby and reflects every projectile. |
| Berserker | **Warlord** (`warlord`): battle commander. Kills rally classmates (haste, damage); Rage also buffs them. Skyfall becomes **War Banner**, a leap that plants a banner which buffs allies and scares enemies away. | **Juggernaut** (`juggernaut`): unstoppable. Rage grants size and armor, with no knockback above 50 Rage. Skyfall becomes **Stampede**, a rolling charge through everything. |
| Battlemage | **Spellblade** (`spellblade`): combo duelist. Each Rune Shift empowers the next 3 swings with the new element. Runestorm becomes **Prismatic Edge**, a rapid three-element slash sequence. | **Runeguard** (`runeguard`): warding runes. Swings drop rune wards that zap nearby enemies. Runestorm becomes **Rune Citadel**, a ring of wards that shields you inside. |
| Conjurer | **Summoner** (`summoner`): bigger army. Up to 5 familiars, plus a new Phoenix familiar. Grand Conjuration summons a **Guardian Dragon**. | **Illusionist** (`illusionist`): mirror images. Casting spawns short-lived decoy copies that taunt and burst. The ultimate becomes **Hall of Mirrors**, many copies all casting. |
| Sorcerer | **Stormcaller** (`stormcaller`): lightning. Charged shots chain between enemies and build Static. Cataclysm becomes **Thunderstorm**, many lightning strikes over time. | **Pyromancer** (`pyromancer`): fire everywhere. Burning spreads between enemies. Cataclysm becomes **Inferno**, a rain of fireballs and a fire ring. |
| Monk | **Sage** (`sage`): calm healer. Ki fills faster while standing still; Palm Strike heals classmates. Thousand Palms becomes **Enlightenment**, slow time around you plus a big heal. | **Mystic** (`mystic`): spirit fists. Palm Strikes launch spirit fists. Thousand Palms becomes **Avatar**, a giant spirit form whose punches shake the ground. |
| Archer | **Ranger** (`ranger`): wild companion. A wolf joins (beyond the classmates); traps on dodge. Starfall becomes **Wild Hunt**, hawks plus a wolf pack charge. | **Sharpshooter** (`sharpshooter`): precision. Full-draw shots crit and pierce farther. Starfall becomes **Rail Shot**, a ricocheting piercing beam. |
| Thief | **Trickster** (`trickster`): pranks. Smoke Vanish leaves a fake treasure chest decoy that explodes in confetti. Grand Heist becomes **Magic Trick**: swap places with enemies, coins everywhere. | **Swashbuckler** (`swashbuckler`): dashing duelist. Parry window on Dodge Roll; flashy riposte. Grand Heist becomes **Flourish**, a spinning rapier storm. |
| Ninja | **Windwalker** (`windwalker`): speed. Dashes leave wind blades; move speed up. Shadow Clones become **Cyclone Clones**, which spin as tornadoes. | **Smokestep** (`smokestep`): stealthy assassin. Shadow Step stealths you briefly and the next hit crits big. Clones become **Smoke Assassins**, who teleport between targets. |

## Data

Masteries live in `src/data/specs/<class>.js` beside the subclasses, as entries:

```js
{ id, from: '<subclass id>', tier: 3, name, blurb, color, mods: {hp, power, speed},
  look, passive: {name, desc}, ultimate: {name, desc, icon}, ...numbers }
```

- `progression.specIds(classId)` already filters by `from === classId`, so masteries never show in the level-8 picker. Use `masteryIds(specId)` for the tier-3 picker (the core package adds it).

## Balance

- Damage with a mastery should be about **+15%** over the round-3 targets: 77 / 93 / 109 / 127 at levels 14 / 16 / 18 / 20, so masteries land at about 89 / 107 / 125 / 146 at 15+.
- The two options per subclass, and all 18, stay within **±15%** of each other.
- Survivability for Paladin, Sentinel, Juggernaut and Sage may be higher, with damage up to 10% lower.

## Ownership

| Package | Owns |
| --- | --- |
| Core | `src/core/progression.js`, `src/core/kits/index.js` (fixes only; the layering API is fixed), `src/core/debug.js`, `src/core/save.js`, `src/core/player.js` (look composition), `src/ui/teacher.js`, `src/ui/pickers.js`, `src/ui/panel.js`, `src/ui/feedback.js`, `css/*.css`, `src/data/cutscenes/academy.js`, `src/data/dialogues/academy.js`, `src/config.js` (question context), `src/questions/unit4/provider.js` (context label), `tests/node/r4core-*.test.mjs`, `docs/notes/r4core.md` |
| Warrior | `src/core/kits/{paladin,sentinel,warlord,juggernaut,spellblade,runeguard}.js`, `src/data/specs/warrior.js` (add masteries only), `tests/node/r4-warrior*.test.mjs`, `docs/notes/r4-warrior.md` |
| Mage | `src/core/kits/{summoner,illusionist,stormcaller,pyromancer,sage,mystic}.js`, `src/data/specs/mage.js` (add masteries only), `tests/node/r4-mage*.test.mjs`, `docs/notes/r4-mage.md` |
| Rogue | `src/core/kits/{ranger,sharpshooter,trickster,swashbuckler,windwalker,smokestep}.js`, `src/data/specs/rogue.js` (add masteries only), `tests/node/r4-rogue*.test.mjs`, `docs/notes/r4-rogue.md` |

Class packages must not change their existing subclass kits except for tiny hooks they need. If a hook is needed, keep it backwards compatible and note it.
