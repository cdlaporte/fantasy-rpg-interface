// Mage specializations: Conjurer, Sorcerer, Monk (see docs/CLASSES.md). Owned by the mage class package.
// Shapes read by Meta (docs/notes/meta.md): id, from, name, blurb, color, mods, basic, abilities, look.
// `kit`, `ranks`, `balance` (and Monk's `resource`) are read by src/core/kits/{conjurer,sorcerer,monk}.js.
const TEAL = '#3fe0c5', EMBER = '#ff5a36', STORM = '#b48cff', GOLD = '#ffd23f', JADE = '#3fbf7f';
// round 4 (docs/MASTERY.md): tier-3 mastery colors
const EMERALD = '#3ddc84', ROSE = '#ff6ad5', VOLT = '#5cc8ff', FLAME = '#ff7b22', LOTUS = '#8ff0c8', SPIRIT = '#a77bff';

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
    ranks: { 3: { name: 'Spirit Bolt', icon: 'orb' }, 4: { name: 'Spirit Bolt: Soul Chase', icon: 'orb' },
      5: { name: 'Spirit Chain', icon: 'orb', desc: 'Spirit Bolts chain to two more enemies and mark them all.' } },
    kit: {
      color: TEAL, light: '#bff7ee',
      spiritBolt: { speed: 10, range: 7, dmg: 0.9, interval: 0.45, radius: 0.2, size: 1.1, markT: 4, markPower: 0.1 },
      markBonus: 0.5,                         // familiars deal +50% to marked targets
      spirit: { dmg: 1.5, speed: 8, range: 10, homing: 6, homingRange: 9, size: 1.2 },   // rank IV soul chase
      chain: { jumps: 2, range: 4.5, dmg: 0.5 },                                          // round 3, rank V Spirit Chain
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
      grand: { cd: 35, cost: 60, dur: 8, size: 1.8, stompEvery: 1.4, stompR: 3.25, range: 8, stompDmg: 2.5, hpMul: 2, petScale: 1.4,
        petHaste: 0.4, petPower: 0.3, speedMul: 1.0,
        look: { rig: 'golem', size: 1.8, colors: { body: '#2aa893', belly: '#bff7ee', accent: '#ffffff', eye: '#ffffff' },
          features: ['crystal', 'antlers', 'mossy'], hero: null } },
      // spec boons
      pack_leader: { max: 4, haste: 0.35, hasteT: 2.5 },
      soul_link: { mana: 2, burstR: 1.8, burstDmg: 1.2, heal: 0.08 },
      spirit_swap: { r: 2.2, dmgMul: 0.6, range: 12 },
      echo: { dmg: 0.35, speed: 10, range: 6, size: 0.6 },
      // round 3 spec boons
      wild_hunt: { icd: 4, ttl: 5, max: 2, powerMul: 0.5, hpMul: 0.3 },
      spirit_totem: { r: 3, dur: 6, healPct: 0.015, tick: 0.5 },
    },
    balance: { dmgMul: [[8, 0.66], [10, 0.72], [12, 0.48], [14, 0.52], [16, 0.58], [18, 0.6], [20, 0.676]] },
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
    ranks: { 3: { name: 'Overcharge', icon: 'fire' }, 4: { name: 'Overcharge: Forked Lance', icon: 'storm' },
      5: { name: 'Overcharge: Triple Lance', icon: 'storm', desc: 'A full charge fires three Arc Lances in a fan.' } },
    kit: {
      color: EMBER, storm: STORM, gold: '#ffb347',
      charge: { mid: 0.3, full: 1.0, speedMul: 0.7, quick: 1.3, recover: 0.12, emberGap: 0.22 },
      ember: { dmg: 0.6, speed: 13, range: 7, radius: 0.14, size: 0.8 },
      fireball: { cost: 10, dmg: 1.8, speed: 9, range: 7, radius: 0.24, size: 1.3, r: 1.5, burnT: 2, burn: 0.25,
        fireR: 1.2, fireDur: 3, fireDmg: 0.25 },
      fireballIV: { r: 1.7, fireR: 1.8, fireDur: 5 },
      lance: { cost: 25, dmg: 2.8, range: 8, w: 0.6, knockback: 3, shake: 0.22 },
      fork: { dmg: 1.0, range: 3.5 },
      triple: { spread: 14, sideMul: 0.6 },                                              // round 3, rank V Triple Lance
      meteor: { cd: 10, cost: 40, dist: 4, range: 9, delay: 0.9, r: 3.1, dmg: 4.5, knockback: 7, shake: 0.45,
        fireR: 2.5, fireDur: 4, fireDmg: 0.35 },
      cataclysm: { cd: 40, cost: 80, n: 5, every: 0.55, delay: 0.85, r: 3.0, dmg: 3.5, range: 9, densR: 3.0, shake: 0.6 },
      // spec boons
      wildfire: { r: 1.8, dmg: 1.0, burnT: 3, burn: 0.3, fireDur: 2 },
      storm_lance: { dur: 2, tick: 0.25, dmg: 0.3, w: 0.5 },
      meteor_echo: { n: 3, gap: 1.6, delay: 0.3, r: 1.5, dmg: 2.0 },
      quick_study: { rate: 1.3 },
      // round 3 spec boons
      living_bomb: { delay: 0.9, r: 1.6, dmg: 1.2 },
      phoenix: { icd: 90, heal: 0.4, r: 3, dmg: 2.0, burn: 0.3 },
    },
    balance: { dmgMul: [[8, 0.32], [10, 0.37], [12, 0.285], [14, 0.285], [16, 0.32], [18, 0.335], [20, 0.355]] },
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
    ranks: { 3: { name: 'Four-Beat Combo', icon: 'fist' }, 4: { name: 'Five-Beat Combo', icon: 'fist' },
      5: { name: 'Dragon Fist', icon: 'fist', desc: 'The final uppercut unleashes a ki dragon that snakes through enemies.' } },
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
      // round 3, rank V Dragon Fist: a big head wave + a tail of ki orbs that snake behind it
      dragon: { dmg: 1.4, speed: 9, range: 7, radius: 0.5, size: 2.4, tail: 4, tailDmg: 0.3, tailGap: 0.09, wiggle: 0.35 },
      deflect: { arc: 150, range: 1.7, window: 0.35, ki: 4 },
      meditate: { after: 1.5, hp: 0.03, ki: 6 },
      kick: { cd: 5, cost: 20, dist: 4, speed: 16, dmg: 1.4, chains: 3, chainRange: 4, grow: 0.2, knockback: 6 },
      palms: { cd: 30, cost: 60, dur: 2.5, strikes: 12, range: 5, dmg: 0.7, ringR: 3.75, ringDmg: 3, heal: 0.15 },
      // spec boons
      iron_skin: { dur: 2, absorb: 0.18 },
      wind_step: { chains: 2, haste: 0.35, hasteT: 3 },
      dragon_wave: { cost: 40, dmg: 3.5, range: 7, w: 1.4, speed: 12, size: 2.6 },
      deflect_mastery: { n: 2, dmg: 0.8, speed: 9, homing: 6, range: 7 },
      // class boons as they apply to the Monk's fists (Splitting Bolts / Mana Surge read these)
      splitKi: { n: 2, arc: 50, dmg: 0.45, speed: 10, range: 4 },
      surgeKi: { cost: 30, dmg: 2.6, speed: 12, range: 8, radius: 0.4, size: 2.2 },
      // round 3 spec boons
      palm_echo: { delay: 0.3, ahead: 1.4, rMul: 1.6, dmgMul: 0.6 },
      jade_lotus: { r: 3, dur: 5, healPct: 0.02, slow: 0.4, tick: 0.5 },
    },
    balance: { dmgMul: [[8, 0.33], [10, 0.37], [12, 0.33], [14, 0.33], [16, 0.277], [18, 0.306], [20, 0.317]] },
  },

  // ================================================================================================ round 4: masteries
  // Tier-3 masteries (docs/MASTERY.md), unlocked at level 15, layered over their subclass kit (src/core/kits/<id>.js).
  // `look` is a patch over the subclass look (the kit also applies it as a kit look patch); `mods` repeat the subclass
  // mods (a mastery keeps its subclass's body). `kit` holds the numbers; `balance.dmgMul` is a multiplier ON TOP of the
  // subclass's own `balance.dmgMul` (both apply), linear between levels.

  // ------------------------------------------------------------------------------------------------ SUMMONER (conjurer)
  summoner: {
    id: 'summoner', from: 'conjurer', tier: 3, name: 'Summoner', color: EMERALD,
    blurb: 'Why fight alone? Command five familiars, a reborn Phoenix and a Guardian Dragon.',
    mods: { hp: 1.1, power: 0.9, speed: 1 },
    look: {
      outfit: { style: 'robe', primary: '#1d7a4b', secondary: '#ffd36b', accent: EMERALD },
      hat: { style: 'crown', color: '#ffd36b' },
      cape: { color: '#2fbf71' },
      held: { style: 'orb', color: EMERALD, glow: '#ffd36b' },
      aura: { style: 'sparkle', color: EMERALD },
    },
    aura: { style: 'sparkle', color: EMERALD },
    passive: { name: 'Legion', desc: 'Up to five familiars, called two at a time, and a Phoenix that is reborn from its ashes.' },
    ultimate: { name: 'Guardian Dragon', icon: 'summon', desc: 'A giant dragon swoops in, breathes fire on the biggest crowds, then dives.' },
    kit: {
      color: EMERALD, gold: '#ffd36b', fire: '#ff7a1a',
      max: 5, perCast: 2,                                   // familiars: max, summoned per F press
      order: ['fox', 'owl', 'phoenix', 'stoneling', 'fox', 'owl'],
      phoenix: { name: 'Phoenix', powerMul: 0.6, hpMul: 0.35, speedMul: 1.3, radius: 0.3, flying: true, keepRange: 3,
        rebirth: 5, burstR: 1.8, burstDmg: 1.0,
        look: { rig: 'flyer', size: 0.75, colors: { body: '#ff7a1a', belly: '#ffd84a', accent: '#ff3d1f', eye: '#fff6c0' },
          features: ['wings_bird', 'glow'], hero: null },
        attack: { use: 'projectile', name: 'Phoenix Flame', model: 'fireball', speed: 10, range: 6, dmg: 0.7, radius: 0.18, cd: 0.9,
          windup: 0.1, type: 'magic', element: 'fire', color: '#ff7a1a', glow: '#ffd84a', size: 0.8 } },
      dragon: { cd: 38, cost: 60, dur: 10, hpMul: 3, speed: 7, hover: 1.2, dropFrom: 7, dropT: 0.6, range: 9,
        landR: 3.6, landDmg: 2.4, breathEvery: 1.0, breathR: 4.4, breathArc: 60, breathDmg: 1.5, burn: 0.3, burnT: 3,
        fireR: 1.4, fireDur: 3, fireDmg: 0.3, diveR: 3.4, diveDmg: 3.0, petScale: 1.35, petHaste: 0.4,
        look: { rig: 'flyer', size: 2.4, colors: { body: '#2fbf71', belly: '#ffd36b', accent: '#ffe9a8', eye: '#ffffff' },
          features: ['wings_bat', 'glow'], hero: null } },
    },
    balance: { dmgMul: [[15, 1.0], [16, 1.0], [18, 1.0], [20, 1.0]] },
  },

  // ------------------------------------------------------------------------------------------------ ILLUSIONIST (conjurer)
  illusionist: {
    id: 'illusionist', from: 'conjurer', tier: 3, name: 'Illusionist', color: ROSE,
    blurb: 'Which one is the real you? Every spell leaves a mirror image that fights, fools and pops.',
    mods: { hp: 1.1, power: 0.9, speed: 1 },
    look: {
      outfit: { style: 'robe', primary: '#7a2a8c', secondary: '#d8b4ff', accent: ROSE },
      hat: { style: 'feather', color: ROSE },
      cape: { color: '#d8b4ff' },
      held: { style: 'wand', color: '#ffffff', glow: ROSE },
      aura: { style: 'glow', color: ROSE },
    },
    aura: { style: 'glow', color: ROSE },
    passive: { name: 'Mirror Images', desc: 'Every spell leaves a mirror copy of you that taunts, copies your bolts and bursts.' },
    ultimate: { name: 'Hall of Mirrors', icon: 'star', desc: 'Six mirror copies surround you and all cast at once, then shatter.' },
    kit: {
      color: ROSE, light: '#ffd6f4', lavender: '#d8b4ff',
      image: { max: 3, ttl: 3.5, hpMul: 0.25, every: 6, boltDmg: 0.45, boltSpeed: 10, boltRange: 6.5, burstR: 1.6, burstDmg: 1.0,
        alpha: 0.7 },
      hall: { cd: 35, cost: 60, n: 6, r: 2.8, dur: 7, hpMul: 0.45, every: 0.55, boltDmg: 0.6, range: 8, beamEvery: 1.2,
        shatterR: 2.0, shatterDmg: 1.6 },
    },
    balance: { dmgMul: [[15, 1.0], [16, 1.0], [18, 1.0], [20, 1.0]] },
  },

  // ------------------------------------------------------------------------------------------------ STORMCALLER (sorcerer)
  stormcaller: {
    id: 'stormcaller', from: 'sorcerer', tier: 3, name: 'Stormcaller', color: VOLT,
    blurb: 'Lightning that jumps from enemy to enemy, and a storm that follows you around.',
    mods: { hp: 0.95, power: 1.15, speed: 1 },
    look: {
      outfit: { style: 'robe', primary: '#1c2a5a', secondary: '#eaf6ff', accent: VOLT },
      hat: { style: 'wizard', color: '#13204a' },
      cape: { color: '#2d5fc4' },
      held: { style: 'staff', color: '#2a3550', glow: VOLT },
      aura: { style: 'storm', color: VOLT },
    },
    aura: { style: 'storm', color: VOLT },
    passive: { name: 'Static', desc: 'Charged shots chain lightning between enemies. Five Static calls down a sky bolt volley.' },
    ultimate: { name: 'Thunderstorm', icon: 'storm', desc: 'A storm cloud follows you: lightning strikes every enemy around, over and over.' },
    kit: {
      color: VOLT, white: '#eaf6ff', navy: '#1c2a5a',
      chain: { jumps: 2, range: 4, dmg: 0.7, falloff: 0.85, fromLance: 3 },
      static: { max: 5, discharge: 5, range: 7, dmg: 1.3, r: 1.2, stun: 0.4 },
      storm: { cd: 40, cost: 80, dur: 6, every: 0.24, range: 7.5, r: 1.3, dmg: 0.85, stun: 0.15, chainDmg: 0.45, flashEvery: 4 },
    },
    balance: { dmgMul: [[15, 1.0], [16, 1.0], [18, 1.0], [20, 1.0]] },
  },

  // ------------------------------------------------------------------------------------------------ PYROMANCER (sorcerer)
  pyromancer: {
    id: 'pyromancer', from: 'sorcerer', tier: 3, name: 'Pyromancer', color: FLAME,
    blurb: 'Set one enemy on fire and watch it spread. Then make it rain fireballs.',
    mods: { hp: 0.95, power: 1.15, speed: 1 },
    look: {
      outfit: { style: 'robe', primary: '#8c0f12', secondary: '#ffd84a', accent: FLAME },
      hat: { style: 'horned', color: '#3a1010' },
      cape: { color: '#ff5a1f' },
      held: { style: 'staff', color: '#3a1d10', glow: FLAME },
      aura: { style: 'flame', color: FLAME },
    },
    aura: { style: 'flame', color: FLAME },
    passive: { name: 'Spreading Flames', desc: 'Every fire hit sets enemies burning, and burning spreads to the enemies next to them.' },
    ultimate: { name: 'Inferno', icon: 'fire', desc: 'A ring of fire springs up around you while fireballs rain down on everything inside.' },
    kit: {
      color: FLAME, yellow: '#ffd84a', crimson: '#c4161c',
      ignite: { burn: 0.35, t: 3 },                                     // burn dps = burn x power
      spread: { every: 0.45, range: 2.6, max: 3, scan: 10 },
      inferno: { cd: 40, cost: 80, ringR: 4.4, ringN: 14, ringZoneR: 0.95, ringDur: 6, ringDmg: 0.35, ringPush: 1.5,
        n: 16, every: 0.22, delay: 0.55, range: 6.5, r: 1.4, dmg: 1.2, fireR: 1.0, fireDur: 2.5, fireDmg: 0.25, shake: 0.25,
        blastR: 4.4, blastDmg: 1.5 },
    },
    balance: { dmgMul: [[15, 1.0], [16, 1.0], [18, 1.0], [20, 1.0]] },
  },

  // ------------------------------------------------------------------------------------------------ SAGE (monk)
  sage: {
    id: 'sage', from: 'monk', tier: 3, name: 'Sage', color: LOTUS,
    blurb: 'Calm as a lake. Stand your ground, heal your friends, and slow time itself.',
    mods: { hp: 1.3, power: 1, speed: 1.15 },
    look: {
      outfit: { style: 'gi', primary: '#f4f1e6', secondary: LOTUS, accent: '#ffe9a0' },
      hat: { style: 'circlet', color: '#ffe9a0' },
      cape: { color: '#bff7e2' },
      held: { style: 'fists', color: '#ffe9a0', glow: LOTUS },
      aura: { style: 'glow', color: LOTUS },
    },
    aura: { style: 'glow', color: LOTUS },
    passive: { name: 'Still Mind', desc: 'Ki fills fast while you stand still, and every Palm Strike heals your classmates.' },
    ultimate: { name: 'Enlightenment', icon: 'heart', desc: 'Float in a golden bubble of slow time. You and your friends heal a lot.' },
    kit: {
      color: LOTUS, gold: '#ffe9a0', white: '#ffffff',
      still: { ki: 16, hp: 0.006, after: 0.25 },                   // per second while not moving
      palmHeal: { r: 4.5, ally: 0.07, self: 0.02 },               // fractions of hpMax
      enlighten: { cd: 32, cost: 60, dur: 6, r: 5, heal: 0.35, tick: 0.25, slow: 0.75, projSlow: 0.3, regen: 0.012,
        pulseEvery: 1.0, pulseDmg: 0.9, attackSpeed: 0.4, ki: 50, lift: 0.45 },
    },
    balance: { dmgMul: [[15, 1.0], [16, 1.0], [18, 1.0], [20, 1.0]] },
  },

  // ------------------------------------------------------------------------------------------------ MYSTIC (monk)
  mystic: {
    id: 'mystic', from: 'monk', tier: 3, name: 'Mystic', color: SPIRIT,
    blurb: 'Your punches fly. Then a giant spirit version of you punches the ground.',
    mods: { hp: 1.3, power: 1, speed: 1.15 },
    look: {
      outfit: { style: 'gi', primary: '#3a2470', secondary: '#7fe7ff', accent: SPIRIT },
      hat: { style: 'bandana', color: SPIRIT },
      cape: { color: '#5b35b0' },
      held: { style: 'fists', color: '#d9c8ff', glow: SPIRIT },
      aura: { style: 'flame', color: SPIRIT },
    },
    aura: { style: 'flame', color: SPIRIT },
    passive: { name: 'Spirit Fists', desc: 'Palm Strikes launch three homing spirit fists; sweeping kicks launch one.' },
    ultimate: { name: 'Avatar', icon: 'fist', desc: 'Become a giant spirit. Its punches hit everything in front and shake the ground.' },
    kit: {
      color: SPIRIT, cyan: '#7fe7ff', white: '#ffffff',
      fists: { palm: 3, kick: 1, arc: 40, dmg: 0.6, speed: 11, range: 6, homing: 5, size: 1.3, radius: 0.22 },
      avatar: { cd: 30, cost: 60, dur: 8, scale: 2.3, alpha: 0.55, punchR: 2.8, punchArc: 90, punchDmg: 0.8, slamR: 3.8, slamDmg: 2.2,
        slamFists: 5, idle: 0.8, autoR: 3.5, shake: 0.5, armor: 0.3 },
    },
    balance: { dmgMul: [[15, 1.0], [16, 1.0], [18, 1.0], [20, 1.0]] },
  },
};
