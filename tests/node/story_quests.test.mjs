import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatZone, LOOK, seconds, steps, flush, collect } from './story_fixtures.test.mjs';

const fx = {
  zones: {
    qz: flatZone('qz', { start: [5, 5], well: [20, 20], baker_spot: [8, 5], to_forest: [1, 10] },
      { exits: [{ at: 'to_forest', to: 'woods', marker: 'entry' }] }),
    woods: flatZone('woods', { entry: [38, 10], camp: [10, 10] }),
  },
  enemies: {
    rat: { id: 'rat', name: 'Rat', tags: ['beast'], stats: { hp: 3 }, look: LOOK },
    boss_rat: { id: 'boss_rat', name: 'Boss Rat', tags: ['boss'], stats: { hp: 30 }, look: LOOK },
  },
  npcs: { baker: { id: 'baker', name: 'Bun', look: LOOK, zone: 'qz', at: 'baker_spot', dialogue: 'baker_hi' } },
  dialogues: { baker_hi: { start: 'a', nodes: { a: { say: 'Hello!' } } } },
  quests: {
    q_all: {
      id: 'q_all', name: 'Everything', giver: 'baker', companions: true,
      steps: [
        { text: 'Go to the well', goal: { type: 'reach', zone: 'qz', marker: 'well', r: 2 } },
        { text: 'Defeat rats', goal: { kill: { kind: 'rat', n: 2 } } },
        { text: 'Find cheese', goal: ['collect', { item: 'cheese', n: 2 }] },
        { text: 'Read the sign', goal: { type: 'interact', id: 'sign_1' } },
        { text: 'Ring the bell', goal: { type: 'flag', key: 'bell' } },
        { text: 'Beat the boss', goal: { type: 'boss', kind: 'boss_rat' } },
        { text: 'Tell {name}\'s baker', goal: { type: 'talk', npc: 'baker' } },
      ],
      rewards: { xp: 100, gold: 40, items: [['potion_small', 1]] },
      onDone: [['flag.set', 'q_done']],
    },
    q_far: { id: 'q_far', name: 'Far', steps: [{ text: 'Go to camp', goal: { type: 'reach', zone: 'woods', marker: 'camp' } }] },
    q_req: { id: 'q_req', name: 'Locked', req: [['flag', 'nope']], steps: [{ text: 'x' }] },
    q_manual: { id: 'q_manual', name: 'Manual', steps: [{ text: 'one' }, { text: 'two', goal: { type: 'mystery' } }], rewards: { gold: 5 } },
  },
};

function setup(opts) {
  const g = makeGame(fx, Object.assign({ zone: 'qz' }, opts));
  const got = [];
  g.ops.register('xp', (game, a) => { got.push(['xp', a[1]]); });
  g.ops.register('gold', (game, a) => { got.push(['gold', a[1]]); });
  g.ops.register('give', (game, a) => { got.push(['give', a[1], a[2]]); });
  return { g, got };
}

test('quests: every goal type, toasts, events, HUD, blips, turn-in bonus, rewards via ops', async () => {
  const { g, got } = setup();
  const compCalls = [];
  g.sys.companions.set = (ids) => compCalls.push(ids);
  const toasts = collect(g, 'toast');
  const stepsEv = collect(g, 'quest:step');
  const done = collect(g, 'quest:done');
  g.progression.classId = 'warrior';
  assert.equal(g.quests.start('q_all'), true);
  assert.equal(g.quests.start('q_all'), false, 'no double start');
  assert.deepEqual(compCalls, [['mage', 'rogue']], 'companions: true wires the other two classes (warrior chosen)');
  assert.equal(g.quests.state('q_all'), 'active');
  assert.equal(g.quests.tracked, 'q_all');
  assert.ok(toasts.some((t) => t.text === 'New quest: Everything' && t.style === 'quest'));
  // HUD + blip for the reach goal
  steps(g, 31);
  let hud = g.hudState();
  assert.deepEqual([hud.quest.id, hud.quest.name, hud.quest.step], ['q_all', 'Everything', 'Go to the well']);
  const well = g.world.marker('well');
  const n0 = hud.minimap.blipCount;
  const b = hud.minimap.blips[n0 - 1];
  assert.deepEqual([b.type, b.x, b.y], ['quest', well.x, well.y]);
  hud = g.hudState();
  assert.equal(hud.minimap.blipCount, n0, 'blip list does not grow on repeated hudState()');
  // reach
  g.player.x = well.x + 1; g.player.y = well.y;
  seconds(g, 0.3);
  assert.equal(g.quests.step('q_all'), 1);
  // kill x2 (any death of that kind)
  const r1 = g.ents.spawn('rat', 10, 10), r2 = g.ents.spawn('rat', 11, 10);
  g.combat.kill(r1, g.player);
  hud = g.hudState();
  assert.equal(hud.quest.progress, '1/2');
  g.combat.kill(r2, g.player);
  assert.equal(g.quests.step('q_all'), 2);
  // collect: counts the inventory on 'item:gained'
  g.inventory.give('cheese', 1); g.bus.emit('item:gained', { id: 'cheese', n: 1 });
  assert.equal(g.quests.step('q_all'), 2);
  g.inventory.give('cheese', 1); g.bus.emit('item:gained', { id: 'cheese', n: 1 });
  assert.equal(g.quests.step('q_all'), 3);
  // interact
  const sign = g.ents.create({ kind: 'sign_1', x: 3, y: 3 });
  g.bus.emit('interact', { ent: sign });
  assert.equal(g.quests.step('q_all'), 4);
  // flag
  g.setFlag('bell', true);
  assert.equal(g.quests.step('q_all'), 5);
  // boss
  g.combat.kill(g.ents.spawn('boss_rat', 12, 12), g.player);
  assert.equal(g.quests.step('q_all'), 6);
  assert.ok(toasts.some((t) => t.text === "Everything: Tell Robin's baker"));
  // talk (last step): the stub gate answers correct => +25% rewards
  const baker = g.ops.resolveWho('baker');
  const p = g.ops.run(baker.interact.do, { self: baker });
  g.commands.dialogueAdvance();
  await p; await flush();
  assert.equal(g.quests.state('q_all'), 'done');
  assert.deepEqual(got, [['xp', 125], ['gold', 50], ['give', 'potion_small', 1]]);
  assert.equal(g.flags.q_done, true);
  assert.deepEqual(done, [{ id: 'q_all', bonus: true }]);
  assert.equal(stepsEv.length, 6);
  assert.ok(toasts.some((t) => /Quest complete: Everything/.test(t.text)));
  assert.equal(g.ops.test([['quest', 'q_all', 'done']]), true);
  steps(g, 31);
  assert.equal(g.hudState().quest, null);
});

test('quests: req, manual advance, unknown goal type warns, conditions, cross-zone blip at the exit', () => {
  const { g, got } = setup();
  assert.equal(g.quests.start('q_req'), false);
  assert.equal(g.quests.state('q_req'), 'none');
  assert.equal(g.quests.start('nope'), false);
  g.ops.run([['quest.start', 'q_manual']]);
  assert.equal(g.ops.test([['quest', 'q_manual', 'step', 0]]), true);
  g.ops.run([['quest.advance', 'q_manual', 1]]);
  assert.equal(g.quests.step('q_manual'), 0, 'guarded advance ignored on the wrong step');
  g.ops.run([['quest.advance', 'q_manual']]);
  assert.equal(g.quests.step('q_manual'), 1);
  assert.ok(g.ops.warnings.some((w) => /unknown goal type "mystery"/.test(w)));
  assert.equal(g.ops.test([['quest', 'q_manual', 'atLeast', 1]]), true);
  g.ops.run([['quest.advance', 'q_manual']]);
  assert.equal(g.quests.state('q_manual'), 'done');
  assert.deepEqual(got, [['gold', 5]], 'no turn-in bonus without a talk step');
  g.quests.start('q_far');
  steps(g, 31);
  const hud = g.hudState();
  const b = hud.minimap.blips[hud.minimap.blipCount - 1];
  const ex = g.world.marker('to_forest');
  assert.deepEqual([b.type, b.x, b.y], ['quest', ex.x, ex.y]);
  g.world.loadZone('woods', 'entry');
  const camp = g.world.marker('camp');
  g.player.x = camp.x; g.player.y = camp.y;
  seconds(g, 0.3);
  assert.equal(g.quests.state('q_far'), 'done');
});

test('quests: save/load keeps state, step, progress and tracking', () => {
  const { g } = setup();
  g.quests.start('q_all');
  g.quests.advance('q_all');
  g.combat.kill(g.ents.spawn('rat', 10, 10), g.player);
  g.quests.start('q_manual');
  g.quests.complete('q_manual');
  g.quests.track('q_all');
  const json = g.save.now();
  const g2 = makeGame(fx, { save: g.save.load('Robin'), storage: g.storage });
  assert.equal(g2.quests.state('q_all'), 'active');
  assert.equal(g2.quests.step('q_all'), 1);
  assert.equal(g2.quests.progress('q_all'), 1);
  assert.equal(g2.quests.state('q_manual'), 'done');
  assert.equal(g2.quests.tracked, 'q_all');
  g2.combat.kill(g2.ents.spawn('rat', 10, 10), g2.player);
  assert.equal(g2.quests.step('q_all'), 2, 'progress continues after load');
  assert.ok(json.systems.quests);
});
