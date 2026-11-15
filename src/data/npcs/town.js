// Flinkerton townsfolk (CONTRACTS 11 npc): {id, name, look, zone, team, routine, dialogue, shop, onAttacked, stats}.
// Added fields: personality (one line, for writers), barks (speech bubbles near the player), tags, attacks (guards).
// Routine hours never wrap past midnight: a night entry is split into [21, 24] + [0, 7].
import { NPC_LOOKS } from '../looks.js';

const r = (from, to, at, d, zone) => (zone ? { from, to, at, do: d, zone } : { from, to, at, do: d });
const folk = { hp: 60, power: 0, defense: 0, speed: 2.4 };
const guardStats = { hp: 220, power: 9, defense: 4, speed: 3.6 };
const spear = [{ id: 'spear_jab', use: 'melee_arc', arc: 70, range: 1.4, dmg: 1, cd: 1.1, windup: 0.4, telegraph: 'cone', weight: 1 }];

const npc = (o) => Object.assign({ team: 'town', zone: 'town', shop: null, onAttacked: 'flee', stats: folk, tags: [] }, o);

export default {
  mira: npc({
    id: 'mira', name: 'Granny Mira', look: NPC_LOOKS.mira, dialogue: 'mira', shop: 'potions', onAttacked: 'retaliate',
    personality: 'Sweet, sharp-eyed potion brewer who calls everyone "dearie" and once out-dueled a dragon.',
    routine: [r(0, 7, 'home_1', 'sleep'), r(7, 18, 'potion_door', 'shopkeep'), r(18, 21, 'cafe_seat_1', 'sit'),
      r(21, 24, 'home_1', 'sleep')],
    barks: ['Potions! Fresh potions!', 'Mind the cauldron, it bites.', 'Ooh, you look peaky, dearie.'],
  }),
  fenwick: npc({
    id: 'fenwick', name: 'Fenwick Threadwell', look: NPC_LOOKS.fenwick, dialogue: 'fenwick', shop: 'outfitter',
    personality: 'Dramatic tailor; every outfit is "a statement", every sock "a journey".',
    routine: [r(0, 8, 'home_2', 'sleep'), r(8, 18, 'outfitter_door', 'shopkeep'), r(18, 22, 'square', 'wander'),
      r(22, 24, 'home_2', 'sleep')],
    barks: ['Darling, that hood. We need to talk.', 'Sparkle is a lifestyle!', 'New capes! Swooshier than ever!'],
  }),
  gus: npc({
    id: 'gus', name: 'Big Gus', look: NPC_LOOKS.gus, dialogue: 'gus', shop: 'general', onAttacked: 'retaliate',
    personality: 'Huge, gentle shopkeeper who sells "odds", "ends", and nothing in between.',
    routine: [r(0, 7, 'home_3', 'sleep'), r(7, 19, 'general_door', 'shopkeep'), r(19, 22, 'cafe_seat_2', 'sit'),
      r(22, 24, 'home_3', 'sleep')],
    barks: ['Odds! Ends! Get yer odds and ends!', 'Bombs are half off. Not the bombs. The price.', 'Hm. Hm hm.'],
  }),
  rosa: npc({
    id: 'rosa', name: 'Rosa Bunwright', look: NPC_LOOKS.rosa, dialogue: 'rosa', shop: 'bakery',
    personality: 'Up before the sun, cheerful and flour-covered; bakes her feelings.',
    routine: [r(0, 5, 'home_4', 'sleep'), r(5, 16, 'bakery_door', 'shopkeep'), r(16, 20, 'park', 'wander'),
      r(20, 24, 'home_4', 'sleep')],
    barks: ['Bread! Still warm!', 'Who ate the sample tray? TILLY.', 'Rise and shine!'],
  }),
  tilly: npc({
    id: 'tilly', name: 'Tilly', look: NPC_LOOKS.tilly, dialogue: 'tilly',
    personality: 'Rosa\'s kid. Nine years old, extremely sure she will be Headmaster someday.',
    routine: [r(0, 8, 'home_4', 'sleep'), r(8, 12, 'bakery_door', 'wander'), r(12, 17, 'park', 'wander'),
      r(17, 20, 'square', 'wander'), r(20, 24, 'home_4', 'sleep')],
    barks: ['Are you a REAL student?', 'I can count to a thousand. Backwards.', 'Mom says no sword fights.'],
  }),
  juniper: npc({
    id: 'juniper', name: 'Juniper', look: NPC_LOOKS.juniper, dialogue: 'juniper',
    personality: 'Runs The Cozy Cup cafe; invents strange drinks; relentlessly upbeat.',
    routine: [r(0, 7, 'home_5', 'sleep'), r(7, 20, 'cafe_door', 'shopkeep'), r(20, 22, 'cafe_seat_3', 'sit'),
      r(22, 24, 'home_5', 'sleep')],
    barks: ['Try the cinnamon fog!', 'Today\'s special: hot cocoa. Tomorrow: also hot cocoa.', 'Hi hi hi!'],
  }),
  opal: npc({
    id: 'opal', name: 'Madam Opal', look: NPC_LOOKS.opal, dialogue: 'opal',
    personality: 'Town librarian; whispers everything, even shouting; knows every book by smell.',
    routine: [r(0, 8, 'home_6', 'sleep'), r(8, 19, 'library_door', 'idle'), r(19, 22, 'bench_1', 'sit'),
      r(22, 24, 'home_6', 'sleep')],
    barks: ['Shhh.', 'Books are due back. All of them. Always.', 'A goblin with a library card. Imagine.'],
  }),
  hilda: npc({
    id: 'hilda', name: 'Guard Hilda', look: NPC_LOOKS.guard_a, dialogue: 'hilda', onAttacked: 'guard',
    tags: ['guard'], stats: guardStats, attacks: spear,
    personality: 'By-the-book captain of the guard. The book is short and mostly says "no running".',
    routine: [r(0, 6, 'home_7', 'sleep'), r(6, 18, 'guard_post_1', 'patrol'), r(18, 22, 'square', 'patrol'),
      r(22, 24, 'home_7', 'sleep')],
    barks: ['No running in the square.', 'Halt! Oh, you were just walking. Carry on.', 'All quiet. Suspiciously.'],
  }),
  bo: npc({
    id: 'bo', name: 'Guard Bo', look: NPC_LOOKS.guard_b, dialogue: 'bo', onAttacked: 'guard',
    tags: ['guard'], stats: guardStats, attacks: spear,
    personality: 'Enormous, soft-spoken night-shift guard who knits during quiet hours.',
    routine: [r(0, 8, 'guard_post_2', 'patrol'), r(8, 14, 'home_7', 'sleep'), r(14, 24, 'guard_post_2', 'patrol')],
    barks: ['Evening.', 'Knit one, purl two... oh, hello.', 'Stay safe out there.'],
  }),
  ines: npc({
    id: 'ines', name: 'Guard Ines', look: NPC_LOOKS.guard_c, dialogue: 'ines', onAttacked: 'guard',
    tags: ['guard'], stats: guardStats, attacks: spear,
    personality: 'Young, eager recruit at the forest gate who desperately wants something to happen.',
    routine: [r(0, 7, 'home_8', 'sleep'), r(7, 19, 'guard_post_3', 'patrol'), r(19, 22, 'cafe_door', 'wander'),
      r(22, 24, 'home_8', 'sleep')],
    barks: ['Anything exciting out there? Please?', 'I am guarding! Very hard!', 'The forest is THAT way.'],
  }),
  pumble: npc({
    id: 'pumble', name: 'Mayor Pumbleton', look: NPC_LOOKS.pumble, dialogue: 'pumble',
    personality: 'Pompous but lovable mayor who wears a tiny ceremonial crown he was never given.',
    routine: [r(0, 8, 'home_8', 'sleep'), r(8, 17, 'square', 'idle'), r(17, 21, 'cafe_seat_4', 'sit'),
      r(21, 24, 'home_8', 'sleep')],
    barks: ['Citizens! A fine day for civic pride!', 'Vote Pumbleton! Again! Forever!', 'Ahem. AHEM.'],
  }),
  sol: npc({
    id: 'sol', name: 'Old Sol', look: NPC_LOOKS.sol, dialogue: 'sol',
    personality: 'Retired adventurer turned gardener; talks to flowers; flowers seem to listen.',
    routine: [r(0, 6, 'home_3', 'sleep'), r(6, 12, 'park', 'wander'), r(12, 15, 'stall_3', 'idle'),
      r(15, 18, 'park', 'wander'), r(18, 21, 'bench_2', 'sit'), r(21, 24, 'home_3', 'sleep')],
    barks: ['Easy there, petunias.', 'Weeds are just flowers with ambition.', 'Lovely day for dirt.'],
  }),
  lyle: npc({
    id: 'lyle', name: 'Lyle the Bard', look: NPC_LOOKS.lyle, dialogue: 'lyle',
    personality: 'Bard with enormous confidence and three songs, all about himself.',
    routine: [r(0, 10, 'home_2', 'sleep'), r(10, 14, 'stall_1', 'idle'), r(14, 18, 'square', 'wander'),
      r(18, 23, 'cafe_door', 'wander'), r(23, 24, 'home_2', 'sleep')],
    barks: ['La la LAAA!', 'Requests? No? I will play my own.', 'This next one is about me.'],
  }),
  nia: npc({
    id: 'nia', name: 'Nia', look: NPC_LOOKS.nia, dialogue: 'nia',
    personality: 'Second-year student, top of the class, secretly terrified of pigeons.',
    routine: [r(0, 7, 'home_5', 'sleep'), r(7, 14, 'library_nook', 'sit', 'academy'), r(14, 18, 'library_door', 'idle'),
      r(18, 21, 'bench_3', 'sit'), r(21, 24, 'home_5', 'sleep')],
    barks: ['Pop quiz! Just kidding.', 'Have you done the reading?', 'Is that a pigeon? Where?'],
  }),
  ravi: npc({
    id: 'ravi', name: 'Ravi', look: NPC_LOOKS.ravi, dialogue: 'ravi',
    personality: 'Second-year who is great at spells, terrible at aiming them; very good sport about it.',
    routine: [r(0, 7, 'home_6', 'sleep'), r(7, 14, 'yard', 'wander', 'academy'), r(14, 19, 'stall_2', 'idle'),
      r(19, 21, 'bench_4', 'sit'), r(21, 24, 'home_6', 'sleep')],
    barks: ['Duck! Kidding. Mostly.', 'My eyebrows grew back! Ask me how.', 'Sparks are just shy fireworks.'],
  }),
};
