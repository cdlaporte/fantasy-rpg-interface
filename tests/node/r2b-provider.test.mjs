// Round 2, package B: answer parsing, the answer flow (session), and the Unit 4 provider without DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswer, checkAnswer } from '../../src/questions/answer.js';
import { createSession } from '../../src/questions/unit4/session.js';
import { createUnit4Provider, difficultyFor, enabledTopics, pickTopic, CONTEXT_INFO } from '../../src/questions/unit4/provider.js';
import { createRng } from '../../src/questions/unit4/rng.js';
import { generate } from '../../src/questions/unit4/generators.js';
import { TOPICS } from '../../src/questions/unit4/index.js';
import { createQuestions } from '../../src/questions/index.js';
import customProvider from '../../src/questions/custom.js';
import { QUESTION_CONTEXTS } from '../../src/contracts.js';
import config from '../../src/config.js';

test('parseAnswer: integers, negatives, decimals, fractions, x = ..., spaces, units', () => {
  const v = (s) => { const p = parseAnswer(s); return p ? p.value : null; };
  assert.equal(v('12'), 12);
  assert.equal(v('-3'), -3);
  assert.equal(v('−3'), -3, 'true minus sign');
  assert.equal(v('10.5'), 10.5);
  assert.equal(v('.5'), 0.5);
  assert.equal(v('10,5'), 10.5, 'decimal comma');
  assert.equal(v('21/2'), 10.5);
  assert.equal(v('-21/2'), -10.5);
  assert.equal(v('10 1/2'), 10.5, 'mixed number');
  assert.equal(v('x = 12'), 12);
  assert.equal(v('x=21/2'), 10.5);
  assert.equal(v('  1 2 '), 12, 'spaces ignored');
  assert.equal(v('80°'), 80);
  assert.equal(v('60 feet'), 60);
  for (const bad of ['', '   ', 'abc', '1/0', 'x =', '-', '3x', '1/2/3', null, undefined]) assert.equal(parseAnswer(bad), null, String(bad));
});

test('checkAnswer: tolerance 0.01 and exact fractions', () => {
  const q = { type: 'number', answer: 10.5, accept: { tolerance: 0.01, fraction: [21, 2] } };
  for (const s of ['10.5', '21/2', '42/4', 'x = 10.50', '10 1/2', '10.505']) assert.equal(checkAnswer(q, s).ok, true, s);
  for (const s of ['10', '10.52', '-10.5', '2/21']) assert.equal(checkAnswer(q, s).ok, false, s);
  assert.equal(checkAnswer(q, 'ten').invalid, true);
  const q2 = generate('proportion', 3, 5);
  assert.equal(checkAnswer(q2, String(q2.answer)).ok, true);
  assert.equal(checkAnswer(q2, `x = ${q2.answer}`).ok, true);
  assert.equal(checkAnswer(q2, String(q2.answer + 1)).ok, false);
});

test('session: typed answers (invalid does not count), choices, teacher mode', () => {
  const q = generate('angle_bisector', 2, 3);
  let s = createSession(q);
  assert.equal(s.phase, 'ask');
  assert.equal(s.submit(''), 'invalid');
  assert.equal(s.submit('banana'), 'invalid');
  assert.equal(s.phase, 'ask', 'still asking');
  assert.equal(s.result(), null);
  assert.equal(s.submit(String(q.answer + 3)), 'wrong');
  assert.deepEqual(s.result(), { correct: false, skipped: false });
  assert.equal(s.submit(String(q.answer)), 'ignored', 'one answer per card');
  s = createSession(q);
  assert.equal(s.submit(` x = ${q.answer} `), 'correct');
  assert.deepEqual(s.result(), { correct: true, skipped: false });

  const c = generate('similarity_proof', 2, 9);
  s = createSession(c);
  assert.equal(s.submit('1'), 'ignored');
  assert.equal(s.choose(7), 'ignored');
  assert.equal(s.choose((c.answerIndex + 1) % 4), 'wrong');
  s = createSession(c);
  assert.equal(s.choose(c.answerIndex), 'correct');

  s = createSession(q, { teacher: true });
  assert.equal(s.phase, 'teach');
  assert.deepEqual(s.result(), { correct: true, skipped: false }, 'teacher Next counts as right');
});

test('difficulty by context', () => {
  const rng = createRng(4);
  assert.equal(difficultyFor({ context: 'gate', difficulty: 3 }, rng), 2);
  const shield = new Set();
  for (let i = 0; i < 40; i++) shield.add(difficultyFor({ context: 'boss_shield', difficulty: 2 }, rng));
  assert.deepEqual([...shield].sort(), [2, 3]);
  assert.equal(difficultyFor({ context: 'boon', difficulty: 1 }, rng), 1, 'boon at level 4');
  assert.equal(difficultyFor({ context: 'boon', difficulty: 3 }, rng), 3);
  assert.equal(difficultyFor({ context: 'lesson', difficulty: 2 }, rng), 2);
  assert.equal(difficultyFor({ context: 'lesson', difficulty: 9 }, rng), 3, 'clamped');
  assert.equal(difficultyFor({ context: 'haggle', difficulty: 3 }, rng), 1);
  assert.equal(difficultyFor({ context: 'revive' }, rng), 1);
  assert.equal(difficultyFor({}, rng), 1);
  for (const ctx of QUESTION_CONTEXTS) assert.ok(CONTEXT_INFO[ctx], `context line for ${ctx}`);
});

test('topic choice: enabled topics only, no repeats of the last few', () => {
  assert.deepEqual(enabledTopics(null), TOPICS.map((t) => t.id));
  assert.deepEqual(enabledTopics([]), TOPICS.map((t) => t.id), 'nothing enabled = everything');
  assert.deepEqual(enabledTopics(['proportion', 'bogus']), ['proportion']);
  const rng = createRng(11);
  const recent = [];
  const all = TOPICS.map((t) => t.id);
  const count = {};
  for (let i = 0; i < 400; i++) {
    const t = pickTopic(all, recent, rng);
    assert.ok(!recent.slice(-3).includes(t), 'not one of the last three');
    recent.push(t);
    count[t] = (count[t] || 0) + 1;
  }
  assert.equal(Object.keys(count).length, all.length, 'every topic shows up');
  assert.equal(pickTopic(['proportion'], ['proportion'], rng), 'proportion', 'a single topic still works');
  const two = [];
  for (let i = 0; i < 20; i++) two.push(pickTopic(['proportion', 'angle_bisector'], two, rng));
  for (let i = 1; i < two.length; i++) assert.notEqual(two[i], two[i - 1], 'two topics alternate');
});

test('provider: reads Questions.topics, previews, no DOM -> skipped', async () => {
  const settings = { topics: ['angle_bisector', 'proportion'], teacher: false };
  const p = createUnit4Provider({ settings: () => settings, seed: 5 });
  assert.equal(p.id, 'unit4');
  for (let i = 0; i < 30; i++) {
    const q = p.nextQuestion({ context: 'chest', difficulty: 2 });
    assert.ok(settings.topics.includes(q.topic));
    assert.equal(q.difficulty, 2);
  }
  assert.equal(p.nextQuestion({ context: 'gate', difficulty: 3 }).difficulty, 2);
  const pv = p.preview('similarity_proof', 3, 42);
  assert.equal(pv.topic, 'similarity_proof');
  assert.deepEqual(p.nextQuestion({ context: 'gate' }), pv, 'the previewed problem comes next');
  assert.notEqual(p.nextQuestion({ context: 'gate' }).id, pv.id, 'only once');
  assert.equal(p.preview('nope', 1, 1), null);
  assert.deepEqual(await p.ask({ context: 'gate' }, null), { correct: true, skipped: true });

  // Questions.preview delegates to the active provider
  const Q = createQuestions({ mode: 'stub', provider: p });
  assert.equal(Q.preview('proportion', 1, 3).topic, 'proportion');
  Q.setProvider(null);
  assert.equal(Q.preview('proportion', 1, 3), null, 'the stub cannot preview');
});

test('custom.js installs the Unit 4 provider; only gates and boss shields block', () => {
  assert.equal(customProvider.id, 'unit4');
  const ctx = config.questions.contexts;
  const blocking = Object.keys(ctx).filter((k) => ctx[k].blocking);
  assert.deepEqual(blocking.sort(), ['boss_shield', 'gate']);
});

test('gates: a wrong rune-gate answer brings a fresh problem; a wrong chest answer does not retry', async () => {
  const { createGame } = await import('../../src/core/game.js');
  const data = (await import('../../src/data/index.js')).default;
  const { DT } = await import('../../src/contracts.js');
  const flush = () => new Promise((r) => setImmediate(r));
  const unit4 = createUnit4Provider({ settings: () => ({}), seed: 9 });
  const asked = [];
  let answers = [];
  // a provider that uses the real problem stream but answers from a script (no DOM)
  const scripted = { id: 'scripted', ask(req) { const q = unit4.nextQuestion(req); asked.push({ req: { ...req }, q }); return Promise.resolve({ correct: answers.shift(), skipped: false }); } };
  const questions = createQuestions({ mode: 'stub', provider: scripted });
  const game = createGame({ data, name: 'T', seed: 1, zone: 'test', questions });
  game.ui = null;
  const mountAll = () => { if (game.modal && game.modal.type === 'question' && game.modal.mount) game.modal.mount({}); };

  answers = [false, true];
  let res = null;
  game.gates.ask({ context: 'gate', difficulty: 2 }).then((r) => { res = r; });
  for (let i = 0; i < 600 && !res; i++) { mountAll(); game.step(DT); await flush(); }
  assert.deepEqual(res, { correct: true, skipped: false });
  assert.equal(asked.length, 2);
  assert.equal(asked[1].req.attempt, 2);
  assert.notEqual(asked[0].q.id, asked[1].q.id, 'a new problem, not the same one again');
  assert.ok(asked.every((a) => a.q.difficulty === 2), 'rune gates ask difficulty 2');

  asked.length = 0; answers = [false]; res = null;
  game.gates.ask({ context: 'chest', difficulty: 2 }).then((r) => { res = r; });
  for (let i = 0; i < 100 && !res; i++) { mountAll(); game.step(DT); await flush(); }
  assert.deepEqual(res, { correct: false, skipped: false });
  assert.equal(asked.length, 1, 'no retry outside gates and boss shields');
});
