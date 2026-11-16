// Main quests (CONTRACTS 11): {id, name, giver, req, companions, steps: [{text, goal}], rewards: {xp, gold, items}, onDone}.
// rewards.items = [{id, n}]. The intro cutscene waits on main_enroll's step index (0-based) to pace the tutorial,
// so do not reorder those steps without updating data/cutscenes/intro.js.
export default {
  main_enroll: {
    id: 'main_enroll', name: 'The Road to Flinkerton', giver: 'laporte', req: [], companions: null,
    steps: [
      /* 0 */ { text: 'Walk north along the road.', goal: { type: 'reach', zone: 'intro', marker: 'stick', r: 2.5 } },
      /* 1 */ { text: 'Pick up the stick.', goal: { type: 'flag', key: 'has_stick' } },
      /* 2 */ { text: 'Shoo the pantry rats. (3)', goal: { type: 'kill', kind: 'rat', n: 3 } },
      /* 3 */ { text: 'More rats up the road! (4)', goal: { type: 'kill', kind: 'rat', n: 4 } },
      /* 4 */ { text: 'Defeat Sir Squeaks-a-Lot.', goal: { type: 'kill', kind: 'giant_rat', n: 1 } },
      /* 5 */ { text: 'Keep walking toward Flinkerton.', goal: { type: 'flag', key: 'ambush_done' } },
      /* 6 */ { text: 'Follow the stranger to town.', goal: { type: 'flag', key: 'intro_done' } },
      /* 7 */ { text: 'Choose your discipline at the Academy.', goal: { type: 'flag', key: 'class_chosen' } },
    ],
    rewards: { xp: 20, gold: 15, items: [{ id: 'potion_small', n: 2 }] },
    onDone: [['toast', 'Welcome to Flinkerton Academy!', 'quest']],
  },
  main_first_steps: {
    id: 'main_first_steps', name: 'First Steps', giver: 'laporte', req: [['flag', 'class_chosen']], companions: null,
    steps: [
      { text: 'Stock up at The Bubbling Cauldron (Granny Mira).', goal: { type: 'talk', npc: 'mira' } },
      { text: 'Head through the west gate into the Whisperwood.', goal: { type: 'reach', zone: 'forest', marker: 'ranger_camp', r: 5 } },
      { text: 'Say hello to Ranger Tam.', goal: { type: 'talk', npc: 'ranger_tam' } },
      { text: 'Clear out the mint slimes. (5)', goal: { type: 'kill', kind: 'slime', n: 5 } },
      { text: 'Report to Mr. Laporte in his office.', goal: { type: 'talk', npc: 'laporte' } },
    ],
    rewards: { xp: 80, gold: 30, items: [{ id: 'potion_small', n: 2 }, { id: 'bread', n: 2 }] },
    onDone: [['rel', 'laporte', 1], ['toast', 'Ranger Tam has more work in the Whisperwood.', 'quest']],
  },
};
