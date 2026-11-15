// STUB: replaced by the Meta package
// The __game debug API (main.js exposes it globally when debug=1 or test=1). No DOM here: main.js attaches a host
// {renderFrame(), snapshot() -> dataURL, renderer(), setRenderer(id)} via attachHost().
import { DT } from '../contracts.js';
import { scriptedInput } from '../platform/input.js';

export default {
  id: 'debug',
  always: true,
  init(game) {
    const sticky = scriptedInput();
    const errs = [];
    let host = null;
    const noop = () => undefined;
    const api = {
      ready: false,
      game,
      attachHost(h) { host = h; },
      logError(msg) { errs.push(String(msg)); },
      errors() { return errs.slice(); },
      state() {
        const p = game.player;
        return {
          t: game.t, tick: game.tick, zone: game.zone && game.zone.id, modal: game.modal && game.modal.type,
          freeze: [...game.freeze], flags: Object.assign({}, game.flags), entCount: game.ents.all.length,
          player: p ? { x: p.x, y: p.y, hp: p.hp, hpMax: p.hpMax, dir: p.dir, anim: p.anim } : null,
          camera: { x: game.camera.x, y: game.camera.y, zoom: game.camera.zoom },
        };
      },
      input(partial) { sticky.set(partial || {}); return api; },
      step(n = 1, input) {
        if (input) sticky.set(input);
        for (let i = 0; i < n; i++) game.step(DT, sticky.sample());
        if (host && host.renderFrame) host.renderFrame();
        return api.state();
      },
      teleport(zone, markerOrXY) {
        if (zone && zone !== (game.zone && game.zone.id)) game.world.loadZone(zone, markerOrXY);
        else { const at = game.world.resolve ? game.world.resolve(markerOrXY) : game.world.marker(markerOrXY);
          if (at && game.player) { game.player.x = game.player.px = at.x; game.player.y = game.player.py = at.y; game.snapCamera(); } }
        return api.state();
      },
      snapshot() { return host && host.snapshot ? host.snapshot() : null; },
      setRenderer(id) { return host && host.setRenderer ? host.setRenderer(id) : null; },
      renderStats() { const r = host && host.renderer && host.renderer(); return r ? r.stats() : null; },
      setFlag(k, v) { game.setFlag(k, v); },
      closeModal() { game.closeModal(); },
      command(name, ...args) { const fn = game.commands[name]; return fn ? fn(...args) : undefined; },
      scenario: noop, setLevel: noop, setClass: noop, setSpec: noop, giveItem: noop, giveGold: noop, god: noop,
      spawn: noop, killAll: noop, find: () => [], startCutscene: noop, skipCutscene: noop, completeQuest: noop,
      setTime: noop, answerQuestion: noop, save: noop, load: noop, reset: noop,
    };
    return api;
  },
  update() {},
};
