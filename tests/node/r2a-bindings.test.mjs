// Round 2, package A: key bindings (defaults, rebinding with conflicts, labels, persistence, live tutorial steps).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, DEFAULT_BINDINGS, STORAGE_KEY, getBindings, setBindings, resetBindings, loadBindings, keyLabel, keyLabels,
  codeLabel, actionFor, onBindingsChange, rebind, clearAlt, altLabels, unboundActions, isFixed, tutorialStep, keyText,
  liveKeyLabels, ACTION_INFO,
} from '../../src/platform/bindings.js';
import { createMemoryStorage } from '../../src/platform/storage.js';
import cutscenes from '../../src/data/cutscenes/intro.js';
import rescue from '../../src/data/cutscenes/rescue.js';

test('defaults: WASD move, IJKL + arrows attack, Space dash, U/O/H abilities with F/Shift kept (Q is the quest log)', () => {
  resetBindings();
  assert.deepEqual(['move_up', 'move_left', 'move_down', 'move_right'].map(keyLabel), ['W', 'A', 'S', 'D']);
  assert.deepEqual(['attack_up', 'attack_left', 'attack_down', 'attack_right'].map(keyLabel), ['I', 'J', 'K', 'L']);
  assert.deepEqual(keyLabels('attack_up'), ['I', '↑']);
  assert.deepEqual(['space', 'q', 'f', 'shift'].map(keyLabel), ['Space', 'U', 'O', 'H']);
  assert.deepEqual(altLabels('q'), []);
  assert.deepEqual(altLabels('shift'), ['Shift'], 'both Shift keys show as one label');
  assert.equal(actionFor('KeyQ'), 'quests');
  assert.equal(actionFor('ShiftRight'), 'shift');
  assert.equal(actionFor('ArrowLeft'), 'attack_left');
  assert.deepEqual(['interact', 'item1', 'item6', 'boon', 'map', 'pause', 'inventory', 'quests'].map(keyLabel), ['E', '1', '6', 'Tab', 'M', 'Esc', 'B', 'Q']);
  assert.equal(codeLabel('Numpad3'), 'Num3');
  for (const a of ACTIONS) assert.ok(ACTION_INFO[a] && ACTION_INFO[a].name, 'every action has a display name: ' + a);
  assert.deepEqual(unboundActions(), []);
});

test('rebinding: primary and extra keys, the new binding wins, refusals', () => {
  resetBindings();
  const seen = [];
  const off = onBindingsChange((b) => seen.push(b.q.slice()));
  let r = rebind('q', 'KeyY');
  assert.ok(r.ok);
  assert.deepEqual(getBindings().q, ['KeyY'], 'primary replaced');
  assert.equal(keyLabel('q'), 'Y');
  assert.deepEqual(seen.at(-1), ['KeyY'], 'listeners notified');
  // take a key from another action: E -> q; interact is left with no key
  r = rebind('q', 'KeyE');
  assert.deepEqual(r.took, [{ action: 'interact', empty: true }]);
  assert.deepEqual(getBindings().interact, []);
  assert.deepEqual(unboundActions(), ['interact']);
  assert.equal(keyLabel('interact'), '');
  // extra key slot; shift pairs come together
  r = rebind('f', 'ShiftLeft', 1);
  assert.deepEqual(getBindings().f, ['KeyO', 'ShiftLeft', 'ShiftRight']);
  assert.deepEqual(getBindings().shift, ['KeyH'], 'both Shift keys moved off Ability 4');
  assert.deepEqual(altLabels('f'), ['Shift']);
  assert.ok(clearAlt('f'));
  assert.deepEqual(getBindings().f, ['KeyO']);
  // refusals
  assert.equal(rebind('q', 'Escape').reason, 'reserved');
  assert.equal(rebind('q', 'KeyP').reason, 'reserved');
  assert.equal(rebind('pause', 'KeyZ').reason, 'fixed');
  assert.ok(isFixed('inventory') && isFixed('map') && !isFixed('q'));
  assert.equal(rebind('nope', 'KeyZ').reason, 'unknown');
  off();
  resetBindings();
  assert.deepEqual(getBindings(), Object.fromEntries(ACTIONS.map((a) => [a, DEFAULT_BINDINGS[a].slice()])));
});

test('persistence: setBindings / rebind write storage, loadBindings reads it (and survives junk)', () => {
  const st = createMemoryStorage();
  resetBindings(st);
  rebind('attack_up', 'KeyT', 0, st);
  assert.deepEqual(st.getJSON(STORAGE_KEY).attack_up, ['KeyT', 'ArrowUp']);
  setBindings(DEFAULT_BINDINGS);          // in memory only
  assert.equal(keyLabel('attack_up'), 'I');
  loadBindings(st);
  assert.equal(keyLabel('attack_up'), 'T');
  st.set(STORAGE_KEY, '{broken');
  loadBindings(st);
  assert.equal(keyLabel('attack_up'), 'I', 'bad JSON -> defaults');
  st.setJSON(STORAGE_KEY, { q: ['KeyZ'] });
  loadBindings(st);
  assert.equal(keyLabel('q'), 'Z');
  assert.equal(keyLabel('f'), 'O', 'missing actions fall back to defaults');
  resetBindings();
});

test('tutorial steps name the bound keys at the time they run', () => {
  resetBindings();
  const step = tutorialStep('Walk with [move]. Talk with [interact]. [nope] stays.', 'move');
  assert.equal(step[0], 'tutorial');
  assert.equal(step[1], 'Walk with W A S D. Talk with E. [nope] stays.');
  assert.ok(Array.isArray(step[2]));
  assert.deepEqual(step[2].slice(), ['W', 'A', 'S', 'D']);
  rebind('move_up', 'KeyZ');
  assert.equal(step[1], 'Walk with Z A S D. Talk with E. [nope] stays.');
  assert.deepEqual(step[2].slice(), ['Z', 'A', 'S', 'D']);
  assert.equal(JSON.stringify(step), JSON.stringify(['tutorial', step[1], ['Z', 'A', 'S', 'D']]));
  assert.equal(keyText('[attack]'), 'I J K L');
  assert.deepEqual(liveKeyLabels(['attack', 'space']).slice(), ['I', 'J', 'K', 'L', 'Space']);
  resetBindings();
  // the shipped cutscenes use them: no hard-coded letters left in tutorial prompts
  const all = [...cutscenes.intro_wake.steps, ...Object.values(rescue).flatMap((c) => c.steps)];
  const tuts = all.filter((s) => Array.isArray(s) && s[0] === 'tutorial' && s[1] != null);
  assert.ok(tuts.length >= 7);
  rebind('move_up', 'KeyZ');
  for (const s of tuts) {
    assert.equal(typeof s[1], 'string');
    assert.ok(Array.isArray(s[2]) && s[2].length > 0, s[1]);
    assert.doesNotMatch(s[1], /\[|\bW A S D\b|arrow key/, 'tokens resolved, no fixed key names: ' + s[1]);
  }
  resetBindings();
  rebind('item1', 'KeyN');
  const potion = tuts.find((s) => /potion/.test(s[1]));
  assert.equal(potion[1], 'Press N to drink the potion.');
  assert.deepEqual(potion[2].slice(), ['N']);
  resetBindings();
  assert.equal(potion[1], 'Press 1 to drink the potion.');
});
