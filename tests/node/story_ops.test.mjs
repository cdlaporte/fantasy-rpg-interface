import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, seconds, flush, collect } from './story_fixtures.test.mjs';
import { tintAmountAt, daypartAt, MAX_TINT } from '../../src/core/clock.js';

test('ops.run: sync ops return undefined; async ops make the rest wait, in order', async () => {
  const g = makeGame();
  const ops = g.ops;
  const log = [];
  let release;
  ops.register('t.log', (game, a) => { log.push(a[1]); });
  ops.register('t.async', (game, a) => new Promise((r) => { release = () => { log.push('async:' + a[1]); r(a[2]); }; }));
  assert.equal(ops.run([['t.log', 1], ['t.log', 2]]), undefined);
  assert.deepEqual(log, [1, 2]);
  log.length = 0;
  const ctx = {};
  const p = ops.run([['t.log', 'a'], ['t.async', 'x', 'picked'], ['t.log', '$chosen'], ['t.log', 'b']], ctx);
  assert.ok(p && typeof p.then === 'function', 'returns a promise');
  assert.deepEqual(log, ['a'], 'rest waits for the async op');
  await flush();
  assert.deepEqual(log, ['a']);
  release();
  await p;
  assert.deepEqual(log, ['a', 'async:x', 'picked', 'b'], '$chosen is the resolved value');
  assert.equal(ctx.chosen, 'picked');
});

test('ops: substitution, unknown ops warn once and are skipped, thrown errors never escape', () => {
  const g = makeGame({}, { name: 'Zia' });
  const ops = g.ops;
  const seen = [];
  ops.register('t.see', (game, a) => { seen.push(a.slice(1)); });
  ops.register('t.boom', () => { throw new Error('boom'); });
  const self = g.player;
  ops.run([['t.see', '{name} rocks', '$self', { text: 'hi {name}', n: 3 }, '$5', [['flag.set', 'x', '$self']]]], { self });
  assert.equal(seen[0][0], 'Zia rocks');
  assert.equal(seen[0][1], self);
  assert.deepEqual(seen[0][2], { text: 'hi Zia', n: 3 });
  assert.equal(seen[0][3], '$5', 'not an identifier: left alone');
  assert.equal(seen[0][4][0][2], '$self', 'nested op lists are substituted only when they run');
  const warns = collect(g, 'story:warn');
  ops.run([['nope', 1], ['t.see', 'after'], ['nope', 2], ['t.boom'], ['t.see', 'end']]);
  assert.deepEqual(seen.slice(1).map((s) => s[0]), ['after', 'end']);
  assert.equal(warns.filter((w) => /unknown op "nope"/.test(w.msg)).length, 1, 'warned once');
  assert.ok(warns.some((w) => /boom/.test(w.msg)));
  ops.run('not a list'); ops.run(null); ops.run([['t.see', 'single']].flat());
  assert.equal(seen.at(-1)[0], 'single', 'a single action is accepted');
});

test('ops.test: AND, flag, not, any, hour, quest, rel, hp, near, unknown counts false', () => {
  const g = makeGame();
  const ops = g.ops;
  g.setFlag('a', 2);
  assert.equal(ops.test(null), true);
  assert.equal(ops.test([]), true);
  assert.equal(ops.test(['flag', 'a']), true);
  assert.equal(ops.test([['flag', 'a', 2], ['flag', 'b']]), false);
  assert.equal(ops.test([['not', ['flag', 'b']]]), true);
  assert.equal(ops.test([['not', 'flag', 'a']]), false);
  assert.equal(ops.test([['any', ['flag', 'b'], ['flag', 'a']]]), true);
  g.clock.set(20);
  assert.equal(ops.test([['hour', 'between', 18, 6]]), true);
  assert.equal(ops.test([['hour', 'between', 8, 18]]), false);
  assert.equal(ops.test([['hour', '>=', 19]]), true);
  assert.equal(ops.test([['quest', 'nope', 'none']]), true);
  g.npc.addRel('bram', 3);
  assert.equal(ops.test([['rel', 'bram', '>=', 3]]), true);
  assert.equal(ops.test([['rel', 'bram', '>', 3]]), false);
  g.player.hp = 1; g.player.hpMax = 10;
  assert.equal(ops.test([['hp', 'player', '<=', 1]]), true);
  assert.equal(ops.test([['hp', 'player', '>=', '50%']]), false);
  assert.equal(ops.test([['near', 'player', 'start', 1]]), true);
  assert.equal(ops.test([['near', 'player', 'far', 1]]), false);
  assert.equal(ops.test([['zone', 'test']]), true);
  assert.equal(ops.test([['mystery', 1]]), false);
});

test('ops: toast / sfx / fx (at marker) / if / flag.add / wait', async () => {
  const g = makeGame();
  const toasts = collect(g, 'toast');
  const sfx = collect(g, 'sfx');
  g.ops.run([['toast', 'Hi {name}', 'good'], ['sfx', 'coin'], ['fx', { type: 'burst', at: 'far' }],
    ['if', ['flag', 'zz'], [['flag.set', 'r', 'then']], [['flag.set', 'r', 'else']]], ['flag.add', 'n', 2], ['flag.add', 'n']]);
  assert.deepEqual(toasts[0], { text: 'Hi Robin', style: 'good' });
  assert.deepEqual(sfx[0], { id: 'coin' });
  const f = g.frame(1);
  assert.equal(f.fxCount, 1);
  const far = g.world.marker('far');
  assert.equal(f.fx[0].x, far.x);
  assert.equal(g.flags.r, 'else');
  assert.equal(g.flags.n, 3);
  const p = g.ops.run([['wait', 1], ['flag.set', 'waited']]);
  seconds(g, 0.5); await flush();
  assert.equal(g.flags.waited, undefined);
  seconds(g, 0.6); await p;
  assert.equal(g.flags.waited, true);
});

test('clock: 12-minute day, hour events, ambience never dark, save/load', () => {
  const g = makeGame();
  assert.equal(Math.round(g.clock.hour), 8);
  const hours = collect(g, 'hour');
  seconds(g, 30.05);   // one game hour
  assert.equal(hours.length, 1);
  assert.equal(hours[0].hour, 9);
  for (let h = 0; h < 24; h += 0.25) {
    const a = tintAmountAt(h);
    assert.ok(a >= 0 && a <= MAX_TINT + 1e-9 && a <= 0.2 + 1e-9, 'tint bounded at ' + h + ': ' + a);
    g.clock.set(h);
    assert.ok(g.ambience.tintAmount <= 0.2 + 1e-9);
    assert.match(g.ambience.tint, /^#[0-9a-f]{6}$/);
    assert.equal(g.ambience.daypart, daypartAt(h));
  }
  g.clock.set(13);
  assert.equal(g.ambience.daypart, 'day');
  assert.equal(g.ambience.tintAmount, 0);
  g.clock.set(7);
  assert.equal(g.ambience.daypart, 'morning');
  assert.ok(g.ambience.tintAmount > 0);
  g.clock.set(19.5);
  assert.equal(g.ambience.daypart, 'evening');
  assert.ok(g.ambience.tintAmount > 0.1 && g.ambience.tintAmount <= 0.2);
  g.clock.set(23.99);
  const before = g.clock.day;
  seconds(g, 1);
  assert.equal(g.clock.day, before + 1);
  assert.ok(g.clock.hour < 1);
  const hud = g.hudState();
  assert.equal(hud.daypart, g.clock.daypart);
  assert.equal(hud.hour, g.clock.hour);
  const json = g.saveSystems();
  const g2 = makeGame();
  g2.loadSystems(json);
  assert.equal(g2.clock.hour, g.clock.hour);
  assert.equal(g2.clock.day, g.clock.day);
  // frozen world: clock stops
  const h0 = g.clock.hour;
  g.openModal({ type: 'pause' });
  seconds(g, 5);
  assert.equal(g.clock.hour, h0);
});
