// Helpers for r3qa-progression.test.mjs: a simple xp model of a run through the four biomes (real data, real xpNext).
import data from '../../src/data/index.js';
import { xpNext } from '../../src/core/progression.js';

const CAP = 20;
const xpCurve = (l) => 5 + 3 * Math.max(1, l);
export const BIOMES = ['dunes', 'cove', 'peaks', 'aether'];

export const totalAt = (L, frac = 0) => { let x = 0; for (let l = 1; l < L; l++) x += xpNext(l); return x + frac * xpNext(L); };
export function levelOf(xp) {
  let L = 1, x = xp;
  while (L < CAP && x >= xpNext(L)) { x -= xpNext(L); L++; }
  return L + (L < CAP ? x / xpNext(L) : 0);
}
const kill = (kind, level) => {
  const d = data.enemies[kind];
  return Math.round(d.stats.xp * xpCurve(level) / xpCurve(d.level || 1));
};
export function questXp(id, mult = 1) {
  const biome = id.split('_')[0];
  return Math.round((data.quests[id].rewards?.xp || 0) * mult);
}
export function biomeQuests(biome) {
  return Object.keys(data.quests).filter((q) => data.zones[biome] && (data.quests[q].zone === biome || q.startsWith(biome + '_')));
}
export function biomeGain(biome, xpNow, { questMult = 1 } = {}) {
  const z = data.zones[biome];
  const [lo, hi] = z.levelRange;
  let xp = xpNow, kills = 0, bossXp = 0;
  for (const s of z.spawns) {
    if (!data.enemies[s.kind]) continue;
    for (let i = 0; i < (s.n || 1); i++) {
      const pl = Math.floor(levelOf(xp));
      let L = Math.max(lo, Math.min(hi, pl + (s.levelOffset || 0)));
      if (s.boss) L = Math.min(CAP + 1, L + 1);
      const g = kill(s.kind, L);
      xp += g; if (s.boss) bossXp += g; else kills++;
    }
  }
  let q = 0;
  for (const id of biomeQuests(biome)) q += questXp(id, questMult);
  xp += q;
  return { xp, kills, bossXp, quests: q };
}
export function run(order, opts = {}) {
  let xp = totalAt(11, opts.start ?? 0.25);
  const rows = [];
  for (const b of order) {
    const r = biomeGain(b, xp, opts);
    xp = r.xp;
    rows.push({ biome: b, level: levelOf(xp), kills: r.kills, boss: r.bossXp, quests: r.quests });
  }
  return rows;
}
