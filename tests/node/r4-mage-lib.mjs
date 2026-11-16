// Round 4 mage masteries: shared test helpers (no tests in this file). Equips a mastery directly with
// game.kits.set(p, 'mage', '<mastery>') on top of the kit-mage harness (progression keeps the subclass).
import { config } from '../../src/config.js';
import { mk, bot, DT } from './kit-mage-lib.test.mjs';

export const MASTERIES = { summoner: 'conjurer', illusionist: 'conjurer', stormcaller: 'sorcerer', pyromancer: 'sorcerer', sage: 'monk', mystic: 'monk' };

/** mk() with a mastery: the subclass through progression (+ debug.setMastery when another package added it), then the kit. */
export function mkM(mastery, level = 16, boons = [], opts = {}) {
  const sub = MASTERIES[mastery] || null;
  const ctx = mk(sub, level, boons, opts);
  if (mastery && MASTERIES[mastery]) {
    const pr = ctx.game.sys.progression;   // equip the way the game does; the core keeps the kit in sync
    if (pr && typeof pr.setMastery === 'function') { try { pr.setMastery(mastery, { quiet: true }); } catch { /* fall through */ } }
    if (ctx.p.data.masteryId !== mastery) ctx.game.kits.set(ctx.p, 'mage', mastery);
    ctx.step(1);
    ctx.rec.reset();
  }
  return ctx;
}

/** The kit-mage bot plus the mastery habits: the Summoner keeps its legion full. */
export function botM(ctx, st) {
  const inp = bot(ctx, st);
  const { game, p } = ctx;
  if (p.data.masteryId === 'summoner' && game.kits.unlocked(p, 'f') && game.abilities.ready(p, 'f')) {
    const res = game.kits.resource(p);
    const n = game.combat.summonsOf(p, 'familiar', []).length;
    const want = n < 5 && res.value >= 30;
    inp.held.f = want && !st.hfm;
    st.hfm = want;
  }
  return inp;
}

/** Mixed fight (kit-mage-lib) with a mastery. */
export function mixedFightM(mastery, level, boons = [], cap = 45, seed = 21) {
  const ctx = mkM(mastery, level, boons, { marker: 'start', seed });
  const { game, p, input } = ctx;
  game.companions && game.companions.set([]);
  const base = 6 * Math.pow(level, 1.4) * config.numberScale;
  const foes = [];
  const t = game.ents.spawn('boar', p.x + 7, p.y, { level, ai: { aggro: 12, leash: 0 } });
  t.hpMax = t.hp = Math.round(base * 2.5);
  foes.push(t);
  for (let i = 0; i < 4; i++) {
    const a = -0.9 + i * 0.6;
    const w = game.ents.spawn('rat', p.x + 6 + Math.cos(a) * 1.5, p.y + Math.sin(a) * 2.5, { level, ai: { aggro: 12, leash: 0 } });
    w.hpMax = w.hp = Math.round(base);
    foes.push(w);
  }
  const total = foes.reduce((s, e) => s + e.hpMax, 0);
  const st = {};
  let steps = 0;
  const max = Math.round(cap / DT);
  let healed = 0;
  game.bus.on('heal', (e) => { if (e.target && e.target !== p) healed += e.amount || 0; });
  while (steps < max && foes.some((e) => e.alive && !e.removed)) {
    if (steps % 2 === 0) input.set(botM(ctx, st));
    game.step(DT, input.sample());
    steps++;
  }
  const left = foes.reduce((s, e) => s + (e.alive && !e.removed ? Math.max(0, e.hp) : 0), 0);
  const secs = steps * DT;
  return { dps: (total - left) / secs, secs, cleared: left === 0, total, healed };
}
export const SEEDS = Array.from({ length: 12 }, (_, i) => 21 + i);
/**
 * Mean mixed-fight DPS over `seeds` (12 by default). The masteries use the MEAN, not the median of kit-mage-lib:
 * ultimates that taunt or follow crowds make the per-seed results bimodal, and a median then flips between the modes.
 */
export function meanDpsM(mastery, level, seeds = SEEDS) {
  const rs = seeds.map((sd) => mixedFightM(mastery, level, [], 45, sd)).sort((a, b) => a.dps - b.dps);
  const m = rs.length >> 1;
  const median = rs.length % 2 ? rs[m].dps : (rs[m - 1].dps + rs[m].dps) / 2;
  const dps = rs.reduce((a, r) => a + r.dps, 0) / rs.length;
  const healed = rs.reduce((a, r) => a + r.healed, 0) / rs.length;
  return { dps, median, healed, secs: rs.reduce((a, r) => a + r.secs, 0) / rs.length, cleared: rs.filter((r) => r.cleared).length / rs.length,
    runs: rs.map((r) => r.dps) };
}
