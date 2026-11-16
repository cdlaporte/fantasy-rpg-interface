# Package B (round 2): Unit 4 questions

## What changed

- `src/questions/unit4/` (new; `index.js` TOPICS unchanged):
  - `rng.js` seeded mulberry32; `util.js` number / linear-expression formatting and a linear solver with steps;
    `common.js` question assembly, choice mixing, `crossSolve` (Cross Product Property steps), `figOk`;
    `svg.js` figure builder (fit to <= ~420x260, label placement that avoids lines / arcs / marks / other labels,
    crop to content, stacked-fraction equations); `geom.js` triangle helpers (scalene integer triangles, layouts,
    shape checks).
  - One generator per topic: `ratio_simplest.js`, `extended_ratio.js`, `proportion.js`, `similar_missing_side.js`,
    `similarity_proof.js`, `triangle_proportionality.js`, `parallel_proportional.js`, `angle_bisector.js`.
    `generate(rng, difficulty)` -> `{id, topic, type, prompt, figure, answer|choices+answerIndex, accept, answerText,
    solution, data, difficulty}` (+ non-enumerable `figureMeta` for tests). Generators reject and retry any figure
    whose labels touch a line, and "Not similar" figures are checked to really not be similar.
  - `generators.js` registry + `generate(topicId, difficulty, seed)`; `session.js` the DOM-free answer flow;
    `provider.js` `createUnit4Provider({settings})`: topic choice (enabled topics, no repeat of the last 3),
    difficulty by context (gate 2, boss_shield 2-3, haggle/revive 1, else the request's), the card, typed answers,
    choices, "Correct!", wrong -> answer + worked solution + Continue, teacher mode -> answer + solution + Next
    (resolves correct), `preview(topic, difficulty, seed)`.
- `src/questions/answer.js` (new): `parseAnswer` / `checkAnswer` (12, -3, −3, 10.5, 21/2, 10 1/2, x = 12, units,
  spaces ignored; tolerance 0.01 or exact fraction).
- `src/questions/custom.js`: exports the Unit 4 provider (reads `Questions.teacher` / `Questions.topics`).
- `src/questions/index.js`: `Questions.preview(topicId, difficulty, seed)` (delegates to the provider).
- `src/ui/questionModal.js`: context labels renamed; the `.q4` card hides the modal head (CSS `:has`).
- `css/questions.css`: the card (parchment, prompt 21px, inputs/choices 20px, diagram <= 420x260), fits
  1366x657 and 1024x600 (checked in the e2e).
- `src/core/gates.js`: retry toast "Not quite. A new problem in 3 seconds."
- `src/core/inventory.js`: focus-scroll wrong toast "The scroll fizzles..." (behaviour unchanged: 25% power).
  Lesson/chest/haggle code already gave the smaller reward; with `lesson.blocking: false` lessons no longer retry.
- `docs/QUESTIONS.md` rewritten for the teacher.
- Tests: `tests/node/r2b-generators.test.mjs`, `tests/node/r2b-provider.test.mjs`,
  `tests/e2e/r2b-questions.cjs`. Shared tests changed: `meta-inventory.test.mjs` "lesson op" (stub part: no retry,
  2 of 3 right pays 10 XP / 4 gold) and one assertion in `meta-gates.test.mjs` (`custom.js` now exports the
  `unit4` provider instead of null).

## Other packages

- A (teacher options): list `TOPICS` from `src/questions/unit4/index.js` and store enabled ids in
  `Questions.topics`; set `Questions.teacher`. Both are read at ask time. Nothing else needed.
- Spec (progression, A): already opens the picker on a wrong answer; boons already give 2 choices when wrong.
- QA: `tests/e2e/smoke.cjs` answers the old placeholder card with `Digit1`; with `?questions=stub` the real Unit 4
  card is now shown. Use `__game.answerQuestion(true)` (works for every card), or for a real answer read
  `__game.game.questions.preview(...)` before asking.
- `ui.cjs` / `ui-fixtures.cjs` mount the stub provider directly and still work.

## Known gaps

- The parallel-lines figure is the most crowded one; about 3-4% of its labels sit slightly closer to a parallel
  line than to their own transversal piece (readable, never overlapping; overlaps are rejected).
- Teacher mode shows the same problem stream as students; there is no "show me topic X" menu (only the
  `Questions.preview` debug hook).
