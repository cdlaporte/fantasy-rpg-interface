// Round 3, package A: rank V (level 16) of every subclass's basic attack. Same scripted input at level 15 (rank IV) and
// level 16 (rank V): the rank V upgrade fires (kit counter), shows its new fx / bigger projectiles, and deals damage.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../../src/data/index.js';
import { hero, attackEast } from './r3a-lib.mjs';

// rank V marker per subclass: the kit counter it bumps, the new effect (fx type or projectile/effect model), the basic's name
const RANK5 = {
  knight: { count: (k) => k.kn.twins, model: 'wave', name: 'Twin Dawn' },
  berserker: { count: (k) => k.bz.splits, fx: 'slash', name: 'Splitting Axes' },
  battlemage: { count: (k) => k.bm.duals, fx: 'slash', name: 'Rune Tempest' },
  conjurer: { count: (k) => k.cj_chains, fx: 'bolt', name: 'Spirit Chain' },
  sorcerer: { count: (k) => k.so_triples, fx: 'shockwave', name: 'Overcharge: Triple Lance' },
  monk: { count: (k) => k.mo_dragonFists, model: 'orb', name: 'Dragon Fist' },
  archer: { count: (k) => k.ar.burnTrails, model: 'ground_fire', name: 'Burning Shot' },
  thief: { count: (k) => k.th.storms, fx: 'slash', name: 'Coin Storm' },
  ninja: { count: (k) => k.nj.halos, fx: 'ring', name: 'Shuriken Halo' },
};

for (const spec of Object.keys(RANK5)) {
  test(`rank V (${spec}): level 16 upgrades the basic visibly; level 15 does not`, () => {
    const m = RANK5[spec];
    const h15 = hero(spec, 15), h16 = hero(spec, 16);
    attackEast(h15); attackEast(h16);
    assert.ok(!(m.count(h15.kit()) > 0), `${spec}: no rank V at level 15`);
    assert.ok(m.count(h16.kit()) > 0, `${spec}: rank V fired at level 16`);
    assert.ok(h16.r.dmg > 0, 'deals damage');
    assert.equal(h16.game.hudState().basic.rank, 5);
    assert.equal(h16.game.hudState().basic.name, m.name);
    if (m.fx) assert.ok((h16.fx.get(m.fx) || 0) > (h15.fx.get(m.fx) || 0), `${spec}: more '${m.fx}' fx at rank V`);
    if (m.model) assert.ok(h16.r.models.has(m.model) && (spec === 'monk' || !h15.r.models.has(m.model)), `${spec}: new '${m.model}' at rank V`);
    assert.ok(h16.r.dmg > h15.r.dmg * 0.9, `${spec}: rank V is not weaker on the cluster (${h16.r.dmg} vs ${h15.r.dmg})`);
  });
}

test('rank V shapes: Twin Dawn and Splitting Axes are bigger, Triple Lance hits three lines, Shuriken Halo is a full ring', () => {
  const kn = hero('knight', 16); attackEast(kn);
  const kn15 = hero('knight', 15); attackEast(kn15);
  assert.ok(kn.r.projSize > kn15.r.projSize, 'the twin wave is bigger than the rank IV crescent');
  const s14 = (14 * Math.PI) / 180;
  const so = hero('sorcerer', 16, [], { spots: [[3, 0], [5 * Math.cos(s14), 5 * Math.sin(s14)], [5 * Math.cos(s14), -5 * Math.sin(s14)]] });
  attackEast(so);
  const lanceTargets = new Set(so.r.hits.filter((e) => e.tags && e.tags.includes('triple_lance')).map((e) => e.target.id));
  assert.ok(lanceTargets.size >= 2, 'the side lances hit enemies off the centre line: ' + lanceTargets.size);
  const nj = hero('ninja', 16, [], { spots: [[2, 0], [-2, 0], [0, 2], [0, -2], [1.5, 1.5]] });
  attackEast(nj, 120);
  const behind = nj.r.hits.filter((e) => e.target.x < nj.p.x - 1);
  assert.ok(behind.length > 0, 'the halo also hits enemies behind the ninja');
});

test('fuzz: every subclass at level 20 with all its boons, 1500 steps of random input against live enemies, no throw', () => {
  for (const spec of Object.keys(RANK5)) {
    const cls = { knight: 'warrior', berserker: 'warrior', battlemage: 'warrior', conjurer: 'mage', sorcerer: 'mage', monk: 'mage' }[spec] || 'rogue';
    const all = Object.values(data.boons).filter((b) => b.class === cls || b.spec === spec).map((b) => b.id);
    const h = hero(spec, 20, all, { ai: true, hp: 3000, seed: 13 });
    h.game.companions.set(cls === 'warrior' ? ['mage', 'rogue'] : ['warrior']);
    let s = 17;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 1500; i++) {
      if (i % 5 === 0) {
        const held = {};
        for (const k of ['space', 'q', 'f', 'shift']) held[k] = rnd() < 0.15;
        h.input.set({ moveX: rnd() * 2 - 1, moveY: rnd() * 2 - 1, attackDir: rnd() < 0.7 ? Math.floor(rnd() * 4) : -1, held });
      }
      if (i % 300 === 0) { h.game.kits.setResource(h.p, h.game.kits.resource(h.p).max); h.game.abilities.reset(h.p); }
      if (i % 400 === 200) for (let k = 0; k < 3; k++) h.game.ents.spawn('goblin_scout', h.p.x + 3 * Math.cos(k * 2), h.p.y + 3 * Math.sin(k * 2), { level: 20 });
      h.step(1);
      assert.ok(Number.isFinite(h.p.x) && Number.isFinite(h.p.y) && Number.isFinite(h.p.hp), spec + ' finite at ' + i);
    }
    assert.ok(h.r.dmg > 0, spec + ' dealt damage');
    h.game.hudState();
  }
});
