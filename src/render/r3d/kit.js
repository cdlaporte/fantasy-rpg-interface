// ModelKit: builds merged, vertex-colored, outline-ready geometry from primitives at load time.
// Every primitive comes from a cached template (positions, normals, index, smooth normals for the
// inverted-hull outline, local bbox). Kit.add() transforms a template into the growing arrays.
// Colors are rgba where a = 1 - emissive (the shaders draw emissive parts unlit).
// Triangles added while `kit.lineless` is true are placed after the outlined ones, and the build
// reports `lineCount` (index count of outlined triangles) so outline meshes draw only that range.
import * as THREE from 'three';

const COLORS = new Map();
/** Linear THREE.Color for '#hex' (cached; do not mutate). */
export function C(hex) {
  if (hex && hex.isColor) return hex;
  let c = COLORS.get(hex);
  if (!c) {
    c = new THREE.Color();
    try { c.set(typeof hex === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(hex) ? hex : '#ff00ff'); } catch { c.set('#ff00ff'); }
    COLORS.set(hex, c);
  }
  return c;
}
/** New color = c * k (clamped). */
export function mul(c, k) { c = C(c); return new THREE.Color(Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k)); }
/** New color = mix(a, b, t). */
export function mix(a, b, t) { return C(a).clone().lerp(C(b), t); }
/** Brighten toward white by t. */
export function lighten(c, t) { return mix(c, '#ffffff', t); }
export function darken(c, t) { return mix(c, '#000000', t); }
/** Luminance (linear) */
export function lum(c) { c = C(c); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }

// ---- templates ----
const TPL = new Map();
const _v = new THREE.Vector3();

function makeTemplate(geo) {
  if (!geo.index) {
    const n = geo.attributes.position.count;
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(idx);
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position.array;
  const nrm = geo.attributes.normal.array;
  const n = geo.attributes.position.count;
  // smooth normals: average normals of coincident positions
  const map = new Map();
  const sn = new Float32Array(n * 3);
  const key = (i) => Math.round(pos[i * 3] * 1000) + ',' + Math.round(pos[i * 3 + 1] * 1000) + ',' + Math.round(pos[i * 3 + 2] * 1000);
  for (let i = 0; i < n; i++) {
    const k = key(i);
    let a = map.get(k);
    if (!a) { a = [0, 0, 0]; map.set(k, a); }
    a[0] += nrm[i * 3]; a[1] += nrm[i * 3 + 1]; a[2] += nrm[i * 3 + 2];
  }
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = map.get(key(i));
    _v.set(a[0], a[1], a[2]);
    if (_v.lengthSq() < 1e-8) _v.set(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
    _v.normalize();
    sn[i * 3] = _v.x; sn[i * 3 + 1] = _v.y; sn[i * 3 + 2] = _v.z;
    const y = pos[i * 3 + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const t = { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), sn, idx: Array.from(geo.index.array), n, minY, maxY };
  geo.dispose();
  return t;
}

/** Cached template by key; make() returns a BufferGeometry (disposed after extraction). */
export function tpl(key, make) {
  let t = TPL.get(key);
  if (!t) { t = makeTemplate(make()); t.key = key; TPL.set(key, t); }
  return t;
}

/** Rounded box ("toy block"): a sphere pushed toward a cube. e in (0,1]: smaller = boxier. */
function roundedBoxGeo(e, ws, hs) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), e);
    p.setXYZ(i, f(x) * 0.5, f(y) * 0.5, f(z) * 0.5);
  }
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

/** Primitive templates. All unit sized: box/rbox 1x1x1 centered; sphere r 1; cyl/cone r 1, h 1 centered. */
export const T = {
  box: () => tpl('box', () => new THREE.BoxGeometry(1, 1, 1)),
  rbox: (e = 0.35, ws = 10, hs = 6) => tpl('rbox' + e + '_' + ws + '_' + hs, () => roundedBoxGeo(e, ws, hs)),
  sphere: (ws = 10, hs = 7) => tpl('sph' + ws + '_' + hs, () => new THREE.SphereGeometry(1, ws, hs)),
  dome: (ws = 10, hs = 4) => tpl('dome' + ws + '_' + hs, () => new THREE.SphereGeometry(1, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2)),
  cyl: (rt = 1, rb = 1, seg = 8, open = false) => tpl(`cyl${rt}_${rb}_${seg}_${open}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg, 1, open)),
  cone: (seg = 8) => tpl('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg)),
  ico: (d = 0) => tpl('ico' + d, () => new THREE.IcosahedronGeometry(1, d)),
  octa: () => tpl('octa', () => new THREE.OctahedronGeometry(1, 0)),
  dodeca: () => tpl('dodeca', () => new THREE.DodecahedronGeometry(1, 0)),
  tetra: () => tpl('tetra', () => new THREE.TetrahedronGeometry(1, 0)),
  torus: (tube = 0.25, rs = 6, ts = 12, arc = Math.PI * 2) => tpl(`tor${tube}_${rs}_${ts}_${arc.toFixed(3)}`, () => new THREE.TorusGeometry(1, tube, rs, ts, arc)),
  capsule: (len = 1, seg = 6) => tpl('cap' + len + '_' + seg, () => new THREE.CapsuleGeometry(0.5, len, 2, seg)),
  plane: () => tpl('plane', () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }),
  quadXY: () => tpl('quadxy', () => new THREE.PlaneGeometry(1, 1)),
  /** Extruded 2D shape (points [[x,y],...]) of given depth, centered on z. */
  shape: (key, pts, depth = 0.2, bevel = 0) => tpl('shp_' + key, () => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, -depth / 2);
    g.deleteAttribute('uv');
    return g;
  }),
  /** Lathe profile [[r, y], ...] around Y. */
  lathe: (key, pts, seg = 10) => tpl('lathe_' + key, () => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg)),
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _nm = new THREE.Matrix3();
const _n = new THREE.Vector3();

export class Kit {
  /** @param {{skin?: boolean, line?: boolean}} opts */
  constructor(opts = {}) {
    this.skin = !!opts.skin;
    this.line = opts.line !== false;
    this.P = []; this.N = []; this.Cl = []; this.S = []; this.V = [];
    this.I = []; this.IL = [];   // outlined, lineless indices
    this.m = new THREE.Matrix4();
    this.stack = [];
    this.c = [1, 1, 1, 1];
    this.partId = 0; this.pivot = [0, 0, 0];
    this.grad = null;            // [bottomMul, topMul] vertical gradient per primitive
    this.lineless = false;
    this.tris = 0;
  }
  /** Set the current color (hex or Color) and emissive 0..1. */
  color(c, emissive = 0) { c = C(c); this.c[0] = c.r; this.c[1] = c.g; this.c[2] = c.b; this.c[3] = 1 - emissive; return this; }
  /** Current part id and pivot (model space). */
  part(id, x = 0, y = 0, z = 0) { this.partId = id; this.pivot[0] = x; this.pivot[1] = y; this.pivot[2] = z; return this; }
  push() { this.stack.push(this.m.clone()); return this; }
  pop() { this.m.copy(this.stack.pop()); return this; }
  /** Multiply the current matrix by translate/rotate(XYZ euler)/scale. */
  tf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.m.multiply(_m);
    return this;
  }
  /**
   * Add template `t` with local transform. pos [x,y,z], scale [sx,sy,sz] (number = uniform), rot [rx,ry,rz].
   */
  add(t, pos, scale, rot) {
    const sx = scale === undefined ? 1 : (typeof scale === 'number' ? scale : scale[0]);
    const sy = scale === undefined ? 1 : (typeof scale === 'number' ? scale : scale[1]);
    const sz = scale === undefined ? 1 : (typeof scale === 'number' ? scale : scale[2]);
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0), _q, _s.set(sx, sy, sz));
    _m.premultiply(this.m);
    _nm.getNormalMatrix(_m);
    const base = this.P.length / 3;
    const g = this.grad;
    const dy = t.maxY - t.minY || 1;
    for (let i = 0; i < t.n; i++) {
      _p.set(t.pos[i * 3], t.pos[i * 3 + 1], t.pos[i * 3 + 2]).applyMatrix4(_m);
      this.P.push(_p.x, _p.y, _p.z);
      _n.set(t.nrm[i * 3], t.nrm[i * 3 + 1], t.nrm[i * 3 + 2]).applyMatrix3(_nm).normalize();
      this.N.push(_n.x, _n.y, _n.z);
      if (this.line) {
        _n.set(t.sn[i * 3], t.sn[i * 3 + 1], t.sn[i * 3 + 2]).applyMatrix3(_nm).normalize();
        this.S.push(_n.x, _n.y, _n.z);
      }
      let k = 1;
      if (g) k = g[0] + (g[1] - g[0]) * ((t.pos[i * 3 + 1] - t.minY) / dy);
      this.Cl.push(Math.min(1, this.c[0] * k), Math.min(1, this.c[1] * k), Math.min(1, this.c[2] * k), this.c[3]);
      if (this.skin) this.V.push(this.pivot[0], this.pivot[1], this.pivot[2], this.partId);
    }
    // keep winding correct when the transform mirrors
    const flip = _m.determinant() < 0;
    const out = this.lineless ? this.IL : this.I;
    for (let i = 0; i < t.idx.length; i += 3) {
      if (flip) out.push(base + t.idx[i], base + t.idx[i + 2], base + t.idx[i + 1]);
      else out.push(base + t.idx[i], base + t.idx[i + 1], base + t.idx[i + 2]);
    }
    this.tris += t.idx.length / 3;
    return this;
  }
  /** Append a raw quad (4 corners [x,y,z] in current-matrix space, CCW seen from the normal side), flat normal. */
  quad(a, b, c, d, colors) {
    const base = this.P.length / 3;
    const pts = [a, b, c, d];
    const pv = [];
    for (const q of pts) { _p.set(q[0], q[1], q[2]).applyMatrix4(this.m); pv.push(_p.clone()); }
    const n = new THREE.Vector3().subVectors(pv[1], pv[0]).cross(new THREE.Vector3().subVectors(pv[2], pv[0])).normalize();
    for (let i = 0; i < 4; i++) {
      this.P.push(pv[i].x, pv[i].y, pv[i].z);
      this.N.push(n.x, n.y, n.z);
      if (this.line) this.S.push(n.x, n.y, n.z);
      const cc = colors ? colors[i] : null;
      if (cc) this.Cl.push(cc.r, cc.g, cc.b, this.c[3]); else this.Cl.push(this.c[0], this.c[1], this.c[2], this.c[3]);
      if (this.skin) this.V.push(this.pivot[0], this.pivot[1], this.pivot[2], this.partId);
    }
    const out = this.lineless ? this.IL : this.I;
    out.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.tris += 2;
    return this;
  }
  get vertexCount() { return this.P.length / 3; }
  /** Build a BufferGeometry. geometry.userData.lineCount = index count of outlined triangles. */
  build() {
    const g = new THREE.BufferGeometry();
    const n = this.P.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.Cl, 4));
    if (this.line) g.setAttribute('smoothNormal', new THREE.Float32BufferAttribute(this.S, 3));
    if (this.skin) g.setAttribute('pivot', new THREE.Float32BufferAttribute(this.V, 4));
    const all = this.I.concat(this.IL);
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(all, 1) : new THREE.Uint16BufferAttribute(all, 1));
    g.userData.lineCount = this.I.length;
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
