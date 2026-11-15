// Tile defs; array index = tile number stored in zone.tiles. Keep index 0 = grass (the mapgen fallback).
// {id, solid, shape: flat|block|water|pit, h, pattern, colors: {a, b, side}}

const T = (id, pattern, shape, solid, h, a, b, side) => ({ id, solid, shape, h, pattern, colors: { a, b, side: side || b } });

export default [
  T('grass', 'grass', 'flat', false, 0, '#7cc95a', '#69b84c'),
  T('flowers', 'flowers', 'flat', false, 0, '#7cc95a', '#ff8fc7', '#ffe066'),
  T('tallgrass', 'tallgrass', 'flat', false, 0, '#5fb548', '#86d667'),
  T('dirt', 'dirt', 'flat', false, 0, '#c99a62', '#b5864f'),
  T('path', 'path', 'flat', false, 0, '#e8cf94', '#d6b97a'),
  T('cobble', 'cobble', 'flat', false, 0, '#c4c0b6', '#a9a49a'),
  T('sand', 'sand', 'flat', false, 0, '#f4e3a4', '#e8d28a'),
  T('wet_sand', 'wet_sand', 'flat', false, 0, '#d9c587', '#c7b170'),
  T('shallows', 'shallows', 'water', false, 0, '#7fe0e6', '#a8eef0'),
  T('water', 'water', 'water', true, 0, '#3fa9e8', '#68c4f2'),
  T('planks', 'planks', 'flat', false, 0, '#c98c50', '#b0743d'),
  T('stone', 'stone', 'flat', false, 0, '#b9bccb', '#a3a7b8'),
  T('carpet', 'carpet', 'flat', false, 0, '#c8506a', '#e0c060'),
  T('brick', 'brick', 'block', true, 2, '#d47a5a', '#b8634a', '#a3553f'),
  T('hedge', 'hedge', 'block', true, 1, '#3f9e4a', '#2f8a3c', '#2a7a35'),
  T('trees', 'trees', 'block', true, 2, '#2f9a48', '#23803a', '#7a5233'),
  T('cliff', 'cliff', 'block', true, 1.5, '#a8957a', '#8c7a62', '#7a6a55'),
  T('crystal', 'crystal', 'block', true, 1, '#9fe6ff', '#c9a6ff', '#7fc4f0'),
  T('cloud', 'cloud', 'flat', false, 0, '#ffffff', '#e6f0ff'),
  T('starfloor', 'starfloor', 'flat', false, 0, '#3d3a8c', '#ffe680'),
  T('wall', 'stone', 'block', true, 2, '#cfd2dc', '#b4b8c6', '#9a9eae'),
  // --- additions by World (append only; never reorder) ---
  T('palisade', 'planks', 'block', true, 1.5, '#b0743d', '#8a5a33', '#7a4e2c'),
  T('rune_floor', 'starfloor', 'flat', false, 0, '#8f88b8', '#c9a6ff'),
  T('mossy_stone', 'stone', 'flat', false, 0, '#a9b8a0', '#8fa58a'),
];
