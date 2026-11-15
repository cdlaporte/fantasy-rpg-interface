// STUB: replaced by the Sim package
export default {
  id: 'combat',
  init(game) {
    return {
      hostile(a, b) { return !!a && !!b && a.team !== b.team && a.team !== 'neutral' && b.team !== 'neutral' && a.team !== 'town' && b.team !== 'town'; },
      damage() { return 0; },
      heal() { return 0; },
      kill(target, source) { if (target) { target.hp = 0; target.alive = false; game.bus.emit('death', { ent: target, killer: source || null }); } },
      status() {},
      meleeArc() { return []; },
      projectile() { return null; },
      aoe() { return []; },
      zone() { return null; },
    };
  },
};
