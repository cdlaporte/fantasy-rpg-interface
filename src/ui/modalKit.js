// Shared bits for keyboard-driven modals: a selectable list/grid, standard key groups, controls card, portraits.
import { el, add, keycap, setClass, pixelCanvas } from './dom.js';
import { stepIndex, firstIndex } from './format.js';
import { buildPortrait, portraitKey } from './portraits.js';
import { buildLaporteFace } from './laportePortrait.js';
import { blitGrid } from './pixelart.js';

export const K = {
  up: (c) => c === 'ArrowUp' || c === 'KeyW',
  down: (c) => c === 'ArrowDown' || c === 'KeyS',
  left: (c) => c === 'ArrowLeft' || c === 'KeyA',
  right: (c) => c === 'ArrowRight' || c === 'KeyD',
  ok: (c) => c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || c === 'KeyE',
  back: (c) => c === 'Escape' || c === 'Backspace',
  digit: (c) => (/^(Digit|Numpad)[1-9]$/.test(c) ? Number(c.slice(-1)) : 0),
};

/**
 * Keyboard + mouse selection over a list of elements.
 * @param {HTMLElement[]} items
 * @param {Object} o
 * @param {'vertical'|'horizontal'|'grid'} [o.layout]
 * @param {number} [o.columns]          grid columns
 * @param {(i:number)=>boolean} [o.disabled]
 * @param {(i:number)=>void} o.onPick
 * @param {(i:number)=>void} [o.onMove]
 * @param {boolean} [o.digits]          1-9 select and pick (default true)
 * @param {boolean} [o.digitsPick]      digits also pick (default true)
 * @param {(id:string)=>void} [o.sfx]
 * @param {number} [o.start]
 */
export function selectable(items, o) {
  const layout = o.layout || 'vertical';
  const cols = o.columns || (layout === 'horizontal' ? items.length : 1);
  const dis = (i) => !!(o.disabled && o.disabled(i));
  const sfx = o.sfx || (() => {});
  const api = {
    index: -1,
    items,
    set(i, quiet) {
      if (i < 0 || i >= items.length) return;
      if (api.index === i) return;
      if (api.index >= 0 && items[api.index]) setClass(items[api.index], 'sel', false);
      api.index = i;
      setClass(items[i], 'sel', true);
      if (!quiet) sfx('ui_move');
      if (o.onMove) o.onMove(i);
    },
    pick() {
      const i = api.index;
      if (i < 0) return false;
      if (dis(i)) { sfx('ui_bad'); shake(items[i]); return true; }
      sfx('ui_ok');
      o.onPick(i);
      return true;
    },
    key(e) {
      const c = e.code;
      const n = items.length;
      if (!n) return false;
      const move = (d) => { api.set(stepIndex(api.index < 0 ? 0 : api.index, d, n, layout === 'grid' ? null : dis)); return true; };
      if (layout !== 'horizontal' && K.up(c)) return move(-cols);
      if (layout !== 'horizontal' && K.down(c)) return move(cols);
      if (layout !== 'vertical' && K.left(c)) return move(-1);
      if (layout !== 'vertical' && K.right(c)) return move(1);
      if (K.ok(c)) { if (!e.repeat) api.pick(); return true; }
      const d = K.digit(c);
      if (d && o.digits !== false && d <= n) {
        if (e.repeat) return true;
        api.set(d - 1, true);
        if (o.digitsPick !== false) api.pick(); else sfx('ui_move');
        return true;
      }
      return false;
    },
  };
  items.forEach((it, i) => {
    it.addEventListener('mouseenter', () => { if (!dis(i)) api.set(i, true); });
    it.addEventListener('click', (ev) => { ev.preventDefault(); api.set(i, true); api.pick(); });
  });
  // initial selection: no sound, no onMove (callers may not be fully set up yet)
  const first = o.start !== undefined && o.start >= 0 && o.start < items.length ? o.start : firstIndex(items.length, dis);
  if (items.length) { api.index = first; setClass(items[first], 'sel', true); }
  return api;
}

export function shake(node) {
  if (!node) return;
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}

/** Footer of key hints: [[keys..., label], ...]. */
export function hints(list) {
  const f = el('div', 'hints');
  for (const h of list) {
    const item = el('span', 'hint');
    const keys = h.slice(0, -1);
    for (const k of keys) item.appendChild(k === '-' ? el('span', 'hint-dash', '\u2013') : keycap(k));
    item.appendChild(el('span', 'hint-label', h[h.length - 1]));
    f.appendChild(item);
  }
  return f;
}

export const CONTROLS = [
  [['W', 'A', 'S', 'D'], 'Move'],
  [['←', '↑', '↓', '→'], 'Attack (or IJKL)'],
  [['E'], 'Talk / use'],
  [['Space', 'Q', 'F', 'Shift'], 'Abilities'],
  [['1', '-', '6'], 'Items'],
  [['Tab'], 'Choose a boon'],
  [['M'], 'Map'],
  [['B'], 'Bag'],
  [['Esc'], 'Pause'],
];

/** The controls card (title screen and pause menu). */
export function controlsCard(title = 'CONTROLS') {
  const c = el('div', 'controls-card px-box');
  c.appendChild(el('div', 'card-title pxfont', title));
  const grid = el('div', 'controls-grid');
  for (const [keys, label] of CONTROLS) {
    const kk = el('div', 'ctl-keys');
    for (const k of keys) {
      if (k === '-') kk.appendChild(el('span', 'ctl-dash', '–'));
      else kk.appendChild(keycap(k));
    }
    add(grid, kk, el('div', 'ctl-label', label));
  }
  c.appendChild(grid);
  return c;
}

/**
 * A portrait canvas that redraws itself only when its key changes.
 * look: a look object, or 'laporte'. Returns {canvas, draw(t)}.
 */
export function livePortrait(look, mood, bg = 'academy', cls = 'portrait-lg') {
  const canvas = pixelCanvas(32, 32, cls);
  let key = '';
  const isLaporte = look === 'laporte' || (look && look.hero === 'laporte');
  const api = {
    canvas,
    look, mood,
    draw(t = 0) {
      const k = (isLaporte ? 'laporte' : '') + portraitKey(isLaporte ? null : api.look, api.mood, t, bg);
      if (k === key) return;
      key = k;
      const g = isLaporte ? buildLaporteFace({ mood: api.mood, t, bg }) : buildPortrait(api.look, { mood: api.mood, t, bg });
      blitGrid(canvas, g);
    },
  };
  api.draw(0);
  return api;
}

/** Card accent colors per class / spec id (CLASSES.md color identity), with a look-based fallback. */
export const CLASS_COLORS = {
  warrior: '#e2503c', mage: '#9b6bff', rogue: '#3fa34d',
  knight: '#f2c94c', berserker: '#d7263d', battlemage: '#ff7a2f',
  conjurer: '#3fe0c5', sorcerer: '#ff5a36', monk: '#ffd23f',
  archer: '#3fa34d', thief: '#2a9d8f', ninja: '#3d348b', novice: '#9a8a7a',
};

export function classColor(opt) {
  if (!opt) return '#9a8a7a';
  return CLASS_COLORS[opt.id] || (opt.color) || (opt.look && opt.look.outfit && opt.look.outfit.primary) || '#9a8a7a';
}
