// World (CONTRACTS section 5 + 12a): zone loading and fade travel, tile queries, LOS, A* pathfinding, and the
// zone furniture: spawns with respawn timers, exits, triggers, rune-seal gates, chests, interactive prop anchors.
// Ops owned here: teleport, travel, spawn, despawn, gate.open.
import { buildZoneGrid } from '../data/zones/mapgen.js';

const MAX_NODES = 400;
const HEAP_CAP = 4096;
const SQRT2 = Math.SQRT2;
const NDX = [1, -1, 0, 0, 1, -1, 1, -1];
const NDY = [0, 0, 1, -1, 1, 1, -1, -1];
const TRANSITION_STEPS = 12;     // steps of fade-out and of fade-in
const RESPAWN_MIN_DIST = 10;     // never respawn within this many tiles of the player

export default {
  id: 'world',
  // always: the fade timer must run while freeze 'transition' is set. Furniture logic skips frozen steps itself.
  always: true,
  init(game) {
    const data = game.data;
    let view = null;
    let trans = null;            // {to, marker, phase, t, resolve, promise, outSteps, inSteps}
    const warned = new Set();
    const warnOnce = (k, msg) => { if (!warned.has(k)) { warned.add(k); if (typeof console !== 'undefined') console.warn(msg); } };

    // A* buffers (resized per zone).
    let gBuf = new Float32Array(1), parent = new Int32Array(1), stamp = new Uint32Array(1), closed = new Uint32Array(1);
    let curStamp = 0;
    const heapNode = new Int32Array(HEAP_CAP), heapF = new Float32Array(HEAP_CAP);
    const rev = new Int32Array(MAX_NODES + 8);
    let pw = 1, pgx = 0, pgy = 0, hn = 0;
    function heur(i) { const ax = Math.abs((i % pw) - pgx), ay = Math.abs(((i / pw) | 0) - pgy); return ax + ay + (SQRT2 - 2) * (ax < ay ? ax : ay); }
    function heapPush(node, f) {
      if (hn >= HEAP_CAP) return;
      let i = hn++;
      while (i > 0) { const pi = (i - 1) >> 1; if (heapF[pi] <= f) break; heapNode[i] = heapNode[pi]; heapF[i] = heapF[pi]; i = pi; }
      heapNode[i] = node; heapF[i] = f;
    }
    function heapPop() {
      const top = heapNode[0];
      hn--;
      if (hn > 0) {
        const node = heapNode[hn], f = heapF[hn];
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= hn) break;
          if (c + 1 < hn && heapF[c + 1] < heapF[c]) c++;
          if (heapF[c] >= f) break;
          heapNode[i] = heapNode[c]; heapF[i] = heapF[c]; i = c;
        }
        heapNode[i] = node; heapF[i] = f;
      }
      return top;
    }

    function tileClass(n) {
      const t = data.tiles.list[n];
      if (!t) return 0;
      if (!t.solid) return 0;
      return t.shape === 'block' ? 2 : 1;       // 2: wall (blocks everyone), 1: water/pit (blocks walkers only)
    }
    function recompute(z, i) {
      const c = tileClass(z.tiles[i]);
      const hard = z.propSolid[i] === 1 || z.block[i] > 0;
      z.solid[i] = c > 0 || hard ? 1 : 0;
      z.wall[i] = c === 2 || hard ? 1 : 0;
    }
    function inBounds(z, tx, ty) { return tx >= 0 && ty >= 0 && tx < z.w && ty < z.h; }

    const api = {
      loadZone(zoneId, markerOrXY) {
        const def = data.zones[zoneId];
        if (!def) throw new Error('world.loadZone: unknown zone ' + zoneId);
        const from = game.zone ? game.zone.id : null;
        if (game.zone) { game.zone.unloading = true; game.bus.emit('zone:unload', { zone: game.zone }); }
        const g = buildZoneGrid(def, data.tiles.index);
        const props = [];
        const all = (def.props || []).concat(g.props || []);
        for (const p of all) {
          const pd = data.props[p.kind] || null;
          const fp = pd && pd.footprint;
          props.push({ id: p.id || null, kind: p.kind, def: pd, look: Object.assign({}, pd && pd.look, p.look),
            x: p.x, y: p.y, w: fp ? fp[0] : 1, h: fp ? fp[1] : 1, footless: !fp, interact: p.interact || null });
        }
        const n = g.w * g.h;
        const zone = {
          id: def.id || zoneId, def, name: def.name || def.id || zoneId, w: g.w, h: g.h, tiles: g.tiles, variant: g.variant,
          solid: new Uint8Array(n), wall: new Uint8Array(n), propSolid: new Uint8Array(n), block: new Uint8Array(n),
          markers: def.markers || {}, props,
          palette: data.palettes.resolvePalette ? data.palettes.resolvePalette(def.palette)
            : ((data.palettes.PALETTES || {})[def.palette] || {}),
          exitRects: [], spawners: [], triggerState: [], anchors: [], unloading: false,
        };
        for (const p of props) {
          if (!p.def || !p.def.solid || !p.def.footprint) continue;
          for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
            if (inBounds(zone, x, y)) zone.propSolid[y * zone.w + x] = 1;
          }
        }
        for (let i = 0; i < n; i++) recompute(zone, i);
        game.zone = zone;
        view = null;
        if (gBuf.length < n) {
          gBuf = new Float32Array(n); parent = new Int32Array(n); stamp = new Uint32Array(n); closed = new Uint32Array(n);
          curStamp = 0;
        }
        const p = game.player;
        if (p) {
          const at = api.resolve(markerOrXY);
          p.x = p.px = at.x; p.y = p.py = at.y; p.vx = p.vy = 0; p.kx = p.ky = 0;
          if (p.data.moveTo) p.data.moveTo = null;
        }
        game.bus.emit('zone:load', { zone, from });
        return zone;
      },

      /** [x, y] | {x, y} | marker name -> {x, y}. Unknown markers warn once and give the zone center. */
      resolve(markerOrXY) {
        if (Array.isArray(markerOrXY)) return { x: markerOrXY[0], y: markerOrXY[1] };
        if (markerOrXY && typeof markerOrXY === 'object') return { x: markerOrXY.x, y: markerOrXY.y };
        const m = markerOrXY != null ? api.marker(markerOrXY) : null;
        if (m) return m;
        if (markerOrXY != null) warnOnce('m:' + markerOrXY, 'world.resolve: unknown marker ' + markerOrXY);
        return { x: (game.zone ? game.zone.w : 2) / 2, y: (game.zone ? game.zone.h : 2) / 2 };
      },

      /**
       * Fade travel: freeze 'transition', 'zone:transition' {phase:'out'}, wait, load (or move within the zone),
       * {phase:'in'}, wait, unfreeze. Returns a Promise resolved when the fade-in ends.
       * opts: {instant: true} loads immediately (both events in the same call); {steps: n} per phase.
       */
      travel(zoneId, marker, opts = {}) {
        if (trans) return trans.promise;
        if (opts.instant) {
          game.bus.emit('zone:transition', { to: zoneId, phase: 'out' });
          doArrive(zoneId, marker);
          game.bus.emit('zone:transition', { to: zoneId, phase: 'in' });
          return Promise.resolve();
        }
        let resolve;
        const promise = new Promise((r) => { resolve = r; });
        const steps = opts.steps != null ? opts.steps : TRANSITION_STEPS;
        trans = { to: zoneId, marker, phase: 'out', t: 0, resolve, promise, outSteps: steps, inSteps: steps };
        game.freeze.add('transition');
        game.bus.emit('zone:transition', { to: zoneId, phase: 'out' });
        return promise;
      },
      /** added: true while a fade travel is running. */
      get traveling() { return !!trans; },

      solidAt(x, y, flying = false) {
        const z = game.zone;
        if (!z) return true;
        const tx = Math.floor(x), ty = Math.floor(y);
        if (tx < 0 || ty < 0 || tx >= z.w || ty >= z.h) return true;
        return (flying ? z.wall : z.solid)[ty * z.w + tx] === 1;
      },
      /** added: blocks projectiles, sight and flyers (block tiles, solid props, seals, chests). */
      wallAt(x, y) { return api.solidAt(x, y, true); },
      /** Scholar's chest tiles of a zone (tests and tools). */
      scholarSpots(z) { return scholarSpots(z || api.zone || game.zone); },
      tileDefAt(x, y) {
        const z = game.zone;
        const tx = Math.floor(x), ty = Math.floor(y);
        if (!z || tx < 0 || ty < 0 || tx >= z.w || ty >= z.h) return null;
        return data.tiles.list[z.tiles[ty * z.w + tx]];
      },
      setTile(tx, ty, tileId) {
        const z = game.zone;
        const n = data.tiles.index[tileId];
        if (!z || n === undefined || !inBounds(z, tx, ty)) return;
        const i = ty * z.w + tx;
        z.tiles[i] = n;
        recompute(z, i);
        game.bus.emit('tile:changed', { tx, ty });
      },
      /** added: make a tile rect solid (+1) or release it (-1); used by seals and chests. */
      block(tx, ty, w, h, delta) {
        const z = game.zone;
        if (!z) return;
        for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) {
          if (!inBounds(z, x, y)) continue;
          const i = y * z.w + x;
          z.block[i] = Math.max(0, z.block[i] + delta);
          recompute(z, i);
        }
      },
      marker(name) {
        const m = game.zone && game.zone.markers[name];
        return m ? { x: m[0] + 0.5, y: m[1] + 0.5 } : null;
      },

      /** Line of sight on the wall grid (water does not block sight). */
      los(x0, y0, x1, y1) {
        const z = game.zone;
        if (!z) return false;
        let tx = Math.floor(x0), ty = Math.floor(y0);
        const ex = Math.floor(x1), ey = Math.floor(y1);
        const dx = x1 - x0, dy = y1 - y0;
        const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
        const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
        let tmx = dx !== 0 ? (dx > 0 ? (tx + 1 - x0) : (x0 - tx)) * tdx : Infinity;
        let tmy = dy !== 0 ? (dy > 0 ? (ty + 1 - y0) : (y0 - ty)) * tdy : Infinity;
        for (let guard = 0; guard < 1024; guard++) {
          if (!inBounds(z, tx, ty) || z.wall[ty * z.w + tx]) return false;
          if (tx === ex && ty === ey) return true;
          if (tmx > 1 && tmy > 1) return inBounds(z, ex, ey) && !z.wall[ey * z.w + ex];
          if (tmx < tmy) { tmx += tdx; tx += sx; } else { tmy += tdy; ty += sy; }
        }
        return false;
      },

      /** added: can a circle of radius r walk the straight segment? (samples every 0.25 tiles) */
      walkable(x0, y0, x1, y1, r = 0.3, flying = false) {
        const dx = x1 - x0, dy = y1 - y0;
        const L = Math.sqrt(dx * dx + dy * dy);
        const n = Math.max(1, Math.ceil(L / 0.25));
        const nx = L > 0 ? -dy / L * r : 0, ny = L > 0 ? dx / L * r : 0;
        for (let i = 0; i <= n; i++) {
          const x = x0 + dx * i / n, y = y0 + dy * i / n;
          if (api.solidAt(x, y, flying) || api.solidAt(x + nx, y + ny, flying) || api.solidAt(x - nx, y - ny, flying)) return false;
        }
        return true;
      },

      /** added: free distance along a ray (step 0.1) before hitting a solid tile; up to maxDist. */
      raycast(x, y, angle, maxDist, flying = false) {
        const c = Math.cos(angle), s = Math.sin(angle);
        let d = 0;
        while (d < maxDist) {
          const nd = Math.min(maxDist, d + 0.1);
          if (api.solidAt(x + c * nd, y + s * nd, flying)) return d;
          d = nd;
        }
        return maxDist;
      },

      /**
       * A* over tiles (8 directions, no corner cutting), at most 400 expanded nodes, no allocation.
       * `out` (number[]) receives tile-center waypoints flattened [x1, y1, x2, y2, ...] excluding the start tile.
       * Returns true if the goal tile was reached; false otherwise, with `out` holding the path to the explored
       * node closest to the goal (possibly empty). opts {flying}.
       */
      findPath(x0, y0, x1, y1, out, opts) {
        if (out) out.length = 0;
        const z = game.zone;
        if (!z) return false;
        const grid = opts && opts.flying ? z.wall : z.solid;
        const w = z.w, h = z.h;
        const sx = Math.floor(x0), sy = Math.floor(y0), gx = Math.floor(x1), gy = Math.floor(y1);
        if (!inBounds(z, sx, sy) || !inBounds(z, gx, gy)) return false;
        const start = sy * w + sx, goal = gy * w + gx;
        if (start === goal) return true;
        curStamp++;
        if (curStamp > 0xfffffff0) { stamp.fill(0); closed.fill(0); curStamp = 1; }
        pw = w; pgx = gx; pgy = gy; hn = 0;
        stamp[start] = curStamp; gBuf[start] = 0; parent[start] = -1;
        heapPush(start, heur(start));
        let expanded = 0, best = start, bestH = heur(start), found = false;
        while (hn > 0 && expanded < MAX_NODES) {
          const cur = heapPop();
          if (closed[cur] === curStamp) continue;
          closed[cur] = curStamp;
          expanded++;
          if (cur === goal) { found = true; best = cur; break; }
          const hc = heur(cur);
          if (hc < bestH) { bestH = hc; best = cur; }
          const cx = cur % w, cy = (cur / w) | 0;
          const gc = gBuf[cur];
          for (let d = 0; d < 8; d++) {
            const ddx = NDX[d], ddy = NDY[d];
            const nx = cx + ddx, ny = cy + ddy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny * w + nx;
            if (grid[ni]) continue;
            if (d >= 4 && (grid[cy * w + nx] || grid[ny * w + cx])) continue;
            if (closed[ni] === curStamp) continue;
            const ng = gc + (d >= 4 ? SQRT2 : 1);
            if (stamp[ni] === curStamp && gBuf[ni] <= ng) continue;
            stamp[ni] = curStamp; gBuf[ni] = ng; parent[ni] = cur;
            heapPush(ni, ng + heur(ni));
          }
        }
        if (out) {
          let n = 0, node = best;
          while (node !== start && node >= 0 && n < rev.length) { rev[n++] = node; node = parent[node]; }
          for (let i = n - 1; i >= 0; i--) { out.push((rev[i] % w) + 0.5, ((rev[i] / w) | 0) + 0.5); }
        }
        return found;
      },

      zoneView() {
        const z = game.zone;
        if (!z) return null;
        if (!view) view = { id: z.id, w: z.w, h: z.h, tiles: z.tiles, variant: z.variant, tileDefs: data.tiles.list,
          props: z.props, palette: z.palette };
        return view;
      },

      /** added: random walkable point inside a tile rect [x, y, w, h] (tries n times), or null. */
      randomPoint(rect, minDistFromPlayer = 0, tries = 12) {
        const p = game.player;
        for (let i = 0; i < tries; i++) {
          const x = rect[0] + game.rng.next() * rect[2], y = rect[1] + game.rng.next() * rect[3];
          if (api.solidAt(x, y) || api.solidAt(x + 0.3, y) || api.solidAt(x - 0.3, y) || api.solidAt(x, y + 0.3) || api.solidAt(x, y - 0.3)) continue;
          if (minDistFromPlayer > 0 && p) { const dx = x - p.x, dy = y - p.y; if (dx * dx + dy * dy < minDistFromPlayer * minDistFromPlayer) continue; }
          return { x, y };
        }
        return null;
      },

      /** added: tile rect of an exit/gate-like def: `area: [x,y,w,h]`, or `at` marker tile centered with w, h. */
      rectOf(def, dw = 1, dh = 1) {
        if (def.area) return { x: def.area[0], y: def.area[1], w: def.area[2], h: def.area[3] };
        const m = game.zone && game.zone.markers[def.at];
        if (!m) return null;
        const w = def.w || dw, h = def.h || dh;
        return { x: m[0] - Math.floor((w - 1) / 2), y: m[1] - Math.floor((h - 1) / 2), w, h };
      },

      _furnish: furnish,
    };

    function doArrive(zoneId, marker) {
      if (game.zone && zoneId === game.zone.id) {
        const at = api.resolve(marker);
        const p = game.player;
        if (p) { p.x = p.px = at.x; p.y = p.py = at.y; p.vx = p.vy = p.kx = p.ky = 0; }
        if (game.sys.companions && game.sys.companions.regroup) game.sys.companions.regroup();
        game.ents.touch();
        game.snapCamera();
        disarmExits();
      } else api.loadZone(zoneId, marker);
    }
    function disarmExits() {
      const z = game.zone;
      if (!z) return;
      for (const r of z.exitRects) r.armed = false;
    }

    // ---- furniture ----
    function spawnFrom(sp, z, minDist) {
      const s = sp.def;
      if (s.if && game.ops && game.ops.test && !game.ops.test(s.if, {})) return null;
      let rect = s.area;
      // integration (World notes): {at, w, h} is a tile rect centered on the marker tile; {at, r} a square of radius r
      if (!rect && s.at && (s.w || s.h)) { const r = api.rectOf(s, s.w || 1, s.h || 1); if (r) rect = [r.x, r.y, r.w, r.h]; }
      if (!rect && s.at) { const m = api.marker(s.at); const r = s.r || 2; if (m) rect = [m.x - r, m.y - r, 2 * r, 2 * r]; }
      if (!rect) return null;
      const pt = api.randomPoint(rect, minDist) || (minDist > 0 ? null : { x: rect[0] + rect[2] / 2, y: rect[1] + rect[3] / 2 });
      if (!pt) return null;
      const opts = Object.assign({}, s.opts || null);
      if (s.level) opts.level = s.level;
      // round 3: biome zones scale their enemies to the player (any biome order stays fair): level =
      // clamp(player level + levelOffset, levelRange); bosses (spawn.boss) take the top of that clamp + 1.
      if (z.def.scaleToPlayer && z.def.levelRange) {
        const pr = game.sys.progression, pl = (pr && pr.level) || 1;
        const [lo, hi] = z.def.levelRange;
        let L = Math.max(lo, Math.min(hi, pl + (s.levelOffset || 0)));
        if (s.boss) L = Math.min((game.config.levelCap || 20) + 1, L + 1);
        opts.level = L;
      }
      if (s.tag) opts.tag = s.tag;
      const e = game.ents.spawn(s.kind, pt.x, pt.y, opts);
      e.data.spawner = sp;
      e.data.spawnZone = z;
      sp.alive++;
      return e;
    }
    /** Scholar's chests: question-locked chests spread over every zone, deterministic from the zone's data (the same
     * spots every visit, so their flags `schest_<zone>_<i>` stay valid). Spots: walkable tiles reachable from the
     * entry, with all 8 neighbours walkable and dry, away from markers, exits, hand-placed chests and each other. */
    function scholarSpots(z) {
      const def = z.def, cfg = game.config.scholarChests || {};
      const n = def.scholarChests != null ? def.scholarChests : cfg[z.id] != null ? cfg[z.id] : def.scaleToPlayer ? (cfg.biome || 0) : 0;
      if (!n || !z.markers) return [];
      const W = z.w, H = z.h, solid = z.solid;
      const entryName = def.entry || { intro: 'start', town: 'gate_south', academy: 'entrance', forest: 'entry_town' }[z.id];
      const e = (entryName && z.markers[entryName]) || Object.values(z.markers)[0];
      if (!e) return [];
      const seen = new Uint8Array(W * H), q = [e[1] * W + e[0]];
      // rune gates count as walls, so sealed areas (and the boss arenas behind them) get no chests
      for (const gdef of def.gates || []) {
        const r = api.rectOf(gdef, 3, 1);
        if (r) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) seen[y * W + x] = 2;
      }
      seen[q[0]] = 1;
      for (let k = 0; k < q.length; k++) {
        const i = q[k], x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (seen[j] || solid[j]) continue;
          seen[j] = 1; q.push(j);
        }
      }
      const avoid = [];
      for (const m of Object.values(z.markers)) avoid.push(m);
      for (const c of def.chests || []) { const m = z.markers[c.at]; if (m) avoid.push(m); }
      const cand = [];
      for (const i of q) {
        const x = i % W, y = (i / W) | 0;
        if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) continue;
        let ok = true;
        for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) if (solid[(y + dy) * W + x + dx] || seen[(y + dy) * W + x + dx] !== 1) ok = false;
        if (!ok) continue;
        const ba = z.markers.boss_arena;
        if (ba && Math.hypot(ba[0] - x, ba[1] - y) < 12) continue;
        const td = api.tileDefAt(x + 0.5, y + 0.5);
        if (td && td.shape === 'water') continue;
        if (avoid.some((m) => Math.abs(m[0] - x) < 4 && Math.abs(m[1] - y) < 4)) continue;
        cand.push(i);
      }
      // seeded shuffle, then greedy spread-out picks (relax the spacing if the zone is small)
      let s = ((def.seed || 1) * 2654435761 + n * 97) >>> 0;
      const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); const t = cand[k]; cand[k] = cand[j]; cand[j] = t; }
      const out = [];
      for (let gap = Math.max(6, Math.sqrt((W * H) / n) * 0.7); gap >= 3 && out.length < n; gap *= 0.75) {
        for (const i of cand) {
          if (out.length >= n) break;
          const x = i % W, y = (i / W) | 0;
          if (out.some((p) => Math.hypot(p[0] - x, p[1] - y) < gap)) continue;
          out.push([x, y]);
        }
      }
      return out;
    }
    function placeScholarChests(z) {
      scholarSpots(z).forEach(([tx, ty], i) => {
        const flag = 'schest_' + z.id + '_' + i;
        const opened = !!game.flags[flag];
        const model = opened ? 'chest_open' : 'rune_chest';
        game.ents.create({
          kind: model, type: 'effect', team: 'neutral', name: opened ? '' : "Scholar's chest",
          x: tx + 0.5, y: ty + 0.5, solid: false, pushable: false, radius: 0.45,
          look: { rig: 'effect', model, color: '#c58cff' },
          data: { chest: 'scholar_' + i, scholar: i, flag },
          interact: opened ? null : { prompt: 'Solve to open', range: 1.4, do: [['scholarChest', i]] },
        });
        api.block(tx, ty, 1, 1, +1);
      });
    }
    function furnish(z) {
      const def = z.def;
      for (const ex of def.exits || []) {
        const r = api.rectOf(ex, 1, 1);
        if (!r) { warnOnce('exit:' + ex.at, 'world: exit marker missing ' + ex.at); continue; }
        r.def = ex; r.armed = false; r.toastT = -99;
        z.exitRects.push(r);
      }
      (def.spawns || []).forEach((s, i) => {
        const sp = { def: s, index: i, alive: 0, timers: [] };
        z.spawners.push(sp);
        for (let k = 0; k < (s.n || 1); k++) spawnFrom(sp, z, 0);
      });
      for (const t of def.triggers || []) {
        const r = api.rectOf(t, t.w || 1, t.h || 1);
        z.triggerState.push({ def: t, rect: r, inside: false, fired: false });
      }
      placeScholarChests(z);
      for (const gdef of def.gates || []) {
        if (game.flags['gate_' + gdef.id]) continue;
        const r = api.rectOf(gdef, 3, 1);
        if (!r) { warnOnce('gate:' + gdef.id, 'world: gate marker missing ' + gdef.at); continue; }
        const question = Object.assign({ context: 'gate', difficulty: 2 }, gdef.question);
        const e = game.ents.create({
          kind: 'rune_seal', type: 'effect', team: 'neutral', name: gdef.name || '',
          x: r.x + r.w / 2, y: r.y + r.h / 2, solid: false, pushable: false, radius: Math.max(r.w, r.h) / 2,
          look: Object.assign({ rig: 'effect', model: 'rune_seal', color: '#9fe6ff', w: r.w, h: r.h, r: Math.max(r.w, r.h) / 2 }, gdef.look),
          data: { gateId: gdef.id, blockRect: r },
          interact: { prompt: 'Unseal', range: Math.max(r.w, r.h) / 2 + 1.2,
            do: [['gate', question, { pass: [['gate.open', gdef.id]] }]],
            if: gdef.req || null, locked: gdef.locked || 'The seal will not budge yet.' },
        });
        api.block(r.x, r.y, r.w, r.h, +1);
        void e;
      }
      for (const c of def.chests || []) {
        const m = api.marker(c.at);
        if (!m) { warnOnce('chest:' + c.id, 'world: chest marker missing ' + c.at); continue; }
        const opened = !!game.flags['chest_' + z.id + '_' + c.id];
        const model = opened ? 'chest_open' : c.rune ? 'rune_chest' : 'chest';
        game.ents.create({
          kind: model, type: 'effect', team: 'neutral', x: m.x, y: m.y, solid: false, pushable: false, radius: 0.45,
          look: { rig: 'effect', model, color: c.rune ? '#9fe6ff' : '#ffd24a' },
          data: { chest: c.id, loot: c.loot, rune: !!c.rune, flag: 'chest_' + z.id + '_' + c.id },
          interact: opened ? null : { prompt: 'Open', range: 1.4, do: [['chest', c.loot, { id: c.id, rune: !!c.rune }]] },
        });
        api.block(Math.floor(m.x), Math.floor(m.y), 1, 1, +1);
      }
      for (const p of z.props) {
        if (!p.interact) continue;
        // integration (World notes): `interact.at` is the tile the player stands on; buildings default to their
        // door step (x + def.door, y + h); other props to the south-center of the footprint / the tile center.
        let ax, ay;
        const at = p.interact.at;
        if (Array.isArray(at)) { ax = at[0] + 0.5; ay = at[1] + 0.5; }
        else if (typeof at === 'string' && z.markers[at]) { ax = z.markers[at][0] + 0.5; ay = z.markers[at][1] + 0.5; }
        else if (!p.footless && p.def && typeof p.def.door === 'number') { ax = p.x + p.def.door + 0.5; ay = p.y + p.h + 0.5; }
        else { ax = p.footless ? p.x + 0.5 : p.x + p.w / 2; ay = p.footless ? p.y + 0.5 : p.y + p.h; }
        const e = game.ents.create({
          kind: 'anchor', type: 'effect', team: 'neutral', name: p.interact.name || '', x: ax, y: ay, solid: false,
          look: null, asleep: true, interact: Object.assign({ range: 1.3 }, p.interact),
          data: { anchor: true, propId: p.id, propKind: p.kind, shop: p.kind === 'shop' },
        });
        z.anchors.push(e);
      }
      if (game.sys.npc && typeof game.sys.npc.populate === 'function') game.sys.npc.populate(z);
    }

    // ---- bus wiring ----
    game.bus.on('ent:removed', ({ ent }) => {
      const sp = ent.data.spawner;
      if (!sp || ent.data.spawnZone !== game.zone || game.zone.unloading) return;
      sp.alive = Math.max(0, sp.alive - 1);
      if (sp.def.respawn > 0) sp.timers.push(game.t + sp.def.respawn);
    });
    // integration (World request): spawn `if` is re-evaluated when flags change; spawned entities whose condition
    // no longer holds poof away (saplings after mossback_defeated), unless they are mid-fight.
    game.bus.on('flag', () => {
      const z = game.zone;
      if (!z || !z.spawners || !game.ops || !game.ops.test) return;
      for (const sp of z.spawners) {
        if (!sp.def.if || !sp.alive || game.ops.test(sp.def.if, {})) continue;
        for (const e of game.ents.all) {
          if (e.removed || e.data.spawner !== sp || (e.ai && e.ai.target != null) || e.tags.includes('boss')) continue;
          game.fx({ type: 'poof', x: e.x, y: e.y });
          game.ents.remove(e);
        }
      }
    });
    game.bus.on('flag', ({ key, value }) => {
      if (!value || typeof key !== 'string' || key.indexOf('chest_') !== 0) return;
      for (const e of game.ents.all) {
        if (e.data.flag === key && e.data.chest && e.interact) {
          e.interact = null;
          e.kind = 'chest_open';
          e.look = Object.assign({}, e.look, { model: 'chest_open' });
          e.lookRev++;
        }
      }
    });

    // ---- ops ----
    const ops = game.sys.ops;
    if (ops && ops.register) {
      ops.register('travel', (g, a) => api.travel(a[1], a[2], a[3] || {}));
      ops.register('teleport', (g, a) => { doArrive(a[1] || (game.zone && game.zone.id), a[2]); });
      ops.register('gate.open', (g, a) => api.openGate(a[1]));
      ops.register('spawn', (g, a) => {
        const kind = a[1], at = api.resolve(a[2]), o = a[3] || {};
        // integration: opts.unique = do nothing when a live entity of that kind already exists (zone-spawned bosses)
        if (o.unique && game.ents.all.some((e) => e.kind === kind && !e.removed && e.alive !== false)) return undefined;
        const n = o.n || 1, spread = o.spread != null ? o.spread : (n > 1 ? 1 : 0);
        let last = null;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          last = game.ents.spawn(kind, at.x + Math.cos(ang) * spread, at.y + Math.sin(ang) * spread, o);
          if (o.poof) game.fx({ type: 'poof', x: last.x, y: last.y });
        }
        return undefined;
      });
      ops.register('despawn', (g, a) => {
        const list = game.ents.findAll(a[1], []);
        const o = a[2] || {};
        for (const e of list) {
          if (o.poof !== false && e.type !== 'effect') game.fx({ type: 'poof', x: e.x, y: e.y });
          game.ents.remove(e);
        }
      });
    }

    /** added: open a gate: remove the seal, release its tiles, set flag gate_<id>, fx. */
    api.openGate = (id) => {
      for (const e of game.ents.all) {
        if (e.removed || e.data.gateId !== id) continue;
        const r = e.data.blockRect;
        if (r) api.block(r.x, r.y, r.w, r.h, -1);
        game.fx({ type: 'ring', x: e.x, y: e.y, r: 3, color: '#9fe6ff', dur: 0.8 });
        game.fx({ type: 'sparkle', x: e.x, y: e.y, n: 24, color: '#c9a6ff', r: 2 });
        game.fx({ type: 'poof', x: e.x, y: e.y, color: '#9fe6ff' });
        game.bus.emit('sfx', { id: 'door' });
        game.ents.remove(e);
      }
      if (!game.flags['gate_' + id]) game.setFlag('gate_' + id, true);
    };

    api._update = (dt) => {
      if (trans) {
        trans.t++;
        if (trans.phase === 'out' && trans.t >= trans.outSteps) {
          doArrive(trans.to, trans.marker);
          trans.phase = 'in'; trans.t = 0;
          game.bus.emit('zone:transition', { to: trans.to, phase: 'in' });
        } else if (trans.phase === 'in' && trans.t >= trans.inSteps) {
          const tr = trans;
          trans = null;
          game.freeze.delete('transition');
          tr.resolve();
        }
        return;
      }
      if (game.freeze.size > 0) return;
      const z = game.zone, p = game.player;
      if (!z || !p) return;
      // Respawn timers.
      for (let i = 0; i < z.spawners.length; i++) {
        const sp = z.spawners[i];
        const timers = sp.timers;
        for (let k = timers.length - 1; k >= 0; k--) {
          if (game.t < timers[k]) continue;
          if (sp.alive >= (sp.def.n || 1)) { timers.splice(k, 1); continue; }
          const e = spawnFrom(sp, z, RESPAWN_MIN_DIST);
          if (e) { timers.splice(k, 1); game.fx({ type: 'poof', x: e.x, y: e.y, color: '#ffffff' }); }
          else timers[k] = game.t + 2;
        }
      }
      const controlled = game.inputLock > 0 || p.data.scripted || p.data.down;
      // Exits.
      for (let i = 0; i < z.exitRects.length; i++) {
        const r = z.exitRects[i];
        const inside = p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
        if (!inside) { r.armed = true; continue; }
        if (!r.armed || controlled) continue;
        const ex = r.def;
        if (!ex.if || !game.ops || game.ops.test(ex.if, {})) {
          r.armed = false;
          api.travel(ex.to, ex.marker);
          return;
        }
        if (game.t - r.toastT >= 3) { r.toastT = game.t; game.toast(ex.locked || 'The way is closed.', 'info'); }
      }
      // Triggers.
      for (let i = 0; i < z.triggerState.length; i++) {
        const ts = z.triggerState[i];
        const r = ts.rect;
        if (!r) continue;
        const inside = p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
        if (!inside) { ts.inside = false; continue; }
        if (ts.inside) continue;
        const t = ts.def;
        const flag = 'trig_' + z.id + '_' + t.id;
        if (t.once && game.flags[flag]) { ts.inside = true; continue; }
        if (t.if && game.ops && !game.ops.test(t.if, {})) continue;
        ts.inside = true;
        if (t.once) game.setFlag(flag, true);
        if (game.ops && game.ops.run) game.ops.run(t.do || [], { trigger: t.id });
      }
    };
    return api;
  },
  update(game, dt) { game.world._update(dt); },
  onZoneLoad(game, zone) { game.world._furnish(zone); },
  hud(game, hud) { hud.zoneName = game.zone ? game.zone.name : ''; },
};
