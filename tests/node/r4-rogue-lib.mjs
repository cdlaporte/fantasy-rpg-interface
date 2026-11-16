// Round 4 rogue masteries: the shared test rig (setup + mixed-fight DPS), used by r4-rogue.test.mjs and
// r4-rogue-dps.test.mjs. Same fight as tests/node/kit-rogue-dps.test.mjs (one elite rat x2.5 hp + four normal rats of the
// level, fighting back; scripted sensible play; the subclass boon picks), with a mastery equipped on top of the subclass.
import { createGame } from '../../src/core/game.js';
import { config } from '../../src/config.js';
import data from '../../src/data/index.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

export const MASTERIES = [
  ['ranger', 'archer'], ['sharpshooter', 'archer'],
  ['trickster', 'thief'], ['swashbuckler', 'thief'],
  ['windwalker', 'ninja'], ['smokestep', 'ninja'],
];
export const SUB_OF = Object.fromEntries(MASTERIES);
export const SEEDS = [7, 11, 23, 31, 42, 57, 64, 99];
/** Round 3 band (62 x (L/12)^1.4, x number scale) and the mastery target: +15% (docs/MASTERY.md). */
export const band = (L) => 62 * Math.pow(L / 12, 1.4) * config.numberScale;
export const masteryTarget = (L) => band(L) * 1.15;
export const PICKS = {
  archer: ['venom_edge', 'boomerang_blade', 'hawk', 'split_arrow', 'rain_of_fire', 'ricochet_arrows', 'explosive_arrow', 'adrenaline_rush', 'toxic_fan'],
  thief: ['venom_edge', 'lucky_streak', 'loaded_dice', 'coin_toss', 'vanishing_act', 'sleight_of_hand', 'golden_touch', 'adrenaline_rush', 'toxic_fan'],
  ninja: ['venom_edge', 'boomerang_blade', 'explosive_tags', 'blade_storm', 'clone_mastery', 'kunai_fan', 'smoke_screen', 'adrenaline_rush', 'toxic_fan'],
};

/** A rogue of `level` with subclass `sub` and (optionally) `mastery` equipped directly on the kit layer. */
export function setup(sub, mastery, level, seed, { boons = true } = {}) {
  const game = createGame({ data, name: 'Tester', seed, zone: 'test', marker: 'start' });
  const pr = game.sys.progression;
  pr.setLevel(level, { quiet: true, boons: false });
  pr.setClass('rogue', { quiet: true });
  pr.setSpec(sub, { quiet: true });
  if (boons) {
    const n = [4, 6, 8, 10, 12, 14, 16, 18, 20].filter((l) => l <= level).length;
    for (const b of PICKS[sub].slice(0, n)) pr.boons.push(b);
  }
  game.setFlag('look_chosen', true);
  const p = game.player;
  p.data.minHp = 1;
  if (mastery) equipMastery(game, mastery);
  return { game, pr, p };
}
/** Equip a mastery: Core's `debug.setMastery` / progression when present, else the kit layer directly. */
export function equipMastery(game, mastery) {
  const p = game.player;
  const dbg = game.debug || (game.sys && game.sys.debug);
  if (dbg && typeof dbg.setMastery === 'function') { try { dbg.setMastery(mastery); } catch { /* fall through */ } }
  if (!p.data.masteryId || p.data.masteryId !== mastery) game.kits.set(p, 'rogue', mastery);
}

/** One tough enemy (elite: x2.5 hp) and four weak ones of level L that fight back; returns hp removed per second. */
export function mixedFight(sub, mastery, level, seed, onGame) {
  const { game, p } = setup(sub, mastery, level, seed);
  if (onGame) onGame(game, p);
  const cx = 30, cy = 21;
  game.physics.teleport(p, cx - 3, cy);
  const hpN = Math.round(6 * Math.pow(level, 1.4) * config.numberScale);
  const tough = game.ents.spawn('rat', cx + 1, cy, { level });
  tough.hp = tough.hpMax = Math.round(hpN * 2.5);
  const enemies = [tough];
  for (const [ox, oy] of [[-2, -3], [-2, 3], [2, -3], [2, 3]]) {
    const w = game.ents.spawn('rat', cx + ox, cy + oy, { level });
    w.hp = w.hpMax = hpN;
    enemies.push(w);
  }
  const total = enemies.reduce((s, e) => s + e.hpMax, 0);
  const input = scriptedInput();
  const archer = sub === 'archer', ninja = sub === 'ninja';
  const want = archer ? 6 : ninja ? 3.5 : 0.7;
  const ultAt = mastery ? 15 : 11;
  let t = 0, held = -1, drawT = 0;
  const maxT = 90;
  while (t < maxT) {
    const alive = enemies.filter((e) => !e.removed && e.alive);
    if (!alive.length) break;
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
    for (const e of alive) {
      if (e.ai && e.ai.windT > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 1.7) {
        const a = Math.atan2(p.y - e.y, p.x - e.x); mx = Math.round(Math.cos(a)); my = Math.round(Math.sin(a)); break;
      }
    }
    const dir = horiz ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    const inRange = Math.abs(minor) < 0.7 && Math.abs(major) < (want > 1 ? 9 : 1.3);
    const pips = game.kits.resource(p).value;
    const pressed = {};
    // the Ranger rolls away from a biter (and leaves a trap); the other archers never roll (as in round 3)
    if (level >= 3 && (!archer || mastery === 'ranger') && d < 1.5 && game.abilities.ready(p, 'space')) pressed.space = true;
    if (level >= 5 && pips >= 4 && d < 4 && game.abilities.ready(p, 'q')) pressed.q = true;
    if (level >= 8 && game.abilities.ready(p, 'f')) {
      if (archer && pips >= 3 && d < 7) pressed.f = true;
      if (sub === 'thief' && d < 3) pressed.f = true;
      if (ninja && d < 7) pressed.f = true;
    }
    if (level >= ultAt && pips >= 4 && d < 6 && game.abilities.ready(p, 'shift')) pressed.shift = true;
    let ad = inRange ? dir : -1;
    if (archer) {
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
export const meanDps = (sub, mastery, L, seeds = SEEDS) => seeds.reduce((s, sd) => s + mixedFight(sub, mastery, L, sd), 0) / seeds.length;
