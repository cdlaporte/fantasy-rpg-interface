// Keyboard -> InputState (CONTRACTS section 3). Owned by Sim; written fully by the skeleton.
// createInput(target, {isBlocked}) for the DOM; scriptedInput() for tests/bots (no DOM needed).
import { DT, DIR, INPUT_KEYS, makeInputState, clearInputState } from '../contracts.js';

const KEY_MAP = {
  KeyE: 'interact', Space: 'space', KeyQ: 'q', KeyF: 'f', ShiftLeft: 'shift', ShiftRight: 'shift',
  Digit1: 'item1', Digit2: 'item2', Digit3: 'item3', Digit4: 'item4', Digit5: 'item5', Digit6: 'item6',
  Escape: 'pause', KeyP: 'pause', KeyM: 'map', Tab: 'boon',
};
const MOVE_MAP = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
const ATTACK_MAP = {
  ArrowUp: DIR.UP, ArrowRight: DIR.RIGHT, ArrowDown: DIR.DOWN, ArrowLeft: DIR.LEFT,
  KeyI: DIR.UP, KeyL: DIR.RIGHT, KeyK: DIR.DOWN, KeyJ: DIR.LEFT,
};
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

/** Shared edge-tracking core. Presses/releases between samples are never lost. */
function createCore() {
  const state = makeInputState();
  const down = {}, pressE = {}, releaseE = {};
  for (const k of INPUT_KEYS) { down[k] = false; pressE[k] = 0; releaseE[k] = 0; }
  const atkDown = [false, false, false, false];
  const atkPressE = [0, 0, 0, 0];
  const atkReleaseE = [0, 0, 0, 0];
  const atkOrder = []; // held attack dirs, most recent last
  let heldT = 0;
  let curDir = -1;

  const core = {
    state,
    key(name, isDown) {
      if (!(name in down)) return;
      if (isDown && !down[name]) pressE[name]++;
      if (!isDown && down[name]) releaseE[name]++;
      down[name] = isDown;
    },
    pulse(name, kind) { if (name in down) (kind === 'released' ? releaseE : pressE)[name]++; },
    attack(dir, isDown) {
      if (dir < 0 || dir > 3) return;
      if (isDown && !atkDown[dir]) { atkPressE[dir]++; atkOrder.push(dir); }
      if (!isDown && atkDown[dir]) {
        atkReleaseE[dir]++;
        const i = atkOrder.indexOf(dir);
        if (i >= 0) atkOrder.splice(i, 1);
      }
      atkDown[dir] = isDown;
    },
    releaseAll() {
      for (const k of INPUT_KEYS) core.key(k, false);
      for (let d = 0; d < 4; d++) core.attack(d, false);
    },
    sample(moveX, moveY, dt = DT, blocked = false) {
      const s = state;
      if (blocked) {
        clearInputState(s);
        for (const k of INPUT_KEYS) { pressE[k] = 0; releaseE[k] = 0; }
        for (let d = 0; d < 4; d++) { atkPressE[d] = 0; atkReleaseE[d] = 0; }
        heldT = 0;
        curDir = atkOrder.length ? atkOrder[atkOrder.length - 1] : -1;
        return s;
      }
      const l = Math.sqrt(moveX * moveX + moveY * moveY);
      s.moveX = l > 1 ? moveX / l : moveX;
      s.moveY = l > 1 ? moveY / l : moveY;
      for (const k of INPUT_KEYS) {
        s.held[k] = down[k];
        s.pressed[k] = pressE[k] > 0;
        s.released[k] = releaseE[k] > 0;
        pressE[k] = 0; releaseE[k] = 0;
      }
      let pressed = -1, released = -1;
      for (let d = 0; d < 4; d++) {
        if (atkPressE[d] > 0) pressed = d;
        if (atkReleaseE[d] > 0 && released < 0) released = d;
        atkPressE[d] = 0; atkReleaseE[d] = 0;
      }
      const dir = atkOrder.length ? atkOrder[atkOrder.length - 1] : -1;
      if (dir !== curDir || pressed >= 0) heldT = 0; else if (dir >= 0) heldT += dt;
      // A tap shorter than one step: report it as held for this step so it is not lost.
      s.attackDir = dir >= 0 ? dir : pressed;
      s.attackPressed = pressed;
      s.attackReleased = released;
      s.attackHeldT = s.attackDir >= 0 ? heldT : 0;
      curDir = dir;
      return s;
    },
  };
  return core;
}

/**
 * DOM keyboard input. `target` is usually window.
 * @param {EventTarget} target
 * @param {{isBlocked?: () => boolean}} [opts] while isBlocked() is true (a modal is open) sample() is neutral
 */
export function createInput(target, opts = {}) {
  const core = createCore();
  const moveDown = {};
  const isBlocked = opts.isBlocked || (() => false);
  // integration (UI request): a key whose keydown arrives while a modal is open belongs to the modal, even if
  // the modal closes before this bubble-phase listener runs (the stub question card answers on `1` in a capture
  // listener and gates close the modal in a microtask, so `1` also used hotbar item 1). A capture listener,
  // registered before the UI's, remembers that and the press is ignored until that key goes up.
  const swallowed = Object.create(null);
  const onCapture = (e) => { if (!e.repeat) swallowed[e.code] = isBlocked(); };
  const onDown = (e) => {
    const c = e.code;
    if (PREVENT.has(c) && !isBlocked()) e.preventDefault();
    if (e.repeat || swallowed[c]) return;
    if (MOVE_MAP[c]) moveDown[c] = true;
    else if (ATTACK_MAP[c] !== undefined) core.attack(ATTACK_MAP[c], true);
    else if (KEY_MAP[c]) core.key(KEY_MAP[c], true);
  };
  const onUp = (e) => {
    const c = e.code;
    swallowed[c] = false;
    if (MOVE_MAP[c]) moveDown[c] = false;
    else if (ATTACK_MAP[c] !== undefined) core.attack(ATTACK_MAP[c], false);
    else if (KEY_MAP[c]) {
      // both Shift keys map to 'shift'; release only when neither is down is not tracked: release on any.
      core.key(KEY_MAP[c], false);
    }
  };
  const onBlur = () => { for (const k in moveDown) moveDown[k] = false; core.releaseAll(); };
  target.addEventListener('keydown', onCapture, true);
  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);
  return {
    state: core.state,
    sample(dt = DT) {
      let mx = 0, my = 0;
      for (const c in moveDown) if (moveDown[c]) { mx += MOVE_MAP[c][0]; my += MOVE_MAP[c][1]; }
      return core.sample(mx, my, dt, isBlocked());
    },
    reset: onBlur,
    dispose() {
      target.removeEventListener('keydown', onCapture, true);
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}

/**
 * Scripted input for tests and bots. Same InputState shape; edges are derived automatically.
 * set({moveX, moveY, attackDir, held: {q: true}, pressed: {interact: true}}):
 *  - moveX/moveY/attackDir/held are sticky until changed (attackDir -1 releases);
 *  - `pressed` / `released` entries are one-shot pulses for the next sample().
 */
export function scriptedInput(initial) {
  const core = createCore();
  let mx = 0, my = 0;
  const api = {
    state: core.state,
    set(p = {}) {
      if (p.moveX !== undefined) mx = p.moveX;
      if (p.moveY !== undefined) my = p.moveY;
      if (p.attackDir !== undefined) for (let d = 0; d < 4; d++) core.attack(d, d === p.attackDir);
      if (p.held) for (const k in p.held) core.key(k, !!p.held[k]);
      if (p.pressed) for (const k in p.pressed) if (p.pressed[k]) core.pulse(k, 'pressed');
      if (p.released) for (const k in p.released) if (p.released[k]) core.pulse(k, 'released');
      return api;
    },
    sample(dt = DT) { return core.sample(mx, my, dt, false); },
    reset() { mx = 0; my = 0; core.releaseAll(); core.sample(0, 0, 0, true); return api; },
  };
  if (initial) api.set(initial);
  return api;
}

export default createInput;
