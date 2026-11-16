// Story dialogues used by cutscenes and story entities.
// Dialogue tree: {start, nodes: {id: {say: [{who, mood, text}], options: [{text, if, do, goto, end}], do, goto}}}.
// Options whose `if` fails are hidden (or shown disabled); exactly one option below is visible per class.
const S = (who, text, mood = 'calm') => ({ who, mood, text });

export default {
  // Played inside class_pick right after the classmates introduce themselves. The two classmates whose class the
  // player did NOT pick join as companions (their NPC entities poof); the third becomes the friendly rival.
  class_pick_team: {
    start: 'a',
    nodes: {
      a: {
        say: [S('laporte', 'You will not go alone. Two of these three will join your study group.')],
        options: [
          { text: 'Elowen, Pip: want to team up?', if: [['class', 'warrior']],
            do: [['fx', { type: 'poof', at: 'elowen' }], ['fx', { type: 'poof', at: 'pip' }],
              ['despawn', 'elowen'], ['despawn', 'pip'], ['companions', ['mage', 'rogue']]], goto: 'warrior' },
          { text: 'Bram, Pip: want to team up?', if: [['class', 'mage']],
            do: [['fx', { type: 'poof', at: 'bram' }], ['fx', { type: 'poof', at: 'pip' }],
              ['despawn', 'bram'], ['despawn', 'pip'], ['companions', ['warrior', 'rogue']]], goto: 'mage' },
          { text: 'Bram, Elowen: want to team up?', if: [['class', 'rogue']],
            do: [['fx', { type: 'poof', at: 'bram' }],
              ['fx', { type: 'poof', at: 'elowen' }], ['despawn', 'bram'], ['despawn', 'elowen'], ['companions', ['warrior', 'mage']]], goto: 'rogue' },
          { text: 'Can we all just be friends?', if: [['not', ['flag', 'class_chosen']]], goto: 'none' },
        ],
      },
      warrior: {
        say: [
          S('elowen', 'Acceptable. I will bring the books. You bring the... swinging.'),
          S('pip', 'Ooh, a sword friend! I call dibs on anything shiny we find.', 'happy'),
          S('bram', 'Wait, TWO warriors? Then you are my RIVAL! A friendly one! The friendliest!', 'happy'),
        ],
      },
      mage: {
        say: [
          S('bram', 'YES! I will stand in front! You stand behind me and do the sparkly stuff!', 'happy'),
          S('pip', 'And I will stand behind YOU. For safety. And snacks.', 'happy'),
          S('elowen', 'Another mage. Fine. Rivals, then. Academically. I will win.', 'proud'),
        ],
      },
      rogue: {
        say: [
          S('bram', 'A sneaky friend! Tell me when to hit things! I will hit them!', 'happy'),
          S('elowen', 'Please do not pick my pockets. They contain mostly bookmarks.'),
          S('pip', 'Two rogues? Ooh. Rivals! I will out-sneak you. You will not even see it coming.', 'happy'),
        ],
      },
      none: { say: [S('laporte', 'Pick a discipline first. Then friends. That is the order.')] },
    },
  },

  // The sleepy sapling left after Old Mossback is defeated (forest_boss_outro spawns it).
  mossback_sprout: {
    start: 'hub',
    nodes: {
      hub: {
        say: [S('mossback_sprout', 'Zzz... hrm? Oh. It is you. The... stomper.')],
        options: [
          { text: 'Are you okay?', goto: 'ok' },
          { text: 'Why were you so grumpy?', goto: 'why' },
          { text: 'Sorry about your nap.', if: [['not', ['flag', 'sprout_gift']]], goto: 'gift' },
          { text: 'Sleep well, Mossback.', end: true },
        ],
      },
      ok: { say: [S('mossback_sprout', 'Smaller. Lighter. Strangely... refreshed. Do not tell anyone.')], goto: 'hub2' },
      why: {
        say: [
          S('mossback_sprout', 'Someone... sealed my grove. Rune magic. Purple. Very... dramatic.'),
          S('mossback_sprout', 'Woke me up. I do not like... being woken up.'),
        ],
        do: [['flag.set', 'heard_purple_runes', true]],
        goto: 'hub2',
      },
      gift: {
        say: [S('mossback_sprout', 'Hrm. Polite. Rare. Take this... honey. Bees... live in my... hair.', 'happy')],
        do: [['give', 'honey_bun', 2], ['flag.set', 'sprout_gift', true]],
        goto: 'hub2',
      },
      hub2: {
        say: [S('mossback_sprout', 'Anything... else? I am... very... sleepy...')],
        options: [
          { text: 'Purple runes? That sounds like Malgrim.', if: [['flag', 'heard_purple_runes']], goto: 'malgrim' },
          { text: 'Goodnight.', end: true },
        ],
      },
      malgrim: {
        say: [S('mossback_sprout', 'Never... heard of him. Tell him... I said... hrrrm. Zzz.')],
      },
    },
  },
};
