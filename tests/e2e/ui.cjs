// UI e2e: title screen by keyboard, then every modal walked by keyboard only (section 9 payloads, commands
// recorded), modal key isolation, pause from gameplay, the big map, and no console errors / UI warnings.
// Run: node tests/e2e/ui.cjs
const path = require('node:path');
const assert = require('node:assert');
const H = require('./helpers.cjs');
const { installHarness } = require('./ui-fixtures.cjs');

const OUT = path.join(__dirname, 'out');

(async () => {
  const server = await H.startServer();
  const browser = await H.launch({ webgl: false });
  let failed = 0;
  const check = async (name, fn) => {
    try { await fn(); console.log('ok   ', name); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', e.message); }
  };
  const uiWarnings = (page) => {
    const list = [];
    page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[ui]')) list.push(m.text()); });
    return list;
  };
  try {
    await check('title screen: type a name, start a new game by keyboard', async () => {
      const page = await H.newPage(browser);
      const errors = H.collectErrors(page);
      await page.goto(`${server.url}/?debug=1&questions=auto`);
      await page.waitForSelector('.title-screen .name-input');
      await page.keyboard.type('Ro$wan!!  the Great');           // filtered to letters/numbers/single spaces, max 12
      const typed = await page.$eval('.name-input', (i) => i.value);
      assert.strictEqual(typed, 'Rowan the Gr');
      await page.keyboard.press('ArrowDown');                     // buttons (3D is the only look; no look row)
      await page.keyboard.press('Enter');                         // New Game
      await page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 20000 });
      const st = await page.evaluate(() => ({ name: window.__game.game.name, r: document.querySelector('#view canvas').className, title: !!document.querySelector('.title-screen') }));
      assert.strictEqual(st.name, 'Rowan the Gr');
      assert.ok(/r3d|r2d/.test(st.r), 'a renderer canvas exists: ' + st.r);
      await page.waitForTimeout(500);
      assert.ok(!(await page.$('.title-screen')), 'title screen removed');
      assert.deepStrictEqual(errors, [], 'no console errors');
      await page.close();
    });

    await check('every modal by keyboard, commands called, keys isolated, no errors', async () => {
      const page = await H.newPage(browser);
      const warns = uiWarnings(page);
      const { errors } = await H.openGame(page, { base: server.url, renderer: '2d' });
      await installHarness(page);
      await page.evaluate(() => {
        window.__leak = [];
        window.addEventListener('keydown', (e) => { if (window.__game.game.modal) window.__leak.push(e.code); });
      });
      await page.evaluate(() => window.__ui.setHud(window.__ui.hudFull));
      const calls = () => page.evaluate(() => window.__ui.calls.splice(0).map(([n, a]) => [n, ...a.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x))]));
      const open = async (name) => {
        const t = await page.evaluate((n) => window.__ui.open(n), name);
        await page.waitForTimeout(60);
        const shown = await page.$('#modal-root .modal-layer:not([hidden]) > *');
        assert.ok(shown, `${name}: modal element rendered`);
        return t;
      };
      const close = () => page.evaluate(() => window.__game.game.closeModal());
      const key = async (...codes) => { for (const c of codes) await page.keyboard.press(c); };
      await calls();

      // dialogue: E completes the typewriter, E again advances
      await open('dialogue');
      await key('KeyE');
      assert.ok(await page.$eval('.dlg-rest', (n) => n.textContent === ''), 'typewriter completed by E');
      await key('KeyE');
      assert.deepStrictEqual(await calls(), [['dialogueAdvance']]);
      await close();

      // dialogue options: arrows + Enter, digits, disabled option refused
      await open('dialogueOptions');
      await key('Space', 'ArrowDown', 'Enter');
      await key('Digit3');
      await key('Digit1');
      assert.deepStrictEqual(await calls(), [['dialogueChoose', 1], ['dialogueChoose', 0]]);
      await close();

      // shop
      await open('shop');
      await key('ArrowDown', 'Enter', 'KeyH');
      await key('ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter');   // focus scroll: canBuy false -> refused
      await key('Escape');
      assert.deepStrictEqual(await calls(), [['shopBuy', 'potion_big'], ['shopHaggle'], ['closeModal']]);
      assert.strictEqual(await page.evaluate(() => window.__game.game.modal), null, 'shop closed by Escape');

      // inventory: put bread on slot 2, switch to wardrobe, wear the cape, close
      await open('inventory');
      await key('ArrowDown', 'Digit2', 'ArrowRight', 'ArrowDown', 'Enter', 'Escape');
      assert.deepStrictEqual(await calls(), [['assignSlot', 'bread', 1], ['equipCosmetic', 'cape_blue'], ['closeModal']]);

      // look picker: names only, no other labels
      await open('lookPicker');
      const lookText = await page.$eval('.look-picker', (n) => n.innerText.replace(/\s+/g, ' ').trim());
      assert.strictEqual(lookText, Array(8).fill('Rowan').join(' '), 'look picker shows only the name, once per look: ' + lookText);
      assert.strictEqual(await page.$$eval('.look-card', (n) => n.length), 8, 'eight looks');
      const grid = await page.$$eval('.look-card', (n) => n.map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
      assert.strictEqual(new Set(grid.map((g) => g[1])).size, 2, 'two rows');
      assert.strictEqual(new Set(grid.map((g) => g[0])).size, 4, 'four columns');
      await key('ArrowRight', 'Enter');
      assert.deepStrictEqual(await calls(), [['pickLook', 1]]);
      await key('ArrowDown', 'ArrowLeft', 'Enter');
      assert.deepStrictEqual(await calls(), [['pickLook', 4]], 'arrows move through the 4 x 2 grid');
      await page.hover('.look-card:nth-child(7)');
      await page.mouse.down(); await page.mouse.up();
      assert.deepStrictEqual(await calls(), [['pickLook', 6]], 'mouse picks a look');
      await page.mouse.move(2, 2);
      await close();

      await open('classPicker');
      await key('Digit3');
      assert.deepStrictEqual(await calls(), [['pickClass', 'rogue']]);
      await close();

      await open('specPicker');
      await key('ArrowRight', 'Enter');
      assert.deepStrictEqual(await calls(), [['pickSpec', 'sorcerer']]);
      await close();

      await open('boonPicker');
      await key('Digit2');
      assert.deepStrictEqual(await calls(), [['pickBoon', 'blink_burst']]);
      await close();

      // question: the provider renders into our element and owns the keys
      await open('question');
      await page.waitForSelector('.question-mount .question-stub');
      await key('Digit1');
      await page.waitForFunction(() => window.__ui.answered && window.__game.game.modal === null);
      assert.strictEqual(await page.evaluate(() => window.__ui.answered.correct), true);
      await calls();

      await open('lesson');
      await key('Enter');
      assert.deepStrictEqual(await calls(), [['closeModal']]);

      // pause from gameplay with Escape, change quality with arrows, resume with Escape
      await page.evaluate(() => { window.__leak.length = 0; });
      await key('Escape');
      assert.strictEqual(await page.evaluate(() => window.__game.game.modal && window.__game.game.modal.type), 'pause');
      await key('ArrowDown', 'ArrowDown', 'ArrowRight', 'Escape');
      const pc = await calls();
      assert.ok(pc.some((c) => c[0] === 'openPause'), 'openPause tried first');
      assert.ok(pc.some((c) => c[0] === 'setQuality' && c[1] === 2), 'quality raised: ' + JSON.stringify(pc));
      assert.strictEqual(await page.evaluate(() => window.__game.game.modal), null, 'pause closed by Escape');
      assert.deepStrictEqual(await page.evaluate(() => window.__leak), [], 'modal keys never reach the game input');

      // big map
      await key('KeyM');
      assert.strictEqual(await page.$eval('.bigmap', (n) => n.hidden), false, 'M opens the big map');
      await H.shot(page, path.join(OUT, 'ui-e2e-bigmap.png'));
      await key('KeyM');
      assert.strictEqual(await page.$eval('.bigmap', (n) => n.hidden), true, 'M closes the big map');

      const gameErrors = await page.evaluate(() => window.__game.errors());
      assert.deepStrictEqual(errors, [], 'no console errors');
      assert.deepStrictEqual(gameErrors, [], 'no game errors');
      assert.deepStrictEqual(warns, [], 'no UI warnings');
      await page.close();
    });

    await check('look picker (8 looks) fits the modal area at both sizes', async () => {
      for (const vp of [{ width: 1366, height: 657 }, { width: 1024, height: 600 }]) {
        const page = await H.newPage(browser, { viewport: vp });
        await H.openGame(page, { base: server.url, renderer: '2d' });
        await installHarness(page);
        await page.evaluate(() => window.__ui.open('lookPicker'));
        await page.waitForTimeout(200);
        const m = await page.evaluate(() => {
          const r = document.querySelector('.look-picker').getBoundingClientRect();
          const pl = document.getElementById('panel').getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, panelRight: pl.right };
        });
        assert.ok(m.top >= 0 && m.bottom <= m.vh, `${vp.width}: picker inside the height (${m.top}..${m.bottom} of ${m.vh})`);
        assert.ok(m.left >= m.panelRight - 1 && m.right <= m.vw, `${vp.width}: picker inside the width (${m.left}..${m.right})`);
        await H.shot(page, path.join(OUT, `ui-e2e-looks-${vp.width}.png`));
        await page.close();
      }
    });

    await check('tooltips: appear on hover after a short delay, off the cursor, on screen, never steal clicks', async () => {
      const page = await H.newPage(browser);
      await H.openGame(page, { base: server.url, renderer: '2d' });
      await installHarness(page);
      await page.evaluate(() => window.__ui.setHud(window.__ui.hudFull));
      await page.waitForTimeout(250);
      const tipState = () => page.evaluate(() => {
        const t = document.querySelector('.tooltip');
        if (!t || t.hidden) return null;
        const r = t.getBoundingClientRect();
        return { text: t.innerText.replace(/\s+/g, ' ').trim(), r: [r.left, r.top, r.right, r.bottom], vw: innerWidth, vh: innerHeight, pe: getComputedStyle(t).pointerEvents };
      });
      const hoverAt = async (sel, nth = 0) => {
        const box = await (await page.$$(sel))[nth].boundingBox();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        await page.mouse.move(x - 40, y - 40); await page.mouse.move(x, y);
        return [x, y];
      };
      const [x0, y0] = await hoverAt('.islot', 0);
      await page.waitForTimeout(80);
      assert.strictEqual(await tipState(), null, 'no tooltip before the delay');
      await page.waitForTimeout(350);
      let t = await tipState();
      assert.ok(t, 'item tooltip appears');
      assert.ok(/potion/i.test(t.text), 'item name in the tip: ' + t.text);
      assert.strictEqual(t.pe, 'none', 'tooltip ignores the pointer');
      const covers = (tt, x, y) => x >= tt.r[0] && x <= tt.r[2] && y >= tt.r[1] && y <= tt.r[3];
      assert.ok(!covers(t, x0, y0), 'tooltip does not cover the cursor');
      assert.ok(t.r[0] >= 0 && t.r[1] >= 0 && t.r[2] <= t.vw && t.r[3] <= t.vh, 'tooltip on screen');
      await H.shot(page, path.join(OUT, 'ui-e2e-tip-item.png'));
      await hoverAt('.aslot', 1);
      await page.waitForTimeout(450);
      t = await tipState();
      assert.ok(t && /Cost|Ready|Cooldown|Unlocks/.test(t.text) && t.text.length > 20, 'ability tooltip: ' + (t && t.text));
      await H.shot(page, path.join(OUT, 'ui-e2e-tip-ability.png'));
      for (const sel of ['.stat', '.pnl-basic', '.pnl-quest', '.comp', '.bar-hp']) {
        await hoverAt(sel);
        await page.waitForTimeout(400);
        assert.ok(await tipState(), 'tooltip over ' + sel);
      }
      await page.mouse.move(700, 300);
      await page.waitForTimeout(100);
      assert.strictEqual(await tipState(), null, 'tooltip hides when the pointer leaves');
      await hoverAt('.islot', 0);
      await page.waitForTimeout(400);
      const active = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
      assert.ok(active === 'BODY' || active === 'HTML', 'focus untouched: ' + active);
      await page.evaluate(() => { window.__ui.calls.length = 0; });
      await page.mouse.down(); await page.mouse.up();
      assert.deepStrictEqual(await page.evaluate(() => window.__ui.calls.map((c) => c[0])), ['useSlot'], 'click reaches the slot');
      await page.evaluate(() => window.__ui.open('shop'));
      await page.waitForTimeout(150);
      await hoverAt('.shop-row', 1);
      await page.waitForTimeout(400);
      t = await tipState();
      assert.ok(t && /Big Potion/.test(t.text) && /45/.test(t.text), 'shop tooltip: ' + (t && t.text));
      await H.shot(page, path.join(OUT, 'ui-e2e-tip-shop.png'));
      await page.evaluate(() => window.__game.game.closeModal());
      await page.evaluate(() => window.__ui.open('boonPicker'));
      await page.waitForTimeout(150);
      await hoverAt('.boon-card', 0);
      await page.waitForTimeout(400);
      t = await tipState();
      assert.ok(t && /Splitting Bolts/.test(t.text), 'boon tooltip: ' + (t && t.text));
      assert.strictEqual(await page.evaluate(() => [...document.querySelectorAll('[title]')].filter((n) => n.closest('#panel, #modal-root')).length), 0, 'no native title attributes left in the panel and modals');
      await page.close();
    });

    await check('panel fits 1366x657 and 1024x600 without scrolling', async () => {
      for (const vp of [{ width: 1366, height: 657 }, { width: 1024, height: 600 }]) {
        const page = await H.newPage(browser, { viewport: vp });
        await H.openGame(page, { base: server.url, renderer: '2d' });
        await installHarness(page);
        await page.evaluate(() => {
          const h = JSON.parse(JSON.stringify(window.__ui.hudFull));
          h.pendingSpec = true; h.pendingBoons = 2;
          window.__ui.setHud(h);
        });
        await page.waitForTimeout(250);
        const m = await page.evaluate(() => {
          const p = document.getElementById('panel');
          const last = [...p.querySelectorAll('.pnl > *')].filter((n) => !n.hidden).pop();
          return { sh: p.scrollHeight, ch: p.clientHeight, bottom: last.getBoundingClientRect().bottom, h: window.innerHeight };
        });
        await H.shot(page, path.join(OUT, `ui-e2e-panel-${vp.width}.png`));
        assert.ok(m.sh <= m.ch + 1, `${vp.width}x${vp.height}: panel content ${m.sh} fits ${m.ch}`);
        assert.ok(m.bottom <= m.h, `${vp.width}x${vp.height}: last panel block visible (${m.bottom} <= ${m.h})`);
        await H.shot(page, path.join(OUT, `ui-e2e-panel-${vp.width}.png`));
        await page.close();
      }
    });
  } finally {
    await browser.close();
    server.stop();
  }
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
