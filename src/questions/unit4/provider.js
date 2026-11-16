// Unit 4 question provider: random problems from the enabled topics, shown in the game's question window.
// Pure helpers (difficultyFor, pickTopic, nextQuestion) run under Node; the DOM is only touched inside ask().
//
//   provider.ask(req, el) -> Promise<{correct, skipped}>
//   provider.preview(topicId, difficulty, seed)   the next ask() shows exactly this problem (e2e / teacher demo)
//   provider.generate(topicId, difficulty, seed)  a problem object without UI
// Settings come from the shared Questions object: Questions.teacher (show answers + solutions, Next = correct)
// and Questions.topics (enabled topic ids; null = all).
import { TOPICS } from './index.js';
import { generate, TOPIC_IDS, topicInfo } from './generators.js';
import { createRng } from './rng.js';
import { createSession, HELP_TEXT } from './session.js';

export const CONTEXT_INFO = {
  levelup: ['Level up', 'Answer for a level-up bonus.'],
  boon: ['Level-up bonus', 'Right answer: choose from 3 boons (wrong: 2).'],
  spec: ['Specialization trial', 'Answer, then choose your specialization.'],
  gate: ['Rune gate', 'Answer correctly to break the seal.'],
  chest: ['Rune chest', 'Right answer: bonus treasure inside.'],
  scholar_chest: ["Scholar's chest", 'Solve it to open the chest. (Wrong: try again with a new problem.)'],
  boss_shield: ['Boss shield', 'Answer correctly to shatter the shield!'],
  focus: ['Focus scroll', 'Right answer: full power and every ability ready.'],
  lesson: ['Lesson', 'Each right answer earns XP and gold.'],
  quest_turnin: ['Quest bonus', 'Right answer: +25% quest reward.'],
  haggle: ['Haggling', 'Right answer: 20% off for this visit.'],
  revive: ['Second chance', 'Right answer: get back up right here.'],
};
const BLOCKING = new Set(['gate', 'boss_shield']);
const CORRECT_MS = 750;
const CONTINUE_DELAY_MS = 450;   // Enter is ignored this long after the solution appears (no accidental skip)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Number difficulty 1-3 for a request (rune gates 2, boss shields 2-3, haggle / revive 1, else the request's). */
export function difficultyFor(req, rng = Math.random) {
  const d = clamp(Math.round(Number(req && req.difficulty) || 1), 1, 3);
  switch (req && req.context) {
    case 'gate': return 2;
    case 'boss_shield': return rng() < 0.5 ? 2 : 3;
    case 'haggle': case 'revive': return 1;
    default: return d;           // boon: 1 at level 4, 2 at 6-8, 3 at 10-12; lesson: the lesson's difficulty
  }
}

/** Enabled topic ids from a Questions.topics value (null / empty / unknown -> all). */
export function enabledTopics(topics) {
  if (!Array.isArray(topics)) return TOPIC_IDS.slice();
  const ok = topics.filter((t) => TOPIC_IDS.includes(t));
  return ok.length ? ok : TOPIC_IDS.slice();
}

/** Random enabled topic, avoiding the last few shown (as many as the list allows). */
export function pickTopic(enabled, recent, rng = Math.random) {
  const avoid = Math.min(3, enabled.length - 1);
  const skip = avoid > 0 ? recent.slice(-avoid) : [];
  const pool = enabled.filter((t) => !skip.includes(t));
  const list = pool.length ? pool : enabled;
  return list[Math.floor(rng() * list.length)];
}

export function createUnit4Provider({ settings = () => ({}), seed = null } = {}) {
  const rng = createRng(seed != null ? seed : (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
  const recent = [];
  let forced = null;

  /** The problem for a request (pure). */
  function nextQuestion(req) {
    req = req || {};
    if (forced) {
      const f = forced; forced = null;
      return generate(f.topic, f.difficulty, f.seed);
    }
    const st = settings() || {};
    const topic = pickTopic(enabledTopics(st.topics), recent, rng);
    recent.push(topic);
    if (recent.length > 8) recent.shift();
    const d = difficultyFor(req, rng);
    return generate(topic, d, Math.floor(rng() * 1e9));
  }

  const provider = {
    id: 'unit4',
    nextQuestion,
    generate,
    preview(topic, difficulty = 2, seedIn = 1) {
      if (!topicInfo(topic)) return null;
      forced = { topic, difficulty, seed: seedIn };
      return generate(topic, difficulty, seedIn);
    },
    ask(req, el) {
      if (!el || typeof document === 'undefined') return Promise.resolve({ correct: true, skipped: true });
      const q = nextQuestion(req);
      const teacher = !!(settings() || {}).teacher;
      return showQuestion(q, el, { req: req || {}, teacher });
    },
  };
  return provider;
}

// ------------------------------------------------------------------------------------------------ DOM
function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Render q into el and resolve when the student is done. */
export function showQuestion(q, el, { req = {}, teacher = false } = {}) {
  return new Promise((resolve) => {
    const s = createSession(q, { teacher });
    const info = topicInfo(q.topic) || { name: q.topic, day: '' };
    const ctx = CONTEXT_INFO[req.context] || ['Question', ''];

    const card = make('div', 'q4');
    card.setAttribute('role', 'dialog');
    card.dataset.topic = q.topic;
    card.dataset.qid = q.id;
    const top = make('div', 'q4-top');
    top.append(make('span', 'q4-context', ctx[0]));
    let stakes = ctx[1];
    if (BLOCKING.has(req.context) && req.attempt > 1) stakes = 'A new problem. You can do it!';
    top.append(make('span', 'q4-stakes', stakes));
    if (req.optional) top.append(make('span', 'q4-badge opt', 'BONUS'));
    if (teacher) top.append(make('span', 'q4-badge', 'TEACHER MODE'));
    const kicker = make('div', 'q4-kicker');
    kicker.append(make('b', null, `Day ${info.day}`), document.createTextNode(` · ${info.name}`));
    const prompt = make('p', 'q4-prompt', q.prompt);
    const body = make('div', 'q4-body');
    if (q.figure) {
      const fig = make('div', 'q4-figure');
      fig.innerHTML = q.figure;          // SVG built by our own generators (never user text)
      body.append(fig);
    }
    const side = make('div', 'q4-side');
    body.append(side);
    card.append(top, kicker, prompt, body);
    el.appendChild(card);

    let input = null, help = null, choiceBtns = [], checkBtn = null, nextBtn = null, shownAt = 0;
    let finished = false;

    // ---- answer area
    if (q.type === 'choice') {
      const box = make('div', 'q4-choices' + (q.choices.length > 2 && q.choices.every((c) => c.length <= 8) ? ' wide' : ''));
      q.choices.forEach((text, i) => {
        const b = make('button', 'q4-choice');
        b.type = 'button';
        b.append(make('span', 'q4-key', String(i + 1)), make('span', 'q4-ctext', text));
        b.addEventListener('click', () => onChoose(i));
        choiceBtns.push(b);
        box.append(b);
      });
      side.append(box);
    } else {
      const row = make('div', 'q4-answer');
      const m = /^([a-z?]) = /.exec(q.answerText || '');
      if (m) row.append(make('span', 'q4-pre', `${m[1]} =`));
      input = make('input', 'q4-input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('inputmode', 'decimal');
      input.setAttribute('aria-label', 'Your answer');
      row.append(input);
      const suf = /°$/.test(q.answerText || '') ? '°' : (/ ([a-z]+)$/.exec(q.answerText || '') || [])[1];
      if (suf) row.append(make('span', 'q4-suf', suf));
      checkBtn = make('button', 'q4-check', 'Check');
      checkBtn.type = 'button';
      checkBtn.addEventListener('click', () => onSubmit());
      row.append(checkBtn);
      help = make('div', 'q4-help', 'Press Enter to check.');
      side.append(row, help);
      // typed keys belong to the box: never let them reach the game's keyboard handlers
      for (const t of ['keydown', 'keyup', 'keypress']) input.addEventListener(t, (e) => { e.stopPropagation(); });
    }

    // ---- result views
    const showSolution = (kind) => {
      if (input) { input.disabled = true; if (checkBtn) checkBtn.disabled = true; }
      choiceBtns.forEach((b, i) => {
        b.disabled = true;
        if (i === q.answerIndex) b.classList.add('is-right');
        else if (i === s.given) b.classList.add('is-picked');
      });
      if (help) help.textContent = '';
      const res = make('div', 'q4-result ' + (kind === 'teach' ? 'teach' : 'bad'));
      if (kind === 'teach') res.append(document.createTextNode('Answer: '));
      else res.append(document.createTextNode('Not quite. The answer is '));
      res.append(make('span', 'q4-ans', q.answerText));
      if (kind !== 'teach') res.append(document.createTextNode('.'));
      const ol = make('ol', 'q4-steps');
      for (const st of q.solution) ol.append(make('li', null, st));
      const next = make('div', 'q4-next');
      nextBtn = make('button', 'q4-continue', kind === 'teach' ? 'Next' : 'Continue');
      nextBtn.type = 'button';
      nextBtn.addEventListener('click', () => finish());
      next.append(nextBtn, make('span', 'q4-hint', 'ENTER'));
      side.append(res, ol, next);
      shownAt = Date.now();
      setTimeout(() => { if (!finished && nextBtn) nextBtn.focus({ preventScroll: true }); }, 0);
      if (input && kind === 'teach') input.value = q.answerPlain || '';
    };

    const finish = () => {
      if (finished) return;
      const r = s.result();
      if (!r) return;
      finished = true;
      cleanup();
      resolve(r);
    };
    const flashCorrect = () => {
      if (input) { input.disabled = true; if (checkBtn) checkBtn.disabled = true; }
      choiceBtns.forEach((b, i) => { b.disabled = true; if (i === q.answerIndex) b.classList.add('is-right'); });
      if (help) help.textContent = '';
      side.append(make('div', 'q4-flash', 'Correct!'));
      setTimeout(finish, CORRECT_MS);
    };
    const after = (phase) => {
      if (phase === 'correct') flashCorrect();
      else if (phase === 'wrong') showSolution('wrong');
    };
    function onSubmit() {
      const phase = s.submit(input.value);
      if (phase === 'invalid') { help.textContent = s.message || HELP_TEXT; help.classList.add('warn'); input.focus(); return; }
      after(phase);
    }
    function onChoose(i) { after(s.choose(i)); }

    // ---- keys (capture: before the game's own handlers)
    const onKey = (e) => {
      if (!card.isConnected) { cleanup(); resolve({ correct: false, skipped: true }); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const code = e.code;
      if (s.phase === 'ask' && q.type === 'choice') {
        const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
        if (m) {
          e.preventDefault(); e.stopPropagation();
          if (!e.repeat) { const i = Number(m[1]) - 1; if (i < q.choices.length) onChoose(i); }
        }
        return;
      }
      if (code === 'Enter' || code === 'NumpadEnter') {
        e.preventDefault(); e.stopPropagation();
        if (e.repeat) return;
        if (s.phase === 'ask' && q.type === 'number') onSubmit();
        else if ((s.phase === 'wrong' || s.phase === 'teach') && Date.now() - shownAt >= CONTINUE_DELAY_MS) finish();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const watch = setInterval(() => { if (!card.isConnected && !finished) { cleanup(); resolve({ correct: false, skipped: true }); } }, 500);
    function cleanup() {
      finished = true;
      window.removeEventListener('keydown', onKey, true);
      clearInterval(watch);
    }

    if (teacher) showSolution('teach');
    else if (input) setTimeout(() => { if (!finished) input.focus({ preventScroll: true }); }, 0);
  });
}

export const UNIT4_TOPICS = TOPICS;
export default createUnit4Provider;
