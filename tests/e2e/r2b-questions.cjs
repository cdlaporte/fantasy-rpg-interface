// Round 2, package B: the Unit 4 question card in the real game (?test=1&debug=1&questions=stub).
// For every topic and difficulty: a problem is previewed (Questions.preview) and asked through a rune gate; the card
// is screenshotted in student mode and in teacher mode (answer + worked solution, Next). Then the answer flows:
// typed right answer ("Correct!"), typed wrong answer (solution, Continue, a fresh problem after the retry wait),
// multiple choice by number keys, keys typed into the box never reach the game, and a 1024x600 layout check.
// Run: node tests/e2e/r2b-questions.cjs        Screenshots: tests/e2e/out/r2b/
const path = require('node:path');
const assert = require('node:assert');
const H = require('./helpers.cjs');

const OUT = path.join(__dirname, 'out', 'r2b');
const TOPICS = ['ratio_simplest', 'extended_ratio', 'proportion', 'similar_missing_side', 'similarity_proof',
  'triangle_proportionality', 'parallel_proportional', 'angle_bisector'];
const SEED = Number(process.env.R2B_SEED || 11);

(async () => {
  const server = await H.startServer();
  const browser = await H.launch({ webgl: true });
  let failed = 0;
  const check = async (name, fn) => {
    try { await fn(); console.log('ok   ', name); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', e.stack || e.message); }
  };
  const open = async (page) => {
    const { errors } = await H.openGame(page, { base: server.url, renderer: '3d', params: { questions: 'stub' } });
    await page.evaluate(() => { const g = window.__game; g.scenario('town'); g.closeModal(); g.step(2); g.closeModal(); });
    return errors;
  };
  /** Preview a problem and ask it through a gate context; resolves when the card is on screen. */
  const ask = async (page, topic, d, seed, { context = 'gate', teacher = false } = {}) => {
    const q = await page.evaluate(({ topic, d, seed, context, teacher }) => {
      const g = window.__game.game;
      g.questions.teacher = teacher;
      const q = g.questions.preview(topic, d, seed);
      window.__res = null;
      g.gates.ask({ context, difficulty: d }).then((r) => { window.__res = r; });
      return q;
    }, { topic, d, seed, context, teacher });
    await page.waitForSelector(`.q4[data-qid="${q.id}"]`, { timeout: 10000 });
    await page.waitForTimeout(350);          // the modal's pop-in animation
    return q;
  };
  const cardShot = async (page, name) => {
    const box = await page.$('.question-box');
    await box.screenshot({ path: path.join(OUT, name + '.png') });
  };
  const result = (page) => page.waitForFunction(() => window.__res, null, { timeout: 8000 }).then((h) => h.jsonValue());

  try {
    await check('every topic x difficulty: student and teacher cards', async () => {
      const page = await H.newPage(browser);
      const errors = await open(page);
      for (const topic of TOPICS) {
        for (const d of [1, 2, 3]) {
          const q = await ask(page, topic, d, SEED + d);
          const info = await page.evaluate(() => {
            const c = document.querySelector('.q4');
            const r = document.querySelector('.question-box').getBoundingClientRect();
            const fig = c.querySelector('.q4-figure svg');
            const fs = (sel) => { const e = c.querySelector(sel); return e ? parseFloat(getComputedStyle(e).fontSize) : null; };
            return { ctx: c.querySelector('.q4-context').textContent, kicker: c.querySelector('.q4-kicker').textContent,
              focus: document.activeElement && document.activeElement.className, fig: !!fig,
              box: [r.left, r.top, r.right, r.bottom], vw: innerWidth, vh: innerHeight,
              prompt: fs('.q4-prompt'), input: fs('.q4-input'), choice: fs('.q4-choice') };
          });
          assert.strictEqual(info.ctx, 'Rune gate');
          assert.ok(info.kicker.includes('Day'), info.kicker);
          assert.ok(info.prompt >= 20, 'prompt font >= 20px');
          if (q.type === 'number') { assert.ok(/q4-input/.test(info.focus || ''), 'input focused: ' + info.focus); assert.ok(info.input >= 20); }
          else assert.ok(info.choice >= 20);
          assert.ok(info.box[0] >= 0 && info.box[1] >= 0 && info.box[2] <= info.vw && info.box[3] <= info.vh, 'card fits the screen ' + info.box);
          await cardShot(page, `${topic}-d${d}-student`);
          // finish this one by the debug hook, then the same problem in teacher mode
          await page.evaluate(() => window.__game.answerQuestion(true));
          await page.waitForFunction(() => !document.querySelector('.q4'));
          await ask(page, topic, d, SEED + d, { teacher: true });
          const t = await page.evaluate(() => ({
            ans: (document.querySelector('.q4-result .q4-ans') || {}).textContent,
            steps: document.querySelectorAll('.q4-steps li').length,
            right: !!document.querySelector('.q4-choice.is-right'),
            badge: !!document.querySelector('.q4-badge'),
          }));
          assert.strictEqual(t.ans, q.answerText);
          assert.strictEqual(t.steps, q.solution.length);
          assert.ok(t.badge, 'teacher badge');
          if (q.type === 'choice') assert.ok(t.right, 'right choice highlighted');
          await cardShot(page, `${topic}-d${d}-teacher`);
          await page.waitForTimeout(500);
          await page.keyboard.press('Enter');                      // Next
          assert.deepStrictEqual(await result(page), { correct: true, skipped: false }, 'teacher Next = correct');
          await page.waitForFunction(() => !document.querySelector('.q4'));
        }
      }
      await page.evaluate(() => { window.__game.game.questions.teacher = false; });
      assert.deepStrictEqual(errors.filter((e) => !/WebGL|GPU stall/i.test(e)), [], 'no console errors');
      await page.close();
    });

    await check('typed answers: right, wrong with the worked solution, then a fresh problem; keys stay in the box', async () => {
      const page = await H.newPage(browser);
      const errors = await open(page);
      const before = await page.evaluate(() => ({ hotbar: JSON.stringify(window.__game.game.inventory.hotbar), items: JSON.stringify(window.__game.game.inventory.items) }));
      // right answer typed as "x = <answer>"
      let q = await ask(page, 'angle_bisector', 2, 5);
      await page.keyboard.type(`x = ${q.answerPlain}`);
      await cardShot(page, 'flow-1-typed');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.q4-flash');
      await cardShot(page, 'flow-2-correct');
      assert.deepStrictEqual(await result(page), { correct: true, skipped: false });
      await page.waitForFunction(() => !document.querySelector('.q4'));

      // a fraction answer
      q = await ask(page, 'proportion', 3, 8);
      const frac = q.accept.fraction ? `${q.accept.fraction[0]}/${q.accept.fraction[1]}` : `${q.answerPlain * 2}/2`;
      await page.keyboard.type(frac);
      await page.keyboard.press('Enter');
      assert.deepStrictEqual(await result(page), { correct: true, skipped: false }, 'fraction accepted: ' + frac);
      await page.waitForFunction(() => !document.querySelector('.q4'));

      // nonsense is not counted; then a wrong number shows the solution
      q = await ask(page, 'triangle_proportionality', 2, 21);
      await page.keyboard.type('wasd1234');                       // movement / hotbar keys go into the box only
      const val = await page.$eval('.q4-input', (i) => i.value);
      assert.strictEqual(val, 'wasd1234');
      await page.keyboard.press('Enter');
      const warn = await page.$eval('.q4-help', (e) => e.textContent);
      assert.ok(/Type a number/.test(warn), warn);
      await page.fill('.q4-input', String(Number(q.answerPlain) + 7));
      await page.keyboard.press('Enter');
      await page.waitForSelector('.q4-result.bad');
      await page.keyboard.press('Enter');                         // too soon: ignored
      await page.waitForTimeout(80);
      assert.ok(await page.$('.q4-result.bad'), 'the solution stays up for a moment');
      await cardShot(page, 'flow-3-wrong-solution');
      const shown = await page.evaluate(() => document.querySelector('.q4-result').textContent);
      assert.ok(shown.includes(q.answerText), shown);
      // the retry (blocking gate) will ask this problem next
      const q2 = await page.evaluate(() => window.__game.game.questions.preview('parallel_proportional', 2, 99));
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');                         // Continue
      await page.waitForFunction(() => !document.querySelector('.q4'));
      const st = await page.evaluate(() => ({ res: window.__res, pending: !!window.__game.game.gates.pending() }));
      assert.strictEqual(st.res, null, 'a rune gate is not done after a wrong answer');
      assert.ok(st.pending);
      await page.evaluate(() => window.__game.step(200));         // the retry wait (game time)
      await page.waitForSelector(`.q4[data-qid="${q2.id}"]`);
      const stakes = await page.$eval('.q4-stakes', (e) => e.textContent);
      assert.ok(/new problem/i.test(stakes), stakes);
      await cardShot(page, 'flow-4-retry');
      await page.keyboard.type(q2.answerPlain);
      await page.keyboard.press('Enter');
      assert.deepStrictEqual(await result(page), { correct: true, skipped: false });
      await page.waitForFunction(() => !document.querySelector('.q4'));

      // multiple choice by number key, wrong then (chest: one try) no retry
      q = await ask(page, 'similarity_proof', 2, 4, { context: 'chest' });
      const wrongKey = String(((q.answerIndex + 1) % q.choices.length) + 1);
      await page.keyboard.press('Digit' + wrongKey);
      await page.waitForSelector('.q4-result.bad');
      await cardShot(page, 'flow-5-choice-wrong');
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      assert.deepStrictEqual(await result(page), { correct: false, skipped: false });
      q = await ask(page, 'ratio_simplest', 1, 4, { context: 'haggle' });
      await page.keyboard.press('Digit' + (q.answerIndex + 1));
      assert.deepStrictEqual(await result(page), { correct: true, skipped: false });
      await page.waitForFunction(() => !document.querySelector('.q4'));

      const after = await page.evaluate(() => ({ hotbar: JSON.stringify(window.__game.game.inventory.hotbar), items: JSON.stringify(window.__game.game.inventory.items) }));
      assert.deepStrictEqual(after, before, 'number keys never used a hotbar item');
      assert.deepStrictEqual(errors.filter((e) => !/WebGL|GPU stall/i.test(e)), [], 'no console errors');
      await page.close();
    });

    await check('1024x600: the largest cards fit, solution included', async () => {
      const page = await H.newPage(browser, { viewport: { width: 1024, height: 600 } });
      await open(page);
      for (const [topic, d, seed] of [['similar_missing_side', 3, 2], ['parallel_proportional', 3, 3], ['ratio_simplest', 3, 5]]) {
        const q = await ask(page, topic, d, seed);
        if (q.type === 'number') { await page.keyboard.type('0'); await page.keyboard.press('Enter'); }
        else await page.keyboard.press('Digit' + (((q.answerIndex + 1) % q.choices.length) + 1));
        await page.waitForSelector('.q4-result.bad');
        await page.waitForTimeout(100);
        const fit = await page.evaluate(() => {
          const r = document.querySelector('.question-box').getBoundingClientRect();
          const b = document.querySelector('.q4-continue').getBoundingClientRect();
          return { box: [r.left, r.top, r.right, r.bottom], btnVisible: b.bottom <= innerHeight && b.top >= 0, vw: innerWidth, vh: innerHeight };
        });
        assert.ok(fit.box[0] >= 0 && fit.box[3] <= fit.vh && fit.box[2] <= fit.vw, 'fits ' + fit.box);
        await page.screenshot({ path: path.join(OUT, `small-${topic}-d${d}.png`) });
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => !document.querySelector('.q4-result'));
        await page.evaluate(() => { const g = window.__game; g.step(200); });
        await page.waitForSelector('.q4');
        await page.evaluate(() => window.__game.answerQuestion(true));
        await page.waitForFunction(() => !document.querySelector('.q4'));
      }
      await page.close();
    });
  } finally {
    await browser.close();
    server.stop();
  }
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
