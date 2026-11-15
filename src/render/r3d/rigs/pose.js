// Transform-only animation: pose(out, rig, anim, animT, dir, moving, t, seed) fills a Pose with the root
// transform (offset, yaw/pitch/roll, squash and stretch) and the part angles consumed by the char shader:
//   p0 = [legSwing, armL x, armR x, cape x | tail y]   p1 = [armL z, armR z, head x, head z]   legB = both legs x
// Model forward is +Z; positive pitch leans forward, positive arm x swings an arm backward.
// Every ANIM value is handled for every rig. No allocation.

export function makePose() {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1, p0: [0, 0, 0, 0], p1: [0, 0, 0, 0], glow: 0, legB: 0 };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;

function reset(o) {
  o.x = 0; o.y = 0; o.z = 0; o.yaw = 0; o.pitch = 0; o.roll = 0; o.sx = 1; o.sy = 1; o.sz = 1; o.glow = 0; o.legB = 0;
  o.p0[0] = 0; o.p0[1] = 0; o.p0[2] = 0; o.p0[3] = 0; o.p1[0] = 0; o.p1[1] = 0; o.p1[2] = 0; o.p1[3] = 0;
}

/** Shared: a quick weapon swing over ~0.38 s (windup, strike, recover). Returns strike progress for twist. */
function swing(o, T) {
  const wind = ease(T / 0.08);
  const strike = ease((T - 0.08) / 0.12);
  const rec = ease((T - 0.26) / 0.18);
  let ax = lerp(0, -2.4, wind);
  ax = lerp(ax, -0.5, strike);
  ax = lerp(ax, 0, rec);
  let az = lerp(0, -0.7, wind);
  az = lerp(az, 0.55, strike);
  az = lerp(az, 0, rec);
  o.p0[2] = ax; o.p1[1] = az;
  const tw = lerp(lerp(0, 0.45, wind), -0.35, strike);
  o.yaw += lerp(tw, 0, rec);
  o.pitch += 0.16 * strike * (1 - rec);
  o.p1[2] += -0.12 * strike * (1 - rec);
  return strike;
}

export function pose(o, rig, anim, animT, dir, moving, t, seed) {
  reset(o);
  const T = animT || 0;
  const ph = t * 9.5 + seed;
  const breath = Math.sin(t * 2.6 + seed);
  if (rig === 'humanoid') poseHumanoid(o, anim, T, moving, t, ph, breath, seed);
  else if (rig === 'quadruped') poseQuad(o, anim, T, moving, t, ph, breath, seed);
  else if (rig === 'blob') poseBlob(o, anim, T, moving, t, ph, breath, seed);
  else if (rig === 'flyer') poseFlyer(o, anim, T, moving, t, ph, breath, seed);
  else if (rig === 'plant') posePlant(o, anim, T, moving, t, ph, breath, seed);
  else if (rig === 'golem') poseGolem(o, anim, T, moving, t, ph, breath, seed);
  return o;
}

function poseHumanoid(o, anim, T, moving, t, ph, breath) {
  const walking = moving || anim === 'walk';
  if (walking && anim !== 'dash' && anim !== 'spin' && anim !== 'ko' && anim !== 'sleep' && anim !== 'sit') {
    const s = Math.sin(ph);
    o.p0[0] = s * 0.75;
    o.p0[1] = s * 0.6; o.p0[2] = -s * 0.6;
    o.y = Math.abs(Math.cos(ph)) * 0.045;
    o.pitch = 0.07;
    o.sy = 1 - 0.035 * Math.cos(ph * 2); o.sx = o.sz = 1 + 0.018 * Math.cos(ph * 2);
    o.p0[3] = 0.28 + 0.1 * Math.sin(ph * 2);
    o.p1[3] = Math.sin(ph) * 0.04;
  } else {
    o.sy = 1 + 0.018 * breath; o.sx = o.sz = 1 - 0.008 * breath;
    o.p0[1] = 0.04 * breath; o.p0[2] = -0.04 * breath;
    o.p1[0] = 0.06; o.p1[1] = -0.06;
    o.p0[3] = 0.08 + 0.04 * Math.sin(t * 1.7);
    o.p1[2] = 0.03 * Math.sin(t * 0.9);
  }
  switch (anim) {
    case 'attack': swing(o, T); o.p0[3] += 0.2; break;
    case 'cast': {
      const k = ease(T / 0.15);
      const vib = Math.sin(t * 40) * 0.04;
      o.p0[1] = lerp(o.p0[1], -2.0 + vib, k); o.p0[2] = lerp(o.p0[2], -2.2 - vib, k);
      o.p1[0] = 0.35 * k; o.p1[1] = -0.35 * k;
      o.pitch = -0.1 * k; o.y += 0.04 * k + 0.02 * Math.sin(t * 6);
      o.p1[2] = -0.25 * k; o.p0[3] = 0.4 * k + 0.1 * Math.sin(t * 9);
      o.glow = 0.4 + 0.3 * Math.sin(t * 10);
      break;
    }
    case 'hurt': {
      const k = 1 - ease(T / 0.35);
      o.pitch = -0.35 * k; o.sy = 1 - 0.12 * k; o.sx = o.sz = 1 + 0.06 * k;
      o.p1[0] = 0.7 * k; o.p1[1] = -0.7 * k; o.p1[2] = -0.35 * k; o.p1[3] = 0.2 * k;
      o.y += 0.05 * Math.sin(clamp01(T / 0.35) * Math.PI);
      break;
    }
    case 'ko': {
      const k = ease(T / 0.4);
      o.roll = -k * Math.PI / 2; o.y = 0.17 * k + 0.12 * Math.sin(k * Math.PI);
      o.p1[0] = 0.8 * k; o.p1[1] = -0.3 * k; o.p0[0] = 0.3 * k; o.p1[3] = 0.3 * k;
      o.sx = o.sy = o.sz = 1;
      break;
    }
    case 'sleep':
      o.pitch = -Math.PI / 2; o.y = 0.15; o.z = 0.45;
      o.sy = 1; o.sz = 1 + 0.03 * Math.sin(t * 1.6); o.sx = 1;
      o.p0[1] = 0.1; o.p0[2] = 0.1; o.p1[2] = -0.15; o.p0[0] = 0; o.p0[3] = 0;
      break;
    case 'sit':
      o.y = -0.12; o.p0[0] = 0; o.pitch = -0.05;
      o.p0[1] = -0.55; o.p0[2] = -0.55; o.p1[0] = -0.15; o.p1[1] = 0.15;
      o.legB = -1.45;
      break;
    case 'charge': {
      const k = clamp01(T / 1.0);
      o.sy *= 1 - 0.07 * ease(T / 0.2); o.sx *= 1 + 0.03; o.sz *= 1 + 0.03;
      o.x = Math.sin(t * 61) * 0.012 * k; o.z = Math.cos(t * 53) * 0.012 * k;
      o.p0[2] = lerp(o.p0[2], 0.9, ease(T / 0.2)); o.p1[1] = -0.5 * ease(T / 0.2);
      o.p0[1] = lerp(o.p0[1], -0.9, ease(T / 0.2));
      o.pitch = 0.12; o.glow = 0.25 + 0.6 * k + 0.15 * Math.sin(t * 20);
      o.p0[3] = 0.3 + 0.15 * k;
      break;
    }
    case 'block':
      o.p0[1] = -1.5; o.p1[0] = -0.45; o.p0[2] = -0.9; o.p1[1] = 0.25;
      o.sy = 0.95; o.pitch = -0.06; o.p0[0] = 0.25;
      break;
    case 'spin':
      o.yaw = T * 17; o.p1[0] = 1.45; o.p1[1] = -1.45; o.p0[1] = -0.2; o.p0[2] = -0.2;
      o.y = 0.03 + 0.03 * Math.sin(T * 30); o.p0[3] = 0.9; o.p0[0] = 0;
      break;
    case 'dash':
      o.pitch = 0.42; o.sz = 1.14; o.sy = 0.9; o.sx = 0.95;
      o.p0[0] = 0.8; o.p0[1] = 1.0; o.p0[2] = 1.0; o.p1[0] = 0.3; o.p1[1] = -0.3;
      o.p0[3] = 1.0; o.y = 0.06;
      break;
    default: break;
  }
}

function poseQuad(o, anim, T, moving, t, ph, breath) {
  if (moving || anim === 'walk') {
    const s = Math.sin(ph * 1.2);
    o.p0[0] = s * 0.7;
    o.y = Math.abs(Math.cos(ph * 1.2)) * 0.035;
    o.p1[2] = Math.sin(ph * 2.4) * 0.06;
    o.p0[3] = Math.sin(t * 14) * 0.5;
    o.sy = 1 - 0.03 * Math.cos(ph * 2.4);
  } else {
    o.sy = 1 + 0.025 * breath; o.p0[3] = Math.sin(t * 5) * 0.35; o.p1[2] = 0.05 * Math.sin(t * 0.8);
  }
  switch (anim) {
    case 'attack': {
      const a = ease(T / 0.1), b = ease((T - 0.1) / 0.12), r = ease((T - 0.25) / 0.2);
      const lunge = lerp(lerp(-0.08, 0.22, b), 0, r) * (a > 0 ? 1 : 0);
      o.z += lunge; o.pitch = lerp(-0.2 * a, 0.25, b) * (1 - r);
      o.p1[2] = lerp(-0.3 * a, 0.5, b) * (1 - r);
      o.sz = 1 + 0.12 * b * (1 - r);
      break;
    }
    case 'cast': o.pitch = -0.3; o.p1[2] = -0.4; o.glow = 0.5 + 0.3 * Math.sin(t * 10); o.y += 0.03; break;
    case 'hurt': { const k = 1 - ease(T / 0.35); o.z -= 0.12 * k; o.sy = 1 - 0.15 * k; o.sx = 1 + 0.1 * k; o.y += 0.06 * Math.sin(clamp01(T / 0.35) * Math.PI); break; }
    case 'ko': { const k = ease(T / 0.4); o.roll = -k * Math.PI * 0.55; o.y = 0.1 * k + 0.1 * Math.sin(k * Math.PI); o.p0[0] = 0.4 * k; break; }
    case 'sleep': o.sy = 0.72; o.sx = 1.08; o.y = -0.02; o.p1[2] = 0.35; o.p0[3] = 0.6; o.sz = 1 + 0.02 * Math.sin(t * 1.5); break;
    case 'sit': o.pitch = -0.4; o.y = 0.04; o.p0[0] = 0; o.p1[2] = -0.2; break;
    case 'charge': { const k = clamp01(T); o.sy = 0.85; o.sz = 1.05; o.pitch = 0.12; o.x = Math.sin(t * 60) * 0.015 * k; o.glow = 0.2 + 0.6 * k; o.p0[3] = Math.sin(t * 30) * 0.6; break; }
    case 'block': o.sy = 0.85; o.pitch = -0.15; o.z -= 0.05; break;
    case 'spin': o.yaw = T * 15; o.y = 0.08 * Math.abs(Math.sin(T * 12)); break;
    case 'dash': o.sz = 1.25; o.sy = 0.85; o.pitch = 0.2; o.p0[0] = 0.9; o.y = 0.05; break;
    default: break;
  }
}

function poseBlob(o, anim, T, moving, t, ph, breath) {
  if (moving || anim === 'walk') {
    const hp = ph * 0.55;
    const h = Math.abs(Math.sin(hp));
    o.y = h * 0.22;
    const land = 1 - h;
    o.sy = 1 + 0.22 * h - 0.2 * land * land; o.sx = o.sz = 1 / Math.sqrt(Math.max(0.5, o.sy));
    o.pitch = 0.08 * Math.cos(hp);
  } else {
    o.sy = 1 + 0.06 * breath; o.sx = o.sz = 1 - 0.03 * breath;
  }
  switch (anim) {
    case 'attack': {
      const up = ease(T / 0.12), down = ease((T - 0.12) / 0.1), r = ease((T - 0.3) / 0.2);
      o.y = 0.3 * up * (1 - down);
      o.sy = lerp(lerp(1, 1.35, up), 0.65, down); o.sy = lerp(o.sy, 1, r);
      o.sx = o.sz = 1 / Math.sqrt(o.sy); o.z += 0.15 * down * (1 - r);
      break;
    }
    case 'cast': o.sy = 1.15 + 0.08 * Math.sin(t * 12); o.sx = o.sz = 0.93; o.glow = 0.5 + 0.3 * Math.sin(t * 10); break;
    case 'hurt': { const k = 1 - ease(T / 0.3); o.sy = 1 - 0.3 * k; o.sx = o.sz = 1 + 0.2 * k; break; }
    case 'ko': { const k = ease(T / 0.4); o.sy = lerp(1, 0.25, k); o.sx = o.sz = lerp(1, 1.5, k); break; }
    case 'sleep': o.sy = 0.75 + 0.04 * Math.sin(t * 1.5); o.sx = o.sz = 1.12; break;
    case 'sit': o.sy = 0.85; o.sx = o.sz = 1.07; break;
    case 'charge': { const k = clamp01(T); o.sy = 0.75 - 0.05 * k; o.sx = o.sz = 1.15; o.x = Math.sin(t * 60) * 0.02 * k; o.glow = 0.3 + 0.6 * k; break; }
    case 'block': o.sy = 0.7; o.sx = o.sz = 1.2; break;
    case 'spin': o.yaw = T * 14; o.sy = 0.85; o.sx = o.sz = 1.1; break;
    case 'dash': o.sz = 1.35; o.sy = 0.75; o.sx = 0.9; o.y = 0.1; break;
    default: break;
  }
}

function poseFlyer(o, anim, T, moving, t, ph, breath, seed) {
  o.y = 0.75 + 0.08 * Math.sin(t * 3 + seed);
  const flap = Math.sin(t * (moving ? 22 : 16) + seed);
  o.p1[0] = 0.15 + flap * 0.75; o.p1[1] = -o.p1[0];
  o.pitch = moving ? 0.15 : 0.03;
  o.p0[0] = 0.2 * Math.sin(t * 3);
  switch (anim) {
    case 'attack': { const a = ease(T / 0.12), b = ease((T - 0.12) / 0.14), r = ease((T - 0.3) / 0.2); o.pitch = lerp(lerp(0, -0.4, a), 0.7, b) * (1 - r); o.y -= 0.35 * b * (1 - r); o.z += 0.25 * b * (1 - r); break; }
    case 'cast': o.y += 0.15; o.p1[0] = 1.1 + flap * 0.3; o.p1[1] = -o.p1[0]; o.glow = 0.5 + 0.3 * Math.sin(t * 10); break;
    case 'hurt': { const k = 1 - ease(T / 0.35); o.pitch = -0.5 * k; o.y += 0.1 * k; o.roll = 0.4 * k * Math.sin(T * 40); break; }
    case 'ko': { const k = ease(T / 0.5); o.y = lerp(o.y, 0.12, k); o.roll = k * Math.PI * 0.5; o.p1[0] = lerp(o.p1[0], 1.0, k); o.p1[1] = lerp(o.p1[1], -0.3, k); break; }
    case 'sleep': o.y = 0.2; o.p1[0] = -0.6; o.p1[1] = 0.6; o.pitch = 0.2; o.sy = 1 + 0.03 * Math.sin(t * 1.5); break;
    case 'sit': o.y = 0.15; o.p1[0] = -0.7; o.p1[1] = 0.7; break;
    case 'charge': { const k = clamp01(T); o.y += 0.1 * k; o.x = Math.sin(t * 50) * 0.02 * k; o.glow = 0.3 + 0.6 * k; break; }
    case 'block': o.p1[0] = 1.3; o.p1[1] = -1.3; o.pitch = -0.2; break;
    case 'spin': o.yaw = T * 16; break;
    case 'dash': o.pitch = 0.6; o.sz = 1.2; o.p1[0] = -0.5; o.p1[1] = 0.5; break;
    default: break;
  }
}

function posePlant(o, anim, T, moving, t, ph, breath, seed) {
  o.roll = 0.06 * Math.sin(t * 1.8 + seed); o.pitch = 0.04 * Math.sin(t * 1.3 + seed);
  o.p1[0] = 0.2 + 0.15 * Math.sin(t * 2.2 + seed); o.p1[1] = -o.p1[0];
  o.sy = 1 + 0.03 * breath;
  if (moving || anim === 'walk') {
    const h = Math.abs(Math.sin(ph * 0.6));
    o.y = h * 0.12; o.sy = 1 + 0.1 * h - 0.08 * (1 - h); o.p0[0] = Math.sin(ph * 0.6) * 0.5;
  }
  switch (anim) {
    case 'attack': { const a = ease(T / 0.1), b = ease((T - 0.1) / 0.1), r = ease((T - 0.28) / 0.2); o.pitch = lerp(-0.35 * a, 0.45, b) * (1 - r); o.p1[2] = lerp(-0.3 * a, 0.5, b) * (1 - r); o.p0[1] = o.p0[2] = -1.2 * b * (1 - r); break; }
    case 'cast': o.sy = 1.1; o.p1[0] = 1.2; o.p1[1] = -1.2; o.glow = 0.5 + 0.3 * Math.sin(t * 10); break;
    case 'hurt': { const k = 1 - ease(T / 0.35); o.pitch = -0.4 * k; o.sy = 1 - 0.15 * k; break; }
    case 'ko': { const k = ease(T / 0.45); o.pitch = -k * 1.3; o.sy = lerp(1, 0.6, k); o.y = 0.05 * k; break; }
    case 'sleep': o.pitch = 0.35; o.p1[2] = 0.4; o.sy = 0.9 + 0.03 * Math.sin(t * 1.5); o.p1[0] = -0.3; o.p1[1] = 0.3; break;
    case 'sit': o.sy = 0.85; break;
    case 'charge': { const k = clamp01(T); o.sy = 0.85; o.x = Math.sin(t * 60) * 0.015 * k; o.glow = 0.3 + 0.6 * k; break; }
    case 'block': o.p1[0] = -0.8; o.p1[1] = 0.8; o.p0[1] = o.p0[2] = -1.3; o.sy = 0.9; break;
    case 'spin': o.yaw = T * 14; o.p1[0] = 1.4; o.p1[1] = -1.4; break;
    case 'dash': o.pitch = 0.4; o.sz = 1.2; o.sy = 0.85; break;
    default: break;
  }
}

function poseGolem(o, anim, T, moving, t, ph, breath) {
  if (moving || anim === 'walk') {
    const s = Math.sin(ph * 0.7);
    o.p0[0] = s * 0.5; o.p0[1] = s * 0.45; o.p0[2] = -s * 0.45;
    o.roll = s * 0.06; o.y = Math.abs(Math.cos(ph * 0.7)) * 0.04; o.pitch = 0.06;
  } else {
    o.sy = 1 + 0.012 * breath; o.p0[1] = 0.04 * breath; o.p0[2] = -0.04 * breath;
  }
  switch (anim) {
    case 'attack': {
      const a = ease(T / 0.16), b = ease((T - 0.16) / 0.12), r = ease((T - 0.38) / 0.25);
      const ax = lerp(lerp(0, -2.7, a), -0.3, b);
      o.p0[1] = o.p0[2] = lerp(ax, 0, r);
      o.pitch = lerp(-0.15 * a, 0.25, b) * (1 - r);
      o.sy = 1 - 0.08 * b * (1 - r); o.y -= 0.03 * b * (1 - r);
      break;
    }
    case 'cast': o.p0[1] = o.p0[2] = -2.4; o.p1[0] = 0.4; o.p1[1] = -0.4; o.glow = 0.5 + 0.3 * Math.sin(t * 8); o.pitch = -0.12; break;
    case 'hurt': { const k = 1 - ease(T / 0.4); o.pitch = -0.2 * k; o.sy = 1 - 0.06 * k; break; }
    case 'ko': { const k = ease(T / 0.6); o.pitch = -k * 1.35; o.y = 0.2 * k; o.p0[1] = o.p0[2] = -1.2 * k; break; }
    case 'sleep': o.sy = 0.85; o.y = -0.05; o.p1[2] = 0.4; o.p0[1] = o.p0[2] = -0.4; o.glow = -0.5; break;
    case 'sit': o.y = -0.15; o.p0[1] = o.p0[2] = -0.4; o.legB = -1.4; break;
    case 'charge': { const k = clamp01(T); o.sy = 0.9; o.p0[1] = o.p0[2] = 0.7; o.x = Math.sin(t * 50) * 0.015 * k; o.glow = 0.2 + 0.7 * k; break; }
    case 'block': o.p0[1] = o.p0[2] = -1.4; o.p1[0] = -0.6; o.p1[1] = 0.6; o.sy = 0.94; break;
    case 'spin': o.yaw = T * 9; o.p1[0] = 1.5; o.p1[1] = -1.5; break;
    case 'dash': o.pitch = 0.35; o.sz = 1.12; o.p0[1] = o.p0[2] = 0.9; break;
    default: break;
  }
}
