// Aether Gardens dialogues: Celeste the astronomer (main-quest guide, star charts), Nimbus the cloud shepherd (puffling
// round-up), Malgrim as a small cloud, and the two classmate beats of the finale (lines gated by class, so only the
// player's two companions speak).
const S = (who, text, mood = 'calm') => ({ who, mood, text });
const P = (text, mood = 'calm') => ({ who: 'player', mood, text });
const bye = (text = 'See you!') => ({ text, end: true });
const once = (flag) => ['not', ['flag', flag]];
// a classmate line shown only when that classmate is one of the player's companions (not the player's own class)
const mate = (who, cls, text, mood = 'happy') => ({ who, mood, text, if: [['not', ['class', cls]]] });

function tree(id, greet, more, options, nodes) {
  return {
    start: 'hub',
    nodes: Object.assign({ hub: { say: greet, options }, more: { say: [S(id, more)], options } }, nodes),
  };
}

export default {
  celeste: tree('celeste', [S('celeste', 'Oh! A visitor. Mind the moon flowers. I am Celeste. I watch the sky. Usually it behaves.')],
    'Anything else? The stars are patient. I am less so.', [
      { text: 'What happened to the sky?', if: [['quest', 'aether_finale', 'active']], goto: 'seals' },
      { text: 'What happened to the sky?', if: [['quest', 'aether_finale', 'none'], ['not', ['flag', 'malgrim_defeated']]],
        do: [['quest.start', 'aether_finale']], goto: 'seals' },
      { text: 'Can I help with anything?', if: [['quest', 'aether_star_charts', 'none']], goto: 'charts' },
      { text: 'About your star charts...', if: [['quest', 'aether_star_charts', 'active']], goto: 'charts_active' },
      { text: 'The sky looks right again.', if: [['flag', 'malgrim_defeated'], once('celeste_thanks')], goto: 'thanks' },
      { text: 'What is the Great Orrery?', goto: 'orrery' },
      { text: 'What lives up here?', goto: 'creatures' },
      bye('Clear skies, Celeste.'),
    ], {
      seals: {
        say: [S('celeste', 'A man in a purple robe moved onto the highest island. Very loud. Lots of cackling.', 'worried'),
          S('celeste', 'Every seal on every gate below? His runes. He signs them. With a little star.', 'annoyed'),
          S('celeste', 'The Summit Gate only wakes when the Great Orrery is aligned. It is in the plaza, north of here.'),
          P('And then?'), S('celeste', 'Then you go up and politely ask him to stop. Politely, with your weapon.')],
        goto: 'more',
      },
      charts: {
        say: [S('celeste', 'My star charts blew away in his storm. The clockwork owls grabbed them.', 'worried'),
          S('celeste', 'They think they are "filing" them. They are not. Could you bring back four?')],
        options: [
          { text: 'Four star charts. On it.', do: [['quest.start', 'aether_star_charts']], goto: 'charts_yes' },
          { text: 'Why owls?', goto: 'owls' },
          { text: 'Maybe later.', goto: 'more' },
        ],
      },
      owls: {
        say: [S('celeste', 'I built them to help. They help the way a cat helps with homework.'),
          S('celeste', 'They perch around the orrery and fire gears. Step aside from the bright line.')],
        options: [
          { text: 'Four star charts. On it.', do: [['quest.start', 'aether_star_charts']], goto: 'charts_yes' },
          { text: 'Maybe later.', goto: 'more' },
        ],
      },
      charts_yes: {
        say: [S('celeste', 'Wonderful. The owls drop them when they... retire. The rune chests on the islets hold one each.', 'happy')],
        goto: 'more',
      },
      charts_active: {
        say: [S('celeste', 'Four charts, please. Owls in the plaza, mostly. The rune chests on the islets hold one each.')],
        goto: 'more',
      },
      thanks: {
        say: [S('celeste', 'The stars are back where they belong. Orion even waved. I am almost sure.', 'happy'),
          S('celeste', 'Take this tea. Moon flowers. You have earned a very long nap.', 'happy')],
        do: [['flag.set', 'celeste_thanks', true], ['give', 'moon_tea', 2], ['rel', 'celeste', 2]],
        goto: 'more',
      },
      orrery: {
        say: [S('celeste', 'A model of the sky, as big as a house. Older than the Academy. It ticks when it is happy.'),
          S('celeste', 'Line up its planets and the old paths light up. Including the stair to the summit.')],
        do: [['rel', 'celeste', 1]],
        goto: 'more',
      },
      creatures: {
        say: [S('celeste', 'Star sprites travel in threes. Moon moths make you sleepy. Do not stand in their dust.'),
          S('celeste', 'Astral golems paw the floor before they charge. Move sideways. Sideways is everything.'),
          S('celeste', 'And the cloud pufflings are harmless. Unless you poke them. Do not poke them.')],
        goto: 'more',
      },
    }),

  nimbus: tree('nimbus', [S('nimbus', 'Shh! You will spook the herd. I am Nimbus. Cloud shepherd. It is a real job.', 'worried')],
    'Anything else? Quietly, please.', [
      { text: 'Can I help with the herd?', if: [['quest', 'aether_puff_roundup', 'none']], goto: 'roundup' },
      { text: 'How is the herd?', if: [['quest', 'aether_puff_roundup', 'active']], goto: 'active' },
      { text: 'The pufflings seem calmer.', if: [['quest', 'aether_puff_roundup', 'done'], once('nimbus_thanks')], goto: 'done' },
      { text: 'Why are the clouds grumpy?', goto: 'grumpy' },
      { text: 'Do they have names?', goto: 'names' },
      bye('Bye, Nimbus.'),
    ], {
      roundup: {
        say: [S('nimbus', 'Since the purple storm, half my pufflings are grumpy. They bump people. HARD.', 'worried'),
          S('nimbus', 'If you tap six of them, they poof and float home to rest. Will you?')],
        options: [
          { text: 'I will calm six pufflings.', do: [['quest.start', 'aether_puff_roundup']], goto: 'yes' },
          { text: 'Do they get hurt?', goto: 'hurt' },
          { text: 'Not right now.', goto: 'more' },
        ],
      },
      hurt: {
        say: [S('nimbus', 'Nah. They just poof. Then they reform at home and sulk. Clouds love sulking.')],
        options: [
          { text: 'I will calm six pufflings.', do: [['quest.start', 'aether_puff_roundup']], goto: 'yes' },
          { text: 'Not right now.', goto: 'more' },
        ],
      },
      yes: { say: [S('nimbus', 'Thanks! They leave you alone unless you poke first. So... poke first. Gently.', 'happy')], goto: 'more' },
      active: { say: [S('nimbus', 'Watch their bump. They puff up, then dash in a straight line. Step aside!')], goto: 'more' },
      done: {
        say: [S('nimbus', 'Look at them! Fluffy and calm. Kevin even smiled. Here, a comet candy.', 'happy')],
        do: [['flag.set', 'nimbus_thanks', true], ['give', 'comet_candy', 1], ['rel', 'nimbus', 2]],
        goto: 'more',
      },
      grumpy: {
        say: [S('nimbus', 'That wizard upstairs keeps casting storms. Clouds hate storms. Embarrassing relatives.')],
        goto: 'more',
      },
      names: {
        say: [S('nimbus', 'That one is Kevin. That one is Kevin. That one is also Kevin.'), P('And that one?'),
          S('nimbus', 'Gerald. He is new.', 'happy')],
        do: [['rel', 'nimbus', 1]],
        goto: 'more',
      },
    }),

  malgrim_cloud: {
    start: 'hub',
    nodes: {
      hub: { say: [S('malgrim_cloud', 'Go away. I am drizzling. This is a private drizzle.', 'annoyed')] },
    },
  },

  // aether_boss_outro: the classmates react (two of these three lines show).
  aether_classmates: {
    start: 'cheer',
    nodes: {
      cheer: {
        say: [
          mate('bram', 'warrior', 'WE DID IT! GROUP HUG! Everyone in! Even you, cloud!'),
          mate('elowen', 'mage', 'Statistically, that should not have worked. I am delighted. Quietly.'),
          mate('pip', 'rogue', 'Also, I borrowed his spare hat. It is in the chest now. For you. Mostly.'),
        ],
      },
    },
  },
  // aether_boss_outro: the end-of-term toast.
  aether_toast: {
    start: 'toast',
    nodes: {
      toast: {
        say: [
          mate('bram', 'warrior', 'TO {name}! AND TO SNACKS!'),
          mate('elowen', 'mage', 'To {name}. And to a whole summer of reading.'),
          mate('pip', 'rogue', 'To {name}! ...Does anyone want their spoons back?'),
        ],
      },
    },
  },
};
