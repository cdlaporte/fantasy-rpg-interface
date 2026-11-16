// Terrain + props as 16x16-tile chunk meshes. Per chunk: one toon mesh (props first so their triangles form
// the outlined index range, then terrain triangles, which are never outlined), one outline mesh (same buffers,
// drawRange = outlined range), one water mesh. Only visible faces are emitted: tops always, sides only where the
// neighbor is lower. Patterns are vertex-color variation plus small geometry accents (cobbles, planks, tufts,
// flowers, canopy blobs, crystals...). Zone edges get a dark "tabletop" skirt.
import * as THREE from 'three';
import { Kit, T, C, mul, mix, lighten } from './kit.js';
import { buildProp } from './props.js';

export const CHUNK = 16;

const BASE_H = { grass: 0.06, flowers: 0.06, tallgrass: 0.06, cloud: 0.06 };
const WATER = { water: { surf: -0.2, bed: -0.46 }, shallows: { surf: -0.07, bed: -0.17 } };
const PATTERNS = ['grass', 'flowers', 'tallgrass', 'dirt', 'path', 'cobble', 'sand', 'wet_sand', 'shallows', 'water', 'planks',
  'stone', 'carpet', 'brick', 'hedge', 'trees', 'cliff', 'crystal', 'cloud', 'starfloor'];

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
    else if (shape === 'pit') top = -1.2;
    else top = BASE_H[pattern] || 0;
    return { def: d, pattern, shape, a, b, side, top, bed, surf };
  });
  return { zv, defs };
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
    const n = defAt(tx + NB[d][0], ty + NB[d][1]);
    const nTop = n ? (n.pattern === 'trees' ? 0.01 : n.top) : -0.9;
    if (nTop >= myTop - 1e-4) continue;
    let cTop, cBot;
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
  accents(k, t, tx, ty, v, defAt, decor);
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

function accents(k, t, tx, ty, v, defAt, decor) {
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
 * a dark wall block ring. Returns geometries (one per 16x16 cell of the ring, so the camera culls the far ones).
 */
export function buildBorder(zd) {
  const zv = zd.zv, W = zv.w, H = zv.h;
  const pal = zv.palette || {};
  const interior = zv.id === 'academy' || pal.id === 'academy';
  const bg = C(pal.bg || '#2a3a4a');
  const EXT = 60, RING = interior ? 10 : 8;
  const kits = new Map();
  const kitFor = (x, y) => {
    const key = Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK);
    let k = kits.get(key);
    if (!k) { k = new Kit({ skin: false, line: false }); kits.set(key, k); }
    return k;
  };
  const ground = new Kit({ skin: false, line: false });
  const gc = interior ? mul(bg, 0.8) : mul(mix(bg, '#1f3a28', 0.5), 0.9);
  // A frame OUTSIDE the map only (never under it: it used to hide water, shallows and pits), a little below the
  // deepest water bed so the map edge reads as a tabletop slab and the cross-section of a stream shows.
  const FY = -0.5;
  topQuad(ground, -EXT, -EXT, W + EXT, 0, FY, gc, gc, gc, gc);
  topQuad(ground, -EXT, H, W + EXT, H + EXT, FY, gc, gc, gc, gc);
  topQuad(ground, -EXT, 0, 0, H, FY, gc, gc, gc, gc);
  topQuad(ground, W, 0, W + EXT, H, FY, gc, gc, gc, gc);
  if (interior) {
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
  } else {
    const find = (p) => zd.defs.find((d) => d.pattern === p);
    const src = find('trees') || find('hedge');
    const ca = src ? src.a : mix(bg, '#3f9a4a', 0.6), cb = src ? src.b : mix(bg, '#2f7a3a', 0.5);
    const h = (x, y, s) => hash2(Math.floor(x * 7), Math.floor(y * 7), s);
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
  const out = [ground.build()];
  for (const k of kits.values()) if (k.vertexCount) out.push(k.build());
  return out;
}
