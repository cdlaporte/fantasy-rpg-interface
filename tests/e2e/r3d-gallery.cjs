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
const ZOOMS = [];
// page 0: humanoids on a 2-tile grid (13 columns); frame 3 x 2 cells per shot, plus the heroes up close
for (const y of [1.6, 3.6, 5.6, 7.6, 9.6, 11.6, 13.6, 15.6]) for (const x of [4, 10, 16, 22]) ZOOMS.push([0, x, y, 2.6, `h-${x}-${y}`]);
ZOOMS.push([0, 23, 9.4, 4, 'heroes'], [0, 3, 11.4, 4, 'hood']);
// pages 1-3: 3-tile grid
for (const n of [1, 2, 3]) for (const y of [1.9, 4.9, 7.9, 10.9, 13.9]) for (const x of [5.5, 14.5, 23.5]) ZOOMS.push([n, x, y, 2.2, `p${n}-${x}-${y}`]);
ZOOMS.push([1, 20.5, 13.4, 2.6, 'mossback']);
// page 4: tiles and props
for (const y of [4, 9, 14, 20, 26, 32, 37]) for (const x of [9, 22, 33]) ZOOMS.push([4, x, y, 1.25, `p4-${x}-${y}`]);
// pages 5-8 (round 3 biomes): props, creatures and heroes at play zoom, plus the map edge (north-west corner, south rim)
const BIOME_PAGES = [5, 6, 7, 8];
for (const n of BIOME_PAGES) {
  for (const y of [8.5, 14]) for (const x of [6, 17, 28]) ZOOMS.push([n, x, y, 1, `b${n}-${x}-${y}`]);
  for (const y of [20, 25]) for (const x of [5, 15]) ZOOMS.push([n, x, y, 1.1, `b${n}-ent-${x}-${y}`]);
  ZOOMS.push([n, 3, 2, 0.8, `b${n}-edge-nw`], [n, 22, 28, 0.8, `b${n}-edge-s`]);
}
ZOOMS.push([5, 7.5, 27, 2.2, 'hero-sphinx'], [6, 12.5, 25, 2.2, 'hero-crab_king'], [7, 5, 23.5, 1.6, 'hero-yeti'], [8, 5, 24, 1.2, 'hero-malgrim']);


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
      for (let n = 0; n < 9; n++) {
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
          await page.evaluate(([x, y, z]) => { window.__gallery.setTime(1.1); window.__gallery.setCamera(x, y, z); }, [x, y, zoom]);
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

    if (!ONLY || ONLY === 'gallery') {
      await check('context loss is reported, not thrown', async () => {
        await H.openGallery(page, { base: server.url, renderer: '3d', page: 2 });
        const got = await page.evaluate(() => new Promise((resolve) => {
          const host = document.getElementById('view');
          host.addEventListener('r3d:contextlost', () => resolve(true), { once: true });
          window.__gallery.renderer.webgl.forceContextLoss();
          setTimeout(() => resolve(false), 2000);
        }));
        assert.ok(got, 'r3d:contextlost event');
        await page.waitForTimeout(200);
      });
    }

    if (!ONLY || ONLY === 'busy') {
      // budgets are measured at the Chromebook play-view size (1366 - 280 px panel) x 657
      const big = await H.newPage(browser, { viewport: { width: 1086, height: 657 } });
      const bigErrors = H.collectErrors(big);
      for (const scene of ['town', 'enemies']) {
        const page = big;
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
      for (const e of bigErrors) errors.push(e);
      await big.close();
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
        // a tile change rebuilds its chunk
        await page.evaluate(() => { const g = window.__game.game; const p = g.player; g.world.setTile(Math.floor(p.x) + 2, Math.floor(p.y) + 1, 'water'); g.world.setTile(Math.floor(p.x) - 2, Math.floor(p.y), 'brick'); });
        await page.evaluate(() => window.__game.step(2, { moveX: 0, moveY: 0 }));
        await H.shot(page, path.join(OUT, 'r3d-game-test-tile.png'));
        // hot swap to 2d and back, then dispose cleanly
        await page.evaluate(() => window.__game.setRenderer('2d'));
        await page.evaluate(() => window.__game.setRenderer('3d'));
        await page.evaluate(() => window.__game.step(5, { moveX: 0, moveY: 0 }));
        await H.shot(page, path.join(OUT, 'r3d-game-test-swapped.png'));
      });
    }
    if (!ONLY || ONLY === 'game' || ONLY === 'biomes') {
      // round 3: the four biome zones in the real game at the Chromebook play size (budgets, no unknown art values)
      const big = await H.newPage(browser, { viewport: { width: 1086, height: 657 } });
      const bigErrors = H.collectErrors(big);
      await H.openGame(big, { base: server.url, renderer: '3d' });
      for (const zone of ['dunes', 'cove', 'peaks', 'aether']) {
        await check(`biome ${zone} in the game (3d)`, async () => {
          await big.evaluate((z) => window.__game.scenario('biome', { zone: z, level: 15 }), zone);
          await big.evaluate(() => window.__game.step(40, { moveX: 0.4, moveY: -0.3 }));
          await big.evaluate(() => window.__game.step(2, { moveX: 0, moveY: 0 }));
          const s = await big.evaluate(() => window.__game.renderStats());
          await H.shot(big, path.join(OUT, `r3d-biome-${zone}.png`));
          rows.push({ what: 'biome ' + zone, draws: s.draws, tris: s.tris, programs: s.programs });
          assert.deepStrictEqual(s.unknown, [], 'no unknown look values');
          assert.ok(s.draws <= BUDGET.draws && s.tris <= BUDGET.tris, `budgets in ${zone}: ${s.draws} draws, ${s.tris} tris`);
        });
      }
      for (const e of bigErrors) errors.push(e);
      await big.close();
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
