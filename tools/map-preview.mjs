#!/usr/bin/env node
// Zone map preview: `node tools/map-preview.mjs <zoneId> [out.png] [scale]` (default out tests/e2e/out/map-<zone>.png, scale 8).
// Pure Node (zlib only). Tiles by palette color, prop footprints with a glyph per model, markers as labeled dots,
// spawn areas (red), exits (blue), gates (magenta), chests (gold), triggers (orange) as outlined rectangles.
// Grid lines every 10 tiles with coordinates in the margins. Options: --no-labels, --no-deco, --crop=x,y,w,h (tiles).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL, fileURLToPath } from 'node:url';
import data from '../src/data/index.js';
import { furnitureRect } from '../src/data/zones/mapgen.js';
import { buildZone } from './validate-data.mjs';

// ---- minimal PNG encoder --------------------------------------------------------------------------------------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb));
  return Buffer.concat([len, tb, crc]);
}
export function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy ? rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3) : null; }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- tiny raster ------------------------------------------------------------------------------------------------
const FONT = {
  a: '010101111101101', b: '110101110101110', c: '011100100100011', d: '110101101101110', e: '111100110100111', f: '111100110100100',
  g: '011100101101011', h: '101101111101101', i: '111010010010111', j: '001001001101010', k: '101101110101101', l: '100100100100111',
  m: '101111111101101', n: '110101101101101', o: '010101101101010', p: '110101110100100', q: '010101101110011', r: '110101110101101',
  s: '011100010001110', t: '111010010010010', u: '101101101101111', v: '101101101101010', w: '101101111111101', x: '101101010101101',
  y: '101101010010010', z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  _: '000000000000111', '-': '000000111000000', '>': '100010001010100', ':': '000010000010000', '.': '000000000000010',
  '/': '001001010100100', '+': '000010111010000', '?': '110001010000010', '!': '010010010000010', ' ': '000000000000000',
  '(': '010100100100010', ')': '010001001001010', '#': '101111101111101', '=': '000111000111000', '*': '000101010101000',
};
const hex = (c) => { const n = parseInt((c || '#ff00ff').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a, b, t) => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t));

class Raster {
  constructor(w, h, bg) { this.w = w; this.h = h; this.buf = Buffer.alloc(w * h * 3); this.fill(0, 0, w, h, bg); }
  px(x, y, c, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    if (a >= 1) { this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2]; return; }
    for (let k = 0; k < 3; k++) this.buf[i + k] = Math.round(this.buf[i + k] * (1 - a) + c[k] * a);
  }
  fill(x, y, w, h, c, a = 1) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a); }
  rect(x, y, w, h, c, t = 1, dash = 0) {
    for (let k = 0; k < t; k++) {
      for (let xx = x; xx < x + w; xx++) if (!dash || ((xx / dash) | 0) % 2 === 0) { this.px(xx, y + k, c); this.px(xx, y + h - 1 - k, c); }
      for (let yy = y; yy < y + h; yy++) if (!dash || ((yy / dash) | 0) % 2 === 0) { this.px(x + k, yy, c); this.px(x + w - 1 - k, yy, c); }
    }
  }
  disc(cx, cy, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) this.px(cx + x, cy + y, c); }
  text(s, x, y, c, s2 = 1, outline = [20, 20, 28]) {
    s = String(s).toLowerCase();
    const draw = (ox, oy, col) => {
      for (let n = 0; n < s.length; n++) {
        const g = FONT[s[n]] || FONT['?'];
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '1') this.fill(x + ox + (n * 4 + q) * s2, y + oy + r * s2, s2, s2, col);
      }
    };
    if (outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) draw(ox, oy, outline);
    draw(0, 0, c);
    return s.length * 4 * s2;
  }
}

// ---- model glyphs -----------------------------------------------------------------------------------------------
const GLYPH = {
  tree: 'T', pine: 'A', bush: 'b', rock: 'o', stump: 's', log: '=', flowerbed: '*', mushroom_big: 'm', crystal: 'c', fence: '#',
  hedge_arch: 'n', lamp: 'l', sign: '?', bench: 'b', well: 'w', fountain: 'f', statue: 's', barrel: 'o', crate: 'x', stall: 's', cart: 'c',
  campfire: '!', tent: 't', house: 'h', shop: '$', tower: 't', academy: 'a', gate_arch: 'g', rune_gate: 'r', bridge: '=', banner: '!',
  bookshelf: 'k', desk: 'd', table: 't', chair: 'c', bed: 'b', cauldron: 'u', chalkboard: 'c', rug: 'r', chest: 'c',
  // round 3 biome models
  palm: 'p', cactus: 'y', ruin_pillar: 'i', obelisk: 'i', pottery: 'u', dune: '-', shell: 'e', coral: 'y', boat: 'b', tidepool: 'o',
  lighthouse: 'h', snowman: 's', igloo: 'n', snow_pine: 'a', ice_spire: 'v', cloud_puff: 'o', floating_rock: 'f', star_lamp: 'l',
  orrery: 'o', moon_flower: '+',
};
function propColor(p) {
  const l = p.def ? p.def.look : {};
  const key = { tree: 'leaves', pine: 'leaves', bush: 'leaves', rock: 'body', stump: 'top', log: 'bark', flowerbed: 'petals', mushroom_big: 'cap',
    crystal: 'body', house: 'roof', shop: 'roof', tower: 'roof', academy: 'roof', stall: 'awning', tent: 'cloth', banner: 'cloth', rug: 'main',
    fountain: 'water', well: 'roof', lamp: 'light', gate_arch: 'trim', rune_gate: 'rune', bed: 'sheet', chalkboard: 'board', bookshelf: 'books',
    cauldron: 'brew', campfire: 'flame',
    palm: 'leaves', cactus: 'body', ruin_pillar: 'stone', obelisk: 'stone', pottery: 'clay', dune: 'sand', shell: 'shell', coral: 'body',
    boat: 'hull', tidepool: 'water', lighthouse: 'stripe', snowman: 'snow', igloo: 'ice', snow_pine: 'leaves', ice_spire: 'ice',
    cloud_puff: 'cloud', floating_rock: 'grass', star_lamp: 'star', orrery: 'metal', moon_flower: 'petal' }[p.model];
  const v = Object.assign({}, l, p.src && p.src.look);
  const c = (key && v[key]) || Object.values(v).find((x) => typeof x === 'string' && x[0] === '#') || '#ff00ff';
  return hex(c);
}

export function renderZone(id, { scale = 8, labels = true, deco = true, crop = null } = {}) {
  const z = buildZone(id);
  const { def } = z;
  // crop [x, y, w, h] in tiles: render the full map, then cut (keeps the code simple)
  const w = z.w, h = z.h;
  const M = 18;                                  // margin (px) for coordinates
  const S = scale;
  const R = new Raster(w * S + M * 2, h * S + M * 2, [24, 26, 34]);
  const pal = (data.palettes.PALETTES || {})[def.palette] || {};
  const pats = pal.patterns || {};
  // tiles
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const td = data.tiles.list[z.tiles[y * w + x]];
    const col = Object.assign({}, td.colors, pats[td.pattern]);
    let c = hex(col.a);
    const v = z.variant[y * w + x];
    if (td.pattern === 'flowers' && (v & 7) < 3) c = hex(col.b);
    else if (td.pattern === 'tallgrass' && (v & 3) === 0) c = hex(col.b);
    else c = mixc(c, hex(col.b), (v & 15) / 40);
    if (td.shape === 'block') c = mixc(c, [0, 0, 0], 0.22);
    R.fill(M + x * S, M + y * S, S, S, c);
    if (td.shape === 'block' && S >= 6) { R.fill(M + x * S, M + y * S + S - 2, S, 2, mixc(hex(col.side || col.b), [0, 0, 0], 0.25)); }
    if (td.shape === 'water' && S >= 6 && (v & 3) === 0) R.fill(M + x * S + 1, M + y * S + (S >> 1), S - 3, 1, hex(col.b));
    if (td.pattern === 'sky' && S >= 4 && ((x + y) & 3) === 0) R.fill(M + x * S + 1, M + y * S + (S >> 1), S - 2, 1, hex(col.b));   // sky void: cloud streaks
  }
  // grid + coordinates
  for (let x = 0; x <= w; x += 10) { for (let y = 0; y < h * S; y += 2) R.px(M + x * S, M + y, [255, 255, 255], 0.25); R.text(String(x), M + x * S + 1, 4, [200, 200, 210], 1, null); R.text(String(x), M + x * S + 1, M + h * S + 6, [200, 200, 210], 1, null); }
  for (let y = 0; y <= h; y += 10) { for (let x = 0; x < w * S; x += 2) R.px(M + x, M + y * S, [255, 255, 255], 0.25); R.text(String(y), 2, M + y * S + 1, [200, 200, 210], 1, null); R.text(String(y), M + w * S + 3, M + y * S + 1, [200, 200, 210], 1, null); }
  // props: footless first, then by y
  const props = z.props.filter((p) => deco || !p.deco).slice().sort((a, b) => (a.def && a.def.footprint ? 1 : 0) - (b.def && b.def.footprint ? 1 : 0) || a.y - b.y);
  for (const p of props) {
    const c = propColor(p);
    const px = M + p.x * S, py = M + p.y * S;
    if (!p.def || !p.def.footprint) {
      const r = Math.max(1, (S / 4) | 0);
      R.disc(px + (S >> 1), py + (S >> 1), r, c);
      continue;
    }
    if (p.model === 'rug' || (!p.solid && p.model !== 'bridge' && p.model !== 'gate_arch' && p.model !== 'hedge_arch')) { R.fill(px, py, p.w * S, p.h * S, c, 0.6); continue; }
    if (p.model === 'bridge') { R.fill(px, py, p.w * S, p.h * S, [201, 140, 80], 0.85); R.rect(px, py, p.w * S, p.h * S, [110, 70, 40]); continue; }
    if (p.model === 'gate_arch' || p.model === 'hedge_arch') {
      R.fill(px, py, S, p.h * S, c); R.fill(px + (p.w - 1) * S, py, S, p.h * S, c);
      R.fill(px, py, p.w * S, Math.max(2, S >> 2), c);
      continue;
    }
    const round = ['tree', 'pine', 'bush', 'rock', 'mushroom_big', 'stump', 'crystal', 'palm', 'cactus', 'coral', 'snow_pine', 'ice_spire',
      'snowman', 'pottery', 'star_lamp'].includes(p.model);
    if (round && p.w === 1 && p.h === 1) {
      R.disc(px + (S >> 1), py + (S >> 1), Math.max(2, (S / 2 - 0.5) | 0), mixc(c, [0, 0, 0], 0.15));
      R.disc(px + (S >> 1) - 1, py + (S >> 1) - 1, Math.max(1, (S / 3) | 0), c);
      continue;
    }
    R.fill(px, py, p.w * S, p.h * S, c);
    R.rect(px, py, p.w * S, p.h * S, mixc(c, [0, 0, 0], 0.5));
    if (['house', 'shop', 'tower', 'academy', 'lighthouse', 'igloo'].includes(p.model)) {
      const wall = hex(p.def.look.wall || p.def.look.ice || '#ffffff');
      R.fill(px + 1, py + (p.h - 1) * S, p.w * S - 2, S - 1, wall);
      const dx = p.def.door !== undefined ? p.def.door : (p.w >> 1);
      R.fill(px + dx * S + 1, py + (p.h - 1) * S + 1, S - 2, S - 1, hex(p.def.look.door || '#34558e'));
    }
    if (S >= 6 && p.w * S >= 8) R.text(GLYPH[p.model] || '?', px + 2, py + 2, [255, 255, 255], 1);
  }
  const markers = z.markers;
  const lab = (s, x, y, c) => { if (labels) R.text(s, x, y, c, 1); };
  // furniture rectangles
  const box = (r, c, label, dash = 0) => {
    if (!r) return;
    R.rect(M + r[0] * S, M + r[1] * S, r[2] * S, r[3] * S, c, 2, dash);
    if (label) lab(label, M + r[0] * S + 3, M + r[1] * S + 3, c);
  };
  for (const s of def.spawns || []) box(s.area || furnitureRect(s, markers), [255, 80, 80], `${s.kind} x${s.n} l${s.level || ''}`, 0);
  for (const t of def.triggers || []) box(t.area || furnitureRect(t, markers), [255, 160, 40], 'trig ' + t.id, 4);
  for (const e of def.exits || []) box(furnitureRect(e, markers), [80, 170, 255], '> ' + e.to + (e.if ? '?' : ''), 0);
  for (const g of def.gates || []) box(furnitureRect(g, markers), [255, 80, 255], 'gate ' + g.id, 0);
  for (const c of def.chests || []) { const m = markers[c.at]; if (m) { R.fill(M + m[0] * S + 1, M + m[1] * S + 1, S - 2, S - 2, c.rune ? [160, 220, 255] : [255, 210, 74]); R.rect(M + m[0] * S, M + m[1] * S, S, S, [90, 60, 20]); } }
  // prop interacts
  for (const p of z.props) if (p.interact) {
    const at = p.interact.at || (p.def && p.def.door !== undefined ? [p.x + p.def.door, p.y + p.h] : null);
    if (at) { R.rect(M + at[0] * S + 1, M + at[1] * S + 1, S - 2, S - 2, [255, 255, 255], 1); }
  }
  // markers
  for (const [name, m] of Object.entries(markers)) {
    if (!Array.isArray(m)) continue;
    const cx = M + m[0] * S + (S >> 1), cy = M + m[1] * S + (S >> 1);
    R.disc(cx, cy, Math.max(2, (S / 3) | 0), [20, 20, 28]);
    R.disc(cx, cy, Math.max(1, (S / 3) | 0) - 1, [255, 255, 120]);
    lab(name, cx + 4, cy - 2, [255, 255, 160]);
  }
  R.text(`${def.id}  ${def.name || ''}  ${w}x${h}`, M, M + h * S + 12 > R.h - 6 ? R.h - 6 : M + h * S + 12, [255, 255, 255], 1);
  if (crop) {
    const cx = Math.max(0, crop[0] * S), cy = Math.max(0, crop[1] * S);
    const cw = Math.min(R.w - cx, crop[2] * S + M * 2), chh = Math.min(R.h - cy, crop[3] * S + M * 2);
    const out = Buffer.alloc(cw * chh * 3);
    for (let y = 0; y < chh; y++) R.buf.copy(out, y * cw * 3, ((cy + y) * R.w + cx) * 3, ((cy + y) * R.w + cx + cw) * 3);
    return { png: encodePNG(cw, chh, out), w: cw, h: chh, zone: z };
  }
  return { png: encodePNG(R.w, R.h, R.buf), w: R.w, h: R.h, zone: z };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
  const id = args[0];
  if (!id) { console.error('usage: node tools/map-preview.mjs <zoneId> [out.png] [scale] [--no-labels] [--no-deco]'); process.exit(2); }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const out = args[1] || path.join(root, 'tests/e2e/out', `map-${id}.png`);
  const scale = +(args[2] || 8);
  const cropArg = flags.find((f) => f.startsWith('--crop='));
  const crop = cropArg ? cropArg.slice(7).split(',').map(Number) : null;
  const r = renderZone(id, { scale, labels: !flags.includes('--no-labels'), deco: !flags.includes('--no-deco'), crop });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, r.png);
  console.log(`${out} ${r.w}x${r.h}`);
}
