// The finale.
//   aether_boss_intro: the summit trigger (`boss_intro`, once). Malgrim reveals he was behind every seal, weaves his
//     arena barrier (a callback to the ambush), ascends, and the duel starts.
//   aether_boss_outro: Malgrim Ascended's onDeath. The end-of-term send-off: Malgrim poofs into a small grumpy cloud,
//     Laporte arrives ("Is this your barrier?"), detention, the classmates react, "Remind me who you are again?",
//     the toast (flag end_of_term completes the main quest: "Quest complete" banner), the reward chest. Chains into
//   aether_homecoming: back through the portal to town (gate_aether); free play continues (nothing is locked).
// Skipping the outro runs its onSkip (same flags, chest, save) and still chains into the homecoming.
const DOWN = 2;
const UP = 0;

export default {
  aether_boss_intro: {
    id: 'aether_boss_intro', zone: 'aether', skippable: true,
    // the zone keeps Malgrim as a `spawns` entry, so these spawns are no-ops when he is already there (unique)
    onSkip: [
      ['spawn', 'malgrim_ascended', 'boss_spawn', { tag: 'boss', unique: true }],
      ['spawn', 'aether_barrier', 'boss_arena', { tag: 'aether_barrier', unique: true }],
      ['sfx', 'boss'],
    ],
    steps: [
      ['lockInput'],
      ['letterbox', true],
      ['camera', { to: 'boss_arena', zoom: 0.95, t: 1.4 }],
      ['fx', { type: 'sparkle', at: 'boss_spawn', n: 30, r: 2, color: '#c86bff' }],
      ['sfx', 'spell'],
      ['fx', { type: 'poof', at: 'boss_spawn', color: '#9a3fd0' }],
      ['spawn', 'malgrim_ascended', 'boss_spawn', { tag: 'boss', unique: true }],   // no-op when the zone spawn exists
      ['anim', 'malgrim_ascended', 'charge', 0.8],
      ['say', 'malgrim_ascended', 'Well, well, WELL. The nobody from the road. We meet again!', { mood: 'happy' }],
      ['bubble', 'player', '...Who?', 1.6],
      ['say', 'malgrim_ascended', 'MALGRIM! The SEALWEAVER! Weaver of seals! Sealer of... you KNOW this part!', { mood: 'annoyed' }],
      ['say', 'malgrim_ascended', 'Every seal on every gate? Mine. The grove, the dunes, the cove, the peaks. ALL MINE!', { mood: 'proud' }],
      ['say', 'malgrim_ascended', 'And tonight I seal the Academy itself. Forever! Or at least until Tuesday.', { mood: 'happy' }],
      ['sfx', 'spell'],
      ['spawn', 'aether_barrier', 'boss_arena', { tag: 'aether_barrier', unique: true }],
      ['fx', { type: 'ring', at: 'boss_arena', r: 10, color: '#c86bff', dur: 0.9 }],
      ['fx', { type: 'sparkle', at: 'boss_arena', n: 40, r: 9, color: '#c9b6ff' }],
      ['say', 'malgrim_ascended', 'Nobody leaves my barrier. Forty-one layers. I took NOTES this time.', { mood: 'proud' }],
      ['anim', 'malgrim_ascended', 'cast', 1.2],
      ['fx', { type: 'pillar', at: 'malgrim_ascended', r: 1.6, color: '#c86bff', dur: 1.2 }],
      ['fx', { type: 'screenFlash', color: '#c9b6ff', dur: 0.4 }],
      ['camera', { shake: 0.6 }],
      ['sfx', 'boss'],
      ['say', 'malgrim_ascended', 'Behold! Malgrim... ASCENDED!', { mood: 'proud' }],
      ['cameraReset'],
      ['letterbox', false],
      ['toast', 'When Malgrim shields up, answer the question to break the shield!', 'info'],
      ['unlockInput'],
    ],
  },

  aether_boss_outro: {
    id: 'aether_boss_outro', zone: 'aether', skippable: true,
    onSkip: [
      ['despawn', 'malgrim_minion'],
      ['despawn', 'aether_barrier'],
      ['despawn', 'malgrim_cloud'],
      ['despawn', 'laporte'],
      ['flag.set', 'malgrim_defeated', true],
      ['flag.set', 'end_of_term', true],
      ['chest', 'boss_malgrim', { id: 'malgrim' }],
      ['save'],
      ['cutscene', 'aether_homecoming'],
    ],
    steps: [
      ['lockInput'],
      ['letterbox', true],
      ['despawn', 'malgrim_minion'],                       // his summons poof with him
      ['camera', { to: 'boss_arena', zoom: 1.2, t: 1.0 }],
      ['fx', { type: 'sparkle', at: 'boss_arena', n: 50, r: 3, color: '#ffe680' }],
      ['fx', { type: 'poof', at: 'boss_arena', color: '#c9b6ff' }],
      ['sfx', 'poof'],
      ['spawn', 'malgrim_cloud', 'boss_arena', { tag: 'malgrim_cloud' }],
      ['flag.set', 'malgrim_defeated', true],
      ['wait', 0.6],
      ['say', 'malgrim_cloud', '...A cloud? I am a CLOUD now? This is SO undignified.', { mood: 'annoyed' }],
      ['say', 'malgrim_cloud', 'This is not a defeat. It is a strategic... drizzle.', { mood: 'annoyed' }],

      // Laporte arrives (the rescue, one more time)
      ['fx', { type: 'pillar', at: 'player', r: 1.0, color: '#9fe6ff', dur: 1.0 }],
      ['spawn', 'laporte', 'boss_arena', { tag: 'laporte', offset: [0, 3] }],
      ['fx', { type: 'poof', at: 'laporte', color: '#9fe6ff' }],
      ['sfx', 'laporte'],
      ['face', 'laporte', UP],
      ['say', 'laporte', 'Is this your barrier?', { mood: 'calm' }],
      ['say', 'malgrim_cloud', 'It IS! Forty-one layers! Hand-woven! Utterly unbreak—', { mood: 'proud' }],
      ['anim', 'laporte', 'cast', 0.5],
      ['despawn', 'aether_barrier'],
      ['fx', { type: 'burst', at: 'boss_arena', n: 40, r: 9, color: '#c86bff' }],
      ['fx', { type: 'ring', at: 'boss_arena', r: 10, color: '#ffffff', dur: 0.5 }],
      ['sfx', 'poof'],
      ['say', 'laporte', 'It was a nice barrier.', { mood: 'calm' }],
      ['say', 'laporte', 'Malgrim. Detention. Every Saturday this summer. Bring a pencil.', { mood: 'calm' }],
      ['say', 'malgrim_cloud', 'You have not seen the last of Malgrim the Sealwea—', { mood: 'annoyed' }],
      ['say', 'laporte', 'Toodle-oo.', { mood: 'calm' }],
      ['fx', { type: 'poof', at: 'malgrim_cloud', color: '#9a8ac4' }],
      ['fx', { type: 'smoke', at: 'malgrim_cloud', r: 1.2, dur: 1.0 }],
      ['despawn', 'malgrim_cloud'],
      ['sfx', 'poof'],
      ['wait', 0.5],

      // the classmates, and the callback to the road
      ['dialogue', 'aether_classmates'],
      ['face', 'laporte', DOWN],
      ['camera', { to: 'player', zoom: 1.45, t: 0.6 }],
      ['say', 'laporte', 'Remind me who you are again?', { mood: 'calm' }],
      ['bubble', 'player', '...Seriously?', 1.4],
      ['wait', 0.8],
      ['say', 'laporte', 'Ah yes. {name}. I remember now.', { mood: 'proud' }],
      ['say', 'laporte', 'Every seal broken. Every gate open. That is what I call the end of term.', { mood: 'proud' }],

      // the toast
      ['fx', { type: 'screenFlash', color: '#fff2a0', dur: 0.4 }],
      ['fx', { type: 'levelup', at: 'player' }],
      ['fx', { type: 'sparkle', at: 'boss_arena', n: 60, r: 6, color: '#ffe680' }],
      ['sfx', 'levelup'],
      ['say', 'laporte', 'A toast. To {name}. And to summer.', { mood: 'happy' }],
      ['dialogue', 'aether_toast'],
      ['flag.set', 'end_of_term', true],
      ['toast', 'END OF TERM! Flinkerton Academy is safe, thanks to {name}. Three cheers!', 'good'],
      ['chest', 'boss_malgrim', { id: 'malgrim' }],
      ['say', 'laporte', 'Right. Home. The bakery is staying open late. Do not tell Rosa I told you.', { mood: 'calm' }],
      ['save'],
      ['cutscene', 'aether_homecoming'],
    ],
  },

  aether_homecoming: {
    id: 'aether_homecoming', zone: 'aether', skippable: false,   // short; not skippable so the travel never runs twice
    steps: [
      ['lockInput'],
      ['fx', { type: 'pillar', at: 'player', r: 1.2, color: '#9fe6ff', dur: 1.0 }],
      ['fx', { type: 'poof', at: 'laporte', color: '#9fe6ff' }],
      ['despawn', 'laporte'],
      ['wait', 0.4],
      ['travel', 'town', 'gate_aether'],
      ['wait', 0.6],
      ['toast', 'Free play! Every gate stays open. Finish your quests, explore, and enjoy the summer.', 'quest'],
      ['save'],
      ['unlockInput'],
    ],
  },
};
