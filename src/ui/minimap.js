// Minimap (top-right, 168 px) and the big map (M). The static tile layer is built once per zone from the ZoneView
// (game.world.zoneView(), read-only) at 1 pixel per tile; blips come from HudState.minimap.
import { el, add, setText } from './dom.js';
import { hexToRgb, shade } from './format.js';

export const BLIP_COLORS = {
  enemy: '#ff4d4d', npc: '#ffe066', quest: '#ffd23f', exit: '#7fe0ff', companion: '#58d68d', shop: '#ff9ff3', boss: '#ff2d55', chest: '#ffb347',
};
const BLIP_ORDER = ['exit', 'shop', 'chest', 'npc', 'companion', 'enemy', 'boss', 'quest'];
const BUILDING = new Set(['house', 'shop', 'tower', 'academy']);
const SIZE = 168;
const SCALE = 3; // minimap pixels per tile

/** Color of one tile for the map layer (palette override, darker for solid blocks). */
export function tileColor(def, palette) {
  if (!def) return '#2a3a4a';
  const pat = palette && palette.patterns && palette.patterns[def.pattern];
  const a = (pat && pat.a) || (def.colors && def.colors.a) || '#7cc95a';
  if (def.shape === 'block') return shade(a, 0.28);
  if (def.shape === 'water') return a;
  return a;
}

/** Build the 1px-per-tile layer as RGBA bytes (pure; exported for tests). */
export function buildLayerPixels(zv) {
  const w = zv.w, h = zv.h;
  const px = new Uint8ClampedArray(w * h * 4);
  const cache = new Map();
  for (let i = 0; i < w * h; i++) {
    const t = zv.tiles[i];
    let c = cache.get(t);
    if (!c) { c = hexToRgb(tileColor(zv.tileDefs[t], zv.palette)); cache.set(t, c); }
    const v = zv.variant ? (zv.variant[i] & 7) - 3 : 0;
    px[i * 4] = c[0] + v; px[i * 4 + 1] = c[1] + v; px[i * 4 + 2] = c[2] + v; px[i * 4 + 3] = 255;
  }
  for (const p of zv.props || []) {
    const solid = p.def && p.def.solid && p.def.footprint;
    if (!solid) continue;
    const col = hexToRgb(BUILDING.has(p.kind) || (p.def && BUILDING.has(p.def.model))
      ? ((p.look && (p.look.roof || p.look.wall)) || '#b8634a') : '#5a7a4a');
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2];
    }
  }
  return px;
}

export function createMinimap(host, ctx) {
  const frame = el('div', 'minimap px-box dark');
  const cv = el('canvas', 'minimap-canvas pixel');
  cv.width = SIZE; cv.height = SIZE;
  const label = el('div', 'minimap-label');
  const zoneName = el('span', 'minimap-zone pxfont');
  const clock = el('span', 'minimap-clock');
  add(label, zoneName, clock);
  add(frame, cv, label);
  host.appendChild(frame);
  const g = cv.getContext('2d');

  // big map
  const big = el('div', 'bigmap');
  const bigBox = el('div', 'bigmap-box px-box');
  const bigTitle = el('div', 'bigmap-title pxfont');
  const bigCv = el('canvas', 'bigmap-canvas pixel');
  const legend = el('div', 'bigmap-legend');
  for (const t of ['quest', 'npc', 'shop', 'enemy', 'chest', 'exit', 'companion']) {
    const it = el('span', 'lg');
    const sw = el('i', 'lg-dot');
    sw.style.background = BLIP_COLORS[t];
    add(it, sw, el('span', null, t[0].toUpperCase() + t.slice(1)));
    legend.appendChild(it);
  }
  const bigHint = el('div', 'bigmap-hint');
  add(bigHint, el('span', 'keycap', 'M'), el('span', null, ' close'));
  add(bigBox, bigTitle, bigCv, legend, bigHint);
  big.appendChild(bigBox);
  big.hidden = true;
  host.parentNode.appendChild(big);
  const bg = bigCv.getContext('2d');

  let layer = null, zw = 0, zh = 0, zoneId = null, bigOpen = false;
  let lastPx = null, lastPy = null, angle = -Math.PI / 2;
  let lastHud = null;

  function rebuild(game) {
    const zv = game && game.world && game.world.zoneView ? game.world.zoneView() : null;
    if (!zv) { layer = null; return; }
    zw = zv.w; zh = zv.h; zoneId = zv.id;
    layer = document.createElement('canvas');
    layer.width = zw; layer.height = zh;
    const lg = layer.getContext('2d');
    const img = lg.createImageData(zw, zh);
    img.data.set(buildLayerPixels(zv));
    lg.putImageData(img, 0, 0);
    if (bigOpen) sizeBig();
  }

  function tileChanged(game, tx, ty) {
    if (!layer) return;
    const zv = game.world.zoneView();
    if (!zv) return;
    const c = tileColor(zv.tileDefs[zv.tiles[ty * zv.w + tx]], zv.palette);
    const lg = layer.getContext('2d');
    lg.fillStyle = c;
    lg.fillRect(tx, ty, 1, 1);
  }

  function drawBlips(c, hud, ox, oy, s, w, h, bigMode) {
    const mm = hud.minimap;
    if (!mm) return;
    const n = Math.min(mm.blipCount || 0, mm.blips ? mm.blips.length : 0);
    const t = performance.now() / 1000;
    for (const type of BLIP_ORDER) {
      for (let i = 0; i < n; i++) {
        const b = mm.blips[i];
        if (!b || b.type !== type) continue;
        const x = Math.round(ox + b.x * s), y = Math.round(oy + b.y * s);
        const r = (type === 'boss' ? 4 : type === 'quest' ? 4 : 3) * (bigMode ? 1.5 : 1);
        if (x < -r || y < -r || x > w + r || y > h + r) {
          if (type === 'quest') edgeArrow(c, x, y, w, h);
          continue;
        }
        c.fillStyle = '#1e1a22';
        if (type === 'quest') {
          const pulse = Math.floor(t * 3) % 2 ? 1 : 0;
          diamond(c, x, y, r + 1 + pulse, '#1e1a22'); diamond(c, x, y, r + pulse, BLIP_COLORS.quest);
        } else if (type === 'exit') {
          c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = BLIP_COLORS.exit; c.fillRect(x - r + 1, y - r + 1, r * 2 - 2, r * 2 - 2);
        } else {
          c.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2); c.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
          c.fillStyle = BLIP_COLORS[type] || '#fff';
          c.fillRect(x - r + 1, y - r + 1, r * 2 - 2, r * 2 - 2);
        }
      }
    }
  }

  function diamond(c, x, y, r, col) {
    c.fillStyle = col;
    for (let k = -r; k <= r; k++) { const w2 = r - Math.abs(k); c.fillRect(x - w2, y + k, w2 * 2 + 1, 1); }
  }

  function edgeArrow(c, x, y, w, h) {
    const cx = Math.max(6, Math.min(w - 6, x)), cy = Math.max(6, Math.min(h - 6, y));
    diamond(c, cx, cy, 4, '#1e1a22'); diamond(c, cx, cy, 3, BLIP_COLORS.quest);
  }

  function drawPlayer(c, x, y, size) {
    c.save();
    c.translate(x, y);
    c.rotate(angle + Math.PI / 2);
    c.fillStyle = '#1e1a22';
    c.beginPath(); c.moveTo(0, -size - 2); c.lineTo(size + 2, size + 2); c.lineTo(0, size * 0.4 + 1); c.lineTo(-size - 2, size + 2); c.closePath(); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -size); c.lineTo(size, size); c.lineTo(0, size * 0.4); c.lineTo(-size, size); c.closePath(); c.fill();
    c.restore();
  }

  function render(hud) {
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1b1420';
    g.fillRect(0, 0, SIZE, SIZE);
    const mm = hud.minimap || { px: 0, py: 0 };
    const ox = Math.round(SIZE / 2 - mm.px * SCALE), oy = Math.round(SIZE / 2 - mm.py * SCALE);
    if (layer) g.drawImage(layer, ox, oy, zw * SCALE, zh * SCALE);
    drawBlips(g, hud, ox, oy, SCALE, SIZE, SIZE, false);
    drawPlayer(g, SIZE / 2, SIZE / 2, 4);
  }

  function sizeBig() {
    if (!layer) return;
    const vw = host.parentNode.clientWidth || 800, vh = host.parentNode.clientHeight || 600;
    const maxW = Math.min(vw - 120, 720), maxH = Math.min(vh - 170, 640);
    let s = Math.max(1, Math.floor(Math.min(maxW / zw, maxH / zh)));
    if (s * zw > maxW || s * zh > maxH) s = Math.min(maxW / zw, maxH / zh);
    bigCv.width = Math.round(zw * s); bigCv.height = Math.round(zh * s);
    bigCv.__s = s;
  }

  function renderBig(hud) {
    if (!layer) return;
    const s = bigCv.__s || 1;
    bg.imageSmoothingEnabled = false;
    bg.drawImage(layer, 0, 0, bigCv.width, bigCv.height);
    drawBlips(bg, hud, 0, 0, s, bigCv.width, bigCv.height, true);
    const mm = hud.minimap || { px: 0, py: 0 };
    drawPlayer(bg, mm.px * s, mm.py * s, 6);
  }

  return {
    zoneChanged(game) { rebuild(game); },
    tileChanged,
    update(hud, game) {
      lastHud = hud;
      if (!layer || (game.zone && game.zone.id !== zoneId)) rebuild(game);
      const mm = hud.minimap;
      if (mm) {
        if (lastPx !== null) {
          const dx = mm.px - lastPx, dy = mm.py - lastPy;
          if (dx * dx + dy * dy > 0.0004) angle = Math.atan2(dy, dx);
        }
        lastPx = mm.px; lastPy = mm.py;
      }
      setText(zoneName, hud.zoneName || '');
      const hour = hud.hour;
      if (typeof hour === 'number') {
        const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60);
        const ap = h < 12 ? 'am' : 'pm';
        setText(clock, `${((h + 11) % 12) + 1}:${String(m - (m % 10)).padStart(2, '0')}${ap}`);
        clock.className = 'minimap-clock dp-' + (hud.daypart || 'day');
      }
      render(hud);
      if (bigOpen) { setText(bigTitle, hud.zoneName || 'Map'); renderBig(hud); }
    },
    isBigOpen() { return bigOpen; },
    toggleBig() { if (bigOpen) this.closeBig(); else this.openBig(); },
    openBig() {
      bigOpen = true; big.hidden = false; sizeBig();
      if (lastHud) { setText(bigTitle, lastHud.zoneName || 'Map'); renderBig(lastHud); }
      ctx.sfx && ctx.sfx('ui_ok');
    },
    closeBig() { bigOpen = false; big.hidden = true; ctx.sfx && ctx.sfx('ui_move'); },
    dispose() { frame.remove(); big.remove(); },
  };
}

export default createMinimap;
