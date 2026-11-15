// Meta package. gates: the only caller of the question provider (CONTRACTS 12).
//
// gates.ask({context, difficulty, tags, optional, blocking}) -> Promise<{correct, skipped}>
//  - emits 'gate:ask' {req}; context disabled or questions mode 'off' -> resolves at once:
//    {correct: true, skipped: true}, or {correct: false, skipped: true} for `optional` requests (they are skipped).
//  - mode 'auto' -> resolves {correct: true, skipped: false} with no UI and no freeze.
//  - otherwise (mode 'stub' = ask the provider): requests are queued and asked one at a time. Each adds freeze
//    'question' and opens the modal {type: 'question', req, attempt, mount(el) -> Promise}. The UI calls mount(el)
//    with an empty element; the provider renders into it.
//  - blocking (config.questions.contexts[ctx].blocking, or req.blocking when given) and wrong -> the modal closes,
//    the world stays frozen for retrySeconds (default 3), then the same request is asked again ('gate:retry').
//  - never deadlocks: closing/replacing the question modal from outside resolves {correct: false, skipped: true};
//    a provider error resolves {correct: true, skipped: true}; if nobody mounts the modal within
//    gates.mountTimeout game seconds (default 10) it resolves {correct: true, skipped: true}.
//  - emits 'gate:result' {req, correct, skipped} once per request, after the freeze is removed.
// Also: gates.answer(correct) (debug / bots: resolves the pending question without DOM), gates.pending(),
// gates.after(seconds, fn) (game-time timer that runs while frozen), gates.contextConfig(ctx).

const DEFAULT_CTX = Object.freeze({ enabled: true, blocking: false });

export default {
  id: 'gates',
  always: true,
  init(game) {
    const queue = [];
    let cur = null;
    const timers = [];

    const qs = () => game.questions || null;
    const mode = () => { const q = qs(); return q ? q.mode : 'off'; };
    const retrySeconds = () => {
      const q = game.config.questions || {};
      return typeof q.retrySeconds === 'number' ? q.retrySeconds : 3;
    };

    function contextConfig(ctx) {
      const all = (game.config.questions && game.config.questions.contexts) || {};
      return all[ctx] || DEFAULT_CTX;
    }

    function normalizeReq(r) {
      r = r || {};
      return {
        context: r.context || 'gate',
        difficulty: typeof r.difficulty === 'number' ? r.difficulty : 1,
        tags: Array.isArray(r.tags) ? r.tags.slice() : [],
        optional: !!r.optional,
        blocking: typeof r.blocking === 'boolean' ? r.blocking : undefined,
        attempt: 1,
        ...(r.id !== undefined ? { id: r.id } : {}),
      };
    }

    function normResult(r) {
      if (r === true || r === false) return { correct: r, skipped: false };
      if (!r || typeof r !== 'object') return { correct: true, skipped: true };
      return { correct: !!r.correct, skipped: !!r.skipped };
    }

    function emitResult(req, r) {
      game.bus.emit('gate:result', { req, correct: r.correct, skipped: r.skipped });
    }

    function closeOwn(job) {
      const m = job.modal;
      job.modal = null;
      if (m && game.modal === m) {
        job.closingSelf = true;
        try { game.closeModal(undefined); } finally { job.closingSelf = false; }
      }
    }

    function open(job) {
      job.attempt++;
      job.req.attempt = job.attempt;
      job.mounted = false;
      job.age = 0;
      game.freeze.add('question');
      const modal = {
        type: 'question',
        req: job.req,
        attempt: job.attempt,
        mount: (el) => mount(job, modal, el),
        onClose: () => {
          if (job.closingSelf || job.done || job.modal !== modal) return;
          job.modal = null;
          settle(job, { correct: false, skipped: true });
        },
      };
      job.modal = modal;
      game.openModal(modal);
    }

    function mount(job, modal, el) {
      if (job.done || job.modal !== modal) return Promise.resolve(null);
      if (job.mounted) return job.mountPromise;
      job.mounted = true;
      const q = qs();
      const p = q ? q.ask(job.req, el) : Promise.resolve({ correct: true, skipped: true });
      job.mountPromise = Promise.resolve(p).then((r) => { answer(job, modal, r); return normResult(r); }, (e) => {
        if (typeof console !== 'undefined') console.warn('[gates] provider failed:', e && (e.message || e));
        answer(job, modal, { correct: true, skipped: true });
        return { correct: true, skipped: true };
      });
      return job.mountPromise;
    }

    function answer(job, modal, raw) {
      if (job.done || job.modal !== modal) return false;
      const r = normResult(raw);
      if (!r.correct && !r.skipped && job.blocking) {
        closeOwn(job);
        job.wait = Math.max(0.01, retrySeconds());
        game.bus.emit('gate:retry', { req: job.req, attempt: job.attempt, wait: job.wait });
        game.bus.emit('sfx', { id: 'ui_bad' });
        game.toast(`Not quite. Try again in ${Math.ceil(job.wait)} seconds.`, 'bad');
        return true;
      }
      settle(job, r);
      return true;
    }

    function settle(job, r) {
      if (job.done) return;
      job.done = true;
      job.wait = 0;
      closeOwn(job);
      if (cur === job) cur = null;
      if (!cur && !queue.length) game.freeze.delete('question');
      game.bus.emit('sfx', { id: r.correct ? 'ui_ok' : 'ui_bad' });
      emitResult(job.req, r);
      job.resolve(r);
      next();
    }

    function next() {
      if (cur || !queue.length) {
        if (!cur && !queue.length) game.freeze.delete('question');
        return;
      }
      cur = queue.shift();
      const m = mode();
      // The mode may have changed while this request waited in the queue.
      if (m === 'off' || m === 'auto') {
        const job = cur;
        settle(job, m === 'off' ? (job.req.optional ? { correct: false, skipped: true } : { correct: true, skipped: true })
          : { correct: true, skipped: false });
        return;
      }
      open(cur);
    }

    const api = {
      /** @returns {Promise<{correct: boolean, skipped: boolean}>} */
      ask(reqIn) {
        const req = normalizeReq(reqIn);
        game.bus.emit('gate:ask', { req });
        const cfg = contextConfig(req.context);
        const m = mode();
        if (m === 'off' || cfg.enabled === false || !qs()) {
          const r = req.optional ? { correct: false, skipped: true } : { correct: true, skipped: true };
          emitResult(req, r);
          return Promise.resolve(r);
        }
        if (m === 'auto') {
          return Promise.resolve(qs().ask(req, null)).then(normResult, () => ({ correct: true, skipped: true }))
            .then((r) => { emitResult(req, r); return r; });
        }
        const blocking = req.blocking !== undefined ? req.blocking : !!cfg.blocking;
        return new Promise((resolve) => {
          queue.push({ req, blocking, resolve, attempt: 0, wait: 0, modal: null, done: false, closingSelf: false,
            mounted: false, mountPromise: null, age: 0 });
          next();
        });
      },
      /** Debug / bots: answer the pending question without DOM. Returns true if a question was answered. */
      answer(correct = true) {
        if (!cur) return false;
        if (cur.wait > 0) { cur.wait = 0; open(cur); }
        return answer(cur, cur.modal, { correct: !!correct, skipped: false });
      },
      /** The request currently being asked (or waiting for its retry), or null. */
      pending() { return cur ? cur.req : null; },
      /** Requests waiting behind the current one. */
      queued() { return queue.length; },
      waiting() { return cur ? cur.wait : 0; },
      contextConfig,
      /** Game-time timer that also runs while the world is frozen. Returns a cancel function. */
      after(seconds, fn) {
        const t = { left: seconds, fn, dead: false };
        timers.push(t);
        return () => { t.dead = true; };
      },
      /** Promise version of after(). */
      wait(seconds) { return new Promise((res) => api.after(seconds, res)); },
      mountTimeout: 10,
    };

    // ['gate', {context, difficulty, tags}, {pass: [ops], fail: [ops]}]
    if (game.ops && game.ops.register) {
      game.ops.register('gate', (g, a, ctx) => api.ask(Object.assign({ context: 'gate' }, a[1] || {})).then((r) => {
        const branch = a[2] || {};
        const list = r.correct ? branch.pass : branch.fail;
        return list && list.length ? g.ops.run(list, ctx) : undefined;
      }));
    }

    api._update = (dt) => {
      if (timers.length) {
        for (let i = 0; i < timers.length; i++) {
          const t = timers[i];
          if (t.dead) continue;
          t.left -= dt;
          if (t.left <= 0) { t.dead = true; try { t.fn(); } catch (e) { if (game.debug && game.debug.logError) game.debug.logError(String(e && (e.stack || e))); } }
        }
        let w = 0;
        for (let i = 0; i < timers.length; i++) if (!timers[i].dead) timers[w++] = timers[i];
        timers.length = w;
      }
      const job = cur;
      if (!job || job.done) return;
      const m = mode();
      if (m === 'off' || m === 'auto') { settle(job, { correct: true, skipped: m === 'off' }); return; }
      if (job.wait > 0) {
        job.wait -= dt;
        if (job.wait <= 0) { job.wait = 0; open(job); }
        return;
      }
      if (job.modal && !job.mounted) {
        job.age += dt;
        if (job.age >= api.mountTimeout) {
          if (typeof console !== 'undefined') console.warn('[gates] question modal was never mounted; skipping it');
          settle(job, { correct: true, skipped: true });
        }
      }
    };

    return api;
  },
  update(game, dt) { game.sys.gates._update(dt); },
};
