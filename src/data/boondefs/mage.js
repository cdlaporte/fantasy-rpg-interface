// mage boons: class pool and spec pools (see docs/CLASSES.md). Owned by the mage class package.
// Shape read by Meta: data.boons[id] = { id, class | spec, name, desc, icon, tags }. Numbers live in
// data/classdefs/mage.js (`kit`) and data/specs/mage.js (`kit`), keyed by the boon id.
const c = (id, name, icon, desc, tags) => ({ id, class: 'mage', name, icon, desc, tags });
const s = (spec, id, name, icon, desc, tags) => ({ id, spec, name, icon, desc, tags });

export default {
  // Mage class pool (8)
  splitting_bolts: c('splitting_bolts', 'Splitting Bolts', 'bolt', 'Your shots burst into two mini-bolts when they hit.', ['basic']),
  blink_burst: c('blink_burst', 'Blink Burst', 'blink', 'Blink leaves a small Arcane Nova where you were.', ['blink', 'nova']),
  frost_nova: c('frost_nova', 'Frost Nova', 'frost', 'Arcane Nova freezes enemies solid and frosts the ground.', ['nova', 'frost']),
  arcane_orbit: c('arcane_orbit', 'Arcane Orbit', 'orb', 'Three orbs spin around you. Arcane Nova fires them outward.', ['orbit', 'nova']),
  double_blink: c('double_blink', 'Double Blink', 'blink', 'Blink twice in a row before it needs to recharge.', ['blink']),
  mana_surge: c('mana_surge', 'Mana Surge', 'bolt', 'At full Mana your next shot is a giant bolt that goes through everything.', ['basic']),
  gravity_well: c('gravity_well', 'Gravity Well', 'nova', 'Arcane Nova sucks enemies in, then blasts them away.', ['nova']),
  phase_shift: c('phase_shift', 'Phase Shift', 'blink', 'Blinking through enemies zaps and marks them.', ['blink']),

  // Conjurer (4)
  pack_leader: s('conjurer', 'pack_leader', 'Pack Leader', 'summon', 'A fourth familiar slot. Marking an enemy makes your pack faster.', ['familiar']),
  soul_link: s('conjurer', 'soul_link', 'Soul Link', 'heart', 'Familiar hits refill Mana. A fallen familiar bursts and heals you.', ['familiar']),
  spirit_swap: s('conjurer', 'spirit_swap', 'Spirit Swap', 'blink', 'Blink swaps you with your nearest familiar, and you both blast a Nova.', ['blink', 'familiar']),
  echo: s('conjurer', 'echo', 'Echo', 'orb', 'Every familiar copies your Spirit Bolt with a mini-bolt.', ['familiar', 'basic']),

  // Sorcerer (4)
  wildfire: s('sorcerer', 'wildfire', 'Wildfire', 'fire', 'Burning enemies explode when they drop, and the fire spreads.', ['fire']),
  storm_lance: s('sorcerer', 'storm_lance', 'Storm Lance', 'storm', 'Arc Lance leaves a crackling line of lightning for 2 seconds.', ['lance']),
  meteor_echo: s('sorcerer', 'meteor_echo', 'Meteor Echo', 'meteor', 'Three smaller meteors follow your Meteor in a line.', ['meteor']),
  quick_study: s('sorcerer', 'quick_study', 'Quick Study', 'book', 'Charge spells 30% faster, and charging no longer slows you down.', ['charge']),

  // Monk (4)
  iron_skin: s('monk', 'iron_skin', 'Iron Skin', 'shield', 'Palm Strike wraps you in a golden shield for 2 seconds.', ['palm']),
  wind_step: s('monk', 'wind_step', 'Wind Step', 'kick', 'Flying Kick bounces two more times and makes you faster.', ['kick']),
  dragon_wave: s('monk', 'dragon_wave', 'Dragon Wave', 'fist', 'At full Ki your next Palm Strike is a giant wave that goes through everything.', ['palm']),
  deflect_mastery: s('monk', 'deflect_mastery', 'Deflect Mastery', 'fist', 'Swatted shots split into two homing ki blasts.', ['deflect']),
};
