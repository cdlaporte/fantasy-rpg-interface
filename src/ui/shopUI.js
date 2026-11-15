// Shop modal. Payload: {id, name, keeper, stock: [{id, name, desc, icon, price, canBuy}], gold, haggled}
// Commands: shopBuy(itemId), shopHaggle(), closeModal().
import { el, add, setText, setClass, keycap } from './dom.js';
import { iconCanvas } from './icons.js';
import { fmtNum } from './format.js';
import { K, selectable, livePortrait, hints, shake } from './modalKit.js';

export function createShopUI(modal, ctx, prev) {
  const game = ctx.game;
  const root = el('div', 'shop');
  const box = el('div', 'shop-box px-box');
  const head = el('div', 'shop-head');
  const npc = game.data && game.data.npcs && modal.keeper ? game.data.npcs[modal.keeper] : null;
  const keeperName = npc ? npc.name : modal.keeper || '';
  const keeperLook = npc && npc.look ? npc.look : null;
  let portrait = null;
  if (keeperLook || modal.keeper === 'laporte') {
    const pf = el('div', 'shop-portrait');
    portrait = livePortrait(modal.keeper === 'laporte' ? 'laporte' : keeperLook, 'happy', 'town', 'shop-portrait-canvas');
    pf.appendChild(portrait.canvas);
    head.appendChild(pf);
  }
  const titles = el('div', 'shop-titles');
  add(titles, el('div', 'shop-name pxfont', modal.name || 'Shop'), el('div', 'shop-keeper', keeperName ? `Keeper: ${keeperName}` : ''));
  const goldBox = el('div', 'shop-gold');
  const goldN = el('span', 'pxfont');
  add(goldBox, iconCanvas('coin', 'icon-md'), goldN);
  add(head, titles, goldBox);

  const list = el('div', 'shop-list');
  const detail = el('div', 'shop-detail');
  const stock = modal.stock || [];
  const rows = stock.map((s) => {
    const r = el('div', 'shop-row');
    const price = el('span', 'shop-price pxfont');
    add(price, iconCanvas('coin', 'icon-sm'), el('span', null, fmtNum(s.price || 0)));
    add(r, iconCanvas(s.icon || 'potion', 'icon-md'), el('span', 'shop-item', s.name || s.id), price);
    list.appendChild(r);
    return r;
  });
  if (!rows.length) list.appendChild(el('div', 'shop-empty', 'Sold out! Come back later.'));
  const haggleNote = el('div', 'shop-haggle');
  const foot = hints([['↑', '↓', 'Browse'], ['Enter', 'Buy'], ['H', 'Haggle'], ['Esc', 'Leave']]);
  add(box, head, list, detail, haggleNote, foot);
  root.appendChild(box);

  let cur = modal;
  const sel = selectable(rows, {
    layout: 'vertical', sfx: () => {}, digits: true, digitsPick: false,
    start: prev && prev.id === modal.id ? prev.index : 0,
    onMove: () => renderDetail(),
    onPick: (i) => buy(i),
  });

  function buy(i) {
    const item = (cur.stock || [])[i];
    if (!item) return;
    if (item.canBuy === false) { ctx.sfx('ui_bad'); shake(rows[i]); return; }
    ctx.sfx('coin');
    game.commands.shopBuy(item.id);
  }

  function renderDetail() {
    const item = (cur.stock || [])[sel.index];
    detail.textContent = '';
    if (!item) return;
    add(detail, el('div', 'shop-detail-name', item.name || item.id), el('div', 'shop-detail-desc', item.desc || ''));
    if (item.canBuy === false) detail.appendChild(el('div', 'shop-detail-warn', (cur.gold ?? 0) < (item.price || 0) ? 'Not enough gold.' : 'You can\'t buy this right now.'));
  }

  function renderState() {
    setText(goldN, fmtNum(cur.gold ?? 0));
    (cur.stock || []).forEach((s, i) => { if (rows[i]) setClass(rows[i], 'cant', s.canBuy === false); });
    setText(haggleNote, cur.haggled ? 'You already haggled here today.' : 'Feeling clever? Press H to haggle for a discount.');
    setClass(haggleNote, 'used', !!cur.haggled);
    renderDetail();
  }
  renderState();
  let sig = '';
  const sigOf = (m) => `${m.gold}|${m.haggled}|${(m.stock || []).map((s) => `${s.price}:${s.canBuy}`).join(',')}`;
  sig = sigOf(modal);

  return {
    el: root, layer: 'center', dim: true,
    tick(now) { if (portrait) portrait.draw(now / 1000); },
    refresh(m) { const s = sigOf(m); if (m !== cur || s !== sig) { cur = m; sig = s; renderState(); } },
    state() { return { id: cur.id, index: sel.index }; },
    key(e) {
      const c = e.code;
      if (K.back(c)) { if (!e.repeat) { ctx.sfx('ui_move'); game.commands.closeModal(); } return true; }
      if (c === 'KeyH') {
        if (e.repeat) return true;
        if (cur.haggled) { ctx.sfx('ui_bad'); shake(haggleNote); } else { ctx.sfx('ui_ok'); game.commands.shopHaggle(); }
        return true;
      }
      if (c === 'KeyE' || c === 'Space') return sel.key(Object.assign({}, e, { code: 'Enter', repeat: e.repeat }));
      return sel.key(e);
    },
    destroy() { root.remove(); },
  };
}

export default createShopUI;
