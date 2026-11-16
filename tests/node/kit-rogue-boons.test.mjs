// Rogue boons (docs/CLASSES.md): every class boon and every Archer / Thief / Ninja boon changes behavior. Each test
// runs the same script with and without the boon and asserts the difference.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import { config } from '../../src/config.js';
import data from '../../src/data/index.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

const CX = 34, CY = 24;
function mk({ spec = null, level = 8, boons = [], seed = 5 } = {}) {
  const game = createGame({ data, name: 'Tester', seed, zone: 'test', marker: 'start' });
  const pr = game.sys.progression;
  pr.setLevel(level, { quiet: true, boons: false });
  pr.setClass('rogue', { quiet: true });
  if (spec) pr.setSpec(spec, { quiet: true });
  for (const b of boons) pr.boons.push(b);
  game.setFlag('look_chosen', true);
  for (const e of game.ents.all) if (e.type === 'enemy') game.ents.remove(e);
  game.ents.flush();
  const p = game.player;
  p.data.minHp = 1;
  game.physics.teleport(p, CX, CY);
  p.angle = 0; p.dir = 1;
  const hits = [];
  game.bus.on('hit', (e) => { if (e.source && (e.source === p || e.source.owner === p.id) && e.target !== p) hits.push(e); });
  const fxLog = [];
  const of = game.fx;
  game.fx = (e) => { fxLog.push({ type: e.type, color: e.color, r: e.r, text: e.text }); of(e); };
  const input = scriptedInput();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  const setPips = (n) => { game.kits.setResource(p, n); p.data.kit.rg.lastHitT = game.t; };
  const rat = (x, y, o = {}) => game.ents.spawn('rat', x, y, Object.assign({ noAi: true, hp: 5000, data: { kbResist: 1 } }, o));
  const attack = (dir, n = 1) => { input.set({ attackDir: dir }); step(n); input.set({ attackDir: -1 }); step(1); };
  return { game, pr, p, hits, fxLog, input, step, setPips, rat, attack };
}
/** Run fn for an env without and with the boon; returns [without, with]. */
function both(opts, boon, fn) {
  return [fn(mk(opts)), fn(mk(Object.assign({}, opts, { boons: (opts.boons || []).concat([boon]) })))];
}
const tagHits = (env, tag) => env.hits.filter((h) => h.tags && h.tags.includes(tag));

// ---------------- class boons ----------------

test('Ricochet Knives: knives bounce to a second enemy', () => {
  const [a, b] = both({ level: 5 }, 'ricochet_knives', (env) => {
    const first = env.rat(CX + 2, CY);
    const second = env.rat(CX + 2.6, CY + 2.4);
    env.input.set({ pressed: { q: true } }); env.step(60);
    return tagHits(env, 'rogue_fan').filter((h) => h.target === second).length;
  });
  assert.equal(a, 0);
  assert.ok(b >= 1, `bounced into the second rat: ${b}`);
});

test('Shadow Roll: the roll leaves smoke and enemies inside lose track of you', () => {
  const [a, b] = both({ level: 5 }, 'shadow_roll', (env) => {
    const r = env.game.ents.spawn('rat', CX + 1, CY, { hp: 5000 });
    env.step(20);
    const had = r.ai.target === env.p.id;
    env.input.set({ moveX: -1, pressed: { space: true } }); env.step(2); env.input.set({ moveX: 0 }); env.step(1);
    return { had, smoke: env.game.ents.all.some((e) => e.look && e.look.model === 'smoke'), target: r.ai.target };
  });
  assert.ok(a.had && b.had);
  assert.equal(a.smoke, false);
  assert.equal(b.smoke, true);
  assert.equal(a.target, a.target === null ? null : a.target);
  assert.equal(b.target, null, 'blinded in the smoke');
});

test('Venom Edge: hits stack venom (green fxTag) and five stacks burst', () => {
  const [a, b] = both({ level: 5 }, 'venom_edge', (env) => {
    const r = env.rat(CX + 0.9, CY);
    env.attack(1, 1);
    const tag = r.fxTags.includes('venom');
    env.input.set({ attackDir: 1 }); env.step(240); env.input.set({ attackDir: -1 }); env.step(1);
    return { tag, burst: tagHits(env, 'rogue_venom').length, dots: env.hits.filter((h) => h.dot && h.target === r).length };
  });
  assert.equal(a.tag, false); assert.equal(a.burst, 0);
  assert.equal(b.tag, true, 'venom fxTag');
  assert.ok(b.burst >= 1, 'burst at 5 stacks');
  assert.ok(b.dots > a.dots, 'venom ticks');
});

test('Roll Strike: rolling through enemies slashes them and gives a pip each', () => {
  const [a, b] = both({ level: 5 }, 'roll_strike', (env) => {
    env.rat(CX + 1.2, CY); env.rat(CX + 2.2, CY + 0.2);
    env.input.set({ moveX: 1, pressed: { space: true } }); env.step(2); env.input.set({ moveX: 0 }); env.step(20);
    return { hits: env.hits.length, pips: env.game.kits.resource(env.p).value };
  });
  assert.equal(a.hits, 0); assert.equal(a.pips, 0);
  assert.equal(b.hits, 2); assert.equal(b.pips, 2);
});

test('Blade Flurry: at 5 pips basic attacks hit in a full circle (spin slash)', () => {
  const [a, b] = both({ level: 5 }, 'blade_flurry', (env) => {
    const behind = env.rat(CX - 0.9, CY);
    env.setPips(5);
    env.attack(1, 1);
    return { behind: env.hits.filter((h) => h.target === behind).length, label: env.game.hudState().kitHud.label };
  });
  assert.equal(a.behind, 0);
  assert.equal(b.behind, 1, 'the rat behind was hit');
  assert.equal(b.label, 'Blade Flurry!');
});

test('Quick Hands: each Fan of Knives defeat refunds a pip and 2 s of cooldown', () => {
  const [a, b] = both({ level: 5 }, 'quick_hands', (env) => {
    env.rat(CX + 2, CY, { hp: 1 }); env.rat(CX + 2, CY + 0.6, { hp: 1 });
    env.input.set({ pressed: { q: true } }); env.step(40);
    return { pips: env.game.kits.resource(env.p).value, cd: env.game.abilities.cdLeft(env.p, 'q') };
  });
  assert.equal(a.pips, 0);
  assert.ok(b.pips >= 1, `refunded pips: ${b.pips}`);
  assert.ok(b.cd < a.cd - 1.9, `cooldown refunded: ${a.cd.toFixed(2)} -> ${b.cd.toFixed(2)}`);
});

test('Lucky Streak: a critical hit resets Dodge Roll and sparkles', () => {
  const [a, b] = both({ level: 5 }, 'lucky_streak', (env) => {
    env.input.set({ moveX: 1, pressed: { space: true } }); env.step(1); env.input.set({ moveX: 0 }); env.step(20);
    env.rat(env.p.x + 0.9, env.p.y);
    env.attack(1, 1);
    env.step(2);
    return { ready: env.game.abilities.ready(env.p, 'space'), lucky: env.fxLog.some((f) => f.text === 'Lucky!') };
  });
  assert.equal(a.ready, false);
  assert.equal(b.ready, true, 'roll ready again after the crit');
  assert.equal(b.lucky, true);
});

test('Boomerang Blade: every fifth attack throws a returning dagger', () => {
  const [a, b] = both({ level: 5 }, 'boomerang_blade', (env) => {
    env.rat(CX + 0.9, CY);
    const shots = [];
    const orig = env.game.combat.projectile;
    env.game.combat.projectile = (s, o) => { const e = orig(s, o); if (s === env.p) shots.push(e); return e; };
    env.input.set({ attackDir: 1 }); env.step(Math.round(1.6 / DT)); env.input.set({ attackDir: -1 }); env.step(60);
    return { shots: shots.length, returns: shots.every((s) => s.data.proj.returns), hits: tagHits(env, 'rogue_boomerang').length };
  });
  assert.equal(a.shots, 0);
  assert.ok(b.shots >= 1 && b.returns, `boomerang daggers: ${b.shots}`);
  assert.ok(b.hits >= 1);
});

// ---------------- Archer ----------------

function fullDraw(env, dir = 1) { env.input.set({ attackDir: dir }); env.step(55); env.input.set({ attackDir: -1 }); env.step(1); }

test('Split Arrow: the Power Shot splits in three after its first hit', () => {
  const [a, b] = both({ spec: 'archer' }, 'split_arrow', (env) => {
    env.rat(CX + 2, CY);
    let n = 0;
    const orig = env.game.combat.projectile;
    env.game.combat.projectile = (s, o) => { n++; return orig(s, o); };
    fullDraw(env); env.step(30);
    return n;
  });
  assert.equal(a, 1);
  assert.equal(b, 4, 'power shot + 3 split arrows');
});

test('Pinning Shot: a full draw roots the target', () => {
  const [a, b] = both({ spec: 'archer' }, 'pinning_shot', (env) => {
    const r = env.rat(CX + 3, CY);
    fullDraw(env); env.step(20);
    return r.status.root || 0;
  });
  assert.equal(a, 0);
  assert.ok(b > 1.5, `rooted ${b}`);
});

test('Rain of Fire: Arrow Rain becomes fire (ground fire, burning enemies)', () => {
  const [a, b] = both({ spec: 'archer' }, 'rain_of_fire', (env) => {
    const r = env.rat(CX + 5, CY);
    env.setPips(2);
    env.input.set({ pressed: { f: true } }); env.step(40);
    return { fire: env.game.ents.all.some((e) => e.look && e.look.model === 'ground_fire'), burn: r.status.burn > 0 };
  });
  assert.deepEqual(a, { fire: false, burn: false });
  assert.deepEqual(b, { fire: true, burn: true });
});

test('Hawk: a hawk flies with you and dives on your last target every 4 s', () => {
  const [a, b] = both({ spec: 'archer' }, 'hawk', (env) => {
    env.rat(CX + 3, CY);
    env.step(5);
    const hawk = env.game.ents.all.find((e) => e.kind === 'hawk' && !e.removed);
    env.input.set({ attackDir: 1 }); env.step(3); env.input.set({ attackDir: -1 });
    env.step(Math.round(5 / DT));
    return { hawk: !!hawk, dives: tagHits(env, 'archer_hawk').length };
  });
  assert.deepEqual(a, { hawk: false, dives: 0 });
  assert.equal(b.hawk, true);
  assert.ok(b.dives >= 1, `hawk dives: ${b.dives}`);
});

// ---------------- Thief ----------------

test('Coin Toss: picking up gold flings coins at the nearest enemy', () => {
  const [a, b] = both({ spec: 'thief' }, 'coin_toss', (env) => {
    env.rat(CX + 3, CY);
    for (let i = 0; i < 6; i++) env.game.combat.dropPickup('gold', CX + 0.5, CY, 1);
    env.step(90);
    return tagHits(env, 'thief_coin').length;
  });
  assert.equal(a, 0);
  assert.ok(b >= 1, `coins thrown: ${b}`);
});

test('Vanishing Act: a defeat from stealth resets Smoke Vanish', () => {
  const [a, b] = both({ spec: 'thief' }, 'vanishing_act', (env) => {
    const r = env.rat(CX + 0.9, CY, { hp: 2 * config.numberScale });
    env.input.set({ pressed: { f: true } }); env.step(2);
    env.attack(1, 1); env.step(2);
    return { dead: r.removed || !r.alive, ready: env.game.abilities.ready(env.p, 'f') };
  });
  assert.equal(a.dead, true); assert.equal(b.dead, true);
  assert.equal(a.ready, false);
  assert.equal(b.ready, true);
});

test('Loaded Dice: Backstabs crit x4 instead of x3 and can drop items', () => {
  const [a, b] = both({ spec: 'thief' }, 'loaded_dice', (env) => {
    const r = env.rat(CX + 0.9, CY);
    r.angle = 0;   // facing away
    let items = 0;
    const orig = env.game.combat.dropPickup;
    env.game.combat.dropPickup = (k, x, y, n, id) => { if (k === 'item') items++; return orig(k, x, y, n, id); };
    const amounts = [];
    for (let i = 0; i < 30; i++) { env.attack(1, 1); env.step(14); }
    for (const h of env.hits) if (h.target === r && h.tags && h.tags[0] === 'rogue_basic' && h.crit) amounts.push(h.amount);
    return { avg: amounts.reduce((s, x) => s + x, 0) / amounts.length, items };
  });
  assert.ok(b.avg > a.avg * 1.2, `x4 vs x3: ${a.avg.toFixed(1)} -> ${b.avg.toFixed(1)}`);
  assert.equal(a.items, 0);
  assert.ok(b.items >= 1, `items knocked loose: ${b.items}`);
});

test('Caltrop Trail: Dodge Roll scatters caltrops along its path', () => {
  const [a, b] = both({ spec: 'thief' }, 'caltrop_trail', (env) => {
    env.input.set({ moveX: 1, pressed: { space: true } }); env.step(2); env.input.set({ moveX: 0 }); env.step(25);
    return env.game.ents.all.filter((e) => e.look && e.look.model === 'caltrops').length;
  });
  assert.equal(a, 0);
  assert.equal(b, data.boons.caltrop_trail.n);
});

// ---------------- Ninja ----------------

test('Explosive Tags: the decoy burst is larger and burns', () => {
  const [a, b] = both({ spec: 'ninja' }, 'explosive_tags', (env) => {
    const far = env.game.ents.spawn('rat', CX + 6, CY, { noAi: true, hp: 5000 });
    const side = env.rat(CX, CY + 2.7);   // round 2: between the decoy burst r (2.25) and the Explosive Tags r (3.1)
    env.input.set({ pressed: { f: true } }); env.step(Math.round(2.7 / DT));
    void far;
    return { side: tagHits(env, 'ninja_decoy').filter((h) => h.target === side).length, burn: side.status.burn > 0,
      fire: env.game.ents.all.some((e) => e.look && e.look.model === 'ground_fire') };
  });
  assert.deepEqual(a, { side: 0, burn: false, fire: false });
  assert.equal(b.side, 1, 'the bigger burst reaches 2.7 tiles');
  assert.equal(b.burn, true);
  assert.equal(b.fire, true);
});

test('Blade Storm: returning shuriken orbit you for 2 s before being caught', () => {
  const [a, b] = both({ spec: 'ninja' }, 'blade_storm', (env) => {
    env.attack(1, 1); env.step(70);
    const orbit = env.game.ents.all.filter((e) => e.type === 'projectile' && !e.removed && Math.hypot(e.x - env.p.x, e.y - env.p.y) < 1.5).length;
    const caughtEarly = env.p.data.kit.nj.caught;
    env.step(Math.round(2.2 / DT));
    return { orbit, caughtEarly, caught: env.p.data.kit.nj.caught };
  });
  assert.equal(a.orbit, 0); assert.equal(a.caught, 3);
  assert.equal(b.orbit, 3, 'three shuriken circling');
  assert.equal(b.caughtEarly, 0);
  assert.equal(b.caught, 3, 'caught after the orbit');
});

test('Substitution: every 12 s the next hit is negated with a poof and a hop', () => {
  const [a, b] = both({ spec: 'ninja' }, 'substitution', (env) => {
    const r = env.game.ents.spawn('rat', CX + 3, CY, { hp: 5000 });
    const hp0 = env.p.hp;
    const x0 = env.p.x, y0 = env.p.y;
    env.game.combat.damage(env.p, 10, { source: r, type: 'melee' });
    const first = { hp: env.p.hp, moved: Math.hypot(env.p.x - x0, env.p.y - y0) };
    env.step(40);   // past the short invulnerability of the hop
    env.game.combat.damage(env.p, 10, { source: r, type: 'melee' });
    return { hp0, first, second: env.p.hp, tag: env.p.fxTags.includes('shadow') };
  });
  assert.ok(a.first.hp < a.hp0);
  assert.equal(b.first.hp, b.hp0, 'first hit negated');
  assert.ok(b.first.moved > 1.2, `reappeared ${b.first.moved.toFixed(2)} tiles away`);
  assert.ok(b.second < b.hp0, 'the next hit within 12 s lands');
});

test('Clone Mastery: clones also copy Shadow Step', () => {
  const [a, b] = both({ spec: 'ninja', level: 11 }, 'clone_mastery', (env) => {
    env.rat(CX + 3, CY); env.rat(CX - 3, CY + 1);
    env.setPips(3);
    env.input.set({ pressed: { shift: true } }); env.step(20);
    const clones = env.game.ents.all.filter((e) => e.kind === 'shadow_clone' && !e.removed);
    const pos0 = clones.map((c) => [c.x, c.y]);
    env.input.set({ pressed: { f: true } }); env.step(2);
    const moved = clones.filter((c, i) => Math.hypot(c.x - pos0[i][0], c.y - pos0[i][1]) > 1.5).length;
    return { moved, steps: env.p.data.kit.nj.cloneSteps };
  });
  assert.deepEqual(a, { moved: 0, steps: 0 });
  assert.equal(b.steps, 2);
  assert.ok(b.moved >= 1, `clones stepped: ${b.moved}`);
});
