// STUB: replaced by the Meta package
// localStorage wrapper with an in-memory fallback (Node, private windows, blocked storage).

export function createMemoryStorage() {
  const m = new Map();
  return {
    kind: 'memory',
    get(key) { return m.has(key) ? m.get(key) : null; },
    set(key, value) { m.set(key, String(value)); },
    remove(key) { m.delete(key); },
    keys(prefix = '') { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
    getJSON(key) { const v = this.get(key); try { return v == null ? null : JSON.parse(v); } catch { return null; } },
    setJSON(key, obj) { this.set(key, JSON.stringify(obj)); },
  };
}

export function createStorage() {
  let ls = null;
  try {
    ls = globalThis.localStorage || null;
    if (ls) { ls.setItem('__probe', '1'); ls.removeItem('__probe'); }
  } catch { ls = null; }
  if (!ls) return createMemoryStorage();
  return {
    kind: 'local',
    get(key) { try { return ls.getItem(key); } catch { return null; } },
    set(key, value) { try { ls.setItem(key, String(value)); } catch { /* quota */ } },
    remove(key) { try { ls.removeItem(key); } catch { /* ignore */ } },
    keys(prefix = '') {
      const out = [];
      try { for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch { /* ignore */ }
      return out;
    },
    getJSON(key) { const v = this.get(key); try { return v == null ? null : JSON.parse(v); } catch { return null; } },
    setJSON(key, obj) { this.set(key, JSON.stringify(obj)); },
  };
}

export default createStorage;
