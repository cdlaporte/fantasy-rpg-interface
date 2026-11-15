// 2D renderer e2e: screenshots every gallery page (full + zoomed crops), an extra harness page, and the test zone;
// asserts no console errors, stats().unknown empty, draw calls within budget, and frame time with 60 entities.
// Run: node tests/e2e/r2d-gallery.cjs [--quick]   (screenshots -> tests/e2e/out/r2d-*.png)
const path = require('node:path');
const assert = require('node:assert');
const H = require('./helpers.cjs');

const OUT = path.join(__dirname, 'out');
const QUICK = process.argv.includes('--quick');
const ONLY = (process.argv.find((a) => a.startsWith('--pages=')) || '').slice(8);
const DRAW_BUDGET = 300;

(async () => {
  const server = await H.startServer();
  const browser = await H.launch({ webgl: false });
  let failed = 0;
  const check = async (name, fn) => {
    try { await fn(); console.log('ok   ', name); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', e.message); }
  };
  try {
    const pages = ONLY ? ONLY.split(',').map(Number) : [0, 1, 2, 3, 4];
    for (const n of pages) {
      await check(`gallery page ${n}`, async () => {
        const page = await H.newPage(browser);
        const { errors } = await H.openGallery(page, { base: server.url, renderer: '2d', page: n });
        await page.waitForTimeout(900);
        await H.shot(page, path.join(OUT, `r2d-p${n}.png`));
        const stats = await page.evaluate(() => window.__gallery.stats());
        // zoomed crops covering the page at zoom 2
        const z = await page.evaluate(() => { const g = window.__gallery; const r = g.renderer.viewRect({}); return r; });
        const zoom = n === 4 ? 1.5 : 2;
        const vw = 1366 / (48 * zoom), vh = 657 / (48 * zoom);
        const W = z.x1 - z.x0, Hh = z.y1 - z.y0;
        const cols = QUICK ? 1 : Math.ceil(W / vw), rows = QUICK ? 1 : Math.ceil(Hh / vh);
        let k = 0, maxDraws = 0, maxMs = 0;
        for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
          const x = z.x0 + vw / 2 + cx * vw, y = z.y0 + vh / 2 + ry * vh;
          await page.evaluate(([a, b, c]) => window.__gallery.setCamera(a, b, c), [x, y, zoom]);
          await page.waitForTimeout(n === 3 ? 350 : 150);
          await H.shot(page, path.join(OUT, `r2d-p${n}-z${k++}.png`));
          const s = await page.evaluate(() => window.__gallery.stats());
          maxDraws = Math.max(maxDraws, s.draws); maxMs = Math.max(maxMs, s.ms);
        }
        console.log(`      page ${n}: ents ${stats.entCount}, draws ${stats.draws} (zoomed max ${maxDraws}), ms ${stats.ms.toFixed(2)} (zoomed max ${maxMs.toFixed(2)}), unknown ${JSON.stringify(stats.unknown)}`);
        assert.deepStrictEqual(errors, [], 'no console errors');
        assert.deepStrictEqual(stats.unknown, [], 'every look value is drawable');
        assert.ok(maxDraws <= DRAW_BUDGET, `zoomed draws ${maxDraws} <= ${DRAW_BUDGET}`);
        await page.close();
      });
    }

    await check('extra harness (town street, effects in action)', async () => {
      const page = await H.newPage(browser);
      const errors = H.collectErrors(page);
      await page.goto(`${server.url}/tests/e2e/r2d-harness.html`);
      await page.waitForFunction(() => window.__harness && window.__harness.ready === true, null, { timeout: 20000 });
      const scenes = await page.evaluate(() => window.__harness.scenes);
      for (const sc of scenes) {
        await page.evaluate((s) => window.__harness.show(s), sc);
        await page.waitForTimeout(sc.startsWith('fx') ? 450 : 250);
        await H.shot(page, path.join(OUT, `r2d-h-${sc}.png`));
        const s = await page.evaluate(() => window.__harness.stats());
        console.log(`      harness ${sc}: draws ${s.draws}, ms ${s.ms.toFixed(2)}, ents ${s.ents}`);
        assert.ok(s.draws <= DRAW_BUDGET, `${sc}: draws ${s.draws} <= ${DRAW_BUDGET}`);
        assert.deepStrictEqual(s.unknown, [], sc + ': unknown');
      }
      assert.deepStrictEqual(errors, [], 'no console errors');
      await page.close();
    });

    await check('test zone in the real game (+60 entities perf)', async () => {
      const page = await H.newPage(browser);
      const { errors } = await H.openGame(page, { base: server.url, renderer: '2d', params: { zone: 'test' } });
      await page.evaluate(() => window.__game.step(30, { moveX: 1, moveY: 0.3 }));
      await page.evaluate(() => window.__game.input({ moveX: 0, moveY: 0 }));
      await page.waitForTimeout(300);
      await H.shot(page, path.join(OUT, 'r2d-game-test.png'));
      // 60 entities around the player
      const res = await page.evaluate(async () => {
        const G = window.__game.game;
        const p = G.player;
        const kinds = Object.keys(G.data.enemies);
        for (let i = 0; i < 60; i++) {
          const a = i * 2.4, d = 1.5 + (i % 7) * 0.9;
          try { const e = G.ents.spawn(kinds[i % kinds.length], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.6); if (e) { e.anim = 'walk'; e.ai = null; } } catch (err) { /* stub spawn may refuse */ }
        }
        window.__game.step(2);
        const r = window.__game.renderer ? window.__game.renderer() : null;
        const ms = [], draws = [];
        await new Promise((res2) => {
          let n = 0;
          const tick = () => {
            const s = window.__game.renderStats();
            if (n > 10) { ms.push(s.ms); draws.push(s.draws); }
            if (++n < 130) requestAnimationFrame(tick); else res2();
          };
          requestAnimationFrame(tick);
        });
        ms.sort((a, b) => a - b);
        return { count: G.ents.all.length, med: ms[ms.length >> 1], p90: ms[Math.floor(ms.length * 0.9)], maxDraws: Math.max(...draws), unknown: window.__game.renderStats().unknown, r: !!r };
      });
      await H.shot(page, path.join(OUT, 'r2d-game-60.png'));
      console.log(`      game: ents ${res.count}, frame ms median ${res.med.toFixed(2)} p90 ${res.p90.toFixed(2)}, max draws ${res.maxDraws}`);
      assert.deepStrictEqual(errors, [], 'no console errors');
      assert.deepStrictEqual(res.unknown, [], 'unknown');
      assert.ok(res.maxDraws <= DRAW_BUDGET, 'draw budget');
      assert.ok(res.med < 4, 'median frame time < 4 ms: ' + res.med);
      await page.close();
    });
  } finally {
    await browser.close();
    server.stop();
  }
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
