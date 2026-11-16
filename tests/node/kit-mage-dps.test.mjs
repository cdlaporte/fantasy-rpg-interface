// Mage kits: mixed-fight DPS inside the CLASSES balance band, 3000-step no-throw fuzz with every ability and boon,
// save/load restoring a working kit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import { config } from '../../src/config.js';
import data from '../../src/data/index.js';
import { createQuestions } from '../../src/questions/index.js';
import { createRng } from '../../src/core/rng.js';
import { mk, ring, meanDps, DT } from './kit-mage-lib.test.mjs';

// Round 2 band (docs/notes/r2c.md): level 3 ~11, 5 ~19.5, 8 ~35, 10 ~47, 12 ~62 (+-15%; the CLASSES band x the power growth).
const TARGET = Object.fromEntries(Object.entries({ 3: 11, 5: 19.5, 8: 35, 10: 47, 12: 62 }).map(([k, v]) => [k, v * config.numberScale]));   // round 2 band (docs/notes/r2c.md: the CLASSES band x the +25% power-per-level growth) x number scale
const ROWS = [[null, 3], [null, 5], ['conjurer', 8], ['conjurer', 10], ['conjurer', 12], ['sorcerer', 8], ['sorcerer', 10],
  ['sorcerer', 12], ['monk', 8], ['monk', 10], ['monk', 12]];

test('mixed fight (one elite + four weak, scripted sensible play): DPS inside the CLASSES band at 3/5/8/10/12', () => {
  const table = [];
  for (const [spec, lvl] of ROWS) {
    const r = meanDps(spec, lvl);
    table.push(`${(spec || 'mage').padEnd(8)} L${String(lvl).padEnd(2)} ${r.dps.toFixed(1).padStart(5)} (target ${TARGET[lvl]}, fight ${r.secs.toFixed(1)} s)`);
    assert.ok(r.cleared >= 0.75, `${spec || 'mage'} L${lvl} clears the fight`);
    const lo = TARGET[lvl] * 0.85, hi = TARGET[lvl] * 1.15;
    assert.ok(r.dps >= lo && r.dps <= hi, `${spec || 'mage'} L${lvl} DPS ${r.dps.toFixed(1)} outside ${lo.toFixed(1)}..${hi.toFixed(1)}`);
  }
  // Specs within +-15% of each other at the same level.
  for (const lvl of [8, 10, 12]) {
    const v = ROWS.filter((r) => r[1] === lvl).map(([s]) => meanDps(s, lvl).dps);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    for (const x of v) assert.ok(Math.abs(x - mean) / mean <= 0.15, `L${lvl} spread ${v.map((n) => n.toFixed(1))}`);
  }
  console.log('# mage DPS table\n# ' + table.join('\n# '));
});

const CLASS_BOONS = ['splitting_bolts', 'blink_burst', 'frost_nova', 'arcane_orbit', 'double_blink', 'mana_surge', 'gravity_well', 'phase_shift'];
const SPEC_BOONS = { conjurer: ['pack_leader', 'soul_link', 'spirit_swap', 'echo'], sorcerer: ['wildfire', 'storm_lance', 'meteor_echo', 'quick_study'],
  monk: ['iron_skin', 'wind_step', 'dragon_wave', 'deflect_mastery'] };

for (const spec of [null, 'conjurer', 'sorcerer', 'monk']) {
  test(`fuzz: ${spec || 'mage'} L12, all boons, 3000 steps of random input against live enemies without throwing`, () => {
    const boons = CLASS_BOONS.concat(spec ? SPEC_BOONS[spec] : []);
    const ctx = mk(spec, 12, boons, { seed: 99 });
    const { game, p, input } = ctx;
    const rng = createRng(1234);
    ring(game, 6, 3, { ai: true, hp: 300 });
    ring(game, 3, 5, { ai: true, hp: 300, kind: 'goblin_scout' });
    for (let i = 0; i < 3000; i++) {
      if (i % 6 === 0) {
        const held = {};
        for (const s of ['space', 'q', 'f', 'shift']) held[s] = rng.next() < 0.15;
        input.set({ moveX: rng.next() * 2 - 1, moveY: rng.next() * 2 - 1, attackDir: rng.next() < 0.7 ? Math.floor(rng.next() * 4) : -1, held });
      }
      if (i % 400 === 0) { game.kits.setResource(p, game.kits.resource(p).max); ring(game, 3, 4, { ai: true, hp: 200 }); }
      game.step(DT, input.sample());
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'player position finite');
    }
    assert.ok(ctx.rec.dmg > 0);
    for (const e of game.ents.all) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.z || 0), 'entity ' + e.kind);
    // HUD stays sane
    const h = game.hudState();
    assert.ok(h.player.resource && h.player.resource.value >= 0);
  });
}

test('save / load of class, spec, boons and level restores a working kit', () => {
  for (const spec of ['conjurer', 'sorcerer', 'monk']) {
    const ctx = mk(spec, 12, [SPEC_BOONS[spec][0]]);
    ctx.game.sys.save.now('kitmage');
    const g2 = createGame({ data, name: 'Tester', seed: 7, zone: 'test', storage: ctx.game.storage, questions: createQuestions({ mode: 'auto' }) });
    assert.ok(g2.sys.save.restore(g2.sys.save.load('kitmage')));
    g2.step(DT);
    const p2 = g2.player;
    assert.equal(g2.kits.active(p2).id, spec);
    assert.ok(g2.progression.hasBoon(SPEC_BOONS[spec][0]));
    assert.equal(g2.hudState().basic.rank, 4);
    p2.data.minHp = 1;
    const r = g2.ents.spawn('rat', p2.x + 1, p2.y, { noAi: true, hp: 999 });
    const inp = { moveX: 0, moveY: 0, attackDir: 1, attackPressed: 1, attackReleased: -1, attackHeldT: 0,
      pressed: { space: false, q: false, f: false, shift: false }, held: { space: false, q: false, f: false, shift: false }, released: {} };
    for (let i = 0; i < 80; i++) { g2.step(DT, inp); inp.attackPressed = -1; }
    inp.attackDir = -1; inp.attackReleased = 1; g2.step(DT, inp);
    for (let i = 0; i < 40; i++) { inp.attackReleased = -1; g2.step(DT, inp); }
    assert.ok(r.hp < 999, spec + ' attacks after load');
  }
});
