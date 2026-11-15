// Academy dialogues: Mr. Laporte, the classmate who stayed (friendly rival), the two teachers and the nurse.
// Laporte: short, deadpan, teacherly, kind underneath. Never more than two lines in a row.
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

const lessonOpts = (teacher, lessonId, from, to) => [
  { text: 'I am ready for the lesson.', if: [['hour', 'between', from, to]], do: [['lesson', lessonId], ['rel', teacher, 1]],
    end: true },
  { text: 'I am ready for the lesson.', if: [['not', ['hour', 'between', from, to]]], goto: 'closed' },
];

export default {
  laporte: tree('laporte', [S('laporte', '{name}. What do you need?')], 'Anything else?', [
    { text: 'You wanted to see me?', if: [['level', '>=', 8], ['flag', 'class_chosen'], once('spec_ceremony_done')],
      do: [['cutscene', 'spec_ceremony']], end: true },
    { text: 'I did my first steps!', if: [['quest', 'main_first_steps', 'done'], once('laporte_fs_chat')], goto: 'fs_done' },
    { text: 'Any advice?', if: [below(5)], goto: 'adv_low' },
    { text: 'Any advice?', if: [['level', '>=', 5], below(8)], goto: 'adv_mid' },
    { text: 'Any advice?', if: [['level', '>=', 8]], goto: 'adv_high' },
    { text: 'Tips for a warrior?', if: [['class', 'warrior']], goto: 'tip_w' },
    { text: 'Tips for a mage?', if: [['class', 'mage']], goto: 'tip_m' },
    { text: 'Tips for a rogue?', if: [['class', 'rogue']], goto: 'tip_r' },
    { text: 'Why are the other gates sealed?', goto: 'gates' },
    { text: 'Who was Malgrim?', if: [['flag', 'ambush_done']], goto: 'malgrim' },
    { text: 'Are you really a wizard?', goto: 'wizard' },
    { text: 'Can I ask you something personal?', if: [['rel', 'laporte', '>=', 2]], goto: 'personal' },
    { text: 'I beat Old Mossback!', if: [['flag', 'mossback_defeated'], once('laporte_mossback_chat')], goto: 'mossback' },
    bye('Thanks, Mr. Laporte.'),
  ], {
    fs_done: {
      say: [S('laporte', 'I heard. Slimes cleared, Tam happy, potions purchased. Good.', 'proud'),
        S('laporte', 'Here. Do not tell the other students.')],
      do: [['give', 'focus_scroll', 1], ['flag.set', 'laporte_fs_chat', true], ['rel', 'laporte', 1]],
      goto: 'more',
    },
    adv_low: {
      say: [S('laporte', 'Slimes first. Then sporecaps. Drink your potions. They are not decorations.')],
      goto: 'more',
    },
    adv_mid: {
      say: [S('laporte', 'Goblins have been taking library books. Madam Opal is upset. Whisper-upset.'),
        S('laporte', 'Also, take a lesson. Professor Quill misses you. She will not say it.')],
      goto: 'more',
    },
    adv_high: {
      say: [S('laporte', 'Something is snoring in the old grove. Ranger Tam has the details. Bring snacks.')],
      goto: 'more',
    },
    tip_w: { say: [S('laporte', 'Hit things. Then hit them again. Rage builds when they hit you back. Use it.')], goto: 'more' },
    tip_m: { say: [S('laporte', 'Keep your distance. Mana comes back. Health comes back slower.')], goto: 'more' },
    tip_r: { say: [S('laporte', 'Build combo, then spend it. Roll out of the red circles. Return Pip\'s things.')],
      goto: 'more' },
    gates: {
      say: [S('laporte', 'Dunes, Cove, Peaks, Aether. Sealed until next term.'), P('Why next term?'),
        S('laporte', 'Paperwork.')],
      goto: 'more',
    },
    malgrim: {
      say: [S('laporte', 'Former student. Failed Barriers 101. Twice.'),
        S('laporte', 'He has been sealing roads ever since. Out of spite, mostly.')],
      options: [
        { text: 'Will he come back?', goto: 'malgrim2' },
        { text: 'Okay.', goto: 'more' },
      ],
    },
    malgrim2: { say: [S('laporte', 'Probably. Do your homework. It helps more than you think.')], goto: 'more' },
    wizard: {
      say: [S('laporte', 'I am a headmaster. Wizard is more of a hobby.')],
      options: [
        { text: 'How strong are you, exactly?', goto: 'strong' },
        { text: 'Cool.', goto: 'more' },
      ],
    },
    strong: { say: [S('laporte', 'Strong enough to make you do your homework.'), S('laporte', 'Do your homework.')],
      do: [['rel', 'laporte', 1]], goto: 'more' },
    personal: {
      say: [P('Why do you always look a little tired?'), S('laporte', 'Grading.')],
      options: [
        { text: 'That is it?', goto: 'personal2' },
        { text: 'Fair.', goto: 'more' },
      ],
    },
    personal2: {
      say: [S('laporte', 'And worrying about students who fight giant rats with sticks.'), S('laporte', 'Mostly grading.')],
      goto: 'more',
    },
    mossback: {
      say: [S('laporte', 'I know. I was supervising. Well done, {name}.', 'proud'),
        S('laporte', 'Take the rest of the day off. That is not a request.', 'happy')],
      do: [['flag.set', 'laporte_mossback_chat', true], ['rel', 'laporte', 2], ['gold', 50]],
      goto: 'more',
    },
  }),

  // The classmate NPCs exist only before the class pick and for the one who becomes the rival.
  bram: tree('bram', [S('bram', 'HEY! My rival! My friend! My friend-rival! How are you?!', 'happy')],
    'What else, buddy?!', [
      { text: 'Want to spar?', goto: 'spar' },
      { text: 'Why are you so loud?', goto: 'loud' },
      { text: 'What is your story?', goto: 'story' },
      { text: 'I leveled up!', if: [['level', '>=', 5], once('bram_level_chat')], goto: 'level' },
      { text: 'Got anything to eat?', if: [['rel', 'bram', '>=', 2], once('gift_bram')], goto: 'gift' },
      bye('Later, Bram!'),
    ], {
      spar: {
        say: [S('bram', 'YES! ...Later. I just ate. You do not spar after lunch. Coach rule.'),
          S('bram', 'Go hit the training dummies in the yard! They love it! I asked!', 'happy')],
        do: [['rel', 'bram', 1]],
        goto: 'more',
      },
      loud: {
        say: [S('bram', 'I grew up next to a waterfall! You HAD to be loud!'), S('bram', '...I am still loud. Sorry. NOT SORRY!',
          'happy')],
        goto: 'more',
      },
      story: {
        say: [S('bram', 'My family are blacksmiths! I wanted to make swords. Then I wanted to USE swords!'),
          S('bram', 'Mr. Laporte said "use them on training dummies, please". So I do!')],
        do: [['rel', 'bram', 1]],
        goto: 'more',
      },
      level: {
        say: [S('bram', 'NO WAY! Me too! Well, not yet! But soon! Rivals push each other! PUSH!', 'happy')],
        do: [['flag.set', 'bram_level_chat', true]],
        goto: 'more',
      },
      gift: {
        say: [S('bram', 'Always! Here, my emergency bread! I have three emergencies a day!', 'happy')],
        do: [['give', 'bread', 3], ['flag.set', 'gift_bram', true]],
        goto: 'more',
      },
    }),

  elowen: tree('elowen', [S('elowen', 'Oh. It is you. My academic rival. I have been expecting you. For ten minutes.')],
    'Anything else? I am mid-chapter.', [
      { text: 'What are you reading?', goto: 'reading' },
      { text: 'Want to study together?', goto: 'study' },
      { text: 'Are those ears... pointy?', goto: 'ears' },
      { text: 'I beat Old Mossback!', if: [['flag', 'mossback_defeated'], once('elowen_mossback')], goto: 'mossback' },
      { text: 'Can I borrow your notes?', if: [['rel', 'elowen', '>=', 2], once('gift_elowen')], goto: 'gift' },
      bye('Bye, Elowen.'),
    ], {
      reading: {
        say: [S('elowen', '"Fractions of Fire, Volume Three". Volume Two had a twist. The denominator was the villain.')],
        do: [['rel', 'elowen', 1]],
        goto: 'more',
      },
      study: {
        say: [S('elowen', 'Together? ...Yes. Fine. Only because two minds are statistically better.'),
          S('elowen', 'I will bring snacks. That is not a hint that I am excited. I am not.', 'happy')],
        do: [['rel', 'elowen', 1]],
        goto: 'more',
      },
      ears: {
        say: [S('elowen', 'My grandmother was an elf. I got the ears and her strong opinions about fonts.')],
        goto: 'more',
      },
      mossback: {
        say: [S('elowen', 'You WHAT. ...I mean. Good. That is good. I was going to do it next week.', 'shocked')],
        do: [['flag.set', 'elowen_mossback', true]],
        goto: 'more',
      },
      gift: {
        say: [S('elowen', 'My notes. Color-coded. Return them unbent. I will know.', 'proud')],
        do: [['give', 'study_notes', 1], ['flag.set', 'gift_elowen', true]],
        goto: 'more',
      },
    }),

  pip: tree('pip', [S('pip', 'Psst. Hey. Rival. Did you drop this? No? Then it is mine.', 'happy')],
    'Anything else? Quick, before someone notices.', [
      { text: 'Is that my coin?', goto: 'coin' },
      { text: 'Where did you learn to sneak?', goto: 'story' },
      { text: 'Know any secrets?', goto: 'secret' },
      { text: 'Race you to the fountain!', if: [['rel', 'pip', '>=', 2], once('gift_pip')], goto: 'gift' },
      bye('Bye, Pip. Give my stuff back.'),
    ], {
      coin: {
        say: [S('pip', 'This? It was in your pocket. Which is a weird place for MY coin. Here, back.', 'happy')],
        do: [['gold', 3], ['rel', 'pip', 1]],
        goto: 'more',
      },
      story: {
        say: [S('pip', 'Seven older siblings. If you want the last cookie, you learn to be quick.'),
          S('pip', 'I always give things back! Mostly. Eventually. With interest, sometimes!')],
        do: [['rel', 'pip', 1]],
        goto: 'more',
      },
      secret: {
        say: [S('pip', 'There is a chest by the brook in the Whisperwood. Rune lock. I cannot do math. You can.'),
          S('pip', 'Oh, and Laporte keeps snacks in his desk. Top drawer. You did not hear it from me.')],
        goto: 'more',
      },
      gift: {
        say: [S('pip', 'You are ON. ...I already won. I left before I said it. Here, a prize for second place.',
          'happy')],
        do: [['give', 'smoke_pellet', 2], ['flag.set', 'gift_pip', true]],
        goto: 'more',
      },
    }),

  quill: tree('quill', [S('quill', 'Welcome to Arithmancy! Sit, sit. One, two... you make seven. Hm. Eight.')],
    'Questions? Questions are good. I count them.', [
      ...lessonOpts('quill', 'lesson_1', 8, 17),
      { text: 'What is Arithmancy?', goto: 'what' },
      { text: 'Why do you count everything?', goto: 'count' },
      { text: 'Any homework?', if: [['rel', 'quill', '>=', 3], once('gift_quill')], goto: 'gift' },
      bye('Thank you, Professor.'),
    ], {
      closed: { say: [S('quill', 'Class is between eight and five, dear. Come back then. I will count you in.')],
        goto: 'more' },
      what: {
        say: [S('quill', 'The magic of numbers! Every spell is a sum. Every potion, a ratio.'),
          S('quill', 'Get the numbers right and the magic behaves. Get them wrong and, well. Eyebrows.')],
        goto: 'more',
      },
      count: {
        say: [S('quill', 'Habit. You have blinked eleven times since you arrived. Twelve.', 'happy')],
        do: [['rel', 'quill', 1]],
        goto: 'more',
      },
      gift: {
        say: [S('quill', 'Homework? You ASKED for homework? Oh, I could cry. Take this scroll, star pupil.', 'proud')],
        do: [['give', 'focus_scroll', 1], ['flag.set', 'gift_quill', true]],
        goto: 'more',
      },
    }),

  rook: tree('rook', [S('rook', 'HA! A new face! Welcome to Runes and Ratios! Mind the scorch marks!', 'happy')],
    'What else? Speak up! I am a little deaf. Explosions.', [
      ...lessonOpts('rook', 'lesson_2', 9, 18),
      { text: 'How do runes work?', goto: 'runes' },
      { text: 'What happened to your eyebrows?', goto: 'brows' },
      { text: 'The rune gates in town...', if: [['flag', 'forest_open']], goto: 'gates' },
      bye('Thanks, Professor Rook!'),
    ], {
      closed: { say: [S('rook', 'Class runs nine to six! Come back then! HA!')], goto: 'more' },
      runes: {
        say: [S('rook', 'A rune is a ratio drawn in light! Keep the proportions right and it holds.'),
          S('rook', 'Get one side twice too long and BOOM. Educational boom.', 'happy')],
        do: [['rel', 'rook', 1]],
        goto: 'more',
      },
      brows: {
        say: [S('rook', 'Which time? HA! Sixty-three times. They always grow back. Stronger.', 'proud')],
        goto: 'more',
      },
      gates: {
        say: [S('rook', 'Seal-runes answer to a true answer! Solve the question and the seal unravels.'),
          S('rook', 'The grove gate in the forest is the same. Only one is unsealed this term, mind!')],
        goto: 'more',
      },
    }),

  marigold: tree('marigold', [S('marigold', 'Hello, hello! Infirmary! Are you bleeding? No? Wonderful. Sit anyway.', 'happy')],
    'Anything else, dear?', [
      { text: 'Can you patch me up?', do: [['heal'], ['fx', { type: 'heal', at: 'player' }]], goto: 'healed' },
      { text: 'How did I get here?', if: [['flag', 'class_chosen']], goto: 'how' },
      { text: 'What is the strangest injury you have seen?', goto: 'weird' },
      { text: 'Got anything for the road?', if: [once('gift_marigold')], goto: 'gift' },
      bye('Thanks, Nurse Marigold!'),
    ], {
      healed: { say: [S('marigold', 'There! Good as new. Better, maybe. I added a sticker.', 'happy')], goto: 'more' },
      how: {
        say: [S('marigold', 'Someone carried you in. Very gently. Tall fellow, striped sweater, sighing.'),
          S('marigold', 'He stayed until you were breathing nicely, then went back to grading.')],
        goto: 'more',
      },
      weird: {
        say: [S('marigold', 'A student who tried to hug a slime. Two weeks of minty hair.'),
          S('marigold', 'And Professor Rook. Every Tuesday. Just Rook, every Tuesday.')],
        do: [['rel', 'marigold', 1]],
        goto: 'more',
      },
      gift: {
        say: [S('marigold', 'Two potions and a lecture: drink them BEFORE you are at one hit point.')],
        do: [['give', 'potion_small', 2], ['flag.set', 'gift_marigold', true]],
        goto: 'more',
      },
    }),
};
