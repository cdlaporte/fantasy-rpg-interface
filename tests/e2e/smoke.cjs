// Integration smoke test (Playwright, CommonJS): for renderer=2d and renderer=3d (debug renderers for now), with
// test=1&debug=1&questions=stub:
//  1. every debug scenario returns {ok: true} with real content (screenshot each);
//  2. the first ~two minutes of a real new game (intro tutorial, ambush, rescue, town, academy, class pick), driven
//     by the in-page bot (tests/node/bot-helpers.mjs) for walking/fighting, while EVERY modal is answered by
//     keyboard as a player would (dialogue advance and choices, look picker, class picker);
//  3. the remaining modals by keyboard: shop, inventory, pause with a live 2D/3D switch, the stub question card
//     (and its answer key `1` must not also drink hotbar item 1), boon picker by Tab;
//  4. no console errors / pageerrors and an empty __game.errors(); a screenshot per milestone in tests/e2e/out/.
// Run: node tests/e2e/smoke.cjs [2d|3d]
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');
const H = require('./helpers.cjs');

const OUT = path.join(__dirname, 'out');
const only = process.argv[2];

async function modalInfo(page) {
  return page.evaluate(() => {
    const m = window.__game.game.modal;
    if (!m) return null;
    return { type: m.type, text: m.text || null, speaker: m.speaker || null, portrait: m.portrait || null,
      options: m.options ? m.options.map((o) => o.text) : null, rev: m.rev || 0 };
  });
}
async function stepPage(page, n = 1) { await page.evaluate((n) => window.__bot.step(n), n); }

/**
 * Answer the open modal by keyboard. policy(info) may return a key name to press (or null for the default).
 * Returns the info of the modal that was answered.
 */
async function answer(page, policy = () => null, log = []) {
  const info = await modalInfo(page);
  if (!info) return null;
  let key = policy(info);
  if (!key) {
    if (info.type === 'dialogue') key = info.options ? 'Digit1' : 'Enter';
    else if (info.type === 'question') key = 'Digit1';
    else if (['lookPicker', 'classPicker', 'specPicker', 'boonPicker'].includes(info.type)) key = 'Digit1';
    else key = 'Escape';
  }
  log.push(info.type + ':' + key);
  if (process.env.SMOKE_VERBOSE) console.log('      key', info.type, key, (info.text || '').slice(0, 40));
  for (let tries = 0; tries < 4; tries++) {
    await page.keyboard.press(key);
    await stepPage(page, 2);
    const now = await modalInfo(page);
    if (!now || now.type !== info.type || now.text !== info.text || now.rev !== info.rev) return info;
    if (key.startsWith('Digit') && info.type !== 'dialogue' && info.type !== 'question') key = 'Enter';   // pickers: select, then confirm
  }
  throw new Error('modal did not react to ' + key + ': ' + JSON.stringify(info));
}

/** Run a bot body in the page; answer modals by keyboard until it reports done. */
async function play(page, body, { timeout = 90, policy, until, log = [], onModal } = {}) {
  const t0 = await page.evaluate(() => window.__game.game.t);
  for (;;) {
    const r = await H.botRun(page, body, { timeout: 20 });
    if (r.done) return r;
    if (r.modal) {
      const info = await modalInfo(page);
      if (onModal) await onModal(info);
      await answer(page, policy, log);
      if (until && (await until())) return r;
      continue;
    }
    const t = await page.evaluate(() => window.__game.game.t);
    if (t - t0 > timeout) throw new Error('play timed out: ' + body.slice(0, 80) + ' | ' + r.state);
  }
}

(async () => {
  const server = await H.startServer();
  const browser = await H.launch({ webgl: true });
  // never leave a browser or server behind (shared machine): hard stop after 20 minutes
  const watchdog = setTimeout(async () => {
    console.log('WATCHDOG: smoke test took too long');
    try { await browser.close(); } catch { /* ignore */ }
    server.stop();
    process.exit(2);
  }, 20 * 60 * 1000);
  let failed = 0;
  const check = async (name, fn) => {
    const t0 = Date.now();
    try { await fn(); console.log('ok   ', name, `(${((Date.now() - t0) / 1000).toFixed(1)} s)`); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', e.stack || e.message); }
  };
  try {
    for (const renderer of ['2d', '3d']) {
      if (only && only !== renderer) continue;
      // the machine is shared and 3D is slow: give screenshots a long timeout and one retry
      const shot = async (page, name) => {
        const file = path.join(OUT, `smoke-${renderer}-${name}.png`);
        for (let i = 0; ; i++) {
          try { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: file, timeout: 90000 }); return file; } catch (e) { if (i >= 1) throw e; }
        }
      };

      await check(`debug scenarios (${renderer})`, async () => {
        const page = await H.newPage(browser);
        page.__base = server.url;
        const { errors } = await H.openGame(page, { renderer, params: { questions: 'stub' } });
        await H.attachBot(page);
        const ids = await page.evaluate(() => window.__game.scenarios());
        assert.ok(ids.length >= 10, 'scenario list');
        for (const id of ids) {
          const r = await page.evaluate((id) => window.__game.scenario(id), id);
          assert.strictEqual(r.ok, true, id + ' missing ' + JSON.stringify(r.missing));
          // let scenes play; answer lines/pickers by keyboard for a little while
          for (let i = 0; i < 40; i++) {
            await stepPage(page, 6);
            if (await modalInfo(page)) await answer(page);
          }
          await H.frames(page, 3);
          await shot(page, 'scn-' + id);
          const e = await page.evaluate(() => window.__game.errors());
          assert.deepStrictEqual(e, [], id + ': __game.errors()');
        }
        // the boss bar shows in the boss scenario
        await page.evaluate(() => window.__game.scenario('forest_boss'));
        for (let i = 0; i < 80; i++) { await stepPage(page, 6); if (await modalInfo(page)) await answer(page); }
        await page.evaluate(() => { const g = window.__game.game; const b = g.ents.find('@boss'); if (b) g.physics.teleport(g.player, b.x, b.y + 4); });
        await stepPage(page, 30);
        await page.waitForTimeout(250);
        const boss = await page.evaluate(() => window.__game.game.hudState().boss);
        assert.ok(boss && /Mossback/.test(boss.name), 'HudState.boss: ' + JSON.stringify(boss));
        assert.ok(await page.$eval('#bossbar', (n) => getComputedStyle(n).display !== 'none' && n.textContent.includes('Mossback')), '#bossbar shows Mossback');
        await shot(page, 'boss-bar');
        assert.deepStrictEqual(errors, [], 'console errors');
        assert.deepStrictEqual(await page.evaluate(() => window.__game.renderStats().unknown), [], 'renderStats().unknown after the scenarios');
        await page.close();
      });

      await check(`new game, first minutes, every modal by keyboard (${renderer})`, async () => {
        const page = await H.newPage(browser);
        page.__base = server.url;
        const { errors } = await H.openGame(page, { renderer, params: { questions: 'stub' } });
        await H.attachBot(page);
        const log = [];
        const S = (k) => shot(page, k);

        // the right renderer is really running (3D: a real WebGL context, not a software canvas fallback)
        assert.strictEqual(await page.$eval('#view canvas', (c) => c.className), 'r' + renderer, 'canvas of the ' + renderer + ' renderer');
        if (renderer === '3d') {
          const gl = await H.webglInfo(page);
          assert.ok(gl && /ANGLE|SwiftShader|WebGL|GPU|Mesa|NVIDIA|Intel|AMD/i.test(gl), 'WebGL in use: ' + gl);
          assert.strictEqual(await page.evaluate(() => !!(window.__game.renderStats().programs)), true, 'three.js programs compiled');
          console.log('      webgl:', gl);
        }
        const xp0 = await page.evaluate(() => { const s = window.__game.state(); return s.level * 1e6 + s.xp; });
        // intro: control, tutorial key caps, the stick
        await play(page, `return game.inputLock === 0 && !!game.cutscene.tutorial;`, { log });
        await H.frames(page);
        await page.waitForSelector('#tutorial .keycap', { timeout: 4000 }).catch(() => {});
        const caps = await page.$$eval('#tutorial kbd, #tutorial .key, #tutorial .keycap', (n) => n.map((x) => x.textContent));
        assert.ok(caps.join('').includes('W'), 'tutorial key caps: ' + caps);
        await S('01-intro-tutorial');
        await play(page, `await bot.walkTo('stick', {r: 0.9}); return true;`, { log });
        await stepPage(page, 6);
        await page.waitForTimeout(150);
        const prompt = await page.evaluate(() => window.__game.game.hudState().prompt);
        assert.ok(prompt && prompt.key === 'E', 'E prompt: ' + JSON.stringify(prompt));
        await S('02-stick-prompt');
        await play(page, `await bot.interact(); return !!game.flags.has_stick;`, { log });
        // rats and the giant rat
        await play(page, `await bot.walkTo('rats_1', {r: 3}); await bot.fight({kind: 'rat', until: () => game.quests.step('main_enroll') >= 3}); return true;`, { log, timeout: 120 });
        await S('03-rats');
        const ratsDone = await page.evaluate(() => window.__game.game.quests.step('main_enroll'));
        assert.ok(ratsDone >= 3, 'a rat was defeated (quest step ' + ratsDone + ')');
        const xp1 = await page.evaluate(() => { const s = window.__game.state(); return s.level * 1e6 + s.xp; });
        assert.ok(xp1 > xp0, `XP rose (${xp0} -> ${xp1})`);
        await play(page, `await bot.walkTo('rats_2', {r: 3}); await bot.fight({kind: 'rat', until: () => game.quests.step('main_enroll') >= 4});
          await bot.walkTo('big_rat', {r: 3}); await bot.fight({kind: 'giant_rat', kite: true, until: () => game.quests.step('main_enroll') >= 5}); return true;`, { log, timeout: 180 });
        // ambush: dialogue by keyboard, fight to 1 HP
        let sawMalgrim = false, sawLaporte = false;
        const onModal = async (info) => {
          if (!info || info.type !== 'dialogue') return;
          if (!sawMalgrim && /Malgrim/.test(info.speaker || '')) { sawMalgrim = true; await H.frames(page); await S('04-ambush-dialogue'); }
          if (!sawLaporte && info.portrait === 'laporte') { sawLaporte = true; await H.frames(page); await page.waitForTimeout(400); await S('05-laporte-portrait'); }
        };
        await play(page, `await bot.walkTo('clearing', {r: 1.5}); return game.cutscene.active === 'ambush' && game.inputLock === 0;`, { log, onModal });
        await S('06-ambush-fight');
        await play(page, `await bot.fight({until: () => game.cutscene.active !== 'ambush', timeout: 40}); return true;`, { log, onModal, timeout: 60 });
        // rescue: every line by keyboard; the potion by key 1 in the bot's input; the look picker by keyboard
        let pickedLook = false;
        await play(page, `return !!(game.cutscene.tutorial && /Press 1/.test(game.cutscene.tutorial.text));`, { log, onModal, timeout: 120 });
        await S('07-press-1');
        await play(page, `await bot.press('item1'); return true;`, { log });
        await play(page, `return game.flags.look_chosen === true;`, {
          log, onModal, timeout: 60,
          policy: (info) => (info.type === 'lookPicker' ? 'Digit2' : null),
          until: async () => { pickedLook = pickedLook || (await page.evaluate(() => !!window.__game.game.flags.look_chosen)); return false; },
        });
        const look = await page.evaluate(() => ({ hood: window.__game.game.player.look.hood, style: window.__game.game.player.look.outfit.style, choice: window.__game.game.flags.look_choice }));
        assert.strictEqual(look.choice, 1, 'look picker choice 2 by keyboard');
        assert.notStrictEqual(look.style, 'cloak');
        await S('08-revealed');
        // escort to town, town arrival, academy
        await play(page, `const l = game.ents.find('laporte'); if (l && game.inputLock === 0) bot.steer(l.x, l.y, 1.2); else bot.idle(); return game.zone.id === 'town';`, { log, onModal, timeout: 120 });
        await stepPage(page, 30);
        await S('09-town');
        let classPicked = false;
        await play(page, `const l = game.ents.find('laporte'); if (l && game.inputLock === 0) bot.steer(l.x, l.y, 1.2); else bot.idle(); return !!game.flags.class_chosen && !game.cutscene.active;`, {
          log, onModal, timeout: 240,
          policy: (info) => {
            if (info.type === 'classPicker') { classPicked = true; return 'Digit1'; }
            return null;
          },
          until: async () => {
            const m = await modalInfo(page);
            if (m && m.type === 'classPicker') { await H.frames(page); await S('10-class-picker'); }
            return false;
          },
        });
        assert.ok(classPicked, 'class picker answered by keyboard');
        const st = await page.evaluate(() => ({ cls: window.__game.game.progression.classId, comp: window.__game.game.companions.active.map((c) => c.kind) }));
        assert.ok(st.cls, 'class chosen');
        assert.strictEqual(st.comp.length, 2, 'two companions');
        await stepPage(page, 20);
        await S('11-free-play');
        assert.ok(log.some((l) => l.startsWith('dialogue:Digit')), 'a dialogue choice by keyboard');

        // inventory (B), assign hotbar slot by digit, close with Escape
        await page.keyboard.press('KeyB');
        await stepPage(page, 2);
        assert.strictEqual((await modalInfo(page) || {}).type, 'inventory', 'B opens the inventory');
        await H.frames(page);
        await S('12-inventory');
        await page.keyboard.press('Escape'); await stepPage(page, 2);
        assert.strictEqual(await modalInfo(page), null, 'Esc closes the inventory');

        // shop by keyboard (Granny Mira's stock): buy the first item, then leave
        await page.evaluate(() => { window.__game.giveGold(100); window.__game.game.ops.run([['shop', 'potions']]); });
        await stepPage(page, 2);
        assert.strictEqual((await modalInfo(page) || {}).type, 'shop');
        const gold0 = await page.evaluate(() => window.__game.game.inventory.gold);
        await page.keyboard.press('Enter'); await stepPage(page, 2);
        const gold1 = await page.evaluate(() => window.__game.game.inventory.gold);
        assert.ok(gold1 < gold0, `bought by keyboard (${gold0} -> ${gold1})`);
        await H.frames(page);
        await S('13-shop');
        await page.keyboard.press('Escape'); await stepPage(page, 2);
        assert.strictEqual(await modalInfo(page), null, 'Esc leaves the shop');

        // the stub question card: answered with 1; key 1 must not ALSO drink hotbar item 1 afterwards
        await page.evaluate(() => { const g = window.__game.game; g.inventory.give('potion_small', 1, { silent: true }); g.inventory.assignSlot('potion_small', 0); g.player.hp = Math.max(1, g.player.hp - 10); window.__q = g.gates.ask({ context: 'gate', difficulty: 1 }); });
        await stepPage(page, 2);
        assert.strictEqual((await modalInfo(page) || {}).type, 'question');
        await H.frames(page);
        await S('14-question-stub');
        const n0 = await page.evaluate(() => window.__game.game.inventory.count('potion_small'));
        await page.keyboard.down('Digit1'); await stepPage(page, 3); await page.keyboard.up('Digit1'); await stepPage(page, 3);
        const q = await page.evaluate(async () => { const r = await window.__q; return r; });
        assert.strictEqual(q.correct, true, 'stub answered correct with 1');
        const n1 = await page.evaluate(() => window.__game.game.inventory.count('potion_small'));
        assert.strictEqual(n1, n0, 'the answer key did not leak into gameplay (potion not drunk)');

        // pause: Esc opens, switch the look 2D <-> 3D live, back
        await page.keyboard.press('Escape'); await stepPage(page, 1);
        assert.strictEqual((await modalInfo(page) || {}).type, 'pause');
        await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
        const other = renderer === '2d' ? '3d' : '2d';
        await page.waitForFunction((id) => document.querySelector('#view canvas') && document.querySelector('#view canvas').className === 'r' + id, other, { timeout: 15000 });
        await H.frames(page, 3);
        await S('15-pause-switched');
        await page.keyboard.press('Enter');
        await page.waitForFunction((id) => document.querySelector('#view canvas').className === 'r' + id, renderer, { timeout: 15000 });
        await page.keyboard.press('Escape'); await stepPage(page, 2);
        assert.strictEqual(await modalInfo(page), null, 'pause closed');

        // boon picker by Tab at level 4 (keyboard through the game input in test mode = the bot's `boon` key)
        await page.evaluate(() => window.__game.setLevel(4));
        // Tab asks the boon-trial question first (key 1 = correct), then the picker opens (1 selects, Enter confirms)
        await play(page, `if (game.progression.boons.length >= 1) return true; await bot.press('boon'); return false;`, { log, timeout: 30, policy: (i) => (i.type === 'boonPicker' ? 'Digit1' : null) });
        const boons = await page.evaluate(() => window.__game.game.progression.boons.length);
        assert.strictEqual(boons, 1, 'boon picked by keyboard');
        await S('16-after-boon');

        const unk = await page.evaluate(() => window.__game.renderStats().unknown);
        assert.deepStrictEqual(unk, [], 'renderStats().unknown');
        const gErr = await page.evaluate(() => window.__game.errors());
        assert.deepStrictEqual(gErr, [], '__game.errors()');
        assert.deepStrictEqual(errors, [], 'console errors');
        console.log('      modal log:', [...new Set(log)].join(' '));
        await page.close();
      });
    }
  } finally {
    clearTimeout(watchdog);
    await browser.close();
    server.stop();
  }
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
