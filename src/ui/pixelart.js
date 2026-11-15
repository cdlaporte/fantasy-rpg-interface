// Pixel grid helpers: grids are arrays of rows of '#rrggbb' strings (null = transparent).
// Building a grid is pure; blitting needs a canvas (browser only).

const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    let h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}

/** w x h grid filled with `fill`. */
export function makeGrid(w = 32, h = w, fill = null) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill(fill));
  return g;
}

const imgCache = new WeakMap();

/** Draw a grid 1:1 into a canvas (resizes the canvas to the grid). CSS scales it up with pixelated rendering. */
export function blitGrid(canvas, g) {
  const h = g.length, w = g[0].length;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  let img = imgCache.get(canvas);
  if (!img || img.width !== w || img.height !== h) { img = ctx.createImageData(w, h); imgCache.set(canvas, img); }
  const d = img.data;
  let i = 0;
  for (let y = 0; y < h; y++) {
    const row = g[y];
    for (let x = 0; x < w; x++, i += 4) {
      const c = row[x];
      if (!c) { d[i + 3] = 0; continue; }
      const v = rgb(c);
      d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Signature of a grid (for change detection / tests). */
export function gridKey(g) { return g.map((r) => r.map((c) => c || '-').join(',')).join('|'); }
