// Tile chunks: 16x16 tiles (256x256 art px) painted pixel by pixel into a Pix, then into a canvas.
// Patterns come from palette colors + per-tile `variant` + world-space hash noise, so chunk seams are invisible.
// Soft transitions (grass fringes over paths/sand, shorelines with foam), block tiles in 3/4 view (top face raised
// by h tiles, south face of height h when the tile south is open), drop shadows, baked flat props and prop shadows.
// Chunks containing water are built twice (2-frame water animation).
import { Pix, hash, makeCanvas, u32 } from './pix.js';
import { dark, light, mix, col } from './color.js';

export const CH = 16;           // tiles per chunk side
export const TP = 16;           // art px per tile
export const CPX = CH * TP;     // art px per chunk side

const PRIO = { water: 0, shallows: 1, starfloor: 1, wet_sand: 2, sand: 3, cloud: 3, dirt: 4, path: 5, cobble: 6, stone: 7, planks: 7, carpet: 7, grass: 9, flowers: 9, tallgrass: 9 };
const GROUP = { grass: 'g', flowers: 'g', tallgrass: 'g' };
const SOFT_RECEIVER = { dirt: 1, path: 1, sand: 1, wet_sand: 1, cobble: 1 };
const SOFT_SOURCE = { grass: 1, flowers: 1, tallgrass: 1, dirt: 1, path: 1, sand: 1 };
const KNOWN_PATTERNS = ['grass', 'flowers', 'tallgrass', 'dirt', 'path', 'cobble', 'sand', 'wet_sand', 'shallows', 'water',
  'planks', 'stone', 'carpet', 'brick', 'hedge', 'trees', 'cliff', 'crystal', 'cloud', 'starfloor'];

/** Prepare per-zone tile info: resolved colors, shape, height. */
export function prepareTiles(zv, unknown) {
  const pats = (zv.palette && zv.palette.patterns) || {};
  return zv.tileDefs.map((d) => {
    const pp = pats[d.pattern] || {};
    const c = d.colors || {};
    const a = col(pp.a, col(c.a, '#7cc95a')), b = col(pp.b, col(c.b, dark(a, 0.2))), side = col(pp.side, col(c.side, dark(b, 0.2)));
    let pattern = d.pattern;
    if (!KNOWN_PATTERNS.includes(pattern)) { if (unknown) unknown.push('tile.pattern:' + pattern); pattern = 'grass'; }
    const block = d.shape === 'block';
    return { id: d.id, pattern, block, water: d.shape === 'water', pit: d.shape === 'pit', h: block ? Math.max(0.5, d.h || 1) : 0,
      hpx: block ? Math.round(Math.max(0.5, d.h || 1) * TP) : 0, a, b, side, prio: PRIO[pattern] ?? 5 };
  });
}

/** Does this chunk need two frames (animated water)? */
export function chunkAnimated(zv, info, cx, cy) {
  const x0 = cx * CH, y0 = cy * CH;
  for (let ty = y0; ty < Math.min(zv.h, y0 + CH); ty++) for (let tx = x0; tx < Math.min(zv.w, x0 + CH); tx++) {
    if (info[zv.tiles[ty * zv.w + tx]].water) return true;
  }
  return false;
}

/**
 * Paint one chunk. Returns a canvas (CPX x CPX).
 * extras: {flat: [{sprite, x, y}] (world art px, top-left), shadows: [{x, y, rx, ry}] (world art px)}
 */
export function buildChunk(zv, info, cx, cy, frame, extras) {
  const p = new Pix(CPX, CPX);
  const W = zv.w, Hh = zv.h;
  const x0 = cx * CH, y0 = cy * CH;
  const tileAt = (tx, ty) => {
    if (tx < 0) tx = 0; if (ty < 0) ty = 0; if (tx >= W) tx = W - 1; if (ty >= Hh) ty = Hh - 1;
    return info[zv.tiles[ty * W + tx]];
  };
  // 1. ground for every visible tile (blocks get the ground of the pattern beneath: a darker base)
  for (let ty = y0; ty < y0 + CH; ty++) for (let tx = x0; tx < x0 + CH; tx++) {
    const ox = (tx - x0) * TP, oy = (ty - y0) * TP;
    if (tx >= W || ty >= Hh) { p.rect(ox, oy, TP, TP, '#2a3a4a'); continue; }
    const t = info[zv.tiles[ty * W + tx]];
    const v = zv.variant[ty * W + tx];
    if (t.block) { p.rect(ox, oy, TP, TP, dark(t.side, 0.3)); continue; }
    ground(p, ox, oy, tx, ty, t, v, frame);
  }
  // 2. transitions
  for (let ty = y0; ty < Math.min(Hh, y0 + CH); ty++) for (let tx = x0; tx < Math.min(W, x0 + CH); tx++) {
    const t = info[zv.tiles[ty * W + tx]];
    if (t.block) continue;
    transitions(p, (tx - x0) * TP, (ty - y0) * TP, tx, ty, t, tileAt, frame);
  }
  // 3. baked prop shadows + flat props
  if (extras) {
    for (const s of extras.shadows) p.shadowEllipse(s.x - x0 * TP, s.y - y0 * TP, s.rx, s.ry, 0.28);
  }
  // 4. blocks, north to south (rows below the chunk can overhang into it)
  for (let ty = y0; ty < Math.min(Hh, y0 + CH + 3); ty++) for (let tx = x0; tx < Math.min(W, x0 + CH); tx++) {
    const t = info[zv.tiles[ty * W + tx]];
    if (!t.block) continue;
    blockTile(p, (tx - x0) * TP, (ty - y0) * TP, tx, ty, t, zv.variant[ty * W + tx], tileAt);
  }
  for (let ty = y0 - 1; ty < Math.min(Hh, y0 + CH + 3); ty++) for (let tx = x0 - 1; tx < Math.min(W, x0 + CH + 1); tx++) {
    if (tx < 0 || ty < 0) continue;
    const t = info[zv.tiles[ty * W + tx]];
    if (!t.block) continue;
    blockDecor(p, (tx - x0) * TP, (ty - y0) * TP, tx, ty, t, zv.variant[ty * W + tx], tileAt);
  }
  const c = makeCanvas(CPX, CPX);
  const g = c.getContext('2d');
  p.putTo(g, 0, 0);
  if (extras && extras.flat.length) {
    g.imageSmoothingEnabled = false;
    for (const f of extras.flat) g.drawImage(f.sprite.c, f.x - x0 * TP, f.y - y0 * TP);
    // re-draw block faces that must cover flat props (rare): skipped, flat props sit on open ground
  }
  return c;
}

/** World art-px rect covered by a block tile's visual, or null. exposed => top + face, else top only. */
export function blockRegion(info, zv, tx, ty, out) {
  const t = info[zv.tiles[ty * zv.w + tx]];
  if (!t.block) return null;
  const south = ty + 1 < zv.h ? info[zv.tiles[(ty + 1) * zv.w + tx]] : t;
  const exposed = !south.block || south.hpx < t.hpx;
  out.x = tx * TP; out.w = TP;
  out.y = (ty + 1) * TP - t.hpx - TP;
  out.h = exposed ? t.hpx + TP : TP;
  return out;
}

// ------------------------------------------------------------------ ground patterns

function ground(p, ox, oy, tx, ty, t, v, frame) {
  const a = t.a, b = t.b;
  const gx0 = tx * TP, gy0 = ty * TP;
  switch (t.pattern) {
    case 'grass': case 'flowers': case 'tallgrass': {
      const base = t.pattern === 'tallgrass' ? a : a;
      p.rect(ox, oy, TP, TP, base);
      if (t.pattern === 'tallgrass') { tallgrass(p, ox, oy, gx0, gy0, t); break; }
      grassTufts(p, ox, oy, gx0, gy0, t.pattern === 'flowers' ? mix(a, '#2a5a2a', 0.25) : b, a, v);
      if (t.pattern === 'flowers') flowers(p, ox, oy, gx0, gy0, t, v);
      break;
    }
    case 'dirt': case 'path': {
      p.rect(ox, oy, TP, TP, a);
      for (let y = 0; y < TP; y++) for (let x = 0; x < TP; x++) {
        const n = hash(gx0 + x, gy0 + y, 7);
        if (n < (t.pattern === 'dirt' ? 0.12 : 0.06)) p.set(ox + x, oy + y, b);
        else if (n > 0.992) { p.set(ox + x, oy + y, light(a, 0.4)); p.set(ox + x, oy + y + 1, dark(b, 0.2)); }
      }
      if ((v & 7) === 1) pebble(p, ox + 4 + (v >> 5), oy + 6 + ((v >> 3) & 3), a, b);
      if (t.pattern === 'dirt' && (v & 15) === 5) { p.hline(ox + 3, ox + 7, oy + 10, dark(b, 0.15)); p.hline(ox + 9, ox + 12, oy + 4, dark(b, 0.15)); }
      break;
    }
    case 'cobble': {
      // staggered rounded stones (8x4 with a 1px mortar), world-aligned so tiles join seamlessly
      const mortar = dark(b, 0.32);
      for (let y = 0; y < TP; y++) for (let x = 0; x < TP; x++) {
        const gx = gx0 + x, gy = gy0 + y;
        const row = gy >> 2, off = (row & 1) ? 4 : 0;
        const lx = (gx + off) & 7, ly = gy & 3;
        const stone = (gx + off) >> 3;
        let c;
        if (ly === 3 || lx === 7) c = mortar;
        else if ((lx === 0 || lx === 6) && (ly === 0 || ly === 2)) c = mix(mortar, a, 0.4);
        else {
          const n = hash(stone, row, 11);
          const sc = n < 0.3 ? a : n < 0.6 ? mix(a, b, 0.45) : n < 0.85 ? light(a, 0.1) : mix(a, '#c8b090', 0.25);
          c = ly === 0 ? light(sc, 0.22) : ly === 2 ? dark(sc, 0.12) : sc;
          if (lx === 6) c = dark(sc, 0.15);
          if (lx === 1 && ly === 0) c = light(sc, 0.4);
        }
        p.set(ox + x, oy + y, c);
      }
      break;
    }
    case 'sand': case 'wet_sand': {
      p.rect(ox, oy, TP, TP, a);
      for (let y = 0; y < TP; y++) for (let x = 0; x < TP; x++) {
        const gx = gx0 + x, gy = gy0 + y;
        const n = hash(gx, gy, 5);
        const rip = Math.sin(gx * 0.35 + Math.sin(gy * 0.25) * 2 + gy * 0.9);
        if (rip > 0.93) p.set(ox + x, oy + y, b);
        else if (n < 0.05) p.set(ox + x, oy + y, b);
        else if (n > 0.993) p.set(ox + x, oy + y, t.pattern === 'wet_sand' ? '#ffffff' : light(a, 0.5));
      }
      if (t.pattern === 'sand' && (v & 31) === 3) { p.set(ox + 6, oy + 7, '#ffd0c0'); p.set(ox + 7, oy + 7, '#ffb0a0'); p.set(ox + 6, oy + 8, '#e09080'); }
      break;
    }
    case 'shallows': case 'water': {
      water(p, ox, oy, gx0, gy0, t, frame);
      break;
    }
    case 'planks': {
      for (let y = 0; y < TP; y++) {
        const gy = gy0 + y, board = gy >> 2;
        const shift = Math.floor(hash(board, 0, 3) * 16);
        for (let x = 0; x < TP; x++) {
          const gx = gx0 + x;
          const seg = Math.floor((gx + shift) / 24);
          const n = hash(seg, board, 9);
          let c = n < 0.5 ? a : mix(a, b, 0.4);
          if ((gy & 3) === 3) c = dark(b, 0.25);
          else if ((gx + shift) % 24 === 0) c = dark(b, 0.2);
          else if ((gy & 3) === 0) c = light(c, 0.12);
          else if (hash(gx, gy, 2) < 0.06) c = b;
          if ((gx + shift) % 24 === 2 && (gy & 3) === 1) c = dark(b, 0.4);
          p.set(ox + x, oy + y, c);
        }
      }
      break;
    }
    case 'stone': {
      for (let y = 0; y < TP; y++) {
        const gy = gy0 + y, row = gy >> 3;
        const off = (row & 1) ? 4 : 0;
        for (let x = 0; x < TP; x++) {
          const gx = gx0 + x + off;
          const slab = gx >> 3;
          const n = hash(slab, row, 4);
          let c = n < 0.4 ? a : n < 0.8 ? mix(a, b, 0.3) : light(a, 0.08);
          const lx = gx & 7, ly = gy & 7;
          if (lx === 7 || ly === 7) c = dark(b, 0.12);
          else if (ly === 0 || lx === 0) c = light(c, 0.15);
          else if (hash(gx, gy, 12) < 0.03) c = b;
          p.set(ox + x, oy + y, c);
        }
      }
      break;
    }
    case 'carpet': {
      p.rect(ox, oy, TP, TP, a);
      for (let y = 0; y < TP; y++) for (let x = 0; x < TP; x++) {
        const gx = gx0 + x, gy = gy0 + y;
        const mx = ((gx % 8) + 8) % 8, my = ((gy % 8) + 8) % 8;
        const d = Math.abs(mx - 3.5) + Math.abs(my - 3.5);
        if (d > 2.6 && d < 3.6) p.set(ox + x, oy + y, mix(a, b, 0.55));
        else if (d < 1) p.set(ox + x, oy + y, b);
        else if (hash(gx, gy, 8) < 0.04) p.set(ox + x, oy + y, dark(a, 0.1));
      }
      break;
    }
    case 'cloud': {
      p.rect(ox, oy, TP, TP, a);
      for (let y = 0; y < TP; y++) for (let x = 0; x < TP; x++) {
        const gx = gx0 + x, gy = gy0 + y;
        const s = Math.sin(gx * 0.3) + Math.sin(gy * 0.37 + gx * 0.11) + Math.sin((gx + gy) * 0.19);
        if (s > 1.6) p.set(ox + x, oy + y, b);
        else if (s > 1.35) p.set(ox + x, oy + y, mix(a, b, 0.5));
      }
      break;
    }
    case 'starfloor': {
      p.rect(ox, oy, TP, TP, a);
      for (let y = 0; y < TP; y++) for (let x = 0; x < TP; x++) {
        const gx = gx0 + x, gy = gy0 + y, n = hash(gx, gy, 21);
        if (n < 0.012) p.set(ox + x, oy + y, b);
        else if (n < 0.02) p.set(ox + x, oy + y, mix(a, b, 0.4));
        else if (Math.sin(gx * 0.12 + gy * 0.07) + Math.sin(gy * 0.15) > 1.5) p.set(ox + x, oy + y, light(a, 0.08));
      }
      if ((tx * 7 + ty * 3) % 11 === 0) { const sx = ox + 7, sy = oy + 7; p.set(sx, sy, '#ffffff'); p.set(sx - 1, sy, b); p.set(sx + 1, sy, b); p.set(sx, sy - 1, b); p.set(sx, sy + 1, b); }
      break;
    }
    default: p.rect(ox, oy, TP, TP, a);
  }
}

function grassTufts(p, ox, oy, gx0, gy0, b, a, v) {
  const hi = light(a, 0.18), patch = mix(a, light(a, 0.3), 0.35);
  for (let y = 0; y < TP; y += 1) for (let x = 0; x < TP; x += 1) {
    const gx = gx0 + x, gy = gy0 + y;
    const f = Math.sin(gx * 0.045 + Math.sin(gy * 0.06) * 1.5) + Math.sin(gy * 0.05 - gx * 0.02);
    if (f > 1.25 || (f > 1.1 && ((gx + gy) & 1))) p.set(ox + x, oy + y, patch);
  }
  for (let i = 0; i < 4; i++) {
    const n1 = hash(gx0 + i * 5, gy0, 31), n2 = hash(gx0, gy0 + i * 7, 33);
    if (n1 < 0.25) continue;
    const x = ox + 1 + Math.floor(n1 * 13), y = oy + 2 + Math.floor(n2 * 12);
    p.set(x, y, b); p.set(x + 2, y, b); p.set(x + 1, y - 1, b);
    if (n2 > 0.6) p.set(x + 1, y - 2, hi);
  }
  for (let i = 0; i < 3; i++) {
    const n = hash(gx0 + i, gy0 + 3 * i, 37);
    p.set(ox + Math.floor(n * 16), oy + Math.floor(hash(gx0, gy0 + i, 39) * 16), hi);
  }
  if ((v & 15) === 9) { p.set(ox + 8, oy + 9, b); p.set(ox + 9, oy + 8, b); p.set(ox + 10, oy + 9, b); }
}

function flowers(p, ox, oy, gx0, gy0, t, v) {
  const petals = [t.b, t.side, '#ffffff'];
  const n = 2 + (v & 1);
  for (let i = 0; i < n; i++) {
    const x = ox + 2 + Math.floor(hash(gx0 + i, gy0, 41) * 11), y = oy + 2 + Math.floor(hash(gx0, gy0 + i, 43) * 11);
    const pc = petals[(i + (v >> 2)) % 3];
    const center = pc === t.side ? '#ff8a3c' : t.side;
    p.set(x, y - 1, pc); p.set(x - 1, y, pc); p.set(x + 1, y, pc); p.set(x, y + 1, dark(pc, 0.2)); p.set(x, y, center);
    p.set(x + 1, y + 2, dark(t.a, 0.3));
  }
}

function tallgrass(p, ox, oy, gx0, gy0, t) {
  const base = dark(t.a, 0.12), blade = t.b, tip = light(t.b, 0.3), deep = dark(t.a, 0.32);
  p.rect(ox, oy, TP, TP, base);
  // clumps: little fans of blades, scattered on a jittered grid
  for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) {
    const n = hash(gx0 + cx * 5, gy0 + cy * 5, 51), n2 = hash(gx0 + cx * 5, gy0 + cy * 5, 53);
    const bx = ox + 2 + cx * 5 + Math.floor(n * 3), by = oy + 5 + cy * 5 + Math.floor(n2 * 2);
    p.set(bx, by + 1, deep); p.set(bx - 1, by + 1, deep); p.set(bx + 1, by + 1, deep);
    const h = 3 + Math.floor(n2 * 3);
    for (let k = 0; k < h; k++) p.set(bx, by - k, k === h - 1 ? tip : blade);
    for (let k = 0; k < h - 1; k++) p.set(bx - 1 - (k >> 1), by - k, k === h - 2 ? tip : (k & 1 ? blade : dark(blade, 0.15)));
    for (let k = 0; k < h - 1; k++) p.set(bx + 1 + (k >> 1), by - k, k === h - 2 ? tip : blade);
    if (n > 0.93) { p.set(bx, by - h, '#fff4b0'); }
  }
}

function pebble(p, x, y, a, b) {
  p.set(x, y, light(a, 0.45)); p.set(x + 1, y, light(a, 0.3)); p.set(x, y + 1, dark(b, 0.15)); p.set(x + 1, y + 1, dark(b, 0.3));
}

function water(p, ox, oy, gx0, gy0, t, frame) {
  const a = t.a, b = t.b;
  const deep = t.pattern === 'water';
  const dk = dark(a, 0.12);
  for (let y = 0; y < TP; y++) for (let x = 0; x < TP; x++) {
    const gx = gx0 + x, gy = gy0 + y;
    let c = a;
    const lf = Math.sin(gx * 0.11 + gy * 0.07) + Math.sin(gy * 0.13 - gx * 0.05);
    if (deep && lf > 1.55) c = mix(a, dk, 0.5);
    if (!deep && hash(gx, gy, 61) < 0.05) c = mix(a, '#e8d28a', 0.35);
    // wave dashes, shifted per frame
    const row = gy % 6;
    if (row === 0 || row === 3) {
      const ph = (gx + (row === 3 ? 7 : 0) + frame * 2 + Math.floor(gy / 6) * 5) % 12;
      if (ph < 3) c = b;
      else if (ph === 3 && deep) c = light(b, 0.3);
    }
    p.set(ox + x, oy + y, c);
  }
  const n = hash(gx0, gy0, 63 + frame);
  if (n < 0.35) { const sx = ox + Math.floor(n * 40) % 14 + 1, sy = oy + Math.floor(hash(gx0, gy0, 65) * 13) + 1; p.set(sx, sy, '#ffffff'); if (deep) { p.set(sx + 1, sy, light(b, 0.5)); } }
}

// ------------------------------------------------------------------ transitions

function transitions(p, ox, oy, tx, ty, t, tileAt, frame) {
  const N = tileAt(tx, ty - 1), S = tileAt(tx, ty + 1), E = tileAt(tx + 1, ty), Wt = tileAt(tx - 1, ty);
  // drop shadow from a block to the north
  if (N.block) {
    for (let x = 0; x < TP; x++) { p.darkenPx(ox + x, oy, 0.38); p.darkenPx(ox + x, oy + 1, 0.28); p.darkenPx(ox + x, oy + 2, 0.16); if (hash(tx * TP + x, ty, 71) < 0.5) p.darkenPx(ox + x, oy + 3, 0.08); }
  }
  if (Wt.block) for (let y = 0; y < TP; y++) p.darkenPx(ox, oy + y, 0.18);
  // water shoreline
  if (t.water) {
    const sides = [[N, 0], [S, 1], [Wt, 2], [E, 3]];
    for (const [nb, side] of sides) {
      if (nb.water && !(t.pattern === 'water' && nb.pattern === 'shallows')) continue;
      if (nb.block) continue;
      const bank = nb.water ? mix(t.a, nb.a, 0.5) : dark(nb.a, 0.25);
      const foam = t.pattern === 'water' && nb.pattern === 'shallows' ? light(t.b, 0.3) : '#f0fbff';
      for (let i = 0; i < TP; i++) {
        const n = hash(tx * TP + i, ty * TP + side, 81);
        const depth = nb.water ? 0 : 1 + (n > 0.6 ? 1 : 0);
        const fo = (i + frame * 3 + side) % 5 === 0 ? 0 : 1;
        for (let d = 0; d < depth; d++) setSide(p, ox, oy, side, i, d, bank);
        if (fo) setSide(p, ox, oy, side, i, depth, foam);
        if ((i + frame) % 3 === 0) setSide(p, ox, oy, side, i, depth + 1, mix(t.a, foam, 0.4));
      }
    }
    return;
  }
  // carpet border / cobble curb where the neighbor is a different floor
  if (t.pattern === 'carpet' || t.pattern === 'cobble') {
    const sides = [[N, 0], [S, 1], [Wt, 2], [E, 3]];
    for (const [nb, side] of sides) {
      if (nb.pattern === t.pattern || nb.block) continue;
      if (t.pattern === 'carpet') {
        for (let i = 0; i < TP; i++) {
          setSide(p, ox, oy, side, i, 0, dark(t.b, 0.45)); setSide(p, ox, oy, side, i, 1, t.b); setSide(p, ox, oy, side, i, 2, light(t.b, 0.3));
          setSide(p, ox, oy, side, i, 3, (i & 1) ? t.b : dark(t.a, 0.2));
        }
      } else if (!GROUP[nb.pattern]) {
        for (let i = 0; i < TP; i++) { setSide(p, ox, oy, side, i, 0, dark(t.b, 0.35)); setSide(p, ox, oy, side, i, 1, (i % 6) === 0 ? dark(t.b, 0.2) : light(t.a, 0.15)); }
      }
    }
    if (t.pattern === 'carpet') return;
  }
  // soft fringe from higher-priority neighbors
  if (!SOFT_RECEIVER[t.pattern]) return;
  const sides = [[N, 0], [S, 1], [Wt, 2], [E, 3]];
  for (const [nb, side] of sides) {
    if (nb.block || nb.water) continue;
    if (!SOFT_SOURCE[nb.pattern] || nb.prio <= t.prio || (GROUP[nb.pattern] && GROUP[nb.pattern] === GROUP[t.pattern])) continue;
    const fc = nb.a, edge = GROUP[nb.pattern] === 'g' ? dark(nb.a, 0.22) : dark(nb.a, 0.12);
    for (let i = 0; i < TP; i++) {
      const n = hash(tx * TP + i, ty * TP + side * 17, 91);
      const n2 = hash(tx * TP + i + 1, ty * TP + side * 17, 91);
      const depth = 1 + Math.round((n + n2) * 1.3);
      for (let d = 0; d < depth; d++) setSide(p, ox, oy, side, i, d, fc);
      setSide(p, ox, oy, side, i, depth, edge);
      if (GROUP[nb.pattern] === 'g' && n > 0.82) { setSide(p, ox, oy, side, i, depth + 1, edge); setSide(p, ox, oy, side, i, depth, fc); }
    }
  }
  // corners
  const corners = [[tileAt(tx - 1, ty - 1), 0, 0, N, Wt], [tileAt(tx + 1, ty - 1), 1, 0, N, E], [tileAt(tx - 1, ty + 1), 0, 1, S, Wt], [tileAt(tx + 1, ty + 1), 1, 1, S, E]];
  for (const [d, cxs, cys, o1, o2] of corners) {
    if (!SOFT_SOURCE[d.pattern] || d.block || d.water || d.prio <= t.prio || (GROUP[d.pattern] && GROUP[d.pattern] === GROUP[t.pattern])) continue;
    if (SOFT_SOURCE[o1.pattern] && o1.prio > t.prio && !o1.block && !o1.water) continue;
    if (SOFT_SOURCE[o2.pattern] && o2.prio > t.prio && !o2.block && !o2.water) continue;
    const bx = cxs ? ox + TP - 1 : ox, byy = cys ? oy + TP - 1 : oy, sx = cxs ? -1 : 1, sy = cys ? -1 : 1;
    const edge = dark(d.a, GROUP[d.pattern] === 'g' ? 0.22 : 0.12);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const r = x + y;
      if (r < 3) p.set(bx + sx * x, byy + sy * y, d.a);
      else if (r === 3) p.set(bx + sx * x, byy + sy * y, edge);
    }
  }
}

function setSide(p, ox, oy, side, i, d, c) {
  if (side === 0) p.set(ox + i, oy + d, c);
  else if (side === 1) p.set(ox + i, oy + TP - 1 - d, c);
  else if (side === 2) p.set(ox + d, oy + i, c);
  else p.set(ox + TP - 1 - d, oy + i, c);
}

// ------------------------------------------------------------------ blocks

function blockInfo(tx, ty, t, tileAt) {
  const N = tileAt(tx, ty - 1), S = tileAt(tx, ty + 1), E = tileAt(tx + 1, ty), Wt = tileAt(tx - 1, ty);
  return {
    exposed: !S.block || S.hpx < t.hpx,
    openN: !N.block || N.hpx < t.hpx, openW: !Wt.block || Wt.pattern !== t.pattern, openE: !E.block || E.pattern !== t.pattern,
  };
}

/** Pass 1: south face + flat top face. */
function blockTile(p, ox, oy, tx, ty, t, v, tileAt) {
  const { exposed, openN, openW, openE } = blockInfo(tx, ty, t, tileAt);
  const hp = t.hpx;
  const topY = oy + TP - hp - TP; // top face y
  const faceY = oy + TP - hp;
  const gx0 = tx * TP, gy0 = ty * TP;
  const pat = t.pattern;
  if (exposed) {
    for (let y = 0; y < hp; y++) for (let x = 0; x < TP; x++) {
      const gx = gx0 + x, fy = y;
      let c;
      switch (pat) {
        case 'brick': {
          const row = fy >> 2, off = (row & 1) ? 4 : 0;
          const bx = (gx + off) & 7;
          c = (fy & 3) === 3 || bx === 7 ? dark(t.side, 0.25) : (hash((gx + off) >> 3, row + ty * 9, 5) < 0.5 ? t.a : t.b);
          if ((fy & 3) === 0 && bx !== 7) c = light(c, 0.12);
          if (fy >= hp - 2) c = dark(c, 0.15);
          break;
        }
        case 'hedge': {
          // leafy wall: small leaf clumps, darker toward the ground
          const n = hash(gx >> 1, (gy0 + fy) >> 1, 13), k = fy / hp;
          c = n < 0.3 ? dark(t.side, 0.22) : n > 0.8 ? light(t.side, 0.15) : t.side;
          if (k > 0.75) c = dark(c, 0.2);
          if (fy === hp - 1) c = dark(t.side, 0.45);
          break;
        }
        case 'trees': {
          const under = Math.round(hp * 0.42) + Math.floor(hash(gx >> 2, ty, 15) * 4);
          const trunkX = 4 + Math.floor(hash(Math.floor(gx / 16), ty, 19) * 8);
          const tcol = ((gx % 16) + 16) % 16;
          const d = tcol - trunkX;
          const back = mix(dark(t.b, 0.45), '#1e3a2a', 0.35);
          if (fy < under) {
            const n = hash(gx, gy0 + fy, 17);
            c = fy < 3 ? t.b : n < 0.3 ? dark(t.b, 0.38) : dark(t.b, 0.25);
          } else if (d >= -1 && d <= 1) {
            c = d === -1 ? light(t.side, 0.18) : d === 1 ? dark(t.side, 0.3) : t.side;
            if (fy >= hp - 2) c = dark(t.side, 0.2);
          } else {
            c = back;
            if (fy >= hp - 3 && hash(gx, fy, 21) < 0.45) c = mix(t.b, back, 0.4);
            if ((d === -2 || d === 2) && fy >= hp - 2) c = dark(t.side, 0.35); // roots
          }
          break;
        }
        case 'cliff': {
          const band = Math.floor((fy + Math.floor(hash(gx >> 2, ty, 23) * 3)) / 5);
          c = band % 2 ? t.side : t.b;
          if (hash(gx, gy0 + fy, 25) < 0.07) c = dark(c, 0.25);
          if (((gx + band * 3) % 9) === 0) c = dark(t.side, 0.3);
          if (fy === 0) c = light(t.b, 0.15);
          if (fy >= hp - 2) c = dark(c, 0.18);
          break;
        }
        case 'crystal': {
          const colI = Math.floor(gx / 4);
          const n = hash(colI, ty, 27);
          c = n < 0.5 ? t.a : t.b;
          if ((gx & 3) === 0) c = light(c, 0.4);
          if ((gx & 3) === 3) c = dark(c, 0.2);
          if (hash(gx, fy + gy0, 29) < 0.03) c = '#ffffff';
          break;
        }
        default: { // stone wall
          const row = fy >> 3, off = (row & 1) ? 6 : 0;
          const bx = (gx + off) % 12;
          c = (fy & 7) === 7 || bx === 11 ? dark(t.side, 0.2) : (hash((gx + off) / 12 | 0, row + ty * 5, 31) < 0.5 ? t.b : t.side);
          if ((fy & 7) === 0) c = light(c, 0.1);
          if (fy >= hp - 2) c = dark(c, 0.12);
        }
      }
      if (x === 0 && openW) c = dark(c, 0.18);
      if (x === TP - 1 && openE) c = dark(c, 0.25);
      p.set(ox + x, faceY + y, c);
    }
  }
  for (let y = 0; y < TP; y++) for (let x = 0; x < TP; x++) {
    const gx = gx0 + x, gy = gy0 + y;
    let c;
    switch (pat) {
      case 'brick': {
        c = light(t.a, 0.35);
        if (hash(gx, gy, 33) < 0.08) c = light(t.b, 0.25);
        if ((gx & 7) === 0 && (gy & 3) === 0) c = t.b;
        break;
      }
      case 'hedge': c = dark(t.a, 0.18); break;
      case 'trees': c = dark(t.b, 0.25); break;
      case 'cliff': {
        const n = hash(gx, gy, 37);
        c = n < 0.08 ? t.b : n > 0.97 ? light(t.a, 0.3) : t.a;
        break;
      }
      case 'crystal': {
        const d = ((gx + gy) & 7);
        c = d < 3 ? light(t.a, 0.3) : d < 6 ? t.a : t.b;
        break;
      }
      default: {
        c = t.a;
        if ((gx & 7) === 0 || (gy & 7) === 0) c = t.b;
      }
    }
    if (pat !== 'trees' && pat !== 'hedge') {
      if (y === 0 && openN) c = light(c, 0.3);
      if (x === 0 && openW) c = light(c, 0.12);
      if (x === TP - 1 && openE) c = dark(c, 0.15);
      if (y === TP - 1 && exposed) c = light(c, 0.18);
    }
    p.set(ox + x, topY + y, c);
  }
}

/** Pass 2 (after every block's base is down, north to south): organic canopies, leaf clumps, crystals. */
function blockDecor(p, ox, oy, tx, ty, t, v, tileAt) {
  const pat = t.pattern;
  if (pat !== 'trees' && pat !== 'hedge' && pat !== 'cliff' && pat !== 'crystal') return;
  const { exposed, openN, openW, openE } = blockInfo(tx, ty, t, tileAt);
  const topY = oy + TP - t.hpx - TP;
  const gx0 = tx * TP, gy0 = ty * TP;
  if (pat === 'trees') canopy(p, ox, topY, tx, ty, t, openN, openW, openE, exposed, 3, 5, 3);
  else if (pat === 'hedge') {
    canopy(p, ox, topY, tx, ty, t, openN, openW, openE, exposed, 5, 3, 1);
    if ((v & 15) === 4) { p.set(ox + 7, topY + 8, '#ff8fc7'); p.set(ox + 8, topY + 7, '#ffd1e8'); p.set(ox + 8, topY + 8, '#ffe066'); }
  } else if (pat === 'cliff' && openN) {
    for (let x = 0; x < TP; x++) if (hash(gx0 + x, gy0, 41) < 0.6) p.set(ox + x, topY - 1, '#86c55a');
  } else if (pat === 'crystal') {
    const n = hash(tx, ty, 43);
    const sx = ox + 4 + Math.floor(n * 8), sy = topY + 4 + Math.floor(hash(ty, tx, 45) * 6);
    for (let k = 0; k < 6; k++) { p.set(sx, sy - k, k < 2 ? t.b : light(t.a, 0.4)); p.set(sx + 1, sy - k + 1, t.b); }
    p.set(sx, sy - 6, '#ffffff');
  }
}

/** Round leafy crowns shaded from the top-left. per: crowns per tile row, rr: base radius, over: px they may overhang open edges. */
function canopy(p, ox, topY, tx, ty, t, openN, openW, openE, exposed, per, rr, over) {
  const a = t.a, lo = t.b, hi = light(t.a, 0.22), hi2 = light(t.a, 0.42), dk = dark(t.b, 0.3);
  const rows = per > 3 ? 3 : 2;
  for (let j = 0; j < rows; j++) for (let i = 0; i < per; i++) {
    const n = hash(tx * 7 + i, ty * 5 + j, 47), n2 = hash(tx * 3 + j, ty * 11 + i, 49);
    const cx = ox + Math.floor((i + 0.5) * TP / per + (n - 0.5) * 4);
    const cy = topY + Math.floor((j + 0.5) * TP / rows + (n2 - 0.5) * 4);
    const r = rr + Math.floor(n * 3) - 1;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d2 = x * x + y * y;
      if (d2 > r * r + r * 0.6) continue;
      const px = cx + x, py = cy + y;
      if (py < topY - (openN ? over : 0)) continue;
      if (px < ox - (openW ? over : 0) || px >= ox + TP + (openE ? over : 0)) continue;
      if (!openW && px < ox) continue;
      if (!openE && px >= ox + TP) continue;
      if (py > topY + TP - 1 + (exposed ? over : 0)) continue;
      const l = -(x * 0.6 + y * 0.8) / r;
      let c = a;
      if (d2 > (r - 1) * (r - 1) && l < 0.1) c = dk;
      else if (l < -0.3) c = lo;
      else if (l > 0.5) c = hi;
      if (l > 0.72 && d2 < r) c = hi2;
      p.set(px, py, c);
    }
  }
  const n = hash(tx, ty, 53);
  if (per <= 3) {
    if (n < 0.12) { p.set(ox + 8, topY + 7, '#ff6b6b'); p.set(ox + 9, topY + 7, '#ff9a8a'); p.set(ox + 8, topY + 8, '#c83a3a'); }
    else if (n > 0.9) { p.set(ox + 5, topY + 10, '#fff4b0'); p.set(ox + 6, topY + 9, '#ffffff'); }
  }
}

export { u32 };
