// Round 3 biome prop models (docs/BIOMES.md): desert, beach, snow and sky-garden toys. Same conventions as props.js:
// the kit matrix is at the footprint center on the ground (x east, z south = toward the camera), w/d = footprint in
// tiles, builders return emitters [{type, x, y, h, color, ...}] relative to the center. Small details are lineless.
import * as THREE from 'three';
import { T, C, tpl, mul, mix, lighten, darken } from './kit.js';

const c = (L, key, d) => C((L && L[key]) || d);
const hex = (col) => '#' + C(col).getHexString();
const V = (L) => (L && L.variant) | 0;

/** A vertical extrusion of a top-down outline (x, z) of height h (template key must be unique per outline). */
const slab = (key, pts) => tpl('slab_' + key, () => {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], -pts[i][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);         // extrusion along +y, outline in the xz plane
  g.deleteAttribute('uv');
  return g;
});
const lensPts = (n, tip) => {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pts.push([-Math.cos(a) * 0.5, Math.pow(Math.sin(a), tip) * 0.5]); }
  for (let i = n - 1; i > 0; i--) { const a = (i / n) * Math.PI; pts.push([-Math.cos(a) * 0.5, -Math.pow(Math.sin(a), tip) * 0.5]); }
  return pts;
};
const amphoraT = () => T.lathe('amphora', [[0, 0], [0.18, 0], [0.32, 0.12], [0.5, 0.42], [0.46, 0.66], [0.26, 0.82], [0.2, 0.92], [0.27, 1], [0.2, 1]], 12);
const potLowT = () => T.lathe('potlow', [[0, 0], [0.55, 0.02], [0.92, 0.25], [1, 0.5], [0.85, 0.8], [0.6, 0.92], [0.66, 1], [0.5, 1]], 12);
const domeT = () => T.dome(14, 6);

// ---------------------------------------------------------------- dunes

export function palm(k, L, w, d, rnd) {
  const trunk = c(L, 'trunk', '#b08050'), leaves = c(L, 'leaves', '#3fbf6a'), nuts = c(L, 'nuts', '#7a4e2c');
  const v = V(L);
  const segs = v === 1 ? 8 : v === 2 ? 6 : 7;
  const bend = (v === 2 ? 0.16 : 0.07) * (rnd() < 0.5 ? 1 : -1);
  const segH = v === 1 ? 0.32 : 0.29;
  let x = 0, y = 0.02, ang = 0;
  const yaw = rnd() * Math.PI * 2;
  k.push().tf(0, 0, 0, 0, yaw, 0);
  k.color(mul(trunk, 0.85)).add(T.cyl(1, 1, 7), [0, 0.04, 0], [0.16, 0.08, 0.16]);
  for (let i = 0; i < segs; i++) {
    const r = 0.11 - i * 0.006;
    ang += bend;
    const dx = Math.sin(ang) * segH, dy = Math.cos(ang) * segH;
    k.color(i % 2 ? trunk : mul(trunk, 0.88)).add(T.cyl(0.85, 1, 7), [x + dx / 2, y + dy / 2, 0], [r, segH * 1.08, r], [0, 0, -ang]);
    k.lineless = true;
    k.color(mul(trunk, 0.7)).add(T.cyl(1, 1, 7), [x + dx, y + dy - 0.02, 0], [r * 1.12, 0.03, r * 1.12], [0, 0, -ang]);
    k.lineless = false;
    x += dx; y += dy;
  }
  // crown: drooping fronds in two segments, coconuts under them
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const col = i % 2 ? leaves : mul(leaves, 0.86);
    k.push().tf(x, y + 0.04, 0, 0, a, 0);
    k.color(col).add(T.sphere(7, 3), [0.3, 0.06, 0], [0.34, 0.05, 0.13], [0, 0, 0.18]);
    k.color(lighten(col, 0.08)).add(T.sphere(7, 3), [0.72, -0.12, 0], [0.26, 0.04, 0.1], [0, 0, -0.55]);
    k.lineless = true;
    k.color(mul(col, 0.7)).add(T.box(), [0.45, 0.06, 0], [0.62, 0.012, 0.012], [0, 0, -0.12]);
    k.lineless = false;
    k.pop();
  }
  k.color(mix(leaves, '#ffffff', 0.1)).add(T.sphere(6, 4), [x, y + 0.1, 0], [0.13, 0.1, 0.13]);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.5;
    k.color(i === 1 ? lighten(nuts, 0.15) : nuts).add(T.sphere(6, 5), [x + Math.cos(a) * 0.1, y - 0.06, Math.sin(a) * 0.1], 0.075);
  }
  k.pop();
  return [];
}

export function cactus(k, L, w, d, rnd) {
  const body = c(L, 'body', '#4caf5a'), fl = c(L, 'flower', '#ff7aa8');
  const v = V(L);
  const spines = (n, x0, y0, z0, rx, hy) => {
    k.lineless = true;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, yy = y0 + rnd() * hy;
      k.color('#fffbe6').add(T.sphere(3, 2), [x0 + Math.cos(a) * rx, yy, z0 + Math.abs(Math.sin(a)) * rx], 0.018);
    }
    k.lineless = false;
  };
  const ribs = (x0, y0, h, r) => {
    k.lineless = true;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI + 0.3;
      k.color(mul(body, 0.78)).add(T.box(), [x0 + Math.cos(a) * r * 0.98, y0, Math.sin(a) * r * 0.98], [0.018, h, 0.018]);
    }
    k.lineless = false;
  };
  if (v === 1) {
    // round barrel cactus with a flower crown
    k.color(body).add(T.sphere(10, 7), [0, 0.3, 0], [0.34, 0.32, 0.34]);
    ribs(0, 0.32, 0.4, 0.33);
    k.color(fl).add(T.sphere(7, 4), [0, 0.62, 0], [0.12, 0.05, 0.12]);
    for (let i = 0; i < 5; i++) { const a = i * 1.257; k.color(i % 2 ? fl : lighten(fl, 0.3)).add(T.sphere(5, 3), [Math.cos(a) * 0.1, 0.62, Math.sin(a) * 0.1], [0.07, 0.035, 0.07]); }
    spines(10, 0, 0.12, 0, 0.33, 0.38);
    k.color(mix(body, '#d8b070', 0.6)).add(T.sphere(6, 4), [0.3, 0.07, 0.15], [0.1, 0.06, 0.09]);
    return [];
  }
  if (v === 2) {
    // prickly pear: stacked paddles with pink fruit
    const pads = [[0, 0.28, 0, 0.2, 0.26, 0], [0.18, 0.62, 0.02, 0.15, 0.2, -0.5], [-0.17, 0.58, -0.02, 0.15, 0.19, 0.55], [0.02, 0.86, 0.04, 0.12, 0.15, 0.1]];
    pads.forEach(([x, y, z, rx, ry, rz], i) => k.color(i % 2 ? body : mul(body, 0.92)).add(T.sphere(9, 6), [x, y, z], [rx, ry, 0.07], [0, (i - 1.5) * 0.3, rz]));
    for (const [x, y] of [[0.28, 0.82], [-0.27, 0.77], [0.04, 1.02], [0.12, 0.98]]) k.color(fl).add(T.sphere(6, 4), [x, y, 0.03], [0.05, 0.065, 0.05]);
    spines(10, 0, 0.15, 0.05, 0.12, 0.8);
    return [];
  }
  // saguaro: trunk with two raised arms and a flower on top
  const H = 1.25;
  k.color(body).add(T.capsule(1.6, 8), [0, H / 2 + 0.02, 0], [0.34, H / 2.6, 0.34]);
  ribs(0, H / 2, H * 0.8, 0.165);
  for (const s of [1, -1]) {
    const ay = s > 0 ? 0.55 : 0.42, ah = s > 0 ? 0.42 : 0.34;
    k.color(mul(body, 0.95)).add(T.capsule(1, 6), [s * 0.2, ay, 0], [0.16, 0.16, 0.16], [0, 0, Math.PI / 2]);
    k.color(body).add(T.capsule(1.6, 6), [s * 0.3, ay + ah / 2, 0], [0.2, ah / 2.4, 0.2]);
    k.color(fl).add(T.sphere(5, 3), [s * 0.3, ay + ah + 0.05, 0], [0.06, 0.04, 0.06]);
  }
  k.color(fl).add(T.sphere(7, 4), [0, H + 0.13, 0], [0.11, 0.06, 0.11]);
  k.color('#ffe066').add(T.sphere(4, 3), [0, H + 0.17, 0], 0.035);
  spines(16, 0, 0.15, 0, 0.17, H * 0.9);
  return [];
}

export function ruin_pillar(k, L, w, d, rnd) {
  const stone = c(L, 'stone', '#e2c08a'), trim = c(L, 'trim', '#c9a26a');
  const sand = mix(stone, '#f4d48a', 0.55);
  const v = V(L);
  if (v === 2) {
    // a broken wall segment (w tiles long) with a small arched window
    const W = w * 0.92;
    const courses = 4, ch = 0.3;
    for (let r = 0; r < courses; r++) {
      const n = Math.round(W / 0.5) + (r % 2);
      const bw = W / n;
      for (let i = 0; i < n; i++) {
        const xx = -W / 2 + bw * (i + 0.5) - (r % 2 ? bw / 2 : 0);
        if (xx < -W / 2 || xx > W / 2) continue;
        const top = r === courses - 1 && (i % 3 === 1 || rnd() < 0.3);
        if (r >= 2 && Math.abs(xx) < 0.22) continue;     // the window
        if (top) continue;
        k.color(mix(stone, trim, (i + r) % 3 === 0 ? 0.35 : 0.05 * ((i * 7 + r) % 3))).add(T.box(), [xx, 0.15 + r * ch, 0], [bw - 0.03, ch - 0.03, 0.42]);
      }
    }
    k.color(trim).add(T.torus(0.3, 4, 10, Math.PI), [0, 0.75, 0], [0.22, 0.2, 0.7]);
    k.color(sand).add(T.sphere(8, 4), [0.3, 0.02, 0.2], [0.5, 0.12, 0.3]);
    k.color(mul(stone, 0.95)).add(T.box(), [-W * 0.3, 0.08, 0.38], [0.36, 0.16, 0.26], [0, 0.5, 0.1]);
    return [];
  }
  const broken = v === 1;
  k.color(trim).add(T.box(), [0, 0.07, 0], [0.74, 0.14, 0.74]);
  k.color(mul(trim, 1.06)).add(T.box(), [0, 0.18, 0], [0.62, 0.08, 0.62]);
  const H = broken ? 0.8 : 1.62;
  k.color(stone).add(T.cyl(0.92, 1, 12), [0, 0.22 + H / 2, 0], [0.24, H, 0.24]);
  k.lineless = true;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI + 0.25;
    k.color(mul(stone, 0.82)).add(T.box(), [Math.cos(a) * 0.228, 0.22 + H / 2, Math.sin(a) * 0.228], [0.025, H * 0.94, 0.02], [0, -a, 0]);
  }
  k.lineless = false;
  if (broken) {
    k.color(stone).add(T.dodeca(), [0.02, 0.22 + H, 0], [0.24, 0.11, 0.23], [0.4, 0.3, 0.2]);
    // the fallen drum
    k.color(mul(stone, 0.95)).add(T.cyl(1, 1, 12), [0.32, 0.14, 0.3], [0.2, 0.42, 0.2], [Math.PI / 2, 0.6, 0]);
    k.color(lighten(stone, 0.12)).add(T.dodeca(), [-0.28, 0.06, 0.3], [0.1, 0.07, 0.09], [rnd(), rnd(), 0]);
  } else {
    k.color(trim).add(T.cyl(1, 0.8, 12), [0, 0.22 + H + 0.06, 0], [0.32, 0.12, 0.32]);
    k.color(stone).add(T.box(), [0, 0.22 + H + 0.17, 0], [0.7, 0.12, 0.7]);
    k.lineless = true;
    k.color(mul(trim, 0.8)).add(T.box(), [0.08, 0.22 + H * 0.55, 0.235], [0.02, 0.3, 0.01], [0, 0, 0.4]);
    k.lineless = false;
  }
  k.color(sand).add(T.sphere(8, 4), [0.12, 0.05, 0.22], [0.4, 0.1, 0.22]);
  return [];
}

export function obelisk(k, L, w, d, rnd) {
  const stone = c(L, 'stone', '#d8b880'), glyph = c(L, 'glyph', '#3fa0c0');
  const star = V(L) === 1;
  k.color(mul(stone, 0.85)).add(T.box(), [0, 0.09, 0], [0.82, 0.18, 0.82]);
  k.color(mul(stone, 0.93)).add(T.box(), [0, 0.24, 0], [0.62, 0.12, 0.62]);
  const H = 2.15;
  k.color(stone).add(T.cyl(0.62, 1, 4), [0, 0.3 + H / 2, 0], [0.33, H, 0.33], [0, Math.PI / 4, 0]);
  const tipY = 0.3 + H;
  k.color(star ? glyph : mix(stone, '#ffd24a', 0.65), star ? 0.6 : 0.15).add(T.cone(4), [0, tipY + 0.15, 0], [0.22, 0.3, 0.22], [0, Math.PI / 4, 0]);
  // glyphs on the south face (glowing)
  k.lineless = true;
  const fz = (y) => 0.235 - (y - 0.3) / H * 0.085;
  const rows = [[0.62, 'o'], [0.9, '-'], [1.18, 'v'], [1.46, 'o'], [1.74, '-']];
  for (const [y, s] of rows) {
    const z = fz(y) + 0.01;
    if (s === 'o') k.color(glyph, 0.85).add(T.torus(0.3, 3, 8), [0, y, z], [0.06, 0.06, 0.03]);
    else if (s === '-') { k.color(glyph, 0.85).add(T.box(), [0, y, z], [0.16, 0.03, 0.01]); k.color(glyph, 0.85).add(T.box(), [0, y + 0.06, z], [0.03, 0.08, 0.01]); }
    else k.color(glyph, 0.85).add(T.octa(), [0, y, z], [0.06, 0.08, 0.01]);
  }
  if (star) k.color('#ffffff', 1).add(T.octa(), [0, 1.2, fz(1.2) + 0.02], [0.03, 0.03, 0.01]);
  k.lineless = false;
  k.color(mix(stone, '#f4d48a', 0.5)).add(T.sphere(8, 4), [-0.2, 0.05, 0.3], [0.32, 0.08, 0.18]);
  return [{ type: 'rune', x: 0, y: 0.25, h: 1.2, color: hex(glyph) }];
}

export function pottery(k, L, w, d, rnd) {
  const clay = c(L, 'clay', '#d0784a'), paint = c(L, 'paint', '#3f8fb0');
  const v = V(L);
  const band = (x, y, z, r) => {
    k.lineless = true;
    k.color(paint).add(T.cyl(1, 1, 12), [x, y, z], [r, 0.04, r]);
    k.color(lighten(paint, 0.4)).add(T.cyl(1, 1, 12), [x, y + 0.045, z], [r * 0.99, 0.012, r * 0.99]);
    k.lineless = false;
  };
  if (v === 1) {
    k.color(clay).add(amphoraT(), [0, 0, 0], [0.7, 0.95, 0.7]);
    band(0, 0.45, 0, 0.34);
    for (const s of [1, -1]) k.color(mul(clay, 0.9)).add(T.torus(0.25, 4, 8, Math.PI), [s * 0.17, 0.74, 0], [0.09, 0.1, 0.09], [0, 0, s > 0 ? -1.2 : 1.2 + Math.PI]);
    k.color(mix(clay, '#f4d48a', 0.5)).add(T.sphere(6, 4), [0.25, 0.04, 0.12], [0.18, 0.06, 0.12]);
    return [];
  }
  const pots = v === 2 ? [[-0.16, 0.06, 0.4], [0.2, -0.1, 0.33], [0.04, 0.2, 0.28]] : [[0, 0, 0.42], [0.3, 0.22, 0.2]];
  pots.forEach(([x, z, s], i) => {
    const col = i % 2 ? mix(clay, '#ffffff', 0.12) : clay;
    k.color(col).add(potLowT(), [x, 0, z], [s * 0.8, s * 1.15, s * 0.8]);
    band(x, s * 0.55, z, s * 0.8);
    k.color(mul(col, 0.5)).add(T.cyl(1, 1, 10), [x, s * 1.15 + 0.005, z], [s * 0.42, 0.01, s * 0.42]);
  });
  return [];
}

export function dune(k, L, w, d, rnd) {
  // a low, soft sand drift spilling over the tile edges (walkable: no outline, barely raised)
  const sand = c(L, 'sand', '#f0d090'), shade = c(L, 'shade', '#d8b070');
  const big = V(L) === 1;
  const a = (rnd() - 0.5) * 0.8;
  k.push().tf(0, 0, 0, 0, a, 0);
  k.lineless = true;
  k.color(lighten(sand, 0.06)).add(T.sphere(12, 4), [0, 0.0, 0.05], [big ? 0.95 : 0.75, big ? 0.13 : 0.09, big ? 0.55 : 0.45]);
  k.color(mix(sand, shade, 0.55)).add(T.sphere(10, 3), [0.08, 0.0, -0.18], [big ? 0.8 : 0.6, big ? 0.11 : 0.075, 0.28]);
  for (let i = -1; i <= 1; i++) k.color(mix(sand, shade, 0.7)).add(T.sphere(6, 2), [i * 0.22, big ? 0.115 : 0.08, 0.12 - i * 0.04], [0.16, 0.012, 0.035], [0, 0.25, 0]);
  if (big) k.color('#ffffff').add(T.sphere(5, 2), [-0.3, 0.12, 0.18], [0.12, 0.01, 0.03], [0, 0.25, 0]);
  k.lineless = false;
  k.pop();
  return [];
}

// ---------------------------------------------------------------- cove

export function shell(k, L, w, d, rnd) {
  const sh = c(L, 'shell', '#ffd8c8'), inner = c(L, 'inner', '#ff9ab0');
  const v = V(L);
  const a = rnd() * Math.PI * 2;
  k.push().tf((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3, 0, a, 0, 1.5, 1.5, 1.5);
  if (v === 2) {
    // starfish
    k.color(inner).add(T.sphere(6, 3), [0, 0.05, 0], [0.09, 0.04, 0.09]);
    for (let i = 0; i < 5; i++) {
      const b = (i / 5) * Math.PI * 2;
      k.color(sh).add(T.sphere(6, 3), [Math.cos(b) * 0.12, 0.04, Math.sin(b) * 0.12], [0.13, 0.035, 0.05], [0, -b, 0]);
    }
    k.lineless = true;
    for (let i = 0; i < 5; i++) { const b = (i / 5) * Math.PI * 2; k.color(lighten(inner, 0.4)).add(T.sphere(3, 2), [Math.cos(b) * 0.13, 0.075, Math.sin(b) * 0.13], 0.018); }
    k.lineless = false;
  } else if (v === 1) {
    // conch: spiral cone lying on its side with a pink mouth
    k.color(sh).add(T.cone(8), [0, 0.1, 0], [0.12, 0.34, 0.12], [0, 0, Math.PI / 2]);
    k.lineless = true;
    for (let i = 0; i < 3; i++) k.color(mul(sh, 0.82)).add(T.torus(0.2, 3, 10), [-0.05 - i * 0.06, 0.1, 0], [0.1 - i * 0.025, 0.1 - i * 0.025, 0.1 - i * 0.025], [0, Math.PI / 2, 0]);
    k.lineless = false;
    k.color(inner).add(T.sphere(7, 4), [0.12, 0.08, 0.02], [0.06, 0.08, 0.1]);
    for (let i = 0; i < 4; i++) k.color(lighten(sh, 0.2)).add(T.cone(4), [-0.04 + i * 0.05, 0.2, 0], [0.02, 0.05, 0.02]);
  } else {
    // scallop fan
    k.color(sh).add(T.sphere(10, 4, 0), [0, 0.04, 0], [0.2, 0.06, 0.16]);
    k.lineless = true;
    for (let i = 0; i < 5; i++) {
      const b = -0.9 + i * 0.45;
      k.color(mul(sh, 0.84)).add(T.box(), [Math.sin(b) * 0.08, 0.095, -Math.cos(b) * 0.06 + 0.04], [0.02, 0.012, 0.18], [0, b, 0]);
    }
    k.lineless = false;
    k.color(inner).add(T.box(), [0, 0.04, 0.15], [0.09, 0.05, 0.05]);
  }
  k.pop();
  return [];
}

export function coral(k, L, w, d, rnd) {
  const body = c(L, 'body', '#ff7a8a'), tips = c(L, 'tips', '#ffd0a0');
  const v = V(L);
  k.push().tf(0, 0, 0, 0, 0, 0, 1.35, 1.35, 1.35);
  k.color('#d8c8a8').add(T.dodeca(), [0, 0.08, 0], [0.34, 0.12, 0.3], [rnd(), rnd(), 0]);
  if (v === 1) {
    // tube coral: a bundle of open tubes
    const tubes = [[0, 0.5, 0, 0.12], [0.18, 0.36, 0.06, 0.1], [-0.17, 0.4, 0.04, 0.1], [0.06, 0.32, -0.16, 0.09], [-0.08, 0.28, 0.18, 0.08]];
    for (const [x, h, z, r] of tubes) {
      k.color(body).add(T.cyl(1.1, 0.8, 8), [x, 0.1 + h / 2, z], [r, h, r]);
      k.color(tips).add(T.torus(0.3, 4, 10), [x, 0.1 + h, z], [r * 1.05, r * 1.05, r * 1.05], [Math.PI / 2, 0, 0]);
      k.lineless = true;
      k.color(mul(body, 0.45)).add(T.cyl(1, 1, 8), [x, 0.1 + h, z], [r * 0.75, 0.01, r * 0.75]);
      k.lineless = false;
    }
  } else if (v === 2) {
    // brain coral: a round mound with wavy grooves
    k.color(body).add(T.sphere(10, 6), [0, 0.3, 0], [0.36, 0.28, 0.33]);
    k.lineless = true;
    for (let i = 0; i < 4; i++) k.color(mul(body, 0.8)).add(T.torus(0.08, 3, 14), [0, 0.32 + i * 0.05, 0], [0.34 - i * 0.07, 0.34 - i * 0.07, 0.28 - i * 0.06], [Math.PI / 2, 0, i * 0.4]);
    k.lineless = false;
    k.color(tips).add(T.sphere(5, 3), [0.1, 0.58, 0.08], 0.05);
  } else if (v === 3) {
    // sea fans: two lacy fans standing up, turned toward the camera
    for (const [x, ry, sc] of [[-0.08, -0.35, 1], [0.16, 0.5, 0.75]]) {
      k.push().tf(x, 0.1, 0, 0.25, ry, 0, sc, sc, sc);
      k.color(body).add(T.sphere(10, 6), [0, 0.42, 0], [0.34, 0.36, 0.035]);
      k.color(mul(body, 0.8)).add(T.cyl(1, 1, 5), [0, 0.12, 0], [0.035, 0.24, 0.035]);
      k.lineless = true;
      for (let i = 0; i < 5; i++) { const b = -1 + i * 0.5; k.color(lighten(tips, 0.1)).add(T.box(), [Math.sin(b) * 0.16, 0.36 + Math.cos(b) * 0.16, 0.04], [0.02, 0.3, 0.01], [0, 0, -b]); }
      for (let i = 0; i < 5; i++) k.color(tips).add(T.sphere(4, 3), [Math.cos(i * 1.3) * 0.24, 0.42 + Math.sin(i * 1.7) * 0.2, 0.04], 0.03);
      k.lineless = false;
      k.pop();
    }
  } else {
    // branching coral with round tips
    const br = [[0, 0.62, 0, 0], [0.16, 0.48, 0.06, -0.5], [-0.17, 0.5, 0.02, 0.55], [0.06, 0.4, -0.16, 0.2], [-0.04, 0.38, 0.2, -0.25]];
    br.forEach(([x, h, z, rz], i) => {
      k.push().tf(x * 0.4, 0.12, z * 0.4, 0, 0, rz);
      k.color(i % 2 ? body : mul(body, 0.92)).add(T.capsule(2.4, 6), [0, h / 2, 0], [0.1, h / 3.4, 0.1]);
      k.color(tips).add(T.sphere(6, 4), [0, h + 0.02, 0], 0.07);
      if (i < 3) { k.color(body).add(T.capsule(1.6, 5), [0.08, h * 0.65, 0], [0.07, 0.07, 0.07], [0, 0, -0.8]); k.color(tips).add(T.sphere(5, 3), [0.15, h * 0.72, 0], 0.05); }
      k.pop();
    });
  }
  k.pop();
  return [];
}

export function boat(k, L, w, d, rnd) {
  const hull = c(L, 'hull', '#b0743d'), trim = c(L, 'trim', '#ffffff'), sail = c(L, 'sail', '#f4ecd8');
  const v = V(L);
  const along = w >= d;
  const len = (along ? w : d) * 0.92, wid = Math.min(1.25, (along ? d : w) * 0.62);
  if (!along) k.push().tf(0, 0, 0, 0, Math.PI / 2, 0);
  const hullT = slab('boathull', lensPts(10, 0.7));
  const deckT = slab('boatdeck', lensPts(10, 0.75));
  k.color(mul(hull, 0.8)).add(hullT, [0, -0.15, 0], [len * 0.9, 0.2, wid * 0.82]);
  k.color(hull).add(hullT, [0, 0.05, 0], [len, 0.3, wid]);
  k.color(trim).add(hullT, [0, 0.3, 0], [len * 1.01, 0.07, wid * 1.02]);
  k.lineless = true;
  k.color(mix(hull, '#f4e0b8', 0.45)).add(deckT, [0, 0.3, 0], [len * 0.9, 0.075, wid * 0.82]);
  for (let i = -2; i <= 2; i++) k.color(mix(hull, '#f4e0b8', 0.25)).add(T.box(), [i * len * 0.12, 0.378, 0], [0.02, 0.005, wid * 0.7]);
  k.lineless = false;
  if (v === 2) {
    // rowboat: two seats and oars
    for (const x of [-0.25, 0.25]) k.color(mul(hull, 0.9)).add(T.box(), [x * len, 0.4, 0], [0.12, 0.05, wid * 0.82]);
    for (const s of [1, -1]) k.color('#d8b07a').add(T.cyl(1, 1, 5), [0.05, 0.42, s * wid * 0.55], [0.025, len * 0.6, 0.025], [0, 0, Math.PI / 2 - 0.15 * s]);
    if (!along) k.pop();
    return [];
  }
  // cabin crate, mast, sail and a little flag
  k.color(mix(hull, '#f4e0b8', 0.3)).add(T.box(), [-len * 0.25, 0.5, 0], [len * 0.2, 0.26, wid * 0.5]);
  k.color(mul(hull, 0.75)).add(T.box(), [-len * 0.25, 0.65, 0], [len * 0.24, 0.05, wid * 0.56]);
  k.lineless = true;
  k.color('#bfe6ff', 0.3).add(T.cyl(1, 1, 10), [-len * 0.25, 0.5, wid * 0.255], [0.06, 0.01, 0.06], [Math.PI / 2, 0, 0]);
  k.lineless = false;
  k.color(mul(hull, 0.7)).add(T.cyl(1, 1, 6), [len * 0.05, 1.1, 0], [0.04, 1.6, 0.04]);
  k.color(sail).add(T.shape('sail', [[0, 0], [0.62, 0], [0.02, 1.15]], 0.025), [len * 0.07, 0.48, 0.02], [len / 3, 1, 1]);
  k.color(v === 1 ? '#ffd24a' : '#d8584a').add(T.box(), [len * 0.07 + 0.12, 1.86, 0], [0.24, 0.12, 0.01]);
  k.lineless = true;
  k.color(mul(sail, 0.85)).add(T.box(), [len * 0.07 + 0.2, 0.8, 0.04], [0.32, 0.03, 0.005], [0, 0, 0.35]);
  k.lineless = false;
  // rope coil and a life ring
  k.color('#e0c890').add(T.torus(0.35, 4, 10), [len * 0.3, 0.4, 0.05], [0.1, 0.1, 0.1], [Math.PI / 2, 0, 0]);
  k.color('#ff6b6b').add(T.torus(0.3, 4, 12), [-len * 0.25, 0.48, wid * 0.27], [0.1, 0.1, 0.1]);
  if (!along) k.pop();
  return [];
}

export function tidepool(k, L, w, d, rnd) {
  const water = c(L, 'water', '#4fc8e0'), rim = c(L, 'rim', '#c9c0b0');
  const R = Math.min(w, d) * 0.42;
  k.color(mul(water, 0.65)).add(T.cyl(1, 1, 16), [0, 0.012, 0], [R, 0.02, R * 0.9]);
  k.color(water, 0.3).add(T.cyl(1, 1, 16), [0, 0.035, 0], [R * 0.92, 0.01, R * 0.82]);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
    const s = 0.13 + rnd() * 0.1;
    k.color(i % 3 ? rim : mul(rim, 0.85)).add(T.dodeca(), [Math.cos(a) * R, 0.06, Math.sin(a) * R * 0.9], [s, s * 0.6, s * 0.9], [rnd(), rnd(), 0]);
  }
  k.lineless = true;
  // a starfish, an urchin and seaweed in the pool
  for (let i = 0; i < 5; i++) { const b = (i / 5) * Math.PI * 2; k.color('#ff8a5a').add(T.sphere(5, 3), [R * 0.3 + Math.cos(b) * 0.07, 0.045, R * 0.2 + Math.sin(b) * 0.07], [0.07, 0.02, 0.03], [0, -b, 0]); }
  k.color('#7a4aa8').add(T.sphere(6, 4), [-R * 0.35, 0.05, -R * 0.1], [0.07, 0.05, 0.07]);
  for (let i = 0; i < 3; i++) k.color('#5fc078').add(T.cone(4), [-R * 0.1 + i * 0.08, 0.12, -R * 0.45], [0.03, 0.2, 0.03], [0.2 * (i - 1), 0, 0.3 * (i - 1)]);
  k.lineless = false;
  return [{ type: 'glint', x: 0, y: 0, h: 0.1, color: '#ffffff', r: R }];
}

/** Lighthouse (3x3 building): red-white striped tapering tower, door south, gallery, glowing lamp room. */
export function lighthouse(k, L, w, d, rnd, dx = 0) {
  const wall = c(L, 'wall', '#ffffff'), stripe = c(L, 'stripe', '#e05050'), roof = c(L, 'roof', '#3d5aa8'), light = c(L, 'light', '#ffe680');
  const R0 = Math.min(w, d) * 0.28, R1 = R0 * 0.64, H = 2.85, y0 = 0.16;
  // rocky base and plinth
  k.color('#b8b4ae').add(T.cyl(1, 1, 14), [0, 0.08, 0], [R0 + 0.32, 0.16, R0 + 0.3]);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.4; k.color(i % 2 ? '#a8a49e' : '#c4c0b8').add(T.dodeca(), [Math.cos(a) * (R0 + 0.36), 0.1, Math.sin(a) * (R0 + 0.32)], [0.2, 0.14, 0.18], [a, a, 0]); }
  // striped tower: 4 bands (taper)
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const ya = y0 + (i / bands) * H, yb = y0 + ((i + 1) / bands) * H;
    const ra = R0 - (R0 - R1) * (i / bands), rb = R0 - (R0 - R1) * ((i + 1) / bands);
    k.color(i % 2 ? stripe : wall).add(T.cyl(rb / ra, 1, 14), [0, (ya + yb) / 2, 0], [ra, yb - ya + 0.002, ra]);
  }
  // door (south) and small windows
  const zf = (y) => R0 - (R0 - R1) * ((y - y0) / H);
  k.lineless = true;
  const dz = zf(0.5);
  k.color('#5a3a22').add(T.box(), [dx * 0.3, 0.52, dz + 0.01], [0.32, 0.62, 0.06]);
  k.color(mul(roof, 0.9)).add(T.dome(10, 3), [dx * 0.3, 0.83, dz + 0.005], [0.18, 0.12, 0.05], [Math.PI / 2, 0, 0]);
  k.color('#ffd24a').add(T.sphere(4, 3), [dx * 0.3 + 0.08, 0.5, dz + 0.05], 0.025);
  k.color('#b9bccb').add(T.box(), [dx * 0.3, 0.2, dz + 0.16], [0.46, 0.08, 0.26]);
  for (const y of [1.2, 1.75]) {
    const z = zf(y);
    k.color(mul(roof, 0.8)).add(T.box(), [0.02, y, z + 0.01], [0.17, 0.22, 0.04]);
    k.color('#bfe6ff', 0.3).add(T.box(), [0.02, y, z + 0.03], [0.11, 0.16, 0.02]);
  }
  k.lineless = false;
  // gallery deck + railing
  const yg = y0 + H;
  k.color(mul(roof, 0.95)).add(T.cyl(1, 1, 14), [0, yg + 0.04, 0], [R1 + 0.2, 0.09, R1 + 0.2]);
  k.lineless = true;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.color('#3a3a4a').add(T.box(), [Math.cos(a) * (R1 + 0.17), yg + 0.18, Math.sin(a) * (R1 + 0.17)], [0.025, 0.2, 0.025]); }
  k.color('#3a3a4a').add(T.torus(0.08, 3, 18), [0, yg + 0.28, 0], [R1 + 0.17, R1 + 0.17, R1 + 0.17], [Math.PI / 2, 0, 0]);
  k.lineless = false;
  // lamp room: glass drum (emissive), frame posts, red cone roof and a ball
  const RL = R1 * 0.78;
  k.color(light, 1).add(T.cyl(1, 1, 10), [0, yg + 0.36, 0], [RL, 0.5, RL]);
  k.lineless = true;
  k.color('#ffffff', 1).add(T.cyl(1, 1, 10), [0, yg + 0.36, 0], [RL * 0.45, 0.32, RL * 0.45]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.color('#3a3a4a').add(T.box(), [Math.cos(a) * RL, yg + 0.36, Math.sin(a) * RL], [0.03, 0.5, 0.03]); }
  k.lineless = false;
  k.color(roof).add(T.cone(12), [0, yg + 0.82, 0], [RL + 0.12, 0.42, RL + 0.12]);
  k.color(mul(roof, 0.8)).add(T.cyl(1, 1, 12), [0, yg + 0.62, 0], [RL + 0.14, 0.04, RL + 0.14]);
  k.color('#ffd24a').add(T.sphere(6, 5), [0, yg + 1.07, 0], 0.07);
  return [{ type: 'beacon', x: 0, y: 0, h: yg + 0.38, color: hex(light) }];
}

// ---------------------------------------------------------------- peaks

export function snowman(k, L, w, d, rnd) {
  const snow = c(L, 'snow', '#ffffff'), scarf = c(L, 'scarf', '#e05050'), hat = c(L, 'hat', '#3a3a4a');
  const small = V(L) === 1;
  const s = small ? 0.78 : 1;
  const balls = small ? [[0.18, 0.3], [0.46, 0.2]] : [[0.2, 0.33], [0.55, 0.25], [0.84, 0.19]];
  k.color(mix(snow, '#c8dcf0', 0.4)).add(T.cyl(1, 1, 10), [0, 0.02, 0], [0.38 * s, 0.04, 0.36 * s]);
  balls.forEach(([y, r], i) => k.color(i % 2 ? mix(snow, '#e6f0ff', 0.4) : snow).add(T.sphere(10, 7), [0, y * s, 0], [r * s, r * 0.92 * s, r * s]));
  const [hy, hr] = balls[balls.length - 1];
  const HY = hy * s, HR = hr * s;
  // face: coal eyes, carrot nose, smile
  k.lineless = true;
  for (const sd of [1, -1]) k.color('#2a2a34').add(T.sphere(5, 4), [sd * HR * 0.38, HY + HR * 0.22, HR * 0.86], 0.03 * s);
  for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; k.color('#2a2a34').add(T.sphere(4, 3), [Math.sin(a) * HR * 0.5, HY - HR * 0.3 - Math.cos(a) * 0.03, HR * 0.85], 0.018 * s); }
  if (!small) for (let i = 0; i < 3; i++) k.color('#2a2a34').add(T.sphere(4, 3), [0, (0.47 + i * 0.09) * s, (0.24 - Math.abs(i - 1) * 0.015) * s], 0.025);
  k.lineless = false;
  k.color('#ff8a3c').add(T.cone(6), [0, HY + 0.02, HR + 0.08 * s], [0.04 * s, 0.2 * s, 0.04 * s], [Math.PI / 2, 0, 0]);
  // scarf
  k.color(scarf).add(T.torus(0.35, 5, 12), [0, HY - HR * 0.82, 0], [HR * 0.9, HR * 0.9, HR * 0.9], [Math.PI / 2, 0, 0]);
  k.color(mul(scarf, 0.9)).add(T.box(), [HR * 0.5, HY - HR * 1.25, HR * 0.6], [0.09 * s, 0.24 * s, 0.04 * s], [0.2, 0, 0.25]);
  // stick arms
  const ay = small ? 0.46 * s : 0.58 * s;
  for (const sd of [1, -1]) {
    k.color('#7a4e2c').add(T.cyl(0.6, 1, 4), [sd * 0.38 * s, ay + 0.1, 0], [0.022, 0.36 * s, 0.022], [0, 0, -sd * 1.0]);
    k.color('#7a4e2c').add(T.cyl(0.5, 1, 4), [sd * 0.5 * s, ay + 0.22, 0], [0.015, 0.12, 0.015], [0, 0, -sd * 0.2]);
  }
  // hat: top hat (big) or a bobble hat (small)
  if (small) {
    k.color(hat).add(T.dome(10, 4), [0, HY + HR * 0.55, 0], [HR * 0.85, HR * 0.6, HR * 0.85]);
    k.color('#ffffff').add(T.cyl(1, 1, 10), [0, HY + HR * 0.55, 0], [HR * 0.88, 0.05, HR * 0.88]);
    k.color('#ffffff').add(T.sphere(6, 4), [0, HY + HR * 1.2, 0], 0.06);
  } else {
    k.color(hat).add(T.cyl(1, 1, 10), [0, HY + HR * 0.85, 0], [HR * 1.2, 0.03, HR * 1.2]);
    k.color(hat).add(T.cyl(1, 1, 10), [0, HY + HR * 0.85 + 0.15, 0], [HR * 0.72, 0.3, HR * 0.72]);
    k.color(scarf).add(T.cyl(1, 1, 10), [0, HY + HR * 0.85 + 0.05, 0], [HR * 0.74, 0.05, HR * 0.74]);
  }
  return [];
}

export function igloo(k, L, w, d, rnd, dx = 0) {
  const ice = c(L, 'ice', '#e8f6ff'), shade = c(L, 'shade', '#b8d8f0');
  const R = Math.min(w * 0.42, d * 0.62), Rz = R * 0.9, H = R * 0.95;
  k.color(mix(ice, '#ffffff', 0.4)).add(T.cyl(1, 1, 16), [0, 0.02, -0.05], [R + 0.12, 0.05, Rz + 0.12]);
  k.color(ice).add(domeT(), [0, 0.02, -0.05], [R, H, Rz]);
  // ice block courses and joints (lineless, cheap)
  k.lineless = true;
  for (let i = 1; i <= 3; i++) {
    const y = (i / 4) * H, rr = Math.sqrt(1 - (i / 4) ** 2);
    k.color(shade).add(T.torus(0.04, 3, 22), [0, 0.02 + y, -0.05], [R * rr * 1.003, Rz * rr * 1.003, 0.6], [Math.PI / 2, 0, 0]);
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * Math.PI + (i % 2) * 0.22 + 0.1;
      const yy = ((i - 0.5) / 4) * H, r2 = Math.sqrt(1 - ((i - 0.5) / 4) ** 2);
      k.color(shade).add(T.box(), [Math.cos(a) * R * r2, 0.02 + yy, -0.05 + Math.sin(a) * Rz * r2], [0.025, H / 4.5, 0.025], [0, -a, 0]);
    }
  }
  k.color('#ffffff', 0.5).add(T.sphere(6, 4), [-R * 0.35, H * 0.82, -0.05 + Rz * 0.3], [0.12, 0.06, 0.08]);
  k.lineless = false;
  // entrance tunnel toward the south (at the door column) with a dark round opening
  const tx = dx * 0.5;
  k.color(mix(ice, shade, 0.25)).add(T.cyl(1, 1, 12, false), [tx, 0.02, Rz * 0.85], [0.36, 0.6, 0.4], [Math.PI / 2, 0, 0]);
  k.color(mix(ice, '#ffffff', 0.5)).add(T.box(), [tx, 0.05, Rz * 0.85], [0.68, 0.1, 0.6]);
  k.lineless = true;
  k.color('#34558e').add(T.sphere(12, 6), [tx, 0.02, Rz * 0.85 + 0.302], [0.25, 0.3, 0.02]);
  k.color(mul(shade, 0.9)).add(T.torus(0.14, 3, 12, Math.PI), [tx, 0.02, Rz * 0.85 + 0.3], [0.31, 0.34, 0.5]);
  k.lineless = false;
  // a lantern on a post beside the door
  k.color('#7a4e2c').add(T.box(), [tx + 0.55, 0.35, Rz + 0.15], [0.05, 0.7, 0.05]);
  k.color('#ffd24a', 1).add(T.cyl(0.85, 1, 6), [tx + 0.55, 0.74, Rz + 0.15], [0.07, 0.12, 0.07]);
  k.color('#3a3a4a').add(T.cone(6), [tx + 0.55, 0.85, Rz + 0.15], [0.1, 0.08, 0.1]);
  return [{ type: 'lamp', x: tx + 0.55, y: Rz + 0.15, h: 0.74, color: '#ffd24a' }];
}

export function snow_pine(k, L, w, d, rnd) {
  const trunk = c(L, 'trunk', '#7a4e2c'), leaves = c(L, 'leaves', '#2c7f6a'), snow = c(L, 'snow', '#ffffff');
  const v = V(L);
  const sc = v === 1 ? 0.68 : 1;
  k.color(trunk).add(T.cyl(0.8, 1, 6), [0, 0.18 * sc, 0], [0.11 * sc, 0.36 * sc, 0.11 * sc]);
  const tiers = [[0.55, 0.5, 0.56], [0.95, 0.4, 0.5], [1.32, 0.29, 0.46], [1.62, 0.17, 0.34]];
  tiers.forEach(([y, r, h], i) => {
    const lc = v === 2 ? mix(leaves, '#ffffff', 0.2) : leaves;
    k.color(i % 2 ? mul(lc, 0.88) : lc).add(T.cone(9), [0, y * sc, 0], [r * sc, h * sc, r * sc], [0, i * 0.4, 0]);
    // snow cap on the upper part of each tier, and a snowy rim
    k.color(snow).add(T.cone(9), [0, (y + h * (v === 2 ? 0.12 : 0.22)) * sc, 0], [r * (v === 2 ? 0.86 : 0.62) * sc, h * (v === 2 ? 0.78 : 0.58) * sc, r * (v === 2 ? 0.86 : 0.62) * sc], [0, i * 0.4 + 0.2, 0]);
    k.lineless = true;
    for (let j = 0; j < 5; j++) { const a = j * 1.26 + i; k.color(snow).add(T.sphere(4, 3), [Math.cos(a) * r * 0.82 * sc, (y - h * 0.42) * sc, Math.sin(a) * r * 0.82 * sc], [0.06 * sc, 0.03 * sc, 0.06 * sc]); }
    k.lineless = false;
  });
  k.color(snow).add(T.sphere(6, 4), [0, 1.86 * sc, 0], 0.06 * sc);
  k.color(mix(snow, '#c8dcf0', 0.35)).add(T.sphere(8, 3), [0.06, 0.02, 0.1], [0.42 * sc, 0.06, 0.36 * sc]);
  return [];
}

export function ice_spire(k, L, w, d, rnd) {
  const ice = c(L, 'ice', '#bfeaff'), glow = c(L, 'glow', '#7fd6ff');
  const v = V(L);
  k.color('#f4faff').add(T.sphere(8, 3), [0, 0.02, 0], [0.42, 0.08, 0.38]);
  const sp = v === 1
    ? [[0, 0.9, 0, 0.16, 0.1], [0.22, 0.6, 0.06, 0.12, -0.45], [-0.22, 0.65, 0.04, 0.12, 0.45], [0.06, 0.5, -0.2, 0.1, 0.25], [-0.04, 0.42, 0.22, 0.09, -0.2]]
    : [[0, 1.9, 0, 0.19, 0.03], [0.2, 1.1, 0.06, 0.13, -0.3], [-0.2, 1.0, 0.04, 0.13, 0.32], [0.04, 0.7, 0.2, 0.1, -0.12]];
  sp.forEach(([x, h, z, r, rz], i) => {
    const col = i % 2 ? mix(ice, glow, 0.35) : ice;
    k.push().tf(x, 0.02, z, 0.1 * (i % 2 ? 1 : -1), 0, rz);
    k.color(col, 0.3).add(T.cyl(1, 1, 6), [0, h * 0.4, 0], [r, h * 0.8, r]);
    k.color(lighten(col, 0.3), 0.4).add(T.cone(6), [0, h * 0.8 + h * 0.1, 0], [r, h * 0.2, r]);
    k.lineless = true;
    k.color('#ffffff', 0.7).add(T.box(), [-r * 0.45, h * 0.45, r * 0.6], [r * 0.18, h * 0.6, 0.01]);
    k.lineless = false;
    k.pop();
  });
  return [{ type: 'crystal', x: 0, y: 0, h: v === 1 ? 0.7 : 1.3, color: hex(glow) }];
}

// ---------------------------------------------------------------- aether

export function cloud_puff(k, L, w, d, rnd) {
  const cl = c(L, 'cloud', '#ffffff'), shade = c(L, 'shade', '#dfe8ff');
  const blobs = [[0, 0.16, 0, 0.3], [0.26, 0.1, 0.06, 0.2], [-0.26, 0.11, 0.04, 0.22], [0.08, 0.08, 0.24, 0.18], [-0.1, 0.24, -0.08, 0.2]];
  blobs.forEach(([x, y, z, r], i) => k.color(i === 4 ? lighten(cl, 0.1) : i % 2 ? shade : cl).add(T.sphere(8, 5), [x, y, z], [r, r * 0.65, r]));
  return [];
}

export function floating_rock(k, L, w, d, rnd) {
  const rock = c(L, 'rock', '#b8a8d8'), grass = c(L, 'grass', '#9fe0a0'), crys = c(L, 'crystal', '#ffd0f0');
  const v = V(L);
  const R = Math.min(w, d) * (v === 1 ? 0.34 : 0.33);
  const hy = v === 1 ? 0.9 : 1.15;      // hover height of the top
  // underside: a craggy inverted cone with a few chunks
  k.color(rock).add(T.cone(8), [0, hy - R * 0.85, 0], [R * 0.95, R * 1.6, R * 0.9], [Math.PI, 0.3, 0]);
  k.color(mul(rock, 0.88)).add(T.dodeca(), [R * 0.4, hy - R * 0.5, R * 0.2], [R * 0.45, R * 0.4, R * 0.4], [rnd(), rnd(), 0]);
  k.color(lighten(rock, 0.08)).add(T.dodeca(), [-R * 0.45, hy - R * 0.35, -R * 0.1], [R * 0.4, R * 0.35, R * 0.38], [rnd(), rnd(), 0]);
  k.color(lighten(rock, 0.1)).add(T.cyl(1, 0.9, 10), [0, hy - 0.04, 0], [R * 1.12, 0.18, R * 1.06]);
  // grassy top with tufts, a flower and (big ones) a little bush
  k.color(grass).add(T.cyl(1, 1, 12), [0, hy + 0.06, 0], [R * 0.96, 0.08, R * 0.9]);
  k.color(lighten(grass, 0.15)).add(T.dome(10, 3), [0, hy + 0.1, 0], [R * 0.86, 0.07, R * 0.8]);
  k.lineless = true;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; k.color(mul(grass, 0.8)).add(T.cone(3), [Math.cos(a) * R * 0.8, hy + 0.1, Math.sin(a) * R * 0.75], [0.04, 0.12, 0.04]); }
  for (let i = 0; i < 4; i++) { const a = i * 1.7; k.color(mul(grass, 0.75)).add(T.cone(3), [Math.cos(a) * R * 0.95, hy - 0.12, Math.sin(a) * R * 0.9], [0.03, 0.14, 0.03], [Math.PI, 0, 0]); }
  k.color('#ffb8e0').add(T.sphere(5, 3), [R * 0.4, hy + 0.13, R * 0.35], [0.06, 0.03, 0.06]);
  k.color('#fff0a0').add(T.sphere(4, 2), [R * 0.4, hy + 0.15, R * 0.35], 0.025);
  k.lineless = false;
  if (v === 2) {
    const cr = [[-0.15, 0.4, -0.05, 0.1], [0.12, 0.3, -0.12, 0.08], [0.0, 0.24, 0.12, 0.07]];
    cr.forEach(([x, h, z, r], i) => {
      k.color(i % 2 ? crys : lighten(crys, 0.2), 0.4).add(T.cyl(1, 1, 6), [x, hy + 0.1 + h / 2, z], [r, h, r], [0.15 * (i - 1), 0, 0.2 * (i - 1)]);
      k.color(lighten(crys, 0.4), 0.5).add(T.cone(6), [x + 0.2 * (i - 1) * -h / 2, hy + 0.1 + h + 0.06, z], [r, 0.13, r], [0.15 * (i - 1), 0, 0.2 * (i - 1)]);
    });
  } else if (v !== 1) {
    k.color(mix(grass, '#4fae6a', 0.5)).add(T.ico(1), [-R * 0.3, hy + 0.25, -R * 0.2], [0.24, 0.2, 0.22]);
    k.color('#b8a0ec').add(T.dodeca(), [R * 0.35, hy + 0.12, -R * 0.3], [0.13, 0.08, 0.12]);
  }
  const em = [{ type: 'shadow', x: 0, y: 0, h: 0, r: R * 0.95, color: '#000000' }];
  if (v === 2) em.push({ type: 'crystal', x: 0, y: 0, h: hy + 0.4, color: hex(crys) });
  return em;
}

export function star_lamp(k, L, w, d, rnd) {
  const metal = c(L, 'metal', '#c8a0ff'), star = c(L, 'star', '#fff2a0');
  k.color(mul(metal, 0.85)).add(T.cyl(0.8, 1, 8), [0, 0.07, 0], [0.18, 0.14, 0.18]);
  k.color(metal).add(T.cyl(0.75, 1, 6), [0, 0.68, 0], [0.06, 1.15, 0.06]);
  // curls (scroll arms) and a crescent cradle
  for (const s of [1, -1]) {
    k.color(metal).add(T.torus(0.18, 4, 10, Math.PI * 1.3), [s * 0.11, 1.0, 0], [0.1, 0.1, 0.1], [0, 0, s > 0 ? -0.6 : Math.PI + 0.6]);
  }
  k.color(metal).add(T.torus(0.14, 4, 14, Math.PI), [0, 1.48, 0], [0.22, 0.22, 0.22], [0, 0, Math.PI]);
  k.color(lighten(metal, 0.3)).add(T.sphere(6, 4), [0, 1.27, 0], 0.05);
  // the star: two crossed 4-point slabs (emissive)
  const starT = T.shape('star4', [[0, 0.5], [0.12, 0.12], [0.5, 0], [0.12, -0.12], [0, -0.5], [-0.12, -0.12], [-0.5, 0], [-0.12, 0.12]], 0.12);
  k.color(star, 1).add(starT, [0, 1.56, 0], [0.62, 0.62, 0.9]);
  k.color(lighten(star, 0.4), 1).add(starT, [0, 1.56, 0], [0.44, 0.44, 1.1], [0, Math.PI / 2, 0]);
  return [{ type: 'lamp', x: 0, y: 0, h: 1.5, color: hex(star) }, { type: 'crystal', x: 0, y: 0, h: 1.5, color: hex(star) }];
}

export function orrery(k, L, w, d, rnd) {
  const metal = c(L, 'metal', '#e0b850'), p1 = c(L, 'planet', '#7fb0ff'), p2 = c(L, 'planet2', '#ff9ab0');
  const R = Math.min(w, d) * 0.42;
  // stepped round plinth with a starry top
  k.color('#c8bce8').add(T.cyl(1, 1, 18), [0, 0.09, 0], [R + 0.1, 0.18, R + 0.1]);
  k.color('#e2d8f6').add(T.cyl(1, 1, 18), [0, 0.22, 0], [R * 0.82, 0.1, R * 0.82]);
  k.lineless = true;
  k.color('#7a6ad0').add(T.cyl(1, 1, 18), [0, 0.272, 0], [R * 0.72, 0.01, R * 0.72]);
  for (let i = 0; i < 7; i++) { const a = i * 0.9; k.color('#fff2a8', 1).add(T.octa(), [Math.cos(a) * R * 0.5, 0.28, Math.sin(a) * R * 0.45], [0.05, 0.005, 0.05]); }
  k.lineless = false;
  // central column and the sun
  const hy = 1.45;
  k.color(metal).add(T.cyl(0.6, 1, 8), [0, 0.3 + (hy - 0.3) / 2, 0], [0.09, hy - 0.3, 0.09]);
  k.color(mul(metal, 0.85)).add(T.cyl(1, 1, 8), [0, 0.36, 0], [0.2, 0.12, 0.2]);
  k.color('#ffd24a', 0.9).add(T.sphere(12, 9), [0, hy, 0], 0.26);
  k.lineless = true;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.color('#ffb03c', 1).add(T.cone(4), [Math.cos(a) * 0.3, hy, Math.sin(a) * 0.3], [0.05, 0.12, 0.05], [0, 0, 0]); }
  k.lineless = false;
  // tilted orbit rings on arms
  const rings = [[R * 0.62, 0.22], [R * 0.95, -0.16]];
  rings.forEach(([rr, tilt], i) => {
    k.color(i ? mul(metal, 0.92) : metal).add(T.torus(0.035, 4, 32), [0, hy, 0], [rr, rr, rr], [Math.PI / 2 + tilt, 0, 0]);
  });
  // arms holding the outer ring
  for (const s of [1, -1]) k.color(mul(metal, 0.9)).add(T.cyl(1, 1, 5), [s * R * 0.47, hy - 0.08, 0], [0.03, R * 0.95, 0.03], [0, 0, Math.PI / 2 - s * 0.16]);
  // planets ride the rings (fx 'orrery' emitter turns them slowly)
  return [{ type: 'orrery', x: 0, y: 0, h: hy, color: hex(p1), color2: hex(p2), r1: rings[0][0], t1: rings[0][1], r2: rings[1][0], t2: rings[1][1] },
    { type: 'lamp', x: 0, y: 0, h: hy, color: '#ffd24a' }];
}

export function moon_flower(k, L, w, d, rnd) {
  const petal = c(L, 'petal', '#e8e0ff'), glow = c(L, 'glow', '#bfa8ff');
  const ox = (rnd() - 0.5) * 0.2, oz = (rnd() - 0.5) * 0.2;
  k.push().tf(ox, 0, oz, 0, rnd() * 6, 0, 1.3, 1.3, 1.3);
  k.lineless = true;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.color(i % 2 ? '#6cc8a0' : '#5ab890').add(T.sphere(6, 3), [Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2], [0.17, 0.03, 0.07], [0, -a, 0]); }
  k.lineless = false;
  k.color('#5ab890').add(T.cyl(1, 1, 4), [0, 0.15, 0], [0.025, 0.28, 0.025]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.color(i % 2 ? petal : mix(petal, glow, 0.35), 0.45).add(T.sphere(7, 4), [Math.cos(a) * 0.12, 0.31, Math.sin(a) * 0.12], [0.12, 0.035, 0.06], [0, -a, 0.35]);
  }
  k.color('#fffbe0', 1).add(T.sphere(6, 4), [0, 0.33, 0], 0.055);
  k.pop();
  return [{ type: 'bloom', x: ox, y: oz, h: 0.32, color: hex(glow) }];
}

export const BIOME_BUILDERS = { palm, cactus, ruin_pillar, obelisk, pottery, dune, shell, coral, boat, tidepool, lighthouse, snowman, igloo,
  snow_pine, ice_spire, cloud_puff, floating_rock, star_lamp, orrery, moon_flower };
export const BIOME_SHADOW = { palm: 0.45, cactus: 0.36, ruin_pillar: 0.42, obelisk: 0.45, pottery: 0.36, coral: 0.4, boat: 0.9, lighthouse: 1.1,
  snowman: 0.36, igloo: 0.95, snow_pine: 0.5, ice_spire: 0.42, star_lamp: 0.22 };
export const BIOME_HEIGHT = { palm: 2.4, cactus: 1.4, ruin_pillar: 2.0, obelisk: 2.8, pottery: 0.9, boat: 2.0, lighthouse: 4.3, snowman: 1.3,
  igloo: 1.2, snow_pine: 1.9, ice_spire: 2.0, floating_rock: 1.2, star_lamp: 1.8, orrery: 1.8 };
/** Building-like biome models whose builders take the door offset dx. */
export const BIOME_DOORS = { lighthouse: 1, igloo: 1 };
