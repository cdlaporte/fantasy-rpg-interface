// STUB: replaced by the Render 2D package
// DEBUG renderer: flat tile squares, prop rectangles, entity circles with a facing tick, simple fx rings.
import { VIEW } from '../../contracts.js';

export function lookColor(look) {
  if (!look) return '#ff00ff';
  if (look.rig === 'humanoid') return (look.outfit && look.outfit.primary) || '#4a90d9';
  if (look.colors && look.colors.body) return look.colors.body;
  return look.color || '#ffffff';
}

export function create() {
  let host = null, canvas = null, ctx = null, zv = null;
  let w = 1, h = 1;
  const cam = { x: 0, y: 0, zoom: 1, ox: 0, oy: 0 };
  const st = { ms: 0, draws: 0, tris: 0, unknown: [] };
  const active = []; // {type, x, y, x2, y2, r, color, age, dur}
  let lastT = 0;
  const tileColors = [];

  const T = () => VIEW.TILE_PX * cam.zoom;

  const r = {
    id: '2d',
    async init(hostEl) {
      host = hostEl;
      canvas = document.createElement('canvas');
      canvas.className = 'r2d';
      ctx = canvas.getContext('2d');
      host.insertBefore(canvas, host.firstChild);
      r.resize(host.clientWidth, host.clientHeight);
    },
    loadZone(zoneView) {
      zv = zoneView;
      tileColors.length = 0;
      const pats = (zv.palette && zv.palette.patterns) || {};
      for (const d of zv.tileDefs) {
        const p = pats[d.pattern];
        tileColors.push({ a: (p && p.a) || d.colors.a, b: (p && p.b) || d.colors.b, side: (p && p.side) || d.colors.side });
      }
    },
    unloadZone() { zv = null; },
    tileChanged() {},
    render(frame) {
      const t0 = performance.now();
      cam.x = frame.camera.x; cam.y = frame.camera.y; cam.zoom = frame.camera.zoom || 1;
      const sh = frame.camera.shake || 0;
      cam.ox = sh ? Math.sin(frame.t * 70) * sh * 6 : 0;
      cam.oy = sh ? Math.cos(frame.t * 53) * sh * 6 : 0;
      const ts = T();
      let draws = 0;
      ctx.fillStyle = (zv && zv.palette && zv.palette.bg) || '#223';
      ctx.fillRect(0, 0, w, h);
      if (zv) {
        const x0 = Math.max(0, Math.floor(cam.x - w / 2 / ts)), x1 = Math.min(zv.w - 1, Math.ceil(cam.x + w / 2 / ts));
        const y0 = Math.max(0, Math.floor(cam.y - h / 2 / ts)), y1 = Math.min(zv.h - 1, Math.ceil(cam.y + h / 2 / ts) + 2);
        for (let ty = y0; ty <= y1; ty++) {
          for (let tx = x0; tx <= x1; tx++) {
            const i = ty * zv.w + tx;
            const def = zv.tileDefs[zv.tiles[i]];
            const c = tileColors[zv.tiles[i]];
            const sx = (tx - cam.x) * ts + w / 2 + cam.ox, sy = (ty - cam.y) * ts + h / 2 + cam.oy;
            ctx.fillStyle = (zv.variant[i] & 64) ? c.b : c.a;
            ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(ts), Math.ceil(ts));
            if (def.shape === 'block') {
              ctx.fillStyle = c.side;
              ctx.fillRect(Math.floor(sx), Math.floor(sy + ts * 0.75), Math.ceil(ts), Math.ceil(ts * 0.25));
            }
            draws++;
          }
        }
        for (const p of zv.props) {
          const sx = (p.x - cam.x) * ts + w / 2 + cam.ox, sy = (p.y - cam.y) * ts + h / 2 + cam.oy;
          if (sx > w || sy > h || sx + p.w * ts < 0 || sy + p.h * ts < 0) continue;
          const lk = p.look || {};
          ctx.fillStyle = lk.wall || lk.leaves || lk.wood || lk.stone || lk.body || lk.cloth || lk.main || '#c98c50';
          ctx.fillRect(sx + 3, sy + 3, p.w * ts - 6, p.h * ts - 6);
          ctx.fillStyle = lk.roof || lk.trunk || lk.trim || lk.edge || '#00000055';
          ctx.fillRect(sx + 3, sy + 3, p.w * ts - 6, Math.max(4, (p.h * ts - 6) * 0.35));
          draws += 2;
        }
      }
      const a = frame.alpha;
      for (let i = 0; i < frame.entCount; i++) {
        const e = frame.ents[i];
        const x = e.px + (e.x - e.px) * a, y = e.py + (e.y - e.py) * a;
        const sx = (x - cam.x) * ts + w / 2 + cam.ox, sy = (y - cam.y - e.z) * ts + h / 2 + cam.oy;
        const lk = e.look;
        let rad = (e.radius || 0.3) * ts * (e.scale || 1);
        if (lk && lk.rig === 'effect') rad = Math.max(rad, (lk.r || 0.5) * ts);
        else if (lk && lk.size) rad = Math.max(6, 0.35 * ts * lk.size * (e.scale || 1));
        ctx.globalAlpha = e.alpha;
        ctx.fillStyle = e.flash > 0.5 ? '#ffffff' : (e.tint || lookColor(lk));
        ctx.beginPath(); ctx.arc(sx, sy - rad * 0.6, rad, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy - rad * 0.6);
        ctx.lineTo(sx + Math.cos(e.angle) * rad * 1.4, sy - rad * 0.6 + Math.sin(e.angle) * rad * 1.4);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.globalAlpha = 1;
        draws += 2;
      }
      // fx: each event becomes a short-lived ring/line
      const dt = Math.max(0, Math.min(0.1, frame.t - lastT));
      lastT = frame.t;
      for (let i = 0; i < frame.fxCount; i++) {
        const f = frame.fx[i];
        if (f.type === 'text') continue;
        active.push({ type: f.type, x: f.x, y: f.y, x2: f.x2, y2: f.y2, r: f.r || 1, color: f.color || '#ffe066', age: 0, dur: f.dur || 0.6 });
      }
      for (let i = active.length - 1; i >= 0; i--) {
        const f = active[i];
        f.age += dt || 1 / 60;
        if (f.age > f.dur) { active.splice(i, 1); continue; }
        const k = f.age / f.dur;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color; ctx.lineWidth = 3;
        if (f.type === 'screenFlash') { ctx.fillStyle = f.color; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; continue; }
        const sx = (f.x - cam.x) * ts + w / 2, sy = (f.y - cam.y) * ts + h / 2;
        ctx.beginPath();
        if (f.x2 !== null && f.y2 !== null) {
          ctx.moveTo(sx, sy); ctx.lineTo((f.x2 - cam.x) * ts + w / 2, (f.y2 - cam.y) * ts + h / 2);
        } else ctx.arc(sx, sy, Math.max(2, f.r * ts * k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        draws++;
      }
      if (frame.ambience && frame.ambience.tintAmount > 0) {
        ctx.globalAlpha = frame.ambience.tintAmount; ctx.fillStyle = frame.ambience.tint; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
      }
      st.draws = draws;
      st.ms = performance.now() - t0;
    },
    project(wx, wy, wz, out) {
      const ts = T();
      out.x = (wx - cam.x) * ts + w / 2;
      out.y = (wy - (wz || 0) - cam.y) * ts + h / 2;
      out.on = out.x >= 0 && out.y >= 0 && out.x <= w && out.y <= h;
      return out;
    },
    viewRect(out) {
      const ts = T();
      out.x0 = cam.x - w / 2 / ts; out.x1 = cam.x + w / 2 / ts;
      out.y0 = cam.y - h / 2 / ts; out.y1 = cam.y + h / 2 / ts;
      return out;
    },
    resize(nw, nh) {
      w = Math.max(1, nw | 0); h = Math.max(1, nh | 0);
      if (canvas) { canvas.width = w; canvas.height = h; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
      if (ctx) ctx.imageSmoothingEnabled = false;
    },
    setQuality() {},
    stats() { return st; },
    dispose() { if (canvas) canvas.remove(); canvas = null; ctx = null; zv = null; },
    /** added for tools: the canvas element */
    get canvas() { return canvas; },
  };
  return r;
}

export default { create };
