// FX for the 2D renderer: pooled particles + pooled shaped effects, all drawn at art resolution on the art canvas
// (1 px = 1 art pixel), so even arcs and beams come out as chunky pixel art when upscaled.
// Also: persistent fxTag visuals, aura styles, prop emitters, live effect-rig models (telegraphs, barrier, ...).
import { light, dark, mix, rgba, col } from './color.js';
import { makeCanvas } from './pix.js';

const TAU = Math.PI * 2;
const SLASH_DUR = { sword: 0.2, axe: 0.28, dagger: 0.16, claw: 0.22, fist: 0.22, stick: 0.2, crescent: 0.32, spin: 0.38 };
const SLASH_COL = { sword: '#ffffff', axe: '#ffd0a0', dagger: '#e8fff4', claw: '#ffd0e0', fist: '#ffe680', stick: '#f4e3c4', crescent: '#9fe6ff', spin: '#ffffff' };
export const FX_KNOWN = ['hit', 'slash', 'burst', 'ring', 'shockwave', 'beam', 'bolt', 'trail', 'afterimage', 'pillar', 'meteor',
  'sparkle', 'heal', 'levelup', 'poof', 'smoke', 'screenFlash', 'text'];

// particle kinds
const PK_SQ = 0, PK_PLUS = 1, PK_STAR = 2, PK_SPARK = 3, PK_PUFF = 4, PK_FLAME = 5, PK_Z = 6, PK_ROCK = 7, PK_SNOW = 8, PK_LEAF = 9, PK_BUBBLE = 10;

export function createFx() {
  const MAXP = 900, MAXS = 140;
  const P = [];
  for (let i = 0; i < MAXP; i++) P.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, life: 0, max: 1, s0: 1, s1: 1, c: '#fff', c2: null, k: 0, add: false, a: 1, seed: 0 });
  const Sh = [];
  for (let i = 0; i < MAXS; i++) Sh.push({ on: false, t: '', x: 0, y: 0, x2: 0, y2: 0, r: 0, ang: 0, arc: 0, w: 0, c: '#fff', c2: '#fff', style: '', age: 0, dur: 1, seed: 0, spr: null, sw: 0, sh: 0, ax: 0, ay: 0, sc: 1, n: 0, ground: false });
  let pHead = 0, sHead = 0, pCap = 600, alive = 0;
  let flashA = 0, flashC = '#ffffff', flashDur = 0.15;
  let rnd = 12345;
  const R = () => { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; };
  const glowCache = new Map();

  function particle() {
    for (let n = 0; n < MAXP; n++) {
      pHead = (pHead + 1) % MAXP;
      const p = P[pHead];
      if (!p.on) { if (alive >= pCap) return null; p.on = true; alive++; p.c2 = null; p.add = false; p.a = 1; p.g = 0; p.drag = 0; p.z = 0; p.vz = 0; return p; }
    }
    return null;
  }
  function shape(t, dur) {
    for (let n = 0; n < MAXS; n++) {
      sHead = (sHead + 1) % MAXS;
      const s = Sh[sHead];
      if (!s.on) { s.on = true; s.t = t; s.age = 0; s.dur = dur; s.seed = (R() * 1e6) | 0; s.spr = null; s.ground = false; return s; }
    }
    // steal the oldest-ish
    const s = Sh[(sHead + 1) % MAXS];
    s.on = true; s.t = t; s.age = 0; s.dur = dur; s.spr = null; s.ground = false;
    return s;
  }

  /** world tiles -> art px: everything in fx is stored in world art px (tile * 16). */
  function emit(k, x, y, vx, vy, life, c, s0, s1, opt) {
    const p = particle();
    if (!p) return null;
    p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = 0; p.max = life; p.c = c; p.s0 = s0; p.s1 = s1; p.seed = R();
    if (opt) {
      if (opt.z !== undefined) p.z = opt.z;
      if (opt.vz !== undefined) p.vz = opt.vz;
      if (opt.g !== undefined) p.g = opt.g;
      if (opt.drag !== undefined) p.drag = opt.drag;
      if (opt.add) p.add = true;
      if (opt.c2) p.c2 = opt.c2;
    }
    return p;
  }
  // option objects reused (no per-call allocation)
  const O = { z: 0, vz: 0, g: 0, drag: 0, add: false, c2: null };
  const opt = (z, vz, g, drag, add, c2) => { O.z = z; O.vz = vz; O.g = g; O.drag = drag; O.add = add; O.c2 = c2 || null; return O; };

  // ---------------------------------------------------------------- one-shots
  function spawn(f, quality, entSprite) {
    const T = 16;
    const x = f.x * T, y = f.y * T, z = (f.z || 0) * T;
    const c = col(f.color, null);
    const q = quality === 0 ? 0.45 : quality === 1 ? 0.8 : 1;
    switch (f.type) {
      case 'text': return;
      case 'hit': {
        const s = shape('hitstar', 0.18); s.x = x; s.y = y - z - 6; s.c = c || '#ffe680'; s.r = 9;
        const rg = shape('ring', 0.2); rg.x = x; rg.y = y - z - 6; rg.r = 11; rg.c = c || '#ffffff'; rg.w = 2;
        for (let i = 0; i < 6 * q; i++) { const a = R() * TAU, v = 60 + R() * 70; emit(PK_SPARK, x, y - 6, Math.cos(a) * v, Math.sin(a) * v, 0.18 + R() * 0.12, i & 1 ? '#ffffff' : (c || '#ffe066'), 2, 1, opt(z, 0, 0, 4, true)); }
        return;
      }
      case 'slash': {
        const st = SLASH_DUR[f.style] ? f.style : 'sword';
        const s = shape('slash', f.dur || SLASH_DUR[st]); s.x = x; s.y = y - z - 7; s.ang = f.angle || 0;
        s.arc = (f.arc || (st === 'spin' ? 360 : st === 'dagger' ? 70 : 110)) * Math.PI / 180;
        s.r = Math.max(8, (f.r || 1) * T); s.c = c || SLASH_COL[st]; s.style = st;
        s.c2 = f.color2 || (st === 'axe' ? '#ff6a3c' : st === 'crescent' ? '#c9a6ff' : st === 'fist' ? '#ffb030' : light(s.c, 0.6));
        if (st === 'axe') for (let i = 0; i < 6 * q; i++) { const a = s.ang + (R() - 0.5) * s.arc, v = 50 + R() * 50; emit(PK_ROCK, x + Math.cos(a) * s.r * 0.8, y - 4 + Math.sin(a) * s.r * 0.6, Math.cos(a) * v, Math.sin(a) * v * 0.5, 0.35, i & 1 ? '#c8b090' : '#8a7a62', 2, 1, opt(4, 60, -260, 1)); }
        if (st === 'stick') for (let i = 0; i < 3 * q + 1; i++) { const a = s.ang + (R() - 0.5) * s.arc; emit(PK_LEAF, x + Math.cos(a) * s.r * 0.8, y - 6 + Math.sin(a) * s.r * 0.6, Math.cos(a) * 30, Math.sin(a) * 20 - 10, 0.5, i & 1 ? '#7cc95a' : '#a0703c', 1, 1, opt(4, 30, -100, 2)); }
        if (st === 'fist') { const r2 = shape('ring', 0.22); r2.x = x + Math.cos(s.ang) * s.r * 0.85; r2.y = y - 7 + Math.sin(s.ang) * s.r * 0.85; r2.r = 9; r2.c = s.c; r2.w = 2; }
        if (st === 'crescent' || st === 'spin') for (let i = 0; i < 8 * q; i++) { const a = s.ang + (R() - 0.5) * s.arc; emit(PK_STAR, x + Math.cos(a) * s.r, y - 7 + Math.sin(a) * s.r * 0.8, Math.cos(a) * 20, Math.sin(a) * 20 - 15, 0.4 + R() * 0.3, s.c2, 1, 0, opt(0, 0, 0, 1, true)); }
        return;
      }
      case 'burst': default: {
        const n = Math.max(4, Math.min(48, (f.n || 12))) * q;
        const r = Math.max(0.5, f.r || 1) * T;
        const cc = c || '#ffe066';
        const fl = shape('flashDisc', 0.1); fl.x = x; fl.y = y - z - 6; fl.r = r * 0.45; fl.c = light(cc, 0.6);
        for (let i = 0; i < n; i++) { const a = R() * TAU, v = r * (2 + R() * 3); emit(i % 3 ? PK_SQ : PK_STAR, x, y - 6, Math.cos(a) * v, Math.sin(a) * v * 0.8, 0.35 + R() * 0.35, i % 2 ? cc : light(cc, 0.5), 2, 0, opt(z, 20 + R() * 40, -60, 3, i % 3 === 0)); }
        return;
      }
      case 'ring': {
        const s = shape('ring', f.dur || 0.5); s.x = x; s.y = y; s.r = Math.max(0.3, f.r || 1) * T; s.c = c || '#ffffff'; s.w = 2; s.ground = true;
        return;
      }
      case 'shockwave': {
        const r = Math.max(0.5, f.r || 2) * T, cc = c || '#e8cf94';
        const a = shape('ring', 0.45); a.x = x; a.y = y; a.r = r; a.c = '#ffffff'; a.w = 3; a.ground = true;
        const b = shape('ring', 0.6); b.x = x; b.y = y; b.r = r * 0.75; b.c = cc; b.w = 2; b.ground = true;
        const ck = shape('cracks', 1.0); ck.x = x; ck.y = y; ck.r = r * 0.7; ck.c = '#3a2a20'; ck.ground = true; ck.n = 7;
        const fl = shape('flashDisc', 0.12); fl.x = x; fl.y = y - 4; fl.r = r * 0.35; fl.c = '#ffffff';
        for (let i = 0; i < 18 * q; i++) { const an = R() * TAU, d = r * (0.2 + R() * 0.6); emit(PK_PUFF, x + Math.cos(an) * d, y + Math.sin(an) * d * 0.8, Math.cos(an) * r * 1.5, Math.sin(an) * r * 1.2, 0.5 + R() * 0.4, i & 1 ? mix(cc, '#ffffff', 0.3) : cc, 3, 7, opt(1, 10, 0, 3)); }
        return;
      }
      case 'beam': {
        const s = shape('beam', f.dur || 0.32); s.x = x; s.y = y - 8; s.x2 = (f.x2 ?? f.x) * T; s.y2 = (f.y2 ?? f.y) * T - 8;
        s.w = Math.max(2, (f.w || 0.3) * T); s.c = c || '#9fe6ff';
        for (let i = 0; i < 8 * q; i++) { const a = R() * TAU, v = 40 + R() * 60; emit(PK_SPARK, s.x2, s.y2, Math.cos(a) * v, Math.sin(a) * v, 0.25, i & 1 ? '#ffffff' : s.c, 2, 1, opt(0, 0, 0, 3, true)); }
        return;
      }
      case 'bolt': {
        const s = shape('bolt', f.dur || 0.38); s.c = c || '#c9a6ff';
        if (f.x2 !== null && f.x2 !== undefined) { s.x = x; s.y = y - 8; s.x2 = f.x2 * T; s.y2 = (f.y2 ?? f.y) * T - 8; }
        else { s.x = x + 6; s.y = y - 8 * T; s.x2 = x; s.y2 = y - 2; }
        const fl = shape('flashDisc', 0.12); fl.x = s.x2; fl.y = s.y2; fl.r = 10; fl.c = '#ffffff';
        const rg = shape('ring', 0.3); rg.x = s.x2; rg.y = s.y2 + 2; rg.r = 14; rg.c = s.c; rg.w = 1; rg.ground = true;
        for (let i = 0; i < 10 * q; i++) { const a = R() * TAU, v = 50 + R() * 80; emit(PK_SPARK, s.x2, s.y2, Math.cos(a) * v, Math.sin(a) * v * 0.7, 0.25 + R() * 0.15, i & 1 ? '#ffffff' : s.c, 2, 1, opt(0, 0, 0, 3, true)); }
        return;
      }
      case 'trail': {
        const s = shape('trail', f.dur || 0.28); s.x = x; s.y = y - 8; s.x2 = (f.x2 ?? f.x - 1) * T; s.y2 = (f.y2 ?? f.y) * T - 8; s.c = c || '#ffffff';
        s.w = Math.max(3, (f.w || 0.4) * T);
        for (let i = 0; i < 5 * q; i++) { const t = R(); emit(PK_SQ, s.x2 + (s.x - s.x2) * t, s.y2 + (s.y - s.y2) * t + (R() - 0.5) * 8, (R() - 0.5) * 20, (R() - 0.5) * 20, 0.3, s.c, 2, 0, opt(0, 0, 0, 2, true)); }
        return;
      }
      case 'afterimage': {
        if (!entSprite || !entSprite.c) return;
        const s = shape('ghost', f.dur || 0.38); s.x = x; s.y = y - z; s.spr = entSprite; s.c = c || '#9fe6ff';
        s.sc = entSprite.scale || 1;
        return;
      }
      case 'pillar': {
        const r = Math.max(0.25, f.r || 0.6) * T, cc = c || '#ffe680';
        const s = shape('pillar', f.dur || 1.0); s.x = x; s.y = y; s.r = r; s.c = cc;
        const rg = shape('ring', 0.5); rg.x = x; rg.y = y; rg.r = r * 2.2; rg.c = cc; rg.w = 2; rg.ground = true;
        for (let i = 0; i < 16 * q; i++) emit(i & 1 ? PK_STAR : PK_SQ, x + (R() - 0.5) * r * 2, y - R() * 12, 0, -40 - R() * 90, 0.6 + R() * 0.6, i & 2 ? '#ffffff' : cc, 2, 0, opt(0, 0, 0, 0.5, true));
        return;
      }
      case 'meteor': {
        const r = Math.max(0.5, f.r || 1.5) * T, cc = c || '#ff8a3c';
        const fl = shape('flashDisc', 0.16); fl.x = x; fl.y = y - 6; fl.r = r * 0.9; fl.c = '#fff4c0';
        const a = shape('ring', 0.4); a.x = x; a.y = y; a.r = r * 1.2; a.c = '#ffe680'; a.w = 3; a.ground = true;
        const b = shape('ring', 0.6); b.x = x; b.y = y; b.r = r * 0.9; b.c = cc; b.w = 2; b.ground = true;
        const sc = shape('scorch', 2.4); sc.x = x; sc.y = y; sc.r = r * 0.75; sc.ground = true;
        const ck = shape('cracks', 1.4); ck.x = x; ck.y = y; ck.r = r * 0.8; ck.c = '#2a1a10'; ck.ground = true; ck.n = 9;
        for (let i = 0; i < 20 * q; i++) { const an = R() * TAU, v = r * (1.5 + R() * 3); emit(PK_FLAME, x, y - 4, Math.cos(an) * v, Math.sin(an) * v * 0.7, 0.4 + R() * 0.3, i & 1 ? '#ffe066' : cc, 3, 1, opt(2, 40 + R() * 60, -40, 2, true, '#ff4a2a')); }
        for (let i = 0; i < 12 * q; i++) { const an = R() * TAU, v = r * (2 + R() * 2.5); emit(PK_ROCK, x, y - 4, Math.cos(an) * v, Math.sin(an) * v * 0.6, 0.9, i & 1 ? '#6a5040' : '#8a6a55', 2 + (i & 1), 2, opt(4, 90 + R() * 80, -320, 0.5)); }
        for (let i = 0; i < 8 * q; i++) { const an = R() * TAU; emit(PK_PUFF, x + Math.cos(an) * r * 0.4, y + Math.sin(an) * r * 0.3, Math.cos(an) * 14, -8 - R() * 10, 1.1 + R() * 0.5, i & 1 ? '#8a8090' : '#b0a8b8', 4, 10, opt(6, 6, 0, 0.5)); }
        return;
      }
      case 'sparkle': {
        const n = Math.max(3, Math.min(40, f.n || 10)) * q, r = Math.max(0.3, f.r || 0.8) * T, cc = c || '#ffe680';
        for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.sqrt(R()) * r; emit(PK_STAR, x + Math.cos(a) * d, y - 8 + Math.sin(a) * d * 0.8, (R() - 0.5) * 10, -10 - R() * 20, 0.5 + R() * 0.7, i % 3 ? cc : '#ffffff', 2, 0, opt(z, 0, 0, 0.5, true)); }
        return;
      }
      case 'heal': {
        const cc = c || '#7cf07c';
        for (let i = 0; i < 8 * q + 2; i++) emit(PK_PLUS, x + (R() - 0.5) * 18, y - 4 - R() * 14, (R() - 0.5) * 6, -22 - R() * 18, 0.7 + R() * 0.4, i % 3 ? cc : '#ffffff', 1, 1, opt(z, 0, 0, 0.3, false));
        const rg = shape('ring', 0.45); rg.x = x; rg.y = y; rg.r = 14; rg.c = cc; rg.w = 1; rg.ground = true;
        for (let i = 0; i < 6 * q; i++) emit(PK_SQ, x + (R() - 0.5) * 14, y - R() * 4, 0, -50 - R() * 40, 0.4, light(cc, 0.4), 1, 0, opt(0, 0, 0, 0.5, true));
        return;
      }
      case 'levelup': {
        const g = '#ffd24a';
        const p1 = shape('pillar', 1.3); p1.x = x; p1.y = y; p1.r = 11; p1.c = '#ffe680';
        const a = shape('ring', 0.6); a.x = x; a.y = y; a.r = 40; a.c = g; a.w = 3; a.ground = true;
        const b = shape('ring', 0.9); b.x = x; b.y = y; b.r = 26; b.c = '#ffffff'; b.w = 1; b.ground = true;
        const fl = shape('flashDisc', 0.18); fl.x = x; fl.y = y - 10; fl.r = 18; fl.c = '#fff4c0';
        for (let i = 0; i < 28 * q; i++) { const an = R() * TAU, v = 50 + R() * 90; emit(i % 3 ? PK_SQ : PK_STAR, x, y - 10, Math.cos(an) * v, Math.sin(an) * v * 0.7, 0.6 + R() * 0.5, i & 1 ? g : '#ffffff', 2, 0, opt(0, 50 + R() * 60, -120, 2, true)); }
        for (let i = 0; i < 16 * q; i++) emit(PK_STAR, x + (R() - 0.5) * 30, y - R() * 20, 0, -30 - R() * 50, 1 + R() * 0.6, i & 1 ? '#ffe680' : '#ffffff', 2, 0, opt(0, 0, 0, 0.3, true));
        return;
      }
      case 'poof': {
        const cc = c || '#ffffff';
        for (let i = 0; i < 9 * q + 3; i++) { const an = R() * TAU, v = 18 + R() * 30; emit(PK_PUFF, x + Math.cos(an) * 4, y - 8 + Math.sin(an) * 3, Math.cos(an) * v, Math.sin(an) * v * 0.6 - 6, 0.45 + R() * 0.3, i % 3 ? cc : mix(cc, '#c8c4d8', 0.5), 3, 7 + R() * 3, opt(z, 0, 0, 3)); }
        for (let i = 0; i < 5 * q; i++) { const an = R() * TAU; emit(PK_STAR, x + Math.cos(an) * 10, y - 10 + Math.sin(an) * 8, Math.cos(an) * 30, Math.sin(an) * 30 - 10, 0.45, '#fff4b0', 2, 0, opt(z, 0, 0, 2, true)); }
        return;
      }
      case 'smoke': {
        const r = Math.max(0.4, f.r || 1) * T, dur = f.dur || 2;
        const n = Math.min(40, 6 + (f.r || 1) * 8) * q;
        const cc = c || '#b8b4c8';
        for (let i = 0; i < n; i++) { const an = R() * TAU, d = Math.sqrt(R()) * r; emit(PK_PUFF, x + Math.cos(an) * d, y - 6 + Math.sin(an) * d * 0.7, (R() - 0.5) * 8, -3 - R() * 6, dur * (0.6 + R() * 0.4), i % 3 ? cc : light(cc, 0.3), 4, 8 + R() * 6, opt(2, 2, 0, 0.3)); }
        return;
      }
      case 'screenFlash': {
        flashA = 1; flashC = c || '#ffffff'; flashDur = Math.max(0.05, f.dur || 0.15);
        return;
      }
    }
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    if (dt <= 0) return;
    for (let i = 0; i < MAXP; i++) {
      const p = P[i];
      if (!p.on) continue;
      p.life += dt;
      if (p.life >= p.max) { p.on = false; alive--; continue; }
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vz || p.g) { p.vz += p.g * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.35; p.vx *= 0.6; p.vy *= 0.6; } }
    }
    for (let i = 0; i < MAXS; i++) { const s = Sh[i]; if (!s.on) continue; s.age += dt; if (s.age >= s.dur) { s.on = false; s.spr = null; } }
    if (flashA > 0) flashA = Math.max(0, flashA - dt / flashDur);
  }

  // ---------------------------------------------------------------- draw helpers
  function glowSprite(c) {
    let g = glowCache.get(c);
    if (g) return g;
    g = makeCanvas(32, 32);
    const x = g.getContext('2d');
    const grd = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, rgba(c, 0.9)); grd.addColorStop(0.35, rgba(c, 0.45)); grd.addColorStop(1, rgba(c, 0));
    x.fillStyle = grd; x.fillRect(0, 0, 32, 32);
    glowCache.set(c, g);
    return g;
  }

  let draws = 0;
  /** additive soft glow at art (x, y) with radius r (art px). */
  function glow(g, x, y, r, c, a, add) {
    if (r < 1) return;
    g.globalCompositeOperation = add ? 'lighter' : 'source-over';
    g.globalAlpha = Math.min(1, add ? a : a * 0.8);
    g.drawImage(glowSprite(c), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    draws++;
  }

  function drawParticles(g, ox, oy) {
    let fills = 0;
    let addMode = false;
    for (let i = 0; i < MAXP; i++) {
      const p = P[i];
      if (!p.on) continue;
      const k = p.life / p.max;
      const sx = p.x - ox, sy = p.y - oy - p.z;
      void addMode;
      const s = p.s0 + (p.s1 - p.s0) * k;
      const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      g.globalAlpha = a * p.a;
      switch (p.k) {
        case PK_SQ: { const si = Math.max(1, Math.round(s)); g.fillStyle = p.c; g.fillRect(Math.round(sx - si / 2), Math.round(sy - si / 2), si, si); fills++; break; }
        case PK_SPARK: { g.fillStyle = p.c; const lx = Math.round(sx), ly = Math.round(sy); g.fillRect(lx, ly, 1, 1); g.fillRect(Math.round(sx - p.vx * 0.02), Math.round(sy - p.vy * 0.02), 1, 1); g.fillRect(Math.round(sx - p.vx * 0.04), Math.round(sy - p.vy * 0.04), 1, 1); fills += 3; break; }
        case PK_PLUS: { g.fillStyle = p.c; const lx = Math.round(sx), ly = Math.round(sy); g.fillRect(lx - 1, ly - 3, 3, 7); g.fillRect(lx - 3, ly - 1, 7, 3); g.fillStyle = '#ffffff'; g.fillRect(lx, ly - 2, 1, 5); g.fillRect(lx - 2, ly, 5, 1); fills += 4; break; }
        case PK_STAR: {
          const tw = (Math.sin((p.life * 18) + p.seed * 10) + 1) * 0.5;
          const lx = Math.round(sx), ly = Math.round(sy);
          g.fillStyle = p.c; g.fillRect(lx, ly, 1, 1);
          if (tw > 0.35) { g.fillRect(lx - 1, ly, 3, 1); g.fillRect(lx, ly - 1, 1, 3); fills += 2; }
          if (tw > 0.8 && s > 1.2) { g.fillRect(lx - 2, ly, 5, 1); g.fillRect(lx, ly - 2, 1, 5); fills += 2; }
          fills++; break;
        }
        case PK_PUFF: {
          const r = Math.max(1, s);
          g.globalAlpha = a * 0.85 * p.a;
          g.fillStyle = p.c; g.beginPath(); g.arc(Math.round(sx), Math.round(sy), r, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(Math.round(sx - r * 0.3), Math.round(sy - r * 0.35), r * 0.45, 0, TAU); g.fill();
          fills += 2; break;
        }
        case PK_FLAME: {
          const si = Math.max(1, Math.round(s));
          g.fillStyle = k < 0.35 ? (p.c2 && k < 0.15 ? '#fffbe0' : p.c) : (p.c2 || p.c);
          g.fillRect(Math.round(sx - si / 2), Math.round(sy - si), si, si + 1); fills++;
          break;
        }
        case PK_Z: {
          const lx = Math.round(sx), ly = Math.round(sy);
          g.fillStyle = p.c; g.fillRect(lx, ly, 4, 1); g.fillRect(lx + 2, ly + 1, 1, 1); g.fillRect(lx + 1, ly + 2, 1, 1); g.fillRect(lx, ly + 3, 4, 1); fills += 4; break;
        }
        case PK_ROCK: { const si = Math.max(1, Math.round(s)); g.fillStyle = p.c; g.fillRect(Math.round(sx), Math.round(sy), si, si); g.fillStyle = '#1e1a22'; g.fillRect(Math.round(sx), Math.round(sy) + si, si, 1); fills += 2; break; }
        case PK_SNOW: { const lx = Math.round(sx), ly = Math.round(sy); g.fillStyle = p.c; g.fillRect(lx, ly - 1, 1, 3); g.fillRect(lx - 1, ly, 3, 1); fills += 2; break; }
        case PK_LEAF: { const lx = Math.round(sx), ly = Math.round(sy); g.fillStyle = p.c; g.fillRect(lx, ly, 2, 1); g.fillRect(lx + ((p.life * 8) & 1), ly + 1, 1, 1); fills += 2; break; }
        case PK_BUBBLE: { const lx = Math.round(sx), ly = Math.round(sy); g.fillStyle = p.c; g.fillRect(lx - 1, ly, 3, 1); g.fillRect(lx, ly - 1, 1, 3); g.fillStyle = '#ffffff'; g.fillRect(lx - 1, ly - 1, 1, 1); fills += 3; break; }
        default: break;
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return fills;
  }

  function arcBand(g, x, y, r0, r1, a0, a1, sq) {
    g.beginPath();
    g.ellipse(x, y, r1, r1 * sq, 0, a0, a1, false);
    g.ellipse(x, y, r0, r0 * sq, 0, a1, a0, true);
    g.closePath();
    g.fill();
  }

  function drawShapes(g, ox, oy, groundPass, sprites) {
    for (let i = 0; i < MAXS; i++) {
      const s = Sh[i];
      if (!s.on || s.ground !== groundPass) continue;
      const k = s.age / s.dur;
      const x = s.x - ox, y = s.y - oy;
      switch (s.t) {
        case 'ring': {
          const e = 1 - (1 - k) * (1 - k);
          const r = Math.max(1, s.r * e);
          g.globalAlpha = 1 - k;
          g.strokeStyle = s.c; g.lineWidth = Math.max(1, s.w * (1 - k * 0.6));
          g.beginPath(); g.ellipse(Math.round(x), Math.round(y), r, r * 0.8, 0, 0, TAU); g.stroke();
          g.globalAlpha = (1 - k) * 0.18; g.fillStyle = s.c; g.fill();
          if (s.w >= 2) { g.globalAlpha = (1 - k) * 0.6; g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), r * 0.92, r * 0.92 * 0.8, 0, 0, TAU); g.stroke(); }
          break;
        }
        case 'cracks': {
          g.globalAlpha = k < 0.6 ? 0.7 : 0.7 * (1 - (k - 0.6) / 0.4);
          g.strokeStyle = s.c; g.lineWidth = 1;
          let rs = s.seed;
          const rr = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
          for (let j = 0; j < s.n; j++) {
            let a = j / s.n * TAU + rr() * 0.5, px = x, py = y;
            g.beginPath(); g.moveTo(Math.round(px), Math.round(py));
            const len = s.r * (0.6 + rr() * 0.5);
            for (let t = 1; t <= 4; t++) { a += (rr() - 0.5) * 0.7; px = x + Math.cos(a) * len * t / 4; py = y + Math.sin(a) * len * t / 4 * 0.8; g.lineTo(Math.round(px) + 0.5, Math.round(py) + 0.5); }
            g.stroke();
          }
          break;
        }
        case 'scorch': {
          g.globalAlpha = (k < 0.7 ? 0.45 : 0.45 * (1 - (k - 0.7) / 0.3));
          g.fillStyle = '#2a1a20'; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), s.r, s.r * 0.7, 0, 0, TAU); g.fill();
          g.globalAlpha *= 0.8; g.fillStyle = '#ff8a3c'; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), s.r * 0.35 * (1 - k), s.r * 0.25 * (1 - k), 0, 0, TAU); g.fill();
          break;
        }
        case 'hitstar': {
          const e = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
          const r = s.r * (0.6 + e * 0.6);
          g.globalAlpha = 1;
          g.fillStyle = s.c;
          const cx = Math.round(x), cy = Math.round(y);
          g.fillRect(cx - Math.round(r), cy, Math.round(r) * 2 + 1, 1); g.fillRect(cx, cy - Math.round(r), 1, Math.round(r) * 2 + 1);
          const d = Math.round(r * 0.55);
          for (let t = 1; t <= d; t++) { g.fillRect(cx + t, cy + t, 1, 1); g.fillRect(cx - t, cy + t, 1, 1); g.fillRect(cx + t, cy - t, 1, 1); g.fillRect(cx - t, cy - t, 1, 1); }
          g.fillStyle = '#ffffff'; g.fillRect(cx - 1, cy - 1, 3, 3); g.fillRect(cx - 2, cy, 5, 1); g.fillRect(cx, cy - 2, 1, 5);
          glow(g, cx, cy, r * 1.6, s.c, 0.7 * (1 - k));
          break;
        }
        case 'flashDisc': {
          g.globalAlpha = 0.85 * (1 - k);
          g.fillStyle = s.c; g.beginPath(); g.arc(Math.round(x), Math.round(y), Math.max(1, s.r * (0.7 + k * 0.5)), 0, TAU); g.fill();
          break;
        }
        case 'slash': drawSlash(g, s, x, y, k); break;
        case 'beam': {
          const x2 = s.x2 - ox, y2 = s.y2 - oy;
          const fl = 0.75 + 0.25 * Math.sin(s.age * 60);
          const w = s.w * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8 * 0.85) * fl;
          g.globalCompositeOperation = 'source-over';
          g.lineCap = 'round';
          g.globalAlpha = 0.55 * (1 - k); g.strokeStyle = s.c; g.lineWidth = Math.max(1, w * 1.8);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
          g.globalAlpha = 1 - k * 0.5; g.lineWidth = Math.max(1, w); g.strokeStyle = light(s.c, 0.3); g.stroke();
          g.globalAlpha = 1; g.lineWidth = Math.max(1, w * 0.35); g.strokeStyle = '#ffffff'; g.stroke();
          g.lineCap = 'butt';
          g.globalCompositeOperation = 'source-over';
          glow(g, x2, y2, s.w * 1.6, s.c, 1 - k);
          glow(g, x, y, s.w, s.c, 0.8 * (1 - k));
          break;
        }
        case 'bolt': {
          const x2 = s.x2 - ox, y2 = s.y2 - oy;
          let rs = s.seed + Math.floor(s.age / 0.045) * 7919;
          const rr = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
          const vis = k < 0.15 || (Math.floor(s.age / 0.045) % 3 !== 2);
          if (!vis) break;
          g.globalCompositeOperation = 'source-over';
          for (let pass = 0; pass < 2; pass++) {
            rs = s.seed + Math.floor(s.age / 0.045) * 7919;
            g.globalAlpha = pass ? 1 - k * 0.6 : 0.5 * (1 - k);
            g.strokeStyle = pass ? '#ffffff' : s.c; g.lineWidth = pass ? 1 : 3;
            g.beginPath(); g.moveTo(Math.round(x), Math.round(y));
            const n = 9, dx = x2 - x, dy = y2 - y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
            for (let j = 1; j < n; j++) { const t = j / n, off = (rr() - 0.5) * Math.min(18, len * 0.25); g.lineTo(Math.round(x + dx * t + nx * off) + 0.5, Math.round(y + dy * t + ny * off) + 0.5); }
            g.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5); g.stroke();
          }
          g.globalCompositeOperation = 'source-over';
          glow(g, x2, y2, 16, s.c, 1 - k);
          break;
        }
        case 'trail': {
          const x2 = s.x2 - ox, y2 = s.y2 - oy;
          g.globalCompositeOperation = 'source-over';
          const steps = 6;
          for (let j = 0; j < steps; j++) {
            const t0 = j / steps, t1 = (j + 1) / steps;
            g.globalAlpha = (1 - k) * t1 * 0.9;
            g.strokeStyle = j > steps - 3 ? '#ffffff' : s.c; g.lineWidth = Math.max(1, s.w * t1 * (1 - k * 0.5));
            g.beginPath(); g.moveTo(x2 + (x - x2) * t0, y2 + (y - y2) * t0); g.lineTo(x2 + (x - x2) * t1, y2 + (y - y2) * t1); g.stroke();
          }
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ghost': {
          const sp = s.spr;
          if (!sp) break;
          const tc = sprites.tintOf(sp, s.c);
          g.globalAlpha = 0.6 * (1 - k);
          const sc = s.sc;
          g.drawImage(tc, Math.round(x - sp.ax * sc), Math.round(y - sp.ay * sc), sp.w * sc, sp.h * sc);
          draws++;
          break;
        }
        case 'pillar': {
          const grow = k < 0.15 ? k / 0.15 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
          const w = Math.max(1, s.r * grow * (0.9 + 0.1 * Math.sin(s.age * 40)));
          const top = y - 120;
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = 0.45 * grow; g.fillStyle = s.c; g.fillRect(Math.round(x - w), top, Math.round(w * 2), y - top);
          g.globalAlpha = 0.8 * grow; g.fillStyle = light(s.c, 0.4); g.fillRect(Math.round(x - w * 0.55), top, Math.round(w * 1.1), y - top);
          g.globalAlpha = grow; g.fillStyle = '#ffffff'; g.fillRect(Math.round(x - w * 0.2), top, Math.max(1, Math.round(w * 0.4)), y - top);
          g.globalCompositeOperation = 'source-over';
          glow(g, x, y - 4, w * 3, s.c, grow);
          break;
        }
        default: break;
      }
      g.globalAlpha = 1;
    }
  }

  function drawSlash(g, s, x, y, k) {
    const st = s.style;
    const a0 = s.ang - s.arc / 2, a1 = s.ang + s.arc / 2;
    const sq = 0.8; // ground squash
    const sweepK = Math.min(1, k / 0.55);
    const fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
    const head = a0 + (a1 - a0) * (1 - (1 - sweepK) * (1 - sweepK));
    const tailLen = (a1 - a0) * (st === 'spin' ? 0.85 : 1);
    const tail = Math.max(a0, head - tailLen);
    const r = s.r;
    if (st === 'claw') {
      for (let j = 0; j < 3; j++) {
        const rr = r * (0.62 + j * 0.16);
        g.globalAlpha = fade; g.strokeStyle = s.c2; g.lineWidth = 3;
        g.beginPath(); g.ellipse(x, y, rr, rr * sq, 0, tail + (head - tail) * 0.3, head); g.stroke();
        g.strokeStyle = j === 1 ? '#ffffff' : s.c; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x, y, rr, rr * sq, 0, tail, head); g.stroke();
      }
      return;
    }
    if (st === 'dagger') {
      for (let j = 0; j < 2; j++) {
        const off = (j ? 1 : -1) * 0.35, hk = Math.min(1, Math.max(0, (k - j * 0.25) / 0.45));
        const aa0 = s.ang - s.arc / 2 + off, aa1 = s.ang + s.arc / 2 + off;
        const hh = aa0 + (aa1 - aa0) * hk;
        g.globalAlpha = fade; g.fillStyle = s.c;
        arcBand(g, x, y, r * 0.7, r * 0.92, Math.max(aa0, hh - 0.9), hh, sq);
        g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, r * 0.92, r * 0.92 * sq, 0, Math.max(aa0, hh - 0.9), hh); g.stroke();
      }
      return;
    }
    if (st === 'fist') {
      const px = x + Math.cos(s.ang) * r * 0.85, py = y + Math.sin(s.ang) * r * 0.85 * sq;
      g.globalAlpha = fade;
      g.strokeStyle = s.c; g.lineWidth = 1;
      for (let j = -2; j <= 2; j++) {
        const a = s.ang + j * 0.25, l0 = r * 0.3, l1 = r * (0.55 + 0.4 * sweepK);
        g.beginPath(); g.moveTo(x + Math.cos(a) * l0, y + Math.sin(a) * l0 * sq); g.lineTo(x + Math.cos(a) * l1, y + Math.sin(a) * l1 * sq); g.stroke();
      }
      g.fillStyle = s.c2; g.beginPath(); g.arc(px, py, 3 + 5 * sweepK * fade, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px, py, 2 + 2 * fade, 0, TAU); g.fill();
      glow(g, px, py, 10, s.c2, fade);
      return;
    }
    const thick = st === 'axe' ? 0.62 : st === 'crescent' ? 0.6 : st === 'stick' ? 0.3 : st === 'spin' ? 0.45 : 0.48;
    const r0 = r * (1 - thick), r1 = r;
    // outer soft band
    g.globalAlpha = 0.45 * fade; g.fillStyle = s.c2;
    arcBand(g, x, y, r0 * 0.85, r1 * 1.08, tail, head, sq);
    // main band
    g.globalAlpha = 0.9 * fade; g.fillStyle = s.c;
    arcBand(g, x, y, r0 + (r1 - r0) * 0.3, r1, tail + (head - tail) * 0.35, head, sq);
    // leading bright edge
    g.globalAlpha = fade; g.strokeStyle = '#ffffff'; g.lineWidth = st === 'axe' || st === 'crescent' ? 2 : 1;
    g.beginPath(); g.ellipse(x, y, r1, r1 * sq, 0, tail + (head - tail) * 0.45, head); g.stroke();
    // inner dark edge gives the band a crisp pixel-art read on bright ground
    g.globalAlpha = 0.5 * fade; g.strokeStyle = dark(s.c2, 0.35); g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, r0 * 0.85, r0 * 0.85 * sq, 0, tail + (head - tail) * 0.3, head); g.stroke();
    if (st === 'spin' && k > 0.25) {
      const h2 = head - Math.PI;
      g.globalAlpha = 0.6 * fade; g.fillStyle = s.c2;
      arcBand(g, x, y, r0 * 0.7, r1 * 0.85, h2 - 1.6, h2, sq);
    }
    if (st === 'crescent' || st === 'axe') glow(g, x + Math.cos(head) * r * 0.8, y + Math.sin(head) * r * 0.8 * sq, r * 0.7, s.c2, 0.7 * fade);
  }

  return {
    spawn, update, emit, opt, glow, glowSprite, drawParticles, drawShapes,
    PK: { SQ: PK_SQ, PLUS: PK_PLUS, STAR: PK_STAR, SPARK: PK_SPARK, PUFF: PK_PUFF, FLAME: PK_FLAME, Z: PK_Z, ROCK: PK_ROCK, SNOW: PK_SNOW, LEAF: PK_LEAF, BUBBLE: PK_BUBBLE },
    setQuality(q) { pCap = q === 0 ? 220 : q === 1 ? 600 : 900; },
    get flash() { return flashA; }, get flashColor() { return flashC; },
    get alive() { return alive; },
    takeDraws() { const d = draws; draws = 0; return d; },
    clear() { for (const p of P) p.on = false; for (const s of Sh) { s.on = false; s.spr = null; } alive = 0; flashA = 0; },
    rand: R,
  };
}

export { dark };
