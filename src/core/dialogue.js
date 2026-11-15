// Story package: the dialogue engine (CONTRACTS sections 9 and 11; authoring reference in docs/notes/story.md).
//
// Dialogue def: {start, who?, nodes: {id: {say: [{who, mood, text, if}], do, options: [{text, if, hint, do, goto, end}],
//   after, goto, end}}}. Drives game.modal {type: 'dialogue', speaker, speakerLook, portrait, mood, text, options}
// through the commands dialogueAdvance() / dialogueChoose(i). The modal object is opened once per conversation
// and mutated in place for each line: listen for 'dialogue:line' (or watch modal.rev) to re-render.
import { deferred, isPromise } from './ops.js';
import { faceToward } from './npc.js';

function normLines(say) {
  if (say == null) return [];
  if (typeof say === 'string') return [{ text: say }];
  if (!Array.isArray(say)) return [say];
  return say.map((l) => (typeof l === 'string' ? { text: l } : l)).filter(Boolean);
}

export default {
  id: 'dialogue',
  always: true,
  init(game) {
    const ops = game.ops;
    const stack = [];     // active conversations (top = the one on screen); deeper ones are waiting on ops
    const queue = [];     // conversations opened while another was showing a line

    /** Speaker identity for a `who`: {name, look, portrait, ent}. */
    function speakerOf(who, conv) {
      const out = { name: '', look: null, portrait: null, ent: null };
      if (who == null || who === '' || who === 'narrator') return out;
      const ctx = conv ? conv.ctx : null;
      if (who === 'player') {
        const p = game.player;
        out.name = ops.playerName(); out.look = p ? p.look : null; out.ent = p;
        return out;
      }
      let e = null;
      if (typeof who === 'object' || typeof who === 'number' || who === 'self' || who === '$self' || who === 'npc'
        || (typeof who === 'string' && who.charCodeAt(0) === 64)) e = ops.resolveWho(who, ctx);
      else if (conv && conv.npc && (conv.npc.kind === who || (conv.npc.data && conv.npc.data.npcId === who))) e = conv.npc;
      else e = ops.resolveWho(who, ctx);
      const id = typeof who === 'string' && who.charCodeAt(0) !== 64 && who !== 'self' && who !== '$self' && who !== 'npc'
        ? who : e ? (e.data && e.data.npcId) || e.kind : null;
      const d = game.data;
      const def = (id && ((d.npcs && d.npcs[id]) || (d.enemies && d.enemies[id]))) || (e && e.def) || null;
      out.ent = e;
      out.name = (e && e.name) || (def && def.name) || (typeof who === 'string' ? who.replace(/^@/, '') : '');
      out.look = (e && e.look) || (def && def.look) || null;
      const isLaporte = id === 'laporte' || (def && def.portrait === 'laporte') || (out.look && out.look.hero === 'laporte');
      out.portrait = isLaporte ? 'laporte' : (def && def.portrait) || null;
      if (out.portrait !== 'laporte' && out.portrait !== null && typeof out.portrait !== 'string') out.portrait = null;
      return out;
    }

    function resolveGoto(g, ctx) {
      if (g == null) return null;
      if (typeof g === 'string') return g;
      if (Array.isArray(g)) {
        for (const c of g) {
          if (typeof c === 'string') return c;
          if (c && typeof c === 'object' && ops.test(c.if, ctx)) return c.to || c.goto || null;
        }
        return null;
      }
      if (typeof g === 'object') return ops.test(g.if, ctx) ? g.to || g.goto || null : null;
      return null;
    }

    function normDef(def) {
      if (!def || typeof def !== 'object') return null;
      if (def.nodes && typeof def.nodes === 'object') return def;
      if (def.say || def.options) return { id: def.id, who: def.who, start: 'start', nodes: { start: def } };
      return null;
    }

    function makeConv(def, id, opts) {
      const ctx = Object.assign({}, opts.ctx || {});
      if (opts.npc) { ctx.self = opts.npc; ctx.npc = opts.npc; }
      ctx.dialogue = id;
      return {
        id, def, npc: opts.npc || null, ctx, d: deferred(), nodeId: null, node: null, lines: [], li: 0,
        shown: null, busy: false, closed: false, external: false, waitModal: false, closing: false, faced: false,
        modal: null, single: !!opts.single, t: 0,
      };
    }

    function begin(conv) {
      stack.push(conv);
      conv.modal = {
        type: 'dialogue', id: conv.id, node: null, speaker: '', speakerLook: null, portrait: null, mood: 'calm', text: '',
        options: null, rev: 0, who: null,
        onClose: () => {
          if (conv.closing || conv.closed) return;
          conv.external = true;      // closed by someone else (Escape, or replaced by another modal)
        },
      };
      const npc = conv.npc;
      const p = game.player;
      if (npc && !npc.removed) {
        if (game.npc && game.npc.stop && !npc.data.scripted) game.npc.stop(npc);
        npc.data.talking = (npc.data.talking || 0) + 1;
        if (p) { faceToward(npc, p.x, p.y); faceToward(p, npc.x, npc.y); }
        conv.faced = true;
      }
      game.bus.emit('dialogue:open', { id: conv.id, npc });
      const start = resolveGoto(conv.def.start, conv.ctx) || Object.keys(conv.def.nodes)[0];
      enter(conv, start);
    }

    function enter(conv, nodeId) {
      if (conv.closed) return;
      const node = conv.def.nodes[nodeId];
      if (!node) {
        ops.warnOnce('dlg:node:' + conv.id + ':' + nodeId, 'dialogue ' + conv.id + ': unknown node "' + nodeId + '" (conversation ends)');
        finish(conv);
        return;
      }
      conv.nodeId = nodeId; conv.node = node;
      conv.lines = normLines(node.say).filter((l) => !l.if || ops.test(l.if, conv.ctx));
      conv.li = 0;
      runOps(conv, node.do, () => show(conv, 0));
    }

    function visibleOptions(conv) {
      const list = conv.node.options;
      if (!Array.isArray(list) || !list.length) return null;
      const out = [];
      for (const o of list) {
        if (!o) continue;
        const ok = !o.if || ops.test(o.if, conv.ctx);
        if (!ok && !o.hint) continue;
        out.push({ opt: o, text: ops.text(o.text, conv.ctx), disabled: !ok, hint: ok ? null : ops.text(o.hint, conv.ctx) });
      }
      return out.length ? out : null;
    }

    function show(conv, i) {
      if (conv.closed) return;
      const lines = conv.lines;
      const opts = i >= lines.length - 1 ? visibleOptions(conv) : null;
      if (i >= lines.length && !opts) { afterLines(conv); return; }
      conv.li = i;
      const line = lines[i] || lines[lines.length - 1] || { text: '' };
      const who = line.who !== undefined ? line.who : conv.node.who !== undefined ? conv.node.who
        : conv.def.who !== undefined ? conv.def.who : conv.npc || null;
      const sp = speakerOf(who, conv);
      const m = conv.modal;
      m.node = conv.nodeId;
      m.who = typeof who === 'string' ? who : sp.ent ? sp.ent.kind : null;
      m.speaker = line.name ? ops.text(line.name, conv.ctx) : sp.name;
      m.speakerLook = sp.look;
      m.portrait = line.portrait !== undefined ? line.portrait : sp.portrait;
      m.mood = line.mood || conv.node.mood || 'calm';
      m.text = i < lines.length ? ops.text(line.text, conv.ctx) : '';
      conv.shown = opts;
      m.options = opts ? opts.map((o) => ({ text: o.text, disabled: o.disabled, hint: o.hint })) : null;
      m.rev++;
      conv.t = 0;
      if (!ensureModal(conv)) return;
      game.bus.emit('dialogue:line', { speaker: m.speaker, text: m.text, who: m.who, id: conv.id, node: conv.nodeId, options: m.options });
    }

    /** Make sure our modal is the open one. Returns false when another modal is open (we wait for it). */
    function ensureModal(conv) {
      if (game.modal === conv.modal) { conv.external = false; return true; }
      if (game.modal) {
        // Another of our conversations (waiting on ops that opened this one): take over its modal.
        let owner = null;
        for (const c of stack) if (c !== conv && c.modal === game.modal) owner = c;
        if (!owner) { conv.waitModal = true; return false; }
        owner.closing = true;
        game.openModal(conv.modal);
        owner.closing = false;
        conv.external = false; conv.waitModal = false;
        return true;
      }
      conv.external = false; conv.waitModal = false;
      game.openModal(conv.modal);
      return true;
    }

    function runOps(conv, list, next) {
      if (!list || !list.length) { next(); return; }
      conv.busy = true;
      const r = ops.run(list, conv.ctx);
      if (isPromise(r)) {
        r.then(() => { conv.busy = false; if (!conv.closed) next(); });
      } else {
        conv.busy = false;
        next();
      }
    }

    function afterLines(conv) {
      const node = conv.node;
      runOps(conv, node.after, () => go(conv, node.goto, node.end));
    }

    function go(conv, g, end) {
      if (conv.closed) return;
      const to = end ? null : resolveGoto(g, conv.ctx);
      if (!to) { finish(conv); return; }
      enter(conv, to);
    }

    function finish(conv) {
      if (conv.closed) return;
      conv.closed = true;
      if (game.modal === conv.modal) { conv.closing = true; game.closeModal(); conv.closing = false; }
      const npc = conv.npc;
      if (npc && conv.faced) {
        npc.data.talking = Math.max(0, (npc.data.talking || 1) - 1);
        if (!npc.data.talking) delete npc.data.talking;
      }
      const i = stack.indexOf(conv);
      if (i >= 0) stack.splice(i, 1);
      game.bus.emit('dialogue:close', { id: conv.id, npc, node: conv.nodeId });
      conv.d.resolve(conv.ctx.chosen);
      if (!stack.length && queue.length) begin(queue.shift());
    }

    function top() { return stack.length ? stack[stack.length - 1] : null; }

    function advance() {
      const c = top();
      if (!c || c.busy || c.closed || c.waitModal) return false;
      if (c.shown) return false;                  // options are showing: choose one
      if (c.li < c.lines.length - 1) { show(c, c.li + 1); return true; }
      afterLines(c);
      return true;
    }

    function choose(i) {
      const c = top();
      if (!c || c.busy || c.closed || c.waitModal || !c.shown) return false;
      const o = c.shown[i];
      if (!o) return false;
      if (o.disabled) { game.bus.emit('sfx', { id: 'ui_bad' }); return false; }
      c.ctx.choice = i;
      c.shown = null;
      game.bus.emit('dialogue:choice', { id: c.id, node: c.nodeId, index: i, text: o.text });
      const opt = o.opt;
      runOps(c, c.node.after, () => runOps(c, opt.do, () => go(c, opt.goto, opt.end)));
      return true;
    }

    const api = {
      /** The conversation on screen: {id, node, npc} or null. */
      get active() { const c = top(); return c ? { id: c.id, node: c.nodeId, npc: c.npc } : null; },
      get busy() { return stack.length > 0 || queue.length > 0; },
      /**
       * Open a dialogue by id (or a def object). opts {npc: entity, ctx}. Returns a Promise resolving when the
       * conversation closes (with ctx.chosen). The Promise has isDone() for synchronous polling.
       */
      open(idOrDef, opts = {}) {
        const id = typeof idOrDef === 'string' ? idOrDef : (idOrDef && idOrDef.id) || '(inline)';
        const raw = typeof idOrDef === 'string' ? (game.data.dialogues || {})[idOrDef] : idOrDef;
        const def = normDef(raw);
        if (!def) {
          ops.warnOnce('dlg:' + id, 'dialogue: unknown or empty dialogue "' + id + '"');
          const d = deferred(); d.resolve(); return d.promise;
        }
        if (opts.npc != null && typeof opts.npc !== 'object') opts = Object.assign({}, opts, { npc: ops.resolveWho(opts.npc, opts.ctx) });
        const conv = makeConv(def, id, opts);
        const t = top();
        if (!t || t.busy) begin(conv);       // nothing showing, or opened from inside another one's ops
        else queue.push(conv);
        return conv.d.promise;
      },
      /** One blocking line (cutscene `say`): resolves when advanced. */
      line(who, text, opts = {}) {
        const def = { id: '(say)', start: 'l', nodes: { l: { say: [{ who, text, mood: opts.mood, name: opts.name, portrait: opts.portrait }] } } };
        return api.open(def, { ctx: opts.ctx, single: true });
      },
      /** Close a conversation (or the one on screen) without running anything further. */
      cancel(promise) {
        for (const c of stack.concat(queue)) {
          if (!promise || c.d.promise === promise) {
            const qi = queue.indexOf(c);
            if (qi >= 0) { queue.splice(qi, 1); c.closed = true; c.d.resolve(); continue; }
            finish(c);
            if (promise) return;
          }
        }
      },
      advance, choose, speakerOf,
    };

    game.commands.dialogueAdvance = () => advance();
    game.commands.dialogueChoose = (i) => choose(i);

    ops.register('dialogue', (g, a, ctx) => {
      const o = a[2] && typeof a[2] === 'object' ? a[2] : {};
      let npc = o.npc != null ? ops.resolveWho(o.npc, ctx) : ctx && (ctx.self || ctx.npc) || null;
      if (npc && npc.type === 'player') npc = null;
      return api.open(a[1], { npc, ctx: { chosen: ctx ? ctx.chosen : undefined, cutscene: ctx ? ctx.cutscene : undefined } });
    });

    api._update = (dt) => {
      const c = top();
      if (!c) return;
      if (c.busy) return;
      if (c.external) {
        c.external = false;
        if (!game.modal) { finish(c); return; }
        c.waitModal = true;
      }
      if (c.waitModal && !game.modal) {
        c.waitModal = false;
        if (ensureModal(c)) {
          const m = c.modal;
          game.bus.emit('dialogue:line', { speaker: m.speaker, text: m.text, who: m.who, id: c.id, node: c.nodeId, options: m.options });
        }
      }
      c.t += dt;
    };
    return api;
  },
  update(game, dt) { game.dialogue._update(dt); },
};
