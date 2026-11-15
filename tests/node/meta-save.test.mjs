// Meta: save (round trip, autosave triggers, list, migrate) and platform/storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import baseData from '../../src/data/index.js';
import { createQuestions } from '../../src/questions/index.js';
import { listSaves, loadSave, migrate, SAVE_VERSION, saveSummaries } from '../../src/core/save.js';
import { createStorage, createMemoryStorage } from '../../src/platform/storage.js';
import { DT } from '../../src/contracts.js';

const items = { potion_small: { id: 'potion_small', type: 'consumable', name: 'Small Potion', icon: 'potion', use: { effect: 'heal', amount: 10 } } };
const data = Object.assign({}, baseData, { items });
function make(opts = {}) {
  return createGame(Object.assign({ data, name: 'Saver', seed: 9, zone: 'test', questions: createQuestions({ mode: 'auto' }) }, opts));
}

test('save round trip: flags, position, progression, inventory, version', () => {
  const game = make();
  game.setFlag('intro_done', true);
  game.setFlag('chest_test_c1', true);
  game.progression.setLevel(6, { quiet: true });
  game.progression.setClass('rogue', { quiet: true });
  game.progression.chooseBoon('venom_edge');
  game.inventory.give('potion_small', 3, { silent: true });
  game.inventory.addGold(42);
  game.player.x = 12.25; game.player.y = 7.5;
  const json = game.save.now();
  assert.equal(json.v, SAVE_VERSION);
  assert.equal(json.name, 'Saver');
  assert.equal(json.zone, 'test');
  assert.deepEqual([json.x, json.y], [12.25, 7.5]);
  assert.ok(json.systems.progression && json.systems.inventory);
  assert.equal(json.meta.level, 6);
  assert.ok(game.save.exists('Saver'));
  const again = make({ storage: game.storage, save: game.save.load('Saver') });
  assert.equal(again.flags.intro_done, true);
  assert.equal(again.flags.chest_test_c1, true);
  assert.equal(again.progression.level, 6);
  assert.equal(again.progression.classId, 'rogue');
  assert.deepEqual(again.progression.boons, ['venom_edge']);
  assert.equal(again.inventory.count('potion_small'), 3);
  assert.equal(again.inventory.hotbar[0], 'potion_small');
  assert.equal(again.inventory.gold, 42);
  assert.deepEqual([again.player.x, again.player.y], [12.25, 7.5]);
  assert.equal(again.player.hp, again.player.hpMax);
  assert.deepEqual(again.save.list(), ['Saver']);
  again.save.clear('Saver');
  assert.equal(again.save.exists('Saver'), false);
});

test('autosave triggers: level-up, zone load, quest step, timer; deferred while a question is open', () => {
  const game = make();
  const saves = [];
  game.bus.on('save', () => saves.push(game.t));
  assert.equal(saves.length, 0, 'no save during boot');
  game.progression.addXp(20);
  assert.equal(game.save.pendingAutosave(), true);
  game.step(DT);
  assert.equal(saves.length, 1, 'level-up');
  game.world.loadZone('test', 'far');
  game.step(DT);
  assert.equal(saves.length, 2, 'zone load');
  game.bus.emit('quest:step', { id: 'q', step: 1 });
  game.step(DT);
  assert.equal(saves.length, 3, 'quest step');
  game.bus.emit('quest:done', { id: 'q' });
  game.step(DT);
  assert.equal(saves.length, 4, 'quest done');
  for (let i = 0; i < 60 * 60 + 2; i++) game.step(DT);
  assert.equal(saves.length, 5, 'every 60 s');
  // deferred while a question (or cutscene/transition) is in progress
  game.freeze.add('question');
  game.bus.emit('levelup', { level: 3, gained: 1 });
  for (let i = 0; i < 10; i++) game.step(DT);
  assert.equal(saves.length, 5);
  game.freeze.delete('question');
  game.step(DT);
  assert.equal(saves.length, 6);
  game.sys.cutscene.active = { id: 'x' };
  game.bus.emit('levelup', { level: 4, gained: 1 });
  game.step(DT);
  assert.equal(saves.length, 6);
  game.sys.cutscene.active = null;
  game.step(DT);
  assert.equal(saves.length, 7);
  // the save op and the saveNow command
  game.ops.run([['save']]);
  game.commands.saveNow();
  assert.equal(saves.length, 9);
});

test('listSaves / loadSave / summaries work without a game; migrate hook', () => {
  const st = createMemoryStorage();
  const a = make({ storage: st, name: 'Ana' });
  a.save.now();
  const b = make({ storage: st, name: 'Bo' });
  b.progression.setLevel(4, { quiet: true });
  for (let i = 0; i < 5; i++) b.step(DT);
  b.save.now();
  st.set('flinkerton.v1.Broken', '{not json');
  st.set('other.key', '1');
  assert.deepEqual(listSaves(st).filter((n) => n !== 'Broken'), ['Bo', 'Ana'], 'most recent first');
  assert.equal(loadSave(st, 'Broken'), null);
  assert.equal(loadSave(st, 'Bo').meta.level, 4);
  assert.deepEqual(saveSummaries(st).find((s) => s.name === 'Bo'), { name: 'Bo', level: 4, classId: null, zone: 'test', zoneName: 'Test Meadow' });
  // v0 (no version) is upgraded; a newer version or garbage is rejected
  const v0 = { name: 'Old', zone: 'test', x: 1, y: 2, systems: {} };
  assert.deepEqual(migrate(v0), { name: 'Old', zone: 'test', x: 1, y: 2, systems: {}, v: 1, flags: {} });
  assert.equal(migrate({ v: 99, zone: 'test', systems: {} }), null);
  assert.equal(migrate(null), null);
  assert.equal(migrate({ v: 1 }), null);
});

test('restore() into a running game; missing zone falls back', () => {
  const game = make();
  game.setFlag('k', 1);
  game.progression.setLevel(5, { quiet: true });
  const json = game.save.now();
  game.progression.setLevel(9, { quiet: true });
  game.setFlag('k', 2);
  assert.equal(game.save.restore(json), true);
  assert.equal(game.progression.level, 5);
  assert.equal(game.flags.k, 1);
  assert.equal(game.save.restore(Object.assign({}, json, { zone: 'atlantis' })), true);
  assert.equal(game.zone.id, 'test');
  assert.equal(game.save.restore({ garbage: true }), false);
});

test('storage: localStorage backend, quota failure falls back to memory, keys', () => {
  const m = new Map();
  let fail = false;
  const backend = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (fail && k !== '__probe') throw new Error('quota'); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i],
    get length() { return m.size; },
  };
  const s = createStorage(backend);
  assert.equal(s.kind, 'local');
  s.setJSON('flinkerton.v1.A', { a: 1 });
  assert.deepEqual(s.getJSON('flinkerton.v1.A'), { a: 1 });
  assert.deepEqual(s.keys('flinkerton.v1.'), ['flinkerton.v1.A']);
  fail = true;
  const w = console.warn; console.warn = () => {};
  try { assert.equal(s.set('flinkerton.v1.B', 'x'), true); } finally { console.warn = w; }
  assert.equal(s.kind, 'memory');
  assert.equal(s.get('flinkerton.v1.B'), 'x');
  assert.deepEqual(s.keys('flinkerton.v1.').sort(), ['flinkerton.v1.A', 'flinkerton.v1.B']);
  assert.equal(createStorage().kind, 'memory', 'Node has no localStorage');
  const mem = createMemoryStorage();
  assert.equal(mem.getJSON('nope'), null);
  mem.set('x', '{bad');
  assert.equal(mem.getJSON('x'), null);
});
