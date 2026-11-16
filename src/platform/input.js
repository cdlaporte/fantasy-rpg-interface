// Keyboard -> InputState (CONTRACTS section 3, round 2). Owned by package A.
// createInput(target, {isBlocked}) for the DOM; scriptedInput() for tests/bots (no DOM needed).
//
// Keys come from platform/bindings.js (rebindable; the map is rebuilt on onBindingsChange). Attack keys combine:
// every held attack direction is summed into `attackAngle` (8 ways, radians, 0 = east, y down; opposite keys cancel,
// and when they cancel completely the most recently pressed key wins). `attackDir` is the DIR nearest to it (on a
// diagonal: the more recently pressed of its two keys). The attack is one gesture: `attackPressed` fires when the
// first attack key goes down (nothing was held), `attackReleased` when the last one goes up, and `attackHeldT`
// keeps counting while any attack key stays down, so I -> I+L -> L keeps a charge going.
import { DT, DIR, INPUT_KEYS, makeInputState, clearInputState } from '../contracts.js';
import { ACTIONS, getBindings, onBindingsChange } from './bindings.js';

const MOVE_VEC = { move_up: [0, -1], move_down: [0, 1], move_left: [-1, 0], move_right: [1, 0] };
const ATTACK_DIR = { attack_up: DIR.UP, attack_right: DIR.RIGHT, attack_down: DIR.DOWN, attack_left: DIR.LEFT };
const DIR_DX = [0, 1, 0, -1];
const DIR_DY = [-1, 0, 1, 0];
const DIR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const ALWAYS_PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

/** Shared edge-tracking core. Presses/releases between samples are never lost. */
function createCore() {
  const state = makeInputState();
  const down = {}, pressE = {}, releaseE = {};
  for (const k of INPUT_KEYS) { down[k] = false; pressE[k] = 0; releaseE[k] = 0; }
  const atkDown = [false, false, false, false];
  const atkOrder = [];          // held attack dirs, most recent last
  let gestPress = false;        // the first attack key went down since the last sample
  let gestRelease = -1;         // DIR the gesture had when the last attack key went up (since the last sample)
  let tapDir = -1, tapAngle = NaN;  // a press+release inside one step: still reported once
  let heldT = 0;
  let angleOverride = NaN;      // scripted input: an exact aim angle while keys are held

  // combined direction of the held keys -> out.dir / out.angle (no allocation)
  const out = { dir: -1, angle: NaN };
  function combine() {
    const n = atkOrder.length;
    if (!n) { out.dir = -1; out.angle = NaN; return out; }
    let dx = 0, dy = 0;
    for (let d = 0; d < 4; d++) if (atkDown[d]) { dx += DIR_DX[d]; dy += DIR_DY[d]; }
    if (dx === 0 && dy === 0) { const last = atkOrder[n - 1]; out.dir = last; out.angle = DIR_ANGLE[last]; return out; }
    out.angle = Math.atan2(dy, dx);
    if (dx === 0) out.dir = dy < 0 ? DIR.UP : DIR.DOWN;
    else if (dy === 0) out.dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    else {
      out.dir = dy < 0 ? DIR.UP : DIR.DOWN;
      for (let i = n - 1; i >= 0; i--) {
        const d = atkOrder[i];
        if ((d === DIR.UP && dy < 0) || (d === DIR.DOWN && dy > 0) || (d === DIR.RIGHT && dx > 0) || (d === DIR.LEFT && dx < 0)) { out.dir = d; break; }
      }
    }
    return out;
  }

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
      if (isDown && !atkDown[dir]) {
        if (atkOrder.length === 0) gestPress = true;
        atkDown[dir] = true;
        atkOrder.push(dir);
      } else if (!isDown && atkDown[dir]) {
        const before = combine();
        const bDir = before.dir, bAngle = before.angle;
        atkDown[dir] = false;
        const i = atkOrder.indexOf(dir);
        if (i >= 0) atkOrder.splice(i, 1);
        if (atkOrder.length === 0) {
          gestRelease = bDir;
          if (gestPress) { tapDir = bDir; tapAngle = bAngle; }
          angleOverride = NaN;
        }
      }
    },
    setAngleOverride(a) { angleOverride = a; },
    heldDirs(outArr) { outArr.length = 0; for (let d = 0; d < 4; d++) if (atkDown[d]) outArr.push(d); return outArr; },
    releaseAll() {
      for (const k of INPUT_KEYS) core.key(k, false);
      for (let d = 0; d < 4; d++) core.attack(d, false);
    },
    sample(moveX, moveY, dt = DT, blocked = false) {
      const s = state;
      if (blocked) {
        clearInputState(s);
        for (const k of INPUT_KEYS) { pressE[k] = 0; releaseE[k] = 0; }
        gestPress = false; gestRelease = -1; tapDir = -1; tapAngle = NaN;
        heldT = 0;
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
      const c = combine();
      let dir = c.dir, angle = c.angle;
      if (dir >= 0 && angleOverride === angleOverride) angle = angleOverride;
      // A tap shorter than one step: report it as held for this step so it is not lost.
      if (dir < 0 && tapDir >= 0) { dir = tapDir; angle = tapAngle; }
      if (gestPress) heldT = 0; else if (dir >= 0) heldT += dt;
      s.attackDir = dir;
      s.attackAngle = dir >= 0 ? angle : NaN;
      s.attackPressed = gestPress ? dir : -1;
      s.attackReleased = gestRelease;
      s.attackHeldT = dir >= 0 ? heldT : 0;
      if (dir < 0) heldT = 0;
      gestPress = false; gestRelease = -1; tapDir = -1; tapAngle = NaN;
      return s;
    },
  };
  return core;
}

/** code -> {kind: 'move'|'attack'|'key', ref} for the current bindings (first action wins, ACTIONS order). */
function buildCodeMap(bindings) {
  const map = new Map();
  for (const a of ACTIONS) {
    const codes = bindings[a] || [];
    let entry = null;
    if (MOVE_VEC[a]) entry = { kind: 'move', ref: a };
    else if (ATTACK_DIR[a] !== undefined) entry = { kind: 'attack', ref: a };
    else if (INPUT_KEYS.includes(a)) entry = { kind: 'key', ref: a };
    if (!entry) continue;   // e.g. 'inventory': handled by the UI layer
    for (const c of codes) if (!map.has(c)) map.set(c, entry);
  }
  return map;
}

/**
 * DOM keyboard input. `target` is usually window.
 * @param {EventTarget} target
 * @param {{isBlocked?: () => boolean}} [opts] while isBlocked() is true (a modal is open) sample() is neutral
 */
export function createInput(target, opts = {}) {
  const core = createCore();
  const isBlocked = opts.isBlocked || (() => false);
  let codeMap = buildCodeMap(getBindings());
  const codeDown = Object.create(null);           // physical keys currently down (bound ones)
  const actionCount = Object.create(null);        // action -> number of its keys down
  for (const a of ACTIONS) actionCount[a] = 0;

  function apply(entry, isDown) {
    const a = entry.ref;
    actionCount[a] = Math.max(0, actionCount[a] + (isDown ? 1 : -1));
    const on = actionCount[a] > 0;
    if (entry.kind === 'attack') core.attack(ATTACK_DIR[a], on);
    else if (entry.kind === 'key') core.key(a, on);
  }

  // integration (UI request): a key whose keydown arrives while a modal is open belongs to the modal, even if
  // the modal closes before this bubble-phase listener runs (the stub question card answers on `1` in a capture
  // listener and gates close the modal in a microtask, so `1` also used hotbar item 1). A capture listener,
  // registered before the UI's, remembers that and the press is ignored until that key goes up.
  const swallowed = Object.create(null);
  const onCapture = (e) => { if (!e.repeat) swallowed[e.code] = isBlocked(); };
  const onDown = (e) => {
    const c = e.code;
    const entry = codeMap.get(c);
    if (!isBlocked() && (ALWAYS_PREVENT.has(c) || (entry && !e.ctrlKey && !e.metaKey && !e.altKey))) e.preventDefault();
    if (e.repeat || swallowed[c] || !entry || codeDown[c]) return;
    if (e.ctrlKey || e.metaKey) return;
    codeDown[c] = entry;
    apply(entry, true);
  };
  const onUp = (e) => {
    const c = e.code;
    swallowed[c] = false;
    const entry = codeDown[c];
    if (!entry) return;
    codeDown[c] = null;
    apply(entry, false);
  };
  const releaseAll = () => {
    for (const c in codeDown) codeDown[c] = null;
    for (const a of ACTIONS) actionCount[a] = 0;
    core.releaseAll();
  };
  const offBindings = onBindingsChange((b) => { releaseAll(); codeMap = buildCodeMap(b); });
  target.addEventListener('keydown', onCapture, true);
  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', releaseAll);
  return {
    state: core.state,
    sample(dt = DT) {
      let mx = 0, my = 0;
      for (const a in MOVE_VEC) if (actionCount[a] > 0) { mx += MOVE_VEC[a][0]; my += MOVE_VEC[a][1]; }
      return core.sample(mx, my, dt, isBlocked());
    },
    reset: releaseAll,
    dispose() {
      offBindings();
      target.removeEventListener('keydown', onCapture, true);
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', releaseAll);
    },
  };
}

/** Attack dirs whose keys make up an aim angle (8 ways): [] for NaN. */
export function dirsForAngle(angle, outArr = []) {
  outArr.length = 0;
  if (!(angle === angle) || angle === null) return outArr;
  const cx = Math.cos(angle), cy = Math.sin(angle);
  const T = 0.3827; // sin(22.5 deg): beyond it the axis key is part of the combination
  if (cy < -T) outArr.push(DIR.UP);
  if (cx > T) outArr.push(DIR.RIGHT);
  if (cy > T) outArr.push(DIR.DOWN);
  if (cx < -T) outArr.push(DIR.LEFT);
  return outArr;
}

/**
 * Scripted input for tests and bots. Same InputState shape; edges are derived automatically.
 * set({moveX, moveY, attackDir, attackAngle, held: {q: true}, pressed: {interact: true}}):
 *  - moveX/moveY/attackDir/attackAngle/held are sticky until changed (attackDir -1 or attackAngle NaN releases);
 *  - attackAngle holds the 1-2 attack keys that make that angle (keys already held stay down, so the held time
 *    continues), and the sampled attackAngle is the exact angle given;
 *  - `pressed` / `released` entries are one-shot pulses for the next sample().
 */
export function scriptedInput(initial) {
  const core = createCore();
  let mx = 0, my = 0;
  const want = [], have = [];
  function holdDirs(dirs) {
    core.heldDirs(have);
    for (const d of have) if (!dirs.includes(d)) core.attack(d, false);
    for (const d of dirs) core.attack(d, true);
  }
  const api = {
    state: core.state,
    set(p = {}) {
      if (p.moveX !== undefined) mx = p.moveX;
      if (p.moveY !== undefined) my = p.moveY;
      if (p.attackDir !== undefined) {
        want.length = 0;
        if (p.attackDir >= 0 && p.attackDir <= 3) want.push(p.attackDir);
        holdDirs(want);
        core.setAngleOverride(NaN);
      }
      if (p.attackAngle !== undefined) {
        const a = p.attackAngle === null ? NaN : Number(p.attackAngle);
        holdDirs(dirsForAngle(a, want));
        core.setAngleOverride(want.length ? a : NaN);
      }
      if (p.held) for (const k in p.held) core.key(k, !!p.held[k]);
      if (p.pressed) for (const k in p.pressed) if (p.pressed[k]) core.pulse(k, 'pressed');
      if (p.released) for (const k in p.released) if (p.released[k]) core.pulse(k, 'released');
      return api;
    },
    /** Low level: hold / release one attack direction (key-like, for combination tests). */
    attack(dir, isDown) { core.attack(dir, !!isDown); return api; },
    sample(dt = DT) { return core.sample(mx, my, dt, false); },
    reset() { mx = 0; my = 0; core.releaseAll(); core.sample(0, 0, 0, true); return api; },
  };
  if (initial) api.set(initial);
  return api;
}

export default createInput;
