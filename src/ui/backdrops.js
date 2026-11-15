// 32x32 portrait backdrops, shared by laportePortrait.js and portraits.js. Pure (no DOM).
// Each backdrop is (x, y) -> '#hex' | null (null = transparent).

/** The original studyHallSim cafeteria wall (kept for the golden test and nostalgia). */
function cafeteria(x, y) {
  return y < 21 ? ((x + y) % 8 === 0 ? '#41607f' : '#3b5875') : y === 21 ? '#27394d' : '#2f4760';
}

/** Warm Academy hall: sandstone bricks, an arched window on the left, a crimson banner on the right, oak wainscot. */
function academy(x, y) {
  if (y > 22) return x % 6 === 0 ? '#5e3720' : y === 23 ? '#8a5a32' : '#7a4a2a';
  if (y === 22) return '#8a5a32';
  if (y === 21) return '#6b3f22';
  // window (x 1..5, y 3..14, arched top)
  if (x >= 1 && x <= 5 && y >= 3 && y <= 14) {
    if (y === 3 && (x === 1 || x === 5)) return wallAt(x, y);
    if (y === 3 || x === 1 || x === 5 || y === 14 || (y === 4 && (x === 1 || x === 5))) return '#6b3f22';
    if (x === 3 || y === 9) return '#8a5a32';
    return (x + y) % 5 === 0 ? '#d6f3ff' : y < 9 ? '#9fdcff' : '#b7e6ff';
  }
  // banner (x 26..30, y 0..13, swallow-tail bottom)
  if (x >= 26 && x <= 30 && y <= 13) {
    if (y === 13 && x === 28) return wallAt(x, y);
    if (y === 12 && x === 28) return '#8f2b3a';
    if (x === 26 || x === 30) return '#f2c94c';
    if ((x === 28 && (y === 5 || y === 7)) || (y === 6 && x >= 27 && x <= 29)) return '#f2c94c';
    return y === 0 ? '#8f2b3a' : '#b83a4b';
  }
  return wallAt(x, y);
}

function wallAt(x, y) {
  const row = Math.floor(y / 4);
  if (y % 4 === 3) return '#c48f5a';
  if ((x + (row % 2) * 4) % 8 === 0) return '#c48f5a';
  return (x * 7 + y * 13) % 23 === 0 ? '#e8bf8a' : '#e0b27a';
}

/** Bright sky with soft clouds and a grass line (left panel). */
function sky(x, y) {
  if (y >= 27) return y === 27 ? '#7cc95a' : '#69b84c';
  const cloud = ((x - 4) * (x - 4)) / 9 + ((y - 7) * (y - 7)) / 3 <= 1 || ((x - 27) * (x - 27)) / 8 + ((y - 4) * (y - 4)) / 2.5 <= 1;
  if (cloud) return '#ffffff';
  return y < 9 ? '#8fd3ff' : y < 18 ? '#a6ddff' : '#bfe7ff';
}

/** Dappled Whisperwood green. */
function forest(x, y) {
  if (y >= 26) return (x + y) % 3 === 0 ? '#4fa53c' : '#5fb548';
  const leaf = (x * 5 + y * 3) % 7 === 0;
  return leaf ? '#9be07a' : y < 12 ? '#3f8f4a' : '#4a9a52';
}

/** Town plaza: warm plaster and a striped awning. */
function town(x, y) {
  if (y < 5) return (Math.floor(x / 3) % 2) ? '#f4f1e8' : '#e2503c';
  if (y === 5) return '#b8634a';
  if (y >= 25) return (x + y) % 4 === 0 ? '#a9a49a' : '#c4c0b6';
  return (x * 3 + y * 7) % 19 === 0 ? '#f7e3bd' : '#f0d6a8';
}

/** Parchment (pickers, generic). */
function parchment(x, y) { return (x * 7 + y * 5) % 17 === 0 ? '#ecd3a4' : '#f4e2bd'; }

const BACKDROPS = { cafeteria, academy, sky, forest, town, parchment };

/** Resolve a backdrop option to a function: name, '#hex' (solid), or 'none' / null (transparent). */
export function backdropFn(bg) {
  if (typeof bg === 'function') return bg;
  if (bg && BACKDROPS[bg]) return BACKDROPS[bg];
  if (typeof bg === 'string' && bg[0] === '#') return () => bg;
  if (bg === 'none' || bg === null) return () => null;
  return academy;
}

export const BACKDROP_NAMES = Object.keys(BACKDROPS);
