// Shared overlay canvas (#overlay) over both renderers: floating damage / crit / heal / xp / gold numbers (pooled),
// speech bubbles attached to entities, nameplates + small HP bars for damaged enemies and nearby NPCs, and the
// interact prompt ("E Talk") above its entity. Everything is positioned with renderer.project(). The canvas is
// cleared and redrawn only while something is (or just was) visible.
//
// Inputs: addText(fxEvent) for every FxEvent of type 'text' (fed by the UI from each FrameState), render(frame, hud).

import { config } from '../config.js';

const FONT_PX = '"Press Start 2P", ui-monospace, monospace';
const FONT_BODY = '"Pixelify Sans", ui-monospace, monospace';
const OUT = '#1e1a22';
const POOL = 48;
const BUBBLES = 8;

// Round 2: bigger numbers (damage 18, crit 26) with a dark outline.
const STYLE = {
  dmg: { size: 18, color: '#ffffff', dur: 0.85, rise: 1.0 },
  crit: { size: 26, color: '#ffd23f', dur: 1.1, rise: 1.25 },
  heal: { size: 18, color: '#7dff9a', dur: 1.0, rise: 1.0 },
  xp: { size: 14, color: '#c9a6ff', dur: 1.3, rise: 1.3 },
  gold: { size: 14, color: '#ffd166', dur: 1.2, rise: 1.1 },
  miss: { size: 14, color: '#c8ccd8', dur: 0.8, rise: 0.8 },
  info: { size: 14, color: '#ffffff', dur: 1.6, rise: 0.9 },
};

/** Characters and creatures are drawn config.modelScale times bigger in the 3D renderer only. */
export const MODEL_SCALE_3D = config.modelScale || 1;

/** Head height in tiles for an entity view, from its look rig and size. */
export function headHeight(v, mul = 1) {
  const look = v.look || {};
  const size = (look.size || 1) * (v.scale || 1);
  const rig = look.rig || 'humanoid';
  const base = rig === 'humanoid' ? 1.55 : rig === 'quadruped' ? 0.95 : rig === 'blob' ? 0.85 : rig === 'flyer' ? 1.45
    : rig === 'plant' ? 1.15 : rig === 'golem' ? 1.75 : 0.6;
  return base * size * mul + (v.z || 0);
}

/** Text shown for a floating number (prefixes by style). */
export function floatText(style, text) {
  const t = String(text ?? '');
  if (style === 'heal' && /^\d/.test(t)) return '+' + t;
  if (style === 'xp' && /^\d+$/.test(t)) return '+' + t + ' XP';
  if (style === 'gold' && /^\d+$/.test(t)) return '+' + t + 'g';
  if (style === 'crit' && /^\d+$/.test(t)) return t + '!';
  return t;
}

export function createWorldOverlay(canvas, ctx = {}) {
  const g = canvas.getContext('2d');
  let renderer = null;
  let w = 0, h = 0;
  let drewLast = false;
  let hmul = 1; // head height multiplier of the current renderer (3D scales models)
  const pt = { x: 0, y: 0, on: false };
  const tops = new Map(); // entity id -> screen y above its nameplate / prompt (this frame)

  const pool = [];
  for (let i = 0; i < POOL; i++) pool.push({ on: false, x: 0, y: 0, z: 0, text: '', style: 'dmg', t0: 0, dur: 1, rise: 1, size: 12, color: '#fff', dx: 0 });
  let poolNext = 0;
  const bubbles = [];
  for (let i = 0; i < BUBBLES; i++) bubbles.push({ on: false, ent: null, x: 0, y: 0, lines: [], t0: 0, dur: 3, wmax: 0 });

  function resize() {
    const p = canvas.parentElement;
    if (!p) return;
    const nw = p.clientWidth | 0, nh = p.clientHeight | 0;
    if (nw !== w || nh !== h) {
      w = nw; h = nh;
      canvas.width = w; canvas.height = h;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      drewLast = true;
    }
  }

  function measureLines(text, maxW) {
    g.font = `bold 16px ${FONT_BODY}`;
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '', wmax = 0;
    for (const word of words) {
      const t = line ? line + ' ' + word : word;
      if (line && g.measureText(t).width > maxW) { lines.push(line); wmax = Math.max(wmax, g.measureText(line).width); line = word; } else line = t;
    }
    if (line) { lines.push(line); wmax = Math.max(wmax, g.measureText(line).width); }
    return { lines: lines.slice(0, 4), wmax };
  }

  const api = {
    setRenderer(r) { renderer = r; hmul = r && r.id === '3d' ? MODEL_SCALE_3D : 1; resize(); },
    resize,

    /** Feed one FxEvent of type 'text' ({x, y, z, text, style, ent}). */
    addText(fx, now = performance.now()) {
      const style = fx.style || 'dmg';
      if (style === 'bubble') {
        let b = fx.ent != null ? bubbles.find((q) => q.on && q.ent === fx.ent) : null;
        if (!b) b = bubbles.find((q) => !q.on) || bubbles.reduce((a, q) => (q.t0 < a.t0 ? q : a));
        const m = measureLines(fx.text, 220);
        b.on = true; b.ent = fx.ent; b.x = fx.x; b.y = fx.y; b.lines = m.lines; b.wmax = m.wmax; b.t0 = now;
        b.dur = (fx.dur > 0 ? fx.dur : 2.2 + String(fx.text || '').length * 0.045) * 1000;
        return;
      }
      const s = STYLE[style] || STYLE.info;
      const o = pool[poolNext];
      poolNext = (poolNext + 1) % POOL;
      o.on = true; o.x = fx.x; o.y = fx.y; o.z = fx.z || 0; o.ent = fx.ent;
      o.text = floatText(style, fx.text); o.style = style; o.t0 = now;
      o.dur = (fx.dur > 0 ? fx.dur : s.dur) * 1000; o.rise = s.rise; o.size = s.size; o.color = fx.color || s.color;
      o.dx = ((poolNext * 37) % 9 - 4) * 0.06;
    },

    /** Draw everything for this rendered frame. Returns true when something was drawn. */
    render(frame, hud, now = performance.now()) {
      if (!renderer || !frame) return false;
      resize();
      let any = false;
      for (let i = 0; i < POOL; i++) if (pool[i].on) { any = true; break; }
      for (let i = 0; i < BUBBLES && !any; i++) if (bubbles[i].on) any = true;
      const prompt = hud && hud.prompt;
      let playerV = null;
      const n = frame.entCount || 0;
      if (!any) {
        for (let i = 0; i < n; i++) {
          const v = frame.ents[i];
          if (v.type === 'player') playerV = v;
          if ((v.type === 'enemy' && v.hpFrac < 1 && v.hpFrac > 0) || v.type === 'npc') { any = true; break; }
        }
        if (prompt) any = true;
      }
      if (!any) {
        if (drewLast) { g.clearRect(0, 0, w, h); drewLast = false; }
        if (ctx.onPromptPlaced) ctx.onPromptPlaced(prompt || null);
        return false;
      }
      g.clearRect(0, 0, w, h);
      drewLast = true;
      const alpha = frame.alpha ?? 1;
      if (!playerV) for (let i = 0; i < n; i++) if (frame.ents[i].type === 'player') { playerV = frame.ents[i]; break; }
      const ppx = playerV ? playerV.px + (playerV.x - playerV.px) * alpha : (hud && hud.minimap ? hud.minimap.px : 0);
      const ppy = playerV ? playerV.py + (playerV.y - playerV.py) * alpha : (hud && hud.minimap ? hud.minimap.py : 0);
      let promptPlaced = false;
      tops.clear();

      // nameplates and HP bars
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      for (let i = 0; i < n; i++) {
        const v = frame.ents[i];
        const isEnemyHurt = v.type === 'enemy' && v.hpFrac < 1 && v.hpFrac > 0;
        const isPrompt = prompt && prompt.entId === v.id;
        let near = false;
        if (v.type === 'npc' || (v.type === 'companion' && v.hpFrac < 1)) {
          const dx = v.x - ppx, dy = v.y - ppy;
          near = dx * dx + dy * dy < 4.5 * 4.5;
        }
        if (!isEnemyHurt && !near && !isPrompt) continue;
        const x = v.px + (v.x - v.px) * alpha, y = v.py + (v.y - v.py) * alpha;
        renderer.project(x, y, headHeight(v, hmul) + 0.15, pt);
        if (pt.x < -80 || pt.y < -40 || pt.x > w + 80 || pt.y > h + 80) continue;
        let top = Math.round(pt.y);
        const cx = Math.round(pt.x);
        if (isEnemyHurt || (v.type === 'companion' && near)) {
          drawHpBar(cx, top, v.hpFrac, v.type === 'enemy');
          top -= 10;
        }
        if ((near || (isEnemyHurt && v.name)) && v.name && !isPrompt) {
          drawName(cx, top - 3, v.name, v.type === 'enemy' ? '#ffb4a8' : v.team === 'town' && hud && hud.player && hud.player.wanted ? '#ff8a7a' : '#fff6df');
          top -= 20;
        }
        if (isPrompt) {
          if (v.name) { drawName(cx, top - 2, v.name, '#fff6df'); top -= 20; }
          drawPrompt(cx, top - 4, prompt, now);
          promptPlaced = true;
          top -= 36;
        }
        tops.set(v.id, top);
      }
      if (ctx.onPromptPlaced) ctx.onPromptPlaced(prompt && !promptPlaced ? prompt : null);

      // speech bubbles
      for (let i = 0; i < BUBBLES; i++) {
        const b = bubbles[i];
        if (!b.on) continue;
        const age = now - b.t0;
        if (age > b.dur) { b.on = false; continue; }
        let bx = b.x, by = b.y, hh = 1.6;
        if (b.ent != null) {
          let found = null;
          for (let k = 0; k < n; k++) if (frame.ents[k].id === b.ent) { found = frame.ents[k]; break; }
          if (!found) continue;
          bx = found.px + (found.x - found.px) * alpha; by = found.py + (found.y - found.py) * alpha; hh = headHeight(found, hmul);
        }
        renderer.project(bx, by, hh + 0.35, pt);
        const top = b.ent != null && tops.has(b.ent) ? Math.min(pt.y, tops.get(b.ent) + 4) : pt.y;
        const a = age < 120 ? age / 120 : age > b.dur - 250 ? (b.dur - age) / 250 : 1;
        drawBubble(Math.round(pt.x), Math.round(top), b, a);
      }

      // floating numbers
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      for (let i = 0; i < POOL; i++) {
        const o = pool[i];
        if (!o.on) continue;
        const age = now - o.t0;
        if (age > o.dur) { o.on = false; continue; }
        const k = age / o.dur;
        const rise = o.rise * (1 - (1 - k) * (1 - k));
        renderer.project(o.x + o.dx * k * 4, o.y, o.z + 1.2 + rise, pt);
        let size = o.size;
        if (o.style === 'crit') size = Math.round(o.size * (k < 0.12 ? 1 + (0.12 - k) * 5 : 1));
        g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        g.font = `${size}px ${FONT_PX}`;
        const x = Math.round(pt.x), y = Math.round(pt.y);
        g.fillStyle = OUT;
        g.fillText(o.text, x + 2, y + 2);
        g.lineWidth = size >= 20 ? 6 : 5;
        g.strokeStyle = OUT;
        g.strokeText(o.text, x, y);
        g.fillStyle = o.color;
        g.fillText(o.text, x, y);
      }
      g.globalAlpha = 1;
      return true;
    },

    clear() { for (const o of pool) o.on = false; for (const b of bubbles) b.on = false; g.clearRect(0, 0, w, h); drewLast = false; },
    dispose() { api.clear(); renderer = null; },
  };

  function drawHpBar(cx, y, f, enemy) {
    const bw = 44, bh = 8;
    const x = cx - bw / 2;
    g.fillStyle = OUT;
    g.fillRect(x - 1, y - 1, bw + 2, bh + 2);
    g.fillStyle = '#3a2a3a';
    g.fillRect(x, y, bw, bh);
    g.fillStyle = enemy ? (f < 0.3 ? '#ff8a3a' : '#ef5a4c') : '#58d68d';
    g.fillRect(x, y, Math.max(1, Math.round(bw * f)), bh);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(x, y, Math.max(1, Math.round(bw * f)), 2);
  }

  function drawName(cx, y, name, color) {
    g.font = `bold 16px ${FONT_BODY}`;
    g.textBaseline = 'alphabetic';
    g.lineWidth = 4;
    g.strokeStyle = OUT;
    g.strokeText(name, cx, y);
    g.fillStyle = color;
    g.fillText(name, cx, y);
  }

  function drawPrompt(cx, y, pr, now) {
    const bob = Math.floor(now / 300) % 2;
    const key = pr.key || 'E';
    const text = pr.text || '';
    g.font = `bold 17px ${FONT_BODY}`;
    const tw = Math.ceil(g.measureText(text).width);
    const kw = 28, pad = 7;
    const W = kw + pad * 3 + tw, H = 32;
    const x = Math.round(cx - W / 2), yy = Math.round(y - H - bob);
    // notched parchment box with outline + hard shadow
    box(x, yy, W, H, '#f7e6c4');
    // key cap
    g.fillStyle = OUT;
    g.fillRect(x + pad - 1, yy + 3, kw + 2, H - 6);
    g.fillStyle = '#fffaf0';
    g.fillRect(x + pad, yy + 4, kw, H - 10);
    g.fillStyle = '#d9c7a4';
    g.fillRect(x + pad, yy + H - 6, kw, 2);
    g.fillStyle = '#3b2a1e';
    g.font = `10px ${FONT_PX}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(key.length > 2 ? key.slice(0, 1) : key, x + pad + kw / 2, yy + H / 2 - 1);
    g.font = `bold 17px ${FONT_BODY}`;
    g.textAlign = 'left';
    g.fillText(text, x + pad * 2 + kw, yy + H / 2);
    g.textAlign = 'center';
    // little tail
    g.fillStyle = OUT;
    g.fillRect(cx - 3, yy + H, 6, 3);
    g.fillRect(cx - 1, yy + H + 3, 2, 2);
  }

  function box(x, y, W, H, fill) {
    g.fillStyle = 'rgba(20,10,10,0.45)';
    g.fillRect(x + 3, y + 3, W, H);
    g.fillStyle = OUT;
    g.fillRect(x + 2, y, W - 4, H);
    g.fillRect(x, y + 2, W, H - 4);
    g.fillStyle = fill;
    g.fillRect(x + 2, y + 2, W - 4, H - 4);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(x + 2, y + 2, W - 4, 2);
  }

  function drawBubble(cx, y, b, a) {
    const lh = 20, pad = 9;
    const W = Math.ceil(b.wmax) + pad * 2, H = b.lines.length * lh + pad * 2 - 3;
    const x = Math.max(4, Math.min(w - W - 4, cx - Math.round(W / 2)));
    const yy = Math.max(4, y - H - 8);
    g.globalAlpha = a;
    box(x, yy, W, H, '#ffffff');
    // tail
    const tx = Math.max(x + 8, Math.min(x + W - 10, cx));
    g.fillStyle = OUT;
    g.fillRect(tx - 4, yy + H - 2, 10, 4);
    g.fillRect(tx - 2, yy + H + 2, 6, 3);
    g.fillRect(tx, yy + H + 5, 2, 2);
    g.fillStyle = '#ffffff';
    g.fillRect(tx - 2, yy + H - 2, 6, 3);
    g.fillRect(tx, yy + H + 1, 2, 2);
    g.fillStyle = '#3b2a1e';
    g.font = `bold 16px ${FONT_BODY}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    for (let i = 0; i < b.lines.length; i++) g.fillText(b.lines[i], x + pad, yy + pad - 1 + i * lh);
    g.textAlign = 'center';
    g.globalAlpha = 1;
  }

  return api;
}

export default createWorldOverlay;
