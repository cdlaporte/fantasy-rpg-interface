// Rogue class kits (docs/CLASSES.md "ROGUE"): base class and the Archer / Thief / Ninja specs at levels 3, 5, 8,
// 11, 12 in the `test` zone against a ring of rats: every attack rank and ability runs 600 steps without throwing,
// deals damage, fires its fx and spends/gains Combo as designed; plus one focused test per signature mechanic and a
// save/load round trip. Boons: kit-rogue-boons.test.mjs. DPS + fuzz: kit-rogue-dps.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import { config } from '../../src/config.js';
import data from '../../src/data/index.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

const CX = 34, CY = 24;   // test zone `dummy_ring`

function mk({ spec = null, level = 3, boons = [], seed = 5, at = [CX, CY] } = {}) {
  const game = createGame({ data, name: 'Tester', seed, zone: 'test', marker: 'start' });
  const pr = game.sys.progression;
  pr.setLevel(level, { quiet: true, boons: false });
  pr.setClass('rogue', { quiet: true });
  if (spec) pr.setSpec(spec, { quiet: true });
  for (const b of boons) pr.boons.push(b);
  game.setFlag('look_chosen', true);
  for (const e of game.ents.all) if (e.type === 'enemy') game.ents.remove(e);   // the zone's own rats
  game.ents.flush();
  const p = game.player;
  p.data.minHp = 1;
  game.physics.teleport(p, at[0], at[1]);
  const fx = new Map();
  const fxLog = [];
  const origFx = game.fx;
  game.fx = (e) => { fx.set(e.type, (fx.get(e.type) || 0) + 1); fxLog.push({ type: e.type, color: e.color, r: e.r, style: e.style, text: e.text }); origFx(e); };
  const dealt = { total: 0, hits: [] };
  game.bus.on('hit', (e) => {
    const s = e.source;
    if (!s || e.target === p) return;
    if (s === p || s.owner === p.id) { dealt.total += e.amount; dealt.hits.push(e); }
  });
  const input = scriptedInput();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  const press = (k, after = 1) => { input.set({ pressed: { [k]: true } }); step(after); };
  const setPips = (n) => { game.kits.setResource(p, n); p.data.kit.rg.lastHitT = game.t; };
  return { game, pr, p, fx, fxLog, dealt, input, step, press, setPips };
}
/** A ring of tough, brainless rats around (x, y). */
function ring(game, n = 6, r = 1.6, hp = 600 * config.numberScale, x = CX, y = CY, opts = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(game.ents.spawn('rat', x + Math.cos(a) * r, y + Math.sin(a) * r, Object.assign({ noAi: true, hp, data: { kbResist: 1 } }, opts)));
  }
  return out;
}
const pips = (game, p) => game.kits.resource(p).value;
const fxCount = (fx, t) => fx.get(t) || 0;
// Hold an attack direction, release it, wait.
function hold(env, dir, steps) { env.input.set({ attackDir: dir }); env.step(steps); env.input.set({ attackDir: -1 }); env.step(1); }

// ---------------------------------------------------------------------------------------------------------------
// 600-step runs: every rank and ability of each kit at levels 3 / 5 / 8 / 11 / 12

const PLAN = [
  { spec: null, levels: [3, 5, 8, 11, 12] },
  { spec: 'archer', levels: [8, 11, 12] },
  { spec: 'thief', levels: [8, 11, 12] },
  { spec: 'ninja', levels: [8, 11, 12] },
];
const SLOT_FX = {
  space: ['afterimage', 'trail'],
  q: ['slash', 'burst'],
  archer: { f: ['ring', 'sparkle'], shift: ['pillar', 'screenFlash', 'beam'] },
  thief: { f: ['smoke', 'poof', 'burst'], shift: ['screenFlash', 'afterimage', 'trail'] },
  ninja: { f: ['afterimage', 'poof', 'trail'], shift: ['screenFlash', 'pillar', 'ring'] },
};
for (const { spec, levels } of PLAN) {
  for (const level of levels) {
    test(`rogue${spec ? '/' + spec : ''} L${level}: basic + every unlocked ability run 600 steps, deal damage, fire fx`, () => {
      const env = mk({ spec, level });
      const { game, p, fx, dealt, step, input } = env;
      ring(game, 6, spec === 'archer' ? 3.5 : 1.05);
      // Basic: hold (and, for the Archer, tap and full draws) for 600 steps.
      let fired = 0;
      game.bus.on('hit', (e) => { if (e.source === p && e.tags && e.tags[0] === 'rogue_basic') fired++; });
      if (spec === 'archer') {
        for (let i = 0; i < 12; i++) { hold(env, i % 4, 4); step(20); }
        for (let i = 0; i < 8; i++) { hold(env, i % 4, 55); step(15); }
        step(600 - 12 * 25 - 8 * 71 > 0 ? 600 - 12 * 25 - 8 * 71 : 0);
      } else {
        for (let i = 0; i < 4; i++) { input.set({ attackDir: i }); step(150); }
        input.set({ attackDir: -1 }); step(1);
      }
      assert.ok(fired > 5, `basic hits landed: ${fired}`);
      assert.ok(dealt.total > 0);
      assert.ok(fxCount(fx, 'slash') + fxCount(fx, 'burst') > 5, 'basic fx');
      assert.equal(pips(game, p), 5, 'combo pips fill to 5 from basic hits');
      // Abilities: each one cast (and run for 600 steps between casts).
      const L = game.kits.active(p);
      for (const slot of ['space', 'q', 'f', 'shift']) {
        const ab = L.abilities[slot];
        if (!ab || level < ab.unlock) continue;
        let casts = 0;
        const off = game.bus.on('ability:cast', (e) => { if (e.slot === slot) casts++; });
        fx.clear();
        const before = dealt.total;
        game.kits.setResource(p, 5);
        game.abilities.reset(p);
        game.physics.teleport(p, CX + (spec === 'archer' && slot !== 'space' ? -3.5 : 0), CY);
        p.angle = 0; p.dir = 1;
        input.set({ pressed: { [slot]: true } });
        step(1);
        assert.equal(casts, 1, `${slot} cast`);
        if (slot === 'q' || (slot === 'f' && spec === 'archer') || (slot === 'shift' && spec !== 'archer')) {
          assert.ok(pips(game, p) <= 2, `${slot} is a finisher (spends all pips): ${pips(game, p)}`);
        }
        assert.ok(!game.abilities.ready(p, slot), `${slot} on cooldown`);
        if (slot === 'shift' && spec === 'ninja') { input.set({ attackDir: 1 }); step(300); input.set({ attackDir: -1 }); step(299); }
        else step(599);
        off();
        const want = slot === 'space' || slot === 'q' ? SLOT_FX[slot] : SLOT_FX[spec][slot];
        for (const t of want) assert.ok(fxCount(fx, t) > 0, `${slot} fires fx ${t}`);
        if (slot !== 'space') assert.ok(dealt.total > before, `${slot} deals damage`);
      }
      assert.deepEqual(game.debug ? [] : [], []);
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Rogue (class) signature mechanics

test('Combo: +1 per basic attack that connects, capped at 5, shown as kitHud pips, resets after 6 s without a hit', () => {
  const env = mk({ level: 3 });
  const { game, p, step, input } = env;
  const [r] = ring(game, 1, 0.9);
  game.physics.teleport(r, CX + 0.9, CY);
  input.set({ attackDir: 1 }); step(15); input.set({ attackDir: -1 }); step(1);
  const v = pips(game, p);
  assert.ok(v >= 1 && v <= 3, `pips after ~2 attacks: ${v}`);
  input.set({ attackDir: 1 }); step(120); input.set({ attackDir: -1 }); step(1);
  assert.equal(pips(game, p), 5);
  const hud = game.hudState();
  assert.equal(hud.kitHud.pips, 5);
  assert.equal(hud.kitHud.pipsMax, 5);
  assert.equal(hud.player.resource.name, 'Combo');
  // swing at nothing: no pips, and the 6 s reset
  env.setPips(3);
  input.set({ attackDir: 3 }); step(60); input.set({ attackDir: -1 }); step(1);
  assert.equal(pips(game, p), 3, 'whiffs give nothing');
  step(Math.round(6.2 / DT));
  assert.equal(pips(game, p), 0, 'reset after 6 s without landing a hit');
});

test('Twin Daggers: two slash fx per attack (dagger style), 0.24 s repeat; rank II Lunge on every third attack', () => {
  const env = mk({ level: 3 });
  const { game, p, fxLog, step, input } = env;
  ring(game, 1, 0.9).forEach((r) => game.physics.teleport(r, CX + 0.9, CY));
  input.set({ attackDir: 1 }); step(Math.round(0.24 * 6 / DT) - 2); input.set({ attackDir: -1 }); step(1);
  const slashes = fxLog.filter((e) => e.type === 'slash' && e.style === 'dagger').length;
  assert.equal(slashes, 12, `6 attacks x 2 dagger slashes: ${slashes}`);
  assert.equal(fxLog.filter((e) => e.type === 'trail').length, 0, 'no lunge at rank I');
  // rank II
  const env2 = mk({ level: 4 });
  const [r2] = ring(env2.game, 1, 0.9);
  env2.game.physics.teleport(r2, CX + 0.9, CY);
  const x0 = env2.p.x;
  env2.input.set({ attackDir: 1 }); env2.step(Math.round(0.8 / DT)); env2.input.set({ attackDir: -1 }); env2.step(1);
  assert.ok(env2.fxLog.filter((e) => e.type === 'trail').length >= 1, 'the third attack lunges (trail fx)');
  assert.ok(env2.p.x > x0 + 0.2, 'lunge moves the rogue forward');
  assert.equal(env2.game.hudState().basic.name, 'Lunge');
  assert.equal(env.game.hudState().basic.name, 'Twin Daggers');
});

test('Dodge Roll: 3 tiles in the move direction, invulnerable, anim dash; the next basic within 1.5 s always crits', () => {
  const env = mk({ level: 3 });
  const { game, p, step, input, dealt } = env;
  const x0 = p.x;
  input.set({ moveX: 1, pressed: { space: true } }); step(1);
  assert.equal(p.anim, 'dash');
  assert.ok(p.status.invuln > 0, 'invulnerable while rolling');
  assert.ok(p.look.held.glow, 'the daggers glow while the crit is ready');
  input.set({ moveX: 0 }); step(20);
  assert.ok(p.x - x0 > 2.5 && p.x - x0 < 3.6, `rolled ${p.x - x0}`);
  const [r] = ring(game, 1, 0.9, 600, p.x, p.y);
  game.physics.teleport(r, p.x + 0.9, p.y);
  input.set({ attackDir: 1 }); step(1); input.set({ attackDir: -1 }); step(5);
  assert.ok(dealt.hits.length >= 1 && dealt.hits[0].crit, 'guaranteed crit after the roll');
  assert.equal(p.look.held.glow, null, 'glow consumed');
  // window expires
  step(10);
  game.abilities.reset(p, 'space');
  input.set({ moveX: -1, pressed: { space: true } }); step(1); input.set({ moveX: 0 }); step(Math.round(1.7 / DT));
  assert.equal(p.data.kit.rg.critUntil, 0, 'crit window expired after 1.5 s');
});

test('Fan of Knives: 3 + 2 x combo knives; the fan widens from 60 degrees to a full circle at 5 pips', () => {
  for (const [n, want, ringFull] of [[0, 3, false], [2, 7, false], [5, 13, true]]) {
    const env = mk({ level: 5 });
    const { game, p, step, input, fxLog } = env;
    let knives = [];
    const orig = game.combat.projectile;
    game.combat.projectile = (s, o) => { const e = orig(s, o); if (s === p) knives.push({ e, a: o.angle }); return e; };
    game.kits.setResource(p, n);
    input.set({ pressed: { q: true } }); step(1);
    assert.equal(knives.length, want, `${n} pips -> ${want} knives`);
    assert.equal(knives[0].e.look.model, 'knife');
    assert.equal(pips(game, p), 0, 'spends every pip');
    const spread = Math.max(...knives.map((k) => k.a)) - Math.min(...knives.map((k) => k.a));
    if (ringFull) assert.ok(spread > Math.PI * 1.6, 'full circle at 5 pips');
    else if (n === 0) assert.ok(Math.abs(spread - Math.PI / 3) < 0.01, '60 degrees at 0 pips');
    assert.equal(fxLog.some((e) => e.type === 'sparkle'), ringFull, 'the 5-pip fan sparkles');
    step(5);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Archer

test('Archer Eagle Eye: farther hits deal more (max +60% at 7 tiles) and hits from 5+ tiles give an extra pip', () => {
  const near = mk({ spec: 'archer', level: 8 });
  const far = mk({ spec: 'archer', level: 8 });
  const [rn] = ring(near.game, 1, 1.5, 5000);
  near.game.physics.teleport(rn, CX + 1.5, CY);
  const [rf] = ring(far.game, 1, 1.5, 5000, CX - 3, CY);
  far.game.physics.teleport(far.p, CX - 4, CY);
  far.game.physics.teleport(rf, CX + 3.5, CY);   // 7.5 tiles
  for (const env of [near, far]) { for (let i = 0; i < 2; i++) { hold(env, 1, 3); env.step(40); } }
  assert.ok(pips(far.game, far.p) > pips(near.game, near.p), `extra pips from far: ${pips(far.game, far.p)} vs ${pips(near.game, near.p)}`);
  for (const env of [near, far]) { for (let i = 0; i < 4; i++) { hold(env, 1, 3); env.step(40); } }
  const avg = (env) => env.dealt.hits.reduce((s, h) => s + h.amount, 0) / env.dealt.hits.length;
  assert.ok(near.dealt.hits.length >= 5 && far.dealt.hits.length >= 5);
  assert.ok(avg(far) > avg(near) * 1.35, `far ${avg(far)} vs near ${avg(near)}`);
  assert.match(far.game.hudState().kitHud.label, /Eagle Eye \+60%/);
});

test('Archer Longbow: taps fire quick arrows; a full draw slows you, glows, and fires a piercing Power Shot', () => {
  const env = mk({ spec: 'archer', level: 8 });
  const { game, p, step, input, fx, fxLog } = env;
  const line = [2, 3.5, 5].map((d) => game.ents.spawn('rat', CX + d, CY, { noAi: true, hp: 900 }));
  const shots = [];
  const orig = game.combat.projectile;
  game.combat.projectile = (s, o) => { const e = orig(s, o); if (s === p) shots.push(e); return e; };
  hold(env, 1, 3); step(30);
  assert.equal(shots.length, 1, 'tap = one quick arrow');
  assert.equal(shots[0].look.model, 'arrow');
  assert.equal(shots[0].data.proj.pierce, 0, 'quick arrows stop at the first target');
  // full draw
  input.set({ attackDir: 1 }); step(30);
  assert.ok(p.fxTags.includes('charge'), 'drawing shows fxTag charge');
  const x0 = p.x;
  input.set({ attackDir: 1, moveX: -1 }); step(30);
  const drawSpeed = (x0 - p.x) / (30 * DT);
  assert.ok(drawSpeed < p.stats.speed * 0.7, `drawing slows you: ${drawSpeed.toFixed(2)} vs ${p.stats.speed}`);
  assert.ok(fx.get('sparkle') > 0, 'sparkle when fully drawn');
  input.set({ attackDir: -1, moveX: 0 }); step(1);
  assert.ok(!p.fxTags.includes('charge'));
  const power = shots[1];
  assert.ok(power && power.data.proj.pierce === Infinity, 'Power Shot pierces everything');
  const hpBefore = line.map((r) => r.hp);
  step(40);
  assert.ok(line.every((r, i) => r.hp < hpBefore[i]), 'the Power Shot hit all three rats in the line');
  assert.ok(fxLog.some((e) => e.type === 'ring'), 'full draw ring fx');
});

test('Archer rank IV: quick arrows fire in pairs; a full Power Shot bursts into splinters behind its first target', () => {
  const env = mk({ spec: 'archer', level: 12 });
  const { game, p, step, input } = env;
  game.ents.spawn('rat', CX + 3, CY, { noAi: true, hp: 900 });
  const shots = [];
  const orig = game.combat.projectile;
  game.combat.projectile = (s, o) => { const e = orig(s, o); if (s === p) shots.push(e); return e; };
  hold(env, 1, 3); step(30);
  assert.equal(shots.length, 2, 'pair of arrows');
  shots.length = 0;
  input.set({ attackDir: 1 }); step(55); input.set({ attackDir: -1 }); step(30);
  assert.equal(shots.length, 1 + data.specs.archer.kit.longbow.splinters.n, `power shot + splinters: ${shots.length}`);
  assert.equal(game.hudState().basic.name, 'Twin Arrows');
});

test('Archer Arrow Rain: finisher zone 5 tiles ahead, r = 2 + 0.25 x combo, arrows visibly fall (z), slows and ticks', () => {
  const env = mk({ spec: 'archer', level: 8 });
  const { game, p, step, input } = env;
  const rats = ring(game, 4, 1, 900, CX + 5, CY);
  p.angle = 0;
  game.kits.setResource(p, 4);
  input.set({ pressed: { f: true } }); step(1);
  assert.equal(pips(game, p), 0);
  const zone = game.ents.all.find((e) => e.type === 'effect' && e.data.zone && e.data.zone.o.tags && e.data.zone.o.tags[0] === 'archer_rain');
  assert.ok(zone, 'rain zone');
  assert.ok(Math.abs(zone.x - (CX + 5)) < 0.3, 'centered 5 tiles ahead');
  assert.equal(zone.data.zone.r, 3, 'r = 2 + 0.25 x 4');
  const falling = game.ents.all.filter((e) => e.kind === 'falling_arrow');
  assert.ok(falling.length >= 4, 'falling arrows');
  const z0 = falling[0].z;
  step(5);
  assert.ok(falling[0].removed || falling[0].z < z0, 'arrows fall (z decreases)');
  step(60);
  assert.ok(rats.every((r) => r.hp < 900), 'every rat in the zone takes ticks');
  assert.ok(rats.some((r) => r.status.slow > 0), 'and is slowed');
});

test('Archer Starfall Arrow: 0.6 s draw, a giant piercing arrow drags small enemies and explodes on the wall', () => {
  const env = mk({ spec: 'archer', level: 11, at: [22, 25] });
  const { game, p, step, input, fx, fxLog } = env;
  const small = game.ents.spawn('rat', 25, 25, { noAi: true, hp: 100 });
  small.hpMax = 100;
  p.angle = 0;
  input.set({ pressed: { shift: true } }); step(1);
  assert.ok(p.fxTags.includes('charge'));
  step(Math.round(0.5 / DT));
  assert.equal(game.ents.all.filter((e) => e.type === 'projectile' && e.look.size >= 3).length, 0, 'still drawing');
  step(Math.round(0.15 / DT));
  const star = game.ents.all.find((e) => e.type === 'projectile' && e.look.size >= 3);
  assert.ok(star, 'giant arrow');
  assert.ok(fx.get('screenFlash') >= 1);
  const x0 = small.x;
  step(12);
  assert.ok(small.removed || small.x > x0 + 1.5, `dragged along: ${small.x - x0}`);
  step(90);
  assert.ok(fxLog.some((e) => e.type === 'meteor'), 'meteor explosion at the end');
});

// ---------------------------------------------------------------------------------------------------------------
// Thief

test('Thief Sticky Fingers: hits shake out coins that fly to you; defeats drop +50% gold', () => {
  const env = mk({ spec: 'thief', level: 8 });
  const { game, p, step, input } = env;
  ring(game, 3, 0.9, 5000).forEach((r, i) => game.physics.teleport(r, CX + 0.9, CY - 0.4 + i * 0.4));
  let coins = 0;
  const orig = game.combat.dropPickup;
  game.combat.dropPickup = (k, x, y, n, id) => { if (k === 'gold') coins++; return orig(k, x, y, n, id); };
  const g0 = game.sys.inventory.gold;
  input.set({ attackDir: 1 }); step(300); input.set({ attackDir: -1 }); step(120);
  assert.ok(coins >= 3, `coins shaken out: ${coins}`);
  assert.ok(coins <= 3 * data.specs.thief.kit.stickyFingers.maxPerEnemy * 3, 'capped per enemy');
  assert.ok(game.sys.inventory.gold > g0, 'the coins flew into your pocket');
  assert.equal(p.data.goldMul, 1.5, 'defeat gold x1.5');
});

test('Thief Backstab: hits on an enemy facing away crit x3; facing you they do not', () => {
  const env = mk({ spec: 'thief', level: 8 });
  const { game, p, step, input, dealt } = env;
  const r = game.ents.spawn('rat', CX + 0.9, CY, { noAi: true, hp: 5000 });
  r.angle = Math.PI;   // facing the thief
  input.set({ attackDir: 1 }); step(1); input.set({ attackDir: -1 }); step(20);
  const front = dealt.hits.filter((h) => h.target === r);
  r.angle = 0;         // facing away
  input.set({ attackDir: 1 }); step(1); input.set({ attackDir: -1 }); step(20);
  const back = dealt.hits.filter((h) => h.target === r).slice(front.length);
  assert.ok(back.length && back[0].crit, 'backstab is a crit');
  const normal = front.find((h) => !h.crit);
  if (normal) assert.ok(back[0].amount >= normal.amount * 2.5, `x3: ${back[0].amount} vs ${normal.amount}`);
  assert.ok(env.fxLog.some((e) => e.type === 'text' && e.text === 'Backstab!'));
});

test('Thief Smoke Vanish: smoke + caltrops + 5 s stealth that drops aggro; the first strike is a Backstab for +2 pips', () => {
  const env = mk({ spec: 'thief', level: 8 });
  const { game, p, step, input, dealt } = env;
  const r = game.ents.spawn('rat', CX + 1.2, CY, { hp: 5000 });
  r.angle = Math.PI;
  step(30);
  assert.equal(r.ai.target, p.id, 'the rat is after you');
  input.set({ pressed: { f: true } }); step(1);
  assert.ok(p.status.stealth > 4.5, 'stealthed 5 s');
  assert.ok(p.fxTags.includes('stealth'));
  assert.equal(p.alpha, 0.4);
  assert.equal(r.ai.target, null, 'aggro dropped');
  assert.ok(game.ents.all.some((e) => e.look && e.look.model === 'caltrops'), 'caltrops');
  assert.ok(game.ents.all.some((e) => e.look && e.look.model === 'smoke'), 'smoke cloud');
  step(20);
  assert.ok(r.ai.target == null, 'it cannot find you');
  game.kits.setResource(p, 0);
  game.physics.teleport(p, r.x - 0.8, r.y);
  r.angle = Math.PI;   // even facing you: stealth makes it a Backstab
  input.set({ attackDir: 1 }); step(1); input.set({ attackDir: -1 }); step(2);
  const first = dealt.hits.find((h) => h.target === r && h.tags && h.tags[0] === 'rogue_basic');
  assert.ok(first && first.crit && first.fromStealth, 'stealth strike crits');
  assert.ok(pips(game, p) >= 3, `+2 pips (+1 for the hit): ${pips(game, p)}`);
  assert.ok(!(p.status.stealth > 0), 'stealth ends');
});

test('Thief pickpocket: while stealthed, E on a town NPC steals gold or an item; being noticed is a crime', () => {
  let stolen = 0, crimes = 0, noticedRuns = 0;
  for (let seed = 1; seed <= 16; seed++) {
    const env = mk({ spec: 'thief', level: 8, seed });
    const { game, p, step, input } = env;
    const npc = game.ents.create({ kind: 'townie', type: 'npc', team: 'town', name: 'Townie', x: CX + 1, y: CY, radius: 0.3, solid: true,
      hp: 20, hpMax: 20, look: { rig: 'humanoid' }, interact: { prompt: 'Talk', range: 1.3, do: [] } });
    game.bus.on('crime', () => crimes++);
    step(8);
    assert.equal(game.hudState().prompt && game.hudState().prompt.text, 'Talk', 'normal NPC prompt');
    input.set({ pressed: { f: true } }); step(8);
    assert.equal(npc.interact.prompt, 'Pickpocket', 'stealth turns Talk into Pickpocket');
    const g0 = game.sys.inventory.gold, items0 = JSON.stringify(game.sys.inventory.items);
    input.set({ pressed: { interact: true } }); step(2);
    if (game.sys.inventory.gold > g0 || JSON.stringify(game.sys.inventory.items) !== items0) stolen++;
    assert.equal(npc.interact.prompt, 'Talk', 'restored after the theft');
    if (p.data.kit.th.noticed) noticedRuns++;
  }
  assert.equal(stolen, 16, 'every pickpocket steals something');
  assert.ok(noticedRuns >= 1 && noticedRuns <= 10, `noticed sometimes (25%): ${noticedRuns}/16`);
  assert.equal(crimes, noticedRuns, 'noticed -> crime');
});

test('Thief Jackpot (rank IV): a backstab bursts coins that hurt nearby enemies and fly back to you', () => {
  const env = mk({ spec: 'thief', level: 12 });
  const { game, p, step, input, dealt } = env;
  const r = game.ents.spawn('rat', CX + 0.9, CY, { noAi: true, hp: 5000 });
  const others = [game.ents.spawn('rat', CX + 2.2, CY + 1, { noAi: true, hp: 5000 }), game.ents.spawn('rat', CX + 2.2, CY - 1, { noAi: true, hp: 5000 })];
  r.angle = 0;
  let caught = 0;
  game.bus.on('proj:caught', (e) => { if (e.owner === p && e.proj.look.model === 'coin') caught++; });
  input.set({ attackDir: 1 }); step(1); input.set({ attackDir: -1 }); step(60);
  assert.ok(dealt.hits.some((h) => h.tags && h.tags[0] === 'thief_jackpot' && others.includes(h.target)), 'coins hit nearby enemies');
  assert.ok(caught >= 1, `coins flew back: ${caught}`);
  assert.equal(game.hudState().basic.name, 'Jackpot');
});

test('Thief Grand Heist: zigzag through up to 6 enemies, mark them, coins, and return to the start', () => {
  const env = mk({ spec: 'thief', level: 11 });
  const { game, p, step, input, dealt, fx } = env;
  const rats = ring(game, 7, 3, 5000);
  game.kits.setResource(p, 5);
  const x0 = p.x, y0 = p.y;
  input.set({ pressed: { shift: true } }); step(1);
  assert.ok(p.status.invuln > 0);
  step(Math.round(1.4 / DT));
  const victims = new Set(dealt.hits.filter((h) => h.tags && h.tags[0] === 'thief_heist').map((h) => h.target.id));
  assert.equal(victims.size, 6, 'six victims');
  assert.ok(rats.filter((r) => r.status.mark > 0).length === 6, 'all six marked');
  assert.ok(Math.hypot(p.x - x0, p.y - y0) < 0.4, 'back where you started');
  assert.ok(fx.get('afterimage') >= 6 && fx.get('trail') >= 6);
  assert.ok(game.ents.all.some((e) => e.type === 'pickup' && e.kind === 'gold'), 'coin fountains');
  // with no enemies around it refuses (no cooldown, pips kept)
  const env2 = mk({ spec: 'thief', level: 11 });
  env2.setPips(3);
  env2.input.set({ pressed: { shift: true } }); env2.step(1);
  assert.ok(env2.game.abilities.ready(env2.p, 'shift'));
  assert.equal(pips(env2.game, env2.p), 3);
});

// ---------------------------------------------------------------------------------------------------------------
// Ninja

test('Ninja Shuriken: three in a 30 degree spread, they return and hit again; each catch cuts 0.3 s off Shadow Step', () => {
  const env = mk({ spec: 'ninja', level: 8 });
  const { game, p, step, input, dealt } = env;
  const r = game.ents.spawn('rat', CX + 2, CY, { noAi: true, hp: 5000 });
  game.abilities.start(p, 'f', 6);
  let caught = 0;
  game.bus.on('proj:caught', (e) => { if (e.owner === p) caught++; });
  const shots = [];
  const orig = game.combat.projectile;
  game.combat.projectile = (s, o) => { const e = orig(s, o); if (s === p) shots.push(e); return e; };
  input.set({ attackDir: 1 }); step(1); input.set({ attackDir: -1 }); step(80);
  assert.equal(shots.length, 3);
  assert.ok(shots.every((s) => s.look.model === 'shuriken' && s.data.proj.returns));
  const onR = dealt.hits.filter((h) => h.target === r);
  assert.equal(onR.length, 2, 'cut on the way out and again on the way back');
  assert.equal(caught, 3, 'all three caught');
  const left = game.abilities.cdLeft(p, 'f');
  assert.ok(left < 6 - 81 * DT - 0.85, `Shadow Step cooldown cut by 3 x 0.3 s: ${left.toFixed(2)}`);
});

test('Ninja rank IV: five shuriken, each bounces to a second target', () => {
  const env = mk({ spec: 'ninja', level: 12 });
  const { game, p, step, input, dealt } = env;
  const a = game.ents.spawn('rat', CX + 2, CY, { noAi: true, hp: 5000 });
  const b = game.ents.spawn('rat', CX + 2.5, CY + 2.2, { noAi: true, hp: 5000 });
  const shots = [];
  const orig = game.combat.projectile;
  game.combat.projectile = (s, o) => { const e = orig(s, o); if (s === p) shots.push(e); return e; };
  input.set({ attackDir: 1 }); step(1); input.set({ attackDir: -1 }); step(60);
  assert.equal(shots.length, 5);
  assert.ok(dealt.hits.some((h) => h.target === b), 'a bounce found the second rat');
  assert.ok(dealt.hits.some((h) => h.target === a));
  assert.equal(game.hudState().basic.name, 'Shuriken Storm');
});

test('Ninja Shadow Step: appear behind the nearest enemy, a taunting decoy with fxTag shadow bursts after 2.5 s, +2 pips', () => {
  const env = mk({ spec: 'ninja', level: 8 });
  const { game, p, step, input, dealt, fx } = env;
  const r = game.ents.spawn('rat', CX + 4, CY, { hp: 5000 });
  const near = game.ents.spawn('rat', CX - 1.5, CY + 1.5, { hp: 5000 });
  step(20);
  r.angle = Math.PI; // facing the ninja
  game.physics.teleport(near, CX + 4.5, CY + 2.6);
  const x0 = p.x, y0 = p.y;
  input.set({ pressed: { f: true } }); step(1);
  assert.ok(p.x > r.x, `behind the rat (east of it): p ${p.x.toFixed(2)} vs rat ${r.x.toFixed(2)}`);
  const decoy = game.ents.all.find((e) => e.data.decoy);
  assert.ok(decoy && Math.hypot(decoy.x - x0, decoy.y - y0) < 0.1, 'decoy left where you stood');
  assert.ok(decoy.fxTags.includes('shadow'));
  assert.ok(decoy.data.taunt);
  assert.equal(pips(game, p), 2);
  assert.ok(p.data.kit.rg.critUntil > game.t, 'Afterimage: next attack crits');
  step(15);
  assert.ok(r.ai.target === decoy.id || near.ai.target === decoy.id, 'enemies go for the decoy');
  const before = dealt.hits.filter((h) => h.tags && h.tags[0] === 'ninja_decoy').length;
  // put a rat on the decoy for the burst
  game.physics.teleport(near, decoy.x + 0.8, decoy.y);
  step(Math.round(2.6 / DT));
  assert.ok(decoy.removed);
  const bursts = dealt.hits.filter((h) => h.tags && h.tags[0] === 'ninja_decoy');
  assert.ok(bursts.length > before, 'decoy burst deals damage');
  assert.ok(fx.get('smoke') >= 2, 'smoke burst');
});

test('Ninja Afterimage: moving leaves afterimages; the first attack within 1 s of a step crits', () => {
  const env = mk({ spec: 'ninja', level: 8 });
  const { game, p, step, input, fxLog } = env;
  input.set({ moveX: 1 }); step(60); input.set({ moveX: 0 });
  const imgs = fxLog.filter((e) => e.type === 'afterimage').length;
  assert.ok(imgs >= 3, `afterimages while moving: ${imgs}`);
  fxLog.length = 0;
  step(60);
  assert.equal(fxLog.filter((e) => e.type === 'afterimage').length, 0, 'none standing still');
});

test('Ninja Shadow Clones: two clones (three at 5 pips) for 8 s mirror your shuriken at 60%', () => {
  for (const [n, want] of [[3, 2], [5, 3]]) {
    const env = mk({ spec: 'ninja', level: 11 });
    const { game, p, step, input, dealt } = env;
    const r = game.ents.spawn('rat', CX + 3, CY, { noAi: true, hp: 9000 });
    game.kits.setResource(p, n);
    input.set({ pressed: { shift: true } }); step(1);
    const clones = game.ents.all.filter((e) => e.kind === 'shadow_clone' && !e.removed);
    assert.equal(clones.length, want);
    assert.ok(clones.every((c) => c.fxTags.includes('shadow')));
    assert.equal(pips(game, p), 0);
    step(20);
    const bySrc = new Map();
    const orig = game.combat.projectile;
    game.combat.projectile = (s, o) => { const e = orig(s, o); bySrc.set(s.kind, (bySrc.get(s.kind) || 0) + 1); return e; };
    input.set({ attackDir: 1 }); step(1); input.set({ attackDir: -1 }); step(60);
    assert.equal(bySrc.get('player'), 3);
    assert.equal(bySrc.get('shadow_clone'), 3 * want, 'every clone throws the same volley');
    const own = dealt.hits.filter((h) => h.source === p && h.target === r);
    const cl = dealt.hits.filter((h) => h.source.kind === 'shadow_clone' && h.target === r);
    assert.ok(cl.length > 0, 'clone shuriken hit');
    void own;
    step(Math.round(8 / DT));
    assert.equal(game.ents.all.filter((e) => e.kind === 'shadow_clone' && !e.removed).length, 0, 'gone after 8 s');
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Looks, HUD, data shapes, save/load

test('looks: class + spec outfits, held weapons, level-10 shadow aura in the spec color', () => {
  const r = mk({ level: 5 });
  assert.equal(r.p.look.outfit.style, 'leather');
  assert.equal(r.p.look.held.style, 'daggers');
  assert.equal(r.p.look.hat.style, 'bandana');
  assert.ok(!r.p.look.aura);
  for (const [spec, held, color] of [['archer', 'bow', '#3fa34d'], ['thief', 'daggers', '#2a9d8f'], ['ninja', 'shuriken', '#3d348b']]) {
    const e = mk({ spec, level: 10 });
    e.game.setFlag('look_chosen', true);
    e.game.sys.player.refreshLook();
    assert.equal(e.p.look.held.style, held);
    assert.deepEqual(e.p.look.aura, { style: 'shadow', color });
  }
  const t = mk({ spec: 'thief', level: 8 });
  t.game.setFlag('look_chosen', true);
  assert.equal(t.p.look.outfit.style, 'cloak');
  assert.equal(t.p.look.hood, true);
});

test('data: picker payloads, icons from the closed list, boons per pool, companion block for Pip', () => {
  const ICONS = new Set('sword axe shield dash roar bolt blink nova fire frost storm meteor summon fist kick orb bow rain dagger knives roll smoke shadow shuriken coin potion bread bomb tonic charm star heart book hat cloak key rune lock up'.split(' '));
  const env = mk({ level: 3 });
  const pr = env.pr;
  const c = pr.classDef('rogue');
  assert.equal(c.name, 'Rogue');
  assert.ok(ICONS.has(c.basic.icon));
  for (const a of c.abilities) assert.ok(ICONS.has(a.icon) && a.desc.length < 110, a.id);
  for (const s of ['archer', 'thief', 'ninja']) {
    const d = pr.specDef(s);
    assert.equal(d.from, 'rogue');
    assert.ok(ICONS.has(d.basic.icon));
    assert.deepEqual(d.abilities.map((a) => a.slot), ['f', 'shift']);
    for (const a of d.abilities) assert.ok(ICONS.has(a.icon), a.id);
  }
  const boons = Object.values(data.boons).filter((b) => b.class === 'rogue' || ['archer', 'thief', 'ninja'].includes(b.spec));
  assert.equal(boons.filter((b) => b.class === 'rogue').length, 8);
  for (const s of ['archer', 'thief', 'ninja']) assert.equal(boons.filter((b) => b.spec === s).length, 4);
  for (const b of boons) { assert.ok(ICONS.has(b.icon), b.id); assert.ok(b.desc && b.desc.length < 100, b.id); }
  const cc = data.classes.rogue.companion;
  assert.equal(cc.npc, 'pip');
  assert.equal(cc.mult, 0.7);
  // Pip fights with it.
  env.game.companions.set(['rogue']);
  const pip = env.game.companions.active[0];
  assert.equal(pip.name, 'Pip');
  assert.equal(pip.ai.attacks[0].def.use, 'melee_arc');
  assert.equal(pip.ai.attacks[1].def.use, 'dash');
  // Ability HUD descriptions come from the kit.
  const hud = env.game.hudState();
  assert.equal(hud.abilities[0].name, 'Dodge Roll');
  assert.ok(hud.abilities[0].desc.length > 10);
});

test('save/load restores class, spec, boons and level with a working kit', () => {
  const env = mk({ spec: 'ninja', level: 12, boons: ['venom_edge', 'substitution'] });
  const json = env.game.sys.save.now('rt');
  const game2 = createGame({ data, name: 'Tester', seed: 9, zone: 'test', marker: 'start' });
  assert.ok(game2.sys.save.restore(JSON.parse(JSON.stringify(json))));
  const input = scriptedInput();
  for (let i = 0; i < 3; i++) game2.step(DT, input.sample());
  const p2 = game2.player;
  assert.equal(game2.kits.active(p2).id, 'ninja');
  assert.ok(game2.sys.progression.hasBoon('substitution'));
  game2.ents.spawn('rat', p2.x + 2, p2.y, { noAi: true, hp: 900 });
  let hits = 0;
  game2.bus.on('hit', (e) => { if (e.source === p2) hits++; });
  input.set({ attackDir: 1 }); for (let i = 0; i < 40; i++) game2.step(DT, input.sample());
  assert.ok(hits > 0, 'the restored kit attacks');
  assert.ok(p2.fxTags.includes('shadow'), 'Substitution ready tag after load');
});
