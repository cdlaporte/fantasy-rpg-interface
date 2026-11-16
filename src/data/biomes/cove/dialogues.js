// Gullwing Cove dialogues: Marlo (quest hub, main quest), Skipper (shell quest), Pearl (chowder and gulls), the lighthouse
// lamp, the lucky tide pool and the tiny Captain. Lines <= 110 characters; every quest starts from a real choice.
const S = (who, text, mood = 'calm', extra) => Object.assign({ who, mood, text }, extra || {});
const P = (text, mood = 'calm') => ({ who: 'player', mood, text });
const bye = (text = 'See you!') => ({ text, end: true });
const once = (flag) => ['not', ['flag', flag]];
const step = (q, n) => ['quest', q, 'step', n];

function tree(id, greet, more, options, nodes) {
  return {
    start: 'hub',
    nodes: Object.assign({ hub: { say: greet, options }, more: { say: [S(id, more)], options } }, nodes),
  };
}

const LH = 'cove_lighthouse_dark';
const SH = 'cove_lost_shells';
const GG = 'cove_gull_gold';

export default {
  marlo: tree('marlo', [S('marlo', 'Ahoy, student. Marlo, keeper of the Gullwing Light. Keeper of nothing, tonight. It is dark.', 'worried')],
    'Anything else? I have time. Nothing to light.', [
      { text: 'Why is the lighthouse dark?', if: [['quest', LH, 'none']], goto: 'dark' },
      { text: 'About the lighthouse...', if: [['quest', LH, 'active']], goto: 'active' },
      { text: 'It is done. The Captain is hat-sized.', if: [['quest', LH, 'done'], once('marlo_done_chat')], goto: 'done' },
      { text: 'Who is Captain Clawsworth?', goto: 'captain' },
      { text: 'What is the tide gate?', goto: 'gate' },
      { text: 'Tell me about the lighthouse.', goto: 'lore' },
      bye('Bye, Marlo.'),
    ], {
      dark: {
        say: [S('marlo', 'Two things went missing. The big brass lens, and my lamp oil. Pirate imps, I suspect. Rude little pirates.', 'annoyed'),
          S('marlo', 'Glow jelly burns brighter than oil, but it only comes from bubble jellies. Out in the coral shallows.', 'calm'),
          S('marlo', 'Three jars of jelly, and the lens from the imps. Then we relight her. Ships have been honking at nothing.', 'worried')],
        options: [
          { text: 'I will relight it.', do: [['quest.start', LH]], goto: 'yes' },
          { text: 'Imps? How scary are they?', goto: 'imps' },
          { text: 'Not yet.', goto: 'more' },
        ],
      },
      imps: {
        say: [S('marlo', 'They throw bottles. From far away. Stay close and they run. Stay far and they giggle.'),
          S('marlo', 'There is a Captain behind them, though. Bigger than a rowboat. Never met anyone who liked him.', 'worried')],
        options: [
          { text: 'I will relight it.', do: [['quest.start', LH]], goto: 'yes' },
          { text: 'Not yet.', goto: 'more' },
        ],
      },
      yes: {
        say: [S('marlo', 'Bless you, student. Jellies are in the coral shallows, east of the tide pools. Imps hold the camp past them.', 'happy'),
          S('marlo', 'Here. Two potions. And mind the beams: the jellies zap in straight lines.', 'happy')],
        do: [['give', 'potion_small', 2]],
        goto: 'more',
      },
      active: {
        say: [
          S('marlo', 'Three jars of glow jelly from the bubble jellies. Coral shallows. Wade right in.', 'calm', { if: [step(LH, 0)] }),
          S('marlo', 'Jelly in hand? Now the lens. The pirate imps keep it at their camp, southwest. Take it back.', 'calm', { if: [step(LH, 1)] }),
          S('marlo', 'Lens and jelly. Good. Walk out to the lighthouse on the point and climb up.', 'happy', { if: [step(LH, 2)] }),
          S('marlo', 'Up the stairs, fit the lens, pour the jelly, strike a match. The lamp room door is open.', 'calm', { if: [step(LH, 3)] }),
          S('marlo', 'Now the tide gate, on the sand causeway north of the point. Runes. They like clear heads.', 'calm', { if: [step(LH, 4)] }),
          S('marlo', 'Clawsworth waits on the sandbar. Watch the cannonballs. And his claw. And, honestly, the hat.', 'worried', { if: [step(LH, 5)] }),
          S('marlo', 'I saw the light from here! Come in, come in. Tell me everything. Slowly.', 'happy', { if: [step(LH, 6)] }),
        ],
        goto: 'more',
      },
      done: {
        say: [S('marlo', 'I saw her shine from my window. Like the first night. Thank you, student.', 'happy'),
          S('marlo', 'A hat-sized captain. I knew he was all hat. Have this. For the road.', 'happy')],
        do: [['flag.set', 'marlo_done_chat', true], ['give', 'speed_tonic', 2], ['rel', 'marlo', 1]],
        goto: 'more',
      },
      captain: {
        say: [S('marlo', 'Clawsworth. A crab the size of a boat, with a hat the size of a bigger boat.'),
          S('marlo', 'He keeps wrecks on his sandbar and hats on his head. Lighthouse spoils his business, he claims.', 'annoyed')],
        goto: 'more',
      },
      gate: {
        say: [S('marlo', 'The causeway north of the point has a rune seal. Old magic, tide magic. It asks a question.'),
          S('marlo', 'Get it right and the sand lets you through. Get it wrong and, well. It asks again. Patient, tides.')],
        goto: 'more',
      },
      lore: {
        say: [S('marlo', 'Built by my great-grandfather. Tall. Red and white. The gulls think it is a very big gull.'),
          P('A very big gull?'), S('marlo', 'Never corrected them. They are loyal that way.', 'happy')],
        do: [['rel', 'marlo', 1]],
        goto: 'more',
      },
    }),

  skipper: tree('skipper', [S('skipper', 'Shh! The fish are shy. ...Oh. Hi! I am Skipper! I am catching dinner!', 'happy')],
    'What else? I can talk and fish. Mostly talk.', [
      { text: 'Any luck?', goto: 'caught' },
      { text: 'You look worried.', if: [['quest', SH, 'none']], goto: 'shells' },
      { text: 'About your shells...', if: [['quest', SH, 'active']], goto: 'active' },
      { text: 'I have your shells.', if: [['quest', SH, 'done'], once('skipper_done_chat')], goto: 'done' },
      { text: 'What do you do with shells?', goto: 'conch' },
      { text: 'Any tips for fighting crabs?', goto: 'crabs' },
      { text: 'Tell me a secret.', if: [['rel', 'skipper', '>=', 2], once('gift_skipper')], goto: 'gift' },
      bye('Good luck, Skipper.'),
    ], {
      caught: {
        say: [S('skipper', 'Two boots and a hat! Not one fish! The hat was nice, though.', 'happy'), P('Whose hat?'),
          S('skipper', 'Dunno. It had a plume. It floated by and I was ready.', 'happy')],
        do: [['rel', 'skipper', 1]],
        goto: 'more',
      },
      shells: {
        say: [S('skipper', 'The snippy crabs took my shell collection! Five conchs! Now they carry them around like medals!', 'worried'),
          S('skipper', 'My lucky one is in a tide pool. A hermit crab moved in. I was too shy to ask for it back.', 'worried')],
        options: [
          { text: 'I will get them back.', do: [['quest.start', SH]], goto: 'yes' },
          { text: 'Crabs collect shells?', goto: 'crabfacts' },
          { text: 'Maybe later.', goto: 'more' },
        ],
      },
      crabfacts: {
        say: [S('skipper', 'All crabs do! Shells, pebbles, one bottle cap. They think it is fancy.'),
          S('skipper', 'They hit hard for something so small. Quick, too. Quicker when they are cross.')],
        options: [
          { text: 'I will get them back.', do: [['quest.start', SH]], goto: 'yes' },
          { text: 'Maybe later.', goto: 'more' },
        ],
      },
      yes: {
        say: [S('skipper', 'Yay! Hermit crabs respond to manners. Ask the one in the tide pool nicely. Pools are south of the village.', 'happy'),
          S('skipper', 'Then the snippy crabs. They scuttle in and out, so wait for them to come at you.', 'happy')],
        goto: 'more',
      },
      active: {
        say: [
          S('skipper', 'The lucky shell is in one of the tide pools. The swirliest one. Be polite!', 'calm', { if: [step(SH, 0)] }),
          S('skipper', 'Four more conchs, with the snippy crabs. They scuttle sideways, so hit them head on!', 'calm', { if: [step(SH, 1)] }),
          S('skipper', 'You have them all?! Come on over, come on over!', 'happy', { if: [step(SH, 2)] }),
        ],
        goto: 'more',
      },
      done: {
        say: [S('skipper', 'All five! The swirly one is back! You are the BEST!', 'happy'),
          S('skipper', 'Here. I found this in a net. It is a bomb. Or a very hard pudding. Be careful.', 'happy')],
        do: [['flag.set', 'skipper_done_chat', true], ['give', 'bubble_bomb', 1], ['rel', 'skipper', 1]],
        goto: 'more',
      },
      conch: {
        say: [S('skipper', 'Listen! You hold it to your ear and it tells you the weather. Today: boots.', 'happy')],
        do: [['rel', 'skipper', 1]],
        goto: 'more',
      },
      crabs: {
        say: [S('skipper', 'They scuttle at you in a line. Step sideways! Then whack them from behind.'),
          S('skipper', 'When they get cross they speed up. If one runs away, let it. They come back wiser.')],
        goto: 'more',
      },
      gift: {
        say: [S('skipper', 'Sit. Shh. ...Okay, secret. The lighthouse hums at night. It is lonely. Do not tell Marlo.', 'happy')],
        do: [['flag.set', 'gift_skipper', true], ['give', 'speed_tonic', 1]],
        goto: 'more',
      },
    }),

  pearl: tree('pearl', [S('pearl', 'Chowder, dear? Fresh today! Well. Fresh-ish. The fish said it was fine.', 'happy')],
    'Anything else, dear? I have all evening and a very large pot.', [
      { text: 'One bowl of chowder, please. (20 gold)', if: [['gold', '>=', 20]], do: [['gold', -20], ['give', 'sea_chowder', 1]], goto: 'bowl' },
      { text: 'One bowl of chowder, please. (20 gold)', if: [['not', ['gold', '>=', 20]]], goto: 'broke' },
      { text: 'Is something wrong?', if: [['quest', GG, 'none']], goto: 'gulls' },
      { text: 'About the gulls...', if: [['quest', GG, 'active']], goto: 'active' },
      { text: 'The gulls are gone.', if: [['quest', GG, 'done'], once('pearl_done_chat')], goto: 'done' },
      { text: 'What is in the chowder?', goto: 'recipe' },
      bye('Bye, Pearl.'),
    ], {
      bowl: {
        say: [S('pearl', 'There you go, dear. Hot. Careful. Do not hold it up. They are watching.', 'happy')],
        goto: 'more',
      },
      broke: {
        say: [S('pearl', 'Oh, no coins? A little sniff, then. Free. Breathe in. Good, isn\'t it?', 'happy')],
        do: [['rel', 'pearl', 1]],
        goto: 'more',
      },
      gulls: {
        say: [S('pearl', 'The gulls! They took my whole till. Not the chowder, mind. The COINS. They like shiny things.', 'annoyed'),
          S('pearl', 'Shoo six of them off, dear, and the coins will rattle loose. They hold a grudge. And a purse.')],
        options: [
          { text: 'I will shoo them.', do: [['quest.start', GG]], goto: 'yes' },
          { text: 'How do I fight gulls?', goto: 'gull_tips' },
          { text: 'Not now.', goto: 'more' },
        ],
      },
      gull_tips: {
        say: [S('pearl', 'They circle in threes. Then one dives in a straight line. Step out of the line, dear.'),
          S('pearl', 'And watch the splats. Not nice. Slows you down. Do not ask me how I know.', 'annoyed')],
        options: [
          { text: 'I will shoo them.', do: [['quest.start', GG]], goto: 'yes' },
          { text: 'Not now.', goto: 'more' },
        ],
      },
      yes: { say: [S('pearl', 'Bless you, dear. They hang around the dunes and the point. Loud ones. You will hear them.', 'happy')], goto: 'more' },
      active: { say: [S('pearl', 'Six gulls, dear. The loud ones near the dunes and the beach. They know I am cross.')], goto: 'more' },
      done: {
        say: [S('pearl', 'Quiet! Lovely! I can hear the pot bubble! Here, a bowl on the house. And a bonus.', 'happy')],
        do: [['flag.set', 'pearl_done_chat', true], ['give', 'sea_chowder', 1], ['gold', 15]],
        goto: 'more',
      },
      recipe: {
        say: [S('pearl', 'Potatoes, cream, clams, a bay leaf. And a secret ingredient.'), P('What is it?'),
          S('pearl', 'Patience, dear. It is patience. Also the odd shrimp.', 'happy')],
        do: [['rel', 'pearl', 1]],
        goto: 'more',
      },
    }),

  // interact on the lighthouse prop (zone cove): the lamp room
  cove_lamp: {
    start: 'hub',
    nodes: {
      hub: {
        say: [
          S('narrator', 'The lamp room is dark and cold. A brass fitting waits for its missing lens.', 'calm', { if: [['not', ['flag', 'lighthouse_lit']]] }),
          S('narrator', 'The great lamp turns slowly. A single gull salutes from the railing.', 'happy', { if: [['flag', 'lighthouse_lit']] }),
        ],
        options: [
          { text: 'Fit the lens, pour the jelly, light the lamp.', if: [step(LH, 3), ['hasItem', 'brass_lens', 1], ['hasItem', 'glow_jelly', 3]],
            hint: 'You need the brass lens and three jars of glow jelly. Marlo knows.',
            do: [['take', 'brass_lens', 1], ['take', 'glow_jelly', 3], ['flag.set', 'lighthouse_lit', true],
              ['fx', { type: 'pillar', at: 'player', r: 1.4, color: '#ffe680', dur: 1.6 }],
              ['fx', { type: 'sparkle', at: 'player', n: 40, r: 3, color: '#fff2a0' }], ['sfx', 'levelup']],
            goto: 'lit' },
          { text: 'Climb back down.', end: true },
        ],
      },
      lit: {
        say: [S('narrator', 'WHOOM. The lamp blazes. Far out at sea, a ship honks happily. (Ships honk. It is a thing.)', 'happy')],
        do: [['toast', 'The Gullwing Light is lit! The tide gate to the sandbar is next.', 'quest']],
        end: true,
      },
    },
  },

  // interact on the tide pool prop `tidepool_lucky`
  cove_lucky_pool: {
    start: 'hub',
    nodes: {
      hub: {
        say: [S('narrator', 'A tiny hermit crab peeks out of a swirly shell. A very lucky-looking shell.', 'calm')],
        options: [
          { text: 'Politely ask for the lucky shell.', if: [step(SH, 0)], hint: 'Skipper might know about this shell.', goto: 'ask' },
          { text: 'Poke it.', goto: 'poke' },
          { text: 'Leave it alone.', end: true },
        ],
      },
      ask: {
        say: [P('Excuse me. May I borrow that shell? Skipper misses it terribly.'),
          S('narrator', 'The crab considers. It bows (crabs do not bow) and scuttles into a nicer shell, a bottle cap.', 'happy')],
        do: [['give', 'conch_shell', 1], ['flag.set', 'cove_lucky_shell', true], ['sfx', 'pickup'],
          ['toast', 'You got Skipper\'s lucky conch shell!', 'loot']],
        end: true,
      },
      poke: {
        say: [S('narrator', 'It pinches you with great dignity. Nothing hurts but your pride.', 'annoyed')],
        end: true,
      },
    },
  },

  // the tiny Captain, after the fight
  clawsworth_tiny: tree('clawsworth_tiny', [S('clawsworth_tiny', 'Arr. Ye may admire the hat. From a respectful distance.', 'annoyed')],
    'Aye? Speak up. I be hat-sized, not deaf.', [
      { text: 'Are you okay?', goto: 'ok' },
      { text: 'Nice hat.', goto: 'hat' },
      bye('Goodbye, Captain.'),
    ], {
      ok: { say: [S('clawsworth_tiny', 'Aye. Smaller. Cozier. Me back be much better, to be honest.', 'calm')], goto: 'more' },
      hat: { say: [S('clawsworth_tiny', '...It is, is it not? Twelve a month, that was. Now just the one.', 'happy')], goto: 'more' },
    }),
};
