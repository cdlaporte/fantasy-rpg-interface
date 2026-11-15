// Mage kit test harness (shared by kit-mage*.test.mjs) + data-shape checks for the mage class package.
// Exports: mk(), ring(), rec(), press(), runSteps(), bot(), mixedFight().
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import data from '../../src/data/index.js';
import { scriptedInput } from '../../src/platform/input.js';
import { DT, FX_TAGS } from '../../src/contracts.js';
import { createQuestions } from '../../src/questions/index.js';

export { DT };
export const ICONS = new Set(('sword axe shield dash roar bolt blink nova fire frost storm meteor summon fist kick orb bow rain dagger knives ' +
  'roll smoke shadow shuriken coin potion bread bomb tonic charm star heart book hat cloak key rune lock up').split(' '));
export const FX_TYPES = new Set(['hit', 'slash', 'burst', 'ring', 'shockwave', 'beam', 'bolt', 'trail', 'afterimage', 'pillar', 'meteor',
  'sparkle', 'heal', 'levelup', 'poof', 'smoke', 'screenFlash', 'text']);

/** New game in the test zone at the dummy ring, player = mage (+ spec) at `level`, with `boons`. */
export function mk(spec = null, level = 3, boons = [], opts = {}) {
  const game = createGame({ data, name: 'Tester', seed: opts.seed ?? 7, zone: 'test', marker: opts.marker || 'dummy_ring',
    questions: createQuestions({ mode: 'auto' }) });
  const pr = game.progression;
  game.setFlag('look_chosen', true);
  pr.setLevel(level, { quiet: true, boons: false });
  pr.setClass('mage', { quiet: true });
  if (spec) pr.setSpec(spec, { quiet: true });
  for (const b of boons) pr.boons.push(b);
  const p = game.player;
  if (!opts.mortal) p.data.minHp = 1;
  const input = scriptedInput();
  const r = rec(game);
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  step(1);
  r.reset();
  return { game, pr, p, input, step, rec: r };
}

/** A ring of immobile enemies around the player. */
export function ring(game, n = 8, r = 1.6, opts = {}) {
  const p = game.player, out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (opts.phase || 0);
    out.push(game.ents.spawn(opts.kind || 'rat', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r,
      Object.assign({ noAi: opts.ai ? undefined : true, hp: opts.hp ?? 2000 }, opts.spawn)));
  }
  return out;
}

/** Records fx types, player-side damage, events. */
export function rec(game) {
  const r = { fx: new Map(), fxList: [], dmg: 0, hits: [], casts: [], events: [] };
  const orig = game.fx.bind(game);
  game.fx = (e) => { r.fx.set(e.type, (r.fx.get(e.type) || 0) + 1); if (r.fxList.length < 5000) r.fxList.push(Object.assign({}, e)); orig(e); };
  const p = game.player;
  game.bus.on('hit', (e) => {
    const s = e.source;
    const mine = s && (s === p || (s.owner === p.id));
    if (mine && e.target !== p) { r.dmg += e.amount; r.hits.push(e); }
  });
  game.bus.on('ability:cast', (e) => r.casts.push(e.slot + ':' + e.id));
  for (const ev of ['proj:reflected', 'summon', 'summon:expired', 'death', 'heal', 'status']) game.bus.on(ev, (e) => r.events.push([ev, e]));
  r.reset = () => { r.fx.clear(); r.fxList.length = 0; r.dmg = 0; r.hits.length = 0; r.casts.length = 0; r.events.length = 0; };
  r.has = (t) => (r.fx.get(t) || 0) > 0;
  r.count = (t) => r.fx.get(t) || 0;
  r.ev = (name) => r.events.filter((x) => x[0] === name).map((x) => x[1]);
  r.tagged = (tag) => r.hits.filter((h) => h.tags && h.tags.includes(tag));
  return r;
}

/** Tap an ability key: held for `hold` steps then released. */
export function press(ctx, slot, hold = 1) {
  ctx.input.set({ held: { [slot]: true } });
  ctx.step(hold);
  ctx.input.set({ held: { [slot]: false } });
  ctx.step(1);
}
/** Hold the attack key in DIR `dir` for `steps` steps, then release. */
export function attack(ctx, dir, steps) {
  ctx.input.set({ attackDir: dir });
  ctx.step(steps);
  ctx.input.set({ attackDir: -1 });
  ctx.step(1);
}
export function refill(ctx) {
  const { game, p } = ctx;
  game.kits.setResource(p, game.kits.resource(p).max);
  game.abilities.reset(p);
}
export const dirTo = (p, t) => {
  const dx = t.x - p.x, dy = t.y - p.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
};

// ------------------------------------------------------------------------------------------------ scripted play
/**
 * One step of "sensible play" for the kit: aims at the nearest enemy, keeps range (ranged kits) or closes in (Monk),
 * and uses every ability when it makes sense. Returns the input patch.
 */
export function bot(ctx, st) {
  const { game, p } = ctx;
  const specId = p.data.specId;
  const enemies = game.ents.all.filter((e) => e.type === 'enemy' && e.alive && !e.removed);
  const inp = { attackDir: -1, moveX: 0, moveY: 0, held: { space: false, q: false, f: false, shift: false } };
  if (!enemies.length) return inp;
  let near = null, nd = Infinity;
  for (const e of enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < nd) { nd = d; near = e; } }
  const tough = enemies.reduce((a, b) => (b.hpMax > a.hpMax ? b : a));
  const target = specId === 'monk' ? near : (nd < 3 ? near : tough);
  const td = Math.hypot(target.x - p.x, target.y - p.y);
  const res = game.kits.resource(p);
  const ready = (slot) => game.kits.unlocked(p, slot) && game.abilities.ready(p, slot) &&
    res.value >= ((game.kits.ability(p, slot).need ?? game.kits.ability(p, slot).cost) || 0);
  const close = enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 2.6).length;
  const dx = target.x - p.x, dy = target.y - p.y;
  // Attack aim: the axis toward the target; strafe on the other axis to line the shot up.
  const dir = dirTo(p, target);
  const ax = dir === 1 || dir === 3;
  const lineErr = ax ? dy : dx;
  if (specId === 'monk') {
    if (td > 0.9) { inp.moveX = dx / td; inp.moveY = dy / td; }
    inp.attackDir = td < 2.2 ? dir : -1;
    if (ready('f') && td > 1.6 && td < 4) inp.held.f = true;
    if (ready('shift') && close >= 2) inp.held.shift = true;
    if (ready('q') && close >= 3 && res.value >= 60) inp.held.q = true;
    return inp;
  }
  // ranged kits: keep 3.5..6 tiles, strafe to align
  const want = specId === 'conjurer' ? 4.5 : 4.2;
  let mx = 0, my = 0;
  if (nd < 2.2) { mx -= (near.x - p.x) / nd; my -= (near.y - p.y) / nd; }
  else if (td > want + 1.5) { mx += dx / td * 0.8; my += dy / td * 0.8; }
  if (Math.abs(lineErr) > 0.35) { if (ax) my += Math.sign(lineErr) * 0.8; else mx += Math.sign(lineErr) * 0.8; }
  const ml = Math.hypot(mx, my);
  if (ml > 0) { inp.moveX = mx / ml; inp.moveY = my / ml; }
  if (nd < 1.3 && ready('space')) { inp.held.space = true; inp.moveX = -(near.x - p.x) / nd; inp.moveY = -(near.y - p.y) / nd; }
  if (ready('q') && close >= 2) inp.held.q = true;
  if (specId === 'sorcerer') {
    // Overcharge: hold toward the target; release at the tier the Mana allows (fireball ~0.35 s, lance at 1.0 s).
    st.hold = st.hold || 0;
    const wantT = res.value >= 60 ? 1.05 : res.value >= 25 ? 0.35 : 0.05;
    if (st.hold * DT < wantT && Math.abs(lineErr) < 1.2) { inp.attackDir = dir; st.hold++; }
    else { inp.attackDir = -1; st.hold = 0; }
    if (ready('f') && td < 6 && td > 2.5 && Math.abs(lineErr) < 1.2) { inp.held.f = true; }
    if (ready('shift')) inp.held.shift = true;
  } else {
    inp.attackDir = Math.abs(lineErr) < 1.0 ? dir : -1;
    if (specId === 'conjurer') {
      if (ready('f') && game.combat.summonsOf(p, 'familiar', []).length < 3) inp.held.f = true;
      if (ready('shift')) inp.held.shift = true;
    }
  }
  // edge-trigger ability keys so held:true becomes a press
  for (const s of ['space', 'q', 'f', 'shift']) {
    if (inp.held[s] && st['h' + s]) inp.held[s] = false;
    st['h' + s] = inp.held[s];
  }
  return inp;
}

/**
 * Mixed fight: one tough enemy (elite x2.5 hp) + four weak ones of level `level` placed 6 tiles away, scripted play
 * until all fall (cap `cap` s). DPS = enemy hp removed / seconds.
 */
export function mixedFight(spec, level, boons = [], cap = 45) {
  const ctx = mk(spec, level, boons, { marker: 'start', seed: 21 });
  const { game, p, input } = ctx;
  game.companions && game.companions.set([]);
  const base = 6 * Math.pow(level, 1.4);
  const foes = [];
  const t = game.ents.spawn('boar', p.x + 7, p.y, { level, ai: { aggro: 12, leash: 0 } });
  t.hpMax = t.hp = Math.round(base * 2.5);
  foes.push(t);
  for (let i = 0; i < 4; i++) {
    const a = -0.9 + i * 0.6;
    const w = game.ents.spawn('rat', p.x + 6 + Math.cos(a) * 1.5, p.y + Math.sin(a) * 2.5, { level, ai: { aggro: 12, leash: 0 } });
    w.hpMax = w.hp = Math.round(base);
    foes.push(w);
  }
  const total = foes.reduce((s, e) => s + e.hpMax, 0);
  const st = {};
  let steps = 0;
  const max = Math.round(cap / DT);
  while (steps < max && foes.some((e) => e.alive && !e.removed)) {
    if (steps % 2 === 0) input.set(bot(ctx, st));
    game.step(DT, input.sample());
    steps++;
  }
  const left = foes.reduce((s, e) => s + (e.alive && !e.removed ? Math.max(0, e.hp) : 0), 0);
  const secs = steps * DT;
  return { dps: (total - left) / secs, secs, cleared: left === 0, total };
}

// ------------------------------------------------------------------------------------------------ data shape tests
test('mage data: class, specs and boons match the shapes Meta reads; icons from the closed list', () => {
  const c = data.classes.mage;
  assert.equal(c.id, 'mage');
  assert.ok(c.name && c.blurb && c.color && c.base && c.basic && c.look && c.companion);
  for (const k of ['hp', 'hpPerLevel', 'power', 'powerPerLevel', 'speed']) assert.equal(typeof c.base[k], 'number');
  assert.ok(ICONS.has(c.basic.icon));
  for (const a of c.abilities) { assert.ok(ICONS.has(a.icon), a.icon); assert.ok(a.desc.length < 90); }
  const specs = ['conjurer', 'sorcerer', 'monk'];
  for (const id of specs) {
    const s = data.specs[id];
    assert.equal(s.from, 'mage');
    assert.ok(s.name && s.blurb && s.color && s.mods && s.basic && s.look && s.abilities.length === 2);
    assert.ok(ICONS.has(s.basic.icon));
    for (const a of s.abilities) assert.ok(ICONS.has(a.icon), a.icon);
  }
  const boons = Object.values(data.boons).filter((b) => b.class === 'mage' || specs.includes(b.spec));
  assert.equal(boons.filter((b) => b.class === 'mage').length, 8);
  for (const id of specs) assert.equal(boons.filter((b) => b.spec === id).length, 4);
  for (const b of boons) { assert.ok(ICONS.has(b.icon), b.icon); assert.ok(b.name && b.desc && b.desc.length < 90, b.id); }
  // look vocabulary (CONTRACTS 6)
  const held = new Set(['staff', 'orb', 'fists']);
  for (const l of [c.look, ...specs.map((s) => data.specs[s].look)]) {
    assert.ok(['robe', 'gi'].includes(l.outfit.style));
    assert.ok(held.has(l.held.style));
    assert.ok(['wizard', 'circlet', 'bandana'].includes(l.hat.style));
  }
  for (const f of Object.values(data.specs.conjurer.kit.familiars)) assert.ok(['quadruped', 'flyer', 'golem'].includes(f.look.rig));
  assert.ok(FX_TAGS.includes('summoned') && FX_TAGS.includes('ki') && FX_TAGS.includes('charge'));
});

test('mage picker and HUD wiring: class picker payload, ability list, kit HUD names', () => {
  const ctx = mk(null, 5);
  // Meta's abilityList lists empty layered-kit slots as nameless entries (reported in docs/notes/kit-mage.md): filter.
  const list = ctx.pr.abilityList().filter((a) => a.name);
  assert.deepEqual(list.map((a) => a.slot), ['space', 'q']);
  const hud = ctx.game.hudState();
  assert.equal(hud.basic.name, 'Twin Bolts');
  assert.equal(hud.player.resource.name, 'Mana');
  assert.equal(hud.abilities[0].name, 'Blink');
  assert.equal(hud.abilities[1].icon, 'nova');
  for (const [spec, f, sh] of [['conjurer', 'summon_familiar', 'grand_conjuration'], ['sorcerer', 'meteor', 'cataclysm'], ['monk', 'flying_kick', 'thousand_palms']]) {
    const c2 = mk(spec, 11);
    const ids = c2.pr.abilityList().filter((a) => a.name).map((a) => a.id);
    assert.deepEqual(ids, ['blink', 'arcane_nova', f, sh]);
    const h = c2.game.hudState();
    assert.ok(h.abilities.every((a) => a.unlocked && ICONS.has(a.icon)));
    if (spec === 'monk') assert.equal(h.player.resource.name, 'Ki');
  }
});

test('companion Elowen uses the mage companion block (look merged, ranged bolts)', () => {
  const ctx = mk(null, 6);
  const [el] = ctx.game.companions.set(['mage']);
  assert.equal(el.name, 'Elowen');
  assert.equal(el.look.outfit.style, 'robe');
  assert.equal(el.look.held.style, 'staff');
  assert.equal(el.ai.brain, 'ally_ranged');
  ring(ctx.game, 3, 4);
  ctx.rec.reset();
  let comp = 0;
  ctx.game.bus.on('hit', (e) => { if (e.source === el) comp += e.amount; });
  ctx.step(300);
  assert.ok(comp > 0, 'Elowen deals damage');
});
