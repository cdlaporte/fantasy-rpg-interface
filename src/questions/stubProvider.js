// Meta package. Placeholder question provider: a clearly labeled card that says "Question goes here" and shows
// the request (context, difficulty, tags). Press 1 (or click) = Correct, 2 = Wrong.
// The DOM is only touched inside ask(req, el), so importing this module is safe under Node.

const CONTEXT_NAMES = {
  levelup: 'Level up', boon: 'Boon choice', spec: 'Specialization', gate: 'Rune gate', chest: 'Rune chest',
  boss_shield: 'Boss shield', focus: 'Focus scroll', lesson: 'Lesson', quest_turnin: 'Quest bonus',
  haggle: 'Haggling', revive: 'Second chance',
};

export const stubProvider = {
  id: 'stub',
  ask(req, el) {
    req = req || {};
    if (!el || typeof document === 'undefined') return Promise.resolve({ correct: true, skipped: true });
    return new Promise((resolve) => {
      const card = document.createElement('div');
      card.className = 'question-stub';
      card.setAttribute('role', 'dialog');
      const badge = document.createElement('div');
      badge.className = 'question-stub-badge';
      badge.textContent = 'PLACEHOLDER';
      const h = document.createElement('h2');
      h.textContent = 'Question goes here';
      const info = document.createElement('dl');
      const row = (k, v) => {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        info.append(dt, dd);
      };
      row('Context', `${CONTEXT_NAMES[req.context] || req.context || '?'} (${req.context || '?'})`);
      row('Difficulty', String(req.difficulty ?? '?'));
      row('Tags', (req.tags && req.tags.length) ? req.tags.join(', ') : 'none');
      if (req.attempt > 1) row('Attempt', String(req.attempt));
      const btns = document.createElement('div');
      btns.className = 'question-stub-buttons';
      const ok = document.createElement('button');
      ok.type = 'button'; ok.className = 'question-stub-correct'; ok.textContent = '1  Correct';
      const bad = document.createElement('button');
      bad.type = 'button'; bad.className = 'question-stub-wrong'; bad.textContent = '2  Wrong';
      btns.append(ok, bad);
      const hint = document.createElement('p');
      hint.className = 'question-stub-hint';
      hint.textContent = 'The real math question will appear here once the teacher adds a question bank.';
      card.append(badge, h, info, btns, hint);
      el.appendChild(card);
      let finished = false;
      const done = (correct, skipped = false) => {
        if (finished) return;
        finished = true;
        window.removeEventListener('keydown', onKey, true);
        card.remove();
        resolve({ correct, skipped });
      };
      const onKey = (e) => {
        // The game may have closed the modal (debug answerQuestion, replaced modal): stop listening.
        if (!card.isConnected) { done(false, true); return; }
        if (e.code === 'Digit1' || e.code === 'Numpad1') { e.preventDefault(); e.stopPropagation(); done(true); }
        else if (e.code === 'Digit2' || e.code === 'Numpad2') { e.preventDefault(); e.stopPropagation(); done(false); }
      };
      ok.onclick = () => done(true);
      bad.onclick = () => done(false);
      window.addEventListener('keydown', onKey, true);
      ok.focus && ok.focus();
    });
  },
};

export default stubProvider;
