// warrior class definition (see docs/CLASSES.md). Owned by the warrior class package.
// Shapes: docs/notes/meta.md section 1 (picker + stats), docs/notes/sim.md section 10 (companion).
// Every number the warrior kit (src/core/kits/warrior.js) uses lives in `nums`; coefs are x power.
export default {
  warrior: {
    id: 'warrior', name: 'Warrior', color: '#e2503c', pickable: true,
    blurb: 'The wall and the hammer. Heavy swings, short reach, and everything you hit goes flying. Fighting fills your Rage.',
    base: { hp: 44, hpPerLevel: 9, power: 5, powerPerLevel: 1.3, speed: 3.4, defense: 0 },
    basic: { name: 'Sword Arc', icon: 'sword', desc: 'A wide, heavy sword swing that shoves enemies back.' },
    ranks: {
      1: { name: 'Sword Arc', icon: 'sword', desc: 'A wide, heavy sword swing that shoves enemies back.' },
      2: { name: 'Heavy Hand', icon: 'sword', desc: 'Every third swing is a huge 180-degree golden smash.' },
    },
    abilities: [
      { slot: 'space', id: 'shield_bash', name: 'Shield Bash', icon: 'dash', unlock: 3, cd: 5, cost: 0,
        desc: 'Charge forward and stun the first enemy you slam into. +15 Rage.' },
      { slot: 'q', id: 'war_cry', name: 'War Cry', icon: 'roar', unlock: 5, cd: 12, cost: 30,
        desc: 'ROAR! A shockwave slows enemies and you hit 30% harder for 5 s.' },
    ],
    look: {
      outfit: { style: 'tunic', primary: '#c0392b', secondary: '#aab4be', accent: '#f2c94c' },
      held: { style: 'sword', color: '#dfe6ee', glow: null },
    },
    colors: { rage: '#e2503c', gold: '#f2c94c', steel: '#e8eef5', ember: '#ff8a3c' },
    nums: {
      rage: { max: 100, perBasicHit: 6, perHitTaken: 10, decay: 5, decayAfter: 4 },
      // rank I
      sword_arc: { arc: 100, range: 1.2, dmg: 0.46, interval: 0.42, knockback: 6 },
      // rank II: every `every`-th swing is the heavy swing
      heavy_hand: { every: 3, arc: 180, range: 1.3, dmg: 0.58, knockback: 12, hitStop: 0.08, shake: 0.18 },
      shield_bash: { dist: 2.5, speed: 14, dmg: 0.7, stun: 0.8, knockback: 11, rage: 15, hitRadius: 0.55 },
      war_cry: { r: 3.45, dmg: 0.4, knockback: 8, slow: 0.4, slowDur: 3, power: 0.3, dur: 5 },
    },
    companion: {
      npc: 'bram', name: 'Bram', mult: 0.7, brain: 'ally_melee',
      stats: { hp: 44, hpPerLevel: 9, power: 5, powerPerLevel: 1.3, speed: 3.4 },
      basic: { use: 'melee_arc', name: 'Sword Arc', arc: 100, range: 1.2, dmg: 0.46, knockback: 5, cd: 0.6, windup: 0.1,
        style: 'sword', color: '#e8eef5' },
      ability: { use: 'dash', name: 'Shield Bash', dist: 2.5, speed: 14, dmg: 0.7, status: { stun: 0.8 }, knockback: 8,
        stopOnHit: true, cd: 5, range: 3, minRange: 1.3, windup: 0.15, color: '#e2503c' },
      barks: {
        levelup: ['WOO! Level up, buddy!', 'Look at you go!', 'Bigger muscles! Probably!'],
        shield: ['Smash that shield!', 'Hit it harder!'],
        ultimate: ["THAT'S what I'm talking about!", 'Do it again! DO IT AGAIN!'],
        down: ['Just... resting my eyes.', 'I meant to do that.'],
      },
    },
  },
};
