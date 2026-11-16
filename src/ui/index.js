// UI entry. createUI(rootEl, opts) -> {title(), mount(game, renderer), update(game), setRenderer(r), onFx(fx), dispose()}
// opts = {params, storage, config} from main.js. The UI reads game.hudState() (~10 Hz), game.modal, bus events and the
// FrameState of each rendered frame (entities + 'text' FxEvents for the overlay; captured by wrapping game.frame), and
// acts only through game.commands. See docs/notes/ui.md for the exact list.
import { el } from './dom.js';
import { createTitle } from './title.js';
import { createPanel } from './panel.js';
import { createToasts } from './toast.js';
import { createMinimap } from './minimap.js';
import { createWorldOverlay } from './worldOverlay.js';
import { createFeedback } from './feedback.js';
import { createModalHost } from './modalHost.js';
import { getAudio } from '../platform/audio.js';

const POLL_MS = 100;
const BLOCK_DEFAULT = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace']);

export function createUI(rootEl, opts = {}) {
  const params = opts.params || {};
  const config = opts.config || {};
  const doc = rootEl.ownerDocument || document;
  const $ = (id) => doc.getElementById(id);
  const panelEl = $('panel'), viewEl = $('view'), overlayEl = $('overlay'), hudEl = $('hud');
  const modalRoot = $('modal-root');

  let game = null, renderer = null;
  let panel = null, toasts = null, minimap = null, overlay = null, feedback = null, modals = null;
  let lastPoll = -1e9, hud = null, lastFrame = null;
  let quality = params.quality ?? config.defaultQuality ?? 1;
  const offs = [];
  let origFrame = null;
  let perfEl = null, perfFrames = 0, perfLast = 0, perfUi = 0;

  const sfx = (id) => { if (game && id) game.bus.emit('sfx', { id }); };

  const ctx = {
    get game() { return game; },
    sfx,
    blip: () => { const au = getAudio(); if (au) au.play('talk'); }, // UI-only voice blip, not a bus sfx id
    getHud: () => hud,
    renderer: () => renderer,
    quality: () => quality,
    setQualityLocal: (q) => { quality = q; },
    zoneName: () => (hud && hud.zoneName) || (game && game.zone && game.zone.name) || '',
    get audio() { return getAudio(); },
    params,
  };

  function openPause() {
    if (!game) return;
    game.commands.openPause();
    if (!game.modal) game.openModal({ type: 'pause' });
  }

  function openInventory() {
    if (!game) return;
    game.commands.openInventory();
    if (!game.modal && game.inventory && game.inventory.items) {
      const inv = game.inventory;
      game.openModal({ type: 'inventory', items: inv.items, cosmetics: inv.cosmetics || [], equipped: inv.equipped || {} });
    }
  }

  function canSkip() {
    const cs = game && game.cutscene;
    return !!(cs && cs.active && cs.skippable && (!game.modal || game.modal.type === 'dialogue'));
  }
  function onKey(e) {
    if (!game) return;
    // integration: Escape skips a skippable cutscene (also while one of its lines is showing)
    if (e.code === 'Escape' && !e.repeat && canSkip()) {
      e.stopPropagation(); e.preventDefault();
      if (game.commands.skipCutscene) game.commands.skipCutscene();
      return;
    }
    if (game.modal) {
      if (modals && (game.modal.type === 'question' || modals.passKeys())) return; // the provider owns the keys
      e.stopPropagation(); // keep the game's input from seeing keys that belong to the modal
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      modals && modals.sync(game);
      if ((modals && modals.key(e)) || BLOCK_DEFAULT.has(e.code)) e.preventDefault();
      return;
    }
    if (minimap && minimap.isBigOpen() && (e.code === 'Escape' || e.code === 'KeyM')) {
      e.stopPropagation(); e.preventDefault();
      if (!e.repeat) minimap.closeBig();
      return;
    }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyM') { if (minimap) minimap.toggleBig(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { e.stopPropagation(); e.preventDefault(); openPause(); return; }
    if (e.code === 'KeyB') { e.stopPropagation(); openInventory(); }
  }

  function poll(now) {
    const t0 = params.perf ? performance.now() : 0;
    hud = game.hudState();
    panel.update(hud, game, now / 1000);
    minimap.update(hud, game);
    feedback.update(hud, game);
    feedback.skippable(canSkip());
    feedback.reconcileLetterbox(game);
    modals.poll(game);
    if (params.perf) perfUi = performance.now() - t0;
  }

  function questName(id) {
    const q = game && game.data && game.data.quests && game.data.quests[id];
    return (q && q.name) || (hud && hud.quest && hud.quest.id === id ? hud.quest.name : '') || id;
  }

  const api = {
    title() {
      if (params.test || params.skipintro) {
        return Promise.resolve({ name: 'Tester', renderer: params.renderer || '2d', continueSave: null });
      }
      return createTitle({ storage: opts.storage, params, config });
    },

    mount(g, r) {
      game = g;
      renderer = r;
      panel = createPanel(panelEl, { game, onBoonNudge: () => {} });
      toasts = createToasts($('toasts'));
      minimap = createMinimap($('minimap'), ctx);
      overlay = createWorldOverlay(overlayEl, { onPromptPlaced: (pr) => feedback && feedback.setPromptFallback(pr) });
      overlay.setRenderer(r);
      feedback = createFeedback(hudEl, viewEl, ctx);
      modals = createModalHost(modalRoot, ctx);
      try { if (doc.fonts && doc.fonts.load) { doc.fonts.load('12px "Press Start 2P"'); doc.fonts.load('15px "Pixelify Sans"'); } } catch { /* ignore */ }

      // Capture each FrameState: entities for the overlay, 'text' FxEvents for floating numbers / bubbles.
      origFrame = game.frame;
      game.frame = function frameWithUi(alpha) {
        const f = origFrame.call(game, alpha);
        lastFrame = f;
        const n = f.fxCount || 0;
        for (let i = 0; i < n; i++) { const fx = f.fx[i]; if (fx.type === 'text') overlay.addText(fx); }
        return f;
      };

      const bus = game.bus;
      const on = (evt, fn) => offs.push(bus.on(evt, fn));
      on('toast', (t) => toasts.show(t && t.text, t && t.style));
      on('modal:open', () => modals.sync(game));
      on('modal:close', () => modals.sync(game));
      on('levelup', (e) => feedback.levelup(e || {}));
      on('ability:unlocked', (e) => feedback.abilityUnlocked(e || {}, game.hudState()));
      on('rank:up', (e) => { const prev = hud && hud.basic ? hud.basic.name : ''; setTimeout(() => feedback.rankUp(Object.assign({ from: prev }, e), game.hudState()), 60); });
      on('quest:started', (e) => feedback.quest('started', questName(e.id)));
      on('quest:step', (e) => feedback.quest('step', questName(e.id), stepText(e)));
      on('quest:done', (e) => feedback.quest('done', questName(e.id)));
      on('letterbox', (e) => feedback.letterbox(e && e.on));
      // integration: the dialogue modal is mutated in place per line; refresh at once instead of at the next poll
      on('dialogue:line', () => modals.poll(game));
      on('zone:transition', (e) => feedback.transition(e && e.phase));
      on('zone:load', (e) => {
        minimap.zoneChanged(game);
        overlay.clear();
        const z = e && e.zone;
        if (z) feedback.zoneCard(z.name || z.id, zoneSub(z));
      });
      on('tile:changed', (e) => minimap.tileChanged(game, e.tx, e.ty));
      on('fx:text', (fx) => overlay.addText(fx)); // optional: only if a system emits it on the bus

      // r3d notes request: a lost WebGL context falls back to the 2D look
      const onLost = () => { try { if (game.commands.setRenderer) game.commands.setRenderer('2d'); toasts.show('3D view lost, switched to 2D', 'info'); } catch { /* ignore */ } };
      viewEl.addEventListener('r3d:contextlost', onLost);
      offs.push(() => viewEl.removeEventListener('r3d:contextlost', onLost));
      window.addEventListener('keydown', onKey, true);
      if (params.perf) {
        perfEl = el('div', 'ui-perf pxfont');
        hudEl.appendChild(perfEl);
      }
      if (game.zone && !params.test) feedback.zoneCard(game.zone.name || game.zone.id, zoneSub(game.zone));
      minimap.zoneChanged(game);
      poll(performance.now());
      lastPoll = performance.now();
    },

    update(g) {
      if (!panel) return;
      if (g && g !== game) game = g;
      const now = performance.now();
      modals.sync(game);
      if (now - lastPoll >= POLL_MS) { lastPoll = now; poll(now); }
      modals.tick(now);
      feedback.tick(now, !!(game && game.modal && game.modal.type !== 'dialogue'));
      overlay.render(lastFrame, hud, now);
      if (perfEl) {
        perfFrames++;
        if (now - perfLast >= 500) {
          const fps = (perfFrames * 1000) / (now - perfLast);
          perfEl.textContent = `${fps.toFixed(0)} fps  ${(1000 / Math.max(1, fps)).toFixed(1)} ms/frame  ui ${perfUi.toFixed(2)} ms`;
          perfFrames = 0; perfLast = now;
        }
      }
    },

    setRenderer(r) { renderer = r; if (overlay) overlay.setRenderer(r); },

    /** Feed one FxEvent of type 'text' directly (alternative to the frame capture). */
    onFx(fx) { if (overlay && fx && fx.type === 'text') overlay.addText(fx); },

    /** Toggle the big map (also bound to M). */
    toggleMap() { if (minimap) minimap.toggleBig(); },

    dispose() {
      window.removeEventListener('keydown', onKey, true);
      for (const off of offs) off();
      offs.length = 0;
      if (game && origFrame) game.frame = origFrame;
      for (const p of [panel, minimap, overlay, feedback, modals]) if (p && p.dispose) p.dispose();
      if (perfEl) perfEl.remove();
      panel = null;
    },
  };

  function stepText(e) {
    const q = game && game.data && game.data.quests && game.data.quests[e.id];
    const st = q && q.steps && q.steps[e.step];
    return st ? st.text : '';
  }

  function zoneSub(z) {
    const def = z.def || {};
    const lr = def.levelRange;
    return lr && lr.length === 2 ? `Level ${lr[0]}–${lr[1]}` : '';
  }

  return api;
}

export default createUI;
