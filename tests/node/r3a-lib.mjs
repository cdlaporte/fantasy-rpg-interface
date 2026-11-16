// Round 3, package A: shared test helpers for r3a-ranks / r3a-boons (not a test file).
import { createGame } from '../../src/core/game.js';
import data from '../../src/data/index.js';
import { createQuestions } from '../../src/questions/index.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

export const CLASS_OF = { knight: 'warrior', berserker: 'warrior', battlemage: 'warrior', conjurer: 'mage', sorcerer: 'mage', monk: 'mage',
  archer: 'rogue', thief: 'rogue', ninja: 'rogue' };

/** A hero of `spec` at `level` facing a small cluster of tough, still rats to the east. */
export function hero(spec, level, boons = [], o = {}) {
  const game = createGame({ data, name: 'Ranker', seed: o.seed ?? 4, zone: 'test', marker: 'start', test: true, questions: createQuestions({ mode: 'auto' }) });
  game.setFlag('look_chosen', true);
  const pr = game.progression;
  pr.setLevel(level, { quiet: true, boons: false });
  pr.setClass(CLASS_OF[spec] || spec, { quiet: true });
  if (CLASS_OF[spec]) pr.setSpec(spec, { quiet: true });
  for (const b of boons) pr.boons.push(b);
  const p = game.player;
  p.data.minHp = 1;
  game.companions && game.companions.set([]);
  const d = o.dist ?? 1.1;
  const spots = o.spots || [[d, 0], [d + 0.6, 0.8], [d + 0.6, -0.8], [d + 1.6, 0], [d + 2.6, 0.5]];
  const foes = spots.map(([dx, dy]) => game.ents.spawn(o.kind || 'rat', p.x + dx, p.y + dy, { noAi: !o.ai, hp: o.hp ?? 99999, level }));
  const fx = new Map(), fxList = [];
  const orig = game.fx.bind(game);
  game.fx = (e) => { fx.set(e.type, (fx.get(e.type) || 0) + 1); if (fxList.length < 20000) fxList.push(Object.assign({}, e)); return orig(e); };
  const r = { dmg: 0, hits: [], projSize: 0, projs: 0, models: new Set() };
  game.bus.on('hit', (e) => { const s = e.source; if (s && (s === p || s.owner === p.id) && e.target !== p) { r.dmg += e.amount; r.hits.push(e); } });
  game.bus.on('ent:spawned', ({ ent }) => {
    if (ent.owner === p.id && ent.look && (ent.type === 'projectile' || ent.type === 'effect')) {
      r.projs++; r.models.add(ent.look.model);
      if (ent.type === 'projectile') r.projSize = Math.max(r.projSize, ent.look.size || 1);
    }
  });
  const input = scriptedInput();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  return { game, pr, p, foes, fx, fxList, r, input, step, kit: () => p.data.kit };
}

/** The scripted basic attack for the kit: hold toward the cluster (auto kits) or charge-and-release (raw kits). */
export function attackEast(h, steps = 300) {
  const { game, p, input, step } = h;
  const raw = game.kits.active(p).basicMode === 'raw';
  if (!raw) { input.set({ attackDir: 1 }); step(steps); input.set({ attackDir: -1 }); step(30); return; }
  for (let done = 0; done < steps; done += 100) {
    game.kits.setResource(p, game.kits.resource(p).max);
    input.set({ attackDir: 1 }); step(70); input.set({ attackDir: -1 }); step(30);
  }
  step(30);
}
