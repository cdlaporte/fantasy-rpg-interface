// Extra 2D renderer harness (owned by Render 2D): real-looking scenes the gallery fixture lacks.
// ?scene=town|town_evening|forest|academy|road|occlusion|stress|fx@<seconds>  window.__harness = {ready, scenes, show, setTime, stats}
import { makeFrameState, makeEntityView, makeFxEvent, assignFxEvent, FX_TYPES, SLASH_STYLES } from '../../src/contracts.js';
import tileList from '../../src/data/tiles.js';
import propDefs from '../../src/data/props.js';
import { PALETTES } from '../../src/data/palettes.js';
import { PLAYER_LOOKS, LAPORTE_LOOK, CLOAKED } from '../../src/data/looks.js';
import { create } from '../../src/render/r2d/index.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const TI = Object.fromEntries(tileList.map((t, i) => [t.id, i]));
const ANG = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

function zone(id, w, h, fill, palette) {
  const tiles = new Uint8Array(w * h).fill(TI[fill]);
  const variant = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) variant[i] = (Math.imul(i + 7, 2654435761) >>> 24) & 255;
  return { id, w, h, tiles, variant, tileDefs: tileList, props: [], palette: PALETTES[palette] || PALETTES.default };
}
const rect = (z, x, y, w, h, id) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < z.w && yy < z.h) z.tiles[yy * z.w + xx] = TI[id]; };
const prop = (z, kind, x, y, look) => {
  const d = propDefs[kind];
  const fp = d.footprint;
  z.props.push({ id: null, kind, def: d, look: Object.assign({}, d.look, look || {}), x, y, w: fp ? fp[0] : 1, h: fp ? fp[1] : 1 });
};
let nid = 1;
const ent = (look, x, y, o = {}) => {
  const v = makeEntityView();
  Object.assign(v, { id: nid++, kind: o.kind || 'h', type: o.type || 'npc', look, x, y, px: x, py: y, dir: o.dir ?? 2, anim: o.anim || 'idle',
    fxTags: o.tags || [], name: '', radius: 0.3, glow: o.glow || null, tint: o.tint || null, z: o.z || 0, flash: o.flash || 0, alpha: o.alpha ?? 1 });
  v.angle = o.angle ?? ANG[v.dir];
  v.walkPath = o.walk || null;
  return v;
};
const H = (i, patch) => Object.assign(clone(PLAYER_LOOKS[i % 2]), patch || {});
const outfit = (style, p, s, a) => ({ style, primary: p, secondary: s, accent: a });

// ------------------------------------------------------------------ scenes
function town(evening) {
  const z = zone('town', 44, 30, 'grass', 'town');
  rect(z, 0, 0, 44, 2, 'trees'); rect(z, 0, 0, 1, 30, 'hedge'); rect(z, 43, 0, 1, 30, 'hedge');
  rect(z, 12, 11, 20, 8, 'cobble'); rect(z, 20, 8, 4, 3, 'cobble'); rect(z, 20, 19, 4, 11, 'path');
  rect(z, 1, 14, 11, 2, 'path'); rect(z, 32, 14, 11, 2, 'path');
  rect(z, 1, 23, 42, 2, 'water'); rect(z, 1, 22, 42, 1, 'shallows'); rect(z, 1, 25, 42, 1, 'shallows'); rect(z, 1, 26, 42, 1, 'wet_sand');
  rect(z, 20, 22, 4, 4, 'path');
  rect(z, 2, 9, 7, 2, 'flowers'); rect(z, 35, 9, 7, 2, 'flowers'); rect(z, 27, 2, 3, 2, 'flowers');
  rect(z, 36, 18, 5, 3, 'tallgrass'); rect(z, 2, 27, 8, 3, 'tallgrass'); rect(z, 26, 27, 6, 3, 'dirt');
  rect(z, 9, 19, 3, 1, 'hedge'); rect(z, 32, 19, 3, 1, 'hedge');
  prop(z, 'academy', 17, 2); prop(z, 'house', 3, 3, { roof: '#d9534f' }); prop(z, 'shop', 8, 4, { roof: '#4a90d9', sign: 'potion' });
  prop(z, 'shop', 29, 4, { roof: '#5fae5f', wall: '#fff4e0', sign: 'hat' }); prop(z, 'house', 34, 3, { roof: '#e8a040', wall: '#f8e8d0' });
  prop(z, 'shop', 4, 16, { roof: '#c86ad9', sign: 'bread' }); prop(z, 'shop', 34, 16, { roof: '#d9534f', sign: 'cup' });
  prop(z, 'tower', 39, 5, { roof: '#7a5ad9' }); prop(z, 'shop', 12, 4, { roof: '#3d8ab8', sign: 'book' });
  prop(z, 'fountain', 20, 13);
  for (const [x, y] of [[12, 11], [31, 11], [12, 18], [31, 18], [19, 9], [24, 9]]) prop(z, 'lamp', x, y);
  prop(z, 'bench', 14, 12); prop(z, 'bench', 27, 12); prop(z, 'well', 37, 11);
  prop(z, 'stall', 14, 16, { awning: '#ff6b6b' }); prop(z, 'stall', 26, 16, { awning: '#4a90d9', awning2: '#fff4c0' });
  prop(z, 'bridge', 20, 23, {}); z.props[z.props.length - 1].w = 4;
  prop(z, 'tree', 1, 11); prop(z, 'tree', 41, 13); prop(z, 'pine', 2, 20); prop(z, 'tree', 15, 20); prop(z, 'tree', 27, 20, { leaves: '#5fbf4f' });
  prop(z, 'hedge_arch', 20, 20); prop(z, 'banner', 16, 7); prop(z, 'banner', 27, 7);
  prop(z, 'flowerbed', 17, 9); prop(z, 'flowerbed', 26, 9); prop(z, 'barrel', 10, 7); prop(z, 'crate', 11, 7); prop(z, 'cart', 37, 15);
  prop(z, 'sign', 24, 20); prop(z, 'statue', 13, 9); prop(z, 'fence', 30, 27); prop(z, 'fence', 31, 27); prop(z, 'fence', 32, 27); prop(z, 'bush', 6, 21); prop(z, 'bush', 38, 21);
  const ents = [
    ent(H(0), 21.5, 17.5, { type: 'player', dir: 0, anim: 'walk' }),
    ent(clone(LAPORTE_LOOK), 22.5, 9.2, { dir: 2 }),
    ent(H(1, { outfit: outfit('apron', '#e8e0d0', '#ffffff', '#c8503c'), hat: { style: 'chef', color: '#ffffff' }, hair: { style: 'bun', color: '#8a4a2a' } }), 15.5, 18.5, { dir: 2 }),
    ent(H(0, { outfit: outfit('vest', '#6b4423', '#f4ecd8', '#ffd24a'), hat: { style: 'straw', color: '#f0d070' }, facial: 'beard', hair: { style: 'short', color: '#8a8a8a' }, skin: '#e0b090' }), 27.5, 18.5, { dir: 2 }),
    ent(H(1, { outfit: outfit('dress', '#ff8fc7', '#ffffff', '#ffd24a'), hair: { style: 'braids', color: '#e8c060' }, skin: '#f0c8a0' }), 17, 15, { dir: 1, anim: 'walk' }),
    ent(H(0, { size: 0.8, outfit: outfit('tunic', '#ff9a3c', '#fff4e0', '#4a90d9'), hair: { style: 'spiky', color: '#c8503c' } }), 25, 14.5, { dir: 3, anim: 'walk' }),
    ent(H(0, { outfit: outfit('uniform', '#3d5aa8', '#ffffff', '#c8503c'), hat: { style: 'cap', color: '#3d5aa8' } }), 33, 15, { dir: 3, anim: 'walk' }),
    ent(H(1, { outfit: outfit('robe', '#7a5ad9', '#f4ecd8', '#ffd24a'), hat: { style: 'wizard', color: '#7a5ad9' }, hair: { style: 'long', color: '#f4f0e8' }, held: { style: 'book', color: '#8a3a5a' } }), 13.5, 13.2, { dir: 2, anim: 'sit' }),
    ent(H(0, { outfit: outfit('plate', '#b8c0cc', '#3d5aa8', '#ffd24a'), hat: { style: 'helm', color: '#b8c0cc' }, held: { style: 'spear', color: '#d8dee8' } }), 9.5, 14.8, { dir: 1 }),
    ent(H(1, { outfit: outfit('leather', '#8a5a33', '#4fb87a', '#c8a070'), hair: { style: 'ponytail', color: '#3a2618' }, ears: 'pointed', held: { style: 'bow', color: '#a0703c' } }), 36, 20, { dir: 2 }),
    ent(H(0, { outfit: outfit('gi', '#f4f0e8', '#3a3a4a', '#3a3a4a'), hair: { style: 'bald', color: '#3a2618' }, facial: 'mustache' }), 7.5, 12.6, { dir: 1, anim: 'walk' }),
    ent(H(1, { outfit: outfit('quarterzip', '#c8503c', '#f4e3c4', '#ffffff'), hair: { style: 'curly', color: '#2e1e14' }, held: { style: 'lantern', color: '#3a3a4a' } }), 30, 21, { dir: 2 }),
    ent({ rig: 'quadruped', size: 0.55, colors: { body: '#c98c50', belly: '#f4e3c4', accent: '#ff9aa8', eye: '#222222' }, features: ['tail_bushy', 'ears_pointy'], hero: null }, 23.5, 18.6, { dir: 3, anim: 'walk', type: 'neutral' }),
    ent({ rig: 'effect', model: 'chest', color: '#ffd24a' }, 38.5, 9.5, { type: 'effect' }),
  ];
  return { zone: z, ents, cam: { x: 22, y: 14, zoom: 1 }, ambience: evening ? { daypart: 'evening', tint: '#ff9a5a', tintAmount: 0.22 } : null };
}

function forest() {
  const z = zone('forest', 40, 26, 'grass', 'forest');
  rect(z, 0, 0, 40, 3, 'trees'); rect(z, 0, 0, 3, 26, 'trees'); rect(z, 34, 0, 6, 9, 'trees'); rect(z, 0, 22, 14, 4, 'trees');
  rect(z, 26, 20, 14, 6, 'trees'); rect(z, 14, 6, 4, 3, 'trees');
  rect(z, 3, 12, 37, 2, 'path'); rect(z, 18, 3, 2, 9, 'dirt'); rect(z, 6, 5, 6, 4, 'tallgrass'); rect(z, 22, 15, 8, 3, 'tallgrass');
  rect(z, 6, 16, 6, 4, 'flowers'); rect(z, 28, 4, 5, 3, 'flowers');
  rect(z, 14, 17, 9, 4, 'water'); rect(z, 13, 16, 11, 1, 'shallows'); rect(z, 13, 21, 11, 1, 'shallows'); rect(z, 13, 17, 1, 4, 'shallows'); rect(z, 23, 17, 1, 4, 'shallows');
  rect(z, 30, 9, 4, 2, 'cliff'); rect(z, 36, 11, 3, 1, 'crystal');
  for (const [k, x, y, l] of [['mushroom_big', 8, 9], ['mushroom_big', 10, 10, { cap: '#9a5ad9' }], ['rock', 24, 6], ['stump', 22, 9], ['log', 25, 10],
    ['pine', 30, 15], ['tree', 5, 3], ['tree', 12, 3], ['bush', 20, 5], ['crystal', 33, 13], ['campfire', 27, 7], ['tent', 29, 4], ['rune_gate', 4, 10], ['totem', 0, 0], ['flowerbed', 14, 14]]) {
    if (propDefs[k]) prop(z, k, x, y, l);
  }
  const C = (rig, colors, features, size, hero) => ({ rig, size: size || 1, colors, features, hero: hero || null });
  const ents = [
    ent(H(1, { outfit: outfit('robe', '#7a5ad9', '#9fe6ff', '#ffd24a'), held: { style: 'staff', color: '#8a5a33', glow: '#9fe6ff' }, aura: { style: 'sparkle', color: '#c9a6ff' } }), 18.5, 13, { type: 'player', dir: 1, anim: 'cast' }),
    ent(C('blob', { body: '#6fdc8c', belly: '#b8f5c8', accent: '#ffe066', eye: '#1a1a2a' }, [], 0.8), 22, 12.5, { dir: 3, anim: 'walk' }),
    ent(C('blob', { body: '#6fc0ff', belly: '#c8e8ff', accent: '#ffe066', eye: '#1a1a2a' }, ['crown', 'core_glow'], 1.1), 25, 13.4, { dir: 3 }),
    ent(C('plant', { body: '#f4e3c4', belly: '#ffffff', accent: '#e8503c', eye: '#1a1a2a' }, ['cap_mushroom'], 0.9), 9.5, 13, { dir: 2 }),
    ent(C('quadruped', { body: '#8a5a3c', belly: '#c8a080', accent: '#5a3a22', eye: '#1a1a2a' }, ['tusks', 'ears_pointy', 'mane', 'tail_thin'], 1.1), 31, 12.6, { dir: 3, anim: 'walk' }),
    ent(C('flyer', { body: '#6a4a8a', belly: '#9a7ab8', accent: '#ffe066', eye: '#ff5a5a' }, ['wings_bat'], 0.8), 20, 8, { dir: 2, anim: 'walk' }),
    ent(C('flyer', { body: '#bff4ff', belly: '#ffffff', accent: '#9fe6ff', eye: '#1a1a2a' }, ['orb', 'glow'], 0.8), 26, 8, { dir: 2 }),
    ent(C('plant', { body: '#4fae4f', belly: '#c8e6a0', accent: '#ff6b8a', eye: '#1a1a2a' }, ['thorns', 'leaves'], 0.9), 12, 15, { dir: 1 }),
    ent(C('plant', { body: '#7a5233', belly: '#c8e6a0', accent: '#5fb548', eye: '#ffe066' }, ['bark_face', 'leaves', 'vines'], 1.2), 15, 11, { dir: 2 }),
    ent(H(0, { skin: '#7cb85a', ears: 'pointed', size: 0.85, outfit: outfit('leather', '#8a6a4a', '#5a4a3a', '#c8a070'), hair: { style: 'bald', color: '#3a2618' }, held: { style: 'daggers', color: '#c8ccd8' } }), 33, 13.8, { dir: 3, anim: 'attack' }),
    ent(C('golem', { body: '#7a6a55', belly: '#a8957a', accent: '#5fb548', eye: '#ffe066' }, ['mossy', 'antlers'], 2.2, 'mossback'), 9, 19, { dir: 2, type: 'enemy' }),
    ent(C('golem', { body: '#a6a6b0', belly: '#d0d0d8', accent: '#7cc95a', eye: '#9fe6ff' }, ['rocky', 'crystal'], 1), 36, 15, { dir: 3 }),
  ];
  return { zone: z, ents, cam: { x: 20, y: 12, zoom: 1 } };
}

function academyScene() {
  const z = zone('academy', 36, 24, 'planks', 'academy');
  rect(z, 0, 0, 36, 3, 'wall'); rect(z, 0, 0, 1, 24, 'wall'); rect(z, 35, 0, 1, 24, 'wall'); rect(z, 0, 21, 36, 3, 'wall');
  rect(z, 12, 3, 12, 18, 'carpet'); rect(z, 1, 12, 10, 1, 'wall'); rect(z, 25, 12, 10, 1, 'wall'); rect(z, 4, 12, 2, 1, 'planks'); rect(z, 30, 12, 2, 1, 'planks');
  rect(z, 1, 13, 10, 8, 'stone');
  prop(z, 'bookshelf', 2, 3); prop(z, 'bookshelf', 5, 3); prop(z, 'bookshelf', 8, 3, { books: '#5fb548' });
  prop(z, 'chalkboard', 28, 3); prop(z, 'desk', 27, 6); prop(z, 'desk', 31, 6); prop(z, 'desk', 27, 9); prop(z, 'desk', 31, 9);
  prop(z, 'chair', 28, 7); prop(z, 'chair', 32, 7);
  prop(z, 'banner', 13, 3, { cloth: '#c8503c' }); prop(z, 'banner', 22, 3, { cloth: '#3d5aa8' });
  prop(z, 'bed', 2, 14); prop(z, 'bed', 4, 14, { sheet: '#ffb0c8' }); prop(z, 'bed', 6, 14); prop(z, 'cauldron', 9, 17); prop(z, 'table', 3, 18); prop(z, 'chair', 5, 19);
  prop(z, 'rug', 26, 14); z.props[z.props.length - 1].w = 4; z.props[z.props.length - 1].h = 3;
  prop(z, 'statue', 13, 9); prop(z, 'statue', 22, 9); prop(z, 'chest', 33, 18); prop(z, 'crate', 32, 18); prop(z, 'barrel', 31, 18); prop(z, 'lamp', 12, 18); prop(z, 'lamp', 23, 18);
  const ents = [
    ent(clone(LAPORTE_LOOK), 18, 6, { dir: 2, anim: 'cast' }),
    ent(H(0, { outfit: outfit('tunic', '#c8503c', '#d8dee8', '#ffd24a'), held: { style: 'sword', color: '#d8dee8' }, hair: { style: 'spiky', color: '#e8a040' } }), 15.5, 9, { dir: 1 }),
    ent(H(1, { outfit: outfit('robe', '#7a5ad9', '#9fe6ff', '#ffd24a'), held: { style: 'wand', color: '#f4ecd8', glow: '#9fe6ff' }, hair: { style: 'bun', color: '#2a1a14' } }), 20.5, 9, { dir: 3 }),
    ent(H(0, { size: 0.85, outfit: outfit('leather', '#2f8a6a', '#3a3a4a', '#9be8c8'), hood: false, hat: { style: 'bandana', color: '#2f8a6a' }, held: { style: 'daggers', color: '#d8dee8' } }), 18, 11, { dir: 0 }),
    ent(H(1, Object.assign(clone(CLOAKED), {})), 18, 15, { type: 'player', dir: 0, anim: 'walk' }),
    ent(H(0, { outfit: outfit('apron', '#7fb0ff', '#ffffff', '#ff6b8a'), hair: { style: 'ponytail', color: '#c8503c' } }), 6.5, 17, { dir: 2 }),
    ent(H(1, { outfit: outfit('robe', '#3a3a5a', '#f4ecd8', '#ffd24a'), hair: { style: 'long', color: '#c8c8d8' }, facial: 'beard', hat: { style: 'wizard', color: '#3a3a5a' }, held: { style: 'book', color: '#3d5aa8' } }), 29.5, 5.6, { dir: 2 }),
    ent(H(0, { outfit: outfit('uniform', '#3d5aa8', '#ffffff', '#c8503c') }), 28.5, 8.2, { dir: 0, anim: 'sit' }),
    ent(H(0, { outfit: outfit('tunic', '#4fb87a', '#f4e3c4', '#ffd24a') }), 4.6, 15.2, { dir: 2, anim: 'sleep' }),
  ];
  return { zone: z, ents, cam: { x: 18, y: 11, zoom: 1 } };
}

function road() {
  const z = zone('intro', 30, 20, 'grass', 'intro');
  rect(z, 0, 0, 3, 20, 'hedge'); rect(z, 27, 0, 3, 20, 'hedge'); rect(z, 3, 0, 4, 20, 'trees'); rect(z, 23, 0, 4, 20, 'trees');
  rect(z, 13, 0, 4, 20, 'path'); rect(z, 7, 10, 16, 2, 'water'); rect(z, 7, 9, 16, 1, 'shallows'); rect(z, 7, 12, 16, 1, 'shallows');
  rect(z, 8, 2, 3, 3, 'flowers'); rect(z, 19, 14, 3, 4, 'tallgrass');
  prop(z, 'bridge', 13, 10); z.props[z.props.length - 1].w = 4;
  prop(z, 'sign', 17, 15); prop(z, 'rock', 10, 15); prop(z, 'stump', 20, 4); prop(z, 'bush', 11, 6);
  const ents = [
    ent(Object.assign(H(0), clone(CLOAKED)), 15, 16, { type: 'player', dir: 0, anim: 'walk' }),
    ent({ rig: 'effect', model: 'stick', color: '#a0703c' }, 16.5, 14, { type: 'effect' }),
    ent({ rig: 'quadruped', size: 0.5, colors: { body: '#9a8a7a', belly: '#d8c8b8', accent: '#ff9aa8', eye: '#222222' }, features: ['tail_thin', 'ears_round'], hero: null }, 12, 6, { dir: 1, anim: 'walk' }),
    ent({ rig: 'quadruped', size: 0.5, colors: { body: '#9a8a7a', belly: '#d8c8b8', accent: '#ff9aa8', eye: '#222222' }, features: ['tail_thin', 'ears_round'], hero: null }, 17, 5, { dir: 3, anim: 'idle' }),
    ent({ rig: 'quadruped', size: 0.5, colors: { body: '#9a8a7a', belly: '#d8c8b8', accent: '#ff9aa8', eye: '#222222' }, features: ['tail_thin', 'ears_round'], hero: null }, 15, 3, { dir: 2, anim: 'walk' }),
    ent({ rig: 'quadruped', size: 0.85, colors: { body: '#8a7a6a', belly: '#d8c8b8', accent: '#ff9aa8', eye: '#ff3a3a' }, features: ['tail_thin', 'ears_round', 'spikes'], hero: null }, 14, 1.5, { dir: 0, anim: 'walk' }),
    ent(Object.assign(H(1), { hero: 'malgrim', outfit: outfit('robe', '#4a2e6a', '#2a1a3a', '#c9a6ff') }), 20, 17, { dir: 3, anim: 'cast' }),
    ent(H(0, { outfit: outfit('plate', '#5a4a6a', '#2a1a3a', '#c9a6ff'), hat: { style: 'horned', color: '#5a4a6a' }, held: { style: 'axes', color: '#a8b0bc' } }), 22, 18, { dir: 3 }),
    ent({ rig: 'effect', model: 'barrier', color: '#c9a6ff', r: 3 }, 16, 17, { type: 'effect' }),
  ];
  return { zone: z, ents, cam: { x: 15, y: 10, zoom: 1 } };
}

function occlusion() {
  const z = zone('occ', 30, 16, 'grass', 'default');
  rect(z, 3, 6, 6, 1, 'hedge'); rect(z, 12, 5, 6, 3, 'trees'); rect(z, 21, 6, 6, 1, 'brick'); rect(z, 3, 12, 6, 1, 'cliff');
  prop(z, 'house', 21, 10); prop(z, 'tree', 4, 9); prop(z, 'lamp', 7, 9); prop(z, 'tree', 14, 11);
  const ents = [];
  // behind (north of) each obstacle, and in front (south)
  for (const [x, y] of [[5, 5.7], [6.5, 7.6], [14, 4.6], [15.5, 8.4], [23, 5.7], [24.5, 7.6], [4.5, 9.4], [7.4, 9.5], [5, 11.6], [6.5, 13.4], [23, 10.4], [22.5, 13.6], [14.3, 11.6], [15, 12.6]]) {
    ents.push(ent(H(ents.length % 2, { outfit: outfit('tunic', ents.length % 3 ? '#4a90d9' : '#ff6b6b', '#f4e3c4', '#ffd24a') }), x, y, { dir: 2 }));
  }
  return { zone: z, ents, cam: { x: 15, y: 9, zoom: 1.3 } };
}

function stress() {
  const s = town(false);
  const looks = [];
  for (let i = 0; i < 20; i++) looks.push(H(i, { outfit: outfit(['tunic', 'robe', 'plate', 'leather', 'gi', 'vest', 'dress', 'apron'][i % 8], ['#4a90d9', '#c8503c', '#4fb87a', '#7a5ad9', '#e8a040'][i % 5], '#f4e3c4', '#ffd24a'), hat: i % 3 ? null : { style: ['wizard', 'cap', 'crown', 'helm', 'straw', 'feather', 'horned'][i % 7], color: '#c8503c' }, held: i % 2 ? { style: ['sword', 'staff', 'bow', 'axes', 'daggers', 'wand'][i % 6], color: '#d8dee8', glow: i % 4 === 1 ? '#9fe6ff' : null } : null }));
  const ents = [];
  for (let i = 0; i < 60; i++) {
    const a = i * 2.4, d = 1 + (i % 9) * 0.9;
    const anims = ['walk', 'idle', 'attack', 'cast', 'walk', 'walk'];
    ents.push(ent(looks[i % looks.length], 22 + Math.cos(a) * d * 1.6, 14.5 + Math.sin(a) * d * 0.8, { dir: i & 3, anim: anims[i % anims.length], tags: i % 10 === 0 ? ['burn'] : i % 10 === 5 ? ['stun'] : [] }));
  }
  s.ents = ents;
  s.stressFx = true;
  return s;
}

// fx grid: every fx type + slash style + a few combos, all fired at time 0, rendered at a chosen phase
function fxGrid() {
  const cells = [];
  for (const t of FX_TYPES) if (t !== 'text' && t !== 'screenFlash') cells.push({ type: t });
  for (const s of SLASH_STYLES) cells.push({ type: 'slash', style: s });
  cells.push({ type: 'bolt', chain: true }, { type: 'beam', long: true }, { type: 'burst', color: '#ff5a8a', n: 24 }, { type: 'ring', color: '#ffd24a', r: 2 });
  const cols = 8, sp = 4;
  const rows = Math.ceil(cells.length / cols);
  const z = zone('fx', cols * sp + 2, rows * sp + 2, 'grass', 'default');
  const ents = [];
  const fxs = [];
  cells.forEach((c, i) => {
    const x = 1 + (i % cols) * sp + sp / 2, y = 1 + Math.floor(i / cols) * sp + sp / 2 + 0.8;
    const f = makeFxEvent();
    const base = { type: c.type, x, y, color: c.color || null, r: c.r || 1.2, n: c.n || 14, angle: 0, arc: 120, style: c.style || null };
    const extra = {
      slash: { r: 1.1, angle: -0.3 }, beam: { x2: x + 1.6, y2: y - 1.2, w: 0.35, color: '#9fe6ff' }, bolt: c.chain ? { x2: x + 1.6, y2: y - 1, color: '#c9a6ff' } : { color: '#c9a6ff' },
      trail: { x2: x - 1.6, y2: y, color: '#9fe6ff' }, pillar: { r: 0.5, color: '#ffe680', dur: 1.2 }, meteor: { r: 1.3 }, smoke: { r: 1, dur: 2 },
      shockwave: { r: 1.6 }, afterimage: { color: '#9fe6ff' }, sparkle: { color: '#ffe680' }, poof: { color: '#ffffff' },
    }[c.type] || {};
    if (c.long) Object.assign(extra, { x2: x + 1.8, y2: y + 0.6, w: 0.6, color: '#ff8a3c' });
    assignFxEvent(f, Object.assign(base, extra));
    if (c.type === 'slash' || c.type === 'afterimage') {
      const v = ent(H(i), x - 0.2, y, { dir: 1, anim: c.type === 'slash' ? 'attack' : 'dash' });
      ents.push(v);
      if (c.type === 'afterimage') { f.ent = v.id; f.x = x - 0.9; }
    }
    fxs.push({ f, label: c.style || c.type });
  });
  return { zone: z, ents, fxs, cam: { x: z.w / 2, y: z.h / 2, zoom: 0.62 } };
}

// one fx, large: 'one:<type>:<style>@<phase>'
function oneFx(spec) {
  const [type, style] = spec.split(':');
  const z = zone('one', 12, 8, 'grass', 'default');
  const v = ent(H(0, { held: { style: 'sword', color: '#d8dee8' } }), 5.6, 4.6, { dir: 1, anim: 'attack' });
  const f = makeFxEvent();
  assignFxEvent(f, { type, style: style || null, x: 6, y: 4.6, angle: -0.2, arc: 120, r: 1.2, n: 16, x2: type === 'trail' ? 3.5 : type === 'beam' || type === 'bolt' ? 8.5 : null, y2: type === 'trail' ? 4.6 : type === 'beam' || type === 'bolt' ? 3.5 : null, w: 0.4, ent: v.id, color: null, dur: 0 });
  return { zone: z, ents: [v], fxs: [{ f }], cam: { x: 6, y: 4, zoom: 2.2 } };
}

const SCENES = { town: () => town(false), town_evening: () => town(true), forest, academy: academyScene, road, occlusion, stress, fx: fxGrid };

// ------------------------------------------------------------------ driver
const viewEl = document.getElementById('view');
const bar = document.getElementById('bar');
const r = create();
await r.init(viewEl, { quality: 2 });
r.resize(viewEl.clientWidth, viewEl.clientHeight);
const frame = makeFrameState();
let scene = null, t = 0, pinned = null, last = -1, fxPending = null, sceneName = '';

function fill(time) {
  frame.t = time; frame.alpha = 1;
  frame.camera.x = scene.cam.x; frame.camera.y = scene.cam.y; frame.camera.zoom = scene.cam.zoom; frame.camera.shake = 0;
  if (scene.ambience) Object.assign(frame.ambience, scene.ambience); else { frame.ambience.tintAmount = 0; frame.ambience.daypart = 'day'; }
  let n = 0;
  for (const v of scene.ents) {
    v.animT = time % 3;
    v.moving = v.anim === 'walk';
    frame.ents[n++] = v;
  }
  frame.entCount = n;
  frame.fxCount = 0;
  if (fxPending) { fxPending.forEach((x, i) => { frame.fx[i] = x.f; }); frame.fxCount = fxPending.length; fxPending = null; }
  return frame;
}

function show(name) {
  const [base, phase] = name.split('@');
  sceneName = name;
  nid = 1;
  scene = base.startsWith('one:') ? oneFx(base.slice(4)) : SCENES[base]();
  r.unloadZone();
  r.loadZone(scene.zone);
  bar.textContent = 'r2d harness: ' + name;
  if (scene.fxs) {
    // fire at t = 10, then advance in 1/60 steps to the phase
    const p = Number(phase || 0.12);
    t = 10; fxPending = scene.fxs;
    r.render(fill(t));
    const steps = Math.round(p * 60);
    for (let i = 0; i < steps; i++) { t += 1 / 60; r.render(fill(t)); }
    pinned = t;
  } else pinned = null;
  if (scene.stressFx) {
    // a burst of fx to load the particle system
    const kinds = ['hit', 'burst', 'slash', 'sparkle', 'poof', 'heal'];
    fxPending = [];
    for (let i = 0; i < 24; i++) {
      const f = makeFxEvent();
      assignFxEvent(f, { type: kinds[i % kinds.length], x: 16 + (i % 6) * 2, y: 12 + Math.floor(i / 6) * 1.5, n: 16, r: 1, style: 'sword', angle: i });
      fxPending.push({ f });
    }
  }
}

function tick(now) {
  requestAnimationFrame(tick);
  const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000);
  last = now;
  if (pinned !== null) t = pinned; else t += dt;
  if (scene) {
    for (const v of scene.ents) {
      if (v.anim !== 'walk' || pinned !== null) continue;
      v.px = v.x; v.py = v.y;
    }
    r.render(fill(t));
  }
}

const q = new URLSearchParams(location.search);
show(q.get('scene') || 'town');
requestAnimationFrame(tick);
window.__harness = {
  ready: true, renderer: r, scenes: ['town', 'town_evening', 'forest', 'academy', 'road', 'occlusion', 'stress', 'fx@0.08', 'fx@0.2', 'fx@0.5'],
  show(n) { show(n); r.render(fill(t)); },
  setTime(x) { pinned = x; t = x; r.render(fill(t)); },
  setCamera(x, y, zoom) { if (x != null) scene.cam.x = x; if (y != null) scene.cam.y = y; if (zoom != null) scene.cam.zoom = zoom; r.render(fill(t)); },
  stats() { const s = r.stats(); return { draws: s.draws, ms: s.ms, unknown: s.unknown, ents: frame.entCount, fills: s.fills, particles: s.particles, scene: sceneName }; },
};
