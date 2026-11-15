// STUB: replaced by the Meta package
// Question provider front door. Runs under Node (no DOM here; providers may use the DOM).

export const Questions = {
  mode: 'auto',           // 'off' | 'auto' | 'stub'
  provider: null,
  setProvider(p) { Questions.provider = p || null; },
  /** @returns {Promise<{correct: boolean, skipped: boolean}>} */
  ask(req, mountEl) {
    if (Questions.mode === 'off' || Questions.mode === 'auto' || !Questions.provider) {
      return Promise.resolve({ correct: true, skipped: false });
    }
    return Questions.provider.ask(req, mountEl);
  },
};

export default Questions;
