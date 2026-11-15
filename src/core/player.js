// STUB: replaced by the Sim package
// Creates the player and moves it with WASD and simple per-axis tile collision.
import { ANIM } from '../contracts.js';
import { dirFromVec } from './math.js';

function blocked(game, x, y, r) {
  const w = game.world;
  return w.solidAt(x - r, y - r) || w.solidAt(x + r, y - r) || w.solidAt(x - r, y + r) || w.solidAt(x + r, y + r);
}

export default {
  id: 'player',
  init(game) {
    const looks = game.data.looks || {};
    const look = looks.PLAYER_LOOKS ? looks.PLAYER_LOOKS[0] : { rig: 'humanoid' };
    const p = game.ents.create({
      kind: 'player', type: 'player', team: 'player', name: game.name, look: JSON.parse(JSON.stringify(look)),
      radius: 0.3, solid: true, pushable: true, hp: 10, hpMax: 10, stats: { power: 1, defense: 0, speed: 4 },
      data: { name: game.name, classId: null, specId: null, target: null },
    });
    game.player = p;
    return { entity: p };
  },
  update(game, dt) {
    const p = game.player;
    if (!p) return;
    const inp = game.input;
    const mx = game.inputLock > 0 ? 0 : inp.moveX, my = game.inputLock > 0 ? 0 : inp.moveY;
    const sp = (p.stats.speed || 4);
    p.vx = mx * sp; p.vy = my * sp;
    const nx = p.x + p.vx * dt;
    if (!blocked(game, nx, p.y, p.radius)) p.x = nx;
    const ny = p.y + p.vy * dt;
    if (!blocked(game, p.x, ny, p.radius)) p.y = ny;
    const moving = mx !== 0 || my !== 0;
    if (moving) { p.dir = dirFromVec(mx, my); p.angle = Math.atan2(my, mx); }
    const anim = moving ? ANIM.WALK : ANIM.IDLE;
    if (p.anim !== anim) { p.anim = anim; p.animT = 0; }
  },
  hud(game, hud) {
    const p = game.player;
    if (!p) return;
    hud.player.name = p.name; hud.player.hp = p.hp; hud.player.hpMax = p.hpMax; hud.player.look = p.look;
    hud.player.power = p.stats.power || 0; hud.player.defense = p.stats.defense || 0; hud.player.speed = p.stats.speed || 0;
    hud.minimap.px = p.x; hud.minimap.py = p.y;
    hud.prompt = null;
  },
};
