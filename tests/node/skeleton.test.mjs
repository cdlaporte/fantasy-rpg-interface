// Skeleton: createGame runs under Node with the test zone; frame() and hudState() have the right shapes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import data from '../../src/data/index.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT, makeEntityView, makeFxEvent, makeHudState, makeFrameState } from '../../src/contracts.js';

const keys = (o) => Object.keys(o).sort();

test('createGame + 600 scripted steps + frame/hud shapes', () => {
  const game = createGame({ data, name: 'Tester', seed: 7, zone: 'test', marker: 'start', test: true });
  assert.equal(game.zone.id, 'test');
  assert.equal(game.player.type, 'player');
  const input = scriptedInput();
  const x0 = game.player.x;
  for (let i = 0; i < 600; i++) {
    const phase = Math.floor(i / 100) % 4;
    input.set({ moveX: [1, 0, -1, 0][phase], moveY: [0, 1, 0, -1][phase], attackDir: i % 50 < 10 ? 1 : -1 });
    if (i === 30) input.set({ pressed: { interact: true } });
    game.step(DT, input.sample());
    if (i === 99) assert.ok(game.player.x > x0 + 2, 'player moved right');
  }
  assert.equal(game.tick, 600);
  assert.ok(Math.abs(game.t - 10) < 1e-6);

  game.setViewRect({ x0: 0, y0: 0, x1: 40, y1: 30 });
  game.fx({ type: 'burst', x: 1, y: 1, ent: game.player });
  const f = game.frame(0.5);
  assert.deepEqual(keys(f), keys(makeFrameState()));
  assert.ok(f.entCount >= 1);
  assert.deepEqual(keys(f.ents[0]), keys(makeEntityView()));
  assert.equal(f.fxCount, 1);
  assert.deepEqual(keys(f.fx[0]), keys(makeFxEvent()));
  assert.equal(f.fx[0].ent, game.player.id);
  assert.equal(game.frame(1).fxCount, 0, 'fx queue drained');
  assert.equal(game.frame(1), f, 'FrameState is reused');

  const hud = game.hudState();
  assert.deepEqual(keys(hud), keys(makeHudState()));
  assert.equal(hud.abilities.length, 4);
  assert.equal(hud.items.length, 6);
  assert.equal(hud.player.name, 'Tester');
  assert.equal(hud.zoneName, 'Test Meadow');
  assert.equal(game.hudState(), hud, 'HudState is reused');
});

test('freeze skips world systems; modal and flags', () => {
  const game = createGame({ data, name: 'T', seed: 1, zone: 'test' });
  const input = scriptedInput({ moveX: 1 });
  const events = [];
  game.bus.on('modal:open', () => events.push('open'));
  game.bus.on('modal:close', (e) => events.push('close:' + e.type));
  game.openModal({ type: 'pause' });
  const x = game.player.x;
  for (let i = 0; i < 30; i++) game.step(DT, input.sample());
  assert.equal(game.player.x, x, 'frozen while a modal is open');
  game.closeModal();
  assert.deepEqual(events, ['open', 'close:pause']);
  game.setFlag('has_stick', true);
  assert.equal(game.ops.test([['flag', 'has_stick']]), true);
  game.ops.run([['flag.set', 'x', 3]]);
  assert.equal(game.flags.x, 3);
});

test('save round trip through the stub save system', () => {
  const game = createGame({ data, name: 'Saver', seed: 1, zone: 'test' });
  game.setFlag('k', 1);
  const json = game.save.now();
  const again = createGame({ data, name: 'Saver', seed: 1, storage: game.storage, save: game.save.load('Saver') });
  assert.equal(again.flags.k, 1);
  assert.equal(again.zone.id, json.zone);
});
