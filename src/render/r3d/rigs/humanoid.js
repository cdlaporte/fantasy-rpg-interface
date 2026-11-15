// Humanoid rig builder (CONTRACTS section 6). Chibi proportions: big round head, short torso, stubby limbs.
// Model space: tiles, y up, facing +Z, feet at y = 0, height ~1.1 at size 1 (size is applied by the instance).
// Parts: 0 body, 1 head (+hair, hat), 2/3 legs, 4 left arm (+X, shield / off-hand), 5 right arm (-X, weapon), 6 cape.
import * as THREE from 'three';
import { Kit, T, C, tpl, mul, mix, lighten, darken } from '../kit.js';
import { LAPORTE } from '../../../data/palettes.js';

const OUTFITS = ['tunic', 'robe', 'cloak', 'plate', 'leather', 'gi', 'quarterzip', 'dress', 'apron', 'uniform', 'vest'];
const HAIRS = ['short', 'long', 'bun', 'ponytail', 'curly', 'spiky', 'bald', 'braids', 'm_hairline'];
const FACIALS = ['none', 'goatee', 'beard', 'mustache'];
const HATS = ['wizard', 'cap', 'crown', 'bandana', 'helm', 'straw', 'chef', 'feather', 'horned', 'circlet'];
const HELDS = ['stick', 'sword', 'sword_shield', 'axes', 'runeblade', 'staff', 'orb', 'wand', 'fists', 'daggers', 'bow',
  'shuriken', 'spear', 'book', 'broom', 'lantern'];
const AURAS = ['glow', 'flame', 'sparkle', 'shadow', 'frost', 'storm'];

const HEAD_Y = 0.84, HEAD_R = 0.24;
const EYE = '#2a2030';

function pick(v, list, def, unknown, what) {
  if (v == null) return def;
  if (list.includes(v)) return v;
  unknown.add(what + ':' + v);
  return def;
}

/** Normalize a humanoid look into a full spec, recording unknown values. */
export function humanoidSpec(look, unknown) {
  const L = look || {};
  const hair = L.hair || {};
  const outfit = L.outfit || {};
  const s = {
    build: L.build === 'b' ? 'b' : 'a',
    skin: L.skin || '#c68e62',
    hairStyle: pick(hair.style, HAIRS, 'short', unknown, 'hair'),
    hairColor: hair.color || '#3a2618',
    facial: pick(L.facial, FACIALS, 'none', unknown, 'facial'),
    outfit: pick(outfit.style, OUTFITS, 'tunic', unknown, 'outfit'),
    primary: outfit.primary || '#4a90d9',
    secondary: outfit.secondary || '#f4e3c4',
    accent: outfit.accent || '#ffd24a',
    hood: !!L.hood,
    hat: L.hat ? { style: pick(L.hat.style, HATS, 'cap', unknown, 'hat'), color: L.hat.color || '#c8503c' } : null,
    cape: L.cape ? { color: L.cape.color || '#c8503c' } : null,
    held: L.held ? { style: pick(L.held.style, HELDS, 'stick', unknown, 'held'), color: L.held.color || '#b0b8c8', glow: L.held.glow || null } : null,
    aura: L.aura ? { style: pick(L.aura.style, AURAS, 'glow', unknown, 'aura'), color: L.aura.color || '#ffe680' } : null,
    ears: L.ears === 'pointed' ? 'pointed' : 'round',
    hero: L.hero === 'laporte' || L.hero === 'malgrim' ? L.hero : null,
  };
  if (L.ears && L.ears !== 'round' && L.ears !== 'pointed') unknown.add('ears:' + L.ears);
  if (L.build && L.build !== 'a' && L.build !== 'b') unknown.add('build:' + L.build);
  if (L.hero && !s.hero) unknown.add('hero:' + L.hero);
  if (s.hero === 'laporte') {
    if (!s.cape) s.cape = { color: '#7a2638' };
    if (!s.held) s.held = { style: 'staff', color: '#8a5a33', glow: '#ffe680' };
    if (s.facial === 'none') s.facial = 'goatee';
  }
  if (s.hero === 'malgrim') {
    if (!s.hat) s.hat = { style: 'wizard', color: darken(s.primary, 0.15) };
    if (!s.cape) s.cape = { color: s.secondary };
    if (!s.held) s.held = { style: 'staff', color: '#3a2a4a', glow: s.accent };
    if (s.facial === 'none') s.facial = 'mustache';
  }
  return s;
}

// ---------------------------------------------------------------------------------------------

function pants(s) {
  switch (s.outfit) {
    case 'gi': return s.secondary;
    case 'quarterzip': return s.hero === 'laporte' ? LAPORTE.pants : '#3b3b58';
    case 'plate': return mix(s.primary, '#555566', 0.5);
    case 'leather': return mul(s.secondary, 0.8);
    case 'uniform': return '#3a3a52';
    default: return mix(s.secondary, '#5a4a3a', 0.55);
  }
}

function sleeveColor(s) {
  if (s.outfit === 'vest') return s.skin;
  if (s.outfit === 'apron') return s.secondary;
  return s.primary;
}

/** Build a humanoid model. Returns {geo, meta}. */
export function buildHumanoid(look, unknown) {
  const s = humanoidSpec(look, unknown);
  const k = new Kit({ skin: true });
  const broad = s.build === 'a';
  const sw = broad ? 0.205 : 0.185;          // shoulder x
  const tw = broad ? 0.39 : 0.34;            // torso width
  const skin = C(s.skin);
  const tall = s.hero === 'malgrim' ? 1.08 : 1;
  const meta = { tip: [-sw - 0.02, 0.3, 0.1], glowAt: null, height: 1.12 * tall, headY: HEAD_Y, hero: s.hero, aura: s.aura, s };
  k.grad = [0.88, 1.06];

  // ---- legs (parts 2/3) ----
  const shoe = s.hero === 'laporte' ? LAPORTE.shoes : (s.outfit === 'plate' ? mix(s.primary, '#333344', 0.4) : '#5a3a28');
  const pc = pants(s);
  for (const side of [1, -1]) {
    const px = 0.085 * side;
    k.part(side > 0 ? 2 : 3, px, 0.27, 0);
    k.color(pc).add(T.cyl(1, 0.85, 6, true), [px, 0.17, 0], [0.068, 0.2, 0.068]);
    k.color(shoe).add(T.rbox(0.45, 8, 4), [px, 0.045, 0.025], [0.12, 0.085, 0.17]);
    if (s.outfit === 'plate') k.color(mix(s.primary, '#ffffff', 0.15)).add(T.sphere(8, 6), [px, 0.2, 0.05], [0.06, 0.05, 0.045]);
  }

  // ---- torso (part 0) ----
  k.part(0, 0, 0, 0);
  buildTorso(k, s, tw, sw);

  // ---- cape (part 6) ----
  if (s.cape) {
    k.part(6, 0, 0.6, -0.11);
    const cc = C(s.cape.color);
    const capeLen = s.outfit === 'robe' || s.hero ? 0.56 : 0.48;
    k.color(cc).add(T.cyl(0.7, 1, 10, false), [0, 0.6 - capeLen / 2, -0.19], [tw * 0.62, capeLen, 0.07], [0.16, 0, 0]);
    k.lineless = true;
    k.color(mul(cc, 0.75)).add(T.torus(0.3, 4, 8), [0, 0.6, -0.11], [tw * 0.5, 0.11, 0.08], [Math.PI / 2, 0, 0]);
    if (s.hero === 'laporte') {
      k.color('#ffd24a').add(T.cyl(1, 1, 10), [0, 0.6 - capeLen + 0.03, -0.2], [tw * 0.62 + 0.012, 0.035, 0.08], [0.16, 0, 0]);
    }
    k.lineless = false;
  }

  // ---- arms (parts 4 left +X, 5 right -X) ----
  const sl = C(sleeveColor(s));
  for (const side of [1, -1]) {
    const ax = sw * side;
    k.part(side > 0 ? 4 : 5, ax, 0.55, 0);
    const wide = s.outfit === 'robe' || (s.hero === 'malgrim');
    if (s.outfit === 'quarterzip') {
      k.color(sl).add(T.capsule(1.2, 6), [ax + 0.015 * side, 0.44, 0], [0.11, 0.11, 0.11]);
      k.lineless = true;
      k.color(s.hero === 'laporte' ? LAPORTE.quarterZipGray[0] : s.secondary).add(T.cyl(1, 1, 7), [ax + 0.017 * side, 0.43, 0], [0.058, 0.03, 0.058]);
      k.lineless = false;
    } else if (wide) {
      k.color(sl).add(T.cyl(0.55, 1, 8), [ax + 0.02 * side, 0.43, 0], [0.085, 0.22, 0.085], [0, 0, 0.12 * side]);
      k.lineless = true;
      k.color(s.accent).add(T.torus(0.3, 4, 8), [ax + 0.035 * side, 0.32, 0], [0.08, 0.08, 0.08], [Math.PI / 2, 0, 0]);
      k.lineless = false;
    } else {
      k.color(sl).add(T.capsule(1.2, 6), [ax + 0.015 * side, 0.44, 0], [0.11, 0.11, 0.11]);
      if (s.outfit === 'plate') k.color(mix(s.primary, '#ffffff', 0.25)).add(T.sphere(8, 6), [ax + 0.01 * side, 0.55, 0], [0.095, 0.08, 0.1]);
      if (s.outfit === 'gi' || s.outfit === 'leather') { k.lineless = true; k.color(s.accent).add(T.cyl(1, 1, 7), [ax + 0.017 * side, 0.36, 0], [0.058, 0.035, 0.058]); k.lineless = false; }
    }
    const fist = s.held && s.held.style === 'fists';
    k.color(fist ? C(s.held.color) : skin).add(T.sphere(6, 4), [ax + 0.018 * side, 0.31, 0.01], fist ? 0.078 : 0.058);
    if (fist && s.held.glow) {
      k.lineless = true;
      k.color(s.held.glow, 1).add(T.torus(0.3, 4, 10), [ax + 0.018 * side, 0.33, 0.01], [0.07, 0.07, 0.07], [Math.PI / 2, 0, 0]);
      k.lineless = false;
    }
  }
  if (s.held) buildHeld(k, s, sw, meta);

  // ---- head (part 1) ----
  k.part(1, 0, 0.6, 0);
  // tilt the whole head back so the face reads from the high camera
  k.push().tf(0, 0.6, 0, -0.36, 0, 0).tf(0, -0.6, 0);
  buildHead(k, s, meta);
  k.pop();
  k.grad = null;
  return { geo: k.build(), meta };
}

function buildTorso(k, s, tw, sw) {
  const P = C(s.primary), S2 = C(s.secondary), A = C(s.accent);
  const neckSkin = C(s.skin);
  switch (s.outfit) {
    case 'quarterzip': {
      const lap = s.hero === 'laporte';
      const navy = lap ? LAPORTE.quarterZipNavy[0] : s.primary;
      const gray = lap ? LAPORTE.quarterZipGray[0] : s.secondary;
      const collar = lap ? LAPORTE.collar : s.accent;
      // horizontal stripes: navy body with gray bands
      const bands = [navy, gray, navy, gray, navy];
      const y0 = 0.25, bh = 0.064;
      for (let i = 0; i < bands.length; i++) {
        const r0 = 1 - Math.abs(i - 2.2) * 0.05;
        k.color(bands[i]).add(T.cyl(0.97, 1, 12), [0, y0 + bh * (i + 0.5), 0], [tw * 0.5 * r0, bh + 0.002, 0.14 * r0]);
      }
      k.color(navy).add(T.dome(12, 4), [0, y0 + bh * 5, 0], [tw * 0.47, 0.06, 0.13]);
      // collar + zipper + undershirt peek
      k.lineless = true;
      k.color(collar).add(T.cyl(0.9, 1, 12, false), [0, 0.6, 0], [0.11, 0.07, 0.09]);
      k.color(lap ? LAPORTE.undershirt : '#ecf0f1').add(T.sphere(6, 4), [0, 0.6, 0.075], [0.035, 0.035, 0.02]);
      k.color('#d8dce0').add(T.box(), [0, 0.47, 0.145], [0.012, 0.2, 0.012]);
      k.color('#e8eaee').add(T.box(), [0, 0.565, 0.152], [0.03, 0.035, 0.012]);
      k.lineless = false;
      break;
    }
    case 'robe':
    case 'cloak': {
      const robe = s.outfit === 'robe';
      const bottom = robe ? 0.02 : 0.1;
      const h = 0.6 - bottom;
      k.color(P).add(T.cyl(0.55, 1, 12), [0, bottom + h / 2, 0], [tw * 0.68, h, 0.22]);
      k.lineless = true;
      k.color(robe ? A : S2).add(T.cyl(1, 1, 10), [0, bottom + 0.02, 0], [tw * 0.68 + 0.01, 0.04, 0.225]);
      if (robe) {
        k.color(S2).add(T.cyl(1, 1, 12), [0, 0.36, 0], [tw * 0.47, 0.045, 0.165]);
        k.color(A).add(T.box(), [0, 0.3, 0.14], [0.05, 0.12, 0.02], [0.35, 0, 0]);
        k.color(S2).add(T.cyl(0.8, 1, 10, false), [0, 0.6, 0], [0.12, 0.06, 0.1]);
      } else {
        k.color(S2).add(T.torus(0.4, 5, 12), [0, 0.6, 0], [0.13, 0.13, 0.1], [Math.PI / 2, 0, 0]);
        k.color(A).add(T.sphere(6, 5), [0, 0.57, 0.12], 0.03);
      }
      k.lineless = false;
      break;
    }
    case 'dress': {
      k.color(P).add(T.cyl(0.85, 1, 10), [0, 0.5, 0], [tw * 0.45, 0.2, 0.14]);
      k.color(P).add(T.cyl(0.5, 1, 12), [0, 0.25, 0], [tw * 0.7, 0.3, 0.24]);
      k.lineless = true;
      k.color(A).add(T.cyl(1, 1, 12), [0, 0.39, 0], [tw * 0.4, 0.04, 0.13]);
      k.color(S2).add(T.cyl(1, 1, 12), [0, 0.11, 0], [tw * 0.7, 0.03, 0.24]);
      k.color(S2).add(T.cyl(0.8, 1, 10, false), [0, 0.6, 0], [0.1, 0.04, 0.085]);
      k.lineless = false;
      break;
    }
    default: {
      // shared rounded torso
      const torsoC = s.outfit === 'apron' ? S2 : (s.outfit === 'vest' ? S2 : P);
      k.color(torsoC).add(T.rbox(0.55), [0, 0.42, 0], [tw, 0.36, 0.27]);
      k.lineless = true;
      if (s.outfit === 'tunic') {
        k.color(P).add(T.cyl(0.8, 1, 10), [0, 0.23, 0], [tw * 0.56, 0.12, 0.16]);
        k.color(mix(S2, '#6a4a30', 0.6)).add(T.cyl(1, 1, 10), [0, 0.3, 0], [tw * 0.52, 0.045, 0.145]);
        k.color(A).add(T.rbox(0.5), [0, 0.3, 0.14], [0.05, 0.045, 0.02]);
        k.color(S2).add(T.cyl(0.9, 1, 10, false), [0, 0.6, 0], [0.1, 0.035, 0.085]);
      } else if (s.outfit === 'plate') {
        k.color(lighten(P, 0.2)).add(T.rbox(0.6), [0, 0.45, 0.025], [tw * 0.9, 0.26, 0.26]);
        k.color(A).add(T.box(), [0, 0.45, 0.155], [0.04, 0.2, 0.02]);
        k.color(S2).add(T.cyl(1, 1, 10), [0, 0.28, 0], [tw * 0.52, 0.05, 0.145]);
        k.color(mix(P, '#333344', 0.3)).add(T.cyl(0.8, 1, 10), [0, 0.21, 0], [tw * 0.55, 0.09, 0.15]);
      } else if (s.outfit === 'leather') {
        k.color(S2).add(T.box(), [0, 0.43, 0.13], [0.04, 0.38, 0.02], [0, 0, 0.75]);
        k.color(mix(S2, '#000000', 0.2)).add(T.cyl(1, 1, 10), [0, 0.29, 0], [tw * 0.52, 0.045, 0.145]);
        k.color(A).add(T.rbox(0.5), [0.07, 0.27, 0.13], [0.06, 0.06, 0.04]);
        k.color(P).add(T.cyl(0.8, 1, 10), [0, 0.22, 0], [tw * 0.55, 0.09, 0.15]);
      } else if (s.outfit === 'gi') {
        k.color(lighten(P, 0.15)).add(T.box(), [0.03, 0.47, 0.135], [0.035, 0.24, 0.02], [0, 0, -0.5]);
        k.color(lighten(P, 0.15)).add(T.box(), [-0.03, 0.47, 0.135], [0.035, 0.24, 0.02], [0, 0, 0.5]);
        k.color(A).add(T.cyl(1, 1, 10), [0, 0.3, 0], [tw * 0.53, 0.06, 0.15]);
        k.color(A).add(T.rbox(0.5), [0.08, 0.24, 0.14], [0.04, 0.1, 0.02], [0, 0, 0.2]);
        k.color(S2).add(T.cyl(0.75, 1, 10), [0, 0.22, 0], [tw * 0.56, 0.1, 0.16]);
      } else if (s.outfit === 'apron') {
        k.color(P).add(T.rbox(0.4), [0, 0.32, 0.13], [tw * 0.72, 0.42, 0.03]);
        k.color(P).add(T.box(), [0.08, 0.53, 0.1], [0.025, 0.1, 0.02]);
        k.color(P).add(T.box(), [-0.08, 0.53, 0.1], [0.025, 0.1, 0.02]);
        k.color(A).add(T.rbox(0.5), [0, 0.3, 0.15], [0.12, 0.06, 0.015]);
      } else if (s.outfit === 'uniform') {
        k.color('#f4f4f4').add(T.box(), [0, 0.5, 0.13], [0.1, 0.14, 0.02]);
        k.color(A).add(T.box(), [0, 0.47, 0.142], [0.035, 0.14, 0.015]);
        k.color(S2).add(T.box(), [0.06, 0.55, 0.13], [0.06, 0.05, 0.02], [0, 0, 0.5]);
        k.color(S2).add(T.box(), [-0.06, 0.55, 0.13], [0.06, 0.05, 0.02], [0, 0, -0.5]);
        k.color('#ffd24a').add(T.sphere(5, 4), [0.07, 0.4, 0.14], 0.016).add(T.sphere(5, 4), [0.07, 0.33, 0.14], 0.016);
        k.color(P).add(T.cyl(0.85, 1, 10), [0, 0.23, 0], [tw * 0.54, 0.1, 0.15]);
      } else if (s.outfit === 'vest') {
        k.color(P).add(T.rbox(0.5), [0.1, 0.43, 0.02], [0.13, 0.34, 0.27]);
        k.color(P).add(T.rbox(0.5), [-0.1, 0.43, 0.02], [0.13, 0.34, 0.27]);
        k.color(P).add(T.rbox(0.5), [0, 0.43, -0.05], [tw, 0.34, 0.15]);
        k.color(A).add(T.cyl(1, 1, 10), [0, 0.28, 0], [tw * 0.53, 0.05, 0.15]);
        k.color(neckSkin).add(T.box(), [0, 0.48, 0.135], [0.06, 0.18, 0.01]);
      }
      k.lineless = false;
    }
  }
  if (s.hero === 'malgrim') {
    // theatrical high collar and spiky pauldrons
    k.color(s.cape ? s.cape.color : s.secondary).add(T.cyl(1.25, 0.7, 8, true), [0, 0.7, -0.05], [0.2, 0.2, 0.15], [-0.25, 0, 0]);
    k.color(s.accent).add(T.cone(5), [sw + 0.02, 0.63, 0], [0.05, 0.1, 0.05], [0, 0, -0.5]);
    k.color(s.accent).add(T.cone(5), [-sw - 0.02, 0.63, 0], [0.05, 0.1, 0.05], [0, 0, 0.5]);
    k.color('#ffd24a', 0.4).add(T.octa(), [0, 0.56, 0.12], [0.035, 0.045, 0.02]);
  }
  // quiver for bows (on the back)
  if (s.held && s.held.style === 'bow') {
    k.color('#8a5a33').add(T.cyl(1, 1, 7), [0.06, 0.45, -0.16], [0.05, 0.3, 0.05], [0.25, 0, -0.35]);
    k.color('#f4f4f4').add(T.cone(4), [0.12, 0.64, -0.2], [0.03, 0.06, 0.02], [0.25, 0, -0.35]);
    k.color(s.accent).add(T.cone(4), [0.08, 0.65, -0.21], [0.03, 0.06, 0.02], [0.25, 0, -0.35]);
  }
}

function buildHead(k, s, meta) {
  const skin = C(s.skin);
  const hood = s.hood;
  const hy = HEAD_Y;
  // neck
  k.lineless = true;
  k.color(mul(skin, 0.9)).add(T.cyl(1, 1, 6), [0, 0.62, 0], [0.07, 0.08, 0.07]);
  k.lineless = false;
  k.color(hood ? mul(skin, 0.42) : skin).add(T.sphere(12, 9), [0, hy, 0], [HEAD_R * 1.04, HEAD_R * 0.96, HEAD_R]);
  // ears
  if (!hood) {
    for (const side of [1, -1]) {
      if (s.ears === 'pointed') k.color(skin).add(T.cone(5), [0.255 * side, hy + 0.03, -0.01], [0.04, 0.13, 0.03], [0, 0, -1.15 * side]);
      else k.color(skin).add(T.sphere(5, 3), [0.24 * side, hy - 0.01, 0], [0.04, 0.055, 0.035]);
    }
  }
  // face (no outlines on tiny facial bits)
  k.lineless = true;
  const ez = HEAD_R * 0.9;
  if (hood) {
    k.color('#fff6c8', 0.9).add(T.sphere(6, 5), [0.075, hy - 0.01, ez + 0.01], [0.03, 0.022, 0.01]);
    k.color('#fff6c8', 0.9).add(T.sphere(6, 5), [-0.075, hy - 0.01, ez + 0.01], [0.03, 0.022, 0.01]);
  } else {
    const villain = s.hero === 'malgrim';
    for (const side of [1, -1]) {
      k.color(EYE).add(T.sphere(6, 4), [0.082 * side, hy - 0.015, ez], [0.03, villain ? 0.035 : 0.045, 0.02]);
      k.color('#ffffff', 1).add(T.octa(), [0.082 * side + 0.01, hy + 0.005, ez + 0.017], 0.012);
      k.color(mix(skin, '#ff7a8a', 0.45)).add(T.sphere(5, 3), [0.135 * side, hy - 0.07, ez - 0.03], [0.035, 0.018, 0.012]);
      // brows
      const bc = darken(s.hairColor, 0.1);
      if (villain) k.color('#2a1a2a').add(T.box(), [0.08 * side, hy + 0.045, ez + 0.005], [0.07, 0.018, 0.015], [0, 0, -0.45 * side]);
      else if (s.hero === 'laporte') k.color(bc).add(T.box(), [0.08 * side, hy + 0.05, ez - 0.005], [0.06, 0.014, 0.015], [0, 0, 0.05 * side]);
    }
    k.color(mul(skin, 0.92)).add(T.sphere(5, 3), [0, hy - 0.04, ez + 0.015], [0.022, 0.02, 0.015]);
    k.color('#8a3a3a').add(T.box(), [0, hy - 0.095, ez - 0.005], [0.045, 0.012, 0.01]);
  }
  k.lineless = false;
  // facial hair
  if (!hood && s.facial !== 'none') {
    const fc = s.hero === 'laporte' ? C(LAPORTE.stubble[0]) : (s.hero === 'malgrim' ? C('#2a1a2a') : darken(s.hairColor, 0.05));
    if (s.facial === 'goatee') {
      k.color(fc).add(T.sphere(8, 6), [0, hy - 0.15, ez - 0.035], [0.07, 0.05, 0.04]);
      k.lineless = true;
      k.color(fc).add(T.box(), [0, hy - 0.075, ez + 0.005], [0.09, 0.016, 0.015]);
      k.color(fc).add(T.box(), [0.045, hy - 0.105, ez - 0.002], [0.016, 0.05, 0.015]);
      k.color(fc).add(T.box(), [-0.045, hy - 0.105, ez - 0.002], [0.016, 0.05, 0.015]);
      k.lineless = false;
    } else if (s.facial === 'beard') {
      k.color(fc).add(T.sphere(10, 7), [0, hy - 0.12, 0.08], [0.2, 0.13, 0.16]);
      k.color(fc).add(T.box(), [0, hy - 0.07, ez + 0.01], [0.1, 0.022, 0.02]);
    } else if (s.facial === 'mustache') {
      for (const side of [1, -1]) {
        k.color(fc).add(T.capsule(1.6, 6), [0.045 * side, hy - 0.07, ez + 0.01], [0.04, 0.04, 0.035], [0, 0, 1.25 * side]);
        if (s.hero === 'malgrim') k.color(fc).add(T.torus(0.35, 4, 8, Math.PI), [0.11 * side, hy - 0.05, ez - 0.01], [0.03, 0.03, 0.03], [0, 0, side > 0 ? 0 : Math.PI]);
      }
      if (s.hero === 'malgrim') k.color(fc).add(T.cone(6), [0, hy - 0.19, ez - 0.04], [0.035, 0.1, 0.03], [Math.PI, 0, 0]);
    }
  }
  // hair (hidden by the hood)
  if (!hood) buildHair(k, s);
  if (hood) {
    const hc = C(s.primary);
    k.color(hc).add(T.sphere(12, 9), [0, hy + 0.025, -0.04], [0.285, 0.275, 0.275]);
    k.color(mul(hc, 0.92)).add(T.torus(0.32, 6, 14), [0, hy - 0.005, 0.175], [0.2, 0.215, 0.12]);
    k.color(hc).add(T.cone(7), [0, hy + 0.2, -0.24], [0.1, 0.22, 0.1], [-1.9, 0, 0]);
  }
  if (s.hat) buildHat(k, s);
  meta.headTop = hy + 0.3 + (s.hat && (s.hat.style === 'wizard' || s.hat.style === 'chef') ? 0.3 : 0);
}

function buildHair(k, s) {
  const hc = C(s.hairColor);
  const hy = HEAD_Y;
  const cap = (tilt, r = 0.258, theta = 0.56) => k.color(hc).add(
    tpldome(theta), [0, hy + 0.005, -0.012], [r * 1.03, r, r], [tilt, 0, 0]);
  switch (s.hairStyle) {
    case 'bald':
      k.lineless = true;
      k.color('#ffffff', 0.6).add(T.sphere(5, 4), [0.06, hy + 0.2, 0.08], [0.03, 0.015, 0.02]);
      k.lineless = false;
      if (s.facial !== 'none') { /* the beard carries it */ }
      k.color(hc).add(T.sphere(8, 6), [0.215, hy - 0.02, -0.06], [0.04, 0.07, 0.08]).add(T.sphere(8, 6), [-0.215, hy - 0.02, -0.06], [0.04, 0.07, 0.08]);
      break;
    case 'short':
      cap(-0.42);
      k.lineless = true;
      k.color(hc).add(T.sphere(6, 4), [0.06, hy + 0.17, 0.155], [0.09, 0.05, 0.07], [0.5, 0, 0.3]);
      k.color(hc).add(T.sphere(6, 4), [-0.07, hy + 0.16, 0.165], [0.08, 0.045, 0.06], [0.5, 0, -0.2]);
      k.lineless = false;
      break;
    case 'long':
      cap(-0.3);
      k.color(hc).add(T.rbox(0.5), [0, hy - 0.12, -0.13], [0.42, 0.36, 0.14]);
      k.color(hc).add(T.sphere(8, 6), [0.2, hy - 0.08, 0.03], [0.07, 0.16, 0.08]);
      k.color(hc).add(T.sphere(8, 6), [-0.2, hy - 0.08, 0.03], [0.07, 0.16, 0.08]);
      k.lineless = true;
      k.color(hc).add(T.sphere(8, 5), [0, hy + 0.2, 0.13], [0.16, 0.045, 0.07], [0.6, 0, 0]);
      k.lineless = false;
      break;
    case 'bun':
      cap(-0.35);
      k.color(hc).add(T.sphere(9, 7), [0, hy + 0.22, -0.12], 0.1);
      k.color(mul(hc, 0.8)).add(T.torus(0.35, 4, 10), [0, hy + 0.15, -0.09], [0.06, 0.06, 0.06], [-0.6, 0, 0]);
      break;
    case 'ponytail':
      cap(-0.35);
      k.color(mix(hc, '#ff6b8a', 0.5)).add(T.sphere(6, 5), [0, hy + 0.1, -0.245], 0.035);
      k.color(hc).add(T.capsule(2.2, 7), [0, hy - 0.04, -0.29], [0.1, 0.11, 0.09], [0.35, 0, 0]);
      break;
    case 'curly': {
      cap(-0.38, 0.25);
      const n = 15;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const ring = i % 3;
        const el = [0.25, 0.75, 1.15][ring];
        const x = Math.cos(a) * Math.sin(el) * 0.25, y = Math.cos(el) * 0.25, z = Math.sin(a) * Math.sin(el) * 0.25 - 0.03;
        if (z > 0.12 && y < 0.15) continue;
        k.color(i % 2 ? hc : mul(hc, 0.85)).add(T.sphere(7, 5), [x, hy + y + 0.02, z], 0.085);
      }
      break;
    }
    case 'spiky': {
      cap(-0.4);
      const spikes = [[0, 0.27, 0.02, -0.2, 0], [0.12, 0.23, 0.05, -0.3, -0.5], [-0.12, 0.23, 0.05, -0.3, 0.5],
        [0.07, 0.22, -0.15, -0.9, -0.3], [-0.07, 0.22, -0.15, -0.9, 0.3], [0, 0.12, -0.24, -1.5, 0], [0.04, 0.19, 0.17, 0.6, -0.2]];
      for (const [x, y, z, rx, rz] of spikes) k.color(hc).add(T.cone(5), [x, hy + y, z], [0.07, 0.17, 0.07], [rx, 0, rz]);
      break;
    }
    case 'braids':
      cap(-0.36);
      for (const side of [1, -1]) {
        for (let i = 0; i < 4; i++) k.color(i % 2 ? hc : mul(hc, 0.85)).add(T.sphere(7, 5), [0.17 * side, hy - 0.06 - i * 0.075, -0.06 + i * 0.012], 0.048 - i * 0.003);
        k.color(mix(hc, '#ffd24a', 0.6)).add(T.sphere(6, 4), [0.17 * side, hy - 0.37, -0.02], 0.03);
      }
      break;
    case 'm_hairline': {
      // high, receding temples with a central forelock: an M from the front
      cap(-0.78, 0.262, 0.6);
      // widow's peak: a rounded wedge pointing down the middle of the forehead
      k.color(hc).add(T.sphere(9, 6), [0, hy + 0.17, 0.155], [0.075, 0.075, 0.07], [0.7, 0, 0]);
      k.lineless = true;
      k.color(hc).add(T.cone(6), [0, hy + 0.115, 0.205], [0.055, 0.1, 0.03], [Math.PI + 0.6, 0, 0]);
      k.lineless = false;
      k.color(hc).add(T.sphere(8, 6), [0.2, hy + 0.0, -0.05], [0.07, 0.1, 0.1]);
      k.color(hc).add(T.sphere(8, 6), [-0.2, hy + 0.0, -0.05], [0.07, 0.1, 0.1]);
      break;
    }
  }
}

function tpldome(theta) {
  return tpl('hdome' + theta, () => new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI * theta));
}

function buildHat(k, s) {
  const hc = C(s.hat.color);
  const hy = HEAD_Y;
  const top = hy + 0.2;
  switch (s.hat.style) {
    case 'wizard': {
      const tall = s.hero === 'malgrim' ? 1.35 : 1;
      k.color(hc).add(T.cyl(1, 1, 14), [0, top - 0.02, 0], [0.36, 0.03, 0.34], [-0.08, 0, 0]);
      k.color(s.hero === 'malgrim' ? C('#ffd24a') : mul(hc, 0.6)).add(T.cyl(1, 1, 12), [0, top + 0.03, -0.005], [0.205, 0.05, 0.2]);
      k.push().tf(0, top, -0.01, -0.12, 0, 0);
      k.color(hc).add(T.cyl(0.7, 1, 10), [0, 0.1 * tall, 0], [0.2, 0.2 * tall, 0.19]);
      k.tf(0, 0.2 * tall, 0, -0.35, 0, 0.12);
      k.color(hc).add(T.cyl(0.5, 1, 9), [0, 0.09 * tall, 0], [0.14, 0.18 * tall, 0.13]);
      k.tf(0, 0.18 * tall, 0, -0.45, 0, 0.1);
      k.color(hc).add(T.cone(8), [0, 0.08 * tall, 0], [0.07, 0.17 * tall, 0.07]);
      k.pop();
      k.color('#ffe680', 0.7).add(T.octa(), [0, top + 0.12, 0.18], [0.035, 0.035, 0.015]);
      break;
    }
    case 'cap':
      k.color(hc).add(T.dome(12, 4), [0, top - 0.06, 0], [0.26, 0.17, 0.26]);
      k.color(mul(hc, 0.85)).add(T.cyl(1, 1, 10), [0, top - 0.05, 0.18], [0.15, 0.025, 0.13]);
      k.color('#ffffff').add(T.sphere(6, 4), [0, top + 0.115, 0], 0.025);
      break;
    case 'crown': {
      k.color(hc).add(T.cyl(1, 1, 12, true), [0, top + 0.02, 0], [0.18, 0.08, 0.18]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.color(hc).add(T.cone(4), [Math.sin(a) * 0.17, top + 0.09, Math.cos(a) * 0.17], [0.035, 0.07, 0.035]);
      }
      k.lineless = true;
      k.color('#ff4a6a', 0.5).add(T.octa(), [0, top + 0.03, 0.185], 0.03);
      k.lineless = false;
      break;
    }
    case 'bandana':
      k.color(hc).add(T.torus(0.35, 5, 14), [0, hy + 0.09, -0.01], [0.245, 0.245, 0.24], [Math.PI / 2 + 0.25, 0, 0]);
      k.color(hc).add(T.dome(10, 4), [0, hy + 0.08, -0.01], [0.262, 0.2, 0.258], [-0.25, 0, 0]);
      k.color(hc).add(T.sphere(6, 5), [0, hy + 0.04, -0.27], 0.04);
      k.color(mul(hc, 0.85)).add(T.rbox(0.4), [0.05, hy - 0.06, -0.29], [0.05, 0.15, 0.02], [0.3, 0, -0.3]);
      k.color(mul(hc, 0.85)).add(T.rbox(0.4), [-0.05, hy - 0.05, -0.29], [0.05, 0.13, 0.02], [0.3, 0, 0.4]);
      break;
    case 'helm':
    case 'horned': {
      const steel = s.hat.style === 'horned' ? mix(hc, '#8a8a9a', 0.5) : hc;
      k.color(steel).add(T.dome(12, 5), [0, hy + 0.06, -0.02], [0.275, 0.25, 0.27], [-0.32, 0, 0]);
      k.color(mul(steel, 0.8)).add(T.torus(0.25, 5, 14), [0, hy + 0.06, -0.02], [0.272, 0.272, 0.27], [Math.PI / 2 - 0.32, 0, 0]);
      for (const sd of [1, -1]) k.color(mul(steel, 0.9)).add(T.rbox(0.4, 8, 4), [0.235 * sd, hy - 0.06, -0.02], [0.05, 0.14, 0.14]);
      if (s.hat.style === 'helm') {
        k.color(s.accent).add(T.rbox(0.5), [0, hy + 0.28, -0.03], [0.04, 0.09, 0.26]);
      } else {
        for (const side of [1, -1]) {
          k.push().tf(0.24 * side, hy + 0.13, 0, 0, 0, -0.9 * side);
          k.color('#f4ecd8').add(T.cyl(0.6, 1, 7), [0, 0.07, 0], [0.05, 0.14, 0.05]);
          k.tf(0, 0.14, 0, 0, 0, 0.8 * side);
          k.color('#f4ecd8').add(T.cone(7), [0, 0.07, 0], [0.032, 0.14, 0.032]);
          k.pop();
        }
      }
      break;
    }
    case 'straw':
      k.color(hc).add(T.cyl(1, 1, 16), [0, top - 0.03, 0], [0.44, 0.025, 0.42], [-0.06, 0, 0]);
      k.color(hc).add(T.cyl(0.85, 1, 12), [0, top + 0.03, 0], [0.2, 0.1, 0.2]);
      k.color(mix(hc, '#c8503c', 0.6)).add(T.cyl(1, 1, 12), [0, top + 0.0, 0], [0.205, 0.035, 0.205]);
      break;
    case 'chef':
      k.color(hc).add(T.cyl(1, 1, 12), [0, top + 0.02, 0], [0.2, 0.12, 0.2]);
      k.color(hc).add(T.sphere(10, 7), [0, top + 0.17, 0], [0.24, 0.13, 0.22]);
      k.color(hc).add(T.sphere(8, 6), [0.1, top + 0.2, 0.05], 0.1).add(T.sphere(8, 6), [-0.09, top + 0.21, -0.04], 0.1);
      break;
    case 'feather':
      k.color(hc).add(T.sphere(10, 6), [0, top - 0.01, -0.02], [0.25, 0.13, 0.29]);
      k.color(mul(hc, 0.8)).add(T.cyl(1, 1, 12), [0, top - 0.06, 0], [0.27, 0.025, 0.3]);
      k.color(s.accent === s.primary ? '#ffd24a' : s.accent).add(T.sphere(8, 5), [0.14, top + 0.12, -0.12], [0.03, 0.16, 0.05], [-0.6, 0, -0.35]);
      break;
    case 'circlet':
      k.color(hc).add(T.torus(0.2, 4, 16), [0, hy + 0.1, 0], [0.252, 0.252, 0.25], [Math.PI / 2 + 0.2, 0, 0]);
      k.lineless = true;
      k.color(mix(s.accent, '#9fe6ff', 0.4), 0.7).add(T.octa(), [0, hy + 0.13, 0.24], [0.035, 0.045, 0.02]);
      k.lineless = false;
      break;
  }
}

// ---- held items (on part 5 = right hand at (-sw - 0.02, 0.31, 0.01); off-hand part 4) ----
function buildHeld(k, s, sw, meta) {
  const h = s.held;
  const hc = C(h.color);
  const glow = h.glow ? C(h.glow) : null;
  const hx = -sw - 0.018, hy = 0.31, hz = 0.02;
  const wood = C('#8a5a33');
  const rightHand = () => k.part(5, -sw, 0.55, 0);
  const leftHand = () => k.part(4, sw, 0.55, 0);
  const glowBit = (fn) => { k.lineless = true; fn(); k.lineless = false; };
  rightHand();
  const sword = (x, scale = 1, blade = hc) => {
    k.push().tf(x, hy, hz, 1.25, 0, 0, scale, scale, scale);
    k.color('#6b4423').add(T.cyl(1, 1, 6), [0, 0, 0], [0.022, 0.1, 0.022]);
    k.color('#ffd24a').add(T.sphere(6, 4), [0, -0.06, 0], 0.03);
    k.color(mul(blade, 0.8)).add(T.rbox(0.4), [0, 0.06, 0], [0.16, 0.03, 0.05]);
    k.color(blade).add(T.box(), [0, 0.25, 0], [0.065, 0.34, 0.022]);
    k.color(lighten(blade, 0.4)).add(T.cone(4), [0, 0.45, 0], [0.046, 0.07, 0.016], [0, Math.PI / 4, 0]);
    k.pop();
  };
  switch (h.style) {
    case 'stick':
      k.push().tf(hx, hy, hz, 1.1, 0, 0.1);
      k.color(wood).add(T.cyl(0.7, 1, 6), [0, 0.18, 0], [0.025, 0.46, 0.025]);
      k.color('#5fb548').add(T.sphere(6, 4), [0.03, 0.3, 0], [0.04, 0.02, 0.025], [0, 0, 0.6]);
      k.pop();
      meta.tip = [hx, hy, hz + 0.4];
      break;
    case 'sword':
      sword(hx);
      meta.tip = [hx, hy - 0.05, hz + 0.45];
      break;
    case 'sword_shield': {
      sword(hx);
      leftHand();
      const sx = sw + 0.07;
      k.color(hc).add(T.cyl(1, 1, 14), [sx, 0.38, 0.05], [0.2, 0.035, 0.2], [0, 0, Math.PI / 2]);
      k.color(s.accent).add(T.torus(0.15, 4, 16), [sx + 0.02, 0.38, 0.05], [0.18, 0.18, 0.18], [0, Math.PI / 2, 0]);
      k.color(lighten(s.accent, 0.3)).add(T.sphere(8, 5), [sx + 0.03, 0.38, 0.05], [0.03, 0.06, 0.06]);
      meta.tip = [hx, hy - 0.05, hz + 0.45];
      break;
    }
    case 'axes':
      for (const side of [-1, 1]) {
        if (side > 0) leftHand(); else rightHand();
        const x = side > 0 ? sw + 0.018 : hx;
        k.push().tf(x, hy, hz, 1.3, 0, 0);
        k.color('#6b4423').add(T.cyl(1, 1, 6), [0, 0.1, 0], [0.022, 0.32, 0.022]);
        k.color(hc).add(T.rbox(0.4), [0.065 * -side, 0.22, 0], [0.12, 0.13, 0.025]);
        k.color(lighten(hc, 0.35)).add(T.cyl(1, 1, 8, false), [0.125 * -side, 0.22, 0], [0.035, 0.02, 0.07], [Math.PI / 2, 0, 0]);
        k.pop();
      }
      meta.tip = [hx, hy, hz + 0.3];
      break;
    case 'runeblade': {
      k.push().tf(hx, hy, hz, 1.25, 0, 0);
      k.color('#3a2a3a').add(T.cyl(1, 1, 6), [0, 0, 0], [0.024, 0.11, 0.024]);
      k.color(mul(hc, 0.7)).add(T.rbox(0.4), [0, 0.065, 0], [0.2, 0.04, 0.06]);
      k.color(hc).add(T.box(), [0, 0.28, 0], [0.095, 0.38, 0.026]);
      k.color(lighten(hc, 0.3)).add(T.cone(4), [0, 0.5, 0], [0.067, 0.09, 0.018], [0, Math.PI / 4, 0]);
      glowBit(() => {
        k.color(glow || '#9fe6ff', 1).add(T.box(), [0, 0.28, 0], [0.03, 0.32, 0.034]);
        for (let i = 0; i < 3; i++) k.color(glow || '#9fe6ff', 1).add(T.octa(), [0, 0.15 + i * 0.1, 0], [0.025, 0.025, 0.02]);
      });
      k.pop();
      meta.tip = [hx, hy - 0.05, hz + 0.45];
      meta.glowAt = meta.tip;
      break;
    }
    case 'staff': {
      const top = s.hero === 'malgrim' ? 1.25 : 1.12;
      const sx = s.hero === 'malgrim' ? hx - 0.1 : hx - 0.03;
      const sz = s.hero === 'malgrim' ? hz - 0.1 : hz + 0.05;
      const tilt = s.hero === 'malgrim' ? 0.1 : 0.05;
      k.push().tf(hx, 0, hz, 0, 0, tilt).tf(-hx, 0, -hz);
      k.color(hc).add(T.cyl(0.8, 1, 7), [sx, (top + 0.02) / 2, sz], [0.028, top, 0.028]);
      k.color(mul(hc, 0.7)).add(T.torus(0.35, 4, 8), [sx, top - 0.02, sz], [0.05, 0.05, 0.05], [Math.PI / 2, 0, 0]);
      if (s.hero === 'malgrim') {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          k.color('#2a1a2a').add(T.cone(4), [sx + Math.cos(a) * 0.05, top + 0.08, sz + Math.sin(a) * 0.05], [0.02, 0.13, 0.02], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]);
        }
      }
      glowBit(() => k.color(glow || lighten(hc, 0.5), glow ? 1 : 0.3).add(s.hero === 'laporte' ? T.octa() : T.sphere(9, 7), [sx, top + 0.08, sz],
        s.hero === 'laporte' ? [0.065, 0.1, 0.065] : 0.075));
      k.pop();
      meta.tip = [sx - (top + 0.08) * tilt, top + 0.08, sz];
      meta.glowAt = meta.tip;
      meta.staff = true;
      break;
    }
    case 'orb':
      k.color(mul(hc, 0.8)).add(T.torus(0.3, 4, 12), [hx, hy + 0.05, hz + 0.08], [0.06, 0.06, 0.06], [Math.PI / 2, 0, 0]);
      glowBit(() => k.color(glow || hc, glow ? 1 : 0.4).add(T.sphere(10, 8), [hx, hy + 0.15, hz + 0.08], 0.085));
      meta.tip = [hx, hy + 0.15, hz + 0.08];
      meta.glowAt = meta.tip;
      break;
    case 'wand':
      k.push().tf(hx, hy, hz, 1.0, 0, 0);
      k.color(hc).add(T.cyl(0.6, 1, 6), [0, 0.13, 0], [0.018, 0.27, 0.018]);
      glowBit(() => k.color(glow || '#ffe680', 1).add(T.octa(), [0, 0.29, 0], [0.05, 0.05, 0.02]));
      k.pop();
      meta.tip = [hx, hy + 0.15, hz + 0.25];
      meta.glowAt = meta.tip;
      break;
    case 'fists':
      meta.tip = [hx, hy, hz + 0.05];
      if (glow) meta.glowAt = meta.tip;
      break;
    case 'daggers':
      for (const side of [-1, 1]) {
        if (side > 0) leftHand(); else rightHand();
        const x = side > 0 ? sw + 0.018 : hx;
        k.push().tf(x, hy, hz, 1.5, 0, 0);
        k.color('#3a2a2a').add(T.cyl(1, 1, 6), [0, 0, 0], [0.018, 0.07, 0.018]);
        k.color(mul(hc, 0.8)).add(T.box(), [0, 0.04, 0], [0.08, 0.018, 0.03]);
        k.color(hc).add(T.cone(4), [0, 0.15, 0], [0.032, 0.2, 0.012], [0, Math.PI / 4, 0]);
        k.pop();
      }
      meta.tip = [hx, hy, hz + 0.2];
      break;
    case 'bow':
      k.push().tf(hx - 0.01, hy + 0.04, hz + 0.03, 0, Math.PI / 2, 0);
      k.color(hc).add(T.torus(0.08, 4, 12, Math.PI * 0.8), [0, 0, 0], [0.32, 0.32, 0.32], [0, 0, Math.PI * 0.6]);
      k.pop();
      k.color('#f4f4f4').add(T.cyl(1, 1, 3), [hx - 0.01, hy + 0.04, hz - 0.07], [0.006, 0.55, 0.006]);
      meta.tip = [hx, hy + 0.05, hz + 0.3];
      break;
    case 'shuriken':
      k.push().tf(hx, hy - 0.02, hz + 0.06, Math.PI / 2, 0, 0);
      for (let i = 0; i < 4; i++) k.color(hc).add(T.cone(4), [Math.cos(i * Math.PI / 2) * 0.05, 0, Math.sin(i * Math.PI / 2) * 0.05], [0.035, 0.1, 0.012], [Math.PI / 2, 0, -i * Math.PI / 2 + Math.PI / 2]);
      k.color('#3a3a4a').add(T.cyl(1, 1, 8), [0, 0, 0], [0.03, 0.02, 0.03]);
      k.pop();
      leftHand();
      k.color(hc).add(T.octa(), [sw + 0.02, 0.29, 0.06], [0.05, 0.05, 0.015]);
      meta.tip = [hx, hy, hz + 0.1];
      break;
    case 'spear':
      k.push().tf(hx, hy, hz, 1.35, 0, 0);
      k.color('#8a5a33').add(T.cyl(1, 1, 6), [0, 0.18, 0], [0.022, 0.9, 0.022]);
      k.color(hc).add(T.octa(), [0, 0.7, 0], [0.05, 0.13, 0.018]);
      k.color('#c8503c').add(T.cone(5), [0, 0.6, 0], [0.04, 0.06, 0.04], [Math.PI, 0, 0]);
      k.pop();
      meta.tip = [hx, hy - 0.05, hz + 0.7];
      break;
    case 'book':
      k.color(hc).add(T.rbox(0.25), [hx + 0.06, hy + 0.05, hz + 0.1], [0.17, 0.2, 0.05], [0.5, 0.3, 0]);
      k.color('#f8f2e0').add(T.box(), [hx + 0.065, hy + 0.05, hz + 0.105], [0.15, 0.185, 0.04], [0.5, 0.3, 0]);
      glowBit(() => k.color(glow || '#ffd24a', glow ? 1 : 0).add(T.octa(), [hx + 0.075, hy + 0.08, hz + 0.135], [0.035, 0.035, 0.01], [0.5, 0.3, 0]));
      meta.tip = [hx + 0.06, hy + 0.2, hz + 0.12];
      if (glow) meta.glowAt = meta.tip;
      break;
    case 'broom':
      k.color('#a0703f').add(T.cyl(1, 1, 6), [hx - 0.02, 0.45, hz + 0.05], [0.022, 0.9, 0.022], [0.1, 0, 0]);
      k.color('#e8c870').add(T.cyl(0.4, 1, 8), [hx - 0.02, 0.07, hz + 0.01], [0.09, 0.18, 0.06], [0.1, 0, 0]);
      k.color('#c8503c').add(T.cyl(1, 1, 8), [hx - 0.02, 0.16, hz + 0.02], [0.04, 0.03, 0.04], [0.1, 0, 0]);
      meta.tip = [hx, 0.9, hz];
      break;
    case 'lantern':
      k.color('#3a3a4a').add(T.cyl(1, 1, 4), [hx, hy - 0.05, hz + 0.04], [0.008, 0.08, 0.008]);
      k.color(hc).add(T.cyl(0.7, 1, 6), [hx, hy - 0.11, hz + 0.04], [0.06, 0.03, 0.06]);
      k.color(hc).add(T.cyl(1, 0.8, 6), [hx, hy - 0.24, hz + 0.04], [0.065, 0.03, 0.065]);
      glowBit(() => k.color(glow || '#ffe680', 1).add(T.cyl(1, 1, 6), [hx, hy - 0.175, hz + 0.04], [0.05, 0.09, 0.05]));
      meta.tip = [hx, hy - 0.17, hz + 0.04];
      meta.glowAt = meta.tip;
      break;
  }
  if (glow && !meta.glowAt) meta.glowAt = meta.tip;
  meta.glow = glow ? h.glow : null;
}
