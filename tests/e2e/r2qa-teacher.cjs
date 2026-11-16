// Round 2 QA: teacher-mode class tour in 3D. In the class_demo arena (dummies around the player) the teacher tools
// set level 12 and switch through all 9 subclasses (and the 3 plain classes); every unlocked ability and the basic
// attack is cast once. Asserts renderStats().unknown stays empty, __game.errors() and the console stay clean, and that
// each cast really fired. Screenshots: tests/e2e/out/r2qa-teacher-<spec>.png (after the last cast of each kit).
// Run: node tests/e2e/r2qa-teacher.cjs
const path = require('node:path');
const assert = require('node:assert');
const H = require('./helpers.cjs');
const K = require('./kitdriver.cjs');

const OUT = path.join(__dirname, 'out');
const SPECS = ['knight', 'berserker', 'battlemage', 'conjurer', 'sorcerer', 'monk', 'archer', 'thief', 'ninja'];

(async () => {
  const server = await H.startServer();
  const browser = await H.launch({ webgl: true });
  const watchdog = setTimeout(async () => { console.log('WATCHDOG'); try { await browser.close(); } catch { /* */ } server.stop(); process.exit(2); }, 12 * 60 * 1000);
  let failed = 0;
  try {
    const page = await H.newPage(browser);
    page.__base = server.url;
    const { errors } = await H.openGame(page, { renderer: '3d' });
    const r = await page.evaluate(() => window.__game.scenario('class_demo', { classId: 'warrior', level: 12 }));
    assert.ok(r.ok, JSON.stringify(r));
    // teacher tools are refused outside teacher mode
    assert.strictEqual(await page.evaluate(() => window.__game.game.sys.debug.teacher.setLevel(3)), false, 'refused for students');
    await page.evaluate(() => { window.__game.game.teacher = true; });
    assert.strictEqual(await page.evaluate(() => window.__game.game.sys.debug.teacher.setLevel(12)), true);
    for (const spec of ['plain-warrior', 'plain-mage', 'plain-rogue', ...SPECS]) {
      const classOnly = spec.startsWith('plain-') ? spec.slice(6) : null;
      const info = await page.evaluate(({ spec, classOnly }) => {
        const g = window.__game.game, t = g.sys.debug.teacher;
        const ok = classOnly ? t.setClass(classOnly) : t.setSpec(spec);
        g.abilities.reset(g.player); g.kits.gain(g.player, 999);
        const p = g.player;
        for (const e of g.ents.all.slice()) if (e.type === 'enemy' && e.kind !== 'training_dummy') g.ents.remove(e);
        const h = g.hudState();
        return { ok, level: g.progression.level, cls: g.progression.classId, spec: g.progression.specId,
          abilities: h.abilities.filter((a) => a.unlocked && a.id).map((a) => ({ slot: a.slot, id: a.id, name: a.name })), basic: h.basic && h.basic.name };
      }, { spec, classOnly });
      assert.ok(info.ok !== false, 'switch to ' + spec + ': ' + JSON.stringify(info));
      assert.strictEqual(info.level, 12);
      if (!classOnly) assert.strictEqual(info.spec, spec);
      const L = await page.evaluate(() => { const g = window.__game.game; const l = g.kits.active(g.player); return { hold: Object.fromEntries(Object.entries((l && l.abilities) || {}).map(([s, a]) => [s, !!(a && (a.hold || a.release))])) }; });
      const list = [['basic', 'basic'], ...info.abilities.map((a) => [a.slot, a.id])];
      let fired = 0;
      for (const [what, name] of list) {
        await page.evaluate(() => { const g = window.__game.game; g.abilities.reset(g.player); g.kits.gain(g.player, 999); });
        const res0 = await K.resource(page);
        await K.castStart(page, what, what === 'basic' ? 7 : (K.PEAK[name] || 6));
        if (L.hold[what]) await K.castEnd(page, what, 5);
        const f = what === 'basic' ? true : await K.fired(page, what, res0);
        if (what !== 'basic' && !L.hold[what]) await K.castEnd(page, what, 8);
        if (f) fired++; else { failed++; console.log('FAIL', spec, name, 'did not fire'); }
      }
      await H.frames(page, 2);
      await H.shot(page, path.join(OUT, `r2qa-teacher-${spec}.png`));
      const st = await page.evaluate(() => ({ unknown: window.__game.renderStats().unknown, errs: window.__game.errors() }));
      if (st.unknown.length || st.errs.length || errors.length) { failed++; console.log('FAIL', spec, JSON.stringify({ st, errors: errors.slice(0, 2) })); errors.length = 0; }
      console.log('ok   ', spec.padEnd(14), `L${info.level} ${info.cls}/${info.spec || '-'}: basic + ${info.abilities.length} abilities, ${fired}/${list.length} fired (${info.abilities.map((a) => a.id).join(', ')})`);
    }
    assert.deepStrictEqual(await page.evaluate(() => window.__game.renderStats().unknown), [], 'renderStats().unknown');
    await page.close();
  } finally { clearTimeout(watchdog); await browser.close(); server.stop(); }
  console.log(failed ? failed + ' problems' : 'all passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
