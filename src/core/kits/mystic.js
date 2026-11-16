// MYSTIC mastery (tier 3, layered over the Monk; docs/MASTERY.md). Spirit fists.
// Passive Spirit Fists: every Palm Strike launches three homing violet spirit fists (`orb` projectiles with a white core)
// in a fan, and every sweeping kick launches one, so the Mystic's punches reach across the room. Shift = Avatar (replaces
// Thousand Palms): for 8 s a giant see-through violet spirit copy of you (your look, scale 2.3, `glow`) rises around you
// and punches along with every beat of your combo (a wide `slash` cone in front); your Palm Strikes become ground slams
// (`shockwave`, camera shake, five spirit fists); when you stop punching it slams the nearest enemy on its own. You take
// less damage and cannot be knocked back while it lasts. Numbers: data/specs/mage.js `mystic.kit`. State: `my_*`.
import SPECS from '../../data/specs/mage.js';
import { enemiesNear, projLook, sdata, setPatch } from './mage.js';

const DEF = SPECS.mystic;
const D = (game) => sdata(game, 'mystic') || DEF;
const K = (game) => D(game).kit || DEF.kit;
const AVATAR_KEY = 'mystic_avatar';
const DEG = Math.PI / 180;

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
const lateMul = (game, p) => interp(D(game).balance && D(game).balance.dmgMul, game.kits.level(p));

// ---------------------------------------------------------------------------------------------- spirit fists
function spiritFists(game, p, angle, n, arcDeg) {
  const s = K(game), f = s.fists, k = p.data.kit;
  for (let i = 0; i < n; i++) {
    const a = angle + (n === 1 ? 0 : (-arcDeg / 2 + (arcDeg * i) / (n - 1)) * DEG);
    game.combat.projectile(p, { angle: a, speed: f.speed, range: f.range, dmg: f.dmg, radius: f.radius, homing: f.homing, homingRange: 6,
      type: 'magic', knockback: 2, look: projLook('orb', s.color, s.white, f.size), color: s.color, tags: ['spirit_fist'] });
  }
  game.fx({ type: 'sparkle', x: p.x + Math.cos(angle) * 0.7, y: p.y + Math.sin(angle) * 0.7, n: 4 + n * 2, color: s.cyan, r: 0.5 });
  k.my_fists = (k.my_fists || 0) + n;
}

// ---------------------------------------------------------------------------------------------- avatar
function avatarEnt(game, p) {
  const id = p.data.kit.my_avatar;
  const e = id ? game.ents.get(id) : null;
  return e && !e.removed && e.alive ? e : null;
}
function castAvatar(game, p) {
  const s = K(game), av = s.avatar, k = p.data.kit;
  const old = avatarEnt(game, p);
  if (old) game.combat.expireSummon(old, 'replace');
  const look = JSON.parse(JSON.stringify(p.look));
  look.aura = null;
  const out = game.abilities.use('summon', p, {
    def: { id: AVATAR_KEY, name: 'Avatar', look, stats: { radius: 0.4 }, attacks: [] }, key: AVATAR_KEY, max: 1, brain: 'none',
    power: p.stats.power, hp: p.hpMax, fx: false, fxTag: false, x: p.x, y: p.y, tags: ['avatar'],
  });
  const e = out && out[0];
  if (!e) return false;
  e.scale = 0.6;                       // grows to av.scale over the first half second
  e.alpha = av.alpha; e.tint = s.color; e.glow = s.color;
  e.solid = false; e.pushable = false;
  e.data.alwaysAwake = true; e.data.noPhysics = true; e.data.untargetable = true;
  e.angle = p.angle; e.dir = p.dir;
  k.my_avatar = e.id;
  k.my_until = game.t + av.dur;
  k.my_t0 = game.t;
  k.my_beatSeen = k.mo_beatsDone || 0;
  k.my_idleT = av.idle;
  game.combat.addMod(p, 'my_avatar', { dmgTaken: -av.armor, kbImmune: 1 }, av.dur);
  game.combat.status(p, 'invuln', 0.5);
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 2.2, color: s.color, dur: 1.2 });
  game.fx({ type: 'shockwave', x: p.x, y: p.y, r: 4, color: s.color });
  game.fx({ type: 'sparkle', x: p.x, y: p.y, n: 36, color: s.cyan, r: 2.5 });
  game.fx({ type: 'screenFlash', color: s.color, dur: 0.35 });
  game.camera.shake = Math.max(game.camera.shake, 0.6);
  game.combat.aoe(p, { r: 3, dmg: 0, knockback: 7, fx: false, type: 'magic' });
  game.ents.setAnim(p, 'cast', 0.4);
  setPatch(game, p, 'my_avatar', { held: { glow: '#ffffff' } });
  game.bus.emit('sfx', { id: 'spell' });
  k.my_avatars = (k.my_avatars || 0) + 1;
  return undefined;
}
/** The Avatar's punch: a wide cone in front of it; `slam` = a ground slam (Palm Strike / auto). */
function avatarPunch(game, p, e, angle, slam) {
  const s = K(game), av = s.avatar, k = p.data.kit;
  e.angle = angle;
  game.ents.setAnim(e, 'attack', 0.22);
  if (slam) {
    const x = p.x + Math.cos(angle) * 1.2, y = p.y + Math.sin(angle) * 1.2;
    game.combat.aoe(p, { x, y, r: av.slamR, dmg: av.slamDmg, knockback: 8, type: 'melee', fx: 'shockwave', color: s.color, shake: av.shake,
      hitStop: 0.04, tags: ['avatar_slam'] });
    game.fx({ type: 'burst', x, y, n: 26, color: s.cyan, r: av.slamR });
    game.fx({ type: 'ring', x, y, r: av.slamR + 0.8, color: s.white, dur: 0.4 });
    game.camera.shake = Math.max(game.camera.shake, av.shake);
    spiritFists(game, p, angle, av.slamFists, 120);
    k.my_slams = (k.my_slams || 0) + 1;
  } else {
    game.combat.aoe(p, { x: p.x, y: p.y, shape: 'cone', angle, arc: av.punchArc, r: av.punchR, dmg: av.punchDmg, knockback: 4, type: 'melee',
      fx: false, color: s.color, shake: 0.12, tags: ['avatar_punch'] });
    game.fx({ type: 'slash', x: p.x, y: p.y, angle, arc: av.punchArc, r: av.punchR, color: s.color, style: 'fist' });
    game.fx({ type: 'burst', x: p.x + Math.cos(angle) * av.punchR * 0.7, y: p.y + Math.sin(angle) * av.punchR * 0.7, n: 10, color: s.cyan, r: 0.8 });
    k.my_punches = (k.my_punches || 0) + 1;
  }
}
function endAvatar(game, p, e) {
  const s = K(game), k = p.data.kit;
  if (e) {
    game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 30, color: s.color, r: 1.8 });
    game.fx({ type: 'poof', x: e.x, y: e.y, color: s.color });
    game.combat.expireSummon(e, 'end');
  }
  k.my_avatar = 0; k.my_until = 0;
  game.combat.removeMod(p, 'my_avatar');
  setPatch(game, p, 'my_avatar', null);
}
function updateAvatar(game, p, dt) {
  const k = p.data.kit;
  if (!k.my_until) return;
  const e = avatarEnt(game, p);
  if (!e || game.t >= k.my_until || p.data.down) { endAvatar(game, p, e); return; }
  const s = K(game), av = s.avatar;
  const age = game.t - k.my_t0;
  e.scale = Math.min(av.scale, 0.6 + (av.scale - 0.6) * Math.min(1, age / 0.5));
  // the spirit stands around you (a step behind, so you stay visible inside it)
  e.x = p.x - Math.cos(p.angle) * 0.25; e.y = p.y - Math.sin(p.angle) * 0.25; e.z = 0;
  if (e.anim !== 'attack') { e.angle = p.angle; e.dir = p.dir; }
  // follow every beat of the combo (the Monk's counter moved this step)
  const beats = k.mo_beatsDone || 0;
  if (beats !== k.my_beatSeen) {
    k.my_beatSeen = beats;
    k.my_idleT = av.idle;
    const log = k.mo_log, beat = log && log.length ? log[log.length - 1] : 0;
    avatarPunch(game, p, e, k.mo_punchA != null ? k.mo_punchA : p.angle, beat === 3);
    return;
  }
  k.my_idleT -= dt;
  if (k.my_idleT > 0) return;
  k.my_idleT = av.idle;
  const near = enemiesNear(game, p, p.x, p.y, av.autoR, k.my_near || (k.my_near = []));
  let best = null, bd = Infinity;
  for (let i = 0; i < near.length; i++) { const t = near[i], d = (t.x - p.x) ** 2 + (t.y - p.y) ** 2; if (d < bd) { bd = d; best = t; } }
  if (best) avatarPunch(game, p, e, Math.atan2(best.y - p.y, best.x - p.x), true);
}

// ---------------------------------------------------------------------------------------------- the kit
const mystic = {
  id: 'mystic',
  parent: 'monk',
  tier: 3,
  onEquip(game, p) {
    const k = p.data.kit;
    k.my_beat2 = k.mo_beatsDone || 0; k.my_avatar = 0; k.my_until = 0; k.my_near = [];
    setPatch(game, p, 'ms_look', D(game).look);
  },
  onUnequip(game, p) {
    const e = avatarEnt(game, p);
    if (e) game.combat.expireSummon(e, 'unequip');
    game.combat.removeMod(p, 'my_avatar');
  },
  update(game, p, dt) {
    const k = p.data.kit;
    const beats = k.mo_beatsDone || 0;
    if (beats !== k.my_beat2) {
      k.my_beat2 = beats;
      const log = k.mo_log, beat = log && log.length ? log[log.length - 1] : -1;
      const f = K(game).fists, a = k.mo_punchA != null ? k.mo_punchA : p.angle;
      if (beat === 3) spiritFists(game, p, a, f.palm, f.arc);
      else if (beat === 2) spiritFists(game, p, a, f.kick, 0);
    }
    updateAvatar(game, p, dt);
  },
  hud(game, p, hud) {
    if (p.data.kit.my_until > game.t && hud.kitHud) hud.kitHud.stance = 'Avatar';
  },
  abilities: {
    shift: {
      id: 'avatar', name: 'Avatar', icon: 'fist', unlock: 15,
      get cd() { return DEF.kit.avatar.cd; }, get cost() { return DEF.kit.avatar.cost; },
      desc: DEF.ultimate.desc,
      isActive(game, p) { return p.data.kit.my_until > game.t; },
      cast: castAvatar,
    },
  },
  hooks: {
    onOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
  },
};

export default mystic;
