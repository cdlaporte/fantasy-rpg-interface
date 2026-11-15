// Looks (CONTRACTS section 6): player bases, the hooded intro patch, Laporte, and named NPC presets.
// Pure data plus one tiny pure helper. Only section 6 vocabulary is used (validated by tests/node/data-narrative.test.mjs).
import { LAPORTE } from './palettes.js';

/** Build a full humanoid look from a partial one (every field present, defaults filled). */
export function humanoid(o) {
  return {
    rig: 'humanoid', build: o.build || 'a', size: o.size || 1, skin: o.skin || '#c68e62',
    hair: o.hair || { style: 'short', color: '#3a2618' }, facial: o.facial || 'none',
    outfit: o.outfit || { style: 'tunic', primary: '#4a90d9', secondary: '#f4e3c4', accent: '#ffd24a' },
    hood: !!o.hood, hat: o.hat || null, cape: o.cape || null, held: o.held || null, aura: o.aura || null,
    ears: o.ears || 'round', hero: o.hero || null,
  };
}

const fit = (style, primary, secondary, accent) => ({ style, primary, secondary, accent });

/** Two player bases: ambiguous ethnicity, medium-brown skin tones, neutral starter outfits. Never labeled. */
export const PLAYER_LOOKS = [
  humanoid({
    build: 'a', skin: '#a8714a', hair: { style: 'curly', color: '#2b1d14' },
    outfit: fit('tunic', '#3f8f8a', '#efe2c4', '#d9a441'),
  }),
  humanoid({
    build: 'b', skin: '#b98256', hair: { style: 'ponytail', color: '#3a2416' },
    outfit: fit('tunic', '#5a7fc0', '#efe2c4', '#e0b24a'),
  }),
];

/** Patch applied over a player base while `flags.look_chosen` is unset (the hooded traveler). */
export const CLOAKED = {
  outfit: fit('cloak', '#7a6a9a', '#4e4270', '#d9c8ff'), hood: true, cape: null, hat: null,
};

/** Class outfits are filled by the class kit package elsewhere (data.classes[id].look). */
export const CLASS_OUTFITS = {};

/** Mr. Laporte: LAPORTE palette, M hairline, goatee stubble, navy/gray quarter-zip, headmaster's cape, staff. */
export const LAPORTE_LOOK = humanoid({
  build: 'a', size: 1.05, skin: LAPORTE.skin[0],
  hair: { style: 'm_hairline', color: LAPORTE.hair[0] }, facial: 'goatee',
  outfit: fit('quarterzip', LAPORTE.quarterZipNavy[0], LAPORTE.quarterZipGray[0], LAPORTE.collar),
  cape: { color: '#7a2e3b' },
  held: { style: 'staff', color: LAPORTE.hair[2], glow: '#9fe6ff' },
  hero: 'laporte',
});

/** Malgrim the Sealweaver: pompous purple, too much cape. */
export const MALGRIM_LOOK = humanoid({
  build: 'b', size: 1.1, skin: '#d9b08c', hair: { style: 'long', color: '#ece8f4' }, facial: 'mustache',
  outfit: fit('robe', '#5b2a86', '#2a1840', '#ffcf4a'),
  hat: { style: 'wizard', color: '#3d1f5c' }, cape: { color: '#9a3fd0' },
  held: { style: 'staff', color: '#2a1840', glow: '#c86bff' },
  aura: { style: 'glow', color: '#c86bff' }, hero: 'malgrim',
});

/** Named presets reused by NPC defs (data/npcs) and story spawns. */
export const NPC_LOOKS = {
  // classmates
  bram: humanoid({ build: 'a', size: 1.12, skin: '#8d5a3b', hair: { style: 'spiky', color: '#c4622d' },
    outfit: fit('tunic', '#d9453a', '#c0c4cc', '#ffd24a'), held: { style: 'sword', color: '#d8dce4', glow: null } }),
  elowen: humanoid({ build: 'b', skin: '#f0c8a0', hair: { style: 'bun', color: '#1e1e2e' }, ears: 'pointed',
    outfit: fit('robe', '#7a4fd0', '#3fc8e0', '#ffe680'), held: { style: 'book', color: '#3d5aa8', glow: null } }),
  pip: humanoid({ build: 'b', size: 0.82, skin: '#c99266', hair: { style: 'curly', color: '#3b2a1a' },
    outfit: fit('leather', '#3fa36a', '#24423a', '#ffd24a'), hat: { style: 'bandana', color: '#58d68d' },
    held: { style: 'daggers', color: '#c0c4cc', glow: null } }),
  // town
  mira: humanoid({ build: 'b', size: 0.92, skin: '#6b4430', hair: { style: 'curly', color: '#dcdcdc' },
    outfit: fit('apron', '#7a4fb0', '#f4e3c4', '#7cf07c'), held: { style: 'wand', color: '#8a5a33', glow: '#7cf07c' } }),
  fenwick: humanoid({ build: 'a', skin: '#e8b894', hair: { style: 'short', color: '#e6e6ea' }, facial: 'mustache',
    outfit: fit('vest', '#d94f8a', '#ffffff', '#ffd24a'), hat: { style: 'feather', color: '#3fc0c0' } }),
  gus: humanoid({ build: 'a', size: 1.25, skin: '#7a4a2e', hair: { style: 'bald', color: '#2a1a10' }, facial: 'beard',
    outfit: fit('apron', '#4a7a3a', '#e9dcc0', '#c98c50') }),
  rosa: humanoid({ build: 'b', skin: '#c68e62', hair: { style: 'bun', color: '#3a2618' },
    outfit: fit('apron', '#ffffff', '#e8a0b0', '#c8503c'), hat: { style: 'chef', color: '#ffffff' } }),
  tilly: humanoid({ build: 'b', size: 0.75, skin: '#c68e62', hair: { style: 'braids', color: '#3a2618' },
    outfit: fit('dress', '#ffb84a', '#ffffff', '#ff6b8a') }),
  juniper: humanoid({ build: 'b', skin: '#a0663f', hair: { style: 'ponytail', color: '#e0609a' },
    outfit: fit('apron', '#3f8f8a', '#f4ecd8', '#6b4423'), held: { style: 'lantern', color: '#c98c50', glow: '#ffe680' } }),
  opal: humanoid({ build: 'b', size: 0.95, skin: '#f2d3b0', hair: { style: 'long', color: '#f4f4f8' },
    outfit: fit('robe', '#3d5aa8', '#e9dcc0', '#ffd24a'), held: { style: 'book', color: '#c8503c', glow: null } }),
  guard_a: humanoid({ build: 'b', skin: '#d9a27a', hair: { style: 'ponytail', color: '#c4622d' },
    outfit: fit('uniform', '#3d5aa8', '#ffd24a', '#c0c4cc'), hat: { style: 'helm', color: '#c0c4cc' },
    held: { style: 'spear', color: '#8a8a9a', glow: null } }),
  guard_b: humanoid({ build: 'a', size: 1.15, skin: '#5a3a26', hair: { style: 'short', color: '#111111' }, facial: 'mustache',
    outfit: fit('uniform', '#3d5aa8', '#ffd24a', '#c0c4cc'), hat: { style: 'helm', color: '#c0c4cc' },
    held: { style: 'spear', color: '#8a8a9a', glow: null } }),
  guard_c: humanoid({ build: 'b', skin: '#b88160', hair: { style: 'braids', color: '#2a1a10' },
    outfit: fit('uniform', '#3d5aa8', '#ffd24a', '#c0c4cc'), hat: { style: 'cap', color: '#3d5aa8' },
    held: { style: 'sword_shield', color: '#c0c4cc', glow: null } }),
  pumble: humanoid({ build: 'a', size: 1.1, skin: '#f0c0a0', hair: { style: 'short', color: '#a8a8b0' }, facial: 'mustache',
    outfit: fit('vest', '#c8503c', '#ffd24a', '#ffffff'), hat: { style: 'crown', color: '#ffd24a' }, cape: { color: '#7a2e3b' } }),
  sol: humanoid({ build: 'a', skin: '#8a5a3b', hair: { style: 'curly', color: '#d0d0d0' }, facial: 'beard',
    outfit: fit('apron', '#6a8a3a', '#e9dcc0', '#c98c50'), hat: { style: 'straw', color: '#e8c870' },
    held: { style: 'broom', color: '#c98c50', glow: null } }),
  lyle: humanoid({ build: 'a', skin: '#d9b08c', hair: { style: 'long', color: '#e0a030' },
    outfit: fit('tunic', '#2a9d8f', '#f4e3c4', '#ffd24a'), hat: { style: 'feather', color: '#c8503c' }, cape: { color: '#ffd24a' },
    held: { style: 'book', color: '#8a5a33', glow: null } }),
  nia: humanoid({ build: 'b', skin: '#4a2e1e', hair: { style: 'curly', color: '#141414' },
    outfit: fit('uniform', '#3d5aa8', '#ffffff', '#ffd24a'), held: { style: 'book', color: '#2a9d8f', glow: null } }),
  ravi: humanoid({ build: 'a', skin: '#a0663f', hair: { style: 'short', color: '#111111' },
    outfit: fit('uniform', '#3d5aa8', '#ffffff', '#ffd24a'), held: { style: 'wand', color: '#6b4423', glow: '#ffe680' } }),
  // academy staff
  quill: humanoid({ build: 'b', skin: '#e8b894', hair: { style: 'bun', color: '#9a9aa8' },
    outfit: fit('robe', '#2a9d8f', '#f4ecd8', '#ffd24a'), hat: { style: 'wizard', color: '#2a9d8f' },
    held: { style: 'wand', color: '#6b4423', glow: '#9fe6ff' } }),
  rook: humanoid({ build: 'a', size: 1.08, skin: '#3a2418', hair: { style: 'bald', color: '#e8e8e8' }, facial: 'beard',
    outfit: fit('robe', '#7a2e3b', '#e0c060', '#ffffff'), held: { style: 'staff', color: '#8a5a33', glow: '#ff9a4a' } }),
  marigold: humanoid({ build: 'b', skin: '#c99266', hair: { style: 'curly', color: '#e07a3a' },
    outfit: fit('uniform', '#ffffff', '#e85a6a', '#7cf07c'), hat: { style: 'cap', color: '#ffffff' } }),
  // forest folk
  ranger_tam: humanoid({ build: 'a', skin: '#9a6440', hair: { style: 'ponytail', color: '#5a3a22' },
    outfit: fit('leather', '#4a7a3a', '#8a5a33', '#e8c870'), hat: { style: 'feather', color: '#3fa34d' },
    cape: { color: '#3f6a3a' }, held: { style: 'bow', color: '#8a5a33', glow: null } }),
  mo: humanoid({ build: 'b', size: 0.9, skin: '#d9a27a', hair: { style: 'curly', color: '#8a5a33' },
    outfit: fit('apron', '#a86a3a', '#f4e3c4', '#e8503c'), hat: { style: 'straw', color: '#e8c870' },
    held: { style: 'lantern', color: '#6b4423', glow: '#ffe680' } }),
  kai: humanoid({ build: 'a', skin: '#6b4430', hair: { style: 'spiky', color: '#1a1a1a' },
    outfit: fit('vest', '#e8c870', '#3d5aa8', '#ffffff'), hat: { style: 'cap', color: '#3d5aa8' },
    held: { style: 'spear', color: '#c98c50', glow: null } }),
  wren: humanoid({ build: 'b', skin: '#f0c8a0', hair: { style: 'braids', color: '#c4622d' },
    outfit: fit('tunic', '#e8a0b0', '#6a8a3a', '#ffffff'), hat: { style: 'bandana', color: '#6a8a3a' },
    held: { style: 'book', color: '#3fa34d', glow: null } }),
  // enemies (humanoid)
  hexguard: humanoid({ build: 'a', size: 1.15, skin: '#9e8cc4', hair: { style: 'bald', color: '#3d1f5c' },
    outfit: fit('plate', '#8a6ac4', '#3d1f5c', '#ffcf4a'), hat: { style: 'horned', color: '#5b2a86' },
    held: { style: 'sword_shield', color: '#c9b6ff', glow: '#c86bff' } }),
  goblin: humanoid({ build: 'b', size: 0.8, skin: '#7fbf5a', hair: { style: 'spiky', color: '#3a2618' }, ears: 'pointed',
    outfit: fit('leather', '#a86a3a', '#5a3a22', '#ffd24a'), hat: { style: 'bandana', color: '#e8503c' },
    held: { style: 'daggers', color: '#c0c4cc', glow: null } }),
};
