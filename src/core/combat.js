// Combat (CONTRACTS 4, 8, 12a): hostility, the damage pipeline, statuses with fxTags, timed stat modifiers,
// melee arcs, projectiles (pierce, bounce, homing, return, split, lob, reflect), delayed telegraphed AoE,
// lingering zones, summons and decoys, stealth, drops and pickups, death / poof / 'player:down', down states.
// Ops owned here: heal, kill.
import { ANIM, FX_TAGS } from '../contracts.js';
import { DEG, angleTo, angleDiff, wrapAngle } from './math.js';
import { clone } from './ents.js';

/** Built-in status ids. Any other id is allowed too (ticks down; shows as an fxTag when it is one). */
export const STATUS_IDS = Object.freeze(['stun', 'slow', 'burn', 'frost', 'root', 'invuln', 'stealth', 'mark', 'haste', 'shield', 'venom']);
const FX_TAG_SET = new Set(FX_TAGS);
const DAMAGEABLE = { player: 1, enemy: 1, npc: 1, companion: 1, summon: 1 };
const DOT_TICK = 0.5;
const VENOM_MAX = 10;
const FROST_FREEZE_STACKS = 3;
const MAGNET_R = 2.5;
const DEFAULT_COLORS = { fire: '#ff7a2f', frost: '#7fd6ff', storm: '#ffe14d', arcane: '#b48cff', poison: '#7cf07c', holy: '#f2c94c' };
const PICKUP_LOOK = { gold: '#ffd24a', heart: '#ff6b8a', item: '#ffffff', xp_orb: '#7fe0ff' };

export default {
  id: 'combat',
  init(game) {
    const ents = game.ents;
    const rng = game.rng;
    const scratchA = [], scratchB = [], scratchC = [], meleeOut = [], aoeOut = [], chainOut = [];
    const lookCache = new Map();
    const pendingAoe = [];       // delayed AoEs without a telegraph (no entity)
    const infoPool = [];
    let infoDepth = 0;
    let fSrc = null, fTeam = null, fOwnerIsPlayer = false;
    let homeHits = null;
    const homeFilter = (c) => filterHit(c) && homeHits.indexOf(c.id) < 0;

    // ---------- helpers ----------
    const powerOf = (e) => (e && e.stats && e.stats.power) || 1;
    function resolveSource(s) {
      if (s == null) return null;
      if (typeof s === 'number') return ents.get(s) || null;
      if (s.type === 'projectile' || (s.type === 'effect' && s.owner != null)) return ents.get(s.owner) || s;
      return s;
    }
    function ownerOf(e) {
      let o = e;
      for (let i = 0; i < 3 && o && o.owner != null && (o.type === 'summon' || o.type === 'projectile' || o.type === 'effect'); i++) o = ents.get(o.owner) || o;
      return o;
    }
    function teamOf(e) { return e ? e.team : 'neutral'; }

    function hostileTeams(ta, tb) {
      if (ta === tb || ta === 'neutral' || tb === 'neutral') return false;
      if (ta === 'town' || tb === 'town') { const o = ta === 'town' ? tb : ta; return o === 'player' && !!game.flags.wanted; }
      return true;
    }
    function targetable(t) {
      return !!t && !t.removed && t.alive && DAMAGEABLE[t.type] === 1 && !t.data.down && !t.data.untargetable && !t.asleep;
    }
    /** Can attacks from `src` (team `team`) damage `t`? Town NPCs can be hit by the player directly (crime). */
    function canHitTeam(team, t, ownerIsPlayer, src) {
      if (!targetable(t) || t === src) return false;
      if (hostileTeams(team, t.team)) return true;
      return ownerIsPlayer && t.team === 'town' && t.type === 'npc';
    }
    const filterHit = (t) => canHitTeam(fTeam, t, fOwnerIsPlayer, fSrc);
    function setFilter(src, hitsTeam) {
      fSrc = src;
      fTeam = hitsTeam ? oppositeOf(hitsTeam) : teamOf(src);
      const o = src ? ownerOf(src) : null;
      fOwnerIsPlayer = !!o && o === game.player;
    }
    // hitsTeam 'enemy' means "damage the enemy team": pick a team hostile to it.
    function oppositeOf(t) { return t === 'enemy' ? 'player' : t === 'player' ? 'enemy' : t === 'town' ? 'player' : 'neutral'; }

    function sortByDist(list, x, y) {
      for (let i = 1; i < list.length; i++) {
        const e = list[i];
        const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
        let j = i - 1;
        while (j >= 0) {
          const o = list[j];
          if ((o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) <= d) break;
          list[j + 1] = o; j--;
        }
        list[j + 1] = e;
      }
    }
    function fxText(t, text, style) {
      game.fx({ type: 'text', x: t.x, y: t.y, z: (t.z || 0) + 1.1 * (t.scale || 1), text, style, ent: t.id });
    }
    function colorOf(o, src) {
      return o.color || (o.element && DEFAULT_COLORS[o.element]) || (src && src.team === 'enemy' ? '#ff7a6a' : '#ffffff');
    }

    // ---------- modifiers ----------
    function mod(e, key) {
      const ms = e && e.data.mods;
      if (!ms || !ms.length) return 0;
      let s = 0;
      const t = game.t;
      for (let i = 0; i < ms.length; i++) { const m = ms[i]; if (m.until > t && m.v[key]) s += m.v[key]; }
      return s;
    }
    function addMod(e, id, fields, dur = Infinity) {
      if (!e) return;
      const ms = e.data.mods || (e.data.mods = []);
      for (let i = 0; i < ms.length; i++) if (ms[i].id === id) { ms[i].v = fields; ms[i].until = game.t + dur; return ms[i]; }
      const m = { id, v: fields, until: game.t + dur };
      ms.push(m);
      return m;
    }
    function removeMod(e, id) {
      const ms = e && e.data.mods;
      if (!ms) return;
      for (let i = ms.length - 1; i >= 0; i--) if (ms[i].id === id) ms.splice(i, 1);
    }
    function pruneMods(e) {
      const ms = e.data.mods;
      if (!ms || !ms.length) return;
      for (let i = ms.length - 1; i >= 0; i--) if (ms[i].until <= game.t) ms.splice(i, 1);
    }

    function speedMul(e) {
      const st = e.status, sp = e.statusPower;
      if (st.stun > 0 || st.root > 0 || e.data.koT > 0) return 0;
      let m = 1;
      const immuneSlow = mod(e, 'ccImmune') > 0 || mod(e, 'slowImmune') > 0;
      if (!immuneSlow) {
        if (st.slow > 0) m *= 1 - Math.min(0.9, sp.slow || 0.4);
        if (st.frost > 0) m *= 1 - Math.min(0.8, sp.frost || 0.4);
      }
      if (st.haste > 0) m *= 1 + (sp.haste || 0.3);
      if (st.stealth > 0 && sp.stealth) m *= 1 + sp.stealth;
      m *= 1 + mod(e, 'speed');
      const g = e.data.guard;
      if (g && g.active && g.speedMul != null) m *= g.speedMul;
      return m < 0 ? 0 : m;
    }

    // ---------- statuses ----------
    function syncFx(e) { ents.syncFxTags(e); }
    function status(target, id, seconds, power, source) {
      if (!target || target.removed || !target.alive) return;
      const st = target.status, sp = target.statusPower;
      if (!(seconds > 0)) { clearStatus(target, id); return; }
      const cc = id === 'stun' || id === 'root' || id === 'slow' || id === 'frost';
      if (cc && mod(target, 'ccImmune') > 0) return;
      if ((id === 'slow' || id === 'frost') && mod(target, 'slowImmune') > 0) return;
      if (cc && (target.tags.includes('boss') || target.data.ccResist)) seconds *= target.data.ccResist != null ? 1 - target.data.ccResist : 0.5;
      const was = st[id] > 0;
      const stacks = target.data.stacks || (target.data.stacks = {});
      switch (id) {
        case 'venom':
          stacks.venom = Math.min(VENOM_MAX, (stacks.venom || 0) + 1);
          st.venom = Math.max(st.venom || 0, seconds);
          sp.venom = Math.max(sp.venom || 0, power || 1);
          if (source) (target.data.dotSrc || (target.data.dotSrc = {})).venom = resolveSource(source);
          break;
        case 'frost':
          stacks.frost = (stacks.frost || 0) + 1;
          if (stacks.frost >= FROST_FREEZE_STACKS && !target.data.noFreeze) {
            stacks.frost = 0; st.frost = 0; sp.frost = 0;
            status(target, 'stun', 1, 0);
            game.fx({ type: 'burst', x: target.x, y: target.y, n: 14, color: '#bfefff', r: 0.8 });
            game.bus.emit('status', { ent: target, id: 'freeze', t: 1, power: 0 });
            syncFx(target);
            return;
          }
          st.frost = Math.max(st.frost || 0, seconds);
          sp.frost = Math.max(sp.frost || 0, power || 0.4);
          break;
        case 'burn':
          st.burn = Math.max(st.burn || 0, seconds);
          sp.burn = Math.max(sp.burn || 0, power || 1);
          if (source) (target.data.dotSrc || (target.data.dotSrc = {})).burn = resolveSource(source);
          break;
        case 'shield':
          st.shield = Math.max(st.shield || 0, seconds);
          sp.shield = Math.max(sp.shield || 0, power || Math.round(target.hpMax * 0.3));
          break;
        default:
          st[id] = Math.max(st[id] || 0, seconds);
          if (power != null) sp[id] = Math.max(was ? sp[id] || 0 : 0, power);
      }
      if (id === 'stealth') { target.alpha = target.team === 'player' ? 0.4 : 0.15; dropAggroOn(target); }
      if (id === 'stun' && game.sys.ai && game.sys.ai.interrupt) game.sys.ai.interrupt(target);
      if (!was) syncFx(target);
      game.bus.emit('status', { ent: target, id, t: seconds, power: power || 0 });
    }
    function clearStatus(target, id) {
      const st = target.status;
      if (!(st[id] > 0) && !(target.data.stacks && target.data.stacks[id])) return;
      st[id] = 0; target.statusPower[id] = 0;
      if (target.data.stacks) target.data.stacks[id] = 0;
      if (id === 'stealth') target.alpha = 1;
      syncFx(target);
    }
    function dropAggroOn(target) {
      if (game.sys.ai && game.sys.ai.forgetTarget) game.sys.ai.forgetTarget(target);
    }
    function breakStealth(e) {
      if (!e || !(e.status.stealth > 0)) return false;
      clearStatus(e, 'stealth');
      game.fx({ type: 'poof', x: e.x, y: e.y, color: '#a0a0c0' });
      game.bus.emit('stealth:break', { ent: e });
      return true;
    }
    function applyStatuses(target, s, src) {
      if (!s || !target.alive) return;
      if (Array.isArray(s)) { for (let i = 0; i < s.length; i++) applyStatuses(target, s[i], src); return; }
      if (s.id) { if (s.chance == null || rng.chance(s.chance)) status(target, s.id, s.t != null ? s.t : s.dur || 1, s.p != null ? s.p : s.power, src); return; }
      for (const k in s) {
        const v = s[k];
        if (Array.isArray(v)) status(target, k, v[0], v[1], src); else status(target, k, v, undefined, src);
      }
    }

    // ---------- damage pipeline ----------
    function getInfo() {
      let i = infoPool[infoDepth];
      if (!i) { i = {}; infoPool[infoDepth] = i; }
      infoDepth++;
      i.target = null; i.source = null; i.amount = 0; i.type = 'melee'; i.element = null; i.crit = false; i.critMult = 2;
      i.angle = 0; i.blocked = 0; i.perfect = false; i.cancel = false; i.proj = null; i.tags = null; i.fromStealth = false;
      i.opts = null; i.reflected = false;
      return i;
    }
    function kitHook(ent, name, info) {
      const k = game.sys.kits;
      if (k && k.callHook && ent && ent.data.kitL) k.callHook(ent, name, info);
    }

    function damage(target, amount, opts = {}) {
      if (!target || target.removed || !target.alive || target.data.down || DAMAGEABLE[target.type] !== 1) return 0;
      const src = resolveSource(opts.source);
      const proj = opts.proj || (opts.source && opts.source.type === 'projectile' ? opts.source : null);
      const st = target.status, sp = target.statusPower;
      if (st.invuln > 0 || target.data.shielded || target.data.invulnerable) {
        if (!opts.silent && (target.data.immuneTextT || 0) <= game.t) { target.data.immuneTextT = game.t + 0.4; fxText(target, target.data.shielded ? 'Shielded' : 'Immune', 'miss'); }
        game.bus.emit('immune', { target, source: src, proj });
        return 0;
      }
      const info = getInfo();
      try {
        info.target = target; info.source = src; info.proj = proj; info.opts = opts;
        info.type = opts.type || 'melee'; info.element = opts.element || null; info.tags = opts.tags || null;
        info.angle = opts.angle != null ? opts.angle : (proj ? proj.angle : src ? angleTo(src.x, src.y, target.x, target.y) : 0);
        let amt = amount;
        if (src && !opts.raw) amt *= 1 + mod(src, 'power');
        if (opts.mult) amt *= opts.mult;
        info.crit = !!opts.crit || (opts.critChance > 0 && rng.chance(opts.critChance)) || (!!src && mod(src, 'critChance') > 0 && rng.chance(mod(src, 'critChance')));
        if (opts.critMult) info.critMult = opts.critMult;
        info.fromStealth = !!src && src.status.stealth > 0;
        info.amount = amt;
        if (src) {
          kitHook(src, 'onOutgoing', info);
          if (src.type === 'summon' && src.owner != null) kitHook(ents.get(src.owner), 'onMinionOutgoing', info);
        }
        if (st.mark > 0 && info.type !== 'true') info.amount *= 1 + (sp.mark || 0.3);
        kitHook(target, 'onIncoming', info);
        if (info.cancel) return 0;
        // Guard (facing arc).
        const g = target.data.guard;
        if (g && g.active && info.type !== 'true' && info.amount > 0) {
          const from = proj ? wrapAngle(proj.angle + Math.PI) : src ? angleTo(target.x, target.y, src.x, src.y) : wrapAngle(info.angle + Math.PI);
          if (Math.abs(angleDiff(target.angle, from)) <= (g.arc * DEG) / 2) {
            const perfect = g.perfect > 0 && game.t - g.t0 <= g.perfect;
            const red = perfect && g.perfectFull !== false ? 1 : g.reduce;
            const b = info.amount * red;
            info.amount -= b; info.blocked = b; info.perfect = perfect;
            g.blocked += b; g.blocks++;
            if (perfect) {
              g.perfects++;
              if (proj && g.reflect && proj.data.proj) { reflect(proj, target); info.reflected = true; }
              if (!proj && src && g.stunAttacker > 0 && targetable(src)) status(src, 'stun', g.stunAttacker);
              game.fx({ type: 'ring', x: target.x, y: target.y, r: 1.4, color: g.color || '#f2c94c', dur: 0.35 });
              game.fx({ type: 'sparkle', x: target.x, y: target.y, n: 10, color: g.color || '#f2c94c', r: 0.8 });
            } else game.fx({ type: 'hit', x: target.x + Math.cos(from) * 0.4, y: target.y + Math.sin(from) * 0.4, color: g.color || '#d8dae4' });
            const ev = { target, source: src, amount: b, perfect, proj, type: info.type, reflected: info.reflected };
            if (g.onBlock) g.onBlock(game, target, ev);
            game.bus.emit('block', ev);
          }
        }
        let a = info.amount;
        if (info.type !== 'true') {
          const def = target.stats.defense || 0;
          if (def > 0) a *= 10 / (10 + def);
          a *= Math.max(0.05, 1 + mod(target, 'dmgTaken'));
        }
        if (info.crit) a *= info.critMult;
        let dealt = a <= 0 ? 0 : info.blocked > 0 && a < 0.5 ? 0 : Math.max(1, Math.round(a));
        // Shield absorb.
        if (dealt > 0 && st.shield > 0 && sp.shield > 0) {
          const ab = Math.min(sp.shield, dealt);
          sp.shield -= ab; dealt -= ab;
          if (sp.shield <= 0) clearStatus(target, 'shield');
          if (!opts.silent && ab > 0) fxText(target, 'Absorbed', 'miss');
        }
        // Floors.
        let newHp = target.hp - dealt;
        const floor = target.data.minHp;
        if (floor > 0 && newHp < floor) newHp = Math.min(target.hp, floor);
        target.hp = newHp;
        if (dealt > 0 || info.blocked > 0) target.flash = 1;
        if (!opts.silent) {
          if (dealt > 0) fxText(target, String(dealt), info.crit ? 'crit' : 'dmg');
          else if (info.blocked > 0) fxText(target, info.perfect ? 'Perfect!' : 'Blocked', 'miss');
          if (dealt > 0) game.fx({ type: 'hit', x: target.x, y: target.y, z: 0.5, color: opts.color || (info.element && DEFAULT_COLORS[info.element]) || '#ffffff' });
          game.bus.emit('sfx', { id: target.type === 'player' ? 'hurt' : 'hit' });
        }
        if (dealt > 0 && target.type !== 'player' && (target.anim === ANIM.IDLE || target.anim === ANIM.WALK) && !(target.ai && target.ai.windT > 0)) {
          ents.setAnim(target, ANIM.HURT, 0.18);
        }
        // Knockback.
        const kb = opts.knockback;
        if (kb && target.hp > 0 && !info.reflected) {
          const ang = opts.kbAngle != null ? opts.kbAngle : proj ? proj.angle : src ? angleTo(src.x, src.y, target.x, target.y) : info.angle;
          let f = kb * (info.blocked > 0 ? 0.3 : 1);
          if (target.tags.includes('boss')) f *= 0.2;
          game.physics.push(target, ang, f);
        }
        if (opts.hitStop > 0) {
          target.data.hitStop = Math.max(target.data.hitStop || 0, opts.hitStop);
          if (src) src.data.hitStop = Math.max(src.data.hitStop || 0, opts.hitStop);
          game.bus.emit('hitstop', { t: opts.hitStop, target, source: src });
        }
        if (opts.shake) game.camera.shake = Math.max(game.camera.shake, opts.shake);
        if (dealt > 0) applyStatuses(target, opts.status, src);
        if (opts.lifesteal > 0 && src && dealt > 0) heal(src, Math.max(1, Math.round(dealt * opts.lifesteal)), { silent: true });
        if (src && info.fromStealth && !opts.keepStealth && !opts.dot) breakStealth(src);
        // integration: 'crime' is emitted once, by Story's npc system (from the 'hit' event, same rule).
        if (src) { src.data.lastTarget = target.id; src.data.lastHitT = game.t; }
        target.data.lastHitBy = src ? src.id : null; target.data.lastHurtT = game.t;
        // Down / death.
        let killed = false;
        if (target.hp <= 0) {
          target.hp = 0;
          if (target.type === 'player') downPlayer(target, src);
          else if (isDownable(target)) setDown(target);
          else { kill(target, src); killed = true; }
        }
        const ev = { target, source: src, amount: dealt, crit: info.crit, killed, type: info.type, element: info.element,
          blocked: info.blocked, perfect: info.perfect, proj, fromStealth: info.fromStealth, angle: info.angle, tags: info.tags, dot: !!opts.dot };
        game.bus.emit('hit', ev);
        return dealt;
      } finally {
        infoDepth--;
      }
    }

    function isDownable(t) { return t.type === 'companion' || t.data.downable || (t.team === 'town' && t.type === 'npc' && !t.data.canDie); }
    function setDown(t, dur) {
      if (t.data.down) return;
      t.data.down = true;
      t.data.downT = dur != null ? dur : t.type === 'companion' ? 10 : 8;
      t.hp = 0; t.vx = t.vy = 0;
      for (const k in t.status) if (t.status[k] > 0) clearStatus(t, k);
      ents.setAnim(t, ANIM.KO);
      game.fx({ type: 'poof', x: t.x, y: t.y, color: '#ffffff' });
      game.bus.emit('ent:down', { ent: t });
    }
    function downPlayer(p, src) {
      if (p.data.down) return;
      p.data.down = true;
      p.vx = p.vy = 0;
      ents.setAnim(p, ANIM.KO);
      game.bus.emit('player:down', { source: src || null });
    }

    function kill(target, source, opts = {}) {
      if (!target || target.removed || !target.alive) return;
      if (target.type === 'player') { target.hp = 0; downPlayer(target, resolveSource(source)); return; }
      if (isDownable(target) && !opts.force) { setDown(target); return; }
      const killer = resolveSource(source);
      target.hp = 0;
      target.alive = false;
      game.bus.emit('death', { ent: target, killer });
      if (target.data.onDeath) target.data.onDeath(game, target, killer);
      if (target.type === 'enemy') {
        const owner = killer ? ownerOf(killer) : null;
        if (owner && owner.team === 'player' && !opts.noReward) reward(target, owner);
        const od = target.def && target.def.onDeath;
        if (od && od.spawn && !opts.noSpawn) {
          const n = od.n || 1;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + rng.next();
            const c = ents.spawn(od.spawn, target.x + Math.cos(a) * 0.4, target.y + Math.sin(a) * 0.4, od.opts || {});
            c.kx = Math.cos(a) * 4; c.ky = Math.sin(a) * 4;
            c.data.summoned = true;
          }
        }
      }
      if (!opts.silent) {
        const col = target.look && target.look.colors ? target.look.colors.body : '#ffffff';
        game.fx({ type: 'poof', x: target.x, y: target.y, z: target.z, color: col });
        game.bus.emit('sfx', { id: 'poof' });
      }
      ents.remove(target);
    }

    function reward(target, owner) {
      const s = target.stats || {};
      const xp = Math.round((s.xp || 0) * (target.data.summoned ? 0.5 : 1));
      const prog = game.sys.progression;
      if (xp > 0) {
        if (prog && prog.addXp) prog.addXp(xp);
        game.fx({ type: 'text', x: target.x, y: target.y, z: 1.6, text: '+' + xp + ' XP', style: 'xp' });
      }
      if (target.data.summoned) return;
      const dr = target.def && target.def.drops;
      if (!dr) return;
      const gm = (owner.data.goldMul || 1) * (1 + mod(owner, 'goldFind'));
      if (dr.gold && rng.chance(dr.goldChance != null ? dr.goldChance : 1)) {
        let n = Math.round(rng.int(dr.gold[0], dr.gold[1]) * gm);
        const piles = Math.min(n, n > 6 ? 3 : n > 2 ? 2 : 1);
        for (let i = 0; i < piles && n > 0; i++) {
          const k = i === piles - 1 ? n : Math.ceil(n / (piles - i));
          dropPickup('gold', target.x, target.y, k);
          n -= k;
        }
      }
      if (dr.items) for (const it of dr.items) if (rng.chance(it.p != null ? it.p : 1)) dropPickup('item', target.x, target.y, it.n || 1, it.id);
      const hc = dr.heart != null ? dr.heart : 0.05;
      if (hc > 0 && rng.chance(hc)) dropPickup('heart', target.x, target.y, 0);
      if (dr.xpOrbs) dropPickup('xp_orb', target.x, target.y, dr.xpOrbs);
    }

    /** Spawn a pickup: kind 'gold' | 'heart' | 'item' | 'xp_orb'; n = amount (heart: 0 = 20% hpMax); id = item id. */
    function dropPickup(kind, x, y, n = 1, id = null) {
      const a = rng.next() * Math.PI * 2, f = 1.5 + rng.next() * 2;
      const itemDef = id && game.data.items ? game.data.items[id] : null;
      return ents.create({
        kind, type: 'pickup', team: 'neutral', x, y, z: 0, radius: 0.22, solid: true, pushable: false,
        look: { rig: 'effect', model: kind, color: PICKUP_LOOK[kind] || '#ffffff', icon: itemDef ? itemDef.icon : null },
        kx: Math.cos(a) * f, ky: Math.sin(a) * f, ttl: 60, name: itemDef ? itemDef.name : '',
        data: { pickup: { kind, n, id }, bornT: game.t },
      });
    }
    function collect(e, p) {
      const pk = e.data.pickup;
      const inv = game.sys.inventory, prog = game.sys.progression;
      if (pk.kind === 'gold') {
        if (inv && inv.addGold) inv.addGold(pk.n);
        game.fx({ type: 'text', x: p.x, y: p.y, z: 1.3, text: '+' + pk.n, style: 'gold', ent: p.id });
        game.bus.emit('sfx', { id: 'coin' });
      } else if (pk.kind === 'item') {
        if (inv && inv.give) inv.give(pk.id, pk.n);
        game.fx({ type: 'text', x: p.x, y: p.y, z: 1.3, text: e.name || pk.id, style: 'info', ent: p.id });
        game.bus.emit('sfx', { id: 'pickup' });
      } else if (pk.kind === 'heart') {
        heal(p, pk.n || Math.max(1, Math.round(p.hpMax * 0.2)));
        game.bus.emit('sfx', { id: 'pickup' });
      } else if (pk.kind === 'xp_orb') {
        if (prog && prog.addXp) prog.addXp(pk.n);
        game.fx({ type: 'text', x: p.x, y: p.y, z: 1.3, text: '+' + pk.n + ' XP', style: 'xp', ent: p.id });
      }
      game.bus.emit('pickup', { kind: pk.kind, n: pk.n, id: pk.id, ent: e });
      ents.remove(e);
    }

    function heal(target, n, opts = {}) {
      if (!target || target.removed || !target.alive) return 0;
      let amt = opts.pct ? target.hpMax * opts.pct : n;
      amt = Math.round(amt || 0);
      if (target.data.down && target.type !== 'player') return 0;
      const healed = Math.max(0, Math.min(target.hpMax - target.hp, amt));
      target.hp += healed;
      if (target.type === 'player' && target.data.down && target.hp > 0) {
        target.data.down = false;
        target.anim = ANIM.IDLE; target.animT = 0; target.data.animUntil = undefined;
      }
      if (!opts.silent && healed > 0) {
        fxText(target, '+' + healed, 'heal');
        game.fx({ type: 'heal', x: target.x, y: target.y });
      }
      if (healed > 0) game.bus.emit('heal', { target, amount: healed, source: opts.source || null });
      return healed;
    }

    // ---------- melee ----------
    function meleeArc(source, o = {}) {
      const out = o.out || meleeOut;
      out.length = 0;
      const angle = o.angle != null ? o.angle : source.angle;
      const arc = o.arc != null ? o.arc : 90, range = o.range != null ? o.range : 1;
      const off = o.offset || 0;
      const ox = o.x != null ? o.x : source.x + Math.cos(angle) * off, oy = o.y != null ? o.y : source.y + Math.sin(angle) * off;
      const amount = o.amount != null ? o.amount : (o.dmg != null ? o.dmg : 1) * powerOf(source);
      setFilter(source, o.hitsTeam);
      const cand = ents.inRadius(ox, oy, range + 1.5, filterHit, scratchA);
      for (let i = 0; i < cand.length; i++) {
        const t = cand[i];
        const dx = t.x - ox, dy = t.y - oy, d = Math.sqrt(dx * dx + dy * dy);
        if (d - t.radius > range) continue;
        if (d > 0.35 + t.radius && arc < 360) {
          const slack = Math.asin(Math.min(1, t.radius / Math.max(d, 0.01)));
          if (Math.abs(angleDiff(angle, Math.atan2(dy, dx))) > (arc * DEG) / 2 + slack) continue;
        }
        if (o.exclude && o.exclude.indexOf(t.id) >= 0) continue;
        out.push(t);
      }
      sortByDist(out, ox, oy);
      if (o.maxTargets && out.length > o.maxTargets) out.length = o.maxTargets;
      const dopts = dmgOpts(source, o, 'melee');
      for (let i = 0; i < out.length; i++) {
        const t = out[i];
        dopts.angle = angleTo(ox, oy, t.x, t.y);
        dopts.kbAngle = dopts.angle;
        const dealt = damage(t, amount, dopts);
        if (o.onHit) o.onHit(game, t, dealt, source);
      }
      if (o.deflect) reflectInArc(source, ox, oy, angle, arc, range + 0.6);
      if (o.fx !== false) {
        if (o.fx && typeof o.fx === 'object') game.fx(Object.assign({ x: ox, y: oy, angle }, o.fx));
        else game.fx({ type: typeof o.fx === 'string' ? o.fx : 'slash', x: ox, y: oy, angle, arc, r: range, color: colorOf(o, source), style: o.style || 'sword' });
      }
      if (!o.noAnim && source.type !== 'effect') { ents.setAnim(source, o.anim || ANIM.ATTACK, o.animDur || 0.22); source.data.faceT = 0.25; source.angle = angle; }
      if (!o.silent) game.bus.emit('sfx', { id: 'swing' });
      return out;
    }
    // Damage options for one block call (one small object per attack, never per frame).
    function dmgOpts(source, o, defType) {
      const d = {};
      d.source = source; d.type = o.type || defType; d.element = o.element || null;
      d.knockback = o.knockback != null ? o.knockback : defType === 'melee' ? 3 : 0;
      d.crit = !!o.crit; d.critChance = o.critChance || 0; d.critMult = o.critMult || 0;
      d.status = o.status || null; d.hitStop = o.hitStop || 0; d.tags = o.tags || null; d.lifesteal = o.lifesteal || 0;
      d.shake = o.shake || 0; d.silent = !!o.silent; d.keepStealth = !!o.keepStealth; d.color = o.color || null;
      d.mult = o.mult || 0; d.raw = !!o.raw; d.proj = null; d.angle = undefined; d.kbAngle = undefined; d.dot = false;
      return d;
    }

    // ---------- projectiles ----------
    function defaultLook(model, color, glow, size) {
      const key = model + '|' + color + '|' + glow + '|' + size;
      let l = lookCache.get(key);
      if (!l) { l = { rig: 'projectile', model, color, glow: glow || color, size: size || 1, trail: true }; lookCache.set(key, l); }
      return l;
    }
    function projectile(source, o = {}) {
      const cap = ents.caps.projectiles;
      if (cap && ents.countAwake('projectile') >= cap) {
        const all = ents.all;
        for (let i = 0; i < all.length; i++) if (all[i].type === 'projectile' && !all[i].removed) { ents.remove(all[i]); break; }
      }
      const angle = o.angle != null ? o.angle : source.angle;
      const speed = o.speed != null ? o.speed : 10;
      const off = (source.radius || 0.3) * 0.8 + (o.offset || 0);
      let x = o.x != null ? o.x : source.x + Math.cos(angle) * off;
      let y = o.y != null ? o.y : source.y + Math.sin(angle) * off;
      if (o.side) { x += Math.cos(angle + Math.PI / 2) * o.side; y += Math.sin(angle + Math.PI / 2) * o.side; }
      const team = o.hitsTeam ? oppositeOf(o.hitsTeam) : source.team;
      const color = colorOf(o, source);
      const pd = {
        dmg: (o.amount != null ? o.amount : (o.dmg != null ? o.dmg : 1) * powerOf(source)) * (o.mult || 1),
        type: o.type || 'ranged', element: o.element || null, status: o.status || null,
        knockback: o.knockback != null ? o.knockback : 1.5, crit: !!o.crit, critChance: o.critChance || 0, critMult: o.critMult || 0,
        hitStop: o.hitStop || 0, lifesteal: o.lifesteal || 0, tags: o.tags || null, color,
        speed, range: o.range != null ? o.range : 7, traveled: 0,
        pierce: o.pierce === true ? Infinity : o.pierce || 0,
        bounce: o.bounce || 0, bounceRange: o.bounceRange || 4,
        homing: o.homing === true ? 5 : o.homing || 0, homingRange: o.homingRange || 6, homeT: 0, homeTarget: null,
        returns: !!o.returns, returning: false, returnSpeed: o.returnSpeed || speed * 1.15,
        split: typeof o.split === 'number' ? { n: o.split } : o.split || null,
        gravityZ: o.gravityZ || 0, vz: 0, lob: false,
        explode: o.explode || null, landZone: o.landZone || null,
        onHit: o.onHit || null, onExpire: o.onExpire || null, onCatch: o.onCatch || null,
        hitsTeam: o.hitsTeam || null, hits: [], ghost: !!o.ghost, owner: source.id, reflectedTick: -1, reflected: false,
        ownerIsPlayer: ownerOf(source) === game.player, maxHits: o.maxHits || 0, hitCount: 0, src: source,
      };
      let z = o.z != null ? o.z : (source.z || 0) + 0.5;
      if (pd.gravityZ > 0) {
        // Lob: land at the target point (o.target {x,y}) or at max range.
        let dist = pd.range;
        if (o.target) { const dx = o.target.x - x, dy = o.target.y - y; dist = Math.min(pd.range, Math.sqrt(dx * dx + dy * dy)); }
        const tFlight = Math.max(0.15, dist / speed);
        pd.vz = (pd.gravityZ * tFlight) / 2 - z / tFlight;
        pd.range = dist + 0.5; pd.lob = true;
      }
      const e = ents.create({
        kind: o.kind || 'projectile', type: 'projectile', team, owner: source.id, x, y, z,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, dir: source.dir,
        radius: o.radius != null ? o.radius : 0.15, solid: false, pushable: false,
        look: o.look || defaultLook(o.model || 'bolt', color, o.glow, o.size), data: { proj: pd },
      });
      if (o.homingTarget) pd.homeTarget = typeof o.homingTarget === 'object' ? o.homingTarget.id : o.homingTarget;
      return e;
    }
    function startReturn(e) {
      const pd = e.data.proj;
      pd.returning = true; pd.hits.length = 0;
    }
    function expire(e, why) {
      const pd = e.data.proj;
      if (e.removed) return;
      if (pd.explode) explodeAt(e, e.x, e.y);
      if (pd.landZone) zone(pd.src || e, Object.assign({ x: e.x, y: e.y }, pd.landZone));
      if (pd.onExpire) pd.onExpire(game, e, why);
      if (why === 'wall') game.fx({ type: 'hit', x: e.x, y: e.y, color: pd.color });
      ents.remove(e);
    }
    function explodeAt(e, x, y) {
      const pd = e.data.proj, ex = pd.explode;
      const src = ents.get(pd.owner) || pd.src || e;
      aoe(src, { x, y, r: ex.r || 1.5, amount: ex.amount != null ? ex.amount : ex.dmg != null ? ex.dmg * powerOf(src) : pd.dmg,
        knockback: ex.knockback != null ? ex.knockback : 4, type: pd.type, element: pd.element, status: ex.status || pd.status,
        fx: ex.fx || 'burst', color: ex.color || pd.color, hitsTeam: pd.hitsTeam, exclude: ex.excludeHit ? pd.hits : null, shake: ex.shake });
    }
    function spawnSplit(e, t) {
      const pd = e.data.proj, s = pd.split;
      const src = ents.get(pd.owner) || pd.src || e;
      const n = s.n || 2, arc = (s.arc != null ? s.arc : 60) * DEG;
      for (let i = 0; i < n; i++) {
        const a = e.angle + (n === 1 ? 0 : -arc / 2 + arc * i / (n - 1));
        const c = projectile(src, { x: e.x, y: e.y, z: e.z, angle: a, speed: s.speed || pd.speed, range: s.range || 3,
          amount: pd.dmg * (s.dmgMul != null ? s.dmgMul : 0.5), type: pd.type, element: pd.element, status: pd.status,
          knockback: pd.knockback * 0.5, look: s.look || e.look, radius: s.radius || e.radius * 0.8, hitsTeam: pd.hitsTeam,
          homing: s.homing || 0, pierce: s.pierce || 0, onHit: s.onHit || null, kind: e.kind });
        c.data.proj.hits.push(t.id);
      }
    }
    function projHit(e, t) {
      const pd = e.data.proj;
      pd.hits.push(t.id);
      pd.hitCount++;
      const src = ents.get(pd.owner) || null;
      const d = dmgOpts(src || pd.src, pd, 'ranged');
      d.source = src || pd.src; d.proj = e; d.angle = e.angle; d.kbAngle = e.angle; d.knockback = pd.knockback; d.color = pd.color;
      const dealt = damage(t, pd.dmg, d);
      if (pd.reflectedTick === game.tick) return;          // perfect-blocked and reflected: keep flying
      if (pd.onHit) pd.onHit(game, t, dealt, e);
      if (e.removed) return;
      if (pd.split) spawnSplit(e, t);
      if (pd.explode) { explodeAt(e, e.x, e.y); if (pd.pierce <= 0 && pd.bounce <= 0) { pd.explode = null; } }
      if (pd.maxHits && pd.hitCount >= pd.maxHits) { expire(e, 'hit'); return; }
      if (pd.pierce > 0) { pd.pierce--; return; }
      if (pd.bounce > 0) {
        setFilterProj(e);
        let best = null, bd = pd.bounceRange * pd.bounceRange;
        const cand = ents.inRadius(e.x, e.y, pd.bounceRange, filterHit, scratchB);
        for (let i = 0; i < cand.length; i++) {
          const c = cand[i];
          if (pd.hits.indexOf(c.id) >= 0) continue;
          const dd = (c.x - e.x) * (c.x - e.x) + (c.y - e.y) * (c.y - e.y);
          if (dd < bd) { bd = dd; best = c; }
        }
        if (best) {
          pd.bounce--;
          setAngle(e, angleTo(e.x, e.y, best.x, best.y));
          pd.traveled = Math.max(0, pd.range - pd.bounceRange - 1);
          game.fx({ type: 'hit', x: e.x, y: e.y, color: pd.color });
          return;
        }
      }
      if (pd.returns && !pd.returning) { startReturn(e); return; }
      expire(e, 'hit');
    }
    function setAngle(e, a) {
      e.angle = a;
      const pd = e.data.proj;
      const sp = pd.returning ? pd.returnSpeed : pd.speed;
      e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp;
    }
    function setFilterProj(e) {
      const pd = e.data.proj;
      fSrc = ents.get(pd.owner) || null;
      fTeam = pd.hitsTeam ? oppositeOf(pd.hitsTeam) : e.team;
      fOwnerIsPlayer = pd.ownerIsPlayer;
    }
    function updateProjectile(e, dt) {
      const pd = e.data.proj;
      if (pd.returning) {
        const ow = ents.get(pd.owner);
        if (!ow || ow.removed) { expire(e, 'range'); return; }
        const a = angleTo(e.x, e.y, ow.x, ow.y);
        setAngle(e, a);
        const dx = ow.x - e.x, dy = ow.y - e.y;
        if (dx * dx + dy * dy < (ow.radius + 0.35) * (ow.radius + 0.35)) {
          if (pd.onCatch) pd.onCatch(game, e, ow);
          game.bus.emit('proj:caught', { proj: e, owner: ow });
          ents.remove(e);
          return;
        }
      } else if (pd.homing > 0) {
        pd.homeT -= dt;
        let tgt = pd.homeTarget != null ? ents.get(pd.homeTarget) : null;
        if (pd.homeT <= 0 || (tgt && !targetable(tgt))) {
          pd.homeT = 0.1;
          setFilterProj(e);
          if (!tgt || !targetable(tgt) || pd.hits.indexOf(tgt.id) >= 0) {
            homeHits = pd.hits;
            tgt = ents.nearest(e.x, e.y, pd.homingRange, homeFilter);
            pd.homeTarget = tgt ? tgt.id : null;
          }
        }
        if (tgt && targetable(tgt)) {
          const want = angleTo(e.x, e.y, tgt.x, tgt.y);
          const diff = angleDiff(e.angle, want);
          const maxTurn = pd.homing * dt;
          setAngle(e, e.angle + (diff > maxTurn ? maxTurn : diff < -maxTurn ? -maxTurn : diff));
        }
      }
      const sp = pd.returning ? pd.returnSpeed : pd.speed;
      const step = sp * dt;
      const n = Math.max(1, Math.ceil(step / 0.3));
      const sx = e.vx * dt / n, sy = e.vy * dt / n, ss = step / n;
      for (let k = 0; k < n; k++) {
        e.x += sx; e.y += sy;
        if (!pd.returning) pd.traveled += ss;
        if (!pd.ghost && !pd.returning && (!pd.lob || e.z < 0.5) && game.world.solidAt(e.x, e.y, true)) {
          if (pd.returns) { e.x -= sx; e.y -= sy; startReturn(e); break; }
          e.x -= sx * 0.5; e.y -= sy * 0.5;
          expire(e, 'wall');
          return;
        }
        if (!pd.lob || e.z < 0.6) {
          setFilterProj(e);
          const cand = ents.inRadius(e.x, e.y, e.radius + 0.9, filterHit, scratchC);
          for (let i = 0; i < cand.length; i++) {
            const t = cand[i];
            if (pd.hits.indexOf(t.id) >= 0) continue;
            const dx = t.x - e.x, dy = t.y - e.y, rr = t.radius + e.radius;
            if (dx * dx + dy * dy > rr * rr) continue;
            projHit(e, t);
            if (e.removed || pd.reflectedTick === game.tick) break;
          }
          if (e.removed) return;
        }
      }
      if (pd.lob) {
        pd.vz -= pd.gravityZ * dt;
        e.z += pd.vz * dt;
        if (e.z <= 0) { e.z = 0; expire(e, 'land'); return; }
      }
      if (!pd.returning && pd.traveled >= pd.range) {
        if (pd.returns) startReturn(e);
        else expire(e, 'range');
      }
    }

    /** Turn a projectile around: new owner/team, aimed back at its old owner (or reversed). */
    function reflect(proj, newOwner, opts = {}) {
      const pd = proj && proj.data.proj;
      if (!pd || !newOwner) return false;
      const old = ents.get(pd.owner);
      proj.team = newOwner.team; proj.owner = newOwner.id;
      pd.owner = newOwner.id; pd.src = newOwner; pd.hitsTeam = null; pd.ownerIsPlayer = ownerOf(newOwner) === game.player;
      pd.traveled = 0; pd.hits.length = 0; pd.returning = false; pd.returns = false; pd.reflectedTick = game.tick; pd.reflected = true;
      if (opts.mult) pd.dmg *= opts.mult;
      if (opts.homing) pd.homing = opts.homing;
      setAngle(proj, old && targetable(old) ? angleTo(proj.x, proj.y, old.x, old.y) : wrapAngle(proj.angle + Math.PI));
      game.fx({ type: 'sparkle', x: proj.x, y: proj.y, n: 6, color: opts.color || '#ffd23f', r: 0.4 });
      game.bus.emit('proj:reflected', { proj, by: newOwner });
      return true;
    }
    function reflectInArc(owner, x, y, angle, arc, range, opts) {
      let n = 0;
      const cand = ents.inRadius(x, y, range, null, scratchB);
      for (let i = 0; i < cand.length; i++) {
        const p = cand[i];
        if (p.type !== 'projectile' || !p.data.proj || !hostileTeams(p.team, owner.team)) continue;
        if (Math.abs(angleDiff(angle, angleTo(x, y, p.x, p.y))) > (arc * DEG) / 2) continue;
        if (reflect(p, owner, opts)) n++;
      }
      return n;
    }

    // ---------- AoE ----------
    function inShape(o, t, x, y) {
      const dx = t.x - x, dy = t.y - y;
      const shape = o.shape || 'circle';
      if (shape === 'line') {
        const a = o.angle || 0, c = Math.cos(a), s = Math.sin(a);
        const along = dx * c + dy * s, across = Math.abs(-dx * s + dy * c);
        return along >= -t.radius && along <= (o.len || o.r || 4) + t.radius && across <= (o.w || 0.8) / 2 + t.radius;
      }
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d - t.radius > (o.r || 1.5)) return false;
      if (shape === 'cone' && d > 0.3) return Math.abs(angleDiff(o.angle || 0, Math.atan2(dy, dx))) <= ((o.arc || 90) * DEG) / 2 + 0.15;
      return true;
    }
    function resolveAoe(source, o, x, y, amount, out) {
      out.length = 0;
      setFilter(source, o.hitsTeam);
      const reach = o.shape === 'line' ? (o.len || o.r || 4) + 1 : (o.r || 1.5) + 1.5;
      const cx = o.shape === 'line' ? x + Math.cos(o.angle || 0) * reach / 2 : x, cy = o.shape === 'line' ? y + Math.sin(o.angle || 0) * reach / 2 : y;
      const cand = ents.inRadius(cx, cy, o.shape === 'line' ? reach / 2 + 1 : reach, filterHit, scratchA);
      for (let i = 0; i < cand.length; i++) {
        const t = cand[i];
        if (o.exclude && o.exclude.indexOf(t.id) >= 0) continue;
        if (inShape(o, t, x, y)) out.push(t);
      }
      sortByDist(out, x, y);
      if (o.maxTargets && out.length > o.maxTargets) out.length = o.maxTargets;
      const d = dmgOpts(source, o, o.type || 'magic');
      d.knockback = o.knockback != null ? o.knockback : 4;
      for (let i = 0; i < out.length; i++) {
        const t = out[i];
        let ang = o.shape === 'line' ? o.angle || 0 : angleTo(x, y, t.x, t.y);
        if (o.pull) ang = wrapAngle(ang + Math.PI);
        d.angle = ang; d.kbAngle = ang;
        let dealt = 0;
        if (amount > 0) dealt = damage(t, amount, d);
        else {
          // No damage (level-up ring, pure control): statuses and knockback only.
          if (o.status) applyStatuses(t, o.status, source);
          if (d.knockback && !t.tags.includes('boss')) game.physics.push(t, ang, d.knockback);
        }
        if (o.onHit) o.onHit(game, t, dealt, source);
      }
      if (o.fx !== false) {
        const color = colorOf(o, source);
        if (o.fx && typeof o.fx === 'object') game.fx(Object.assign({ x, y, r: o.r, color }, o.fx));
        else {
          const type = typeof o.fx === 'string' ? o.fx : o.shape === 'line' ? 'beam' : 'ring';
          if (type === 'beam') game.fx({ type, x, y, x2: x + Math.cos(o.angle || 0) * (o.len || 4), y2: y + Math.sin(o.angle || 0) * (o.len || 4), w: o.w || 0.5, color });
          else game.fx({ type, x, y, r: o.r || 1.5, color, n: 16, dur: 0.5, angle: o.angle || 0, arc: o.arc || 0 });
        }
      }
      if (o.shake) game.camera.shake = Math.max(game.camera.shake, o.shake);
      if (o.zone) zone(source, Object.assign({ x, y }, o.zone));
      if (o.onResolve) o.onResolve(game, out, x, y);
      return out;
    }
    function aoe(source, o = {}) {
      const x = o.x != null ? o.x : source.x, y = o.y != null ? o.y : source.y;
      const amount = o.amount != null ? o.amount : o.dmg ? o.dmg * powerOf(source) : 0;
      if (o.delay > 0) {
        const shape = o.shape || 'circle';
        const tele = o.telegraph === false || o.telegraph === null ? null : (typeof o.telegraph === 'string' ? o.telegraph : shape);
        const col = o.telegraphColor || (source.team === 'enemy' ? '#ff5050' : '#ffd24a');
        const rec = { o, src: source, t: o.delay, total: o.delay, amount, x, y, meteor: null };
        let e = null;
        if (tele) {
          e = ents.create({
            kind: 'telegraph', type: 'effect', team: source.team, owner: source.id, x, y, solid: false,
            angle: o.angle || 0, dir: source.dir,
            look: { rig: 'effect', model: 'telegraph_' + tele, color: col, r: o.r || 1.5, len: o.len || o.r || 4, w: o.w || 0.8, arc: o.arc || 90 },
            data: { aoe: rec },
          });
        } else pendingAoe.push(rec);
        if (o.meteor) {
          rec.meteor = ents.create({ kind: 'meteor', type: 'effect', team: source.team, x, y, z: 8, solid: false,
            look: { rig: 'effect', model: 'meteor', color: colorOf(o, source), r: (o.r || 1.5) * 0.5 }, data: { fallZ: 8 } });
        }
        if (!e) return rec.meteor || rec;
        return e;
      }
      return resolveAoe(source, o, x, y, amount, o.out || aoeOut);
    }

    // ---------- lingering zones ----------
    function zone(source, o = {}) {
      const x = o.x != null ? o.x : source.x, y = o.y != null ? o.y : source.y;
      const r = o.r || 1.5;
      const model = o.model || (o.look && o.look.model) || (o.element === 'fire' ? 'ground_fire' : o.element === 'frost' ? 'ground_frost'
        : o.smoke ? 'smoke' : o.caltrops ? 'caltrops' : o.bubble ? 'shield_bubble' : 'zone_ring');
      const look = o.look ? Object.assign({ rig: 'effect', model, r }, o.look) : { rig: 'effect', model, color: colorOf(o, source), r };
      const tick = o.tick || 0.5;
      return ents.create({
        kind: o.kind || 'zone', type: 'effect', team: source.team, owner: source.id, x, y, solid: false, look,
        ttl: o.dur != null ? o.dur : 3,
        data: { zone: {
          o, src: source, r, tick, acc: o.firstTick === false ? 0 : tick,
          amount: o.amount != null ? o.amount : o.dmg ? o.dmg * powerOf(source) : 0,
          healAmt: o.healAmount != null ? o.healAmount : o.heal ? o.heal * powerOf(source) : 0,
          id: o.id || 'zone', follow: o.follow != null ? (typeof o.follow === 'object' ? o.follow.id : o.follow) : null,
        } },
      });
    }
    const zoneOut = [];
    function tickZone(e, dt) {
      const zd = e.data.zone, o = zd.o;
      if (zd.follow != null) { const f = ents.get(zd.follow); if (f && !f.removed) { e.x = f.x; e.y = f.y; } else { ents.remove(e); return; } }
      zd.acc += dt;
      if (zd.acc < zd.tick) return;
      zd.acc -= zd.tick;
      const src = zd.src;
      setFilter(src, o.hitsTeam);
      zoneOut.length = 0;
      const cand = ents.inRadius(e.x, e.y, zd.r + 1, null, scratchA);
      for (let i = 0; i < cand.length; i++) {
        const t = cand[i];
        if (!targetable(t)) continue;
        const dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d - t.radius > zd.r) continue;
        const enemy = filterHit(t);
        const ally = !enemy && !hostileTeams(e.team, t.team) && t.team === e.team;
        if (enemy) {
          zoneOut.push(t);
          if (zd.amount > 0) {
            const dd = dmgOpts(src, o, o.type || 'magic');
            dd.knockback = 0; dd.dot = true;
            dd.silent = o.silent != null ? o.silent : false;
            damage(t, zd.amount, dd);
          }
          if (o.status) applyStatuses(t, o.status, src);
          if (o.smoke && t.ai && game.sys.ai && game.sys.ai.blind) game.sys.ai.blind(t, zd.tick + 0.2);
          if (o.push) game.physics.push(t, Math.atan2(dy, dx), o.push);
          if (o.pull) game.physics.push(t, Math.atan2(-dy, -dx), Math.min(o.pull, d * 6));
        } else if (ally) {
          if (zd.healAmt > 0) heal(t, zd.healAmt, { silent: o.silentHeal });
          if (o.allyMod) addMod(t, 'zone:' + zd.id, o.allyMod, zd.tick + 0.15);
          if (o.allyStatus) applyStatuses(t, o.allyStatus, src);
        }
      }
      if (o.onTick) o.onTick(game, e, zoneOut);
    }

    // ---------- summons ----------
    function summon(owner, kindOrDef, o = {}) {
      const def = typeof kindOrDef === 'string' ? (game.data.enemies[kindOrDef] || null) : kindOrDef || null;
      const ds = (def && def.stats) || {};
      const a = o.angle != null ? o.angle : rng.next() * Math.PI * 2;
      const x = o.x != null ? o.x : owner.x + Math.cos(a) * (o.dist != null ? o.dist : 1);
      const y = o.y != null ? o.y : owner.y + Math.sin(a) * (o.dist != null ? o.dist : 1);
      const power = o.power != null ? o.power : powerOf(owner) * (o.powerMul != null ? o.powerMul : 0.6);
      const hp = o.hp != null ? o.hp : Math.max(1, Math.round((owner.hpMax || 20) * (o.hpMul != null ? o.hpMul : 0.4)));
      const key = o.key || (typeof kindOrDef === 'string' ? kindOrDef : (def && def.id) || 'summon');
      const e = ents.create({
        kind: o.kind || (def && def.id) || key, type: 'summon', team: owner.team, owner: owner.id, def,
        name: o.name || (def && def.name) || '', x, y, z: def && def.flying ? 0.5 : 0,
        look: clone(o.look || (def && def.look) || { rig: 'blob', size: 0.6, colors: { body: '#3fe0c5' } }),
        radius: o.radius || ds.radius || 0.3, solid: true, pushable: true, hp, hpMax: hp, level: owner.level,
        stats: { power, defense: o.defense != null ? o.defense : ds.defense || 0, speed: o.speed || ds.speed || (owner.stats.speed || 3) * 1.05 },
        tags: ['summon'].concat(o.tags || []), scale: o.scale || 1,
        data: { summonKey: key, flying: !!(def && def.flying) || !!o.flying, taunt: !!o.taunt, life: o.ttl != null ? o.ttl : Infinity,
          onExpire: o.onExpire || null, onDeath: o.onDeath || null, home: { x, y }, summonedAt: game.t },
      });
      if (o.fxTag !== false) ents.setFxTag(e, o.fxTag || 'summoned', true);
      const brain = o.brain || 'ally_melee';
      if (game.sys.ai && game.sys.ai.attach && brain !== 'none') {
        game.sys.ai.attach(e, Object.assign({ brain }, o.ai), o.attacks || (def && def.attacks) || null);
      }
      if (o.fx !== false) {
        game.fx({ type: 'pillar', x, y, r: 0.6, color: o.color || '#3fe0c5', dur: 0.5 });
        game.fx({ type: 'poof', x, y, color: o.color || '#3fe0c5' });
      }
      game.bus.emit('summon', { ent: e, owner });
      return e;
    }
    /** Decoy: an immobile taunting copy (default: the owner's look) that enemies prefer; bursts on expiry. */
    function decoy(owner, o = {}) {
      const look = o.look || clone(owner.look);
      const e = summon(owner, { id: o.kind || 'decoy', name: o.name || owner.name, look, stats: { radius: owner.radius } }, Object.assign({
        x: owner.x, y: owner.y, hp: o.hp != null ? o.hp : Math.max(5, Math.round((owner.hpMax || 20) * 0.5)), ttl: o.ttl != null ? o.ttl : 2.5,
        taunt: true, brain: 'idle', fxTag: o.fxTag || 'shadow', fx: false, speed: 0.001,
      }, o));
      e.angle = owner.angle; e.dir = owner.dir;
      e.data.decoy = true;
      game.fx({ type: 'poof', x: e.x, y: e.y, color: '#6a5a8a' });
      return e;
    }
    function summonsOf(owner, key, out = []) {
      out.length = 0;
      const id = owner && owner.id;
      const all = ents.all;
      for (let i = 0; i < all.length; i++) {
        const e = all[i];
        if (e.removed || e.type !== 'summon' || e.owner !== id || !e.alive) continue;
        if (key && e.data.summonKey !== key) continue;
        out.push(e);
      }
      return out;
    }
    function expireSummon(e, why) {
      if (e.removed) return;
      e.alive = false;
      if (e.data.onExpire) e.data.onExpire(game, e, why);
      game.fx({ type: 'poof', x: e.x, y: e.y, color: '#cfefff' });
      game.bus.emit('summon:expired', { ent: e, why });
      ents.remove(e);
    }

    // ---------- update ----------
    function tickStatuses(e, dt) {
      const st = e.status;
      let changed = false;
      for (const k in st) {
        const v = st[k];
        if (!(v > 0)) continue;
        const nv = v - dt;
        if (k === 'burn' || k === 'venom') {
          const acc = (e.data.dotAcc || (e.data.dotAcc = {}));
          acc[k] = (acc[k] || 0) + dt;
          if (acc[k] >= DOT_TICK) {
            acc[k] -= DOT_TICK;
            const per = k === 'venom' ? (e.statusPower.venom || 1) * ((e.data.stacks && e.data.stacks.venom) || 1) : e.statusPower.burn || 1;
            const amt = Math.max(1, Math.round(per * DOT_TICK));
            const srcE = e.data.dotSrc && e.data.dotSrc[k];
            const d = dmgOpts(srcE || null, {}, 'true');
            d.source = srcE || null; d.knockback = 0; d.dot = true; d.raw = true; d.element = k === 'burn' ? 'fire' : 'poison';
            d.color = k === 'burn' ? '#ff7a2f' : '#7cf07c';
            damage(e, amt, d);
            if (e.removed || !e.alive) return;
          }
        }
        if (nv <= 0) {
          st[k] = 0; e.statusPower[k] = 0; changed = true;
          if (k === 'stealth') e.alpha = 1;
          if ((k === 'venom' || k === 'frost') && e.data.stacks) e.data.stacks[k] = 0;
          game.bus.emit('status:end', { ent: e, id: k });
        } else st[k] = nv;
      }
      if (changed) syncFx(e);
    }
    function tickPending(ad, dt) {
      ad.t -= dt;
      if (ad.meteor && !ad.meteor.removed) ad.meteor.z = Math.max(0, ad.meteor.data.fallZ * (ad.t / ad.total));
      if (ad.t > 0) return false;
      if (ad.meteor) ents.remove(ad.meteor);
      resolveAoe(ad.src, ad.o, ad.x, ad.y, ad.amount, aoeOut);
      if (ad.o.meteor) game.camera.shake = Math.max(game.camera.shake, 0.4);
      return true;
    }
    function updateAll(dt) {
      for (let i = pendingAoe.length - 1; i >= 0; i--) if (tickPending(pendingAoe[i], dt)) pendingAoe.splice(i, 1);
      const all = ents.all;
      const p = game.player;
      for (let i = 0; i < all.length; i++) {
        const e = all[i];
        if (e.removed || e.asleep) continue;
        const ty = e.type;
        if (ty === 'projectile') { if (e.data.proj) updateProjectile(e, dt); continue; }
        if (ty === 'effect') {
          const ad = e.data.aoe;
          if (ad) {
            if (tickPending(ad, dt)) ents.remove(e);
            continue;
          }
          if (e.data.zone) tickZone(e, dt);
          continue;
        }
        if (ty === 'pickup') {
          if (!p || p.data.down || game.t - e.data.bornT < 0.4) continue;
          const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
          if (d2 < (p.radius + 0.3) * (p.radius + 0.3)) { collect(e, p); continue; }
          if (d2 < MAGNET_R * MAGNET_R) {
            const d = Math.sqrt(d2) || 1, sp = 5 + (MAGNET_R - d) * 5;
            e.vx = dx / d * sp; e.vy = dy / d * sp; e.solid = false; e.kx = e.ky = 0;
          } else { e.vx = 0; e.vy = 0; }
          continue;
        }
        if (DAMAGEABLE[ty] !== 1) continue;
        tickStatuses(e, dt);
        if (e.removed) continue;
        if (e.data.mods && e.data.mods.length) pruneMods(e);
        if (e.data.down && ty !== 'player') {
          e.data.downT -= dt;
          if (e.data.downT <= 0) {
            e.data.down = false;
            e.hp = Math.max(1, Math.round(e.hpMax * (ty === 'companion' ? 0.5 : 1)));
            e.anim = ANIM.IDLE; e.animT = 0; e.data.animUntil = undefined;
            game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 8, color: '#ffffff', r: 0.6 });
            game.bus.emit('ent:up', { ent: e });
          }
        }
        if (ty === 'summon' && e.data.life !== Infinity) {
          e.data.life -= dt;
          if (e.data.life <= 0) expireSummon(e, 'ttl');
        }
      }
    }

    // ---------- bus ----------
    game.bus.on('zone:unload', () => { pendingAoe.length = 0; });
    game.bus.on('player:revived', () => {
      const pl = game.player;
      if (!pl) return;
      pl.data.down = false;
      if (pl.hp <= 0) pl.hp = pl.hpMax;
      pl.anim = ANIM.IDLE; pl.animT = 0; pl.data.animUntil = undefined;
    });

    // ---------- ops ----------
    const ops = game.sys.ops;
    if (ops && ops.register) {
      ops.register('heal', (g, a) => {
        let who = game.player, n = null;
        if (a.length === 2) { if (typeof a[1] === 'number') n = a[1]; else who = ents.find(a[1]); }
        if (a.length >= 3) { who = ents.find(a[1]); n = a[2]; }
        if (!who) return;
        if (who.data.down && who.type !== 'player') { who.data.downT = 0; }
        heal(who, n == null ? who.hpMax : n);
      });
      ops.register('kill', (g, a) => {
        const list = ents.findAll(a[1], []);
        for (const e of list) kill(e, null, { force: e.type !== 'companion' && e.type !== 'player', noReward: true, noSpawn: true });
      });
    }

    const api = {
      hostile(a, b) { return !!a && !!b && a !== b && hostileTeams(a.team, b.team); },
      targetable, canHit(src, t) { setFilter(src, null); return filterHit(t); },
      damage, heal, kill, status, clearStatus, breakStealth,
      stacks(e, id) { return (e && e.data.stacks && e.data.stacks[id]) || 0; },
      setStacks(e, id, n) { (e.data.stacks || (e.data.stacks = {}))[id] = n; },
      mod, addMod, removeMod, speedMul,
      /** coefficient * caster power (CONTRACTS rule 9), before outgoing modifiers. */
      coef(source, c) { return c * powerOf(source); },
      powerOf,
      meleeArc, projectile, aoe, zone, reflect, reflectInArc, summon, decoy, summonsOf, expireSummon,
      dropPickup, setDown, ownerOf,
      STATUS_IDS,
    };
    api._update = updateAll;
    return api;
  },
  update(game, dt) { game.combat._update(dt); },
};
