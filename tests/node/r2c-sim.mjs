// Round 2 (package C) balance simulation helpers: a scripted fighter that plays the real game in Node (8-way aim,
// telegraph dodging, abilities when sensible, potions), used by r2c-balance.test.mjs and by scratch scripts that
// print the tables in docs/notes/r2c.md. Not a test file (no `.test.` in the name).
import { createGame } from '../../src/core/game.js';
import data from '../../src/data/index.js';
import { createQuestions } from '../../src/questions/index.js';
import { createMemoryStorage } from '../../src/platform/storage.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

export { DT, data };
export const SPECS = { warrior: ['knight', 'berserker', 'battlemage'], mage: ['conjurer', 'sorcerer', 'monk'], rogue: ['archer', 'thief', 'ninja'] };
export const CLASS_OF = { knight: 'warrior', berserker: 'warrior', battlemage: 'warrior', conjurer: 'mage', sorcerer: 'mage', monk: 'mage',
  archer: 'rogue', thief: 'rogue', ninja: 'rogue' };
export const MATES = { warrior: ['mage', 'rogue'], mage: ['warrior', 'rogue'], rogue: ['warrior', 'mage'] };
const RANGED = new Set(['mage', 'conjurer', 'sorcerer', 'archer', 'ninja']);
// Sensible boon picks at levels 4 / 6 / 8 (the first ones of the kit DPS tests' loadouts).
export const PICKS = {
  warrior: ['cleaving_wind', 'rage_spikes', 'aftershock'], knight: ['cleaving_wind', 'rage_spikes', 'mirror_shield'],
  berserker: ['cleaving_wind', 'rage_spikes', 'cyclone'], battlemage: ['cleaving_wind', 'rage_spikes', 'elemental_overlap'],
  mage: ['frost_nova', 'mana_surge', 'arcane_orbit'], conjurer: ['arcane_orbit', 'double_blink', 'pack_leader'],
  sorcerer: ['frost_nova', 'mana_surge', 'meteor_echo'], monk: ['frost_nova', 'double_blink', 'iron_skin'],
  rogue: ['venom_edge', 'boomerang_blade', 'blade_flurry'], archer: ['venom_edge', 'boomerang_blade', 'hawk'],
  thief: ['venom_edge', 'lucky_streak', 'loaded_dice'], ninja: ['venom_edge', 'boomerang_blade', 'explosive_tags'],
};
const flush = () => new Promise((r) => setImmediate(r));
const DIR_OF = (a) => { const c = Math.cos(a), s = Math.sin(a); return Math.abs(c) >= Math.abs(s) ? (c > 0 ? 1 : 3) : (s > 0 ? 2 : 0); };

/** A game at `zone`/`marker` with a level-`level` character of `cls` (+ `spec`), its boons, optional companions. */
export function setup({ cls, spec = null, level, zone = 'forest', marker = 'boss_arena', companions = true, seed = 7, flags = [], boons = true }) {
  const game = createGame({ data, name: 'Sim', seed, test: true, storage: createMemoryStorage(), zone, marker,
    questions: createQuestions({ mode: 'auto' }) });
  game.quiet = true;
  for (const f of ['has_stick', 'tutorial_done', 'ambush_done', 'look_chosen', 'intro_done', 'class_chosen', 'forest_open'].concat(flags)) game.setFlag(f, true);
  const pr = game.progression;
  pr.setLevel(level, { quiet: true, boons: false });
  pr.setClass(cls, { quiet: true });
  if (spec) pr.setSpec(spec, { quiet: true });
  if (boons) { const n = [4, 6, 8, 10, 12].filter((l) => l <= level).length; for (const b of (PICKS[spec || cls] || []).slice(0, n)) pr.boons.push(b); }
  if (companions) game.companions.set(MATES[cls]);
  game.player.hp = game.player.hpMax;
  return game;
}

/**
 * Scripted fighter. Each step: pick the target (`pick()` or the nearest enemy), keep the kit's range, aim with the
 * 8-way attackAngle, step out of enemy telegraphs, use abilities when sensible, drink a potion below 40% hp.
 * o.profile: 'expert' (reacts at once, attacks whenever in range, abilities the moment they are ready) or 'student'
 * (the default: how a ninth grader plays a boss — attacks in bursts of 2 s with 1.2 s breaks to move and look around,
 * notices a telegraph 0.45 s late and misses one in four, uses an ability about 1.5 s after it is ready, kites ranged
 * at 6 tiles). Returns a controller with run(seconds, {pick, stop}) -> Promise.
 */
export function fighter(game, o = {}) {
  const student = o.profile !== 'expert';
  const p = game.player;
  const input = scriptedInput();
  const kit = () => game.kits.active(p);
  const id = () => kit().id;
  const ranged = () => RANGED.has(id());
  let aim = NaN;
  const st = { holdF: 0, charge: 0, potions: 0, downs: 0, t: 0, seen: new Map(), readyAt: {} };
  game.bus.on('player:down', () => { st.downs++; });
  const potion = () => {
    if (game.inventory.useItem('potion_big') || game.inventory.useItem('potion_small')) { st.potions++; return true; }
    return false;
  };
  function telegraphEscape() {
    // enemy telegraphs: circles (ground targets, rings), lines (charges, beams), cones
    for (const e of game.ents.all) {
      if (e.removed || e.type !== 'effect' || !e.look || typeof e.look.model !== 'string' || e.look.model.indexOf('telegraph_') !== 0) continue;
      const owner = e.owner != null ? game.ents.get(e.owner) : null;
      if (owner === p || (owner && owner.team === 'player') || e.team === 'player') continue;
      if (student) {   // late, and one telegraph in four is not noticed at all
        let s0 = st.seen.get(e.id);
        if (s0 == null) { s0 = game.rng.next() < 0.25 ? Infinity : game.t; st.seen.set(e.id, s0); }
        if (game.t - s0 < 0.45) continue;
      }
      const L = e.look, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      if (L.model === 'telegraph_circle' || L.model === 'telegraph_cone') {
        const r = (L.r || 1.5) + 0.6;
        if (d < r) return d > 0.05 ? Math.atan2(dy, dx) : (game.rng.next() * 6.28);
      } else if (L.model === 'telegraph_line') {
        const a = e.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
        const along = dx * ca + dy * sa, side = -dx * sa + dy * ca;
        if (along > -0.5 && along < (L.len || 6) + 0.5 && Math.abs(side) < (L.w || 0.8) / 2 + 0.8) return a + (side >= 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
    return null;
  }
  function think(target) {
    const k = id();
    const inp = { moveX: 0, moveY: 0, attackDir: -1, pressed: {}, held: {} };
    aim = NaN;
    if (p.hp < p.hpMax * (student ? 0.35 : 0.4)) potion();
    const esc = telegraphEscape();
    if (!target) { if (esc != null) { inp.moveX = Math.cos(esc); inp.moveY = Math.sin(esc); } return inp; }
    const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy);
    const want = ranged() ? (student ? 6 : 5) : target.radius + 0.75;
    const a = Math.atan2(dy, dx);
    if (esc != null) {
      inp.moveX = Math.cos(esc); inp.moveY = Math.sin(esc);
      if (game.abilities.ready(p, 'space') && (k === 'mage' || k === 'conjurer' || k === 'sorcerer' || k === 'monk' || CLASS_OF[k] === 'rogue' || k === 'rogue')) inp.pressed.space = true;
    } else if (d > want + 0.3) { inp.moveX = dx / d; inp.moveY = dy / d; }
    else if (ranged() && d < want - 1.5) { inp.moveX = -dx / d; inp.moveY = -dy / d; }
    // 8-way aim (the input layer quantizes the keys to 45 degrees)
    const a8 = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    const charger = k === 'sorcerer' || k === 'archer';
    // student: 2 s of attacking, then 1.2 s of moving and looking around (a charge kit keeps holding its key)
    const focus = !student || charger || (st.t % 3.2) < 2;
    const inRange = focus && d < (ranged() ? 8.5 : want + 0.6);
    const res = game.kits.resource(p).value;
    if (inRange) {
      if (charger) {   // charge kits: hold for a full charge, then release (a student holds a little long)
        const full = (k === 'sorcerer' ? 1.05 : 0.85) + (student ? 0.5 : 0);
        st.charge += DT;
        if (st.charge < full) { inp.attackDir = DIR_OF(a8); aim = a8; } else st.charge = 0;
      } else { inp.attackDir = DIR_OF(a8); aim = a8; }
    } else st.charge = 0;
    const near = d < want + 2.5;
    const ready = (s) => {
      const r = game.abilities.ready(p, s) && game.kits.unlocked(p, s);
      if (!r) { st.readyAt[s] = null; return false; }
      if (st.readyAt[s] == null) st.readyAt[s] = game.t;
      return !student || game.t - st.readyAt[s] >= 1.5;
    };
    if (ready('q') && (ranged() ? d < 6 : near) && res >= 30) inp.pressed.q = true;
    if (k === 'knight') {
      const winding = target.ai && target.ai.windT > 0 && d < 5;
      if (winding || st.holdF > 0) { inp.held.f = true; st.holdF = winding ? 0.4 : st.holdF - DT; }
    } else if (k === 'berserker') {
      if (near && res >= 40 && st.holdF <= 0) st.holdF = 1.5;
      if (st.holdF > 0) { inp.held.f = true; st.holdF -= DT; }
    } else if (ready('f') && (ranged() ? d < 8 : d < 4)) inp.pressed.f = true;
    if (ready('shift') && d < 6) inp.pressed.shift = true;
    if (!ranged() && k !== 'monk' && ready('space') && d > want + 1.2 && d < 3.5 && esc == null) inp.pressed.space = true;
    return inp;
  }
  // input.js may not know attackAngle yet (package A adds it): set it on the sampled state.
  const sample = () => { const s = input.sample(); s.attackAngle = aim; return s; };
  return {
    st, input,
    async run(seconds, { pick, stop } = {}) {
      const steps = Math.round(seconds / DT);
      for (let i = 0; i < steps; i++) {
        if (stop && stop()) return true;
        const target = pick ? pick() : nearestEnemy(game);
        const inp = think(target);
        input.set({ moveX: inp.moveX, moveY: inp.moveY, attackDir: inp.attackDir, pressed: inp.pressed, held: { f: !!inp.held.f } });
        game.step(DT, sample());
        st.t += DT;
        if ((i & 3) === 0) await flush();
      }
      return false;
    },
  };
}

export function nearestEnemy(game, r = 12, filter = null) {
  const p = game.player;
  let best = null, bd = r;
  for (const e of game.ents.all) {
    if (e.removed || !e.alive || e.type !== 'enemy' || e.data.down) continue;
    if (filter && !filter(e)) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/**
 * Old Mossback with both classmates at `level`: 4 small + 2 big potions, shields answered instantly (questions
 * 'auto'). Returns {toShield, total, killed, downs, potions, hpLeft}.
 */
export async function mossbackFight(spec, level = 9, o = {}) {
  const cls = CLASS_OF[spec] || spec;
  const game = setup({ cls, spec: CLASS_OF[spec] ? spec : null, level, flags: ['trig_forest_boss_intro', 'gate_grove_seal', 'spec_ceremony_done'], seed: o.seed || 7 });
  game.inventory.give('potion_small', 4, { silent: true });
  game.inventory.give('potion_big', 2, { silent: true });
  const boss = game.ents.all.find((e) => e.kind === 'old_mossback' && !e.removed);
  if (!boss) throw new Error('no Mossback in the arena');
  let shieldT = null, t0 = null;
  game.bus.on('boss:shield', (e) => { if (e.on && !e.retry && e.index === 0 && shieldT == null) shieldT = game.t; });
  const f = fighter(game, { profile: o.profile });
  // the fight starts when Mossback notices you (he wakes up at his spawn, 5 tiles north of the arena center)
  t0 = game.t;
  const pick = () => {
    const thorn = nearestEnemy(game, 2.2, (e) => e !== boss);
    return thorn || (boss.alive && !boss.removed ? boss : nearestEnemy(game));
  };
  const cap = o.cap || 240;
  const dead = () => !!game.flags.mossback_defeated || (!boss.alive && boss.hp <= 0);
  await f.run(cap, { pick, stop: () => dead() || f.st.downs > 0 || boss.removed });
  const killed = dead();
  return { spec, level, toShield: shieldT != null ? shieldT - t0 : null, total: killed ? game.t - t0 : null, killed,
    downs: f.st.downs, potions: f.st.potions, bossFrac: boss.hpMax ? Math.max(0, boss.hp) / boss.hpMax : 0 };
}
