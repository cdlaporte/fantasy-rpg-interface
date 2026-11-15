// Task: every class and spec at levels 3, 8, 12 in BOTH renderers: cast the basic attack and every unlocked ability,
// assert renderStats().unknown stays empty, __game.errors() and the console stay clean.
// Run: node tests/e2e/matrix.cjs [2d|3d] [kitId]
const assert = require('node:assert');
const H = require('./helpers.cjs');
const K = require('./kitdriver.cjs');

(async () => {
  const only = process.argv[2] && ['2d', '3d'].includes(process.argv[2]) ? process.argv[2] : null;
  const onlyKit = process.argv.slice(2).find((a) => !['2d', '3d'].includes(a));
  const server = await H.startServer();
  const browser = await H.launch({ webgl: true });
  const watchdog = setTimeout(async () => { console.log('WATCHDOG'); try { await browser.close(); } catch { /* */ } server.stop(); process.exit(2); }, 12 * 60 * 1000);
  let failed = 0, casts = 0;
  try {
    for (const renderer of ['2d', '3d']) {
      if (only && only !== renderer) continue;
      const page = await H.newPage(browser, { viewport: { width: 900, height: 500 } });
      page.__base = server.url;
      const { errors } = await H.openGame(page, { renderer });
      const t0 = Date.now();
      for (const kit of K.KITS) {
        if (onlyKit && onlyKit !== kit.id) continue;
        for (const level of K.LEVELS) {
          const s = await K.setup(page, kit, level);
          assert.ok(s.ok, 'class_demo ' + kit.id + ' ' + JSON.stringify(s));
          const list = ['basic', ...s.abilities.map((a) => a.slot)];
          for (const what of list) {
            const label = `${renderer} ${kit.id} L${level} ${what === 'basic' ? 'basic (' + s.basic + ')' : what + ' (' + s.abilities.find((a) => a.slot === what).id + ')'}`;
            if (what !== 'basic' || list.length > 1) await K.setup(page, kit, level);   // fresh state per cast
            await K.castStart(page, what, 6);
            await K.stepFrames(page, 6);
            await K.castEnd(page, what, 24);
            casts++;
            const st = await page.evaluate(() => ({ unknown: window.__game.renderStats().unknown, errs: window.__game.errors() }));
            if (st.unknown.length || st.errs.length || errors.length) {
              failed++;
              console.log('FAIL', label, JSON.stringify({ unknown: st.unknown, errs: st.errs.slice(0, 2), console: errors.slice(0, 2) }));
              errors.length = 0;
            }
          }
        }
      }
      console.log(`${renderer}: ${casts} casts so far, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      await page.close();
    }
  } finally { clearTimeout(watchdog); await browser.close(); server.stop(); }
  console.log(failed ? failed + ' FAILED' : 'all passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
