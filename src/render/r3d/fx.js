// FX: every visual that is not a static chunk or an entity model. All of it is drawn through a fixed set of
// instanced "batches" (one InstancedMesh per fx geometry, unlit rgba, per-instance color and alpha), refilled
// every frame. One-shot FxEvents (CONTRACTS section 7) live in a pooled list of records; persistent visuals
// (fxTags, auras, effect/projectile looks, blob shadows, prop emitters) are pushed by the renderer each frame.
// Particles are stateless: their position is a pure function of (record seed, index, age). No allocation.
import * as THREE from 'three';
import * as G from './fxgeo.js';

const DEG = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
const QX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _d = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);
const BLACK = new THREE.Color(0, 0, 0);

const ARCS = [70, 100, 140, 190, 360];
const FANS = [45, 90, 135, 180, 270, 360];

/** [geometry factory, additive, capacity, renderOrder] */
function batchDefs() {
  const d = {
    shadow: [() => G.disc(18, 0.45, 0.42), false, 160, 1],
    glow: [() => G.disc(16, 0, 1), true, 256, 4],
    glowN: [() => G.disc(16, 0.25, 1), false, 96, 3],
    ring: [() => G.ring([[0.74, 0], [0.84, 1], [0.95, 1], [1, 0]], 40), false, 128, 4],
    ringN: [() => G.ring([[0.84, 0], [0.9, 1], [0.96, 1], [1, 0]], 40), false, 96, 3],
    band: [() => G.ring([[0.45, 0], [0.82, 0.75], [0.92, 0.9], [1, 0]], 36), false, 32, 3],
    dot: [() => G.disc(10, 0.5, 1), false, 1200, 5],
    dotN: [() => G.disc(10, 0.45, 1), false, 300, 5],
    puff: [G.puff, false, 300, 5],
    star: [G.star4, true, 300, 6],
    star5: [G.star5, false, 64, 6],
    plus: [G.plus, false, 96, 6],
    cube: [() => G.solid('cube'), false, 160, 5],
    shard: [() => G.solid('octa'), false, 160, 5],
    flame: [G.flame, false, 600, 5],
    beam: [() => G.ribbon(false), true, 64, 5],
    trail: [() => G.ribbon(true), true, 160, 5],
    bolt: [() => G.bolt(3), true, 64, 6],
    pillar: [G.pillar, true, 32, 5],
    dome: [G.dome, true, 24, 6],
    rect: [G.rect, false, 32, 3],
    crack: [() => G.crack(7), false, 32, 2],
    rune: [G.runeCircle, true, 48, 3],
    bang: [G.bang, false, 32, 7],
    arrow: [G.arrowUp, false, 32, 7],
    zee: [G.zee, false, 48, 7],
    reticle: [G.reticle, false, 32, 7],
    screen: [G.quad, false, 4, 20],
  };
  for (const a of ARCS) {
    d['arcW' + a] = [() => G.slashArc(a * DEG, a === 360 ? 0.62 : 0.5), false, 32, 6];
    d['arcT' + a] = [() => G.slashArc(a * DEG, 0.86), false, 48, 6];
  }
  for (const a of FANS) d['fan' + a] = [() => G.fan(a * DEG), false, 16, 3];
  return d;
}

const nearest = (list, v) => { let b = list[0]; for (const x of list) if (Math.abs(x - v) < Math.abs(b - v)) b = x; return b; };
const hash = (a, b, c) => { const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return x - Math.floor(x); };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (k) => 1 - (1 - k) * (1 - k);

const DUR = { hit: 0.32, slash: 0.3, burst: 0.65, ring: 0.6, shockwave: 0.85, beam: 0.4, bolt: 0.38, trail: 0.32,
  afterimage: 0.45, pillar: 1.1, meteor: 1.1, sparkle: 1.1, heal: 1.1, levelup: 1.6, poof: 0.6, smoke: 1.6, screenFlash: 0.18 };
const SLASH_COLORS = { sword: '#f4f8ff', axe: '#ffd27a', dagger: '#c8ffd8', claw: '#ffb0b0', fist: '#ffe680', stick: '#fff2d0',
  crescent: '#c9f0ff', spin: '#ffffff' };
const TYPES = new Set(['hit', 'slash', 'burst', 'ring', 'shockwave', 'beam', 'bolt', 'trail', 'afterimage', 'pillar', 'meteor',
  'sparkle', 'heal', 'levelup', 'poof', 'smoke', 'screenFlash', 'text']);
const STYLES = new Set(['sword', 'axe', 'dagger', 'claw', 'fist', 'stick', 'crescent', 'spin']);

export function createFx(scene, mats, camera, unknown) {
  const batches = {};
  const list = [];
  const defs = batchDefs();
  for (const id in defs) {
    const [make, add, cap, order] = defs[id];
    const geo = make();
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    alpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iAlpha', alpha);
    const mesh = new THREE.InstancedMesh(geo, add ? mats.fxAdd : mats.fx, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.count = 0;
    mesh.visible = false;
    if (id === 'screen') { mesh.material = mats.fxScreen || mesh.material; }
    scene.add(mesh);
    const b = { id, mesh, geo, alpha, cap, n: 0, m: mesh.instanceMatrix.array, c: mesh.instanceColor.array, a: alpha.array };
    batches[id] = b;
    list.push(b);
  }

  // ---- one-shot records (pooled) ----
  const POOL = 160;
  const recs = [];
  for (let i = 0; i < POOL; i++) {
    recs.push({ on: false, type: '', t0: 0, dur: 0, x: 0, y: 0, z: 0, x2: 0, y2: 0, has2: false, angle: 0, arc: 0, r: 0, len: 0, w: 0,
      color: new THREE.Color(), color2: new THREE.Color(), hasC2: false, n: 0, style: '', ent: null, seed: 0 });
  }
  let seedCounter = 1;
  let quality = 2;
  const camQ = new THREE.Quaternion();
  let now = 0;

  // ---- low level ----
  function push(id, x, y, z, q, sx, sy, sz, c, a) {
    const b = batches[id];
    if (b.n >= b.cap || a <= 0.003) return;
    _m.compose(_p.set(x, y, z), q, _s.set(sx, sy, sz));
    _m.toArray(b.m, b.n * 16);
    const i3 = b.n * 3;
    b.c[i3] = c.r; b.c[i3 + 1] = c.g; b.c[i3 + 2] = c.b;
    b.a[b.n] = a;
    b.n++;
  }
  /** Ground orientation: XY geometry laid on the ground, local +X toward `angle` (0 east, clockwise). */
  function qGround(angle) { return _q.setFromAxisAngle(Y, -angle).multiply(QX); }
  /** Ground orientation with a tilt around the facing axis (slash ribbons). */
  function qGroundTilt(angle, tilt) {
    _q.setFromAxisAngle(Y, -angle);
    _q2.setFromAxisAngle(_d.set(1, 0, 0), tilt);
    return _q.multiply(_q2).multiply(QX);
  }
  function qBill(roll) { _q2.setFromAxisAngle(_d.set(0, 0, 1), roll); return _q.copy(camQ).multiply(_q2); }
  function qUp(yaw) { return _q.setFromAxisAngle(Y, yaw); }
  function qDir(dx, dy, dz) { _d.set(dx, dy, dz).normalize(); return _q.setFromUnitVectors(Y, _d); }
  function qEuler(x, y, z) { return _q.setFromEuler(_e.set(x, y, z)); }
  const _e = new THREE.Euler();

  // ground decals sit above the raised grass (0.06) so they never z-fight or vanish under it
  const G0 = 0.065;
  const ground = (id, x, y, gy, angle, sx, sy, c, a) => push(id, x, gy + G0, y, qGround(angle), sx, sy, 1, c, a);
  const bill = (id, x, y, h, roll, s, c, a) => push(id, x, h, y, qBill(roll), s, s, s, c, a);
  const bill2 = (id, x, y, h, roll, sx, sy, c, a) => push(id, x, h, y, qBill(roll), sx, sy, 1, c, a);
  const ball = (id, x, y, h, s, c, a) => push(id, x, h, y, qUp(0), s, s, s, c, a);

  // ---- one-shot fx ----
  function spawn(e, t) {
    let type = e.type;
    if (type === 'text') return null;
    if (!TYPES.has(type)) { unknown.add('fx:' + type); type = 'burst'; }
    let r = null, oldest = null;
    for (const rec of recs) {
      if (!rec.on) { r = rec; break; }
      if (!oldest || rec.t0 < oldest.t0) oldest = rec;
    }
    if (!r) r = oldest;
    r.on = true; r.type = type; r.t0 = t;
    r.dur = e.dur > 0 ? e.dur : DUR[type] || 0.6;
    if (type === 'slash' && !(e.dur > 0)) r.dur = e.style === 'dagger' ? 0.22 : e.style === 'axe' ? 0.36 : DUR.slash;
    r.x = e.x; r.y = e.y; r.z = e.z || 0;
    r.has2 = e.x2 !== null && e.x2 !== undefined && e.y2 !== null && e.y2 !== undefined;
    r.x2 = r.has2 ? e.x2 : e.x; r.y2 = r.has2 ? e.y2 : e.y;
    r.angle = e.angle || 0; r.arc = e.arc || 0; r.r = e.r || 0; r.len = e.len || 0; r.w = e.w || 0;
    let style = e.style || '';
    if (type === 'slash') {
      if (!style) style = 'sword';
      else if (!STYLES.has(style)) { unknown.add('slash:' + style); style = 'sword'; }
    }
    r.style = style;
    const defC = type === 'slash' ? SLASH_COLORS[style] : type === 'heal' ? '#7cf07c' : type === 'levelup' ? '#ffd24a'
      : type === 'smoke' ? '#c8c4d0' : type === 'poof' ? '#ffffff' : type === 'shockwave' ? '#e8cf94' : type === 'meteor' ? '#ff8a3c' : '#ffe066';
    setColor(r.color, e.color || defC);
    r.hasC2 = !!e.color2;
    if (r.hasC2) setColor(r.color2, e.color2);
    r.n = e.n || 0; r.ent = e.ent; r.seed = (seedCounter++ % 997) + 0.5;
    return r;
  }

  function setColor(c, hex) { try { c.set(hex); } catch { c.set('#ffe066'); } }

  function update(t) {
    now = t;
    for (const r of recs) {
      if (!r.on) continue;
      const age = t - r.t0;
      if (age < 0 || age > r.dur + (r.type === 'shockwave' || r.type === 'meteor' ? 0.8 : 0)) { if (age > 0 || age < -2) r.on = false; continue; }
      const k = clamp01(age / r.dur);
      DRAW[r.type](r, age, k);
    }
  }

  const lim = (n) => (quality === 0 ? Math.ceil(n * 0.5) : n);

  // shared particle helpers
  function sparks(r, age, n, speed, up, size, life, c, h0 = 0.45, grav = 4, id = 'dot') {
    for (let i = 0; i < n; i++) {
      const lk = age / (life * (0.7 + 0.6 * hash(r.seed, i, 1)));
      if (lk >= 1) continue;
      const a = hash(r.seed, i, 2) * Math.PI * 2;
      const sp = speed * (0.5 + hash(r.seed, i, 3));
      const vy = up * (0.3 + hash(r.seed, i, 4));
      const tt = age;
      const x = r.x + Math.cos(a) * sp * tt;
      const y = r.y + Math.sin(a) * sp * tt;
      const h = Math.max(0.03, h0 + r.z + vy * tt - grav * 0.5 * tt * tt);
      bill(id, x, y, h, 0, size * (1 - lk * 0.8), c, 1 - lk * lk);
    }
  }

  const DRAW = {
    hit(r, age, k) {
      const h = (r.z || 0) + 0.5;
      bill('star', r.x, r.y, h, k * 2, 0.55 * (1 - k) + 0.1, WHITE, 1 - k);
      bill('glow', r.x, r.y, h, 0, 0.6 * (1 - k * 0.5), r.color, 0.8 * (1 - k));
      push('ring', r.x, h, r.y, qBill(0), 0.15 + 0.45 * easeOut(k), 0.15 + 0.45 * easeOut(k), 1, r.color, 1 - k);
      sparks(r, age, lim(6), 3.2, 1.5, 0.09, 0.3, r.color, 0.5, 6);
    },
    slash(r, age, k) {
      const s = r.style;
      const R = r.r > 0 ? r.r : 1;
      const arc = r.arc > 0 ? r.arc : (s === 'spin' ? 360 : s === 'dagger' ? 70 : 110);
      const h = (r.z || 0) + 0.42;
      const fade = 1 - k * k;
      const sweep = easeOut(clamp01(k * 2.6));
      const bucket = nearest(ARCS, arc);
      const sc = arc / bucket;   // stretch the ribbon to the requested arc (small error only)
      const start = r.angle - (arc * DEG) / 2;
      const rot = start - (1 - sweep) * arc * DEG * 0.45;
      const tilt = s === 'axe' ? 0.42 : s === 'sword' ? 0.28 : s === 'stick' ? 0.2 : 0.12;
      const lay = (id, ang, rad, c, a, tl = tilt, yy = h) => push(id, r.x, yy, r.y, qGroundTilt(ang, tl), rad, rad * (s === 'spin' ? 1 : sc), 1, c, a);
      // The ribbon geometry runs CCW in XY (angle 0..arc). Ground orientation maps XY +Y to world -Z, i.e. CCW in XY is
      // counter-clockwise on screen; FxEvent angles grow clockwise on screen, so mirror with a negative scale on Y.
      const W = 'arcW' + bucket, Tn = 'arcT' + bucket;
      if (s === 'spin') {
        const spin = -age * 22;
        lay('arcW360', spin, R * 1.05, r.color, 0.75 * fade, 0.05);
        lay('arcT360', spin + 1.2, R * 1.12, WHITE, 0.9 * fade, 0.05);
        ground('ring', r.x, r.y, 0.06, 0, R * (0.8 + 0.4 * k), R * (0.8 + 0.4 * k), r.color, 0.6 * fade);
        sparks(r, age, lim(8), 2.6, 0.5, 0.07, 0.3, WHITE, 0.4, 1);
        return;
      }
      if (s === 'dagger') {
        for (let j = 0; j < 2; j++) {
          const off = (j ? 0.35 : -0.35);
          const kk = clamp01((age - j * 0.05) / r.dur);
          if (kk <= 0) continue;
          const sw = easeOut(clamp01(kk * 2.6));
          const st = r.angle - (arc * DEG) / 2 - (1 - sw) * arc * DEG * 0.5;
          push(Tn, r.x, h + 0.04 * j, r.y, qGroundTilt(st, off), R * 0.95, -R * 0.95 * sc, 1, r.color, (1 - kk * kk));
          push(Tn, r.x, h + 0.04 * j, r.y, qGroundTilt(st, off), R * 1.0, -R * 1.0 * sc, 1, WHITE, 0.7 * (1 - kk * kk));
        }
        return;
      }
      if (s === 'claw') {
        for (let j = 0; j < 3; j++) {
          const rad = R * (0.72 + j * 0.16);
          push(Tn, r.x, h + j * 0.05, r.y, qGroundTilt(rot + 0.08 * j, 0.5), rad, -rad * sc, 1, j === 1 ? WHITE : r.color, fade);
        }
        return;
      }
      if (s === 'fist') {
        const fx = r.x + Math.cos(r.angle) * R * 0.75, fy = r.y + Math.sin(r.angle) * R * 0.75;
        const fan = 'fan' + nearest(FANS, Math.min(180, arc));
        push(fan, r.x, 0.08 + G0, r.y, qGround(r.angle), R * (0.5 + 0.7 * easeOut(k)), R * (0.5 + 0.7 * easeOut(k)), 1, r.color, 0.7 * fade);
        bill('star', fx, fy, h, 0.4, 0.7 * (1 - k) + 0.15, WHITE, fade);
        bill('glow', fx, fy, h, 0, 0.9 * (1 - k * 0.5), r.color, 0.9 * fade);
        push('ring', fx, h, fy, qBill(0), 0.2 + 0.6 * easeOut(k), 0.2 + 0.6 * easeOut(k), 1, r.color, fade);
        const save = r.x, save2 = r.y; r.x = fx; r.y = fy;
        sparks(r, age, lim(6), 3, 1, 0.08, 0.3, r.color, 0.4, 5);
        r.x = save; r.y = save2;
        return;
      }
      const thick = s === 'axe' || s === 'crescent';
      const id = thick || s === 'sword' ? W : Tn;
      push(id, r.x, h, r.y, qGroundTilt(rot, tilt), R * (thick ? 1.12 : 1), -R * (thick ? 1.12 : 1) * sc, 1, r.color, 0.85 * fade);
      push(Tn, r.x, h + 0.01, r.y, qGroundTilt(rot, tilt), R * (thick ? 1.16 : 1.04), -R * (thick ? 1.16 : 1.04) * sc, 1, WHITE, fade);
      if (s === 'crescent') {
        push(W, r.x, h - 0.05, r.y, qGroundTilt(rot, tilt), R * 1.3, -R * 1.3 * sc, 1, r.color, 0.45 * fade);
        sparks(r, age, lim(7), 2.2, 0.8, 0.08, 0.35, r.color, 0.45, 1, 'star');
      }
      if (s === 'axe') {
        for (let i = 0; i < 3; i++) {
          const a = r.angle + (hash(r.seed, i, 5) - 0.5) * arc * DEG;
          const d = R * (0.8 + 0.5 * k);
          ball('cube', r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, 0.1 + 0.4 * Math.sin(k * Math.PI), 0.06, _c.copy(r.color).multiplyScalar(0.6), fade);
        }
      }
      if (s === 'stick') {
        const tip = r.angle + (arc * DEG) / 2 * (sweep * 2 - 1);
        bill('dot', r.x + Math.cos(tip) * R, r.y + Math.sin(tip) * R, h, 0, 0.12, WHITE, fade);
      }
    },
    burst(r, age, k) {
      const n = lim(r.n || 12);
      const R = r.r || 1;
      bill('glow', r.x, r.y, 0.5 + r.z, 0, R * 0.9 * (1 - k * 0.6), r.color, (1 - k) * 0.8);
      bill('star', r.x, r.y, 0.5 + r.z, k * 3, R * 0.45 * (1 - k), WHITE, 1 - k);
      sparks(r, age, n, R * 3.2, 2.2, 0.13, r.dur, r.color, 0.5, 5);
      sparks(r, age + 0.03, Math.ceil(n / 2), R * 2, 3, 0.08, r.dur * 0.8, WHITE, 0.5, 6);
    },
    ring(r, age, k) {
      const R = r.r || 1;
      const s = R * (0.15 + 0.85 * easeOut(k));
      ground('ring', r.x, r.y, 0.07 + r.z, 0, s, s, r.color, 1 - k);
      ground('ring', r.x, r.y, 0.08 + r.z, 0, s * 0.94, s * 0.94, WHITE, (1 - k) * 0.6);
      if (k < 0.4) ground('glow', r.x, r.y, 0.05 + r.z, 0, s * 0.9, s * 0.9, r.color, 0.4 * (1 - k / 0.4));
    },
    shockwave(r, age, k) {
      const R = r.r || 2;
      const kk = clamp01(age / r.dur);
      const s = R * (0.1 + 0.9 * easeOut(kk));
      if (age <= r.dur) {
        ground('band', r.x, r.y, 0.06, 0, s, s, r.color, 0.85 * (1 - kk));
        ground('ring', r.x, r.y, 0.09, 0, s * 1.02, s * 1.02, WHITE, 0.9 * (1 - kk));
        ground('ring', r.x, r.y, 0.08, 0, s * 0.8, s * 0.8, r.color, 0.6 * (1 - kk));
        if (kk < 0.25) bill('glow', r.x, r.y, 0.4, 0, R * 0.8, WHITE, 0.6 * (1 - kk / 0.25));
        // dust puffs riding the front
        const np = lim(10);
        for (let i = 0; i < np; i++) {
          const a = (i / np) * Math.PI * 2 + hash(r.seed, i, 1) * 0.5;
          const d = s * (0.92 + 0.1 * hash(r.seed, i, 2));
          ball('puff', r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, 0.15 + 0.2 * kk, 0.16 + 0.22 * kk, _c.copy(r.color).lerp(WHITE, 0.45), 0.85 * (1 - kk));
        }
        // debris
        for (let i = 0; i < lim(8); i++) {
          const a = hash(r.seed, i, 6) * Math.PI * 2;
          const sp = R * (0.6 + 0.6 * hash(r.seed, i, 7));
          const tt = age;
          const hh = 0.1 + 3.2 * tt - 9 * tt * tt;
          if (hh < 0) continue;
          push('cube', r.x + Math.cos(a) * sp * tt * 1.4, hh, r.y + Math.sin(a) * sp * tt * 1.4, qEuler(tt * 9 + i, tt * 7, i), 0.09, 0.09, 0.09, _c.copy(r.color).multiplyScalar(0.55), 1);
        }
      }
      // ground cracks linger
      const ck = clamp01(age / (r.dur + 0.8));
      ground('crack', r.x, r.y, 0.035, r.seed, R * 0.55, R * 0.55, BLACK, 0.5 * (1 - ck * ck));
    },
    beam(r, age, k) {
      const dx = r.x2 - r.x, dy = r.y2 - r.y;
      const L = Math.hypot(dx, dy) || 0.01;
      const ang = Math.atan2(dy, dx);
      const W = r.w > 0 ? r.w : 0.3;
      const h = 0.5 + r.z;
      const flick = 1 + 0.25 * Math.sin(age * 70);
      const wk = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * flick;
      push('beam', r.x, h, r.y, qGround(ang), L, W * 2.2 * wk, 1, r.color, 0.9);
      push('beam', r.x, h + 0.01, r.y, qGround(ang), L, W * 0.7 * wk, 1, WHITE, 1);
      push('beam', r.x, h, r.y, qUp(-ang), L, W * 1.6 * wk, 1, r.color, 0.5);
      bill('glow', r.x, r.y, h, 0, W * 3 * wk, r.color, 0.9);
      bill('glow', r.x2, r.y2, h, 0, W * 3.5 * wk, r.color, 0.9);
      bill('star', r.x2, r.y2, h, age * 6, W * 2.2 * wk, WHITE, 1 - k);
      for (let i = 0; i < lim(8); i++) {
        const u = hash(r.seed, i, 1);
        const life = clamp01((age - u * 0.1) / 0.3);
        if (life <= 0 || life >= 1) continue;
        bill('dot', r.x + dx * u, r.y + dy * u, h + life * 0.5 * hash(r.seed, i, 2), 0, 0.09 * (1 - life), WHITE, 1 - life);
      }
    },
    bolt(r, age, k) {
      const flick = Math.floor(age / 0.045);
      const mir = (flick % 2) ? -1 : 1;
      const a = (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
      if (r.has2) {
        const dx = r.x2 - r.x, dy = r.y2 - r.y;
        const L = Math.hypot(dx, dy) || 0.01;
        push('bolt', r.x, 0.5 + r.z, r.y, qDir(dx, 0, dy), 2.2 * mir, L, 2.2, r.color, a);
        push('bolt', r.x, 0.5 + r.z, r.y, qDir(dx, 0, dy), 0.9 * -mir, L, 0.9, WHITE, a);
        bill('glow', r.x2, r.y2, 0.5, 0, 0.7, r.color, a);
        bill('glow', r.x, r.y, 0.5, 0, 0.5, r.color, a);
      } else {
        const H = 7;
        _q2.setFromAxisAngle(Y, flick * 1.3);
        push('bolt', r.x, 0, r.y, _q2, 3 * mir, H, 3, r.color, a);
        push('bolt', r.x, 0, r.y, _q2, 1.2 * mir, H, 1.2, WHITE, a);
        bill('glow', r.x, r.y, 0.3, 0, 1.4 * (1 - k * 0.5), r.color, a);
        ground('ring', r.x, r.y, 0.06, 0, 0.3 + 1.0 * easeOut(k), 0.3 + 1.0 * easeOut(k), r.color, 1 - k);
        ground('crack', r.x, r.y, 0.035, r.seed, 0.6, 0.6, BLACK, 0.35 * (1 - k));
        sparks(r, age, lim(8), 3, 2.5, 0.08, 0.35, WHITE, 0.1, 7);
      }
    },
    trail(r, age, k) {
      // (x, y) is the head, (x2, y2) the tail (the gallery fixture uses x2 = x - 1.2 for a move to the east)
      const dx = r.x - r.x2, dy = r.y - r.y2;
      const L = Math.hypot(dx, dy) || 0.01;
      const ang = Math.atan2(dy, dx);
      const a = 1 - k;
      const px = -dy / L, py = dx / L;
      push('trail', r.x2, 0.45 + r.z, r.y2, qGround(ang), L, 0.55 * a + 0.1, 1, r.color, 0.9 * a);
      push('trail', r.x2, 0.46 + r.z, r.y2, qGround(ang), L, 0.18 * a + 0.04, 1, WHITE, a);
      for (const o of [-0.28, 0.28]) {
        push('trail', r.x2 + px * o + dx * 0.25, 0.25 + r.z, r.y2 + py * o + dy * 0.25, qGround(ang), L * 0.7 * (1 - k * 0.5), 0.06, 1, WHITE, 0.7 * a);
      }
      ground('dotN', r.x2, r.y2, 0.05, 0, 0.3 * a, 0.3 * a, _c.set(0.6, 0.55, 0.45), 0.5 * a);
    },
    afterimage() { /* drawn by the renderer as a ghost copy of the entity */ },
    pillar(r, age, k) {
      const R = r.r || 0.6;
      const grow = easeOut(clamp01(age / 0.18));
      const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      const H = 5 * grow;
      push('pillar', r.x, 0, r.y, qUp(age * 2), R * (1 + 0.15 * Math.sin(age * 30)) * (1 - 0.3 * k), H, R, r.color, fade);
      push('pillar', r.x, 0, r.y, qUp(-age * 3), R * 0.45, H * 1.1, R * 0.45, WHITE, fade);
      ground('glow', r.x, r.y, 0.05, 0, R * 2.2, R * 2.2, r.color, 0.8 * fade);
      ground('ring', r.x, r.y, 0.07, 0, R * (1 + 1.4 * easeOut(k)), R * (1 + 1.4 * easeOut(k)), r.color, fade * (1 - k));
      for (let i = 0; i < lim(10); i++) {
        const u = (hash(r.seed, i, 1) + age * 0.8) % 1;
        const a = hash(r.seed, i, 2) * Math.PI * 2 + age;
        bill('star', r.x + Math.cos(a) * R * 0.9, r.y + Math.sin(a) * R * 0.9, u * 4, age * 4, 0.12 * (1 - u), WHITE, fade * (1 - u));
      }
    },
    meteor(r, age, k) {
      const R = r.r || 1.5;
      const kk = clamp01(age / r.dur);
      if (age <= r.dur) {
        if (kk < 0.3) {
          bill('glow', r.x, r.y, 0.5, 0, R * 2.2 * (1 - kk), WHITE, 1 - kk / 0.3);
          bill('glow', r.x, r.y, 0.5, 0, R * 2.6, r.color, 1 - kk / 0.3);
        }
        ground('ring', r.x, r.y, 0.08, 0, R * (0.3 + 1.0 * easeOut(kk)), R * (0.3 + 1.0 * easeOut(kk)), r.color, 1 - kk);
        ground('band', r.x, r.y, 0.06, 0, R * (0.2 + 1.1 * easeOut(kk)), R * (0.2 + 1.1 * easeOut(kk)), _c.set(0.35, 0.3, 0.28), 0.7 * (1 - kk));
        ground('glow', r.x, r.y, 0.05, 0, R * 1.2, R * 1.2, r.color, 0.8 * (1 - kk));
        // fireball puffs rising and cooling to smoke
        for (let i = 0; i < lim(9); i++) {
          const a = hash(r.seed, i, 1) * Math.PI * 2;
          const d = R * 0.55 * hash(r.seed, i, 2) * (0.4 + easeOut(kk));
          const heat = clamp01(1 - kk * 1.6 - hash(r.seed, i, 3) * 0.3);
          _c.copy(r.color).lerp(WHITE, heat * 0.5).lerp(_c2.set(0.32, 0.29, 0.3), 1 - heat);
          ball('puff', r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, 0.2 + kk * (0.8 + hash(r.seed, i, 4)), R * (0.22 + 0.25 * kk), _c, 1 - kk * kk);
        }
        for (let i = 0; i < lim(7); i++) {
          const u = clamp01(age * 2.4 - hash(r.seed, i, 5) * 0.4);
          if (u <= 0 || u >= 1) continue;
          bill('flame', r.x + (hash(r.seed, i, 6) - 0.5) * R, r.y + (hash(r.seed, i, 7) - 0.5) * R, u * 1.2, 0, 0.5 * (1 - u), r.color, 1 - u);
        }
        for (let i = 0; i < lim(10); i++) {
          const a = hash(r.seed, i, 8) * Math.PI * 2;
          const sp = R * (0.8 + hash(r.seed, i, 9));
          const tt = age;
          const hh = 0.2 + 4 * tt - 10 * tt * tt;
          if (hh < 0) continue;
          push('cube', r.x + Math.cos(a) * sp * tt * 1.3, hh, r.y + Math.sin(a) * sp * tt * 1.3, qEuler(tt * 10 + i, tt * 6, i * 2), 0.11, 0.1, 0.12, _c.set(0.36, 0.28, 0.24), 1);
        }
      }
      const ck = clamp01(age / (r.dur + 0.8));
      ground('crack', r.x, r.y, 0.035, r.seed, R * 0.7, R * 0.7, BLACK, 0.55 * (1 - ck * ck));
      ground('glowN', r.x, r.y, 0.03, 0, R * 0.8, R * 0.8, _c.set(0.2, 0.12, 0.08), 0.45 * (1 - ck));
    },
    sparkle(r, age, k) {
      const n = lim(r.n || 10);
      const R = r.r || 1;
      for (let i = 0; i < n; i++) {
        const a = hash(r.seed, i, 1) * Math.PI * 2;
        const d = R * Math.sqrt(hash(r.seed, i, 2));
        const life = clamp01((age - hash(r.seed, i, 3) * r.dur * 0.4) / (r.dur * 0.6));
        if (life <= 0 || life >= 1) continue;
        const tw = Math.sin(life * Math.PI);
        bill('star', r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, 0.3 + r.z + hash(r.seed, i, 4) * 0.8 + life * 0.4, life * 2, 0.22 * tw, i % 3 ? r.color : WHITE, tw);
      }
    },
    heal(r, age, k) {
      const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ground('glow', r.x, r.y, 0.05, 0, 0.8, 0.8, r.color, 0.6 * fade);
      ground('ring', r.x, r.y, 0.06, 0, 0.5 + 0.4 * k, 0.5 + 0.4 * k, r.color, 0.8 * (1 - k));
      for (let i = 0; i < lim(6); i++) {
        const life = clamp01((age - i * 0.09) / (r.dur * 0.7));
        if (life <= 0 || life >= 1) continue;
        const a = i * 2.1 + r.seed;
        const x = r.x + Math.cos(a) * 0.35, y = r.y + Math.sin(a) * 0.25;
        const h = 0.3 + life * 1.2;
        const s = 0.11 * Math.sin(Math.min(1, life * 3) * Math.PI * 0.5);
        bill('plus', x, y, h, 0, s * 1.35, WHITE, 1 - life * life);
        push('plus', x, h, y + 0.02, qBill(0), s, s, s, r.color, 1 - life * life);
      }
      sparks(r, age, lim(5), 0.4, 2, 0.07, 0.8, r.color, 0.2, -1);
    },
    levelup(r, age, k) {
      const gold = r.color;
      PILLAR_TMP.x = r.x; PILLAR_TMP.y = r.y; PILLAR_TMP.r = 0.7; PILLAR_TMP.color = gold; PILLAR_TMP.seed = r.seed; PILLAR_TMP.dur = r.dur;
      DRAW.pillar(PILLAR_TMP, age, k);
      const ring = clamp01(age / 0.6);
      ground('ring', r.x, r.y, 0.09, 0, 0.3 + 2.4 * easeOut(ring), 0.3 + 2.4 * easeOut(ring), gold, 1 - ring);
      ground('ring', r.x, r.y, 0.1, 0, 0.2 + 1.8 * easeOut(ring), 0.2 + 1.8 * easeOut(ring), WHITE, 0.8 * (1 - ring));
      sparks(r, age, lim(18), 3.5, 3, 0.13, 0.9, gold, 0.5, 4);
      const ak = clamp01(age / r.dur);
      bill('arrow', r.x, r.y, 1.4 + ak * 1.2, 0, 0.22, gold, 1 - ak * ak);
      sparks(r, age, lim(10), 1.5, 4, 0.12, 1.2, WHITE, 0.5, 2, 'star');
    },
    poof(r, age, k) {
      const n = lim(8);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + hash(r.seed, i, 1);
        const d = 0.15 + 0.5 * easeOut(k) * (0.7 + 0.5 * hash(r.seed, i, 2));
        const h = 0.25 + 0.45 * hash(r.seed, i, 3) + 0.3 * k;
        const s = (0.17 + 0.1 * hash(r.seed, i, 4)) * (k < 0.25 ? 0.5 + 2 * k : 1 - (k - 0.25) * 1.1);
        ball('puff', r.x + Math.cos(a) * d, r.y + Math.sin(a) * d * 0.8, h, s, r.color, 1);
      }
      ball('puff', r.x, r.y, 0.45, 0.3 * (1 - k), r.color, 1);
      ground('ring', r.x, r.y, 0.06, 0, 0.3 + 0.6 * easeOut(k), 0.3 + 0.6 * easeOut(k), WHITE, 0.7 * (1 - k));
      if (k < 0.3) bill('star', r.x, r.y, 0.5, 0, 0.5 * (1 - k / 0.3), WHITE, 1);
    },
    smoke(r, age, k) {
      const R = r.r || 1;
      const fade = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const n = lim(11);
      for (let i = 0; i < n; i++) {
        const a = hash(r.seed, i, 1) * Math.PI * 2 + age * 0.4 * (i % 2 ? 1 : -1);
        const d = R * 0.75 * Math.sqrt(hash(r.seed, i, 2));
        const h = 0.25 + 0.5 * hash(r.seed, i, 3) + 0.25 * Math.sin(age * 1.5 + i);
        const s = R * (0.32 + 0.12 * Math.sin(age * 2 + i * 1.7)) * (0.6 + 0.4 * fade);
        ball('puff', r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, h, s, r.color, fade * 0.95);
      }
    },
    screenFlash(r, age, k) {
      screenColor.copy(r.color);
      screenAlpha = Math.max(screenAlpha, 0.75 * (1 - k));
    },
  };
  const PILLAR_TMP = { r: 0, color: null, seed: 0, x: 0, y: 0, z: 0, dur: 1 };
  let screenAlpha = 0;
  const screenColor = new THREE.Color();

  // ---- persistent visuals ----
  const C1 = new THREE.Color();
  const C2 = new THREE.Color();
  const tagC = {};
  const tc = (hex) => (tagC[hex] || (tagC[hex] = new THREE.Color(hex)));

  /** Blob shadow under an entity (ground y = gy). */
  function shadow(x, y, r, a) { ground('shadow', x, y, 0.025, 0, r, r * 0.92, BLACK, a); }

  function glowAt(x, y, h, s, c, a) { bill('glow', x, y, h, 0, s, c, a); }

  /** Aura (look.aura) around an entity of height H. */
  function aura(style, color, x, y, H, t, seed) {
    const c = color;
    switch (style) {
      case 'glow':
        ground('glow', x, y, 0.04, 0, 0.75, 0.75, c, 0.55 + 0.15 * Math.sin(t * 3));
        bill('glow', x, y - 0.05, H * 0.5, 0, H * 0.85, c, 0.22 + 0.06 * Math.sin(t * 2.3));
        for (let i = 0; i < lim(4); i++) {
          const u = (t * 0.5 + i / 4 + seed) % 1;
          bill('dot', x + Math.cos(i * 1.6 + t) * 0.35, y + Math.sin(i * 1.6 + t) * 0.25, u * H * 1.2, 0, 0.08 * (1 - u), c, 1 - u);
        }
        break;
      case 'flame': {
        ground('glow', x, y, 0.04, 0, 0.7, 0.7, c, 0.5);
        const n = lim(7);
        for (let i = 0; i < n; i++) {
          const u = (t * 1.4 + i / n + seed * 0.3) % 1;
          const a = (i / n) * Math.PI * 2 + t * 0.6;
          bill('flame', x + Math.cos(a) * 0.36, y + Math.sin(a) * 0.3, 0.02 + u * H * 0.55, Math.sin(t * 9 + i) * 0.15, 0.42 * (1 - u * 0.7), c, 1 - u);
        }
        for (let i = 0; i < lim(3); i++) {
          const u = (t * 0.9 + i / 3) % 1;
          bill('dot', x + Math.sin(i * 2 + t * 3) * 0.3, y, u * H * 1.3, 0, 0.06, WHITE, 1 - u);
        }
        break;
      }
      case 'sparkle':
        for (let i = 0; i < lim(7); i++) {
          const ph = (t * 0.7 + i / 7 + seed) % 1;
          const a = i * 2.39 + seed;
          const tw = Math.sin(ph * Math.PI);
          bill('star', x + Math.cos(a) * 0.42, y + Math.sin(a) * 0.3, 0.15 + (i / 7) * H, t * 2 + i, 0.17 * tw, i % 2 ? c : WHITE, tw);
        }
        ground('glow', x, y, 0.04, 0, 0.6, 0.6, c, 0.35);
        break;
      case 'shadow':
        ground('glowN', x, y, 0.035, 0, 0.75, 0.75, C1.copy(c).multiplyScalar(0.5), 0.55);
        for (let i = 0; i < lim(6); i++) {
          const u = (t * 0.6 + i / 6 + seed) % 1;
          const a = i * 1.05 + t * 0.5;
          ball('puff', x + Math.cos(a) * 0.32, y + Math.sin(a) * 0.25, u * H * 0.9, 0.13 * (1 - u * 0.5), c, 0.75 * (1 - u));
        }
        break;
      case 'frost':
        ground('glow', x, y, 0.04, 0, 0.7, 0.7, c, 0.45);
        for (let i = 0; i < lim(5); i++) {
          const a = (i / 5) * Math.PI * 2 + t * 0.8;
          push('shard', x + Math.cos(a) * 0.48, 0.25 + 0.5 * ((i * 0.37) % 1) + 0.05 * Math.sin(t * 2 + i), y + Math.sin(a) * 0.38, qEuler(t + i, t * 1.3, i), 0.05, 0.09, 0.05, c, 0.9);
        }
        for (let i = 0; i < lim(4); i++) {
          const u = (t * 0.4 + i / 4) % 1;
          bill('dot', x + Math.cos(i * 1.9) * 0.4, y + Math.sin(i * 1.9) * 0.3, H * (1.1 - u), 0, 0.05, WHITE, Math.sin(u * Math.PI));
        }
        break;
      case 'storm': {
        ground('glow', x, y, 0.04, 0, 0.7, 0.7, c, 0.45);
        const f = Math.floor(t * 9 + seed * 10);
        for (let i = 0; i < 2; i++) {
          if (hash(f, i, seed) < 0.45) continue;
          const a = hash(f, i, 2) * Math.PI * 2;
          _q2.setFromAxisAngle(Y, a);
          push('bolt', x + Math.cos(a) * 0.35, 0.1 + hash(f, i, 3) * 0.4, y + Math.sin(a) * 0.3, _q2, 0.5, 0.45, 0.5, c, 1);
        }
        for (let i = 0; i < lim(4); i++) {
          const a = (i / 4) * Math.PI * 2 - t * 2.5;
          bill('dot', x + Math.cos(a) * 0.45, y + Math.sin(a) * 0.35, H * 0.5 + Math.sin(t * 3 + i) * 0.2, 0, 0.08, c, 0.9);
        }
        break;
      }
      default: break;
    }
  }

  /** fxTag visuals. tip = [x, h, y] of the weapon tip in world space (or null). face = facing angle. */
  function tag(tg, x, y, H, R, t, seed, face, tip) {
    switch (tg) {
      case 'burn':
        for (let i = 0; i < lim(5); i++) {
          const u = (t * 1.8 + i / 5 + seed) % 1;
          const a = i * 1.3 + t;
          bill('flame', x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.4 + 0.05, H * (0.15 + 0.7 * u), 0, 0.3 * (1 - u * 0.6), tc('#ff8a2a'), 1 - u);
        }
        bill('glow', x, y, H * 0.5, 0, H * 0.7, tc('#ff7a2a'), 0.3);
        break;
      case 'frost':
        ground('glow', x, y, 0.04, 0, R * 1.8, R * 1.8, tc('#9fe6ff'), 0.5);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + seed;
          push('shard', x + Math.cos(a) * R * 1.1, 0.08, y + Math.sin(a) * R * 0.9, qEuler(0.3, a, 0.2), 0.07, 0.16, 0.07, tc('#d8f6ff'), 0.95);
        }
        for (let i = 0; i < lim(3); i++) {
          const u = (t * 0.5 + i / 3) % 1;
          bill('star', x + Math.cos(i * 2.1) * R, y + Math.sin(i * 2.1) * R * 0.6, H * (1 - u * 0.8), t, 0.08, WHITE, Math.sin(u * Math.PI));
        }
        break;
      case 'stun':
        for (let i = 0; i < 3; i++) {
          const a = t * 4.5 + (i / 3) * Math.PI * 2;
          const xx = x + Math.cos(a) * 0.28, yy = y + Math.sin(a) * 0.2;
          bill('star5', xx, yy + 0.02, H + 0.12 + Math.sin(a) * 0.04, t * 3, 0.1, WHITE, 1);
          push('star5', xx, H + 0.12 + Math.sin(a) * 0.04, yy + 0.03, qBill(t * 3), 0.075, 0.075, 0.075, tc('#ffe14d'), 1);
        }
        break;
      case 'shield': {
        const rr = Math.max(0.55, R * 1.7);
        const p = 1 + 0.03 * Math.sin(t * 4);
        push('dome', x, 0, y, qUp(t * 0.3), rr * p, Math.max(H * 1.05, rr) * p, rr * p, tc('#8fd8ff'), 0.85);
        ground('ring', x, y, 0.05, 0, rr * p, rr * p, tc('#bfeaff'), 0.8);
        const g = (t * 0.8 + seed) % 1;
        bill('star', x - rr * 0.5, y + rr * 0.3, H * 0.9, 0, 0.12 * Math.sin(g * Math.PI), WHITE, 1);
        break;
      }
      case 'stealth':
        for (let i = 0; i < lim(3); i++) {
          const u = (t * 0.7 + i / 3 + seed) % 1;
          bill('star', x + Math.cos(i * 2.3 + t) * R, y + Math.sin(i * 2.3 + t) * R * 0.6, 0.2 + u * H, t, 0.07 * Math.sin(u * Math.PI), tc('#bff8f0'), 0.8);
        }
        ground('glowN', x, y, 0.03, 0, R * 1.6, R * 1.6, tc('#20302e'), 0.25);
        break;
      case 'mark': {
        const pulse = 1 + 0.12 * Math.sin(t * 6);
        push('reticle', x, H + 0.32, y, qBill(t * 1.2), 0.17 * pulse, 0.17 * pulse, 1, tc('#ff3a5a'), 0.95);
        ground('ringN', x, y, 0.05, 0, R * 1.5 * pulse, R * 1.5 * pulse, tc('#ff3a5a'), 0.6);
        break;
      }
      case 'frenzy': {
        const pulse = 0.5 + 0.5 * Math.sin(t * 9);
        ground('glow', x, y, 0.04, 0, R * 2.4, R * 2.4, tc('#ff2a2a'), 0.45 + 0.25 * pulse);
        for (let i = 0; i < lim(5); i++) {
          const u = (t * 2.2 + i / 5 + seed) % 1;
          const a = (i / 5) * Math.PI * 2 - t;
          bill('flame', x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.7, H * u * 0.8, 0, 0.32 * (1 - u * 0.5), tc('#ff3020'), 1 - u);
        }
        bill('glow', x, y, H * 0.55, 0, H * 0.9, tc('#ff2a2a'), 0.18 + 0.12 * pulse);
        break;
      }
      case 'charge': {
        const px = tip ? tip[0] : x, ph = tip ? tip[1] : H * 0.5, py = tip ? tip[2] : y;
        const p = 0.6 + 0.4 * Math.sin(t * 14);
        bill('glow', px, py, ph, 0, 0.35 + 0.15 * p, tc('#ffe680'), 0.9);
        bill('star', px, py, ph, t * 5, 0.22 * p, WHITE, 1);
        for (let i = 0; i < lim(6); i++) {
          const u = 1 - ((t * 1.6 + i / 6) % 1);
          const a = i * 1.05 + seed;
          bill('dot', px + Math.cos(a) * u * 0.7, py + Math.sin(a) * u * 0.5, ph + (hash(i, seed, 1) - 0.5) * u, 0, 0.06, tc('#fff2b0'), 1 - u * 0.5);
        }
        break;
      }
      case 'haste': {
        ground('ring', x, y, 0.05, t * 6, R * 1.6, R * 1.6, tc('#fff2a0'), 0.55);
        const bx = -Math.cos(face), by = -Math.sin(face);
        for (let i = 0; i < lim(3); i++) {
          const u = (t * 3 + i / 3) % 1;
          const o = (i - 1) * 0.18;
          push('trail', x + bx * (0.2 + u * 0.5) - by * o, 0.25 + i * 0.18, y + by * (0.2 + u * 0.5) + bx * o, qGround(face + Math.PI), 0.5, 0.07, 1, WHITE, 0.8 * (1 - u));
        }
        break;
      }
      case 'rune_fire':
      case 'rune_frost':
      case 'rune_storm': {
        const col = tg === 'rune_fire' ? tc('#ff7a2f') : tg === 'rune_frost' ? tc('#7fd6ff') : tc('#ffe14d');
        ground('rune', x, y, 0.045, t * 0.9, R * 2.2, R * 2.2, col, 0.85);
        if (tip) {
          bill('glow', tip[0], tip[2], tip[1], 0, 0.4, col, 0.8);
          if (tg === 'rune_fire') { const u = (t * 2) % 1; bill('flame', tip[0], tip[2], tip[1] + u * 0.3, 0, 0.18 * (1 - u), col, 1 - u); }
          else if (tg === 'rune_frost') push('shard', tip[0], tip[1] + 0.1 * Math.sin(t * 3), tip[2], qEuler(t, t * 2, 0), 0.05, 0.08, 0.05, col, 0.9);
          else if (hash(Math.floor(t * 12), seed, 1) > 0.5) { _q2.setFromAxisAngle(Y, t * 7); push('bolt', tip[0], tip[1] - 0.2, tip[2], _q2, 0.6, 0.45, 0.6, col, 1); }
        }
        break;
      }
      case 'ki': {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
        ground('ring', x, y, 0.05, 0, R * (1.6 + 0.3 * pulse), R * (1.6 + 0.3 * pulse), tc('#ffd23f'), 0.7);
        ground('glow', x, y, 0.04, 0, R * 2, R * 2, tc('#ffd23f'), 0.35 + 0.2 * pulse);
        for (let i = 0; i < lim(6); i++) {
          const u = (t * 0.5 + i / 6 + seed) % 1;
          const a = i * 1.05;
          bill('dot', x + Math.cos(a) * R * 1.3, y + Math.sin(a) * R, u * H * 1.3, 0, 0.07, i % 2 ? tc('#ffe680') : tc('#7fe0a0'), Math.sin(u * Math.PI));
        }
        break;
      }
      case 'shadow':
        ground('glowN', x, y, 0.035, 0, R * 2.2, R * 2.2, tc('#1a1030'), 0.5);
        for (let i = 0; i < lim(5); i++) {
          const u = (t * 0.8 + i / 5 + seed) % 1;
          const a = i * 1.26 + t * 0.4;
          ball('puff', x + Math.cos(a) * R * 1.0, y + Math.sin(a) * R * 0.8, u * H, 0.12 * (1 - u * 0.4), tc('#3a2a5a'), 0.7 * (1 - u));
        }
        break;
      case 'summoned':
        ground('ring', x, y, 0.05, 0, R * 1.7, R * 1.7, tc('#3fe0c5'), 0.6);
        for (let i = 0; i < lim(3); i++) {
          const a = t * 2 + (i / 3) * Math.PI * 2;
          bill('dot', x + Math.cos(a) * R * 1.3, y + Math.sin(a) * R * 1.0, H * (0.5 + 0.2 * Math.sin(t * 3 + i)), 0, 0.09, tc('#7ff8e0'), 0.9);
        }
        break;
      case 'wanted': {
        const b = Math.abs(Math.sin(t * 4)) * 0.06;
        bill('bang', x, y, H + 0.3 + b, 0, 0.19, WHITE, 1);
        push('bang', x, H + 0.3 + b, y + 0.03, qBill(0), 0.14, 0.14, 1, tc('#ff2a3a'), 1);
        break;
      }
      case 'sleep':
        for (let i = 0; i < 3; i++) {
          const u = (t * 0.45 + i / 3) % 1;
          const s = 0.06 + 0.08 * u;
          bill('zee', x + 0.15 + u * 0.35, y - 0.05, H * 0.6 + u * 0.7, -0.2, s, tc('#ffffff'), Math.sin(u * Math.PI));
        }
        break;
      case 'levelup_ready': {
        const b = Math.sin(t * 3.5) * 0.06;
        bill('arrow', x, y, H + 0.32 + b, 0, 0.17, WHITE, 1);
        push('arrow', x, H + 0.32 + b, y + 0.03, qBill(0), 0.13, 0.13, 1, tc('#ffd24a'), 1);
        const g = (t * 0.9) % 1;
        bill('star', x + 0.2, y, H + 0.45, t * 3, 0.1 * Math.sin(g * Math.PI), tc('#fff2a0'), 1);
        break;
      }
      case 'venom':
        for (let i = 0; i < lim(5); i++) {
          const u = (t * 0.9 + i / 5 + seed) % 1;
          const a = i * 1.3;
          const xx = x + Math.cos(a) * R * 0.8, yy = y + Math.sin(a) * R * 0.6;
          push('ringN', xx, 0.15 + u * H, yy, qBill(0), 0.07 + 0.03 * u, 0.07 + 0.03 * u, 1, tc('#7cf07c'), 1 - u);
          bill('dotN', xx, yy, 0.15 + u * H, 0, 0.04, tc('#4fdc4f'), 0.7 * (1 - u));
        }
        ground('glowN', x, y, 0.035, 0, R * 1.5, R * 1.5, tc('#4fdc4f'), 0.35);
        break;
      default:
        unknown.add('fxTag:' + tg);
    }
  }

  /** Effect-rig visuals (the translucent parts). look: effect look; ex, ey: position, ez: height. */
  function effect(look, meta, x, y, z, angle, t, seed, alpha) {
    const c = C1.set(look.color || '#ffe066');
    const r = look.r || 0.5;
    const a = alpha;
    switch (meta.model) {
      case 'barrier': {
        push('dome', x, 0, y, qUp(t * 0.2), r, r * 0.8, r, c, 0.7 * a);
        push('dome', x, 0, y, qUp(-t * 0.3), r * 1.01, r * 0.81, r * 1.01, WHITE, 0.15 * a);
        ground('rune', x, y, 0.05, t * 0.4, r, r, c, 0.9 * a);
        const n = lim(Math.min(16, Math.ceil(r * 3)));
        for (let i = 0; i < n; i++) {
          const u = (t * 0.5 + i / n + seed) % 1;
          const aa = (i / n) * Math.PI * 2 + seed;
          bill('star', x + Math.cos(aa) * r * 0.98, y + Math.sin(aa) * r * 0.98, u * r * 0.7, t, 0.12 * Math.sin(u * Math.PI), WHITE, a);
        }
        break;
      }
      case 'telegraph_circle': {
        const pulse = 0.5 + 0.5 * Math.sin(t * 10);
        ground('glowN', x, y, 0.04, 0, r, r, c, (0.25 + 0.1 * pulse) * a);
        ground('ringN', x, y, 0.05, 0, r, r, c, 0.95 * a);
        const f = (t * 1.6 + seed) % 1;
        ground('ringN', x, y, 0.05, 0, r * f, r * f, c, 0.7 * a);
        break;
      }
      case 'telegraph_line': {
        const len = look.len || 2, w = look.w || 0.6;
        const pulse = 0.5 + 0.5 * Math.sin(t * 10);
        push('rect', x, 0.05 + G0, y, qGround(angle), len, w, 1, c, (0.75 + 0.25 * pulse) * a);
        const f = (t * 1.6 + seed) % 1;
        push('rect', x, 0.055 + G0, y, qGround(angle), len * f, w * 0.7, 1, c, 0.6 * a);
        break;
      }
      case 'telegraph_cone': {
        const len = look.len || 1.5, arc = look.arc || 90;
        const id = 'fan' + nearest(FANS, arc);
        const sy = arc / nearest(FANS, arc);
        const pulse = 0.5 + 0.5 * Math.sin(t * 10);
        push(id, x, 0.05 + G0, y, qGround(angle), len, len * sy, 1, c, (0.75 + 0.25 * pulse) * a);
        const f = (t * 1.6 + seed) % 1;
        push(id, x, 0.055 + G0, y, qGround(angle), len * f, len * f * sy, 1, c, 0.5 * a);
        break;
      }
      case 'ground_fire': {
        ground('glow', x, y, 0.04, 0, r * 1.15, r * 1.15, c, 0.7 * a);
        ground('glowN', x, y, 0.03, 0, r, r, _c.set(0.25, 0.08, 0.02), 0.45 * a);
        const n = lim(Math.max(3, Math.round(r * r * 5)));
        for (let i = 0; i < n; i++) {
          const aa = hash(seed, i, 1) * Math.PI * 2, d = r * 0.85 * Math.sqrt(hash(seed, i, 2));
          const u = (t * 1.5 + hash(seed, i, 3)) % 1;
          const fl = 0.3 + 0.25 * hash(seed, i, 4);
          bill('flame', x + Math.cos(aa) * d, y + Math.sin(aa) * d, u * 0.25, Math.sin(t * 7 + i) * 0.2, fl * (1 - u * 0.5), c, a * (1 - u));
          if (i % 3 === 0) bill('flame', x + Math.cos(aa) * d, y + Math.sin(aa) * d + 0.01, u * 0.2, 0, fl * 0.45 * (1 - u), WHITE, a * (1 - u));
        }
        for (let i = 0; i < lim(3); i++) {
          const u = (t * 0.8 + i / 3 + seed) % 1;
          bill('dot', x + Math.cos(i * 2.2) * r * 0.5, y + Math.sin(i * 2.2) * r * 0.4, u * 1.2, 0, 0.05, tc('#ffd27a'), a * (1 - u));
        }
        break;
      }
      case 'ground_frost': {
        ground('glowN', x, y, 0.03, 0, r, r, tc('#e8faff'), 0.75 * a);
        ground('ringN', x, y, 0.04, 0, r, r, c, 0.7 * a);
        const n = lim(Math.max(3, Math.round(r * r * 6)));
        for (let i = 0; i < n; i++) {
          const aa = hash(seed, i, 1) * Math.PI * 2, d = r * 0.85 * Math.sqrt(hash(seed, i, 2));
          push('shard', x + Math.cos(aa) * d, 0.05, y + Math.sin(aa) * d, qEuler(0.3 * hash(seed, i, 3), aa, 0.3), 0.06, 0.1 + 0.12 * hash(seed, i, 4), 0.06, c, 0.95 * a);
        }
        const g = (t * 0.7 + seed) % 1;
        bill('star', x + r * 0.3, y, 0.25, 0, 0.12 * Math.sin(g * Math.PI), WHITE, a);
        break;
      }
      case 'zone_ring': {
        ground('ring', x, y, 0.05, 0, r, r, c, 0.85 * a);
        ground('glow', x, y, 0.03, 0, r, r, c, 0.2 * a);
        for (let i = 0; i < lim(6); i++) {
          const aa = (i / 6) * Math.PI * 2 + t * 0.8;
          bill('dot', x + Math.cos(aa) * r, y + Math.sin(aa) * r, 0.12, 0, 0.09, c, a);
        }
        break;
      }
      case 'rune_seal':
        push('rune', x, 0.65, y + 0.02, qUp(0), 0.5, 0.5, 1, c, a);
        push('rune', x, 0.65, y + 0.03, _q.setFromAxisAngle(_d.set(0, 0, 1), t * 0.6), 0.36, 0.36, 1, WHITE, 0.6 * a);
        bill('glow', x, y + 0.05, 0.65, 0, 0.9 + 0.1 * Math.sin(t * 3), c, 0.6 * a);
        ground('glow', x, y, 0.04, 0, 1.0, 0.7, c, 0.5 * a);
        break;
      case 'shield_bubble': {
        const p = 1 + 0.03 * Math.sin(t * 4);
        push('dome', x, 0, y, qUp(t * 0.4), r * p, r * p, r * p, c, 0.8 * a);
        ground('ring', x, y, 0.05, 0, r * p, r * p, c, 0.9 * a);
        ground('glow', x, y, 0.03, 0, r, r, c, 0.25 * a);
        break;
      }
      case 'caltrops':
        if (((t * 0.8 + seed) % 1) < 0.3) bill('star', x + r * 0.3, y - r * 0.2, 0.1, 0, 0.08, WHITE, a);
        break;
      case 'smoke': {
        const n = lim(Math.max(5, Math.round(r * 6)));
        for (let i = 0; i < n; i++) {
          const aa = hash(seed, i, 1) * Math.PI * 2 + t * 0.3 * (i % 2 ? 1 : -1);
          const d = r * 0.7 * Math.sqrt(hash(seed, i, 2));
          const h = 0.25 + 0.5 * hash(seed, i, 3) + 0.15 * Math.sin(t * 1.3 + i);
          ball('puff', x + Math.cos(aa) * d, y + Math.sin(aa) * d, h, r * (0.33 + 0.08 * Math.sin(t * 2 + i)), look.color ? c : tc('#b8b4c4'), 0.92 * a);
        }
        break;
      }
      case 'portal': {
        ground('rune', x, y, 0.05, t * 1.2, r, r, c, a);
        ground('glow', x, y, 0.04, 0, r * 1.1, r * 1.1, c, 0.8 * a);
        ground('ring', x, y, 0.06, -t * 2, r * 0.6, r * 0.6, WHITE, 0.6 * a);
        for (let i = 0; i < lim(8); i++) {
          const u = (t * 0.6 + i / 8) % 1;
          const aa = i * 0.785 + u * 4;
          bill('dot', x + Math.cos(aa) * r * (1 - u * 0.6), y + Math.sin(aa) * r * (1 - u * 0.6), u * 1.4, 0, 0.08 * (1 - u), i % 2 ? c : WHITE, a * (1 - u));
        }
        break;
      }
      case 'meteor': {
        const hz = z;
        for (let i = 0; i < lim(5); i++) {
          const u = (t * 3 + i / 5) % 1;
          bill('flame', x + (hash(i, seed, 1) - 0.5) * 0.2, y - 0.05, hz + 0.2 + u * 0.9, Math.PI + (hash(i, seed, 2) - 0.5) * 0.3, 0.6 * (1 - u * 0.6), c, a * (1 - u));
        }
        bill('glow', x, y, hz + 0.3, 0, 1.0, c, 0.8 * a);
        const s = 1 / (1 + hz * 0.3);
        ground('glowN', x, y, 0.03, 0, r * 1.4 * s, r * 1.4 * s, BLACK, 0.4 * a);
        break;
      }
      case 'chest_open': {
        bill('glow', x, y, 0.5, 0, 0.6, tc('#fff2a0'), 0.6 * a);
        for (let i = 0; i < lim(3); i++) { const u = (t * 0.6 + i / 3) % 1; bill('star', x + (i - 1) * 0.15, y, 0.4 + u * 0.6, t, 0.1 * Math.sin(u * Math.PI), tc('#fff2a0'), a); }
        break;
      }
      case 'rune_chest':
        bill('glow', x, y + 0.2, 0.42, 0, 0.35 + 0.08 * Math.sin(t * 3), tc(look.color || '#9fe6ff'), 0.7 * a);
        break;
      case 'chest':
        if (((t * 0.4 + seed) % 1) < 0.25) bill('star', x + 0.25, y + 0.1, 0.5, t * 4, 0.1, WHITE, a);
        break;
      case 'gold':
      case 'heart':
      case 'item': {
        const g = (t * 0.8 + seed) % 1;
        if (g < 0.35) bill('star', x + 0.12, y, 0.45, t * 3, 0.12 * Math.sin(g / 0.35 * Math.PI), WHITE, a);
        ground('glow', x, y, 0.03, 0, 0.35, 0.35, meta.model === 'heart' ? tc('#ff5a7a') : meta.model === 'gold' ? tc('#ffd24a') : tc('#c9a6ff'), 0.4 * a);
        break;
      }
      case 'xp_orb':
        bill('glow', x, y, 0.25 + z, 0, 0.32, look.color ? c : tc('#7cf07c'), 0.9 * a);
        bill('star', x, y, 0.25 + z, t * 4, 0.12, WHITE, 0.8 * a);
        break;
      case 'stick': {
        const g = (t * 0.6 + seed) % 1;
        bill('star', x + 0.1, y, 0.2 + g * 0.2, t * 2, 0.14 * Math.sin(g * Math.PI), tc('#fff2a0'), a);
        ground('glow', x, y, 0.03, 0, 0.5, 0.5, tc('#fff2a0'), 0.35 * a);
        break;
      }
      case 'totem':
        ground('ring', x, y, 0.05, t, 0.9, 0.9, look.color ? c : tc('#c8503c'), 0.5 * a);
        bill('glow', x, y + 0.15, 0.82, 0, 0.3 + 0.08 * Math.sin(t * 4), tc('#ffe680'), 0.5 * a);
        break;
      case 'decoy_puff':
        for (let i = 0; i < 2; i++) {
          const u = (t * 0.7 + i / 2 + seed) % 1;
          ball('puff', x + (i - 0.5) * 0.2, y, 0.5 + u * 0.5, 0.1 * (1 - u), tc('#e8e4f0'), 0.8 * (1 - u) * a);
        }
        break;
      default: break;
    }
  }

  /** Projectile visuals: glow + trail. */
  function projectile(look, meta, x, y, h, angle, t, seed, moving) {
    const c = C1.set(look.color || '#ffe066');
    const g = look.glow ? C2.set(look.glow) : C2.copy(c).lerp(WHITE, 0.5);
    const s = look.size || 1;
    const bx = -Math.cos(angle), by = -Math.sin(angle);
    const trail = meta.trail;
    switch (meta.model) {
      case 'bolt':
        bill('glow', x, y, h, 0, 0.42 * s, c, 0.9);
        if (trail) {
          push('trail', x + bx * 0.9 * s, h, y + by * 0.9 * s, qGround(angle), 0.9 * s, 0.28 * s, 1, c, 0.9);
          push('trail', x + bx * 0.7 * s, h + 0.01, y + by * 0.7 * s, qGround(angle), 0.7 * s, 0.1 * s, 1, g, 1);
        }
        for (let i = 0; i < lim(3); i++) {
          const u = (t * 4 + i / 3 + seed) % 1;
          bill('dot', x + bx * u * 0.8, y + by * u * 0.8, h + (hash(i, seed, 1) - 0.5) * 0.2 * u, 0, 0.07 * (1 - u), g, 1 - u);
        }
        break;
      case 'orb':
        bill('glow', x, y, h, 0, 0.5 * s * (1 + 0.08 * Math.sin(t * 12)), c, 0.85);
        for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; bill('dot', x + Math.cos(a) * 0.2 * s, y + Math.sin(a) * 0.14 * s, h + Math.sin(a) * 0.1, 0, 0.06, g, 0.9); }
        if (trail) push('trail', x + bx * 0.6 * s, h, y + by * 0.6 * s, qGround(angle), 0.6 * s, 0.22 * s, 1, c, 0.6);
        break;
      case 'fireball':
        bill('glow', x, y, h, 0, 0.6 * s, c, 0.9);
        for (let i = 0; i < lim(5); i++) {
          const u = (t * 3.5 + i / 5 + seed) % 1;
          bill('flame', x + bx * u * 0.7 * s + (hash(i, seed, 2) - 0.5) * 0.15, y + by * u * 0.7 * s, h - 0.12 + u * 0.15, Math.PI / 2 * Math.sign(bx || 1) * 0.6, 0.4 * s * (1 - u * 0.7), u < 0.3 ? tc('#fff0a0') : c, 1 - u);
        }
        for (let i = 0; i < lim(3); i++) { const u = (t * 2 + i / 3) % 1; bill('dot', x + bx * u * 1.2, y + by * u * 1.2, h + u * 0.3, 0, 0.05, tc('#ffd27a'), 1 - u); }
        break;
      case 'spark':
        bill('glow', x, y, h, 0, 0.35 * s, c, 0.9);
        bill('star', x, y, h, t * 20, 0.25 * s * (0.8 + 0.4 * hash(Math.floor(t * 30), seed, 1)), WHITE, 1);
        if (trail) push('trail', x + bx * 0.5, h, y + by * 0.5, qGround(angle), 0.5, 0.1, 1, c, 0.8);
        break;
      case 'wave':
      case 'crescent': {
        const id = meta.model === 'wave' ? 'arcW140' : 'arcW190';
        const arc = meta.model === 'wave' ? 140 : 190;
        const R = (meta.model === 'wave' ? 0.75 : 0.55) * s;
        const st = angle - (arc * DEG) / 2;
        const bxx = x - Math.cos(angle) * R * 0.75, byy = y - Math.sin(angle) * R * 0.75;
        push(id, bxx, h, byy, qGroundTilt(st, 0), R, -R, 1, c, 0.95);
        push('arcT' + (meta.model === 'wave' ? 140 : 190), bxx, h + 0.01, byy, qGroundTilt(st, 0), R * 1.03, -R * 1.03, 1, WHITE, 0.9);
        if (meta.model === 'wave') push(id, bxx, h - 0.2, byy, qGroundTilt(st, 0.6), R * 0.95, -R * 0.95, 1, c, 0.5);
        bill('glow', x, y, h, 0, 0.6 * s, c, 0.5);
        for (let i = 0; i < lim(3); i++) {
          const u = (t * 3 + i / 3 + seed) % 1;
          bill('dot', bxx + bx * u * 0.6 + (hash(i, seed, 3) - 0.5) * R, byy + by * u * 0.6, h, 0, 0.06 * (1 - u), WHITE, 1 - u);
        }
        break;
      }
      case 'ice':
        bill('glow', x, y, h, 0, 0.35 * s, c, 0.6);
        for (let i = 0; i < lim(3); i++) { const u = (t * 3 + i / 3 + seed) % 1; bill('star', x + bx * u * 0.8, y + by * u * 0.8, h, 0, 0.07 * (1 - u), WHITE, 1 - u); }
        break;
      case 'spore':
        bill('glow', x, y, h, 0, 0.4 * s, c, 0.5);
        for (let i = 0; i < lim(3); i++) { const u = (t * 2 + i / 3 + seed) % 1; bill('dotN', x + bx * u * 0.6, y + by * u * 0.6, h + u * 0.2, 0, 0.05 * (1 - u), c, 1 - u); }
        break;
      case 'axe':
        ground('ring', x, y, h, 0, 0.32 * s, 0.32 * s, WHITE, 0.4);
        break;
      case 'coin':
        if (((t * 2 + seed) % 1) < 0.3) bill('star', x, y, h + 0.05, t * 6, 0.12, WHITE, 1);
        break;
      default:
        if (look.glow) bill('glow', x, y, h, 0, 0.25 * s, g, 0.6);
        if (trail && moving) push('trail', x + bx * 0.6 * s, h, y + by * 0.6 * s, qGround(angle), 0.6 * s, 0.12 * s, 1, WHITE, 0.55);
    }
  }

  return {
    batches,
    push, ground, bill, ball, qGround, qBill, qUp, qEuler,
    shadow, glowAt, aura, tag, effect, projectile,
    spawn,
    setQuality(q) { quality = q; },
    begin(camera) {
      camQ.copy(camera.quaternion);
      for (const b of list) b.n = 0;
      screenAlpha = 0;
    },
    update,
    end(camera) {
      if (screenAlpha > 0.003) {
        // a quad just in front of the near plane covering the view
        const dist = camera.near * 1.5;
        const hh = 2 * dist * Math.tan((camera.fov * Math.PI / 180) / 2) * 1.2;
        _d.set(0, 0, -dist).applyQuaternion(camera.quaternion).add(camera.position);
        push('screen', _d.x, _d.y, _d.z, camera.quaternion, hh * camera.aspect, hh, 1, screenColor, screenAlpha);
      }
      for (const b of list) {
        b.mesh.count = b.n;
        b.mesh.visible = b.n > 0;
        if (b.n) {
          b.mesh.instanceMatrix.needsUpdate = true;
          b.mesh.instanceColor.needsUpdate = true;
          b.alpha.needsUpdate = true;
          b.mesh.instanceMatrix.clearUpdateRanges(); b.mesh.instanceMatrix.addUpdateRange(0, b.n * 16);
          b.mesh.instanceColor.clearUpdateRanges(); b.mesh.instanceColor.addUpdateRange(0, b.n * 3);
          b.alpha.clearUpdateRanges(); b.alpha.addUpdateRange(0, b.n);
        }
      }
    },
    clear() { for (const r of recs) r.on = false; },
    instanceCount() { let n = 0; for (const b of list) n += b.n; return n; },
    dispose() {
      for (const b of list) { scene.remove(b.mesh); b.geo.dispose(); b.mesh.dispose(); }
    },
  };
}
