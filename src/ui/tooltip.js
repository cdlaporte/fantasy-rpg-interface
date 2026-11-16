// One shared tooltip for the whole UI (round 2). Parchment styled, large text, follows the mouse, appears after ~250 ms
// over anything that has tooltip data, never covers the cursor, stays on screen. It never takes focus and never
// intercepts the pointer (pointer-events: none), so hover cannot block clicks or steal keyboard focus.
//
//   tip(node, data)            data = {title, lines?: string[], text?, meta?: string[], tag?} or a function returning
//                              one (evaluated when the tooltip opens and while it is open: live cooldowns, counts).
//                              Returns the node. A falsy result hides the tip.
//   untip(node)                remove the hover handlers
//   hideTip()                  hide now (modal changes, re-renders)
//   tipContent(data)           pure: normalize to {title, lines, meta, tag} (unit tested)
//
// Data shape: title (string, bold), tag (small label next to the title, e.g. a key or level), meta (short fact lines
// shown in a row: 'Cost 20', 'Cooldown 6s'), lines (paragraphs).

const DELAY_MS = 250;
const GAP = 18;        // distance from the cursor
const MARGIN = 8;      // distance from the window edge

let box = null, titleEl = null, tagEl = null, metaEl = null, bodyEl = null;
let target = null, timer = 0, live = 0, shown = false, mx = 0, my = 0, getter = null, liveSig = '';
const registry = new WeakMap();
let installed = false;

/** Normalize tooltip data (a string, an object or null) to {title, tag, meta[], lines[]} or null. Pure. */
export function tipContent(d) {
  if (d === null || d === undefined || d === false || d === '') return null;
  if (typeof d === 'string') return { title: d, tag: '', meta: [], lines: [] };
  const lines = [];
  if (Array.isArray(d.lines)) for (const l of d.lines) if (l) lines.push(String(l));
  if (d.text) lines.unshift(String(d.text));
  const meta = Array.isArray(d.meta) ? d.meta.filter(Boolean).map(String) : [];
  const title = d.title ? String(d.title) : '';
  if (!title && !lines.length && !meta.length) return null;
  return { title, tag: d.tag ? String(d.tag) : '', meta, lines };
}

function ensure() {
  if (box || typeof document === 'undefined') return;
  box = document.createElement('div');
  box.className = 'tooltip px-box';
  box.setAttribute('role', 'tooltip');
  box.hidden = true;
  const head = document.createElement('div');
  head.className = 'tip-head';
  titleEl = document.createElement('span'); titleEl.className = 'tip-title';
  tagEl = document.createElement('span'); tagEl.className = 'tip-tag pxfont';
  head.append(titleEl, tagEl);
  metaEl = document.createElement('div'); metaEl.className = 'tip-meta';
  bodyEl = document.createElement('div'); bodyEl.className = 'tip-body';
  box.append(head, metaEl, bodyEl);
  document.body.appendChild(box);
}

function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  // Capture on the document: works for nodes created later, and any element with registered data.
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerdown', () => hideTip(), true);
  document.addEventListener('keydown', () => hideTip(), true);
  document.addEventListener('wheel', () => hideTip(), true);
  window.addEventListener('blur', () => hideTip());
}

function findTarget(n) {
  while (n && n !== document.documentElement) {
    if (registry.has(n)) return n;
    n = n.parentElement;
  }
  return null;
}

function onMove(e) {
  mx = e.clientX; my = e.clientY;
  const t = findTarget(e.target);
  if (t !== target) {
    target = t;
    clearTimeout(timer);
    if (shown) hideNow();
    if (t) timer = setTimeout(open, DELAY_MS);
  } else if (shown) place();
}

function open() {
  timer = 0;
  if (!target || !target.isConnected) { target = null; return; }
  getter = registry.get(target);
  if (!render()) return;
  box.hidden = false;
  shown = true;
  place();
  // keep live values fresh and drop the tip when its node is re-rendered away under a still mouse
  clearInterval(live);
  live = setInterval(() => {
    if (!shown) { clearInterval(live); live = 0; return; }
    if (!target || !target.isConnected) { hideTip(); return; }
    place();
  }, 200);
}

function sigOf(c) { return c.title + '|' + c.tag + '|' + c.meta.join('/') + '|' + c.lines.join('/'); }

function render() {
  ensure();
  const c = tipContent(typeof getter === 'function' ? getter() : getter);
  if (!c) { hideNow(); return false; }
  const sig = sigOf(c);
  if (sig !== liveSig) {
    liveSig = sig;
    titleEl.textContent = c.title;
    titleEl.hidden = !c.title;
    tagEl.textContent = c.tag; tagEl.hidden = !c.tag;
    metaEl.textContent = '';
    for (const m of c.meta) { const s = document.createElement('span'); s.textContent = m; metaEl.appendChild(s); }
    metaEl.hidden = !c.meta.length;
    bodyEl.textContent = '';
    for (const l of c.lines) { const p = document.createElement('p'); p.textContent = l; bodyEl.appendChild(p); }
    bodyEl.hidden = !c.lines.length;
  }
  return true;
}

/** Position near the pointer, flipped to the left / above when it would leave the window; never under the cursor. */
export function tipPosition(mxp, myp, w, h, vw, vh) {
  let x = mxp + GAP, y = myp + GAP;
  if (x + w + MARGIN > vw) x = mxp - GAP - w;       // flip to the left of the cursor
  if (y + h + MARGIN > vh) y = myp - GAP - h;       // flip above the cursor
  x = Math.max(MARGIN, Math.min(vw - w - MARGIN, x));
  y = Math.max(MARGIN, Math.min(vh - h - MARGIN, y));
  return { x, y };
}

function place() {
  if (!box || box.hidden) return;
  if (typeof getter === 'function') render();   // live values (cooldowns, counts)
  const r = box.getBoundingClientRect();
  const p = tipPosition(mx, my, r.width, r.height, window.innerWidth, window.innerHeight);
  box.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
}

function hideNow() {
  if (box) box.hidden = true;
  shown = false;
  liveSig = '';
}

/** Hide the tooltip now and forget the hovered node until the pointer moves again. */
export function hideTip() {
  clearTimeout(timer);
  timer = 0;
  target = null;
  hideNow();
}

/** Attach tooltip data (object, string or function returning either) to a node. Replaces the native title. */
export function tip(node, data) {
  if (!node) return node;
  install();
  if (node.removeAttribute) node.removeAttribute('title');
  registry.set(node, data);
  return node;
}

/** Remove the tooltip from a node. */
export function untip(node) {
  if (!node) return;
  registry.delete(node);
  if (target === node) hideTip();
}

export default tip;
