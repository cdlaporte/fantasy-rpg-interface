// Player system (CONTRACTS 4, COMMON rule 12): the player entity, movement from input, kit dispatch (basic +
// abilities), item keys, interaction target + HudState.prompt, and player look composition (refreshLook).
// Op owned here: setLook. API at game.sys.player (game.player is the entity).
import { ANIM } from '../contracts.js';
import { clone, deepMerge } from './ents.js';

const CLASS_AURA = { warrior: 'flame', mage: 'sparkle', rogue: 'shadow' };
const STICK = { style: 'stick', color: '#8a5a33', glow: null };
const LOOK_FLAGS = { look_choice: 1, look_chosen: 1, has_stick: 1 };

export default {
  id: 'player',
  init(game) {
    const data = game.data;
    const p = game.ents.create({
      kind: 'player', type: 'player', team: 'player', name: game.name, look: { rig: 'humanoid' },
      radius: 0.3, solid: true, pushable: true, hp: 25, hpMax: 25, level: 1,
      stats: { power: 2, defense: 0, speed: 3.2 },
      data: { name: game.name, classId: null, specId: null, target: null, kit: { speedMul: 1, lookPatch: null }, scriptLook: null },
    });
    game.player = p;
    const prompt = { text: '', key: 'E', entId: 0 };
    const near = [];
    const interactFilter = (e) => !!e.interact && e !== p && !e.removed;

    function levelOf() {
      const pr = game.sys.progression;
      return pr && typeof pr.level === 'number' ? pr.level : p.level || 1;
    }

    const api = {
      entity: p,
      /** Rebuild player.look (COMMON rule 12), bump lookRev, emit 'look:changed'. */
      refreshLook() {
        const L = data.looks || {};
        const bases = L.PLAYER_LOOKS || [{ rig: 'humanoid' }];
        const f = game.flags;
        const look = clone(bases[f.look_choice | 0] || bases[0]);
        const classId = p.data.classId || (game.sys.progression && game.sys.progression.classId) || null;
        const specId = p.data.specId || (game.sys.progression && game.sys.progression.specId) || null;
        if (!f.look_chosen) {
          if (L.CLOAKED) deepMerge(look, L.CLOAKED);
        } else {
          const cd = classId && data.classes ? data.classes[classId] : null;
          const sd = specId && data.specs ? data.specs[specId] : null;
          if (cd && cd.look) deepMerge(look, cd.look);
          if (sd && sd.look) deepMerge(look, sd.look);
          const kp = p.data.kit && p.data.kit.lookPatch;
          if (kp) deepMerge(look, kp);
          const inv = game.sys.inventory;
          const cos = inv && typeof inv.equippedLookPatch === 'function' ? inv.equippedLookPatch() : null;
          if (cos) deepMerge(look, cos);
          if (classId && levelOf() >= 10) {
            const aura = (sd && sd.aura) || (cd && cd.aura) || {
              style: CLASS_AURA[classId] || (cd && cd.parent && CLASS_AURA[cd.parent]) || 'glow',
              color: (sd && sd.color) || (cd && cd.color) || '#ffd24a',
            };
            look.aura = clone(aura);
          }
        }
        if (f.has_stick && !classId) look.held = clone(STICK);
        if (p.data.scriptLook) deepMerge(look, p.data.scriptLook);
        p.look = look;
        p.lookRev++;
        game.bus.emit('look:changed', { ent: p });
        return look;
      },
      /** Is the player allowed to attack right now (stick picked up or a class, not locked)? */
      canAttack() {
        return !(game.inputLock > 0) && !p.data.scripted && !p.data.down && !(p.status.stun > 0) && (!!game.flags.has_stick || !!p.data.classId);
      },
      /** Run the current target's interact (E). Returns true when something happened. */
      interact() {
        const t = p.data.target;
        if (!t || t.removed || !t.interact || game.inputLock > 0 || p.data.scripted || p.data.down) return false;
        const it = t.interact;
        if (!t.data.anchor) { const a = Math.atan2(t.y - p.y, t.x - p.x); p.angle = a; p.dir = Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 1 : 3) : (Math.sin(a) > 0 ? 2 : 0); }
        const ops = game.sys.ops;
        if (it.if && ops && ops.test && !ops.test(it.if, { self: t, npc: t })) {
          if (it.else && ops.run) ops.run(it.else, { self: t, npc: t });
          else game.toast(it.locked || 'Not yet.', 'info');
          return true;
        }
        game.bus.emit('interact', { ent: t });
        if (ops && ops.run && it.do) ops.run(it.do, { self: t, npc: t });
        return true;
      },
      /** Recompute player.data.target: the nearest entity with `interact` within its range (anchors included). */
      pickTarget() {
        let best = null, bd = Infinity;
        const list = game.ents.inRadius(p.x, p.y, 3.5, interactFilter, near);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          const r = e.interact.range != null ? e.interact.range : 1.3;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d <= r && d < bd) { bd = d; best = e; }
        }
        const z = game.zone;
        if (z && z.anchors) for (const e of z.anchors) {
          if (e.removed || !e.interact) continue;
          const r = e.interact.range != null ? e.interact.range : 1.3;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d <= r && d < bd) { bd = d; best = e; }
        }
        p.data.target = best;
        return best;
      },
    };
    game.commands.interact = () => api.interact();

    game.bus.on('flag', ({ key }) => { if (LOOK_FLAGS[key]) api.refreshLook(); });
    for (const ev of ['class:set', 'spec:set', 'levelup', 'cosmetic:equipped']) game.bus.on(ev, () => api.refreshLook());

    const ops = game.sys.ops;
    if (ops && ops.register) {
      ops.register('setLook', (g, a) => {
        const who = a[1], patch = a[2];
        if (who === 'player' || who == null) {
          if (patch === '$chosen') { if (!game.flags.look_chosen) game.setFlag('look_chosen', true); else api.refreshLook(); }
          else { p.data.scriptLook = patch ? deepMerge(p.data.scriptLook || {}, patch) : null; api.refreshLook(); }
          return;
        }
        for (const e of game.ents.findAll(who, [])) {
          if (!patch || typeof patch !== 'object') continue;
          e.look = deepMerge(clone(e.look || {}), patch);
          e.lookRev++;
          game.bus.emit('look:changed', { ent: e });
        }
      });
    }
    api.refreshLook();
    api._prompt = prompt;
    return api;
  },

  update(game, dt) {
    const p = game.player;
    if (!p || p.removed) return;
    const sys = game.sys.player;
    const inp = game.input;
    if (p.data.down) {
      if (p.hp > 0) { p.data.down = false; p.anim = ANIM.IDLE; p.animT = 0; p.data.animUntil = undefined; }
      else { p.vx = 0; p.vy = 0; game.kits.dispatch(p, inp, { canAttack: false, locked: true }); p.data.target = null; return; }
    }
    const locked = game.inputLock > 0 || !!p.data.scripted;
    if (!locked && !p.data.dashing && !p.data.leap) {
      const kitMul = p.data.kit && p.data.kit.speedMul != null ? p.data.kit.speedMul : 1;
      const sp = (p.stats.speed || 3.2) * kitMul;
      p.vx = inp.moveX * sp; p.vy = inp.moveY * sp;
    } else if (!p.data.moveTo && !p.data.dashing) { p.vx = 0; p.vy = 0; }
    const stunned = p.status.stun > 0;
    const canAttack = !locked && !stunned && (!!game.flags.has_stick || !!p.data.classId);
    game.kits.dispatch(p, inp, { canAttack, locked: locked || stunned });
    if (!locked) {
      const inv = game.sys.inventory;
      for (let i = 0; i < 6; i++) if (inp.pressed[ITEM_KEYS[i]] && inv && inv.useSlot) inv.useSlot(i);
    }
    if ((game.tick + p.id) % 4 === 0 || inp.pressed.interact) sys.pickTarget();
    if (!locked && inp.pressed.interact) sys.interact();
    void dt;
  },

  onZoneLoad(game) {
    const p = game.player;
    if (!p) return;
    p.data.target = null;
    if (p.data.leash && !p.data.leash.keep) p.data.leash = null;
    game.sys.player.refreshLook();
  },

  hud(game, hud) {
    const p = game.player;
    if (!p) return;
    const hp = hud.player;
    hp.name = p.name; hp.hp = p.hp; hp.hpMax = p.hpMax; hp.look = p.look; hp.cloaked = !game.flags.look_chosen;
    const t = p.data.target;
    if (t && !t.removed && t.interact && !(game.inputLock > 0) && !p.data.scripted && !game.modal) {
      const pr = game.sys.player._prompt;
      pr.text = t.interact.prompt || 'Talk'; pr.key = 'E'; pr.entId = t.id;
      hud.prompt = pr;
    } else hud.prompt = null;
  },
};

const ITEM_KEYS = ['item1', 'item2', 'item3', 'item4', 'item5', 'item6'];
