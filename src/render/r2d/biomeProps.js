// Round 3 biome prop sprites (docs/BIOMES.md) for the 2D fallback: same conventions as props.js (3/4 view, art px,
// (0, 0) = top-left of the footprint, negative y = above it, auto-outlined by the caller).
import { dark, light, mix, col } from './color.js';

function tools(ctx) {
  const { p, ox, oy } = ctx;
  const R = (x, y, w, h, c) => p.rect(ox + Math.round(x), oy + Math.round(y), Math.round(w), Math.round(h), c);
  const S = (x, y, c) => p.set(ox + Math.round(x), oy + Math.round(y), c);
  const E = (cx, cy, rx, ry, c) => p.ellipse(ox + cx, oy + cy, rx, ry, c);
  const SH = (cx, cy, rx, ry, c, lo, hi) => p.shaded(ox + cx, oy + cy, rx, ry, c, lo, hi);
  const PL = (pts, c) => p.poly(pts.map((v, i) => v + (i % 2 ? oy : ox)), c);
  const LN = (x0, y0, x1, y1, c) => p.line(ox + Math.round(x0), oy + Math.round(y0), ox + Math.round(x1), oy + Math.round(y1), c);
  const TH = (x0, y0, x1, y1, t, c) => p.thick(ox + Math.round(x0), oy + Math.round(y0), ox + Math.round(x1), oy + Math.round(y1), t, c);
  return { R, S, E, SH, PL, LN, TH };
}
const shadow = (ctx, x, y, rx, ry) => { ctx.shadow = { x, y, rx, ry }; };
const V = (ctx) => (ctx.L.variant | 0);

export const BIOME_PAINTERS = {
  palm(ctx) {
    const { R, S, SH, PL, TH } = tools(ctx);
    const trunk = col(ctx.L.trunk, '#b08050'), leaves = col(ctx.L.leaves, '#3fbf6a'), nuts = col(ctx.L.nuts, '#7a4e2c');
    const v = V(ctx), lean = v === 2 ? 1 : ((ctx.v >> 2) & 1 ? 0.35 : -0.35), tall = v === 1 ? 6 : 0;
    shadow(ctx, 8, 14, 8, 3);
    // segmented curving trunk
    let x = 7, y = 14;
    const n = 8 + (tall ? 2 : 0);
    for (let i = 0; i < n; i++) {
      const nx = x + lean * (0.4 + i * 0.12), ny = y - 3.6;
      TH(x, y, nx, ny, 3, i % 2 ? trunk : dark(trunk, 0.12));
      S(nx + 1, ny + 1, dark(trunk, 0.35));
      x = nx; y = ny;
    }
    const lo = dark(leaves, 0.3), hi = light(leaves, 0.25);
    // fronds: drooping leaf blades
    const fr = [[-13, -2], [-10, 6], [-3, 9], [5, 9], [12, 6], [14, -2], [0, -6]];
    for (const [dx, dy] of fr) {
      PL([x, y - 2, x + dx * 0.55, y + dy * 0.4 - 4, x + dx, y + dy, x + dx * 0.5, y + dy * 0.5 - 1], leaves);
      TH(x, y - 1, x + dx * 0.9, y + dy * 0.9, 1, lo);
      S(x + dx * 0.4, y + dy * 0.3 - 3, hi);
    }
    SH(x, y - 1, 3, 2.5, leaves, lo, hi);
    for (const [dx, dy] of [[-2, 2], [1, 3], [3, 1]]) { R(x + dx, y + dy, 2, 2, nuts); S(x + dx, y + dy, light(nuts, 0.3)); }
  },
  cactus(ctx) {
    const { R, S, SH, E } = tools(ctx);
    const body = col(ctx.L.body, '#4caf5a'), fl = col(ctx.L.flower, '#ff7aa8');
    const lo = dark(body, 0.28), hi = light(body, 0.22), v = V(ctx);
    shadow(ctx, 8, 14, 7, 2.5);
    if (v === 1) {
      SH(8, 9, 6, 6, body, lo, hi);
      for (const x of [5, 8, 11]) R(x, 4, 1, 10, lo);
      E(8, 3, 2.5, 1.5, fl); S(8, 3, '#ffe066');
      for (const [x, y] of [[4, 7], [12, 8], [6, 12], [10, 5]]) S(x, y, '#fffbe6');
      return;
    }
    if (v === 2) {
      SH(8, 10, 5, 4.5, body, lo, hi); SH(4, 3, 3.5, 3.5, body, lo, hi); SH(12, 2, 3.5, 4, body, lo, hi); SH(8, -3, 3, 3, body, lo, hi);
      for (const [x, y] of [[2, 0], [14, -2], [8, -6]]) { R(x, y, 2, 2, fl); S(x, y, light(fl, 0.4)); }
      for (const [x, y] of [[6, 9], [10, 11], [4, 4], [12, 3]]) S(x, y, '#fffbe6');
      return;
    }
    // saguaro: column with two arms
    R(5, -8, 6, 22, body); R(9, -8, 2, 22, lo); R(5, -8, 1, 22, hi); R(6, -10, 4, 2, body);
    R(1, 0, 4, 3, body); R(1, -6, 3, 7, body); R(1, -6, 1, 7, hi); R(1, -7, 3, 1, light(body, 0.1));
    R(11, 2, 4, 3, body); R(12, -3, 3, 6, body); R(14, -3, 1, 6, lo);
    R(7, -9, 1, 20, lo);
    R(6, -12, 4, 2, fl); S(7, -13, light(fl, 0.4)); S(2, -8, fl); S(13, -4, fl);
    for (const [x, y] of [[6, -4], [9, 1], [6, 6], [9, 9], [2, -2], [13, 0]]) S(x, y, '#fffbe6');
  },
  ruin_pillar(ctx) {
    const { R, S, E, PL } = tools(ctx);
    const stone = col(ctx.L.stone, '#e2c08a'), trim = col(ctx.L.trim, '#c9a26a');
    const lo = dark(stone, 0.25), hi = light(stone, 0.25), v = V(ctx), W = ctx.W;
    if (v === 2) {
      shadow(ctx, W / 2, 13, W / 2 + 1, 3);
      for (let r = 0; r < 4; r++) {
        const y = 10 - r * 6, off = r % 2 ? 4 : 0;
        for (let x = -off; x < W; x += 8) {
          if (r === 3 && ((x / 8) | 0) % 3 === 1) continue;
          if (r >= 2 && x > W / 2 - 8 && x < W / 2 + 2) continue;
          const xx = Math.max(0, x), ww = Math.min(W, x + 7) - xx;
          if (ww <= 0) continue;
          R(xx, y, ww, 5, (x + r) % 16 ? stone : mix(stone, trim, 0.4)); R(xx, y, ww, 1, hi); R(xx, y + 4, ww, 1, lo);
        }
      }
      E(W / 2 - 3, 1, 4, 3, dark(stone, 0.5));
      E(W - 6, 14, 6, 2, mix(stone, '#f4d48a', 0.5));
      return;
    }
    shadow(ctx, 8, 14, 7, 2.5);
    R(1, 11, 14, 4, trim); R(1, 11, 14, 1, light(trim, 0.2));
    const top = v === 1 ? -2 : -20;
    R(3, top, 10, 11 - top, stone); R(3, top, 2, 11 - top, hi); R(11, top, 2, 11 - top, lo);
    for (const x of [6, 9]) R(x, top + 1, 1, 10 - top, dark(stone, 0.12));
    if (v === 1) {
      PL([3, top, 6, top - 3, 8, top - 1, 11, top - 4, 13, top], stone);
      E(13, 13, 3, 2, stone); E(13, 13, 1.5, 1, lo);
    } else {
      R(1, top - 4, 14, 4, trim); R(1, top - 4, 14, 1, light(trim, 0.25)); R(2, top - 1, 12, 1, dark(trim, 0.2));
      S(8, top + 8, lo); S(9, top + 9, lo);
    }
    E(5, 14, 5, 1.5, mix(stone, '#f4d48a', 0.5));
  },
  obelisk(ctx) {
    const { R, S, PL } = tools(ctx);
    const stone = col(ctx.L.stone, '#d8b880'), glyph = col(ctx.L.glyph, '#3fa0c0');
    const lo = dark(stone, 0.25), hi = light(stone, 0.2);
    shadow(ctx, 8, 14, 7, 2.5);
    R(1, 11, 14, 4, dark(stone, 0.12)); R(2, 9, 12, 2, stone);
    PL([4, 9, 12, 9, 10, -30, 6, -30], stone);
    PL([10, 9, 12, 9, 10, -30, 9, -30], lo);
    PL([4, 9, 5, 9, 7, -30, 6, -30], hi);
    PL([6, -30, 10, -30, 8, -36], V(ctx) === 1 ? glyph : mix(stone, '#ffd24a', 0.6));
    for (let i = 0; i < 5; i++) { const y = -24 + i * 6; R(7, y, 2, 1, glyph); S(8, y + 2, glyph); S(7 + (i % 2), y + 3, light(glyph, 0.3)); }
    ctx.emit.push({ kind: 'glow', x: 8, y: -12, color: glyph, r: 1.2 });
  },
  pottery(ctx) {
    const { R, S, SH, E } = tools(ctx);
    const clay = col(ctx.L.clay, '#d0784a'), paint = col(ctx.L.paint, '#3f8fb0');
    const lo = dark(clay, 0.3), hi = light(clay, 0.25), v = V(ctx);
    shadow(ctx, 8, 14, 7, 2.5);
    const pot = (cx, cy, r, h) => {
      SH(cx, cy, r, h, clay, lo, hi);
      R(cx - r + 1, cy - 1, r * 2 - 1, 2, paint); R(cx - r + 2, cy - 1, r * 2 - 3, 1, light(paint, 0.3));
      E(cx, cy - h + 1, r * 0.55, 1.2, dark(clay, 0.5)); R(cx - r * 0.55, cy - h, r * 1.1, 1, hi);
    };
    if (v === 1) {
      pot(8, 6, 5, 7); R(6, -3, 4, 3, clay); R(5, -4, 6, 1, hi);
      S(2, 2, lo); S(2, 3, lo); S(14, 2, lo); S(14, 3, lo);
      return;
    }
    if (v === 2) { pot(5, 10, 4, 4); pot(11, 9, 4, 5); pot(8, 3, 3, 4); return; }
    pot(7, 9, 5, 5); pot(13, 11, 2.5, 3);
  },
  dune(ctx) {
    const { E, R } = tools(ctx);
    const sand = col(ctx.L.sand, '#f0d090'), shade = col(ctx.L.shade, '#d8b070');
    const big = V(ctx) === 1;
    E(8, 9, big ? 11 : 8, big ? 4.5 : 3.5, mix(sand, shade, 0.5));
    E(7, 8, big ? 10 : 7, big ? 3.5 : 2.6, light(sand, 0.08));
    for (let i = 0; i < 3; i++) R(2 + i * 4, 7 + (i % 2), 4, 1, mix(sand, shade, 0.7));
  },
  shell(ctx) {
    const { R, S, E, PL } = tools(ctx);
    const sh = col(ctx.L.shell, '#ffd8c8'), inner = col(ctx.L.inner, '#ff9ab0'), v = V(ctx);
    const x = 5 + (ctx.v & 3) * 2, y = 6 + ((ctx.v >> 2) & 3);
    if (v === 2) {
      for (const [dx, dy] of [[0, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]]) { R(x + dx * 0.6, y + dy * 0.6, 2, 2, sh); S(x + dx, y + dy, sh); }
      R(x, y, 2, 2, inner); S(x + 1, y, light(inner, 0.4));
      return;
    }
    if (v === 1) { PL([x - 3, y + 2, x + 4, y - 1, x + 4, y + 3], sh); E(x + 3, y + 1, 1.5, 2, inner); S(x - 1, y + 1, dark(sh, 0.2)); S(x + 1, y + 1, dark(sh, 0.2)); return; }
    E(x, y, 3.5, 2.6, sh); for (let i = -2; i <= 2; i++) S(x + i, y - 1 + Math.abs(i) * 0.4, dark(sh, 0.2)); R(x - 1, y + 2, 3, 1, inner);
  },
  coral(ctx) {
    const { R, S, E, SH, TH } = tools(ctx);
    const body = col(ctx.L.body, '#ff7a8a'), tips = col(ctx.L.tips, '#ffd0a0'), v = V(ctx);
    const lo = dark(body, 0.28), hi = light(body, 0.25);
    shadow(ctx, 8, 14, 7, 2.5);
    E(8, 13, 7, 2.5, '#d8c8a8');
    if (v === 1) { for (const [x, h] of [[4, 8], [8, 12], [12, 9], [6, 5], [10, 6]]) { R(x - 1, 12 - h, 3, h, body); R(x + 1, 12 - h, 1, h, lo); E(x, 12 - h, 2, 1, tips); S(x, 12 - h, dark(body, 0.5)); } return; }
    if (v === 2) { SH(8, 7, 7, 6, body, lo, hi); for (let i = 0; i < 4; i++) R(3 + i * 3, 3 + (i % 2) * 3, 3, 1, lo); S(6, 3, tips); return; }
    if (v === 3) { SH(7, 0, 7, 8, body, lo, hi); for (let i = -2; i <= 2; i++) TH(7, 8, 7 + i * 3, -5 + Math.abs(i) * 2, 1, tips); R(7, 8, 1, 5, lo); return; }
    for (const [x0, x1, y1] of [[8, 8, -5], [8, 3, -1], [8, 13, 0], [5, 2, 4], [11, 14, 5]]) TH(x0, 12, x1, y1, 2, body);
    for (const [x, y] of [[8, -6], [3, -2], [13, -1], [2, 3], [14, 4]]) { E(x, y, 1.5, 1.5, tips); }
    R(7, 0, 1, 11, hi);
  },
  boat(ctx) {
    const { R, S, PL, E, LN } = tools(ctx);
    const hull = col(ctx.L.hull, '#b0743d'), trim = col(ctx.L.trim, '#ffffff'), sail = col(ctx.L.sail, '#f4ecd8');
    const W = ctx.W, H = ctx.H, v = V(ctx), cy = H / 2 + 2;
    shadow(ctx, W / 2, cy + 4, W / 2, 4);
    PL([1, cy - 4, W - 1, cy - 4, W - 6, cy + 5, 6, cy + 5], hull);
    PL([1, cy - 4, W - 1, cy - 4, W - 3, cy - 2, 3, cy - 2], trim);
    R(6, cy + 2, W - 12, 2, dark(hull, 0.3));
    E(W / 2, cy - 5, W / 2 - 3, 3, mix(hull, '#f4e0b8', 0.45));
    for (let x = 6; x < W - 6; x += 5) R(x, cy - 7, 1, 4, mix(hull, '#f4e0b8', 0.2));
    if (v === 2) { LN(4, cy - 9, W - 6, cy - 2, '#d8b07a'); LN(6, cy - 2, W - 4, cy - 9, '#d8b07a'); return; }
    const mx = Math.round(W * 0.55);
    R(mx, cy - 34, 2, 30, dark(hull, 0.3));
    PL([mx + 2, cy - 32, mx + 2, cy - 7, mx + 16, cy - 7], sail);
    PL([mx + 2, cy - 32, mx + 2, cy - 7, mx + 6, cy - 7], light(sail, 0.2));
    LN(mx + 3, cy - 18, mx + 10, cy - 10, dark(sail, 0.12));
    R(mx + 2, cy - 36, 7, 4, v === 1 ? '#ffd24a' : '#d8584a');
    R(8, cy - 11, 9, 6, mix(hull, '#f4e0b8', 0.3)); R(8, cy - 12, 9, 1, dark(hull, 0.2)); S(12, cy - 9, '#bfe6ff');
    E(W - 10, cy - 5, 2, 2, '#ff6b6b');
  },
  tidepool(ctx) {
    const { R, S, E } = tools(ctx);
    const water = col(ctx.L.water, '#4fc8e0'), rim = col(ctx.L.rim, '#c9c0b0');
    const W = ctx.W, H = ctx.H;
    E(W / 2, H / 2, W / 2 - 1, H / 2 - 3, dark(rim, 0.1));
    E(W / 2, H / 2, W / 2 - 4, H / 2 - 6, dark(water, 0.15));
    E(W / 2, H / 2 - 1, W / 2 - 5, H / 2 - 7, water);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; E(W / 2 + Math.cos(a) * (W / 2 - 3), H / 2 + Math.sin(a) * (H / 2 - 5), 2.5, 2, i % 2 ? rim : light(rim, 0.15)); }
    for (const [dx, dy] of [[0, -2], [2, 0], [1, 2], [-1, 2], [-2, 0]]) S(W / 2 + 4 + dx, H / 2 + dy, '#ff8a5a');
    R(W / 2 - 6, H / 2 - 2, 2, 2, '#7a4aa8'); S(W / 2 - 3, H / 2 + 3, '#5fc078'); S(W / 2 - 3, H / 2 + 2, '#5fc078');
    S(W / 2 - 2, H / 2 - 5, '#ffffff'); S(W / 2 - 1, H / 2 - 5, light(water, 0.5));
    ctx.emit.push({ kind: 'ripple', x: W / 2, y: H / 2, color: '#ffffff' });
  },
  lighthouse(ctx) {
    const { R, S, PL, E } = tools(ctx);
    const L = ctx.L, W = ctx.W, H = ctx.H;
    const wall = col(L.wall, '#ffffff'), stripe = col(L.stripe, '#e05050'), roof = col(L.roof, '#3d5aa8'), lightC = col(L.light, '#ffe680');
    shadow(ctx, W / 2, H - 4, W / 2, 5);
    E(W / 2, H - 6, W / 2 - 2, 6, '#b8b4ae'); for (let i = 0; i < 6; i++) E(4 + i * 8, H - 3 - (i % 2) * 2, 4, 3, i % 2 ? '#a8a49e' : '#c4c0b8');
    const top = -44, bot = H - 8, x0b = 10, x1b = W - 10, x0t = 15, x1t = W - 15;
    const bands = 5;
    for (let y = top; y < bot; y++) {
      const t = (y - top) / (bot - top), xa = x0t + (x0b - x0t) * t, xb = x1t + (x1b - x1t) * t;
      const band = Math.floor((1 - t) * bands) % 2;
      const base = band ? stripe : wall;
      for (let x = Math.round(xa); x < Math.round(xb); x++) {
        const u = (x - xa) / (xb - xa);
        R(x, y, 1, 1, u < 0.2 ? light(base, 0.2) : u > 0.75 ? dark(base, 0.22) : base);
      }
    }
    // door and windows
    const dx = (ctx.door != null ? ctx.door : 1) * 16 + 3;
    R(dx + 1, bot - 13, 8, 13, '#5a3a22'); R(dx, bot - 15, 10, 2, dark(roof, 0.1)); S(dx + 7, bot - 6, '#ffd24a');
    for (const y of [-6, -24]) { R(W / 2 - 2, y, 4, 6, dark(roof, 0.2)); R(W / 2 - 1, y + 1, 2, 4, '#bfe6ff'); }
    // gallery, lamp room, roof
    R(x0t - 4, top - 3, x1t - x0t + 8, 3, dark(roof, 0.15)); R(x0t - 4, top - 6, x1t - x0t + 8, 1, '#3a3a4a');
    for (let x = x0t - 4; x <= x1t + 4; x += 3) R(x, top - 6, 1, 3, '#3a3a4a');
    R(x0t + 1, top - 15, x1t - x0t - 2, 9, lightC); R(W / 2 - 2, top - 14, 4, 7, '#ffffff');
    for (const x of [x0t + 1, W / 2 - 4, W / 2 + 3, x1t - 2]) R(x, top - 15, 1, 9, '#3a3a4a');
    PL([x0t - 2, top - 15, x1t + 2, top - 15, W / 2, top - 27], roof); PL([W / 2, top - 27, x1t + 2, top - 15, W / 2 + 3, top - 15], dark(roof, 0.25));
    R(W / 2 - 1, top - 30, 2, 3, '#ffd24a');
    ctx.emit.push({ kind: 'glow', x: W / 2, y: top - 10, color: lightC, r: 3.2 }, { kind: 'twinkle', x: W / 2, y: top - 10, color: '#ffffff' });
  },
  snowman(ctx) {
    const { R, S, SH } = tools(ctx);
    const snow = col(ctx.L.snow, '#ffffff'), scarf = col(ctx.L.scarf, '#e05050'), hat = col(ctx.L.hat, '#3a3a4a');
    const lo = mix(snow, '#9ab4d8', 0.45), hi = '#ffffff', small = V(ctx) === 1;
    shadow(ctx, 8, 14, 7, 2.5);
    SH(8, 9, 6, 5, snow, lo, hi);
    const hy = small ? 1 : -6;
    if (!small) SH(8, 1, 5, 4.5, snow, lo, hi);
    SH(8, hy, 4, 4, snow, lo, hi);
    S(6, hy - 1, '#2a2a34'); S(10, hy - 1, '#2a2a34'); R(8, hy, 3, 1, '#ff8a3c'); S(7, hy + 2, '#2a2a34'); S(9, hy + 2, '#2a2a34');
    R(4, hy + 3, 9, 2, scarf); R(10, hy + 4, 2, 5, scarf);
    if (!small) { S(8, 2, '#2a2a34'); S(8, 5, '#2a2a34'); }
    R(1, hy + 6, 4, 1, '#7a4e2c'); R(0, hy + 4, 1, 2, '#7a4e2c'); R(12, hy + 6, 4, 1, '#7a4e2c'); R(15, hy + 4, 1, 2, '#7a4e2c');
    if (small) { R(5, hy - 5, 7, 3, hat); R(4, hy - 3, 9, 1, '#ffffff'); R(8, hy - 7, 2, 2, '#ffffff'); }
    else { R(4, hy - 4, 9, 1, hat); R(5, hy - 10, 7, 6, hat); R(5, hy - 5, 7, 1, scarf); R(5, hy - 10, 1, 6, light(hat, 0.2)); }
  },
  igloo(ctx) {
    const { R, S, SH, E } = tools(ctx);
    const ice = col(ctx.L.ice, '#e8f6ff'), shade = col(ctx.L.shade, '#b8d8f0');
    const W = ctx.W, H = ctx.H;
    shadow(ctx, W / 2, H - 3, W / 2, 4);
    const cx = W / 2, cy = H - 4, rx = W / 2 - 2, ry = H + 2;
    SH(cx, cy, rx, ry, ice, dark(shade, 0.1), '#ffffff');
    R(1, cy, W - 2, 4, ice);
    for (let r = 1; r < 4; r++) {
      const y = cy - (ry * r) / 4, hw = rx * Math.sqrt(1 - (r / 4) ** 2);
      R(cx - hw + 1, Math.round(y), hw * 2 - 2, 1, shade);
      for (let x = cx - hw + 4 + (r % 2) * 4; x < cx + hw - 2; x += 8) R(x, Math.round(y) + 1, 1, Math.round(ry / 4) - 1, shade);
    }
    const dx = (ctx.door != null ? ctx.door : Math.floor(ctx.w / 2)) * 16 + 8;
    SH(dx, cy + 1, 8, 7, ice, shade, '#ffffff');
    E(dx, cy + 2, 4.5, 5, '#34558e'); R(dx - 4, cy + 2, 9, 3, '#34558e'); R(dx - 3, cy - 2, 2, 2, light('#34558e', 0.15));
    R(dx + 10, cy - 8, 1, 10, '#7a4e2c'); R(dx + 9, cy - 11, 3, 3, '#ffd24a'); S(dx + 10, cy - 12, '#3a3a4a');
    ctx.emit.push({ kind: 'glow', x: dx + 10, y: cy - 10, color: '#ffd24a', r: 1.4 });
  },
  snow_pine(ctx) {
    const { R, PL, S } = tools(ctx);
    const trunk = col(ctx.L.trunk, '#7a4e2c'), leaves = col(ctx.L.leaves, '#2c7f6a'), snow = col(ctx.L.snow, '#ffffff');
    const v = V(ctx), sc = v === 1 ? 0.7 : 1, frost = v === 2;
    const lo = dark(leaves, 0.3), hi = light(leaves, 0.2);
    shadow(ctx, 8, 14, 9 * sc, 3);
    R(6, 6, 4, 9, trunk); R(9, 6, 1, 9, dark(trunk, 0.3));
    for (let i = 0; i < 4; i++) {
      const y = 10 - i * 10 * sc, wv = (11 - i * 2) * sc, hh = 16 * sc;
      PL([8 - wv, y, 8 + wv, y, 8, y - hh], leaves);
      PL([8, y - hh, 8 + wv, y, 8 + 2, y], lo);
      PL([8 - wv, y, 8 - wv + 4, y, 8, y - hh], hi);
      // snow on the upper part of each tier and along its edge
      PL([8 - wv * (frost ? 0.8 : 0.5), y - hh * (frost ? 0.2 : 0.5), 8 + wv * (frost ? 0.8 : 0.5), y - hh * (frost ? 0.2 : 0.5), 8, y - hh], snow);
      R(8 - wv + 1, y - 1, wv * 2 - 2, 1, snow);
      for (let x = -wv + 2; x < wv - 1; x += 3) S(8 + x, y, mix(snow, '#c8dcf0', 0.4));
    }
    S(8, 10 - 30 * sc - 16 * sc, '#ffffff');
  },
  ice_spire(ctx) {
    const { PL, LN, S } = tools(ctx);
    const ice = col(ctx.L.ice, '#bfeaff'), glow = col(ctx.L.glow, '#7fd6ff'), v = V(ctx);
    shadow(ctx, 8, 14, 8, 3);
    const shard = (x, w, hgt, c) => { PL([x - w, 14, x + w, 14, x + 1, 14 - hgt, x - 1, 14 - hgt + 2], c); LN(x - 1, 13, x - 1, 16 - hgt, '#ffffff'); PL([x + 1, 14 - hgt, x + w, 14, x + 1, 14], dark(c, 0.12)); };
    if (v === 1) { shard(3, 3, 10, mix(ice, glow, 0.4)); shard(13, 3, 12, ice); shard(8, 4, 16, ice); shard(10, 2, 7, glow); }
    else { shard(3, 3, 14, mix(ice, glow, 0.4)); shard(13, 3, 18, ice); shard(8, 4, 34, ice); }
    S(7, v === 1 ? 0 : -16, '#ffffff');
    ctx.emit.push({ kind: 'glow', x: 8, y: v === 1 ? 6 : -4, color: glow, r: 1.4 }, { kind: 'twinkle', x: 8, y: -6, color: '#ffffff' });
  },
  cloud_puff(ctx) {
    const { SH } = tools(ctx);
    const cl = col(ctx.L.cloud, '#ffffff'), sh = col(ctx.L.shade, '#dfe8ff');
    SH(4, 10, 4.5, 3.5, cl, sh, '#ffffff'); SH(12, 10, 4.5, 3.5, cl, sh, '#ffffff'); SH(8, 7, 5.5, 4.5, cl, sh, '#ffffff');
  },
  floating_rock(ctx) {
    const { R, S, SH, PL, E } = tools(ctx);
    const rock = col(ctx.L.rock, '#b8a8d8'), grass = col(ctx.L.grass, '#9fe0a0'), crys = col(ctx.L.crystal, '#ffd0f0');
    const W = ctx.W, H = ctx.H, v = V(ctx), cx = W / 2, hov = v === 1 ? 8 : 12;
    ctx.shadow = { x: cx, y: H - 3, rx: W / 2 - 2, ry: 3 };
    const ty = H / 2 - hov, rx = W / 2 - 3;
    PL([cx - rx, ty, cx + rx, ty, cx + 2, ty + rx * 1.3, cx - 2, ty + rx * 1.1], rock);
    PL([cx + 1, ty, cx + rx, ty, cx + 2, ty + rx * 1.3], dark(rock, 0.25));
    PL([cx - rx, ty, cx - rx + 4, ty, cx - 2, ty + rx * 1.1], light(rock, 0.15));
    E(cx, ty, rx + 1, 4, light(rock, 0.1));
    SH(cx, ty - 1, rx - 1, 3.5, grass, dark(grass, 0.25), light(grass, 0.25));
    S(cx - 3, ty - 2, '#ffb8e0'); S(cx + 4, ty - 1, '#fff0a0');
    for (const x of [cx - rx + 2, cx + rx - 3]) R(x, ty + 3, 1, 3, dark(grass, 0.2));
    if (v === 2) { PL([cx - 4, ty - 1, cx - 1, ty - 1, cx - 2, ty - 12], crys); PL([cx + 1, ty, cx + 4, ty, cx + 3, ty - 8], light(crys, 0.2)); ctx.emit.push({ kind: 'twinkle', x: cx, y: ty - 8, color: '#ffffff' }); }
    else if (v !== 1) { SH(cx - 4, ty - 5, 3.5, 3.5, mix(grass, '#4fae6a', 0.5), dark(grass, 0.4), grass); }
  },
  star_lamp(ctx) {
    const { R, S, PL, E } = tools(ctx);
    const metal = col(ctx.L.metal, '#c8a0ff'), star = col(ctx.L.star, '#fff2a0');
    shadow(ctx, 8, 14, 5, 2);
    R(5, 11, 6, 4, dark(metal, 0.15)); R(7, -18, 2, 30, metal); R(8, -18, 1, 30, dark(metal, 0.3));
    for (const s of [-1, 1]) { R(8 + s * 3 - (s < 0 ? 1 : 0), -12, 2, 4, metal); S(8 + s * 4, -13, metal); }
    E(8, -22, 4, 2, metal); E(8, -22, 2.5, 1, dark(metal, 0.4));
    PL([8, -34, 10, -27, 16, -25, 10, -23, 8, -16, 6, -23, 0, -25, 6, -27], star);
    PL([8, -34, 10, -27, 8, -25], light(star, 0.4));
    S(8, -25, '#ffffff');
    ctx.emit.push({ kind: 'glow', x: 8, y: -25, color: star, r: 2.4 }, { kind: 'twinkle', x: 8, y: -26, color: '#ffffff' });
  },
  orrery(ctx) {
    const { R, S, E, SH } = tools(ctx);
    const metal = col(ctx.L.metal, '#e0b850'), p1 = col(ctx.L.planet, '#7fb0ff'), p2 = col(ctx.L.planet2, '#ff9ab0');
    const W = ctx.W, H = ctx.H, cx = W / 2;
    shadow(ctx, cx, H - 6, W / 2 - 2, 6);
    E(cx, H - 8, W / 2 - 2, 9, '#c8bce8'); E(cx, H - 10, W / 2 - 6, 7, '#e2d8f6'); E(cx, H - 10, W / 2 - 9, 5, '#7a6ad0');
    for (const [x, y] of [[cx - 8, H - 11], [cx + 6, H - 9], [cx - 2, H - 13]]) S(x, y, '#fff2a8');
    R(cx - 1, H - 34, 3, 24, metal); R(cx + 1, H - 34, 1, 24, dark(metal, 0.3));
    const sy = H - 38;
    // rings (ellipse outlines)
    for (const [rx, ry] of [[14, 6], [21, 9]]) {
      for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; S(cx + Math.cos(t) * rx, sy + Math.sin(t) * ry, a % 8 < 6 ? metal : dark(metal, 0.3)); }
    }
    SH(cx, sy, 5, 5, '#ffd24a', '#e0a020', '#fff6c0');
    ctx.emit.push({ kind: 'glow', x: cx, y: sy, color: '#ffd24a', r: 2.2 }, { kind: 'orbit', x: cx, y: sy, color: p1, color2: p2, r1: 14, q1: 6, r2: 21, q2: 9 });
  },
  moon_flower(ctx) {
    const { R, S, E } = tools(ctx);
    const petal = col(ctx.L.petal, '#e8e0ff'), glow = col(ctx.L.glow, '#bfa8ff');
    const x = 6 + (ctx.v & 3), y = 9 + ((ctx.v >> 2) & 1);
    E(x, y + 3, 5, 1.6, '#5ab890'); R(x, y - 1, 1, 4, '#5ab890');
    for (const [dx, dy] of [[-2, -2], [2, -2], [-3, 0], [3, 0], [0, -3], [-1, 1], [1, 1]]) E(x + dx, y - 2 + dy, 1.4, 1.1, (dx + dy) % 2 ? petal : mix(petal, glow, 0.4));
    S(x, y - 2, '#fffbe0');
    ctx.emit.push({ kind: 'glow', x, y: y - 2, color: glow, r: 1.1 });
  },
};

// headroom above the footprint (art px), wider-than-footprint sprites, flat (walk-on) models
export const BIOME_UP = { palm: 44, cactus: 16, ruin_pillar: 26, obelisk: 38, pottery: 8, dune: 2, shell: 2, coral: 10, boat: 26,
  tidepool: 2, lighthouse: 76, snowman: 18, igloo: 20, snow_pine: 36, ice_spire: 22, cloud_puff: 4, floating_rock: 18, star_lamp: 36,
  orrery: 28, moon_flower: 4 };
export const BIOME_SIDE = { palm: 10, boat: 4, lighthouse: 6, floating_rock: 4, orrery: 4, igloo: 4 };
export const BIOME_FLAT = { dune: 1, shell: 1, tidepool: 1 };
