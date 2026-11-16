// Round 3, package A: levels 13-20 everywhere (level up / down, teacher tools, saves, HUD, xp bar), boons at 14/16/18/20,
// rank V at 16, the empowered aura at 14, boon offers that stay 3 through level 20, save/load at level 20.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import data from '../../src/data/index.js';
import { config } from '../../src/config.js';
import { createQuestions } from '../../src/questions/index.js';
import { createMemoryStorage } from '../../src/platform/storage.js';
import { xpNext, BOON_LEVELS, EMPOWER_LEVEL, RANK_LEVELS } from '../../src/core/progression.js';

const SPECS = { warrior: ['knight', 'berserker', 'battlemage'], mage: ['conjurer', 'sorcerer', 'monk'], rogue: ['archer', 'thief', 'ninja'] };
const CLASS_OF = {};
for (const c in SPECS) for (const s of SPECS[c]) CLASS_OF[s] = c;

function make(o = {}) {
  const game = createGame({ data, name: o.name || 'Hero', seed: o.seed ?? 5, zone: 'test', test: true, storage: o.storage || createMemoryStorage(),
    questions: createQuestions({ mode: 'auto' }) });
  game.setFlag('look_chosen', true);
  game.teacher = !!o.teacher;
  const log = [];
  for (const e of ['levelup', 'level:set', 'rank:up', 'rank:down', 'boons:removed', 'aura:empowered', 'toast']) game.bus.on(e, (p) => log.push([e, p]));
  return { game, pr: game.progression, p: game.player, of: (e) => log.filter((x) => x[0] === e).map((x) => x[1]) };
}

test('the cap is 20; boon levels run to 20; rank V at 16', () => {
  assert.equal(config.levelCap, 20);
  assert.deepEqual(BOON_LEVELS, [4, 6, 8, 10, 12, 14, 16, 18, 20]);
  assert.deepEqual(RANK_LEVELS, [1, 4, 8, 12, 16]);
  assert.equal(EMPOWER_LEVEL, 14);
  // the xp curve keeps growing past 10 (round 3 late multiplier) and is continuous at 10
  for (let l = 1; l < 20; l++) assert.ok(xpNext(l + 1) > xpNext(l), 'xpNext grows at ' + l);
});

test('levels 13-20 one at a time: stats grow, boons queue at 14/16/18/20, rank V at 16, empowered aura at 14, toasts', () => {
  const { game, pr, p, of } = make();
  pr.setClass('warrior', { quiet: true });
  pr.setLevel(12, { quiet: true });
  pr.setSpec('knight', { quiet: true });
  const before = pr.pendingBoons;
  let hp = p.hpMax, pw = p.stats.power, def = p.stats.defense;
  for (let L = 13; L <= 20; L++) {
    pr.addXp(pr.xpNext - pr.xp);
    assert.equal(pr.level, L);
    assert.ok(p.hpMax > hp && p.stats.power > pw, 'hp and power grow at ' + L);
    assert.ok(p.stats.defense > def, 'late toughness grows at ' + L);
    hp = p.hpMax; pw = p.stats.power; def = p.stats.defense;
    assert.equal(p.hp, p.hpMax, 'full heal');
    assert.ok(of('toast').some((t) => t.text === `Level ${L}!`));
  }
  assert.equal(pr.pendingBoons - before, 4, 'boons at 14, 16, 18, 20');
  assert.deepEqual(of('rank:up').at(-1), { rank: 5, prev: 4 });
  assert.equal(pr.rank(), 5);
  assert.equal(of('aura:empowered').length, 1);
  assert.ok(of('toast').some((t) => /aura/i.test(t.text)), 'the empowered aura is announced');
  // at the cap: xp bar full, no more levels
  assert.equal(pr.addXp(1e6), 0);
  assert.equal(pr.level, 20);
  assert.equal(pr.xp, pr.xpNext);
  const hud = game.hudState();
  assert.equal(hud.player.level, 20);
  assert.equal(hud.player.xp, hud.player.xpNext);
  assert.equal(hud.basic.rank, 5);
  assert.equal(hud.basic.name, 'Twin Dawn');
});

test('empowered aura: from level 14 the aura is brighter (tier 2) and the weapon glows; it goes away below 14', () => {
  for (const cls of ['warrior', 'mage', 'rogue']) {
    const { game, pr, p } = make();
    pr.setClass(cls, { quiet: true });
    pr.setLevel(13, { quiet: true });
    pr.setSpec(SPECS[cls][1], { quiet: true });
    const a13 = Object.assign({}, p.look.aura);
    assert.ok(a13.style && a13.tier !== 2, cls + ': plain aura at 13');
    const rev = p.lookRev;
    pr.setLevel(14);
    assert.ok(p.lookRev > rev, 'look refreshed');
    assert.equal(p.look.aura.tier, 2, cls + ': tier 2');
    assert.equal(p.look.aura.empowered, true);
    assert.notEqual(p.look.aura.color, a13.color, 'brighter color');
    assert.ok(p.look.held.glow, 'the weapon glows');
    // refreshes keep it (no double brightening)
    const c14 = p.look.aura.color;
    game.sys.player.refreshLook();
    assert.equal(p.look.aura.color, c14);
    pr.setLevel(12);
    assert.ok(p.look.aura && p.look.aura.tier !== 2, cls + ': plain again below 14');
  }
});

test('level down from 20: rank V goes, boons taken at 14-20 are removed, stats and aura follow', () => {
  const { game, pr, p, of } = make();
  pr.setClass('rogue', { quiet: true });
  pr.setLevel(20, { quiet: true });
  pr.setSpec('ninja', { quiet: true });
  const top = { hp: p.hpMax, power: p.stats.power };
  // take all nine boons at their levels
  const ids = ['venom_edge', 'boomerang_blade', 'explosive_tags', 'blade_storm', 'clone_mastery', 'kunai_fan', 'smoke_screen', 'adrenaline_rush', 'toxic_fan'];
  for (let i = 0; i < ids.length; i++) { pr.boons.push(ids[i]); pr.boonLevels[ids[i]] = BOON_LEVELS[i]; }
  pr.pendingBoons = 0;
  pr.setLevel(15);
  assert.equal(pr.rank(), 4);
  assert.deepEqual(of('rank:down').at(-1), { rank: 4, prev: 5 });
  assert.deepEqual(pr.boons, ids.slice(0, 6), 'boons from 16+ removed');
  assert.deepEqual(of('boons:removed').at(-1).ids, ids.slice(6));
  assert.ok(p.hpMax < top.hp && p.stats.power < top.power);
  assert.equal(p.look.aura.tier, 2, 'still empowered at 15');
  assert.equal(game.hudState().basic.name, 'Shuriken Storm');
  pr.setLevel(20);
  assert.equal(pr.pendingBoons, 3, 'the freed slots at 16/18/20 can be picked again');
  assert.equal(game.hudState().basic.name, 'Shuriken Halo');
});

test('teacher tools: set level 13..20, level up to the cap, level down from it', () => {
  const { game, pr } = make({ teacher: true });
  const T = game.debug.teacher;
  assert.ok(T.setClass('mage'));
  for (let L = 13; L <= 20; L++) { assert.ok(T.setLevel(L)); assert.equal(pr.level, L); }
  assert.equal(T.levelUp(), false, 'cannot go above 20');
  assert.ok(T.levelDown()); assert.equal(pr.level, 19);
  assert.ok(T.levelUp()); assert.equal(pr.level, 20);
  assert.equal(pr.xp, pr.xpNext, 'xp bar full at the cap');
  assert.ok(T.setSpec('sorcerer'));
  assert.equal(game.hudState().basic.rank, 5);
});

test('boon offers stay 3 at every boon level through 20, for every subclass (and an unspecialized hero)', () => {
  for (const spec of [null, ...Object.keys(CLASS_OF)]) {
    const cls = spec ? CLASS_OF[spec] : 'warrior';
    const { pr } = make({ seed: 9 });
    pr.setClass(cls, { quiet: true });
    for (const L of BOON_LEVELS) {
      pr.setLevel(L, { quiet: true, boons: false });
      if (spec && L >= 8 && !pr.specId) pr.setSpec(spec, { quiet: true });
      const offer = pr.offerBoons(3);
      assert.equal(offer.length, 3, `${spec || cls} L${L}: 3 options`);
      assert.equal(new Set(offer.map((o) => o.id)).size, 3);
      for (const o of offer) assert.ok(!pr.boons.includes(o.id), 'no repeats');
      if (spec && L >= 8) assert.ok(offer.some((o) => o.spec === spec) || data.boons && Object.values(data.boons).filter((b) => b.spec === spec && !pr.boons.includes(b.id)).length === 0,
        `${spec} L${L}: a subclass boon is offered while any remain`);
      for (const o of offer) assert.ok(o.desc && o.desc.length < 100, o.id + ' one-line description');
      pr.boons.push(offer[0].id);
      pr.boonLevels[offer[0].id] = L;
    }
    assert.equal(pr.boons.length, 9);
  }
});

test('save / load at level 20 keeps level, rank V, nine boons, spec, the empowered aura and a working kit', () => {
  const storage = createMemoryStorage();
  const { game, pr } = make({ name: 'Twenty', storage });
  pr.setClass('mage', { quiet: true });
  pr.setLevel(20, { quiet: true });
  pr.setSpec('monk', { quiet: true });
  const ids = ['frost_nova', 'double_blink', 'iron_skin', 'mana_surge', 'arcane_orbit', 'palm_echo', 'jade_lotus', 'arcane_chain', 'comet_nova'];
  for (let i = 0; i < ids.length; i++) { pr.boons.push(ids[i]); pr.boonLevels[ids[i]] = BOON_LEVELS[i]; }
  pr.addXp(5000);
  game.sys.save.now();
  const g2 = createGame({ data, name: 'Twenty', seed: 7, zone: 'test', storage, test: true, questions: createQuestions({ mode: 'auto' }),
    save: game.sys.save.load('Twenty') });
  const p2 = g2.player;
  assert.equal(g2.progression.level, 20);
  assert.equal(g2.progression.rank(), 5);
  assert.equal(g2.progression.specId, 'monk');
  assert.deepEqual(g2.progression.boons, ids);
  assert.equal(g2.progression.xp, g2.progression.xpNext, 'xp bar full');
  assert.equal(g2.kits.active(p2).id, 'monk');
  assert.equal(p2.look.aura.tier, 2, 'empowered aura after a load');
  assert.equal(g2.hudState().basic.name, 'Dragon Fist');
  // still fights
  p2.data.minHp = 1;
  const r = g2.ents.spawn('rat', p2.x + 0.9, p2.y, { noAi: true, hp: 99999 });
  const inp = { moveX: 0, moveY: 0, attackDir: 1, attackPressed: 1, attackReleased: -1, attackHeldT: 0, attackAngle: NaN,
    pressed: {}, held: {}, released: {} };
  for (let i = 0; i < 120; i++) { g2.step(1 / 60, inp); inp.attackPressed = -1; }
  assert.ok(r.hp < r.hpMax, 'the level-20 monk punches after a load');
  // an old save above the cap is clamped
  const j = JSON.parse(JSON.stringify(game.sys.save.load('Twenty')));
  j.systems.progression.level = 99;
  const g3 = createGame({ data, name: 'Twenty', seed: 7, zone: 'test', storage, test: true, questions: createQuestions({ mode: 'auto' }), save: j });
  assert.equal(g3.progression.level, 20);
});
