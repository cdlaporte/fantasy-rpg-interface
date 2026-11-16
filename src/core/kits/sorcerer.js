// SORCERER spec kit (docs/CLASSES.md "Sorcerer — charge-up artillery"). The charge-up artillery piece.
// Passive Overcharge: the basic charges while the attack key is held (fxTag `charge`, -30% speed, the staff and body glow
// grow ember -> gold -> storm) and fires on release: tap = Ember (spark, free), 0.3-1.0 s = Fireball (explodes, leaves
// ground_fire, 10 Mana), >= 1.0 s = Arc Lance (instant piercing beam, 25 Mana, camera shake). Rank IV: the lance forks a
// bolt from every enemy it pierces to a neighbor; fireballs burn larger and longer. F = Meteor (telegraph + falling `z`
// meteor + burning crater), Shift = Cataclysm (five meteors on the densest enemies, screenFlash on every impact).
// Numbers: data/specs/mage.js `sorcerer.kit`. State keys: `so_*` in p.data.kit.
import SPECS from '../../data/specs/mage.js';
import mage, { boon, defer, enemiesNear, projLook, sdata, setPatch, splitFor, tryManaSurge, isMana } from './mage.js';

const DEF = SPECS.sorcerer;
const S = (game) => (sdata(game, 'sorcerer') || DEF).kit || DEF.kit;
const TIER_NAMES = ['Ember', 'Fireball', 'Arc Lance'];
const TIER_GLOW = ['#ff8a5a', '#ffb347', '#b48cff'];

function chargeRate(game) { return boon(game, 'quick_study') ? S(game).quick_study.rate : 1; }
function tierOf(game, t) { const c = S(game).charge; return t >= c.full ? 2 : t >= c.mid ? 1 : 0; }

// ---------------------------------------------------------------------------------------------- tiers
function fireEmber(game, p, angle) {
  const s = S(game), e = s.ember;
  if (isMana(p) && tryManaSurge(game, p, angle, s.color, '#ffffff', 'fireball')) return 'surge';
  game.abilities.use('projectile', p, {
    angle, speed: e.speed, range: e.range, dmg: e.dmg, radius: e.radius, type: 'magic', element: 'fire', knockback: 1,
    look: projLook('spark', s.color, '#ffd27a', e.size), color: s.color, split: splitFor(game, s.color, '#ffd27a', 'spark'), tags: ['ember'],
  });
  game.fx({ type: 'sparkle', x: p.x + Math.cos(angle) * 0.5, y: p.y + Math.sin(angle) * 0.5, n: 4, color: s.color, r: 0.3 });
  return 'ember';
}

function fireFireball(game, p, angle, rank) {
  const s = S(game), f = s.fireball, iv = rank >= 4 ? s.fireballIV : null;
  const pw = game.combat.powerOf(p);
  const r = iv ? iv.r : f.r;
  game.abilities.use('projectile', p, {
    angle, speed: f.speed, range: f.range, dmg: 0, radius: f.radius, type: 'magic', element: 'fire', knockback: 0,
    look: projLook('fireball', s.color, '#ffd27a', f.size * (iv ? 1.2 : 1)), color: s.color, tags: ['fireball'],
    split: splitFor(game, s.color, '#ffd27a', 'spark'),
    explode: { r, dmg: f.dmg, knockback: 4, fx: { type: 'burst', n: 22, r }, color: s.color, shake: 0.12,
      status: { id: 'burn', t: f.burnT, p: f.burn * pw } },
    landZone: { r: iv ? iv.fireR : f.fireR, dur: iv ? iv.fireDur : f.fireDur, dmg: f.fireDmg, element: 'fire', color: s.color,
      status: { id: 'burn', t: 1, p: f.burn * pw * 0.5 }, tags: ['ground_fire'] },
    onExpire(g, proj) { g.fx({ type: 'ring', x: proj.x, y: proj.y, r, color: s.gold, dur: 0.35 }); },
  });
  game.fx({ type: 'burst', x: p.x + Math.cos(angle) * 0.5, y: p.y + Math.sin(angle) * 0.5, n: 8, color: s.gold, r: 0.4 });
  return 'fireball';
}

function fireLance(game, p, angle, rank) {
  const s = S(game), l = s.lance;
  const res = game.abilities.use('beam', p, {
    angle, range: l.range, w: l.w, dmg: l.dmg, pierce: true, knockback: l.knockback, color: s.storm, type: 'magic',
    element: 'storm', shake: l.shake, tags: ['arc_lance'],
  });
  const hits = res ? res.slice() : [];
  const len = game.world.raycast(p.x, p.y, angle, l.range, true);
  const ex = p.x + Math.cos(angle) * len, ey = p.y + Math.sin(angle) * len;
  game.fx({ type: 'bolt', x: p.x, y: p.y, x2: ex, y2: ey, color: '#ffffff' });
  game.fx({ type: 'sparkle', x: ex, y: ey, n: 12, color: s.storm, r: 0.6 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 0.9, color: s.storm, dur: 0.3 });
  game.camera.shake = Math.max(game.camera.shake, l.shake);
  const k = p.data.kit;
  // Rank IV: a forked bolt jumps from every pierced enemy to its nearest neighbor.
  if (rank >= 4 && hits.length) {
    const fk = s.fork;
    defer(p, () => {
      for (let i = 0; i < hits.length; i++) {
        const t = hits[i];
        const near = enemiesNear(game, p, t.x, t.y, fk.range, k.so_near || (k.so_near = []));
        let best = null, bd = Infinity;
        for (let j = 0; j < near.length; j++) {
          const e = near[j];
          if (e === t || hits.indexOf(e) >= 0) continue;
          const d = (e.x - t.x) * (e.x - t.x) + (e.y - t.y) * (e.y - t.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (!best) continue;
        game.abilities.use('chain', p, { target: best, x: t.x, y: t.y, jumps: 1, dmg: fk.dmg, color: s.storm, element: 'storm' });
        k.so_forks = (k.so_forks || 0) + 1;
      }
    });
  }
  // Storm Lance: the line keeps crackling for 2 s.
  if (boon(game, 'storm_lance')) {
    const sl = s.storm_lance;
    (k.so_lines || (k.so_lines = [])).push({ x: p.x, y: p.y, a: angle, len, until: game.t + sl.dur, acc: 0 });
  }
  return 'lance';
}

function release(game, p, angle, held, rank) {
  const s = S(game), k = p.data.kit;
  let tier = tierOf(game, held);
  const r = game.kits.resource(p);
  const want = tier;
  if (tier === 2 && r.value < s.lance.cost) tier = 1;
  if (tier === 1 && r.value < s.fireball.cost) tier = 0;
  if (tier !== want) game.fx({ type: 'text', x: p.x, y: p.y, z: 1.4, text: 'Not enough Mana', style: 'info', ent: p.id });
  let shot;
  if (tier === 2) { game.kits.spend(p, s.lance.cost); shot = fireLance(game, p, angle, rank); }
  else if (tier === 1) { game.kits.spend(p, s.fireball.cost); shot = fireFireball(game, p, angle, rank); }
  else shot = fireEmber(game, p, angle);
  k.so_last = shot;
  k.so_shots = (k.so_shots || 0) + 1;
  k.so_readyT = game.t + (tier === 0 ? s.charge.emberGap : s.charge.recover);
  game.ents.setAnim(p, 'cast', 0.2);
  return shot;
}

function setCharging(game, p, on) {
  const k = p.data.kit;
  k.so_charging = on;
  game.ents.setFxTag(p, 'charge', on);
  if (!on) { p.glow = null; k.so_tier = -1; setPatch(game, p, 'so_charge', null); }
}

// ---------------------------------------------------------------------------------------------- meteors
function dropMeteor(game, p, x, y, m, extra) {
  const s = S(game);
  return game.combat.aoe(p, Object.assign({
    x, y, r: m.r, dmg: m.dmg, delay: m.delay, telegraph: 'circle', telegraphColor: s.color, meteor: true, fx: 'meteor', color: s.color,
    knockback: m.knockback || 6, type: 'magic', element: 'fire', shake: m.shake || 0.3, tags: ['meteor'],
    zone: m.fireR ? { r: m.fireR, dur: m.fireDur, dmg: m.fireDmg, element: 'fire', color: s.color } : null,
    onResolve(g, hits, ax, ay) {
      g.fx({ type: 'shockwave', x: ax, y: ay, r: m.r, color: s.gold });
      g.fx({ type: 'burst', x: ax, y: ay, n: 20, color: s.color, r: m.r });
      const k = p.data.kit;
      k.so_impacts = (k.so_impacts || 0) + 1;
    },
  }, extra));
}
function pointAhead(game, p, angle, dist) {
  const d = game.world.raycast(p.x, p.y, angle, dist, true);
  return { x: p.x + Math.cos(angle) * d, y: p.y + Math.sin(angle) * d };
}
function castMeteor(game, p, ctx) {
  const s = S(game), m = s.meteor;
  const a = ctx.angle;
  const pt = pointAhead(game, p, a, m.dist);
  dropMeteor(game, p, pt.x, pt.y, m);
  if (boon(game, 'meteor_echo')) {
    const me = s.meteor_echo;
    for (let i = 1; i <= me.n; i++) {
      const q = pointAhead(game, p, a, m.dist + me.gap * i);
      dropMeteor(game, p, q.x, q.y, { r: me.r, dmg: me.dmg, delay: m.delay + me.delay * i, knockback: 4, shake: 0.25 }, { tags: ['meteor_echo'] });
    }
  }
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 0.6, color: s.color, dur: 0.4 });
  game.ents.setAnim(p, 'cast', 0.35);
  game.bus.emit('sfx', { id: 'spell' });
  return undefined;
}

function densestPoint(game, p, range, r, out) {
  const k = p.data.kit;
  const list = enemiesNear(game, p, p.x, p.y, range, k.so_cand || (k.so_cand = []));
  let best = null, bn = -1;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    let n = 0;
    for (let j = 0; j < list.length; j++) {
      const b = list[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy <= r * r) n++;
    }
    if (n > bn) { bn = n; best = a; }
  }
  if (!best) return null;
  // centroid of the cluster around the best enemy
  let sx = 0, sy = 0, c = 0;
  for (let j = 0; j < list.length; j++) {
    const b = list[j];
    const dx = best.x - b.x, dy = best.y - b.y;
    if (dx * dx + dy * dy <= r * r) { sx += b.x; sy += b.y; c++; }
  }
  out.x = sx / c; out.y = sy / c;
  return out;
}
function castCataclysm(game, p) {
  const s = S(game), k = p.data.kit;
  k.so_cata = { n: 0, t: 0 };
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.2, color: s.color, dur: 1 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 3, color: s.storm, dur: 0.6 });
  game.fx({ type: 'screenFlash', color: '#3a0a0a', dur: 0.25 });
  game.camera.shake = Math.max(game.camera.shake, 0.3);
  game.ents.setAnim(p, 'cast', 0.6);
  game.bus.emit('sfx', { id: 'spell' });
  return undefined;
}
function updateCataclysm(game, p, dt) {
  const k = p.data.kit, c = k.so_cata;
  if (!c) return;
  const s = S(game), cc = s.cataclysm;
  c.t -= dt;
  if (c.t > 0) return;
  c.t = cc.every;
  const pt = densestPoint(game, p, cc.range, cc.densR, k.so_pt || (k.so_pt = { x: 0, y: 0 }))
    || pointAhead(game, p, p.angle + (game.rng.next() - 0.5), 3 + game.rng.next() * 3);
  dropMeteor(game, p, pt.x, pt.y, { r: cc.r, dmg: cc.dmg, delay: cc.delay, shake: cc.shake, knockback: 7 }, {
    tags: ['cataclysm'],
    onResolve(g, hits, ax, ay) {
      g.fx({ type: 'shockwave', x: ax, y: ay, r: cc.r, color: s.gold });
      g.fx({ type: 'burst', x: ax, y: ay, n: 24, color: s.color, r: cc.r });
      g.fx({ type: 'screenFlash', color: s.color, dur: 0.18 });
      g.camera.shake = Math.max(g.camera.shake, cc.shake);
      k.so_impacts = (k.so_impacts || 0) + 1;
      k.so_cataImpacts = (k.so_cataImpacts || 0) + 1;
    },
  });
  c.n++;
  if (c.n >= cc.n) k.so_cata = null;
}

// ---------------------------------------------------------------------------------------------- storm lines, wildfire
function updateLines(game, p, dt) {
  const k = p.data.kit, lines = k.so_lines;
  if (!lines || !lines.length) return;
  const s = S(game), sl = s.storm_lance;
  for (let i = lines.length - 1; i >= 0; i--) {
    const L = lines[i];
    if (game.t >= L.until) { lines.splice(i, 1); continue; }
    L.acc += dt;
    if (L.acc < sl.tick) continue;
    L.acc -= sl.tick;
    game.combat.aoe(p, { x: L.x, y: L.y, shape: 'line', angle: L.a, len: L.len, w: sl.w, dmg: sl.dmg, knockback: 0, type: 'magic',
      element: 'storm', color: s.storm, tags: ['storm_lance'], silent: false,
      fx: { type: 'beam', x2: L.x + Math.cos(L.a) * L.len, y2: L.y + Math.sin(L.a) * L.len, w: 0.15, color: s.storm } });
    const f0 = game.rng.next() * 0.7, f1 = f0 + 0.15 + game.rng.next() * 0.15;
    game.fx({ type: 'bolt', x: L.x + Math.cos(L.a) * L.len * f0, y: L.y + Math.sin(L.a) * L.len * f0,
      x2: L.x + Math.cos(L.a) * L.len * f1, y2: L.y + Math.sin(L.a) * L.len * f1, color: '#e9dcff' });
    k.so_crackles = (k.so_crackles || 0) + 1;
  }
}
function wildfire(game, p, dead) {
  if (!boon(game, 'wildfire') || !dead || !(dead.status.burn > 0)) return;
  const s = S(game), w = s.wildfire;
  const x = dead.x, y = dead.y;
  const pw = game.combat.powerOf(p);
  defer(p, () => {
    game.combat.aoe(p, { x, y, r: w.r, dmg: w.dmg, knockback: 5, type: 'magic', element: 'fire', fx: 'meteor', color: s.color,
      status: { id: 'burn', t: w.burnT, p: w.burn * pw }, tags: ['wildfire'],
      zone: { r: w.r * 0.7, dur: w.fireDur, dmg: 0.2, element: 'fire', color: s.color } });
    game.fx({ type: 'burst', x, y, n: 18, color: s.gold, r: w.r });
    const k = p.data.kit;
    k.so_wildfires = (k.so_wildfires || 0) + 1;
  });
}

// ---------------------------------------------------------------------------------------------- the kit
const sorcerer = {
  id: 'sorcerer',
  parent: 'mage',
  basicMode: 'raw',
  aimRange(game) { return S(game).lance.range; },
  basicInfo(game, p, rank) {
    const r = (sdata(game, 'sorcerer') || DEF).ranks || DEF.ranks;
    const k = p.data.kit;
    if (rank < 3) return mage.basicInfo(game, p, rank);
    return rank >= 4 ? r[4] : r[3];
  },
  onEquip(game, p) {
    const k = p.data.kit;
    k.so_charging = false; k.so_charge = 0; k.so_tier = -1; k.so_readyT = 0; k.so_lines = []; k.so_cata = null; k.so_autoT = 0;
  },
  onUnequip(game, p) {
    game.ents.setFxTag(p, 'charge', false);
    p.glow = null;
  },
  update(game, p, dt) {
    const k = p.data.kit;
    if (k.so_charging && !boon(game, 'quick_study')) k.speedMul *= S(game).charge.speedMul;
    updateCataclysm(game, p, dt);
    updateLines(game, p, dt);
  },
  hud(game, p, hud) {
    const k = p.data.kit;
    if (!k.so_charging) return;
    hud.kitHud = game.kits.kitHud;
    hud.kitHud.stance = TIER_NAMES[Math.max(0, k.so_tier)];
    hud.kitHud.label = 'Charge';
  },
  basic(game, p, ctx) {
    const k = p.data.kit;
    if (ctx.rank < 3) {
      // Before rank III (debug / test only) the Sorcerer still fires Arcane Bolts on a timer.
      if (ctx.held && game.t >= k.so_autoT) { mage.basic(game, p, ctx); k.so_autoT = game.t + mage.interval(game); }
      return undefined;
    }
    const s = S(game);
    if (ctx.held) {
      if (!k.so_charging) {
        if (game.t < k.so_readyT) return undefined;
        setCharging(game, p, true);
        k.so_charge = 0; k.so_tier = -1;
      }
      k.so_charge += ctx.dt * chargeRate(game);
      k.so_angle = ctx.angle;
      const tier = tierOf(game, k.so_charge);
      if (tier !== k.so_tier) {
        k.so_tier = tier;
        p.glow = TIER_GLOW[tier];
        setPatch(game, p, 'so_charge', { held: { glow: TIER_GLOW[tier] } });
        if (tier > 0) {
          game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 6 + tier * 6, color: TIER_GLOW[tier], r: 0.5 + tier * 0.3 });
          game.fx({ type: 'ring', x: p.x, y: p.y, r: 0.6 + tier * 0.4, color: TIER_GLOW[tier], dur: 0.3 });
        }
      }
      return undefined;
    }
    if (ctx.released && k.so_charging) {
      const held = k.so_charge;
      setCharging(game, p, false);
      if (ctx.cancelled) { game.fx({ type: 'poof', x: p.x, y: p.y, color: s.color }); return undefined; }
      release(game, p, ctx.angle, held, ctx.rank);
    }
    return undefined;
  },
  abilities: {
    f: {
      id: 'meteor', name: 'Meteor', icon: 'meteor', unlock: 8,
      get cd() { return DEF.kit.meteor.cd; }, get cost() { return DEF.kit.meteor.cost; },
      desc: 'Drop a burning meteor a few steps ahead of you.',
      cast: castMeteor,
    },
    shift: {
      id: 'cataclysm', name: 'Cataclysm', icon: 'meteor', unlock: 11,
      get cd() { return DEF.kit.cataclysm.cd; }, get cost() { return DEF.kit.cataclysm.cost; },
      desc: 'Five meteors smash the biggest crowds you can see.',
      isActive(game, p) { return !!p.data.kit.so_cata; },
      cast: castCataclysm,
    },
  },
  hooks: {
    onKill(game, p, e) { wildfire(game, p, e.ent); },
  },
};

export default sorcerer;
