// 2D renderer (CONTRACTS section 7): procedural SNES-style pixel art.
// The whole world is drawn 1:1 into an "art" canvas (1 px = 1 art pixel = 3 CSS px at zoom 1), then blitted to
// the screen canvas once with nearest-neighbor scaling and a sub-art-pixel offset for smooth scrolling.
// Layers: tile chunks (cached, lazily built) -> ground fx/shadows/telegraphs -> y-sorted props, entities and
// block-tile occluders -> top fx (particles, translucent volumes, emitters) -> ambience tint -> screen flash.
import { VIEW } from '../../contracts.js';
import { makeCanvas } from './pix.js';
import { col, rgba, light } from './color.js';
import { CH, TP, CPX, prepareTiles, buildChunk, chunkAnimated, blockRegion } from './tiles.js';
import { buildProp, propKey, propUnknown, FLAT_MODELS } from './props.js';
import { createSpriteFactory } from './spriteFactory.js';
import { createFx, FX_KNOWN } from './fx.js';
import { createLive } from './live.js';
import { SPINNERS, ROUND } from './models.js';

const GROUND_FX = { telegraph_circle: 1, telegraph_line: 1, telegraph_cone: 1, ground_fire: 1, ground_frost: 1, zone_ring: 1, portal: 1 };
const TOP_FX = { barrier: 1, shield_bubble: 1, smoke: 1, decoy_puff: 1 };
const TAG_TINT = { burn: '#ff7a2a', frost: '#9fe6ff', venom: '#8ae04a', frenzy: '#ff2a3a', shadow: '#3a1a5a' };
const BOB = { gold: 1, heart: 1, item: 1, xp_orb: 1 };
const FXTAGS = ['burn', 'frost', 'stun', 'shield', 'stealth', 'mark', 'frenzy', 'charge', 'haste', 'rune_fire', 'rune_frost',
  'rune_storm', 'ki', 'shadow', 'summoned', 'wanted', 'sleep', 'levelup_ready', 'venom'];

export function create() {
  let host = null, canvas = null, sctx = null;
  let art = null, g = null, artW = 0, artH = 0;
  let w = 1, h = 1, quality = 1;
  const unknownSet = new Set();
  const st = { ms: 0, draws: 0, tris: 0, unknown: [], fills: 0, chunks: 0, particles: 0, sprites: 0 };
  let unknownSize = -1;
  const sprites = createSpriteFactory(unknownSet);
  const fx = createFx();
  const live = createLive(fx);
  fx.setQuality(quality);

  // camera (world art px of the view's top-left, snapped) and scale
  const cam = { x: 0, y: 0, zoom: 1, scale: 3, L: 0, T: 0, Li: 0, Ti: 0, aw: 1, ah: 1, shx: 0, shy: 0, valid: false, lastX: 0, lastY: 0 };

  // zone state
  let zv = null, info = null, chW = 0, chH = 0;
  let chunks = [];          // index cy*chW+cx -> {c: [canvas], anim}
  let chunkExtras = [];     // per chunk {flat, shadows}
  let props = [];           // y-sorted props (non-flat)
  let needAll = true;
  let marks = null, markEpoch = 1;
  const propCache = new Map();
  const zoneEmitters = [];
  let bg = '#2a3a4a';

  // per-frame scratch (preallocated)
  const POOL = 1024;
  const items = [];
  for (let i = 0; i < POOL; i++) items.push({ key: 0, type: 0, ref: null, X: 0, Y: 0, sc: 1, spr: null, a: 0, b: 0, c: 0, d: 0 });
  const order = new Array(POOL);
  let nItems = 0;
  const reg = { x: 0, y: 0, w: 0, h: 0 };
  const entById = new Map();
  let lastT = -1;

  // ------------------------------------------------------------------ helpers
  function ensureArt(nw, nh) {
    if (art && nw <= artW && nh <= artH && artW - nw < 512 && artH - nh < 512) return;
    artW = Math.ceil(nw / 64) * 64 + 64; artH = Math.ceil(nh / 64) * 64 + 64;
    art = makeCanvas(artW, artH);
    g = art.getContext('2d', { alpha: false });
    g.imageSmoothingEnabled = false;
  }

  function updateCamera(c, t) {
    cam.x = c.x; cam.y = c.y; cam.zoom = c.zoom > 0 ? c.zoom : 1;
    cam.scale = VIEW.PIXEL_SCALE * cam.zoom;
    cam.aw = w / cam.scale; cam.ah = h / cam.scale;
    const sh = c.shake || 0;
    cam.shx = sh > 0 ? Math.sin(t * 71) * sh * 4 + Math.sin(t * 37) * sh * 2 : 0;
    cam.shy = sh > 0 ? Math.cos(t * 59) * sh * 4 : 0;
    cam.L = cam.x * TP - cam.aw / 2 + cam.shx;
    cam.T = cam.y * TP - cam.ah / 2 + cam.shy;
    cam.Li = Math.floor(cam.L); cam.Ti = Math.floor(cam.T);
    cam.valid = true;
  }

  function unknownList() {
    if (unknownSet.size !== unknownSize) { unknownSize = unknownSet.size; st.unknown = Array.from(unknownSet).sort(); }
    return st.unknown;
  }

  // ------------------------------------------------------------------ zone
  function loadZone(zoneView) {
    unloadZone();
    if (!zoneView) return;
    zv = zoneView;
    const unk = [];
    info = prepareTiles(zv, unk);
    for (const u of unk) unknownSet.add(u);
    bg = col(zv.palette && zv.palette.bg, '#2a3a4a');
    chW = Math.ceil(zv.w / CH); chH = Math.ceil(zv.h / CH);
    chunks = new Array(chW * chH).fill(null);
    chunkExtras = new Array(chW * chH);
    for (let i = 0; i < chunkExtras.length; i++) chunkExtras[i] = { flat: [], shadows: [] };
    marks = new Uint32Array(zv.w * zv.h);
    markEpoch = 1;
    props = [];
    zoneEmitters.length = 0;
    const pu = [];
    for (const pr of zv.props || []) {
      propUnknown(pr, pu);
      const key = propKey(pr);
      let built = propCache.get(key);
      if (!built) {
        const b = buildProp(pr);
        built = { c: b.pix.toCanvas(), dx: b.dx, dy: b.dy, w: b.w, h: b.h, flat: b.flat, shadow: b.shadow, emit: b.emit };
        propCache.set(key, built);
      }
      const wx = pr.x * TP, wy = pr.y * TP;
      const rec = { pr, s: built, x0: wx + built.dx, y0: wy + built.dy, x1: wx + built.dx + built.w, y1: wy + built.dy + built.h,
        key: pr.y + (pr.h || 1) - (pr.def && pr.def.footprint ? 0 : 0.55), wx, wy };
      // shadows and flat props are baked into the chunks they overlap
      const bake = (x0, y0, x1, y1, fn) => {
        for (let cy = Math.max(0, Math.floor(y0 / CPX)); cy <= Math.min(chH - 1, Math.floor(y1 / CPX)); cy++) {
          for (let cx = Math.max(0, Math.floor(x0 / CPX)); cx <= Math.min(chW - 1, Math.floor(x1 / CPX)); cx++) fn(chunkExtras[cy * chW + cx]);
        }
      };
      if (built.shadow) {
        const sx = wx + built.shadow.x, sy = wy + built.shadow.y, s = { x: sx, y: sy, rx: built.shadow.rx, ry: built.shadow.ry };
        bake(sx - s.rx, sy - s.ry, sx + s.rx, sy + s.ry, (e) => e.shadows.push(s));
      }
      if (built.flat) {
        const f = { sprite: built, x: rec.x0, y: rec.y0 };
        bake(rec.x0, rec.y0, rec.x1, rec.y1, (e) => e.flat.push(f));
        continue;
      }
      for (const em of built.emit) zoneEmitters.push({ e: em, wx: wx + em.x, wy: wy + em.y });
      props.push(rec);
    }
    for (const u of pu) unknownSet.add(u);
    props.sort((a, b) => a.key - b.key);
    needAll = true;
  }

  function unloadZone() {
    zv = null; info = null; chunks = []; chunkExtras = []; props = []; marks = null; zoneEmitters.length = 0;
    fx.clear();
  }

  function getChunk(cx, cy) {
    const i = cy * chW + cx;
    let ch = chunks[i];
    if (ch) return ch;
    const anim = chunkAnimated(zv, info, cx, cy);
    const c0 = buildChunk(zv, info, cx, cy, 0, chunkExtras[i]);
    const c1 = anim ? buildChunk(zv, info, cx, cy, 1, chunkExtras[i]) : null;
    ch = { c0, c1 };
    chunks[i] = ch;
    st.chunks++;
    return ch;
  }

  function tileChanged(tx, ty) {
    if (!zv) return;
    for (let y = ty - 1; y <= ty + 4; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      if (x < 0 || y < 0 || x >= zv.w || y >= zv.h) continue;
      const i = Math.floor(y / CH) * chW + Math.floor(x / CH);
      chunks[i] = null;
    }
    // a block above the changed tile may overhang into a chunk further up
    needAll = true;
  }

  // ------------------------------------------------------------------ frame
  let drawsN = 0, fillsN = 0;

  function render(frame) {
    const t0 = performance.now();
    if (!g || !canvas) ensureArt(1, 1);
    const t = frame.t || 0;
    const dt = lastT < 0 ? 1 / 60 : Math.max(0, Math.min(0.1, t - lastT));
    lastT = t;
    sprites.frameBegin();
    live.frame(t, quality);
    updateCamera(frame.camera, t);
    const aw = Math.ceil(cam.aw) + 2, ah = Math.ceil(cam.ah) + 2;
    ensureArt(aw, ah);
    drawsN = 0; fillsN = 0;
    const ox = cam.Li, oy = cam.Ti;
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = bg; g.fillRect(0, 0, aw, ah);

    // age existing fx first, so events spawned this frame start at age 0
    fx.update(dt);
    // one-shot fx (entity positions needed for afterimages)
    entById.clear();
    for (let i = 0; i < frame.entCount; i++) entById.set(frame.ents[i].id, frame.ents[i]);
    for (let i = 0; i < frame.fxCount; i++) {
      const f = frame.fx[i];
      if (f.type === 'text') continue;
      if (!FX_KNOWN.includes(f.type)) unknownSet.add('fx:' + f.type);
      let spr = null;
      if (f.type === 'afterimage' && f.ent !== null) {
        const v = entById.get(f.ent);
        if (v) spr = sprites.get(v.look, v.lookRev, v.anim, v.dir, v.animT, v.moving);
      }
      fx.spawn(f, quality, spr);
    }

    if (zv) drawTiles(t, ox, oy, aw, ah);

    // ---- ground layer: shadows, ground effects, under-tags, auras under
    const alpha = frame.alpha;
    nItems = 0;
    const evening = frame.ambience && frame.ambience.daypart === 'evening';
    for (let i = 0; i < frame.entCount; i++) {
      const v = frame.ents[i];
      const look = v.look;
      if (!look) continue;
      for (let k = 0; k < v.fxTags.length; k++) if (!FXTAGS.includes(v.fxTags[k])) unknownSet.add('fxTag:' + v.fxTags[k]);
      const ex = v.px + (v.x - v.px) * alpha, ey = v.py + (v.y - v.py) * alpha;
      const wx = ex * TP, wy = ey * TP;
      const X = Math.round(wx - ox), Y = Math.round(wy - oy);
      if (X < -200 || Y < -120 || X > aw + 200 || Y > ah + 260) continue;
      const rig = look.rig;
      if (rig === 'effect') {
        const m = look.model;
        if (GROUND_FX[m]) { live.effectGround(g, v, look, X, Y, wx, wy); fillsN += 4; continue; }
        if (TOP_FX[m]) { pushItem(1e9, 3, v, X, Y); continue; }
        if (m === 'meteor') live.effectGround(g, v, look, X, Y, wx, wy);
        if (m === 'caltrops') { const s = sprites.get(look, v.lookRev, 'idle', 0, 0, false); if (s) { g.drawImage(s.c, X - s.ax, Y - s.ay); drawsN++; } continue; }
      }
      // shadow
      const spr = rig === 'effect' && m2(look) === 'rune_seal' ? null : sprites.get(look, v.lookRev, v.anim, v.dir, v.animT, v.moving);
      const sc = (v.scale || 1) * (spr ? spr.scale : 1);
      if (rig !== 'effect' || BOB[look.model] || look.model === 'chest' || look.model === 'rune_chest' || look.model === 'chest_open' || look.model === 'totem' || look.model === 'stick' || look.model === 'meteor') {
        shadowFor(v, look, X, Y, sc);
      }
      if (v.fxTags.length) live.tagsUnder(g, v, X, Y, wx, wy);
      if (rig === 'humanoid' && look.aura && quality > 0) live.aura(g, v, look.aura, X, Y, wx, wy, spr ? (spr.ay - spr.top) * sc : 24, true);
      pushItem(ey + (rig === 'projectile' ? 0.01 : 0), 0, v, X, Y, spr, sc, wx, wy);
    }
    drawsN += fx.takeDraws();
    fx.drawShapes(g, ox, oy, true, sprites);

    // ---- props
    if (zv) {
      const vx0 = ox - 8, vy0 = oy - 8, vx1 = ox + aw + 8, vy1 = oy + ah + 8;
      for (let i = 0; i < props.length; i++) {
        const p = props[i];
        if (p.x1 < vx0 || p.x0 > vx1 || p.y1 < vy0 || p.y0 > vy1) continue;
        pushItem(p.key, 1, p, p.x0 - ox, p.y0 - oy);
      }
      occluders(ox, oy);
    }

    // ---- sort (insertion sort: nearly sorted frame to frame) and draw
    for (let i = 1; i < nItems; i++) {
      const it = order[i];
      let j = i - 1;
      while (j >= 0 && order[j].key > it.key) { order[j + 1] = order[j]; j--; }
      order[j + 1] = it;
    }
    for (let i = 0; i < nItems; i++) {
      const it = order[i];
      if (it.type === 0) drawEnt(it, t, ox, oy);
      else if (it.type === 1) { const p = it.ref; g.drawImage(p.s.c, it.X, it.Y); drawsN++; }
      else if (it.type === 2) drawOcc(it, ox, oy);
    }
    // ---- top layer
    for (let i = 0; i < nItems; i++) { const it = order[i]; if (it.type === 3) { live.effectTop(g, it.ref, it.ref.look, it.X, it.Y, it.X + ox, it.Y + oy); fillsN += 6; } }
    if (zv) {
      for (let i = 0; i < zoneEmitters.length; i++) {
        const z = zoneEmitters[i];
        const X = z.wx - ox, Y = z.wy - oy;
        if (X < -40 || Y < -40 || X > aw + 40 || Y > ah + 40) continue;
        if (z.e.kind === 'glow') continue;
        live.emitter(g, z.e, Math.round(X), Math.round(Y), z.wx, z.wy, evening);
      }
    }
    fx.drawShapes(g, ox, oy, false, sprites);
    fillsN += fx.drawParticles(g, ox, oy);
    drawsN += fx.takeDraws();

    // ---- ambience: warm multiply tint, then light sources glow through it
    const amb = frame.ambience;
    if (amb && amb.tintAmount > 0 && amb.tint) {
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = Math.min(0.55, amb.tintAmount * 2.2);
      g.fillStyle = col(amb.tint, '#ffd0a0'); g.fillRect(0, 0, aw, ah);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      fillsN++;
    }
    if (zv) {
      for (let i = 0; i < zoneEmitters.length; i++) {
        const z = zoneEmitters[i];
        if (z.e.kind !== 'glow') continue;
        const X = z.wx - ox, Y = z.wy - oy;
        if (X < -40 || Y < -40 || X > aw + 40 || Y > ah + 40) continue;
        live.emitter(g, z.e, Math.round(X), Math.round(Y), z.wx, z.wy, evening);
      }
      drawsN += fx.takeDraws();
    }
    if (fx.flash > 0) { g.globalAlpha = Math.min(0.9, fx.flash); g.fillStyle = fx.flashColor; g.fillRect(0, 0, aw, ah); g.globalAlpha = 1; fillsN++; }

    // ---- blit to screen (sub-art-pixel offset for smooth scrolling)
    const s = cam.scale;
    const fxo = Math.round((cam.L - cam.Li) * s), fyo = Math.round((cam.T - cam.Ti) * s);
    sctx.imageSmoothingEnabled = s < 1.5;
    sctx.drawImage(art, 0, 0, aw, ah, -fxo, -fyo, aw * s, ah * s);
    drawsN++;

    st.draws = drawsN; st.fills = fillsN; st.particles = fx.alive; st.sprites = sprites.stats().built;
    unknownList();
    st.ms = performance.now() - t0;
  }

  const m2 = (look) => look.model;

  function pushItem(key, type, ref, X, Y, spr, sc, wx, wy) {
    if (nItems >= POOL) return;
    const it = items[nItems];
    it.key = key; it.type = type; it.ref = ref; it.X = X; it.Y = Y; it.spr = spr || null; it.sc = sc || 1; it.a = wx || 0; it.b = wy || 0;
    order[nItems++] = it;
  }

  // ------------------------------------------------------------------ tiles
  function drawTiles(t, ox, oy, aw, ah) {
    const cx0 = Math.max(0, Math.floor(ox / CPX)), cy0 = Math.max(0, Math.floor(oy / CPX));
    const cx1 = Math.min(chW - 1, Math.floor((ox + aw) / CPX)), cy1 = Math.min(chH - 1, Math.floor((oy + ah) / CPX));
    const jumped = Math.abs(cam.x - cam.lastX) + Math.abs(cam.y - cam.lastY) > 8;
    cam.lastX = cam.x; cam.lastY = cam.y;
    let budget = needAll || jumped ? 999 : 1;
    const wf = Math.floor(t * 2.2) & 1;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      let ch = chunks[cy * chW + cx];
      if (!ch) { ch = getChunk(cx, cy); budget--; }
      const c = wf && ch.c1 ? ch.c1 : ch.c0;
      g.drawImage(c, cx * CPX - ox, cy * CPX - oy);
      drawsN++;
    }
    needAll = false;
    // prefetch one chunk around the view (4-tile margin) so moving never shows a hole
    if (budget > 0) {
      const m = 4 * TP;
      const px0 = Math.max(0, Math.floor((ox - m) / CPX)), py0 = Math.max(0, Math.floor((oy - m) / CPX));
      const px1 = Math.min(chW - 1, Math.floor((ox + aw + m) / CPX)), py1 = Math.min(chH - 1, Math.floor((oy + ah + m) / CPX));
      outer: for (let cy = py0; cy <= py1; cy++) for (let cx = px0; cx <= px1; cx++) {
        if (!chunks[cy * chW + cx]) { getChunk(cx, cy); break outer; }
      }
    }
    // keep memory bounded on big zones: drop chunks far from the view
    if (chunks.length > 64 && (Math.floor(t * 2) % 8 === 0)) {
      for (let cy = 0; cy < chH; cy++) for (let cx = 0; cx < chW; cx++) {
        if (cx < cx0 - 3 || cx > cx1 + 3 || cy < cy0 - 3 || cy > cy1 + 3) chunks[cy * chW + cx] = null;
      }
    }
  }

  /** Mark block tiles that must be redrawn over y-sorted items standing behind them. */
  function occluders(ox, oy) {
    markEpoch = (markEpoch + 1) >>> 0;
    if (markEpoch === 0) { marks.fill(0); markEpoch = 1; }
    const n0 = nItems;
    for (let i = 0; i < n0; i++) {
      const it = order[i];
      let x0, x1, y0, y1, footY;
      if (it.type === 0) {
        const s = it.spr; if (!s) continue;
        x0 = it.X + ox - s.ax * it.sc; x1 = x0 + s.w * it.sc; y1 = it.Y + oy; y0 = y1 - (s.ay - s.top) * it.sc - (it.ref.z || 0) * TP; footY = it.key;
      } else if (it.type === 1) {
        const p = it.ref; x0 = p.x0; x1 = p.x1; y0 = p.y0; y1 = p.y1; footY = p.key;
      } else continue;
      const tx0 = Math.max(0, Math.floor(x0 / TP)), tx1 = Math.min(zv.w - 1, Math.floor((x1 - 1) / TP));
      const fy = Math.floor(footY);
      for (let ty = Math.max(0, fy); ty <= Math.min(zv.h - 1, fy + 3); ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const idx = ty * zv.w + tx;
          if (marks[idx] === markEpoch) continue;
          if (!info[zv.tiles[idx]].block) continue;
          if (ty + 1 <= footY) continue;
          if (!blockRegion(info, zv, tx, ty, reg)) continue;
          if (reg.y + reg.h <= y0 || reg.y >= y1 || reg.x + reg.w <= x0 || reg.x >= x1) continue;
          marks[idx] = markEpoch;
          pushItem(ty + 1, 2, null, reg.x - ox, reg.y - oy);
          const o = order[nItems - 1]; o.c = reg.w; o.d = reg.h; o.a = reg.x; o.b = reg.y;
        }
      }
    }
  }

  function drawOcc(it, ox, oy) {
    // copy the block's pixels back from its chunk(s)
    const x = it.a, y = it.b, ww = it.c, hh = it.d;
    const cx = Math.floor(x / CPX);
    for (let cy = Math.max(0, Math.floor(y / CPX)); cy <= Math.min(chH - 1, Math.floor((y + hh - 1) / CPX)); cy++) {
      const ch = chunks[cy * chW + cx];
      if (!ch) continue;
      const c = (Math.floor(lastT * 2.2) & 1) && ch.c1 ? ch.c1 : ch.c0;
      const sy0 = Math.max(y, cy * CPX), sy1 = Math.min(y + hh, (cy + 1) * CPX);
      if (sy1 <= sy0) continue;
      g.drawImage(c, x - cx * CPX, sy0 - cy * CPX, ww, sy1 - sy0, x - ox, sy0 - oy, ww, sy1 - sy0);
      drawsN++;
    }
  }

  // ------------------------------------------------------------------ entities
  function shadowFor(v, look, X, Y, sc) {
    let rx = 7, ry = 2.5;
    const rig = look.rig;
    if (rig === 'humanoid') { rx = 7 * sc; ry = 2.6 * sc; }
    else if (rig === 'projectile') { rx = 3; ry = 1.2; }
    else if (rig === 'effect') { rx = look.model === 'meteor' ? 0 : 5; ry = 2; }
    else { const k = (look.size || 1) * sc; rx = (rig === 'flyer' ? 4 : rig === 'blob' ? 7 : rig === 'golem' ? 8 : 6.5) * k; ry = rx * 0.35; if (look.hero === 'mossback') { rx *= 1.1; ry *= 1.1; } }
    if (rx <= 0) return;
    const z = (v.z || 0) * TP;
    if (z > 0) { const k = Math.max(0.35, 1 - z / 60); rx *= k; ry *= k; }
    g.globalAlpha = 0.3 * (v.alpha ?? 1);
    g.fillStyle = '#1a1030';
    g.beginPath(); g.ellipse(X, Y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    fillsN++;
  }

  function drawEnt(it, t, ox, oy) {
    const v = it.ref, look = v.look, rig = look.rig;
    const X = it.X, Y = it.Y;
    if (rig === 'effect' && look.model === 'rune_seal') { fillsN += live.runeSeal(g, v, look, X, Y); return; }
    const s = it.spr;
    if (!s) return;
    let z = (v.z || 0) * TP;
    if (rig === 'flyer') z += 4 + Math.sin(t * 4 + v.id) * 2;
    if (rig === 'effect' && BOB[look.model]) z += 2 + Math.sin(t * 5 + v.id) * 2;
    const sc = it.sc;
    let alpha = v.alpha ?? 1;
    const tags = v.fxTags;
    const stealth = tags.length && tags.indexOf('stealth') >= 0;
    if (stealth) alpha *= 0.38 + 0.08 * Math.sin(t * 8);
    const hgt = (s.ay - s.top) * sc;
    const wx = it.a, wy = it.b;
    // glow halo behind
    if (v.glow) { fx.glow(g, X, Y - z - hgt * 0.45, Math.max(10, hgt * 0.9), col(v.glow, '#ffe680'), 0.55 + 0.15 * Math.sin(t * 4 + v.id)); }
    if (rig === 'projectile') { drawProjectile(v, look, s, X, Y - z, t); return; }
    const dx = Math.round(X - s.ax * sc), dy = Math.round(Y - z - s.ay * sc);
    g.globalAlpha = alpha;
    if (sc === 1) g.drawImage(s.c, dx, dy);
    else g.drawImage(s.c, dx, dy, Math.round(s.w * sc), Math.round(s.h * sc));
    drawsN++;
    if (v.tint) { g.globalAlpha = alpha * 0.42; g.drawImage(sprites.tintOf(s, col(v.tint, '#ffffff')), dx, dy, Math.round(s.w * sc), Math.round(s.h * sc)); drawsN++; }
    if (tags.length && quality > 0) {
      for (let k = 0; k < tags.length; k++) {
        const tc = TAG_TINT[tags[k]];
        if (!tc) continue;
        g.globalAlpha = alpha * (0.22 + 0.12 * Math.sin(t * (tags[k] === 'burn' ? 17 : 5) + v.id));
        g.drawImage(sprites.tintOf(s, tc), dx, dy, Math.round(s.w * sc), Math.round(s.h * sc)); drawsN++;
        break;
      }
    }
    if (stealth) { g.globalAlpha = 0.25 + 0.15 * Math.sin(t * 6); g.globalCompositeOperation = 'lighter'; g.drawImage(sprites.tintOf(s, '#6a5aa8'), dx, dy, Math.round(s.w * sc), Math.round(s.h * sc)); g.globalCompositeOperation = 'source-over'; drawsN++; }
    if (v.flash > 0) { g.globalAlpha = Math.min(1, v.flash * 1.3) * alpha; g.drawImage(sprites.flashOf(s), dx, dy, Math.round(s.w * sc), Math.round(s.h * sc)); drawsN++; }
    g.globalAlpha = 1;
    // glowing bits (staff orbs, runes, eyes)
    if (s.glow.length && quality > 0) {
      for (let i = 0; i < s.glow.length; i++) {
        const gp = s.glow[i];
        fx.glow(g, dx + gp[0] * sc, dy + gp[1] * sc, 6 * gp[3] * sc, gp[2], 0.4 + 0.15 * Math.sin(t * 5 + i + v.id));
      }
    }
    if (rig === 'humanoid' && look.aura && quality > 0) live.aura(g, v, look.aura, X, Y - z, wx, wy - z, hgt, false);
    if (tags.length) live.tagsOver(g, v, X, Y - z, Math.round(Y - z - hgt), wx, wy - z, hgt);
  }

  function drawProjectile(v, look, s, X, Y, t) {
    const sc = Math.max(0.3, v.scale || 1);
    let ang = v.angle || 0;
    if (SPINNERS[look.model]) ang = t * 16 + v.id;
    if (ROUND[look.model]) ang = 0;
    const gc = col(look.glow, col(look.color, '#ffe066'));
    if (look.trail) {
      const ca = Math.cos(v.angle || 0), sa = Math.sin(v.angle || 0);
      g.globalCompositeOperation = 'source-over';
      for (let i = 1; i <= 6; i++) {
        g.globalAlpha = 0.9 * (1 - i / 7);
        const si = Math.max(1, Math.round((3.6 - i * 0.45) * sc));
        g.fillStyle = i < 2 ? '#ffffff' : i < 4 ? light(gc, 0.3) : gc;
        g.fillRect(Math.round(X - ca * i * 3 - si / 2 + Math.sin(t * 30 + i) * 0.6), Math.round(Y - sa * i * 3 - si / 2), si, si);
        fillsN++;
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    if (s.glow.length && quality > 0) fx.glow(g, X, Y, 10 * sc * (s.glow[0][3] || 1), s.glow[0][2], 0.7);
    g.globalAlpha = v.alpha ?? 1;
    if (ang === 0 && sc === 1) g.drawImage(s.c, Math.round(X - s.ax), Math.round(Y - s.ay));
    else {
      g.save(); g.translate(Math.round(X), Math.round(Y)); g.rotate(ang); g.scale(sc, sc);
      g.drawImage(s.c, -s.ax, -s.ay); g.restore();
    }
    g.globalAlpha = 1;
    drawsN++;
  }

  // ------------------------------------------------------------------ interface
  const r = {
    id: '2d',
    async init(hostEl, opts) {
      host = hostEl;
      canvas = document.createElement('canvas');
      canvas.className = 'r2d';
      canvas.style.imageRendering = 'pixelated';
      sctx = canvas.getContext('2d', { alpha: false });
      host.insertBefore(canvas, host.firstChild);
      if (opts && opts.quality !== undefined) r.setQuality(opts.quality);
      r.resize(host.clientWidth, host.clientHeight);
      ensureArt(Math.ceil(w / 3) + 2, Math.ceil(h / 3) + 2);
    },
    loadZone, unloadZone, tileChanged, render,
    project(wx, wy, wz, out) {
      const s = cam.scale;
      out.x = (wx * TP - cam.L) * s;
      out.y = ((wy - (wz || 0)) * TP - cam.T) * s;
      out.on = out.x >= 0 && out.y >= 0 && out.x <= w && out.y <= h;
      return out;
    },
    viewRect(out) {
      if (!cam.valid) { const s = VIEW.TILE_PX * (cam.zoom || 1); out.x0 = cam.x - w / 2 / s; out.x1 = cam.x + w / 2 / s; out.y0 = cam.y - h / 2 / s; out.y1 = cam.y + h / 2 / s; return out; }
      out.x0 = cam.L / TP; out.y0 = cam.T / TP; out.x1 = (cam.L + cam.aw) / TP; out.y1 = (cam.T + cam.ah) / TP;
      return out;
    },
    resize(nw, nh) {
      w = Math.max(1, nw | 0); h = Math.max(1, nh | 0);
      if (canvas) { canvas.width = w; canvas.height = h; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
      if (sctx) sctx.imageSmoothingEnabled = false;
      cam.aw = w / cam.scale; cam.ah = h / cam.scale;
    },
    setQuality(q) { quality = Math.max(0, Math.min(2, q | 0)); fx.setQuality(quality); },
    stats() { unknownList(); return st; },
    dispose() { unloadZone(); if (canvas) canvas.remove(); canvas = null; sctx = null; art = null; g = null; propCache.clear(); sprites.clear(); },
    /** added for tools: the screen canvas */
    get canvas() { return canvas; },
  };
  return r;
}

export default { create };
export { rgba };
