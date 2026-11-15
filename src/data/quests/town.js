// Flinkerton side quests (started from NPC dialogues or the quest board).
export default {
  town_pie_delivery: {
    id: 'town_pie_delivery', name: 'Special Delivery', giver: 'rosa', req: [['flag', 'town_seen']], companions: null,
    steps: [
      { text: 'Deliver Rosa\'s warm pie to Madam Opal at the library.', goal: { type: 'talk', npc: 'opal' } },
    ],
    rewards: { xp: 30, gold: 15, items: [{ id: 'bread', n: 2 }] },
    onDone: [['take', 'warm_pie', 1], ['rel', 'rosa', 1], ['rel', 'opal', 1]],
  },
  town_jelly_latte: {
    id: 'town_jelly_latte', name: 'The Jelly Latte', giver: 'juniper', req: [['flag', 'forest_open']], companions: null,
    steps: [
      { text: 'Collect slime jelly in the Whisperwood. (3)', goal: { type: 'collect', item: 'slime_jelly', n: 3 } },
      { text: 'Bring the jelly to Juniper at The Cozy Cup.', goal: { type: 'talk', npc: 'juniper' } },
    ],
    rewards: { xp: 60, gold: 25, items: [{ id: 'jelly_latte', n: 2 }] },
    onDone: [['take', 'slime_jelly', 3], ['rel', 'juniper', 2]],
  },
  town_bard_ballad: {
    id: 'town_bard_ballad', name: 'A Ballad for Lyle', giver: 'lyle', req: [['flag', 'town_seen']], companions: null,
    steps: [
      { text: 'Ask Guard Hilda for a heroic tale.', goal: { type: 'talk', npc: 'hilda' } },
      { text: 'Ask Mayor Pumbleton for a heroic tale.', goal: { type: 'talk', npc: 'pumble' } },
      { text: 'Ask Old Sol in the park for a heroic tale.', goal: { type: 'talk', npc: 'sol' } },
      { text: 'Tell Lyle what you heard.', goal: { type: 'talk', npc: 'lyle' } },
    ],
    rewards: { xp: 45, gold: 20, items: [{ id: 'hat_feather', n: 1 }] },
    onDone: [['rel', 'lyle', 2], ['toast', 'Lyle wrote a song about you. It is mostly about Lyle.', 'good']],
  },
};
