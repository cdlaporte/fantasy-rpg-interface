// Round 3 package G: quest log (Q, pause menu, panel click, tabs, tracking) and the 5 x 2 look picker.
// Screenshots: tests/e2e/out/r3g-*.png. Run: node tests/e2e/r3g-questlog.cjs
const path = require('node:path');
const assert = require('node:assert/strict');
const H = require('./helpers.cjs');

const OUT = path.join(__dirname, 'out');
const VPS = [{ width: 1366, height: 657 }, { width: 1024, height: 600 }];

(async () => {
  const srv = await H.startServer();
  const browser = await H.launch({ webgl: false });
  let failed = 0;
  const check = async (name, fn) => {
    try { await fn(); console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n', e.stack || e); }
  };
  const modalType = (page) => page.evaluate(() => (window.__game.game.modal ? window.__game.game.modal.type : null));
  const tracked = (page) => page.evaluate(() => window.__game.game.quests.tracked);
  const panelQuest = (page) => page.$eval('.pnl-quest .quest-name', (n) => n.textContent).catch(() => '');
  const settle = (page) => page.waitForTimeout(250);

  async function setup(vp) {
    const page = await H.newPage(browser, { viewport: vp });
    await H.openGame(page, { base: srv.url, renderer: '2d' });
    await page.evaluate(() => window.__game.scenario('forest'));
    await page.evaluate(() => {
      const g = window.__game.game;
      g.ops.run([['quest.start', 'town_pie_delivery']]);
      g.ops.run([['quest.start', 'town_bard_ballad']]);
      g.ops.run([['quest.start', 'main_first_steps']]);
      g.ops.run([['quest.complete', 'main_first_steps']]);
      window.__game.step(8, {});
    });
    await page.waitForTimeout(300);
    return page;
  }

  try {
    await check('empty state, then Q opens the log, tabs, tracking, Q closes (both sizes)', async () => {
      for (const vp of VPS) {
        const page = await H.newPage(browser, { viewport: vp });
        const errors = H.collectErrors(page);
        await H.openGame(page, { base: srv.url, renderer: '2d' });
        await page.evaluate(() => window.__game.scenario('forest'));
        await page.evaluate(() => { const g = window.__game.game; g.quests._reset(); window.__game.step(4, {}); });
        await page.keyboard.press('KeyQ');
        await settle(page);
        assert.equal(await modalType(page), 'questLog');
        assert.match(await page.$eval('.qlog-empty', (n) => n.textContent), /No quests yet/);
        await H.shot(page, path.join(OUT, `r3g-empty-${vp.width}.png`));
        await page.keyboard.press('KeyQ');
        assert.equal(await modalType(page), null, 'Q closes it');
        await page.evaluate(() => window.__game.scenario('forest'));
        await page.evaluate(() => {
          const g = window.__game.game;
          g.ops.run([['quest.start', 'town_pie_delivery']]);
          g.ops.run([['quest.start', 'town_bard_ballad']]);
          g.ops.run([['quest.start', 'main_first_steps']]);
          g.ops.run([['quest.complete', 'main_first_steps']]);
          window.__game.step(8, {});
        });
        await page.waitForTimeout(300);
        const before = await tracked(page);
        await page.keyboard.press('KeyQ');
        await settle(page);
        assert.equal(await modalType(page), 'questLog');
        assert.equal(await page.evaluate(() => window.__game.game.freeze.has('modal')), true, 'game frozen');
        const rows = await page.$$eval('.qlog-row', (n) => n.map((r) => r.querySelector('.qlog-rname').textContent));
        assert.equal(rows.length, 2, 'two active quests: ' + rows);
        assert.ok(await page.$('.qlog-row.tracked'), 'the tracked quest is marked');
        assert.ok(await page.$('.qlog-step.current'), 'a current step is highlighted');
        await H.shot(page, path.join(OUT, `r3g-active-${vp.width}.png`));
        // select the other quest and track it with Enter
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await settle(page);
        const after = await tracked(page);
        assert.notEqual(after, before, 'Enter tracked the other quest');
        assert.equal(await page.$$eval('.qlog-row.tracked', (n) => n.length), 1);
        assert.match(await page.$eval('.qlog-track', (n) => n.textContent), /TRACKED/);
        await H.shot(page, path.join(OUT, `r3g-tracked-${vp.width}.png`));
        // Tab -> Completed
        await page.keyboard.press('Tab');
        await settle(page);
        const done = await page.$$eval('.qlog-row', (n) => n.map((r) => r.querySelector('.qlog-rname').textContent));
        assert.equal(done.length, 1);
        assert.ok(await page.$('.qlog-step.done'), 'done steps are checked');
        assert.ok(!(await page.$('.qlog-track')), 'no Track button for finished quests');
        await H.shot(page, path.join(OUT, `r3g-done-${vp.width}.png`));
        await page.keyboard.press('ArrowLeft');
        await settle(page);
        assert.ok(await page.$('.qlog-track'), 'ArrowLeft returns to Active');
        // the side panel shows the tracked quest
        await page.keyboard.press('Escape');
        assert.equal(await modalType(page), null, 'Esc closes');
        await page.waitForTimeout(300);
        const inPanel = await panelQuest(page);
        const name = await page.evaluate(() => { const g = window.__game.game; return g.data.quests[g.quests.tracked].name; });
        assert.equal(inPanel, name, 'panel shows the tracked quest');
        assert.deepEqual(errors, [], 'no console errors');
        await page.close();
      }
    });

    await check('track a different quest by mouse and the panel changes', async () => {
      const page = await setup(VPS[0]);
      await page.keyboard.press('KeyQ');
      await settle(page);
      const first = await panelQuest(page);
      const target = await page.$('.qlog-row:not(.tracked)');
      await target.hover();
      await page.click('.qlog-track');
      await settle(page);
      await page.keyboard.press('KeyQ');
      await page.waitForTimeout(300);
      assert.notEqual(await panelQuest(page), first, 'panel changed from ' + first);
      await page.close();
    });

    await check('open from the pause menu and from a click on the panel quest box', async () => {
      const page = await setup(VPS[1]);
      await page.keyboard.press('Escape');
      await settle(page);
      assert.equal(await modalType(page), 'pause');
      await H.shot(page, path.join(OUT, 'r3g-pause-1024.png'));
      const idx = await page.$$eval('.pause-row', (n) => n.findIndex((r) => r.dataset.id === 'quests'));
      assert.ok(idx > 0, 'pause has a Quest log row');
      for (let i = 0; i < idx; i++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await settle(page);
      assert.equal(await modalType(page), 'questLog', 'opened from the pause menu');
      await page.keyboard.press('Escape');
      assert.equal(await modalType(page), null);
      await page.click('.pnl-quest');
      await settle(page);
      assert.equal(await modalType(page), 'questLog', 'opened by clicking the panel quest box');
      await page.click('.qlog-tab:nth-child(2)');
      await settle(page);
      assert.equal(await page.$$eval('.qlog-row', (n) => n.length), 1, 'mouse switches tabs');
      await page.close();
    });

    await check('the 10-look picker works by keyboard and fits both sizes', async () => {
      for (const vp of VPS) {
        const page = await H.newPage(browser, { viewport: vp });
        const errors = H.collectErrors(page);
        await H.openGame(page, { base: srv.url, renderer: '2d' });
        await page.evaluate(() => {
          const g = window.__game.game;
          g.ops.run([['lookPicker']]);
        });
        await settle(page);
        assert.equal(await modalType(page), 'lookPicker');
        assert.equal(await page.$$eval('.look-card', (n) => n.length), 10);
        const cols = await page.$$eval('.look-card', (n) => new Set(n.map((c) => Math.round(c.getBoundingClientRect().left))).size);
        const rows = await page.$$eval('.look-card', (n) => new Set(n.map((c) => Math.round(c.getBoundingClientRect().top))).size);
        assert.deepEqual([cols, rows], [5, 2]);
        const m = await page.evaluate(() => { const r = document.querySelector('.look-picker').getBoundingClientRect(); const pl = document.getElementById('panel').getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, vw: innerWidth, vh: innerHeight, pr: pl.right }; });
        assert.ok(m.t >= 0 && m.b <= m.vh && m.l >= m.pr - 1 && m.r <= m.vw, JSON.stringify(m));
        // keyboard: move to the last look (index 9) and see it selected
        for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.$$eval('.look-card', (n) => n.findIndex((c) => c.classList.contains('sel'))), 9);
        await H.shot(page, path.join(OUT, `r3g-looks-${vp.width}.png`));
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => window.__game.game.flags.look_choice), 4, 'Enter picks the selected look');
        assert.deepEqual(errors, []);
        await page.close();
      }
    });
  } finally {
    await browser.close();
    srv.stop();
  }
  process.exit(failed ? 1 : 0);
})();
