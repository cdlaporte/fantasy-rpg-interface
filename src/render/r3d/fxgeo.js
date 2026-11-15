// Geometry for fx batches: small rgba vertex-colored meshes, white (tinted per instance), authored in the
// XY plane facing +Z unless noted (the batch orientation puts them on the ground, upright or billboarded).
import * as THREE from 'three';

function geo(pos, col, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

/** Soft disc: alpha a0 at the center fading to 0 at r = 1 (with an optional bright plateau). */
export function disc(seg = 18, plateau = 0, a0 = 1) {
  const pos = [0, 0, 0], col = [1, 1, 1, a0], idx = [];
  const rings = plateau > 0 ? [[plateau, a0], [1, 0]] : [[1, 0]];
  for (let r = 0; r < rings.length; r++) {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * rings[r][0], Math.sin(a) * rings[r][0], 0);
      col.push(1, 1, 1, rings[r][1]);
    }
  }
  for (let i = 0; i < seg; i++) idx.push(0, 1 + i, 1 + ((i + 1) % seg));
  if (rings.length > 1) {
    for (let i = 0; i < seg; i++) {
      const a = 1 + i, b = 1 + ((i + 1) % seg), c = 1 + seg + i, d = 1 + seg + ((i + 1) % seg);
      idx.push(a, c, d, a, d, b);
    }
  }
  return geo(pos, col, idx);
}

/** Ring: radial profile [[r, alpha], ...] (inner to outer). */
export function ring(profile, seg = 32, arc = Math.PI * 2, a0 = 0) {
  const pos = [], col = [], idx = [];
  const full = arc >= Math.PI * 2 - 1e-6;
  const cols = full ? seg : seg + 1;
  for (let p = 0; p < profile.length; p++) {
    for (let i = 0; i < cols; i++) {
      const a = a0 + (i / seg) * arc;
      pos.push(Math.cos(a) * profile[p][0], Math.sin(a) * profile[p][0], 0);
      col.push(1, 1, 1, profile[p][1]);
    }
  }
  for (let p = 0; p < profile.length - 1; p++) {
    for (let i = 0; i < seg; i++) {
      const i1 = full ? (i + 1) % seg : i + 1;
      const a = p * cols + i, b = p * cols + i1, c = (p + 1) * cols + i, d = (p + 1) * cols + i1;
      idx.push(a, c, d, a, d, b);
    }
  }
  return geo(pos, col, idx);
}

/**
 * Slash ribbon: an arc from angle 0 to `arc` (radians, CCW in XY) between radii [r0, 1], brightest at the
 * leading edge (angle = arc) and on the outer rim, fading toward the trailing end. Tapered tips.
 */
export function slashArc(arc, r0, seg = 20) {
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const a = u * arc;
    const taper = Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5) * (u > 0.92 ? 1 - (u - 0.92) / 0.08 * 0.7 : 1);
    const inner = 1 - (1 - r0) * taper;
    const alpha = Math.pow(u, 0.8);
    const rows = [[inner, 0], [inner + (1 - inner) * 0.45, alpha * 0.9], [1, alpha], [1.04, alpha * 0.35]];
    for (const [r, al] of rows) {
      pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      col.push(1, 1, 1, al);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let p = 0; p < 3; p++) {
      const a = i * 4 + p, b = (i + 1) * 4 + p;
      idx.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  return geo(pos, col, idx);
}

/** Filled sector (telegraph cone) from -arc/2 to arc/2 around +X, radius 1, faint fill and bright rim. */
export function fan(arc, seg = 16) {
  const pos = [0, 0, 0], col = [1, 1, 1, 0.25], idx = [];
  for (const [r, a] of [[0.9, 0.35], [0.97, 0.9], [1, 0.9]]) {
    for (let i = 0; i <= seg; i++) {
      const t = -arc / 2 + (i / seg) * arc;
      pos.push(Math.cos(t) * r, Math.sin(t) * r, 0);
      col.push(1, 1, 1, a);
    }
  }
  const n = seg + 1;
  for (let i = 0; i < seg; i++) idx.push(0, 1 + i, 2 + i);
  for (let p = 0; p < 2; p++) {
    for (let i = 0; i < seg; i++) {
      const a = 1 + p * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, d, a, d, b);
    }
  }
  return geo(pos, col, idx);
}

/** Rectangle from x 0..1, y -0.5..0.5: faint fill, bright border. */
export function rect() {
  const pos = [], col = [], idx = [];
  const xs = [0, 0.04, 0.96, 1], ys = [-0.5, -0.42, 0.42, 0.5];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    pos.push(xs[i], ys[j], 0);
    const edge = i === 0 || i === 3 || j === 0 || j === 3;
    col.push(1, 1, 1, edge ? 0.9 : 0.28);
  }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const a = j * 4 + i;
    idx.push(a, a + 1, a + 5, a, a + 5, a + 4);
  }
  return geo(pos, col, idx);
}

/** Ribbon along +X from 0..1, soft across y (width 1). For beams and trails. */
export function ribbon(taper = false) {
  const pos = [], col = [], idx = [];
  const seg = 6;
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const w = taper ? Math.pow(u, 0.7) : 1;
    const a = taper ? u : 1;
    for (const [y, al] of [[-0.5, 0], [-0.17, 0.85], [0, 1], [0.17, 0.85], [0.5, 0]]) {
      pos.push(u, y * w, 0);
      col.push(1, 1, 1, al * a);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let p = 0; p < 4; p++) {
      const a = i * 5 + p, b = (i + 1) * 5 + p;
      idx.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  return geo(pos, col, idx);
}

/** Jagged lightning ribbon from y = 0 to y = 1 (two crossed strips so it reads from any side). */
export function bolt(seed = 3) {
  const pos = [], col = [], idx = [];
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pts = [[0, 0]];
  const n = 9;
  for (let i = 1; i < n; i++) pts.push([(rnd() - 0.5) * 0.22, i / n]);
  pts.push([0, 1]);
  for (let strip = 0; strip < 2; strip++) {
    const base = pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const w = 0.035 + 0.02 * Math.sin(i * 1.7);
      for (const [o, a] of [[-w * 2.4, 0], [-w, 1], [w, 1], [w * 2.4, 0]]) {
        if (strip === 0) pos.push(x + o, y, 0); else pos.push(x, y, o);
        col.push(1, 1, 1, a);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) {
      for (let p = 0; p < 3; p++) {
        const a = base + i * 4 + p, b = base + (i + 1) * 4 + p;
        idx.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }
  return geo(pos, col, idx);
}

/** Open cylinder r 1, y 0..1, alpha fading toward the top; optional bright rim at the bottom. */
export function pillar(seg = 16) {
  const pos = [], col = [], idx = [];
  const rows = [[0, 0.95], [0.25, 0.7], [0.65, 0.3], [1, 0]];
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a), rows[r][0], Math.sin(a));
      col.push(1, 1, 1, rows[r][1]);
    }
  }
  for (let r = 0; r < rows.length - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, d, a, d, b);
    }
  }
  return geo(pos, col, idx);
}

/** Hemisphere r 1 with transparent top and bright rim near the ground (bubble / barrier). */
export function dome(seg = 20, rings = 7) {
  const pos = [], col = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const v = j / rings;
    const phi = v * Math.PI / 2;
    const y = Math.sin(phi), r = Math.cos(phi);
    const a = 0.12 + 0.75 * Math.pow(1 - v, 3) + (j === rings ? 0 : 0);
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(t) * r, y, Math.sin(t) * r);
      // hex-ish shimmer bands
      col.push(1, 1, 1, a + ((i + j) % 2 ? 0.05 : 0));
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  return geo(pos, col, idx);
}

/** 4-point star sparkle in XY. */
export function star4() {
  const pos = [0, 0, 0], col = [1, 1, 1, 1], idx = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.22 : 1;
    pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    col.push(1, 1, 1, i % 2 ? 0.8 : 0);
  }
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + ((i + 1) % n));
  return geo(pos, col, idx);
}

/** 5-point star (stun, crowns). Solid. */
export function star5() {
  const pos = [0, 0, 0], col = [1, 1, 1, 1], idx = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.45 : 1;
    pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    col.push(1, 1, 1, 1);
  }
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + ((i + 1) % n));
  return geo(pos, col, idx);
}

/** Flat solid polygon shapes from point lists (icons). Each list is a convex-ish fan around its centroid. */
function polys(list, alpha = 1) {
  const pos = [], col = [], idx = [];
  for (const pts of list) {
    const base = pos.length / 3;
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; }
    cx /= pts.length; cy /= pts.length;
    pos.push(cx, cy, 0); col.push(1, 1, 1, alpha);
    for (const p of pts) { pos.push(p[0], p[1], 0); col.push(1, 1, 1, alpha); }
    for (let i = 0; i < pts.length; i++) idx.push(base, base + 1 + i, base + 1 + ((i + 1) % pts.length));
  }
  return geo(pos, col, idx);
}

const box2 = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export const plus = () => polys([box2(-0.33, -1, 0.33, 1), box2(-1, -0.33, 1, 0.33)]);
export const bang = () => polys([[[-0.28, -0.2], [0.28, -0.2], [0.38, 1], [-0.38, 1]], box2(-0.3, -1, 0.3, -0.5)]);
export const arrowUp = () => polys([[[0, 1], [0.9, 0.1], [-0.9, 0.1]], box2(-0.38, -1, 0.38, 0.15)]);
export const zee = () => polys([box2(-0.8, 0.6, 0.8, 1), box2(-0.8, -1, 0.8, -0.6), [[0.35, 0.6], [0.8, 0.6], [-0.35, -0.6], [-0.8, -0.6]]]);
/** Target reticle: ring + 4 ticks. */
export function reticle() {
  const r = ring([[0.62, 1], [0.8, 1]], 24);
  const t = polys([box2(-0.1, 0.75, 0.1, 1.15), box2(-0.1, -1.15, 0.1, -0.75), box2(0.75, -0.1, 1.15, 0.1), box2(-1.15, -0.1, -0.75, 0.1)]);
  return merge([r, t]);
}

/** Rune circle: double ring with glyph ticks. */
export function runeCircle() {
  const parts = [ring([[0.86, 0], [0.9, 1], [0.95, 1], [1, 0]], 40), ring([[0.6, 0], [0.63, 0.9], [0.66, 0.9], [0.69, 0]], 32)];
  const glyphs = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const R = 0.77;
    const p = (dx, dy) => [c * (R + dy) - s * dx, s * (R + dy) + c * dx];
    glyphs.push(i % 2 ? [p(-0.05, -0.06), p(0.05, -0.06), p(0.02, 0.07), p(-0.02, 0.07)] : [p(0, -0.07), p(0.06, 0), p(0, 0.07), p(-0.06, 0)]);
  }
  parts.push(polys(glyphs, 0.9));
  // hexagon lattice (neutral: no five-pointed star)
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
    const x0 = Math.cos(a0) * 0.6, y0 = Math.sin(a0) * 0.6, x1 = Math.cos(a1) * 0.6, y1 = Math.sin(a1) * 0.6;
    const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) / 0.015;
    lines.push([[x0 + nx / l, y0 + ny / l], [x1 + nx / l, y1 + ny / l], [x1 - nx / l, y1 - ny / l], [x0 - nx / l, y0 - ny / l]]);
  }
  parts.push(polys(lines, 0.7));
  return merge(parts);
}

/** Ground crack decal: jagged dark rays from the center, radius 1. */
export function crack(seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const list = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    let a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    let x = Math.cos(a) * 0.12, y = Math.sin(a) * 0.12;
    let w = 0.06;
    const segs = 3 + ((rnd() * 2) | 0);
    for (let j = 0; j < segs; j++) {
      a += (rnd() - 0.5) * 0.9;
      const len = (0.85 / segs) * (0.7 + rnd() * 0.6);
      const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
      const px = -Math.sin(a), py = Math.cos(a);
      const w2 = w * 0.6;
      list.push([[x + px * w, y + py * w], [nx + px * w2, ny + py * w2], [nx - px * w2, ny - py * w2], [x - px * w, y - py * w]]);
      x = nx; y = ny; w = w2;
    }
  }
  const g = polys(list, 1);
  return g;
}

/** Teardrop flame (XY, base at y = 0, tip at y = 1), soft edges. */
export function flame() {
  const pos = [0, 0.32, 0], col = [1, 1, 1, 1], idx = [];
  const n = 14;
  for (const [s, al] of [[0.78, 0.95], [1, 0]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const y = Math.sin(a), x = Math.cos(a);
      const yy = y > 0 ? 0.32 + y * 0.68 * s : 0.32 + y * 0.32 * s;
      const xx = x * 0.32 * s * (y > 0 ? (1 - y) * 0.9 + 0.1 : 1);
      pos.push(xx, yy, 0);
      col.push(1, 1, 1, al);
    }
  }
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + ((i + 1) % n));
  for (let i = 0; i < n; i++) {
    const a = 1 + i, b = 1 + ((i + 1) % n), c = 1 + n + i, d = 1 + n + ((i + 1) % n);
    idx.push(a, c, d, a, d, b);
  }
  return geo(pos, col, idx);
}

/** Lit-looking puff ball: icosphere with baked top light (rgba, a = 1). */
export function puff() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    const l = 0.72 + 0.28 * Math.max(0, y * 0.8 + z * 0.4);
    col.push(l, l, l * 1.02, 1);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  return g;
}

/** Shaded debris chunk (cube) / shard (octahedron). */
export function solid(kind) {
  const g = kind === 'cube' ? new THREE.BoxGeometry(1, 1, 1).toNonIndexed() : new THREE.OctahedronGeometry(1, 0);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  const col = [];
  for (let i = 0; i < n.count; i++) {
    const l = 0.6 + 0.4 * Math.max(0, n.getY(i) * 0.75 + n.getZ(i) * 0.35 + 0.2);
    col.push(l, l, l, 1);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  return g;
}

/** Unit quad (screen flash). */
export function quad() {
  return geo([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [0, 1, 2, 0, 2, 3]);
}

/** Merge rgba indexed geometries. */
export function merge(list) {
  const pos = [], col = [], idx = [];
  for (const g of list) {
    const base = pos.length / 3;
    pos.push(...g.attributes.position.array);
    col.push(...g.attributes.color.array);
    const ix = g.index ? g.index.array : [...Array(g.attributes.position.count).keys()];
    for (const i of ix) idx.push(base + i);
    g.dispose();
  }
  return geo(pos, col, idx);
}
