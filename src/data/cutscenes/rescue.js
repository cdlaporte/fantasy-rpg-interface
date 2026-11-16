// rescue: the showpiece. At 1 HP the world holds its breath, Malgrim winds up, and Mr. Laporte strolls in.
// One enormous spell, a potion, "Remind me who you are again?", the look picker, the reveal, the escort to town.
// Chained from `ambush`; chains into `town_arrival` after the travel.
// Assumes: entities named by move/face/anim are `data.scripted` until the cutscene ends (so the ambushers stop
// attacking), and player.data.minHp = 1 set by the ambush `control` stays until this cutscene's heal.
import { tutorialStep as tut } from '../../platform/bindings.js';  // round 2: key names follow the bindings
const DOWN = 2;

export default {
  rescue: {
    id: 'rescue', skippable: false,
    steps: [
      ['lockInput'],
      ['anim', '@hexguards', 'idle', 0.1],
      ['anim', 'malgrim', 'charge', 2.4],
      ['letterbox', true],
      ['fx', { type: 'screenFlash', color: '#c9b6ff', dur: 0.4 }],
      ['camera', { to: 'player', zoom: 1.6, t: 0.5 }],
      ['anim', 'player', 'hurt', 1.0],
      ['wait', 0.6],
      ['camera', { to: 'malgrim', zoom: 1.4, t: 0.6 }],
      ['fx', { type: 'sparkle', at: 'malgrim', n: 30, r: 1.4, color: '#c86bff' }],
      ['sfx', 'spell'],
      ['say', 'malgrim', 'Any last words? No? Splendid. I do hate long goodbyes.', { mood: 'happy' }],
      ['say', 'laporte', 'Excuse me.', { mood: 'calm' }],
      ['say', 'malgrim', 'Who said that?! Who dares interrupt a villain mid-cackle?', { mood: 'shocked' }],

      // Entrance.
      ['spawn', 'laporte', 'laporte_arrive', { tag: 'laporte' }],
      ['sfx', 'laporte'],
      ['parallel', [
        ['move', 'laporte', 'laporte_stand', { speed: 2.2 }],
        ['camera', { to: 'laporte_stand', zoom: 1.25, t: 1.6 }],
      ]],
      ['face', 'laporte', DOWN],
      ['say', 'laporte', 'Is this your barrier?', { mood: 'calm' }],
      ['say', 'malgrim', 'It is! Hand-woven! Forty layers of pure, unbreakable—', { mood: 'proud' }],
      ['anim', 'laporte', 'cast', 0.5],
      ['fx', { type: 'hit', at: 'laporte_stand', color: '#9fe6ff' }],
      ['despawn', 'barrier'],
      ['fx', { type: 'burst', at: 'clearing', n: 40, r: 4, color: '#b48cff' }],
      ['fx', { type: 'ring', at: 'clearing', r: 4.5, color: '#ffffff', dur: 0.5 }],
      ['sfx', 'poof'],
      ['wait', 0.5],
      ['say', 'laporte', 'It was a nice barrier.', { mood: 'calm' }],
      ['say', 'malgrim', 'HEXGUARDS! GET HIM!', { mood: 'annoyed' }],
      ['say', 'laporte', 'Okay. Eyes up here, please.', { mood: 'calm' }],

      // The spell.
      ['camera', { to: 'clearing', zoom: 0.95, t: 0.5 }],
      ['anim', 'laporte', 'cast', 1.6],
      ['fx', { type: 'pillar', at: 'laporte', r: 1.3, color: '#9fe6ff', dur: 1.4 }],
      ['fx', { type: 'sparkle', at: 'laporte', n: 40, r: 2, color: '#ffffff' }],
      ['sfx', 'spell'],
      ['wait', 0.9],
      ['fx', { type: 'screenFlash', color: '#ffffff', dur: 0.35 }],
      ['fx', { type: 'bolt', at: '@hexguards', color: '#ffe14d' }],
      ['fx', { type: 'bolt', at: 'malgrim', color: '#ffe14d' }],
      ['fx', { type: 'shockwave', at: 'laporte', r: 8, color: '#9fe6ff' }],
      ['camera', { shake: 0.9 }],
      ['sfx', 'boss'],
      ['kill', { tag: 'hexguards' }],
      ['wait', 0.8],
      ['anim', 'malgrim', 'hurt', 1.0],
      ['say', 'malgrim', 'Ow. OW. My good robe!', { mood: 'shocked' }],
      ['say', 'malgrim', 'You have not seen the last of Malgrim the Sealweaver! Toodle-oo!', { mood: 'annoyed' }],
      ['fx', { type: 'poof', at: 'malgrim', color: '#9a3fd0' }],
      ['fx', { type: 'smoke', at: 'malgrim', r: 1.5, dur: 1.2 }],
      ['despawn', 'malgrim'],
      ['sfx', 'poof'],
      ['wait', 0.6],
      ['say', 'laporte', 'He will be back. They always come back.', { mood: 'calm' }],

      // The potion.
      ['cameraReset'],
      ['move', 'player', 'clearing', { speed: 1.4 }],
      ['move', 'laporte', 'clearing', { speed: 2, stopAt: 2.1 }],   // far enough that the sprites never overlap
      ['face', 'laporte', DOWN],
      ['say', 'laporte', 'You look terrible. Here.', { mood: 'calm' }],
      ['give', 'potion_small', 1, { slot: 0 }],   // slot 0 = key 1, even if rat cheese is already there
      ['sfx', 'pickup'],
      ['letterbox', false],
      tut('Press [item1] to drink the potion.', 'item1'),
      // integration: "drank it" = HP rose above the ambush floor (the giant rat may have dropped a second potion,
      // so "no potion left" could never become true)
      ['control', { until: ['hp', 'player', '>', 1] }],
      ['tutorial', null],
      ['lockInput'],
      ['letterbox', true],
      ['heal'],
      ['fx', { type: 'heal', at: 'player' }],
      ['say', 'laporte', 'Better. Okay.', { mood: 'calm' }],

      // The reveal.
      ['say', 'laporte', 'Remind me who you are again?', { mood: 'calm' }],
      ['lookPicker'],
      ['flag.set', 'look_chosen', true],
      ['setLook', 'player', '$chosen'],
      ['fx', { type: 'poof', at: 'player', color: '#ffffff' }],
      ['fx', { type: 'sparkle', at: 'player', n: 24, r: 1.2, color: '#ffe680' }],
      ['sfx', 'poof'],
      ['camera', { to: 'player', zoom: 1.5, t: 0.4 }],
      ['wait', 0.6],
      ['say', 'laporte', 'Ah, yes. {name}. You must be the new student.', { mood: 'happy' }],
      ['say', 'laporte', 'You are late. Also, you were attacked. Mostly the first thing.', { mood: 'calm' }],
      ['say', 'laporte', 'This road is dangerous. Follow me.', { mood: 'calm' }],
      ['cameraReset'],
      ['letterbox', false],

      // The escort.
      tut('Follow Mr. Laporte.', 'move'),
      ['escort', 'laporte', { to: 'exit_town' }],
      ['tutorial', null],
      ['flag.set', 'intro_done', true],
      ['save'],
      ['travel', 'town', 'gate_south'],
      ['wait', 0.4],
      ['cutscene', 'town_arrival'],
    ],
  },
};
