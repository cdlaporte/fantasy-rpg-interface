import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, flatZone, LOOK, seconds, flush, collect } from './story_fixtures.test.mjs';
import { DIR } from '../../src/contracts.js';

const fx = {
  zones: { town: flatZone('town', { start: [5, 5], baker_spot: [8, 5], laporte_spot: [12, 12] }) },
  npcs: {
    baker: { id: 'baker', name: 'Bun the Baker', look: LOOK, zone: 'town', at: 'baker_spot', dialogue: 'baker_talk',
      routine: [{ from: 0, to: 24, at: 'baker_spot', do: 'wander', r: 2 }] },
    laporte: { id: 'laporte', name: 'Mr. Laporte', look: Object.assign({}, LOOK, { hero: 'laporte' }), zone: 'academy' },
  },
  dialogues: {
    baker_talk: {
      start: [{ if: ['flag', 'met_baker'], to: 'again' }, 'hello'],
      nodes: {
        hello: {
          do: [['flag.set', 'met_baker']],
          say: [{ text: 'Fresh bread, {name}!' }, { who: 'player', text: 'Smells great.', mood: 'happy' }],
          options: [
            { text: 'Buy a loaf', do: [['flag.set', 'bought']], goto: 'thanks' },
            { text: 'Secret menu', if: ['flag', 'vip'], goto: 'secret', hint: 'Bakers only share with friends.' },
            { text: 'Hidden', if: ['flag', 'never'], goto: 'secret' },
            { text: 'Bye', end: true },
          ],
        },
        thanks: { say: { who: 'laporte', text: 'Carbs. Good choice.' }, goto: 'last' },
        last: { say: ['See you.'], after: [['flag.set', 'after_ran']] },
        again: { say: 'Back again?', options: [{ text: 'Ask about Laporte', do: [['dialogue', 'nested']], goto: 'last' }] },
        secret: { say: 'Cinnamon.' },
      },
    },
    nested: { start: 'a', nodes: { a: { say: [{ who: 'laporte', text: 'I heard that.' }] } } },
  },
};

test('dialogue: branching, start-goto, do, conditions, hints, name substitution, speakers', async () => {
  const g = makeGame(fx, { zone: 'town' });
  const baker = g.ops.resolveWho('baker');
  assert.ok(baker, 'baker spawned by npc.populate');
  const lines = collect(g, 'dialogue:line');
  const p = g.dialogue.open('baker_talk', { npc: baker });
  assert.equal(g.modal.type, 'dialogue');
  assert.equal(g.flags.met_baker, true, 'node do ran on entry');
  assert.equal(g.modal.text, 'Fresh bread, Robin!');
  assert.equal(g.modal.speaker, 'Bun the Baker');
  assert.equal(g.modal.speakerLook, baker.look);
  assert.equal(g.modal.portrait, null);
  assert.equal(g.modal.options, null, 'options only on the last line');
  assert.ok(g.freeze.has('modal'));
  // NPC faces the player and stops its routine
  assert.equal(baker.data.talking, 1);
  g.commands.dialogueAdvance();
  assert.equal(g.modal.speaker, 'Robin');
  assert.equal(g.modal.mood, 'happy');
  assert.equal(g.modal.speakerLook, g.player.look);
  assert.deepEqual(g.modal.options.map((o) => [o.text, o.disabled, o.hint]), [
    ['Buy a loaf', false, null], ['Secret menu', true, 'Bakers only share with friends.'], ['Bye', false, null]]);
  assert.equal(g.commands.dialogueAdvance(), false, 'advance does nothing while options show');
  assert.equal(g.commands.dialogueChoose(1), false, 'disabled option cannot be chosen');
  g.commands.dialogueChoose(0);
  assert.equal(g.flags.bought, true);
  assert.equal(g.modal.speaker, 'Mr. Laporte');
  assert.equal(g.modal.portrait, 'laporte');
  g.commands.dialogueAdvance();
  assert.equal(g.modal.text, 'See you.');
  assert.equal(g.modal.speaker, 'Bun the Baker', 'default speaker is the npc');
  g.commands.dialogueAdvance();
  assert.equal(g.flags.after_ran, true);
  assert.equal(g.modal, null);
  assert.equal(p.isDone(), true);
  await p;
  assert.equal(baker.data.talking, undefined);
  assert.deepEqual(lines.map((l) => l.text), ['Fresh bread, Robin!', 'Smells great.', 'Carbs. Good choice.', 'See you.']);
  // second time: start goto picks 'again'; nested dialogue inside an option's do, then back
  const p2 = g.dialogue.open('baker_talk', { npc: baker });
  assert.equal(g.modal.text, 'Back again?');
  g.commands.dialogueChoose(0);
  assert.equal(g.modal.text, 'I heard that.', 'nested dialogue takes over the modal');
  g.commands.dialogueAdvance();
  await flush();
  assert.equal(g.modal.text, 'See you.', 'outer continues with goto after the nested one closes');
  g.commands.dialogueAdvance();
  await p2;
  assert.equal(g.modal, null);
});

test('dialogue: the NPC interact op faces the npc to the player; Escape closes; queued opens; vip option enabled', async () => {
  const g = makeGame(fx, { zone: 'town' });
  const baker = g.ops.resolveWho('baker');
  baker.dir = DIR.UP;
  g.player.x = baker.x - 2; g.player.y = baker.y;
  assert.deepEqual(baker.interact.do, [['dialogue', 'baker_talk']]);
  const closes = collect(g, 'dialogue:close');
  const p = g.ops.run(baker.interact.do, { self: baker });
  assert.equal(baker.dir, DIR.LEFT, 'faces the player');
  assert.equal(g.player.dir, DIR.RIGHT);
  const p2 = g.dialogue.open('nested');
  assert.equal(g.modal.text, 'Fresh bread, Robin!', 'second open waits in the queue');
  g.closeModal();          // Escape
  seconds(g, 1 / 60);
  await flush();
  assert.equal(closes.length, 1);
  assert.equal(closes[0].npc, baker);
  assert.equal(g.modal.text, 'I heard that.', 'queued dialogue opens next');
  g.commands.dialogueAdvance();
  await p; await p2;
  g.setFlag('vip', true);
  g.setFlag('met_baker', false);
  g.dialogue.open('baker_talk', { npc: baker });
  g.commands.dialogueAdvance();
  assert.equal(g.modal.options[1].disabled, false);
  g.commands.dialogueChoose(1);
  assert.equal(g.modal.text, 'Cinnamon.');
  g.commands.dialogueAdvance();
  assert.equal(g.modal, null);
});

test('dialogue: unknown dialogue / node warn and never throw; another modal suspends the conversation', async () => {
  const g = makeGame(fx, { zone: 'town' });
  const warns = collect(g, 'story:warn');
  await g.dialogue.open('missing');
  assert.equal(warns.length, 1);
  const p = g.dialogue.open({ id: 'inl', start: 'a', nodes: { a: { say: ['One', 'Two'], goto: 'nowhere' } } });
  g.openModal({ type: 'pause' });             // something else takes the screen
  seconds(g, 0.1);
  assert.equal(g.modal.type, 'pause');
  g.closeModal();
  seconds(g, 1 / 60);
  assert.equal(g.modal.type, 'dialogue', 'conversation comes back');
  assert.equal(g.modal.text, 'One');
  g.commands.dialogueAdvance();
  g.commands.dialogueAdvance();
  await p;
  assert.ok(warns.some((w) => /unknown node "nowhere"/.test(w.msg)));
  assert.equal(g.modal, null);
});
