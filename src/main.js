// Boot (CONTRACTS section 2): title -> createGame -> renderer -> UI -> loop.
// Round 2 (package A): key bindings load from storage before anything reads them; 3D is the default look
// (config.defaultRenderer; `?renderer=2d` is a hidden developer override and the automatic fallback); saved graphics
// quality; the teacher's question settings; teacher games (game.teacher, Questions.teacher, the TEACHER badge).
import { DT } from './contracts.js';
import { config } from './config.js';
import data from './data/index.js';
import { createGame } from './core/game.js';
import { createLoop } from './platform/loop.js';
import { createInput } from './platform/input.js';
import { createStorage } from './platform/storage.js';
import { createAudio } from './platform/audio.js';
import { createRenderer, swapRenderer } from './render/index.js';
import { createUI } from './ui/index.js';
import Questions from './questions/index.js';
import stubProvider from './questions/stubProvider.js';
import customProvider from './questions/custom.js';
import { loadBindings } from './platform/bindings.js';
import { savedQuality } from './ui/settings.js';
import { applyQuestionSettings, displayName, teacherBadge, TEACHER_TAG } from './ui/teacher.js';

function parseParams(search) {
  const q = new URLSearchParams(search);
  const flag = (k) => q.get(k) === '1' || q.get(k) === 'true';
  const marker = q.get('marker');
  return {
    renderer: q.get('renderer') === '3d' ? '3d' : q.get('renderer') === '2d' ? '2d' : null,
    questions: ['off', 'auto', 'stub'].includes(q.get('questions')) ? q.get('questions') : null,
    debug: flag('debug'),
    test: flag('test'),
    perf: flag('perf'),
    skipintro: flag('skipintro'),
    seed: q.has('seed') ? Number(q.get('seed')) >>> 0 : null,
    zone: q.get('zone') || null,                                                // added
    marker: marker && /^-?[\d.]+,-?[\d.]+$/.test(marker) ? marker.split(',').map(Number) : marker, // added
    quality: q.has('quality') ? Math.max(0, Math.min(2, Number(q.get('quality')) | 0)) : null,  // added
  };
}

async function boot() {
  const params = parseParams(location.search);
  const appEl = document.getElementById('app');
  const viewEl = document.getElementById('view');
  const errors = [];
  let game = null;
  const logError = (msg) => { errors.push(msg); if (game && game.debug && game.debug.logError) game.debug.logError(msg); };
  window.addEventListener('error', (e) => logError(String(e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => logError('unhandledrejection: ' + String(e.reason && (e.reason.stack || e.reason))));

  const storage = createStorage();
  loadBindings(storage);
  Questions.mode = params.questions || (params.test ? 'auto' : 'stub');
  Questions.setProvider(customProvider || stubProvider);
  const baseMode = Questions.mode;

  const ui = createUI(appEl, { params, storage, config });
  const choice = await ui.title();
  const rendererId = params.renderer || config.defaultRenderer || '3d';
  let quality = params.quality ?? savedQuality(storage) ?? config.defaultQuality;
  // the title's teacher options may have changed these
  applyQuestionSettings(Questions, storage, params, baseMode);
  const teacher = choice.teacher === true;
  Questions.teacher = teacher;
  // a teacher game saves under "<name> (teacher)"; only the part before the tag is limited to the name length
  const rawName = choice.name || 'Hero';
  const shown = displayName(rawName).slice(0, config.nameMaxLength) || 'Hero';
  const gameName = teacher ? shown + TEACHER_TAG : shown;

  game = createGame({
    data,
    name: gameName,
    seed: params.seed ?? (params.test ? config.testSeed : (Math.random() * 4294967296) >>> 0),
    storage,
    questions: Questions,
    save: choice.continueSave || null,
    zone: params.zone,
    marker: params.marker || undefined,
    test: params.test,
  });
  for (const m of errors) if (game.debug && game.debug.logError) game.debug.logError(m);
  // teacher mode: set only here (after the PIN on the title screen); a normal game never becomes a teacher game
  game.teacher = teacher;
  if (teacher) game.setFlag('teacher_game', true);
  else if (game.flags.teacher_game) delete game.flags.teacher_game;
  const showName = () => { const p = game.player; if (p) { p.name = shown; if (p.data) p.data.name = shown; } };
  if (teacher) { showName(); game.bus.on('zone:load', showName); }

  let renderer = await createRenderer(rendererId, viewEl, { quality });
  renderer.resize(viewEl.clientWidth, viewEl.clientHeight);
  renderer.loadZone(game.world.zoneView());
  game.bus.on('zone:load', () => renderer.loadZone(game.world.zoneView()));
  game.bus.on('zone:unload', () => renderer.unloadZone());
  game.bus.on('tile:changed', ({ tx, ty }) => renderer.tileChanged(tx, ty));

  const input = createInput(window, { isBlocked: () => !!game.modal });
  const audio = createAudio();
  audio.attach(game);
  ui.mount(game, renderer);
  if (teacher) viewEl.appendChild(teacherBadge());

  const rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let perfEl = null, perfT = 0;
  if (params.perf) {
    perfEl = document.createElement('div');
    perfEl.id = 'perf';
    document.getElementById('hud').appendChild(perfEl);
  }
  const renderFrame = (alpha) => {
    renderer.viewRect(rect);
    game.setViewRect(rect);
    renderer.render(game.frame(alpha));
    ui.update(game);
    if (perfEl && ++perfT % 15 === 0) {
      const s = renderer.stats();
      perfEl.textContent = `${renderer.id} ${s.ms.toFixed(1)}ms draws ${s.draws} tris ${s.tris}`;
    }
  };

  let swapping = null;
  const setRenderer = (id) => {
    if (id === renderer.id && !swapping) return Promise.resolve(renderer);
    swapping = (swapping || Promise.resolve()).then(async () => {
      renderer = await swapRenderer(renderer, id, viewEl, { quality }, game.world.zoneView());
      ui.setRenderer(renderer);
      renderFrame(1);
      return renderer;
    }).finally(() => { swapping = null; });
    return swapping;
  };
  game.commands.setRenderer = setRenderer;
  game.commands.setQuality = (q) => { quality = q; renderer.setQuality(q); };
  game.commands.quitToTitle = () => { location.href = location.pathname + location.search; };

  const loop = createLoop({
    step: (dt) => game.step(dt, input.sample(dt)),
    render: renderFrame,
    maxSteps: config.maxCatchUpSteps,
    manual: params.test,
    onError: (e) => logError(String(e && (e.stack || e))),
  });

  const ro = new ResizeObserver(() => renderer.resize(viewEl.clientWidth, viewEl.clientHeight));
  ro.observe(viewEl);

  if (params.debug || params.test) {
    const dbg = game.debug;
    dbg.attachHost({
      renderFrame: () => renderFrame(1),
      renderer: () => renderer,
      setRenderer,
      snapshot: () => {
        renderFrame(1);
        const src = viewEl.querySelector('canvas:not(#overlay)');
        const overlay = document.getElementById('overlay');
        const c = document.createElement('canvas');
        c.width = viewEl.clientWidth; c.height = viewEl.clientHeight;
        const ctx = c.getContext('2d');
        if (src) ctx.drawImage(src, 0, 0, c.width, c.height);
        if (overlay && overlay.width) ctx.drawImage(overlay, 0, 0, c.width, c.height);
        return c.toDataURL('image/png');
      },
    });
    window.__game = dbg;
    window.__DT = DT;
  }

  renderFrame(1);
  loop.start();
  if (game.debug) game.debug.ready = true;
}

boot().catch((e) => {
  console.error('[boot] failed:', e);
  const el = document.getElementById('panel');
  if (el) { const p = document.createElement('pre'); p.textContent = 'Oops, the game failed to start:\n' + (e && e.message); el.appendChild(p); }
});
