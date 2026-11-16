// Companions (CONTRACTS 4, CLASSES "Classmates"): classmates that follow the player, fight with their class's
// basic attack and Space ability (as ai attacks) at the player's level, never die (10 s down at 0 HP), teleport back
// when left behind, react with speech bubbles. Op owned here: companions.
// Round 2 (playtest: "companions should get stronger with you"): 100% of the class numbers (was 70%), rescaled on
// every level change ('levelup', 'level:set', or progression.level moving by itself), a second ability from player
// level 5 (`companion.ability2`), and when the player specializes an upgraded basic (+30%, plus a class touch: Bram's
// swing throws a short crescent, Elowen's bolt splits, Pip's daggers bleed), an outfit upgrade and a toast
// (`companion.upgrade`). Walking speed follows config.playerSpeedMul like the player's.
import { clone, deepMerge } from './ents.js';

const DEFAULTS = {
  warrior: {
    npc: 'bram', name: 'Bram', brain: 'ally_melee', hp: [44, 9], power: [5, 1.3], speed: 3.4, color: '#e2503c',
    look: { rig: 'humanoid', build: 'a', size: 1.05, skin: '#d9a066', hair: { style: 'spiky', color: '#c8642a' }, facial: 'none',
      outfit: { style: 'tunic', primary: '#c8402c', secondary: '#d8dae4', accent: '#ffd24a' }, hood: false, hat: null, cape: null,
      held: { style: 'sword', color: '#d8dae4', glow: null }, aura: null, ears: 'round', hero: null },
    basic: { use: 'melee_arc', name: 'Sword Arc', arc: 100, range: 1.2, dmg: 1.0, knockback: 5, cd: 0.6, windup: 0.1, style: 'sword', color: '#e8e8f0' },
    ability: { use: 'dash', name: 'Shield Bash', dist: 2.5, speed: 14, dmg: 1.5, status: { stun: 0.8 }, knockback: 8, stopOnHit: true,
      cd: 5, range: 3, minRange: 1.3, windup: 0.15, color: '#e2503c' },
    barks: { levelup: ['WOO! Level up, buddy!', 'Look at you go!'], shield: ['Smash that shield!'], ultimate: ["THAT'S what I'm talking about!"], down: ['Just... resting my eyes.'] },
  },
  mage: {
    npc: 'elowen', name: 'Elowen', brain: 'ally_ranged', hp: [28, 5], power: [6, 1.6], speed: 3.3, color: '#b48cff',
    look: { rig: 'humanoid', build: 'b', size: 1, skin: '#8d5a3b', hair: { style: 'braids', color: '#1e1410' }, facial: 'none',
      outfit: { style: 'robe', primary: '#7a4fd0', secondary: '#3fc8e0', accent: '#ffd24a' }, hood: false, hat: { style: 'wizard', color: '#5a3aa8' }, cape: null,
      held: { style: 'staff', color: '#8a5a33', glow: '#7fe0ff' }, aura: null, ears: 'round', hero: null },
    basic: { use: 'projectile', name: 'Arcane Bolt', model: 'bolt', speed: 11, range: 7, dmg: 1.0, cd: 0.7, windup: 0.12, type: 'magic', color: '#b48cff', glow: '#7fe0ff' },
    ability: { use: 'blink', name: 'Blink', away: true, dist: 3.5, cd: 4, range: 1.6, windup: 0.05 },
    barks: { levelup: ['Adequate progress.', 'Statistically impressive.'], shield: ['The shield has a weakness. Probably.'], ultimate: ['I took notes on that.'], down: ['This is fine. I am fine.'] },
  },
  rogue: {
    npc: 'pip', name: 'Pip', brain: 'ally_melee', hp: [34, 6.5], power: [4.5, 1.25], speed: 4.0, color: '#58d68d',
    look: { rig: 'humanoid', build: 'b', size: 0.85, skin: '#c68e62', hair: { style: 'curly', color: '#5a3a22' }, facial: 'none',
      outfit: { style: 'leather', primary: '#2f8a4a', secondary: '#24303a', accent: '#58d68d' }, hood: false, hat: { style: 'bandana', color: '#2a9d8f' }, cape: null,
      held: { style: 'daggers', color: '#d8dae4', glow: null }, aura: null, ears: 'pointed', hero: null },
    basic: { use: 'melee_arc', name: 'Twin Daggers', arc: 70, range: 0.95, dmg: 0.55, repeat: 2, critChance: 0.15, cd: 0.3, windup: 0.08, style: 'dagger', color: '#58d68d' },
    ability: { use: 'dash', name: 'Dodge Roll', dist: 3, speed: 16, invuln: 0.35, dmg: 0.6, through: true, cd: 3, range: 3, minRange: 0.8, windup: 0.05, color: '#58d68d' },
    barks: { levelup: ['Ooh, shiny new level!', 'Do it again!'], shield: ['Knock knock, big guy!'], ultimate: ['Teach me that!'], down: ['Ow. Ow ow ow.'] },
  },
};
const TELEPORT_DIST = 14;

export default {
  id: 'companions',
  init(game) {
    const hudPool = [];
    function cfgOf(classId) {
      const cd = (game.data.classes && game.data.classes[classId]) || {};
      const cc = cd.companion || {};
      const d = DEFAULTS[classId] || DEFAULTS.warrior;
      return { cd, cc, d };
    }
    function levelOf() {
      const pr = game.sys.progression;
      return pr && typeof pr.level === 'number' ? pr.level : (game.player && game.player.level) || 1;
    }
    function specOf() { const pr = game.sys.progression; return (pr && pr.specId) || null; }
    function statsFor(classId, lvl) {
      const { cd, cc, d } = cfgOf(classId);
      const s = cc.stats || cd.stats || {};
      const mult = cc.mult != null ? cc.mult : 1;
      const hp0 = s.hp != null ? s.hp : d.hp[0], hp1 = s.hpPerLevel != null ? s.hpPerLevel : d.hp[1];
      const p0 = s.power != null ? s.power : d.power[0], p1 = s.powerPerLevel != null ? s.powerPerLevel : d.power[1];
      const ns = game.config.numberScale || 1;      // number scale (class tables are the readable base numbers)
      return {
        hp: Math.max(1, Math.round((hp0 + hp1 * lvl) * mult * ns)),
        power: (p0 + p1 * lvl) * mult * ns,
        speed: (cc.speed || s.speed || d.speed) * (game.config.playerSpeedMul || 1),
      };
    }
    /** Look for a classmate: npc look (or default) + class look, plus the upgrade outfit once the player specialized. */
    function lookFor(classId, upgraded) {
      const { cd, cc, d } = cfgOf(classId);
      const npcDef = game.data.npcs && game.data.npcs[cc.npc || d.npc];
      const look = clone(cc.look || (npcDef && npcDef.look) || d.look);
      if (cd.look && !cc.look) deepMerge(look, cd.look);
      if (upgraded && cc.upgrade && cc.upgrade.look) deepMerge(look, cc.upgrade.look);
      return look;
    }
    /** The ai attack list for the companion's level and tier: basic, Space ability, and ability2 from its unlock level. */
    function attacksFor(e, lvl, upgraded) {
      const { cc, d } = cfgOf(e.data.classId);
      const basic = Object.assign({}, d.basic, cc.basic);
      const up = upgraded ? cc.upgrade : null;
      if (up) {
        if (up.basic) Object.assign(basic, up.basic);
        if (up.dmgMul && basic.dmg != null) basic.dmg *= up.dmgMul;
        if (up.bleed) basic.status = { id: up.bleed.id || 'venom', t: up.bleed.t || 3, p: (up.bleed.dps || 0.1) * e.stats.power };
      }
      const list = [basic, Object.assign({}, d.ability, cc.ability)];
      const ab2 = cc.ability2;
      if (ab2 && lvl >= (ab2.unlock || 5)) list.push(Object.assign({}, ab2));
      return list;
    }
    /** Re-arm the ai attacks (keeps cooldowns of attacks with the same name). */
    function rearm(e, lvl, upgraded) {
      const ai = e.ai;
      if (!ai) return;
      const list = attacksFor(e, lvl, upgraded);
      const old = ai.attacks || [];
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        const name = a.name || a.use;
        let cdUntil = game.t;
        for (let j = 0; j < old.length; j++) if (old[j].name === name) { cdUntil = old[j].cdUntil; break; }
        out.push({ def: a, params: Object.assign({}, a), cdUntil, i, name });
      }
      ai.attacks = out;
      e.data.tier = upgraded ? 2 : lvl >= 5 ? 1 : 0;
      e.data.upgraded = !!upgraded;
    }
    function bark(e, kind) {
      if (!e || e.removed || e.data.down) return;
      const { cc, d } = cfgOf(e.data.classId);
      const lines = (cc.barks && cc.barks[kind]) || (d.barks && d.barks[kind]);
      if (!lines || !lines.length) return;
      if (game.t - (e.data.barkT || -99) < 4) return;
      e.data.barkT = game.t;
      const text = lines[Math.floor(game.rng.next() * lines.length)];
      game.fx({ type: 'text', x: e.x, y: e.y, z: 1.8, text, style: 'bubble', ent: e.id, dur: 2.5 });
    }
    function placeNear(e, i) {
      const p = game.player;
      if (!p) return;
      for (let k = 0; k < 8; k++) {
        const a = p.angle + Math.PI + (i === 0 ? 0.8 : -0.8) + k * 0.7;
        const x = p.x + Math.cos(a) * 1.4, y = p.y + Math.sin(a) * 1.4;
        if (!game.world.solidAt(x, y)) { game.physics.teleport(e, x, y); return; }
      }
      game.physics.teleport(e, p.x, p.y);
    }
    // Upgraded basics: a melee swing that also throws a short projectile (Bram's crescent). {..melee_arc, then: {..projectile}}
    // Registered on first use (the abilities system may initialize after this one).
    function ensureBlocks() {
      const ab = game.abilities;
      if (!ab || !ab.register || (ab.blocks && ab.blocks.swing_throw)) return;
      ab.register('swing_throw', (c, p) => {
        const hits = ab.use('melee_arc', c, p);
        if (p.then) ab.use('projectile', c, Object.assign({}, p.then, { angle: p.angle, mult: p.mult, anim: p.anim || 'attack' }));
        return hits;
      });
    }
    function create(classId, i) {
      ensureBlocks();
      const { cc, d } = cfgOf(classId);
      const npcId = cc.npc || d.npc;
      const npcDef = game.data.npcs && game.data.npcs[npcId];
      const upgraded = !!specOf();
      const look = lookFor(classId, upgraded);
      const lvl = levelOf();
      const st = statsFor(classId, lvl);
      const p = game.player;
      const e = game.ents.create({
        kind: npcId, type: 'companion', team: 'player', owner: p ? p.id : null, name: cc.name || (npcDef && npcDef.name) || d.name,
        x: p ? p.x : 0, y: p ? p.y : 0, look, radius: 0.3, solid: true, pushable: true, hp: st.hp, hpMax: st.hp, level: lvl,
        stats: { power: st.power, defense: 0, speed: st.speed }, tags: ['companion', classId],
        data: { classId, home: { x: 0, y: 0 } },
      });
      game.ai.attach(e, { brain: cc.brain || d.brain, keepRange: cc.keepRange, aggro: 7, leash: 0 }, attacksFor(e, lvl, upgraded));
      rearm(e, lvl, upgraded);
      e.ai.formation = i === 0 ? 0.8 : -0.8;
      placeNear(e, i);
      return e;
    }
    const api = {
      active: [],
      /** Replace the party with classmates of these classes (e.g. ['warrior', 'rogue']). */
      set(classIds) {
        for (const e of api.active) game.ents.remove(e);
        api.active = [];
        api.classIds = (classIds || []).slice();
        api.classIds.forEach((id, i) => api.active.push(create(id, i)));
        api._lvl = levelOf(); api._spec = specOf();
        game.ents.flush();
        return api.active;
      },
      classIds: [],
      /** Teleport every companion next to the player. */
      regroup() { api.active.forEach((e, i) => { if (!e.removed) placeNear(e, i); }); },
      /** Recompute stats, attacks and outfit for the current player level and spec (keeps the hp fraction). */
      rescale() {
        const lvl = levelOf();
        const upgraded = !!specOf();
        api._lvl = lvl; api._spec = specOf();
        for (const e of api.active) {
          if (e.removed) continue;
          const st = statsFor(e.data.classId, lvl);
          const f = e.hpMax > 0 ? e.hp / e.hpMax : 1;
          e.hpMax = st.hp; e.hp = e.data.down ? 0 : Math.max(1, Math.round(st.hp * f));
          e.stats.power = st.power; e.stats.speed = st.speed; e.level = lvl;
          if (!!e.data.upgraded !== upgraded) { e.look = lookFor(e.data.classId, upgraded); e.lookRev = (e.lookRev || 0) + 1; }
          rearm(e, lvl, upgraded);
        }
      },
      /** Stats for a classmate class at a level (the numbers rescale() applies). */
      statsFor,
      _lvl: null, _spec: null,
      bark,
      DEFAULTS,
    };
    const names = (list) => (list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0] || '');
    const live = () => api.active.filter((e) => !e.removed);
    function learnToast(before, after) {
      const who = live().filter((e) => { const a = cfgOf(e.data.classId).cc.ability2; const u = a ? a.unlock || 5 : 99; return before < u && after >= u; });
      if (!who.length) return;
      const ab = cfgOf(who[0].data.classId).cc.ability2;
      game.toast(who.length > 1 ? `${names(who.map((e) => e.name))} learned new moves!` : `${who[0].name} learned ${ab.name || 'a new move'}!`, 'good');
    }
    game.bus.on('levelup', ({ level: lv }) => {
      const before = api._lvl != null ? api._lvl : levelOf();
      api.rescale();
      for (const e of api.active) if (!e.data.down) e.hp = e.hpMax;
      if (api.active.length) bark(api.active[Math.floor(game.rng.next() * api.active.length)], 'levelup');
      learnToast(before, lv != null ? lv : levelOf());
    });
    // Package A (teacher mode) emits 'level:set' {level} for any level change, down as well as up.
    game.bus.on('level:set', () => { if (api.active.length) api.rescale(); });
    game.bus.on('spec:set', ({ specId }) => {
      const was = api._spec;
      if (!api.active.length) { api._spec = specOf(); return; }
      api.rescale();
      if (specId && !was) {
        const who = live();
        for (const e of who) game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 16, r: 0.9, color: (cfgOf(e.data.classId).d.color) || '#ffd24a' });
        const custom = who.length === 1 && cfgOf(who[0].data.classId).cc.upgrade && cfgOf(who[0].data.classId).cc.upgrade.toast;
        if (who.length) game.toast(custom || `${names(who.map((e) => e.name))} ${who.length > 1 ? 'grow' : 'grows'} stronger!`, 'good');
      }
    });
    game.bus.on('boss:shield', ({ on, retry }) => { if (on && !retry && api.active.length) bark(api.active[0], 'shield'); });
    game.bus.on('ability:cast', ({ ent, slot }) => { if (ent === game.player && slot === 'shift' && api.active.length) bark(api.active[api.active.length - 1], 'ultimate'); });
    game.bus.on('ent:down', ({ ent }) => { if (ent.type === 'companion') bark(ent, 'down'); });
    const ops = game.sys.ops;
    if (ops && ops.register) ops.register('companions', (g, a) => { api.set(a[1] || []); });

    api._hudPool = hudPool;
    return api;
  },
  update(game) {
    const api = game.companions;
    const p = game.player;
    if (!p || !api.active.length) return;
    // Level or spec changed without an event (debug, save load, another package's setter): follow it.
    const pr = game.sys.progression;
    if (pr && (pr.level !== api._lvl || (pr.specId || null) !== api._spec)) api.rescale();
    for (let i = 0; i < api.active.length; i++) {
      const e = api.active[i];
      if (e.removed) continue;
      e.owner = p.id;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy > TELEPORT_DIST * TELEPORT_DIST && !e.data.scripted) {
        game.fx({ type: 'poof', x: e.x, y: e.y });
        api.regroup();
        game.fx({ type: 'poof', x: e.x, y: e.y });
      }
    }
  },
  onZoneLoad(game) {
    const api = game.companions;
    for (let i = api.active.length - 1; i >= 0; i--) if (api.active[i].removed) api.active.splice(i, 1);
    api.regroup();
  },
  save(game) { return { list: game.companions.classIds.slice() }; },
  load(game, json) { if (json && json.list && json.list.length) game.companions.set(json.list); },
  hud(game, hud) {
    const api = game.companions;
    const pool = api._hudPool;
    let n = 0;
    for (let i = 0; i < api.active.length; i++) {
      const e = api.active[i];
      if (e.removed) continue;
      let h = pool[n];
      if (!h) { h = { id: '', name: '', classId: '', hpFrac: 1, down: false, look: null, level: 1 }; pool[n] = h; }
      h.id = e.kind; h.name = e.name; h.classId = e.data.classId; h.hpFrac = e.hpMax > 0 ? Math.max(0, Math.min(1, e.hp / e.hpMax)) : 0;
      h.down = !!e.data.down; h.look = e.look; h.level = e.level || 1;
      hud.companions[n] = h;
      n++;
    }
    hud.companions.length = n;
  },
};
