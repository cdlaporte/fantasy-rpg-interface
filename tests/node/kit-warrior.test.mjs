// Warrior class kit (docs/CLASSES.md WARRIOR): Rage, Sword Arc I / Heavy Hand II, Shield Bash, War Cry, 8 class boons,
// plus the shared harness (exported) used by kit-warrior-*.test.mjs: a warrior at a given level/spec/boons in the
// `test` zone facing a ring of dummies, fx/hit recorders, scripted input helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import data from '../../src/data/index.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

export const CENTER = { x: 34, y: 24.5 };
export const DIRS = [0, 1, 2, 3];

/** A warrior game. o: {spec, level, boons, ring (n dummies), r, hp, kind, ai, seed, at} */
export function mk(o = {}) {
  const game = createGame({ data, name: 'Tester', seed: o.seed ?? 7, zone: 'test' });
  const pr = game.progression;
  pr.setLevel(o.level ?? 3, { quiet: true, boons: false });
  pr.setClass('warrior', { quiet: true });
  if (o.spec) pr.setSpec(o.spec, { quiet: true });
  pr.boons = (o.boons || []).slice();
  game.setFlag('look_chosen', true);
  const p = game.player;
  p.data.minHp = 1;
  p.hp = p.hpMax;
  for (const e of game.ents.all.slice()) if (e.type === 'enemy') game.ents.remove(e);
  game.ents.flush();
  const at = o.at || CENTER;
  game.physics.teleport(p, at.x, at.y);
  const foes = [];
  const home = [];
  const n = o.ring ?? 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = o.r ?? 1.5;
    foes.push(dummy(game, at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, o.hp ?? 5000, o.kind, o.ai));
    home.push([at.x + Math.cos(a) * r, at.y + Math.sin(a) * r]);
  }
  const input = scriptedInput();
  const fx = { types: {}, list: [] };
  const f0 = game.fx.bind(game);
  game.fx = (e) => { fx.types[e.type] = (fx.types[e.type] || 0) + 1; if (fx.list.length < 5000) fx.list.push(Object.assign({}, e)); return f0(e); };
  const hits = [];
  let dealt = 0;
  game.bus.on('hit', (e) => { if (e.source === p && e.target !== p) { dealt += e.amount; hits.push({ t: e.target, amount: e.amount, tags: e.tags, element: e.element, type: e.type, crit: e.crit, dot: e.dot }); } });
  const casts = [];
  game.bus.on('ability:cast', (e) => { if (e.ent === p) casts.push(e.slot + ':' + e.id); });
  const step = (k = 1, inp) => { if (inp) input.set(inp); for (let i = 0; i < k; i++) game.step(DT, input.sample()); };
  const g = {
    game, p, pr, input, foes, fx, hits, casts, step,
    get dealt() { return dealt; },
    resetCounters() { dealt = 0; hits.length = 0; fx.types = {}; fx.list.length = 0; casts.length = 0; },
    rage() { return game.kits.resource(p).value; },
    setRage(v) { game.kits.setResource(p, v); },
    ready(slot) { return game.abilities.ready(p, slot); },
    fxOf(type) { return fx.list.filter((e) => e.type === type); },
    /** put the ring dummies back where they started (knockback pushes them away) */
    regroup() { foes.forEach((f, i) => { if (!f.removed) { game.physics.teleport(f, home[i][0], home[i][1]); f.kx = f.ky = 0; } }); },
    /** hold the attack toward each ring direction in turn for k steps (the ring is regrouped every second) */
    swing(k = 120) { for (let i = 0; i < k; i++) { if (i % 60 === 59) g.regroup(); step(1, { attackDir: DIRS[Math.floor(i / 20) % 4] }); } step(1, { attackDir: -1 }); },
    press(slot, inp) { step(1, Object.assign({ pressed: { [slot]: true } }, inp || {})); },
  };
  return g;
}
export function dummy(game, x, y, hp = 5000, kind = 'rat', ai = false) {
  const e = game.ents.spawn(kind || 'rat', x, y, ai ? { hp } : { noAi: true, hp });
  return e;
}
/** Run 600 steps of a scripted pattern; returns the harness. */
export function run600(g, fn) { for (let i = 0; i < 600; i++) fn(i); return g; }

// ---------------------------------------------------------------------------------------------------------------

test('warrior data: class, picker card, abilities, companion, look, boons', () => {
  const c = data.classes.warrior;
  assert.equal(c.color, '#e2503c');
  assert.deepEqual([c.base.hp, c.base.hpPerLevel, c.base.power, c.base.powerPerLevel, c.base.speed], [44, 9, 5, 1.3, 3.4]);
  assert.ok(c.basic.name && c.basic.icon && c.basic.desc);
  assert.deepEqual(c.abilities.map((a) => a.slot + ':' + a.id + ':' + a.unlock), ['space:shield_bash:3', 'q:war_cry:5']);
  assert.equal(c.companion.npc, 'bram');
  assert.equal(c.companion.basic.use, 'melee_arc');
  assert.equal(c.look.held.style, 'sword');
  const cls = Object.values(data.boons).filter((b) => b.class === 'warrior');
  assert.equal(cls.length, 8);
  for (const s of ['knight', 'berserker', 'battlemage']) {
    assert.equal(Object.values(data.boons).filter((b) => b.spec === s).length, 4, s);
    assert.equal(data.specs[s].from, 'warrior');
    assert.equal(data.specs[s].abilities.length, 2);
  }
  const ICONS = 'sword axe shield dash roar bolt blink nova fire frost storm meteor summon fist kick orb bow rain dagger knives roll smoke shadow shuriken coin potion bread bomb tonic charm star heart book hat cloak key rune lock up'.split(' ');
  for (const b of Object.values(data.boons).filter((x) => x.class === 'warrior' || ['knight', 'berserker', 'battlemage'].includes(x.spec))) {
    assert.ok(ICONS.includes(b.icon), b.id + ' icon');
    assert.ok(b.desc.length > 10 && b.desc.length < 100, b.id + ' desc one line');
  }
  for (const a of [...c.abilities, ...data.specs.knight.abilities, ...data.specs.berserker.abilities, ...data.specs.battlemage.abilities]) assert.ok(ICONS.includes(a.icon), a.id);
  // the class picker payload from Meta reads these
  const g = mk({ ring: 0 });
  assert.equal(g.pr.classDef('warrior').basic.name, 'Sword Arc');
  const list = g.pr.abilityList('warrior', null, false);
  assert.ok(list.some((a) => a.id === 'war_cry' && a.name === 'War Cry'));
  assert.equal(g.p.look.outfit.style, 'tunic');
  assert.equal(g.p.look.held.style, 'sword');
});

test('Rage: +6 per basic hit, +10 per hit taken, decays 5/s after 4 s out of combat', () => {
  const g = mk({ level: 3, ring: 1, r: 1.0 });
  g.step(1, { attackDir: 1 });
  g.step(1, { attackDir: -1 });
  assert.equal(g.rage(), 6, 'one swing one hit');
  g.game.combat.damage(g.p, 3, { source: g.foes[0] });
  assert.equal(g.rage(), 16);
  g.step(Math.round(3.5 / DT));
  assert.equal(g.rage(), 16, 'no decay within 4 s');
  g.step(Math.round(2 / DT));  // 5.5 s out of combat
  assert.ok(g.rage() > 7.5 && g.rage() < 9.5, 'decayed 1.5 s at 5/s: ' + g.rage());
  assert.equal(g.game.hudState().player.resource.name, 'Rage');
  assert.equal(g.game.hudState().player.resource.color, '#e2503c');
});

for (const level of [3, 5, 8, 11, 12]) {
  test(`warrior L${level}: basic rank ${level >= 4 ? 'II' : 'I'} + Shield Bash${level >= 5 ? ' + War Cry' : ''} each run 600 steps, deal damage, fire fx`, () => {
    // basic
    let g = mk({ level });
    g.swing(600);
    assert.ok(g.dealt > 0, 'basic deals damage');
    assert.ok(g.fx.types.slash > 10);
    assert.ok(g.rage() > 0, 'rage gained');
    const heavy = g.fxOf('slash').filter((e) => e.arc === 180);
    if (level >= 4) assert.ok(heavy.length > 3 && heavy.every((e) => e.color === '#f2c94c' && e.w === 2), 'heavy hand gold 180 slash');
    else assert.equal(heavy.length, 0);
    assert.equal(g.game.hudState().basic.name, level >= 4 ? 'Heavy Hand' : 'Sword Arc');
    // Shield Bash
    g = mk({ level, ring: 1, r: 2 });
    let bashes = 0;
    run600(g, (i) => {
      const dir = i % 120 < 60 ? 1 : 3;
      g.step(1, { moveX: dir === 1 ? 1 : -1, pressed: { space: i % 60 === 0 } });
      if (g.casts.length > bashes) bashes = g.casts.length;
    });
    assert.ok(bashes >= 2, 'bash cast on cooldown: ' + bashes);
    assert.ok(g.dealt > 0, 'bash damages');
    assert.ok(g.fx.types.trail >= 2 && g.fx.types.burst >= 3 && g.fx.types.hit >= 1);
    // War Cry
    if (level >= 5) {
      g = mk({ level });
      g.setRage(100);
      g.press('q');
      assert.equal(g.rage(), 70, 'War Cry costs 30 Rage');
      assert.ok(g.p.fxTags.includes('haste'));
      assert.ok(g.game.combat.mod(g.p, 'power') >= 0.3);
      assert.ok(g.foes.every((f) => f.status.slow > 0), 'enemies slowed');
      assert.ok(g.fx.types.shockwave >= 1);
      assert.equal(g.p.look.aura && g.p.look.aura.color, '#ff3b2a', 'red aura flare');
      run600(g, (i) => { if (i === 300) { g.game.abilities.reset(g.p, 'q'); g.setRage(30); } g.step(1, { attackDir: i % 4, pressed: { q: i % 30 === 0 } }); });
      assert.equal(g.casts.filter((c) => c === 'q:war_cry').length, 2, 'cooldown 12 s respected; second cast after reset');
      assert.equal(g.rage() < 30, true, 'second cast spent Rage');
      assert.ok(!g.p.fxTags.includes('haste') || g.game.combat.mod(g.p, 'power') > 0);
    }
  });
}

test('Heavy Hand: every third swing is 180 degrees, heavier (data coef), double knockback, hit-stop', () => {
  const N = data.classes.warrior.nums;
  const g = mk({ level: 4, ring: 1, r: 1.0 });
  const f = g.foes[0];
  const amounts = [];
  let stops = 0;
  g.game.bus.on('hitstop', () => stops++);
  for (let s = 0; s < 3; s++) {
    g.game.physics.teleport(f, g.p.x + 1, g.p.y); f.kx = f.ky = 0;
    const n0 = g.hits.length;
    g.step(1, { attackDir: 1 }); g.step(Math.round(0.6 / DT), { attackDir: -1 });
    amounts.push(g.hits.slice(n0).reduce((a, h) => a + h.amount, 0));
  }
  const pw = g.p.stats.power;
  assert.equal(amounts[0], Math.round(N.sword_arc.dmg * pw));
  assert.equal(amounts[2], Math.round(N.heavy_hand.dmg * pw));
  assert.ok(N.heavy_hand.knockback >= 2 * N.sword_arc.knockback);
  assert.equal(stops, 1);
  // behind-you hits only on the heavy swing (180 degrees)
  const g2 = mk({ level: 4, ring: 0 });
  const side = dummy(g2.game, g2.p.x + 0.2, g2.p.y - 1.05);
  g2.step(1, { attackDir: 1 }); g2.step(25, { attackDir: -1 });
  g2.step(1, { attackDir: 1 }); g2.step(25, { attackDir: -1 });
  const before = g2.hits.length;
  assert.equal(g2.hits.filter((h) => h.t === side).length, 0);
  g2.step(1, { attackDir: 1 }); g2.step(25, { attackDir: -1 });
  assert.ok(g2.hits.slice(before).some((h) => h.t === side), '180 arc reaches the flank');
});

test('Shield Bash: dash in the move direction, first enemy takes the bash coef + stun 0.8 + heavy knockback, +15 Rage', () => {
  const g = mk({ level: 3, ring: 0 });
  const a = dummy(g.game, g.p.x + 2, g.p.y);
  const b = dummy(g.game, g.p.x + 2.6, g.p.y);
  const x0 = g.p.x;
  g.press('space', { moveX: 1 });
  g.step(20, { moveX: 0 });
  assert.equal(g.hits.length, 1, 'only the first enemy');
  assert.equal(g.hits[0].t, a);
  assert.equal(g.hits[0].amount, Math.round(data.classes.warrior.nums.shield_bash.dmg * g.p.stats.power));
  assert.ok(a.status.stun > 0.4);
  assert.ok(a.x > b.x - 0.5 || a.x > x0 + 2.5, 'knocked back');
  assert.equal(g.rage(), 15);
  assert.ok(g.game.abilities.cdLeft(g.p, 'space') > 4);
  assert.ok(g.casts.includes('space:shield_bash'));
});

test('boon Blazing Bash: the Bash path burns (ground_fire zones)', () => {
  const run = (boons) => {
    const g = mk({ level: 4, ring: 0, boons });
    g.press('space', { moveX: 1 }); g.step(15, { moveX: 0 });
    return g.game.ents.all.filter((e) => e.type === 'effect' && e.look && e.look.model === 'ground_fire').length;
  };
  assert.equal(run([]), 0);
  assert.ok(run(['blazing_bash']) >= 3);
});

test('boon Aftershock: War Cry fires a second, larger shockwave 0.6 s later', () => {
  const run = (boons) => {
    const g = mk({ level: 5, boons, r: 4 });
    g.setRage(100); g.press('q'); g.step(Math.round(0.8 / DT));
    return { waves: g.fxOf('shockwave').map((e) => e.r), dealt: g.dealt };
  };
  const a = run([]), b = run(['aftershock']);
  assert.deepEqual(a.waves, [3]);
  assert.deepEqual(b.waves, [3, 4.5]);
  assert.equal(a.dealt, 0, 'ring at r 4 is outside the first shockwave');
  assert.ok(b.dealt > 0, 'the second shockwave reaches it');
});

test('boon Cleaving Wind: every fourth basic throws a crescent projectile (range 4)', () => {
  const run = (boons) => {
    const g = mk({ level: 3, ring: 0, boons });
    const far = dummy(g.game, g.p.x + 3.5, g.p.y);
    let crescents = 0;
    g.game.bus.on('ent:spawned', (e) => { if (e.ent.type === 'projectile' && e.ent.look.model === 'crescent') crescents++; });
    const spawned = () => g.game.ents.all.filter((e) => e.type === 'projectile' && e.look.model === 'crescent').length;
    let seen = 0;
    for (let i = 0; i < 4 * 26; i++) { g.step(1, { attackDir: 1 }); seen = Math.max(seen, spawned()); }
    g.step(30, { attackDir: -1 });
    return { seen: Math.max(seen, crescents), farHit: g.hits.some((h) => h.t === far) };
  };
  const a = run([]), b = run(['cleaving_wind']);
  assert.equal(a.seen, 0); assert.equal(a.farHit, false);
  assert.ok(b.seen >= 1); assert.equal(b.farHit, true);
});

test('boon Unstoppable: above 50 Rage immune to knockback and slows, with a glow', () => {
  const run = (boons) => {
    const g = mk({ level: 4, ring: 1, r: 1, boons });
    g.setRage(80); g.step(2);
    const x0 = g.p.x;
    g.game.physics.push(g.p, Math.PI, 30);
    g.game.combat.status(g.p, 'slow', 2, 0.5);
    g.step(10);
    return { moved: Math.abs(g.p.x - x0), slowed: g.p.status.slow > 0, glow: g.p.glow };
  };
  const a = run([]), b = run(['unstoppable']);
  assert.ok(a.moved > 1 && a.slowed && !a.glow);
  assert.ok(b.moved < 0.05 && !b.slowed && b.glow);
});

test('boon Ricochet Bash: a Bash that hits chains into a second enemy', () => {
  const run = (boons) => {
    const g = mk({ level: 4, ring: 0, boons });
    const a = dummy(g.game, g.p.x + 2, g.p.y);
    const b = dummy(g.game, g.p.x + 3, g.p.y + 3);
    g.press('space', { moveX: 1 }); g.step(40, { moveX: 0 });
    return new Set(g.hits.map((h) => h.t.id)).size;
  };
  assert.equal(run([]), 1);
  assert.equal(run(['ricochet_bash']), 2);
});

test('boon Battle Hymn: War Cry heals you and classmates 15% and hastes them', () => {
  const run = (boons) => {
    const g = mk({ level: 5, ring: 0, boons });
    g.game.companions.set(['mage']);
    const c = g.game.companions.active[0];
    g.game.physics.teleport(c, g.p.x + 1, g.p.y);
    g.p.hp = Math.round(g.p.hpMax * 0.5); c.hp = Math.round(c.hpMax * 0.5);
    g.setRage(60); g.press('q');
    return { p: g.p.hp / g.p.hpMax, c: c.hp / c.hpMax, haste: c.status.haste > 0 && g.p.status.haste > 0 };
  };
  const a = run([]), b = run(['battle_hymn']);
  assert.ok(Math.abs(a.p - 0.5) < 0.02 && !a.haste);
  assert.ok(b.p > 0.63 && b.c > 0.63 && b.haste);
});

test('boon Rage Spikes: being hit releases a spike ring (2 s internal cooldown)', () => {
  const run = (boons) => {
    const g = mk({ level: 4, ring: 4, r: 1.2, boons });
    for (let i = 0; i < 4; i++) { g.game.combat.damage(g.p, 1, { source: g.foes[0] }); g.step(Math.round(0.8 / DT)); }
    return g.dealt;
  };
  assert.equal(run([]), 0);
  const d = run(['rage_spikes']);
  const g = mk({ level: 4, ring: 4, r: 1.2 });
  assert.ok(d >= 4 * 1 && d <= 2 * 4 * Math.round(0.8 * g.p.stats.power), 'two procs in 3.2 s hitting 4 enemies: ' + d);
});

test('boon Second Wind: dropping below 25% heals 30% and knocks everything back, once per 60 s', () => {
  const run = (boons) => {
    const g = mk({ level: 4, ring: 4, r: 1.2, boons });
    const p = g.p;
    p.hp = Math.round(p.hpMax * 0.3);
    g.game.combat.damage(p, Math.round(p.hpMax * 0.1), { source: g.foes[0], raw: true });
    const first = p.hp / p.hpMax;
    g.step(10);
    const pushed = g.foes.every((f) => Math.hypot(f.x - p.x, f.y - p.y) > 1.6);
    p.hp = Math.round(p.hpMax * 0.3);
    g.game.combat.damage(p, Math.round(p.hpMax * 0.1), { source: g.foes[0], raw: true });
    return { first, pushed, second: p.hp / p.hpMax };
  };
  const a = run([]), b = run(['second_wind']);
  assert.ok(a.first < 0.25 && !a.pushed);
  assert.ok(b.first > 0.45 && b.pushed, 'healed 30% and pushed');
  assert.ok(b.second < 0.25, 'internal cooldown');
});

test('warrior look patches and level-10 flame aura; kitHud; companion Bram uses the class data', () => {
  const g = mk({ level: 10, ring: 0 });
  assert.equal(g.p.look.aura.style, 'flame');
  assert.equal(g.p.look.aura.color, '#e2503c');
  const g2 = mk({ level: 4, ring: 0 });
  g2.game.companions.set(['warrior']);
  const bram = g2.game.companions.active[0];
  assert.equal(bram.name, 'Bram');
  assert.equal(bram.look.held.style, 'sword');
  assert.equal(bram.ai.attacks.length, 2);
});
