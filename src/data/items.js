// Item defs (CONTRACTS section 12): {id, type, name, desc, icon, price, stack, use: {effect, ...}, cd, look}.
// Effect params (assumed by content, see docs/notes/narrative.md):
//   heal {amount, frac}: restore amount + frac * hpMax      heal_over_time {amount, dur}: amount spread over dur s
//   bomb {dmg (coef of power), r, range, delay}            haste {mult, dur}     shield {frac (of hpMax), dur}
//   cure {}: clears burn/frost/slow/root/venom/stun        smoke {r, dur, stealth}   xp {amount}
//   summon_pet {kind, dur}                                 resource {} (focus_scroll: the focus gate)
// Cosmetics carry `slot` ('hat' | 'cape' | 'outfitColor') and a `look` patch applied over the player look.

import { config } from '../config.js';

// Health amounts below are written in readable base numbers; the game multiplies them by config.numberScale where they
// are used (inventory), so descriptions show the scaled values.
const NS = config.numberScale || 1;

const consumable = (id, name, desc, icon, price, stack, use, cd = 1) =>
  ({ id, type: 'consumable', name, desc, icon, price, stack, use, cd, look: null });
const key = (id, name, desc, icon = 'key') =>
  ({ id, type: 'key', name, desc, icon, price: 0, stack: 99, use: null, cd: 0, look: null });
const cosmetic = (id, name, desc, icon, price, slot, look) =>
  ({ id, type: 'cosmetic', name, desc, icon, price, stack: 1, use: null, cd: 0, slot, look });
const hat = (id, name, desc, price, style, color) => cosmetic(id, name, desc, 'hat', price, 'hat', { hat: { style, color } });
const cape = (id, name, desc, price, color) => cosmetic(id, name, desc, 'cloak', price, 'cape', { cape: { color } });
const dye = (id, name, desc, price, primary, secondary) =>
  cosmetic(id, name, desc, 'star', price, 'outfitColor', { outfit: { primary, secondary } });

const list = [
  // ---- hotbar consumables (STORY ids) ----
  consumable('potion_small', 'Small Potion', `Tastes like cherry and a little like pennies. Heals ${30 * NS} + 30%.`, 'potion', 15, 9,
    { effect: 'heal', amount: 30, frac: 0.3 }),
  consumable('potion_big', 'Big Potion', `The family size. Heals ${60 * NS} + 50%.`, 'potion', 45, 5,
    { effect: 'heal', amount: 60, frac: 0.5 }, 2),
  consumable('bread', 'Fresh Bread', `Still warm. Heals ${45 * NS} over 8 seconds. Do not eat while fighting. (Eat while fighting.)`,
    'bread', 6, 9, { effect: 'heal_over_time', amount: 45, dur: 8 }, 4),
  consumable('bomb', 'Fizzbomb', 'Throw it ahead. It goes BOOM in a very friendly way.', 'bomb', 20, 5,
    { effect: 'bomb', dmg: 3, r: 2, range: 4, delay: 0.7 }, 2),
  consumable('speed_tonic', 'Speed Tonic', 'Fizzy! Moves you 40% faster for 10 seconds.', 'tonic', 18, 5,
    { effect: 'haste', mult: 1.4, dur: 10 }, 10),
  consumable('shield_charm', 'Shield Charm', 'A sparkly bubble that soaks up 30% of your health in damage.', 'charm', 30, 3,
    { effect: 'shield', frac: 0.3, dur: 10 }, 12),
  consumable('smoke_pellet', 'Smoke Pellet', 'Poof! Enemies lose track of you for a few seconds.', 'smoke', 22, 3,
    { effect: 'smoke', r: 2.5, dur: 4, stealth: 3 }, 8),
  consumable('focus_scroll', 'Focus Scroll', 'Answer correctly: full resource, cooldowns reset, +50% power for 6 s.', 'book', 40, 3,
    { effect: 'resource' }, 20),
  // ---- extra consumables ----
  consumable('cheese', 'Pantry Cheese', `A rat was saving this. Heals ${12 * NS}.`, 'bread', 3, 9, { effect: 'heal', amount: 12, frac: 0 }),
  consumable('honey_bun', 'Honey Bun', `Sticky, golden, legendary. Heals ${90 * NS} over 10 seconds.`, 'bread', 14, 5,
    { effect: 'heal_over_time', amount: 90, dur: 10 }, 4),
  consumable('herbal_tea', 'Herbal Tea', 'Cures burns, frost, slows, roots and venom. Warm and smug.', 'tonic', 12, 5,
    { effect: 'cure' }, 3),
  consumable('jelly_latte', 'Jelly Latte', 'Juniper\'s invention. Wobbly. 25% faster for 20 seconds.', 'tonic', 0, 5,
    { effect: 'haste', mult: 1.25, dur: 20 }, 10),
  consumable('study_notes', 'Elowen\'s Notes', 'Color-coded. Reading them grants 40 XP.', 'book', 0, 3, { effect: 'xp', amount: 40 }),
  consumable('fox_whistle', 'Fox Whistle', 'Calls a friendly fox for 30 seconds. It mostly bites ankles.', 'star', 60, 3,
    { effect: 'summon_pet', kind: 'pet_fox', dur: 30 }, 45),
  // ---- quest and key items ----
  key('slime_jelly', 'Slime Jelly', 'Wobbly, green, faintly minty. Juniper wants this. Why?', 'potion'),
  key('glowcap', 'Glowcap', 'A sporecap\'s glowing cap. Mo the forager collects these.', 'star'),
  key('stolen_textbook', 'Stolen Textbook', '"Arithmancy for Beginners". Goblin doodles in the margins.', 'book'),
  key('warm_pie', 'Warm Pie', 'Rosa\'s apple pie for Madam Opal. Do not eat it. Do NOT.', 'bread'),
  key('mossback_acorn', 'Mossback\'s Acorn', 'A giant golden acorn. It snores softly.', 'star'),
  // ---- cosmetics (Stitch & Sparkle) ----
  hat('hat_star_wizard', 'Starry Wizard Hat', 'Pointy. Sparkly. Classic.', 60, 'wizard', '#4b3fa8'),
  hat('hat_straw', 'Sunny Straw Hat', 'For gardening, fishing, and looking relaxed.', 40, 'straw', '#e8c870'),
  hat('hat_feather', 'Bard\'s Feather Cap', 'Comes with a free swagger.', 75, 'feather', '#2a9d8f'),
  hat('hat_paper_crown', 'Paper Crown', 'Royalty, but recyclable.', 50, 'crown', '#ffd24a'),
  hat('hat_moon_circlet', 'Moon Circlet', 'A silver band that hums when you are right.', 140, 'circlet', '#d8e4ff'),
  hat('hat_red_bandana', 'Red Bandana', 'Makes you 0% faster but feels 100% faster.', 35, 'bandana', '#e63946'),
  hat('hat_chef', 'Chef\'s Toque', 'Rosa says this is not how you get into baking.', 55, 'chef', '#ffffff'),
  hat('hat_horned', 'Horned Helm', 'The horns are foam. Do not tell anyone.', 120, 'horned', '#c0c4cc'),
  hat('hat_cap_blue', 'Academy Cap', 'Official Flinkerton blue. Gift-shop official.', 30, 'cap', '#3d5aa8'),
  cape('cape_crimson', 'Crimson Cape', 'Swooshes dramatically on turns.', 90, '#c8303c'),
  cape('cape_midnight', 'Midnight Cape', 'Dark blue with tiny embroidered stars.', 110, '#22285a'),
  cape('cape_mint', 'Mint Cape', 'Fresh. Very fresh.', 80, '#7fe0b8'),
  cape('cape_gold', 'Golden Cape', 'Extremely visible from space.', 220, '#ffcc33'),
  dye('dye_sunset', 'Sunset Dye', 'Orange and pink, like a nice evening.', 45, '#ff8a4c', '#ffd1a8'),
  dye('dye_ocean', 'Ocean Dye', 'Deep blue and seafoam.', 45, '#2f6fb8', '#9fe6e0'),
  dye('dye_forest', 'Forest Dye', 'Moss green with bark brown.', 45, '#3f8f4a', '#a8743d'),
  dye('dye_lavender', 'Lavender Dye', 'Soft purple. Smells faintly of lavender. (It does not.)', 45, '#9a7ad9', '#e8dcff'),
  dye('dye_midnight', 'Midnight Dye', 'Black-blue with silver trim.', 70, '#23263a', '#c0c8d8'),
];

const items = {};
for (const it of list) items[it.id] = it;
export default items;
