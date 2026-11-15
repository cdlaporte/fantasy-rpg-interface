// rogue class definition (see docs/CLASSES.md). Owned by the rogue class package.
// Shapes: progression reads id/name/blurb/color/base/basic/abilities/look (docs/notes/meta.md); companions read
// `companion` (docs/notes/sim.md section 10); the rogue kit (src/core/kits/rogue.js) reads `kit`.
// Every number the kit uses lives in `kit`. Coefficients are multiplied by the caster's power.
export default {
  rogue: {
    id: 'rogue', name: 'Rogue', color: '#58d68d',
    blurb: 'Fast, slippery, bursty. Stab to build combo pips, roll out of trouble, then cash the pips in on a finisher.',
    base: { hp: 34, hpPerLevel: 6.5, power: 4.5, powerPerLevel: 1.25, speed: 4.0, defense: 0 },
    basic: { name: 'Twin Daggers', icon: 'dagger', desc: 'Hold to slash twice, fast. Every hit adds a combo pip.' },
    abilities: [
      { slot: 'space', id: 'dodge_roll', name: 'Dodge Roll', icon: 'roll', unlock: 3, cd: 3,
        desc: 'Roll away, untouchable for a moment. Your next attack is a sure critical.' },
      { slot: 'q', id: 'fan_of_knives', name: 'Fan of Knives', icon: 'knives', unlock: 5, cd: 7,
        desc: 'Finisher: throw a fan of knives. Every combo pip adds two more knives.' },
    ],
    look: {
      outfit: { style: 'leather', primary: '#2f8f5b', secondary: '#22313a', accent: '#58d68d' },
      held: { style: 'daggers', color: '#cfd8dc', glow: null },
      hat: { style: 'bandana', color: '#1e5e3e' },
    },
    // Rank names for the HUD and the 'rank:up' banner (rank = progression.rank()).
    ranks: { 1: 'Twin Daggers', 2: 'Lunge' },
    kit: {
      // Balance knob: CLASSES coefficients x dmgScale = the balance-sheet DPS band (measured, docs/notes/kit-rogue.md).
      dmgScale: 0.21,
      colors: { main: '#58d68d', teal: '#2bb39a', shadow: '#2a2f3a', steel: '#e6f2ea', crit: '#b8ffcf', venom: '#7bdc3a' },
      combo: { max: 5, resetAfter: 6 },
      // Basic I: double slash (two arcs, one combo pip per attack that connects).
      daggers: { arc: 70, range: 0.95, coef: 0.55, hits: 2, interval: 0.24, critChance: 0.15, knockback: 1.2, chainGap: 0.7 },
      // Basic II (rank 2): every third attack of a chain lunges forward.
      lunge: { every: 3, dist: 0.6, coef: 1.2, arc: 60, range: 1.25, knockback: 4, interval: 0.3 },
      dodgeRoll: { cd: 3, dist: 3, speed: 15, invuln: 0.35, critWindow: 1.5 },
      fan: { cd: 7, base: 3, perPip: 2, coef: 0.7, spreadMin: 60, spreadPerPip: 60, speed: 13, range: 6, knockback: 1 },
      aura: { level: 10 },
    },
    companion: {
      npc: 'pip', name: 'Pip', mult: 0.7, brain: 'ally_melee',
      stats: { hp: 34, hpPerLevel: 6.5, power: 4.5, powerPerLevel: 1.25, speed: 4.0 },
      basic: { use: 'melee_arc', name: 'Twin Daggers', arc: 70, range: 0.95, dmg: 0.55, repeat: 2, critChance: 0.15, knockback: 1.2,
        cd: 0.32, windup: 0.08, style: 'dagger', color: '#58d68d' },
      ability: { use: 'dash', name: 'Dodge Roll', dist: 3, speed: 15, invuln: 0.35, dmg: 0.6, through: true, cd: 3, range: 3,
        minRange: 0.8, windup: 0.05, color: '#58d68d' },
      barks: {
        levelup: ['Ooh, shiny new level!', 'Do it again! Do it again!', 'You got faster. I saw it.'],
        shield: ['Knock knock, big guy!', 'Find the crack, then stab the crack!'],
        ultimate: ['Teach me that!', 'Okay, THAT was sneaky.', 'Wheee!'],
        down: ['Ow. Ow ow ow.', 'Just a scratch... a big scratch.'],
      },
    },
  },
};
