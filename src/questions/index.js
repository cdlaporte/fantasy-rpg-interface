// Meta package. The question front door (CONTRACTS 12). Runs under Node: no DOM here, providers may use the DOM
// inside their own ask(). Only core/gates.js calls ask(); everything else goes through gates.ask().
//
// Modes:
//   'off'  : no questions at all; ask() resolves {correct: true, skipped: true} at once.
//   'auto' : no UI; ask() resolves {correct: true, skipped: false} at once (tests, bots, test=1).
//   'stub' : ask the active provider (custom.js when the teacher fills it in, else the stub placeholder card).
//
// Provider shape: { id, ask(req, el) -> Promise<{correct, skipped}> }   req = {context, difficulty, tags, optional, attempt}

import stubProvider from './stubProvider.js';

export const MODES = Object.freeze(['off', 'auto', 'stub']);

function normalizeResult(r) {
  if (r === true || r === false) return { correct: r, skipped: false };
  if (!r || typeof r !== 'object') return { correct: true, skipped: true };
  return { correct: !!r.correct, skipped: !!r.skipped };
}

/** Builds an independent Questions object (tests use their own so they do not share the global mode). */
export function createQuestions(opts = {}) {
  const q = {
    mode: MODES.includes(opts.mode) ? opts.mode : 'auto',
    /** round 2: teacher mode shows answers and worked solutions (set by the teacher options). */
    teacher: false,
    /** round 2: enabled topic ids (see unit4/index.js TOPICS); null = every topic on by default. */
    topics: null,
    provider: opts.provider || stubProvider,
    /** provider registry: id -> provider */
    providers: { [stubProvider.id]: stubProvider },
    setProvider(p) {
      q.provider = p || stubProvider;
      if (p && p.id) q.providers[p.id] = p;
      return q.provider;
    },
    register(p) { if (p && p.id) q.providers[p.id] = p; return p; },
    use(id) { if (q.providers[id]) q.provider = q.providers[id]; return q.provider; },
    setMode(m) { if (MODES.includes(m)) q.mode = m; return q.mode; },
    /** true when ask() will show something to the player (the modal must be mounted). */
    needsUi() { return q.mode === 'stub'; },
    /** @returns {Promise<{correct: boolean, skipped: boolean}>} never rejects */
    ask(req, mountEl) {
      if (q.mode === 'off') return Promise.resolve({ correct: true, skipped: true });
      if (q.mode === 'auto') return Promise.resolve({ correct: true, skipped: false });
      const p = q.provider || stubProvider;
      let out;
      try { out = p.ask(req || {}, mountEl || null); } catch (e) { out = Promise.reject(e); }
      return Promise.resolve(out).then(normalizeResult, (e) => {
        if (typeof console !== 'undefined') console.warn('[questions] provider failed:', e && (e.message || e));
        return { correct: true, skipped: true };
      });
    },
    normalizeResult,
    /**
     * round 2 (debug / e2e / teacher demo): the next question the provider asks is exactly this one.
     * Returns the problem object, or null when the active provider cannot preview.
     */
    preview(topicId, difficulty = 2, seed = 1) {
      const p = q.provider;
      return p && typeof p.preview === 'function' ? p.preview(topicId, difficulty, seed) : null;
    },
  };
  return q;
}

/** The shared instance main.js configures (mode from the URL, provider = custom.js || stub). */
export const Questions = createQuestions();

export default Questions;
