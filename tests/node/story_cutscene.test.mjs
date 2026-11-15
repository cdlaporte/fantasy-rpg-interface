import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatZone, LOOK, seconds, steps, flush, collect, scriptedInput } from './story_fixtures.test.mjs';
import { TIMEOUTS } from '../../src/core/cutscene.js';

const zone = flatZone('cz', {
  start: [5, 25], laporte_arrive: [20, 2], clearing: [20, 15], exit: [20, 3], cam_spot: [30, 10], hex_1: [24, 15],
}, { w: 40, h: 30 });

const fx = {
  zones: { cz: zone },
  npcs: { laporte: { id: 'laporte', name: 'Mr. Laporte', look: Object.assign({}, LOOK, { hero: 'laporte' }), stats: { speed: 3 } } },
  enemies: { hexguard: { id: 'hexguard', name: 'Hexguard', tags: ['hex'], stats: { hp: 10, speed: 2 }, look: LOOK } },
  cutscenes: {
    big: {
      id: 'big', skippable: false,
      steps: [
        ['lockInput'], ['letterbox', true],
        ['tutorial', 'Move with WASD', ['W', 'A', 'S', 'D']],
        ['camera', { to: 'cam_spot', t: 0.5, zoom: 1.5 }],
        ['parallel', [
          ['move', 'laporte', 'clearing', { from: 'laporte_arrive' }],
          ['bubble', 'laporte', 'Hm.', 1],
          [['wait', 0.2], ['flag.set', 'par_b']],
        ]],
        ['face', 'laporte', 'player'], ['face', '@hex', 'up'],
        ['anim', 'laporte', 'cast', 0.3],
        ['say', 'laporte', 'Phone away, {name}.', { mood: 'annoyed' }],
        ['wait', 0.5],
        ['waitFor', ['flag', 'go']],
        ['control', { until: ['hp', 'player', '<=', 1], minHp: 1 }],
        ['kill', { tag: 'hex' }],
        ['t.pick'],
        ['flag.set', 'picked', '$chosen'],
        ['setLook', 'player', '$chosen'],
        ['cameraReset', { t: 0.2 }],
        ['cutscene', 'small'],
        ['escort', 'laporte', { to: 'exit' }],
        ['tutorial', null],
        ['unlockInput'], ['letterbox', false],
        ['flag.set', 'done'],
      ],
    },
    small: { id: 'small', steps: [['flag.set', 'nested_ran']] },
    skippy: {
      id: 'skippy', skippable: true,
      steps: [
        ['lockInput'], ['letterbox', true],
        ['camera', { to: 'cam_spot', t: 3 }],
        ['say', 'laporte', 'This takes forever.'],
        ['move', 'laporte', 'clearing', { from: 'laporte_arrive' }],
        ['wait', 100], ['sfx', 'boss'],
        ['flag.set', 'a'],
        ['t.pick'],
        ['flag.set', 'b', '$chosen'],
        ['escort', 'laporte', { to: 'exit' }],
        ['wait', 50],
      ],
    },
    stuck: {
      id: 'stuck',
      steps: [['waitFor', ['flag', 'never'], { timeout: 2 }], ['flag.set', 'past_wait'], ['t.never'], ['flag.set', 'past_op'],
        ['move', 'laporte', 'exit', { from: 'clearing', timeout: 3 }], ['flag.set', 'past_move'], ['control', { until: ['flag', 'never'], timeout: 1 }],
        ['say', 'player', '...', { timeout: 1 }], ['flag.set', 'end']],
    },
  },
};

function setup() {
  const g = makeGame(fx, { zone: 'cz' });
  let resolvePick = null;
  g.ops.register('t.pick', () => new Promise((r) => { resolvePick = r; }));
  g.ops.register('t.never', () => new Promise(() => {}));
  const hexes = [g.ents.spawn('hexguard', 24.5, 15.5), g.ents.spawn('hexguard', 25.5, 15.5)];
  return { g, hexes, pick: (v) => resolvePick(v) };
}

test('cutscene: every step type, control with minHp, escort, nested, cleanup', async () => {
  const { g, hexes, pick } = setup();
  const events = collect(g, 'cutscene:start');
  const ends = collect(g, 'cutscene:end');
  const boxes = collect(g, 'letterbox');
  const p = g.cutscene.play('big');
  assert.equal(g.cutscene.active, 'big');
  assert.equal(g.inputLock, 1);
  assert.deepEqual(boxes, [{ on: true }]);
  assert.deepEqual(g.hudState().tutorial, { text: 'Move with WASD', keys: ['W', 'A', 'S', 'D'] });
  assert.equal(g.camera.mode, 'free');
  seconds(g, 0.55);
  const cam = g.world.marker('cam_spot');
  assert.ok(Math.abs(g.camera.x - cam.x) < 1e-6 && Math.abs(g.camera.zoom - 1.5) < 1e-6, 'camera tweened');
  const lap = g.ops.resolveWho('laporte');
  assert.ok(lap, 'laporte spawned on demand');
  assert.equal(lap.data.scripted, true);
  seconds(g, 0.25);
  assert.equal(g.flags.par_b, true);
  seconds(g, 8);
  const clr = g.world.marker('clearing');
  assert.ok(Math.hypot(lap.x - clr.x, lap.y - clr.y) < 0.1, 'moved to clearing');
  // face, anim, then say
  assert.equal(g.modal && g.modal.type, 'dialogue');
  assert.equal(g.modal.text, 'Phone away, Robin.');
  assert.equal(g.modal.mood, 'annoyed');
  assert.equal(g.modal.portrait, 'laporte');
  assert.equal(hexes[0].data.scripted, true, '@hex faced => scripted');
  assert.equal(hexes[0].dir, 0);
  seconds(g, 3);
  assert.equal(g.modal.type, 'dialogue', 'say waits for the player');
  g.commands.dialogueAdvance();
  await flush();
  seconds(g, 0.6);
  assert.equal(g.inputLock, 1);
  g.setFlag('go', true);
  steps(g, 2);
  // control: input back, minHp set, entities unscripted
  assert.equal(g.inputLock, 0);
  assert.equal(g.player.data.minHp, 1);
  assert.equal(hexes[0].data.scripted, undefined);
  seconds(g, 1);
  assert.equal(g.inputLock, 0);
  g.player.hp = 1;
  steps(g, 2);
  assert.equal(g.inputLock, 1, 'relocked after control');
  assert.equal(hexes[0].removed, true, 'kill {tag}');
  // async op (a picker): the cutscene waits for it
  seconds(g, 1);
  assert.equal(g.flags.picked, undefined);
  pick(1);
  await flush();
  steps(g, 1);
  assert.equal(g.flags.picked, 1, '$chosen from the resolved op');
  assert.ok(g.ops.warnings.some((w) => /unknown op "setLook"/.test(w)), 'unregistered op skipped with a warning');
  seconds(g, 0.3);
  assert.equal(g.camera.mode, 'follow');
  assert.equal(g.camera.zoom, 1);
  assert.equal(g.flags.nested_ran, true);
  assert.ok(events.some((e) => e.id === 'small'));
  // escort: player far behind -> laporte waits and says "This way."
  const bubbles = collect(g, 'bubble');
  assert.equal(g.inputLock, 0, 'escort hands control to the player');
  g.player.x = lap.x; g.player.y = lap.y + 1;
  seconds(g, 1);
  assert.ok(lap.y < clr.y - 1, 'escort walks ahead');
  seconds(g, 3);
  const y1 = lap.y;
  assert.ok(Math.hypot(lap.x - g.player.x, lap.y - g.player.y) > 5);
  seconds(g, 1);
  assert.ok(Math.abs(lap.y - y1) < 1e-9, 'stopped to wait');
  assert.ok(bubbles.some((b) => b.text === 'This way.'));
  // the player walks up (scripted input, north)
  const input = scriptedInput({ moveY: -1 });
  for (let i = 0; i < 600 && g.cutscene.active; i++) {
    g.step(undefined, input.sample());
    if (g.player.y < lap.y + 1.2) input.set({ moveY: 0 });
    else input.set({ moveY: -1 });
  }
  input.set({ moveY: 0 });
  assert.equal(g.cutscene.active, null);
  const ex = g.world.marker('exit');
  assert.ok(Math.hypot(lap.x - ex.x, lap.y - ex.y) < 0.8, 'escort reached the marker');
  await p;
  assert.equal(g.flags.done, true);
  assert.equal(g.flags.cs_big, true);
  assert.equal(g.inputLock, 0);
  assert.equal(g.hudState().tutorial, null);
  assert.equal(lap.data.scripted, undefined, 'scripted cleared at the end');
  assert.equal(g.player.data.minHp, undefined, 'minHp cleared at the end');
  assert.deepEqual(boxes.at(-1), { on: false });
  assert.ok(ends.some((e) => e.id === 'big'));
});

test('cutscene: skip() fast-forwards, waits for pickers, cleans up; unskippable refuses; play while active queues', async () => {
  const { g, pick } = setup();
  const sfx = collect(g, 'sfx');
  const p = g.cutscene.play('skippy');
  const q = g.cutscene.play('small');
  assert.equal(g.cutscene.queued, 1);
  seconds(g, 1);
  assert.equal(g.cutscene.skippable, true);
  assert.equal(g.cutscene.skip(), true);
  const lap = g.ops.resolveWho('laporte');
  assert.equal(g.flags.a, true, 'state-changing ops applied');
  assert.equal(g.modal, null, 'say skipped');
  assert.equal(sfx.length, 0, 'presentation ops skipped');
  assert.equal(g.cutscene.active, 'skippy', 'waiting on the picker');
  pick('blue');
  await flush();
  steps(g, 1);
  assert.equal(g.flags.b, 'blue');
  const ex = g.world.marker('exit');
  assert.ok(Math.hypot(lap.x - ex.x, lap.y - ex.y) < 0.01, 'escort teleported to its marker');
  await p;
  assert.equal(g.inputLock, 0);
  assert.equal(g.camera.mode, 'follow');
  assert.equal(g.flags.nested_ran, true, 'queued cutscene ran after');
  await q;
  g.cutscene.play('big');
  assert.equal(g.cutscene.skip(), false, 'skippable: false is respected');
  g.cutscene.stop();
  assert.equal(g.cutscene.active, null);
  assert.equal(g.inputLock, 0);
});

test('cutscene: never deadlocks (waitFor, pending op, stuck move, control, say all time out)', async () => {
  const { g } = setup();
  const old = TIMEOUTS.op;
  TIMEOUTS.op = 3;
  g.sys.physics.moveTo = (e, x, y) => { e.data.moveTo = { x, y, speed: 0 }; };   // a mover that never arrives
  try {
    const p = g.cutscene.play('stuck');
    seconds(g, 2.1);
    assert.equal(g.flags.past_wait, true);
    seconds(g, 3.1);
    await flush(); steps(g, 1);
    assert.equal(g.flags.past_op, true);
    seconds(g, 3.1);
    assert.equal(g.flags.past_move, true);
    const lap = g.ops.resolveWho('laporte');
    const ex = g.world.marker('exit');
    assert.ok(Math.hypot(lap.x - ex.x, lap.y - ex.y) < 0.01, 'teleported on timeout');
    seconds(g, 1.1);
    assert.equal(g.modal && g.modal.type, 'dialogue');
    seconds(g, 1.1);
    await flush(); steps(g, 1);
    await p;
    assert.equal(g.flags.end, true);
    assert.equal(g.ops.warnings.filter((w) => /timed out|pending/.test(w)).length, 5);
  } finally { TIMEOUTS.op = old; }
});

test('cutscene: wait counts only while the world runs; unknown cutscene resolves; tutorial op with until', async () => {
  const { g } = setup();
  await g.cutscene.play('nope');
  const p = g.cutscene.play({ id: 'w', steps: [['wait', 1], ['flag.set', 'w1']] });
  g.openModal({ type: 'pause' });
  seconds(g, 3);
  assert.equal(g.flags.w1, undefined);
  g.closeModal();
  seconds(g, 1.05);
  await p;
  assert.equal(g.flags.w1, true);
  g.ops.run([['tutorial', 'Press E', ['E'], { until: ['flag', 'has_stick'] }]]);
  assert.equal(g.hudState().tutorial.text, 'Press E');
  g.setFlag('has_stick', true);
  steps(g, 1);
  assert.equal(g.hudState().tutorial, null);
});
