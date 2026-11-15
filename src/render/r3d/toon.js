// Shared materials for the toy-box look. Every material in the 3D renderer comes from here, so the
// program count stays small (CONTRACTS section 7: <= 8 programs). One material object per role:
//   chunk      toon, vertex colors (rgba: a = 1 - emissive), see-through cutaway around the player
//   chunkLine  inverted-hull outline for props (back faces pushed along `smoothNormal`), same cutaway
//   water      toon with a cheap vertex wobble and moving highlights
//   char       instanced toon for every entity model: part "skinning" (pivot.w = part id, per-instance pose),
//              hit flash, tint (instanceColor), glow, dithered alpha
//   charLine   instanced outline for entity models (same posing)
//   fx         instanced unlit rgba quads/meshes with per-instance alpha (normal and additive share one program)
import * as THREE from 'three';

/** Uniforms shared by several materials (updated once per frame by the renderer). */
export const U = {
  uTime: { value: 0 },
  uOutline: { value: 0.04 },          // outline width in tiles (scaled with the camera distance)
  uCutPos: { value: new THREE.Vector3(0, 0, 0) },   // focus point (player) in world space
  uCutScreen: { value: new THREE.Vector3(0, 0, 0) }, // x, y in drawing-buffer px, z = radius px (0 = off)
  uRim: { value: new THREE.Color(1, 1, 1) },
};

let gradient = null;
/** The one shared 3-step toon ramp (NearestFilter). */
export function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([96, 178, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RedFormat, THREE.UnsignedByteType);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

// ---- GLSL snippets ----
const ROT = /* glsl */`
mat3 r3dRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 r3dRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 r3dRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
`;

// Part ids (pivot.w): 0 body, 1 head, 2 leg L, 3 leg R, 4 arm L, 5 arm R, 6 cape (rot X), 7 tail (rot Y)
const SKIN_PARS = /* glsl */`
attribute vec4 pivot;
attribute vec4 iPose0;  // legSwing, armL x, armR x, cape/tail
attribute vec4 iPose1;  // armL z, armR z, head x, head z
attribute vec4 iFx;     // flash, alpha, glow amount, leg bias (both legs x)
attribute vec3 iGlow;
varying float vFlash;
varying float vAlphaI;
varying vec3 vGlowAdd;
varying float vEmis;
${ROT}
mat3 r3dPartRot(float id) {
  if (id < 0.5) return mat3(1.0);
  if (id < 1.5) return r3dRotZ(iPose1.w) * r3dRotX(iPose1.z);
  if (id < 2.5) return r3dRotX(iPose0.x + iFx.w);
  if (id < 3.5) return r3dRotX(-iPose0.x + iFx.w);
  if (id < 4.5) return r3dRotZ(iPose1.x) * r3dRotX(iPose0.y);
  if (id < 5.5) return r3dRotZ(iPose1.y) * r3dRotX(iPose0.z);
  if (id < 6.5) return r3dRotX(iPose0.w);
  return r3dRotY(iPose0.w);
}
`;

const DITHER = /* glsl */`
float r3dBayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  // 4x4 Bayer matrix, row major
  float m = 0.0;
  if (i < 0.5) m = 0.0; else if (i < 1.5) m = 8.0; else if (i < 2.5) m = 2.0; else if (i < 3.5) m = 10.0;
  else if (i < 4.5) m = 12.0; else if (i < 5.5) m = 4.0; else if (i < 6.5) m = 14.0; else if (i < 7.5) m = 6.0;
  else if (i < 8.5) m = 3.0; else if (i < 9.5) m = 11.0; else if (i < 10.5) m = 1.0; else if (i < 11.5) m = 9.0;
  else if (i < 12.5) m = 15.0; else if (i < 13.5) m = 7.0; else if (i < 14.5) m = 13.0; else m = 5.0;
  return (m + 0.5) / 16.0;
}
`;

const CUT_PARS_FRAG = /* glsl */`
uniform vec3 uCutPos;
uniform vec3 uCutScreen;
varying vec3 vWorld;
${DITHER}
void r3dCutaway() {
  if (uCutScreen.z <= 0.0) return;
  // only things above the ground and in front of (south of) the focus can hide it
  if (vWorld.y < 0.32 || vWorld.z < uCutPos.z + 0.35) return;
  float d = length(gl_FragCoord.xy - uCutScreen.xy) / uCutScreen.z;
  if (d > 1.0) return;
  float keep = smoothstep(0.55, 1.0, d) * 0.9 + 0.1;
  if (r3dBayer(gl_FragCoord.xy) > keep) discard;
}
`;

const WORLD_VARY_VERT = /* glsl */`
#include <worldpos_vertex>
vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

/** Toon material for static chunk geometry (terrain + props). */
function makeChunk(gm) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gm });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uCutPos: U.uCutPos, uCutScreen: U.uCutScreen, uRim: U.uRim });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;\nvarying float vEmis;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvEmis = 1.0 - color.a;')
      .replace('#include <worldpos_vertex>', WORLD_VARY_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vEmis;\nuniform vec3 uRim;\n' + CUT_PARS_FRAG)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nr3dCutaway();')
      .replace('#include <opaque_fragment>', `outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.15, vEmis);
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'r3d-chunk';
  return m;
}

/** Outline (inverted hull) for chunk props. */
function makeChunkLine() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, color: new THREE.Color(0.07, 0.06, 0.1) });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uOutline: U.uOutline, uCutPos: U.uCutPos, uCutScreen: U.uCutScreen });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 smoothNormal;\nuniform float uOutline;\nvarying vec3 vWorld;')
      .replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(smoothNormal + vec3(0.0, 1e-5, 0.0)) * uOutline;')
      .replace('#include <worldpos_vertex>', WORLD_VARY_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CUT_PARS_FRAG)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nr3dCutaway();');
  };
  m.customProgramCacheKey = () => 'r3d-chunkline';
  return m;
}

/** Water surface: wobble + drifting highlight bands. Vertex alpha = 1 - foam. */
function makeWater(gm) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gm });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWorld;\nvarying float vFoam;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvFoam = 1.0 - color.a;')
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
float wob = sin(uTime * 1.7 + position.x * 1.9 + position.z * 1.3) + sin(uTime * 1.1 - position.x * 1.1 + position.z * 2.3);
transformed.y += wob * 0.018 * (1.0 - vFoam * 0.5);`)
      .replace('#include <worldpos_vertex>', WORLD_VARY_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWorld;\nvarying float vFoam;')
      .replace('#include <opaque_fragment>', `float band = sin(vWorld.x * 2.2 + vWorld.z * 3.1 + uTime * 1.3) * sin(vWorld.x * 3.7 - vWorld.z * 1.9 - uTime * 0.9);
outgoingLight += vec3(0.55, 0.65, 0.7) * step(0.82, band) * 0.6;
outgoingLight = mix(outgoingLight, vec3(0.95, 0.98, 1.0), smoothstep(0.25, 0.9, vFoam + 0.15 * sin(uTime * 2.0 + vWorld.x * 3.0)));
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'r3d-water';
  return m;
}

/** Instanced, posed entity toon material. */
function makeChar(gm) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gm });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = U.uRim;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SKIN_PARS)
      .replace('#include <color_vertex>', `#include <color_vertex>
vEmis = 1.0 - color.a; vFlash = iFx.x; vAlphaI = iFx.y; vGlowAdd = iGlow * iFx.z;`)
      .replace('#include <beginnormal_vertex>', 'mat3 r3dPR = r3dPartRot(pivot.w);\nvec3 objectNormal = r3dPR * normal;')
      .replace('#include <begin_vertex>', 'vec3 transformed = pivot.xyz + r3dPR * (position - pivot.xyz);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vFlash; varying float vAlphaI; varying vec3 vGlowAdd; varying float vEmis;
uniform vec3 uRim;
${DITHER}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vAlphaI < 0.995 && r3dBayer(gl_FragCoord.xy) > vAlphaI) discard;`)
      .replace('#include <opaque_fragment>', `outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.2, vEmis);
float r3dRim = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
outgoingLight += uRim * step(0.62, r3dRim) * 0.07;
outgoingLight += vGlowAdd * (0.35 + 0.65 * r3dRim);
outgoingLight = mix(outgoingLight, vec3(1.0), vFlash);
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'r3d-char';
  return m;
}

function makeCharLine() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, color: new THREE.Color(0.07, 0.06, 0.1) });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOutline = U.uOutline;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 smoothNormal;\nuniform float uOutline;\n' + SKIN_PARS)
      .replace('#include <color_vertex>', '#include <color_vertex>\nvFlash = iFx.x; vAlphaI = iFx.y;')
      .replace('#include <begin_vertex>', `mat3 r3dPR = r3dPartRot(pivot.w);
float r3dS = length(instanceMatrix[1].xyz);
vec3 transformed = pivot.xyz + r3dPR * (position - pivot.xyz) + normalize(r3dPR * smoothNormal + vec3(0.0, 1e-5, 0.0)) * uOutline / max(0.6, sqrt(r3dS));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vFlash; varying float vAlphaI;
${DITHER}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vAlphaI < 0.995 && r3dBayer(gl_FragCoord.xy) > vAlphaI) discard;`)
      .replace('#include <opaque_fragment>', `outgoingLight = mix(outgoingLight, vec3(1.0, 1.0, 0.9), vFlash * 0.6);
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'r3d-charline';
  return m;
}

/** Instanced unlit rgba fx material (per-instance alpha via `iAlpha`). */
function makeFx(additive) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float iAlpha;\nvarying float vIA;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvIA = iAlpha;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vIA;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vIA;');
  };
  m.customProgramCacheKey = () => 'r3d-fx';
  return m;
}

/** Create the material set (call once per renderer). */
export function createMaterials() {
  const gm = gradientMap();
  const mats = {
    chunk: makeChunk(gm),
    chunkLine: makeChunkLine(),
    water: makeWater(gm),
    char: makeChar(gm),
    charLine: makeCharLine(),
    fx: makeFx(false),
    fxAdd: makeFx(true),
  };
  return mats;
}

export function disposeMaterials(mats) {
  for (const k in mats) mats[k].dispose();
  if (gradient) { gradient.dispose(); gradient = null; }
}
