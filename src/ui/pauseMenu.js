// Pause modal ({}): Resume, look of the game (2D / 3D), quality, sound, save, controls, quit to title.
// Commands: closeModal(), setRenderer(id), setQuality(q), saveNow(), quitToTitle().
import { el, add, setText, clear } from './dom.js';
import { iconCanvas } from './icons.js';
import { K, selectable, hints, controlsCard } from './modalKit.js';

const QUALITY = ['Low', 'Medium', 'High'];

export function createPauseMenu(modal, ctx) {
  const game = ctx.game;
  const root = el('div', 'pause');
  const box = el('div', 'pause-box px-box');
  const title = el('div', 'pause-title pxfont', 'PAUSED');
  const sub = el('div', 'pause-sub');
  sub.textContent = `${game.name || ''}${ctx.zoneName ? '  ·  ' + ctx.zoneName() : ''}`;
  const menu = el('div', 'pause-menu');
  const side = el('div', 'pause-side');
  const confirmQuit = { armed: false };

  const items = [
    { id: 'resume', icon: 'up', label: () => 'Resume' },
    { id: 'look', icon: 'star', label: () => `Look: ${rendererId() === '3d' ? '3D Toy Box' : '2D Pixel'}`, cycle: true },
    { id: 'quality', icon: 'rune', label: () => `Quality: ${QUALITY[ctx.quality()] || 'Medium'}`, cycle: true },
    { id: 'sound', icon: 'bolt', label: () => `Sound: ${ctx.audio && ctx.audio.isMuted && ctx.audio.isMuted() ? 'Off' : 'On'}`, cycle: true },
    { id: 'save', icon: 'book', label: () => 'Save game' },
    { id: 'controls', icon: 'key', label: () => 'Controls' },
    { id: 'quit', icon: 'cloak', label: () => (confirmQuit.armed ? 'Really quit? Enter again' : 'Quit to title') },
  ];
  function rendererId() { const r = ctx.renderer && ctx.renderer(); return r ? r.id : '2d'; }

  const rows = items.map((it) => {
    const r = el('div', 'pause-row');
    const lab = el('span', 'pause-label');
    add(r, iconCanvas(it.icon, 'icon-md'), lab);
    if (it.cycle) r.appendChild(el('span', 'pause-cycle pxfont', '◀ ▶'));
    it.labEl = lab;
    menu.appendChild(r);
    return r;
  });
  const renderLabels = () => items.forEach((it) => setText(it.labEl, it.label()));
  renderLabels();

  const note = el('div', 'pause-note');
  function flash(text) { setText(note, text); note.classList.remove('pop'); void note.offsetWidth; note.classList.add('pop'); }

  function act(i, dir = 1) {
    const it = items[i];
    if (it.id !== 'quit') confirmQuit.armed = false;
    switch (it.id) {
      case 'resume': game.commands.closeModal(); return;
      case 'look': {
        const next = rendererId() === '3d' ? '2d' : '3d';
        const p = game.commands.setRenderer(next);
        flash(next === '3d' ? 'Switching to the 3D Toy Box…' : 'Switching to 2D Pixel…');
        if (p && p.then) p.then(() => { renderLabels(); flash('Look changed!'); }).catch(() => flash('That look is not available here.'));
        break;
      }
      case 'quality': {
        const q = (ctx.quality() + (dir > 0 ? 1 : 2)) % 3;
        game.commands.setQuality(q);
        ctx.setQualityLocal(q);
        break;
      }
      case 'sound':
        if (ctx.audio && ctx.audio.toggleMute) ctx.audio.toggleMute();
        break;
      case 'save':
        game.commands.saveNow();
        flash('Game saved!');
        break;
      case 'controls':
        showControls(!controlsOpen);
        break;
      case 'quit':
        if (!confirmQuit.armed) { confirmQuit.armed = true; break; }
        game.commands.quitToTitle();
        break;
      default: break;
    }
    renderLabels();
  }

  let controlsOpen = false;
  function showControls(on) {
    controlsOpen = on;
    clear(side);
    if (on) side.appendChild(controlsCard());
    root.classList.toggle('with-controls', on);
  }

  const left = el('div', 'pause-left');
  add(left, title, sub, menu, note, hints([['↑', '↓', 'Choose'], ['Enter', 'OK'], ['Esc', 'Resume']]));
  add(box, left);
  add(root, box, side);

  const sel = selectable(rows, { layout: 'vertical', sfx: ctx.sfx, digits: false, onPick: (i) => act(i, 1) });

  return {
    el: root, layer: 'center', dim: true,
    key(e) {
      const c = e.code;
      if (c === 'Escape' || c === 'KeyP') {
        if (e.repeat) return true;
        if (controlsOpen) { showControls(false); return true; }
        ctx.sfx('ui_move');
        game.commands.closeModal();
        return true;
      }
      if ((K.left(c) || K.right(c)) && items[sel.index].cycle) { if (!e.repeat) { ctx.sfx('ui_move'); act(sel.index, K.right(c) ? 1 : -1); } return true; }
      if (K.up(c) || K.down(c)) { confirmQuit.armed = false; renderLabels(); }
      return sel.key(e);
    },
    destroy() { root.remove(); },
  };
}

export default createPauseMenu;
