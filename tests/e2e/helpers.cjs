// Frozen e2e helpers (CommonJS). Playwright is preinstalled; do not npm install it.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Flags that give a working WebGL2 context (ANGLE on SwiftShader) in this container's headless Chromium.
 * Verified: UNMASKED_RENDERER = "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)...), SwiftShader driver)".
 */
const WEBGL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const VIEWPORT = { width: 1366, height: 657 }; // a school Chromebook's visible area

/** Spawn tools/serve.mjs on a free port. Resolves {url, port, stop()}. */
function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve.mjs'), '0'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    const timer = setTimeout(() => reject(new Error('server did not start')), 10000);
    proc.stdout.on('data', (d) => {
      buf += d;
      const m = buf.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) {
        clearTimeout(timer);
        const port = Number(m[1]);
        resolve({ url: `http://127.0.0.1:${port}`, port, proc, stop: () => proc.kill() });
      }
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('exit', (code) => { clearTimeout(timer); if (!buf.includes('Serving')) reject(new Error('server exited ' + code)); });
  });
}

/** Launch Chromium. webgl (default true) adds WEBGL_ARGS. Extra opts are passed to chromium.launch. */
async function launch({ webgl = true, headless = true, args = [], ...rest } = {}) {
  return chromium.launch({ headless, args: [...(webgl ? WEBGL_ARGS : []), ...args], ...rest });
}

/** New page at the default viewport. */
async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, ...opts });
  return ctx.newPage();
}

/** Attach console-error / pageerror collection to a page (idempotent). Returns the array. */
function collectErrors(page) {
  if (page.__errors) return page.__errors;
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.__errors = errors;
  return errors;
}

function query(params) {
  return Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/**
 * Load the game: /?renderer=X&test=1&debug=1&questions=auto&...params, wait for window.__game.ready.
 * @returns {Promise<{errors: string[]}>}
 */
async function openGame(page, { base, renderer = '2d', params = {}, timeout = 20000 } = {}) {
  const errors = collectErrors(page);
  const q = query({ renderer, test: 1, debug: 1, questions: 'auto', ...params });
  await page.goto(`${base || page.__base}/?${q}`);
  await page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout });
  return { errors };
}

/** Load the renderer gallery and wait for window.__gallery.ready. */
async function openGallery(page, { base, renderer = '2d', page: n = 0, timeout = 20000 } = {}) {
  const errors = collectErrors(page);
  await page.goto(`${base || page.__base}/tools/gallery.html?renderer=${renderer}&page=${n}`);
  await page.waitForFunction(() => window.__gallery && window.__gallery.ready === true, null, { timeout });
  return { errors };
}

/** Screenshot to a path (directories created). */
async function shot(page, file) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  await page.screenshot({ path: file });
  return file;
}

/** UNMASKED_RENDERER string of a fresh WebGL context in this page, or null when there is no WebGL. */
async function webglInfo(page) {
  return page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
}

module.exports = { ROOT, WEBGL_ARGS, VIEWPORT, startServer, launch, newPage, collectErrors, openGame, openGallery, shot, webglInfo };
