// Reusable bot helpers: drive the REAL game in Node through scripted input, the same way a player would.
// Not a test file (no `.test.` in the name), imported by bot.test.mjs and usable from scratch scripts.
//
//   const bot = createBot(game);               // or newGame({name, questions: 'auto'})
//   await bot.walkTo('stick');                  // marker name, [x, y], {x, y} or an entity; A* via world.findPath
//   await bot.interact();                       // press E (one step)
//   await bot.fight({ kind: 'rat' });           // attack the nearest matching enemy until none are left
//   await bot.until(() => cond, { timeout: 30, what: 'label' });
//   await bot.say();                            // advance the current dialogue line
//   await bot.choose(/Yes/);                    // pick a dialogue option by index or text
//
// Every step lets pending promise continuations run (cutscenes and ops are promise chains), so the game
// behaves as in the browser. Time is sim time (game.t); `bot.marks` records milestone timestamps.
import { createGame } from '../../src/core/game.js';
import data from '../../src/data/index.js';
import { createQuestions } from '../../src/questions/index.js';
import { createMemoryStorage } from '../../src/platform/storage.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

export { DT };
const flush = () => new Promise((r) => setImmediate(r));
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** createGame for a new game (or a save), quiet, in test mode. */
export function newGame(opts = {}) {
  const game = createGame({
    data: opts.data || data, name: opts.name || 'Robin', seed: opts.seed ?? 7, test: true,
    storage: opts.storage || createMemoryStorage(), save: opts.save || null,
    questions: opts.questions && typeof opts.questions === 'object' ? opts.questions : createQuestions({ mode: opts.questions || 'auto' }),
    zone: opts.zone, marker: opts.marker,
  });
  game.quiet = true;
  return game;
}

export function createBot(game, opts = {}) {
  const input = scriptedInput();
  const log = opts.log || (() => {});
  const events = [];
  const bot = {
    game, input, marks: {}, events, log,
    /** Optional modal policy: (modal) => true when handled. Runs before the default policy. */
    onModal: null,
    /** Default modal handling while walking/fighting: advance plain dialogue lines (never picks options). */
    autoDialogue: true,
    stuck: 0,
  };
  for (const evt of opts.record || []) game.bus.on(evt, (p) => events.push([game.t, evt, p]));

  const pathBuf = [];
  let path = null, pathI = 0, pathGoal = null, pathT = -99;

  bot.mark = (name) => { bot.marks[name] = +game.t.toFixed(2); log(`[${game.t.toFixed(1)}s] ${name}`); return game.t; };

  bot.pos = (target) => {
    if (target == null) return null;
    if (typeof target === 'string') {
      if (game.zone.markers[target]) return game.world.marker(target);
      const e = game.ents.find ? game.ents.find(target) : null;
      return e ? { x: e.x, y: e.y } : null;
    }
    if (Array.isArray(target)) return { x: target[0], y: target[1] };
    return { x: target.x, y: target.y };
  };

  /** One sim step with the current scripted input; resolves pending promises. */
  bot.step = async (n = 1) => {
    for (let i = 0; i < n; i++) {
      game.step(DT, input.sample());
      await flush();
    }
  };
  bot.seconds = (s) => bot.step(Math.max(1, Math.round(s / DT)));
  bot.idle = () => input.set({ moveX: 0, moveY: 0, attackDir: -1 });

  bot.press = async (key) => { input.set({ pressed: { [key]: true } }); await bot.step(1); };
  bot.interact = () => bot.press('interact');

  bot.handleModal = async () => {
    const m = game.modal;
    if (!m) return false;
    if (bot.onModal && (await bot.onModal(m))) return true;
    if (bot.autoDialogue && m.type === 'dialogue' && !m.options) { game.commands.dialogueAdvance(); await bot.step(1); return true; }
    return false;
  };

  /** Step until cond() is truthy. Plain dialogue lines are advanced (autoDialogue), other modals stall. */
  bot.until = async (cond, o = {}) => {
    const timeout = o.timeout ?? 60, t0 = game.t;
    while (!cond()) {
      if (game.t - t0 > timeout) {
        throw new Error(`bot.until timed out after ${timeout}s: ${o.what || cond.toString()} | ` + bot.describe());
      }
      if (!(o.modal === false) && game.modal && (await bot.handleModal())) continue;
      if (o.each) await o.each();
      await bot.step(1);
    }
    return game.t - t0;
  };

  bot.describe = () => {
    const p = game.player, m = game.modal;
    return `zone=${game.zone && game.zone.id} p=(${p.x.toFixed(1)},${p.y.toFixed(1)}) hp=${p.hp}/${p.hpMax} lvl=${game.progression.level} ` +
      `cutscene=${game.cutscene.active} modal=${m ? m.type + (m.text ? ':' + m.text.slice(0, 50) : '') : null} lock=${game.inputLock} ` +
      `freeze=${[...game.freeze].join(',')} tut=${game.cutscene.tutorial && game.cutscene.tutorial.text}`;
  };

  /** Steer toward (x, y) along an A* path (re-planned every 0.7 s or when the goal moves). Sets input only. */
  bot.steer = (x, y, r = 0.5) => {
    const p = game.player;
    const dx0 = x - p.x, dy0 = y - p.y;
    if (dx0 * dx0 + dy0 * dy0 <= r * r) { input.set({ moveX: 0, moveY: 0 }); return true; }
    const goalMoved = !pathGoal || Math.abs(pathGoal.x - x) + Math.abs(pathGoal.y - y) > 0.75;
    if (goalMoved || game.t - pathT > 0.7 || !path) {
      const direct = game.world.walkable && game.world.walkable(p.x, p.y, x, y, p.radius * 1.05, false);
      if (direct) { path = null; } else {
        game.world.findPath(p.x, p.y, x, y, pathBuf);
        path = pathBuf; pathI = 0;
      }
      pathGoal = { x, y }; pathT = game.t;
    }
    let tx = x, ty = y;
    if (path) {
      while (pathI * 2 < path.length) {
        const wx = path[pathI * 2], wy = path[pathI * 2 + 1];
        if ((wx - p.x) ** 2 + (wy - p.y) ** 2 < 0.2) { pathI++; continue; }
        tx = wx; ty = wy; break;
      }
    }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
    input.set({ moveX: dx / d, moveY: dy / d });
    return false;
  };

  /** Walk to a marker / point / entity until within r tiles. */
  bot.walkTo = async (target, o = {}) => {
    const r = o.r ?? 0.6;
    const t0 = game.t;
    let lastX = game.player.x, lastY = game.player.y, lastT = game.t;
    await bot.until(() => {
      const q = bot.pos(target);
      if (!q) throw new Error('walkTo: cannot resolve ' + JSON.stringify(target));
      return Math.hypot(q.x - game.player.x, q.y - game.player.y) <= r;
    }, {
      timeout: o.timeout ?? 90, what: 'walkTo ' + JSON.stringify(target) + (o.what ? ' ' + o.what : ''),
      each: async () => {
        const q = bot.pos(target);
        bot.steer(q.x, q.y, r * 0.8);
        if (game.t - lastT > 2) {
          if (Math.hypot(game.player.x - lastX, game.player.y - lastY) < 0.3 && !game.modal && game.inputLock === 0) {
            bot.stuck++;
            // wiggle out of a corner
            const a = game.rng.next() * Math.PI * 2;
            input.set({ moveX: Math.cos(a), moveY: Math.sin(a) });
            await bot.step(12);
            path = null;
          }
          lastX = game.player.x; lastY = game.player.y; lastT = game.t;
        }
        if (o.each) await o.each();
      },
    });
    bot.idle();
    return game.t - t0;
  };

  const isFoe = (e, f) => e.type === 'enemy' && !e.removed && e.alive !== false && !e.asleep &&
    (!f.kind || e.kind === f.kind || (Array.isArray(f.kind) && f.kind.includes(e.kind))) &&
    (!f.tag || (e.tags && e.tags.includes(f.tag))) && !(e.data && (e.data.invulnerable || e.data.anchored && e.def && e.def.stats && e.def.stats.immortal));

  bot.nearestFoe = (f = {}) => {
    const p = game.player;
    let best = null, bd = f.within ? f.within * f.within : Infinity;
    for (const e of game.ents.all) {
      if (!isFoe(e, f)) continue;
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };

  /**
   * Attack loop: walk to the nearest matching enemy and hold the arrow key toward it. Ends when `f.until()` is
   * true, or (default) when no matching enemy is left. `f.kite`: back off while the target winds up.
   */
  bot.fight = async (f = {}) => {
    const t0 = game.t;
    const reach = f.reach ?? 0.7;
    await bot.until(() => (f.until ? f.until() : !bot.nearestFoe(f)), {
      timeout: f.timeout ?? 120, what: 'fight ' + JSON.stringify({ kind: f.kind, tag: f.tag }),
      each: async () => {
        const e = bot.nearestFoe(f);
        const p = game.player;
        if (!e) { if (f.idleTo) bot.steer(...f.idleTo); else bot.idle(); return; }
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        const winding = e.anim === 'charge';
        if (f.kite && winding && d < 2.5) {
          // step sideways out of a telegraphed attack
          const v = DIRS[(dir + 1) % 4];
          input.set({ moveX: v[0], moveY: v[1], attackDir: -1 });
          return;
        }
        if (d > reach + (e.radius || 0.3)) { bot.steer(e.x, e.y, reach * 0.6); input.set({ attackDir: d < reach + 1.2 ? dir : -1 }); }
        else input.set({ moveX: 0, moveY: 0, attackDir: dir });
      },
    });
    bot.idle();
    return game.t - t0;
  };

  /** Dialogue: wait for a line (optionally matching re), then advance it. */
  bot.say = async (re, o = {}) => {
    await bot.until(() => game.modal && game.modal.type === 'dialogue' && (!re || re.test(game.modal.text)), { modal: false, timeout: o.timeout ?? 60, what: 'dialogue ' + re });
    const text = game.modal.text;
    if (!game.modal.options) { game.commands.dialogueAdvance(); await bot.step(1); }
    return text;
  };
  /** Advance every plain line until a modal of `type` (or options) shows. */
  bot.waitModal = async (type, o = {}) => {
    await bot.until(() => game.modal && (game.modal.type === type || (type === 'options' && game.modal.type === 'dialogue' && game.modal.options)), { timeout: o.timeout ?? 60, what: 'modal ' + type });
    return game.modal;
  };
  bot.choose = async (which) => {
    const m = await bot.waitModal('options');
    let i = which;
    if (which instanceof RegExp) i = m.options.findIndex((o) => which.test(o.text) && !o.disabled);
    if (i < 0) throw new Error('choose: no option ' + which + ' in ' + JSON.stringify(m.options.map((o) => o.text)));
    const text = m.options[i].text;
    game.commands.dialogueChoose(i);
    await bot.step(1);
    return text;
  };

  /** Advance dialogue lines until no modal is open (does not pick options). */
  bot.finishDialogue = async (o = {}) => bot.until(() => !game.modal, { timeout: o.timeout ?? 60, what: 'dialogue to close' });

  bot.questStep = (id) => (game.quests.state(id) === 'active' ? game.quests.step(id) : game.quests.state(id));
  return bot;
}
