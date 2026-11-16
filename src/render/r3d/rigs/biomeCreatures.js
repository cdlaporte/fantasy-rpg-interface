// Round 3 creature features (docs/BIOMES.md) and the biome boss heroes: sphinx (quadruped base), crab_king
// (quadruped base), yeti (golem base). Same conventions as creatures.js: facing +Z, feet at y = 0, size 1, part ids
// 0 body, 1 head, 2/3 legs, 4/5 arms | wings, 7 tail. Small details are lineless.
import { T, C, mul, mix, lighten } from '../kit.js';
import { eyes } from './creatures.js';

const BONE = '#f6ead0';
const GOLD = '#ffd24a';

// ---------------------------------------------------------------- quadruped features

/** Domed shell over the back (beetles, crabs) with a seam and a few spots. */
export function quadShell(k, s) {
  const sh = lighten(s.body, 0.12);
  k.color(sh).add(T.dome(12, 5), [0, 0.42, -0.02], [0.3, 0.24, 0.4]);
  k.color(mul(sh, 0.8)).add(T.cyl(1, 1, 12), [0, 0.42, -0.02], [0.31, 0.04, 0.41]);
  k.lineless = true;
  k.color(mul(sh, 0.65)).add(T.box(), [0, 0.66, -0.04], [0.025, 0.02, 0.6], [0, 0, 0]);
  for (const [x, z, r] of [[0.13, 0.08, 0.05], [-0.14, -0.1, 0.045], [0.12, -0.2, 0.04], [-0.12, 0.12, 0.04]]) {
    k.color(lighten(s.accent, 0.15)).add(T.sphere(5, 3), [x, 0.6 - Math.abs(z) * 0.18, z], [r, r * 0.4, r]);
  }
  k.color('#ffffff', 0.5).add(T.sphere(5, 3), [-0.1, 0.63, 0.12], [0.07, 0.02, 0.04]);
  k.lineless = false;
}

/** Beetle antennae (shelled critters without ears). */
export function quadAntennae(k, s, hy, hz) {
  for (const side of [1, -1]) {
    k.color(mul(s.body, 0.7)).add(T.cyl(0.6, 1, 4), [0.06 * side, hy + 0.2, hz + 0.02], [0.014, 0.2, 0.014], [0.35, 0, -0.45 * side]);
    k.color(s.accent).add(T.sphere(5, 4), [0.11 * side, hy + 0.29, hz + 0.06], 0.03);
  }
}

/** Scorpion tail arching over the back: segments and a stinger (on the tail part, it wags). */
export function quadStinger(k, s) {
  const segs = [[0, 0.45, -0.42, 0.075], [0, 0.6, -0.5, 0.072], [0, 0.76, -0.48, 0.068], [0, 0.88, -0.38, 0.064], [0, 0.94, -0.25, 0.058]];
  segs.forEach(([x, y, z, r], i) => k.color(i % 2 ? s.body : mul(s.body, 0.9)).add(T.sphere(8, 6), [x, y, z], [r, r, r * 1.1]));
  k.color(mix(s.accent, '#ffffff', 0.1)).add(T.sphere(8, 6), [0, 0.92, -0.13], [0.07, 0.06, 0.08]);
  k.color(s.accent, 0.25).add(T.cone(6), [0, 0.86, -0.05], [0.035, 0.14, 0.035], [2.2, 0, 0]);
}

/** Pincers on the head part: arms reaching forward and two-fingered claws. */
export function quadClaws(k, s, hy, hz) {
  const cc = lighten(s.body, 0.06);
  for (const side of [1, -1]) {
    const x0 = 0.2 * side;
    k.color(mul(cc, 0.92)).add(T.capsule(1.6, 6), [x0 + 0.04 * side, hy - 0.17, hz + 0.08], [0.07, 0.07, 0.07], [Math.PI / 2 - 0.2, 0, -0.5 * side]);
    k.push().tf(x0 + 0.12 * side, hy - 0.12, hz + 0.24, 0.25, -0.35 * side, 0);
    k.color(cc).add(T.sphere(8, 6), [0, 0, 0], [0.1, 0.085, 0.13]);
    k.color(lighten(cc, 0.1)).add(T.cone(6), [0.035 * side, 0.03, 0.15], [0.045, 0.16, 0.035], [Math.PI / 2 - 0.25, 0, 0]);
    k.color(mul(cc, 0.9)).add(T.cone(6), [-0.03 * side, -0.035, 0.13], [0.035, 0.13, 0.03], [Math.PI / 2 + 0.3, 0, 0]);
    k.pop();
  }
}

/** Tall bunny ears with pink insides. */
export function quadEars(k, s, hy, hz) {
  for (const side of [1, -1]) {
    k.push().tf(0.08 * side, hy + 0.14, hz - 0.06, -0.22, 0, -0.18 * side);
    k.color(s.body).add(T.capsule(2.6, 6), [0, 0.18, 0], [0.09, 0.12, 0.05]);
    k.lineless = true;
    k.color(mix(s.accent, '#ffffff', 0.25)).add(T.capsule(2.6, 5), [0, 0.18, 0.022], [0.05, 0.1, 0.02]);
    k.lineless = false;
    k.pop();
  }
}

/** Two curved horns on top of the head. */
export function quadHorns(k, s, hy, hz) {
  for (const side of [1, -1]) {
    k.push().tf(0.11 * side, hy + 0.13, hz - 0.02, -0.2, 0, -0.5 * side);
    k.color(BONE).add(T.cyl(0.7, 1, 6), [0, 0.06, 0], [0.04, 0.13, 0.04]);
    k.color(mix(BONE, '#c8a070', 0.25)).add(T.cone(6), [0.03 * side, 0.17, -0.02], [0.03, 0.12, 0.03], [-0.3, 0, -0.6 * side]);
    k.pop();
  }
}

// ---------------------------------------------------------------- blob features

/** Jellyfish tentacles hanging from the (raised) bell. */
export function blobTentacles(k, s) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.27;
    const col = i % 2 ? mix(s.body, s.accent, 0.35) : s.body;
    k.color(col).add(T.capsule(2, 5), [x, 0.24, z], [0.065, 0.065, 0.065], [0.35 * Math.sin(a), 0, -0.35 * Math.cos(a)]);
    k.color(lighten(col, 0.1)).add(T.capsule(1.6, 5), [x * 1.2, 0.08, z * 1.2], [0.05, 0.05, 0.05], [-0.25 * Math.sin(a), 0, 0.25 * Math.cos(a)]);
  }
}

/** Glassy bubbles floating on and around the body. */
export function blobBubbles(k, s) {
  k.lineless = true;
  const b = [[0.3, 0.62, 0.1, 0.07], [-0.33, 0.55, 0.05, 0.055], [0.18, 0.74, -0.15, 0.05], [-0.15, 0.7, 0.2, 0.045], [0.38, 0.38, 0.18, 0.04]];
  for (const [x, y, z, r] of b) {
    k.color(mix(s.accent, '#ffffff', 0.55), 0.35).add(T.sphere(7, 5), [x, y, z], r);
    k.color('#ffffff', 1).add(T.sphere(4, 3), [x - r * 0.35, y + r * 0.35, z + r * 0.5], r * 0.28);
  }
  k.lineless = false;
}

// ---------------------------------------------------------------- flyer features

/** Moth / dragonfly wings: a big upper and a smaller lower wing per side, veins and an eye spot. */
export function insectWings(k, s, side) {
  const wc = mix(s.accent, '#ffffff', 0.45);
  k.color(wc, 0.25).add(T.sphere(10, 5), [0.36 * side, 0.46, -0.06], [0.27, 0.02, 0.18], [0.15, 0.35 * side, 0.35 * side]);
  k.color(mul(wc, 0.92), 0.25).add(T.sphere(9, 5), [0.28 * side, 0.27, -0.08], [0.19, 0.02, 0.13], [0.1, -0.35 * side, -0.3 * side]);
  k.lineless = true;
  k.color(s.accent, 0.4).add(T.sphere(7, 4), [0.42 * side, 0.5, -0.05], [0.07, 0.025, 0.07], [0.15, 0, 0.35 * side]);
  k.color(lighten(s.accent, 0.5), 0.7).add(T.sphere(5, 3), [0.42 * side, 0.515, -0.05], [0.03, 0.02, 0.03], [0.15, 0, 0.35 * side]);
  for (let i = 0; i < 3; i++) k.color(mul(s.body, 0.8)).add(T.box(), [(0.26 + i * 0.05) * side, 0.45 + i * 0.015, -0.06], [0.2, 0.012, 0.012], [0, (0.6 - i * 0.5) * side, 0.35 * side]);
  k.lineless = false;
}

// ---------------------------------------------------------------- plant features

/** A walking cactus: ribbed column, spines, two raised cactus arms, a flower crown. */
export function plantCactus(k, s, meta) {
  const body = s.body;
  k.color(body).add(T.capsule(1.4, 9), [0, 0.36, 0], [0.42, 0.32, 0.42]);
  k.lineless = true;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI + 0.25;
    k.color(mul(body, 0.78)).add(T.box(), [Math.cos(a) * 0.205, 0.36, Math.sin(a) * 0.205], [0.02, 0.4, 0.02]);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2, y = 0.18 + ((i * 0.37) % 1) * 0.36;
    k.color('#fffbe6').add(T.cone(3), [Math.cos(a) * 0.22, y, Math.sin(a) * 0.22], [0.012, 0.05, 0.012], [Math.sin(a) * 1.5, 0, -Math.cos(a) * 1.5]);
  }
  k.lineless = false;
  eyes(k, 0, 0.42, 0.2, 0.042, s.eye, 0.075, false);
  k.lineless = true;
  k.color(mul(s.eye, 1)).add(T.torus(0.3, 4, 8, Math.PI), [0, 0.33, 0.21], [0.035, 0.03, 0.03], [0, 0, Math.PI]);
  k.color(mix(s.accent, '#ffffff', 0.4)).add(T.sphere(5, 3), [0.12, 0.36, 0.17], [0.03, 0.02, 0.01]);
  k.color(mix(s.accent, '#ffffff', 0.4)).add(T.sphere(5, 3), [-0.12, 0.36, 0.17], [0.03, 0.02, 0.01]);
  k.lineless = false;
  for (const side of [1, -1]) {
    k.part(side > 0 ? 4 : 5, 0.2 * side, 0.36, 0);
    k.color(mul(body, 0.95)).add(T.capsule(1, 6), [0.27 * side, 0.34, 0], [0.12, 0.12, 0.12], [0, 0, Math.PI / 2]);
    k.color(body).add(T.capsule(1.4, 6), [0.35 * side, 0.45, 0], [0.14, 0.12, 0.14]);
    k.color(s.accent).add(T.sphere(5, 3), [0.35 * side, 0.56, 0], [0.05, 0.03, 0.05]);
  }
  k.part(1, 0, 0.6, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.color(i % 2 ? s.accent : lighten(s.accent, 0.25)).add(T.sphere(6, 4), [Math.cos(a) * 0.08, 0.68, Math.sin(a) * 0.08], [0.08, 0.035, 0.06], [0, -a, 0]);
  }
  k.color(GOLD).add(T.sphere(6, 4), [0, 0.7, 0], [0.05, 0.03, 0.05]);
  meta.height = 0.75; meta.radius = 0.3; meta.tip = [0, 0.35, 0.3];
}

/** Kelp fronds waving from the head, with little float bulbs. */
export function plantSeaweed(k, s) {
  const kelp = mix(s.body, '#3fae7a', 0.35);
  const fr = [[0, 0.62, 0, 0], [0.1, 0.56, 0.02, -0.45], [-0.1, 0.57, -0.02, 0.45], [0.03, 0.55, -0.1, 0.2]];
  fr.forEach(([x, y, z, rz], i) => {
    k.push().tf(x, 0.42, z, 0, i * 0.7, rz);
    const c0 = i % 2 ? kelp : lighten(kelp, 0.1);
    k.color(c0).add(T.sphere(7, 4), [0.02, 0.14, 0], [0.06, 0.16, 0.02], [0, 0, 0.2]);
    k.color(mul(c0, 0.95)).add(T.sphere(7, 4), [-0.02, 0.36, 0], [0.055, 0.14, 0.02], [0, 0, -0.25]);
    k.color(lighten(c0, 0.05)).add(T.sphere(6, 4), [0.02, 0.54, 0], [0.045, 0.1, 0.02], [0, 0, 0.2]);
    k.color(s.accent).add(T.sphere(5, 4), [0.05, 0.27, 0.01], 0.035);
    k.pop();
  });
}

// ---------------------------------------------------------------- golem features

/** Biome golem dressings. where: 'body' | 'arm' (side) | 'head'. */
export function golemBiome(k, s, base, where, side = 1) {
  const f = s.f;
  if (f.has('sandy')) {
    const band = mix(base, '#c88850', 0.35);
    if (where === 'body') {
      k.lineless = true;
      for (let i = 0; i < 3; i++) k.color(band).add(T.box(), [0, 0.36 + i * 0.13, 0.205], [0.5, 0.025, 0.012]);
      k.color(s.accent, 0.85).add(T.torus(0.25, 3, 10), [0, 0.52, 0.215], [0.06, 0.06, 0.03]);
      k.color(s.accent, 0.85).add(T.box(), [0, 0.42, 0.215], [0.025, 0.12, 0.01]);
      k.lineless = false;
      k.color(mix(base, '#f6d68e', 0.4)).add(T.sphere(8, 4), [0.22, 0.74, -0.05], [0.12, 0.06, 0.12]);
      k.color(mix(base, '#f6d68e', 0.4)).add(T.sphere(8, 4), [-0.2, 0.75, 0], [0.1, 0.05, 0.1]);
    } else if (where === 'head') {
      k.color(mix(base, '#c88850', 0.2)).add(T.cone(4), [0, 1.0, 0.02], [0.13, 0.14, 0.12], [0, Math.PI / 4, 0]);
    }
  }
  if (f.has('icy')) {
    const ice = mix(s.accent, '#bfeeff', 0.5);
    if (where === 'body') {
      const sh = [[0.2, 0.82, -0.08, 0.22, 0.4], [-0.2, 0.8, -0.06, 0.2, -0.4], [0.02, 0.86, -0.16, 0.28, 0], [0.24, 0.56, -0.16, 0.16, 0.9], [-0.25, 0.55, -0.15, 0.15, -0.9]];
      sh.forEach(([x, y, z, h, rz], i) => k.color(i % 2 ? ice : lighten(ice, 0.25), 0.35).add(T.cyl(0, 1, 6), [x, y, z], [0.08, h, 0.08], [-0.25, 0, rz]));
      k.color('#ffffff').add(T.dome(10, 3), [0, 0.72, 0], [0.3, 0.06, 0.21]);
    } else if (where === 'arm') {
      k.lineless = true;
      for (let i = 0; i < 3; i++) k.color(lighten(ice, 0.3), 0.4).add(T.cone(4), [(0.33 + i * 0.05) * side, 0.12 - (i % 2) * 0.03, 0.04], [0.025, 0.09, 0.025], [Math.PI, 0, 0]);
      k.lineless = false;
      k.color('#ffffff').add(T.dome(8, 3), [0.36 * side, 0.69, 0], [0.11, 0.05, 0.11]);
    } else if (where === 'head') {
      k.color('#ffffff').add(T.dome(10, 3), [0, 0.95, 0.04], [0.16, 0.06, 0.14]);
      k.color(lighten(ice, 0.2), 0.4).add(T.cone(5), [0.08, 1.04, 0], [0.04, 0.12, 0.04], [0, 0, -0.3]);
    }
  }
  if (f.has('coral')) {
    const cor = s.accent;
    if (where === 'body') {
      const br = [[0.2, 0.74, -0.08, 0.3, -0.3], [-0.18, 0.76, -0.1, 0.24, 0.35], [0.05, 0.78, -0.16, 0.2, 0.1]];
      for (const [x, y, z, h, rz] of br) {
        k.push().tf(x, y, z, -0.2, 0, rz);
        k.color(cor).add(T.capsule(2.4, 5), [0, h / 2, 0], [0.065, h / 3.4, 0.065]);
        k.color(lighten(cor, 0.3)).add(T.sphere(5, 4), [0, h + 0.02, 0], 0.05);
        k.color(cor).add(T.capsule(1.4, 5), [0.05, h * 0.6, 0], [0.045, 0.045, 0.045], [0, 0, -0.9]);
        k.pop();
      }
      k.lineless = true;
      for (const [x, y] of [[-0.15, 0.36], [0.17, 0.42], [-0.05, 0.6], [0.12, 0.28]]) k.color('#f4ecdc').add(T.cone(5), [x, y, 0.21], [0.03, 0.04, 0.03], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.color('#ff9a5a').add(T.sphere(4, 3), [0.05 + Math.cos(a) * 0.05, 0.5 + Math.sin(a) * 0.05, 0.22], [0.045, 0.02, 0.012], [0, 0, a]); }
      k.lineless = false;
    } else if (where === 'head') {
      k.color(lighten(cor, 0.1)).add(T.capsule(1.6, 5), [0.08, 1.02, -0.02], [0.05, 0.06, 0.05], [0, 0, -0.4]);
      k.color('#7fd0a0').add(T.cone(4), [-0.08, 1.02, 0], [0.03, 0.14, 0.03], [0, 0, 0.3]);
    }
  }
  if (f.has('starry')) {
    if (where === 'body' || where === 'head' || where === 'arm') {
      k.lineless = true;
      const pts = where === 'body' ? [[0.12, 0.62], [-0.16, 0.55], [0.2, 0.4], [-0.08, 0.34], [0.02, 0.7], [-0.22, 0.42]]
        : where === 'arm' ? [[0.38 * side, 0.45], [0.36 * side, 0.6]] : [[0.1, 0.92], [-0.12, 0.9]];
      const z = where === 'body' ? 0.215 : where === 'arm' ? 0.09 : 0.18;
      pts.forEach(([x, y], i) => k.color(i % 2 ? '#fff6c0' : '#ffffff', 1).add(T.octa(), [x, y, z], [0.03, 0.03, 0.01]));
      if (where === 'body') {
        for (let i = 0; i + 1 < 4; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
          k.color(mix(s.accent, '#ffffff', 0.5), 0.8).add(T.box(), [(x0 + x1) / 2, (y0 + y1) / 2, z - 0.002], [Math.hypot(x1 - x0, y1 - y0), 0.008, 0.004], [0, 0, Math.atan2(y1 - y0, x1 - x0)]);
        }
        k.color(s.accent, 0.9).add(T.torus(0.22, 4, 12, Math.PI * 1.3), [0, 0.48, 0.22], [0.08, 0.08, 0.04], [0, 0, 0.6]);
      }
      k.lineless = false;
      if (where === 'head') k.color(s.accent, 0.6).add(T.torus(0.1, 4, 18), [0, 1.05, 0], [0.2, 0.2, 0.2], [Math.PI / 2 - 0.2, 0, 0]);
    }
  }
}

// ---------------------------------------------------------------- bosses

/** Sultana Sandsnout: a big friendly-regal sand sphinx with a striped headdress, gold collar and folded wings. */
function sphinx(k, s, meta) {
  const body = s.body, belly = s.belly, stripe = s.accent;
  const gold = C(GOLD);
  // legs with big paws (pairs A / B)
  const legs = [[0.22, 0.28, 2], [-0.22, -0.3, 2], [-0.22, 0.28, 3], [0.22, -0.3, 3]];
  for (const [x, z, p] of legs) {
    k.part(p, x, 0.36, z);
    k.color(mul(body, 0.93)).add(T.cyl(1, 0.85, 7), [x, 0.18, z], [0.1, 0.34, 0.1]);
    k.color(body).add(T.sphere(8, 5), [x, 0.05, z + 0.05], [0.12, 0.07, 0.15]);
    k.lineless = true;
    for (const t of [-1, 0, 1]) k.color(mul(body, 0.7)).add(T.box(), [x + t * 0.045, 0.06, z + 0.19], [0.012, 0.05, 0.02]);
    k.lineless = false;
  }
  k.part(0);
  k.color(body).add(T.sphere(12, 8), [0, 0.5, -0.04], [0.34, 0.27, 0.48]);
  k.color(belly).add(T.sphere(10, 6), [0, 0.42, 0.02], [0.27, 0.2, 0.4]);
  // folded wings along the flanks (feathers in gold and stripe colors)
  for (const side of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      k.color(i === 0 ? mix(body, gold, 0.5) : i === 1 ? stripe : mix(stripe, '#ffffff', 0.3)).add(T.sphere(8, 5),
        [0.3 * side, 0.62 - i * 0.03, -0.08 - i * 0.1], [0.07, 0.12 - i * 0.015, 0.3 - i * 0.04], [0.25, 0, 0.35 * side]);
    }
  }
  // gold collar (broad necklace) with gems
  k.color(gold).add(T.torus(0.35, 5, 16), [0, 0.68, 0.3], [0.24, 0.24, 0.2], [1.15, 0, 0]);
  k.lineless = true;
  for (let i = -2; i <= 2; i++) k.color(i % 2 ? '#ff5a7a' : '#3fc8d8', 0.3).add(T.sphere(5, 3), [i * 0.08, 0.6 - Math.abs(i) * 0.02, 0.42 - Math.abs(i) * 0.02], 0.03);
  k.lineless = false;
  // tail with a tuft (part 7)
  k.part(7, 0, 0.5, -0.5);
  k.color(body).add(T.cyl(0.5, 1, 6), [0, 0.52, -0.66], [0.035, 0.36, 0.035], [-1.1, 0, 0]);
  k.color(body).add(T.cyl(0.5, 1, 6), [0, 0.7, -0.8], [0.03, 0.2, 0.03], [-0.3, 0, 0]);
  k.color(stripe).add(T.sphere(7, 5), [0, 0.82, -0.82], [0.07, 0.09, 0.07]);
  // head (part 1): cat face under a striped nemes headdress
  k.part(1, 0, 0.75, 0.32);
  const hy = 0.95, hz = 0.42;
  k.push().tf(0, hy, hz, -0.25, 0, 0).tf(0, -hy, -hz);
  k.color(body).add(T.sphere(10, 8), [0, hy, hz], [0.24, 0.23, 0.22]);
  k.color(belly).add(T.sphere(9, 6), [0, hy - 0.08, hz + 0.15], [0.13, 0.09, 0.09]);
  k.lineless = true;
  k.color('#a8604a').add(T.sphere(5, 3), [0, hy - 0.04, hz + 0.235], [0.03, 0.02, 0.018]);
  k.color(mul(body, 0.5)).add(T.torus(0.25, 3, 8, Math.PI), [0, hy - 0.11, hz + 0.21], [0.04, 0.03, 0.02], [0, 0, Math.PI]);
  k.lineless = false;
  eyes(k, 0, hy + 0.04, hz + 0.18, 0.04, s.eye, 0.095);
  k.lineless = true;
  for (const sd of [1, -1]) k.color('#2a2030').add(T.box(), [sd * 0.155, hy + 0.06, hz + 0.18], [0.04, 0.012, 0.01], [0, 0, 0.5 * sd]);
  k.color('#c85a6a').add(T.sphere(5, 3), [0, hy - 0.115, hz + 0.215], [0.035, 0.018, 0.012]);
  k.lineless = false;
  // nemes: a hood flaring to the shoulders, stripes, lappets in front, a gem on the brow, a little crown cone
  k.color(stripe).add(T.cyl(0.7, 1, 12, false), [0, hy + 0.02, hz - 0.1], [0.28, 0.3, 0.25]);
  k.color(stripe).add(T.dome(12, 5), [0, hy + 0.17, hz - 0.1], [0.2, 0.08, 0.18]);
  k.lineless = true;
  for (let i = 0; i < 3; i++) k.color(gold).add(T.cyl(0.7, 1, 12, true), [0, hy - 0.08 + i * 0.09, hz - 0.1], [0.285 - i * 0.03, 0.03, 0.255 - i * 0.03]);
  k.lineless = false;
  for (const sd of [1, -1]) {
    k.color(stripe).add(T.box(), [sd * 0.21, hy - 0.2, hz + 0.02], [0.1, 0.34, 0.06], [0.15, 0, -0.08 * sd]);
    k.lineless = true;
    for (let i = 0; i < 3; i++) k.color(gold).add(T.box(), [sd * 0.21, hy - 0.09 - i * 0.1, hz + 0.055], [0.105, 0.03, 0.01], [0.15, 0, -0.08 * sd]);
    k.lineless = false;
  }
  k.color(gold).add(T.box(), [0, hy + 0.13, hz + 0.165], [0.3, 0.045, 0.04], [-0.5, 0, 0]);
  k.color('#3fc8d8', 0.35).add(T.octa(), [0, hy + 0.14, hz + 0.2], [0.045, 0.055, 0.025]);
  k.lineless = true;
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    k.color(gold).add(T.box(), [Math.sin(a) * 0.12, hy + 0.205, hz - 0.1 + Math.cos(a) * 0.1], [0.03, 0.012, 0.2], [0.35 * Math.cos(a), a, 0]);
  }
  k.lineless = false;
  k.color(gold).add(T.cone(6), [0, hy + 0.28, hz - 0.12], [0.05, 0.12, 0.05]);
  k.pop();
  meta.height = 1.3; meta.radius = 0.5; meta.tip = [0, hy - 0.1, hz + 0.3];
}

/** Captain Clawsworth: a giant crab in a captain's hat, huge claws, eye stalks, six little legs. */
function crabKing(k, s, meta) {
  const body = s.body, belly = s.belly, hat = s.accent;
  // six legs (3 per side), alternating leg parts
  for (let i = 0; i < 3; i++) {
    for (const side of [1, -1]) {
      const z = 0.12 - i * 0.16;
      const p = (i + (side > 0 ? 0 : 1)) % 2 ? 3 : 2;
      k.part(p, 0.3 * side, 0.25, z);
      k.push().tf(0.32 * side, 0.26, z, 0, 0.25 * (i - 1) * side, -0.9 * side);
      k.color(mul(body, 0.92)).add(T.capsule(2, 5), [0, 0.12, 0], [0.05, 0.08, 0.05]);
      k.pop();
      k.color(mul(body, 0.85)).add(T.cone(5), [0.5 * side, 0.1, z + 0.02 * (i - 1)], [0.04, 0.2, 0.04], [0, 0, -0.2 * side]);
    }
  }
  k.part(0);
  k.color(body).add(T.sphere(12, 8), [0, 0.36, 0], [0.46, 0.24, 0.36]);
  k.color(belly).add(T.sphere(10, 6), [0, 0.26, 0.06], [0.38, 0.14, 0.28]);
  k.lineless = true;
  for (const [x, z, r] of [[0.2, -0.05, 0.05], [-0.22, -0.02, 0.055], [0.05, -0.18, 0.045], [-0.08, 0.1, 0.04], [0.27, 0.12, 0.035]]) {
    k.color(lighten(body, 0.25)).add(T.sphere(5, 3), [x, 0.56 - Math.abs(x) * 0.3, z], [r, r * 0.4, r]);
  }
  k.color(mul(body, 0.7)).add(T.torus(0.2, 3, 10, Math.PI), [0, 0.32, 0.35], [0.1, 0.06, 0.04], [0, 0, Math.PI]);
  k.lineless = false;
  // head part 1: eye stalks, mustache, big claws, the hat
  k.part(1, 0, 0.45, 0.25);
  for (const side of [1, -1]) {
    k.color(mul(body, 0.95)).add(T.cyl(0.8, 1, 6), [0.11 * side, 0.62, 0.22], [0.035, 0.24, 0.035], [0.2, 0, -0.15 * side]);
    k.color('#ffffff').add(T.sphere(8, 6), [0.13 * side, 0.76, 0.25], [0.075, 0.08, 0.07]);
    k.lineless = true;
    k.color(s.eye).add(T.sphere(6, 4), [0.13 * side, 0.755, 0.31], [0.04, 0.05, 0.03]);
    k.color('#ffffff', 1).add(T.octa(), [0.13 * side + 0.015, 0.78, 0.335], 0.012);
    k.lineless = false;
  }
  // a curly mustache (very captain)
  for (const side of [1, -1]) {
    k.color('#f6f0e6').add(T.torus(0.35, 4, 10, Math.PI * 1.2), [0.07 * side, 0.43, 0.37], [0.06, 0.05, 0.05], [0, 0, side > 0 ? 0.2 : Math.PI - 0.2]);
  }
  for (const side of [1, -1]) {
    const x0 = 0.42 * side;
    k.color(mul(body, 0.95)).add(T.capsule(1.6, 6), [0.36 * side, 0.36, 0.22], [0.09, 0.09, 0.09], [Math.PI / 2 - 0.4, 0, -0.6 * side]);
    k.push().tf(x0, 0.42, 0.42, 0.35, -0.3 * side, 0);
    k.color(body).add(T.sphere(10, 7), [0, 0, 0], [0.17, 0.15, 0.22]);
    k.color(lighten(body, 0.15)).add(T.cone(7), [0.06 * side, 0.08, 0.25], [0.08, 0.3, 0.06], [Math.PI / 2 - 0.45, 0, 0]);
    k.color(mul(body, 0.9)).add(T.cone(7), [-0.04 * side, -0.09, 0.22], [0.065, 0.24, 0.05], [Math.PI / 2 + 0.5, 0, 0]);
    k.lineless = true;
    k.color(mul(body, 0.55)).add(T.cone(5), [0.06 * side, 0.155, 0.385], [0.025, 0.06, 0.02], [Math.PI / 2 - 0.45, 0, 0]);
    k.color(mul(body, 0.55)).add(T.cone(5), [-0.04 * side, -0.17, 0.33], [0.022, 0.05, 0.018], [Math.PI / 2 + 0.5, 0, 0]);
    k.lineless = false;
    k.lineless = true;
    for (let i = 0; i < 3; i++) k.color(lighten(body, 0.35)).add(T.sphere(4, 3), [(0.05 - i * 0.03) * side, 0.1, 0.08 + i * 0.06], 0.02);
    k.lineless = false;
    k.pop();
  }
  // captain's bicorne: a wide navy half-moon with gold trim and an anchor badge
  k.push().tf(0, 0.62, 0.0, -0.15, 0, 0);
  k.color(hat).add(T.sphere(12, 6), [0, 0.06, 0], [0.34, 0.16, 0.13]);
  k.color(mul(hat, 0.85)).add(T.cyl(1, 1, 12), [0, 0.0, 0], [0.33, 0.04, 0.15]);
  k.lineless = true;
  k.color(GOLD).add(T.torus(0.06, 3, 18, Math.PI), [0, 0.0, 0.0], [0.34, 0.2, 0.9]);
  k.lineless = false;
  k.color('#ffffff').add(T.cyl(1, 1, 10), [0, 0.1, 0.12], [0.07, 0.02, 0.07], [Math.PI / 2, 0, 0]);
  k.lineless = true;
  k.color(GOLD).add(T.box(), [0, 0.1, 0.135], [0.015, 0.08, 0.01]);
  k.color(GOLD).add(T.torus(0.25, 3, 8, Math.PI), [0, 0.085, 0.135], [0.03, 0.03, 0.02], [0, 0, Math.PI]);
  k.color(GOLD).add(T.box(), [0, 0.13, 0.135], [0.05, 0.012, 0.01]);
  k.lineless = false;
  k.color('#ff6b6b').add(T.sphere(6, 4), [0.3, 0.08, 0.02], [0.05, 0.08, 0.05]);
  k.pop();
  meta.height = 0.95; meta.radius = 0.55; meta.tip = [0.42, 0.42, 0.6];
}

/** Grumbleflake: a huge fluffy grumpy yeti with white-blue fur, little ice horns and big hands. */
function yeti(k, s, meta) {
  const fur = s.body, fur2 = s.belly, skin = s.accent;
  const tuft = (x, y, z, r, col) => k.color(col).add(T.sphere(7, 5), [x, y, z], [r, r * 0.9, r]);
  // legs: short and furry with big pale feet
  for (const side of [1, -1]) {
    k.part(side > 0 ? 2 : 3, 0.17 * side, 0.32, 0);
    k.color(mul(fur, 0.95)).add(T.sphere(8, 6), [0.17 * side, 0.2, 0], [0.15, 0.2, 0.15]);
    k.color(skin).add(T.sphere(8, 5), [0.18 * side, 0.05, 0.06], [0.14, 0.06, 0.2]);
    k.lineless = true;
    for (const t of [-1, 0, 1]) k.color(mul(skin, 0.8)).add(T.sphere(4, 3), [0.18 * side + t * 0.05, 0.06, 0.25], 0.03);
    k.lineless = false;
  }
  k.part(0);
  k.color(fur).add(T.sphere(12, 9), [0, 0.62, 0], [0.42, 0.42, 0.36]);
  k.color(fur2).add(T.sphere(10, 7), [0, 0.55, 0.16], [0.28, 0.3, 0.22]);
  const tufts = [[0.32, 0.86, -0.05, 0.14], [-0.33, 0.84, -0.04, 0.14], [0.36, 0.5, 0.02, 0.12], [-0.37, 0.52, 0.0, 0.12],
    [0.2, 0.3, 0.14, 0.11], [-0.2, 0.3, 0.13, 0.11], [0, 0.98, -0.15, 0.16], [0.18, 0.62, -0.28, 0.13], [-0.16, 0.66, -0.3, 0.13]];
  tufts.forEach(([x, y, z, r], i) => tuft(x, y, z, r, i % 3 === 2 ? fur2 : fur));
  k.lineless = true;
  for (const [x, y, z] of [[0.12, 0.7, 0.35], [-0.18, 0.45, 0.34], [0.22, 0.4, 0.3]]) k.color(mix(fur2, skin, 0.4)).add(T.cone(4), [x, y, z], [0.03, 0.08, 0.02], [0.2, 0, 0.3]);
  k.lineless = false;
  // arms (4 / 5): long and furry, big pale hands
  for (const side of [1, -1]) {
    k.part(side > 0 ? 4 : 5, 0.4 * side, 0.82, 0);
    k.color(fur).add(T.sphere(8, 6), [0.44 * side, 0.8, 0], [0.16, 0.16, 0.16]);
    k.color(mul(fur, 0.96)).add(T.capsule(1.4, 7), [0.48 * side, 0.52, 0.03], [0.17, 0.2, 0.17]);
    tuft(0.56 * side, 0.6, 0.0, 0.08, fur2);
    k.color(skin).add(T.sphere(8, 6), [0.5 * side, 0.27, 0.06], [0.13, 0.12, 0.14]);
    k.lineless = true;
    for (const t of [-1, 0, 1]) k.color(mul(skin, 0.85)).add(T.sphere(4, 3), [0.5 * side + t * 0.045, 0.2, 0.18], 0.035);
    k.lineless = false;
  }
  // head (part 1): fur crown, blue-grey face patch, grumpy brows, frown, tiny ice horns
  k.part(1, 0, 1.0, 0.05);
  const hy = 1.12, hz = 0.12;
  k.color(fur).add(T.sphere(10, 8), [0, hy, hz - 0.04], [0.27, 0.25, 0.24]);
  tuft(0, hy + 0.2, hz - 0.08, 0.12, fur);
  tuft(0.16, hy + 0.14, hz - 0.12, 0.09, fur2);
  tuft(-0.16, hy + 0.15, hz - 0.12, 0.09, fur);
  k.push().tf(0, hy, hz + 0.1, -0.35, 0, 0).tf(0, -hy, -hz - 0.1);
  k.color(skin).add(T.sphere(10, 7), [0, hy - 0.02, hz + 0.12], [0.18, 0.15, 0.08]);
  eyes(k, 0, hy + 0.01, hz + 0.19, 0.035, s.eye, 0.075);
  k.lineless = true;
  for (const sd of [1, -1]) k.color(mul(skin, 0.45)).add(T.box(), [sd * 0.075, hy + 0.075, hz + 0.21], [0.1, 0.028, 0.02], [0, 0, 0.45 * sd]);
  k.color(mul(skin, 0.6)).add(T.sphere(6, 4), [0, hy - 0.04, hz + 0.21], [0.04, 0.03, 0.02]);
  k.color('#3a3a5a').add(T.torus(0.3, 4, 8, Math.PI), [0, hy - 0.12, hz + 0.19], [0.05, 0.035, 0.02]);
  k.color('#ffffff').add(T.cone(4), [0.03, hy - 0.11, hz + 0.2], [0.015, 0.03, 0.01], [Math.PI, 0, 0]);
  k.lineless = false;
  k.pop();
  for (const side of [1, -1]) {
    k.push().tf(0.17 * side, hy + 0.17, hz - 0.04, -0.2, 0, -0.55 * side);
    k.color(mix('#bfeeff', skin, 0.2), 0.25).add(T.cone(6), [0, 0.07, 0], [0.045, 0.16, 0.045]);
    k.pop();
  }
  meta.height = 1.4; meta.radius = 0.55; meta.tip = [0.5, 0.27, 0.2]; meta.glowEyes = false;
}

export const BOSS_BUILDERS = { sphinx, crab_king: crabKing, yeti };
