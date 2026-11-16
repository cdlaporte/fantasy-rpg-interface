// Prop sprites (closed model list, CONTRACTS section 5), painted in 3/4 view, auto-outlined.
// buildProp(prop) -> {c, dx, dy, w, h, flat, shadow: {x, y, rx, ry} | null, emit: [{kind, x, y, color}]}
//   dx/dy: sprite top-left relative to the footprint's top-left (art px); shadow and emitters are in the same space.
// Flat models (rug, flowerbed, bridge) are baked into tile chunks; the rest are y-sorted with entities.
import { Pix } from './pix.js';
import { dark, light, mix, col, OUTLINE } from './color.js';

export const PROP_MODELS = ['tree', 'pine', 'bush', 'rock', 'stump', 'log', 'flowerbed', 'mushroom_big', 'crystal', 'fence',
  'hedge_arch', 'lamp', 'sign', 'bench', 'well', 'fountain', 'statue', 'barrel', 'crate', 'stall', 'cart', 'campfire', 'tent',
  'house', 'shop', 'tower', 'academy', 'gate_arch', 'rune_gate', 'bridge', 'banner', 'bookshelf', 'desk', 'table', 'chair', 'bed',
  'cauldron', 'chalkboard', 'rug', 'chest'];
export const FLAT_MODELS = { rug: 1, flowerbed: 1, bridge: 1 };
const SIGNS = ['potion', 'hat', 'bag', 'bread', 'cup', 'book', 'sword', 'none'];

/** model id for a zone prop (def.model, else kind) */
export function propModel(pr) { return (pr.def && pr.def.model) || pr.kind; }

export function propUnknown(pr, out) {
  const m = propModel(pr);
  if (!PROP_MODELS.includes(m)) out.push('prop.model:' + m);
  if (['house', 'shop', 'tower', 'academy'].includes(m) && pr.look && pr.look.sign && !SIGNS.includes(pr.look.sign)) out.push('prop.sign:' + pr.look.sign);
  if (pr.look && pr.look.style && !STYLES.includes(pr.look.style)) out.push('prop.style:' + pr.look.style);
}

/** Cache key for a prop's sprite. */
export function propKey(pr) {
  return propModel(pr) + '|' + (pr.w || 1) + 'x' + (pr.h || 1) + '|' + JSON.stringify(pr.look || {});
}

export function buildProp(pr) {
  const model = propModel(pr);
  const w = pr.w || 1, h = pr.h || 1;
  const L = pr.look || {};
  const v = (L.variant | 0) + (((pr.x || 0) * 7 + (pr.y || 0) * 13) & 255);
  const style = ['house', 'shop', 'tower'].includes(model) && STYLES.includes(L.style) ? L.style : null;
  let fn = PAINTERS[model] || PAINTERS.crate;
  if (style) fn = (c) => styled(c, style);
  const up = (style && STYLE_UP[style]) || (model === 'table' && L.umbrella ? 26 : UP[model] ?? 24), side = SIDE[model] ?? 6, down = 3;
  const p = new Pix(w * 16 + side * 2, h * 16 + up + down);
  const ctx = { p, w, h, W: w * 16, H: h * 16, ox: side, oy: up, L, v, emit: [], shadow: null,
    door: pr.def && pr.def.door !== undefined ? pr.def.door : null };
  fn(ctx);
  p.outline(OUTLINE);
  return { pix: p, dx: -side, dy: -up, w: p.w, h: p.h, flat: !!FLAT_MODELS[model], shadow: ctx.shadow, emit: ctx.emit, model };
}

// headroom above the footprint per model (art px)
const UP = { tree: 30, pine: 34, bush: 6, rock: 4, stump: 4, log: 4, flowerbed: 2, mushroom_big: 20, crystal: 18, fence: 8,
  hedge_arch: 26, lamp: 34, sign: 12, bench: 8, well: 26, fountain: 18, statue: 30, barrel: 8, crate: 6, stall: 24, cart: 8,
  campfire: 4, tent: 18, house: 34, shop: 34, tower: 76, academy: 88, gate_arch: 30, rune_gate: 28, bridge: 4, banner: 34,
  bookshelf: 22, desk: 6, table: 4, chair: 10, bed: 6, cauldron: 6, chalkboard: 18, rug: 2, chest: 4 };
const SIDE = { tree: 10, pine: 6, house: 6, shop: 6, tower: 6, academy: 12, stall: 4, fountain: 4, tent: 4, well: 4 };

// ------------------------------------------------------------------ helpers
function tools(ctx) {
  const { p, ox, oy } = ctx;
  const R = (x, y, w, h, c) => p.rect(ox + Math.round(x), oy + Math.round(y), Math.round(w), Math.round(h), c);
  const S = (x, y, c) => p.set(ox + Math.round(x), oy + Math.round(y), c);
  const E = (cx, cy, rx, ry, c) => p.ellipse(ox + cx, oy + cy, rx, ry, c);
  const SH = (cx, cy, rx, ry, c, lo, hi) => p.shaded(ox + cx, oy + cy, rx, ry, c, lo, hi);
  const PL = (pts, c) => p.poly(pts.map((v, i) => v + (i % 2 ? oy : ox)), c);
  const LN = (x0, y0, x1, y1, c) => p.line(ox + Math.round(x0), oy + Math.round(y0), ox + Math.round(x1), oy + Math.round(y1), c);
  return { R, S, E, SH, PL, LN };
}
const shadow = (ctx, x, y, rx, ry) => { ctx.shadow = { x, y, rx, ry }; };

// ------------------------------------------------------------------ painters
const PAINTERS = {
  tree(ctx) {
    const { R, S, SH, E } = tools(ctx);
    const L = ctx.L, v = ctx.v;
    const trunk = col(L.trunk, '#8a5a33'), leaves = col(L.leaves, '#3fae4f');
    const lo = dark(leaves, 0.3), hi = light(leaves, 0.25), hi2 = light(leaves, 0.45);
    shadow(ctx, 8, 14, 11, 4);
    R(6, -2, 4, 16, trunk); R(9, -2, 1, 16, dark(trunk, 0.3)); R(6, -2, 1, 16, light(trunk, 0.2));
    R(4, 13, 2, 2, trunk); R(10, 13, 2, 2, dark(trunk, 0.25));
    const big = (v & 3) !== 0;
    SH(8, -12, big ? 13 : 11, big ? 11 : 10, leaves, lo, hi);
    SH(1, -6, 7, 6, leaves, lo, hi); SH(15, -6, 7, 6, leaves, lo, hi);
    SH(5, -17, 7, 6, leaves, lo, hi2); SH(12, -15, 6, 5, leaves, lo, hi);
    R(2, -2, 12, 2, lo);
    for (let i = 0; i < 6; i++) S(-2 + i * 4, -9 + ((i * 5 + v) % 7), lo);
    if ((v & 7) === 1) for (const [x, y] of [[2, -9], [12, -13], [7, -5], [14, -4]]) { S(x, y, '#ff5a5a'); S(x + 1, y, '#ff9a8a'); }
    if ((v & 7) === 2) for (const [x, y] of [[1, -11], [11, -16], [6, -6], [15, -8]]) { S(x, y, '#ffd1e8'); S(x, y + 1, '#ff8fc7'); }
  },
  pine(ctx) {
    const { R, PL, S } = tools(ctx);
    const trunk = col(ctx.L.trunk, '#7a4e2c'), leaves = col(ctx.L.leaves, '#2c8f5a');
    const lo = dark(leaves, 0.3), hi = light(leaves, 0.22);
    shadow(ctx, 8, 14, 9, 3.5);
    R(6, 6, 4, 9, trunk); R(9, 6, 1, 9, dark(trunk, 0.3));
    for (let i = 0; i < 4; i++) {
      const y = 10 - i * 10, wv = 11 - i * 2;
      PL([8 - wv, y, 8 + wv, y, 8, y - 16], leaves);
      PL([8, y - 16, 8 + wv, y, 8 + 2, y], lo);
      PL([8 - wv, y, 8 - wv + 4, y, 8, y - 16], hi);
      R(8 - wv + 2, y - 1, wv * 2 - 3, 1, lo);
    }
    S(8, -33, light(leaves, 0.45));
    if (ctx.v & 1) { S(4, -2, '#ffffff'); S(12, -12, '#ffffff'); }
  },
  bush(ctx) {
    const { SH, S } = tools(ctx);
    const leaves = col(ctx.L.leaves, '#4cbf55'), berry = col(ctx.L.berry, '#ff6b8a');
    shadow(ctx, 8, 14, 9, 3);
    const lo = dark(leaves, 0.3), hi = light(leaves, 0.25);
    SH(4, 9, 6, 5, leaves, lo, hi); SH(12, 9, 6, 5, leaves, lo, hi); SH(8, 5, 7, 6, leaves, lo, hi);
    if ((ctx.v & 3) !== 3) for (const [x, y] of [[4, 7], [10, 4], [12, 10], [7, 11]]) { S(x, y, berry); S(x + 1, y, light(berry, 0.4)); }
  },
  rock(ctx) {
    const { SH, E, S } = tools(ctx);
    const body = col(ctx.L.body, '#a6a6b0'), moss = col(ctx.L.moss, '#7cc95a');
    shadow(ctx, 8, 14, 9, 3);
    SH(8, 9, 8, 6.5, body, dark(body, 0.3), light(body, 0.3));
    SH(12, 11, 4, 3.5, body, dark(body, 0.3), light(body, 0.2));
    E(6, 4.5, 4.5, 1.6, moss); S(4, 4, light(moss, 0.3)); S(9, 5, dark(moss, 0.2));
    S(10, 9, dark(body, 0.35)); S(11, 10, dark(body, 0.35));
  },
  stump(ctx) {
    const { R, E, S } = tools(ctx);
    const bark = col(ctx.L.bark, '#8a5a33'), top = col(ctx.L.top, '#d9b07a');
    shadow(ctx, 8, 14, 8, 3);
    R(2, 5, 12, 9, bark); R(12, 5, 2, 9, dark(bark, 0.3)); R(2, 5, 1, 9, light(bark, 0.2));
    R(0, 12, 3, 2, bark); R(13, 12, 3, 2, dark(bark, 0.3));
    E(8, 5, 6, 2.6, top); E(8, 5, 3.5, 1.4, dark(top, 0.15)); E(8, 5, 1.5, 0.6, top);
    S(5, 9, dark(bark, 0.35)); S(9, 11, dark(bark, 0.35));
  },
  log(ctx) {
    const { R, E, S } = tools(ctx);
    const bark = col(ctx.L.bark, '#8a5a33'), top = col(ctx.L.top, '#d9b07a');
    shadow(ctx, 16, 14, 15, 3);
    R(2, 4, 26, 10, bark); R(2, 11, 26, 3, dark(bark, 0.3)); R(2, 4, 26, 2, light(bark, 0.2));
    for (let x = 5; x < 26; x += 5) S(x, 7 + (x % 3), dark(bark, 0.35));
    E(28, 9, 3, 5, top); E(28, 9, 1.5, 3, dark(top, 0.2));
    R(12, 2, 2, 3, '#5fb548'); S(14, 1, '#7cd96a');
  },
  flowerbed(ctx) {
    const { R, S } = tools(ctx);
    const soil = col(ctx.L.soil, '#8a5a33'), a = col(ctx.L.petals, '#ff8fc7'), b = col(ctx.L.petals2, '#ffe066');
    R(0, 3, 16, 12, soil); R(0, 3, 16, 1, light(soil, 0.2)); R(0, 14, 16, 1, dark(soil, 0.3));
    for (let i = 0; i < 6; i++) {
      const x = 2 + (i % 3) * 5, y = 6 + Math.floor(i / 3) * 5, c = (i + ctx.v) % 2 ? a : b;
      S(x, y + 1, '#3f9e4a'); S(x, y + 2, '#3f9e4a'); S(x - 1, y, c); S(x + 1, y, c); S(x, y - 1, c); S(x, y, '#ffffff');
    }
  },
  mushroom_big(ctx) {
    const { R, SH, E, S } = tools(ctx);
    const cap = col(ctx.L.cap, '#e8503c'), spots = col(ctx.L.spots, '#ffffff'), stem = col(ctx.L.stem, '#f4e3c4');
    shadow(ctx, 8, 14, 9, 3);
    R(5, 0, 6, 14, stem); R(10, 0, 1, 14, dark(stem, 0.25)); R(5, 0, 1, 14, light(stem, 0.3));
    E(8, 14, 5, 1.5, dark(stem, 0.15));
    SH(8, -6, 12, 8, cap, dark(cap, 0.3), light(cap, 0.3));
    R(-3, -2, 22, 2, dark(cap, 0.35));
    R(-2, 0, 20, 1, dark(stem, 0.2));
    for (const [x, y, r] of [[2, -8, 2], [9, -11, 2.4], [14, -5, 1.6], [6, -4, 1.4]]) E(x, y, r, r * 0.8, spots);
  },
  crystal(ctx) {
    const { PL, LN, S } = tools(ctx);
    const body = col(ctx.L.body, '#9fe6ff'), glow = col(ctx.L.glow, '#c9a6ff');
    shadow(ctx, 8, 14, 8, 3);
    const shard = (x, w, hgt, c) => { PL([x - w, 14, x + w, 14, x + 1, 14 - hgt, x - 1, 14 - hgt + 2], c); LN(x, 13, x, 15 - hgt, light(c, 0.45)); PL([x + 1, 14 - hgt, x + w, 14, x + 1, 14], dark(c, 0.15)); };
    shard(3, 3, 12, glow); shard(13, 3, 14, glow); shard(8, 4, 26, body);
    S(7, -8, '#ffffff'); S(8, -10, '#ffffff');
    ctx.emit.push({ kind: 'glow', x: 8, y: 2, color: body, r: 1.4 }, { kind: 'twinkle', x: 8, y: -4, color: '#ffffff' });
  },
  fence(ctx) {
    const { R } = tools(ctx);
    const wood = col(ctx.L.wood, '#c98c50'), lo = dark(wood, 0.3), hi = light(wood, 0.25);
    shadow(ctx, 8, 14, 9, 2);
    R(0, 4, 16, 3, wood); R(0, 4, 16, 1, hi); R(0, 9, 16, 3, wood); R(0, 11, 16, 1, lo);
    for (const x of [1, 12]) { R(x, 0, 3, 15, wood); R(x + 2, 0, 1, 15, lo); R(x, -1, 3, 1, hi); }
  },
  hedge_arch(ctx) {
    const { R, SH, S } = tools(ctx);
    const leaves = col(ctx.L.leaves, '#3f9e4a'), fl = col(ctx.L.flowers, '#ff8fc7');
    const lo = dark(leaves, 0.3), hi = light(leaves, 0.22);
    for (const x of [0, 38]) { R(x, -10, 10, 25, leaves); R(x + 7, -10, 3, 25, lo); R(x, -10, 2, 25, hi); }
    for (let i = 0; i < 7; i++) SH(4 + i * 7, -16 - Math.round(Math.sin(i / 6 * Math.PI) * 6), 7, 6, leaves, lo, hi);
    for (let i = 0; i < 9; i++) { const x = 2 + i * 5, y = -17 - Math.round(Math.sin(i / 8 * Math.PI) * 6) + (i % 2) * 3; S(x, y, fl); S(x + 1, y, light(fl, 0.4)); S(x, y + 1, dark(fl, 0.2)); }
  },
  lamp(ctx) {
    const { R, S, E } = tools(ctx);
    const pole = col(ctx.L.pole, '#4a4a5a'), light0 = col(ctx.L.light, '#ffe680');
    shadow(ctx, 8, 14, 5, 2);
    R(5, 10, 6, 4, pole); R(4, 13, 8, 2, dark(pole, 0.2));
    R(7, -20, 2, 31, pole); R(8, -20, 1, 31, dark(pole, 0.3)); R(7, -20, 1, 31, light(pole, 0.25));
    R(3, -22, 10, 2, pole);
    R(4, -31, 8, 9, pole); R(5, -30, 6, 7, light0); R(6, -29, 2, 5, '#fffbe8');
    R(3, -33, 10, 2, pole); S(8, -34, pole); S(7, -34, pole);
    E(8, -26, 1, 1, '#ffffff');
    ctx.emit.push({ kind: 'glow', x: 8, y: -26, color: light0, r: 2.2 });
  },
  sign(ctx) {
    const { R, S } = tools(ctx);
    const wood = col(ctx.L.wood, '#c98c50'), text = col(ctx.L.text, '#5a3a22');
    shadow(ctx, 8, 14, 6, 2);
    R(7, -2, 2, 16, dark(wood, 0.2));
    R(0, -10, 16, 10, wood); R(0, -10, 16, 1, light(wood, 0.3)); R(0, -1, 16, 1, dark(wood, 0.3));
    R(3, -7, 9, 1, text); R(3, -4, 6, 1, text); R(10, -4, 2, 1, text);
    S(1, -9, dark(wood, 0.3)); S(14, -9, dark(wood, 0.3));
  },
  bench(ctx) {
    const { R } = tools(ctx);
    const wood = col(ctx.L.wood, '#c98c50'), metal = col(ctx.L.metal, '#4a4a5a');
    shadow(ctx, 16, 14, 15, 2.5);
    R(2, 0, 28, 3, wood); R(2, 4, 28, 3, wood); R(2, 2, 28, 1, dark(wood, 0.25)); R(2, 6, 28, 1, dark(wood, 0.25)); R(2, 0, 28, 1, light(wood, 0.3));
    R(1, 8, 30, 4, light(wood, 0.1)); R(1, 11, 30, 1, dark(wood, 0.3));
    for (const x of [3, 27]) { R(x, 0, 2, 15, metal); R(x - 1, 14, 4, 1, metal); }
  },
  well(ctx) {
    const { R, E, SH, PL } = tools(ctx);
    const stone = col(ctx.L.stone, '#b9bccb'), roof = col(ctx.L.roof, '#c8503c'), water = col(ctx.L.water, '#3fa9e8');
    shadow(ctx, 16, 30, 15, 4);
    R(3, 12, 26, 16, stone); E(16, 12, 13, 5, light(stone, 0.2)); E(16, 12, 10, 3.5, dark(water, 0.3)); E(16, 12.5, 8, 2.5, water);
    for (let y = 15; y < 28; y += 4) for (let x = 3 + ((y >> 2) & 1) * 3; x < 29; x += 6) R(x, y, 1, 3, dark(stone, 0.25));
    for (let x = 3; x < 29; x += 6) R(x, 18, 6, 1, dark(stone, 0.25));
    R(3, 26, 26, 2, dark(stone, 0.3));
    R(4, -8, 3, 22, '#8a5a33'); R(25, -8, 3, 22, '#8a5a33'); R(6, -8, 1, 22, '#5a3a22');
    PL([0, -6, 32, -6, 26, -20, 6, -20], roof); PL([0, -6, 32, -6, 32, -4, 0, -4], dark(roof, 0.35));
    for (let x = 2; x < 30; x += 4) R(x, -14 + ((x >> 2) & 1), 2, 1, dark(roof, 0.2));
    PL([6, -20, 26, -20, 24, -22, 8, -22], light(roof, 0.25));
    R(7, -4, 18, 1, '#8a5a33'); R(15, -4, 1, 10, '#d8c8a0'); SH(15.5, 7, 2.5, 2, '#8a5a33', '#5a3a22', '#b0743d');
  },
  fountain(ctx) {
    const { R, E, SH } = tools(ctx);
    const stone = col(ctx.L.stone, '#d8dae4'), water = col(ctx.L.water, '#68c4f2');
    shadow(ctx, 24, 44, 24, 5);
    E(24, 30, 24, 15, dark(stone, 0.25)); E(24, 28, 24, 15, stone); E(24, 28, 21, 12.5, dark(stone, 0.15)); E(24, 29, 20, 11.5, water);
    E(24, 29, 16, 8.5, light(water, 0.15)); E(19, 26, 4, 1.5, light(water, 0.45)); E(31, 33, 3, 1, light(water, 0.4));
    R(0, 28, 48, 14, stone); R(0, 28, 48, 1, light(stone, 0.3)); R(0, 40, 48, 2, dark(stone, 0.3));
    for (let x = 4; x < 46; x += 8) R(x, 30, 1, 10, dark(stone, 0.2));
    E(24, 43, 24, 4, dark(stone, 0.3));
    E(24, 42, 23.5, 3, stone);
    R(20, 4, 8, 26, stone); R(26, 4, 2, 26, dark(stone, 0.25)); R(20, 4, 1, 26, light(stone, 0.3));
    SH(24, 6, 10, 4, stone, dark(stone, 0.25), light(stone, 0.3)); E(24, 5, 8, 2.5, water);
    SH(24, -6, 3, 3, stone, dark(stone, 0.25), light(stone, 0.4));
    ctx.emit.push({ kind: 'fountain', x: 24, y: -8, color: water }, { kind: 'ripple', x: 24, y: 29, color: '#ffffff' });
  },
  statue(ctx) {
    const { R, SH, PL, S } = tools(ctx);
    const stone = col(ctx.L.stone, '#d8dae4'), base = col(ctx.L.base, '#a3a7b8');
    const lo = dark(stone, 0.28), hi = light(stone, 0.3);
    shadow(ctx, 8, 14, 9, 3);
    R(0, 6, 16, 9, base); R(0, 6, 16, 1, light(base, 0.3)); R(14, 6, 2, 9, dark(base, 0.3)); R(3, 10, 10, 2, dark(base, 0.2));
    // a robed wizard figure raising a book
    PL([3, 6, 13, 6, 11, -10, 5, -10], stone); PL([8, 6, 13, 6, 11, -10, 9, -10], lo);
    SH(8, -14, 4, 4, stone, lo, hi);
    PL([3, -16, 13, -16, 8, -30], stone); PL([8, -30, 13, -16, 9, -16], lo); R(2, -17, 12, 2, lo);
    R(11, -12, 3, 2, stone); R(12, -18, 4, 5, hi); S(13, -16, lo);
    S(6, -14, lo); S(9, -14, lo);
  },
  barrel(ctx) {
    const { R, E } = tools(ctx);
    const wood = col(ctx.L.wood, '#b0743d'), band = col(ctx.L.band, '#5a5a66');
    shadow(ctx, 8, 14, 7, 2.5);
    R(2, -2, 12, 16, wood); R(1, 1, 14, 10, wood); R(12, -2, 2, 16, dark(wood, 0.3)); R(2, -2, 2, 16, light(wood, 0.2));
    R(6, -2, 1, 16, dark(wood, 0.15)); R(9, -2, 1, 16, dark(wood, 0.15));
    R(1, 1, 14, 1, band); R(1, 9, 14, 1, band);
    E(8, -2, 6, 2.2, light(wood, 0.25)); E(8, -2, 4, 1.2, dark(wood, 0.2));
  },
  crate(ctx) {
    const { R, LN } = tools(ctx);
    const wood = col(ctx.L.wood, '#d6a060'), edge = col(ctx.L.edge, '#9a6a3a');
    shadow(ctx, 8, 14, 8, 2.5);
    R(1, 0, 14, 14, wood); R(1, -4, 14, 4, light(wood, 0.25));
    R(1, 0, 14, 2, edge); R(1, 12, 14, 2, edge); R(1, 0, 2, 14, edge); R(13, 0, 2, 14, dark(edge, 0.2));
    LN(3, 12, 12, 2, edge); LN(4, 12, 13, 2, dark(edge, 0.1));
    R(1, -4, 14, 1, light(wood, 0.4));
  },
  stall(ctx) {
    const { R, PL } = tools(ctx);
    const wood = col(ctx.L.wood, '#c98c50'), aw = col(ctx.L.awning, '#ff6b6b'), aw2 = col(ctx.L.awning2, '#ffffff');
    shadow(ctx, 24, 30, 23, 4);
    R(0, 14, 48, 16, wood); R(0, 14, 48, 2, light(wood, 0.3)); R(0, 28, 48, 2, dark(wood, 0.35));
    for (let x = 4; x < 48; x += 8) R(x, 17, 1, 11, dark(wood, 0.2));
    // goods on the counter
    const goods = ['#ff6b6b', '#ffd24a', '#7cd96a', '#ff9a3c', '#c9a6ff'];
    for (let i = 0; i < 9; i++) { const c = goods[(i + ctx.v) % goods.length]; const x = 3 + i * 5; R(x, 10, 4, 4, c); R(x, 10, 4, 1, light(c, 0.4)); R(x + 3, 11, 1, 3, dark(c, 0.3)); }
    for (const x of [1, 45]) { R(x, -14, 2, 30, dark(wood, 0.2)); }
    for (let i = 0; i < 8; i++) { const c = i % 2 ? aw2 : aw; PL([i * 6, -6, i * 6 + 6, -6, i * 6 + 6, -18, i * 6, -18], c); }
    R(0, -6, 48, 3, aw); for (let i = 0; i < 8; i++) R(i * 6 + 1, -3, 4, 2, i % 2 ? aw : aw2);
    R(0, -18, 48, 1, light(aw, 0.3)); R(0, -7, 48, 1, dark(aw, 0.3));
  },
  cart(ctx) {
    const { R, E, SH } = tools(ctx);
    const wood = col(ctx.L.wood, '#b0743d'), wheel = col(ctx.L.wheel, '#5a3a22');
    shadow(ctx, 16, 14, 15, 2.5);
    R(2, -2, 26, 10, wood); R(2, -4, 26, 2, light(wood, 0.3)); R(2, 6, 26, 2, dark(wood, 0.3));
    for (let x = 8; x < 28; x += 6) R(x, -2, 1, 8, dark(wood, 0.2));
    SH(8, 6, 3, 2, '#7cd96a', '#4a9a4a', '#a8f08a'); SH(14, 5, 3, 2.4, '#ff9a3c', '#c86a1a', '#ffc070'); SH(21, 6, 3, 2, '#ffe066', '#c8a030', '#fff0a0');
    for (const x of [7, 23]) { E(x, 10, 5, 5, wheel); E(x, 10, 3.5, 3.5, light(wheel, 0.3)); E(x, 10, 1.2, 1.2, wheel); }
    R(28, 2, 6, 2, wood);
  },
  campfire(ctx) {
    const { E, R, S } = tools(ctx);
    const stone = col(ctx.L.stone, '#a6a6b0'), flame = col(ctx.L.flame, '#ffa040');
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; E(8 + Math.cos(a) * 6.5, 10 + Math.sin(a) * 3.5, 2, 1.6, i % 2 ? stone : light(stone, 0.2)); }
    R(3, 8, 10, 2, '#7a4e2c'); R(5, 6, 6, 2, '#8a5a33'); S(4, 9, '#5a3a22');
    E(8, 9, 3, 1.4, '#ff5a2a'); S(7, 8, '#ffe066'); S(8, 8, '#ffe066');
    ctx.emit.push({ kind: 'flame', x: 8, y: 8, color: flame }, { kind: 'glow', x: 8, y: 4, color: flame, r: 2 });
  },
  tent(ctx) {
    const { PL, R, LN } = tools(ctx);
    const cloth = col(ctx.L.cloth, '#f4d06f'), trim = col(ctx.L.trim, '#c8503c');
    shadow(ctx, 24, 30, 23, 4);
    PL([0, 30, 48, 30, 36, -14, 12, -14], cloth);
    PL([24, -14, 36, -14, 48, 30, 30, 30], dark(cloth, 0.2));
    PL([12, -14, 18, -14, 6, 30, 0, 30], light(cloth, 0.2));
    PL([24, -12, 32, 30, 16, 30], dark(cloth, 0.55)); PL([24, -8, 28, 30, 20, 30], '#3a2a20');
    R(0, 28, 48, 2, trim); LN(12, -14, 36, -14, trim);
    LN(24, -16, 24, -24, '#8a5a33'); PL([24, -24, 31, -21, 24, -18], trim);
    for (let x = 4; x < 46; x += 8) R(x, 25, 2, 3, light(trim, 0.3));
  },
  house(ctx) { building(ctx, 'house'); },
  shop(ctx) { building(ctx, 'shop'); },
  tower(ctx) { tower(ctx); },
  academy(ctx) { academy(ctx); },
  gate_arch(ctx) {
    const { R, PL, S } = tools(ctx);
    const stone = col(ctx.L.stone, '#d8dae4'), trim = col(ctx.L.trim, '#ffd24a');
    const lo = dark(stone, 0.28), hi = light(stone, 0.3);
    for (const x of [0, 38]) { R(x, -18, 10, 33, stone); R(x + 8, -18, 2, 33, lo); R(x, -18, 2, 33, hi); for (let y = -14; y < 14; y += 6) R(x, y, 10, 1, lo); }
    PL([0, -18, 48, -18, 48, -30, 0, -30], stone);
    PL([10, -18, 38, -18, 34, -12, 14, -12], stone);
    R(0, -30, 48, 2, hi); R(0, -19, 48, 1, lo); R(10, -13, 28, 1, lo);
    R(18, -28, 12, 7, trim); R(19, -27, 10, 5, dark(trim, 0.2)); S(24, -25, '#ffffff'); S(23, -25, trim);
    for (const x of [2, 40]) { R(x, -34, 6, 4, stone); R(x, -34, 6, 1, hi); }
  },
  rune_gate(ctx) {
    const { R, PL, S } = tools(ctx);
    const stone = col(ctx.L.stone, '#8f88b8'), rune = col(ctx.L.rune, '#9fe6ff');
    const lo = dark(stone, 0.28), hi = light(stone, 0.28);
    for (const x of [0, 40]) { PL([x, 15, x + 8, 15, x + 7, -24, x + 1, -24], stone); R(x + 6, -24, 2, 39, lo); R(x, -24, 1, 39, hi); for (let y = -18; y < 12; y += 7) { R(x + 3, y, 2, 3, rune); S(x + 3, y, '#ffffff'); } PL([x - 1, -24, x + 9, -24, x + 4, -30], hi); }
    R(8, 6, 32, 9, lo); R(8, 6, 32, 1, hi);
    for (let x = 12; x < 38; x += 5) { R(x, 9, 2, 2, rune); }
    ctx.emit.push({ kind: 'glow', x: 4, y: -6, color: rune, r: 1.6 }, { kind: 'glow', x: 44, y: -6, color: rune, r: 1.6 }, { kind: 'twinkle', x: 24, y: 0, color: rune });
  },
  bridge(ctx) {
    const { R } = tools(ctx);
    const wood = col(ctx.L.wood, '#c98c50'), rail = col(ctx.L.rail, '#8a5a33');
    const W = ctx.W, H = ctx.H;
    if (ctx.w >= ctx.h) {
      // walked north-south: boards run east-west, rails on the west and east sides
      for (let y = 0; y < H; y += 4) {
        const c = (y >> 2) % 3 === 0 ? dark(wood, 0.1) : (y >> 2) % 3 === 1 ? light(wood, 0.06) : wood;
        R(3, y, W - 6, 4, c); R(3, y + 3, W - 6, 1, dark(wood, 0.32)); R(3, y, W - 6, 1, light(wood, 0.25));
        R(6 + ((y * 7) % (W - 14)), y + 1, 1, 1, dark(wood, 0.45));
      }
      R(0, -2, 4, H + 2, rail); R(W - 4, -2, 4, H + 2, rail); R(0, -2, 1, H + 2, light(rail, 0.3)); R(W - 1, -2, 1, H + 2, dark(rail, 0.35));
      for (let y = -2; y < H; y += 10) { R(0, y, 4, 3, dark(rail, 0.2)); R(W - 4, y, 4, 3, dark(rail, 0.2)); }
    } else {
      for (let x = 0; x < W; x += 4) { const c = (x >> 2) % 3 === 0 ? dark(wood, 0.1) : wood; R(x, 3, 4, H - 6, c); R(x + 3, 3, 1, H - 6, dark(wood, 0.3)); R(x, 3, 4, 1, light(wood, 0.3)); }
      R(0, 0, W, 3, rail); R(0, 0, W, 1, light(rail, 0.3));
      R(0, H - 3, W, 3, rail); R(0, H - 1, W, 1, dark(rail, 0.35));
      for (let x = 0; x < W; x += 12) { R(x, -2, 3, 5, rail); R(x, H - 5, 3, 5, rail); }
    }
    if (ctx.L.style === 'arch') {
      // humped stone bridge: mortar joints and round end posts
      for (let y = 2; y < H; y += 6) for (let x = 5 + ((y / 6) & 1) * 4; x < W - 5; x += 8) R(x, y, 1, 3, dark(wood, 0.25));
      for (const x of [0, W - 4]) for (const y of [-3, H - 4]) R(x, y, 4, 4, light(rail, 0.25));
    }
  },
  banner(ctx) {
    const { R, PL, S } = tools(ctx);
    const pole = col(ctx.L.pole, '#8a5a33'), cloth = col(ctx.L.cloth, '#3d5aa8'), em = col(ctx.L.emblem, '#ffd24a');
    shadow(ctx, 8, 14, 5, 2);
    R(7, -32, 2, 46, pole); R(8, -32, 1, 46, dark(pole, 0.3)); R(3, -30, 10, 2, pole); S(8, -34, '#ffd24a'); S(7, -33, '#ffd24a');
    PL([3, -28, 13, -28, 13, -6, 8, -10, 3, -6], cloth); R(11, -28, 2, 20, dark(cloth, 0.25)); R(3, -28, 1, 20, light(cloth, 0.2));
    R(6, -23, 4, 5, em); S(7, -24, em); S(8, -24, em); S(7, -21, dark(em, 0.3));
  },
  bookshelf(ctx) {
    const { R } = tools(ctx);
    const wood = col(ctx.L.wood, '#8a5a33'), b1 = col(ctx.L.books, '#c8503c'), b2 = col(ctx.L.books2, '#3d5aa8');
    const books = [b1, b2, '#5fb548', '#ffd24a', '#8a4ac8', light(b1, 0.2)];
    shadow(ctx, 16, 14, 15, 2);
    R(0, -22, 32, 36, wood); R(0, -22, 32, 2, light(wood, 0.25)); R(30, -22, 2, 36, dark(wood, 0.3));
    for (let s = 0; s < 3; s++) {
      const y = -19 + s * 11;
      R(2, y, 28, 9, dark(wood, 0.5));
      let x = 3;
      for (let i = 0; x < 29; i++) {
        const bw = 2 + ((i * 7 + s * 3 + ctx.v) % 3), bh = 6 + ((i * 5 + s) % 3), c = books[(i * 3 + s + ctx.v) % books.length];
        R(x, y + 9 - bh, bw, bh, c); R(x, y + 9 - bh, bw, 1, light(c, 0.3)); R(x + bw - 1, y + 9 - bh + 1, 1, bh - 1, dark(c, 0.25));
        x += bw;
      }
      R(1, y + 9, 30, 2, wood);
    }
  },
  desk(ctx) {
    const { R, S } = tools(ctx);
    const wood = col(ctx.L.wood, '#b0743d'), paper = col(ctx.L.paper, '#ffffff');
    shadow(ctx, 16, 14, 15, 2);
    R(0, -4, 32, 8, light(wood, 0.15)); R(0, -4, 32, 1, light(wood, 0.35)); R(0, 4, 32, 6, wood); R(0, 9, 32, 1, dark(wood, 0.3));
    R(2, 10, 3, 5, dark(wood, 0.25)); R(27, 10, 3, 5, dark(wood, 0.25));
    R(6, -3, 8, 6, paper); R(7, -2, 5, 1, '#a0a0b8'); R(7, 0, 6, 1, '#a0a0b8');
    R(22, -2, 3, 3, '#2a2a4a'); S(23, -3, '#ffffff'); R(18, -3, 1, 5, '#ffd24a');
    R(14, 6, 4, 1, dark(wood, 0.4));
  },
  table(ctx) {
    const { R } = tools(ctx);
    const wood = col(ctx.L.wood, '#c98c50'), cloth = col(ctx.L.cloth, '#f4ecd8');
    shadow(ctx, 16, 14, 15, 2.5);
    R(0, -2, 32, 10, cloth); R(0, -2, 32, 1, light(cloth, 0.4)); R(0, 7, 32, 3, dark(cloth, 0.15));
    for (let x = 1; x < 32; x += 4) R(x, 9, 2, 1, dark(cloth, 0.25));
    R(2, 10, 3, 5, wood); R(27, 10, 3, 5, wood);
    R(13, -1, 6, 3, '#ffffff'); R(14, -2, 4, 1, '#e0e4f0'); R(8, 0, 2, 2, '#c8503c'); R(23, 0, 3, 2, '#ffd24a');
    if (ctx.L.umbrella) {
      const { PL } = tools(ctx);
      const u1 = col(ctx.L.umbrella, '#e0508a'), u2 = col(ctx.L.umbrella2, '#ffffff'), cx = ctx.W / 2;
      R(cx, -18, 1, 18, '#8a8a96');
      for (let i = 0; i < 4; i++) PL([cx - 13 + i * 6.5, -16, cx - 6.5 + i * 6.5, -16, cx, -24], i % 2 ? u2 : u1);
      R(cx - 13, -16, 26, 1, dark(u1, 0.3));
    }
  },
  chair(ctx) {
    const { R } = tools(ctx);
    const wood = col(ctx.L.wood, '#b0743d');
    shadow(ctx, 8, 14, 6, 2);
    R(3, -8, 10, 9, wood); R(3, -8, 10, 1, light(wood, 0.3)); R(5, -6, 6, 1, dark(wood, 0.25));
    R(2, 1, 12, 5, light(wood, 0.1)); R(2, 5, 12, 1, dark(wood, 0.3));
    R(3, 6, 2, 8, dark(wood, 0.2)); R(11, 6, 2, 8, dark(wood, 0.2));
  },
  bed(ctx) {
    const { R } = tools(ctx);
    const wood = col(ctx.L.wood, '#8a5a33'), sheet = col(ctx.L.sheet, '#7fb0ff'), pillow = col(ctx.L.pillow, '#ffffff');
    shadow(ctx, 8, 30, 9, 3);
    R(0, -4, 16, 6, wood); R(0, -4, 16, 1, light(wood, 0.3));
    R(1, 2, 14, 27, light(sheet, 0.1)); R(2, 3, 12, 6, pillow); R(2, 8, 12, 1, dark(pillow, 0.15));
    R(1, 11, 14, 18, sheet); R(1, 11, 14, 1, light(sheet, 0.4)); R(13, 11, 2, 18, dark(sheet, 0.25));
    for (let y = 14; y < 28; y += 4) R(3, y, 9, 1, light(sheet, 0.2));
    R(0, 28, 16, 4, wood); R(0, 31, 16, 1, dark(wood, 0.3));
  },
  cauldron(ctx) {
    const { SH, E, R } = tools(ctx);
    const metal = col(ctx.L.metal, '#3a3a4a'), brew = col(ctx.L.brew, '#7cf07c');
    shadow(ctx, 8, 14, 8, 2.5);
    SH(8, 7, 8, 7, metal, dark(metal, 0.4), light(metal, 0.3));
    E(8, 1.5, 7.5, 2.5, light(metal, 0.2)); E(8, 1.8, 6, 1.8, brew); E(6, 1.3, 2, 0.7, light(brew, 0.5));
    R(2, 12, 2, 3, metal); R(12, 12, 2, 3, metal);
    ctx.emit.push({ kind: 'bubbles', x: 8, y: 1, color: brew }, { kind: 'glow', x: 8, y: 0, color: brew, r: 1.2 });
  },
  chalkboard(ctx) {
    const { R, S } = tools(ctx);
    const frame = col(ctx.L.frame, '#8a5a33'), board = col(ctx.L.board, '#2f5a44'), chalk = col(ctx.L.chalk, '#ffffff');
    shadow(ctx, 24, 14, 22, 2);
    R(0, -16, 48, 26, frame); R(2, -14, 44, 21, board); R(0, -16, 48, 1, light(frame, 0.3)); R(0, 9, 48, 1, dark(frame, 0.35));
    R(2, -14, 44, 1, light(board, 0.15));
    // a + b = c, a squared, a little triangle
    const g = (x, y, rows) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') S(x + i, y + j, chalk); }));
    g(5, -11, ['.#..#.', '#.#.#.', '###.##', '#.#.#.']); g(12, -10, ['.#.', '###', '.#.']); g(16, -11, ['.##', '#..', '#..', '.##']);
    g(21, -10, ['###', '...', '###']); g(25, -11, ['#', '#', '#', '#']); g(27, -12, ['#.', '.#']);
    R(5, -4, 14, 1, chalk); g(31, -11, ['...#', '..##', '.#.#', '####']); g(6, -2, ['#.#.##', '.#..#.', '#.#.##']);
    R(4, 7, 40, 2, light(frame, 0.15)); R(30, 6, 4, 1, chalk); R(36, 6, 3, 1, '#ffd24a');
    R(4, 10, 2, 5, frame); R(42, 10, 2, 5, frame);
  },
  rug(ctx) {
    const { R, S } = tools(ctx);
    const main = col(ctx.L.main, '#c8506a'), border = col(ctx.L.border, '#e0c060');
    const W = ctx.W, H = ctx.H;
    R(1, 1, W - 2, H - 2, border); R(3, 3, W - 6, H - 6, main);
    for (let y = 5; y < H - 5; y += 4) for (let x = 5 + (y & 4 ? 2 : 0); x < W - 5; x += 4) S(x, y, light(main, 0.25));
    for (let x = 2; x < W - 2; x += 2) { S(x, 0, light(border, 0.2)); S(x, H - 1, light(border, 0.2)); }
  },
  chest(ctx) {
    const { R, S } = tools(ctx);
    const wood = col(ctx.L.wood, '#b0743d'), metal = col(ctx.L.metal, '#ffd24a');
    shadow(ctx, 8, 14, 8, 2.5);
    R(1, 2, 14, 12, wood); R(1, -2, 14, 5, light(wood, 0.2)); R(1, -2, 14, 1, light(wood, 0.4)); R(1, 3, 14, 1, dark(wood, 0.35));
    R(3, -2, 2, 16, metal); R(11, -2, 2, 16, metal); R(7, 2, 2, 4, metal); S(7, 4, dark(metal, 0.5));
    R(13, 4, 2, 10, dark(wood, 0.3));
  },
};

// ------------------------------------------------------------------ buildings

const SIGN_ICONS = {
  potion: ['..##..', '..##..', '.#..#.', '#.##.#', '#.##.#', '.####.'],
  hat: ['...#..', '..##..', '..###.', '.####.', '######', '......'],
  bag: ['.#..#.', '..##..', '.####.', '######', '######', '.####.'],
  bread: ['......', '.####.', '#.#.##', '######', '######', '......'],
  cup: ['.#.#..', '......', '#####.', '#####.', '.###..', '......'],
  book: ['......', '##.##.', '######', '######', '######', '#.#.#.'],
  sword: ['.....#', '....#.', '...#..', '#.#...', '.#....', '#.#...'],
};
const SIGN_COLORS = { potion: '#ff5a8a', hat: '#7a5ad9', bag: '#c98c50', bread: '#e8a050', cup: '#8a5a33', book: '#3d5aa8', sword: '#8890a8' };

function signIcon(ctx, x, y, sign, bg) {
  const { R, S } = tools(ctx);
  R(x - 1, y - 1, 10, 10, '#5a3a22'); R(x, y, 8, 8, bg); R(x, y, 8, 1, light(bg, 0.3));
  const rows = SIGN_ICONS[sign];
  if (!rows) return;
  const c = SIGN_COLORS[sign];
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') S(x + 1 + i, y + 1 + j, j < 2 && sign === 'potion' ? '#c8c8d8' : c); }));
  if (sign === 'potion') S(x + 3, y + 4, '#ffffff');
}

function window_(ctx, x, y, w, h, trim, arch) {
  const { R, S } = tools(ctx);
  R(x - 1, y - 1, w + 2, h + 2, trim);
  R(x, y, w, h, '#4a6a9a'); R(x, y, w, Math.ceil(h / 2), '#9fd0f0'); S(x, y, '#ffffff'); S(x + 1, y, '#e8f8ff'); S(x, y + 1, '#e8f8ff');
  R(x + (w >> 1), y, 1, h, trim); R(x, y + (h >> 1), w, 1, trim);
  if (arch) { R(x, y - 2, w, 1, trim); R(x + 1, y - 3, w - 2, 1, trim); R(x, y - 1, w, 1, '#9fd0f0'); }
  R(x - 1, y + h + 1, w + 2, 1, dark(trim, 0.3));
}

function flowerBox(ctx, x, y, w) {
  const { R, S } = tools(ctx);
  R(x, y, w, 2, '#8a5a33');
  for (let i = 0; i < w; i += 2) { S(x + i, y - 1, '#4cbf55'); S(x + i + 1, y - 1, i % 4 ? '#ff8fc7' : '#ffe066'); }
}

function door(ctx, x, y, w, h, c, trim) {
  const { R, S } = tools(ctx);
  R(x - 1, y - 2, w + 2, h + 2, trim); R(x, y - 1, w, h + 1, c);
  R(x + 1, y - 3, w - 2, 1, trim);
  R(x + 1, y, w - 2, h - 1, light(c, 0.12)); R(x + (w >> 1), y, 1, h, dark(c, 0.3));
  S(x + w - 2, y + (h >> 1), '#ffd24a');
  R(x - 2, y + h, w + 4, 2, '#b9bccb'); R(x - 2, y + h + 1, w + 4, 1, '#8a8ea0');
}

function building(ctx, kind) {
  const { R, PL, S } = tools(ctx);
  const L = ctx.L, W = ctx.W, H = ctx.H;
  const wall = col(L.wall, '#f4e3c4'), roof = col(L.roof, kind === 'shop' ? '#4a90d9' : '#d9534f'), trim = col(L.trim, '#8a5a33'), doorC = col(L.door, '#6b4423');
  const sign = SIGNS.includes(L.sign) ? L.sign : (kind === 'shop' ? 'potion' : 'none');
  const wallH = 28, wallY = H - wallH;
  const rLo = dark(roof, 0.3), rHi = light(roof, 0.25), rDk = dark(roof, 0.5);
  shadow(ctx, W / 2, H - 1, W / 2 + 3, 4);
  // walls with half-timber frame and a stone foundation
  R(1, wallY, W - 2, wallH, wall);
  R(1, wallY, W - 2, 2, dark(wall, 0.25));
  R(W - 4, wallY, 3, wallH, dark(wall, 0.12));
  R(1, H - 4, W - 2, 4, '#b9bccb'); R(1, H - 1, W - 2, 1, '#8a8ea0');
  for (let x = 3; x < W - 3; x += 6) R(x, H - 3, 1, 2, '#9a9eae');
  for (const x of [1, W - 4]) R(x, wallY, 3, wallH - 4, trim);
  R(1, wallY + 2, W - 2, 2, trim);
  const doorX = (ctx.door != null ? ctx.door : Math.floor(ctx.w / 2)) * 16 + 3, doorW = 10, doorH = 16;
  // windows
  const winY = wallY + 8;
  const winXs = [];
  for (let x = 6; x + 10 <= W - 4; x += 16) if (Math.abs(x + 5 - (doorX + 5)) > 12) winXs.push(x);
  if (kind === 'shop') {
    // big display window + striped awning
    const wx = doorX - 22 > 4 ? doorX - 22 : doorX + 14;
    window_(ctx, wx, winY, 18, 11, trim, false);
    for (let i = 0; i < 4; i++) { const c = [L.wall, '#ffd24a', '#7cd96a'][i % 3]; R(wx + 1 + i * 4, winY + 8, 3, 2, col(c, '#ffd24a')); }
    ctx.awning = { x: Math.max(2, wx - 2), w: 24, y: winY };
    for (const x of winXs) if (x + 10 < wx - 1 || x > wx + 19) window_(ctx, x, winY, 8, 9, trim, true);
  } else {
    for (const x of winXs) { window_(ctx, x, winY, 8, 9, trim, true); flowerBox(ctx, x - 1, winY + 11, 10); }
  }
  door(ctx, doorX, H - 4 - doorH, doorW, doorH, doorC, trim);
  // roof: front slope from eave (wallY+2) up to the ridge, overhanging the walls
  const eave = wallY + 3, ridge = -26;
  PL([-3, eave, W + 3, eave, W - 3, ridge, 3, ridge], roof);
  for (let y = ridge + 3; y < eave; y += 4) {
    R(1, y, W - 2, 1, rLo);
    for (let x = ((y >> 2) & 1) * 3; x < W; x += 6) S(x, y + 2, rLo);
  }
  PL([-3, eave, W + 3, eave, W + 3, eave + 2, -3, eave + 2], rDk);
  R(3, ridge, W - 6, 2, rHi); R(4, ridge - 1, W - 8, 1, light(roof, 0.45));
  PL([W - 6, ridge, W - 3, ridge, W + 3, eave, W - 1, eave], rLo);
  // front gable over the door with a round window
  const gx = doorX + doorW / 2;
  PL([gx - 13, eave + 1, gx + 13, eave + 1, gx, eave - 20], wall);
  PL([gx - 15, eave + 2, gx - 12, eave + 2, gx, eave - 19, gx, eave - 23], trim);
  PL([gx + 15, eave + 2, gx + 12, eave + 2, gx, eave - 19, gx, eave - 23], dark(trim, 0.2));
  R(gx - 3, eave - 10, 6, 6, trim); R(gx - 2, eave - 9, 4, 4, '#9fd0f0'); S(gx - 2, eave - 9, '#ffffff'); R(gx - 1, eave - 11, 2, 1, trim);
  // shop awning (over the roof eave)
  if (ctx.awning) {
    const { x: awX, w: awW, y: wy } = ctx.awning;
    for (let i = 0; i < awW; i += 4) PL([awX + i, wy - 1, awX + i + 4, wy - 1, awX + i + 4, wy - 7, awX + i, wy - 7], (i >> 2) % 2 ? '#ffffff' : roof);
    for (let i = 0; i < awW; i += 4) { R(awX + i, wy - 1, 4, 1, (i >> 2) % 2 ? dark('#ffffff', 0.15) : rLo); R(awX + i + 1, wy, 2, 1, (i >> 2) % 2 ? '#ffffff' : roof); }
    R(awX, wy - 7, awW, 1, rLo);
  }
  // sign
  if (sign !== 'none') {
    const sx = doorX + doorW + 4 <= W - 12 ? doorX + doorW + 4 : doorX - 13;
    R(sx + 3, wallY + 5, 4, 1, '#3a3a4a'); R(sx + 3, wallY + 6, 1, 2, '#3a3a4a'); R(sx + 7, wallY + 6, 1, 2, '#3a3a4a');
    signIcon(ctx, sx + 1, wallY + 8, sign, '#f4e3c4');
  }
  // chimney
  const cx = (ctx.v & 1) ? W - 14 : 6;
  R(cx, ridge - 6, 7, 16, '#b8634a'); R(cx, ridge - 6, 7, 2, '#d47a5a'); R(cx + 5, ridge - 4, 2, 14, '#8a4a3a');
  ctx.emit.push({ kind: 'smoke', x: cx + 3.5, y: ridge - 8, color: '#f0f0f4' });
  if (kind === 'shop') ctx.emit.push({ kind: 'glow', x: doorX + 5, y: H - 12, color: '#ffe8a0', r: 1.4 });
}

function tower(ctx) {
  const { R, PL, S, E } = tools(ctx);
  const L = ctx.L, W = ctx.W, H = ctx.H;
  const wall = col(L.wall, '#d8dae4'), roof = col(L.roof, '#7a5ad9'), trim = col(L.trim, '#ffe066'), doorC = col(L.door, '#6b4423');
  const sign = SIGNS.includes(L.sign) ? L.sign : 'none';
  shadow(ctx, W / 2, H - 2, W / 2 + 2, 5);
  const x0 = 4, x1 = W - 4, top = -22;
  // cylinder body with vertical shading bands
  for (let x = x0; x < x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const c = t < 0.18 ? light(wall, 0.25) : t > 0.75 ? dark(wall, 0.28) : t > 0.6 ? dark(wall, 0.12) : wall;
    R(x, top, 1, H - top - 2, c);
  }
  E(W / 2, H - 2, (x1 - x0) / 2, 3, dark(wall, 0.3));
  for (let y = top + 6; y < H - 4; y += 7) for (let x = x0 + ((y / 7) & 1) * 4; x < x1; x += 8) R(x, y, 1, 3, dark(wall, 0.3));
  for (let y = top + 3; y < H - 4; y += 7) R(x0, y, x1 - x0, 1, dark(wall, 0.18));
  R(x0, top, x1 - x0, 3, trim); R(x0, top + 2, x1 - x0, 1, dark(trim, 0.3));
  window_(ctx, W / 2 - 3, top + 8, 6, 9, trim, true);
  window_(ctx, W / 2 - 3, top + 30, 6, 8, trim, true);
  door(ctx, Math.floor(ctx.w / 2) * 16 + 3, H - 18, 10, 14, doorC, trim);
  // conical roof
  const rLo = dark(roof, 0.3), rHi = light(roof, 0.25);
  PL([x0 - 5, top + 1, x1 + 5, top + 1, W / 2 + 1, top - 40, W / 2 - 1, top - 40], roof);
  PL([W / 2, top - 40, W / 2 + 1, top - 40, x1 + 5, top + 1, W / 2 + 8, top + 1], rLo);
  PL([W / 2 - 1, top - 40, x0 - 5, top + 1, x0 + 2, top + 1], rHi);
  for (let i = 1; i < 6; i++) { const y = top + 1 - i * 7, hw = (x1 - x0 + 10) / 2 * (1 - i / 6.2); R(W / 2 - hw, y, hw * 2, 1, rLo); }
  R(x0 - 5, top, x1 - x0 + 10, 2, dark(roof, 0.45));
  R(W / 2, top - 48, 1, 9, '#5a5a66'); PL([W / 2 + 1, top - 48, W / 2 + 9, top - 45, W / 2 + 1, top - 42], trim);
  S(W / 2, top - 49, trim);
  if (sign !== 'none') signIcon(ctx, W / 2 + 8, H - 26, sign, '#f4e3c4');
  ctx.emit.push({ kind: 'glow', x: W / 2, y: top + 12, color: '#ffe8a0', r: 1.1 });
}

function academy(ctx) {
  const { R, PL, S, E } = tools(ctx);
  const L = ctx.L, W = ctx.W, H = ctx.H;
  const wall = col(L.wall, '#f4ecd8'), roof = col(L.roof, '#3d5aa8'), trim = col(L.trim, '#ffd24a'), doorC = col(L.door, '#7a4e2c');
  const sign = SIGNS.includes(L.sign) ? L.sign : 'book';
  const rLo = dark(roof, 0.3), rHi = light(roof, 0.25), rDk = dark(roof, 0.5);
  const wLo = dark(wall, 0.18), wDk = dark(wall, 0.32), stone = '#b9bccb';
  shadow(ctx, W / 2, H - 1, W / 2 + 6, 6);
  const wallH = 56, wallY = H - wallH;
  const tw = 28; // side tower width
  // main hall wall
  R(tw - 4, wallY, W - 2 * tw + 8, wallH, wall);
  R(tw - 4, wallY, W - 2 * tw + 8, 3, trim); R(tw - 4, wallY + 3, W - 2 * tw + 8, 1, dark(trim, 0.3));
  R(tw - 4, H - 6, W - 2 * tw + 8, 6, stone); R(tw - 4, H - 1, W - 2 * tw + 8, 1, '#8a8ea0');
  // pilasters
  for (let x = tw + 4; x < W - tw - 4; x += 18) { R(x, wallY + 4, 4, wallH - 10, light(wall, 0.2)); R(x + 3, wallY + 4, 1, wallH - 10, wLo); }
  // two rows of arched windows
  for (let x = tw + 10; x + 8 < W - tw - 2; x += 18) {
    if (Math.abs(x + 4 - W / 2) < 16) continue;
    window_(ctx, x, wallY + 10, 7, 11, trim, true);
    window_(ctx, x, wallY + 32, 7, 12, trim, true);
  }
  // grand double door with steps and a crest above
  const dx = W / 2 - 11, dw = 22, dh = 26;
  R(dx - 4, H - 6 - dh - 8, dw + 8, dh + 8, wLo);
  PL([dx - 4, H - 6 - dh, dx + dw + 4, H - 6 - dh, W / 2, H - 6 - dh - 12], wLo);
  R(dx - 2, H - 6 - dh, dw + 4, dh, trim);
  PL([dx - 2, H - 6 - dh, dx + dw + 2, H - 6 - dh, W / 2, H - 6 - dh - 9], trim);
  R(dx, H - 6 - dh + 1, dw, dh - 1, doorC); PL([dx, H - 6 - dh + 1, dx + dw, H - 6 - dh + 1, W / 2, H - 6 - dh - 7], doorC);
  R(W / 2 - 1, H - 6 - dh - 6, 2, dh + 6, dark(doorC, 0.4));
  for (const x of [dx + 3, dx + dw - 6]) { R(x, H - 6 - dh + 4, 4, 8, light(doorC, 0.15)); R(x, H - 6 - dh + 15, 4, 8, light(doorC, 0.15)); }
  S(W / 2 - 3, H - 18, trim); S(W / 2 + 2, H - 18, trim);
  for (let i = 0; i < 3; i++) { R(dx - 6 - i * 2, H - 6 + i * 2, dw + 12 + i * 4, 2, i % 2 ? '#a3a7b8' : stone); }
  // tall central roof
  const eave = wallY + 1, ridge = -50;
  PL([tw - 8, eave, W - tw + 8, eave, W - tw - 2, ridge, tw + 2, ridge], roof);
  for (let y = ridge + 4; y < eave; y += 5) { R(tw - 4, y, W - 2 * tw + 8, 1, rLo); for (let x = tw + ((y / 5) & 1) * 3; x < W - tw; x += 6) S(x, y + 2, rLo); }
  R(tw + 2, ridge, W - 2 * tw - 4, 2, rHi); R(tw - 8, eave - 1, W - 2 * tw + 16, 2, rDk);
  // central gable with a clock / crest
  PL([W / 2 - 26, eave + 1, W / 2 + 26, eave + 1, W / 2, eave - 40], wall);
  PL([W / 2 - 29, eave + 2, W / 2 - 25, eave + 2, W / 2, eave - 38, W / 2, eave - 43], trim);
  PL([W / 2 + 29, eave + 2, W / 2 + 25, eave + 2, W / 2, eave - 38, W / 2, eave - 43], dark(trim, 0.2));
  E(W / 2, eave - 16, 8, 8, trim); E(W / 2, eave - 16, 6.5, 6.5, '#fffbe8');
  R(W / 2, eave - 21, 1, 5, '#2a2a3a'); R(W / 2, eave - 16, 4, 1, '#2a2a3a'); S(W / 2, eave - 16, '#c8503c');
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; S(W / 2 + Math.round(Math.cos(a) * 5.5), eave - 16 + Math.round(Math.sin(a) * 5.5), '#8a8ea0'); }
  if (sign !== 'none') signIcon(ctx, W / 2 - 4, eave - 4, sign, '#f4ecd8');
  // bell turret on the ridge
  R(W / 2 - 4, ridge - 14, 8, 14, wall); R(W / 2 - 3, ridge - 11, 6, 7, '#3a3a4a'); E(W / 2, ridge - 6, 2, 2, trim);
  PL([W / 2 - 7, ridge - 13, W / 2 + 7, ridge - 13, W / 2, ridge - 26], roof); PL([W / 2, ridge - 26, W / 2 + 7, ridge - 13, W / 2 + 2, ridge - 13], rLo);
  R(W / 2, ridge - 31, 1, 5, trim); S(W / 2, ridge - 32, '#ffffff');
  // side towers
  for (const side of [0, 1]) {
    const x0 = side ? W - tw : 0, x1 = x0 + tw;
    const top = wallY - 28;
    for (let x = x0; x < x1; x++) {
      const t = (x - x0) / tw;
      R(x, top, 1, H - top, t < 0.2 ? light(wall, 0.2) : t > 0.72 ? wDk : t > 0.55 ? wLo : wall);
    }
    for (let y = top + 6; y < H - 6; y += 8) R(x0, y, tw, 1, wLo);
    R(x0, H - 6, tw, 6, stone); R(x0, top, tw, 3, trim);
    window_(ctx, x0 + tw / 2 - 3, top + 10, 6, 10, trim, true);
    window_(ctx, x0 + tw / 2 - 3, top + 34, 6, 10, trim, true);
    window_(ctx, x0 + tw / 2 - 3, top + 58, 6, 10, trim, true);
    PL([x0 - 4, top + 1, x1 + 4, top + 1, x0 + tw / 2 + 1, top - 38, x0 + tw / 2 - 1, top - 38], roof);
    PL([x0 + tw / 2, top - 38, x1 + 4, top + 1, x0 + tw / 2 + 6, top + 1], rLo);
    PL([x0 + tw / 2 - 1, top - 38, x0 - 4, top + 1, x0 + 2, top + 1], rHi);
    for (let i = 1; i < 6; i++) { const y = top + 1 - i * 7, hw = (tw + 8) / 2 * (1 - i / 5.6); R(x0 + tw / 2 - hw, y, hw * 2, 1, rLo); }
    R(x0 - 4, top, tw + 8, 2, rDk);
    R(x0 + tw / 2, top - 46, 1, 9, '#5a5a66');
    PL([x0 + tw / 2 + 1, top - 46, x0 + tw / 2 + 10, top - 43, x0 + tw / 2 + 1, top - 40], side ? '#c8503c' : trim);
    ctx.emit.push({ kind: 'glow', x: x0 + tw / 2, y: top + 15, color: '#ffe8a0', r: 1.1 });
  }
  // ivy on the left tower base and flower beds
  for (let i = 0; i < 18; i++) { S(2 + (i * 5) % 22, H - 8 - ((i * 7) % 30), i % 3 ? '#3f9e4a' : '#5fb548'); }
  for (let x = tw; x < W - tw; x += 3) { if (Math.abs(x - W / 2) < 18) continue; S(x, H - 7, x % 2 ? '#4cbf55' : '#ff8fc7'); }
}

// ------------------------------------------------------------------ building styles (look.style, round 2)
// Simple, distinct 2D fallbacks of the 3D building styles. ctx.door = the door column (def.door).

export const STYLES = ['cottage', 'townhouse', 'tower_house', 'mushroom', 'windmill', 'greenhouse', 'bakery', 'library', 'potion',
  'outfitter', 'cafe', 'general', 'guardhouse', 'clock', 'arch'];
// headroom above the footprint per style (art px)
const STYLE_UP = { cottage: 30, townhouse: 52, tower_house: 76, mushroom: 30, windmill: 58, greenhouse: 18, bakery: 40, library: 52,
  potion: 78, outfitter: 48, cafe: 34, general: 36, guardhouse: 40, clock: 80 };

function doorX(ctx) { return (ctx.door != null ? ctx.door : Math.floor(ctx.w / 2)) * 16 + 3; }

function styled(ctx, style) {
  const { R, PL, S, E, SH } = tools(ctx);
  const L = ctx.L, W = ctx.W, H = ctx.H;
  const wall = col(L.wall, '#f4e3c4'), roof = col(L.roof, '#d9534f'), trim = col(L.trim, '#8a5a33'), doorC = col(L.door, '#6b4423');
  const sign = SIGNS.includes(L.sign) ? L.sign : 'none';
  const dx = doorX(ctx);
  const rLo = dark(roof, 0.3), rHi = light(roof, 0.25);
  shadow(ctx, W / 2, H - 1, W / 2 + 2, 4);
  const box = (x, y, w, h, c) => { R(x, y, w, h, c); R(x, y, w, 2, dark(c, 0.2)); R(x + w - 3, y, 3, h, dark(c, 0.12)); };
  const base = (x, w) => { R(x, H - 4, w, 4, '#b9bccb'); R(x, H - 1, w, 1, '#8a8ea0'); };
  const gable = (x0, x1, eave, ridge, c) => {
    PL([x0 - 3, eave, x1 + 3, eave, (x0 + x1) / 2, ridge], c);
    PL([(x0 + x1) / 2, ridge, x1 + 3, eave, (x0 + x1) / 2 + 4, eave], dark(c, 0.25));
    for (let y = ridge + 4; y < eave; y += 4) { const t = (y - ridge) / (eave - ridge); R((x0 + x1) / 2 - t * ((x1 - x0) / 2 + 3), y, t * (x1 - x0 + 6), 1, dark(c, 0.2)); }
  };
  const stripes = (x, y, w, c1, c2) => { for (let i = 0; i < w; i += 4) PL([x + i, y, x + i + 4, y, x + i + 4, y - 6, x + i, y - 6], (i >> 2) % 2 ? c2 : c1); };
  const hangSign = (x, y) => { if (sign !== 'none') { R(x + 3, y - 3, 4, 1, '#3a3a4a'); signIcon(ctx, x + 1, y, sign, '#f4e3c4'); } };
  switch (style) {
    case 'cottage': {
      const wy = H - 22;
      box(2, wy, W - 4, 22, wall); base(2, W - 4);
      SH(W / 2, wy - 2, W / 2 + 3, 15, roof, rLo, rHi);
      R(3, wy + 2, W - 6, 2, rLo);
      window_(ctx, dx > W / 2 ? 6 : W - 16, wy + 7, 8, 7, trim, false); flowerBox(ctx, dx > W / 2 ? 5 : W - 17, wy + 16, 10);
      door(ctx, dx, H - 18, 10, 14, doorC, trim);
      R(W - 12, wy - 22, 6, 10, '#a8a49a'); ctx.emit.push({ kind: 'smoke', x: W - 9, y: wy - 24, color: '#f0f0f4' });
      if ((L.variant | 0) === 1) for (let i = 0; i < 6; i++) { S(3, wy + 3 + i * 3, '#ff6b8a'); S(4, wy + 4 + i * 3, '#4f9e3a'); }
      break;
    }
    case 'townhouse': {
      const wy = H - 44;
      box(2, H - 22, W - 4, 22, mix(wall, '#d8d0c0', 0.35)); box(0, wy, W, 22, wall); base(2, W - 4);
      for (let x = 0; x <= W; x += W / 4) R(Math.min(W - 2, x), wy, 2, 22, trim);
      R(0, wy + 20, W, 3, trim); LNx(ctx, 4, wy + 18, W / 4 - 2, wy + 4, trim); LNx(ctx, W - 4, wy + 18, W - W / 4 + 2, wy + 4, trim);
      window_(ctx, W / 4 - 4, wy + 6, 8, 8, trim, false); window_(ctx, W - W / 4 - 4, wy + 6, 8, 8, trim, false);
      gable(0, W, wy + 1, wy - 26, roof);
      window_(ctx, dx > W / 2 ? 6 : W - 18, H - 16, 12, 7, trim, false);
      door(ctx, dx, H - 18, 10, 14, doorC, trim);
      break;
    }
    case 'tower_house':
    case 'clock':
    case 'potion': {
      tower(ctx);
      if (style === 'clock') {
        const cy = -10;
        E(W / 2, cy, 8, 8, col(L.trim, '#ffd24a')); E(W / 2, cy, 6.5, 6.5, '#fffbe8');
        R(W / 2, cy - 5, 1, 5, '#2a2a3a'); R(W / 2, cy, 4, 1, '#2a2a3a'); S(W / 2, cy, '#c8503c');
      } else if (style === 'potion') {
        // bent tip and a bubbling cauldron on the roof shoulder
        PL([W / 2, -64, W / 2 + 10, -70, W / 2 + 2, -58], roof);
        E(W - 8, -18, 6, 4, '#3a3a4a'); E(W - 8, -21, 5, 1.6, '#7cf07c');
        ctx.emit.push({ kind: 'smoke', x: W - 8, y: -24, color: '#d8c4ff' });
      } else {
        R(W / 2 + 6, -2, 5, 6, roof);
      }
      break;
    }
    case 'mushroom': {
      const wy = H - 20;
      SH(W / 2, wy + 9, W / 2 - 8, 12, wall, dark(wall, 0.2), light(wall, 0.3));
      SH(W / 2, wy - 6, W / 2 + 2, 14, roof, rLo, rHi);
      R(4, wy + 2, W - 8, 2, dark(wall, 0.35));
      for (const [x, y, r] of [[W / 2 - 10, wy - 12, 3], [W / 2 + 8, wy - 8, 4], [W / 2, wy - 16, 2.5], [W / 2 - 16, wy - 3, 2], [W / 2 + 15, wy - 2, 2]]) E(x, y, r, r * 0.7, col(L.trim, '#ffffff'));
      E(dx + 5, H - 9, 5, 7, doorC); R(dx, H - 9, 10, 6, doorC); S(dx + 8, H - 8, '#ffd24a');
      break;
    }
    case 'windmill': {
      const wy = H - 34;
      PL([8, H - 2, W - 8, H - 2, W - 14, wy, 14, wy], wall);
      PL([W - 14, wy, W - 8, H - 2, W - 13, H - 2], dark(wall, 0.15));
      E(W / 2, wy, 10, 6, roof);
      door(ctx, dx, H - 16, 9, 12, doorC, '#7a4e2c');
      const hx = W / 2, hy = wy + 2;
      for (const [ax, ay] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        LNx(ctx, hx, hy, hx + ax * 20, hy + ay * 20, '#7a4e2c');
        PL([hx + ax * 6, hy + ay * 6, hx + ax * 20, hy + ay * 20, hx + ax * 20 + ay * 5, hy + ay * 20 - ax * 5, hx + ax * 6 + ay * 4, hy + ay * 6 - ax * 4], col(L.trim, '#fffaf0'));
      }
      E(hx, hy, 3, 3, '#5a3a22');
      break;
    }
    case 'greenhouse': {
      const wy = H - 18;
      R(1, H - 5, W - 2, 5, '#c87a5a');
      R(1, wy, W - 2, 13, light(roof, 0.1)); for (let x = 1; x < W; x += 8) R(x, wy, 1, 13, '#ffffff'); R(1, wy + 6, W - 2, 1, '#ffffff');
      for (let x = 4; x < W - 4; x += 6) E(x, wy + 9, 3, 3, (x >> 1) % 2 ? '#4cbf55' : '#7cd96a');
      PL([1, wy, W - 1, wy, W - 4, wy - 10, 4, wy - 10], light(roof, 0.25));
      for (let x = 4; x < W - 2; x += 8) R(x, wy - 10, 1, 10, '#ffffff');
      R(4, wy - 11, W - 8, 1, '#ffffff');
      door(ctx, dx, H - 16, 9, 12, doorC, '#ffffff');
      break;
    }
    case 'library': {
      const wy = H - 30;
      box(1, wy, W - 2, 30, wall); base(1, W - 2);
      R(1, wy - 3, W - 2, 3, trim);
      for (const x of [6, W - 14]) window_(ctx, x, wy + 8, 8, 12, trim, true);
      const px = W / 2 - 18;
      PL([px - 2, wy + 2, px + 38, wy + 2, W / 2, wy - 10], light(wall, 0.15)); R(px - 2, wy + 2, 40, 2, trim);
      for (let i = 0; i < 4; i++) R(px + 2 + i * 10, wy + 4, 4, 22, '#ffffff');
      door(ctx, dx, H - 20, 12, 16, doorC, trim);
      SH(W / 2, wy - 14, 16, 14, roof, rLo, rHi); R(W / 2 - 17, wy - 14, 34, 14, dark(wall, 0.05)); SH(W / 2, wy - 16, 16, 12, roof, rLo, rHi);
      R(W / 2 - 1, wy - 34, 2, 6, trim); S(W / 2, wy - 35, '#ffffff');
      hangSign(W - 18, wy + 2);
      break;
    }
    case 'guardhouse': {
      const wy = H - 30;
      box(1, wy, W - 2, 30, wall); base(1, W - 2);
      for (let x = 1; x < W - 2; x += 8) R(x, wy - 5, 5, 5, wall);
      R(1, wy, W - 2, 2, dark(wall, 0.25));
      for (let y = wy + 6; y < H - 4; y += 6) R(2, y, W - 4, 1, dark(wall, 0.1));
      R(W - 12, wy - 16, 9, 30, light(wall, 0.05)); PL([W - 14, wy - 16, W - 1, wy - 16, W - 7.5, wy - 28], roof);
      for (const x of [8, W - 22]) R(x, wy + 8, 2, 8, '#2a2a3a');
      door(ctx, dx, H - 20, 11, 16, doorC, trim);
      hangSign(dx - 12, wy + 4);
      break;
    }
    default: {   // shops built on the generic building, plus a signature extra
      building(ctx, 'shop');
      const wy = H - 28;
      if (style === 'bakery') {
        E(-1, H - 10, 7, 9, '#c06e4c'); R(-3, wy - 34, 7, 34, '#c06e4c'); R(-3, wy - 34, 7, 2, '#d98a62');
        ctx.emit.push({ kind: 'smoke', x: 0.5, y: wy - 36, color: '#f4f0f8' });
      } else if (style === 'outfitter') {
        R(W - 26, wy + 6, 20, 14, light(roof, 0.3)); R(W - 24, wy + 8, 16, 10, '#9fd0f0'); R(W - 20, wy + 10, 3, 8, '#7a5ad9');
        PL([W / 2 - 8, -24, W / 2 + 8, -24, W / 2 + 2, -44], '#7a5ad9'); R(W / 2 - 12, -24, 24, 3, '#7a5ad9'); R(W / 2 - 8, -27, 16, 2, '#ffd24a');
      } else if (style === 'cafe') {
        for (const [x, c1] of [[W - 26, roof], [W - 10, '#ffd24a']]) {
          R(x, H - 14, 1, 14, '#5a5a66'); PL([x - 9, H - 14, x + 9, H - 14, x, H - 21], c1); PL([x - 3, H - 14, x + 3, H - 14, x, H - 21], '#ffffff');
          R(x - 4, H - 4, 8, 2, '#c98c50');
        }
      } else if (style === 'general') {
        for (let i = 0; i < 3; i++) { R(W - 12 + (i % 2) * 4, H - 10 - i * 7, 9, 8, '#d6a060'); R(W - 12 + (i % 2) * 4, H - 10 - i * 7, 9, 1, '#9a6a3a'); }
        E(6, H - 6, 5, 6, '#b0743d'); R(1, H - 8, 10, 1, '#5a5a66');
      }
    }
  }
}
function LNx(ctx, x0, y0, x1, y1, c) { tools(ctx).LN(x0, y0, x1, y1, c); }
