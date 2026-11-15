// Story package: quests (CONTRACTS section 11; authoring reference in docs/notes/story.md).
// Def: {id, name, giver, req, companions, steps: [{text, goal}], rewards: {xp, gold, items}, onDone: [ops]}.
// Goals (tracked from bus events): reach {zone, marker, r} | kill {kind|tag, n, zone} | collect {item, n} |
// talk {npc} | interact {id} | boss {kind} | flag {key, value}. A goal may be written {type: 'kill', ...},
// {kill: {...}} or ['kill', {...}]; a step without a goal advances only through ['quest.advance', id].

const GOAL_TYPES = ['reach', 'kill', 'collect', 'talk', 'interact', 'boss', 'flag'];
const REACH_CHECK = 0.25;
const BLIP_CHECK = 0.5;

function normGoal(g) {
  if (!g) return null;
  if (Array.isArray(g)) return typeof g[0] === 'string' ? Object.assign({ type: g[0] }, g[1] || {}) : null;
  if (typeof g !== 'object') return null;
  if (g.type) return g;
  for (const t of GOAL_TYPES) if (g[t] && typeof g[t] === 'object') return Object.assign({ type: t }, g[t]);
  return null;
}

function normItems(items) {
  const out = [];
  if (!items) return out;
  if (Array.isArray(items)) {
    for (const it of items) {
      if (typeof it === 'string') out.push([it, 1]);
      else if (Array.isArray(it)) out.push([it[0], it[1] == null ? 1 : it[1]]);
      else if (it && typeof it === 'object') out.push([it.id || it.item, it.n == null ? 1 : it.n]);
    }
  } else if (typeof items === 'object') for (const k in items) out.push([k, items[k]]);
  else if (typeof items === 'string') out.push([items, 1]);
  return out;
}

export default {
  id: 'quests',
  init(game) {
    const ops = game.ops;
    const qs = {};            // id -> {status: 'active'|'turnin'|'done', step, n, order}
    const pendingTalk = {};   // questId -> step index when a matching conversation opened
    let order = 0;
    const st = { reachT: 0, blipT: 0 };
    const blip = { on: false, x: 0, y: 0 };
    const hudQuest = { id: '', name: '', step: '', progress: '', stepIndex: 0, steps: 0 };
    const goalCache = {};

    const defs = () => game.data.quests || {};
    function def(id) { const d = defs()[id]; return d && typeof d === 'object' ? d : null; }
    function steps(d) { return Array.isArray(d.steps) ? d.steps : []; }
    function goalOf(id) {
      const q = qs[id], d = def(id);
      if (!q || !d || q.status !== 'active') return null;
      const s = steps(d)[q.step];
      if (!s) return null;
      const key = id + ':' + q.step;
      if (!(key in goalCache)) {
        const g = normGoal(s.goal);
        if (s.goal && !g) ops.warnOnce('quest:goal:' + key, 'quests: ' + id + ' step ' + q.step + ' has an unknown goal ' + JSON.stringify(s.goal));
        else if (g && GOAL_TYPES.indexOf(g.type) < 0) ops.warnOnce('quest:goal:' + key, 'quests: ' + id + ' step ' + q.step + ' unknown goal type "' + g.type + '"');
        goalCache[key] = g && GOAL_TYPES.indexOf(g.type) >= 0 ? g : null;
      }
      return goalCache[key];
    }
    function need(g) { return g.n == null ? 1 : Math.max(1, g.n | 0); }
    function zoneOk(g) { return !g.zone || (game.zone && game.zone.id === g.zone); }
    function matchEnt(e, g) {
      if (!e) return false;
      if (g.kind && (e.kind === g.kind || (e.def && e.def.id === g.kind))) return true;
      if (g.tag && e.tags && e.tags.indexOf(g.tag) >= 0) return true;
      return false;
    }
    function nameOf(d) { return d.name || d.id; }

    function companionsFor(d) {
      if (Array.isArray(d.companions)) return d.companions;
      const base = ['warrior', 'mage', 'rogue'];
      const cls = game.sys.progression && game.sys.progression.classId;
      let root = cls;
      const specs = game.data.specs || {};
      if (cls && specs[cls] && specs[cls].parent) root = specs[cls].parent;
      return base.filter((c) => c !== root).slice(0, 2);
    }

    function start(id) {
      const d = def(id);
      if (!d) { ops.warnOnce('quest:' + id, 'quests: unknown quest "' + id + '"'); return false; }
      if (qs[id]) return false;
      if (d.req && !ops.test(d.req, {})) return false;
      if (!d.id) d.id = id;
      qs[id] = { status: 'active', step: 0, n: 0, order: ++order };
      api.tracked = id;
      if (d.companions) {
        const c = game.sys.companions;
        if (!c || !c.active || !c.active.length) {
          if (ops.has('companions')) ops.exec(['companions', companionsFor(d)]);
          else if (c && c.set) c.set(companionsFor(d));
        }
      }
      game.toast('New quest: ' + nameOf(d), 'quest');
      game.bus.emit('quest:started', { id });
      game.bus.emit('sfx', { id: 'ui_ok' });
      if (!steps(d).length) { complete(id); return true; }
      checkNow(id);
      st.blipT = BLIP_CHECK;
      return true;
    }

    function advance(id, fromStep) {
      const q = qs[id], d = def(id);
      if (!q || !d || q.status !== 'active') return false;
      if (fromStep != null && fromStep !== q.step) return false;
      delete pendingTalk[id];
      const list = steps(d);
      if (q.step >= list.length - 1) {
        const g = goalOf(id);
        complete(id, g && g.type === 'talk');
        return true;
      }
      q.step++; q.n = 0;
      const s = list[q.step];
      game.bus.emit('quest:step', { id, step: q.step });
      if (s && s.text) game.toast(nameOf(d) + ': ' + ops.text(s.text, {}), 'quest');
      checkNow(id);
      st.blipT = BLIP_CHECK;
      return true;
    }

    function complete(id, turnin) {
      const q = qs[id] || (qs[id] = { status: 'active', step: 0, n: 0, order: ++order });
      const d = def(id);
      if (!d || q.status === 'done' || q.status === 'turnin') return false;
      const gates = game.sys.gates;
      if (turnin && gates && typeof gates.ask === 'function') {
        q.status = 'turnin';
        let r;
        try { r = gates.ask({ context: 'quest_turnin', difficulty: d.difficulty || 1, tags: d.tags || [], optional: true }); } catch (e) { r = null; }
        if (r && typeof r.then === 'function') {
          r.then((res) => finalize(id, res && res.correct ? 1.25 : 1), () => finalize(id, 1));
          return true;
        }
        finalize(id, r && r.correct ? 1.25 : 1);
        return true;
      }
      finalize(id, 1);
      return true;
    }

    function finalize(id, mult) {
      const q = qs[id], d = def(id);
      if (!q || !d || q.status === 'done') return;
      q.status = 'done';
      q.step = steps(d).length;
      const rw = d.rewards || {};
      const acts = [];
      if (rw.xp) acts.push(['xp', Math.round(rw.xp * mult)]);
      if (rw.gold) acts.push(['gold', Math.round(rw.gold * mult)]);
      for (const [it, n] of normItems(rw.items)) if (it) acts.push(['give', it, n]);
      if (api.tracked === id) api.tracked = nextTracked();
      game.toast('Quest complete: ' + nameOf(d) + (mult > 1 ? ' (bonus!)' : ''), 'quest');
      game.bus.emit('quest:done', { id, bonus: mult > 1 });
      ops.run(acts, {});
      ops.run(d.onDone, {});
      st.blipT = BLIP_CHECK;
    }

    function nextTracked() {
      let best = null, bo = -1;
      for (const k in qs) if (qs[k].status === 'active' && qs[k].order > bo) { bo = qs[k].order; best = k; }
      return best;
    }

    function bump(id, g, amount) {
      const q = qs[id];
      q.n = amount;
      if (q.n >= need(g)) advance(id, q.step);
      else game.bus.emit('quest:progress', { id, step: q.step, n: q.n, of: need(g) });
    }

    /** Goals that can already be true (collect, flag, reach). */
    function checkNow(id) {
      const g = goalOf(id);
      if (!g) return;
      const q = qs[id];
      switch (g.type) {
        case 'collect': {
          const inv = game.sys.inventory;
          const c = inv && inv.count ? inv.count(g.item) : 0;
          if (c >= need(g)) advance(id, q.step); else if (c !== q.n) q.n = c;
          break;
        }
        case 'flag':
          if (flagOk(g)) advance(id, q.step);
          break;
        case 'reach':
          if (reachOk(g)) advance(id, q.step);
          break;
        default: break;
      }
    }
    function flagOk(g) { const k = g.key || g.flag; return g.value !== undefined ? game.flags[k] === g.value : !!game.flags[k]; }
    function reachOk(g) {
      if (!game.zone || !game.player) return false;
      if (g.zone && game.zone.id !== g.zone) return false;
      const p = ops.resolvePos(g.marker || g.at || (g.x != null ? [g.x, g.y] : null), {});
      if (!p) return !!g.zone && !g.marker && !g.at;   // reach a zone
      const r = g.r == null ? 2.5 : g.r;
      const dx = game.player.x - p.x, dy = game.player.y - p.y;
      return dx * dx + dy * dy <= r * r;
    }

    function each(type, fn) {
      for (const id in qs) {
        if (qs[id].status !== 'active') continue;
        const g = goalOf(id);
        if (g && g.type === type) fn(id, g, qs[id]);
      }
    }

    game.bus.on('death', (ev) => {
      const e = ev && ev.ent;
      if (!e || e.type === 'player') return;
      each('kill', (id, g, q) => { if (zoneOk(g) && matchEnt(e, g)) bump(id, g, q.n + 1); });
      each('boss', (id, g, q) => { if (matchEnt(e, g.kind ? g : { kind: g.boss || g.id, tag: g.tag })) advance(id, q.step); });
    });
    game.bus.on('item:gained', (ev) => {
      each('collect', (id, g, q) => {
        if (ev && ev.id && ev.id !== g.item) return;
        const inv = game.sys.inventory;
        const c = inv && inv.count ? inv.count(g.item) : q.n + ((ev && ev.n) || 1);
        bump(id, g, c);
      });
    });
    game.bus.on('flag', () => { each('flag', (id, g, q) => { if (flagOk(g)) advance(id, q.step); }); });
    game.bus.on('interact', (ev) => {
      const e = ev && ev.ent;
      if (!e || ev.noQuest) return;
      each('interact', (id, g, q) => {
        const want = g.id || g.kind;
        if (e.id === want || e.kind === want || (e.def && e.def.id === want) || (e.data && e.data.propId === want)
          || (e.tags && e.tags.indexOf(want) >= 0)) advance(id, q.step);
      });
      // talking to an NPC that has no dialogue (e.g. a pure shopkeeper)
      if (e.data && e.data.npcId && !(e.def && e.def.dialogue)) {
        each('talk', (id, g, q) => { if (g.npc === e.data.npcId || g.npc === e.kind) advance(id, q.step); });
      }
    });
    function talkMatch(g, ev) {
      if (g.dialogue && ev.id !== g.dialogue) return false;
      if (!g.npc) return !!g.dialogue;
      const n = ev.npc;
      return !!n && (n.kind === g.npc || (n.data && n.data.npcId === g.npc));
    }
    game.bus.on('dialogue:open', (ev) => {
      each('talk', (id, g, q) => { if (talkMatch(g, ev)) pendingTalk[id] = q.step; });
    });
    game.bus.on('dialogue:close', (ev) => {
      each('talk', (id, g, q) => {
        if (pendingTalk[id] === q.step && talkMatch(g, ev)) { delete pendingTalk[id]; advance(id, q.step); }
      });
    });

    const api = {
      tracked: null,
      start, advance,
      /** Finish a quest now (rewards + onDone; no turn-in question). Used by debug.completeQuest. */
      complete(id) { return complete(id, false); },
      /** 'none' | 'active' | 'done' */
      state(id) { const q = qs[id]; return !q ? 'none' : q.status === 'done' ? 'done' : 'active'; },
      /** Current step index (-1 when not started, steps.length when done). */
      step(id) { const q = qs[id]; return q ? q.step : -1; },
      progress(id) { const q = qs[id]; return q ? q.n : 0; },
      track(id) { if (qs[id] && qs[id].status === 'active') api.tracked = id; },
      active() { return Object.keys(qs).filter((k) => qs[k].status !== 'done'); },
      done() { return Object.keys(qs).filter((k) => qs[k].status === 'done'); },
      goal(id) { return goalOf(id); },
      /** Current quest-blip target {on, x, y} (also appended to HudState.minimap.blips as type 'quest'). */
      blip,
      _qs: qs,
      _reset() { for (const k in qs) delete qs[k]; api.tracked = null; },
    };

    ops.register('quest.start', (g, a) => { start(a[1]); });
    ops.register('quest.advance', (g, a) => { advance(a[1], a.length > 2 && typeof a[2] === 'number' ? a[2] : undefined); });
    ops.register('quest.complete', (g, a) => { complete(a[1], false); });
    ops.register('quest.track', (g, a) => { api.track(a[1]); });
    ops.registerCond('quest', (g, c) => {
      const q = qs[c[1]];
      const s = !q ? 'none' : q.status === 'done' ? 'done' : 'active';
      const what = c[2];
      if (what == null || what === 'started') return s !== 'none';
      if (what === 'step') return s === 'active' && q.step === c[3];
      if (what === 'atLeast' || what === 'step>=') return s === 'done' || (s === 'active' && q.step >= c[3]);
      return s === what;
    });

    function exitToward(zoneId) {
      const ex = (game.zone && game.zone.def && game.zone.def.exits) || [];
      for (const x of ex) if (x.to === zoneId) { const p = game.world.marker(x.at); if (p) return p; }
      return null;
    }
    function targetFor(g) {
      const here = game.zone ? game.zone.id : null;
      const hintZone = g.zone || null;
      if (hintZone && hintZone !== here) return exitToward(hintZone);
      if (g.type === 'talk' && g.npc) {
        const e = ops.resolveWho(g.npc, {});
        if (e) return e;
        const w = game.sys.npc && game.sys.npc.whereIs ? game.sys.npc.whereIs(g.npc) : null;
        if (w && w.zone && w.zone !== here) return exitToward(w.zone);
        return w && w.at ? game.world.marker(w.at) : null;
      }
      if (g.marker || g.at) return game.world.marker(g.marker || g.at);
      if (g.type === 'kill' || g.type === 'boss' || g.type === 'interact') {
        const want = g.kind || g.id || null;
        let best = null, bd = Infinity;
        const p = game.player;
        for (const e of game.ents.all) {
          if (e.removed || e === p) continue;
          const ok = g.type === 'interact' ? e.kind === want || e.id === want || (e.data && e.data.propId === want) : matchEnt(e, g);
          if (!ok) continue;
          const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
          if (d < bd) { bd = d; best = e; }
        }
        if (best) return best;
        if (g.type === 'interact' && game.zone) {
          for (const pr of game.zone.props || []) if (pr.id === want) return { x: pr.x + (pr.w || 1) / 2, y: pr.y + (pr.h || 1) / 2 };
        }
      }
      return null;
    }

    api._update = (dt) => {
      st.reachT += dt;
      if (st.reachT >= REACH_CHECK) {
        st.reachT = 0;
        each('reach', (id, g, q) => { if (reachOk(g)) advance(id, q.step); });
      }
      st.blipT += dt;
      if (st.blipT >= BLIP_CHECK) {
        st.blipT = 0;
        if (api.tracked && (!qs[api.tracked] || qs[api.tracked].status === 'done')) api.tracked = nextTracked();
        if (!api.tracked) api.tracked = nextTracked();
        const g = api.tracked ? goalOf(api.tracked) : null;
        const t = g ? targetFor(g) : null;
        blip.on = !!t;
        if (t) { blip.x = t.x; blip.y = t.y; }
      }
    };

    api._hud = (hud) => {
      const id = api.tracked;
      const q = id && qs[id];
      const d = id && def(id);
      if (!q || !d || q.status === 'done') { hud.quest = null; return; }
      const list = steps(d);
      const s = list[Math.min(q.step, list.length - 1)];
      const g = goalOf(id);
      hudQuest.id = id;
      hudQuest.name = nameOf(d);
      hudQuest.stepIndex = q.step;
      hudQuest.steps = list.length;
      const text = s ? s.text || '' : '';
      if (hudQuest._raw !== text) { hudQuest._raw = text; hudQuest.step = ops.text(text, {}); }
      const n = g ? need(g) : 1;
      const prog = g && (g.type === 'kill' || g.type === 'collect') && n > 1 ? Math.min(q.n, n) + '/' + n : '';
      if (hudQuest.progress !== prog) hudQuest.progress = prog;
      hud.quest = hudQuest;
    };
    api._blipHud = (hud) => {
      const mm = hud.minimap;
      if (!mm || !mm.blips) return;
      let idx = mm.blipCount | 0;
      if (st.myIdx != null && idx === st.myIdx + 1 && mm.blips[st.myIdx] === st.myBlip) idx = st.myIdx;   // nobody reset the list
      if (!blip.on || !api.tracked) {
        if (idx === st.myIdx && st.myIdx != null) mm.blipCount = idx;
        st.myIdx = null;
        return;
      }
      let b = mm.blips[idx];
      if (!b) { b = { x: 0, y: 0, type: 'quest' }; mm.blips[idx] = b; }
      b.x = blip.x; b.y = blip.y; b.type = 'quest';
      mm.blipCount = idx + 1;
      st.myIdx = idx; st.myBlip = b;
    };

    api._save = () => {
      const out = {};
      for (const k in qs) out[k] = { status: qs[k].status === 'turnin' ? 'active' : qs[k].status, step: qs[k].step, n: qs[k].n, order: qs[k].order };
      return { q: out, tracked: api.tracked };
    };
    api._load = (j) => {
      if (!j || !j.q) return;
      for (const k in qs) delete qs[k];
      for (const k in j.q) {
        const v = j.q[k];
        qs[k] = { status: v.status === 'done' ? 'done' : 'active', step: v.step | 0, n: v.n | 0, order: v.order | 0 };
        if (qs[k].order > order) order = qs[k].order;
      }
      api.tracked = j.tracked && qs[j.tracked] ? j.tracked : nextTracked();
    };
    return api;
  },
  update(game, dt) { game.quests._update(dt); },
  save(game) { return game.quests._save(); },
  load(game, json) { game.quests._load(json); },
  hud(game, hud) { game.quests._hud(hud); game.quests._blipHud(hud); },
};
