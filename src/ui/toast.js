// Toasts ('toast' {text, style: info|good|bad|loot|quest}): small parchment notes stacked under the top edge.
import { el, add } from './dom.js';
import { iconCanvas } from './icons.js';

const ICON = { info: 'book', good: 'star', bad: 'lock', loot: 'coin', quest: 'book' };
const MAX = 4;
const LIFE = 2800;

export function createToasts(host) {
  const live = [];
  function remove(t) {
    const i = live.indexOf(t);
    if (i >= 0) live.splice(i, 1);
    t.classList.add('out');
    setTimeout(() => t.remove(), 260);
  }
  return {
    show(text, style = 'info') {
      if (!host || !text) return;
      const st = ICON[style] ? style : 'info';
      // merge an identical toast that is still visible (x2, x3...)
      const same = live.find((t) => t.__text === text);
      if (same) {
        same.__n = (same.__n || 1) + 1;
        same.__count.textContent = 'x' + same.__n;
        clearTimeout(same.__timer);
        same.__timer = setTimeout(() => remove(same), LIFE);
        same.classList.remove('bump'); void same.offsetWidth; same.classList.add('bump');
        return;
      }
      const t = el('div', 'toast toast-' + st);
      const count = el('span', 'toast-n pxfont');
      add(t, iconCanvas(ICON[st], 'icon-sm'), el('span', 'toast-text', text), count);
      t.__text = text; t.__count = count;
      host.appendChild(t);
      live.push(t);
      while (live.length > MAX) { const old = live[0]; clearTimeout(old.__timer); remove(old); }
      t.__timer = setTimeout(() => remove(t), LIFE + Math.min(2000, text.length * 25));
    },
    clear() { for (const t of live.slice()) { clearTimeout(t.__timer); remove(t); } },
  };
}

export default createToasts;
