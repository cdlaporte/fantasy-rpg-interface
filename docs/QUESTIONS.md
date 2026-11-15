# Adding your own questions to Flinkerton Academy

This guide is for the teacher who will supply the math questions (statistics and geometry). You do not
need to know how the rest of the game works. Everything you need lives in one folder: `src/questions/`.

Right now, every time the game wants to ask a question it shows a placeholder card that says
**"Question goes here"**, with buttons for *Correct* (key `1`) and *Wrong* (key `2`). Your job, later, is
to replace that placeholder with real questions. You can do that by writing a question bank (a list of
questions in a simple text format) and pasting the ready-made code at the end of this guide into
`src/questions/custom.js`.

---

## 1. Turning questions on and off

Add one of these to the end of the game's web address:

| Address ending | What happens |
| --- | --- |
| *(nothing)* | Normal play: questions are asked (your questions once `custom.js` is filled in, otherwise the placeholder card). |
| `?questions=off` | No questions at all. Everything a question would unlock is simply given. Good for a "just play" day. |
| `?questions=auto` | No question window; every question counts as answered correctly. Used for automated testing. |
| `?questions=stub` | Always show questions (same as normal play). |

The game is never stuck on a question: if a question is closed or fails to load, the game moves on.

## 2. Where questions appear in the game

Every question request says *where* it comes from (its **context**). Your questions can be different for
each context, for example quick mental-math for haggling and a harder multi-step problem for a rune gate.

"Must be right" means the student gets another try (after a short 3-second pause) until they answer
correctly. "One try" means a wrong answer has a small consequence and the game carries on.

| Context | Where it happens | Right answer | Wrong answer | Rule |
| --- | --- | --- | --- | --- |
| `boon` | The student presses **Tab** to choose a new power-up (levels 4, 6, 8, 10, 12). | Choose from 3 power-ups. | Must be right (the game is set up that way; it can be changed to "only 2 choices"). | Must be right |
| `spec` | At level 8, in Mr. Laporte's office, before choosing a specialization (Knight, Sorcerer, Archer, ...). | The choice opens. | Try again. | Must be right |
| `gate` | Glowing rune seals block paths in the forest. | The seal breaks and the path opens. | Try again. | Must be right |
| `chest` | Rune chests (chests with a glowing rune). | Extra treasure inside. | The chest opens with the normal treasure. | One try |
| `boss_shield` | When the forest boss raises its magic shield (twice per fight). | The shield shatters and the boss is stunned. | The shield stays a few more seconds, then the question comes back. | Must be right |
| `focus` | The student uses a *Focus Scroll* item in a fight. | Full power, all abilities ready, +50% damage for 6 s. | A little power comes back. | One try |
| `lesson` | Lessons in the Academy classrooms (a teacher asks several questions in a row). | Experience points and gold for each right answer. | Try again. | Must be right |
| `quest_turnin` | Handing in a finished quest. | +25% quest reward. | Normal reward. | Bonus question |
| `haggle` | The "Haggle" button in a shop. | 20% off everything for this visit. | Normal prices (one try per visit). | One try |
| `revive` | When the student is knocked out (at most once every 5 minutes). | They get back up on the spot. | They wake up in the Academy infirmary. | One try, bonus |
| `levelup` | Reserved for a possible question at each level-up; not used yet. | | | |

The "must be right / one try" settings are in `src/config.js` (`questions.contexts`), where each context
can also be switched off completely (`enabled: false`).

## 3. Difficulty and tags

Each request also carries:

- **difficulty**: a number, usually **1** (warm-up), **2** (standard) or **3** (challenge); 4-5 are allowed
  for later content. The game asks for easier questions early on and harder ones later: power-up questions
  use 1 at levels 4, 2 at levels 6-8 and 3 at levels 10-12; specialization questions use 2; haggling and the
  revive question use 1; rune gates, rune chests, lessons and the boss use whatever the level designer set
  for that gate, chest, lesson or boss (usually 2-3).
- **tags**: topic labels chosen by whoever placed the question in the game, for example `['geometry']` on
  a forest gate or `['statistics', 'mean']` on a lesson. A lesson in classroom 2 might always ask about
  angles; a gate deep in the forest might ask about area.

Your question bank uses the same words, so the code below can pick a question that matches. A good rule of
thumb: give every question one **unit** (the big topic, e.g. `geometry` or `statistics`) and two or three
**tags** (e.g. `angles`, `triangles`, `mean`, `median`, `probability`). If no question matches the tags
asked for, the code falls back to any question of the right difficulty, then to any question at all, so the
game never runs out.

## 4. The question bank format

A question bank is a list of questions. Write it as a JavaScript file `src/questions/bank.js` that starts
with `export default [` and ends with `];` (this works when the game is opened straight from the files,
without a web server setting). Each question is one `{ ... }` block. Three kinds are supported:

### Multiple choice

```js
{
  id: 'geo-angles-01',             // any unique name; used so the same question is not repeated too soon
  type: 'choice',
  unit: 'geometry',
  tags: ['angles', 'triangles'],
  difficulty: 1,
  prompt: 'Two angles of a triangle are 50° and 60°. What is the third angle?',
  choices: ['50°', '60°', '70°', '80°'],
  answer: 2,                        // the position of the right choice, counting from 0 (here: '70°')
  explanation: 'The angles of a triangle add up to 180°, so 180 - 50 - 60 = 70.',
},
```

### Number answer (with a tolerance)

```js
{
  id: 'stats-mean-03',
  type: 'number',
  unit: 'statistics',
  tags: ['mean'],
  difficulty: 2,
  prompt: 'The test scores are 72, 85, 90 and 81. What is the mean score?',
  answer: 82,
  tolerance: 0,                     // how far off an answer may be and still count (0.05 means +/- 0.05)
  unitLabel: 'points',              // optional, shown next to the answer box
  explanation: '(72 + 85 + 90 + 81) / 4 = 328 / 4 = 82.',
},
```

### True or false

```js
{
  id: 'geo-square-02',
  type: 'truefalse',
  unit: 'geometry',
  tags: ['quadrilaterals'],
  difficulty: 1,
  prompt: 'Every square is also a rectangle.',
  answer: true,
  explanation: 'A square has four right angles, so it is a special rectangle.',
},
```

### Optional fields for every kind

| Field | Meaning |
| --- | --- |
| `image` | A picture shown above the question, e.g. `'questions/img/triangle-1.png'` (a path from the game folder). |
| `imageAlt` | A short description of the picture (for screen readers). |
| `figure` | A small drawing written as SVG text, e.g. `'<svg viewBox="0 0 100 60">...</svg>'`, if you prefer drawings without image files. |
| `contexts` | Limit a question to some places, e.g. `['lesson', 'gate']`. Leave it out to allow it anywhere. |
| `hint` | One line shown under the question. |
| `explanation` | Shown after the student answers (right or wrong) for a moment before the game continues. |

## 5. The ready-made provider (copy into `src/questions/custom.js`)

Replace everything in `src/questions/custom.js` with the code below. It reads your `bank.js`, picks a
question that fits the request, shows it in the game's question window, checks the answer and tells the game
whether it was right. Keys: `1`-`4` choose an answer, `Enter` submits a number answer, `T` / `F` answer
true-or-false questions. Everything can also be clicked.

```js
// src/questions/custom.js — the teacher's question provider.
import bank from './bank.js';

// How long the explanation stays on screen after an answer (milliseconds).
const EXPLAIN_MS = 2500;
// How many recent questions to avoid repeating.
const MEMORY = 20;
const recent = [];

// ---- choosing a question --------------------------------------------------------------------------
// req looks like: { context: 'gate', difficulty: 2, tags: ['geometry'], attempt: 1 }
function pick(req) {
  const tags = req.tags || [];
  const allowed = (q) => !q.contexts || q.contexts.includes(req.context);
  const matchesTags = (q) => tags.length === 0
    || tags.some((t) => (q.tags || []).includes(t) || q.unit === t);
  const fresh = (q) => !recent.includes(q.id);
  // Try the best match first, then relax the rules one at a time.
  const tries = [
    (q) => allowed(q) && matchesTags(q) && q.difficulty === req.difficulty && fresh(q),
    (q) => allowed(q) && matchesTags(q) && Math.abs((q.difficulty || 1) - (req.difficulty || 1)) <= 1 && fresh(q),
    (q) => allowed(q) && matchesTags(q) && fresh(q),
    (q) => allowed(q) && q.difficulty === req.difficulty && fresh(q),
    (q) => allowed(q),
    () => true,
  ];
  for (const ok of tries) {
    const list = bank.filter(ok);
    if (list.length) {
      const q = list[Math.floor(Math.random() * list.length)];
      recent.push(q.id);
      if (recent.length > MEMORY) recent.shift();
      return q;
    }
  }
  return null;
}

// ---- checking an answer ----------------------------------------------------------------------------
function isRight(q, given) {
  if (q.type === 'number') {
    const n = Number(String(given).replace(',', '.').trim());
    return Number.isFinite(n) && Math.abs(n - Number(q.answer)) <= (q.tolerance || 0);
  }
  return given === q.answer;   // choice: the index; truefalse: true / false
}

// ---- small helpers to build the page (always textContent, never innerHTML, for typed text) ----------
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export default {
  id: 'teacher-bank',

  // The game calls ask() with the request and an empty element inside its question window.
  // It must return a Promise that resolves to { correct: true/false, skipped: false }.
  ask(req, el) {
    const q = pick(req);
    if (!q || !el) return Promise.resolve({ correct: true, skipped: true });   // nothing to ask: let them through

    return new Promise((resolve) => {
      const card = make('div', 'question-card');
      card.appendChild(make('div', 'question-topic', `${q.unit || ''}  ·  difficulty ${q.difficulty || 1}`));
      if (q.image) {
        const img = make('img', 'question-image');
        img.src = q.image;
        img.alt = q.imageAlt || '';
        card.appendChild(img);
      }
      if (q.figure) {
        const fig = make('div', 'question-figure');
        fig.innerHTML = q.figure;            // your own SVG drawing (only ever from bank.js)
        card.appendChild(fig);
      }
      card.appendChild(make('p', 'question-prompt', q.prompt));
      if (q.hint) card.appendChild(make('p', 'question-hint', q.hint));
      const answers = make('div', 'question-answers');
      const feedback = make('p', 'question-feedback');
      card.append(answers, feedback);
      el.appendChild(card);

      let finished = false;
      const finish = (given) => {
        if (finished) return;
        finished = true;
        window.removeEventListener('keydown', onKey, true);
        const correct = isRight(q, given);
        feedback.textContent = (correct ? 'Correct! ' : 'Not quite. ') + (q.explanation || '');
        feedback.className = 'question-feedback ' + (correct ? 'is-right' : 'is-wrong');
        setTimeout(() => { card.remove(); resolve({ correct, skipped: false }); },
          q.explanation ? EXPLAIN_MS : 800);
      };

      let numberBox = null;
      if (q.type === 'choice') {
        q.choices.forEach((text, i) => {
          const b = make('button', 'question-choice', `${i + 1}   ${text}`);
          b.type = 'button';
          b.onclick = () => finish(i);
          answers.appendChild(b);
        });
      } else if (q.type === 'truefalse') {
        for (const [label, value] of [['T   True', true], ['F   False', false]]) {
          const b = make('button', 'question-choice', label);
          b.type = 'button';
          b.onclick = () => finish(value);
          answers.appendChild(b);
        }
      } else {                                  // 'number'
        numberBox = make('input', 'question-number');
        numberBox.inputMode = 'decimal';
        numberBox.autocomplete = 'off';
        const go = make('button', 'question-submit', 'Check');
        go.type = 'button';
        go.onclick = () => finish(numberBox.value);
        answers.append(numberBox);
        if (q.unitLabel) answers.append(make('span', 'question-unit', q.unitLabel));
        answers.append(go);
        setTimeout(() => numberBox.focus(), 0);
      }

      const onKey = (e) => {
        if (!card.isConnected) { window.removeEventListener('keydown', onKey, true); return; }
        if (q.type === 'choice' && /^Digit[1-9]$/.test(e.code)) {
          const i = Number(e.code.slice(5)) - 1;
          if (i < q.choices.length) { e.preventDefault(); finish(i); }
        } else if (q.type === 'truefalse' && (e.code === 'KeyT' || e.code === 'KeyF')) {
          e.preventDefault(); finish(e.code === 'KeyT');
        } else if (q.type === 'number' && e.code === 'Enter') {
          e.preventDefault(); finish(numberBox.value);
        }
      };
      window.addEventListener('keydown', onKey, true);
    });
  },
};
```

To check that it works, open the game normally, walk to anything that asks a question (or, in the debug
version with `?debug=1`, type `__game.game.gates.ask({context: 'lesson', difficulty: 1, tags: ['mean']})`
in the browser console) and your question should appear instead of the placeholder card.

## 6. Tips

- Start small: ten questions per unit at each difficulty is plenty for a first class session.
- Keep prompts short. The window is about the size of a large index card on a Chromebook screen.
- Use `tolerance` generously for answers that need rounding (for example `tolerance: 0.05` for
  "round to one decimal place").
- If you want a question only in lessons (for example a longer, multi-step one), add `contexts: ['lesson']`.
- The game itself never shows the right answer unless you write an `explanation`.
