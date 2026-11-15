// Zone grid builder (CONTRACTS 13a). Pure, deterministic from zoneDef.seed, no allocation-sensitive hot path
// (runs once per zone load; < 10 ms for 96x96 on a dev machine).
//
// buildZoneGrid(zoneDef, tileIndexById) -> {w, h, tiles: Uint8Array, variant: Uint8Array, props: [{kind, x, y, deco: true}]}
//
// Two source forms:
//   tiles: {rows, legend, paint?, decoClear?}             one char = one tile
//   macro: {cell, rows, legend, warp?, warpBig?, shore?, paint?, filler?, decoClear?}   one char = cell x cell tiles
//
// A legend value is either a tile id string, or an object (see docs/notes/world.md):
//   {tile, mix: [[tileId, frac, scale]], deco: {propKind: density}, fringe: {propKind: density}, path: true, under: tileId, width}
//   - mix: noise patches of another tile (same solidity class as `tile`), `frac` 0..1 of the area, `scale` in tiles.
//   - deco: per-tile probability of scattering a decoration prop (clumped by low-frequency noise).
//   - fringe: like deco, for tiles that touch a solid tile (ragged tree lines along walls); no spacing rule.
//   - path (macro only): the cell is filled with `under`; a meandering ribbon of `tile`, `width` tiles wide,
//     joins the jittered centers of 4-adjacent path cells (and runs to the map edge from edge cells).
//
// Guarantees (macro form): every walkable macro cell keeps its 2x2 core; 4-adjacent walkable cells are joined by
// a carved 2-wide corridor; a 1-cell solid wall keeps a 2-tile-thick solid band (no leaks); walkable pockets that
// do not contain a cell center are filled; decoration never disconnects walkable tiles (simple-point test), never
// lands on paths, markers (+decoClear), exits, gates, chests, or within 1 tile of an authored prop.
import { hash2 } from '../../core/rng.js';
import TILE_LIST from '../tiles.js';
import PROPS from '../props.js';

const SOLID = TILE_LIST.map((t) => !!t.solid);

/** Smooth value noise in [0,1], lattice spacing `scale` tiles. */
export function vnoise(x, y, scale, seed) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  let tx = fx - x0, ty = fy - y0;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty) / 255;
}

function fbm(x, y, scale, seed) {
  return vnoise(x, y, scale, seed) * 0.65 + vnoise(x, y, scale * 0.45, seed + 101) * 0.35;
}

/**
 * Tile rectangle of a zone furniture entry ({area: [x,y,w,h]} or {at: marker, w, h}), centered on the marker:
 * x0 = mx - floor((w-1)/2), y0 = my - floor((h-1)/2). Returns [x, y, w, h] or null.
 */
export function furnitureRect(entry, markers) {
  if (!entry) return null;
  if (Array.isArray(entry.area)) return entry.area.slice(0, 4);
  const m = typeof entry.at === 'string' ? markers && markers[entry.at] : Array.isArray(entry.at) ? entry.at : null;
  if (!m) return null;
  const w = entry.w || 1, h = entry.h || 1;
  return [m[0] - Math.floor((w - 1) / 2), m[1] - Math.floor((h - 1) / 2), w, h];
}

function tileIdx(tileIndexById, id) {
  const n = tileIndexById[id];
  return n === undefined ? -1 : n;
}

function normalizeLegend(legend, tileIndexById) {
  const out = {};
  for (const ch of Object.keys(legend || {})) {
    const v = legend[ch];
    const o = typeof v === 'string' ? { tile: v } : v || {};
    let idx = tileIdx(tileIndexById, o.tile);
    if (idx < 0) idx = 0;
    const L = { ch, tile: o.tile, idx, path: !!o.path, width: o.width || 2.6, base: idx, mix: [], deco: [], decoTotal: 0 };
    if (o.path) { const u = tileIdx(tileIndexById, o.under || 'grass'); L.base = u < 0 ? 0 : u; }
    L.solid = SOLID[L.base];
    for (const m of o.mix || []) {
      const mi = tileIdx(tileIndexById, m[0]);
      if (mi >= 0 && SOLID[mi] === L.solid) L.mix.push({ idx: mi, frac: m[1] || 0.2, scale: m[2] || 5, thr: mixThreshold(m[1] || 0.2) });
    }
    const decoList = (src) => {
      const list = [];
      for (const kind of Object.keys(src || {})) {
        const pd = PROPS[kind];
        const p = +src[kind] || 0;
        if (!pd || p <= 0) continue;
        list.push({ kind, p, solid: !!(pd.solid && pd.footprint), w: pd.footprint ? pd.footprint[0] : 1, h: pd.footprint ? pd.footprint[1] : 1 });
      }
      return list;
    };
    L.deco = decoList(o.deco);
    L.fringe = decoList(o.fringe);
    L.decoTotal = L.deco.length + L.fringe.length;
    out[ch] = L;
  }
  return out;
}

const DEFAULT_L = { ch: '?', idx: 0, base: 0, solid: false, path: false, mix: [], deco: [], fringe: [], decoTotal: 0 };

// fbm quantiles (measured once, deterministic) so that `frac` in mix specs means "fraction of the area"
const FBM_Q = (() => {
  const s = [];
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) s.push(fbm(x * 1.7, y * 1.3, 4, 977));
  s.sort((a, b) => a - b);
  const q = new Float32Array(101);
  for (let k = 0; k <= 100; k++) q[k] = s[Math.min(s.length - 1, Math.floor((k / 100) * s.length))];
  return q;
})();
function mixThreshold(frac) { return FBM_Q[Math.max(0, Math.min(100, Math.round((1 - frac) * 100)))]; }

function mixTile(L, x, y, seed) {
  let t = L.base;
  for (let i = 0; i < L.mix.length; i++) {
    const m = L.mix[i];
    if (fbm(x, y, m.scale, seed + 211 + i * 37) > m.thr) t = m.idx;
  }
  return t;
}

export function buildZoneGrid(zoneDef, tileIndexById) {
  const seed = zoneDef.seed | 0;
  const src = zoneDef.tiles || zoneDef.macro;
  if (!src) throw new Error('buildZoneGrid: zone ' + zoneDef.id + ' has neither tiles nor macro');
  const macro = !zoneDef.tiles;
  const cell = macro ? (src.cell || 4) : 1;
  const rows = src.rows;
  const legend = normalizeLegend(src.legend, tileIndexById);
  const cw = rows.reduce((m, r) => Math.max(m, r.length), 0), ch = rows.length;
  const w = cw * cell, h = ch * cell, N = w * h;
  const tiles = new Uint8Array(N);
  const variant = new Uint8Array(N);
  const reg = new Array(N);             // legend entry that owns each tile (mix/deco lookups)
  const reserved = new Uint8Array(N);   // 1 = no decoration here
  const isPath = new Uint8Array(N);
  const cellL = (cx, cy) => legend[(rows[cy] || '')[cx]] || DEFAULT_L;

  if (!macro) {
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const L = legend[row[x]] || DEFAULT_L;
        const i = y * w + x;
        reg[i] = L;
        tiles[i] = L.mix.length ? mixTile(L, x, y, seed) : L.idx;
      }
    }
  } else {
    // 1. domain-warped expansion. The small warp (< 1 tile for cell 4) can flip only the outer ring of a cell, so
    // cores and 2-thick bands survive; the big warp is used only where it does not change walkability.
    const amp = src.warp !== undefined ? src.warp : Math.max(0.45, cell / 2 - 1.05);
    const ampBig = src.warpBig !== undefined ? src.warpBig : cell * 0.6;
    for (let y = 0; y < h; y++) {
      const ocy = (y / cell) | 0;
      for (let x = 0; x < w; x++) {
        const ocx = (x / cell) | 0;
        const wx = (fbm(x, y, 5, seed + 11) - 0.5) * 2, wy = (fbm(x, y, 5, seed + 23) - 0.5) * 2;
        const own = cellL(ocx, ocy);
        const bx = Math.min(cw - 1, Math.max(0, Math.floor((x + 0.5 + wx * ampBig) / cell)));
        const by = Math.min(ch - 1, Math.max(0, Math.floor((y + 0.5 + wy * ampBig) / cell)));
        let L = cellL(bx, by);
        if (L.solid !== own.solid) {
          const sx = Math.min(cw - 1, Math.max(0, Math.floor((x + 0.5 + wx * amp) / cell)));
          const sy = Math.min(ch - 1, Math.max(0, Math.floor((y + 0.5 + wy * amp) / cell)));
          L = cellL(sx, sy);
        }
        const i = y * w + x;
        reg[i] = L;
        tiles[i] = L.mix.length ? mixTile(L, x, y, seed) : L.base;
      }
    }
    // 2. path ribbons between jittered centers of 4-adjacent path cells
    const jit = Math.min(1, cell / 4);
    const centerX = (cx, cy) => cx * cell + cell / 2 + ((hash2(cx, cy, seed + 5) - 128) / 128) * jit;
    const centerY = (cx, cy) => cy * cell + cell / 2 + ((hash2(cx, cy, seed + 7) - 128) / 128) * jit;
    const stroke = (L, x0, y0, x1, y1) => {
      const r0 = L.width / 2;
      const minx = Math.max(0, Math.floor(Math.min(x0, x1) - r0 - 1)), maxx = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + r0 + 1));
      const miny = Math.max(0, Math.floor(Math.min(y0, y1) - r0 - 1)), maxy = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + r0 + 1));
      const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        let t = ((px - x0) * dx + (py - y0) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - (x0 + dx * t), ey = py - (y0 + dy * t);
        const r = r0 + (vnoise(x, y, 3, seed + 41) - 0.5) * 0.9;
        if (ex * ex + ey * ey <= r * r) { const i = y * w + x; tiles[i] = L.idx; isPath[i] = 1; reserved[i] = 1; }
      }
    };
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      const L = cellL(cx, cy);
      if (!L.path) continue;
      const ax = centerX(cx, cy), ay = centerY(cx, cy);
      let linked = false;
      if (cx + 1 < cw && cellL(cx + 1, cy).path) { stroke(L, ax, ay, centerX(cx + 1, cy), centerY(cx + 1, cy)); linked = true; }
      if (cy + 1 < ch && cellL(cx, cy + 1).path) { stroke(L, ax, ay, centerX(cx, cy + 1), centerY(cx, cy + 1)); linked = true; }
      if (cx > 0 && cellL(cx - 1, cy).path) linked = true;
      if (cy > 0 && cellL(cx, cy - 1).path) linked = true;
      if (cx === 0) { stroke(L, ax, ay, 0, ay); linked = true; }
      if (cx === cw - 1) { stroke(L, ax, ay, w, ay); linked = true; }
      if (cy === 0) { stroke(L, ax, ay, ax, 0); linked = true; }
      if (cy === ch - 1) { stroke(L, ax, ay, ax, h); linked = true; }
      if (!linked) stroke(L, ax, ay, ax + 0.01, ay);
    }
    // 3. carve 2-wide corridors between 4-adjacent walkable cells (repairs any border the warp closed)
    const carve = (x, y, fallback) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = y * w + x;
      if (!SOLID[tiles[i]]) return;
      const own = cellL((x / cell) | 0, (y / cell) | 0);
      const L = own.solid ? fallback : own;
      tiles[i] = L.base; reg[i] = L;
    };
    const c0 = Math.floor(cell / 2) - 1;
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      const A = cellL(cx, cy);
      if (A.solid) continue;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) carve(cx * cell + c0 + dx, cy * cell + c0 + dy, A);
      if (cx + 1 < cw && !cellL(cx + 1, cy).solid) {
        for (let x = cx * cell + c0; x <= (cx + 1) * cell + c0 + 1; x++) { carve(x, cy * cell + c0, A); carve(x, cy * cell + c0 + 1, A); }
      }
      if (cy + 1 < ch && !cellL(cx, cy + 1).solid) {
        for (let y = cy * cell + c0; y <= (cy + 1) * cell + c0 + 1; y++) { carve(cx * cell + c0, y, A); carve(cx * cell + c0 + 1, y, A); }
      }
    }
    // 4. shoreline: shallows on the water edge, a ragged beach on the land edge
    const shore = src.shore || {};
    const waterI = tileIdx(tileIndexById, 'water');
    const shalI = tileIdx(tileIndexById, shore.shallows || 'shallows');
    const beachI = shore.beach ? tileIdx(tileIndexById, shore.beach) : -1;
    if (waterI >= 0 && shore.shallows !== false && shalI >= 0) {
      const snap = tiles.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (snap[i] !== waterI) continue;
        const u = x % cell, v = y % cell, cc = Math.floor(cell / 2) - 1;
        const ocx = (x / cell) | 0, ocy = (y / cell) | 0;
        if (cellL(ocx, ocy).base === waterI) {
          // keep the water core and the 2-wide water band toward water neighbours, so a 1-cell stream stays a barrier
          const wet = (cx2, cy2) => cx2 >= 0 && cy2 >= 0 && cx2 < cw && cy2 < ch && cellL(cx2, cy2).base === waterI;
          const inU = u >= cc && u <= cc + 1, inV = v >= cc && v <= cc + 1;
          if ((inU && inV) || (inU && ((v < cc && wet(ocx, ocy - 1)) || (v > cc + 1 && wet(ocx, ocy + 1))))
            || (inV && ((u < cc && wet(ocx - 1, ocy)) || (u > cc + 1 && wet(ocx + 1, ocy))))) continue;
        }
        let land = false;
        for (let oy = -1; oy <= 1 && !land; oy++) for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const t = snap[ny * w + nx];
          if (t !== waterI && !SOLID[t]) { land = true; break; }
        }
        if (land && hash2(x, y, seed + 61) < (shore.chance !== undefined ? shore.chance : 0.8) * 256) tiles[i] = shalI;
      }
    }
    if (beachI >= 0) {
      const snap = tiles.slice();
      const chance = (shore.beachChance !== undefined ? shore.beachChance : 0.55) * 256;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, t = snap[i];
        if (SOLID[t] || t === shalI || isPath[i]) continue;
        const wet = (k) => snap[k] === waterI || snap[k] === shalI;
        if ((wet(i - 1) || wet(i + 1) || wet(i - w) || wet(i + w)) && hash2(x, y, seed + 67) < chance) tiles[i] = beachI;
      }
    }
  }

  // 5. paint ops (both forms): {rect:[x,y,w,h]} | {disc:[x,y,r]} | {at: marker, r} | {line:[x0,y0,x1,y1], width}
  // with {tile, reserve}. `reserve` keeps decoration off the painted tiles; omit `tile` to only reserve.
  const markers = zoneDef.markers || {};
  const paintOp = (op, fn) => {
    if (op.rect) {
      const [rx, ry, rw, rh] = op.rect;
      for (let y = Math.max(0, ry); y < Math.min(h, ry + rh); y++) for (let x = Math.max(0, rx); x < Math.min(w, rx + rw); x++) fn(y * w + x, x, y);
    } else if (op.disc || op.at) {
      let cx, cy, r;
      if (op.disc) { cx = op.disc[0] + 0.5; cy = op.disc[1] + 0.5; r = op.disc[2]; } else {
        const m = Array.isArray(op.at) ? op.at : markers[op.at];
        if (!m) return;
        cx = m[0] + 0.5; cy = m[1] + 0.5; r = op.r || 2;
      }
      const r0 = op.r0 || 0;
      for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(h - 1, Math.ceil(cy + r + 1)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(w - 1, Math.ceil(cx + r + 1)); x++) {
          const ex = x + 0.5 - cx, ey = y + 0.5 - cy, d2 = ex * ex + ey * ey;
          const rr = op.ragged ? r + (vnoise(x, y, 2.5, seed + 71) - 0.5) * op.ragged : r;
          if (d2 <= rr * rr && d2 >= r0 * r0) fn(y * w + x, x, y);
        }
      }
    } else if (op.line) {
      const [x0, y0, x1, y1] = op.line, rw = (op.width || 1) / 2;
      const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1;
      for (let y = Math.max(0, Math.floor(Math.min(y0, y1) - rw - 1)); y <= Math.min(h - 1, Math.ceil(Math.max(y0, y1) + rw + 1)); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(x0, x1) - rw - 1)); x <= Math.min(w - 1, Math.ceil(Math.max(x0, x1) + rw + 1)); x++) {
          let t = ((x - x0) * dx + (y - y0) * dy) / len2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = x - (x0 + dx * t), ey = y - (y0 + dy * t);
          if (ex * ex + ey * ey <= rw * rw + 0.01) fn(y * w + x, x, y);
        }
      }
    }
  };
  for (const op of src.paint || []) {
    const ti = op.tile ? tileIdx(tileIndexById, op.tile) : -1;
    paintOp(op, (i) => {
      if (ti >= 0) { tiles[i] = ti; if (op.path) isPath[i] = 1; }
      if (op.reserve || op.path) reserved[i] = 1;
    });
  }

  // 6. markers: (macro form) the marker tile and its 4-neighbours are forced walkable; decoration keeps decoClear away
  const grassI = 0;
  const freeMarkers = zoneDef.freeMarkers || [];
  const decoClear = src.decoClear !== undefined ? src.decoClear : 2.2;
  for (const name of Object.keys(markers)) {
    const m = markers[name];
    if (!Array.isArray(m)) continue;
    const mx = m[0] | 0, my = m[1] | 0;
    if (mx < 0 || my < 0 || mx >= w || my >= h) continue;
    const mi = my * w + mx;
    paintOp({ at: m, r: decoClear }, (i) => { reserved[i] = 1; });
    if (!macro || freeMarkers.includes(name)) continue;
    const ownL = reg[mi] && !reg[mi].solid ? reg[mi] : null;
    const walkI = SOLID[tiles[mi]] ? (ownL ? ownL.base : grassI) : tiles[mi];
    const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [ox, oy] of near) {
      const x = mx + ox, y = my + oy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (SOLID[tiles[y * w + x]]) tiles[y * w + x] = walkI;
    }
  }

  // 7. macro: fill walkable pockets that no cell center reaches
  if (macro) {
    const seen = new Uint8Array(N);
    const stack = [];
    const c0 = Math.floor(cell / 2) - 1;
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      if (cellL(cx, cy).solid) continue;
      const i = (cy * cell + c0) * w + cx * cell + c0;
      if (!SOLID[tiles[i]] && !seen[i]) { seen[i] = 1; stack.push(i); }
    }
    for (const name of Object.keys(markers)) {
      const m = markers[name];
      if (!Array.isArray(m) || m[0] < 0 || m[1] < 0 || m[0] >= w || m[1] >= h) continue;
      const i = m[1] * w + m[0];
      if (!SOLID[tiles[i]] && !seen[i]) { seen[i] = 1; stack.push(i); }
    }
    while (stack.length) {
      const i = stack.pop(), x = i % w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const k of nb) {
        if (k < 0 || k >= N || seen[k] || SOLID[tiles[k]]) continue;
        seen[k] = 1; stack.push(k);
      }
    }
    const fillerI = tileIdx(tileIndexById, src.filler || 'trees');
    for (let i = 0; i < N; i++) {
      if (seen[i] || SOLID[tiles[i]]) continue;
      // take a solid neighbour's tile when there is one (keeps cliffs as cliffs)
      const x = i % w;
      let t = -1;
      for (const k of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (k >= 0 && k < N && SOLID[tiles[k]] && seen[k] === 0) { t = tiles[k]; break; }
      tiles[i] = t >= 0 ? t : (fillerI >= 0 ? fillerI : tiles[i]);
    }
  }

  // 8. decoration. Blocked mask = solid tiles + authored solid props; reservations around furniture.
  const blocked = new Uint8Array(N);
  for (let i = 0; i < N; i++) blocked[i] = SOLID[tiles[i]] ? 1 : 0;
  const reserveRect = (x0, y0, rw, rh, pad) => {
    for (let y = Math.max(0, y0 - pad); y < Math.min(h, y0 + rh + pad); y++) for (let x = Math.max(0, x0 - pad); x < Math.min(w, x0 + rw + pad); x++) reserved[y * w + x] = 1;
  };
  const occupied = new Uint8Array(N);
  for (const p of zoneDef.props || []) {
    const pd = PROPS[p.kind];
    const fw = pd && pd.footprint ? pd.footprint[0] : 1, fh = pd && pd.footprint ? pd.footprint[1] : 1;
    for (let y = p.y; y < p.y + fh; y++) for (let x = p.x; x < p.x + fw; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      occupied[y * w + x] = 1;
      if (pd && pd.solid && pd.footprint) blocked[y * w + x] = 1;
    }
    const big = pd && (pd.model === 'house' || pd.model === 'shop' || pd.model === 'tower' || pd.model === 'academy' || pd.model === 'tent');
    reserveRect(p.x, p.y, fw, fh + (big ? 2 : 0), 1);
  }
  for (const list of [zoneDef.exits, zoneDef.gates, zoneDef.chests]) {
    for (const e of list || []) { const r = furnitureRect(e, markers); if (r) reserveRect(r[0], r[1], r[2], r[3], 1); }
  }
  for (const s of zoneDef.spawns || []) if (s.clear && s.area) reserveRect(s.area[0], s.area[1], s.area[2], s.area[3], 0);

  const props = [];
  const ringX = [0, 1, 1, 1, 0, -1, -1, -1], ringY = [-1, -1, 0, 1, 1, 1, 0, -1];
  const ringOpen = new Uint8Array(8);
  // true when blocking (x,y) cannot disconnect walkable tiles (its open 4-neighbours stay linked through its ring)
  const simple = (x, y) => {
    for (let k = 0; k < 8; k++) {
      const nx = x + ringX[k], ny = y + ringY[k];
      ringOpen[k] = nx >= 0 && ny >= 0 && nx < w && ny < h && !blocked[ny * w + nx] ? 1 : 0;
    }
    let first = -1;
    for (let k = 0; k < 8; k++) if (!ringOpen[k]) { first = k; break; }
    if (first < 0) return true;                 // fully open ring
    let runs = 0, runsWithEdge = 0, inRun = false, runHasEdge = false;
    for (let s = 1; s <= 8; s++) {
      const k = (first + s) % 8;
      if (ringOpen[k]) {
        if (!inRun) { inRun = true; runHasEdge = false; runs++; }
        if ((k & 1) === 0) runHasEdge = true;    // even ring slots are the 4-neighbours
      } else if (inRun) { inRun = false; if (runHasEdge) runsWithEdge++; }
    }
    if (inRun && runHasEdge) runsWithEdge++;
    return runsWithEdge <= 1;
  };
  const occ = (x, y) => x < 0 || y < 0 || x >= w || y >= h || occupied[y * w + x];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const L = reg[i];
      if (!L || !L.decoTotal || reserved[i] || blocked[i] || isPath[i] || occupied[i]) continue;
      if (reg[i] && tiles[i] !== L.base && !L.mix.some((m) => m.idx === tiles[i])) continue;   // painted/shore tile
      const r = hash2(x, y, seed + 131) / 256;
      // fringe: tiles touching a solid tile (tree walls, cliffs) get their own list, packed tighter
      const edge = L.fringe.length && ((x > 0 && SOLID[tiles[i - 1]]) || (x < w - 1 && SOLID[tiles[i + 1]]) || (y > 0 && SOLID[tiles[i - w]]) || (y < h - 1 && SOLID[tiles[i + w]]));
      const list = edge ? L.fringe : L.deco;
      const clump = edge ? 1 : 0.2 + 1.6 * fbm(x, y, 7, seed + 97);
      let acc = 0, pick = null;
      for (const d of list) { acc += d.p * clump; if (r < acc) { pick = d; break; } }
      if (!pick) continue;
      if (pick.solid) {
        if (pick.w !== 1 || pick.h !== 1) continue;
        if (!edge && (occ(x - 1, y) || occ(x, y - 1) || occ(x - 1, y - 1) || occ(x + 1, y - 1))) continue;   // breathing room
        if (!simple(x, y)) continue;
        blocked[i] = 1;
      }
      occupied[i] = 1;
      props.push({ kind: pick.kind, x, y, deco: true });
    }
  }

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) variant[y * w + x] = hash2(x, y, seed);
  return { w, h, tiles, variant, props };
}
