// World data: zone validation (tools/validate-data.mjs), mapgen guarantees, stable tile ids, palettes.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../../src/data/index.js';
import { buildZoneGrid, furnitureRect } from '../../src/data/zones/mapgen.js';
import { PROP_MODELS } from '../../src/data/props.js';
import { LAPORTE, PALETTES, resolvePalette } from '../../src/data/palettes.js';
import { validateAll, flood, ZONE_IDS } from '../../tools/validate-data.mjs';
import { createRng } from '../../src/core/rng.js';

test('every zone validates without errors', () => {
  const { errors } = validateAll();
  assert.deepEqual(errors, []);
});

test('tile ids keep their order (index 0 = grass) and the starter list is a prefix', () => {
  const ids = data.tiles.list.map((t) => t.id);
  assert.deepEqual(ids.slice(0, 21), ['grass', 'flowers', 'tallgrass', 'dirt', 'path', 'cobble', 'sand', 'wet_sand', 'shallows', 'water',
    'planks', 'stone', 'carpet', 'brick', 'hedge', 'trees', 'cliff', 'crystal', 'cloud', 'starfloor', 'wall']);
  assert.ok(ids.length < 256);
});

test('props use only contract models; palettes keep LAPORTE and resolve', () => {
  for (const p of Object.values(data.props)) {
    assert.ok(PROP_MODELS.includes(p.model), p.id);
    assert.equal(typeof p.solid, 'boolean');
    assert.ok(p.footprint === null || (p.footprint.length === 2 && p.footprint[0] > 0 && p.footprint[1] > 0), p.id);
  }
  assert.deepEqual(LAPORTE.quarterZipNavy, ['#24395e', '#1a2a47']);
  assert.equal(LAPORTE.shoes, '#111111');
  for (const id of ZONE_IDS) assert.ok(PALETTES[data.zones[id].palette], id);
  assert.equal(resolvePalette('nope').id, 'default');
});

test('mapgen is deterministic, and the tiles form maps legend chars 1:1', () => {
  for (const id of ZONE_IDS) {
    const a = buildZoneGrid(data.zones[id], data.tiles.index), b = buildZoneGrid(data.zones[id], data.tiles.index);
    assert.deepEqual(a.tiles, b.tiles, id);
    assert.deepEqual(a.props, b.props, id);
  }
  const t = data.zones.test;
  const g = buildZoneGrid(t, data.tiles.index);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    assert.equal(data.tiles.list[g.tiles[y * g.w + x]].id, t.tiles.legend[t.tiles.rows[y][x]]);
  }
});

test('macro build of the forest is fast (< 30 ms warm)', () => {
  const z = data.zones.forest;
  buildZoneGrid(z, data.tiles.index);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 5; i++) buildZoneGrid(z, data.tiles.index);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 5;
  assert.ok(ms < 30, ms + ' ms');
});

test('furnitureRect centers {at, w, h} on the marker', () => {
  const m = { a: [10, 5] };
  assert.deepEqual(furnitureRect({ at: 'a', w: 3, h: 1 }, m), [9, 5, 3, 1]);
  assert.deepEqual(furnitureRect({ at: 'a', w: 1, h: 3 }, m), [10, 4, 1, 3]);
  assert.deepEqual(furnitureRect({ area: [1, 2, 3, 4] }, m), [1, 2, 3, 4]);
});

// Property test: random macro grids. Walkable macro cells that are 4-connected in the macro must be connected at
// tile level; cells in different macro components must stay separated (1-cell walls do not leak).
test('macro connectivity guarantees hold on random grids', () => {
  const rng = createRng(99);
  const solidCh = { '#': true, '~': true, R: true };
  for (let round = 0; round < 25; round++) {
    const cw = 14, ch = 12;
    const rows = [];
    for (let y = 0; y < ch; y++) {
      let r = '';
      for (let x = 0; x < cw; x++) r += rng.pick(['.', '.', 'w', 'w', 'p', '#', '#', '~', 'R', 'g']);
      rows.push(r);
    }
    const zone = { id: 'rnd', seed: 1000 + round, macro: { cell: 4, rows, shore: { beach: 'sand' }, legend: {
      '.': { tile: 'grass', mix: [['flowers', 0.2, 3]] }, '#': 'trees', '~': 'water', R: 'cliff',
      w: { tile: 'grass', deco: { tree: 0.3, bush: 0.1, flowerbed: 0.05 }, fringe: { tree: 0.6 } },
      g: { tile: 'tallgrass', deco: { rock: 0.2 } }, p: { tile: 'path', path: true, under: 'grass' } } }, markers: {} };
    const g = buildZoneGrid(zone, data.tiles.index);
    const W = g.w, H = g.h;
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solid[i] = data.tiles.list[g.tiles[i]].solid ? 1 : 0;
    for (const p of g.props) { const d = data.props[p.kind]; if (d.solid && d.footprint) solid[p.y * W + p.x] = 1; }
    // macro components
    const comp = new Int32Array(cw * ch).fill(-1);
    let nc = 0;
    for (let i = 0; i < cw * ch; i++) {
      if (comp[i] >= 0 || solidCh[rows[(i / cw) | 0][i % cw]]) continue;
      const st = [i]; comp[i] = nc;
      while (st.length) {
        const k = st.pop(), x = k % cw, y = (k / cw) | 0;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const j = ny * cw + nx;
          if (comp[j] < 0 && !solidCh[rows[ny][nx]]) { comp[j] = nc; st.push(j); }
        }
      }
      nc++;
    }
    // a representative open tile of each walkable cell (decoration may stand on single core tiles)
    const center = (i) => {
      const cx = i % cw, cy = (i / cw) | 0;
      for (const [dx, dy] of [[1, 1], [2, 1], [1, 2], [2, 2], [0, 1], [3, 1], [1, 0], [1, 3], [0, 0], [3, 3], [0, 3], [3, 0]]) {
        if (!solid[(cy * 4 + dy) * W + cx * 4 + dx]) return [cx * 4 + dx, cy * 4 + dy];
      }
      return [cx * 4 + 1, cy * 4 + 1];
    };
    const fills = new Map();
    for (let i = 0; i < cw * ch; i++) {
      if (comp[i] < 0) continue;
      const [x, y] = center(i);
      assert.equal(solid[y * W + x], 0, `round ${round}: cell core blocked`);
      if (!fills.has(comp[i])) fills.set(comp[i], flood(W, H, solid, x, y));
      const f = fills.get(comp[i]);
      for (let j = 0; j < cw * ch; j++) {
        if (comp[j] < 0) continue;
        const [x2, y2] = center(j);
        assert.equal(!!f[y2 * W + x2], comp[j] === comp[i], `round ${round}: cells ${i} and ${j} connectivity`);
      }
    }
  }
});
