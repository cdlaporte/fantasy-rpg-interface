// Round 3 creature features and boss heroes for the 2D fallback (docs/BIOMES.md). Called from creatures.js with its
// paint state `st` = {p, k, f, C, AX, AY, view, anim, frame, glow}; views: 0 up (back), 1 right (left is mirrored), 2 down.
import { dark, light, mix } from './color.js';

const R = (p, x, y, w, h, c) => p.rect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), c);
const sh = (p, cx, cy, rx, ry, c, lo, hi) => p.shaded(cx, cy, Math.max(1, rx), Math.max(1, ry), c, lo, hi);
const GOLD = '#ffd24a';

function eyeDots(st, x, y, big) {
  const { p, C, anim } = st;
  if (anim === 'ko') { p.set(x - 1, y - 1, C.eye); p.set(x + 1, y + 1, C.eye); p.set(x + 1, y - 1, C.eye); p.set(x - 1, y + 1, C.eye); return; }
  if (anim === 'sleep') { p.hline(x - 1, x + 1, y, C.eye); return; }
  if (big) { p.rect(x - 1, y - 1, 2, 3, C.eye); p.set(x - 1, y - 1, '#ffffff'); } else { p.set(x, y, C.eye); p.set(x, y - 1, C.eye); }
}

// ---------------------------------------------------------------- quadruped features
/** Shell over the back. (cx, by) body center, rx/ry body radii. */
export function qShell(st, cx, by, rx, ry) {
  const { p, C, k } = st;
  const shc = light(C.body, 0.12);
  sh(p, cx, by - ry * 0.35, rx * 0.95, ry * 0.85, shc, dark(shc, 0.3), light(shc, 0.3));
  if (st.view !== 1) p.vline(Math.round(cx), Math.round(by - ry * 1.1), Math.round(by + ry * 0.3), dark(shc, 0.35));
  else p.hline(Math.round(cx - rx * 0.7), Math.round(cx + rx * 0.7), Math.round(by - ry * 0.3), dark(shc, 0.35));
  for (const [dx, dy] of [[-0.4, -0.6], [0.35, -0.75], [0.1, -0.2]]) p.ellipse(cx + dx * rx, by + dy * ry, Math.max(0.8, 0.9 * k), Math.max(0.6, 0.7 * k), C.acc);
  p.set(Math.round(cx - rx * 0.5), Math.round(by - ry), '#ffffff');
}
/** Scorpion tail: segments arching over the back from (x0, y0) toward dir (+1 forward in side view). */
export function qStinger(st, x0, y0, dirX) {
  const { p, C, k } = st;
  const pts = [[0, 0], [-1.5, -3], [-1, -6.5], [1, -9], [3.5, -9.5]];
  pts.forEach(([dx, dy], i) => sh(p, x0 + dx * k * dirX, y0 + dy * k, 1.8 * k, 1.6 * k, i % 2 ? C.body : C.bLo, C.bDk, C.bHi));
  const tx = x0 + 5.5 * k * dirX, ty = y0 - 8.5 * k;
  p.poly([tx - 1.2 * k * dirX, ty - 1.2 * k, tx - 1.2 * k * dirX, ty + 1.2 * k, tx + 1.8 * k * dirX, ty + 1.8 * k], C.acc);
}
/** A pincer claw at (x, y) opening toward dirX (side) or downward (front: dirX = 0). */
export function qClaw(st, x, y, dirX, s) {
  const { p, C, k } = st;
  const cc = light(C.body, 0.06);
  sh(p, x, y, 2.4 * k, 2 * k, cc, C.bLo, C.bHi);
  if (dirX) {
    p.poly([x + dirX * 1 * k, y - 2 * k, x + dirX * 4.5 * k, y - 2.5 * k, x + dirX * 1.5 * k, y - 0.2 * k], cc);
    p.poly([x + dirX * 1 * k, y + 0.5 * k, x + dirX * 4 * k, y + 1.5 * k, x + dirX * 1 * k, y + 2 * k], C.bLo);
  } else {
    p.poly([x - 1.8 * k * s, y + 1 * k, x - 2.2 * k * s, y + 4.5 * k, x - 0.2 * k * s, y + 1.5 * k], cc);
    p.poly([x + 0.6 * k * s, y + 1.2 * k, x + 1.4 * k * s, y + 4 * k, x + 1.8 * k * s, y + 1 * k], C.bLo);
  }
}
export function qLongEars(st, hx, hy, side) {
  const { p, C, k } = st;
  const xs = side ? [-0.8] : [-1.6, 1.6];
  for (const dx of xs) {
    const x = hx + dx * k;
    p.poly([x - 1.2 * k, hy - 2 * k, x + 1.2 * k, hy - 2 * k, x + 0.9 * k, hy - 9 * k, x - 0.6 * k, hy - 9 * k], C.body);
    p.vline(Math.round(x), Math.round(hy - 8 * k), Math.round(hy - 3 * k), mix(C.acc, '#ffffff', 0.25));
  }
}
export function qHorns(st, hx, hy, side) {
  const { p, k } = st;
  for (const s of side ? [-1] : [-1, 1]) {
    p.thick(Math.round(hx + s * 2 * k), Math.round(hy - 2.5 * k), Math.round(hx + s * 3.6 * k), Math.round(hy - 5.5 * k), Math.max(1, Math.round(k)), '#f6ead0');
    p.set(Math.round(hx + s * 4.2 * k), Math.round(hy - 6.2 * k), '#c8a070');
  }
}
export function qAntennae(st, hx, hy) {
  const { p, C, k } = st;
  for (const s of [-1, 1]) { p.line(Math.round(hx + s * 1 * k), Math.round(hy - 2.5 * k), Math.round(hx + s * 2.6 * k), Math.round(hy - 6 * k), C.bDk); p.set(Math.round(hx + s * 2.6 * k), Math.round(hy - 6.5 * k), C.acc); }
}

// ---------------------------------------------------------------- blob / flyer / plant features
export function bTentacles(st, cx, y0, rx) {
  const { p, C, k, frame } = st;
  for (let i = 0; i < 5; i++) {
    const x = cx + (i - 2) * rx * 0.38;
    for (let j = 0; j < 5 * k; j++) p.set(Math.round(x + Math.sin(j * 0.7 + i + frame) * 0.9 * k), Math.round(y0 + j), i % 2 ? mix(C.body, C.acc, 0.4) : C.body);
    p.set(Math.round(x), Math.round(y0 + 5 * k), light(C.body, 0.3));
  }
}
export function bBubbles(st, cx, cy, rx, ry) {
  const { p, C, k, glow } = st;
  for (const [dx, dy, r] of [[0.9, -0.9, 1.4], [-1.05, -0.5, 1.1], [0.6, -1.4, 1], [1.2, 0.1, 0.8]]) {
    const x = cx + dx * rx, y = cy + dy * ry, rr = Math.max(1, r * k);
    p.ellipse(x, y, rr, rr, mix(C.acc, '#ffffff', 0.55));
    p.set(Math.round(x - rr * 0.4), Math.round(y - rr * 0.4), '#ffffff');
  }
  glow.push([cx + 0.9 * rx, cy - 0.9 * ry, mix(C.acc, '#ffffff', 0.5), 0.5 * k]);
}
/** Moth wings: drawn behind the body. */
export function fInsectWings(st, cx, cy, flap) {
  const { p, C, k, view } = st;
  const wc = mix(C.acc, '#ffffff', 0.45), lift = [-2, 0, 1.5][flap] * k;
  for (const s of view === 1 ? [-1] : [-1, 1]) {
    p.ellipse(cx + s * 5 * k, cy - 2 * k + lift, 4.2 * k, 3 * k, wc);
    p.ellipse(cx + s * 4 * k, cy + 2.5 * k + lift * 0.5, 2.8 * k, 2 * k, dark(wc, 0.08));
    p.ellipse(cx + s * 5.5 * k, cy - 2.5 * k + lift, 1.2 * k, 1.2 * k, C.acc);
    p.set(Math.round(cx + s * 5.5 * k), Math.round(cy - 2.5 * k + lift), '#ffffff');
  }
}
/** A walking cactus body (replaces the plant stem): returns the face y. */
export function pCactus(st, cx, base) {
  const { p, C, k } = st;
  const lo = dark(C.body, 0.28), hi = light(C.body, 0.22);
  const top = base - 11 * k;
  R(p, cx - 3.5 * k, top + 2 * k, 7 * k, base - top - 2 * k, C.body);
  sh(p, cx, top + 2.5 * k, 3.5 * k, 2.5 * k, C.body, lo, hi);
  R(p, cx + 2 * k, top + 2 * k, Math.max(1, 1.2 * k), base - top - 2 * k, lo);
  R(p, cx - 3.5 * k, top + 2 * k, 1, base - top - 2 * k, hi);
  for (const s of [-1, 1]) {
    R(p, cx + s * 3.5 * k + (s < 0 ? -2.5 * k : 0), base - 6 * k, 2.5 * k, 2 * k, C.body);
    R(p, cx + s * 5 * k - 1 * k, base - 9 * k, 2.2 * k, 4 * k, C.body);
    p.set(Math.round(cx + s * 5 * k), Math.round(base - 9.5 * k), C.acc);
  }
  for (const [dx, dy] of [[-2, -3], [1.5, -5], [-1, -8], [2.5, -9], [0, -2]]) p.set(Math.round(cx + dx * k), Math.round(base + dy * k), '#fffbe6');
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; p.ellipse(cx + Math.cos(a) * 1.6 * k, top + 1 * k + Math.sin(a) * 0.8 * k, Math.max(0.8, 1.1 * k), Math.max(0.6, 0.8 * k), C.acc); }
  p.set(Math.round(cx), Math.round(top + 1 * k), GOLD);
  return Math.round(base - 6 * k);
}
export function pSeaweed(st, cx, top) {
  const { p, C, k, frame } = st;
  const kelp = mix(C.body, '#3fae7a', 0.35);
  for (const [dx, len] of [[-2, 9], [0, 11], [2.2, 8]]) {
    for (let j = 0; j < len * k; j++) {
      const x = cx + dx * k + Math.sin(j * 0.5 + frame + dx) * 1.2 * k, y = top - j;
      R(p, x - 0.8 * k, y, Math.max(1, 1.6 * k), 1, j % 4 ? kelp : light(kelp, 0.2));
    }
    p.ellipse(cx + dx * k, top - len * k * 0.55, Math.max(0.8, 0.9 * k), Math.max(0.8, 0.9 * k), C.acc);
  }
}

// ---------------------------------------------------------------- golem features
export function gBiome(st, cx, ty, tw, hy, body) {
  const { p, f, C, k, glow } = st;
  if (f.has('sandy')) {
    for (let i = 0; i < 3; i++) p.hline(Math.round(cx - tw * 0.8), Math.round(cx + tw * 0.8), Math.round(ty - 3 * k + i * 2.5 * k), mix(body, '#c88850', 0.4));
    p.ellipse(cx, ty - 1 * k, Math.max(1, 1.2 * k), Math.max(1, 1.2 * k), C.acc);
    glow.push([cx, ty - 1 * k, C.acc, 0.6 * k]);
    p.poly([cx - 2 * k, hy - 3 * k, cx + 2 * k, hy - 3 * k, cx, hy - 6 * k], mix(body, '#c88850', 0.2));
  }
  if (f.has('icy')) {
    p.ellipse(cx, ty - 5.4 * k, tw * 0.9, 1.4 * k, '#ffffff');
    p.ellipse(cx, hy - 2.8 * k, 3 * k, 1 * k, '#ffffff');
    for (const [dx, h] of [[-4.5, 5], [-2, 7], [3.5, 6], [5, 4]]) {
      const x = cx + dx * k, y = ty - 4.5 * k;
      p.poly([x - 1.2 * k, y, x + 1.2 * k, y, x + 0.2 * k, y - h * k], mix(C.acc, '#bfeeff', 0.5));
      p.line(Math.round(x), Math.round(y), Math.round(x + 0.2 * k), Math.round(y - h * k + 1), '#ffffff');
    }
    glow.push([cx, ty - 8 * k, '#bfeeff', 0.8 * k]);
  }
  if (f.has('coral')) {
    for (const [dx, dx2, h] of [[-4, -6, 6], [-2, -1, 8], [3.5, 5.5, 6]]) {
      p.thick(Math.round(cx + dx * k), Math.round(ty - 4.5 * k), Math.round(cx + dx2 * k), Math.round(ty - (4.5 + h) * k), Math.max(1, Math.round(1.2 * k)), C.acc);
      p.ellipse(cx + dx2 * k, ty - (4.5 + h) * k, Math.max(1, 1.1 * k), Math.max(1, 1.1 * k), light(C.acc, 0.3));
    }
    for (const [dx, dy] of [[-3, 1], [2.5, -1], [0, 2.5]]) p.set(Math.round(cx + dx * k), Math.round(ty + dy * k), '#f4ecdc');
    p.set(Math.round(cx + 1 * k), Math.round(ty + 0.5 * k), '#ff9a5a');
  }
  if (f.has('starry')) {
    for (const [dx, dy] of [[-3, -2], [2.5, -3], [-1, 1.5], [3, 1], [-4, 0.5], [0.5, -4]]) p.set(Math.round(cx + dx * k), Math.round(ty + dy * k), (dx * dy) % 2 ? '#fff6c0' : '#ffffff');
    p.line(Math.round(cx - 3 * k), Math.round(ty - 2 * k), Math.round(cx + 2.5 * k), Math.round(ty - 3 * k), mix(C.acc, '#ffffff', 0.4));
    p.ellipse(cx, hy - 4 * k, 3.4 * k, 1 * k, C.acc); p.ellipse(cx, hy - 4 * k, 2.4 * k, 0.5 * k, body);
    glow.push([cx, ty - 1 * k, C.acc, 0.7 * k]);
  }
}

// ---------------------------------------------------------------- bosses
/** Sultana Sandsnout: a regal sand sphinx in a striped headdress (size-scaled like Mossback). */
export function sphinx(st) {
  const { p, k, C, AX, AY, view, anim, frame } = st;
  const body = C.body, lo = C.bLo, hi = C.bHi, stripe = C.acc;
  const walk = anim === 'walk' ? frame : -1;
  const side = view === 1, back = view === 0;
  const cx = AX - 0.5, legH = 3.5 * k, bodyRx = (side ? 8.5 : 6.5) * k, bodyRy = 4.6 * k;
  const by = AY - legH - bodyRy + 1;
  // legs and paws
  const legs = side ? [-5.5, -3, 4, 6.5] : [-4, -1.5, 1.5, 4];
  legs.forEach((dx, i) => {
    const lift = (walk === 1 && i % 2 === 0) || (walk === 3 && i % 2 === 1) ? 1 : 0;
    R(p, cx + dx * k - 1.2 * k, AY - legH - 1, 2.4 * k, legH + 1 - lift, i < 2 && side ? C.bDk : lo);
    R(p, cx + dx * k - 1.5 * k + (side ? 0.6 * k : 0), AY - 1.5 - lift, 3 * k, 1.5, body);
  });
  sh(p, cx, by, bodyRx, bodyRy, body, lo, hi);
  p.ellipse(cx + (side ? 1 : 0) * k, by + bodyRy * 0.45, bodyRx * 0.7, bodyRy * 0.4, C.belly);
  // folded wings on the flank
  const wx = side ? cx - 1.5 * k : cx;
  for (let i = 0; i < 3; i++) p.ellipse(wx - i * 1.2 * k * (side ? 1 : 0), by - bodyRy * 0.25 + i * 0.6 * k, (side ? 5 : 6.5) * k - i * k, 1.4 * k, i === 0 ? mix(body, GOLD, 0.5) : i === 1 ? stripe : light(stripe, 0.3));
  // tail
  const tx = side ? cx - bodyRx : cx, ty = by - 1 * k;
  if (side || back) { p.thick(Math.round(tx), Math.round(ty), Math.round(tx - (side ? 3 : 0) * k), Math.round(ty - 5 * k), Math.max(1, Math.round(0.8 * k)), body); p.ellipse(tx - (side ? 3 : 0) * k, ty - 6 * k, 1.4 * k, 1.6 * k, stripe); }
  if (back) {
    // headdress from behind
    const hy = by - bodyRy - 2 * k;
    sh(p, cx, hy, 5.5 * k, 5 * k, stripe, dark(stripe, 0.3), light(stripe, 0.3));
    for (let i = 0; i < 3; i++) p.hline(Math.round(cx - 5 * k), Math.round(cx + 5 * k), Math.round(hy - 2 * k + i * 2.5 * k), GOLD);
    return;
  }
  // head: nemes headdress around a friendly cat face, gold collar
  const hx = cx + (side ? bodyRx * 0.75 : 0), hy = by - bodyRy * 0.6 - (anim === 'attack' ? 1 : 0);
  p.ellipse(hx, hy + 4.5 * k, 5.5 * k, 1.6 * k, GOLD);
  for (let i = -2; i <= 2; i++) p.set(Math.round(hx + i * 2 * k), Math.round(hy + 5 * k), i % 2 ? '#ff5a7a' : '#3fc8d8');
  // hood (flares to the shoulders) with stripes
  p.poly([hx - 4.5 * k, hy - 4 * k, hx + 4.5 * k, hy - 4 * k, hx + 6.5 * k, hy + 4 * k, hx - 6.5 * k, hy + 4 * k], stripe);
  for (let i = 0; i < 4; i++) { const y = hy - 2.5 * k + i * 2 * k, w = 5 * k + i * 0.5 * k; p.hline(Math.round(hx - w), Math.round(hx + w), Math.round(y), GOLD); }
  sh(p, hx, hy - 4.5 * k, 4.5 * k, 2.5 * k, stripe, dark(stripe, 0.3), light(stripe, 0.3));
  // face
  sh(p, hx + (side ? 1 : 0) * k, hy + 0.5 * k, 3.8 * k, 3.6 * k, body, lo, hi);
  p.ellipse(hx + (side ? 2.5 : 0) * k, hy + 2.2 * k, 2.2 * k, 1.4 * k, C.belly);
  R(p, hx - 3.2 * k + (side ? 1 : 0) * k, hy - 2.6 * k, 6.4 * k, Math.max(1, 0.9 * k), GOLD);
  p.set(Math.round(hx + (side ? 1 : 0) * k), Math.round(hy - 2.2 * k), '#3fc8d8');
  if (side) eyeDots(st, Math.round(hx + 2.2 * k), Math.round(hy), k >= 0.9);
  else { eyeDots(st, Math.round(hx - 1.6 * k), Math.round(hy), k >= 0.9); eyeDots(st, Math.round(hx + 1.6 * k) + 1, Math.round(hy), k >= 0.9); }
  p.set(Math.round(hx + (side ? 3.5 : 0) * k), Math.round(hy + 1.6 * k), '#a8604a');
  if (anim === 'attack' || anim === 'cast') R(p, hx - 1 + (side ? 3 : 0) * k, hy + 2.6 * k, 3, 2, '#7a2a3a');
  p.poly([hx - 1 * k, hy - 6.5 * k, hx + 1 * k, hy - 6.5 * k, hx, hy - 9 * k], GOLD);
}

/** Captain Clawsworth: a giant crab in a navy captain's hat. */
export function crabKing(st) {
  const { p, k, C, AX, AY, view, anim, frame } = st;
  const body = C.body, lo = C.bLo, hi = C.bHi, hat = C.acc;
  const walk = anim === 'walk' ? frame : -1;
  const side = view === 1, back = view === 0;
  const cx = AX - 0.5, rx = (side ? 7 : 9) * k, ry = 4.5 * k, by = AY - 3 * k - ry;
  // legs: three per side, scuttling
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const lift = walk >= 0 && ((i + (s > 0 ? 1 : 0) + walk) % 2) ? 1 : 0;
    const x0 = cx + s * (rx * 0.7) - (side ? (i - 1) * 3 * k : 0), y0 = by + ry * 0.3 + (side ? 0 : (i - 1) * k);
    p.thick(Math.round(x0), Math.round(y0), Math.round(x0 + s * (side ? 0.5 : 3) * k), Math.round(AY - 1 - lift), Math.max(1, Math.round(0.9 * k)), i === 1 ? lo : C.bDk);
  }
  sh(p, cx, by, rx, ry, body, lo, hi);
  p.ellipse(cx, by + ry * 0.5, rx * 0.75, ry * 0.4, C.belly);
  for (const [dx, dy] of [[-0.5, -0.5], [0.4, -0.6], [0.1, -0.1]]) p.set(Math.round(cx + dx * rx), Math.round(by + dy * ry), light(body, 0.35));
  // claws: huge, raised on attack
  const raise = anim === 'attack' ? -3 * k : anim === 'block' ? -1 * k : 0;
  const clawY = by - 1 * k + raise;
  if (side) qClaw(st, cx + rx + 1.5 * k, clawY, 1, 1);
  else if (!back) for (const s of [-1, 1]) { sh(p, cx + s * (rx + 2 * k), clawY, 3.6 * k, 3 * k, body, lo, hi); p.poly([cx + s * (rx + 1 * k), clawY + 2 * k, cx + s * (rx + 0.5 * k), clawY + 6 * k, cx + s * (rx + 2.5 * k), clawY + 2.5 * k], light(body, 0.1)); p.poly([cx + s * (rx + 3 * k), clawY + 2 * k, cx + s * (rx + 4.5 * k), clawY + 5.5 * k, cx + s * (rx + 4.5 * k), clawY + 1.5 * k], lo); }
  else for (const s of [-1, 1]) sh(p, cx + s * (rx + 2 * k), clawY, 3.4 * k, 2.8 * k, body, lo, hi);
  // eye stalks + eyes
  if (!back) {
    for (const s of side ? [1] : [-1, 1]) {
      const ex = cx + (side ? rx * 0.5 : s * 2.2 * k), ey = by - ry - 3 * k;
      R(p, ex - 0.5, ey + 1 * k, 1, 3 * k, lo);
      p.ellipse(ex, ey, Math.max(1.2, 1.6 * k), Math.max(1.2, 1.7 * k), '#ffffff');
      p.ellipse(ex + (side ? 0.5 : 0), ey + 0.3 * k, Math.max(0.6, 0.8 * k), Math.max(0.8, 1 * k), C.eye);
    }
    // mustache
    if (!side) for (const s of [-1, 1]) p.thick(Math.round(cx), Math.round(by + 0.5 * k), Math.round(cx + s * 3 * k), Math.round(by - 0.5 * k), Math.max(1, Math.round(0.7 * k)), '#f6f0e6');
  }
  // captain's bicorne
  const hy = by - ry - (back ? 1 : 0) * k;
  p.ellipse(cx, hy, 5.5 * k, 2.2 * k, hat);
  p.poly([cx - 6 * k, hy + 0.5 * k, cx + 6 * k, hy + 0.5 * k, cx + 4 * k, hy - 2.5 * k, cx - 4 * k, hy - 2.5 * k], hat);
  p.hline(Math.round(cx - 5.5 * k), Math.round(cx + 5.5 * k), Math.round(hy + 0.5 * k), GOLD);
  if (!back) { p.ellipse(cx, hy - 0.8 * k, Math.max(1, 1.3 * k), Math.max(1, 1.1 * k), '#ffffff'); p.set(Math.round(cx), Math.round(hy - 0.8 * k), GOLD); }
  p.set(Math.round(cx + 5 * k), Math.round(hy - 1 * k), '#ff6b6b');
}

/** Grumbleflake: a huge fluffy grumpy yeti. */
export function yeti(st) {
  const { p, k, C, AX, AY, view, anim, frame } = st;
  const fur = C.body, fur2 = C.belly, skin = C.acc;
  const lo = mix(fur, '#8aa4c8', 0.45), hi = '#ffffff';
  const walk = anim === 'walk' ? frame : -1;
  const side = view === 1, back = view === 0;
  const cx = AX - 0.5, legH = 3 * k;
  for (const s of [-1, 1]) {
    const lift = (walk === 1 && s < 0) || (walk === 3 && s > 0) ? 1 : 0;
    sh(p, cx + s * 3.5 * k, AY - legH, 2.6 * k, legH, fur, lo, hi);
    p.ellipse(cx + s * 3.5 * k + (side ? 1 : 0) * k, AY - 1.5 - lift, 2.8 * k, 1.4 * k, skin);
  }
  const ty = AY - legH - 7 * k;
  const tw = (side ? 6 : 7.5) * k;
  sh(p, cx, ty, tw, 7.5 * k, fur, lo, hi);
  // fur tufts around the silhouette
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; p.ellipse(cx + Math.cos(a) * tw * 0.95, ty + Math.sin(a) * 7 * k, Math.max(1, 1.6 * k), Math.max(1, 1.4 * k), i % 3 === 2 ? fur2 : fur); }
  if (!back) p.ellipse(cx + (side ? 1.5 : 0) * k, ty + 1.5 * k, tw * 0.55, 4.5 * k, fur2);
  // arms
  const swing = walk === 1 ? 1 : walk === 3 ? -1 : 0, up = anim === 'attack' ? -5 * k : anim === 'cast' ? -7 * k : 0;
  for (const s of side ? [1] : [-1, 1]) {
    const ax = side ? cx + 2 * k : cx + s * (tw + 1.5 * k), ay = ty + s * swing + up;
    sh(p, ax, ay, 2.8 * k, 4.5 * k, fur, lo, hi);
    sh(p, ax, ay + 4.8 * k, 2.4 * k, 2 * k, skin, dark(skin, 0.25), light(skin, 0.25));
  }
  // head with a blue-grey face patch, grumpy brows, tiny ice horns
  const hy = ty - 8 * k, hx = cx + (side ? 2 * k : 0);
  sh(p, hx, hy, 4.8 * k, 4.2 * k, fur, lo, hi);
  for (const s of side ? [-1] : [-1, 1]) p.poly([hx + s * 2.5 * k, hy - 3 * k, hx + s * 4 * k, hy - 3.5 * k, hx + s * 4.5 * k, hy - 7 * k], '#bfeeff');
  if (back) return;
  const fx = hx + (side ? 1.5 : 0) * k;
  sh(p, fx, hy + 1 * k, 3.2 * k, 2.6 * k, skin, dark(skin, 0.2), light(skin, 0.2));
  if (side) eyeDots(st, Math.round(fx + 1.2 * k), Math.round(hy + 0.5 * k), k >= 0.9);
  else { eyeDots(st, Math.round(fx - 1.3 * k), Math.round(hy + 0.5 * k), k >= 0.9); eyeDots(st, Math.round(fx + 1.3 * k) + 1, Math.round(hy + 0.5 * k), k >= 0.9); }
  const bc = dark(skin, 0.55);
  if (!side) { p.thick(Math.round(fx - 2.6 * k), Math.round(hy - 1.6 * k), Math.round(fx - 0.6 * k), Math.round(hy - 0.8 * k), Math.max(1, Math.round(0.6 * k)), bc); p.thick(Math.round(fx + 2.6 * k), Math.round(hy - 1.6 * k), Math.round(fx + 0.6 * k), Math.round(hy - 0.8 * k), Math.max(1, Math.round(0.6 * k)), bc); }
  else p.thick(Math.round(fx), Math.round(hy - 1.6 * k), Math.round(fx + 2.4 * k), Math.round(hy - 0.8 * k), Math.max(1, Math.round(0.6 * k)), bc);
  // frown
  const my = Math.round(hy + 2.6 * k);
  p.hline(Math.round(fx - 1 * k), Math.round(fx + 1 * k), my, '#3a3a5a'); p.set(Math.round(fx - 1.4 * k), my + 1, '#3a3a5a'); p.set(Math.round(fx + 1.4 * k), my + 1, '#3a3a5a');
}
