// Title screen (UI-only, runs before the game exists): name entry, look of the game (2D Pixel / 3D Toy Box),
// New Game / Continue (saves from opts.storage under flinkerton.v1.<name>), controls card. Fully keyboard-driven.
// Resolves {name, renderer: '2d'|'3d', continueSave: saveJson|null}.
import { el, add, setText, setClass, clear, keycap } from './dom.js';
import { sanitizeName, finalName, listSaves, NAME_MAX, SAVE_PREFIX } from './format.js';
import { controlsCard } from './modalKit.js';
import { buildPortrait } from './portraits.js';
import { blitGrid } from './pixelart.js';

const PREF_KEY = 'flinkerton.ui.renderer';

/** Procedural pixel skyline: rolling hills, trees and the Academy on its rise (340x90 art pixels, shown at 4x). */
function drawSkyline(c) {
  const W = 340, H = 90, OX = 218; // OX shifts the academy to the right of the menu cards
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  for (let x = 0; x < W; x++) {
    const y1 = Math.round(52 + 6 * Math.sin(x / 13) + 3 * Math.sin(x / 5.3));
    R(x, y1, 1, H - y1, '#9ad696');
    const y2 = Math.round(66 + 5 * Math.sin(x / 17 + 2) + 2 * Math.sin(x / 7));
    R(x, y2, 1, H - y2, '#74c264');
    const y3 = Math.round(78 + 3 * Math.sin(x / 11 + 1));
    R(x, y3, 1, H - y3, '#5fb548');
  }
  for (let x = OX + 30; x < OX + 130; x++) { const y = Math.round(60 - 12 * Math.cos(((x - OX - 80) / 50) * Math.PI / 2)); R(x, y, 1, H - y, '#5fb548'); }
  const OUT = '#1e1a22', WALL = '#f0d6a8', WALL2 = '#d9b77e', ROOF = '#6a4bc4', ROOF2 = '#4a2f9a', WIN = '#ffe680';
  const block = (x, y, w, h) => { x += OX; R(x - 1, y - 1, w + 2, h + 1, OUT); R(x, y, w, h, WALL); R(x + w - 2, y, 2, h, WALL2); };
  const roof = (x, y, w, tall) => {
    x += OX;
    for (let k = 0; k < tall; k++) { const hw = Math.round((w / 2) * (k / tall)); R(x + w / 2 - hw - 1, y - tall + k, hw * 2 + 2, 1, OUT); R(x + w / 2 - hw, y - tall + k, hw * 2, 1, k % 3 ? ROOF : ROOF2); }
  };
  block(62, 36, 36, 18); roof(60, 36, 40, 10);
  block(52, 30, 10, 24); roof(51, 30, 12, 14);
  block(98, 30, 10, 24); roof(97, 30, 12, 14);
  block(75, 22, 10, 14); roof(74, 22, 12, 12);
  for (const [x, y] of [[55, 36], [101, 36], [55, 44], [101, 44], [68, 41], [76, 41], [84, 41], [92, 41], [79, 27]]) R(OX + x, y, 3, 4, WIN);
  R(OX + 76, 46, 8, 8, '#7a4a2a'); R(OX + 79, 46, 2, 8, '#5e3720');
  for (const [x, y, col] of [[57, 12, '#e2503c'], [103, 12, '#4d8dff'], [80, 6, '#ffd24a']]) { R(OX + x, y, 1, 6, OUT); R(OX + x + 1, y, 5, 3, col); }
  // winding path from the door to the bottom edge
  for (let y = 54; y < H; y++) { const k = (y - 54) / (H - 54); const cx = OX + 80 - k * k * 60; const w = 3 + k * 9; R(cx - w, y, w * 2, 1, '#e8cf94'); }
  const tree = (x, y, big) => {
    const s = big ? 1.4 : 1;
    R(x - 4 * s, y - 7 * s, 9 * s, 7 * s, OUT); R(x - 3 * s, y - 8 * s, 7 * s, 9 * s, OUT);
    R(x - 3 * s, y - 7 * s, 7 * s, 7 * s, '#2f9a48'); R(x - 2 * s, y - 6 * s, 2 * s, 2 * s, '#58c06a'); R(x, y, 1, 3 * s, '#7a5233');
  };
  for (const [x, y, b] of [[12, 72, 1], [30, 80, 0], [44, 70, 0], [62, 84, 1], [8, 88, 0], [196, 74, 0], [214, 84, 1], [330, 76, 0], [322, 88, 1], [120, 88, 0]]) tree(x, y, b);
  // a little signpost on the left hill
  R(84, 70, 2, 12, '#7a5233'); R(78, 68, 14, 5, OUT); R(79, 69, 12, 3, '#c98c50'); R(91, 69, 2, 3, OUT);
}

export function createTitle(opts = {}) {
  const storage = opts.storage || null;
  const params = opts.params || {};
  const maxLen = (opts.config && opts.config.nameMaxLength) || NAME_MAX;
  const prefix = (opts.config && opts.config.saveKeyPrefix) || SAVE_PREFIX;

  return new Promise((resolve) => {
    const saves = listSaves(storage, prefix);
    let renderer = params.renderer || (storage && storage.get && storage.get(PREF_KEY)) || '2d';
    if (renderer !== '3d') renderer = '2d';

    const screen = el('div', 'title-screen');
    const sky = el('div', 'title-sky');
    for (let i = 0; i < 4; i++) { const c = el('div', 'cloud c' + i); sky.appendChild(c); }
    for (let i = 0; i < 14; i++) { const s = el('i', 'twinkle'); s.style.setProperty('--x', ((i * 37) % 100) + '%'); s.style.setProperty('--y', ((i * 23) % 38) + '%'); s.style.setProperty('--d', (i % 5) * 0.4 + 's'); sky.appendChild(s); }
    const skyline = el('canvas', 'title-skyline pixel');
    drawSkyline(skyline);
    sky.appendChild(skyline);

    const logo = el('div', 'title-logo');
    add(logo, el('div', 'logo-top pxfont', 'FLINKERTON'), el('div', 'logo-bot pxfont', 'ACADEMY'), el('div', 'logo-tag', 'A school for heroes. Homework optional. Snacks encouraged.'));

    const main = el('div', 'title-main');
    const card = el('div', 'title-card px-box');

    // name
    const nameRow = el('div', 'title-row row-name');
    const nameLab = el('label', 'title-label pxfont', 'YOUR NAME');
    const nameWrap = el('div', 'name-wrap');
    const face = el('canvas', 'title-face pixel');
    blitGrid(face, buildPortrait({ rig: 'humanoid', hood: true, outfit: { style: 'cloak', primary: '#6a5a8a', secondary: '#4a3e66', accent: '#c9b6ff' }, skin: '#b07850' }, { mood: 'calm', t: 1, bg: 'sky' }));
    const input = el('input', 'name-input');
    input.type = 'text';
    input.maxLength = maxLen;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'Type a name';
    input.setAttribute('aria-label', 'Your name');
    const counter = el('span', 'name-count pxfont');
    add(nameWrap, face, input, counter);
    const nameHint = el('div', 'title-hint');
    add(nameRow, nameLab, nameWrap, nameHint);

    // look of the game
    const lookRow = el('div', 'title-row row-look');
    const lookLab = el('div', 'title-label pxfont', 'LOOK OF THE GAME');
    const looks = el('div', 'look-opts');
    const mkLook = (id, name, sub) => {
      const b = el('div', 'look-opt');
      b.dataset.id = id;
      const art = el('div', 'look-art look-art-' + id);
      add(b, art, el('div', 'look-opt-name pxfont', name), el('div', 'look-opt-sub', sub));
      b.addEventListener('click', () => { setRenderer(id); focusRow(1); });
      return b;
    };
    const l2 = mkLook('2d', '2D Pixel', 'Crisp pixel art. Fastest.');
    const l3 = mkLook('3d', '3D Toy Box', 'Chunky 3D toys.');
    add(looks, l2, l3);
    add(lookRow, lookLab, looks);

    // buttons
    const btnRow = el('div', 'title-row row-btns');
    const bNew = el('button', 'tbtn tbtn-new pxfont', 'NEW GAME');
    const bCont = el('button', 'tbtn tbtn-cont pxfont', 'CONTINUE');
    bNew.type = 'button'; bCont.type = 'button';
    bCont.disabled = saves.length === 0;
    add(btnRow, bNew, bCont);
    const contList = el('div', 'cont-list');
    contList.hidden = true;

    add(card, nameRow, lookRow, btnRow, contList);
    const ctl = controlsCard('CONTROLS');
    add(main, card, ctl);
    const foot = el('div', 'title-foot');
    add(foot, keycap('↑'), keycap('↓'), el('span', null, 'choose'), keycap('←'), keycap('→'), el('span', null, 'change'), keycap('Enter'), el('span', null, 'start'));
    add(screen, sky, logo, main, foot);
    document.body.appendChild(screen);

    let row = 0;        // 0 name, 1 look, 2 buttons, 3 continue list
    let btn = 0;        // 0 new, 1 continue
    let contIdx = 0;
    let confirmNew = false;
    let done = false;

    function setRenderer(id) { renderer = id; setClass(l2, 'on', id === '2d'); setClass(l3, 'on', id === '3d'); }
    setRenderer(renderer);

    function existingSave(name) { return saves.find((s) => s.name.toLowerCase() === name.toLowerCase()) || null; }

    function refreshName() {
      const clean = sanitizeName(input.value, maxLen);
      if (clean !== input.value) {
        const pos = Math.min(input.selectionStart || clean.length, clean.length);
        input.value = clean;
        try { input.setSelectionRange(pos, pos); } catch { /* ignore */ }
      }
      setText(counter, `${input.value.length}/${maxLen}`);
      const nm = finalName(input.value, maxLen);
      const ex = nm && existingSave(nm);
      confirmNew = false;
      setText(bNew, 'NEW GAME');
      setText(nameHint, ex ? `A saved adventure for ${ex.name} exists. Continue to load it.` : nm ? '' : 'Letters, numbers and spaces.');
    }
    input.addEventListener('input', refreshName);
    refreshName();

    function focusRow(r) {
      row = r;
      setClass(nameRow, 'focus', r === 0);
      setClass(lookRow, 'focus', r === 1);
      setClass(btnRow, 'focus', r === 2);
      setClass(bNew, 'sel', r === 2 && btn === 0);
      setClass(bCont, 'sel', r === 2 && btn === 1);
      if (r === 0) input.focus(); else input.blur();
      if (r !== 3) { contList.hidden = true; }
    }

    function renderCont() {
      clear(contList);
      contList.appendChild(el('div', 'title-label pxfont', 'CONTINUE AS'));
      saves.forEach((s, i) => {
        const it = el('div', 'cont-item' + (i === contIdx ? ' sel' : ''));
        add(it, el('span', 'cont-name pxfont', s.name), el('span', 'cont-meta', [s.level ? 'Level ' + s.level : '', s.zone || ''].filter(Boolean).join(' · ')));
        it.addEventListener('click', () => { contIdx = i; startContinue(); });
        contList.appendChild(it);
      });
      const back = el('div', 'cont-back');
      add(back, keycap('Esc'), el('span', null, 'back'));
      contList.appendChild(back);
    }

    function openContinue() {
      if (!saves.length) return;
      const nm = finalName(input.value, maxLen);
      const ex = nm ? saves.indexOf(existingSave(nm)) : -1;
      contIdx = ex >= 0 ? ex : 0;
      row = 3;
      setClass(btnRow, 'focus', false);
      contList.hidden = false;
      renderCont();
    }

    function finish(result) {
      if (done) return;
      done = true;
      try { if (storage && storage.set) storage.set(PREF_KEY, result.renderer); } catch { /* ignore */ }
      window.removeEventListener('keydown', onKey, true);
      screen.classList.add('leaving');
      setTimeout(() => screen.remove(), 350);
      resolve(result);
    }

    function startNew() {
      const nm = finalName(input.value, maxLen);
      if (!nm) { focusRow(0); nameWrap.classList.remove('shake'); void nameWrap.offsetWidth; nameWrap.classList.add('shake'); setText(nameHint, 'Type your name first!'); return; }
      if (existingSave(nm) && !confirmNew) { confirmNew = true; setText(bNew, 'START OVER?'); setText(nameHint, `Press New Game again to start a fresh adventure as ${nm}.`); return; }
      finish({ name: nm, renderer, continueSave: null });
    }

    function startContinue() {
      const s = saves[contIdx];
      if (!s) return;
      finish({ name: s.name, renderer, continueSave: s.save });
    }

    function onKey(e) {
      const c = e.code;
      if (row === 3) {
        e.preventDefault();
        if (c === 'ArrowUp' || c === 'KeyW') { contIdx = (contIdx + saves.length - 1) % saves.length; renderCont(); }
        else if (c === 'ArrowDown' || c === 'KeyS') { contIdx = (contIdx + 1) % saves.length; renderCont(); }
        else if (c === 'Enter' || c === 'Space') startContinue();
        else if (c === 'Escape' || c === 'Backspace') { focusRow(2); }
        return;
      }
      if (row === 0) {
        if (c === 'Enter' || c === 'NumpadEnter') { e.preventDefault(); startNew(); return; }
        if (c === 'ArrowDown' || c === 'Tab') { e.preventDefault(); focusRow(1); return; }
        return; // typing goes to the input
      }
      if (c === 'Tab') { e.preventDefault(); focusRow((row + (e.shiftKey ? 2 : 1)) % 3); return; }
      if (c === 'ArrowUp' || c === 'KeyW') { e.preventDefault(); focusRow(Math.max(0, row - 1)); return; }
      if (c === 'ArrowDown' || c === 'KeyS') { e.preventDefault(); focusRow(Math.min(2, row + 1)); return; }
      if (row === 1 && (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'KeyA' || c === 'KeyD')) {
        e.preventDefault(); setRenderer(renderer === '2d' ? '3d' : '2d'); return;
      }
      if (row === 1 && (c === 'Enter' || c === 'Space')) { e.preventDefault(); focusRow(2); return; }
      if (row === 2 && (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'KeyA' || c === 'KeyD')) {
        e.preventDefault(); btn = btn === 0 && !bCont.disabled ? 1 : 0; focusRow(2); return;
      }
      if (row === 2 && (c === 'Enter' || c === 'Space')) { e.preventDefault(); if (btn === 0) startNew(); else openContinue(); return; }
      if (c === 'Escape') { e.preventDefault(); focusRow(0); }
    }
    window.addEventListener('keydown', onKey, true);
    bNew.addEventListener('click', () => { btn = 0; startNew(); });
    bCont.addEventListener('click', () => { btn = 1; openContinue(); });
    input.addEventListener('focus', () => { if (row !== 0) focusRow(0); });
    if (saves.length) { const last = saves[0]; input.value = ''; setText(nameHint, `Welcome back! Choose Continue to play as ${last.name}.`); }
    focusRow(0);
  });
}

export default createTitle;
