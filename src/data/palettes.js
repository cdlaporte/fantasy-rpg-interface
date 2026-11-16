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
// round 3 biome palettes (package B). `edge` picks the scenery beyond the map in both renderers
// (dunes | ocean | mountains | sky; absent = the tree canopy). Never dark: these are sunny holiday places.
Object.assign(PALETTES, {
  // Sunscorch Dunes: warm golden sand, terracotta sandstone, turquoise oasis water, dry golden grass
  dunes: {
    id: 'dunes', edge: 'dunes', bg: '#e0b070', sky: '#ffe9c4', fog: '#ffe6c0', light: '#fff2d8',
    patterns: {
      sand: { a: '#f6d68e', b: '#e8c172', side: '#d6a45e' },
      wet_sand: { a: '#e8c482', b: '#d8ae6a', side: '#c49656' },
      dirt: { a: '#e2a46a', b: '#cf8c56', side: '#b87446' },
      path: { a: '#f8e2b0', b: '#ecd096', side: '#d8b47a' },
      cobble: { a: '#f0d29c', b: '#dcb67e', side: '#c49a66' },
      cliff: { a: '#eab47a', b: '#d69860', side: '#c87a4a' },
      brick: { a: '#e0905e', b: '#c8744a', side: '#b0603c' },
      grass: { a: '#9cd46a', b: '#86c458', side: '#6aa846' },
      flowers: { a: '#9cd46a', b: '#ff8fb8', side: '#ffe066' },
      tallgrass: { a: '#dcc86a', b: '#efdc86', side: '#c4ae52' },
      hedge: { a: '#6cbf5a', b: '#58a84a', side: '#4a903e' },
      trees: { a: '#5cc060', b: '#46a64e', side: '#a8764a' },
      water: { a: '#2fc4d4', b: '#6ee0e6', side: '#2398b0' },
      shallows: { a: '#86ecdf', b: '#b2f6ec', side: '#66d2c8' },
      planks: { a: '#d8a066', b: '#c08650', side: '#9a6a3e' },
      starfloor: { a: '#4f7ab8', b: '#ffe680', side: '#3a5c94' },
    },
  },
  // Gullwing Cove: pale sand, turquoise / teal sea, coral pink, sea-grass greens, sun-bleached pier planks
  cove: {
    id: 'cove', edge: 'ocean', bg: '#2fb4c8', sky: '#c8f0ff', fog: '#d8f4ff', light: '#fff8e8',
    patterns: {
      sand: { a: '#fbeec6', b: '#efdcaa', side: '#dcc48e' },
      wet_sand: { a: '#e8d4a0', b: '#d8c08a', side: '#c4aa74' },
      water: { a: '#24b4c8', b: '#58d6e0', side: '#1a90a8' },
      shallows: { a: '#7ae8e0', b: '#a8f6ee', side: '#58d0cc' },
      grass: { a: '#92d872', b: '#7ec660', side: '#64ac4a' },
      flowers: { a: '#92d872', b: '#ff9ab8', side: '#fff07a' },
      tallgrass: { a: '#a6d46c', b: '#c4e686', side: '#86b852' },
      path: { a: '#f4e2b4', b: '#e6cf98', side: '#d0b47e' },
      dirt: { a: '#d8b080', b: '#c49a6a', side: '#a88256' },
      cobble: { a: '#dcd8cc', b: '#c4beb0', side: '#aaa496' },
      planks: { a: '#d8ac78', b: '#bf9060', side: '#946a44' },
      cliff: { a: '#c4bcb2', b: '#aaa298', side: '#948c84' },
      hedge: { a: '#58b060', b: '#46984e', side: '#3a8242' },
      trees: { a: '#4ab85c', b: '#38a04c', side: '#9a6a43' },
      brick: { a: '#e8907a', b: '#d07462', side: '#b8604e' },
      starfloor: { a: '#3a8ab0', b: '#fff0a0', side: '#2a6a90' },
    },
  },
  // Frostwhistle Peaks: bright white-blue snow, ice cyan, evergreen pines, blue-grey rock; sparkly, not grim
  peaks: {
    id: 'peaks', edge: 'mountains', bg: '#cfe0f4', sky: '#d6f0ff', fog: '#eaf6ff', light: '#f4fbff',
    patterns: {
      snow: { a: '#dfeaf7', b: '#cad9ec', side: '#a8bedc' },
      ice: { a: '#b8ecff', b: '#e4faff', side: '#86cbee' },
      sand: { a: '#dce8f6', b: '#c8d7ea', side: '#a8bcd8' },       // sand tiles read as packed snow here
      wet_sand: { a: '#dce8f6', b: '#c8d8ec', side: '#aac0dc' },
      cloud: { a: '#ffffff', b: '#e8f2ff', side: '#c8daf0' },
      grass: { a: '#a8dc9a', b: '#92cc88', side: '#76b070' },     // alpine meadow
      flowers: { a: '#a8dc9a', b: '#b8a8ff', side: '#ffffff' },
      tallgrass: { a: '#8cc890', b: '#b2e0b0', side: '#6aa874' },
      path: { a: '#ecf2fa', b: '#dbe5f2', side: '#b2c4dc' },
      dirt: { a: '#cdbcac', b: '#b8a696', side: '#9c8a7a' },
      cobble: { a: '#d6dce8', b: '#bcc4d4', side: '#a2acbe' },
      cliff: { a: '#e8f0fa', b: '#d0dcec', side: '#94a6c4' },
      hedge: { a: '#3a9a78', b: '#2e8466', side: '#256e56' },
      trees: { a: '#2f9670', b: '#24805e', side: '#7a5233' },
      water: { a: '#5cc4f0', b: '#8ad8f6', side: '#3aa0d0' },
      shallows: { a: '#a8eaf8', b: '#ccf4fc', side: '#86d6ec' },
      crystal: { a: '#bfeeff', b: '#e6f8ff', side: '#86c8ee' },
      planks: { a: '#c8905a', b: '#ae7846', side: '#8a5a33' },
      brick: { a: '#d88a6a', b: '#c07056', side: '#a65c46' },
      starfloor: { a: '#5a7ac8', b: '#ffffff', side: '#4a62a8' },
    },
  },
  // Aether Gardens: pastel lavender, peach, mint; starry rune floors, soft clouds, open sky below
  aether: {
    id: 'aether', edge: 'sky', bg: '#d8ccf6', sky: '#cfd6ff', fog: '#ece6ff', light: '#fff4fa',
    patterns: {
      cloud: { a: '#ffffff', b: '#ece4ff', side: '#cfc2f0' },
      sky: { a: '#cfd6ff', b: '#ffffff', side: '#b8a8e0' },
      starfloor: { a: '#7a6ad0', b: '#fff2a8', side: '#5a4cae' },
      grass: { a: '#ace8a6', b: '#96da94', side: '#7cc07c' },
      flowers: { a: '#ace8a6', b: '#ffb8e0', side: '#fff0a0' },
      tallgrass: { a: '#96dcb0', b: '#c0f0c8', side: '#76c094' },
      path: { a: '#ffdcc0', b: '#f6c8a8', side: '#e0ac8c' },
      dirt: { a: '#e8c0b0', b: '#d6a898', side: '#bc8e80' },
      cobble: { a: '#e2d8f6', b: '#cbbfe8', side: '#b0a2d4' },
      cliff: { a: '#c8b8ec', b: '#b0a0dc', side: '#9a88c8' },
      crystal: { a: '#c9b8ff', b: '#ffd0f0', side: '#a088e8' },
      hedge: { a: '#9ad8c0', b: '#84c8ac', side: '#6cb094' },
      trees: { a: '#b8a0ec', b: '#a088dc', side: '#9a7ac0' },
      water: { a: '#8ad0ff', b: '#b4e4ff', side: '#6cb0e8' },
      shallows: { a: '#bdeaff', b: '#dcf6ff', side: '#9ad4f0' },
      planks: { a: '#e8c098', b: '#d4a67c', side: '#b48860' },
      brick: { a: '#e8a8c0', b: '#d490ac', side: '#bc7896' },
      sand: { a: '#fff0d8', b: '#f6e0c0', side: '#e0c8a4' },
    },
  },
});

export function resolvePalette(id) { return PALETTES[id] || PALETTES.default; }
