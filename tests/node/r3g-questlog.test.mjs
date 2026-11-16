// Round 3 package G: quest log data shaping (pure helpers), the Q binding and the two new light looks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { goalNeed, normalizeRewards, stepViews, questZone, questEntries } from '../../src/ui/questLog.js';
import { controlRows } from '../../src/ui/modalKit.js';
import {
  ACTIONS, ACTION_INFO, DEFAULT_BINDINGS, resetBindings, setBindings, getBindings, actionFor, keyLabel, isFixed, rebind,
} from '../../src/platform/bindings.js';
import { PLAYER_LOOKS } from '../../src/data/looks.js';

const defs = {
  q1: { id: 'q1', name: 'Mushroom Mischief', giver: 'mo', steps: [
    { text: 'Calm the sporecaps. (6)', goal: { type: 'kill', kind: 'sporecap', n: 6, zone: 'forest' } },
    { text: 'Collect glowcaps. (4)', goal: { type: 'collect', item: 'glowcap', n: 4 } },
    { text: 'Bring them to Mo.', goal: { type: 'talk', npc: 'mo' } },
    { text: 'Last step.' },
  ], rewards: { xp: 100, gold: 40, items: [{ id: 'speed_tonic', n: 2 }] } },
  q2: { id: 'q2', name: 'Old Quest', giver: 'opal', steps: [{ text: 'Do it.' }], rewards: { items: ['potion_small', ['focus_scroll', 3]] } },
  q3: { id: 'q3', name: 'Third', giver: 'nobody', steps: [{ text: 'A' }, { text: 'B' }] },
};

function fakeGame() {
  const st = { q1: { s: 'active', step: 1, n: 3 }, q2: { s: 'done', step: 0, n: 0 }, q3: { s: 'active', step: 0, n: 0 } };
  const goals = { q1: { type: 'collect', item: 'glowcap', n: 4 }, q3: null };
  return {
    data: { quests: defs, npcs: { mo: { name: 'Mo' }, opal: { name: 'Madam Opal' } }, zones: { forest: { name: 'Whisperwood' } },
      items: { speed_tonic: { name: 'Speed Tonic', icon: 'bolt', desc: 'Fast.' } } },
    quests: {
      tracked: 'q3',
      active: () => ['q1', 'q3'], done: () => ['q2'],
      state: (id) => st[id].s, step: (id) => st[id].step, progress: (id) => st[id].n, goal: (id) => goals[id] || null,
      track(id) { this.tracked = id; },
    },
  };
}

test('goalNeed counts only kill and collect goals with n > 1', () => {
  assert.equal(goalNeed({ type: 'kill', n: 6 }), 6);
  assert.equal(goalNeed({ type: 'collect', n: 1 }), 0);
  assert.equal(goalNeed({ type: 'talk', n: 5 }), 0);
  assert.equal(goalNeed(null), 0);
});

test('normalizeRewards accepts every item notation and fills names and icons', () => {
  const r = normalizeRewards(defs.q1.rewards, { speed_tonic: { name: 'Speed Tonic', icon: 'bolt' } });
  assert.deepEqual([r.xp, r.gold], [100, 40]);
  assert.deepEqual(r.items.map((i) => [i.id, i.n, i.name, i.icon]), [['speed_tonic', 2, 'Speed Tonic', 'bolt']]);
  const r2 = normalizeRewards(defs.q2.rewards, {});
  assert.deepEqual(r2.items.map((i) => [i.id, i.n]), [['potion_small', 1], ['focus_scroll', 3]]);
  assert.deepEqual(normalizeRewards({ items: { a: 2 } }).items.map((i) => [i.id, i.n]), [['a', 2]]);
  assert.deepEqual(normalizeRewards(undefined), { xp: 0, gold: 0, items: [] });
});

test('stepViews: done, current with a count, next step shown, the rest hidden', () => {
  const v = stepViews(defs.q1, 'active', 1, 3, 4);
  assert.deepEqual(v.map((s) => s.state), ['done', 'current', 'todo', 'todo']);
  assert.equal(v[1].count, '3/4');
  assert.equal(v[2].text, 'Bring them to Mo.');
  assert.equal(v[3].text, '???');
  assert.equal(stepViews(defs.q1, 'active', 0, 99, 6)[0].count, '6/6', 'count is capped');
  assert.equal(stepViews(defs.q1, 'active', 2, 0, 0)[2].count, '', 'no count for a talk step');
  const all = stepViews(defs.q1, 'done', 4);
  assert.ok(all.every((s) => s.state === 'done' && s.text !== '???'));
  assert.deepEqual(stepViews(null, 'active', 0), []);
});

test('questZone finds the first zone named by a goal', () => {
  assert.equal(questZone(defs.q1), 'forest');
  assert.equal(questZone(defs.q3), '');
});

test('questEntries: tabs, tracked first, giver and zone names, progress hints', () => {
  const e = questEntries(fakeGame());
  assert.deepEqual(e.active.map((x) => x.id), ['q3', 'q1'], 'tracked quest first');
  assert.deepEqual(e.done.map((x) => x.id), ['q2']);
  const q1 = e.active[1];
  assert.equal(q1.giverName, 'Mo');
  assert.equal(q1.zoneName, 'Whisperwood');
  assert.equal(q1.hint, '3/4');
  assert.equal(q1.tracked, false);
  assert.equal(e.active[0].tracked, true);
  assert.equal(e.active[0].giverName, 'nobody', 'unknown giver falls back to the id');
  assert.equal(e.active[0].hint, 'Step 1/2');
  assert.equal(e.done[0].hint, 'Done');
  const g = fakeGame();
  g.quests.track('q1');
  assert.equal(questEntries(g).active[0].id, 'q1', 'tracking another quest moves it first');
});

test('questEntries is empty without a quest system or definitions', () => {
  assert.deepEqual(questEntries({}), { active: [], done: [] });
  const g = fakeGame();
  g.data.quests = {};
  assert.deepEqual(questEntries(g), { active: [], done: [] });
});

test('Q is the fixed quest-log key and no longer an ability key', () => {
  resetBindings();
  assert.ok(ACTIONS.includes('quests'));
  assert.deepEqual(DEFAULT_BINDINGS.quests, ['KeyQ']);
  assert.deepEqual(DEFAULT_BINDINGS.q, ['KeyU']);
  assert.equal(keyLabel('quests'), 'Q');
  assert.equal(actionFor('KeyQ'), 'quests');
  assert.ok(isFixed('quests'));
  assert.equal(ACTION_INFO.quests.name, 'Quest log');
  assert.equal(rebind('f', 'KeyQ').reason, 'reserved', 'no action can take Q');
  assert.equal(rebind('quests', 'KeyY').reason, 'fixed');
  const rows = controlRows();
  assert.ok(rows.some(([k, label]) => label === 'Quest log' && k[0] === 'Q'), 'controls card lists the quest log');
});

test('old saved settings that still list Q as an ability key lose it', () => {
  setBindings(Object.assign({}, DEFAULT_BINDINGS, { q: ['KeyU', 'KeyQ'] }));
  assert.deepEqual(getBindings().q, ['KeyU']);
  assert.equal(actionFor('KeyQ'), 'quests');
  resetBindings();
});

test('two new light looks (indexes 8 and 9): one per build, new hairstyles, distinct skin', () => {
  assert.equal(PLAYER_LOOKS[8].build, 'a');
  assert.equal(PLAYER_LOOKS[9].build, 'b');
  const lightOld = [PLAYER_LOOKS[3], PLAYER_LOOKS[6]];
  for (const l of [PLAYER_LOOKS[8], PLAYER_LOOKS[9]]) {
    assert.ok(!lightOld.some((o) => o.hair.style === l.hair.style), 'hairstyle differs from the older light looks');
    assert.ok(!lightOld.some((o) => o.skin === l.skin));
    assert.ok(!lightOld.some((o) => o.hair.color === l.hair.color));
  }
  assert.notEqual(PLAYER_LOOKS[8].hair.style, PLAYER_LOOKS[9].hair.style);
});
