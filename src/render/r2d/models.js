// Projectile sprites (pointing east, centered) and the static pickup / chest / totem effect sprites.
// Ground and aura effects (barrier, telegraphs, fire, portals...) are drawn live by fx.js.
import { Pix } from './pix.js';
import { dark, light, mix, col, OUTLINE } from './color.js';

export const PROJECTILES = ['bolt', 'arrow', 'orb', 'fireball', 'shuriken', 'knife', 'wave', 'crescent', 'rock', 'spore', 'spark',
  'ice', 'kunai', 'axe', 'coin'];
export const EFFECTS = ['barrier', 'telegraph_circle', 'telegraph_line', 'telegraph_cone', 'ground_fire', 'ground_frost',
  'zone_ring', 'rune_seal', 'shield_bubble', 'caltrops', 'smoke', 'portal', 'meteor', 'chest', 'chest_open', 'rune_chest',
  'gold', 'heart', 'item', 'xp_orb', 'stick', 'totem', 'decoy_puff'];
/** Effects drawn from a cached sprite (others are live-drawn). */
export const SPRITE_EFFECTS = { chest: 1, chest_open: 1, rune_chest: 1, gold: 1, heart: 1, item: 1, xp_orb: 1, stick: 1, totem: 1, meteor: 1, caltrops: 1 };
/** Projectiles that spin instead of pointing along their angle. */
export const SPINNERS = { shuriken: 1, axe: 1, coin: 1, rock: 1 };
/** Projectiles that keep upright (no rotation). */
export const ROUND = { orb: 1, spore: 1, spark: 1 };

/** -> {pix, ax, ay, glow: [[x, y, color, r]]}; frame: 0..1 flicker */
export function paintProjectile(look, frame) {
  const k = Math.max(0.5, Math.min(3, look.size || 1));
  const m = PROJECTILES.includes(look.model) ? look.model : 'bolt';
  const c = col(look.color, '#ffe066'), g = col(look.glow, light(c, 0.5));
  const S = Math.ceil(20 * k) + 4;
  const p = new Pix(S, S);
  const cx = S / 2, cy = S / 2;
  const glow = [];
  const lo = dark(c, 0.3), hi = light(c, 0.45);
  const L = (x0, y0, x1, y1, col2) => p.line(Math.round(cx + x0 * k), Math.round(cy + y0 * k), Math.round(cx + x1 * k), Math.round(cy + y1 * k), col2);
  let outline = true;
  switch (m) {
    case 'bolt': {
      p.ellipse(cx, cy, 6 * k, 2 * k, c); p.ellipse(cx + 1 * k, cy, 4 * k, 1.1 * k, hi); p.ellipse(cx + 2 * k, cy, 2 * k, 0.6 * k, '#ffffff');
      glow.push([cx, cy, g, 1 * k]); break;
    }
    case 'arrow': {
      L(-7, 0, 5, 0, '#a0703c'); L(-7, 1, 4, 1, '#7a4e2c');
      p.poly([cx + 4 * k, cy - 2.5 * k, cx + 8 * k, cy + 0.5, cx + 4 * k, cy + 3 * k], '#d8dee8');
      p.set(Math.round(cx + 5 * k), Math.round(cy), '#ffffff');
      for (const s of [-1, 1]) { L(-8, s * 2, -5, 0, c); L(-7, s * 2, -4, 0, c); }
      break;
    }
    case 'orb': {
      p.shaded(cx, cy, 4 * k, 4 * k, c, lo, '#ffffff', 0.35, 0.45); p.ellipse(cx - 1.4 * k, cy - 1.4 * k, 1.1 * k, 1.1 * k, '#ffffff');
      glow.push([cx, cy, g, 1.5 * k]); break;
    }
    case 'fireball': {
      p.poly([cx - 8 * k, cy + (frame ? -1 : 1) * k, cx - 1 * k, cy - 4.5 * k, cx + 1 * k, cy + 4.5 * k], '#ff5a2a');
      p.poly([cx - 6 * k, cy + (frame ? 1 : -1) * k, cx - 1 * k, cy - 3 * k, cx, cy + 3 * k], '#ffa040');
      p.shaded(cx + 1.5 * k, cy, 4.2 * k, 4.2 * k, '#ffa040', '#e8502a', '#ffe680', 0.4, 0.3);
      p.ellipse(cx + 2.4 * k, cy - 0.6 * k, 1.8 * k, 1.6 * k, '#fffbe0');
      glow.push([cx + 1 * k, cy, '#ff8a3c', 1.6 * k]); break;
    }
    case 'shuriken': {
      const mc = c === '#ffe066' ? '#c8ccd8' : c;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + (frame ? Math.PI / 4 : 0), ca = Math.cos(a), sa = Math.sin(a);
        p.poly([cx + ca * 6 * k, cy + sa * 6 * k, cx - sa * 1.8 * k, cy + ca * 1.8 * k, cx + sa * 1.8 * k, cy - ca * 1.8 * k], i % 2 ? mc : light(mc, 0.35));
      }
      p.ellipse(cx, cy, 1.4 * k, 1.4 * k, dark(mc, 0.45)); break;
    }
    case 'knife': case 'kunai': {
      const mc = c === '#ffe066' ? '#d8dee8' : c;
      L(-6, 0, -2, 0, m === 'kunai' ? '#3a3a4a' : '#6b4423');
      if (m === 'kunai') { p.ellipse(cx - 7 * k, cy, 1.4 * k, 1.4 * k, '#3a3a4a'); p.set(Math.round(cx - 7 * k), Math.round(cy), 0); }
      p.poly([cx - 2 * k, cy - 1.6 * k, cx + 6 * k, cy, cx - 2 * k, cy + 1.6 * k], mc);
      L(-1, 0, 5, 0, light(mc, 0.5)); L(-2, -2, -2, 2, '#ffd24a'); break;
    }
    case 'wave': {
      for (let i = 0; i < 3; i++) for (let y = -6; y <= 6; y++) {
        const x = Math.round(cx + (2 - i * 3) * k + Math.abs(y) * 0.45 * k);
        p.set(x, Math.round(cy + y * k), i === 0 ? '#ffffff' : i === 1 ? hi : c);
        p.set(x - 1, Math.round(cy + y * k), i === 0 ? hi : c);
      }
      glow.push([cx, cy, g, 1.3 * k]); outline = false; break;
    }
    case 'crescent': {
      for (let y = -7; y <= 7; y++) {
        const t = 1 - (y * y) / 49;
        const xo = Math.round(cx + 4 * k * t), w = Math.max(1, Math.round(3 * k * t));
        for (let i = 0; i < w; i++) p.set(xo - i, Math.round(cy + y * k), i === 0 ? '#ffffff' : i === 1 ? hi : c);
      }
      glow.push([cx + 2 * k, cy, g, 1.4 * k]); outline = false; break;
    }
    case 'rock': {
      p.shaded(cx, cy, 4 * k, 3.4 * k, '#a8957a', '#7a6a55', '#d0c0a8'); p.set(Math.round(cx + 1), Math.round(cy + 1), '#6a5a48'); break;
    }
    case 'spore': {
      const sc = c === '#ffe066' ? '#c8e66a' : c;
      p.shaded(cx, cy, 3.6 * k, 3.6 * k, sc, dark(sc, 0.3), light(sc, 0.5));
      for (const [x, y] of [[-4, -3], [4, 2], [-2, 4], [3, -4]]) p.set(Math.round(cx + x * k), Math.round(cy + y * k), light(sc, 0.3));
      glow.push([cx, cy, sc, 1 * k]); break;
    }
    case 'spark': {
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + (frame ? 0.4 : 0); L(0, 0, Math.cos(a) * 5, Math.sin(a) * 5, i % 2 ? c : '#ffffff'); }
      p.ellipse(cx, cy, 1.6 * k, 1.6 * k, '#ffffff');
      glow.push([cx, cy, g, 1.2 * k]); outline = false; break;
    }
    case 'ice': {
      const ic = c === '#ffe066' ? '#9fe6ff' : c;
      p.poly([cx - 6 * k, cy, cx, cy - 2.8 * k, cx + 7 * k, cy, cx, cy + 2.8 * k], ic);
      p.poly([cx, cy - 2.8 * k, cx + 7 * k, cy, cx, cy], light(ic, 0.5)); L(-4, 0, 6, 0, '#ffffff');
      glow.push([cx, cy, ic, 1 * k]); break;
    }
    case 'axe': {
      const mc = c === '#ffe066' ? '#c8ccd8' : c;
      L(-5, 4, 5, -4, '#7a4e2c'); L(-4, 4, 5, -3, '#5a3a22');
      p.poly([cx + 1 * k, cy - 3 * k, cx + 7 * k, cy - 7 * k, cx + 8 * k, cy - 1 * k, cx + 4 * k, cy + 1 * k], mc);
      L(7, -6, 8, -1, light(mc, 0.5)); break;
    }
    case 'coin': {
      const gc = c === '#ffe066' ? '#ffd24a' : c;
      const rx = frame ? 1.6 * k : 3.8 * k;
      p.shaded(cx, cy, rx, 3.8 * k, gc, dark(gc, 0.3), light(gc, 0.5)); if (!frame) p.rect(Math.round(cx), Math.round(cy - 2 * k), 1, Math.round(4 * k), dark(gc, 0.3));
      glow.push([cx, cy, gc, 0.8 * k]); break;
    }
    default: break;
  }
  if (outline) p.outline(OUTLINE);
  return { pix: p, ax: S / 2, ay: S / 2, glow };
}

/** Static effect sprites (pickups, chests, totem, meteor rock). -> {pix, ax, ay (feet), glow} */
export function paintEffectSprite(look, frame) {
  const m = look.model;
  const c = col(look.color, '#ffe066');
  const glow = [];
  let p;
  let ax, ay;
  switch (m) {
    case 'chest': case 'chest_open': case 'rune_chest': {
      p = new Pix(24, 24); ax = 12; ay = 21;
      const wood = '#b0743d', wl = '#8a5a33', metal = m === 'rune_chest' ? '#c9a6ff' : '#ffd24a';
      if (m === 'chest_open') {
        p.rect(4, 6, 16, 6, dark(wood, 0.2)); p.rect(5, 7, 14, 4, '#3a2a20');
        p.rect(4, 12, 16, 8, wood); p.rect(4, 19, 16, 1, wl); p.rect(6, 12, 2, 8, metal); p.rect(16, 12, 2, 8, metal);
        p.rect(4, 3, 16, 4, light(wood, 0.15)); p.rect(4, 3, 16, 1, light(wood, 0.4));
        p.rect(8, 9, 2, 2, '#ffd24a'); p.rect(12, 10, 3, 1, '#ffe680');
      } else {
        p.rect(4, 11, 16, 9, wood); p.rect(4, 19, 16, 1, wl); p.rect(18, 11, 2, 9, wl);
        p.rect(4, 6, 16, 6, light(wood, 0.15)); p.rect(5, 5, 14, 1, light(wood, 0.35)); p.rect(4, 11, 16, 1, dark(wood, 0.35));
        p.rect(6, 5, 2, 15, metal); p.rect(16, 5, 2, 15, metal); p.rect(10, 10, 4, 4, metal); p.set(11, 12, '#3a2a20'); p.set(12, 12, '#3a2a20');
        if (m === 'rune_chest') { p.set(9, 15, '#9fe6ff'); p.set(14, 16, '#9fe6ff'); p.set(11, 7, '#ffffff'); glow.push([12, 12, '#c9a6ff', 1.3]); }
      }
      break;
    }
    case 'gold': {
      p = new Pix(14, 14); ax = 7; ay = 12;
      const gc = c === '#ffe066' ? '#ffd24a' : c;
      const rx = [3.5, 2.5, 1.2, 2.5][frame & 3];
      p.shaded(7, 7, rx, 3.5, gc, dark(gc, 0.3), light(gc, 0.55));
      if (rx > 2) p.rect(7, 5, 1, 4, dark(gc, 0.3));
      glow.push([7, 7, gc, 0.6]);
      break;
    }
    case 'heart': {
      p = new Pix(14, 14); ax = 7; ay = 12;
      const hc = c === '#ffe066' ? '#ff5a7a' : c;
      p.ellipse(5, 5.5, 2.6, 2.6, hc); p.ellipse(9, 5.5, 2.6, 2.6, hc); p.poly([2.5, 6, 11.5, 6, 7, 11], hc);
      p.set(4, 4, '#ffffff'); p.set(4, 5, light(hc, 0.5)); p.rect(9, 7, 2, 1, dark(hc, 0.3));
      glow.push([7, 7, hc, 0.6]);
      break;
    }
    case 'item': {
      p = new Pix(14, 16); ax = 7; ay = 14;
      const bc = c === '#ffe066' ? '#c98c50' : c;
      p.shaded(7, 9, 4.6, 4.2, bc, dark(bc, 0.3), light(bc, 0.3)); p.rect(5, 4, 5, 2, dark(bc, 0.2)); p.rect(4, 3, 7, 1, '#ffd24a');
      p.set(6, 9, '#ffd24a'); p.set(7, 8, '#ffe680');
      glow.push([7, 8, '#ffe680', 0.6]);
      break;
    }
    case 'xp_orb': {
      p = new Pix(12, 12); ax = 6; ay = 10;
      const oc = c === '#ffe066' ? '#7cf07c' : c;
      p.shaded(6, 6, 3.4, 3.4, oc, dark(oc, 0.3), '#ffffff', 0.35, 0.4); p.set(5, 4, '#ffffff');
      glow.push([6, 6, oc, 0.9]);
      break;
    }
    case 'stick': {
      p = new Pix(22, 10); ax = 11; ay = 8;
      p.line(2, 7, 19, 3, '#a0703c'); p.line(2, 8, 19, 4, '#7a4e2c'); p.line(9, 5, 7, 2, '#a0703c'); p.set(6, 1, '#7cc95a'); p.set(7, 1, '#9ee07a'); p.set(19, 3, '#c8a070');
      break;
    }
    case 'totem': {
      p = new Pix(18, 34); ax = 9; ay = 32;
      const tc = c === '#ffe066' ? '#c98c50' : c;
      const lo = dark(tc, 0.3), hi = light(tc, 0.25);
      p.rect(4, 6, 10, 26, tc); p.rect(12, 6, 2, 26, lo); p.rect(4, 6, 1, 26, hi);
      for (const y of [8, 17, 26]) { p.rect(6, y, 2, 2, '#2a1a10'); p.rect(10, y, 2, 2, '#2a1a10'); p.rect(7, y + 4, 4, 1, '#2a1a10'); p.set(6, y, '#ffe066'); }
      p.rect(1, 13, 16, 3, light(tc, 0.1)); p.rect(1, 15, 16, 1, lo);
      p.poly([4, 6, 14, 6, 9, 0], '#5fb548'); p.set(9, 2, '#ffe066');
      glow.push([9, 4, '#ffe066', 0.7]);
      break;
    }
    case 'meteor': {
      p = new Pix(26, 26); ax = 13; ay = 13;
      p.shaded(13, 13, 7, 6.5, '#8a6a55', '#5a4038', '#c09a80');
      p.ellipse(11, 10, 2, 1.6, '#ffa040'); p.ellipse(16, 15, 1.6, 1.2, '#ff5a2a'); p.set(9, 15, '#ffe066');
      glow.push([13, 13, '#ff8a3c', 1.8]);
      break;
    }
    case 'caltrops': {
      const r = Math.max(0.4, look.r || 0.8);
      const S = Math.ceil(r * 32) + 6;
      p = new Pix(S, S); ax = S / 2; ay = S / 2;
      const mc = c === '#ffe066' ? '#a8b0bc' : c;
      const n = Math.round(4 + r * 8);
      for (let i = 0; i < n; i++) {
        const a = i * 2.39996, d = Math.sqrt((i + 0.5) / n) * r * 15;
        const x = Math.round(ax + Math.cos(a) * d), y = Math.round(ay + Math.sin(a) * d * 0.8);
        p.set(x, y, dark(mc, 0.3)); p.set(x - 1, y, mc); p.set(x + 1, y, mc); p.set(x, y - 1, light(mc, 0.5)); p.set(x, y + 1, mc);
      }
      break;
    }
    default: {
      p = new Pix(12, 12); ax = 6; ay = 10; p.shaded(6, 6, 4, 4, c, dark(c, 0.3), light(c, 0.4));
    }
  }
  p.outline(OUTLINE);
  return { pix: p, ax, ay, glow };
}

export function effectFrames(model) { return model === 'gold' ? 4 : 1; }
export { mix };
