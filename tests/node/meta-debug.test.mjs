// Meta: the debug API (scenarios with missing content, helpers, answerQuestion in stub mode, reset/save/load).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import baseData from '../../src/data/index.js';
import { createQuestions } from '../../src/questions/index.js';

const flush = () => new Promise((r) => setImmediate(r));
const SCENARIOS = ['intro_start', 'ambush', 'rescued', 'town', 'academy_pick', 'forest', 'forest_boss', 'gallery', 'stress', 'class_demo'];

function make(mode = 'auto', data = baseData) {
  return createGame({ data, name: 'Dbg', seed: 2, zone: 'test', test: true, questions: createQuestions({ mode }) });
}

test('every scenario returns without throwing and reports missing content', () => {
  const game = make();
  const d = game.debug;
  assert.deepEqual(d.scenarios().sort(), SCENARIOS.slice().sort());
  for (const id of SCENARIOS) {
    const r = d.scenario(id);
    assert.equal(typeof r, 'object', id);
    assert.equal(r.id, id);
    assert.ok(Array.isArray(r.missing), id);
    assert.equal(r.ok, r.missing.length === 0, id);
    assert.ok(game.zone && game.zone.id, id);
    for (let i = 0; i < 30; i++) d.step(1);
    assert.deepEqual(d.errors(), [], id);
  }
  // the content does not exist yet in this worktree: zones fall back to test
  assert.ok(d.scenario('forest').missing.includes('zone:forest'));
  assert.equal(d.scenario('nope').ok, false);
});

test('scenario specifics: class_demo, stress, gallery, forest', () => {
  const extra = Object.assign({}, baseData, {
    enemies: Object.assign({}, baseData.enemies, { training_dummy: { id: 'training_dummy', name: 'Dummy', level: 1, tags: [], stats: { hp: 100, power: 0, defense: 0, speed: 0, radius: 0.4, xp: 0 }, look: { rig: 'golem', size: 1, colors: {}, features: [] } } }),
    npcs: { pim: { id: 'pim', name: 'Pim', look: { rig: 'humanoid' } } },
  });
  const game = make('auto', extra);
  const d = game.debug;
  let r = d.scenario('class_demo', { classId: 'mage', specId: 'sorcerer', level: 11 });
  assert.equal(r.ok, true, JSON.stringify(r.missing));
  assert.equal(game.progression.classId, 'mage');
  assert.equal(game.progression.specId, 'sorcerer');
  assert.equal(game.progression.level, 11);
  assert.deepEqual(r.abilities.sort(), ['f', 'q', 'shift', 'space']);
  assert.equal(d.find('training_dummy').length, 8);
  r = d.class_demo('rogue', null, 5);
  assert.equal(game.progression.specId, null);
  assert.deepEqual(r.abilities.sort(), ['q', 'space']);
  r = d.scenario('class_demo', 'warrior', 'knight', 8);
  assert.equal(game.progression.specId, 'knight');
  r = d.scenario('stress');
  assert.equal(r.enemies, 24);
  assert.ok(r.projectiles >= 24);
  assert.ok(d.find('enemy').length >= 24);
  r = d.scenario('gallery');
  const rows = d.find().filter((e) => e.type === 'enemy' || e.type === 'npc');
  assert.equal(rows.length, Object.keys(extra.enemies).length + 1);
  assert.ok(rows.every((e) => /\[.+\]$/.test(e.name)), 'labeled');
  assert.ok(game.ents.all.filter((e) => e.type === 'enemy').every((e) => e.ai === null && e.data.scripted));
  r = d.scenario('forest', { classId: 'rogue' });
  assert.equal(game.progression.classId, 'rogue');
  assert.equal(game.flags.forest_open, true);
});

test('helpers: levels, class, items, gold, flags, god, spawn/find/killAll, time, command', () => {
  const game = make();
  const d = game.debug;
  assert.equal(d.setLevel(7), 7);
  assert.equal(d.setClass('warrior'), true);
  assert.equal(d.setSpec('ninja'), true, 'spec switches the class to its parent');
  assert.equal(game.progression.classId, 'rogue');
  const w = console.warn; console.warn = () => {};
  try { d.giveItem('anything', 2); } finally { console.warn = w; }
  assert.equal(game.inventory.count('anything'), 2);
  d.giveGold(12);
  d.setFlag('x', 5);
  const s = d.state();
  assert.equal(s.gold, 12); assert.equal(s.flags.x, 5); assert.equal(s.level, 7); assert.equal(s.specId, 'ninja');
  d.god(true);
  game.player.hp = 1;
  d.step(1);
  assert.equal(game.player.hp, game.player.hpMax);
  d.god(false);
  const ids = d.spawn('rat', 3);
  assert.equal(ids.length, 3);
  assert.equal(d.find('rat').length >= 3, true);
  assert.ok(d.killAll() >= 3);
  d.step(1);
  assert.equal(d.find('rat').filter((e) => e.alive).length, 0);
  d.setTime(14);
  assert.equal(d.command('nonexistent'), undefined);
  d.command('openInventory');
  assert.equal(d.state().modal, 'inventory');
  d.closeModal();
  assert.equal(d.state().modal, null);
});

test('answerQuestion resolves stub questions without DOM', async () => {
  const game = make('stub');
  const d = game.debug;
  const p = game.gates.ask({ context: 'gate' });
  assert.equal(d.state().question.context, 'gate');
  assert.equal(d.state().modal, 'question');
  assert.equal(d.answerQuestion(true), true);
  assert.deepEqual(await p, { correct: true, skipped: false });
  assert.equal(d.answerQuestion(true), false, 'nothing pending');
});

test('save / load / reset', async () => {
  const game = make();
  const d = game.debug;
  d.setLevel(5);
  d.giveGold(30);
  d.save();
  d.setLevel(9);
  d.giveGold(5);
  assert.equal(d.load(), true);
  assert.equal(game.progression.level, 5);
  assert.equal(game.inventory.gold, 30);
  d.setFlag('has_stick');
  const s = d.reset();
  assert.equal(s.level, 1);
  assert.equal(s.gold, 0);
  assert.deepEqual(s.flags, {});
  assert.equal(s.zone, 'test');
  await flush();
});
