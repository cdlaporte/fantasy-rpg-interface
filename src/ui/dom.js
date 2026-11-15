// Tiny DOM helpers shared by the UI modules. Change-detecting setters keep the 10 Hz HUD refresh cheap:
// nothing touches the DOM unless the value actually changed.

/** Create an element with an optional class string and text (always textContent, never innerHTML). */
export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}

/** Append children (skips null/undefined) and return the parent. */
export function add(parent, ...kids) {
  for (const k of kids) if (k) parent.appendChild(k);
  return parent;
}

/** Set textContent only when it changed. */
export function setText(node, v) {
  const s = v === undefined || v === null ? '' : String(v);
  if (node.__t !== s) { node.__t = s; node.textContent = s; }
}

/** Set one inline style property only when it changed. */
export function setStyle(node, prop, v) {
  const k = '__s_' + prop;
  if (node[k] !== v) { node[k] = v; node.style.setProperty(prop, v); }
}

/** Toggle a class only when its state changed. */
export function setClass(node, cls, on) {
  const k = '__c_' + cls;
  const b = !!on;
  if (node[k] !== b) { node[k] = b; node.classList.toggle(cls, b); }
}

/** Show/hide via the `hidden` attribute, change-detected. */
export function show(node, on) {
  const b = !on;
  if (node.__h !== b) { node.__h = b; node.hidden = b; }
}

/** A keyboard key cap: <span class="keycap">E</span>. */
const ARROWS = { '\u2190': 'left', '\u2191': 'up', '\u2192': 'right', '\u2193': 'down' };

export function keycap(label, extra) {
  const dir = ARROWS[label];
  const k = el('span', 'keycap' + (extra ? ' ' + extra : ''), dir ? null : label);
  if (dir) { k.appendChild(el('i', 'kc-arrow kc-' + dir)); k.setAttribute('aria-label', dir + ' arrow'); }
  if (String(label).length > 2) k.classList.add('keycap-wide');
  return k;
}

/** Remove every child. */
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

/** A pixel-scaled canvas (CSS sizes it; `image-rendering: pixelated`). */
export function pixelCanvas(w, h, cls) {
  const c = el('canvas', 'pixel' + (cls ? ' ' + cls : ''));
  c.width = w; c.height = h;
  return c;
}
