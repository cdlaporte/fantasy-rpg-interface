// ILLUSIONIST mastery (tier 3, layered over the Conjurer; docs/MASTERY.md). Mirror images.
// Passive Mirror Images: every spell you cast (Blink, Arcane Nova, Summon Familiar) and every sixth Spirit Bolt leaves a
// mirror copy of you (your look, rose `tint`, see-through, fxTag `shadow`) for a few seconds. Copies taunt enemies, copy
// each Spirit Bolt you fire with a rose mini-bolt of their own, and burst in a rose ring when they fade or fall (max 3).
// Blink leaves the copy where you stood. Shift = Hall of Mirrors (replaces Grand Conjuration): six mirror copies appear
// in a ring around you, linked by flashing mirror beams, and all cast Spirit Bolts at the nearest enemies for 7 s, then
// shatter one after another. Numbers: data/specs/mage.js `illusionist.kit`. State keys: `il_*` in p.data.kit.
import SPECS from '../../data/specs/mage.js';
import conjurer from './conjurer.js';
import { defer, enemiesNear, projLook, sdata, setPatch } from './mage.js';
import { tintAt, tintAmountAt } from '../clock.js';

const DEF = SPECS.illusionist;
const D = (game) => sdata(game, 'illusionist') || DEF;
const K = (game) => D(game).kit || DEF.kit;
const IMAGE_KEY = 'mirror_image';
const HALL_KEY = 'hall_mirror';
const TAU = Math.PI * 2;

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

function imagesOf(game, p, key, out) { return game.combat.summonsOf(p, key, out); }

// ---------------------------------------------------------------------------------------------- mirror copies
/** A mirror copy of the player at (x, y): a taunting decoy with the player's look, rose tint, bursting on its end. */
function spawnCopy(game, p, x, y, key, ttl, hpMul, big) {
  const s = K(game), im = s.image;
  if (game.world.solidAt(x, y)) { x = p.x; y = p.y; }
  const e = game.combat.decoy(p, {
    kind: key, key, x, y, ttl, hp: Math.max(5, Math.round(p.hpMax * hpMul)), power: p.stats.power, name: p.name,
    onExpire(g, d) { copyBurst(g, p, d, big); },
    onDeath(g, d) { copyBurst(g, p, d, big); },
  });
  if (!e) return null;
  e.tint = s.color;
  e.alpha = im.alpha;
  e.glow = s.light;
  e.angle = p.angle; e.dir = p.dir;
  e.data.alwaysAwake = true;
  e.data.ilCopy = true;
  game.fx({ type: 'sparkle', x, y, n: 10, color: s.light, r: 0.6 });
  game.fx({ type: 'ring', x, y, r: 0.9, color: s.color, dur: 0.3 });
  return e;
}
function copyBurst(game, p, d, big) {
  if (!p || p.removed || !p.data.kit || d.data.ilBurst) return;
  d.data.ilBurst = true;
  const s = K(game), x = d.x, y = d.y;
  const r = big ? s.hall.shatterR : s.image.burstR, dmg = big ? s.hall.shatterDmg : s.image.burstDmg;
  defer(p, () => {
    game.combat.aoe(p, { x, y, r, dmg, knockback: 5, type: 'magic', fx: 'burst', color: s.color, shake: big ? 0.2 : 0.1,
      tags: [big ? 'mirror_shatter' : 'mirror_burst'] });
    game.fx({ type: 'ring', x, y, r: r + 0.3, color: s.lavender, dur: 0.35 });
    game.fx({ type: 'sparkle', x, y, n: big ? 18 : 10, color: '#ffffff', r });
    const k = p.data.kit;
    k.il_bursts = (k.il_bursts || 0) + 1;
  });
}
/** Passive: leave a mirror image (oldest bursts early beyond the max). */
function leaveImage(game, p, x, y) {
  const s = K(game), im = s.image, k = p.data.kit;
  const list = imagesOf(game, p, IMAGE_KEY, k.il_list || (k.il_list = []));
  if (list.length >= im.max) {
    let old = list[0];
    for (let i = 1; i < list.length; i++) if (list[i].data.summonedAt < old.data.summonedAt) old = list[i];
    game.combat.expireSummon(old, 'replace');
  }
  const e = spawnCopy(game, p, x, y, IMAGE_KEY, im.ttl, im.hpMul, false);
  if (e) { k.il_images = (k.il_images || 0) + 1; game.fx({ type: 'afterimage', x, y, ent: p.id, color: s.color }); }
  return e;
}
/** Every passive mirror image fires a rose mini-bolt at the point the player aimed at (hall mirrors cast on their own). */
function copiesCast(game, p, tx, ty, dmg) {
  const s = K(game), im = s.image, k = p.data.kit, cj = (sdata(game, 'conjurer') || SPECS.conjurer).kit;
  const status = { id: 'mark', t: cj.spiritBolt.markT, p: cj.spiritBolt.markPower };
  const pw = game.combat.powerOf(p);
  {
    const list = imagesOf(game, p, IMAGE_KEY, k.il_list2 || (k.il_list2 = []));
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const a = Math.atan2(ty - c.y, tx - c.x);
      c.angle = a;
      game.combat.projectile(c, { angle: a, speed: im.boltSpeed, range: im.boltRange, amount: dmg * pw, radius: 0.16, type: 'magic',
        knockback: 0.5, status, look: projLook('orb', s.color, '#ffffff', 0.85), tags: ['mirror_bolt'] });
      game.ents.setAnim(c, 'cast', 0.2);
      k.il_copyBolts = (k.il_copyBolts || 0) + 1;
    }
  }
}

// ---------------------------------------------------------------------------------------------- hall of mirrors
function castHall(game, p) {
  const s = K(game), h = s.hall, k = p.data.kit;
  for (const e of imagesOf(game, p, HALL_KEY, [])) game.combat.expireSummon(e, 'replace');
  const ids = k.il_hall || (k.il_hall = []);
  ids.length = 0;
  for (let i = 0; i < h.n; i++) {
    const a = (i / h.n) * TAU + p.angle;
    const x = p.x + Math.cos(a) * h.r, y = p.y + Math.sin(a) * h.r;
    const e = spawnCopy(game, p, x, y, HALL_KEY, h.dur + i * 0.12, h.hpMul, true);
    if (!e) continue;
    e.alpha = 0.8;
    e.data.ilNext = game.t + 0.35 + i * (h.every / h.n);
    ids.push(e.id);
    game.fx({ type: 'pillar', x: e.x, y: e.y, r: 0.6, color: s.color, dur: 0.7 });
  }
  k.il_hallUntil = game.t + h.dur;
  k.il_beamT = 0;
  game.combat.status(p, 'invuln', 0.6);
  game.fx({ type: 'ring', x: p.x, y: p.y, r: h.r + 0.6, color: s.color, dur: 0.6 });
  game.fx({ type: 'shockwave', x: p.x, y: p.y, r: h.r, color: s.lavender });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 36, color: '#ffffff', r: h.r });
  game.fx({ type: 'screenFlash', color: s.color, dur: 0.3 });
  game.camera.shake = Math.max(game.camera.shake, 0.3);
  game.ents.setAnim(p, 'cast', 0.5);
  setPatch(game, p, 'il_hall', { held: { glow: '#ffffff' } });
  game.bus.emit('sfx', { id: 'spell' });
  k.il_halls = (k.il_halls || 0) + 1;
  return undefined;
}
function mirrorBeams(game, p, list) {
  const s = K(game);
  for (let i = 0; i < list.length; i++) {
    const a = list[i], b = list[(i + 1) % list.length];
    if (a === b) continue;
    game.fx({ type: 'beam', x: a.x, y: a.y, x2: b.x, y2: b.y, w: 0.12, color: i % 2 ? s.color : s.lavender });
  }
}
function updateHall(game, p, dt) {
  const k = p.data.kit;
  if (!k.il_hallUntil) return;
  const s = K(game), h = s.hall;
  const list = imagesOf(game, p, HALL_KEY, k.il_hallList || (k.il_hallList = []));
  if (game.t >= k.il_hallUntil + 1 || !list.length) {
    k.il_hallUntil = 0;
    setPatch(game, p, 'il_hall', null);
    moodEnd(game);
    return;
  }
  mood(game, s.lavender, 0.2);                       // a dreamy lavender hall
  k.il_beamT -= dt;
  if (k.il_beamT <= 0) { k.il_beamT = h.beamEvery; mirrorBeams(game, p, list); }
  const pw = game.combat.powerOf(p), cj = (sdata(game, 'conjurer') || SPECS.conjurer).kit;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (game.t < c.data.ilNext) continue;
    c.data.ilNext = game.t + h.every;
    const near = enemiesNear(game, p, c.x, c.y, h.range, k.il_near || (k.il_near = []));
    let best = null, bd = Infinity;
    for (let j = 0; j < near.length; j++) {
      const e = near[j], d = (e.x - c.x) * (e.x - c.x) + (e.y - c.y) * (e.y - c.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) continue;
    const a = Math.atan2(best.y - c.y, best.x - c.x);
    c.angle = a;
    game.combat.projectile(c, { angle: a, speed: cj.spiritBolt.speed + 1, range: h.range, amount: h.boltDmg * pw, radius: 0.2, type: 'magic',
      knockback: 1, homing: 3, homingTarget: best.id, status: { id: 'mark', t: cj.spiritBolt.markT, p: cj.spiritBolt.markPower },
      look: projLook('orb', s.color, '#ffffff', 1.1), tags: ['hall_bolt'] });
    game.ents.setAnim(c, 'cast', 0.2);
    game.fx({ type: 'sparkle', x: c.x + Math.cos(a) * 0.4, y: c.y + Math.sin(a) * 0.4, n: 4, color: s.light, r: 0.3 });
    k.il_hallBolts = (k.il_hallBolts || 0) + 1;
  }
}

// ---------------------------------------------------------------------------------------------- the kit
const illusionist = {
  id: 'illusionist',
  parent: 'conjurer',
  tier: 3,
  // the basic is the Conjurer's Spirit Bolt; the wrapper only adds the mirror copies
  basicMode: conjurer.basicMode,
  aimRange: conjurer.aimRange,
  interval: conjurer.interval,
  basicInfo: conjurer.basicInfo,
  basic(game, p, ctx) {
    const r = conjurer.basic(game, p, ctx);
    if (ctx.rank < 3) return r;
    const k = p.data.kit, s = K(game);
    const tx = p.x + Math.cos(ctx.angle) * 5, ty = p.y + Math.sin(ctx.angle) * 5;
    copiesCast(game, p, tx, ty, s.image.boltDmg);
    k.il_shots = (k.il_shots || 0) + 1;
    if (k.il_shots % s.image.every === 0) {
      const side = (k.il_shots / s.image.every) % 2 ? 1 : -1, a = ctx.angle + side * Math.PI / 2;
      leaveImage(game, p, p.x + Math.cos(a) * 1.1, p.y + Math.sin(a) * 1.1);
    }
    return r;
  },
  onEquip(game, p) {
    const k = p.data.kit;
    k.il_list = []; k.il_list2 = []; k.il_hall = []; k.il_hallUntil = 0; k.il_shots = 0; k.il_px = p.x; k.il_py = p.y;
    setPatch(game, p, 'ms_look', D(game).look);
    k.il_off = game.bus.on('ability:cast', (e) => {
      if (e.ent !== p || e.slot === 'shift' || !p.data.kit || p.data.kit !== k) return;
      // Blink leaves the copy where you stood (the position before this step's move); other spells beside you
      const x = e.slot === 'space' ? k.il_px : p.x, y = e.slot === 'space' ? k.il_py : p.y;
      leaveImage(game, p, x, y);
    });
  },
  onUnequip(game, p) {
    const k = p.data.kit;
    if (k.il_off) k.il_off();
    k.il_off = null;
    for (const key of [IMAGE_KEY, HALL_KEY]) for (const e of imagesOf(game, p, key, [])) { e.data.ilBurst = true; game.combat.expireSummon(e, 'unequip'); }
  },
  update(game, p, dt) {
    const k = p.data.kit;
    updateHall(game, p, dt);
    k.il_px = p.x; k.il_py = p.y;
  },
  hud(game, p, hud) {
    if (!hud.kitHud) return;
    const k = p.data.kit;
    if (k.il_hallUntil > game.t) hud.kitHud.stance = 'Hall of Mirrors';
  },
  abilities: {
    shift: {
      id: 'hall_of_mirrors', name: 'Hall of Mirrors', icon: 'star', unlock: 15,
      get cd() { return DEF.kit.hall.cd; }, get cost() { return DEF.kit.hall.cost; },
      desc: DEF.ultimate.desc,
      isActive(game, p) { return p.data.kit.il_hallUntil > game.t; },
      cast: castHall,
    },
  },
  hooks: {
    onOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
  },
};

export default illusionist;
