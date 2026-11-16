// Meta: gates + questions (modes off/auto/stub, blocking retry, freeze bookkeeping, no deadlock, gate op).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import data from '../../src/data/index.js';
import { createQuestions, Questions } from '../../src/questions/index.js';
import stubProvider from '../../src/questions/stubProvider.js';
import customProvider from '../../src/questions/custom.js';
import { DT } from '../../src/contracts.js';
import { scriptedInput } from '../../src/platform/input.js';

const flush = () => new Promise((r) => setImmediate(r));
function make(mode, provider) {
  const questions = createQuestions({ mode, provider });
  const game = createGame({ data, name: 'T', seed: 1, zone: 'test', questions });
  const log = [];
  for (const e of ['gate:ask', 'gate:result', 'gate:retry', 'modal:open', 'modal:close']) game.bus.on(e, (p) => log.push([e, p]));
  return { game, g: game.gates, questions, of: (e) => log.filter((x) => x[0] === e).map((x) => x[1]) };
}
const quietWarn = () => { const w = console.warn; console.warn = () => {}; return () => { console.warn = w; }; };

test('questions module: modes, registry, provider failures', async () => {
  assert.equal(Questions.mode, 'auto', 'shared instance defaults to auto (main.js sets it from the URL)');
  assert.equal(customProvider && customProvider.id, 'unit4', 'round 2: custom.js installs the Unit 4 provider');
  const q = createQuestions({ mode: 'off' });
  assert.deepEqual(await q.ask({}), { correct: true, skipped: true });
  q.setMode('auto');
  assert.deepEqual(await q.ask({}), { correct: true, skipped: false });
  q.setMode('stub');
  assert.deepEqual(await q.ask({}, null), { correct: true, skipped: true }, 'stub with no element (Node) skips');
  q.register({ id: 'x', ask: () => Promise.resolve({ correct: false }) });
  q.use('x');
  assert.deepEqual(await q.ask({}), { correct: false, skipped: false });
  const restore = quietWarn();
  try {
    q.setProvider({ id: 'bad', ask() { throw new Error('boom'); } });
    assert.deepEqual(await q.ask({}), { correct: true, skipped: true });
  } finally { restore(); }
  assert.equal(stubProvider.id, 'stub');
});

test('off mode: resolves at once, optional requests are skipped, no freeze or modal', async () => {
  const { game, g, of } = make('off');
  const r = await g.ask({ context: 'gate', difficulty: 2 });
  assert.deepEqual(r, { correct: true, skipped: true });
  assert.deepEqual(await g.ask({ context: 'quest_turnin', optional: true }), { correct: false, skipped: true });
  assert.equal(game.freeze.size, 0);
  assert.equal(of('modal:open').length, 0);
  assert.equal(of('gate:ask').length, 2);
  assert.equal(of('gate:result').length, 2);
});

test('auto mode: correct with no UI', async () => {
  const { game, g, of } = make('auto');
  assert.deepEqual(await g.ask({ context: 'boss_shield' }), { correct: true, skipped: false });
  assert.equal(game.modal, null);
  assert.equal(of('gate:result')[0].correct, true);
});

test('disabled context resolves at once', async () => {
  const { game, g } = make('stub');
  const ctx = game.config.questions.contexts.levelup;
  const saved = Object.assign({}, ctx);
  ctx.enabled = false;
  try {
    assert.deepEqual(await g.ask({ context: 'levelup' }), { correct: true, skipped: true });
    assert.equal(game.modal, null);
  } finally { Object.assign(ctx, saved); }
});

test('stub mode: question modal, freeze, mount -> provider, gate:result after unfreeze', async () => {
  let seenReq = null, seenEl = null, answer = null;
  const provider = { id: 'fake', ask(req, el) { seenReq = req; seenEl = el; return new Promise((r) => { answer = r; }); } };
  const { game, g, of } = make('stub', provider);
  const input = scriptedInput({ moveX: 1 });
  const p = g.ask({ context: 'gate', difficulty: 3, tags: ['angles'] });
  assert.ok(game.freeze.has('question'));
  const m = game.modal;
  assert.equal(m.type, 'question');
  assert.deepEqual([m.req.context, m.req.difficulty, m.req.tags, m.req.attempt], ['gate', 3, ['angles'], 1]);
  assert.equal(typeof m.mount, 'function');
  const x = game.player.x;
  for (let i = 0; i < 10; i++) game.step(DT, input.sample());
  assert.equal(game.player.x, x, 'world frozen');
  const el = { fake: true };
  const mounted = m.mount(el);
  assert.equal(m.mount(el), mounted, 'mounting twice asks once');
  assert.equal(seenEl, el); assert.equal(seenReq.context, 'gate');
  let freezeAtResult = null;
  game.bus.on('gate:result', () => { freezeAtResult = game.freeze.has('question'); });
  answer({ correct: true });
  assert.deepEqual(await p, { correct: true, skipped: false });
  assert.equal(game.modal, null);
  assert.equal(game.freeze.size, 0);
  assert.equal(freezeAtResult, false, 'freeze removed before gate:result');
  assert.equal(of('gate:result').length, 1);
});

test('blocking + wrong: wait retrySeconds (world frozen, no modal), ask again; non-blocking wrong resolves', async () => {
  const { game, g, of } = make('stub');
  const p = g.ask({ context: 'gate' });            // config: gate is blocking
  assert.equal(g.answer(false), true);
  assert.equal(game.modal, null);
  assert.ok(game.freeze.has('question'), 'still frozen during the wait');
  assert.equal(of('gate:retry').length, 1);
  for (let i = 0; i < 60 * 3 - 5; i++) game.step(DT);
  assert.equal(game.modal, null);
  for (let i = 0; i < 10; i++) game.step(DT);
  assert.equal(game.modal.type, 'question');
  assert.equal(game.modal.attempt, 2);
  g.answer(true);
  assert.deepEqual(await p, { correct: true, skipped: false });
  assert.equal(game.freeze.size, 0);
  // answer() during the wait answers the retry immediately
  const p2 = g.ask({ context: 'boss_shield' });
  g.answer(false);
  assert.ok(g.waiting() > 0);
  g.answer(true);
  assert.equal((await p2).correct, true);
  // non-blocking (haggle) wrong -> resolves wrong
  const p3 = g.ask({ context: 'haggle' });
  g.answer(false);
  assert.deepEqual(await p3, { correct: false, skipped: false });
  // req.blocking override
  const p4 = g.ask({ context: 'gate', blocking: false });
  g.answer(false);
  assert.equal((await p4).correct, false);
  assert.equal(game.freeze.size, 0);
});

test('queue: one question at a time, in order', async () => {
  const { game, g } = make('stub');
  const order = [];
  const a = g.ask({ context: 'gate', id: 'a' }).then((r) => order.push(['a', r.correct]));
  const b = g.ask({ context: 'haggle', id: 'b' }).then((r) => order.push(['b', r.correct]));
  assert.equal(g.pending().id, 'a');
  assert.equal(g.queued(), 1);
  g.answer(true);
  await flush();
  assert.equal(g.pending().id, 'b');
  assert.ok(game.freeze.has('question'));
  g.answer(false);
  await Promise.all([a, b]);
  assert.deepEqual(order, [['a', true], ['b', false]]);
  assert.equal(game.freeze.size, 0);
  assert.equal(g.pending(), null);
});

test('never deadlocks: external close, replaced modal, unmounted modal, mode change mid-wait', async () => {
  const restore = quietWarn();
  try {
    const { game, g } = make('stub');
    let p = g.ask({ context: 'gate' });
    game.closeModal();
    assert.deepEqual(await p, { correct: false, skipped: true });
    assert.equal(game.freeze.size, 0);
    p = g.ask({ context: 'gate' });
    game.openModal({ type: 'pause' });
    assert.deepEqual(await p, { correct: false, skipped: true });
    game.closeModal();
    // nobody mounts the modal -> skipped after mountTimeout game seconds
    p = g.ask({ context: 'gate' });
    for (let i = 0; i < 60 * 10 + 5; i++) game.step(DT);
    assert.deepEqual(await p, { correct: true, skipped: true });
    assert.equal(game.modal, null);
    // mode switched off during the retry wait
    p = g.ask({ context: 'gate' });
    g.answer(false);
    game.questions.mode = 'off';
    game.step(DT);
    assert.equal((await p).correct, true);
    assert.equal(game.freeze.size, 0);
    // provider rejects -> correct + skipped
    const q2 = make('stub', { id: 'bad', ask: () => Promise.reject(new Error('x')) });
    const p5 = q2.g.ask({ context: 'gate' });
    q2.game.modal.mount({});
    assert.deepEqual(await p5, { correct: true, skipped: true });
  } finally { restore(); }
});

test('gate op runs pass / fail branches', async () => {
  const { game, g } = make('stub');
  let r = game.ops.run([['gate', { context: 'gate', difficulty: 2 }, { pass: [['flag.set', 'opened', true]], fail: [['flag.set', 'failed', true]] }]]);
  assert.equal(game.modal.req.difficulty, 2);
  g.answer(true);
  await r;
  assert.equal(game.flags.opened, true);
  r = game.ops.run([['gate', { context: 'haggle' }, { pass: [['flag.set', 'p2', true]], fail: [['flag.set', 'f2', true]] }]]);
  g.answer(false);
  await r;
  assert.equal(game.flags.f2, true);
  assert.equal(game.flags.p2, undefined);
});

test('gates.after timers run while frozen', () => {
  const { game, g } = make('auto');
  let fired = 0;
  g.after(0.5, () => fired++);
  const cancel = g.after(0.5, () => fired += 10);
  cancel();
  game.openModal({ type: 'pause' });
  for (let i = 0; i < 31; i++) game.step(DT);
  assert.equal(fired, 1);
});
