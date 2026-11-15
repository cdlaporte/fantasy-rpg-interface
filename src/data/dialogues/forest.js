// Whisperwood dialogues: Ranger Tam (quest hub), Mo the Forager, Kai the fisher, Wren the birdwatcher.
const S = (who, text, mood = 'calm') => ({ who, mood, text });
const P = (text, mood = 'calm') => ({ who: 'player', mood, text });
const bye = (text = 'See you!') => ({ text, end: true });
const once = (flag) => ['not', ['flag', flag]];
const below = (n) => ['not', ['level', '>=', n]];

function tree(id, greet, more, options, nodes) {
  return {
    start: 'hub',
    nodes: Object.assign({ hub: { say: greet, options }, more: { say: [S(id, more)], options } }, nodes),
  };
}

export default {
  ranger_tam: tree('ranger_tam', [S('ranger_tam', 'Hey there. Ranger Tam. Welcome to the Whisperwood. Mind the mushrooms.')],
    'Anything else? The trees and I have time.', [
      { text: 'Mr. Laporte sent me.', if: [['quest', 'main_first_steps', 'active']], goto: 'sent' },
      { text: 'What lives in the forest?', goto: 'creatures' },
      { text: 'Any work for me?', if: [['quest', 'forest_sealed_grove', 'none'], ['level', '>=', 8]], goto: 'grove' },
      { text: 'Any work for me?', if: [['quest', 'forest_sealed_grove', 'none'], below(8)], goto: 'work_low' },
      { text: 'About the grove...', if: [['quest', 'forest_sealed_grove', 'active']], goto: 'grove_active' },
      { text: 'The grove is safe now.', if: [['quest', 'forest_sealed_grove', 'done'], once('tam_grove_chat')],
        goto: 'grove_done' },
      { text: 'Why do you name the trees?', goto: 'names' },
      { text: 'Can I rest here?', goto: 'rest' },
      bye('Bye, Tam.'),
    ], {
      sent: {
        say: [S('ranger_tam', 'Did he? Good. The mint slimes are getting bold near the camp.'),
          S('ranger_tam', 'Clear out five of them. They split when you pop them, so pop the little ones too.')],
        goto: 'more',
      },
      creatures: {
        say: [S('ranger_tam', 'Slimes by the camp. Sporecaps in the glade, boars in the meadow, bats in the hollow.'),
          S('ranger_tam', 'Goblins past that. Wisps on the pond. And something big snoring in the old grove.')],
        goto: 'more',
      },
      work_low: {
        say: [S('ranger_tam', 'Mo in the glade needs help with sporecaps. Goblins are stealing books, too.'),
          S('ranger_tam', 'Come back at level 8. I will have a bigger job by then. A snoring job.')],
        goto: 'more',
      },
      grove: {
        say: [S('ranger_tam', 'The old grove is sealed with purple runes. Not ours. Somebody dramatic.', 'worried'),
          S('ranger_tam', 'And Old Mossback is awake. Grumpy. Shaking the whole wood. Can you take a look?')],
        options: [
          { text: 'I will open the grove.', do: [['quest.start', 'forest_sealed_grove']], goto: 'grove_yes' },
          { text: 'Who is Old Mossback?', goto: 'mossback' },
          { text: 'Not yet.', goto: 'more' },
        ],
      },
      mossback: {
        say: [S('ranger_tam', 'Oldest treant in the valley. Sleeps for centuries. Wakes up very cranky.'),
          S('ranger_tam', 'When he shields up with runes, keep a clear head. A true answer cracks them.')],
        options: [
          { text: 'I will open the grove.', do: [['quest.start', 'forest_sealed_grove']], goto: 'grove_yes' },
          { text: 'Not yet.', goto: 'more' },
        ],
      },
      grove_yes: {
        say: [S('ranger_tam', 'Thank you. The rune gate is north of the pond. Take potions. Take two.')],
        do: [['give', 'potion_small', 2]],
        goto: 'more',
      },
      grove_active: {
        say: [S('ranger_tam', 'Rune gate first, then the saplings, then Mossback himself. Watch for the stomp.')],
        goto: 'more',
      },
      grove_done: {
        say: [S('ranger_tam', 'He is asleep again? As a sapling? Ha! That is the best news all year.', 'happy'),
          S('ranger_tam', 'The wood is quiet. Gerald says thank you. Gerald is a tree.', 'happy')],
        do: [['flag.set', 'tam_grove_chat', true], ['rel', 'ranger_tam', 1]],
        goto: 'more',
      },
      names: {
        say: [S('ranger_tam', 'You spend enough time out here, you get to know them. That one is Gerald.'),
          P('Which one?'), S('ranger_tam', 'Exactly.', 'happy')],
        do: [['rel', 'ranger_tam', 1]],
        goto: 'more',
      },
      rest: {
        say: [S('ranger_tam', 'Sure. Sit by the fire. Here, have some of my stew. It is mostly bread.')],
        do: [['heal'], ['fx', { type: 'heal', at: 'player' }]],
        goto: 'more',
      },
    }),

  mo: tree('mo', [S('mo', 'Achoo! Oh! A visitor! I am Mo! I forage! Achoo! Spores!', 'happy')],
    'What else? Achoo!', [
      { text: 'Are you okay?', if: [['quest', 'forest_mushroom_mischief', 'none']], goto: 'quest' },
      { text: 'How are the sporecaps?', if: [['quest', 'forest_mushroom_mischief', 'active']], goto: 'active' },
      { text: 'The glade looks calmer.', if: [['quest', 'forest_mushroom_mischief', 'done'], once('mo_thanks')], goto: 'done' },
      { text: 'Which mushrooms are safe to eat?', goto: 'eat' },
      { text: 'What is a glowcap?', goto: 'glowcap' },
      bye('Bless you, Mo.'),
    ], {
      quest: {
        say: [S('mo', 'The sporecaps are puffing spores at everyone! Even me! I am their biggest fan!', 'worried'),
          S('mo', 'Calm six of them and bring me four glowcaps? They drop them. I will make soup. Safe soup.')],
        options: [
          { text: 'Leave it to me.', do: [['quest.start', 'forest_mushroom_mischief']], goto: 'yes' },
          { text: 'Maybe later.', goto: 'more' },
        ],
      },
      yes: { say: [S('mo', 'Hooray! Tip: they lob spore clouds. Do not stand in the purple. Achoo!', 'happy')], goto: 'more' },
      active: { say: [S('mo', 'Still puffing! Remember, when they wind up, the purple circle is where it lands!')],
        goto: 'more' },
      done: {
        say: [S('mo', 'They are dozing! And these glowcaps... perfect. Have some soup money.', 'happy')],
        do: [['flag.set', 'mo_thanks', true], ['gold', 10]],
        goto: 'more',
      },
      eat: {
        say: [S('mo', 'The brown ones, yes. The red ones, no. The ones that wave at you, absolutely not.')],
        do: [['rel', 'mo', 1]],
        goto: 'more',
      },
      glowcap: {
        say: [S('mo', 'The glowing top of a sporecap! Softly shines in the dark. Great for reading under blankets.')],
        goto: 'more',
      },
    }),

  kai: tree('kai', [S('kai', 'Shh. The fish are thinking.')], 'Mm?', [
    { text: 'Caught anything?', goto: 'fish' },
    { text: 'How long have you been fishing here?', goto: 'long' },
    { text: 'Seen anything interesting?', goto: 'seen' },
    { text: 'Want company?', if: [['rel', 'kai', '>=', 2], once('gift_kai')], goto: 'gift' },
    bye('Good luck, Kai.'),
  ], {
    fish: {
      say: [S('kai', 'Not yet. Eleven years.'), P('Eleven YEARS?'), S('kai', 'The fish are very smart. I respect them.', 'happy')],
      do: [['rel', 'kai', 1]],
      goto: 'more',
    },
    long: {
      say: [S('kai', 'Since I was your age. The brook is calm. Calm is nice. Everything else is loud.')],
      do: [['rel', 'kai', 1]],
      goto: 'more',
    },
    seen: {
      say: [S('kai', 'A chest across the water. Glowing runes. Goblins tried to open it. Could not do the math.'),
        S('kai', 'One of them cried a little. I gave him a sandwich.')],
      goto: 'more',
    },
    gift: {
      say: [S('kai', 'Sit. Watch the water. ...Nice, right? Here. I found this in the brook. Not a fish.', 'happy')],
      do: [['give', 'shield_charm', 1], ['flag.set', 'gift_kai', true]],
      goto: 'more',
    },
  }),

  wren: tree('wren', [S('wren', 'Spotted: one student, wild, carrying a weapon. Rare! Hi! I am Wren!', 'happy')],
    'Anything else? I am writing this down.', [
      { text: 'What are you writing?', goto: 'notes' },
      { text: 'Tell me about the wisps.', goto: 'wisps' },
      { text: 'What should I watch out for?', goto: 'danger' },
      { text: 'Have you seen Malgrim around?', if: [['flag', 'ambush_done']], goto: 'malgrim' },
      bye('Bye, Wren!'),
    ], {
      notes: {
        say: [S('wren', '"Bristleboar: paws the ground, then charges. Bats: always in threes. Student: polite."'),
          S('wren', 'You are in my book now! Page 88. Next to a very handsome beetle.', 'happy')],
        do: [['rel', 'wren', 1]],
        goto: 'more',
      },
      wisps: {
        say: [S('wren', 'Pond wisps! They hate being chased. They blink away, then zap you in a straight line.'),
          S('wren', 'When you see the bright line on the ground, step sideways. Sideways is key.')],
        goto: 'more',
      },
      danger: {
        say: [S('wren', 'Thornlings pretend to be bushes. If a bush has eyes, it is not a bush.'),
          S('wren', 'Goblin scouts throw rocks from far away. Close the gap, or throw something back!')],
        goto: 'more',
      },
      malgrim: {
        say: [S('wren', 'Purple robe, too much cape? Saw him flying over the grove last week. Badly.'),
          S('wren', 'He crashed into Gerald. Gerald is a tree. Gerald was fine.')],
        goto: 'more',
      },
    }),
};
