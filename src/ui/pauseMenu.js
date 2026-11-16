// Pause modal ({}): Resume, Settings (keys, sound, graphics), Graphics and Sound (quick cycles), Save, Controls,
// Teacher tools (teacher games only), Quit to title. Round 2: the 2D/3D look choice is gone (3D only; 2D is an automatic fallback).
// Commands: closeModal(), setQuality(q), saveNow(), quitToTitle().
import { el, add, setText, clear } from './dom.js';
import { iconCanvas } from './icons.js';
import { K, selectable, hints, controlsCard } from './modalKit.js';
import { createSettings, QUALITY_NAMES, QUALITY_KEY } from './settings.js';
import { createTeacherTools } from './teacher.js';

export function createPauseMenu(modal, ctx) {
  const game = ctx.game;
  const root = el('div', 'pause');
  const box = el('div', 'pause-box px-box');
  const title = el('div', 'pause-title pxfont', 'PAUSED');
  const sub = el('div', 'pause-sub');
  sub.textContent = `${(game.player && game.player.name) || game.name || ''}${ctx.zoneName ? '  ·  ' + ctx.zoneName() : ''}`;
  const menu = el('div', 'pause-menu');
  const side = el('div', 'pause-side');
  const confirmQuit = { armed: false };
  const muted = () => !!(ctx.audio && ctx.audio.isMuted && ctx.audio.isMuted());

  const items = [
    { id: 'resume', icon: 'up', label: () => 'Resume' },
    { id: 'settings', icon: 'key', label: () => 'Settings (keys, sound, graphics)' },
    { id: 'quality', icon: 'orb', label: () => `Graphics: ${QUALITY_NAMES[ctx.quality()] || 'Medium'}`, cycle: true },
    { id: 'sound', icon: 'bolt', label: () => `Sound: ${muted() ? 'Off' : 'On'}`, cycle: true },
    { id: 'save', icon: 'book', label: () => 'Save game' },
    { id: 'controls', icon: 'rune', label: () => 'Controls' },
    game.teacher === true ? { id: 'teacher', icon: 'star', label: () => 'Teacher tools' } : null,
    { id: 'quit', icon: 'cloak', label: () => (confirmQuit.armed ? 'Really quit? Enter again' : 'Quit to title') },
  ].filter(Boolean);

  const rows = items.map((it) => {
    const r = el('div', 'pause-row');
    r.dataset.id = it.id;
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

  // ---- sub-screens (settings, teacher tools) replace the pause box until closed
  let subScreen = null;
  function openSub(make) {
    closeSub();
    showControls(false);
    box.hidden = true;
    subScreen = make();
    root.appendChild(subScreen.el);
    root.classList.add('with-sub');
  }
  function closeSub() {
    if (!subScreen) return;
    try { subScreen.destroy(); } catch { /* ignore */ }
    subScreen = null;
    box.hidden = false;
    root.classList.remove('with-sub');
    renderLabels();
  }

  function act(i, dir = 1) {
    const it = items[i];
    if (it.id !== 'quit') confirmQuit.armed = false;
    switch (it.id) {
      case 'resume': game.commands.closeModal(); return;
      case 'settings':
        openSub(() => createSettings({
          storage: game.storage, sfx: ctx.sfx,
          quality: () => ctx.quality(),
          setQuality: (q) => { game.commands.setQuality(q); ctx.setQualityLocal(q); },
          muted,
          setMuted: (b) => { if (ctx.audio && ctx.audio.setMuted) ctx.audio.setMuted(b); },
          onClose: () => closeSub(),
        }));
        return;
      case 'teacher':
        if (game.teacher !== true) return;
        openSub(() => createTeacherTools(game, { sfx: ctx.sfx, onClose: () => closeSub() }));
        return;
      case 'quality': {
        const q = (ctx.quality() + (dir > 0 ? 1 : 2)) % 3;
        game.commands.setQuality(q);
        ctx.setQualityLocal(q);
        try { if (game.storage) game.storage.set(QUALITY_KEY, String(q)); } catch { /* ignore */ }
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

  const sel = selectable(rows, { layout: 'vertical', sfx: ctx.sfx, digits: false, onPick: (i) => act(i) });

  return {
    el: root, layer: 'center', dim: true,
    key(e) {
      if (subScreen) { subScreen.key(e); return true; }
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
    destroy() { closeSub(); root.remove(); },
  };
}

export default createPauseMenu;
