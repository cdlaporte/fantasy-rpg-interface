// Round 3, package A: the 27 new boons (3 per class, 2 per subclass). Each one runs the same scripted moment with and
// without the boon: with it, the new behaviour happens (kit counter / entity / status / damage) and shows its fx;
// without it, it does not. Plus: data shape (one punchy line, icons from the closed list, owners).
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../../src/data/index.js';
import { ICONS } from '../../src/contracts.js';
import { hero, attackEast } from './r3a-lib.mjs';

const press = (h, slot, hold = 2, extra = {}) => {
  h.input.set(Object.assign({ held: { [slot]: true } }, extra));
  h.step(hold);
  h.input.set({ held: { [slot]: false }, moveX: 0, moveY: 0 });
  h.step(1);
};
const full = (h) => h.game.kits.setResource(h.p, h.game.kits.resource(h.p).max);
const n = (v) => v || 0;
const ents = (h, f) => h.game.ents.all.filter((e) => !e.removed && f(e));

// [boon, spec (or class), level, run(h), check(h) -> truthy only with the boon, hero opts]
const CASES = [
  // ---- warrior class ----
  ['thunder_clap', 'warrior', 16, (h) => attackEast(h, 240), (h) => n(h.kit().claps) > 0 && h.fx.get('bolt') > 0],
  ['juggernaut', 'warrior', 16, (h) => { press(h, 'space', 2, { moveX: 1 }); h.step(30); }, (h) => new Set(h.r.hits.map((e) => e.target.id)).size >= 2,
    { spots: [[1.2, 0], [2.2, 0], [3.2, 0]] }],
  ['war_banner', 'warrior', 16, (h) => { full(h); press(h, 'q'); h.step(90); },
    (h) => ents(h, (e) => e.kind === 'war_banner').length === 1 && h.foes.some((f) => f.status.burn > 0) && n(h.game.combat.mod(h.p, 'power')) > 0.3],
  // ---- knight ----
  ['hallowed_ground', 'knight', 16, (h) => {
    h.input.set({ held: { f: true } }); h.step(3);
    h.p.angle = 0; h.game.combat.damage(h.p, 30, { source: h.foes[0], type: 'melee' });
    h.step(10); h.input.set({ held: { f: false } }); h.step(5);
  }, (h) => n(h.kit().kn.hallowed) > 0 && ents(h, (e) => e.type === 'effect' && e.data && e.data.zone && e.data.zone.id === 'hallowed_ground').length + n(h.kit().kn.hallowed) > 0],
  ['judgement', 'knight', 16, (h) => attackEast(h, 240), (h) => n(h.kit().kn.judgements) > 0 && h.fx.get('pillar') > 0],
  // ---- berserker ----
  ['rampage', 'berserker', 16, (h) => { full(h); h.step(2); for (const f of h.foes) f.hp = 1; attackEast(h, 120); h.step(5); },
    (h) => n(h.kit().bz.ramps) > 0, { hp: 99999 }],
  ['whirling_axes', 'berserker', 16, (h) => { full(h); h.input.set({ held: { f: true } }); h.step(90); h.input.set({ held: { f: false } }); h.step(5); },
    (h) => n(h.kit().bz.flungAxes) > 0 && h.r.models.has('axe')],
  // ---- battlemage ----
  ['trinity_slash', 'battlemage', 16, (h) => attackEast(h, 240), (h) => n(h.kit().bm.trinities) > 0 && h.fx.get('shockwave') > 0],
  ['elemental_crown', 'battlemage', 16, (h) => h.step(200), (h) => n(h.kit().bm.crowns) > 0 && h.r.dmg > 0, { dist: 3 }],
  // ---- mage class ----
  ['arcane_chain', 'mage', 16, (h) => attackEast(h, 240), (h) => n(h.kit().m_chains) > 0, { dist: 3 }],
  ['comet_nova', 'mage', 16, (h) => { full(h); press(h, 'q'); h.step(90); }, (h) => n(h.kit().m_comets) > 0 && h.fx.get('meteor') > 0],
  ['mana_shield', 'mage', 16, (h) => { full(h); h.step(2); h.hp0 = h.p.hp; h.game.combat.damage(h.p, 300, { source: h.foes[0], type: 'melee' }); },
    (h) => h.hp0 - h.p.hp < 250 && h.p.fxTags.includes('shield'), { dist: 6 }],
  // ---- conjurer ----
  ['wild_hunt', 'conjurer', 16, (h) => { attackEast(h, 200); h.step(10); }, (h) => n(h.kit().cj_wolves) > 0, { dist: 3 }],
  ['spirit_totem', 'conjurer', 16, (h) => { full(h); h.p.hp = Math.round(h.p.hpMax / 2); h.hp0 = h.p.hp; press(h, 'f'); h.step(60); },
    (h) => n(h.kit().cj_totems) > 0 && ents(h, (e) => e.kind === 'spirit_totem').length === 1 && h.p.hp > h.hp0, { dist: 8 }],
  // ---- sorcerer ----
  ['living_bomb', 'sorcerer', 16, (h) => { for (let i = 0; i < 3; i++) { full(h); h.input.set({ attackDir: 1 }); h.step(30); h.input.set({ attackDir: -1 }); h.step(80); } },
    (h) => n(h.kit().so_bombsBlown) > 0, { dist: 3 }],
  ['phoenix', 'sorcerer', 16, (h) => { h.p.data.minHp = 0; h.step(2); h.game.combat.damage(h.p, h.p.hpMax * 3, { source: h.foes[0], type: 'melee' }); h.step(5); },
    (h) => !h.p.data.down && h.p.hp > 0 && n(h.kit().so_phoenixes) === 1, { dist: 6 }],
  // ---- monk ----
  ['palm_echo', 'monk', 16, (h) => attackEast(h, 240), (h) => n(h.kit().mo_echoes) > 0 && h.r.hits.some((e) => e.tags && e.tags.includes('palm_echo'))],
  ['jade_lotus', 'monk', 16, (h) => { full(h); press(h, 'shift'); h.step(200); }, (h) => n(h.kit().mo_lotus) > 0 && h.fx.get('pillar') > 0],
  // ---- rogue class ----
  ['toxic_fan', 'rogue', 16, (h) => { full(h); press(h, 'q'); h.step(40); }, (h) => n(h.kit().rg.clouds) > 0 && h.foes.some((f) => f.status.venom > 0)],
  ['backflip_knives', 'rogue', 16, (h) => press(h, 'space', 2, { moveX: -1 }), (h) => n(h.kit().rg.backflips) > 0 && h.r.models.has('knife')],
  ['adrenaline_rush', 'rogue', 16, (h) => { full(h); press(h, 'q'); h.step(10); },
    (h) => n(h.kit().rg.rushes) > 0 && h.game.combat.mod(h.p, 'attackSpeed') > 0 && h.fx.get('afterimage') > 0],
  // ---- archer ----
  ['ricochet_arrows', 'archer', 16, (h) => { for (let i = 0; i < 6; i++) { h.input.set({ attackDir: 1 }); h.step(3); h.input.set({ attackDir: -1 }); h.step(30); } },
    (h) => n(h.kit().ar.ricos) > 0, { dist: 3 }],
  ['explosive_arrow', 'archer', 16, (h) => { h.input.set({ attackDir: 1 }); h.step(60); h.input.set({ attackDir: -1 }); h.step(40); },
    (h) => n(h.kit().ar.booms) > 0 && h.fx.get('shockwave') > 0, { dist: 3 }],
  // ---- thief ----
  ['golden_touch', 'thief', 16, (h) => { h.p.hp = Math.round(h.p.hpMax / 2); h.hp0 = h.p.hp; h.game.bus.emit('pickup', { kind: 'gold', n: 12 }); h.step(2); },
    (h) => n(h.kit().th.goldHeals) === 1 && h.p.hp > h.hp0, { dist: 6 }],
  ['sleight_of_hand', 'thief', 16, (h) => { for (const f of h.foes) f.angle = 0; attackEast(h, 60); }, (h) => n(h.kit().th.steals) > 0 && h.p.status.haste > 0 && h.foes.some((f) => f.status.slow > 0)],
  // ---- ninja ----
  ['kunai_fan', 'ninja', 16, (h) => { press(h, 'f'); h.step(30); }, (h) => n(h.kit().nj.kunaiFans) > 0 && h.r.models.has('kunai'), { dist: 3 }],
  ['smoke_screen', 'ninja', 16, (h) => { press(h, 'f'); h.step(10); }, (h) => n(h.kit().nj.screens) > 0 && h.fx.get('smoke') > 0, { dist: 3 }],
];

test('27 new boons: 3 per class, 2 per subclass, each a punchy one-liner with an icon from the closed list', () => {
  const ids = CASES.map((c) => c[0]);
  assert.equal(new Set(ids).size, 27);
  const owner = { warrior: 0, mage: 0, rogue: 0 };
  for (const id of ids) {
    const b = data.boons[id];
    assert.ok(b, id + ' in data');
    assert.ok(ICONS.includes(b.icon), id + ' icon');
    assert.ok(b.name && b.desc && b.desc.length >= 20 && b.desc.length < 100, id + ' one line');
    if (b.class) owner[b.class]++;
  }
  assert.deepEqual(owner, { warrior: 3, mage: 3, rogue: 3 });
  for (const s of ['knight', 'berserker', 'battlemage', 'conjurer', 'sorcerer', 'monk', 'archer', 'thief', 'ninja'])
    assert.equal(ids.filter((id) => data.boons[id].spec === s).length, 2, s);
});

for (const [id, spec, level, run, check, opts] of CASES) {
  test(`boon ${id} (${spec}): changes what happens (with vs without)`, () => {
    const off = hero(spec, level, [], opts || {});
    run(off);
    const on = hero(spec, level, [id], opts || {});
    run(on);
    assert.ok(check(on), `${id}: the new behaviour happens with the boon`);
    assert.ok(!check(off), `${id}: and not without it`);
  });
}
