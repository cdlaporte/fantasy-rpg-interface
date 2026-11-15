// mage class definition (see docs/CLASSES.md "MAGE"). Owned by the mage class package.
// Shapes read by Meta (docs/notes/meta.md): id, name, blurb, color, base, basic, abilities, look.
// Everything under `kit` and `balance` is read by src/core/kits/mage.js (and the three specs).
// `companion` is read by the Sim companions system when the mage is a classmate (Elowen).
const VIOLET = '#9b6bff', CYAN = '#7fe7ff', MANA = '#4d8dff';

export default {
  mage: {
    id: 'mage', name: 'Mage', color: VIOLET, pickable: true,
    blurb: 'The glass cannon who controls space. Fragile, ranged, always on the move. Mana refills by itself.',
    base: { hp: 28, hpPerLevel: 5, power: 6, powerPerLevel: 1.6, speed: 3.3, defense: 0 },
    basic: { name: 'Arcane Bolt', icon: 'bolt', desc: 'Fire fast magic bolts. Hold an arrow key to keep firing.' },
    abilities: [
      { slot: 'space', id: 'blink', name: 'Blink', icon: 'blink', unlock: 3, desc: 'Teleport a few steps the way you are moving.' },
      { slot: 'q', id: 'arcane_nova', name: 'Arcane Nova', icon: 'nova', unlock: 5, desc: 'A blast of force that throws enemies away from you.' },
    ],
    look: {
      outfit: { style: 'robe', primary: '#7b4dd8', secondary: '#3fd0e0', accent: '#f4e3ff' },
      held: { style: 'staff', color: '#8b5a2b', glow: CYAN },
      hat: { style: 'wizard', color: '#5b35b0' },
    },
    aura: { style: 'sparkle', color: VIOLET },
    // Attack ranks shown by the HUD / rank-up banner (rank -> name, icon). Specs add III and IV.
    ranks: { 1: { name: 'Arcane Bolt', icon: 'bolt' }, 2: { name: 'Twin Bolts', icon: 'bolt' } },

    kit: {
      colors: { violet: VIOLET, cyan: CYAN, mana: MANA, frost: '#7fd6ff' },
      resource: { id: 'mana', name: 'Mana', max: 100, color: MANA, start: 100, regen: 9 },
      // Basic I / II
      bolt: { speed: 11, range: 7, dmg: 1.0, interval: 0.45, radius: 0.16, size: 1, knockback: 1.5 },
      twin: { dmg: 0.65, spacing: 0.32 },
      // Space / Q
      blink: { cd: 4, cost: 15, dist: 3.5, invuln: 0.2 },
      nova: { cd: 9, cost: 35, r: 2.8, dmg: 1.8, knockback: 9, shake: 0.18 },
      // Class boons
      splitting_bolts: { n: 2, arc: 70, dmgMul: 0.45, range: 3, size: 0.6 },
      blink_burst: { r: 2.0, dmgMul: 0.5 },
      frost_nova: { stun: 1.0, frostT: 2.5, frostP: 0.4, zoneR: 2.6, zoneDur: 3, zoneSlow: 0.4 },
      arcane_orbit: { n: 3, radius: 1.25, spin: 3.2, dmg: 0.45, hitCd: 0.6, touchR: 0.45, shotDmg: 1.0, shotRange: 5.5, shotSpeed: 9, regrow: 3 },
      double_blink: { charges: 2 },
      mana_surge: { cost: 30, dmg: 2.6, speed: 13, range: 9, radius: 0.4, size: 2.2 },
      gravity_well: { pullR: 4.5, pull: 9, delay: 0.35 },
      phase_shift: { dmg: 1.2, w: 0.9, markT: 4 },
    },

    // Balance: outgoing damage multiplier by level (linear between points), applied by the kit to the player's and
    // the familiars' hits. Keeps every coefficient exactly as in CLASSES.md while landing the measured mixed-fight
    // DPS inside the CLASSES band (docs/notes/kit-mage.md). Specs may override with their own `balance.dmgMul`.
    balance: { dmgMul: [[1, 0.5], [3, 0.5], [5, 0.62], [8, 0.7], [12, 0.7]] },

    // Classmate Elowen (Sim companions schema, docs/notes/sim.md section 10). 70% of the numbers.
    companion: {
      npc: 'elowen', name: 'Elowen', mult: 0.7, brain: 'ally_ranged', keepRange: 3.8,
      stats: { hp: 28, hpPerLevel: 5, power: 6, powerPerLevel: 1.6, speed: 3.3 },
      basic: { use: 'projectile', name: 'Arcane Bolt', model: 'bolt', speed: 11, range: 7, dmg: 1.0, cd: 0.65, windup: 0.12,
        type: 'magic', color: VIOLET, glow: CYAN, size: 1 },
      ability: { use: 'blink', name: 'Blink', away: true, dist: 3.5, cd: 4, range: 1.6, windup: 0.05, color: VIOLET },
      barks: {
        levelup: ['Adequate progress.', 'Statistically impressive.', 'I wrote that level down. For science.'],
        shield: ['The shield has a weakness. Probably.', 'Hit the glowy part. That is my whole theory.'],
        ultimate: ['I took notes on that.', 'Page forty-two, exactly like the book!', 'Show-off. Do it again.'],
        down: ['This is fine. I am fine.', 'Just... reading the floor.'],
      },
    },
  },
};
