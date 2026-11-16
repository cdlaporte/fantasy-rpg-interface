// The grove finale. forest_boss_intro: started by the forest zone trigger at `boss_arena`
// (if quest forest_sealed_grove is active and mossback_defeated is unset). forest_boss_outro: run by
// old_mossback.onDeath.do when he is defeated.
const DOWN = 2;

export default {
  forest_boss_intro: {
    id: 'forest_boss_intro', skippable: true,
    // integration: the forest zone keeps Old Mossback as a `spawns` entry (present whenever he is undefeated, also
    // after a defeat-and-return), so this scene only spawns him when he is missing (spawn opt `unique`).
    onSkip: [['spawn', 'old_mossback', 'boss_spawn', { tag: 'boss', unique: true }], ['sfx', 'boss']],
    steps: [
      ['lockInput'],
      ['letterbox', true],
      ['camera', { to: 'boss_arena', zoom: 0.9, t: 1.6 }],
      ['wait', 0.4],
      ['camera', { shake: 0.4 }],
      ['fx', { type: 'smoke', at: 'boss_arena', r: 2.5, dur: 1.5 }],
      ['wait', 0.6],
      ['camera', { shake: 0.7 }],
      ['fx', { type: 'shockwave', at: 'boss_arena', r: 4, color: '#5fb548' }],
      ['spawn', 'old_mossback', 'boss_spawn', { tag: 'boss', unique: true }],   // unique: no-op when the zone spawn exists
      ['anim', 'old_mossback', 'charge', 1.2],
      ['fx', { type: 'burst', at: 'boss_arena', n: 30, r: 3, color: '#7cc95a' }],
      ['sfx', 'boss'],
      ['say', 'old_mossback', 'HRRRRMMMM. WHO... STOMPS... IN MY... GROVE?', { mood: 'annoyed' }],
      ['bubble', 'player', 'Um. Hi?', 1.4],
      ['say', 'old_mossback', 'I WAS... NAPPING. FOR TWO HUNDRED... YEARS. IT WAS... A GOOD NAP.', { mood: 'annoyed' }],
      ['say', 'old_mossback', 'NOW I MUST... FLATTEN YOU. THEN... FIVE MORE MINUTES.', { mood: 'annoyed' }],
      ['cameraReset'],
      ['letterbox', false],
      ['toast', 'When Mossback shields up, answer the question to break the shield!', 'info'],
      ['unlockInput'],
    ],
  },

  forest_boss_outro: {
    id: 'forest_boss_outro', skippable: true,
    onSkip: [['flag.set', 'mossback_defeated', true], ['flag.set', 'biomes_open', true], ['chest', 'boss_mossback', { id: 'mossback' }], ['save']],
    steps: [
      ['lockInput'],
      ['letterbox', true],
      ['camera', { to: 'boss_arena', zoom: 1.2, t: 1.0 }],
      ['fx', { type: 'sparkle', at: 'boss_arena', n: 50, r: 3, color: '#ffe680' }],
      ['fx', { type: 'poof', at: 'boss_arena', color: '#ffffff' }],
      ['spawn', 'mossback_sprout', 'boss_arena', { tag: 'sprout' }],
      ['wait', 0.8],
      ['say', 'mossback_sprout', '...hrrm. Fine. FINE. You win. I am going... back... to bed.', { mood: 'annoyed' }],
      ['say', 'mossback_sprout', 'Thank you... for the... exercise. Take my acorn. It is... very... shiny.', { mood: 'calm' }],
      ['flag.set', 'mossback_defeated', true],
      ['chest', 'boss_mossback', { id: 'mossback' }],
      ['anim', 'mossback_sprout', 'sleep', 2],
      ['wait', 0.6],
      ['fx', { type: 'pillar', at: 'player', r: 1.0, color: '#9fe6ff', dur: 1.0 }],
      ['fx', { type: 'poof', at: 'player', color: '#9fe6ff' }],
      ['spawn', 'laporte', 'boss_arena', { tag: 'laporte', offset: [0, 3] }],
      ['sfx', 'laporte'],
      ['face', 'laporte', DOWN],
      ['say', 'laporte', 'Nicely done. I was watching. Supervising. Same thing.', { mood: 'proud' }],
      ['say', 'laporte', 'Funny thing. The moment he fell asleep, the other four town gates unsealed.', { mood: 'calm' }],
      ['flag.set', 'biomes_open', true],
      ['say', 'laporte', 'Dunes, Cove, Peaks, and the Aether portal. Any order you like. Pack snacks.', { mood: 'proud' }],
      ['say', 'laporte', 'And tell Ranger Tam. She worries.', { mood: 'calm' }],
      ['fx', { type: 'poof', at: 'laporte', color: '#9fe6ff' }],
      ['despawn', 'laporte'],
      ['cameraReset'],
      ['letterbox', false],
      ['unlockInput'],
      ['save'],
    ],
  },
};
