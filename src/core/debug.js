// Meta package. The __game debug API (CONTRACTS 12). main.js exposes it as window.__game when debug=1 or test=1.
// No DOM here: main.js attaches a host {renderFrame(), snapshot() -> dataURL, renderer(), setRenderer(id)} via attachHost().
// Scenarios use the ids in docs/STORY.md and tolerate missing content: they fall back to the `test` zone and
// return {ok: false, missing: [...]} instead of throwing.
import { DT } from '../contracts.js';
import { scriptedInput } from '../platform/input.js';

const COMPANION_OF = { warrior: ['mage', 'rogue'], mage: ['warrior', 'rogue'], rogue: ['warrior', 'mage'] };
const DEFAULT_SPEC = { warrior: 'knight', mage: 'sorcerer', rogue: 'archer' };
const STORY_FLAGS = {
  intro: [],
  stick: ['has_stick'],
  tutorial: ['has_stick', 'tutorial_done'],
  ambush: ['has_stick', 'tutorial_done', 'ambush_done'],
  rescued: ['has_stick', 'tutorial_done', 'ambush_done', 'look_chosen', 'intro_done'],
  town: ['has_stick', 'tutorial_done', 'ambush_done', 'look_chosen', 'intro_done', 'town_seen'],
  classed: ['has_stick', 'tutorial_done', 'ambush_done', 'look_chosen', 'intro_done', 'town_seen', 'class_chosen', 'forest_open'],
};

export default {
  id: 'debug',
  always: true,
  init(game) {
    const sticky = scriptedInput();
    const errs = [];
    let host = null;
    let god = false;
    let baseline = null;     // fresh systems snapshot, taken lazily for reset()

    const D = () => game.data || {};
    const zoneOk = (id) => { const z = (D().zones || {})[id]; return !!(z && z.id); };
    const kindOk = (id) => !!((D().enemies || {})[id] || (D().npcs || {})[id]);
    const S = (id) => game.sys[id] || {};

    function summary(e) {
      return { id: e.id, kind: e.kind, type: e.type, team: e.team, name: e.name, x: e.x, y: e.y, hp: e.hp, hpMax: e.hpMax,
        alive: e.alive, anim: e.anim, tags: e.tags ? e.tags.slice() : [] };
    }

    function clearTransient() {
      if (game.modal) game.closeModal(undefined);
      const cs = S('cutscene');
      if (cs.active && cs.skip) { try { cs.skip(); } catch { /* stub */ } }
      game.freeze.delete('pause');
    }

    function load(zone, marker, missing) {
      let z = zone;
      if (!zoneOk(z)) { missing.push('zone:' + zone); z = game.config.fallbackZone || 'test'; marker = 'start'; }
      game.world.loadZone(z, marker);
      if (marker && typeof marker === 'string' && !game.world.marker(marker)) missing.push(`marker:${z}.${marker}`);
      game.snapCamera();
      return z;
    }

    function setFlags(list) {
      for (const k of Object.keys(game.flags)) delete game.flags[k];
      for (const k of list) game.setFlag(k, true);
    }

    function setupPlayer({ level = 1, classId = null, specId = null }) {
      const pr = S('progression');
      if (pr.reset) pr.reset();
      if (pr.setLevel) pr.setLevel(level, { quiet: true, boons: false });
      if (classId && pr.setClass) pr.setClass(classId, { quiet: true });
      if (specId && pr.setSpec) pr.setSpec(specId, { quiet: true });
      if (pr) { pr.pendingSpec = !!(classId && !specId && level >= 8); }
      if (pr.refreshLook) pr.refreshLook();
      const p = game.player;
      if (p) p.hp = p.hpMax;
    }

    function play(id, missing, opts) {
      if (opts && opts.cutscene === false) return false;
      const cs = D().cutscenes || {};
      if (!cs[id]) { missing.push('cutscene:' + id); return false; }
      const c = S('cutscene');
      if (c.play) { const r = c.play(id); if (r && r.catch) r.catch((e) => api.logError('cutscene ' + id + ': ' + e)); }
      return true;
    }

    function spawnOne(kind, x, y, opts, missing) {
      const ents = game.ents;
      let k = kind;
      if (!kindOk(k)) {
        if (missing && !missing.includes('kind:' + kind)) missing.push('kind:' + kind);
        k = 'rat';
        if (!kindOk(k)) return null;
      }
      return ents.spawn(k, x, y, opts || {});
    }

    function ring(kind, n, r, missing, opts) {
      const p = game.player;
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const e = spawnOne(kind, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, opts, missing);
        if (e) out.push(e);
      }
      return out;
    }

    function disableAi(e) {
      e.data = e.data || {};
      e.data.scripted = true;
      e.data.noAi = true;
      e.ai = null;
      e.interact = e.interact || null;
    }

    function companionsFor(classId) {
      const c = S('companions');
      if (c.set && COMPANION_OF[classId]) { try { c.set(COMPANION_OF[classId]); } catch (e) { api.logError(String(e)); } }
    }

    function result(id, missing, zone, extra) {
      game.snapCamera();
      return Object.assign({ ok: missing.length === 0, id, zone, missing }, extra || {});
    }

    // ---------- scenarios ----------
    const SCENARIOS = {
      intro_start(o, m) {
        setFlags(STORY_FLAGS.intro);
        setupPlayer({ level: 1 });
        const z = load('intro', 'start', m);
        play('intro_wake', m, o);
        return result('intro_start', m, z);
      },
      ambush(o, m) {
        setFlags(STORY_FLAGS.tutorial);
        setupPlayer({ level: 3 });
        const z = load('intro', 'clearing', m);
        play('ambush', m, o);
        return result('ambush', m, z);
      },
      rescued(o, m) {
        setFlags(STORY_FLAGS.ambush);
        setupPlayer({ level: 3 });
        const z = load('intro', 'clearing', m);
        if (game.player) game.player.hp = 1;
        play('rescue', m, o);
        return result('rescued', m, z);
      },
      town(o, m) {
        setFlags(STORY_FLAGS.rescued);
        setupPlayer({ level: 3 });
        const z = load('town', 'gate_south', m);
        play('town_arrival', m, o);
        return result('town', m, z);
      },
      academy_pick(o, m) {
        setFlags(STORY_FLAGS.town);
        setupPlayer({ level: 3 });
        const z = load('academy', 'hall', m);
        if (!play('class_pick', m, o) && o.picker !== false) { const pr = S('progression'); if (pr.openClassPicker) pr.openClassPicker(); }
        return result('academy_pick', m, z);
      },
      forest(o, m) {
        const classId = o.classId || 'warrior';
        setFlags(STORY_FLAGS.classed);
        setupPlayer({ level: o.level || 5, classId, specId: o.specId || null });
        const z = load('forest', 'entry_town', m);
        companionsFor(classId);
        return result('forest', m, z);
      },
      forest_boss(o, m) {
        const classId = o.classId || 'warrior';
        setFlags(STORY_FLAGS.classed.concat(['spec_ready', 'spec_ceremony_done', 'gate_grove_seal']));
        setupPlayer({ level: o.level || 10, classId, specId: o.specId || DEFAULT_SPEC[classId] });
        const z = load('forest', 'boss_arena', m);
        companionsFor(classId);
        if (!play('forest_boss_intro', m, o)) {
          const p = game.player;
          const boss = spawnOne('old_mossback', p.x, p.y - 5, {}, m);
          if (boss && boss.kind !== 'old_mossback') { boss.tags.push('boss'); }
        }
        return result('forest_boss', m, z);
      },
      gallery(o, m) {
        setupPlayer({ level: o.level || 1 });
        const z = load('test', 'start', m);
        api.god(true);
        for (const e of game.ents.all.slice()) if (e.type === 'enemy' || e.type === 'npc') game.ents.remove(e);
        if (game.ents.flush) game.ents.flush();
        const rows = [['enemy', Object.keys(D().enemies || {})], ['npc', Object.keys(D().npcs || {})]];
        const spawned = [];
        const cols = 10, dx = 3.2, dy = 3.4, x0 = 3.5;
        let row = 0;
        for (const [label, ids] of rows) {
          if (!ids.length) { m.push(label + ':none'); continue; }
          for (let i = 0; i < ids.length; i++) {
            const x = x0 + (i % cols) * dx, y = 2.5 + (row + Math.floor(i / cols)) * dy;
            const e = game.ents.spawn(ids[i], x, y, { name: `${((D()[label === 'enemy' ? 'enemies' : 'npcs'] || {})[ids[i]] || {}).name || ids[i]} [${ids[i]}]` });
            if (!e) continue;
            disableAi(e);
            e.asleep = false;
            e.data.galleryRow = label;
            spawned.push(e.id);
          }
          row += Math.ceil(ids.length / cols);
        }
        const p = game.player;
        if (p) { p.x = p.px = 18; p.y = p.py = Math.min(game.zone.h - 2, 2.5 + row * dy + 1); }
        return result('gallery', m, z, { spawned });
      },
      stress(o, m) {
        setupPlayer({ level: o.level || 5, classId: o.classId || 'warrior' });
        const z = load('test', 'start', m);
        api.god(true);
        const p = game.player;
        p.x = p.px = 20; p.y = p.py = 15;
        const kinds = Object.keys(D().enemies || {}).filter((k) => { const e = D().enemies[k]; return !e.boss && k !== 'training_dummy'; });
        const list = kinds.length ? kinds : ['rat'];
        const n = o.enemies || 24;
        const enemies = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, r = 4 + (i % 3) * 2;
          const e = spawnOne(list[i % list.length], p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, {}, m);
          if (e) enemies.push(e.id);
        }
        const c = S('combat');
        const nproj = o.projectiles || 40;
        let projectiles = 0;
        for (let i = 0; i < nproj; i++) {
          const src = game.ents.get(enemies[i % Math.max(1, enemies.length)]) || p;
          const ang = (i / nproj) * Math.PI * 2;
          let pr = null;
          if (c.projectile) {
            try { pr = c.projectile(src, { angle: ang, speed: 5, range: 12, dmg: 0.5, radius: 0.15, look: { rig: 'projectile', model: 'orb', color: '#ff7a2f', glow: '#ffd24a', size: 1, trail: true } }); } catch { pr = null; }
          }
          if (!pr) {
            pr = game.ents.create({ kind: 'projectile', type: 'projectile', team: src.team, owner: src.id, x: src.x, y: src.y,
              vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5, angle: ang, radius: 0.15, solid: false, ttl: 3,
              look: { rig: 'projectile', model: 'orb', color: '#ff7a2f', glow: '#ffd24a', size: 1, trail: true } });
          }
          if (pr) projectiles++;
        }
        return result('stress', m, z, { enemies: enemies.length, projectiles });
      },
      class_demo(o, m) {
        const classId = o.classId || 'warrior';
        const level = o.level || 12;
        const specId = o.specId === undefined ? (level >= 8 ? DEFAULT_SPEC[classId] : null) : o.specId;
        setFlags(STORY_FLAGS.classed.concat(specId ? ['spec_ready', 'spec_ceremony_done'] : []));
        setupPlayer({ level, classId, specId });
        const z = load('test', 'start', m);
        api.god(true);
        const p = game.player;
        p.x = p.px = 20; p.y = p.py = 15;
        for (const e of game.ents.all.slice()) if (e.type === 'enemy') game.ents.remove(e);
        if (game.ents.flush) game.ents.flush();
        const kind = kindOk('training_dummy') ? 'training_dummy' : 'rat';
        if (kind !== 'training_dummy') m.push('kind:training_dummy');
        const dummies = ring(kind, o.n || 8, o.r || 3, null, {});
        if (kind === 'rat') for (const d of dummies) disableAi(d);
        const pr = S('progression');
        const abilities = pr.abilityList ? pr.abilityList().filter((a) => a.unlock <= level).map((a) => a.slot) : [];
        return result('class_demo', m, z, { classId, specId, level, dummies: dummies.map((d) => d.id), abilities });
      },
    };

    // ---------- api ----------
    const api = {
      ready: false,
      game,
      attachHost(h) { host = h; },
      logError(msg) { errs.push(String(msg)); },
      errors() { return errs.slice(); },
      state() {
        const p = game.player;
        const pr = S('progression'), inv = S('inventory'), g = S('gates');
        return {
          t: game.t, tick: game.tick, zone: game.zone && game.zone.id, modal: game.modal && game.modal.type,
          freeze: [...game.freeze], flags: Object.assign({}, game.flags), entCount: game.ents.all.length,
          player: p ? { x: p.x, y: p.y, hp: p.hp, hpMax: p.hpMax, dir: p.dir, anim: p.anim,
            stats: Object.assign({}, p.stats), lookRev: p.lookRev } : null,
          camera: { x: game.camera.x, y: game.camera.y, zoom: game.camera.zoom },
          level: pr.level, xp: pr.xp, xpNext: pr.xpNext, classId: pr.classId || null, specId: pr.specId || null,
          rank: pr.rank ? pr.rank() : 1, boons: pr.boons ? pr.boons.slice() : [], pendingBoons: pr.pendingBoons || 0,
          pendingSpec: !!pr.pendingSpec, gold: inv.gold || 0, items: Object.assign({}, inv.items || {}),
          hotbar: inv.hotbar ? inv.hotbar.slice() : [], question: g.pending ? g.pending() : null,
          quest: S('quests').tracked || null, hour: S('clock').hour, god,
          cutscene: S('cutscene').active ? (S('cutscene').active.id || S('cutscene').active) : null,
        };
      },
      input(partial) { sticky.set(partial || {}); return api; },
      step(n = 1, input) {
        if (input) sticky.set(input);
        for (let i = 0; i < n; i++) game.step(DT, sticky.sample());
        if (host && host.renderFrame) host.renderFrame();
        return api.state();
      },
      scenario(id, ...args) {
        const fn = SCENARIOS[id];
        const missing = [];
        if (!fn) return { ok: false, id, missing: ['scenario:' + id] };
        let opts = args[0];
        if (id === 'class_demo' && typeof opts === 'string') opts = { classId: args[0], specId: args[1], level: args[2] };
        opts = opts && typeof opts === 'object' ? opts : {};
        try {
          clearTransient();
          return fn(opts, missing);
        } catch (e) {
          api.logError(`scenario ${id}: ${e && (e.stack || e)}`);
          missing.push('error:' + (e && e.message));
          try { if (!game.zone) load('test', 'start', missing); } catch { /* nothing more to do */ }
          return { ok: false, id, zone: game.zone && game.zone.id, missing };
        }
      },
      class_demo(classId, specId, level) { return api.scenario('class_demo', { classId, specId, level }); },
      scenarios() { return Object.keys(SCENARIOS); },
      teleport(zone, markerOrXY) {
        if (zone && zone !== (game.zone && game.zone.id)) {
          if (!zoneOk(zone)) return Object.assign(api.state(), { ok: false, missing: ['zone:' + zone] });
          game.world.loadZone(zone, markerOrXY);
        } else {
          const at = game.world.resolve ? game.world.resolve(markerOrXY) : game.world.marker(markerOrXY);
          if (at && game.player) { game.player.x = game.player.px = at.x; game.player.y = game.player.py = at.y; game.snapCamera(); }
        }
        return api.state();
      },
      setLevel(n) { const pr = S('progression'); if (pr.setLevel) pr.setLevel(n); return pr.level; },
      setClass(id) { const pr = S('progression'); return pr.setClass ? pr.setClass(id) : false; },
      setSpec(id) { const pr = S('progression'); return pr.setSpec ? pr.setSpec(id) : false; },
      giveItem(id, n = 1) { const inv = S('inventory'); return inv.give ? inv.give(id, n) : 0; },
      giveGold(n) { const inv = S('inventory'); return inv.addGold ? inv.addGold(n) : 0; },
      setFlag(k, v = true) { game.setFlag(k, v); },
      god(on = true) {
        god = !!on;
        const p = game.player;
        if (p) {
          if (god) { p.hp = p.hpMax; p.status.invuln = Math.max(p.status.invuln || 0, 1); }
          else p.status.invuln = 0;
          p.data.god = god;
        }
        return god;
      },
      spawn(kind, n = 1, x, y) {
        const p = game.player;
        const out = [];
        for (let i = 0; i < n; i++) {
          let sx = x, sy = y;
          if (sx === undefined || sy === undefined) {
            const a = (i / Math.max(1, n)) * Math.PI * 2;
            sx = p.x + Math.cos(a) * 3; sy = p.y + Math.sin(a) * 3;
          } else if (n > 1) { sx += (i % 4) * 0.8; sy += Math.floor(i / 4) * 0.8; }
          const e = game.ents.spawn(kind, sx, sy, {});
          if (e) out.push(e.id);
        }
        return out;
      },
      killAll(filter) {
        const c = S('combat');
        let n = 0;
        for (const e of game.ents.all.slice()) {
          if (e.type !== 'enemy' || e.removed || !e.alive) continue;
          if (filter && e.kind !== filter && !(e.tags || []).includes(filter)) continue;
          if (c.kill) c.kill(e, game.player); else game.ents.remove(e);
          if (!e.removed && !e.alive) game.ents.remove(e);
          n++;
        }
        return n;
      },
      find(kindOrType) {
        const out = [];
        for (const e of game.ents.all) {
          if (e.removed) continue;
          if (!kindOrType || e.kind === kindOrType || e.type === kindOrType || (e.tags || []).includes(kindOrType)) out.push(summary(e));
        }
        return out;
      },
      startCutscene(id) { const c = S('cutscene'); return c.play ? c.play(id) : null; },
      skipCutscene() { const c = S('cutscene'); if (c.skip) c.skip(); return true; },
      completeQuest(id) {
        const q = S('quests');
        if (q.complete) return q.complete(id);
        if (q.state && q.state(id) === 'none' && q.start) q.start(id);
        for (let i = 0; i < 32 && q.state && q.state(id) !== 'done' && q.advance; i++) q.advance(id);
        return q.state ? q.state(id) : null;
      },
      setTime(h) { const c = S('clock'); if (c.set) c.set(h); return c.hour; },
      /** Resolve the pending question (stub/custom mode) without DOM. */
      answerQuestion(correct = true) { const g = S('gates'); return g.answer ? g.answer(correct) : false; },
      closeModal() { game.closeModal(); },
      command(name, ...args) { const fn = game.commands[name]; return fn ? fn(...args) : undefined; },
      setRenderer(id) { return host && host.setRenderer ? host.setRenderer(id) : null; },
      renderStats() { const r = host && host.renderer && host.renderer(); return r ? r.stats() : null; },
      snapshot() { return host && host.snapshot ? host.snapshot() : null; },
      save() { return S('save').now ? S('save').now() : null; },
      load(name) {
        const s = S('save');
        const json = s.load ? s.load(name) : null;
        if (!json || !s.restore) return false;
        return s.restore(json);
      },
      /** Back to a fresh game state (same seed and name), at the start zone. */
      reset() {
        clearTransient();
        for (const k of Object.keys(game.flags)) delete game.flags[k];
        if (baseline) game.loadSystems(JSON.parse(JSON.stringify(baseline)));
        const pr = S('progression'), inv = S('inventory');
        if (pr.reset) pr.reset();
        if (inv.reset) inv.reset();
        god = false;
        const start = zoneOk(game.config.startZone) ? game.config.startZone : game.config.fallbackZone;
        game.world.loadZone(start, game.config.startMarker);
        game.snapCamera();
        return api.state();
      },
    };

    // fresh-state snapshot for reset(), after every system has initialized
    game.bus.once('zone:load', () => { try { baseline = game.saveSystems(); } catch { baseline = null; } });

    api._update = () => {
      if (!god) return;
      const p = game.player;
      if (!p) return;
      if (p.hp < p.hpMax) p.hp = p.hpMax;
      if (!(p.status.invuln > 0.5)) p.status.invuln = 1;
    };
    return api;
  },
  update(game) { game.sys.debug._update(); },
};
