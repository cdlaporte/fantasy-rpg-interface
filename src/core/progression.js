// Meta package. progression (CONTRACTS 12, docs/CLASSES.md): xp and levels, attack rank, class and
// specialization, boons, stat derivation, the class / spec / look pickers, and the player-down flow (12a).
// Built-in defaults from the CLASSES balance sheet are used wherever data/classes.js, data/specs/*.js or
// data/boons.js do not provide a value (data wins field by field; classes, specs and boons merge per id).
// See docs/notes/meta.md for the API reference.
import { createRng } from './rng.js';
import { config as CONFIG } from '../config.js';

// ---------------------------------------------------------------------------------------------------------------
// defaults (docs/CLASSES.md)


export const DEFAULT_NOVICE = {
  id: 'novice', name: 'Novice', blurb: 'A traveler with a stick.',
  base: { hp: 20, hpPerLevel: 5, power: 2, powerPerLevel: 0, speed: 3.2, defense: 0 },
  basic: { name: 'Stick', icon: 'sword', desc: 'Whack things with a stick.' },
  abilities: [],
  look: null,
};

export const DEFAULT_CLASSES = {
  warrior: {
    id: 'warrior', name: 'Warrior', color: '#e2503c',
    blurb: 'The wall and the hammer. Heavy swings, short reach, and everything you hit moves. Builds Rage by fighting.',
    base: { hp: 44, hpPerLevel: 9, power: 5, powerPerLevel: 1.3, speed: 3.4, defense: 0 },
    basic: { name: 'Sword Arc', icon: 'sword', desc: 'A wide sword swing with strong knockback.' },
    abilities: [
      { slot: 'space', id: 'shield_bash', name: 'Shield Bash', icon: 'dash', unlock: 3, desc: 'Dash forward and stun the first enemy you hit.' },
      { slot: 'q', id: 'war_cry', name: 'War Cry', icon: 'roar', unlock: 5, desc: 'A shockwave that slows enemies and powers you up.' },
    ],
    look: {
      outfit: { style: 'tunic', primary: '#c0392b', secondary: '#aab4be', accent: '#f2c94c' },
      held: { style: 'sword', color: '#dfe6ee', glow: null },
    },
  },
  mage: {
    id: 'mage', name: 'Mage', color: '#9b6bff',
    blurb: 'The glass cannon who controls space. Fragile, ranged, always repositioning. Mana refills on its own.',
    base: { hp: 28, hpPerLevel: 5, power: 6, powerPerLevel: 1.6, speed: 3.3, defense: 0 },
    basic: { name: 'Arcane Bolt', icon: 'bolt', desc: 'A fast magic bolt.' },
    abilities: [
      { slot: 'space', id: 'blink', name: 'Blink', icon: 'blink', unlock: 3, desc: 'Teleport a short distance.' },
      { slot: 'q', id: 'arcane_nova', name: 'Arcane Nova', icon: 'nova', unlock: 5, desc: 'A ring of force that knocks enemies away.' },
    ],
    look: {
      outfit: { style: 'robe', primary: '#7b4dd8', secondary: '#3fd0e0', accent: '#f4e3ff' },
      held: { style: 'staff', color: '#8b5a2b', glow: '#7fe7ff' },
      hat: { style: 'wizard', color: '#5b35b0' },
    },
  },
  rogue: {
    id: 'rogue', name: 'Rogue', color: '#58d68d',
    blurb: 'Fast, slippery, bursty. In and out, building combo pips to spend on finishers.',
    base: { hp: 34, hpPerLevel: 6.5, power: 4.5, powerPerLevel: 1.25, speed: 4.0, defense: 0 },
    basic: { name: 'Twin Daggers', icon: 'dagger', desc: 'A quick double slash.' },
    abilities: [
      { slot: 'space', id: 'dodge_roll', name: 'Dodge Roll', icon: 'roll', unlock: 3, desc: 'Roll away; your next hit is a critical.' },
      { slot: 'q', id: 'fan_of_knives', name: 'Fan of Knives', icon: 'knives', unlock: 5, desc: 'Throw a fan of knives; more combo, more knives.' },
    ],
    look: {
      outfit: { style: 'leather', primary: '#2f8f5b', secondary: '#22313a', accent: '#58d68d' },
      held: { style: 'daggers', color: '#cfd8dc', glow: null },
      hat: { style: 'bandana', color: '#1e5e3e' },
    },
  },
};

const spec = (id, from, name, color, blurb, mods, basic, f, shift, look) => ({
  id, from, name, color, blurb, mods,
  basic: { name: basic[0], icon: basic[1], desc: basic[2] },
  abilities: [
    { slot: 'f', id: f[0], name: f[1], icon: f[2], unlock: 8, desc: f[3] },
    { slot: 'shift', id: shift[0], name: shift[1], icon: shift[2], unlock: 11, desc: shift[3] },
  ],
  look,
});

export const DEFAULT_SPECS = {
  knight: spec('knight', 'warrior', 'Knight', '#f2c94c', 'Timing and protection. Raise your shield at the right moment.',
    { hp: 1.25, power: 1, speed: 0.95 },
    ["Knight's Cleave", 'sword', 'A wide cleave with a free shield punch.'],
    ['shield_wall', 'Shield Wall', 'shield', 'Hold to block; a well-timed block is a Perfect Block.'],
    ['aegis', 'Aegis of Flinkerton', 'shield', 'A golden dome that protects you and your classmates.'],
    { outfit: { style: 'plate', primary: '#c9ced6', secondary: '#f2c94c', accent: '#ffffff' },
      held: { style: 'sword_shield', color: '#f2c94c', glow: null }, hat: { style: 'helm', color: '#c9ced6' } }),
  berserker: spec('berserker', 'warrior', 'Berserker', '#d7263d', 'Risk and momentum. The lower your health, the faster you swing.',
    { hp: 1.1, power: 1, speed: 1.08 },
    ['Twin Axes', 'axe', 'Fast alternating axe chops.'],
    ['whirlwind', 'Whirlwind', 'axe', 'Hold to spin through everything around you.'],
    ['skyfall_leap', 'Skyfall Leap', 'up', 'Leap high and crash down with a shockwave.'],
    { outfit: { style: 'vest', primary: '#d7263d', secondary: '#f1e9da', accent: '#5a3a22' },
      held: { style: 'axes', color: '#f1e9da', glow: null }, hat: { style: 'horned', color: '#f1e9da' } }),
  battlemage: spec('battlemage', 'warrior', 'Battlemage', '#ff7a2f', 'Stance and combos. Your blade carries fire, frost or storm.',
    { hp: 1, power: 1.05, speed: 1 },
    ['Rune Slash', 'sword', 'Slashes that release elemental waves.'],
    ['rune_shift', 'Rune Shift', 'rune', 'Cycle the element of your blade with a nova.'],
    ['runestorm', 'Runestorm', 'storm', 'Plant your blade: fire, frost, then lightning.'],
    { outfit: { style: 'robe', primary: '#4a4f6a', secondary: '#aab4be', accent: '#ff7a2f' },
      held: { style: 'runeblade', color: '#dfe6ee', glow: '#ff7a2f' } }),
  conjurer: spec('conjurer', 'mage', 'Conjurer', '#3fe0c5', 'The one-student army. Spirit familiars fight beside you.',
    { hp: 1.1, power: 0.9, speed: 1 },
    ['Spirit Bolt', 'orb', 'A bolt that marks targets for your familiars.'],
    ['summon_familiar', 'Summon Familiar', 'summon', 'Summon a fox, an owl or a stoneling.'],
    ['grand_conjuration', 'Grand Conjuration', 'summon', 'A giant spirit guardian stomps the battlefield.'],
    { outfit: { style: 'robe', primary: '#1f9e8a', secondary: '#bff7ee', accent: '#3fe0c5' },
      held: { style: 'orb', color: '#3fe0c5', glow: '#3fe0c5' }, hat: { style: 'circlet', color: '#3fe0c5' } }),
  sorcerer: spec('sorcerer', 'mage', 'Sorcerer', '#ff5a36', 'Charge-up artillery. Hold the attack key for bigger spells.',
    { hp: 0.95, power: 1.15, speed: 1 },
    ['Overcharge', 'fire', 'Tap for embers, hold for a fireball, hold longer for a lance.'],
    ['meteor', 'Meteor', 'meteor', 'Call a meteor down ahead of you.'],
    ['cataclysm', 'Cataclysm', 'meteor', 'Five meteors rain on the densest enemies.'],
    { outfit: { style: 'robe', primary: '#a3172f', secondary: '#f2c94c', accent: '#ff5a36' },
      held: { style: 'staff', color: '#5a3a22', glow: '#ff5a36' }, hat: { style: 'wizard', color: '#7a0f22' } }),
  monk: spec('monk', 'mage', 'Monk', '#ffd23f', 'The mage who punches. Four-beat combos and deflected projectiles.',
    { hp: 1.3, power: 1, speed: 1.15 },
    ['Four-Beat Combo', 'fist', 'Jab, jab, kick, Palm Strike.'],
    ['flying_kick', 'Flying Kick', 'kick', 'Dash-kick that chains between enemies.'],
    ['thousand_palms', 'Thousand Palms', 'fist', 'Become a blur of strikes.'],
    { outfit: { style: 'gi', primary: '#f4a300', secondary: '#2e8b57', accent: '#ffd23f' },
      held: { style: 'fists', color: '#ffd23f', glow: '#ffd23f' }, hat: { style: 'bandana', color: '#2e8b57' } }),
  archer: spec('archer', 'rogue', 'Archer', '#3fa34d', 'Spacing and the perfect shot. Farther away hits harder.',
    { hp: 1, power: 1.1, speed: 1 },
    ['Longbow', 'bow', 'Tap for quick arrows, hold for a Power Shot.'],
    ['arrow_rain', 'Arrow Rain', 'rain', 'Arrows rain down on an area ahead.'],
    ['starfall_arrow', 'Starfall Arrow', 'star', 'A giant glowing arrow crosses the whole view.'],
    { outfit: { style: 'leather', primary: '#3fa34d', secondary: '#6b4f2a', accent: '#f2c94c' },
      held: { style: 'bow', color: '#8b5a2b', glow: null }, hat: { style: 'feather', color: '#3fa34d' } }),
  thief: spec('thief', 'rogue', 'Thief', '#2a9d8f', 'Stealth and treasure. Backstabs, smoke and shiny coins.',
    { hp: 1, power: 1, speed: 1.1 },
    ['Cutpurse Daggers', 'dagger', 'Daggers that shake gold out of enemies.'],
    ['smoke_vanish', 'Smoke Vanish', 'smoke', 'Vanish in smoke and strike from stealth.'],
    ['grand_heist', 'Grand Heist', 'coin', 'Zigzag through enemies in a fountain of coins.'],
    { outfit: { style: 'cloak', primary: '#2a9d8f', secondary: '#1d3c45', accent: '#f2c94c' }, hood: true,
      held: { style: 'daggers', color: '#cfd8dc', glow: null } }),
  ninja: spec('ninja', 'rogue', 'Ninja', '#3d348b', 'Mobility and misdirection. Shuriken, decoys and clones.',
    { hp: 1, power: 1, speed: 1.12 },
    ['Shuriken', 'shuriken', 'Returning shuriken in a spread.'],
    ['shadow_step', 'Shadow Step', 'shadow', 'Appear behind an enemy and leave a decoy.'],
    ['shadow_clones', 'Shadow Clones', 'shadow', 'Shadow clones fight beside you.'],
    { outfit: { style: 'gi', primary: '#3d348b', secondary: '#1b1640', accent: '#e63946' },
      held: { style: 'shuriken', color: '#cfd8dc', glow: null }, hat: { style: 'bandana', color: '#e63946' } }),
};

const b = (owner, key, id, name, icon, desc) => ({ id, [key]: owner, name, icon, desc });
const cls = (c, list) => list.map((x) => b(c, 'class', ...x));
const spc = (s, list) => list.map((x) => b(s, 'spec', ...x));

/** Used only while data/boons.js is empty. */
export const DEFAULT_BOONS = [
  ...cls('warrior', [
    ['blazing_bash', 'Blazing Bash', 'fire', 'Shield Bash leaves a trail of fire.'],
    ['aftershock', 'Aftershock', 'roar', 'War Cry fires a second, larger shockwave.'],
    ['cleaving_wind', 'Cleaving Wind', 'sword', 'Every fourth swing throws a crescent of wind.'],
    ['unstoppable', 'Unstoppable', 'shield', 'Above 50 Rage you cannot be knocked back or slowed.'],
    ['ricochet_bash', 'Ricochet Bash', 'dash', 'A Shield Bash that hits chains into a second enemy.'],
    ['battle_hymn', 'Battle Hymn', 'heart', 'War Cry heals and hastes you and your classmates.'],
    ['rage_spikes', 'Rage Spikes', 'star', 'Getting hit releases a ring of spikes.'],
    ['second_wind', 'Second Wind', 'heart', 'Once a minute, dropping low heals you and knocks everything back.'],
  ]),
  ...cls('mage', [
    ['splitting_bolts', 'Splitting Bolts', 'bolt', 'Bolts split in two on impact.'],
    ['blink_burst', 'Blink Burst', 'blink', 'Blink leaves a small Nova behind.'],
    ['frost_nova', 'Frost Nova', 'frost', 'Nova freezes enemies and leaves frost on the ground.'],
    ['arcane_orbit', 'Arcane Orbit', 'orb', 'Three orbs circle you; Nova fires them outward.'],
    ['double_blink', 'Double Blink', 'blink', 'Blink has two charges.'],
    ['mana_surge', 'Mana Surge', 'bolt', 'At full Mana your next bolt is giant and pierces.'],
    ['gravity_well', 'Gravity Well', 'nova', 'Nova pulls enemies in before blasting them out.'],
    ['phase_shift', 'Phase Shift', 'blink', 'Blinking through an enemy damages and marks it.'],
  ]),
  ...cls('rogue', [
    ['ricochet_knives', 'Ricochet Knives', 'knives', 'Knives bounce to another enemy.'],
    ['shadow_roll', 'Shadow Roll', 'roll', 'Dodge Roll leaves smoke that hides you.'],
    ['venom_edge', 'Venom Edge', 'dagger', 'Hits stack venom that bursts at five stacks.'],
    ['roll_strike', 'Roll Strike', 'roll', 'Rolling through enemies slashes them.'],
    ['blade_flurry', 'Blade Flurry', 'dagger', 'At five pips your attacks hit all around you.'],
    ['quick_hands', 'Quick Hands', 'knives', 'Fan of Knives refunds a pip per defeat.'],
    ['lucky_streak', 'Lucky Streak', 'star', 'Critical hits reset Dodge Roll.'],
    ['boomerang_blade', 'Boomerang Blade', 'dagger', 'Every fifth attack throws a returning dagger.'],
  ]),
  ...spc('knight', [
    ['mirror_shield', 'Mirror Shield', 'shield', 'A Perfect Block fires a beam back at the attacker.'],
    ['phalanx', 'Phalanx', 'shield', 'While Shield Wall is up, classmates are shielded too.'],
    ['earthsplitter', 'Earthsplitter', 'roar', 'Shield Slam travels along the ground as a wave.'],
    ['oathkeeper', 'Oathkeeper', 'shield', 'Aegis lasts longer and heals everyone inside.'],
  ]),
  ...spc('berserker', [
    ['cyclone', 'Cyclone', 'axe', 'Whirlwind pulls enemies in and grows as it spins.'],
    ['axe_storm', 'Axe Storm', 'axe', 'Thrown axes bounce between three enemies.'],
    ['meteor_heart', 'Meteor Heart', 'meteor', 'Skyfall Leap leaves a burning crater.'],
    ['undying', 'Undying', 'heart', 'During Frenzy your health cannot drop below 1.'],
  ]),
  ...spc('battlemage', [
    ['elemental_overlap', 'Elemental Overlap', 'storm', 'Hitting a different element detonates it.'],
    ['twin_runes', 'Twin Runes', 'rune', 'Waves fire in pairs: current and previous element.'],
    ['rune_trail', 'Rune Trail', 'fire', 'Shield Bash leaves a trail of your element.'],
    ['encore', 'Encore', 'storm', 'Runestorm adds a fourth, random pulse.'],
  ]),
  ...spc('conjurer', [
    ['pack_leader', 'Pack Leader', 'summon', 'A fourth familiar; marking hastes the pack.'],
    ['soul_link', 'Soul Link', 'heart', 'Familiar hits restore Mana; fading familiars heal you.'],
    ['spirit_swap', 'Spirit Swap', 'blink', 'Blink swaps places with your nearest familiar.'],
    ['echo', 'Echo', 'orb', 'Each familiar echoes your bolt with a mini-bolt.'],
  ]),
  ...spc('sorcerer', [
    ['wildfire', 'Wildfire', 'fire', 'Burning enemies explode when defeated.'],
    ['storm_lance', 'Storm Lance', 'storm', 'Arc Lance leaves a crackling line behind.'],
    ['meteor_echo', 'Meteor Echo', 'meteor', 'Three smaller meteors follow in a line.'],
    ['quick_study', 'Quick Study', 'book', 'Charge 30% faster without slowing down.'],
  ]),
  ...spc('monk', [
    ['iron_skin', 'Iron Skin', 'shield', 'Palm Strike grants a short shield.'],
    ['wind_step', 'Wind Step', 'kick', 'Flying Kick chains two more times and hastes you.'],
    ['dragon_wave', 'Dragon Wave', 'fist', 'At full Ki your Palm Strike becomes a giant wave.'],
    ['deflect_mastery', 'Deflect Mastery', 'fist', 'Deflected projectiles split into homing ki blasts.'],
  ]),
  ...spc('archer', [
    ['split_arrow', 'Split Arrow', 'bow', 'Power Shot splits in three after its first hit.'],
    ['pinning_shot', 'Pinning Shot', 'bow', 'A full draw roots the target.'],
    ['rain_of_fire', 'Rain of Fire', 'rain', 'Arrow Rain sets the ground on fire.'],
    ['hawk', 'Hawk', 'star', 'A hawk dives on your last target every few seconds.'],
  ]),
  ...spc('thief', [
    ['coin_toss', 'Coin Toss', 'coin', 'Picking up gold may fling a coin at an enemy.'],
    ['vanishing_act', 'Vanishing Act', 'smoke', 'A defeat from stealth resets Smoke Vanish.'],
    ['loaded_dice', 'Loaded Dice', 'coin', 'Backstabs hit even harder and may drop items.'],
    ['caltrop_trail', 'Caltrop Trail', 'roll', 'Dodge Roll scatters caltrops.'],
  ]),
  ...spc('ninja', [
    ['explosive_tags', 'Explosive Tags', 'bomb', 'Your decoy explodes bigger and burns.'],
    ['blade_storm', 'Blade Storm', 'shuriken', 'Returning shuriken orbit you before you catch them.'],
    ['substitution', 'Substitution', 'shadow', 'Every 12 seconds the next hit is dodged with a poof.'],
    ['clone_mastery', 'Clone Mastery', 'shadow', 'Clones also copy Shadow Step.'],
  ]),
];

/** Attack rank thresholds (rank I..V). */
export const RANK_LEVELS = [1, 4, 8, 12, 16];
export const BOON_LEVELS = [4, 6, 8, 10, 12, 14, 16, 18, 20];   // round 3: cap 20 (docs/notes/r3a.md)
export const SPEC_LEVEL = 8;
export const AURA_LEVEL = 10;
/** round 3: from this level the class aura is "empowered" (brighter, `tier: 2`, the weapon glows in the aura color). */
export const EMPOWER_LEVEL = 14;
/** Fallback cap when no config is given (config.levelCap wins). */
export const LEVEL_CAP = 20;
/**
 * round 3: levels 11+ cost more. The biomes scale their enemies to the player, so kill xp (5 + 3L, x1.3) grows with the
 * player; with the plain curve one biome alone would give ~5 levels. xpNext(l) = base l^exp x (mul + perLevel (l - from))
 * for l >= from; levels 1-10 (the tutorial and the forest, tuned in round 2) are unchanged. See docs/notes/r3a.md.
 */
export const XP_LATE = Object.freeze({ from: 11, mul: 2, perLevel: 0.3 });
/**
 * round 3: enemy hits grow 2 + 1.5L while class hp grows a fixed amount per level, so without help a level-18 hero
 * survives ~15% fewer hits than a level-8 one. From level 13 the hero gains +0.3 defense per level (defense divides
 * damage by 1 + def / 10): hits-to-down at 18 match level 8 again (docs/notes/r3a.md).
 */
export const LATE_TOUGHNESS = Object.freeze({ from: 12, defensePerLevel: 0.3 });
export const AURA_STYLES = { warrior: 'flame', mage: 'sparkle', rogue: 'shadow' };

// ---------------------------------------------------------------------------------------------------------------
// helpers

/** XP needed to go from level l to l + 1 (CONTRACTS 12). */
export function xpNext(l) {
  const c = CONFIG.xpCurve || { base: 20, exp: 1.6 };
  const late = c.late || XP_LATE;
  const L = Math.max(1, l);
  const m = late && L >= late.from ? late.mul + late.perLevel * (L - late.from) : 1;
  return Math.round(c.base * Math.pow(L, c.exp) * m);
}

/** round 3: the empowered aura (level >= EMPOWER_LEVEL): a brighter color (mixed toward white) and `tier: 2`. */
export function brighten(hex, f) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v) => Math.round(v + (255 - v) * f).toString(16).padStart(2, '0');
  return '#' + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
}

/** Attack rank 1..5 for a level. */
export function rankAt(level) {
  let r = 0;
  for (let i = 0; i < RANK_LEVELS.length; i++) if (level >= RANK_LEVELS[i]) r = i + 1;
  return Math.max(1, r);
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Field-by-field merge: `over` wins; plain objects merge one level deeper. */
function mergeDef(base, over) {
  if (!over) return base ? Object.assign({}, base) : null;
  if (!base) return Object.assign({}, over);
  const out = Object.assign({}, base);
  for (const k in over) {
    const v = over[k];
    if (v === undefined) continue;
    out[k] = isObj(v) && isObj(base[k]) ? Object.assign({}, base[k], v) : v;
  }
  return out;
}

/** Apply a look patch in place: nested objects (outfit, hair, ...) merge, everything else replaces. */
export function applyLookPatch(look, patch) {
  if (!patch) return look;
  for (const k in patch) {
    const v = patch[k];
    if (isObj(v) && isObj(look[k])) look[k] = Object.assign({}, look[k], clone(v));
    else look[k] = clone(v);
  }
  return look;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function normAbilities(x) {
  if (!x) return [];
  const list = Array.isArray(x) ? x : Object.keys(x).filter((slot) => x[slot]).map((slot) => Object.assign({ slot }, x[slot]));
  return list.filter(Boolean).map((a) => ({
    slot: a.slot, id: a.id || a.slot, name: a.name || a.id || '', icon: a.icon || 'star',
    unlock: typeof a.unlock === 'number' ? a.unlock : 1, desc: a.desc || '',
  }));
}

function compare(a, op, b) {
  switch (op) {
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '<': return a < b;
    case '==': case '=': case '===': return a === b;
    case '!=': case '!==': return a !== b;
    default: return false;
  }
}

/** ['x', op, n] or ['x', n] (meaning >=). */
export function compareCond(value, c) {
  if (c.length >= 3) return compare(value, c[1], Number(c[2]));
  if (c.length === 2) return value >= Number(c[1]);
  return !!value;
}

let EMPOWER_T = 0;
const EMPOWER_FX = { type: 'sparkle', x: 0, y: 0, z: 0.6, n: 5, r: 0.75, color: '#ffffff' };

const NEGATIVE_STATUS = ['stun', 'slow', 'burn', 'frost', 'root', 'mark', 'venom'];
const REVIVE_COOLDOWN = 300;    // seconds between optional revive questions
const WAKE_INVULN = 2.5;

// ---------------------------------------------------------------------------------------------------------------

export default {
  id: 'progression',
  init(game) {
    const warned = new Set();
    const warn = (key, msg) => {
      if (warned.has(key)) return;
      warned.add(key);
      if (typeof console !== 'undefined') console.warn('[progression] ' + msg);
    };
    const data = () => game.data || {};
    const cap = () => (game.config && game.config.levelCap) || LEVEL_CAP;
    const kits = () => game.sys.kits || null;
    const gates = () => game.sys.gates || null;
    const emit = (e, p) => game.bus.emit(e, p);
    const sfx = (id) => emit('sfx', { id });

    // picker in progress: {type, resolve, chosen}
    let picker = null;
    let boonAsking = false;
    let className = '', specName = '';
    let lastReviveAsk = -Infinity;

    // ---------- definitions ----------
    function classDef(id) {
      if (!id || id === 'novice') return mergeDef(DEFAULT_NOVICE, (data().classes || {}).novice);
      const d = (data().classes || {})[id];
      const def = DEFAULT_CLASSES[id];
      if (!d && !def) return null;
      const out = mergeDef(def, d);
      out.base = Object.assign({}, DEFAULT_NOVICE.base, def && def.base, d && d.base);
      out.id = id;
      return out;
    }
    function specDef(id) {
      if (!id) return null;
      const d = (data().specs || {})[id];
      const def = DEFAULT_SPECS[id];
      if (!d && !def) return null;
      const out = mergeDef(def, d);
      out.mods = Object.assign({ hp: 1, power: 1, speed: 1, defense: 1 }, def && def.mods, d && d.mods);
      out.id = id;
      return out;
    }
    // Data merges over the built-in pools PER ID: a partial data set (one class filled, a handful of boons) adds to
    // or overrides the defaults; it never hides the entries it does not mention.
    const unionIds = (defaults, dataObj) => {
      const out = Object.keys(defaults);
      for (const k of Object.keys(dataObj || {})) if (!(k in defaults)) out.push(k);
      return out;
    };
    function classIds() {
      return unionIds(DEFAULT_CLASSES, data().classes).filter((k) => k !== 'novice' && (classDef(k) || {}).pickable !== false);
    }
    function specIds(classId) {
      return unionIds(DEFAULT_SPECS, data().specs).filter((id) => { const s = specDef(id); return s && (!classId || s.from === classId); });
    }
    function boonDefs() {
      const db = data().boons || {};
      const byId = new Map();
      for (const d of DEFAULT_BOONS) byId.set(d.id, d);
      for (const k of Object.keys(db)) byId.set(k, Object.assign({}, byId.get(k), { id: k }, db[k]));
      return Array.from(byId.values()).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }
    function boonDef(id) { return boonDefs().find((b) => b.id === id) || null; }

    /** Abilities for a class/spec: the active kit when it lists any, else data, else the CLASSES defaults. */
    function abilityList(classId = api.classId, specId = api.specId, useKit = true) {
      const k = kits();
      if (useKit && k && k.active && game.player && classId === api.classId && specId === api.specId) {
        const kit = k.active(game.player);
        const list = normAbilities(kit && kit.abilities);
        if (list.length) return list;
      }
      const c = classId ? classDef(classId) : null;
      const s = specId ? specDef(specId) : null;
      let list = normAbilities(c && c.abilities).concat(normAbilities(s && s.abilities));
      if (!list.length && k && k.registry) {
        const reg = k.registry;
        list = normAbilities(reg[classId] && reg[classId].abilities).concat(normAbilities(reg[specId] && reg[specId].abilities));
      }
      return list;
    }

    function basicInfo(def) {
      const bsc = def && def.basic;
      if (bsc && bsc.name) return { name: bsc.name, icon: bsc.icon || 'sword', desc: bsc.desc || '' };
      return { name: (def && def.name) || '', icon: 'sword', desc: '' };
    }

    // ---------- looks ----------
    function baseLook() {
      const looks = (data().looks && data().looks.PLAYER_LOOKS) || [{ rig: 'humanoid' }];
      const i = Math.max(0, Math.min(looks.length - 1, game.flags.look_choice | 0));
      return clone(looks[i]);
    }
    /** Preview look for pickers: base look + class patch (+ spec patch). */
    function previewLook(classId, specId) {
      const look = baseLook();
      const c = classDef(classId);
      if (c && c.look) applyLookPatch(look, c.look);
      const s = specId ? specDef(specId) : null;
      if (s && s.look) applyLookPatch(look, s.look);
      return look;
    }
    /** Sim's refreshLook (COMMON 12) when present; otherwise a local composition with the same order. */
    function refreshLook() {
      const pl = game.sys.player;
      if (pl && typeof pl.refreshLook === 'function') { pl.refreshLook(); return; }
      const p = game.player;
      if (!p) return;
      const look = baseLook();
      const looks = data().looks || {};
      if (!game.flags.look_chosen && looks.CLOAKED) applyLookPatch(look, looks.CLOAKED);
      else {
        const c = api.classId ? classDef(api.classId) : null;
        if (c && c.look) applyLookPatch(look, c.look);
        const s = api.specId ? specDef(api.specId) : null;
        if (s && s.look) applyLookPatch(look, s.look);
        if (p.data.kit && p.data.kit.lookPatch) applyLookPatch(look, p.data.kit.lookPatch);
        const inv = game.sys.inventory;
        if (inv && inv.equippedLookPatch) applyLookPatch(look, inv.equippedLookPatch());
        if (api.level >= AURA_LEVEL && api.classId) {
          look.aura = { style: AURA_STYLES[api.classId] || 'glow', color: (s && s.color) || (c && c.color) || '#ffd24a' };
        }
        const kp = p.data.kit && p.data.kit.lookPatch;
        if (kp && kp.aura) look.aura = clone(kp.aura);
      }
      if (!api.classId && game.flags.has_stick) look.held = { style: 'stick', color: '#8b5a2b', glow: null };
      p.look = look;
      p.lookRev = (p.lookRev || 0) + 1;
      emit('look:changed', { ent: p });
    }

    // ---------- stats ----------
    function recalc() {
      const p = game.player;
      if (!p) return null;
      const c = api.classId ? classDef(api.classId) : classDef('novice');
      const b = (c && c.base) || DEFAULT_NOVICE.base;
      const L = api.level;
      let hp = (b.hp || 0) + (b.hpPerLevel || 0) * L;
      let power = (b.power || 0) + (b.powerPerLevel || 0) * L;
      let speed = b.speed || DEFAULT_NOVICE.base.speed;
      let defense = (b.defense || 0) + (b.defensePerLevel || 0) * L;
      const s = api.specId ? specDef(api.specId) : null;
      if (s) { hp *= s.mods.hp; power *= s.mods.power; speed *= s.mods.speed; defense *= s.mods.defense; }
      if (api.classId && L > LATE_TOUGHNESS.from) defense += LATE_TOUGHNESS.defensePerLevel * (L - LATE_TOUGHNESS.from);
      const mods = p.data && p.data.statMods;
      if (mods) {
        for (const k in mods) {
          const m = mods[k];
          if (!m) continue;
          if (m.hp) hp *= m.hp;
          if (m.power) power *= m.power;
          if (m.speed) speed *= m.speed;
          if (m.defense) defense *= m.defense;
        }
      }
      // Number scale: the class tables stay in readable base numbers; health and power (hence all damage) scale here.
      const ns = game.config.numberScale || 1;
      power *= ns;
      const hpMax = Math.max(1, Math.round(hp * ns));
      if (!p.stats) p.stats = {};
      p.stats.power = Math.round(power * 100) / 100;
      speed *= game.config.playerSpeedMul || 1;
      p.stats.speed = Math.round(speed * 100) / 100;
      p.stats.defense = Math.round(defense * 100) / 100;
      const old = p.hpMax || 0;
      p.hpMax = hpMax;
      if (hpMax > old && p.hp > 0) p.hp += hpMax - old;
      if (p.hp > hpMax) p.hp = hpMax;
      if (!p.data) p.data = {};
      p.data.baseStats = { hp: hpMax, power: p.stats.power, speed: p.stats.speed, defense: p.stats.defense };
      return p.stats;
    }

    // ---------- fx helpers ----------
    function celebrate(color) {
      const p = game.player;
      if (!p) return;
      game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.2, color, dur: 1.2 });
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 24, r: 1.5, color });
      game.fx({ type: 'levelup', x: p.x, y: p.y });
      sfx('levelup');
    }

    function emitUnlocks(before) {
      const lvl = api.level;
      const list = abilityList();
      for (const a of list) {
        if (a.unlock > lvl) continue;
        if (before && before.has(a.slot + ':' + a.id)) continue;
        emit('ability:unlocked', { slot: a.slot, id: a.id, name: a.name, icon: a.icon, unlockLevel: a.unlock, desc: a.desc });
      }
    }
    function unlockedSet() {
      const s = new Set();
      for (const a of abilityList()) if (a.unlock <= api.level) s.add(a.slot + ':' + a.id);
      return s;
    }

    function markSpecReady(quiet) {
      if (!api.classId || api.specId || api.level < SPEC_LEVEL) return;
      const was = api.pendingSpec;
      api.pendingSpec = true;
      if (!game.flags.spec_ready) game.setFlag('spec_ready', true);
      if (!was && !quiet) game.toast('Mr. Laporte wants to see you in his office.', 'quest');
    }

    // ---------- leveling ----------
    /** Boon slots earned by a level (BOON_LEVELS reached). */
    function boonSlots(level) { let n = 0; for (const L of BOON_LEVELS) if (L <= level) n++; return n; }

    /**
     * round 2 (teacher mode): going DOWN a level. Boons taken above the new level are removed, pending boons are
     * recomputed (the freed slots that still exist can be picked again with Tab), the kit is re-equipped (holds and
     * abilities above the level end; abilities and attack rank follow the level), the look is refreshed (aura).
     */
    function levelDown(old, newLevel) {
      const p = game.player;
      if (p) { p.hp = p.hpMax; p.alive = true; }
      const kept = [], removed = [];
      for (const id of api.boons) ((api.boonLevels[id] || 1) <= newLevel ? kept : removed).push(id);
      for (const id of removed) delete api.boonLevels[id];
      api.boons = kept;
      api.pendingBoons = Math.max(0, Math.min(boonSlots(newLevel) - kept.length, api.pendingBoons + removed.length));
      api.offer = null;
      if (!api.specId && newLevel < SPEC_LEVEL) api.pendingSpec = false;
      applyKit();
      recalc();
      if (p) p.hp = p.hpMax;
      refreshLook();
      if (removed.length) emit('boons:removed', { ids: removed });
      const r = rankAt(newLevel), oldRank = rankAt(old);
      if (r < oldRank) emit('rank:down', { rank: r, prev: oldRank });
    }

    function levelTo(newLevel, opts = {}) {
      const old = api.level;
      newLevel = Math.max(1, Math.min(cap(), newLevel | 0));
      if (newLevel === old) return 0;
      const before = unlockedSet();
      const oldRank = rankAt(old);
      api.level = newLevel;
      api.xpNext = xpNext(newLevel);
      recalc();
      const p = game.player;
      if (newLevel < old) {
        levelDown(old, newLevel);
        emit('level:set', { level: newLevel, prev: old });
        return 0;
      }
      if (p) { p.hp = p.hpMax; p.alive = true; }
      const gained = newLevel - old;
      if (!opts.quiet && p) {
        game.fx({ type: 'levelup', x: p.x, y: p.y });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: 2.5, color: '#ffd24a', dur: 0.6 });
        const combat = game.sys.combat;
        if (combat && typeof combat.aoe === 'function') {
          try {
            combat.aoe(p, { x: p.x, y: p.y, r: 2.5, dmg: 0, knockback: 7, type: 'true', silent: true, tags: ['levelup'] });
          } catch (e) { warn('aoe', 'level-up knockback failed: ' + (e && e.message)); }
        }
        sfx('levelup');
        game.toast(gained > 1 ? `Level ${newLevel}! (+${gained})` : `Level ${newLevel}!`, 'good');
      }
      emit('levelup', { level: newLevel, gained });
      const r = rankAt(newLevel);
      if (r > oldRank) emit('rank:up', { rank: r, prev: oldRank });
      emitUnlocks(before);
      if (opts.boons !== false) {
        for (const L of BOON_LEVELS) if (L > old && L <= newLevel) api.pendingBoons++;
      }
      if (old < SPEC_LEVEL && newLevel >= SPEC_LEVEL) markSpecReady(opts.quiet);
      if (old < AURA_LEVEL && newLevel >= AURA_LEVEL) refreshLook();
      if (old < EMPOWER_LEVEL && newLevel >= EMPOWER_LEVEL && api.classId) {
        refreshLook();
        if (!opts.quiet && p) {
          const col = (p.look && p.look.aura && p.look.aura.color) || '#ffd24a';
          game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.6, color: col, dur: 1.4 });
          game.fx({ type: 'shockwave', x: p.x, y: p.y, r: 3, color: col });
          game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 30, r: 1.8, color: '#ffffff' });
          game.toast('Your aura blazes brighter! (Empowered)', 'good');
        }
        emit('aura:empowered', { level: newLevel });
      }
      emit('level:set', { level: newLevel, prev: old });
      return gained;
    }

    /** Jump to a level (debug, teacher tools): xp restarts at 0 of the new level (full at the cap). */
    function setLevel(n, opts = {}) {
      const was = api.level;
      const r = levelTo(n, opts);
      if (api.level !== was) api.xp = api.level >= cap() ? api.xpNext : 0;
      return r;
    }

    function addXp(n) {
      n = Math.round(Number(n) || 0);
      if (n <= 0) return 0;
      api.xpTotal += n;
      if (api.level >= cap()) {
        api.xp = api.xpNext;
        emit('xp', { amount: n, total: api.xpTotal });
        return 0;
      }
      api.xp += n;
      emit('xp', { amount: n, total: api.xpTotal });
      let levels = 0;
      while (api.xp >= api.xpNext && api.level < cap()) {
        api.xp -= api.xpNext;
        levels += levelTo(api.level + 1);
      }
      if (api.level >= cap()) api.xp = api.xpNext;
      return levels;
    }

    // ---------- class / spec ----------
    function applyKit() {
      const p = game.player;
      if (!p) return;
      p.data.classId = api.classId;
      p.data.specId = api.specId;
      const k = kits();
      if (k && typeof k.set === 'function') {
        try { k.set(p, api.classId, api.specId); } catch (e) { warn('kitset', 'kits.set failed: ' + (e && e.message)); }
      }
    }
    function updateNames() {
      const c = api.classId ? classDef(api.classId) : null;
      const s = api.specId ? specDef(api.specId) : null;
      className = c ? c.name : '';
      specName = s ? s.name : '';
    }

    function setClass(id, opts = {}) {
      const def = classDef(id);
      if (!id || !def || id === 'novice') { warn('class:' + id, 'unknown class ' + id); return false; }
      const before = unlockedSet();
      if (api.classId !== id) api.specId = null;
      api.classId = id;
      updateNames();
      applyKit();
      recalc();
      if (game.player) game.player.hp = game.player.hpMax;
      refreshLook();
      if (!opts.quiet) {
        celebrate(def.color || '#ffd24a');
        game.toast(`You are now ${/^[AEIOU]/i.test(def.name) ? 'an' : 'a'} ${def.name}!`, 'good');
      }
      emit('class:set', { classId: id });
      emitUnlocks(before);
      markSpecReady(opts.quiet);
      return true;
    }

    function setSpec(id, opts = {}) {
      const def = specDef(id);
      if (!def) { warn('spec:' + id, 'unknown spec ' + id); return false; }
      if (def.from && api.classId !== def.from) setClass(def.from, { quiet: true });
      const before = unlockedSet();
      api.specId = id;
      api.pendingSpec = false;
      updateNames();
      applyKit();
      recalc();
      if (game.player) game.player.hp = game.player.hpMax;
      refreshLook();
      if (!opts.quiet) {
        celebrate(def.color || '#ffd24a');
        game.toast(`You are now ${/^[AEIOU]/i.test(def.name) ? 'an' : 'a'} ${def.name}!`, 'good');
      }
      emit('spec:set', { specId: id });
      emitUnlocks(before);
      return true;
    }

    // ---------- boons ----------
    function offerBoons(n = 3) {
      const owned = new Set(api.boons);
      const all = boonDefs().filter((b) => !owned.has(b.id));
      const classPool = all.filter((b) => !b.spec && b.class && b.class === api.classId);
      const specPool = api.specId ? all.filter((b) => b.spec === api.specId) : [];
      const seed = (game.seed ^ Math.imul(api.level + 1, 2654435761) ^ Math.imul(api.boons.length + 1, 40503)
        ^ hashStr((api.classId || '') + '/' + (api.specId || ''))) >>> 0;
      const rng = createRng(seed);
      shuffle(classPool, rng);
      shuffle(specPool, rng);
      const out = [];
      if (specPool.length && n > 0) out.push(specPool.shift());
      const rest = shuffle(classPool.concat(specPool), rng);
      while (out.length < n && rest.length) out.push(rest.shift());
      shuffle(out, rng);
      return out.map((b) => ({ id: b.id, name: b.name || b.id, desc: b.desc || '', icon: b.icon || 'star',
        ...(b.spec ? { spec: b.spec } : { class: b.class }) }));
    }

    function showBoonModal() {
      return new Promise((resolve) => {
        const entry = { type: 'boonPicker', resolve, chosen: null };
        picker = entry;
        game.openModal({
          type: 'boonPicker',
          options: api.offer.map((o) => ({ id: o.id, name: o.name, desc: o.desc, icon: o.icon })),
          onClose: () => { if (picker === entry) picker = null; resolve(entry.chosen); },
        });
      });
    }

    function openBoonPicker() {
      if (api.pendingBoons <= 0 || boonAsking || game.modal) return Promise.resolve(null);
      if (api.offer && api.offer.length) return showBoonModal();
      boonAsking = true;
      const g = gates();
      const ask = g && g.ask ? g.ask({ context: 'boon', difficulty: Math.max(1, Math.ceil(api.level / 4)) })
        : Promise.resolve({ correct: true, skipped: true });
      return ask.then((r) => {
        boonAsking = false;
        if (api.pendingBoons <= 0) return null;
        api.offer = offerBoons(r && r.correct ? 3 : 2);
        if (!api.offer.length) {
          api.offer = null;
          api.pendingBoons = 0;
          game.toast('No new boons to learn right now.', 'info');
          return null;
        }
        return showBoonModal();
      }, () => { boonAsking = false; return null; });
    }

    function chooseBoon(id) {
      if (!id || api.boons.includes(id)) return false;
      if (api.offer) {
        if (!api.offer.some((o) => o.id === id)) return false;
      } else {
        const b = boonDef(id);
        if (!b) { warn('boon:' + id, 'unknown boon ' + id); return false; }
      }
      const def = boonDef(id);
      api.boons.push(id);
      api.boonLevels[id] = api.level;
      if (api.pendingBoons > 0) api.pendingBoons--;
      api.offer = null;
      const p = game.player;
      if (p) {
        game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 20, r: 1.2, color: '#ffe680' });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.6, color: '#ffe680', dur: 0.5 });
      }
      sfx('ui_ok');
      game.toast(`New boon: ${def ? def.name : id}!`, 'good');
      emit('boon', { id });
      if (picker && picker.type === 'boonPicker') {
        picker.chosen = id;
        if (game.modal && game.modal.type === 'boonPicker') game.closeModal(id);
      }
      return true;
    }

    // ---------- pickers ----------
    function pickerEntry(classId, specId) {
      const def = specId ? specDef(specId) : classDef(classId);
      let list = normAbilities(def.abilities);
      if (!list.length) {
        const k = kits();
        const reg = k && k.registry;
        const kit = reg && reg[specId || classId];
        list = normAbilities(kit && kit.abilities);
      }
      return {
        id: specId || classId, name: def.name, blurb: def.blurb || '', color: def.color || null,
        look: previewLook(specId ? def.from : classId, specId || null), basic: basicInfo(def),
        abilities: list.map((a) => ({ slot: a.slot, id: a.id, name: a.name, icon: a.icon, desc: a.desc, unlock: a.unlock })),
      };
    }

    function openPicker(type, payload) {
      return new Promise((resolve) => {
        const entry = { type, resolve, chosen: null };
        picker = entry;
        game.openModal(Object.assign({ type }, payload, {
          onClose: () => { if (picker === entry) picker = null; resolve(entry.chosen); },
        }));
      });
    }

    function openClassPicker() {
      return openPicker('classPicker', { classes: classIds().map((id) => pickerEntry(id, null)) });
    }

    function openSpecPicker() {
      if (!api.classId) { warn('specnoclass', 'specPicker with no class'); return Promise.resolve(null); }
      const g = gates();
      const ask = g && g.ask ? g.ask({ context: 'spec', difficulty: 2 }) : Promise.resolve({ correct: true });
      return ask.then(() => {
        const options = specIds(api.classId).map((id) => pickerEntry(null, id));
        if (!options.length) { warn('nospecs', 'no specializations for ' + api.classId); return null; }
        return openPicker('specPicker', { options });
      });
    }

    function openLookPicker() {
      const looks = ((data().looks && data().looks.PLAYER_LOOKS) || []).map(clone);
      return openPicker('lookPicker', { name: game.name, looks });
    }

    function finishPicker(type, value) {
      if (picker && picker.type === type) {
        picker.chosen = value;
        if (game.modal && game.modal.type === type) game.closeModal(value);
        else { const e = picker; picker = null; e.resolve(value); }
      }
    }

    function pickClass(id) {
      if (!classIds().includes(id)) { warn('pick:' + id, 'pickClass: unknown class ' + id); return false; }
      setClass(id);
      finishPicker('classPicker', id);
      return true;
    }
    function pickSpec(id) {
      const def = specDef(id);
      if (!def || (api.classId && def.from !== api.classId)) { warn('pickspec:' + id, 'pickSpec: not a spec of ' + api.classId); return false; }
      setSpec(id);
      finishPicker('specPicker', id);
      return true;
    }
    function pickLook(i) {
      const n = ((data().looks && data().looks.PLAYER_LOOKS) || [1, 2]).length;
      i = Math.max(0, Math.min(n - 1, Number(i) | 0));
      game.setFlag('look_choice', i);
      game.setFlag('look_chosen', true);
      refreshLook();
      const p = game.player;
      if (p) game.fx({ type: 'poof', x: p.x, y: p.y, color: '#ffffff' });
      finishPicker('lookPicker', i);
      return true;
    }

    // ---------- player down (CONTRACTS 12a, STORY "Rules of the world") ----------
    function zoneOk(id) { const z = (data().zones || {})[id]; return !!(z && z.id); }
    function zoneHasMarker(id, m) { const z = (data().zones || {})[id]; return !!(z && z.markers && z.markers[m]); }

    function respawnTarget() {
      const cur = game.zone ? game.zone.id : null;
      if (game.flags.intro_done && zoneOk('academy')) {
        const m = zoneHasMarker('academy', 'infirmary') ? 'infirmary' : zoneHasMarker('academy', 'infirmary_bed') ? 'infirmary_bed' : 'entrance';
        return { zone: 'academy', marker: m, where: 'infirmary' };
      }
      const m = cur && zoneHasMarker(cur, 'respawn') ? 'respawn' : 'start';
      return { zone: cur, marker: m, where: 'respawn' };
    }

    function wake(where, extra) {
      const p = game.player;
      api.downed = false;
      if (!p) return;
      p.alive = true;
      p.hp = p.hpMax;
      if (p.anim === 'ko') { p.anim = 'idle'; p.animT = 0; }
      if (p.status) for (const k of NEGATIVE_STATUS) if (p.status[k]) p.status[k] = 0;
      if (!p.status) p.status = {};
      p.status.invuln = 0;
      const combat = game.sys.combat;
      if (combat && typeof combat.status === 'function') combat.status(p, 'invuln', WAKE_INVULN);
      if (!(p.status.invuln > 0)) p.status.invuln = WAKE_INVULN;
      game.fx({ type: 'heal', x: p.x, y: p.y });
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 14, r: 1, color: '#ffffff' });
      let text;
      if (where === 'here') text = 'Mr. Laporte: "Correct. Up you get. Try not to make a habit of it."';
      else if (where === 'infirmary') {
        const nurse = (data().npcs && data().npcs.marigold && data().npcs.marigold.name) || 'Nurse Marigold';
        text = nurse + ': "There we are, good as new. Do try to duck next time, dear."';
      }
      else text = 'Mr. Laporte (from somewhere): "Up. Again. Watch your step this time."';
      if (extra) text += ' ' + extra;
      game.toast(text, where === 'here' ? 'good' : 'info');
      emit('player:revived', { where });
    }

    function respawn() {
      const t = respawnTarget();
      let extra = '';
      if (game.flags.wanted) {
        const inv = game.sys.inventory;
        const fine = inv ? Math.floor((inv.gold || 0) * 0.1) : 0;
        if (inv && fine > 0) inv.addGold(-fine);
        game.setFlag('wanted', false);
        extra = fine > 0 ? `(The town guard collected a fine of ${fine} gold.)` : '(The town guard let you off with a warning.)';
      }
      const w = game.world;
      try {
        if (t.zone && game.zone && t.zone !== game.zone.id) {
          if (w.travel) w.travel(t.zone, t.marker); else w.loadZone(t.zone, t.marker);
        } else if (game.player && w) {
          const at = w.resolve ? w.resolve(t.marker) : w.marker(t.marker);
          if (at) { const p = game.player; p.x = p.px = at.x; p.y = p.py = at.y; p.vx = p.vy = 0; p.kx = p.ky = 0; game.snapCamera(); }
        }
      } catch (e) { warn('respawn', 'respawn travel failed: ' + (e && e.message)); }
      wake(t.where, extra);
    }

    function decideDown() {
      const g = gates();
      const reviveCfg = g && g.contextConfig ? g.contextConfig('revive') : { enabled: true };
      const qmode = game.questions ? game.questions.mode : 'off';
      const canAsk = g && g.ask && reviveCfg.enabled !== false && qmode !== 'off' && game.t - lastReviveAsk >= REVIVE_COOLDOWN;
      if (!canAsk) { respawn(); return Promise.resolve('respawn'); }
      lastReviveAsk = game.t;
      // A wrong answer has its own consequence (the infirmary), so the revive question never blocks.
      return g.ask({ context: 'revive', difficulty: 1, optional: true, blocking: false }).then((r) => {
        if (r && r.correct) { wake('here'); return 'here'; }
        respawn();
        return 'respawn';
      });
    }

    function onDown() {
      const p = game.player;
      if (api.downed || !p) return api.downPromise;
      if (p.data && p.data.minHp != null) return null;
      api.downed = true;
      if (!p.status) p.status = {};
      p.status.invuln = Math.max(p.status.invuln || 0, 30);
      api.downPromise = new Promise((resolve) => {
        const run = () => { Promise.resolve(decideDown()).then(resolve, (e) => { warn('down', String(e)); respawn(); resolve('respawn'); }); };
        const g = gates();
        // Deferred to the gates update (later in this step): never travel from inside a combat callback.
        if (g && g.after) g.after(0, run); else run();
      });
      return api.downPromise;
    }

    // ---------- api ----------
    const api = {
      level: 1, xp: 0, xpTotal: 0, xpNext: xpNext(1), classId: null, specId: null, boons: [],
      /** round 2: boon id -> the level it was taken at (a level-down removes boons taken above the new level). */
      boonLevels: {},
      pendingBoons: 0, pendingSpec: false, offer: null, downed: false, downPromise: null,
      xpFor: xpNext,
      addXp,
      setLevel(n, opts) { return setLevel(n, opts || {}); },
      boonSlots,
      setClass, setSpec,
      rank() { return rankAt(api.level); },
      rankAt,
      hasBoon(id) { return api.boons.includes(id); },
      offerBoons, chooseBoon, openBoonPicker,
      openClassPicker, openSpecPicker, openLookPicker,
      pickClass, pickSpec, pickLook,
      recalc, refreshLook,
      classDef, specDef, classIds, specIds, boonDefs, abilityList, previewLook,
      _names: updateNames,
      className() { return className; },
      specName() { return specName; },
      handleDown: onDown,
      revive(where = 'here') { wake(where); },
      /** Reset to a fresh level-1 novice (debug reset). */
      reset() {
        api.level = 1; api.xp = 0; api.xpTotal = 0; api.xpNext = xpNext(1); api.classId = null; api.specId = null;
        api.boons = []; api.boonLevels = {}; api.pendingBoons = 0; api.pendingSpec = false; api.offer = null; api.downed = false;
        lastReviveAsk = -Infinity;
        updateNames(); applyKit(); recalc();
        if (game.player) game.player.hp = game.player.hpMax;
      },
    };

    // ---------- ops, conditions, commands ----------
    const ops = game.ops;
    if (ops && ops.register) {
      ops.register('xp', (g, a) => { const n = Number(a[1]) || 0; if (n > 0) g.toast(`+${n} XP`, 'good'); addXp(n); });
      ops.register('classPicker', () => openClassPicker());
      ops.register('specPicker', () => openSpecPicker());
      ops.register('lookPicker', () => openLookPicker());
      ops.registerCond('level', (g, c) => compareCond(api.level, c));
      ops.registerCond('class', (g, c) => (c.length < 2 ? !!api.classId : c[1] === 'none' || c[1] === null ? !api.classId : api.classId === c[1]));
      ops.registerCond('spec', (g, c) => (c.length < 2 ? !!api.specId : c[1] === 'none' || c[1] === null ? !api.specId : api.specId === c[1]));
    }
    game.commands.pickClass = (id) => pickClass(id);
    game.commands.pickSpec = (id) => pickSpec(id);
    game.commands.pickLook = (i) => pickLook(i);
    game.commands.pickBoon = (id) => chooseBoon(id);
    game.commands.openBoonPicker = () => openBoonPicker();
    game.commands.openSpecPicker = () => (api.pendingSpec && game.flags.spec_ceremony_done ? openSpecPicker() : Promise.resolve(null));

    game.bus.on('player:down', () => { onDown(); });
    // round 3: the empowered aura. Every player look refresh (Sim or local) ends with 'look:changed'; from level 14 the
    // aura it composed gets brighter and `tier: 2` (renderers may draw it larger), and the weapon glows in its color.
    game.bus.on('look:changed', (e) => {
      const p = game.player;
      if (!e || e.ent !== p || !p || !p.look || api.level < EMPOWER_LEVEL || !api.classId) return;
      const a = p.look.aura;
      if (!a || a.tier === 2) return;
      a.color = brighten(a.color, 0.35);
      a.tier = 2;
      a.empowered = true;
      if (p.look.held && !p.look.held.glow) p.look.held.glow = a.color;
    });

    updateNames();
    recalc();
    if (game.player) game.player.hp = game.player.hpMax;
    return api;
  },

  update(game, dt) {
    const api = game.sys.progression;
    // round 3: the empowered aura (level 14+) also throws off a few sparks every second (one pooled fx event)
    const p = game.player;
    if (p && api.level >= EMPOWER_LEVEL && api.classId && p.look && p.look.aura && p.look.aura.tier === 2 && !p.data.down && p.alpha !== 0) {
      EMPOWER_T -= dt || 1 / 60;
      if (EMPOWER_T <= 0) {
        EMPOWER_T = 1.1;
        EMPOWER_FX.x = p.x; EMPOWER_FX.y = p.y; EMPOWER_FX.color = p.look.aura.color;
        game.fx(EMPOWER_FX);
      }
    }
    const inp = game.input;
    if (inp && inp.pressed && inp.pressed.boon && !game.modal && !game.inputLock) {
      if (api.pendingBoons > 0) api.openBoonPicker();
      else if (api.pendingSpec && game.flags.spec_ceremony_done) api.openSpecPicker();
    }
  },

  save(game) {
    const a = game.sys.progression;
    return {
      level: a.level, xp: a.xp, xpTotal: a.xpTotal, classId: a.classId, specId: a.specId, boons: a.boons.slice(),
      boonLevels: Object.assign({}, a.boonLevels),
      pendingBoons: a.pendingBoons, pendingSpec: a.pendingSpec, offer: a.offer ? a.offer.map((o) => Object.assign({}, o)) : null,
    };
  },

  load(game, j) {
    const a = game.sys.progression;
    if (!j) return;
    a.level = Math.max(1, Math.min((game.config && game.config.levelCap) || LEVEL_CAP, j.level | 0 || 1));
    a.xpNext = xpNext(a.level);
    a.xp = Math.max(0, Number(j.xp) || 0);
    a.xpTotal = Math.max(0, Number(j.xpTotal) || 0);
    a.classId = j.classId && a.classDef(j.classId) ? j.classId : null;
    a.specId = j.specId && a.specDef(j.specId) ? j.specId : null;
    a.boons = Array.isArray(j.boons) ? j.boons.slice() : [];
    // older saves: the i-th boon filled the i-th boon slot (4, 6, 8, ...)
    a.boonLevels = {};
    a.boons.forEach((id, i) => {
      const L = j.boonLevels && Number(j.boonLevels[id]);
      a.boonLevels[id] = L > 0 ? L : Math.min(a.level, BOON_LEVELS[Math.min(i, BOON_LEVELS.length - 1)]);
    });
    a.pendingBoons = Math.max(0, j.pendingBoons | 0);
    a.pendingSpec = !!j.pendingSpec;
    a.offer = Array.isArray(j.offer) && j.offer.length ? j.offer : null;
    const p = game.player;
    if (p) {
      p.data.classId = a.classId; p.data.specId = a.specId;
      const k = game.sys.kits;
      if (k && k.set) { try { k.set(p, a.classId, a.specId); } catch { /* kit stub */ } }
    }
    a.recalc();
    if (p) p.hp = p.hpMax;
    a._names();
    a.refreshLook();
  },

  hud(game, hud) {
    const a = game.sys.progression;
    const hp = hud.player;
    hp.level = a.level; hp.xp = a.xp; hp.xpNext = a.xpNext;
    hp.classId = a.classId; hp.className = a.className();
    hp.specId = a.specId; hp.specName = a.specName();
    const p = game.player;
    if (p && p.stats) { hp.power = p.stats.power || 0; hp.defense = p.stats.defense || 0; hp.speed = p.stats.speed || 0; }
    hud.pendingBoons = a.pendingBoons;
    hud.pendingSpec = a.pendingSpec;
  },
};
