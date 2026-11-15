// STUB: replaced by the Story package
// Op registry + dispatch. Conditions are AND-ed. Only 'flag'/'not' conditions and 'flag.set'/'toast'/'fx' actions here.
export default {
  id: 'ops',
  init(game) {
    const actions = new Map();
    const conds = new Map();
    const api = {
      register(name, fn) { actions.set(name, fn); },
      registerCond(name, fn) { conds.set(name, fn); },
      has(name) { return actions.has(name); },
      test(list, ctx = {}) {
        if (!list || !list.length) return true;
        for (const c of list) {
          const fn = conds.get(c[0]);
          if (!fn) { if (!api.warned) { api.warned = true; } return false; }
          if (!fn(game, c, ctx)) return false;
        }
        return true;
      },
      /** Runs actions in order. If an action returns a Promise, the rest wait for it and run() returns a Promise. */
      run(list, ctx = {}) {
        if (!list || !list.length) return undefined;
        for (let i = 0; i < list.length; i++) {
          const a = list[i];
          const fn = actions.get(a[0]);
          if (!fn) continue;
          const r = fn(game, a, ctx);
          if (r && typeof r.then === 'function') {
            const rest = list.slice(i + 1);
            return r.then(() => api.run(rest, ctx));
          }
        }
        return undefined;
      },
    };
    api.registerCond('flag', (g, c) => (c.length > 2 ? g.flags[c[1]] === c[2] : !!g.flags[c[1]]));
    api.registerCond('not', (g, c, ctx) => !api.test([c[1]], ctx));
    api.register('flag.set', (g, a) => g.setFlag(a[1], a.length > 2 ? a[2] : true));
    api.register('toast', (g, a) => g.toast(a[1], a[2]));
    api.register('fx', (g, a) => g.fx(a[1]));
    return api;
  },
};
