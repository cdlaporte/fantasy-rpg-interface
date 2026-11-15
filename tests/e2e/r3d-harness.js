// Busy-scene harness for the 3D renderer budgets (owned by Render 3D; not part of the game).
// ?scene=town  : the town square with 12 NPCs, the player and 2 companions, a few fx
// ?scene=enemies : a forest clearing with 24 enemies, projectiles and fx
// ?zoom=Z, ?quality=Q. window.__r3d = {ready, setTime(t), stats(), setQuality(q), renderer}
import { makeFrameState, makeEntityView, assignFxEvent, makeFxEvent } from '../../src/contracts.js';
import { createRenderer } from '../../src/render/index.js';
import tileList from '../../src/data/tiles.js';
import props from '../../src/data/props.js';
import { PALETTES } from '../../src/data/palettes.js';
import { PLAYER_LOOKS, LAPORTE_LOOK } from '../../src/data/looks.js';

const q = new URLSearchParams(location.search);
const sceneId = q.get('scene') || 'town';
const T = Object.fromEntries(tileList.map((t, i) => [t.id, i]));
const clone = (o) => JSON.parse(JSON.stringify(o));

function zone(w, h, fill, palette) {
  const tiles = new Uint8Array(w * h).fill(T[fill]);
  const variant = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) variant[i] = (Math.imul(i + 7, 2654435761) >>> 24) & 255;
  return { id: 'harness_' + sceneId, w, h, tiles, variant, tileDefs: tileList, props: [], palette: PALETTES[palette] || PALETTES.default };
}
const rect = (z, x0, y0, w, h, id) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < z.w && y < z.h) z.tiles[y * z.w + x] = T[id]; };
const prop = (z, kind, x, y, look) => {
  const d = props[kind];
  const fw = d.footprint ? d.footprint[0] : 1, fh = d.footprint ? d.footprint[1] : 1;
  z.props.push({ id: null, kind, def: d, look: Object.assign({}, d.look, look || {}), x, y, w: fw, h: fh });
};

let nextId = 1;
const ents = [];
function ent(f) {
  const v = makeEntityView();
  Object.assign(v, f);
  v.id = nextId++;
  v.px = v.x; v.py = v.y;
  v.base = { x: v.x, y: v.y };
  ents.push(v);
  return v;
}

const OUTFITS = ['tunic', 'robe', 'apron', 'dress', 'vest', 'uniform', 'leather', 'gi', 'plate', 'cloak', 'tunic', 'quarterzip'];
const HAIRS = ['short', 'long', 'bun', 'ponytail', 'curly', 'spiky', 'bald', 'braids', 'short', 'long', 'curly', 'bun'];
const HATS = [null, { style: 'straw', color: '#e8c870' }, null, { style: 'chef', color: '#ffffff' }, null, { style: 'cap', color: '#4a90d9' },
  { style: 'feather', color: '#3fa34d' }, null, { style: 'helm', color: '#b0b8c8' }, null, { style: 'wizard', color: '#7a5ad9' }, null];
const PRIM = ['#e8503c', '#7a5ad9', '#f4f4f4', '#ff8fc7', '#c98c50', '#3d5aa8', '#4fae4f', '#ffd23f', '#b0b8c8', '#6a5a8a', '#4fb8a8', '#d9534f'];
const SKINS = ['#f1c7a0', '#c68e62', '#8d5a3b', '#e0ac7e', '#a8714a', '#f6cfa6'];
const HAIRC = ['#3a2618', '#e8c870', '#8b4a2b', '#1a1a1a', '#c0603a', '#6b4423'];

let frame, fxList = [];
function buildTown() {
  const z = zone(48, 36, 'grass', 'town');
  rect(z, 0, 0, 48, 1, 'hedge'); rect(z, 0, 35, 48, 1, 'hedge'); rect(z, 0, 0, 1, 36, 'hedge'); rect(z, 47, 0, 1, 36, 'hedge');
  rect(z, 12, 10, 24, 16, 'cobble');
  rect(z, 22, 26, 4, 10, 'path'); rect(z, 0, 16, 12, 3, 'path'); rect(z, 36, 16, 12, 3, 'path');
  rect(z, 2, 3, 8, 5, 'flowers'); rect(z, 38, 26, 7, 6, 'tallgrass'); rect(z, 40, 3, 5, 4, 'water'); rect(z, 39, 2, 7, 1, 'shallows');
  prop(z, 'fountain', 22.5, 16.5);
  prop(z, 'house', 12, 4); prop(z, 'shop', 17, 4, { sign: 'potion' }); prop(z, 'shop', 27, 4, { roof: '#3fa34d', sign: 'bread' }); prop(z, 'tower', 32, 4);
  prop(z, 'stall', 30, 21); prop(z, 'stall', 14, 21, { awning: '#4a90d9' });
  for (const [x, y] of [[13, 11], [34, 11], [13, 24], [34, 24]]) prop(z, 'lamp', x, y);
  prop(z, 'bench', 18, 13); prop(z, 'bench', 28, 13); prop(z, 'well', 37, 21);
  for (const [x, y] of [[4, 10], [6, 22], [9, 28], [40, 10], [44, 14], [3, 30], [42, 32]]) prop(z, 'tree', x, y);
  prop(z, 'pine', 8, 12); prop(z, 'pine', 44, 22);
  for (const [x, y] of [[11, 9], [36, 9]]) prop(z, 'flowerbed', x, y);
  prop(z, 'barrel', 21, 9); prop(z, 'crate', 25, 9); prop(z, 'sign', 26, 26); prop(z, 'banner', 21, 26);
  // 12 NPCs
  for (let i = 0; i < 12; i++) {
    const l = clone(PLAYER_LOOKS[i % 2]);
    l.skin = SKINS[i % SKINS.length];
    l.hair = { style: HAIRS[i], color: HAIRC[i % HAIRC.length] };
    l.outfit = { style: OUTFITS[i], primary: PRIM[i], secondary: PRIM[(i + 5) % 12], accent: '#ffd24a' };
    l.hat = HATS[i];
    if (i === 4) l.held = { style: 'broom', color: '#a0703f', glow: null };
    if (i === 9) l.held = { style: 'book', color: '#3d5aa8', glow: null };
    if (i === 11) { Object.assign(l, clone(LAPORTE_LOOK)); }
    const a = (i / 12) * Math.PI * 2;
    ent({ kind: 'npc' + i, type: 'npc', team: 'town', look: l, x: 24 + Math.cos(a) * 6.5, y: 18 + Math.sin(a) * 4.5, anim: i % 3 ? 'walk' : 'idle', dir: 2, radius: 0.3, name: 'npc' });
  }
  const pl = clone(PLAYER_LOOKS[0]);
  pl.outfit = { style: 'robe', primary: '#7a5ad9', secondary: '#4fe0e6', accent: '#ffd24a' };
  pl.hat = { style: 'wizard', color: '#5a3ab0' }; pl.held = { style: 'staff', color: '#8a5a33', glow: '#9fe6ff' };
  ent({ kind: 'player', type: 'player', team: 'player', look: pl, x: 24, y: 22.6, anim: 'walk', dir: 0, radius: 0.3, fxTags: ['haste'] });
  const bram = clone(PLAYER_LOOKS[0]); bram.outfit = { style: 'tunic', primary: '#e2503c', secondary: '#b0b8c8', accent: '#ffd24a' }; bram.held = { style: 'sword', color: '#d8dce8', glow: null };
  const pip = clone(PLAYER_LOOKS[1]); pip.size = 0.8; pip.outfit = { style: 'leather', primary: '#3fa34d', secondary: '#2a3a2a', accent: '#ffd24a' }; pip.hat = { style: 'bandana', color: '#2a9d8f' }; pip.held = { style: 'daggers', color: '#d8dce8', glow: null };
  ent({ kind: 'bram', type: 'companion', team: 'player', look: bram, x: 22.8, y: 23.4, anim: 'walk', dir: 0, radius: 0.3 });
  ent({ kind: 'pip', type: 'companion', team: 'player', look: pip, x: 25.2, y: 23.5, anim: 'walk', dir: 0, radius: 0.3 });
  fxList = [
    { type: 'sparkle', x: 23.5, y: 17.5, n: 8, r: 1, color: '#9fe6ff' },
    { type: 'poof', x: 20, y: 21, color: '#ffffff' },
    { type: 'heal', x: 22.8, y: 23.4 },
  ];
  return { zone: z, cam: [24, 19, 1] };
}

function buildEnemies() {
  const z = zone(40, 32, 'grass', 'forest');
  rect(z, 0, 0, 40, 3, 'trees'); rect(z, 0, 29, 40, 3, 'trees'); rect(z, 0, 0, 3, 32, 'trees'); rect(z, 37, 0, 3, 32, 'trees');
  rect(z, 4, 4, 6, 5, 'tallgrass'); rect(z, 28, 22, 8, 5, 'tallgrass'); rect(z, 15, 3, 3, 26, 'dirt'); rect(z, 30, 5, 5, 4, 'water');
  for (const [x, y] of [[8, 14], [32, 14], [24, 24], [6, 24]]) prop(z, 'tree', x, y);
  prop(z, 'mushroom_big', 12, 22); prop(z, 'rock', 27, 9); prop(z, 'stump', 9, 9); prop(z, 'log', 22, 7); prop(z, 'bush', 29, 18); prop(z, 'campfire', 18, 20);
  const kinds = [
    { rig: 'quadruped', size: 0.55, colors: { body: '#9a8a7a', belly: '#d8c8b8', accent: '#ff9aa8', eye: '#222222' }, features: ['tail_thin', 'ears_round'] },
    { rig: 'blob', size: 0.8, colors: { body: '#6fdc8c', belly: '#b8f5c8', accent: '#ffe066', eye: '#1a1a2a' }, features: ['drips'] },
    { rig: 'flyer', size: 0.7, colors: { body: '#7a5ad9', belly: '#d8c8ff', accent: '#ffe066', eye: '#1a1a2a' }, features: ['wings_bat'] },
    { rig: 'plant', size: 0.8, colors: { body: '#4fae4f', belly: '#c8e6a0', accent: '#ff6b8a', eye: '#1a1a2a' }, features: ['leaves', 'flower'] },
  ];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 4.5 + (i % 3) * 1.4;
    ent({ kind: 'enemy' + (i % 4), type: 'enemy', team: 'enemy', look: kinds[i % 4], x: 20 + Math.cos(a) * r * 1.4, y: 16 + Math.sin(a) * r,
      anim: i % 5 === 0 ? 'attack' : 'walk', dir: 2, angle: a + Math.PI, radius: 0.35, fxTags: i % 7 === 0 ? ['burn'] : i % 11 === 0 ? ['stun'] : [], flash: i === 3 ? 0.8 : 0 });
  }
  const pl = clone(PLAYER_LOOKS[1]);
  pl.outfit = { style: 'plate', primary: '#b0b8c8', secondary: '#e2503c', accent: '#f2c94c' };
  pl.hat = { style: 'helm', color: '#c8ccd8' }; pl.held = { style: 'sword_shield', color: '#e8ecf4', glow: null };
  pl.aura = { style: 'flame', color: '#f2c94c' };
  ent({ kind: 'player', type: 'player', team: 'player', look: pl, x: 20, y: 16.5, anim: 'attack', dir: 1, angle: 0, radius: 0.3 });
  for (let i = 0; i < 6; i++) {
    ent({ kind: 'projectile', type: 'projectile', team: 'player', look: { rig: 'projectile', model: i % 2 ? 'bolt' : 'arrow', color: i % 2 ? '#b48cff' : '#ffd24a', glow: '#9fe6ff', size: 1, trail: true },
      x: 21 + i * 0.7, y: 15 + (i % 3) * 0.6, z: 0, angle: -0.3, moving: true });
  }
  ent({ kind: 'fx', type: 'effect', team: 'enemy', look: { rig: 'effect', model: 'telegraph_circle', color: '#ff5a5a', r: 1.2 }, x: 14, y: 12 });
  ent({ kind: 'fx', type: 'effect', team: 'player', look: { rig: 'effect', model: 'ground_fire', color: '#ff8a3c', r: 1 }, x: 26, y: 19 });
  fxList = [
    { type: 'slash', x: 20, y: 16.5, angle: 0, arc: 110, r: 1.2, style: 'sword', color: '#ffffff' },
    { type: 'shockwave', x: 15, y: 19, r: 2.4, color: '#e8cf94' },
    { type: 'bolt', x: 25, y: 13, color: '#c9a6ff' },
    { type: 'burst', x: 23, y: 18, n: 14, r: 1, color: '#ffe066' },
  ];
  return { zone: z, cam: [20, 16.5, 1] };
}

const view = document.getElementById('view');
let renderer = null, cam = null, t = 0, pinned = null;
const fired = new Set();

function fill(time) {
  frame.t = time; frame.alpha = 1;
  if (q.has('daypart')) { frame.ambience.daypart = q.get('daypart'); frame.ambience.tint = q.get('tint') || '#ff9a5a'; frame.ambience.tintAmount = Number(q.get('amt') || 0.2); }
  frame.camera.x = cam[0]; frame.camera.y = cam[1]; frame.camera.zoom = q.has('zoom') ? Number(q.get('zoom')) : cam[2]; frame.camera.shake = 0;
  let n = 0;
  for (const e of ents) {
    if (e.type !== 'projectile' && e.type !== 'effect' && e.anim === 'walk') {
      e.moving = true;
      e.x = e.base.x + Math.sin(time * 0.6 + e.id) * 0.4; e.y = e.base.y + Math.cos(time * 0.5 + e.id) * 0.3;
    }
    e.animT = time % 1.5;
    e.px = e.x; e.py = e.y;
    frame.ents[n++] = e;
  }
  frame.entCount = n;
  let f = 0;
  const cycle = Math.floor(time / 1.5);
  if (!fired.has(cycle)) {
    fired.add(cycle);
    for (const ev of fxList) { const fe = assignFxEvent(makeFxEvent(), ev); frame.fx[f++] = fe; }
  }
  frame.fxCount = f;
  return frame;
}

async function main() {
  frame = makeFrameState();
  const built = sceneId === 'enemies' ? buildEnemies() : buildTown();
  cam = built.cam;
  renderer = await createRenderer('3d', view, { quality: q.has('quality') ? Number(q.get('quality')) : 2 });
  renderer.resize(view.clientWidth, view.clientHeight);
  renderer.loadZone(built.zone);
  const tickFn = (now) => {
    requestAnimationFrame(tickFn);
    t = pinned !== null ? pinned : now / 1000;
    renderer.render(fill(t));
  };
  renderer.render(fill(0));
  requestAnimationFrame(tickFn);
  window.__r3d = {
    ready: true,
    renderer,
    setTime(x) { pinned = x; renderer.render(fill(x)); renderer.render(fill(x + 0.1)); },
    setQuality(qq) { renderer.setQuality(qq); renderer.render(fill(pinned ?? t)); },
    stats() { return Object.assign({}, renderer.stats(), { renderer: renderer.id, entCount: frame.entCount }); },
  };
}
main().catch((e) => console.error('[r3d-harness]', e));
