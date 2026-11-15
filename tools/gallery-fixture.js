// Renderer gallery fixture: pure data (no DOM) built with the contracts.js factories.
// buildPage(n) -> {id, title, zone: ZoneView, items: [{label, x, y, view?, cycleAnims?, fx?, fxPeriod?, fxOffset?}]}
// Owned by the skeleton; renderer engineers may extend it (note it in your notes file).
import {
  ANIMS, DIR, FX_TYPES, FX_TAGS, SLASH_STYLES, OUTFIT_STYLES, HAIR_STYLES, HAT_STYLES, HELD_STYLES, FACIAL_STYLES,
  AURA_STYLES, CREATURE_FEATURES, CREATURE_RIGS, PROJECTILE_MODELS, EFFECT_MODELS, makeEntityView, makeFxEvent, assignFxEvent,
} from '../src/contracts.js';
import tileList from '../src/data/tiles.js';
import props from '../src/data/props.js';
import { PALETTES } from '../src/data/palettes.js';
import { PLAYER_LOOKS, LAPORTE_LOOK, CLOAKED } from '../src/data/looks.js';

export const PAGE_TITLES = ['Humanoids', 'Creatures', 'Projectiles & effects', 'FX & fxTags', 'Tiles & props'];
export const PAGE_COUNT = PAGE_TITLES.length;

const clone = (o) => JSON.parse(JSON.stringify(o));
const tileIndex = Object.fromEntries(tileList.map((t, i) => [t.id, i]));
const DIR_NAMES = ['up', 'right', 'down', 'left'];
const ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

let nextId = 1;
function view(fields) {
  const v = makeEntityView();
  Object.assign(v, fields);
  v.id = nextId++;
  v.px = v.x; v.py = v.y;
  v.angle = fields.angle !== undefined ? fields.angle : ANGLE[v.dir];
  return v;
}

function flatZone(id, w, h, fill = 'grass') {
  const n = w * h;
  const tiles = new Uint8Array(n).fill(tileIndex[fill]);
  const variant = new Uint8Array(n);
  for (let i = 0; i < n; i++) variant[i] = (Math.imul(i + 1, 2654435761) >>> 24) & 255;
  return { id, w, h, tiles, variant, tileDefs: tileList, props: [], palette: PALETTES.default };
}

/** Lay `entries` out in a grid; returns the zone and positions items at cell centers. */
function grid(id, entries, cols, spacing) {
  const rows = Math.ceil(entries.length / cols);
  const zone = flatZone(id, cols * spacing + 2, rows * spacing + 2);
  const items = entries.map((en, i) => {
    const x = 1 + (i % cols) * spacing + spacing / 2;
    const y = 1 + Math.floor(i / cols) * spacing + spacing / 2;
    const it = { label: en.label, x, y, cycleAnims: !!en.cycleAnims, fx: en.fx || null, fxPeriod: en.fxPeriod || 2,
      fxOffset: en.fxOffset || 0 };
    if (en.look) {
      it.view = view({ kind: en.kind || 'gallery', type: en.type || 'npc', look: en.look, x, y, z: en.z || 0,
        dir: en.dir ?? DIR.DOWN, anim: en.anim || 'idle', fxTags: en.fxTags || [], radius: en.radius || 0.3,
        name: en.label, hpFrac: 1, glow: en.glow || null });
      if (en.angle !== undefined) it.view.angle = en.angle;
      it.zOsc = !!en.zOsc;
    }
    return it;
  });
  return { zone, items };
}

const H0 = () => clone(PLAYER_LOOKS[0]);
const H1 = () => clone(PLAYER_LOOKS[1]);

function page0() {
  const e = [];
  e.push({ label: 'build a', look: H0() }, { label: 'build b', look: H1() });
  OUTFIT_STYLES.forEach((s, i) => { const l = i % 2 ? H1() : H0(); l.outfit.style = s; e.push({ label: 'outfit ' + s, look: l }); });
  HAIR_STYLES.forEach((s, i) => { const l = i % 2 ? H1() : H0(); l.hair.style = s; e.push({ label: 'hair ' + s, look: l }); });
  HAT_STYLES.forEach((s, i) => { const l = i % 2 ? H1() : H0(); l.hat = { style: s, color: '#c8503c' }; e.push({ label: 'hat ' + s, look: l }); });
  HELD_STYLES.forEach((s, i) => {
    const l = i % 2 ? H1() : H0();
    l.held = { style: s, color: '#b0b8c8', glow: ['runeblade', 'orb', 'wand', 'staff', 'lantern'].includes(s) ? '#9fe6ff' : null };
    e.push({ label: 'held ' + s, look: l, dir: DIR.RIGHT });
  });
  FACIAL_STYLES.forEach((s) => { const l = H0(); l.facial = s; e.push({ label: 'facial ' + s, look: l }); });
  e.push({ label: 'hood (CLOAKED)', look: Object.assign(H0(), clone(CLOAKED)) });
  { const l = H1(); l.cape = { color: '#c8503c' }; e.push({ label: 'cape', look: l, dir: DIR.UP }); }
  AURA_STYLES.forEach((s) => { const l = H0(); l.aura = { style: s, color: { glow: '#ffe680', flame: '#ff8a3c', sparkle: '#ffd1f0', shadow: '#5a3a8a', frost: '#9fe6ff', storm: '#c9a6ff' }[s] }; e.push({ label: 'aura ' + s, look: l }); });
  { const l = H0(); l.size = 0.8; e.push({ label: 'size 0.8', look: l }); }
  { const l = H1(); l.size = 1.3; l.ears = 'pointed'; e.push({ label: 'size 1.3 pointed', look: l }); }
  e.push({ label: 'hero laporte', look: clone(LAPORTE_LOOK) });
  { const l = H0(); l.hero = 'malgrim'; l.outfit = { style: 'robe', primary: '#4a2e6a', secondary: '#2a1a3a', accent: '#c9a6ff' }; e.push({ label: 'hero malgrim', look: l }); }
  ANIMS.forEach((a) => e.push({ label: 'anim ' + a, look: H0(), anim: a, dir: DIR.RIGHT }));
  e.push({ label: 'anim cycle', look: H1(), cycleAnims: true });
  [0, 1, 2, 3].forEach((d) => e.push({ label: 'walk ' + DIR_NAMES[d], look: H1(), anim: 'walk', dir: d }));
  return grid('gallery_humanoids', e, 13, 2);
}

function page1() {
  const e = [];
  const colors = {
    quadruped: { body: '#9a8a7a', belly: '#d8c8b8', accent: '#ff9aa8', eye: '#222222' },
    blob: { body: '#6fdc8c', belly: '#b8f5c8', accent: '#ffe066', eye: '#1a1a2a' },
    flyer: { body: '#9a7ad9', belly: '#d8c8ff', accent: '#ffe066', eye: '#1a1a2a' },
    plant: { body: '#4fae4f', belly: '#c8e6a0', accent: '#ff6b8a', eye: '#1a1a2a' },
    golem: { body: '#a6a6b0', belly: '#d0d0d8', accent: '#7cc95a', eye: '#ffe066' },
  };
  for (const rig of CREATURE_RIGS) {
    e.push({ label: rig + ' plain', look: { rig, size: 1, colors: clone(colors[rig]), features: [], hero: null }, type: 'enemy' });
    for (const f of CREATURE_FEATURES[rig]) {
      e.push({ label: rig + ' ' + f, look: { rig, size: 1, colors: clone(colors[rig]), features: [f], hero: null }, type: 'enemy' });
    }
    for (const s of [0.5, 1.5]) {
      e.push({ label: rig + ' size ' + s, look: { rig, size: s, colors: clone(colors[rig]), features: CREATURE_FEATURES[rig].slice(0, 2), hero: null }, type: 'enemy', anim: 'walk' });
    }
  }
  e.push({ label: 'hero mossback', look: { rig: 'golem', size: 2.2, colors: { body: '#7a6a55', belly: '#a8957a', accent: '#5fb548', eye: '#ffe066' }, features: ['mossy', 'antlers'], hero: 'mossback' }, type: 'enemy' });
  return grid('gallery_creatures', e, 9, 3);
}

const EFFECT_SIZES = {
  barrier: { r: 1.2 }, telegraph_circle: { r: 1 }, telegraph_line: { len: 2.5, w: 0.6 }, telegraph_cone: { len: 1.8, arc: 90 },
  ground_fire: { r: 0.9 }, ground_frost: { r: 0.9 }, zone_ring: { r: 1 }, rune_seal: { r: 1 }, shield_bubble: { r: 0.7 },
  caltrops: { r: 0.8 }, smoke: { r: 1 }, portal: { r: 0.8 }, meteor: { r: 0.6 },
};
const EFFECT_COLORS = { ground_fire: '#ff8a3c', ground_frost: '#9fe6ff', telegraph_circle: '#ff5a5a', telegraph_line: '#ff5a5a',
  telegraph_cone: '#ff5a5a', barrier: '#9fe6ff', rune_seal: '#c9a6ff', shield_bubble: '#9fe6ff', portal: '#c9a6ff', gold: '#ffd24a',
  heart: '#ff5a7a', xp_orb: '#7cf07c', meteor: '#ff8a3c' };

function page2() {
  const e = [];
  for (const m of PROJECTILE_MODELS) {
    e.push({ label: 'proj ' + m, type: 'projectile', kind: 'projectile', angle: -0.5,
      look: { rig: 'projectile', model: m, color: '#ffe066', glow: '#ffffff', size: 1, trail: true }, z: 0.5 });
  }
  for (const m of EFFECT_MODELS) {
    const sz = EFFECT_SIZES[m] || { r: 0.5 };
    e.push({ label: 'effect ' + m, type: 'effect', kind: 'effect', zOsc: m === 'meteor',
      look: Object.assign({ rig: 'effect', model: m, color: EFFECT_COLORS[m] || '#ffe066', r: 0.5, w: 1, h: 1, len: 1, arc: 90 }, sz) });
  }
  return grid('gallery_models', e, 9, 3);
}

function fxFor(type, x, y) {
  const f = makeFxEvent();
  const base = { type, x, y, color: '#ffe066', r: 1, n: 12, dur: 0.8 };
  const extra = {
    slash: { angle: 0, arc: 120, r: 1, style: 'sword', color: '#ffffff' },
    beam: { x2: x + 1.2, y2: y - 0.8, w: 0.3, color: '#9fe6ff' },
    bolt: { color: '#c9a6ff' },
    trail: { x2: x - 1.2, y2: y, color: '#ffffff' },
    afterimage: { color: '#9fe6ff' },
    pillar: { r: 0.6, color: '#ffe680', dur: 1.2 },
    meteor: { r: 1.2, color: '#ff8a3c' },
    heal: { color: '#7cf07c' },
    poof: { color: '#ffffff' },
    smoke: { r: 1, dur: 1.5 },
    screenFlash: { color: '#ffffff', dur: 0.15 },
    text: { text: '12', style: 'dmg' },
    shockwave: { r: 1.4, color: '#e8cf94' },
    ring: { r: 1.2, color: '#9fe6ff' },
  }[type];
  return assignFxEvent(f, Object.assign(base, extra));
}

function page3() {
  const e = [];
  FX_TYPES.forEach((t, i) => e.push({ label: 'fx ' + t, fxType: t, fxOffset: (i % 6) * 0.3 }));
  SLASH_STYLES.forEach((s, i) => e.push({ label: 'slash ' + s, fxType: 'slash', slashStyle: s, fxOffset: (i % 4) * 0.25 }));
  FX_TAGS.forEach((tag, i) => e.push({ label: 'tag ' + tag, look: i % 2 ? H1() : H0(), fxTags: [tag] }));
  const g = grid('gallery_fx', e, 11, 3);
  g.items.forEach((it, i) => {
    const en = e[i];
    if (!en.fxType) return;
    it.fx = fxFor(en.fxType, it.x, it.y);
    if (en.slashStyle) it.fx.style = en.slashStyle;
    if (en.fxType === 'afterimage' || en.fxType === 'text') {
      // needs an entity: give the cell a humanoid and point the fx at it
      it.view = view({ kind: 'gallery', type: 'npc', look: H0(), x: it.x, y: it.y, name: it.label });
      it.fx.ent = it.view.id;
      it.fx.x = it.x + 0.4;
    }
  });
  return g;
}

function page4() {
  const W = 40;
  const items = [];
  // tile patches: 3x3 each, 4 tiles apart
  const cols = 9;
  const tileRows = Math.ceil(tileList.length / cols);
  const propStartY = 2 + tileRows * 5;
  // props: row-packed
  const placed = [];
  let cx = 1, cy = propStartY, rowH = 0;
  for (const id of Object.keys(props)) {
    const d = props[id];
    const fw = d.footprint ? d.footprint[0] : 1, fh = d.footprint ? d.footprint[1] : 1;
    if (cx + fw > W - 1) { cx = 1; cy += rowH + 2; rowH = 0; }
    placed.push({ id, def: d, x: cx, y: cy, w: fw, h: fh });
    cx += fw + 2; rowH = Math.max(rowH, fh);
  }
  const H = cy + rowH + 3;
  const zone = flatZone('gallery_world', W, H, 'stone');
  tileList.forEach((t, i) => {
    const x0 = 2 + (i % cols) * 4, y0 = 2 + Math.floor(i / cols) * 5;
    for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) zone.tiles[y * W + x] = i;
    items.push({ label: t.id + (t.shape !== 'flat' ? ' (' + t.shape + ')' : ''), x: x0 + 1.5, y: y0 + 3.6 });
  });
  for (const p of placed) {
    zone.props.push({ id: 'g_' + p.id, kind: p.id, def: p.def, look: clone(p.def.look), x: p.x, y: p.y, w: p.w, h: p.h });
    items.push({ label: p.id, x: p.x + p.w / 2, y: p.y + p.h + 0.6 });
  }
  return { zone, items };
}

const BUILDERS = [page0, page1, page2, page3, page4];

export function buildPage(n) {
  const i = Math.max(0, Math.min(PAGE_COUNT - 1, n | 0));
  nextId = 1;
  const p = BUILDERS[i]();
  return { id: i, title: PAGE_TITLES[i], zone: p.zone, items: p.items };
}
