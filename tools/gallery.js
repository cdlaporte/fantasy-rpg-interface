// Renderer gallery: ?renderer=2d|3d&page=N[&zoom=Z]. No game: fixture ZoneView + FrameStates.
// Keys: [ / ] page, arrows/WASD pan, + / - zoom, space pause. window.__gallery for tests.
import { makeFrameState, ANIMS } from '../src/contracts.js';
import { createRenderer } from '../src/render/index.js';
import { buildPage, PAGE_COUNT, PAGE_TITLES } from './gallery-fixture.js';

const q = new URLSearchParams(location.search);
const rendererId = q.get('renderer') === '3d' ? '3d' : '2d';
const viewEl = document.getElementById('view');
const labels = document.getElementById('labels');
const lctx = labels.getContext('2d');
const bar = document.getElementById('bar');

const frame = makeFrameState();
const pt = { x: 0, y: 0, on: false };
let renderer = null, page = null, pageNo = 0;
let t = 0, pinned = null, paused = false, last = -1;
const cam = { x: 0, y: 0, zoom: 1 };
const fired = new Map();

function fitCamera() {
  const z = page.zone;
  cam.x = z.w / 2; cam.y = z.h / 2;
  const w = viewEl.clientWidth, h = viewEl.clientHeight;
  cam.zoom = q.has('zoom') ? Number(q.get('zoom')) : Math.min(w / (z.w * 48), h / (z.h * 48)) * 1.0;
  if (q.has('zoom')) return;
  // Perspective (3D) shows less than the flat estimate: shrink zoom until renderer.viewRect() covers the zone.
  const r = { x0: 0, y0: 0, x1: 0, y1: 0 };
  for (let i = 0; i < 30; i++) {
    renderer.render(fill(t));
    renderer.viewRect(r);
    if (r.x0 <= 0.2 && r.y0 <= 0.2 && r.x1 >= z.w - 0.2 && r.y1 >= z.h - 0.2) break;
    cam.zoom *= 0.93;
  }
}

function setPage(n) {
  pageNo = Math.max(0, Math.min(PAGE_COUNT - 1, n | 0));
  page = buildPage(pageNo);
  renderer.unloadZone();
  renderer.loadZone(page.zone);
  fired.clear();
  fitCamera();
  bar.textContent = '';
  const title = document.createElement('b');
  title.textContent = `${rendererId}  page ${pageNo}: ${PAGE_TITLES[pageNo]}   `;
  bar.appendChild(title);
  for (let i = 0; i < PAGE_COUNT; i++) {
    const a = document.createElement('a');
    a.href = `?renderer=${rendererId}&page=${i}`;
    a.textContent = String(i);
    bar.appendChild(a);
  }
  const other = document.createElement('a');
  other.href = `?renderer=${rendererId === '2d' ? '3d' : '2d'}&page=${pageNo}`;
  other.textContent = rendererId === '2d' ? '[3d]' : '[2d]';
  bar.appendChild(other);
}

function fill(time, prevTime) {
  frame.t = time; frame.alpha = 1;
  frame.camera.x = cam.x; frame.camera.y = cam.y; frame.camera.zoom = cam.zoom; frame.camera.shake = 0;
  let n = 0, f = 0;
  for (const it of page.items) {
    const v = it.view;
    if (v) {
      if (it.cycleAnims) {
        const k = Math.floor(time / 1.5) % ANIMS.length;
        v.anim = ANIMS[k]; v.animT = time % 1.5;
      } else v.animT = time % 2;
      if (v.anim === 'walk' || v.type === 'projectile') v.moving = true;
      if (v.type === 'projectile') v.angle = -0.5 + time * 0.5;
      if (it.zOsc) v.z = 1.5 * (1 - (time % 2) / 2);
      v.px = v.x; v.py = v.y;
      frame.ents[n++] = v;
    }
    if (it.fx) {
      const cycle = Math.floor((time - it.fxOffset) / it.fxPeriod);
      if (cycle >= 0 && fired.get(it) !== cycle) {
        fired.set(it, cycle);
        frame.fx[f++] = it.fx;
      }
    }
  }
  frame.entCount = n;
  frame.fxCount = f;
  void prevTime;
  return frame;
}

function drawLabels() {
  const w = viewEl.clientWidth, h = viewEl.clientHeight;
  if (labels.width !== w || labels.height !== h) { labels.width = w; labels.height = h; }
  lctx.clearRect(0, 0, w, h);
  lctx.font = '10px system-ui, sans-serif';
  lctx.textAlign = 'center';
  lctx.textBaseline = 'top';
  for (const it of page.items) {
    renderer.project(it.x, it.y + (it.view ? 0.45 : 0), 0, pt);
    if (!pt.on) continue;
    const tw = lctx.measureText(it.label).width + 6;
    lctx.fillStyle = 'rgba(0,0,0,0.55)';
    lctx.fillRect(pt.x - tw / 2, pt.y, tw, 13);
    lctx.fillStyle = '#ffffff';
    lctx.fillText(it.label, pt.x, pt.y + 1);
  }
}

function renderOnce() {
  renderer.render(fill(t));
  drawLabels();
}

function tick(now) {
  requestAnimationFrame(tick);
  const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000);
  last = now;
  if (pinned !== null) t = pinned; else if (!paused) t += dt;
  try { renderOnce(); } catch (e) { console.error(e); }
}

function onKey(e) {
  const step = 2 / cam.zoom;
  switch (e.code) {
    case 'BracketLeft': setPage(pageNo - 1); break;
    case 'BracketRight': setPage(pageNo + 1); break;
    case 'ArrowLeft': case 'KeyA': cam.x -= step; break;
    case 'ArrowRight': case 'KeyD': cam.x += step; break;
    case 'ArrowUp': case 'KeyW': cam.y -= step; break;
    case 'ArrowDown': case 'KeyS': cam.y += step; break;
    case 'Equal': case 'NumpadAdd': cam.zoom *= 1.2; break;
    case 'Minus': case 'NumpadSubtract': cam.zoom /= 1.2; break;
    case 'Space': paused = !paused; break;
    case 'KeyF': fitCamera(); break;
    default: return;
  }
  e.preventDefault();
}

async function main() {
  renderer = await createRenderer(rendererId, viewEl, { quality: 2 });
  renderer.resize(viewEl.clientWidth, viewEl.clientHeight);
  new ResizeObserver(() => renderer.resize(viewEl.clientWidth, viewEl.clientHeight)).observe(viewEl);
  setPage(Number(q.get('page') || 0));
  window.addEventListener('keydown', onKey);
  renderOnce();
  requestAnimationFrame(tick);
  window.__gallery = {
    ready: true,
    renderer,
    get page() { return pageNo; },
    setPage(n) { setPage(n); renderOnce(); },
    setTime(time) { pinned = time; if (time !== null) { t = time; renderOnce(); } },
    setCamera(x, y, zoom) { if (x != null) cam.x = x; if (y != null) cam.y = y; if (zoom != null) cam.zoom = zoom; renderOnce(); },
    stats() { return Object.assign({}, renderer.stats(), { renderer: renderer.id, page: pageNo, entCount: frame.entCount, items: page.items.length }); },
    snapshot() {
      renderOnce();
      const c = document.createElement('canvas');
      c.width = viewEl.clientWidth; c.height = viewEl.clientHeight;
      const ctx = c.getContext('2d');
      const src = viewEl.querySelector('canvas:not(#labels)');
      if (src) ctx.drawImage(src, 0, 0);
      ctx.drawImage(labels, 0, 0);
      return c.toDataURL('image/png');
    },
  };
}

main().catch((e) => console.error('[gallery]', e));
