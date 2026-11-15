// Rogue kits: mixed-fight DPS against the CLASSES balance band (one tough enemy + four weak ones, scripted sensible
// play, 8 seeds per level, sensible boon picks per level) and a 3000-step no-throw fuzz with everything unlocked.
// The measured table is printed as a test diagnostic and recorded in docs/notes/kit-rogue.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import { config } from '../../src/config.js';
import data from '../../src/data/index.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

const TARGET = Object.fromEntries(Object.entries({ 3: 10, 5: 17, 8: 30, 10: 40, 12: 52 }).map(([k, v]) => [k, v * config.numberScale]));   // CLASSES band x number scale
const BAND = 0.15;
const SEEDS = [7, 11, 23, 31, 42, 57, 64, 99];
// Sensible picks, in the order they are offered at levels 4 / 6 / 8 / 10 / 12.
const PICKS = {
  rogue: ['venom_edge', 'boomerang_blade', 'blade_flurry', 'lucky_streak', 'quick_hands'],
  archer: ['venom_edge', 'boomerang_blade', 'hawk', 'split_arrow', 'rain_of_fire'],
  thief: ['venom_edge', 'lucky_streak', 'loaded_dice', 'coin_toss', 'vanishing_act'],
  ninja: ['venom_edge', 'boomerang_blade', 'explosive_tags', 'blade_storm', 'clone_mastery'],
};

function setup(spec, level, seed) {
  const game = createGame({ data, name: 'Tester', seed, zone: 'test', marker: 'start' });
  const pr = game.sys.progression;
  pr.setLevel(level, { quiet: true, boons: false });
  pr.setClass('rogue', { quiet: true });
  if (spec) pr.setSpec(spec, { quiet: true });
  const n = [4, 6, 8, 10, 12].filter((l) => l <= level).length;
  for (const b of PICKS[spec || 'rogue'].slice(0, n)) pr.boons.push(b);
  game.setFlag('look_chosen', true);
  const p = game.player;
  p.data.minHp = 1;
  return { game, pr, p };
}

/** One tough enemy (elite: x2.5 hp) and four weak ones of level L that fight back; returns hp removed per second. */
function mixedFight(spec, level, seed) {
  const { game, p } = setup(spec, level, seed);
  const cx = 30, cy = 21;
  game.physics.teleport(p, cx - 3, cy);
  const hpN = Math.round(6 * Math.pow(level, 1.4) * config.numberScale);
  const tough = game.ents.spawn('rat', cx + 1, cy, { level });
  tough.hp = tough.hpMax = Math.round(hpN * 2.5);
  const enemies = [tough];
  for (const [ox, oy] of [[-2, -3], [-2, 3], [2, -3], [2, 3]]) enemies.push(game.ents.spawn('rat', cx + ox, cy + oy, { level }));
  const total = enemies.reduce((s, e) => s + e.hpMax, 0);
  const input = scriptedInput();
  const archer = spec === 'archer', ninja = spec === 'ninja';
  const want = archer ? 6 : ninja ? 3.5 : 0.7;
  let t = 0, held = -1, drawT = 0;
  const maxT = 90;
  while (t < maxT) {
    const alive = enemies.filter((e) => !e.removed && e.alive);
    if (!alive.length) break;
    // Weak ones first, then the tough one; line up on an axis (4-way attacks) at the kit's preferred range.
    alive.sort((a, b) => a.hp - b.hp || Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const tg = alive[0];
    const dx = tg.x - p.x, dy = tg.y - p.y;
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const major = horiz ? dx : dy, minor = horiz ? dy : dx;
    const d = Math.hypot(dx, dy);
    const mm = Math.abs(minor) > 0.25 ? Math.sign(minor) : 0;
    const want2 = want + tg.radius;
    const mj = Math.abs(major) > want2 + 0.3 ? Math.sign(major) : Math.abs(major) < (want > 4 ? 3 : want2 - 1.2) ? -Math.sign(major) : 0;
    let mx = horiz ? mj : mm, my = horiz ? mm : mj;
    // Step out of telegraphed bites.
    for (const e of alive) {
      if (e.ai && e.ai.windT > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 1.7) {
        const a = Math.atan2(p.y - e.y, p.x - e.x); mx = Math.round(Math.cos(a)); my = Math.round(Math.sin(a)); break;
      }
    }
    const dir = horiz ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    const inRange = Math.abs(minor) < 0.7 && Math.abs(major) < (want > 1 ? 9 : 1.3);
    const pips = game.kits.resource(p).value;
    const pressed = {};
    if (level >= 3 && !archer && d < 1.5 && game.abilities.ready(p, 'space')) pressed.space = true;
    if (level >= 5 && pips >= 4 && d < 4 && game.abilities.ready(p, 'q')) pressed.q = true;
    if (level >= 8 && game.abilities.ready(p, 'f')) {
      if (archer && pips >= 3 && d < 7) pressed.f = true;
      if (spec === 'thief' && d < 3) pressed.f = true;
      if (ninja && d < 7) pressed.f = true;
    }
    if (level >= 11 && pips >= 4 && d < 6 && game.abilities.ready(p, 'shift')) pressed.shift = true;
    let ad = inRange ? dir : -1;
    if (archer) {   // full draws on the tough one, quick taps on the weak ones
      if (held >= 0) { drawT += DT; if (drawT >= (tg === tough ? 0.85 : 0.05) || !inRange) { ad = -1; held = -1; } else ad = held; }
      else if (inRange) { held = dir; drawT = 0; ad = dir; }
    }
    input.set({ moveX: mx, moveY: my, attackDir: ad, pressed });
    game.step(DT, input.sample());
    t += DT;
  }
  const left = enemies.reduce((s, e) => s + (e.removed || !e.alive ? 0 : e.hp), 0);
  return (total - left) / t;
}

const ROWS = [['rogue', null, [3, 5]], ['archer', 'archer', [8, 10, 12]], ['thief', 'thief', [8, 10, 12]], ['ninja', 'ninja', [8, 10, 12]]];

test('mixed-fight DPS lands in the CLASSES balance band (+-15%) at levels 3 / 5 / 8 / 10 / 12', (t) => {
  const lines = ['kit      ' + [3, 5, 8, 10, 12].map((l) => ('L' + l).padStart(12)).join('')];
  const bad = [];
  for (const [name, spec, levels] of ROWS) {
    let line = name.padEnd(9);
    for (const L of [3, 5, 8, 10, 12]) {
      if (!levels.includes(L)) { line += '-'.padStart(12); continue; }
      const dps = SEEDS.reduce((s, sd) => s + mixedFight(spec, L, sd), 0) / SEEDS.length;
      const ratio = dps / TARGET[L];
      line += (dps.toFixed(1) + ' (' + (ratio * 100).toFixed(0) + '%)').padStart(12);
      if (Math.abs(ratio - 1) > BAND) bad.push(`${name} L${L}: ${dps.toFixed(1)} vs ${TARGET[L]}`);
    }
    lines.push(line);
  }
  lines.push('target   ' + [3, 5, 8, 10, 12].map((l) => String(TARGET[l]).padStart(12)).join(''));
  for (const l of lines) t.diagnostic(l);
  assert.deepEqual(bad, [], 'outside the band:\n' + lines.join('\n'));
});

// ---------------------------------------------------------------------------------------------------------------

function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const ALL_BOONS = Object.values(data.boons).filter((b) => b.class === 'rogue' || ['archer', 'thief', 'ninja'].includes(b.spec)).map((b) => b.id);

for (const spec of [null, 'archer', 'thief', 'ninja']) {
  test(`fuzz: 3000 steps of random input, everything unlocked (${spec || 'rogue'} L12, every boon)`, () => {
    const { game, pr, p } = setup(spec, 12, 3);
    for (const b of ALL_BOONS) if (!pr.boons.includes(b)) pr.boons.push(b);
    const rnd = lcg(spec ? spec.length * 77 : 5);
    game.physics.teleport(p, 30, 21);
    const npc = game.ents.create({ kind: 'townie', type: 'npc', team: 'town', name: 'Townie', x: 27, y: 21, radius: 0.3, solid: true, hp: 20, hpMax: 20,
      look: { rig: 'humanoid' }, interact: { prompt: 'Talk', range: 1.3, do: [] } });
    void npc;
    const input = scriptedInput();
    const slots = ['space', 'q', 'f', 'shift', 'interact'];
    let hits = 0;
    game.bus.on('hit', (e) => { if (e.source === p) hits++; });
    for (let i = 0; i < 3000; i++) {
      if (i % 120 === 0) {
        const n = game.ents.all.filter((e) => e.type === 'enemy' && !e.removed).length;
        for (let k = n; k < 6; k++) game.ents.spawn('rat', 26 + rnd() * 10, 17 + rnd() * 8, { level: 1 + Math.floor(rnd() * 12) });
      }
      const pressed = {}, held = {};
      for (const s of slots) { if (rnd() < 0.03) pressed[s] = true; held[s] = rnd() < 0.3; }
      input.set({ moveX: Math.round(rnd() * 2 - 1), moveY: Math.round(rnd() * 2 - 1), attackDir: rnd() < 0.7 ? Math.floor(rnd() * 4) : -1, pressed, held });
      game.step(DT, input.sample());
      if (i % 500 === 0) game.kits.setResource(p, 5);
      if (i === 1500) game.world.loadZone('test', 'start');   // summons / zones are cleared mid-fight
    }
    assert.ok(hits > 20, `fuzzing still hits things: ${hits}`);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(game.ents.all.filter((e) => e.type === 'projectile').length <= game.ents.caps.projectiles);
    game.hudState();
  });
}
