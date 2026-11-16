// Key bindings (round 2). Owned by package A (controls/settings), which may extend it; the API below is fixed
// because the UI (key labels everywhere) and input.js both build on it.
//
// An ACTION is a name; each action has an ordered list of KeyboardEvent.code values. The first one is the
// primary key whose label is shown on screen. Stored per browser under STORAGE_KEY (outside the save prefix).

export const STORAGE_KEY = 'flinkerton.settings.keys';

export const ACTIONS = Object.freeze([
  'move_up', 'move_down', 'move_left', 'move_right',
  'attack_up', 'attack_down', 'attack_left', 'attack_right',
  'interact', 'space', 'q', 'f', 'shift',
  'item1', 'item2', 'item3', 'item4', 'item5', 'item6',
  'boon', 'map', 'pause', 'inventory',
]);

/** Ability slots keep their historical names (space, q, f, shift); only their keys change. */
export const DEFAULT_BINDINGS = Object.freeze({
  move_up: ['KeyW'], move_down: ['KeyS'], move_left: ['KeyA'], move_right: ['KeyD'],
  attack_up: ['KeyI', 'ArrowUp'], attack_down: ['KeyK', 'ArrowDown'],
  attack_left: ['KeyJ', 'ArrowLeft'], attack_right: ['KeyL', 'ArrowRight'],
  interact: ['KeyE'],
  space: ['Space'], q: ['KeyU', 'KeyQ'], f: ['KeyO', 'KeyF'], shift: ['KeyH', 'ShiftLeft', 'ShiftRight'],
  item1: ['Digit1'], item2: ['Digit2'], item3: ['Digit3'], item4: ['Digit4'], item5: ['Digit5'], item6: ['Digit6'],
  boon: ['Tab'], map: ['KeyM'], pause: ['Escape', 'KeyP'], inventory: ['KeyB'],
});

const SPECIAL = {
  Space: 'Space', Tab: 'Tab', Escape: 'Esc', Enter: 'Enter', Backspace: 'Bksp',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`',
};

/** 'KeyU' -> 'U', 'Digit1' -> '1', 'ArrowUp' -> '↑', 'ShiftLeft' -> 'Shift'. */
export function codeLabel(code) {
  if (!code) return '';
  if (SPECIAL[code]) return SPECIAL[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return 'Num' + code.slice(6);
  return code;
}

let current = clone(DEFAULT_BINDINGS);
const listeners = new Set();

function clone(b) { const o = {}; for (const a of ACTIONS) o[a] = (b[a] || DEFAULT_BINDINGS[a] || []).slice(); return o; }
function emit() { for (const fn of listeners) { try { fn(current); } catch { /* ignore */ } } }

/** The live bindings object {action: [codes]} (do not mutate; use setBindings). */
export function getBindings() { return current; }
/** Replace bindings (missing actions fall back to defaults), persist if a storage is given, notify listeners. */
export function setBindings(b, storage) {
  current = clone(b || DEFAULT_BINDINGS);
  if (storage) { try { storage.setJSON(STORAGE_KEY, current); } catch { /* ignore */ } }
  emit();
  return current;
}
export function resetBindings(storage) { return setBindings(DEFAULT_BINDINGS, storage); }
/** Load saved bindings from a platform storage (see platform/storage.js); call once at boot. */
export function loadBindings(storage) {
  let saved = null;
  try { saved = storage && storage.getJSON(STORAGE_KEY); } catch { saved = null; }
  return setBindings(saved && typeof saved === 'object' ? saved : DEFAULT_BINDINGS);
}
/** Primary key label for an action ('q' -> 'U'). */
export function keyLabel(action) { const c = current[action]; return codeLabel(c && c[0]); }
/** Every key label for an action (['U', 'Q']). */
export function keyLabels(action) { return (current[action] || []).map(codeLabel); }
/** Which action a KeyboardEvent.code triggers (first match in ACTIONS order), or null. */
export function actionFor(code) {
  for (const a of ACTIONS) if (current[a] && current[a].includes(code)) return a;
  return null;
}
/** Subscribe to binding changes; returns an unsubscribe function. */
export function onBindingsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// ---------------------------------------------------------------------------------------------------------------
// Package A additions (settings screen, tutorial prompts). DOM-free: usable from src/data and src/core.

/** Display names and groups for the settings screen and the controls card. */
export const ACTION_INFO = Object.freeze({
  move_up: { name: 'Move up', group: 'move' }, move_down: { name: 'Move down', group: 'move' },
  move_left: { name: 'Move left', group: 'move' }, move_right: { name: 'Move right', group: 'move' },
  attack_up: { name: 'Attack up', group: 'attack' }, attack_down: { name: 'Attack down', group: 'attack' },
  attack_left: { name: 'Attack left', group: 'attack' }, attack_right: { name: 'Attack right', group: 'attack' },
  interact: { name: 'Talk / use', group: 'other' },
  space: { name: 'Ability 1 (dash)', group: 'ability' }, q: { name: 'Ability 2', group: 'ability' },
  f: { name: 'Ability 3', group: 'ability' }, shift: { name: 'Ability 4', group: 'ability' },
  item1: { name: 'Item 1', group: 'item' }, item2: { name: 'Item 2', group: 'item' }, item3: { name: 'Item 3', group: 'item' },
  item4: { name: 'Item 4', group: 'item' }, item5: { name: 'Item 5', group: 'item' }, item6: { name: 'Item 6', group: 'item' },
  boon: { name: 'Choose a boon', group: 'other' }, map: { name: 'Map', group: 'menu' },
  pause: { name: 'Pause', group: 'menu' }, inventory: { name: 'Bag', group: 'menu' },
});

/** The menu keys are handled by the UI layer (ui/index.js) with fixed keys, so they cannot be rebound. */
export const FIXED_ACTIONS = Object.freeze(['map', 'pause', 'inventory']);
/** Codes that can never be given to another action (Escape also cancels a rebind). */
export const RESERVED_CODES = Object.freeze(['Escape', 'KeyP', 'KeyB', 'KeyM', 'MetaLeft', 'MetaRight', 'ContextMenu', 'CapsLock']);
/** Grouped action lists, in the order the settings screen shows them. */
export const MOVE_ACTIONS = Object.freeze(['move_up', 'move_left', 'move_down', 'move_right']);
export const ATTACK_ACTIONS = Object.freeze(['attack_up', 'attack_left', 'attack_down', 'attack_right']);

const PAIRS = { ShiftLeft: 'ShiftRight', ShiftRight: 'ShiftLeft', ControlLeft: 'ControlRight', ControlRight: 'ControlLeft',
  AltLeft: 'AltRight', AltRight: 'AltLeft' };
/** The other side of a left/right modifier pair ('ShiftLeft' -> 'ShiftRight'), or null. */
export function pairOf(code) { return PAIRS[code] || null; }

export function isFixed(action) { return FIXED_ACTIONS.includes(action); }
export function isReserved(code) { return RESERVED_CODES.includes(code); }

/** Distinct labels of an action's keys after the first (['↑'] for attack_up; ['Shift'] for shift). */
export function altLabels(action) {
  const out = [];
  const list = current[action] || [];
  const first = codeLabel(list[0]);
  for (let i = 1; i < list.length; i++) { const l = codeLabel(list[i]); if (l && l !== first && !out.includes(l)) out.push(l); }
  return out;
}

/** Every action (other than `except`) that a code is bound to. */
export function actionsUsing(code, except) {
  const out = [];
  for (const a of ACTIONS) if (a !== except && current[a] && current[a].includes(code)) out.push(a);
  return out;
}

/** Actions that currently have no key at all. */
export function unboundActions() { return ACTIONS.filter((a) => !(current[a] && current[a].length)); }

/**
 * Give `code` to `action`. slot 0 replaces the primary key (other keys kept); slot 1 replaces the extra keys.
 * The new binding wins: the code (and its left/right twin) is removed from every other action.
 * @returns {{ok: boolean, reason?: 'fixed'|'reserved'|'unknown', took: Array<{action: string, empty: boolean}>}}
 */
export function rebind(action, code, slot = 0, storage) {
  if (!ACTIONS.includes(action) || !code) return { ok: false, reason: 'unknown', took: [] };
  if (isFixed(action)) return { ok: false, reason: 'fixed', took: [] };
  if (isReserved(code)) return { ok: false, reason: 'reserved', took: [] };
  const codes = [code];
  const twin = pairOf(code);
  if (twin) codes.push(twin);
  const next = {};
  for (const a of ACTIONS) next[a] = (current[a] || []).slice();
  const took = [];
  for (const a of ACTIONS) {
    if (a === action) continue;
    const before = next[a].length;
    next[a] = next[a].filter((c) => !codes.includes(c));
    if (next[a].length !== before) took.push({ action: a, empty: next[a].length === 0 });
  }
  const old = next[action];
  let list;
  if (slot === 1 && old.length) list = [old[0]].filter((c) => !codes.includes(c)).concat(codes);
  else {
    const prim = old[0];
    list = codes.concat(old.filter((c) => c !== prim && !codes.includes(c) && c !== pairOf(prim)));
  }
  next[action] = list;
  setBindings(next, storage);
  return { ok: true, took };
}

/** Drop an action's extra keys (keep the primary). */
export function clearAlt(action, storage) {
  if (!ACTIONS.includes(action) || isFixed(action)) return false;
  const next = {};
  for (const a of ACTIONS) next[a] = (current[a] || []).slice();
  next[action] = next[action].slice(0, 1);
  setBindings(next, storage);
  return true;
}

// ---- tutorial prompts whose key names follow the bindings -------------------------------------------------------
// Cutscene data is static, but a tutorial step can carry live values: `tutorialStep(text, keys)` returns
// ['tutorial', text, keys] whose text (index 1) and key labels (index 2) are getters, read when the step runs, so
// the HudState keeps its shape {text, keys: [labels]} and the prompt names whatever keys are bound right now.
// Tokens in the text: [action] -> its key label ('[interact]' -> 'E'); [move] -> 'W A S D'; [attack] -> 'I J K L'.

const GROUP_TOKENS = { move: MOVE_ACTIONS, attack: ATTACK_ACTIONS };

/** Expand a key list spec: 'move' / 'attack' groups or action names -> action names. */
export function expandActions(spec) {
  const out = [];
  for (const s of [].concat(spec || [])) out.push(...(GROUP_TOKENS[s] || [s]));
  return out;
}

/** Replace [action] / [move] / [attack] tokens with the current key labels. */
export function keyText(template) {
  return String(template).replace(/\[([a-z0-9_]+)\]/g, (all, k) => {
    if (GROUP_TOKENS[k]) return GROUP_TOKENS[k].map(keyLabel).join(' ');
    return ACTIONS.includes(k) ? keyLabel(k) : all;
  });
}

/** An array whose items are the current labels of `actions` (getters: always up to date). */
export function liveKeyLabels(spec) {
  const actions = expandActions(spec);
  const arr = new Array(actions.length);
  actions.forEach((a, i) => Object.defineProperty(arr, i, { get: () => keyLabel(a), enumerable: true, configurable: true }));
  return arr;
}

/** A cutscene step ['tutorial', text, keys] with live key names (see above). */
export function tutorialStep(template, keys) {
  const step = ['tutorial'];
  const labels = liveKeyLabels(keys);
  Object.defineProperty(step, 1, { get: () => keyText(template), enumerable: true, configurable: true });
  Object.defineProperty(step, 2, { get: () => labels, enumerable: true, configurable: true });
  return step;
}
