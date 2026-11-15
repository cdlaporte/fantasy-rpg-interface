// STUB: replaced by the UI package
// createUI(rootEl, opts?) -> {title(), mount(game, renderer), update(game), setRenderer(r), dispose()}
// opts (added): {params, storage, config} from main.js. title() resolves {name, renderer, continueSave}.
import { createPanel } from './panel.js';
import { createToasts } from './toast.js';

export function createUI(rootEl, opts = {}) {
  const params = opts.params || {};
  const panelEl = rootEl.querySelector('#panel');
  let panel = null, toasts = null, lastPoll = -1;
  return {
    title() {
      const def = params.renderer || '2d';
      if (params.test || params.skipintro) return Promise.resolve({ name: 'Tester', renderer: def, continueSave: null });
      return new Promise((resolve) => {
        let renderer = def;
        const wrap = document.createElement('div');
        wrap.className = 'title-screen';
        const card = document.createElement('div');
        card.className = 'title-card';
        const h = document.createElement('h1'); h.textContent = 'Flinkerton Academy';
        const name = document.createElement('input');
        name.maxLength = (opts.config && opts.config.nameMaxLength) || 12; name.placeholder = 'Your name'; name.value = '';
        const row = document.createElement('div'); row.className = 'row';
        const b2 = document.createElement('button'); b2.textContent = '2D look';
        const b3 = document.createElement('button'); b3.textContent = '3D look';
        const mark = () => { b2.classList.toggle('on', renderer === '2d'); b3.classList.toggle('on', renderer === '3d'); };
        b2.onclick = () => { renderer = '2d'; mark(); }; b3.onclick = () => { renderer = '3d'; mark(); };
        row.append(b2, b3); mark();
        const start = document.createElement('button'); start.textContent = 'Start';
        const go = () => { wrap.remove(); resolve({ name: name.value.trim() || 'Hero', renderer, continueSave: null }); };
        start.onclick = go;
        name.addEventListener('keydown', (e) => { if (e.code === 'Enter') go(); });
        card.append(h, name, row, start); wrap.appendChild(card); document.body.appendChild(wrap);
        name.focus();
      });
    },
    mount(game) {
      panel = createPanel(panelEl);
      toasts = createToasts(rootEl.querySelector('#toasts'));
      game.bus.on('toast', (t) => toasts.show(t.text, t.style));
    },
    update(game) {
      if (!panel) return;
      const now = performance.now();
      if (now - lastPoll < 100) return; // ~10 Hz
      lastPoll = now;
      panel.update(game.hudState(), game);
    },
    setRenderer() {},
    dispose() { if (panel) panel.dispose(); },
  };
}

export default createUI;
