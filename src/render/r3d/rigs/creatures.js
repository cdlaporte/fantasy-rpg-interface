// Creature rigs: quadruped, blob, flyer, plant, golem (+ hero 'mossback'). Same part ids as humanoids:
// 0 body, 1 head, 2/3 leg pairs, 4/5 arms | wings | leaves, 7 tail (yaw wag). Facing +Z, feet at y = 0, size 1.
import { Kit, T, C, mul, mix, lighten, darken } from '../kit.js';
import { BOSS_BUILDERS, quadAntennae, quadClaws, quadStinger, quadShell, quadEars, quadHorns, blobTentacles, blobBubbles, insectWings,
  plantCactus, plantSeaweed, golemBiome } from './biomeCreatures.js';

const FEATURES = {
  quadruped: ['tail_thin', 'tail_bushy', 'tusks', 'ears_round', 'ears_pointy', 'spikes', 'mane',
    'claws', 'stinger', 'shell_back', 'long_ears', 'horns'],
  blob: ['crown', 'drips', 'core_glow', 'spots', 'tentacles', 'bubbles'],
  flyer: ['wings_bat', 'wings_bird', 'wings_fairy', 'orb', 'glow', 'wings_insect'],
  plant: ['cap_mushroom', 'thorns', 'leaves', 'flower', 'bark_face', 'vines', 'cactus', 'seaweed'],
  golem: ['mossy', 'rocky', 'wood', 'crystal', 'antlers', 'sandy', 'icy', 'coral', 'starry'],
};
const HEROES = { mossback: 'golem', sphinx: 'quadruped', crab_king: 'quadruped', yeti: 'golem' };

function spec(look, unknown) {
  const c = (look && look.colors) || {};
  const rig = look.rig;
  const feats = new Set();
  for (const f of (look.features || [])) {
    if (FEATURES[rig] && FEATURES[rig].includes(f)) feats.add(f);
    else unknown.add(rig + '.feature:' + f);
  }
  if (look.hero && !HEROES[look.hero]) unknown.add('hero:' + look.hero);
  return {
    body: C(c.body || '#9a8a7a'), belly: C(c.belly || '#d8c8b8'), accent: C(c.accent || '#ff9aa8'), eye: C(c.eye || '#222222'),
    f: feats, hero: HEROES[look.hero] ? look.hero : null,
  };
}

/** Cute eyes on a face plane: center (x, y, z) facing +Z. */
export function eyes(k, x, y, z, r, eyeC, gap, glowy = false) {
  k.lineless = true;
  for (const side of [1, -1]) {
    if (glowy) {
      k.color(eyeC, 1).add(T.sphere(6, 4), [gap * side + x, y, z], [r, r * 0.8, r * 0.5]);
    } else {
      k.color('#ffffff').add(T.sphere(6, 4), [gap * side + x, y, z - r * 0.2], [r * 1.25, r * 1.35, r * 0.6]);
      k.color(eyeC).add(T.sphere(6, 4), [gap * side + x, y - r * 0.1, z + r * 0.15], [r * 0.8, r * 0.95, r * 0.5]);
      k.color('#ffffff', 1).add(T.octa(), [gap * side + x + r * 0.3, y + r * 0.35, z + r * 0.5], r * 0.3);
    }
  }
  k.lineless = false;
}

export function buildCreature(look, unknown) {
  const s = spec(look, unknown);
  const k = new Kit({ skin: true });
  k.grad = [0.82, 1.08];
  const meta = { tip: [0, 0.4, 0.4], height: 0.8, glowAt: null, radius: 0.4 };
  if (s.hero && s.hero !== 'mossback' && BOSS_BUILDERS[s.hero]) {
    BOSS_BUILDERS[s.hero](k, s, meta);
    k.grad = null;
    return { geo: k.build(), meta };
  }
  switch (look.rig) {
    case 'quadruped': quadruped(k, s, meta); break;
    case 'blob': blob(k, s, meta); break;
    case 'flyer': flyer(k, s, meta); break;
    case 'plant': plant(k, s, meta); break;
    case 'golem': if (s.hero === 'mossback') mossback(k, s, meta); else golem(k, s, meta); break;
    default: blob(k, s, meta);
  }
  k.grad = null;
  return { geo: k.build(), meta };
}

function quadruped(k, s, meta) {
  const { body, belly, accent } = s;
  // legs: pair A (front-left, back-right) = part 2, pair B = part 3
  const legs = [[0.15, 0.2, 2], [-0.15, -0.2, 2], [-0.15, 0.2, 3], [0.15, -0.2, 3]];
  for (const [x, z, p] of legs) {
    k.part(p, x, 0.26, z);
    k.color(mul(body, 0.92)).add(T.cyl(1, 0.85, 6, true), [x, 0.13, z], [0.075, 0.24, 0.075]);
    k.color(mul(body, 0.7)).add(T.sphere(6, 4), [x, 0.03, z + 0.02], [0.085, 0.05, 0.1]);
  }
  k.part(0);
  k.color(body).add(T.sphere(10, 7), [0, 0.36, 0], [0.26, 0.21, 0.36]);
  k.color(belly).add(T.sphere(8, 6), [0, 0.3, 0.02], [0.2, 0.15, 0.3]);
  if (s.f.has('shell_back')) quadShell(k, s);
  if (s.f.has('spikes')) {
    const sy = s.f.has('shell_back') ? 0.1 : 0;
    for (let i = 0; i < 4; i++) k.color(accent).add(T.cone(5), [0, 0.56 + sy - Math.abs(i - 1.5) * 0.02, 0.18 - i * 0.13], [0.05, 0.13, 0.05], [-0.35, 0, 0]);
  }
  // tail (part 7, wags)
  k.part(7, 0, 0.4, -0.33);
  if (s.f.has('stinger')) {
    quadStinger(k, s);
  } else if (s.f.has('tail_bushy')) {
    k.color(body).add(T.sphere(9, 7), [0, 0.5, -0.45], [0.12, 0.17, 0.12], [-0.6, 0, 0]);
    k.color(lighten(body, 0.4)).add(T.sphere(8, 6), [0, 0.6, -0.52], [0.08, 0.09, 0.08]);
  } else if (s.f.has('tail_thin')) {
    k.color(accent).add(T.cyl(0.4, 1, 5), [0, 0.42, -0.5], [0.025, 0.3, 0.025], [-1.1, 0, 0]);
    k.color(accent).add(T.cyl(0.3, 1, 5), [0, 0.55, -0.63], [0.017, 0.15, 0.017], [-0.4, 0, 0]);
  } else {
    k.color(body).add(T.cone(6), [0, 0.42, -0.4], [0.05, 0.12, 0.05], [-1.2, 0, 0]);
  }
  // head (part 1)
  k.part(1, 0, 0.45, 0.25);
  const hz = 0.36, hy = 0.5;
  if (s.f.has('mane')) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      k.color(i % 2 ? accent : mul(accent, 0.85)).add(T.sphere(7, 5), [Math.cos(a) * 0.2, hy + Math.sin(a) * 0.2, hz - 0.06], 0.1);
    }
  }
  k.color(body).add(T.sphere(10, 7), [0, hy, hz], [0.21, 0.19, 0.2]);
  k.color(belly).add(T.sphere(8, 5), [0, hy - 0.06, hz + 0.15], [0.11, 0.08, 0.09]);
  k.lineless = true;
  k.color(accent).add(T.sphere(5, 3), [0, hy - 0.03, hz + 0.24], [0.04, 0.03, 0.03]);
  k.lineless = false;
  eyes(k, 0, hy + 0.05, hz + 0.16, 0.035, s.eye, 0.085);
  if (s.f.has('claws')) quadClaws(k, s, hy, hz);
  if (s.f.has('horns')) quadHorns(k, s, hy, hz);
  if (s.f.has('long_ears')) quadEars(k, s, hy, hz);
  else if (s.f.has('ears_pointy')) {
    for (const side of [1, -1]) {
      k.color(body).add(T.cone(5), [0.11 * side, hy + 0.2, hz - 0.03], [0.065, 0.15, 0.04], [0, 0, -0.3 * side]);
      k.color(accent).add(T.cone(4), [0.11 * side, hy + 0.19, hz - 0.01], [0.035, 0.1, 0.02], [0, 0, -0.3 * side]);
    }
  }
  // critters with a shell, claws or a stinger get no default round ears (antennae on shelled ones)
  const critter = s.f.has('shell_back') || s.f.has('claws') || s.f.has('stinger');
  if (critter && s.f.has('shell_back') && !s.f.has('ears_round') && !s.f.has('ears_pointy') && !s.f.has('long_ears')) quadAntennae(k, s, hy, hz);
  if (!s.f.has('long_ears') && (s.f.has('ears_round') || (!s.f.has('ears_pointy') && !critter))) {
    if (!s.f.has('ears_pointy')) for (const side of [1, -1]) {
      k.color(body).add(T.sphere(7, 4), [0.14 * side, hy + 0.15, hz - 0.03], [0.075, 0.075, 0.03]);
      k.lineless = true;
      k.color(accent).add(T.sphere(5, 3), [0.14 * side, hy + 0.15, hz - 0.01], [0.045, 0.045, 0.02]);
      k.lineless = false;
    }
  }
  if (s.f.has('tusks')) {
    for (const side of [1, -1]) k.color('#fff8e8').add(T.cone(5), [0.09 * side, hy - 0.02, hz + 0.2], [0.04, 0.17, 0.04], [-0.2, 0, -0.45 * side]);
  }
  meta.height = 0.75; meta.radius = 0.4; meta.tip = [0, hy - 0.05, hz + 0.25];
}

function blob(k, s, meta) {
  const { body, belly, accent } = s;
  const floaty = s.f.has('tentacles');
  k.part(0);
  if (floaty) { blobTentacles(k, s); k.push().tf(0, 0.26, 0); }
  k.color(body).add(T.sphere(12, 8), [0, 0.3, 0], [0.38, 0.32, 0.36]);
  if (!floaty) k.color(mul(body, 0.85)).add(T.cyl(1, 0.9, 14), [0, 0.04, 0], [0.38, 0.08, 0.36]);
  else k.color(mix(body, '#ffffff', 0.25)).add(T.cyl(1, 0.85, 14), [0, 0.06, 0], [0.38, 0.06, 0.36]);
  k.color(belly).add(T.sphere(10, 7), [0, 0.24, 0.18], [0.22, 0.17, 0.16]);
  if (s.f.has('spots')) {
    const spots = [[0.2, 0.48, -0.05, 0.07], [-0.24, 0.38, -0.12, 0.06], [0.05, 0.56, -0.18, 0.055], [-0.1, 0.5, 0.15, 0.045], [0.28, 0.25, -0.18, 0.05]];
    k.lineless = true;
    for (const [x, y, z, r] of spots) k.color(accent).add(T.sphere(7, 5), [x, y, z], [r, r * 0.6, r]);
    k.lineless = false;
  }
  if (s.f.has('drips')) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      k.color(mul(body, 0.95)).add(T.sphere(7, 6), [Math.cos(a) * 0.36, 0.13, Math.sin(a) * 0.34], [0.06, 0.12, 0.06]);
    }
  }
  if (s.f.has('core_glow')) {
    k.lineless = true;
    k.color(accent, 1).add(T.sphere(9, 7), [0, 0.3, 0.2], [0.12, 0.12, 0.12]);
    k.lineless = false;
    meta.glowAt = [0, 0.3, 0.3];
  }
  k.part(1, 0, floaty ? 0.56 : 0.3, 0);
  k.push().tf(0, 0.3, 0, -0.55, 0, 0).tf(0, -0.3, 0);
  eyes(k, 0, 0.36, 0.31, 0.06, s.eye, 0.12);
  k.lineless = true;
  k.color(mul(s.eye, 1)).add(T.torus(0.3, 4, 8, Math.PI), [0, 0.26, 0.335], [0.05, 0.04, 0.04], [0, 0, Math.PI]);
  k.lineless = false;
  k.pop();
  if (s.f.has('crown')) {
    k.color('#ffd24a').add(T.cyl(1, 1, 10, true), [0, 0.65, -0.02], [0.14, 0.07, 0.14]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      k.color('#ffd24a').add(T.cone(4), [Math.sin(a) * 0.13, 0.72, Math.cos(a) * 0.13 - 0.02], [0.03, 0.07, 0.03]);
    }
    k.color('#ff4a6a', 0.4).add(T.octa(), [0, 0.66, 0.12], 0.03);
  }
  if (s.f.has('bubbles')) blobBubbles(k, s);
  if (floaty) { k.pop(); if (meta.glowAt) meta.glowAt[1] += 0.26; }
  meta.height = floaty ? 0.95 : 0.7; meta.radius = 0.38; meta.tip = [0, floaty ? 0.56 : 0.3, 0.38];
}

function flyer(k, s, meta) {
  const { body, belly, accent } = s;
  k.part(0);
  k.color(body).add(T.sphere(10, 7), [0, 0.3, 0], [0.24, 0.23, 0.24]);
  k.color(belly).add(T.sphere(9, 7), [0, 0.25, 0.1], [0.16, 0.15, 0.15]);
  k.color(accent).add(T.cone(5), [0, 0.27, 0.25], [0.04, 0.08, 0.04], [Math.PI / 2, 0, 0]);
  for (const side of [1, -1]) k.color(accent).add(T.cyl(1, 1, 5), [0.07 * side, 0.06, 0.02], [0.02, 0.1, 0.02]);
  eyes(k, 0, 0.36, 0.2, 0.045, s.eye, 0.085, false);
  if (s.f.has('orb')) {
    k.lineless = true;
    k.color(accent, 1).add(T.sphere(8, 6), [0, -0.05, 0.05], 0.08);
    k.lineless = false;
    meta.glowAt = [0, -0.05, 0.05];
  }
  // ears / tufts
  for (const side of [1, -1]) k.color(body).add(T.cone(5), [0.11 * side, 0.52, 0], [0.05, 0.1, 0.04], [0, 0, -0.35 * side]);
  // wings (parts 4 / 5) pivot at the shoulder; wings lie along +-X
  const type = s.f.has('wings_bat') ? 'bat' : s.f.has('wings_fairy') ? 'fairy' : s.f.has('wings_insect') ? 'insect' : 'bird';
  for (const side of [1, -1]) {
    k.part(side > 0 ? 4 : 5, 0.18 * side, 0.36, -0.02);
    if (type === 'insect') {
      insectWings(k, s, side);
    } else if (type === 'bat') {
      const wc = mul(body, 0.7);
      k.color(wc).add(T.shape('batwing', [[0, 0], [0.45, 0.15], [0.42, -0.1], [0.3, -0.02], [0.22, -0.16], [0.12, -0.04], [0, -0.12]], 0.02), [0.18 * side, 0.36, -0.02], [side, 1, 1], [Math.PI / 2 - 0.3, 0, 0]);
      k.color(mul(body, 0.5)).add(T.cyl(1, 1, 4), [0.4 * side, 0.36, -0.02], [0.015, 0.45, 0.015], [0, 0, Math.PI / 2]);
    } else if (type === 'fairy') {
      k.lineless = true;
      k.color(lighten(accent, 0.5), 0.55).add(T.sphere(9, 6), [0.33 * side, 0.46, -0.05], [0.2, 0.012, 0.14], [0.2, 0, 0.5 * side]);
      k.color(lighten(accent, 0.3), 0.55).add(T.sphere(8, 6), [0.27 * side, 0.26, -0.05], [0.14, 0.012, 0.1], [0.2, 0, -0.4 * side]);
      k.lineless = false;
    } else {
      for (let i = 0; i < 3; i++) {
        k.color(i === 2 ? accent : mul(body, 0.85 + i * 0.1)).add(T.sphere(8, 5), [(0.22 + i * 0.08) * side, 0.36 - i * 0.015, -0.03 - i * 0.03], [0.17 - i * 0.03, 0.03, 0.1 - i * 0.015], [0, -0.3 * side * i, -0.12 * side]);
      }
    }
  }
  k.part(0);
  meta.height = 1.3; meta.radius = 0.3; meta.tip = [0, 0.3, 0.25]; meta.flyer = true;
  meta.glowAll = s.f.has('glow') ? '#' + s.accent.getHexString() : null;
}

function plant(k, s, meta) {
  const { body, belly, accent } = s;
  const bark = s.f.has('bark_face');
  // root feet (legs)
  for (const side of [1, -1]) {
    k.part(side > 0 ? 2 : 3, 0.1 * side, 0.12, 0);
    k.color(mul(bark ? '#8a5a33' : body, 0.75)).add(T.sphere(7, 5), [0.12 * side, 0.04, 0.03], [0.1, 0.06, 0.12]);
  }
  k.part(0);
  if (s.f.has('cactus')) { plantCactus(k, s, meta); return; }
  const stemC = bark ? C('#8a5a33') : body;
  k.color(stemC).add(T.cyl(0.8, 1, 10), [0, 0.22, 0], [0.2, 0.36, 0.2]);
  k.color(mul(stemC, 0.85)).add(T.cyl(1, 1, 10), [0, 0.06, 0], [0.22, 0.1, 0.22]);
  if (bark) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      k.color(mul(stemC, 0.7)).add(T.box(), [Math.sin(a) * 0.17, 0.25, Math.cos(a) * 0.17], [0.03, 0.28, 0.03], [0, a, 0]);
    }
  }
  if (s.f.has('thorns')) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.color(lighten(accent, 0.2)).add(T.cone(4), [Math.sin(a) * 0.2, 0.16 + (i % 2) * 0.13, Math.cos(a) * 0.2], [0.045, 0.14, 0.045], [Math.cos(a) * 1.4, 0, -Math.sin(a) * 1.4]);
    }
  }
  if (s.f.has('vines')) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.7;
      k.color(mix(body, '#2f7a35', 0.5)).add(T.cyl(1, 1, 5), [Math.sin(a) * 0.2, 0.24, Math.cos(a) * 0.2], [0.02, 0.4, 0.02], [0.1, 0, 0.1]);
      k.color('#7cc95a').add(T.sphere(5, 4), [Math.sin(a) * 0.21, 0.12, Math.cos(a) * 0.21], [0.04, 0.025, 0.04]);
    }
  }
  // face on the stem
  eyes(k, 0, 0.3, 0.19, 0.04, s.eye, 0.07, false);
  k.lineless = true;
  k.color(mul(s.eye, 1)).add(T.torus(0.3, 4, 8, Math.PI), [0, 0.22, 0.2], [0.035, 0.03, 0.03], [0, 0, Math.PI]);
  k.lineless = false;
  // leaves (arms)
  for (const side of [1, -1]) {
    k.part(side > 0 ? 4 : 5, 0.15 * side, 0.3, 0);
    if (s.f.has('leaves') || !s.f.has('thorns')) {
      k.color(mix(body, '#5fc048', 0.5)).add(T.sphere(8, 5), [0.3 * side, 0.3, 0.02], [0.17, 0.03, 0.09], [0, 0, -0.35 * side]);
      k.color(mix(body, '#2f7a35', 0.5)).add(T.box(), [0.3 * side, 0.31, 0.02], [0.2, 0.012, 0.012], [0, 0, -0.35 * side]);
    } else {
      k.color(body).add(T.cyl(0.4, 1, 5), [0.24 * side, 0.32, 0], [0.03, 0.2, 0.03], [0, 0, -1.2 * side]);
    }
  }
  // head: cap / flower / leafy top
  k.part(1, 0, 0.42, 0);
  if (s.f.has('cap_mushroom')) {
    k.color(accent).add(T.dome(14, 5), [0, 0.42, 0], [0.38, 0.26, 0.38]);
    k.color(mul(belly, 0.95)).add(T.cyl(1, 0.7, 14), [0, 0.42, 0], [0.37, 0.04, 0.37]);
    const spots = [[0, 0.66, 0.05], [0.2, 0.56, 0.15], [-0.2, 0.56, 0.12], [0.12, 0.55, -0.22], [-0.17, 0.56, -0.15]];
    k.lineless = true;
    for (const [x, y, z] of spots) k.color('#ffffff').add(T.sphere(6, 4), [x, y, z], [0.06, 0.03, 0.06]);
    k.lineless = false;
    // the face moves onto the cap rim so it reads from above
    k.push().tf(0, 0.5, 0.25, -0.7, 0, 0).tf(0, -0.5, -0.25);
    eyes(k, 0, 0.52, 0.33, 0.045, s.eye, 0.09, false);
    k.pop();
    meta.height = 0.75;
  } else if (s.f.has('flower')) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.color(accent).add(T.sphere(8, 5), [Math.cos(a) * 0.16, 0.5, Math.sin(a) * 0.16], [0.11, 0.04, 0.08], [0, -a, 0]);
    }
    k.color('#ffe066').add(T.sphere(8, 6), [0, 0.52, 0], [0.09, 0.05, 0.09]);
    meta.height = 0.65;
  } else if (s.f.has('seaweed')) {
    plantSeaweed(k, s);
    meta.height = 0.9;
  } else {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      k.color(mix(body, '#5fc048', 0.4)).add(T.sphere(8, 5), [Math.cos(a) * 0.08, 0.5, Math.sin(a) * 0.08], [0.06, 0.16, 0.04], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]);
    }
    meta.height = 0.68;
  }
  meta.radius = 0.32; meta.tip = [0, 0.3, 0.3];
}

function golem(k, s, meta) {
  const { body, belly, accent } = s;
  const wood = s.f.has('wood');
  const base = wood ? C('#a0703f') : body;
  for (const side of [1, -1]) {
    k.part(side > 0 ? 2 : 3, 0.14 * side, 0.3, 0);
    k.color(mul(base, 0.85)).add(T.rbox(0.45), [0.14 * side, 0.12, 0.02], [0.17, 0.24, 0.2]);
  }
  k.part(0);
  k.color(base).add(T.rbox(0.42), [0, 0.5, 0], [0.56, 0.46, 0.4]);
  k.color(mix(base, belly, 0.6)).add(T.rbox(0.45), [0, 0.46, 0.17], [0.34, 0.28, 0.08]);
  if (wood) {
    for (let i = 0; i < 3; i++) k.color(mul(base, 0.75)).add(T.box(), [0, 0.36 + i * 0.12, 0.205], [0.5, 0.015, 0.012]);
  }
  if (s.f.has('rocky')) {
    const rocks = [[0.22, 0.75, -0.08, 0.1], [-0.2, 0.78, 0.02, 0.09], [0.05, 0.76, -0.16, 0.11], [0.26, 0.45, -0.15, 0.08]];
    for (const [x, y, z, r] of rocks) k.color(mul(base, 0.9)).add(T.ico(0), [x, y, z], r);
  }
  if (s.f.has('mossy')) {
    k.color(accent).add(T.dome(10, 4), [0, 0.72, 0], [0.3, 0.07, 0.21]);
    k.color(mul(accent, 0.85)).add(T.sphere(7, 5), [0.24, 0.66, 0.1], [0.08, 0.05, 0.08]);
    k.color(mul(accent, 0.85)).add(T.sphere(7, 5), [-0.2, 0.7, -0.12], [0.09, 0.05, 0.08]);
  }
  if (s.f.has('crystal')) {
    const cr = [[0.13, 0.86, -0.1, 0.32, 0.35], [-0.14, 0.84, -0.08, 0.26, -0.35], [0, 0.9, -0.18, 0.38, 0], [0.24, 0.6, -0.14, 0.22, 0.9]];
    cr.forEach(([x, y, z, h, rz], i) => k.color(i % 2 ? mix(accent, '#9fe6ff', 0.5) : mix(accent, '#c9a6ff', 0.4), 0.45).add(T.cyl(0, 1, 5), [x, y, z], [0.085, h, 0.085], [-0.3, 0, rz]));
  }
  golemBiome(k, s, base, 'body');
  // arms (4 / 5)
  for (const side of [1, -1]) {
    k.part(side > 0 ? 4 : 5, 0.33 * side, 0.62, 0);
    k.color(mul(base, 0.95)).add(T.rbox(0.45), [0.36 * side, 0.6, 0], [0.18, 0.18, 0.18]);
    k.color(base).add(T.rbox(0.45), [0.38 * side, 0.4, 0.02], [0.15, 0.24, 0.15]);
    k.color(mul(base, 0.9)).add(T.rbox(0.45), [0.39 * side, 0.22, 0.04], [0.2, 0.17, 0.2]);
    golemBiome(k, s, base, 'arm', side);
  }
  k.part(1, 0, 0.7, 0);
  k.color(base).add(T.rbox(0.45), [0, 0.84, 0.04], [0.3, 0.22, 0.26]);
  eyes(k, 0, 0.86, 0.17, 0.04, s.eye, 0.07, true);
  meta.glowEyes = true;
  golemBiome(k, s, base, 'head');
  if (s.f.has('antlers')) antlers(k, 0, 0.95, 0, '#c8a070', 1);
  meta.height = 1.05; meta.radius = 0.42; meta.tip = [0.39, 0.22, 0.2];
}

function antlers(k, x, y, z, c, sc) {
  for (const side of [1, -1]) {
    k.push().tf(x + 0.09 * side * sc, y, z, 0, 0, -0.5 * side, sc, sc, sc);
    k.color(c).add(T.cyl(0.7, 1, 5), [0, 0.12, 0], [0.025, 0.24, 0.025]);
    k.color(c).add(T.cyl(0.5, 1, 5), [0.06 * side, 0.2, 0], [0.018, 0.12, 0.018], [0, 0, -0.9 * side]);
    k.color(c).add(T.cyl(0.5, 1, 5), [-0.03 * side, 0.26, 0], [0.016, 0.12, 0.016], [0, 0, 0.6 * side]);
    k.pop();
  }
}

/** Old Mossback: a huge friendly-menacing treant. Built at size 1 (~1.6 tall); the look size scales it. */
function mossback(k, s, meta) {
  const bark = C('#7a5233');
  const barkD = C('#5a3a22');
  const moss = s.accent;
  const leaf = C('#4fae4f');
  // root legs
  for (const side of [1, -1]) {
    k.part(side > 0 ? 2 : 3, 0.17 * side, 0.35, 0);
    k.color(barkD).add(T.cyl(0.8, 1, 7), [0.17 * side, 0.17, 0], [0.12, 0.34, 0.12]);
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.7;
      k.color(barkD).add(T.cyl(0.4, 1, 5), [0.17 * side + Math.sin(a) * 0.1, 0.04, 0.08 + Math.cos(a) * 0.04], [0.045, 0.16, 0.045], [1.3, a, 0]);
    }
  }
  k.part(0);
  k.color(bark).add(T.cyl(0.8, 1, 11), [0, 0.65, 0], [0.34, 0.66, 0.3]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    k.color(barkD).add(T.box(), [Math.sin(a) * 0.3, 0.62, Math.cos(a) * 0.27], [0.04, 0.55, 0.035], [0, a, 0]);
  }
  // mossy shoulders and belly patches
  for (const sd of [1, -1]) k.color(moss).add(T.sphere(8, 5), [0.27 * sd, 0.98, -0.04], [0.17, 0.09, 0.2]);
  k.color(mul(moss, 0.85)).add(T.sphere(7, 5), [0.22, 0.45, 0.24], [0.1, 0.07, 0.05]);
  k.color(mul(moss, 0.9)).add(T.sphere(7, 5), [-0.2, 0.62, 0.25], [0.08, 0.06, 0.04]);
  // a glowing knot heart
  k.lineless = true;
  k.color(s.eye, 0.85).add(T.sphere(7, 5), [0, 0.62, 0.29], [0.06, 0.08, 0.03]);
  k.lineless = false;
  // branch arms (4 / 5)
  for (const side of [1, -1]) {
    k.part(side > 0 ? 4 : 5, 0.34 * side, 0.92, 0);
    k.push().tf(0.36 * side, 0.92, 0, 0, 0, 0.25 * side);
    k.color(bark).add(T.cyl(0.7, 1, 7), [0, -0.27, 0], [0.09, 0.56, 0.09]);
    k.color(barkD).add(T.cyl(0.4, 1, 5), [0.05 * side, -0.58, 0.04], [0.04, 0.2, 0.04], [0.3, 0, 0.4 * side]);
    k.color(barkD).add(T.cyl(0.4, 1, 5), [-0.04 * side, -0.6, 0.05], [0.04, 0.2, 0.04], [0.3, 0, -0.3 * side]);
    k.color(barkD).add(T.cyl(0.4, 1, 5), [0, -0.6, -0.03], [0.04, 0.18, 0.04], [-0.3, 0, 0]);
    k.color(leaf).add(T.ico(1), [0.03 * side, -0.05, 0], [0.13, 0.11, 0.13]);
    k.pop();
  }
  // head / canopy (part 1)
  k.part(1, 0, 1.05, 0);
  // face pushed forward and tilted up so it reads from the high camera; canopy sits behind it
  k.push().tf(0, 1.05, 0.14, -0.45, 0, 0).tf(0, -1.05, 0);
  k.color(bark).add(T.rbox(0.5), [0, 1.15, 0.05], [0.42, 0.3, 0.3]);
  k.color(barkD).add(T.box(), [0, 1.26, 0.2], [0.3, 0.04, 0.03], [0, 0, 0]);
  eyes(k, 0, 1.16, 0.2, 0.055, s.eye, 0.1, true);
  k.lineless = true;
  k.color('#3a2416').add(T.box(), [0, 1.05, 0.2], [0.16, 0.03, 0.02]);
  k.lineless = false;
  k.pop();
  const canopy = [[0, 1.55, -0.28, 0.36], [0.3, 1.45, -0.3, 0.26], [-0.3, 1.47, -0.28, 0.27], [0.12, 1.7, -0.38, 0.25], [-0.16, 1.68, -0.22, 0.22]];
  canopy.forEach(([x, y, z, r], i) => k.color(i % 2 ? leaf : mul(leaf, 0.85)).add(T.ico(1), [x, y, z], r));
  const flowers = [[0.2, 1.7, -0.12], [-0.25, 1.62, -0.08], [0.36, 1.52, -0.15], [-0.05, 1.86, -0.25]];
  for (const [x, y, z] of flowers) {
    k.color('#ff8fc7').add(T.sphere(6, 4), [x, y, z], [0.05, 0.03, 0.05]);
    k.color('#ffe066').add(T.sphere(4, 3), [x, y + 0.02, z], 0.02);
  }
  antlers(k, 0, 1.75, -0.3, '#c8a070', 1.6);
  meta.height = 1.9; meta.radius = 0.5; meta.tip = [0.4, 0.3, 0.1]; meta.glowEyes = true;
}
