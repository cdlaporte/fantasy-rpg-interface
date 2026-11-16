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
      5: { name: 'Twin Dawn', icon: 'sword', desc: 'Every third cleave sends a wide twin wave of light through everything.' },
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
      cleave: { arc: 120, range: 1.35, dmg: 0.4, interval: 0.44, knockback: 6 },
      punch: { every: 4, delay: 0.12, arc: 80, range: 1.3, dmg: 0.3, stun: 0.5, knockback: 9, lunge: 0.4, setupKnockback: 1.5 },
      crescent: { every: 3, dmg: 0.35, range: 5, speed: 12, radius: 0.35 },
      // round 3, rank V: the crescent becomes a wide twin wave (two big crescents side by side + a gold wave)
      twinWave: { dmg: 0.3, range: 6.5, speed: 12, radius: 0.5, spread: 0.16, side: 0.45, size: 1.9, waveDmg: 0.2, waveSize: 2.2 },
      shield_wall: { arc: 120, reduce: 0.85, perfect: 0.25, stunAttacker: 1, speedMul: 0.6, perfectRage: 20 },
      shield_slam: { r: 3.0, arc: 110, dmg: 0.4, blockedFrac: 0.4, capCoef: 3, knockback: 9 },
      aegis: { r: 4.4, dur: 5, dmgTaken: -0.8, push: 3.5, endR: 4.4, endDmg: 1.4 },
    },
    // round 3: outgoing damage x this table by level (linear between points; 1 up to 12). docs/notes/r3a.md.
    balance: { dmgMul: [[12, 1], [14, 1.05], [16, 1.02], [18, 1.04], [20, 1.12]] },
  },
  berserker: {
    id: 'berserker', from: 'warrior', name: 'Berserker', color: '#d7263d',
    blurb: 'Risk and momentum. The more you bleed, the faster you swing. Fill your Rage and go into a Frenzy.',
    mods: { hp: 1.1, power: 1, speed: 1.08 },
    basic: { name: 'Twin Axes', icon: 'axe', desc: 'Lightning-fast left-right axe chops. +8 Rage per hit.' },
    ranks: {
      3: { name: 'Twin Axes', icon: 'axe', desc: 'Lightning-fast left-right axe chops. +8 Rage per hit.' },
      4: { name: 'Boomerang Axes', icon: 'axe', desc: 'Every fourth chop hurls a spinning axe that flies back.' },
      5: { name: 'Splitting Axes', icon: 'axe', desc: 'Every third chop hurls an axe that splits into three when it hits.' },
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
      axes: { arc: 90, range: 1.15, dmg: 0.125, interval: 0.26, knockback: 2.5, rage: 8, swing: 0.22 },
      throw: { every: 4, dmg: 0.12, range: 5, speed: 10, radius: 0.3 },
      // round 3, rank V: a thrown axe every third chop; on its first hit it splits into a fan of small axes
      splitAxe: { every: 3, n: 3, arc: 80, dmg: 0.08, range: 3.5, speed: 11, size: 0.9 },
      whirlwind: { need: 20, drain: 20, speedMul: 0.8, r: 2.0, dmg: 0.085, tick: 0.2, knockback: 0 },
      skyfall: { dist: 5, range: 7, dur: 0.7, height: 3, r: 3.75, dmg: 0.75, stun: 1, knockback: 9, frenzyR: 5.25, frenzyMult: 1.3, coneDeg: 100 },
    },
    balance: { dmgMul: [[12, 1], [14, 1.15], [16, 1.12], [18, 1.12], [20, 1.03]] },
  },
  battlemage: {
    id: 'battlemage', from: 'warrior', name: 'Battlemage', color: '#ff7a2f',
    blurb: 'Stance and combos. Your rune blade burns, freezes or zaps. Switch elements mid-fight to chain combos.',
    mods: { hp: 1, power: 1.05, speed: 1 },
    basic: { name: 'Rune Slash', icon: 'rune', desc: 'Blade slashes; every third one fires an Elemental Wave.' },
    ranks: {
      3: { name: 'Rune Slash', icon: 'rune', desc: 'Blade slashes; every third one fires an Elemental Wave.' },
      4: { name: 'Rune Tide', icon: 'rune', desc: 'Waves every second slash; they pierce and leave elemental ground.' },
      5: { name: 'Rune Tempest', icon: 'rune', desc: 'Huge waves that carry two elements at once: the current one and the last.' },
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
      fire: { burnCoef: 0.09, burnDur: 3 },
      frost: { slow: 0.4, slowDur: 2 },
      storm: { chain: 2, frac: 0.5, range: 3 },
      slash: { arc: 110, range: 1.3, dmg: 0.25, interval: 0.42, knockback: 4 },
      wave: { every: 3, every4: 2, dmg: 0.26, dmg4: 0.15, range: 6, speed: 10, radius: 0.35, twinSide: 0.3 },
      ground: { r: 1.1, dur: 3, dmg: 0.03, stormChain: 4 },
      // round 3, rank V: waves carry the current AND the previous element (colour + glow), bigger
      wave5: { size: 1.9, radius: 0.5 },
      rune_shift: { r: 2.75, dmg: 0.2, knockback: 5 },
      runestorm: { dur: 3, r: 6.25, dmg: 0.45, times: [0.3, 1.3, 2.3], encoreAt: 3.0, bolts: 6, pillars: 6, pillarR: 3.0 },
    },
    balance: { dmgMul: [[12, 1], [14, 0.97], [16, 0.94], [18, 0.92], [20, 0.95]] },
  },

  // ---------------------------------------------------------------------------------------------------------------
  // round 4: tier-3 masteries (docs/MASTERY.md), level 15. Each is layered over its subclass kit
  // (src/core/kits/<id>.js); `from` is the subclass. `mods.power` stays 1 (damage is tuned by `balance.dmgMul`, a
  // multiplier on top of the subclass table), so the DPS band does not depend on how stats are composed.
  // `abilities` lists the upgraded ultimate (slot shift, unlock 15) for the HUD / ability list.
  paladin: {
    id: 'paladin', from: 'knight', tier: 3, name: 'Paladin', color: '#ffe08a',
    blurb: 'Holy protector. Perfect blocks heal the whole team, and every swing leaves sunlight on the ground.',
    mods: { hp: 1.1, power: 1, speed: 1 },
    look: {
      outfit: { style: 'plate', primary: '#f6f2e4', secondary: '#f2c94c', accent: '#7cc8ff' },
      hat: { style: 'circlet', color: '#ffd966' },
      cape: { color: '#fbf7ea' },
      held: { style: 'sword_shield', color: '#fff3c4', glow: '#ffe08a' },
      aura: { style: 'glow', color: '#ffe08a' },
    },
    passive: { name: 'Dawnward', desc: 'Perfect Blocks heal you and nearby classmates. Every other cleave leaves a patch of sunlight that heals friends and burns foes.' },
    ultimate: { name: 'Sanctuary', icon: 'shield', desc: 'A huge holy dome: friends inside heal and take 80% less damage while pillars of light smite every enemy, then it bursts.' },
    abilities: [
      { slot: 'shift', id: 'sanctuary', name: 'Sanctuary', icon: 'shield', unlock: 15, cd: 32, cost: 50,
        desc: 'A huge holy dome that heals friends inside while pillars of light smite enemies. It ends in a blinding burst.' },
    ],
    colors: { sun: '#ffe08a', gold: '#f2c94c', light: '#fffbe6', sky: '#7cc8ff', white: '#ffffff' },
    nums: {
      dawnward: { r: 5, healPct: 0.08, selfPct: 0.06 },
      sunlit: { every: 2, dist: 1.25, r: 1.15, dur: 3, tick: 0.5, dmg: 0.07, healPct: 0.006, max: 4 },
      sanctuary: { r: 5.5, dur: 6, dmgTaken: -0.8, tick: 0.5, healPct: 0.025, push: 1.5, smiteEvery: 0.5, smites: 2, smiteR: 1.5,
        smiteDmg: 0.42, smiteStun: 0.3, endR: 6.5, endDmg: 1.6 },
    },
    balance: { dmgMul: [[15, 1.04], [16, 1.0], [18, 0.99], [20, 0.95]] },
  },
  sentinel: {
    id: 'sentinel', from: 'knight', tier: 3, name: 'Sentinel', color: '#5aa0ff',
    blurb: 'Counter fortress. Every hit you block charges your Bastion, then it all comes back as one huge shockwave.',
    mods: { hp: 1.15, power: 1, speed: 1 },
    look: {
      outfit: { style: 'plate', primary: '#5d6b7a', secondary: '#5aa0ff', accent: '#dfe9f5' },
      hat: { style: 'helm', color: '#8796a8' },
      cape: { color: '#1f3a6b' },
      held: { style: 'sword_shield', color: '#b9cde6', glow: '#5aa0ff' },
      aura: { style: 'storm', color: '#5aa0ff' },
    },
    passive: { name: 'Bastion', desc: 'Blocking and getting hit fill a Bastion meter. When it is full it explodes as a counter shockwave that stuns.' },
    ultimate: { name: 'Bulwark Fortress', icon: 'shield', desc: 'Become a fortress: every enemy nearby must attack you, every projectile bounces back, and the walls fall with a crash.' },
    abilities: [
      { slot: 'shift', id: 'bulwark_fortress', name: 'Bulwark Fortress', icon: 'shield', unlock: 15, cd: 30, cost: 50,
        desc: 'Taunt everything nearby, take half damage and reflect every projectile. Ends with a crash that hits harder the more you soaked.' },
    ],
    colors: { blue: '#5aa0ff', steel: '#b9cde6', deep: '#1f3a6b', white: '#eaf3ff' },
    nums: {
      bastion: { max: 100, block: 14, perfect: 30, hurt: 5, slamHit: 4, r: 3.4, dmg: 1.0, blockedFrac: 0.4, capCoef: 3, stun: 0.7, knockback: 10, glowAt: 70 },
      fortress: { r: 3.2, dur: 6, absorb: 0.5, tauntR: 8, pulse: 1, pulseR: 2.6, pulseDmg: 0.45, reflectMult: 1.5, endR: 4.8, endDmg: 1.3,
        soakFrac: 0.5, capCoef: 4, towers: 4 },
    },
    balance: { dmgMul: [[15, 1.03], [16, 1.02], [18, 1.06], [20, 1.01]] },
  },
  warlord: {
    id: 'warlord', from: 'berserker', tier: 3, name: 'Warlord', color: '#f0a43a',
    blurb: 'Battle commander. Every defeat rallies your team, and your Rage fires up your classmates too.',
    mods: { hp: 1.05, power: 1, speed: 1 },
    look: {
      outfit: { style: 'plate', primary: '#a8202f', secondary: '#f0a43a', accent: '#f1e9da' },
      hat: { style: 'horned', color: '#f0a43a' },
      cape: { color: '#7d1020' },
      held: { style: 'axes', color: '#ffe2a8', glow: '#f0a43a' },
      aura: { style: 'flame', color: '#f0a43a' },
    },
    passive: { name: 'Rally', desc: 'Each defeat rallies you and nearby classmates: faster and harder hits. Your Rage powers up your classmates as well.' },
    ultimate: { name: 'War Banner', icon: 'up', desc: 'Leap into the fight and plant a great banner: friends near it fight harder, enemies flee in fear, war drums pound.' },
    abilities: [
      { slot: 'shift', id: 'war_banner_leap', name: 'War Banner', icon: 'up', unlock: 15, cd: 26, cost: 0,
        desc: 'Leap and plant a great banner: friends near it hit harder and faster, enemies flee, war drums shake the ground.' },
    ],
    colors: { gold: '#f0a43a', crimson: '#d7263d', banner: '#a8202f', light: '#ffe2a8' },
    nums: {
      rally: { r: 8, dur: 4, power: 0.15, attackSpeed: 0.15, haste: 0.2, textIcd: 1.5 },
      rageShare: { r: 8, power: 0.25, attackSpeed: 0.2, every: 0.5 },
      banner: { dist: 5, range: 7, dur: 0.6, height: 3.2, landR: 4.2, landDmg: 0.9, stun: 1, knockback: 10, coneDeg: 100,
        life: 8, auraR: 5, power: 0.25, attackSpeed: 0.25, regenPct: 0.02, fearR: 5, fear: 0, fearPush: 6, fearSlow: 0.35, fearSlowDur: 2, fearMark: 3,
        drum: 1.2, drumR: 4.2, drumDmg: 0.32 },
    },
    balance: { dmgMul: [[15, 1.21], [16, 1.21], [18, 0.99], [20, 1.05]] },
  },
  juggernaut: {
    id: 'juggernaut', from: 'berserker', tier: 3, name: 'Juggernaut', color: '#ff6a2a',
    blurb: 'Unstoppable. Rage makes you bigger and tougher, and past half Rage nothing can push you around.',
    mods: { hp: 1.2, power: 1, speed: 1 },
    look: {
      outfit: { style: 'plate', primary: '#4a4d55', secondary: '#ff6a2a', accent: '#2a2b30' },
      hat: { style: 'helm', color: '#6b6f78' },
      cape: null,
      held: { style: 'axes', color: '#9aa0aa', glow: '#ff6a2a' },
      aura: { style: 'flame', color: '#ff6a2a' },
    },
    passive: { name: 'Unstoppable Force', desc: 'Rage makes you bigger and tougher. Above 50 Rage you cannot be knocked back and you trample enemies you walk into.' },
    ultimate: { name: 'Stampede', icon: 'dash', desc: 'A rolling charge that smashes through everything, bouncing from enemy to enemy, then ends in a huge quake.' },
    abilities: [
      { slot: 'shift', id: 'stampede', name: 'Stampede', icon: 'dash', unlock: 15, cd: 26, cost: 0,
        desc: 'Charge through everything, bouncing from enemy to enemy, and finish with a ground-shaking quake.' },
    ],
    colors: { ember: '#ff6a2a', iron: '#6b6f78', dust: '#b49a7a', magma: '#ffb347' },
    nums: {
      force: { maxSize: 0.3, maxArmor: 0.3, kbAt: 50, trampleEvery: 0.3, trampleR: 0.55, trampleDmg: 0.1, trampleKb: 7 },
      stampede: { segs: 4, dist: 4.2, speed: 17, dmg: 0.55, hitRadius: 0.8, knockback: 12, stun: 0.6, gap: 0.08, seek: 6.5,
        dustEvery: 0.05, endR: 4.2, endDmg: 1.0, endStun: 1 },
    },
    balance: { dmgMul: [[15, 1.25], [16, 1.12], [18, 0.98], [20, 1.12]] },
  },
  spellblade: {
    id: 'spellblade', from: 'battlemage', tier: 3, name: 'Spellblade', color: '#ff6be0',
    blurb: 'Combo duelist. Every Rune Shift charges your next three swings with the new element. Dance through them all.',
    mods: { hp: 1, power: 1, speed: 1 },
    look: {
      outfit: { style: 'leather', primary: '#2e2f45', secondary: '#ff6be0', accent: '#ffe14d' },
      hat: { style: 'feather', color: '#ff6be0' },
      cape: { color: '#6b2fa8' },
      held: { style: 'runeblade', color: '#ffffff' },
    },
    passive: { name: 'Spellweave', desc: 'Each Rune Shift empowers your next 3 swings: fire swings explode, frost swings throw ice shards, storm swings call lightning.' },
    ultimate: { name: 'Prismatic Edge', icon: 'rune', desc: 'Flash from enemy to enemy in a blur of fire, frost and lightning slashes, then end with a rainbow blast.' },
    abilities: [
      { slot: 'shift', id: 'prismatic_edge', name: 'Prismatic Edge', icon: 'rune', unlock: 15, cd: 28, cost: 40,
        desc: 'Teleport-slash between enemies nine times in fire, frost and storm, then finish with a prismatic blast.' },
    ],
    colors: { prism: '#ff6be0', white: '#ffffff', violet: '#b48cff' },
    nums: {
      spellweave: { charges: 3, interval: 0.8, fireR: 2.4, fireArc: 110, fireDmg: 0.2, frostN: 5, frostSpread: 50, frostDmg: 0.09, frostRange: 5,
        stormJumps: 3, stormRange: 4.5, stormDmg: 0.16, finR: 2.6, finDmg: 0.22 },
      edge: { strikes: 9, every: 0.13, range: 6.5, r: 1.7, dmg: 0.3, behind: 0.9, finR: 3.8, finDmg: 1.0 },
    },
    balance: { dmgMul: [[15, 0.97], [16, 0.92], [18, 0.93], [20, 0.93]] },
  },
  runeguard: {
    id: 'runeguard', from: 'battlemage', tier: 3, name: 'Runeguard', color: '#8f7dff',
    blurb: 'Warding runes. Your swings drop glowing rune wards that zap enemies and shield you while you stand near them.',
    mods: { hp: 1.1, power: 1, speed: 1 },
    look: {
      outfit: { style: 'plate', primary: '#2b2d4a', secondary: '#8f7dff', accent: '#dfe6ee' },
      hat: { style: 'circlet', color: '#8f7dff' },
      cape: { color: '#3a2f7a' },
      held: { style: 'runeblade', color: '#e6e0ff' },
      aura: { style: 'sparkle', color: '#8f7dff' },
    },
    passive: { name: 'Rune Wards', desc: 'Every other swing drops a rune ward of your element that zaps nearby enemies. Near your wards you take 15% less damage.' },
    ultimate: { name: 'Rune Citadel', icon: 'rune', desc: 'Raise a ring of eight rune wards that shield you, fire bolts of every element, then all explode at once.' },
    abilities: [
      { slot: 'shift', id: 'rune_citadel', name: 'Rune Citadel', icon: 'rune', unlock: 15, cd: 28, cost: 40,
        desc: 'A ring of eight wards: you are shielded inside while they zap everything in fire, frost and storm, then detonate.' },
    ],
    colors: { rune: '#8f7dff', light: '#e6e0ff', deep: '#3a2f7a' },
    nums: {
      wards: { every: 2, dist: 1.2, max: 4, life: 6, zapEvery: 0.9, zapR: 3.2, dmg: 0.16, nearR: 2.6, dmgTaken: -0.15, r: 0.6 },
      citadel: { n: 8, ringR: 3.6, dur: 6, insideR: 4.2, dmgTaken: -0.4, shieldPct: 0.2, zapEvery: 0.55, zapR: 4.6, dmg: 0.16,
        wallEvery: 0.6, burstR: 1.7, burstDmg: 0.5 },
    },
    balance: { dmgMul: [[15, 1.09], [16, 0.95], [18, 0.96], [20, 0.97]] },
  },
};
