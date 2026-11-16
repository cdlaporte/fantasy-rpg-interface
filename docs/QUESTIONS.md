# Math questions in Flinkerton Academy

This guide is for Mr. Laporte. It explains which problems the game asks, where they appear, what happens on a
wrong answer, teacher mode, how to switch topics off, and how a future unit can be added. Everything about
questions lives in one folder: `src/questions/`.

The game asks **Geometry C, Unit 4: Similar Figures** problems, built from the Unit 4 notes packet. Every problem is
generated fresh (new numbers, new letters, new drawings), so students cannot memorize answers from a friend's
screen, and problems are picked at random from the unit and scattered through the game.

As you asked, the game **never** asks students to complete a similarity statement ("ΔLMN ~ ____") and has **no**
scale-factor or perimeter-ratio problems (those were covered in an earlier unit). The words "scale factor" never
appear. When a problem needs a similarity statement, the game *gives* it ("If ΔABC ~ ΔDEF, find the value of x").

---

## 1. What a question looks like

The question card shows, from top to bottom:

- **Where it comes from** ("Rune gate", "Boss shield", "Level-up bonus", ...) and what is at stake
  ("Answer correctly to break the seal.").
- **The topic** ("Day 4 · Triangle Angle Bisector Theorem").
- **The problem**, and a **diagram** when the problem has one. Diagrams are drawn to scale from real coordinates
  (lengths and angles really match the labels), in the packet's style: vertex letters, side lengths, angle arcs and
  degree measures, matching arcs for congruent angles, right-angle boxes, parallel arrows, and dimension lines
  (|--- 27 ---|) for a whole length.
- **The answer area**:
  - *Typed answers*: a box with "x =" in front. Press **Enter** (or click **Check**). Accepted forms: `12`, `-3`,
    `10.5`, `21/2`, `10 1/2`, `x = 12`; spaces are ignored and the answer counts if it is within 0.01 or is the exact
    fraction. Something that is not a number (or an empty box) is not counted as wrong: the card just says
    "Type a number, like 12, -3, 10.5 or 21/2."
  - *Multiple choice*: press **1**-**4** or click.

Keys typed into the answer box never reach the game (typing "wasd" or "1" will not move or use an item).

**Right answer:** a short "Correct!" and the game carries on.
**Wrong answer:** "Not quite. The answer is x = 15." with the **worked solution** (the same steps as the notes:
which sides correspond, the proportion, cross multiply, solve, check). The student reads it and presses **Enter**
(or **Continue**). Enter is ignored for the first half second so a double-tap cannot skip the solution.

## 2. The topics

All answers are whole numbers or halves (typed problems) unless a decimal is part of the problem, as in the packet.

| Day | Topic (id) | What the problems look like | Answer |
| --- | --- | --- | --- |
| 1 | Ratios in simplest form (`ratio_simplest`) | "A school district has 28 elementary schools and 16 middle schools...", treadmills to ellipticals, a team's **wins to losses** from games played and won, **vowels to total letters** in a word (FLASHLIGHT), a music store's instruments (one kind to another, or to the total). | Multiple choice like `7:4`. The wrong choices are the usual mistakes: not simplified, half simplified, reversed, wins to *total*, vowels to consonants. |
| 1 | Extended ratios (`extended_ratio`) | Two complementary or supplementary angles in the ratio 3:7 (find the smaller / larger); the angles of a triangle in the ratio 4:7:9 (find the largest, smallest or a named angle); the sides of a triangle in the ratio 21:8:14 with a given perimeter (find a side). | Typed number (degrees or the length). |
| 1 | Solving proportions (`proportion`) | Shown as stacked fractions. Level 1: `4/x = 2/7`, `9/16 = x/12`. Level 2: `(x − 3)/18 = 12/9`, `7/11 = 18/(x + 1)`. Level 3: `(x − 16)/(x + 6) = 3/5`, `6/(x + 16) = 7/(3x + 3)`, `(x − 9)/15 = (2x − 9)/10`. | Typed x. |
| 2 | Missing sides of similar triangles (`similar_missing_side`) | "If ΔABC ~ ΔDEF, find the value of x." Two similar triangles drawn in different sizes and turned / flipped differently, or overlapping: a bow-tie meeting at vertical angles (parallel or crossed), or a small triangle inside a big one with parallel sides (the student adds the pieces). The unknown side is x or an expression such as `x + 9`, `3x − 9`, `14x + 14`. | Typed x. |
| 3 | Similar by AA, SSS or SAS? (`similarity_proof`) | "Are the triangles similar? If so, by which rule?" Two angle measures in each triangle (the third may need computing), three side lengths in each, two sides with a marked congruent included angle, bow-ties at vertical angles with parallel arrows / right angles / marked angles or with four side lengths, a triangle with a segment across it (shared angle). About a quarter are near misses that are **not** similar (one angle matches, or the ratios are 1.25 vs 1.28). | Always the same four choices: Similar by AA / Similar by SSS / Similar by SAS / Not similar. |
| 4 | Triangle Proportionality Theorem (`triangle_proportionality`) | A segment parallel to one side (parallel arrows); find x from the four pieces (numbers or `3x + 2`); at level 3 sometimes one whole side is given on a dimension line. Also the converse: "Is MN parallel to JL?" from four lengths (no arrows drawn). | Typed x, or Yes / No. |
| 4 | Parallel lines and proportional parts (`parallel_proportional`) | Three parallel lines (arrows) cut by two transversals; find x. Level 2 has one expression (`x + 5`), level 3 one expression on each transversal (`(2x + 2)/21 = (x + 3)/12`) or a whole transversal length. | Typed x. |
| 4 | Triangle Angle Bisector Theorem (`angle_bisector`) | "BD bisects ∠ABC" (two matching arcs); find a missing segment or side, or an expression; at level 3 the whole opposite side may be the unknown or the given (dimension line). | Typed x. |

**Difficulty.** Each topic has levels 1-3. Rune gates ask level 2; boss shields level 2 or 3; haggling and the
second-chance question level 1; boon (power-up) questions follow the student's level (1 at level 4, 2 at levels 6-8,
3 at levels 10-12); lessons use the lesson's own level; rune chests, focus scrolls and quest bonuses use the level
set where they are placed (usually 2).

The game avoids repeating the same topic within the last three questions.

## 3. Where questions appear, and what a wrong answer does

Only **rune gates** and **boss shields** must be answered correctly. Everywhere else a wrong answer just gives a
smaller reward (after the worked solution is shown).

| Where | Right answer | Wrong answer |
| --- | --- | --- |
| **Rune gate** (glowing seals in the forest) | The seal breaks. | Worked solution, then a **new** problem after 3 seconds, until one is right. |
| **Boss shield** (Old Mossback, twice per fight) | The shield shatters, the boss is stunned. | Worked solution, then a **new** problem after 3 seconds, until one is right. |
| Level-up bonus (boons, levels 4-12) | Choose from 3 boons. | Choose from 2 boons. |
| Specialization (level 8, Laporte's office) | The choice opens. | The choice opens anyway (no bonus). |
| Rune chest | Bonus treasure. | The normal treasure. |
| Lesson (several questions in a row) | XP and gold for each right answer. | That question pays nothing; the lesson goes on (no retry). |
| Quest bonus (handing in a quest) | +25% reward. | The normal reward. |
| Haggling (shop button) | 20% off this visit. | Normal prices (one try per visit). |
| Focus scroll (item) | Full power, every ability ready, +50% damage for 6 s. | The scroll fizzles: only a little power comes back. |
| Second chance (knocked out, at most every 5 minutes) | Back up on the spot. | Wake up in the Academy infirmary. |

These rules are in `src/config.js` (`questions.contexts`): `blocking: true` means "must be right";
`enabled: false` switches a place off (it then simply gives the reward).

## 4. Teacher mode

In teacher mode (PIN-protected teacher options) every question card shows a blue **TEACHER MODE** badge, the
**answer** (highlighted choice, or the number already in the box) and the **worked solution** right away, with a
**Next** button (Enter). Next counts as a right answer, so you can walk through the game and show problems to the
class without being stopped.

## 5. Switching topics off

The teacher options screen lists the eight topics as toggles (for example, turn everything off except the Day 1
topics before your class has reached Day 2). The game stores the choice in `Questions.topics` (a list of the topic
ids in the table above; empty or "all on" means every topic). Turning every topic off counts as "all on", so the
game never runs out of problems.

Other switches, added to the game's address:

| Address ending | What happens |
| --- | --- |
| *(nothing)* | Normal play with Unit 4 questions. |
| `?questions=off` | No questions at all; everything a question would unlock is simply given. |
| `?questions=auto` | No question window; every question counts as right (automated testing). |
| `?questions=stub` | Always ask (same as normal play). |

The game is never stuck on a question: if the window is closed or something fails, the game moves on.

## 6. Adding a future unit

A unit is a folder in `src/questions/` with:

1. `index.js` exporting `UNIT = {id, name}` and `TOPICS = [{id, day, name}, ...]` (the ids are what
   `Questions.topics` stores and what the teacher options list).
2. One **generator module per topic**, each exporting `generate(rng, difficulty)` that returns a problem:

   ```js
   {
     id, topic, difficulty,            // difficulty 1-3
     type: 'number' | 'choice',
     prompt: 'Find the value of x.',
     figure: '<svg ...>' | null,       // optional diagram (unit4/svg.js draws them from coordinates)
     answer: 12,                       // type 'number'
     accept: { tolerance: 0.01, fraction: [21, 2] | null },
     answerText: 'x = 12',             // shown with the solution
     choices: ['...', '...'], answerIndex: 0,   // type 'choice'
     solution: ['step 1', 'step 2', ...],       // the worked solution
   }
   ```

   `rng` is a seeded random generator (`unit4/rng.js`): the same seed always gives the same problem, so problems
   can be tested and shown again. Generators are plain JavaScript with no page code, so the Node tests run them.
3. A registry like `unit4/generators.js` (topic id → generator) and a provider like `unit4/provider.js`
   (`createUnit4Provider` already does topic picking, difficulty, the card, typed answers, choices, the worked
   solution and teacher mode; a new unit can reuse it by pointing it at its own registry).
4. Install the provider in `src/questions/custom.js` (`export default` the provider; `export default null` brings
   back the placeholder card).

The Unit 4 code is a complete example (`src/questions/unit4/`); the tests in `tests/node/r2b-generators.test.mjs`
show how every generator is checked (500 seeds x 3 levels: the answer is right, choices are unique with one right
answer, diagrams are well formed and labels never sit on a line).

## 7. For developers

- `Questions.preview(topicId, difficulty, seed)` (debug / e2e): the next question asked is exactly that problem.
  Example in the console with `?debug=1`:
  `__game.game.questions.preview('angle_bisector', 3, 7); __game.game.gates.ask({context: 'gate'})`.
- Tests: `node --test tests/node` (generators, answer parser, provider flow) and
  `node tests/e2e/r2b-questions.cjs` (every topic and level on screen in student and teacher mode, typed right and
  wrong answers, the retry, 1024x600; screenshots in `tests/e2e/out/r2b/`).
