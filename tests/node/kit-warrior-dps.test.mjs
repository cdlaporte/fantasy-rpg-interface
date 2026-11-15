// Warrior family: mixed-fight DPS in the CLASSES balance band, 3000-step no-throw fuzz with everything unlocked,
// save/load restores a working kit. Run this file alone to print the DPS table (KIT_DPS_TABLE=1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import { config } from '../../src/config.js';
import data from '../../src/data/index.js';
import { DT, makeInputState } from '../../src/contracts.js';
import { mk } from './kit-warrior.test.mjs';

export const TARGET = Object.fromEntries(Object.entries({ 3: 10, 5: 17, 8: 30, 10: 40, 12: 52 }).map(([k, v]) => [k, v * config.numberScale]));   // CLASSES band x number scale
// A sensible boon pick per spec (boons at 4, 6, 8, 10, 12; at least one spec boon from 8).
export const LOADOUT = {
  warrior: ['cleaving_wind', 'rage_spikes', 'aftershock', 'ricochet_bash', 'blazing_bash'],
  knight: ['cleaving_wind', 'rage_spikes', 'mirror_shield', 'earthsplitter', 'aftershock'],
  berserker: ['cleaving_wind', 'rage_spikes', 'cyclone', 'axe_storm', 'meteor_heart'],
  battlemage: ['cleaving_wind', 'rage_spikes', 'elemental_overlap', 'twin_runes', 'encore'],
};
export const boonsAt = (spec, level) => LOADOUT[spec || 'warrior'].slice(0, [4, 6, 8, 10, 12].filter((l) => l <= level).length);
const dirTo = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));

/**
 * Mixed fight: one tough enemy (an elite giant rat of level L with 8x its hp, so it lasts the whole fight) and four
 * level-L rats, all with AI, in the test zone. Scripted sensible play: walk to the nearest enemy and hold the
 * attack toward it, Bash at mid range, War Cry with Rage, Shield Wall timed on enemy windups (Knight), Whirlwind
 * when crowded (Berserker), Rune Shift on cooldown (Battlemage), ultimates when ready. The player is topped up 20%
 * every 4 s (potions / classmates) and has an hp floor of 1. DPS = effective damage (capped by remaining hp) per
 * second until everything is dead or 45 s.
 */
export function fight(spec, level, seed = 3) {
  const g = mk({ spec, level, ring: 0, at: { x: 11, y: 19 }, seed, boons: boonsAt(spec, level) });
  const { game, p } = g;
  const tough = game.ents.spawn('giant_rat', 15, 19, { level });
  tough.hp = tough.hpMax = tough.hpMax * 8;
  const foes = [tough];
  for (let i = 0; i < 4; i++) foes.push(game.ents.spawn('rat', 11 + Math.cos(i * 1.6) * 3, 19 + Math.sin(i * 1.6) * 3, { level }));
  const hp = new Map(foes.map((f) => [f.id, f.hp]));
  let eff = 0;
  game.bus.on('hit', (e) => { if (!hp.has(e.target.id)) return; const h = hp.get(e.target.id); const d = Math.min(h, e.amount); eff += d; hp.set(e.target.id, h - d); });
  let t = 0;
  const f = { held: false, t: 0 };
  const res = () => game.kits.resource(p).value;
  for (let i = 0; i < 45 / DT; i++) {
    const alive = foes.filter((e) => e.alive && !e.removed);
    if (!alive.length) break;
    t += DT;
    if (i % 240 === 0) p.hp = Math.min(p.hpMax, p.hp + Math.round(p.hpMax * 0.2));
    let tgt = null, bd = 1e9;
    for (const e of alive) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; tgt = e; } }
    const dx = tgt.x - p.x, dy = tgt.y - p.y;
    const near = alive.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 2.2).length;
    const inp = { attackDir: dirTo(dx, dy), moveX: bd > 1 ? dx / bd : 0, moveY: bd > 1 ? dy / bd : 0, pressed: {}, held: {} };
    if (bd > 1.6 && bd < 3.2 && game.abilities.ready(p, 'space')) inp.pressed.space = true;
    if (level >= 5 && res() >= 30 && near >= 1 && game.abilities.ready(p, 'q')) inp.pressed.q = true;
    if (level >= 11 && spec && game.abilities.ready(p, 'shift')) {
      const cost = spec === 'knight' ? 50 : spec === 'battlemage' ? 40 : 0;
      if (res() >= cost && near >= 1) inp.pressed.shift = true;
    }
    if (level >= 8 && spec === 'knight') {
      const winding = alive.some((e) => e.ai && e.ai.windT > 0 && e.ai.windT < 0.22 && Math.hypot(e.x - p.x, e.y - p.y) < 2.5);
      if (!f.held && winding) { f.held = true; f.t = 0; }
      if (f.held) { f.t += DT; if (f.t > 0.45) f.held = false; }
      inp.held.f = f.held;
    }
    if (level >= 8 && spec === 'berserker') {
      if (!f.held && res() >= 50 && near >= 2) f.held = true;
      if (f.held && (res() < 8 || near === 0)) f.held = false;
      inp.held.f = f.held;
    }
    if (level >= 8 && spec === 'battlemage' && near >= 1 && game.abilities.ready(p, 'f')) inp.pressed.f = true;
    g.step(1, inp);
  }
  return { dps: eff / t, t };
}
export function avgDps(spec, level, n = 8) {
  let s = 0;
  for (let k = 0; k < n; k++) s += fight(spec, level, 3 + k).dps;
  return s / n;
}

test('mixed-fight DPS: Warrior (3, 5) then each spec (8, 10, 12) inside the balance band (+-15%) and within +-15% of each other', () => {
  const rows = {};
  for (const lv of [3, 5]) rows['warrior@' + lv] = avgDps(null, lv);
  for (const spec of ['knight', 'berserker', 'battlemage']) for (const lv of [8, 10, 12]) rows[spec + '@' + lv] = avgDps(spec, lv);
  if (process.env.KIT_DPS_TABLE) console.log(JSON.stringify(rows, null, 1));
  for (const k in rows) {
    const lv = +k.split('@')[1];
    const r = rows[k] / TARGET[lv];
    assert.ok(r > 0.85 && r < 1.15, `${k}: ${rows[k].toFixed(1)} vs target ${TARGET[lv]}`);
  }
  for (const lv of [8, 10, 12]) {
    const v = ['knight', 'berserker', 'battlemage'].map((s) => rows[s + '@' + lv]);
    const mean = v.reduce((a, b) => a + b, 0) / 3;
    for (const x of v) assert.ok(Math.abs(x / mean - 1) < 0.15, `L${lv} specs within 15%: ${v.map((y) => y.toFixed(1))}`);
  }
});

test('fuzz: 3000 steps of random input with all abilities and boons unlocked, for the class and each spec', () => {
  const all = Object.values(data.boons).filter((b) => b.class === 'warrior' || ['knight', 'berserker', 'battlemage'].includes(b.spec)).map((b) => b.id);
  for (const spec of [null, 'knight', 'berserker', 'battlemage']) {
    const g = mk({ spec, level: 12, boons: all, ring: 6, r: 2, ai: true, hp: 400, seed: 21 });
    g.game.companions.set(spec === 'knight' ? ['mage', 'rogue'] : ['rogue']);
    const rng = g.game.rng;
    const errs = [];
    let casts = 0, holdF = false;
    g.game.bus.on('ability:cast', () => casts++);
    for (let i = 0; i < 3000; i++) {
      const r = () => rng.next();
      const inp = {
        moveX: r() < 0.3 ? 0 : r() * 2 - 1, moveY: r() < 0.3 ? 0 : r() * 2 - 1,
        attackDir: r() < 0.35 ? -1 : Math.floor(r() * 4),
        pressed: { space: r() < 0.03, q: r() < 0.03, f: r() < 0.05, shift: r() < 0.02 },
        held: { f: (holdF = r() < 0.06 ? !holdF : holdF) },
      };
      if (i % 400 === 0) { g.setRage(100); g.game.abilities.reset(g.p); }
      if (i % 500 === 250) for (let k = 0; k < 3; k++) g.game.ents.spawn('rat', g.p.x + 2 * Math.cos(k * 2), g.p.y + 2 * Math.sin(k * 2), { level: 10 });
      if (i % 700 === 350) g.game.combat.projectile(g.foes[0].removed ? g.p : g.foes[0], { angle: 0, speed: 10, range: 8, dmg: 1 });
      try { g.step(1, inp); } catch (e) { errs.push(e); break; }
      const p = g.p;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.hp) || !Number.isFinite(g.rage())) { errs.push(new Error('NaN at ' + i)); break; }
      if (i % 600 === 0) g.game.frame(0.5);
    }
    assert.deepEqual(errs.map((e) => e.stack || String(e)), [], spec || 'warrior');
    assert.ok(casts > 20, 'abilities were cast: ' + casts);
    assert.ok(g.dealt > 0);
    g.game.hudState();
  }
});

test('save/load of class, spec, boons and level restores a working kit', () => {
  for (const spec of ['knight', 'berserker', 'battlemage']) {
    const g = mk({ spec, level: 12, boons: ['cleaving_wind', 'unstoppable'], ring: 0 });
    const json = g.game.save.now();
    const again = createGame({ data, name: 'Tester', seed: 7, zone: 'test', storage: g.game.storage, save: g.game.save.load('Tester') });
    const p = again.player;
    assert.equal(again.progression.specId, spec);
    assert.equal(again.kits.active(p).id, spec);
    assert.equal(again.kits.active(p).classId, 'warrior');
    assert.ok(p.data.kit && (p.data.kit.kn || p.data.kit.bz || p.data.kit.bm), 'spec state initialised');
    assert.deepEqual(again.progression.boons, ['cleaving_wind', 'unstoppable']);
    assert.ok(json.systems.progression);
    const e = again.ents.spawn('rat', p.x + 1, p.y, { noAi: true, hp: 999 });
    let dealt = 0;
    again.bus.on('hit', (h) => { if (h.source === p) dealt += h.amount; });
    const inp = makeInputState();
    inp.attackDir = 1;
    for (let i = 0; i < 60; i++) { inp.attackPressed = i === 0 ? 1 : -1; again.step(DT, inp); }
    assert.ok(dealt > 0 && e.hp < 999, spec + ' attacks after load');
    assert.equal(again.hudState().abilities[2].unlocked, true);
  }
});
