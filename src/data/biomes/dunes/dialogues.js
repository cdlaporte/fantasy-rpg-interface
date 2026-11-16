// Sunscorch Dunes dialogues: Ziva (caravan merchant, quest hub, desert goods), Professor Dusty (archaeologist),
// and the sleepy kitten-sized Sandsnout after the boss. Same conventions as src/data/dialogues/forest.js.
const S = (who, text, mood = 'calm') => ({ who, mood, text });
const P = (text, mood = 'calm') => ({ who: 'player', mood, text });
const bye = (text = 'See you!') => ({ text, end: true });
const once = (flag) => ['not', ['flag', flag]];
const step = (q, n) => ['quest', q, 'step', n];
const buy = (text, price, item) => ({
  text: `${text} (${price} gold)`, if: [['gold', '>=', price]], hint: 'Not enough gold.',
  do: [['gold', -price], ['give', item, 1], ['sfx', 'coin']], goto: 'wares_more',
});

function tree(id, greet, more, options, nodes) {
  return {
    start: 'hub',
    nodes: Object.assign({ hub: { say: greet, options }, more: { say: [S(id, more)], options } }, nodes),
  };
}

const CARAVAN = 'dunes_lost_caravan';
const WATER = 'dunes_oasis_water';
const RUB = 'dunes_obelisk_rubbings';

const wares = [
  buy('Cactus Water', 12, 'cactus_water'),
  buy('Sand Veil', 25, 'sand_veil'),
  buy('Small Potion', 15, 'potion_small'),
  buy('Speed Tonic', 18, 'speed_tonic'),
  { text: 'That is all, thanks.', goto: 'more' },
];

const ziva = tree('ziva', [
  S('ziva', 'Welcome to Ziva\'s Caravan! Shade, water and fair prices. Mostly shade.', 'happy'),
  { who: 'ziva', mood: 'calm', text: 'Early customer! The sun is barely up and already trying to cook everyone.', if: [['hour', 'between', 6, 10]] },
  { who: 'ziva', mood: 'calm', text: 'Night shift. Quiet, cold, and the scorpions are on break. Pull up a log.', if: [['hour', 'between', 19, 24]] },
], 'What else can I do for you?', [
  { text: 'What happened to your caravan?', if: [['quest', CARAVAN, 'none']], goto: 'story' },
  { text: 'Where are the lost carts again?', if: [step(CARAVAN, 0)], goto: 'hint_north' },
  { text: 'Where are the lost carts again?', if: [step(CARAVAN, 1)], goto: 'hint_south' },
  { text: 'Where are the lost carts again?', if: [step(CARAVAN, 2)], goto: 'hint_canyon' },
  { text: 'I found all three carts.', if: [step(CARAVAN, 3)], goto: 'carts_back' },
  { text: 'About the ruins...', if: [['quest', CARAVAN, 'active'], ['not', step(CARAVAN, 0)], ['not', step(CARAVAN, 1)],
    ['not', step(CARAVAN, 2)], ['not', step(CARAVAN, 3)], ['not', step(CARAVAN, 7)]], goto: 'ruins_active' },
  { text: 'The road is clear, Ziva.', if: [step(CARAVAN, 7)], goto: 'road_clear' },
  { text: 'Is the camp well alright?', if: [['quest', WATER, 'none']], goto: 'water_story' },
  { text: 'About the oasis...', if: [['quest', WATER, 'active'], ['not', step(WATER, 3)]], goto: 'water_active' },
  { text: 'The waterskins are full.', if: [step(WATER, 3)], goto: 'water_done' },
  { text: 'Show me your desert goods.', goto: 'wares' },
  { text: 'Tell me about the desert.', goto: 'lore' },
  { text: 'Can we just sit by the fire?', if: [['rel', 'ziva', '>=', 2], once('gift_ziva')], goto: 'gift' },
  bye('Stay shady, Ziva.'),
], {
  story: {
    say: [S('ziva', 'Sandstorm. Hit us in the night. Three carts blew off toward the dunes. Lanterns, tents, supplies.', 'worried'),
      S('ziva', 'Without them I cannot sell, and nobody can cross to the ruins. And something cranky is in there.'),
      S('ziva', 'Could you find my carts? Each one wears a painted Z. I will make it worth your while.')],
    options: [
      { text: 'I will find them.', do: [['quest.start', CARAVAN]], goto: 'story_yes' },
      { text: 'What kind of cranky?', goto: 'cranky' },
      { text: 'Maybe later.', goto: 'more' },
    ],
  },
  cranky: {
    say: [S('ziva', 'A sphinx. Sultana Sandsnout. Lives in the sun-gate court. Loves riddles. Loves gloating more.'),
      S('ziva', 'She shut the gate with a rune seal ages ago. Rumor says she is just lonely. And a little rude.')],
    options: [
      { text: 'I will find them.', do: [['quest.start', CARAVAN]], goto: 'story_yes' },
      { text: 'Maybe later.', goto: 'more' },
    ],
  },
  story_yes: {
    say: [S('ziva', 'Bless you! One blew north, one into the cactus garden, one toward the scorpion canyon.', 'happy'),
      S('ziva', 'Take this. Scarabs are small but they come in packs. Four at a time. Remember that.')],
    do: [['give', 'cactus_water', 2]],
    goto: 'more',
  },
  hint_north: {
    say: [S('ziva', 'The first one went north, past the old quarry. Palm, a barrel, a lot of scarabs.')],
    goto: 'more',
  },
  hint_south: {
    say: [S('ziva', 'The second blew south-west. Into the cactus garden. They shoot, so keep moving.')],
    goto: 'more',
  },
  hint_canyon: {
    say: [S('ziva', 'The last one rolled toward the canyon near the oasis. Scorpions. Watch for the tail.')],
    goto: 'more',
  },
  carts_back: {
    say: [S('ziva', 'All three! With the lanterns intact? You absolute marvel.', 'happy'),
      S('ziva', 'The lanterns were for the ruins. Professor Dusty has waited weeks for them.'),
      S('ziva', 'The trail leads to the ruins and the sun gate. Be careful. That is the part with the riddles.')],
    do: [['rel', 'ziva', 1], ['toast', 'Next: follow the trail east to the ruins.', 'quest']],
    goto: 'more',
  },
  ruins_active: {
    say: [S('ziva', 'Ruins east of the dust flats. Professor Dusty camps there. The gate is north of the plaza.'),
      S('ziva', 'Sandsnout loves riddles. Think before you answer. She can tell when you guess.')],
    goto: 'more',
  },
  road_clear: {
    say: [S('ziva', 'You beat the sphinx? And the sun gate is open? Come here. I am hugging you.', 'happy'),
      P('Okay. Okay. Brief hug.'),
      S('ziva', 'The caravans can cross again. And the carts brought the ruins their lanterns. Perfect timing.', 'happy')],
    do: [['rel', 'ziva', 2]],
    goto: 'more',
  },
  water_story: {
    say: [S('ziva', 'The camp well is dry. Third time this week. The oasis spring should be fine, but scorpions are loitering.', 'worried'),
      S('ziva', 'Thin out the scorpions in the canyon, fill our waterskins at the oasis well, and bring them back?')],
    options: [
      { text: 'Water delivery. Got it.', do: [['quest.start', WATER]], goto: 'water_yes' },
      { text: 'Maybe later.', goto: 'more' },
    ],
  },
  water_yes: {
    say: [S('ziva', 'You are a lifesaver. The oasis is south of the dust flats. Watch your step near the canyon.', 'happy')],
    goto: 'more',
  },
  water_active: {
    say: [S('ziva', 'Scorpions first, then the well. The spring is cold, clear, and worth every step.')],
    goto: 'more',
  },
  water_done: {
    say: [S('ziva', 'Cold water! The camp will sing tonight. Here, for your trouble.', 'happy')],
    goto: 'more',
  },
  wares: {
    say: [S('ziva', 'Cactus water, sand veils, a few potions. Everything is a bargain. Some things are a bigger bargain.')],
    options: wares,
  },
  wares_more: {
    say: [S('ziva', 'A pleasure doing business! Anything else?', 'happy')],
    options: wares,
  },
  lore: {
    say: [S('ziva', 'The desert is quiet if you let it be. What do you want to know about?')],
    options: [
      { text: 'The scarabs.', goto: 'lore_scarab' },
      { text: 'The sphinx.', goto: 'lore_sphinx' },
      { text: 'The oasis.', goto: 'lore_oasis' },
      { text: 'Never mind.', goto: 'more' },
    ],
  },
  lore_scarab: {
    say: [S('ziva', 'Shiny little beetles. Packs of four. They skitter at you in a line, then bump you with their shells.'),
      S('ziva', 'Step aside when you see the line on the ground. Sideways. Always sideways.')],
    do: [['rel', 'ziva', 1]],
    goto: 'lore',
  },
  lore_sphinx: {
    say: [S('ziva', 'Sultana Sandsnout. Big as a cart, claws like a market stall roof. When she shields, she asks a riddle.'),
      S('ziva', 'Answer truly and the shield shatters. Answer wrongly and she gloats. Loudly.')],
    goto: 'lore',
  },
  lore_oasis: {
    say: [S('ziva', 'Palms, grass, cold water, and absolutely nobody guarding it. Come back here if you are hurt.')],
    goto: 'lore',
  },
  gift: {
    say: [S('ziva', 'Sit. Watch the sparks. ...You are good company. Here. A little something from the bottom of my crate.', 'happy')],
    do: [['give', 'sand_veil', 2], ['flag.set', 'gift_ziva', true]],
    goto: 'more',
  },
});

const dusty = tree('professor_dusty', [
  S('professor_dusty', 'Ah! A visitor! Do not touch that. Actually, touch that, it is fine. I am Professor Dusty!', 'happy'),
], 'Anything else? I have time. Several thousand years of it.', [
  { text: 'What are you digging for?', goto: 'dig' },
  { text: 'Need a hand with the glyphs?', if: [['quest', RUB, 'none']], goto: 'rub_pitch' },
  { text: 'About those glyph copies...', if: [['quest', RUB, 'active'], ['not', step(RUB, 3)]], goto: 'rub_active' },
  { text: 'I copied all three glyphs.', if: [step(RUB, 3)], goto: 'rub_done' },
  { text: 'Who built these ruins?', goto: 'who' },
  { text: 'Tell me about the sphinx.', goto: 'sphinx' },
  { text: 'Try me with a riddle.', if: [once('dusty_riddle_done')], goto: 'riddle' },
  { text: 'Is there somewhere to rest?', goto: 'rest' },
  bye('Good luck with the dust.'),
], {
  dig: {
    say: [S('professor_dusty', 'The Sun Court! A civilization that built an entire gate just to ask people riddles.', 'happy'),
      S('professor_dusty', 'Three obelisks hold the clues. Sun, moon, star. I must copy them. My knees disagree.')],
    goto: 'more',
  },
  rub_pitch: {
    say: [S('professor_dusty', 'My knees are not what they were. Could you copy the glyphs on the three obelisks?', 'worried'),
      S('professor_dusty', 'Sun to the west, moon to the east, star by the south wall. Just press and trace. Gentle!')],
    options: [
      { text: 'Happy to.', do: [['quest.start', RUB]], goto: 'rub_yes' },
      { text: 'Maybe later.', goto: 'more' },
    ],
  },
  rub_yes: {
    say: [S('professor_dusty', 'Wonderful! Press the paper on the stone, trace it, and be gentle. The stone is very old and very shy.', 'happy')],
    do: [['toast', 'Study the three obelisks: sun, moon and star.', 'quest']],
    goto: 'more',
  },
  rub_active: {
    say: [S('professor_dusty', 'Sun obelisk west, moon east, star south. Study each one. Press E when you are next to it.')],
    goto: 'more',
  },
  rub_done: {
    say: [S('professor_dusty', 'A sun, a moon, a star! Let me see... ha! "Be kind to the sphinx."', 'happy'),
      S('professor_dusty', 'Oh. And... "she cheats at riddles." I may have misread that. Take your reward.')],
    do: [['rel', 'professor_dusty', 2]],
    goto: 'more',
  },
  who: {
    say: [S('professor_dusty', 'Nobody knows! Which is very exciting. Do you have a theory?')],
    options: [
      { text: 'The sphinx built it.', goto: 'who_sphinx' },
      { text: 'Aliens.', goto: 'who_aliens' },
      { text: 'Very committed masons.', goto: 'who_masons' },
    ],
  },
  who_sphinx: {
    say: [S('professor_dusty', 'Possible! She is old enough. And she has been awfully smug about it.', 'happy')],
    do: [['rel', 'professor_dusty', 1]],
    goto: 'more',
  },
  who_aliens: {
    say: [S('professor_dusty', 'That is what my funding committee says too. I do not like it.', 'annoyed')],
    goto: 'more',
  },
  who_masons: {
    say: [S('professor_dusty', 'YES. Thank you. Masons. Brilliant masons. I will put it on the plaque.', 'happy')],
    do: [['rel', 'professor_dusty', 1]],
    goto: 'more',
  },
  sphinx: {
    say: [S('professor_dusty', 'Sultana Sandsnout. She guards the sun gate. And loves riddles more than anything alive.'),
      S('professor_dusty', 'The gate asks one question to open. In battle, she shields herself and asks two more.'),
      S('professor_dusty', 'Answer truly and the shield shatters. Guess, and she laughs. Take your time.')],
    goto: 'more',
  },
  riddle: {
    say: [S('professor_dusty', 'A riddle! Splendid. Three sides, three corners. Whatever the shape, the three angles always add up to...?')],
    options: [
      { text: '90 degrees.', goto: 'riddle_no' },
      { text: '180 degrees.', goto: 'riddle_yes' },
      { text: '360 degrees.', goto: 'riddle_no' },
    ],
  },
  riddle_no: {
    say: [S('professor_dusty', 'Hm, not quite. Draw one, tear off the corners, and line them up. Try again!', 'worried')],
    goto: 'riddle',
  },
  riddle_yes: {
    say: [S('professor_dusty', 'A straight line! One hundred eighty! You have the mind of an archaeologist.', 'happy')],
    do: [['xp', 40], ['flag.set', 'dusty_riddle_done', true], ['rel', 'professor_dusty', 1]],
    goto: 'more',
  },
  rest: {
    say: [S('professor_dusty', 'Sit in my tent. There is shade, a cup of mint tea, and only one tiny dead scorpion.')],
    do: [['heal'], ['fx', { type: 'heal', at: 'player' }]],
    goto: 'more',
  },
});

export default {
  ziva,
  professor_dusty: dusty,
  sandsnout_kit: {
    start: 'hub',
    nodes: {
      hub: {
        say: [S('sandsnout_kit', 'Zzz... oh. You. The one who answered all my riddles. Rude. Impressive. Rude.', 'annoyed')],
        options: [
          { text: 'Got a riddle for me?', goto: 'riddle' },
          { text: 'Sorry about the nap.', goto: 'sorry' },
          bye('Sleep well, Sandsnout.'),
        ],
      },
      riddle: {
        say: [S('sandsnout_kit', 'Four equal sides, four right angles. What am I? Besides adorable.')],
        options: [
          { text: 'A square.', goto: 'yes' },
          { text: 'A triangle.', goto: 'no' },
          { text: 'A very smug sphinx.', goto: 'smug' },
        ],
      },
      yes: {
        say: [S('sandsnout_kit', 'Correct. Annoyingly. Fine. Take a compliment. They are free in the desert.', 'happy')],
        end: true,
      },
      no: { say: [S('sandsnout_kit', 'No! Triangles have three sides! Honestly. What do they teach you?', 'annoyed')], goto: 'riddle' },
      smug: { say: [S('sandsnout_kit', 'Ha! That is also true. But no. Try again.', 'happy')], goto: 'riddle' },
      sorry: {
        say: [S('sandsnout_kit', 'It was a very good nap. The gate and I were fine. Do come back with more riddles.')],
        end: true,
      },
    },
  },
};
