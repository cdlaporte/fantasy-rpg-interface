// Frozen. The game object (CONTRACTS section 2). Runs under Node: no DOM, no Date, no Math.random.
import { createBus } from './events.js';
import { createRng } from './rng.js';
import { SYSTEMS, INIT_FIRST } from './systems.js';
import { config } from '../config.js';
import {
  DT, VIEW, makeInputState, makeFrameState, makeHudState, makeEntityView, makeFxEvent, assignFxEvent,
} from '../contracts.js';
import { createMemoryStorage } from '../platform/storage.js';
import Questions from '../questions/index.js';

const NOOP = () => {};

/** Every command the UI may call (section 9). Systems overwrite these in init(); defaults are safe no-ops. */
const COMMAND_NAMES = [
  'dialogueAdvance', 'dialogueChoose', 'shopBuy', 'shopHaggle', 'pickLook', 'pickClass', 'pickSpec', 'pickBoon',
  'setRenderer', 'setQuality', 'saveNow', 'quitToTitle', 'assignSlot', 'equipCosmetic',
  'useSlot', 'openInventory', 'openPause', 'interact',
];

/**
 * @param {Object} opts
 * @param {Object} opts.data       src/data/index.js export
 * @param {string} [opts.name]     player name
 * @param {number} [opts.seed]
 * @param {Object} [opts.storage]  platform/storage.js instance (memory storage by default)
 * @param {Object} [opts.questions] questions module (src/questions/index.js default export)
 * @param {Object} [opts.save]     save JSON to continue from (section 12) or null
 * @param {string} [opts.zone]     added: start zone override (default config.startZone, then config.fallbackZone)
 * @param {string|number[]} [opts.marker] added: start marker or [x, y]
 * @param {boolean} [opts.test]    added: test mode flag (exposed as game.test)
 */
export function createGame(opts = {}) {
  const data = opts.data;
  if (!data) throw new Error('createGame: opts.data is required');
  const seed = (opts.seed ?? config.testSeed) >>> 0;
  const bus = createBus();

  const frameState = makeFrameState();
  const hud = makeHudState();
  const fxQueue = [];
  let fxQueued = 0;
  const viewRect = { x0: 0, y0: 0, x1: 0, y1: 0, set: false };
  const camPrev = { x: 0, y: 0 };
  const neutralInput = makeInputState();

  const game = {
    data,
    config,
    bus,
    rng: createRng(seed),
    seed,
    t: 0,
    tick: 0,
    input: neutralInput,
    freeze: new Set(),
    inputLock: 0,
    modal: null,
    flags: {},
    player: null,
    zone: null,
    camera: { x: 0, y: 0, zoom: 1, shake: 0, target: null, mode: 'follow' },
    /** added: presentation ambience, mutated by the clock system, copied into FrameState.ambience. */
    ambience: { daypart: 'morning', tint: '#ffffff', tintAmount: 0 },
    commands: {},
    sys: {},
    storage: opts.storage || createMemoryStorage(),
    questions: opts.questions || Questions,
    test: !!opts.test,
    name: opts.name || 'Hero',
    ready: false,

    step(dt = DT, input) {
      game.input = input || neutralInput;
      game.tick++;
      game.t += dt;
      // px,py = position at the previous step, for interpolation.
      const all = game.ents ? game.ents.all : null;
      if (all) {
        for (let i = 0; i < all.length; i++) { const e = all[i]; e.px = e.x; e.py = e.y; }
      }
      camPrev.x = game.camera.x; camPrev.y = game.camera.y;
      const frozen = game.freeze.size > 0;
      for (let i = 0; i < SYSTEMS.length; i++) {
        const s = SYSTEMS[i];
        if (!s.update) continue;
        if (frozen && !s.always) continue;
        s.update(game, dt);
      }
      updateCamera(dt);
    },

    /** added: the renderer's last viewRect (world tiles); frame() culls entities to it + VIEW.CULL_MARGIN. */
    setViewRect(r) {
      viewRect.x0 = r.x0; viewRect.y0 = r.y0; viewRect.x1 = r.x1; viewRect.y1 = r.y1; viewRect.set = true;
    },

    frame(alpha = 1) {
      const f = frameState;
      f.t = game.t;
      f.alpha = alpha;
      const cam = game.camera;
      f.camera.x = camPrev.x + (cam.x - camPrev.x) * alpha;
      f.camera.y = camPrev.y + (cam.y - camPrev.y) * alpha;
      f.camera.zoom = cam.zoom;
      f.camera.shake = cam.shake;
      f.ambience.daypart = game.ambience.daypart;
      f.ambience.tint = game.ambience.tint;
      f.ambience.tintAmount = game.ambience.tintAmount;

      const m = VIEW.CULL_MARGIN;
      const x0 = viewRect.x0 - m, y0 = viewRect.y0 - m, x1 = viewRect.x1 + m, y1 = viewRect.y1 + m;
      const cull = viewRect.set;
      const all = game.ents ? game.ents.all : [];
      let n = 0;
      for (let i = 0; i < all.length; i++) {
        const e = all[i];
        if (e.asleep || e.removed) continue;
        if (cull && (e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1)) continue;
        let v = f.ents[n];
        if (!v) { v = makeEntityView(); f.ents[n] = v; }
        copyView(v, e);
        n++;
      }
      f.entCount = n;

      for (let i = 0; i < fxQueued; i++) {
        let d = f.fx[i];
        if (!d) { d = makeFxEvent(); f.fx[i] = d; }
        assignFxEvent(d, fxQueue[i]);
      }
      f.fxCount = fxQueued;
      fxQueued = 0;
      return f;
    },

    hudState() {
      for (let i = 0; i < SYSTEMS.length; i++) {
        const s = SYSTEMS[i];
        if (s.hud) s.hud(game, hud);
      }
      return hud;
    },

    fx(evt) {
      if (fxQueued >= config.fxQueueMax) return;
      let d = fxQueue[fxQueued];
      if (!d) { d = makeFxEvent(); fxQueue[fxQueued] = d; }
      assignFxEvent(d, evt);
      fxQueued++;
    },

    toast(text, style = 'info') { bus.emit('toast', { text, style }); },

    setFlag(k, v = true) {
      game.flags[k] = v;
      bus.emit('flag', { key: k, value: v });
    },

    lockInput() { game.inputLock++; },
    unlockInput() { game.inputLock = Math.max(0, game.inputLock - 1); },

    /** Opening while another modal is open replaces it (the old one gets 'modal:close' with result undefined). */
    openModal(modal) {
      if (game.modal) game.closeModal(undefined);
      game.modal = modal;
      game.freeze.add('modal');
      bus.emit('modal:open', { modal });
    },
    /** added: if the modal has an `onClose(result)` function it is called after 'modal:close'. */
    closeModal(result) {
      const m = game.modal;
      if (!m) return;
      game.modal = null;
      game.freeze.delete('modal');
      bus.emit('modal:close', { type: m.type, result });
      if (typeof m.onClose === 'function') m.onClose(result);
    },

    /** added: save fan-out -> {systemId: json} for every system with a save hook. */
    saveSystems() {
      const out = {};
      for (const s of SYSTEMS) {
        if (!s.save) continue;
        const j = s.save(game);
        if (j !== undefined) out[s.id] = j;
      }
      return out;
    },
    /** added: load fan-out from {systemId: json}. */
    loadSystems(obj) {
      if (!obj) return;
      for (const s of SYSTEMS) {
        if (s.load && obj[s.id] !== undefined) s.load(game, obj[s.id]);
      }
    },
  };

  for (const name of COMMAND_NAMES) game.commands[name] = NOOP;
  game.commands.closeModal = (result) => game.closeModal(result);

  function copyView(v, e) {
    v.id = e.id; v.kind = e.kind; v.type = e.type; v.look = e.look; v.lookRev = e.lookRev;
    v.x = e.x; v.y = e.y; v.px = e.px; v.py = e.py; v.z = e.z;
    v.dir = e.dir; v.angle = e.angle; v.anim = e.anim; v.animT = e.animT;
    v.scale = e.scale; v.alpha = e.alpha; v.flash = e.flash; v.tint = e.tint; v.glow = e.glow;
    v.fxTags = e.fxTags;
    v.hpFrac = e.hpMax > 0 ? Math.max(0, Math.min(1, e.hp / e.hpMax)) : 1;
    const dx = e.x - e.px, dy = e.y - e.py;
    v.moving = dx * dx + dy * dy > 1e-8;
    v.name = e.name || ''; v.team = e.team; v.radius = e.radius;
  }

  function updateCamera(dt) {
    const cam = game.camera;
    if (cam.mode === 'follow' && cam.target != null && game.ents) {
      const t = game.ents.get(cam.target);
      if (t) { cam.x = t.x; cam.y = t.y; }
    }
    if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 2);
  }

  /** added: jump the camera to its target with no interpolation (zone loads, teleports). */
  game.snapCamera = () => {
    updateCamera(0);
    camPrev.x = game.camera.x; camPrev.y = game.camera.y;
  };

  // ---- init systems: INIT_FIRST, then the rest in update order ----
  const byId = new Map(SYSTEMS.map((s) => [s.id, s]));
  const order = INIT_FIRST.map((id) => byId.get(id)).concat(SYSTEMS.filter((s) => !INIT_FIRST.includes(s.id)));
  for (const s of order) {
    const api = s.init ? s.init(game) : {};
    game.sys[s.id] = api || {};
    // game.player is the player ENTITY (section 2); the player system's api is only at game.sys.player.
    if (s.id !== 'player') game[s.id] = game.sys[s.id];
  }
  // Commands that the core can satisfy itself, unless a system already provided them.
  if (game.commands.saveNow === NOOP) game.commands.saveNow = () => game.save && game.save.now && game.save.now();

  // Zone hook fan-out. Subscribed before anyone else, so systems see the zone before renderers / UI.
  bus.on('zone:unload', ({ zone }) => {
    for (const s of SYSTEMS) if (s.onZoneUnload) s.onZoneUnload(game, zone);
  });
  bus.on('zone:load', ({ zone }) => {
    for (const s of SYSTEMS) if (s.onZoneLoad) s.onZoneLoad(game, zone);
    game.snapCamera();
  });

  if (game.player && game.camera.target == null) game.camera.target = game.player.id;

  // ---- start: continue a save or begin a new game ----
  const save = opts.save || null;
  if (save) {
    game.flags = Object.assign({}, save.flags || {});
    game.loadSystems(save.systems);
    game.world.loadZone(save.zone, [save.x, save.y]);
  } else {
    let zone = opts.zone || config.startZone;
    if (!data.zones[zone] || !data.zones[zone].id) zone = config.fallbackZone;
    game.world.loadZone(zone, opts.marker || config.startMarker);
  }
  game.ready = true;
  return game;
}

export default createGame;
