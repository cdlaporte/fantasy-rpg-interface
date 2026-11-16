// Terrain + props as 16x16-tile chunk meshes. Per chunk: one toon mesh (props first so their triangles form
// the outlined index range, then terrain triangles, which are never outlined), one outline mesh (same buffers,
// drawRange = outlined range), one water mesh. Only visible faces are emitted: tops always, sides only where the
// neighbor is lower. Patterns are vertex-color variation plus small geometry accents (cobbles, planks, tufts,
// flowers, canopy blobs, crystals...). Zone edges get a dark "tabletop" skirt.
import * as THREE from 'three';
import { Kit, T, C, mul, mix, lighten } from './kit.js';
import { buildProp } from './props.js';

export const CHUNK = 16;

const BASE_H = { grass: 0.06, flowers: 0.06, tallgrass: 0.06, cloud: 0.06, snow: 0.08 };
const SKY_DROP = -1.45;     // island undersides end here; the sky void shows open sky with clouds far below
const WATER = { water: { surf: -0.2, bed: -0.46 }, shallows: { surf: -0.07, bed: -0.17 } };
const PATTERNS = ['grass', 'flowers', 'tallgrass', 'dirt', 'path', 'cobble', 'sand', 'wet_sand', 'shallows', 'water', 'planks',
  'stone', 'carpet', 'brick', 'hedge', 'trees', 'cliff', 'crystal', 'cloud', 'starfloor', 'snow', 'ice', 'sky'];

const hash2 = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Precomputed per-zone data shared by all chunks. */
export function prepareZone(zv, unknown) {
  const pats = (zv.palette && zv.palette.patterns) || {};
  const defs = zv.tileDefs.map((d) => {
    const p = pats[d.pattern] || {};
    const col = d.colors || {};
    let pattern = d.pattern;
    if (!PATTERNS.includes(pattern)) { unknown.add('pattern:' + pattern); pattern = 'grass'; }
    const shape = ['flat', 'block', 'water', 'pit'].includes(d.shape) ? d.shape : 'flat';
    if (shape !== d.shape) unknown.add('shape:' + d.shape);
    const a = C(p.a || col.a || '#7cc95a'), b = C(p.b || col.b || p.a || col.a || '#69b84c');
    const side = C(p.side || col.side || col.b || '#7a6a55');
    let top = 0, bed = 0, surf = 0;
    if (shape === 'block') top = d.h || 1;
    else if (shape === 'water') { const w = WATER[pattern] || WATER.water; top = w.bed; bed = w.bed; surf = w.surf; }
    else if (shape === 'pit') top = pattern === 'sky' ? SKY_DROP : -1.2;
    else top = BASE_H[pattern] || 0;
    if (pattern === 'sky') top = SKY_DROP;
    return { def: d, pattern, shape, a, b, side, top, bed, surf };
  });
  const pal = zv.palette || {};
  const edge = pal.edge || null;
  const rock = C((pats.cliff && pats.cliff.side) || '#9a88c8');
  return { zv, defs, edge, rock };
}

const _ca = new THREE.Color(), _cb = new THREE.Color(), _cc = new THREE.Color(), _cd = new THREE.Color();

/** Raw quad with flat normal; corners a,b,c,d CCW seen from the outside. Colors: Color x4. */
function quad(k, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, ca, cb, cc, cd, alpha = 1) {
  const base = k.P.length / 3;
  k.P.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
  // normal = (b - a) x (c - a)
  const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  for (let i = 0; i < 4; i++) { k.N.push(nx, ny, nz); if (k.line) k.S.push(nx, ny, nz); }
  k.Cl.push(ca.r, ca.g, ca.b, alpha, cb.r, cb.g, cb.b, alpha, cc.r, cc.g, cc.b, alpha, cd.r, cd.g, cd.b, alpha);
  const out = k.lineless ? k.IL : k.I;
  out.push(base, base + 1, base + 2, base, base + 2, base + 3);
  k.tris += 2;
}

function topQuad(k, x0, z0, x1, z1, y, c0, c1, c2, c3) {
  quad(k, x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0, c0, c1, c2, c3);
}

/** Side faces. dir: 0 N, 1 E, 2 S, 3 W. */
function sideQuad(k, tx, ty, dir, top, bot, cTop, cBot) {
  const x0 = tx, x1 = tx + 1, z0 = ty, z1 = ty + 1;
  if (dir === 2) quad(k, x0, top, z1, x0, bot, z1, x1, bot, z1, x1, top, z1, cTop, cBot, cBot, cTop);
  else if (dir === 0) quad(k, x1, top, z0, x1, bot, z0, x0, bot, z0, x0, top, z0, cTop, cBot, cBot, cTop);
  else if (dir === 1) quad(k, x1, top, z1, x1, bot, z1, x1, bot, z0, x1, top, z0, cTop, cBot, cBot, cTop);
  else quad(k, x0, top, z0, x0, bot, z0, x0, bot, z1, x0, top, z1, cTop, cBot, cBot, cTop);
}

const NB = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * Build one chunk. Returns {geo, water, emitters, tris} (geo/water may be null).
 * propsHere: zone props whose center falls in this chunk. decor: 0 none, 1 some, 2 full.
 */
export function buildChunk(zd, cx, cy, propsHere, decor, unknown) {
  const zv = zd.zv;
  const W = zv.w, H = zv.h;
  const k = new Kit({ skin: false, line: true });
  const wk = new Kit({ skin: false, line: false });
  const emitters = [];
  // props first (outlined)
  for (const p of propsHere) {
    const em = buildProp(k, p, unknown);
    for (const e of em) emitters.push(e);
  }
  k.lineless = true;
  const tx0 = cx * CHUNK, ty0 = cy * CHUNK;
  const tx1 = Math.min(W, tx0 + CHUNK), ty1 = Math.min(H, ty0 + CHUNK);
  const defAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : zd.defs[zv.tiles[y * W + x]]);
  const corner = (x, y) => 0.955 + 0.09 * hash2(x, y, 7);
  for (let ty = ty0; ty < ty1; ty++) {
    for (let tx = tx0; tx < tx1; tx++) {
      const i = ty * W + tx;
      const t = zd.defs[zv.tiles[i]];
      const v = zv.variant[i];
      tile(k, wk, zd, t, tx, ty, v, defAt, corner, decor);
    }
  }
  const geo = k.vertexCount ? k.build() : null;
  const water = wk.vertexCount ? wk.build() : null;
  return { geo, water, emitters, tris: k.tris + wk.tris };
}

function tile(k, wk, zd, t, tx, ty, v, defAt, corner, decor) {
  const p = t.pattern;
  const vf = (v & 255) / 255;
  const top = t.top;
  // ---- base color with per-corner noise ----
  let base;
  switch (p) {
    case 'cobble': base = mul(t.b, 0.72); break;
    case 'planks': base = mul(t.b, 0.62); break;
    case 'stone': base = mul(t.b, 0.8); break;
    case 'flowers': case 'tallgrass': base = mix(t.a, t.a, 0); break;
    case 'starfloor': base = t.a; break;
    case 'carpet': base = t.a; break;
    case 'trees': base = mul(t.a, 0.45); break;
    default: base = mix(t.a, t.b, ((v >> 2) & 3) / 3 * 0.4);
  }
  const blockTop = t.shape === 'block';
  if (t.shape === 'water') {
    // bed (dark) in the terrain mesh, surface in the water mesh
    const bedC = mul(mix(t.a, '#2a6a8a', 0.5), 0.6);
    topQuad(k, tx, ty, tx + 1, ty + 1, t.bed, bedC, bedC, bedC, bedC);
    waterTile(wk, t, tx, ty, defAt);
  } else if (p === 'trees') {
    // dark forest floor; the canopy is geometry above
    topQuad(k, tx, ty, tx + 1, ty + 1, 0.01, base, base, base, base);
  } else if (p === 'sky') {
    // open sky: no floor at all (the clear color and the clouds below show through)
  } else {
    const yy = top;
    _ca.copy(base).multiplyScalar(corner(tx, ty));
    _cb.copy(base).multiplyScalar(corner(tx, ty + 1));
    _cc.copy(base).multiplyScalar(corner(tx + 1, ty + 1));
    _cd.copy(base).multiplyScalar(corner(tx + 1, ty));
    if (t.shape === 'pit') { _ca.setRGB(0.04, 0.04, 0.06); _cb.copy(_ca); _cc.copy(_ca); _cd.copy(_ca); }
    if (blockTop) {
      const lt = mix(t.a, t.b, (v & 3) / 3 * 0.5);
      _ca.copy(lt); _cb.copy(lt); _cc.copy(lt); _cd.copy(lt);
    }
    topQuad(k, tx, ty, tx + 1, ty + 1, yy, _ca, _cb, _cc, _cd);
  }
  // ---- sides where the neighbor is lower ----
  const myTop = p === 'trees' ? 0.01 : top;
  for (let d = 0; d < 4; d++) {
    if (p === 'sky') break;
    const n = defAt(tx + NB[d][0], ty + NB[d][1]);
    const skyN = n ? n.pattern === 'sky' : zd.edge === 'sky';
    const nTop = n ? (n.pattern === 'trees' ? 0.01 : n.top) : (skyN ? SKY_DROP : -0.9);
    if (nTop >= myTop - 1e-4) continue;
    let cTop, cBot;
    if (skyN) {
      // a floating island's craggy underside
      cTop = mul(mix(t.side, zd.rock, 0.4), 0.95); cBot = mul(zd.rock, 0.8);
      const mid = myTop - 0.22;
      sideQuad(k, tx, ty, d, myTop, mid, BASE_H[p] ? mul(t.a, 0.8) : cTop, cTop);
      sideQuad(k, tx, ty, d, mid, nTop, mul(zd.rock, 1.05), cBot);
      continue;
    }
    if (!n) { cTop = mul(t.side, 0.75); cBot = mul('#4a3a30', 0.6); }
    else if (blockTop) { cTop = mul(t.side, 0.95); cBot = mul(t.side, 0.62); }
    else if (BASE_H[p]) { cTop = mul(t.a, 0.78); cBot = mul(mix(t.side, '#6a4a30', 0.6), 0.7); }
    else { cTop = mul(t.side, 0.85); cBot = mul(t.side, 0.55); }
    if (blockTop && (p === 'brick' || p === 'cliff' || p === 'stone')) {
      // courses / strata
      const rows = p === 'cliff' ? 3 : Math.max(2, Math.round((myTop - nTop) * 3));
      const hh = (myTop - nTop) / rows;
      for (let r = 0; r < rows; r++) {
        const yt = myTop - r * hh, yb = yt - hh;
        const kk = (r % 2 ? 0.88 : 1) * (1 - r * 0.06);
        const jitter = 0.94 + 0.12 * hash2(tx * 4 + d, ty * 4 + r, 3);
        _ca.copy(t.side).multiplyScalar(kk * jitter); _cb.copy(_ca).multiplyScalar(p === 'cliff' ? 0.9 : 0.78);
        sideQuad(k, tx, ty, d, yt, yb, _ca, _cb);
      }
    } else {
      sideQuad(k, tx, ty, d, myTop, nTop, cTop, cBot);
    }
  }
  // ---- pattern accents ----
  accents(k, t, tx, ty, v, defAt, decor, zd);
}

function waterTile(wk, t, tx, ty, defAt) {
  const deep = t.pattern === 'water';
  const ca = deep ? t.a : t.a, cb = deep ? t.b : t.b;
  const y = t.surf;
  const N = 2;
  const isWater = (x, yy) => { const d = defAt(x, yy); return !d || d.shape === 'water'; };
  // vertical faces: where the water leaves the map (down to the bed) and between deep water and the higher shallows
  const faceC = _cd.copy(ca).multiplyScalar(0.78);
  const faceB = _cc.copy(ca).multiplyScalar(0.55);
  for (let d = 0; d < 4; d++) {
    const n = defAt(tx + NB[d][0], ty + NB[d][1]);
    if (!n) sideQuad(wk, tx, ty, d, y, t.bed, faceC, faceB);
    else if (n.shape === 'water' && n.surf < y - 1e-4) sideQuad(wk, tx, ty, d, y, n.surf, faceC, faceC);
  }
  // foam at sub-vertex level: a sub-corner is foamy if a non-water tile touches it
  const foamAt = (sx, sy) => {
    // sx, sy in half-tile units relative to the tile origin (0..2)
    const wx = tx + sx / N, wy = ty + sy / N;
    let f = 0;
    for (const [ox, oy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      const qx = Math.floor(wx + ox * 0.5), qy = Math.floor(wy + oy * 0.5);
      if (!isWater(qx, qy)) f = 1;
    }
    return f;
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x0 = tx + i / N, x1 = tx + (i + 1) / N, z0 = ty + j / N, z1 = ty + (j + 1) / N;
      const pts = [[i, j], [i, j + 1], [i + 1, j + 1], [i + 1, j]];
      const cols = [_ca, _cb, _cc, _cd];
      const foam = [];
      for (let q = 0; q < 4; q++) {
        const [sx, sy] = pts[q];
        const f = foamAt(sx, sy);
        foam.push(f);
        const n = 0.5 + 0.5 * Math.sin((tx * N + sx) * 1.3 + (ty * N + sy) * 0.7);
        cols[q].copy(ca).lerp(cb, n * 0.6);
      }
      const base = wk.P.length / 3;
      wk.P.push(x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0);
      for (let q = 0; q < 4; q++) {
        wk.N.push(0, 1, 0);
        wk.Cl.push(cols[q].r, cols[q].g, cols[q].b, 1 - foam[q] * 0.85);
      }
      wk.I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      wk.tris += 2;
    }
  }
}

function accents(k, t, tx, ty, v, defAt, decor, zd) {
  const p = t.pattern;
  const r = (s) => hash2(tx, ty, s);
  const cx = tx + 0.5, cz = ty + 0.5;
  const top = t.top;
  switch (p) {
    case 'grass': {
      if (decor === 0 || (v & 7) > (decor === 2 ? 2 : 1)) break;
      const n = 2 + (v & 1);
      for (let i = 0; i < n; i++) {
        const x = tx + 0.15 + r(i) * 0.7, z = ty + 0.15 + r(i + 9) * 0.7;
        k.color(mul(t.b, 0.85 + 0.2 * r(i + 3))).add(T.cyl(0, 1, 3, true), [x, top + 0.07, z], [0.05, 0.14, 0.05], [0.25 * (r(i + 5) - 0.5), r(i + 7) * 2, 0.3 * (r(i + 6) - 0.5)]);
        k.add(T.cyl(0, 1, 3, true), [x + 0.05, top + 0.05, z + 0.02], [0.04, 0.1, 0.04], [0, 0, 0.4]);
      }
      break;
    }
    case 'flowers': {
      const n = decor === 0 ? 1 : decor === 1 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const x = tx + 0.18 + r(i) * 0.64, z = ty + 0.18 + r(i + 9) * 0.64;
        const pc = (i + v) % 2 ? t.b : t.side;
        k.color(mul(t.a, 0.7)).add(T.cyl(0, 1, 3, true), [x, top + 0.06, z], [0.02, 0.12, 0.02]);
        k.color(pc).add(T.sphere(5, 3), [x, top + 0.14, z], [0.1, 0.045, 0.1]);
        k.color('#fff6c8').add(T.sphere(4, 2), [x, top + 0.17, z], 0.035);
      }
      break;
    }
    case 'tallgrass': {
      const n = decor === 0 ? 2 : decor === 1 ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const x = tx + 0.12 + r(i) * 0.76, z = ty + 0.12 + r(i + 9) * 0.76;
        const hh = 0.24 + r(i + 4) * 0.16;
        k.color(i % 2 ? t.b : mix(t.a, t.b, 0.5)).add(T.cyl(0, 1, 3, true), [x, top + hh / 2, z], [0.06, hh, 0.06], [0.3 * (r(i + 5) - 0.5), r(i + 7) * 3, 0.3 * (r(i + 6) - 0.5)]);
      }
      break;
    }
    case 'dirt':
    case 'path':
    case 'sand':
    case 'wet_sand': {
      if (decor === 0) break;
      if ((v & 7) === 1 || (p === 'dirt' && (v & 7) === 2)) {
        const x = tx + 0.2 + r(1) * 0.6, z = ty + 0.2 + r(2) * 0.6;
        k.color(p === 'sand' ? mul(t.b, 0.9) : mul(t.b, 0.75)).add(T.dodeca(), [x, top + 0.02, z], [0.07, 0.04, 0.06], [r(3) * 3, r(4) * 3, 0]);
      }
      if ((p === 'sand' || p === 'wet_sand') && (v & 31) === 5) k.color('#ffc8d8').add(T.sphere(5, 3), [cx, top + 0.015, cz], [0.06, 0.03, 0.05]);
      if (p === 'path' && (v & 3) === 0) {
        // worn ruts: lighter speckle quads
        const c2 = lighten(t.a, 0.15);
        topQuad(k, tx + 0.2, ty + 0.3, tx + 0.45, ty + 0.5, top + 0.004, c2, c2, c2, c2);
      }
      break;
    }
    case 'cobble': {
      // 2x2 rounded stones, offset every other row
      const off = (ty % 2) * 0.25;
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 3; i++) {
          let x0 = tx + i * 0.5 - (j % 2 ? off : 0.25 - off) + 0.04, x1 = x0 + 0.5 - 0.08;
          if (x1 <= tx + 0.02 || x0 >= tx + 0.98) continue;
          x0 = Math.max(tx + 0.03, x0); x1 = Math.min(tx + 0.97, x1);
          if (x1 - x0 < 0.12) continue;
          const z0 = ty + j * 0.5 + 0.04, z1 = z0 + 0.42;
          const c0 = mix(t.a, t.b, hash2(tx * 3 + i, ty * 2 + j, 1) * 0.8);
          const hi = lighten(c0, 0.08);
          topQuad(k, x0, z0, x1, z1, top + 0.025, hi, c0, c0, hi);
        }
      }
      break;
    }
    case 'planks': {
      for (let j = 0; j < 3; j++) {
        const z0 = ty + j / 3 + 0.015, z1 = ty + (j + 1) / 3 - 0.015;
        const c0 = mix(t.a, t.b, hash2(tx, ty * 3 + j, 2) * 0.7);
        const split = ((tx + j * 2 + ty) % 3) === 0 ? 0.55 : 2;
        if (split < 1) {
          topQuad(k, tx, z0, tx + split - 0.01, z1, top + 0.015, c0, c0, c0, c0);
          const c1 = mix(t.a, t.b, hash2(tx, ty * 3 + j, 5) * 0.7);
          topQuad(k, tx + split + 0.01, z0, tx + 1, z1, top + 0.015, c1, c1, c1, c1);
        } else topQuad(k, tx, z0, tx + 1, z1, top + 0.015, c0, c0, c0, c0);
      }
      break;
    }
    case 'stone': {
      if (t.shape === 'block') break;
      const c0 = mix(t.a, t.b, hash2(tx, ty, 4) * 0.8);
      const hi = lighten(c0, 0.06);
      topQuad(k, tx + 0.04, ty + 0.04, tx + 0.96, ty + 0.96, top + 0.02, hi, c0, c0, hi);
      break;
    }
    case 'carpet': {
      for (let d = 0; d < 4; d++) {
        const n = defAt(tx + NB[d][0], ty + NB[d][1]);
        if (n && n.pattern === 'carpet') continue;
        const b = t.b, w = 0.14, y = top + 0.006;
        if (d === 0) topQuad(k, tx, ty, tx + 1, ty + w, y, b, b, b, b);
        if (d === 2) topQuad(k, tx, ty + 1 - w, tx + 1, ty + 1, y, b, b, b, b);
        if (d === 1) topQuad(k, tx + 1 - w, ty, tx + 1, ty + 1, y, b, b, b, b);
        if (d === 3) topQuad(k, tx, ty, tx + w, ty + 1, y, b, b, b, b);
      }
      if ((tx + ty) % 2 === 0) { const b = mix(t.a, t.b, 0.4); k.color(b).add(T.octa(), [cx, top + 0.004, cz], [0.16, 0.003, 0.16]); }
      break;
    }
    case 'starfloor': {
      const n = 1 + (v & 1) + (decor > 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        k.color(t.b, 1).add(T.octa(), [tx + 0.15 + r(i) * 0.7, top + 0.01, ty + 0.15 + r(i + 5) * 0.7], [0.05, 0.004, 0.05], [0, r(i + 2), 0]);
      }
      break;
    }
    case 'cloud': {
      for (let d = 0; d < 4; d++) {
        const n = defAt(tx + NB[d][0], ty + NB[d][1]);
        if (n && n.pattern === 'cloud') continue;
        const ex = cx + NB[d][0] * 0.4, ez = cz + NB[d][1] * 0.4;
        k.color(i2(t.b)).add(T.sphere(7, 5), [ex, top, ez], [0.3, 0.16, 0.3]);
      }
      break;
    }
    case 'snow': {
      // soft lumps, sparkles and the odd pebble on bright snow
      if (t.shape === 'block') {
        k.color(lighten(t.a, 0.3)).add(T.sphere(6, 3), [tx + 0.3 + r(1) * 0.4, top, ty + 0.3 + r(2) * 0.4], [0.3, 0.08, 0.26]);
        break;
      }
      if (decor > 0 && (v & 7) === 2) k.color(lighten(t.a, 0.2)).add(T.sphere(6, 3), [tx + 0.2 + r(1) * 0.6, top, ty + 0.2 + r(2) * 0.6], [0.16 + r(3) * 0.1, 0.05, 0.13]);
      if ((v & 7) === 5) k.color('#ffffff', 1).add(T.octa(), [tx + 0.2 + r(4) * 0.6, top + 0.012, ty + 0.2 + r(5) * 0.6], [0.035, 0.008, 0.035], [0, r(6), 0]);
      if (decor > 1 && (v & 15) === 9) k.color('#9aa8c0').add(T.dodeca(), [tx + 0.3 + r(7) * 0.4, top + 0.01, ty + 0.3 + r(8) * 0.4], [0.05, 0.03, 0.04]);
      break;
    }
    case 'ice': {
      // glassy floor: a pale streak and fine cracks
      if ((v & 3) === 1) {
        const c2 = lighten(t.b, 0.4);
        quad(k, tx + 0.15, top + 0.004, ty + 0.75, tx + 0.3, top + 0.004, ty + 0.85, tx + 0.8, top + 0.004, ty + 0.3, tx + 0.65, top + 0.004, ty + 0.2, c2, c2, c2, c2);
      }
      if ((v & 7) === 6) {
        const cc = mul(t.side, 0.85);
        k.color(cc).add(T.box(), [cx, top + 0.003, cz], [0.6, 0.004, 0.02], [0, r(1) * 3, 0]);
        k.add(T.box(), [cx + 0.15, top + 0.003, cz + 0.1], [0.3, 0.004, 0.02], [0, r(2) * 3, 0]);
      }
      break;
    }
    case 'sky': {
      // clouds far below, and a hanging rock under each island edge
      if ((v & 3) === 0 || (decor > 1 && (v & 3) === 2)) {
        const cc = (v & 16) ? t.b : mix(t.a, t.b, 0.6);
        k.color(cc).add(T.sphere(7, 4), [tx + 0.2 + r(1) * 0.6, -3.2 - r(2) * 1.2, ty + 0.2 + r(3) * 0.6], [0.7 + r(4) * 0.4, 0.22, 0.55 + r(5) * 0.3]);
      }
      for (let d = 0; d < 4; d++) {
        const n = defAt(tx + NB[d][0], ty + NB[d][1]);
        if (!n || n.pattern === 'sky' || n.shape === 'water') continue;
        if (hash2(tx * 4 + d, ty, 17) > 0.45) continue;
        const ex = cx + NB[d][0] * 0.55, ez = cz + NB[d][1] * 0.55;
        const hh = 0.5 + r(d + 20) * 0.7;
        k.color(mul(zd.rock, 0.85 + 0.2 * r(d + 30))).add(T.cone(6), [ex, SKY_DROP - hh / 2 + 0.05, ez], [0.3 + r(d + 24) * 0.15, hh, 0.3], [Math.PI, r(d + 28) * 3, 0]);
      }
      break;
    }
    case 'hedge': {
      const h = top;
      const c0 = mix(t.a, t.b, (v & 3) / 3), c1 = mix(t.a, t.b, 1 - (v & 3) / 3);
      k.color(c0).add(T.sphere(6, 4), [tx + 0.32, h + 0.02, ty + 0.38], [0.34, 0.2, 0.34], [0, r(2) * 3, 0]);
      k.color(c1).add(T.sphere(6, 4), [tx + 0.7, h + 0.03, ty + 0.66], [0.32, 0.18, 0.32], [0, r(4) * 3, 0]);
      if (decor > 0 && (v & 7) === 3) k.color('#ff8fc7').add(T.sphere(5, 3), [tx + 0.5, h + 0.2, ty + 0.62], 0.05);
      break;
    }
    case 'trees': {
      const n = (dx, dy) => { const d = defAt(tx + dx, ty + dy); return d && d.pattern === 'trees'; };
      const interior = n(0, -1) && n(1, 0) && n(0, 1) && n(-1, 0);
      const h = top;
      const lead = ((tx & 1) === 0 && (ty & 1) === 0);
      const southEdge = !n(0, 1);
      if (southEdge || (v & 3) === 0) {
        k.color(t.side).add(T.cyl(0.8, 1, 6), [cx + (r(1) - 0.5) * 0.2, h * 0.28, cz + 0.1], [0.12, h * 0.56, 0.12]);
      }
      const c0 = mix(t.a, t.b, r(3) * 0.8);
      if (!interior) {
        const R = 0.6 + r(2) * 0.12;
        k.color(c0).add(T.ico(1), [cx + (r(4) - 0.5) * 0.15, h * 0.72 + r(5) * 0.25, cz + (r(6) - 0.5) * 0.15], [R, R * 0.85, R], [r(7) * 3, r(8) * 3, 0]);
        if (decor > 0 && (v & 1)) k.color(mix(c0, '#a8e070', 0.3)).add(T.ico(0), [cx + (r(9) - 0.5) * 0.3, h * 0.72 + R * 0.62, cz + (r(10) - 0.5) * 0.3], R * 0.45, [r(11), r(12), 0]);
      } else {
        // interior: cheaper blobs, a big one on every other tile
        const R = lead ? 0.9 : 0.62;
        k.color(c0).add(T.sphere(8, 5), [cx + (lead ? 0.5 : 0), h * 0.7 + r(5) * 0.3, cz + (lead ? 0.5 : 0)], [R, R * 0.7, R], [0, r(8) * 3, 0]);
      }
      break;
    }
    case 'cliff': {
      if (decor > 0 && (v & 3) === 0) {
        const s = defAt(tx, ty + 1);
        if (s && s.top < top) k.color(mul(t.side, 0.85)).add(T.dodeca(), [cx + (r(1) - 0.5) * 0.5, (s.top || 0) + 0.08, ty + 1.1], [0.16, 0.12, 0.14], [r(2), r(3), 0]);
      }
      if ((v & 7) === 2) k.color('#7cc95a').add(T.dome(6, 2), [cx, top, cz], [0.2, 0.05, 0.18]);
      break;
    }
    case 'crystal': {
      const n = 2 + (v & 1);
      for (let i = 0; i < n; i++) {
        const x = tx + 0.25 + r(i) * 0.5, z = ty + 0.25 + r(i + 5) * 0.5;
        const hh = 0.35 + r(i + 2) * 0.35;
        const cc = i % 2 ? t.b : t.a;
        k.color(lighten(cc, 0.1), 0.35).add(T.cyl(1, 1, 6), [x, top + hh / 2, z], [0.09, hh, 0.09], [0.25 * (r(i + 3) - 0.5), 0, 0.3 * (r(i + 4) - 0.5)]);
        k.color(lighten(cc, 0.35), 0.45).add(T.cone(6), [x, top + hh + 0.06, z], [0.09, 0.14, 0.09], [0.25 * (r(i + 3) - 0.5), 0, 0.3 * (r(i + 4) - 0.5)]);
      }
      break;
    }
    case 'brick': {
      // cap stones along the top edge facing south
      const s = defAt(tx, ty + 1);
      if (!s || s.top < top) k.color(lighten(t.a, 0.12)).add(T.box(), [cx, top + 0.03, ty + 0.92], [1.0, 0.06, 0.18]);
      break;
    }
    default: break;
  }
}
function i2(c0) { return lighten(c0, 0.04); }

/**
 * Everything beyond the map bounds: one big ground plane plus a border ring that reads as intentional.
 * Outdoor zones: a dense canopy of round tree blobs in the zone's tree/hedge colors; the academy (interior):
 * a dark wall block ring. Round 3 biomes (palette.edge): `dunes` rolling dunes and sandstone mesas, `ocean` open
 * animated sea (water material) with sea stacks and foam along the shore, `mountains` snowy slopes, pines and peaks,
 * `sky` no ground at all: island undersides, hanging rocks and clouds far below.
 * Returns geometries (one per 16x16 cell of the ring, so the camera culls the far ones); a geometry with
 * userData.water uses the water material. The array carries `emitters` (drifting clouds) for the renderer.
 */
export function buildBorder(zd) {
  const zv = zd.zv, W = zv.w, H = zv.h;
  const pal = zv.palette || {};
  const interior = zv.id === 'academy' || pal.id === 'academy';
  const edge = interior ? null : zd.edge;
  const bg = C(pal.bg || '#2a3a4a');
  const EXT = 60, RING = interior ? 10 : 8;
  const kits = new Map();
  const kitFor = (x, y, water) => {
    const key = (water ? 'w' : '') + Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK);
    let k = kits.get(key);
    if (!k) { k = new Kit({ skin: false, line: false }); k.water = !!water; kits.set(key, k); }
    return k;
  };
  const emitters = [];
  const ground = new Kit({ skin: false, line: false });
  const gc = interior ? mul(bg, 0.8) : mul(mix(bg, '#1f3a28', 0.5), 0.9);
  // A frame OUTSIDE the map only (never under it: it used to hide water, shallows and pits), a little below the
  // deepest water bed so the map edge reads as a tabletop slab and the cross-section of a stream shows.
  const frame = (y, col) => {
    topQuad(ground, -EXT, -EXT, W + EXT, 0, y, col, col, col, col);
    topQuad(ground, -EXT, H, W + EXT, H + EXT, y, col, col, col, col);
    topQuad(ground, -EXT, 0, 0, H, y, col, col, col, col);
    topQuad(ground, W, 0, W + EXT, H, y, col, col, col, col);
  };
  const find = (p) => zd.defs.find((d) => d.pattern === p);
  const pat = (p, a, b, side) => {
    const q = (pal.patterns && pal.patterns[p]) || {};
    return { a: C(q.a || a), b: C(q.b || b || q.a || a), side: C(q.side || side || q.b || b || a) };
  };
  const h = (x, y, sd) => hash2(Math.floor(x * 7), Math.floor(y * 7), sd);
  const outside = (x, y, m) => !(x > -m && x < W + m && y > -m && y < H + m);
  /** Distance outside the map rectangle (0 inside). */
  const outDist = (x, y) => Math.hypot(Math.max(0, -x, x - W), Math.max(0, -y, y - H));
  /** Pattern of the map tile nearest to (x, y) (for shore decisions). */
  const edgeTile = (x, y) => {
    const tx = Math.max(0, Math.min(W - 1, Math.floor(x))), ty = Math.max(0, Math.min(H - 1, Math.floor(y)));
    return zd.defs[zv.tiles[ty * W + tx]];
  };
  const scatter = (step, fn, margin = 0.3) => {
    for (let y = -RING; y < H + RING; y += step) {
      for (let x = -RING; x < W + RING; x += step) {
        const jx = x + (hash2(Math.round(x * 3), Math.round(y * 3), 11) - 0.5) * step * 0.45;
        const jy = y + (hash2(Math.round(x * 3), Math.round(y * 3), 12) - 0.5) * step * 0.45;
        if (!outside(jx, jy, margin)) continue;
        fn(jx, jy);
      }
    }
  };

  if (interior) {
    frame(-0.5, gc);
    const wall = mix(bg, '#4a4a6e', 0.35), cap = mix(bg, '#6a6a90', 0.5), sk = mul(wall, 0.65);
    const hgt = 3.2;
    // wall slabs in 16-tile pieces (culling), plus a skirting stripe on the inner faces
    const slab = (x0, y0, x1, y1) => {
      for (let x = x0; x < x1; x += CHUNK) for (let y = y0; y < y1; y += CHUNK) {
        const xe = Math.min(x1, x + CHUNK), ye = Math.min(y1, y + CHUNK), k = kitFor(x, y);
        k.color(wall).add(T.box(), [(x + xe) / 2, hgt / 2, (y + ye) / 2], [xe - x, hgt, ye - y]);
        k.color(cap).add(T.box(), [(x + xe) / 2, hgt + 0.05, (y + ye) / 2], [xe - x - 0.01, 0.1, ye - y - 0.01]);
      }
    };
    slab(-RING, -RING, W + RING, 0); slab(-RING, H, W + RING, H + RING); slab(-RING, 0, 0, H); slab(W, 0, W + RING, H);
    for (let x = 0; x < W; x += CHUNK) { const xe = Math.min(W, x + CHUNK); kitFor(x, -1).color(sk).add(T.box(), [(x + xe) / 2, 0.3, -0.04], [xe - x, 0.6, 0.08]); kitFor(x, H + 1).color(sk).add(T.box(), [(x + xe) / 2, 0.3, H + 0.04], [xe - x, 0.6, 0.08]); }
    for (let y = 0; y < H; y += CHUNK) { const ye = Math.min(H, y + CHUNK); kitFor(-1, y).color(sk).add(T.box(), [-0.04, 0.3, (y + ye) / 2], [0.08, 0.6, ye - y]); kitFor(W + 1, y).color(sk).add(T.box(), [W + 0.04, 0.3, (y + ye) / 2], [0.08, 0.6, ye - y]); }
  } else if (edge === 'dunes') {
    // ---- Sunscorch Dunes: the sand rolls on; mesas of terracotta sandstone, the odd palm tuft and cactus
    const sand = pat('sand', '#f6d68e', '#e8c172', '#d6a45e');
    const rock = pat('cliff', '#eab47a', '#d69860', '#c87a4a');
    frame(-0.02, sand.a);
    // long smooth dune ridges lying with the wind (a sunlit face and a darker lee face), mesas further out
    const ridge = (k, x, y, len, wid, hh, yaw, c1, c2) => {
      k.color(c1).add(T.sphere(14, 6), [x, -0.04, y], [len, hh, wid], [0, yaw, 0]);
      k.color(c2).add(T.sphere(12, 5), [x - Math.sin(yaw) * wid * 0.35, -0.04, y - Math.cos(yaw) * wid * 0.35], [len * 0.92, hh * 0.86, wid * 0.62], [0, yaw, 0]);
    };
    scatter(3.4, (x, y) => {
      const r1 = h(x, y, 1), r2 = h(x, y, 2), d = outDist(x, y), south = y > H;
      const k = kitFor(x, y);
      if (!south && d > 3.5 && r1 < 0.16) {
        // a stepped sandstone mesa (strata in alternating tones)
        const tiers = 2 + Math.floor(r2 * 2), wdt = 1.5 + r2 * 1.4;
        let yy = 0;
        for (let i = 0; i < tiers; i++) {
          const th = 0.55 + h(x, y, 5 + i) * 0.4, ww = wdt * (1 - i * 0.22);
          k.color(i % 2 ? rock.b : rock.side).add(T.cyl(0.92, 1, 8), [x, yy + th / 2, y], [ww, th, ww * 0.8], [0, r1 * 6, 0]);
          yy += th;
        }
        k.color(rock.a).add(T.cyl(1, 1, 8), [x, yy + 0.02, y], [wdt * (1 - (tiers - 1) * 0.22) * 0.96, 0.05, wdt * 0.8 * (1 - (tiers - 1) * 0.22) * 0.96], [0, r1 * 6, 0]);
        return;
      }
      const near = Math.min(1, d / 3 + 0.45);
      const len = 1.8 + r1 * 1.6, wid = 1.0 + r2 * 0.5, hh = ((south ? 0.3 : 0.5) + r2 * (south ? 0.25 : 0.75)) * near;
      ridge(k, x, y, len, wid, hh, 0.35 + (r1 - 0.5) * 0.5, mix(sand.a, '#fff2c8', 0.25), mix(sand.a, sand.b, 0.75));
      if (d > 2 && r2 > 0.82) {
        // a cactus or a palm tuft on the crest
        if (r1 > 0.5) {
          k.color('#58b45e').add(T.capsule(1.4, 6), [x, hh + 0.3, y], [0.22, 0.28, 0.22]);
          k.color('#58b45e').add(T.capsule(1, 5), [x + 0.16, hh + 0.4, y], [0.12, 0.14, 0.12]);
          k.color('#ff7aa8').add(T.sphere(4, 3), [x, hh + 0.64, y], 0.05);
        } else {
          k.color('#a8764a').add(T.cyl(0.8, 1, 5), [x, hh + 0.5, y], [0.08, 1.0, 0.08], [0, 0, 0.12]);
          for (let i = 0; i < 6; i++) { const a = i * 1.05; k.color(i % 2 ? '#4fbf5a' : '#3fa850').add(T.sphere(5, 3), [x + 0.06 + Math.cos(a) * 0.32, hh + 1.0, y + Math.sin(a) * 0.32], [0.36, 0.05, 0.12], [0, -a, -0.35]); }
        }
      }
    });
  } else if (edge === 'ocean') {
    // ---- Gullwing Cove: open sea out to the horizon (water material: wobble + drifting highlights), foam at the
    // shore, sea stacks and buoys; where the map edge is land, a short grassy/sandy strip runs out first.
    const water = pat('water', '#24b4c8', '#58d6e0', '#1a90a8');
    const sandC = pat('sand', '#fbeec6', '#efdcaa', '#dcc48e');
    frame(-0.62, mul(water.side, 0.6));
    const SEA = -0.2;
    const isLandEdge = (x, y) => { const t = edgeTile(x, y); return t && t.shape !== 'water'; };
    // land strips beyond land edge tiles (2 tiles deep at the tile's own height and color)
    const strip = (tx, ty, dx, dy) => {
      const t = zd.defs[zv.tiles[ty * W + tx]];
      if (!t || t.shape === 'water') return;
      const top = t.shape === 'block' ? Math.min(t.top, 1.5) : (BASE_H[t.pattern] || 0);
      const col = t.shape === 'block' ? mix(t.a, t.side, 0.3) : mix(t.a, t.b, 0.3);
      const x0 = dx < 0 ? tx - 2 : dx > 0 ? tx + 1 : tx, x1 = dx < 0 ? tx : dx > 0 ? tx + 3 : tx + 1;
      const y0 = dy < 0 ? ty - 2 : dy > 0 ? ty + 1 : ty, y1 = dy < 0 ? ty : dy > 0 ? ty + 3 : ty + 1;
      const k = kitFor((x0 + x1) / 2, (y0 + y1) / 2);
      topQuad(k, x0, y0, x1, y1, top, col, col, col, col);
      // the strip's outer face down into the sea, in sand
      const sc = mul(sandC.side, 0.9);
      if (dx < 0) quad(k, x0, top, y0, x0, SEA - 0.1, y0, x0, SEA - 0.1, y1, x0, top, y1, sc, sc, sc, sc);
      if (dx > 0) quad(k, x1, top, y1, x1, SEA - 0.1, y1, x1, SEA - 0.1, y0, x1, top, y0, sc, sc, sc, sc);
      if (dy < 0) quad(k, x1, top, y0, x1, SEA - 0.1, y0, x0, SEA - 0.1, y0, x0, top, y0, sc, sc, sc, sc);
      if (dy > 0) quad(k, x0, top, y1, x0, SEA - 0.1, y1, x1, SEA - 0.1, y1, x1, top, y1, sc, sc, sc, sc);
      if (hash2(tx, ty, 31) < 0.35 && t.shape !== 'block') {
        // dune grass tufts
        const bx = (x0 + x1) / 2 + (hash2(tx, ty, 32) - 0.5), by = (y0 + y1) / 2 + (hash2(tx, ty, 33) - 0.5);
        for (let i = 0; i < 4; i++) k.color(i % 2 ? '#8cc860' : '#a8d870').add(T.cone(3), [bx + (i - 1.5) * 0.08, top + 0.15, by + (i % 2) * 0.06], [0.04, 0.3, 0.04], [0.15 * (i % 2 ? 1 : -1), 0, 0.3 * (i - 1.5)]);
      }
    };
    for (let x = 0; x < W; x++) { strip(x, 0, 0, -1); strip(x, H - 1, 0, 1); }
    for (let y = 0; y < H; y++) { strip(0, y, -1, 0); strip(W - 1, y, 1, 0); }
    // corners: fill the 2x2 notch when both neighbouring strips exist
    const cornerFill = (cx0, cy0, tx, ty) => {
      const t = zd.defs[zv.tiles[ty * W + tx]];
      if (!t || t.shape === 'water') return;
      const top = t.shape === 'block' ? Math.min(t.top, 1.5) : (BASE_H[t.pattern] || 0);
      const col = t.shape === 'block' ? mix(t.a, t.side, 0.3) : mix(t.a, t.b, 0.3);
      topQuad(kitFor(cx0 + 1, cy0 + 1), cx0, cy0, cx0 + 2, cy0 + 2, top, col, col, col, col);
    };
    cornerFill(-2, -2, 0, 0); cornerFill(W, -2, W - 1, 0); cornerFill(-2, H, 0, H - 1); cornerFill(W, H, W - 1, H - 1);
    // sea surface: 1-tile quads (the wobble needs vertices) near the map, 2-tile quads farther out
    const seaKit = (x, y) => kitFor(x, y, true);
    const OUT = 22;
    const vcol = new THREE.Color();
    const seaQuad = (x0, y0, x1, y1) => {
      const k = seaKit((x0 + x1) / 2, (y0 + y1) / 2);
      const base = k.P.length / 3;
      const pts = [[x0, y0], [x0, y1], [x1, y1], [x1, y0]];
      for (const [x, y] of pts) {
        k.P.push(x, SEA, y); k.N.push(0, 1, 0);
        const n = 0.5 + 0.5 * Math.sin(x * 0.9 + y * 0.6) * Math.sin(y * 0.7 - x * 0.3);
        vcol.copy(water.a).lerp(water.b, n * 0.5);
        const od = outDist(x, y);
        const xx = Math.max(0, Math.min(W - 0.01, x)), yy = Math.max(0, Math.min(H - 0.01, y));
        const land = isLandEdge(xx, yy);
        const foam = land ? (od > 1.6 && od < 2.6 ? 0.85 : od >= 2.6 && od < 3.3 ? 0.35 : 0) : (od < 0.6 ? 0.25 : 0);
        k.Cl.push(vcol.r, vcol.g, vcol.b, 1 - foam);
      }
      k.I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      k.tris += 2;
    };
    for (let y = -OUT; y < H + OUT; y++) {
      for (let x = -OUT; x < W + OUT; x++) {
        if (x >= 0 && x < W && y >= 0 && y < H) continue;
        const d = outDist(x + 0.5, y + 0.5);
        if (d > 8) { if ((x & 1) || (y & 1)) continue; seaQuad(x, y, x + 2, y + 2); } else seaQuad(x, y, x + 1, y + 1);
      }
    }
    // sea stacks with a tuft of grass, and red-white buoys
    scatter(3.1, (x, y) => {
      const r1 = h(x, y, 1), r2 = h(x, y, 2), d = outDist(x, y);
      if (d < 3 || r1 > 0.16) return;
      const k = kitFor(x, y);
      if (r2 < 0.6) {
        const hh = 0.6 + r2 * 1.4;
        k.color('#b4aca4').add(T.dodeca(), [x, SEA + hh * 0.4, y], [0.6 + r2 * 0.3, hh * 0.6, 0.5], [r1 * 5, r2 * 5, 0]);
        k.color('#9a948c').add(T.dodeca(), [x + 0.4, SEA + 0.15, y + 0.2], [0.35, 0.3, 0.3], [r2, r1, 0]);
        k.color('#7cc95a').add(T.dome(6, 2), [x, SEA + hh * 0.98, y], [0.35, 0.1, 0.3]);
      } else {
        k.color('#ffffff').add(T.cyl(0.6, 1, 8), [x, SEA + 0.25, y], [0.18, 0.5, 0.18]);
        k.color('#e05050').add(T.cyl(1, 1, 8), [x, SEA + 0.25, y], [0.17, 0.14, 0.17]);
        k.color('#ffd24a').add(T.sphere(5, 4), [x, SEA + 0.55, y], 0.07);
      }
    }, 3);
  } else if (edge === 'mountains') {
    // ---- Frostwhistle Peaks: snow fields, then snowy mountain slopes with evergreen pines; low to the south
    const snow = pat('snow', '#f6fbff', '#dde9f7', '#bfd2ea');
    const rock = pat('cliff', '#eef4fc', '#d6e2f0', '#94a6c4');
    const pineC = pat('trees', '#2f9670', '#24805e', '#7a5233');
    frame(0.075, snow.a);
    // near the map: low smooth snow drifts and pines; further out: big snow-capped peaks with pines at their feet
    scatter(2.6, (x, y) => {
      const r1 = h(x, y, 1), r2 = h(x, y, 2), d = outDist(x, y);
      if (d > 3.5) return;
      const k = kitFor(x, y);
      const south = y > H;
      const len = 1.4 + r1 * 1.2, wid = 0.8 + r2 * 0.5, hh = (south ? 0.18 : 0.3) + r2 * (south ? 0.18 : 0.35);
      k.color(mix(snow.a, '#ffffff', 0.15)).add(T.sphere(12, 5), [x, 0.03, y], [len, hh, wid], [0, r1 * 2, 0]);
      k.color(mix(snow.a, snow.b, 0.8)).add(T.sphere(10, 4), [x + 0.2, 0.03, y - wid * 0.3], [len * 0.85, hh * 0.85, wid * 0.55], [0, r1 * 2, 0]);
      if (r1 > (south ? 0.85 : 0.55)) pine(k, x + 0.5, y + 0.2, south ? 0.55 : 0.8 + r2 * 0.4, pineC, snow.a);
      if (!south && r2 > 0.7) pine(k, x - 0.6, y - 0.3, 0.7 + r1 * 0.3, pineC, snow.a);
    }, 0.3);
    const peak = (x, y, hh, R, r1) => {
      const k = kitFor(x, y);
      k.color(mix(rock.side, rock.b, 0.15)).add(T.cone(9), [x, hh / 2 - 0.05, y], [R, hh, R * 0.85], [0, r1 * 6, 0]);
      k.color(mul(rock.side, 0.85)).add(T.cone(7), [x + R * 0.45, hh * 0.3, y + R * 0.15], [R * 0.6, hh * 0.6, R * 0.5], [0, r1 * 4, 0]);
      k.color(snow.a).add(T.cone(9), [x, hh * 0.7, y + 0.02], [R * 0.62, hh * 0.62, R * 0.53], [0, r1 * 6, 0]);
      k.color(mix(snow.a, '#ffffff', 0.4)).add(T.cone(7), [x + R * 0.45, hh * 0.47, y + R * 0.16], [R * 0.3, hh * 0.27, R * 0.25], [0, r1 * 4, 0]);
      k.color(mix(snow.a, snow.b, 0.5)).add(T.sphere(10, 4), [x, 0.05, y + R * 0.45], [R * 1.05, 0.35, R * 0.55]);
    };
    for (let y = -RING - 4; y < H + 2; y += 4.2) {
      for (let x = -RING - 4; x < W + RING + 4; x += 4.2) {
        const jx = x + (h(x, y, 21) - 0.5) * 2, jy = y + (h(x, y, 22) - 0.5) * 2;
        const d = outDist(jx, jy);
        if (d < 4 || jy > H - 2) continue;
        const r1 = h(x, y, 23), r2 = h(x, y, 24);
        const hh = Math.min(6.5, 2 + (d - 4) * 0.55) * (0.8 + r1 * 0.45);
        peak(jx, jy, hh, hh * (0.6 + r2 * 0.25), r1);
        if (r2 > 0.5) pine(kitFor(jx, jy), jx + hh * 0.55, jy + hh * 0.4, 0.8 + r1 * 0.3, pineC, snow.a);
      }
    }
  } else if (edge === 'sky') {
    // ---- Aether Gardens: no ground at all. Hanging rocks under the map's rim, clouds far below, drifting puffs.
    const cloud = pat('cloud', '#ffffff', '#ece4ff', '#cfc2f0');
    const rk = zd.rock;
    const rim = (x, y, nx, ny) => {
      if (hash2(Math.floor(x), Math.floor(y), 41) > 0.5) return;
      const t = edgeTile(x - nx * 0.5, y - ny * 0.5);
      if (!t || t.pattern === 'sky') return;
      const hh = 0.6 + hash2(Math.floor(x), Math.floor(y), 43) * 1.4;
      kitFor(x, y).color(mul(rk, 0.85 + 0.2 * hash2(Math.floor(x), Math.floor(y), 47))).add(T.cone(6), [x - nx * 0.5, SKY_DROP - hh / 2 + 0.05, y - ny * 0.5], [0.45, hh, 0.4], [Math.PI, x + y, 0]);
    };
    for (let x = 0.5; x < W; x += 1) { rim(x, 0, 0, -1); rim(x, H, 0, 1); }
    for (let y = 0.5; y < H; y += 1) { rim(0, y, -1, 0); rim(W, y, 1, 0); }
    // a field of clouds far below
    scatter(3.2, (x, y) => {
      const r1 = h(x, y, 1), r2 = h(x, y, 2);
      if (r1 < 0.45) return;
      const k = kitFor(x, y);
      const yy = -3.6 - r2 * 2.4;
      const cc = r2 > 0.5 ? cloud.a : mix(cloud.a, cloud.b, 0.6);
      // a puffy cloud: a flat soft base and three round bumps on top
      k.color(mix(cc, cloud.b, 0.5)).add(T.sphere(12, 6), [x, yy, y], [1.5 + r1 * 0.6, 0.28, 0.95 + r2 * 0.4], [0, r1 * 3, 0]);
      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * (0.7 + r1 * 0.2), oz = (i === 1 ? -0.15 : 0.1);
        k.color(i === 1 ? mix(cc, '#ffffff', 0.5) : cc).add(T.sphere(10, 6), [x + ox, yy + 0.18 + (i === 1 ? 0.12 : 0), y + oz], [0.62 + (i === 1 ? 0.2 : 0), 0.42 + (i === 1 ? 0.1 : 0), 0.6]);
      }
      if (r1 > 0.9) {
        // a little far-off floating islet
        k.color(rk).add(T.cone(6), [x - 0.8, -1.6, y], [0.6, 1.2, 0.55], [Math.PI, 0, 0]);
        k.color(pat('grass', '#ace8a6', '#96da94').a).add(T.cyl(1, 1, 8), [x - 0.8, -0.98, y], [0.62, 0.1, 0.56]);
      }
    }, 0);
    // drifting puffs just below the rim and under the map's own sky voids
    let n = 0;
    for (let y = -6; y < H + 6 && n < 220; y += 4) for (let x = -6; x < W + 6 && n < 220; x += 4) {
      const inside = x >= 0 && x < W && y >= 0 && y < H;
      if (inside) {
        const t = edgeTile(x, y);
        if (!t || t.pattern !== 'sky') continue;
      }
      if (hash2(x, y, 51) < 0.5) continue;
      emitters.push({ type: 'cloud', x: x + 2 * hash2(x, y, 52), y: y + 2 * hash2(x, y, 53), h: -1.9 - hash2(x, y, 54) * 1.2, r: 5, s: 0.6 + hash2(x, y, 55) * 0.6, color: '#ffffff' });
      n++;
    }
  } else {
    frame(-0.5, gc);
    const src = find('trees') || find('hedge');
    const ca = src ? src.a : mix(bg, '#3f9a4a', 0.6), cb = src ? src.b : mix(bg, '#2f7a3a', 0.5);
    const blob = (x, y) => {
      const r1 = h(x, y, 1), r2 = h(x, y, 2), r3 = h(x, y, 3);
      const R = 0.9 + r1 * 0.55;
      kitFor(x, y).color(mix(ca, cb, r2)).add(T.ico(0), [x, 0.9 + r3 * 0.5, y], [R, R * 0.8, R], [r2 * 3, r1 * 3, 0]);
    };
    const STEP = 1.6;
    for (let y = -RING; y < H + RING; y += STEP) {
      for (let x = -RING; x < W + RING; x += STEP) {
        const jx = x + (hash2(Math.round(x * 3), Math.round(y * 3), 11) - 0.5) * 0.7, jy = y + (hash2(Math.round(x * 3), Math.round(y * 3), 12) - 0.5) * 0.7;
        if (jx > -0.3 && jx < W + 0.3 && jy > -0.3 && jy < H + 0.3) continue;
        blob(jx, jy);
      }
    }
    for (let x = -0.5; x < W + 1; x += STEP) { blob(x, -0.5); blob(x, H + 0.6); }
    for (let y = -0.5; y < H + 1; y += STEP) { blob(-0.5, y); blob(W + 0.6, y); }
  }
  const out = [];
  if (ground.vertexCount) out.push(ground.build());
  else out.push(null);
  for (const k of kits.values()) if (k.vertexCount) { const g = k.build(); if (k.water) g.userData.water = true; out.push(g); }
  out.emitters = emitters;
  return out;
}

/** A small snowy pine for the mountain border. */
function pine(k, x, y, sc, pineC, snowC) {
  k.color(pineC.side).add(T.cyl(0.8, 1, 5), [x, 0.15 * sc, y], [0.1 * sc, 0.3 * sc, 0.1 * sc]);
  for (let i = 0; i < 3; i++) {
    const yy = (0.45 + i * 0.38) * sc, r = (0.5 - i * 0.13) * sc;
    k.color(i % 2 ? pineC.b : pineC.a).add(T.cone(7), [x, yy, y], [r, 0.5 * sc, r]);
    k.color(snowC).add(T.cone(7), [x, yy + 0.12 * sc, y], [r * 0.62, 0.3 * sc, r * 0.62]);
  }
}
