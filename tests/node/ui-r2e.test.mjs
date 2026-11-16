// Round 2, package E: tooltip helpers, overlay head heights with the 3D model scale, the 8 player looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tipContent, tipPosition } from '../../src/ui/tooltip.js';
import { headHeight, MODEL_SCALE_3D } from '../../src/ui/worldOverlay.js';
import { PLAYER_LOOKS, LAPORTE_LOOK } from '../../src/data/looks.js';
import { buildPortrait } from '../../src/ui/portraits.js';
import { config } from '../../src/config.js';

test('tipContent normalizes strings, objects and empties', () => {
  assert.equal(tipContent(null), null);
  assert.equal(tipContent(''), null);
  assert.deepEqual(tipContent('Hi'), { title: 'Hi', tag: '', meta: [], lines: [] });
  const c = tipContent({ title: 'Blink', tag: 'Space', meta: ['Cost 15', '', 'Ready'], lines: ['Hop.', null], text: 'First.' });
  assert.deepEqual(c, { title: 'Blink', tag: 'Space', meta: ['Cost 15', 'Ready'], lines: ['First.', 'Hop.'] });
  assert.equal(tipContent({ title: '', lines: [] }), null);
});

test('tipPosition keeps the tip on screen and off the cursor', () => {
  const vw = 1366, vh = 657, w = 300, h = 120;
  for (const [mx, my] of [[10, 10], [683, 300], [1360, 650], [1366, 0], [0, 657], [700, 640]]) {
    const p = tipPosition(mx, my, w, h, vw, vh);
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + w <= vw && p.y + h <= vh, `on screen at ${mx},${my}`);
    const covers = mx >= p.x && mx <= p.x + w && my >= p.y && my <= p.y + h;
    assert.ok(!covers, `cursor not covered at ${mx},${my}`);
  }
});

test('overlay head heights follow the 3D model scale', () => {
  assert.equal(MODEL_SCALE_3D, config.modelScale);
  const v = { look: { rig: 'humanoid', size: 1 }, z: 0 };
  assert.ok(Math.abs(headHeight(v, config.modelScale) - headHeight(v) * config.modelScale) < 1e-9);
  const jump = { look: { rig: 'quadruped', size: 1 }, z: 0.5 };
  assert.ok(Math.abs(headHeight(jump, 2) - (0.95 * 2 + 0.5)) < 1e-9, 'z is not scaled');
});

test('eight player looks: 2 builds x 4 skin tones, each a portrait', () => {
  assert.equal(PLAYER_LOOKS.length, 8);
  for (const l of PLAYER_LOOKS) {
    assert.equal(l.rig, 'humanoid');
    const g = buildPortrait(l, { mood: 'calm', t: 0, bg: 'academy' });
    assert.equal(g.length, 32);
  }
  assert.equal(PLAYER_LOOKS.filter((l) => ['#7fbf6a', '#8cc77a'].includes(l.skin)).length, 2, 'two green looks (one per build)');
  assert.equal(LAPORTE_LOOK.hat.style, 'wizard');
});
