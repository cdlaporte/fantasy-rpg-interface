// Frostwhistle Peaks dialogues: Nana Frost (cocoa, mittens, the summit), Dr. Flurry (spire survey), cozy Grumbleflake.
const S = (who, text, mood = 'calm') => ({ who, mood, text });
const P = (text, mood = 'calm') => ({ who: 'player', mood, text });
const bye = (text = 'See you!') => ({ text, end: true });
const once = (flag) => ['not', ['flag', flag]];

function tree(id, greet, more, options, nodes) {
  return {
    start: 'hub',
    nodes: Object.assign({ hub: { say: greet, options }, more: { say: [S(id, more)], options } }, nodes),
  };
}

export default {
  nana_frost: tree('nana_frost',
    [S('nana_frost', 'Come in, come in, pet! Snow on your boots, cocoa in your future. Sit by the fire.', 'happy')],
    'Anything else, pet? The pot is never empty.', [
      { text: 'Buy a mug of cocoa (24 gold).', if: [['gold', '>=', 24]], hint: 'You need 24 gold.', do: [['gold', -24], ['give', 'frost_cocoa', 1], ['sfx', 'pickup']], goto: 'bought' },
      { text: 'What is up the mountain?', if: [['quest', 'peaks_summit', 'none']], goto: 'summit' },
      { text: 'About the summit...', if: [['quest', 'peaks_summit', 'active']], goto: 'summit_active' },
      { text: 'The summit is quiet now.', if: [['quest', 'peaks_summit', 'done'], once('nana_summit_chat')], goto: 'summit_done' },
      { text: 'You look worried.', if: [['quest', 'peaks_lost_mittens', 'none']], goto: 'mittens' },
      { text: 'About those mittens...', if: [['quest', 'peaks_lost_mittens', 'active']], goto: 'mittens_active' },
      { text: 'Tell me about the igloos.', goto: 'igloos' },
      { text: 'Can I rest by the fire?', goto: 'rest' },
      { text: 'Any warm tips?', if: [['rel', 'nana_frost', '>=', 2], once('gift_nana')], goto: 'gift' },
      bye('Thanks, Nana.'),
    ], {
      bought: {
        say: [S('nana_frost', 'One cocoa, extra marshmallow. It keeps warming you while you fight, so drink it early.', 'happy')],
        do: [['rel', 'nana_frost', 1]],
        goto: 'more',
      },
      summit: {
        say: [S('nana_frost', 'Up there? Grumbleflake. A yeti the size of a barn. Grumpy as a wet cat. Roars at the sky.', 'worried'),
          S('nana_frost', 'A rune gate guards his summit. Cross the pond, climb the switchbacks. Bring cocoa. Lots.')],
        options: [
          { text: 'I will talk to him.', do: [['quest.start', 'peaks_summit']], goto: 'summit_yes' },
          { text: 'Why is he so grumpy?', goto: 'why' },
          { text: 'Not yet.', goto: 'more' },
        ],
      },
      why: {
        say: [S('nana_frost', 'Nobody knows. I only know he stomps every night. Snow avalanches off the roof.'),
          S('nana_frost', 'If you ask me, it is cold paws. Cold paws make anybody cross.')],
        options: [
          { text: 'I will talk to him.', do: [['quest.start', 'peaks_summit']], goto: 'summit_yes' },
          { text: 'Not yet.', goto: 'more' },
        ],
      },
      summit_yes: {
        say: [S('nana_frost', 'Bless you, pet. The ice-crystal spires are north of the village. Mind the golems.'),
          S('nana_frost', 'Frost sprites shoot from afar. Penguins guard the pond. Pretend to be polite.')],
        do: [['give', 'frost_cocoa', 2]],
        goto: 'more',
      },
      summit_active: {
        say: [S('nana_frost', 'Spires, switchbacks, rune gate, then the big fluffy one. Drink cocoa before the fight.')],
        goto: 'more',
      },
      summit_done: {
        say: [S('nana_frost', 'Quiet at last! No more avalanches on my roof. You are a marvel, pet.', 'happy'),
          S('nana_frost', 'The snow is sparkling again. Look at it go.', 'happy')],
        do: [['flag.set', 'nana_summit_chat', true], ['rel', 'nana_frost', 1]],
        goto: 'more',
      },
      mittens: {
        say: [S('nana_frost', 'My knitting circle keeps losing mittens. The snow bunnies carry them off to line their burrows.', 'worried'),
          S('nana_frost', 'Five lost mittens and I can finish a whole set. Would you fetch them?')],
        options: [
          { text: 'I will find them.', do: [['quest.start', 'peaks_lost_mittens']], goto: 'mittens_yes' },
          { text: 'Maybe later.', goto: 'more' },
        ],
      },
      mittens_yes: {
        say: [S('nana_frost', 'Lovely! Bunnies hop at you in packs. Hit them when they land, not when they leap.', 'happy')],
        goto: 'more',
      },
      mittens_active: {
        say: [S('nana_frost', 'Any mittens yet? They are lopsided and a bit chewed. You cannot miss them.')],
        goto: 'more',
      },
      igloos: {
        say: [S('nana_frost', 'Warm as toast inside. Ice is a wonderful blanket. Do not tell the penguins I said so.'),
          P('Penguins have opinions about igloos?'), S('nana_frost', 'Penguins have opinions about everything.', 'happy')],
        do: [['rel', 'nana_frost', 1]],
        goto: 'more',
      },
      rest: {
        say: [S('nana_frost', 'Sit, sit. Here, a blanket and a bowl of soup. Feel better?')],
        do: [['heal'], ['fx', { type: 'heal', at: 'player' }]],
        goto: 'more',
      },
      gift: {
        say: [S('nana_frost', 'You have been so kind. Take this. I made it when I was young. It still goes bang.', 'happy')],
        do: [['give', 'icicle_bomb', 2], ['flag.set', 'gift_nana', true]],
        goto: 'more',
      },
    }),

  dr_flurry: tree('dr_flurry',
    [S('dr_flurry', 'Ah, a visitor! Please do not touch the spires. Well. A little. For science.', 'happy')],
    'Yes? I am between measurements.', [
      { text: 'What do you study?', goto: 'study' },
      { text: 'Can I help?', if: [['quest', 'peaks_ice_survey', 'none']], goto: 'survey' },
      { text: 'About the survey...', if: [['quest', 'peaks_ice_survey', 'active']], goto: 'survey_active' },
      { text: 'The survey is done.', if: [['quest', 'peaks_ice_survey', 'done'], once('flurry_thanks')], goto: 'survey_done' },
      { text: 'Why do the spires hum?', goto: 'hum' },
      { text: 'Is the summit safe?', goto: 'safe' },
      { text: 'What about Grumbleflake?', if: [['flag', 'grumbleflake_defeated'], once('flurry_yeti')], goto: 'yeti' },
      bye('Good luck with the clipboard.'),
    ], {
      study: {
        say: [S('dr_flurry', 'The spires! Each one grows in a perfect triangle. Tall, thin, humming.'),
          S('dr_flurry', 'I measure the height from the shadow. Same sun, same angle, so similar triangles. Neat, right?', 'happy')],
        do: [['rel', 'dr_flurry', 1]],
        goto: 'more',
      },
      survey: {
        say: [S('dr_flurry', 'Yes! I need three spires measured. Stand beside each, press E, and read the numbers aloud.'),
          S('dr_flurry', 'And the frost sprites keep fogging my lens. Pop four of them? They pop politely.')],
        options: [
          { text: 'Happy to.', do: [['quest.start', 'peaks_ice_survey']], goto: 'survey_yes' },
          { text: 'Later.', goto: 'more' },
        ],
      },
      survey_yes: {
        say: [S('dr_flurry', 'Wonderful! The spires are in the field north of the village. Mind the golems. They lurk.', 'happy')],
        goto: 'more',
      },
      survey_active: {
        say: [S('dr_flurry', 'Three spires to measure, then four sprites. Hurry, the sun moves. That is how shadows work.')],
        goto: 'more',
      },
      survey_done: {
        say: [S('dr_flurry', 'Perfect data! The spires are exactly as tall as they look. A breakthrough.', 'happy'),
          S('dr_flurry', 'Keep the potions I owe you. Science is mostly bumps and bruises.')],
        do: [['flag.set', 'flurry_thanks', true], ['rel', 'dr_flurry', 2]],
        goto: 'more',
      },
      hum: {
        say: [S('dr_flurry', 'The wind plays them like organ pipes. Taller spire, lower note. Pure geometry.'),
          S('dr_flurry', 'Stand between two and hum. They hum back. I have been here three years.')],
        goto: 'more',
      },
      safe: {
        say: [S('dr_flurry', 'Define safe. The switchbacks are sturdy. The yeti is loud. The ice is slippery.'),
          S('dr_flurry', 'Statistically the penguins are the biggest risk. They have spears. And manners.')],
        goto: 'more',
      },
      yeti: {
        say: [S('dr_flurry', 'The avalanches stopped! I have a theory. Yetis are just big cats that need mittens.', 'happy'),
          S('dr_flurry', 'I will publish. Nobody will believe me. Splendid.', 'happy')],
        do: [['flag.set', 'flurry_yeti', true], ['rel', 'dr_flurry', 1]],
        goto: 'more',
      },
    }),

  grumbleflake_cub: {
    start: 'hub',
    nodes: {
      hub: {
        say: [S('grumbleflake_cub', 'Hrmph. You again. Do not look at the scarf. It is... functional.', 'annoyed')],
        options: [
          { text: 'Are you warmer now?', goto: 'warm' },
          { text: 'Nana Frost knitted you mittens.', if: [['flag', 'nana_mittens_done'], once('cub_mittens')], goto: 'mittens' },
          { text: 'Nice scarf.', goto: 'scarf' },
          bye('Take care, Grumbleflake.'),
        ],
      },
      warm: {
        say: [S('grumbleflake_cub', 'Slightly. Nana Frost sent over a mug. I did not ask. It was... fine. More than fine.', 'happy')],
        goto: 'hub',
      },
      mittens: {
        say: [S('grumbleflake_cub', 'For... ME? Extra large? ...They fit. They FIT. Do not tell anyone I sniffled.', 'happy'),
          S('grumbleflake_cub', 'Take this. I found it in the snow. It is shiny. I am not shiny. You are.', 'happy')],
        do: [['flag.set', 'cub_mittens', true], ['give', 'focus_scroll', 1], ['xp', 60], ['rel', 'grumbleflake_cub', 2]],
        goto: 'hub',
      },
      scarf: {
        say: [S('grumbleflake_cub', 'I said do not LOOK at it. ...Thank you.', 'annoyed')],
        goto: 'hub',
      },
    },
  },
};
