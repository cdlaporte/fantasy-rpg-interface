// intro_wake: wordless start on the country road, then the tutorial (move, pick up the stick, attack, rats).
// The player keeps control between prompts (`control` steps). Kill counting and "walked far enough" come from the
// main_enroll quest goals (see data/quests/main.js), so waits use ['quest', 'main_enroll', 'step', n] (0-based).
// Started by the Story system on a new game in zone `intro` (or by a zone trigger at `start` if not tutorial_done).
const UP = 0;
const ARROWS = ['↑', '←', '↓', '→'];

export default {
  intro_wake: {
    id: 'intro_wake', skippable: false,
    steps: [
      ['lockInput'],
      ['letterbox', true],
      ['spawn', 'stick_pickup', 'stick', { tag: 'stick_pickup' }],
      ['camera', { to: 'start', zoom: 1.4, t: 0 }],
      ['wait', 1.2],
      ['face', 'player', UP],
      ['parallel', [
        ['move', 'player', 'walk_1', { speed: 1.6 }],
        ['camera', { to: 'walk_1', zoom: 1.1, t: 3 }],
      ]],
      ['wait', 0.4],
      ['bubble', 'player', '...', 1.4],
      ['wait', 1.2],
      ['quest.start', 'main_enroll'],
      ['cameraReset'],
      ['letterbox', false],
      ['unlockInput'],

      ['tutorial', 'Walk with W A S D.', ['W', 'A', 'S', 'D']],
      ['control', { until: ['quest', 'main_enroll', 'step', 1] }],
      ['tutorial', 'Something on the road. Walk up to it and press E.', ['E']],
      ['control', { until: ['flag', 'has_stick'] }],

      ['spawn', 'rat', 'rats_1', { tag: 'tut_rats' }],
      ['spawn', 'rat', 'rats_1', { tag: 'tut_rats', offset: [1, 0] }],
      ['spawn', 'rat', 'rats_1', { tag: 'tut_rats', offset: [-1, 1] }],
      ['tutorial', 'Rats! Attack with the arrow keys (or I J K L).', ARROWS],
      ['control', { until: ['quest', 'main_enroll', 'step', 3] }],

      ['spawn', 'rat', 'rats_2', { tag: 'tut_rats' }],
      ['spawn', 'rat', 'rats_2', { tag: 'tut_rats', offset: [1, 0] }],
      ['spawn', 'rat', 'rats_2', { tag: 'tut_rats', offset: [-1, 0] }],
      ['spawn', 'rat', 'rats_2', { tag: 'tut_rats', offset: [0, 1] }],
      ['tutorial', 'Nice! Hold an arrow key to keep swinging. More rats ahead.', ARROWS],
      ['control', { until: ['quest', 'main_enroll', 'step', 4] }],

      ['spawn', 'giant_rat', 'big_rat', { tag: 'tut_boss' }],
      ['tutorial', 'A big one! When it crouches, step aside. Then bonk.', ['W', 'A', 'S', 'D']],
      ['control', { until: ['quest', 'main_enroll', 'step', 5] }],

      ['tutorial', 'Well done! The road to Flinkerton continues north.', ['W']],
      ['wait', 2.5],
      ['tutorial', null],
      // Set last: the ambush trigger at `clearing` requires it, so it can never fire while this cutscene runs.
      ['flag.set', 'tutorial_done', true],
      ['save'],
    ],
  },
};
