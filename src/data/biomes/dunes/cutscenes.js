// Sunscorch Dunes: the sphinx fight. dunes_boss_intro: played by the zone trigger at the arena mouth (if
// sandsnout_defeated is unset). dunes_boss_outro: run by sultana_sandsnout.onDeath.do.
const DOWN = 2;

export default {
  dunes_boss_intro: {
    id: 'dunes_boss_intro', zone: 'dunes', skippable: true,
    // integration: the zone keeps Sandsnout as a `spawns` entry (present whenever she is undefeated), so this scene
    // only spawns her when she is missing (spawn opt `unique`).
    onSkip: [['spawn', 'sultana_sandsnout', 'boss_spawn', { tag: 'boss', unique: true }], ['sfx', 'boss']],
    steps: [
      ['lockInput'],
      ['letterbox', true],
      ['camera', { to: 'boss_arena', zoom: 0.9, t: 1.6 }],
      ['wait', 0.4],
      ['camera', { shake: 0.3 }],
      ['fx', { type: 'smoke', at: 'boss_arena', r: 2.5, dur: 1.5, color: '#e8c070' }],
      ['wait', 0.5],
      ['camera', { shake: 0.6 }],
      ['fx', { type: 'shockwave', at: 'boss_arena', r: 4, color: '#e8b84a' }],
      ['spawn', 'sultana_sandsnout', 'boss_spawn', { tag: 'boss', unique: true }],   // unique: no-op when the zone spawn exists
      ['anim', 'sultana_sandsnout', 'charge', 1.2],
      ['fx', { type: 'burst', at: 'boss_arena', n: 30, r: 3, color: '#f0d090' }],
      ['sfx', 'boss'],
      ['say', 'sultana_sandsnout', 'Ahhh. A visitor. How delightful. Nobody has solved my riddles in a very long lunch.', { mood: 'happy' }],
      ['bubble', 'player', 'Um. Hello?', 1.4],
      ['say', 'sultana_sandsnout', 'I am Sultana Sandsnout, keeper of the Sun Gate. Or the nap spot. The sign has faded.', { mood: 'calm' }],
      ['say', 'sultana_sandsnout', 'Fight me, by all means. But when I shield myself, I shall ask you a riddle.', { mood: 'calm' }],
      ['say', 'sultana_sandsnout', 'Answer true and the shield shatters. Answer wrong and I get to gloat. I adore gloating.', { mood: 'happy' }],
      ['cameraReset'],
      ['letterbox', false],
      ['toast', 'When Sandsnout shields up, answer her riddle to break the shield!', 'info'],
      ['unlockInput'],
    ],
  },

  dunes_boss_outro: {
    id: 'dunes_boss_outro', zone: 'dunes', skippable: true,
    onSkip: [['flag.set', 'sandsnout_defeated', true], ['chest', 'boss_sandsnout', { id: 'sandsnout' }], ['save']],
    steps: [
      ['lockInput'],
      ['letterbox', true],
      ['camera', { to: 'boss_arena', zoom: 1.2, t: 1.0 }],
      ['fx', { type: 'sparkle', at: 'boss_arena', n: 50, r: 3, color: '#ffe680' }],
      ['fx', { type: 'poof', at: 'boss_arena', color: '#ffffff' }],
      ['spawn', 'sandsnout_kit', 'boss_arena', { tag: 'sandsnout' }],
      ['wait', 0.8],
      ['say', 'sandsnout_kit', '...impossible. Both riddles. Even the one I made up on the spot.', { mood: 'shocked' }],
      ['say', 'sandsnout_kit', 'Fine. FINE. Take my circlet. It slips off my ears anyway. Come back and riddle me again.', { mood: 'annoyed' }],
      ['flag.set', 'sandsnout_defeated', true],
      ['chest', 'boss_sandsnout', { id: 'sandsnout' }],
      ['anim', 'sandsnout_kit', 'sleep', 2],
      ['wait', 0.6],
      ['fx', { type: 'pillar', at: 'player', r: 1.0, color: '#9fe6ff', dur: 1.0 }],
      ['fx', { type: 'poof', at: 'player', color: '#9fe6ff' }],
      ['spawn', 'laporte', 'boss_arena', { tag: 'laporte', offset: [0, 3] }],
      ['sfx', 'laporte'],
      ['face', 'laporte', DOWN],
      ['say', 'laporte', 'Well solved. For the record, I would have answered the second one faster.', { mood: 'proud' }],
      ['say', 'laporte', 'She is a sphinx. Riddles are a love language here. Be kind to her.', { mood: 'calm' }],
      ['say', 'sandsnout_kit', 'Mm. Headmaster. You owe me a riddle from the third century.', { mood: 'happy' }],
      ['say', 'laporte', 'I will think about it. Ziva will want to hear the road is clear.', { mood: 'calm' }],
      ['fx', { type: 'poof', at: 'laporte', color: '#9fe6ff' }],
      ['despawn', 'laporte'],
      ['cameraReset'],
      ['letterbox', false],
      ['unlockInput'],
      ['save'],
    ],
  },
};
