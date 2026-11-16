// Round 2 (package C): classmates at 100% of the class numbers, rescaled on every level change (levelup, the
// 'level:set' event package A emits, or progression.level moving by itself), a second ability at player level 5, and
// the specialization upgrade (+30% basic with a class touch, outfit, toast). HudState companions carry `level`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../src/config.js';
import { setup, DT } from './r2c-sim.mjs';

const NS = config.numberScale;
function party(level = 3, cls = 'mage') {
  const game = setup({ cls, level, zone: 'test', marker: 'start', companions: true, boons: false });
  const toasts = [];
  game.bus.on('toast', (t) => toasts.push(t.text));
  return { game, toasts, mates: () => game.companions.active };
}
const byName = (game, n) => game.companions.active.find((e) => e.name === n);

test('companions use 100% of the class numbers at the player level and walk at the player speed multiplier', () => {
  const { game } = party(6, 'mage');
  for (const e of game.companions.active) {
    const cc = game.data.classes[e.data.classId].companion;
    const s = cc.stats;
    assert.equal(cc.mult, 1);
    assert.equal(e.hpMax, Math.round((s.hp + s.hpPerLevel * 6) * NS));
    assert.ok(Math.abs(e.stats.power - (s.power + s.powerPerLevel * 6) * NS) < 1e-9, e.name + ' power');
    assert.ok(Math.abs(e.stats.speed - s.speed * config.playerSpeedMul) < 1e-9, e.name + ' speed');
    assert.equal(e.level, 6);
  }
});

test('rescale on levelup, on level:set (also downward) and when progression.level changes without an event', () => {
  const { game } = party(3);
  const bram = byName(game, 'Bram');
  const p3 = bram.stats.power;
  game.progression.setLevel(7);
  assert.equal(bram.level, 7);
  assert.ok(bram.stats.power > p3);
  // down (teacher mode): progression emits no levelup; package A emits 'level:set'
  game.progression.setLevel(4, { quiet: true });
  game.bus.emit('level:set', { level: 4 });
  assert.equal(bram.level, 4);
  // no event at all: the companions system follows progression.level on its next update
  game.progression.level = 9;
  game.step(DT);
  assert.equal(bram.level, 9);
  const s = game.data.classes.warrior.companion.stats;
  assert.ok(Math.abs(bram.stats.power - (s.power + s.powerPerLevel * 9) * NS) < 1e-9);
  const h = game.hudState().companions;
  assert.ok(h.length === 2 && h.every((c) => c.level === 9), 'HudState companions[i].level');
});

test('second ability from player level 5 (War Cry, Arcane Nova, Fan of Knives) with a toast when it unlocks', () => {
  const { game, toasts } = party(4, 'rogue');
  const names = (e) => e.ai.attacks.map((a) => a.name);
  for (const e of game.companions.active) assert.equal(e.ai.attacks.length, 2, e.name + ' has basic + Space ability at 4');
  game.progression.setLevel(5);
  assert.deepEqual(names(byName(game, 'Bram')).slice(2), ['War Cry']);
  assert.deepEqual(names(byName(game, 'Elowen')).slice(2), ['Arcane Nova']);
  assert.ok(toasts.some((t) => /learned/.test(t)), 'toast: ' + toasts.join(' | '));
  const g2 = party(5, 'mage').game;
  assert.deepEqual(names(byName(g2, 'Pip')).slice(2), ['Fan of Knives'], 'joining at 5+ comes with it');
});

test('specialization upgrade: +30% basic, crescent / split / bleed, outfit (lookRev), "grows stronger" toast', () => {
  const { game, toasts } = party(8, 'warrior');
  game.companions.set(['warrior', 'mage', 'rogue']);   // all three, to check every upgrade
  const base = {};
  for (const e of game.companions.active) base[e.name] = { dmg: e.ai.attacks[0].def.dmg, rev: e.lookRev || 0, outfit: JSON.stringify(e.look.outfit) };
  game.progression.setSpec('knight');
  assert.ok(toasts.some((t) => /grow/.test(t) && /Bram/.test(t)), 'toast: ' + toasts.join(' | '));
  for (const e of game.companions.active) {
    const b = e.ai.attacks[0].def;
    assert.ok(Math.abs(b.dmg - base[e.name].dmg * 1.3) < 1e-9, e.name + ' +30%');
    assert.ok((e.lookRev || 0) > base[e.name].rev, e.name + ' lookRev bumped');
    assert.notEqual(JSON.stringify(e.look.outfit), base[e.name].outfit, e.name + ' outfit changed');
    assert.equal(e.data.upgraded, true);
  }
  assert.equal(byName(game, 'Bram').ai.attacks[0].def.use, 'swing_throw');
  assert.equal(byName(game, 'Bram').ai.attacks[0].def.then.model, 'crescent');
  assert.ok(byName(game, 'Elowen').ai.attacks[0].def.split.n >= 2);
  const st = byName(game, 'Pip').ai.attacks[0].def.status;
  assert.equal(st.id, 'venom');
  assert.ok(st.p > 0, 'bleed scales with power');
});

test('upgraded attacks work in a fight: the crescent flies, the bolt splits, the daggers bleed', () => {
  const { game } = party(9, 'warrior');
  game.companions.set(['warrior', 'mage', 'rogue']);
  game.progression.setSpec('knight', { quiet: true });
  game.step(DT);
  const p = game.player;
  p.status.invuln = 1e9;
  const foe = game.ents.spawn('boar', p.x + 2.5, p.y, { hp: 1e6, ai: { aggro: 0 } });
  foe.data.kbResist = 1;
  const seen = { crescent: 0, split: 0, venom: 0 };
  game.bus.on('ent:spawned', ({ ent }) => {
    if (ent.type !== 'projectile') return;
    const o = ent.owner != null ? game.ents.get(ent.owner) : null;
    if (o && o.name === 'Bram' && ent.look && ent.look.model === 'crescent') seen.crescent++;
    if (o && o.name === 'Elowen' && ent.data.proj && ent.data.proj.split) seen.split++;
  });
  for (let i = 0; i < 6 / DT; i++) {
    game.step(DT);
    if ((foe.status.venom || 0) > 0) seen.venom++;
  }
  assert.ok(seen.crescent > 0, 'Bram throws crescents');
  assert.ok(seen.split > 0, 'Elowen fires splitting bolts');
  assert.ok(seen.venom > 0, 'Pip makes the target bleed (venom status)');
});

test('save/load keeps the party; the upgrade and level are re-derived from progression', () => {
  const { game } = party(9, 'mage');
  game.progression.setSpec('sorcerer', { quiet: true });
  game.step(DT);
  const pip = byName(game, 'Pip');
  assert.equal(pip.data.upgraded, true);
  game.companions.set(['warrior', 'rogue']);   // what a load does
  const pip2 = byName(game, 'Pip');
  assert.equal(pip2.data.upgraded, true);
  assert.equal(pip2.level, 9);
  assert.equal(pip2.ai.attacks.length, 3);
});
