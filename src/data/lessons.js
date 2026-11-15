// Lessons (CONTRACTS 13a): {id, teacher, title, questions, difficulty, tags, reward: {xpEach, goldEach}}.
// Run through the Meta `lesson` op from the teachers' dialogues (data/dialogues/academy.js).
// Added fields: room (academy marker), blurb (one line shown by dialogue/UI), hours [from, to].
export default {
  lesson_1: {
    id: 'lesson_1', teacher: 'quill', title: 'Arithmancy 101: Counting Your Chickens',
    room: 'classroom_1', blurb: 'Numbers are spells that always work. Mostly.',
    questions: 3, difficulty: 1, tags: ['lesson', 'arithmancy'], reward: { xpEach: 15, goldEach: 4 }, hours: [8, 17],
  },
  lesson_2: {
    id: 'lesson_2', teacher: 'rook', title: 'Runes & Ratios',
    room: 'classroom_2', blurb: 'A rune out of proportion is just a scribble.',
    questions: 3, difficulty: 2, tags: ['lesson', 'runes'], reward: { xpEach: 25, goldEach: 6 }, hours: [9, 18],
  },
};
