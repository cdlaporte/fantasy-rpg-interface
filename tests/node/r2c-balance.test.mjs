// Round 2 (package C) balance targets, measured by playing the real game in Node (docs/notes/r2c.md has the tables):
// (a) the tutorial still reaches level 3 by the clearing; (b) a level 9 character of each class (its default spec) with
// both classmates beats Old Mossback (both shields answered at once) without being downed, potions allowed; (c) a level 3
// character kills a forest slime in a few basic hits and a level 8 one kills a treant sapling in ~5-8 s; (d) the level
// at the forest milestones from quest XP plus a realistic kill count.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../../src/data/index.js';
import { xpNext } from '../../src/core/progression.js';
import { newGame, createBot } from './bot-helpers.mjs';
import { setup, fighter, nearestEnemy, mossbackFight, DT } from './r2c-sim.mjs';

test('(a) tutorial: stick, rats and the giant rat reach level 3 by the clearing', async () => {
  const game = newGame({ name: 'Robin', questions: 'auto' });
  const bot = createBot(game);
  await bot.until(() => game.inputLock === 0 && game.cutscene.tutorial, { timeout: 20, what: 'control' });
  await bot.walkTo('stick', { r: 0.9 });
  await bot.until(() => game.player.data.target && game.player.data.target.kind === 'stick_pickup', { timeout: 3, what: 'stick target' });
  await bot.interact();
  await bot.until(() => game.flags.has_stick, { timeout: 2, what: 'has_stick' });
  await bot.walkTo('rats_1', { r: 3 });
  await bot.fight({ kind: 'rat', until: () => game.quests.step('main_enroll') >= 3 });
  await bot.walkTo('rats_2', { r: 3 });
  await bot.fight({ kind: 'rat', until: () => game.quests.step('main_enroll') >= 4 });
  await bot.walkTo('big_rat', { r: 3 });
  await bot.fight({ kind: 'giant_rat', kite: true, until: () => game.quests.step('main_enroll') >= 5 });
  assert.equal(game.progression.level, 3, 'level 3 by the clearing (not 4: the class pick is the next milestone)');
});

// The default spec of each class (debug scenario defaults), student profile (see r2c-sim.mjs).
const BOSS_ROWS = [['knight', 'warrior'], ['sorcerer', 'mage'], ['archer', 'rogue']];
for (const [spec, cls] of BOSS_ROWS) {
  test(`(b) Old Mossback vs a level 9 ${cls} (${spec}) with both classmates: first shield, kill, never downed`, async (t) => {
    const r = await mossbackFight(spec, 9);
    t.diagnostic(`${spec}: first shield ${r.toShield && r.toShield.toFixed(1)} s, killed in ${r.total && r.total.toFixed(1)} s, potions ${r.potions}`);
    assert.equal(r.downs, 0, 'never downed (potions allowed)');
    assert.ok(r.killed, 'Mossback defeated (' + (r.bossFrac * 100).toFixed(0) + '% left)');
    assert.ok(r.toShield >= 20 && r.toShield <= 45, 'first shield after 20-45 s: ' + r.toShield);
    assert.ok(r.total >= 70 && r.total <= 150, 'killed in 70-150 s: ' + r.total);
  });
}

/** Attack `target` with the basic only (8-way aim), walking into range. Returns seconds or null. */
function basicOnly(game, target, maxS = 20) {
  const p = game.player;
  const ranged = ['mage', 'conjurer', 'sorcerer', 'archer', 'ninja'].includes(game.kits.active(p).id);
  const inp = { moveX: 0, moveY: 0, attackDir: -1, attackPressed: -1, attackReleased: -1, attackHeldT: 0, attackAngle: NaN,
    pressed: {}, held: {}, released: {} };
  let prev = -1;
  for (let i = 0; i < maxS / DT; i++) {
    if (target.removed || !target.alive) return i * DT;
    const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy);
    const w = ranged ? 4 : target.radius + 0.6;
    inp.moveX = d > w ? dx / d : 0; inp.moveY = d > w ? dy / d : 0;
    const a8 = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const c = Math.cos(a8), s = Math.sin(a8);
    const dir = Math.abs(c) >= Math.abs(s) ? (c > 0 ? 1 : 3) : (s > 0 ? 2 : 0);
    const on = d < w + 0.8;
    inp.attackDir = on ? dir : -1; inp.attackAngle = on ? a8 : NaN;
    inp.attackPressed = on && prev < 0 ? dir : -1; inp.attackReleased = !on && prev >= 0 ? prev : -1;
    prev = inp.attackDir;
    game.step(DT, inp);
  }
  return null;
}

test('(c) a level 3 character kills a forest slime in a few basic hits', (t) => {
  const out = {};
  for (const cls of ['warrior', 'mage', 'rogue']) {
    const game = setup({ cls, level: 3, zone: 'test', marker: 'start', companions: false });
    const p = game.player;
    p.data.minHp = 1;
    const s = game.ents.spawn('slime', p.x + 3, p.y, { noAi: true });
    let hits = 0;
    game.bus.on('hit', (e) => { if (e.target === s && e.source === p) hits++; });
    const secs = basicOnly(game, s);
    out[cls] = { hits, secs };
    assert.ok(secs != null, cls + ' kills the slime');
  }
  t.diagnostic(JSON.stringify(out));
  // Sword Arc and Arcane Bolt: 3-4 hits. Twin Daggers hit small and fast (0.24 s): the same time to kill as the warrior.
  for (const cls of ['warrior', 'mage']) assert.ok(out[cls].hits >= 3 && out[cls].hits <= 4, `${cls}: ${out[cls].hits} hits`);
  assert.ok(out.rogue.secs <= out.warrior.secs * 1.25, `rogue ${out.rogue.secs.toFixed(2)} s vs warrior ${out.warrior.secs.toFixed(2)} s`);
});

for (const [spec, cls] of BOSS_ROWS) {
  test(`(c) a level 8 ${spec} kills a treant sapling (fighting back, growing thornlings) in about 5-8 s`, async (t) => {
    const game = setup({ cls, spec, level: 8, zone: 'forest', marker: 'grove_gate', companions: false, flags: ['gate_grove_seal'] });
    const p = game.player;
    for (const e of game.ents.all.slice()) if (e.type === 'enemy') game.ents.remove(e);
    game.ents.flush();
    const tr = game.ents.spawn('treant_sapling', p.x, p.y - 5, {});
    game.inventory.give('potion_small', 3, { silent: true });
    const f = fighter(game);
    const t0 = game.t;
    await f.run(30, { pick: () => (tr.alive && !tr.removed ? nearestEnemy(game, 2, (e) => e !== tr) || tr : null), stop: () => tr.removed || !tr.alive });
    const secs = game.t - t0;
    t.diagnostic(`${spec}: ${secs.toFixed(1)} s`);
    assert.ok(tr.removed || !tr.alive, 'treant down');
    assert.ok(secs >= 4 && secs <= 9, `${secs.toFixed(1)} s`);
  });
}

// ------------------------------------------------------------------------------------------- (d) level at milestones
/** Level reached with `xp` total experience under the config xp curve. */
export function levelAt(xp) {
  let L = 1;
  while (L < 12 && xp >= xpNext(L)) { xp -= xpNext(L); L++; }
  return L;
}
const E = (id) => data.enemies[id].stats.xp;
const Q = (id) => data.quests[id].rewards.xp;
// Realistic kill counts (main path only, no town side quests): what a student kills on the way, not a grind.
export const MILESTONES = [
  { name: 'tutorial + class pick', kills: { rat: 7, giant_rat: 1 }, quests: ['main_enroll'], want: 3 },
  { name: 'after First Steps (first forest quest)', kills: { slime: 5, slime_small: 10, thornling: 2, bat: 2 }, quests: ['main_first_steps'], want: 6 },
  { name: 'after Mushroom Mischief (second forest quest, + the Jelly Latte on the way)',
    kills: { sporecap: 8, slime: 3, slime_small: 6, boar: 3 }, quests: ['forest_mushroom_mischief', 'town_jelly_latte'], want: 8 },
  { name: 'before the grove boss (goblin quest, gate, saplings)', kills: { goblin_scout: 8, boar: 2, treant_sapling: 3, thornling: 4, wisp: 3 },
    quests: ['forest_goblin_trouble'], want: 10 },
];
export function milestoneTable() {
  let xp = 0;
  return MILESTONES.map((m) => {
    let k = 0;
    for (const id in m.kills) k += m.kills[id] * E(id);
    let q = 0;
    for (const id of m.quests) q += Q(id);
    xp += k + q;
    return { name: m.name, killXp: k, questXp: q, total: xp, level: levelAt(xp), want: m.want };
  });
}

test('(d) levels at the forest milestones (quest XP + a realistic kill count)', (t) => {
  const rows = milestoneTable();
  t.diagnostic('\n' + rows.map((r) => `${r.name.padEnd(80)} kills ${String(r.killXp).padStart(4)} quests ${String(r.questXp).padStart(4)} total ${String(r.total).padStart(5)} -> L${r.level}`).join('\n'));
  for (const r of rows) assert.equal(r.level, r.want, r.name);
});

// ------------------------------------------------------------------- round 3 (package A): levels 13-20
// (e) a level-18 hero vs level-18 biome enemies feels like the forest at level 8: a regular enemy (balance-sheet hp
// x0.6, the biome rule) dies in a few seconds and the hero survives about as many hits as at level 8 (the late
// toughness in progression.js makes up for the enemy damage curve growing faster than class hp).
function hitsToDown(cls, spec, level) {
  const game = setup({ cls, spec, level, zone: 'test', marker: 'start', companions: false });
  const p = game.player;
  const e = game.ents.spawn('goblin_scout', p.x + 5, p.y, { level });
  const hit = (e.def.attacks[0].dmg || 1) * e.stats.power * 10 / (10 + (p.stats.defense || 0));
  return p.hpMax / hit;
}
for (const [spec, cls] of BOSS_ROWS) {
  test(`(e) round 3: a level 18 ${spec} survives as many hits and kills as fast as a level 8 one did in the forest`, async (t) => {
    const h8 = hitsToDown(cls, spec, 8), h18 = hitsToDown(cls, spec, 18);
    const ttk = {};
    for (const L of [8, 18]) {
      const game = setup({ cls, spec, level: L, zone: 'test', marker: 'start', companions: false });
      const p = game.player;
      p.data.minHp = 1;
      const e = game.ents.spawn('goblin_scout', p.x + 5, p.y, { level: L });
      const f = fighter(game, { profile: 'expert' });
      const t0 = game.t;
      await f.run(30, { pick: () => (e.alive && !e.removed ? e : null), stop: () => e.removed || !e.alive });
      assert.ok(e.removed || !e.alive, `L${L} goblin down`);
      ttk[L] = game.t - t0;
    }
    t.diagnostic(`${spec}: hits to down L8 ${h8.toFixed(1)} / L18 ${h18.toFixed(1)}; goblin time to kill L8 ${ttk[8].toFixed(1)} s / L18 ${ttk[18].toFixed(1)} s`);
    assert.ok(h18 >= h8 * 0.9 && h18 >= 3, 'survives a few hits, about as many as at level 8');
    assert.ok(ttk[18] <= 9 && ttk[18] <= ttk[8] * 1.6 + 1, 'a regular enemy still dies in a few seconds');
  });
}

// (f) round 3: the level after each biome for a student who clears its quests and fights what is on the way.
// Kill model per biome: 30 regular kills at the player's level (scaleToPlayer, offsets average 0, clamped to the
// biome's levelRange) + 2 elites (x3 xp) + the boss (x20 at one level more), xp = (5 + 3L) x1.3 (the round 2 rule);
// quests: 2.5 quests at ~40% of a level each (the balance sheet). Start: after Old Mossback.
export const BIOMES = [['dunes', 10, 16], ['cove', 11, 17], ['peaks', 13, 19], ['aether', 15, 20]];
export function biomeLevels({ kills = 30, elites = 2, quests = 2.5 } = {}) {
  let xp = 0;
  for (let l = 1; l < 10; l++) xp += xpNext(l);
  xp += 164 + data.enemies.old_mossback.stats.xp + Q('forest_goblin_trouble');   // the r2c milestone (L10 +164) + boss + its quest
  const lvl = () => { let L = 1, x = xp; while (L < 20 && x >= xpNext(L)) { x -= xpNext(L); L++; } return L + (L < 20 ? x / xpNext(L) : 0); };
  const kill = (L) => Math.round((5 + 3 * L) * 1.3);
  const out = [{ name: 'after Mossback', level: lvl() }];
  for (const [name, lo, hi] of BIOMES) {
    for (let k = 0; k < kills + elites * 3; k++) xp += kill(Math.max(lo, Math.min(hi, Math.floor(lvl()))));
    xp += kill(Math.max(lo, Math.min(hi, Math.floor(lvl()) + 1))) * 20;
    xp += Math.round(0.4 * xpNext(Math.floor(lvl())) * quests);
    out.push({ name, level: lvl() });
  }
  return out;
}
test('(f) round 3: about two levels per biome, level 20 around the end of the fourth biome', (t) => {
  const rows = biomeLevels();
  t.diagnostic(rows.map((r) => `${r.name}: ${r.level.toFixed(1)}`).join(' | '));
  assert.ok(rows[0].level >= 11 && rows[0].level < 12.5, 'level 11 after Mossback');
  for (let i = 2; i < rows.length; i++) {
    const g = rows[i].level - rows[i - 1].level;
    assert.ok((g >= 1.4 || rows[i].level >= 20) && g <= 3.2, `${rows[i].name}: +${g.toFixed(1)} levels`);
  }
  assert.ok(rows[1].level - rows[0].level <= 3.5, 'the first biome is the biggest step but not a runaway');
  assert.ok(rows[4].level >= 19.3, 'level 20 around the end of the fourth biome: ' + rows[4].level.toFixed(1));
  assert.ok(rows[3].level < 19.5, 'not capped before the last biome: ' + rows[3].level.toFixed(1));
});
