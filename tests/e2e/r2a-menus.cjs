// Round 2, package A: title -> Options -> Settings (rebind a key, see it in game), title -> Teacher options with a
// wrong then the right PIN -> teacher game -> pause -> Teacher tools (level up to 12, down to 3, every subclass).
// Runs the real title screen (no test=1), so the game loop runs in real time. Screenshots: tests/e2e/out/r2a-*.png
//   node tests/e2e/r2a-menus.cjs [--2d]
const path = require('node:path');
const { startServer, launch, newPage, collectErrors, shot } = require('./helpers.cjs');

const OUT = path.join(__dirname, 'out');
const R2D = process.argv.includes('--2d');
const fails = [];
const warns = [];
function check(ok, what) { if (!ok) { fails.push(what); console.log('FAIL', what); } else console.log('ok  ', what); }
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function openTitle(page, base) {
  const q = 'debug=1&questions=auto' + (R2D ? '&renderer=2d' : '');
  await page.goto(`${base}/?${q}`);
  await page.waitForSelector('.title-screen .tbtn-opt');
  await pause(150);
}
async function waitGame(page) {
  await page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 60000 });
  await pause(300);
}
const state = (page) => page.evaluate(() => {
  const s = window.__game.state();
  return { level: s.level, xp: s.xp, classId: s.classId, specId: s.specId, rank: s.rank, boons: s.boons, pendingBoons: s.pendingBoons,
    modal: s.modal, teacher: window.__game.game.teacher };
});

async function settingsFlow(browser, base) {
  const page = await newPage(browser);
  const errors = collectErrors(page);
  await openTitle(page, base);
  await shot(page, path.join(OUT, 'r2a-title.png'));
  check(!(await page.$('.look-opt')), 'title: no 2D/3D look choice');
  // keyboard: name row -> buttons -> OPTIONS
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');                   // wraps from New Game to Options
  await page.keyboard.press('Enter');
  await page.waitForSelector('.opt-menu');
  await shot(page, path.join(OUT, 'r2a-options.png'));
  await page.keyboard.press('Enter');                       // Settings
  await page.waitForSelector('.settings');
  await shot(page, path.join(OUT, 'r2a-settings.png'));
  // mouse: click Ability 2's key (U), then press Y
  const cell = await page.evaluateHandle(() => {
    const names = [...document.querySelectorAll('.set-name')];
    const n = names.find((x) => x.textContent === 'Ability 2');
    return n.nextElementSibling;
  });
  check((await cell.evaluate((n) => n.textContent)) === 'U', 'settings: Ability 2 defaults to U');
  await cell.click();
  await page.waitForSelector('.set-wait');
  await shot(page, path.join(OUT, 'r2a-settings-wait.png'));
  await page.keyboard.press('KeyY');
  await pause(100);
  check((await cell.evaluate((n) => n.textContent)) === 'Y', 'settings: Ability 2 now Y');
  // a conflict: give Item 3 the key Y -> Ability 2 loses it (primary empty, Q still its extra key)
  const cell3 = await page.evaluateHandle(() => [...document.querySelectorAll('.set-name')].find((x) => x.textContent === 'Item 3').nextElementSibling);
  await cell3.click();
  await page.keyboard.press('KeyY');
  await pause(100);
  const msg = await page.textContent('.set-msg');
  check(/Taken from Ability 2/.test(msg), 'settings: conflict message (' + msg + ')');
  await shot(page, path.join(OUT, 'r2a-settings-conflict.png'));
  // Esc cancels a capture; then put Y back on Ability 2 by keyboard (Enter on the selected cell)
  await cell.click();
  await page.keyboard.press('Escape');
  check((await page.textContent('.set-msg')) === 'Cancelled.', 'settings: Esc cancels');
  await cell.click();
  await page.keyboard.press('KeyY');
  await pause(80);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('flinkerton.settings.keys')));
  check(saved && saved.q[0] === 'KeyY' && saved.item3.length === 0, 'settings: persisted (q=' + (saved && saved.q) + ', item3=' + (saved && saved.item3) + ')');
  // graphics + sound buttons by mouse
  await page.click('.set-btn:nth-child(2)');
  check(await page.evaluate(() => localStorage.getItem('flinkerton.audio.muted') === '1'), 'settings: sound off stored');
  await page.click('.set-btn:nth-child(2)');
  await page.keyboard.press('Escape');                       // back to Options
  await page.waitForSelector('.opt-menu');
  await page.keyboard.press('Escape');                       // back to the title
  const ctl = await page.textContent('.title-main .controls-card');
  check(/Y/.test(ctl), 'title controls card shows the new key');
  // start a game; the in-game label and the key itself follow the binding
  await page.click('.name-input');
  await page.keyboard.type('Ada');
  await page.keyboard.press('Enter');
  await waitGame(page);
  const labels = await page.evaluate(async () => {
    const b = await import('/src/platform/bindings.js');
    const keys = [...document.querySelectorAll('#panel .aslot-key')].map((n) => n.textContent);
    return { q: b.keyLabel('q'), panel: keys };
  });
  check(labels.q === 'Y', 'keyLabel(q) is Y in game');
  if (!labels.panel.includes('Y')) warns.push('panel ability keys still ' + labels.panel.join(',') + ' (panel.js belongs to package E)');
  else check(true, 'panel shows Y');
  await page.keyboard.down('KeyY');
  await pause(120);
  const held = await page.evaluate(() => window.__game.game.input.held.q);
  await page.keyboard.up('KeyY');
  check(held === true || (await page.evaluate(() => !!window.__game.game.inputLock)), 'pressing Y holds ability slot q');
  await shot(page, path.join(OUT, 'r2a-game-rebound.png'));
  check(errors.length === 0, 'settings flow: no console errors ' + errors.join(' | '));
  await page.context().close();
}

async function teacherFlow(browser, base) {
  const page = await newPage(browser);
  const errors = collectErrors(page);
  await openTitle(page, base);
  await page.click('.name-input');
  await page.keyboard.type('Laporte');
  await page.click('.tbtn-opt');
  await page.waitForSelector('.opt-menu');
  await page.click('.opt-item:has-text("Teacher options")');
  await page.waitForSelector('.pin');
  await page.keyboard.type('1234');
  await pause(60);
  await shot(page, path.join(OUT, 'r2a-pin-wrong.png'));
  check(/Wrong/.test(await page.textContent('.pin-note')), 'PIN: wrong PIN refused');
  await pause(500);
  check((await page.$$('.pin-dot.on')).length === 0, 'PIN: cleared after a wrong try');
  // right PIN, half typed, half clicked
  await page.keyboard.type('96');
  await page.click('.pin-key[data-k="3"]');
  await page.click('.pin-key[data-k="1"]');
  await page.waitForSelector('.tch-opts', { timeout: 3000 });
  await shot(page, path.join(OUT, 'r2a-teacher-options.png'));
  // topic toggle + questions toggle are stored
  await page.click('.tch-topic[data-topic="angle_bisector"]');
  const topics = await page.evaluate(() => JSON.parse(localStorage.getItem('flinkerton.settings.topics')));
  check(Array.isArray(topics) && !topics.includes('angle_bisector') && topics.length === 7, 'teacher options: topic off stored');
  await page.click('.tch-topic[data-topic="angle_bisector"]');
  await page.click('.tch-play');                            // New teacher game
  await waitGame(page);
  let s = await state(page);
  check(s.teacher === true, 'game.teacher is true');
  check(await page.evaluate(() => !!document.querySelector('.teacher-badge')), 'TEACHER badge shown');
  const nm = await page.evaluate(() => ({ name: window.__game.game.name, shown: window.__game.game.player.name }));
  check(nm.name === 'Laporte (teacher)' && nm.shown === 'Laporte', 'teacher save name ' + JSON.stringify(nm));
  await shot(page, path.join(OUT, 'r2a-teacher-game.png'));
  // pause -> Teacher tools
  await page.keyboard.press('Escape');
  await page.waitForSelector('.pause-box');
  await pause(400);
  await shot(page, path.join(OUT, 'r2a-pause.png'));
  check(!(await page.evaluate(() => [...document.querySelectorAll('.pause-row')].some((r) => /Look/.test(r.textContent)))), 'pause: no look choice');
  await page.click('.pause-row[data-id="teacher"]');
  await page.waitForSelector('.tch-tools');
  await shot(page, path.join(OUT, 'r2a-teacher-tools.png'));
  const clickTool = (text) => page.evaluate((t) => { const b = [...document.querySelectorAll('.tch-tools .tch-btn')].find((x) => x.textContent === t); b.click(); return !!b; }, text);
  for (let i = 0; i < 11; i++) await clickTool('Level up');
  s = await state(page);
  check(s.level === 12 && s.rank === 4 && s.pendingBoons === 5, `level up to 12 (level ${s.level}, rank ${s.rank}, pending ${s.pendingBoons})`);
  await shot(page, path.join(OUT, 'r2a-teacher-l12.png'));
  for (let i = 0; i < 9; i++) await clickTool('Level down');
  s = await state(page);
  check(s.level === 3 && s.rank === 1 && s.pendingBoons === 0 && s.xp === 0, `level down to 3 (level ${s.level}, rank ${s.rank}, pending ${s.pendingBoons}, xp ${s.xp})`);
  const specs = await page.evaluate(() => [...document.querySelectorAll('.tch-tools [data-spec]')].map((b) => b.dataset.spec));
  check(specs.length === 9, '9 subclass buttons');
  for (const id of specs) {
    await page.click(`.tch-tools [data-spec="${id}"]`);
    s = await state(page);
    check(s.specId === id && s.level === 3, `subclass ${id} at level 3 (${s.classId}/${s.specId})`);
  }
  await shot(page, path.join(OUT, 'r2a-teacher-ninja.png'));
  await clickTool('Mage');
  s = await state(page);
  check(s.classId === 'mage' && !s.specId, 'class Mage, no subclass');
  // resume and watch the game a moment with the new class
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await pause(800);
  s = await state(page);
  check(!s.modal, 'back in the game');
  await shot(page, path.join(OUT, 'r2a-teacher-after.png'));
  const gameErrors = await page.evaluate(() => window.__game.errors());
  check(errors.length === 0 && gameErrors.length === 0, 'teacher flow: no console errors ' + errors.concat(gameErrors).join(' | '));
  // a reload: the PIN is remembered for this browser session only (sessionStorage); student title hides teacher saves
  await page.evaluate(() => window.__game.save());
  await openTitle(page, base);
  const contDisabled = await page.evaluate(() => document.querySelector('.tbtn-cont').disabled);
  check(contDisabled, 'student title does not offer the teacher save');
  await page.click('.tbtn-opt');
  await page.click('.opt-item:has-text("Teacher options")');
  check(!!(await page.$('.tch-opts')), 'same session: no PIN asked again');
  await page.context().close();
}

(async () => {
  const srv = await startServer();
  const browser = await launch({ webgl: true });
  try {
    await settingsFlow(browser, srv.url);
    await teacherFlow(browser, srv.url);
  } catch (e) {
    fails.push('exception: ' + (e && e.stack || e));
    console.log(e);
  } finally {
    await browser.close();
    srv.stop();
  }
  for (const w of warns) console.log('WARN', w);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
  process.exit(fails.length ? 1 : 0);
})();
