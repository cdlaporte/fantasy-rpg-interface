// The answer flow of one question, without DOM (the provider renders it; Node tests drive it directly).
//   phase 'ask'     : waiting for an answer (typed or chosen)
//   phase 'correct' : right; the provider flashes "Correct!" and finishes with {correct: true}
//   phase 'wrong'   : wrong; the answer and the worked solution are shown until Continue -> {correct: false}
//   phase 'teach'   : teacher mode; answer + solution shown at once, Next -> {correct: true}
import { checkAnswer } from '../answer.js';

export const HELP_TEXT = 'Type a number, like 12, -3, 10.5 or 21/2.';

export function createSession(q, { teacher = false } = {}) {
  const s = {
    q, teacher,
    phase: teacher ? 'teach' : 'ask',
    given: null,          // typed text or chosen index
    message: '',
    /** Typed answer. Returns the new phase, or 'invalid' (nothing counted) / 'ignored'. */
    submit(raw) {
      if (s.phase !== 'ask' || q.type !== 'number') return 'ignored';
      const r = checkAnswer(q, raw);
      if (r.invalid) { s.message = String(raw || '').trim() ? HELP_TEXT : 'Type your answer first.'; return 'invalid'; }
      s.given = String(raw);
      s.message = '';
      s.phase = r.ok ? 'correct' : 'wrong';
      return s.phase;
    },
    /** Multiple choice (0-based). */
    choose(i) {
      if (s.phase !== 'ask' || q.type !== 'choice') return 'ignored';
      if (!(i >= 0 && i < q.choices.length)) return 'ignored';
      s.given = i;
      s.phase = i === q.answerIndex ? 'correct' : 'wrong';
      return s.phase;
    },
    /** What the gate gets once the card is done. */
    result() {
      if (s.phase === 'correct' || s.phase === 'teach') return { correct: true, skipped: false };
      if (s.phase === 'wrong') return { correct: false, skipped: false };
      return null;
    },
  };
  return s;
}
