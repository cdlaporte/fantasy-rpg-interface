// Rogue specializations (docs/CLASSES.md): Archer, Thief, Ninja. Owned by the rogue class package.
// Shapes: progression reads id/from/name/blurb/color/mods/basic/abilities/look (docs/notes/meta.md); the spec kits
// (src/core/kits/{archer,thief,ninja}.js) read `kit`. Coefficients are multiplied by the caster's power.
export default {
  archer: {
    id: 'archer', from: 'rogue', name: 'Archer', color: '#3fa34d',
    blurb: 'The sniper. Keep your distance, draw the bow and line up the perfect shot: farther away hits harder.',
    mods: { hp: 1, power: 1.1, speed: 1 },
    basic: { name: 'Longbow', icon: 'bow', desc: 'Tap for quick arrows. Hold to draw a piercing Power Shot.' },
    abilities: [
      { slot: 'f', id: 'arrow_rain', name: 'Arrow Rain', icon: 'rain', unlock: 8, cd: 9,
        desc: 'Finisher: arrows rain on a spot ahead. More pips, bigger storm.' },
      { slot: 'shift', id: 'starfall_arrow', name: 'Starfall Arrow', icon: 'star', unlock: 11, cd: 30,
        desc: 'Draw a giant star arrow that flies across the whole screen and drags enemies along.' },
    ],
    look: {
      outfit: { style: 'leather', primary: '#3fa34d', secondary: '#6b4f2a', accent: '#f2c94c' },
      held: { style: 'bow', color: '#8b5a2b', glow: null },
      hat: { style: 'feather', color: '#3fa34d' },
    },
    ranks: { 3: 'Longbow', 4: 'Twin Arrows', 5: 'Burning Shot' },
    kit: {
      dmgScale: 0.38,   // replaces the class dmgScale for this spec (measured, docs/notes/kit-rogue.md)
      lateScale: [[12, 1], [14, 0.77], [16, 0.79], [18, 0.86], [20, 0.855]],   // round 3: x dmgScale by level (docs/notes/r3a.md)
      colors: { main: '#3fa34d', gold: '#f2c94c', star: '#fff1a8', fire: '#ff7a2f' },
      eagleEye: { minDist: 1, maxDist: 7, bonus: 0.6, pipDist: 5 },
      // Longbow: release under `tapMax` s = quick arrow; longer = Power Shot (coef grows to `coefMax` at `drawFull` s).
      longbow: {
        tapMax: 0.16, cooldown: 0.35,
        arrow: { speed: 16, range: 9, coef: 0.9, knockback: 1 },
        pair: { coef: 0.62, spacing: 0.28 },                       // rank IV quick arrows fire in pairs
        draw: { full: 0.8, speedMul: 0.6, coefMin: 1.2, coefMax: 3.0, speed: 20, range: 11, knockback: 6, shake: 0.25 },
        splinters: { n: 5, arc: 50, dmgMul: 0.35, range: 3.5 },     // rank IV full Power Shot
        // round 3, rank V: a full Power Shot leaves a trail of burning ground along its flight
        burnTrail: { step: 1.3, r: 0.75, dur: 3, tick: 0.5, coef: 0.12, burnDps: 0.2, burnDur: 2, max: 9 },
      },
      arrowRain: { cd: 9, dist: 5, range: 8, r: 2.5, rPerPip: 0.31, dur: 2.5, tick: 0.5, coef: 0.5, slow: 0.4, arrowsPerTick: 4, fallSpeed: 14 },
      starfall: { cd: 30, draw: 0.6, aimRange: 10, drawSpeedMul: 0.3, speed: 22, range: 22, coef: 5, size: 3, dragMaxHp: 200,
        explode: { r: 3.5, coef: 2.5, shake: 0.6 } },
    },
  },

  thief: {
    id: 'thief', from: 'rogue', name: 'Thief', color: '#2a9d8f',
    blurb: 'The trickster. Vanish in smoke, stab from behind for triple damage, and shake gold out of everything.',
    mods: { hp: 1, power: 1, speed: 1.1 },
    basic: { name: 'Cutpurse Daggers', icon: 'dagger', desc: 'Twin slashes that shake coins loose. Hits from behind are Backstabs.' },
    abilities: [
      { slot: 'f', id: 'smoke_vanish', name: 'Smoke Vanish', icon: 'smoke', unlock: 8, cd: 10,
        desc: 'Poof! Smoke, caltrops and five seconds of stealth. Your first hit is a Backstab.' },
      { slot: 'shift', id: 'grand_heist', name: 'Grand Heist', icon: 'coin', unlock: 11, cd: 30,
        desc: 'Finisher: zigzag through six enemies, rob them all and land back where you started.' },
    ],
    look: {
      outfit: { style: 'cloak', primary: '#2a9d8f', secondary: '#1d3c45', accent: '#f2c94c' }, hood: true,
      held: { style: 'daggers', color: '#cfd8dc', glow: null },
    },
    ranks: { 3: 'Cutpurse Daggers', 4: 'Jackpot', 5: 'Coin Storm' },
    kit: {
      dmgScale: 0.27,   // replaces the class dmgScale for this spec (measured, docs/notes/kit-rogue.md)
      lateScale: [[12, 1], [14, 1.0], [16, 0.9], [18, 0.89], [20, 0.925]],
      colors: { main: '#2a9d8f', gold: '#f2c94c', smoke: '#5d6b78' },
      daggers: { coef: 0.6 },
      stickyFingers: { chance: 0.35, min: 1, max: 3, maxPerEnemy: 4, goldMul: 1.5 },
      backstab: { critMult: 3, arc: 1.9, stealthPips: 2 },
      pickpocket: { range: 1.6, gold: [3, 9], itemChance: 0.3, items: ['cheese', 'bread', 'smoke_pellet', 'potion_small'],
        noticeChance: 0.25, cooldown: 90 },
      jackpot: { coins: 5, coef: 1.0, range: 2.2, speed: 9, icd: 0.6 },
      // round 3, rank V: every third attack flings a fan of returning coins; Jackpot throws twice the coins
      coinStorm: { every: 3, n: 5, spread: 70, coef: 0.35, range: 4.5, speed: 11, jackpotMul: 2 },
      smokeVanish: { cd: 10, r: 2.5, smokeDur: 3, stealthDur: 5, speedBonus: 0.25, slow: 0.4,
        caltrops: { r: 2.5, dur: 4, coef: 0.12, tick: 0.5, slow: 0.35 } },
      heist: { cd: 30, targets: 6, range: 7, coef: 1.5, coefPerPip: 0.4, step: 0.14, mark: 5, coinsPerVictim: 2 },
    },
  },

  ninja: {
    id: 'ninja', from: 'rogue', name: 'Ninja', color: '#3d348b',
    blurb: 'The misdirection artist. Throw returning shuriken, step into the shadows behind enemies and leave decoys.',
    mods: { hp: 1, power: 1, speed: 1.12 },
    basic: { name: 'Shuriken', icon: 'shuriken', desc: 'Throw three shuriken that fly back to you and hit again.' },
    abilities: [
      { slot: 'f', id: 'shadow_step', name: 'Shadow Step', icon: 'shadow', unlock: 8, cd: 6,
        desc: 'Appear behind the nearest enemy. A decoy takes your place, then explodes.' },
      { slot: 'shift', id: 'shadow_clones', name: 'Shadow Clones', icon: 'shadow', unlock: 11, cd: 30,
        desc: 'Finisher: two shadow clones (three at full pips) copy every throw for 8 seconds.' },
    ],
    look: {
      outfit: { style: 'gi', primary: '#3d348b', secondary: '#1b1640', accent: '#e63946' },
      held: { style: 'shuriken', color: '#cfd8dc', glow: null },
      hat: { style: 'bandana', color: '#e63946' },
    },
    ranks: { 3: 'Shuriken', 4: 'Shuriken Storm', 5: 'Shuriken Halo' },
    kit: {
      dmgScale: 0.14,   // replaces the class dmgScale for this spec (measured, docs/notes/kit-rogue.md)
      lateScale: [[12, 1], [14, 0.93], [16, 1], [18, 1], [20, 0.97]],
      colors: { main: '#3d348b', sash: '#e63946', steel: '#cfd8dc', shadow: '#6a5acd' },
      afterimage: { every: 0.22, critWindow: 1 },
      shuriken: { n: 3, spread: 30, range: 6, coef: 0.5, speed: 12, interval: 0.3, catchCdr: 0.3 },
      shurikenIV: { n: 5, spread: 60, bounce: 1, bounceRange: 3.5 },
      // round 3, rank V: every third throw is a full halo of returning shuriken
      shurikenV: { every: 3, n: 10, range: 4.5, coef: 1.0 },
      shadowStep: { cd: 6, range: 7, behind: 0.75, ahead: 4, pips: 2,
        decoy: { ttl: 2.5, hpMul: 0.5, r: 2.25, coef: 2.0 } },
      clones: { cd: 30, n: 2, nFull: 3, dur: 8, mult: 0.6, dist: 1.3, hpMul: 0.3 },
    },
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Round 4: tier-3 masteries (docs/MASTERY.md), two per subclass, unlocked at level 15. Each entry: a look patch over
  // the subclass look, a passive and an upgraded ultimate (H / Shift, unlock 15). Behaviour: src/core/kits/<id>.js.
  // `kit.dmgScale` (x `kit.lateScale`, linear by level) multiplies everything the hero and their summons deal ON TOP of
  // the subclass scaling (rogue.js dmgScale x lateScale), tuned to ~+15% over the round-3 band (docs/notes/r4-rogue.md).
  // `mods` stay at power 1 / speed 1 so that power and speed come only from the kit (no double counting).
  ranger: {
    id: 'ranger', from: 'archer', tier: 3, name: 'Ranger', color: '#8fbf4a',
    blurb: 'Never hunt alone. A loyal wolf fights at your side, and every roll leaves a snare trap behind.',
    mods: { hp: 1.05, power: 1, speed: 1 },
    look: {
      outfit: { style: 'leather', primary: '#4f6b2e', secondary: '#7b4a2a', accent: '#8fbf4a' }, hood: true,
      cape: { color: '#3b5323' },
      held: { style: 'bow', color: '#6b3f1d', glow: '#c6f07a' },
      aura: { style: 'sparkle', color: '#8fbf4a' },
    },
    passive: { name: 'Wild Companion', desc: 'A wolf joins you (it comes back if it falls) and pounces on what you hit from far away. Dodge Roll leaves a snare trap.' },
    ultimate: { id: 'wild_hunt', name: 'Wild Hunt', icon: 'star', unlock: 15, cd: 30,
      desc: 'Howl! Three hawks dive on your foes while a wolf pack charges through them.' },
    kit: {
      dmgScale: 0.85, lateScale: [[15, 1.0], [16, 1.0], [18, 0.94], [20, 0.97]],
      colors: { main: '#8fbf4a', bark: '#7b4a2a', fur: '#4a4e57', cream: '#f1e9da', gold: '#f2c94c', spirit: '#c6f07a' },
      wolf: { powerMul: 0.6, hpMul: 0.6, speedMul: 1.3, size: 1.0, bite: 1.0, biteCd: 0.7, respawn: 8,
        pounce: { every: 3, minDist: 4.5, coef: 1.6 } },
      trap: { r: 0.85, dur: 12, max: 3, coef: 2.0, root: 1.6, snapR: 1.5 },
      hunt: { cd: 30, dur: 6, howlR: 4, wolves: 4, packPowerMul: 0.4, packHpMul: 0.6, spread: 0.9,
        charge: { dist: 9, speed: 15, r: 0.95, coef: 2.4, knockback: 5 },
        hawks: 3, hawkEvery: 0.75, hawkCoef: 0.8, hawkRange: 9, diveSpeed: 16 },
    },
  },

  sharpshooter: {
    id: 'sharpshooter', from: 'archer', tier: 3, name: 'Sharpshooter', color: '#4cc9f0',
    blurb: 'One shot, one bullseye. Full draws always crit and fly twice as far. Your ultimate bounces off walls.',
    mods: { hp: 1, power: 1, speed: 1 },
    look: {
      outfit: { style: 'leather', primary: '#1d2d44', secondary: '#4cc9f0', accent: '#ffd166' },
      hat: { style: 'cap', color: '#14213d' },
      cape: { color: '#14213d' },
      held: { style: 'bow', color: '#2b2d42', glow: '#4cc9f0' },
      aura: { style: 'glow', color: '#4cc9f0' },
    },
    passive: { name: 'Deadeye', desc: 'A laser sight shows your aim while you draw. Full-draw shots always crit hard and pierce much farther.' },
    ultimate: { id: 'rail_shot', name: 'Rail Shot', icon: 'bolt', unlock: 15, cd: 28,
      desc: 'Charge up, then fire a piercing lightning beam that ricochets off walls and enemies five times.' },
    kit: {
      dmgScale: 1, lateScale: [[15, 1.02], [16, 1.0], [18, 0.99], [20, 0.95]],
      colors: { main: '#4cc9f0', core: '#e0fbff', gold: '#ffd166', laser: '#ff4d6d' },
      deadeye: { critMult: 2.4, rangeMul: 1.8, speedMul: 1.35, size: 3.2, sightEvery: 6 },
      rail: { cd: 28, charge: 0.45, chargeSpeedMul: 0.3, aimRange: 12, range: 14, w: 1.0, coef: 3.2, bounces: 4, seek: 8,
        knockback: 4, shake: 0.7, endR: 2.6, endCoef: 2.5 },
    },
  },

  trickster: {
    id: 'trickster', from: 'thief', tier: 3, name: 'Trickster', color: '#c44dff',
    blurb: 'Pranks for days. Leave a fake treasure chest that explodes in confetti, then swap places with your enemies.',
    mods: { hp: 1, power: 1, speed: 1 },
    look: {
      outfit: { style: 'vest', primary: '#7b2cbf', secondary: '#ffd23f', accent: '#ff70a6' }, hood: false,
      hat: { style: 'wizard', color: '#3c096c' },
      cape: { color: '#9d4edd' },
      held: { style: 'daggers', color: '#f1e9da', glow: '#ff70a6' },
      aura: { style: 'sparkle', color: '#ff70a6' },
    },
    passive: { name: 'Prank Chest', desc: 'Smoke Vanish leaves a fake treasure chest. Enemies forget you and rush it, and it bursts in confetti that stuns them.' },
    ultimate: { id: 'magic_trick', name: 'Magic Trick', icon: 'coin', unlock: 15, cd: 30,
      desc: 'Finisher: swap places with up to six enemies, dazing each one, with coins flying everywhere.' },
    kit: {
      dmgScale: 1, lateScale: [[15, 1.0], [16, 0.88], [18, 0.87], [20, 0.85]],
      colors: { main: '#c44dff', pink: '#ff70a6', gold: '#f2c94c', confetti: ['#ff70a6', '#ffd23f', '#4cc9f0', '#7bdc3a', '#c44dff'] },
      chest: { ttl: 3, hpMul: 1.0, defense: 10, scale: 1.4, dist: 3.6, lure: 7, r: 2.6, coef: 2.0, stun: 1.2, knockback: 6, coins: 8, coinCoef: 0.35, coinRange: 3 },
      trick: { cd: 30, range: 7.5, targets: 6, step: 0.16, coef: 1.4, coefPerPip: 0.28, stun: 0.9, mark: 5, coins: 4, coinCoef: 0.3,
        coinRange: 2.6, finalCoins: 12, finalCoinCoef: 0.35, finalR: 2.6, finalCoef: 1.2 },
    },
  },

  swashbuckler: {
    id: 'swashbuckler', from: 'thief', tier: 3, name: 'Swashbuckler', color: '#d62839',
    blurb: 'En garde! Roll to parry, answer every blow with a flashy riposte, then spin into a storm of blades.',
    mods: { hp: 1.05, power: 1, speed: 1 },
    look: {
      outfit: { style: 'vest', primary: '#d62839', secondary: '#f1e9da', accent: '#ffd23f' }, hood: false,
      hat: { style: 'feather', color: '#1d3557' },
      cape: { color: '#9d0208' },
      held: { style: 'sword', color: '#e0e6ed', glow: '#ffd23f' },
      aura: { style: 'glow', color: '#ffd23f' },
    },
    passive: { name: 'Parry & Riposte', desc: 'Dodge Roll opens a parry window. An attack in that window is parried and you lunge back with a huge critical riposte.' },
    ultimate: { id: 'flourish', name: 'Flourish', icon: 'sword', unlock: 15, cd: 28,
      desc: 'Finisher: spin into a storm of rapier blades that spiral out around you, then end it with a Touche blast.' },
    kit: {
      dmgScale: 1, lateScale: [[15, 1.17], [16, 1.115], [18, 1.105], [20, 1.12]],
      colors: { main: '#d62839', gold: '#ffd23f', steel: '#e0e6ed', cream: '#f1e9da' },
      parry: { window: 0.65, reach: 4.5, icd: 0.2, maxPerWindow: 3 },
      riposte: { coef: 2.6, critMult: 2.5, knockback: 5, stun: 0.6, pips: 2, hitStop: 0.08 },
      flourish: { cd: 28, dur: 2.2, durPerPip: 0.16, speedMul: 1.25, dmgTaken: -0.5, bladeEvery: 0.09, bladeTurn: 0.62, bladeCoef: 0.5,
        bladeSpeed: 10, bladeRange: 4.2, spinEvery: 0.25, spinR: 2.0, spinCoef: 0.9, spinCrit: 0.3, finalR: 3.4, finalCoef: 5.5, finalBlades: 12 },
    },
  },

  windwalker: {
    id: 'windwalker', from: 'ninja', tier: 3, name: 'Windwalker', color: '#7fdbff',
    blurb: 'Faster than the wind. Every dash slices the air into blades, and your clones become living tornadoes.',
    mods: { hp: 1, power: 1, speed: 1 },
    look: {
      outfit: { style: 'gi', primary: '#e8fbff', secondary: '#4ea8de', accent: '#7fdbff' },
      hat: { style: 'bandana', color: '#4ea8de' },
      cape: { color: '#bde0fe' },
      held: { style: 'shuriken', color: '#e8fbff', glow: '#7fdbff' },
      aura: { style: 'storm', color: '#bde0fe' },
    },
    passive: { name: 'Tailwind', desc: 'You move 15% faster. Dodge Roll and Shadow Step cut a wind blade along your path, gust where you land and fling three wind crescents.' },
    ultimate: { id: 'cyclone_clones', name: 'Cyclone Clones', icon: 'storm', unlock: 15, cd: 30,
      desc: 'Finisher: two spinning tornado clones (three at full pips) hunt enemies, pull them in and shred them.' },
    kit: {
      dmgScale: 1, lateScale: [[15, 0.93], [16, 0.97], [18, 0.93], [20, 1.0]],
      colors: { main: '#7fdbff', white: '#e8fbff', sky: '#4ea8de', pale: '#bde0fe' },
      tailwind: { speed: 1.15 },
      blades: { icd: 0.4, w: 1.3, pathCoef: 0.6, gustR: 1.4, n: 3, spread: 40, coef: 0.6, speed: 13, range: 5, size: 1.3 },
      cyclone: { cd: 30, n: 2, nFull: 3, dur: 7, speed: 6.5, seek: 8, r: 1.5, pullR: 2.6, pull: 7, tick: 0.4, coef: 1.2,
        endR: 2.4, endCoef: 2.5, scale: 1.15, hpMul: 0.3 },
    },
  },

  smokestep: {
    id: 'smokestep', from: 'ninja', tier: 3, name: 'Smokestep', color: '#6b5b95',
    blurb: 'The unseen blade. Step through the shadows, vanish, and land one devastating critical strike.',
    mods: { hp: 1, power: 1, speed: 1 },
    look: {
      outfit: { style: 'cloak', primary: '#2b2440', secondary: '#120e1f', accent: '#ff4d6d' }, hood: true,
      cape: { color: '#1c1630' },
      held: { style: 'shuriken', color: '#8d99ae', glow: '#ff4d6d' },
      aura: { style: 'shadow', color: '#6b5b95' },
    },
    passive: { name: 'Shadowmeld', desc: 'Shadow Step turns you invisible for 2 seconds, and your next hit is an Assassinate: a huge critical.' },
    ultimate: { id: 'smoke_assassins', name: 'Smoke Assassins', icon: 'smoke', unlock: 15, cd: 30,
      desc: 'Finisher: three smoke assassins (four at full pips) teleport from enemy to enemy, striking from the shadows.' },
    kit: {
      dmgScale: 1, lateScale: [[15, 1.18], [16, 1.12], [18, 1.1], [20, 1.18]],
      colors: { main: '#6b5b95', blood: '#ff4d6d', smoke: '#2b2440', pale: '#b8a9e0' },
      shadowmeld: { stealth: 2, speed: 0.2, window: 2.5, critMult: 3.5 },
      assassins: { cd: 30, n: 3, nFull: 4, dur: 6, every: 0.5, range: 8, coef: 1.3, critChance: 0.3, stealth: 1.5, hpMul: 0.3 },
    },
  },
};
