// Meta package. Key/value storage: localStorage when it works, otherwise an in-memory map
// (Node, private windows, blocked or full storage). Every method is safe to call: nothing here throws.
//
// storage = { kind: 'local'|'memory', get(key) -> string|null, set(key, value) -> bool, remove(key),
//             keys(prefix) -> string[], getJSON(key) -> obj|null, setJSON(key, obj) -> bool }

function withJSON(s) {
  s.getJSON = (key) => {
    const v = s.get(key);
    if (v == null) return null;
    try { return JSON.parse(v); } catch { return null; }
  };
  s.setJSON = (key, obj) => {
    let text;
    try { text = JSON.stringify(obj); } catch { return false; }
    return s.set(key, text);
  };
  return s;
}

export function createMemoryStorage() {
  const m = new Map();
  return withJSON({
    kind: 'memory',
    get(key) { return m.has(key) ? m.get(key) : null; },
    set(key, value) { m.set(key, String(value)); return true; },
    remove(key) { m.delete(key); },
    keys(prefix = '') { const out = []; for (const k of m.keys()) if (k.startsWith(prefix)) out.push(k); return out; },
  });
}

/**
 * localStorage-backed storage. If localStorage is missing or a write fails (quota, blocked), the storage
 * switches to an in-memory copy for the rest of the session so the game keeps working.
 */
export function createStorage(backend) {
  let ls = null;
  try {
    ls = backend || globalThis.localStorage || null;
    if (ls) { ls.setItem('__probe', '1'); ls.removeItem('__probe'); }
  } catch { ls = null; }
  if (!ls) return createMemoryStorage();
  const mem = createMemoryStorage();
  let failed = false;
  const s = {
    kind: 'local',
    get(key) {
      if (failed) return mem.get(key);
      try { return ls.getItem(key); } catch { return mem.get(key); }
    },
    set(key, value) {
      mem.set(key, value);
      if (failed) return true;
      try { ls.setItem(key, String(value)); return true; } catch {
        failed = true; s.kind = 'memory';
        if (typeof console !== 'undefined') console.warn('[storage] localStorage write failed; keeping saves in memory');
        return true;
      }
    },
    remove(key) { mem.remove(key); try { ls.removeItem(key); } catch { /* ignore */ } },
    keys(prefix = '') {
      const out = new Set(mem.keys(prefix));
      if (!failed) {
        try { for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(prefix)) out.add(k); } } catch { /* ignore */ }
      }
      return [...out];
    },
  };
  return withJSON(s);
}

export default createStorage;
