// Skeleton e2e: boots the game in 2d and 3d, walks right, checks for errors, screenshots + gallery page 0.
// Run: node tests/e2e/skeleton.cjs
const path = require('node:path');
const assert = require('node:assert');
const H = require('./helpers.cjs');

const OUT = path.join(__dirname, 'out');

(async () => {
  const server = await H.startServer();
  const browser = await H.launch({ webgl: true });
  let failed = 0;
  const check = async (name, fn) => {
    try { await fn(); console.log('ok   ', name); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', e.message); }
  };
  try {
    const probe = await H.newPage(browser);
    await probe.goto(server.url + '/README.md');
    const gl = await H.webglInfo(probe);
    console.log('webgl:', gl || 'none');
    await probe.close();

    for (const renderer of ['2d', '3d']) {
      await check(`game boots and walks (${renderer})`, async () => {
        if (renderer === '3d' && !gl) { console.log('skipped: no WebGL'); return; }
        const page = await H.newPage(browser);
        const { errors } = await H.openGame(page, { base: server.url, renderer });
        // the real new game starts with a locked-input intro cutscene: walk in the open test meadow instead
        await page.evaluate(() => window.__game.scenario('class_demo', { classId: 'warrior', level: 3 }));
        const before = await page.evaluate(() => window.__game.state());
        const after = await page.evaluate(() => window.__game.step(120, { moveX: 1, moveY: 0 }));
        await page.evaluate(() => window.__game.input({ moveX: 0 }));
        const rid = await page.evaluate(() => window.__game.renderStats() && window.__game.game.debug && document.querySelector('#view canvas').className);
        await page.waitForTimeout(200);
        await H.shot(page, path.join(OUT, `skeleton-${renderer}.png`));
        assert.ok(after.player.x > before.player.x + 1, `player should move right: ${before.player.x} -> ${after.player.x}`);
        assert.strictEqual(rid, 'r' + renderer, 'renderer canvas class');
        assert.deepStrictEqual(errors, [], 'no console errors');
        await page.close();
      });
      await check(`gallery page 0 (${renderer})`, async () => {
        if (renderer === '3d' && !gl) { console.log('skipped: no WebGL'); return; }
        const page = await H.newPage(browser);
        const { errors } = await H.openGallery(page, { base: server.url, renderer, page: 0 });
        await page.waitForTimeout(500);
        const stats = await page.evaluate(() => window.__gallery.stats());
        await H.shot(page, path.join(OUT, `gallery-${renderer}-p0.png`));
        assert.ok(stats.entCount > 50, 'gallery page 0 has many entities: ' + stats.entCount);
        assert.deepStrictEqual(errors, [], 'no console errors');
        await page.close();
      });
    }
  } finally {
    await browser.close();
    server.stop();
  }
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
