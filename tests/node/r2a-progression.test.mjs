// Round 2, package A: level up AND down (stats, abilities, attack rank, boons trimmed), class / subclass switching
// at any level, the teacher tools (gated by game.teacher), and "Go to" keeping the story flags consistent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import baseData from '../../src/data/index.js';
import { config } from '../../src/config.js';
import { createQuestions } from '../../src/questions/index.js';
import { xpNext, BOON_LEVELS, AURA_LEVEL } from '../../src/core/progression.js';
import { isTeacherSave, teacherSaveName, displayName, loadTopics, saveTopics, applyQuestionSettings, loadQuestionsOn, saveQuestionsOn } from '../../src/ui/teacher.js';
import { createMemoryStorage } from '../../src/platform/storage.js';
import { TOPICS } from '../../src/questions/unit4/index.js';

const CAP = config.levelCap;
function make(teacher = false) {
  const game = createGame({ data: baseData, name: 'T', seed: 5, zone: 'test', test: true, questions: createQuestions({ mode: 'auto' }) });
  game.teacher = teacher;
  const log = [];
  for (const e of ['levelup', 'level:set', 'rank:up', 'rank:down', 'boons:removed', 'ability:unlocked']) game.bus.on(e, (p) => log.push([e, p]));
  return { game, pr: game.progression, of: (e) => log.filter((x) => x[0] === e).map((x) => x[1]) };
}
const unlockedSlots = (game) => game.hudState().abilities.filter((a) => a.unlocked).map((a) => a.slot);

test('level down: stats, abilities and rank follow; xp restarts; events', () => {
  const { game, pr, of } = make();
  pr.setClass('mage', { quiet: true });
  pr.setLevel(CAP, { quiet: true });
  pr.setSpec('sorcerer', { quiet: true });
  const top = { hp: game.player.hpMax, power: game.player.stats.power };
  assert.equal(pr.rank(), CAP >= 16 ? 5 : 4);
  assert.deepEqual(unlockedSlots(game).sort(), ['f', 'q', 'shift', 'space']);
  assert.equal(pr.xp, pr.xpNext, 'at the cap xp is full');
  assert.ok(of('levelup').length >= 1);
  const ups = of('levelup').length;
  pr.setLevel(3);
  assert.equal(pr.level, 3);
  assert.equal(pr.xp, 0); assert.equal(pr.xpNext, xpNext(3));
  assert.ok(game.player.hpMax < top.hp && game.player.stats.power < top.power, 'stats drop');
  assert.equal(game.player.hp, game.player.hpMax, 'full health at the new level');
  assert.equal(pr.rank(), 1);
  assert.deepEqual(unlockedSlots(game), ['space'], 'only the level-3 ability stays unlocked');
  assert.equal(pr.specId, 'sorcerer', 'the subclass stays (teacher: any subclass at any level)');
  assert.equal(of('levelup').length, ups, "no 'levelup' on the way down");
  assert.deepEqual(of('level:set').at(-1), { level: 3, prev: CAP });
  assert.deepEqual(of('rank:down').at(-1), { rank: 1, prev: CAP >= 16 ? 5 : 4 });
  // back up again: unlocks fire again, level:set and levelup
  pr.setLevel(8);
  assert.deepEqual(of('level:set').at(-1), { level: 8, prev: 3 });
  assert.equal(of('levelup').at(-1).level, 8);
  assert.ok(unlockedSlots(game).includes('f'));
  // the stats at a level do not depend on the path
  const { game: g2, pr: p2 } = make();
  p2.setClass('mage', { quiet: true }); p2.setLevel(8, { quiet: true }); p2.setSpec('sorcerer', { quiet: true });
  assert.equal(game.player.hpMax, g2.player.hpMax);
  assert.deepEqual(game.player.stats, g2.player.stats);
});

test('level down trims boons taken above the new level and recomputes pending boons', () => {
  const { game, pr, of } = make();
  pr.setClass('warrior', { quiet: true });
  pr.setLevel(4, { quiet: true });
  assert.equal(pr.pendingBoons, 1);
  const pick = () => { const o = pr.offerBoons(3); assert.ok(pr.chooseBoon(o[0].id)); return o[0].id; };
  const b4 = pick();
  pr.setLevel(7, { quiet: true });              // slot 6 earned, picked late at 7
  const b6 = pick();
  pr.setLevel(10, { quiet: true });             // slots 8 and 10
  assert.equal(pr.pendingBoons, 2);
  const b10 = pick();
  assert.deepEqual(pr.boonLevels, { [b4]: 4, [b6]: 7, [b10]: 10 });
  assert.equal(pr.pendingBoons, 1);
  pr.setLevel(6);                               // boons taken at 7 and 10 go; slots 4 and 6 exist
  assert.deepEqual(pr.boons, [b4]);
  assert.deepEqual(of('boons:removed').at(-1).ids.sort(), [b6, b10].sort());
  assert.equal(pr.pendingBoons, 1, 'the slot of level 6 can be picked again');
  assert.equal(game.hudState().pendingBoons, 1);
  pr.setLevel(3);
  assert.deepEqual(pr.boons, []);
  assert.equal(pr.pendingBoons, 0, 'no boon slots below level 4');
  assert.equal(pr.offer, null);
  // save / load keeps the levels; old saves (no boonLevels) assume slot order
  pr.setLevel(12, { quiet: true });
  pick();
  const json = JSON.parse(JSON.stringify(game.saveSystems()));
  const { game: g2 } = make();
  g2.loadSystems(json);
  assert.deepEqual(g2.progression.boonLevels, pr.boonLevels);
  delete json.progression.boonLevels;
  json.progression.boons = ['a', 'b', 'c'];
  g2.loadSystems(json);
  assert.deepEqual(g2.progression.boonLevels, { a: BOON_LEVELS[0], b: BOON_LEVELS[1], c: BOON_LEVELS[2] });
});

test('aura and look follow the level both ways', () => {
  const { game, pr } = make();
  game.setFlag('look_chosen', true);
  pr.setClass('rogue', { quiet: true });
  pr.setLevel(AURA_LEVEL, { quiet: true });
  assert.ok(game.player.look.aura, 'aura at level 10');
  const rev = game.player.lookRev;
  pr.setLevel(AURA_LEVEL - 1);
  assert.ok(!game.player.look.aura, 'aura gone below 10');
  assert.ok(game.player.lookRev > rev, 'look refreshed');
});

test('class and subclass switching at any level (ranks follow the level)', () => {
  const { game, pr } = make(true);
  const T = game.debug.teacher;
  for (const level of [1, 3, 5, 8, 12]) {
    T.setLevel(level);
    for (const c of ['warrior', 'mage', 'rogue']) {
      assert.ok(T.setClass(c));
      assert.equal(pr.classId, c); assert.equal(pr.specId, null); assert.equal(pr.level, level);
      for (const s of pr.specIds(c)) {
        assert.ok(T.setSpec(s), `${s} at ${level}`);
        assert.equal(pr.specId, s); assert.equal(pr.classId, c); assert.equal(pr.level, level);
        assert.equal(pr.rank(), level >= 12 ? 4 : level >= 8 ? 3 : level >= 4 ? 2 : 1);
        const un = unlockedSlots(game);
        assert.equal(un.includes('f'), level >= 8, `${s} F at level ${level}`);
        for (let i = 0; i < 20; i++) game.step(1 / 60, game.input);
      }
    }
    // a subclass of another class switches the class too
    T.setSpec('ninja');
    assert.equal(pr.classId, 'rogue');
    T.setSpec('knight');
    assert.equal(pr.classId, 'warrior');
  }
  assert.deepEqual(game.debug.errors(), []);
});

test('teacher tools work only in a teacher game', () => {
  const { game, pr } = make(false);
  const T = game.debug.teacher;
  assert.equal(T.enabled(), false);
  for (const [fn, args] of [['addXp', [1000]], ['levelUp', []], ['levelDown', []], ['setLevel', [9]], ['setClass', ['mage']],
    ['setSpec', ['monk']], ['god', [true]], ['gold', [500]], ['goTo', ['town']]]) {
    assert.equal(T[fn](...args), false, fn + ' refused');
  }
  assert.equal(pr.level, 1); assert.equal(pr.classId, null); assert.equal(game.sys.inventory.gold, 0);
  assert.equal(T.isGod(), false);
  game.teacher = true;
  assert.ok(T.enabled());
  assert.ok(T.addXp(1000)); assert.ok(pr.level > 1);
  assert.ok(T.setLevel(CAP)); assert.equal(pr.level, CAP);
  assert.equal(T.levelUp(), false, 'cannot go above the cap');
  assert.ok(T.levelDown()); assert.equal(pr.level, CAP - 1);
  assert.ok(T.setSpec('monk')); assert.equal(pr.classId, 'mage');
  assert.ok(T.setClass('rogue')); assert.equal(pr.specId, null);
  assert.ok(T.god(true)); assert.equal(T.isGod(), true);
  assert.ok(T.gold(500)); assert.equal(game.sys.inventory.gold, 500);
  T.setLevel(1);
  assert.equal(T.levelDown(), false, 'cannot go below 1');
});

test('Go to: places keep the player and make the story flags consistent', () => {
  const { game, pr } = make(true);
  const T = game.debug.teacher;
  assert.deepEqual(T.places().map((p) => p.id), ['road', 'ambush', 'town', 'academy', 'forest', 'forest_boss',
    'dunes', 'dunes_boss', 'cove', 'cove_boss', 'peaks', 'peaks_boss', 'aether', 'aether_boss']);   // round 3 biomes
  T.setLevel(7); T.setSpec('archer');
  game.setFlag('teacher_game', true);
  let r = T.goTo('town');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(game.zone.id, 'town');
  for (const f of ['intro_done', 'look_chosen', 'tutorial_done', 'ambush_done', 'class_chosen', 'forest_open', 'spec_ceremony_done']) assert.ok(game.flags[f], f);
  assert.equal(pr.level, 7); assert.equal(pr.specId, 'archer');
  assert.notEqual(game.player.look.outfit && game.player.look.outfit.style, 'cloak', 'the cloak is off');
  for (let i = 0; i < 30; i++) game.debug.step(1);
  r = T.goTo('forest_boss');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(game.zone.id, 'forest');
  for (let i = 0; i < 30; i++) game.debug.step(1);
  r = T.goTo('road');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(game.zone.id, 'intro');
  assert.ok(!game.flags.intro_done && !game.flags.tutorial_done, 'the intro replays');
  assert.ok(game.flags.teacher_game, 'the teacher flag survives');
  assert.equal(pr.level, 7, 'level kept');
  for (let i = 0; i < 30; i++) game.debug.step(1);
  // a fresh teacher game without a class: town leads to the class pick
  const { game: g2 } = make(true);
  r = g2.debug.teacher.goTo('town');
  assert.equal(r.ok, true);
  assert.ok(g2.cutscene.active, 'town arrival plays');
  r = g2.debug.teacher.goTo('forest');
  assert.equal(g2.progression.classId, 'warrior', 'the forest needs a class: warrior by default');
  for (let i = 0; i < 30; i++) g2.debug.step(1);
  assert.deepEqual(game.debug.errors().concat(g2.debug.errors()), []);
});

test('teacher saves and classroom settings (pure helpers)', () => {
  assert.equal(teacherSaveName('Ada'), 'Ada (teacher)');
  assert.equal(teacherSaveName('Ada (teacher)'), 'Ada (teacher)');
  assert.equal(displayName('Ada (teacher)'), 'Ada');
  assert.ok(isTeacherSave({ flags: { teacher_game: true } }) && !isTeacherSave({ flags: {} }) && !isTeacherSave(null));
  const st = createMemoryStorage();
  assert.equal(loadTopics(st), null, 'all topics by default');
  saveTopics(st, ['proportion', 'angle_bisector', 'nope']);
  assert.deepEqual(loadTopics(st), ['proportion', 'angle_bisector']);
  saveTopics(st, TOPICS.map((t) => t.id));
  assert.equal(loadTopics(st), null, 'every topic on = null');
  saveTopics(st, ['proportion']);
  const q = createQuestions({ mode: 'stub' });
  applyQuestionSettings(q, st, {}, 'stub');
  assert.deepEqual(q.topics, ['proportion']); assert.equal(q.mode, 'stub');
  assert.equal(loadQuestionsOn(st), true);
  saveQuestionsOn(st, false);
  applyQuestionSettings(q, st, {}, 'stub');
  assert.equal(q.mode, 'off');
  applyQuestionSettings(q, st, { questions: 'auto' }, 'stub');
  assert.equal(q.mode, 'off', 'a URL parameter is left alone (main.js already set the mode)');
  saveQuestionsOn(st, true);
  applyQuestionSettings(q, st, {}, 'stub');
  assert.equal(q.mode, 'stub');
});
