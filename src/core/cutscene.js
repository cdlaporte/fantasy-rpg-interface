// Story package: the cutscene runner (CONTRACTS section 11; authoring reference in docs/notes/story.md).
//
// A synchronous interpreter driven by update() (always: true), so cutscenes advance deterministically inside
// game.step() and keep working while modals freeze the world. Only external Promises (dialogue modals,
// pickers, gate questions, async ops) are awaited, by polling their isDone() / then-flag.
// Every blocking step has a timeout: it warns (ops.warn) and moves on, so a cutscene can never deadlock.
import { ANIM } from '../contracts.js';
import { deferred, isPromise } from './ops.js';
import { faceToward, faceDir, parseDir } from './npc.js';

const MAX_STEPS_PER_TICK = 500;
const SKIP_OPS = new Set(['fx', 'sfx', 'dialogue', 'bubble', 'wait']);
export const TIMEOUTS = {
  waitFor: 60, say: 300, op: 600, control: 180, escort: 300, moveMin: 10,
};

function ease(f) { return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; }

export default {
  id: 'cutscene',
  always: true,
  init(game) {
    const ops = game.ops;
    let run = null;
    const queue = [];
    const tut = { text: '', keys: [] };
    const tutState = { on: false, until: null };

    game.bus.on('ent:arrived', (a) => { if (a && a.ent && a.ent.data) a.ent.data.csArrived = true; });

    function warn(msg) { ops.warn('cutscene ' + (run ? run.id : '?') + ': ' + msg); }
    const frozen = () => game.freeze.size > 0;
    const paused = () => game.freeze.has('pause');

    function npcSys() { return game.sys.npc || {}; }
    function moveTo(e, x, y, o) {
      e.data.csArrived = false;
      const n = npcSys();
      if (n.moveTo) return n.moveTo(e, x, y, o);
      const ph = game.sys.physics;
      if (ph && ph.moveTo) return ph.moveTo(e, x, y, o);
      return false;
    }
    function stop(e) {
      const n = npcSys();
      if (n.stop) n.stop(e);
      else { const ph = game.sys.physics; if (ph && ph.stop) ph.stop(e); if (e.data) delete e.data.moveTo; }
    }
    function teleport(e, p) {
      stop(e);
      e.x = e.px = p.x; e.y = e.py = p.y; e.vx = 0; e.vy = 0;
      if (e === game.player && game.camera.mode === 'follow') game.snapCamera();
    }

    function markScripted(e) {
      if (!run || !e || !e.data) return;
      if (!e.data.scripted) { e.data.scripted = true; run.scripted.add(e); }
    }

    function resolveOne(who, spawnAt) {
      const ctx = run.ctx;
      let e = ops.resolveWho(who, ctx);
      if (e) return e;
      if (typeof who !== 'string' || who === 'player' || who.charCodeAt(0) === 64) return null;
      const d = game.data;
      const isNpc = d.npcs && d.npcs[who];
      const isEnemy = d.enemies && d.enemies[who];
      if (!isNpc && !isEnemy) return null;
      let p = spawnAt != null ? ops.resolvePos(spawnAt, ctx) : null;
      if (!p) p = game.world.marker(who) || game.world.marker(who + '_spawn');
      if (!p && game.player) p = { x: game.player.x, y: game.player.y - 6 };
      if (!p) return null;
      e = isNpc && npcSys().spawn ? npcSys().spawn(who, p.x, p.y) : game.ents.spawn(who, p.x, p.y);
      if (e) { e.data.cutsceneSpawned = run.id; game.fx({ type: 'poof', x: p.x, y: p.y }); }
      return e;
    }

    function setLetterbox(on) {
      on = !!on;
      if (!run || run.letterbox === on) return;
      run.letterbox = on;
      game.bus.emit('letterbox', { on });
    }

    function setTutorial(text, keys, opts) {
      if (text == null || text === false || text === '') {
        if (tutState.on) { tutState.on = false; tutState.until = null; game.bus.emit('tutorial', { text: null, keys: [] }); }
        return;
      }
      tut.text = ops.text(text, {});
      tut.keys = Array.isArray(keys) ? keys.slice() : keys != null ? [String(keys)] : [];
      tutState.on = true;
      tutState.until = opts && opts.until ? opts.until : null;
      game.bus.emit('tutorial', { text: tut.text, keys: tut.keys });
    }

    function saveCam() {
      if (run.cam) return;
      const c = game.camera;
      run.cam = { zoom: c.zoom, mode: c.mode };
    }
    function snapFollow() {
      const c = game.camera;
      if (run && run.cam) { c.zoom = run.cam.zoom; run.cam = null; }
      c.mode = 'follow';
      if (c.target == null && game.player) c.target = game.player.id;
      game.snapCamera();
    }

    /** Hand control back to the player (control / escort). */
    function release(keep) {
      run.released = run.locks;
      for (let i = 0; i < run.locks; i++) game.unlockInput();
      run.unscripted = [];
      for (const e of run.scripted) {
        if (e === keep) continue;
        if (e.data) delete e.data.scripted;
        run.unscripted.push(e);
      }
    }
    function regain() {
      for (let i = 0; i < (run.released || 0); i++) game.lockInput();
      run.released = 0;
      for (const e of run.unscripted || []) if (!e.removed && e.data && run.scripted.has(e)) e.data.scripted = true;
      run.unscripted = null;
    }

    function newThread(steps, def, id) {
      return { frames: [{ steps: Array.isArray(steps) ? steps : [], i: 0, def: def || null, id: id || null }], wait: null, done: false, d: null, id };
    }

    // ---- step execution: returns a wait object or null ----
    function exec(th, raw) {
      let step = raw;
      if (typeof step === 'string') step = [step];
      if (!Array.isArray(step) || typeof step[0] !== 'string') { warn('malformed step ' + JSON.stringify(raw)); return null; }
      const name = step[0];
      const ctx = run.ctx;
      const skipping = run.skipping;
      if (name !== 'parallel') step = ops.sub(step, ctx);
      switch (name) {
        case 'wait': {
          const s = Number(step[1]) || 0;
          return skipping || s <= 0 ? null : { kind: 'time', left: s };
        }
        case 'waitFor': {
          const o = step[2] || {};
          if (skipping || ops.test(step[1], ctx)) return null;
          return { kind: 'cond', cond: step[1], t: 0, timeout: o.timeout || TIMEOUTS.waitFor };
        }
        case 'say': {
          if (skipping) return null;
          const o = step[3] || {};
          const dlg = game.sys.dialogue;
          if (!dlg || !dlg.line) return null;
          const p = dlg.line(step[1], step[2], { mood: o.mood, name: o.name, portrait: o.portrait, ctx });
          return { kind: 'say', p, t: 0, timeout: o.timeout || TIMEOUTS.say };
        }
        case 'bubble': {
          if (skipping) return null;
          const e = resolveOne(step[1], null);
          if (!e) { warn('bubble: nobody matches ' + JSON.stringify(step[1])); return null; }
          if (npcSys().bubble) npcSys().bubble(e, step[2], step[3] || 2.5);
          return null;
        }
        case 'move': {
          const o = step[3] || {};
          const e = resolveOne(step[1], o.from || o.at);
          const dest = ops.resolvePos(step[2], ctx);
          if (!e || !dest) { warn('move: cannot resolve ' + JSON.stringify(step[1]) + ' -> ' + JSON.stringify(step[2])); return null; }
          markScripted(e);
          const fd = o.face != null ? o.face : null;
          if (skipping) { teleport(e, dest); applyFace(e, fd); return null; }
          moveTo(e, dest.x, dest.y, { speed: o.speed, run: o.run, stopAt: o.stopAt });
          if (o.wait === false) return null;
          const dx = dest.x - e.x, dy = dest.y - e.y;
          const sp = o.speed || (e.stats && e.stats.speed) || 2;
          const timeout = o.timeout || Math.max(TIMEOUTS.moveMin, (Math.sqrt(dx * dx + dy * dy) / sp) * 3 + 5);
          return { kind: 'move', e, dest, face: fd, t: 0, timeout };
        }
        case 'face': {
          const list = ops.resolveAll(step[1], ctx, []);
          for (const e of list) { markScripted(e); applyFace(e, step[2]); }
          return null;
        }
        case 'anim': {
          const list = ops.resolveAll(step[1], ctx, []);
          const a = step[2] || ANIM.IDLE;
          for (const e of list) { markScripted(e); e.anim = a; e.animT = 0; }
          const s = Number(step[3]) || 0;
          if (s <= 0) return null;
          if (skipping) { for (const e of list) if (e.anim === a) { e.anim = ANIM.IDLE; e.animT = 0; } return null; }
          return { kind: 'anim', ents: list, anim: a, left: s };
        }
        case 'camera': {
          const o = step[1] || {};
          const c = game.camera;
          saveCam();
          c.mode = 'free';
          const to = o.to != null ? ops.resolvePos(o.to, ctx) : null;
          const tx = to ? to.x : c.x, ty = to ? to.y : c.y;
          const tz = o.zoom != null ? o.zoom : c.zoom;
          if (o.shake) c.shake = Math.max(c.shake, o.shake);
          const dur = o.t != null ? o.t : 1;
          if (skipping || dur <= 0) { c.x = tx; c.y = ty; c.zoom = tz; return null; }
          const w = { kind: 'cam', fx: c.x, fy: c.y, fz: c.zoom, tx, ty, tz, t: 0, dur };
          return o.wait === false ? (run.bgCam = w, null) : w;
        }
        case 'cameraReset': {
          const o = step[1] || {};
          run.bgCam = null;
          if (game.camera.mode === 'follow' && !run.cam) return null;
          const dur = o.t != null ? o.t : 0.6;
          if (skipping || dur <= 0) { snapFollow(); return null; }
          const c = game.camera;
          return { kind: 'camReset', fx: c.x, fy: c.y, fz: c.zoom, tz: run.cam ? run.cam.zoom : 1, t: 0, dur };
        }
        case 'parallel': {
          const list = Array.isArray(step[1]) ? step[1] : [];
          const children = [];
          for (const s of list) {
            if (!Array.isArray(s) && typeof s !== 'string') continue;
            children.push(newThread(Array.isArray(s) && Array.isArray(s[0]) ? s : [s], null, null));
          }
          if (!children.length) return null;
          const w = { kind: 'parallel', children };
          for (const c of children) tickThread(c, 0);
          return w;
        }
        case 'lockInput': game.lockInput(); run.locks++; return null;
        case 'unlockInput':
          if (run.locks > 0) { game.unlockInput(); run.locks--; }
          return null;
        case 'letterbox': setLetterbox(step.length < 2 ? true : step[1]); return null;
        case 'control': {
          const o = step[1] || {};
          if (skipping) return null;
          release(null);
          const p = game.player;
          if (o.minHp != null && p) { p.data.minHp = o.minHp; run.minHp = true; }
          if (o.until && ops.test(o.until, ctx)) { regain(); return null; }
          return { kind: 'control', until: o.until || null, t: 0, timeout: o.timeout || (o.until ? TIMEOUTS.control : o.t || 10) };
        }
        case 'escort': {
          const o = step[2] || {};
          const e = resolveOne(step[1], o.from || o.at);
          const dest = ops.resolvePos(o.to, ctx);
          if (!e || !dest) { warn('escort: cannot resolve ' + JSON.stringify(step[1]) + ' -> ' + JSON.stringify(o.to)); return null; }
          markScripted(e);
          if (skipping) { finishEscort(e, dest); return null; }
          release(e);
          const w = { kind: 'escort', e, dest, walking: false, t: 0, timeout: o.timeout || TIMEOUTS.escort,
            gap: o.gap || 5, resume: o.resume || Math.min(3, o.gap || 5), say: o.say === undefined ? 'This way.' : o.say,
            bubbleT: 0, speed: o.speed, sayI: 0 };
          const p = game.player;
          const dx = p.x - e.x, dy = p.y - e.y;
          if (dx * dx + dy * dy <= w.gap * w.gap) { moveTo(e, dest.x, dest.y, { speed: w.speed }); w.walking = true; }
          return w;
        }
        case 'kill': {
          if (ops.has('kill')) {
            const r = ops.exec(step, ctx);
            return isPromise(r) ? promiseWait(r) : null;
          }
          const arg = step[1];
          const list = arg && typeof arg === 'object' && !Array.isArray(arg) && arg.tag ? ops.resolveAll('@' + arg.tag, ctx, [])
            : ops.resolveAll(arg, ctx, []);
          for (const e of list) {
            if (e === game.player) continue;
            if (game.combat && game.combat.kill) game.combat.kill(e, null);
            else game.fx({ type: 'poof', x: e.x, y: e.y });
            if (!e.removed && e.type !== 'npc') game.ents.remove(e);
          }
          return null;
        }
        case 'tutorial': setTutorial(step[1], step[2], step[3]); return null;
        case 'cutscene': {
          const def = (game.data.cutscenes || {})[step[1]];
          if (!def) { warn('unknown nested cutscene "' + step[1] + '"'); return null; }
          // integration: a `cutscene` step that is the LAST step of the main thread chains: the next cutscene
          // starts right after this one ends (own id, own skippable, own cleanup), as Narrative's content
          // assumes. An HP floor set by `control` carries over until the player is healed to full.
          const top = th.frames[th.frames.length - 1];
          if (th === run.main && th.frames.length === 1 && top && top.i >= top.steps.length) {
            if (!(def.once && game.flags['cs_' + step[1]])) {
              queue.unshift({ def, id: step[1], d: deferred(), ctx: run.ctx, carryMinHp: run.minHp && game.player ? game.player.data.minHp : null });
            }
            return null;
          }
          th.frames.push({ steps: Array.isArray(def.steps) ? def.steps : [], i: 0, def, id: step[1], nested: true });
          game.bus.emit('cutscene:start', { id: step[1], nested: true });
          return null;
        }
        default: {
          if (skipping && SKIP_OPS.has(name)) return null;
          const r = ops.exec(step, ctx);
          return isPromise(r) ? promiseWait(r) : null;
        }
      }
    }

    function promiseWait(p) {
      const w = { kind: 'promise', p, done: false, t: 0, timeout: TIMEOUTS.op };
      const ctx = run.ctx;
      p.then((v) => { if (v !== undefined) ctx.chosen = v; w.done = true; }, () => { w.done = true; });
      return w;
    }

    function applyFace(e, d) {
      if (d == null) return;
      const n = parseDir(d);
      if (n != null) { faceDir(e, n); return; }
      const p = ops.resolvePos(d, run.ctx);
      if (p) faceToward(e, p.x, p.y);
    }

    function finishEscort(e, dest) {
      teleport(e, dest);
      const p = game.player;
      if (p) {
        const dx = p.x - dest.x, dy = p.y - dest.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 2) teleport(p, d > 0 ? { x: dest.x + dx / d * 1.5, y: dest.y + dy / d * 1.5 } : { x: dest.x, y: dest.y + 1.5 });
        faceToward(e, p.x, p.y);
      }
    }

    function escortBubble(w) {
      if (!w.say || w.bubbleT > 0) return;
      const line = Array.isArray(w.say) ? w.say[w.sayI++ % w.say.length] : w.say;
      if (npcSys().bubble) npcSys().bubble(w.e, line, 2.5);
      w.bubbleT = 6;
    }

    // ---- polling: returns true when the wait is over ----
    function poll(w, dt) {
      const wdt = frozen() ? 0 : dt;
      const udt = paused() ? 0 : dt;
      const skipping = run.skipping;
      switch (w.kind) {
        case 'time':
          if (skipping) return true;
          w.left -= wdt;
          return w.left <= 0;
        case 'cond':
          if (skipping || ops.test(w.cond, run.ctx)) return true;
          w.t += wdt;
          if (w.t >= w.timeout) { warn('waitFor ' + JSON.stringify(w.cond) + ' timed out after ' + w.timeout + ' s; moving on'); return true; }
          return false;
        case 'say': {
          if (w.p.isDone && w.p.isDone()) return true;
          const dlg = game.sys.dialogue;
          if (skipping) { if (dlg && dlg.cancel) dlg.cancel(w.p); return true; }
          w.t += udt;
          if (w.t >= w.timeout) { warn('say timed out after ' + w.timeout + ' s; moving on'); if (dlg && dlg.cancel) dlg.cancel(w.p); return true; }
          return false;
        }
        case 'move': {
          const e = w.e;
          if (e.removed) return true;
          if (skipping) { teleport(e, w.dest); applyFace(e, w.face); return true; }
          if (e.data.csArrived || !e.data.moveTo) { e.data.csArrived = false; applyFace(e, w.face); return true; }
          w.t += wdt;
          if (w.t >= w.timeout) {
            warn('move of ' + (e.kind || e.id) + ' timed out after ' + Math.round(w.timeout) + ' s; teleporting');
            teleport(e, w.dest); applyFace(e, w.face);
            return true;
          }
          return false;
        }
        case 'anim':
          if (!skipping) { w.left -= wdt; if (w.left > 0) return false; }
          for (const e of w.ents) if (!e.removed && e.anim === w.anim) { e.anim = ANIM.IDLE; e.animT = 0; }
          return true;
        case 'cam': return tweenCam(w, skipping ? Infinity : wdt);
        case 'camReset': {
          const c = game.camera;
          const tgt = c.target != null ? game.ents.get(c.target) : game.player;
          w.tx = tgt ? tgt.x : c.x; w.ty = tgt ? tgt.y : c.y;
          if (tweenCam(w, skipping ? Infinity : wdt)) { snapFollow(); return true; }
          return false;
        }
        case 'parallel': {
          let all = true;
          for (const c of w.children) { if (!c.done) tickThread(c, dt); if (!c.done) all = false; }
          return all;
        }
        case 'control': {
          if (skipping || (w.until && ops.test(w.until, run.ctx))) { regain(); return true; }
          w.t += wdt;
          if (w.t >= w.timeout) {
            if (w.until) warn('control until ' + JSON.stringify(w.until) + ' timed out after ' + w.timeout + ' s; moving on');
            regain();
            return true;
          }
          return false;
        }
        case 'escort': return pollEscort(w, wdt, skipping);
        case 'promise': {
          if (w.done) return true;
          w.t += udt;
          if (w.t >= w.timeout) { warn('op still pending after ' + w.timeout + ' s; moving on'); return true; }
          return false;
        }
        default: return true;
      }
    }

    function tweenCam(w, dt) {
      const c = game.camera;
      w.t += dt;
      const f = w.dur > 0 ? Math.min(1, w.t / w.dur) : 1;
      const k = ease(f);
      c.x = w.fx + (w.tx - w.fx) * k;
      c.y = w.fy + (w.ty - w.fy) * k;
      c.zoom = w.fz + (w.tz - w.fz) * k;
      return f >= 1;
    }

    function pollEscort(w, wdt, skipping) {
      const e = w.e, p = game.player;
      if (e.removed || !p) { regain(); return true; }
      if (skipping) { finishEscort(e, w.dest); regain(); return true; }
      w.bubbleT -= wdt;
      const dx = p.x - e.x, dy = p.y - e.y, dp2 = dx * dx + dy * dy;
      const ex = w.dest.x - e.x, ey = w.dest.y - e.y;
      const atDest = ex * ex + ey * ey <= 0.7 * 0.7 || (!e.data.moveTo && e.data.csArrived);
      if (atDest) {
        if (w.walking) { w.walking = false; stop(e); }
        faceToward(e, p.x, p.y);
        if (dp2 <= w.gap * w.gap) { regain(); return true; }
        escortBubble(w);
      } else if (w.walking) {
        if (dp2 > w.gap * w.gap) {
          w.walking = false; stop(e); faceToward(e, p.x, p.y);
          w.bubbleT = 0; escortBubble(w);
        } else if (!e.data.moveTo) moveTo(e, w.dest.x, w.dest.y, { speed: w.speed });
      } else if (dp2 <= w.resume * w.resume) {
        moveTo(e, w.dest.x, w.dest.y, { speed: w.speed }); w.walking = true;
      } else {
        faceToward(e, p.x, p.y);
        escortBubble(w);
      }
      w.t += wdt;
      if (w.t >= w.timeout) {
        warn('escort timed out after ' + w.timeout + ' s; teleporting');
        finishEscort(e, w.dest); regain();
        return true;
      }
      return false;
    }

    function tickThread(th, dt) {
      let guard = 0;
      const max = run.skipping ? MAX_STEPS_PER_TICK * 20 : MAX_STEPS_PER_TICK;
      while (!th.done && run && !run.ended) {
        if (th.wait) {
          if (!poll(th.wait, dt)) return;
          th.wait = null;
          dt = 0;
        }
        const fr = th.frames[th.frames.length - 1];
        if (!fr) { th.done = true; break; }
        if (run.skipping && fr.def && fr.def.skippable === false) run.skipping = false;
        if (fr.i >= fr.steps.length) {
          th.frames.pop();
          if (fr.nested) game.bus.emit('cutscene:end', { id: fr.id, nested: true });
          continue;
        }
        if (++guard > max) { warn('more than ' + max + ' instant steps in one tick; yielding'); return; }
        const step = fr.steps[fr.i++];
        th.wait = exec(th, step);
      }
      if (th.done && th.d) {
        if (th.id && run && th !== run.main) game.bus.emit('cutscene:end', { id: th.id, nested: true });
        th.d.resolve();
        th.d = null;
      }
    }

    function tick(dt) {
      if (!run) return;
      if (run.carriedMinHp && game.player && game.player.hp >= game.player.hpMax) {
        delete game.player.data.minHp; run.carriedMinHp = false; run.minHp = false;
      }
      if (run.bgCam && tweenCam(run.bgCam, run.skipping ? Infinity : (frozen() ? 0 : dt))) run.bgCam = null;
      for (let i = 0; i < run.threads.length && run; i++) {
        const th = run.threads[i];
        if (!th.done) tickThread(th, dt);
      }
      if (!run) return;
      let all = true;
      for (const th of run.threads) if (!th.done) { all = false; break; }
      if (all) end();
    }

    function startRun(def, id, d, ctx, carryMinHp) {
      run = {
        id, def, d, ctx: Object.assign({}, ctx || {}, { cutscene: id }), threads: [], main: null, locks: 0, released: 0,
        unscripted: null, letterbox: false, scripted: new Set(), minHp: false, cam: null, bgCam: null, skipping: false,
        ended: false,
      };
      run.main = newThread(def.steps, def, id);
      run.threads.push(run.main);
      if (carryMinHp != null && game.player) { game.player.data.minHp = carryMinHp; run.minHp = true; run.carriedMinHp = true; }
      game.bus.emit('cutscene:start', { id });
      tick(0);
    }

    function end() {
      const r = run;
      if (!r || r.ended) return;
      r.ended = true;
      if (r.released) regain();
      for (let i = 0; i < r.locks; i++) game.unlockInput();
      r.locks = 0;
      if (r.letterbox) { r.letterbox = false; game.bus.emit('letterbox', { on: false }); }
      for (const e of r.scripted) if (e.data) delete e.data.scripted;
      r.scripted.clear();
      if (r.minHp && game.player) delete game.player.data.minHp;
      if (r.cam || game.camera.mode === 'free') snapFollow();
      for (const th of r.threads) {
        if (th.wait && th.wait.kind === 'say' && game.sys.dialogue.cancel) game.sys.dialogue.cancel(th.wait.p);
        if (th.d) { th.d.resolve(); th.d = null; }
      }
      run = null;
      if (r.id && typeof r.id === 'string') game.setFlag('cs_' + r.id, true);
      game.bus.emit('cutscene:end', { id: r.id });
      r.d.resolve();
      if (queue.length) {
        const q = queue.shift();
        const ctx = q.ctx ? Object.assign({}, q.ctx) : q.ctx;
        if (ctx) delete ctx.cutscene;
        startRun(q.def, q.id, q.d, ctx, q.carryMinHp);
      }
    }

    const api = {
      /** Id of the running cutscene or null. */
      get active() { return run ? run.id : null; },
      get skippable() { return !!run && run.def.skippable !== false; },
      get letterbox() { return !!run && run.letterbox; },
      get skipping() { return !!run && run.skipping; },
      get queued() { return queue.length; },
      /** Current HudState.tutorial value ({text, keys}) or null. */
      get tutorial() { return tutState.on ? tut : null; },
      /**
       * Play a cutscene by id (or def object). Resolves when it ends. While another cutscene runs it is queued,
       * unless opts.nested (an op inside the running cutscene), in which case it runs as an extra thread now.
       */
      play(idOrDef, opts = {}) {
        const id = typeof idOrDef === 'string' ? idOrDef : (idOrDef && idOrDef.id) || '(inline)';
        const def = typeof idOrDef === 'string' ? (game.data.cutscenes || {})[idOrDef] : idOrDef;
        const d = deferred();
        if (!def || typeof def !== 'object') { ops.warnOnce('cs:' + id, 'cutscene: unknown cutscene "' + id + '"'); d.resolve(); return d.promise; }
        if (def.once && game.flags['cs_' + id]) { d.resolve(); return d.promise; }
        if (run && opts.nested) {
          const th = newThread(def.steps, def, id);
          th.d = d;
          run.threads.push(th);
          game.bus.emit('cutscene:start', { id, nested: true });
          tickThread(th, 0);
          return d.promise;
        }
        if (run) { queue.push({ def, id, d, ctx: opts.ctx }); return d.promise; }
        startRun(def, id, d, opts.ctx);
        return d.promise;
      },
      /** Fast-forward the running cutscene (state-changing steps apply, waits and lines are skipped). */
      skip() {
        if (!run || run.def.skippable === false) return false;
        run.skipping = true;
        tick(0);
        return true;
      },
      /** Stop the running cutscene now (cleanup only; remaining steps are dropped). */
      stop() { if (run) end(); },
      setTutorial,
    };

    ops.register('cutscene', (g, a, ctx) => api.play(a[1], { nested: !!(ctx && ctx.cutscene && run) }));
    ops.register('tutorial', (g, a) => { setTutorial(a[1], a[2], a[3]); });
    ops.register('bubble', (g, a, ctx) => {
      const e = ops.resolveWho(a[1], ctx);
      if (e && npcSys().bubble) npcSys().bubble(e, a[2], a[3] || 2.5);
    });

    api._update = (dt) => {
      if (tutState.on && tutState.until && ops.test(tutState.until, {})) setTutorial(null);
      tick(dt);
    };
    return api;
  },
  update(game, dt) { game.cutscene._update(dt); },
  hud(game, hud) { hud.tutorial = game.cutscene.tutorial; },
};
