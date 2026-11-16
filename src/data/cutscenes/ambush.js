// ambush: Malgrim and two hexguards seal the clearing. A real fight the player cannot win (HP floor 1).
// Started by the intro zone trigger at `clearing` (if tutorial_done and not ambush_done). Chains into `rescue`.
// `fx` steps may give `at` (a marker name, 'player', an npc/entity id string or '@tag'); Story resolves x/y from it,
// one event per entity for '@tag'.
import { tutorialStep as tut } from '../../platform/bindings.js';  // round 2: key names follow the bindings
export default {
  ambush: {
    id: 'ambush', skippable: false,
    steps: [
      ['lockInput'],
      ['letterbox', true],
      ['tutorial', null],
      ['camera', { to: 'clearing', zoom: 1.1, t: 1.0 }],
      ['sfx', 'spell'],
      ['spawn', 'ambush_barrier', 'clearing', { tag: 'barrier' }],
      ['fx', { type: 'ring', at: 'clearing', r: 4, color: '#b48cff', dur: 0.8 }],
      ['fx', { type: 'sparkle', at: 'clearing', n: 24, r: 4, color: '#c9b6ff' }],
      ['wait', 0.6],
      ['fx', { type: 'poof', at: 'malgrim_spot', color: '#9a3fd0' }],
      ['spawn', 'malgrim', 'malgrim_spot', { tag: 'malgrim' }],
      ['wait', 0.3],
      ['fx', { type: 'poof', at: 'hex_1', color: '#8a6ac4' }],
      ['spawn', 'hexguard', 'hex_1', { tag: 'hexguards' }],
      ['fx', { type: 'poof', at: 'hex_2', color: '#8a6ac4' }],
      ['spawn', 'hexguard', 'hex_2', { tag: 'hexguards' }],
      ['camera', { to: 'malgrim_spot', zoom: 1.3, t: 0.6 }],
      ['say', 'malgrim', 'Well, well, WELL. A lone traveler on MY road. How deliciously convenient.', { mood: 'happy' }],
      ['say', 'malgrim', 'I am Malgrim the Sealweaver! Weaver of seals! Sealer of... weaves!', { mood: 'proud' }],
      ['say', 'malgrim', 'Nobody leaves my barrier. I spent ALL MORNING on it.', { mood: 'proud' }],
      ['bubble', 'player', '!', 1.2],
      ['say', 'malgrim', 'Hexguards! Teach this nobody some manners. Gently. Ish.', { mood: 'annoyed' }],
      ['cameraReset'],
      ['letterbox', false],
      ['unlockInput'],
      tut('Trapped! Fight back!', 'attack'),
      ['control', { until: ['hp', 'player', '<=', 1], minHp: 1 }],
      ['tutorial', null],
      ['flag.set', 'ambush_done', true],
      ['cutscene', 'rescue'],
    ],
  },
};
