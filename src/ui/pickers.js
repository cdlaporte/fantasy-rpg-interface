// Picker modals: lookPicker, classPicker, specPicker, boonPicker (CONTRACTS 9).
//  lookPicker  {name, looks: [lookA, lookB]}                       -> pickLook(i)   (two portraits + the NAME under each, nothing else)
//  classPicker {classes: [{id, name, blurb, look, basic, abilities}]} -> pickClass(id)
//  specPicker  {options: [{id, name, blurb, look, basic, abilities}]} -> pickSpec(id)
//  boonPicker  {options: [{id, name, desc, icon}]}                   -> pickBoon(id)
import { el, add, keycap } from './dom.js';
import { iconCanvas } from './icons.js';
import { normalizeAbilities, normalizeBasic } from './format.js';
import { selectable, livePortrait, hints, classColor } from './modalKit.js';

export function createLookPicker(modal, ctx) {
  const root = el('div', 'picker look-picker');
  const row = el('div', 'look-row');
  const looks = (modal.looks || []).slice(0, 2);
  const portraits = [];
  const cards = looks.map((lk) => {
    const card = el('div', 'look-card');
    const frame = el('div', 'look-frame px-box');
    const p = livePortrait(lk, 'calm', 'academy', 'look-portrait');
    portraits.push(p);
    frame.appendChild(p.canvas);
    const cursor = el('div', 'look-cursor');
    const nm = el('div', 'look-name pxfont');
    nm.textContent = modal.name || ctx.game.name || '';
    add(card, cursor, frame, nm);
    row.appendChild(card);
    return card;
  });
  root.appendChild(row);
  const sel = selectable(cards, {
    layout: 'horizontal', sfx: ctx.sfx,
    onMove: (i) => { portraits.forEach((p, j) => { p.mood = j === i ? 'happy' : 'calm'; }); },
    onPick: (i) => ctx.game.commands.pickLook(i),
  });
  portraits.forEach((p, j) => { p.mood = j === sel.index ? 'happy' : 'calm'; });
  return {
    el: root, layer: 'center',
    tick(now) { portraits.forEach((p, i) => p.draw(now / 1000 + i * 1.7)); },
    key: (e) => sel.key(e),
    destroy() { root.remove(); },
  };
}

function abilityRow(a) {
  const r = el('div', 'ab-row');
  const key = a.key || '';
  add(r, iconCanvas(a.icon || 'star', 'icon-md'));
  const t = el('div', 'ab-text');
  const head = el('div', 'ab-head');
  if (key) head.appendChild(keycap(key));
  head.appendChild(el('span', 'ab-name', a.name));
  if (a.unlock) head.appendChild(el('span', 'ab-lv pxfont', 'Lv ' + a.unlock));
  t.appendChild(head);
  if (a.desc) t.appendChild(el('div', 'ab-desc', a.desc));
  r.appendChild(t);
  return r;
}

/** Shared by classPicker and specPicker. */
function createCardPicker(modal, ctx, { title, subtitle, list, onPick }) {
  const root = el('div', 'picker class-picker');
  const head = el('div', 'picker-head');
  add(head, el('div', 'picker-title pxfont', title));
  if (subtitle) head.appendChild(el('div', 'picker-sub', subtitle));
  const row = el('div', 'card-row n' + list.length);
  const portraits = [];
  const cards = list.map((opt, i) => {
    const color = classColor(opt);
    const card = el('div', 'class-card px-box');
    card.style.setProperty('--cc', color);
    const banner = el('div', 'class-banner');
    const p = livePortrait(opt.look || null, 'calm', 'parchment', 'class-portrait');
    portraits.push(p);
    const pf = el('div', 'class-pframe');
    pf.appendChild(p.canvas);
    const kc = keycap(String(i + 1), 'card-key big');
    add(banner, pf, kc);
    const nm = el('div', 'class-name pxfont', opt.name || opt.id);
    const blurb = el('div', 'class-blurb', opt.blurb || opt.desc || '');
    add(card, banner, nm, blurb);
    const basic = normalizeBasic(opt.basic);
    const kit = el('div', 'class-kit');
    if (basic && basic.name) {
      const br = abilityRow({ icon: basic.icon, name: basic.name, desc: basic.desc, key: '' });
      br.classList.add('ab-basic');
      br.querySelector('.ab-head').prepend(el('span', 'ab-tag pxfont', 'ATK'));
      kit.appendChild(br);
    }
    for (const a of normalizeAbilities(opt.abilities)) kit.appendChild(abilityRow(a));
    card.appendChild(kit);
    row.appendChild(card);
    return card;
  });
  add(root, head, row, hints([['←', '→', 'Look'], ['Enter', 'Choose']]));
  const sel = selectable(cards, {
    layout: 'horizontal', sfx: ctx.sfx,
    onMove: (i) => portraits.forEach((p, j) => { p.mood = j === i ? 'proud' : 'calm'; }),
    onPick: (i) => onPick(list[i]),
  });
  portraits.forEach((p, j) => { p.mood = j === sel.index ? 'proud' : 'calm'; });
  return {
    el: root, layer: 'center',
    tick(now) { portraits.forEach((p, i) => p.draw(now / 1000 + i * 1.3)); },
    key: (e) => sel.key(e),
    destroy() { root.remove(); },
  };
}

export function createClassPicker(modal, ctx) {
  return createCardPicker(modal, ctx, {
    title: 'CHOOSE YOUR DISCIPLINE', subtitle: 'Your class sets your weapon, your powers and your style.',
    list: modal.classes || [], onPick: (c) => ctx.game.commands.pickClass(c.id),
  });
}

export function createSpecPicker(modal, ctx) {
  return createCardPicker(modal, ctx, {
    title: 'CHOOSE YOUR PATH', subtitle: 'A specialization changes how you fight for good.',
    list: modal.options || [], onPick: (c) => ctx.game.commands.pickSpec(c.id),
  });
}

export function createBoonPicker(modal, ctx) {
  const root = el('div', 'picker boon-picker');
  const list = modal.options || [];
  const head = el('div', 'picker-head');
  add(head, el('div', 'picker-title pxfont', 'CHOOSE A BOON'));
  const row = el('div', 'card-row boon-row n' + list.length);
  const cards = list.map((b, i) => {
    const card = el('div', 'boon-card px-box');
    const top = el('div', 'boon-top');
    const ic = el('div', 'boon-icon');
    ic.appendChild(iconCanvas(b.icon || 'star', 'icon-xl'));
    add(top, ic, keycap(String(i + 1), 'card-key big'));
    add(card, top, el('div', 'boon-name pxfont', b.name || b.id), el('div', 'boon-desc', b.desc || ''));
    row.appendChild(card);
    return card;
  });
  add(root, head, row, hints([['1', '2', '3', 'Choose'], ['←', '→', 'Enter', 'Pick']]));
  const sel = selectable(cards, { layout: 'horizontal', sfx: ctx.sfx, onPick: (i) => ctx.game.commands.pickBoon(list[i].id) });
  return { el: root, layer: 'center', key: (e) => sel.key(e), destroy() { root.remove(); } };
}

export function createPickers() {
  return { lookPicker: createLookPicker, classPicker: createClassPicker, specPicker: createSpecPicker, boonPicker: createBoonPicker };
}

export default createPickers;
