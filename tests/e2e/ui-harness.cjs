// UI dev harness: opens the game with ?test=1&debug=1, injects fake HudState values, opens every modal with the
// section 9 payloads, emits feedback bus events, and screenshots each screen at 1366x657 into tests/e2e/out/.
// Run: node tests/e2e/ui-harness.cjs [--small]   (--small also renders at 1024x600)
const path = require('node:path');
const H = require('./helpers.cjs');
const { installHarness } = require('./ui-fixtures.cjs');

const OUT = path.join(__dirname, 'out');
const wait = (page, ms) => page.waitForTimeout(ms);

async function shoot(page, name, suffix) {
  await wait(page, 260);
  return H.shot(page, path.join(OUT, `ui-${name}${suffix}.png`));
}

async function run(browser, base, viewport, suffix) {
  const page = await H.newPage(browser, { viewport });
  const errors = H.collectErrors(page);
  // title screen (no test flag so it shows), with one saved game for Continue
  await page.goto(`${base}/?renderer=2d&debug=1`);
  await page.evaluate(() => localStorage.setItem('flinkerton.v1.Juniper', JSON.stringify({ v: 1, name: 'Juniper', zone: 'town', x: 5, y: 5, flags: {}, systems: { progression: { level: 6 } } })));
  await page.goto(`${base}/?renderer=2d&debug=1`);
  await page.waitForSelector('.title-screen');
  await page.keyboard.type('Rowan');
  await shoot(page, 'title', suffix);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await shoot(page, 'title-continue', suffix);
  await page.evaluate(() => localStorage.clear());

  await H.openGame(page, { base, renderer: '2d' });
  await installHarness(page);
  await shoot(page, 'hud-empty', suffix);
  await page.evaluate(() => window.__ui.setHud(window.__ui.hudFull));
  await shoot(page, 'hud-full', suffix);
  await page.evaluate(() => window.__ui.spawnOverlayCast());
  await wait(page, 120);
  await shoot(page, 'overlay', suffix);
  // rogue: pips, wanted, boss, tutorial, spec nudge, cloaked
  await page.evaluate(() => {
    const u = window.__ui;
    const h = JSON.parse(JSON.stringify(u.hudFull));
    Object.assign(h.player, { className: 'Rogue', specName: '', classId: 'rogue', resource: null, wanted: true, hp: 12, hpMax: 70, look: u.looks.rogue });
    h.kitHud = { pips: 3, pipsMax: 5, stance: null, label: 'Combo' };
    h.boss = { name: 'Old Mossback', hpFrac: 0.62, shield: true };
    h.tutorial = { text: 'Attack with the arrow keys!', keys: ['←', '↑', '↓', '→'] };
    h.pendingSpec = true; h.pendingBoons = 2;
    u.setHud(h);
  });
  await shoot(page, 'hud-boss', suffix);
  await page.evaluate(() => {
    const u = window.__ui;
    const h = JSON.parse(JSON.stringify(u.hudFull));
    Object.assign(h.player, { className: '', specName: '', classId: null, level: 2, resource: null, cloaked: true, look: Object.assign({}, h.player.look, { hood: true, outfit: { style: 'cloak', primary: '#6a5a8a', secondary: '#4a3e66', accent: '#c9b6ff' }, hat: null }) });
    h.abilities = h.abilities.map((a) => Object.assign({}, a, { unlocked: false, id: null, name: '', icon: 'lock', unlockLevel: { space: 3, q: 5, f: 8, shift: 11 }[a.slot] }));
    h.basic = { name: 'Stick', rank: 1, icon: 'sword' };
    h.companions = []; h.quest = null; h.pendingBoons = 0; h.items = [{ id: 'potion_small', name: 'Small Potion', icon: 'potion', count: 1, cdFrac: 0 }, null, null, null, null, null];
    h.tutorial = { text: 'Walk with', keys: ['W', 'A', 'S', 'D'] };
    u.setHud(h);
  });
  await shoot(page, 'hud-novice', suffix);
  await page.evaluate(() => window.__ui.setHud(window.__ui.hudFull));
  // banners
  await page.evaluate(() => { const g = window.__game.game; g.bus.emit('levelup', { level: 9, gained: 1 }); });
  await wait(page, 500);
  await shoot(page, 'banner-levelup', suffix);
  await page.evaluate(() => { const g = window.__game.game; g.bus.emit('ability:unlocked', { slot: 'f', id: 'meteor' }); });
  await wait(page, 2800);
  await shoot(page, 'banner-ability', suffix);
  await page.evaluate(() => { const g = window.__game.game; g.toast('Found 3 Gold', 'loot'); g.toast('Found 3 Gold', 'loot'); g.toast('The rune seal fades away.', 'good'); g.toast('Sealed until next term.', 'bad'); g.toast('Quest started: Goblin Trouble', 'quest'); });
  await shoot(page, 'toasts', suffix);
  await page.evaluate(() => { const g = window.__game.game; g.bus.emit('quest:done', { id: 'forest_mushroom_mischief' }); });
  await wait(page, 3600);
  await shoot(page, 'banner-quest', suffix);
  await page.evaluate(() => { const g = window.__game.game; g.bus.emit('letterbox', { on: true }); });
  await wait(page, 600);
  await shoot(page, 'letterbox', suffix);
  await page.evaluate(() => { const g = window.__game.game; g.bus.emit('letterbox', { on: false }); g.bus.emit('zone:transition', { to: 'test', phase: 'out' }); g.bus.emit('zone:load', { zone: g.zone, from: null }); g.bus.emit('zone:transition', { to: 'test', phase: 'in' }); });
  await wait(page, 700);
  await shoot(page, 'zonecard', suffix);
  await page.keyboard.press('KeyM');
  await shoot(page, 'bigmap', suffix);
  await page.keyboard.press('KeyM');

  for (const name of ['dialogue', 'dialogueOptions', 'shop', 'inventory', 'lookPicker', 'classPicker', 'specPicker', 'boonPicker', 'question', 'lesson', 'pause']) {
    await page.evaluate((n) => window.__ui.open(n), name);
    if (name.startsWith('dialogue')) await wait(page, 2600);
    await shoot(page, 'modal-' + name, suffix);
    if (name === 'pause') {
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await shoot(page, 'modal-pause-controls', suffix);
    }
    await page.evaluate(() => window.__game.game.closeModal());
  }
  const gameErrors = await page.evaluate(() => window.__game.errors());
  errors.push(...gameErrors.map((m) => 'game: ' + m));
  console.log(suffix || 'full', 'errors:', errors.length ? errors : 'none');
  await page.close();
  return errors;
}

(async () => {
  const server = await H.startServer();
  const browser = await H.launch({ webgl: false });
  let bad = 0;
  try {
    bad += (await run(browser, server.url, H.VIEWPORT, '')).length;
    if (process.argv.includes('--small')) bad += (await run(browser, server.url, { width: 1024, height: 600 }, '-small')).length;
  } finally {
    await browser.close();
    server.stop();
  }
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
