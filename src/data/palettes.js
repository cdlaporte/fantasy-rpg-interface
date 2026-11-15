// LAPORTE: exact colors from studyHallSim (do not change). PALETTES: resolved zone palettes
// {id, bg (void/background), sky (3D clear color), fog?, light?, patterns: {pattern: {a, b, side}}} recoloring tile patterns.
// Renderers use palette.patterns[def.pattern] over def.colors when present. Note that `wall` shares the `stone`
// pattern, so no palette overrides `stone` (it would make floors and walls identical).

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
  default: { id: 'default', bg: '#2a3a4a', sky: '#bfe6ff', fog: '#bfe6ff', light: '#fff6e6', patterns: {} },
  // country road at dawn: fresh meadow greens, golden path, clear stream
  intro: {
    id: 'intro', bg: '#2f4a32', sky: '#d6ecff', fog: '#e6f2ff', light: '#fff1d6',
    patterns: {
      grass: { a: '#8bd166', b: '#79c257', side: '#5fa844' },
      flowers: { a: '#8bd166', b: '#ff9ccf', side: '#fff07a' },
      tallgrass: { a: '#6cbd4e', b: '#9ade72', side: '#4f9a3a' },
      path: { a: '#ecd49a', b: '#d9bd80', side: '#c4a468' },
      dirt: { a: '#cfa36c', b: '#b98b55', side: '#a07646' },
      hedge: { a: '#45a650', b: '#348f40', side: '#2c7c37' },
      trees: { a: '#3aa552', b: '#2b8c42', side: '#7a5233' },
      water: { a: '#4fb6ee', b: '#7fd0f6', side: '#3a90c8' },
      shallows: { a: '#8fe6ea', b: '#b8f2f2', side: '#6fcfd8' },
      planks: { a: '#d09458', b: '#b67c44', side: '#8a5a33' },
    },
  },
  // warm college town: honey cobbles, sun-warmed grass, terracotta brick
  town: {
    id: 'town', bg: '#3a3a2a', sky: '#bfe6ff', fog: '#f2e6d0', light: '#fff0d0',
    patterns: {
      grass: { a: '#8fd26a', b: '#7cc258', side: '#62a846' },
      flowers: { a: '#8fd26a', b: '#ff8fb8', side: '#ffe066' },
      tallgrass: { a: '#78c45a', b: '#a2dc78', side: '#5aa040' },
      cobble: { a: '#d8ccb4', b: '#bfb197', side: '#a8987c' },
      path: { a: '#efd8a0', b: '#dcc086', side: '#c8a86c' },
      brick: { a: '#d98a62', b: '#c06e4c', side: '#a65a3e' },
      hedge: { a: '#4aa652', b: '#3a9044', side: '#2f7c39' },
      trees: { a: '#3fa955', b: '#2f9046', side: '#7a5233' },
      water: { a: '#48aee8', b: '#78cbf4', side: '#3a8cc4' },
      shallows: { a: '#8ee4ea', b: '#b6f0f0', side: '#6ccad4' },
      planks: { a: '#d09458', b: '#b67c44', side: '#8a5a33' },
      dirt: { a: '#d2a872', b: '#bd905a', side: '#a47a48' },
      starfloor: { a: '#5a4fa8', b: '#ffe680', side: '#3d3a8c' },
    },
  },
  // academy interior: warm oak planks, royal carpet, cool flagstones; the yard keeps sunny grass
  academy: {
    id: 'academy', bg: '#2a2a44', sky: '#d8d0ff', fog: '#e8e0f8', light: '#fff4e0',
    patterns: {
      planks: { a: '#c48a52', b: '#a8703e', side: '#7a4e2c' },
      carpet: { a: '#3d5aa8', b: '#ffd24a', side: '#2c4280' },
      grass: { a: '#86cf62', b: '#74bf52', side: '#5aa540' },
      dirt: { a: '#d6b07c', b: '#c09864', side: '#a88050' },
      sand: { a: '#f2e2b0', b: '#e4d098', side: '#d0ba80' },
      hedge: { a: '#45a650', b: '#348f40', side: '#2c7c37' },
      water: { a: '#5ab8ec', b: '#86d2f4', side: '#3a90c8' },
    },
  },
  // Whisperwood: lush and dappled, never gloomy: bright canopy, mossy floor, sunlit clearings
  forest: {
    id: 'forest', bg: '#1f3a28', sky: '#c4f0d0', fog: '#cdeed6', light: '#fff6d8',
    patterns: {
      grass: { a: '#66bd4c', b: '#56ab3f', side: '#3f8e30' },
      flowers: { a: '#66bd4c', b: '#ffa3d6', side: '#fff07a' },
      tallgrass: { a: '#4fa83f', b: '#79c95a', side: '#3a8a2e' },
      dirt: { a: '#b88f5c', b: '#a37a4a', side: '#8a663c' },
      path: { a: '#d9bf86', b: '#c6a970', side: '#ad905a' },
      trees: { a: '#2f9a46', b: '#24803a', side: '#6e4a2c' },
      hedge: { a: '#3a9c48', b: '#2d863b', side: '#256f31' },
      water: { a: '#3fb0d8', b: '#6ccae6', side: '#2f8cb4' },
      shallows: { a: '#86dfd6', b: '#b0eee4', side: '#62c4bc' },
      cliff: { a: '#a89a7e', b: '#8f8268', side: '#776b56' },
      sand: { a: '#e8d8a0', b: '#d8c488', side: '#c4ae72' },
      wet_sand: { a: '#cbb982', b: '#b8a46c', side: '#a08e5a' },
      starfloor: { a: '#4a5aa8', b: '#c9ffe6', side: '#3a4a8c' },
    },
  },
};

/** Resolve a palette id to a palette object (default when missing). */
export function resolvePalette(id) { return PALETTES[id] || PALETTES.default; }
