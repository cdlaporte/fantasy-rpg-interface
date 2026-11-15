// Warrior specializations (docs/CLASSES.md): knight, berserker, battlemage. Owned by the warrior class package.
// Shape: docs/notes/meta.md section 1 (`{id, from, name, blurb, color, mods, basic, abilities, look}`), plus
// `ranks` (basic names per attack rank for the HUD / rank-up banner) and `nums` (every number the spec kit reads).
export default {
  knight: {
    id: 'knight', from: 'warrior', name: 'Knight', color: '#f2c94c',
    blurb: 'Timing and protection. Raise your shield at the perfect moment to bounce attacks back and guard your friends.',
    mods: { hp: 1.25, power: 1, speed: 0.95 },
    basic: { name: "Knight's Cleave", icon: 'sword', desc: 'A wide cleave; every fourth swing adds a free shield punch.' },
    ranks: {
      3: { name: "Knight's Cleave", icon: 'sword', desc: 'A wide cleave; every fourth swing adds a free shield punch.' },
      4: { name: 'Dawn Cleave', icon: 'sword', desc: 'Every third cleave launches a piercing crescent of light.' },
    },
    abilities: [
      { slot: 'f', id: 'shield_wall', name: 'Shield Wall', icon: 'shield', unlock: 8, cd: 0, cost: 0,
        desc: 'Hold F to block. Block right as a hit lands for a Perfect Block. Let go to Shield Slam.' },
      { slot: 'shift', id: 'aegis', name: 'Aegis of Flinkerton', icon: 'shield', unlock: 11, cd: 30, cost: 50,
        desc: 'A golden dome: everyone inside takes 80% less damage, then it explodes in light.' },
    ],
    look: {
      outfit: { style: 'plate', primary: '#c9ced6', secondary: '#f2c94c', accent: '#ffffff' },
      held: { style: 'sword_shield', color: '#f2c94c', glow: null },
      hat: { style: 'helm', color: '#c9ced6' },
      cape: { color: '#b8322a' },
    },
    colors: { gold: '#f2c94c', light: '#fff3c4', steel: '#c9ced6' },
    nums: {
      bulwark: { r: 4, dmgTaken: -0.3, pulse: 1.2 },
      cleave: { arc: 120, range: 1.35, dmg: 1.1, interval: 0.44, knockback: 6 },
      punch: { every: 4, delay: 0.12, arc: 80, range: 1.15, dmg: 0.6, stun: 0.5, knockback: 9 },
      crescent: { every: 3, dmg: 0.9, range: 5, speed: 12, radius: 0.35 },
      shield_wall: { arc: 120, reduce: 0.85, perfect: 0.25, stunAttacker: 1, speedMul: 0.6, perfectRage: 20 },
      shield_slam: { r: 2.4, arc: 110, dmg: 1.0, blockedFrac: 0.4, capCoef: 3, knockback: 9 },
      aegis: { r: 3.5, dur: 5, dmgTaken: -0.8, push: 3.5, endR: 3.5, endDmg: 3 },
    },
  },
  berserker: {
    id: 'berserker', from: 'warrior', name: 'Berserker', color: '#d7263d',
    blurb: 'Risk and momentum. The more you bleed, the faster you swing. Fill your Rage and go into a Frenzy.',
    mods: { hp: 1.1, power: 1, speed: 1.08 },
    basic: { name: 'Twin Axes', icon: 'axe', desc: 'Lightning-fast left-right axe chops. +8 Rage per hit.' },
    ranks: {
      3: { name: 'Twin Axes', icon: 'axe', desc: 'Lightning-fast left-right axe chops. +8 Rage per hit.' },
      4: { name: 'Boomerang Axes', icon: 'axe', desc: 'Every fourth chop hurls a spinning axe that flies back.' },
    },
    abilities: [
      { slot: 'f', id: 'whirlwind', name: 'Whirlwind', icon: 'axe', unlock: 8, cd: 0, cost: 0, need: 20,
        desc: 'Hold F to spin like a blender, shredding everything around you. Burns Rage.' },
      { slot: 'shift', id: 'skyfall_leap', name: 'Skyfall Leap', icon: 'up', unlock: 11, cd: 25, cost: 0,
        desc: 'Jump sky-high and crash down like a meteor, stunning everything nearby.' },
    ],
    look: {
      outfit: { style: 'vest', primary: '#d7263d', secondary: '#f1e9da', accent: '#5a3a22' },
      held: { style: 'axes', color: '#f1e9da', glow: null },
      hat: { style: 'horned', color: '#f1e9da' },
    },
    colors: { crimson: '#d7263d', bone: '#f1e9da', blood: '#8c1022' },
    nums: {
      wild_heart: { maxAttackSpeed: 0.6, hpHigh: 1.0, hpLow: 0.3 },
      frenzy: { at: 100, dur: 6, attackSpeed: 0.4, lifesteal: 0.08, afterimage: 0.1 },
      axes: { arc: 90, range: 1.15, dmg: 0.7, interval: 0.26, knockback: 2.5, rage: 8, swing: 0.22 },
      throw: { every: 4, dmg: 0.8, range: 5, speed: 10, radius: 0.3 },
      whirlwind: { need: 20, drain: 20, speedMul: 0.8, r: 1.6, dmg: 0.6, tick: 0.2, knockback: 1.5 },
      skyfall: { dist: 5, dur: 0.7, height: 3, r: 3, dmg: 4, stun: 1, knockback: 9, frenzyR: 4.2, frenzyMult: 1.3, coneDeg: 100 },
    },
  },
  battlemage: {
    id: 'battlemage', from: 'warrior', name: 'Battlemage', color: '#ff7a2f',
    blurb: 'Stance and combos. Your rune blade burns, freezes or zaps. Switch elements mid-fight to chain combos.',
    mods: { hp: 1, power: 1.05, speed: 1 },
    basic: { name: 'Rune Slash', icon: 'rune', desc: 'Blade slashes; every third one fires an Elemental Wave.' },
    ranks: {
      3: { name: 'Rune Slash', icon: 'rune', desc: 'Blade slashes; every third one fires an Elemental Wave.' },
      4: { name: 'Rune Tide', icon: 'rune', desc: 'Waves every second slash; they pierce and leave elemental ground.' },
    },
    abilities: [
      { slot: 'f', id: 'rune_shift', name: 'Rune Shift', icon: 'rune', unlock: 8, cd: 1.5, cost: 0,
        desc: 'Swap your blade: Fire, then Frost, then Storm, with a blast of the new element.' },
      { slot: 'shift', id: 'runestorm', name: 'Runestorm', icon: 'storm', unlock: 11, cd: 28, cost: 40,
        desc: 'Plant your blade: a ring of fire, then a frost blast, then six lightning bolts.' },
    ],
    look: {
      outfit: { style: 'robe', primary: '#4a4f6a', secondary: '#aab4be', accent: '#ff7a2f' },
      held: { style: 'runeblade', color: '#dfe6ee', glow: '#ff7a2f' },
    },
    colors: { fire: '#ff7a2f', frost: '#7fd6ff', storm: '#ffe14d', steam: '#f4f7fb', plasma: '#ff6be0' },
    nums: {
      elements: ['fire', 'frost', 'storm'],
      fire: { burnCoef: 0.3, burnDur: 3 },
      frost: { slow: 0.4, slowDur: 2 },
      storm: { chain: 2, frac: 0.5, range: 3 },
      slash: { arc: 110, range: 1.3, dmg: 1.0, interval: 0.42, knockback: 4 },
      wave: { every: 3, every4: 2, dmg: 1.2, range: 6, speed: 10, radius: 0.35, twinSide: 0.3 },
      ground: { r: 1.1, dur: 3, dmg: 0.25, stormChain: 4 },
      rune_shift: { r: 2.2, dmg: 0.8, knockback: 5 },
      runestorm: { dur: 3, r: 5, dmg: 2, times: [0.3, 1.3, 2.3], encoreAt: 3.0, bolts: 6, pillars: 6, pillarR: 2.4 },
    },
  },
};
