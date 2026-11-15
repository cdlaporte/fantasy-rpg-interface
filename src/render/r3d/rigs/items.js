// Solid parts of projectile and effect looks (the glowing / translucent parts are drawn by fx.js every frame).
// Projectiles face +Z (travel direction) at size 1 and are centered at y = 0 (the entity z lifts them).
// Effect models sit on the ground.
import { Kit, T, C, mul, lighten, darken } from '../kit.js';

export const PROJECTILE_MODELS = ['bolt', 'arrow', 'orb', 'fireball', 'shuriken', 'knife', 'wave', 'crescent', 'rock', 'spore',
  'spark', 'ice', 'kunai', 'axe', 'coin'];
export const EFFECT_MODELS = ['barrier', 'telegraph_circle', 'telegraph_line', 'telegraph_cone', 'ground_fire', 'ground_frost',
  'zone_ring', 'rune_seal', 'shield_bubble', 'caltrops', 'smoke', 'portal', 'meteor', 'chest', 'chest_open', 'rune_chest',
  'gold', 'heart', 'item', 'xp_orb', 'stick', 'totem', 'decoy_puff'];

/** Projectile solid model (may be empty: pure-fx projectiles). spin: 'roll' (around travel), 'flat' (around Y), null. */
export function buildProjectile(look, unknown) {
  let m = look.model;
  if (!PROJECTILE_MODELS.includes(m)) { unknown.add('projectile:' + m); m = 'orb'; }
  const col = C(look.color || '#ffe066');
  const glow = look.glow ? C(look.glow) : null;
  const k = new Kit({ skin: true });
  const meta = { model: m, spin: null, glowR: 0, trail: look.trail !== false, empty: false };
  k.part(0);
  switch (m) {
    case 'arrow':
      k.color('#a0703f').add(T.cyl(1, 1, 5), [0, 0, 0], [0.02, 0.55, 0.02], [Math.PI / 2, 0, 0]);
      k.color('#c8ccd8').add(T.cone(4), [0, 0, 0.31], [0.045, 0.1, 0.02], [Math.PI / 2, 0, 0]);
      for (const r of [0, Math.PI / 2]) k.color(col).add(T.box(), [0, 0, -0.24], [0.1, 0.005, 0.12], [0, 0, r]);
      meta.glowR = glow ? 0.15 : 0;
      break;
    case 'knife':
    case 'kunai':
      k.color(m === 'kunai' ? '#3a3a4a' : '#6b4423').add(T.cyl(1, 1, 5), [0, 0, -0.08], [0.022, 0.12, 0.022], [Math.PI / 2, 0, 0]);
      k.color(m === 'kunai' ? '#5a5a6a' : '#c8ccd8').add(T.cone(4), [0, 0, 0.08], [0.04, 0.22, 0.012], [Math.PI / 2, 0, 0]);
      if (m === 'kunai') k.color('#3a3a4a').add(T.torus(0.3, 4, 8), [0, 0, -0.17], [0.035, 0.035, 0.035], [0, Math.PI / 2, 0]);
      else k.color(col).add(T.box(), [0, 0, -0.02], [0.08, 0.015, 0.02]);
      meta.spin = m === 'knife' ? null : null;
      break;
    case 'shuriken':
      for (let i = 0; i < 4; i++) k.color(col).add(T.cone(4), [Math.cos(i * Math.PI / 2) * 0.08, 0, Math.sin(i * Math.PI / 2) * 0.08], [0.05, 0.16, 0.012], [Math.PI / 2, 0, -i * Math.PI / 2 + Math.PI / 2]);
      k.color('#3a3a4a').add(T.cyl(1, 1, 8), [0, 0, 0], [0.045, 0.025, 0.045]);
      meta.spin = 'flat';
      break;
    case 'axe':
      k.color('#6b4423').add(T.cyl(1, 1, 6), [0, 0, 0], [0.025, 0.36, 0.025], [Math.PI / 2, 0, 0]);
      k.color(col).add(T.rbox(0.4), [0.07, 0, 0.12], [0.13, 0.03, 0.14]);
      k.color(lighten(col, 0.3)).add(T.box(), [0.135, 0, 0.12], [0.02, 0.035, 0.15]);
      meta.spin = 'flat';
      break;
    case 'coin':
      k.color('#ffd24a', 0.25).add(T.cyl(1, 1, 12), [0, 0, 0], [0.11, 0.025, 0.11], [0, 0, Math.PI / 2]);
      k.color('#ffe680', 0.4).add(T.cyl(1, 1, 8), [0, 0, 0], [0.06, 0.03, 0.06], [0, 0, Math.PI / 2]);
      meta.spin = 'flip';
      break;
    case 'rock':
      k.color(look.color ? col : '#a6a6b0').add(T.dodeca(), [0, 0, 0], [0.16, 0.14, 0.15]);
      k.color(mul(look.color ? col : C('#a6a6b0'), 0.8)).add(T.ico(0), [0.07, 0.06, 0.02], 0.08);
      meta.spin = 'roll';
      break;
    case 'ice':
      k.color(lighten(col, 0.3), 0.35).add(T.cyl(0, 1, 6), [0, 0, 0.1], [0.08, 0.22, 0.08], [Math.PI / 2, 0, 0]);
      k.color(lighten(col, 0.5), 0.35).add(T.cyl(1, 0, 6), [0, 0, -0.05], [0.08, 0.1, 0.08], [Math.PI / 2, 0, 0]);
      meta.glowR = 0.2;
      break;
    case 'spore':
      k.color(col, 0.2).add(T.ico(1), [0, 0, 0], 0.12);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        k.color(lighten(col, 0.3), 0.3).add(T.sphere(4, 3), [Math.cos(a) * 0.12, Math.sin(a * 1.7) * 0.08, Math.sin(a) * 0.12], 0.035);
      }
      meta.glowR = 0.25; meta.spin = 'roll';
      break;
    default:
      // energy projectiles: bright emissive core, the glow / shape is fx
      meta.empty = m !== 'fireball' && m !== 'orb' && m !== 'bolt' && m !== 'spark';
      if (m === 'orb') k.color(lighten(col, 0.4), 1).add(T.sphere(10, 8), [0, 0, 0], 0.13);
      else if (m === 'fireball') { k.color('#fff2a0', 1).add(T.sphere(9, 7), [0, 0, 0], 0.13); k.color(col, 1).add(T.sphere(9, 7), [0, 0, -0.05], [0.16, 0.16, 0.2]); }
      else if (m === 'bolt') k.color(lighten(glow || col, 0.6), 1).add(T.capsule(2, 6), [0, 0, 0], [0.09, 0.09, 0.09], [Math.PI / 2, 0, 0]);
      else if (m === 'spark') k.color('#ffffff', 1).add(T.octa(), [0, 0, 0], 0.07);
      else k.color(col, 1).add(T.octa(), [0, 0, 0], 0.01);
      meta.glowR = { orb: 0.35, fireball: 0.45, bolt: 0.3, spark: 0.25, wave: 0, crescent: 0 }[m] || 0.3;
      meta.lineless = true;
  }
  return { geo: k.build(), meta };
}

/** Effect solid model; some effects have none (pure fx). */
export function buildEffect(look, unknown) {
  let m = look.model;
  if (!EFFECT_MODELS.includes(m)) { unknown.add('effect:' + m); m = 'zone_ring'; }
  const col = C(look.color || '#ffe066');
  const k = new Kit({ skin: true });
  const meta = { model: m, empty: false, bob: false, spin: false };
  k.part(0);
  k.grad = [0.85, 1.06];
  const wood = C('#b0743d'), gold = C('#ffd24a');
  switch (m) {
    case 'chest':
    case 'chest_open':
    case 'rune_chest': {
      const rune = m === 'rune_chest';
      const body = rune ? C('#7a6aa8') : wood;
      const trim = rune ? C('#c9a6ff') : gold;
      k.color(body).add(T.rbox(0.3), [0, 0.18, 0], [0.62, 0.34, 0.44]);
      k.color(mul(body, 0.8)).add(T.box(), [0, 0.3, 0], [0.64, 0.035, 0.46]);
      for (const x of [-0.22, 0.22]) k.color(trim).add(T.box(), [x, 0.18, 0], [0.05, 0.36, 0.46]);
      if (m === 'chest_open') {
        k.push().tf(0, 0.34, -0.22, -1.9, 0, 0);
        k.color(body).add(T.cyl(1, 1, 10, false, 0), [0, 0, 0.22], [0.31, 0.62, 0.22], [0, 0, Math.PI / 2]);
        k.pop();
        k.lineless = true;
        k.color('#fff2a0', 1).add(T.box(), [0, 0.345, 0], [0.54, 0.01, 0.36]);
        k.lineless = false;
        meta.glowUp = true;
      } else {
        k.push().tf(0, 0.34, 0, 0, 0, Math.PI / 2);
        k.color(body).add(T.cyl(1, 1, 10, false), [0, 0, 0], [0.2, 0.62, 0.22]);
        k.pop();
        for (const x of [-0.22, 0.22]) k.color(trim).add(T.cyl(1, 1, 10), [x, 0.34, 0], [0.205, 0.05, 0.225], [0, 0, Math.PI / 2]);
        k.color(trim).add(T.rbox(0.4), [0, 0.3, 0.23], [0.1, 0.12, 0.04]);
        if (rune) { k.lineless = true; k.color(look.color ? col : '#9fe6ff', 1).add(T.octa(), [0, 0.42, 0.21], [0.06, 0.06, 0.02]); k.lineless = false; meta.glowRune = true; }
      }
      break;
    }
    case 'gold':
      for (const [x, z, y] of [[0, 0, 0.03], [0.07, 0.04, 0.03], [-0.06, 0.05, 0.03], [0.01, 0.02, 0.07], [0.02, -0.06, 0.03]]) {
        k.color(gold, 0.15).add(T.cyl(1, 1, 10), [x, y, z], [0.09, 0.03, 0.09]);
      }
      k.color('#ffe680', 0.3).add(T.cyl(1, 1, 10), [0.0, 0.2, 0], [0.08, 0.02, 0.08], [0, 0, Math.PI / 2]);
      meta.bob = true; meta.spin = true;
      break;
    case 'heart':
      k.color(look.color ? col : '#ff5a7a', 0.15).add(T.sphere(8, 6), [0.06, 0.28, 0], [0.085, 0.085, 0.06]);
      k.color(look.color ? col : '#ff5a7a', 0.15).add(T.sphere(8, 6), [-0.06, 0.28, 0], [0.085, 0.085, 0.06]);
      k.color(look.color ? col : '#ff5a7a', 0.15).add(T.cone(8), [0, 0.18, 0], [0.13, 0.17, 0.065], [Math.PI, 0, 0]);
      k.lineless = true;
      k.color('#ffffff', 1).add(T.sphere(4, 3), [0.07, 0.31, 0.055], 0.022);
      k.lineless = false;
      meta.bob = true; meta.spin = true;
      break;
    case 'item':
      k.color(look.color ? col : '#c9a6ff').add(T.rbox(0.35), [0, 0.18, 0], [0.24, 0.22, 0.24]);
      k.color('#ffffff').add(T.box(), [0, 0.18, 0], [0.26, 0.23, 0.05]);
      k.color('#ffffff').add(T.box(), [0, 0.18, 0], [0.05, 0.23, 0.26]);
      k.color('#ffffff').add(T.torus(0.35, 4, 8), [0.04, 0.32, 0], [0.05, 0.05, 0.05]).add(T.torus(0.35, 4, 8), [-0.04, 0.32, 0], [0.05, 0.05, 0.05]);
      meta.bob = true; meta.spin = true;
      break;
    case 'xp_orb':
      k.color(lighten(look.color ? col : C('#7cf07c'), 0.5), 1).add(T.sphere(8, 6), [0, 0.25, 0], 0.07);
      meta.bob = true; meta.lineless = true;
      break;
    case 'stick':
      k.color('#8a5a33').add(T.cyl(0.7, 1, 6), [0, 0.04, 0], [0.03, 0.6, 0.03], [Math.PI / 2, 0, 1.1]);
      k.color('#8a5a33').add(T.cyl(0.5, 1, 5), [0.1, 0.05, 0.05], [0.02, 0.15, 0.02], [Math.PI / 2, 0, 0.3]);
      k.color('#5fb548').add(T.sphere(6, 4), [-0.14, 0.06, -0.12], [0.05, 0.02, 0.03], [0, 0.6, 0]);
      meta.sparkle = true;
      break;
    case 'totem': {
      const c2 = look.color ? col : C('#c8503c');
      k.color(wood).add(T.cyl(0.9, 1, 8), [0, 0.35, 0], [0.16, 0.7, 0.16]);
      k.color(c2).add(T.cyl(1, 1, 8), [0, 0.5, 0], [0.17, 0.06, 0.17]);
      k.color(mul(wood, 0.75)).add(T.rbox(0.4), [0, 0.8, 0], [0.3, 0.22, 0.28]);
      k.color(c2).add(T.box(), [0.2, 0.75, 0], [0.18, 0.04, 0.12], [0, 0, -0.4]).add(T.box(), [-0.2, 0.75, 0], [0.18, 0.04, 0.12], [0, 0, 0.4]);
      k.lineless = true;
      k.color('#ffe680', 1).add(T.box(), [0.06, 0.82, 0.141], [0.05, 0.04, 0.01]).add(T.box(), [-0.06, 0.82, 0.141], [0.05, 0.04, 0.01]);
      k.lineless = false;
      meta.pulse = true;
      break;
    }
    case 'caltrops': {
      const r = look.r || 0.8;
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, d = Math.sqrt((i + 0.5) / 9) * r * 0.85;
        k.color(i % 2 ? '#8a8a9a' : '#6a6a7a').add(T.tetra(), [Math.cos(a) * d, 0.04, Math.sin(a) * d], 0.06, [i, i * 2, 0]);
      }
      break;
    }
    case 'meteor':
      k.color('#6a5048').add(T.dodeca(), [0, 0.3, 0], [0.3, 0.27, 0.3]);
      k.color('#4a3830').add(T.ico(0), [0.15, 0.4, 0.1], 0.14);
      k.lineless = true;
      k.color('#ffb040', 1).add(T.ico(0), [0, 0.18, 0], [0.24, 0.14, 0.24]);
      k.lineless = false;
      meta.fiery = true;
      break;
    case 'decoy_puff':
      k.color('#e8e4f0').add(T.sphere(9, 7), [0, 0.3, 0], [0.26, 0.24, 0.26]);
      k.color('#d0ccdc').add(T.sphere(8, 6), [0.18, 0.2, 0.06], 0.16).add(T.sphere(8, 6), [-0.17, 0.22, -0.04], 0.17);
      k.color('#8a5a33').add(T.cyl(1, 1, 8), [0, 0.15, 0.1], [0.08, 0.3, 0.08], [Math.PI / 2, 0, 0.3]);
      meta.wobble = true;
      break;
    case 'rune_seal':
      // a standing stone ring with a glowing rune disc
      k.color('#8f88b8').add(T.torus(0.16, 5, 16), [0, 0.65, 0], [0.55, 0.55, 0.55]);
      k.color('#6f6898').add(T.rbox(0.4), [0, 0.06, 0], [0.7, 0.12, 0.3]);
      meta.rune = true;
      break;
    default:
      meta.empty = true;   // barrier, telegraphs, ground_*, zone_ring, shield_bubble, smoke, portal: pure fx
  }
  k.grad = null;
  if (meta.empty) return { geo: null, meta };
  return { geo: k.build(), meta };
}
