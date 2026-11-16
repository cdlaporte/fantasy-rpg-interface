// Settings screen (round 2, package A): rebind every action, reset to defaults, sound on/off, graphics quality.
// Used by the title screen (Options -> Settings, no game yet) and the pause menu (Settings). The caller forwards
// keydown events to key(e); mouse works everywhere. While waiting for a key ("Press a key..."), the next key is
// the new binding (Esc cancels). The new binding wins: the key is taken away from any other action, and an action
// left with no key is shown in red.
//
// createSettings({storage, sfx, quality(), setQuality(q), muted(), setMuted(b), onClose()}) -> {el, key(e), destroy()}
import { el, add, setText, setClass, keycap } from './dom.js';
import { hints } from './modalKit.js';
import {
  ACTION_INFO, DEFAULT_BINDINGS, getBindings, keyLabel, altLabels, codeLabel, rebind, clearAlt, resetBindings,
  onBindingsChange, isReserved, isFixed, unboundActions,
} from '../platform/bindings.js';

export const QUALITY_NAMES = ['Low', 'Medium', 'High'];
export const QUALITY_KEY = 'flinkerton.settings.quality';
export const MUTE_KEY = 'flinkerton.audio.muted';

const LEFT = ['move_up', 'move_left', 'move_down', 'move_right', 'attack_up', 'attack_left', 'attack_down', 'attack_right', 'interact', 'boon'];
const RIGHT = ['space', 'q', 'f', 'shift', 'item1', 'item2', 'item3', 'item4', 'item5', 'item6'];
const COLS = 4; // left key, left extra, right key, right extra

/** Saved graphics quality (0..2) or null. */
export function savedQuality(storage) {
  const v = storage && storage.get ? storage.get(QUALITY_KEY) : null;
  return v === '0' || v === '1' || v === '2' ? Number(v) : null;
}

export function createSettings(opts = {}) {
  const storage = opts.storage || null;
  const sfx = opts.sfx || (() => {});
  const getQ = opts.quality || (() => 1);
  const setQ = opts.setQuality || (() => {});
  const isMuted = opts.muted || (() => false);
  const setMuted = opts.setMuted || (() => {});

  const root = el('div', 'settings px-box');
  root.setAttribute('role', 'dialog');
  const head = el('div', 'set-head');
  add(head, el('div', 'set-title pxfont', 'SETTINGS'), el('div', 'set-sub', 'Pick a row, then press the new key. Esc cancels.'));
  const grid = el('div', 'set-grid');
  const msg = el('div', 'set-msg');
  const fixed = el('div', 'set-fixed');
  const foot = el('div', 'set-foot');

  // ---- cells: rows x 4 binding cells, then the button row
  const rows = [];   // rows[r][c] = cell
  const cellOf = new Map();
  function mkCol(list, c0) {
    const col = el('div', 'set-col');
    add(col, el('div', 'set-colhead'), el('div', 'set-colhead pxfont', 'KEY'), el('div', 'set-colhead pxfont', 'ALSO'));
    list.forEach((action, r) => {
      const name = el('div', 'set-name', ACTION_INFO[action].name);
      const k0 = el('button', 'set-key');
      const k1 = el('button', 'set-key set-alt');
      k0.type = 'button'; k1.type = 'button';
      add(col, name, k0, k1);
      rows[r] = rows[r] || [];
      const c0cell = { kind: 'bind', action, slot: 0, el: k0, nameEl: name, r, c: c0 };
      const c1cell = { kind: 'bind', action, slot: 1, el: k1, nameEl: name, r, c: c0 + 1 };
      rows[r][c0] = c0cell; rows[r][c0 + 1] = c1cell;
      for (const cell of [c0cell, c1cell]) {
        cellOf.set(cell.el, cell);
        cell.el.addEventListener('mouseenter', () => { if (!capturing) select(cell, true); });
        cell.el.addEventListener('click', (e) => { e.preventDefault(); select(cell, true); activate(); });
      }
    });
    return col;
  }
  add(grid, mkCol(LEFT, 0), mkCol(RIGHT, 2));

  const buttons = [
    { id: 'reset', label: () => 'Reset to defaults' },
    { id: 'sound', label: () => `Sound: ${isMuted() ? 'Off' : 'On'}` },
    { id: 'quality', label: () => `Graphics: ${QUALITY_NAMES[getQ()] || 'Medium'}` },
    { id: 'back', label: () => 'Back' },
  ];
  const btnRow = [];
  buttons.forEach((b, i) => {
    const node = el('button', 'set-btn pxfont');
    node.type = 'button';
    b.el = node;
    const cell = { kind: 'button', id: b.id, el: node, r: LEFT.length, c: i, def: b };
    btnRow.push(cell);
    cellOf.set(node, cell);
    node.addEventListener('mouseenter', () => { if (!capturing) select(cell, true); });
    node.addEventListener('click', (e) => { e.preventDefault(); select(cell, true); activate(); });
    foot.appendChild(node);
  });
  rows.push(btnRow);

  const help = hints([['↑', '↓', '←', '→', 'Choose'], ['Enter', 'Change key'], ['Bksp', 'Clear extra key'], ['Esc', 'Back']]);
  add(root, head, grid, fixed, msg, foot, help);

  let cur = rows[0][0];
  let capturing = null;   // the cell waiting for a key
  setClass(cur.el, 'sel', true);

  function select(cell, quiet) {
    if (!cell || cell === cur) return;
    setClass(cur.el, 'sel', false);
    cur = cell;
    setClass(cur.el, 'sel', true);
    if (!quiet) sfx('ui_move');
  }

  function flash(text, kind) {
    setText(msg, text);
    msg.className = 'set-msg' + (kind ? ' ' + kind : '');
    msg.classList.remove('pop'); void msg.offsetWidth; msg.classList.add('pop');
  }

  function render() {
    const b = getBindings();
    const empty = new Set(unboundActions());
    for (const row of rows) {
      for (const cell of row) {
        if (!cell) continue;
        if (cell.kind === 'button') { setText(cell.el, cell.def.label()); continue; }
        const a = cell.action;
        cell.el.textContent = '';
        if (capturing === cell) { cell.el.appendChild(el('span', 'set-wait', 'Press a key…')); continue; }
        if (cell.slot === 0) {
          const lab = keyLabel(a);
          cell.el.appendChild(lab ? keycap(lab, 'big') : el('span', 'set-none', 'none'));
        } else {
          const alts = altLabels(a);
          if (alts.length) for (const l of alts) cell.el.appendChild(keycap(l, 'big'));
          else cell.el.appendChild(el('span', 'set-plus', '+'));
        }
        setClass(cell.nameEl, 'unbound', empty.has(a));
        setClass(cell.el, 'changed', cell.slot === 0 && (b[a] || [])[0] !== DEFAULT_BINDINGS[a][0]);
      }
    }
    setText(fixed, `Menu keys (fixed): ${keyLabel('pause')} or P pause · ${keyLabel('inventory')} bag · ${keyLabel('map')} map · ${keyLabel('quests')} quest log`);
    setClass(root, 'capturing', !!capturing);
  }

  function activate() {
    const c = cur;
    if (c.kind === 'bind') {
      capturing = c;
      sfx('ui_ok');
      flash(`Press the new key for ${ACTION_INFO[c.action].name}${c.slot ? ' (extra key)' : ''}. Esc cancels.`, 'info');
      render();
      return;
    }
    switch (c.id) {
      case 'reset':
        resetBindings(storage);
        sfx('ui_ok');
        flash('All keys are back to the defaults.', 'good');
        break;
      case 'sound':
        setMuted(!isMuted());
        sfx('ui_ok');
        break;
      case 'quality': {
        const q = (getQ() + 1) % 3;
        setQ(q);
        try { if (storage && storage.set) storage.set(QUALITY_KEY, String(q)); } catch { /* ignore */ }
        sfx('ui_ok');
        break;
      }
      case 'back':
        sfx('ui_move');
        if (opts.onClose) opts.onClose();
        return;
      default: break;
    }
    render();
  }

  function capture(e) {
    const code = e.code;
    const cell = capturing;
    if (!code || /^(Meta|OS)/.test(code)) return;
    if (code === 'Escape') { capturing = null; flash('Cancelled.', ''); sfx('ui_move'); render(); return; }
    if (isReserved(code)) { sfx('ui_bad'); flash(`${codeLabel(code)} is kept for the menus. Pick another key.`, 'bad'); return; }
    capturing = null;
    const before = getBindings()[cell.action][0];
    const r = rebind(cell.action, code, cell.slot, storage);
    if (!r.ok) { sfx('ui_bad'); flash('That key cannot be used here.', 'bad'); render(); return; }
    const name = ACTION_INFO[cell.action].name;
    const took = r.took.map((t) => ACTION_INFO[t.action].name);
    const emptied = r.took.filter((t) => t.empty).map((t) => ACTION_INFO[t.action].name);
    let text = `${name}: ${codeLabel(code)}${cell.slot ? ' (extra)' : before && before !== code ? ` (was ${codeLabel(before)})` : ''}.`;
    if (took.length) text += ` Taken from ${took.join(', ')}.`;
    if (emptied.length) text += ` ${emptied.join(', ')} now ${emptied.length > 1 ? 'have' : 'has'} no key!`;
    flash(text, emptied.length ? 'bad' : 'good');
    sfx(emptied.length ? 'ui_bad' : 'ui_ok');
    render();
  }

  function move(dr, dc) {
    let r = cur.r, c = cur.c;
    if (dr) {
      r = Math.max(0, Math.min(rows.length - 1, r + dr));
      if (r === rows.length - 1 && cur.kind === 'bind') c = Math.min(btnRow.length - 1, Math.floor((c / COLS) * btnRow.length));
      else if (cur.kind === 'button' && r < rows.length - 1) c = Math.min(COLS - 1, Math.floor((c / btnRow.length) * COLS));
    }
    if (dc) {
      const n = rows[r].length;
      c = (c + dc + n) % n;
    }
    select(rows[r][c]);
  }

  const offB = onBindingsChange(() => render());
  render();

  return {
    el: root,
    /** Keydown from the host. Returns true when handled. */
    key(e) {
      if (capturing) { if (!e.repeat) capture(e); return true; }
      const c = e.code;
      if (e.repeat && (c === 'Enter' || c === 'Space')) return true;
      if (c === 'Escape') { sfx('ui_move'); if (opts.onClose) opts.onClose(); return true; }
      if (c === 'ArrowUp' || c === 'KeyW') { move(-1, 0); return true; }
      if (c === 'ArrowDown' || c === 'KeyS') { move(1, 0); return true; }
      if (c === 'ArrowLeft' || c === 'KeyA') { move(0, -1); return true; }
      if (c === 'ArrowRight' || c === 'KeyD') { move(0, 1); return true; }
      if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') { activate(); return true; }
      if ((c === 'Backspace' || c === 'Delete') && cur.kind === 'bind' && cur.slot === 1) {
        if (altLabels(cur.action).length) { clearAlt(cur.action, storage); flash(`${ACTION_INFO[cur.action].name}: extra key removed.`, ''); sfx('ui_move'); }
        return true;
      }
      return c === 'Tab' || c === 'Backspace';
    },
    /** True while waiting for a key (the host should not treat Esc as "close"). */
    capturing: () => !!capturing,
    isFixed,
    destroy() { offB(); root.remove(); },
  };
}

export default createSettings;
