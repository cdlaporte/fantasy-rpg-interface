// Shared fixtures for the story*.test.mjs files (contains no tests; named *.test.mjs only to stay inside Story-owned paths).
import { createGame } from '../../src/core/game.js';
import baseData from '../../src/data/index.js';
import { DT } from '../../src/contracts.js';
import { scriptedInput } from '../../src/platform/input.js';

export { DT, scriptedInput };

/** A W x H grass zone with a hedge border and the given markers / exits. */
export function flatZone(id, markers, extra = {}) {
  const W = extra.w || 40, H = extra.h || 30;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) r += x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : '.';
    rows.push(r);
  }
  return Object.assign({ id, name: id, palette: 'default', seed: 1, tiles: { rows, legend: { '#': 'hedge', '.': 'grass' } },
    markers }, extra);
}

export const LOOK = { rig: 'humanoid', build: 'a', skin: '#c68e62', hair: { style: 'short', color: '#222222' } };

/** createGame with fixture data merged over the real data, a physics shim, and quiet warnings. */
export function makeGame(fx = {}, opts = {}) {
  const data = Object.assign({}, baseData, {
    zones: Object.assign({}, baseData.zones, fx.zones || {}),
    npcs: Object.assign({}, baseData.npcs, fx.npcs || {}),
    dialogues: Object.assign({}, baseData.dialogues, fx.dialogues || {}),
    quests: Object.assign({}, baseData.quests, fx.quests || {}),
    cutscenes: Object.assign({}, baseData.cutscenes, fx.cutscenes || {}),
    enemies: Object.assign({}, baseData.enemies, fx.enemies || {}),
  });
  const game = createGame({ data, name: opts.name || 'Robin', seed: 3, zone: opts.zone || 'test', marker: opts.marker || 'start',
    test: true, save: opts.save, storage: opts.storage });
  game.quiet = true;
  shimPhysics(game);
  return game;
}

/**
 * Sim's contract (CONTRACTS 12a): physics.moveTo sets ent.data.moveTo, steers there, emits 'ent:arrived'.
 * The stub physics in this worktree does nothing, so integrate data.moveTo here (only when the real one is absent).
 */
export function shimPhysics(game) {
  const ph = game.sys.physics;
  if (ph.moveTo && !ph.__storyShim) return;
  ph.__storyShim = true;
  ph.moveTo = (e, x, y, o = {}) => {
    const sp = (o.speed || (e.stats && e.stats.speed) || 3) * (o.run ? 1.7 : 1);
    e.data.moveTo = { x, y, speed: sp, stopAt: o.stopAt || 0 };
    return true;
  };
  ph.stop = (e) => { delete e.data.moveTo; e.vx = 0; e.vy = 0; };
  const step = game.step;
  game.step = (dt = DT, input) => {
    step(dt, input);
    if (game.freeze.size) return;
    for (const e of game.ents.all.slice()) {
      const m = e.data && e.data.moveTo;
      if (!m || e.removed) continue;
      const dx = m.x - e.x, dy = m.y - e.y, d = Math.hypot(dx, dy);
      const s = m.speed * dt;
      if (d <= Math.max(m.stopAt, s)) {
        if (d > m.stopAt) { e.x = m.x - (dx / (d || 1)) * m.stopAt; e.y = m.y - (dy / (d || 1)) * m.stopAt; }
        delete e.data.moveTo; e.anim = 'idle';
        game.bus.emit('ent:arrived', { ent: e });
      } else { e.x += (dx / d) * s; e.y += (dy / d) * s; e.anim = 'walk'; }
    }
  };
}

export function steps(game, n, input) { for (let i = 0; i < n; i++) game.step(DT, input ? input.sample() : undefined); }
export function seconds(game, s, input) { steps(game, Math.round(s / DT), input); }
/** Let pending promise continuations run. */
export const flush = () => new Promise((r) => setImmediate(r));
export async function stepsAsync(game, n, input) { for (let i = 0; i < n; i++) { game.step(DT, input ? input.sample() : undefined); if (i % 10 === 0) await flush(); } await flush(); }

export function collect(game, evt) {
  const out = [];
  game.bus.on(evt, (p) => out.push(p));
  return out;
}
