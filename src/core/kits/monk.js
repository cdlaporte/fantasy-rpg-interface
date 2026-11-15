// MONK spec kit (docs/CLASSES.md "Monk — the mage who punches"). The melee combo brawler.
// Ki (0-100, gold) replaces Mana: no passive regen, +8 per strike that lands, standing still 1.5 s meditates (slow hp and
// Ki regen, fxTag `ki`, anim `sit`). Passive Flowing Fists: while punching, enemy projectiles in front are deflected
// back at their owner. Basic III = Four-Beat Combo (jab, jab, sweeping kick, Palm Strike cone shockwave), 0.18 s beats;
// rank IV: Palm Strike also launches a ki wave and a fifth beat, a rising uppercut, pops the target into the air (stun).
// F = Flying Kick (invulnerable dash-kick that chains to the nearest enemy, up to 3 chains, +20% each), Shift = Thousand
// Palms (2.5 s blur of 12 teleport-strikes, a gold ring, 15% heal). Numbers: data/specs/mage.js `monk.kit`.
// State keys: `mo_*` in p.data.kit.
import SPECS from '../../data/specs/mage.js';
import mage, { boon, defer, enemiesNear, projLook, sdata, setPatch, tryManaSurge } from './mage.js';

const DEF = SPECS.monk;
const S = (game) => (sdata(game, 'monk') || DEF).kit || DEF.kit;
const BEAT_NAMES = ['Jab', 'Jab', 'Kick', 'Palm', 'Uppercut'];

function isKi(p) { return !!(p.data.resource && p.data.resource.id === 'ki'); }

// ---------------------------------------------------------------------------------------------- combo
function landed(game, p, n) {
  if (n > 0) game.kits.gain(p, S(game).combo.kiPerHit);
}
function strike(game, p, angle, i, rank) {
  const s = S(game), b = s.beats[i], k = p.data.kit;
  k.mo_punchUntil = game.t + s.deflect.window;
  k.mo_punchA = angle;
  k.mo_still = 0;
  // Mana Surge (class boon) on fists: at full Ki the strike also throws a giant ki bolt.
  if (isKi(p)) tryManaSurge(game, p, angle, s.color, '#ffffff', 'wave', s.surgeKi);
  if (i === 3) return palm(game, p, angle, rank);
  const hits = game.abilities.use('melee_arc', p, {
    angle, arc: b.arc, range: b.range, dmg: b.dmg, knockback: b.knockback, lunge: b.lunge || 0, style: 'fist', color: s.color,
    type: 'melee', deflect: true, anim: i === 4 ? 'attack' : 'attack', animDur: 0.16, tags: ['beat' + (i + 1)],
    status: i === 4 ? { stun: b.stun } : null,
    hitStop: i === 4 ? 0.05 : 0,
  });
  const n = hits ? hits.length : 0;
  if (i === 4) {
    for (let j = 0; j < n; j++) pop(game, p, hits[j], b);
    game.fx({ type: 'sparkle', x: p.x + Math.cos(angle) * 0.7, y: p.y + Math.sin(angle) * 0.7, n: 10, color: s.color, r: 0.5 });
  }
  if (i === 2) game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: b.arc, r: b.range + 0.2, color: s.jade, style: 'spin' });
  landed(game, p, n);
  return n;
}
function palm(game, p, angle, rank) {
  const s = S(game), b = s.beats[3], k = p.data.kit;
  const dragon = boon(game, 'dragon_wave') && isKi(p) && game.kits.resource(p).value >= game.kits.resource(p).max;
  const hits = game.combat.aoe(p, {
    x: p.x, y: p.y, shape: 'cone', angle, arc: b.arc, r: b.range, dmg: b.dmg, knockback: b.knockback, type: 'melee',
    fx: 'shockwave', color: s.color, shake: b.shake, hitStop: b.hitStop, tags: ['palm_strike'],
  });
  const n = hits ? hits.length : 0;
  game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: b.arc, r: b.range, color: s.color, style: 'fist' });
  game.combat.reflectInArc(p, p.x, p.y, angle, s.deflect.arc, s.deflect.range + 0.5, k.mo_reflOpts);
  game.ents.setAnim(p, 'attack', 0.22);
  p.data.faceT = 0.25; p.angle = angle;
  game.bus.emit('sfx', { id: 'swing' });
  landed(game, p, n);
  k.mo_palms = (k.mo_palms || 0) + 1;
  if (dragon) {
    const dw = s.dragon_wave;
    game.kits.spend(p, dw.cost);
    game.abilities.use('projectile', p, { angle, speed: dw.speed, range: dw.range, dmg: dw.dmg, radius: dw.w / 2, pierce: true,
      type: 'magic', knockback: 6, look: projLook('wave', s.color, '#ffffff', dw.size), color: s.color, tags: ['dragon_wave'], anim: 'attack' });
    const len = game.world.raycast(p.x, p.y, angle, dw.range, true);
    game.fx({ type: 'beam', x: p.x, y: p.y, x2: p.x + Math.cos(angle) * len, y2: p.y + Math.sin(angle) * len, w: dw.w, color: s.color });
    game.fx({ type: 'shockwave', x: p.x, y: p.y, r: 2, color: s.color });
    game.camera.shake = Math.max(game.camera.shake, 0.35);
    k.mo_dragons = (k.mo_dragons || 0) + 1;
  } else if (rank >= 4) {
    const w = s.wave;
    game.abilities.use('projectile', p, { angle, speed: w.speed, range: w.range, dmg: w.dmg, radius: w.radius, pierce: true,
      type: 'magic', knockback: 3, look: projLook('wave', s.color, s.jade, w.size), color: s.color, tags: ['ki_wave'], anim: 'attack' });
  }
  if (boon(game, 'splitting_bolts')) {
    const sk = s.splitKi;
    game.abilities.use('multishot', p, { angle, n: sk.n, spread: sk.arc, speed: sk.speed, range: sk.range, dmg: sk.dmg, radius: 0.14,
      type: 'magic', knockback: 1, look: projLook('spark', s.color, '#ffffff', 0.7), color: s.color, tags: ['split_ki'], anim: 'attack' });
  }
  if (boon(game, 'iron_skin')) {
    const is = s.iron_skin;
    game.combat.status(p, 'shield', is.dur, Math.round(p.hpMax * is.absorb));
    game.abilities.use('zone', p, { follow: true, r: 0.9, dur: is.dur, bubble: true, color: s.color, tags: ['iron_skin'] });
    game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 10, color: s.color, r: 0.8 });
  }
  return n;
}
function pop(game, p, t, b) {
  if (!t || t.removed || t.tags.includes('boss')) return;
  const k = p.data.kit;
  const pops = k.mo_pops || (k.mo_pops = []);
  for (let i = 0; i < pops.length; i++) if (pops[i].id === t.id) return;
  pops.push({ id: t.id, t0: game.t, dur: b.pop, h: b.popH, z0: t.z || 0 });
  game.fx({ type: 'burst', x: t.x, y: t.y, n: 10, color: S(game).color, r: 0.5 });
  k.mo_uppercuts = (k.mo_uppercuts || 0) + 1;
}
function updatePops(game, p) {
  const pops = p.data.kit.mo_pops;
  if (!pops || !pops.length) return;
  for (let i = pops.length - 1; i >= 0; i--) {
    const q = pops[i];
    const e = game.ents.get(q.id);
    const f = (game.t - q.t0) / q.dur;
    if (!e || e.removed) { pops.splice(i, 1); continue; }
    if (f >= 1) { e.z = q.z0; pops.splice(i, 1); continue; }
    e.z = q.z0 + 4 * q.h * f * (1 - f);
  }
}

// ---------------------------------------------------------------------------------------------- deflect
function updateDeflect(game, p) {
  const k = p.data.kit, s = S(game);
  if (!(k.mo_punchUntil > game.t)) return;
  const n = game.combat.reflectInArc(p, p.x, p.y, k.mo_punchA, s.deflect.arc, s.deflect.range, k.mo_reflOpts);
  if (n > 0) {
    game.kits.gain(p, s.deflect.ki * n);
    k.mo_deflects = (k.mo_deflects || 0) + n;
    game.fx({ type: 'slash', x: p.x, y: p.y, angle: k.mo_punchA, arc: s.deflect.arc, r: s.deflect.range, color: s.color, style: 'fist' });
  }
}
function onReflected(game, p, e) {
  if (e.by !== p || !boon(game, 'deflect_mastery')) return;
  const proj = e.proj;
  defer(p, () => {
    if (!proj || proj.removed) return;
    const s = S(game), dm = s.deflect_mastery;
    const a = proj.angle;
    for (let i = 0; i < dm.n; i++) {
      const off = (i - (dm.n - 1) / 2) * 0.5;
      game.combat.projectile(p, { x: proj.x, y: proj.y, angle: a + off, speed: dm.speed, range: dm.range, dmg: dm.dmg, radius: 0.18,
        homing: dm.homing, homingRange: 7, type: 'magic', knockback: 2, look: projLook('orb', s.color, '#ffffff', 0.9), color: s.color,
        tags: ['ki_blast'] });
    }
    game.fx({ type: 'burst', x: proj.x, y: proj.y, n: 10, color: s.color, r: 0.5 });
    game.ents.remove(proj);
    const k = p.data.kit;
    k.mo_splits = (k.mo_splits || 0) + 1;
  });
}

// ---------------------------------------------------------------------------------------------- meditation
function updateMeditation(game, p, dt) {
  const k = p.data.kit, s = S(game), m = s.meditate;
  const moving = Math.abs(p.vx) + Math.abs(p.vy) > 0.01 || p.data.dash || k.mo_palmsRun;
  const busy = p.anim !== 'idle' && p.anim !== 'sit' && p.anim !== 'walk';
  if (moving || busy || p.data.down) {
    k.mo_still = 0;
    if (k.mo_med) {
      k.mo_med = false;
      game.ents.setFxTag(p, 'ki', false);
      if (p.anim === 'sit') game.ents.setAnim(p, 'idle');
      setPatch(game, p, 'mo_med', null);
    }
    return;
  }
  k.mo_still += dt;
  if (k.mo_still < m.after) return;
  if (!k.mo_med) {
    k.mo_med = true;
    game.ents.setFxTag(p, 'ki', true);
    game.ents.setAnim(p, 'sit');
    setPatch(game, p, 'mo_med', { held: { glow: s.jade } });   // fists glow jade while meditating
    game.fx({ type: 'ring', x: p.x, y: p.y, r: 1, color: s.color, dur: 0.6 });
    k.mo_meds = (k.mo_meds || 0) + 1;
  }
  if (isKi(p)) game.kits.gain(p, m.ki * dt);
  k.mo_hpAcc += p.hpMax * m.hp * dt;
  if (k.mo_hpAcc >= 1) {
    const n = Math.floor(k.mo_hpAcc);
    k.mo_hpAcc -= n;
    game.combat.heal(p, n, { silent: true });
  }
  k.mo_sparkT -= dt;
  if (k.mo_sparkT <= 0) { k.mo_sparkT = 1; game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 5, color: s.color, r: 0.6 }); }
}

// ---------------------------------------------------------------------------------------------- flying kick
// Each leg is an invulnerable `dash` with no built-in contact damage: the kit does the contact check itself (update) so a
// chained leg never re-hits the enemy it starts next to, then ends the leg and aims the next one.
function kickLeg(game, p, angle, dist, i) {
  const s = S(game), kk = s.kick;
  const st = p.data.kit.mo_kick;
  st.leg = i; st.angle = angle; st.legHit = null; st.active = true;
  game.fx({ type: 'afterimage', x: p.x, y: p.y, ent: p.id, color: s.color });
  game.abilities.use('dash', p, {
    angle, dist, speed: kk.speed, invuln: true, dmg: 0, through: true, color: s.color, trail: true,
    onEnd(g) { st.active = false; chainKick(g, p, st); },
  });
  game.ents.setAnim(p, 'dash', dist / kk.speed + 0.1);
}
function chainKick(game, p, st) {
  const kk = S(game).kick;
  const last = st.legHit;
  if (!last || st.leg >= st.chains) return;
  const near = enemiesNear(game, p, last.x, last.y, kk.chainRange, p.data.kit.mo_near || (p.data.kit.mo_near = []));
  let best = null, bd = Infinity;
  for (let j = 0; j < near.length; j++) {
    const e = near[j];
    if (st.hits.indexOf(e.id) >= 0) continue;
    const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return;
  kickLeg(game, p, Math.atan2(best.y - p.y, best.x - p.x), Math.sqrt(bd) + 0.4, st.leg + 1);
}
function updateKick(game, p) {
  const k = p.data.kit, st = k.mo_kick;
  if (!st || !st.active || !p.data.dash || st.legHit) return;
  const s = S(game), kk = s.kick;
  const near = enemiesNear(game, p, p.x, p.y, p.radius + 1.6, k.mo_near || (k.mo_near = []));
  let hit = null;
  for (let j = 0; j < near.length; j++) {
    const t = near[j];
    if (st.hits.indexOf(t.id) >= 0) continue;
    const dx = t.x - p.x, dy = t.y - p.y, rr = p.radius + t.radius + 0.35;
    if (dx * dx + dy * dy <= rr * rr) { hit = t; break; }
  }
  if (!hit) return;
  const i = st.leg;
  st.hits.push(hit.id); st.legHit = hit; st.legs++;
  const amount = kk.dmg * (1 + kk.grow * i) * game.combat.powerOf(p);
  game.combat.damage(hit, amount, { source: p, type: 'melee', knockback: kk.knockback, kbAngle: st.angle, color: s.color,
    tags: ['flying_kick'] });
  game.fx({ type: 'slash', x: hit.x, y: hit.y, angle: st.angle, arc: 90, r: 0.8, color: s.color, style: 'fist' });
  game.fx({ type: 'burst', x: hit.x, y: hit.y, n: 10 + i * 3, color: s.color, r: 0.5 + i * 0.1 });
  game.kits.gain(p, s.combo.kiPerHit);
  p.data.dash.remain = 0;            // stop on the hit; the dash ends next step and onEnd chains on
}
function castKick(game, p, ctx) {
  const s = S(game), kk = s.kick;
  const wind = boon(game, 'wind_step');
  p.data.kit.mo_kick = { hits: [], legs: 0, leg: 0, angle: 0, legHit: null, active: false, chains: kk.chains + (wind ? s.wind_step.chains : 0) };
  if (wind) {
    game.combat.status(p, 'haste', s.wind_step.hasteT, s.wind_step.haste);
    game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 10, color: s.jade, r: 0.6 });
  }
  kickLeg(game, p, ctx.moveAngle, kk.dist, 0);
  p.data.kit.mo_still = 0;
  return undefined;
}

// ---------------------------------------------------------------------------------------------- thousand palms
function castPalms(game, p) {
  const s = S(game), tp = s.palms, k = p.data.kit;
  k.mo_palmsRun = { i: 0, t: 0, next: 0, x0: p.x, y0: p.y };
  game.combat.status(p, 'invuln', tp.dur + 0.15);
  game.abilities.tagFor(p, 'haste', tp.dur);
  game.fx({ type: 'ring', x: p.x, y: p.y, r: tp.range, color: s.color, dur: 0.5 });
  game.fx({ type: 'screenFlash', color: s.color, dur: 0.15 });
  game.bus.emit('sfx', { id: 'dash' });
  return undefined;
}
function updatePalms(game, p, dt) {
  const k = p.data.kit, run = k.mo_palmsRun;
  if (!run) return;
  const s = S(game), tp = s.palms;
  k.speedMul = 0;
  run.t += dt;
  const every = tp.dur / tp.strikes;
  while (run.i < tp.strikes && run.t >= run.next) {
    run.next += every;
    const list = enemiesNear(game, p, run.x0, run.y0, tp.range, k.mo_near || (k.mo_near = []));
    for (let a = 1; a < list.length; a++) { const e = list[a]; let b = a - 1; while (b >= 0 && list[b].id > e.id) { list[b + 1] = list[b]; b--; } list[b + 1] = e; }
    const ox = p.x, oy = p.y;
    game.fx({ type: 'afterimage', x: ox, y: oy, ent: p.id, color: s.color });
    if (list.length) {
      const t = list[run.i % list.length];
      const a = game.rng.next() * Math.PI * 2;
      const dd = t.radius + p.radius + 0.25;
      game.physics.teleport(p, t.x + Math.cos(a) * dd, t.y + Math.sin(a) * dd);
      game.physics.resolve(p);
      const face = Math.atan2(t.y - p.y, t.x - p.x);
      p.angle = face; p.data.faceT = 0.2;
      game.combat.damage(t, tp.dmg * game.combat.powerOf(p), k.mo_palmOpts);
      game.fx({ type: 'hit', x: t.x, y: t.y, z: 0.5, color: s.color });
      game.fx({ type: 'slash', x: p.x, y: p.y, angle: face, arc: 90, r: 0.9, color: s.color, style: 'fist' });
      game.fx({ type: 'trail', x: ox, y: oy, x2: p.x, y2: p.y, color: s.color });
    } else {
      const a = game.rng.next() * Math.PI * 2;
      game.fx({ type: 'afterimage', x: run.x0 + Math.cos(a) * 1.5, y: run.y0 + Math.sin(a) * 1.5, ent: p.id, color: s.color });
    }
    game.ents.setAnim(p, 'attack', 0.15);
    run.i++;
    k.mo_palmStrikes = (k.mo_palmStrikes || 0) + 1;
  }
  if (run.i >= tp.strikes && run.t >= tp.dur) {
    k.mo_palmsRun = null;
    game.combat.aoe(p, { r: tp.ringR, dmg: tp.ringDmg, knockback: 9, fx: 'ring', color: s.color, type: 'magic', shake: 0.5, tags: ['thousand_palms'] });
    game.fx({ type: 'shockwave', x: p.x, y: p.y, r: tp.ringR, color: s.color });
    game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 30, color: s.color, r: tp.ringR });
    game.fx({ type: 'screenFlash', color: s.color, dur: 0.3 });
    game.abilities.use('heal', p, { pct: tp.heal });
    game.camera.shake = Math.max(game.camera.shake, 0.5);
  }
}

// ---------------------------------------------------------------------------------------------- the kit
const monk = {
  id: 'monk',
  parent: 'mage',
  resource: DEF.resource,
  basicMode: 'auto',
  interval(game) { return S(game).combo.beat; },
  basicInfo(game, p, rank) {
    const r = (sdata(game, 'monk') || DEF).ranks || DEF.ranks;
    if (rank < 3) return mage.basicInfo(game, p, rank);
    return rank >= 4 ? r[4] : r[3];
  },
  onEquip(game, p) {
    const k = p.data.kit;
    const s = S(game);
    k.mo_beat = 0; k.mo_lastT = -9; k.mo_punchUntil = 0; k.mo_punchA = 0; k.mo_still = 0; k.mo_med = false; k.mo_hpAcc = 0; k.mo_sparkT = 0;
    k.mo_pops = []; k.mo_near = []; k.mo_palmsRun = null;
    k.mo_reflOpts = { color: s.color };
    k.mo_palmOpts = { source: p, type: 'melee', knockback: 0.5, color: s.color, hitStop: 0.03, tags: ['thousand_palms'] };
    k.mo_off = game.bus.on('proj:reflected', (e) => onReflected(game, p, e));
  },
  onUnequip(game, p) {
    const k = p.data.kit;
    if (k.mo_off) k.mo_off();
    k.mo_off = null;
    game.ents.setFxTag(p, 'ki', false);
    if (k.mo_pops) for (const q of k.mo_pops) { const e = game.ents.get(q.id); if (e) e.z = q.z0; }
  },
  update(game, p, dt) {
    updateKick(game, p);
    updateDeflect(game, p);
    updatePops(game, p);
    updatePalms(game, p, dt);
    updateMeditation(game, p, dt);
  },
  hud(game, p, hud) {
    const k = p.data.kit;
    const beats = game.kits.rank(p) >= 4 ? 5 : 4;
    hud.kitHud = game.kits.kitHud;
    hud.kitHud.pips = game.t - k.mo_lastT > S(game).combo.reset ? 0 : k.mo_beat === 0 ? beats : k.mo_beat;
    hud.kitHud.pipsMax = beats;
    hud.kitHud.label = 'Combo';
    hud.kitHud.stance = k.mo_med ? 'Meditating' : null;
  },
  basic(game, p, ctx) {
    if (ctx.rank < 3) return mage.basic(game, p, ctx);
    const k = p.data.kit, s = S(game), c = s.combo;
    const beats = ctx.rank >= 4 ? 5 : 4;
    if (game.t - k.mo_lastT > c.reset) k.mo_beat = 0;
    const i = k.mo_beat % beats;
    strike(game, p, ctx.angle, i, ctx.rank);
    k.mo_beat = (i + 1) % beats;
    k.mo_lastT = game.t;
    k.mo_beatsDone = (k.mo_beatsDone || 0) + 1;
    (k.mo_log || (k.mo_log = [])).push(i);
    if (k.mo_log.length > 32) k.mo_log.shift();
    return i === beats - 1 ? c.beat + c.palmPause : c.beat;
  },
  abilities: {
    f: {
      id: 'flying_kick', name: 'Flying Kick', icon: 'kick', unlock: 8,
      get cd() { return DEF.kit.kick.cd; }, get cost() { return DEF.kit.kick.cost; },
      desc: 'Dash-kick an enemy, then bounce to the next one. Up to three times.',
      cast: castKick,
    },
    shift: {
      id: 'thousand_palms', name: 'Thousand Palms', icon: 'fist', unlock: 11,
      get cd() { return DEF.kit.palms.cd; }, get cost() { return DEF.kit.palms.cost; },
      desc: 'Become a blur that strikes every nearby enemy twelve times.',
      isActive(game, p) { return !!p.data.kit.mo_palmsRun; },
      cast: castPalms,
    },
  },
  hooks: {},
};

export { BEAT_NAMES };
export default monk;
