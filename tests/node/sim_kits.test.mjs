// Sim: kit dispatcher with test-only kits: charge-and-release basic, hold ability draining a resource,
// finisher spending pips, parry window; auto-repeat, unlock levels, cooldowns, layering, hooks, HUD.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/core/game.js';
import baseData from '../../src/data/index.js';
// integration: fixtures go into a private copy, never into the shared data module (other test files, such as the
// content validators and the bot, run in the same process and must see only real content)
const data = Object.assign({}, baseData, { zones: Object.assign({}, baseData.zones), enemies: Object.assign({}, baseData.enemies),
  npcs: Object.assign({}, baseData.npcs) });
import { scriptedInput } from '../../src/platform/input.js';
import { DT } from '../../src/contracts.js';

const rows = [];
for (let y = 0; y < 30; y++) { let r = ''; for (let x = 0; x < 40; x++) r += x === 0 || y === 0 || x === 39 || y === 29 ? '#' : '.'; rows.push(r); }
data.zones.simkit = data.zones.simkit || { id: 'simkit', name: 'Kit Yard', palette: 'default', seed: 1, tiles: { rows, legend: { '#': 'hedge', '.': 'grass' } },
  markers: { start: [20, 15] }, exits: [], props: [], spawns: [], npcs: [], gates: [], chests: [], triggers: [] };

const log = [];
// Charge kit: raw basic (charge on hold, fire on release), a hold ability draining Focus, a parry on F, a locked ult.
const tcharge = {
  id: 'tcharge', parent: null,
  resource: { id: 'focus', name: 'Focus', max: 100, color: '#88ccff', start: 50 },
  basicMode: 'raw',
  basicInfo: { name: 'Charge Bolt', icon: 'bolt' },
  onEquip(game, p) { p.data.kit.lookPatch = { cape: { color: '#123456' } }; p.data.kit.blocks = []; },
  update(game, p) { p.data.kit.speedMul = p.data.kit.charging ? 0.5 : 1; },
  basic(game, p, ctx) {
    const k = p.data.kit;
    if (ctx.held) { if (!k.charging) { k.charging = true; game.ents.setFxTag(p, 'charge', true); } return; }
    if (ctx.released) {
      k.charging = false; game.ents.setFxTag(p, 'charge', false);
      const tier = ctx.heldT >= 1 ? 'full' : ctx.heldT >= 0.3 ? 'mid' : 'tap';
      log.push('fire:' + tier);
      game.abilities.use('projectile', p, { angle: ctx.angle, dmg: tier === 'full' ? 3 : tier === 'mid' ? 1.8 : 0.6, speed: 12, range: 7, pierce: tier === 'full' });
    }
  },
  abilities: {
    space: { id: 'drain', name: 'Drain Beam', icon: 'bolt', unlock: 1, need: 10,
      cast() { log.push('drain:start'); },
      hold(game, p, ctx, dt) { if (!game.kits.spend(p, 20 * dt)) return false; return undefined; },
      release(game, p, ctx) { log.push('drain:end:' + ctx.heldT.toFixed(1)); } },
    f: { id: 'parry', name: 'Parry', icon: 'shield', unlock: 1,
      cast(game, p) { game.abilities.use('guard', p, { arc: 120, reduce: 0.85, perfect: 0.25, stunAttacker: 1 }); },
      release(game, p) { p.data.kit.lastGuard = game.abilities.unguard(p); } },
    shift: { id: 'ult', name: 'Ultimate', icon: 'star', unlock: 11, cd: 30, cast() { log.push('ult'); } },
  },
  hooks: { onBlock(game, p, e) { p.data.kit.blocks.push(e.perfect); } },
};
// Pip kit: auto basic gaining a pip per hit, finisher Q spending all pips; hooks counted.
const tpips = {
  id: 'tpips', parent: null,
  resource: { id: 'combo', name: 'Combo', max: 5, color: '#58d68d', start: 0, pips: true },
  interval: 0.24,
  basicInfo: { name: 'Twin Daggers', icon: 'dagger' },
  basic(game, p, ctx) { game.abilities.use('melee_arc', p, { angle: ctx.angle, arc: 70, range: 1, dmg: 0.5, style: 'dagger', knockback: 0 }); },
  abilities: {
    q: { id: 'fan', name: 'Fan of Knives', icon: 'knives', unlock: 1, cd: 2,
      cast(game, p) {
        const pips = game.kits.resource(p).value;
        if (pips < 1) return false;
        game.kits.setResource(p, 0);
        const shots = game.abilities.use('multishot', p, { n: 3 + 2 * pips, ring: pips >= 5, spread: 60 + 60 * pips, dmg: 0.7, model: 'knife', range: 5 });
        log.push('fan:' + shots.length);
        return undefined;
      } },
  },
  hooks: {
    onHit(game, p, e) { if (e.type === 'melee') game.kits.gain(p, 1); log.push('hit'); },
    onKill() { log.push('kill'); },
    onHurt() { log.push('hurt'); },
  },
  hud(game, p, hud) { hud.kitHud = game.kits.kitHud; game.kits.kitHud.label = 'Pips'; },
};
// Layering: class + spec.
const tclass = { id: 'tclass', parent: null, resource: { id: 'rage', name: 'Rage', max: 100, start: 0 }, interval: 0.5,
  basic(game, p, ctx) { log.push('class-basic'); game.abilities.use('melee_arc', p, { angle: ctx.angle }); },
  update(game, p) { p.data.kit.classTicks = (p.data.kit.classTicks || 0) + 1; },
  abilities: { space: { id: 'bash', name: 'Bash', unlock: 1, cd: 1, cast(game, p, ctx) { game.abilities.use('dash', p, { angle: ctx.moveAngle, dist: 2 }); } } },
  hooks: { onHit() { log.push('class-hook'); } } };
const tspec = { id: 'tspec', parent: 'tclass', interval: 0.3,
  basic(game, p, ctx) { log.push('spec-basic'); game.abilities.use('melee_arc', p, { angle: ctx.angle }); },
  update(game, p) { p.data.kit.specTicks = (p.data.kit.specTicks || 0) + 1; },
  abilities: { f: { id: 'wall', name: 'Wall', unlock: 1, cast() { log.push('wall'); } } },
  hooks: { onHit() { log.push('spec-hook'); } } };

function mk(kitId) {
  const game = createGame({ data, name: 'Tester', seed: 8, zone: 'simkit', marker: 'start' });
  for (const k of [tcharge, tpips, tclass, tspec]) game.kits.register(k);
  const input = scriptedInput();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.step(DT, input.sample()); };
  const p = game.player;
  p.data.minHp = 1;
  if (kitId) game.kits.set(p, kitId, null);
  log.length = 0;
  return { game, input, step, p };
}
const dummy = (game, x, y, hp = 500) => game.ents.spawn('rat', x, y, { noAi: true, hp, hpMax: hp });

test('charge-and-release basic: tap / mid / full by held time; charge fxTag and slowed movement', () => {
  const { game, input, step, p } = mk('tcharge');
  game.setFlag('has_stick', true);
  input.set({ attackDir: 1 }); step(5); input.set({ attackDir: -1 }); step(2);
  input.set({ attackDir: 1 }); step(30);
  assert.ok(p.fxTags.includes('charge'), 'charging shows fxTag charge');
  input.set({ attackDir: -1 }); step(2);
  assert.ok(!p.fxTags.includes('charge'));
  input.set({ attackDir: 1 }); step(70); input.set({ attackDir: -1 }); step(2);
  assert.deepEqual(log.filter((l) => l.startsWith('fire')), ['fire:tap', 'fire:mid', 'fire:full']);
  // movement while charging is halved by kit speedMul
  const x0 = p.x;
  input.set({ moveX: 1 }); step(30);
  const free = p.x - x0;
  input.set({ attackDir: 1 }); step(2);
  const x1 = p.x; step(30);
  const charged = p.x - x1;
  input.set({ attackDir: -1, moveX: 0 }); step(2);
  assert.ok(Math.abs(charged - free * 0.5) < 0.1, `charging halves speed: ${free.toFixed(2)} vs ${charged.toFixed(2)}`);
  const hud = game.hudState();
  assert.equal(hud.basic.name, 'Charge Bolt');
  assert.equal(hud.basic.icon, 'bolt');
});

test('hold ability drains the resource and ends when it runs out', () => {
  const { game, input, step, p } = mk('tcharge');
  game.setFlag('has_stick', true);
  let casts = 0;
  game.bus.on('ability:cast', (e) => { if (e.slot === 'space') casts++; });
  assert.equal(game.kits.resource(p).value, 50);
  input.set({ held: { space: true } });
  step(60);
  const v = game.kits.resource(p).value;
  assert.ok(v > 28 && v < 32, 'drained ~20/s: ' + v);
  assert.equal(game.hudState().abilities[0].active, true);
  step(120);
  assert.ok(game.kits.resource(p).value < 1);
  assert.ok(log.some((l) => l.startsWith('drain:end')), 'release called when the hold returned false');
  assert.equal(game.kits.holding(p, 'space'), false);
  input.set({ held: { space: false } });
  step(2);
  assert.equal(casts, 1);
  input.set({ held: { space: true } }); step(2); input.set({ held: { space: false } }); step(1);
  assert.equal(casts, 1, 'needs 10 Focus to start');
  const hud = game.hudState();
  assert.equal(hud.player.resource.name, 'Focus');
  assert.equal(hud.abilities[0].ready, false);
});

test('finisher spends all pips; pips come from hits via hooks; kitHud pips', () => {
  const { game, input, step, p } = mk('tpips');
  game.setFlag('has_stick', true);
  const d = dummy(game, p.x + 0.8, p.y);
  input.set({ attackDir: 1 });
  step(36);
  input.set({ attackDir: -1 });
  step(1);
  const pips = game.kits.resource(p).value;
  assert.equal(pips, 3, 'three swings, three pips');
  const hud = game.hudState();
  assert.equal(hud.kitHud.pips, 3);
  assert.equal(hud.kitHud.pipsMax, 5);
  assert.equal(hud.kitHud.label, 'Pips');
  input.set({ pressed: { q: true } }); step(1);
  assert.ok(log.includes('fan:9'), '3 + 2 * pips knives');
  assert.equal(game.kits.resource(p).value, 0);
  assert.ok(game.abilities.cdFrac(p, 'q') > 0.9);
  step(130);
  input.set({ pressed: { q: true } }); step(1);
  assert.equal(log.filter((l) => l.startsWith('fan')).length, 1, 'refused with no pips (no cooldown started)');
  assert.equal(game.abilities.cdFrac(p, 'q'), 0);
  // hooks
  game.combat.damage(p, 1, { source: d });
  assert.ok(log.includes('hurt'));
  game.combat.damage(d, 9999, { source: p });
  assert.ok(log.includes('kill'));
});

test('parry window: perfect block within 0.25 s stuns and reflects; later blocks reduce', () => {
  const { game, input, step, p } = mk('tcharge');
  game.setFlag('has_stick', true);
  p.angle = 0; p.dir = 1;
  const foe = dummy(game, p.x + 1, p.y);
  input.set({ held: { f: true } });
  step(1);
  assert.ok(p.data.guard && p.data.guard.active);
  assert.equal(p.anim, 'block');
  const hp0 = p.hp;
  game.combat.damage(p, 10, { source: foe, type: 'melee' });
  assert.equal(p.hp, hp0, 'perfect block negates');
  assert.ok(foe.status.stun > 0, 'attacker stunned');
  step(30);
  game.combat.damage(p, 10, { source: foe, type: 'melee' });
  assert.equal(hp0 - p.hp, 2, 'normal block: 85% reduced');
  assert.deepEqual(p.data.kit.blocks, [true, false]);
  input.set({ held: { f: false } });
  step(1);
  assert.ok(p.data.kit.lastGuard.blocked > 8);
  assert.equal(p.data.guard, null);
  // perfect block reflects a projectile
  game.ents.remove(foe);
  const shooter = dummy(game, p.x + 5, p.y);
  let hitShooter = 0;
  game.bus.on('hit', (e) => { if (e.target === shooter && e.source === p) hitShooter++; });
  game.combat.projectile(shooter, { angle: Math.PI, speed: 12, range: 8, dmg: 1 });
  step(18);
  input.set({ held: { f: true } });
  step(40);
  input.set({ held: { f: false } });
  assert.equal(hitShooter, 1, 'reflected back into the shooter');
});

test('auto-repeat by interval, unlock levels, cooldowns, look patch', () => {
  const { game, input, step, p } = mk();
  game.setFlag('has_stick', true);
  let swings = 0;
  game.bus.on('sfx', (e) => { if (e.id === 'swing') swings++; });
  input.set({ attackDir: 2 });
  step(120);
  input.set({ attackDir: -1 });
  assert.equal(swings, 5, 'novice stick repeats every 0.45 s while held (0, .45, .9, 1.35, 1.8)');
  game.kits.set(p, 'tcharge', null);
  let locked = 0, ult = 0;
  game.bus.on('ability:locked', () => locked++);
  input.set({ pressed: { shift: true } }); step(1);
  assert.equal(locked, 1);
  assert.equal(game.hudState().abilities[3].unlocked, false);
  assert.equal(game.hudState().abilities[3].icon, 'lock');
  game.progression.level = 11;
  input.set({ pressed: { shift: true } }); step(1);
  game.bus.on('ability:cast', (e) => { if (e.id === 'ult') ult++; });
  input.set({ pressed: { shift: true } }); step(1);
  assert.equal(ult, 0, 'on cooldown');
  assert.ok(log.filter((l) => l === 'ult').length === 1);
  assert.ok(game.hudState().abilities[3].cdFrac > 0.9);
  game.abilities.reset(p);
  input.set({ pressed: { shift: true } }); step(1);
  assert.equal(ult, 1);
  // look patch from the kit
  game.setFlag('look_chosen', true);
  assert.equal(p.look.cape.color, '#123456');
  assert.equal(p.look.outfit.style, 'tunic', 'base look, not the cloak');
  // input lock releases holds and blocks casts
  input.set({ held: { f: true } }); step(1);
  assert.ok(p.data.guard);
  game.lockInput(); step(1);
  assert.equal(p.data.guard, null, 'released when input is locked');
  game.unlockInput();
});

test('layering: class then spec (basic, abilities, update, hooks); progression events', () => {
  const { game, input, step, p } = mk();
  game.setFlag('has_stick', true);
  game.progression.classId = 'tclass';
  game.bus.emit('class:set', { classId: 'tclass' });
  assert.equal(game.kits.active(p).id, 'tclass');
  assert.equal(p.data.resource.id, 'rage');
  game.progression.specId = 'tspec';
  game.bus.emit('spec:set', { specId: 'tspec' });
  const L = game.kits.active(p);
  assert.equal(L.id, 'tspec');
  assert.equal(L.parent, 'tclass');
  assert.equal(L.abilities.space.id, 'bash');
  assert.equal(L.abilities.f.id, 'wall');
  assert.equal(L.resource.id, 'rage', 'resource inherited from the class');
  dummy(game, p.x + 0.8, p.y);
  input.set({ attackDir: 1 }); step(20); input.set({ attackDir: -1 });
  assert.ok(log.includes('spec-basic') && !log.includes('class-basic'), 'spec basic overrides');
  assert.ok(log.indexOf('class-hook') >= 0 && log.indexOf('class-hook') < log.indexOf('spec-hook'), 'hooks run class then spec');
  assert.ok(p.data.kit.classTicks > 10 && p.data.kit.specTicks > 10, 'both updates run');
  input.set({ moveX: 0, moveY: 1, pressed: { space: true } }); step(1);
  assert.ok(p.data.dashing, 'class ability still available');
  step(30);
  input.set({ moveY: 0 });
  // a second test game does not see stale class state
  const { p: p2, game: g2 } = mk();
  assert.equal(g2.kits.active(p2).id, 'novice');
});
