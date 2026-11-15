// STUB: replaced by the Meta package
// Placeholder card: "Question goes here" with 1 = Correct, 2 = Wrong.

export const stubProvider = {
  id: 'stub',
  ask(req, el) {
    return new Promise((resolve) => {
      const card = document.createElement('div');
      card.className = 'question-stub';
      const h = document.createElement('h2');
      h.textContent = 'Question goes here';
      const p = document.createElement('p');
      p.textContent = `context: ${req.context || '?'} - difficulty: ${req.difficulty ?? '?'} - tags: ${(req.tags || []).join(', ')}`;
      const ok = document.createElement('button');
      ok.textContent = '1  Correct';
      const bad = document.createElement('button');
      bad.textContent = '2  Wrong';
      card.append(h, p, ok, bad);
      el.appendChild(card);
      const done = (correct) => {
        window.removeEventListener('keydown', onKey, true);
        card.remove();
        resolve({ correct, skipped: false });
      };
      const onKey = (e) => {
        if (e.code === 'Digit1') { e.preventDefault(); done(true); }
        if (e.code === 'Digit2') { e.preventDefault(); done(false); }
      };
      ok.onclick = () => done(true);
      bad.onclick = () => done(false);
      window.addEventListener('keydown', onKey, true);
    });
  },
};

export default stubProvider;
