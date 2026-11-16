// The question provider the game uses for players (main.js installs this default export when it is not null).
//
// Round 2: Mr. Laporte's Geometry C Unit 4 "Similar Figures" problems, generated fresh every time from the
// topics in src/questions/unit4/ (see docs/QUESTIONS.md). Teacher mode and the enabled topics are read from the
// shared Questions object (Questions.teacher, Questions.topics).
//
// To go back to the placeholder card, export null instead. To use another unit later, build its provider the same
// way (a folder with generators + TOPICS, see docs/QUESTIONS.md) and export it here.
import Questions from './index.js';
import { createUnit4Provider } from './unit4/provider.js';

const provider = createUnit4Provider({ settings: () => Questions });

export default provider;
