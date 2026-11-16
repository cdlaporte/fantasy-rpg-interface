// Aether Gardens quests. Rewards sized for levels 15-20 (about 40% of a level for a side quest: xpNext(18) = 1146).
//   aether_finale (main): starts on arrival (zone trigger `arrive`); every step after the talk is a flag, so a player who
//     does things out of order still finishes it. Its last flag (end_of_term) is set by the finale cutscene.
//   aether_star_charts (Celeste): four star charts from the clockwork owls (one in each rune chest).
//   aether_puff_roundup (Nimbus): calm six cloud pufflings.
export default {
  aether_finale: {
    id: 'aether_finale', name: 'End of Term', giver: 'celeste', req: [['flag', 'biomes_open']], companions: null,
    steps: [
      { text: 'Find the astronomer\'s observatory camp.', goal: { type: 'reach', zone: 'aether', marker: 'camp', r: 7 } },
      { text: 'Ask Celeste what happened to the sky.', goal: { type: 'talk', npc: 'celeste' } },
      { text: 'Align the Great Orrery in the plaza.', goal: { type: 'flag', key: 'orrery_aligned', zone: 'aether', marker: 'orrery_plaza' } },
      { text: 'Unseal the Summit Gate.', goal: { type: 'flag', key: 'gate_summit_seal', zone: 'aether', marker: 'summit_gate' } },
      { text: 'Defeat Malgrim on the highest island.', goal: { type: 'flag', key: 'malgrim_defeated', zone: 'aether', marker: 'boss_arena' } },
      { text: 'Celebrate the end of term!', goal: { type: 'flag', key: 'end_of_term' } },
    ],
    rewards: { xp: 600, gold: 250, items: [{ id: 'potion_big', n: 2 }, { id: 'cape_midnight', n: 1 }] },
    onDone: [['rel', 'laporte', 3]],
  },
  aether_star_charts: {
    id: 'aether_star_charts', name: 'Charts of the Stars', giver: 'celeste', req: [], companions: null,
    steps: [
      { text: 'Recover Celeste\'s star charts from the owls. (4)', goal: { type: 'collect', item: 'star_chart', n: 4 } },
      { text: 'Bring the star charts to Celeste.', goal: { type: 'talk', npc: 'celeste' } },
    ],
    rewards: { xp: 450, gold: 120, items: [{ id: 'moon_tea', n: 3 }, { id: 'focus_scroll', n: 1 }] },
    onDone: [['take', 'star_chart', 4], ['rel', 'celeste', 2]],
  },
  aether_puff_roundup: {
    id: 'aether_puff_roundup', name: 'Puffling Round-Up', giver: 'nimbus', req: [], companions: null,
    steps: [
      { text: 'Calm the grumpy cloud pufflings. (6)', goal: { type: 'kill', kind: 'cloud_puffling', n: 6 } },
      { text: 'Tell Nimbus the herd is calm.', goal: { type: 'talk', npc: 'nimbus' } },
    ],
    rewards: { xp: 380, gold: 90, items: [{ id: 'comet_candy', n: 2 }, { id: 'potion_big', n: 1 }] },
    onDone: [['rel', 'nimbus', 2]],
  },
};
