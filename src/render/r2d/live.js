// Live-drawn visuals: effect-rig models (telegraphs, barrier, ground fire, portals...), persistent fxTags, auras,
// and prop emitters (chimney smoke, campfires, fountains, lamp glows). Everything is drawn at art resolution on
// the art canvas with fillRect / simple paths; particles go through the shared fx pool.
import { light, dark, mix, col } from './color.js';

const TAU = Math.PI * 2;
const ELEM = { rune_fire: '#ff8a3c', rune_frost: '#9fe6ff', rune_storm: '#c9a6ff' };

export function createLive(fx) {
  const PK = fx.PK;
  let t = 0, tPrev = 0, q = 1;
  const O = fx.opt;
  /** Number of emissions for rate (per s) between the previous and the current frame, per-entity phase. */
  const every = (rate, ph) => {
    if (rate <= 0) return 0;
    const n = Math.floor(t * rate + ph) - Math.floor(tPrev * rate + ph);
    return n > 4 ? 4 : n < 0 ? 0 : n;
  };
  const R = fx.rand;

  function frame(time, quality) { tPrev = t; t = time; if (t < tPrev || t - tPrev > 0.5) tPrev = t - 1 / 60; q = quality; }

  // ------------------------------------------------------------------ effect models
  /** Ground-layer effect models. X, Y: art px (feet). wx, wy: world art px. */
  function effectGround(g, v, look, X, Y, wx, wy) {
    const m = look.model, c = col(look.color, '#ff5a5a');
    const r = Math.max(0.2, look.r || 0.5) * 16;
    const at = v.animT || 0;
    switch (m) {
      case 'telegraph_circle': {
        const pulse = 0.5 + 0.5 * Math.sin(t * 14);
        g.globalAlpha = 0.24 + 0.1 * pulse; g.fillStyle = c; g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill();
        const pr = Math.min(1, at / 0.8);
        g.globalAlpha = 0.38; g.fillStyle = light(c, 0.15); g.beginPath(); g.arc(X, Y, Math.max(1, r * pr), 0, TAU); g.fill();
        g.globalAlpha = 1; g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(X, Y, r - 1, 0, TAU); g.stroke();
        g.globalAlpha = 0.5 + 0.5 * pulse; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(X, Y, Math.max(1, r * pr - 0.5), 0, TAU); g.stroke();
        // corner ticks
        g.globalAlpha = 0.9; g.fillStyle = light(c, 0.4);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * 1.5; g.fillRect(Math.round(X + Math.cos(a) * (r + 2)) - 1, Math.round(Y + Math.sin(a) * (r + 2)) - 1, 2, 2); }
        g.globalAlpha = 1;
        return true;
      }
      case 'telegraph_line': {
        const len = Math.max(0.3, look.len || 2) * 16, w = Math.max(0.2, look.w || 0.6) * 16;
        const pr = Math.min(1, at / 0.8), pulse = 0.5 + 0.5 * Math.sin(t * 14);
        g.save(); g.translate(X, Y); g.rotate(v.angle || 0);
        g.globalAlpha = 0.24 + 0.1 * pulse; g.fillStyle = c; g.fillRect(0, -w / 2, len, w);
        g.globalAlpha = 0.38; g.fillStyle = light(c, 0.15); g.fillRect(0, -w / 2, len * pr, w);
        g.globalAlpha = 1; g.strokeStyle = c; g.lineWidth = 1; g.strokeRect(0.5, -w / 2 + 0.5, len - 1, w - 1);
        g.globalAlpha = 0.6 + 0.4 * pulse; g.fillStyle = '#ffffff';
        for (let i = 1; i <= 3; i++) { const ax = ((len * (i / 4) + t * 30) % len); g.fillRect(ax, -1, 3, 1); g.fillRect(ax + 1, -2, 1, 3); }
        g.restore(); g.globalAlpha = 1;
        return true;
      }
      case 'telegraph_cone': {
        const len = Math.max(0.3, look.len || 1.8) * 16, arc = (look.arc || 90) * Math.PI / 180, a = v.angle || 0;
        const pr = Math.min(1, at / 0.8), pulse = 0.5 + 0.5 * Math.sin(t * 14);
        g.globalAlpha = 0.24 + 0.1 * pulse; g.fillStyle = c;
        g.beginPath(); g.moveTo(X, Y); g.arc(X, Y, len, a - arc / 2, a + arc / 2); g.closePath(); g.fill();
        g.globalAlpha = 0.38; g.fillStyle = light(c, 0.15); g.beginPath(); g.moveTo(X, Y); g.arc(X, Y, Math.max(1, len * pr), a - arc / 2, a + arc / 2); g.closePath(); g.fill();
        g.globalAlpha = 0.9; g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(X, Y); g.arc(X, Y, len - 0.5, a - arc / 2, a + arc / 2); g.closePath(); g.stroke();
        g.globalAlpha = 1;
        return true;
      }
      case 'ground_fire': {
        const cc = col(look.color, '#ff8a3c');
        g.globalAlpha = 0.22; g.fillStyle = dark(cc, 0.3); g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill();
        g.globalAlpha = 0.3; g.fillStyle = cc; g.beginPath(); g.arc(X, Y, r * 0.75, 0, TAU); g.fill();
        g.globalAlpha = 1;
        fx.glow(g, X, Y - 3, r * 1.4, cc, 0.5);
        const n = Math.max(3, Math.round(r * r / 22)) * (q === 0 ? 0.5 : 1);
        for (let i = 0; i < n; i++) {
          const a = i * 2.39996 + v.id, d = Math.sqrt((i + 0.5) / n) * r * 0.9;
          const fx0 = Math.round(X + Math.cos(a) * d), fy0 = Math.round(Y + Math.sin(a) * d);
          const h = 3 + Math.round(3 * (0.5 + 0.5 * Math.sin(t * 13 + i * 1.7)));
          g.fillStyle = '#e8402a'; g.fillRect(fx0 - 1, fy0 - h, 3, h);
          g.fillStyle = cc; g.fillRect(fx0 - 1, fy0 - h + 1, 2, h - 1);
          g.fillStyle = '#ffe066'; g.fillRect(fx0, fy0 - h + 2, 1, Math.max(1, h - 3));
        }
        for (let i = every(r * 0.6 * (q === 0 ? 0.4 : 1), v.id * 0.37); i > 0; i--) {
          const a = R() * TAU, d = Math.sqrt(R()) * r;
          fx.emit(PK.FLAME, wx + Math.cos(a) * d, wy + Math.sin(a) * d, 0, -20 - R() * 20, 0.4 + R() * 0.3, '#ffa040', 2, 1, O(0, 0, 0, 0, true, '#ff4a2a'));
        }
        return true;
      }
      case 'ground_frost': {
        const cc = col(look.color, '#9fe6ff');
        g.globalAlpha = 0.3; g.fillStyle = cc; g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill();
        g.globalAlpha = 0.5; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X - r * 0.2, Y - r * 0.2, r * 0.45, 0, TAU); g.fill();
        g.globalAlpha = 0.8; g.strokeStyle = light(cc, 0.3); g.lineWidth = 1; g.beginPath(); g.arc(X, Y, r - 0.5, 0, TAU); g.stroke();
        g.globalAlpha = 1;
        const n = Math.max(3, Math.round(r * r / 30));
        for (let i = 0; i < n; i++) {
          const a = i * 2.39996 + v.id, d = Math.sqrt((i + 0.5) / n) * r * 0.85;
          const x0 = Math.round(X + Math.cos(a) * d), y0 = Math.round(Y + Math.sin(a) * d);
          const h = 2 + (i % 3);
          g.fillStyle = dark(cc, 0.35); g.fillRect(x0 - 1, y0, 3, 1);
          g.fillStyle = light(cc, 0.3); g.fillRect(x0 - 1, y0 - h + 1, 1, h - 1); g.fillRect(x0 + 1, y0 - h + 2, 1, h - 2);
          g.fillStyle = cc; g.fillRect(x0, y0 - h, 1, h);
          g.fillStyle = '#ffffff'; g.fillRect(x0, y0 - h, 1, 1);
        }
        for (let i = every(r * 0.25, v.id * 0.53); i > 0; i--) { const a = R() * TAU, d = Math.sqrt(R()) * r; fx.emit(PK.STAR, wx + Math.cos(a) * d, wy + Math.sin(a) * d - 3, 0, -8, 0.7, '#ffffff', 1, 0, O(0, 0, 0, 0, true)); }
        return true;
      }
      case 'zone_ring': {
        const cc = col(look.color, '#7cf07c');
        g.globalAlpha = 0.12; g.fillStyle = cc; g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill();
        g.globalAlpha = 0.85; g.strokeStyle = cc; g.lineWidth = 1; g.beginPath(); g.arc(X, Y, r - 0.5, 0, TAU); g.stroke();
        g.globalAlpha = 0.5; g.beginPath(); g.arc(X, Y, r * 0.8, 0, TAU); g.stroke();
        g.globalAlpha = 1; g.fillStyle = light(cc, 0.4);
        const n = Math.max(6, Math.round(r / 3));
        for (let i = 0; i < n; i++) { const a = i / n * TAU + t * 0.8; const x0 = Math.round(X + Math.cos(a) * r * 0.9), y0 = Math.round(Y + Math.sin(a) * r * 0.9); g.fillRect(x0 - 1, y0, 3, 1); g.fillRect(x0, y0 - 1, 1, 3); }
        return true;
      }
      case 'portal': {
        const cc = col(look.color, '#c9a6ff');
        const ry = r * 1.25, rx = r * 0.8, cy = Y - ry;
        fx.glow(g, X, cy, r * 2.2, cc, 0.6);
        g.fillStyle = dark(cc, 0.55); g.beginPath(); g.ellipse(X, cy, rx + 2, ry + 2, 0, 0, TAU); g.fill();
        for (let i = 0; i < 4; i++) {
          const k = 1 - i * 0.22;
          g.fillStyle = i % 2 ? cc : light(cc, 0.3 + i * 0.1);
          g.beginPath(); g.ellipse(X + Math.sin(t * 3 + i) * 1.5, cy + Math.cos(t * 2.4 + i) * 1.5, rx * k, ry * k, 0, 0, TAU); g.fill();
        }
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(X, cy, rx * 0.18, ry * 0.25, 0, 0, TAU); g.fill();
        g.strokeStyle = '#ffffff'; g.lineWidth = 1;
        for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; g.beginPath(); g.ellipse(X, cy, rx * 0.7, ry * 0.7, 0, a, a + 1.2); g.stroke(); }
        for (let i = every(8 * (q === 0 ? 0.4 : 1), v.id * 0.29); i > 0; i--) { const a = R() * TAU; fx.emit(PK.STAR, wx + Math.cos(a) * rx * 1.4, wy - ry + Math.sin(a) * ry * 1.3, -Math.cos(a) * 18, -Math.sin(a) * 18, 0.8, i & 1 ? '#ffffff' : light(cc, 0.3), 1, 0, O(0, 0, 0, 0, true)); }
        return true;
      }
      case 'meteor': {
        // ground target that tightens as it falls
        const z = (v.z || 0) * 16, rr = Math.max(4, r * (1 + Math.min(2, z / 40)));
        g.globalAlpha = 0.3; g.fillStyle = '#ff5a2a'; g.beginPath(); g.arc(X, Y, rr, 0, TAU); g.fill();
        g.globalAlpha = 0.9; g.strokeStyle = '#ffe066'; g.lineWidth = 1; g.beginPath(); g.arc(X, Y, rr, 0, TAU); g.stroke();
        g.globalAlpha = 0.35; g.fillStyle = '#1e1a22'; g.beginPath(); g.ellipse(X, Y, r * 0.8, r * 0.5, 0, 0, TAU); g.fill();
        g.globalAlpha = 1;
        return false; // the rock itself is y-sorted
      }
      default: return false;
    }
  }

  /** Effects drawn over entities (translucent volumes). */
  function effectTop(g, v, look, X, Y, wx, wy) {
    const m = look.model, c = col(look.color, '#9fe6ff');
    const r = Math.max(0.2, look.r || 0.5) * 16;
    switch (m) {
      case 'barrier': {
        const H = Math.max(20, Math.min(48, r * 0.7));
        const sh = 0.5 + 0.5 * Math.sin(t * 3);
        g.globalAlpha = 0.14; g.fillStyle = c;
        g.beginPath(); g.ellipse(X, Y, r, r, 0, 0, Math.PI); g.lineTo(X - r, Y - H); g.ellipse(X, Y - H, r, r, 0, Math.PI, 0, true); g.closePath(); g.fill();
        g.globalAlpha = 0.85; g.strokeStyle = c; g.lineWidth = 1;
        g.beginPath(); g.ellipse(X, Y, r, r, 0, 0, TAU); g.stroke();
        g.globalAlpha = 0.5 + 0.3 * sh; g.strokeStyle = light(c, 0.4);
        g.beginPath(); g.ellipse(X, Y - H, r, r, 0, Math.PI, TAU); g.stroke();
        g.globalAlpha = 0.35; g.beginPath(); g.ellipse(X, Y - H, r, r, 0, 0, Math.PI); g.stroke();
        // vertical shimmer bands on the front face
        g.globalCompositeOperation = 'source-over';
        const n = Math.max(8, Math.round(r / 5));
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI + (t * 0.3 % (Math.PI / n));
          const x0 = Math.round(X + Math.cos(a) * r), y0 = Y + Math.sin(a) * r;
          const hh = H * (0.5 + 0.5 * Math.sin(t * 2 + i));
          g.globalAlpha = 0.35; g.fillStyle = c; g.fillRect(x0, Math.round(y0 - hh), 1, Math.round(hh));
          const hy = Math.round(y0 - ((t * 20 + i * 13) % H));
          g.globalAlpha = 0.9; g.fillStyle = '#ffffff'; g.fillRect(x0, hy, 1, 2);
        }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        return;
      }
      case 'shield_bubble': {
        const cy = Y - Math.min(r, 14);
        const pulse = 0.5 + 0.5 * Math.sin(t * 5);
        g.globalAlpha = 0.16 + 0.06 * pulse; g.fillStyle = c; g.beginPath(); g.arc(X, cy, r, 0, TAU); g.fill();
        g.globalAlpha = 0.85; g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.arc(X, cy, r - 0.5, 0, TAU); g.stroke();
        g.globalAlpha = 0.9; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(X, cy, r * 0.75, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
        g.globalAlpha = 1;
        for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.1; g.fillStyle = '#ffffff'; g.fillRect(Math.round(X + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }
        return;
      }
      case 'smoke': case 'decoy_puff': {
        const cc = col(look.color, m === 'smoke' ? '#b8b4c8' : '#e8e4f0');
        const n = m === 'smoke' ? Math.max(5, Math.round(r / 3)) : 6;
        const fade = m === 'decoy_puff' ? Math.max(0, 1 - (v.animT || 0) / 1.2) : 1;
        for (let i = 0; i < n; i++) {
          const a = i * 2.39996 + t * 0.4 * (i & 1 ? 1 : -1), d = (0.25 + 0.7 * ((i * 0.618) % 1)) * r * (m === 'decoy_puff' ? 0.6 : 1);
          const px = X + Math.cos(a) * d, py = Y - 6 + Math.sin(a) * d * 0.7;
          const rr = (m === 'smoke' ? 6 : 5) + 2 * Math.sin(t * 2 + i);
          g.globalAlpha = 0.7 * fade; g.fillStyle = i % 3 ? cc : light(cc, 0.3);
          g.beginPath(); g.arc(Math.round(px), Math.round(py), rr, 0, TAU); g.fill();
          g.globalAlpha = 0.4 * fade; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(Math.round(px - 2), Math.round(py - 2), rr * 0.4, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
        if (m === 'smoke') for (let i = every(r * 0.35 * (q === 0 ? 0.4 : 1), v.id * 0.71); i > 0; i--) { const a = R() * TAU, d = Math.sqrt(R()) * r; fx.emit(PK.PUFF, wx + Math.cos(a) * d, wy - 4 + Math.sin(a) * d * 0.7, 0, -6, 1.2, cc, 3, 8, O(0, 0, 0, 0, false)); }
        return;
      }
      default: return;
    }
  }

  /** Standing rune seal (y-sorted). */
  function runeSeal(g, v, look, X, Y) {
    const c = col(look.color, '#c9a6ff');
    const r = Math.max(0.5, look.r || 1) * 16;
    const cy = Y - r - 2;
    fx.glow(g, X, cy, r * 2, c, 0.55);
    g.globalAlpha = 0.25; g.fillStyle = c; g.beginPath(); g.arc(X, cy, r, 0, TAU); g.fill();
    g.globalAlpha = 1; g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(X, cy, r - 1, 0, TAU); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.arc(X, cy, r * 0.72, 0, TAU); g.stroke();
    // two counter-rotating squares and a keyhole: a "sealed" sign
    g.strokeStyle = light(c, 0.4);
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let i = 0; i <= 4; i++) { const a = i * Math.PI / 2 + (k ? -t * 0.4 : t * 0.4 + Math.PI / 4); const px = X + Math.cos(a) * r * 0.62, py = cy + Math.sin(a) * r * 0.62; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X, cy - 2, 2.5, 0, TAU); g.fill(); g.fillRect(Math.round(X) - 1, Math.round(cy - 1), 3, 5);
    g.fillStyle = dark(c, 0.3); g.fillRect(Math.round(X), Math.round(cy - 2), 1, 4);
    // rune glyphs around the rim
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - t * 0.6; const px = Math.round(X + Math.cos(a) * r * 0.86), py = Math.round(cy + Math.sin(a) * r * 0.86); g.fillRect(px - 1, py - 1, 2, 3); g.fillRect(px, py - 2, 1, 1); }
    // base glow on the ground
    g.globalAlpha = 0.35; g.fillStyle = c; g.beginPath(); g.ellipse(X, Y, r * 0.9, r * 0.35, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
    return 12;
  }

  // ------------------------------------------------------------------ fxTags
  /** Tags drawn under the sprite (ground). */
  function tagsUnder(g, v, X, Y, wx, wy) {
    const tags = v.fxTags;
    for (let i = 0; i < tags.length; i++) {
      const tg = tags[i];
      if (ELEM[tg]) {
        const c = ELEM[tg], rr = 12;
        g.globalAlpha = 0.85; g.strokeStyle = c; g.lineWidth = 1;
        g.beginPath(); g.ellipse(X, Y, rr, rr * 0.55, 0, 0, TAU); g.stroke();
        g.globalAlpha = 1; g.fillStyle = light(c, 0.4);
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + t * 2; g.fillRect(Math.round(X + Math.cos(a) * rr), Math.round(Y + Math.sin(a) * rr * 0.55), 2, 1); }
        fx.glow(g, X, Y, 14, c, 0.35);
        if (tg === 'rune_fire') for (let k = every(6, v.id * 0.13); k > 0; k--) fx.emit(PK.FLAME, wx + (R() - 0.5) * 20, wy, 0, -25, 0.4, '#ffa040', 2, 1, O(0, 0, 0, 0, true, '#ff4a2a'));
        if (tg === 'rune_frost') for (let k = every(4, v.id * 0.13); k > 0; k--) fx.emit(PK.SNOW, wx + (R() - 0.5) * 22, wy - 4, 0, -10, 0.8, '#ffffff', 1, 1, O(0, 0, 0, 0, true));
        if (tg === 'rune_storm') for (let k = every(5, v.id * 0.13); k > 0; k--) fx.emit(PK.SPARK, wx + (R() - 0.5) * 20, wy - 2, (R() - 0.5) * 60, -30 - R() * 30, 0.2, '#ffffff', 1, 1, O(0, 0, 0, 2, true));
      } else if (tg === 'summoned') {
        g.globalAlpha = 0.6 + 0.3 * Math.sin(t * 4 + v.id); g.strokeStyle = '#5ff0d0'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(X, Y, 9, 4, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
      } else if (tg === 'haste') {
        if (v.moving) for (let k = every(14, v.id * 0.21); k > 0; k--) fx.emit(PK.SQ, wx + (R() - 0.5) * 10, wy - 2 - R() * 4, -Math.cos(v.angle) * 30, -Math.sin(v.angle) * 30, 0.25, '#ffe680', 1, 0, O(0, 0, 0, 0, true));
        fx.glow(g, X, Y - 2, 12, '#ffe680', 0.25 + 0.15 * Math.sin(t * 10));
      } else if (tg === 'ki') {
        fx.glow(g, X, Y - 12, 22, '#ffd24a', 0.35 + 0.15 * Math.sin(t * 3));
      } else if (tg === 'shadow') {
        g.globalAlpha = 0.4; g.fillStyle = '#3a1a5a'; g.beginPath(); g.ellipse(X, Y, 12, 5, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
      }
    }
  }

  /** Tags drawn over the sprite. top: art y of the sprite top (head). */
  function tagsOver(g, v, X, Y, top, wx, wy, hgt) {
    const tags = v.fxTags;
    const wtop = wy - (Y - top);
    for (let i = 0; i < tags.length; i++) {
      const tg = tags[i];
      switch (tg) {
        case 'burn':
          for (let k = every(16 * (q === 0 ? 0.4 : 1), v.id * 0.31); k > 0; k--) fx.emit(PK.FLAME, wx + (R() - 0.5) * 14, wy - R() * hgt * 0.8, (R() - 0.5) * 6, -28 - R() * 20, 0.35 + R() * 0.2, R() < 0.5 ? '#ffa040' : '#ffe066', 2, 1, O(0, 0, 0, 0, true, '#ff4a2a'));
          fx.glow(g, X, Y - hgt * 0.4, hgt * 0.7, '#ff8a3c', 0.3 + 0.2 * Math.sin(t * 17 + v.id));
          break;
        case 'frost':
          for (let k = every(5, v.id * 0.31); k > 0; k--) fx.emit(PK.SNOW, wx + (R() - 0.5) * 18, wtop + R() * hgt, 0, 6, 0.7, R() < 0.5 ? '#ffffff' : '#9fe6ff', 1, 1, O(0, 0, 0, 0, true));
          g.fillStyle = '#9fe6ff'; g.fillRect(X - 7, Y - 2, 3, 2); g.fillRect(X + 4, Y - 3, 2, 3); g.fillStyle = '#ffffff'; g.fillRect(X - 6, Y - 3, 1, 1); g.fillRect(X + 4, Y - 4, 1, 1);
          break;
        case 'stun': {
          for (let k = 0; k < 3; k++) {
            const a = t * 5 + k * TAU / 3, sx = Math.round(X + Math.cos(a) * 8), sy = Math.round(top - 3 + Math.sin(a) * 3);
            g.fillStyle = '#1e1a22'; g.fillRect(sx - 2, sy - 1, 5, 3); g.fillRect(sx - 1, sy - 2, 3, 5);
            g.fillStyle = '#ffe066'; g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3);
            g.fillStyle = '#ffffff'; g.fillRect(sx, sy, 1, 1);
          }
          break;
        }
        case 'shield': {
          const rr = Math.max(10, hgt * 0.62), cy = Y - hgt * 0.45;
          g.globalAlpha = 0.18 + 0.06 * Math.sin(t * 6); g.fillStyle = '#9fe6ff'; g.beginPath(); g.arc(X, cy, rr, 0, TAU); g.fill();
          g.globalAlpha = 0.9; g.strokeStyle = '#bff4ff'; g.lineWidth = 1; g.beginPath(); g.arc(X, cy, rr, 0, TAU); g.stroke();
          g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(X, cy, rr * 0.75, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
          g.globalAlpha = 1;
          break;
        }
        case 'mark': {
          const rr = 6 + Math.sin(t * 6) * 1.5, cy = Y - hgt * 0.5, a0 = t * 2;
          g.strokeStyle = '#ff3a4a'; g.lineWidth = 1;
          g.beginPath(); g.arc(X, cy, rr, 0, TAU); g.stroke();
          g.fillStyle = '#ff3a4a';
          for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2; g.fillRect(Math.round(X + Math.cos(a) * (rr + 2)) - 1, Math.round(cy + Math.sin(a) * (rr + 2)) - 1, 2, 2); }
          g.fillStyle = '#ffffff'; g.fillRect(X, Math.round(cy), 1, 1);
          break;
        }
        case 'frenzy':
          fx.glow(g, X, Y - hgt * 0.45, hgt * 0.8, '#ff2a3a', 0.35 + 0.2 * Math.sin(t * 12));
          for (let k = every(10, v.id * 0.17); k > 0; k--) fx.emit(PK.SPARK, wx + (R() - 0.5) * 16, wy - R() * hgt, 0, -60, 0.25, '#ff4a4a', 1, 1, O(0, 0, 0, 0, true));
          break;
        case 'charge': {
          const pulse = 0.5 + 0.5 * Math.sin(t * 20);
          const growth = Math.min(1, (v.animT || 0) / 0.8);
          fx.glow(g, X, Y - hgt * 0.5, 8 + 14 * growth, '#ffe680', 0.4 + 0.4 * pulse * growth);
          for (let k = every(18 * (q === 0 ? 0.4 : 1), v.id * 0.41); k > 0; k--) { const a = R() * TAU, d = 16 + R() * 8; fx.emit(PK.SQ, wx + Math.cos(a) * d, wy - hgt * 0.5 + Math.sin(a) * d, -Math.cos(a) * d * 3.2, -Math.sin(a) * d * 3.2, 0.3, R() < 0.5 ? '#ffffff' : '#ffe680', 1, 0, O(0, 0, 0, 0, true)); }
          break;
        }
        case 'venom':
          for (let k = every(6, v.id * 0.23); k > 0; k--) fx.emit(PK.BUBBLE, wx + (R() - 0.5) * 14, wy - R() * hgt * 0.6, 0, -18, 0.6, '#9be84a', 1, 1, O(0, 0, 0, 0, false));
          break;
        case 'ki':
          for (let k = every(8, v.id * 0.23); k > 0; k--) fx.emit(PK.SQ, wx + (R() - 0.5) * 18, wy - R() * 6, 0, -40 - R() * 20, 0.6, R() < 0.5 ? '#ffe680' : '#ffffff', 1, 0, O(0, 0, 0, 0, true));
          break;
        case 'shadow':
          for (let k = every(9, v.id * 0.23); k > 0; k--) fx.emit(PK.PUFF, wx + (R() - 0.5) * 14, wy - R() * hgt * 0.7, 0, -14, 0.6, '#3a1a5a', 2, 4, O(0, 0, 0, 0, false));
          break;
        case 'wanted': {
          const by = Math.round(top - 8 + Math.sin(t * 6) * 1.5);
          g.fillStyle = '#1e1a22'; g.fillRect(X - 2, by - 8, 5, 9); g.fillRect(X - 2, by + 2, 5, 4);
          g.fillStyle = '#ff3a3a'; g.fillRect(X - 1, by - 7, 3, 7); g.fillRect(X - 1, by + 3, 3, 2);
          g.fillStyle = '#ffffff'; g.fillRect(X - 1, by - 7, 1, 2);
          break;
        }
        case 'levelup_ready': {
          const by = Math.round(top - 6 - ((t * 10) % 6));
          g.fillStyle = '#1e1a22'; g.fillRect(X - 4, by - 1, 9, 5); g.fillRect(X - 2, by - 3, 5, 9);
          g.fillStyle = '#ffd24a'; g.fillRect(X - 3, by + 1, 7, 1); g.fillRect(X - 2, by, 5, 1); g.fillRect(X - 1, by - 1, 3, 1); g.fillRect(X - 1, by + 2, 3, 3); g.fillRect(X, by - 2, 1, 1);
          fx.glow(g, X, by + 1, 8, '#ffd24a', 0.6);
          break;
        }
        case 'sleep':
          for (let k = every(1.6, v.id * 0.11); k > 0; k--) fx.emit(PK.Z, wx + 6, wtop - 2, 8, -12, 1.4, '#ffffff', 1, 1, O(0, 0, 0, 0, false));
          break;
        default: break;
      }
    }
  }

  // ------------------------------------------------------------------ auras
  function aura(g, v, a, X, Y, wx, wy, hgt, under) {
    const c = col(a.color, '#ffe680');
    const st = a.style;
    if (under) {
      if (st === 'glow' || st === 'sparkle') fx.glow(g, X, Y - hgt * 0.45, hgt * 0.9, c, 0.35 + 0.15 * Math.sin(t * 3 + v.id));
      else if (st === 'flame') { fx.glow(g, X, Y - hgt * 0.35, hgt * 0.8, c, 0.4 + 0.15 * Math.sin(t * 13)); }
      else if (st === 'shadow') { g.globalAlpha = 0.45; g.fillStyle = dark(c, 0.3); g.beginPath(); g.ellipse(X, Y, 13, 5, 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
      else if (st === 'frost') { g.globalAlpha = 0.6; g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.ellipse(X, Y, 12, 5, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; fx.glow(g, X, Y - hgt * 0.4, hgt * 0.7, c, 0.25); }
      else if (st === 'storm') fx.glow(g, X, Y - hgt * 0.45, hgt * 0.8, c, 0.25 + 0.25 * (Math.sin(t * 23) > 0.6 ? 1 : 0));
      return;
    }
    const k = q === 0 ? 0.3 : q === 1 ? 0.7 : 1;
    switch (st) {
      case 'flame':
        for (let i = every(22 * k, v.id * 0.19); i > 0; i--) { const s = R() < 0.5 ? -1 : 1; fx.emit(PK.FLAME, wx + s * (5 + R() * 5), wy - R() * hgt * 0.6, -s * 4, -40 - R() * 25, 0.45, R() < 0.4 ? '#fff4c0' : c, 2, 1, O(0, 0, 0, 0, true, dark(c, 0.3))); }
        break;
      case 'sparkle':
        for (let i = every(9 * k, v.id * 0.19); i > 0; i--) fx.emit(PK.STAR, wx + (R() - 0.5) * 26, wy - R() * hgt * 1.1, 0, -8, 0.8, R() < 0.5 ? '#ffffff' : c, 2, 0, O(0, 0, 0, 0, true));
        break;
      case 'glow':
        for (let i = every(5 * k, v.id * 0.19); i > 0; i--) fx.emit(PK.SQ, wx + (R() - 0.5) * 20, wy - R() * 6, 0, -22, 0.9, light(c, 0.3), 1, 0, O(0, 0, 0, 0, true));
        break;
      case 'shadow':
        for (let i = every(14 * k, v.id * 0.19); i > 0; i--) fx.emit(PK.PUFF, wx + (R() - 0.5) * 18, wy - R() * hgt * 0.8, 0, -16, 0.7, R() < 0.5 ? c : dark(c, 0.4), 2, 4, O(0, 0, 0, 0, false));
        break;
      case 'frost':
        for (let i = every(8 * k, v.id * 0.19); i > 0; i--) { const a = R() * TAU; fx.emit(PK.SNOW, wx + Math.cos(a) * 12, wy - hgt * 0.5 + Math.sin(a) * hgt * 0.5, -Math.cos(a) * 4, 8, 0.9, R() < 0.5 ? '#ffffff' : c, 1, 1, O(0, 0, 0, 0, true)); }
        break;
      case 'storm': {
        if (Math.floor(t * 9 + v.id) % 3 === 0) {
          const a = (Math.floor(t * 9) * 2.4) % TAU, x0 = X + Math.cos(a) * 10, y0 = Y - hgt * 0.5 + Math.sin(a) * hgt * 0.4;
          g.globalCompositeOperation = 'source-over'; g.strokeStyle = '#ffffff'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(Math.round(x0), Math.round(y0)); g.lineTo(Math.round(x0 + 3), Math.round(y0 + 3)); g.lineTo(Math.round(x0 - 1), Math.round(y0 + 5)); g.lineTo(Math.round(x0 + 2), Math.round(y0 + 9)); g.stroke();
          g.strokeStyle = c; g.beginPath(); g.moveTo(Math.round(x0) + 1, Math.round(y0)); g.lineTo(Math.round(x0 + 4), Math.round(y0 + 3)); g.stroke();
          g.globalCompositeOperation = 'source-over';
        }
        for (let i = every(6 * k, v.id * 0.19); i > 0; i--) fx.emit(PK.SPARK, wx + (R() - 0.5) * 20, wy - R() * hgt, (R() - 0.5) * 40, -20, 0.2, c, 1, 1, O(0, 0, 0, 0, true));
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------ prop emitters
  function emitter(g, e, X, Y, wx, wy, evening) {
    switch (e.kind) {
      case 'glow':
        if (evening) fx.glow(g, X, Y, (e.r || 1.4) * 15, e.color, 0.55 + 0.08 * Math.sin(t * 3 + wx), true);
        else fx.glow(g, X, Y, (e.r || 1.4) * 6, e.color, 0.3 + 0.05 * Math.sin(t * 3 + wx));
        return;
      case 'smoke':
        for (let k = every(1.6 * (q === 0 ? 0.5 : 1), wx * 0.013); k > 0; k--) fx.emit(PK.PUFF, wx + (R() - 0.5) * 2, wy, 3 + R() * 4, -9 - R() * 4, 2.6, R() < 0.5 ? '#f0f0f4' : '#d8d8e4', 2, 6, O(0, 0, 0, 0.1, false));
        return;
      case 'flame': {
        for (let k = every(18 * (q === 0 ? 0.4 : 1), wx * 0.013); k > 0; k--) fx.emit(PK.FLAME, wx + (R() - 0.5) * 6, wy, (R() - 0.5) * 4, -24 - R() * 18, 0.4 + R() * 0.25, R() < 0.4 ? '#ffe066' : e.color, 3, 1, O(0, 0, 0, 0, true, '#ff4a2a'));
        const h = 4 + Math.round(2 * Math.sin(t * 15));
        g.fillStyle = '#ff5a2a'; g.fillRect(X - 3, Y - h, 6, h); g.fillStyle = e.color; g.fillRect(X - 2, Y - h - 2, 4, h + 1); g.fillStyle = '#ffe066'; g.fillRect(X - 1, Y - h, 2, h - 1);
        return;
      }
      case 'twinkle':
        for (let k = every(1.2, wx * 0.013); k > 0; k--) fx.emit(PK.STAR, wx + (R() - 0.5) * 14, wy + (R() - 0.5) * 14, 0, -4, 0.8, e.color, 2, 0, O(0, 0, 0, 0, true));
        return;
      case 'fountain':
        for (let k = every(16 * (q === 0 ? 0.4 : 1), wx * 0.013); k > 0; k--) { const a = R() * TAU; fx.emit(PK.SQ, wx, wy, Math.cos(a) * 14, Math.sin(a) * 6, 0.9, R() < 0.5 ? '#ffffff' : light(e.color, 0.3), 1, 1, O(0, 40 + R() * 10, -100, 0, false)); }
        return;
      case 'ripple':
        if (every(0.8, wx * 0.017)) { const s = 0; void s; fx.emit(PK.STAR, wx + (R() - 0.5) * 30, wy + (R() - 0.5) * 14, 0, 0, 0.6, '#ffffff', 1, 0, O(0, 0, 0, 0, true)); }
        return;
      case 'bubbles':
        for (let k = every(4, wx * 0.013); k > 0; k--) fx.emit(PK.BUBBLE, wx + (R() - 0.5) * 9, wy, 0, -12, 0.6, light(e.color, 0.3), 1, 1, O(0, 0, 0, 0, false));
        return;
      default: return;
    }
  }

  return { frame, effectGround, effectTop, runeSeal, tagsUnder, tagsOver, aura, emitter, every, mix };
}
