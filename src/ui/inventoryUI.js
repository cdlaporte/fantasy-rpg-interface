// Inventory modal. Payload: {items, cosmetics, equipped}; commands assignSlot(itemId, i), equipCosmetic(id), closeModal().
// items: {id: n} or [{id, count|n, name?, icon?, desc?}]; cosmetics: [id] or [{id, name?, icon?, slot?, equipped?}];
// equipped: {hat, cape, outfitColor} (ids). Names / icons fall back to game.data.items.
import { el, add, setText, setClass, clear, keycap } from './dom.js';
import { iconCanvas, setIcon } from './icons.js';
import { normalizeItems, normalizeCosmetics } from './format.js';
import { K, selectable, hints, shake } from './modalKit.js';
import { tip } from './tooltip.js';
import { keyLabel } from '../platform/bindings.js';

export function createInventoryUI(modal, ctx, prev) {
  const game = ctx.game;
  const defs = (game.data && game.data.items) || {};
  const root = el('div', 'inv');
  const box = el('div', 'inv-box px-box');
  const tabs = el('div', 'inv-tabs');
  const tabItems = el('div', 'inv-tab pxfont', 'BAG');
  const tabWard = el('div', 'inv-tab pxfont', 'WARDROBE');
  add(tabs, tabItems, tabWard);
  const body = el('div', 'inv-body');
  const list = el('div', 'inv-list');
  const detail = el('div', 'inv-detail');
  add(body, list, detail);
  const hot = el('div', 'inv-hotbar');
  const hotSlots = [];
  for (let i = 0; i < 6; i++) {
    const s = el('div', 'islot inv-hslot');
    const ic = iconCanvas(null, 'icon-md');
    add(s, ic, el('span', 'islot-key pxfont', keyLabel('item' + (i + 1))));
    s.addEventListener('click', () => assign(i));
    tip(s, () => { const it = ((ctx.getHud && ctx.getHud()) || {}).items; const sl = it && it[i]; return sl ? { title: sl.name || sl.id, tag: keyLabel('item' + (i + 1)), meta: [`You have ${sl.count ?? 1}`], lines: ['Click here to replace it with the selected item.'] } : { title: 'Empty hotbar slot', tag: keyLabel('item' + (i + 1)), lines: ['Pick an item, then click here or press its number to put it in this slot.'] }; });
    hot.appendChild(s);
    hotSlots.push({ s, ic });
  }
  const hotRow = el('div', 'inv-hot-row');
  add(hotRow, el('div', 'sec-title pxfont', 'HOTBAR'), hot);
  const footItems = hints([['↑', '↓', 'Select'], ['1', '-', '6', 'Put on hotbar'], ['←', '→', 'Tab'], ['Esc', 'Close']]);
  const footWard = hints([['↑', '↓', 'Select'], ['Enter', 'Wear'], ['←', '→', 'Tab'], ['Esc', 'Close']]);
  add(box, tabs, body, hotRow, footItems, footWard);
  root.appendChild(box);

  let cur = modal;
  let tab = prev && prev.tab ? prev.tab : 'items';
  let sel = null;
  let entries = [];

  function build() {
    clear(list);
    const items = tab === 'items' ? normalizeItems(cur.items, defs) : normalizeCosmetics(cur.cosmetics, defs, cur.equipped);
    entries = items;
    setClass(tabItems, 'on', tab === 'items');
    setClass(tabWard, 'on', tab === 'ward');
    footItems.hidden = tab !== 'items';
    footWard.hidden = tab === 'items';
    hotRow.hidden = tab !== 'items';
    const rows = items.map((it) => {
      const r = el('div', 'inv-row' + (it.equipped ? ' equipped' : ''));
      add(r, iconCanvas(it.icon, 'icon-md'), el('span', 'inv-name', it.name));
      if (tab === 'items') r.appendChild(el('span', 'inv-count pxfont', 'x' + it.count));
      else if (it.equipped) r.appendChild(el('span', 'inv-badge pxfont', 'WORN'));
      tip(r, () => {
        const meta = tab === 'items' ? [`You have ${it.count}`] : [it.equipped ? 'Worn now' : 'Not worn'];
        const d = defs[it.id] || {};
        if (tab === 'items' && d.cd > 1) meta.push(`Cooldown ${d.cd}s`);
        return { title: it.name, meta, lines: [it.desc || d.desc || '', tab === 'items' && (!it.type || it.type === 'consumable') ? `Press ${keyLabel('item1')} to ${keyLabel('item6')} to put it on your hotbar.` : ''] };
      });
      list.appendChild(r);
      return r;
    });
    if (!rows.length) list.appendChild(el('div', 'inv-empty', tab === 'items' ? 'Your bag is empty.' : 'Nothing to wear yet. Visit Stitch & Sparkle!'));
    sel = selectable(rows, {
      layout: 'vertical', sfx: ctx.sfx, digits: false,
      start: prev && prev.tab === tab ? Math.min(prev.index || 0, Math.max(0, rows.length - 1)) : 0,
      onMove: renderDetail,
      onPick: (i) => {
        if (tab === 'ward') { game.commands.equipCosmetic(entries[i].id); return; }
        shake(hot);
      },
    });
    renderDetail();
  }

  function renderDetail() {
    clear(detail);
    const it = entries[sel ? sel.index : -1];
    if (!it) return;
    const big = el('div', 'inv-detail-icon');
    big.appendChild(iconCanvas(it.icon, 'icon-xl'));
    add(detail, big, el('div', 'inv-detail-name pxfont', it.name), el('div', 'inv-detail-desc', it.desc || ''));
    if (tab === 'items') {
      const tip = el('div', 'inv-tip');
      add(tip, el('span', null, 'Press '), keycap('1'), el('span', null, '–'), keycap('6'), el('span', null, ' to put it on your hotbar.'));
      if (it.type === 'consumable') detail.appendChild(tip);
    } else {
      detail.appendChild(el('div', 'inv-tip', it.equipped ? 'You are wearing this.' : 'Press Enter to wear it.'));
    }
  }

  function assign(i) {
    if (tab !== 'items') return;
    const it = entries[sel ? sel.index : -1];
    if (!it) { ctx.sfx('ui_bad'); return; }
    if (it.type && it.type !== 'consumable') { ctx.sfx('ui_bad'); shake(list.children[sel.index]); return; }
    ctx.sfx('ui_ok');
    game.commands.assignSlot(it.id, i);
    const hs = hotSlots[i];
    hs.s.classList.remove('pop'); void hs.s.offsetWidth; hs.s.classList.add('pop');
  }

  function renderHotbar() {
    const hud = ctx.getHud ? ctx.getHud() : null;
    const its = (hud && hud.items) || [];
    for (let i = 0; i < 6; i++) {
      const it = its[i];
      setClass(hotSlots[i].s, 'empty', !it);
      if (it) setIcon(hotSlots[i].ic, it.icon || 'potion');
      else if (hotSlots[i].ic.__icon) { hotSlots[i].ic.getContext('2d').clearRect(0, 0, 16, 16); hotSlots[i].ic.__icon = null; }
    }
  }

  build();
  renderHotbar();
  let sig = JSON.stringify([modal.items, modal.cosmetics, modal.equipped]);

  return {
    el: root, layer: 'center', dim: true,
    refresh(m) {
      const s = JSON.stringify([m.items, m.cosmetics, m.equipped]);
      if (m !== cur || s !== sig) { prev = { tab, index: sel ? sel.index : 0 }; cur = m; sig = s; build(); }
      renderHotbar();
    },
    state() { return { tab, index: sel ? sel.index : 0 }; },
    key(e) {
      const c = e.code;
      if (K.back(c) || c === 'KeyB') { if (!e.repeat) { ctx.sfx('ui_move'); game.commands.closeModal(); } return true; }
      if (K.left(c) || K.right(c)) {
        if (e.repeat) return true;
        prev = null;
        tab = tab === 'items' ? 'ward' : 'items';
        ctx.sfx('ui_move');
        build();
        return true;
      }
      const d = K.digit(c);
      if (d) { if (!e.repeat && d <= 6) assign(d - 1); return true; }
      return sel ? sel.key(e) : false;
    },
    destroy() { root.remove(); },
  };
}

export default createInventoryUI;
