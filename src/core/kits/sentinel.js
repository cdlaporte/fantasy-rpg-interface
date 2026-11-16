// Sentinel mastery (tier 3, layered over knight; docs/MASTERY.md). Counter fortress.
// Passive Bastion: blocked hits (perfect ones count double) and hits taken fill a Bastion meter (kit HUD label); when it
// is full it releases a counter shockwave around you (scaled by the damage blocked since the last one; stun).
// Shift Bulwark Fortress (unlock 15): for 6 s you are a fortress (four steel towers, a blue dome that moves with you):
// every enemy within 8 must attack you (taunt), you take half damage, every hostile projectile that comes within reach
// is reflected, ramparts strike everything next to you each second; it ends with a crash that grows with what you soaked.
import { W, TAG_SKILL } from './warrior.js';
import { MW } from './paladin.js';

const ID = 'sentinel';
const N = (game) => MW.nums(game, ID);
const C = (game) => MW.colors(game, ID);
const foes = [];
const LABELS = [];
for (let i = 0; i <= 10; i++) LABELS.push('Bastion ' + i * 10 + '%');

function gain(game, p, n) {
  const sn = p.data.kit.snt;
  if (!sn || sn.burstQ) return;
  sn.bastion = Math.min(N(game).bastion.max, sn.bastion + n);
  if (sn.bastion >= N(game).bastion.max) sn.burstQ = true;   // released in update (outside the damage pipeline)
}

function bastionBurst(game, p, sn) {
  const n = N(game).bastion, col = C(game);
  const pw = game.combat.powerOf(p);
  const amount = n.dmg * pw + Math.min(sn.blocked * n.blockedFrac, n.capCoef * pw);
  sn.bastion = 0; sn.blocked = 0; sn.burstQ = false; sn.bursts++;
  game.combat.aoe(p, { x: p.x, y: p.y, r: n.r, amount, knockback: n.knockback, status: { stun: n.stun }, type: 'melee', tags: TAG_SKILL,
    fx: 'shockwave', color: col.blue, shake: 0.5, hitStop: 0.06 });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: n.r + 0.8, color: col.white, dur: 0.6 });
  game.fx({ type: 'pillar', x: p.x, y: p.y, r: 1.1, color: col.blue, dur: 0.6 });
  game.fx({ type: 'burst', x: p.x, y: p.y, n: 30, r: n.r * 0.8, color: col.steel });
  game.fx({ type: 'slash', x: p.x, y: p.y, angle: p.angle, arc: 360, r: n.r, color: col.white, style: 'spin', w: 2 });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.7, text: 'BASTION!', style: 'info', ent: p.id });
  game.ents.setAnim(p, 'attack', 0.25);
  game.bus.emit('sfx', { id: 'hit' });
  return amount;
}

function towers(game, p, f, r, dur) {
  const n = N(game).fortress, col = C(game);
  for (let i = 0; i < n.towers; i++) {
    const a = i * Math.PI * 2 / n.towers + Math.PI / 4;
    game.fx({ type: 'pillar', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, r: 0.55, color: i % 2 ? col.steel : col.blue, dur });
  }
}

function fortressEnd(game, p, sn) {
  const f = sn.fort, n = N(game).fortress, col = C(game);
  sn.fort = null;
  if (f.ent && !f.ent.removed) game.ents.remove(f.ent);
  p.data.taunt = f.prevTaunt;
  game.ents.setFxTag(p, 'shield', false);
  game.combat.removeMod(p, 'sentinel_fortress');
  const pw = game.combat.powerOf(p);
  const amount = n.endDmg * pw + Math.min(f.soaked * n.soakFrac, n.capCoef * pw);
  game.combat.aoe(p, { x: p.x, y: p.y, r: n.endR, amount, knockback: 13, status: { stun: 0.8 }, type: 'melee', tags: TAG_SKILL,
    fx: 'shockwave', color: col.blue, shake: 0.75 });
  towers(game, p, p, n.endR * 0.7, 0.5);
  game.fx({ type: 'meteor', x: p.x, y: p.y, r: n.endR * 0.6, color: col.steel });
  game.fx({ type: 'ring', x: p.x, y: p.y, r: n.endR + 1.2, color: col.white, dur: 0.8 });
  game.fx({ type: 'burst', x: p.x, y: p.y, n: 40, r: n.endR, color: col.steel });
  game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: '#cfe3ff', dur: 0.3 });
  game.fx({ type: 'text', x: p.x, y: p.y, z: 1.8, text: 'The walls fall!', style: 'info', ent: p.id });
  sn.fortEnds++;
  return amount;
}

export default {
  id: ID,
  parent: 'knight',
  tier: 3,

  onEquip(game, p) {
    p.data.kit.snt = { bastion: 0, blocked: 0, burstQ: false, bursts: 0, fort: null, fortEnds: 0, glow: false, mods: { kbImmune: 1 } };
    MW.equipLook(game, p, ID);
    W.refresh(game, p);
  },
  onUnequip(game, p) {
    const sn = p.data.kit.snt;
    if (!sn) return;
    if (sn.fort) { if (sn.fort.ent && !sn.fort.ent.removed) game.ents.remove(sn.fort.ent); p.data.taunt = sn.fort.prevTaunt; sn.fort = null; }
    game.combat.removeMod(p, 'sentinel_fortress');
    game.ents.setFxTag(p, 'shield', false);
    if (sn.glow) p.glow = null;
  },
  aura(game, p) { return MW.aura(game, p, ID); },

  update(game, p) {
    const sn = p.data.kit.snt;
    if (!sn) return;
    const n = N(game), col = C(game);
    if (sn.burstQ) bastionBurst(game, p, sn);
    const glow = sn.bastion >= n.bastion.glowAt;
    if (glow !== sn.glow) {
      sn.glow = glow;
      p.glow = glow ? col.blue : null;
      if (glow) W.fx(game, 'ring', p.x, p.y, 1.2, col.blue, 0, 0.35);
    }
    const f = sn.fort;
    if (!f) return;
    // reflect every hostile projectile that comes within reach
    const nr = game.combat.reflectInArc(p, p.x, p.y, 0, 360, n.fortress.r, f.reflectOpts);
    if (nr) f.reflected += nr;
    if (game.t >= f.nextPulse) {
      f.nextPulse += n.fortress.pulse;
      // taunt: everything within tauntR turns on you
      MW.foes(game, p, p.x, p.y, n.fortress.tauntR, foes);
      for (let i = 0; i < foes.length; i++) { const e = foes[i]; if (e.ai) e.ai.target = p.id; }
      W.fx(game, 'ring', p.x, p.y, n.fortress.tauntR, col.blue, 0, 0.5);
      towers(game, p, p, n.fortress.r, 0.7);
      game.combat.aoe(p, { x: p.x, y: p.y, r: n.fortress.pulseR, dmg: n.fortress.pulseDmg, knockback: 5, type: 'melee', tags: TAG_SKILL,
        fx: { type: 'ring', r: n.fortress.pulseR, color: col.steel, dur: 0.3 } });
      const sl = W.prep('slash', p.x, p.y, n.fortress.pulseR, col.steel);
      sl.style = 'spin'; sl.arc = 360; sl.angle = game.t * 3;
      game.fx(sl);
    }
    if (game.t >= f.end) fortressEnd(game, p, sn);
  },

  hud(game, p, hud) {
    const sn = p.data.kit.snt;
    if (!sn) return;
    const kh = game.kits.kitHud;
    kh.label = LABELS[Math.min(10, Math.floor(sn.bastion / 10))];
    if (sn.fort) kh.stance = 'Fortress';
    else if (!kh.stance && sn.bastion >= 10) kh.stance = kh.label;   // the attack box shows the meter ("Bastion 60%")
    hud.kitHud = kh;
  },

  abilities: {
    shift: MW.ability(ID, 'bulwark_fortress', {
      cast(game, p) {
        const sn = p.data.kit.snt;
        const n = N(game).fortress, col = C(game);
        if (sn.fort && sn.fort.ent && !sn.fort.ent.removed) game.ents.remove(sn.fort.ent);
        const dur = n.dur + MW.oath(game, p);
        const ent = game.combat.zone(p, { x: p.x, y: p.y, r: n.r, dur, tick: 0.5, bubble: true, follow: p, color: col.blue, id: 'fortress' });
        sn.fort = { end: game.t + dur, nextPulse: game.t + 0.25, soaked: 0, reflected: 0, ent, prevTaunt: !!(sn.fort ? sn.fort.prevTaunt : p.data.taunt),
          reflectOpts: { mult: n.reflectMult, homing: 6, color: col.blue } };
        p.data.taunt = true;
        game.ents.setFxTag(p, 'shield', true);
        game.combat.addMod(p, 'sentinel_fortress', sn.mods, dur);
        towers(game, p, p, n.r, 1.4);
        game.fx({ type: 'shockwave', x: p.x, y: p.y, r: n.r + 0.5, color: col.blue });
        game.fx({ type: 'ring', x: p.x, y: p.y, r: n.tauntR, color: col.white, dur: 0.7 });
        game.fx({ type: 'burst', x: p.x, y: p.y, n: 30, r: n.r, color: col.steel });
        game.fx({ type: 'text', x: p.x, y: p.y, z: 1.8, text: 'Face me!', style: 'info', ent: p.id });
        game.fx({ type: 'screenFlash', x: p.x, y: p.y, color: '#cfe3ff', dur: 0.2 });
        game.camera.shake = Math.max(game.camera.shake, 0.4);
        game.ents.setAnim(p, 'block', 0.5);
        game.bus.emit('sfx', { id: 'boss' });
        return undefined;
      },
      isActive(game, p) { return !!(p.data.kit.snt && p.data.kit.snt.fort); },
    }),
  },

  hooks: {
    onOutgoing(game, p, info) { const m = MW.mul(game, p, ID); if (m !== 1) info.amount *= m; },
    onIncoming(game, p, info) {
      const sn = p.data.kit.snt;
      if (!sn || !sn.fort || info.target !== p || !(info.amount > 0) || info.type === 'true') return;
      const cut = info.amount * N(game).fortress.absorb;
      info.amount -= cut;
      sn.fort.soaked += cut;
    },
    onBlock(game, p, e) {
      const sn = p.data.kit.snt;
      if (!sn || e.target !== p) return;
      const n = N(game).bastion;
      sn.blocked += e.amount || 0;
      if (sn.fort) sn.fort.soaked += e.amount || 0;
      gain(game, p, e.perfect ? n.perfect : n.block);
    },
    onHurt(game, p, e) {
      if (e.dot || !(e.amount > 0)) return;
      gain(game, p, N(game).bastion.hurt);
    },
  },
};
