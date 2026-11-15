// Flinkerton dialogues: one tree per townsfolk, plus quest_board, cafe_door and library_door (prop interacts).
// Pattern: `hub` greets and lists topics; topic nodes `goto: 'more'`, which lists the same topics again with a short
// "anything else?" line. Speaker 'narrator' = no name and no portrait (notice board, doors). Options with `if` change what you can ask as flags, class, level, quests and `rel` change.
const S = (who, text, mood = 'calm') => ({ who, mood, text });
const P = (text, mood = 'calm') => ({ who: 'player', mood, text });
const bye = (text = 'See you around!') => ({ text, end: true });

/** Build a tree whose hub and `more` nodes share one option list. */
function tree(id, greet, more, options, nodes) {
  return {
    start: 'hub',
    nodes: Object.assign({
      hub: { say: greet, options },
      more: { say: [S(id, more)], options },
    }, nodes),
  };
}
const once = (flag) => ['not', ['flag', flag]];
const GATES = 'The four other town gates? Dunes, Cove, Peaks and that shimmery Aether portal.';

export default {
  // ---------------------------------------------------------------- shopkeepers
  mira: tree('mira', [S('mira', 'Welcome to the Bubbling Cauldron, dearie! Mind the cauldron. It bites.', 'happy')],
    'Anything else, dearie?', [
      { text: 'Show me your potions.', do: [['shop', 'potions']], end: true },
      { text: "I'm a new student at the Academy!", if: [['flag', 'class_chosen'], once('gift_mira')], goto: 'gift' },
      { text: 'What does the red one do?', goto: 'potions' },
      { text: 'Heard anything about the sealed gates?', goto: 'gates' },
      { text: 'How did you become a potion maker?', goto: 'story' },
      { text: 'Tell me about the dragon.', if: [['rel', 'mira', '>=', 2]], goto: 'dragon' },
      bye('Bye, Granny Mira!'),
    ], {
      gift: {
        say: [S('mira', 'A new student! Oh, I remember my first day. Here, two potions. On the house.', 'happy'),
          S('mira', 'Laporte sends all his new ones to me. He worries. He will not admit it.')],
        do: [['give', 'potion_small', 2], ['flag.set', 'gift_mira', true], ['rel', 'mira', 1]],
        goto: 'more',
      },
      potions: {
        say: [S('mira', 'Red heals. Big red heals more. Fizzy blue makes you fast. Do not drink the green one.'),
          P('What does the green one do?'),
          S('mira', 'Nobody knows, dearie. That is why you do not drink it.')],
        goto: 'more',
      },
      gates: {
        say: [S('mira', GATES), S('mira', 'All sealed "until next term". Laporte says that about everything.')],
        goto: 'more',
      },
      story: {
        say: [S('mira', 'I was an adventurer once. Then I took a potion to the knee.'),
          S('mira', 'Turned out it was a very good potion. I have been making them ever since.', 'happy')],
        do: [['rel', 'mira', 1]],
        goto: 'more',
      },
      dragon: {
        say: [S('mira', 'Oh, that old story? We had a staring contest. It blinked first.', 'proud'),
          S('mira', 'Now it sends me a card every winter. Lovely handwriting for a dragon.', 'happy')],
        goto: 'more',
      },
    }),

  fenwick: tree('fenwick', [S('fenwick', 'Welcome to Stitch & Sparkle! Every outfit is a statement!', 'happy')],
    'What else can I dazzle you with?', [
      { text: 'Show me the latest fashions.', do: [['shop', 'outfitter']], end: true },
      { text: 'What do you think of my look?', goto: 'look' },
      { text: 'What do people wear at the Academy?', goto: 'academy' },
      { text: 'Any gossip?', goto: 'gossip' },
      { text: 'Make me something special?', if: [['rel', 'fenwick', '>=', 2], once('gift_fenwick')], goto: 'gift' },
      bye('Stay sparkly, Fenwick.'),
    ], {
      look: {
        say: [S('fenwick', 'Hmm. Hmm hmm. Turn around.'), S('fenwick', 'Bold. Practical. A touch of "I fought a rat today".'),
          S('fenwick', 'I love it. I would add a cape. I would add a cape to anything.', 'happy')],
        do: [['rel', 'fenwick', 1]],
        goto: 'more',
      },
      academy: {
        say: [S('fenwick', 'Robes, mostly. So many robes. So little imagination.'),
          S('fenwick', 'Mr. Laporte wears the same striped sweater every day. Iconic. I respect it.')],
        goto: 'more',
      },
      gossip: {
        say: [S('fenwick', 'The Mayor ordered a new cape. It is his eleventh. He calls them all "Cape".'),
          S('fenwick', 'And Gus has a secret. It is a cat. Everyone knows. Do not tell him we know.')],
        goto: 'more',
      },
      gift: {
        say: [S('fenwick', 'For my favorite customer? A bandana. Hand-stitched. Do not get it muddy.', 'happy')],
        do: [['give', 'hat_red_bandana', 1], ['flag.set', 'gift_fenwick', true]],
        goto: 'more',
      },
    }),

  gus: tree('gus', [S('gus', 'Odds and Ends. I am Gus. Big Gus. There is no Small Gus.')],
    'Hm. What else?', [
      { text: 'What do you sell?', do: [['shop', 'general']], end: true },
      { text: 'Odds AND ends? Which is which?', goto: 'odds' },
      { text: 'What is out in the Whisperwood?', goto: 'forest' },
      { text: 'Is that... a cat behind the counter?', goto: 'cat' },
      { text: 'Say hi to Biscuit for me.', if: [['flag', 'met_biscuit'], once('gift_gus')], goto: 'gift' },
      bye('Bye, Big Gus.'),
    ], {
      odds: {
        say: [S('gus', 'Bombs are odds. Smoke pellets are ends. Cheese is... both.'), S('gus', 'Hm. Hm hm.')],
        goto: 'more',
      },
      forest: {
        say: [S('gus', 'Slimes near the gate. Mushrooms that sneeze. Goblins further in.'),
          S('gus', 'Goblins buy smoke pellets from me. Then they throw them at people. I feel bad.', 'worried')],
        goto: 'more',
      },
      cat: {
        say: [S('gus', '...'), S('gus', 'That is Biscuit. Biscuit does not exist. Officially.', 'worried'),
          S('gus', 'You can pet him. Gently. He bites only the Mayor.', 'happy')],
        do: [['flag.set', 'met_biscuit', true], ['rel', 'gus', 1]],
        goto: 'more',
      },
      gift: {
        say: [S('gus', 'Biscuit likes you. Biscuit likes nobody. Here. A bomb. From Biscuit.', 'happy')],
        do: [['give', 'bomb', 2], ['flag.set', 'gift_gus', true]],
        goto: 'more',
      },
    }),

  rosa: tree('rosa', [S('rosa', 'Rise and shine! Welcome to the bakery! Everything is warm, including me.', 'happy')],
    'Anything else, sweetie?', [
      { text: 'What is fresh today?', do: [['shop', 'bakery']], end: true },
      { text: 'Need any help?', if: [['quest', 'town_pie_delivery', 'none']], goto: 'pie' },
      { text: 'Opal got the pie!', if: [['quest', 'town_pie_delivery', 'done'], once('rosa_pie_thanks')], goto: 'pie_done' },
      { text: 'How early do you get up?', goto: 'early' },
      { text: 'What is Tilly like?', goto: 'tilly' },
      bye('Bye, Rosa!'),
    ], {
      pie: {
        say: [S('rosa', 'Oh, would you? Madam Opal ordered an apple pie. The library is on the square.'),
          S('rosa', 'Please do not eat it. Tilly tried. There were consequences.', 'worried')],
        options: [
          { text: 'I will deliver it!', do: [['quest.start', 'town_pie_delivery'], ['give', 'warm_pie', 1]], goto: 'pie_yes' },
          { text: 'Maybe later.', goto: 'more' },
        ],
      },
      pie_yes: { say: [S('rosa', 'You are a treasure! Off you go, it is best warm!', 'happy')], goto: 'more' },
      pie_done: {
        say: [S('rosa', 'She did? Did she smile? She never smiles. She whisper-smiles.', 'happy')],
        do: [['flag.set', 'rosa_pie_thanks', true], ['give', 'honey_bun', 1]],
        goto: 'more',
      },
      early: {
        say: [S('rosa', 'Four in the morning! The bread does not knead itself.'),
          S('rosa', 'Well. Some of it does. Magical yeast. It gets clingy.')],
        goto: 'more',
      },
      tilly: {
        say: [S('rosa', 'Tilly wants to be Headmaster. She practices the "disappointed sigh" on me.'),
          S('rosa', 'It is very good. Mr. Laporte would be proud.', 'happy')],
        do: [['rel', 'rosa', 1]],
        goto: 'more',
      },
    }),

  tilly: tree('tilly', [S('tilly', 'Are you a REAL student? At the REAL Academy? Prove it.', 'shocked')],
    'What else? I have time. I am nine.', [
      { text: 'Prove it how?', goto: 'prove' },
      { text: 'What do you want to be when you grow up?', goto: 'dream' },
      { text: 'Know any secrets?', goto: 'secret' },
      { text: 'Here, a sample from your mom.', if: [['hasItem', 'bread', 1], once('gift_tilly')], goto: 'gift' },
      bye('Bye, Tilly!'),
    ], {
      prove: {
        say: [S('tilly', 'What is seven times eight?'), P('Fifty-six.'),
          S('tilly', 'Okay, you are real. Or you cheated. Both are student things.', 'happy')],
        do: [['rel', 'tilly', 1]],
        goto: 'more',
      },
      dream: {
        say: [S('tilly', 'HEADMASTER. Like Mr. Laporte. I already do the sigh.'), S('tilly', '*siiiigh*. "Phones away."'),
          S('tilly', 'I do not know what a phone is. But it works on everybody.', 'proud')],
        goto: 'more',
      },
      secret: {
        say: [S('tilly', 'Guard Bo knits sweaters for the ducks in the park. The ducks love it.'),
          S('tilly', 'And there is a shiny chest in the Whisperwood by the water. I saw it from the gate!')],
        goto: 'more',
      },
      gift: {
        say: [S('tilly', 'BREAD! You are my best friend now. Here, my lucky rock. It is a regular rock.', 'happy')],
        do: [['take', 'bread', 1], ['give', 'smoke_pellet', 1], ['flag.set', 'gift_tilly', true], ['rel', 'tilly', 2]],
        goto: 'gift2',
      },
      gift2: { say: [S('tilly', 'Wait, that one was a smoke pellet. Keep it anyway! Bye!', 'happy')] },
    }),

  juniper: tree('juniper', [S('juniper', 'Hi hi hi! Welcome to The Cozy Cup! Today\'s special is cinnamon fog!', 'happy')],
    'What else can I pour you?', [
      { text: 'Cinnamon fog?', goto: 'fog' },
      { text: 'Working on any new drinks?', if: [['quest', 'town_jelly_latte', 'none'], ['flag', 'forest_open']], goto: 'latte' },
      { text: 'How is the jelly latte?', if: [['quest', 'town_jelly_latte', 'done']], goto: 'latte_done' },
      { text: 'Who comes to the cafe?', goto: 'regulars' },
      { text: 'Any rumors about the gates?', goto: 'gates' },
      bye('Bye, Juniper!'),
    ], {
      fog: {
        say: [S('juniper', 'It is like tea, but you inhale it! It is not good. I am still working on it.', 'happy')],
        goto: 'more',
      },
      latte: {
        say: [S('juniper', 'YES. The Jelly Latte. Slime jelly, steamed milk, a pinch of joy.'),
          S('juniper', 'I need three slime jellies from the Whisperwood. Slimes drop them. Ew. Yay!', 'happy')],
        options: [
          { text: 'I will get you some jelly.', do: [['quest.start', 'town_jelly_latte']], goto: 'latte_yes' },
          { text: 'That sounds... wobbly. Later.', goto: 'more' },
        ],
      },
      latte_yes: { say: [S('juniper', 'You are the best! Bring it back wobbly!', 'happy')], goto: 'more' },
      latte_done: {
        say: [S('juniper', 'People LOVE it. Or they are afraid to say no. Either way, sales are up!', 'proud')],
        goto: 'more',
      },
      regulars: {
        say: [S('juniper', 'Granny Mira at seat one. Big Gus at seat two. The Mayor at seat four, talking.'),
          S('juniper', 'Mr. Laporte orders black coffee and grades papers. He tips well. He sighs a lot.')],
        do: [['rel', 'juniper', 1]],
        goto: 'more',
      },
      gates: {
        say: [S('juniper', 'A customer said purple sparkles were coming out of the Aether portal at night.'),
          S('juniper', 'Then again, he also ordered the cinnamon fog. Twice.', 'worried')],
        goto: 'more',
      },
    }),

  opal: tree('opal', [S('opal', '(whispering) Welcome to the library. Please whisper. I am always whispering.')],
    '(whispering) Anything else?', [
      { text: 'I have a pie from Rosa!', if: [['quest', 'town_pie_delivery', 'active']], goto: 'pie' },
      { text: 'Did you enjoy the pie?', if: [['quest', 'town_pie_delivery', 'done'], once('opal_pie_chat')], goto: 'pie_done' },
      { text: 'Is something wrong?', if: [['quest', 'forest_goblin_trouble', 'none'], ['level', '>=', 6]], goto: 'goblins' },
      { text: 'Is something wrong?', if: [['quest', 'forest_goblin_trouble', 'none'], ['not', ['level', '>=', 6]]],
        goto: 'goblins_early' },
      { text: 'About those textbooks...', if: [['quest', 'forest_goblin_trouble', 'active']], goto: 'goblins_active' },
      { text: 'What do you recommend reading?', goto: 'books' },
      { text: 'Do you know anything about Malgrim?', if: [['flag', 'ambush_done']], goto: 'malgrim' },
      bye('(whispering) Bye.'),
    ], {
      pie: {
        say: [S('opal', '(whispering) Oh. Oh my. It is still warm.', 'happy'),
          S('opal', '(whispering, but louder) THANK YOU. Sorry. Thank you.', 'happy')],
        goto: 'more',
      },
      pie_done: {
        say: [S('opal', '(whispering) It was perfect. I ate it in the Reference section. Do not tell anyone.')],
        do: [['flag.set', 'opal_pie_chat', true]],
        goto: 'more',
      },
      goblins: {
        say: [S('opal', '(whispering) Goblins. Goblins took THREE copies of "Arithmancy for Beginners".', 'annoyed'),
          S('opal', '(whispering) They are overdue. They are VERY overdue. Their camp is in the Whisperwood.')],
        options: [
          { text: 'I will get them back.', do: [['quest.start', 'forest_goblin_trouble']], goto: 'goblins_yes' },
          { text: 'Goblins read?', goto: 'goblins_read' },
          { text: 'Maybe another time.', goto: 'more' },
        ],
      },
      goblins_read: {
        say: [S('opal', '(whispering) They doodle in the margins. Little hats on all the numbers.'),
          S('opal', '(whispering) It is honestly kind of cute. Still overdue.')],
        options: [
          { text: 'I will get them back.', do: [['quest.start', 'forest_goblin_trouble']], goto: 'goblins_yes' },
          { text: 'Maybe another time.', goto: 'more' },
        ],
      },
      goblins_early: {
        say: [S('opal', '(whispering) Some goblins borrowed books. Forever. You look a little new to fight goblins.'),
          S('opal', '(whispering) Come back when you are stronger. Level six, perhaps.')],
        goto: 'more',
      },
      goblins_yes: { say: [S('opal', '(whispering) Thank you. Late fees are... optional. For goblins. This time.')], goto: 'more' },
      goblins_active: {
        say: [S('opal', '(whispering) Goblin scouts carry them. They are in the camp, past the hollow.')],
        goto: 'more',
      },
      books: {
        say: [S('opal', '(whispering) "Fractions of Fire". "Ninety-Nine Uses for a Stick". "Mossback: A Nap Story".'),
          S('opal', '(whispering) The last one is very long and nothing happens.')],
        do: [['rel', 'opal', 1]],
        goto: 'more',
      },
      malgrim: {
        say: [S('opal', '(whispering) Malgrim? He borrowed "Barriers for Beginners" twelve years ago.'),
          S('opal', '(whispering) Never returned it. Clearly never finished it either.', 'annoyed')],
        goto: 'more',
      },
    }),

  // ---------------------------------------------------------------- guards
  hilda: tree('hilda', [S('hilda', 'Guard Hilda, Flinkerton Watch. No running in the square.')],
    'Anything else, citizen?', [
      { text: 'Lyle wants a heroic tale for his song.', if: [['quest', 'town_bard_ballad', 'active']], goto: 'ballad' },
      { text: 'What are the rules here?', goto: 'rules' },
      { text: 'Is the town safe?', goto: 'safe' },
      { text: 'Why are the gates sealed?', goto: 'gates' },
      bye('Bye, Guard Hilda.'),
    ], {
      ballad: {
        say: [S('hilda', 'A heroic tale? Once I stopped a cart from rolling into the fountain.', 'proud'),
          S('hilda', 'With my bare hands. And a sign that said "STOP". Tell him that.')],
        goto: 'more',
      },
      rules: {
        say: [S('hilda', 'No running. No swords in the square. Do not hit the townsfolk.'),
          S('hilda', 'Hit a townsperson and the Watch will chase you. Then the nurse will see you.', 'annoyed')],
        goto: 'more',
      },
      safe: {
        say: [S('hilda', 'Inside the walls? Very. Outside, slimes, goblins, the occasional villain.'),
          S('hilda', 'Malgrim? We have a poster. He drew it himself. He made his chin bigger.')],
        goto: 'more',
      },
      gates: {
        say: [S('hilda', 'Orders from the Headmaster. "Sealed until next term." I do not ask questions.'),
          S('hilda', 'I did ask one. He said "Paperwork". I stopped asking.')],
        goto: 'more',
      },
    }),

  bo: tree('bo', [S('bo', 'Evening. Or morning. I work nights. Guard Bo.')],
    'Mm. Something else?', [
      { text: 'Are you... knitting?', goto: 'knit' },
      { text: 'Anything strange at night?', goto: 'night' },
      { text: 'Tips for the forest?', if: [['flag', 'forest_open']], goto: 'tips' },
      { text: 'Could you knit something for me?', if: [['rel', 'bo', '>=', 2], once('gift_bo')], goto: 'gift' },
      bye('Stay safe, Bo.'),
    ], {
      knit: {
        say: [S('bo', 'Sweaters for the park ducks. Winter is cold. Ducks deserve sweaters.'),
          S('bo', 'Please do not tell Hilda. She thinks I am patrolling. I am also patrolling.', 'worried')],
        do: [['rel', 'bo', 1]],
        goto: 'more',
      },
      night: {
        say: [S('bo', 'Wisps by the pond, past the forest gate. Pretty. They zap, though.'),
          S('bo', 'And the Headmaster\'s window glows until very late. He grades a lot.')],
        goto: 'more',
      },
      tips: {
        say: [S('bo', 'Boars paw the ground before they charge. When they paw, you step aside.'),
          S('bo', 'Bats come in threes. Always threes. Never ask why.')],
        do: [['rel', 'bo', 1]],
        goto: 'more',
      },
      gift: {
        say: [S('bo', 'Already did. Purple. It is a cape. It was going to be a duck sweater. It got big.', 'happy')],
        do: [['give', 'cape_midnight', 1], ['flag.set', 'gift_bo', true]],
        goto: 'more',
      },
    }),

  ines: tree('ines', [S('ines', 'Guard Ines! Forest gate! Anything exciting out there? Please say yes.', 'happy')],
    'Anything else? Anything at all?', [
      { text: 'The Whisperwood is through here?', goto: 'forest' },
      { text: 'Tell me about yourself.', goto: 'story' },
      { text: 'I beat a giant tree!', if: [['flag', 'mossback_defeated']], goto: 'tree' },
      { text: 'Something exciting happened!', if: [['flag', 'ambush_done']], goto: 'ambush' },
      bye('Keep guarding, Ines!'),
    ], {
      forest: {
        say: [S('ines', 'Yes! West gate! Slimes near the entrance, then mushrooms, then bats, then goblins!'),
          S('ines', 'And the old grove is deep inside, behind a rune gate. Nobody goes there. Yet.')],
        goto: 'more',
      },
      story: {
        say: [S('ines', 'First week on the Watch! I applied to the Academy too. Rejected. Twice.', 'worried'),
          S('ines', 'But Mr. Laporte gave me a letter. It said "Try again. Bring a pencil."', 'happy')],
        do: [['rel', 'ines', 1]],
        goto: 'more',
      },
      tree: {
        say: [S('ines', 'Old MOSSBACK?! That is the most exciting thing I have ever heard!', 'shocked'),
          S('ines', 'I am telling everyone. I am telling the ducks.', 'happy')],
        goto: 'more',
      },
      ambush: {
        say: [S('ines', 'Malgrim ambushed you and Laporte zapped him with ONE spell?', 'shocked'),
          S('ines', 'Best. Week. Ever. Not for you. For me. Sorry.', 'happy')],
        goto: 'more',
      },
    }),

  // ---------------------------------------------------------------- townsfolk
  pumble: tree('pumble', [S('pumble', 'Ahem! Mayor Pumbleton, at your service! Welcome to Flinkerton, jewel of the valley!',
    'proud')], 'Ahem. Anything else for your mayor?', [
    { text: 'Lyle wants a heroic tale for his song.', if: [['quest', 'town_bard_ballad', 'active']], goto: 'ballad' },
    { text: 'Tell me about Flinkerton.', goto: 'town' },
    { text: 'Nice crown.', goto: 'crown' },
    { text: 'What about the sealed gates?', goto: 'gates' },
    { text: 'Any civic duties for me?', if: [['level', '>=', 3]], goto: 'duty' },
    bye('Bye, Mayor.'),
  ], {
    ballad: {
      say: [S('pumble', 'Heroic? Me? Well. I once gave a speech for six hours. Nobody left.', 'proud'),
        S('pumble', 'Mostly because I locked the doors. Fire safety. Put that in the song.')],
      goto: 'more',
    },
    town: {
      say: [S('pumble', 'Founded three hundred years ago by a wizard who got lost and refused to admit it.'),
        S('pumble', 'Now we have an Academy, four shops, a cafe, and the best fountain in the valley.', 'proud')],
      goto: 'more',
    },
    crown: {
      say: [S('pumble', 'Thank you! It is ceremonial. Nobody gave it to me. I gave it to me.', 'proud'),
        S('pumble', 'Fenwick says it is "a lot". I say a mayor should be a lot.')],
      do: [['rel', 'pumble', 1]],
      goto: 'more',
    },
    gates: {
      say: [S('pumble', GATES), S('pumble', 'The Headmaster seals them, the Headmaster opens them. I cut the ribbon.')],
      goto: 'more',
    },
    duty: {
      say: [S('pumble', 'Yes! Check the quest board by the fountain. Democracy in action!'),
        S('pumble', 'Also vote for me. There is no election. Vote anyway.', 'happy')],
      goto: 'more',
    },
  }),

  sol: tree('sol', [S('sol', 'Mind the petunias, friend. They are having a sensitive day.')],
    'Anything else? The tulips are listening.', [
      { text: 'Lyle wants a heroic tale for his song.', if: [['quest', 'town_bard_ballad', 'active']], goto: 'ballad' },
      { text: 'You talk to flowers?', goto: 'flowers' },
      { text: 'Were you an adventurer?', goto: 'story' },
      { text: 'Any advice for a new student?', goto: 'advice' },
      { text: 'Tell me about the old grove.', if: [['level', '>=', 7]], goto: 'grove' },
      bye('Bye, Sol.'),
    ], {
      ballad: {
        say: [S('sol', 'I once walked the whole Whisperwood with only a spoon. Long story. Great spoon.'),
          S('sol', 'Tell him the spoon was silver. It was wood. Songs need silver.', 'happy')],
        goto: 'more',
      },
      flowers: {
        say: [S('sol', 'Talk? No. I listen. Flowers do the talking. Mostly complaints about bees.')],
        do: [['rel', 'sol', 1]],
        goto: 'more',
      },
      story: {
        say: [S('sol', 'Thirty years on the road. I fought a goblin king. He was four feet tall and very rude.'),
          S('sol', 'Retired to the park. Fewer goblins. More ducks.')],
        goto: 'more',
      },
      advice: {
        say: [S('sol', 'Drink your potions before you need them, not after. And always read the telegraph.'),
          S('sol', 'When the ground glows under you, step off it. Simple. Most folks do not.')],
        goto: 'more',
      },
      grove: {
        say: [S('sol', 'Old Mossback lives there. Ancient treant. Grumpy when woken. Shields himself with runes.'),
          S('sol', 'Break his shields with a clear head. Answer true and the runes crack.')],
        do: [['give', 'herbal_tea', 1]],
        goto: 'more',
      },
    }),

  lyle: tree('lyle', [S('lyle', 'Behold! It is I, Lyle! Bard of Flinkerton! Would you like a song? It is about me.',
    'proud')], 'Another request? Not that you asked.', [
    { text: 'Sure, sing me a song.', goto: 'song' },
    { text: 'Need inspiration?', if: [['quest', 'town_bard_ballad', 'none']], goto: 'quest' },
    { text: 'I talked to everyone!', if: [['quest', 'town_bard_ballad', 'done'], once('lyle_sang')], goto: 'premiere' },
    { text: 'How many songs do you know?', goto: 'count' },
    bye('Bye, Lyle.'),
  ], {
    song: {
      say: [S('lyle', 'Ahem. "Oh Lyle, oh Lyle, so handsome and so tall..."', 'happy'),
        S('lyle', '"...he plays the lute, though he has no lute at all..."'), S('lyle', 'Thank you. Thank you. Too kind.')],
      goto: 'more',
    },
    quest: {
      say: [S('lyle', 'Inspiration? Yes! I need a heroic tale that is not about me. Shocking, I know.'),
        S('lyle', 'Ask Guard Hilda, the Mayor, and Old Sol for their bravest moments. Then report back!')],
      options: [
        { text: 'I will gather the tales.', do: [['quest.start', 'town_bard_ballad']], goto: 'quest_yes' },
        { text: 'Maybe later.', goto: 'more' },
      ],
    },
    quest_yes: { say: [S('lyle', 'Splendid! I will warm up my voice. Mi mi MIIII!', 'happy')], goto: 'more' },
    premiere: {
      say: [S('lyle', 'A cart, a six-hour speech, and a wooden spoon. MAGNIFICENT.', 'proud'),
        S('lyle', '"And {name} gathered tales from far and near... and also Lyle was there." Perfect.', 'happy')],
      do: [['flag.set', 'lyle_sang', true]],
      goto: 'more',
    },
    count: {
      say: [S('lyle', 'Three. "Lyle", "Lyle Part Two" and "Lyle (Acoustic)".'), P('You do not have an instrument.'),
        S('lyle', 'That is what makes it acoustic.', 'proud')],
      goto: 'more',
    },
  }),

  nia: tree('nia', [S('nia', 'Oh! A first-year! Hi! I am Nia, second-year. Do you need tutoring? I love tutoring.', 'happy')],
    'What else? I have flashcards.', [
      { text: 'What are lessons like?', goto: 'lessons' },
      { text: 'Any study tips?', goto: 'tips' },
      { text: 'Why do you keep looking up?', goto: 'pigeons' },
      { text: 'I picked the mage path!', if: [['class', 'mage']], goto: 'mage' },
      { text: 'Have any spare notes?', if: [['rel', 'nia', '>=', 2], once('gift_nia')], goto: 'gift' },
      bye('Bye, Nia!'),
    ], {
      lessons: {
        say: [S('nia', 'Professor Quill teaches Arithmancy in classroom one. Professor Rook does runes in two.'),
          S('nia', 'Each right answer earns XP and a little gold. It is basically getting paid to be smart!', 'happy')],
        do: [['rel', 'nia', 1]],
        goto: 'more',
      },
      tips: {
        say: [S('nia', 'Show your work. Check your answer. If it says "giant rat equals 40", that is fine.'),
          S('nia', 'Also sleep. Sleeping is studying, but lying down.')],
        do: [['rel', 'nia', 1]],
        goto: 'more',
      },
      pigeons: {
        say: [S('nia', 'Pigeons. They watch. They plan. One stole my sandwich in first year.', 'worried'),
          S('nia', 'I still have dreams about it.', 'worried')],
        goto: 'more',
      },
      mage: {
        say: [S('nia', 'A mage! Me too! Tip: Blink AWAY from danger. Not into it. Ask me how I know.', 'happy')],
        goto: 'more',
      },
      gift: {
        say: [S('nia', 'Take these! Elowen and I made them. Color-coded. You will learn SO much.', 'happy')],
        do: [['give', 'study_notes', 1], ['flag.set', 'gift_nia', true]],
        goto: 'more',
      },
    }),

  ravi: tree('ravi', [S('ravi', 'Hey! Watch your eyebrows. I am practicing sparks. Oh, it is fine, I am done.', 'happy')],
    'Anything else? I promise not to sneeze.', [
      { text: 'Do your spells always go wrong?', goto: 'oops' },
      { text: 'What is the training yard like?', goto: 'yard' },
      { text: 'Any rumors?', goto: 'rumor' },
      { text: 'Want to see a trick?', if: [['class', 'rogue']], goto: 'rogue' },
      { text: 'Hit things with me sometime?', if: [['class', 'warrior']], goto: 'warrior' },
      bye('Bye, Ravi!'),
    ], {
      oops: {
        say: [S('ravi', 'Not ALWAYS. Sometimes they go wrong in a cool way.'),
          S('ravi', 'Last week I turned a cabbage into a slightly different cabbage. Progress!', 'proud')],
        do: [['rel', 'ravi', 1]],
        goto: 'more',
      },
      yard: {
        say: [S('ravi', 'Training dummies behind the Academy! Hit them as much as you want. They do not mind.'),
          S('ravi', 'They heal right up. I have hit one four hundred times. We are friends now.')],
        goto: 'more',
      },
      rumor: {
        say: [S('ravi', 'People say Mr. Laporte can stop a meteor with one hand.'),
          S('ravi', 'I asked him. He said "Two hands. One is holding coffee."', 'happy')],
        goto: 'more',
      },
      rogue: {
        say: [S('ravi', 'Wait, where did my wand go? ...Oh, it is in MY pocket. You put it back? Respect.', 'shocked')],
        goto: 'more',
      },
      warrior: {
        say: [S('ravi', 'From a safe distance! A very safe distance! I will cheer!', 'happy')],
        goto: 'more',
      },
    }),

  // ---------------------------------------------------------------- props
  quest_board: {
    start: 'board',
    nodes: {
      board: {
        say: [S('narrator', 'FLINKERTON NOTICE BOARD. Lost: one goose. Found: same goose. Help wanted below.')],
        options: [
          { text: '"Pie courier needed. Ask Rosa at the bakery."', if: [['quest', 'town_pie_delivery', 'none']],
            do: [['quest.start', 'town_pie_delivery'], ['give', 'warm_pie', 1]], goto: 'taken' },
          { text: '"Cafe seeks slime jelly. Ask for Juniper."', if: [['quest', 'town_jelly_latte', 'none'], ['flag', 'forest_open']],
            do: [['quest.start', 'town_jelly_latte']], goto: 'taken' },
          { text: '"Bard seeks heroic tales (not about bard)."', if: [['quest', 'town_bard_ballad', 'none']],
            do: [['quest.start', 'town_bard_ballad']], goto: 'taken' },
          { text: '"Ranger Tam needs help with sporecaps. See Mo."',
            if: [['quest', 'forest_mushroom_mischief', 'none'], ['flag', 'forest_open']], goto: 'mo' },
          { text: '"OVERDUE: 3 textbooks. Goblins. -Madam Opal"', if: [['quest', 'forest_goblin_trouble', 'none']], goto: 'opal' },
          { text: 'Read the small print.', goto: 'small' },
          { text: 'Walk away.', end: true },
        ],
      },
      taken: { say: [S('narrator', 'You take the notice. Someone has drawn a tiny goose on the back.')], goto: 'board' },
      mo: { say: [S('narrator', 'Mo the Forager can be found in the Whisperwood glade, sneezing.')], goto: 'board' },
      opal: { say: [S('narrator', 'Talk to Madam Opal at the library. Recommended level: 6. Whispering: mandatory.')],
        goto: 'board' },
      small: {
        say: [S('narrator', '"All gates except the forest gate are sealed until next term. -Mr. Laporte"'),
          S('narrator', 'Under it, in crayon: "next term is FOREVER. -T."')],
        goto: 'board',
      },
    },
  },

  cafe_door: {
    start: 'door',
    nodes: {
      door: {
        say: [S('juniper', 'Welcome to The Cozy Cup! Sit anywhere! The good seats are taken by the Mayor.', 'happy')],
        options: [
          { text: 'One hot cocoa, please. (3 gold)', if: [['gold', '>=', 3]], do: [['gold', -3], ['heal']], goto: 'cocoa' },
          { text: 'One hot cocoa, please. (3 gold)', if: [['not', ['gold', '>=', 3]]], goto: 'broke' },
          { text: 'What is on the menu?', goto: 'menu' },
          { text: 'Just looking.', end: true },
        ],
      },
      cocoa: { say: [S('juniper', 'Here you go! Extra marshmallows. You look like you fought a rat today.', 'happy')] },
      broke: { say: [S('juniper', 'Oh no, no gold? Here, a tiny free sip. Do not tell the Mayor.', 'happy')], do: [['heal']] },
      menu: {
        say: [S('juniper', 'Hot cocoa. Cinnamon fog. Laporte\'s Usual, which is black coffee and a sigh.'),
          S('juniper', 'And, if somebody brings me slime jelly... something NEW.')],
        goto: 'door',
      },
    },
  },

  library_door: {
    start: 'door',
    nodes: {
      door: {
        say: [S('narrator', 'FLINKERTON PUBLIC LIBRARY. Please whisper. Overdue books will be found.')],
        options: [
          { text: 'Peek inside.', goto: 'peek' },
          { text: 'Read the returns slot.', goto: 'slot' },
          { text: 'Leave quietly.', end: true },
        ],
      },
      peek: {
        say: [S('narrator', 'Endless shelves. A cat asleep on "Advanced Fractions". Madam Opal waves, silently.')],
        goto: 'door',
      },
      slot: {
        say: [S('narrator', 'Someone left a note: "Sorry for the late return. -A goblin". There is no book.')],
        options: [
          { text: 'Check under the slot.', if: [once('library_coin')], do: [['gold', 5], ['flag.set', 'library_coin', true]],
            goto: 'coin' },
          { text: 'Back.', goto: 'door' },
        ],
      },
      coin: { say: [S('narrator', 'You find 5 gold that fell out of someone\'s pocket. Probably Pip\'s.')], goto: 'door' },
    },
  },
};
