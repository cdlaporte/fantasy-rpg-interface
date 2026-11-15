// Showcase: a labeled screenshot per renderer, kit (class or spec), level and ability, written to
// tests/e2e/out/showcase/<renderer>-<kit>-L<level>-<ability>.png ('basic' for the basic attack, else the ability id).
// Each shot is framed on the player with training dummies around, a few frames after the cast (see PEAK in
// kitdriver.cjs). Also asserts renderStats().unknown, __game.errors() and the console stay clean.
// Run: node tests/e2e/showcase.cjs [2d|3d] [kitId] [level]    (all kits, both renderers: about 5 minutes)
const path = require('node:path');
const fs = require('node:fs');
const H = require('./helpers.cjs');
const K = require('./kitdriver.cjs');

const OUT = path.join(__dirname, 'out', 'showcase');
const args = process.argv.slice(2);
const only = args.find((a) => a === '2d' || a === '3d');
const onlyKit = args.find((a) => K.KITS.some((k) => k.id === a));
const onlyLevel = args.find((a) => /^\d+$/.test(a));
const HIDE = '.banner-host, .zone-card, #minimap, .toast, #toasts { display: none !important; }';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await H.startServer();
  const browser = await H.launch({ webgl: true });
  const watchdog = setTimeout(async () => { console.log('WATCHDOG: showcase took too long'); try { await browser.close(); } catch { /* */ } server.stop(); process.exit(2); }, 9 * 60 * 1000);
  let bad = 0, n = 0;
  try {
    for (const renderer of ['2d', '3d']) {
      if (only && only !== renderer) continue;
      const page = await H.newPage(browser, { viewport: { width: 900, height: 500 } });
      page.__base = server.url;
      const { errors } = await H.openGame(page, { renderer });
      await page.addStyleTag({ content: HIDE });
      const t0 = Date.now();
      for (const kit of K.KITS) {
        if (onlyKit && onlyKit !== kit.id) continue;
        for (const level of K.LEVELS) {
          if (onlyLevel && +onlyLevel !== level) continue;
          const first = await K.setup(page, kit, level);
          if (!first.ok) { bad++; console.log('FAIL setup', kit.id, level, JSON.stringify(first)); continue; }
          const list = [['basic', 'basic', first.basicHold], ...first.abilities.map((a) => [a.slot, a.id, a.hold])];
          for (const [what, name, hold] of list) {
            await K.setup(page, kit, level);
            const peak = what === 'basic' ? 7 : (K.PEAK[name] || 6);
            await K.castStart(page, what, peak);
            if (hold) await K.castEnd(page, what, 5);   // charge / draw / block abilities show their result after the release
            const file = path.join(OUT, `${renderer}-${kit.id}-L${level}-${name}.png`);
            await H.shot(page, file); n++;
            if (!hold) await K.castEnd(page, what, 8);
            const st = await page.evaluate(() => ({ unknown: window.__game.renderStats().unknown, errs: window.__game.errors() }));
            if (st.unknown.length || st.errs.length || errors.length) {
              bad++;
              console.log('FAIL', path.basename(file), JSON.stringify({ unknown: st.unknown, errs: st.errs.slice(0, 2), console: errors.slice(0, 2) }));
              errors.length = 0;
            }
          }
        }
      }
      console.log(`${renderer}: ${n} screenshots so far, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      await page.close();
    }
  } finally { clearTimeout(watchdog); await browser.close(); server.stop(); }
  console.log(bad ? bad + ' problems' : `ok: ${n} screenshots in tests/e2e/out/showcase/`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
