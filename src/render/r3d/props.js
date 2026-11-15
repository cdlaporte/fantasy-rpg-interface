// Prop models (CONTRACTS section 5, closed list). Each builder adds primitives to a Kit whose matrix is at the
// footprint center on the ground (x east, z south = the side facing the camera). w/d = footprint in tiles.
// Builders may return emitters [{type, x, y, h, color}] (relative to the center) for animated fx.
// Heights: decor <= ~1.8 tiles, buildings <= ~3 (the renderer cuts away anything in front of the player).
import * as THREE from 'three';
import { T, C, tpl, mul, mix, lighten, darken } from './kit.js';

const roofPrism = () => tpl('roofprism', () => {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  g.rotateY(Math.PI / 2);      // profile in the ZY plane, extruded along X
  g.deleteAttribute('uv');
  return g;
});
const barrelT = () => T.lathe('barrel', [[0, 0], [0.4, 0], [0.47, 0.25], [0.5, 0.5], [0.47, 0.75], [0.4, 1], [0, 1]], 10);
const basinT = () => T.lathe('basin', [[0, 0], [0.98, 0], [1, 0.05], [1, 0.35], [0.9, 0.38], [0.88, 0.12], [0, 0.12]], 18);
const bowlT = () => T.lathe('bowl', [[0, 0], [0.2, 0], [0.5, 0.15], [1, 0.4], [0.9, 0.42], [0.45, 0.25], [0, 0.25]], 14);
const potT = () => T.lathe('pot', [[0, 0], [0.5, 0.02], [0.85, 0.2], [1, 0.5], [0.9, 0.85], [0.8, 0.95], [0.86, 1], [0.7, 1]], 12);

export const PROP_MODELS = ['tree', 'pine', 'bush', 'rock', 'stump', 'log', 'flowerbed', 'mushroom_big', 'crystal', 'fence', 'hedge_arch',
  'lamp', 'sign', 'bench', 'well', 'fountain', 'statue', 'barrel', 'crate', 'stall', 'cart', 'campfire', 'tent',
  'house', 'shop', 'tower', 'academy', 'gate_arch', 'rune_gate', 'bridge', 'banner',
  'bookshelf', 'desk', 'table', 'chair', 'bed', 'cauldron', 'chalkboard', 'rug', 'chest'];

/** Deterministic rng from prop position. */
export function propRng(x, y) {
  let s = ((x * 73856093) ^ (y * 19349663)) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const c = (L, k, d) => C((L && L[k]) || d);

function tree(k, L, w, d, rnd) {
  const trunk = c(L, 'trunk', '#8a5a33'), leaves = c(L, 'leaves', '#3fae4f');
  const sc = 0.92 + rnd() * 0.16;
  k.color(trunk).add(T.cyl(0.75, 1, 7), [0, 0.32 * sc, 0], [0.13, 0.64 * sc, 0.13]);
  k.color(mul(trunk, 0.8)).add(T.cyl(1, 1, 7), [0, 0.04, 0], [0.18, 0.08, 0.18]);
  const blobs = [[0, 1.12, 0, 0.5], [0.24, 0.98, 0.08, 0.36], [-0.25, 1.0, -0.02, 0.37], [0.04, 1.45, -0.04, 0.36]];
  blobs.forEach(([x, y, z, r], i) => k.color(i === 3 ? mix(leaves, '#b8e878', 0.25) : i % 2 ? mul(leaves, 0.9) : leaves).add(T.ico(1), [x * sc, y * sc, z * sc], r * sc, [rnd(), rnd(), 0]));
  if (rnd() < 0.35) for (let i = 0; i < 3; i++) k.color('#ff6b6b').add(T.sphere(6, 4), [(rnd() - 0.5) * 0.7, (1.0 + rnd() * 0.5) * sc, 0.32], 0.05);
}

function pine(k, L) {
  const trunk = c(L, 'trunk', '#7a4e2c'), leaves = c(L, 'leaves', '#2c8f5a');
  k.color(trunk).add(T.cyl(0.8, 1, 6), [0, 0.2, 0], [0.11, 0.4, 0.11]);
  const tiers = [[0.62, 0.48, 0.55], [1.0, 0.38, 0.5], [1.35, 0.27, 0.45]];
  tiers.forEach(([y, r, h], i) => {
    k.color(i % 2 ? mul(leaves, 0.88) : leaves).add(T.cone(9), [0, y, 0], [r, h, r], [0, i * 0.4, 0]);
  });
  k.color(lighten(leaves, 0.25)).add(T.cone(6), [0, 1.66, 0], [0.1, 0.22, 0.1]);
}

function bush(k, L, w, d, rnd) {
  const leaves = c(L, 'leaves', '#4cbf55'), berry = c(L, 'berry', '#ff6b8a');
  k.color(leaves).add(T.ico(1), [0, 0.3, 0], [0.4, 0.32, 0.38]);
  k.color(mul(leaves, 0.9)).add(T.ico(1), [0.22, 0.24, 0.1], 0.24).add(T.ico(1), [-0.24, 0.22, 0.05], 0.25);
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    k.color(berry).add(T.sphere(5, 4), [Math.cos(a) * 0.3, 0.2 + rnd() * 0.3, Math.abs(Math.sin(a)) * 0.3 + 0.05], 0.045);
  }
}

function rock(k, L, w, d, rnd) {
  const body = c(L, 'body', '#a6a6b0'), moss = c(L, 'moss', '#7cc95a');
  k.color(body).add(T.dodeca(), [0, 0.25, 0], [0.42, 0.32, 0.38], [rnd(), rnd(), 0]);
  k.color(mul(body, 0.88)).add(T.dodeca(), [0.25, 0.15, 0.15], 0.2, [rnd(), 0, rnd()]);
  k.color(moss).add(T.dome(9, 3), [-0.05, 0.42, -0.04], [0.26, 0.1, 0.22]);
}

function stump(k, L) {
  const bark = c(L, 'bark', '#8a5a33'), top = c(L, 'top', '#d9b07a');
  k.color(bark).add(T.cyl(0.92, 1, 9), [0, 0.18, 0], [0.3, 0.36, 0.3]);
  k.color(top).add(T.cyl(1, 1, 9), [0, 0.365, 0], [0.27, 0.02, 0.27]);
  k.color(mul(top, 0.8)).add(T.torus(0.12, 3, 12), [0, 0.38, 0], [0.16, 0.16, 0.5], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) k.color(mul(bark, 0.85)).add(T.cyl(0.4, 1, 5), [Math.cos(i * 2.1) * 0.3, 0.05, Math.sin(i * 2.1) * 0.3], [0.07, 0.12, 0.07], [Math.sin(i * 2.1) * 1.2, 0, -Math.cos(i * 2.1) * 1.2]);
}

function log(k, L, w) {
  const bark = c(L, 'bark', '#8a5a33'), top = c(L, 'top', '#d9b07a');
  k.color(bark).add(T.cyl(1, 1, 10), [0, 0.24, 0], [0.24, w * 0.85, 0.24], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) {
    k.color(top).add(T.cyl(1, 1, 10), [s * w * 0.426, 0.24, 0], [0.21, 0.02, 0.21], [0, 0, Math.PI / 2]);
  }
  k.color('#5fb548').add(T.dome(6, 2), [0.2, 0.46, 0], [0.18, 0.06, 0.14]);
}

function flowerbed(k, L, w, d, rnd) {
  const soil = c(L, 'soil', '#8a5a33'), p1 = c(L, 'petals', '#ff8fc7'), p2 = c(L, 'petals2', '#ffe066');
  k.color(mul(soil, 1.1)).add(T.rbox(0.3), [0, 0.06, 0], [0.9, 0.12, 0.9]);
  k.color(mul(soil, 0.75)).add(T.box(), [0, 0.12, 0], [0.78, 0.02, 0.78]);
  for (let i = 0; i < 9; i++) {
    const x = ((i % 3) - 1) * 0.25 + (rnd() - 0.5) * 0.08, z = (Math.floor(i / 3) - 1) * 0.25 + (rnd() - 0.5) * 0.08;
    k.color('#4f9e3a').add(T.cyl(1, 1, 4), [x, 0.18, z], [0.015, 0.12, 0.015]);
    k.color(i % 2 ? p1 : p2).add(T.sphere(6, 4), [x, 0.26, z], [0.07, 0.04, 0.07]);
    k.color('#ffffff').add(T.sphere(4, 3), [x, 0.29, z], 0.02);
  }
}

function mushroom_big(k, L) {
  const cap = c(L, 'cap', '#e8503c'), spots = c(L, 'spots', '#ffffff'), stem = c(L, 'stem', '#f4e3c4');
  k.color(stem).add(T.cyl(0.8, 1, 9), [0, 0.35, 0], [0.18, 0.7, 0.18]);
  k.color(cap).add(T.dome(14, 5), [0, 0.66, 0], [0.55, 0.45, 0.55]);
  k.color(mul(stem, 0.9)).add(T.cyl(1, 0.6, 14), [0, 0.66, 0], [0.54, 0.05, 0.54]);
  const sp = [[0, 1.1, 0.05, 0.1], [0.3, 0.95, 0.25, 0.08], [-0.32, 0.92, 0.2, 0.09], [0.25, 0.9, -0.32, 0.08], [-0.2, 1.0, -0.25, 0.07], [0.42, 0.78, -0.05, 0.06]];
  for (const [x, y, z, r] of sp) k.color(spots).add(T.sphere(6, 4), [x, y, z], [r, r * 0.5, r]);
  k.lineless = true;
  for (const s of [1, -1]) k.color('#2a2030').add(T.sphere(5, 4), [0.06 * s, 0.42, 0.17], [0.025, 0.04, 0.015]);
  k.lineless = false;
}

function crystal(k, L, w, d, rnd) {
  const body = c(L, 'body', '#9fe6ff'), glow = c(L, 'glow', '#c9a6ff');
  k.color(mul(body, 0.6)).add(T.dodeca(), [0, 0.1, 0], [0.35, 0.15, 0.3]);
  const cr = [[0, 0.55, 0, 0.16, 1.0, 0], [0.2, 0.35, 0.1, 0.11, 0.65, -0.4], [-0.2, 0.32, 0.05, 0.12, 0.6, 0.45], [0.05, 0.28, -0.2, 0.1, 0.55, 0.3]];
  cr.forEach(([x, y, z, r, h, rz], i) => {
    k.color(i % 2 ? glow : body, 0.35).add(T.cyl(1, 1, 6), [x, y, z], [r, h * 0.7, r], [0, 0, rz]);
    k.push().tf(x, y, z, 0, 0, rz);
    k.color(lighten(i % 2 ? glow : body, 0.3), 0.4).add(T.cone(6), [0, h * 0.35 + 0.08, 0], [r, 0.17, r]);
    k.pop();
  });
  return [{ type: 'crystal', x: 0, y: 0, h: 0.8, color: '#' + C(glow).getHexString() }];
}

function fence(k, L, w) {
  const wood = c(L, 'wood', '#c98c50');
  for (const s of [-0.38, 0.38]) {
    k.color(wood).add(T.box(), [s, 0.3, 0], [0.1, 0.6, 0.1]);
    k.color(lighten(wood, 0.15)).add(T.cone(4), [s, 0.63, 0], [0.075, 0.08, 0.075], [0, Math.PI / 4, 0]);
  }
  k.color(mul(wood, 0.9)).add(T.box(), [0, 0.42, 0], [w * 1.0, 0.07, 0.06]);
  k.color(mul(wood, 0.9)).add(T.box(), [0, 0.22, 0], [w * 1.0, 0.07, 0.06]);
}

function hedge_arch(k, L, w) {
  const leaves = c(L, 'leaves', '#3f9e4a'), fl = c(L, 'flowers', '#ff8fc7');
  const half = w / 2 - 0.4;
  for (const s of [-1, 1]) {
    k.color(leaves).add(T.rbox(0.5), [s * half, 0.6, 0], [0.62, 1.2, 0.6]);
    k.color(lighten(leaves, 0.1)).add(T.ico(1), [s * half, 1.25, 0], 0.32);
  }
  k.color(leaves).add(T.torus(0.24, 6, 14, Math.PI), [0, 1.2, 0], [half, half * 0.55, 0.9]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI;
    k.color(i % 2 ? fl : '#ffffff').add(T.sphere(6, 4), [Math.cos(a) * half, 1.2 + Math.sin(a) * half * 0.55, 0.2], 0.07);
  }
}

function lamp(k, L) {
  const pole = c(L, 'pole', '#4a4a5a'), light = c(L, 'light', '#ffe680');
  k.color(mul(pole, 0.9)).add(T.cyl(0.8, 1, 8), [0, 0.07, 0], [0.16, 0.14, 0.16]);
  k.color(pole).add(T.cyl(0.8, 1, 6), [0, 0.7, 0], [0.045, 1.2, 0.045]);
  k.color(pole).add(T.cyl(1, 0.6, 6), [0, 1.32, 0], [0.16, 0.06, 0.16]);
  k.color(light, 1).add(T.cyl(0.85, 1, 6), [0, 1.43, 0], [0.12, 0.18, 0.12]);
  k.color(pole).add(T.cone(6), [0, 1.6, 0], [0.18, 0.15, 0.18]);
  k.color(pole).add(T.sphere(5, 4), [0, 1.69, 0], 0.035);
  return [{ type: 'lamp', x: 0, y: 0, h: 1.43, color: '#' + C(light).getHexString() }];
}

function sign(k, L) {
  const wood = c(L, 'wood', '#c98c50'), text = c(L, 'text', '#5a3a22');
  k.color(mul(wood, 0.85)).add(T.box(), [0, 0.35, 0], [0.08, 0.7, 0.08]);
  k.color(wood).add(T.rbox(0.25), [0, 0.68, 0.02], [0.66, 0.36, 0.07]);
  k.lineless = true;
  for (let i = 0; i < 3; i++) k.color(text).add(T.box(), [-0.05 + (i === 2 ? -0.08 : 0), 0.76 - i * 0.08, 0.06], [i === 2 ? 0.3 : 0.44, 0.03, 0.01]);
  k.lineless = false;
}

function bench(k, L, w) {
  const wood = c(L, 'wood', '#c98c50'), metal = c(L, 'metal', '#4a4a5a');
  const W = w * 0.85;
  for (const s of [-1, 1]) {
    k.color(metal).add(T.box(), [s * W * 0.42, 0.14, 0.05], [0.06, 0.28, 0.32]);
    k.color(metal).add(T.box(), [s * W * 0.42, 0.42, -0.13], [0.06, 0.32, 0.05]);
  }
  for (let i = 0; i < 3; i++) k.color(i % 2 ? mul(wood, 0.92) : wood).add(T.rbox(0.25), [0, 0.3, 0.14 - i * 0.11], [W, 0.06, 0.1]);
  for (let i = 0; i < 2; i++) k.color(wood).add(T.rbox(0.25), [0, 0.48 + i * 0.13, -0.15], [W, 0.1, 0.05]);
}

function well(k, L, w) {
  const stone = c(L, 'stone', '#b9bccb'), roof = c(L, 'roof', '#c8503c'), water = c(L, 'water', '#3fa9e8');
  const R = w * 0.38;
  k.color(stone).add(T.cyl(1, 1, 14, false), [0, 0.28, 0], [R, 0.56, R]);
  k.color(lighten(stone, 0.15)).add(T.torus(0.18, 5, 16), [0, 0.57, 0], [R * 0.93, R * 0.93, R * 0.93], [Math.PI / 2, 0, 0]);
  k.color(water, 0.25).add(T.cyl(1, 1, 14), [0, 0.45, 0], [R * 0.82, 0.02, R * 0.82]);
  for (const s of [-1, 1]) k.color('#8a5a33').add(T.box(), [s * R * 0.9, 0.95, 0], [0.08, 0.85, 0.08]);
  k.color('#8a5a33').add(T.cyl(1, 1, 6), [0, 1.18, 0], [0.04, R * 1.8, 0.04], [0, 0, Math.PI / 2]);
  k.color(roof).add(roofPrism(), [0, 1.3, 0], [R * 2.6, 0.5, R * 1.7]);
  k.color('#8a5a33').add(T.cyl(0.85, 1, 7), [0.15, 0.85, 0.05], [0.1, 0.14, 0.1]);
}

function fountain(k, L, w) {
  const stone = c(L, 'stone', '#d8dae4'), water = c(L, 'water', '#68c4f2');
  const R = w * 0.46;
  k.color(stone).add(basinT(), [0, 0, 0], [R, 1, R]);
  k.color(water, 0.3).add(T.cyl(1, 1, 18), [0, 0.28, 0], [R * 0.88, 0.02, R * 0.88]);
  k.color(mul(stone, 0.92)).add(T.cyl(0.7, 1, 10), [0, 0.55, 0], [0.18, 0.7, 0.18]);
  k.color(stone).add(bowlT(), [0, 0.85, 0], [0.62, 0.7, 0.62]);
  k.color(water, 0.35).add(T.cyl(1, 1, 12), [0, 1.0, 0], [0.5, 0.02, 0.5]);
  k.color(mul(stone, 0.95)).add(T.cyl(0.6, 1, 8), [0, 1.15, 0], [0.08, 0.3, 0.08]);
  k.color(lighten(water, 0.3), 0.5).add(T.sphere(8, 6), [0, 1.35, 0], [0.1, 0.12, 0.1]);
  return [{ type: 'fountain', x: 0, y: 0, h: 1.35, color: '#' + C(water).getHexString(), r: R }];
}

function statue(k, L) {
  const stone = c(L, 'stone', '#d8dae4'), base = c(L, 'base', '#a3a7b8');
  k.color(base).add(T.rbox(0.25), [0, 0.18, 0], [0.75, 0.36, 0.75]);
  k.color(mul(base, 1.1)).add(T.box(), [0, 0.38, 0], [0.62, 0.05, 0.62]);
  k.color(stone).add(T.cyl(0.55, 1, 10), [0, 0.68, 0], [0.22, 0.56, 0.18]);
  k.color(stone).add(T.sphere(10, 8), [0, 1.1, 0], 0.17);
  k.color(stone).add(T.cone(8), [0, 1.36, 0], [0.18, 0.3, 0.18], [-0.15, 0, 0]);
  k.color(stone).add(T.cyl(1, 1, 10), [0, 1.22, 0], [0.24, 0.02, 0.24]);
  k.color(stone).add(T.capsule(1.6, 6), [0.2, 0.78, 0.04], [0.08, 0.08, 0.08], [0, 0, -0.5]);
  k.color(mul(stone, 0.9)).add(T.cyl(1, 1, 6), [0.32, 1.05, 0.04], [0.025, 0.85, 0.025]);
  k.color(lighten(stone, 0.2)).add(T.octa(), [0.32, 1.5, 0.04], 0.06);
}

function barrel(k, L) {
  const wood = c(L, 'wood', '#b0743d'), band = c(L, 'band', '#5a5a66');
  k.color(wood).add(barrelT(), [0, 0, 0], [0.62, 0.72, 0.62]);
  for (const y of [0.15, 0.57]) k.color(band).add(T.torus(0.08, 4, 14), [0, y, 0], [0.3, 0.3, 0.3], [Math.PI / 2, 0, 0]);
  k.color(mul(wood, 0.8)).add(T.cyl(1, 1, 10), [0, 0.715, 0], [0.25, 0.012, 0.25]);
}

function crate(k, L, w, d, rnd) {
  const wood = c(L, 'wood', '#d6a060'), edge = c(L, 'edge', '#9a6a3a');
  const s = 0.68;
  k.push().tf(0, 0, 0, 0, (rnd() - 0.5) * 0.3, 0);
  k.color(wood).add(T.box(), [0, s / 2, 0], [s, s, s]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.color(edge).add(T.box(), [x * s / 2, s / 2, z * s / 2], [0.07, s + 0.01, 0.07]);
  for (const y of [0, s]) {
    k.color(edge).add(T.box(), [0, y, s / 2], [s, 0.07, 0.07]).add(T.box(), [0, y, -s / 2], [s, 0.07, 0.07]);
    k.color(edge).add(T.box(), [s / 2, y, 0], [0.07, 0.07, s]).add(T.box(), [-s / 2, y, 0], [0.07, 0.07, s]);
  }
  k.color(edge).add(T.box(), [0, s / 2, s / 2 + 0.01], [0.07, s * 1.3, 0.04], [0, 0, 0.78]);
  k.pop();
}

function stall(k, L, w, d, rnd) {
  const wood = c(L, 'wood', '#c98c50'), aw = c(L, 'awning', '#ff6b6b'), aw2 = c(L, 'awning2', '#ffffff');
  const W = w * 0.9, D = d * 0.8;
  k.color(wood).add(T.rbox(0.25), [0, 0.4, D * 0.18], [W, 0.8, D * 0.4]);
  k.color(lighten(wood, 0.15)).add(T.box(), [0, 0.82, D * 0.2], [W + 0.06, 0.05, D * 0.46]);
  for (const s of [-1, 1]) for (const z of [-D / 2 + 0.05, D / 2 - 0.05]) k.color(mul(wood, 0.85)).add(T.box(), [s * (W / 2 - 0.05), 0.75, z], [0.08, 1.5, 0.08]);
  // striped awning sloping toward the front
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (W / n) * (i + 0.5);
    k.color(i % 2 ? aw2 : aw).add(T.box(), [x, 1.55, 0], [W / n + 0.002, 0.05, D + 0.2], [0.25, 0, 0]);
    k.color(i % 2 ? aw2 : aw).add(T.cyl(1, 1, 6), [x, 1.38, D / 2 + 0.13], [W / n / 2, 0.14, 0.03], [0, 0, 0]);
  }
  // goods
  const goods = ['#ff6b6b', '#ffd24a', '#7cc95a', '#ff9a3c', '#c9a6ff'];
  for (let i = 0; i < 9; i++) k.color(goods[(rnd() * goods.length) | 0]).add(T.sphere(6, 5), [-W / 2 + 0.3 + (i % 5) * (W - 0.6) / 4, 0.92, D * 0.15 + Math.floor(i / 5) * 0.16], 0.08);
}

function cart(k, L, w) {
  const wood = c(L, 'wood', '#b0743d'), wheel = c(L, 'wheel', '#5a3a22');
  k.color(wood).add(T.box(), [0, 0.5, 0], [w * 0.7, 0.3, 0.75]);
  k.color(mul(wood, 0.85)).add(T.box(), [0, 0.67, 0], [w * 0.72, 0.05, 0.77]);
  for (const s of [-1, 1]) {
    k.color(wheel).add(T.torus(0.2, 5, 12), [0.1, 0.3, s * 0.42], [0.28, 0.28, 0.4]);
    k.color(mul(wheel, 1.2)).add(T.cyl(1, 1, 6), [0.1, 0.3, s * 0.42], [0.06, 0.08, 0.06], [Math.PI / 2, 0, 0]);
    k.color(wood).add(T.box(), [-w * 0.45, 0.45, s * 0.25], [0.6, 0.05, 0.05], [0, 0, -0.25]);
  }
  k.color('#e8c870').add(T.ico(0), [0.1, 0.78, 0], [0.3, 0.14, 0.25]);
}

function campfire(k, L) {
  const stone = c(L, 'stone', '#a6a6b0'), flame = c(L, 'flame', '#ffa040');
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.color(i % 2 ? stone : mul(stone, 0.85)).add(T.dodeca(), [Math.cos(a) * 0.32, 0.06, Math.sin(a) * 0.32], [0.11, 0.08, 0.1], [a, 0, 0]);
  }
  k.color('#7a4e2c').add(T.cyl(1, 1, 6), [0, 0.08, 0], [0.05, 0.5, 0.05], [Math.PI / 2, 0.5, 0]);
  k.color('#6b4423').add(T.cyl(1, 1, 6), [0, 0.1, 0], [0.05, 0.5, 0.05], [Math.PI / 2, -0.7, 0]);
  k.lineless = true;
  k.color(flame, 1).add(T.cone(6), [0, 0.28, 0], [0.16, 0.38, 0.16]);
  k.color('#fff2a0', 1).add(T.cone(5), [0, 0.22, 0.03], [0.08, 0.22, 0.08]);
  k.lineless = false;
  return [{ type: 'fire', x: 0, y: 0, h: 0.2, color: '#' + C(flame).getHexString() }];
}

function tent(k, L, w, d) {
  const cloth = c(L, 'cloth', '#f4d06f'), trim = c(L, 'trim', '#c8503c');
  k.push().tf(0, 0, 0, 0, Math.PI / 2, 0);
  k.color(cloth).add(roofPrism(), [0, 0, 0], [w * 0.85, 1.25, d * 0.8]);
  k.pop();
  k.color(trim).add(T.box(), [0, 1.24, 0], [0.06, 0.06, d * 0.82]);
  k.color(mul(cloth, 0.55)).add(T.shape('tentdoor', [[-0.3, 0], [0.3, 0], [0, 0.8]], 0.02), [0, 0.01, d * 0.4 + 0.012], [1, 1, 1]);
  k.color(trim).add(T.shape('tentflap', [[0, 0], [0.32, 0], [0.02, 0.85]], 0.02), [0.02, 0.01, d * 0.4 + 0.03], [1, 1, 1], [0, -0.3, 0]);
  k.color('#8a5a33').add(T.cyl(1, 1, 5), [0, 1.35, d * 0.42], [0.025, 0.25, 0.025]);
  k.color(trim).add(T.box(), [0.09, 1.42, d * 0.42], [0.16, 0.09, 0.01]);
}

// ---------------- buildings ----------------

function signIcon(k, kind, x, y, z) {
  const ic = { potion: '#ff5a9a', hat: '#7a5ad9', bag: '#c98c50', bread: '#e8a050', cup: '#ffffff', book: '#3d5aa8', sword: '#c8ccd8' }[kind];
  if (!ic) return;
  k.color('#5a3a22').add(T.box(), [x + 0.22, y + 0.28, z], [0.5, 0.04, 0.04]);
  k.color('#5a3a22').add(T.cyl(1, 1, 3), [x + 0.08, y + 0.2, z], [0.01, 0.14, 0.01]).add(T.cyl(1, 1, 3), [x + 0.36, y + 0.2, z], [0.01, 0.14, 0.01]);
  k.color('#fff2d6').add(T.rbox(0.3), [x + 0.22, y, z], [0.42, 0.32, 0.05]);
  k.color(mul('#fff2d6', 0.7)).add(T.box(), [x + 0.22, y, z - 0.005], [0.45, 0.35, 0.03]);
  const cx = x + 0.22, cz = z + 0.04;
  switch (kind) {
    case 'potion':
      k.color(ic).add(T.sphere(8, 6), [cx, y - 0.04, cz], [0.09, 0.09, 0.03]);
      k.color('#cfe8ff').add(T.box(), [cx, y + 0.07, cz], [0.04, 0.07, 0.02]);
      k.color('#8a5a33').add(T.box(), [cx, y + 0.115, cz], [0.05, 0.025, 0.025]);
      break;
    case 'hat':
      k.color(ic).add(T.cone(6), [cx, y + 0.02, cz], [0.08, 0.2, 0.025], [0, 0, 0.15]);
      k.color(ic).add(T.box(), [cx, y - 0.08, cz], [0.22, 0.03, 0.02]);
      k.color('#ffe066').add(T.octa(), [cx + 0.015, y, cz + 0.02], 0.02);
      break;
    case 'bag':
      k.color(ic).add(T.sphere(8, 6), [cx, y - 0.04, cz], [0.1, 0.09, 0.03]);
      k.color(mul(ic, 0.7)).add(T.box(), [cx, y + 0.06, cz], [0.06, 0.03, 0.025]);
      k.color('#ffd24a').add(T.cyl(1, 1, 6), [cx, y - 0.04, cz + 0.02], [0.03, 0.01, 0.03], [Math.PI / 2, 0, 0]);
      break;
    case 'bread':
      k.color(ic).add(T.capsule(1.4, 6), [cx, y - 0.01, cz], [0.09, 0.09, 0.03], [0, 0, Math.PI / 2]);
      for (let i = -1; i <= 1; i++) k.color('#fff2c0').add(T.box(), [cx + i * 0.05, y + 0.02, cz + 0.02], [0.012, 0.06, 0.01], [0, 0, 0.5]);
      break;
    case 'cup':
      k.color(ic).add(T.cyl(0.85, 1, 8), [cx - 0.02, y - 0.02, cz], [0.06, 0.13, 0.025]);
      k.color(ic).add(T.torus(0.3, 4, 8), [cx + 0.05, y - 0.02, cz], [0.035, 0.04, 0.03]);
      k.color('#8a5a33').add(T.box(), [cx - 0.02, y + 0.035, cz + 0.005], [0.09, 0.015, 0.02]);
      break;
    case 'book':
      k.color(ic).add(T.box(), [cx - 0.05, y, cz], [0.1, 0.18, 0.02], [0, 0.25, 0]);
      k.color(ic).add(T.box(), [cx + 0.05, y, cz], [0.1, 0.18, 0.02], [0, -0.25, 0]);
      k.color('#ffffff').add(T.box(), [cx, y, cz + 0.012], [0.16, 0.15, 0.01]);
      break;
    case 'sword':
      k.color(ic).add(T.box(), [cx, y + 0.03, cz], [0.035, 0.2, 0.02], [0, 0, 0.6]);
      k.color('#ffd24a').add(T.box(), [cx - 0.04, y - 0.05, cz], [0.1, 0.025, 0.025], [0, 0, 0.6]);
      break;
  }
}

function windowAt(k, x, y, z, w, h, trim, shutter) {
  k.color(trim).add(T.box(), [x, y, z], [w + 0.08, h + 0.08, 0.06]);
  k.color('#bfe6ff', 0.25).add(T.box(), [x, y, z + 0.02], [w, h, 0.04]);
  k.lineless = true;
  k.color('#fff6c8', 0.7).add(T.box(), [x - w * 0.22, y + h * 0.18, z + 0.045], [w * 0.22, h * 0.25, 0.005]);
  k.lineless = false;
  k.color(trim).add(T.box(), [x, y, z + 0.035], [0.035, h, 0.03]).add(T.box(), [x, y, z + 0.035], [w, 0.035, 0.03]);
  if (shutter) {
    k.color(shutter).add(T.box(), [x - w / 2 - 0.09, y, z], [0.1, h + 0.04, 0.04]).add(T.box(), [x + w / 2 + 0.09, y, z], [0.1, h + 0.04, 0.04]);
  }
  k.color(mul(trim, 0.9)).add(T.box(), [x, y - h / 2 - 0.06, z + 0.04], [w + 0.16, 0.05, 0.1]);
}

function doorAt(k, x, z, w, h, door, trim) {
  k.color(trim).add(T.box(), [x, h / 2 + 0.12, z], [w + 0.12, h + 0.08, 0.06]);
  k.color(door).add(T.rbox(0.2), [x, h / 2 + 0.11, z + 0.03], [w, h, 0.05]);
  k.color(trim).add(T.dome(10, 3), [x, h + 0.13, z + 0.02], [w / 2 + 0.06, 0.14, 0.04], [Math.PI / 2, 0, 0]);
  k.color(mul(door, 0.85)).add(T.box(), [x, h / 2 + 0.11, z + 0.06], [0.03, h * 0.9, 0.01]);
  k.color('#ffd24a').add(T.sphere(5, 4), [x + w * 0.3, h * 0.5 + 0.1, z + 0.075], 0.03);
  k.color(mul('#b9bccb', 1)).add(T.rbox(0.3), [x, 0.06, z + 0.16], [w + 0.2, 0.12, 0.28]);
}

/** Front-gabled roof: two slabs meeting at a north-south ridge, wall-colored gable triangles front and back. */
function gableRoof(k, x, y, z, W, D, RH, roofC, wallC, trimC, attic) {
  const half = W / 2 + 0.18;
  const ang = Math.atan2(RH, half);
  const L = Math.hypot(half, RH) + 0.06;
  for (const s of [-1, 1]) {
    k.push().tf(x + s * half / 2, y + RH / 2, z, 0, 0, -s * ang);
    k.color(roofC).add(T.box(), [0, 0.05, 0], [L, 0.1, D + 0.4]);
    for (let i = 1; i <= 2; i++) k.color(mul(roofC, 0.86)).add(T.box(), [s * (L / 2 - i * L / 3), 0.105, 0], [0.04, 0.02, D + 0.41]);
    k.pop();
  }
  k.color(mul(roofC, 0.75)).add(T.box(), [x, y + RH + 0.05, z], [0.12, 0.1, D + 0.44]);
  for (const s of [-1, 1]) {
    const zz = z + s * (D / 2);
    k.color(wallC).add(T.shape('gable', [[-0.5, 0], [0.5, 0], [0, 1]], 0.06), [x, y, zz], [W, RH * 0.98, 1]);
    // bargeboards along the gable edges
    if (s > 0) {
      k.push().tf(x, y, z + D / 2 + 0.2, 0, 0, 0);
      for (const t of [-1, 1]) k.color(trimC).add(T.box(), [t * half / 2, RH / 2 + 0.04, 0], [L, 0.07, 0.06], [0, 0, -t * ang]);
      k.pop();
    }
  }
  if (attic) {
    k.color(trimC).add(T.cyl(1, 1, 12), [x, y + RH * 0.38, z + D / 2 + 0.03], [0.16, 0.05, 0.16], [Math.PI / 2, 0, 0]);
    k.color('#bfe6ff', 0.3).add(T.cyl(1, 1, 12), [x, y + RH * 0.38, z + D / 2 + 0.055], [0.11, 0.02, 0.11], [Math.PI / 2, 0, 0]);
  }
}

function house(k, L, w, d, rnd, kind) {
  const wall = c(L, 'wall', '#f4e3c4'), roof = c(L, 'roof', '#d9534f'), trim = c(L, 'trim', '#8a5a33'), door = c(L, 'door', '#6b4423');
  const W = w * 0.8, D = d * 0.66, H = 1.42;
  const zf = D / 2;            // south wall face
  const y0 = 0.14;
  k.color('#b9bccb').add(T.rbox(0.3), [0, 0.07, 0], [W + 0.16, 0.14, D + 0.16]);
  k.color(wall).add(T.box(), [0, y0 + H / 2, 0], [W, H, D]);
  // timber frame
  for (const s of [-1, 1]) {
    k.color(trim).add(T.box(), [s * W / 2, y0 + H / 2, zf], [0.11, H, 0.11]);
    k.color(trim).add(T.box(), [s * W / 2, y0 + H / 2, -zf], [0.11, H, 0.11]);
  }
  k.color(trim).add(T.box(), [0, y0 + H - 0.03, zf + 0.01], [W + 0.04, 0.1, 0.1]);
  k.color(mul(wall, 0.85)).add(T.box(), [0, y0 + 0.05, zf + 0.01], [W, 0.1, 0.05]);
  const RH = Math.min(1.0, W * 0.32);
  gableRoof(k, 0, y0 + H, 0, W, D, RH, roof, wall, trim, kind !== 'shop');
  // chimney on the east slope
  k.color('#c87a5a').add(T.box(), [W * 0.3, y0 + H + RH * 0.55, -0.1], [0.26, 0.75, 0.26]);
  k.color('#8a5a4a').add(T.box(), [W * 0.3, y0 + H + RH * 0.55 + 0.38, -0.1], [0.32, 0.07, 0.32]);
  // door + windows (south face)
  const dx = kind === 'shop' ? -W * 0.22 : 0;
  doorAt(k, dx, zf, 0.5, 0.82, door, trim);
  const shutter = mix(roof, '#ffffff', 0.15);
  if (kind === 'shop') {
    windowAt(k, W * 0.2, 0.85, zf + 0.02, 0.9, 0.58, trim, null);
    // goods on display
    for (let i = 0; i < 3; i++) k.color(['#ff5a9a', '#9fe6ff', '#ffd24a'][i]).add(T.sphere(6, 5), [W * 0.2 - 0.25 + i * 0.25, 0.68, zf + 0.06], 0.06);
    // striped awning
    const n = 6, aw = W * 0.62;
    for (let i = 0; i < n; i++) {
      k.color(i % 2 ? '#ffffff' : roof).add(T.box(), [W * 0.2 - aw / 2 + (aw / n) * (i + 0.5), 1.32, zf + 0.2], [aw / n + 0.002, 0.04, 0.42], [0.5, 0, 0]);
      k.color(i % 2 ? '#ffffff' : roof).add(T.cyl(1, 1, 6), [W * 0.2 - aw / 2 + (aw / n) * (i + 0.5), 1.22, zf + 0.41], [aw / n / 2, 0.08, 0.02]);
    }
  } else {
    windowAt(k, -W * 0.3, 0.88, zf + 0.02, 0.4, 0.44, trim, shutter);
    windowAt(k, W * 0.3, 0.88, zf + 0.02, 0.4, 0.44, trim, shutter);
    // flower boxes
    for (const s of [-1, 1]) {
      k.color(trim).add(T.box(), [s * W * 0.3, 0.57, zf + 0.09], [0.5, 0.1, 0.12]);
      k.lineless = true;
      for (let i = 0; i < 4; i++) k.color(i % 2 ? '#ff8fc7' : '#ffe066').add(T.sphere(5, 4), [s * W * 0.3 - 0.18 + i * 0.12, 0.65, zf + 0.1], 0.055);
      k.lineless = false;
    }
  }
  if (L.sign && L.sign !== 'none') signIcon(k, L.sign, dx + 0.36, 1.16, zf + 0.15);
  return [{ type: 'chimney', x: W * 0.3, y: -0.1, h: y0 + H + RH * 0.55 + 0.45, color: '#e8e4f0' }];
}
function i2(c0) { return mul(c0, 0.8); }

function tower(k, L, w, d) {
  const wall = c(L, 'wall', '#d8dae4'), roof = c(L, 'roof', '#7a5ad9'), trim = c(L, 'trim', '#ffe066'), door = c(L, 'door', '#6b4423');
  const R = Math.min(w, d) * 0.4, H = 1.75;
  k.color('#a3a7b8').add(T.cyl(1, 1, 14), [0, 0.08, 0], [R + 0.1, 0.16, R + 0.1]);
  k.color(wall).add(T.cyl(0.92, 1, 14), [0, 0.16 + H / 2, 0], [R, H, R]);
  for (const y of [0.7, 1.35]) k.color(trim).add(T.torus(0.12, 4, 18), [0, y, 0], [R * 0.97, R * 0.97, R * 0.9], [Math.PI / 2, 0, 0]);
  k.color(trim).add(T.cyl(1, 1, 14), [0, 0.16 + H, 0], [R + 0.08, 0.1, R + 0.08]);
  k.color(roof).add(T.cone(14), [0, 0.16 + H + 0.55, 0], [R + 0.25, 1.1, R + 0.25]);
  k.color(trim).add(T.sphere(6, 5), [0, 0.16 + H + 1.13, 0], 0.07);
  k.color('#8a5a33').add(T.cyl(1, 1, 4), [0, 0.16 + H + 1.3, 0], [0.015, 0.35, 0.015]);
  k.color(trim).add(T.box(), [0.12, 0.16 + H + 1.4, 0], [0.22, 0.13, 0.01]);
  doorAt(k, 0, R * 0.95, 0.44, 0.7, door, trim);
  for (const [a, y] of [[0.75, 1.05], [-0.75, 1.05], [0, 1.6]]) {
    k.push().tf(Math.sin(a) * R * 0.93, 0, Math.cos(a) * R * 0.93, 0, a, 0);
    windowAt(k, 0, y, 0, 0.26, 0.36, trim, null);
    k.pop();
  }
  return [];
}

function academy(k, L, w, d) {
  const wall = c(L, 'wall', '#f4ecd8'), roof = c(L, 'roof', '#3d5aa8'), trim = c(L, 'trim', '#ffd24a'), door = c(L, 'door', '#7a4e2c');
  const W = w * 0.94, D = d * 0.62;
  const zf = D / 2;
  const stone = C('#c8c4b8');
  const y0 = 0.18;
  k.color(stone).add(T.rbox(0.25), [0, 0.09, 0.05], [W + 0.2, 0.18, D + 0.4]);
  // wings: tall walls, low side-gabled roofs so the facade reads from the high camera
  const cW = W * 0.34;
  const wingW = (W - cW) / 2, wingH = 1.5;
  for (const s of [-1, 1]) {
    const x = s * (cW / 2 + wingW / 2);
    k.color(wall).add(T.box(), [x, y0 + wingH / 2, 0], [wingW, wingH, D]);
    k.push().tf(x, y0 + wingH, 0, 0, Math.PI / 2, 0);
    gableRoof(k, 0, 0, 0, D, wingW - 0.1, 0.55, roof, wall, trim, false);
    k.pop();
    k.color(trim).add(T.box(), [x, y0 + wingH - 0.04, zf + 0.01], [wingW, 0.09, 0.08]);
    k.color(mul(wall, 0.88)).add(T.box(), [x, y0 + 0.06, zf + 0.01], [wingW, 0.12, 0.05]);
    for (let i = 0; i < 3; i++) {
      const wx = x - wingW / 3 + i * wingW / 3;
      windowAt(k, wx, 0.72, zf + 0.02, 0.36, 0.5, trim, null);
      windowAt(k, wx, 1.32, zf + 0.02, 0.36, 0.36, trim, null);
    }
    // corner turret
    const tx = s * (W / 2 - 0.05);
    k.color(wall).add(T.cyl(1, 1, 10), [tx, y0 + 1.0, zf], [0.34, 2.0, 0.34]);
    k.color(trim).add(T.cyl(1, 1, 10), [tx, y0 + 2.0, zf], [0.38, 0.08, 0.38]);
    k.color(roof).add(T.cone(10), [tx, y0 + 2.0 + 0.36, zf], [0.44, 0.72, 0.44]);
    k.color(trim).add(T.sphere(6, 4), [tx, y0 + 2.0 + 0.75, zf], 0.06);
    windowAt(k, tx, 1.5, zf + 0.33, 0.16, 0.3, trim, null);
    // banners on the wings
    k.color(roof).add(T.box(), [s * (cW / 2 + 0.25), 1.05, zf + 0.04], [0.26, 0.62, 0.02]);
    k.color(trim).add(T.octa(), [s * (cW / 2 + 0.25), 1.08, zf + 0.06], [0.08, 0.1, 0.015]);
  }
  // central hall: front gable with portico
  const cH = 1.75;
  k.color(lighten(wall, 0.05)).add(T.box(), [0, y0 + cH / 2, 0.08], [cW, cH, D + 0.16]);
  gableRoof(k, 0, y0 + cH, 0.08, cW, D + 0.16, 0.85, roof, lighten(wall, 0.08), trim, false);
  // crest window in the pediment
  k.color(trim).add(T.cyl(1, 1, 12), [0, y0 + cH + 0.3, zf + 0.15], [0.2, 0.05, 0.2], [Math.PI / 2, 0, 0]);
  k.color('#bfe6ff', 0.35).add(T.cyl(1, 1, 12), [0, y0 + cH + 0.3, zf + 0.17], [0.15, 0.03, 0.15], [Math.PI / 2, 0, 0]);
  k.lineless = true;
  k.color(trim, 0.6).add(T.octa(), [0, y0 + cH + 0.3, zf + 0.19], [0.07, 0.09, 0.01]);
  k.lineless = false;
  k.color(trim).add(T.box(), [0, y0 + cH + 0.02, zf + 0.2], [cW + 0.1, 0.1, 0.12]);
  // portico columns
  for (let i = 0; i < 4; i++) {
    const x = -cW * 0.39 + i * cW * 0.26;
    k.color('#ffffff').add(T.cyl(0.88, 1, 8), [x, y0 + cH / 2, zf + 0.26], [0.085, cH, 0.085]);
    k.color(stone).add(T.box(), [x, y0 + 0.05, zf + 0.26], [0.22, 0.1, 0.22]);
    k.color(stone).add(T.box(), [x, y0 + cH - 0.05, zf + 0.26], [0.22, 0.08, 0.22]);
  }
  // steps
  for (let i = 0; i < 3; i++) k.color(i % 2 ? stone : lighten(stone, 0.1)).add(T.box(), [0, 0.04 + i * 0.06, zf + 0.62 - i * 0.12], [cW * 0.75 - i * 0.12, 0.08, 0.3]);
  // grand double door
  doorAt(k, -0.24, zf + 0.08, 0.46, 1.0, door, trim);
  doorAt(k, 0.24, zf + 0.08, 0.46, 1.0, door, trim);
  windowAt(k, -cW * 0.33, 1.5, zf + 0.1, 0.24, 0.34, trim, null);
  windowAt(k, cW * 0.33, 1.5, zf + 0.1, 0.24, 0.34, trim, null);
  if (L.sign && L.sign !== 'none') signIcon(k, L.sign, -0.22, 1.42, zf + 0.34);
  // bell tower behind the hall (keeps the whole thing ~3.3 tall)
  k.color(wall).add(T.box(), [0, y0 + cH + 0.75, -0.35], [0.52, 0.7, 0.52]);
  k.color('#3a3a4a').add(T.box(), [0, y0 + cH + 0.8, -0.085], [0.24, 0.32, 0.02]);
  k.color('#ffd24a', 0.3).add(T.sphere(6, 4), [0, y0 + cH + 0.76, -0.12], 0.08);
  k.color(roof).add(T.cone(4), [0, y0 + cH + 1.35, -0.35], [0.46, 0.55, 0.46], [0, Math.PI / 4, 0]);
  k.color(trim).add(T.octa(), [0, y0 + cH + 1.7, -0.35], [0.07, 0.12, 0.07]);
  return [];
}

function gate_arch(k, L, w) {
  const stone = c(L, 'stone', '#d8dae4'), trim = c(L, 'trim', '#ffd24a');
  const half = w / 2 - 0.3;
  for (const s of [-1, 1]) {
    k.color(stone).add(T.box(), [s * half, 0.85, 0], [0.5, 1.7, 0.5]);
    k.color(mul(stone, 0.9)).add(T.box(), [s * half, 0.08, 0], [0.6, 0.16, 0.6]);
    k.color(trim).add(T.box(), [s * half, 1.72, 0], [0.56, 0.08, 0.56]);
    k.color(trim).add(T.sphere(6, 5), [s * half, 1.85, 0], 0.1);
  }
  k.color(stone).add(T.torus(0.22, 5, 14, Math.PI), [0, 1.35, 0], [half, 0.45, 1.3]);
  k.color(stone).add(T.box(), [0, 1.85, 0], [w * 0.9, 0.22, 0.42]);
  k.color(trim).add(T.box(), [0, 1.85, 0.22], [w * 0.55, 0.12, 0.02]);
}

function rune_gate(k, L, w) {
  const stone = c(L, 'stone', '#8f88b8'), rune = c(L, 'rune', '#9fe6ff');
  const half = w / 2 - 0.3;
  for (const s of [-1, 1]) {
    k.color(stone).add(T.box(), [s * half, 0.8, 0], [0.48, 1.6, 0.48]);
    k.lineless = true;
    for (let i = 0; i < 3; i++) k.color(rune, 1).add(T.octa(), [s * half, 0.45 + i * 0.4, 0.245], [0.07, 0.09, 0.01]);
    k.lineless = false;
    k.color(mul(stone, 0.8)).add(T.cone(4), [s * half, 1.75, 0], [0.32, 0.3, 0.32], [0, Math.PI / 4, 0]);
  }
  k.color(stone).add(T.box(), [0, 1.5, 0], [w * 0.75, 0.25, 0.4]);
  k.lineless = true;
  k.color(rune, 1).add(T.box(), [0, 1.5, 0.205], [w * 0.5, 0.04, 0.01]);
  k.lineless = false;
  return [{ type: 'rune', x: 0, y: 0, h: 1.0, color: '#' + C(rune).getHexString() }];
}

function bridge(k, L, w, d) {
  const wood = c(L, 'wood', '#c98c50'), rail = c(L, 'rail', '#8a5a33');
  // planks run across the bridge (it spans east-west if w >= d)
  const along = w >= d;
  const len = along ? w : d, wid = along ? d : w;
  const n = Math.round(len * 3);
  for (let i = 0; i < n; i++) {
    const u = -len / 2 + (i + 0.5) * (len / n);
    const y = 0.08 + Math.sin(((i + 0.5) / n) * Math.PI) * 0.12;
    const col = i % 2 ? wood : mul(wood, 0.9);
    if (along) k.color(col).add(T.box(), [u, y, 0], [len / n - 0.03, 0.07, wid * 0.8]);
    else k.color(col).add(T.box(), [0, y, u], [wid * 0.8, 0.07, len / n - 0.03]);
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 3; i++) {
      const u = -len / 2 + 0.1 + i * (len - 0.2) / 3;
      const y = 0.08 + Math.sin((i / 3) * Math.PI) * 0.12;
      if (along) k.color(rail).add(T.box(), [u, y + 0.25, s * wid * 0.4], [0.08, 0.5, 0.08]);
      else k.color(rail).add(T.box(), [s * wid * 0.4, y + 0.25, u], [0.08, 0.5, 0.08]);
    }
    if (along) k.color(rail).add(T.box(), [0, 0.62, s * wid * 0.4], [len - 0.1, 0.06, 0.06]);
    else k.color(rail).add(T.box(), [s * wid * 0.4, 0.62, 0], [0.06, 0.06, len - 0.1]);
  }
}

function banner(k, L) {
  const pole = c(L, 'pole', '#8a5a33'), cloth = c(L, 'cloth', '#3d5aa8'), em = c(L, 'emblem', '#ffd24a');
  k.color(mul(pole, 0.9)).add(T.cyl(1, 1, 6), [0, 0.05, 0], [0.14, 0.1, 0.14]);
  k.color(pole).add(T.cyl(1, 1, 6), [0, 0.85, 0], [0.04, 1.7, 0.04]);
  k.color('#ffd24a').add(T.sphere(6, 4), [0, 1.73, 0], 0.06);
  k.color(pole).add(T.cyl(1, 1, 5), [0.22, 1.6, 0], [0.02, 0.46, 0.02], [0, 0, Math.PI / 2]);
  k.color(cloth).add(T.box(), [0.22, 1.2, 0], [0.42, 0.75, 0.03]);
  k.color(cloth).add(T.shape('bannertail', [[-0.21, 0], [0.21, 0], [0.21, -0.18], [0, -0.06], [-0.21, -0.18]], 0.03), [0.22, 0.825, 0], [1, 1, 1]);
  k.color(em).add(T.octa(), [0.22, 1.25, 0.025], [0.11, 0.14, 0.015]);
}

function bookshelf(k, L, w) {
  const wood = c(L, 'wood', '#8a5a33'), b1 = c(L, 'books', '#c8503c'), b2 = c(L, 'books2', '#3d5aa8');
  const W = w * 0.9, H = 1.5, D = 0.42;
  k.color(wood).add(T.box(), [0, H / 2, -0.15], [W, H, 0.06]);
  for (const s of [-1, 1]) k.color(wood).add(T.box(), [s * W / 2, H / 2, 0], [0.07, H, D]);
  for (let i = 0; i < 4; i++) k.color(mul(wood, 1.1)).add(T.box(), [0, 0.05 + i * 0.47, 0], [W, 0.05, D]);
  const cols = [b1, b2, C('#ffd24a'), C('#5fb548'), C('#7a5ad9')];
  for (let shelf = 0; shelf < 3; shelf++) {
    let x = -W / 2 + 0.08;
    let i = shelf * 3;
    while (x < W / 2 - 0.12) {
      const bw = 0.07 + ((i * 7) % 3) * 0.02, bh = 0.28 + ((i * 5) % 4) * 0.03;
      k.color(cols[i % cols.length]).add(T.box(), [x + bw / 2, 0.075 + shelf * 0.47 + bh / 2, 0.03], [bw, bh, 0.3], [0, 0, ((i * 13) % 7 === 0) ? 0.15 : 0]);
      x += bw + 0.01; i++;
    }
  }
}

function table(k, L, w, d, rnd, desk) {
  const wood = c(L, 'wood', '#c98c50');
  const W = w * 0.85, D = Math.max(0.6, d * 0.7);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.color(mul(wood, 0.85)).add(T.box(), [sx * (W / 2 - 0.07), 0.25, sz * (D / 2 - 0.07)], [0.08, 0.5, 0.08]);
  k.color(wood).add(T.rbox(0.25), [0, 0.53, 0], [W, 0.07, D]);
  if (desk) {
    k.color(mul(wood, 0.9)).add(T.box(), [W * 0.25, 0.38, 0], [W * 0.45, 0.22, D * 0.9]);
    k.color(c(L, 'paper', '#ffffff')).add(T.box(), [-0.15, 0.575, 0.03], [0.32, 0.01, 0.24], [0, 0.2, 0]);
    k.color('#2a2a3a').add(T.cyl(0.8, 1, 6), [0.25, 0.61, -0.05], [0.05, 0.08, 0.05]);
    k.color('#ffffff').add(T.box(), [0.27, 0.68, -0.05], [0.01, 0.14, 0.04], [0, 0, -0.3]);
  } else {
    k.color(c(L, 'cloth', '#f4ecd8')).add(T.box(), [0, 0.57, 0], [W * 0.6, 0.012, D + 0.06]);
    k.color('#ff8fc7').add(T.cyl(0.7, 1, 6), [0, 0.63, 0], [0.06, 0.1, 0.06]);
    k.color('#ffe066').add(T.sphere(5, 4), [0, 0.71, 0], 0.05);
  }
}

function chair(k, L) {
  const wood = c(L, 'wood', '#b0743d');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.color(mul(wood, 0.85)).add(T.box(), [sx * 0.15, 0.15, sz * 0.15], [0.05, 0.3, 0.05]);
  k.color(wood).add(T.rbox(0.3), [0, 0.32, 0], [0.38, 0.05, 0.38]);
  k.color(wood).add(T.rbox(0.3), [0, 0.56, -0.17], [0.38, 0.4, 0.05]);
}

function bed(k, L, w, d) {
  const wood = c(L, 'wood', '#8a5a33'), sheet = c(L, 'sheet', '#7fb0ff'), pillow = c(L, 'pillow', '#ffffff');
  const W = w * 0.8, D = d * 0.88;
  k.color(wood).add(T.box(), [0, 0.2, 0], [W, 0.2, D]);
  k.color(wood).add(T.box(), [0, 0.42, -D / 2], [W + 0.06, 0.65, 0.08]);
  k.color(wood).add(T.box(), [0, 0.3, D / 2], [W + 0.06, 0.4, 0.07]);
  k.color('#ffffff').add(T.rbox(0.35), [0, 0.34, 0], [W * 0.95, 0.12, D * 0.95]);
  k.color(pillow).add(T.rbox(0.5), [0, 0.43, -D / 2 + 0.25], [W * 0.7, 0.12, 0.3]);
  k.color(sheet).add(T.rbox(0.35), [0, 0.42, D * 0.12], [W * 0.98, 0.1, D * 0.65]);
  k.color(mul(sheet, 0.8)).add(T.box(), [0, 0.475, -D * 0.2], [W * 0.98, 0.02, 0.06]);
}

function cauldron(k, L) {
  const metal = c(L, 'metal', '#3a3a4a'), brew = c(L, 'brew', '#7cf07c');
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    k.color(metal).add(T.cyl(1, 1, 4), [Math.cos(a) * 0.25, 0.08, Math.sin(a) * 0.25], [0.04, 0.16, 0.04]);
  }
  k.color(metal).add(potT(), [0, 0.08, 0], [0.4, 0.55, 0.4]);
  k.color(lighten(metal, 0.2)).add(T.torus(0.15, 4, 14), [0, 0.63, 0], [0.33, 0.33, 0.33], [Math.PI / 2, 0, 0]);
  k.lineless = true;
  k.color(brew, 0.75).add(T.cyl(1, 1, 12), [0, 0.6, 0], [0.31, 0.02, 0.31]);
  k.lineless = false;
  return [{ type: 'bubbles', x: 0, y: 0, h: 0.62, color: '#' + C(brew).getHexString() }];
}

function chalkboard(k, L, w) {
  const frame = c(L, 'frame', '#8a5a33'), board = c(L, 'board', '#2f5a44'), chalk = c(L, 'chalk', '#ffffff');
  const W = w * 0.85;
  for (const s of [-1, 1]) {
    k.color(frame).add(T.box(), [s * W / 2, 0.6, 0], [0.07, 1.2, 0.07]);
    k.color(frame).add(T.box(), [s * W / 2, 0.03, 0], [0.07, 0.06, 0.45]);
  }
  k.color(frame).add(T.box(), [0, 0.9, 0], [W + 0.1, 0.7, 0.07]);
  k.color(board).add(T.box(), [0, 0.9, 0.02], [W - 0.06, 0.6, 0.05]);
  k.lineless = true;
  k.color(chalk).add(T.box(), [-W * 0.2, 1.05, 0.05], [W * 0.35, 0.025, 0.01]);
  k.color(chalk).add(T.box(), [-W * 0.25, 0.95, 0.05], [W * 0.25, 0.025, 0.01]);
  k.color(chalk).add(T.box(), [W * 0.18, 1.0, 0.05], [0.18, 0.025, 0.01], [0, 0, 0.785]).add(T.box(), [W * 0.18, 1.0, 0.05], [0.18, 0.025, 0.01], [0, 0, -0.785]);
  k.color(chalk).add(T.box(), [W * 0.32, 1.0, 0.05], [0.12, 0.025, 0.01]).add(T.box(), [W * 0.32, 1.0, 0.05], [0.025, 0.12, 0.01]);
  k.color(chalk).add(T.box(), [-W * 0.1, 0.82, 0.05], [W * 0.5, 0.025, 0.01]);
  k.lineless = false;
  k.color(frame).add(T.box(), [0, 0.6, 0.05], [W, 0.03, 0.1]);
}

function rug(k, L, w, d) {
  const main = c(L, 'main', '#c8506a'), border = c(L, 'border', '#e0c060');
  const W = Math.max(1, w) * 0.92, D = Math.max(1, d) * 0.92;
  k.color(border).add(T.rbox(0.2), [0, 0.012, 0], [W, 0.024, D]);
  k.color(main).add(T.box(), [0, 0.022, 0], [W - 0.16, 0.012, D - 0.16]);
  k.color(border).add(T.octa(), [0, 0.03, 0], [W * 0.18, 0.004, D * 0.18]);
}

function chestProp(k, L) {
  const wood = c(L, 'wood', '#b0743d'), metal = c(L, 'metal', '#ffd24a');
  k.color(wood).add(T.rbox(0.3), [0, 0.2, 0], [0.66, 0.36, 0.46]);
  k.push().tf(0, 0.36, 0, 0, 0, Math.PI / 2);
  k.color(wood).add(T.cyl(1, 1, 10), [0, 0, 0], [0.2, 0.66, 0.23]);
  k.pop();
  for (const x of [-0.23, 0.23]) k.color(metal).add(T.box(), [x, 0.2, 0], [0.05, 0.38, 0.48]).add(T.cyl(1, 1, 10), [x, 0.36, 0], [0.205, 0.05, 0.235], [0, 0, Math.PI / 2]);
  k.color(metal).add(T.rbox(0.4), [0, 0.33, 0.24], [0.1, 0.12, 0.04]);
}

const BUILDERS = {
  tree, pine, bush, rock, stump, log, flowerbed, mushroom_big, crystal, fence, hedge_arch, lamp, sign, bench, well, fountain,
  statue, barrel, crate, stall, cart, campfire, tent,
  house: (k, L, w, d, r) => house(k, L, w, d, r, 'house'),
  shop: (k, L, w, d, r) => house(k, L, w, d, r, 'shop'),
  tower, academy, gate_arch, rune_gate, bridge, banner, bookshelf,
  desk: (k, L, w, d, r) => table(k, L, w, d, r, true),
  table: (k, L, w, d, r) => table(k, L, w, d, r, false),
  chair, bed, cauldron, chalkboard, rug, chest: chestProp,
};

/** Blob-shadow radius per model (drawn by the fx shadow batch). */
const SHADOW = { tree: 0.62, pine: 0.5, bush: 0.5, rock: 0.48, stump: 0.38, log: 0.5, mushroom_big: 0.55, crystal: 0.42, lamp: 0.22,
  sign: 0.22, bench: 0.55, well: 0.75, statue: 0.45, barrel: 0.36, crate: 0.42, stall: 0.9, cart: 0.6, tent: 0.95, banner: 0.18,
  cauldron: 0.38, chest: 0.4, table: 0.6, desk: 0.6, chair: 0.25, bed: 0.5, bookshelf: 0.55, chalkboard: 0.5 };

/** Approximate top height per model (for the debug notes / tests). */
export const PROP_HEIGHT = { tree: 1.85, pine: 1.9, house: 2.3, shop: 2.3, tower: 3.0, academy: 3.6, gate_arch: 2.0, lamp: 1.7, banner: 1.8 };

/**
 * Build one zone prop into the kit. p: {kind, def, look, x, y, w, h}. Returns emitters in world coords.
 */
export function buildProp(k, p, unknown) {
  const model = (p.def && p.def.model) || p.kind;
  let fn = BUILDERS[model];
  if (!fn) { unknown.add('prop:' + model); fn = BUILDERS.crate; }
  const footless = !(p.def && p.def.footprint);
  const w = p.w || 1, h = p.h || 1;
  const cx = footless ? p.x + 0.5 : p.x + w / 2;
  const cz = footless ? p.y + 0.5 : p.y + h / 2;
  const rnd = propRng(Math.floor(p.x * 7), Math.floor(p.y * 13));
  k.push();
  k.tf(cx, 0, cz);
  const em = fn(k, p.look || {}, w, h, rnd) || [];
  k.pop();
  const sh = SHADOW[model];
  if (sh) em.push({ type: 'shadow', x: 0, y: 0, h: 0, r: sh * Math.max(1, Math.min(w, h) * 0.8), color: '#000000' });
  for (const e of em) { e.x += cx; e.y += cz; }
  return em;
}
