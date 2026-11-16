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
  // one detailed main blob, cheaper round side blobs (trees are the most common prop)
  blobs.forEach(([x, y, z, r], i) => k.color(i === 3 ? mix(leaves, '#b8e878', 0.25) : i % 2 ? mul(leaves, 0.9) : leaves).add(i ? T.sphere(6, 4) : T.ico(1), [x * sc, y * sc, z * sc], r * sc, [rnd(), rnd(), 0]));
  k.lineless = true;
  if (rnd() < 0.35) for (let i = 0; i < 3; i++) k.color('#ff6b6b').add(T.sphere(4, 3), [(rnd() - 0.5) * 0.7, (1.0 + rnd() * 0.5) * sc, 0.32], 0.05);
  k.lineless = false;
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
  k.color(mul(leaves, 0.9)).add(T.sphere(6, 4), [0.22, 0.24, 0.1], 0.24).add(T.sphere(6, 4), [-0.24, 0.22, 0.05], 0.25);
  k.lineless = true;
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    k.color(berry).add(T.sphere(4, 3), [Math.cos(a) * 0.3, 0.2 + rnd() * 0.3, Math.abs(Math.sin(a)) * 0.3 + 0.05], 0.045);
  }
  k.lineless = false;
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
  k.color(mul(soil, 1.1)).add(T.box(), [0, 0.06, 0], [0.9, 0.12, 0.9]);
  k.color(mul(soil, 0.75)).add(T.box(), [0, 0.12, 0], [0.78, 0.02, 0.78]);
  // flower heads are lineless low-poly blobs (flowerbeds are everywhere: keep them cheap)
  k.lineless = true;
  k.color('#4f9e3a').add(T.ico(0), [0, 0.17, 0], [0.34, 0.06, 0.34]);
  for (let i = 0; i < 9; i++) {
    const x = ((i % 3) - 1) * 0.25 + (rnd() - 0.5) * 0.08, z = (Math.floor(i / 3) - 1) * 0.25 + (rnd() - 0.5) * 0.08;
    k.color(i % 2 ? p1 : p2).add(T.sphere(5, 3), [x, 0.25, z], [0.075, 0.045, 0.075]);
  }
  k.lineless = false;
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
  for (let i = 0; i < 3; i++) k.color(i % 2 ? mul(wood, 0.92) : wood).add(T.box(), [0, 0.3, 0.14 - i * 0.11], [W, 0.06, 0.1]);
  for (let i = 0; i < 2; i++) k.color(wood).add(T.box(), [0, 0.48 + i * 0.13, -0.15], [W, 0.1, 0.05]);
}

function well(k, L, w) {
  const stone = c(L, 'stone', '#b9bccb'), roof = c(L, 'roof', '#c8503c'), water = c(L, 'water', '#3fa9e8');
  const R = w * 0.38;
  k.color(stone).add(T.cyl(1, 1, 14, false), [0, 0.28, 0], [R, 0.56, R]);
  k.color(lighten(stone, 0.15)).add(T.torus(0.18, 5, 16), [0, 0.57, 0], [R * 0.93, R * 0.93, R * 0.93], [Math.PI / 2, 0, 0]);
  k.color(water, 0.25).add(T.cyl(1, 1, 14), [0, 0.45, 0], [R * 0.82, 0.02, R * 0.82]);
  for (const s of [-1, 1]) k.color('#8a5a33').add(T.box(), [s * R * 0.9, 0.95, 0], [0.08, 0.85, 0.08]);
  k.color('#8a5a33').add(T.cyl(1, 1, 6), [0, 1.18, 0], [0.04, R * 1.8, 0.04], [0, 0, Math.PI / 2]);
  gableRoof(k, 0, 1.22, 0, R * 1.9, R * 1.2, 0.42, roof, C('#8a5a33'), mul(roof, 0.75), false);
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
  const ll = k.lineless;
  k.lineless = true;
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
  k.lineless = ll;
}

function windowAt(k, x, y, z, w, h, trim, shutter) {
  const ll = k.lineless;
  k.lineless = true;   // small details: no outline (cheaper, cleaner)
  k.color(trim).add(T.box(), [x, y, z], [w + 0.08, h + 0.08, 0.06]);
  k.color('#bfe6ff', 0.25).add(T.box(), [x, y, z + 0.02], [w, h, 0.04]);
  k.color('#fff6c8', 0.7).add(T.box(), [x - w * 0.22, y + h * 0.18, z + 0.045], [w * 0.22, h * 0.25, 0.005]);
  k.color(trim).add(T.box(), [x, y, z + 0.035], [0.035, h, 0.03]).add(T.box(), [x, y, z + 0.035], [w, 0.035, 0.03]);
  k.color(mul(trim, 0.9)).add(T.box(), [x, y - h / 2 - 0.06, z + 0.04], [w + 0.16, 0.05, 0.1]);
  if (shutter) {
    k.color(shutter).add(T.box(), [x - w / 2 - 0.09, y, z], [0.1, h + 0.04, 0.04]).add(T.box(), [x + w / 2 + 0.09, y, z], [0.1, h + 0.04, 0.04]);
  }
  k.lineless = ll;
}

function doorAt(k, x, z, w, h, door, trim) {
  const ll = k.lineless;
  k.lineless = true;
  k.color(trim).add(T.box(), [x, h / 2 + 0.12, z], [w + 0.12, h + 0.08, 0.06]);
  k.color(door).add(T.box(), [x, h / 2 + 0.11, z + 0.03], [w, h, 0.05]);
  k.color(trim).add(T.dome(10, 3), [x, h + 0.13, z + 0.02], [w / 2 + 0.06, 0.14, 0.04], [Math.PI / 2, 0, 0]);
  k.color(mul(door, 0.85)).add(T.box(), [x, h / 2 + 0.11, z + 0.06], [0.03, h * 0.9, 0.01]);
  k.color('#ffd24a').add(T.sphere(5, 4), [x + w * 0.3, h * 0.5 + 0.1, z + 0.075], 0.03);
  k.color(mul('#b9bccb', 1)).add(T.box(), [x, 0.06, z + 0.16], [w + 0.2, 0.12, 0.28]);
  k.lineless = ll;
}

/** Front-gabled roof: two slabs meeting at a north-south ridge, wall-colored gable triangles front and back. */
function gableRoof(k, x, y, z, W, D, RH, roofC, wallC, trimC, attic) {
  const half = W / 2 + 0.18;
  const ang = Math.atan2(RH, half);
  const L = Math.hypot(half, RH) + 0.06;
  for (const s of [-1, 1]) {
    k.push().tf(x + s * half / 2, y + RH / 2, z, 0, 0, -s * ang);
    k.color(roofC).add(T.box(), [0, 0.05, 0], [L, 0.1, D + 0.4]);
    const ll = k.lineless;
    k.lineless = true;
    for (let i = 1; i <= 2; i++) k.color(mul(roofC, 0.86)).add(T.box(), [s * (L / 2 - i * L / 3), 0.105, 0], [0.04, 0.02, D + 0.41]);
    k.lineless = ll;
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
  const R = Math.min(w, d) * 0.38, H = 1.7;
  k.color('#a3a7b8').add(T.cyl(1, 1, 14), [0, 0.08, 0], [R + 0.1, 0.16, R + 0.1]);
  k.color(wall).add(T.cyl(0.92, 1, 14), [0, 0.16 + H / 2, 0], [R, H, R]);
  for (const y of [0.7, 1.35]) k.color(trim).add(T.torus(0.06, 4, 18), [0, y, 0], [R * 0.97, R * 0.97, R * 0.9], [Math.PI / 2, 0, 0]);
  k.color(trim).add(T.cyl(1, 1, 14), [0, 0.16 + H, 0], [R + 0.08, 0.1, R + 0.08]);
  k.color(roof).add(T.cone(14), [0, 0.16 + H + 0.75, 0], [R + 0.2, 1.5, R + 0.2]);
  k.color(mul(roof, 0.8)).add(T.cyl(1, 1, 14), [0, 0.16 + H + 0.03, 0], [R + 0.22, 0.06, R + 0.22]);
  k.color(trim).add(T.sphere(6, 5), [0, 0.16 + H + 1.52, 0], 0.07);
  k.color('#8a5a33').add(T.cyl(1, 1, 4), [0, 0.16 + H + 1.7, 0], [0.015, 0.35, 0.015]);
  k.color(trim).add(T.box(), [0.12, 0.16 + H + 1.8, 0], [0.22, 0.13, 0.01]);
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
    if (L.umbrella) umbrella(k, 0.06, -0.04, 1.45, 0.62, C(L.umbrella), C(L.umbrella2 || '#ffffff'));
  }
}

function chair(k, L) {
  const wood = c(L, 'wood', '#b0743d');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.color(mul(wood, 0.85)).add(T.box(), [sx * 0.15, 0.15, sz * 0.15], [0.05, 0.3, 0.05]);
  k.color(wood).add(T.box(), [0, 0.32, 0], [0.38, 0.05, 0.38]);
  k.color(wood).add(T.box(), [0, 0.56, -0.17], [0.38, 0.4, 0.05]);
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

// ---------------- building styles (round 2: `look.style` on house / shop / tower / bridge / table props) ----------------
// Each style builder gets (k, L, w, d, rnd, dx) with dx = the door's x offset from the footprint center (from the def's
// `door` column) and returns emitters. Doors stay on the south face; tops stay <= ~3.2.

export const STYLES = ['cottage', 'townhouse', 'tower_house', 'mushroom', 'windmill', 'greenhouse', 'bakery', 'library', 'potion',
  'outfitter', 'cafe', 'general', 'guardhouse', 'clock', 'arch'];
const STONE = '#b9bccb';
const smoke = (x, z, h, color) => ({ type: 'chimney', x, y: z, h, color: color || '#e8e4f0' });

function plinth(k, W, D, c0) { k.color(c0 || STONE).add(T.box(), [0, 0.07, 0], [W + 0.16, 0.14, D + 0.16]); }
function flowerBox(k, x, y, z, w, trim) {
  k.lineless = true;
  k.color(trim).add(T.box(), [x, y, z], [w, 0.1, 0.12]);
  const n = Math.max(2, Math.round(w / 0.12));
  for (let i = 0; i < n; i++) k.color(i % 2 ? '#ff8fc7' : '#ffe066').add(T.sphere(4, 3), [x - w / 2 + 0.06 + i * (w - 0.12) / (n - 1), y + 0.08, z + 0.01], 0.055);
  k.lineless = false;
}
/** Round window facing +z. */
function roundWindow(k, x, y, z, r, trim) {
  const ll = k.lineless;
  k.lineless = true;
  k.color(trim).add(T.cyl(1, 1, 12), [x, y, z], [r + 0.05, 0.05, r + 0.05], [Math.PI / 2, 0, 0]);
  k.color('#bfe6ff', 0.25).add(T.cyl(1, 1, 12), [x, y, z + 0.025], [r, 0.03, r], [Math.PI / 2, 0, 0]);
  k.lineless = true;
  k.color('#fff6c8', 0.7).add(T.sphere(5, 4), [x - r * 0.35, y + r * 0.35, z + 0.045], [r * 0.25, r * 0.25, 0.01]);
  k.color(trim).add(T.box(), [x, y, z + 0.04], [r * 2, 0.03, 0.01]).add(T.box(), [x, y, z + 0.04], [0.03, r * 2, 0.01]);
  k.lineless = ll;
}
/** Striped awning along x centered at (x, y, z), sloping toward +z. */
function awning(k, x, y, z, w, depth, c1, c2, n) {
  n = n || Math.max(4, Math.round(w / 0.28));
  k.color(c1).add(T.box(), [x, y, z], [w, 0.035, depth], [0.45, 0, 0]);
  const ll = k.lineless;
  k.lineless = true;
  for (let i = 1; i < n; i += 2) {
    const xx = x - w / 2 + (w / n) * (i + 0.5);
    k.color(c2).add(T.box(), [xx, y + 0.02, z], [w / n + 0.002, 0.012, depth + 0.004], [0.45, 0, 0]);
  }
  for (let i = 0; i < n; i++) {
    const xx = x - w / 2 + (w / n) * (i + 0.5);
    k.color(i % 2 ? c2 : c1).add(T.box(), [xx, y - Math.sin(0.45) * depth / 2 - 0.06, z + Math.cos(0.45) * depth / 2], [w / n, 0.12, 0.02]);
  }
  k.lineless = ll;
}
/** Umbrella: alternating colored segments (triangles) around a pole. */
function umbrella(k, x, z, y, r, c1, c2) {
  k.color('#8a8a96').add(T.cyl(1, 1, 5), [x, y / 2, z], [0.025, y, 0.025]);
  const n = 8, h = r * 0.42;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
    const top = [x, y + h, z];
    k.color(i % 2 ? c2 : c1);
    k.quad(p1, p0, top, top);
    k.quad(p0, p1, [p1[0], y - 0.08, p1[2]], [p0[0], y - 0.08, p0[2]]);
  }
  k.color(c1).add(T.sphere(5, 4), [x, y + h + 0.03, z], 0.04);
}
/** Crates, barrels and sacks heap (deterministic). */
function goodsHeap(k, x, z, rnd, n) {
  for (let i = 0; i < n; i++) {
    const t = i % 3, ox = x + (i % 3 - 1) * 0.32 + (rnd() - 0.5) * 0.06, oz = z + Math.floor(i / 3) * 0.3;
    if (t === 0) {
      k.color('#d6a060').add(T.box(), [ox, 0.17, oz], [0.32, 0.32, 0.32], [0, rnd() * 0.4, 0]);
      k.color('#9a6a3a').add(T.box(), [ox, 0.17, oz + 0.165], [0.33, 0.04, 0.02]);
    } else if (t === 1) {
      k.color('#b0743d').add(barrelT(), [ox, 0, oz], [0.34, 0.4, 0.34]);
      k.color('#5a5a66').add(T.torus(0.08, 4, 12), [ox, 0.3, oz], [0.165, 0.165, 0.165], [Math.PI / 2, 0, 0]);
    } else {
      k.color('#e8d6a8').add(T.sphere(7, 5), [ox, 0.15, oz], [0.17, 0.17, 0.15]);
      k.color('#c8b07a').add(T.cyl(1, 0.6, 6), [ox, 0.3, oz], [0.06, 0.06, 0.06]);
    }
  }
}

function sCottage(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#fff1d6'), roof = c(L, 'roof', '#e2b45c'), trim = c(L, 'trim', '#8a5a33'), door = c(L, 'door', '#4f8a4a');
  const W = w * 0.78, D = d * 0.62, H = 1.0, y0 = 0.14, zf = D / 2;
  plinth(k, W, D, '#c9c2b0');
  k.color(wall).add(T.rbox(0.18), [0, y0 + H / 2, 0], [W, H, D]);
  // thick rounded thatch: a squashed dome over a rounded slab, with eaves bands
  k.color(roof).add(T.rbox(0.55, 10, 6), [0, y0 + H + 0.18, 0], [W + 0.55, 0.62, D + 0.6]);
  k.color(roof).add(T.dome(12, 5), [0, y0 + H + 0.32, 0], [W * 0.62, 0.95, D * 0.72]);
  k.color(mul(roof, 0.82)).add(T.torus(0.09, 4, 14), [0, y0 + H + 0.02, 0], [W * 0.66, D * 0.68, 1], [Math.PI / 2, 0, 0]);
  k.color(lighten(roof, 0.18)).add(T.capsule(1.2, 7), [0, y0 + H + 1.22, 0], [0.16, 0.16, D * 0.6], [Math.PI / 2, 0, 0]);
  k.lineless = true;
  for (let i = 0; i < 5; i++) k.color(mul(roof, 0.86)).add(T.box(), [-W * 0.4 + i * W * 0.2, y0 + H + 0.35 + (i % 2) * 0.12, zf + 0.33], [0.12, 0.02, 0.02], [0, 0, (rnd() - 0.5) * 0.4]);
  k.lineless = false;
  // eyebrow dormer with a round window
  k.color(roof).add(T.dome(10, 4), [W * 0.18, y0 + H + 0.62, zf + 0.12], [0.34, 0.3, 0.3]);
  roundWindow(k, W * 0.18, y0 + H + 0.72, zf + 0.35, 0.11, trim);
  // stone chimney
  k.color('#a8a49a').add(T.rbox(0.3), [-W * 0.32, y0 + H + 0.9, -0.15], [0.3, 0.9, 0.3]);
  k.color('#8a8478').add(T.box(), [-W * 0.32, y0 + H + 1.36, -0.15], [0.36, 0.06, 0.36]);
  doorAt(k, dx, zf, 0.46, 0.74, door, trim);
  const wx = dx > 0 ? -W * 0.28 : W * 0.28;
  windowAt(k, wx, 0.72, zf + 0.02, 0.36, 0.36, trim, mix(door, '#ffffff', 0.1));
  flowerBox(k, wx, 0.47, zf + 0.09, 0.46, trim);
  // climbing roses (variant 1) or a lavender bush
  if ((L.variant | 0) === 1) {
    k.color('#4f9e3a').add(T.ico(1), [-W * 0.5 + 0.05, y0 + 0.5, zf], [0.12, 0.5, 0.1]);
    k.lineless = true;
    for (let i = 0; i < 6; i++) k.color(i % 2 ? '#ff6b8a' : '#ffb3d1').add(T.sphere(5, 4), [-W * 0.5 + 0.08 + (rnd() - 0.5) * 0.12, y0 + 0.2 + i * 0.14, zf + 0.08], 0.05);
    k.lineless = false;
  } else {
    k.color('#7a5ad9').add(T.ico(1), [W * 0.5, 0.2, zf + 0.15], [0.2, 0.2, 0.18]);
  }
  return [smoke(-W * 0.32, -0.15, y0 + H + 1.4)];
}

function sTownhouse(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#fff6e6'), roof = c(L, 'roof', '#4a6fb5'), trim = c(L, 'trim', '#6b4423'), door = c(L, 'door', '#2f5a8a');
  const W = w * 0.74, D = d * 0.6, y0 = 0.14, H1 = 0.95, H2 = 0.85, zf = D / 2;
  plinth(k, W, D);
  // ground floor (stone-ish) and the jettied upper floor
  k.color(mix(wall, '#d8d0c0', 0.35)).add(T.box(), [0, y0 + H1 / 2, 0], [W, H1, D]);
  const W2 = W + 0.2, D2 = D + 0.12, z2 = 0.06, ya = y0 + H1;
  k.color(trim).add(T.box(), [0, ya + 0.04, z2], [W2 + 0.04, 0.09, D2 + 0.04]);
  k.color(wall).add(T.box(), [0, ya + 0.08 + H2 / 2, z2], [W2, H2, D2]);
  const zf2 = z2 + D2 / 2;
  // timber frame on the upper floor: posts, mid rail, braces
  for (let i = 0; i <= 4; i++) k.color(trim).add(T.box(), [-W2 / 2 + i * W2 / 4, ya + 0.08 + H2 / 2, zf2 + 0.01], [0.08, H2, 0.04]);
  k.color(trim).add(T.box(), [0, ya + 0.08 + H2 - 0.04, zf2 + 0.01], [W2, 0.08, 0.04]);
  for (const s of [-1, 1]) k.color(trim).add(T.box(), [s * W2 * 0.375, ya + 0.08 + H2 * 0.32, zf2 + 0.015], [0.06, H2 * 0.62, 0.03], [0, 0, s * 0.62]);
  for (const s of [-1, 1]) k.color(trim).add(T.box(), [s * (W2 / 2), ya + 0.08 + H2 / 2, z2], [0.08, H2, D2]);
  // steep front gable roof with a dormer and chimney
  const yr = ya + 0.08 + H2;
  gableRoof(k, 0, yr, z2, W2, D2, 0.95, roof, wall, trim, true);
  k.color('#c87a5a').add(T.box(), [W2 * 0.3, yr + 0.55, -0.2], [0.24, 0.75, 0.24]);
  k.color('#8a5a4a').add(T.box(), [W2 * 0.3, yr + 0.94, -0.2], [0.3, 0.07, 0.3]);
  // windows: two up, one down beside the door
  windowAt(k, -W2 * 0.25, ya + 0.5, zf2 + 0.02, 0.32, 0.4, trim, null);
  windowAt(k, W2 * 0.25, ya + 0.5, zf2 + 0.02, 0.32, 0.4, trim, null);
  flowerBox(k, -W2 * 0.25, ya + 0.24, zf2 + 0.09, 0.42, trim);
  flowerBox(k, W2 * 0.25, ya + 0.24, zf2 + 0.09, 0.42, trim);
  doorAt(k, dx, zf, 0.44, 0.74, door, trim);
  const wx = dx < 0 ? W * 0.22 : -W * 0.22;
  windowAt(k, wx, 0.62, zf + 0.02, 0.5, 0.38, trim, null);
  // a lantern bracket by the door
  k.color('#3a3a4a').add(T.box(), [dx + 0.36, 0.95, zf + 0.08], [0.04, 0.04, 0.14]);
  k.color('#ffe680', 0.9).add(T.cyl(0.8, 1, 6), [dx + 0.36, 0.86, zf + 0.15], [0.05, 0.12, 0.05]);
  return [smoke(W2 * 0.3, -0.2, yr + 1.0)];
}

function sTowerHouse(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#ebe6f6'), roof = c(L, 'roof', '#7a5ad9'), trim = c(L, 'trim', '#ffd24a'), door = c(L, 'door', '#5a3a8a');
  const R = Math.min(w, d) * 0.36, H = 1.85, y0 = 0.16;
  k.color('#a3a7b8').add(T.cyl(1, 1, 10), [0, 0.08, 0], [R + 0.12, 0.16, R + 0.12]);
  k.color(mix(wall, '#c8c4b8', 0.3)).add(T.cyl(1, 1, 10), [0, y0 + 0.25, 0], [R + 0.04, 0.5, R + 0.04]);
  k.color(wall).add(T.cyl(0.95, 1, 10), [0, y0 + 0.5 + (H - 0.5) / 2, 0], [R, H - 0.5, R]);
  // wooden balcony ring and a bay of the upper floor
  k.color(trim).add(T.torus(0.07, 4, 14), [0, y0 + 1.2, 0], [R + 0.08, R + 0.08, 1], [Math.PI / 2, 0, 0]);
  k.color(mul(trim, 0.85)).add(T.cyl(1, 1, 10), [0, y0 + 1.17, 0], [R + 0.12, 0.05, R + 0.12]);
  k.color(trim).add(T.cyl(1, 1, 10), [0, y0 + H, 0], [R + 0.1, 0.1, R + 0.1]);
  // tall witchy cone roof with a slight bend and a pennant
  const yr = y0 + H + 0.05;
  k.color(roof).add(T.cyl(1, 0.62, 10), [0, yr + 0.22, 0], [R + 0.26, 0.44, R + 0.26]);
  k.color(roof).add(T.cone(14), [0.04, yr + 0.44 + 0.38, 0], [(R + 0.26) * 0.62, 0.76, (R + 0.26) * 0.62], [0, 0, -0.08]);
  k.color(mul(roof, 0.75)).add(T.cyl(1, 1, 10), [0, yr + 0.03, 0], [R + 0.28, 0.06, R + 0.28]);
  k.color(trim).add(T.sphere(6, 5), [0.1, yr + 1.22, 0], 0.06);
  k.color('#8a5a33').add(T.cyl(1, 1, 4), [0.1, yr + 1.38, 0], [0.015, 0.3, 0.015]);
  k.color((L.variant | 0) === 1 ? '#ffd24a' : '#ff6b8a').add(T.box(), [0.22, yr + 1.46, 0], [0.22, 0.12, 0.01]);
  doorAt(k, dx * 0.5, R * 0.92, 0.42, 0.7, door, trim);
  for (const [a, y] of [[0.8, 0.85], [-0.8, 1.55], [0.25, 1.55]]) {
    k.push().tf(Math.sin(a) * R * 0.94, 0, Math.cos(a) * R * 0.94, 0, a, 0);
    windowAt(k, 0, y, 0, 0.24, 0.32, trim, null);
    k.pop();
  }
  // small round annex (a pantry) on the east
  k.color(wall).add(T.cyl(1, 1, 10), [R * 0.95, y0 + 0.4, R * 0.2], [0.42, 0.8, 0.42]);
  k.color(roof).add(T.cone(10), [R * 0.95, y0 + 1.0, R * 0.2], [0.5, 0.42, 0.5]);
  return [];
}

function sMushroom(k, L, w, d, rnd, dx) {
  const stem = c(L, 'wall', '#fff3e0'), cap = c(L, 'roof', '#e8503c'), spots = c(L, 'trim', '#ffffff'), door = c(L, 'door', '#8a5a33');
  const R = Math.min(w, d) * 0.3, H = 1.15, y0 = 0.02;
  // bulging stem house
  k.color(stem).add(T.lathe('mushstem', [[0, 0], [0.92, 0], [1.0, 0.25], [0.98, 0.6], [0.86, 1], [0, 1]], 14), [0, y0, 0], [R, H, R]);
  // cap: wide dome with a gill rim
  const capR = Math.min(w, d) * 0.5, yc = y0 + H - 0.05;
  k.color(mix(stem, '#c8a878', 0.4)).add(T.cyl(1, 0.55, 10), [0, yc + 0.02, 0], [capR * 0.98, 0.12, capR * 0.98]);
  k.color(cap).add(T.dome(12, 5), [0, yc + 0.06, 0], [capR, 1.15, capR]);
  const sp = [[0, 1.12, 0.1, 0.2], [0.55, 0.85, 0.5, 0.15], [-0.6, 0.8, 0.45, 0.17], [0.7, 0.6, -0.4, 0.13], [-0.4, 0.95, -0.5, 0.14],
    [0.1, 0.62, 0.95, 0.13], [-0.95, 0.45, 0.1, 0.12], [0.95, 0.45, 0.25, 0.11]];
  for (const [x, y, z, r] of sp) {
    const n = Math.hypot(x, (y - 0.06) / 1.15, z) || 1;
    k.color(spots).add(T.sphere(7, 4), [x / n * capR * 0.98, yc + 0.06 + (y - 0.06) / n * 1.15 * 0.98, z / n * capR * 0.98], [r, r * 0.45, r]);
  }
  // round door with a stone step, round windows
  const zf = R * 0.98;
  k.color(mul(stem, 0.85)).add(T.cyl(1, 1, 10), [dx * 0.4, 0.45, zf - 0.02], [0.3, 0.05, 0.36], [Math.PI / 2, 0, 0]);
  k.color(door).add(T.cyl(1, 1, 10), [dx * 0.4, 0.45, zf + 0.01], [0.24, 0.05, 0.31], [Math.PI / 2, 0, 0]);
  k.color(door).add(T.box(), [dx * 0.4, 0.2, zf + 0.01], [0.48, 0.4, 0.05]);
  k.color('#ffd24a').add(T.sphere(5, 4), [dx * 0.4 + 0.12, 0.42, zf + 0.06], 0.03);
  k.color(STONE).add(T.rbox(0.3), [dx * 0.4, 0.04, zf + 0.22], [0.6, 0.08, 0.3]);
  k.push().tf(0, 0, 0, 0, 0.75, 0); roundWindow(k, 0, 0.78, R * 0.97, 0.13, mul(door, 1.2)); k.pop();
  k.push().tf(0, 0, 0, 0, -0.85, 0); roundWindow(k, 0, 0.7, R * 0.97, 0.11, mul(door, 1.2)); k.pop();
  // stovepipe through the cap and baby mushrooms at the foot
  k.color('#6a6a78').add(T.cyl(1, 1, 8), [-capR * 0.42, yc + 0.95, -0.2], [0.08, 0.55, 0.08]);
  k.color('#5a5a66').add(T.cone(8), [-capR * 0.42, yc + 1.28, -0.2], [0.14, 0.12, 0.14]);
  for (const [x, z, s] of [[capR * 0.75, 0.6, 0.22], [capR * 0.92, 0.25, 0.16], [-capR * 0.8, 0.55, 0.18]]) {
    k.color(stem).add(T.cyl(0.8, 1, 6), [x, s * 0.5, z], [s * 0.3, s, s * 0.3]);
    k.color(cap).add(T.dome(8, 3), [x, s, z], [s * 0.75, s * 0.6, s * 0.75]);
  }
  return [smoke(-capR * 0.42, -0.2, yc + 1.3, '#f0eaf8')];
}

function sWindmill(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#f4ecd8'), roof = c(L, 'roof', '#9a6a43'), sail = c(L, 'trim', '#fffaf0'), door = c(L, 'door', '#6b4423');
  const R0 = Math.min(w, d) * 0.36, R1 = R0 * 0.68, H = 2.0, y0 = 0.14;
  k.color('#a3a7b8').add(T.cyl(1, 1, 12), [0, 0.07, 0], [R0 + 0.12, 0.14, R0 + 0.12]);
  k.color(wall).add(T.cyl(R1 / R0, 1, 12), [0, y0 + H / 2, 0], [R0, H, R0]);
  for (const y of [0.75, 1.45]) k.color(mul(wall, 0.85)).add(T.cyl(1, 1, 12), [0, y0 + y, 0], [R0 - (R0 - R1) * (y / H) + 0.03, 0.06, R0 - (R0 - R1) * (y / H) + 0.03]);
  // cap
  const yc = y0 + H;
  k.color(roof).add(T.dome(12, 5), [0, yc - 0.02, -0.05], [R1 + 0.16, 0.62, R1 + 0.22]);
  k.color(mul(roof, 0.8)).add(T.cyl(1, 1, 12), [0, yc, -0.05], [R1 + 0.18, 0.08, R1 + 0.24]);
  // hub and four sails on the south face, set at an angle
  const hy = yc + 0.12, hz = R1 + 0.3;
  k.color('#6b4423').add(T.cyl(1, 1, 8), [0, hy, hz - 0.2], [0.07, 0.5, 0.07], [Math.PI / 2, 0, 0]);
  k.color('#5a3a22').add(T.sphere(8, 6), [0, hy, hz + 0.05], 0.12);
  const len = 1.05;
  for (let i = 0; i < 4; i++) {
    const a = 0.35 + i * Math.PI / 2;
    k.push().tf(0, hy, hz, 0, 0, a);
    k.color('#7a4e2c').add(T.box(), [0, len / 2 + 0.05, 0], [0.06, len, 0.05]);
    k.color(sail).add(T.box(), [0.13, len * 0.58 + 0.05, 0.01], [0.2, len * 0.78, 0.02]);
    k.lineless = true;
    for (let j = 1; j < 4; j++) k.color('#c8b89a').add(T.box(), [0.13, 0.05 + len * 0.2 + j * len * 0.19, 0.025], [0.2, 0.02, 0.005]);
    k.lineless = false;
    k.pop();
  }
  doorAt(k, dx * 0.4, R0 * 0.95, 0.4, 0.66, door, '#7a4e2c');
  windowAt(k, 0.05, 1.45, R1 + 0.12, 0.2, 0.26, '#7a4e2c', null);
  // sacks of flour by the door
  k.color('#efe4c8').add(T.sphere(7, 5), [R0 * 0.85, 0.16, R0 * 0.75], [0.17, 0.17, 0.15]).add(T.sphere(7, 5), [R0 * 0.62, 0.14, R0 * 0.98], [0.15, 0.14, 0.13]);
  return [];
}

function sGreenhouse(k, L, w, d, rnd, dx) {
  const frame = c(L, 'wall', '#ffffff'), glass = c(L, 'roof', '#bfeaf2'), trim = c(L, 'trim', '#3f9e4a'), door = c(L, 'door', '#4f9e5a');
  const W = w * 0.86, D = d * 0.7, H = 0.95, y0 = 0.3, zf = D / 2;
  k.color('#c87a5a').add(T.box(), [0, y0 / 2, 0], [W + 0.06, y0, D + 0.06]);
  k.color('#a8634a').add(T.box(), [0, y0, 0], [W + 0.12, 0.05, D + 0.12]);
  // glass box: tinted panes, white mullions
  k.color(glass, 0.35).add(T.box(), [0, y0 + H / 2, 0], [W, H, D]);
  const nx = Math.round(W / 0.42);
  for (let i = 0; i <= nx; i++) {
    const x = -W / 2 + i * W / nx;
    k.color(frame).add(T.box(), [x, y0 + H / 2, zf + 0.01], [0.05, H, 0.04]);
    k.color(frame).add(T.box(), [x, y0 + H / 2, -zf - 0.01], [0.05, H, 0.04]);
  }
  for (const s of [-1, 1]) k.color(frame).add(T.box(), [s * W / 2, y0 + H / 2, 0], [0.05, H, D]);
  k.color(frame).add(T.box(), [0, y0 + H * 0.5, zf + 0.01], [W, 0.04, 0.04]);
  k.color(frame).add(T.box(), [0, y0 + H, 0], [W + 0.04, 0.06, D + 0.04]);
  // barrel-vaulted glass roof with ribs (half cylinder along x)
  const yr = y0 + H;
  k.color(lighten(glass, 0.15), 0.4).add(T.cyl(1, 1, 12, false), [0, yr, 0], [D / 2, W, D * 0.42], [0, 0, Math.PI / 2]);
  for (let i = 0; i <= nx; i++) k.color(frame).add(T.torus(0.04, 3, 12, Math.PI), [-W / 2 + i * W / nx, yr, 0], [D / 2 + 0.02, D * 0.42 + 0.02, 1], [0, Math.PI / 2, 0]);
  k.color(frame).add(T.box(), [0, yr + D * 0.42, 0], [W + 0.06, 0.06, 0.06]);
  // plants pressing against the glass and potted plants at the front
  k.lineless = true;
  for (let i = 0; i < nx * 2; i++) {
    const x = -W / 2 + 0.2 + i * (W - 0.4) / (nx * 2 - 1);
    k.color(i % 3 ? '#4cbf55' : '#7cd96a', 0.15).add(T.ico(0), [x, y0 + 0.3 + (i % 2) * 0.25, zf - 0.12], [0.2, 0.26 + (i % 3) * 0.06, 0.12]);
    if (i % 3 === 1) k.color(i % 2 ? '#ff8fc7' : '#ffe066', 0.2).add(T.sphere(5, 4), [x + 0.05, y0 + 0.62, zf - 0.02], 0.05);
  }
  k.lineless = false;
  doorAt(k, dx, zf + 0.02, 0.42, 0.72, door, frame);
  for (const s of [-1, 1]) {
    const x = dx + s * 0.55;
    k.color('#c87a5a').add(T.cyl(0.75, 1, 8), [x, 0.12, zf + 0.25], [0.14, 0.24, 0.14]);
    k.color(trim).add(T.ico(1), [x, 0.34, zf + 0.25], [0.16, 0.18, 0.16]);
  }
  return [];
}

function sBakery(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#fff6e0'), roof = c(L, 'roof', '#c8503c'), trim = c(L, 'trim', '#8a5a33'), door = c(L, 'door', '#7a4e2c');
  const W = w * 0.78, D = d * 0.6, H = 1.4, y0 = 0.14, zf = D / 2, zc = -0.15;
  plinth(k, W, D);
  k.color(wall).add(T.box(), [0, y0 + H / 2, zc], [W, H, D]);
  for (const s of [-1, 1]) k.color(trim).add(T.box(), [s * W / 2, y0 + H / 2, zc + D / 2], [0.1, H, 0.1]);
  k.color(trim).add(T.box(), [0, y0 + H - 0.03, zc + D / 2 + 0.01], [W + 0.04, 0.1, 0.1]);
  gableRoof(k, 0, y0 + H, zc, W, D, 0.75, roof, wall, trim, true);
  const zw = zc + D / 2;
  // round brick oven bulging from the west wall with a tall round chimney
  const ox = -W / 2 - 0.05;
  k.color('#c06e4c').add(T.dome(12, 5), [ox, y0, zc + 0.05], [0.55, 0.8, 0.6]);
  k.color('#a65a3e').add(T.cyl(1, 1, 12), [ox, y0 + 0.02, zc + 0.05], [0.58, 0.06, 0.62]);
  k.color('#2a1a14').add(T.cyl(1, 1, 10), [ox - 0.02, y0 + 0.28, zc + 0.6], [0.16, 0.05, 0.14], [Math.PI / 2, 0, 0]);
  k.color('#ff9a3c', 0.9).add(T.cyl(1, 1, 10), [ox - 0.02, y0 + 0.24, zc + 0.62], [0.1, 0.02, 0.08], [Math.PI / 2, 0, 0]);
  k.color('#c06e4c').add(T.cyl(0.85, 1, 12), [ox + 0.1, y0 + 1.4, zc - 0.15], [0.2, 2.1, 0.2]);
  for (const y of [0.9, 1.6, 2.35]) k.color('#a65a3e').add(T.torus(0.15, 4, 12), [ox + 0.1, y0 + y, zc - 0.15], [0.2, 0.2, 0.2], [Math.PI / 2, 0, 0]);
  // striped awning over a bread window
  const wx = dx < 0 ? W * 0.18 : -W * 0.18;
  windowAt(k, wx, 0.82, zw + 0.02, 0.9, 0.55, trim, null);
  k.lineless = true;
  for (let i = 0; i < 4; i++) k.color(i % 2 ? '#e8a050' : '#d48a3a').add(T.capsule(1.2, 6), [wx - 0.3 + i * 0.2, 0.66, zw + 0.08], [0.07, 0.07, 0.07], [0, 0, Math.PI / 2]);
  k.lineless = false;
  awning(k, 0, 1.35, zw + 0.24, W * 0.95, 0.5, roof, '#ffffff');
  doorAt(k, dx, zw, 0.46, 0.78, door, trim);
  // a bench of loaves and a flour barrel out front
  k.color('#c98c50').add(T.box(), [wx, 0.3, zw + 0.45], [0.7, 0.05, 0.26]);
  for (const s of [-1, 1]) k.color(mul('#c98c50', 0.8)).add(T.box(), [wx + s * 0.3, 0.15, zw + 0.45], [0.05, 0.3, 0.22]);
  for (let i = 0; i < 3; i++) k.color('#e8a050').add(T.sphere(7, 5), [wx - 0.2 + i * 0.2, 0.38, zw + 0.45], [0.09, 0.07, 0.08]);
  if (L.sign && L.sign !== 'none') signIcon(k, L.sign, dx + 0.34, 1.12, zw + 0.42);
  return [smoke(ox + 0.1, zc - 0.15, y0 + 2.5, '#f4f0f8')];
}

function sLibrary(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#ece6f6'), roof = c(L, 'roof', '#3d5aa8'), trim = c(L, 'trim', '#ffd24a'), door = c(L, 'door', '#4a2e17');
  const W = w * 0.86, D = d * 0.56, H = 1.45, y0 = 0.22, zc = -0.35, zf = zc + D / 2;
  const stone = C('#d8d4e4');
  k.color(stone).add(T.rbox(0.25), [0, 0.11, 0.15], [W + 0.2, 0.22, D + 1.1]);
  k.color(wall).add(T.box(), [0, y0 + H / 2, zc], [W, H, D]);
  k.color(mul(wall, 0.9)).add(T.box(), [0, y0 + H, zc], [W + 0.1, 0.12, D + 0.1]);
  // round windows on the wings, tall arched ones by the porch
  for (const s of [-1, 1]) {
    windowAt(k, s * W * 0.36, 0.95, zf + 0.02, 0.34, 0.7, trim, null);
    k.color(trim).add(T.dome(10, 3), [s * W * 0.36, 1.32, zf + 0.04], [0.2, 0.14, 0.04], [Math.PI / 2, 0, 0]);
  }
  // portico: pediment on four columns, steps
  const pW = W * 0.5, pz = zf + 0.45;
  for (let i = 0; i < 4; i++) {
    const x = -pW / 2 + 0.12 + i * (pW - 0.24) / 3;
    k.color('#ffffff').add(T.cyl(0.88, 1, 8), [x, y0 + H / 2, pz], [0.09, H, 0.09]);
    k.color(stone).add(T.box(), [x, y0 + 0.05, pz], [0.22, 0.1, 0.22]).add(T.box(), [x, y0 + H - 0.05, pz], [0.24, 0.1, 0.24]);
  }
  k.color(mul(wall, 1.02)).add(T.box(), [0, y0 + H + 0.02, (pz + zf) / 2], [pW + 0.2, 0.14, pz - zf + 0.3]);
  k.color(lighten(wall, 0.1)).add(T.shape('pediment', [[-0.5, 0], [0.5, 0], [0, 1]], 0.12), [0, y0 + H + 0.09, pz + 0.05], [pW + 0.25, 0.45, 1]);
  k.color(trim).add(T.box(), [0, y0 + H + 0.1, pz + 0.12], [pW + 0.26, 0.05, 0.04]);
  for (let i = 0; i < 3; i++) k.color(i % 2 ? stone : lighten(stone, 0.1)).add(T.box(), [0, 0.04 + i * 0.07, pz + 0.55 - i * 0.12], [pW + 0.2 - i * 0.1, 0.08, 0.3]);
  doorAt(k, dx, zf + 0.02, 0.56, 1.0, door, trim);
  // drum and dome with a gold lantern
  const yd = y0 + H + 0.06;
  k.color(wall).add(T.cyl(1, 1, 10), [0, yd + 0.22, zc], [0.95, 0.44, 0.95]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    k.push().tf(Math.sin(a) * 0.93, 0, zc + Math.cos(a) * 0.93, 0, a, 0);
    k.color('#bfe6ff', 0.25).add(T.box(), [0, yd + 0.24, 0], [0.16, 0.24, 0.04]);
    k.pop();
  }
  k.color(trim).add(T.cyl(1, 1, 10), [0, yd + 0.46, zc], [1.0, 0.06, 1.0]);
  k.color(roof).add(T.dome(12, 5), [0, yd + 0.48, zc], [0.95, 0.85, 0.95]);
  for (let i = 0; i < 8; i++) k.color(mul(roof, 0.82)).add(T.torus(0.035, 3, 10, Math.PI / 2), [0, yd + 0.48, zc], [0.96, 0.86, 0.96], [0, (i / 8) * Math.PI * 2, 0]);
  k.color(trim).add(T.cyl(1, 1, 8), [0, yd + 1.38, zc], [0.13, 0.14, 0.13]);
  k.color(trim).add(T.cone(8), [0, yd + 1.55, zc], [0.15, 0.2, 0.15]);
  k.color(trim).add(T.sphere(6, 5), [0, yd + 1.7, zc], 0.05);
  // low roofs on the wings
  for (const s of [-1, 1]) k.color(roof).add(T.box(), [s * W * 0.33, y0 + H + 0.1, zc], [W * 0.34, 0.1, D * 0.9], [0, 0, s * -0.12]);
  if (L.sign && L.sign !== 'none') signIcon(k, L.sign, pW / 2 + 0.1, 1.2, zf + 0.12);
  return [];
}

function sPotion(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#d9ccf2'), roof = c(L, 'roof', '#6a3fb0'), trim = c(L, 'trim', '#ffd24a'), door = c(L, 'door', '#4a2e5a');
  const R = Math.min(w, d) * 0.33, zc = -0.35, y0 = 0.14;
  k.color('#8a7aa8').add(T.cyl(1, 1, 10), [0, 0.07, zc], [R + 0.12, 0.14, R + 0.12]);
  // three crooked stacked drums, each leaning a little more
  const segs = [[0.75, 0, 0, 1.0], [0.62, 0.07, 0.07, 0.94], [0.5, 0.15, -0.1, 0.9]];
  let y = y0, x = 0;
  segs.forEach(([h, ox, rz, s], i) => {
    x += ox;
    k.push().tf(x, y, zc, 0, i * 0.4, rz);
    k.color(i % 2 ? mul(wall, 0.94) : wall).add(T.cyl(0.97, 1, 10), [0, h / 2, 0], [R * s, h, R * s]);
    k.color(roof).add(T.cyl(1, 1, 10), [0, h, 0], [R * s + 0.05, 0.06, R * s + 0.05]);
    k.pop();
    y += h - 0.02;
  });
  // bent witch-hat roof
  k.push().tf(x + 0.05, y, zc, 0, 0, -0.12);
  k.color(roof).add(T.cyl(1, 1, 12), [0, 0.02, 0], [R + 0.3, 0.06, R + 0.3]);
  k.color(roof).add(T.cyl(0.6, 1, 12), [0, 0.28, 0], [R * 0.8, 0.5, R * 0.8]);
  k.color(roof).add(T.cyl(0.4, 1, 10), [0.08, 0.68, 0], [R * 0.48, 0.36, R * 0.48], [0, 0, -0.35]);
  k.color(roof).add(T.cone(8), [0.23, 0.95, 0], [R * 0.2, 0.3, R * 0.2], [0, 0, -0.85]);
  k.color(trim).add(T.torus(0.15, 4, 14), [0, 0.12, 0], [R * 0.82, R * 0.82, 0.5], [Math.PI / 2, 0, 0]);
  k.color(trim).add(T.octa(), [0.4, 1.02, 0], 0.07);
  k.pop();
  // porch with the door, a moon window, potion bottles on the sill
  const zf = zc + R;
  k.color(wall).add(T.box(), [dx * 0.5, y0 + 0.5, zf + 0.15], [0.8, 1.0, 0.5]);
  k.color(roof).add(T.box(), [dx * 0.5, y0 + 1.05, zf + 0.22], [0.92, 0.08, 0.66], [0.28, 0, 0]);
  doorAt(k, dx * 0.5, zf + 0.4, 0.44, 0.76, door, trim);
  k.push().tf(0, 0, zc, 0, 0.5, 0); roundWindow(k, 0, 1.25, R * 0.9, 0.14, trim); k.pop();
  k.push().tf(0, 0, zc, 0, -0.55, 0); windowAt(k, 0, 1.65, R * 0.82, 0.22, 0.3, trim, null); k.pop();
  const bc = ['#ff5a9a', '#7cf07c', '#9fe6ff', '#ffd24a'];
  k.lineless = true;
  for (let i = 0; i < 4; i++) {
    k.color(bc[i], 0.35).add(T.sphere(6, 5), [dx * 0.5 - 0.3 + i * 0.2 + (i > 1 ? 0.2 : 0), 0.25, zf + 0.55], [0.07, 0.08, 0.07]);
    k.color('#cfe8ff').add(T.cyl(1, 1, 5), [dx * 0.5 - 0.3 + i * 0.2 + (i > 1 ? 0.2 : 0), 0.36, zf + 0.55], [0.025, 0.08, 0.025]);
  }
  k.lineless = false;
  // the cauldron chimney: a pot on the roof shoulder, brewing
  const cx = R * 0.8 + 0.1, cy = y0 + 1.25, cz = zc + 0.05;
  k.color('#6a3fb0').add(T.box(), [cx - 0.05, cy - 0.3, cz], [0.18, 0.6, 0.18]);
  k.color('#3a3a4a').add(potT(), [cx, cy, cz], [0.3, 0.38, 0.3]);
  k.color(lighten('#3a3a4a', 0.2)).add(T.torus(0.15, 4, 12), [cx, cy + 0.36, cz], [0.25, 0.25, 0.25], [Math.PI / 2, 0, 0]);
  k.lineless = true;
  k.color('#7cf07c', 0.8).add(T.cyl(1, 1, 10), [cx, cy + 0.34, cz], [0.23, 0.02, 0.23]);
  k.lineless = false;
  if (L.sign && L.sign !== 'none') signIcon(k, L.sign, dx * 0.5 + 0.42, 1.05, zf + 0.45);
  return [{ type: 'bubbles', x: cx, y: cz, h: cy + 0.36, color: '#7cf07c' }, smoke(cx, cz, cy + 0.5, '#d8c4ff')];
}

function sOutfitter(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#fff0f4'), roof = c(L, 'roof', '#e0508a'), trim = c(L, 'trim', '#8a3a5a'), door = c(L, 'door', '#6b2a44');
  const W = w * 0.8, D = d * 0.56, H = 1.5, y0 = 0.14, zc = -0.2, zf = zc + D / 2;
  plinth(k, W, D, '#d8c8d0');
  k.color(wall).add(T.box(), [0, y0 + H / 2, zc], [W, H, D]);
  // mansard roof: steep lower slopes and a flat top with a ridge of scallops
  const yr = y0 + H;
  k.color(roof).add(T.cyl(0.72, 1, 4), [0, yr + 0.3, zc], [W * 0.73, 0.6, D * 0.76], [0, Math.PI / 4, 0]);
  k.color(mul(roof, 0.8)).add(T.box(), [0, yr + 0.62, zc], [W * 0.68, 0.06, D * 0.5]);
  for (const s of [-1, 1]) {
    k.color(wall).add(T.box(), [s * W * 0.22, yr + 0.28, zf + 0.06], [0.34, 0.36, 0.2]);
    k.color(roof).add(T.cone(4), [s * W * 0.22, yr + 0.55, zf + 0.06], [0.28, 0.2, 0.18], [0, Math.PI / 4, 0]);
    windowAt(k, s * W * 0.22, yr + 0.28, zf + 0.17, 0.18, 0.2, trim, null);
  }
  k.lineless = true;
  for (let i = 0; i < 9; i++) k.color(i % 2 ? '#ffffff' : roof).add(T.dome(6, 2), [-W / 2 + 0.1 + i * (W - 0.2) / 8, yr - 0.02, zf + 0.04], [0.07, 0.07, 0.03], [Math.PI / 2, 0, 0]);
  k.lineless = false;
  // bay window: three angled panes bulging out of the front, with a dress form inside
  const bx = dx < 0 ? W * 0.2 : -W * 0.2;
  k.color(trim).add(T.box(), [bx, 0.42, zf + 0.18], [0.92, 0.12, 0.38]);
  k.color(trim).add(T.box(), [bx, 1.2, zf + 0.18], [0.94, 0.1, 0.4]);
  k.color('#bfe6ff', 0.3).add(T.box(), [bx, 0.82, zf + 0.36], [0.5, 0.66, 0.03]);
  for (const s of [-1, 1]) k.color('#bfe6ff', 0.3).add(T.box(), [bx + s * 0.36, 0.82, zf + 0.2], [0.03, 0.66, 0.34], [0, s * -0.55, 0]);
  for (const s of [-1, 1]) k.color(trim).add(T.box(), [bx + s * 0.25, 0.82, zf + 0.37], [0.04, 0.68, 0.04]);
  k.color(roof).add(T.box(), [bx, 1.28, zf + 0.2], [1.0, 0.06, 0.46], [0.3, 0, 0]);
  k.color('#7a5ad9').add(T.cone(8), [bx - 0.1, 0.9, zf + 0.2], [0.12, 0.3, 0.12]);
  k.color('#ffe066').add(T.octa(), [bx - 0.1, 0.92, zf + 0.3], 0.03);
  k.color('#3fae8a').add(T.cyl(0.6, 1, 8), [bx + 0.14, 0.75, zf + 0.2], [0.1, 0.38, 0.08]);
  doorAt(k, dx, zf, 0.44, 0.8, door, trim);
  // the big hat sign on the roof ridge: a purple wizard hat with a gold band
  k.color('#7a5ad9').add(T.cyl(1, 1, 12), [0, yr + 0.7, zc + 0.05], [0.42, 0.04, 0.42]);
  k.color('#7a5ad9').add(T.cyl(0.55, 1, 10), [0, yr + 0.88, zc + 0.05], [0.22, 0.3, 0.22]);
  k.color('#7a5ad9').add(T.cone(10), [0.06, yr + 1.2, zc + 0.05], [0.13, 0.42, 0.13], [0, 0, -0.35]);
  k.color('#ffd24a').add(T.cyl(1, 1, 10), [0, yr + 0.76, zc + 0.05], [0.235, 0.06, 0.235]);
  k.color('#ffe066').add(T.octa(), [0, yr + 0.92, zc + 0.27], 0.06);
  if (L.sign && L.sign !== 'none') signIcon(k, L.sign, dx + 0.32, 1.12, zf + 0.14);
  return [];
}

function sCafe(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#fdf1e2'), roof = c(L, 'roof', '#3f9e6a'), trim = c(L, 'trim', '#5a3a22'), door = c(L, 'door', '#4a2e17');
  const W = w * 0.86, D = d * 0.5, H = 1.35, y0 = 0.14, zc = -d / 2 + D / 2 + 0.12, zf = zc + D / 2;
  plinth(k, W, D);
  k.color(wall).add(T.box(), [0, y0 + H / 2, zc], [W, H, D]);
  for (const s of [-1, 1]) k.color(trim).add(T.box(), [s * W / 2, y0 + H / 2, zf], [0.1, H, 0.1]);
  gableRoof(k, 0, y0 + H, zc, W, D, 0.7, roof, wall, trim, false);
  k.color('#c87a5a').add(T.box(), [-W * 0.3, y0 + H + 0.6, zc - 0.1], [0.22, 0.6, 0.22]);
  // long striped awning across the front, big windows, chalkboard menu
  awning(k, 0, 1.35, zf + 0.26, W * 0.98, 0.52, roof, '#ffffff');
  windowAt(k, W * 0.15, 0.78, zf + 0.02, 1.0, 0.5, trim, null);
  doorAt(k, dx, zf, 0.44, 0.78, door, trim);
  k.color('#2f3a34').add(T.box(), [dx + 0.42, 0.32, zf + 0.35], [0.26, 0.4, 0.03], [-0.2, 0, 0]);
  k.lineless = true;
  for (let i = 0; i < 3; i++) k.color('#ffffff').add(T.box(), [dx + 0.42, 0.42 - i * 0.08, zf + 0.37], [0.16 - (i % 2) * 0.05, 0.02, 0.005], [-0.2, 0, 0]);
  k.lineless = false;
  // terrace deck in front of the east part: planks, planters and two umbrella tables
  const tx0 = dx + 0.5, tx1 = W / 2 + 0.05, tz0 = zf + 0.1, tz1 = d / 2 - 0.08;
  const tw = tx1 - tx0, td = tz1 - tz0;
  k.color('#c98c50').add(T.box(), [(tx0 + tx1) / 2, 0.05, (tz0 + tz1) / 2], [tw, 0.1, td]);
  k.lineless = true;
  for (let i = 1; i < 6; i++) k.color('#b0743d').add(T.box(), [(tx0 + tx1) / 2, 0.102, tz0 + i * td / 6], [tw, 0.005, 0.02]);
  k.lineless = false;
  k.color('#a8634a').add(T.box(), [(tx0 + tx1) / 2, 0.2, tz1 - 0.06], [tw, 0.24, 0.12]);
  k.lineless = true;
  for (let i = 0; i < 8; i++) k.color(i % 2 ? '#ff8fc7' : '#4cbf55').add(T.sphere(5, 4), [tx0 + 0.1 + i * (tw - 0.2) / 7, 0.36, tz1 - 0.06], 0.07);
  k.lineless = false;
  const tabs = [[tx0 + tw * 0.28, tz0 + td * 0.45, roof, '#ffffff'], [tx0 + tw * 0.75, tz0 + td * 0.45, '#ffd24a', '#ffffff']];
  for (const [x, z, c1, c2] of tabs) {
    k.color('#c98c50').add(T.cyl(1, 1, 10), [x, 0.42, z], [0.2, 0.04, 0.2]);
    k.color('#5a5a66').add(T.cyl(1, 1, 5), [x, 0.26, z], [0.03, 0.32, 0.03]);
    for (const s of [-1, 1]) k.color('#b0743d').add(T.rbox(0.3), [x + s * 0.3, 0.26, z], [0.18, 0.05, 0.18]);
    k.color('#ffffff').add(T.cyl(0.7, 1, 6), [x, 0.48, z], [0.04, 0.06, 0.04]);
    umbrella(k, x, z, 1.15, 0.42, c1, c2);
  }
  return [smoke(-W * 0.3, zc - 0.1, y0 + H + 0.95)];
}

function sGeneral(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#f4ecd8'), roof = c(L, 'roof', '#4f9e5a'), trim = c(L, 'trim', '#6b4423'), door = c(L, 'door', '#5a3a22');
  const W = w * 0.6, D = d * 0.6, H = 1.45, y0 = 0.14, xc = dx, zc = -0.15, zf = zc + D / 2;
  plinth(k, W, D);
  k.push().tf(xc, 0, 0);
  // clapboard store with a false front
  k.color(wall).add(T.box(), [0, y0 + H / 2, zc], [W, H, D]);
  k.lineless = true;
  for (let i = 1; i < 7; i++) k.color(mul(wall, 0.88)).add(T.box(), [0, y0 + i * H / 7, zf + 0.005], [W, 0.025, 0.01]);
  k.lineless = false;
  gableRoof(k, 0, y0 + H, zc, W, D, 0.65, roof, wall, trim, false);
  k.color(wall).add(T.box(), [0, y0 + H + 0.25, zf + 0.04], [W + 0.1, 0.55, 0.08]);
  k.color(trim).add(T.box(), [0, y0 + H + 0.54, zf + 0.04], [W + 0.16, 0.07, 0.12]);
  k.color(roof).add(T.box(), [0, y0 + H + 0.25, zf + 0.09], [W * 0.7, 0.26, 0.02]);
  doorAt(k, 0, zf, 0.5, 0.82, door, trim);
  windowAt(k, -W * 0.3, 0.8, zf + 0.02, 0.36, 0.46, trim, null);
  k.color(trim).add(T.box(), [0, 1.18, zf + 0.25], [W * 0.95, 0.05, 0.5], [0.3, 0, 0]);
  for (const s of [-1, 1]) k.color(trim).add(T.box(), [s * W * 0.45, 0.6, zf + 0.46], [0.06, 1.2, 0.06]);
  k.pop();
  // lean-to shed on the east with a sloping single roof, open front, crates
  const lx0 = xc + W / 2, lx1 = w / 2 - 0.08, lw = lx1 - lx0, lxc = (lx0 + lx1) / 2;
  if (lw > 0.3) {
    k.color(mul(wall, 0.9)).add(T.box(), [lxc, y0 + 0.5, zc - D * 0.3], [lw, 1.0, D * 0.4]);
    k.color(mul(roof, 0.9)).add(T.box(), [lxc, y0 + 1.05, zc + 0.05], [lw + 0.1, 0.07, D + 0.3], [0.32, 0, 0]);
    k.color(trim).add(T.box(), [lx1 - 0.05, y0 + 0.45, zf + 0.05], [0.07, 0.9, 0.07]);
    goodsHeap(k, lxc, zc - 0.05, rnd, 6);
  }
  // west side: barrels and a broom
  const wx0 = -w / 2 + 0.08, wx1 = xc - W / 2;
  if (wx1 - wx0 > 0.3) {
    goodsHeap(k, (wx0 + wx1) / 2, zf + 0.15, rnd, 3);
    k.color('#c98c50').add(T.cyl(1, 1, 4), [wx1 - 0.08, 0.5, zf - 0.1], [0.02, 1.0, 0.02], [0.15, 0, 0.1]);
    k.color('#e8c870').add(T.cone(6), [wx1 - 0.13, 0.12, zf - 0.04], [0.09, 0.24, 0.07], [Math.PI, 0, 0]);
  }
  if (L.sign && L.sign !== 'none') signIcon(k, L.sign, xc + 0.3, 1.0, zf + 0.5);
  return [];
}

function sGuardhouse(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#dcdde6'), roof = c(L, 'roof', '#5a6a8a'), trim = c(L, 'trim', '#3a3a4a'), door = c(L, 'door', '#3a3a4a');
  const W = w * 0.82, D = d * 0.7, H = 1.55, y0 = 0.12, zf = D / 2;
  k.color('#9a9eae').add(T.box(), [0, y0 / 2, 0], [W + 0.16, y0, D + 0.16]);
  k.color(wall).add(T.box(), [0, y0 + H / 2, 0], [W, H, D]);
  k.lineless = true;
  for (let r = 0; r < 5; r++) for (let i = 0; i < 6; i++) {
    const x = -W / 2 + 0.15 + (i + (r % 2) * 0.5) * (W - 0.3) / 6;
    if (x > W / 2 - 0.1) continue;
    k.color(mul(wall, 0.85)).add(T.box(), [x, y0 + 0.18 + r * 0.3, zf + 0.005], [0.16, 0.025, 0.01]);
  }
  k.lineless = false;
  // flat roof walk with crenellations all round
  const yt = y0 + H;
  k.color(mul(wall, 0.92)).add(T.box(), [0, yt + 0.04, 0], [W + 0.14, 0.08, D + 0.14]);
  const nX = Math.round(W / 0.36), nZ = Math.round(D / 0.36);
  for (let i = 0; i < nX; i++) if (i % 2 === 0) for (const s of [-1, 1]) k.color(wall).add(T.box(), [-W / 2 + (i + 0.5) * W / nX, yt + 0.2, s * (D / 2 + 0.02)], [W / nX, 0.26, 0.14]);
  for (let i = 0; i < nZ; i++) if (i % 2 === 0) for (const s of [-1, 1]) k.color(wall).add(T.box(), [s * (W / 2 + 0.02), yt + 0.2, -D / 2 + (i + 0.5) * D / nZ], [0.14, 0.26, D / nZ]);
  // corner watch turret with a cone roof and a flag
  const tx = W / 2 - 0.1, tz = -D / 2 + 0.2;
  k.color(wall).add(T.cyl(1, 1, 10), [tx, y0 + (H + 0.6) / 2, tz], [0.32, H + 0.6, 0.32]);
  k.color(roof).add(T.cone(10), [tx, yt + 0.85, tz], [0.4, 0.6, 0.4]);
  k.color('#8a5a33').add(T.cyl(1, 1, 4), [tx, yt + 1.3, tz], [0.015, 0.4, 0.015]);
  k.color('#c8503c').add(T.box(), [tx + 0.13, yt + 1.4, tz], [0.24, 0.14, 0.01]);
  // heavy arched door, arrow slits, a shield emblem
  doorAt(k, dx, zf, 0.5, 0.85, door, trim);
  k.color('#5a5a66').add(T.box(), [dx, 0.5, zf + 0.09], [0.5, 0.04, 0.02]).add(T.box(), [dx, 0.3, zf + 0.09], [0.5, 0.04, 0.02]);
  for (const x of [-W * 0.32, W * 0.32]) if (Math.abs(x - dx) > 0.4) k.color('#2a2a3a').add(T.box(), [x, 1.05, zf + 0.01], [0.07, 0.36, 0.03]);
  k.color(roof).add(T.shape('shield', [[-0.15, 0.1], [0.15, 0.1], [0.15, -0.05], [0, -0.18], [-0.15, -0.05]], 0.04), [dx, 1.32, zf + 0.03], [1, 1, 1]);
  k.color('#ffd24a').add(T.box(), [dx, 1.3, zf + 0.06], [0.03, 0.2, 0.02]);
  // spear rack by the door
  for (let i = 0; i < 3; i++) {
    k.color('#8a5a33').add(T.cyl(1, 1, 4), [dx + 0.5 + i * 0.1, 0.55, zf + 0.15], [0.015, 1.1, 0.015]);
    k.color('#c8ccd8').add(T.cone(4), [dx + 0.5 + i * 0.1, 1.15, zf + 0.15], [0.04, 0.12, 0.04]);
  }
  if (L.sign && L.sign !== 'none') signIcon(k, L.sign, dx - 0.75, 1.15, zf + 0.12);
  return [];
}

function sClock(k, L, w, d, rnd, dx) {
  const wall = c(L, 'wall', '#f4ecd8'), roof = c(L, 'roof', '#3d5aa8'), trim = c(L, 'trim', '#ffd24a'), door = c(L, 'door', '#7a4e2c');
  const S = Math.min(w, d) * 0.5, H = 2.15, y0 = 0.16;
  k.color('#a3a7b8').add(T.rbox(0.25), [0, 0.08, 0], [S + 0.3, 0.16, S + 0.3]);
  k.color(mix(wall, '#c8c4b8', 0.3)).add(T.box(), [0, y0 + 0.3, 0], [S + 0.1, 0.6, S + 0.1]);
  k.color(wall).add(T.box(), [0, y0 + H / 2, 0], [S, H, S]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.color(lighten(wall, 0.1)).add(T.box(), [sx * S / 2, y0 + H / 2, sz * S / 2], [0.12, H, 0.12]);
  // clock faces (south, east, west): dial, numerals, hands at ten past ten
  const yc = y0 + H - 0.42;
  for (const [ry, ox, oz] of [[0, 0, 1], [Math.PI / 2, 1, 0], [-Math.PI / 2, -1, 0]]) {
    k.push().tf(ox * (S / 2 + 0.03), 0, oz * (S / 2 + 0.03), 0, ry, 0);
    k.color(trim).add(T.cyl(1, 1, 10), [0, yc, 0], [0.36, 0.05, 0.36], [Math.PI / 2, 0, 0]);
    k.color('#fffbe8').add(T.cyl(1, 1, 10), [0, yc, 0.03], [0.31, 0.03, 0.31], [Math.PI / 2, 0, 0]);
    k.lineless = true;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.color('#3a3a4a').add(T.box(), [Math.sin(a) * 0.25, yc + Math.cos(a) * 0.25, 0.05], [0.025, i % 3 ? 0.03 : 0.06, 0.01], [0, 0, -a]); }
    k.color('#2a2a3a').add(T.box(), [-0.06, yc + 0.05, 0.06], [0.03, 0.16, 0.01], [0, 0, 0.9]);
    k.color('#2a2a3a').add(T.box(), [0.08, yc + 0.07, 0.065], [0.025, 0.22, 0.01], [0, 0, -0.85]);
    k.color('#c8503c').add(T.sphere(5, 4), [0, yc, 0.07], 0.03);
    k.lineless = false;
    k.pop();
  }
  // belfry: open arches with a bell, then a steep pyramid roof with a gold finial
  const yb = y0 + H;
  k.color(trim).add(T.box(), [0, yb + 0.04, 0], [S + 0.14, 0.08, S + 0.14]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.color(wall).add(T.box(), [sx * (S / 2 - 0.07), yb + 0.3, sz * (S / 2 - 0.07)], [0.14, 0.5, 0.14]);
  k.color('#ffd24a', 0.2).add(T.lathe('bell', [[0, 0.3], [0.08, 0.3], [0.12, 0.2], [0.14, 0.05], [0.2, 0], [0, 0]], 10), [0, yb + 0.12, 0], 1);
  k.color(wall).add(T.box(), [0, yb + 0.58, 0], [S + 0.06, 0.08, S + 0.06]);
  k.color(roof).add(T.cone(4), [0, yb + 0.95, 0], [S * 0.78, 0.75, S * 0.78], [0, Math.PI / 4, 0]);
  k.color(trim).add(T.sphere(6, 5), [0, yb + 1.35, 0], 0.06);
  k.color(trim).add(T.cyl(1, 1, 4), [0, yb + 1.48, 0], [0.012, 0.22, 0.012]);
  k.color(trim).add(T.octa(), [0, yb + 1.62, 0], [0.05, 0.07, 0.05]);
  doorAt(k, dx * 0.4, S / 2 + 0.06, 0.4, 0.68, door, trim);
  windowAt(k, 0, 1.3, S / 2 + 0.04, 0.16, 0.3, trim, null);
  return [];
}

function sBridgeArch(k, L, w, d) {
  const stone = c(L, 'wood', '#e0d6c4'), rail = c(L, 'rail', '#c4b8a2');
  const along = w >= d;          // spans east-west when wider than deep
  const len = along ? w : d, wid = (along ? d : w) * 0.86;
  const n = Math.round(len * 2);
  k.push();
  if (!along) k.tf(0, 0, 0, 0, Math.PI / 2, 0);
  k.color(mul(stone, 0.9)).add(T.box(), [0, 0.04, 0], [len, 0.08, wid]);
  k.lineless = true;
  for (let i = 0; i < n; i++) {
    const u = -len / 2 + (i + 0.5) * (len / n);
    const y = 0.06 + Math.sin(((i + 0.5) / n) * Math.PI) * 0.12;
    k.color(i % 2 ? stone : mul(stone, 0.94)).add(T.box(), [u, y, 0], [len / n + 0.01, 0.1, wid - 0.1]);
  }
  k.lineless = false;
  // parapets: a low curved wall each side, coping on top, rounded end posts with lanterns
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i + 0.5) * (len / n);
      const y = 0.06 + Math.sin(((i + 0.5) / n) * Math.PI) * 0.12;
      k.color(rail).add(T.box(), [u, y + 0.24, s * (wid / 2 - 0.05)], [len / n + 0.012, 0.42, 0.12]);
      k.color(lighten(rail, 0.2)).add(T.box(), [u, y + 0.47, s * (wid / 2 - 0.05)], [len / n + 0.015, 0.05, 0.17]);
    }
    for (const e of [-1, 1]) {
      const u = e * (len / 2 - 0.1);
      k.color(rail).add(T.box(), [u, 0.35, s * (wid / 2 - 0.05)], [0.24, 0.7, 0.24]);
      k.color(lighten(rail, 0.2)).add(T.sphere(8, 6), [u, 0.76, s * (wid / 2 - 0.05)], 0.11);
    }
  }
  // the arch itself shows on both faces over the water
  for (const s of [-1, 1]) {
    k.color(mul(stone, 0.85)).add(T.torus(0.1, 4, 14, Math.PI), [0, -0.35, s * wid / 2], [len * 0.36, 0.5, 1]);
    k.color(mul(rail, 0.9)).add(T.box(), [0, 0.0, s * wid / 2], [len * 0.95, 0.14, 0.05]);
  }
  k.pop();
  return [];
}

const STYLE_FNS = { cottage: sCottage, townhouse: sTownhouse, tower_house: sTowerHouse, mushroom: sMushroom, windmill: sWindmill,
  greenhouse: sGreenhouse, bakery: sBakery, library: sLibrary, potion: sPotion, outfitter: sOutfitter, cafe: sCafe, general: sGeneral,
  guardhouse: sGuardhouse, clock: sClock, arch: sBridgeArch };

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
/** Approximate top height per building style (look.style). */
export const STYLE_HEIGHT = { cottage: 2.6, townhouse: 3.0, tower_house: 3.4, mushroom: 2.6, windmill: 3.2, greenhouse: 1.8, bakery: 2.6,
  library: 3.4, potion: 3.3, outfitter: 2.9, cafe: 2.3, general: 2.4, guardhouse: 3.1, clock: 3.9, arch: 0.8 };

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
  const L = p.look || {};
  const style = L.style && (model === 'house' || model === 'shop' || model === 'tower' || model === 'bridge') ? L.style : null;
  if (style && !STYLE_FNS[style]) unknown.add('style:' + style);
  if (style && STYLE_FNS[style]) {
    const door = p.def && p.def.door !== undefined ? p.def.door : Math.floor(w / 2);
    const dx = door + 0.5 - w / 2;
    fn = (kk, LL, ww, hh, rr) => STYLE_FNS[style](kk, LL, ww, hh, rr, dx);
  }
  k.push();
  k.tf(cx, 0, cz);
  const em = fn(k, L, w, h, rnd) || [];
  k.pop();
  const sh = SHADOW[model];
  if (sh) em.push({ type: 'shadow', x: 0, y: 0, h: 0, r: sh * Math.max(1, Math.min(w, h) * 0.8), color: '#000000' });
  for (const e of em) { e.x += cx; e.y += cz; }
  return em;
}
