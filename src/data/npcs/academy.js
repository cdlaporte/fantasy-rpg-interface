// Flinkerton Academy: the headmaster, the classmates, and staff.
// Added field `hideIf: [conds]`: while all conditions pass the NPC is not populated (the classmate who became a
// companion). Classmates are companions for every class except their own (see dialogues/story.js class_pick_team).
import { NPC_LOOKS, LAPORTE_LOOK } from '../looks.js';

const r = (from, to, at, d, zone) => (zone ? { from, to, at, do: d, zone } : { from, to, at, do: d });
const folk = { hp: 60, power: 0, defense: 0, speed: 2.4 };
const npc = (o) => Object.assign({ team: 'town', zone: 'academy', shop: null, onAttacked: 'flee', stats: folk, tags: [] }, o);

export default {
  laporte: npc({
    id: 'laporte', name: 'Mr. Laporte', look: LAPORTE_LOOK, dialogue: 'laporte', portrait: 'laporte',
    onAttacked: 'guard', tags: ['headmaster'], stats: { hp: 9999, power: 99, defense: 99, speed: 3 },
    personality: 'Absurdly powerful headmaster; calm, deadpan, slightly tired; kind underneath.',
    routine: [r(0, 7, 'headmaster', 'sleep'), r(7, 17, 'headmaster', 'idle'), r(17, 20, 'hall', 'wander'),
      r(20, 24, 'headmaster', 'idle')],
    barks: ['Walk, please.', 'Hydrate.', 'Good. Keep going.', 'I saw that. Nice.'],
  }),
  bram: npc({
    id: 'bram', name: 'Bram', look: NPC_LOOKS.bram, dialogue: 'bram', classId: 'warrior',
    hideIf: [['flag', 'class_chosen'], ['not', ['class', 'warrior']]],
    personality: 'Warrior classmate. LOUD, cheerful, hugs too hard, believes every problem is a sword problem.',
    routine: [r(0, 7, 'classmate_1', 'sleep'), r(7, 15, 'classmate_1', 'idle'), r(15, 20, 'yard', 'wander'),
      r(20, 24, 'classmate_1', 'sleep')],
    barks: ['HI!', 'Spar? SPAR!', 'I did forty push-ups! Then I lay down!'],
  }),
  elowen: npc({
    id: 'elowen', name: 'Elowen', look: NPC_LOOKS.elowen, dialogue: 'elowen', classId: 'mage',
    hideIf: [['flag', 'class_chosen'], ['not', ['class', 'mage']]],
    personality: 'Mage classmate. Bookish, bone-dry wit, secretly delighted to have friends.',
    routine: [r(0, 7, 'classmate_2', 'sleep'), r(7, 15, 'classmate_2', 'idle'), r(15, 21, 'library_nook', 'sit'),
      r(21, 24, 'classmate_2', 'sleep')],
    barks: ['Fascinating.', 'Page 412 covers this.', 'Please do not touch the glowing ones.'],
  }),
  pip: npc({
    id: 'pip', name: 'Pip', look: NPC_LOOKS.pip, dialogue: 'pip', classId: 'rogue',
    hideIf: [['flag', 'class_chosen'], ['not', ['class', 'rogue']]],
    personality: 'Rogue classmate. Small, quick, mischievous; "borrows" things and always gives them back.',
    routine: [r(0, 7, 'classmate_3', 'sleep'), r(7, 15, 'classmate_3', 'idle'), r(15, 20, 'square', 'wander', 'town'),
      r(20, 24, 'classmate_3', 'sleep')],
    barks: ['Psst.', 'Nothing in my pockets! ...Yours, though?', 'Race you!'],
  }),
  quill: npc({
    id: 'quill', name: 'Professor Quill', look: NPC_LOOKS.quill, dialogue: 'quill', lesson: 'lesson_1',
    personality: 'Arithmancy teacher. Brisk, warm, counts everything, including your blinks.',
    routine: [r(0, 7, 'library_nook', 'sleep'), r(7, 17, 'teach_1', 'idle'), r(17, 21, 'hall', 'wander'),
      r(21, 24, 'library_nook', 'sleep')],
    barks: ['Seven! Seven students. No, eight.', 'Numbers never lie. People do.', 'Sit up straight, please.'],
  }),
  rook: npc({
    id: 'rook', name: 'Professor Rook', look: NPC_LOOKS.rook, dialogue: 'rook', lesson: 'lesson_2',
    personality: 'Runecraft teacher. Booming laugh, singed eyebrows, loves a good ratio.',
    routine: [r(0, 8, 'yard', 'sleep'), r(8, 18, 'teach_2', 'idle'), r(18, 22, 'yard', 'wander'), r(22, 24, 'yard', 'sleep')],
    barks: ['HA! Proportion!', 'Runes are just math wearing a hat.', 'Who smells smoke? Oh. Me.'],
  }),
  marigold: npc({
    id: 'marigold', name: 'Nurse Marigold', look: NPC_LOOKS.marigold, dialogue: 'marigold',
    personality: 'Infirmary nurse. Unflappable, cheerful, has seen every possible slime-related injury.',
    routine: [r(0, 6, 'infirmary_bed', 'sleep'), r(6, 22, 'infirmary', 'idle'), r(22, 24, 'infirmary_bed', 'sleep')],
    barks: ['Bandages are free. Lessons are not.', 'You again? Lovely.', 'Drink water!'],
  }),
};
