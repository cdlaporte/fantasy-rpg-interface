// Pix: a tiny software pixel buffer (art resolution, 1 px = 1 art pixel) used to paint every sprite,
// tile chunk and prop crisply (no anti-aliasing), then auto-outline it and turn it into a canvas once.
// Colors are '#rrggbb' strings (converted and memoized) or 0 for transparent.
import { rgb, OUTLINE } from './color.js';

const u32Cache = new Map();
/** '#rrggbb' -> packed ABGR uint32 (ImageData little-endian layout), alpha 255. */
export function u32(c) {
  if (c === 0 || c === null || c === undefined) return 0;
  let v = u32Cache.get(c);
  if (v !== undefined) return v;
  const [r, g, b] = rgb(c);
  v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  u32Cache.set(c, v);
  return v;
}

/** Integer hash -> 0..1 (deterministic noise for decoration). */
export function hash(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

let makeCanvasImpl = null;
/** Create a canvas (DOM or Offscreen). */
export function makeCanvas(w, h) {
  if (!makeCanvasImpl) {
    if (typeof document !== 'undefined') makeCanvasImpl = (a, b) => { const c = document.createElement('canvas'); c.width = a; c.height = b; return c; };
    else makeCanvasImpl = (a, b) => new OffscreenCanvas(a, b);
  }
  return makeCanvasImpl(Math.max(1, w | 0), Math.max(1, h | 0));
}

export class Pix {
  constructor(w, h) {
    this.w = w | 0; this.h = h | 0;
    this.d = new Uint32Array(this.w * this.h);
  }
  clear() { this.d.fill(0); return this; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = typeof c === 'number' ? c : u32(c);
  }
  /** Set only where already painted (clip to existing shape). */
  setIn(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.d[i]) this.d[i] = typeof c === 'number' ? c : u32(c);
  }
  get(x, y) { x |= 0; y |= 0; return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x]; }
  rect(x, y, w, h, c) {
    const v = typeof c === 'number' ? c : u32(c);
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0), y1 = Math.min(this.h, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) {
      const o = yy * this.w;
      for (let xx = x0; xx < x1; xx++) this.d[o + xx] = v;
    }
    return this;
  }
  /** Rect clipped to already-painted pixels. */
  rectIn(x, y, w, h, c) {
    const v = typeof c === 'number' ? c : u32(c);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
      const i = yy * this.w + xx;
      if (this.d[i]) this.d[i] = v;
    }
    return this;
  }
  hline(x0, x1, y, c) { if (x1 < x0) [x0, x1] = [x1, x0]; return this.rect(x0, y, x1 - x0 + 1, 1, c); }
  vline(x, y0, y1, c) { if (y1 < y0) [y0, y1] = [y1, y0]; return this.rect(x, y0, 1, y1 - y0 + 1, c); }
  /** Bresenham line. */
  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const v = typeof c === 'number' ? c : u32(c);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 4096; guard++) {
      this.set(x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /** Thick line: a square brush of size `t`. */
  thick(x0, y0, x1, y1, t, c) {
    const o = -((t - 1) >> 1);
    for (let i = 0; i < t; i++) for (let j = 0; j < t; j++) this.line(x0 + o + i, y0 + o + j, x1 + o + i, y1 + o + j, c);
    return this;
  }
  /** Filled ellipse centered at (cx, cy) (may be .5) with radii rx, ry. */
  ellipse(cx, cy, rx, ry, c) {
    const v = typeof c === 'number' ? c : u32(c);
    if (rx <= 0 || ry <= 0) return this;
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const ny = (y + 0.5 - cy) / ry;
      if (ny < -1 || ny > 1) continue;
      const span = rx * Math.sqrt(1 - ny * ny);
      const xa = Math.round(cx - span), xb = Math.round(cx + span) - 1;
      if (xb >= xa) this.hline(xa, xb, y, v);
    }
    return this;
  }
  /**
   * Ellipse with 3-tone (or 4 with rim) shading: light from the top-left.
   * opts: {lo: shadow color, hi: highlight color, hiT, loT}
   */
  shaded(cx, cy, rx, ry, base, lo, hi, loT = 0.3, hiT = 0.62) {
    const vb = u32(base), vl = u32(lo), vh = hi ? u32(hi) : vb;
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const ny = (y + 0.5 - cy) / ry;
      if (ny < -1 || ny > 1) continue;
      const span = rx * Math.sqrt(1 - ny * ny);
      const xa = Math.round(cx - span), xb = Math.round(cx + span) - 1;
      for (let x = xa; x <= xb; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const l = -(nx * 0.55 + ny * 0.8);
        // distance to rim gives a slight shadow toward the bottom-right edge
        this.set(x, y, l < -loT ? vl : (hi && l > hiT ? vh : vb));
      }
    }
    return this;
  }
  /** Filled polygon (even-odd scanline). pts = [x0,y0,x1,y1,...]. */
  poly(pts, c) {
    const v = typeof c === 'number' ? c : u32(c);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
    const xs = [];
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
        const yi = pts[i + 1], yj = pts[j + 1];
        if ((yi > sy) !== (yj > sy)) xs.push(pts[i] + (sy - yi) / (yj - yi) * (pts[j] - pts[i]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]) - 1;
        if (xb >= xa) this.hline(xa, xb, y, v);
      }
    }
    return this;
  }
  /** Copy another Pix onto this one (transparent pixels skipped). */
  blit(src, dx, dy, flip = false) {
    for (let y = 0; y < src.h; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const v = src.d[y * src.w + (flip ? src.w - 1 - x : x)];
        if (!v) continue;
        const tx = x + dx;
        if (tx < 0 || tx >= this.w) continue;
        this.d[ty * this.w + tx] = v;
      }
    }
    return this;
  }
  /** Darken already-painted pixels by factor t (0..1) toward a cool shadow (ground shadows, ambient occlusion). */
  darkenPx(x, y, t) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x, v = this.d[i];
    if (!v) return;
    const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
    const k = 1 - t;
    const nr = r * k + 30 * t, ng = g * k + 22 * t, nb = b * k + 60 * t;
    this.d[i] = ((255 << 24) | ((nb & 255) << 16) | ((ng & 255) << 8) | (nr & 255)) >>> 0;
  }
  /** Lighten already-painted pixels by factor t toward warm white. */
  lightenPx(x, y, t) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x, v = this.d[i];
    if (!v) return;
    const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
    const k = 1 - t;
    const nr = r * k + 255 * t, ng = g * k + 250 * t, nb = b * k + 225 * t;
    this.d[i] = ((255 << 24) | ((nb & 255) << 16) | ((ng & 255) << 8) | (nr & 255)) >>> 0;
  }
  /** Darken an elliptical area (soft-ish: stronger in the middle). */
  shadowEllipse(cx, cy, rx, ry, t) {
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const ny = (y + 0.5 - cy) / ry;
      if (ny < -1 || ny > 1) continue;
      const span = rx * Math.sqrt(1 - ny * ny);
      for (let x = Math.round(cx - span); x < Math.round(cx + span); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const dd = nx * nx + ny * ny;
        this.darkenPx(x, y, dd > 0.6 ? t * 0.6 : t);
      }
    }
  }
  /** Replace every pixel of color a with b. */
  swap(a, b) {
    const va = u32(a), vb = u32(b);
    for (let i = 0; i < this.d.length; i++) if (this.d[i] === va) this.d[i] = vb;
    return this;
  }
  /** Mirror horizontally into a new Pix. */
  flipped() {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[y * this.w + this.w - 1 - x];
    return p;
  }
  /** Rotate 90 degrees clockwise (dir=1) or counter-clockwise (dir=-1) into a new Pix. */
  rot90(dir = 1) {
    const p = new Pix(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const v = this.d[y * this.w + x];
      if (!v) continue;
      if (dir > 0) p.d[x * p.w + (this.h - 1 - y)] = v;
      else p.d[(this.w - 1 - x) * p.w + y] = v;
    }
    return p;
  }
  /**
   * Add a 1-pixel outline around painted pixels (4-neighborhood), the studyHallSim house style.
   * `skip` (optional Set of u32) colors that do not get outlined (glows, sparkles).
   */
  outline(c = OUTLINE, skip = null) {
    const v = u32(c), w = this.w, h = this.h, d = this.d;
    const src = d.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (src[i]) continue;
      const n = (x > 0 && src[i - 1] && !(skip && skip.has(src[i - 1]))) ||
        (x < w - 1 && src[i + 1] && !(skip && skip.has(src[i + 1]))) ||
        (y > 0 && src[i - w] && !(skip && skip.has(src[i - w]))) ||
        (y < h - 1 && src[i + w] && !(skip && skip.has(src[i + w])));
      if (n) d[i] = v;
    }
    return this;
  }
  /** Paint every opaque pixel a single color (silhouettes, flash variants). */
  fillAll(c) {
    const v = u32(c);
    for (let i = 0; i < this.d.length; i++) if (this.d[i]) this.d[i] = v;
    return this;
  }
  /** Bounding box of painted pixels or null. */
  bounds() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!this.d[y * this.w + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }
  /** To a canvas of the same size. */
  toCanvas() {
    const c = makeCanvas(this.w, this.h);
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.d);
    g.putImageData(img, 0, 0);
    return c;
  }
  /** Write into an existing canvas context at (x, y). */
  putTo(g, x = 0, y = 0) {
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.d);
    g.putImageData(img, x, y);
  }
}

/** Tiny helper: a sprite record. ax/ay = anchor (feet / base) in sprite px. */
export function sprite(canvas, ax, ay, extra) {
  return Object.assign({ c: canvas, w: canvas.width, h: canvas.height, ax, ay }, extra || null);
}
