// Question modal {req, mount(el) -> Promise}: the UI provides a framed element; the provider renders into it and
// resolves the gate itself (keys belong to the provider while this modal is open). Lesson modal
// {teacher, title, total, done, correct}: a progress card; Enter closes it (gates drive the questions).
import { el, add, clear } from './dom.js';
import { K, hints, livePortrait } from './modalKit.js';

const CONTEXT_LABEL = {
  levelup: 'Level up!', boon: 'Boon trial', spec: 'Specialization trial', gate: 'Rune seal', chest: 'Rune chest',
  boss_shield: 'Break the shield!', focus: 'Focus', lesson: 'Lesson', quest_turnin: 'Bonus question', haggle: 'Haggle',
  revive: 'Second chance',
};

export function createQuestionModal(modal, ctx) {
  const root = el('div', 'question');
  const box = el('div', 'question-box px-box');
  const req = modal.req || {};
  const head = el('div', 'question-head');
  add(head, el('div', 'question-title pxfont', CONTEXT_LABEL[req.context] || 'Question'));
  if (req.optional) head.appendChild(el('div', 'question-opt', 'Optional'));
  const mountEl = el('div', 'question-mount');
  add(box, head, mountEl);
  root.appendChild(box);
  let mounted = false;
  return {
    el: root, layer: 'center', dim: true, passKeys: true,
    attached() {
      if (mounted || typeof modal.mount !== 'function') return;
      mounted = true;
      try {
        const p = modal.mount(mountEl);
        if (p && p.catch) p.catch((e) => console.warn('[ui] question mount failed', e));
      } catch (e) { console.warn('[ui] question mount threw', e); }
    },
    key() { return false; },
    destroy() { root.remove(); },
  };
}

export function createLessonModal(modal, ctx) {
  const game = ctx.game;
  const root = el('div', 'lesson');
  const box = el('div', 'lesson-box px-box');
  const npcs = (game.data && game.data.npcs) || {};
  const teacher = npcs[modal.teacher] || null;
  const look = modal.teacher === 'laporte' ? 'laporte' : teacher && teacher.look;
  let portrait = null;
  const head = el('div', 'lesson-head');
  if (look) {
    const pf = el('div', 'lesson-portrait');
    portrait = livePortrait(look, 'calm', 'academy', 'lesson-portrait-canvas');
    pf.appendChild(portrait.canvas);
    head.appendChild(pf);
  }
  const titles = el('div', 'lesson-titles');
  const total = modal.total || 0, done = modal.done || 0, correct = modal.correct || 0;
  add(titles, el('div', 'lesson-kicker pxfont', 'LESSON'), el('div', 'lesson-title', modal.title || 'Class is in session'),
    el('div', 'lesson-teacher', teacher ? teacher.name : modal.teacher === 'laporte' ? 'Mr. Laporte' : modal.teacher || ''));
  head.appendChild(titles);
  const dots = el('div', 'lesson-dots');
  for (let i = 0; i < total; i++) {
    const d = el('i', 'ldot');
    if (i < done) d.classList.add(i < correct ? 'ok' : 'miss');
    dots.appendChild(d);
  }
  const finished = total > 0 && done >= total;
  const msg = el('div', 'lesson-msg', finished
    ? (correct === total ? 'Perfect marks! Well done.' : correct > 0 ? `${correct} of ${total} correct. Good effort!` : 'Practice makes perfect. Try again later!')
    : `${done} of ${total} done · ${correct} correct`);
  add(box, head, dots, msg, hints([['Enter', finished ? 'Finish' : 'Continue']]));
  root.appendChild(box);
  if (portrait && finished) portrait.mood = correct === total ? 'proud' : 'happy';
  return {
    el: root, layer: 'center', dim: true,
    tick(now) { if (portrait) portrait.draw(now / 1000); },
    key(e) {
      if (K.ok(e.code) || K.back(e.code)) { if (!e.repeat) { ctx.sfx('ui_ok'); game.commands.closeModal(); } return true; }
      return false;
    },
    destroy() { clear(root); root.remove(); },
  };
}

export default createQuestionModal;
