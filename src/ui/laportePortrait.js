// Mr. Laporte's 32x32 dialogue portrait: a faithful port of buildFace()/drawPortrait() from studyHallSim
// (game.js, "Mr. Laporte's portrait"). Same pixels and hex colors for the figure; the globals of the original
// (state, run.hair, gameTime, faceEvent, chaos...) became parameters, and the cafeteria wall became a warm
// Academy backdrop. Hair particles (a studyHallSim mechanic) are not part of the port.
//
// buildLaporteFace({expr, mood, t, hairFrac, bg, blink}) -> 32 rows of '#hex' (pure, runs under Node)
// drawLaportePortrait(canvas, mood, opts) -> canvas (32x32 pixels; scale it with CSS)
import { backdropFn } from './backdrops.js';
import { blitGrid } from './pixelart.js';

export const OUTLINE = '#1e1a22';
const HAIR_COL = '#6b4423', HAIR_HI = '#8b5a2b', HAIR_DK = '#4a2e17';
export const BROW_COL = '#4a2e17';
export const MOUTH_COL = '#6e2c1f', MOUTH_IN = '#4a1414', TEETH = '#f8f4ec';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Every hair pixel gets a "keep score": the hairline recedes from the front,
// then the top thins, and the sides go last.
export const HAIR_PIXELS = (() => {
  const out = [];
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let y = 2; y < 15; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = Math.abs(x + 0.5 - 16);
      const inHair = (dx / 9.6) ** 2 + ((y + 0.5 - 14) / 11) ** 2 <= 1;
      // "M" hairline: widow's peak in the middle, temples pushed well back
      const hairline = dx < 2 ? 7 : dx < 3 ? 6 : dx < 4 ? 5 : dx < 6 ? 4 : dx < 7 ? 6 : 12;
      if (!inHair || y >= hairline) continue;
      const side = clamp((dx - 1) / 7, 0, 1);
      const low = clamp((y - 2) / 10, 0, 1);
      const vert = side * low + (1 - side) * (1 - low);
      const keep = clamp(0.6 * side + 0.28 * vert + 0.12 * hash(x, y), 0.02, 0.97);
      let col = HAIR_COL;
      if (y === hairline - 1 || dx > 7.5) col = HAIR_DK;
      else if (y <= 4 && x % 3 === 0) col = HAIR_HI;
      out.push({ x, y, keep, col, idx: y * 32 + x });
    }
  }
  return out;
})();

/** [eyes, brows, mouth] per expression. The first seven are the original's; worried and proud are added. */
export const FACES = {
  calm: ['normal', 'flat', 'smile'],
  annoyed: ['lidded', 'low', 'flat'],
  frustrated: ['squint', 'angry', 'grimace'],
  furious: ['squint', 'angry', 'yell'],
  shocked: ['wide', 'raised', 'o'],
  happy: ['happy', 'raised', 'grin'],
  defeated: ['down', 'sad', 'frown'],
  worried: ['normal', 'sad', 'frown'],
  proud: ['lidded', 'raised', 'smile'],
};

/** Game moods (CONTRACTS section 9) -> portrait expressions. */
export const MOOD_TO_EXPR = { calm: 'calm', happy: 'happy', shocked: 'shocked', annoyed: 'annoyed', worried: 'worried', proud: 'proud' };

export function exprForMood(mood) {
  if (FACES[mood]) return mood;
  return MOOD_TO_EXPR[mood] || 'calm';
}

/**
 * The original's eye / brow / mouth painters, shared with portraits.js so every portrait has the same face style.
 * @param {(x:number, y:number, c:string) => void} set
 * @param {(x0:number, x1:number, y:number, c:string) => void} row
 * @param {string} skinSh  lid color for 'lidded'
 * @param {{brow?: string, eyeX?: number[][]}} [o]
 */
export function faceParts(set, row, skinSh, o = {}) {
  const BROW = o.brow || BROW_COL;
  const eyes = (style) => {
    for (const [x0, pupil] of [[10, 11], [19, 20]]) {
      if (style === 'closed') { row(x0, x0 + 2, 14, BROW); continue; }
      if (style === 'happy') { row(x0, x0 + 2, 13, BROW); set(x0, 14, BROW); set(x0 + 2, 14, BROW); continue; }
      if (style === 'wide') {
        for (let y = 12; y <= 14; y++) row(x0, x0 + 2, y, '#ffffff');
        set(x0 + 1, 13, '#1b1b1b');
        continue;
      }
      const top = style === 'squint' ? 14 : 13;
      for (let y = top; y <= 14; y++) row(x0, x0 + 2, y, '#ffffff');
      for (let y = top; y <= 14; y++) set(pupil, y, '#1b1b1b');
      if (style === 'lidded') row(x0, x0 + 2, 13, skinSh);
      if (style === 'down') { set(pupil, 13, '#ffffff'); }
    }
  };
  const brows = (style) => {
    const L = [10, 11, 12], R = [21, 20, 19]; // outer -> inner
    const ys = {
      flat: [11, 11, 11], low: [12, 12, 12], angry: [11, 12, 13], raised: [10, 9, 10], sad: [12, 11, 10],
    }[style];
    for (let i = 0; i < 3; i++) { set(L[i], ys[i], BROW); set(R[i], ys[i], BROW); }
  };
  const mouth = (style) => {
    const D = MOUTH_COL;
    switch (style) {
      case 'smile': set(13, 20, D); row(14, 17, 21, D); set(18, 20, D); break;
      case 'flat': row(13, 18, 21, D); break;
      case 'grimace':
        row(13, 18, 20, D); set(13, 21, D); row(14, 17, 21, TEETH); set(18, 21, D); row(13, 18, 22, D);
        set(15, 21, '#d5cfc4');
        break;
      case 'yell':
        row(13, 18, 20, D);
        set(13, 21, D); row(14, 17, 21, TEETH); set(18, 21, D);
        set(13, 22, D); row(14, 17, 22, MOUTH_IN); set(18, 22, D);
        row(14, 17, 23, D);
        break;
      case 'o':
        set(15, 20, D); set(16, 20, D);
        set(14, 21, D); set(15, 21, MOUTH_IN); set(16, 21, MOUTH_IN); set(17, 21, D);
        set(14, 22, D); set(15, 22, MOUTH_IN); set(16, 22, MOUTH_IN); set(17, 22, D);
        set(15, 23, D); set(16, 23, D);
        break;
      case 'grin':
        set(12, 20, D); set(19, 20, D);
        set(13, 21, D); row(14, 17, 21, TEETH); set(18, 21, D);
        row(14, 17, 22, D);
        break;
      case 'frown': row(14, 17, 21, D); set(13, 22, D); set(18, 22, D); break;
      default: break;
    }
  };
  return { eyes, brows, mouth };
}

/** True during the short blink window (same rhythm as the original: 0.13 s every 3.7 s). */
export function isBlinking(t) { return (t % 3.7) < 0.13; }

/** Outline every non-figure pixel 4-adjacent to the figure. Returns a new grid. */
export function outlineGrid(g, fig, color = OUTLINE) {
  const out = g.map((r) => r.slice());
  const H = g.length, W = g[0].length;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (fig[y][x]) continue;
      const near = (fig[y][x + 1]) || (x > 0 && fig[y][x - 1]) || (fig[y + 1] && fig[y + 1][x]) || (y > 0 && fig[y - 1][x]);
      if (near) out[y][x] = color;
    }
  }
  return out;
}

/** Sweat drop / anger mark / tears overlays of the original (plus a sweat drop for 'worried'). */
export function faceExtras(out, expr, t) {
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) out[y][x] = c; };
  if (expr === 'furious' && Math.floor(t * 4) % 2) {
    for (const [x, y] of [[25, 2], [27, 2], [26, 3], [25, 4], [27, 4]]) put(x, y, '#e74c3c');
  }
  if (expr === 'frustrated' || expr === 'furious' || expr === 'shocked' || expr === 'worried') {
    const dy = Math.floor(t * 3) % 3;
    put(26, 7 + dy, '#d6f0ff'); put(25, 8 + dy, '#aee3ff'); put(26, 8 + dy, '#aee3ff');
    put(25, 9 + dy, '#7fc8f8'); put(26, 9 + dy, '#7fc8f8');
  }
  if (expr === 'defeated') {
    const dy = Math.floor(t * 2) % 4;
    put(10, 15 + dy, '#7fc8f8'); put(21, 15 + ((dy + 2) % 4), '#7fc8f8');
  }
}


// ---- Round 2: wizard attire (the in-world model wears the same: navy hat with a gold band, maroon cape and a high
// mantle collar with a gold clasp, glowing crystal staff). Painted around the original figure; `attire: false` skips it.
const CAPE = '#7a2e3b', CAPE_DK = '#5a1f2b', CAPE_HI = '#9a4452', GOLD = '#f0c24a', GOLD_DK = '#b98a20';
const HAT = '#243a66', HAT_DK = '#182848', HAT_HI = '#3a548c';

/** Cape at the shoulders and the high mantle collar around the neck (painted before the head, which covers overlaps). */
function paintMantle(set, row) {
  // shoulders of the cape, outside the sweater
  const cape = [[26, 3, 8], [27, 2, 6], [28, 1, 4], [29, 0, 3], [30, 0, 3], [31, 0, 3]];
  for (const [y, x0, x1] of cape) {
    for (let x = x0; x <= x1; x++) {
      set(x, y, x === x0 ? GOLD_DK : (x + y) % 5 === 0 ? CAPE_HI : x === x1 ? CAPE_DK : CAPE);
      set(31 - x, y, x === x0 ? GOLD_DK : (x + y) % 5 === 0 ? CAPE_HI : x === x1 ? CAPE_DK : CAPE);
    }
  }
  // high mantle collar: two upright wings beside the jaw that sweep down to the clasp
  const wing = [[20, 8, 10], [21, 8, 11], [22, 8, 11], [23, 9, 11], [24, 9, 11], [25, 9, 11], [26, 9, 11], [27, 10, 14]];
  for (const [y, x0, x1] of wing) {
    for (let x = x0; x <= x1; x++) {
      const c = x === x0 ? CAPE_DK : x === x1 ? CAPE_HI : CAPE;
      set(x, y, c); set(31 - x, y, c);
    }
  }
  row(8, 10, 20, GOLD_DK); row(21, 23, 20, GOLD_DK);   // gold trim on the standing collar tops
  // gold clasp at the throat, with the chain links
  set(14, 28, GOLD_DK); set(17, 28, GOLD_DK);
  row(14, 17, 27, CAPE_DK);
  set(15, 28, GOLD); set(16, 28, GOLD); set(15, 29, GOLD_DK); set(16, 29, GOLD_DK);
}

/** Wizard hat (crown in rows 0-1, band, wide brim rows 3-4, set back so the M hairline and brows show) and the staff. */
function paintHatAndStaff(set, row) {
  // crown, tip flopping to the right
  row(12, 19, 0, HAT); set(12, 0, HAT_DK); row(20, 23, 0, HAT_HI);
  row(10, 21, 1, HAT); set(10, 1, HAT_DK); row(22, 25, 1, HAT_HI);
  set(26, 2, HAT_HI); set(27, 3, HAT_DK);
  // gold band
  row(9, 22, 2, GOLD); set(9, 2, GOLD_DK); set(22, 2, GOLD_DK); set(14, 2, '#fff1a8'); set(15, 2, '#fff1a8');
  // brim
  row(5, 26, 3, HAT_HI); row(4, 27, 4, HAT); set(4, 4, HAT_DK); set(27, 4, HAT_DK);
  row(8, 23, 4, HAT_DK);
  for (let x = 8; x <= 23; x++) if (x % 2 === 0) set(x, 4, HAT);
  // staff with its glowing crystal on the right
  for (let y = 9; y < 32; y++) { set(28, y, '#8a5a33'); set(29, y, '#4a2e17'); }
  set(27, 12, '#8a5a33'); set(30, 12, '#4a2e17'); set(27, 13, '#8a5a33'); set(30, 13, '#4a2e17');
  set(28, 3, '#bff3ff');
  row(27, 29, 4, '#9fe6ff'); set(28, 4, '#ffffff');
  row(27, 29, 5, '#9fe6ff'); set(28, 5, '#e8fbff');
  row(27, 29, 6, '#7fd6f0'); set(28, 6, '#bff3ff');
  set(28, 7, '#5fc8e8'); set(28, 8, '#4aa8c8');
}

/**
 * Build Laporte's face.
 * @param {Object} [o]
 * @param {string} [o.expr]      an expression from FACES (wins over mood)
 * @param {string} [o.mood]      a game mood (calm happy shocked annoyed worried proud)
 * @param {number} [o.t]         seconds, drives blinking and the animated extras
 * @param {number} [o.hairFrac]  1 = full hair (default)
 * @param {string} [o.bg]        backdrop name (default 'academy'; 'cafeteria' = the original wall)
 * @param {boolean} [o.blink]    false disables blinking
 * @param {boolean} [o.attire]   false = the original studyHallSim figure (golden test); default true = wizard attire
 * @returns {string[][]}
 */
export function buildLaporteFace(o = {}) {
  const expr = o.expr && FACES[o.expr] ? o.expr : exprForMood(o.mood || 'calm');
  const t = o.t || 0;
  const hairFrac = o.hairFrac ?? 1;
  const attire = o.attire !== false;
  const bgFn = backdropFn(o.bg || 'academy');
  const g = [], fig = [];
  for (let y = 0; y < 32; y++) { g.push(new Array(32).fill(null)); fig.push(new Array(32).fill(false)); }
  const set = (x, y, c, figure = true) => {
    if (x < 0 || y < 0 || x > 31 || y > 31) return;
    g[y][x] = c;
    if (figure) fig[y][x] = true;
  };
  const row = (x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(x, y, c); };
  const red = expr === 'furious';
  const skin = red ? '#f2a48a' : '#f6cfa6';
  const skinSh = red ? '#dc8668' : '#e2ae88';

  // Background: the Academy (the original drew its cafeteria wall here)
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) g[y][x] = bgFn(x, y);
  // Neck
  for (let y = 21; y < 27; y++) row(12, 19, y, skinSh);
  // Navy and gray striped quarter-zip: undershirt in the open zip, collar folded flat, zipper
  const STRIPES = [['#24395e', '#1a2a47'], ['#8f9399', '#6e7277']]; // [color, edge shade]
  const COLLAR = '#a3a7ad', COLLAR_EDGE = '#55595f', COLLAR_FOLD = '#c6cacf';
  const sweaterW = [7, 9, 11, 12, 12, 12];
  for (let y = 26; y < 32; y++) {
    const hw = sweaterW[y - 26];
    const [col, sh] = STRIPES[Math.floor((y - 26) / 2) % 2];
    for (let x = 0; x < 32; x++) {
      const dx = Math.abs(x + 0.5 - 16);
      if (dx <= hw) set(x, y, dx > hw - 1.5 ? sh : col);
    }
  }
  row(13, 18, 25, '#d5dbdf');
  row(14, 17, 26, '#ecf0f1');
  row(15, 16, 27, '#ecf0f1');
  // Collar lying flat on the chest, its points running down beside the opening
  const collarL = [[26, 10, 13], [27, 11, 13], [28, 12, 13], [29, 13, 13]];
  for (const [y, x0, x1] of collarL) {
    const c = y === 26 ? COLLAR_FOLD : COLLAR;
    row(x0, x1, y, c);
    row(31 - x1, 31 - x0, y, c);
    set(x0, y, COLLAR_EDGE);
    set(31 - x0, y, COLLAR_EDGE);
  }
  set(15, 28, '#d0d4d6'); set(16, 28, '#d0d4d6');
  for (let y = 29; y < 32; y++) { set(15, y, '#3a3d42'); set(16, y, '#b9bec2'); }
  if (attire) paintMantle(set, row);
  // Ears
  for (const [ex] of [[6, 7], [25, 24]]) {
    for (let y = 13; y <= 16; y++) set(ex, y, skin);
    set(ex === 6 ? 5 : 26, 14, skin); set(ex === 6 ? 5 : 26, 15, skin);
    set(ex, 14, skinSh); set(ex, 15, skinSh);
  }
  // Head
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const e = ((x + 0.5 - 16) / 8.5) ** 2 + ((y + 0.5 - 14) / 10) ** 2;
      if (e <= 1) set(x, y, e > 0.7 && x + 0.5 > 16 ? skinSh : skin);
    }
  }
  // Nose
  set(16, 15, skinSh); set(16, 16, skinSh); set(15, 17, skinSh); set(16, 17, skinSh);
  // Stubble: mustache and chin only (no cheeks)
  const stub = (x, y) => set(x, y, (x + y) % 2 ? '#a07a5e' : '#b88f70');
  for (let x = 13; x <= 18; x++) if ((x + 18) % 2 === 0) stub(x, 18);
  for (let x = 12; x <= 19; x++) stub(x, 19);
  // stubble running down past the corners of the mouth joins the chin (goatee)
  stub(12, 20); stub(12, 21); stub(19, 20); stub(19, 21); stub(13, 21); stub(18, 21);
  stub(15, 21); stub(16, 21);
  for (let x = 13; x <= 18; x++) stub(x, 22);
  for (let x = 14; x <= 17; x++) stub(x, 23);

  // Eyes and eyebrows
  const blink = o.blink !== false && isBlinking(t);
  const { eyes, brows, mouth } = faceParts(set, row, skinSh);
  const [eyeStyle, browStyle, mouthStyle] = FACES[expr];
  const canBlink = ['normal', 'lidded', 'squint', 'down'].includes(eyeStyle);
  eyes(blink && canBlink ? 'closed' : eyeStyle);
  brows(browStyle);
  mouth(mouthStyle);

  // Hair (what's left of it)
  const visible = new Set();
  for (const hp of HAIR_PIXELS) {
    if (hairFrac >= 1 - hp.keep) { set(hp.x, hp.y, hp.col); visible.add(hp.idx); }
  }
  // Shiny scalp once enough hair is gone
  if (hairFrac < 0.6) {
    for (const [x, y] of [[12, 6], [13, 5], [14, 5]]) if (!visible.has(y * 32 + x)) set(x, y, '#fff1dc');
  }

  if (attire) paintHatAndStaff(set, row);

  // Dark outline around the figure, then the extras on top
  const out = outlineGrid(g, fig, OUTLINE);
  faceExtras(out, expr, t);
  return out;
}

/**
 * Draw Laporte into a canvas at 32x32 (CSS scales it; use `image-rendering: pixelated`).
 * @param {HTMLCanvasElement} canvas
 * @param {string} [mood] game mood or original expression
 * @param {Object} [opts] {t, hairFrac, bg, blink}
 */
export function drawLaportePortrait(canvas, mood = 'calm', opts = {}) {
  const g = buildLaporteFace(Object.assign({}, opts, FACES[mood] ? { expr: mood } : { mood }));
  return blitGrid(canvas, g);
}

export default drawLaportePortrait;
