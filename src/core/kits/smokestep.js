// SMOKESTEP mastery (tier 3 over the Ninja; docs/MASTERY.md). The stealthy assassin.
// Passive Shadowmeld: Shadow Step also turns you invisible for 2 s (status `stealth`: enemies lose you), and for 2.5 s
// your next hit is an Assassinate: a x3.5 critical with a crimson `slash` X, smoke and "Assassinate!".
// Ultimate Smoke Assassins (Shift finisher, level 15): you vanish in a burst of smoke and three shadow assassins (four
// at full pips) appear; for 6 s each one teleports from enemy to enemy every 0.5 s (smoke where it left, a puff where
// it lands behind its victim) and strikes with a dagger. They cannot be targeted. They do not throw shuriken.
// Numbers: data.specs.smokestep.kit. State: p.data.kit.sm.
import { spendPips } from './rogue.js';
import ninja from './ninja.js';
import specdefs from '../../data/specs/rogue.js';
import { clone } from '../ents.js';
import { angleTo } from '../math.js';

const ID = 'smokestep';
const U = specdefs[ID].ultimate;
const MK = (game) => game.data.specs[ID].kit;
const isEnemy = (e) => e.type === 'enemy';
const TAG_ASSASSIN = Object.freeze(['smokestep_assassin']);
const LABEL_READY = 'Assassinate ready';
const LABEL_ULT = 'Smoke Assassins';

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
function masteryScale(game, p) { const k = MK(game); return (k.dmgScale != null ? k.dmgScale : 1) * interp(k.lateScale, game.kits.level(p)); }

// ---------- Shadowmeld (wraps Shadow Step) ----------
const STEP = ninja.abilities.f;
const f = Object.assign({}, STEP, {
  desc: 'Appear behind the nearest enemy and vanish for 2 seconds; your next hit is an Assassinate. A decoy takes your place.',
  cast(game, p, ctx) {
    const r = STEP.cast(game, p, ctx);
    const sm = p.data.kit.sm;
    if (r !== false && sm) {
      const S = MK(game).shadowmeld, C = MK(game).colors;
      game.combat.status(p, 'stealth', S.stealth, S.speed);
      sm.markUntil = game.t + S.window;
      game.fx({ type: 'smoke', x: p.x, y: p.y, r: 0.9, dur: 0.8 });
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 8, r: 0.5, color: C.blood });
      sm.melds++;
    }
    return r;
  },
});

// ---------- Smoke Assassins ----------
function assassins(game, p) {
  const K = MK(game), A = K.assassins, C = K.colors, sm = p.data.kit.sm;
  const pips = spendPips(game, p);
  const n = pips >= game.kits.resource(p).max ? A.nFull : A.n;
  endAssassins(game, p);
  for (let i = 0; i < n; i++) {
    const a = p.angle + (i / n) * Math.PI * 2;
    const look = clone(p.look);
    look.aura = { style: 'shadow', color: C.main };
    if (look.outfit) look.outfit = Object.assign({}, look.outfit, { primary: C.smoke, secondary: '#000000' });
    let x = p.x + Math.cos(a) * 1.2, y = p.y + Math.sin(a) * 1.2;
    if (game.world.solidAt(x, y)) { x = p.x; y = p.y; }
    const c = game.combat.summon(p, { id: 'smoke_assassin', name: 'Smoke Assassin', look, stats: { radius: p.radius } }, {
      x, y, brain: 'none', fxTag: 'shadow', ttl: A.dur, power: game.combat.powerOf(p), hp: Math.max(5, Math.round(p.hpMax * A.hpMul)),
      key: 'smoke_assassin', color: C.main, tags: ['clone'], fx: false,
      onExpire: (g, e) => { g.fx({ type: 'smoke', x: e.x, y: e.y, r: 0.8, dur: 0.7 }); } });
    c.alpha = 0.55;
    c.data.untargetable = true;
    c.data.smT = 0.15 + i * (A.every / n);
    sm.assassins.push(c.id);
    game.fx({ type: 'smoke', x, y, r: 0.8, dur: 0.8 });
    game.fx({ type: 'poof', x, y, color: C.main });
  }
  game.combat.status(p, 'stealth', A.stealth, 0.25);
  game.fx({ type: 'screenFlash', color: C.smoke, dur: 0.22 });
  game.fx({ type: 'smoke', x: p.x, y: p.y, r: 2.8, dur: 1.4 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 2.6, color: C.blood, dur: 0.5 });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.8, text: 'Smoke Assassins!', style: 'crit' });
  game.camera.shake = Math.max(game.camera.shake, 0.4);
  game.ents.setAnim(p, 'cast', 0.3);
  sm.casts++;
}
function endAssassins(game, p) {
  const sm = p.data.kit.sm;
  for (const id of sm.assassins) { const c = game.ents.get(id); if (c && !c.removed) game.combat.expireSummon(c, 'dismiss'); }
  sm.assassins.length = 0;
}
function updateAssassins(game, p, dt) {
  const sm = p.data.kit.sm, K = MK(game), A = K.assassins, C = K.colors;
  for (let i = sm.assassins.length - 1; i >= 0; i--) {
    const c = game.ents.get(sm.assassins[i]);
    if (!c || c.removed || !c.alive) { sm.assassins[i] = sm.assassins[sm.assassins.length - 1]; sm.assassins.pop(); continue; }
    c.vx = 0; c.vy = 0;
    c.data.smT -= dt;
    if (c.data.smT > 0) continue;
    c.data.smT = A.every;
    // Pick a victim near you: a different one per assassin when possible (least recently struck first).
    const list = game.ents.inRadius(p.x, p.y, A.range, isEnemy, sm.scratch);
    let best = null, bs = Infinity;
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!game.combat.canHit(p, e)) continue;
      const s = (e.data.smStruckT || -99) + Math.hypot(e.x - c.x, e.y - c.y) * 0.05;
      if (s < bs) { bs = s; best = e; }
    }
    if (!best) {
      // nobody to stalk: drift back beside you in a puff
      if (Math.hypot(c.x - p.x, c.y - p.y) > 2.5) { game.fx({ type: 'smoke', x: c.x, y: c.y, r: 0.5, dur: 0.5 }); game.physics.teleport(c, p.x - Math.cos(p.angle) * 1.2, p.y - Math.sin(p.angle) * 1.2); }
      continue;
    }
    best.data.smStruckT = game.t;
    const x0 = c.x, y0 = c.y;
    const ba = (best.angle || 0) + Math.PI;
    const d = best.radius + c.radius + 0.3;
    let bx = best.x + Math.cos(ba) * d, by = best.y + Math.sin(ba) * d;
    if (game.world.solidAt(bx, by)) { bx = best.x; by = best.y; }
    game.fx({ type: 'smoke', x: x0, y: y0, r: 0.6, dur: 0.6 });
    game.fx({ type: 'afterimage', x: x0, y: y0, ent: c.id, color: C.main });
    game.physics.teleport(c, bx, by);
    c.angle = angleTo(c.x, c.y, best.x, best.y);
    game.ents.setAnim(c, 'attack', 0.2);
    game.fx({ type: 'poof', x: c.x, y: c.y, color: C.smoke });
    game.combat.damage(best, A.coef * game.combat.powerOf(p), { source: p, type: 'melee', critChance: A.critChance, knockback: 1.5, tags: TAG_ASSASSIN,
      color: C.blood, keepStealth: true });
    game.fx({ type: 'slash', x: best.x, y: best.y, angle: c.angle, arc: 100, r: 0.8, color: C.blood, style: 'claw' });
    game.fx({ type: 'slash', x: best.x, y: best.y, angle: c.angle + 0.6, arc: 60, r: 0.7, color: C.pale, style: 'dagger' });
    sm.strikes++;
  }
}

export default {
  id: ID, parent: 'ninja', tier: 3,

  onEquip(game, p) {
    p.data.kit.sm = { markUntil: 0, asTick: -1, asTarget: 0, assassins: [], scratch: [], melds: 0, assassinations: 0, casts: 0, strikes: 0 };
  },
  onUnequip(game, p) {
    if (p.data.kit.sm) endAssassins(game, p);
  },

  update(game, p, dt) {
    const sm = p.data.kit.sm;
    if (!sm) return;
    if (sm.assassins.length) updateAssassins(game, p, dt);
    if (game.t <= sm.markUntil && (game.tick % 10) === 0) game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 2, r: 0.4, color: MK(game).colors.blood });
  },

  hud(game, p, hud) {
    const sm = p.data.kit.sm, kh = game.kits.kitHud;
    hud.kitHud = kh;
    if (!sm) return;
    if (sm.assassins.length) kh.label = LABEL_ULT;
    else if (game.t <= sm.markUntil) kh.label = LABEL_READY;
  },

  abilities: {
    f,
    shift: { id: U.id, name: U.name, icon: U.icon, unlock: U.unlock, cd: U.cd, desc: U.desc, cast: assassins,
      isActive(game, p) { return !!(p.data.kit.sm && p.data.kit.sm.assassins.length); } },
  },

  hooks: {
    onOutgoing(game, p, info) {
      if (info.source !== p) return;
      info.amount *= masteryScale(game, p);
      const sm = p.data.kit.sm, t = info.target;
      if (!sm || !t || game.t > sm.markUntil || (info.opts && info.opts.dot) || info.tags === TAG_ASSASSIN || t.type !== 'enemy') return;
      sm.markUntil = 0;
      info.crit = true;
      info.critMult = Math.max(info.critMult || 2, MK(game).shadowmeld.critMult);
      sm.asTick = game.tick; sm.asTarget = t.id;
    },
    onMinionOutgoing(game, p, info) { info.amount *= masteryScale(game, p); },
    onHit(game, p, e) {
      const sm = p.data.kit.sm, t = e.target;
      if (!sm || e.source !== p || !t || sm.asTick !== game.tick || sm.asTarget !== t.id) return;
      sm.asTick = -1;
      sm.assassinations++;
      const C = MK(game).colors;
      game.fx({ type: 'slash', x: t.x, y: t.y, angle: -0.8, arc: 70, r: 1.1, color: C.blood, style: 'claw' });
      game.fx({ type: 'slash', x: t.x, y: t.y, angle: 0.8, arc: 70, r: 1.1, color: C.blood, style: 'claw' });
      game.fx({ type: 'smoke', x: t.x, y: t.y, r: 0.8, dur: 0.6 });
      game.fx({ type: 'burst', x: t.x, y: t.y, n: 14, r: 0.8, color: C.main });
      game.fx({ type: 'text', x: t.x, y: t.y, z: 1.8, text: 'Assassinate!', style: 'crit' });
      game.camera.shake = Math.max(game.camera.shake, 0.2);
    },
  },
};
