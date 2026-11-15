// STUB: replaced by the Sim package
// Zone loading via buildZoneGrid, solidity, markers, ZoneView, setTile, instant travel.
import { buildZoneGrid } from '../data/zones/mapgen.js';

export default {
  id: 'world',
  init(game) {
    const data = game.data;
    let view = null;
    const api = {
      loadZone(zoneId, markerOrXY) {
        const def = data.zones[zoneId];
        if (!def) throw new Error('world.loadZone: unknown zone ' + zoneId);
        const from = game.zone ? game.zone.id : null;
        if (game.zone) game.bus.emit('zone:unload', { zone: game.zone });
        const g = buildZoneGrid(def, data.tiles.index);
        const props = [];
        for (const p of (def.props || []).concat(g.props || [])) {
          const pd = data.props[p.kind] || null;
          const fp = pd && pd.footprint;
          props.push({ id: p.id || null, kind: p.kind, def: pd, look: Object.assign({}, pd && pd.look, p.look),
            x: p.x, y: p.y, w: fp ? fp[0] : 1, h: fp ? fp[1] : 1, interact: p.interact || null });
        }
        const solid = new Uint8Array(g.w * g.h);
        for (let i = 0; i < solid.length; i++) solid[i] = data.tiles.list[g.tiles[i]].solid ? 1 : 0;
        for (const p of props) {
          if (!p.def || !p.def.solid || !p.def.footprint) continue;
          for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
            if (x >= 0 && y >= 0 && x < g.w && y < g.h) solid[y * g.w + x] = 1;
          }
        }
        const pal = data.palettes.PALETTES || {};
        const zone = { id: def.id, def, name: def.name || def.id, w: g.w, h: g.h, tiles: g.tiles, variant: g.variant,
          solid, markers: def.markers || {}, props, palette: pal[def.palette] || pal.default || {} };
        game.zone = zone;
        view = null;
        const p = game.player;
        if (p) {
          const at = api.resolve(markerOrXY);
          p.x = p.px = at.x; p.y = p.py = at.y; p.vx = p.vy = 0;
        }
        game.bus.emit('zone:load', { zone, from });
        return zone;
      },
      resolve(markerOrXY) {
        if (Array.isArray(markerOrXY)) return { x: markerOrXY[0], y: markerOrXY[1] };
        if (markerOrXY && typeof markerOrXY === 'object') return { x: markerOrXY.x, y: markerOrXY.y };
        return api.marker(markerOrXY) || { x: (game.zone ? game.zone.w : 2) / 2, y: (game.zone ? game.zone.h : 2) / 2 };
      },
      travel(zoneId, marker) {
        game.bus.emit('zone:transition', { to: zoneId, phase: 'out' });
        api.loadZone(zoneId, marker);
        game.bus.emit('zone:transition', { to: zoneId, phase: 'in' });
      },
      solidAt(x, y) {
        const z = game.zone;
        if (!z) return true;
        const tx = Math.floor(x), ty = Math.floor(y);
        if (tx < 0 || ty < 0 || tx >= z.w || ty >= z.h) return true;
        return z.solid[ty * z.w + tx] === 1;
      },
      tileDefAt(x, y) {
        const z = game.zone;
        const tx = Math.floor(x), ty = Math.floor(y);
        if (!z || tx < 0 || ty < 0 || tx >= z.w || ty >= z.h) return null;
        return data.tiles.list[z.tiles[ty * z.w + tx]];
      },
      setTile(tx, ty, tileId) {
        const z = game.zone;
        const n = data.tiles.index[tileId];
        if (!z || n === undefined || tx < 0 || ty < 0 || tx >= z.w || ty >= z.h) return;
        z.tiles[ty * z.w + tx] = n;
        z.solid[ty * z.w + tx] = data.tiles.list[n].solid ? 1 : 0;
        game.bus.emit('tile:changed', { tx, ty });
      },
      marker(name) {
        const m = game.zone && game.zone.markers[name];
        return m ? { x: m[0] + 0.5, y: m[1] + 0.5 } : null;
      },
      los() { return true; },
      findPath() { return false; },
      zoneView() {
        const z = game.zone;
        if (!z) return null;
        if (!view) view = { id: z.id, w: z.w, h: z.h, tiles: z.tiles, variant: z.variant, tileDefs: data.tiles.list,
          props: z.props, palette: z.palette };
        return view;
      },
    };
    return api;
  },
  hud(game, hud) { hud.zoneName = game.zone ? game.zone.name : ''; },
};
