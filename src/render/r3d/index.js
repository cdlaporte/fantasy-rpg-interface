// STUB: replaced by the Render 3D package
// DEBUG renderer: vertex-colored ground (one merged mesh), instanced boxes for block tiles and props,
// spheres/capsules for entities, the section 7 camera (fixed yaw, north up, pitch 55, FOV 32).
// World mapping: world x -> three x, world y -> three z (south = +z, toward the camera), height z -> three y.
import * as THREE from 'three';
import { VIEW } from '../../contracts.js';

function lookColor(look) {
  if (!look) return '#ff00ff';
  if (look.rig === 'humanoid') return (look.outfit && look.outfit.primary) || '#4a90d9';
  if (look.colors && look.colors.body) return look.colors.body;
  return look.color || '#ffffff';
}

export function create() {
  let host = null, renderer = null, scene = null, camera = null;
  let w = 1, h = 1;
  let zoneGroup = null, zv = null;
  const entGroup = new THREE.Group();
  const fxGroup = new THREE.Group();
  const pool = new Map(); // ent id -> {mesh, tick, look}
  const fxActive = [];
  let tick = 0, lastT = 0;
  const st = { ms: 0, draws: 0, tris: 0, unknown: [] };
  const camState = { x: 0, y: 0, zoom: 1 };
  const v3 = new THREE.Vector3();
  const v3b = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
  const capsuleGeo = new THREE.CapsuleGeometry(0.22, 0.45, 4, 8);
  const noseGeo = new THREE.BoxGeometry(0.08, 0.08, 0.3);
  const ringGeo = new THREE.RingGeometry(0.85, 1, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const pitch = VIEW.CAMERA_PITCH_DEG * Math.PI / 180;

  function placeCamera() {
    // Distance chosen so the ground width at the focus matches 2D (w / 48 tiles at zoom 1).
    const tilesH = h / VIEW.TILE_PX;
    const fov = VIEW.CAMERA_FOV_DEG * Math.PI / 180;
    const d = tilesH / (2 * Math.tan(fov / 2)) / (camState.zoom || 1);
    camera.position.set(camState.x, Math.sin(pitch) * d, camState.y + Math.cos(pitch) * d);
    camera.lookAt(camState.x, 0, camState.y);
    camera.updateMatrixWorld();
  }

  function buildZone() {
    zoneGroup = new THREE.Group();
    const n = zv.w * zv.h;
    const pats = (zv.palette && zv.palette.patterns) || {};
    const cols = zv.tileDefs.map((d) => {
      const p = pats[d.pattern];
      return { a: new THREE.Color((p && p.a) || d.colors.a), b: new THREE.Color((p && p.b) || d.colors.b) };
    });
    const pos = new Float32Array(n * 12), col = new Float32Array(n * 12), idx = new Uint32Array(n * 6);
    let blocks = 0;
    for (let ty = 0; ty < zv.h; ty++) for (let tx = 0; tx < zv.w; tx++) {
      const i = ty * zv.w + tx;
      const def = zv.tileDefs[zv.tiles[i]];
      if (def.shape === 'block') blocks++;
      const c = (zv.variant[i] & 64) ? cols[zv.tiles[i]].b : cols[zv.tiles[i]].a;
      const y = def.shape === 'water' ? -0.08 : 0;
      const q = [tx, y, ty, tx + 1, y, ty, tx + 1, y, ty + 1, tx, y, ty + 1];
      pos.set(q, i * 12);
      for (let k = 0; k < 4; k++) col.set([c.r, c.g, c.b], i * 12 + k * 3);
      idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    zoneGroup.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));

    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const m4 = new THREE.Matrix4();
    if (blocks) {
      const inst = new THREE.InstancedMesh(box, mat, blocks);
      let k = 0;
      for (let ty = 0; ty < zv.h; ty++) for (let tx = 0; tx < zv.w; tx++) {
        const i = ty * zv.w + tx;
        const def = zv.tileDefs[zv.tiles[i]];
        if (def.shape !== 'block') continue;
        m4.makeScale(1, def.h || 1, 1).setPosition(tx + 0.5, 0, ty + 0.5);
        inst.setMatrixAt(k, m4);
        inst.setColorAt(k, cols[zv.tiles[i]].a);
        k++;
      }
      zoneGroup.add(inst);
    }
    if (zv.props.length) {
      const inst = new THREE.InstancedMesh(box, mat, zv.props.length);
      zv.props.forEach((p, k) => {
        const lk = p.look || {};
        const big = ['house', 'shop', 'tower', 'academy'].includes(p.kind);
        const ph = big ? 2.5 : (p.kind === 'tree' || p.kind === 'pine') ? 2 : (p.def && p.def.footprint ? 0.8 : 0.1);
        m4.makeScale(p.w * 0.9, ph, p.h * 0.9).setPosition(p.x + p.w / 2, 0, p.y + p.h / 2);
        inst.setMatrixAt(k, m4);
        inst.setColorAt(k, tmpColor.set(lk.wall || lk.leaves || lk.wood || lk.stone || lk.body || lk.cloth || lk.main || '#c98c50'));
      });
      zoneGroup.add(inst);
    }
    scene.add(zoneGroup);
  }

  function freeZone() {
    if (!zoneGroup) return;
    zoneGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    scene.remove(zoneGroup);
    zoneGroup = null;
  }

  function entMesh(e) {
    const lk = e.look || {};
    const color = new THREE.Color(lookColor(lk));
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true });
    const g = new THREE.Group();
    let body;
    if (lk.rig === 'humanoid') {
      body = new THREE.Mesh(capsuleGeo, mat);
      body.position.y = 0.45;
      body.scale.setScalar(lk.size || 1);
    } else if (lk.rig === 'effect') {
      body = new THREE.Mesh(ringGeo, mat);
      body.position.y = 0.03;
      body.scale.setScalar(lk.r || 0.5);
    } else {
      const s = lk.rig === 'projectile' ? 0.15 * (lk.size || 1) : 0.35 * (lk.size || 1);
      body = new THREE.Mesh(sphereGeo, mat);
      body.scale.setScalar(s);
      body.position.y = lk.rig === 'flyer' ? 1 : s;
    }
    g.add(body);
    const nose = new THREE.Mesh(noseGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    nose.position.set(0, body.position.y, 0.3);
    g.add(nose);
    g.userData.mat = mat;
    g.userData.color = color.clone();
    return g;
  }

  const r = {
    id: '3d',
    async init(hostEl) {
      host = hostEl;
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
      if (!renderer.getContext()) throw new Error('no WebGL context');
      renderer.setPixelRatio(1);
      renderer.domElement.className = 'r3d';
      host.insertBefore(renderer.domElement, host.firstChild);
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#bfe6ff');
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(-3, 10, 6);
      scene.add(sun);
      scene.add(entGroup, fxGroup);
      camera = new THREE.PerspectiveCamera(VIEW.CAMERA_FOV_DEG, 1, 0.5, 300);
      r.resize(host.clientWidth, host.clientHeight);
    },
    loadZone(zoneView) {
      freeZone();
      zv = zoneView;
      if (zv.palette && zv.palette.sky) scene.background = new THREE.Color(zv.palette.sky);
      buildZone();
    },
    unloadZone() { freeZone(); zv = null; },
    tileChanged() { if (zv) { freeZone(); buildZone(); } },
    render(frame) {
      const t0 = performance.now();
      tick++;
      camState.x = frame.camera.x; camState.y = frame.camera.y; camState.zoom = frame.camera.zoom || 1;
      if (frame.camera.shake) { camState.x += Math.sin(frame.t * 70) * frame.camera.shake * 0.15; }
      placeCamera();
      const a = frame.alpha;
      for (let i = 0; i < frame.entCount; i++) {
        const e = frame.ents[i];
        let p = pool.get(e.id);
        if (!p || p.lookRev !== e.lookRev || p.look !== e.look) {
          if (p) entGroup.remove(p.mesh);
          p = { mesh: entMesh(e), lookRev: e.lookRev, look: e.look, tick };
          pool.set(e.id, p);
          entGroup.add(p.mesh);
        }
        p.tick = tick;
        const m = p.mesh;
        m.position.set(e.px + (e.x - e.px) * a, e.z || 0, e.py + (e.y - e.py) * a);
        m.rotation.y = -e.angle + Math.PI / 2;
        m.scale.setScalar(e.scale || 1);
        m.userData.mat.opacity = e.alpha;
        m.userData.mat.color.copy(m.userData.color);
        if (e.tint) m.userData.mat.color.set(e.tint);
        if (e.flash > 0) m.userData.mat.color.lerp(tmpColor.set('#ffffff'), e.flash);
      }
      for (const [id, p] of pool) {
        if (p.tick !== tick) { entGroup.remove(p.mesh); p.mesh.userData.mat.dispose(); pool.delete(id); }
      }
      // fx: expanding rings / pillars
      const dt = Math.max(0, Math.min(0.1, frame.t - lastT)) || 1 / 60;
      lastT = frame.t;
      for (let i = 0; i < frame.fxCount; i++) {
        const f = frame.fx[i];
        if (f.type === 'text' || f.type === 'screenFlash') continue;
        const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: f.color || '#ffe066', transparent: true }));
        mesh.position.set(f.x, 0.05 + (f.z || 0), f.y);
        fxGroup.add(mesh);
        fxActive.push({ mesh, age: 0, dur: f.dur || 0.6, r: f.r || 1 });
      }
      for (let i = fxActive.length - 1; i >= 0; i--) {
        const f = fxActive[i];
        f.age += dt;
        if (f.age > f.dur) { fxGroup.remove(f.mesh); f.mesh.material.dispose(); fxActive.splice(i, 1); continue; }
        const k = f.age / f.dur;
        f.mesh.scale.setScalar(Math.max(0.05, f.r * k));
        f.mesh.material.opacity = 1 - k;
      }
      renderer.render(scene, camera);
      st.draws = renderer.info.render.calls;
      st.tris = renderer.info.render.triangles;
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
        let t = v3b.y < -1e-4 ? -camera.position.y / v3b.y : 200;
        t = Math.min(t, 200);
        const gx = camera.position.x + v3b.x * t, gz = camera.position.z + v3b.z * t;
        x0 = Math.min(x0, gx); x1 = Math.max(x1, gx); y0 = Math.min(y0, gz); y1 = Math.max(y1, gz);
      }
      out.x0 = x0; out.x1 = x1; out.y0 = y0; out.y1 = y1;
      return out;
    },
    resize(nw, nh) {
      w = Math.max(1, nw | 0); h = Math.max(1, nh | 0);
      if (!renderer) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      placeCamera();
    },
    setQuality() {},
    stats() { return st; },
    dispose() {
      freeZone();
      for (const p of pool.values()) p.mesh.userData.mat.dispose();
      pool.clear();
      if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
      renderer = null;
    },
    get canvas() { return renderer && renderer.domElement; },
  };
  return r;
}

export default { create };
