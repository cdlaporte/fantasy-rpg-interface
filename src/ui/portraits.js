// Procedural 32x32 bust portraits from any `look` (CONTRACTS section 6), in the exact style of the Laporte portrait
// (same head geometry, eye / brow / mouth painters, outline color and shading rules), so they sit side by side.
//
// buildPortrait(look, {mood, t, bg, blink}) -> 32 rows of '#hex' | null   (pure, runs under Node)
// drawPortrait(canvas, look, mood, opts) -> canvas                        (32x32; scale it with CSS)
// portraitKey(look, mood, t, bg) -> string                                (cheap change detection)
import { backdropFn } from './backdrops.js';
import { blitGrid } from './pixelart.js';
import { shade, mixHex } from './format.js';
import {
  OUTLINE, FACES, HAIR_PIXELS, exprForMood, faceParts, isBlinking, outlineGrid, faceExtras, buildLaporteFace,
} from './laportePortrait.js';

const DEF_SKIN = '#c68e62';
const DEF_HAIR = { style: 'short', color: '#3a2618' };
const DEF_OUTFIT = { style: 'tunic', primary: '#4a90d9', secondary: '#f4e3c4', accent: '#ffd24a' };

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Painter over a 32x32 grid with a figure mask (same semantics as the Laporte original). */
function canvas32(bgFn) {
  const g = [], fig = [];
  for (let y = 0; y < 32; y++) {
    const r = new Array(32), f = new Array(32).fill(false);
    for (let x = 0; x < 32; x++) r[x] = bgFn(x, y);
    g.push(r); fig.push(f);
  }
  const set = (x, y, c, figure = true) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x > 31 || y > 31 || !c) return;
    g[y][x] = c;
    if (figure) fig[y][x] = true;
  };
  const row = (x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(x, y, c); };
  const ell = (cx, cy, rx, ry, fn) => {
    for (let y = Math.max(0, Math.floor(cy - ry - 1)); y <= Math.min(31, Math.ceil(cy + ry + 1)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rx - 1)); x <= Math.min(31, Math.ceil(cx + rx + 1)); x++) {
        const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (e <= 1) fn(x, y, e);
      }
    }
  };
  const line = (x0, y0, x1, y1, c, w = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      for (let k = 0; k < w; k++) set(x + k, y, c);
    }
  };
  return { g, fig, set, row, ell, line };
}

// ---------------------------------------------------------------- humanoid

const SWEATER_W = { a: [7, 9, 11, 12, 12, 12], b: [6, 8, 10, 11, 11, 11] };

function drawOutfit(P, o, build) {
  const { set, row, line } = P;
  const style = o.style || 'tunic';
  const p = o.primary || DEF_OUTFIT.primary;
  const s = o.secondary || DEF_OUTFIT.secondary;
  const a = o.accent || DEF_OUTFIT.accent;
  const widths = SWEATER_W[build] || SWEATER_W.a;
  const base = style === 'apron' || style === 'vest' ? s : p;
  const baseSh = shade(base, 0.22);
  for (let y = 26; y < 32; y++) {
    const hw = widths[y - 26];
    for (let x = 0; x < 32; x++) {
      const dx = Math.abs(x + 0.5 - 16);
      if (dx > hw) continue;
      let col = dx > hw - 1.5 ? baseSh : base;
      if (style === 'quarterzip') {
        const stripe = Math.floor((y - 26) / 2) % 2 === 0;
        const c = stripe ? p : s;
        col = dx > hw - 1.5 ? shade(c, 0.22) : c;
      }
      set(x, y, col);
    }
  }
  const pSh = shade(p, 0.22), pHi = shade(p, -0.25);
  switch (style) {
    case 'tunic':
      for (let y = 26; y <= 28; y++) { const w = 28 - y; row(16 - w - 1, 15 + w + 1, y, a); row(16 - w, 15 + w, y, s); }
      row(14, 17, 25, s);
      break;
    case 'robe':
      for (let y = 26; y <= 27; y++) { row(9, 13, y, s); row(18, 22, y, s); }
      row(14, 17, 26, pSh); row(15, 16, 25, pSh);
      for (let y = 27; y < 32; y++) { set(15, y, a); set(16, y, a); }
      break;
    case 'cloak':
      for (let y = 23; y <= 25; y++) row(16 - (y - 19), 15 + (y - 19), y, p);
      row(10, 21, 26, pSh);
      set(15, 27, a); set(16, 27, a); set(15, 28, shade(a, 0.3)); set(16, 28, shade(a, 0.3));
      break;
    case 'plate': {
      const hw = widths[0];
      for (let y = 26; y <= 28; y++) {
        for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) set(16 + sx * (hw - k) - (sx > 0 ? 1 : 0), y, k === 1 ? pHi : p);
      }
      row(10, 21, 29, pHi);
      for (let y = 26; y < 32; y++) { set(15, y, s); set(16, y, shade(s, -0.2)); }
      set(9, 30, a); set(22, 30, a);
      row(14, 17, 25, pSh);
      break;
    }
    case 'leather':
      line(9, 26, 21, 31, s, 2);
      set(15, 28, a); set(16, 28, a); set(15, 29, shade(a, 0.3));
      row(14, 17, 26, shade(p, 0.35)); row(15, 16, 27, shade(p, 0.35));
      break;
    case 'gi':
      for (let y = 26; y <= 28; y++) { const w = 28 - y; for (let x = 16 - w; x <= 15 + w; x++) set(x, y, shade(o.skin || DEF_SKIN, 0.12)); }
      line(12, 26, 17, 31, s, 2);
      line(19, 26, 15, 30, s, 2);
      break;
    case 'quarterzip': {
      const COL = a, EDGE = shade(a, 0.45), FOLD = shade(a, -0.25);
      row(13, 18, 25, '#d5dbdf'); row(14, 17, 26, '#ecf0f1'); row(15, 16, 27, '#ecf0f1');
      for (const [y, x0, x1] of [[26, 10, 13], [27, 11, 13], [28, 12, 13], [29, 13, 13]]) {
        const c = y === 26 ? FOLD : COL;
        row(x0, x1, y, c); row(31 - x1, 31 - x0, y, c); set(x0, y, EDGE); set(31 - x0, y, EDGE);
      }
      set(15, 28, '#d0d4d6'); set(16, 28, '#d0d4d6');
      for (let y = 29; y < 32; y++) { set(15, y, '#3a3d42'); set(16, y, '#b9bec2'); }
      break;
    }
    case 'dress':
      row(12, 19, 26, s); row(13, 18, 25, s); row(13, 18, 27, shade(s, 0.15));
      set(15, 28, a); set(16, 28, a);
      break;
    case 'apron':
      for (let y = 27; y < 32; y++) row(12, 19, y, p);
      row(12, 19, 27, pHi);
      for (let y = 26; y < 28; y++) { set(11, y, p); set(20, y, p); }
      row(14, 17, 30, pSh);
      set(16, 29, a);
      break;
    case 'uniform':
      for (let y = 26; y <= 28; y++) { const w = 28 - y; row(16 - w - 1, 15 + w + 1, y, s); }
      row(14, 17, 25, s);
      for (let y = 27; y < 32; y++) { set(15, y, a); set(16, y, a); }
      set(14, 31, shade(a, 0.3)); set(17, 31, shade(a, 0.3));
      set(11, 29, '#f2c94c'); set(20, 29, '#f2c94c');
      break;
    case 'vest':
      for (let y = 27; y < 32; y++) {
        const hw = widths[y - 26];
        for (let x = 0; x < 32; x++) {
          const dx = Math.abs(x + 0.5 - 16);
          if (dx >= 2 && dx <= hw - 2) set(x, y, dx > hw - 3.5 ? pSh : p);
        }
      }
      set(13, 29, a); set(18, 29, a); set(13, 31, a); set(18, 31, a);
      row(14, 17, 26, shade(s, 0.12));
      break;
    default:
      row(14, 17, 25, s);
      break;
  }
}

function hairColors(color) {
  const c = color || DEF_HAIR.color;
  return { c, hi: shade(c, -0.28), dk: shade(c, 0.3) };
}

/** Back layer of hair (behind head / neck). */
function drawHairBack(P, hair) {
  const { set } = P;
  const { c, dk } = hairColors(hair.color);
  if (hair.style === 'long') {
    for (let y = 12; y <= 25; y++) for (let x = 7; x <= 24; x++) set(x, y, (x === 7 || x === 24) ? dk : c);
  }
  if (hair.style === 'curly') {
    P.ell(16, 15, 11, 10.5, (x, y) => { if (y >= 12) set(x, y, (x + y) % 3 === 0 ? dk : c); });
  }
}

/** Front hair on top of the head. */
function drawHairFront(P, hair, skin) {
  const { set, ell, row } = P;
  const style = hair.style || 'short';
  const { c, hi, dk } = hairColors(hair.color);
  if (style === 'bald') {
    const shine = shade(skin, -0.45);
    for (const [x, y] of [[12, 6], [13, 5], [14, 5]]) set(x, y, shine);
    return;
  }
  if (style === 'm_hairline') {
    for (const hp of HAIR_PIXELS) {
      const col = hp.col === '#8b5a2b' ? hi : hp.col === '#4a2e17' ? dk : c;
      set(hp.x, hp.y, col);
    }
    return;
  }
  const cap = (hairlineFn, rx = 9.6, ry = 11) => {
    for (let y = 1; y < 16; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = Math.abs(x + 0.5 - 16);
        if ((dx / rx) ** 2 + ((y + 0.5 - 14) / ry) ** 2 > 1) continue;
        const hl = hairlineFn(dx, x);
        if (y >= hl) continue;
        let col = c;
        if (y === hl - 1 || dx > rx - 1.6) col = dk;
        else if (y <= 5 && x % 3 === 0) col = hi;
        set(x, y, col);
      }
    }
  };
  switch (style) {
    case 'short':
    case 'ponytail':
    case 'bun':
    case 'braids':
      cap((dx, x) => (dx < 7 ? (x % 4 === 1 && dx < 5.5 ? 9 : 8) : 12));
      break;
    case 'long':
      cap((dx) => (dx < 3 ? 8 : dx < 7 ? 9 : 13));
      for (let y = 10; y <= 25; y++) {
        for (const [x0, x1] of [[6, 8], [23, 25]]) for (let x = x0; x <= x1; x++) set(x, y, x === x0 || x === x1 ? dk : (y % 4 === 0 ? hi : c));
      }
      break;
    case 'spiky':
      cap((dx) => (dx < 7 ? 8 : 11));
      for (const sx of [9, 12, 15, 18, 21, 24]) {
        for (let k = 0; k < 4; k++) {
          const y = 1 + k;
          const w = k >> 1;
          for (let x = sx - w; x <= sx + w; x++) set(x, y, k === 0 ? dk : c);
        }
      }
      break;
    case 'curly':
      for (let y = 1; y < 16; y++) {
        for (let x = 0; x < 32; x++) {
          const dx = Math.abs(x + 0.5 - 16);
          const e = (dx / 10.4) ** 2 + ((y + 0.5 - 13) / 11.2) ** 2;
          if (e > 1 || (e > 0.85 && hash(x, y) < 0.45)) continue;
          if (y >= (dx < 7 ? 8 : 13)) continue;
          set(x, y, (x * 3 + y * 2) % 5 === 0 ? hi : (x + y) % 3 === 0 ? dk : c);
        }
      }
      break;
    default:
      cap((dx) => (dx < 7 ? 8 : 12));
  }
  if (style === 'bun') {
    ell(16, 2.5, 3.6, 2.8, (x, y, e) => set(x, y, e > 0.6 ? dk : (x + y) % 3 === 0 ? hi : c));
  }
  if (style === 'ponytail') {
    for (let y = 8; y <= 23; y++) {
      const cx = 25 + (y > 14 ? 1 : 0) - (y > 20 ? 1 : 0);
      const w = y < 10 || y > 21 ? 1 : 2;
      for (let x = cx - w + 1; x <= cx + w - 1 + (w > 1 ? 1 : 0); x++) set(x, y, x === cx - w + 1 ? dk : (y % 3 === 0 ? hi : c));
    }
    set(24, 9, '#e2503c'); set(25, 9, '#e2503c');
  }
  if (style === 'braids') {
    for (const bx of [7, 23]) {
      for (let y = 12; y <= 27; y++) {
        const on = Math.floor(y / 2) % 2 === 0;
        set(bx, y, on ? c : dk); set(bx + 1, y, on ? dk : c);
      }
      row(bx, bx + 1, 28, '#e2503c');
    }
  }
}

function drawFacial(P, facial, hairColor, skin) {
  const { set, row } = P;
  if (!facial || facial === 'none') return;
  const c = hairColor || DEF_HAIR.color;
  if (facial === 'goatee') {
    const s1 = mixHex(c, skin, 0.45), s2 = mixHex(c, skin, 0.62);
    const stub = (x, y) => set(x, y, (x + y) % 2 ? s1 : s2);
    for (let x = 13; x <= 18; x++) if ((x + 18) % 2 === 0) stub(x, 18);
    for (let x = 12; x <= 19; x++) stub(x, 19);
    stub(12, 20); stub(12, 21); stub(19, 20); stub(19, 21); stub(13, 21); stub(18, 21); stub(15, 21); stub(16, 21);
    for (let x = 13; x <= 18; x++) stub(x, 22);
    for (let x = 14; x <= 17; x++) stub(x, 23);
  } else if (facial === 'mustache') {
    row(13, 18, 19, c); row(14, 17, 18, c); set(12, 20, shade(c, 0.2)); set(19, 20, shade(c, 0.2));
  } else if (facial === 'beard') {
    const dk = shade(c, 0.25);
    P.ell(16, 14, 8.5, 10, (x, y) => {
      const dx = Math.abs(x + 0.5 - 16);
      if (y >= 18 || (dx > 6.2 && y >= 14)) set(x, y, (x + y) % 4 === 0 ? dk : c);
    });
    row(13, 18, 24, c); row(14, 17, 25, dk);
    row(13, 18, 19, c);
  }
}

function drawHat(P, hat) {
  const { set, row, ell, line } = P;
  if (!hat || !hat.style) return;
  const c = hat.color || '#6a4bc4';
  const dk = shade(c, 0.28), hi = shade(c, -0.3);
  const acc = hat.accent || '#ffd24a';
  switch (hat.style) {
    case 'wizard':
      for (let y = 0; y <= 6; y++) {
        const hw = 1 + y * 0.9;
        const cx = 16 + (y < 2 ? 3 - y : 0);
        for (let x = Math.round(cx - hw); x <= Math.round(cx + hw - 1); x++) set(x, y, x >= cx + hw - 2 ? dk : c);
      }
      row(4, 27, 7, c); row(3, 28, 8, dk);
      row(9, 22, 6, acc);
      set(14, 3, acc); set(17, 4, hi);
      break;
    case 'cap':
      ell(16, 8, 9, 5.5, (x, y) => { if (y <= 8) set(x, y, y <= 4 ? hi : c); });
      row(7, 24, 9, dk); row(10, 21, 10, dk);
      set(16, 3, acc);
      break;
    case 'feather':
      ell(16, 8, 9.2, 5, (x, y) => { if (y <= 8) set(x, y, y <= 4 ? hi : c); });
      row(7, 24, 9, dk);
      line(21, 7, 27, 0, acc, 2);
      set(26, 1, shade(acc, -0.4));
      break;
    case 'crown': {
      const gold = c || '#f2c94c';
      row(9, 22, 7, gold); row(9, 22, 8, shade(gold, 0.25));
      for (const px of [9, 12, 15, 16, 19, 22]) { set(px, 6, gold); }
      for (const px of [9, 12, 19, 22]) { set(px, 5, gold); }
      set(15, 4, gold); set(16, 4, gold); set(15, 5, gold); set(16, 5, gold);
      set(12, 7, '#e2503c'); set(19, 7, '#4d8dff'); set(15, 7, '#58d68d'); set(16, 7, '#58d68d');
      break;
    }
    case 'bandana':
      ell(16, 9, 9.3, 6, (x, y) => { if (y >= 5 && y <= 9) set(x, y, y === 9 ? dk : c); });
      for (let y = 6; y <= 8; y++) for (let x = 0; x < 32; x++) if (((x + y) % 4 === 0) && P.fig[y][x]) set(x, y, hi);
      set(25, 9, c); set(26, 10, c); set(27, 11, dk); set(25, 11, c); set(26, 12, dk);
      break;
    case 'helm':
    case 'horned':
      ell(16, 13.5, 9.8, 11, (x, y) => {
        const dx = Math.abs(x + 0.5 - 16);
        if (y < 11 || (hat.style === 'helm' && dx > 6.5 && y < 19)) set(x, y, y < 5 || (x % 5 === 0 && y < 11) ? hi : dx > 8.5 ? dk : c);
      });
      row(7, 24, 11, dk);
      for (let y = 3; y < 11; y++) { set(15, y, acc); set(16, y, shade(acc, -0.2)); }
      if (hat.style === 'horned') {
        const bone = '#f4ead2', boneSh = '#cbbd9a';
        for (const [x, y] of [[6, 7], [5, 6], [4, 5], [3, 4], [3, 3], [2, 2]]) { set(x, y, bone); set(x + 1, y, boneSh); }
        for (const [x, y] of [[25, 7], [26, 6], [27, 5], [28, 4], [28, 3], [29, 2]]) { set(x, y, bone); set(x - 1, y, boneSh); }
      }
      break;
    case 'straw':
      ell(16, 6, 7.5, 4, (x, y) => { if (y <= 6) set(x, y, (x + y) % 3 === 0 ? dk : c); });
      row(2, 29, 7, c); row(1, 30, 8, dk);
      row(9, 22, 6, acc);
      break;
    case 'chef':
      for (const [cx, cy, r] of [[12, 3.5, 3.2], [16, 2.6, 3.6], [20, 3.5, 3.2]]) ell(cx, cy, r, r, (x, y, e) => set(x, y, e > 0.7 ? '#dfe3ea' : '#ffffff'));
      for (let y = 5; y <= 8; y++) row(9, 22, y, y === 8 ? '#cfd4dc' : '#f4f6fa');
      break;
    case 'circlet':
      row(8, 23, 8, c); row(9, 22, 9, dk);
      set(15, 7, acc); set(16, 7, acc); set(15, 8, shade(acc, -0.3)); set(16, 8, acc);
      break;
    default:
      break;
  }
}

function buildHumanoid(look, o) {
  const P = canvas32(backdropFn(o.bg));
  const { set, row, ell, fig } = P;
  const build = look.build === 'b' ? 'b' : 'a';
  const skin = look.skin || DEF_SKIN;
  const hood = !!look.hood;
  const outfit = Object.assign({}, DEF_OUTFIT, look.outfit || {}, { skin });
  const hair = Object.assign({}, DEF_HAIR, look.hair || {});
  // Shadowed face under a hood
  const shadow = '#3a2e4a';
  const faceSkin = hood ? mixHex(skin, shadow, 0.62) : skin;
  const faceSh = hood ? mixHex(skin, shadow, 0.74) : shade(skin, 0.1);
  const neckSh = hood ? mixHex(skin, shadow, 0.8) : shade(skin, 0.1);

  // Cape behind the shoulders
  if (look.cape && look.cape.color) {
    const cc = look.cape.color, cs = shade(cc, 0.25);
    for (let y = 22; y < 32; y++) {
      const hw = 9 + (y - 22) * 0.6;
      for (let x = 0; x < 32; x++) { const dx = Math.abs(x + 0.5 - 16); if (dx <= Math.min(14.5, hw)) set(x, y, dx > hw - 1.5 ? cs : cc); }
    }
  }
  // Hood back: a big rounded cowl behind the head
  const hoodC = outfit.primary, hoodSh = shade(hoodC, 0.25), hoodHi = shade(hoodC, -0.18);
  if (hood) {
    ell(16, 14, 10.6, 12.2, (x, y, e) => set(x, y, e > 0.78 ? hoodSh : hoodC));
    for (let y = 22; y < 27; y++) row(9, 22, y, hoodC);
  } else {
    drawHairBack(P, hair);
  }
  // Neck
  for (let y = 21; y < 27; y++) row(12, 19, y, neckSh);
  drawOutfit(P, outfit, build);
  if (hood) { row(10, 21, 26, hoodSh); set(15, 27, outfit.accent); set(16, 27, outfit.accent); }
  // Ears
  if (!hood) {
    for (const ex of [6, 25]) {
      for (let y = 13; y <= 16; y++) set(ex, y, skin);
      set(ex === 6 ? 5 : 26, 14, skin); set(ex === 6 ? 5 : 26, 15, skin);
      set(ex, 14, faceSh); set(ex, 15, faceSh);
      if (look.ears === 'pointed') {
        const o1 = ex === 6 ? -1 : 1;
        set(ex + o1, 13, skin); set(ex + o1, 12, skin); set(ex + 2 * o1, 11, skin); set(ex + 2 * o1, 12, faceSh);
      }
    }
  }
  // Head (slightly narrower for build b)
  const rx = build === 'b' ? 8.1 : 8.5;
  ell(16, 14, rx, 10, (x, y, e) => set(x, y, e > 0.7 && x + 0.5 > 16 ? faceSh : faceSkin));
  // Nose
  set(16, 15, faceSh); set(16, 16, faceSh); set(15, 17, faceSh); set(16, 17, faceSh);
  if (!hood) drawFacial(P, look.facial, hair.color, skin);

  // Face
  const expr = exprForMood(o.mood || 'calm');
  const blink = o.blink !== false && isBlinking(o.t || 0);
  const parts = faceParts(set, row, faceSh, { brow: hood ? shade(shadow, 0.3) : shade(hair.color || '#3a2618', 0.15) });
  const [eyeStyle, browStyle, mouthStyle] = FACES[expr];
  const canBlink = ['normal', 'lidded', 'squint', 'down'].includes(eyeStyle);
  if (hood) {
    // just two glints under the hood
    const es = blink && canBlink ? 'closed' : eyeStyle;
    if (es !== 'closed') { for (const ex of [11, 20]) { set(ex, 14, '#f4f1e8'); set(ex - 1, 14, mixHex('#f4f1e8', faceSkin, 0.5)); } }
    parts.mouth(mouthStyle === 'grin' ? 'smile' : mouthStyle === 'flat' ? 'flat' : mouthStyle);
  } else {
    parts.eyes(blink && canBlink ? 'closed' : eyeStyle);
    parts.brows(browStyle);
    parts.mouth(mouthStyle);
  }

  if (hood) {
    // Cowl rim around the face opening, deep shadow at the top of the opening
    ell(16, 14, 10.6, 12.2, (x, y) => {
      const e2 = ((x + 0.5 - 16) / 7.4) ** 2 + ((y + 0.5 - 15.4) / 8.6) ** 2;
      if (e2 > 1) set(x, y, ((x + 0.5 - 16) / 10.6) ** 2 + ((y + 0.5 - 14) / 12.2) ** 2 > 0.8 ? hoodSh : (y < 6 ? hoodHi : hoodC));
      else if (y < 11) set(x, y, mixHex(shadow, '#000000', 0.15));
      else if (y === 11) set(x, y, shadow);
    });
  } else {
    if (!(look.hat && (look.hat.style === 'helm' || look.hat.style === 'horned'))) drawHairFront(P, hair, skin);
    drawHat(P, look.hat);
  }

  let out = outlineGrid(P.g, fig, OUTLINE);
  if (look.aura && look.aura.color) out = auraGlow(out, fig, look.aura.color, o.t || 0);
  faceExtras(out, expr, o.t || 0);
  return out;
}

/** Dithered glow in the background around the figure. */
function auraGlow(out, fig, color, t) {
  const phase = Math.floor(t * 4) % 2;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (fig[y][x] || out[y][x] === OUTLINE) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < 32 && xx >= 0 && xx < 32 && fig[yy][xx]) { near = true; break; }
      }
      if (near && (x + y + phase) % 2 === 0) out[y][x] = out[y][x] ? mixHex(out[y][x], color, 0.65) : color;
    }
  }
  return out;
}

// ---------------------------------------------------------------- creatures

function eyesPair(P, cx, cy, gap, mood, eyeCol, t, big) {
  const { set, row } = P;
  const blink = isBlinking(t || 0);
  for (const ex of [cx - gap, cx + gap - 2]) {
    if (blink && mood !== 'shocked') { row(ex, ex + 2, cy + 1, OUTLINE); continue; }
    const h = big || mood === 'shocked' ? 3 : 2;
    for (let y = cy; y < cy + h; y++) row(ex, ex + 2, y, '#ffffff');
    set(ex + 1, cy + h - 1, eyeCol || '#1b1b1b');
    if (h === 3) set(ex + 1, cy + 1, eyeCol || '#1b1b1b');
    if (mood === 'annoyed') row(ex, ex + 2, cy, shade(eyeCol || '#888888', -0.2));
  }
}

function buildCreature(look, o) {
  const P = canvas32(backdropFn(o.bg));
  const { set, row, ell, line, fig } = P;
  const col = Object.assign({ body: '#9a8a7a', belly: '#e8dcc8', accent: '#e2503c', eye: '#1b1b1b' }, look.colors || {});
  const body = col.body, sh = shade(body, 0.22), hi = shade(body, -0.25);
  const feats = new Set(look.features || []);
  const mood = o.mood || 'calm';
  const rig = look.hero === 'mossback' ? 'golem' : BOSS_PORTRAITS[look.hero] ? look.hero : look.rig;
  if (look.hero === 'mossback') { feats.add('mossy'); feats.add('antlers'); }
  switch (rig) {
    case 'sphinx': case 'crab_king': case 'yeti':
      BOSS_PORTRAITS[rig](P, col, mood, o.t, sh, hi);
      break;
    case 'blob': {
      ell(16, 21, 12.5, 10.5, (x, y, e) => set(x, y, e > 0.75 ? sh : y < 15 ? hi : body));
      ell(16, 25, 7, 4, (x, y) => set(x, y, col.belly));
      if (feats.has('spots')) for (const [x, y] of [[9, 18], [22, 16], [19, 24], [11, 24]]) { set(x, y, col.accent); set(x + 1, y, col.accent); }
      if (feats.has('core_glow')) ell(16, 22, 2.5, 2.5, (x, y) => set(x, y, col.accent));
      if (feats.has('drips')) for (const x of [7, 12, 21, 25]) { set(x, 29, sh); set(x, 30, sh); }
      if (feats.has('crown')) { row(11, 20, 11, '#f2c94c'); for (const x of [11, 14, 17, 20]) { set(x, 10, '#f2c94c'); set(x, 9, '#f2c94c'); } }
      if (feats.has('tentacles')) for (const x of [6, 11, 16, 21, 26]) for (let y = 29; y < 32; y++) set(x + ((y + x) % 2), y, x % 2 ? sh : shade(col.accent, 0.1));
      if (feats.has('bubbles')) for (const [x, y, r] of [[5, 9, 1.8], [26, 7, 2.2], [24, 13, 1.4]]) { ell(x, y, r, r, (xx, yy) => set(xx, yy, mixHex(col.accent, '#ffffff', 0.6))); set(x - 1, y - 1, '#ffffff'); }
      eyesPair(P, 16, 17, 5, mood, col.eye, o.t, true);
      row(14, 17, 22, OUTLINE); set(13, 21, OUTLINE); set(18, 21, OUTLINE);
      break;
    }
    case 'flyer': {
      const wing = feats.has('wings_fairy') ? '#d8f0ff' : feats.has('wings_bird') ? shade(body, 0.1) : feats.has('wings_insect') ? mixHex(col.accent, '#ffffff', 0.45) : shade(body, 0.35);
      for (const s of [-1, 1]) {
        for (let k = 0; k < 9; k++) {
          const x0 = 16 + s * (7 + k);
          for (let y = 10 + k / 2; y <= 22 - (feats.has('wings_bat') ? (k % 3) : k / 3); y++) set(x0, y, (k + Math.floor(y)) % 4 === 0 ? shade(wing, 0.15) : wing);
        }
      }
      if (feats.has('wings_insect')) for (const s of [-1, 1]) { ell(16 + s * 10, 12, 2, 2, (x, y) => set(x, y, col.accent)); set(16 + s * 10, 12, '#ffffff'); }
      ell(16, 17, 8, 8.5, (x, y, e) => set(x, y, e > 0.75 ? sh : y < 12 ? hi : body));
      ell(16, 21, 4.5, 3.5, (x, y) => set(x, y, col.belly));
      if (feats.has('glow') || feats.has('orb')) ell(16, 4, 2.5, 2.5, (x, y) => set(x, y, col.accent));
      eyesPair(P, 16, 14, 4, mood, col.eye, o.t, true);
      set(15, 18, col.accent); set(16, 18, col.accent); set(15, 19, shade(col.accent, 0.3));
      break;
    }
    case 'plant': {
      if (feats.has('cactus')) {
        for (let y = 6; y < 32; y++) row(9, 22, y, y < 8 ? hi : body);
        ell(15.5, 7, 6.5, 3, (x, y) => set(x, y, hi));
        for (const x of [12, 16, 20]) for (let y = 8; y < 32; y++) if (y % 3) set(x, y, sh);
        for (let y = 14; y < 22; y++) { set(4, y, body); set(5, y, body); set(26, y - 3, body); set(27, y - 3, body); }
        row(4, 9, 22, body); row(22, 27, 19, body);
        for (const [x, y] of [[10, 12], [21, 15], [11, 26], [20, 27], [4, 15], [27, 12]]) set(x, y, '#fffbe6');
        ell(15.5, 4, 3.5, 2.2, (x, y) => set(x, y, col.accent)); set(15, 4, '#ffe066'); set(4, 13, col.accent); set(27, 10, col.accent);
        eyesPair(P, 16, 14, 4, mood, col.eye, o.t, false);
        row(14, 17, 19, OUTLINE);
        break;
      }
      for (let y = 18; y < 32; y++) row(11 - (y > 26 ? 1 : 0), 20 + (y > 26 ? 1 : 0), y, (y + 1) % 5 === 0 ? sh : body);
      ell(16, 19, 6.5, 6, (x, y, e) => set(x, y, e > 0.7 ? sh : body));
      if (feats.has('cap_mushroom') || !feats.size) {
        ell(16, 10, 14, 8, (x, y, e) => { if (y <= 13) set(x, y, e > 0.8 ? shade(col.accent, 0.25) : col.accent); });
        for (const [x, y] of [[9, 7], [16, 4], [22, 8], [12, 11], [20, 11]]) { set(x, y, '#fff6e6'); set(x + 1, y, '#fff6e6'); set(x, y + 1, '#fff6e6'); }
        row(4, 27, 13, shade(col.accent, 0.35));
      }
      if (feats.has('leaves')) for (const s of [-1, 1]) line(16 + s * 5, 14, 16 + s * 12, 6, '#58b84a', 2);
      if (feats.has('flower')) { ell(16, 6, 4, 4, (x, y) => set(x, y, col.accent)); ell(16, 6, 1.6, 1.6, (x, y) => set(x, y, '#ffe066')); }
      if (feats.has('thorns')) for (const [x, y] of [[9, 20], [23, 22], [10, 27], [22, 28]]) { set(x, y, '#f4ead2'); }
      if (feats.has('vines')) for (let y = 14; y < 30; y += 2) set(y % 4 ? 12 : 19, y, '#3f9e4a');
      if (feats.has('seaweed')) for (const [x0, h] of [[11, 10], [16, 13], [21, 9]]) for (let k = 0; k < h; k++) { const x = x0 + Math.round(Math.sin(k * 0.7 + x0) * 1.2); set(x, 13 - k, '#3fae7a'); set(x + 1, 13 - k, k % 3 ? '#58c08a' : col.accent); }
      eyesPair(P, 16, 17, 4, mood, col.eye, o.t, false);
      row(14, 17, 22, OUTLINE);
      break;
    }
    case 'golem': {
      for (let y = 5; y < 24; y++) row(7, 24, y, (Math.floor(y / 4) + (y % 4 === 0 ? 1 : 0)) % 2 && y % 4 === 0 ? sh : body);
      for (let y = 5; y < 24; y++) { set(7, y, sh); set(24, y, sh); }
      row(7, 24, 5, hi); row(8, 23, 6, hi);
      for (let y = 24; y < 32; y++) row(2, 29, y, y === 24 ? hi : body);
      for (const [x, y] of [[10, 9], [20, 19], [14, 21], [22, 8]]) set(x, y, sh);
      const glow = col.eye || '#7fd6ff';
      const ey = mood === 'shocked' ? 12 : 13;
      row(10, 13, ey, glow); row(18, 21, ey, glow);
      if (mood === 'shocked') { row(10, 13, ey + 1, glow); row(18, 21, ey + 1, glow); }
      row(12, 19, 18, sh);
      if (feats.has('mossy') || feats.has('wood')) for (let x = 7; x <= 24; x++) if (hash(x, 3) > 0.35) { set(x, 5, '#58b84a'); if (hash(x, 4) > 0.55) set(x, 6, '#3f9e4a'); }
      if (feats.has('crystal')) for (const [x, y] of [[9, 3], [10, 2], [22, 3], [23, 1], [23, 2]]) set(x, y, '#9fe6ff');
      if (feats.has('sandy')) { for (const y of [9, 16, 21]) row(8, 23, y, shade(body, 0.18)); ell(16, 21, 1.6, 1.6, (x, y) => set(x, y, col.accent)); }
      if (feats.has('icy')) { row(7, 24, 5, '#ffffff'); row(8, 23, 6, '#ffffff'); for (const [x, y] of [[9, 3], [10, 2], [10, 1], [22, 3], [23, 2], [16, 2], [16, 1]]) set(x, y, '#bfeeff'); }
      if (feats.has('coral')) for (const [x, y] of [[9, 4], [8, 3], [9, 2], [22, 4], [23, 3], [24, 2], [22, 2]]) set(x, y, col.accent);
      if (feats.has('starry')) for (const [x, y] of [[10, 8], [21, 10], [14, 20], [19, 22], [9, 17], [23, 15]]) set(x, y, (x + y) % 2 ? '#fff6c0' : '#ffffff');
      if (feats.has('antlers')) {
        for (const [x, y] of [[8, 4], [7, 3], [6, 2], [5, 1], [8, 2], [9, 1]]) set(x, y, '#9a6a3a');
        for (const [x, y] of [[23, 4], [24, 3], [25, 2], [26, 1], [23, 2], [22, 1]]) set(x, y, '#9a6a3a');
      }
      break;
    }
    case 'quadruped':
    default: {
      for (let y = 22; y < 32; y++) row(6 - (y - 22) / 3, 25 + (y - 22) / 3, y, y < 24 ? sh : body);
      if (feats.has('mane')) ell(16, 15, 12, 11, (x, y, e) => set(x, y, e > 0.8 ? shade(col.accent, 0.25) : col.accent));
      const earC = shade(body, 0.1), earIn = col.belly;
      if (feats.has('shell_back')) ell(16, 24, 13, 6, (x, y, e) => set(x, y, e > 0.7 ? shade(body, 0.1) : shade(body, -0.12)));
      if (feats.has('long_ears')) {
        for (const ex of [11, 20]) for (let y = 0; y < 9; y++) { row(ex - 1, ex + 1, y, earC); set(ex, y + 1, mixHex(col.accent, '#ffffff', 0.3)); }
      } else if (feats.has('ears_pointy')) {
        for (let k = 0; k < 6; k++) { row(8 - (k >> 1), 9 + (k >> 1), 3 + k, earC); row(22 - (k >> 1), 23 + (k >> 1), 3 + k, earC); }
        set(8, 6, earIn); set(23, 6, earIn); set(8, 7, earIn); set(23, 7, earIn);
      } else if (!feats.has('shell_back') && !feats.has('claws') && !feats.has('stinger')) {
        ell(8.5, 7, 3.2, 3.2, (x, y, e) => set(x, y, e < 0.4 ? earIn : earC));
        ell(23.5, 7, 3.2, 3.2, (x, y, e) => set(x, y, e < 0.4 ? earIn : earC));
      } else if (feats.has('shell_back')) {
        for (const s of [-1, 1]) for (let k = 0; k < 5; k++) set(16 + s * (3 + k), 7 - k, shade(body, 0.3));
      }
      ell(16, 15, 9, 8.5, (x, y, e) => set(x, y, e > 0.75 ? sh : y < 10 ? hi : body));
      ell(16, 19.5, 5.2, 3.6, (x, y) => set(x, y, col.belly));
      row(15, 16, 18, OUTLINE); set(14, 18, OUTLINE); set(17, 18, OUTLINE);
      row(15, 16, 21, shade(col.belly, 0.5));
      if (feats.has('tusks')) { set(12, 21, '#fffbea'); set(12, 22, '#fffbea'); set(19, 21, '#fffbea'); set(19, 22, '#fffbea'); }
      if (feats.has('horns')) for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { set(16 + s * (5 + (k >> 1)), 7 - k, '#f6ead0'); set(16 + s * (6 + (k >> 1)), 7 - k, k === 4 ? '#c8a070' : '#f6ead0'); }
      if (feats.has('claws')) for (const s of [-1, 1]) { ell(16 + s * 11, 26, 3.2, 2.8, (x, y) => set(x, y, shade(body, -0.08))); set(16 + s * 11, 23, OUTLINE); set(16 + s * 11, 24, OUTLINE); }
      if (feats.has('stinger')) { for (let k = 0; k < 6; k++) set(27 - (k >> 1), 14 - k * 2, col.accent); ell(24, 3, 1.6, 1.6, (x, y) => set(x, y, col.accent)); }
      if (feats.has('spikes')) for (const x of [11, 16, 21]) { set(x, 6, col.accent); set(x, 5, col.accent); }
      eyesPair(P, 16, 12, 5, mood, col.eye, o.t, false);
      break;
    }
  }
  return outlineGrid(P.g, fig, OUTLINE);
}

// ---------------------------------------------------------------- round 3 boss portraits

const GOLD = '#f2c94c';
const BOSS_PORTRAITS = {
  /** Sultana Sandsnout: cat face under a blue-and-gold striped nemes, gold collar. */
  sphinx(P, col, mood, t, sh, hi) {
    const { set, row, ell } = P;
    const stripe = col.accent;
    for (let y = 22; y < 32; y++) row(4 - ((y - 22) >> 1), 27 + ((y - 22) >> 1), y, y < 25 ? sh : col.body);
    ell(16, 25, 11, 3, (x, y) => set(x, y, GOLD));
    for (const x of [8, 12, 16, 20, 24]) set(x, 26, x % 8 ? '#3fc8d8' : '#ff5a7a');
    // nemes: hood flaring down to the shoulders with gold stripes
    for (let y = 4; y < 24; y++) { const w = 8 + Math.min(6, (y - 4) * 0.45); row(Math.round(16 - w), Math.round(15 + w), y, (y % 3 === 0) ? GOLD : stripe); }
    ell(16, 14, 8, 8.5, (x, y, e) => set(x, y, e > 0.78 ? sh : y < 9 ? hi : col.body));
    ell(16, 19, 4.5, 3, (x, y) => set(x, y, col.belly));
    row(8, 23, 7, GOLD); row(9, 22, 8, shade(GOLD, 0.15)); set(15, 7, '#3fc8d8'); set(16, 7, '#3fc8d8'); set(15, 6, '#3fc8d8'); set(16, 6, '#3fc8d8');
    set(15, 2, GOLD); set(16, 2, GOLD); set(15, 3, GOLD); set(16, 3, GOLD); set(16, 1, GOLD);
    eyesPair(P, 16, 12, 5, mood, col.eye, t, false);
    for (const x of [9, 22]) set(x, 11, '#2a2030');
    row(15, 16, 17, '#a8604a'); row(14, 17, 20, OUTLINE);
  },
  /** Captain Clawsworth: red crab face, eye stalks, white mustache, navy captain's hat, claws. */
  crab_king(P, col, mood, t, sh, hi) {
    const { set, row, ell } = P;
    for (const s of [-1, 1]) ell(16 + s * 12, 25, 4.5, 4.5, (x, y, e) => set(x, y, e > 0.7 ? sh : col.body));
    for (const s of [-1, 1]) { set(16 + s * 12, 21, OUTLINE); set(16 + s * 12, 22, OUTLINE); set(16 + s * 13, 21, OUTLINE); }
    ell(16, 22, 11, 9, (x, y, e) => set(x, y, e > 0.78 ? sh : y < 17 ? hi : col.body));
    ell(16, 27, 7, 3, (x, y) => set(x, y, col.belly));
    // eye stalks + big eyes
    for (const ex of [11, 21]) { for (let y = 9; y < 14; y++) set(ex, y, sh); ell(ex, 8, 3, 3.2, (x, y) => set(x, y, '#ffffff')); set(ex, 8, col.eye || '#1b1b1b'); set(ex, 9, col.eye || '#1b1b1b'); }
    // bicorne hat
    ell(16, 14, 9, 3.4, (x, y) => set(x, y, col.accent));
    row(7, 25, 16, GOLD); set(16, 13, '#ffffff'); set(15, 13, '#ffffff'); set(16, 14, GOLD);
    // mustache and grin
    for (const s of [-1, 1]) { row(16 + (s > 0 ? 1 : -5), 16 + (s > 0 ? 5 : -1), 21, '#f6f0e6'); set(16 + s * 6, 20, '#f6f0e6'); }
    row(13, 18, 24, OUTLINE);
    if (mood === 'shocked') row(14, 17, 25, OUTLINE);
  },
  /** Grumbleflake: white-blue fluffy yeti, blue-grey face patch, grumpy brows, little ice horns. */
  yeti(P, col, mood, t, sh, hi) {
    const { set, row, ell } = P;
    const skin = col.accent;
    for (let y = 20; y < 32; y++) row(2, 29, y, (x => x)(y % 4 === 0 ? shade(col.body, 0.06) : col.body));
    for (let x = 2; x < 30; x += 3) set(x, 20, sh);
    ell(16, 14, 11, 10, (x, y, e) => set(x, y, e > 0.82 ? sh : col.body));
    for (const [x, y] of [[6, 7], [26, 8], [10, 4], [22, 4], [16, 3]]) ell(x, y, 2.2, 2, (xx, yy) => set(xx, yy, col.body));
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) set(16 + s * (7 + (k >> 1)), 5 - k, '#bfeeff');
    ell(16, 16, 7, 6, (x, y, e) => set(x, y, e > 0.8 ? shade(skin, 0.15) : skin));
    eyesPair(P, 16, 14, 4, mood, col.eye, t, false);
    row(10, 13, 12, shade(skin, 0.55)); row(19, 22, 12, shade(skin, 0.55)); set(13, 13, shade(skin, 0.55)); set(18, 13, shade(skin, 0.55));
    row(14, 17, 20, '#3a3a5a'); set(13, 21, '#3a3a5a'); set(18, 21, '#3a3a5a');
    if (mood === 'happy' || mood === 'proud') { row(14, 17, 21, '#3a3a5a'); set(13, 20, '#3a3a5a'); set(18, 20, '#3a3a5a'); }
  },
};

// ---------------------------------------------------------------- public API

/**
 * Build a 32x32 bust portrait grid from a look.
 * @param {Object} look  any look (section 6); humanoid looks get a full bust, creatures a generic one
 * @param {Object} [o]   {mood, t, bg, blink}
 */
export function buildPortrait(look, o = {}) {
  const opts = Object.assign({ mood: 'calm', t: 0, bg: 'academy' }, o);
  if (!look) look = { rig: 'humanoid' };
  if (look.hero === 'laporte' && !o.generic) return buildLaporteFace({ mood: opts.mood, t: opts.t, bg: opts.bg, blink: opts.blink });
  if (look.rig && look.rig !== 'humanoid') return buildCreature(look, opts);
  return buildHumanoid(look, opts);
}

/** Draw a portrait into a canvas (32x32 backing pixels). Use 'laporte' as look for his bespoke portrait. */
export function drawPortrait(canvas, look, mood = 'calm', opts = {}) {
  const l = look === 'laporte' ? { hero: 'laporte' } : look;
  return blitGrid(canvas, buildPortrait(l, Object.assign({}, opts, { mood })));
}

/** Change-detection key: the portrait only needs redrawing when this changes. */
export function portraitKey(look, mood, t, bg) {
  const blink = isBlinking(t || 0) ? 1 : 0;
  const auraPhase = look && look.aura ? Math.floor((t || 0) * 4) % 2 : 0;
  const extra = Math.floor((t || 0) * 3) % 3;
  return (look ? JSON.stringify(look) : '-') + '|' + mood + '|' + blink + auraPhase + extra + '|' + (bg || '');
}

export default drawPortrait;
