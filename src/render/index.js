// Frozen. Renderer factory: dynamic import so 2D players never download three; 3D falls back to 2D.
const LOADERS = {
  '2d': () => import('./r2d/index.js'),
  '3d': () => import('./r3d/index.js'),
};

/**
 * @param {'2d'|'3d'} id
 * @param {HTMLElement} hostEl
 * @param {{quality?: number, fallback?: boolean}} [opts]
 * @returns {Promise<import('../contracts.js').Renderer>} the renderer actually created (check `.id`)
 */
export async function createRenderer(id, hostEl, opts = {}) {
  const want = LOADERS[id] ? id : '2d';
  try {
    const mod = await LOADERS[want]();
    const r = mod.create();
    await r.init(hostEl, { quality: opts.quality ?? 1 });
    return r;
  } catch (err) {
    if (want === '2d' || opts.fallback === false) throw err;
    console.warn('[render] ' + want + ' renderer failed, falling back to 2d:', err && err.message);
    return createRenderer('2d', hostEl, opts);
  }
}

/**
 * Hot swap: dispose `old`, create `id`, and reload `zoneView` into it.
 * @returns {Promise<import('../contracts.js').Renderer>}
 */
export async function swapRenderer(old, id, hostEl, opts = {}, zoneView = null) {
  if (old) {
    try { old.unloadZone(); } catch { /* ignore */ }
    old.dispose();
  }
  const r = await createRenderer(id, hostEl, opts);
  r.resize(hostEl.clientWidth, hostEl.clientHeight);
  if (zoneView) r.loadZone(zoneView);
  return r;
}

export default createRenderer;
