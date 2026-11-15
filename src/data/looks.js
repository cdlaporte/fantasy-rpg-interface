// STUB: replaced by the Content package (starter content by the skeleton)
import { LAPORTE } from './palettes.js';

const base = (build, skin, hair, outfit) => ({
  rig: 'humanoid', build, size: 1, skin, hair, facial: 'none', outfit, hood: false, hat: null, cape: null,
  held: null, aura: null, ears: 'round', hero: null,
});

/** Two player bases: ambiguous ethnicity, medium-brown skin, never labeled. */
export const PLAYER_LOOKS = [
  base('a', '#b07850', { style: 'short', color: '#3a2618' }, { style: 'tunic', primary: '#4a90d9', secondary: '#f4e3c4', accent: '#ffd24a' }),
  base('b', '#a8714a', { style: 'ponytail', color: '#2e1e14' }, { style: 'tunic', primary: '#4fb87a', secondary: '#f4e3c4', accent: '#ffd24a' }),
];

/** Patch applied over a player look for the hooded intro. */
export const CLOAKED = { outfit: { style: 'cloak', primary: '#6a5a8a', secondary: '#4a3e66', accent: '#c9b6ff' }, hood: true, cape: null, hat: null };

/** Class outfits (look patches) keyed by class/spec id; filled by Content/Class kits. */
export const CLASS_OUTFITS = {};

export const LAPORTE_LOOK = {
  rig: 'humanoid', build: 'a', size: 1.05, skin: LAPORTE.skin[0],
  hair: { style: 'm_hairline', color: LAPORTE.hair[0] }, facial: 'none',
  outfit: { style: 'quarterzip', primary: LAPORTE.quarterZipNavy[0], secondary: LAPORTE.quarterZipGray[0], accent: LAPORTE.collar },
  hood: false, hat: null, cape: null, held: null, aura: null, ears: 'round', hero: 'laporte',
};
