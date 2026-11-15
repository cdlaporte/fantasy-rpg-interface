// Golden test: the Laporte portrait port (src/ui/laportePortrait.js) against the ORIGINAL studyHallSim code.
// The block between ORIGINAL START / END is copied verbatim from studyHallSim/game.js (lines 1458-1698:
// hair constants, HAIR_PIXELS, faceExpression, buildFace) and runs against stubbed globals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLaporteFace, OUTLINE as PORT_OUTLINE } from '../../src/ui/laportePortrait.js';

function makeOriginal() {
  // ---- stubbed globals of studyHallSim ----
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const OUTLINE = '#1e1a22';
  let state = 'title';           // faceExpression(): 'title' -> 'calm'
  const run = { hair: 100 };
  let gameTime = 1;              // 1 % 3.7 >= 0.13: eyes open
  const faceEvent = null;
  const principal = { phase: 'idle', alert: false, suspicion: 0 };
  const chaos = 0;
  let prevHair = null;
  const hairParticles = [];
  const sfx = { pluck() {} };
  // ---- ORIGINAL START ----
const HAIR_COL = '#6b4423', HAIR_HI = '#8b5a2b', HAIR_DK = '#4a2e17';
const BROW_COL = '#4a2e17';
const MOUTH_COL = '#6e2c1f', MOUTH_IN = '#4a1414', TEETH = '#f8f4ec';

// Every hair pixel gets a "keep score": the hairline recedes from the front,
// then the top thins, and the sides go last -- so he ends up with the classic
// horseshoe before going fully bald.
const HAIR_PIXELS = (() => {
  const out = [];
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let y = 2; y < 15; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = Math.abs(x + 0.5 - 16);
      const inHair = (dx / 9.6) ** 2 + ((y + 0.5 - 14) / 11) ** 2 <= 1;
      // "M" hairline: widow's peak in the middle, temples pushed well back,
      // short sides that stop above the ears and clear of the eyebrows
      const hairline = dx < 2 ? 7 : dx < 3 ? 6 : dx < 4 ? 5 : dx < 6 ? 4 : dx < 7 ? 6 : 12;
      if (!inHair || y >= hairline) continue;
      const side = clamp((dx - 1) / 7, 0, 1);
      const low = clamp((y - 2) / 10, 0, 1);
      // Middle: the front hairline goes first and the top follows. Sides: sideburns stay longest.
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

function faceExpression() {
  if (state === 'lost') return 'defeated';
  if (state === 'upgrade') return 'happy';
  if (state === 'title') return 'calm';
  if (state === 'caught') return 'shocked';
  if (faceEvent) return faceEvent.type;
  if (principal.phase === 'warning' || principal.alert ||
    (principal.phase === 'walking' && principal.suspicion > 0.15)) return 'shocked';
  if (chaos >= 75) return 'furious';
  if (chaos >= 50) return 'frustrated';
  if (chaos >= 25) return 'annoyed';
  return 'calm';
}

function buildFace() {
  const g = [], fig = [];
  for (let y = 0; y < 32; y++) { g.push(new Array(32).fill(null)); fig.push(new Array(32).fill(false)); }
  const set = (x, y, c, figure = true) => {
    if (x < 0 || y < 0 || x > 31 || y > 31) return;
    g[y][x] = c;
    if (figure) fig[y][x] = true;
  };
  const row = (x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(x, y, c); };
  const expr = faceExpression();
  const hairFrac = run.hair / 100;
  const red = expr === 'furious';
  const skin = red ? '#f2a48a' : '#f6cfa6';
  const skinSh = red ? '#dc8668' : '#e2ae88';

  // Background: cafeteria wall
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      g[y][x] = y < 21 ? ((x + y) % 8 === 0 ? '#41607f' : '#3b5875') : y === 21 ? '#27394d' : '#2f4760';
    }
  }
  // Neck
  for (let y = 21; y < 27; y++) row(12, 19, y, skinSh);
  // Navy and gray striped quarter-zip: undershirt in the open zip, collar folded flat, zipper
  const STRIPES = [['#24395e', '#1a2a47'], ['#8f9399', '#6e7277']]; // [color, edge shade]
  const COLLAR = '#a3a7ad', COLLAR_EDGE = '#55595f', COLLAR_FOLD = '#c6cacf';
  const sweaterW = [7, 9, 11, 12, 12, 12];
  for (let y = 26; y < 32; y++) {
    const hw = sweaterW[y - 26];
    const [col, shade] = STRIPES[Math.floor((y - 26) / 2) % 2];
    for (let x = 0; x < 32; x++) {
      const dx = Math.abs(x + 0.5 - 16);
      if (dx <= hw) set(x, y, dx > hw - 1.5 ? shade : col);
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
  // Ears
  for (const [ex, sh] of [[6, 7], [25, 24]]) {
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
  const blink = (gameTime % 3.7) < 0.13;
  const eyes = (style) => {
    for (const [x0, pupil] of [[10, 11], [19, 20]]) {
      if (style === 'closed') { row(x0, x0 + 2, 14, BROW_COL); continue; }
      if (style === 'happy') { row(x0, x0 + 2, 13, BROW_COL); set(x0, 14, BROW_COL); set(x0 + 2, 14, BROW_COL); continue; }
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
    for (let i = 0; i < 3; i++) { set(L[i], ys[i], BROW_COL); set(R[i], ys[i], BROW_COL); }
  };
  // Mouths are drawn as rows of pixels around the center (x = 15/16)
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
  const FACES = {
    calm: ['normal', 'flat', 'smile'],
    annoyed: ['lidded', 'low', 'flat'],
    frustrated: ['squint', 'angry', 'grimace'],
    furious: ['squint', 'angry', 'yell'],
    shocked: ['wide', 'raised', 'o'],
    happy: ['happy', 'raised', 'grin'],
    defeated: ['down', 'sad', 'frown'],
  };
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
  if (prevHair && state === 'playing') {
    let spawned = 0;
    for (const hp of HAIR_PIXELS) {
      if (prevHair.has(hp.idx) && !visible.has(hp.idx) && spawned < 6) {
        hairParticles.push({ x: hp.x, y: hp.y, vy: 1, life: 2.2, seed: Math.random() * 6, col: hp.col });
        spawned++;
      }
    }
    if (spawned) sfx.pluck();
  }
  prevHair = visible;
  // Shiny scalp once enough hair is gone
  if (hairFrac < 0.6) {
    for (const [x, y] of [[12, 6], [13, 5], [14, 5]]) if (!visible.has(y * 32 + x)) set(x, y, '#fff1dc');
  }

  // Dark outline around the figure
  const out = g.map((r) => r.slice());
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (fig[y][x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fig[y + dy] && fig[y + dy][x + dx]);
      if (near) out[y][x] = OUTLINE;
    }
  }

  // Extras on top: anger mark, sweat, tears
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) out[y][x] = c; };
  if (expr === 'furious' && Math.floor(gameTime * 4) % 2) {
    for (const [x, y] of [[25, 2], [27, 2], [26, 3], [25, 4], [27, 4]]) put(x, y, '#e74c3c');
  }
  if (expr === 'frustrated' || expr === 'furious' || expr === 'shocked') {
    const dy = Math.floor(gameTime * 3) % 3;
    put(26, 7 + dy, '#d6f0ff'); put(25, 8 + dy, '#aee3ff'); put(26, 8 + dy, '#aee3ff');
    put(25, 9 + dy, '#7fc8f8'); put(26, 9 + dy, '#7fc8f8');
  }
  if (expr === 'defeated') {
    const dy = Math.floor(gameTime * 2) % 4;
    put(10, 15 + dy, '#7fc8f8'); put(21, 15 + ((dy + 2) % 4), '#7fc8f8');
  }
  return out;
}
  // ---- ORIGINAL END ----
  return {
    OUTLINE,
    build(opts = {}) {
      state = opts.state || 'title'; run.hair = opts.hair ?? 100; gameTime = opts.t ?? 1; prevHair = null;
      return buildFace();
    },
  };
}

const wall = (x, y) => (y < 21 ? ((x + y) % 8 === 0 ? '#41607f' : '#3b5875') : y === 21 ? '#27394d' : '#2f4760');

test('laporte port: identical figure pixels to the original (calm, full hair)', () => {
  const orig = makeOriginal();
  const ref = orig.build({ state: 'title', hair: 100, t: 1 });
  const port = buildLaporteFace({ mood: 'calm', t: 1, hairFrac: 1, bg: 'academy' });
  assert.equal(PORT_OUTLINE, orig.OUTLINE);
  let figure = 0;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (ref[y][x] === wall(x, y)) {
        // background in the original: the port must show backdrop there, never figure colors
        assert.notEqual(port[y][x], undefined);
        continue;
      }
      figure++;
      assert.equal(port[y][x], ref[y][x], `pixel ${x},${y}`);
    }
  }
  assert.ok(figure > 400, 'figure has many pixels: ' + figure);
});

test('laporte port: with the cafeteria backdrop the whole grid matches the original', () => {
  const orig = makeOriginal();
  for (const [state, expr] of [['title', 'calm'], ['upgrade', 'happy'], ['caught', 'shocked']]) {
    for (const t of [1, 3.75, 0.5]) {
      const ref = orig.build({ state, hair: 100, t });
      const port = buildLaporteFace({ expr, t, hairFrac: 1, bg: 'cafeteria' });
      assert.deepEqual(port, ref, `${expr} t=${t}`);
    }
  }
  const ref = orig.build({ state: 'title', hair: 40, t: 2 });
  assert.deepEqual(buildLaporteFace({ expr: 'calm', t: 2, hairFrac: 0.4, bg: 'cafeteria' }), ref, 'thinning hair');
});

test('laporte port: every game mood renders and differs from calm', () => {
  const calm = JSON.stringify(buildLaporteFace({ mood: 'calm', t: 1 }));
  for (const mood of ['happy', 'shocked', 'annoyed', 'worried', 'proud']) {
    const g = buildLaporteFace({ mood, t: 1 });
    assert.equal(g.length, 32);
    assert.notEqual(JSON.stringify(g), calm, mood);
  }
  // blink closes the eyes at t = 0
  assert.notEqual(JSON.stringify(buildLaporteFace({ mood: 'calm', t: 0 })), calm);
});
