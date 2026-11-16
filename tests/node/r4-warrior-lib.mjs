// Round 4 warrior masteries: shared harness for r4-warrior*.test.mjs (a mastery equipped directly with kits.set,
// as the core's setMastery may not exist on this branch) and the mixed-fight DPS rig (same fight as
// kit-warrior-dps.test.mjs, docs/notes/kit-warrior.md, with the mastery on top of its subclass).
import { config } from '../../src/config.js';
import { DT } from '../../src/contracts.js';
import { mk } from './kit-warrior.test.mjs';

export const PARENT = { paladin: 'knight', sentinel: 'knight', warlord: 'berserker', juggernaut: 'berserker', spellblade: 'battlemage', runeguard: 'battlemage' };
// the subclass loadouts of kit-warrior-dps.test.mjs (copied: importing that file would run its tests here too)
const LOADOUT = {
  knight: ['cleaving_wind', 'rage_spikes', 'mirror_shield', 'earthsplitter', 'aftershock', 'judgement', 'hallowed_ground', 'thunder_clap', 'juggernaut'],
  berserker: ['cleaving_wind', 'rage_spikes', 'cyclone', 'axe_storm', 'meteor_heart', 'rampage', 'whirling_axes', 'thunder_clap', 'war_banner'],
  battlemage: ['cleaving_wind', 'rage_spikes', 'elemental_overlap', 'twin_runes', 'encore', 'trinity_slash', 'elemental_crown', 'thunder_clap', 'war_banner'],
};
export const MASTERIES = Object.keys(PARENT);
/** Round 3 band (62 x (L/12)^1.4) x 1.15 for masteries (docs/MASTERY.md: ~89 / 107 / 125 / 146 at 14 / 16 / 18 / 20), x number scale. */
export const MTARGET = (L) => 62 * Math.pow(L / 12, 1.4) * 1.15 * config.numberScale;
const boonsAt = (spec, level) => LOADOUT[spec].slice(0, [4, 6, 8, 10, 12, 14, 16, 18, 20].filter((l) => l <= level).length);
const dirTo = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));

/** Equip mastery m the way the game does (progression.setMastery keeps the kit in sync); kits.set as a fallback. */
export function equipM(g, m) {
  const pr = g.game.sys.progression;
  if (pr && typeof pr.setMastery === 'function') { try { pr.setMastery(m, { quiet: true }); } catch { /* fall through */ } }
  if (g.p.data.masteryId !== m) g.game.kits.set(g.p, 'warrior', m);
}

/** A warrior game with mastery `m` equipped (o as kit-warrior mk: level, boons, ring, r, hp, ai, seed, at). */
export function mkM(m, o = {}) {
  const g = mk(Object.assign({ level: 16 }, o, { spec: PARENT[m] || m }));
  if (PARENT[m]) equipM(g, m);
  return g;
}

/** The kit-warrior mixed fight (one tough elite + four rats of level L, AI on, 45 s max) with mastery m. */
export function fightM(m, level, seed = 3, trace = null) {
  const spec = PARENT[m] || m;   // a subclass id measures the subclass alone in the same rig
  const g = mkM(m, { level, ring: 0, at: { x: 11, y: 19 }, seed, boons: boonsAt(spec, level) });
  const { game, p } = g;
  const sheet = 6 * Math.pow(level, 1.4) * config.numberScale;
  const tough = game.ents.spawn('giant_rat', 15, 19, { level });
  tough.hp = tough.hpMax = Math.round(sheet * 2 * 8);
  const foes = [tough];
  for (let i = 0; i < 4; i++) {
    const r = game.ents.spawn('rat', 11 + Math.cos(i * 1.6) * 3, 19 + Math.sin(i * 1.6) * 3, { level });
    r.hp = r.hpMax = Math.round(sheet);
    foes.push(r);
  }
  const hp = new Map(foes.map((f) => [f.id, f.hp]));
  let eff = 0;
  game.bus.on('hit', (e) => { if (!hp.has(e.target.id)) return; const h = hp.get(e.target.id); const d = Math.min(h, e.amount); eff += d; hp.set(e.target.id, h - d); });
  let t = 0;
  const f = { held: false, t: 0 };
  const path = { ok: false, out: [] };
  const res = () => game.kits.resource(p).value;
  const ultCost = (game.kits.ability(p, 'shift') || {}).cost || 0;
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
    // walk around walls (a straight-line chase gets stuck on the test zone's wall blocks after leaps / knockback,
    // which made the measurement depend on where the fight drifted): follow the A* path when the line is blocked
    if (bd > 1 && i % 6 === 0) { path.ok = !game.world.walkable(p.x, p.y, tgt.x, tgt.y, p.radius) && game.world.findPath(p.x, p.y, tgt.x, tgt.y, path.out) && path.out.length >= 2; }
    if (bd > 1 && path.ok) { const wx = path.out[0] - p.x, wy = path.out[1] - p.y, wd = Math.hypot(wx, wy) || 1; inp.moveX = wx / wd; inp.moveY = wy / wd; }
    if (bd > 1.6 && bd < 3.2 && game.abilities.ready(p, 'space')) inp.pressed.space = true;
    if (res() >= 30 && near >= 1 && game.abilities.ready(p, 'q')) inp.pressed.q = true;
    if (game.abilities.ready(p, 'shift') && res() >= ultCost && near >= 1) inp.pressed.shift = true;
    if (spec === 'knight') {
      const winding = alive.some((e) => e.ai && e.ai.windT > 0 && e.ai.windT < 0.22 && Math.hypot(e.x - p.x, e.y - p.y) < 2.5);
      if (!f.held && winding) { f.held = true; f.t = 0; }
      if (f.held) { f.t += DT; if (f.t > 0.45) f.held = false; }
      inp.held.f = f.held;
    }
    if (spec === 'berserker') {
      if (!f.held && res() >= 50 && near >= 2) f.held = true;
      if (f.held && (res() < 8 || near === 0)) f.held = false;
      inp.held.f = f.held;
    }
    if (spec === 'battlemage' && near >= 1 && game.abilities.ready(p, 'f')) inp.pressed.f = true;
    g.step(1, inp);
    if (trace) trace(i, g, inp);
  }
  return { dps: eff / t, t, g };
}
export function avgDpsM(m, level, n = 8) {
  let s = 0;
  for (let k = 0; k < n; k++) s += fightM(m, level, 3 + k).dps;
  return s / n;
}
