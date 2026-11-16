// Round 2, package A: InputState from key combinations (8-way attackAngle, cancel, gesture edges, held-time
// continuity), rebinding at runtime, and keys pressed during a modal never leaking into gameplay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput, scriptedInput, dirsForAngle } from '../../src/platform/input.js';
import { resetBindings, rebind } from '../../src/platform/bindings.js';
import { DIR, DT } from '../../src/contracts.js';

const { UP, RIGHT, DOWN, LEFT } = DIR;
const PI = Math.PI;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

/** Minimal window: capture listeners first, then bubble listeners, like a real keydown on window. */
function fakeWindow() {
  const L = { keydown: [[], []], keyup: [[], []], blur: [[], []] };
  return {
    addEventListener(t, fn, cap) { L[t][cap ? 0 : 1].push(fn); },
    removeEventListener(t, fn, cap) { const a = L[t][cap ? 0 : 1]; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
    fire(t, code, extra = {}) {
      const e = Object.assign({ type: t, code, repeat: false, ctrlKey: false, metaKey: false, altKey: false, prevented: false,
        preventDefault() { this.prevented = true; } }, extra);
      for (const fn of [...L[t][0], ...L[t][1]]) fn(e);
      return e;
    },
  };
}

test('8 directions from key combinations, attackDir = nearest DIR', () => {
  const s = scriptedInput();
  const cases = [
    [[UP], -PI / 2, UP], [[RIGHT], 0, RIGHT], [[DOWN], PI / 2, DOWN], [[LEFT], PI, LEFT],
    [[UP, RIGHT], -PI / 4, RIGHT], [[RIGHT, UP], -PI / 4, UP], [[DOWN, RIGHT], PI / 4, RIGHT],
    [[DOWN, LEFT], 3 * PI / 4, LEFT], [[LEFT, UP], -3 * PI / 4, UP],
  ];
  for (const [keys, angle, dir] of cases) {
    s.reset();
    for (const d of keys) s.attack(d, true);
    const st = s.sample();
    near(st.attackAngle, angle, 'angle for ' + keys);
    assert.equal(st.attackDir, dir, 'dir for ' + keys + ' (diagonal: the more recent key)');
  }
  s.reset();
  const st = s.sample();
  assert.ok(Number.isNaN(st.attackAngle));
  assert.equal(st.attackDir, -1);
});

test('opposite keys cancel; a full cancel uses the most recent key', () => {
  const s = scriptedInput();
  s.attack(UP, true); s.attack(DOWN, true);
  let st = s.sample();
  assert.equal(st.attackDir, DOWN); near(st.attackAngle, PI / 2, 'up+down -> most recent (down)');
  s.attack(RIGHT, true);
  st = s.sample();
  assert.equal(st.attackDir, RIGHT); near(st.attackAngle, 0, 'up+down+right -> right');
  s.attack(LEFT, true);
  st = s.sample();
  assert.equal(st.attackDir, LEFT, 'all four -> most recent'); near(st.attackAngle, PI, 'all four');
  s.attack(LEFT, false); s.attack(DOWN, false);
  st = s.sample();
  near(st.attackAngle, -PI / 4, 'up+right after releases');
});

test('one gesture: pressed on the first key, released on the last, held time keeps counting through I -> I+L -> L', () => {
  const s = scriptedInput();
  s.attack(UP, true);
  let st = s.sample();
  assert.equal(st.attackPressed, UP); assert.equal(st.attackReleased, -1); assert.equal(st.attackHeldT, 0);
  for (let i = 0; i < 10; i++) st = s.sample();
  near(st.attackHeldT, 10 * DT, 'held 10 steps');
  s.attack(RIGHT, true);                       // I -> I+L
  st = s.sample();
  assert.equal(st.attackPressed, -1, 'adding a key is not a new press');
  near(st.attackHeldT, 11 * DT, 'charge continues');
  near(st.attackAngle, -PI / 4, 'diagonal');
  s.attack(UP, false);                         // I+L -> L
  st = s.sample();
  assert.equal(st.attackReleased, -1, 'releasing one of two is not a release');
  assert.equal(st.attackDir, RIGHT);
  near(st.attackHeldT, 12 * DT, 'still charging');
  s.attack(RIGHT, false);
  st = s.sample();
  assert.equal(st.attackReleased, RIGHT, 'release with the last direction');
  assert.equal(st.attackDir, -1); assert.equal(st.attackHeldT, 0);
  // a tap inside one step is still reported once
  s.attack(LEFT, true); s.attack(LEFT, false);
  st = s.sample();
  assert.equal(st.attackDir, LEFT); assert.equal(st.attackPressed, LEFT); assert.equal(st.attackReleased, LEFT);
  near(st.attackAngle, PI, 'tap angle');
  st = s.sample();
  assert.equal(st.attackDir, -1); assert.equal(st.attackPressed, -1); assert.equal(st.attackReleased, -1);
  // switching straight from one key to another (no overlap) is a new gesture, like before
  s.set({ attackDir: UP }); s.sample(); s.sample();
  s.set({ attackDir: DOWN });
  st = s.sample();
  assert.equal(st.attackPressed, DOWN); assert.equal(st.attackReleased, UP); assert.equal(st.attackHeldT, 0);
});

test('scriptedInput.set({attackAngle}) holds the keys of that angle and reports the exact angle', () => {
  assert.deepEqual(dirsForAngle(-PI / 4), [UP, RIGHT]);
  assert.deepEqual(dirsForAngle(0.1), [RIGHT]);
  assert.deepEqual(dirsForAngle(NaN), []);
  const s = scriptedInput();
  s.set({ attackAngle: -PI / 2 });
  let st = s.sample();
  assert.equal(st.attackDir, UP); assert.equal(st.attackPressed, UP);
  for (let i = 0; i < 5; i++) st = s.sample();
  s.set({ attackAngle: -PI / 4 });              // UP stays held: same gesture
  st = s.sample();
  assert.equal(st.attackPressed, -1);
  near(st.attackHeldT, 6 * DT, 'held time continues');
  near(st.attackAngle, -PI / 4, 'angle');
  s.set({ attackAngle: 0.3 });                  // exact aim inside the RIGHT sector
  st = s.sample();
  near(st.attackAngle, 0.3, 'exact angle kept'); assert.equal(st.attackDir, RIGHT);
  s.set({ attackAngle: NaN });
  st = s.sample();
  assert.equal(st.attackReleased, RIGHT); assert.ok(Number.isNaN(st.attackAngle));
  s.set({ attackDir: LEFT });
  st = s.sample();
  near(st.attackAngle, PI, 'attackDir still works and sets the angle');
});

test('DOM input follows the bindings (defaults, extra keys, runtime rebinding)', () => {
  resetBindings();
  const w = fakeWindow();
  const inp = createInput(w);
  w.fire('keydown', 'KeyI'); w.fire('keydown', 'KeyL');
  let st = inp.sample();
  near(st.attackAngle, -PI / 4, 'I+L = up-right');
  w.fire('keyup', 'KeyI'); w.fire('keyup', 'KeyL');
  inp.sample();
  w.fire('keydown', 'ArrowDown');
  st = inp.sample();
  assert.equal(st.attackDir, DOWN, 'arrows still attack');
  w.fire('keydown', 'KeyK');                    // the same direction from a second key
  w.fire('keyup', 'ArrowDown');
  st = inp.sample();
  assert.equal(st.attackDir, DOWN, 'still held through the other key');
  assert.equal(st.attackReleased, -1);
  w.fire('keyup', 'KeyK');
  inp.sample();
  w.fire('keydown', 'KeyW'); w.fire('keydown', 'KeyD');
  st = inp.sample();
  near(st.moveX, Math.SQRT1_2, 'diagonal move normalized'); near(st.moveY, -Math.SQRT1_2, 'move y');
  w.fire('keyup', 'KeyW'); w.fire('keyup', 'KeyD');
  w.fire('keydown', 'KeyU');
  st = inp.sample();
  assert.ok(st.pressed.q && st.held.q, 'U = ability slot q');
  w.fire('keyup', 'KeyU');
  w.fire('keydown', 'KeyQ');
  st = inp.sample();
  assert.ok(st.pressed.q, 'Q still works');
  w.fire('keyup', 'KeyQ');
  w.fire('keydown', 'ShiftLeft'); w.fire('keydown', 'ShiftRight'); w.fire('keyup', 'ShiftLeft');
  st = inp.sample();
  assert.ok(st.held.shift, 'one Shift still down keeps the slot held');
  w.fire('keyup', 'ShiftRight');
  assert.ok(!inp.sample().held.shift);
  const e = w.fire('keydown', 'Space');
  assert.ok(e.prevented, 'Space does not scroll');
  st = inp.sample();
  assert.ok(st.pressed.space);
  w.fire('keyup', 'Space');
  // rebinding at runtime
  rebind('q', 'KeyY');
  w.fire('keydown', 'KeyY');
  st = inp.sample();
  assert.ok(st.pressed.q, 'Y now drives slot q');
  w.fire('keyup', 'KeyY');
  w.fire('keydown', 'KeyU');
  st = inp.sample();
  assert.ok(!st.pressed.q && !st.held.q, 'U no longer does');
  w.fire('keyup', 'KeyU');
  rebind('attack_up', 'KeyT');
  w.fire('keydown', 'KeyT'); w.fire('keydown', 'KeyJ');
  st = inp.sample();
  near(st.attackAngle, -3 * PI / 4, 'T+J = up-left after rebinding');
  inp.dispose();
  resetBindings();
});

test('keys pressed while a modal is open never reach gameplay after it closes', () => {
  resetBindings();
  const w = fakeWindow();
  let blocked = true;
  const inp = createInput(w, { isBlocked: () => blocked });
  w.fire('keydown', 'Digit1');                  // answers a question card
  w.fire('keydown', 'KeyI');
  let st = inp.sample();
  assert.ok(!st.pressed.item1 && st.attackDir === -1, 'neutral while blocked');
  blocked = false;                              // the modal closed, keys still down
  st = inp.sample();
  assert.ok(!st.pressed.item1 && !st.held.item1, 'no item use from the answer key');
  assert.equal(st.attackDir, -1, 'no attack from a key pressed in the modal');
  w.fire('keyup', 'Digit1'); w.fire('keyup', 'KeyI');
  w.fire('keydown', 'Digit1');
  st = inp.sample();
  assert.ok(st.pressed.item1, 'a fresh press works');
  w.fire('keyup', 'Digit1');
  // held through opening a modal: released state, no edges, no charge carried over
  w.fire('keydown', 'KeyL');
  inp.sample(); inp.sample();
  blocked = true;
  st = inp.sample();
  assert.equal(st.attackDir, -1); assert.equal(st.attackHeldT, 0);
  inp.dispose();
});
