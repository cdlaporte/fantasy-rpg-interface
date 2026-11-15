// Story package: the op / condition registry and runner (CONTRACTS section 11; authoring reference in
// docs/notes/story.md). Each system registers the ops it owns in its init (COMMON rule 10). Unknown ops and
// conditions warn once and are skipped (an unknown condition counts as false); content errors never throw.
//
// An op is `fn(game, action, ctx)` where `action` is the action array after variable substitution
// (`action[0]` is the op name). A condition is `fn(game, cond, ctx) -> bool`.

const IDENT = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;
const BRACE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const MAX_WARNINGS = 100;

/** Promise with a synchronously readable `done` flag (`promise.isDone()`); the story runners poll it. */
export function deferred() {
  let res;
  const promise = new Promise((r) => { res = r; });
  const d = {
    promise, done: false, value: undefined,
    resolve(v) { if (d.done) return; d.done = true; d.value = v; res(v); },
  };
  promise.isDone = () => d.done;
  return d;
}

export function isPromise(v) { return !!v && typeof v.then === 'function'; }

/** Compare helper for conditions: ['>=', '>', '<=', '<', '==', '=', '!=']. */
export function compare(a, op, b) {
  switch (op) {
    case '>=': return a >= b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '<': return a < b;
    case '==': case '=': case '===': return a === b;
    case '!=': case '!==': return a !== b;
    default: return false;
  }
}

/** Is `h` within [a, b) on a 24 h circle (wraps when a > b). */
export function hourIn(h, a, b) {
  if (a === undefined || b === undefined) return true;
  if (a === b) return true;
  return a < b ? h >= a && h < b : h >= a || h < b;
}

function isEntity(v) { return v && typeof v === 'object' && typeof v.id === 'number' && 'kind' in v; }
function isOpList(v) { return Array.isArray(v) && v.length > 0 && Array.isArray(v[0]); }

export default {
  id: 'ops',
  init(game) {
    const actions = new Map();
    const conds = new Map();
    const warned = new Set();

    const playerName = () => (game.player && game.player.data && game.player.data.name) || game.name || 'Hero';

    function warnOnce(key, msg) {
      if (warned.has(key)) return;
      warned.add(key);
      api.warn(msg || key);
    }

    function subStr(s, ctx) {
      const m = IDENT.exec(s);
      if (m) {
        const k = m[1];
        if (k === 'name') return playerName();
        if (k === 'player') return game.player;
        return ctx && k in ctx ? ctx[k] : undefined;
      }
      if (s.indexOf('{') < 0) return s;
      return s.replace(BRACE, (all, k) => {
        if (k === 'name') return playerName();
        const v = ctx ? ctx[k] : undefined;
        return typeof v === 'string' || typeof v === 'number' ? String(v) : all;
      });
    }

    function needsSub(v, depth) {
      if (typeof v === 'string') return v.charCodeAt(0) === 36 || v.indexOf('{') >= 0;
      if (!v || typeof v !== 'object' || depth > 4 || isEntity(v) || isOpList(v)) return false;
      if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) if (needsSub(v[i], depth + 1)) return true; return false; }
      if (Object.getPrototypeOf(v) !== Object.prototype) return false;
      for (const k in v) if (needsSub(v[k], depth + 1)) return true;
      return false;
    }

    function subDeep(v, ctx, depth) {
      if (typeof v === 'string') return subStr(v, ctx);
      if (!v || typeof v !== 'object' || depth > 4 || isEntity(v) || isOpList(v)) return v;
      if (!needsSub(v, depth)) return v;
      if (Array.isArray(v)) return v.map((x) => subDeep(x, ctx, depth + 1));
      if (Object.getPrototypeOf(v) !== Object.prototype) return v;
      const o = {};
      for (const k in v) o[k] = subDeep(v[k], ctx, depth + 1);
      return o;
    }

    /** Substitute an action's arguments (never its name; nested op lists are substituted when they run). */
    function subAction(a, ctx) {
      let need = false;
      for (let i = 1; i < a.length; i++) if (needsSub(a[i], 0)) { need = true; break; }
      if (!need) return a;
      const out = [a[0]];
      for (let i = 1; i < a.length; i++) out.push(subDeep(a[i], ctx, 0));
      return out;
    }

    function normList(list) {
      if (!list) return null;
      if (!Array.isArray(list)) return null;
      if (!list.length) return null;
      if (typeof list[0] === 'string') return [list];   // a single action / condition
      return list;
    }

    function testOne(c, ctx) {
      if (!Array.isArray(c) || typeof c[0] !== 'string') {
        if (Array.isArray(c)) return api.test(c, ctx);    // nested AND list
        warnOnce('cond:bad:' + JSON.stringify(c), 'ops: malformed condition ' + JSON.stringify(c));
        return false;
      }
      const fn = conds.get(c[0]);
      if (!fn) { warnOnce('cond:' + c[0], 'ops: unknown condition "' + c[0] + '" (counts as false)'); return false; }
      try {
        return !!fn(game, subAction(c, ctx), ctx);
      } catch (e) {
        warnOnce('cond:err:' + c[0], 'ops: condition "' + c[0] + '" threw: ' + (e && e.message));
        return false;
      }
    }

    const api = {
      /** Most recent warnings (strings), newest last. Also console.warn'ed and emitted as 'story:warn' {msg}. */
      warnings: [],
      register(name, fn) { actions.set(name, fn); },
      registerCond(name, fn) { conds.set(name, fn); },
      has(name) { return actions.has(name); },
      hasCond(name) { return conds.has(name); },
      warn(msg) {
        api.warnings.push(msg);
        if (api.warnings.length > MAX_WARNINGS) api.warnings.shift();
        if (typeof console !== 'undefined' && !game.quiet) console.warn('[story] ' + msg);
        game.bus.emit('story:warn', { msg });
      },
      warnOnce,

      /** AND of the conditions. Accepts null/[] (true), one condition, or a list. */
      test(list, ctx = {}) {
        const l = normList(list);
        if (!l) return true;
        for (let i = 0; i < l.length; i++) if (!testOne(l[i], ctx)) return false;
        return true;
      },

      /** Run ONE action; returns whatever the op returned (possibly a Promise). Never throws. */
      exec(action, ctx = {}) {
        if (!Array.isArray(action) || typeof action[0] !== 'string') {
          warnOnce('op:bad:' + JSON.stringify(action), 'ops: malformed action ' + JSON.stringify(action));
          return undefined;
        }
        const fn = actions.get(action[0]);
        if (!fn) { warnOnce('op:' + action[0], 'ops: unknown op "' + action[0] + '" (skipped)'); return undefined; }
        try {
          const r = fn(game, subAction(action, ctx), ctx);
          if (isPromise(r)) {
            return r.then((v) => v, (e) => { api.warn('ops: op "' + action[0] + '" rejected: ' + (e && e.message)); });
          }
          return r;
        } catch (e) {
          api.warn('ops: op "' + action[0] + '" threw: ' + (e && e.message));
          return undefined;
        }
      },

      /**
       * Runs actions in order. If an action returns a Promise, the rest wait for it and run() returns a
       * Promise (resolved after the last action); otherwise returns undefined. A Promise result that is not
       * undefined is stored as ctx.chosen (pickers), so a later action can use '$chosen'.
       */
      run(list, ctx = {}) {
        const l = normList(list);
        if (!l) return undefined;
        return runFrom(l, 0, ctx || {});
      },

      /** Variable substitution: '$key' -> ctx[key] ('$name' player name), '{name}' / '{key}' inside strings. */
      sub(v, ctx = {}) { return subDeep(v, ctx, 0); },
      text(s, ctx) { return typeof s === 'string' ? subStr(s, ctx) : s == null ? '' : String(s); },
      playerName,

      /** who -> entity: 'player', entity object, numeric id, '$self'/'self', '@tag' (nearest to the player), kind/npc id. */
      resolveWho(who, ctx) {
        const ents = game.ents;
        if (who == null) return null;
        if (typeof who === 'object') return isEntity(who) && !who.removed ? who : null;
        if (typeof who === 'number') { const e = ents.get(who); return e && !e.removed ? e : null; }
        if (typeof who !== 'string') return null;
        if (who === 'player') return game.player;
        if (who === 'self' || who === '$self' || who === 'npc') {
          const s = ctx && (ctx.self || ctx.npc);
          return s && !s.removed ? s : null;
        }
        const p = game.player;
        const px = p ? p.x : 0, py = p ? p.y : 0;
        let best = null, bd = Infinity;
        const tag = who.charCodeAt(0) === 64 ? who.slice(1) : null;
        const all = ents.all;
        for (let i = 0; i < all.length; i++) {
          const e = all[i];
          if (e.removed || e === p) continue;
          const match = tag ? e.tags && e.tags.indexOf(tag) >= 0
            : e.kind === who || (e.data && e.data.npcId === who) || (e.def && e.def.id === who);
          if (!match) continue;
          const dx = e.x - px, dy = e.y - py, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = e; }
        }
        return best;
      },

      /** Every entity matching who ('@tag' -> all tagged; others -> 0 or 1 entity). */
      resolveAll(who, ctx, out = []) {
        out.length = 0;
        if (typeof who === 'string' && who.charCodeAt(0) === 64) {
          const tag = who.slice(1);
          for (const e of game.ents.all) if (!e.removed && e.tags && e.tags.indexOf(tag) >= 0) out.push(e);
          return out;
        }
        if (Array.isArray(who) && typeof who[0] !== 'number') {
          for (const w of who) { const e = api.resolveWho(w, ctx); if (e && out.indexOf(e) < 0) out.push(e); }
          return out;
        }
        const e = api.resolveWho(who, ctx);
        if (e) out.push(e);
        return out;
      },

      /** Position: [x, y] (world tiles), {x, y}, a marker name, or a who (entity position). null if unknown. */
      resolvePos(v, ctx) {
        if (v == null) return null;
        if (Array.isArray(v) && typeof v[0] === 'number') return { x: v[0], y: v[1] };
        if (typeof v === 'object' && !Array.isArray(v) && typeof v.x === 'number' && !isEntity(v)) return { x: v.x, y: v.y };
        if (typeof v === 'string' && game.world && game.world.marker) {
          const m = game.world.marker(v);
          if (m) return m;
        }
        const e = api.resolveWho(v, ctx);
        return e ? { x: e.x, y: e.y } : null;
      },
    };

    function runFrom(l, i, ctx) {
      for (; i < l.length; i++) {
        const r = api.exec(l[i], ctx);
        if (isPromise(r)) {
          const next = i + 1;
          return r.then((v) => {
            if (v !== undefined) ctx.chosen = v;
            return runFrom(l, next, ctx);
          });
        }
      }
      return undefined;
    }

    // ---- Story-owned conditions (COMMON rule 10) ----
    api.registerCond('flag', (g, c) => (c.length > 2 ? g.flags[c[1]] === c[2] : !!g.flags[c[1]]));
    api.registerCond('not', (g, c, ctx) => {
      if (typeof c[1] === 'string') return !testOne(c.slice(1), ctx);   // ['not', 'flag', 'x'] form
      return !api.test(c[1], ctx);
    });
    // Additions: any (OR), hp, near, zone, daypart, wanted, cutscene.
    api.registerCond('any', (g, c, ctx) => {
      const list = c.length === 2 && isOpList(c[1]) ? c[1] : c.slice(1);
      for (const x of list) if (api.test([x], ctx)) return true;
      return false;
    });
    api.registerCond('hp', (g, c, ctx) => {
      // ['hp', who, op, n]  n <= 1 is a fraction of hpMax only when written as a string like '50%'
      const e = api.resolveWho(c[1], ctx);
      if (!e) return false;
      let n = c[3];
      if (typeof n === 'string' && n.endsWith('%')) n = (parseFloat(n) / 100) * e.hpMax;
      return compare(e.hp, c[2], n);
    });
    api.registerCond('near', (g, c, ctx) => {
      // ['near', who, markerOrWhoOrXY, r=2]
      const e = api.resolveWho(c[1], ctx);
      const p = api.resolvePos(c[2], ctx);
      if (!e || !p) return false;
      const r = c[3] == null ? 2 : c[3];
      const dx = e.x - p.x, dy = e.y - p.y;
      return dx * dx + dy * dy <= r * r;
    });
    api.registerCond('zone', (g, c) => !!g.zone && g.zone.id === c[1]);
    api.registerCond('daypart', (g, c) => !!g.clock && g.clock.daypart === c[1]);
    api.registerCond('wanted', (g) => !!g.flags.wanted);
    api.registerCond('cutscene', (g, c) => {
      const cs = g.sys.cutscene;
      const a = cs && cs.active;
      return c.length > 1 ? a === c[1] : !!a;
    });
    api.registerCond('hour', (g, c) => {
      const h = g.clock ? g.clock.hour : 12;
      if (c[1] === 'between') return hourIn(h, c[2], c[3]);
      return compare(h, c[1], c[2]);
    });

    // ---- Story-owned actions that have no better home ----
    api.register('flag.set', (g, a) => g.setFlag(a[1], a.length > 2 ? a[2] : true));
    api.register('flag.clear', (g, a) => g.setFlag(a[1], false));
    api.register('flag.add', (g, a) => g.setFlag(a[1], (Number(g.flags[a[1]]) || 0) + (a.length > 2 ? Number(a[2]) : 1)));
    api.register('toast', (g, a) => g.toast(a[1] == null ? '' : String(a[1]), a[2] || 'info'));
    api.register('sfx', (g, a) => g.bus.emit('sfx', { id: a[1] }));
    api.register('fx', (g, a, ctx) => {
      const src = a[1];
      if (!src || typeof src !== 'object') return;
      let evt = src;
      if (src.at != null || (src.ent != null && typeof src.ent !== 'number' && !isEntity(src.ent))) {
        evt = Object.assign({}, src);
        if (src.at != null) {
          const p = api.resolvePos(src.at, ctx);
          if (p) { evt.x = p.x + (src.dx || 0); evt.y = p.y + (src.dy || 0); }
        }
        if (src.ent != null && typeof src.ent !== 'number' && !isEntity(src.ent)) {
          const e = api.resolveWho(src.ent, ctx);
          evt.ent = e ? e.id : null;
          if (e && src.at == null && src.x == null) { evt.x = e.x; evt.y = e.y; }
        }
      }
      g.fx(evt);
    });
    // ['if', conds, thenOps, elseOps]
    api.register('if', (g, a, ctx) => (api.test(a[1], ctx) ? api.run(a[2], ctx) : api.run(a[3], ctx)));
    // ['wait', seconds]: sim seconds while the world is not frozen (cutscenes have their own step).
    api.register('wait', (g, a) => {
      const d = deferred();
      let left = Number(a[1]) || 0;
      if (left <= 0) return undefined;
      api._timers.push({ left, d });
      return d.promise;
    });
    api._timers = [];

    return api;
  },
  // The 'wait' op's timers advance only while the world runs (not `always`).
  update(game, dt) {
    const t = game.ops._timers;
    for (let i = t.length - 1; i >= 0; i--) {
      t[i].left -= dt;
      if (t[i].left <= 0) { const d = t[i].d; t.splice(i, 1); d.resolve(); }
    }
  },
};
