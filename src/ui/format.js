// Pure UI helpers (no DOM): unit-tested in tests/node/ui.test.mjs.

export const NAME_MAX = 12;
export const SAVE_PREFIX = 'flinkerton.v1.';

/** Title screen name filter: letters, numbers and single spaces, no leading space, max length. */
export function sanitizeName(s, max = NAME_MAX) {
  let out = String(s || '').replace(/[^A-Za-z0-9 ]+/g, '').replace(/ {2,}/g, ' ').replace(/^ +/, '');
  if (out.length > max) out = out.slice(0, max);
  return out;
}

/** The name as it will be used (trailing space trimmed). Empty when nothing usable was typed. */
export function finalName(s, max = NAME_MAX) { return sanitizeName(s, max).trim(); }

/** Saved games in a storage ({keys(prefix), getJSON(key)}): [{name, key, level, zone, save}], newest name order. */
export function listSaves(storage, prefix = SAVE_PREFIX) {
  if (!storage || !storage.keys) return [];
  const out = [];
  for (const key of storage.keys(prefix)) {
    const name = key.slice(prefix.length);
    if (!name) continue;
    let save = null;
    try { save = storage.getJSON(key); } catch { save = null; }
    if (!save || typeof save !== 'object') continue;
    const prog = save.systems && save.systems.progression;
    out.push({ name: save.name || name, key, level: prog && prog.level ? prog.level : null, zone: save.zone || null, save });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** 1 -> 'I' ... 10 -> 'X' (other numbers as digits). */
export function roman(n) { return ROMAN[n] || String(n); }

export function clamp01(v) { return v > 1 ? 1 : v > 0 ? v : 0; }

/** Safe fraction a/b in 0..1 (0 when b <= 0). */
export function frac(a, b) { return b > 0 ? clamp01(a / b) : 0; }

/** Compact number: 1234 -> '1,234', 12500 -> '12.5k'. */
export function fmtNum(n) {
  n = Math.floor(Number(n) || 0);
  if (Math.abs(n) >= 100000) return (n / 1000).toFixed(0) + 'k';
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString('en-US');
}

/** Characters visible after `elapsed` seconds at `cps` characters per second (punctuation pauses a little). */
export function typewriterCount(text, elapsed, cps = 48) {
  const s = String(text || '');
  let budget = elapsed * cps;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const cost = c === '.' || c === '!' || c === '?' ? 5 : c === ',' ? 2.5 : 1;
    if (budget < cost) break;
    budget -= cost;
    i++;
  }
  return i;
}

/**
 * Move a list cursor by `delta`, wrapping, skipping entries for which `skip(i)` is true.
 * Returns the current index if every entry is skipped.
 */
export function stepIndex(index, delta, n, skip) {
  if (n <= 0) return -1;
  let i = index;
  for (let k = 0; k < n; k++) {
    i = ((i + delta) % n + n) % n;
    if (!skip || !skip(i)) return i;
  }
  return index;
}

/** First index not skipped (or 0). */
export function firstIndex(n, skip) {
  for (let i = 0; i < n; i++) if (!skip || !skip(i)) return i;
  return 0;
}

/** 'Space' / 'Shift' / 'Q' -> short label for a key cap. */
export function keyLabel(key) {
  const k = String(key || '');
  if (k === 'Space') return 'Space';
  if (k === 'Shift') return 'Shift';
  if (k.startsWith('Key')) return k.slice(3);
  if (k.startsWith('Digit')) return k.slice(5);
  if (k.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[k] || k;
  return k;
}

/** One-line how-to for an ability banner. */
export function howTo(ability) {
  if (!ability) return '';
  const key = keyLabel(ability.key || ability.slot || '');
  const d = String(ability.desc || '').split(/(?<=[.!])\s/)[0];
  return d ? `Press ${key}: ${d}` : `Press ${key} to use it.`;
}

/** Greedy word wrap with a measure function (canvas measureText width or char count). */
export function wrapWords(text, maxW, measure = (s) => s.length) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (line && measure(t) > maxW) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** Normalize the different shapes a class/spec picker's `abilities` may come in to [{slot, name, icon, desc, unlock}]. */
export function normalizeAbilities(ab) {
  if (!ab) return [];
  const list = Array.isArray(ab) ? ab : Object.keys(ab).map((slot) => Object.assign({ slot }, ab[slot]));
  return list.filter(Boolean).map((a) => ({
    slot: a.slot || '', key: a.key || slotKey(a.slot), name: a.name || a.id || '', icon: a.icon || 'star',
    desc: a.desc || a.blurb || '', unlock: a.unlock ?? a.unlockLevel ?? null,
  }));
}

/** Normalize `basic` ({name, icon, desc} | string) to an object. */
export function normalizeBasic(b) {
  if (!b) return null;
  if (typeof b === 'string') return { name: b, icon: 'sword', desc: '' };
  const r = Array.isArray(b.ranks) && b.ranks[0] ? b.ranks[0] : null;
  return { name: b.name || (r && r.name) || '', icon: b.icon || 'sword', desc: b.desc || (r && r.desc) || '' };
}

export function slotKey(slot) {
  return { space: 'Space', q: 'Q', f: 'F', shift: 'Shift' }[slot] || '';
}

/** Normalize inventory `items` ({id: n} | [{id, n|count}] ) to [{id, count}] with defs from data.items when present. */
export function normalizeItems(items, defs = {}) {
  if (!items) return [];
  const list = Array.isArray(items)
    ? items.map((it) => (typeof it === 'string' ? { id: it, count: 1 } : it))
    : Object.keys(items).map((id) => ({ id, count: items[id] }));
  return list.filter((it) => it && it.id && (it.count ?? it.n ?? 1) > 0).map((it) => {
    const d = defs[it.id] || {};
    return {
      id: it.id, count: it.count ?? it.n ?? 1, name: it.name || d.name || it.id, icon: it.icon || d.icon || 'potion',
      desc: it.desc || d.desc || '', type: it.type || d.type || 'consumable',
    };
  });
}

/** Normalize cosmetics ([id] | [{id, name, icon, slot}]) using data.items defs. */
export function normalizeCosmetics(list, defs = {}, equipped = {}) {
  if (!list) return [];
  const eq = new Set(Object.values(equipped || {}).filter(Boolean));
  return (Array.isArray(list) ? list : Object.keys(list)).map((c) => {
    const id = typeof c === 'string' ? c : c.id;
    const d = defs[id] || {};
    const o = typeof c === 'string' ? {} : c;
    return { id, name: o.name || d.name || id, icon: o.icon || d.icon || 'hat', desc: o.desc || d.desc || '',
      slot: o.slot || (d.look && d.look.hat ? 'hat' : d.look && d.look.cape ? 'cape' : d.slot || ''),
      equipped: o.equipped ?? eq.has(id) };
  });
}

/** Parse '#rgb' / '#rrggbb' to [r, g, b]. */
export function hexToRgb(hex) {
  let h = String(hex || '#000').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix two hex colors (t = 0 -> a, 1 -> b). */
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = (i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return '#' + c(0) + c(1) + c(2);
}

/** Darken (amount > 0) or lighten (amount < 0) a hex color. */
export function shade(hex, amount) { return amount >= 0 ? mixHex(hex, '#000000', amount) : mixHex(hex, '#ffffff', -amount); }
