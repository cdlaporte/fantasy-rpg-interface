#!/usr/bin/env node
// World data validator: `node tools/validate-data.mjs [zoneId...]` (exit 1 on errors).
// Also exports the zone analysis used by tools/map-preview.mjs and tests/node/data-world.test.mjs.
import { pathToFileURL } from 'node:url';
import data from '../src/data/index.js';
import { buildZoneGrid, furnitureRect } from '../src/data/zones/mapgen.js';
import { PROP_MODELS } from '../src/data/props.js';

// ---- fixed ids from docs/STORY.md -------------------------------------------------------------------------------
export const REQUIRED_MARKERS = {
  intro: ['start', 'stick', 'rats_1', 'rats_2', 'big_rat', 'clearing', 'malgrim_spot', 'hex_1', 'hex_2', 'laporte_arrive',
    'exit_town', 'respawn'],
  town: ['academy_door', 'gate_south', 'square', 'quest_board', 'potion_door', 'outfitter_door', 'general_door', 'bakery_door',
    'cafe_door', 'library_door', 'home_1', 'home_2', 'home_3', 'home_4', 'home_5', 'home_6', 'home_7', 'home_8', 'park',
    'bench_1', 'bench_2', 'bench_3', 'bench_4', 'cafe_seat_1', 'cafe_seat_2', 'cafe_seat_3', 'cafe_seat_4', 'stall_1', 'stall_2',
    'stall_3', 'guard_post_1', 'guard_post_2', 'guard_post_3', 'gate_forest', 'gate_dunes', 'gate_cove', 'gate_peaks', 'gate_aether'],
  academy: ['entrance', 'hall', 'hall_laporte', 'headmaster', 'infirmary', 'infirmary_bed', 'classroom_1', 'classroom_2', 'teach_1',
    'teach_2', 'library_nook', 'yard', 'dummy_1', 'dummy_2', 'dummy_3', 'dummy_4', 'classmate_1', 'classmate_2', 'classmate_3'],
  forest: ['entry_town', 'ranger_camp', 'glade', 'meadow', 'brook', 'hollow', 'goblin_camp', 'wisp_pond', 'grove_gate', 'grove',
    'boss_arena', 'chest_1', 'chest_2', 'chest_3', 'chest_4', 'respawn'],
  test: ['start', 'far', 'dummy_ring', 'gallery_row'],
};
export const ENEMY_IDS = ['rat', 'giant_rat', 'hexguard', 'malgrim', 'training_dummy', 'slime', 'sporecap', 'thornling', 'bat', 'boar',
  'goblin_scout', 'wisp', 'treant_sapling', 'old_mossback'];
export const LOOT_IDS = ['forest_small', 'forest_rune', 'boss_mossback'];
export const SHOP_IDS = ['potions', 'outfitter', 'general', 'bakery'];
export const LESSON_IDS = ['lesson_1', 'lesson_2'];
export const ZONE_IDS = ['intro', 'town', 'academy', 'forest', 'test'];
export const OPS = ['teleport', 'travel', 'spawn', 'despawn', 'gate.open', 'heal', 'setLook', 'companions', 'kill', 'flag.set', 'toast',
  'fx', 'sfx', 'quest.start', 'quest.advance', 'dialogue', 'cutscene', 'rel', 'give', 'take', 'gold', 'xp', 'shop', 'gate', 'chest',
  'lesson', 'classPicker', 'specPicker', 'lookPicker', 'save'];
export const CONDS = ['flag', 'not', 'quest', 'rel', 'hour', 'level', 'class', 'spec', 'hasItem', 'gold'];
const BUILDINGS = ['house', 'shop', 'tower', 'academy'];

/** Default arrival/entry marker per zone (zone def `entry` wins). */
export function entryMarker(def) {
  return def.entry || { intro: 'start', town: 'gate_south', academy: 'entrance', forest: 'entry_town' }[def.id] || 'start';
}

/** Build the runtime-like grid of a zone: tiles, props (authored + generated), merged solidity. */
export function buildZone(id, d = data) {
  const def = d.zones[id];
  if (!def) throw new Error('unknown zone ' + id);
  const t0 = process.hrtime.bigint();
  const g = buildZoneGrid(def, d.tiles.index);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const { w, h } = g;
  const props = [];
  for (const p of (def.props || []).concat(g.props || [])) {
    const pd = d.props[p.kind] || null;
    const fp = pd && pd.footprint;
    props.push({ src: p, kind: p.kind, def: pd, model: pd && pd.model, x: p.x, y: p.y, w: fp ? fp[0] : 1, h: fp ? fp[1] : 1,
      solid: !!(pd && pd.solid && fp), deco: !!p.deco, id: p.id || null, interact: p.interact || null });
  }
  const tileSolid = new Uint8Array(w * h), solid = new Uint8Array(w * h), propAt = new Int32Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) tileSolid[i] = solid[i] = d.tiles.list[g.tiles[i]] && d.tiles.list[g.tiles[i]].solid ? 1 : 0;
  props.forEach((p, k) => {
    if (!p.def || !p.def.footprint) return;
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (p.solid) { solid[y * w + x] = 1; if (propAt[y * w + x] < 0 || !props[propAt[y * w + x]].solid) propAt[y * w + x] = k; }
      else if (propAt[y * w + x] < 0) propAt[y * w + x] = k;
    }
  });
  const markers = def.markers || {};
  const gateRects = (def.gates || []).map((gt) => ({ gate: gt, rect: furnitureRect(gt, markers) }));
  return { id, def, w, h, tiles: g.tiles, variant: g.variant, props, tileSolid, solid, propAt, markers, gateRects, ms,
    decoCount: (g.props || []).length };
}

/** 4-connected flood fill over a solidity mask from tile (sx, sy). */
export function flood(w, h, solid, sx, sy) {
  const seen = new Uint8Array(w * h);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h || solid[sy * w + sx]) return seen;
  const st = [sy * w + sx]; seen[st[0]] = 1;
  while (st.length) {
    const i = st.pop(), x = i % w;
    if (x > 0 && !seen[i - 1] && !solid[i - 1]) { seen[i - 1] = 1; st.push(i - 1); }
    if (x < w - 1 && !seen[i + 1] && !solid[i + 1]) { seen[i + 1] = 1; st.push(i + 1); }
    if (i >= w && !seen[i - w] && !solid[i - w]) { seen[i - w] = 1; st.push(i - w); }
    if (i + w < w * h && !seen[i + w] && !solid[i + w]) { seen[i + w] = 1; st.push(i + w); }
  }
  return seen;
}

function rectTiles(r, w, h) {
  const out = [];
  if (!r) return out;
  for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) if (x >= 0 && y >= 0 && x < w && y < h) out.push(y * w + x);
  return out;
}

function walkOps(list, fn, path) {
  if (!Array.isArray(list)) return;
  for (const a of list) {
    if (!Array.isArray(a)) { fn(null, a, path); continue; }
    fn(a[0], a, path);
    // nested op lists: gate {pass, fail}, chest/spawn opts are not ops
    if (a[0] === 'gate' && a[2] && typeof a[2] === 'object') { walkOps(a[2].pass, fn, path + '.pass'); walkOps(a[2].fail, fn, path + '.fail'); }
  }
}
function walkConds(list, fn, path) {
  if (!Array.isArray(list)) return;
  for (const c of list) {
    if (!Array.isArray(c)) { fn(null, c, path); continue; }
    fn(c[0], c, path);
    if (c[0] === 'not') walkConds([c[1]], fn, path + '.not');
  }
}

/** Validate one zone. Returns {errors: string[], warnings: string[], z}. */
export function validateZone(id, d = data) {
  const errors = [], warnings = [];
  const E = (m) => errors.push(id + ': ' + m), W = (m) => warnings.push(id + ': ' + m);
  const def = d.zones[id];
  if (!def) { E('zone missing'); return { errors, warnings, z: null }; }
  if (def.id !== id) E(`def.id ${def.id} != key ${id}`);
  const src = def.tiles || def.macro;
  if (!src) { E('no tiles/macro'); return { errors, warnings, z: null }; }
  // rows / legend
  const rows = src.rows || [];
  const len0 = rows[0] ? rows[0].length : 0;
  rows.forEach((r, i) => { if (r.length !== len0) E(`row ${i} has length ${r.length}, expected ${len0}`); });
  const legend = src.legend || {};
  const used = new Set(rows.join(''));
  for (const ch of used) if (!(ch in legend)) E(`legend has no entry for '${ch}'`);
  for (const ch of Object.keys(legend)) {
    const v = legend[ch];
    const tid = typeof v === 'string' ? v : v && v.tile;
    if (!(tid in d.tiles.index)) E(`legend '${ch}' -> unknown tile '${tid}'`);
    if (v && typeof v === 'object') {
      if (v.under && !(v.under in d.tiles.index)) E(`legend '${ch}' under -> unknown tile '${v.under}'`);
      for (const m of v.mix || []) if (!(m[0] in d.tiles.index)) E(`legend '${ch}' mix -> unknown tile '${m[0]}'`);
      for (const k of Object.keys(v.deco || {})) if (!d.props[k]) E(`legend '${ch}' deco -> unknown prop '${k}'`);
    }
    if (!used.has(ch)) W(`legend '${ch}' unused`);
  }
  for (const op of src.paint || []) if (op.tile && !(op.tile in d.tiles.index)) E(`paint -> unknown tile '${op.tile}'`);
  if (def.palette && d.palettes.PALETTES && !d.palettes.PALETTES[def.palette]) E(`unknown palette '${def.palette}'`);

  const z = buildZone(id, d);
  const { w, h, solid, markers } = z;
  if (def.macro && z.ms > 30) W(`mapgen took ${z.ms.toFixed(1)} ms (budget 30)`);
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  // markers
  for (const m of REQUIRED_MARKERS[id] || []) if (!markers[m]) E(`required marker '${m}' missing`);
  const free = def.freeMarkers || [];
  for (const [name, m] of Object.entries(markers)) {
    if (free.includes(name)) continue;
    if (!Array.isArray(m) || m.length < 2 || !Number.isInteger(m[0]) || !Number.isInteger(m[1])) { E(`marker '${name}' is not [tx, ty]`); continue; }
    if (!inb(m[0], m[1])) { E(`marker '${name}' out of bounds ${m}`); continue; }
    const i = m[1] * w + m[0];
    if (z.tileSolid[i]) E(`marker '${name}' ${m} on solid tile ${d.tiles.list[z.tiles[i]].id}`);
    else if (solid[i]) E(`marker '${name}' ${m} under solid prop ${z.props[z.propAt[i]] && z.props[z.propAt[i]].kind}`);
  }
  // reachability (gates open: their tiles are walkable tiles by construction)
  const entry = entryMarker(def);
  const em = markers[entry];
  if (!em) { E(`entry marker '${entry}' missing`); return { errors, warnings, z }; }
  const reach = flood(w, h, solid, em[0], em[1]);
  z.reach = reach;
  const reachable = (i) => reach[i] === 1;
  for (const [name, m] of Object.entries(markers)) {
    if (!Array.isArray(m) || !inb(m[0], m[1])) continue;
    if (!reachable(m[1] * w + m[0]) && !free.includes(name)) E(`marker '${name}' ${m} unreachable from '${entry}'`);
  }
  const anyReach = (r) => rectTiles(r, w, h).some(reachable);
  // exits
  const exits = def.exits || [];
  exits.forEach((ex, k) => {
    const r = furnitureRect(ex, markers);
    const tag = `exit #${k} (${ex.at || ex.area} -> ${ex.to})`;
    if (!r) { E(`${tag}: no area / unknown marker`); return; }
    if (!rectTiles(r, w, h).length) E(`${tag}: area out of bounds`);
    else if (!anyReach(r)) E(`${tag}: unreachable`);
    const tz = d.zones[ex.to];
    if (!tz) E(`${tag}: target zone '${ex.to}' does not exist`);
    else if (!tz.markers || !tz.markers[ex.marker]) E(`${tag}: target marker '${ex.marker}' missing in ${ex.to}`);
    if (ex.if) walkConds(ex.if, (n) => { if (!CONDS.includes(n)) E(`${tag}: unknown condition '${n}'`); }, tag);
  });
  // arrival markers (targets of exits in any zone, and the entry) must not sit inside or next to an exit area,
  // under both readings of {at, w, h} (centered on the marker, or the marker as top-left)
  const arrivals = new Set([entry]);
  for (const oz of Object.values(d.zones)) for (const ex of oz.exits || []) if (ex.to === id && ex.marker) arrivals.add(ex.marker);
  for (const a of arrivals) {
    const m = markers[a];
    if (!m) continue;
    exits.forEach((ex, k) => {
      const rs = [furnitureRect(ex, markers)];
      if (!ex.area && markers[ex.at]) rs.push([markers[ex.at][0], markers[ex.at][1], ex.w || 1, ex.h || 1]);
      for (const r of rs) {
        if (r && m[0] >= r[0] - 1 && m[0] < r[0] + r[2] + 1 && m[1] >= r[1] - 1 && m[1] < r[1] + r[3] + 1) {
          E(`arrival marker '${a}' is inside/next to exit #${k} (${ex.at}) -> instant re-travel`);
        }
      }
    });
  }
  // spawns
  (def.spawns || []).forEach((s, k) => {
    const tag = `spawn #${k} (${s.kind})`;
    if (!ENEMY_IDS.includes(s.kind)) E(`${tag}: kind not in the STORY.md enemy list`);
    else if (!d.enemies || !d.enemies[s.kind]) E(`${tag}: no enemy def in data.enemies`);   // integration: content is merged
    const r = s.area || furnitureRect(s, markers);
    if (!r) { E(`${tag}: no area`); return; }
    const ts = rectTiles(r, w, h);
    if (ts.length !== r[2] * r[3]) E(`${tag}: area partly out of bounds`);
    const ok = ts.filter(reachable).length;
    if (!ok) E(`${tag}: no reachable tile in area`);
    else if (ok < ts.length * 0.3) W(`${tag}: only ${ok}/${ts.length} area tiles walkable`);
    if (!(s.n > 0)) E(`${tag}: n must be > 0`);
    if (s.respawn === undefined) W(`${tag}: respawn not set`);
    if (s.if) walkConds(s.if, (n) => { if (!CONDS.includes(n)) E(`${tag}: unknown condition '${n}'`); }, tag);
  });
  // awake-enemy budget: enemies whose spawn area center is inside a 30-tile bubble around any reachable spot (cap 24)
  const sp = (def.spawns || []).map((s) => ({ s, r: s.area || furnitureRect(s, markers) })).filter((o) => o.r);
  let worst = 0, worstAt = null;
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
    if (!reachable(y * w + x)) continue;
    let n = 0;
    for (const { s, r } of sp) {
      const dx = r[0] + r[2] / 2 - x, dy = r[1] + r[3] / 2 - y;    // spawn area centers
      if (dx * dx + dy * dy <= 30 * 30) n += s.n || 0;
    }
    if (n > worst) { worst = n; worstAt = [x, y]; }
  }
  z.awakeWorst = { n: worst, at: worstAt };
  if (worst > 24) W(`up to ${worst} spawned enemies within 30 tiles of ${worstAt} (cap 24 awake)`);
  // triggers
  const tids = new Set();
  (def.triggers || []).forEach((t, k) => {
    const tag = `trigger ${t.id || '#' + k}`;
    if (!t.id) E(`${tag}: missing id`); else if (tids.has(t.id)) E(`${tag}: duplicate id`); else tids.add(t.id);
    const r = t.area || furnitureRect(t, markers);
    if (!r || !anyReach(r)) E(`${tag}: area missing or unreachable`);
    walkOps(t.do, (n, op) => {
      if (!OPS.includes(n)) E(`${tag}: unknown op '${n}'`);
      // integration: Narrative content is merged; referenced ids must exist
      if (n === 'cutscene' && (!d.cutscenes || !d.cutscenes[op[1]])) E(`${tag}: cutscene '${op[1]}' not defined`);
      if (n === 'dialogue' && (!d.dialogues || !d.dialogues[op[1]])) E(`${tag}: dialogue '${op[1]}' not defined`);
    }, tag);
    if (t.if) walkConds(t.if, (n) => { if (!CONDS.includes(n)) E(`${tag}: unknown condition '${n}'`); }, tag);
  });
  // chests: walkable, reachable, and a solid chest entity must not cut anything off
  const cids = new Set();
  const markerList = Object.entries(markers).filter(([n, m]) => Array.isArray(m) && inb(m[0], m[1]) && !free.includes(n));
  const reachCount = (mask) => markerList.filter(([, m]) => mask[m[1] * w + m[0]]).length;
  const baseCount = reachCount(reach);
  for (const c of def.chests || []) {
    const tag = `chest ${c.id}`;
    if (cids.has(c.id)) E(`${tag}: duplicate id`); cids.add(c.id);
    if (!LOOT_IDS.includes(c.loot)) E(`${tag}: loot '${c.loot}' not in STORY.md loot tables`);
    else if (!d.loot || !d.loot[c.loot]) E(`${tag}: loot table '${c.loot}' missing from data.loot`);
    const m = markers[c.at];
    if (!m) { E(`${tag}: marker '${c.at}' missing`); continue; }
    const i = m[1] * w + m[0];
    if (!reachable(i)) E(`${tag}: unreachable`);
    const s2 = solid.slice(); s2[i] = 1;
    const r2 = flood(w, h, s2, em[0], em[1]);
    if (reachCount(r2) < baseCount - 1) E(`${tag}: a solid chest at ${m} cuts off other markers`);
    if (![i - 1, i + 1, i - w, i + w].some((k) => r2[k])) E(`${tag}: no reachable tile next to it`);
  }
  // gates: open = walkable; closed = blocks something (and every `seals` marker)
  for (const { gate, rect } of z.gateRects) {
    const tag = `gate ${gate.id}`;
    if (!rect) { E(`${tag}: marker '${gate.at}' missing`); continue; }
    const ts = rectTiles(rect, w, h);
    if (ts.some((i) => solid[i])) E(`${tag}: gate area ${rect} is not fully walkable when open`);
    if (!gate.question) W(`${tag}: no question`);
    const s2 = solid.slice(); for (const i of ts) s2[i] = 1;
    const sm = markers[gate.side || entry] || em;
    const r2 = flood(w, h, s2, sm[0], sm[1]);
    const lost = markerList.filter(([n, m]) => reach[m[1] * w + m[0]] && !r2[m[1] * w + m[0]] && n !== gate.at).map(([n]) => n);
    if (!lost.length) E(`${tag}: closed gate blocks nothing (leak around it?)`);
    for (const n of gate.seals || []) if (!lost.includes(n)) E(`${tag}: closed gate does not seal '${n}'`);
    z.gateLost = (z.gateLost || {}); z.gateLost[gate.id] = lost;
  }
  // props
  const doorSteps = [];
  z.props.forEach((p) => {
    const tag = `prop ${p.kind}@${p.x},${p.y}`;
    if (!p.def) { E(`${tag}: unknown prop kind`); return; }
    if (!PROP_MODELS.includes(p.model)) E(`${tag}: model '${p.model}' not in the closed list`);
    if (p.x < 0 || p.y < 0 || p.x + p.w > w || p.y + p.h > h) E(`${tag}: footprint out of bounds`);
    if (BUILDINGS.includes(p.model) && !p.deco) {
      const dx = p.def.door !== undefined ? p.def.door : Math.floor(p.w / 2);
      doorSteps.push({ p, x: p.x + dx, y: p.y + p.h });
    }
  });
  for (const ds of doorSteps) {
    const tag = `door of ${ds.p.id || ds.p.kind}@${ds.p.x},${ds.p.y}`;
    if (!inb(ds.x, ds.y)) { E(`${tag}: door step out of bounds`); continue; }
    const i = ds.y * w + ds.x;
    if (solid[i]) E(`${tag}: door step ${ds.x},${ds.y} blocked (${z.tileSolid[i] ? 'tile' : z.props[z.propAt[i]].kind})`);
    else if (!reachable(i) && !ds.p.src.sealedDoor) E(`${tag}: door step ${ds.x},${ds.y} unreachable`);
  }
  // prop overlaps (authored solid props only) and interacts
  for (let k = 0; k < z.props.length; k++) {
    const a = z.props[k];
    if (a.deco) continue;
    if (a.interact) {
      const tag = `interact on ${a.id || a.kind}@${a.x},${a.y}`;
      if (!a.interact.do) E(`${tag}: no do`);
      walkOps(a.interact.do, (n, op) => {
        if (!OPS.includes(n)) E(`${tag}: unknown op '${n}'`);
        if (n === 'shop' && !SHOP_IDS.includes(op[1])) E(`${tag}: shop '${op[1]}' not in STORY.md`);
        if (n === 'lesson' && !LESSON_IDS.includes(op[1])) E(`${tag}: lesson '${op[1]}' not in STORY.md`);
        if (n === 'dialogue' && (!d.dialogues || !d.dialogues[op[1]])) E(`${tag}: dialogue '${op[1]}' not defined`);
        if (n === 'cutscene' && (!d.cutscenes || !d.cutscenes[op[1]])) E(`${tag}: cutscene '${op[1]}' not defined`);
      }, tag);
      const at = a.interact.at;
      let pts = [];
      if (Array.isArray(at)) pts = [at];
      else {
        const dx = a.def.door !== undefined ? a.def.door : -1;
        if (BUILDINGS.includes(a.model) && dx >= 0) pts = [[a.x + dx, a.y + a.h]];
        else for (let y = a.y - 1; y <= a.y + a.h; y++) for (let x = a.x - 1; x <= a.x + a.w; x++) pts.push([x, y]);
      }
      if (!pts.some(([x, y]) => inb(x, y) && reachable(y * w + x))) E(`${tag}: interact point not reachable`);
    }
    if (!a.solid) continue;
    for (let j = k + 1; j < z.props.length; j++) {
      const b = z.props[j];
      if (b.deco || !b.solid) continue;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) W(`props overlap: ${a.kind}@${a.x},${a.y} and ${b.kind}@${b.x},${b.y}`);
    }
  }
  return { errors, warnings, z };
}

export function validateAll(ids = ZONE_IDS, d = data) {
  const errors = [], warnings = [], zones = {};
  for (const id of ids) {
    const r = validateZone(id, d);
    errors.push(...r.errors); warnings.push(...r.warnings); zones[id] = r.z;
  }
  return { errors, warnings, zones };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : ZONE_IDS;
  const { errors, warnings, zones } = validateAll(ids);
  for (const id of ids) {
    const z = zones[id];
    if (z) console.log(`${id.padEnd(8)} ${z.w}x${z.h}  props ${z.props.length - z.decoCount} + deco ${z.decoCount}  markers ${Object.keys(z.markers).length}  build ${z.ms.toFixed(1)} ms  max enemies in a 30-tile bubble ${z.awakeWorst ? z.awakeWorst.n : 0}`);
  }
  for (const m of warnings) console.log('warn  ' + m);
  for (const m of errors) console.log('ERROR ' + m);
  console.log(errors.length ? `${errors.length} error(s), ${warnings.length} warning(s)` : `ok (${warnings.length} warning(s))`);
  process.exit(errors.length ? 1 : 0);
}
