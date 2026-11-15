// STUB: replaced by the Content package (working starter by the skeleton)
// buildZoneGrid(zoneDef, tileIndexById) -> {w, h, tiles: Uint8Array, variant: Uint8Array, props: []}
// Deterministic from zoneDef.seed. `tiles` form: one char per tile. `macro` form: each char -> cell x cell tiles
// (the starter just scales cells up; scattering decoration props is left to Content).
import { hash2 } from '../../core/rng.js';

export function buildZoneGrid(zoneDef, tileIndexById) {
  const seed = zoneDef.seed | 0;
  const src = zoneDef.tiles || zoneDef.macro;
  if (!src) throw new Error('buildZoneGrid: zone ' + zoneDef.id + ' has neither tiles nor macro');
  const cell = zoneDef.tiles ? 1 : (zoneDef.macro.cell || 4);
  const rows = src.rows;
  const legend = src.legend || {};
  const cw = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const w = cw * cell, h = rows.length * cell;
  const tiles = new Uint8Array(w * h);
  const variant = new Uint8Array(w * h);
  for (let cy = 0; cy < rows.length; cy++) {
    const row = rows[cy];
    for (let cx = 0; cx < cw; cx++) {
      const id = legend[row[cx]];
      const n = id !== undefined && tileIndexById[id] !== undefined ? tileIndexById[id] : 0;
      for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) {
        tiles[(cy * cell + dy) * w + cx * cell + dx] = n;
      }
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) variant[y * w + x] = hash2(x, y, seed);
  return { w, h, tiles, variant, props: [] };
}
