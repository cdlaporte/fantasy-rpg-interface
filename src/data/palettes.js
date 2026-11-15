// STUB: replaced by the Content package (starter content by the skeleton)
// LAPORTE: exact colors from studyHallSim. PALETTES: zone palettes
// {id, bg (void/background), sky (3D clear color), patterns: {pattern: {a, b, side}}} recoloring tile patterns.

export const LAPORTE = {
  hair: ['#6b4423', '#8b5a2b', '#4a2e17'],
  skin: ['#f6cfa6', '#e2ae88'],
  stubble: ['#a07a5e', '#b88f70'],
  quarterZipNavy: ['#24395e', '#1a2a47'],
  quarterZipGray: ['#8f9399', '#6e7277'],
  collar: '#a3a7ad',
  undershirt: '#ecf0f1',
  pants: '#3b3b58',
  shoes: '#111111',
};

export const PALETTES = {
  default: { id: 'default', bg: '#2a3a4a', sky: '#bfe6ff', patterns: {} },
  intro: { id: 'intro', bg: '#2a3a4a', sky: '#cfe8ff', patterns: {} },
  town: { id: 'town', bg: '#2a3a4a', sky: '#bfe6ff', patterns: { grass: { a: '#86d064', b: '#74c054' } } },
  academy: { id: 'academy', bg: '#2a2a44', sky: '#d8d0ff', patterns: {} },
  forest: { id: 'forest', bg: '#1f3326', sky: '#c4f0d0', patterns: { grass: { a: '#5fb548', b: '#4fa53c' } } },
};

/** Resolve a palette id to a palette object (default when missing). */
export function resolvePalette(id) { return PALETTES[id] || PALETTES.default; }
