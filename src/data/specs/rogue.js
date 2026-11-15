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
    ranks: { 3: 'Longbow', 4: 'Twin Arrows' },
    kit: {
      dmgScale: 0.42,   // replaces the class dmgScale for this spec (measured, docs/notes/kit-rogue.md)
      colors: { main: '#3fa34d', gold: '#f2c94c', star: '#fff1a8', fire: '#ff7a2f' },
      eagleEye: { minDist: 1, maxDist: 7, bonus: 0.6, pipDist: 5 },
      // Longbow: release under `tapMax` s = quick arrow; longer = Power Shot (coef grows to `coefMax` at `drawFull` s).
      longbow: {
        tapMax: 0.16, cooldown: 0.35,
        arrow: { speed: 16, range: 9, coef: 0.9, knockback: 1 },
        pair: { coef: 0.62, spacing: 0.28 },                       // rank IV quick arrows fire in pairs
        draw: { full: 0.8, speedMul: 0.6, coefMin: 1.2, coefMax: 3.0, speed: 20, range: 11, knockback: 6, shake: 0.25 },
        splinters: { n: 5, arc: 50, dmgMul: 0.35, range: 3.5 },     // rank IV full Power Shot
      },
      arrowRain: { cd: 9, dist: 5, r: 2, rPerPip: 0.25, dur: 2.5, tick: 0.5, coef: 0.5, slow: 0.4, arrowsPerTick: 4, fallSpeed: 14 },
      starfall: { cd: 30, draw: 0.6, drawSpeedMul: 0.3, speed: 22, range: 22, coef: 5, size: 3, dragMaxHp: 200,
        explode: { r: 2.8, coef: 2.5, shake: 0.6 } },
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
    ranks: { 3: 'Cutpurse Daggers', 4: 'Jackpot' },
    kit: {
      dmgScale: 0.27,   // replaces the class dmgScale for this spec (measured, docs/notes/kit-rogue.md)
      colors: { main: '#2a9d8f', gold: '#f2c94c', smoke: '#5d6b78' },
      daggers: { coef: 0.6 },
      stickyFingers: { chance: 0.35, min: 1, max: 3, maxPerEnemy: 4, goldMul: 1.5 },
      backstab: { critMult: 3, arc: 1.9, stealthPips: 2 },
      pickpocket: { range: 1.6, gold: [3, 9], itemChance: 0.3, items: ['cheese', 'bread', 'smoke_pellet', 'potion_small'],
        noticeChance: 0.25, cooldown: 90 },
      jackpot: { coins: 5, coef: 1.0, range: 2.2, speed: 9, icd: 0.6 },
      smokeVanish: { cd: 10, r: 2, smokeDur: 3, stealthDur: 5, speedBonus: 0.25, slow: 0.4,
        caltrops: { r: 2, dur: 4, coef: 0.12, tick: 0.5, slow: 0.35 } },
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
    ranks: { 3: 'Shuriken', 4: 'Shuriken Storm' },
    kit: {
      dmgScale: 0.14,   // replaces the class dmgScale for this spec (measured, docs/notes/kit-rogue.md)
      colors: { main: '#3d348b', sash: '#e63946', steel: '#cfd8dc', shadow: '#6a5acd' },
      afterimage: { every: 0.22, critWindow: 1 },
      shuriken: { n: 3, spread: 30, range: 6, coef: 0.5, speed: 12, interval: 0.3, catchCdr: 0.3 },
      shurikenIV: { n: 5, spread: 44, bounce: 1, bounceRange: 3.5 },
      shadowStep: { cd: 6, range: 7, behind: 0.75, ahead: 4, pips: 2,
        decoy: { ttl: 2.5, hpMul: 0.5, r: 1.8, coef: 2.0 } },
      clones: { cd: 30, n: 2, nFull: 3, dur: 8, mult: 0.6, dist: 1.3, hpMul: 0.3 },
    },
  },
};
