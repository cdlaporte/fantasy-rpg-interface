// Mage specializations: Conjurer, Sorcerer, Monk (see docs/CLASSES.md). Owned by the mage class package.
// Shapes read by Meta (docs/notes/meta.md): id, from, name, blurb, color, mods, basic, abilities, look.
// `kit`, `ranks`, `balance` (and Monk's `resource`) are read by src/core/kits/{conjurer,sorcerer,monk}.js.
const TEAL = '#3fe0c5', EMBER = '#ff5a36', STORM = '#b48cff', GOLD = '#ffd23f', JADE = '#3fbf7f';

export default {
  // ------------------------------------------------------------------------------------------------ CONJURER
  conjurer: {
    id: 'conjurer', from: 'mage', name: 'Conjurer', color: TEAL,
    blurb: 'The one-student army. Mark a target and your spirit fox, owl and stoneling pile on it.',
    mods: { hp: 1.1, power: 0.9, speed: 1 },
    basic: { name: 'Spirit Bolt', icon: 'orb', desc: 'A spirit orb that marks enemies. Your familiars hunt marked targets.' },
    abilities: [
      { slot: 'f', id: 'summon_familiar', name: 'Summon Familiar', icon: 'summon', unlock: 8,
        desc: 'Call a Fox, then an Owl, then a Stoneling. Up to three stay with you.' },
      { slot: 'shift', id: 'grand_conjuration', name: 'Grand Conjuration', icon: 'summon', unlock: 11,
        desc: 'A giant spirit guardian stomps the battlefield while your pets grow huge.' },
    ],
    look: {
      outfit: { style: 'robe', primary: '#1f9e8a', secondary: '#bff7ee', accent: TEAL },
      held: { style: 'orb', color: TEAL, glow: TEAL },
      hat: { style: 'circlet', color: TEAL },
    },
    aura: { style: 'sparkle', color: TEAL },
    ranks: { 3: { name: 'Spirit Bolt', icon: 'orb' }, 4: { name: 'Spirit Bolt: Soul Chase', icon: 'orb' } },
    kit: {
      color: TEAL, light: '#bff7ee',
      spiritBolt: { speed: 10, range: 7, dmg: 0.9, interval: 0.45, radius: 0.2, size: 1.1, markT: 4, markPower: 0.1 },
      markBonus: 0.5,                         // familiars deal +50% to marked targets
      spirit: { dmg: 1.5, speed: 8, range: 10, homing: 6, homingRange: 9, size: 1.2 },   // rank IV soul chase
      summon: { cd: 6, cost: 30, max: 3, replaceHeal: 0.1 },
      familiars: {
        fox: { name: 'Spirit Fox', powerMul: 0.55, hpMul: 0.35, speedMul: 1.45, radius: 0.28,
          look: { rig: 'quadruped', size: 0.55, colors: { body: TEAL, belly: '#e8fffb', accent: '#ffffff', eye: '#0b3b36' },
            features: ['tail_bushy', 'ears_pointy'], hero: null },
          attack: { use: 'melee_arc', name: 'Bite', arc: 80, range: 0.75, dmg: 0.6, knockback: 1, cd: 0.5, windup: 0.08, style: 'claw', color: TEAL } },
        owl: { name: 'Spirit Owl', powerMul: 0.55, hpMul: 0.3, speedMul: 1.15, radius: 0.25, flying: true, keepRange: 3.5,
          look: { rig: 'flyer', size: 0.5, colors: { body: '#2bb8a3', belly: '#d9fff8', accent: '#ffe9a8', eye: GOLD },
            features: ['wings_bird', 'glow'], hero: null },
          attack: { use: 'projectile', name: 'Spirit Spark', model: 'spark', speed: 11, range: 6, dmg: 0.6, radius: 0.15, cd: 0.8,
            windup: 0.1, type: 'magic', color: TEAL, glow: '#ffffff', size: 0.8 } },
        stoneling: { name: 'Stoneling', powerMul: 0.55, hpMul: 0.9, speedMul: 0.85, radius: 0.36, defense: 4,
          look: { rig: 'golem', size: 0.7, colors: { body: '#5f7a73', belly: TEAL, accent: TEAL, eye: '#bff7ee' },
            features: ['rocky', 'crystal'], hero: null },
          attack: { use: 'melee_arc', name: 'Slam', arc: 120, range: 0.95, dmg: 0.9, knockback: 3, cd: 1.1, windup: 0.12, style: 'fist', color: TEAL } },
      },
      order: ['fox', 'owl', 'stoneling'],
      grand: { cd: 35, cost: 60, dur: 8, size: 1.8, stompEvery: 1.4, stompR: 2.6, stompDmg: 2.5, hpMul: 2, petScale: 1.4,
        petHaste: 0.4, petPower: 0.3, speedMul: 1.0,
        look: { rig: 'golem', size: 1.8, colors: { body: '#2aa893', belly: '#bff7ee', accent: '#ffffff', eye: '#ffffff' },
          features: ['crystal', 'antlers', 'mossy'], hero: null } },
      // spec boons
      pack_leader: { max: 4, haste: 0.35, hasteT: 2.5 },
      soul_link: { mana: 2, burstR: 1.8, burstDmg: 1.2, heal: 0.08 },
      spirit_swap: { r: 2.2, dmgMul: 0.6, range: 12 },
      echo: { dmg: 0.35, speed: 10, range: 6, size: 0.6 },
    },
    balance: { dmgMul: [[8, 0.62], [10, 0.62], [12, 0.62]] },
  },

  // ------------------------------------------------------------------------------------------------ SORCERER
  sorcerer: {
    id: 'sorcerer', from: 'mage', name: 'Sorcerer', color: EMBER,
    blurb: 'Charge-up artillery. Hold the attack key: embers, then a fireball, then a lightning lance.',
    mods: { hp: 0.95, power: 1.15, speed: 1 },
    basic: { name: 'Overcharge', icon: 'fire', desc: 'Tap for embers, hold for a Fireball, hold a full second for an Arc Lance.' },
    abilities: [
      { slot: 'f', id: 'meteor', name: 'Meteor', icon: 'meteor', unlock: 8, desc: 'Drop a burning meteor a few steps ahead of you.' },
      { slot: 'shift', id: 'cataclysm', name: 'Cataclysm', icon: 'meteor', unlock: 11, desc: 'Five meteors smash the biggest crowds you can see.' },
    ],
    look: {
      outfit: { style: 'robe', primary: '#a3172f', secondary: '#f2c94c', accent: EMBER },
      held: { style: 'staff', color: '#5a3a22', glow: EMBER },
      hat: { style: 'wizard', color: '#7a0f22' },
    },
    aura: { style: 'sparkle', color: EMBER },
    ranks: { 3: { name: 'Overcharge', icon: 'fire' }, 4: { name: 'Overcharge: Forked Lance', icon: 'storm' } },
    kit: {
      color: EMBER, storm: STORM, gold: '#ffb347',
      charge: { mid: 0.3, full: 1.0, speedMul: 0.7, quick: 1.3, recover: 0.12, emberGap: 0.22 },
      ember: { dmg: 0.6, speed: 13, range: 7, radius: 0.14, size: 0.8 },
      fireball: { cost: 10, dmg: 1.8, speed: 9, range: 7, radius: 0.24, size: 1.3, r: 1.5, burnT: 2, burn: 0.25,
        fireR: 1.2, fireDur: 3, fireDmg: 0.25 },
      fireballIV: { r: 1.7, fireR: 1.8, fireDur: 5 },
      lance: { cost: 25, dmg: 2.8, range: 8, w: 0.6, knockback: 3, shake: 0.22 },
      fork: { dmg: 1.0, range: 3.5 },
      meteor: { cd: 10, cost: 40, dist: 4, delay: 0.9, r: 2.5, dmg: 4.5, knockback: 7, shake: 0.45,
        fireR: 2.0, fireDur: 4, fireDmg: 0.35 },
      cataclysm: { cd: 40, cost: 80, n: 5, every: 0.55, delay: 0.85, r: 2.4, dmg: 3.5, range: 9, densR: 2.5, shake: 0.6 },
      // spec boons
      wildfire: { r: 1.8, dmg: 1.0, burnT: 3, burn: 0.3, fireDur: 2 },
      storm_lance: { dur: 2, tick: 0.25, dmg: 0.3, w: 0.5 },
      meteor_echo: { n: 3, gap: 1.6, delay: 0.3, r: 1.5, dmg: 2.0 },
      quick_study: { rate: 1.3 },
    },
    balance: { dmgMul: [[8, 0.62], [10, 0.62], [12, 0.62]] },
  },

  // ------------------------------------------------------------------------------------------------ MONK
  monk: {
    id: 'monk', from: 'mage', name: 'Monk', color: GOLD,
    blurb: 'The mage who punches. Four-beat combos, flying kicks, and fists that knock arrows back.',
    mods: { hp: 1.3, power: 1, speed: 1.15 },
    basic: { name: 'Four-Beat Combo', icon: 'fist', desc: 'Jab, jab, kick, PALM STRIKE. Punching swats enemy shots back.' },
    abilities: [
      { slot: 'f', id: 'flying_kick', name: 'Flying Kick', icon: 'kick', unlock: 8, desc: 'Dash-kick an enemy, then bounce to the next one. Up to three times.' },
      { slot: 'shift', id: 'thousand_palms', name: 'Thousand Palms', icon: 'fist', unlock: 11, desc: 'Become a blur that strikes every nearby enemy twelve times.' },
    ],
    look: {
      outfit: { style: 'gi', primary: '#f4a300', secondary: JADE, accent: GOLD },
      held: { style: 'fists', color: GOLD, glow: GOLD },
      hat: { style: 'bandana', color: JADE },
    },
    aura: { style: 'sparkle', color: GOLD },
    resource: { id: 'ki', name: 'Ki', max: 100, color: GOLD, start: 0 },
    ranks: { 3: { name: 'Four-Beat Combo', icon: 'fist' }, 4: { name: 'Five-Beat Combo', icon: 'fist' } },
    kit: {
      color: GOLD, jade: JADE,
      combo: { beat: 0.18, palmPause: 0.3, reset: 0.7, kiPerHit: 8 },
      beats: [
        { name: 'Jab', arc: 70, range: 0.9, dmg: 0.5, knockback: 1.5, lunge: 0.15 },
        { name: 'Jab', arc: 70, range: 0.9, dmg: 0.5, knockback: 1.5, lunge: 0.15 },
        { name: 'Sweeping Kick', arc: 150, range: 0.95, dmg: 0.8, knockback: 3 },
        { name: 'Palm Strike', arc: 70, range: 1.7, dmg: 2.0, knockback: 11, shake: 0.15, hitStop: 0.05 },
        { name: 'Rising Uppercut', arc: 90, range: 0.95, dmg: 1.2, knockback: 1, stun: 0.9, pop: 0.6, popH: 1.2 },
      ],
      wave: { dmg: 1.0, speed: 10, range: 5, radius: 0.3, size: 1.4 },
      deflect: { arc: 150, range: 1.7, window: 0.35, ki: 4 },
      meditate: { after: 1.5, hp: 0.03, ki: 6 },
      kick: { cd: 5, cost: 20, dist: 4, speed: 16, dmg: 1.4, chains: 3, chainRange: 4, grow: 0.2, knockback: 6 },
      palms: { cd: 30, cost: 60, dur: 2.5, strikes: 12, range: 4, dmg: 0.7, ringR: 3, ringDmg: 3, heal: 0.15 },
      // spec boons
      iron_skin: { dur: 2, absorb: 0.18 },
      wind_step: { chains: 2, haste: 0.35, hasteT: 3 },
      dragon_wave: { cost: 40, dmg: 3.5, range: 7, w: 1.4, speed: 12, size: 2.6 },
      deflect_mastery: { n: 2, dmg: 0.8, speed: 9, homing: 6, range: 7 },
      // class boons as they apply to the Monk's fists (Splitting Bolts / Mana Surge read these)
      splitKi: { n: 2, arc: 50, dmg: 0.45, speed: 10, range: 4 },
      surgeKi: { cost: 30, dmg: 2.6, speed: 12, range: 8, radius: 0.4, size: 2.2 },
    },
    balance: { dmgMul: [[8, 0.62], [10, 0.62], [12, 0.62]] },
  },
};
