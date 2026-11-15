// Dialogue modal: portrait on the left, speaker name plate, typewriter text (E / Enter / Space completes it,
// then advances), options chosen with 1-4 or arrows + Enter, disabled options greyed with their hint.
// Payload (CONTRACTS 9): {speaker, speakerLook, portrait, mood, text, options: [{text, disabled, hint}] | null}
import { el, add, setText, show, clear, keycap } from './dom.js';
import { typewriterCount } from './format.js';
import { K, selectable, livePortrait, shake } from './modalKit.js';

const CPS = 52;

export function createDialogueBox(modal, ctx) {
  const root = el('div', 'dlg-wrap');
  const box = el('div', 'dlg px-box');
  const pFrame = el('div', 'dlg-portrait');
  const plate = el('div', 'dlg-name pxfont');
  const body = el('div', 'dlg-body');
  const textEl = el('div', 'dlg-text');
  const shown = el('span', 'dlg-shown');
  const rest = el('span', 'dlg-rest');
  add(textEl, shown, rest);
  const opts = el('div', 'dlg-options');
  const more = el('div', 'dlg-more');
  add(more, keycap('E'), el('span', 'dlg-more-arrow', '▼'));
  add(body, plate, textEl, opts, more);
  add(box, pFrame, body);
  root.appendChild(box);

  let portrait = null;
  let text = '', count = 0, t0 = 0, done = false, sel = null, cur = null;

  const last = { text: null, speaker: null, options: null };
  function setup(m) {
    cur = m;
    last.text = m.text; last.speaker = m.speaker; last.options = m.options;
    text = String(m.text || '');
    t0 = performance.now();
    count = 0;
    done = text.length === 0;
    setText(plate, m.speaker || '');
    show(plate, !!m.speaker);
    // portrait
    const look = m.portrait === 'laporte' ? 'laporte' : m.speakerLook || null;
    clear(pFrame);
    portrait = null;
    if (look) {
      portrait = livePortrait(look, m.mood || 'calm', 'academy', 'dlg-portrait-canvas');
      pFrame.appendChild(portrait.canvas);
    }
    show(pFrame, !!look);
    box.classList.toggle('no-portrait', !look);
    // options
    clear(opts);
    sel = null;
    const list = Array.isArray(m.options) ? m.options : null;
    if (list && list.length) {
      const items = list.map((o, i) => {
        const row = el('div', 'dlg-opt' + (o.disabled ? ' disabled' : ''));
        add(row, keycap(String(i + 1)), el('span', 'dlg-opt-text', o.text || ''));
        if (o.disabled && o.hint) row.appendChild(el('span', 'dlg-opt-hint', o.hint));
        opts.appendChild(row);
        return row;
      });
      sel = selectable(items, {
        layout: 'vertical', sfx: ctx.sfx,
        disabled: (i) => !!list[i].disabled,
        onPick: (i) => { if (!done) complete(); ctx.game.commands.dialogueChoose(i); },
      });
    }
    render();
  }

  function complete() { done = true; count = text.length; render(); }

  function render() {
    shown.textContent = text.slice(0, count);
    rest.textContent = text.slice(count);
    const hasOpts = !!sel;
    show(opts, hasOpts && done);
    show(more, done && !hasOpts);
  }

  setup(modal);

  return {
    el: root,
    layer: 'bottom',
    tick(now) {
      if (portrait) portrait.draw(now / 1000);
      if (done) return;
      const n = typewriterCount(text, (now - t0) / 1000, CPS);
      if (n !== count) {
        if (((n / 3) | 0) !== ((count / 3) | 0)) ctx.blip && ctx.blip();
        count = n;
        if (count >= text.length) done = true;
        render();
      }
    },
    refresh(m) {
      if (m !== cur || m.text !== last.text || m.speaker !== last.speaker || m.options !== last.options) { setup(m); return; }
      if (portrait && m.mood && m.mood !== portrait.mood) portrait.mood = m.mood;
    },
    key(e) {
      const c = e.code;
      const d = K.digit(c);
      if (sel && d) {
        if (!done) complete();
        return sel.key(e);
      }
      if (K.ok(c)) {
        if (e.repeat) return true;
        if (!done) { complete(); return true; }
        if (sel) return sel.key(e);
        ctx.sfx('ui_move');
        ctx.game.commands.dialogueAdvance();
        return true;
      }
      if (sel && done && (K.up(c) || K.down(c))) return sel.key(e);
      if (c === 'Escape' && !done) { complete(); return true; }
      if (c === 'Escape') { shake(box); return true; }
      return false;
    },
    destroy() { root.remove(); },
  };
}

export default createDialogueBox;
