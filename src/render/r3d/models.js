// Entity model cache and instanced batches. A model is built once per distinct look (the look's JSON is the
// key, so kind + lookRev changes rebuild and identical looks share one model across entities and kinds) and
// drawn through one InstancedMesh (+ one outline InstancedMesh sharing the instance buffers). Per-instance
// data: instanceMatrix, instanceColor (tint), iPose0/iPose1 (part angles), iFx (flash, alpha, glow, leg bias),
// iGlow (glow color). Instances are refilled every frame; capacity doubles on demand (rare).
import * as THREE from 'three';
import { buildHumanoid } from './rigs/humanoid.js';
import { buildCreature } from './rigs/creatures.js';
import { buildProjectile, buildEffect } from './rigs/items.js';

const CREATURES = new Set(['quadruped', 'blob', 'flyer', 'plant', 'golem']);
const INST = [['iPose0', 4], ['iPose1', 4], ['iFx', 4], ['iGlow', 3]];

export function lookKey(look) {
  try { return JSON.stringify(look); } catch { return 'bad'; }
}

export function createModels(scene, mats, unknown) {
  const models = new Map();
  const active = [];
  let outlines = true;

  function build(look) {
    const rig = look && look.rig;
    if (rig === 'humanoid') return buildHumanoid(look, unknown);
    if (CREATURES.has(rig)) return buildCreature(look, unknown);
    if (rig === 'projectile') return buildProjectile(look, unknown);
    if (rig === 'effect') return buildEffect(look, unknown);
    unknown.add('rig:' + rig);
    return buildCreature({ rig: 'blob', colors: { body: '#ff8fc7' }, features: [] }, unknown);
  }

  function makeMeshes(m, cap) {
    const geo = m.geo;
    if (m.mesh) {
      scene.remove(m.mesh); scene.remove(m.line);
      geo.dispose();             // frees GPU buffers of every attribute; they re-upload with the new sizes
      m.lineGeo.dispose();
      m.mesh.dispose(); m.line.dispose();
    }
    m.cap = cap;
    const attrs = {};
    for (const [name, size] of INST) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      attrs[name] = a;
      geo.setAttribute(name, a);
    }
    m.attrs = attrs;
    const mesh = new THREE.InstancedMesh(geo, mats.char, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    // outline: a second geometry object sharing every attribute, drawing only the outlined index range
    const lg = new THREE.BufferGeometry();
    for (const k in geo.attributes) lg.setAttribute(k, geo.attributes[k]);
    lg.setIndex(geo.index);
    lg.setDrawRange(0, geo.userData.lineCount);
    const line = new THREE.InstancedMesh(lg, mats.charLine, cap);
    line.instanceMatrix = mesh.instanceMatrix;
    line.instanceColor = mesh.instanceColor;
    line.frustumCulled = false;
    line.count = 0;
    m.mesh = mesh; m.line = line; m.lineGeo = lg;
    scene.add(mesh); scene.add(line);
  }

  /** Get (or build) the model for a look. Returns {key, meta, geo|null, ...}. */
  function get(look, key) {
    let m = models.get(key);
    if (m) { m.refs++; return m; }
    const built = build(look || {});
    m = { key, geo: built.geo, meta: built.meta, refs: 1, idle: 0, n: 0, cap: 0, mesh: null, line: null, lineGeo: null, attrs: null, listed: false,
      rig: (look && look.rig) || 'blob' };
    if (m.geo) {
      if (m.geo.userData.lineCount === 0 || m.meta.lineless) m.geo.userData.lineCount = m.meta.lineless ? 0 : m.geo.userData.lineCount;
      makeMeshes(m, m.rig === 'humanoid' ? 4 : 8);
    }
    models.set(key, m);
    return m;
  }

  function release(m) { if (m) m.refs--; }

  const _m4 = new THREE.Matrix4();
  /** Add one instance. mat: Matrix4 world; pose: Pose; tint: Color|null; glowC: Color|null. */
  function draw(m, mat, pose, tint, tintAmt, flash, alpha, glowAmt, glowC) {
    if (!m.geo) return;
    if (m.n >= m.cap) {
      if (m.cap >= 512) return;
      const old = m.mesh.instanceMatrix.array, oldC = m.mesh.instanceColor.array;
      const oldA = {};
      for (const [name] of INST) oldA[name] = m.attrs[name].array;
      makeMeshes(m, m.cap * 2);
      m.mesh.instanceMatrix.array.set(old);
      m.mesh.instanceColor.array.set(oldC);
      for (const [name] of INST) m.attrs[name].array.set(oldA[name]);
    }
    if (!m.listed) { active.push(m); m.listed = true; }
    const i = m.n++;
    mat.toArray(m.mesh.instanceMatrix.array, i * 16);
    const c = m.mesh.instanceColor.array;
    if (tint && tintAmt > 0) {
      c[i * 3] = 1 + (tint.r - 1) * tintAmt; c[i * 3 + 1] = 1 + (tint.g - 1) * tintAmt; c[i * 3 + 2] = 1 + (tint.b - 1) * tintAmt;
    } else { c[i * 3] = 1; c[i * 3 + 1] = 1; c[i * 3 + 2] = 1; }
    const p0 = m.attrs.iPose0.array, p1 = m.attrs.iPose1.array, fx = m.attrs.iFx.array, g = m.attrs.iGlow.array;
    p0[i * 4] = pose.p0[0]; p0[i * 4 + 1] = pose.p0[1]; p0[i * 4 + 2] = pose.p0[2]; p0[i * 4 + 3] = pose.p0[3];
    p1[i * 4] = pose.p1[0]; p1[i * 4 + 1] = pose.p1[1]; p1[i * 4 + 2] = pose.p1[2]; p1[i * 4 + 3] = pose.p1[3];
    fx[i * 4] = flash; fx[i * 4 + 1] = alpha; fx[i * 4 + 2] = glowAmt; fx[i * 4 + 3] = pose.legB || 0;
    if (glowC) { g[i * 3] = glowC.r; g[i * 3 + 1] = glowC.g; g[i * 3 + 2] = glowC.b; } else { g[i * 3] = 0; g[i * 3 + 1] = 0; g[i * 3 + 2] = 0; }
  }
  void _m4;

  return {
    get, release, draw,
    begin() {
      for (const m of active) m.n = 0;
    },
    end() {
      for (let j = active.length - 1; j >= 0; j--) {
        const m = active[j];
        m.mesh.count = m.n; m.line.count = m.n;
        m.mesh.visible = m.n > 0;
        m.line.visible = outlines && m.n > 0 && m.geo.userData.lineCount > 0;
        if (m.n) {
          m.mesh.instanceMatrix.needsUpdate = true;
          m.mesh.instanceColor.needsUpdate = true;
          for (const [name] of INST) m.attrs[name].needsUpdate = true;
        } else {
          active.splice(j, 1); m.listed = false;
        }
      }
    },
    setOutlines(on) { outlines = on; },
    /** Free models nobody references for a while (keeps up to `keep` idle ones). */
    gc(keep = 48) {
      let idle = 0;
      for (const m of models.values()) if (m.refs <= 0) idle++;
      if (idle <= keep) return;
      for (const [k, m] of models) {
        if (m.refs > 0 || m.listed) continue;
        dispose1(m);
        models.delete(k);
        if (--idle <= keep) break;
      }
    },
    count() { return models.size; },
    clear() { for (const m of models.values()) dispose1(m); models.clear(); active.length = 0; },
  };

  function dispose1(m) {
    if (!m.geo) return;
    scene.remove(m.mesh); scene.remove(m.line);
    m.geo.dispose(); m.lineGeo.dispose(); m.mesh.dispose(); m.line.dispose();
  }
}
