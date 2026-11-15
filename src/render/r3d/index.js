// 3D "toy box" renderer (CONTRACTS section 7). A tilted top-down diorama of cel-shaded, outlined toys.
// World mapping: world x -> three x, world y -> three z (south = +z, toward the camera), height z -> three y.
// Modules: toon.js (materials, <= 7 programs), kit.js (geometry builder), terrain.js + props.js (static
// chunks), models.js + rigs/* (entity models, instanced, shader-posed), fx.js + fxgeo.js (instanced fx).
import * as THREE from 'three';
import { VIEW } from '../../contracts.js';
import { createMaterials, disposeMaterials, U } from './toon.js';
import { prepareZone, buildChunk, CHUNK } from './terrain.js';
import { createModels, lookKey } from './models.js';
import { createFx } from './fx.js';
import { makePose, pose } from './rigs/pose.js';
import { C } from './kit.js';

const SCALES = [0.6, 0.8, 1];
const DAY = {
  morning: { sun: new THREE.Color(1.0, 0.95, 0.88), sky: new THREE.Color(1.0, 0.97, 0.95), sunI: 2.1, hemiI: 1.75 },
  day: { sun: new THREE.Color(1, 1, 1), sky: new THREE.Color(1, 1, 1), sunI: 2.2, hemiI: 1.8 },
  evening: { sun: new THREE.Color(1.0, 0.82, 0.66), sky: new THREE.Color(0.96, 0.86, 0.9), sunI: 1.9, hemiI: 1.65 },
};

export function create() {
  let host = null, renderer = null, scene = null, camera = null, canvas = null;
  let mats = null, models = null, fx = null;
  let sun = null, hemi = null;
  let w = 1, h = 1, quality = 1, scale = 0.8;
  let lost = false;
  let zd = null;                 // prepared zone
  let chunks = [];               // {cx, cy, mesh, line, water, geo, wgeo, lineGeo, emitters}
  let chunkCols = 0, chunkRows = 0;
  let emitters = [];
  let tick = 0, lastT = -1;
  const unknown = new Set();
  let unknownList = [];
  let unknownSize = 0;
  const st = { ms: 0, draws: 0, tris: 0, unknown: unknownList, programs: 0, models: 0, fxInstances: 0, chunks: 0, chunkTris: 0, loadMs: 0 };
  const camState = { x: 0, y: 0, zoom: 1 };
  const v3 = new THREE.Vector3();
  const v3b = new THREE.Vector3();
  const pitch = VIEW.CAMERA_PITCH_DEG * Math.PI / 180;
  const skyBase = new THREE.Color('#bfe6ff');
  const tintC = new THREE.Color();
  const ents = new Map();        // id -> EntState
  const P = makePose();
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler(0, 0, 0, 'YXZ');
  const POS = new THREE.Vector3();
  const SC = new THREE.Vector3();
  const OFF = new THREE.Vector3();
  const glowC = new THREE.Color();
  const tintE = new THREE.Color();
  const auraC = new THREE.Color();
  const tipW = [0, 0, 0];
  const ghosts = [];
  for (let i = 0; i < 24; i++) ghosts.push({ on: false, model: null, mat: new THREE.Matrix4(), pose: makePose(), color: new THREE.Color(), t0: 0, dur: 0.45 });
  let decor = 1;
  let curT = 0;

  function placeCamera() {
    // Distance chosen so the framing matches the 2D view at the focus (see skeleton note 17).
    const tilesH = h / VIEW.TILE_PX;
    const fov = VIEW.CAMERA_FOV_DEG * Math.PI / 180;
    const d = tilesH / (2 * Math.tan(fov / 2)) / (camState.zoom || 1);
    camera.position.set(camState.x, Math.sin(pitch) * d, camState.y + Math.cos(pitch) * d);
    camera.lookAt(camState.x, 0, camState.y);
    camera.updateMatrixWorld();
    return d;
  }

  // ---------------- zone ----------------
  function freeZone() {
    for (const c of chunks) freeChunk(c);
    chunks = [];
    emitters = [];
    zd = null;
    if (fx) fx.clear();
  }
  function freeChunk(c) {
    if (!c) return;
    for (const m of [c.mesh, c.line, c.water]) if (m) scene.remove(m);
    if (c.geo) c.geo.dispose();
    if (c.lineGeo) c.lineGeo.dispose();
    if (c.wgeo) c.wgeo.dispose();
  }
  function buildChunkAt(cx, cy) {
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    const here = [];
    for (const p of zd.zv.props) {
      const fw = (p.def && p.def.footprint) ? (p.w || 1) : 1, fh = (p.def && p.def.footprint) ? (p.h || 1) : 1;
      const mx = p.x + fw / 2, my = p.y + fh / 2;
      if (mx >= x0 && mx < x0 + CHUNK && my >= y0 && my < y0 + CHUNK) here.push(p);
      else if (cx === 0 && mx < 0 && my >= y0 && my < y0 + CHUNK) here.push(p);
      else if (cy === 0 && my < 0 && mx >= x0 && mx < x0 + CHUNK) here.push(p);
    }
    const b = buildChunk(zd, cx, cy, here, decor, unknown);
    const c = { cx, cy, geo: b.geo, wgeo: b.water, mesh: null, line: null, water: null, lineGeo: null, emitters: b.emitters, tris: b.tris };
    if (b.geo) {
      c.mesh = new THREE.Mesh(b.geo, mats.chunk);
      scene.add(c.mesh);
      const lc = b.geo.userData.lineCount;
      if (lc > 0) {
        const lg = new THREE.BufferGeometry();
        for (const k in b.geo.attributes) lg.setAttribute(k, b.geo.attributes[k]);
        lg.setIndex(b.geo.index);
        lg.setDrawRange(0, lc);
        lg.boundingSphere = b.geo.boundingSphere.clone();
        lg.boundingSphere.radius += 0.2;
        c.lineGeo = lg;
        c.line = new THREE.Mesh(lg, mats.chunkLine);
        c.line.visible = quality > 0;
        scene.add(c.line);
      }
    }
    if (b.water) {
      c.water = new THREE.Mesh(b.water, mats.water);
      scene.add(c.water);
    }
    return c;
  }
  function buildZoneMeshes() {
    chunkCols = Math.ceil(zd.zv.w / CHUNK);
    chunkRows = Math.ceil(zd.zv.h / CHUNK);
    chunks = new Array(chunkCols * chunkRows);
    emitters = [];
    let tris = 0;
    for (let cy = 0; cy < chunkRows; cy++) {
      for (let cx = 0; cx < chunkCols; cx++) {
        const c = buildChunkAt(cx, cy);
        chunks[cy * chunkCols + cx] = c;
        tris += c.tris;
      }
    }
    collectEmitters();
    st.chunks = chunks.length;
    st.chunkTris = tris;
    refreshUnknown();
  }
  function collectEmitters() {
    emitters = [];
    for (const c of chunks) if (c) for (const e of c.emitters) emitters.push(e);
  }
  function refreshUnknown() {
    if (unknown.size === unknownSize) return;
    unknownSize = unknown.size;
    unknownList = Array.from(unknown).sort();
    st.unknown = unknownList;
  }

  // ---------------- entities ----------------
  function entState(e) {
    let s = ents.get(e.id);
    if (!s) {
      s = { id: e.id, look: null, lookRev: -1, model: null, tick: 0, seed: (e.id * 0.618) % 1 * 10, mat: new THREE.Matrix4(), pose: makePose(), hasMat: false };
      ents.set(e.id, s);
    }
    if (s.look !== e.look || s.lookRev !== e.lookRev || !s.model) {
      const key = lookKey(e.look);
      if (!s.model || s.model.key !== key) {
        const m = models.get(e.look || {}, key);
        if (s.model) models.release(s.model);
        s.model = m;
      }
      s.look = e.look; s.lookRev = e.lookRev;
    }
    s.tick = tick;
    return s;
  }

  function drawEntity(e, a, t) {
    const s = entState(e);
    const m = s.model;
    const look = e.look || {};
    const rig = look.rig || 'blob';
    const meta = m.meta;
    const x = e.px + (e.x - e.px) * a;
    const y = e.py + (e.y - e.py) * a;
    const z = e.z || 0;
    const size = (look.size || 1) * (e.scale === undefined ? 1 : e.scale);
    let yaw = Math.PI / 2 - (e.angle || 0);
    let gy = z;
    if (rig === 'projectile') {
      gy = 0.45 + z;
      P.x = 0; P.y = 0; P.z = 0; P.pitch = 0; P.roll = 0; P.yaw = 0; P.sx = P.sy = P.sz = 1; P.glow = 0; P.legB = 0;
      P.p0[0] = P.p0[1] = P.p0[2] = P.p0[3] = 0; P.p1[0] = P.p1[1] = P.p1[2] = P.p1[3] = 0;
      if (meta.spin === 'flat') P.yaw = t * 18;
      else if (meta.spin === 'roll') P.pitch = t * 10;
      else if (meta.spin === 'flip') P.roll = t * 9;
    } else if (rig === 'effect') {
      P.x = 0; P.y = 0; P.z = 0; P.pitch = 0; P.roll = 0; P.yaw = 0; P.sx = P.sy = P.sz = 1; P.glow = 0; P.legB = 0;
      P.p0[0] = P.p0[1] = P.p0[2] = P.p0[3] = 0; P.p1[0] = P.p1[1] = P.p1[2] = P.p1[3] = 0;
      if (meta.bob) P.y = 0.08 + 0.06 * Math.sin(t * 3 + s.seed);
      if (meta.spin) P.yaw = t * 1.8;
      if (meta.wobble) { P.sy = 1 + 0.06 * Math.sin(t * 5); P.sx = P.sz = 1 - 0.03 * Math.sin(t * 5); }
      if (meta.pulse) P.glow = 0.3 + 0.3 * Math.sin(t * 4);
      if (meta.model !== 'meteor') yaw = 0;
      if (meta.model === 'telegraph_line' || meta.model === 'telegraph_cone') yaw = 0;
    } else {
      pose(P, rig, e.anim || 'idle', e.animT || 0, e.dir, e.moving, t, s.seed);
    }
    // world matrix: T(pos + R*offset) * R(yaw+, pitch, roll) * S
    E.set(P.pitch, yaw + P.yaw, P.roll, 'YXZ');
    Q.setFromEuler(E);
    OFF.set(P.x * size, P.y * size, P.z * size).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    POS.set(x + OFF.x, gy + OFF.y, y + OFF.z);
    SC.set(size * P.sx, size * P.sy, size * P.sz);
    M.compose(POS, Q, SC);
    s.mat.copy(M);
    s.hasMat = true;
    copyPose(s.pose, P);
    // glow / tint / flash
    let glowAmt = 0;
    let gC = null;
    if (e.glow) { glowC.copy(C(e.glow)); glowAmt = 0.55; gC = glowC; }
    else if (meta.glowAll) { glowC.copy(C(meta.glowAll)); glowAmt = 0.45; gC = glowC; }
    if (P.glow > 0) {
      if (!gC) { glowC.copy(C(meta.glow || '#ffe680')); gC = glowC; }
      glowAmt += P.glow * 0.6;
    }
    let tAmt = 0;
    if (e.tint) { tintE.copy(C(e.tint)); tAmt = 0.55; }
    const flash = e.flash > 0 ? Math.min(1, e.flash) : 0;
    const alpha = e.alpha === undefined ? 1 : Math.max(0, Math.min(1, e.alpha));
    models.draw(m, M, P, tAmt ? tintE : null, tAmt, flash, alpha, glowAmt, gC);

    // shadow
    const H = (meta.height || 0.6) * size;
    const R = Math.max(0.22, (e.radius || 0.3) * 1.15) * (rig === 'humanoid' ? size : 1) + (rig === 'golem' ? 0.12 * size : 0);
    if (rig !== 'effect' && rig !== 'projectile') {
      const air = Math.max(0, (meta.flyer ? 0.7 : 0) + z);
      fx.shadow(x, y, R * (1 - Math.min(0.5, air * 0.2)), (0.5 - Math.min(0.3, air * 0.15)) * alpha);
    } else if (rig === 'projectile' && !meta.empty) {
      fx.shadow(x, y, 0.16 * size, 0.35);
    } else if (rig === 'effect' && !meta.empty && meta.model !== 'meteor') {
      fx.shadow(x, y, 0.38 * size, 0.4);
    }
    // weapon tip in world space (approximate: ignores the arm swing)
    const tip = meta.tip;
    if (tip) {
      v3.set(tip[0], tip[1], tip[2]).applyMatrix4(M);
      tipW[0] = v3.x; tipW[1] = v3.y; tipW[2] = v3.z;
    }
    if (rig === 'humanoid') {
      const spec = meta.s;
      if (spec.aura && quality >= 0) { auraC.copy(C(spec.aura.color)); fx.aura(spec.aura.style, auraC, x, y, H, t, s.seed); }
      if (meta.glowAt && meta.glow) {
        v3.set(meta.glowAt[0], meta.glowAt[1], meta.glowAt[2]).applyMatrix4(M);
        glowC.copy(C(meta.glow));
        fx.glowAt(v3.x, v3.z, v3.y, 0.2 + 0.03 * Math.sin(t * 5 + s.seed), glowC, 0.55 * alpha);
      }
    } else if (rig === 'effect') {
      fx.effect(look, meta, x, y, z, e.angle || 0, t, s.seed, alpha);
    } else if (rig === 'projectile') {
      fx.projectile(look, meta, x, y, gy, e.angle || 0, t, s.seed, e.moving);
    } else if (meta.glowAt) {
      v3.set(meta.glowAt[0], meta.glowAt[1], meta.glowAt[2]).applyMatrix4(M);
      auraC.copy(C((look.colors && look.colors.accent) || '#ffe680'));
      fx.glowAt(v3.x, v3.z, v3.y, 0.35 * size, auraC, 0.6 * alpha);
    }
    if (rig === 'humanoid' || rig === 'quadruped' || rig === 'blob' || rig === 'flyer' || rig === 'plant' || rig === 'golem') {
      if (e.anim === 'sleep' && !(e.fxTags && e.fxTags.includes('sleep'))) fx.tag('sleep', x, y, H * 0.7, R, t, s.seed, e.angle || 0, null);
    }
    // persistent fxTags
    const tags = e.fxTags;
    if (tags && tags.length) {
      const top = H + (meta.flyer ? 0.75 : 0) + z;
      for (let i = 0; i < tags.length; i++) fx.tag(tags[i], x, y, top, R * 0.85, t, s.seed, e.angle || 0, tip ? tipW : null);
    }
  }

  function forgetStale(s, id) {
    if (s.tick !== tick) { models.release(s.model); ents.delete(id); }
  }

  function copyPose(dst, src) {
    dst.x = src.x; dst.y = src.y; dst.z = src.z; dst.yaw = src.yaw; dst.pitch = src.pitch; dst.roll = src.roll;
    dst.sx = src.sx; dst.sy = src.sy; dst.sz = src.sz; dst.glow = src.glow; dst.legB = src.legB;
    for (let i = 0; i < 4; i++) { dst.p0[i] = src.p0[i]; dst.p1[i] = src.p1[i]; }
  }

  function spawnGhost(f, t) {
    const s = f.ent !== null && f.ent !== undefined ? ents.get(f.ent) : null;
    if (!s || !s.model || !s.hasMat || !s.model.geo) return;
    let g = null;
    for (const gg of ghosts) if (!gg.on) { g = gg; break; }
    if (!g) { g = ghosts[0]; for (const gg of ghosts) if (gg.t0 < g.t0) g = gg; models.release(g.model); }
    g.on = true; g.t0 = t; g.dur = f.dur > 0 ? f.dur : 0.45;
    g.model = s.model; s.model.refs++;
    g.mat.copy(s.mat);
    if (f.x || f.y) {
      // place the ghost at the event position (keep the height)
      g.mat.elements[12] = f.x; g.mat.elements[14] = f.y;
    }
    copyPose(g.pose, s.pose);
    g.color.copy(C(f.color || '#9fe6ff'));
  }

  function drawGhosts(t) {
    for (const g of ghosts) {
      if (!g.on) continue;
      const k = (t - g.t0) / g.dur;
      if (k >= 1 || k < -0.01) { g.on = false; models.release(g.model); g.model = null; continue; }
      models.draw(g.model, g.mat, g.pose, g.color, 0.85, 0.15 * (1 - k), 0.6 * (1 - k), 0.9, g.color);
    }
  }

  // ---------------- emitters ----------------
  const em = new THREE.Color();
  function drawEmitters(t, rect) {
    for (let i = 0; i < emitters.length; i++) {
      const e = emitters[i];
      if (e.x < rect.x0 - 2 || e.x > rect.x1 + 2 || e.y < rect.y0 - 2 || e.y > rect.y1 + 3) continue;
      if (e.type !== 'shadow') em.copy(C(e.color));
      const sd = i * 1.37;
      switch (e.type) {
        case 'lamp':
          fx.glowAt(e.x, e.y, e.h, 0.55 + 0.04 * Math.sin(t * 7 + sd), em, 0.55);
          break;
        case 'fire':
          fx.glowAt(e.x, e.y, e.h + 0.1, 0.8, em, 0.55);
          for (let j = 0; j < 3; j++) {
            const u = (t * 1.8 + j / 3 + sd) % 1;
            fx.bill('flame', e.x + Math.sin(j * 2.1) * 0.08, e.y + 0.02, e.h + u * 0.35, Math.sin(t * 8 + j) * 0.2, 0.35 * (1 - u * 0.6), em, 1 - u);
            const v = (t * 0.9 + j / 3 + sd) % 1;
            fx.bill('dot', e.x + Math.sin(j * 3 + t) * 0.15, e.y, e.h + v * 1.4, 0, 0.04, em, 1 - v);
          }
          break;
        case 'fountain':
          for (let j = 0; j < 8; j++) {
            const u = (t * 0.9 + j / 8) % 1;
            const ang = (j / 8) * Math.PI * 2;
            const d = u * 0.55;
            const hh = e.h + 0.25 + 1.2 * u - 1.9 * u * u;
            fx.bill('dot', e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d, Math.max(0.3, hh), 0, 0.07, em, 0.9);
          }
          for (let j = 0; j < 2; j++) {
            const u = (t * 0.5 + j / 2) % 1;
            fx.ground('ringN', e.x, e.y, 0.3, 0, 0.3 + (e.r || 1) * 0.6 * u, 0.3 + (e.r || 1) * 0.6 * u, em, 0.5 * (1 - u));
          }
          break;
        case 'bubbles':
          fx.glowAt(e.x, e.y, e.h + 0.1, 0.45, em, 0.5);
          for (let j = 0; j < 3; j++) {
            const u = (t * 0.8 + j / 3 + sd) % 1;
            fx.bill('dotN', e.x + Math.sin(j * 2.4) * 0.15, e.y + Math.cos(j * 2.4) * 0.1, e.h + u * 0.5, 0, 0.06 * (1 - u * 0.5), em, 1 - u);
          }
          break;
        case 'crystal': {
          const g = (t * 0.5 + sd) % 1;
          if (g < 0.3) fx.bill('star', e.x + 0.15, e.y + 0.1, e.h, t * 3, 0.15 * Math.sin(g / 0.3 * Math.PI), em, 1);
          fx.glowAt(e.x, e.y, e.h * 0.6, 0.6, em, 0.3);
          break;
        }
        case 'chimney':
          if (quality === 0) break;
          for (let j = 0; j < 3; j++) {
            const u = (t * 0.25 + j / 3 + sd) % 1;
            fx.ball('puff', e.x + u * 0.3, e.y - u * 0.15, e.h + u * 1.0, 0.09 + u * 0.12, em, 0.8 * (1 - u));
          }
          break;
        case 'shadow':
          fx.shadow(e.x, e.y, e.r, 0.32);
          break;
        case 'rune':
          fx.glowAt(e.x, e.y + 0.1, e.h, 0.9 + 0.1 * Math.sin(t * 3 + sd), em, 0.35);
          break;
        default: break;
      }
    }
  }

  // ---------------- ambience ----------------
  function ambience(frame) {
    const amb = frame.ambience || null;
    const dp = DAY[(amb && amb.daypart) || 'day'] || DAY.day;
    let tAmt = 0;
    if (amb && amb.tint) { tintC.copy(C(amb.tint)); tAmt = Math.max(0, Math.min(0.35, amb.tintAmount || 0)); }
    sun.color.copy(dp.sun);
    hemi.color.copy(dp.sky);
    if (tAmt > 0) { sun.color.lerp(tintC, tAmt * 1.6); hemi.color.lerp(tintC, tAmt * 1.2); }
    sun.intensity = dp.sunI; hemi.intensity = dp.hemiI;
    scene.background.copy(skyBase);
    if (tAmt > 0) scene.background.lerp(tintC, tAmt);
    U.uRim.value.copy(hemi.color);
  }

  function applyScale() {
    if (!renderer) return;
    const bw = Math.max(1, Math.round(w * scale)), bh = Math.max(1, Math.round(h * scale));
    renderer.setSize(bw, bh, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  const rectTmp = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const sp = new THREE.Vector3();

  const r = {
    id: '3d',
    async init(hostEl, opts = {}) {
      host = hostEl;
      quality = Math.max(0, Math.min(2, (opts.quality ?? 1) | 0));
      scale = SCALES[quality];
      decor = quality;
      canvas = document.createElement('canvas');
      canvas.className = 'r3d';
      const onLost = (ev) => {
        ev.preventDefault();
        lost = true;
        console.warn('[r3d] WebGL context lost; rendering paused');
        try { host.dispatchEvent(new CustomEvent('r3d:contextlost', { bubbles: true })); } catch { /* ignore */ }
      };
      canvas.addEventListener('webglcontextlost', onLost, false);
      canvas.addEventListener('webglcontextrestored', () => { lost = false; console.warn('[r3d] WebGL context restored'); }, false);
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, alpha: false, powerPreference: 'high-performance' });
      const gl = renderer.getContext();
      if (!gl || (gl.isContextLost && gl.isContextLost())) throw new Error('no WebGL context');
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      host.insertBefore(canvas, host.firstChild);
      scene = new THREE.Scene();
      scene.background = skyBase.clone();
      hemi = new THREE.HemisphereLight(0xffffff, 0x9a90a8, 1.8);
      sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(-4, 10, 7);
      scene.add(hemi, sun, sun.target);
      camera = new THREE.PerspectiveCamera(VIEW.CAMERA_FOV_DEG, 1, 0.5, 400);
      mats = createMaterials();
      models = createModels(scene, mats, unknown);
      fx = createFx(scene, mats, camera, unknown);
      fx.setQuality(quality);
      models.setOutlines(quality > 0);
      r.resize(host.clientWidth, host.clientHeight);
    },
    loadZone(zoneView) {
      freeZone();
      if (!zoneView) return;
      const l0 = performance.now();
      zd = prepareZone(zoneView, unknown);
      try { skyBase.set((zoneView.palette && zoneView.palette.sky) || '#bfe6ff'); } catch { skyBase.set('#bfe6ff'); }
      buildZoneMeshes();
      st.loadMs = Math.round(performance.now() - l0);
    },
    unloadZone() { freeZone(); },
    tileChanged(tx, ty) {
      if (!zd) return;
      const cx0 = Math.floor((tx - 1) / CHUNK), cx1 = Math.floor((tx + 1) / CHUNK);
      const cy0 = Math.floor((ty - 1) / CHUNK), cy1 = Math.floor((ty + 1) / CHUNK);
      for (let cy = Math.max(0, cy0); cy <= Math.min(chunkRows - 1, cy1); cy++) {
        for (let cx = Math.max(0, cx0); cx <= Math.min(chunkCols - 1, cx1); cx++) {
          const i = cy * chunkCols + cx;
          freeChunk(chunks[i]);
          chunks[i] = buildChunkAt(cx, cy);
        }
      }
      collectEmitters();
    },
    render(frame) {
      if (!renderer || lost) return;
      const t0 = performance.now();
      tick++;
      const t = frame.t || 0;
      curT = t;
      if (lastT < 0 || t < lastT - 1) lastT = t;
      lastT = t;
      camState.x = frame.camera.x; camState.y = frame.camera.y; camState.zoom = frame.camera.zoom || 1;
      const shake = frame.camera.shake || 0;
      if (shake > 0) {
        camState.x += (Math.sin(t * 71) + Math.sin(t * 43) * 0.5) * shake * 0.12;
        camState.y += (Math.cos(t * 67) + Math.sin(t * 29) * 0.5) * shake * 0.1;
      }
      const dist = placeCamera();
      ambience(frame);
      U.uTime.value = t;
      // outline width: ~2 px at any zoom (world width grows with the camera distance)
      U.uOutline.value = Math.max(0.018, Math.min(0.09, dist * 0.0021 * (h > 0 ? 657 / Math.max(300, h) : 1) / Math.max(0.75, scale)));
      // see-through cutaway around the player (only when a player entity is in the frame)
      const bh = Math.max(1, Math.round(h * scale));
      const a = frame.alpha === undefined ? 1 : frame.alpha;
      let pl = null;
      for (let i = 0; i < frame.entCount; i++) if (frame.ents[i].type === 'player') { pl = frame.ents[i]; break; }
      if (pl && zd) {
        const px = pl.px + (pl.x - pl.px) * a, py = pl.py + (pl.y - pl.py) * a;
        sp.set(px, 0.55 + (pl.z || 0), py).project(camera);
        const pxPerTile = bh / (h / VIEW.TILE_PX / (camState.zoom || 1));
        U.uCutPos.value.set(px, 0, py);
        U.uCutScreen.value.set((sp.x * 0.5 + 0.5) * Math.round(w * scale), (sp.y * 0.5 + 0.5) * bh, pxPerTile * 1.35);
      } else U.uCutScreen.value.z = 0;
      r.viewRect(rectTmp);

      models.begin();
      fx.begin(camera);
      // one-shot fx
      for (let i = 0; i < frame.fxCount; i++) {
        const f = frame.fx[i];
        if (f.type === 'afterimage') { spawnGhost(f, t); continue; }
        if (f.type === 'text') continue;
        fx.spawn(f, t);
      }
      for (let i = 0; i < frame.entCount; i++) drawEntity(frame.ents[i], a, t);
      // forget entities not seen this frame
      ents.forEach(forgetStale);
      drawGhosts(t);
      drawEmitters(t, rectTmp);
      fx.update(t);
      fx.end(camera);
      models.end();
      if ((tick & 255) === 0) models.gc();
      refreshUnknown();

      renderer.render(scene, camera);
      st.draws = renderer.info.render.calls;
      st.tris = renderer.info.render.triangles;
      st.programs = renderer.info.programs ? renderer.info.programs.length : 0;
      st.models = models.count();
      st.fxInstances = fx.instanceCount();
      st.ms = performance.now() - t0;
    },
    project(wx, wy, wz, out) {
      v3.set(wx, wz || 0, wy).project(camera);
      out.x = (v3.x * 0.5 + 0.5) * w;
      out.y = (-v3.y * 0.5 + 0.5) * h;
      out.on = v3.z > -1 && v3.z < 1 && out.x >= 0 && out.y >= 0 && out.x <= w && out.y <= h;
      return out;
    },
    viewRect(out) {
      // Intersect the four corner rays with the ground plane (three y = 0).
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < 4; i++) {
        v3.set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, 0.5).unproject(camera);
        v3b.copy(v3).sub(camera.position).normalize();
        let tt = v3b.y < -1e-4 ? -camera.position.y / v3b.y : 200;
        tt = Math.min(tt, 200);
        const gx = camera.position.x + v3b.x * tt, gz = camera.position.z + v3b.z * tt;
        x0 = Math.min(x0, gx); x1 = Math.max(x1, gx); y0 = Math.min(y0, gz); y1 = Math.max(y1, gz);
      }
      out.x0 = x0; out.x1 = x1; out.y0 = y0; out.y1 = y1;
      return out;
    },
    resize(nw, nh) {
      w = Math.max(1, nw | 0); h = Math.max(1, nh | 0);
      if (!renderer) return;
      applyScale();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      placeCamera();
    },
    setQuality(q) {
      q = Math.max(0, Math.min(2, q | 0));
      if (q === quality) return;
      quality = q;
      scale = SCALES[q];
      applyScale();
      models.setOutlines(q > 0);
      fx.setQuality(q);
      for (const c of chunks) if (c && c.line) c.line.visible = q > 0;
      if (decor !== q) {
        decor = q;
        if (zd) { const z = zd.zv; freeZone(); zd = prepareZone(z, unknown); buildZoneMeshes(); }
      }
    },
    stats() { return st; },
    dispose() {
      freeZone();
      if (models) models.clear();
      if (fx) fx.dispose();
      if (mats) disposeMaterials(mats);
      ents.clear();
      if (renderer) { renderer.dispose(); if (canvas) canvas.remove(); }
      renderer = null; models = null; fx = null; mats = null; scene = null;
    },
    get canvas() { return canvas; },
    /** Added (tests/debug): the three.js scene and camera. */
    get scene() { return scene; },
    get camera() { return camera; },
    get webgl() { return renderer; },
    /** Added: the current quality level. */
    get quality() { return quality; },
  };
  void curT;
  return r;
}

export default { create };
