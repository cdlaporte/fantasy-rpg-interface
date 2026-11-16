// Kit registry + dispatcher (CONTRACTS 8). kits.active(ent) returns the layered kit (parent class, then spec).
// The player system calls kits.dispatch(p, input) every step; this module turns input into basic / ability calls
// (auto-repeat or raw charge/hold modes, cast/hold/release, unlock levels, cooldowns, costs), wires combat events
// to kit hooks, runs kit.update, and fills the kit HUD fields.
import { ABILITY_SLOTS, DT } from '../../contracts.js';
import { angleFromDir, dirFromAngle, wrapAngle } from '../math.js';
import novice from './novice.js';
import warrior from './warrior.js';
import mage from './mage.js';
import rogue from './rogue.js';
import knight from './knight.js';
import berserker from './berserker.js';
import battlemage from './battlemage.js';
import conjurer from './conjurer.js';
import sorcerer from './sorcerer.js';
import monk from './monk.js';
import archer from './archer.js';
import thief from './thief.js';
import ninja from './ninja.js';

export const KITS = { novice, warrior, mage, rogue, knight, berserker, battlemage, conjurer, sorcerer, monk, archer, thief, ninja };

const ZERO_RES = Object.freeze({ value: 0, max: 0 });
const HOOK_NAMES = ['onHit', 'onHurt', 'onKill', 'onBlock', 'onOutgoing', 'onIncoming', 'onLethal', 'onMinionHit', 'onMinionKill', 'onMinionOutgoing', 'onCatch'];

export default {
  id: 'kits',
  init(game) {
    const cache = new Map();
    const withKits = [];
    const resObj = { id: '', name: '', value: 0, max: 0, color: '#ffffff' };
    const kitHudObj = { pips: 0, pipsMax: 0, stance: null, label: null };
    const ctx = {
      dir: -1, angle: 0, pressed: false, held: false, released: false, heldT: 0, rank: 1, level: 1, slot: null,
      dt: DT, moving: false, moveAngle: 0, moveX: 0, moveY: 0, companion: false, input: null, kit: null,
    };

    function layerOf(classId, specId) {
      const key = (classId || '') + '|' + (specId || '');
      let L = cache.get(key);
      if (L) return L;
      let base = classId ? KITS[classId] || null : null;
      const spec = specId ? KITS[specId] || null : null;
      if (!base && spec && spec.parent) base = KITS[spec.parent] || null;
      const layers = [];
      if (base) layers.push(base);
      if (spec && spec !== base) layers.push(spec);
      if (!layers.length) layers.push(novice);
      const top = layers[layers.length - 1];
      let basicKit = null;
      for (let i = layers.length - 1; i >= 0; i--) if (layers[i].basic) { basicKit = layers[i]; break; }
      // integration: a class kit without a basic yet (stub kits until the class packages land) keeps the
      // novice stick instead of leaving the player unable to attack.
      if (!basicKit) basicKit = novice;
      const abilities = {};
      for (const s of ABILITY_SLOTS) {
        abilities[s] = null;
        for (let i = layers.length - 1; i >= 0; i--) { const a = layers[i].abilities && layers[i].abilities[s]; if (a) { abilities[s] = a; break; } }
      }
      let resource = null;
      for (let i = layers.length - 1; i >= 0; i--) if (layers[i].resource) { resource = layers[i].resource; break; }
      const hooks = {};
      for (const h of HOOK_NAMES) {
        const fns = [];
        for (const k of layers) if (k.hooks && typeof k.hooks[h] === 'function') fns.push(k.hooks[h]);
        hooks[h] = fns;
      }
      L = {
        id: top.id, classId: classId || null, specId: specId || null, parent: layers.length > 1 ? layers[0].id : null,
        layers, resource, basicKit, abilities, hooks,
        basicMode: (basicKit && basicKit.basicMode) || 'auto',
        basic: basicKit ? basicKit.basic : null,
        interval: basicKit ? basicKit.interval : 0.45,
        basicInfo: (basicKit && basicKit.basicInfo) || null,
      };
      cache.set(key, L);
      return L;
    }
    const noviceL = layerOf(null, null);

    function level(ent) {
      const pr = game.sys.progression;
      if (ent === game.player && pr && typeof pr.level === 'number') return pr.level;
      return ent.level || 1;
    }
    function rank(ent) {
      const pr = game.sys.progression;
      if (ent === game.player && pr && typeof pr.rank === 'function') return pr.rank() || 1;
      return ent.data.rank || 1;
    }
    function intervalOf(L, p, r) {
      const iv = L.interval;
      const v = typeof iv === 'function' ? iv(game, p, r) : iv;
      return v > 0 ? v : 0.45;
    }
    function call(L, name, ent, a, b) {
      const ls = L.layers;
      for (let i = 0; i < ls.length; i++) { const f = ls[i][name]; if (typeof f === 'function') f.call(ls[i], game, ent, a, b); }
    }
    function abilityDesc(ab, L) {
      if (typeof ab.desc === 'string') return ab.desc;
      const cd = game.data.classes && L.classId && game.data.classes[L.classId];
      const d = cd && cd.abilities && cd.abilities[ab.id];
      return (d && d.desc) || '';
    }

    function releaseAll(p) {
      const st = p.data.kitT;
      if (!st) return;
      const L = api.active(p);
      for (const s of ABILITY_SLOTS) {
        const h = st.holding[s];
        if (!h) continue;
        st.holding[s] = null;
        const ab = L.abilities[s];
        fillCtx(p, null, L, 0);
        ctx.slot = s; ctx.released = true; ctx.heldT = h.t;
        if (ab && ab.release) ab.release(game, p, ctx);
        if (ab && ab.cdOnRelease && ab.cd) game.abilities.start(p, s, ab.cd);
      }
      if (st.basicHeld && L.basicMode !== 'auto' && L.basic) {
        st.basicHeld = false;
        fillCtx(p, null, L, 0);
        ctx.released = true; ctx.heldT = st.heldT; ctx.dir = p.dir; ctx.angle = p.angle; ctx.cancelled = true;
        L.basic(game, p, ctx);
      }
      st.basicHeld = false;
    }
    function fillCtx(p, inp, L, dt) {
      ctx.rank = rank(p); ctx.level = level(p); ctx.dt = dt; ctx.input = inp; ctx.kit = L; ctx.companion = p.type === 'companion';
      ctx.pressed = false; ctx.held = false; ctx.released = false; ctx.cancelled = false; ctx.slot = null;
      const mx = inp ? inp.moveX : 0, my = inp ? inp.moveY : 0;
      ctx.moveX = mx; ctx.moveY = my; ctx.moving = mx !== 0 || my !== 0;
      ctx.moveAngle = ctx.moving ? Math.atan2(my, mx) : p.angle;
      ctx.dir = p.dir; ctx.angle = p.angle;
    }
    let lockedTextT = -9;

    // ---- round 2: 8-way aim + light aim assist ----
    const DIAG_GRACE = 0.1;                       // s: a diagonal survives a staggered release of its two keys
    const ASSIST_CONE = 36;                       // deg (+-18) around the aim
    const assistOpts = { range: 7, mode: 'nearest', cone: ASSIST_CONE, angle: 0, los: true, out: { x: 0, y: 0 } };
    const isDiag = (a) => { const m = Math.abs(a % (Math.PI / 2)); return m > 0.3 && m < Math.PI / 2 - 0.3; };
    /** Aim angle while an attack key is held: InputState.attackAngle (8 ways) when the input provides it, else the DIR. */
    function aimAngle(st, inp, dir, pressed) {
      const raw = inp.attackAngle;
      if (typeof raw !== 'number' || raw !== raw) return angleFromDir(dir);
      st.has8 = true;
      let a = raw;
      if (isDiag(a)) { st.diagA = a; st.diagT = game.t; }
      else if (!pressed && game.t - st.diagT <= DIAG_GRACE && Math.abs(wrapAngle(a - st.diagA)) < Math.PI / 4 + 0.01) a = st.diagA;
      st.aim = a;
      return a;
    }
    /** Ranged basics (kit `aimRange` > 0): snap ctx.angle onto the nearest enemy within +-18 deg and range. */
    function aimRangeOf(L, p, r) {
      const k = L.basicKit, v = k && k.aimRange;
      return typeof v === 'function' ? v(game, p, r) || 0 : v || 0;
    }
    function assist(p, range) {
      assistOpts.range = range; assistOpts.angle = ctx.angle; assistOpts.exclude = null;
      const t = game.abilities.pickTarget && game.abilities.pickTarget(p, assistOpts);
      if (!t) return;
      const o = assistOpts.out;
      ctx.angle = Math.atan2(o.y - p.y, o.x - p.x);
    }

    const api = {
      registry: KITS,
      /** Preallocated kitHud object kits may fill and assign in their hud hook: hud.kitHud = game.kits.kitHud. */
      kitHud: kitHudObj,
      /** Register (or replace) a kit by id (tests, mods). Clears the layer cache. */
      register(kit) { KITS[kit.id] = kit; cache.clear(); return kit; },
      active(ent) { return (ent && ent.data && ent.data.kitL) || noviceL; },
      layer: layerOf,
      ability(ent, slot) { return api.active(ent).abilities[slot] || null; },
      unlocked(ent, slot) { const ab = api.ability(ent, slot); return !!ab && level(ent) >= (ab.unlock || 0); },
      level, rank,
      /** Equip the layered kit for (classId, specId) on ent; resets p.data.kit (kit state). */
      set(ent, classId, specId) {
        if (!ent) return;
        const old = ent.data.kitL;
        const L = layerOf(classId, specId);
        if (old) {
          if (ent.data.kitT) releaseAll(ent);
          for (let i = old.layers.length - 1; i >= 0; i--) { const f = old.layers[i].onUnequip; if (f) f.call(old.layers[i], game, ent); }
        }
        if (ent.data.guard && game.abilities.unguard) game.abilities.unguard(ent);
        const prevUnlocked = {};
        if (old) for (const s of ABILITY_SLOTS) prevUnlocked[s] = old.abilities[s] && level(ent) >= (old.abilities[s].unlock || 0) ? old.abilities[s].id : null;
        ent.data.kitL = L; ent.data.kitRef = L;
        ent.data.classId = classId || null; ent.data.specId = specId || null;
        ent.data.kit = { speedMul: 1, lookPatch: null };
        ent.data.kitT = { basicT: 0, heldT: 0, basicHeld: false, holding: { space: null, q: null, f: null, shift: null }, has8: false, aim: 0, diagA: 0, diagT: -9 };
        const rd = L.resource;
        const prev = ent.data.resource;
        if (rd) {
          const keep = prev && prev.id === rd.id;
          ent.data.resource = { id: rd.id, name: rd.name || rd.id, max: rd.max || 100, color: rd.color || '#ffffff', pips: !!rd.pips,
            value: keep ? Math.min(prev.value, rd.max || 100) : rd.start || 0 };
        } else ent.data.resource = null;
        if (withKits.indexOf(ent) < 0) withKits.push(ent);
        for (let i = 0; i < L.layers.length; i++) { const f = L.layers[i].onEquip; if (f) f.call(L.layers[i], game, ent); }
        if (ent === game.player) {
          if (game.sys.player && game.sys.player.refreshLook) game.sys.player.refreshLook();
          // integration: Meta's progression is the single 'ability:unlocked' emitter (richer payload); the Sim
          // only emits when no progression system provides abilityList (Sim-only tests / tools).
          if (game.ready && !metaUnlocks()) {
            for (const s of ABILITY_SLOTS) {
              const ab = L.abilities[s];
              if (ab && level(ent) >= (ab.unlock || 0) && prevUnlocked[s] !== ab.id) game.bus.emit('ability:unlocked', { slot: s, id: ab.id });
            }
          }
        }
      },
      resource(ent) { return (ent && ent.data.resource) || ZERO_RES; },
      gain(ent, n) {
        const r = ent && ent.data.resource;
        if (!r) return 0;
        r.value = Math.max(0, Math.min(r.max, r.value + n));
        return r.value;
      },
      spend(ent, n) {
        if (!n) return true;
        const r = ent && ent.data.resource;
        if (!r || r.value < n) return false;
        r.value -= n;
        return true;
      },
      /** added: set the resource value (clamped). */
      setResource(ent, v) { const r = ent && ent.data.resource; if (r) r.value = Math.max(0, Math.min(r.max, v)); },
      /** Synchronous hook call used by combat (onOutgoing / onIncoming): every layer's hook in order. */
      callHook(ent, name, e) {
        const L = ent.data.kitL;
        if (!L) return;
        const fns = L.hooks[name];
        if (!fns) return;
        for (let i = 0; i < fns.length; i++) fns[i](game, ent, e);
      },
      /** Is slot `slot` currently held (hold ability running)? */
      holding(ent, slot) { return !!(ent.data.kitT && ent.data.kitT.holding[slot]); },
      /** Cancel every held basic/ability (calls release). */
      releaseAll,

      /**
       * Player input -> kit. Called by the player system each step with the sampled InputState.
       * opts {canAttack: bool, locked: bool}
       */
      dispatch(p, inp, opts) {
        const L = api.active(p);
        const st = p.data.kitT || (p.data.kitT = { basicT: 0, heldT: 0, basicHeld: false, holding: { space: null, q: null, f: null, shift: null }, has8: false, aim: 0, diagA: 0, diagT: -9 });
        const dt = DT;
        if (opts.locked) { releaseAll(p); st.basicT = Math.max(0, st.basicT - dt); return; }
        fillCtx(p, inp, L, dt);
        const atkMul = 1 + (game.combat.mod ? game.combat.mod(p, 'attackSpeed') : 0);
        st.basicT -= dt * atkMul;
        // ---- basic ----
        if (L.basic && opts.canAttack) {
          const dir = inp.attackDir;
          const pressed = inp.attackPressed >= 0;
          if (pressed) st.heldT = 0; else if (dir >= 0) st.heldT += dt;
          const relDir = inp.attackReleased;
          const released = relDir >= 0 && dir < 0;
          if (dir >= 0) {
            const a = aimAngle(st, inp, dir, pressed);
            ctx.dir = dir; ctx.angle = a;
            p.dir = dir; p.angle = a; p.data.faceT = Math.max(p.data.faceT || 0, 0.12);
          } else if (released) {
            ctx.dir = relDir;
            // round 2: 8-way aim. A charge kit fires where the keys pointed while held; the two keys of a diagonal are
            // rarely released on the same step, so a diagonal held within the grace window wins over the last key.
            if (st.has8) {
              ctx.angle = game.t - st.diagT <= DIAG_GRACE ? st.diagA : st.aim;
              ctx.dir = dirFromAngle(ctx.angle);
            } else ctx.angle = angleFromDir(relDir);
          }
          ctx.pressed = pressed; ctx.held = dir >= 0; ctx.released = released; ctx.heldT = st.heldT;
          const ar = aimRangeOf(L, p, ctx.rank);
          if (L.basicMode === 'auto') {
            if (dir >= 0 && st.basicT <= 0) {
              if (ar > 0) assist(p, ar);
              const r = L.basic.call(L.basicKit, game, p, ctx);
              if (r !== false) st.basicT = (typeof r === 'number' ? r : intervalOf(L, p, ctx.rank));
            }
          } else if (dir >= 0 || released) {
            st.basicHeld = dir >= 0;
            if (ar > 0) assist(p, ar);
            L.basic.call(L.basicKit, game, p, ctx);
          }
          if (st.basicT < 0) st.basicT = 0;
        } else if (st.basicHeld) releaseAll(p);
        // ---- abilities ----
        if (!opts.canAttack) return;
        for (let i = 0; i < ABILITY_SLOTS.length; i++) {
          const s = ABILITY_SLOTS[i];
          const ab = L.abilities[s];
          const h = st.holding[s];
          ctx.pressed = false; ctx.held = false; ctx.released = false; ctx.slot = s;
          ctx.dir = p.dir; ctx.angle = p.angle;
          if (!ab) continue;
          if (!h && inp.pressed[s]) {
            if (level(p) < (ab.unlock || 0)) {
              game.bus.emit('ability:locked', { slot: s, id: ab.id, unlock: ab.unlock });
              continue;
            }
            if (!game.abilities.ready(p, s)) continue;
            const need = ab.need != null ? ab.need : ab.cost || 0;
            if (need > 0 && api.resource(p).value < need) {
              if (game.t - lockedTextT > 0.8) {
                lockedTextT = game.t;
                const r = p.data.resource;
                game.fx({ type: 'text', x: p.x, y: p.y, z: 1.4, text: 'Not enough ' + (r ? r.name : ''), style: 'info', ent: p.id });
                game.bus.emit('sfx', { id: 'ui_bad' });
              }
              continue;
            }
            ctx.pressed = true; ctx.held = true; ctx.heldT = 0;
            const r = ab.cast ? ab.cast(game, p, ctx) : undefined;
            if (r === false) continue;
            if (ab.cost) api.spend(p, ab.cost);
            if (ab.cd && !ab.cdOnRelease) game.abilities.start(p, s, ab.cd);
            game.bus.emit('ability:cast', { ent: p, slot: s, id: ab.id });
            if (ab.hold || ab.release) st.holding[s] = { t: 0 };
            continue;
          }
          if (h) {
            let end = !inp.held[s];
            if (!end) {
              h.t += dt;
              ctx.held = true; ctx.heldT = h.t;
              if (ab.hold && ab.hold(game, p, ctx, dt) === false) end = true;
            }
            if (end) {
              st.holding[s] = null;
              ctx.held = false; ctx.released = true; ctx.heldT = h.t;
              if (ab.release) ab.release(game, p, ctx);
              if (ab.cdOnRelease && ab.cd) game.abilities.start(p, s, ab.cd);
            }
          }
        }
      },
    };

    // ---- combat events -> hooks ----
    const runHook = (ent, name, e) => {
      const L = ent && ent.data.kitL;
      if (!L || ent.removed) return;
      const fns = L.hooks[name];
      for (let i = 0; i < fns.length; i++) fns[i](game, ent, e);
    };
    game.bus.on('hit', (e) => {
      const s = e.source;
      if (s) {
        if (s.data.kitL) runHook(s, 'onHit', e);
        else if (s.type === 'summon' && s.owner != null) runHook(game.ents.get(s.owner), 'onMinionHit', e);
      }
      if (e.target && e.target.data.kitL) runHook(e.target, 'onHurt', e);
    });
    game.bus.on('death', (e) => {
      const k = e.killer;
      if (!k) return;
      if (k.data.kitL) runHook(k, 'onKill', e);
      else if (k.type === 'summon' && k.owner != null) runHook(game.ents.get(k.owner), 'onMinionKill', e);
    });
    game.bus.on('block', (e) => { if (e.target && e.target.data.kitL) runHook(e.target, 'onBlock', e); });
    game.bus.on('proj:caught', (e) => { if (e.owner && e.owner.data.kitL) runHook(e.owner, 'onCatch', e); });

    // ---- progression events ----
    const prog = () => game.sys.progression || {};
    game.bus.on('class:set', ({ classId }) => {
      const p = game.player;
      if (!p) return;
      const sid = prog().specId && KITS[prog().specId] && KITS[prog().specId].parent === classId ? prog().specId : null;
      api.set(p, classId, sid);
    });
    game.bus.on('spec:set', ({ specId }) => {
      const p = game.player;
      if (!p) return;
      const cid = p.data.classId || prog().classId || (KITS[specId] && KITS[specId].parent) || null;
      api.set(p, cid, specId);
    });
    let fbKey = null, fbList = null;
    function fallbackAbility(L, slot) {
      const pr = game.sys.progression;
      if (!L.classId || !pr || !pr.abilityList) return null;
      const key = L.classId + '/' + (L.specId || '');
      if (key !== fbKey) { fbKey = key; fbList = pr.abilityList(L.classId, L.specId || null, false) || []; }
      for (let i = 0; i < fbList.length; i++) if (fbList[i].slot === slot) return fbList[i];
      return null;
    }
    const metaUnlocks = () => !!(game.sys.progression && game.sys.progression.abilityList);
    let lastLevel = null;
    game.bus.on('levelup', ({ level: lv }) => {
      const p = game.player;
      if (!p) return;
      const before = lastLevel != null ? lastLevel : lv - 1;
      lastLevel = lv;
      if (metaUnlocks()) return;
      const L = api.active(p);
      for (const s of ABILITY_SLOTS) {
        const ab = L.abilities[s];
        if (ab && (ab.unlock || 0) > before && (ab.unlock || 0) <= lv) game.bus.emit('ability:unlocked', { slot: s, id: ab.id });
      }
    });

    let seenClass = null, seenSpec = null;
    if (game.player) api.set(game.player, null, null);

    api._update = (dt) => {
      // Follow progression even if it never emitted 'class:set' / 'spec:set' (e.g. after loading a save).
      // Only reacts to CHANGES of progression.classId/specId, so a direct kits.set() (tests, debug) sticks.
      const p = game.player, pr = game.sys.progression;
      if (p && pr && pr.classId !== undefined) {
        const cid = pr.classId || null, sid = pr.specId || null;
        if (cid !== seenClass || sid !== seenSpec) {
          seenClass = cid; seenSpec = sid;
          if (cid !== (p.data.classId || null) || sid !== (p.data.specId || null)) api.set(p, cid, sid);
        }
      }
      for (let i = withKits.length - 1; i >= 0; i--) {
        const e = withKits[i];
        if (e.removed) { withKits.splice(i, 1); continue; }
        if (e.asleep || !e.data.kitL) continue;
        call(e.data.kitL, 'update', e, dt);
      }
    };

    api._hud = (hud) => {
      const p = game.player;
      if (!p) return;
      const L = api.active(p);
      const r = rank(p), lv = level(p);
      const bi = typeof L.basicInfo === 'function' ? L.basicInfo(game, p, r) : L.basicInfo;
      hud.basic.name = (bi && bi.name) || (L.id === 'novice' ? (game.flags.has_stick ? 'Stick' : '') : 'Attack');
      hud.basic.icon = (bi && bi.icon) || 'sword';
      hud.basic.rank = r;
      for (let i = 0; i < hud.abilities.length; i++) {
        const a = hud.abilities[i];
        const ab = L.abilities[a.slot];
        const fb = !ab ? fallbackAbility(L, a.slot) : null;
        if (!ab && fb) {
          // integration: the class kit does not implement this slot yet (stub kits): show the designed ability
          // from Meta's data/defaults so the panel reads "Lv 3 Blink", but it is never ready.
          const un = lv >= fb.unlock;
          a.id = fb.id; a.name = fb.name; a.icon = un ? fb.icon : 'lock'; a.desc = fb.desc; a.unlocked = un; a.unlockLevel = fb.unlock;
          a.cdFrac = 0; a.ready = false; a.active = false; a.cost = 0;
          continue;
        }
        if (!ab) {
          a.id = null; a.name = ''; a.icon = 'lock'; a.desc = ''; a.unlocked = false; a.unlockLevel = 0;
          a.cdFrac = 0; a.ready = false; a.active = false; a.cost = 0;
          continue;
        }
        const un = lv >= (ab.unlock || 0);
        a.id = ab.id; a.name = ab.name || ab.id; a.icon = un ? ab.icon || 'star' : 'lock'; a.desc = abilityDesc(ab, L);
        a.unlocked = un; a.unlockLevel = ab.unlock || 0;
        a.cdFrac = game.abilities.cdFrac(p, a.slot);
        const need = ab.need != null ? ab.need : ab.cost || 0;
        a.ready = un && a.cdFrac === 0 && api.resource(p).value >= need;
        a.active = api.holding(p, a.slot) || (typeof ab.isActive === 'function' ? !!ab.isActive(game, p) : false);
        a.cost = ab.cost || 0;
      }
      const res = p.data.resource;
      if (res) {
        resObj.id = res.id; resObj.name = res.name; resObj.value = res.value; resObj.max = res.max; resObj.color = res.color;
        hud.player.resource = resObj;
      } else hud.player.resource = null;
      hud.kitHud = null;
      kitHudObj.pips = 0; kitHudObj.pipsMax = 0; kitHudObj.stance = null; kitHudObj.label = null;
      if (res && res.pips) { kitHudObj.pips = res.value; kitHudObj.pipsMax = res.max; hud.kitHud = kitHudObj; }
      for (let i = 0; i < L.layers.length; i++) { const f = L.layers[i].hud; if (f) f.call(L.layers[i], game, p, hud); }
    };
    return api;
  },
  update(game, dt) { game.kits._update(dt); },
  hud(game, hud) { game.kits._hud(hud); },
};
