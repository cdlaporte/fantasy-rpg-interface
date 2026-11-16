// WINDWALKER mastery (tier 3 over the Ninja; docs/MASTERY.md). Speed.
// Passive Tailwind: +15% move speed, and every dash (Dodge Roll, Shadow Step) cuts a wind blade along the path you
// travelled (a line hit with a pale `trail` + `slash` crescent) and flings three white wind `crescent`s ahead.
// Ultimate Cyclone Clones (Shift finisher, level 15): two tornado clones (three at full pips) of you, in a storm aura,
// spin (`anim: spin`, `slash` spin, rings) and roam from enemy to enemy for 7 s, pulling everything nearby into them and
// shredding it; each bursts in a white shockwave at the end. They do not throw shuriken (the Ninja's Shadow Clones do).
// Numbers: data.specs.windwalker.kit. State: p.data.kit.ww.
import rogue, { spendPips } from './rogue.js';
import ninja from './ninja.js';
import specdefs from '../../data/specs/rogue.js';
import { clone } from '../ents.js';
import { angleTo } from '../math.js';

const ID = 'windwalker';
const U = specdefs[ID].ultimate;
const WK = (game) => game.data.specs[ID].kit;
const isEnemy = (e) => e.type === 'enemy';
const TAG_BLADE = Object.freeze(['windwalker_blade']);
const TAG_CYCLONE = Object.freeze(['windwalker_cyclone']);
const LABEL_CYCLONE = 'Cyclone Clones';
const LABEL_TAIL = 'Tailwind';
let bladeLook = null;

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
function masteryScale(game, p) { const k = WK(game); return (k.dmgScale != null ? k.dmgScale : 1) * interp(k.lateScale, game.kits.level(p)); }

// ---------- wind blades ----------
function windBlades(game, p, x0, y0) {
  const ww = p.data.kit.ww, K = WK(game), B = K.blades, C = K.colors;
  if (!ww || game.t - ww.bladeT < B.icd) return;
  ww.bladeT = game.t;
  const x1 = p.x, y1 = p.y;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const a = len > 0.2 ? angleTo(x0, y0, x1, y1) : p.angle;
  const hit = ww.hit; hit.length = 0;
  if (len > 0.2) {
    const h = game.combat.aoe(p, { x: x0, y: y0, shape: 'line', angle: a, len, w: B.w, dmg: B.pathCoef, knockback: 2, type: 'melee', fx: false, tags: TAG_BLADE });
    for (let i = 0; i < h.length; i++) hit.push(h[i].id);
    game.fx({ type: 'trail', x: x0, y: y0, x2: x1, y2: y1, color: C.white });
    game.fx({ type: 'slash', x: (x0 + x1) / 2, y: (y0 + y1) / 2, angle: a + Math.PI / 2, arc: 60, r: Math.max(0.8, len / 2), color: C.main, style: 'crescent' });
  }
  // a gust where you land (what you stepped around), then three crescents at the nearest enemy (else straight on)
  game.combat.aoe(p, { x: x1, y: y1, r: B.gustR, dmg: B.pathCoef, knockback: 3, type: 'melee', fx: false, tags: TAG_BLADE, exclude: hit });
  const t = game.ents.nearest(x1, y1, B.range, isEnemy);
  const fa = t && Math.hypot(t.x - x1, t.y - y1) > 0.3 ? angleTo(x1, y1, t.x, t.y) : a;
  if (!bladeLook || bladeLook.color !== C.white) bladeLook = { rig: 'projectile', model: 'crescent', color: C.white, glow: C.main, size: B.size, trail: true };
  game.abilities.use('multishot', p, { x: x1, y: y1, angle: fa, n: B.n, spread: B.spread, look: bladeLook, speed: B.speed, range: B.range,
    dmg: B.coef, pierce: true, knockback: 1.5, tags: TAG_BLADE, anim: false });
  game.fx({ type: 'ring', x: x1, y: y1, r: 1, color: C.pale, dur: 0.3 });
  game.fx({ type: 'sparkle', x: x1, y: y1, n: 8, r: 0.6, color: C.white });
  ww.blades++;
}
const ROLL = rogue.abilities.space;
const space = Object.assign({}, ROLL, {
  desc: 'Roll away, untouchable, cutting a wind blade along the way. Your next attack is a sure critical.',
  cast(game, p, ctx) {
    const ww = p.data.kit.ww;
    const x0 = p.x, y0 = p.y;
    const r = ROLL.cast(game, p, ctx);
    if (ww) { ww.rollX = x0; ww.rollY = y0; ww.rollT = game.t + 0.25; }   // the roll is a dash: blades when it ends
    return r;
  },
});
const STEP = ninja.abilities.f;
const f = Object.assign({}, STEP, {
  desc: 'Appear behind the nearest enemy in a gust: a wind blade cuts the path. A decoy takes your place, then explodes.',
  cast(game, p, ctx) {
    const x0 = p.x, y0 = p.y;
    const r = STEP.cast(game, p, ctx);
    if (r !== false) windBlades(game, p, x0, y0);
    return r;
  },
});

// ---------- Cyclone Clones ----------
function cyclones(game, p) {
  const K = WK(game), Cy = K.cyclone, C = K.colors, ww = p.data.kit.ww;
  const pips = spendPips(game, p);
  const n = pips >= game.kits.resource(p).max ? Cy.nFull : Cy.n;
  endCyclones(game, p, false);
  for (let i = 0; i < n; i++) {
    const a = p.angle + Math.PI / 2 + (i / n) * Math.PI * 2;
    const look = clone(p.look);
    look.aura = { style: 'storm', color: C.pale };
    let x = p.x + Math.cos(a) * 1.4, y = p.y + Math.sin(a) * 1.4;
    if (game.world.solidAt(x, y)) { x = p.x; y = p.y; }
    const c = game.combat.summon(p, { id: 'cyclone_clone', name: 'Cyclone Clone', look, stats: { radius: p.radius } }, {
      x, y, brain: 'none', fxTag: 'haste', ttl: Cy.dur, power: game.combat.powerOf(p), hp: Math.max(5, Math.round(p.hpMax * Cy.hpMul)),
      key: 'cyclone_clone', color: C.white, tags: ['clone'], scale: Cy.scale, fx: false,
      onExpire: (g, e) => cycloneBurst(g, p, e) });
    c.alpha = 0.75;
    c.data.untargetable = true;
    c.data.ghost = true;
    c.data.wwTick = 0.1 * i; c.data.wwFx = 0; c.data.wwOrbit = a;
    game.ents.setAnim(c, 'spin', Cy.dur + 1);
    ww.clones.push(c.id);
    game.fx({ type: 'pillar', x, y, r: 0.7, color: C.white, dur: 0.5 });
    game.fx({ type: 'ring', x, y, r: Cy.pullR, color: C.pale, dur: 0.5 });
  }
  game.fx({ type: 'screenFlash', color: C.pale, dur: 0.18 });
  game.fx({ type: 'shockwave', x: p.x, y: p.y, r: 3, color: C.white });
  game.fx({ type: 'slash', x: p.x, y: p.y, angle: p.angle, arc: 360, r: 1.6, color: C.main, style: 'spin' });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.8, text: 'Cyclone!', style: 'crit' });
  game.camera.shake = Math.max(game.camera.shake, 0.45);
  game.ents.setAnim(p, 'spin', 0.4);
  ww.casts++;
}
function cycloneBurst(game, p, c) {
  if (c.data.wwBurst) return;
  c.data.wwBurst = true;
  const K = WK(game), Cy = K.cyclone, C = K.colors;
  game.combat.aoe(p, { x: c.x, y: c.y, r: Cy.endR, dmg: Cy.endCoef, knockback: 7, type: 'magic', fx: false, tags: TAG_CYCLONE });
  game.fx({ type: 'shockwave', x: c.x, y: c.y, r: Cy.endR, color: C.white });
  game.fx({ type: 'burst', x: c.x, y: c.y, n: 16, r: Cy.endR, color: C.pale });
}
function endCyclones(game, p, burst) {
  const ww = p.data.kit.ww;
  for (const id of ww.clones) {
    const c = game.ents.get(id);
    if (!c || c.removed) continue;
    if (!burst) c.data.wwBurst = true;
    game.combat.expireSummon(c, 'dismiss');
  }
  ww.clones.length = 0;
}
function updateCyclones(game, p, dt) {
  const ww = p.data.kit.ww, K = WK(game), Cy = K.cyclone, C = K.colors;
  for (let i = ww.clones.length - 1; i >= 0; i--) {
    const c = game.ents.get(ww.clones[i]);
    if (!c || c.removed || !c.alive) { ww.clones[i] = ww.clones[ww.clones.length - 1]; ww.clones.pop(); continue; }
    // Seek the nearest enemy (to the tornado) near you; else circle you.
    let best = null, bd = Infinity;
    const near = game.ents.inRadius(c.x, c.y, Cy.seek, isEnemy, ww.scratch);
    for (let k = 0; k < near.length; k++) {
      const e = near[k];
      if (!game.combat.canHit(p, e) || Math.hypot(e.x - p.x, e.y - p.y) > Cy.seek + 2) continue;
      const d = (e.x - c.x) * (e.x - c.x) + (e.y - c.y) * (e.y - c.y) + (k % ww.clones.length === i % ww.clones.length ? 0 : 1.5);
      if (d < bd) { bd = d; best = e; }
    }
    let tx, ty;
    if (best) { tx = best.x; ty = best.y; }
    else { c.data.wwOrbit += dt * 1.8; tx = p.x + Math.cos(c.data.wwOrbit) * 1.8; ty = p.y + Math.sin(c.data.wwOrbit) * 1.8; }
    const dx = tx - c.x, dy = ty - c.y, d = Math.sqrt(dx * dx + dy * dy);
    const sp = d > 0.2 ? Math.min(Cy.speed, d * 6) : 0;
    c.vx = d > 0 ? (dx / d) * sp : 0; c.vy = d > 0 ? (dy / d) * sp : 0;
    c.data.faceT = 0.1;
    c.angle += dt * 14;
    if (c.anim !== 'spin') game.ents.setAnim(c, 'spin', 2);
    if (Math.hypot(c.x - p.x, c.y - p.y) > 14) game.physics.teleport(c, p.x, p.y);
    // Pull + shred.
    c.data.wwTick -= dt;
    if (c.data.wwTick <= 0) {
      c.data.wwTick = Cy.tick;
      const list = game.ents.inRadius(c.x, c.y, Cy.pullR, isEnemy, ww.scratch);
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        if (!game.combat.canHit(p, e)) continue;
        if (Math.hypot(e.x - c.x, e.y - c.y) > 0.5) game.physics.push(e, angleTo(e.x, e.y, c.x, c.y), Cy.pull);
      }
      game.combat.aoe(p, { x: c.x, y: c.y, r: Cy.r, dmg: Cy.coef, knockback: 0, type: 'magic', fx: false, tags: TAG_CYCLONE, silent: false });
    }
    c.data.wwFx -= dt;
    if (c.data.wwFx <= 0) {
      c.data.wwFx = 0.15;
      game.fx({ type: 'slash', x: c.x, y: c.y, angle: c.angle, arc: 360, r: Cy.r, color: (game.tick & 1) ? C.white : C.main, style: 'spin' });
      if ((game.tick % 3) === 0) game.fx({ type: 'ring', x: c.x, y: c.y, r: Cy.pullR, color: C.pale, dur: 0.35 });
      game.fx({ type: 'burst', x: c.x, y: c.y, n: 4, r: 0.8, color: C.white });
    }
  }
}

export default {
  id: ID, parent: 'ninja', tier: 3,

  onEquip(game, p) {
    p.data.kit.ww = { hit: [], bladeT: -9, rollT: 0, rollX: 0, rollY: 0, clones: [], scratch: [], blades: 0, casts: 0 };
  },
  onUnequip(game, p) {
    if (p.data.kit.ww) endCyclones(game, p, false);
  },

  update(game, p, dt) {
    const ww = p.data.kit.ww;
    if (!ww) return;
    p.data.kit.speedMul *= WK(game).tailwind.speed;
    if (ww.rollT > 0 && game.t >= ww.rollT && !game.abilities.busy(p)) { ww.rollT = 0; windBlades(game, p, ww.rollX, ww.rollY); }
    if (ww.clones.length) updateCyclones(game, p, dt);
  },

  hud(game, p, hud) {
    const ww = p.data.kit.ww, kh = game.kits.kitHud;
    hud.kitHud = kh;
    if (!ww) return;
    if (ww.clones.length) kh.label = LABEL_CYCLONE;
    else if (kh.label === 'Shuriken') kh.label = LABEL_TAIL;
  },

  abilities: {
    space, f,
    shift: { id: U.id, name: U.name, icon: U.icon, unlock: U.unlock, cd: U.cd, desc: U.desc, cast: cyclones,
      isActive(game, p) { return !!(p.data.kit.ww && p.data.kit.ww.clones.length); } },
  },

  hooks: {
    onOutgoing(game, p, info) { if (info.source === p) info.amount *= masteryScale(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= masteryScale(game, p); },
  },
};
