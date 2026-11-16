// SAGE mastery (tier 3, layered over the Monk; docs/MASTERY.md). The calm healer.
// Passive Still Mind: while you are not moving (punching in place counts) Ki fills quickly and you slowly heal, with a
// soft lotus `sparkle`; every Palm Strike sends a lotus `ring` out that heals your classmates and your summons nearby
// (`heal` fx on each and a lotus `trail` to them) and you a little. Shift = Enlightenment (replaces Thousand Palms): you
// rise into the air in a golden bubble of slow time (a `zone` that follows you): enemies inside crawl (heavy slow), enemy
// shots inside slow to a crawl, a calm pulse hurts enemies every second, you and your friends heal a lot at once and keep
// healing, and your own fists speed up. Numbers: data/specs/mage.js `sage.kit`. State keys: `sg_*` in p.data.kit.
import SPECS from '../../data/specs/mage.js';
import { sdata, setPatch } from './mage.js';
import { tintAt, tintAmountAt } from '../clock.js';

const DEF = SPECS.sage;
const D = (game) => sdata(game, 'sage') || DEF;
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
const isKi = (p) => !!(p.data.resource && p.data.resource.id === 'ki');

/** Classmates (companions) and the player's summons within r of (x, y), excluding decoys. */
function alliesNear(game, p, x, y, r, out) {
  const list = game.ents.inRadius(x, y, r, null, out);
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e === p || e.removed || !e.alive || e.team !== p.team || e.data.decoy) continue;
    if (e.type !== 'companion' && e.type !== 'summon') continue;
    list[n++] = e;
  }
  list.length = n;
  return list;
}

// ---------------------------------------------------------------------------------------------- still mind
function updateStill(game, p, dt) {
  const k = p.data.kit, s = K(game), st = s.still;
  const moving = Math.abs(p.vx) + Math.abs(p.vy) > 0.01 || !!p.data.dash || !!k.mo_palmsRun || p.data.down;
  if (moving) { k.sg_stillT = 0; return; }
  k.sg_stillT += dt;
  if (k.sg_stillT < st.after) return;
  if (isKi(p)) game.kits.gain(p, st.ki * dt);
  k.sg_hpAcc += p.hpMax * st.hp * dt;
  if (k.sg_hpAcc >= 1 && p.hp < p.hpMax) {
    const n = Math.floor(k.sg_hpAcc);
    k.sg_hpAcc -= n;
    game.combat.heal(p, n, { silent: true });
  } else if (k.sg_hpAcc >= 1) k.sg_hpAcc = 0;
  k.sg_sparkT -= dt;
  if (k.sg_sparkT <= 0) { k.sg_sparkT = 0.7; game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 4, color: s.color, r: 0.5 }); }
  k.sg_stillSecs = (k.sg_stillSecs || 0) + dt;
}
/** Palm Strike just landed (Monk counter `mo_palms` moved): heal classmates and summons nearby, and you a little. */
function palmHeal(game, p) {
  const k = p.data.kit, s = K(game), ph = s.palmHeal;
  game.fx({ type: 'ring', x: p.x, y: p.y, r: ph.r, color: s.color, dur: 0.4 });
  const list = alliesNear(game, p, p.x, p.y, ph.r, k.sg_near || (k.sg_near = []));
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.hp >= a.hpMax) continue;
    const healed = game.combat.heal(a, Math.max(1, Math.round(a.hpMax * ph.ally)), { source: p });
    game.fx({ type: 'trail', x: p.x, y: p.y, x2: a.x, y2: a.y, color: s.color });
    if (healed > 0) k.sg_allyHealed = (k.sg_allyHealed || 0) + healed;
  }
  if (p.hp < p.hpMax) game.combat.heal(p, Math.max(1, Math.round(p.hpMax * ph.self)), { source: p, silent: true });
  k.sg_palmHeals = (k.sg_palmHeals || 0) + 1;
}

// ---------------------------------------------------------------------------------------------- enlightenment
function castEnlighten(game, p) {
  const s = K(game), en = s.enlighten, k = p.data.kit;
  const healAll = (e) => game.combat.heal(e, Math.max(1, Math.round(e.hpMax * en.heal)), { source: p });
  healAll(p);
  const list = alliesNear(game, p, p.x, p.y, en.r + 1, k.sg_near || (k.sg_near = []));
  for (let i = 0; i < list.length; i++) { healAll(list[i]); game.fx({ type: 'pillar', x: list[i].x, y: list[i].y, r: 0.5, color: s.gold, dur: 0.8 }); }
  if (isKi(p)) game.kits.gain(p, en.ki);
  k.sg_zone = game.combat.zone(p, { follow: p, r: en.r, dur: en.dur, tick: en.tick, firstTick: true, color: s.gold,
    status: { slow: [en.tick * 2 + 0.1, en.slow] }, healAmount: Math.max(1, Math.round(p.hpMax * en.regen)), id: 'enlightenment' });
  // the Sage herself floats inside a small golden bubble (visual only)
  k.sg_bubble = game.combat.zone(p, { follow: p, r: 1.1, dur: en.dur, tick: 10, bubble: true, color: s.gold, id: 'enlightenment_bubble' });
  k.sg_until = game.t + en.dur;
  k.sg_pulseT = en.pulseEvery * 0.5;
  game.combat.addMod(p, 'sg_enlighten', { attackSpeed: en.attackSpeed, kbImmune: 1 }, en.dur);
  game.abilities.tagFor(p, 'ki', en.dur);
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 2.0, color: s.gold, dur: 1.6 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: en.r, color: s.gold, dur: 0.9 });
  game.fx({ type: 'shockwave', x: p.x, y: p.y, r: en.r * 0.6, color: s.color });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 40, color: s.white, r: en.r });
  game.fx({ type: 'screenFlash', color: '#fff6d6', dur: 0.4 });
  game.camera.shake = Math.max(game.camera.shake, 0.25);
  setPatch(game, p, 'sg_enlighten', { held: { glow: '#ffffff' }, aura: { style: 'glow', color: s.gold } });
  game.bus.emit('sfx', { id: 'spell' });
  k.sg_casts = (k.sg_casts || 0) + 1;
  return undefined;
}
function endEnlighten(game, p) {
  const k = p.data.kit, s = K(game);
  k.sg_until = 0;
  p.z = 0;
  setPatch(game, p, 'sg_enlighten', null);
  moodEnd(game);
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 20, color: s.gold, r: 1.5 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: 1.5, color: s.color, dur: 0.4 });
}
function updateEnlighten(game, p, dt) {
  const k = p.data.kit;
  if (!k.sg_until) return;
  const s = K(game), en = s.enlighten;
  if (game.t >= k.sg_until || p.data.down) { endEnlighten(game, p); return; }
  mood(game, s.gold, 0.22);                          // golden, still light inside the slow time
  // levitate: the Sage floats a little above the ground, bobbing
  const age = en.dur - (k.sg_until - game.t);
  p.z = Math.min(en.lift, age * 2) + Math.sin(age * 3) * 0.05;
  // time slows for enemy shots inside the bubble
  const all = game.ents.all, r2 = en.r * en.r;
  for (let i = 0; i < all.length; i++) {
    const e = all[i];
    if (e.type !== 'projectile' || e.removed || e.team === p.team || e.data.sgSlowed) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    if (dx * dx + dy * dy > r2) continue;
    const pd = e.data.proj;
    if (!pd) continue;
    e.data.sgSlowed = true;
    pd.speed *= en.projSlow; pd.returnSpeed *= en.projSlow; e.vx *= en.projSlow; e.vy *= en.projSlow;
    game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 4, color: s.gold, r: 0.3 });
    k.sg_slowedShots = (k.sg_slowedShots || 0) + 1;
  }
  k.sg_pulseT -= dt;
  if (k.sg_pulseT <= 0) {
    k.sg_pulseT = en.pulseEvery;
    game.combat.aoe(p, { x: p.x, y: p.y, r: en.r, dmg: en.pulseDmg, knockback: 0.5, type: 'magic', fx: { type: 'ring', r: en.r, color: s.gold, dur: 0.8 },
      color: s.gold, tags: ['enlightenment'] });
    game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 12, color: s.color, r: en.r * 0.8 });
    k.sg_pulses = (k.sg_pulses || 0) + 1;
  }
}

// ---------------------------------------------------------------------------------------------- the kit
const sage = {
  id: 'sage',
  parent: 'monk',
  tier: 3,
  onEquip(game, p) {
    const k = p.data.kit;
    k.sg_stillT = 0; k.sg_hpAcc = 0; k.sg_sparkT = 0; k.sg_until = 0; k.sg_palmSeen = k.mo_palms || 0; k.sg_near = [];
    setPatch(game, p, 'ms_look', D(game).look);
  },
  onUnequip(game, p) {
    const k = p.data.kit;
    if (k.sg_until) { p.z = 0; k.sg_until = 0; }
    if (k.sg_zone && !k.sg_zone.removed) game.ents.remove(k.sg_zone);
    if (k.sg_bubble && !k.sg_bubble.removed) game.ents.remove(k.sg_bubble);
    game.combat.removeMod(p, 'sg_enlighten');
  },
  update(game, p, dt) {
    const k = p.data.kit;
    if ((k.mo_palms || 0) !== k.sg_palmSeen) { k.sg_palmSeen = k.mo_palms || 0; palmHeal(game, p); }
    updateStill(game, p, dt);
    updateEnlighten(game, p, dt);
  },
  hud(game, p, hud) {
    if (p.data.kit.sg_until > game.t && hud.kitHud) hud.kitHud.stance = 'Enlightened';
  },
  abilities: {
    shift: {
      id: 'enlightenment', name: 'Enlightenment', icon: 'heart', unlock: 15,
      get cd() { return DEF.kit.enlighten.cd; }, get cost() { return DEF.kit.enlighten.cost; },
      desc: DEF.ultimate.desc,
      isActive(game, p) { return p.data.kit.sg_until > game.t; },
      cast: castEnlighten,
    },
  },
  hooks: {
    onOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
  },
};

export default sage;
