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
