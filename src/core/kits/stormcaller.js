// STORMCALLER mastery (tier 3, layered over the Sorcerer; docs/MASTERY.md). Lightning.
// Passive Static: charged shots chain lightning between enemies. An Arc Lance arcs a white-blue `bolt` chain from the
// first enemies it pierces; a Fireball's blast arcs one from the enemy nearest the explosion. Every chain hit builds a
// Static pip (HUD `Static`, max 5); with full Static the next charged shot also calls a sky-bolt volley down on every
// enemy around (fx `bolt` from the sky + `ring`, short stun) and empties the meter. Shift = Thunderstorm (replaces
// Cataclysm): the sky darkens and a storm follows you for 6 s, striking enemies around you about four times a second
// (sky `bolt`, `ring`, stun, a little chain), with white `screenFlash`es and thunder shakes.
// Numbers: data/specs/mage.js `stormcaller.kit`. State keys: `sc_*` in p.data.kit.
import SPECS from '../../data/specs/mage.js';
import sorcerer from './sorcerer.js';
import { defer, enemiesNear, sdata, setPatch } from './mage.js';
import { tintAt, tintAmountAt } from '../clock.js';

const DEF = SPECS.stormcaller;
const D = (game) => sdata(game, 'stormcaller') || DEF;
const K = (game) => D(game).kit || DEF.kit;

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
const lateMul = (game, p) => interp(D(game).balance && D(game).balance.dmgMul, game.kits.level(p));

/** Presentation mood while the ultimate runs: tint the scene light (the clock rewrites game.ambience every step, before
 *  the kits; moodEnd puts the clock's tint back at once). tintAmount stays within the contract's 0.25. */
function mood(game, color, amount) { const a = game.ambience; if (a) { a.tint = color; a.tintAmount = Math.min(0.25, amount); } }
function moodEnd(game) {
  const a = game.ambience, c = game.clock;
  if (a && c && typeof c.hour === 'number') { a.tint = tintAt(c.hour); a.tintAmount = tintAmountAt(c.hour); }
}

// ---------------------------------------------------------------------------------------------- static
function setStatic(game, p, v) {
  const k = p.data.kit, st = K(game).static;
  const was = k.sc_static >= st.max;
  k.sc_static = Math.max(0, Math.min(st.max, v));
  const full = k.sc_static >= st.max;
  if (full !== was) {
    setPatch(game, p, 'sc_static', full ? { held: { glow: '#ffffff' } } : null);
    if (full) {
      game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.2, color: K(game).color, dur: 0.4 });
      game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 14, color: '#ffffff', r: 0.8 });
      game.fx({ type: 'text', x: p.x, y: p.y, z: 1.6, text: 'Static!', style: 'info', ent: p.id });
    }
  }
}
/** Chain lightning from (x, y) through up to `jumps` enemies (never `skip`); each hit builds Static. Deferred. */
function chainFrom(game, p, x, y, skipId) {
  const s = K(game), c = s.chain;
  defer(p, () => {
    if (p.removed || !p.data.kit) return;
    const k = p.data.kit;
    k.m_chaining = true;
    const hits = game.abilities.use('chain', p, { x, y, jumps: c.jumps, range: c.range, dmg: c.dmg, falloff: c.falloff, color: s.white,
      element: 'storm', exclude: skipId ? [skipId] : null, fx: 'bolt', tags: ['static_chain'] });
    k.m_chaining = false;
    if (hits && hits.length) {
      setStatic(game, p, k.sc_static + hits.length);
      for (let i = 0; i < hits.length; i++) game.fx({ type: 'sparkle', x: hits[i].x, y: hits[i].y, n: 5, color: s.color, r: 0.4 });
      k.sc_chains = (k.sc_chains || 0) + 1;
      k.sc_chainHits = (k.sc_chainHits || 0) + hits.length;
    }
  });
}
/** Full Static: a volley of sky bolts on every enemy around. */
function discharge(game, p) {
  const s = K(game), st = s.static, k = p.data.kit;
  setStatic(game, p, 0);
  defer(p, () => {
    const list = enemiesNear(game, p, p.x, p.y, st.range, k.sc_near || (k.sc_near = []));
    const ids = [];
    for (let i = 0; i < list.length && ids.length < st.discharge; i++) ids.push(list[i]);
    for (let i = 0; i < ids.length; i++) {
      const t = ids[i];
      game.fx({ type: 'bolt', x: t.x, y: t.y, color: i % 2 ? s.white : s.color });
      game.combat.aoe(p, { x: t.x, y: t.y, r: st.r, dmg: st.dmg, knockback: 2, type: 'magic', element: 'storm', status: { stun: st.stun },
        fx: 'ring', color: s.color, tags: ['static_discharge'] });
    }
    game.fx({ type: 'screenFlash', color: s.white, dur: 0.12 });
    game.camera.shake = Math.max(game.camera.shake, 0.3);
    k.sc_discharges = (k.sc_discharges || 0) + 1;
  });
}

/** A Fireball just left the staff: its blast arcs lightning from the enemy nearest to it. */
function wrapFireball(game, p) {
  const all = game.ents.all;
  for (let i = all.length - 1; i >= 0 && i >= all.length - 12; i--) {
    const e = all[i];
    if (e.removed || e.type !== 'projectile' || e.owner !== p.id || e.data.scWrapped) continue;
    const pd = e.data.proj;
    if (!pd || !pd.tags || pd.tags.indexOf('fireball') < 0) continue;
    e.data.scWrapped = true;
    const prev = pd.onExpire;
    pd.onExpire = (g, proj, why) => {
      if (prev) prev(g, proj, why);
      const k = p.data.kit;
      if (!k) return;
      const near = enemiesNear(g, p, proj.x, proj.y, 2.2, k.sc_near2 || (k.sc_near2 = []));
      if (!near.length) return;
      let best = near[0], bd = Infinity;
      for (let j = 0; j < near.length; j++) { const t = near[j], d = (t.x - proj.x) ** 2 + (t.y - proj.y) ** 2; if (d < bd) { bd = d; best = t; } }
      g.fx({ type: 'bolt', x: proj.x, y: proj.y, x2: best.x, y2: best.y, color: K(g).white });
      chainFrom(g, p, best.x, best.y, best.id);
    };
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------- thunderstorm
function castStorm(game, p) {
  const s = K(game), k = p.data.kit, sm = s.storm;
  k.sc_storm = { until: game.t + sm.dur, next: 0.15, n: 0, flash: 0 };
  game.fx({ type: 'screenFlash', color: s.navy, dur: 0.5 });
  game.fx({ type: 'bolt', x: p.x, y: p.y, color: s.white });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: sm.range, color: s.color, dur: 0.8 });
  game.fx({ type: 'shockwave', x: p.x, y: p.y, r: 2.2, color: s.white });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.0, color: s.color, dur: 1.0 });
  game.camera.shake = Math.max(game.camera.shake, 0.4);
  game.ents.setAnim(p, 'cast', 0.6);
  setPatch(game, p, 'sc_storm', { held: { glow: '#ffffff' }, aura: { style: 'storm', color: '#ffffff' } });
  game.bus.emit('sfx', { id: 'spell' });
  k.sc_storms = (k.sc_storms || 0) + 1;
  return undefined;
}
function updateStorm(game, p, dt) {
  const k = p.data.kit, run = k.sc_storm;
  if (!run) return;
  const s = K(game), sm = s.storm;
  if (game.t >= run.until || p.data.down) {
    k.sc_storm = null;
    setPatch(game, p, 'sc_storm', null);
    moodEnd(game);
    game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 16, color: s.color, r: 1.5 });
    return;
  }
  mood(game, s.navy, 0.25);                         // the sky darkens while the storm rages
  run.next -= dt;
  if (run.next > 0) return;
  run.next += sm.every;
  const list = enemiesNear(game, p, p.x, p.y, sm.range, k.sc_near || (k.sc_near = []));
  let x, y, tid = 0;
  if (list.length) {
    // the least recently struck enemy (spreads the strikes over the whole crowd)
    let best = list[0];
    for (let i = 1; i < list.length; i++) if ((list[i].data.scStruck || 0) < (best.data.scStruck || 0)) best = list[i];
    best.data.scStruck = game.t;
    x = best.x + (game.rng.next() - 0.5) * 0.3; y = best.y + (game.rng.next() - 0.5) * 0.3; tid = best.id;
  } else {
    const a = game.rng.next() * Math.PI * 2, d = 1.5 + game.rng.next() * (sm.range - 2);
    x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d;
  }
  run.n++;
  game.fx({ type: 'bolt', x, y, color: run.n % 3 ? s.white : s.color });
  game.combat.aoe(p, { x, y, r: sm.r, dmg: tid ? sm.dmg : 0, knockback: 2, type: 'magic', element: 'storm', status: tid ? { stun: sm.stun } : null,
    fx: 'ring', color: s.color, tags: ['thunderstorm'] });
  game.fx({ type: 'sparkle', x, y, n: 6, color: s.white, r: 0.6 });
  if (tid && run.n % 2 === 0) {
    const kk = p.data.kit;
    kk.m_chaining = true;
    game.abilities.use('chain', p, { x, y, jumps: 1, range: 3.5, dmg: sm.chainDmg, color: s.color, element: 'storm', exclude: [tid], tags: ['thunderstorm'] });
    kk.m_chaining = false;
  }
  if (run.n % sm.flashEvery === 0) {
    game.fx({ type: 'screenFlash', color: '#cfe8ff', dur: 0.06 });
    game.camera.shake = Math.max(game.camera.shake, 0.3);
  }
  k.sc_strikes = (k.sc_strikes || 0) + 1;
}

// ---------------------------------------------------------------------------------------------- the kit
const stormcaller = {
  id: 'stormcaller',
  parent: 'sorcerer',
  tier: 3,
  basicMode: sorcerer.basicMode,
  aimRange: sorcerer.aimRange,
  basicInfo: sorcerer.basicInfo,
  basic(game, p, ctx) {
    const k = p.data.kit;
    const before = k.so_shots || 0;
    k.sc_lance = k.sc_lance || [];
    k.sc_lance.length = 0;
    k.sc_collect = true;
    const r = sorcerer.basic(game, p, ctx);
    k.sc_collect = false;
    if ((k.so_shots || 0) === before || ctx.rank < 3) return r;
    const shot = k.so_last;
    if (shot !== 'lance' && shot !== 'fireball') return r;
    if (k.sc_static >= K(game).static.max) discharge(game, p);
    if (shot === 'fireball') wrapFireball(game, p);
    else {
      const n = Math.min(k.sc_lance.length, K(game).chain.fromLance);
      for (let i = 0; i < n; i++) { const t = game.ents.get(k.sc_lance[i]); if (t && !t.removed) chainFrom(game, p, t.x, t.y, t.id); }
    }
    return r;
  },
  onEquip(game, p) {
    const k = p.data.kit;
    k.sc_static = 0; k.sc_storm = null; k.sc_lance = []; k.sc_collect = false;
    setPatch(game, p, 'ms_look', D(game).look);
  },
  update(game, p, dt) { updateStorm(game, p, dt); },
  hud(game, p, hud) {
    const k = p.data.kit;
    const charging = !!hud.kitHud;
    hud.kitHud = game.kits.kitHud;
    hud.kitHud.pips = k.sc_static | 0;
    hud.kitHud.pipsMax = K(game).static.max;
    if (!charging) { hud.kitHud.label = 'Static'; hud.kitHud.stance = k.sc_storm ? 'Thunderstorm' : null; }
  },
  abilities: {
    shift: {
      id: 'thunderstorm', name: 'Thunderstorm', icon: 'storm', unlock: 15,
      get cd() { return DEF.kit.storm.cd; }, get cost() { return DEF.kit.storm.cost; },
      desc: DEF.ultimate.desc,
      isActive(game, p) { return !!p.data.kit.sc_storm; },
      cast: castStorm,
    },
  },
  hooks: {
    onOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
    onHit(game, p, e) {
      const k = p.data.kit;
      if (!k.sc_collect || e.source !== p || !e.target || !e.tags) return;
      if (e.tags.indexOf('arc_lance') >= 0 && k.sc_lance.indexOf(e.target.id) < 0) k.sc_lance.push(e.target.id);
    },
  },
};

export default stormcaller;
