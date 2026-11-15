// The closed icon set of CONTRACTS section 9, as crisp procedural 16x16 pixel icons with a dark outline and a
// top-left highlight. Built once per icon (pure grid code), cached as a canvas, then copied wherever needed.
//
// buildIcon(name) -> 16 rows of '#hex' | null   (pure; unknown names fall back to a '?' badge)
// drawIcon(canvas, name, size = 16)             (draws into an existing canvas; the canvas backing is size x size)
// iconCanvas(name, cls) -> <canvas>             (16x16 backing; CSS scales it with pixelated rendering)
// ICON_NAMES                                    (the closed list)
import { ICONS } from '../contracts.js';
import { blitGrid } from './pixelart.js';

export const ICON_NAMES = ICONS;
const OUT = '#1e1a22';
const N = 16;

// palette
const C = {
  steel: '#dfe6ee', steelSh: '#9aa7b5', steelHi: '#ffffff', gold: '#ffd24a', goldSh: '#d39a24', wood: '#9a6a3a', woodSh: '#6b4423',
  red: '#e2503c', redSh: '#a8322a', redHi: '#ff8f7a', blue: '#4d8dff', blueSh: '#2d5fc4', blueHi: '#9cc4ff',
  violet: '#9b6bff', violetSh: '#6a3fd0', cyan: '#5fe3ff', cyanSh: '#2aa8d0', green: '#58d68d', greenSh: '#2f9e5a', greenHi: '#a8f0c0',
  orange: '#ff8a2a', yellow: '#ffe14d', white: '#ffffff', gray: '#b7bcc8', graySh: '#7d8394', dark: '#3a3448', darkHi: '#5a5070',
  skin: '#f0b48a', skinSh: '#c98a62', brown: '#c98c50', brownSh: '#8f5a2b', teal: '#3fe0c5', tealSh: '#1f9e8a', pink: '#ff7ab8',
  parch: '#f4e2bd', parchSh: '#d9bf8a',
};

function grid() {
  const g = [];
  for (let y = 0; y < N; y++) g.push(new Array(N).fill(null));
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  };
  const disc = (cx, cy, r, c, c2) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d <= r * r) px(x, y, c2 && x + 0.5 - cx + (y + 0.5 - cy) > r * 0.45 ? c2 : c);
    }
  };
  const ring = (cx, cy, r, w, c) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
      if (d <= r && d > r - w) px(x, y, c);
    }
  };
  const poly = (pts, c) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const X = x + 0.5, Y = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) px(x, y, c);
    }
  };
  return { g, px, rect, line, disc, ring, poly };
}

const ART = {
  sword({ line, px }) {
    line(5, 10, 13, 2, C.steel); line(6, 10, 13, 3, C.steelSh); line(5, 9, 12, 2, C.steelHi);
    px(13, 2, C.steelHi);
    line(3, 8, 7, 12, C.gold); line(4, 8, 8, 12, C.goldSh);
    line(2, 13, 4, 11, C.wood); px(3, 13, C.woodSh);
    px(1, 14, C.gold); px(2, 14, C.goldSh);
  },
  axe({ line, poly, px }) {
    line(3, 14, 10, 3, C.wood); line(4, 14, 11, 3, C.woodSh);
    poly([[8, 2], [11, 1], [14, 2], [15.5, 5], [15.5, 10], [13, 10.5], [11, 7], [9, 5]], C.steel);
    line(15, 5, 15, 9, C.steelHi); line(12, 2, 14, 3, C.steelHi);
    line(11, 7, 13, 10, C.steelSh);
    poly([[5, 4], [9, 2.5], [9.5, 6]], C.steelSh);
  },
  shield({ poly, line, rect }) {
    poly([[2, 2], [14, 2], [14, 8], [8, 15], [2, 8]], C.gold);
    poly([[3.5, 3.5], [12.5, 3.5], [12.5, 8], [8, 13.3], [3.5, 8]], C.blue);
    poly([[8, 3.5], [12.5, 3.5], [12.5, 8], [8, 13.3]], C.blueSh);
    rect(7, 4, 2, 8, C.gold); rect(5, 6, 6, 2, C.gold);
    line(3, 3, 7, 3, C.yellow);
  },
  dash({ line, poly }) {
    line(1, 5, 6, 5, C.cyan); line(0, 8, 7, 8, C.white); line(1, 11, 6, 11, C.cyan);
    poly([[7, 3], [11, 3], [15, 8], [11, 13], [7, 13], [11, 8]], C.blue);
    poly([[7, 3], [11, 3], [15, 8], [13, 8]], C.blueHi);
  },
  roar({ poly, disc, rect, px }) {
    poly([[8, 0], [10, 4], [15, 3], [12, 7], [15, 12], [10, 11], [8, 15], [6, 11], [1, 12], [4, 7], [1, 3], [6, 4]], C.orange);
    disc(8, 8, 4.2, C.redSh);
    rect(6, 6, 5, 1, C.white); rect(6, 10, 5, 1, C.white);
    px(6, 7, C.white); px(10, 7, C.white); px(8, 9, C.redHi);
  },
  bolt({ poly, line }) {
    poly([[9, 0], [3, 9], [7, 9], [5, 16], [13, 6], [9, 6], [11, 0]], C.yellow);
    line(9, 1, 5, 8, C.white);
    poly([[11, 6], [13, 6], [6, 15]], C.goldSh);
  },
  blink({ poly, px, disc }) {
    poly([[8, 1], [9.5, 6.5], [15, 8], [9.5, 9.5], [8, 15], [6.5, 9.5], [1, 8], [6.5, 6.5]], C.violet);
    poly([[8, 3], [9, 7], [13, 8], [9, 9], [8, 13], [7, 9], [3, 8], [7, 7]], C.cyan);
    disc(8, 8, 1.6, C.white);
    px(2, 2, C.cyan); px(13, 13, C.violet); px(13, 2, C.white); px(2, 13, C.white);
  },
  nova({ ring, disc, px }) {
    ring(8, 8, 7.5, 2, C.violet); ring(8, 8, 5.5, 1, C.cyan);
    disc(8, 8, 3, C.white, C.cyan);
    for (const [x, y] of [[8, 0], [15, 8], [8, 15], [0, 8]]) px(x, y, C.cyan);
  },
  fire({ poly }) {
    poly([[8, 0], [12, 5], [13, 2], [15, 8], [13, 14], [8, 16], [3, 14], [1, 8], [3, 4], [5, 7]], C.red);
    poly([[8, 4], [11, 8], [12, 6], [12, 11], [8, 15], [4, 11], [5, 8], [6, 9]], C.orange);
    poly([[8, 8], [10, 11], [9, 14], [7, 14], [6, 11]], C.yellow);
  },
  frost({ line, px, disc }) {
    const arms = [[8, 1, 8, 15], [2, 4.5, 14, 11.5], [2, 11.5, 14, 4.5]];
    for (const [a, b, c, d] of arms) line(a, b, c, d, C.cyan);
    for (const [x, y] of [[7, 2], [9, 2], [7, 13], [9, 13], [3, 6], [4, 4], [12, 4], [13, 6], [3, 10], [4, 12], [12, 12], [13, 10]]) px(x, y, C.blueHi);
    disc(8, 8, 2.2, C.white);
  },
  storm({ disc, poly, rect }) {
    disc(5, 6, 3.4, C.gray); disc(10, 5, 4, C.gray); disc(12, 8, 2.8, C.graySh);
    rect(3, 7, 11, 3, C.gray); rect(3, 9, 11, 1, C.graySh);
    disc(9, 3.8, 1.8, C.white);
    poly([[8, 9], [5, 13], [7.5, 13], [6, 16], [11, 11], [8.5, 11], [10, 9]], C.yellow);
  },
  meteor({ poly, disc, px }) {
    poly([[0, 1], [6, 5], [10, 6], [6, 10], [5, 6]], C.orange);
    poly([[3, 0], [8, 4], [11, 5], [4, 2]], C.yellow);
    poly([[0, 4], [5, 7], [6, 11], [1, 6]], C.red);
    disc(10.5, 10.5, 4.3, C.brown, C.brownSh);
    px(9, 9, '#e8b080'); px(12, 12, C.woodSh); px(11, 9, C.woodSh);
  },
  summon({ poly, disc, rect, px }) {
    disc(8, 7, 5.5, C.teal);
    rect(2.5, 7, 11, 6, C.teal);
    poly([[2.5, 12], [5, 15], [6.5, 12], [8, 15], [9.5, 12], [11, 15], [13.5, 12]], C.teal);
    poly([[10, 3], [13.5, 7], [13.5, 12], [11, 15], [9.5, 12]], C.tealSh);
    rect(5, 6, 2, 3, OUT); rect(9, 6, 2, 3, OUT); px(5, 6, C.white); px(9, 6, C.white);
    px(3, 3, C.greenHi); px(14, 2, C.greenHi);
  },
  fist({ rect, px, line }) {
    rect(3, 4, 10, 8, C.skin); rect(4, 12, 7, 3, C.skin);
    for (const x of [5, 8, 11]) line(x, 4, x, 7, C.skinSh);
    rect(3, 8, 3, 2, C.skinSh);
    line(4, 3, 12, 3, C.skin); line(4, 4, 7, 4, '#ffd4b4');
    rect(4, 14, 7, 2, C.gold); px(12, 11, C.skinSh);
  },
  kick({ poly, rect, line }) {
    poly([[2, 1], [7, 1], [8, 8], [14, 9], [15, 13], [2, 13]], C.brown);
    poly([[7, 1], [8, 8], [14, 9], [15, 13], [9, 13]], C.brownSh);
    rect(2, 13, 14, 2, C.dark);
    line(2, 4, 7, 4, C.gold); line(3, 2, 6, 2, '#e8b080');
  },
  orb({ disc, rect, px }) {
    disc(8, 7, 6, C.teal, C.tealSh);
    disc(6, 5, 2, C.greenHi);
    px(5, 4, C.white);
    rect(4, 13, 8, 2, C.gold); rect(5, 12, 6, 1, C.goldSh);
  },
  bow({ line, px }) {
    for (let y = 1; y <= 14; y++) { const x = 3 + Math.round(4 * Math.sin((Math.PI * (y - 1)) / 13)); px(x, y, C.wood); px(x + 1, y, C.woodSh); }
    line(3, 1, 3, 14, C.white);
    line(1, 8, 13, 8, C.wood); px(14, 8, C.steel); px(13, 7, C.steel); px(13, 9, C.steel);
    px(1, 7, C.red); px(1, 9, C.red); px(2, 7, C.red); px(2, 9, C.red);
  },
  rain({ line, px, rect }) {
    for (const [x, y] of [[3, 1], [8, 4], [13, 0]]) {
      line(x, y + 2, x, y + 7, C.wood);
      px(x - 1, y + 1, C.green); px(x + 1, y + 1, C.green); px(x - 1, y + 2, C.greenSh); px(x + 1, y + 2, C.greenSh);
      rect(x - 1, y + 8, 3, 1, C.steel); px(x, y + 9, C.steelHi);
    }
    line(1, 15, 14, 15, C.greenSh);
  },
  dagger({ poly, line, rect, px }) {
    poly([[9, 1], [12, 1], [12, 3], [6, 9], [4, 9], [4, 7]], C.steel);
    line(5, 8, 11, 2, C.steelHi); line(7, 8, 12, 3, C.steelSh);
    line(2, 7, 6, 11, C.gold);
    line(2, 12, 4, 10, C.green); line(1, 13, 3, 11, C.greenSh);
    px(1, 14, C.gold); rect(0, 15, 0, 0, C.gold);
  },
  knives({ line, px }) {
    const k = (x0, y0, x1, y1) => {
      const mx = x0 + (x1 - x0) * 0.35, my = y0 + (y1 - y0) * 0.35;
      line(x0, y0, mx, my, C.wood);
      line(mx, my, x1, y1, C.steel); line(mx + 1, my, x1 + 1, y1, C.steelSh);
      px(x1, y1, C.steelHi);
    };
    k(7, 15, 2, 4); k(8, 15, 7.5, 1); k(9, 15, 13, 4);
    line(5, 11, 11, 11, C.gold);
  },
  roll({ ring, poly, px }) {
    ring(8, 8, 7, 2, C.green);
    ring(8, 8, 5, 1, C.greenSh);
    poly([[0, 5], [6, 5], [3, 10]], C.white);
    px(11, 2, C.greenHi); px(12, 3, C.greenHi);
  },
  smoke({ disc }) {
    disc(5, 10, 3.6, C.gray, C.graySh); disc(11, 10, 3.4, C.gray, C.graySh); disc(8, 6, 4.2, '#d8dce6', C.gray);
    disc(7, 5, 1.5, C.white); disc(12, 3, 1.2, '#d8dce6'); disc(3, 4, 1, '#d8dce6');
  },
  shadow({ disc, poly, rect, px }) {
    disc(8, 5, 3.5, C.dark);
    poly([[3, 15], [4, 10], [8, 8], [12, 10], [13, 15]], C.dark);
    poly([[1, 14], [3, 10], [3, 15]], C.violetSh); poly([[15, 14], [13, 10], [13, 15]], C.violetSh);
    rect(6, 5, 1, 1, C.violet); rect(9, 5, 1, 1, C.violet);
    px(7, 3, C.darkHi);
  },
  shuriken({ poly, disc }) {
    poly([[8, 0], [10, 6], [16, 8], [10, 10], [8, 16], [6, 10], [0, 8], [6, 6]], C.steel);
    poly([[8, 0], [10, 6], [8, 8]], C.steelHi); poly([[16, 8], [10, 10], [8, 8]], C.steelSh);
    poly([[8, 16], [6, 10], [8, 8]], C.steelSh); poly([[0, 8], [6, 6], [8, 8]], C.steelHi);
    disc(8, 8, 1.4, OUT);
  },
  coin({ disc, rect, px }) {
    disc(8, 8, 6.5, C.gold, C.goldSh);
    disc(8, 8, 4.5, C.yellow); rect(7, 5, 2, 6, C.goldSh); rect(6, 6, 1, 1, C.goldSh); rect(9, 9, 1, 1, C.goldSh);
    px(5, 4, C.white); px(4, 5, C.white);
  },
  potion({ disc, rect, px }) {
    disc(8, 10, 5.5, C.red, C.redSh);
    rect(6, 2, 4, 4, '#cfe8ff'); rect(5, 1, 6, 2, C.wood);
    rect(3, 9, 10, 1, C.redHi);
    px(5, 8, C.white); px(5, 7, C.white); px(6, 8, '#ffd4cc');
  },
  bread({ poly, line, disc }) {
    disc(8, 9, 6.5, C.brown, C.brownSh);
    poly([[1, 9], [15, 9], [15, 13], [1, 13]], C.brownSh);
    disc(8, 8, 5.5, '#e8a860');
    for (const x of [5, 8, 11]) line(x - 1, 6, x + 1, 9, '#fff0c8');
  },
  bomb({ disc, line, px }) {
    disc(7, 10, 5.5, C.dark, OUT);
    disc(5, 8, 1.6, C.darkHi);
    line(10, 5, 12, 3, C.wood);
    px(13, 2, C.yellow); px(14, 1, C.orange); px(12, 1, C.orange); px(14, 3, C.orange); px(13, 0, C.yellow);
  },
  tonic({ rect, px, line }) {
    rect(5, 5, 6, 10, C.green); rect(9, 5, 2, 10, C.greenSh);
    rect(6, 2, 4, 3, '#cfe8ff'); rect(6, 1, 4, 1, C.wood);
    rect(5, 9, 6, 3, C.parch); line(6, 10, 9, 10, C.redSh);
    px(6, 6, C.greenHi); px(6, 7, C.greenHi);
  },
  charm({ line, poly, px }) {
    line(3, 1, 8, 6, C.gold); line(13, 1, 8, 6, C.gold);
    poly([[8, 5], [13, 9], [8, 15], [3, 9]], C.blue);
    poly([[8, 5], [13, 9], [8, 15]], C.blueSh);
    px(7, 8, C.white); px(6, 9, C.blueHi);
  },
  star({ poly, px }) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 3.2 : 7.6; pts.push([8 + r * Math.cos(a), 8.6 + r * Math.sin(a)]); }
    poly(pts, C.yellow);
    poly([pts[0], pts[1], [8, 8.6]], C.white);
    poly([pts[4], pts[5], pts[6], [8, 8.6]], C.goldSh);
    px(8, 8, C.gold);
  },
  heart({ disc, poly, px }) {
    disc(5, 6, 3.6, C.red); disc(11, 6, 3.6, C.red);
    poly([[1.6, 7], [14.4, 7], [8, 14.5]], C.red);
    poly([[8, 7], [14.4, 7], [8, 14.5]], C.redSh);
    disc(11, 6, 3.6, C.redSh); disc(10.5, 5.5, 2.6, C.red);
    px(4, 4, C.white); px(4, 5, C.redHi); px(5, 4, C.redHi);
  },
  book({ rect, line, px }) {
    rect(2, 2, 11, 12, C.violet); rect(2, 2, 2, 12, C.violetSh);
    rect(4, 13, 10, 2, C.parch); line(13, 3, 13, 14, C.parchSh);
    rect(6, 5, 5, 3, C.gold); px(8, 6, C.violetSh);
    line(5, 11, 11, 11, C.violetSh);
  },
  hat({ poly, rect, px }) {
    poly([[8, 0], [12, 11], [4, 11]], C.violet);
    poly([[8, 0], [12, 11], [9, 11]], C.violetSh);
    rect(1, 11, 14, 2, C.violet); rect(1, 12, 14, 1, C.violetSh);
    rect(5, 9, 6, 2, C.gold);
    px(7, 5, C.yellow); px(9, 7, C.white);
  },
  cloak({ poly, rect, px }) {
    poly([[5, 1], [11, 1], [13, 6], [15, 15], [1, 15], [3, 6]], C.teal);
    poly([[8, 4], [11, 1], [13, 6], [15, 15], [9, 15]], C.tealSh);
    poly([[6, 3], [10, 3], [10, 7], [6, 7]], C.dark);
    rect(7, 8, 2, 2, C.gold); px(5, 2, C.greenHi);
  },
  key({ ring, rect, px }) {
    ring(4.5, 5.5, 3.8, 1.8, C.gold);
    rect(7, 5, 8, 2, C.gold); rect(7, 6, 8, 1, C.goldSh);
    rect(12, 7, 1, 3, C.gold); rect(14, 7, 1, 2, C.gold);
    px(2, 3, C.white);
  },
  rune({ poly, line, px }) {
    poly([[3, 1], [13, 1], [14, 14], [2, 14]], C.gray);
    poly([[8, 1], [13, 1], [14, 14], [8, 14]], C.graySh);
    line(8, 3, 8, 12, C.cyan); line(5, 5, 8, 8, C.cyan); line(11, 5, 8, 8, C.cyan); line(5, 12, 11, 12, C.cyan);
    px(4, 2, '#e4e7ee');
  },
  lock({ ring, rect, px }) {
    ring(8, 7, 4.6, 1.8, C.steelSh);
    rect(2, 7, 12, 8, C.gold); rect(2, 13, 12, 2, C.goldSh); rect(11, 7, 3, 8, C.goldSh);
    rect(7, 9, 2, 3, OUT); px(3, 8, C.yellow);
  },
  up({ poly, rect }) {
    poly([[8, 0], [15, 7], [11, 7], [11, 15], [5, 15], [5, 7], [1, 7]], C.green);
    poly([[8, 0], [15, 7], [11, 7], [11, 15], [8, 15]], C.greenSh);
    rect(6, 7, 1, 6, C.greenHi);
  },
  _unknown({ disc, rect, px }) {
    disc(8, 8, 7, C.parch, C.parchSh);
    rect(6, 4, 4, 1, C.brownSh); rect(10, 5, 1, 2, C.brownSh); rect(8, 7, 2, 1, C.brownSh); rect(8, 8, 1, 2, C.brownSh);
    px(8, 11, C.brownSh);
  },
};

/** Outline: every empty pixel 8-adjacent... (4-adjacent keeps the chunky look) to a filled pixel becomes OUT. */
function outline(g) {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x]) continue;
    if ((x > 0 && g[y][x - 1]) || (x < N - 1 && g[y][x + 1]) || (y > 0 && g[y - 1][x]) || (y < N - 1 && g[y + 1][x])) out[y][x] = OUT;
  }
  return out;
}

const gridCache = new Map();

/** 16x16 grid for an icon (cached). Unknown names give a '?' badge. */
export function buildIcon(name) {
  const key = ART[name] ? name : '_unknown';
  let g = gridCache.get(key);
  if (!g) {
    const G = grid();
    ART[key](G);
    g = outline(G.g);
    gridCache.set(key, g);
  }
  return g;
}

export function hasIcon(name) { return !!ART[name] && name !== '_unknown'; }

const canvasCache = new Map();
function sourceCanvas(name) {
  const key = ART[name] ? name : '_unknown';
  let c = canvasCache.get(key);
  if (!c) { c = document.createElement('canvas'); blitGrid(c, buildIcon(key)); canvasCache.set(key, c); }
  return c;
}

/** Draw an icon into a canvas. `size` sets the backing resolution (multiples of 16 stay crisp). */
export function drawIcon(canvas, icon, size = 16) {
  if (!canvas) return canvas;
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(sourceCanvas(icon), 0, 0, size, size);
  canvas.__icon = icon;
  return canvas;
}

/** Set a canvas' icon only when it changed. */
export function setIcon(canvas, icon) { if (canvas.__icon !== icon) drawIcon(canvas, icon, 16); }

/** New icon canvas element (16x16 backing, class 'icon pixel'). */
export function iconCanvas(icon, cls) {
  const c = document.createElement('canvas');
  c.className = 'icon pixel' + (cls ? ' ' + cls : '');
  if (icon) drawIcon(c, icon, 16); else { c.width = 16; c.height = 16; }
  return c;
}

export default drawIcon;
