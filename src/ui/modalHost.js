// Mirrors game.modal into the DOM (#modal-root). One modal at a time; keyboard is routed here while it is open.
// Each modal factory returns {el, layer: 'bottom'|'center', dim?, passKeys?, key(e) -> handled, tick?(now),
// refresh?(modal), state?() -> carried to the next instance of the same type, attached?(), destroy()}.
import { el } from './dom.js';
import { createDialogueBox } from './dialogueBox.js';
import { createShopUI } from './shopUI.js';
import { createInventoryUI } from './inventoryUI.js';
import { createLookPicker, createClassPicker, createSpecPicker, createBoonPicker } from './pickers.js';
import { createQuestionModal, createLessonModal } from './questionModal.js';
import { createPauseMenu } from './pauseMenu.js';

export const MODAL_FACTORIES = {
  dialogue: createDialogueBox,
  shop: createShopUI,
  inventory: createInventoryUI,
  lookPicker: createLookPicker,
  classPicker: createClassPicker,
  specPicker: createSpecPicker,
  boonPicker: createBoonPicker,
  question: createQuestionModal,
  lesson: createLessonModal,
  pause: createPauseMenu,
};

export function createModalHost(root, ctx) {
  const layer = el('div', 'modal-layer');
  layer.hidden = true;
  root.appendChild(layer);
  let cur = null; // {modal, type, inst}
  const carry = {}; // type -> state from the previous instance

  function close() {
    if (!cur) return;
    try { if (cur.inst.state) carry[cur.type] = cur.inst.state(); } catch { /* ignore */ }
    try { cur.inst.destroy(); } catch (e) { console.warn('[ui] modal destroy', e); }
    cur = null;
    layer.hidden = true;
    layer.className = 'modal-layer';
  }

  function open(modal) {
    const type = modal.type;
    const f = MODAL_FACTORIES[type];
    if (!f) { console.warn('[ui] unknown modal type', type); cur = { modal, type, inst: { el: el('div'), key: () => false, destroy() {} } }; return; }
    let inst;
    try { inst = f(modal, ctx, carry[type] || null); } catch (e) {
      console.warn('[ui] modal failed to open', type, e);
      inst = { el: el('div'), key: () => false, destroy() {} };
    }
    cur = { modal, type, inst };
    layer.className = 'modal-layer layer-' + (inst.layer || 'center') + (inst.dim ? ' dim' : '') + ' type-' + type;
    layer.appendChild(inst.el);
    layer.hidden = false;
    if (inst.attached) inst.attached();
    if (inst.tick) inst.tick(performance.now());
  }

  return {
    /** Reconcile with game.modal (cheap; call every frame). */
    sync(game) {
      const m = game.modal;
      if (cur && cur.modal === m) return;
      if (cur && m && cur.type === m.type && cur.inst.refresh && m.type !== 'question') {
        // same type replaced by a new object (e.g. the next dialogue line): refresh in place
        cur.modal = m;
        cur.inst.refresh(m);
        return;
      }
      close();
      if (m) open(m);
    },
    /** Called at ~10 Hz so modals can pick up in-place payload changes. */
    poll(game) { if (cur && game.modal === cur.modal && cur.inst.refresh) cur.inst.refresh(game.modal); },
    tick(now) { if (cur && cur.inst.tick) cur.inst.tick(now); },
    /** Keyboard while a modal is open. Returns true when handled. */
    key(e) { return cur ? !!cur.inst.key(e) : false; },
    passKeys() { return !!(cur && cur.inst.passKeys); },
    get type() { return cur ? cur.type : null; },
    close,
    dispose() { close(); layer.remove(); },
  };
}

export default createModalHost;
