// 3D renderer e2e: screenshots every gallery page (plus close-ups), the busy-scene harness and the test zone;
// asserts real WebGL, no console errors, stats().unknown empty, and the draw-call / triangle budgets.
// Run: node tests/e2e/r3d-gallery.cjs            (R3D_ONLY=gallery|busy|game to run a part)
const path = require('node:path');
const assert = require('node:assert');
const H = require('./helpers.cjs');

const OUT = path.join(__dirname, 'out');
const VP = { width: 800, height: 450 };
const ONLY = process.env.R3D_ONLY || '';
const BUDGET = { draws: 120, tris: 120000, programs: 8 };

// close-ups: [page, x, y, zoom, name]
const ZOOMS = [
  [0, 4, 3.5, 2.6, 'humanoids-a'], [0, 12, 3.5, 2.6, 'humanoids-b'], [0, 20, 3.5, 2.6, 'humanoids-c'],
  [0, 4, 7.5, 2.6, 'humanoids-d'], [0, 12, 7.5, 2.6, 'humanoids-e'], [0, 20, 7.5, 2.6, 'humanoids-f'],
  [0, 6, 11.5, 2.6, 'humanoids-g'], [0, 18, 11.5, 2.6, 'humanoids-h'], [0, 6, 15.5, 2.6, 'humanoids-i'], [0, 18, 15.5, 2.6, 'humanoids-j'],
  [0, 23, 11.5, 2.6, 'heroes'],
  [1, 6, 4, 1.6, 'creatures-a'], [1, 20, 4, 1.6, 'creatures-b'], [1, 6, 10, 1.6, 'creatures-c'], [1, 20, 10, 1.6, 'creatures-d'],
  [1, 6, 16, 1.6, 'creatures-e'], [1, 20, 16, 1.6, 'creatures-f'],
  [2, 7, 4, 1.5, 'models-a'], [2, 20, 4, 1.5, 'models-b'], [2, 7, 10, 1.5, 'models-c'], [2, 20, 10, 1.5, 'models-d'], [2, 7, 14.5, 1.5, 'models-e'], [2, 20, 14.5, 1.5, 'models-f'],
  [3, 8, 4, 1.5, 'fx-a'], [3, 24, 4, 1.5, 'fx-b'], [3, 8, 10, 1.5, 'fx-c'], [3, 24, 10, 1.5, 'fx-d'], [3, 8, 15.5, 1.5, 'fx-e'], [3, 24, 15.5, 1.5, 'fx-f'],
  [4, 9, 6, 1.2, 'tiles-a'], [4, 28, 6, 1.2, 'tiles-b'], [4, 9, 14, 1.2, 'tiles-c'], [4, 28, 14, 1.2, 'tiles-d'],
  [4, 10, 21, 1.2, 'props-a'], [4, 28, 21, 1.2, 'props-b'], [4, 10, 28, 1.2, 'props-c'], [4, 28, 28, 1.2, 'props-d'], [4, 20, 35, 1.2, 'props-e'],
];

(async () => {
  const server = await H.startServer();
  const browser = await H.launch({ webgl: true });
  let failed = 0;
  const rows = [];
  const check = async (name, fn) => {
    try { await fn(); console.log('ok   ', name); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', e.message); }
  };
  const page = await H.newPage(browser, { viewport: VP });
  const errors = H.collectErrors(page);
  try {
    await page.goto(server.url + '/README.md');
    const gl = await H.webglInfo(page);
    console.log('webgl:', gl || 'none');
    assert.ok(gl, 'WebGL must be available');

    if (!ONLY || ONLY === 'gallery') {
      for (let n = 0; n < 5; n++) {
        await check(`gallery page ${n}`, async () => {
          await H.openGallery(page, { base: server.url, renderer: '3d', page: n });
          await page.evaluate(() => window.__gallery.setTime(1.1));
          const stats = await page.evaluate(() => window.__gallery.stats());
          assert.strictEqual(stats.renderer, '3d', 'really the 3D renderer');
          await H.shot(page, path.join(OUT, `r3d-p${n}.png`));
          rows.push({ what: `page ${n}`, draws: stats.draws, tris: stats.tris, programs: stats.programs, ents: stats.entCount });
          assert.deepStrictEqual(stats.unknown, [], 'no unknown look values');
          assert.ok(stats.programs <= BUDGET.programs, 'programs ' + stats.programs);
        });
      }
      await check('gallery close-ups', async () => {
        let cur = -1;
        for (const [n, x, y, zoom, name] of ZOOMS) {
          if (n !== cur) { await H.openGallery(page, { base: server.url, renderer: '3d', page: n }); cur = n; }
          await page.evaluate(([x, y, z]) => { window.__gallery.setTime(n3(1.1)); window.__gallery.setCamera(x, y, z); function n3(v) { return v; } }, [x, y, zoom]);
          await H.shot(page, path.join(OUT, `r3d-z-${name}.png`));
        }
        // a few fx moments
        await H.openGallery(page, { base: server.url, renderer: '3d', page: 3 });
        for (const tt of [0.12, 0.3, 0.55]) {
          await page.evaluate((t) => { window.__gallery.setTime(null); window.__gallery.setTime(t); }, tt);
          await page.evaluate(() => window.__gallery.setCamera(16, 6, 0.9));
          await H.shot(page, path.join(OUT, `r3d-fx-t${Math.round(tt * 100)}.png`));
        }
      });
    }

    if (!ONLY || ONLY === 'busy') {
      for (const scene of ['town', 'enemies']) {
        await check(`busy scene ${scene} budgets`, async () => {
          await page.goto(`${server.url}/tests/e2e/r3d-harness.html?scene=${scene}`);
          await page.waitForFunction(() => window.__r3d && window.__r3d.ready === true, null, { timeout: 20000 });
          await page.evaluate(() => window.__r3d.setTime(2.2));
          const s = await page.evaluate(() => window.__r3d.stats());
          await H.shot(page, path.join(OUT, `r3d-busy-${scene}.png`));
          rows.push({ what: 'busy ' + scene, draws: s.draws, tris: s.tris, programs: s.programs, ents: s.entCount });
          assert.deepStrictEqual(s.unknown, [], 'no unknown look values');
          assert.ok(s.draws <= BUDGET.draws, `draw calls ${s.draws} <= ${BUDGET.draws}`);
          assert.ok(s.tris <= BUDGET.tris, `triangles ${s.tris} <= ${BUDGET.tris}`);
          assert.ok(s.programs <= BUDGET.programs, `programs ${s.programs} <= ${BUDGET.programs}`);
          // quality 0 and 1 also render
          for (const q of [0, 1]) {
            await page.evaluate((qq) => window.__r3d.setQuality(qq), q);
            const sq = await page.evaluate(() => window.__r3d.stats());
            rows.push({ what: `busy ${scene} q${q}`, draws: sq.draws, tris: sq.tris, programs: sq.programs, ents: sq.entCount });
            await H.shot(page, path.join(OUT, `r3d-busy-${scene}-q${q}.png`));
          }
        });
      }
    }

    if (!ONLY || ONLY === 'game') {
      await check('game test zone (3d)', async () => {
        await H.openGame(page, { base: server.url, renderer: '3d', params: { zone: 'test' } });
        const cls = await page.evaluate(() => document.querySelector('#view canvas').className);
        assert.strictEqual(cls, 'r3d', 'the 3D canvas is in use');
        await page.evaluate(() => window.__game.step(90, { moveX: 1, moveY: 0.3 }));
        await page.evaluate(() => window.__game.step(30, { moveX: 0, moveY: 0 }));
        await H.shot(page, path.join(OUT, 'r3d-game-test.png'));
        const s = await page.evaluate(() => window.__game.renderStats());
        rows.push({ what: 'game test', draws: s.draws, tris: s.tris, programs: s.programs });
        assert.deepStrictEqual(s.unknown, [], 'no unknown look values');
        assert.ok(s.draws <= BUDGET.draws && s.tris <= BUDGET.tris, 'budgets in the test zone');
        // hot swap to 2d and back, then dispose cleanly
        await page.evaluate(() => window.__game.setRenderer('2d'));
        await page.evaluate(() => window.__game.setRenderer('3d'));
        await page.evaluate(() => window.__game.step(5, { moveX: 0, moveY: 0 }));
        await H.shot(page, path.join(OUT, 'r3d-game-test-swapped.png'));
      });
    }
    await check('no console errors', async () => { assert.deepStrictEqual(errors, []); });
  } finally {
    console.table(rows);
    await browser.close();
    server.stop();
  }
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
