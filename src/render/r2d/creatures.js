// Creature rigs: quadruped, blob, flyer, plant, golem (+ hero 'mossback', a huge mossy treant).
// Geometry is scaled by look.size in art pixels (so pixels stay uniform), painted with shaded ellipses and
// auto-outlined. View: 0 up, 1 right (left is mirrored), 2 down.
import { Pix } from './pix.js';
import { dark, light, mix, col, OUTLINE } from './color.js';

export const CREATURE_FEATURES = {
  quadruped: ['tail_thin', 'tail_bushy', 'tusks', 'ears_round', 'ears_pointy', 'spikes', 'mane'],
  blob: ['crown', 'drips', 'core_glow', 'spots'],
  flyer: ['wings_bat', 'wings_bird', 'wings_fairy', 'orb', 'glow'],
  plant: ['cap_mushroom', 'thorns', 'leaves', 'flower', 'bark_face', 'vines'],
  golem: ['mossy', 'rocky', 'wood', 'crystal', 'antlers'],
};

export function creatureUnknown(look, out) {
  const known = CREATURE_FEATURES[look.rig] || [];
  for (const f of look.features || []) if (!known.includes(f)) out.push(look.rig + '.feature:' + f);
  if (look.hero && look.hero !== 'mossback') out.push(look.rig + '.hero:' + look.hero);
}

export function creatureFrames(rig, anim) {
  if (anim === 'walk') return 4;
  if (anim === 'idle') return rig === 'flyer' ? 3 : 2;
  if (anim === 'spin') return 4;
  if (anim === 'charge' || anim === 'attack' || anim === 'cast') return 2;
  return rig === 'flyer' ? 3 : 1;
}

export function creatureFrame(rig, anim, animT) {
  const t = animT || 0;
  const n = creatureFrames(rig, anim);
  if (n === 1) return 0;
  if (rig === 'flyer') return Math.floor(t / 0.09) % n;
  switch (anim) {
    case 'walk': return Math.floor(t / 0.12) % 4;
    case 'idle': return Math.floor(t / 0.45) % 2;
    case 'spin': return Math.floor(t / 0.06) % 4;
    case 'charge': return Math.floor(t / 0.06) % 2;
    default: return Math.min(1, Math.floor(t / 0.12));
  }
}

function pal(look) {
  const c = look.colors || {};
  const body = col(c.body, '#9a8a7a'), belly = col(c.belly, light(body, 0.4)), acc = col(c.accent, '#ffe066'), eye = col(c.eye, '#222222');
  return {
    body, bLo: dark(body, 0.3), bHi: light(body, 0.25), bDk: dark(body, 0.5),
    belly, beLo: dark(belly, 0.2), acc, aLo: dark(acc, 0.3), aHi: light(acc, 0.35), eye,
  };
}

/** paintCreature -> {pix, ax, ay, glow: [[x, y, color, r]]} */
export function paintCreature(look, view, anim, frame) {
  const sz = Math.max(0.3, Math.min(3.2, look.size || 1));
  // small creatures keep readable proportions: shrink less than the gameplay size suggests
  const k = sz < 1 ? 0.35 + 0.65 * sz : sz;
  const f = new Set(look.features || []);
  const C = pal(look);
  const glow = [];
  let rig = look.rig;
  const hero = look.hero === 'mossback';
  const W = Math.ceil((hero ? 30 : 26) * k) + 12, Hh = Math.ceil((hero ? 36 : 28) * k) + 14;
  const p = new Pix(W, Hh);
  const AX = W >> 1, AY = Hh - 3;
  const st = { k, f, C, p, AX, AY, view, anim, frame, glow };
  if (hero) mossback(st);
  else if (rig === 'quadruped') quadruped(st);
  else if (rig === 'blob') blob(st);
  else if (rig === 'flyer') flyer(st);
  else if (rig === 'plant') plant(st);
  else golem(st);
  const skip = new Set();
  p.outline(OUTLINE, skip);
  return { pix: p, ax: AX, ay: AY, glow };
}

// small helpers
const R = (p, x, y, w, h, c) => p.rect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), c);
const sh = (p, cx, cy, rx, ry, c, lo, hi) => p.shaded(cx, cy, Math.max(1, rx), Math.max(1, ry), c, lo, hi);

function eyes(st, x, y, r, mode = 'open') {
  const { p, C } = st;
  const ko = st.anim === 'ko', sleep = st.anim === 'sleep', hurt = st.anim === 'hurt';
  if (ko) { p.set(x - 1, y - 1, C.eye); p.set(x + 1, y - 1, C.eye); p.set(x, y, C.eye); p.set(x - 1, y + 1, C.eye); p.set(x + 1, y + 1, C.eye); return; }
  if (sleep || mode === 'closed') { p.hline(x - 1, x + (r > 1 ? 1 : 0), y, C.eye); return; }
  if (hurt) { p.set(x, y - 1, C.eye); p.set(x + 1, y, C.eye); p.set(x, y + 1, C.eye); return; }
  if (r >= 2) {
    p.rect(x - 1, y - 1, 2, 3, C.eye); p.set(x - 1, y - 1, '#ffffff');
  } else { p.set(x, y, C.eye); p.set(x, y - 1, C.eye); }
}

// ------------------------------------------------------------------ quadruped
function quadruped(st) {
  const { p, k, f, C, AX, AY, view, anim, frame } = st;
  const walk = anim === 'walk' ? frame : -1;
  const lunge = (anim === 'attack' || anim === 'dash') ? 2 * k : 0;
  const crouch = anim === 'charge' || anim === 'block' ? 1 : 0;
  const shake = anim === 'charge' ? (frame ? 1 : -1) : 0;
  const legH = Math.max(2, Math.round(3 * k)), bodyRx = 7 * k, bodyRy = 4.6 * k;
  const by = AY - legH - bodyRy + 1 + crouch;
  const flat = anim === 'ko' || anim === 'sleep';
  if (view === 1) {
    const cx = AX - 1 * k + shake;
    // tail
    if (f.has('tail_thin')) { const ty = by - 1; for (let i = 0; i < 8 * k; i++) p.set(Math.round(cx - bodyRx - i), Math.round(ty - Math.sin(i / (3 * k) + (walk > 0 ? walk : 0)) * 2 * k), C.acc); }
    if (f.has('tail_bushy')) { sh(p, cx - bodyRx - 2 * k, by - 3 * k, 3.5 * k, 2.8 * k, C.body, C.bLo, C.bHi); sh(p, cx - bodyRx - 4 * k, by - 4.5 * k, 2 * k, 1.8 * k, C.belly, C.beLo, null); }
    // far legs
    const legPos = [[-4.5, 0], [3.5, 1]];
    const lift = (i) => (walk === 1 && i === 0) || (walk === 3 && i === 1) ? 1 : 0;
    if (!flat) for (let i = 0; i < 2; i++) {
      const lx = cx + legPos[i][0] * k + (walk === 1 ? (i ? -1 : 1) : walk === 3 ? (i ? 1 : -1) : 0) * k;
      R(p, lx - k + 1.5, AY - legH - 1, Math.max(2, 2 * k), legH + 1 - lift(1 - i), C.bDk);
    }
    // body
    sh(p, cx, by, bodyRx, bodyRy, C.body, C.bLo, C.bHi);
    p.ellipse(cx + 0.5 * k, by + bodyRy * 0.45, bodyRx * 0.7, bodyRy * 0.45, C.belly);
    if (f.has('spikes')) for (let i = -2; i <= 2; i++) { const sx = cx + i * 2.6 * k; p.poly([sx - 1.3 * k, by - bodyRy + 1.5, sx + 1.3 * k, by - bodyRy + 1.5, sx, by - bodyRy - 2.5 * k], C.acc); }
    if (f.has('mane')) { sh(p, cx + bodyRx * 0.55, by - bodyRy * 0.25, 3.6 * k, 4.6 * k, C.acc, C.aLo, C.aHi); }
    // near legs
    if (!flat) for (let i = 0; i < 2; i++) {
      const lx = cx + (legPos[i][0] + 1) * k + (walk === 1 ? (i ? 1 : -1) : walk === 3 ? (i ? -1 : 1) : 0) * k;
      R(p, lx - k + 1, AY - legH - 1, Math.max(2, 2 * k), legH + 1 - lift(i), C.bLo);
      R(p, lx - k + 1, AY - 1 - lift(i), Math.max(2, 2 * k) + (k > 1 ? 1 : 0), 1, C.bDk);
    }
    // head
    const hx = cx + bodyRx * 0.85 + 2.4 * k + lunge, hy = by - bodyRy * 0.5 + (anim === 'attack' ? 1 : 0);
    if (f.has('ears_pointy')) { p.poly([hx - 2.5 * k, hy - 2 * k, hx - 0.5 * k, hy - 2.5 * k, hx - 2 * k, hy - 6.5 * k], C.body); p.set(Math.round(hx - 1.8 * k), Math.round(hy - 3.5 * k), C.acc); }
    if (f.has('ears_round')) { sh(p, hx - 1.5 * k, hy - 3.6 * k, 2 * k, 2 * k, C.body, C.bLo, C.bHi); p.ellipse(hx - 1.5 * k, hy - 3.4 * k, Math.max(0.8, 1.1 * k), Math.max(0.8, 1.1 * k), C.acc); }
    sh(p, hx, hy, 4 * k, 3.5 * k, C.body, C.bLo, C.bHi);
    // snout
    sh(p, hx + 3 * k, hy + 1 * k, 2.4 * k, 1.9 * k, C.belly, C.beLo, null);
    p.set(Math.round(hx + 5 * k), Math.round(hy + 0.3 * k), C.acc === '#ff9aa8' ? '#ff6f86' : C.bDk);
    if (anim === 'attack') { p.hline(Math.round(hx + 1.5 * k), Math.round(hx + 4.5 * k), Math.round(hy + 2.5 * k), '#7a2a3a'); }
    if (f.has('tusks')) { p.set(Math.round(hx + 3.5 * k), Math.round(hy + 2.6 * k), '#fffbe8'); p.set(Math.round(hx + 3.5 * k), Math.round(hy + 1.6 * k), '#fffbe8'); p.set(Math.round(hx + 4.2 * k), Math.round(hy + 0.8 * k), '#fffbe8'); if (k > 0.9) p.set(Math.round(hx + 2.8 * k), Math.round(hy + 2.6 * k), '#e8dcc0'); }
    eyes(st, Math.round(hx + 1 * k), Math.round(hy - 1 * k), k >= 0.9 ? 2 : 1);
    if (anim === 'charge' || anim === 'attack') { p.set(Math.round(hx), Math.round(hy - 2.4 * k), C.bDk); p.set(Math.round(hx + 1.5 * k), Math.round(hy - 2.6 * k), C.bDk); }
    return;
  }
  // front / back view
  const cx = AX - 0.5 + shake;
  const front = view === 2;
  const lift = (i) => (walk === 1 && i === 0) || (walk === 3 && i === 1) ? 1 : 0;
  if (!front) {
    if (f.has('ears_pointy') || f.has('ears_round')) {
      for (const s of [-1, 1]) sh(p, cx + s * 3 * k, by - bodyRy - 2 * k, 1.8 * k, 2 * k, C.body, C.bLo, C.bHi);
    }
  }
  if (!flat) for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    R(p, cx + s * 3.5 * k - k + 0.5, AY - legH - 1, Math.max(2, 2 * k), legH + 1 - lift(i), C.bLo);
  }
  sh(p, cx, by, bodyRx * 0.78, bodyRy * 1.05, C.body, C.bLo, C.bHi);
  if (front) { p.ellipse(cx, by + bodyRy * 0.5, bodyRx * 0.45, bodyRy * 0.45, C.belly); }
  if (f.has('spikes')) for (let i = -1; i <= 1; i++) p.poly([cx + i * 3 * k - 1.3 * k, by - bodyRy + 2, cx + i * 3 * k + 1.3 * k, by - bodyRy + 2, cx + i * 3 * k, by - bodyRy - 2.5 * k], C.acc);
  if (!front) {
    if (f.has('tail_thin')) { for (let i = 0; i < 6 * k; i++) p.set(Math.round(cx + Math.sin(i / 2) * k), Math.round(by + bodyRy - 2 + i * 0.6), C.acc); }
    if (f.has('tail_bushy')) sh(p, cx, by + bodyRy * 0.5, 2.8 * k, 3 * k, C.body, C.bLo, C.bHi);
    if (f.has('mane')) sh(p, cx, by - bodyRy * 0.6, 4.5 * k, 2.8 * k, C.acc, C.aLo, C.aHi);
    return;
  }
  // head in front
  const hy = by + bodyRy * 0.25 + (anim === 'attack' ? 1.5 * k : 0);
  if (f.has('mane')) sh(p, cx, hy - 1 * k, 5.5 * k, 5 * k, C.acc, C.aLo, C.aHi);
  if (f.has('ears_pointy')) for (const s of [-1, 1]) { p.poly([cx + s * 2 * k, hy - 2.5 * k, cx + s * 4.5 * k, hy - 2 * k, cx + s * 4.2 * k, hy - 6.5 * k], C.body); p.set(Math.round(cx + s * 3.6 * k), Math.round(hy - 3.6 * k), C.acc); }
  if (f.has('ears_round')) for (const s of [-1, 1]) { sh(p, cx + s * 3.4 * k, hy - 3.2 * k, 2 * k, 2 * k, C.body, C.bLo, C.bHi); p.ellipse(cx + s * 3.4 * k, hy - 3 * k, Math.max(0.8, 1.1 * k), Math.max(0.8, 1.1 * k), C.acc); }
  sh(p, cx, hy, 4.2 * k, 3.6 * k, C.body, C.bLo, C.bHi);
  sh(p, cx, hy + 2.2 * k, 2.6 * k, 1.9 * k, C.belly, C.beLo, null);
  // nose + mouth
  const nx = Math.round(cx - 0.5), ny = Math.round(hy + 1.4 * k);
  const nose = C.acc === '#ff9aa8' ? '#ff6f86' : C.bDk;
  p.set(nx, ny, nose); p.set(nx + 1, ny, nose);
  p.set(nx, ny + 1, C.beLo); p.set(nx + 1, ny + 1, C.beLo);
  if (k >= 0.6) { p.set(nx - 2, ny + 1, C.bHi); p.set(nx + 3, ny + 1, C.bHi); }
  if (f.has('tusks')) for (const s of [-1, 1]) { p.set(Math.round(cx + s * 2.4 * k), Math.round(hy + 2.4 * k), '#fffbe8'); p.set(Math.round(cx + s * 2.8 * k), Math.round(hy + 1.5 * k), '#fffbe8'); }
  eyes(st, Math.round(cx - 1.8 * k), Math.round(hy - 0.8 * k), k >= 0.9 ? 2 : 1);
  eyes(st, Math.round(cx + 1.8 * k) + 1, Math.round(hy - 0.8 * k), k >= 0.9 ? 2 : 1);
}

// ------------------------------------------------------------------ blob
function blob(st) {
  const { p, k, f, C, AX, AY, view, anim, frame, glow } = st;
  let sq = 0;
  if (anim === 'idle') sq = frame ? 1 : 0;
  if (anim === 'walk') sq = [0, 1, 0, -1][frame];
  if (anim === 'attack' || anim === 'dash') sq = -2;
  if (anim === 'charge') sq = 2;
  if (anim === 'hurt') sq = 2;
  if (anim === 'ko' || anim === 'sleep') sq = 3;
  const rx = 7 * k + sq * 0.6 * k, ry = 6 * k - sq * 0.7 * k;
  const cx = AX - 0.5 + (anim === 'charge' ? (frame ? 1 : -1) : 0), cy = AY - ry - (anim === 'walk' && frame === 3 ? 1.5 * k : 0);
  // body: dome (flattened bottom)
  sh(p, cx, cy, rx, ry, C.body, C.bLo, C.bHi);
  p.rect(Math.round(cx - rx * 0.9), Math.round(cy + ry * 0.55), Math.round(rx * 1.8), Math.round(ry * 0.45), C.body);
  p.rect(Math.round(cx - rx * 0.9), Math.round(cy + ry - 1), Math.round(rx * 1.8), 1, C.bLo);
  // belly / inner translucent look
  p.ellipse(cx + 0.5 * k, cy + ry * 0.35, rx * 0.6, ry * 0.42, mix(C.body, C.belly, 0.5));
  if (f.has('spots')) for (const [sx, sy, r] of [[-3.5, -2.5, 1.3], [3, -3.6, 1], [2.5, 1, 1.4], [-1, -4.5, 0.8]]) p.ellipse(cx + sx * k, cy + sy * k, r * k + 0.4, r * k + 0.4, C.acc);
  if (f.has('core_glow')) {
    p.shaded(cx, cy + ry * 0.15, 2.4 * k, 2.4 * k, C.acc, C.aLo, '#ffffff', 0.35, 0.4);
    glow.push([cx, cy + ry * 0.15, C.acc, 1.1 * k]);
  }
  // shine
  p.rect(Math.round(cx - rx * 0.55), Math.round(cy - ry * 0.6), Math.max(1, Math.round(2 * k)), Math.max(1, Math.round(1.5 * k)), '#ffffff');
  p.set(Math.round(cx - rx * 0.55), Math.round(cy - ry * 0.6) + Math.max(2, Math.round(2 * k)), '#ffffff');
  if (f.has('drips')) for (const dx of [-0.75, -0.2, 0.5, 0.8]) {
    const x = Math.round(cx + dx * rx), y = Math.round(cy + ry - 1);
    p.rect(x, y, Math.max(1, Math.round(k)), Math.round(2 * k + (frame + dx * 3 & 1)), C.bLo);
  }
  if (view !== 0) {
    const ex = view === 1 ? 2.5 * k : 0;
    const ey = Math.round(cy - ry * 0.05);
    const e2 = k >= 0.8 ? 2 : 1;
    if (view === 2) { eyes(st, Math.round(cx - 2.6 * k + ex), ey, e2); eyes(st, Math.round(cx + 2.6 * k + ex) + 1, ey, e2); }
    else { eyes(st, Math.round(cx + 1 * k + ex), ey, e2); eyes(st, Math.round(cx + 4.2 * k), ey, e2); }
    const mx = Math.round(cx + ex);
    if (anim === 'attack') p.rect(mx - 1, ey + Math.round(2 * k), 3, 2, '#5a1a2a');
    else p.hline(mx - 1, mx, ey + Math.round(2.2 * k), C.bDk);
  }
  if (f.has('crown')) {
    const top = Math.round(cy - ry), g = C.acc === '#ffe066' ? '#ffd24a' : '#ffd24a';
    p.rect(Math.round(cx - 3 * k), top - 1, Math.round(6 * k) + 1, Math.max(2, Math.round(2 * k)), g);
    for (const s of [-1, 0, 1]) p.poly([cx + s * 2.5 * k - 1.2 * k, top, cx + s * 2.5 * k + 1.2 * k, top, cx + s * 2.5 * k, top - 3.2 * k], g);
    p.set(Math.round(cx), top, '#e83a5a');
  }
}

// ------------------------------------------------------------------ flyer
function flyer(st) {
  const { p, k, f, C, AX, AY, view, anim, frame, glow } = st;
  const flap = anim === 'ko' || anim === 'sleep' ? 1 : frame % 3; // 0 up, 1 mid, 2 down
  const cx = AX - 0.5, cy = AY - 9 * k;
  const isOrb = f.has('orb');
  const wingKind = f.has('wings_bat') ? 'bat' : f.has('wings_bird') ? 'bird' : f.has('wings_fairy') ? 'fairy' : (isOrb ? null : 'bat');
  const ww = 7 * k, wh = 4.5 * k;
  const wingY = [-wh, -wh * 0.2, wh * 0.5][flap];
  const drawWing = (s, back) => {
    if (!wingKind) return;
    const x0 = cx + s * 2.5 * k, y0 = cy - 1 * k;
    const tipX = cx + s * (2.5 * k + ww), tipY = cy + wingY - 1 * k;
    if (view === 1 && back) return;
    if (wingKind === 'bat') {
      const wc = view === 0 ? C.bLo : C.bDk;
      p.poly([x0, y0 - 1.5 * k, tipX, tipY - 1.5 * k, tipX - s * 1.5 * k, tipY + 2.5 * k, x0 + s * ww * 0.55, y0 + 2.5 * k + wingY * 0.3, x0, y0 + 2.5 * k], wc);
      p.line(Math.round(x0), Math.round(y0 - 1), Math.round(tipX - s * 2 * k), Math.round(tipY + 1.5 * k), C.body);
      p.line(Math.round(x0), Math.round(y0), Math.round(x0 + s * ww * 0.5), Math.round(y0 + 2 * k + wingY * 0.3), C.body);
      p.set(Math.round(tipX), Math.round(tipY - 1.5 * k), C.bHi);
    } else if (wingKind === 'bird') {
      p.poly([x0, y0 - 1.5 * k, tipX, tipY - 1 * k, tipX - s * 0.5 * k, tipY + 1.5 * k, x0, y0 + 2.5 * k], C.body);
      for (let i = 1; i < 4; i++) { const fx = x0 + s * ww * (i / 4); p.line(Math.round(fx), Math.round(y0 + 0.5 * k + wingY * (i / 4)), Math.round(fx + s), Math.round(y0 + 2.5 * k + wingY * (i / 4)), C.bLo); }
      p.line(Math.round(x0), Math.round(y0 - 1.5 * k), Math.round(tipX), Math.round(tipY - 1 * k), C.bHi);
    } else {
      const fc = mix(C.belly, '#ffffff', 0.5), fe = C.acc;
      p.ellipse(x0 + s * ww * 0.45, y0 + wingY * 0.5 - 1.5 * k, ww * 0.55, 2.6 * k, fc);
      p.ellipse(x0 + s * ww * 0.35, y0 + wingY * 0.3 + 2 * k, ww * 0.35, 1.8 * k, fc);
      p.set(Math.round(x0 + s * ww * 0.6), Math.round(y0 + wingY * 0.5 - 1.5 * k), fe);
      p.set(Math.round(x0 + s * ww * 0.3), Math.round(y0 + wingY * 0.5 - 2 * k), '#ffffff');
    }
  };
  if (view !== 1) { drawWing(-1, true); drawWing(1, true); }
  else drawWing(-1, false);
  if (isOrb) {
    sh(p, cx, cy, 4.2 * k, 4.2 * k, C.body, C.bLo, '#ffffff');
    p.ellipse(cx - 0.5, cy + 0.5, 2.6 * k, 2.6 * k, C.belly);
    p.ellipse(cx - 1 * k, cy - 1 * k, 1.2 * k, 1.2 * k, '#ffffff');
    // wispy tail
    for (let i = 0; i < 5; i++) p.ellipse(cx + Math.sin(i + frame) * k, cy + 4 * k + i * 1.4 * k, Math.max(0.6, (2.6 - i * 0.5) * k), Math.max(0.6, 0.9 * k), i % 2 ? C.body : C.belly);
    glow.push([cx, cy, C.body, 1.6 * k]);
  } else {
    sh(p, cx, cy, 4 * k, 3.6 * k, C.body, C.bLo, C.bHi);
    if (view !== 0) p.ellipse(cx + (view === 1 ? 1 : 0), cy + 1 * k, 2.4 * k, 2 * k, C.belly);
    // ears for bats
    if (wingKind === 'bat' && view !== 1) for (const s of [-1, 1]) p.poly([cx + s * 1 * k, cy - 3 * k, cx + s * 3.2 * k, cy - 2.4 * k, cx + s * 2.6 * k, cy - 6 * k], C.body);
    if (wingKind === 'bat' && view === 1) p.poly([cx - 1 * k, cy - 3 * k, cx + 1.5 * k, cy - 3 * k, cx - 0.5 * k, cy - 6 * k], C.body);
    if (wingKind === 'bird') { const bx = view === 1 ? cx + 4 * k : cx; p.poly([bx - 1 * k, cy, bx + (view === 1 ? 3 : 1) * k, cy + 0.8 * k, bx - (view === 1 ? 0 : 1) * k, cy + 1.8 * k], C.acc); }
    if (view === 2) { eyes(st, Math.round(cx - 1.6 * k), Math.round(cy - 0.5 * k), k >= 0.9 ? 2 : 1); eyes(st, Math.round(cx + 1.6 * k) + 1, Math.round(cy - 0.5 * k), k >= 0.9 ? 2 : 1); if (wingKind === 'bat') { p.set(Math.round(cx - 1), Math.round(cy + 1.6 * k), '#ffffff'); p.set(Math.round(cx + 1), Math.round(cy + 1.6 * k), '#ffffff'); } }
    if (view === 1) eyes(st, Math.round(cx + 2 * k), Math.round(cy - 0.5 * k), k >= 0.9 ? 2 : 1);
    // feet
    p.set(Math.round(cx - 1), Math.round(cy + 3.6 * k), C.aLo); p.set(Math.round(cx + 1), Math.round(cy + 3.6 * k), C.aLo);
  }
  if (view === 1) drawWing(1, false);
  else if (view === 2 && wingKind === 'fairy') { /* fairy wings drawn behind */ }
  if (f.has('glow')) glow.push([cx, cy, C.acc, 1.3 * k]);
}

// ------------------------------------------------------------------ plant
function plant(st) {
  const { p, k, f, C, AX, AY, view, anim, frame, glow } = st;
  const sway = anim === 'walk' ? [0, 1, 0, -1][frame] : anim === 'idle' ? (frame ? 1 : 0) : anim === 'attack' ? 2 : 0;
  const cx = AX - 0.5, base = AY - 1;
  const bark = f.has('bark_face');
  const bodyC = bark ? mix(C.body, '#8a5a33', 0.65) : C.body;
  const bLo = dark(bodyC, 0.3), bHi = light(bodyC, 0.25);
  // roots / base
  p.ellipse(cx, base - 0.5, 5 * k, 1.6 * k, bLo);
  for (const s of [-1, 1]) p.line(Math.round(cx + s * 2 * k), Math.round(base - 1), Math.round(cx + s * 5.5 * k), base, bLo);
  // stem/body
  const top = base - (bark ? 13 : 9) * k;
  if (bark) {
    p.rect(Math.round(cx - 3.5 * k + sway * 0.5), Math.round(top), Math.round(7 * k), Math.round(base - top), bodyC);
    p.rect(Math.round(cx + 2 * k + sway * 0.5), Math.round(top), Math.max(1, Math.round(1.5 * k)), Math.round(base - top), bLo);
    p.rect(Math.round(cx - 3.5 * k + sway * 0.5), Math.round(top), 1, Math.round(base - top), bHi);
    for (let i = 0; i < 4; i++) p.vline(Math.round(cx - 1.5 * k + i * 1.4 * k + sway * 0.5), Math.round(top + 2 + i * 2), Math.round(top + 4 + i * 2 + 2 * k), bLo);
  } else {
    sh(p, cx + sway * 0.5, base - 4.5 * k, 4.6 * k, 4.8 * k, bodyC, bLo, bHi);
  }
  const fx = cx + sway;
  if (f.has('leaves')) for (const s of [-1, 1]) {
    const lx = fx + s * 5 * k, ly = base - 6 * k - (anim === 'attack' ? 2 : 0);
    p.ellipse(lx, ly, 3 * k, 1.6 * k, C.acc === '#ff6b8a' ? light(C.body, 0.15) : C.body);
    p.line(Math.round(fx + s * 2 * k), Math.round(ly + 1), Math.round(lx + s * 2 * k), Math.round(ly), bLo);
  }
  if (f.has('vines')) for (const s of [-1, 1]) {
    for (let i = 0; i < 9 * k; i++) p.set(Math.round(fx + s * (3 * k + i * 0.8)), Math.round(base - 5 * k + Math.sin(i * 0.8 + frame * 2) * 1.5 * k + i * 0.3), i % 3 ? C.bLo : C.acc);
  }
  if (f.has('thorns')) {
    for (const [dx, dy] of [[-4.5, -3], [4.2, -5], [-3.5, -7], [3.8, -2], [0, -9]]) {
      const tx = fx + dx * k, ty = base + dy * k;
      p.poly([tx - 0.9 * k, ty, tx + 0.9 * k, ty, tx + Math.sign(dx || 0.1) * 2 * k, ty - 1.5 * k], '#f4ecd8');
    }
  }
  // face
  if (view !== 0) {
    const ey = Math.round(bark ? top + 4 * k : base - 5 * k), ex = view === 1 ? 1.5 * k : 0;
    if (bark) {
      p.rect(Math.round(fx - 2.5 * k + ex), ey - 1, Math.round(1.8 * k), Math.round(1.6 * k), '#2a1a10');
      p.rect(Math.round(fx + 1 * k + ex), ey - 1, Math.round(1.8 * k), Math.round(1.6 * k), '#2a1a10');
      p.set(Math.round(fx - 2 * k + ex), ey - 1, C.eye === '#1a1a2a' ? '#ffe066' : C.eye); p.set(Math.round(fx + 1.4 * k + ex), ey - 1, C.eye === '#1a1a2a' ? '#ffe066' : C.eye);
      p.hline(Math.round(fx - 1.5 * k + ex), Math.round(fx + 1.5 * k + ex), Math.round(ey + 3 * k), '#2a1a10');
    } else {
      if (view === 2) { eyes(st, Math.round(fx - 2 * k), ey, k >= 0.9 ? 2 : 1); eyes(st, Math.round(fx + 2 * k) + 1, ey, k >= 0.9 ? 2 : 1); }
      else eyes(st, Math.round(fx + 2.4 * k), ey, k >= 0.9 ? 2 : 1);
      if (anim === 'attack') p.rect(Math.round(fx - 1 + ex), ey + Math.round(2.4 * k), 3, 2, '#5a1a2a');
    }
  }
  // crown: cap / flower
  if (f.has('cap_mushroom')) {
    const capY = (bark ? top : base - 9 * k) - (anim === 'attack' ? 1 : 0);
    sh(p, fx, capY, 7.5 * k, 4.2 * k, C.acc, C.aLo, C.aHi);
    p.rect(Math.round(fx - 7 * k), Math.round(capY + 1.5 * k), Math.round(14 * k), Math.max(1, Math.round(1.2 * k)), C.belly);
    for (const [sx, sy, r] of [[-4, -1.2, 1.2], [1, -2.4, 1.3], [4.2, -0.4, 1], [-1.2, 0.4, 0.8]]) p.ellipse(fx + sx * k, capY + sy * k, r * k + 0.3, r * k + 0.3, '#ffffff');
  }
  if (f.has('flower')) {
    const fy = (bark ? top : base - 9.5 * k);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + frame * 0.3; sh(p, fx + Math.cos(a) * 3 * k, fy + Math.sin(a) * 2.6 * k, 2 * k, 1.8 * k, C.acc, C.aLo, C.aHi); }
    sh(p, fx, fy, 1.8 * k, 1.8 * k, '#ffe066', '#e0a020', '#fff8c0');
    if (anim === 'cast' || anim === 'attack') glow.push([fx, fy, C.acc, 0.9 * k]);
  }
  if (bark && !f.has('cap_mushroom') && !f.has('flower')) {
    // leafy crown
    for (const [dx, dy, r] of [[-3, -1, 3.2], [3, -1.5, 3], [0, -3.5, 3.5]]) sh(p, fx + dx * k, top + dy * k, r * k, r * 0.8 * k, C.belly === '#c8e6a0' ? '#5fb548' : light(C.body, 0.1), '#3a8a3a', '#9ee07a');
  }
}

// ------------------------------------------------------------------ golem
function golem(st) {
  const { p, k, f, C, AX, AY, view, anim, frame, glow } = st;
  const wood = f.has('wood');
  const body = wood ? mix(C.body, '#8a5a33', 0.7) : C.body;
  const bLo = dark(body, 0.3), bHi = light(body, 0.25), bDk = dark(body, 0.5);
  const walk = anim === 'walk' ? frame : -1;
  const by = anim === 'charge' || anim === 'block' ? 1 : (walk === 1 || walk === 3 ? 1 : 0);
  const cx = AX - 0.5 + (anim === 'charge' ? (frame ? 1 : -1) : 0);
  const legH = 3 * k;
  // legs
  for (const s of [-1, 1]) {
    const lift = (walk === 1 && s < 0) || (walk === 3 && s > 0) ? 1 : 0;
    p.rect(Math.round(cx + s * 3 * k - 1.8 * k), Math.round(AY - legH - 1), Math.round(3.6 * k), Math.round(legH + 1 - lift), bLo);
  }
  // torso
  const ty = AY - legH - 7.5 * k + by;
  const side = view === 1;
  const tw = side ? 5.5 * k : 7 * k;
  sh(p, cx, ty, tw, 6 * k, body, bLo, bHi);
  p.rect(Math.round(cx - tw * 0.85), Math.round(ty), Math.round(tw * 1.7), Math.round(4 * k), body);
  p.rect(Math.round(cx - tw * 0.85), Math.round(ty + 3 * k), Math.round(tw * 1.7), Math.max(1, Math.round(1 * k)), bLo);
  if (wood) for (let i = -2; i <= 2; i++) p.vline(Math.round(cx + i * 2.3 * k), Math.round(ty - 4 * k), Math.round(ty + 3 * k), bLo);
  if (f.has('rocky')) for (const [dx, dy] of [[-3, -2], [2.5, 0.5], [-1, 2], [3.5, -3.5]]) { p.ellipse(cx + dx * k, ty + dy * k, 1.4 * k, 1 * k, bHi); p.set(Math.round(cx + dx * k + 1), Math.round(ty + dy * k + 1), bDk); }
  // core rune on the chest
  if (view !== 0 && !side) { p.rect(Math.round(cx - 1), Math.round(ty - 1), 2, 2, C.eye); glow.push([cx, ty, C.eye, 0.7 * k]); }
  // head
  const hy = ty - 6 * k;
  const hx = cx + (side ? 2 * k : 0);
  sh(p, hx, hy, 4 * k, 3.4 * k, body, bLo, bHi);
  p.rect(Math.round(hx - 3.5 * k), Math.round(hy - 0.8 * k), Math.round(7 * k) + (side ? 0 : 1), Math.max(1, Math.round(0.8 * k)), bDk); // heavy brow
  const ew = Math.max(2, Math.round(1.6 * k)), eh = Math.max(1, Math.round(1.1 * k));
  if (view === 2) {
    p.rect(Math.round(hx - 2.4 * k), Math.round(hy + 0.2 * k), ew, eh, C.eye); p.rect(Math.round(hx + 0.9 * k), Math.round(hy + 0.2 * k), ew, eh, C.eye);
    p.set(Math.round(hx - 2.4 * k), Math.round(hy + 0.2 * k), '#ffffff'); p.set(Math.round(hx + 0.9 * k), Math.round(hy + 0.2 * k), '#ffffff');
    p.rect(Math.round(hx - 1.2 * k), Math.round(hy + 1.8 * k), Math.round(2.4 * k), 1, bDk);
    glow.push([hx, hy + 0.5 * k, C.eye, 0.7 * k]);
  }
  if (side) { p.rect(Math.round(hx + 1.5 * k), Math.round(hy + 0.2 * k), ew, eh, C.eye); p.set(Math.round(hx + 1.5 * k), Math.round(hy + 0.2 * k), '#ffffff'); glow.push([hx + 2 * k, hy + 0.5 * k, C.eye, 0.5 * k]); }
  // arms (big)
  const swing = walk === 1 ? 1 : walk === 3 ? -1 : 0;
  const armUp = anim === 'attack' ? -4 * k : anim === 'cast' ? -6 * k : 0;
  for (const s of side ? [1] : [-1, 1]) {
    const ax = side ? cx + 2 * k : cx + s * (tw + 1.2 * k);
    const ay = ty + 1 * k + s * swing + armUp;
    sh(p, ax, ay - 2 * k, 2.4 * k, 2.4 * k, body, bLo, bHi);
    p.rect(Math.round(ax - 1.8 * k), Math.round(ay - 1 * k), Math.round(3.6 * k), Math.round(5 * k), body);
    p.rect(Math.round(ax + 0.8 * k), Math.round(ay - 1 * k), Math.max(1, Math.round(1 * k)), Math.round(5 * k), bLo);
    sh(p, ax, ay + 4.5 * k, 2.6 * k, 2 * k, bLo, bDk, body);
  }
  if (f.has('mossy')) {
    const m = C.accent || C.acc;
    p.ellipse(cx - 0.5 * k, ty - 5.2 * k, tw * 0.95, 1.6 * k, C.acc);
    p.ellipse(cx - 2 * k, hy - 2.4 * k, 2.4 * k, 1 * k, C.acc);
    for (let i = -3; i <= 3; i++) p.set(Math.round(cx + i * 1.6 * k), Math.round(ty - 4 * k + (i & 1)), C.aLo);
    p.set(Math.round(cx + 3 * k), Math.round(ty - 6 * k), '#ff8fc7');
    void m;
  }
  if (f.has('crystal')) {
    for (const [dx, h] of [[-4, 5], [-2, 7], [3.5, 6]]) {
      const x = cx + dx * k, y = ty - 4.5 * k;
      p.poly([x - 1.2 * k, y, x + 1.2 * k, y, x + 0.2 * k, y - h * k], '#9fe6ff');
      p.line(Math.round(x), Math.round(y), Math.round(x + 0.2 * k), Math.round(y - h * k + 1), '#e8fbff');
    }
    glow.push([cx - 2 * k, ty - 8 * k, '#9fe6ff', 0.9 * k]);
  }
  if (f.has('antlers')) antlers(p, cx, hy - 2 * k, k, wood ? '#d9b07a' : '#c8a070');
}

function antlers(p, cx, y, k, c) {
  const lo = dark(c, 0.3);
  for (const s of [-1, 1]) {
    p.thick(Math.round(cx + s * 1.5 * k), Math.round(y), Math.round(cx + s * 5 * k), Math.round(y - 5 * k), Math.max(1, Math.round(k)), c);
    p.thick(Math.round(cx + s * 3.5 * k), Math.round(y - 3 * k), Math.round(cx + s * 2.5 * k), Math.round(y - 7 * k), Math.max(1, Math.round(k * 0.8)), c);
    p.thick(Math.round(cx + s * 5 * k), Math.round(y - 5 * k), Math.round(cx + s * 7.5 * k), Math.round(y - 6.5 * k), Math.max(1, Math.round(k * 0.8)), lo);
  }
}

// ------------------------------------------------------------------ mossback (boss)
function mossback(st) {
  const { p, C, AX, AY, view, anim, frame, glow } = st;
  const k = st.k / 2.2 * 1.0 * 2.2; // geometry scale (size 2.2 is the design size)
  const bark = mix(C.body, '#7a5233', 0.4), bLo = dark(bark, 0.32), bHi = light(bark, 0.2), bDk = dark(bark, 0.55);
  const moss = C.acc, mLo = dark(moss, 0.3), mHi = light(moss, 0.3);
  const walk = anim === 'walk' ? frame : -1;
  const stomp = walk === 1 || walk === 3 ? 1 : 0;
  const lunge = anim === 'attack' ? 1 : 0;
  const cx = AX - 0.5 + (anim === 'charge' ? (frame ? 1 : -1) : 0);
  const side = view === 1;
  // root legs
  for (const s of [-1, 1]) {
    const lift = (walk === 1 && s < 0) || (walk === 3 && s > 0) ? 2 : 0;
    const lx = cx + s * 4 * k;
    p.poly([lx - 3 * k, AY - 1 - lift, lx + 3 * k, AY - 1 - lift, lx + 2 * k, AY - 6 * k, lx - 2 * k, AY - 6 * k], bLo);
    p.line(Math.round(lx - 3 * k), AY - 1 - lift, Math.round(lx - 5 * k), AY - 1, bLo);
    p.line(Math.round(lx + 3 * k), AY - 1 - lift, Math.round(lx + 5 * k), AY - 1, bLo);
  }
  // trunk body
  const ty = AY - 6 * k + stomp;
  const top = ty - 15 * k;
  const tw = side ? 6 * k : 8 * k;
  p.poly([cx - tw, ty, cx + tw, ty, cx + tw * 0.85, top + 3 * k, cx - tw * 0.85, top + 3 * k], bark);
  sh(p, cx, top + 3 * k, tw * 0.85, 3 * k, bark, bLo, bHi);
  for (let i = -3; i <= 3; i++) p.line(Math.round(cx + i * 2.2 * k), Math.round(ty - 1), Math.round(cx + i * 2 * k + (i % 2)), Math.round(top + 5 * k), bLo);
  p.poly([cx + tw * 0.55, ty, cx + tw, ty, cx + tw * 0.85, top + 3 * k, cx + tw * 0.6, top + 3 * k], bLo);
  p.poly([cx - tw, ty, cx - tw * 0.75, ty, cx - tw * 0.6, top + 3 * k, cx - tw * 0.85, top + 3 * k], bHi);
  // face
  if (view !== 0) {
    const fy = top + 7 * k, ex = side ? 3 * k : 0;
    for (const s of side ? [1] : [-1, 1]) {
      const x = cx + ex + s * 2.8 * k;
      p.ellipse(x, fy, 1.8 * k, 1.3 * k, bDk);
      p.ellipse(x, fy, 1 * k, 0.8 * k, C.eye);
      glow.push([x, fy, C.eye, 0.9]);
    }
    // brow
    p.thick(Math.round(cx + ex - 5 * k), Math.round(fy - 2.2 * k), Math.round(cx + ex - 1 * k), Math.round(fy - 1.5 * k), Math.max(1, Math.round(k * 0.6)), bDk);
    if (!side) p.thick(Math.round(cx + 5 * k), Math.round(fy - 2.2 * k), Math.round(cx + 1 * k), Math.round(fy - 1.5 * k), Math.max(1, Math.round(k * 0.6)), bDk);
    // mouth: a knot hollow
    const my = fy + 4 * k;
    p.ellipse(cx + ex, my, (anim === 'attack' || anim === 'cast' ? 2.6 : 2.2) * k, (anim === 'attack' || anim === 'cast' ? 1.8 : 0.9) * k, '#2a1a10');
  }
  // arms (branches)
  const raise = anim === 'attack' ? -6 * k : anim === 'cast' ? -9 * k : anim === 'charge' ? -3 * k : 0;
  for (const s of side ? [1] : [-1, 1]) {
    const sx = cx + s * tw * 0.9, sy = top + 7 * k;
    const ex = sx + s * (side ? 5 + lunge * 3 : 7) * k, ey = sy + 7 * k + raise;
    p.thick(Math.round(sx), Math.round(sy), Math.round(ex), Math.round(ey), Math.max(2, Math.round(2.2 * k)), bark);
    p.thick(Math.round(sx), Math.round(sy + 1), Math.round(ex), Math.round(ey + 1), Math.max(1, Math.round(0.8 * k)), bLo);
    // twig fingers
    for (const [a, b] of [[-2, 3], [1, 4], [3, 2]]) p.thick(Math.round(ex), Math.round(ey), Math.round(ex + s * a * k * 0.6 + s * k), Math.round(ey + b * k * 0.7), Math.max(1, Math.round(0.7 * k)), bLo);
    // mossy shoulder
    sh(p, sx, sy - 1 * k, 3 * k, 2.2 * k, moss, mLo, mHi);
  }
  // moss carpet on top + canopy
  for (const [dx, dy, r] of [[-5, 1, 4.2], [4.5, 0.5, 4.4], [0, -1.5, 5], [-2, 2, 3], [2.5, 2.5, 3]]) sh(p, cx + dx * k, top + dy * k, r * k, r * 0.7 * k, moss, mLo, mHi);
  for (let i = -6; i <= 6; i += 2) p.vline(Math.round(cx + i * k), Math.round(top + 3.5 * k), Math.round(top + 4.5 * k + Math.abs(i % 4)), mLo);
  // mushrooms and flowers on the moss
  sh(p, cx - 6 * k, top - 1 * k, 1.8 * k, 1.1 * k, '#e8503c', '#a83020', '#ff8a6a');
  p.set(Math.round(cx - 6.5 * k), Math.round(top - 1.4 * k), '#ffffff');
  p.set(Math.round(cx + 3 * k), Math.round(top - 2.5 * k), '#ff8fc7'); p.set(Math.round(cx - 1 * k), Math.round(top - 3 * k), '#ffe066');
  // antler branches
  antlers(p, cx, top - 2 * k, k * 1.2, '#a8805a');
  void bDk;
}
