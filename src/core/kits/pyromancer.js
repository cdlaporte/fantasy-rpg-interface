// PYROMANCER mastery (tier 3, layered over the Sorcerer; docs/MASTERY.md). Fire everywhere.
// Passive Spreading Flames: every fire hit you land (Embers, Fireball blasts, Meteors, burning ground) sets the target
// burning, and burning spreads: about twice a second each burning enemy near you sets the nearest unburnt enemy within
// reach alight (an orange `trail` jumps between them + a small `burst`). Shift = Inferno (replaces Cataclysm): a flame
// `pillar`, an outward blast and a ring of fire (fourteen `ground_fire` patches around you that push enemies back and
// burn), while sixteen telegraphed fireballs (`meteor`, falling `z`) rain on the enemies inside, each leaving fire.
// Numbers: data/specs/mage.js `pyromancer.kit`. State keys: `py_*` in p.data.kit.
import SPECS from '../../data/specs/mage.js';
import { enemiesNear, sdata, setPatch } from './mage.js';
import { tintAt, tintAmountAt } from '../clock.js';

const DEF = SPECS.pyromancer;
const D = (game) => sdata(game, 'pyromancer') || DEF;
const K = (game) => D(game).kit || DEF.kit;
const TAU = Math.PI * 2;

function interp(tab, lv) {
  if (!tab || !tab.length) return 1;
  if (lv <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) { const a = tab[i - 1], b = tab[i]; if (lv <= b[0]) return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]); }
  return tab[tab.length - 1][1];
}
const lateMul = (game, p) => interp(D(game).balance && D(game).balance.dmgMul, game.kits.level(p));

/** Presentation mood while the ultimate runs: tint the scene light (the clock rewrites game.ambience every step, before
 *  the kits; moodEnd puts the clock's tint back at once). tintAmount stays within the contract's 0.25. */
function mood(game, color, amount) { const a = game.ambience; if (a) { a.tint = color; a.tintAmount = Math.min(0.25, amount); } }
function moodEnd(game) {
  const a = game.ambience, c = game.clock;
  if (a && c && typeof c.hour === 'number') { a.tint = tintAt(c.hour); a.tintAmount = tintAmountAt(c.hour); }
}

// ---------------------------------------------------------------------------------------------- spreading flames
function ignite(game, p, t) {
  const ig = K(game).ignite;
  game.combat.status(t, 'burn', ig.t, ig.burn * game.combat.powerOf(p), p);
}
function updateSpread(game, p, dt) {
  const k = p.data.kit, s = K(game), sp = s.spread;
  k.py_spreadT -= dt;
  if (k.py_spreadT > 0) return;
  k.py_spreadT = sp.every;
  const list = enemiesNear(game, p, p.x, p.y, sp.scan, k.py_near || (k.py_near = []));
  if (list.length < 2) return;
  // pass 1: who burns (snapshot, so a fresh ignition does not spread in the same pulse)
  const burning = k.py_burning || (k.py_burning = []);
  burning.length = 0;
  for (let i = 0; i < list.length; i++) if (list[i].status.burn > 0) burning.push(list[i]);
  let n = 0;
  for (let i = 0; i < burning.length && n < sp.max; i++) {
    const a = burning[i];
    let best = null, bd = sp.range * sp.range;
    for (let j = 0; j < list.length; j++) {
      const b = list[j];
      if (b === a || b.status.burn > 0) continue;
      const d = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) continue;
    ignite(game, p, best);
    game.fx({ type: 'trail', x: a.x, y: a.y, x2: best.x, y2: best.y, color: s.color });
    game.fx({ type: 'burst', x: best.x, y: best.y, n: 8, color: s.yellow, r: 0.5 });
    n++;
    k.py_spreads = (k.py_spreads || 0) + 1;
  }
}

// ---------------------------------------------------------------------------------------------- inferno
function castInferno(game, p) {
  const s = K(game), f = s.inferno, k = p.data.kit;
  const pw = game.combat.powerOf(p);
  const cx = p.x, cy = p.y;
  // the opening blast throws enemies outward, then the ring of fire springs up behind them
  game.combat.aoe(p, { x: cx, y: cy, r: f.blastR, dmg: f.blastDmg, knockback: 8, type: 'magic', element: 'fire', fx: 'shockwave', color: s.color,
    status: { id: 'burn', t: s.ignite.t, p: s.ignite.burn * pw }, shake: 0.5, tags: ['inferno_blast'] });
  for (let i = 0; i < f.ringN; i++) {
    const a = (i / f.ringN) * TAU;
    const x = cx + Math.cos(a) * f.ringR, y = cy + Math.sin(a) * f.ringR;
    if (game.world.solidAt(x, y, true)) continue;
    game.combat.zone(p, { x, y, r: f.ringZoneR, dur: f.ringDur, dmg: f.ringDmg, element: 'fire', color: s.color, push: f.ringPush,
      status: { id: 'burn', t: 1.5, p: s.ignite.burn * pw * 0.5 }, tags: ['inferno_ring'] });
  }
  game.fx({ type: 'pillar', x: cx, y: cy, r: 1.6, color: s.color, dur: 1.2 });
  game.fx({ type: 'ring', x: cx, y: cy, r: f.ringR, color: s.yellow, dur: 0.7 });
  game.fx({ type: 'burst', x: cx, y: cy, n: 40, color: s.yellow, r: f.blastR });
  game.fx({ type: 'screenFlash', color: s.color, dur: 0.35 });
  game.camera.shake = Math.max(game.camera.shake, 0.55);
  k.py_inferno = { x: cx, y: cy, n: 0, t: 0.25 };
  game.ents.setAnim(p, 'cast', 0.6);
  setPatch(game, p, 'py_inferno', { held: { glow: '#ffffff' }, aura: { style: 'flame', color: s.yellow } });
  game.bus.emit('sfx', { id: 'spell' });
  k.py_infernos = (k.py_infernos || 0) + 1;
  return undefined;
}
function updateInferno(game, p, dt) {
  const k = p.data.kit, run = k.py_inferno;
  if (!run) return;
  const s = K(game), f = s.inferno;
  mood(game, s.crimson, 0.22);                       // the scene glows red while the fire rains
  run.t -= dt;
  if (run.t > 0) return;
  run.t += f.every;
  // a fireball on an enemy inside the ring (cycling through them), else a random spot inside
  const list = enemiesNear(game, p, run.x, run.y, f.range, k.py_near2 || (k.py_near2 = []));
  let x, y;
  if (list.length) {
    const t = list[run.n % list.length];
    x = t.x + (game.rng.next() - 0.5) * 0.8; y = t.y + (game.rng.next() - 0.5) * 0.8;
  } else {
    const a = game.rng.next() * TAU, d = game.rng.next() * f.ringR;
    x = run.x + Math.cos(a) * d; y = run.y + Math.sin(a) * d;
  }
  const pw = game.combat.powerOf(p);
  game.combat.aoe(p, { x, y, r: f.r, dmg: f.dmg, delay: f.delay, telegraph: 'circle', telegraphColor: s.color, meteor: true, fx: 'meteor',
    color: s.color, knockback: 3, type: 'magic', element: 'fire', shake: f.shake, status: { id: 'burn', t: s.ignite.t, p: s.ignite.burn * pw },
    zone: { r: f.fireR, dur: f.fireDur, dmg: f.fireDmg, element: 'fire', color: s.color }, tags: ['inferno_rain'],
    onResolve(g, hits, ax, ay) {
      g.fx({ type: 'burst', x: ax, y: ay, n: 14, color: s.yellow, r: f.r });
      const kk = p.data.kit;
      if (kk) kk.py_rainHits = (kk.py_rainHits || 0) + 1;
    } });
  run.n++;
  if (run.n >= f.n) { k.py_inferno = null; setPatch(game, p, 'py_inferno', null); moodEnd(game); }
}

// ---------------------------------------------------------------------------------------------- the kit
const pyromancer = {
  id: 'pyromancer',
  parent: 'sorcerer',
  tier: 3,
  onEquip(game, p) {
    const k = p.data.kit;
    k.py_spreadT = 0; k.py_inferno = null; k.py_near = []; k.py_burning = [];
    setPatch(game, p, 'ms_look', D(game).look);
  },
  update(game, p, dt) {
    updateSpread(game, p, dt);
    updateInferno(game, p, dt);
  },
  hud(game, p, hud) {
    if (!p.data.kit.py_inferno) return;
    hud.kitHud = game.kits.kitHud;
    hud.kitHud.stance = 'Inferno';
  },
  abilities: {
    shift: {
      id: 'inferno', name: 'Inferno', icon: 'fire', unlock: 15,
      get cd() { return DEF.kit.inferno.cd; }, get cost() { return DEF.kit.inferno.cost; },
      desc: DEF.ultimate.desc,
      isActive(game, p) { return !!p.data.kit.py_inferno; },
      cast: castInferno,
    },
  },
  hooks: {
    onOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
    onMinionOutgoing(game, p, info) { info.amount *= lateMul(game, p); },
    onHit(game, p, e) {
      // every fire hit ignites (DoT ticks only refresh nothing: they are already burning)
      if (e.dot || e.element !== 'fire' || !e.target || e.target === p || e.killed || !e.target.alive) return;
      if (!(e.target.status.burn > 0)) {
        ignite(game, p, e.target);
        const k = p.data.kit;
        k.py_ignites = (k.py_ignites || 0) + 1;
      }
    },
  },
};

export default pyromancer;
